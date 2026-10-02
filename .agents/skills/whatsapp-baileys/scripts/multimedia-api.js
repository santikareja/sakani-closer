/**
 * WhatsApp Multimedia API Server
 * 
 * Servidor Express que demuestra cómo implementar endpoints para enviar multimedia
 * en tres escenarios: URL remota, Archivo local (URI) y Carga de archivos (Upload).
 * 
 * Endpoints:
 * - POST /api/send/url    - Envía multimedia desde un link externo
 * - POST /api/send/local  - Envía un archivo que ya existe en el servidor (por nombre)
 * - POST /api/send/upload - Sube un archivo mediante multipart/form-data y lo envía
 * 
 * Dependencias:
 * npm install @whiskeysockets/baileys pino qrcode-terminal express multer
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());

// ============================================
// CONFIGURACIÓN DE ALMACENAMIENTO (MULTER)
// ============================================

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = './uploads';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// ============================================
// HELPERS (DEDUCCIÓN DE TIPO)
// ============================================

/**
 * Deduce el tipo de mensaje para Baileys (image, video, audio, document)
 * basándose en el mimetype o la extensión del archivo.
 */
function detectBaileysType(mimetypeOrPath) {
    const input = mimetypeOrPath.toLowerCase();

    // Por mimetype (ideal para Upload)
    if (input.includes('image')) return 'image';
    if (input.includes('video')) return 'video';
    if (input.includes('audio')) return 'audio';

    // Por extensión (ideal para URL o Archivo local)
    const ext = input.split('.').pop().split('?')[0]; // Limpiar query params de URL
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
    if (['mp4', 'mov', '3gp', 'avi', 'mkv'].includes(ext)) return 'video';
    if (['mp3', 'ogg', 'wav', 'aac', 'm4a', 'opus'].includes(ext)) return 'audio';

    return 'document';
}

// ============================================
// GESTIÓN DE SESIÓN (BAILEYS)
// ============================================

let sock = null;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_api');

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }),
        browser: ['Multimedia API', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) qrcode.generate(qr, { small: true });

        if (connection === 'open') {
            console.log('✅ API Conectada a WhatsApp');
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        }
    });
}

// ============================================
// ENDPOINTS DE ENVÍO
// ============================================

/**
 * ESCENARIO 1: Enviar desde URL Remota
 * Recibe: { to, url, caption }
 */
app.post('/api/send/url', async (req, res) => {
    const { to, url, caption } = req.body;

    if (!sock) return res.status(500).json({ error: 'WhatsApp no conectado' });
    if (!to || !url) return res.status(400).json({ error: 'Faltan parámetros (to, url)' });

    try {
        const type = detectBaileysType(url);

        const messageContent = {
            [type]: { url: url },
            caption: caption || ''
        };

        const result = await sock.sendMessage(to, messageContent);
        res.json({ success: true, messageId: result.key.id, detectedType: type });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * ESCENARIO 2: Enviar Archivo Local (Ya en servidor)
 * Recibe: { to, fileName, caption }
 * El archivo debe estar en /public/media/
 */
app.post('/api/send/local', async (req, res) => {
    const { to, fileName, caption } = req.body;

    if (!sock) return res.status(500).json({ error: 'WhatsApp no conectado' });
    if (!to || !fileName) return res.status(400).json({ error: 'Faltan parámetros (to, fileName)' });

    const filePath = path.join(__dirname, 'public/media', fileName);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Archivo no encontrado en el servidor' });
    }

    try {
        const type = detectBaileysType(fileName);

        const messageContent = {
            [type]: { url: filePath },
            caption: caption || ''
        };

        const result = await sock.sendMessage(to, messageContent);
        res.json({ success: true, messageId: result.key.id, detectedType: type });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * ESCENARIO 3: Subir archivo y enviar inmediatamente
 * Recibe: Form-Data (file, to, caption)
 */
app.post('/api/send/upload', upload.single('file'), async (req, res) => {
    const { to, caption } = req.body;
    const file = req.file;

    if (!sock) return res.status(500).json({ error: 'WhatsApp no conectado' });
    if (!to) return res.status(400).json({ error: 'Falta el parámetro (to)' });
    if (!file) return res.status(400).json({ error: 'No se subió ningún archivo' });

    try {
        // Deducimos el tipo primero por mimetype, luego por nombre original
        const type = detectBaileysType(file.mimetype) === 'document'
            ? detectBaileysType(file.originalname)
            : detectBaileysType(file.mimetype);

        const messageContent = {
            [type]: { url: file.path },
            caption: caption || '',
            fileName: type === 'document' ? file.originalname : undefined,
            mimetype: file.mimetype
        };

        const result = await sock.sendMessage(to, messageContent);

        res.json({
            success: true,
            messageId: result.key.id,
            detectedType: type,
            uploadedFile: file.filename
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// INICIO
// ============================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor API multimedia corriendo en http://localhost:${PORT}`);
    connectToWhatsApp();
});

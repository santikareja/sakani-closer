/**
 * Bot de WhatsApp Multi-Sesión con Baileys
 * 
 * Permite conectar MÚLTIPLES líneas de WhatsApp simultáneamente.
 * Cada línea tiene su propia carpeta de autenticación y responde
 * independientemente a los comandos.
 * 
 * Características:
 * - Múltiples sesiones simultáneas
 * - Cada sesión con su propia carpeta de credenciales
 * - API REST para gestionar sesiones
 * - Detección de mensajes de grupo vs privado (isGroup)
 * - Patrón early return para código limpio
 * - QR individual por sesión
 * - Reconexión automática por sesión
 * - Persistencia de sesiones al cerrar proceso
 * - Restauración automática al reiniciar
 * 
 * Uso:
 *   npm install @whiskeysockets/baileys pino qrcode-terminal express
 *   node multi-session.js
 */


import makeWASocket, { DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'
import pino from 'pino'
import fs from 'fs'
import express from 'express'

// Logger silencioso
const logger = pino({ level: 'silent' })

class SessionManager {
    constructor() {
        this.sessions = new Map()
        this.qrCodes = new Map()
        this.connectionStatus = new Map()
    }

    /**
     * Crear una nueva sesión
     */
    async createSession(sessionId) {
        if (this.sessions.has(sessionId)) {
            throw new Error(`La sesión ${sessionId} ya existe`)
        }

        console.log(`\n🔄 Creando sesión: ${sessionId}`)

        const SESSION_FOLDER = `auth_info_${sessionId}`

        // Cargar estado de autenticación
        const { state, saveCreds } = await useMultiFileAuthState(SESSION_FOLDER)
        const { version } = await fetchLatestBaileysVersion()

        // Crear socket
        const sock = makeWASocket({
            version,
            auth: state,
            logger,
            browser: [`Bot ${sessionId}`, 'Chrome', '1.0.0'],
            defaultQueryTimeoutMs: undefined,
            syncFullHistory: false,
            markOnlineOnConnect: false,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 30000
        })

        // Configurar eventos
        this.setupConnectionEvents(sessionId, SESSION_FOLDER, sock)

        sock.ev.on('creds.update', saveCreds)

        this.setupMessageEvents(sessionId, sock)

        // Guardar sesión
        this.sessions.set(sessionId, {
            sock,
            folder: SESSION_FOLDER,
            reconnectAttempts: 0,
            isReconnecting: false
        })

        this.connectionStatus.set(sessionId, 'connecting')

        return sock
    }

    /**
     * Configurar eventos de conexión
     */
    setupConnectionEvents(sessionId, sessionFolder, sock) {
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update
            const session = this.sessions.get(sessionId)

            // Guardar QR
            if (qr) {
                this.qrCodes.set(sessionId, qr)
                this.connectionStatus.set(sessionId, 'qr_ready')

                // Solo mostrar QR en terminal si no es una petición API
                // (se puede detectar porque las sesiones API suelen tener nombres descriptivos)
                console.log(`\n📱 QR generado para sesión: ${sessionId}`)
                console.log(`   (El QR está disponible via API en /api/sessions/${sessionId}/qr)\n`)
            }

            // Conexión cerrada
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode
                const reason = lastDisconnect?.error?.message || 'Desconocido'

                console.log(`[${sessionId}] ❌ Conexión cerrada`)
                console.log(`[${sessionId}]    Razón: ${reason}`)
                console.log(`[${sessionId}]    Status: ${statusCode}`)

                // Usuario cerró sesión desde móvil
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log(`[${sessionId}] 🚪 Sesión cerrada desde el móvil`)
                    console.log(`[${sessionId}] 🗑️  Eliminando credenciales...`)

                    try {
                        if (fs.existsSync(sessionFolder)) {
                            fs.rmSync(sessionFolder, { recursive: true, force: true })
                            console.log(`[${sessionId}] ✅ Credenciales eliminadas`)
                        }
                    } catch (error) {
                        console.error(`[${sessionId}] ❌ Error:`, error.message)
                    }

                    this.sessions.delete(sessionId)
                    this.qrCodes.delete(sessionId)
                    this.connectionStatus.delete(sessionId)
                    console.log(`[${sessionId}] 🗑️  Sesión eliminada del gestor\n`)
                    return
                }

                // No reconectar durante el establecimiento inicial de la conexión
                // Esto evita conflictos cuando se está escaneando el QR
                if (statusCode === DisconnectReason.connectionClosed ||
                    statusCode === 428 ||
                    statusCode === DisconnectReason.timedOut) {
                    console.log(`[${sessionId}] ⏳ Esperando escaneo de QR o reconexión automática...\n`)
                    return
                }

                // Manejar conflictos
                if (statusCode === 440) {
                    session.reconnectAttempts++
                    if (session.reconnectAttempts >= 3) {
                        console.log(`[${sessionId}] ❌ Demasiados intentos de reconexión\n`)
                        this.connectionStatus.set(sessionId, 'failed')
                        return
                    }
                }

                // Reconectar solo en casos específicos
                const shouldReconnect = (
                    statusCode === DisconnectReason.connectionLost ||
                    statusCode === 440 ||
                    statusCode === DisconnectReason.restartRequired
                )

                if (shouldReconnect && !session.isReconnecting) {
                    const delay = statusCode === 440 ? 10000 : 5000
                    session.isReconnecting = true
                    this.connectionStatus.set(sessionId, 'reconnecting')

                    console.log(`[${sessionId}] 🔄 Reconectando en ${delay / 1000}s...\n`)

                    setTimeout(async () => {
                        try {
                            this.sessions.delete(sessionId)
                            await this.createSession(sessionId)
                        } catch (error) {
                            console.error(`[${sessionId}] Error en reconexión:`, error.message)
                            session.isReconnecting = false
                        }
                    }, delay)
                } else if (!shouldReconnect) {
                    console.log(`[${sessionId}] ℹ️  No se requiere reconexión automática\n`)
                }
            }

            // Conexión abierta
            if (connection === 'open') {
                session.reconnectAttempts = 0
                session.isReconnecting = false
                this.qrCodes.delete(sessionId)
                this.connectionStatus.set(sessionId, 'connected')

                console.log(`[${sessionId}] ✅ CONECTADO`)
                console.log(`[${sessionId}] 📞 Número: ${sock.user?.id}`)
                console.log(`[${sessionId}] 🤖 Listo para recibir mensajes\n`)
            }
        })
    }

    /**
     * Configurar eventos de mensajes
     */
    setupMessageEvents(sessionId, sock) {
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return

            for (const msg of messages) {
                if (msg.key.fromMe) continue

                const chatId = msg.key.remoteJid
                const messageText = msg.message?.conversation ||
                    msg.message?.extendedTextMessage?.text ||
                    ''

                // Diferenciar grupo vs privado
                const isGroup = chatId.endsWith('@g.us')

                const senderNumber = chatId.split('@')[0]
                console.log(`[${sessionId}] 📩 Mensaje de ${senderNumber}: ${messageText}`)

                await this.handleMessage(sessionId, sock, chatId, messageText.toLowerCase().trim(), isGroup)
            }
        })
    }

    /**
     * Manejar mensajes entrantes y responder según el comando
     * @param {string} sessionId - Identificador único de la sesión
     * @param {import('@whiskeysockets/baileys').WASocket} sock - Instancia del socket de WhatsApp
     * @param {string} chatId - ID del chat (número@s.whatsapp.net o grupo@g.us)
     * @param {string} text - Texto del mensaje en minúsculas y sin espacios
     * @param {boolean} isGroup - true si es grupo (@g.us), false si es privado (@s.whatsapp.net)
     */
    async handleMessage(sessionId, sock, chatId, text, isGroup) {
        if (isGroup) {
            console.log(`[${sessionId}] ⚠️  Ignorando mensaje de grupo: ${chatId}`)
            return
        }

        if (!text) return

        try {
            if (text === 'text') {
                await sock.sendMessage(chatId, { text: `hola cómo estás (desde ${sessionId})` })
                console.log(`[${sessionId}] ✅ Respuesta de texto enviada`)
                return
            }

            if (text === 'video') {
                const videoPath = 'public/video/sample.mp4'
                if (!fs.existsSync(videoPath)) {
                    await sock.sendMessage(chatId, { text: '❌ Video no encontrado. Coloca un video en: public/video/sample.mp4' })
                    console.log(`[${sessionId}] ⚠️  Video no encontrado`)
                    return
                }
                await sock.sendMessage(chatId, {
                    video: fs.readFileSync(videoPath),
                    caption: `🎥 Aquí está tu video (desde ${sessionId})`,
                    mimetype: 'video/mp4'
                })
                console.log(`[${sessionId}] ✅ Video enviado`)
                return
            }

            if (text === 'image') {
                const imagePath = 'public/images/sample.jpg'
                if (!fs.existsSync(imagePath)) {
                    await sock.sendMessage(chatId, { text: '❌ Imagen no encontrada. Coloca una imagen en: public/images/sample.jpg' })
                    console.log(`[${sessionId}] ⚠️  Imagen no encontrada`)
                    return
                }
                await sock.sendMessage(chatId, {
                    image: fs.readFileSync(imagePath),
                    caption: `📸 Aquí está tu imagen (desde ${sessionId})`
                })
                console.log(`[${sessionId}] ✅ Imagen enviada`)
                return
            }

            if (text === 'file') {
                const filePath = 'public/files/example.xlsx'
                if (!fs.existsSync(filePath)) {
                    await sock.sendMessage(chatId, { text: '❌ Archivo no encontrado. Coloca un archivo en: public/files/example.xlsx' })
                    console.log(`[${sessionId}] ⚠️  Archivo no encontrado`)
                    return
                }
                await sock.sendMessage(chatId, {
                    document: fs.readFileSync(filePath),
                    mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    fileName: 'example.xlsx',
                    caption: `📄 Aquí está tu archivo Excel (desde ${sessionId})`
                })
                console.log(`[${sessionId}] ✅ Archivo enviado`)
                return
            }

            // Mensaje por defecto
            await sock.sendMessage(chatId, {
                text: `👋 Hola! Soy el bot de ${sessionId}\n\nComandos:\n• "text" - saludo\n• "video" - enviar video\n• "image" - enviar imagen\n• "file" - enviar archivo Excel`
            })
            console.log(`[${sessionId}] ✅ Mensaje de ayuda enviado`)

        } catch (error) {
            console.error(`[${sessionId}] ❌ Error:`, error.message)
        }
    }

    /**
     * Obtener sesión específica
     */
    getSession(sessionId) {
        return this.sessions.get(sessionId)
    }

    /**
     * Obtener QR de sesión
     */
    getQR(sessionId) {
        return this.qrCodes.get(sessionId)
    }

    /**
     * Obtener estado de sesión
     */
    getStatus(sessionId) {
        return this.connectionStatus.get(sessionId) || 'not_initialized'
    }

    /**
     * Listar todas las sesiones
     */
    listSessions() {
        const sessions = []
        for (const [id, session] of this.sessions) {
            sessions.push({
                sessionId: id,
                status: this.getStatus(id),
                phoneNumber: session.sock.user?.id || null,
                hasQR: this.qrCodes.has(id),
                folder: session.folder
            })
        }
        return sessions
    }

    /**
     * Cerrar sesión específica (desvincula de WhatsApp)
     */
    async closeSession(sessionId) {
        const session = this.sessions.get(sessionId)
        if (!session) {
            throw new Error(`Sesión ${sessionId} no existe`)
        }

        try {
            await session.sock.logout()
        } catch (e) {
            console.error(`[${sessionId}] Error al cerrar:`, e.message)
        }

        this.sessions.delete(sessionId)
        this.qrCodes.delete(sessionId)
        this.connectionStatus.delete(sessionId)
        console.log(`[${sessionId}] Sesión cerrada y desvinculada`)
    }

    /**
     * Desconectar sesión sin desvincular (mantiene credenciales)
     */
    disconnectSession(sessionId) {
        const session = this.sessions.get(sessionId)
        if (!session) return

        try {
            session.sock.ev.removeAllListeners()
            session.sock.ws.close()
        } catch (e) {
            // Ignorar errores al desconectar
        }

        this.sessions.delete(sessionId)
        this.qrCodes.delete(sessionId)
        this.connectionStatus.delete(sessionId)
        console.log(`[${sessionId}] Desconectado (credenciales preservadas)`)
    }

    /**
     * Restaurar sesiones existentes desde carpetas auth_info_*
     */
    async restoreExistingSessions() {
        const folders = fs.readdirSync('.').filter(f =>
            f.startsWith('auth_info_') &&
            fs.statSync(f).isDirectory() &&
            fs.existsSync(`${f}/creds.json`)
        )

        if (folders.length === 0) {
            console.log('📭 No hay sesiones previas para restaurar\n')
            return
        }

        console.log(`\n🔄 Restaurando ${folders.length} sesión(es) previa(s)...\n`)

        for (const folder of folders) {
            const sessionId = folder.replace('auth_info_', '')
            try {
                await this.createSession(sessionId)
                // Pequeña pausa entre sesiones para evitar rate limiting
                await new Promise(r => setTimeout(r, 2000))
            } catch (error) {
                console.error(`[${sessionId}] Error al restaurar:`, error.message)
            }
        }
    }
}

// Crear gestor de sesiones
const manager = new SessionManager()

// API REST para gestionar sesiones
const app = express()
app.use(express.json())

// Servir archivos estáticos del dashboard
app.use(express.static('vanilla_test_multi_sessions'))

// CORS para permitir peticiones desde el frontend
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200)
    }
    next()
})

// Crear sesión
app.post('/api/sessions/create', async (req, res) => {
    const { sessionId } = req.body

    if (!sessionId) {
        return res.status(400).json({ error: 'sessionId requerido' })
    }

    try {
        await manager.createSession(sessionId)

        // Esperar QR con timeout más largo
        let attempts = 0
        while (attempts < 30) {
            const qr = manager.getQR(sessionId)
            if (qr) {
                console.log(`✅ QR generado y enviado para ${sessionId}`)
                return res.json({
                    sessionId,
                    qr,
                    status: 'qr_ready',
                    message: 'Escanea el QR con WhatsApp'
                })
            }
            await new Promise(r => setTimeout(r, 1000))
            attempts++
        }

        res.status(408).json({
            error: 'Timeout esperando QR',
            sessionId
        })
    } catch (error) {
        res.status(500).json({
            error: error.message
        })
    }
})

// Obtener QR
app.get('/api/sessions/:sessionId/qr', (req, res) => {
    const { sessionId } = req.params
    const qr = manager.getQR(sessionId)

    if (!qr) {
        return res.status(404).json({
            error: 'QR no disponible',
            status: manager.getStatus(sessionId)
        })
    }

    res.json({ sessionId, qr })
})

// Estado de sesión
app.get('/api/sessions/:sessionId/status', (req, res) => {
    const { sessionId } = req.params
    const session = manager.getSession(sessionId)

    if (!session) {
        return res.status(404).json({ error: 'Sesión no encontrada' })
    }

    res.json({
        sessionId,
        status: manager.getStatus(sessionId),
        phoneNumber: session.sock.user?.id || null,
        connected: session.sock.user?.id ? true : false
    })
})

// Listar sesiones
app.get('/api/sessions', (req, res) => {
    res.json({ sessions: manager.listSessions() })
})

// Cerrar sesión
app.delete('/api/sessions/:sessionId', async (req, res) => {
    const { sessionId } = req.params

    try {
        await manager.closeSession(sessionId)
        res.json({ message: 'Sesión cerrada', sessionId })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

// Enviar mensaje desde sesión específica
app.post('/api/sessions/:sessionId/send', async (req, res) => {
    const { sessionId } = req.params
    const { to, message } = req.body

    const session = manager.getSession(sessionId)

    if (!session) {
        return res.status(404).json({ error: 'Sesión no encontrada' })
    }

    if (manager.getStatus(sessionId) !== 'connected') {
        return res.status(400).json({ error: 'Sesión no conectada' })
    }

    try {
        await session.sock.sendMessage(to, { text: message })
        res.json({ success: true, sessionId, to })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

// Iniciar servidor API
const PORT = 3000
app.listen(PORT, async () => {
    console.log('╔═══════════════════════════════════════════════════════╗')
    console.log('║   🤖 BOT MULTI-SESIÓN WHATSAPP                        ║')
    console.log('╚═══════════════════════════════════════════════════════╝')
    console.log('')
    console.log(`📡 API REST: http://localhost:${PORT}/api/sessions`)
    console.log(`🌐 Dashboard: http://localhost:${PORT}`)
    console.log('')
    console.log('📚 Endpoints API:')
    console.log('   POST   /api/sessions/create           - Crear sesión')
    console.log('   GET    /api/sessions                  - Listar sesiones')
    console.log('   GET    /api/sessions/:id/status       - Ver estado')
    console.log('   GET    /api/sessions/:id/qr           - Obtener QR')
    console.log('   POST   /api/sessions/:id/send         - Enviar mensaje')
    console.log('   DELETE /api/sessions/:id              - Cerrar sesión')
    console.log('')
    console.log('🚀 Servidor listo. Abre http://localhost:' + PORT + ' en tu navegador')

    // Restaurar sesiones existentes automáticamente
    await manager.restoreExistingSessions()
})

// Manejo de cierre - NO hace logout, solo desconecta
process.on('SIGINT', async () => {
    console.log('\n\n🛑 Desconectando sesiones (las credenciales se mantienen)...')

    for (const [sessionId] of manager.sessions) {
        try {
            manager.disconnectSession(sessionId)
        } catch (e) { }
    }

    console.log('✅ Sesiones desconectadas. Las credenciales están guardadas.')
    console.log('💡 Al reiniciar, las sesiones se reconectarán automáticamente.\n')
    process.exit(0)
})

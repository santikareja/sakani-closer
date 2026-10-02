/**
 * Bot de WhatsApp Básico con Baileys
 * 
 * Ejemplo simple y funcional de cómo conectar WhatsApp y responder a mensajes.
 * Incluye todas las correcciones para evitar errores comunes (405, 440, etc.)
 * 
 * IMPORTANTE: Este bot maneja UNA SOLA SESIÓN/LÍNEA de WhatsApp.
 * Para múltiples líneas, ver documentación de multi-sesión en la skill.
 * 
 * Características:
 * - Conexión con QR en terminal
 * - Respuestas automáticas por comando
 * - Envío de texto, imagen, video y archivos
 * - Reconexión automática inteligente
 * - Limpieza de sesión cuando el usuario desvincula desde móvil
 * - Persistencia de sesión entre reinicios
 * 
 * Uso:
 *   npm install @whiskeysockets/baileys pino qrcode-terminal
 *   node index.js
 */

import makeWASocket, { DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'
import pino from 'pino'
import fs from 'fs'

// Configuración de sesión única
const SESSION_FOLDER = 'auth_info' // Para multi-sesión usar: `auth_info_${sessionId}`

// Logger (silent para no mostrar logs internos)
const logger = pino({ level: 'silent' })

// Variable global para mantener la instancia del socket
let sock = null
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 3
let isReconnecting = false

async function connectToWhatsApp() {
    // Evitar reconexiones simultáneas
    if (isReconnecting) {
        console.log('⏳ Ya hay una reconexión en proceso...')
        return
    }

    isReconnecting = true

    // Cerrar socket anterior si existe
    if (sock) {
        try {
            sock.ev.removeAllListeners()
            sock.ws.close()
        } catch (e) { }
        sock = null
    }

    // Usar autenticación multi-archivo (guarda sesión en carpeta auth_info)
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_FOLDER)

    // Obtener versión más reciente de Baileys
    const { version } = await fetchLatestBaileysVersion()

    sock = makeWASocket({
        version,
        auth: state,
        logger,
        browser: ['WhatsApp Bot', 'Chrome', '1.0.0'],
        defaultQueryTimeoutMs: undefined,
        // Configuración para evitar errores 405
        syncFullHistory: false,
        markOnlineOnConnect: false,
        // Configuración adicional para estabilidad
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000
    })

    // Evento de actualización de conexión
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update

        // Mostrar QR en terminal
        if (qr) {
            console.clear()
            console.log('\n📱 ESCANEA ESTE CÓDIGO QR CON WHATSAPP:\n')
            qrcode.generate(qr, { small: true })
            console.log('\n⏳ Esperando escaneo...\n')
        }

        // Conexión cerrada
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode
            const reason = lastDisconnect?.error?.message || 'Desconocido'

            console.log('❌ Conexión cerrada')
            console.log('   Razón:', reason)
            console.log('   Status Code:', statusCode)

            // Usuario cerró sesión desde el móvil
            if (statusCode === DisconnectReason.loggedOut) {
                console.log('   🚪 Sesión cerrada desde el dispositivo móvil')
                console.log('   🗑️  Eliminando credenciales...')

                // Eliminar carpeta de autenticación de ESTA sesión
                // NOTA: En multi-sesión, cada línea debe tener su propia carpeta
                try {
                    if (fs.existsSync(SESSION_FOLDER)) {
                        fs.rmSync(SESSION_FOLDER, { recursive: true, force: true })
                        console.log('   ✅ Credenciales eliminadas')
                    }
                } catch (error) {
                    console.error('   ❌ Error al eliminar credenciales:', error.message)
                }

                console.log('   💡 Ejecuta el bot nuevamente para generar un nuevo QR\n')
                process.exit(0)
                return
            }

            // Manejar conflictos (440) - otra sesión activa
            if (statusCode === 440) {
                console.log('   ⚠️  CONFLICTO: Cierra WhatsApp Web y otros bots antes de continuar')
                reconnectAttempts++

                if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                    console.log('   ❌ Demasiados intentos. Verifica que no haya otras sesiones activas.')
                    console.log('   💡 Cierra WhatsApp Web y reinicia el bot.\n')
                    process.exit(1)
                }
            }

            const shouldReconnect = statusCode !== DisconnectReason.loggedOut

            if (shouldReconnect) {
                const delay = statusCode === 440 ? 10000 : 5000
                console.log(`   Reintentando en ${delay / 1000} segundos... (intento ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})\n`)
                setTimeout(() => connectToWhatsApp(), delay)
            }
        }

        // Conexión abierta
        if (connection === 'open') {
            reconnectAttempts = 0 // Reset contador
            isReconnecting = false
            console.log('✅ Conectado exitosamente a WhatsApp')
            console.log('📞 Número:', sock.user?.id)
            console.log('💡 Puedes tener WhatsApp Web abierto en otros navegadores')
            console.log('\n🤖 Bot listo para recibir mensajes...\n')
        }
    })

    // Marcar que la reconexión finalizó (incluso si falló)
    setTimeout(() => {
        isReconnecting = false
    }, 2000)

    // Guardar credenciales cuando se actualicen
    sock.ev.on('creds.update', saveCreds)

    // Manejar mensajes recibidos
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return

        const msg = messages[0]

        // Ignorar mensajes propios
        if (msg.key.fromMe) return

        // Extraer datos del mensaje
        const chatId = msg.key.remoteJid
        const messageText = msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            ''

        // Diferenciar grupo vs privado
        const isGroup = chatId.endsWith('@g.us')

        const senderNumber = chatId.split('@')[0]

        console.log(`📩 Mensaje de ${senderNumber}: ${messageText}`)

        // Responder según el texto
        await handleMessage(sock, chatId, messageText.toLowerCase().trim(), isGroup)
    })

    return sock
}

/**
 * Manejar mensajes entrantes y responder según el comando
 * @param {import('@whiskeysockets/baileys').WASocket} sock - Instancia del socket de WhatsApp
 * @param {string} chatId - ID del chat (número@s.whatsapp.net o grupo@g.us)
 * @param {string} text - Texto del mensaje en minúsculas y sin espacios
 * @param {boolean} isGroup - true si es grupo (@g.us), false si es privado (@s.whatsapp.net)
 */
async function handleMessage(sock, chatId, text, isGroup) {
    if (isGroup) {
        console.log('⚠️  Ignorando mensaje de grupo:', chatId)
        return
    }

    if (!text) return

    try {
        if (text === 'text') {
            await sock.sendMessage(chatId, { text: 'hola cómo estás' })
            console.log('✅ Respuesta de texto enviada')
            return
        }

        if (text === 'video') {
            const videoPath = 'public/video/sample.mp4'
            if (!fs.existsSync(videoPath)) {
                await sock.sendMessage(chatId, { text: '❌ Video no encontrado. Coloca un video en: public/video/sample.mp4' })
                console.log('⚠️  Video no encontrado')
                return
            }
            await sock.sendMessage(chatId, {
                video: fs.readFileSync(videoPath),
                caption: '🎥 Aquí está tu video',
                mimetype: 'video/mp4'
            })
            console.log('✅ Video enviado')
            return
        }

        if (text === 'image') {
            const imagePath = 'public/images/sample.jpg'
            if (!fs.existsSync(imagePath)) {
                await sock.sendMessage(chatId, { text: '❌ Imagen no encontrada. Coloca una imagen en: public/images/sample.jpg' })
                console.log('⚠️  Imagen no encontrada')
                return
            }
            await sock.sendMessage(chatId, {
                image: fs.readFileSync(imagePath),
                caption: '📸 Aquí está tu imagen'
            })
            console.log('✅ Imagen enviada')
            return
        }

        if (text === 'file') {
            const filePath = 'public/files/example.xlsx'
            if (!fs.existsSync(filePath)) {
                await sock.sendMessage(chatId, { text: '❌ Archivo no encontrado. Coloca un archivo en: public/files/example.xlsx' })
                console.log('⚠️  Archivo no encontrado')
                return
            }
            await sock.sendMessage(chatId, {
                document: fs.readFileSync(filePath),
                mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                fileName: 'example.xlsx',
                caption: '📄 Aquí está tu archivo Excel'
            })
            console.log('✅ Archivo enviado')
            return
        }

        // Mensaje por defecto
        await sock.sendMessage(chatId, {
            text: '👋 Hola! Escribe:\n• "text" - para recibir un saludo\n• "video" - para recibir un video\n• "image" - para recibir una imagen\n• "file" - para recibir un archivo Excel'
        })
        console.log('✅ Mensaje de ayuda enviado')

    } catch (error) {
        console.error('❌ Error al enviar mensaje:', error)
    }
}

// Iniciar bot
console.log('🚀 Iniciando bot de WhatsApp...\n')
connectToWhatsApp()

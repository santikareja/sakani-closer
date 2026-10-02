/**
 * WhatsApp Multimedia Downloader Bot
 * 
 * Bot que descarga automáticamente todos los archivos multimedia recibidos
 * y los guarda localmente organizados por tipo.
 * 
 * Características:
 * - Descarga automática de imágenes, videos, audios, documentos
 * - Organización en carpetas por tipo
 * - Validación de tamaño máximo
 * - Extracción de metadata
 * - Detección automática de extensiones
 * - Nombres de archivo únicos con timestamp
 * 
 * Dependencias:
 * npm install @whiskeysockets/baileys pino qrcode-terminal
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURACIÓN
// ============================================

const CONFIG = {
  // Tamaño máximo de descarga (en bytes)
  // 50 MB por defecto
  MAX_DOWNLOAD_SIZE: 50 * 1024 * 1024,
  
  // Carpetas de destino por tipo de archivo
  DOWNLOAD_FOLDERS: {
    image: './downloads/images',
    video: './downloads/videos',
    audio: './downloads/audios',
    document: './downloads/documents',
    sticker: './downloads/stickers'
  },
  
  // Extensiones por defecto si no se detecta
  DEFAULT_EXTENSIONS: {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/3gpp': '3gp',
    'video/quicktime': 'mov',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/aac': 'aac',
    'audio/amr': 'amr',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx'
  },
  
  // Respuesta automática al recibir multimedia
  AUTO_REPLY: true,
  
  // Log detallado de metadata
  LOG_METADATA: true
};

// ============================================
// CREAR ESTRUCTURA DE CARPETAS
// ============================================

function createDownloadFolders() {
  Object.values(CONFIG.DOWNLOAD_FOLDERS).forEach(folder => {
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
      console.log(`📁 Carpeta creada: ${folder}`);
    }
  });
}

// ============================================
// DETECTAR TIPO Y EXTENSIÓN
// ============================================

function detectMediaType(message) {
  if (message.imageMessage) return { type: 'image', message: message.imageMessage };
  if (message.videoMessage) return { type: 'video', message: message.videoMessage };
  if (message.audioMessage) return { type: 'audio', message: message.audioMessage };
  if (message.documentMessage) return { type: 'document', message: message.documentMessage };
  if (message.stickerMessage) return { type: 'sticker', message: message.stickerMessage };
  return null;
}

function getFileExtension(mimetype, fileName) {
  // Prioridad 1: Extensión del nombre de archivo
  if (fileName && fileName.includes('.')) {
    const ext = fileName.split('.').pop().toLowerCase();
    if (ext.length <= 5) return ext;
  }
  
  // Prioridad 2: Mapeo de mimetype
  if (mimetype && CONFIG.DEFAULT_EXTENSIONS[mimetype]) {
    return CONFIG.DEFAULT_EXTENSIONS[mimetype];
  }
  
  // Prioridad 3: Parsear mimetype
  if (mimetype && mimetype.includes('/')) {
    const subtype = mimetype.split('/')[1].split(';')[0];
    return subtype;
  }
  
  // Fallback: extensión genérica
  return 'bin';
}

// ============================================
// GENERAR NOMBRE DE ARCHIVO ÚNICO
// ============================================

function generateFileName(mediaType, extension, originalName) {
  const timestamp = Date.now();
  const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  if (originalName) {
    // Limpiar nombre original
    const cleanName = originalName
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_');
    return `${timestamp}_${cleanName}`;
  }
  
  return `${dateStr}_${timestamp}_${mediaType}.${extension}`;
}

// ============================================
// EXTRAER METADATA
// ============================================

function extractMetadata(mediaInfo, mediaMessage) {
  const metadata = {
    mimetype: mediaMessage.mimetype || 'unknown',
    fileLength: mediaMessage.fileLength || 0,
    fileName: mediaMessage.fileName || null,
    caption: mediaMessage.caption || null,
    timestamp: Date.now(),
    
    // Metadata específica de tipo
    width: mediaMessage.width || null,
    height: mediaMessage.height || null,
    duration: mediaMessage.seconds || mediaMessage.duration || null,
    pageCount: mediaMessage.pageCount || null,
  };
  
  return metadata;
}

// ============================================
// DESCARGAR Y GUARDAR MULTIMEDIA
// ============================================

async function downloadAndSaveMedia(message, sock) {
  try {
    // Detectar tipo de multimedia
    const mediaInfo = detectMediaType(message.message);
    if (!mediaInfo) {
      return null;
    }
    
    const { type, message: mediaMessage } = mediaInfo;
    
    // Validar tamaño antes de descargar
    const fileSize = mediaMessage.fileLength || 0;
    if (fileSize > CONFIG.MAX_DOWNLOAD_SIZE) {
      console.warn(`⚠️ Archivo demasiado grande: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
      return {
        success: false,
        error: 'FILE_TOO_LARGE',
        size: fileSize
      };
    }
    
    // Extraer metadata
    const metadata = extractMetadata(mediaInfo, mediaMessage);
    
    if (CONFIG.LOG_METADATA) {
      console.log('📊 Metadata del archivo:', JSON.stringify(metadata, null, 2));
    }
    
    // Descargar archivo
    console.log(`⬇️ Descargando ${type}...`);
    const buffer = await downloadMediaMessage(
      message,
      'buffer',
      {}
    );
    
    if (!buffer) {
      throw new Error('Buffer vacío después de descargar');
    }
    
    // Detectar extensión
    const extension = getFileExtension(metadata.mimetype, metadata.fileName);
    
    // Generar nombre de archivo
    const fileName = generateFileName(type, extension, metadata.fileName);
    
    // Determinar carpeta de destino
    const folder = CONFIG.DOWNLOAD_FOLDERS[type] || CONFIG.DOWNLOAD_FOLDERS.document;
    const filePath = path.join(folder, fileName);
    
    // Guardar archivo
    fs.writeFileSync(filePath, buffer);
    
    console.log(`✅ Archivo guardado: ${filePath}`);
    console.log(`   Tamaño: ${(buffer.length / 1024).toFixed(2)} KB`);
    
    // Guardar metadata en archivo JSON
    const metadataPath = filePath + '.json';
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    
    return {
      success: true,
      type,
      filePath,
      fileName,
      size: buffer.length,
      metadata
    };
    
  } catch (error) {
    console.error('❌ Error al descargar multimedia:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================
// FORMATEAR METADATA PARA RESPUESTA
// ============================================

function formatMetadataText(result) {
  const lines = [
    `✅ *Archivo Descargado*`,
    ``,
    `📁 Tipo: ${result.type}`,
    `📄 Nombre: ${result.fileName}`,
    `💾 Tamaño: ${(result.size / 1024).toFixed(2)} KB`,
  ];
  
  if (result.metadata.width && result.metadata.height) {
    lines.push(`📐 Dimensiones: ${result.metadata.width}x${result.metadata.height}`);
  }
  
  if (result.metadata.duration) {
    lines.push(`⏱️ Duración: ${result.metadata.duration}s`);
  }
  
  if (result.metadata.pageCount) {
    lines.push(`📄 Páginas: ${result.metadata.pageCount}`);
  }
  
  lines.push(`🔗 Ruta: ${result.filePath}`);
  
  return lines.join('\n');
}

// ============================================
// INICIAR BOT
// ============================================

async function startBot() {
  // Crear carpetas de descarga
  createDownloadFolders();
  
  // Autenticación multi-file
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info_multimedia');
  
  // Crear socket de WhatsApp
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    logger: pino({ level: 'silent' }),
    browser: ['Multimedia Bot', 'Chrome', '1.0.0']
  });
  
  // Guardar credenciales al actualizar
  sock.ev.on('creds.update', saveCreds);
  
  // ============================================
  // EVENTOS DE CONEXIÓN
  // ============================================
  
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      console.log('📱 Escanea el código QR con WhatsApp:');
      qrcode.generate(qr, { small: true });
    }
    
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      
      if (shouldReconnect) {
        console.log('🔄 Reconectando...');
        setTimeout(() => startBot(), 3000);
      } else {
        console.log('❌ Sesión cerrada. Elimina auth_info_multimedia y reinicia.');
        fs.rmSync('./auth_info_multimedia', { recursive: true, force: true });
      }
    }
    
    if (connection === 'open') {
      console.log('✅ Bot conectado exitosamente');
      console.log('📥 Esperando archivos multimedia...');
      console.log('');
      console.log('💡 Envía cualquier imagen, video, audio o documento para descargarlo.');
    }
  });
  
  // ============================================
  // RECIBIR MENSAJES
  // ============================================
  
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    
    for (const msg of messages) {
      // Ignorar mensajes propios
      if (msg.key.fromMe) continue;
      
      // Detectar multimedia
      const hasMedia = detectMediaType(msg.message);
      
      if (hasMedia) {
        const from = msg.key.remoteJid;
        
        console.log('');
        console.log('═══════════════════════════════════════');
        console.log(`📥 Multimedia recibido de: ${from}`);
        console.log('═══════════════════════════════════════');
        
        // Descargar y guardar
        const result = await downloadAndSaveMedia(msg, sock);
        
        // Responder al usuario
        if (CONFIG.AUTO_REPLY && result.success) {
          await sock.sendMessage(from, {
            text: formatMetadataText(result)
          });
        } else if (!result.success) {
          if (result.error === 'FILE_TOO_LARGE') {
            await sock.sendMessage(from, {
              text: `⚠️ El archivo es demasiado grande (${(result.size / 1024 / 1024).toFixed(2)} MB).\nMáximo permitido: ${(CONFIG.MAX_DOWNLOAD_SIZE / 1024 / 1024).toFixed(2)} MB`
            });
          } else {
            await sock.sendMessage(from, {
              text: `❌ Error al descargar: ${result.error}`
            });
          }
        }
        
        console.log('═══════════════════════════════════════');
        console.log('');
      }
    }
  });
}

// ============================================
// EJECUTAR BOT
// ============================================

console.log('');
console.log('╔═══════════════════════════════════════════════════╗');
console.log('║   WhatsApp Multimedia Downloader Bot             ║');
console.log('║   Descarga automática de archivos multimedia     ║');
console.log('╚═══════════════════════════════════════════════════╝');
console.log('');

startBot().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});

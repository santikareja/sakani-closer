# Guía Completa de Manejo de Multimedia en Baileys

Esta guía detalla cómo recibir, descargar, procesar y enviar archivos multimedia (imágenes, videos, audios, documentos) usando Baileys.

---

## Índice

1. [Tipos de Multimedia Soportados](#1-tipos-de-multimedia-soportados)
2. [Recibir Archivos Multimedia](#2-recibir-archivos-multimedia)
3. [Descargar y Guardar Archivos](#3-descargar-y-guardar-archivos)
4. [Extraer Metadata](#4-extraer-metadata)
5. [Enviar Archivos Multimedia](#5-enviar-archivos-multimedia)
6. [Manejo de Errores Comunes](#6-manejo-de-errores-comunes)
7. [Optimización y Mejores Prácticas](#7-optimización-y-mejores-prácticas)
8. [Casos de Uso Avanzados](#8-casos-de-uso-avanzados)

---

## 1. Tipos de Multimedia Soportados

Baileys soporta todos los tipos de multimedia que WhatsApp permite:

| Tipo          | Mensaje en Baileys      | MIME Types Comunes                    |
|---------------|-------------------------|---------------------------------------|
| **Imagen**    | `imageMessage`          | `image/jpeg`, `image/png`, `image/gif`, `image/webp` |
| **Video**     | `videoMessage`          | `video/mp4`, `video/3gpp`, `video/quicktime` |
| **Audio**     | `audioMessage`          | `audio/mpeg`, `audio/ogg`, `audio/aac`, `audio/amr` |
| **Documento** | `documentMessage`       | `application/pdf`, `application/vnd.ms-excel`, etc. |
| **Sticker**   | `stickerMessage`        | `image/webp` (animado o estático) |
| **Audio/Nota**| `audioMessage` (ptt=true) | `audio/ogg` (mensaje de voz) |

### Propiedades Comunes

Todos los mensajes multimedia tienen estas propiedades base:

```typescript
interface MediaMessage {
  url?: string;              // URL de descarga (encriptada)
  mimetype?: string;         // Tipo MIME del archivo
  fileLength?: number;       // Tamaño en bytes
  fileSha256?: Buffer;       // Hash SHA256
  fileEncSha256?: Buffer;    // Hash SHA256 encriptado
  mediaKey?: Buffer;         // Clave de encriptación
  caption?: string;          // Texto descriptivo
}
```

### Propiedades Específicas por Tipo

**Imagen/Video:**
```typescript
interface ImageVideoMessage extends MediaMessage {
  width?: number;           // Ancho en píxeles
  height?: number;          // Alto en píxeles
  jpegThumbnail?: Buffer;   // Thumbnail en base64
}
```

**Video/Audio:**
```typescript
interface VideoAudioMessage extends MediaMessage {
  seconds?: number;         // Duración en segundos
  duration?: number;        // Duración alternativa
}
```

**Documento:**
```typescript
interface DocumentMessage extends MediaMessage {
  fileName?: string;        // Nombre del archivo original
  pageCount?: number;       // Número de páginas (PDF)
}
```

**Audio (nota de voz):**
```typescript
interface PTTMessage extends MediaMessage {
  ptt?: boolean;            // true = nota de voz
  waveform?: Buffer;        // Forma de onda visual
}
```

---

## 2. Recibir Archivos Multimedia

### 2.1 Detectar Tipo de Multimedia

```javascript
import { proto } from '@whiskeysockets/baileys';

sock.ev.on('messages.upsert', async ({ messages }) => {
  for (const msg of messages) {
    // Ignorar mensajes propios
    if (msg.key.fromMe) continue;
    
    const message = msg.message;
    if (!message) continue;
    
    // Detectar tipo de multimedia
    if (message.imageMessage) {
      console.log('📷 Imagen recibida');
      await handleImage(msg);
    }
    
    if (message.videoMessage) {
      console.log('🎥 Video recibido');
      await handleVideo(msg);
    }
    
    if (message.audioMessage) {
      const isVoiceNote = message.audioMessage.ptt;
      console.log(isVoiceNote ? '🎤 Nota de voz' : '🎵 Audio');
      await handleAudio(msg);
    }
    
    if (message.documentMessage) {
      console.log('📄 Documento recibido');
      await handleDocument(msg);
    }
    
    if (message.stickerMessage) {
      console.log('😀 Sticker recibido');
      await handleSticker(msg);
    }
  }
});
```

### 2.2 Función Genérica de Detección

```javascript
function detectMediaType(message) {
  if (message.imageMessage) {
    return { 
      type: 'image', 
      mediaMessage: message.imageMessage 
    };
  }
  
  if (message.videoMessage) {
    return { 
      type: 'video', 
      mediaMessage: message.videoMessage 
    };
  }
  
  if (message.audioMessage) {
    const isVoiceNote = message.audioMessage.ptt;
    return { 
      type: isVoiceNote ? 'voice' : 'audio', 
      mediaMessage: message.audioMessage 
    };
  }
  
  if (message.documentMessage) {
    return { 
      type: 'document', 
      mediaMessage: message.documentMessage 
    };
  }
  
  if (message.stickerMessage) {
    return { 
      type: 'sticker', 
      mediaMessage: message.stickerMessage 
    };
  }
  
  return null;
}

// Uso
const mediaInfo = detectMediaType(msg.message);
if (mediaInfo) {
  console.log(`Tipo: ${mediaInfo.type}`);
  console.log(`Tamaño: ${mediaInfo.mediaMessage.fileLength} bytes`);
}
```

---

## 3. Descargar y Guardar Archivos

### 3.1 Descarga Básica con downloadMediaMessage

```javascript
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import fs from 'fs';

async function downloadMedia(msg) {
  try {
    // Descargar como Buffer
    const buffer = await downloadMediaMessage(
      msg,
      'buffer',  // 'buffer' | 'stream'
      {}         // Opciones adicionales
    );
    
    if (!buffer) {
      throw new Error('Buffer vacío');
    }
    
    console.log(`✅ Descargado: ${buffer.length} bytes`);
    return buffer;
    
  } catch (error) {
    console.error('❌ Error al descargar:', error);
    throw error;
  }
}
```

### 3.2 Descarga como Stream (archivos grandes)

```javascript
import { createWriteStream } from 'fs';

async function downloadLargeMedia(msg, filePath) {
  try {
    // Descargar como stream
    const stream = await downloadMediaMessage(
      msg,
      'stream',
      {}
    );
    
    // Guardar directamente a disco
    const writeStream = createWriteStream(filePath);
    stream.pipe(writeStream);
    
    return new Promise((resolve, reject) => {
      writeStream.on('finish', () => {
        console.log(`✅ Guardado: ${filePath}`);
        resolve(filePath);
      });
      
      writeStream.on('error', reject);
    });
    
  } catch (error) {
    console.error('❌ Error al descargar stream:', error);
    throw error;
  }
}
```

### 3.3 Guardar con Nombre y Extensión Automáticos

```javascript
import path from 'path';

// Mapeo de MIME types a extensiones
const MIME_TO_EXT = {
  // Imágenes
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  
  // Videos
  'video/mp4': 'mp4',
  'video/3gpp': '3gp',
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
  'video/webm': 'webm',
  'video/x-matroska': 'mkv',
  
  // Audios
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/aac': 'aac',
  'audio/amr': 'amr',
  'audio/opus': 'opus',
  'audio/wav': 'wav',
  'audio/x-m4a': 'm4a',
  
  // Documentos
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/zip': 'zip',
  'application/x-rar-compressed': 'rar'
};

function getExtension(mimetype, fileName) {
  // Prioridad 1: Extensión del nombre de archivo
  if (fileName && fileName.includes('.')) {
    const ext = fileName.split('.').pop().toLowerCase();
    if (ext.length <= 5) return ext;
  }
  
  // Prioridad 2: Mapeo de MIME type
  if (mimetype && MIME_TO_EXT[mimetype]) {
    return MIME_TO_EXT[mimetype];
  }
  
  // Prioridad 3: Parsear MIME type (ej: "image/jpeg" → "jpeg")
  if (mimetype && mimetype.includes('/')) {
    const subtype = mimetype.split('/')[1].split(';')[0];
    return subtype;
  }
  
  // Fallback
  return 'bin';
}

function generateFileName(type, extension, originalName) {
  const timestamp = Date.now();
  const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  if (originalName) {
    // Limpiar caracteres especiales
    const cleanName = originalName
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_');
    return `${timestamp}_${cleanName}`;
  }
  
  return `${dateStr}_${timestamp}_${type}.${extension}`;
}

async function downloadAndSave(msg, baseFolder = './downloads') {
  // Detectar tipo
  const mediaInfo = detectMediaType(msg.message);
  if (!mediaInfo) {
    throw new Error('No es multimedia');
  }
  
  const { type, mediaMessage } = mediaInfo;
  
  // Crear carpeta de tipo
  const typeFolder = path.join(baseFolder, `${type}s`);
  if (!fs.existsSync(typeFolder)) {
    fs.mkdirSync(typeFolder, { recursive: true });
  }
  
  // Generar nombre
  const extension = getExtension(
    mediaMessage.mimetype, 
    mediaMessage.fileName
  );
  const fileName = generateFileName(type, extension, mediaMessage.fileName);
  const filePath = path.join(typeFolder, fileName);
  
  // Descargar
  const buffer = await downloadMediaMessage(msg, 'buffer', {});
  
  // Guardar
  fs.writeFileSync(filePath, buffer);
  
  console.log(`✅ Guardado: ${filePath}`);
  
  return {
    filePath,
    fileName,
    size: buffer.length,
    type,
    mimetype: mediaMessage.mimetype
  };
}
```

### 3.4 Validación de Tamaño Antes de Descargar

```javascript
const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

async function downloadWithValidation(msg) {
  const mediaInfo = detectMediaType(msg.message);
  if (!mediaInfo) return null;
  
  const fileSize = mediaInfo.mediaMessage.fileLength || 0;
  
  // Validar tamaño
  if (fileSize > MAX_SIZE) {
    console.warn(`⚠️ Archivo demasiado grande: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
    return {
      error: 'FILE_TOO_LARGE',
      size: fileSize,
      maxSize: MAX_SIZE
    };
  }
  
  // Si está dentro del límite, descargar
  return await downloadAndSave(msg);
}
```

---

## 4. Extraer Metadata

### 4.1 Metadata Completa

```javascript
function extractFullMetadata(msg) {
  const mediaInfo = detectMediaType(msg.message);
  if (!mediaInfo) return null;
  
  const { type, mediaMessage } = mediaInfo;
  
  const metadata = {
    // Metadata base
    type,
    mimetype: mediaMessage.mimetype || 'unknown',
    fileLength: mediaMessage.fileLength || 0,
    fileName: mediaMessage.fileName || null,
    caption: mediaMessage.caption || null,
    
    // Timestamp
    timestamp: msg.messageTimestamp ? 
      Number(msg.messageTimestamp) * 1000 : Date.now(),
    
    // Remitente
    from: msg.key.remoteJid,
    sender: msg.key.participant || msg.key.remoteJid,
    
    // Metadata específica de tipo
    width: mediaMessage.width || null,
    height: mediaMessage.height || null,
    duration: mediaMessage.seconds || mediaMessage.duration || null,
    pageCount: mediaMessage.pageCount || null,
    
    // Audio específico
    isVoiceNote: mediaMessage.ptt || false,
    
    // Hashes (para verificación)
    sha256: mediaMessage.fileSha256 ? 
      Buffer.from(mediaMessage.fileSha256).toString('base64') : null
  };
  
  return metadata;
}

// Guardar metadata junto al archivo
async function downloadWithMetadata(msg) {
  const result = await downloadAndSave(msg);
  const metadata = extractFullMetadata(msg);
  
  // Guardar JSON de metadata
  const metadataPath = result.filePath + '.json';
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  
  console.log(`📊 Metadata guardada: ${metadataPath}`);
  
  return {
    ...result,
    metadata
  };
}
```

### 4.2 Metadata de Imagen (dimensiones)

```javascript
async function getImageDimensions(msg) {
  const imageMsg = msg.message?.imageMessage;
  if (!imageMsg) return null;
  
  return {
    width: imageMsg.width,
    height: imageMsg.height,
    aspectRatio: imageMsg.width / imageMsg.height,
    isPortrait: imageMsg.height > imageMsg.width,
    isLandscape: imageMsg.width > imageMsg.height,
    isSquare: imageMsg.width === imageMsg.height
  };
}
```

### 4.3 Metadata de Video (duración)

```javascript
function getVideoDuration(msg) {
  const videoMsg = msg.message?.videoMessage;
  if (!videoMsg) return null;
  
  const seconds = videoMsg.seconds || videoMsg.duration || 0;
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  return {
    totalSeconds: seconds,
    minutes,
    seconds: remainingSeconds,
    formatted: `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  };
}
```

---

## 5. Enviar Archivos Multimedia

### 5.1 Enviar Imagen

```javascript
import { readFileSync } from 'fs';

async function sendImage(jid, imagePath, caption = '') {
  await sock.sendMessage(jid, {
    image: readFileSync(imagePath),
    caption: caption
  });
}

// Con URL
async function sendImageFromURL(jid, url, caption = '') {
  await sock.sendMessage(jid, {
    image: { url: url },
    caption: caption
  });
}
```

### 5.2 Enviar Video

```javascript
async function sendVideo(jid, videoPath, caption = '') {
  await sock.sendMessage(jid, {
    video: readFileSync(videoPath),
    caption: caption,
    gifPlayback: false  // true para GIF
  });
}
```

### 5.3 Enviar Audio

```javascript
async function sendAudio(jid, audioPath, isVoiceNote = false) {
  await sock.sendMessage(jid, {
    audio: readFileSync(audioPath),
    mimetype: 'audio/mp4',
    ptt: isVoiceNote  // true = nota de voz
  });
}
```

### 5.4 Enviar Documento

```javascript
async function sendDocument(jid, docPath, fileName, mimetype) {
  await sock.sendMessage(jid, {
    document: readFileSync(docPath),
    fileName: fileName,
    mimetype: mimetype
  });
}

// Ejemplo PDF
await sendDocument(
  '5218441234567@s.whatsapp.net',
  './files/report.pdf',
  'Reporte Mensual.pdf',
  'application/pdf'
);
```

---

## 6. Manejo de Errores Comunes

### 6.1 Error: Buffer Vacío

```javascript
async function safeDownload(msg, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const buffer = await downloadMediaMessage(msg, 'buffer', {});
      
      if (!buffer || buffer.length === 0) {
        throw new Error('Buffer vacío');
      }
      
      return buffer;
      
    } catch (error) {
      console.warn(`⚠️ Intento ${i + 1} falló:`, error.message);
      
      if (i === maxRetries - 1) {
        throw error;
      }
      
      // Esperar antes de reintentar
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

### 6.2 Error: Archivo No Disponible (expirado)

```javascript
async function downloadWithExpiration Check(msg) {
  try {
    return await downloadMediaMessage(msg, 'buffer', {});
  } catch (error) {
    if (error.message.includes('404') || error.message.includes('expired')) {
      console.error('❌ El archivo ha expirado en los servidores de WhatsApp');
      return null;
    }
    throw error;
  }
}
```

### 6.3 Error: Memoria Insuficiente

```javascript
async function downloadLargeFilesSafely(msg) {
  const fileSize = msg.message?.imageMessage?.fileLength || 0;
  
  // Si es mayor a 10 MB, usar stream
  if (fileSize > 10 * 1024 * 1024) {
    console.log('📦 Archivo grande, usando stream...');
    return await downloadLargeMedia(msg, './temp/large-file');
  }
  
  // Si es pequeño, usar buffer
  return await downloadMediaMessage(msg, 'buffer', {});
}
```

---

## 7. Optimización y Mejores Prácticas

### 7.1 Limpieza de Archivos Temporales

```javascript
import { unlinkSync, readdirSync, statSync } from 'fs';
import path from 'path';

function cleanOldFiles(folder, maxAgeMs = 24 * 60 * 60 * 1000) {
  const now = Date.now();
  
  const files = readdirSync(folder);
  let deleted = 0;
  
  for (const file of files) {
    const filePath = path.join(folder, file);
    const stats = statSync(filePath);
    
    const age = now - stats.mtimeMs;
    
    if (age > maxAgeMs) {
      unlinkSync(filePath);
      deleted++;
    }
  }
  
  console.log(`🗑️ Eliminados ${deleted} archivos antiguos`);
}

// Ejecutar limpieza cada hora
setInterval(() => {
  cleanOldFiles('./downloads/images');
  cleanOldFiles('./downloads/videos');
}, 60 * 60 * 1000);
```

### 7.2 Compresión de Imágenes

```javascript
import sharp from 'sharp';

async function compressImage(inputPath, outputPath, quality = 80) {
  await sharp(inputPath)
    .jpeg({ quality })
    .toFile(outputPath);
  
  const originalSize = statSync(inputPath).size;
  const compressedSize = statSync(outputPath).size;
  const savings = ((1 - compressedSize / originalSize) * 100).toFixed(2);
  
  console.log(`📦 Comprimido: ${savings}% de reducción`);
}
```

### 7.3 Generación de Thumbnails

```javascript
async function generateThumbnail(imagePath, thumbnailPath, size = 200) {
  await sharp(imagePath)
    .resize(size, size, { fit: 'cover' })
    .jpeg({ quality: 70 })
    .toFile(thumbnailPath);
  
  console.log(`🖼️ Thumbnail generado: ${thumbnailPath}`);
}
```

---

## 8. Casos de Uso Avanzados

### 8.1 Bot de Backup de Multimedia

```javascript
async function backupBot() {
  const sock = await connectToWhatsApp();
  
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      const mediaInfo = detectMediaType(msg.message);
      
      if (mediaInfo) {
        try {
          // Descargar y guardar
          const result = await downloadWithMetadata(msg);
          
          // Generar thumbnail si es imagen
          if (result.type === 'image') {
            await generateThumbnail(
              result.filePath,
              result.filePath.replace(/\.(jpg|png)$/, '.thumb.jpg')
            );
          }
          
          // Responder confirmación
          await sock.sendMessage(msg.key.remoteJid, {
            text: `✅ Backup guardado: ${result.fileName}`
          });
          
        } catch (error) {
          console.error('❌ Error en backup:', error);
        }
      }
    }
  });
}
```

### 8.2 Bot de Conversión de Formato

```javascript
import ffmpeg from 'fluent-ffmpeg';

async function convertVideo(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .output(outputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

sock.ev.on('messages.upsert', async ({ messages }) => {
  for (const msg of messages) {
    if (msg.message?.videoMessage) {
      const result = await downloadAndSave(msg);
      
      // Convertir a MP4 optimizado
      const optimizedPath = result.filePath.replace(/\.\w+$/, '.optimized.mp4');
      await convertVideo(result.filePath, optimizedPath);
      
      // Enviar versión optimizada
      await sock.sendMessage(msg.key.remoteJid, {
        video: readFileSync(optimizedPath),
        caption: '✅ Video optimizado'
      });
    }
  }
});
```

### 8.3 Bot de Análisis de Imágenes

```javascript
import tesseract from 'node-tesseract-ocr';

async function extractTextFromImage(imagePath) {
  const text = await tesseract.recognize(imagePath, {
    lang: 'spa',
    oem: 1,
    psm: 3
  });
  
  return text;
}

sock.ev.on('messages.upsert', async ({ messages }) => {
  for (const msg of messages) {
    if (msg.message?.imageMessage) {
      const result = await downloadAndSave(msg);
      
      // Extraer texto con OCR
      const text = await extractTextFromImage(result.filePath);
      
      if (text.trim()) {
        await sock.sendMessage(msg.key.remoteJid, {
          text: `📝 *Texto extraído:*\n\n${text}`
        });
      }
    }
  }
});
```

---

## 9. Implementación de API REST Multimedia

Para exponer las capacidades de envío multimedia a través de una API, se deben diferenciar los flujos según el origen del archivo.

### 9.1 Envío desde URL (Link Externo)

Ideal para enviar archivos alojados en CDNs o almacenamiento en la nube S3/Firebase. El backend detecta el tipo automáticamente por la extensión.

```javascript
app.post('/api/send/url', async (req, res) => {
  const { to, url, caption } = req.body;
  
  // Detección automática de tipo (image, video, etc.)
  const type = detectTypeFromUrl(url); 
  
  await sock.sendMessage(to, { 
    [type]: { url: url }, 
    caption: caption 
  });
});
```

### 9.2 Envío desde URI Local (Archivo en Servidor)

Útil para enviar archivos que ya están en el sistema de archivos del servidor. Solo requiere el parámetro `to` y el `fileName`.

```javascript
app.post('/api/send/local', async (req, res) => {
  const { to, fileName, caption } = req.body;
  const filePath = path.join(__dirname, 'public/media', fileName);
  
  if (!fs.existsSync(filePath)) throw new Error('Archivo no encontrado');

  const type = detectTypeFromFileName(fileName);

  await sock.sendMessage(to, { 
    [type]: { url: filePath }, 
    caption: caption 
  });
});
```

### 9.3 Envío mediante Carga (Upload)

Para cuando el cliente sube un archivo que debe enviarse inmediatamente. El backend detecta el tipo usando el `mimetype` proporcionado por el servidor.

```javascript
import multer from 'multer';
const upload = multer({ dest: 'uploads/' });

app.post('/api/send/upload', upload.single('file'), async (req, res) => {
  const { to, caption } = req.body;
  const file = req.file;

  const type = detectTypeFromMime(file.mimetype);

  await sock.sendMessage(to, { 
    [type]: { url: file.path }, 
    caption: caption,
    mimetype: file.mimetype,
    fileName: type === 'document' ? file.originalname : undefined 
  });
});
```

---

## Resumen

**Flujo completo de manejo de multimedia:**

1. **Recibir** → Detectar tipo en `messages.upsert`
2. **Validar** → Verificar tamaño y tipo permitido
3. **Descargar** → Usar `downloadMediaMessage()`
4. **Extraer metadata** → Obtener información del archivo
5. **Guardar** → Escribir a disco con nombre único
6. **Procesar** → Comprimir, convertir, analizar (opcional)
7. **Responder** → Confirmar al usuario

**Scripts de referencia:**
- [multimedia-downloader.js](../scripts/multimedia-downloader.js) - Bot completo de descarga automática
- [bot-with-commands.ts](../templates/bot-with-commands.ts) - Template con comandos multimedia

**Siguiente paso:** [Deployment Guide](./deployment-guide.md) para poner el bot en producción.

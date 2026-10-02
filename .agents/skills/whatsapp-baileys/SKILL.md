---
name: whatsapp-baileys
description: Toolkit para implementar conexiones no oficiales a WhatsApp usando la librería Baileys. Usar cuando se necesite crear bots de WhatsApp, gestionar mensajes de WhatsApp, implementar autenticación con QR o código de emparejamiento, enviar mensajes de texto/media, manejar grupos, implementar webhooks de WhatsApp, integrar WhatsApp Web API sin usar la API oficial, o implementar múltiples sesiones simultáneas (multi-sesión). Soporta TypeScript, JavaScript, Node.js y arquitecturas multi-dispositivo.
license: Complete terms in LICENSE.txt
---

# WhatsApp Baileys Integration Skill

Habilita el desarrollo completo de integraciones con WhatsApp usando Baileys, una librería TypeScript/JavaScript basada en WebSockets que no requiere navegadores ni Selenium.

## When to Use This Skill

Activa esta skill cuando el usuario mencione:

- **Palabras clave**: WhatsApp, Baileys, @whiskeysockets/baileys, WhatsApp Web, chatbot, bot de WhatsApp, multi-sesión, múltiples líneas, quoted, quotedMessage, contextInfo, mensaje citado, respuesta a mensaje
- **Acciones**: 
  - Crear bot de WhatsApp
  - Enviar/recibir mensajes de WhatsApp
  - Conectar WhatsApp con código QR o emparejamiento
  - Implementar autenticación de WhatsApp
  - Gestionar grupos de WhatsApp
  - Enviar imágenes, videos, audio, documentos por WhatsApp
  - Manejar eventos de mensajes
  - Guardar sesiones de WhatsApp
  - Diseñar arquitectura de base de datos para WhatsApp
  - Implementar store de mensajes
  - Reconexión automática de WhatsApp
  - Gestionar múltiples líneas de WhatsApp simultáneas
  - Crear API REST para gestión de sesiones
  - Implementar dashboard HTML para WhatsApp
  - Implementar listas negras o bloqueo de usuarios
  - Detectar mensajes que son respuestas (quoted messages)
  - Procesar mensajes citados (contextInfo, quotedMessage)
  - Obtener el mensaje original al que se responde
  - Extraer stanzaId del mensaje citado
  - Descargar multimedia de mensajes citados

## Prerequisites

Antes de usar esta skill, asegurar que el entorno tiene:

| Requisito  | Versión Mínima      | Verificación                       |
| ---------- | ------------------- | ---------------------------------- |
| Node.js    | 16.x o superior     | `node --version`                   |
| npm/yarn   | npm 7+ o yarn 1.22+ | `npm --version` o `yarn --version` |
| TypeScript | 4.5+ (opcional)     | `tsc --version`                    |

## Quick Start Workflows

### 🚀 Start Here: Ejemplo Básico Funcional (Recomendado)

La forma más rápida de empezar sin errores comunes:

```bash
# 1. Crear proyecto
mkdir mi-bot-whatsapp && cd mi-bot-whatsapp
npm init -y

# 2. Instalar dependencias (versiones correctas)
npm install @whiskeysockets/baileys pino qrcode-terminal

# 3. Copiar ejemplo básico
curl -o index.js https://raw.githubusercontent.com/.../basic-bot-example.js

# O copiar desde: .github/skills/whatsapp-baileys/scripts/basic-bot-example.js

# 4. Crear carpetas para media (opcional)
mkdir -p public/video public/images

# 5. Ejecutar
node index.js
```

**Este ejemplo incluye todas las correcciones para evitar errores 405, 440, 408 y problemas de QR.**

Ver código completo: [basic-bot-example.js](./scripts/basic-bot-example.js)

### 🚀 Multi-Sesión: Múltiples Líneas Simultáneas

Para gestionar múltiples cuentas de WhatsApp simultáneamente con dashboard HTML:

```bash
# 1. Copiar scripts al proyecto (qrcode.min.js YA INCLUIDO)
cp .github/skills/whatsapp-baileys/scripts/multi-session.js ./
cp -r .github/skills/whatsapp-baileys/scripts/multi-session-dashboard ./

# 2. Instalar dependencias
npm install @whiskeysockets/baileys pino qrcode-terminal express

# 3. Ejecutar servidor multi-sesión
node multi-session.js

# 4. Abrir dashboard en navegador
open http://localhost:3000
```

**Incluye:**
- API REST para crear/gestionar sesiones
- Dashboard HTML con visualización de QR
- **qrcode.min.js YA INCLUIDO en scripts/** (no descargar de internet)
- Carpetas de credenciales aisladas por sesión
- Reconexión automática inteligente (sin loops)
- Actualización automática del QR cada 5 segundos

Ver guía completa: [multi-session-guide.md](./references/multi-session-guide.md)

**⚠️ IMPORTANTE:** 
- El archivo `qrcode.min.js` está en `scripts/multi-session-dashboard/` y NO debe descargarse de internet
- Copiar la carpeta completa tal como está para evitar problemas de implementación
- Todos los archivos necesarios están incluidos en la skill

**⚠️ Errores comunes evitados:**
- Loop "iniciando sesión" → No reconectar durante escaneo QR
- QR no aparece en HTML → Usar `new QRCode(div, {...})`, no `QRCode.toCanvas()`
- Contenedor incorrecto → Usar `<div>`, no `<canvas>`

### Configuración del Navegador

Al crear el socket de WhatsApp, el campo `browser` define cómo aparece el dispositivo en la app móvil:

```typescript
const sock = makeWASocket({
    browser: ['Nombre App', 'Navegador', 'Versión']
})
```

**Navegadores reconocidos que muestran logo en WhatsApp:**

| Nombre (2do argumento) | Logo que muestra |
|------------------------|------------------|
| `'Chrome'`             | Logo de Chrome   |
| `'Firefox'`            | Logo de Firefox  |
| `'Safari'`             | Logo de Safari   |
| `'Edge'`               | Logo de Edge     |
| `'Opera'`              | Logo de Opera    |

**Ejemplos de uso:**

```typescript
// Mostrar logo de Chrome
browser: ['Mi Bot', 'Chrome', '1.0.0']

// Mostrar logo de Safari
browser: ['Mi Bot', 'Safari', '1.0.0']

// Mostrar logo de Firefox
browser: ['Mi Bot', 'Firefox', '1.0.0']
```

También puedes usar los helpers de Baileys:
```typescript
import { Browsers } from '@whiskeysockets/baileys'

browser: Browsers.ubuntu('Mi App')   // Logo de Ubuntu
browser: Browsers.macOS('Mi App')    // Logo de macOS/Apple
browser: Browsers.windows('Mi App')  // Logo de Windows
```

**Importante:** Si usas un nombre no reconocido, WhatsApp mostrará un **icono genérico** en lugar del logo del navegador.

### 📥 Descarga de Archivos Multimedia

Para descargar y guardar localmente todos los archivos multimedia recibidos (imágenes, videos, audios, documentos):

```bash
# 1. Copiar script al proyecto
cp .github/skills/whatsapp-baileys/scripts/multimedia-downloader.js ./

# 2. Instalar dependencias
npm install @whiskeysockets/baileys pino qrcode-terminal

# 3. Ejecutar bot de descargas
node multimedia-downloader.js
```

**Características del script:**
- ✅ Descarga automática de todos los tipos de multimedia
- ✅ Organización en carpetas por tipo (images/, videos/, audios/, documents/)
- ✅ Nombres únicos con timestamp
- ✅ Validación de tamaño máximo (50 MB por defecto)
- ✅ Extracción y guardado de metadata en JSON
- ✅ Detección automática de extensiones
- ✅ Respuesta automática con información del archivo

**Tipos de multimedia soportados:**

| Tipo       | Carpeta Destino       | Formatos              |
|------------|-----------------------|-----------------------|
| Imágenes   | `downloads/images/`   | JPG, PNG, GIF, WEBP   |
| Videos     | `downloads/videos/`   | MP4, 3GP, MOV         |
| Audios     | `downloads/audios/`   | MP3, OGG, AAC, AMR    |
| Documentos | `downloads/documents/` | PDF, DOC, XLS, etc.  |
| Stickers   | `downloads/stickers/` | WEBP                  |

**Ejemplo de uso en código:**

```javascript
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import fs from 'fs';

// En el evento messages.upsert
sock.ev.on('messages.upsert', async ({ messages }) => {
  for (const msg of messages) {
    // Detectar si es multimedia
    const hasImage = msg.message?.imageMessage;
    const hasVideo = msg.message?.videoMessage;
    const hasAudio = msg.message?.audioMessage;
    const hasDocument = msg.message?.documentMessage;
    
    if (hasImage || hasVideo || hasAudio || hasDocument) {
      try {
        // Descargar como Buffer
        const buffer = await downloadMediaMessage(
          msg,
          'buffer',
          {}
        );
        
        // Obtener metadata
        const mediaMsg = msg.message.imageMessage || 
                        msg.message.videoMessage || 
                        msg.message.audioMessage ||
                        msg.message.documentMessage;
        
        const mimetype = mediaMsg.mimetype;
        const fileSize = mediaMsg.fileLength;
        const fileName = mediaMsg.fileName || `${Date.now()}`;
        
        // Guardar archivo
        const filePath = `./downloads/${fileName}`;
        fs.writeFileSync(filePath, buffer);
        
        console.log(`✅ Archivo guardado: ${filePath}`);
        console.log(`   Tipo: ${mimetype}`);
        console.log(`   Tamaño: ${(fileSize / 1024).toFixed(2)} KB`);
        
        // Responder confirmación
        await sock.sendMessage(msg.key.remoteJid, {
          text: `✅ Archivo descargado: ${fileName}\nTamaño: ${(fileSize / 1024).toFixed(2)} KB`
        });
        
      } catch (error) {
        console.error('❌ Error al descargar:', error);
      }
    }
  }
});
```

**Configuración avanzada:**

```javascript
const CONFIG = {
  // Tamaño máximo (50 MB)
  MAX_DOWNLOAD_SIZE: 50 * 1024 * 1024,
  
  // Carpetas personalizadas
  DOWNLOAD_FOLDERS: {
    image: './media/imagenes',
    video: './media/videos',
    audio: './media/audios',
    document: './media/documentos'
  },
  
  // Respuesta automática
  AUTO_REPLY: true,
  
  // Log de metadata
  LOG_METADATA: true
};
```

**Metadata disponible:**

```javascript
const metadata = {
  mimetype: 'image/jpeg',
  fileLength: 245678,       // bytes
  fileName: 'foto.jpg',
  caption: 'Mi foto',
  width: 1920,              // solo imágenes/videos
  height: 1080,
  duration: 30,             // solo videos/audios (segundos)
  pageCount: 5,             // solo documentos PDF
  timestamp: 1735689600000
};
```

**Extensiones detectadas automáticamente:**

El script incluye mapeo de 30+ tipos MIME a extensiones:
- Imágenes: jpg, png, gif, webp
- Videos: mp4, 3gp, mov, avi
- Audios: mp3, ogg, aac, amr, opus
- Documentos: pdf, doc, docx, xls, xlsx, ppt, pptx, txt, csv

Ver implementación completa: [multimedia-downloader.js](./scripts/multimedia-downloader.js)

### 1. Crear Nuevo Proyecto con Baileys

```bash
# Crear directorio del proyecto
mkdir mi-whatsapp-bot && cd mi-whatsapp-bot

# Inicializar proyecto Node.js
npm init -y

# Instalar Baileys
npm install @whiskeysockets/baileys

# Instalar dependencias recomendadas
npm install @hapi/boom pino qrcode-terminal

# Instalar TypeScript (opcional)
npm install -D typescript @types/node ts-node
```

### 2. Implementar Conexión Básica

Usar el [template de conexión básica](./templates/basic-connection.ts) como punto de partida:

1. Copiar el template al proyecto
2. Configurar método de autenticación (QR terminal, QR web, o código de emparejamiento)
3. Implementar manejadores de eventos básicos
4. Ejecutar y escanear código QR

### 3. Implementar Bot con Comandos

Usar el [template de bot completo](./templates/bot-with-commands.ts):

1. Extender la clase base del bot
2. Agregar comandos personalizados en `processCommand()`
3. Implementar lógica de negocio
4. Configurar base de datos si es necesario

### 4. Configurar Base de Datos

Consultar [esquemas de base de datos](./references/database-schemas.md) para:

- **SQL**: PostgreSQL/MySQL con tablas relacionales
- **NoSQL**: MongoDB con colecciones documentales
- Implementación de `useCustomAuthState()` para persistencia

### 5. Desplegar en Producción

Ver [guía de deployment](./references/deployment-guide.md) para:

- Configuración de PM2 para procesos persistentes
- Docker/Containerización
- Variables de entorno y secretos
- Monitoreo y logging
- Backup de sesiones

## Core Capabilities

### Autenticación

**⚠️ Configuración Crítica**: Para evitar errores de conexión, siempre incluir estas configuraciones:

```javascript
import { fetchLatestBaileysVersion } from '@whiskeysockets/baileys'

const { version } = await fetchLatestBaileysVersion() // CRÍTICO

const sock = makeWASocket({
    version, // ← Incluir versión actualizada
    auth: state,
    // Evitar errores 405 y timeouts
    syncFullHistory: false,
    markOnlineOnConnect: false,
    defaultQueryTimeoutMs: undefined,
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 30000
})
```

| Método                   | Cuándo Usar                 | Referencia                                                                                             |
| ------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------ |
| QR en Terminal           | Desarrollo local rápido     | [Conexión QR](./references/baileys-complete-guide.md#21-conexión-con-código-qr-terminal)               |
| QR en Web                | Interfaces web, dashboards  | [Conexión Web QR](./references/baileys-complete-guide.md#23-conexión-con-qr-en-página-web)             |
| Código de Emparejamiento | Onboarding sin QR visual    | [Pairing Code](./references/baileys-complete-guide.md#22-conexión-con-código-de-emparejamiento-sin-qr) |
| Multi-dispositivo        | Conectar múltiples clientes | [Config avanzada](./references/baileys-complete-guide.md#24-configuración-avanzada-del-socket)         |

### Envío de Mensajes

Todos los tipos de mensajes están soportados:

- **Texto**: Simple, con menciones, con respuesta (quote), con formato
- **Media**: Imágenes, videos, GIFs, audio, documentos, stickers
- **Especiales**: Ubicación, contactos, reacciones, encuestas, mensajes fijados
- **Avanzados**: Reenvío, edición, eliminación, mensajes temporales, view once

Ver [guía completa de mensajes](./references/baileys-complete-guide.md#4-envío-de-mensajes).

### Endpoints para Mensajería Multimedia (API REST)

Para implementar una API sólida, es necesario manejar tres escenarios de envío de multimedia:

| Escenario | Método | Endpoint | Payload | Descripción |
|-----------|--------|----------|---------|-------------|
| **URL Remota** | `POST` | `/api/send/url` | `{ to, url, caption }` | Envía contenido desde un link externo. El backend deduce si es imagen, video, etc. |
| **URI Local** | `POST` | `/api/send/local` | `{ to, fileName, caption }` | Envía un archivo que ya reside en el servidor. Solo requiere el nombre del archivo. |
| **Carga (Upload)** | `POST` | `/api/send/upload` | `multipart/form-data` | Sube un archivo (file, to, caption) y lo envía inmediatamente. |

**Ejemplo de implementación de los escenarios:**

```javascript
// ESCENARIO 1: URL (El backend deduce el tipo)
app.post('/api/send/url', async (req, res) => {
  const { to, url, caption } = req.body;
  const type = detectType(url); // Helper para detectar image, video, etc.
  await sock.sendMessage(to, { [type]: { url }, caption });
});

// ESCENARIO 2: URI Local (Solo nombre de archivo)
app.post('/api/send/local', async (req, res) => {
  const { to, fileName, caption } = req.body;
  const filePath = path.join(__dirname, 'public/media', fileName);
  const type = detectType(fileName);
  await sock.sendMessage(to, { [type]: { url: filePath }, caption });
});

// ESCENARIO 3: Upload (Subir y enviar)
app.post('/api/send/upload', upload.single('file'), async (req, res) => {
  const { to, caption } = req.body;
  const file = req.file; 
  const type = detectType(file.mimetype);
  await sock.sendMessage(to, { 
    [type]: { url: file.path }, 
    caption,
    mimetype: file.mimetype 
  });
});
```

Ver bot completo con estos endpoints: [multimedia-api.js](./scripts/multimedia-api.js)

### Eventos del Socket

| Evento              | Propósito                     | Cuándo Escuchar                |
| ------------------- | ----------------------------- | ------------------------------ |
| `connection.update` | Estado de conexión            | Siempre (requerido)            |
| `creds.update`      | Actualización de credenciales | Siempre (requerido)            |
| `messages.upsert`   | Nuevos mensajes recibidos     | Para procesar mensajes         |
| `messages.update`   | Ediciones, reacciones, votos  | Para updates de mensajes       |
| `groups.update`     | Cambios en grupos             | Si trabajas con grupos         |
| `presence.update`   | Estado online/typing          | Para features de presencia     |
| `call`              | Llamadas entrantes            | Para rechazar/manejar llamadas |

Ver [lista completa de eventos](./references/baileys-complete-guide.md#5-eventos-importantes).

### Obtener Información de Contactos

| Método                         | Propósito                  | Ejemplo                                      |
| ------------------------------ | -------------------------- | -------------------------------------------- |
| `profilePictureUrl(jid, type)` | Foto de perfil             | `await sock.profilePictureUrl(jid, 'image')` |
| `fetchStatus(jid)`             | Estado/About del usuario   | `await sock.fetchStatus(jid)`                |
| `onWhatsApp(number)`           | Verificar si está en WA    | `await sock.onWhatsApp('5491234567890')`     |
| `getBusinessProfile(jid)`      | Perfil de negocio          | `await sock.getBusinessProfile(jid)`         |
| `groupMetadata(groupJid)`      | Información completa grupo | `await sock.groupMetadata(groupJid)`         |

```typescript
// Obtener foto de perfil en alta resolución
const profileUrl = await sock.profilePictureUrl(jid, 'image') // 'image' o 'preview'
console.log('Foto:', profileUrl)

// Verificar estado/about
const status = await sock.fetchStatus(jid)
console.log('Estado:', status)

// Verificar si un número está en WhatsApp
const [result] = await sock.onWhatsApp('5491234567890@s.whatsapp.net')
console.log('Existe:', result.exists)
console.log('JID:', result.jid)
```

### Gestión de Lista Negra (Blacklist)

Permite excluir números específicos del procesamiento del bot.

**Implementación Técnica**:

1.  **Ubicación**: La validación debe realizarse **estrictamente** dentro del evento `messages.upsert`, en la primera línea del bucle `for` que itera los mensajes.
2.  **Identificación**: Obtener el identificador del remitente mediante `msg.key.remoteJid`.
3.  **Validación**:
    *   Comparar el `remoteJid` contra la fuente de datos definida (Variable en memoria, JSON o Base de Datos).
    *   Si existe coincidencia, ejecutar `continue` para ignorar silenciosamente el mensaje y pasar al siguiente.

**Ejemplo de flujo de validación:**

```javascript
sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
        // 1. Obtener número
        const remoteJid = msg.key.remoteJid;

        // 2. Validar contra blacklist (Función agnóstica a la fuente de datos)
        if (isBlacklisted(remoteJid)) {
            continue; // Ignorar mensaje
        }

        // 3. Procesar mensaje normalmente...
    }
});
```

### Mensajes Citados (Quoted Messages / Respuestas)

Cuando un usuario responde a un mensaje anterior, WhatsApp incluye información del mensaje original en `contextInfo.quotedMessage`. Esta funcionalidad es esencial para bots que necesitan procesar respuestas contextuales.

#### Estructura General del Mensaje con Cita

```javascript
// Estructura de un mensaje que ES UNA RESPUESTA a otro mensaje
{
  key: {
    remoteJid: '5491123456789@s.whatsapp.net',
    fromMe: false,
    id: 'ABCD1234567890'
  },
  message: {
    extendedTextMessage: {
      text: 'Esta es mi respuesta',
      contextInfo: {
        stanzaId: 'ID_DEL_MENSAJE_CITADO',      // ID único del mensaje original
        participant: '5491198765432@s.whatsapp.net', // Autor del mensaje citado (en grupos)
        quotedMessage: {
          // Aquí está el contenido del mensaje original citado
          // La estructura varía según el tipo de mensaje
        }
      }
    }
  }
}
```

#### Campos Clave de `contextInfo`

| Campo           | Tipo     | Descripción                                                    |
|-----------------|----------|----------------------------------------------------------------|
| `stanzaId`      | `string` | ID único del mensaje citado (útil para referencias)            |
| `participant`   | `string` | JID del autor del mensaje citado (presente en grupos)          |
| `quotedMessage` | `object` | Contenido completo del mensaje citado (estructura variable)    |
| `remoteJid`     | `string` | JID del chat donde está el mensaje citado (opcional)           |
| `mentionedJid`  | `array`  | Lista de JIDs mencionados en el mensaje (si aplica)            |

#### Estructuras de `quotedMessage` según Tipo

##### 1. Mensaje de Texto Simple Citado

```javascript
contextInfo: {
  stanzaId: 'MSG_ID_123',
  participant: '5491123456789@s.whatsapp.net',
  quotedMessage: {
    conversation: 'Este es el texto del mensaje original'
  }
}
```

##### 2. Mensaje de Texto Extendido Citado (con menciones, enlaces, formato)

```javascript
contextInfo: {
  stanzaId: 'MSG_ID_123',
  participant: '5491123456789@s.whatsapp.net',
  quotedMessage: {
    extendedTextMessage: {
      text: 'Texto con @mención o enlace https://ejemplo.com',
      matchedText: 'https://ejemplo.com',
      canonicalUrl: 'https://ejemplo.com',
      description: 'Descripción del enlace',
      title: 'Título del enlace',
      contextInfo: {
        mentionedJid: ['5491198765432@s.whatsapp.net']
      }
    }
  }
}
```

##### 3. Imagen Citada

```javascript
contextInfo: {
  stanzaId: 'MSG_ID_123',
  participant: '5491123456789@s.whatsapp.net',
  quotedMessage: {
    imageMessage: {
      url: 'https://mmg.whatsapp.net/...',           // URL para descarga (temporal)
      mimetype: 'image/jpeg',
      caption: 'Pie de foto opcional',
      fileSha256: Buffer,                            // Hash SHA256 del archivo
      fileLength: 245678,                            // Tamaño en bytes
      height: 1080,
      width: 1920,
      mediaKey: Buffer,                              // Clave para descifrar
      fileEncSha256: Buffer,
      directPath: '/v/t62.1234-24/...',
      mediaKeyTimestamp: 1706832000,
      jpegThumbnail: Buffer                          // Miniatura en base64
    }
  }
}
```

##### 4. Video Citado

```javascript
contextInfo: {
  stanzaId: 'MSG_ID_123',
  participant: '5491123456789@s.whatsapp.net',
  quotedMessage: {
    videoMessage: {
      url: 'https://mmg.whatsapp.net/...',
      mimetype: 'video/mp4',
      caption: 'Descripción del video',
      fileSha256: Buffer,
      fileLength: 15678900,                          // Tamaño en bytes
      seconds: 45,                                   // Duración en segundos
      height: 720,
      width: 1280,
      mediaKey: Buffer,
      fileEncSha256: Buffer,
      directPath: '/v/t62.1234-24/...',
      mediaKeyTimestamp: 1706832000,
      jpegThumbnail: Buffer,                         // Miniatura del video
      gifPlayback: false                             // true si es GIF
    }
  }
}
```

##### 5. Audio / Nota de Voz Citado

```javascript
contextInfo: {
  stanzaId: 'MSG_ID_123',
  participant: '5491123456789@s.whatsapp.net',
  quotedMessage: {
    audioMessage: {
      url: 'https://mmg.whatsapp.net/...',
      mimetype: 'audio/ogg; codecs=opus',            // Notas de voz
      // mimetype: 'audio/mpeg',                     // Archivos de audio
      fileSha256: Buffer,
      fileLength: 34567,
      seconds: 15,                                   // Duración en segundos
      ptt: true,                                     // true = nota de voz, false = archivo
      mediaKey: Buffer,
      fileEncSha256: Buffer,
      directPath: '/v/t62.1234-24/...',
      mediaKeyTimestamp: 1706832000,
      waveform: Buffer                               // Forma de onda (solo notas de voz)
    }
  }
}
```

##### 6. Documento Citado

```javascript
contextInfo: {
  stanzaId: 'MSG_ID_123',
  participant: '5491123456789@s.whatsapp.net',
  quotedMessage: {
    documentMessage: {
      url: 'https://mmg.whatsapp.net/...',
      mimetype: 'application/pdf',                   // O cualquier tipo MIME
      title: 'documento.pdf',                        // Nombre mostrado
      fileSha256: Buffer,
      fileLength: 1234567,
      pageCount: 10,                                 // Solo para PDFs
      mediaKey: Buffer,
      fileName: 'documento.pdf',                     // Nombre real del archivo
      fileEncSha256: Buffer,
      directPath: '/v/t62.1234-24/...',
      mediaKeyTimestamp: 1706832000,
      jpegThumbnail: Buffer                          // Miniatura (si aplica)
    }
  }
}
```

##### 7. Ubicación Citada

```javascript
contextInfo: {
  stanzaId: 'MSG_ID_123',
  participant: '5491123456789@s.whatsapp.net',
  quotedMessage: {
    locationMessage: {
      degreesLatitude: -34.603722,
      degreesLongitude: -58.381592,
      name: 'Obelisco de Buenos Aires',              // Nombre del lugar (opcional)
      address: 'Av. 9 de Julio, Buenos Aires',       // Dirección (opcional)
      url: 'https://foursquare.com/v/...',           // URL del lugar (opcional)
      jpegThumbnail: Buffer                          // Miniatura del mapa
    }
  }
}
```

##### 8. Ubicación en Vivo Citada

```javascript
contextInfo: {
  stanzaId: 'MSG_ID_123',
  participant: '5491123456789@s.whatsapp.net',
  quotedMessage: {
    liveLocationMessage: {
      degreesLatitude: -34.603722,
      degreesLongitude: -58.381592,
      accuracyInMeters: 15,
      speedInMps: 2.5,                               // Velocidad en m/s
      degreesClockwiseFromMagneticNorth: 180,        // Dirección
      caption: 'Compartiendo ubicación',
      sequenceNumber: 1,
      timeOffset: 300,                               // Tiempo restante en segundos
      jpegThumbnail: Buffer
    }
  }
}
```

##### 9. Contacto Citado (vCard)

```javascript
contextInfo: {
  stanzaId: 'MSG_ID_123',
  participant: '5491123456789@s.whatsapp.net',
  quotedMessage: {
    contactMessage: {
      displayName: 'Juan Pérez',
      vcard: 'BEGIN:VCARD\nVERSION:3.0\nN:Pérez;Juan;;;\nFN:Juan Pérez\nTEL;type=CELL:+5491123456789\nEND:VCARD'
    }
  }
}

// Múltiples contactos
contextInfo: {
  quotedMessage: {
    contactsArrayMessage: {
      displayName: '2 contactos',
      contacts: [
        { displayName: 'Juan', vcard: '...' },
        { displayName: 'María', vcard: '...' }
      ]
    }
  }
}
```

##### 10. Sticker Citado

```javascript
contextInfo: {
  stanzaId: 'MSG_ID_123',
  participant: '5491123456789@s.whatsapp.net',
  quotedMessage: {
    stickerMessage: {
      url: 'https://mmg.whatsapp.net/...',
      mimetype: 'image/webp',
      fileSha256: Buffer,
      fileLength: 23456,
      height: 512,
      width: 512,
      mediaKey: Buffer,
      fileEncSha256: Buffer,
      directPath: '/v/t62.1234-24/...',
      mediaKeyTimestamp: 1706832000,
      isAnimated: false,                             // true si es sticker animado
      pngThumbnail: Buffer
    }
  }
}
```

##### 11. Encuesta Citada (Poll)

```javascript
contextInfo: {
  stanzaId: 'MSG_ID_123',
  participant: '5491123456789@s.whatsapp.net',
  quotedMessage: {
    pollCreationMessage: {
      name: '¿Cuál prefieres?',                      // Pregunta de la encuesta
      options: [
        { optionName: 'Opción A' },
        { optionName: 'Opción B' },
        { optionName: 'Opción C' }
      ],
      selectableOptionsCount: 1                      // Máximo de opciones seleccionables
    }
  }
}
```

##### 12. Mensaje de Producto/Catálogo Citado

```javascript
contextInfo: {
  stanzaId: 'MSG_ID_123',
  participant: '5491123456789@s.whatsapp.net',
  quotedMessage: {
    productMessage: {
      product: {
        productId: 'PROD_123',
        title: 'Producto Ejemplo',
        description: 'Descripción del producto',
        currencyCode: 'ARS',
        priceAmount1000: 150000,                     // Precio * 1000 (150.00)
        retailerId: 'SKU_001',
        productImageCount: 3
      },
      businessOwnerJid: '5491123456789@s.whatsapp.net'
    }
  }
}
```

##### 13. Botones / Lista Interactiva Citada (Legacy)

```javascript
// Respuesta a botones
contextInfo: {
  quotedMessage: {
    buttonsResponseMessage: {
      selectedButtonId: 'btn_1',
      selectedDisplayText: 'Opción seleccionada',
      contextInfo: { /* ... */ }
    }
  }
}

// Respuesta a lista
contextInfo: {
  quotedMessage: {
    listResponseMessage: {
      title: 'Título seleccionado',
      listType: 1,
      singleSelectReply: {
        selectedRowId: 'row_1'
      }
    }
  }
}
```

##### 14. Mensaje View Once Citado

```javascript
contextInfo: {
  stanzaId: 'MSG_ID_123',
  participant: '5491123456789@s.whatsapp.net',
  quotedMessage: {
    viewOnceMessage: {
      message: {
        imageMessage: { /* estructura de imagen */ }
        // O videoMessage, etc.
      }
    }
  }
}

// View Once V2 (versión más reciente)
contextInfo: {
  quotedMessage: {
    viewOnceMessageV2: {
      message: {
        imageMessage: { /* ... */ }
      }
    }
  }
}
```

#### Código Completo: Detectar y Procesar Mensajes Citados

```javascript
import { downloadMediaMessage, getContentType } from '@whiskeysockets/baileys';

sock.ev.on('messages.upsert', async ({ messages, type }) => {
  if (type !== 'notify') return;

  for (const msg of messages) {
    if (!msg.message || msg.key.fromMe) continue;

    const content = msg.message;
    const messageType = getContentType(content);
    
    // Obtener contextInfo (puede estar en diferentes lugares)
    const contextInfo = 
      content.extendedTextMessage?.contextInfo ||
      content.imageMessage?.contextInfo ||
      content.videoMessage?.contextInfo ||
      content.audioMessage?.contextInfo ||
      content.documentMessage?.contextInfo ||
      content.stickerMessage?.contextInfo ||
      content.locationMessage?.contextInfo ||
      content.contactMessage?.contextInfo;

    // Verificar si es una respuesta (tiene mensaje citado)
    if (contextInfo?.quotedMessage) {
      const quotedMsg = contextInfo.quotedMessage;
      const quotedId = contextInfo.stanzaId;
      const quotedAuthor = contextInfo.participant || msg.key.remoteJid;
      
      // Detectar tipo del mensaje citado
      const quotedType = getContentType(quotedMsg);
      
      console.log('═══════════════════════════════════════');
      console.log('📩 Mensaje recibido ES UNA RESPUESTA');
      console.log('═══════════════════════════════════════');
      console.log('ID mensaje citado:', quotedId);
      console.log('Autor original:', quotedAuthor);
      console.log('Tipo citado:', quotedType);
      
      // Extraer contenido según el tipo citado
      let quotedContent = null;
      
      switch (quotedType) {
        case 'conversation':
          quotedContent = quotedMsg.conversation;
          console.log('Texto citado:', quotedContent);
          break;
          
        case 'extendedTextMessage':
          quotedContent = quotedMsg.extendedTextMessage.text;
          console.log('Texto citado:', quotedContent);
          break;
          
        case 'imageMessage':
          quotedContent = {
            caption: quotedMsg.imageMessage.caption || '',
            mimetype: quotedMsg.imageMessage.mimetype,
            size: quotedMsg.imageMessage.fileLength
          };
          console.log('Imagen citada:', quotedContent);
          break;
          
        case 'videoMessage':
          quotedContent = {
            caption: quotedMsg.videoMessage.caption || '',
            mimetype: quotedMsg.videoMessage.mimetype,
            duration: quotedMsg.videoMessage.seconds,
            size: quotedMsg.videoMessage.fileLength
          };
          console.log('Video citado:', quotedContent);
          break;
          
        case 'audioMessage':
          quotedContent = {
            mimetype: quotedMsg.audioMessage.mimetype,
            duration: quotedMsg.audioMessage.seconds,
            isVoiceNote: quotedMsg.audioMessage.ptt || false
          };
          console.log('Audio citado:', quotedContent);
          break;
          
        case 'documentMessage':
          quotedContent = {
            fileName: quotedMsg.documentMessage.fileName,
            mimetype: quotedMsg.documentMessage.mimetype,
            size: quotedMsg.documentMessage.fileLength,
            pageCount: quotedMsg.documentMessage.pageCount
          };
          console.log('Documento citado:', quotedContent);
          break;
          
        case 'locationMessage':
          quotedContent = {
            latitude: quotedMsg.locationMessage.degreesLatitude,
            longitude: quotedMsg.locationMessage.degreesLongitude,
            name: quotedMsg.locationMessage.name,
            address: quotedMsg.locationMessage.address
          };
          console.log('Ubicación citada:', quotedContent);
          break;
          
        case 'contactMessage':
          quotedContent = {
            displayName: quotedMsg.contactMessage.displayName,
            vcard: quotedMsg.contactMessage.vcard
          };
          console.log('Contacto citado:', quotedContent);
          break;
          
        case 'stickerMessage':
          quotedContent = {
            mimetype: quotedMsg.stickerMessage.mimetype,
            isAnimated: quotedMsg.stickerMessage.isAnimated
          };
          console.log('Sticker citado:', quotedContent);
          break;
          
        case 'pollCreationMessage':
          quotedContent = {
            question: quotedMsg.pollCreationMessage.name,
            options: quotedMsg.pollCreationMessage.options.map(o => o.optionName)
          };
          console.log('Encuesta citada:', quotedContent);
          break;
          
        default:
          console.log('Tipo de mensaje citado no manejado:', quotedType);
          quotedContent = quotedMsg;
      }
      
      // Ejemplo: Responder confirmando la cita
      const textoRespuesta = content.extendedTextMessage?.text || 
                            content.conversation || 
                            '[mensaje multimedia]';
      
      await sock.sendMessage(msg.key.remoteJid, {
        text: `✅ Recibí tu respuesta: "${textoRespuesta}"\n\n` +
              `📎 Citaste un mensaje de tipo: ${quotedType}\n` +
              `🆔 ID original: ${quotedId}`
      });
    }
  }
});
```

#### Función Helper: Extraer Texto de Cualquier Mensaje Citado

```javascript
/**
 * Extrae el texto legible de un mensaje citado, independiente del tipo
 * @param {object} quotedMessage - El objeto quotedMessage del contextInfo
 * @returns {string} - Texto extraído o descripción del contenido
 */
function getQuotedText(quotedMessage) {
  if (!quotedMessage) return '';
  
  // Texto simple
  if (quotedMessage.conversation) {
    return quotedMessage.conversation;
  }
  
  // Texto extendido
  if (quotedMessage.extendedTextMessage?.text) {
    return quotedMessage.extendedTextMessage.text;
  }
  
  // Imagen con caption
  if (quotedMessage.imageMessage?.caption) {
    return `[Imagen] ${quotedMessage.imageMessage.caption}`;
  }
  
  // Video con caption
  if (quotedMessage.videoMessage?.caption) {
    return `[Video] ${quotedMessage.videoMessage.caption}`;
  }
  
  // Documento
  if (quotedMessage.documentMessage) {
    return `[Documento] ${quotedMessage.documentMessage.fileName || 'archivo'}`;
  }
  
  // Audio / Nota de voz
  if (quotedMessage.audioMessage) {
    const tipo = quotedMessage.audioMessage.ptt ? 'Nota de voz' : 'Audio';
    return `[${tipo}] ${quotedMessage.audioMessage.seconds || 0}s`;
  }
  
  // Ubicación
  if (quotedMessage.locationMessage) {
    return `[Ubicación] ${quotedMessage.locationMessage.name || 'Ubicación compartida'}`;
  }
  
  // Contacto
  if (quotedMessage.contactMessage) {
    return `[Contacto] ${quotedMessage.contactMessage.displayName}`;
  }
  
  // Sticker
  if (quotedMessage.stickerMessage) {
    return '[Sticker]';
  }
  
  // Encuesta
  if (quotedMessage.pollCreationMessage) {
    return `[Encuesta] ${quotedMessage.pollCreationMessage.name}`;
  }
  
  // View Once
  if (quotedMessage.viewOnceMessage || quotedMessage.viewOnceMessageV2) {
    return '[Mensaje de vista única]';
  }
  
  // Respuesta a botones
  if (quotedMessage.buttonsResponseMessage) {
    return quotedMessage.buttonsResponseMessage.selectedDisplayText;
  }
  
  // Respuesta a lista
  if (quotedMessage.listResponseMessage) {
    return quotedMessage.listResponseMessage.title;
  }
  
  return '[Mensaje no soportado]';
}
```

#### Descargar Media de un Mensaje Citado

```javascript
import { downloadMediaMessage } from '@whiskeysockets/baileys';

/**
 * Descarga el archivo multimedia de un mensaje citado
 * NOTA: Requiere reconstruir el objeto mensaje completo
 */
async function downloadQuotedMedia(sock, msg) {
  const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
  if (!contextInfo?.quotedMessage) return null;
  
  const quotedMsg = contextInfo.quotedMessage;
  const quotedType = getContentType(quotedMsg);
  
  // Solo procesar tipos multimedia
  const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'];
  if (!mediaTypes.includes(quotedType)) return null;
  
  // Reconstruir mensaje para downloadMediaMessage
  const quotedMsgObj = {
    key: {
      remoteJid: msg.key.remoteJid,
      id: contextInfo.stanzaId,
      participant: contextInfo.participant
    },
    message: quotedMsg
  };
  
  try {
    const buffer = await downloadMediaMessage(quotedMsgObj, 'buffer', {});
    const mediaMsg = quotedMsg[quotedType];
    
    return {
      buffer,
      mimetype: mediaMsg.mimetype,
      fileName: mediaMsg.fileName || `quoted_${Date.now()}`,
      size: mediaMsg.fileLength
    };
  } catch (error) {
    console.error('Error descargando media citada:', error.message);
    return null;
  }
}
```

## Common Patterns

### Patrón: Enviar Mensaje con Reintentos

```typescript
async function sendWithRetry(sock: WASocket, jid: string, content: any, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await sock.sendMessage(jid, content)
        } catch (error) {
            if (i === maxRetries - 1) throw error
            await new Promise(r => setTimeout(r, 1000 * (i + 1)))
        }
    }
}
```

### Patrón: Procesar Mensajes en Cola

```typescript
const messageQueue: Array<() => Promise<void>> = []
let processing = false

async function processQueue() {
    if (processing) return
    processing = true
    
    while (messageQueue.length > 0) {
        const task = messageQueue.shift()
        if (task) await task()
        await new Promise(r => setTimeout(r, 100)) // Rate limiting
    }
    
    processing = false
}
```

### Patrón: Extraer Contenido de Mensaje

```typescript
import { getContentType } from '@whiskeysockets/baileys'

function getMessageContent(msg: WAMessage): string | null {
    if (!msg.message) return null
    
    const messageType = getContentType(msg.message)
    
    switch (messageType) {
        case 'conversation':
            return msg.message.conversation
        case 'extendedTextMessage':
            return msg.message.extendedTextMessage?.text || null
        case 'imageMessage':
            return msg.message.imageMessage?.caption || null
        case 'videoMessage':
            return msg.message.videoMessage?.caption || null
        default:
            return null
    }
}
```

## Troubleshooting

### Errores Comunes y Soluciones Probadas

| Problema                                 | Causa Probable                                               | Solución                                                                                               | Código                                                  |
| ---------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| **Error 405**: Connection Failure        | Versión de Baileys desactualizada o configuración incorrecta | Usar `fetchLatestBaileysVersion()` y configurar `syncFullHistory: false`, `markOnlineOnConnect: false` | [Ver ejemplo](#solución-error-405)                      |
| **Error 440**: Stream Errored (conflict) | Múltiples instancias del bot o reconexiones simultáneas      | Evitar reconexiones concurrentes con flag `isReconnecting`, cerrar instancias anteriores               | [Ver ejemplo](#solución-error-440)                      |
| **Error 408**: WebSocket Error           | Timeout de conexión                                          | Aumentar `connectTimeoutMs: 60000` y `keepAliveIntervalMs: 30000`                                      | [Ver ejemplo](#solución-error-408)                      |
| QR no se genera                          | Sesión anterior corrupta o `printQRInTerminal` deprecado     | Eliminar `auth_info/` y usar `qrcode-terminal` manualmente (NO usar `printQRInTerminal`)               | [Ver ejemplo](#solución-qr-no-aparece)                  |
| Mensajes no llegan                       | Evento mal configurado                                       | Verificar `sock.ev.on('messages.upsert')` con type === 'notify'                                        | [Ver ejemplo básico](./scripts/basic-bot-example.js)    |
| Sesión se cierra                         | `creds.update` no guarda                                     | Implementar `saveCreds` correctamente con `sock.ev.on('creds.update', saveCreds)`                      | [Ver ejemplo básico](./scripts/basic-bot-example.js)    |
| Sesión no persiste                       | auth_info no se mantiene entre reinicios                     | Verificar que `useMultiFileAuthState()` apunte a la carpeta correcta                                   | [Ver ejemplo básico](./scripts/basic-bot-example.js)    |
| Sesión no se limpia al desvincular       | No detecta logout desde móvil                                | Escuchar `DisconnectReason.loggedOut` y eliminar carpeta auth                                          | [Ver ejemplo](#limpiar-sesión-al-desvincular)           |
| Error 428 al enviar                      | Número no registrado                                         | Verificar formato de JID y registro en WhatsApp                                                        | `await sock.onWhatsApp(number)`                         |
| Archivos grandes fallan                  | Buffer en memoria                                            | Usar `{ stream: ... }` en lugar de Buffer                                                              | Ver docs de media                                       |
| Múltiples dispositivos                   | Sesión compartida                                            | Una sesión = un dispositivo activo                                                                     | Max 4 dispositivos vinculados                           |
| Rate limit                               | Muchos mensajes rápido                                       | Implementar cola con delays                                                                            | [Ver patrón de cola](#patrón-procesar-mensajes-en-cola) |
| Media no descarga                        | Mensaje muy antiguo                                          | Usar `sock.updateMediaMessage()` para re-upload                                                        | -                                                       |

### Solución Error 405

```javascript
import { fetchLatestBaileysVersion } from '@whiskeysockets/baileys'

// IMPORTANTE: Obtener versión actualizada
const { version } = await fetchLatestBaileysVersion()

const sock = makeWASocket({
    version, // ← Incluir versión
    auth: state,
    logger,
    // Configuración crítica para evitar 405
    syncFullHistory: false,
    markOnlineOnConnect: false,
    defaultQueryTimeoutMs: undefined
})
```

### Solución Error 440

```javascript
// Variables de control
let sock = null
let isReconnecting = false

async function connectToWhatsApp() {
    // Evitar reconexiones simultáneas
    if (isReconnecting) {
        console.log('⏳ Reconexión en proceso...')
        return
    }
    
    isReconnecting = true
    
    // Cerrar socket anterior
    if (sock) {
        try {
            sock.ev.removeAllListeners()
            sock.ws.close()
        } catch (e) {}
        sock = null
    }
    
    // ... crear nuevo socket
    
    sock.ev.on('connection.update', (update) => {
        if (update.connection === 'open') {
            isReconnecting = false // Reset flag
        }
    })
    
    // Timeout de seguridad
    setTimeout(() => {
        isReconnecting = false
    }, 2000)
}
```

### Solución Error 408

```javascript
const sock = makeWASocket({
    auth: state,
    // Timeouts más generosos
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
    defaultQueryTimeoutMs: undefined
})
```

### Solución QR No Aparece

```javascript
import qrcode from 'qrcode-terminal'

const sock = makeWASocket({
    auth: state,
    // NO usar printQRInTerminal (deprecado)
    // printQRInTerminal: true // ❌ Deprecado
})

sock.ev.on('connection.update', (update) => {
    if (update.qr) {
        // Generar QR manualmente
        qrcode.generate(update.qr, { small: true })
        console.log('📱 Escanea el código QR')
    }
})
```

### Limpiar Sesión al Desvincular

```javascript
import fs from 'fs'
import { DisconnectReason } from '@whiskeysockets/baileys'

sock.ev.on('connection.update', (update) => {
    if (update.connection === 'close') {
        const statusCode = update.lastDisconnect?.error?.output?.statusCode
        
        // Usuario desvinculó desde el móvil
        if (statusCode === DisconnectReason.loggedOut) {
            console.log('🚪 Sesión cerrada desde el móvil')
            
            // Eliminar credenciales
            if (fs.existsSync('auth_info')) {
                fs.rmSync('auth_info', { recursive: true, force: true })
                console.log('✅ Credenciales eliminadas')
            }
            
            console.log('💡 Reinicia el bot para generar nuevo QR')
            process.exit(0)
        }
    }
})
```

### Ejemplo Completo sin Errores

Ver [basic-bot-example.js](./scripts/basic-bot-example.js) para un ejemplo completo y funcional que incluye todas las correcciones mencionadas.

```bash
# Ejecutar ejemplo
cd .github/skills/whatsapp-baileys/scripts
npm install @whiskeysockets/baileys pino qrcode-terminal
node basic-bot-example.js
```

## Security Best Practices

### ✅ DO

- Usar variables de entorno para configuración sensible
- Implementar rate limiting en endpoints públicos
- Validar y sanitizar todos los inputs de usuarios
- Guardar sesiones con cifrado en producción
- Implementar logs sin información sensible
- Usar HTTPS para webhooks
- Implementar autenticación en APIs

### ❌ DON'T

- Subir carpeta `auth_info_baileys/` a repositorios públicos
- Hardcodear credenciales en código
- Almacenar números de teléfono sin consentimiento
- Hacer spam o violar términos de WhatsApp
- Exponer endpoints sin autenticación
- Ignorar límites de tasa de WhatsApp
- Guardar credenciales en logs

## Performance Optimization

| Técnica                    | Impacto | Cuándo Aplicar            |
| -------------------------- | ------- | ------------------------- |
| Usar streams para media    | Alto    | Archivos >5MB             |
| Cachear metadata de grupos | Medio   | Apps con muchos grupos    |
| Implementar `getMessage`   | Alto    | Para reenvíos y encuestas |
| Cola de mensajes           | Alto    | >10 msgs/seg              |
| Lazy loading de contactos  | Medio   | >1000 contactos           |
| Comprimir imágenes         | Medio   | Envío masivo de imágenes  |
| Usar base de datos externa | Alto    | Siempre en producción     |

## Advanced Features

### Mensajes Temporales (Disappearing)

```typescript
import { WA_DEFAULT_EPHEMERAL } from '@whiskeysockets/baileys'

// Activar en el chat (7 días)
await sock.sendMessage(jid, { 
    disappearingMessagesInChat: WA_DEFAULT_EPHEMERAL 
})

// Enviar mensaje temporal
await sock.sendMessage(jid, { text: 'Hola' }, { 
    ephemeralExpiration: WA_DEFAULT_EPHEMERAL 
})
```

### Gestión de Grupos

```typescript
// Crear grupo
const group = await sock.groupCreate('Mi Grupo', participants)

// Metadata completa
const metadata = await sock.groupMetadata(groupJid)

// Modificar participantes
await sock.groupParticipantsUpdate(groupJid, [jid], 'add' | 'remove' | 'promote' | 'demote')

// Configurar grupo
await sock.groupSettingUpdate(groupJid, 'announcement') // Solo admins pueden enviar
```

### Encuestas (Polls)

```typescript
// Crear encuesta
await sock.sendMessage(jid, {
    poll: {
        name: '¿Qué prefieres?',
        values: ['Opción A', 'Opción B', 'Opción C'],
        selectableCount: 1
    }
})

// Descifrar votos
sock.ev.on('messages.update', async (updates) => {
    for(const { key, update } of updates) {
        if(update.pollUpdates) {
            const pollMsg = await getMessage(key)
            const votes = getAggregateVotesInPollMessage({
                message: pollMsg,
                pollUpdates: update.pollUpdates
            })
            console.log(votes)
        }
    }
})
```

## References

- [Guía Completa de Baileys](./references/baileys-complete-guide.md) - Documentación exhaustiva
- [Esquemas de Base de Datos](./references/database-schemas.md) - SQL y NoSQL schemas
- [Deployment Guide](./references/deployment-guide.md) - Guía de despliegue en producción
- [Multi-Sesión Guide](./references/multi-session-guide.md) - Múltiples líneas de WhatsApp (NUEVO)
- [API Reference Oficial](https://baileys.whiskeysockets.io/) - TypeScript API docs
- [Repositorio GitHub](https://github.com/WhiskeySockets/Baileys) - Código fuente
- [Discord Comunidad](https://discord.gg/WeJM5FP9GG) - Soporte de la comunidad

## Example Projects

- [Bot Simple](./templates/basic-connection.ts) - Conexión básica y recepción de mensajes
- [Bot con Comandos](./templates/bot-with-commands.ts) - Bot completo con sistema de comandos

## Version Compatibility

| Baileys Version | Node.js | Breaking Changes                                     |
| --------------- | ------- | ---------------------------------------------------- |
| 7.0.0+          | 16+     | [Migration guide](https://whiskey.so/migrate-latest) |
| 6.x             | 14+     | Multi-device API changes                             |
| 5.x             | 12+     | Legacy (deprecated)                                  |

**Nota**: Esta skill está optimizada para Baileys v7.0.0+. Consultar la guía de migración si usas versiones anteriores.

## Updates and Maintenance

Para mantener el proyecto actualizado:

```bash
# Verificar versión actual
npm list @whiskeysockets/baileys

# Actualizar a la última versión
npm update @whiskeysockets/baileys

# O instalar versión específica
npm install @whiskeysockets/baileys@latest
```

Seguir el [changelog oficial](https://github.com/WhiskeySockets/Baileys/releases) para breaking changes.

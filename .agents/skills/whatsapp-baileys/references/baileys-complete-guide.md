# Guía Completa de Baileys para Agentes de IA

## Introducción

Baileys es una librería TypeScript basada en WebSockets para interactuar con la API de WhatsApp Web. No requiere Selenium ni navegadores, ahorrando recursos significativos. Esta guía proporciona instrucciones detalladas para implementar conexiones a WhatsApp usando Baileys.

**Versión documentada:** 7.0.0-rc.9  
**Repositorio:** https://github.com/WhiskeySockets/Baileys  
**Documentación oficial:** https://baileys.wiki

---

## 1. Instalación y Configuración Inicial

### 1.1 Instalación

```bash
# Versión estable
yarn add @whiskeysockets/baileys

# O con npm
npm install @whiskeysockets/baileys

# Versión edge (últimas características, sin garantía de estabilidad)
yarn add github:WhiskeySockets/Baileys
```

### 1.2 Importación Básica

```typescript
import makeWASocket from '@whiskeysockets/baileys'
```

### 1.3 Estructura Básica del Proyecto

```
proyecto-whatsapp/
├── src/
│   ├── index.ts              # Archivo principal
│   ├── handlers/             # Manejadores de eventos
│   │   ├── messages.ts
│   │   ├── connection.ts
│   │   └── groups.ts
│   ├── services/             # Servicios de negocio
│   │   └── messageService.ts
│   └── utils/                # Utilidades
│       └── database.ts
├── auth_info_baileys/        # Carpeta de autenticación (generada automáticamente)
├── package.json
└── tsconfig.json
```

---

## 2. Conexión y Autenticación

### 2.1 Conexión con Código QR (Terminal)

```typescript
import makeWASocket, { useMultiFileAuthState, DisconnectReason, Browsers } from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'

async function connectToWhatsApp() {
    // Cargar o crear estado de autenticación
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys')
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // Mostrar QR en terminal
        browser: Browsers.ubuntu('My App'), // Personalizar nombre del navegador
    })

    // Manejar actualizaciones de conexión
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        
        if(connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut
            console.log('Conexión cerrada:', lastDisconnect?.error, 'Reconectar:', shouldReconnect)
            
            if(shouldReconnect) {
                connectToWhatsApp()
            }
        } else if(connection === 'open') {
            console.log('✅ Conexión establecida')
        }
    })

    // Guardar credenciales cuando se actualicen
    sock.ev.on('creds.update', saveCreds)

    return sock
}

connectToWhatsApp()
```

### 2.2 Conexión con Código de Emparejamiento (Sin QR)

```typescript
async function connectWithPairingCode() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys')
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, // DEBE ser false para usar código de emparejamiento
    })

    // Si no está registrado, solicitar código de emparejamiento
    if (!sock.authState.creds.registered) {
        const phoneNumber = '573001234567' // Solo números, incluir código de país
        const code = await sock.requestPairingCode(phoneNumber)
        console.log('Código de emparejamiento:', code)
        // El usuario debe ingresar este código en WhatsApp -> Dispositivos vinculados
    }

    sock.ev.on('creds.update', saveCreds)
    
    return sock
}
```

### 2.3 Conexión con QR en Página Web

```typescript
import QRCode from 'qrcode'
import express from 'express'

const app = express()
let qrCodeData = ''

async function connectWithWebQR() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys')
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
    })

    sock.ev.on('connection.update', async (update) => {
        const { qr, connection } = update
        
        if(qr) {
            // Generar QR como imagen
            qrCodeData = await QRCode.toDataURL(qr)
            console.log('QR generado, disponible en http://localhost:3000/qr')
        }
        
        if(connection === 'open') {
            qrCodeData = '' // Limpiar QR cuando se conecte
            console.log('✅ Conectado exitosamente')
        }
    })

    sock.ev.on('creds.update', saveCreds)
    
    return sock
}

// Endpoint para mostrar QR
app.get('/qr', (req, res) => {
    if(qrCodeData) {
        res.send(`<img src="${qrCodeData}" alt="QR Code">`)
    } else {
        res.send('Ya está conectado o esperando QR...')
    }
})

app.listen(3000, () => {
    console.log('Servidor web en http://localhost:3000')
    connectWithWebQR()
})
```

### 2.4 Configuración Avanzada del Socket

```typescript
const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    
    // Recibir historial completo
    syncFullHistory: true,
    browser: Browsers.macOS('Desktop'), // Para más historial
    
    // No marcar como en línea automáticamente (para recibir notificaciones en el teléfono)
    markOnlineOnConnect: false,
    
    // Función para recuperar mensajes (necesaria para reenvíos y descifrado de encuestas)
    getMessage: async (key) => {
        // Implementar recuperación desde tu base de datos
        return await getMessageFromStore(key)
    },
    
    // Cachear metadata de grupos (RECOMENDADO)
    cachedGroupMetadata: async (jid) => {
        return await getGroupMetadataFromCache(jid)
    },
})
```

---

## 3. Estructura de Mensajes Recibidos

### 3.1 Evento Principal de Mensajes

```typescript
sock.ev.on('messages.upsert', async ({ messages, type }) => {
    for (const message of messages) {
        // SIEMPRE usar un bucle para procesar todos los mensajes
        console.log('Mensaje recibido:', JSON.stringify(message, null, 2))
        
        // Estructura básica del mensaje
        const {
            key,           // Identificador del mensaje
            message: msg,  // Contenido del mensaje
            messageTimestamp,
            pushName,      // Nombre del remitente
        } = message

        // Información del remitente
        const from = key.remoteJid  // ID del chat/usuario
        const fromMe = key.fromMe   // true si el mensaje es enviado por nosotros
        const messageId = key.id    // ID único del mensaje
    }
})
```

### 3.2 Estructura Detallada del Objeto Message

```typescript
interface WAMessage {
    key: {
        remoteJid: string    // ID del chat: '5491155554444@s.whatsapp.net'
        fromMe: boolean      // Mensaje enviado por nosotros
        id: string          // ID único del mensaje
        participant?: string // En grupos, quién envió el mensaje
    }
    message?: {
        // Tipos de mensaje (solo uno estará presente)
        conversation?: string                    // Mensaje de texto simple
        extendedTextMessage?: {
            text: string
            contextInfo?: ContextInfo            // Info de respuesta, menciones, etc.
        }
        imageMessage?: ImageMessage              // Mensaje de imagen
        videoMessage?: VideoMessage              // Mensaje de video
        audioMessage?: AudioMessage              // Mensaje de audio
        documentMessage?: DocumentMessage        // Mensaje de documento
        stickerMessage?: StickerMessage          // Mensaje de sticker
        locationMessage?: LocationMessage        // Mensaje de ubicación
        contactMessage?: ContactMessage          // Mensaje de contacto
        reactionMessage?: ReactionMessage        // Reacción a un mensaje
        pollCreationMessage?: PollCreationMessage // Mensaje de encuesta
        // ... muchos más tipos
    }
    messageTimestamp: number                     // Timestamp en segundos
    pushName?: string                            // Nombre del remitente
    broadcast?: boolean                          // Si es un mensaje broadcast
    messageStubType?: number                     // Tipo de mensaje del sistema
}
```

### 3.3 Extracción del Contenido del Mensaje

```typescript
import { getContentType, downloadMediaMessage } from '@whiskeysockets/baileys'

sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const m of messages) {
        if (!m.message) continue // Ignorar mensajes sin contenido
        
        const messageType = getContentType(m.message)
        console.log('Tipo de mensaje:', messageType)
        
        // Extraer texto
        let messageText = ''
        if (messageType === 'conversation') {
            messageText = m.message.conversation
        } else if (messageType === 'extendedTextMessage') {
            messageText = m.message.extendedTextMessage.text
        }
        
        // Verificar si es respuesta a otro mensaje
        const quotedMessage = m.message[messageType]?.contextInfo?.quotedMessage
        
        // Verificar menciones
        const mentions = m.message[messageType]?.contextInfo?.mentionedJid || []
        
        console.log('Texto:', messageText)
        console.log('Es respuesta:', !!quotedMessage)
        console.log('Menciones:', mentions)
    }
})
```

### 3.4 Procesamiento de Mensajes de Media

```typescript
sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const m of messages) {
        const messageType = getContentType(m.message)
        
        if (messageType === 'imageMessage') {
            console.log('📷 Imagen recibida')
            console.log('Caption:', m.message.imageMessage.caption)
            console.log('MimeType:', m.message.imageMessage.mimetype)
            
            // Descargar imagen
            const buffer = await downloadMediaMessage(
                m,
                'buffer',
                {},
                {
                    reuploadRequest: sock.updateMediaMessage
                }
            )
            // Guardar en disco o procesar
            await fs.writeFileSync('./imagen.jpg', buffer)
        }
        
        if (messageType === 'videoMessage') {
            console.log('🎥 Video recibido')
            // Similar a imagen
        }
        
        if (messageType === 'audioMessage') {
            console.log('🎵 Audio recibido')
            // Similar a imagen
        }
    }
})
```

### 3.5 Identificación de IDs de WhatsApp (JID)

```typescript
// Formato de JIDs:
// Usuario individual: '[código país][número]@s.whatsapp.net'
// Ejemplo: '5491155554444@s.whatsapp.net'

// Grupo: '[timestamp]-[número]@g.us'
// Ejemplo: '123456789-123345@g.us'

// Lista de broadcast: '[timestamp]@broadcast'

// Estado/Historia: 'status@broadcast'

// Función para determinar tipo de chat
function getChatType(jid: string): 'user' | 'group' | 'broadcast' | 'status' {
    if (jid.endsWith('@s.whatsapp.net')) return 'user'
    if (jid.endsWith('@g.us')) return 'group'
    if (jid === 'status@broadcast') return 'status'
    if (jid.endsWith('@broadcast')) return 'broadcast'
    return 'user'
}
```

---

## 4. Envío de Mensajes

### 4.1 Métodos de Envío

El método principal es `sock.sendMessage(jid, content, options)`:

- **jid**: ID del destinatario (chat o grupo)
- **content**: Objeto con el contenido del mensaje
- **options**: Opciones adicionales (opcional)

### 4.2 Mensajes de Texto

```typescript
// Texto simple
await sock.sendMessage(jid, { text: 'Hola Mundo' })

// Texto con respuesta (quote)
await sock.sendMessage(jid, { text: 'Esta es una respuesta' }, { quoted: message })

// Texto con menciones
await sock.sendMessage(jid, {
    text: 'Hola @5491155554444',
    mentions: ['5491155554444@s.whatsapp.net']
})
```

### 4.3 Mensajes de Media

#### Imágenes

```typescript
import fs from 'fs'

// Usando Buffer
await sock.sendMessage(jid, {
    image: fs.readFileSync('./imagen.jpg'),
    caption: 'Mira esta foto'
})

// Usando URL
await sock.sendMessage(jid, {
    image: { url: './imagen.jpg' },
    caption: 'Mira esta foto'
})

// Usando Stream (RECOMENDADO para archivos grandes)
await sock.sendMessage(jid, {
    image: { stream: fs.createReadStream('./imagen.jpg') },
    caption: 'Mira esta foto'
})

// Imagen que se ve una sola vez
await sock.sendMessage(jid, {
    image: { url: './imagen.jpg' },
    viewOnce: true,
    caption: 'Solo puedes ver esto una vez'
})
```

#### Videos

```typescript
// Video normal
await sock.sendMessage(jid, {
    video: { url: './video.mp4' },
    caption: 'Mira este video',
    ptv: false  // false = video normal, true = video note (circular)
})

// GIF (realmente es un video con flag especial)
await sock.sendMessage(jid, {
    video: fs.readFileSync('./animacion.mp4'),
    gifPlayback: true,
    caption: 'GIF animado'
})
```

#### Audio

```typescript
// IMPORTANTE: Para que funcione en todos los dispositivos, convertir con ffmpeg:
// ffmpeg -i input.mp4 -avoid_negative_ts make_zero -ac 1 output.ogg

await sock.sendMessage(jid, {
    audio: { url: './audio.mp3' },
    mimetype: 'audio/mp4'
})

// Nota de voz (PTT - Push To Talk)
await sock.sendMessage(jid, {
    audio: { url: './audio.ogg' },
    mimetype: 'audio/ogg; codecs=opus',
    ptt: true  // Marca como nota de voz
})
```

#### Documentos

```typescript
await sock.sendMessage(jid, {
    document: { url: './archivo.pdf' },
    mimetype: 'application/pdf',
    fileName: 'documento.pdf'
})
```

#### Stickers

```typescript
await sock.sendMessage(jid, {
    sticker: fs.readFileSync('./sticker.webp')
})
```

### 4.4 Mensajes Especiales

#### Ubicación

```typescript
await sock.sendMessage(jid, {
    location: {
        degreesLatitude: 24.121231,
        degreesLongitude: 55.1121221
    }
})
```

#### Contacto

```typescript
const vcard = 'BEGIN:VCARD\n'
    + 'VERSION:3.0\n'
    + 'FN:Juan Pérez\n'
    + 'ORG:Mi Empresa;\n'
    + 'TEL;type=CELL;type=VOICE;waid=5491155554444:+54 911 5555 4444\n'
    + 'END:VCARD'

await sock.sendMessage(jid, {
    contacts: {
        displayName: 'Juan',
        contacts: [{ vcard }]
    }
})
```

#### Reacción

```typescript
await sock.sendMessage(jid, {
    react: {
        text: '💖', // Emoji de reacción (string vacío para quitar)
        key: message.key
    }
})
```

#### Encuesta (Poll)

```typescript
await sock.sendMessage(jid, {
    poll: {
        name: '¿Cuál prefieres?',
        values: ['Opción 1', 'Opción 2', 'Opción 3'],
        selectableCount: 1,  // Cuántas opciones se pueden seleccionar
        toAnnouncementGroup: false
    }
})
```

#### Mensaje Fijado (Pin)

```typescript
await sock.sendMessage(jid, {
    pin: {
        type: 1,      // 1 = fijar, 0 = desfijar
        time: 86400,  // Duración en segundos (86400 = 24h)
        key: message.key
    }
})
```

#### Reenviar Mensaje

```typescript
// Obtener mensaje desde store o base de datos
const msg = await getMessageFromStore(messageId)

await sock.sendMessage(jid, { forward: msg })
```

### 4.5 Mensaje con Vista Previa de Enlaces

```typescript
// Instalar dependencia: yarn add link-preview-js

await sock.sendMessage(jid, {
    text: 'Mira este repositorio: https://github.com/whiskeysockets/baileys'
})
// Baileys generará automáticamente la vista previa
```

### 4.6 Mensajes Temporales (Desaparecen)

```typescript
import { WA_DEFAULT_EPHEMERAL } from '@whiskeysockets/baileys'

// Activar mensajes temporales en el chat (7 días por defecto)
await sock.sendMessage(jid, { 
    disappearingMessagesInChat: WA_DEFAULT_EPHEMERAL 
})

// Enviar un mensaje temporal
await sock.sendMessage(
    jid, 
    { text: 'Este mensaje desaparecerá' },
    { ephemeralExpiration: WA_DEFAULT_EPHEMERAL }
)

// Desactivar mensajes temporales
await sock.sendMessage(jid, { disappearingMessagesInChat: false })
```

---

## 5. Eventos Importantes

### 5.1 Lista Completa de Eventos

```typescript
// Conexión
sock.ev.on('connection.update', (update) => {})
sock.ev.on('creds.update', saveCreds)

// Mensajes
sock.ev.on('messages.upsert', ({ messages, type }) => {})
sock.ev.on('messages.update', (updates) => {})  // Para ediciones, eliminaciones, reacciones
sock.ev.on('messages.delete', (item) => {})
sock.ev.on('message-receipt.update', (updates) => {})

// Chats
sock.ev.on('chats.upsert', (chats) => {})
sock.ev.on('chats.update', (updates) => {})
sock.ev.on('chats.delete', (deletions) => {})

// Contactos
sock.ev.on('contacts.upsert', (contacts) => {})
sock.ev.on('contacts.update', (updates) => {})

// Presencia (en línea, escribiendo, etc.)
sock.ev.on('presence.update', (presence) => {})

// Grupos
sock.ev.on('groups.upsert', (groups) => {})
sock.ev.on('groups.update', (updates) => {})
sock.ev.on('group-participants.update', (update) => {})

// Llamadas
sock.ev.on('call', (calls) => {})

// Historial
sock.ev.on('messaging-history.set', ({ chats, contacts, messages, isLatest }) => {})
```

### 5.2 Manejo de Actualizaciones de Mensajes

```typescript
// Para mensajes editados, eliminados, reacciones y votos de encuestas
sock.ev.on('messages.update', async (updates) => {
    for(const { key, update } of updates) {
        // Mensaje eliminado
        if(update.messageStubType === 68) {
            console.log('Mensaje eliminado:', key.id)
        }
        
        // Votos de encuesta
        if(update.pollUpdates) {
            const pollCreation = await getMessage(key)
            if(pollCreation) {
                const votes = getAggregateVotesInPollMessage({
                    message: pollCreation,
                    pollUpdates: update.pollUpdates,
                })
                console.log('Votos de encuesta:', votes)
            }
        }
        
        // Mensaje editado
        if(update.editedMessage) {
            console.log('Mensaje editado:', update.editedMessage)
        }
    }
})
```

### 5.3 Manejo de Presencia

```typescript
// Suscribirse a actualizaciones de presencia
await sock.presenceSubscribe(jid)

// Recibir actualizaciones
sock.ev.on('presence.update', ({ id, presences }) => {
    console.log('Presencia en', id)
    for(const [jid, presence] of Object.entries(presences)) {
        console.log(`${jid}: ${presence.lastKnownPresence}`)
        // Valores: 'available', 'unavailable', 'composing', 'recording', etc.
    }
})

// Enviar tu propia presencia
await sock.sendPresenceUpdate('available', jid)  // En línea
await sock.sendPresenceUpdate('composing', jid)  // Escribiendo
await sock.sendPresenceUpdate('recording', jid)  // Grabando audio
await sock.sendPresenceUpdate('unavailable')     // Fuera de línea
```

---

## 6. Operaciones Avanzadas

### 6.1 Modificar Mensajes

```typescript
// Editar mensaje
const sentMsg = await sock.sendMessage(jid, { text: 'Texto original' })
await sock.sendMessage(jid, {
    text: 'Texto editado',
    edit: sentMsg.key
})

// Eliminar mensaje para todos
await sock.sendMessage(jid, { delete: sentMsg.key })

// Marcar mensajes como leídos
await sock.readMessages([message.key])
```

### 6.2 Operaciones de Chat

```typescript
// Archivar chat
const lastMsg = await getLastMessageInChat(jid)
await sock.chatModify({ archive: true, lastMessages: [lastMsg] }, jid)

// Silenciar chat (8 horas)
await sock.chatModify({ mute: 8 * 60 * 60 * 1000 }, jid)

// Dessilenciar
await sock.chatModify({ mute: null }, jid)

// Fijar chat
await sock.chatModify({ pin: true }, jid)

// Marcar como no leído
await sock.chatModify({ markRead: false, lastMessages: [lastMsg] }, jid)

// Eliminar chat
await sock.chatModify({ delete: true, lastMessages: [lastMsg] }, jid)
```

### 6.3 Operaciones de Grupos

```typescript
// Crear grupo
const group = await sock.groupCreate('Mi Grupo', [
    '5491155554444@s.whatsapp.net',
    '5491166665555@s.whatsapp.net'
])
console.log('Grupo creado:', group.id)

// Obtener metadata del grupo
const metadata = await sock.groupMetadata(groupJid)
console.log('Nombre:', metadata.subject)
console.log('Descripción:', metadata.desc)
console.log('Participantes:', metadata.participants)

// Agregar participantes
await sock.groupParticipantsUpdate(
    groupJid,
    ['5491177778888@s.whatsapp.net'],
    'add'
)

// Remover participantes
await sock.groupParticipantsUpdate(groupJid, ['...'], 'remove')

// Promover a admin
await sock.groupParticipantsUpdate(groupJid, ['...'], 'promote')

// Degradar de admin
await sock.groupParticipantsUpdate(groupJid, ['...'], 'demote')

// Cambiar nombre del grupo
await sock.groupUpdateSubject(groupJid, 'Nuevo Nombre')

// Cambiar descripción
await sock.groupUpdateDescription(groupJid, 'Nueva descripción')

// Cambiar configuración (solo admins pueden enviar)
await sock.groupSettingUpdate(groupJid, 'announcement')

// Todos pueden enviar
await sock.groupSettingUpdate(groupJid, 'not_announcement')

// Solo admins pueden editar info
await sock.groupSettingUpdate(groupJid, 'locked')

// Todos pueden editar info
await sock.groupSettingUpdate(groupJid, 'unlocked')

// Salir del grupo
await sock.groupLeave(groupJid)

// Obtener código de invitación
const code = await sock.groupInviteCode(groupJid)
const link = `https://chat.whatsapp.com/${code}`

// Revocar código de invitación
const newCode = await sock.groupRevokeInvite(groupJid)

// Unirse usando código
await sock.groupAcceptInvite(code)
```

### 6.4 Consultas de Usuario

```typescript
// Verificar si un número existe en WhatsApp
const [result] = await sock.onWhatsApp('5491155554444')
if (result?.exists) {
    console.log('El número existe con JID:', result.jid)
}

// Obtener estado
const status = await sock.fetchStatus(jid)
console.log('Estado:', status)

// Obtener foto de perfil
const ppUrl = await sock.profilePictureUrl(jid, 'image') // 'image' para alta resolución
console.log('URL de foto de perfil:', ppUrl)

// Obtener perfil de negocio
const businessProfile = await sock.getBusinessProfile(jid)
console.log('Descripción:', businessProfile.description)
console.log('Categoría:', businessProfile.category)
```

---

## 7. Implementación de Store (Base de Datos)

### 7.1 Store en Memoria (Solo para Testing)

```typescript
import makeWASocket, { makeInMemoryStore } from '@whiskeysockets/baileys'

const store = makeInMemoryStore({})

// Leer desde archivo
store.readFromFile('./baileys_store.json')

// Guardar periódicamente
setInterval(() => {
    store.writeToFile('./baileys_store.json')
}, 10_000)

// Vincular al socket
const sock = makeWASocket({})
store.bind(sock.ev)

// Acceder a datos
sock.ev.on('chats.upsert', () => {
    console.log('Chats:', store.chats.all())
})

sock.ev.on('contacts.upsert', () => {
    console.log('Contactos:', Object.values(store.contacts))
})
```

### 7.2 Arquitectura de Base de Datos Propuesta

#### Esquema SQL (PostgreSQL/MySQL)

```sql
-- Tabla de sesiones (autenticación)
CREATE TABLE sessions (
    id VARCHAR(50) PRIMARY KEY,
    session_data TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabla de chats
CREATE TABLE chats (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255),
    type ENUM('user', 'group', 'broadcast') NOT NULL,
    timestamp BIGINT,
    unread_count INT DEFAULT 0,
    archived BOOLEAN DEFAULT FALSE,
    pinned BOOLEAN DEFAULT FALSE,
    muted_until BIGINT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabla de contactos
CREATE TABLE contacts (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255),
    notify VARCHAR(255),
    verified_name VARCHAR(255),
    imgUrl TEXT,
    status TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabla de mensajes
CREATE TABLE messages (
    id VARCHAR(100) PRIMARY KEY,
    chat_id VARCHAR(100) NOT NULL,
    sender_id VARCHAR(100),
    message_type VARCHAR(50) NOT NULL,
    content TEXT,
    media_url TEXT,
    media_mimetype VARCHAR(100),
    caption TEXT,
    timestamp BIGINT NOT NULL,
    from_me BOOLEAN DEFAULT FALSE,
    status VARCHAR(20), -- 'pending', 'sent', 'delivered', 'read', 'failed'
    quoted_message_id VARCHAR(100),
    mentions JSON,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    INDEX idx_chat_timestamp (chat_id, timestamp),
    INDEX idx_sender (sender_id)
);

-- Tabla de grupos (metadata adicional)
CREATE TABLE groups (
    id VARCHAR(100) PRIMARY KEY,
    subject VARCHAR(255) NOT NULL,
    subject_owner VARCHAR(100),
    subject_time BIGINT,
    description TEXT,
    description_owner VARCHAR(100),
    description_time BIGINT,
    creation_time BIGINT,
    owner VARCHAR(100),
    invite_code VARCHAR(50),
    announce BOOLEAN DEFAULT FALSE,
    restrict BOOLEAN DEFAULT FALSE,
    size INT,
    metadata JSON,
    FOREIGN KEY (id) REFERENCES chats(id) ON DELETE CASCADE
);

-- Tabla de participantes de grupos
CREATE TABLE group_participants (
    group_id VARCHAR(100) NOT NULL,
    participant_id VARCHAR(100) NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    is_super_admin BOOLEAN DEFAULT FALSE,
    joined_at BIGINT,
    PRIMARY KEY (group_id, participant_id),
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
);

-- Tabla de keys de autenticación (para useMultiFileAuthState)
CREATE TABLE auth_keys (
    id VARCHAR(255) PRIMARY KEY,
    key_data TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabla de media descargada (opcional, para cache)
CREATE TABLE media_cache (
    message_id VARCHAR(100) PRIMARY KEY,
    file_path TEXT NOT NULL,
    mimetype VARCHAR(100),
    size BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- Tabla de logs (opcional, para debugging)
CREATE TABLE logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    level VARCHAR(20),
    message TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_level_time (level, created_at)
);
```

#### Esquema NoSQL (MongoDB)

```javascript
// Colección: sessions
{
    _id: "session_id",
    creds: {},
    keys: {},
    updatedAt: Date
}

// Colección: chats
{
    _id: "5491155554444@s.whatsapp.net",
    name: "Juan Pérez",
    type: "user", // 'user', 'group', 'broadcast'
    conversationTimestamp: 1234567890,
    unreadCount: 5,
    archived: false,
    pinned: false,
    mutedUntil: null,
    metadata: {},
    createdAt: Date,
    updatedAt: Date
}

// Colección: contacts
{
    _id: "5491155554444@s.whatsapp.net",
    name: "Juan Pérez",
    notify: "Juan",
    verifiedName: null,
    imgUrl: "https://...",
    status: "Hola, estoy usando WhatsApp",
    createdAt: Date,
    updatedAt: Date
}

// Colección: messages
{
    _id: "3EB0XXXXX",
    chatId: "5491155554444@s.whatsapp.net",
    senderId: "5491155554444@s.whatsapp.net",
    messageType: "conversation",
    content: "Hola, ¿cómo estás?",
    mediaUrl: null,
    mediaMimetype: null,
    caption: null,
    timestamp: 1234567890,
    fromMe: false,
    status: "read",
    quotedMessageId: null,
    mentions: [],
    metadata: {
        // Almacenar el objeto completo del mensaje para recuperación
        fullMessage: {}
    },
    createdAt: Date,
    indexes: [
        { chatId: 1, timestamp: -1 },
        { senderId: 1 }
    ]
}

// Colección: groups
{
    _id: "123456789-123345@g.us",
    subject: "Mi Grupo",
    description: "Descripción del grupo",
    owner: "5491155554444@s.whatsapp.net",
    participants: [
        {
            id: "5491155554444@s.whatsapp.net",
            isAdmin: true,
            isSuperAdmin: true,
            joinedAt: 1234567890
        }
    ],
    inviteCode: "ABC123XYZ",
    announce: false,
    restrict: false,
    createdAt: Date,
    updatedAt: Date
}
```

### 7.3 Implementación de AuthState Personalizado

```typescript
import { proto } from '@whiskeysockets/baileys'
import { BufferJSON, initAuthCreds } from '@whiskeysockets/baileys'

// Ejemplo con MongoDB
async function useMongoDBAuthState(sessionId: string) {
    const Session = mongoose.model('Session')
    
    // Cargar o crear credenciales
    let session = await Session.findById(sessionId)
    if (!session) {
        const creds = initAuthCreds()
        session = await Session.create({
            _id: sessionId,
            creds: JSON.stringify(creds, BufferJSON.replacer),
            keys: {}
        })
    }
    
    const creds = JSON.parse(session.creds, BufferJSON.reviver)
    
    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {}
                    for (const id of ids) {
                        const key = `${type}-${id}`
                        if (session.keys[key]) {
                            data[id] = JSON.parse(session.keys[key], BufferJSON.reviver)
                        }
                    }
                    return data
                },
                set: async (data) => {
                    for (const category in data) {
                        for (const id in data[category]) {
                            const key = `${category}-${id}`
                            const value = JSON.stringify(data[category][id], BufferJSON.replacer)
                            session.keys[key] = value
                        }
                    }
                    await session.save()
                }
            }
        },
        saveCreds: async () => {
            session.creds = JSON.stringify(creds, BufferJSON.replacer)
            await session.save()
        }
    }
}

// Uso
const { state, saveCreds } = await useMongoDBAuthState('my-session')
const sock = makeWASocket({ auth: state })
sock.ev.on('creds.update', saveCreds)
```

### 7.4 Implementación de Store para Mensajes

```typescript
class MessageStore {
    constructor(private db: Database) {}
    
    async saveMessage(msg: WAMessage) {
        const messageType = getContentType(msg.message)
        let content = ''
        
        if (messageType === 'conversation') {
            content = msg.message.conversation
        } else if (messageType === 'extendedTextMessage') {
            content = msg.message.extendedTextMessage.text
        }
        
        await this.db.messages.create({
            id: msg.key.id,
            chatId: msg.key.remoteJid,
            senderId: msg.key.fromMe ? 'me' : (msg.key.participant || msg.key.remoteJid),
            messageType,
            content,
            timestamp: msg.messageTimestamp,
            fromMe: msg.key.fromMe,
            status: 'received',
            metadata: JSON.stringify(msg, BufferJSON.replacer)
        })
    }
    
    async getMessage(key: WAMessageKey): Promise<WAMessage | null> {
        const msg = await this.db.messages.findOne({ id: key.id })
        if (!msg) return null
        
        return JSON.parse(msg.metadata, BufferJSON.reviver)
    }
    
    async getMessages(chatId: string, limit = 50, before?: number) {
        const query: any = { chatId }
        if (before) query.timestamp = { $lt: before }
        
        return await this.db.messages
            .find(query)
            .sort({ timestamp: -1 })
            .limit(limit)
    }
}

// Uso
const store = new MessageStore(database)

sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
        await store.saveMessage(msg)
    }
})

// Configurar getMessage para el socket
const sock = makeWASocket({
    getMessage: async (key) => await store.getMessage(key)
})
```

---

## 8. Manejo de Errores y Reconexión

### 8.1 Códigos de Desconexión

```typescript
import { DisconnectReason } from '@whiskeysockets/baileys'

sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update
    
    if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
        
        switch(statusCode) {
            case DisconnectReason.badSession:
                console.log('Sesión incorrecta, eliminar y escanear de nuevo')
                // Eliminar carpeta auth_info_baileys
                break
            
            case DisconnectReason.connectionClosed:
                console.log('Conexión cerrada, reconectando...')
                connectToWhatsApp()
                break
            
            case DisconnectReason.connectionLost:
                console.log('Conexión perdida del servidor, reconectando...')
                connectToWhatsApp()
                break
            
            case DisconnectReason.connectionReplaced:
                console.log('Conexión reemplazada, otra sesión abierta')
                // No reconectar automáticamente
                break
            
            case DisconnectReason.loggedOut:
                console.log('Dispositivo desconectado, eliminar sesión y escanear de nuevo')
                // Eliminar auth_info_baileys y reiniciar
                break
            
            case DisconnectReason.restartRequired:
                console.log('Reinicio requerido, reconectando...')
                connectToWhatsApp()
                break
            
            case DisconnectReason.timedOut:
                console.log('Tiempo de conexión agotado, reconectando...')
                connectToWhatsApp()
                break
            
            default:
                console.log('Desconexión desconocida:', statusCode)
                connectToWhatsApp()
        }
    }
})
```

### 8.2 Manejo de Errores en Envío de Mensajes

```typescript
async function sendMessageSafe(jid: string, content: any, options?: any) {
    try {
        const result = await sock.sendMessage(jid, content, options)
        console.log('Mensaje enviado:', result.key.id)
        return result
    } catch (error) {
        console.error('Error al enviar mensaje:', error)
        
        if (error.output?.statusCode === 428) {
            console.log('Número no registrado en WhatsApp')
        } else if (error.output?.statusCode === 403) {
            console.log('Bloqueado por el destinatario')
        } else if (error.message.includes('rate limit')) {
            console.log('Límite de tasa alcanzado, esperar antes de enviar más')
        }
        
        throw error
    }
}
```

---

## 9. Ejemplo Completo de Bot

```typescript
import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    getContentType,
    downloadMediaMessage
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'

class WhatsAppBot {
    private sock: any
    private logger = pino({ level: 'silent' })
    
    async start() {
        await this.connect()
    }
    
    private async connect() {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys')
        
        this.sock = makeWASocket({
            auth: state,
            logger: this.logger,
            printQRInTerminal: true,
            browser: ['WhatsApp Bot', 'Chrome', '1.0.0'],
            getMessage: async (key) => await this.getMessage(key)
        })
        
        this.sock.ev.on('connection.update', this.handleConnectionUpdate.bind(this))
        this.sock.ev.on('creds.update', saveCreds)
        this.sock.ev.on('messages.upsert', this.handleMessages.bind(this))
    }
    
    private handleConnectionUpdate(update: any) {
        const { connection, lastDisconnect } = update
        
        if (connection === 'close') {
            const shouldReconnect = 
                (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut
            
            if (shouldReconnect) {
                console.log('Reconectando...')
                this.connect()
            }
        } else if (connection === 'open') {
            console.log('✅ Conectado a WhatsApp')
        }
    }
    
    private async handleMessages({ messages, type }: any) {
        for (const msg of messages) {
            if (!msg.message) continue
            if (msg.key.fromMe) continue // Ignorar mensajes propios
            
            const messageType = getContentType(msg.message)
            const from = msg.key.remoteJid
            const sender = msg.key.participant || from
            
            // Extraer texto
            let text = ''
            if (messageType === 'conversation') {
                text = msg.message.conversation
            } else if (messageType === 'extendedTextMessage') {
                text = msg.message.extendedTextMessage.text
            }
            
            console.log(`Mensaje de ${sender}: ${text}`)
            
            // Comandos del bot
            await this.processCommand(from, sender, text, msg)
        }
    }
    
    private async processCommand(chatId: string, sender: string, text: string, msg: any) {
        text = text.toLowerCase().trim()
        
        if (text === '!ping') {
            await this.sock.sendMessage(chatId, { text: '🏓 Pong!' })
        }
        
        else if (text === '!info') {
            await this.sock.sendMessage(chatId, {
                text: `📱 *Bot de WhatsApp*\n\n` +
                      `Chat ID: ${chatId}\n` +
                      `Tu ID: ${sender}\n` +
                      `Hora: ${new Date().toLocaleString()}`
            })
        }
        
        else if (text === '!sticker') {
            // Responder "envía una imagen para convertirla en sticker"
            await this.sock.sendMessage(chatId, {
                text: 'Envía una imagen con el comando para convertirla en sticker'
            }, { quoted: msg })
        }
        
        else if (text.startsWith('!echo ')) {
            const echoText = text.substring(6)
            await this.sock.sendMessage(chatId, { text: echoText }, { quoted: msg })
        }
        
        else if (text === '!help') {
            await this.sock.sendMessage(chatId, {
                text: `🤖 *Comandos Disponibles*\n\n` +
                      `!ping - Verificar si el bot está activo\n` +
                      `!info - Información del chat\n` +
                      `!echo [texto] - Repetir un mensaje\n` +
                      `!sticker - Crear sticker de imagen\n` +
                      `!help - Mostrar esta ayuda`
            })
        }
    }
    
    private async getMessage(key: any) {
        // Implementar recuperación desde base de datos
        return null
    }
}

// Iniciar bot
const bot = new WhatsAppBot()
bot.start().catch(console.error)
```

---

## 10. Mejores Prácticas y Recomendaciones

### 10.1 Seguridad

1. **Nunca exponer credenciales**: No subir la carpeta `auth_info_baileys` a repositorios públicos
2. **Validar entrada de usuario**: Siempre validar y sanitizar inputs
3. **Rate limiting**: Implementar límites para evitar spam
4. **Logs seguros**: No registrar información sensible en logs

### 10.2 Rendimiento

1. **Usar streams para archivos grandes**: Preferir `{ stream: ... }` sobre buffers
2. **Implementar caché**: Cachear metadata de grupos y contactos
3. **Procesar mensajes de forma asíncrona**: No bloquear el event loop
4. **Limitar almacenamiento en memoria**: Usar base de datos, no store en memoria

### 10.3 Confiabilidad

1. **Implementar reconexión automática**: Manejar todos los casos de desconexión
2. **Guardar estado frecuentemente**: Usar `creds.update` correctamente
3. **Manejar errores gracefully**: Try-catch en operaciones críticas
4. **Implementar cola de mensajes**: Para reintentos en caso de fallo

### 10.4 Cumplimiento

1. **Respetar términos de servicio de WhatsApp**: No hacer spam
2. **Implementar opt-in/opt-out**: Permitir a usuarios desuscribirse
3. **Límites de mensajes**: No exceder límites razonables
4. **Privacidad**: No almacenar datos sensibles sin consentimiento

---

## 11. Recursos Adicionales

- **Documentación oficial**: https://baileys.wiki
- **Repositorio GitHub**: https://github.com/WhiskeySockets/Baileys
- **Discord de la comunidad**: https://discord.gg/WeJM5FP9GG
- **Guía de migración a v7**: https://whiskey.so/migrate-latest
- **API Reference**: https://baileys.whiskeysockets.io/

---

## 12. Solución de Problemas Comunes

### Problema: QR no se genera

**Solución**: Asegurarse de que `printQRInTerminal: true` y eliminar carpeta de autenticación anterior.

### Problema: Mensajes no se reciben

**Solución**: Verificar que el evento `messages.upsert` esté correctamente configurado y usar un bucle para procesar todos los mensajes.

### Problema: No se pueden enviar archivos grandes

**Solución**: Usar `{ stream: ... }` en lugar de buffers y verificar límites de tamaño de WhatsApp.

### Problema: Sesión se cierra constantemente

**Solución**: Verificar que `creds.update` esté guardando correctamente y no tener múltiples instancias con la misma sesión.

### Problema: "This phone number is not registered"

**Solución**: Verificar que el número incluya código de país y que esté registrado en WhatsApp.

---

## Conclusión

Esta guía proporciona una base completa para implementar un sistema de WhatsApp usando Baileys. Recuerda siempre:

1. Implementar un sistema de almacenamiento robusto (base de datos)
2. Manejar errores y reconexiones adecuadamente
3. Respetar los términos de servicio de WhatsApp
4. Mantener la seguridad de las credenciales
5. Optimizar el rendimiento con streams y caché

Para casos de uso específicos, consulta la documentación oficial y la comunidad en Discord.

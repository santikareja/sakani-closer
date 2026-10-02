# Esquemas de Base de Datos para WhatsApp Baileys

Arquitecturas de almacenamiento recomendadas para guardar mensajes, sesiones y metadata de WhatsApp.

## Tabla de Contenidos

- [SQL (PostgreSQL/MySQL)](#sql-postgresqlmysql)
- [NoSQL (MongoDB)](#nosql-mongodb)
- [Implementación de AuthState Personalizado](#implementación-de-authstate-personalizado)
- [Índices Recomendados](#índices-recomendados)
- [Estrategias de Backup](#estrategias-de-backup)

---

## SQL (PostgreSQL/MySQL)

### Diagrama de Relaciones

```
sessions (1) -------- (N) auth_keys
chats (1) ----------- (N) messages
chats (1) ----------- (1) groups
groups (1) ---------- (N) group_participants
contacts (1) --------- (N) messages (FK: sender_id)
messages (1) --------- (1) media_cache
```

### Tablas Principales

#### 1. sessions
Almacena sesiones de WhatsApp

```sql
CREATE TABLE sessions (
    id VARCHAR(50) PRIMARY KEY,
    phone_number VARCHAR(20),
    session_data TEXT NOT NULL,
    status ENUM('active', 'disconnected', 'logged_out') DEFAULT 'active',
    last_connected TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_status (status),
    INDEX idx_phone (phone_number)
);
```

#### 2. auth_keys
Almacena keys de autenticación (para `useMultiFileAuthState`)

```sql
CREATE TABLE auth_keys (
    id VARCHAR(255) PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL,
    key_type VARCHAR(50) NOT NULL, -- 'pre-key', 'session', 'sender-key', etc.
    key_data TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    INDEX idx_session_type (session_id, key_type)
);
```

#### 3. chats
Almacena información de conversaciones

```sql
CREATE TABLE chats (
    id VARCHAR(100) PRIMARY KEY, -- JID
    session_id VARCHAR(50) NOT NULL,
    name VARCHAR(255),
    type ENUM('user', 'group', 'broadcast', 'status') NOT NULL,
    conversation_timestamp BIGINT,
    unread_count INT DEFAULT 0,
    archived BOOLEAN DEFAULT FALSE,
    pinned BOOLEAN DEFAULT FALSE,
    muted_until BIGINT DEFAULT NULL,
    last_message_id VARCHAR(100),
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    INDEX idx_session (session_id),
    INDEX idx_type (type),
    INDEX idx_timestamp (conversation_timestamp DESC),
    INDEX idx_pinned_archived (pinned, archived)
);
```

#### 4. contacts
Almacena contactos

```sql
CREATE TABLE contacts (
    id VARCHAR(100) PRIMARY KEY, -- JID
    session_id VARCHAR(50) NOT NULL,
    name VARCHAR(255),
    notify VARCHAR(255),
    verified_name VARCHAR(255),
    img_url TEXT,
    status TEXT,
    is_blocked BOOLEAN DEFAULT FALSE,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    INDEX idx_session (session_id),
    INDEX idx_name (name)
);
```

#### 5. messages
Almacena mensajes

```sql
CREATE TABLE messages (
    id VARCHAR(100) PRIMARY KEY,
    chat_id VARCHAR(100) NOT NULL,
    session_id VARCHAR(50) NOT NULL,
    sender_id VARCHAR(100),
    message_type VARCHAR(50) NOT NULL,
    content TEXT,
    media_url TEXT,
    media_mimetype VARCHAR(100),
    media_size BIGINT,
    caption TEXT,
    timestamp BIGINT NOT NULL,
    from_me BOOLEAN DEFAULT FALSE,
    status ENUM('pending', 'sent', 'delivered', 'read', 'failed', 'deleted') DEFAULT 'sent',
    quoted_message_id VARCHAR(100),
    mentions JSON,
    is_forwarded BOOLEAN DEFAULT FALSE,
    forward_score INT DEFAULT 0,
    broadcast BOOLEAN DEFAULT FALSE,
    metadata JSON, -- Almacenar mensaje completo serializado
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (quoted_message_id) REFERENCES messages(id) ON DELETE SET NULL,
    
    INDEX idx_chat_timestamp (chat_id, timestamp DESC),
    INDEX idx_sender (sender_id),
    INDEX idx_session (session_id),
    INDEX idx_type (message_type),
    INDEX idx_status (status),
    INDEX idx_from_me (from_me)
);
```

#### 6. groups
Metadata adicional para grupos

```sql
CREATE TABLE groups (
    id VARCHAR(100) PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    subject_owner VARCHAR(100),
    subject_time BIGINT,
    description TEXT,
    description_owner VARCHAR(100),
    description_time BIGINT,
    creation_time BIGINT,
    owner VARCHAR(100),
    invite_code VARCHAR(50),
    announce BOOLEAN DEFAULT FALSE, -- Solo admins envían mensajes
    restrict BOOLEAN DEFAULT FALSE, -- Solo admins editan info
    size INT DEFAULT 0,
    ephemeral_duration INT DEFAULT 0, -- Mensajes temporales
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (id) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    INDEX idx_session (session_id),
    INDEX idx_invite (invite_code)
);
```

#### 7. group_participants
Participantes de grupos

```sql
CREATE TABLE group_participants (
    group_id VARCHAR(100) NOT NULL,
    participant_id VARCHAR(100) NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    is_super_admin BOOLEAN DEFAULT FALSE,
    joined_at BIGINT,
    PRIMARY KEY (group_id, participant_id),
    
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    INDEX idx_admin (is_admin),
    INDEX idx_participant (participant_id)
);
```

#### 8. media_cache
Cache de archivos multimedia descargados

```sql
CREATE TABLE media_cache (
    message_id VARCHAR(100) PRIMARY KEY,
    file_path TEXT NOT NULL,
    file_name VARCHAR(255),
    mimetype VARCHAR(100),
    size BIGINT,
    thumbnail_path TEXT,
    downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    INDEX idx_mimetype (mimetype)
);
```

---

## NoSQL (MongoDB)

### Colecciones

#### 1. sessions

```javascript
{
    _id: "session_id_unique",
    phoneNumber: "+5491155554444",
    creds: {
        // Credenciales serializadas con BufferJSON
    },
    status: "active", // 'active', 'disconnected', 'logged_out'
    lastConnected: ISODate("2026-01-29T10:00:00Z"),
    createdAt: ISODate("2026-01-01T00:00:00Z"),
    updatedAt: ISODate("2026-01-29T10:00:00Z")
}

// Índices
db.sessions.createIndex({ phoneNumber: 1 })
db.sessions.createIndex({ status: 1 })
```

#### 2. auth_keys

```javascript
{
    _id: "pre-key:1:session_id",
    sessionId: "session_id_unique",
    keyType: "pre-key", // 'pre-key', 'session', 'sender-key', etc.
    keyId: "1",
    keyData: {
        // Key serializada con BufferJSON
    },
    createdAt: ISODate("2026-01-01T00:00:00Z"),
    updatedAt: ISODate("2026-01-29T10:00:00Z")
}

// Índices
db.auth_keys.createIndex({ sessionId: 1, keyType: 1 })
```

#### 3. chats

```javascript
{
    _id: "5491155554444@s.whatsapp.net",
    sessionId: "session_id_unique",
    name: "Juan Pérez",
    type: "user", // 'user', 'group', 'broadcast', 'status'
    conversationTimestamp: 1706515200,
    unreadCount: 3,
    archived: false,
    pinned: true,
    mutedUntil: null,
    lastMessageId: "3EB0XXXXX",
    metadata: {},
    createdAt: ISODate("2026-01-01T00:00:00Z"),
    updatedAt: ISODate("2026-01-29T10:00:00Z")
}

// Índices
db.chats.createIndex({ sessionId: 1 })
db.chats.createIndex({ type: 1 })
db.chats.createIndex({ conversationTimestamp: -1 })
db.chats.createIndex({ sessionId: 1, pinned: -1, conversationTimestamp: -1 })
```

#### 4. contacts

```javascript
{
    _id: "5491155554444@s.whatsapp.net",
    sessionId: "session_id_unique",
    name: "Juan Pérez",
    notify: "Juan",
    verifiedName: null,
    imgUrl: "https://...",
    status: "Hola, estoy usando WhatsApp",
    isBlocked: false,
    createdAt: ISODate("2026-01-01T00:00:00Z"),
    updatedAt: ISODate("2026-01-29T10:00:00Z")
}

// Índices
db.contacts.createIndex({ sessionId: 1 })
db.contacts.createIndex({ name: "text" })
```

#### 5. messages

```javascript
{
    _id: "3EB0XXXXX",
    chatId: "5491155554444@s.whatsapp.net",
    sessionId: "session_id_unique",
    senderId: "5491155554444@s.whatsapp.net",
    messageType: "conversation",
    content: "Hola, ¿cómo estás?",
    mediaUrl: null,
    mediaMimetype: null,
    mediaSize: null,
    caption: null,
    timestamp: 1706515200,
    fromMe: false,
    status: "read", // 'pending', 'sent', 'delivered', 'read', 'failed', 'deleted'
    quotedMessageId: null,
    mentions: [],
    isForwarded: false,
    forwardScore: 0,
    broadcast: false,
    metadata: {
        // Mensaje completo serializado con BufferJSON para recuperación
        fullMessage: {}
    },
    createdAt: ISODate("2026-01-29T10:00:00Z"),
    updatedAt: ISODate("2026-01-29T10:00:00Z")
}

// Índices
db.messages.createIndex({ chatId: 1, timestamp: -1 })
db.messages.createIndex({ senderId: 1 })
db.messages.createIndex({ sessionId: 1 })
db.messages.createIndex({ messageType: 1 })
db.messages.createIndex({ status: 1 })
db.messages.createIndex({ quotedMessageId: 1 })
```

#### 6. groups

```javascript
{
    _id: "123456789-123345@g.us",
    sessionId: "session_id_unique",
    subject: "Mi Grupo de Trabajo",
    subjectOwner: "5491155554444@s.whatsapp.net",
    subjectTime: 1706515200,
    description: "Grupo para coordinar el proyecto",
    descriptionOwner: "5491155554444@s.whatsapp.net",
    descriptionTime: 1706515200,
    creationTime: 1706515200,
    owner: "5491155554444@s.whatsapp.net",
    participants: [
        {
            id: "5491155554444@s.whatsapp.net",
            isAdmin: true,
            isSuperAdmin: true,
            joinedAt: 1706515200
        },
        {
            id: "5491166665555@s.whatsapp.net",
            isAdmin: false,
            isSuperAdmin: false,
            joinedAt: 1706515300
        }
    ],
    inviteCode: "ABC123XYZ",
    announce: false,
    restrict: false,
    size: 25,
    ephemeralDuration: 0,
    createdAt: ISODate("2026-01-01T00:00:00Z"),
    updatedAt: ISODate("2026-01-29T10:00:00Z")
}

// Índices
db.groups.createIndex({ sessionId: 1 })
db.groups.createIndex({ inviteCode: 1 })
db.groups.createIndex({ "participants.id": 1 })
```

#### 7. media_cache

```javascript
{
    _id: "3EB0XXXXX", // messageId
    filePath: "/path/to/media/3EB0XXXXX.jpg",
    fileName: "imagen-recibida.jpg",
    mimetype: "image/jpeg",
    size: 1024567,
    thumbnailPath: "/path/to/media/thumbs/3EB0XXXXX.jpg",
    downloadedAt: ISODate("2026-01-29T10:00:00Z")
}

// Índices
db.media_cache.createIndex({ mimetype: 1 })
db.media_cache.createIndex({ downloadedAt: -1 })
```

---

## Implementación de AuthState Personalizado

### MongoDB Example

```typescript
import { AuthenticationState, SignalDataTypeMap } from '@whiskeysockets/baileys'
import { BufferJSON, initAuthCreds } from '@whiskeysockets/baileys'
import { MongoClient } from 'mongodb'

async function useMongoDBAuthState(sessionId: string, mongoClient: MongoClient) {
    const db = mongoClient.db('whatsapp')
    const sessionsCollection = db.collection('sessions')
    const keysCollection = db.collection('auth_keys')
    
    // Cargar o crear sesión
    let session = await sessionsCollection.findOne({ _id: sessionId })
    
    if (!session) {
        const creds = initAuthCreds()
        session = {
            _id: sessionId,
            creds: JSON.stringify(creds, BufferJSON.replacer),
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
        }
        await sessionsCollection.insertOne(session)
    }
    
    const creds = JSON.parse(session.creds, BufferJSON.reviver)
    
    return {
        state: {
            creds,
            keys: {
                get: async (type: string, ids: string[]) => {
                    const data: any = {}
                    
                    const keys = await keysCollection.find({
                        sessionId,
                        keyType: type,
                        keyId: { $in: ids }
                    }).toArray()
                    
                    for (const key of keys) {
                        data[key.keyId] = JSON.parse(
                            JSON.stringify(key.keyData),
                            BufferJSON.reviver
                        )
                    }
                    
                    return data
                },
                
                set: async (data: SignalDataTypeMap) => {
                    const operations = []
                    
                    for (const category in data) {
                        for (const id in data[category]) {
                            const keyData = data[category][id]
                            
                            operations.push({
                                updateOne: {
                                    filter: {
                                        _id: `${category}:${id}:${sessionId}`,
                                        sessionId,
                                        keyType: category,
                                        keyId: id
                                    },
                                    update: {
                                        $set: {
                                            keyData: JSON.parse(
                                                JSON.stringify(keyData, BufferJSON.replacer)
                                            ),
                                            updatedAt: new Date()
                                        },
                                        $setOnInsert: {
                                            createdAt: new Date()
                                        }
                                    },
                                    upsert: true
                                }
                            })
                        }
                    }
                    
                    if (operations.length > 0) {
                        await keysCollection.bulkWrite(operations)
                    }
                }
            }
        } as AuthenticationState,
        
        saveCreds: async () => {
            await sessionsCollection.updateOne(
                { _id: sessionId },
                {
                    $set: {
                        creds: JSON.stringify(creds, BufferJSON.replacer),
                        updatedAt: new Date()
                    }
                }
            )
        }
    }
}

// Uso
const client = new MongoClient('mongodb://localhost:27017')
await client.connect()

const { state, saveCreds } = await useMongoDBAuthState('my-session', client)

const sock = makeWASocket({ auth: state })
sock.ev.on('creds.update', saveCreds)
```

### PostgreSQL Example

```typescript
import { Pool } from 'pg'
import { AuthenticationState, SignalDataTypeMap } from '@whiskeysockets/baileys'
import { BufferJSON, initAuthCreds } from '@whiskeysockets/baileys'

async function usePostgresAuthState(sessionId: string, pool: Pool) {
    // Cargar o crear sesión
    let sessionResult = await pool.query(
        'SELECT session_data FROM sessions WHERE id = $1',
        [sessionId]
    )
    
    let creds
    if (sessionResult.rows.length === 0) {
        creds = initAuthCreds()
        await pool.query(
            'INSERT INTO sessions (id, session_data) VALUES ($1, $2)',
            [sessionId, JSON.stringify(creds, BufferJSON.replacer)]
        )
    } else {
        creds = JSON.parse(sessionResult.rows[0].session_data, BufferJSON.reviver)
    }
    
    return {
        state: {
            creds,
            keys: {
                get: async (type: string, ids: string[]) => {
                    const result = await pool.query(
                        'SELECT id, key_data FROM auth_keys WHERE session_id = $1 AND key_type = $2 AND id = ANY($3)',
                        [sessionId, type, ids.map(id => `${type}-${id}`)]
                    )
                    
                    const data: any = {}
                    for (const row of result.rows) {
                        const id = row.id.split('-')[1]
                        data[id] = JSON.parse(row.key_data, BufferJSON.reviver)
                    }
                    
                    return data
                },
                
                set: async (data: SignalDataTypeMap) => {
                    const client = await pool.connect()
                    
                    try {
                        await client.query('BEGIN')
                        
                        for (const category in data) {
                            for (const id in data[category]) {
                                const keyId = `${category}-${id}`
                                const keyData = JSON.stringify(data[category][id], BufferJSON.replacer)
                                
                                await client.query(
                                    `INSERT INTO auth_keys (id, session_id, key_type, key_data)
                                     VALUES ($1, $2, $3, $4)
                                     ON CONFLICT (id) DO UPDATE SET key_data = $4, updated_at = CURRENT_TIMESTAMP`,
                                    [keyId, sessionId, category, keyData]
                                )
                            }
                        }
                        
                        await client.query('COMMIT')
                    } catch (error) {
                        await client.query('ROLLBACK')
                        throw error
                    } finally {
                        client.release()
                    }
                }
            }
        } as AuthenticationState,
        
        saveCreds: async () => {
            await pool.query(
                'UPDATE sessions SET session_data = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [JSON.stringify(creds, BufferJSON.replacer), sessionId]
            )
        }
    }
}

// Uso
const pool = new Pool({ connectionString: 'postgresql://...' })
const { state, saveCreds } = await usePostgresAuthState('my-session', pool)

const sock = makeWASocket({ auth: state })
sock.ev.on('creds.update', saveCreds)
```

---

## Índices Recomendados

### Para Consultas Frecuentes

```sql
-- Mensajes recientes por chat
CREATE INDEX idx_messages_chat_recent ON messages(chat_id, timestamp DESC);

-- Mensajes no leídos
CREATE INDEX idx_messages_unread ON messages(chat_id, from_me, status) 
WHERE from_me = false AND status != 'read';

-- Búsqueda de texto en mensajes
CREATE FULLTEXT INDEX idx_messages_content ON messages(content);

-- Chats activos (no archivados)
CREATE INDEX idx_chats_active ON chats(session_id, archived, conversation_timestamp DESC)
WHERE archived = false;
```

---

## Estrategias de Backup

### Backup de Sesiones (Crítico)

```bash
# PostgreSQL
pg_dump -h localhost -U user -t sessions -t auth_keys whatsapp_db > sessions_backup.sql

# MySQL
mysqldump -u user -p whatsapp_db sessions auth_keys > sessions_backup.sql

# MongoDB
mongodump --db whatsapp --collection sessions --collection auth_keys --out ./backup
```

### Rotación de Mensajes Antiguos

```sql
-- Archivar mensajes mayores a 90 días
INSERT INTO messages_archive 
SELECT * FROM messages 
WHERE timestamp < UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 90 DAY));

DELETE FROM messages 
WHERE timestamp < UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 90 DAY));
```

### Limpieza de Media Cache

```sql
-- Eliminar archivos de cache mayores a 30 días
DELETE FROM media_cache 
WHERE downloaded_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
```

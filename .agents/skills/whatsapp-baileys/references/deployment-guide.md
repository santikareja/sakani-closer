# Guía de Deployment - WhatsApp Baileys

Guía completa para desplegar aplicaciones de WhatsApp Baileys en producción.

## Tabla de Contenidos

- [Preparación para Producción](#preparación-para-producción)
- [PM2 (Process Manager)](#pm2-process-manager)
- [Docker](#docker)
- [Variables de Entorno](#variables-de-entorno)
- [Nginx como Reverse Proxy](#nginx-como-reverse-proxy)
- [Monitoreo y Logging](#monitoreo-y-logging)
- [Backup y Recuperación](#backup-y-recuperación)
- [Escalabilidad](#escalabilidad)

---

## Preparación para Producción

### Checklist Pre-Deployment

- [ ] Base de datos configurada y migrada
- [ ] Variables de entorno definidas
- [ ] Secrets seguros (no en código)
- [ ] Logs configurados
- [ ] Manejo de errores robusto
- [ ] Rate limiting implementado
- [ ] Backup automático de sesiones
- [ ] Health checks configurados
- [ ] SSL/TLS configurado para webhooks
- [ ] Monitoreo configurado

### Estructura de Proyecto Recomendada

```
whatsapp-bot/
├── src/
│   ├── index.ts
│   ├── bot/
│   ├── handlers/
│   ├── services/
│   └── utils/
├── dist/              # Compilado
├── auth_sessions/     # Sesiones (no subir a git)
├── logs/              # Logs
├── .env               # Variables locales (no subir)
├── .env.example       # Template de variables
├── ecosystem.config.js # PM2 config
├── Dockerfile
├── docker-compose.yml
├── nginx.conf
└── package.json
```

---

## PM2 (Process Manager)

### Instalación

```bash
npm install -g pm2
```

### Configuración (ecosystem.config.js)

```javascript
module.exports = {
  apps: [{
    name: 'whatsapp-bot',
    script: 'dist/index.js',
    instances: 1, // NO usar cluster mode para WhatsApp (sesión única)
    exec_mode: 'fork',
    
    // Auto-restart
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Logs
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Variables de entorno
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    
    // Límites de recursos
    max_memory_restart: '500M',
    
    // Watch (solo para desarrollo)
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'auth_sessions'],
    
    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 3000
  }]
}
```

### Comandos PM2

```bash
# Iniciar aplicación
pm2 start ecosystem.config.js

# Ver logs en tiempo real
pm2 logs whatsapp-bot

# Monitorear recursos
pm2 monit

# Reiniciar
pm2 restart whatsapp-bot

# Detener
pm2 stop whatsapp-bot

# Eliminar de PM2
pm2 delete whatsapp-bot

# Guardar configuración
pm2 save

# Auto-start en boot
pm2 startup
# Ejecutar el comando que PM2 te muestra
```

### Señal de "Ready" para PM2

```typescript
// En tu código principal
import makeWASocket from '@whiskeysockets/baileys'

async function start() {
    const sock = makeWASocket({...})
    
    sock.ev.on('connection.update', (update) => {
        if (update.connection === 'open') {
            // Señal a PM2 que la app está lista
            if (process.send) {
                process.send('ready')
            }
            console.log('✅ Bot listo y conectado')
        }
    })
}
```

---

## Docker

### Dockerfile

```dockerfile
FROM node:18-alpine

# Instalar dependencias del sistema
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++

# Crear directorio de app
WORKDIR /app

# Copiar package files
COPY package*.json ./
COPY tsconfig.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar código fuente
COPY src ./src

# Compilar TypeScript
RUN npm run build

# Crear directorios necesarios
RUN mkdir -p auth_sessions logs

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000

# Exponer puerto
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Usuario no-root por seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Cambiar permisos
RUN chown -R nodejs:nodejs /app

USER nodejs

# Comando de inicio
CMD ["node", "dist/index.js"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  whatsapp-bot:
    build: .
    container_name: whatsapp-bot
    restart: unless-stopped
    
    ports:
      - "3000:3000"
    
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - SESSION_ID=${SESSION_ID}
    
    volumes:
      # Persistir sesiones
      - ./auth_sessions:/app/auth_sessions
      # Persistir logs
      - ./logs:/app/logs
    
    networks:
      - whatsapp-network
    
    depends_on:
      - postgres
    
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
  
  postgres:
    image: postgres:15-alpine
    container_name: whatsapp-db
    restart: unless-stopped
    
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    
    networks:
      - whatsapp-network
  
  redis:
    image: redis:7-alpine
    container_name: whatsapp-redis
    restart: unless-stopped
    
    volumes:
      - redis-data:/data
    
    networks:
      - whatsapp-network

volumes:
  postgres-data:
  redis-data:

networks:
  whatsapp-network:
    driver: bridge
```

### Comandos Docker

```bash
# Build
docker-compose build

# Iniciar servicios
docker-compose up -d

# Ver logs
docker-compose logs -f whatsapp-bot

# Reiniciar servicio
docker-compose restart whatsapp-bot

# Detener
docker-compose down

# Detener y eliminar volúmenes
docker-compose down -v
```

---

## Variables de Entorno

### .env.example

```env
# Application
NODE_ENV=production
PORT=3000
SESSION_ID=my-whatsapp-session

# Database
DB_TYPE=postgres # postgres, mysql, mongodb
DATABASE_URL=postgresql://user:password@localhost:5432/whatsapp_db

# Redis (para cache y queues)
REDIS_URL=redis://localhost:6379

# WhatsApp Configuration
WA_PRINT_QR_TERMINAL=false
WA_SYNC_FULL_HISTORY=false
WA_MARK_ONLINE_ON_CONNECT=false

# API Configuration (si expones API REST)
API_PORT=3001
API_SECRET_KEY=your-secret-key-here

# Webhooks (opcional)
WEBHOOK_URL=https://your-domain.com/webhook
WEBHOOK_SECRET=webhook-secret

# Logging
LOG_LEVEL=info # debug, info, warn, error
LOG_FILE_PATH=./logs/app.log

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000

# Media Storage
MEDIA_STORAGE_PATH=./media
MEDIA_MAX_SIZE_MB=50

# Backup
BACKUP_ENABLED=true
BACKUP_INTERVAL_HOURS=24
BACKUP_PATH=./backups
```

### Cargar Variables

```typescript
import dotenv from 'dotenv'
import { z } from 'zod'

// Cargar .env
dotenv.config()

// Validar variables (recomendado con Zod)
const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']),
    PORT: z.string().transform(Number),
    DATABASE_URL: z.string().url(),
    SESSION_ID: z.string().min(1),
    // ... más validaciones
})

export const env = envSchema.parse(process.env)
```

---

## Nginx como Reverse Proxy

### Configuración nginx.conf

```nginx
upstream whatsapp_bot {
    server localhost:3000;
}

server {
    listen 80;
    server_name your-domain.com;
    
    # Redirigir a HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL Certificates (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Logs
    access_log /var/log/nginx/whatsapp-bot-access.log;
    error_log /var/log/nginx/whatsapp-bot-error.log;
    
    # Max body size (para envío de archivos)
    client_max_body_size 50M;
    
    # Health check endpoint (público)
    location /health {
        proxy_pass http://whatsapp_bot;
        proxy_set_header Host $host;
        access_log off;
    }
    
    # API endpoints
    location /api/ {
        proxy_pass http://whatsapp_bot;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req zone=api_limit burst=20 nodelay;
}
```

### Instalar SSL con Let's Encrypt

```bash
# Instalar certbot
sudo apt install certbot python3-certbot-nginx

# Obtener certificado
sudo certbot --nginx -d your-domain.com

# Auto-renovación
sudo certbot renew --dry-run
```

---

## Monitoreo y Logging

### Winston Logger Setup

```typescript
import winston from 'winston'
import 'winston-daily-rotate-file'

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'whatsapp-bot' },
    transports: [
        // Console
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        
        // Error logs
        new winston.transports.DailyRotateFile({
            filename: 'logs/error-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            level: 'error',
            maxFiles: '14d'
        }),
        
        // All logs
        new winston.transports.DailyRotateFile({
            filename: 'logs/combined-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxFiles: '7d'
        })
    ]
})

export default logger
```

### Health Check Endpoint

```typescript
import express from 'express'

const app = express()

app.get('/health', (req, res) => {
    const health = {
        uptime: process.uptime(),
        message: 'OK',
        timestamp: Date.now(),
        whatsapp: {
            connected: sock?.user?.id ? true : false,
            userId: sock?.user?.id || null
        },
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
    }
    
    res.status(200).json(health)
})

app.listen(3001, () => {
    console.log('Health check server on port 3001')
})
```

### Prometheus Metrics (Opcional)

```typescript
import promClient from 'prom-client'

// Crear registro
const register = new promClient.Registry()

// Métricas por defecto
promClient.collectDefaultMetrics({ register })

// Métricas personalizadas
const messagesReceived = new promClient.Counter({
    name: 'whatsapp_messages_received_total',
    help: 'Total de mensajes recibidos',
    labelNames: ['type', 'from_me']
})

const messagesSent = new promClient.Counter({
    name: 'whatsapp_messages_sent_total',
    help: 'Total de mensajes enviados',
    labelNames: ['type', 'status']
})

register.registerMetric(messagesReceived)
register.registerMetric(messagesSent)

// Endpoint de métricas
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType)
    res.end(await register.metrics())
})
```

---

## Backup y Recuperación

### Script de Backup Automático

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/path/to/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SESSION_DIR="/path/to/auth_sessions"
DB_NAME="whatsapp_db"

# Crear directorio de backup
mkdir -p "$BACKUP_DIR/$TIMESTAMP"

# Backup de sesiones
tar -czf "$BACKUP_DIR/$TIMESTAMP/sessions.tar.gz" "$SESSION_DIR"

# Backup de base de datos
pg_dump -U user $DB_NAME > "$BACKUP_DIR/$TIMESTAMP/database.sql"

# Comprimir
tar -czf "$BACKUP_DIR/backup_$TIMESTAMP.tar.gz" "$BACKUP_DIR/$TIMESTAMP"
rm -rf "$BACKUP_DIR/$TIMESTAMP"

# Limpiar backups antiguos (mantener últimos 7 días)
find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +7 -delete

echo "Backup completado: backup_$TIMESTAMP.tar.gz"
```

### Cron Job para Backup

```bash
# Editar crontab
crontab -e

# Backup diario a las 2 AM
0 2 * * * /path/to/backup.sh >> /var/log/whatsapp-backup.log 2>&1
```

### Script de Restauración

```bash
#!/bin/bash
# restore.sh

BACKUP_FILE=$1
RESTORE_DIR="/tmp/restore_$(date +%s)"

if [ -z "$BACKUP_FILE" ]; then
    echo "Uso: ./restore.sh <archivo_backup.tar.gz>"
    exit 1
fi

# Extraer backup
mkdir -p "$RESTORE_DIR"
tar -xzf "$BACKUP_FILE" -C "$RESTORE_DIR"

# Restaurar sesiones
tar -xzf "$RESTORE_DIR/sessions.tar.gz" -C /path/to/

# Restaurar base de datos
psql -U user whatsapp_db < "$RESTORE_DIR/database.sql"

# Limpiar
rm -rf "$RESTORE_DIR"

echo "Restauración completada"
```

---

## Escalabilidad

### Multi-Sesión (Múltiples Cuentas)

```typescript
class SessionManager {
    private sessions: Map<string, WASocket> = new Map()
    
    async createSession(sessionId: string) {
        // Usar useMultiFileAuthState para cada sesión con carpeta separada
        const { state, saveCreds } = await useMultiFileAuthState(`auth_sessions/${sessionId}`)
        
        // O usar implementación con MySQL (ver database-schemas.md)
        // const { state, saveCreds } = await useMySQLAuthState(sessionId, mysqlConnection)
        
        const sock = makeWASocket({
            auth: state,
            // ... config
        })
        
        sock.ev.on('creds.update', saveCreds)
        
        this.sessions.set(sessionId, sock)
        return sock
    }
    
    getSession(sessionId: string) {
        return this.sessions.get(sessionId)
    }
    
    async closeSession(sessionId: string) {
        const sock = this.sessions.get(sessionId)
        if (sock) {
            await sock.logout()
            this.sessions.delete(sessionId)
        }
    }
}

// Ejemplo de uso
const sessionManager = new SessionManager()

// Crear múltiples sesiones
await sessionManager.createSession('whatsapp-cuenta-1')
await sessionManager.createSession('whatsapp-cuenta-2')
await sessionManager.createSession('whatsapp-cuenta-3')

// Obtener sesión específica para enviar mensaje
const sock1 = sessionManager.getSession('whatsapp-cuenta-1')
await sock1.sendMessage(jid, { text: 'Hola desde cuenta 1' })
```

#### Gestión de QR Codes para Múltiples Sesiones

Cuando creas múltiples sesiones, cada una necesita su propio código QR para conectarse. Aquí está cómo gestionarlos:

```typescript
import express from 'express'
import QRCode from 'qrcode'
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'

class SessionManager {
    private sessions: Map<string, any> = new Map()
    private qrCodes: Map<string, string> = new Map() // Almacenar QR codes
    private connectionStatus: Map<string, string> = new Map() // Estado de cada sesión
    
    async createSession(sessionId: string) {
        // Si ya existe, no crear de nuevo
        if (this.sessions.has(sessionId)) {
            return this.sessions.get(sessionId)
        }
        
        const { state, saveCreds } = await useMultiFileAuthState(`auth_sessions/${sessionId}`)
        
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false, // NO mostrar en terminal
            browser: ['WhatsApp Bot', 'Chrome', '1.0.0']
        })
        
        // Capturar QR code
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update
            
            if (qr) {
                // Convertir QR a imagen base64
                const qrImage = await QRCode.toDataURL(qr)
                this.qrCodes.set(sessionId, qrImage)
                this.connectionStatus.set(sessionId, 'qr_ready')
                console.log(`[${sessionId}] QR Code generado`)
            }
            
            if (connection === 'close') {
                const shouldReconnect = 
                    (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut
                
                this.connectionStatus.set(sessionId, 'disconnected')
                
                if (shouldReconnect) {
                    console.log(`[${sessionId}] Reconectando...`)
                    setTimeout(() => this.createSession(sessionId), 3000)
                } else {
                    console.log(`[${sessionId}] Sesión cerrada`)
                    this.sessions.delete(sessionId)
                    this.qrCodes.delete(sessionId)
                }
            }
            
            if (connection === 'open') {
                this.connectionStatus.set(sessionId, 'connected')
                this.qrCodes.delete(sessionId) // Limpiar QR ya usado
                console.log(`[${sessionId}] ✅ Conectado - ${sock.user?.id}`)
            }
        })
        
        sock.ev.on('creds.update', saveCreds)
        
        this.sessions.set(sessionId, sock)
        return sock
    }
    
    getSession(sessionId: string) {
        return this.sessions.get(sessionId)
    }
    
    getQRCode(sessionId: string): string | undefined {
        return this.qrCodes.get(sessionId)
    }
    
    getStatus(sessionId: string): string {
        return this.connectionStatus.get(sessionId) || 'not_initialized'
    }
    
    getAllSessions() {
        const sessions = []
        for (const [id, sock] of this.sessions) {
            sessions.push({
                sessionId: id,
                status: this.getStatus(id),
                phoneNumber: sock.user?.id || null,
                hasQR: this.qrCodes.has(id)
            })
        }
        return sessions
    }
    
    async closeSession(sessionId: string) {
        const sock = this.sessions.get(sessionId)
        if (sock) {
            await sock.logout()
            this.sessions.delete(sessionId)
            this.qrCodes.delete(sessionId)
            this.connectionStatus.delete(sessionId)
        }
    }
}

// API REST para gestionar sesiones
const app = express()
const sessionManager = new SessionManager()

app.use(express.json())

// Crear nueva sesión y obtener QR
app.post('/api/sessions/create', async (req, res) => {
    const { sessionId } = req.body
    
    if (!sessionId) {
        return res.status(400).json({ error: 'sessionId requerido' })
    }
    
    try {
        await sessionManager.createSession(sessionId)
        
        // Esperar a que se genere el QR (máximo 10 segundos)
        let attempts = 0
        while (attempts < 20) {
            const qr = sessionManager.getQRCode(sessionId)
            if (qr) {
                return res.json({
                    sessionId,
                    qrCode: qr,
                    status: 'qr_ready',
                    message: 'Escanea el código QR con WhatsApp'
                })
            }
            await new Promise(r => setTimeout(r, 500))
            attempts++
        }
        
        res.status(408).json({ 
            error: 'Timeout esperando QR code',
            sessionId 
        })
    } catch (error) {
        res.status(500).json({ 
            error: 'Error creando sesión',
            details: (error as Error).message 
        })
    }
})

// Obtener QR code de sesión existente
app.get('/api/sessions/:sessionId/qr', (req, res) => {
    const { sessionId } = req.params
    const qr = sessionManager.getQRCode(sessionId)
    
    if (!qr) {
        return res.status(404).json({ 
            error: 'QR no disponible',
            status: sessionManager.getStatus(sessionId)
        })
    }
    
    res.json({ sessionId, qrCode: qr })
})

// Ver estado de una sesión
app.get('/api/sessions/:sessionId/status', (req, res) => {
    const { sessionId } = req.params
    const sock = sessionManager.getSession(sessionId)
    
    if (!sock) {
        return res.status(404).json({ error: 'Sesión no encontrada' })
    }
    
    res.json({
        sessionId,
        status: sessionManager.getStatus(sessionId),
        phoneNumber: sock.user?.id || null,
        connected: sock.user?.id ? true : false
    })
})

// Listar todas las sesiones
app.get('/api/sessions', (req, res) => {
    res.json({ sessions: sessionManager.getAllSessions() })
})

// Cerrar sesión
app.delete('/api/sessions/:sessionId', async (req, res) => {
    const { sessionId } = req.params
    
    try {
        await sessionManager.closeSession(sessionId)
        res.json({ message: 'Sesión cerrada', sessionId })
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Enviar mensaje desde sesión específica
app.post('/api/sessions/:sessionId/send', async (req, res) => {
    const { sessionId } = req.params
    const { to, message } = req.body
    
    const sock = sessionManager.getSession(sessionId)
    
    if (!sock) {
        return res.status(404).json({ error: 'Sesión no encontrada' })
    }
    
    if (sessionManager.getStatus(sessionId) !== 'connected') {
        return res.status(400).json({ error: 'Sesión no conectada' })
    }
    
    try {
        await sock.sendMessage(to, { text: message })
        res.json({ success: true, sessionId, to })
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

app.listen(3000, () => {
    console.log('API Multi-Sesión en puerto 3000')
})
```

#### Interfaz Web para QR Codes

HTML simple para mostrar QR codes de múltiples sesiones:

```html
<!DOCTYPE html>
<html>
<head>
    <title>WhatsApp Multi-Sesión</title>
    <style>
        .session { 
            border: 1px solid #ccc; 
            padding: 20px; 
            margin: 10px; 
            display: inline-block;
            text-align: center;
        }
        .qr-code { max-width: 300px; }
        .status { 
            padding: 5px 10px; 
            border-radius: 5px; 
            margin: 10px 0;
        }
        .connected { background: #4CAF50; color: white; }
        .qr_ready { background: #FFC107; }
        .disconnected { background: #f44336; color: white; }
    </style>
</head>
<body>
    <h1>Gestión de Sesiones WhatsApp</h1>
    
    <div>
        <input type="text" id="sessionId" placeholder="ID de sesión">
        <button onclick="createSession()">Crear Sesión</button>
        <button onclick="loadSessions()">Actualizar</button>
    </div>
    
    <div id="sessions"></div>
    
    <script>
        async function createSession() {
            const sessionId = document.getElementById('sessionId').value
            if (!sessionId) return alert('Ingresa un ID de sesión')
            
            const response = await fetch('/api/sessions/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId })
            })
            
            const data = await response.json()
            if (data.qrCode) {
                loadSessions()
            }
        }
        
        async function loadSessions() {
            const response = await fetch('/api/sessions')
            const data = await response.json()
            
            const container = document.getElementById('sessions')
            container.innerHTML = ''
            
            for (const session of data.sessions) {
                const div = document.createElement('div')
                div.className = 'session'
                
                let content = `
                    <h3>${session.sessionId}</h3>
                    <div class="status ${session.status}">${session.status}</div>
                `
                
                if (session.hasQR) {
                    // Obtener QR
                    const qrResponse = await fetch(`/api/sessions/${session.sessionId}/qr`)
                    const qrData = await qrResponse.json()
                    content += `<img src="${qrData.qrCode}" class="qr-code"><br>`
                }
                
                if (session.phoneNumber) {
                    content += `<p>📱 ${session.phoneNumber}</p>`
                }
                
                content += `
                    <button onclick="closeSession('${session.sessionId}')">Cerrar</button>
                `
                
                div.innerHTML = content
                container.appendChild(div)
            }
        }
        
        async function closeSession(sessionId) {
            if (!confirm('¿Cerrar esta sesión?')) return
            
            await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' })
            loadSessions()
        }
        
        // Auto-actualizar cada 5 segundos
        setInterval(loadSessions, 5000)
        loadSessions()
    </script>
</body>
</html>
```

#### Uso del API

```bash
# 1. Crear sesión "tienda-1"
curl -X POST http://localhost:3000/api/sessions/create \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "tienda-1"}'

# Respuesta:
# {
#   "sessionId": "tienda-1",
#   "qrCode": "data:image/png;base64,iVBORw0KGgo...",
#   "status": "qr_ready",
#   "message": "Escanea el código QR con WhatsApp"
# }

# 2. Crear sesión "soporte-1"
curl -X POST http://localhost:3000/api/sessions/create \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "soporte-1"}'

# 3. Ver estado de sesión
curl http://localhost:3000/api/sessions/tienda-1/status

# 4. Listar todas las sesiones
curl http://localhost:3000/api/sessions

# 5. Enviar mensaje desde sesión específica
curl -X POST http://localhost:3000/api/sessions/tienda-1/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "5491155554444@s.whatsapp.net",
    "message": "Hola desde tienda-1"
  }'

# 6. Cerrar sesión
curl -X DELETE http://localhost:3000/api/sessions/tienda-1
```
```

### Cola de Mensajes con Bull (Redis)

```typescript
import Queue from 'bull'

const messageQueue = new Queue('messages', {
    redis: {
        host: 'localhost',
        port: 6379
    }
})

// Agregar trabajo a la cola
await messageQueue.add({
    sessionId: 'session-1',
    chatId: 'user@s.whatsapp.net',
    content: { text: 'Hola' }
}, {
    attempts: 3,
    backoff: {
        type: 'exponential',
        delay: 2000
    }
})

// Procesar trabajos
messageQueue.process(async (job) => {
    const { sessionId, chatId, content } = job.data
    const sock = sessionManager.getSession(sessionId)
    
    await sock.sendMessage(chatId, content)
})
```

### Load Balancer (Para múltiples instancias)

Si necesitas escalar horizontalmente con múltiples servidores:

1. Usa Redis para compartir estado
2. Implementa sticky sessions por sessionId
3. Usa un load balancer (Nginx/HAProxy)
4. Asegura que cada sesión se conecte a una sola instancia

**Nota**: WhatsApp multi-device permite máximo 4 dispositivos vinculados simultáneamente.

# Multi-Sesión - Múltiples Líneas de WhatsApp

## ⚠️ Concepto Importante

**Sesión única vs Multi-sesión:**

- ✅ **Sesión única**: Un bot maneja UNA línea de WhatsApp → Una carpeta `auth_info`
- ✅ **Multi-sesión**: Un bot maneja MÚLTIPLES líneas de WhatsApp → Una carpeta por línea

## Características

- ✅ Múltiples sesiones simultáneas
- ✅ Carpeta de credenciales aislada por sesión (`auth_info_{sessionId}`)
- ✅ API REST para gestionar sesiones
- ✅ Dashboard HTML para visualizar QR y estado
- ✅ Reconexión automática por sesión
- ✅ Detección de logout desde móvil
- ✅ Envío de mensajes por sesión específica
- ✅ **Persistencia de sesiones al cerrar proceso**
- ✅ **Restauración automática de sesiones al reiniciar**
- ✅ **Detección de mensajes de grupo vs privado (isGroup)**
- ✅ **Patrón early return para código limpio**

## Instalación

```bash
npm install @whiskeysockets/baileys pino qrcode-terminal express
```

## 📁 Estructura Multi-Sesión

```
proyecto/
├── multi-session.js             # Servidor multi-sesión
├── vanilla_test_multi_sessions/ # Dashboard HTML
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   └── qrcode.min.js           # Librería QRCode (davidshimjs/qrcodejs)
├── auth_info_sesion1/          # Credenciales sesión 1 (auto-generado)
├── auth_info_sesion2/          # Credenciales sesión 2 (auto-generado)
└── public/
    ├── video/
    ├── images/
    └── files/
```

## Arquitectura

### Clase SessionManager

El corazón del sistema es la clase `SessionManager` que gestiona todas las sesiones:

```javascript
class SessionManager {
    constructor() {
        this.sessions = new Map()        // Sockets activos
        this.qrCodes = new Map()         // QRs pendientes
        this.connectionStatus = new Map() // Estados de conexión
    }
}
```

### Métodos Principales

| Método | Descripción |
|--------|-------------|
| `createSession(sessionId)` | Crea nueva sesión con carpeta aislada |
| `getSession(sessionId)` | Obtiene socket de una sesión |
| `getQR(sessionId)` | Obtiene QR pendiente de escaneo |
| `getStatus(sessionId)` | Obtiene estado: `connecting`, `qr_ready`, `connected`, `reconnecting`, `failed` |
| `listSessions()` | Lista todas las sesiones con su información |
| `closeSession(sessionId)` | Cierra, DESVINCULA de WhatsApp y elimina credenciales |
| `disconnectSession(sessionId)` | Desconecta pero PRESERVA credenciales (para cierre graceful) |
| `restoreExistingSessions()` | Restaura sesiones desde carpetas `auth_info_*` existentes |

## API REST

### Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/sessions/create` | Crear nueva sesión |
| `GET` | `/api/sessions` | Listar todas las sesiones |
| `GET` | `/api/sessions/:id/status` | Ver estado de una sesión |
| `GET` | `/api/sessions/:id/qr` | Obtener QR de una sesión |
| `POST` | `/api/sessions/:id/send` | Enviar mensaje desde una sesión |
| `DELETE` | `/api/sessions/:id` | Cerrar y eliminar sesión |

### Ejemplos de Uso

#### Crear Sesión

```bash
curl -X POST http://localhost:3000/api/sessions/create \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "ventas"}'
```

**Respuesta:**
```json
{
  "sessionId": "ventas",
  "qr": "2@abc123...",
  "status": "qr_ready",
  "message": "Escanea el QR con WhatsApp"
}
```

#### Listar Sesiones

```bash
curl http://localhost:3000/api/sessions
```

**Respuesta:**
```json
{
  "sessions": [
    {
      "sessionId": "ventas",
      "status": "connected",
      "phoneNumber": "521234567890@s.whatsapp.net",
      "hasQR": false,
      "folder": "auth_info_ventas"
    }
  ]
}
```

#### Enviar Mensaje

```bash
curl -X POST http://localhost:3000/api/sessions/ventas/send \
  -H "Content-Type: application/json" \
  -d '{"to": "521234567890@s.whatsapp.net", "message": "Hola desde ventas!"}'
```

## Dashboard HTML

El dashboard permite gestionar sesiones visualmente sin usar la terminal.

### ⚠️ IMPORTANTE: Librería QRCode para Browser

Para mostrar el QR en el navegador, usar la librería `qrcode.min.js` que **YA ESTÁ INCLUIDA** en `scripts/multi-session-dashboard/qrcode.min.js`.

**NO usar:**
- `QRCode.toCanvas()` ← API incorrecta para esta librería
- `<canvas>` como contenedor ← Usar `<div>` en su lugar

### Generar QR en HTML

```html
<!-- Contenedor DEBE ser un <div>, no <canvas> -->
<div id="qrContainer"></div>

<script src="qrcode.min.js"></script>
<script>
// Limpiar contenedor previo
const container = document.getElementById('qrContainer')
container.innerHTML = ''

// Crear QR
new QRCode(container, {
    text: qrText,
    width: 280,
    height: 280,
    colorDark: "#000000",
    colorLight: "#ffffff"
})
</script>
```

### Actualización Automática del QR

El QR de WhatsApp se regenera cada ~20 segundos. Implementar polling para actualizarlo:

```javascript
let qrUpdateInterval = null

function startQRPolling(sessionId) {
    // Limpiar polling anterior
    if (qrUpdateInterval) clearInterval(qrUpdateInterval)
    
    // Actualizar cada 5 segundos
    qrUpdateInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/sessions/${sessionId}/qr`)
            const data = await response.json()
            
            if (data.qr) {
                // Actualizar QR
                const container = document.getElementById('qrContainer')
                container.innerHTML = ''
                new QRCode(container, { 
                    text: data.qr, 
                    width: 280, 
                    height: 280 
                })
            } else if (data.error?.includes('conectado')) {
                // Sesión conectada, detener polling
                clearInterval(qrUpdateInterval)
                qrUpdateInterval = null
                alert('✅ Sesión conectada!')
            }
        } catch (error) {
            console.error('Error actualizando QR:', error)
        }
    }, 5000)
}

function stopQRPolling() {
    if (qrUpdateInterval) {
        clearInterval(qrUpdateInterval)
        qrUpdateInterval = null
    }
}
```

## Manejo de Conexión

### Estados de Conexión

| Estado | Descripción |
|--------|-------------|
| `connecting` | Iniciando conexión |
| `qr_ready` | QR disponible para escanear |
| `connected` | Sesión activa y funcional |
| `reconnecting` | Reconectando tras desconexión |
| `failed` | Error fatal, requiere recrear sesión |

### ⚠️ Reconexión Automática - CRÍTICO

**NO reconectar durante el escaneo del QR** para evitar el loop de "iniciando sesión" en la app de WhatsApp:

```javascript
if (connection === 'close') {
    const statusCode = lastDisconnect?.error?.output?.statusCode
    
    // ⚠️ NO reconectar durante establecimiento de conexión
    if (statusCode === DisconnectReason.connectionClosed || 
        statusCode === 428 || 
        statusCode === DisconnectReason.timedOut) {
        console.log('Esperando escaneo de QR...')
        return // NO reconectar - esto evita el loop
    }
    
    // Reconectar SOLO en casos específicos
    const shouldReconnect = (
        statusCode === DisconnectReason.connectionLost ||
        statusCode === 440 ||
        statusCode === DisconnectReason.restartRequired
    )
    
    if (shouldReconnect && !session.isReconnecting) {
        session.isReconnecting = true
        const delay = statusCode === 440 ? 10000 : 5000
        
        setTimeout(async () => {
            this.sessions.delete(sessionId) // Limpiar sesión anterior
            await this.createSession(sessionId)
        }, delay)
    }
}
```

### Logout desde Móvil

Detectar cuando el usuario desvincula el dispositivo:

```javascript
if (statusCode === DisconnectReason.loggedOut) {
    console.log(`[${sessionId}] Sesión cerrada desde móvil`)
    
    // Eliminar SOLO la carpeta de ESTA sesión
    fs.rmSync(`auth_info_${sessionId}`, { recursive: true, force: true })
    
    // Limpiar del gestor
    this.sessions.delete(sessionId)
    this.qrCodes.delete(sessionId)
    this.connectionStatus.delete(sessionId)
}
```

## Ejecución

```bash
# Iniciar servidor multi-sesión
npm run multi
# o
node multi-session.js

# Dashboard disponible en:
# http://localhost:3000
```

## Errores Comunes y Soluciones

### Error: "La sesión ya existe"

La sesión con ese ID ya está creada. Usar otro nombre o cerrarla primero:

```bash
curl -X DELETE http://localhost:3000/api/sessions/mi-sesion
```

### QR no aparece en HTML

1. ✅ Verificar que `qrcode.min.js` esté correctamente cargado
2. ✅ Usar `<div>` como contenedor, **NO** `<canvas>`
3. ✅ Usar `new QRCode(container, {...})`, **NO** `QRCode.toCanvas()`
4. ✅ Verificar consola del navegador por errores

### Loop de "Iniciando sesión" en WhatsApp

La reconexión automática interfiere con el escaneo del QR. **NO reconectar** cuando:
- `statusCode === DisconnectReason.connectionClosed`
- `statusCode === 428`
- `statusCode === DisconnectReason.timedOut`

Ver sección "Reconexión Automática - CRÍTICO" arriba.

### Sesión no persiste tras reinicio

Las credenciales se guardan en `auth_info_{sessionId}/`. Si la carpeta existe, la sesión se restaura automáticamente al crear con el mismo ID.

## 🔄 Persistencia de Sesiones

### El Problema

Por defecto, al terminar el proceso Node.js (Ctrl+C), las sesiones activas llaman a `logout()` internamente, lo que **desvincula** el dispositivo de WhatsApp y **elimina** las credenciales.

### La Solución: `disconnectSession()` vs `closeSession()`

| Método | Comportamiento | Uso |
|--------|----------------|-----|
| `closeSession(sessionId)` | Hace logout → Elimina credenciales → Desvincula de WhatsApp | Cuando quieres desconectar permanentemente |
| `disconnectSession(sessionId)` | Solo cierra WebSocket → **PRESERVA** credenciales | Cierre graceful del proceso |

### Implementación

```javascript
/**
 * Desconectar sesión sin desvincular (mantiene credenciales)
 * ✅ USAR ESTE para cierre graceful del proceso
 */
disconnectSession(sessionId) {
    const session = this.sessions.get(sessionId)
    if (!session) return
    
    try {
        session.sock.ev.removeAllListeners()  // Quitar listeners
        session.sock.ws.close()               // Cerrar WebSocket sin logout
    } catch (e) {
        // Ignorar errores
    }
    
    this.sessions.delete(sessionId)
    this.qrCodes.delete(sessionId)
    this.connectionStatus.delete(sessionId)
    console.log(`[${sessionId}] Desconectado (credenciales preservadas)`)
}
```

### Manejo de SIGINT (Ctrl+C)

```javascript
process.on('SIGINT', async () => {
    console.log('🛑 Desconectando sesiones...')
    
    for (const [sessionId] of manager.sessions) {
        try {
            manager.disconnectSession(sessionId) // ✅ Preserva credenciales
            // manager.closeSession(sessionId)   // ❌ Eliminaría credenciales
        } catch (e) {}
    }
    
    console.log('✅ Credenciales guardadas. Sesiones se restaurarán al reiniciar.')
    process.exit(0)
})
```

### Restauración Automática al Iniciar

```javascript
/**
 * Restaurar sesiones existentes desde carpetas auth_info_*
 */
async restoreExistingSessions() {
    const folders = fs.readdirSync('.').filter(f => 
        f.startsWith('auth_info_') && 
        fs.statSync(f).isDirectory() &&
        fs.existsSync(`${f}/creds.json`)  // Solo si tiene credenciales
    )
    
    if (folders.length === 0) {
        console.log('📭 No hay sesiones previas para restaurar')
        return
    }
    
    console.log(`🔄 Restaurando ${folders.length} sesión(es)...`)
    
    for (const folder of folders) {
        const sessionId = folder.replace('auth_info_', '')
        try {
            await this.createSession(sessionId)
            await new Promise(r => setTimeout(r, 2000)) // Pausa anti-rate-limit
        } catch (error) {
            console.error(`[${sessionId}] Error al restaurar:`, error.message)
        }
    }
}
```

### Llamar al Iniciar el Servidor

```javascript
app.listen(PORT, async () => {
    console.log(`API REST: http://localhost:${PORT}`)
    
    // ✅ Restaurar sesiones existentes automáticamente
    await manager.restoreExistingSessions()
})
```

### Flujo Completo

```
┌─────────────────────────────────────────────────────────────────┐
│  INICIO                                                         │
│    ↓                                                            │
│  1. app.listen() inicia servidor                                │
│    ↓                                                            │
│  2. restoreExistingSessions() busca carpetas auth_info_*        │
│    ↓                                                            │
│  3. Para cada carpeta con creds.json → createSession()          │
│    ↓                                                            │
│  ✅ Sesiones reconectadas automáticamente                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  CIERRE (Ctrl+C)                                                │
│    ↓                                                            │
│  1. SIGINT capturado                                            │
│    ↓                                                            │
│  2. Para cada sesión → disconnectSession()                      │
│    ↓                                                            │
│  3. WebSocket cerrado, credenciales INTACTAS                    │
│    ↓                                                            │
│  ✅ Al reiniciar → sesiones se restauran                        │
└─────────────────────────────────────────────────────────────────┘
```

## � Detección de Grupos vs Privado (isGroup)

### El Problema

Los mensajes en WhatsApp pueden venir de chats privados o de grupos. Es importante diferenciarlos para:
- Responder solo a chats privados
- Aplicar lógica diferente en grupos
- Evitar spam en grupos

### Cómo Detectar

El `chatId` (remoteJid) tiene un sufijo que indica el tipo:

| Sufijo | Tipo |
|--------|------|
| `@s.whatsapp.net` | Chat privado |
| `@g.us` | Grupo |

### Implementación

```javascript
// En setupMessageEvents
const chatId = msg.key.remoteJid

// Detectar si es grupo
const isGroup = chatId.endsWith('@g.us')

// Pasar al handler
await this.handleMessage(sessionId, sock, chatId, text, isGroup)
```

### Uso en handleMessage

```javascript
/**
 * @param {string} chatId - ID del chat (número@s.whatsapp.net o grupo@g.us)
 * @param {boolean} isGroup - true si es grupo (@g.us), false si es privado
 */
async handleMessage(sessionId, sock, chatId, text, isGroup) {
    // Ignorar mensajes de grupo
    if (isGroup) {
        console.log(`[${sessionId}] ⚠️  Ignorando mensaje de grupo: ${chatId}`)
        return
    }
    
    // Continuar solo con chats privados...
}
```

### Ejemplos de chatId

```javascript
// Chat privado
'521234567890@s.whatsapp.net'

// Grupo
'120363123456789012@g.us'
```

## 🧹 Patrón Early Return

### El Problema

El código con muchos `else if` anidados es difícil de leer y mantener:

```javascript
// ❌ MALO: else if anidados
async handleMessage(sock, chatId, text, isGroup) {
    try {
        if (isGroup) {
            return
        }
        if (text === 'text') {
            // ...
        } else if (text === 'video') {
            // ...
        } else if (text === 'image') {
            // ...
        } else if (text) {
            // ...
        }
    } catch (error) {
        // ...
    }
}
```

### La Solución: Early Return

```javascript
// ✅ BUENO: Early return, código limpio
async handleMessage(sock, chatId, text, isGroup) {
    // Early return: validaciones al inicio
    if (isGroup) {
        console.log('⚠️  Ignorando grupo')
        return
    }

    if (!text) return

    try {
        if (text === 'text') {
            await sock.sendMessage(chatId, { text: 'hola' })
            return  // ← Cada caso termina con return
        }

        if (text === 'video') {
            // ...
            return
        }

        if (text === 'image') {
            // ...
            return
        }

        // Mensaje por defecto (sin else, porque los anteriores ya hicieron return)
        await sock.sendMessage(chatId, { text: 'Comando no reconocido' })

    } catch (error) {
        console.error('Error:', error)
    }
}
```

### Beneficios

| Aspecto | else if | Early Return |
|---------|---------|--------------|
| Legibilidad | Difícil seguir el flujo | Flujo lineal claro |
| Anidación | Múltiples niveles | Plano |
| Validaciones | Dentro del try/catch | Antes del try/catch |
| Mantenimiento | Difícil agregar casos | Fácil agregar casos |

### Reglas del Early Return

1. **Validaciones al inicio** con `return` inmediato
2. **Sin `else if`** - cada `if` es independiente
3. **Cada caso termina con `return`**
4. **El caso por defecto va al final** sin condición extra
5. **`try/catch` solo envuelve la lógica de negocio**, no las validaciones

## �🔒 Aislamiento de Sesiones

### ✅ Patrón Correcto

```javascript
// Cada sesión tiene su propia carpeta
auth_info_linea-1/  → Línea 1
auth_info_linea-2/  → Línea 2
auth_info_linea-3/  → Línea 3
```

### ❌ Patrón Incorrecto

```javascript
// NO compartir carpeta entre sesiones
auth_info/          → Todas las líneas (NO HACER)
```

### Limpieza Selectiva

```javascript
// ✅ CORRECTO: Elimina solo UNA sesión
const sessionFolder = `auth_info_${sessionId}`
fs.rmSync(sessionFolder, { recursive: true })

// ❌ INCORRECTO: Elimina TODAS las sesiones
fs.rmSync('auth_info', { recursive: true })
```

## 📊 Comparación

| Aspecto | Sesión Única | Multi-Sesión |
|---------|--------------|--------------|
| Carpetas | 1 (`auth_info`) | N (`auth_info_${id}`) |
| Líneas WhatsApp | 1 | N |
| Al desvincular | Elimina única carpeta | Elimina carpeta específica |
| Conflictos | No aplica | Cada sesión independiente |
| Complejidad | Baja | Media |
| Uso típico | Bot personal | Bot empresarial |

## 🎯 Cuándo Usar Cada Opción

### Sesión Única
- ✅ Un solo número de WhatsApp
- ✅ Bot personal o pruebas
- ✅ Proyecto simple

### Multi-Sesión
- ✅ Múltiples números de WhatsApp
- ✅ Bot empresarial con departamentos
- ✅ SaaS con múltiples clientes
- ✅ Necesitas escalar

## Seguridad

- ⚠️ No exponer el puerto 3000 directamente a internet sin autenticación
- ⚠️ Implementar rate limiting en producción
- ⚠️ Las carpetas `auth_info_*` contienen credenciales sensibles
- ⚠️ Agregar `auth_info_*/` a `.gitignore`
- ⚠️ Agregar autenticación a los endpoints de la API

## ⚠️ Advertencias

1. **Límite de WhatsApp**: Máximo 4 dispositivos vinculados por cuenta
2. **Recursos**: Cada sesión consume memoria y CPU
3. **Rate Limiting**: WhatsApp limita mensajes por cuenta
4. **Seguridad**: Cada carpeta `auth_info_*` debe estar en `.gitignore`

## Scripts de Ejemplo

Esta skill incluye código funcional listo para usar:

### Backend - multi-session.js

Servidor completo con API REST y gestión de sesiones:

```
.github/skills/whatsapp-baileys/scripts/multi-session.js
```

### Frontend - multi-session-dashboard/

Dashboard HTML/CSS/JS para gestionar sesiones visualmente:

```
.github/skills/whatsapp-baileys/scripts/multi-session-dashboard/
├── index.html      # Estructura HTML
├── style.css       # Estilos responsivos  
├── app.js          # Lógica JavaScript con polling de QR
└── qrcode.min.js   # Librería QRCode (INCLUIDA - no descargar)
```

### Uso Rápido

```bash
# Copiar scripts al proyecto (qrcode.min.js ya está incluido)
cp .github/skills/whatsapp-baileys/scripts/multi-session.js ./
cp -r .github/skills/whatsapp-baileys/scripts/multi-session-dashboard ./

# Instalar dependencias
npm install @whiskeysockets/baileys pino qrcode-terminal express

# Ejecutar
node multi-session.js

# Abrir http://localhost:3000
```

**⚠️ IMPORTANTE**: El archivo `qrcode.min.js` YA ESTÁ INCLUIDO en el directorio `scripts/multi-session-dashboard/`. No es necesario descargarlo de internet. Simplemente copia la carpeta completa tal como está.

Ver documentación completa en [scripts/README.md](../scripts/README.md)

## Referencias

- **Scripts de ejemplo**: [scripts/multi-session.js](../scripts/multi-session.js)
- **Dashboard HTML**: [scripts/multi-session-dashboard/](../scripts/multi-session-dashboard/)
- **Documentación scripts**: [scripts/README.md](../scripts/README.md)
- [QRCode.js Library](https://github.com/davidshimjs/qrcodejs)
- [Baileys Documentation](https://github.com/WhiskeySockets/Baileys)
- [Express.js](https://expressjs.com/)

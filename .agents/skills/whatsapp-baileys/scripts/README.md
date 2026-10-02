# Scripts de Ejemplo - WhatsApp Baileys

Colección de scripts listos para usar que demuestran funcionalidades de Baileys.

## 📁 Contenido

### basic-bot-example.js

Bot básico completamente funcional con **todas las correcciones para evitar errores comunes**.

**Características:**
- ✅ Conexión con QR en terminal
- ✅ Respuestas automáticas (text, image, video)
- ✅ Reconexión automática inteligente
- ✅ Limpieza de sesión al desvincular desde móvil
- ✅ Persistencia de sesión entre reinicios
- ✅ Manejo de errores 405, 440, 408

**Uso:**
```bash
# Instalar dependencias
npm install @whiskeysockets/baileys pino qrcode-terminal

# Ejecutar
node basic-bot-example.js
```

**Comandos disponibles:**
- Envía `text` → Responde: "hola cómo estás"
- Envía `image` → Envía una imagen de `public/images/sample.jpg`
- Envía `video` → Envía un video de `public/video/sample.mp4`
- Envía `file` → Envía un archivo Excel de `public/files/example.xlsx`

**Archivos creados:**
- `auth_info/` - Credenciales de sesión (NO subir a Git)

---

### multi-session.js

Bot multi-sesión con API REST y dashboard HTML para gestionar **múltiples líneas de WhatsApp simultáneamente**.

**Características:**
- ✅ Múltiples sesiones simultáneas
- ✅ Carpeta de credenciales aislada por sesión (`auth_info_{sessionId}`)
- ✅ API REST para gestionar sesiones
- ✅ Dashboard HTML incluido (`multi-session-dashboard/`)
- ✅ QR en navegador con actualización automática
- ✅ Reconexión automática inteligente (sin loops)
- ✅ Manejo de errores 405, 440, 408, 428

**Uso:**
```bash
# Instalar dependencias
npm install @whiskeysockets/baileys pino qrcode-terminal express

# Ejecutar
node multi-session.js

# Abrir dashboard en navegador
open http://localhost:3000
```

**API REST:**
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/sessions/create` | Crear nueva sesión |
| `GET` | `/api/sessions` | Listar sesiones |
| `GET` | `/api/sessions/:id/qr` | Obtener QR |
| `POST` | `/api/sessions/:id/send` | Enviar mensaje |
| `DELETE` | `/api/sessions/:id` | Cerrar sesión |

**Archivos creados:**
- `auth_info_{sessionId}/` - Credenciales por sesión (NO subir a Git)

---

### multimedia-downloader.js

Bot de descarga automática que guarda localmente todos los archivos multimedia recibidos, organizados por tipo.

**Características:**
- ✅ Descarga automática de imágenes, videos, audios, documentos
- ✅ Organización en carpetas por tipo (images/, videos/, audios/, documents/)
- ✅ Validación de tamaño máximo (50 MB por defecto, configurable)
- ✅ Extracción de metadata (mimetype, dimensiones, duración, etc.)
- ✅ Guardado de metadata en archivos JSON
- ✅ Nombres únicos con timestamp
- ✅ Detección automática de extensiones (30+ tipos MIME)
- ✅ Respuesta automática con información del archivo
- ✅ Reconexión automática inteligente

**Uso:**
```bash
# Instalar dependencias
npm install @whiskeysockets/baileys pino qrcode-terminal

# Ejecutar
node multimedia-downloader.js

# El bot creará automáticamente las carpetas:
# downloads/images/
# downloads/videos/
# downloads/audios/
# downloads/documents/
# downloads/stickers/
```

**Tipos de multimedia soportados:**

| Tipo       | Carpeta Destino        | Formatos Detectados       |
|------------|------------------------|---------------------------|
| Imágenes   | `downloads/images/`    | JPG, PNG, GIF, WEBP       |
| Videos     | `downloads/videos/`    | MP4, 3GP, MOV, AVI        |
| Audios     | `downloads/audios/`    | MP3, OGG, AAC, AMR, OPUS  |
| Documentos | `downloads/documents/` | PDF, DOC, DOCX, XLS, XLSX |
| Stickers   | `downloads/stickers/`  | WEBP                      |

**Configuración:**

Puedes modificar las constantes en la parte superior del archivo:

```javascript
const CONFIG = {
  // Tamaño máximo de descarga (50 MB)
  MAX_DOWNLOAD_SIZE: 50 * 1024 * 1024,
  
  // Carpetas personalizadas
  DOWNLOAD_FOLDERS: {
    image: './downloads/images',
    video: './downloads/videos',
    audio: './downloads/audios',
    document: './downloads/documents',
    sticker: './downloads/stickers'
  },
  
  // Respuesta automática al usuario
  AUTO_REPLY: true,
  
  // Log detallado de metadata en consola
  LOG_METADATA: true
};
```

**Ejemplo de metadata guardada:**

Para cada archivo descargado, se guarda un JSON con metadata:

```json
{
  "mimetype": "image/jpeg",
  "fileLength": 245678,
  "fileName": "foto.jpg",
  "caption": "Mi foto de perfil",
  "timestamp": 1735689600000,
  "width": 1920,
  "height": 1080
}
```

**Archivos creados:**
- `auth_info_multimedia/` - Credenciales de sesión (NO subir a Git)
- `downloads/images/` - Imágenes descargadas
- `downloads/videos/` - Videos descargados
- `downloads/audios/` - Audios descargados
- `downloads/documents/` - Documentos descargados
- `downloads/stickers/` - Stickers descargados
- `*.json` - Archivos de metadata por cada descarga

**Respuesta automática al usuario:**

Cuando se descarga un archivo, el bot responde con:

```
✅ *Archivo Descargado*

📁 Tipo: image
📄 Nombre: 2025-01-31_1735689600_foto.jpg
💾 Tamaño: 240.00 KB
📐 Dimensiones: 1920x1080
🔗 Ruta: ./downloads/images/2025-01-31_1735689600_foto.jpg
```

**Integración en tu bot:**

Puedes extraer la función `downloadAndSaveMedia()` del script para usar en tu propio bot:

```javascript
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');

// Importar función desde multimedia-downloader.js
// o copiar la función directamente

sock.ev.on('messages.upsert', async ({ messages }) => {
  for (const msg of messages) {
    const hasMedia = msg.message?.imageMessage || 
                     msg.message?.videoMessage ||
                     msg.message?.audioMessage ||
                     msg.message?.documentMessage;
    
    if (hasMedia) {
      const result = await downloadAndSaveMedia(msg, sock);
      
      if (result.success) {
        console.log(`✅ Descargado: ${result.filePath}`);
      }
    }
  }
});
```

```

---

### multimedia-api.js

Servidor API REST (Express) para enviar mensajes multimedia en tres escenarios diferentes.

**Endpoints:**

| Método | Endpoint | Escenario | Payload (JSON) |
|--------|----------|-----------|----------------|
| `POST` | `/api/send/url` | URL Remota | `{ to, url, caption }` |
| `POST` | `/api/send/local` | URI Local | `{ to, fileName, caption }` |
| `POST` | `/api/send/upload` | Carga (Upload) | `Form-Data (file, to, caption)` |

**Uso:**
```bash
# Instalar dependencias adicionales
npm install express multer

# Ejecutar servidor
node multimedia-api.js
```

**Escenarios detallados:**

1.  **URL Remota**: Envía archivos desde links externos. El backend deduce automáticamente si es `image`, `video`, `audio` o `document`.
2.  **URI Local**: Envía archivos que ya están en el servidor (en la carpeta `./public/media/`). Solo necesitas pasar el nombre del archivo y el destinatario `to`.
3.  **Upload (Carga)**: El cliente sube un archivo mediante un formulario. El backend detecta el tipo por el `mimetype` y lo envía. No requiere que el frontend envíe el tipo de archivo.

---

### multi-session-dashboard/

Dashboard HTML/CSS/JS para gestionar sesiones visualmente.

**Contenido:**
- `index.html` - Estructura HTML del dashboard
- `style.css` - Estilos responsivos
- `app.js` - Lógica JavaScript con polling de QR
- `qrcode.min.js` - Librería QRCode **YA INCLUIDA** (davidshimjs/qrcodejs)

**⚠️ IMPORTANTE:**

El archivo `qrcode.min.js` **YA ESTÁ INCLUIDO** en esta carpeta. NO es necesario descargarlo.

Simplemente copia la carpeta completa:
```bash
cp -r .github/skills/whatsapp-baileys/scripts/multi-session-dashboard ./
```

La librería ya incluida es `qrcodejs` de davidshimjs, que tiene la API correcta:
- ✅ qrcodejs (incluida): `new QRCode(element, options)`
- ❌ npm qrcode (NO usar): `QRCode.toCanvas()` - API diferente

**Uso correcto del QR en HTML:**
```javascript
// Contenedor DEBE ser <div>, NO <canvas>
const container = document.getElementById('qrCanvas')
container.innerHTML = '' // Limpiar previo

new QRCode(container, {
    text: qrText,
    width: 280,
    height: 280,
    colorDark: "#000000",
    colorLight: "#ffffff"
})
```

---

### verify-environment.js

Script para verificar que el entorno tiene todas las dependencias necesarias.

**Uso:**
```bash
node verify-environment.js
```

---

## 🔧 Configuración

### Variables de Entorno (Opcional)

Puedes crear un archivo `.env` para configuración avanzada:

```env
# Logger level
LOG_LEVEL=silent

# Auth folder
AUTH_FOLDER=auth_info

# Media folders
VIDEO_FOLDER=public/video
IMAGE_FOLDER=public/images
```

### Estructura de Carpetas

```
mi-proyecto/
├── node_modules/
├── auth_info/           # Auto-generado (NO subir a Git)
├── public/
│   ├── video/
│   │   └── sample.mp4
│   ├── images/
│   │   └── sample.jpg
│   └── files/
│       └── example.xlsx
├── index.js             # Tu bot
├── package.json
└── .gitignore
```

## 🐛 Solución de Problemas

### Error: Cannot find module '@whiskeysockets/baileys'
```bash
npm install @whiskeysockets/baileys
```

### Error 405: Connection Failure
El script ya incluye la solución. Verifica que estés usando Node.js 16+.

### Error 440: Stream Errored (conflict)
Cierra otras instancias del bot:
```bash
pkill -f "node.*basic-bot-example"
```

### QR no aparece
El script usa `qrcode-terminal`. Si no se ve, verifica la terminal:
- ✅ Funciona: iTerm, GNOME Terminal, Windows Terminal
- ❌ No funciona bien: VS Code terminal (a veces)

Solución: Ejecutar en terminal nativa del sistema.

### Sesión se desconecta constantemente
- Verifica que no haya otra instancia corriendo
- Cierra WhatsApp Web en navegadores si hay conflictos
- Elimina `auth_info/` y reconecta

## 📚 Más Ejemplos

- [Bot con Comandos Avanzados](../templates/bot-with-commands.ts)
- [Conexión Básica](../templates/basic-connection.ts)
- [Guía Completa](../references/baileys-complete-guide.md)

## 🤝 Contribuir

Para agregar más ejemplos:

1. Crear archivo en este directorio
2. Agregar documentación aquí
3. Asegurar que incluye manejo de errores comunes
4. Probar en entorno limpio

## 📄 Licencia

Ver [LICENSE.txt](../LICENSE.txt)

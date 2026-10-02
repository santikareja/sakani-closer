# WhatsApp Baileys Skill - README

Esta es una Agent Skill completa para trabajar con la librería Baileys (WhatsApp Web API no oficial).

## Estructura de la Skill

```
whatsapp-baileys/
├── SKILL.md                    # Instrucciones principales de la skill
├── LICENSE.txt                 # Licencia Apache 2.0
├── scripts/                    # Scripts de ejemplo listos para usar
│   ├── README.md                   # Documentación de scripts
│   ├── basic-bot-example.js        # Bot funcional sin errores (RECOMENDADO)
│   └── verify-environment.js       # Verificar entorno
├── references/                 # Documentación detallada
│   ├── baileys-complete-guide.md   # Guía exhaustiva de Baileys
│   ├── database-schemas.md         # Esquemas SQL y NoSQL
│   └── deployment-guide.md         # Guía de deployment
└── templates/                  # Templates de código
    ├── basic-connection.ts         # Conexión básica
    └── bot-with-commands.ts        # Bot completo con comandos
```

## 🚀 Inicio Rápido

**La forma más rápida de empezar:**

```bash
# 1. Instalar dependencias
npm install @whiskeysockets/baileys pino qrcode-terminal

# 2. Copiar ejemplo básico funcional
cp .github/skills/whatsapp-baileys/scripts/basic-bot-example.js ./index.js

# 3. Ejecutar
node index.js
```

El script `basic-bot-example.js` incluye **todas las correcciones para evitar errores comunes** (405, 440, 408, QR deprecado, etc.).

## Activación Automática

Esta skill se activa automáticamente cuando GitHub Copilot detecta que necesitas:

- Crear un bot de WhatsApp
- Enviar/recibir mensajes de WhatsApp
- Implementar autenticación (QR o código de emparejamiento)
- Gestionar grupos de WhatsApp
- Enviar media (imágenes, videos, audio, documentos)
- Diseñar arquitectura de base de datos para WhatsApp
- Desplegar un bot en producción

## Keywords que Activan la Skill

- WhatsApp
- Baileys
- @whiskeysockets/baileys
- WhatsApp Web
- chatbot WhatsApp
- bot de WhatsApp
- mensajes WhatsApp
- QR WhatsApp
- grupos WhatsApp

## Recursos Incluidos

### 🎯 Scripts de Ejemplo

1. **basic-bot-example.js** ⭐ **RECOMENDADO**
   - Bot completo funcional sin errores comunes
   - Incluye todas las correcciones para 405, 440, 408
   - QR en terminal, respuestas automáticas
   - Reconexión inteligente y limpieza de sesión
   - Listo para copiar y usar

2. **verify-environment.js**
   - Verificar dependencias y versiones
   - Diagnóstico del entorno

### Guías de Referencia

1. **baileys-complete-guide.md** (200+ líneas)
   - Instalación y setup
   - Autenticación (QR terminal, QR web, código de emparejamiento)
   - Estructura de mensajes recibidos
   - Envío de todos los tipos de mensajes
   - Eventos del socket
   - Operaciones avanzadas
   - Gestión de grupos
   - Ejemplos completos

2. **database-schemas.md** (300+ líneas)
   - Esquemas SQL completos (PostgreSQL/MySQL)
   - Esquemas NoSQL (MongoDB)
   - Implementación de AuthState personalizado
   - Índices recomendados
   - Estrategias de backup

3. **deployment-guide.md** (250+ líneas)
   - Configuración con PM2
   - Dockerización completa
   - Variables de entorno
   - Nginx como reverse proxy
   - Monitoreo y logging
   - Backup automatizado
   - Escalabilidad

### Templates de Código

1. **basic-connection.ts**
   - Conexión básica con QR en terminal
   - Reconexión automática
   - Manejo básico de mensajes
   - Respuesta automática simple

2. **bot-with-commands.ts**
   - Sistema completo de comandos
   - Clase reutilizable `WhatsAppBot`
   - Manejo de diferentes tipos de mensajes
   - Comandos incluidos: !help, !ping, !info, !echo, !sticker, !react
   - Logs organizados
   - Manejo robusto de errores

## Uso de la Skill

Una vez instalada, simplemente menciona palabras clave relacionadas con WhatsApp en tu conversación con GitHub Copilot:

## 💬 Cómo Hacer Prompts Efectivos para Esta Skill

Para obtener implementaciones correctas y sin errores desde el primer intento, estructura tu prompt así:

### ✅ Plantilla de Prompt Recomendada

```
Necesito [descripción de lo que quieres hacer con WhatsApp].

Usa la skill whatsapp-baileys y sigue los ejemplos de código que proporciona.
```

### 📝 Ejemplos de Prompts Efectivos

**Ejemplo 1: Bot básico**
```
Crea un bot de WhatsApp básico que responda mensajes.
Usa la skill whatsapp-baileys y sigue el ejemplo basic-bot-example.js
```

**Ejemplo 2: Descarga de multimedia**
```
Necesito un bot que descargue automáticamente imágenes, videos y documentos.
Lee la skill whatsapp-baileys y usa el ejemplo multimedia-downloader.js como base.
```

**Ejemplo 3: Multi-sesión**
```
Implementa un sistema multi-sesión para gestionar varias cuentas de WhatsApp.
Usa la skill whatsapp-baileys, específicamente la guía de multi-session.js
```

**Ejemplo 4: Personalizado desde cero**
```
Crea un bot de WhatsApp que [describe tu funcionalidad específica].

IMPORTANTE: Usa la skill whatsapp-baileys
1. Revisa los scripts en .github/skills/whatsapp-baileys/scripts/
2. Aplica los patrones de código de los ejemplos (estructura de socket, manejo de QR, reconexión)
3. NO improvises la estructura, sigue lo documentado
```

### 🎯 Elementos Clave en Tu Prompt

| Elemento | Por qué es importante |
|----------|----------------------|
| **"Usa la skill whatsapp-baileys"** | Activa la consulta de documentación y ejemplos |
| **"Sigue los ejemplos/patrones"** | Indica que debe usar código probado, no inventar |
| **"Lee/revisa .github/skills/..."** | Dirige a los archivos de referencia específicos |
| **"Aplica los patrones de..."** | Asegura que se copien las estructuras correctas |

### ❌ Prompts que Pueden Generar Errores

Evita prompts vagos sin mencionar la skill:

```
❌ "Crea un bot de WhatsApp"
❌ "Necesito conectar WhatsApp en Node.js"
❌ "Haz un bot que descargue archivos"
```

**Problema**: Sin mencionar la skill, el agente puede intentar implementar desde cero sin consultar los patrones documentados.

### ✨ Prompt Perfecto (Máximo Detalle)

```
Necesito [tu funcionalidad].

REQUERIMIENTOS:
- Usa la skill whatsapp-baileys ubicada en .github/skills/whatsapp-baileys/
- Revisa estos archivos de ejemplo antes de implementar:
  * basic-bot-example.js (estructura base)
  * multimedia-downloader.js (descarga de archivos)
  * multi-session.js (múltiples líneas)
- Aplica estos patrones obligatorios:
  * fetchLatestBaileysVersion() para obtener la versión
  * NO usar printQRInTerminal (deprecado)
  * Manejo manual del QR en connection.update
  * Control de reconexión con isReconnecting
  * syncFullHistory: false (evitar errores 405)
- Si hay dudas, consulta el SKILL.md completo
```

### 🔍 Verificación: ¿Tu Prompt es Efectivo?

Pregúntate:

- [ ] ¿Mencioné explícitamente "skill whatsapp-baileys"?
- [ ] ¿Indiqué que use los ejemplos/patrones de la skill?
- [ ] ¿Especifiqué qué archivos de ejemplo revisar?
- [ ] ¿Dejé claro que NO debe improvisar la estructura?

Si respondiste **SÍ a al menos 2**, tu prompt es efectivo.

### 💡 Tip Pro

Cuando necesites algo muy específico, primero pide:
```
Lista los ejemplos disponibles en la skill whatsapp-baileys 
y recomiéndame cuál usar para [tu caso de uso]
```

Luego usa el ejemplo recomendado como base.

### Ejemplos de Prompts Generales

```
"Crea un bot de WhatsApp con Baileys que responda mensajes"
"Necesito enviar una imagen por WhatsApp"
"¿Cómo conecto WhatsApp sin QR usando código de emparejamiento?"
"Diseña una base de datos para guardar mensajes de WhatsApp"
"Cómo desplegar mi bot de WhatsApp en producción con Docker"
"Implementa un sistema de comandos para WhatsApp"
```

Copilot cargará automáticamente esta skill y te proporcionará soluciones completas con ejemplos.

## Instalación de la Skill

### Para el Proyecto Actual

Ya está instalada en `.github/skills/whatsapp-baileys/`

### Para Uso Personal (Todos tus Proyectos)

Copia la carpeta completa a tu directorio personal:

```bash
mkdir -p ~/.github/skills
cp -r .github/skills/whatsapp-baileys ~/.github/skills/
```

## Requisitos Previos

- Node.js 16+ 
- npm o yarn
- Base de datos (PostgreSQL, MySQL o MongoDB)
- Redis (opcional, para colas y cache)

## Quick Start

1. **Instalar Baileys**
   ```bash
   npm install @whiskeysockets/baileys
   ```

2. **Usar un template**
   ```bash
   # Copiar template básico
   cp .github/skills/whatsapp-baileys/templates/basic-connection.ts src/index.ts
   
   # O el bot completo
   cp .github/skills/whatsapp-baileys/templates/bot-with-commands.ts src/bot.ts
   ```

3. **Ejecutar**
   ```bash
   npx ts-node src/index.ts
   ```

4. **Escanear QR**
   - Se mostrará un código QR en la terminal
   - Escanear con WhatsApp > Dispositivos vinculados

## Contribuir

Para mejorar esta skill:

1. Edita `SKILL.md` para instrucciones principales
2. Agrega nuevas guías en `references/`
3. Crea nuevos templates en `templates/`
4. Actualiza este README

## Licencia

Apache License 2.0 - Ver LICENSE.txt para detalles completos.

## Recursos Externos

- [Documentación Oficial Baileys](https://baileys.wiki)
- [Repositorio GitHub](https://github.com/WhiskeySockets/Baileys)
- [API Reference](https://baileys.whiskeysockets.io/)
- [Discord Comunidad](https://discord.gg/WeJM5FP9GG)

## Soporte

Para problemas con:
- **La skill**: Abre un issue en este repositorio
- **Baileys**: Visita el [repositorio oficial](https://github.com/WhiskeySockets/Baileys/issues)
- **Copilot**: Contacta al soporte de GitHub

---

**Nota**: Esta skill está optimizada para Baileys v7.0.0+. Para versiones anteriores, consulta la [guía de migración](https://whiskey.so/migrate-latest).

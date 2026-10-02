const API_URL = 'http://localhost:3000/api/sessions'
let qrUpdateInterval = null
let currentSessionId = null

// Crear sesión
async function createSession() {
    const sessionId = document.getElementById('sessionId').value.trim()
    
    if (!sessionId) {
        alert('Debes ingresar un nombre de sesión')
        return
    }
    
    try {
        const response = await fetch(`${API_URL}/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId })
        })
        
        const data = await response.json()
        
        if (response.ok && data.qr) {
            showQR(data.qr, sessionId)
            document.getElementById('sessionId').value = ''
            setTimeout(loadSessions, 1000)
        } else {
            alert(`Error: ${data.error || 'No se recibió QR'}`)
        }
    } catch (error) {
        alert(`Error: ${error.message}`)
    }
}

// Mostrar QR
function showQR(qrText, sessionId) {
    const container = document.getElementById('qr-container')
    const text = container.querySelector('.qr-text')
    
    if (typeof QRCode === 'undefined') {
        alert('Error: Librería QRCode no cargada. Recarga la página.')
        return
    }
    
    container.style.display = 'flex'
    text.textContent = `Sesión: ${sessionId} - Escanea con WhatsApp`
    
    // Limpiar canvas previo
    const canvas = document.getElementById('qrCanvas')
    canvas.innerHTML = ''
    
    // Generar QR
    new QRCode(canvas, {
        text: qrText,
        width: 280,
        height: 280,
        colorDark: "#000000",
        colorLight: "#ffffff"
    })
    
    // Iniciar polling para actualizar el QR
    startQRPolling(sessionId)
}

// Iniciar polling del QR
function startQRPolling(sessionId) {
    // Limpiar polling anterior si existe
    if (qrUpdateInterval) {
        clearInterval(qrUpdateInterval)
    }
    
    currentSessionId = sessionId
    
    // Actualizar cada 5 segundos
    qrUpdateInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_URL}/${sessionId}/qr`)
            const data = await response.json()
            
            if (response.ok && data.qr) {
                // Actualizar QR sin reiniciar el polling
                const canvas = document.getElementById('qrCanvas')
                canvas.innerHTML = ''
                new QRCode(canvas, {
                    text: data.qr,
                    width: 280,
                    height: 280,
                    colorDark: "#000000",
                    colorLight: "#ffffff"
                })
            } else if (data.error && data.error.includes('conectado')) {
                // Sesión conectada, detener polling
                stopQRPolling()
                document.getElementById('qr-container').style.display = 'none'
                alert(`✅ Sesión ${sessionId} conectada exitosamente`)
                loadSessions()
            }
        } catch (error) {
            console.error('Error actualizando QR:', error)
        }
    }, 5000)
}

// Detener polling del QR
function stopQRPolling() {
    if (qrUpdateInterval) {
        clearInterval(qrUpdateInterval)
        qrUpdateInterval = null
        currentSessionId = null
    }
}

// Cargar sesiones
async function loadSessions() {
    const list = document.getElementById('sessions-list')
    const select = document.getElementById('sendSession')
    
    try {
        const response = await fetch(API_URL)
        const data = await response.json()
        
        if (response.ok && data.sessions) {
            if (data.sessions.length === 0) {
                list.innerHTML = '<p class="loading">No hay sesiones activas</p>'
                select.innerHTML = '<option value="">No hay sesiones</option>'
                return
            }
            
            list.innerHTML = ''
            data.sessions.forEach(session => {
                list.appendChild(createSessionCard(session))
            })
            
            select.innerHTML = '<option value="">Selecciona una sesión</option>'
            data.sessions.forEach(session => {
                if (session.status === 'connected') {
                    const option = document.createElement('option')
                    option.value = session.sessionId
                    option.textContent = `${session.sessionId}`
                    select.appendChild(option)
                }
            })
        }
    } catch (error) {
        list.innerHTML = '<p class="loading">Error de conexión</p>'
    }
}

// Crear tarjeta de sesión
function createSessionCard(session) {
    const div = document.createElement('div')
    div.className = 'session-item'
    
    const statusClass = `status-${session.status}`
    const statusText = {
        'connected': '✅ Conectado',
        'qr_ready': '⏳ QR Listo',
        'connecting': '🔄 Conectando',
        'reconnecting': '🔄 Reconectando',
        'failed': '❌ Fallido',
        'not_initialized': '⚪ No iniciado'
    }[session.status] || session.status
    
    div.innerHTML = `
        <div class="session-header">
            <span class="session-name">${session.sessionId}</span>
            <span class="session-status ${statusClass}">${statusText}</span>
        </div>
        <div class="session-info">📞 ${session.phoneNumber || 'Sin número'}</div>
        <div class="session-info">📁 ${session.folder}</div>
        <div class="session-actions">
            <button class="btn-info" onclick="getStatus('${session.sessionId}')">Estado</button>
            <button class="btn-danger" onclick="closeSession('${session.sessionId}')">Cerrar</button>
        </div>
    `
    
    return div
}

// Obtener QR
async function getQR(sessionId) {
    try {
        const response = await fetch(`${API_URL}/${sessionId}/qr`)
        const data = await response.json()
        
        if (response.ok && data.qr) {
            showQR(data.qr, sessionId)
        } else {
            alert(`Error: ${data.error}`)
        }
    } catch (error) {
        alert(`Error: ${error.message}`)
    }
}

// Obtener estado
async function getStatus(sessionId) {
    try {
        const response = await fetch(`${API_URL}/${sessionId}/status`)
        const data = await response.json()
        
        if (response.ok) {
            alert(`Estado: ${data.status}\nNúmero: ${data.phoneNumber || 'Sin número'}`)
        } else {
            alert(`Error: ${data.error}`)
        }
    } catch (error) {
        alert(`Error: ${error.message}`)
    }
}

// Cerrar sesión
async function closeSession(sessionId) {
    if (!confirm(`¿Cerrar sesión ${sessionId}?`)) return
    
    try {
        const response = await fetch(`${API_URL}/${sessionId}`, {
            method: 'DELETE'
        })
        
        if (response.ok) {
            setTimeout(loadSessions, 500)
        } else {
            const data = await response.json()
            alert(`Error: ${data.error}`)
        }
    } catch (error) {
        alert(`Error: ${error.message}`)
    }
}

// Enviar mensaje
async function sendMessage() {
    const sessionId = document.getElementById('sendSession').value
    const phone = document.getElementById('phoneNumber').value.trim()
    const message = document.getElementById('messageText').value.trim()
    
    if (!sessionId || !phone || !message) {
        alert('Completa todos los campos')
        return
    }
    
    let to = phone
    if (!to.includes('@s.whatsapp.net')) {
        to = `${phone}@s.whatsapp.net`
    }
    
    try {
        const response = await fetch(`${API_URL}/${sessionId}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to, message })
        })
        
        if (response.ok) {
            alert('Mensaje enviado')
            document.getElementById('phoneNumber').value = ''
            document.getElementById('messageText').value = ''
        } else {
            const data = await response.json()
            alert(`Error: ${data.error}`)
        }
    } catch (error) {
        alert(`Error: ${error.message}`)
    }
}

// Cargar sesiones al inicio
loadSessions()

// Enter para crear sesión
document.getElementById('sessionId').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') createSession()
})

// Enter para enviar mensaje
document.getElementById('messageText').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage()
})

#!/usr/bin/env node

/**
 * Script de verificación para la skill whatsapp-baileys
 * 
 * Verifica que todas las dependencias estén instaladas
 * y que el entorno esté listo para usar Baileys
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando entorno para WhatsApp Baileys...\n');

const checks = {
    passed: [],
    failed: [],
    warnings: []
};

// 1. Verificar Node.js
try {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion >= 16) {
        checks.passed.push(`✅ Node.js ${nodeVersion} (requerido: 16+)`);
    } else {
        checks.failed.push(`❌ Node.js ${nodeVersion} - Versión muy antigua (requerido: 16+)`);
    }
} catch (error) {
    checks.failed.push('❌ No se pudo verificar Node.js');
}

// 2. Verificar npm/yarn
try {
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    checks.passed.push(`✅ npm ${npmVersion} instalado`);
} catch {
    checks.warnings.push('⚠️  npm no encontrado');
}

try {
    const yarnVersion = execSync('yarn --version', { encoding: 'utf8' }).trim();
    checks.passed.push(`✅ yarn ${yarnVersion} instalado`);
} catch {
    // Yarn es opcional
}

// 3. Verificar si Baileys está instalado
try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    
    if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        if (deps['@whiskeysockets/baileys']) {
            checks.passed.push(`✅ Baileys ${deps['@whiskeysockets/baileys']} en package.json`);
        } else {
            checks.warnings.push('⚠️  Baileys no está en package.json');
            console.log('   Instalar con: npm install @whiskeysockets/baileys\n');
        }
        
        // Verificar dependencias recomendadas
        const recommended = {
            '@hapi/boom': 'Manejo de errores',
            'pino': 'Logger',
            'qrcode-terminal': 'QR en terminal',
            'qrcode': 'Generación de QR'
        };
        
        for (const [pkg, desc] of Object.entries(recommended)) {
            if (deps[pkg]) {
                checks.passed.push(`✅ ${pkg} instalado (${desc})`);
            }
        }
    } else {
        checks.warnings.push('⚠️  No se encontró package.json en el directorio actual');
        console.log('   Inicializar con: npm init -y\n');
    }
} catch (error) {
    checks.warnings.push('⚠️  Error verificando package.json');
}

// 4. Verificar ffmpeg (para procesamiento de media)
try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    checks.passed.push('✅ ffmpeg instalado (para procesamiento de media)');
} catch {
    checks.warnings.push('⚠️  ffmpeg no encontrado (necesario para audio/video)');
    console.log('   Instalar: sudo apt install ffmpeg (Linux) o brew install ffmpeg (Mac)\n');
}

// 5. Verificar estructura de directorios
const projectDirs = ['src', 'dist', 'auth_info_baileys', 'logs'];
const existingDirs = projectDirs.filter(dir => fs.existsSync(path.join(process.cwd(), dir)));

if (existingDirs.length > 0) {
    checks.passed.push(`✅ Directorios de proyecto encontrados: ${existingDirs.join(', ')}`);
}

// Mostrar resultados
console.log('\n📊 RESUMEN DE VERIFICACIÓN\n');

if (checks.passed.length > 0) {
    console.log('✅ PASADAS:');
    checks.passed.forEach(msg => console.log(`   ${msg}`));
    console.log('');
}

if (checks.warnings.length > 0) {
    console.log('⚠️  ADVERTENCIAS:');
    checks.warnings.forEach(msg => console.log(`   ${msg}`));
    console.log('');
}

if (checks.failed.length > 0) {
    console.log('❌ FALLADAS:');
    checks.failed.forEach(msg => console.log(`   ${msg}`));
    console.log('');
}

// Puntuación final
const total = checks.passed.length + checks.warnings.length + checks.failed.length;
const score = (checks.passed.length / total) * 100;

console.log(`\n📈 Puntuación: ${score.toFixed(0)}%\n`);

if (score === 100) {
    console.log('🎉 ¡Entorno completamente listo para Baileys!\n');
} else if (score >= 70) {
    console.log('👍 Entorno mayormente listo. Revisar advertencias.\n');
} else {
    console.log('⚠️  Se requiere configuración adicional.\n');
}

// Instrucciones de inicio rápido
console.log('📚 INICIO RÁPIDO:\n');
console.log('1. Instalar dependencias:');
console.log('   npm install @whiskeysockets/baileys @hapi/boom pino qrcode-terminal\n');
console.log('2. Copiar template:');
console.log('   cp .github/skills/whatsapp-baileys/templates/basic-connection.ts src/index.ts\n');
console.log('3. Ejecutar:');
console.log('   npx ts-node src/index.ts\n');
console.log('4. Escanear QR con WhatsApp > Dispositivos vinculados\n');

process.exit(checks.failed.length > 0 ? 1 : 0);

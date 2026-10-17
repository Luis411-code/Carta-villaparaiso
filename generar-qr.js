const crypto = require('crypto');
const SECRETO = 'VillaParaiso-Secreto-Muy-Dificil-De-Adivinar-2025';

const mesa = process.argv[2];

if (!mesa) {
    console.log('❌ Por favor, indica el número de mesa.');
    console.log('Ejemplo: node generar-qr.js 1');
    process.exit(1);
}

const hash = crypto.createHash('sha256').update(mesa + SECRETO).digest('hex').slice(0, 12);
const url = `https://villaparaiso.vercel.app/?mesa=${mesa}&t=${hash}`;

console.log('\n=========================================');
console.log(`✅ URL PARA EL QR DE LA MESA ${mesa}:`);
console.log(url);
console.log('=========================================\n');
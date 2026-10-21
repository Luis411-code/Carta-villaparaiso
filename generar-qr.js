const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');
const sharp = require('sharp'); // 👈 Nueva librería para las imágenes

// --- Configuración (debe coincidir con tu middleware.ts) ---
const SECRETO = 'VillaParaiso-Secreto-Muy-Dificil-De-Adivinar-2025';
const BASE_URL = 'https://villaparaiso.vercel.app';

// --- Configuración de los QRs ---
const OUTPUT_DIR = path.join(__dirname, 'qrs-mesas');
const LOGO_PATH = path.join(__dirname, 'img', 'logo.png'); // Ruta de tu logo
const MESAS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 'barra', 'terraza'];

async function generarTodosLosQRs() {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`📁 Carpeta creada: ${OUTPUT_DIR}`);
    }

    // Tamaño del QR final
    const QR_SIZE = 800;
    // Tamaño del logo (aprox 22% del tamaño del QR, es el límite seguro para que se pueda escanear)
    const LOGO_SIZE = 180; 

    for (const mesa of MESAS) {
        try {
            const hash = crypto.createHash('sha256').update(mesa + SECRETO).digest('hex').slice(0, 12);
            const url = `${BASE_URL}/?mesa=${encodeURIComponent(mesa)}&t=${hash}`;
            const fileName = `qr-mesa-${mesa}.png`;
            const filePath = path.join(OUTPUT_DIR, fileName);

            // 1. Generar el QR como un Buffer (en memoria)
            const qrBuffer = await QRCode.toBuffer(url, {
                color: { dark: '#000000', light: '#FFFFFF' },
                width: QR_SIZE,
                margin: 2,
                errorCorrectionLevel: 'H' // Nivel Alto (H) obligatorio para poner logos
            });

            // 2. Preparar el logo (redimensionarlo y ponerle un pequeño marco blanco)
            // El marco blanco evita que los cuadros negros del QR se asomen por los bordes del logo
            const logoBuffer = await sharp(LOGO_PATH)
                .resize(LOGO_SIZE, LOGO_SIZE, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
                .extend({
                    top: 10, bottom: 10, left: 10, right: 10,
                    background: { r: 255, g: 255, b: 255, alpha: 1 } // Fondo blanco
                })
                .toBuffer();

            // 3. Superponer el logo en el centro del QR y guardar
            await sharp(qrBuffer)
                .composite([{
                    input: logoBuffer,
                    gravity: 'center' // 👈 Esto lo coloca justo en el medio
                }])
                .toFile(filePath);

            console.log(`✅ QR generado para Mesa: ${mesa} -> ${fileName}`);
        } catch (err) {
            console.error(`❌ Error al generar QR para mesa ${mesa}:`, err);
        }
    }
    console.log(`\n🎉 ¡Listo! Todos los QRs con logo están en la carpeta: ${OUTPUT_DIR}`);
}

generarTodosLosQRs();
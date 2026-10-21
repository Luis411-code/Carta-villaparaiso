// middleware.ts
export const config = {
  runtime: 'edge',
  matcher: '/',
};

const SECRETO = 'VillaParaiso-Secreto-Muy-Dificil-De-Adivinar-2025';

async function generarHash(mesa: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(mesa + SECRETO);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
}

// Aquí diseñamos la pantalla de bloqueo
const HTML_BLOQUEO = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Villa Paraíso · Acceso Exclusivo</title>
  <link rel="icon" type="image/png" href="/img/logo.png">
  <link href="https://fonts.bunny.net/css?family=cinzel:400,600,700|poppins:300,400,600" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Poppins', sans-serif;
      background-color: #0a120d;
      color: #fdfaf5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background-image: 
        radial-gradient(circle at 50% 0%, rgba(212,163,115,0.1) 0%, transparent 60%),
        radial-gradient(circle at 50% 100%, rgba(46,125,50,0.1) 0%, transparent 50%);
    }
    .container {
      text-align: center;
      max-width: 400px;
      animation: fadeIn 1s ease;
    }
    .logo {
      width: 90px; height: 90px;
      border-radius: 50%;
      border: 2px solid #D4A373;
      padding: 5px;
      background: #fdfaf5;
      margin-bottom: 25px;
      box-shadow: 0 0 30px rgba(212,163,115,0.2);
    }
    h1 {
      font-family: 'Cinzel', serif;
      font-size: 6rem;
      color: transparent;
      -webkit-text-stroke: 1.5px #D4A373;
      margin-bottom: 5px;
      line-height: 1;
      letter-spacing: 4px;
      text-shadow: 0 0 40px rgba(212,163,115,0.2);
    }
    .divider {
      display: flex; align-items: center; justify-content: center; gap: 15px;
      margin-bottom: 20px;
    }
    .divider::before, .divider::after {
      content: ""; height: 1px; width: 50px;
      background: linear-gradient(90deg, transparent, #D4A373, transparent);
    }
    .divider span { color: #D4A373; font-size: 0.8rem; }
    h2 {
      font-family: 'Cinzel', serif;
      font-size: 1.1rem;
      color: #fdfaf5;
      letter-spacing: 4px;
      text-transform: uppercase;
      margin-bottom: 15px;
    }
    p {
      font-size: 0.85rem;
      color: #888;
      line-height: 1.7;
      font-weight: 300;
    }
    .icon-qr {
      margin-top: 30px;
      font-size: 2.5rem;
      opacity: 0.3;
      filter: grayscale(1);
    }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
  </style>
</head>
<body>
  <div class="container">
    <img src="/img/logo.png" alt="Villa Paraíso" class="logo" onerror="this.style.display='none'">
    
    <h1>404</h1>
    
    <div class="divider">
      <span>✦</span>
    </div>
    
    <h2>Acceso Exclusivo</h2>
    
    <p>
      Esta experiencia está reservada para nuestros comensales.<br>
      Por favor, escanea el código QR de tu mesa para descubrir nuestra carta.
    </p>

    <div class="icon-qr">📱</div>
  </div>
</body>
</html>
`;

export default async function middleware(request: Request) {
  const url = new URL(request.url);
  const mesa = url.searchParams.get('mesa');
  const token = url.searchParams.get('t');

  let accesoDenegado = false;

  if (!mesa || !token) {
    accesoDenegado = true;
  } else {
    const tokenEsperado = await generarHash(mesa);
    if (token !== tokenEsperado) {
      accesoDenegado = true;
    }
  }

  if (accesoDenegado) {
    // Devolvemos nuestra pantalla elegante con status 404
    return new Response(HTML_BLOQUEO, {
      status: 404,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store, max-age=0',
      },
    });
  }

  return new Response(null, { headers: { 'x-middleware-next': '1' } });
}
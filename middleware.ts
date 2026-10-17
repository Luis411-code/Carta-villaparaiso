// middleware.ts (en la raíz del proyecto)
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

export default async function middleware(request: Request) {
  const url = new URL(request.url);
  const mesa = url.searchParams.get('mesa');
  const token = url.searchParams.get('t');

  // Si no hay mesa o token, bloqueamos el acceso
  if (!mesa || !token) {
    return new Response('Acceso denegado. Por favor, escanea el código QR de tu mesa.', {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  // Verificamos que el token coincida con la mesa
  const tokenEsperado = await generarHash(mesa);

  if (token !== tokenEsperado) {
    return new Response('Token inválido. Acceso no autorizado.', {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  // Si todo está correcto, dejamos pasar la petición
  return new Response(null, { headers: { 'x-middleware-next': '1' } });
}
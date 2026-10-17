import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';


const SECRETO = 'VillaParaiso-Secreto-Muy-Dificil-De-Adivinar-2025';

async function generarHash(mesa: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(mesa + SECRETO);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  // Convertimos a hexadecimal y cortamos para que sea más corto
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
}

export async function middleware(request: NextRequest) {
  const { searchParams, pathname } = request.nextUrl;

  // Solo protegemos la ruta principal (la carta)
  if (pathname !== '/') {
    return NextResponse.next();
  }

  const mesa = searchParams.get('mesa');
  const token = searchParams.get('t');

  // Si no hay mesa o token, bloqueamos el acceso
  if (!mesa || !token) {
    return new NextResponse('Acceso denegado. Por favor, escanea el código QR de tu mesa.', {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  // Verificamos que el token coincida con la mesa
  const tokenEsperado = await generarHash(mesa);

  if (token !== tokenEsperado) {
    return new NextResponse('Token inválido. Acceso no autorizado.', {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  // Si todo está correcto, dejamos pasar la petición
  return NextResponse.next();
}

// Configuración para que solo se ejecute en la página principal
export const config = {
  matcher: '/',
};
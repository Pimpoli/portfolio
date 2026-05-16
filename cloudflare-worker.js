/**
 * Cloudflare Worker — Proxy autenticado para Roblox Presence API
 *
 * SETUP (5 minutos, plan Free de Cloudflare):
 * ─────────────────────────────────────────────────────────────────
 * 1. Ve a https://workers.cloudflare.com y crea una cuenta gratuita.
 * 2. Crea un nuevo Worker (botón "Create Worker").
 * 3. Borra el código de ejemplo y pega TODO el contenido de este archivo.
 * 4. Haz clic en "Deploy".
 * 5. Ve a Settings → Variables → "Add variable":
 *      Variable name:  ROBLOX_COOKIE
 *      Value:          (tu cookie .ROBLOSECURITY — ver instrucciones abajo)
 *      ⚠️  Marca "Encrypt" para que sea un secreto seguro.
 * 6. Copia la URL del worker, que luce así:
 *      https://roblox-presence.TU-USUARIO.workers.dev
 * 7. Abre index.html y cambia esta línea:
 *      window.PROXY_BASE = null;
 *    por:
 *      window.PROXY_BASE = 'https://roblox-presence.TU-USUARIO.workers.dev';
 * 8. Guarda, haz commit y push a GitHub. ¡Listo!
 *
 * ─── Cómo obtener tu cookie .ROBLOSECURITY ───────────────────────
 * 1. Abre Roblox en el navegador e inicia sesión.
 * 2. Abre DevTools (F12) → Application → Cookies → https://www.roblox.com
 * 3. Busca la cookie llamada ".ROBLOSECURITY" y copia su Value.
 *    ⚠️  No compartas esta cookie con nadie — equivale a tu contraseña.
 *
 * ─── Privacidad de Roblox ────────────────────────────────────────
 * Asegúrate de que en tu cuenta de Roblox:
 * Configuración → Privacidad → "¿Quién puede ver mi estado de actividad?"
 * esté en "Todos" (Everyone). Sin esto, la API devuelve Offline siempre.
 */

const ALLOWED_ORIGINS = [
  'https://pimpolidev.com',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:3000',
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url    = new URL(request.url);

    // Preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Solo aceptamos POST /presence
    if (request.method !== 'POST' || url.pathname !== '/presence') {
      return new Response('Not Found', { status: 404 });
    }

    if (!env.ROBLOX_COOKIE) {
      return new Response(JSON.stringify({ error: 'ROBLOX_COOKIE secret not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    let body;
    try {
      body = await request.text();
      JSON.parse(body); // Valida que el body sea JSON válido
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    try {
      const rbxRes = await fetch('https://presence.roblox.com/v1/presence/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept':       'application/json',
          'User-Agent':   'Mozilla/5.0 (compatible; PortfolioProxy/1.0)',
          'Cookie':       `.ROBLOSECURITY=${env.ROBLOX_COOKIE}`,
        },
        body,
      });

      const data = await rbxRes.text();
      return new Response(data, {
        status: rbxRes.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Upstream fetch failed', detail: String(err) }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }
  },
};

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) || /^https?:\/\/localhost(:\d+)?$/.test(origin);
  return {
    'Access-Control-Allow-Origin':  allowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

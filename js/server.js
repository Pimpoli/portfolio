// server.js
// Express + YouTube Data API proxy with simple in-memory cache
// Usage: set env variables YT_API_KEY and YT_CHANNEL_ID before running
// Node 18+ (native fetch) is preferred. If usas Node <18 tendrás que instalar un polyfill.

import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIG: define en variables de entorno ---
const YT_API_KEY = process.env.YT_API_KEY || '';        // <- NO exponer esto al cliente
const YT_CHANNEL_ID = process.env.YT_CHANNEL_ID || '';  // <- ID del canal (ej: UCxxxx...)
if (!YT_API_KEY || !YT_CHANNEL_ID) {
  console.warn('WARNING: YT_API_KEY or YT_CHANNEL_ID not set. /api/videos will fail until you set them.');
}

// --- Simple in-memory cache to avoid excesivas llamadas a la API (evita usar en producción para datos críticos) ---
const cache = {
  // cache.videos = [{ videoId, title, description, publishedAt, thumbnails }, ...]
  videos: null,
  expiresAt: 0,
  ttlMs: 10 * 60 * 1000 // 10 minutos por defecto
};

// Helper: fetch JSON with error handling
async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(()=>'');
    const err = new Error(`Fetch failed ${res.status} ${res.statusText} for ${url} -- ${text}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// 1) Obtiene el uploads playlist id del canal (contentDetails.relatedPlaylists.uploads)
async function getUploadsPlaylistId(channelId) {
  const url = new URL('https://www.googleapis.com/youtube/v3/channels');
  url.searchParams.set('part', 'contentDetails');
  url.searchParams.set('id', channelId);
  url.searchParams.set('key', YT_API_KEY);

  const j = await fetchJson(url.toString());
  const uploads = j.items?.[0]?.contentDetails?.relatedPlaylists?.uploads || null;
  return uploads;
}

// 2) Consulta items de un playlist (paginado). limitPages evita loops infinitos.
async function fetchPlaylistItems(playlistId, maxPages = 5) {
  let items = [];
  let pageToken = '';
  let pages = 0;

  while (pages < maxPages) {
    const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('playlistId', playlistId);
    url.searchParams.set('maxResults', '50'); // máximo permitido por llamada
    url.searchParams.set('key', YT_API_KEY);
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const j = await fetchJson(url.toString());
    items = items.concat(j.items || []);
    pageToken = j.nextPageToken || '';
    if (!pageToken) break;
    pages++;
  }

  // Mapeo a objetos simples y filtrado de vídeos válidos
  const mapped = items
    .map(it => {
      const s = it.snippet || {};
      // resourceId.kind === 'youtube#video' asegura que es vídeo (playlist puede contener otra cosa)
      if (!s.resourceId || s.resourceId.kind !== 'youtube#video') return null;
      return {
        videoId: s.resourceId.videoId,
        title: s.title || '',
        description: s.description || '',
        publishedAt: s.publishedAt || '',
        thumbnails: s.thumbnails || {}
      };
    })
    .filter(Boolean);

  return mapped;
}

// Endpoint: /api/videos
// Devuelve: { source: 'cache'|'api', items: [...] }
app.get('/api/videos', async (req, res) => {
  try {
    // CORS para desarrollo: permitir todo. En producción restringe a tu dominio.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Si cache todavía válido, devuelvo
    const now = Date.now();
    if (cache.videos && cache.expiresAt > now) {
      return res.json({ source: 'cache', items: cache.videos });
    }

    // Si faltan variables de configuración, fallo claro
    if (!YT_API_KEY || !YT_CHANNEL_ID) {
      return res.status(500).json({ error: 'Server misconfigured: missing YT_API_KEY or YT_CHANNEL_ID' });
    }

    // 1) obtener uploads playlist id
    const uploadsId = await getUploadsPlaylistId(YT_CHANNEL_ID);
    if (!uploadsId) {
      return res.status(500).json({ error: 'Could not determine uploads playlist for channel' });
    }

    // 2) obtener videos del playlist
    const videos = await fetchPlaylistItems(uploadsId, 5);

    // opcional: ordenar por fecha (más reciente primero)
    videos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    // guardar en cache (ttl)
    cache.videos = videos;
    cache.expiresAt = Date.now() + cache.ttlMs;

    return res.json({ source: 'api', items: videos });
  } catch (err) {
    console.error('Error /api/videos', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
});

// Small health endpoint
app.get('/api/health', (req, res) => {
  res.json({ ok: true, cached: !!cache.videos, expiresAt: cache.expiresAt || null });
});

// Serve static frontend optionally (si quieres servir la web desde este servidor)
// app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`YouTube proxy server running on port ${PORT}`);
  console.log(`GET /api/videos will return uploads from channel ${YT_CHANNEL_ID ? YT_CHANNEL_ID : '(YT_CHANNEL_ID not set)'}`);
});

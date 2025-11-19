// server.js
// Proxy simple para thumbnails y presence de Roblox.
// Requiere Node 18+ (fetch global). Instalar dependencias:
//   npm install express cors
// Ejecutar: node server.js

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const THUMBNAIL_API_BASE = 'https://thumbnails.roblox.com/v1/users/avatar-headshot';
const PRESENCE_ROPROXY = 'https://presence.roproxy.com/v1/presence/users';
const PRESENCE_ROBLOX = 'https://presence.roblox.com/v1/presence/users';

// Simple cache en memoria
const presenceCache = new Map();
const PRESENCE_TTL = 12 * 1000; // 12s

async function fetchWithTimeout(url, opts = {}, timeout = 9000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal, ...opts });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

app.get('/api/avatar/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const url = new URL(THUMBNAIL_API_BASE);
    url.searchParams.set('userIds', String(id));
    url.searchParams.set('size', '150x150');
    url.searchParams.set('format', 'Png');
    url.searchParams.set('isCircular', 'false');

    const r = await fetchWithTimeout(url.toString(), {}, 9000);
    if (!r.ok) {
      console.warn('thumbnail API returned', r.status);
      return res.status(502).json({ error: 'Thumbnail API error' });
    }
    const j = await r.json();
    const imageUrl = j?.data?.[0]?.imageUrl;
    if (!imageUrl) return res.status(404).json({ error: 'No thumbnail URL' });

    const imgResp = await fetchWithTimeout(imageUrl, {}, 9000);
    if (!imgResp.ok) return res.status(502).json({ error: 'Failed to fetch image' });

    const contentType = imgResp.headers.get('content-type') || 'image/png';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=60');

    const buffer = await imgResp.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('/api/avatar/:id error', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Internal proxy error' });
  }
});

async function tryEndpoint(endpoint, payload) {
  try {
    const r = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload
    }, 9000);
    if (!r.ok) return null;
    const j = await r.json();
    return j;
  } catch (e) {
    return null;
  }
}

app.post('/api/presence', async (req, res) => {
  const ids = Array.isArray(req.body?.userIds) ? req.body.userIds.map(Number) : [];
  if (!ids.length) return res.status(400).json({ error: 'userIds required' });

  const key = String(ids[0]);
  const cached = presenceCache.get(key);
  if (cached && (Date.now() - cached.t) < PRESENCE_TTL) {
    return res.json({ fromCache: true, ...cached.v });
  }

  const payload = JSON.stringify({ userIds: [Number(key)] });

  let data = await tryEndpoint(PRESENCE_ROPROXY, payload);
  if (!data) data = await tryEndpoint(PRESENCE_ROBLOX, payload);

  if (!data) return res.status(502).json({ error: 'No presence data from endpoints' });

  presenceCache.set(key, { v: data, t: Date.now() });
  res.json(data);
});

// (Opcional) servir carpeta 'public' si quieres que Express sirva tu web:
// app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`Proxy running on http://localhost:${PORT}`);
});

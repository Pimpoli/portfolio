// server.js - Proxy mínimo para thumbnails + presence (roproxy)
// Requiere: node >= 14. Instalar: npm i express cors node-fetch@2
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Simple in-memory cache (muy básico): { key: { data, ts } }
const CACHE_TTL_MS = 30 * 1000;
const cache = new Map();

function cacheGet(key) {
  const it = cache.get(key);
  if (!it) return null;
  if (Date.now() - it.ts > CACHE_TTL_MS) { cache.delete(key); return null; }
  return it.data;
}
function cacheSet(key, data) { cache.set(key, { data, ts: Date.now() }); }

// GET /avatar/:id?size=420x420&format=Png&isCircular=true
app.get('/avatar/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const size = req.query.size || '420x420';
    const format = req.query.format || 'Png';
    const isCircular = typeof req.query.isCircular !== 'undefined' ? req.query.isCircular : 'true';

    const cacheKey = `thumb:${id}:${size}:${format}:${isCircular}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.redirect(302, cached);

    const metaUrl = `https://thumbnails.roproxy.com/v1/users/avatar-headshot?userIds=${encodeURIComponent(id)}&size=${encodeURIComponent(size)}&format=${encodeURIComponent(format)}&isCircular=${encodeURIComponent(isCircular)}`;
    const r = await fetch(metaUrl);
    if (!r.ok) return res.status(502).json({ error: 'Bad response from thumbnails API', status: r.status });
    const j = await r.json();
    const imageUrl = j?.data?.[0]?.imageUrl;
    if (!imageUrl) return res.status(404).json({ error: 'No image URL found' });

    cacheSet(cacheKey, imageUrl);
    return res.redirect(302, imageUrl);
  } catch (err) {
    console.error('[proxy /avatar] error', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// POST /presence  body: { userIds: [id,...] }
app.post('/presence', async (req, res) => {
  try {
    const userIds = req.body?.userIds;
    if (!Array.isArray(userIds) || userIds.length === 0) return res.status(400).json({ error: 'userIds array required' });

    const cacheKey = `presence:${userIds.join(',')}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const url = 'https://presence.roproxy.com/v1/presence/users';
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds })
    });
    if (!r.ok) {
      const txt = await r.text();
      return res.status(502).json({ error: 'Bad response from presence API', status: r.status, body: txt });
    }
    const j = await r.json();
    cacheSet(cacheKey, j);
    return res.json(j);
  } catch (err) {
    console.error('[proxy /presence] error', err);
    return res.status(500).json({ error: 'server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy server listening on http://localhost:${PORT}`));

const express = require('express');
const cors    = require('cors');
const axios   = require('axios');
const fs      = require('fs');
const path    = require('path');

// ─── Leer .env manualmente (no requiere instalar dotenv) ─────────────────────
try {
  const envPath = path.join(__dirname, '..', '.env');
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([A-Z_]+)\s*=\s*(.+)$/);
    if (m) process.env[m[1]] = m[2].trim();
  });
} catch (_) { /* .env no existe, continúa sin él */ }

const ROBLOX_COOKIE    = process.env.ROBLOX_COOKIE    || '';
const YOUTUBE_API_KEY  = process.env.YOUTUBE_API_KEY  || 'AIzaSyAI0klDbsko8_UrYOe0Rwu6aK6vrIS2iNc';

const app  = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// ─── PRESENCIA ────────────────────────────────────────────────────────────────
// Node.js llama directamente a Roblox con la cookie — sin restricción CORS.
// El navegador no puede hacer esto, por eso necesita este proxy local.
app.post('/presence', async (req, res) => {
  const { userIds } = req.body || {};
  if (!Array.isArray(userIds) || !userIds.length) {
    return res.status(400).json({ error: 'userIds requerido' });
  }

  if (!ROBLOX_COOKIE) {
    console.warn('[presence] ROBLOX_COOKIE no configurada en .env — el estado siempre será offline');
    return res.status(503).json({ error: 'ROBLOX_COOKIE no configurada' });
  }

  try {
    const response = await axios.post(
      'https://presence.roblox.com/v1/presence/users',   // API real, no roproxy
      { userIds },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept':        'application/json',
          'Cookie':        `.ROBLOSECURITY=${ROBLOX_COOKIE}`,
        },
        timeout: 9000,
      }
    );
    res.json(response.data);
  } catch (error) {
    const status = error.response?.status;
    console.error(`[presence] Error ${status ?? 'red'}: ${error.message}`);
    if (status === 401) {
      console.error('[presence] Cookie inválida o expirada — actualiza ROBLOX_COOKIE en .env');
      return res.status(401).json({ error: 'Cookie inválida o expirada' });
    }
    res.status(500).json({ error: 'Error al obtener presencia' });
  }
});

// ─── AVATAR ───────────────────────────────────────────────────────────────────
app.get('/avatar/:id', async (req, res) => {
  const userId = req.params.id;
  try {
    const response = await axios.get(
      `https://thumbnails.roproxy.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=true`,
      { timeout: 9000 }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching avatar:', error.message);
    res.status(500).json({ error: 'Failed to fetch avatar' });
  }
});

// ─── YOUTUBE: PLAYLIST ────────────────────────────────────────────────────────
app.get('/youtube/playlist', async (req, res) => {
  const { playlistId, maxResults = 6 } = req.query;
  if (!playlistId) return res.status(400).json({ error: 'playlistId required' });
  try {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', {
      params: { part: 'snippet', playlistId, maxResults, key: YOUTUBE_API_KEY },
      timeout: 9000
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching YouTube playlist:', error.message);
    res.status(500).json({ error: 'YouTube API failed' });
  }
});

// ─── YOUTUBE: VIDEOS POR IDS ──────────────────────────────────────────────────
app.get('/youtube/videos', async (req, res) => {
  const { ids } = req.query;
  if (!ids) return res.status(400).json({ error: 'ids required' });
  try {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: { part: 'snippet', id: ids, key: YOUTUBE_API_KEY },
      timeout: 9000
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching YouTube videos:', error.message);
    res.status(500).json({ error: 'YouTube API failed' });
  }
});

app.listen(PORT, () => {
  console.log(`\n  Servidor proxy corriendo en http://localhost:${PORT}\n`);
});

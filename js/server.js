const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 3000;

// API Key de YouTube — guardada solo en el servidor, nunca expuesta al cliente
const YOUTUBE_API_KEY = 'AIzaSyAI0klDbsko8_UrYOe0Rwu6aK6vrIS2iNc';

app.use(cors());
app.use(express.json());

// ─── PRESENCIA (usa roproxy para evitar problemas de CORS desde el navegador) ───
app.post('/presence', async (req, res) => {
  try {
    const { userIds } = req.body;
    if (!userIds || !userIds.length) {
      return res.status(400).json({ error: 'No userIds provided' });
    }
    const response = await axios.post(
      'https://presence.roproxy.com/v1/presence/users',
      { userIds },
      { headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, timeout: 9000 }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching presence:', error.message);
    res.status(500).json({ error: 'Failed to fetch presence' });
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

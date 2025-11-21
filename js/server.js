// server.js
// Simple proxy server to fetch YouTube videos (uploads) and try to extract community images.
// Requires: YT_API_KEY in env. Optional: YT_CHANNEL_ID or YT_CHANNEL_NAME.
// npm install express node-fetch@2 cors

const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const YT_KEY = process.env.YT_API_KEY || '';
const YT_CHANNEL_ID = process.env.YT_CHANNEL_ID || '';   // opcional
const YT_CHANNEL_NAME = process.env.YT_CHANNEL_NAME || ''; // opcional (ej: 'PmpoliDev' o handle sin @)

// util
function jsonOk(res, obj) { res.setHeader('Content-Type','application/json'); res.json(obj); }
function jsonErr(res, status=500, msg='error'){ res.status(status).json({ error: String(msg) }); }

if (!YT_KEY) {
  console.warn('Warning: YT_API_KEY not set - /api/videos will fail until you set it in env.');
}

// Helper: call youtube data API endpoints
async function ytFetch(path, params = {}) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  url.searchParams.set('key', YT_KEY);
  Object.keys(params).forEach(k => { if (params[k] !== undefined && params[k] !== null) url.searchParams.set(k, params[k]); });
  const res = await fetch(url.href);
  if (!res.ok) throw new Error(`YT API ${res.status} ${res.statusText}`);
  return res.json();
}

// Resolve channel id from env or by searching the channel name/handle
async function resolveChannelId() {
  if (YT_CHANNEL_ID) return YT_CHANNEL_ID;
  // Try channel by username (legacy) if provided
  if (YT_CHANNEL_NAME) {
    try {
      const r = await ytFetch('channels', { part: 'id', forUsername: YT_CHANNEL_NAME });
      if (r.items && r.items.length) return r.items[0].id;
    } catch(e) {
      // continue to search fallback
    }
  }
  // fallback: try search by channel name
  if (YT_CHANNEL_NAME) {
    const sr = await ytFetch('search', { part: 'snippet', q: YT_CHANNEL_NAME, type: 'channel', maxResults: 1 });
    if (sr.items && sr.items.length && sr.items[0].snippet && sr.items[0].snippet.channelId) {
      return sr.items[0].snippet.channelId;
    }
  }
  throw new Error('Channel ID could not be resolved - set YT_CHANNEL_ID or YT_CHANNEL_NAME in env.');
}

// Get uploads playlist id for channel
async function getUploadsPlaylistId(channelId) {
  const r = await ytFetch('channels', { part: 'contentDetails', id: channelId });
  if (!r.items || !r.items[0] || !r.items[0].contentDetails) throw new Error('Content details not found for channel');
  const uploads = r.items[0].contentDetails.relatedPlaylists.uploads;
  return uploads;
}

// Endpoint: /api/videos
// Query params: maxResults (default 12)
app.get('/api/videos', async (req, res) => {
  if (!YT_KEY) return jsonErr(res, 500, 'YT_API_KEY not configured on server.');
  const max = Math.min(50, Number(req.query.maxResults) || 12);
  try {
    const channelId = await resolveChannelId();
    const uploadsPlaylist = await getUploadsPlaylistId(channelId);
    // fetch playlist items
    const list = await ytFetch('playlistItems', {
      part: 'snippet,contentDetails',
      playlistId: uploadsPlaylist,
      maxResults: max
    });
    // Normalize to simple items: videoId, title, description, thumbnails, publishedAt
    const items = (list.items || []).map(it => {
      const videoId = it.contentDetails?.videoId || (it.snippet?.resourceId && it.snippet.resourceId.videoId) || null;
      const snippet = it.snippet || {};
      return {
        videoId,
        title: snippet.title,
        description: snippet.description,
        thumbnails: snippet.thumbnails,
        publishedAt: snippet.publishedAt,
        source: 'youtube'
      };
    }).filter(i => i.videoId);
    return jsonOk(res, { source: 'youtube', items });
  } catch (err) {
    console.error('/api/videos error', err);
    return jsonErr(res, 500, err.message || err);
  }
});

/* =========================
   OPTIONAL: /api/community
   Attempt to fetch the /@handle/community page and extract images from ytInitialData.
   THIS IS NOT OFFICIAL - may fail and break. Use as best-effort fallback.
   ========================= */
app.get('/api/community', async (req, res) => {
  if (!req.query.handle && !YT_CHANNEL_NAME) {
    return jsonErr(res, 400, 'Provide ?handle=YourHandle or set YT_CHANNEL_NAME env var.');
  }
  const handle = (req.query.handle || YT_CHANNEL_NAME).replace(/^@/,'');
  const url = `https://www.youtube.com/@${encodeURIComponent(handle)}/community`;
  try {
    const page = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' } });
    if (!page.ok) throw new Error('Failed to fetch community page: ' + page.status);
    const html = await page.text();

    // Try to find "ytInitialData" JSON blob
    const match = html.match(/(?:window\["ytInitialData"\]|ytInitialData)\s*=\s*({.*?});\s*<\/script>/s)
               || html.match(/ytInitialData\s*=\s*({.*?});/s);
    if (!match) {
      return jsonOk(res, { source: 'scrape', items: [], warning: 'ytInitialData not found (page changed or blocked)' });
    }

    let parsed;
    try {
      parsed = JSON.parse(match[1]);
    } catch (err) {
      // try naive cleaning (some times HTML escapes break); fallback empty
      console.warn('ytInitialData parse failed', err);
      return jsonOk(res, { source: 'scrape', items: [], warning: 'Failed to parse ytInitialData' });
    }

    // Walk the ytInitialData structure to find community posts with images
    // This is heuristic and may need tweaks if YouTube changes layout
    const items = [];
    function walk(node) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      // look for possible imageRenderer / postRenderer structures
      if (node.post || node.postRenderer) {
        const post = node.post || node.postRenderer || {};
        // attempt to find images inside
        const images = [];
        try {
          // common pattern: postRenderer.contents... or threaded... overlays
          const candidates = JSON.stringify(post);
          // fallback simple search for "thumbnail" keys
        } catch (e) {}
      }
      // find thumbnails keys
      if (node.thumbnail && node.thumbnail.thumbnails) {
        const thumbs = node.thumbnail.thumbnails;
        if (Array.isArray(thumbs) && thumbs.length) {
          items.push({
            title: node.title ? (node.title.simpleText || (node.title.runs && node.title.runs[0]?.text)) : undefined,
            thumbnails: thumbs,
            raw: node
          });
        }
      }
      // common youtube key for thumbnails inside a 'thumbnails' array
      if (node.thumbnails && Array.isArray(node.thumbnails)) {
        items.push({ thumbnails: node.thumbnails, raw: node });
      }
      // recurse
      Object.keys(node).forEach(k => walk(node[k]));
    }
    walk(parsed);

    // Normalize and dedupe by thumbnail url
    const normalized = [];
    const seen = new Set();
    for (const it of items) {
      const t = (it.thumbnails && it.thumbnails.length && it.thumbnails[it.thumbnails.length - 1]?.url) || (it.thumbnails && it.thumbnails[0]?.url);
      if (!t) continue;
      if (seen.has(t)) continue;
      seen.add(t);
      normalized.push({
        title: it.title || '',
        image: t,
        raw: undefined // remove large raw
      });
      if (normalized.length >= 30) break;
    }

    return jsonOk(res, { source: 'scrape', items: normalized });
  } catch (err) {
    console.error('/api/community error', err);
    return jsonErr(res, 500, err.message || err);
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT} (YT proxy)`);
});

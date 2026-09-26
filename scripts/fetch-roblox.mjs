#!/usr/bin/env node
// scripts/fetch-roblox.mjs — Genera data/roblox.json con los datos públicos de Roblox que usa la web
// (juegos, portadas, iconos, vídeos, visitas, jugadores, me gusta, perfil, avatar y miembros del grupo).
//
// Lo ejecuta el GitHub Action de presencia llamando a las APIs de Roblox directamente, sin roproxy.
// Así la web carga los juegos desde su propio dominio aunque roproxy falle o limite peticiones.
// Si una parte falla, se conserva lo que ya había en data/roblox.json.
//
// Uso: node scripts/fetch-roblox.mjs   (Node 18+)

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'roblox.json');
const YT = /^[\w-]{11}$/;

// ─── Configuración: se lee de js/config.js para no repetir los IDs ──────────
async function loadConfig() {
  const src = await readFile(path.join(ROOT, 'js', 'config.js'), 'utf8');
  const win = {};
  new Function('window', src)(win);
  return win.SITE;
}

async function readPrevious() {
  try { return JSON.parse(await readFile(OUT, 'utf8')); } catch { return {}; }
}

// ─── Red ─────────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function getJSON(url, { retries = 2, fetchImpl = globalThis.fetch } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetchImpl(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'pimpolidev-portfolio (GitHub Action)' },
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) return await res.json();
      if (res.status !== 429 && res.status < 500) {
        console.warn(`✗ ${res.status} ${url}`);
        return null;
      }
      console.warn(`… ${res.status} ${url} (reintento ${attempt + 1})`);
    } catch (e) {
      console.warn(`… ${e.message} ${url} (reintento ${attempt + 1})`);
    }
    if (attempt >= retries) return null;
    await sleep(1500 * 2 ** attempt);
  }
}

const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const https = (u) => (typeof u === 'string' && u.startsWith('https://') ? u : null);

// ─── Recogida de datos ───────────────────────────────────────────────────────
export async function collect(site, previous = {}, fetchImpl = globalThis.fetch) {
  const get = (url) => getJSON(url, { fetchImpl });
  const prevGames = {};
  (previous.games || []).forEach((g) => { if (g?.placeId) prevGames[g.placeId] = g; });

  // placeId → universeId (si falla, el de la copia anterior)
  const uids = await Promise.all(site.games.map(async (g) => {
    const d = await get(`https://apis.roblox.com/universes/v1/places/${g.placeId}/universe`);
    return num(d?.universeId) ?? num(prevGames[g.placeId]?.universeId);
  }));
  const valid = uids.filter(Boolean);
  const q = valid.join(',');

  const info = {}, icons = {}, thumbs = {}, votes = {}, media = {};
  if (valid.length) {
    const [i, ic, th, v] = await Promise.all([
      get(`https://games.roblox.com/v1/games?universeIds=${q}`),
      get(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${q}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`),
      get(`https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${q}&countPerUniverse=10&defaults=true&size=768x432&format=Png&isCircular=false`),
      get(`https://games.roblox.com/v1/games/votes?universeIds=${q}`),
    ]);
    (i?.data || []).forEach((g) => { info[g.id] = g; });
    (ic?.data || []).forEach((x) => { if (x.state === 'Completed' && https(x.imageUrl)) icons[x.targetId] = x.imageUrl; });
    (th?.data || []).forEach((x) => {
      const list = (x.thumbnails || []).filter((t) => t.state === 'Completed').map((t) => https(t.imageUrl)).filter(Boolean);
      if (list.length) thumbs[x.universeId] = list;
    });
    (v?.data || []).forEach((x) => { votes[x.id] = x; });

    // Vídeos de YouTube de la galería de cada juego
    await Promise.all(valid.map(async (uid) => {
      const m = await get(`https://games.roblox.com/v2/games/${uid}/media`);
      if (m?.data) {
        media[uid] = m.data
          .filter((x) => x.assetType === 'YouTubeVideo' && YT.test(x.videoHash || '') && x.approved !== false)
          .map((x) => ({ id: x.videoHash, title: String(x.videoTitle || '') }));
      }
    }));
  }

  const games = site.games.map((g, idx) => {
    const uid = uids[idx];
    const prev = prevGames[g.placeId] || {};
    const d = uid ? info[uid] : null;
    const vt = uid ? votes[uid] : null;
    const total = vt ? (vt.upVotes || 0) + (vt.downVotes || 0) : 0;
    return {
      placeId: g.placeId,
      universeId: uid ?? null,
      name: d?.name || prev.name || g.name,
      description: d ? (d.description || '') : (prev.description || ''),
      creator: d?.creator?.name || prev.creator || '',
      visits: num(d?.visits) ?? num(prev.visits),
      playing: num(d?.playing) ?? num(prev.playing),
      favorites: num(d?.favoritedCount) ?? num(prev.favorites),
      maxPlayers: num(d?.maxPlayers) ?? num(prev.maxPlayers),
      genre: d ? (d.genre && d.genre !== 'All' ? d.genre : '') : (prev.genre || ''),
      created: d?.created || prev.created || null,
      updated: d?.updated || prev.updated || null,
      likes: total ? Math.round((vt.upVotes / total) * 100) : num(prev.likes),
      icon: (uid && icons[uid]) || https(prev.icon),
      thumbnails: (uid && thumbs[uid]) || (Array.isArray(prev.thumbnails) ? prev.thumbnails : []),
      videos: (uid && media[uid]) || (Array.isArray(prev.videos) ? prev.videos : []),
    };
  });

  // Perfil, avatar y grupo
  const uidUser = site.robloxUserId;
  const [user, fol, fri, avatar, head, group] = await Promise.all([
    get(`https://users.roblox.com/v1/users/${uidUser}`),
    get(`https://friends.roblox.com/v1/users/${uidUser}/followers/count`),
    get(`https://friends.roblox.com/v1/users/${uidUser}/friends/count`),
    get(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${uidUser}&size=720x720&format=Png&isCircular=false`),
    get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${uidUser}&size=420x420&format=Png&isCircular=true`),
    get(`https://groups.roblox.com/v1/groups/${site.robloxGroupId}`),
  ]);
  const prevUser = previous.user || {};
  const imageOf = (d) => (d?.data?.[0]?.state === 'Completed' ? https(d.data[0].imageUrl) : null);

  return {
    updatedAt: new Date().toISOString(),
    user: {
      displayName: user?.displayName || user?.name || prevUser.displayName || '',
      created: user?.created || prevUser.created || null,
      followers: num(fol?.count) ?? num(prevUser.followers),
      friends: num(fri?.count) ?? num(prevUser.friends),
      avatar: imageOf(avatar) || https(prevUser.avatar),
      headshot: imageOf(head) || https(prevUser.headshot),
    },
    group: { members: num(group?.memberCount) ?? num(previous.group?.members) },
    games,
    _fresh: Boolean(valid.length && Object.keys(info).length) || Boolean(user),
  };
}

// ─── Ejecución ───────────────────────────────────────────────────────────────
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const site = await loadConfig();
  const previous = await readPrevious();
  const data = await collect(site, previous);
  const fresh = data._fresh;
  delete data._fresh;
  if (!fresh) {
    console.error('::warning::No se pudo obtener ningún dato nuevo de Roblox; data/roblox.json no cambia.');
    process.exit(0);
  }
  await writeFile(OUT, JSON.stringify(data, null, 2) + '\n', 'utf8');
  const ok = data.games.filter((g) => g.icon || g.thumbnails.length).length;
  console.log(`✓ data/roblox.json: ${data.games.length} juegos (${ok} con imágenes), avatar ${data.user.avatar ? 'sí' : 'no'}`);
}

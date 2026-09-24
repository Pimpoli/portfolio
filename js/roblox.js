// js/roblox.js — Datos públicos de Roblox compartidos por stats, juegos y presencia.
//
// Dos fuentes, en este orden:
//   1. data/roblox.json: copia que genera el GitHub Action (scripts/fetch-roblox.mjs) llamando a
//      Roblox directamente. Está en el propio sitio, así que carga rápido y no falla aunque
//      roproxy esté caído o limitando peticiones.
//   2. roproxy.com en vivo: para tener números al día (jugadores conectados, etc.). Si falla,
//      se queda lo de la copia.
// Todas las llamadas en vivo usan la caché de sessionStorage, reintentan ante errores de red
// y respetan el rate-limit compartido. Los juegos se piden en lote.

(function () {
  'use strict';

  const { cache, fetchJSON, isRateLimited, asset } = window.U;
  const TTL = 10 * 60_000;
  const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
  const YT = /^[\w-]{11}$/;
  const httpsUrl = (u) => (typeof u === 'string' && /^https:\/\//.test(u) ? u : null);

  async function cachedJSON(key, url, opts = {}, ttl = TTL) {
    const hit = cache.get(key, ttl);
    if (hit !== null) return hit;
    if (isRateLimited()) return null;
    const data = await fetchJSON(url, opts, 8000, 2);
    if (data !== null) cache.set(key, data);
    return data;
  }

  // ─── Copia local (data/roblox.json) ───────────────────────────────────────
  let snapshotPromise = null;
  function snapshot() {
    if (!snapshotPromise) {
      // Se pide una versión nueva cada 10 min para no quedarse con una copia vieja en caché
      snapshotPromise = fetchJSON(asset('data/roblox.json') + '?t=' + Math.floor(Date.now() / 600_000), {}, 5000, 1)
        .then((d) => (d && typeof d === 'object' ? d : null));
    }
    return snapshotPromise;
  }

  // ─── Juegos ────────────────────────────────────────────────────────────────
  function blank(g) {
    return {
      placeId: g.placeId, universeId: null, name: g.name, description: '', creator: '',
      visits: null, playing: null, favorites: null, maxPlayers: null, genre: '', updated: null,
      likes: null, icon: null, thumbnails: [], videos: null, live: false,
    };
  }

  // Normaliza una entrada de data/roblox.json al formato que usan las tarjetas
  function fromSnapshot(g, s) {
    if (!s) return blank(g);
    return {
      ...blank(g),
      universeId: num(s.universeId),
      name: typeof s.name === 'string' && s.name ? s.name : g.name,
      description: typeof s.description === 'string' ? s.description : '',
      creator: typeof s.creator === 'string' ? s.creator : '',
      visits: num(s.visits), playing: num(s.playing), favorites: num(s.favorites),
      maxPlayers: num(s.maxPlayers), genre: typeof s.genre === 'string' ? s.genre : '',
      updated: typeof s.updated === 'string' ? s.updated : null, likes: num(s.likes),
      icon: httpsUrl(s.icon),
      thumbnails: Array.isArray(s.thumbnails) ? s.thumbnails.map(httpsUrl).filter(Boolean) : [],
      videos: Array.isArray(s.videos)
        ? s.videos.filter((v) => v && YT.test(v.id || '')).map((v) => ({ id: v.id, title: String(v.title || '') }))
        : null,
      // Solo cuenta como dato real si trae algo más que el nombre
      live: Boolean(s.name && (num(s.visits) !== null || (Array.isArray(s.thumbnails) && s.thumbnails.length))),
    };
  }

  // Une datos en vivo sobre la copia: lo que no haya llegado en vivo se queda como estaba
  function merge(base, live) {
    if (!live || !live.live) return base;
    const out = { ...base };
    for (const [k, v] of Object.entries(live)) {
      if (k === 'thumbnails') { if (v.length) out.thumbnails = v; continue; }
      if (k === 'videos') continue;
      if (v !== null && v !== '' && v !== undefined) out[k] = v;
    }
    out.live = true;
    return out;
  }

  async function universeId(placeId) {
    const d = await cachedJSON(
      `rbx_uid_${placeId}`,
      `https://apis.roproxy.com/universes/v1/places/${placeId}/universe`,
      {}, 24 * 60 * 60_000
    );
    return num(d?.universeId);
  }

  async function loadLive(known = {}) {
    const list = window.SITE.games;
    // Si la copia ya trae el universeId, no hace falta preguntarlo
    const ids = await Promise.all(list.map((g) => known[g.placeId] || universeId(g.placeId)));
    const uids = ids.filter(Boolean);
    if (!uids.length) return null;

    const q = uids.join(',');
    const [i, ic, th, v] = await Promise.all([
      cachedJSON(`rbx_games_${q}`, `https://games.roproxy.com/v1/games?universeIds=${q}`),
      cachedJSON(`rbx_icons_${q}`, `https://thumbnails.roproxy.com/v1/games/icons?universeIds=${q}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`),
      cachedJSON(`rbx_thumbs_${q}`, `https://thumbnails.roproxy.com/v1/games/multiget/thumbnails?universeIds=${q}&countPerUniverse=10&defaults=true&size=768x432&format=Png&isCircular=false`),
      cachedJSON(`rbx_votes_${q}`, `https://games.roproxy.com/v1/games/votes?universeIds=${q}`),
    ]);
    const info = {}, icons = {}, thumbs = {}, votes = {};
    (i?.data || []).forEach((g) => { info[g.id] = g; });
    (ic?.data || []).forEach((x) => { if (httpsUrl(x.imageUrl)) icons[x.targetId] = x.imageUrl; });
    (th?.data || []).forEach((x) => { thumbs[x.universeId] = (x.thumbnails || []).map((t) => httpsUrl(t.imageUrl)).filter(Boolean); });
    (v?.data || []).forEach((x) => { votes[x.id] = x; });

    return list.map((g, idx) => {
      const uid = ids[idx];
      const d = uid ? info[uid] : null;
      const vt = uid ? votes[uid] : null;
      const totalVotes = vt ? (vt.upVotes || 0) + (vt.downVotes || 0) : 0;
      return {
        ...blank(g),
        universeId: uid,
        name: d?.name || g.name,
        description: d?.description || '',
        creator: d?.creator?.name || '',
        visits: num(d?.visits),
        playing: num(d?.playing),
        favorites: num(d?.favoritedCount),
        maxPlayers: num(d?.maxPlayers),
        genre: d?.genre && d.genre !== 'All' ? d.genre : '',
        updated: d?.updated || null,
        likes: totalVotes ? Math.round((vt.upVotes / totalVotes) * 100) : null,
        icon: (uid && icons[uid]) || null,
        thumbnails: (uid && thumbs[uid]) || [],
        live: Boolean(d),
      };
    });
  }

  // Lo más rápido disponible: la copia local; si no existe, en vivo
  let gamesPromise = null;
  function getGames() {
    if (!gamesPromise) {
      gamesPromise = snapshot().then(async (snap) => {
        const byPlace = {};
        (snap?.games || []).forEach((s) => { if (s && s.placeId) byPlace[s.placeId] = s; });
        const base = window.SITE.games.map((g) => fromSnapshot(g, byPlace[g.placeId]));
        if (base.some((g) => g.live)) return base;
        const live = await loadLive();
        return live ? base.map((b, i) => merge(b, live[i])) : base;
      });
    }
    return gamesPromise;
  }

  // Datos en vivo encima de lo que ya se mostró (jugadores conectados al momento, etc.)
  async function refreshGames(current) {
    const known = {};
    (current || []).forEach((g) => { if (g.universeId) known[g.placeId] = g.universeId; });
    const live = await loadLive(known);
    if (!live) return null;
    return (current || live.map(blank)).map((b, i) => merge(b, live[i]));
  }

  // Vídeos de YouTube de la galería del juego en Roblox (de la copia, o en vivo al abrir el juego)
  async function gameVideos(game) {
    if (Array.isArray(game?.videos)) return game.videos;
    if (!game?.universeId) return [];
    const d = await cachedJSON(`rbx_media_${game.universeId}`, `https://games.roproxy.com/v2/games/${game.universeId}/media`);
    return (d?.data || [])
      .filter((m) => m.assetType === 'YouTubeVideo' && YT.test(m.videoHash || '') && m.approved !== false)
      .map((m) => ({ id: m.videoHash, title: m.videoTitle || '' }));
  }

  // ─── Perfil, grupo y avatar: en vivo y, si falla, la copia ────────────────
  async function liveOr(liveFn, pick) {
    const live = await liveFn();
    if (live !== null && live !== undefined) return live;
    const snap = await snapshot();
    const v = snap ? pick(snap) : null;
    return v === undefined ? null : v;
  }

  function groupMembers() {
    return liveOr(async () => {
      const d = await cachedJSON(`rbx_group_${window.SITE.robloxGroupId}`, `https://groups.roproxy.com/v1/groups/${window.SITE.robloxGroupId}`);
      return num(d?.memberCount);
    }, (s) => num(s.group?.members));
  }

  function followers(userId) {
    return liveOr(async () => {
      const d = await cachedJSON(`rbx_fol_${userId}`, `https://friends.roproxy.com/v1/users/${userId}/followers/count`);
      return num(d?.count);
    }, (s) => num(s.user?.followers));
  }

  function friends(userId) {
    return liveOr(async () => {
      const d = await cachedJSON(`rbx_fri_${userId}`, `https://friends.roproxy.com/v1/users/${userId}/friends/count`);
      return num(d?.count);
    }, (s) => num(s.user?.friends));
  }

  // Perfil público: nombre visible y fecha de creación de la cuenta
  function profile(userId) {
    return liveOr(async () => {
      const d = await cachedJSON(`rbx_user_${userId}`, `https://users.roproxy.com/v1/users/${userId}`, {}, 24 * 60 * 60_000);
      return d ? { displayName: d.displayName || d.name || '', created: d.created || null } : null;
    }, (s) => (s.user ? { displayName: String(s.user.displayName || ''), created: s.user.created || null } : null));
  }

  // kind: 'full' = avatar de cuerpo entero (PNG transparente) · 'head' = retrato circular.
  // Primero la copia (ya es una URL de la CDN de Roblox) y, si no hay, en vivo.
  async function avatarUrl(userId, kind = 'head') {
    const snap = await snapshot();
    const fromSnap = httpsUrl(kind === 'full' ? snap?.user?.avatar : snap?.user?.headshot);
    if (fromSnap) return fromSnap;
    const url = kind === 'full'
      ? `https://thumbnails.roproxy.com/v1/users/avatar?userIds=${userId}&size=720x720&format=Png&isCircular=false`
      : `https://thumbnails.roproxy.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=true`;
    const d = await cachedJSON(`rbx_avt_${kind}_${userId}`, url);
    return httpsUrl(d?.data?.[0]?.imageUrl);
  }

  async function placeIcon(placeId) {
    if (!placeId) return null;
    // Si es uno de mis juegos, el icono ya está en la copia
    const games = await getGames();
    const mine = games.find((g) => g.placeId === placeId && g.icon);
    if (mine) return mine.icon;
    const d = await cachedJSON(`rbx_picon_${placeId}`, `https://thumbnails.roproxy.com/v1/places/gameicons?placeIds=${placeId}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`);
    return httpsUrl(d?.data?.[0]?.imageUrl);
  }

  // ─── Presencia ─────────────────────────────────────────────────────────────
  // Devuelve { type, game, placeId } con type 0 = desconectado, 1 = en línea, 2 = jugando, 3 = en Studio.
  // Solo se muestra el juego cuando está jugando; nunca el servidor (gameId) ni el lugar abierto en Studio.
  function normalize(p) {
    const type = typeof p?.userPresenceType === 'number' ? p.userPresenceType : 0;
    const playing = type === 2;
    return {
      type,
      game: playing && typeof p.lastLocation === 'string' && p.lastLocation.trim() ? p.lastLocation.trim() : null,
      placeId: playing ? (Number(p.rootPlaceId || p.placeId) || null) : null,
    };
  }

  async function presence(userId) {
    const KEY = `rbx_presence_${userId}`;
    const hit = cache.get(KEY, 45_000);
    if (hit !== null) return hit;
    const save = (v) => { cache.set(KEY, v); return v; };

    // 1. data/presence.json generado por el GitHub Action (válido durante 60 min)
    const j = await fetchJSON(asset('data/presence.json') + '?t=' + Math.floor(Date.now() / 60_000), {}, 4000);
    if (typeof j?.userPresenceType === 'number' && Date.now() - new Date(j.updatedAt || 0).getTime() < 60 * 60_000) {
      return save(normalize(j));
    }
    if (isRateLimited()) return null;

    const post = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userIds: [userId] }) };

    // 2. API pública de presencia (perfil con estado visible para todos): un tipo > 0 es fiable
    const p = await fetchJSON('https://presence.roproxy.com/v1/presence/users', post);
    const first = p?.userPresences?.[0];
    if (typeof first?.userPresenceType === 'number' && first.userPresenceType > 0) return save(normalize(first));

    // 3. Última conexión: si fue hace menos de 5 min, se considera en línea
    const lo = await fetchJSON('https://presence.roproxy.com/v1/presence/last-online', post);
    const ts = lo?.lastOnlineTimestamps?.[0]?.lastOnline;
    if (ts) return save({ type: Date.now() - new Date(ts).getTime() < 5 * 60_000 ? 1 : 0, game: null, placeId: null });

    if (first) return save(normalize(first));
    return null;
  }

  window.Roblox = {
    getGames, refreshGames, gameVideos, groupMembers, followers, friends, profile, avatarUrl, placeIcon, presence,
  };
})();

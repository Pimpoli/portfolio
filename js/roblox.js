// js/roblox.js — Datos públicos de Roblox (vía roproxy) compartidos por stats, juegos y presencia.
// Todas las llamadas pasan por la caché de sessionStorage y respetan el rate-limit compartido,
// y los juegos se piden en lote (3 peticiones para todos) en lugar de 3-4 por juego.

(function () {
  'use strict';

  const { cache, fetchJSON, isRateLimited, asset } = window.U;
  const TTL = 10 * 60_000;

  async function cachedJSON(key, url, opts = {}, ttl = TTL) {
    const hit = cache.get(key, ttl);
    if (hit !== null) return hit;
    if (isRateLimited()) return null;
    const data = await fetchJSON(url, opts);
    if (data !== null) cache.set(key, data);
    return data;
  }

  // ─── Juegos ────────────────────────────────────────────────────────────────
  async function universeId(placeId) {
    const d = await cachedJSON(
      `rbx_uid_${placeId}`,
      `https://apis.roproxy.com/universes/v1/places/${placeId}/universe`,
      {}, 24 * 60 * 60_000
    );
    return d?.universeId ?? null;
  }

  async function loadGames() {
    const list = window.SITE.games;
    const ids = await Promise.all(list.map((g) => universeId(g.placeId)));
    const uids = ids.filter(Boolean);

    const info = {}, icons = {}, thumbs = {};
    if (uids.length) {
      const q = uids.join(',');
      const [i, ic, th] = await Promise.all([
        cachedJSON(`rbx_games_${q}`, `https://games.roproxy.com/v1/games?universeIds=${q}`),
        cachedJSON(`rbx_icons_${q}`, `https://thumbnails.roproxy.com/v1/games/icons?universeIds=${q}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`),
        cachedJSON(`rbx_thumbs_${q}`, `https://thumbnails.roproxy.com/v1/games/multiget/thumbnails?universeIds=${q}&countPerUniverse=10&defaults=true&size=768x432&format=Png&isCircular=false`),
      ]);
      (i?.data || []).forEach((g) => { info[g.id] = g; });
      (ic?.data || []).forEach((x) => { if (x.imageUrl) icons[x.targetId] = x.imageUrl; });
      (th?.data || []).forEach((x) => {
        thumbs[x.universeId] = (x.thumbnails || []).map((t) => t.imageUrl).filter(Boolean);
      });
    }

    // Votos (me gusta / no me gusta) en una sola petición
    const votes = {};
    if (uids.length) {
      const v = await cachedJSON(`rbx_votes_${uids.join(',')}`, `https://games.roproxy.com/v1/games/votes?universeIds=${uids.join(',')}`);
      (v?.data || []).forEach((x) => { votes[x.id] = x; });
    }

    return list.map((g, idx) => {
      const uid = ids[idx];
      const d = uid ? info[uid] : null;
      const vt = uid ? votes[uid] : null;
      const totalVotes = vt ? (vt.upVotes || 0) + (vt.downVotes || 0) : 0;
      const num = (x) => (typeof x === 'number' ? x : null);
      return {
        placeId: g.placeId,
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

  // Vídeos de YouTube que el juego tiene en su galería de Roblox (se piden al abrir el juego)
  async function gameVideos(universeId) {
    if (!universeId) return [];
    const d = await cachedJSON(`rbx_media_${universeId}`, `https://games.roproxy.com/v2/games/${universeId}/media`);
    return (d?.data || [])
      .filter((m) => m.assetType === 'YouTubeVideo' && /^[\w-]{11}$/.test(m.videoHash || '') && m.approved !== false)
      .map((m) => ({ id: m.videoHash, title: m.videoTitle || '' }));
  }

  let gamesPromise = null;
  function getGames({ refresh = false } = {}) {
    if (!gamesPromise || refresh) gamesPromise = loadGames();
    return gamesPromise;
  }

  // ─── Grupo, seguidores y avatar ────────────────────────────────────────────
  async function groupMembers() {
    const d = await cachedJSON(`rbx_group_${window.SITE.robloxGroupId}`, `https://groups.roproxy.com/v1/groups/${window.SITE.robloxGroupId}`);
    return typeof d?.memberCount === 'number' ? d.memberCount : null;
  }

  async function followers(userId) {
    const d = await cachedJSON(`rbx_fol_${userId}`, `https://friends.roproxy.com/v1/users/${userId}/followers/count`);
    return typeof d?.count === 'number' ? d.count : null;
  }

  async function friends(userId) {
    const d = await cachedJSON(`rbx_fri_${userId}`, `https://friends.roproxy.com/v1/users/${userId}/friends/count`);
    return typeof d?.count === 'number' ? d.count : null;
  }

  // Perfil público: nombre visible y fecha de creación de la cuenta
  async function profile(userId) {
    const d = await cachedJSON(`rbx_user_${userId}`, `https://users.roproxy.com/v1/users/${userId}`, {}, 24 * 60 * 60_000);
    return d ? { displayName: d.displayName || d.name || '', created: d.created || null } : null;
  }

  // kind: 'full' = avatar de cuerpo entero (PNG transparente) · 'head' = retrato circular
  async function avatarUrl(userId, kind = 'head') {
    const url = kind === 'full'
      ? `https://thumbnails.roproxy.com/v1/users/avatar?userIds=${userId}&size=720x720&format=Png&isCircular=false`
      : `https://thumbnails.roproxy.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=true`;
    const d = await cachedJSON(`rbx_avt_${kind}_${userId}`, url);
    return d?.data?.[0]?.imageUrl || null;
  }

  async function placeIcon(placeId) {
    if (!placeId) return null;
    const d = await cachedJSON(`rbx_picon_${placeId}`, `https://thumbnails.roproxy.com/v1/places/gameicons?placeIds=${placeId}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`);
    return d?.data?.[0]?.imageUrl || null;
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

  window.Roblox = { getGames, gameVideos, groupMembers, followers, friends, profile, avatarUrl, placeIcon, presence };
})();

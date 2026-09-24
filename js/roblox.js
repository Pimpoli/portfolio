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

    return list.map((g, idx) => {
      const uid = ids[idx];
      const d = uid ? info[uid] : null;
      return {
        placeId: g.placeId,
        universeId: uid,
        name: d?.name || g.name,
        description: d?.description || '',
        visits: typeof d?.visits === 'number' ? d.visits : null,
        icon: (uid && icons[uid]) || null,
        thumbnails: (uid && thumbs[uid]) || [],
        live: Boolean(d),
      };
    });
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

  async function avatarUrl(userId) {
    const d = await cachedJSON(
      `rbx_avt_${userId}`,
      `https://thumbnails.roproxy.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=true`
    );
    return d?.data?.[0]?.imageUrl || null;
  }

  // ─── Presencia: 0 = desconectado, 1 = en línea, 2 = jugando, 3 = en Studio ──
  // Solo se usa el tipo de estado: nunca el juego, el servidor ni el lugar abierto en Studio.
  async function presence(userId) {
    const KEY = `rbx_pres_${userId}`;
    const hit = cache.get(KEY, 45_000);
    if (hit !== null) return hit;
    const save = (type) => { cache.set(KEY, type); return type; };

    // 1. data/presence.json generado por el GitHub Action (válido durante 60 min)
    const j = await fetchJSON(asset('data/presence.json') + '?t=' + Math.floor(Date.now() / 60_000), {}, 4000);
    if (typeof j?.userPresenceType === 'number' && Date.now() - new Date(j.updatedAt || 0).getTime() < 60 * 60_000) {
      return save(j.userPresenceType);
    }
    if (isRateLimited()) return null;

    const post = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userIds: [userId] }) };

    // 2. API de presencia sin autenticación: un tipo > 0 es fiable; 0 puede ser un falso negativo
    const p = await fetchJSON('https://presence.roproxy.com/v1/presence/users', post);
    const type = p?.userPresences?.[0]?.userPresenceType;
    if (typeof type === 'number' && type > 0) return save(type);

    // 3. Última conexión: si fue hace menos de 5 min, se considera en línea
    const lo = await fetchJSON('https://presence.roproxy.com/v1/presence/last-online', post);
    const ts = lo?.lastOnlineTimestamps?.[0]?.lastOnline;
    if (ts) return save(Date.now() - new Date(ts).getTime() < 5 * 60_000 ? 1 : 0);

    if (typeof type === 'number') return save(0);
    return null;
  }

  window.Roblox = { getGames, groupMembers, followers, avatarUrl, presence };
})();

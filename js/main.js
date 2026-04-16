// js/main.js - avatar + presencia + tema oscuro/claro

const ROBLOX_USER_ID = 3404416545;

// ─── Fetch con timeout ─────────────────────────────────────────────────────────
async function fetchWithTimeout(url, opts = {}, ms = 7000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal, ...opts });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

/* ══════════════════════════════════════════════════════
   1. AVATAR
   ══════════════════════════════════════════════════════ */
async function loadAvatar(userId, imgEl) {
  if (!imgEl || imgEl.dataset._loading) return;
  imgEl.dataset._loading = '1';
  imgEl.onload = () => { delete imgEl.dataset._loading; };
  imgEl.onerror = () => { delete imgEl.dataset._loading; };

  // Intentar a través del proxy local primero
  if (window.PROXY_BASE) {
    try {
      const res = await fetchWithTimeout(`${window.PROXY_BASE}/avatar/${userId}`, {}, 8000);
      if (res && res.ok) {
        const data = await res.json();
        if (data?.data?.[0]?.imageUrl) { imgEl.src = data.data[0].imageUrl; return; }
      }
    } catch (e) { /* continúa al siguiente */ }
  }

  // Fallback: RoProxy directo
  try {
    const res = await fetchWithTimeout(
      `https://thumbnails.roproxy.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=true`,
      {}, 8000
    );
    if (res && res.ok) {
      const data = await res.json();
      if (data?.data?.[0]?.imageUrl) { imgEl.src = data.data[0].imageUrl; return; }
    }
  } catch (e) { /* continúa */ }

  // Último recurso: URL directa de Roblox
  imgEl.src = `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=420&height=420&format=png&isCircular=true&_t=${Date.now()}`;
}

/* ══════════════════════════════════════════════════════
   2. PRESENCIA  (Online / InGame / Studio / Offline)
   ══════════════════════════════════════════════════════ */
function applyPresence(type, gameName) {
  const container = document.getElementById('roblox-profile-container');
  if (!container) return;
  container.classList.remove('status-online', 'status-ingame', 'status-studio', 'status-offline');

  let stateLabel, stateColor;
  switch (type) {
    case 1:
      container.classList.add('status-online');
      stateLabel = 'Online'; stateColor = '#00b0ff'; break;
    case 2:
      container.classList.add('status-ingame');
      stateLabel = 'In Game'; stateColor = '#00e676'; break;
    case 3:
      container.classList.add('status-studio');
      stateLabel = 'In Studio'; stateColor = '#ff9100'; break;
    default:
      container.classList.add('status-offline');
      stateLabel = 'Offline'; stateColor = '#9e9e9e'; break;
  }

  // Rich HTML tooltip
  let tooltip = container.querySelector('.roblox-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'roblox-tooltip';
    container.appendChild(tooltip);
  }
  let html = `<div><span style="opacity:0.55">Name:</span> <strong>PimpoliDev</strong></div>`;
  html += `<div><span style="opacity:0.55">State:</span> <strong style="color:${stateColor}">${stateLabel}</strong></div>`;
  if (type === 2 && gameName) {
    html += `<div><span style="opacity:0.55">Game:</span> <strong>${gameName}</strong></div>`;
  }
  tooltip.innerHTML = html;
}

function resolvePresenceType(pres) {
  if (!pres) return null;
  // Formato oficial de Roblox: userPresenceType 0=Offline,1=Online,2=InGame,3=InStudio
  if (typeof pres.userPresenceType === 'number') return pres.userPresenceType;
  if (typeof pres.presenceType      === 'number') return pres.presenceType;
  if (typeof pres.type              === 'number') return pres.type;
  // Heurísticas por campos secundarios
  if (typeof pres.lastLocation === 'string') {
    if (/studio/i.test(pres.lastLocation)) return 3;
    if (pres.lastLocation && pres.lastLocation !== '') return 2; // está en algún juego
  }
  if (pres.isOnline === true)  return 1;
  if (pres.isOnline === false) return 0;
  if (pres.placeId || pres.gameId || (pres.currentPlace && pres.currentPlace.placeId)) return 2;
  return null;
}

async function fetchPresenceData(userId) {
  const uid = Number(userId);

  // Estrategia 1: proxy local (evita CORS y problemas de autenticación)
  if (window.PROXY_BASE) {
    try {
      const res = await fetchWithTimeout(
        `${window.PROXY_BASE}/presence`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userIds: [uid] }) },
        9000
      );
      if (res && res.ok) {
        const j = await res.json();
        const arr = j?.userPresences ?? j?.data ?? j?.presences ?? (Array.isArray(j) ? j : null);
        if (Array.isArray(arr) && arr.length) return arr[0];
      }
    } catch (e) { /* siguiente */ }
  }

  // Estrategia 2: roproxy directo (funciona desde el navegador si el servidor no está activo)
  try {
    const res = await fetchWithTimeout(
      'https://presence.roproxy.com/v1/presence/users',
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ userIds: [uid] }) },
      8000
    );
    if (res && res.ok) {
      const j = await res.json();
      const arr = j?.userPresences ?? j?.data ?? j?.presences ?? (Array.isArray(j) ? j : null);
      if (Array.isArray(arr) && arr.length) return arr[0];
    }
  } catch (e) { /* siguiente */ }

  // Estrategia 3: endpoint alternativo de roproxy
  try {
    const res = await fetchWithTimeout(
      `https://presence.roproxy.com/v1/presence/last-online`,
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ userIds: [uid] }) },
      6000
    );
    if (res && res.ok) {
      const j = await res.json();
      const arr = j?.lastOnlineTimestamps ?? j?.data ?? (Array.isArray(j) ? j : null);
      if (Array.isArray(arr) && arr.length) {
        // last-online no da tipo exacto, pero si tiene lastOnline reciente puede ser Online
        const entry = arr[0];
        if (entry?.lastOnline) {
          const diff = Date.now() - new Date(entry.lastOnline).getTime();
          return { userPresenceType: diff < 5 * 60 * 1000 ? 1 : 0 };
        }
      }
    }
  } catch (e) { /* ninguna estrategia funcionó */ }

  return null;
}

async function updateAvatarStatus(userId) {
  try {
    const pres = await fetchPresenceData(userId);
    const resolved = resolvePresenceType(pres);
    const gameName = pres?.lastLocation || null;
    applyPresence(typeof resolved === 'number' && !Number.isNaN(resolved) ? resolved : 0, gameName);
  } catch (e) {
    applyPresence(0);
  }
}

/* ══════════════════════════════════════════════════════
   3. UI: Menú, scroll suave, fade-in
   ══════════════════════════════════════════════════════ */
function initMobileMenu() {
  const hamburger = document.getElementById('hamburger');
  const navList = document.querySelector('.nav-list');
  if (!hamburger || !navList) return;
  hamburger.addEventListener('click', () => navList.classList.toggle('active'));
}

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      e.preventDefault();
      const t = document.getElementById(href.slice(1));
      if (t) t.scrollIntoView({ behavior: 'smooth' });
      const nav = document.querySelector('.nav-list');
      if (nav && nav.classList.contains('active')) nav.classList.remove('active');
    });
  });
}

function initFadeInObserver() {
  const obs = new IntersectionObserver((entries, o) => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('visible'); o.unobserve(en.target); } });
  }, { threshold: 0.2 });
  document.querySelectorAll('.fade-in').forEach(el => obs.observe(el));
}

/* ══════════════════════════════════════════════════════
   4. INICIALIZACIÓN
   ══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const yearSpan = document.getElementById('year');
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();

  initMobileMenu();
  initSmoothScroll();
  initFadeInObserver();

  const avatarImg = document.getElementById('roblox-profile-img');
  if (avatarImg) loadAvatar(ROBLOX_USER_ID, avatarImg);

  // Primera carga de presencia
  updateAvatarStatus(ROBLOX_USER_ID);

  // Si la primera falla, reintenta a los 5 segundos
  setTimeout(() => {
    const container = document.getElementById('roblox-profile-container');
    if (container && container.classList.contains('status-offline')) {
      updateAvatarStatus(ROBLOX_USER_ID);
    }
  }, 5000);

  // Actualización periódica cada 60s
  const interval = setInterval(() => updateAvatarStatus(ROBLOX_USER_ID), 60000);
  window.addEventListener('beforeunload', () => clearInterval(interval));

  // Actualizar cuando la pestaña vuelve a ser visible
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (avatarImg) loadAvatar(ROBLOX_USER_ID, avatarImg);
      updateAvatarStatus(ROBLOX_USER_ID);
    }
  });

  // ─── TEMA OSCURO / CLARO ────────────────────────────────────────────────────
  const themeBtn  = document.getElementById('theme-toggle');
  const themeIcon = document.getElementById('theme-icon-img');

  const imgBase = (() => {
    const m = document.querySelector('meta[name="locale-base"]');
    return m ? m.content + 'img/' : 'img/';
  })();

  function updateThemeUI() {
    if (themeIcon) {
      themeIcon.src = document.body.classList.contains('light-mode')
        ? imgBase + 'moon.webp'
        : imgBase + 'sun.webp';
    }
  }

  if (themeBtn) {
    if (localStorage.getItem('theme') === 'light') document.body.classList.add('light-mode');
    updateThemeUI();
    themeBtn.addEventListener('click', () => {
      document.body.classList.toggle('light-mode');
      localStorage.setItem('theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
      updateThemeUI();
    });
  }
});

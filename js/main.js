// js/main.js - cliente: carga avatar + presencia cada load/visibilitychange/interval
// Asegúrate de que window.PROXY_BASE esté definido en index.html o use localhost:3000

const PROXY_BASE = (typeof window.PROXY_BASE !== 'undefined') ? String(window.PROXY_BASE).replace(/\/$/,'') : (location.hostname === 'localhost' ? 'http://localhost:3000' : '/api');
const THUMBNAIL_PROXY = `${PROXY_BASE}/avatar`;
const PRESENCE_PROXY   = `${PROXY_BASE}/presence`;
const ROBLOX_USER_ID   = 3404416545; // cámbialo si quieres

// dataURL fallback
const PLACEHOLDER_DATAURL = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">
     <rect fill="#efefef" width="150" height="150" rx="12"/>
     <g transform="translate(15,20)">
       <circle cx="60" cy="30" r="28" fill="#d0d0d0"/>
       <rect x="12" y="72" width="96" height="20" rx="6" fill="#d0d0d0"/>
     </g>
   </svg>`
);

// util fetch con timeout
async function fetchWithTimeout(url, opts={}, ms=7000) {
  const controller = new AbortController();
  const id = setTimeout(()=>controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal, ...opts });
    clearTimeout(id);
    return res;
  } catch(e) {
    clearTimeout(id);
    throw e;
  }
}

/* ============================
   Avatar loader (usa proxy que redirige al CDN)
   ============================ */
function loadAvatar(userId, imgEl, size='420x420') {
  if (!imgEl) return;
  // prevenir reentradas
  if (imgEl.dataset._loading) return;
  imgEl.dataset._loading = '1';
  // onerror fallback una vez
  imgEl.onerror = () => {
    if (imgEl.dataset._err) return;
    imgEl.dataset._err = '1';
    console.warn('[loadAvatar] failed to load', imgEl.src);
    // fallback: data URL SVG (si no hay imagen)
    imgEl.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><rect width="100%" height="100%" fill="#ddd"/><text x="50%" y="50%" font-size="14" text-anchor="middle" dominant-baseline="middle" fill="#666">Avatar</text></svg>`);
  };

  // No usar crossOrigin: dejar que el navegador siga la redirección a CDN
  const url = `${THUMBNAIL_PROXY}/${encodeURIComponent(userId)}?size=${encodeURIComponent(size)}&format=Png&isCircular=true`;
  imgEl.src = url; // el proxy debe redirigir (302) a la CDN
}

/* ============================
   Presence helpers
   ============================ */
function applyPresence(type) {
  const container = document.getElementById('avatar-container');
  if (!container) return;
  container.classList.remove("avatar-online", "avatar-inGame", "avatar-studio", "avatar-offline", "avatar-invisible");
  switch (type) {
    case 1: container.classList.add('avatar-online'); container.title = 'Online'; break;
    case 2: container.classList.add('avatar-inGame'); container.title = 'In Game'; break;
    case 3: container.classList.add('avatar-studio'); container.title = 'In Roblox Studio'; break;
    case 4: container.classList.add('avatar-invisible'); container.title = 'Invisible / Offline'; break;
    case 0:
    default: container.classList.add('avatar-offline'); container.title = 'Offline'; break;
  }
}

function resolvePresenceType(pres) {
  if (!pres) return null;
  if (typeof pres.userPresenceType === 'number') return pres.userPresenceType;
  if (typeof pres.presenceType === 'number') return pres.presenceType;
  if (typeof pres.type === 'number') return pres.type;
  const maybeStr = pres.userPresenceType ?? pres.presenceType ?? pres.type;
  if (typeof maybeStr === 'string') {
    const n = parseInt(maybeStr,10);
    if (!Number.isNaN(n)) return n;
  }
  if (typeof pres.lastLocation === 'string') {
    if (/studio/i.test(pres.lastLocation)) return 3;
    if (/^\d+$/.test(pres.lastLocation)) return 2;
  }
  if (pres.isOnline === true) return 1;
  if (pres.isOnline === false) return 0;
  if (pres.placeId || (pres.currentPlace && pres.currentPlace.placeId)) return 2;
  return null;
}

async function fetchPresenceFromProxy(userId) {
  try {
    const res = await fetchWithTimeout(PRESENCE_PROXY, {
      method:'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ userIds: [Number(userId)]})
    }, 7000);
    if (!res || !res.ok) return null;
    const j = await res.json();
    const arr = j?.userPresences ?? j?.data ?? j?.presences ?? j?.presence ?? j;
    if (Array.isArray(arr) && arr.length) return arr[0];
    if (typeof arr === 'object') return arr;
    return null;
  } catch(e) {
    console.debug('[fetchPresenceFromProxy] error', e?.message || e);
    return null;
  }
}
async function updateAvatarStatus(userId) {
  const container = document.getElementById('avatar-container');
  if (!container) return;
  container.classList.remove('avatar-online','avatar-inGame','avatar-studio','avatar-offline','avatar-invisible');
  container.classList.add('avatar-offline');
  container.title = 'Detecting presence...';
  try {
    const pres = await fetchPresenceFromProxy(userId);
    if (!pres) { applyPresence(0); return; }
    const resolved = resolvePresenceType(pres);
    if (resolved === null || typeof resolved !== 'number' || Number.isNaN(resolved)) applyPresence(0);
    else applyPresence(resolved);
  } catch(err) {
    console.error('[updateAvatarStatus] exception', err);
    applyPresence(0);
  }
}

/* ============================
   Helpers UI (mantén los tuyos si ya existen)
   ============================ */
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
      const id = href.slice(1);
      const t = document.getElementById(id);
      if (t) t.scrollIntoView({ behavior: 'smooth' });
      const nav = document.querySelector('.nav-list');
      if (nav && nav.classList.contains('active')) nav.classList.remove('active');
    });
  });
}
function initFadeInObserver() {
  const obs = new IntersectionObserver((entries, o) => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('visible'); o.unobserve(en.target); }});
  }, { threshold: 0.2 });
  document.querySelectorAll('.fade-in').forEach(el => obs.observe(el));
}

/* ============================
   Inicialización y eventos
   ============================ */
document.addEventListener('DOMContentLoaded', () => {
  // año
  const yearSpan = document.getElementById('year');
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();

  initMobileMenu();
  initSmoothScroll();
  initFadeInObserver();

  // avatar img
  const avatarImg = document.getElementById('avatar-img');
  if (avatarImg) {
    // si quieres un placeholder inicial, ponlo aquí; pero lo dejamos vacío para que proxy cargue.
    loadAvatar(ROBLOX_USER_ID, avatarImg, '420x420');
  }

  // presencia: actualizar ahora y cada 60s
   updateAvatarStatus(ROBLOX_USER_ID);
  const interval = setInterval(()=> updateAvatarStatus(ROBLOX_USER_ID), 60_000);
  window.addEventListener('beforeunload', ()=> clearInterval(interval));

  // refrescar al volver al tab visible
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // forzar recarga de la imagen (limpiando flags)
      if (avatarImg) {
        delete avatarImg.dataset._loading;
        delete avatarImg.dataset._err;
        loadAvatar(ROBLOX_USER_ID, avatarImg, '420x420');
      }
      updateAvatarStatus(ROBLOX_USER_ID);
    }
  });
});

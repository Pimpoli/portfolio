// js/main.js - cliente: carga avatar + presencia cada load/visibilitychange/interval
// Asegúrate de que window.PROXY_BASE esté definido en index.html o use localhost:3000

const PROXY_BASE = (typeof window.PROXY_BASE !== 'undefined') ? String(window.PROXY_BASE).replace(/\/$/,'') : (location.hostname === 'localhost' ? 'http://localhost:3000' : '/api');
const PRESENCE_PROXY   = `${PROXY_BASE}/presence`;
const ROBLOX_USER_ID   = 3404416545; // cámbialo si quieres

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
   Avatar loader (fetch JSON -> set src)
   ============================ */
async function loadAvatar(userId, imgEl, size='420x420') {
  if (!imgEl) return;
  // prevenir reentradas
  if (imgEl.dataset._loading) return;
  imgEl.dataset._loading = '1';

  // URL de respaldo directa (por si falla el proxy o la API)
  // Añadimos timestamp para evitar caché rota
  const fallbackUrl = `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=420&height=420&format=png&_t=${Date.now()}`;

  // Configurar fallback por si la URL de imagen falla al cargar (403/404)
  imgEl.onerror = () => {
    console.warn('Error cargando imagen. Intentando siguiente método...');
    delete imgEl.dataset._loading;
    
    // Si falló el Proxy, intentamos el enlace directo de Roblox
    if (!imgEl.src.includes('headshot-thumbnail') && !imgEl.src.includes('MultiGameInc.webp')) {
      imgEl.src = fallbackUrl;
    } else if (imgEl.src.includes('headshot-thumbnail')) {
      // Si falló Roblox (Plan B), usamos el logo local (Plan C) para que no se vea roto
      imgEl.src = 'img/MultiGameInc.webp';
    }
  };
  imgEl.onload = () => { delete imgEl.dataset._loading; };

  try {
    // 1. Pedimos el JSON a nuestro proxy (igual que tu código de referencia)
    const response = await fetch(`${PROXY_BASE}/avatar/${userId}`);
    if (!response.ok) throw new Error('Proxy error');
    const data = await response.json();

    // 2. Extraemos la URL y la asignamos
    if (data.data && data.data.length > 0 && data.data[0].imageUrl) {
      imgEl.src = data.data[0].imageUrl;
    } else {
      throw new Error('No se encontró imageUrl en la respuesta');
    }
  } catch (error) {
    console.error('Error obteniendo datos del avatar (catch), usando fallback:', error);
    // Fallback inmediato si falla el fetch (ej. servidor apagado)
    imgEl.src = fallbackUrl;
  }
}

/* ============================
   Presence helpers
   ============================ */
function applyPresence(type) {
  const container = document.getElementById('roblox-profile-container');
  if (!container) return;
  container.classList.remove("status-online", "status-ingame", "status-studio", "status-offline");
  switch (type) {
    case 1: container.classList.add('status-online'); container.title = 'Online'; break;
    case 2: container.classList.add('status-ingame'); container.title = 'In Game'; break;
    case 3: container.classList.add('status-studio'); container.title = 'In Roblox Studio'; break;
    case 0:
    default: container.classList.add('status-offline'); container.title = 'Offline'; break;
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
  const container = document.getElementById('roblox-profile-container');
  if (!container) return;
  container.classList.remove('status-online','status-ingame','status-studio','status-offline');
  container.classList.add('status-offline');
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
  const avatarImg = document.getElementById('roblox-profile-img');
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

// js/main.js - cliente: carga avatar + presencia

const ROBLOX_USER_ID = 3404416545; // Tu ID

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
   1. CARGAR AVATAR REAL (Vía RoProxy)
   ============================ */
async function loadAvatar(userId, imgEl) {
  if (!imgEl) return;
  if (imgEl.dataset._loading) return;
  imgEl.dataset._loading = '1';

  imgEl.onload = () => { delete imgEl.dataset._loading; };
  imgEl.onerror = () => { delete imgEl.dataset._loading; };

  try {
    // Usamos RoProxy, el proxy nativo para desarrolladores de Roblox (Funciona en producción)
    const url = `https://thumbnails.roproxy.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`;
    
    const response = await fetchWithTimeout(url, { method: 'GET' }, 7000);
    if (!response.ok) throw new Error('Error al conectar con RoProxy');
    
    const data = await response.json();
    
    if (data && data.data && data.data.length > 0 && data.data[0].imageUrl) {
      imgEl.src = data.data[0].imageUrl;
      return; 
    }
    throw new Error('No se encontró URL en el JSON');

  } catch (error) {
    console.warn('Fallo RoProxy para el avatar, usando fallback directo:', error);
    imgEl.src = `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=420&height=420&format=png&_t=${Date.now()}`;
  }
}

/* ============================
   2. PRESENCIA Y COLORES
   ============================ */
function applyPresence(type) {
  const container = document.getElementById('roblox-profile-container');
  if (!container) return;
  
  container.classList.remove("status-online", "status-ingame", "status-studio", "status-offline");
  
  switch (type) {
    case 1: container.classList.add('status-online'); container.title = 'Conectado'; break;
    case 2: container.classList.add('status-ingame'); container.title = 'Jugando'; break;
    case 3: container.classList.add('status-studio'); container.title = 'En Roblox Studio'; break;
    case 0:
    default: container.classList.add('status-offline'); container.title = 'Desconectado'; break;
  }
}

function resolvePresenceType(pres) {
  if (!pres) return null;
  if (typeof pres.userPresenceType === 'number') return pres.userPresenceType;
  if (typeof pres.presenceType === 'number') return pres.presenceType;
  if (typeof pres.type === 'number') return pres.type;
  
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
    // RoProxy para la presencia
    const url = `https://presence.roproxy.com/v1/presence/users`;

    const res = await fetchWithTimeout(url, {
      method:'POST',
      headers: { 'Content-Type':'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ userIds: [Number(userId)]})
    }, 7000);

    if (!res || !res.ok) return null;
    const j = await res.json();
    
    const arr = j?.userPresences ?? j?.data ?? j?.presences ?? j?.presence ?? j;
    if (Array.isArray(arr) && arr.length) return arr[0];
    return null;
  } catch(e) {
    return null;
  }
}

async function updateAvatarStatus(userId) {
  const container = document.getElementById('roblox-profile-container');
  if (!container) return;
  
  try {
    const pres = await fetchPresenceFromProxy(userId);
    if (!pres) { applyPresence(0); return; }
    
    const resolved = resolvePresenceType(pres);
    if (resolved === null || typeof resolved !== 'number' || Number.isNaN(resolved)) {
      applyPresence(0);
    } else {
      applyPresence(resolved);
    }
  } catch(err) {
    applyPresence(0);
  }
}

/* ============================
   3. FUNCIONES DE INTERFAZ (UI)
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
   4. INICIALIZACIÓN
   ============================ */
document.addEventListener('DOMContentLoaded', () => {
  const yearSpan = document.getElementById('year');
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();

  initMobileMenu();
  initSmoothScroll();
  initFadeInObserver();

  const avatarImg = document.getElementById('roblox-profile-img');
  
  if (avatarImg) {
    loadAvatar(ROBLOX_USER_ID, avatarImg);
  }

  updateAvatarStatus(ROBLOX_USER_ID);
  const interval = setInterval(()=> updateAvatarStatus(ROBLOX_USER_ID), 60000);
  window.addEventListener('beforeunload', ()=> clearInterval(interval));

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (avatarImg) loadAvatar(ROBLOX_USER_ID, avatarImg);
      updateAvatarStatus(ROBLOX_USER_ID);
    }
  });
});

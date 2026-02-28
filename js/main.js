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
   1. CARGAR AVATAR REAL (JSON vía Proxy)
   ============================ */
async function loadAvatar(userId, imgEl) {
  if (!imgEl) return;
  // Prevenir reentradas
  if (imgEl.dataset._loading) return;
  imgEl.dataset._loading = '1';

  // Limpiamos flags de carga al final
  imgEl.onload = () => { delete imgEl.dataset._loading; };
  imgEl.onerror = () => { delete imgEl.dataset._loading; };

  try {
    // URL oficial de Thumbnails de Roblox (Headshot)
    const targetUrl = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false&_t=${Date.now()}`;
    
    // Usamos corsproxy.io (que permite el acceso desde tu local) para leer el JSON
    const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(targetUrl);

    const response = await fetchWithTimeout(proxyUrl, { method: 'GET' }, 7000);
    if (!response.ok) throw new Error('Network response not ok');
    
    const data = await response.json();
    
    // Si obtenemos la respuesta correcta de Roblox
    if (data && data.data && data.data.length > 0) {
      const avatarUrl = data.data[0].imageUrl;
      if (avatarUrl) {
        // ¡Ponemos la imagen real aquí!
        imgEl.src = avatarUrl;
        return; // Éxito
      }
    }
    throw new Error('No se encontró URL de imagen en JSON');

  } catch (error) {
    console.warn('Fallo al obtener avatar real vía JSON, intentando método construido como respaldo:', error);
    // RESPALDO: Si falla el proxy o la API, intentamos el método construido (a veces funciona, a veces no)
    imgEl.src = `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=420&height=420&format=png&_t=${Date.now()}`;
  }
}

/* ============================
   2. PRESENCIA Y COLORES
   ============================ */
function applyPresence(type) {
  const container = document.getElementById('roblox-profile-container');
  if (!container) return;
  
  // Limpiamos los colores anteriores
  container.classList.remove("status-online", "status-ingame", "status-studio", "status-offline");
  
  // Aplicamos el color exacto según tu estado
  switch (type) {
    case 1: container.classList.add('status-online'); container.title = 'Conectado'; break; // Azul Claro
    case 2: container.classList.add('status-ingame'); container.title = 'Jugando'; break;   // Verde Claro
    case 3: container.classList.add('status-studio'); container.title = 'En Roblox Studio'; break; // Naranja
    case 0:
    default: container.classList.add('status-offline'); container.title = 'Desconectado'; break; // Gris
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
    // URL oficial de Roblox Presencia
    const targetUrl = `https://presence.roblox.com/v1/presence/users?_t=${Date.now()}`;
    const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(targetUrl);

    const res = await fetchWithTimeout(proxyUrl, {
      method:'POST',
      headers: {
        'Content-Type':'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ userIds: [Number(userId)]})
    }, 7000);

    if (!res || !res.ok) return null;
    const j = await res.json();
    
    // Extraemos la información del JSON
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
    if (!pres) { applyPresence(0); return; } // Si falla, se pone gris
    
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
  
  // 1. Cargar Avatar Real al abrir la web
  if (avatarImg) {
    loadAvatar(ROBLOX_USER_ID, avatarImg);
  }

  // 2. Cargar Estado al abrir la web y luego cada 60 segundos
  updateAvatarStatus(ROBLOX_USER_ID);
  const interval = setInterval(()=> updateAvatarStatus(ROBLOX_USER_ID), 60000);
  window.addEventListener('beforeunload', ()=> clearInterval(interval));

  // 3. Refrescar datos automáticamente si cambias de pestaña y vuelves a la web
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (avatarImg) {
        loadAvatar(ROBLOX_USER_ID, avatarImg);
      }
      updateAvatarStatus(ROBLOX_USER_ID);
    }
  });
});

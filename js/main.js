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

  // Status dot badge
  let dot = container.querySelector('.status-dot');
  if (!dot) {
    dot = document.createElement('span');
    dot.className = 'status-dot';
    container.appendChild(dot);
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
  } else if (type === 3 && gameName) {
    html += `<div><span style="opacity:0.55">Location:</span> <strong>${gameName}</strong></div>`;
  }
  tooltip.innerHTML = html;
}

function resolvePresenceType(pres) {
  if (!pres) return null;

  // API nueva: userPresenceType 0=Offline,1=Online,2=InGame,3=InStudio
  if (typeof pres.userPresenceType === 'number') return pres.userPresenceType;

  // API antigua /users/{id}: PresenceType — 0=Offline,1=Online,2=InGame,3=InStudio
  if (typeof pres.PresenceType === 'number') return pres.PresenceType;

  // API antigua /users/{id}/onlinestatus: LocationType — 0=offline,1=web,2=ingame,3=studio
  if (typeof pres.LocationType === 'number') return pres.LocationType;

  // Otros formatos
  if (typeof pres.presenceType === 'number') return pres.presenceType;
  if (typeof pres.type         === 'number') return pres.type;

  // Ubicación (API antigua LastLocation, nueva lastLocation)
  const loc = pres.LastLocation ?? pres.lastLocation ?? '';
  if (typeof loc === 'string' && loc.trim()) {
    if (/studio/i.test(loc)) return 3;
    return 2;
  }

  // Boolean online (API antigua IsOnline, nueva isOnline)
  const online = pres.IsOnline ?? pres.isOnline;
  if (online === true)  return 1;
  if (online === false) return 0;

  if (pres.PlaceId || pres.placeId || pres.gameId) return 2;
  return null;
}

async function fetchPresenceData(userId) {
  const uid = Number(userId);

  // Estrategia 1: proxy local con auth (localhost con servidor Node)
  if (window.PROXY_BASE) {
    try {
      const res = await fetchWithTimeout(
        `${window.PROXY_BASE}/presence`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userIds: [uid] }) },
        9000
      );
      if (res?.ok) {
        const j = await res.json();
        const arr = j?.userPresences ?? j?.data ?? j?.presences ?? (Array.isArray(j) ? j : null);
        if (Array.isArray(arr) && arr.length) return arr[0];
      }
    } catch (e) { /* siguiente */ }
  }

  // Estrategia 2: API antigua — endpoint /onlinestatus (público, sin auth)
  // Devuelve: { IsOnline, LastLocation, LocationType }
  // LocationType: 0=offline, 1=web, 2=ingame, 3=studio
  try {
    const res = await fetchWithTimeout(`https://api.roproxy.com/users/${uid}/onlinestatus`, {}, 7000);
    if (res?.ok) {
      const j = await res.json();
      if (typeof j?.IsOnline === 'boolean' || typeof j?.LocationType === 'number') return j;
    }
  } catch (e) { /* siguiente */ }

  // Estrategia 3: API antigua — /users/{id} básico
  try {
    const res = await fetchWithTimeout(`https://api.roproxy.com/users/${uid}`, {}, 7000);
    if (res?.ok) {
      const j = await res.json();
      if (typeof j?.IsOnline === 'boolean') return j;
    }
  } catch (e) { /* siguiente */ }

  // Estrategia 3: API nueva de presencia (requiere auth, pero algunos proxies la tienen configurada)
  try {
    const res = await fetchWithTimeout(
      'https://presence.roproxy.com/v1/presence/users',
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ userIds: [uid] }) },
      8000
    );
    if (res?.ok) {
      const j = await res.json();
      const arr = j?.userPresences ?? j?.data ?? j?.presences ?? (Array.isArray(j) ? j : null);
      if (Array.isArray(arr) && arr.length) return arr[0];
    }
  } catch (e) { /* siguiente */ }

  // Estrategia 4: last-online — estima si estuvo activo en los últimos 5 minutos
  try {
    const res = await fetchWithTimeout(
      'https://presence.roproxy.com/v1/presence/last-online',
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ userIds: [uid] }) },
      6000
    );
    if (res?.ok) {
      const j = await res.json();
      const arr = j?.lastOnlineTimestamps ?? j?.data ?? (Array.isArray(j) ? j : null);
      if (Array.isArray(arr) && arr.length) {
        const entry = arr[0];
        if (entry?.lastOnline) {
          const diff = Date.now() - new Date(entry.lastOnline).getTime();
          return { userPresenceType: diff < 5 * 60 * 1000 ? 1 : 0 };
        }
      }
    }
  } catch (e) { /* sin datos */ }

  return null;
}

async function updateAvatarStatus(userId) {
  try {
    const pres = await fetchPresenceData(userId);
    const resolved = resolvePresenceType(pres);
    // Soporta tanto API nueva (lastLocation) como API antigua (LastLocation)
    const gameName = pres?.LastLocation ?? pres?.lastLocation ?? null;
    applyPresence(typeof resolved === 'number' && !Number.isNaN(resolved) ? resolved : 0, gameName);
  } catch (e) {
    applyPresence(0);
  }
}

/* ══════════════════════════════════════════════════════
   3. TYPING EFFECT (hero subtitle)
   ══════════════════════════════════════════════════════ */
let _typingTimer = null;

function typeText(el, text, speed = 28) {
  if (_typingTimer) clearTimeout(_typingTimer);
  el.textContent = '';
  el.style.cssText += ';border-right:2px solid var(--color-accent);animation:cursor-blink 0.7s step-end infinite;';
  let i = 0;
  function step() {
    if (i <= text.length) {
      el.textContent = text.slice(0, i);
      i++;
      _typingTimer = setTimeout(step, speed);
    } else {
      setTimeout(() => {
        el.style.borderRight = 'none';
        el.style.animation = 'none';
      }, 900);
    }
  }
  step();
}

function initTypingEffect() {
  const subtitleEl = document.querySelector('#home .fade-in[data-i18n="home.subtitle"]');
  if (!subtitleEl) return;

  function runTyping() {
    const text = subtitleEl.textContent.trim();
    if (!text) return;
    typeText(subtitleEl, text);
  }

  // Fire on every languageLoaded (first call = initial load, subsequent = language switch)
  document.addEventListener('languageLoaded', () => setTimeout(runTyping, 60));
}

/* ══════════════════════════════════════════════════════
   4. UI: Menú, scroll suave, fade-in
   ══════════════════════════════════════════════════════ */
function initBackToTop() {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 420);
  }, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

function initScrollProgress() {
  const bar = document.getElementById('scroll-progress');
  if (!bar) return;
  const update = () => {
    const scrolled = document.documentElement.scrollTop || document.body.scrollTop;
    const total = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    bar.style.width = total > 0 ? (scrolled / total * 100) + '%' : '0%';
  };
  window.addEventListener('scroll', update, { passive: true });
  update();
}

function initHeaderScroll() {
  const header = document.querySelector('.header');
  if (!header) return;
  const toggle = () => header.classList.toggle('scrolled', window.scrollY > 40);
  window.addEventListener('scroll', toggle, { passive: true });
  toggle();
}

function initActiveNav() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-list a[href^="#"]');
  if (!sections.length || !navLinks.length) return;

  const obs = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const active = document.querySelector(`.nav-list a[href="#${en.target.id}"]`);
      if (!active) return; // sección sin enlace en el nav (ej. stats), no afectar el estado
      navLinks.forEach(a => a.classList.remove('active'));
      active.classList.add('active');
    });
  }, { rootMargin: '-40% 0px -55% 0px' });

  sections.forEach(s => obs.observe(s));
}

function initMobileMenu() {
  const hamburger = document.getElementById('hamburger');
  const navList   = document.querySelector('.nav-list');
  const overlay   = document.getElementById('nav-overlay');
  if (!hamburger || !navList) return;

  const open  = () => { navList.classList.add('active'); hamburger.classList.add('open'); if (overlay) overlay.classList.add('active'); };
  const close = () => { navList.classList.remove('active'); hamburger.classList.remove('open'); if (overlay) overlay.classList.remove('active'); };

  hamburger.addEventListener('click', () => navList.classList.contains('active') ? close() : open());
  if (overlay) overlay.addEventListener('click', close);
  navList.querySelectorAll('a').forEach(a => a.addEventListener('click', close));
}

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      e.preventDefault();
      const target = document.getElementById(href.slice(1));
      if (target) {
        const headerH = document.querySelector('.header')?.offsetHeight ?? 70;
        const top = target.getBoundingClientRect().top + window.scrollY - headerH;
        window.scrollTo({ top, behavior: 'smooth' });
      }
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

  initScrollProgress();
  initHeaderScroll();
  initActiveNav();
  initBackToTop();
  initMobileMenu();
  initSmoothScroll();
  initFadeInObserver();
  initTypingEffect();

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

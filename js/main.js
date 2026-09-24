// js/main.js — Interfaz común: tema, menú, scroll, animaciones de entrada, avatar y estado de Roblox.
// Se usa en la home y en MultiGameInc/; cada bloque comprueba que sus elementos existan.

(function () {
  'use strict';

  const { t, tf, store, compact } = window.U;
  const USER_ID = window.SITE.robloxUserId;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ═══════════ Animaciones de entrada ═══════════ */
  // Sin JS, o con "reducir movimiento", el contenido se ve directamente (ver .js .reveal en CSS).
  let revealObserver = null;
  function observeReveal(root = document) {
    const nodes = root.querySelectorAll ? root.querySelectorAll('.reveal:not(.is-visible)') : [];
    if (reduceMotion || !('IntersectionObserver' in window)) {
      nodes.forEach((n) => n.classList.add('is-visible'));
      return;
    }
    if (!revealObserver) {
      revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          en.target.classList.add('is-visible');
          revealObserver.unobserve(en.target);
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    }
    nodes.forEach((n) => revealObserver.observe(n));
  }
  window.observeReveal = observeReveal;

  /* ═══════════ Tema claro / oscuro ═══════════ */
  function initTheme() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const root = document.documentElement;
    const label = () => {
      const light = root.getAttribute('data-theme') === 'light';
      btn.setAttribute('aria-label', light
        ? t('a11y.themeDark', 'Switch to dark mode')
        : t('a11y.themeLight', 'Switch to light mode'));
    };
    btn.addEventListener('click', () => {
      const light = root.getAttribute('data-theme') !== 'light';
      if (light) root.setAttribute('data-theme', 'light');
      else root.removeAttribute('data-theme');
      store.set('theme', light ? 'light' : 'dark');
      label();
    });
    document.addEventListener('languageLoaded', label);
    label();
  }

  /* ═══════════ Menú móvil ═══════════ */
  function initMenu() {
    const btn = document.getElementById('menu-toggle');
    const nav = document.getElementById('site-nav');
    if (!btn || !nav) return;

    const setOpen = (open) => {
      document.body.classList.toggle('nav-open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? t('a11y.menuClose', 'Close menu') : t('a11y.menuOpen', 'Open menu'));
    };
    btn.addEventListener('click', () => setOpen(!document.body.classList.contains('nav-open')));
    nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.body.classList.contains('nav-open')) { setOpen(false); btn.focus(); }
    });
    document.addEventListener('click', (e) => {
      if (document.body.classList.contains('nav-open') && !nav.contains(e.target) && !btn.contains(e.target)) setOpen(false);
    });
    window.matchMedia('(min-width: 901px)').addEventListener('change', (m) => { if (m.matches) setOpen(false); });
    document.addEventListener('languageLoaded', () => setOpen(document.body.classList.contains('nav-open')));
  }

  /* ═══════════ Scroll: progreso, cabecera, enlace activo, volver arriba ═══════════ */
  function initScrollUI() {
    const bar = document.getElementById('scroll-progress');
    const header = document.querySelector('.site-header');
    const topBtn = document.getElementById('back-to-top');

    let ticking = false;
    const update = () => {
      ticking = false;
      const y = window.scrollY;
      if (bar) {
        const total = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.transform = `scaleX(${total > 0 ? Math.min(1, y / total) : 0})`;
      }
      if (header) header.classList.toggle('is-scrolled', y > 8);
      if (topBtn) topBtn.classList.toggle('is-visible', y > 600);
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();

    if (topBtn) topBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));

    const links = document.querySelectorAll('.nav-list a[href^="#"]');
    if (links.length && 'IntersectionObserver' in window) {
      const obs = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          links.forEach((a) => {
            const active = a.getAttribute('href') === `#${en.target.id}`;
            a.classList.toggle('is-active', active);
            if (active) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
          });
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      document.querySelectorAll('main section[id]').forEach((s) => obs.observe(s));
    }
  }

  /* ═══════════ Avatar y estado de Roblox ═══════════ */
  const PROFILE_URL = `https://www.roblox.com/users/${USER_ID}/profile`;
  const STATUS = ['offline', 'online', 'ingame', 'studio'];
  const PILL = {
    offline: ['presence.nowOffline', 'Offline right now'], online: ['presence.nowOnline', 'Online now'],
    ingame: ['presence.nowIngame', 'Playing now on Roblox'], studio: ['presence.nowStudio', 'In Studio now'],
  };
  const LABEL = {
    offline: ['presence.offline', 'Offline'], online: ['presence.online', 'Online'],
    ingame: ['presence.ingame', 'Playing now'], studio: ['presence.instudio', 'In Studio'],
  };
  const TITLE = {
    offline: ['presence.offlineText', 'Visit my Roblox profile'], online: ['presence.onlineText', 'Online on Roblox'],
    studio: ['presence.studioText', 'Building something new in Roblox Studio'],
  };

  const setKey = (el, [key, fallback]) => { if (!el) return; el.setAttribute('data-i18n', key); el.textContent = t(key, fallback); };
  let lastIconPlace = null;

  function applyPresence(p) {
    const status = STATUS[p?.type] || 'offline';
    document.querySelectorAll('[data-status]').forEach((el) => { el.dataset.status = status; });
    document.querySelectorAll('.status-pill .presence-label').forEach((el) => setKey(el, PILL[status]));

    const card = document.getElementById('now-card');
    if (!card) return;
    setKey(card.querySelector('.now-card__label'), LABEL[status]);
    const title = document.getElementById('now-title');
    const cta = document.getElementById('now-cta');
    const icon = document.getElementById('now-icon');

    if (status === 'ingame' && p.game) {
      // El nombre del juego lo pone su creador: se inserta como texto
      title.removeAttribute('data-i18n');
      title.textContent = p.game;
    } else {
      setKey(title, TITLE[status] || TITLE.online);
    }
    const gameUrl = status === 'ingame' && p.placeId ? `https://www.roblox.com/games/${p.placeId}` : null;
    card.href = gameUrl || PROFILE_URL;
    setKey(cta, gameUrl ? ['presence.viewGame', 'View game →'] : ['presence.viewProfile', 'View profile →']);

    const place = gameUrl ? p.placeId : null;
    if (place !== lastIconPlace) {
      lastIconPlace = place;
      if (!place) {
        icon.src = window.U.asset('img/roblox.webp');
      } else {
        // Se precarga y solo se cambia cuando el icono del juego ya está listo
        window.Roblox.placeIcon(place).then((url) => {
          if (!url || lastIconPlace !== place) return;
          const probe = new Image();
          probe.onload = () => { if (lastIconPlace === place) icon.src = url; };
          probe.src = url;
        });
      }
    }
  }

  const counts = { followers: null, friends: null };
  function renderCounts() {
    const el = document.getElementById('followers-count');
    if (!el) return;
    const lang = document.documentElement.lang || undefined;
    const parts = [];
    if (counts.followers !== null) parts.push(tf('presence.followers', '{n} followers', { n: counts.followers.toLocaleString(lang) }));
    if (counts.friends !== null) parts.push(tf('presence.friends', '{n} friends', { n: counts.friends.toLocaleString(lang) }));
    if (parts.length) el.textContent = parts.join(' · ');
  }

  async function refreshPresence() {
    const [pres, fol, fri] = await Promise.allSettled([
      window.Roblox.presence(USER_ID), window.Roblox.followers(USER_ID), window.Roblox.friends(USER_ID),
    ]);
    applyPresence(pres.status === 'fulfilled' && pres.value ? pres.value : { type: 0 });
    if (fol.status === 'fulfilled' && fol.value !== null) counts.followers = fol.value;
    if (fri.status === 'fulfilled' && fri.value !== null) counts.friends = fri.value;
    renderCounts();
  }

  // Avatar de cuerpo entero (PNG transparente) desde Roblox; si falla se queda el logo
  async function loadAvatar() {
    const img = document.getElementById('roblox-avatar');
    if (!img) return;
    const url = await window.Roblox.avatarUrl(USER_ID, 'full');
    if (!url) return;
    const probe = new Image();
    probe.onload = () => { img.src = url; img.classList.remove('is-fallback'); };
    probe.src = url;
  }

  // Nombre visible y fecha de creación de la cuenta
  let accountCreated = null;
  function renderSince() {
    const el = document.getElementById('roblox-since');
    if (!el || !accountCreated) return;
    el.removeAttribute('data-i18n');
    el.textContent = new Intl.DateTimeFormat(document.documentElement.lang || undefined, { month: 'long', year: 'numeric' })
      .format(new Date(accountCreated));
  }
  async function loadProfile() {
    const info = await window.Roblox.profile(USER_ID);
    if (!info) return;
    const nameEl = document.getElementById('roblox-display-name');
    if (nameEl && info.displayName) nameEl.textContent = info.displayName;
    accountCreated = info.created;
    renderSince();
  }

  function initPresence() {
    if (!document.getElementById('roblox-profile-container')) return;
    loadAvatar();
    loadProfile();
    refreshPresence();

    let timer = null;
    const start = () => { if (!timer) timer = setInterval(refreshPresence, 60_000); };
    const stop = () => { clearInterval(timer); timer = null; };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') { refreshPresence(); start(); } else stop();
    });
    start();
    document.addEventListener('languageLoaded', () => { renderCounts(); renderSince(); });
  }

  /* ═══════════ Inclinación 3D con el puntero ([data-tilt]) ═══════════ */
  function initTilt() {
    if (reduceMotion || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    document.querySelectorAll('[data-tilt]').forEach(bindTilt);
  }
  function bindTilt(el) {
    if (el._tilt) return;
    el._tilt = true;
    const max = el.classList.contains('avatar-stage') ? 10 : 6;
    let frame = 0;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        el.style.setProperty('--ry', `${(x * max * 2).toFixed(2)}deg`);
        el.style.setProperty('--rx', `${(-y * max * 2).toFixed(2)}deg`);
        el.classList.add('is-tilting');
      });
    });
    el.addEventListener('pointerleave', () => {
      cancelAnimationFrame(frame);
      el.style.removeProperty('--ry');
      el.style.removeProperty('--rx');
      el.classList.remove('is-tilting');
    });
  }
  window.bindTilt = (root = document) => {
    if (reduceMotion || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    root.querySelectorAll('[data-tilt]').forEach(bindTilt);
  };

  /* ═══════════ Inicio ═══════════ */
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  initTheme();
  initMenu();
  initScrollUI();
  initPresence();
  initTilt();
  observeReveal();

  // Exportado para MultiGameInc (misma lógica de formato)
  window.formatCompact = compact;
})();

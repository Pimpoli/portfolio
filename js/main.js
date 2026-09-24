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
  const STATUS = ['offline', 'online', 'ingame', 'studio'];
  const LABEL_KEYS = { offline: 'presence.offline', online: 'presence.online', ingame: 'presence.ingame', studio: 'presence.instudio' };
  const PILL_KEYS  = { offline: 'presence.nowOffline', online: 'presence.nowOnline', ingame: 'presence.nowIngame', studio: 'presence.nowStudio' };
  const FALLBACK   = { offline: 'Offline', online: 'Online', ingame: 'In game', studio: 'In Studio' };
  const PILL_FALLBACK = { offline: 'Offline right now', online: 'Online now', ingame: 'Playing now', studio: 'In Studio now' };

  function applyPresence(type) {
    const status = STATUS[type] || 'offline';
    document.querySelectorAll('[data-status]').forEach((el) => { el.dataset.status = status; });
    document.querySelectorAll('.status-pill .presence-label').forEach((el) => {
      el.setAttribute('data-i18n', PILL_KEYS[status]);
      el.textContent = t(PILL_KEYS[status], PILL_FALLBACK[status]);
    });
    document.querySelectorAll('.profile-badge .presence-label').forEach((el) => {
      el.setAttribute('data-i18n', LABEL_KEYS[status]);
      el.textContent = t(LABEL_KEYS[status], FALLBACK[status]);
    });
  }

  let followerCount = null;
  function renderFollowers() {
    const el = document.getElementById('followers-count');
    if (!el || followerCount === null) return;
    el.textContent = tf('presence.followers', '{n} followers', { n: followerCount.toLocaleString(document.documentElement.lang || undefined) });
  }

  async function refreshPresence() {
    const [pres, fol] = await Promise.allSettled([window.Roblox.presence(USER_ID), window.Roblox.followers(USER_ID)]);
    applyPresence(pres.status === 'fulfilled' && typeof pres.value === 'number' ? pres.value : 0);
    if (fol.status === 'fulfilled' && fol.value !== null) { followerCount = fol.value; renderFollowers(); }
  }

  async function loadAvatar() {
    const img = document.getElementById('roblox-profile-img');
    if (!img) return;
    const url = await window.Roblox.avatarUrl(USER_ID);
    if (!url) return; // se queda la imagen local
    const probe = new Image();
    probe.onload = () => { img.src = url; };
    probe.src = url;
  }

  function initPresence() {
    if (!document.getElementById('roblox-profile-container')) return;
    loadAvatar();
    refreshPresence();

    let timer = null;
    const start = () => { if (!timer) timer = setInterval(refreshPresence, 60_000); };
    const stop = () => { clearInterval(timer); timer = null; };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') { refreshPresence(); start(); } else stop();
    });
    start();
    document.addEventListener('languageLoaded', renderFollowers);
  }

  /* ═══════════ Inicio ═══════════ */
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  initTheme();
  initMenu();
  initScrollUI();
  initPresence();
  observeReveal();

  // Exportado para MultiGameInc (misma lógica de formato)
  window.formatCompact = compact;
})();

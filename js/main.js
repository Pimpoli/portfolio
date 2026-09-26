// js/main.js — Shared UI: theme, mobile menu, active nav link, reveal-on-scroll,
// and the live Roblox bits (avatar, presence line, follower counts).

(function () {
  'use strict';

  const { t, tf, store } = window.U;
  const USER_ID = window.SITE.robloxUserId;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Reveal on scroll ──────────────────────────────────────────────────────
  let observer = null;
  function observeReveal(root = document) {
    const nodes = root.querySelectorAll ? root.querySelectorAll('.reveal:not(.is-visible)') : [];
    if (reduceMotion || !('IntersectionObserver' in window)) {
      nodes.forEach((n) => n.classList.add('is-visible'));
      return;
    }
    if (!observer) {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          en.target.classList.add('is-visible');
          observer.unobserve(en.target);
        });
      }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
    }
    nodes.forEach((n) => observer.observe(n));
  }
  window.observeReveal = observeReveal;

  // ── Theme ─────────────────────────────────────────────────────────────────
  function initTheme() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const root = document.documentElement;
    const label = () => {
      const light = root.getAttribute('data-theme') === 'light';
      btn.setAttribute('aria-label', light ? t('a11y.themeDark', 'Switch to dark mode') : t('a11y.themeLight', 'Switch to light mode'));
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

  // ── Mobile menu ───────────────────────────────────────────────────────────
  function initMenu() {
    const btn = document.getElementById('menu-toggle');
    const nav = document.getElementById('site-nav');
    if (!btn || !nav) return;
    const isOpen = () => document.body.classList.contains('nav-open');
    const setOpen = (open) => {
      document.body.classList.toggle('nav-open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? t('a11y.menuClose', 'Close menu') : t('a11y.menuOpen', 'Open menu'));
    };
    btn.addEventListener('click', () => setOpen(!isOpen()));
    nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen()) { setOpen(false); btn.focus(); }
    });
    document.addEventListener('click', (e) => {
      if (isOpen() && !nav.contains(e.target) && !btn.contains(e.target)) setOpen(false);
    });
    window.matchMedia('(min-width: 981px)').addEventListener('change', (m) => { if (m.matches) setOpen(false); });
    document.addEventListener('languageLoaded', () => setOpen(isOpen()));
  }

  // ── Active section in the nav ─────────────────────────────────────────────
  function initActiveLink() {
    const links = document.querySelectorAll('.nav a[href^="#"]');
    if (!links.length || !('IntersectionObserver' in window)) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((a) => {
          const active = a.getAttribute('href') === `#${en.target.id}`;
          a.classList.toggle('is-active', active);
          if (active) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    document.querySelectorAll('main section[id]').forEach((s) => obs.observe(s));
  }

  // ── Roblox: avatar, presence, counts ──────────────────────────────────────
  const PROFILE_URL = `https://www.roblox.com/users/${USER_ID}/profile`;
  const STATUS = ['offline', 'online', 'ingame', 'studio'];
  const LABEL = {
    offline: ['presence.offline', 'offline'], online: ['presence.online', 'online'],
    ingame: ['presence.ingame', 'playing'], studio: ['presence.instudio', 'in Roblox Studio'],
  };
  let lastPresence = { type: 0 };

  function renderPresence() {
    const box = document.getElementById('presence');
    if (!box) return;
    const p = lastPresence;
    const status = STATUS[p.type] || 'offline';
    box.dataset.status = status;
    const text = document.getElementById('presence-text');
    text.replaceChildren();

    if (status === 'ingame' && p.game) {
      // "playing {game}" with the game name as a link; the name is text set by its creator
      const [before, after] = t('presence.playingTo', 'playing {game}').split('{game}');
      const link = document.createElement('a');
      link.href = p.placeId ? `https://www.roblox.com/games/${p.placeId}` : PROFILE_URL;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = p.game;
      text.append(before, link, after || '');
      const img = document.getElementById('presence-icon');
      if (img && p.placeId) {
        window.Roblox.placeIcon(p.placeId).then((url) => {
          if (!url || lastPresence.placeId !== p.placeId) return;
          const probe = new Image();
          probe.onload = () => { img.src = url; img.hidden = false; };
          probe.src = url;
        });
      }
    } else {
      const icon = document.getElementById('presence-icon');
      if (icon) icon.hidden = true;
      const [key, fallback] = LABEL[status];
      text.textContent = t(key, fallback);
    }
  }

  const counts = { followers: null, friends: null, members: null, created: null, visits: null };

  function renderCounts() {
    const lang = document.documentElement.lang || undefined;
    const fmt = (n) => n.toLocaleString(lang);

    const roblox = document.getElementById('roblox-counts');
    if (roblox) {
      roblox.textContent = counts.followers !== null && counts.friends !== null
        ? tf('contact.robloxCounts', 'PimpoliDev · {followers} followers · {friends} friends', { followers: fmt(counts.followers), friends: fmt(counts.friends) })
        : t('contact.roblox', 'PimpoliDev');
    }
    const mgi = document.getElementById('mgi-counts');
    if (mgi) {
      mgi.textContent = counts.members !== null
        ? tf('contact.mgiCounts', 'Roblox group · {n} members', { n: fmt(counts.members) })
        : t('contact.mgi', 'Roblox group');
    }
    // Texts that mix in live numbers: data-i18n-vars="key" → {n}, {members}, {games}, {visits}
    const vars = {
      n: counts.members !== null ? fmt(counts.members) : '130',
      members: counts.members !== null ? fmt(counts.members) : '130',
      games: String(window.SITE.games.length),
      visits: counts.visits !== null ? window.U.compact(counts.visits) : '44K+',
    };
    document.querySelectorAll('[data-i18n-vars]').forEach((node) => {
      node.textContent = tf(node.dataset.i18nVars, node.textContent, vars);
    });
    const since = document.getElementById('roblox-since');
    if (since && counts.created) {
      since.textContent = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' }).format(new Date(counts.created));
    }
    document.querySelectorAll('[data-year]').forEach((node) => {
      node.textContent = tf(node.dataset.year, '© {year}', { year: new Date().getFullYear() });
    });
  }

  async function refreshPresence() {
    const p = await window.Roblox.presence(USER_ID);
    lastPresence = p || { type: 0 };
    renderPresence();
  }

  async function loadAvatar() {
    const img = document.getElementById('roblox-avatar');
    if (!img) return;
    const url = await window.Roblox.avatarUrl(USER_ID, 'full');
    if (!url) return;
    const probe = new Image();
    probe.onload = () => { img.src = url; img.classList.remove('is-fallback'); };
    probe.src = url;
  }

  async function loadProfile() {
    const [info, fol, fri, members] = await Promise.all([
      window.Roblox.profile(USER_ID), window.Roblox.followers(USER_ID), window.Roblox.friends(USER_ID), window.Roblox.groupMembers(),
    ]);
    if (info?.displayName) document.querySelectorAll('.roblox-display-name').forEach((n) => { n.textContent = info.displayName; });
    counts.created = info?.created || null;
    counts.followers = fol;
    counts.friends = fri;
    counts.members = members;
    renderCounts();
    window.Roblox.getGames().then((games) => {
      const known = games.filter((g) => g.visits !== null);
      if (known.length) { counts.visits = known.reduce((sum, g) => sum + g.visits, 0); renderCounts(); }
    });
  }

  function initRoblox() {
    loadProfile();
    if (!document.getElementById('presence')) return;
    loadAvatar();
    refreshPresence();
    let timer = null;
    const start = () => { if (!timer) timer = setInterval(refreshPresence, 60_000); };
    const stop = () => { clearInterval(timer); timer = null; };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') { refreshPresence(); start(); } else stop();
    });
    start();
  }

  document.addEventListener('languageLoaded', () => { renderPresence(); renderCounts(); });

  initTheme();
  initMenu();
  initActiveLink();
  initRoblox();
  renderCounts();
  observeReveal();
})();

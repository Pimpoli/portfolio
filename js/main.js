// js/main.js — Shared UI: theme, mobile menu, active nav link, reveal-on-scroll,
// and the live Roblox bits (avatar card, presence, follower counts).

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
  const PILL = {
    offline: ['presence.nowOffline', 'Offline right now'], online: ['presence.nowOnline', 'Online now'],
    ingame: ['presence.nowIngame', 'Playing on Roblox now'], studio: ['presence.nowStudio', 'Coding in Studio now'],
  };
  const LABEL = {
    offline: ['presence.offline', 'Offline'], online: ['presence.online', 'Online on Roblox'],
    ingame: ['presence.ingame', 'Playing on Roblox'], studio: ['presence.instudio', 'Coding in Roblox Studio'],
  };
  let lastPresence = null;
  let iconPlace = null;

  function renderPresence() {
    if (!lastPresence) return;
    const p = lastPresence;
    const status = STATUS[p.type] || 'offline';
    document.querySelectorAll('.hero [data-status]').forEach((n) => { n.dataset.status = status; });
    document.querySelectorAll('.status-pill .presence-label').forEach((n) => {
      n.removeAttribute('data-i18n');
      n.textContent = t(...PILL[status]);
    });

    const card = document.getElementById('now-card');
    if (!card) return;
    const inGame = status === 'ingame' && p.game;
    // The game name is set by its creator, so it only ever goes in as text
    document.getElementById('now-status').textContent = inGame
      ? tf('presence.playingTo', 'Playing {game}', { game: p.game })
      : t(...LABEL[status]);
    document.getElementById('now-status').removeAttribute('data-i18n');

    const gameUrl = inGame && p.placeId ? `https://www.roblox.com/games/${p.placeId}` : null;
    card.href = gameUrl || PROFILE_URL;
    const cta = document.getElementById('now-cta');
    cta.removeAttribute('data-i18n');
    cta.textContent = gameUrl ? t('presence.viewGame', 'View game →') : t('presence.viewProfile', 'View profile →');

    const icon = document.getElementById('now-icon');
    const place = gameUrl ? p.placeId : null;
    if (place === iconPlace) return;
    iconPlace = place;
    if (!place) { icon.src = window.U.asset('img/roblox.webp'); return; }
    window.Roblox.placeIcon(place).then((url) => {
      if (!url || iconPlace !== place) return;
      const probe = new Image();
      probe.onload = () => { if (iconPlace === place) icon.src = url; };
      probe.src = url;
    });
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
    const social = document.getElementById('followers-count');
    if (social && counts.followers !== null && counts.friends !== null) {
      social.textContent = [
        tf('presence.followers', '{n} followers', { n: fmt(counts.followers) }),
        tf('presence.friends', '{n} friends', { n: fmt(counts.friends) }),
      ].join(' · ');
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

  // ── Avatar card follows the pointer ───────────────────────────────────────
  function initTilt() {
    if (reduceMotion || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    document.querySelectorAll('[data-tilt]').forEach((node) => {
      let frame = 0;
      node.addEventListener('pointermove', (e) => {
        const r = node.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          node.style.setProperty('--ry', `${(x * 22).toFixed(2)}deg`);
          node.style.setProperty('--rx', `${(-y * 18).toFixed(2)}deg`);
          node.classList.add('is-tilting');
        });
      });
      node.addEventListener('pointerleave', () => {
        cancelAnimationFrame(frame);
        node.style.removeProperty('--ry');
        node.style.removeProperty('--rx');
        node.classList.remove('is-tilting');
      });
    });
  }

  document.addEventListener('languageLoaded', () => { renderPresence(); renderCounts(); });

  initTheme();
  initMenu();
  initActiveLink();
  initRoblox();
  initTilt();
  renderCounts();
  observeReveal();
})();

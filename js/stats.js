// js/stats.js — The row of big numbers: counts up when it scrolls into view.

(function () {
  'use strict';

  const numbers = document.querySelectorAll('[data-stat]');
  if (!numbers.length) return;

  const { compact } = window.U;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function countUp(node, target, format) {
    if (reduceMotion) { node.textContent = format(target); return; }
    const start = performance.now();
    const duration = 1400;
    (function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      node.textContent = format(Math.round(eased * target));
      if (p < 1) requestAnimationFrame(tick);
    })(start);
  }

  const values = {
    years: Promise.resolve(4),
    games: Promise.resolve(window.SITE.games.length),
    visits: window.Roblox.getGames().then((games) => {
      const known = games.filter((g) => g.visits !== null);
      return known.length ? known.reduce((sum, g) => sum + g.visits, 0) : null;
    }),
    members: window.Roblox.groupMembers(),
  };
  const formats = {
    years: (n) => `${n}+`,
    games: (n) => String(n),
    visits: (n) => compact(n),
    members: (n) => String(n),
  };

  function show(node) {
    if (node.dataset.done) return;
    node.dataset.done = '1';
    const key = node.dataset.stat;
    values[key].then((value) => {
      if (value === null || value === undefined) { node.textContent = '—'; return; }
      countUp(node, value, formats[key]);
    });
  }

  if (!('IntersectionObserver' in window)) {
    numbers.forEach(show);
    return;
  }
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      obs.unobserve(en.target);
      show(en.target);
    });
  }, { threshold: 0.3 });
  numbers.forEach((n) => obs.observe(n));
})();

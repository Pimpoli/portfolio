// js/stats.js — Contadores animados + datos en vivo de Roblox (visitas y miembros del grupo)

(function () {
  'use strict';

  const cards = document.querySelectorAll('.stat-card');
  if (!cards.length) return;

  const { compact } = window.U;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function animate(el, target, duration, toStr) {
    if (reduceMotion) { el.textContent = toStr(target); return; }
    const start = performance.now();
    (function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = toStr(Math.round(eased * target));
      if (p < 1) requestAnimationFrame(tick);
    })(start);
  }

  // Número de juegos = juegos listados en js/config.js
  document.querySelectorAll('[data-stat="games"]').forEach((el) => { el.dataset.target = window.SITE.games.length; });

  // Los datos se piden desde el principio y se muestran al entrar en pantalla
  const sources = {
    visits: window.Roblox.getGames().then((games) => {
      const withVisits = games.filter((g) => g.visits !== null);
      return withVisits.length ? withVisits.reduce((sum, g) => sum + g.visits, 0) : null;
    }),
    members: window.Roblox.groupMembers(),
  };

  function show(num) {
    if (num.dataset.done) return;
    num.dataset.done = '1';
    const stat = num.dataset.stat;
    if (sources[stat]) {
      sources[stat].then((value) => {
        if (value === null) { num.textContent = '—'; return; }
        animate(num, value, 2000, compact);
      });
    } else if (num.dataset.target) {
      const suffix = num.dataset.suffix || '';
      animate(num, Number(num.dataset.target), 1400, (n) => n + suffix);
    }
  }

  if (!('IntersectionObserver' in window)) {
    cards.forEach((c) => { const n = c.querySelector('.stat-number'); if (n) show(n); });
    return;
  }
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      obs.unobserve(en.target);
      const n = en.target.querySelector('.stat-number');
      if (n) show(n);
    });
  }, { threshold: 0.3 });
  cards.forEach((c) => obs.observe(c));
})();

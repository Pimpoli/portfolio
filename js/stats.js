// js/stats.js — Contadores animados + datos en vivo de Roblox

const PLACE_IDS = [16125269940, 71541333892738, 108138370693321, 107726833867004, 107848717127408];
const MGI_GROUP = 17387910;

// ── Formateo de números grandes ───────────────────────────────────────────────
function fmt(n) {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return (Number.isInteger(m) ? m : m.toFixed(1)) + 'M+';
  }
  if (n >= 1_000) return Math.floor(n / 1000) + 'K+';
  return String(n);
}

// ── Animación numérica genérica ────────────────────────────────────────────────
function animateEl(el, target, duration, toStr) {
  const start = performance.now();
  (function tick(now) {
    const t     = Math.min((now - start) / duration, 1);
    const ease  = 1 - Math.pow(1 - t, 3);          // ease-out cubic
    el.textContent = toStr(Math.round(ease * target));
    if (t < 1) requestAnimationFrame(tick);
  })(start);
}

// Stat simple: data-target + data-suffix (ej. "4+")
function animateSimple(el) {
  const target = +el.dataset.target;
  const suffix = el.dataset.suffix ?? '';
  animateEl(el, target, 1800, n => n + suffix);
}

// Stat dinámica: número grande formateado (ej. "1.4M+")
function animateDynamic(el, value) {
  animateEl(el, value, 2200, fmt);
}

// ── API de Roblox ─────────────────────────────────────────────────────────────
async function fetchTotalVisits() {
  // 1. Place ID → Universe ID
  const universeIds = (
    await Promise.all(
      PLACE_IDS.map(async id => {
        try {
          const r = await fetch(
            `https://apis.roproxy.com/universes/v1/places/${id}/universe`,
            { signal: AbortSignal.timeout(8000) }
          );
          if (!r.ok) return null;
          return (await r.json())?.universeId ?? null;
        } catch { return null; }
      })
    )
  ).filter(Boolean);

  if (!universeIds.length) return null;

  // 2. Universe IDs → visits
  try {
    const r = await fetch(
      `https://games.roproxy.com/v1/games?universeIds=${universeIds.join(',')}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) return null;
    const data = (await r.json())?.data ?? [];
    return data.reduce((sum, g) => sum + (g.visits ?? 0), 0);
  } catch { return null; }
}

async function fetchMGIMembers() {
  try {
    const r = await fetch(
      `https://groups.roproxy.com/v1/groups/${MGI_GROUP}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) return null;
    return (await r.json())?.memberCount ?? null;
  } catch { return null; }
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const cards = document.querySelectorAll('.stat-card');
  if (!cards.length) return;

  // Lanzar ambos fetches en paralelo desde el principio
  const visitsP  = fetchTotalVisits();
  const membersP = fetchMGIMembers();

  const obs = new IntersectionObserver((entries, o) => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      o.unobserve(en.target);

      const num = en.target.querySelector('.stat-number');
      if (!num || num.dataset.done) return;
      num.dataset.done = '1';

      const stat = num.dataset.stat;

      if (stat === 'visits') {
        visitsP.then(total => {
          if (total !== null) animateDynamic(num, total);
          else num.textContent = '—';
        });
      } else if (stat === 'members') {
        membersP.then(count => {
          if (count !== null) animateDynamic(num, count);
          else num.textContent = '—';
        });
      } else {
        animateSimple(num);
      }
    });
  }, { threshold: 0.3 });

  cards.forEach(c => obs.observe(c));
});

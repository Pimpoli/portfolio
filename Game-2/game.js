// Ambidextro 3D — lógica del juego, HUD, controles y renderizado 2D de reserva.
// La física y los niveles trabajan en coordenadas 2D del mundo (px, «y» hacia abajo),
// igual que la versión original; render3d.js solo traduce ese estado a una escena three.js.
// Si WebGL no está disponible (o se pierde el contexto) se dibuja con el canvas 2D de siempre.

const $ = (id) => document.getElementById(id);

// ─── Preferencias ───────────────────────────────────────────────────────────
const motionMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
let reducedMotion = motionMQ.matches;
motionMQ.addEventListener?.('change', (e) => { reducedMotion = e.matches; });

// ─── Constantes ─────────────────────────────────────────────────────────────
const GRAVITY    = 0.58;
const JUMP_FORCE = -13.5;
const SPD        = 4.2;
const C1         = '#ff6b6b';
const C2         = '#4ecdc4';
const PFCOL      = '#2c2b40';
const TOTAL_LVLS = 25;

// ─── Niveles de tutorial (5 fijos) ──────────────────────────────────────────
// p1/p2: [x%, y%]  pf: [[x%,y%,w%,h%], ...]  spikes: []  time: segundos | null
const TUTORIAL = [
  // 1 — suelo ancho, sin límite de tiempo
  { p1:[0.07,0.72], p2:[0.84,0.72],
    pf:[[0,0.79,1,0.055]], spikes:[], time:null },
  // 2 — dos plataformas con un hueco
  { p1:[0.06,0.68], p2:[0.84,0.68],
    pf:[[0,0.75,0.44,0.05],[0.56,0.75,0.44,0.05]], spikes:[], time:20 },
  // 3 — dos alturas + plataforma de enlace
  { p1:[0.05,0.35], p2:[0.82,0.65],
    pf:[[0,0.42,0.38,0.05],[0.62,0.72,0.38,0.05],[0.36,0.58,0.28,0.05]], spikes:[], time:20 },
  // 4 — escalera
  { p1:[0.04,0.82], p2:[0.84,0.28],
    pf:[[0,0.88,0.22,0.05],[0.18,0.72,0.22,0.05],[0.36,0.56,0.22,0.05],
        [0.54,0.40,0.22,0.05],[0.74,0.24,0.26,0.05]], spikes:[], time:22 },
  // 5 — piedras flotantes
  { p1:[0.03,0.72], p2:[0.86,0.72],
    pf:[[0,0.78,0.17,0.05],[0.19,0.58,0.17,0.05],[0.38,0.40,0.22,0.05],
        [0.61,0.58,0.17,0.05],[0.80,0.78,0.20,0.05]], spikes:[], time:22 },
];

// ─── Generador procedural de niveles ────────────────────────────────────────
// Física: JUMP_FORCE=-13.5, GRAVITY=0.58, SPD=4.2
// Salto máx. ≈ 13.5²/(2×0.58) ≈ 157px → con H=450 → ~0.35H
// Tiempo en el aire ≈ 2×13.5/0.58 ≈ 46 frames → alcance ≈ 4.2×46 ≈ 193px → ~0.24W
const MAX_V_STEP = 0.28;  // salto vertical máx. entre plataformas consecutivas (fracción de H)
const MAX_H_GAP  = 0.22;  // hueco horizontal máx. entre bordes (fracción de W)

let sessionSeed = Math.trunc(Date.now() * (Math.random() + 0.1));

function makeLevels() {
  const levels = [...TUTORIAL];
  let s = sessionSeed | 0;
  const rng = () => {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    return ((s >>> 0) / 0x100000000);
  };

  const LAYOUTS = ['zigzag', 'ramp-up', 'ramp-down', 'bridge'];

  for (let i = 5; i < TOTAL_LVLS; i++) {
    const t      = (i - 5) / Math.max(1, TOTAL_LVLS - 6); // 0 → 1
    const lerp   = (a,b,v) => a + (b-a)*v;
    const layout = LAYOUTS[(i - 5) % LAYOUTS.length];

    const lw     = lerp(0.22, 0.14, t);   // ancho de las plataformas de salida
    const pfW    = lerp(0.18, 0.10, t);   // ancho de las intermedias
    const numMid = Math.round(lerp(6, 4, t));
    const timer  = Math.round(lerp(28, 13, t));

    // J1 empieza abajo a la izquierda; J2 arriba a la derecha
    const p1BaseY = 0.78;
    const p2BaseY = lerp(0.70, 0.28, t);

    const pf = [
      [0,       p1BaseY, lw,  0.045],
      [1 - lw,  p2BaseY, lw,  0.045],
    ];

    const midStart = lw + 0.01;
    const midEnd   = 1 - lw - 0.01;
    const colW     = (midEnd - midStart) / numMid;

    let prevY = p1BaseY;
    let prevX = midStart;

    for (let col = 0; col < numMid; col++) {
      const progress = (col + 1) / (numMid + 1);

      let baseY;
      if (layout === 'zigzag') {
        baseY = col % 2 === 0
          ? lerp(p1BaseY, p1BaseY - 0.30, progress)
          : lerp(p1BaseY - 0.30, p2BaseY, progress);
      } else if (layout === 'ramp-up') {
        baseY = lerp(p1BaseY, p2BaseY, progress);
      } else if (layout === 'ramp-down') {
        baseY = lerp(p2BaseY, p1BaseY, progress);
      } else { // bridge
        baseY = lerp(p1BaseY, p2BaseY, 0.5) + (col % 2 === 0 ? 0 : -0.10);
      }

      const dy = (rng() - 0.5) * 0.16;
      let y = Math.max(0.10, Math.min(0.84, baseY + dy));
      y = Math.max(prevY - MAX_V_STEP, Math.min(prevY + MAX_V_STEP, y));

      const xBase = midStart + col * colW;
      const xOff  = rng() * Math.max(0, colW - pfW);
      let x = xBase + xOff;
      x = Math.max(prevX, Math.min(midEnd - pfW, x));          // sin solaparse
      x = Math.min(prevX + MAX_H_GAP + pfW, x + pfW) - pfW;   // hueco máximo

      pf.push([x, y, pfW, 0.04]);
      prevY = y;
      prevX = x + pfW;
    }

    const p1s = [pf[0][0] + 0.02,            pf[0][1] - 0.10];
    const p2s = [pf[1][0] + pf[1][2] - 0.10, pf[1][1] - 0.10];

    // Pinchos: máx. 1 por plataforma. Todas las intermedias miden pfW (≥ 0.10), así que
    // valen todas; antes se exigía > 0.12 y los niveles 21-25 se quedaban sin pinchos.
    const spikeCount = Math.round(lerp(0, 3, t));
    const spikes = [];
    const midPfs = pf.slice(2).filter(p => p[2] >= 0.08);
    const nSpikes = Math.min(spikeCount, midPfs.length);   // evita un bucle infinito abajo
    const usedPfs = new Set();
    for (let si = 0; si < nSpikes; si++) {
      let idx;
      do { idx = Math.floor(rng() * midPfs.length); } while (usedPfs.has(idx));
      usedPfs.add(idx);
      const tgt    = midPfs[idx];
      // Margen de 0.06 en plataformas anchas; en las estrechas se reduce para que el
      // pincho quede sobre la plataforma y siempre quede un lado libre donde pisar
      const margin = Math.min(0.06, tgt[2] / 2 - 0.02);
      const xOnPf  = tgt[0] + margin + rng() * Math.max(0, tgt[2] - margin * 2);
      spikes.push({ xPct: xOnPf, yPct: tgt[1], triggerDist: lerp(115, 80, t) });
    }

    levels.push({ p1: p1s, p2: p2s, pf, spikes, time: timer });
  }
  return levels;
}

let LEVELS = makeLevels();

// ─── Jugadores ──────────────────────────────────────────────────────────────
const mkPlayer = col => ({
  x:0, y:0, w:28, h:40,
  vx:0, vy:0, grounded:false,
  col, lives:3, shielded:false, invincible:0,
  spawn:{ x:0, y:0 },
});

let p1 = mkPlayer(C1);
let p2 = mkPlayer(C2);

// ─── Estado ─────────────────────────────────────────────────────────────────
let W = 800, H = 450;          // tamaño del mundo en px (depende del hueco disponible, como antes)
let currentLevel = 0;
let platforms    = [];
let spikes       = [];
let pickups      = [];
let timer        = 15;
let timerMax     = 15;
let lastTs       = 0;
let gameState    = 'intro';    // 'intro'|'playing'|'win'|'lost'|'complete'
let stateSince   = 0;
let completeTimeout = null;    // paso 'win' → 'complete' tras el último nivel

// Vista de solo lectura del juego para los renderizadores
const G = {
  get W() { return W; }, get H() { return H; },
  get platforms() { return platforms; }, get spikes() { return spikes; }, get pickups() { return pickups; },
  get p1() { return p1; }, get p2() { return p2; },
  get level() { return LEVELS[currentLevel]; }, get levelIndex() { return currentLevel; },
  get state() { return gameState; }, get reducedMotion() { return reducedMotion; },
};

// ─── Construcción de niveles ────────────────────────────────────────────────
function pushOutOfPlatforms(px, py, pw, ph) {
  let y = py;
  for (const pf of platforms) {
    if (px + pw > pf.x && px < pf.x + pf.w && y + ph > pf.y && y < pf.y + pf.h) {
      y = pf.y - ph - 2;
    }
  }
  return y;
}

function spawnPoint(pos, p) {
  const x = pos[0]*W;
  return { x, y: pushOutOfPlatforms(x, pos[1]*H, p.w, p.h) };
}

function buildLevel(idx) {
  const lv = LEVELS[idx];
  clearTimeout(completeTimeout);
  completeTimeout = null;

  platforms = lv.pf.map(([px,py,pw,ph]) => ({
    x:px*W, y:py*H, w:pw*W, h:ph*H,
    xPct:px, yPct:py, wPct:pw, hPct:ph,
  }));

  spikes = lv.spikes.map(sp => ({
    x: sp.xPct * W,
    yBase: sp.yPct * H,    // cara superior de la plataforma donde está el pincho
    xPct: sp.xPct, yPct: sp.yPct,
    triggerDist: sp.triggerDist,
    emerge: 0, width:13, height:22,
    dmgP1:false, dmgP2:false,
  }));

  // Objetos en algunas plataformas intermedias (solo en niveles aleatorios)
  pickups = [];
  if (idx >= 5) {
    platforms.slice(2).forEach((pf, i) => {
      if (i % 3 === 1 && Math.random() > 0.45) {
        const types = ['heart','shield','time'];
        pickups.push({
          type: types[Math.floor(Math.random() * types.length)],
          x: pf.x + pf.w/2,
          y: pf.y - 22,
          pfIdx: i + 2,
          collected: false,
        });
      }
    });
  }

  p1 = mkPlayer(C1);
  p2 = mkPlayer(C2);
  p1.spawn = spawnPoint(lv.p1, p1);
  p2.spawn = spawnPoint(lv.p2, p2);
  p1.x = p1.spawn.x; p1.y = p1.spawn.y;
  p2.x = p2.spawn.x; p2.y = p2.spawn.y;

  timerMax  = lv.time !== null ? lv.time : Infinity;
  timer     = timerMax;

  $('level-chip').textContent = `Nivel ${idx+1} / ${TOTAL_LVLS}`;
  renderer?.buildLevel();
  setState('playing');
  announce(`Nivel ${idx+1} de ${TOTAL_LVLS}` + (timerMax === Infinity ? ', sin límite de tiempo.' : `, ${timerMax} segundos.`));
}

// Tras un cambio de tamaño: recoloca todo proporcionalmente sin reiniciar el nivel
function relayoutLevel(oldW, oldH) {
  const anchorOf = p => {
    const pf = platforms.find(pf =>
      p.x + p.w > pf.x && p.x < pf.x + pf.w && Math.abs((p.y + p.h) - pf.y) <= 4);
    return pf ? { pf, frac: (p.x + p.w/2 - pf.x) / pf.w } : null;
  };
  const a1 = anchorOf(p1), a2 = anchorOf(p2);

  for (const pf of platforms) {
    pf.x = pf.xPct*W; pf.y = pf.yPct*H; pf.w = pf.wPct*W; pf.h = pf.hPct*H;
  }
  for (const sp of spikes) { sp.x = sp.xPct*W; sp.yBase = sp.yPct*H; }
  for (const pk of pickups) {
    const pf = platforms[pk.pfIdx];
    pk.x = pf.x + pf.w/2; pk.y = pf.y - 22;
  }

  const lv = LEVELS[currentLevel];
  p1.spawn = spawnPoint(lv.p1, p1);
  p2.spawn = spawnPoint(lv.p2, p2);

  for (const [p, a] of [[p1, a1], [p2, a2]]) {
    if (a) {
      p.x = a.pf.x + a.frac * a.pf.w - p.w/2;
      p.y = a.pf.y - p.h;
    } else {
      p.x = (p.x + p.w/2) * W / oldW - p.w/2;
      p.y = (p.y + p.h)   * H / oldH - p.h;
    }
    p.x = Math.max(0, Math.min(W - p.w, p.x));
  }
}

// ─── Estados, tarjetas y anuncios ───────────────────────────────────────────
const live = $('sr-status');
let announceTimer = null;
function announce(msg) {
  clearTimeout(announceTimer);
  live.textContent = '';
  announceTimer = setTimeout(() => { live.textContent = msg; }, 60);
}

const ICON = {
  heart:  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z"/></svg>',
  heartO: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" style="opacity:.55"><path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z"/></svg>',
  shield: '<svg class="sh" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/></svg>',
  clock:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M9.5 2.5h5M12 2.5V6"/></svg>',
};
const CARD_ICON = {
  intro: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="6" y="22" width="24" height="28" rx="6" fill="${C1}"/><rect x="34" y="22" width="24" height="28" rx="6" fill="${C2}"/><rect x="12" y="30" width="4" height="7" rx="2" fill="#14131c"/><rect x="20" y="30" width="4" height="7" rx="2" fill="#14131c"/><rect x="40" y="30" width="4" height="7" rx="2" fill="#14131c"/><rect x="48" y="30" width="4" height="7" rx="2" fill="#14131c"/></svg>`,
  win: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="9" y="24" width="23" height="28" rx="6" fill="${C1}"/><rect x="32" y="24" width="23" height="28" rx="6" fill="${C2}"/><path d="M32 6v8M20 10l4 6M44 10l-4 6" stroke="#f1c40f" stroke-width="3" stroke-linecap="round"/><rect x="15" y="31" width="4" height="7" rx="2" fill="#14131c"/><rect x="23" y="31" width="4" height="7" rx="2" fill="#14131c"/><rect x="37" y="31" width="4" height="7" rx="2" fill="#14131c"/><rect x="45" y="31" width="4" height="7" rx="2" fill="#14131c"/></svg>`,
  lost: `<svg viewBox="0 0 24 24" fill="none" stroke="#ff5a4f" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M9.5 2.5h5M12 2.5V6"/></svg>`,
  complete: `<svg viewBox="0 0 24 24" fill="#f1c40f" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z"/></svg>`,
};

const overlay = $('overlay');
const ovBtn   = $('ov-btn');

// En escritorio el mensaje de objetivo se ve siempre; en táctil solo en el primer nivel
function updateGoal() {
  $('goal').hidden = !(gameState === 'playing' && (!view.touch || currentLevel === 0));
}

function updateOverlay() {
  const s = gameState;
  updateGoal();
  if (s === 'playing') {
    if (!overlay.hidden) {
      overlay.hidden = true;
      if (document.activeElement === ovBtn) ovBtn.blur();
    }
    return;
  }
  let title = '', text = '', btn = '', extra = '';
  if (s === 'intro') {
    title = 'Cómo jugar';
    text  = 'Dos jugadores, un mismo dispositivo: haced que los dos cubos se toquen antes de que se acabe el tiempo.';
    extra = `<ul class="howto">
        <li><span class="sw p1"></span><b>Jugador 1</b><span class="kbd k1 only-keys">A · W · D</span><span class="note only-touch">botones de la izquierda</span></li>
        <li><span class="sw p2"></span><b>Jugador 2</b><span class="kbd k2 only-keys">← ↑ →</span><span class="note only-touch">botones de la derecha</span></li>
      </ul>
      <p class="legend"><span style="color:${C1}">${ICON.heart}</span>vida extra <span style="color:#f1c40f">${ICON.shield}</span>escudo <span style="color:${C2}">${ICON.clock}</span>+5 s</p>
      <p class="legend">Los pinchos rojos quitan una vida y caer al vacío resta 3 s.</p>`;
    btn = '¡A jugar!';
  } else if (s === 'win') {
    const last = currentLevel >= TOTAL_LVLS - 1;
    title = '¡Se tocaron!';
    text  = last ? '¡Último nivel superado!' : `Nivel ${currentLevel + 1} superado. ¡Así se hace!`;
    btn   = last ? 'Ver resultado' : 'Siguiente nivel';
  } else if (s === 'lost') {
    title = 'Tiempo agotado';
    text  = `Nivel ${currentLevel + 1}: no llegasteis a tocaros a tiempo.`;
    btn   = 'Reintentar';
  } else if (s === 'complete') {
    title = '¡Completado!';
    text  = `Superaste los ${TOTAL_LVLS} niveles de Ambidextro.`;
    btn   = 'Nuevos niveles aleatorios';
  }
  const card = overlay.firstElementChild;
  if (!overlay.hidden) { card.style.animation = 'none'; void card.offsetWidth; card.style.animation = ''; }
  overlay.className = 'st-' + s;
  $('ov-icon').innerHTML = CARD_ICON[s] || '';
  $('ov-title').textContent = title;
  $('ov-text').textContent  = text;
  $('ov-extra').innerHTML   = extra;
  ovBtn.textContent = btn;
  overlay.hidden = false;
  try { ovBtn.focus({ preventScroll: true }); } catch { /* sin foco */ }
}

function setState(s) {
  gameState = s;
  stateSince = performance.now();
  updateOverlay();
  if (s === 'win') {
    announce(currentLevel >= TOTAL_LVLS - 1 ? '¡Se tocaron! Último nivel superado.' : `¡Se tocaron! Nivel ${currentLevel + 1} superado. Pulsa Enter o toca para seguir.`);
  } else if (s === 'lost') {
    announce('Tiempo agotado. Pulsa Enter o toca para reintentar.');
  } else if (s === 'complete') {
    announce(`¡Completado! Superaste los ${TOTAL_LVLS} niveles. Pulsa Enter o toca para jugar niveles nuevos.`);
  }
}

// Avanza desde las pantallas de tutorial / victoria / derrota / completado (teclado o toque)
function advanceState() {
  // Evita saltarse una pantalla por una tecla o un toque que ya estaba en marcha
  if (performance.now() - stateSince < 300) return;
  if (gameState === 'intro') {
    setState('playing');
  } else if (gameState === 'win' && currentLevel < TOTAL_LVLS - 1) {
    currentLevel++; buildLevel(currentLevel);
  } else if (gameState === 'win' && currentLevel >= TOTAL_LVLS - 1) {
    clearTimeout(completeTimeout); completeTimeout = null;
    setState('complete');
  } else if (gameState === 'lost') {
    buildLevel(currentLevel);
  } else if (gameState === 'complete') {
    sessionSeed = Math.trunc(Date.now() * (Math.random() + 0.1));
    LEVELS = makeLevels();
    currentLevel = 5; // directo al primer nivel aleatorio
    buildLevel(currentLevel);
  }
}

// ─── Entrada ────────────────────────────────────────────────────────────────
const keys = {};
// Jugador 1: A/W/D · Jugador 2: flechas (y también J/I/L, como antes)
const P1_KEYS = { left: ['KeyA'], right: ['KeyD'], jump: ['KeyW'] };
const P2_KEYS = { left: ['ArrowLeft', 'KeyJ'], right: ['ArrowRight', 'KeyL'], jump: ['ArrowUp', 'KeyI'] };
// Teclas que usa el juego: solo a estas se les bloquea la acción por defecto
const GAME_KEYS = ['KeyA','KeyD','KeyW','ArrowLeft','ArrowRight','ArrowUp','ArrowDown',
                   'KeyJ','KeyL','KeyI','Space'];

document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if ((e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') && !e.repeat) {
    if (gameState !== 'playing') { advanceState(); e.preventDefault(); }
  }
  // No bloquear Tab, F5, Ctrl+R, Ctrl+F, zoom... ni nada con Ctrl/Meta/Alt
  if (GAME_KEYS.includes(e.code) && !e.ctrlKey && !e.metaKey && !e.altKey) e.preventDefault();
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

// Al cambiar de pestaña se sueltan todas las teclas (evita teclas "pegadas")
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    for (const k in keys) keys[k] = false;
    document.querySelectorAll('.mc-btn.pressed').forEach(b => b.classList.remove('pressed'));
  }
});

// ─── Física de los jugadores ────────────────────────────────────────────────
// k = dt normalizado a 60 fps (k = 1 a 60 fps → mismo comportamiento de siempre)
function updatePlayer(p, map, dtMs, k) {
  const goLeft  = map.left.some(key  => keys[key]);
  const goRight = map.right.some(key => keys[key]);
  const doJump  = map.jump.some(key  => keys[key]);

  if (goLeft)        p.vx = -SPD;
  else if (goRight)  p.vx = SPD;
  else               p.vx *= Math.pow(0.78, k);

  if (doJump && p.grounded) { p.vy = JUMP_FORCE; p.grounded = false; }

  p.vy = Math.min(p.vy + GRAVITY * k, 16); // velocidad de caída limitada (evita atravesar plataformas)
  const dy = p.vy * k;
  p.x  += p.vx * k;
  p.y  += dy;
  p.grounded = false;

  if (p.x < 0) p.x = 0;
  if (p.x + p.w > W) p.x = W - p.w;

  for (const pf of platforms) {
    if (p.x + p.w > pf.x && p.x < pf.x + pf.w) {
      const bot     = p.y + p.h;
      const bot_prv = bot - dy;
      if (bot_prv <= pf.y + 4 && bot >= pf.y - 2 && p.vy >= 0) {
        p.y = pf.y - p.h; p.vy = 0; p.grounded = true;
      }
    }
  }

  // Caída al vacío → reaparece con penalización de tiempo
  if (p.y > H + 30) {
    p.x = p.spawn.x; p.y = p.spawn.y;
    p.vx = 0; p.vy = -4;
    if (timer !== Infinity) timer = Math.max(0, timer - 3);
  }

  if (p.invincible > 0) p.invincible -= dtMs;
}

// ─── Pinchos ────────────────────────────────────────────────────────────────
function updateSpikes(dtMs, k) {
  const midX = p => p.x + p.w/2;
  for (const sp of spikes) {
    const near1  = Math.abs(midX(p1) - sp.x) < sp.triggerDist;
    const near2  = Math.abs(midX(p2) - sp.x) < sp.triggerDist;

    if (near1 || near2) sp.emerge = Math.min(1, sp.emerge + 0.038 * k);
    else                sp.emerge = Math.max(0, sp.emerge - 0.025 * k);

    if (sp.emerge < 0.65) { sp.dmgP1 = false; sp.dmgP2 = false; }

    if (sp.emerge >= 0.65) {
      const sLeft = sp.x - sp.width * 0.4;
      const sRight= sp.x + sp.width * 0.4;
      const sTip  = sp.yBase - sp.height * sp.emerge;

      if (!sp.dmgP1 && p1.invincible <= 0 &&
          p1.x < sRight && p1.x+p1.w > sLeft &&
          p1.y < sp.yBase && p1.y+p1.h > sTip) {
        sp.dmgP1 = true; damagePlayer(p1);
      }
      if (!sp.dmgP2 && p2.invincible <= 0 &&
          p2.x < sRight && p2.x+p2.w > sLeft &&
          p2.y < sp.yBase && p2.y+p2.h > sTip) {
        sp.dmgP2 = true; damagePlayer(p2);
      }
    }
  }
}

function damagePlayer(p) {
  if (p.shielded) { p.shielded = false; p.invincible = 2000; return; }
  p.lives = Math.max(0, p.lives - 1);
  p.invincible = 1800;
  const penalty = p.lives === 0 ? 5 : 3;
  if (timer !== Infinity) timer = Math.max(0, timer - penalty);
  p.x = p.spawn.x; p.y = p.spawn.y; p.vx = 0; p.vy = -5;
}

// ─── Objetos ────────────────────────────────────────────────────────────────
function updatePickups(ts) {
  for (const pk of pickups) {
    if (pk.collected) continue;
    const bobY = Math.sin(ts/600 + pk.x/50) * 4;
    const rx = pk.x - 12, ry = pk.y + bobY - 12, rw = 24, rh = 24;
    if (p1.x < rx+rw && p1.x+p1.w > rx && p1.y < ry+rh && p1.y+p1.h > ry) {
      pk.collected = true; applyPickup(pk, p1);
    }
    if (p2.x < rx+rw && p2.x+p2.w > rx && p2.y < ry+rh && p2.y+p2.h > ry) {
      pk.collected = true; applyPickup(pk, p2);
    }
  }
}

function applyPickup(pk, p) {
  switch (pk.type) {
    case 'heart':  p.lives = Math.min(5, p.lives + 1); break;
    case 'shield': p.shielded = true; break;
    case 'time':   if (timer !== Infinity) timer += 5; break;
  }
}

// ─── ¿Se tocan? ─────────────────────────────────────────────────────────────
function touching() {
  return p1.x < p2.x+p2.w && p1.x+p1.w > p2.x &&
         p1.y < p2.y+p2.h && p1.y+p1.h > p2.y;
}

// ─── HUD (HTML) ─────────────────────────────────────────────────────────────
const hudEls = {
  timer: $('timer'), val: $('time-val'), valLat: $('time-val-lat'), fill: $('time-fill'),
  p1: $('p1-icons'), p2: $('p2-icons'),
};
const hudCache = { secs: null, ratio: null, cls: null, p1: null, p2: null };

// Corazones (vacíos hasta 3) + escudo; en pantallas estrechas, forma compacta «♥ 3»
function livesMarkup(p) {
  let full = '';
  for (let i = 0; i < p.lives; i++) full += ICON.heart;
  for (let i = p.lives; i < 3; i++) full += ICON.heartO;
  const sh = p.shielded ? ICON.shield : '';
  return `<span class="lv-full">${full}${sh}</span><span class="lv-compact">${ICON.heart}${p.lives}${sh}</span>`;
}

function updateHUD() {
  const isInf = timer === Infinity;
  const secs  = isInf ? -1 : Math.ceil(timer);
  if (secs !== hudCache.secs) {
    hudCache.secs = secs;
    const txt = isInf ? 'Sin límite' : secs + 's';
    hudEls.val.textContent = txt;
    hudEls.valLat.textContent = isInf ? '∞' : txt;
  }
  const ratio = isInf ? 1 : Math.max(0, Math.min(timer / timerMax, 1));
  const r = Math.round(ratio * 400) / 400;
  if (r !== hudCache.ratio) { hudCache.ratio = r; hudEls.fill.style.transform = `scaleX(${r})`; }
  const cls = isInf ? 'inf' : (ratio <= 0.25 || timer <= 5) ? 'low' : '';
  if (cls !== hudCache.cls) { hudCache.cls = cls; hudEls.timer.className = cls; }

  for (const [key, p, n] of [['p1', p1, 1], ['p2', p2, 2]]) {
    const sig = p.lives + (p.shielded ? 's' : '');
    if (sig !== hudCache[key]) {
      hudCache[key] = sig;
      hudEls[key].innerHTML = livesMarkup(p);
      hudEls[key].setAttribute('aria-label',
        `Jugador ${n}: ${p.lives} ${p.lives === 1 ? 'vida' : 'vidas'}${p.shielded ? ', con escudo' : ''}`);
    }
  }
}

// ─── Maquetación ────────────────────────────────────────────────────────────
// Calcula el hueco de juego (sin HUD ni controles) y, como antes, el tamaño del mundo W×H
// a partir de él. Solo recoloca: nivel, temporizador y gameState se conservan.
const MIN_H = 240; // alto mínimo con los controles táctiles debajo
const view = { vw: 0, vh: 0, rect: { x: 0, y: 0, w: 0, h: 0 }, touch: false };

function computeLayout() {
  const vw = document.documentElement.clientWidth || window.innerWidth;
  const vh = window.innerHeight;
  const mc = $('mobile-controls');
  const hud = $('hud');
  const touch = getComputedStyle(mc).display !== 'none';
  document.body.classList.remove('mc-lateral');
  let rect;

  if (touch) {
    const barTop = mc.getBoundingClientRect().top;
    const top    = hud.getBoundingClientRect().bottom + 6;
    const avail  = barTop - top - 6;
    let lateral = false;
    if (avail < MIN_H) {
      // Pantalla baja (horizontal): controles a los lados, juego en el centro
      document.body.classList.add('mc-lateral');
      const g1 = mc.firstElementChild.getBoundingClientRect();
      const g2 = mc.lastElementChild.getBoundingClientRect();
      const left = g1.right + 10, right = g2.left - 10;
      if (right - left >= 300) {
        lateral = true;
        const t2 = $('topbar').getBoundingClientRect().bottom + 6;
        rect = { x: left, y: t2, w: right - left, h: vh - t2 - 8 };
      } else {
        document.body.classList.remove('mc-lateral');
      }
    }
    if (!lateral) rect = { x: 0, y: top, w: vw, h: Math.max(avail, 160) };
  } else {
    const top = hud.getBoundingClientRect().bottom + 8;
    const bottom = $('goal').hidden ? vh - 60 : Math.min(vh - 60, $('goal').getBoundingClientRect().top - 8);
    rect = { x: 0, y: top, w: vw, h: Math.max(bottom - top, 160) };
  }

  view.vw = vw; view.vh = vh; view.rect = rect; view.touch = touch;
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty('--play-top', Math.round(rect.y) + 'px');
  // Espacio ocupado abajo por los controles táctiles (para que las tarjetas no queden debajo)
  const lateral = document.body.classList.contains('mc-lateral');
  rootStyle.setProperty('--play-bottom', touch && !lateral ? Math.round(vh - mc.getBoundingClientRect().top) + 'px' : '0px');
  W = Math.round(Math.min(rect.w - 10, 860));
  H = Math.round(Math.min(Math.max(rect.h - 10, 200), 480));
}

function resize() {
  if (!renderer) return;
  const oldW = W, oldH = H;
  // El mensaje de objetivo cuenta para el hueco de escritorio aunque esté oculto
  const goal = $('goal'); const goalHidden = goal.hidden;
  if (!view.touch) goal.hidden = false;
  computeLayout();
  goal.hidden = goalHidden;
  if (platforms.length) relayoutLevel(oldW, oldH);
  renderer.resize(view, W !== oldW || H !== oldH);
  updateGoal();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));

// ─── Renderizado 2D de reserva (el de la versión original) ──────────────────
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x,y,w,h,r){
    r = Math.min(r||0,w/2,h/2);
    this.moveTo(x+r,y); this.lineTo(x+w-r,y);
    this.quadraticCurveTo(x+w,y,x+w,y+r); this.lineTo(x+w,y+h-r);
    this.quadraticCurveTo(x+w,y+h,x+w-r,y+h); this.lineTo(x+r,y+h);
    this.quadraticCurveTo(x,y+h,x,y+h-r); this.lineTo(x,y+r);
    this.quadraticCurveTo(x,y,x+r,y); this.closePath(); return this;
  };
}

function createRenderer2D(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D no disponible');

  function drawSpawnMarker(sx, sy, col) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle   = col;
    ctx.shadowBlur  = 10; ctx.shadowColor = col;
    const tx = sx + 14;
    ctx.beginPath();
    ctx.moveTo(tx,       sy - 28);
    ctx.lineTo(tx - 10,  sy - 46);
    ctx.lineTo(tx + 10,  sy - 46);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawPlayer(p, ts) {
    const blink = p.invincible > 0 && Math.floor(ts/90) % 2 === 0;
    if (blink && !reducedMotion) return;
    ctx.save();
    if (p.invincible > 0 && reducedMotion) ctx.globalAlpha = 0.45;
    if (p.shielded) {
      ctx.globalAlpha = reducedMotion ? 0.85 : 0.6 + 0.4 * Math.sin(ts/180);
      ctx.shadowBlur  = 22; ctx.shadowColor = '#f1c40f';
      ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x+p.w/2, p.y+p.h/2, p.w*0.95, 0, Math.PI*2); ctx.stroke();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }
    ctx.shadowBlur  = 13; ctx.shadowColor = p.col;
    ctx.fillStyle   = p.col;
    ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, 6); ctx.fill();
    ctx.fillStyle   = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 0;
    ctx.fillRect(p.x+5,  p.y+10, 5, 7);
    ctx.fillRect(p.x+18, p.y+10, 5, 7);
    ctx.restore();
  }

  function drawSpikes(ts) {
    for (const sp of spikes) {
      if (sp.emerge <= 0) continue;
      const h = sp.height * sp.emerge;
      ctx.shadowBlur  = sp.emerge > 0.7 ? 14 : 4;
      ctx.shadowColor = '#ff2200';
      ctx.fillStyle   = sp.emerge > 0.7 ? '#e74c3c' : '#993322';
      ctx.beginPath();
      ctx.moveTo(sp.x - sp.width/2, sp.yBase);
      ctx.lineTo(sp.x + sp.width/2, sp.yBase);
      ctx.lineTo(sp.x,              sp.yBase - h);
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      if (sp.emerge < 0.4) {
        ctx.strokeStyle = `rgba(255,80,0,${0.15 + 0.1*Math.sin(ts/150)})`;
        ctx.lineWidth   = 1.5;
        ctx.beginPath(); ctx.arc(sp.x, sp.yBase, sp.triggerDist * 0.3, Math.PI, Math.PI*2); ctx.stroke();
      }
    }
  }

  function drawPickups(ts) {
    for (const pk of pickups) {
      if (pk.collected) continue;
      const bobY = Math.sin(ts/600 + pk.x/50) * 4;
      const col  = pk.type==='heart' ? '#ff6b6b' : pk.type==='shield' ? '#f1c40f' : '#4ecdc4';
      const sym  = pk.type==='heart' ? '♥' : pk.type==='shield' ? '⛨' : '⏱';
      ctx.shadowBlur = 14; ctx.shadowColor = col;
      ctx.fillStyle  = col;
      ctx.beginPath(); ctx.arc(pk.x, pk.y+bobY, 12, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = '#14131c';
      ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(sym, pk.x, pk.y+bobY+1);
    }
  }

  let dpr = 1;
  return {
    kind: '2d', canvas,
    resize(v) {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width  = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width  = W + 'px';
      canvas.style.height = H + 'px';
      canvas.style.left = Math.round(v.rect.x + (v.rect.w - W) / 2) + 'px';
      canvas.style.top  = Math.round(v.rect.y + (v.rect.h - H) / 2) + 'px';
    },
    buildLevel() {},
    burst() {},
    render(ts) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(10,11,18,0.78)'; ctx.fillRect(0, 0, W, H);
      for (const pf of platforms) {
        ctx.fillStyle   = PFCOL;
        ctx.shadowBlur  = 6; ctx.shadowColor = 'rgba(78,205,196,0.18)';
        ctx.beginPath(); ctx.roundRect(pf.x, pf.y, pf.w, pf.h, 5); ctx.fill();
        ctx.shadowBlur  = 0;
        ctx.fillStyle = '#4a4868'; ctx.fillRect(pf.x + 3, pf.y, pf.w - 6, 2);
      }
      const lv = LEVELS[currentLevel];
      drawSpawnMarker(lv.p1[0]*W, lv.p1[1]*H, C1);
      drawSpawnMarker(lv.p2[0]*W, lv.p2[1]*H, C2);
      drawSpikes(ts);
      drawPickups(ts);
      drawPlayer(p1, ts);
      drawPlayer(p2, ts);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.shadowBlur = 0;
    },
    dispose() {},
  };
}

// ─── Elección de renderizador: three.js si hay WebGL, si no el canvas 2D ───────
const canvas2d = $('c');
let renderer = null;

function use2D(reason) {
  if (renderer?.kind === '2d') return;
  if (renderer) {
    try { renderer.dispose(); } catch { /* ya perdido */ }
    if (renderer.canvas.isConnected) renderer.canvas.replaceWith(canvas2d);
  }
  renderer = createRenderer2D(canvas2d);
  document.body.classList.remove('r3d');
  document.body.classList.add('r2d');
  if (reason) console.info('Ambidextro: usando el renderizado 2D (' + reason + ')');
  if (view.vw) renderer.resize(view, true);
}

async function initRenderer() {
  const force2d = /[?&]render=2d\b/.test(location.search);
  if (!force2d) {
    try {
      const { createRenderer3D } = await import('./render3d.js');
      const r3d = createRenderer3D(G, { onContextLost: () => use2D('contexto WebGL perdido') });
      const cv = r3d.canvas;
      cv.id = 'c';
      cv.setAttribute('role', 'img');
      cv.setAttribute('aria-label', canvas2d.getAttribute('aria-label'));
      canvas2d.replaceWith(cv);
      renderer = r3d;
      document.body.classList.add('r3d');
      return;
    } catch (err) {
      use2D('WebGL no disponible: ' + (err && err.message ? err.message : err));
      return;
    }
  }
  use2D('forzado con ?render=2d');
}

// ─── Bucle principal ────────────────────────────────────────────────────────
const FRAME_MS = 1000 / 60;
const MAX_DT   = 50;   // ms: al volver de otra pestaña no se descuenta el tiempo perdido

function winLevel() {
  setState('win');
  renderer.burst((p1.x + p1.w/2 + p2.x + p2.w/2) / 2, (p1.y + p1.h/2 + p2.y + p2.h/2) / 2);
  if (currentLevel >= TOTAL_LVLS - 1) {
    clearTimeout(completeTimeout);
    completeTimeout = setTimeout(() => {
      completeTimeout = null;
      if (gameState === 'win' && currentLevel >= TOTAL_LVLS - 1) setState('complete');
    }, 1300);
  }
}

function loop(ts) {
  const dtMs = Math.min(Math.max(ts - lastTs, 0), MAX_DT);
  const dt   = dtMs / 1000;  // segundos
  const k    = dtMs / FRAME_MS;
  lastTs     = ts;

  if (!document.hidden) {
    if (gameState === 'playing') {
      updatePlayer(p1, P1_KEYS, dtMs, k);
      updatePlayer(p2, P2_KEYS, dtMs, k);

      if (timer !== Infinity) {
        timer -= dt;
        if (timer <= 0) { timer = 0; setState('lost'); }
      }

      updateSpikes(dtMs, k);
      updatePickups(ts);
      if (touching()) winLevel();
    }
    updateHUD();
    renderer.render(ts, dtMs);
  }
  requestAnimationFrame(loop);
}

// ─── Controles táctiles ─────────────────────────────────────────────────────
function bindTouch(id, keyCode, extraPress) {
  const btn = $(id);
  if (!btn) return;
  const press = (e) => {
    e.preventDefault();
    keys[keyCode] = true;
    btn.classList.add('pressed');
    if (extraPress && gameState === 'playing') extraPress();
  };
  const release = (e) => {
    e.preventDefault();
    keys[keyCode] = false;
    btn.classList.remove('pressed');
  };
  btn.addEventListener('touchstart',  press,   { passive: false });
  btn.addEventListener('touchend',    release, { passive: false });
  btn.addEventListener('touchcancel', release, { passive: false });
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
}

// Jugador 1 (teclado: A/D/W)
bindTouch('mc-p1-left',  'KeyA', null);
bindTouch('mc-p1-right', 'KeyD', null);
bindTouch('mc-p1-jump',  'KeyW', () => {
  if (p1.grounded) { p1.vy = JUMP_FORCE; p1.grounded = false; }
});
// Jugador 2 (teclado: flechas / J/L/I)
bindTouch('mc-p2-left',  'ArrowLeft', null);
bindTouch('mc-p2-right', 'ArrowRight', null);
bindTouch('mc-p2-jump',  'ArrowUp', () => {
  if (p2.grounded) { p2.vy = JUMP_FORCE; p2.grounded = false; }
});

// Tocar o hacer clic en la tarjeta / pantalla para continuar
overlay.addEventListener('click', advanceState);

// ─── Arranque ───────────────────────────────────────────────────────────────
await initRenderer();
resize();
buildLevel(0);
setState('intro');
requestAnimationFrame(loop);
// Las fuentes web cambian la altura del HUD: se recalcula el hueco cuando terminan de cargar
document.fonts?.ready?.then(() => resize()).catch(() => {});

// Gancho para pruebas automatizadas (no afecta al juego)
window.__ambidextro = {
  get state() { return gameState; },
  get level() { return currentLevel + 1; },
  get renderer() { return renderer.kind; },
  get timer() { return timer; },
  get world() { return { W, H, rect: view.rect }; },
  players() { return [p1, p2].map(p => ({ x: p.x, y: p.y, vx: p.vx, vy: p.vy, grounded: p.grounded, lives: p.lives, shielded: p.shielded })); },
  spikes() { return spikes.map(s => ({ x: s.x, yBase: s.yBase, emerge: s.emerge })); },
  goto(n) { currentLevel = Math.max(0, Math.min(TOTAL_LVLS - 1, n - 1)); buildLevel(currentLevel); },
  setTimer(t) { timer = t; },
  place(i, x, y) { const p = i === 1 ? p1 : p2; p.x = x; p.y = y; p.vx = 0; p.vy = 0; },
  shield(i) { (i === 1 ? p1 : p2).shielded = true; },
  info() { return renderer.info ? renderer.info() : null; },
};

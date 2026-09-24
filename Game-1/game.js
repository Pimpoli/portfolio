// Color Block 3D — lógica del juego, HUD, entrada y bucle principal.
// La física y las reglas son las del juego 2D original (mundo en "píxeles de juego",
// valores por fotograma a 60 fps escalados con dt). El dibujo lo hace un renderizador
// intercambiable: three.js (render-3d.js) o, si no hay WebGL, canvas 2D (render-2d.js).
import { COLORS, PICKUP_TYPES, WORLD_H } from './shared.js';
import { create2DRenderer } from './render-2d.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const reduceMQ = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

// ─── Elementos ──────────────────────────────────────────────────────────────
let canvas = $('c');
const el = {
  stage: $('stage'), hud: $('hud'), hints: $('hints'), mc: $('mobile-controls'),
  score: $('score'), lives: $('lives'), livesSr: $('lives-sr'), round: $('round'), hiscore: $('hiscore'),
  target: $('target'), tSwatch: $('t-swatch'), tLabel: $('t-label'), tName: $('t-name'),
  tSecs: $('t-secs'), tFill: $('t-fill'), bonuses: $('bonuses'),
  pause: $('btn-pause'), overlay: $('overlay'), toasts: $('toasts'), glow: $('glow'), sr: $('sr-status'),
  screens: { start: $('screen-start'), pause: $('screen-pause'), over: $('screen-over') },
  btnStart: $('btn-start'), btnResume: $('btn-resume'), btnRestart: $('btn-restart'), btnAgain: $('btn-again'),
  startBest: $('start-best'), overScore: $('over-score'), overBest: $('over-best'),
  overRound: $('over-round'), overRecord: $('over-record'), modeNote: $('mode-note'),
};

// ─── Estado ─────────────────────────────────────────────────────────────────
const S = {
  W: 900, H: WORLD_H,
  score: 0, lives: 3, round: 1, hiScore: loadHiScore(), startHi: 0,
  started: false,
  gameOver: false,
  gameOverAt: 0,       // instante del GAME OVER (evita reinicios por toques accidentales)
  paused: false,
  shieldActive: false, scoreMultiplier: 1, slowRoundsLeft: 0,
  platforms: [], pickups: [], roundsSincePickup: 0,
  // Ronda: el reloj solo avanza mientras se juega (no en pausa ni con la pestaña oculta)
  targetColorIdx: 0, roundTimer: 1, roundMs: 3000, roundElapsed: 0,
  roundActive: false, nextRoundIn: 0, lastResult: null,
  dropPlatform: null,  // plataforma concreta que se atraviesa al bajar
  dropTimer: 0,        // ms restantes de la bajada
  reduced: reduceMQ.matches,
};

// localStorage puede estar bloqueado (modo privado, cookies desactivadas...)
function loadHiScore() {
  try { return parseInt(localStorage.getItem('cb_hs') || '0', 10) || 0; }
  catch (e) { return 0; }
}
function saveHiScore() {
  try { localStorage.setItem('cb_hs', String(S.hiScore)); } catch (e) { /* sin almacenamiento */ }
}

// ─── Jugador ────────────────────────────────────────────────────────────────
// Valores por fotograma a 60 fps; se escalan con dt para ir igual a 120/144 Hz
const GRAVITY    = 0.55;
const JUMP_FORCE = -13;
const SPEED      = 4.5;
const FRAME_MS   = 1000 / 60;
const MAX_DT     = 50;      // ms: evita saltos enormes tras cambiar de pestaña

const player = { x: 60, y: 100, w: 28, h: 42, vx: 0, vy: 0, grounded: false, colorIdx: -1 };
S.player = player;

let renderer = null;
function fx(type, data) { if (renderer) renderer.event(type, data); }

// ─── Plataformas ────────────────────────────────────────────────────────────
// Posición/tamaño de una plataforma según su fila y columna y el ancho del mundo
function layoutPlatform(p) {
  const W = S.W, H = S.H;
  if (p.row === 0) {        // Suelo (fila 0): nunca se elimina
    const bw = Math.floor(W / 6);
    p.x = p.col * bw; p.y = H - 60; p.w = bw - 2; p.h = 30;
  } else if (p.row === 1) { // Fila media
    const bw2 = Math.floor(W / 6);
    p.x = p.col * bw2 + (p.col % 2 === 0 ? 0 : 8); p.y = H - 160; p.w = bw2 - 12; p.h = 22;
  } else {                  // Fila alta
    const bw3 = Math.floor(W / 7);
    p.x = p.col * bw3 + 5; p.y = H - 260; p.w = bw3 - 18; p.h = 20;
  }
}

function makePlatform(row, col, colorIdx) {
  const p = { x: 0, y: 0, w: 0, h: 0, colorIdx, row, col, dead: false, warningTimer: 0 };
  layoutPlatform(p);
  return p;
}

function generatePlatforms() {
  S.platforms = [];
  for (let i = 0; i < 6; i++) S.platforms.push(makePlatform(0, i, i));
  for (let i = 0; i < 6; i++) S.platforms.push(makePlatform(1, i, (i + 2) % 6));
  for (let i = 0; i < 7; i++) S.platforms.push(makePlatform(2, i, (i + 4) % 6));

  // Jugador sobre el primer bloque del suelo
  player.x = S.platforms[0].x + 20;
  player.y = S.platforms[0].y - player.h - 2;
  player.vx = 0; player.vy = 0; player.grounded = true;
}

function triggerElimination() {
  const candidates = S.platforms.filter((p) => !p.dead && p.warningTimer <= 0 && p.row > 0);
  if (!candidates.length) return;
  const target = candidates[Math.floor(Math.random() * candidates.length)];
  target.warningTimer = 2200; // 2,2 s de aviso y desaparece
  fx('warn', target);
}

function checkRebuildPlatforms() {
  if (S.platforms.filter((p) => p.row > 0).every((p) => p.dead)) {
    // Se conserva el suelo y se reconstruyen las filas superiores
    S.platforms = S.platforms.filter((p) => p.row === 0);
    S.platforms.forEach((p) => { p.dead = false; p.warningTimer = 0; });
    for (let i = 0; i < 6; i++) S.platforms.push(makePlatform(1, i, (i + 2) % 6));
    for (let i = 0; i < 7; i++) S.platforms.push(makePlatform(2, i, (i + 4) % 6));
    fx('rebuild');
  }
}

// ─── Objetos que caen ───────────────────────────────────────────────────────
function spawnPickup() {
  const type = PICKUP_TYPES[Math.floor(Math.random() * PICKUP_TYPES.length)];
  S.pickups.push({ ...type, x: 50 + Math.random() * (S.W - 100), y: -20, vy: 0, collected: false, life: 12000 });
}

function updatePickups(dt, k) {
  const H = S.H;
  for (const pk of S.pickups) {
    if (pk.collected) continue;
    pk.life -= dt;
    if (pk.life <= 0) { pk.collected = true; continue; }

    // Gravedad (más suave que la del jugador)
    pk.vy = Math.min(pk.vy + GRAVITY * 0.45 * k, 8);
    const dy = pk.vy * k;
    pk.y += dy;

    // Rebote en plataformas vivas
    for (const p of S.platforms) {
      if (p.dead) continue;
      if (pk.x > p.x && pk.x < p.x + p.w) {
        const bot = pk.y + 14;
        if (bot - dy <= p.y && bot >= p.y) {
          pk.y = p.y - 14;
          pk.vy = -Math.abs(pk.vy) * 0.35;
        }
      }
    }

    if (pk.y > H + 30) { pk.collected = true; continue; }

    // Recogida
    if (player.x + player.w > pk.x - 14 && player.x < pk.x + 14 &&
        player.y + player.h > pk.y - 14 && player.y < pk.y + 14) {
      pk.collected = true;
      applyPickup(pk);
    }
  }
  S.pickups = S.pickups.filter((p) => !p.collected);
}

function applyPickup(pk) {
  switch (pk.id) {
    case 'heart':  S.lives = Math.min(5, S.lives + 1); updateLives(); break;
    case 'heal':   S.lives = Math.max(S.lives, 3);     updateLives(); break;
    case 'slow':   S.slowRoundsLeft = 2;  break;
    case 'shield': S.shieldActive = true; break;
    case 'double': S.scoreMultiplier = 2; break;
  }
  updateBonuses();
  toast(pk.label, pk.glow);
  fx('pickup', pk);
}

// ─── Entrada ────────────────────────────────────────────────────────────────
const keys = {};
// Teclas que usa el juego: solo a estas se les bloquea la acción por defecto
const GAME_KEYS = ['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
const JUMP_KEYS = ['Space', 'KeyW', 'ArrowUp'];
const DROP_KEYS = ['KeyS', 'ArrowDown'];
const isPlaying = () => S.started && !S.paused && !S.gameOver;

function tryJump() {
  if (!isPlaying()) return;
  if (player.grounded) { player.vy = JUMP_FORCE; player.grounded = false; fx('jump'); }
}

function tryDrop() {
  if (!isPlaying()) return;
  if (!player.grounded || S.dropTimer > 0) return;
  // Plataforma concreta bajo el jugador (solo filas > 0: el suelo no se atraviesa)
  const standingPf = S.platforms.find((p) =>
    !p.dead && p.row > 0 &&
    player.x + player.w > p.x && player.x < p.x + p.w &&
    Math.abs((player.y + player.h) - p.y) <= 4
  );
  if (standingPf) {
    S.dropPlatform = standingPf;
    S.dropTimer = 350;
    player.vy = 5;
    player.grounded = false;
    fx('drop');
  }
}

function clearKeys() { for (const k in keys) keys[k] = false; }

function togglePause() {
  if (!S.started || S.gameOver) return;
  setPaused(!S.paused);
}

function setPaused(v) {
  if (S.paused === v) return;
  S.paused = v;
  document.body.classList.toggle('is-paused', v);
  updatePauseButton();
  if (v) {
    showScreen('pause');
    el.btnResume.focus({ preventScroll: true });
    announce('Juego en pausa');
  } else {
    showScreen(null);
    focusStage();
  }
  requestFrame();
}

// Reinicio por toque/clic: pequeño margen para no saltarse el GAME OVER sin verlo
function tapRestart() {
  if (S.gameOver && performance.now() - S.gameOverAt > 600) resetGame();
}

function setGameOver() {
  S.gameOver = true;
  S.gameOverAt = performance.now();
  clearKeys();
  el.overScore.textContent = S.score;
  el.overBest.textContent = S.hiScore;
  el.overRound.textContent = S.round;
  el.overRecord.hidden = !(S.score > S.startHi && S.score > 0);
  showScreen('over');
  updatePauseButton();
  announce(`Fin de la partida. ${S.score} puntos. Récord: ${S.hiScore}.`);
  fx('gameover');
  // El foco pasa a «Jugar de nuevo» tras el margen anti-toques
  setTimeout(() => { if (S.gameOver) el.btnAgain.focus({ preventScroll: true }); }, 650);
  requestFrame();
}

function startGame() {
  if (S.started) return;
  S.started = true;
  document.body.classList.remove('is-idle');
  resetGame();
}

function onKeyDown(e) {
  keys[e.code] = true;
  const t = e.target instanceof Element ? e.target : null;
  const enter = e.code === 'Enter' || e.code === 'NumpadEnter';
  // Enter/Espacio sobre un botón (o Enter sobre un enlace): que lo active el propio control
  const activating = t && ((t.closest('button') && (enter || e.code === 'Space')) || (t.closest('a[href]') && enter));

  if (e.code === 'Escape') togglePause();
  if (!activating) {
    if (!S.started && (enter || e.code === 'Space')) { startGame(); e.preventDefault(); return; }
    if (JUMP_KEYS.includes(e.code)) tryJump();
    if (DROP_KEYS.includes(e.code)) tryDrop();
    if (enter && S.gameOver) { resetGame(); e.preventDefault(); }
    // No bloquear Tab, F5, Ctrl+R, Ctrl+F, zoom... ni nada con Ctrl/Meta/Alt
    if (GAME_KEYS.includes(e.code) && !e.ctrlKey && !e.metaKey && !e.altKey) e.preventDefault();
  }
}

function bindInput() {
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', clearKeys);

  // Pausa automática al cambiar de pestaña o minimizar
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { requestFrame(); return; }
    if (S.started && !S.gameOver) setPaused(true);
    clearKeys(); // evita teclas "pegadas"
  });

  el.pause.addEventListener('click', togglePause);
  el.btnStart.addEventListener('click', startGame);
  el.btnResume.addEventListener('click', () => setPaused(false));
  el.btnRestart.addEventListener('click', () => { if (S.paused) resetGame(); });
  el.btnAgain.addEventListener('click', (e) => {
    // Con teclado reinicia al momento (como Enter); con toque/clic respeta el margen
    if (e.detail === 0) { if (S.gameOver) resetGame(); } else tapRestart();
  });

  // Toque/clic fuera de los botones: empezar, continuar tras la pausa o reiniciar tras GAME OVER
  el.overlay.addEventListener('click', (e) => {
    if (e.target.closest('button, a')) return;
    if (document.body.classList.contains('dg-active')) return; // easter egg activo
    if (!S.started) startGame();
    else if (S.gameOver) tapRestart();
    else if (S.paused) setPaused(false);
  });

  // Controles táctiles (eventos de puntero: multitáctil y sin menú contextual)
  bindHoldBtn('mc-left',  'ArrowLeft',  null);
  bindHoldBtn('mc-right', 'ArrowRight', null);
  bindHoldBtn('mc-jump',  'Space',      tryJump);
  bindHoldBtn('mc-drop',  'ArrowDown',  tryDrop);

  reduceMQ.addEventListener?.('change', () => {
    S.reduced = reduceMQ.matches;
    if (renderer) renderer.setReducedMotion(S.reduced);
    requestFrame();
  });
}

function bindHoldBtn(id, keyCode, onPress) {
  const btn = $(id);
  if (!btn) return;
  const press = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try { btn.setPointerCapture(e.pointerId); } catch (err) { /* puntero sintético */ }
    if (keyCode) keys[keyCode] = true;
    btn.classList.add('pressed');
    if (!S.started) { startGame(); return; }
    // Tras GAME OVER cualquier botón táctil reinicia la partida
    if (S.gameOver) { tapRestart(); return; }
    if (onPress) onPress();
  };
  const release = () => {
    if (keyCode) keys[keyCode] = false;
    btn.classList.remove('pressed');
  };
  btn.addEventListener('pointerdown', press);
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointercancel', release);
  btn.addEventListener('lostpointercapture', release);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  // Activación con teclado (Enter/Espacio sobre el botón)
  btn.addEventListener('click', (e) => { if (e.detail === 0 && onPress) onPress(); });
}

// ─── Ronda ──────────────────────────────────────────────────────────────────
function scheduleNewRound(ms) { S.nextRoundIn = ms; }

function newRound() {
  S.targetColorIdx = Math.floor(Math.random() * COLORS.length);
  S.roundElapsed = 0;
  S.roundTimer = 1;
  S.nextRoundIn = 0;
  S.lastResult = null;
  S.roundMs = Math.max(1400, 3000 - S.round * 75);
  if (S.slowRoundsLeft > 0) { S.roundMs = Math.min(S.roundMs * 1.6, 4000); S.slowRoundsLeft--; updateBonuses(); }
  S.roundActive = true;
  S.roundsSincePickup++;

  // Cada 3 rondas (a partir de la 3) se avisa y elimina una plataforma
  if (S.round > 3 && S.round % 3 === 0) triggerElimination();

  // Un objeto cada 4-6 rondas
  if (S.roundsSincePickup >= 4 + Math.floor(Math.random() * 3)) {
    spawnPickup(); S.roundsSincePickup = 0;
  }
  setTargetCard();
  announce(`Ronda ${S.round}: ve al color ${COLORS[S.targetColorIdx].name}`);
  fx('round');
}

function updateRoundClock(dt) {
  // Transición entre rondas en tiempo de juego (se congela en pausa)
  if (S.nextRoundIn > 0) {
    S.nextRoundIn -= dt;
    if (S.nextRoundIn <= 0) newRound();
  }
  if (S.roundActive) S.roundElapsed += dt;
}

function checkRoundResult() {
  if (!S.roundActive) return;
  const elapsed = S.roundElapsed;
  S.roundTimer = 1 - Math.min(elapsed / S.roundMs, 1);

  if (elapsed < S.roundMs) return;
  S.roundActive = false;

  if (player.colorIdx === S.targetColorIdx) {
    const pts = (10 + S.round) * S.scoreMultiplier;
    S.scoreMultiplier = 1;
    S.score += pts;
    S.round++;
    if (S.score > S.hiScore) {
      S.hiScore = S.score;
      saveHiScore();
    }
    updateStats(); updateBonuses();
    showResult('win', pts);
    fx('win', pts);
    scheduleNewRound(700);
  } else if (S.shieldActive) {
    S.shieldActive = false;
    updateBonuses();
    toast('¡ESCUDO ACTIVADO!', '#f1c40f');
    showResult('shield');
    fx('shield');
    scheduleNewRound(700);
  } else {
    S.lives--;
    updateLives();
    showResult('lose');
    fx('hurt');
    if (S.lives <= 0) setGameOver();
    else {
      announce(`Color equivocado. Te quedan ${S.lives} ${S.lives === 1 ? 'vida' : 'vidas'}.`);
      scheduleNewRound(900);
    }
  }
}

// ─── Física ─────────────────────────────────────────────────────────────────
// k = dt normalizado a 60 fps (k = 1 a 60 fps → mismo comportamiento de siempre)
function updatePlayer(dt, k) {
  if (keys['ArrowLeft'] || keys['KeyA']) player.vx = -SPEED;
  else if (keys['ArrowRight'] || keys['KeyD']) player.vx = SPEED;
  else player.vx *= Math.pow(0.8, k);

  if (S.dropTimer > 0) { S.dropTimer -= dt; if (S.dropTimer <= 0) S.dropPlatform = null; }

  const wasGrounded = player.grounded;
  player.vy += GRAVITY * k;
  const vyBefore = player.vy;
  const dy = player.vy * k;
  player.x += player.vx * k;
  player.y += dy;
  player.grounded = false;
  player.colorIdx = -1;

  if (player.x < 0) player.x = 0;
  if (player.x + player.w > S.W) player.x = S.W - player.w;

  // Colisión con plataformas (salvo la que se está atravesando)
  for (const p of S.platforms) {
    if (p.dead || p === S.dropPlatform) continue;
    if (player.x + player.w > p.x && player.x < p.x + p.w) {
      const bot = player.y + player.h;
      const botPrev = bot - dy;
      if (botPrev <= p.y && bot >= p.y && player.vy >= 0) {
        player.y = p.y - player.h;
        player.vy = 0;
        player.grounded = true;
        player.colorIdx = p.colorIdx;
      }
    }
  }
  if (player.grounded && !wasGrounded) fx('land', vyBefore);

  // Caída fuera del mundo → pierde una vida
  if (player.y > S.H + 20) {
    S.lives--;
    updateLives();
    fx('hurt');
    if (S.lives <= 0) { setGameOver(); return; }
    const floor = S.platforms.find((p) => p.row === 0 && !p.dead);
    if (floor) {
      player.x = floor.x + 20;
      player.y = floor.y - player.h - 2;
    }
    player.vy = 0;
    fx('respawn');
  }
}

function updatePlatformWarnings(dt) {
  for (const p of S.platforms) {
    if (p.warningTimer <= 0) continue;
    p.warningTimer -= dt;
    if (p.warningTimer <= 0) {
      p.dead = true;
      fx('dead', p);
      checkRebuildPlatforms();
    }
  }
}

// ─── Reinicio ───────────────────────────────────────────────────────────────
function resetGame() {
  S.score = 0; S.lives = 3; S.round = 1; S.gameOver = false; S.paused = false;
  S.shieldActive = false; S.scoreMultiplier = 1; S.slowRoundsLeft = 0;
  S.pickups = []; S.roundsSincePickup = 0;
  S.dropPlatform = null; S.dropTimer = 0; S.nextRoundIn = 0;
  S.startHi = S.hiScore;
  document.body.classList.remove('is-paused');
  el.toasts.replaceChildren();
  updateStats(); updateLives(); updateBonuses(); updatePauseButton();
  showScreen(null);
  generatePlatforms();
  fx('reset');
  newRound();
  focusStage();
  requestFrame();
}

// ─── HUD (HTML sobre el lienzo) ─────────────────────────────────────────────
const HEART = '<path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z"/>';
let livesShown = -1, bonusSig = '', lastSecs = '';

function updateStats() {
  el.score.textContent = S.score;
  el.round.textContent = S.round;
  el.hiscore.textContent = S.hiScore;
  el.startBest.textContent = S.hiScore;
}

function updateLives() {
  if (S.lives === livesShown) return;
  livesShown = S.lives;
  const filled = Math.max(0, S.lives);
  const empty = Math.max(0, 3 - Math.min(S.lives, 3));
  let html = '';
  for (let i = 0; i < filled; i++) html += `<svg viewBox="0 0 24 24" fill="currentColor">${HEART}</svg>`;
  for (let i = 0; i < empty; i++) html += `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${HEART}</svg>`;
  el.lives.innerHTML = html;
  el.livesSr.textContent = `Vidas: ${filled}`;
}

function updateBonuses() {
  const list = [];
  if (S.scoreMultiplier > 1) list.push(['×2 puntos', '#f0a35e']);
  if (S.slowRoundsLeft > 0)  list.push([`Más tiempo ×${S.slowRoundsLeft}`, '#5dade2']);
  if (S.shieldActive)        list.push(['Escudo', '#f7dc6f']);
  const sig = list.map((b) => b[0]).join('|');
  if (sig === bonusSig) return;
  bonusSig = sig;
  el.bonuses.replaceChildren(...list.map(([txt, col]) => {
    const b = document.createElement('span');
    b.className = 'bonus';
    b.style.setProperty('--c', col);
    b.textContent = txt;
    return b;
  }));
}

function setTargetCard() {
  const c = COLORS[S.targetColorIdx];
  el.target.classList.remove('is-win', 'is-lose', 'is-shield', 'is-urgent');
  el.target.style.setProperty('--tc', c.hex);
  el.target.style.setProperty('--tt', c.text);
  el.tLabel.textContent = 'Ve al color';
  el.tName.textContent = c.name;
  el.tFill.style.transform = 'scaleX(1)';
  lastSecs = '';
  el.glow.style.backgroundColor = c.hex;
}

function showResult(type, pts) {
  el.target.classList.remove('is-urgent');
  el.target.classList.add('is-' + type);
  el.tFill.style.transform = 'scaleX(0)';
  if (type === 'win')    { el.tLabel.textContent = '¡Correcto!'; el.tSecs.textContent = '+' + pts; }
  if (type === 'shield') { el.tLabel.textContent = '¡Te salvó el escudo!'; el.tSecs.textContent = '0'; }
  if (type === 'lose')   { el.tLabel.textContent = 'Color equivocado'; el.tSecs.textContent = '−1'; }
  S.lastResult = type;
}

function frameHUD() {
  if (!S.roundActive) return;
  el.tFill.style.transform = `scaleX(${S.roundTimer.toFixed(4)})`;
  const secs = (Math.max(0, S.roundMs - S.roundElapsed) / 1000).toFixed(1) + 's';
  if (secs !== lastSecs) { el.tSecs.textContent = secs; lastSecs = secs; }
  el.target.classList.toggle('is-urgent', S.roundTimer < 0.25);
}

function updatePauseButton() {
  const can = S.started && !S.gameOver;
  el.pause.disabled = !can;
  el.pause.setAttribute('aria-pressed', String(S.paused));
  el.pause.setAttribute('aria-label', S.paused ? 'Continuar' : 'Pausar');
  el.pause.classList.toggle('is-paused', S.paused);
}

function showScreen(name) {
  for (const [k, node] of Object.entries(el.screens)) node.hidden = k !== name;
  el.overlay.hidden = !name;
  document.body.classList.toggle('has-overlay', !!name);
}

// El foco vuelve a la zona de juego (y no a un botón, donde Espacio lo pulsaría otra vez)
function focusStage() { el.stage.focus({ preventScroll: true }); }

function announce(msg) { el.sr.textContent = msg; }

function toast(text, color) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = text;
  t.style.color = color;
  t.addEventListener('animationend', () => t.remove());
  el.toasts.append(t);
  while (el.toasts.childElementCount > 4) el.toasts.firstElementChild.remove();
}

// ─── Diseño responsive ──────────────────────────────────────────────────────
// Solo recalcula tamaños y el encuadre: el estado de la partida (plataformas
// eliminadas, avisos, jugador, ronda) se conserva.
let safe = { x: 0, y: 0, w: 300, h: 300 };

function setWorldWidth(newW) {
  const oldW = S.W;
  if (!S.platforms.length) { S.W = newW; generatePlatforms(); return; }
  if (newW === oldW) return;

  // Plataforma sobre la que está el jugador (para mantenerlo encima)
  const standPf = S.platforms.find((p) => !p.dead &&
    player.x + player.w > p.x && player.x < p.x + p.w &&
    Math.abs((player.y + player.h) - p.y) <= 4);
  const standFrac = standPf ? (player.x + player.w / 2 - standPf.x) / standPf.w : 0;

  S.W = newW;
  S.platforms.forEach(layoutPlatform);

  const sx = newW / oldW;
  if (standPf) {
    player.x = standPf.x + standFrac * standPf.w - player.w / 2;
    player.y = standPf.y - player.h;
  } else {
    player.x = (player.x + player.w / 2) * sx - player.w / 2;
  }
  player.x = Math.max(0, Math.min(S.W - player.w, player.x));
  for (const pk of S.pickups) pk.x *= sx;
}

function layout() {
  // Tamaño real del lienzo (ocupa toda la ventana); con barras de navegador dinámicas
  // puede diferir unos píxeles de innerHeight
  const box = el.stage.getBoundingClientRect();
  const vw = Math.round(box.width) || window.innerWidth, vh = Math.round(box.height) || window.innerHeight;
  const body = document.body;
  const touchUI = getComputedStyle(el.mc).display !== 'none';
  body.classList.remove('mc-lateral');

  // Pantalla baja (móvil en horizontal): controles a los lados en vez de abajo
  if (touchUI) {
    const room = vh - el.hud.getBoundingClientRect().bottom - el.mc.offsetHeight;
    if (room < 250 && vw > vh) body.classList.add('mc-lateral');
  }
  const lateral = body.classList.contains('mc-lateral');
  const hudR = el.hud.getBoundingClientRect();
  let top = hudR.bottom + 10, bottom = vh - 14, left = 12, right = vw - 12;

  if (touchUI && !lateral) {
    bottom = el.mc.getBoundingClientRect().top - 10;
  } else if (touchUI && lateral) {
    const groups = el.mc.querySelectorAll('.mc-group');
    let side = 0;
    groups.forEach((g) => {
      const r = g.getBoundingClientRect();
      side = Math.max(side, r.left < vw / 2 ? r.right : vw - r.left);
    });
    left = side + 10; right = vw - side - 10;
    bottom = vh - 12;
  } else if (el.hints && getComputedStyle(el.hints).display !== 'none') {
    bottom = el.hints.getBoundingClientRect().top - 8;
  }
  if (bottom - top < 140) top = Math.max(0, bottom - 140);
  safe = { x: left, y: top, w: Math.max(120, right - left), h: Math.max(120, bottom - top) };

  setWorldWidth(Math.round(Math.max(300, Math.min(900, safe.w - 20))));

  // Brillo de fondo y mensajes flotantes centrados en la zona de juego
  const g = el.glow.style;
  g.left = (safe.x + safe.w / 2) + 'px';
  g.top = (safe.y + safe.h * 0.52) + 'px';
  g.width = Math.min(vw * 1.1, safe.w * 1.1) + 'px';
  g.height = Math.max(260, safe.h * 1.1) + 'px';
  el.toasts.style.left = (safe.x + safe.w / 2) + 'px';
  el.toasts.style.top = (safe.y + safe.h * 0.38) + 'px';

  if (renderer) renderer.resize(vw, vh, safe);
  requestFrame();
}

// ─── Bucle ──────────────────────────────────────────────────────────────────
let rafId = 0, lastTs = null;
function requestFrame() {
  if (!rafId && renderer) rafId = requestAnimationFrame(loop);
}

function loop(ts) {
  rafId = 0;
  const dt = lastTs == null ? 0 : Math.min(Math.max(ts - lastTs, 0), MAX_DT);
  const k = dt / FRAME_MS;
  lastTs = ts;

  const running = isPlaying();
  if (running) {
    updatePlayer(dt, k);
    updatePickups(dt, k);
    updatePlatformWarnings(dt);
    updateRoundClock(dt);
    checkRoundResult();
    frameHUD();
  }
  // En pausa o tras GAME OVER las animaciones visuales se congelan / terminan
  const animDt = running || (S.gameOver && ts - S.gameOverAt < 1600) || !S.started ? dt : 0;
  renderer.render(ts, animDt);

  const keepGoing = running ||
    (S.gameOver && performance.now() - S.gameOverAt < 1600) ||
    (!S.paused && renderer.busy());
  if (keepGoing && !document.hidden) requestFrame();
  else lastTs = null; // el siguiente fotograma empieza con dt = 0
}

// ─── Renderizador: three.js con WebGL 2 o, si no, canvas 2D ────────────────
function hasWebGL2() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return false;
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return true;
  } catch (e) { return false; }
}

async function pickRenderer() {
  const opts = { reduced: S.reduced };
  if (!params.has('2d') && hasWebGL2()) {
    try {
      const mod = await import('./render-3d.js');
      return mod.create3DRenderer(canvas, S, opts);
    } catch (err) {
      console.warn('Color Block: no se pudo iniciar WebGL, se usa el modo 2D.', err);
    }
  }
  // Lienzo nuevo por si el anterior se quedó con un contexto WebGL
  const fresh = canvas.cloneNode(false);
  canvas.replaceWith(fresh);
  canvas = fresh;
  document.body.classList.add('is-2d');
  if (!params.has('2d')) el.modeNote.hidden = false;
  return create2DRenderer(canvas, S, opts);
}

function boot() {
  bindInput();
  updateStats(); updateLives(); updateBonuses(); updatePauseButton();
  showScreen('start');
  layout();
  window.addEventListener('resize', layout);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', layout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);

  pickRenderer().then((r) => {
    renderer = r;
    document.body.classList.add(r.kind === '3d' ? 'is-3d' : 'is-2d');
    layout();
    requestFrame();
  });
}

boot();

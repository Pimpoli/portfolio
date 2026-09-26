// js/destroygame.js — Easter egg: destruye la página con una nave.
// Se activa con #destroygame, ?destroygame o /destroygame (también destroy-game / destroy_game)
// y desde la consola con window.activateDestroyGame(). Funciona con ratón y con pantalla táctil.

(function () {
  'use strict';

  // Estilos propios: se cargan solo al activarse, relativos a este script (sirve en subcarpetas)
  const cssHref = (() => {
    try { return new URL('../css/destroygame.css', document.currentScript.src).href; } catch { return null; }
  })();
  function ensureStyles() {
    if (!cssHref || document.querySelector(`link[href="${cssHref}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssHref;
    document.head.append(link);
  }

  const t = (key, fallback) => (window.U ? window.U.t(key, fallback) : fallback);
  const readBest = () => { try { return parseInt(localStorage.getItem('dg_hs') || '0', 10) || 0; } catch { return 0; } };
  const saveBest = (v) => { try { localStorage.setItem('dg_hs', String(v)); } catch { /* sin almacenamiento */ } };

  const TARGETS_SEL = [
    'h1', 'h2', 'h3', 'p',
    '.media-card', '.game-card', '.product-card', '.info-card', '.founder-card', '.stat-card',
    '.contact-card', '.chip', '.nav-link', '.brand-name', '.social-btn',
  ].join(',');

  let session = null; // partida activa (para poder salir o reiniciar desde fuera)

  function initDestroyGame() {
    if (session) return;
    ensureStyles();

    // ─── Estado ────────────────────────────────────────────────────────────────
    let score = 0;
    let lives = 3;
    let active = true;
    let shootCooldown = 0;
    let pointerDown = false;
    let pointerX = window.innerWidth / 2;
    let pointerY = window.innerHeight / 2;
    let enemyTimer = null;
    let spawnInterval = 2200;
    let rafId = null;
    const highScore = readBest();

    const ship = document.createElement('div');
    ship.id = 'dg-ship';
    document.body.append(ship);
    document.body.classList.add('dg-active');

    // ─── HUD ───────────────────────────────────────────────────────────────────
    const hud = document.createElement('div');
    hud.id = 'dg-hud';
    const scoreTxt = document.createElement('span');
    const livesTxt = document.createElement('span');
    const bestTxt = document.createElement('span');
    bestTxt.style.opacity = '0.6';
    const exitBtn = document.createElement('button');
    exitBtn.id = 'dg-exit-btn';
    exitBtn.type = 'button';
    const labelExit = () => { exitBtn.textContent = '✕ ' + t('destroy.exit', 'EXIT'); };
    labelExit();
    document.addEventListener('languageLoaded', labelExit); // si arranca antes de cargar el idioma
    hud.append(scoreTxt, livesTxt, bestTxt, exitBtn);
    document.body.append(hud);

    function updateHUD() {
      scoreTxt.textContent = `SCORE: ${score}`;
      livesTxt.textContent = '♥'.repeat(Math.max(0, lives)) + '♡'.repeat(Math.max(0, 3 - lives));
      bestTxt.textContent = `BEST: ${Math.max(score, highScore)}`;
    }
    updateHUD();

    // ─── Elementos destruibles (3 golpes cada uno) ─────────────────────────────
    const destroyable = Array.from(document.querySelectorAll(TARGETS_SEL)).filter((el) => {
      if (el.closest('#dg-hud')) return false;
      const r = el.getBoundingClientRect();
      return r.width > 5 && r.height > 5;
    });
    const hp = new Map(destroyable.map((el) => [el, 3]));

    function explode(cx, cy, col) {
      for (let i = 0; i < 10; i++) {
        const p = document.createElement('div');
        p.className = 'dg-particle';
        const angle = (Math.PI * 2 / 10) * i;
        const dist = 30 + Math.random() * 40;
        p.style.left = cx + 'px';
        p.style.top = cy + 'px';
        p.style.background = col || `hsl(${20 + Math.random() * 40},100%,60%)`;
        document.body.append(p);
        requestAnimationFrame(() => {
          p.style.transition = 'transform 0.55s ease-out, opacity 0.55s ease-out';
          p.style.transform = `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px))`;
          p.style.opacity = '0';
        });
        setTimeout(() => p.remove(), 600);
      }
    }

    function hitElement(el) {
      const current = hp.get(el);
      if (current === undefined || current <= 0) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      explode(cx, cy, '#ff8844');
      el.classList.add('dg-hit');
      setTimeout(() => el.classList.remove('dg-hit'), 260);
      const next = current - 1;
      hp.set(el, next);
      if (next <= 0) {
        score += 10;
        el.classList.add('dg-destroying');
        explode(cx, cy, '#ff4400');
        setTimeout(() => { el.classList.remove('dg-destroying'); el.classList.add('dg-destroyed'); }, 420);
      } else {
        score += 3;
      }
      updateHUD();
    }

    function shoot() {
      if (shootCooldown > 0 || !active) return;
      shootCooldown = 8;
      const b = document.createElement('div');
      b.className = 'dg-bullet';
      b.style.left = pointerX + 'px';
      b.style.top = pointerY + 'px';
      document.body.append(b);
      requestAnimationFrame(() => {
        b.style.transition = 'top 0.35s linear, opacity 0.35s linear';
        b.style.top = (pointerY - 400) + 'px';
        b.style.opacity = '0';
      });
      setTimeout(() => b.remove(), 380);

      ship.style.display = 'none';
      const el = document.elementFromPoint(pointerX, pointerY);
      ship.style.display = '';
      if (!el || el.closest('#dg-hud')) return;
      const target = destroyable.find((d) => d === el || d.contains(el));
      if (target) hitElement(target);
    }

    // ─── Enemigos ──────────────────────────────────────────────────────────────
    function spawnEnemy() {
      if (!active) return;
      const enemy = document.createElement('div');
      enemy.className = 'dg-enemy';
      const fromLeft = Math.random() < 0.5;
      const startY = 60 + Math.random() * (window.innerHeight * 0.7);
      const endX = fromLeft ? window.innerWidth + 30 : -30;
      const duration = 3200 + Math.random() * 1800;
      enemy.style.left = fromLeft ? '-25px' : window.innerWidth + 'px';
      enemy.style.top = startY + 'px';
      document.body.append(enemy);
      requestAnimationFrame(() => {
        enemy.style.transition = `left ${duration}ms linear, top ${duration}ms ease-in-out`;
        enemy.style.left = endX + 'px';
        enemy.style.top = (startY + (Math.random() - 0.5) * 120) + 'px';
      });

      const cleanup = setTimeout(() => {
        if (!enemy.isConnected || !active) return;
        const nearest = destroyable.find((el) => !el.classList.contains('dg-destroyed'));
        if (nearest) hitElement(nearest);
        lives = Math.max(0, lives - 1);
        updateHUD();
        enemy.remove();
        if (lives === 0) gameOver();
      }, duration + 100);

      enemy.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        clearTimeout(cleanup);
        explode(e.clientX, e.clientY, '#ff8800');
        score += 25;
        updateHUD();
        enemy.remove();
      });
      enemy._cleanup = cleanup;
    }

    function scheduleSpawn() {
      enemyTimer = setTimeout(() => {
        spawnEnemy();
        spawnInterval = Math.max(900, spawnInterval - 40);
        if (active) scheduleSpawn();
      }, spawnInterval);
    }
    scheduleSpawn();

    // ─── Fin de partida ────────────────────────────────────────────────────────
    function gameOver() {
      active = false;
      clearTimeout(enemyTimer);
      if (score > highScore) saveBest(score);

      const go = document.createElement('div');
      go.id = 'dg-gameover';
      go.setAttribute('role', 'dialog');
      go.setAttribute('aria-modal', 'true');
      const h = document.createElement('h2');
      h.textContent = t('destroy.over', 'DESTRUCTION COMPLETE');
      const s = document.createElement('p');
      s.textContent = `SCORE: ${score}`;
      const best = document.createElement('p');
      best.className = 'dg-best';
      best.textContent = `${t('destroy.best', 'BEST')}: ${Math.max(score, highScore)}`;
      const again = document.createElement('button');
      again.type = 'button';
      again.textContent = t('destroy.again', 'PLAY AGAIN');
      const exit = document.createElement('button');
      exit.type = 'button';
      exit.className = 'dg-secondary';
      exit.textContent = t('destroy.exit', 'EXIT');
      const actions = document.createElement('div');
      actions.className = 'dg-actions';
      actions.append(again, exit);
      go.append(h, s, best, actions);
      document.body.append(go);
      again.addEventListener('click', () => { exitGame(); initDestroyGame(); });
      exit.addEventListener('click', exitGame);
      again.focus();
    }

    // ─── Salir y restaurar la página ──────────────────────────────────────────
    function exitGame() {
      active = false;
      clearTimeout(enemyTimer);
      cancelAnimationFrame(rafId);
      if (score > highScore) saveBest(score);

      destroyable.forEach((el) => el.classList.remove('dg-hit', 'dg-destroying', 'dg-destroyed'));
      document.querySelectorAll('.dg-enemy').forEach((e) => { clearTimeout(e._cleanup); e.remove(); });
      document.querySelectorAll('.dg-bullet, .dg-particle').forEach((e) => e.remove());
      ['dg-hud', 'dg-ship', 'dg-gameover'].forEach((id) => document.getElementById(id)?.remove());
      document.body.classList.remove('dg-active');

      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('languageLoaded', labelExit);
      session = null;
    }

    // ─── Entrada (ratón, lápiz o dedo) ─────────────────────────────────────────
    function onMove(e) {
      pointerX = e.clientX;
      pointerY = e.clientY;
      ship.style.left = pointerX + 'px';
      ship.style.top = pointerY + 'px';
    }
    function onDown(e) {
      if (e.target.closest('#dg-hud, #dg-gameover')) return;
      if (e.button === 0 || e.pointerType !== 'mouse') { onMove(e); pointerDown = true; }
    }
    function onUp() { pointerDown = false; }
    function onKey(e) { if (e.key === 'Escape') exitGame(); }

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    document.addEventListener('keydown', onKey);
    exitBtn.addEventListener('click', exitGame);

    function loop() {
      if (!active) return;
      if (shootCooldown > 0) shootCooldown--;
      if (pointerDown) shoot();
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);

    session = { exit: exitGame };
  }

  // ─── Activación por URL ────────────────────────────────────────────────────
  const where = `${location.pathname} ${location.search} ${location.hash}`;
  if (/destroy[-_]?game/i.test(where)) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initDestroyGame);
    else initDestroyGame();
  }

  window.activateDestroyGame = initDestroyGame;
})();

// js/destroygame.js
// Activa con: pimpolidev.com/#DestroyGame  o  ?destroygame  o  /DestroyGame
// También: window.activateDestroyGame()

(function () {
  'use strict';

  function initDestroyGame() {
    if (document.getElementById('dg-hud')) return; // ya activo

    // ─── Estado ────────────────────────────────────────────────────────────────
    let score      = 0;
    let lives      = 3;
    let active     = true;
    let shootCooldown = 0;
    let mouseDown  = false;
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    const highScore = parseInt(localStorage.getItem('dg_hs') || '0', 10);

    // ─── Cursor nave ───────────────────────────────────────────────────────────
    const ship = document.createElement('div');
    ship.id = 'dg-ship';
    document.body.appendChild(ship);
    document.body.classList.add('dg-active');

    // ─── HUD ───────────────────────────────────────────────────────────────────
    const hud = document.createElement('div');
    hud.id = 'dg-hud';
    hud.innerHTML = `
      <span id="dg-score-txt">SCORE: 0</span>
      <span id="dg-lives-txt">♥♥♥</span>
      <span id="dg-hs-txt" style="opacity:0.6">BEST: ${highScore}</span>
      <button id="dg-exit-btn">✕ SALIR</button>
    `;
    document.body.appendChild(hud);

    // ─── Elementos destruibles ─────────────────────────────────────────────────
    const TARGETS_SEL = [
      'h1','h2','h3','p',
      '.project-card','.game-card','.about-item',
      '.social-icons a','.nav-link','.logo-text',
      'footer p', '.studio-link'
    ].join(',');

    const destroyable = Array.from(document.querySelectorAll(TARGETS_SEL))
      .filter(el => {
        if (el.closest('#dg-hud') || el.id === 'dg-ship') return false;
        const r = el.getBoundingClientRect();
        return r.width > 5 && r.height > 5;
      });

    // HP por elemento (3 hits para destruir)
    const hp = new Map(destroyable.map(el => [el, 3]));

    // ─── Actualizar HUD ────────────────────────────────────────────────────────
    function updateHUD() {
      document.getElementById('dg-score-txt').textContent = `SCORE: ${score}`;
      document.getElementById('dg-lives-txt').textContent = '♥'.repeat(Math.max(0, lives)) + '♡'.repeat(Math.max(0, 3 - lives));
      const hsEl = document.getElementById('dg-hs-txt');
      if (hsEl) hsEl.textContent = `BEST: ${Math.max(score, highScore)}`;
    }

    // ─── Partículas de explosión ───────────────────────────────────────────────
    function explode(cx, cy, col) {
      for (let i = 0; i < 10; i++) {
        const p = document.createElement('div');
        p.className = 'dg-particle';
        const angle = (Math.PI * 2 / 10) * i;
        const dist  = 30 + Math.random() * 40;
        p.style.cssText = `
          left:${cx}px; top:${cy}px;
          background:${col || `hsl(${20 + Math.random()*40},100%,60%)`};
          --dx:${Math.cos(angle) * dist}px;
          --dy:${Math.sin(angle) * dist}px;
        `;
        document.body.appendChild(p);
        requestAnimationFrame(() => {
          p.classList.add('dg-go');
          p.style.transform = `translate(calc(-50% + ${Math.cos(angle)*dist}px), calc(-50% + ${Math.sin(angle)*dist}px))`;
          p.style.opacity = '0';
          p.style.transition = 'transform 0.55s ease-out, opacity 0.55s ease-out';
        });
        setTimeout(() => p.remove(), 600);
      }
    }

    // ─── Golpear un elemento ───────────────────────────────────────────────────
    function hitElement(el) {
      const current = hp.get(el);
      if (current === undefined || current <= 0) return;

      const rect = el.getBoundingClientRect();
      const cx   = rect.left + rect.width / 2;
      const cy   = rect.top  + rect.height / 2;

      explode(cx, cy, '#ff8844');
      el.classList.add('dg-hit');
      setTimeout(() => el.classList.remove('dg-hit'), 260);

      const newHp = current - 1;
      hp.set(el, newHp);

      if (newHp <= 0) {
        // Destruir
        score += 10;
        updateHUD();
        el.classList.add('dg-destroying');
        explode(cx, cy, '#ff4400');
        setTimeout(() => {
          el.classList.remove('dg-destroying');
          el.classList.add('dg-destroyed');
        }, 420);
      } else {
        score += 3;
        updateHUD();
      }
    }

    // ─── Disparar ─────────────────────────────────────────────────────────────
    function shoot() {
      if (shootCooldown > 0 || !active) return;
      shootCooldown = 8;

      // Bala visual
      const b = document.createElement('div');
      b.className = 'dg-bullet';
      b.style.left = mouseX + 'px';
      b.style.top  = mouseY + 'px';
      document.body.appendChild(b);
      requestAnimationFrame(() => {
        b.style.transition = 'top 0.35s linear, opacity 0.35s linear';
        b.style.top = (mouseY - 400) + 'px';
        b.style.opacity = '0';
      });
      setTimeout(() => b.remove(), 380);

      // Detección de impacto: buscar elemento debajo del cursor
      ship.style.display = 'none';
      const el = document.elementFromPoint(mouseX, mouseY);
      ship.style.display = '';

      if (!el || el.closest('#dg-hud')) return;
      const target = destroyable.find(d => d === el || d.contains(el) || el.closest && el.closest(TARGETS_SEL) === d);
      if (target) hitElement(target);
    }

    // ─── Enemigos (asteroides que dañan la página) ─────────────────────────────
    let enemyTimer = null;
    let spawnInterval = 2200;

    function spawnEnemy() {
      if (!active) return;

      const enemy   = document.createElement('div');
      enemy.className = 'dg-enemy';
      const fromLeft  = Math.random() < 0.5;
      const startY    = 60 + Math.random() * (window.innerHeight * 0.7);
      const endX      = fromLeft ? window.innerWidth + 30 : -30;
      const duration  = 3200 + Math.random() * 1800;

      enemy.style.cssText = `
        left:${fromLeft ? '-25px' : window.innerWidth + 'px'};
        top:${startY}px;
      `;
      document.body.appendChild(enemy);

      // Animación CSS custom property
      requestAnimationFrame(() => {
        enemy.style.transition = `left ${duration}ms linear, top ${duration}ms ease-in-out`;
        enemy.style.left = endX + 'px';
        enemy.style.top  = (startY + (Math.random() - 0.5) * 120) + 'px';
      });

      // Click al enemigo lo destruye
      enemy.addEventListener('click', e => {
        e.stopPropagation();
        explode(e.clientX, e.clientY, '#ff8800');
        score += 25;
        updateHUD();
        enemy.remove();
      });

      // Si llega al otro lado → daña al jugador
      const cleanup = setTimeout(() => {
        if (!enemy.parentNode) return;
        // Busca el elemento de página más cercano y lo daña
        const nearest = destroyable.find(el => !el.classList.contains('dg-destroyed'));
        if (nearest) hitElement(nearest);
        lives = Math.max(0, lives - 1);
        updateHUD();
        enemy.remove();
        if (lives === 0 && active) showGameOver();
      }, duration + 100);

      enemy._cleanup = cleanup;

      // Limpiar si juego terminó
      enemy._remove = () => { clearTimeout(cleanup); enemy.remove(); };
    }

    function startEnemySpawns() {
      enemyTimer = setInterval(() => {
        spawnEnemy();
        // Dificultad incremental
        spawnInterval = Math.max(900, spawnInterval - 40);
        clearInterval(enemyTimer);
        if (active) startEnemySpawns();
      }, spawnInterval);
    }
    startEnemySpawns();

    // ─── Game Over ─────────────────────────────────────────────────────────────
    function showGameOver() {
      active = false;
      clearInterval(enemyTimer);
      const finalScore = score;
      if (score > highScore) localStorage.setItem('dg_hs', score);

      const go = document.createElement('div');
      go.id = 'dg-gameover';
      go.innerHTML = `
        <h2>DESTRUCCIÓN COMPLETADA</h2>
        <p>SCORE: ${finalScore}</p>
        <p style="color:#ffdd44;font-size:1rem;">MEJOR: ${Math.max(finalScore, highScore)}</p>
        <button onclick="document.getElementById('dg-gameover').remove(); window.activateDestroyGame && window.activateDestroyGame()">VOLVER A JUGAR</button>
        <button style="background:transparent;border:1px solid rgba(255,255,255,0.3);margin-left:10px;" id="dg-go-exit">SALIR</button>
      `;
      document.body.appendChild(go);
      document.getElementById('dg-go-exit').addEventListener('click', exitGame);
    }

    // ─── Salir y restaurar la página ──────────────────────────────────────────
    function exitGame() {
      active = false;
      clearInterval(enemyTimer);
      if (score > highScore) localStorage.setItem('dg_hs', score);

      // Restaurar todos los elementos
      destroyable.forEach(el => {
        el.classList.remove('dg-hit','dg-destroying','dg-destroyed');
        el.style.transform = '';
        el.style.opacity   = '';
        el.style.visibility = '';
        el.style.transition = '';
        el.style.pointerEvents = '';
      });

      // Limpiar enemigos
      document.querySelectorAll('.dg-enemy').forEach(e => {
        if (e._cleanup) clearTimeout(e._cleanup);
        e.remove();
      });
      document.querySelectorAll('.dg-bullet,.dg-particle').forEach(e => e.remove());

      ['dg-hud','dg-ship','dg-gameover'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
      });

      document.body.classList.remove('dg-active');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseup',   onMouseUp);
      document.removeEventListener('keydown',   onKey);
    }

    // ─── Eventos de input ─────────────────────────────────────────────────────
    function onMouseMove(e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
      ship.style.left = e.clientX + 'px';
      ship.style.top  = e.clientY + 'px';
    }
    function onMouseDown(e) { if (e.button === 0) mouseDown = true; }
    function onMouseUp(e)   { if (e.button === 0) mouseDown = false; }
    function onKey(e) { if (e.key === 'Escape') exitGame(); }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup',   onMouseUp);
    document.addEventListener('keydown',   onKey);
    document.getElementById('dg-exit-btn').addEventListener('click', exitGame);

    // ─── Loop de disparo automático ───────────────────────────────────────────
    let rafId;
    function gameLoop() {
      if (!active) return;
      if (shootCooldown > 0) shootCooldown--;
      if (mouseDown) shoot();
      rafId = requestAnimationFrame(gameLoop);
    }
    rafId = requestAnimationFrame(gameLoop);
  }

  // ─── Activación por URL ────────────────────────────────────────────────────
  // Accepts: destroygame, destroy-game, destroy_game, dg, DG, etc.
  if (/destroygame|destroy[-_]game|\bdg\b/i.test(window.location.href)) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initDestroyGame);
    } else {
      initDestroyGame();
    }
  }

  window.activateDestroyGame = initDestroyGame;
})();

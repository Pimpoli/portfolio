// js/destroygame.js
// Actívalo visitando la página con "DestroyGame" en la URL:
//   PimpoliDev.com/DestroyGame
//   PimpoliDev.com/#DestroyGame
//   PimpoliDev.com/MultiGameInc/DestroyGame
//   index.html#DestroyGame  (para pruebas locales)
// También se puede activar desde la consola del navegador: window.activateDestroyGame()

(function () {
  'use strict';

  // ─── Detección de URL ───────────────────────────────────────────────────────
  const urlToCheck = window.location.href;
  const shouldActivate = /destroygame/i.test(urlToCheck);

  function initDestroyGame() {
    // Evitar doble instancia
    if (document.getElementById('destroy-game-overlay')) return;

    // ─── Overlay principal ────────────────────────────────────────────────────
    const overlay = document.createElement('div');
    overlay.id = 'destroy-game-overlay';
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:999999',
      'background:#00000f', 'cursor:none', 'overflow:hidden',
      'user-select:none', '-webkit-user-select:none'
    ].join(';');

    const canvas = document.createElement('canvas');
    canvas.id = 'destroy-canvas';
    canvas.style.cssText = 'display:block;width:100%;height:100%;';
    overlay.appendChild(canvas);

    // ─── Botón salir ──────────────────────────────────────────────────────────
    const exitBtn = document.createElement('button');
    exitBtn.textContent = '✕ SALIR';
    exitBtn.style.cssText = [
      'position:absolute', 'top:14px', 'right:14px', 'z-index:10',
      'background:rgba(220,40,40,0.85)', 'color:#fff', 'border:none',
      'padding:7px 16px', 'border-radius:6px', 'cursor:pointer',
      'font:bold 13px monospace', 'letter-spacing:1px',
      'transition:background 0.2s'
    ].join(';');
    exitBtn.addEventListener('mouseenter', () => { exitBtn.style.background = 'rgba(255,60,60,1)'; });
    exitBtn.addEventListener('mouseleave', () => { exitBtn.style.background = 'rgba(220,40,40,0.85)'; });
    overlay.appendChild(exitBtn);

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    const ctx = canvas.getContext('2d');

    // ─── Resize ───────────────────────────────────────────────────────────────
    function resize() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // ─── Estado del juego ────────────────────────────────────────────────────
    let running    = true;
    let gameOver   = false;
    let score      = 0;
    let lives      = 3;
    let wave       = 1;
    let frameCount = 0;
    let highScore  = parseInt(localStorage.getItem('dg_hs') || '0', 10);
    let lastSpawn  = 0;
    let spawnMs    = 1600;

    // ─── Ratón ────────────────────────────────────────────────────────────────
    const mouse = { x: canvas.width / 2, y: canvas.height - 120 };
    overlay.addEventListener('mousemove', e => {
      const r = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) * (canvas.width  / r.width);
      mouse.y = (e.clientY - r.top)  * (canvas.height / r.height);
    });

    // ─── Jugador ─────────────────────────────────────────────────────────────
    const player = {
      x: canvas.width / 2, y: canvas.height - 120,
      w: 32, h: 44,
      invincible: 0,
      shootCd: 0,
    };

    // ─── Arrays de entidades ──────────────────────────────────────────────────
    const bullets   = [];
    const enemies   = [];
    const particles = [];
    const stars     = [];

    // ─── Estrellas de fondo ───────────────────────────────────────────────────
    for (let i = 0; i < 140; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        sz: Math.random() * 1.8 + 0.4,
        sp: Math.random() * 1.4 + 0.2,
        op: Math.random() * 0.6 + 0.3,
      });
    }

    // ─── Input ────────────────────────────────────────────────────────────────
    let mouseDown = false;
    overlay.addEventListener('mousedown',  e => { if (e.button === 0) mouseDown = true;  });
    overlay.addEventListener('mouseup',    e => { if (e.button === 0) mouseDown = false; });
    overlay.addEventListener('mouseleave', () => { mouseDown = false; });

    // ─── Salir ────────────────────────────────────────────────────────────────
    function exit() {
      running = false;
      if (score > highScore) { highScore = score; localStorage.setItem('dg_hs', score); }
      window.removeEventListener('resize', resize);
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      document.body.style.overflow = '';
    }

    exitBtn.addEventListener('click', exit);

    function onKey(e) {
      if (e.key === 'Escape') exit();
      if ((e.key === ' ' || e.key === 'Spacebar') && !gameOver) tryShoot();
    }
    document.addEventListener('keydown', onKey);

    // ─── Disparar ────────────────────────────────────────────────────────────
    function tryShoot() {
      if (player.shootCd > 0) return;
      player.shootCd = 9;
      // Bala central
      bullets.push({ x: player.x, y: player.y - player.h / 2, w: 4, h: 14, sp: 14, col: '#00ffff' });
      // Doble lateral tras 150 pts
      if (score >= 150) {
        bullets.push({ x: player.x - 13, y: player.y - player.h / 4, w: 3, h: 10, sp: 13, col: '#0088ff' });
        bullets.push({ x: player.x + 13, y: player.y - player.h / 4, w: 3, h: 10, sp: 13, col: '#0088ff' });
      }
    }

    // ─── Spawn de enemigos ───────────────────────────────────────────────────
    const ENEMY_TYPES = [
      // scout: rápido, 1 HP, en zigzag
      { key:'scout',  w:22, h:28, hp:1, sp:2.2, col:'#ff3333', pts:10, zigzag:true  },
      // heavy: lento, 3 HP, recto
      { key:'heavy',  w:42, h:46, hp:3, sp:1.1, col:'#ff8800', pts:30, zigzag:false },
      // ninja: muy rápido, 1 HP, diagonal
      { key:'ninja',  w:18, h:22, hp:1, sp:3.5, col:'#cc44ff', pts:20, zigzag:false },
    ];

    function spawnEnemy() {
      const cfg = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
      const margin = cfg.w + 10;
      const x = margin + Math.random() * (canvas.width - margin * 2);
      const spBonus = wave * 0.2;
      // Ninjas vienen en diagonal desde los lados
      const fromSide = cfg.key === 'ninja' && Math.random() < 0.5;
      const ex = fromSide ? (Math.random() < 0.5 ? -cfg.w : canvas.width + cfg.w) : x;
      const ey = fromSide ? Math.random() * canvas.height * 0.4 : -cfg.h;
      const dx = fromSide ? (ex < 0 ? 1 : -1) * (cfg.sp + spBonus) : 0;
      enemies.push({
        x: ex, y: ey,
        w: cfg.w, h: cfg.h,
        hp: cfg.hp, maxHp: cfg.hp,
        sp: cfg.sp + spBonus,
        dx,
        col: cfg.col,
        pts: cfg.pts,
        t: Math.random() * Math.PI * 2,
        zigzag: cfg.zigzag,
        key: cfg.key,
      });
    }

    // ─── Explosión de partículas ──────────────────────────────────────────────
    function explode(x, y, col, n = 14) {
      for (let i = 0; i < n; i++) {
        const ang = (Math.PI * 2 / n) * i + Math.random() * 0.5;
        const spd = Math.random() * 4 + 1;
        particles.push({
          x, y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 1,
          life: 1,
          decay: Math.random() * 0.035 + 0.018,
          col,
          sz: Math.random() * 4 + 1.5,
        });
      }
    }

    // ─── AABB ────────────────────────────────────────────────────────────────
    function hits(a, b) {
      return (
        a.x - a.w / 2 < b.x + b.w / 2 &&
        a.x + a.w / 2 > b.x - b.w / 2 &&
        a.y - a.h / 2 < b.y + b.h / 2 &&
        a.y + a.h / 2 > b.y - b.h / 2
      );
    }

    // ─── Dibujar nave (triángulo estilizado) ──────────────────────────────────
    function drawShip(x, y, w, h, col, flip = false) {
      ctx.save();
      ctx.translate(x, y);
      if (flip) ctx.rotate(Math.PI);
      ctx.shadowBlur  = 12;
      ctx.shadowColor = col;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0,       -h / 2);
      ctx.lineTo(-w / 2,   h / 2);
      ctx.lineTo(-w / 5,   h / 4);
      ctx.lineTo(0,        h / 5);
      ctx.lineTo( w / 5,   h / 4);
      ctx.lineTo( w / 2,   h / 2);
      ctx.closePath();
      ctx.fill();
      // cockpit
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(0, -h / 6, w / 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // ─── HUD ─────────────────────────────────────────────────────────────────
    function drawHUD() {
      ctx.save();
      ctx.font = 'bold 18px monospace';

      // Puntuación
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText(`SCORE: ${score}`, 18, 32);
      ctx.font = '14px monospace';
      ctx.fillStyle = '#aaaaaa';
      ctx.fillText(`WAVE: ${wave}`, 18, 52);

      // High score
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#ffdd44';
      ctx.textAlign = 'right';
      ctx.fillText(`BEST: ${Math.max(score, highScore)}`, canvas.width - 18, 32);

      // Vidas (corazones dibujados)
      ctx.textAlign = 'center';
      const lifeX = canvas.width / 2;
      const lifeSize = 13;
      const total = 3;
      const spacing = 28;
      const startX = lifeX - (total - 1) * spacing / 2;
      for (let i = 0; i < total; i++) {
        ctx.fillStyle = i < lives ? '#ff3355' : '#333344';
        ctx.shadowBlur = i < lives ? 8 : 0;
        ctx.shadowColor = '#ff3355';
        drawHeart(ctx, startX + i * spacing, 26, lifeSize);
        ctx.shadowBlur = 0;
      }

      // Pista de controles (desaparece al 4s)
      if (frameCount < 240) {
        const alpha = Math.max(0, 1 - frameCount / 240);
        ctx.globalAlpha = alpha;
        ctx.font = '13px monospace';
        ctx.fillStyle = '#888888';
        ctx.textAlign = 'center';
        ctx.fillText('CLICK / ESPACIO para disparar  •  ESC para salir', canvas.width / 2, canvas.height - 18);
        ctx.globalAlpha = 1;
      }

      ctx.restore();
    }

    function drawHeart(c, x, y, r) {
      c.save();
      c.translate(x, y);
      c.beginPath();
      c.moveTo(0, r * 0.3);
      c.bezierCurveTo(-r * 0.1, -r * 0.4,  -r, -r * 0.4, -r,  r * 0.1);
      c.bezierCurveTo(-r,  r * 0.7,  0,  r * 1.1,  0, r * 1.4);
      c.bezierCurveTo( 0,  r * 1.1,  r,  r * 0.7,  r,  r * 0.1);
      c.bezierCurveTo( r, -r * 0.4,  r * 0.1, -r * 0.4, 0, r * 0.3);
      c.closePath();
      c.fill();
      c.restore();
    }

    // ─── Pantalla GAME OVER ───────────────────────────────────────────────────
    function drawGameOver() {
      // Fondo semitransparente
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      ctx.textAlign = 'center';
      ctx.shadowBlur  = 30;
      ctx.shadowColor = '#ff2222';
      ctx.fillStyle   = '#ff3333';
      ctx.font        = `bold ${Math.min(64, canvas.width * 0.1)}px monospace`;
      ctx.fillText('GAME OVER', cx, cy - 60);

      ctx.shadowBlur  = 10;
      ctx.shadowColor = '#ffffff';
      ctx.fillStyle   = '#ffffff';
      ctx.font        = `bold ${Math.min(28, canvas.width * 0.045)}px monospace`;
      ctx.fillText(`SCORE: ${score}`, cx, cy);

      ctx.fillStyle = '#ffdd44';
      ctx.font      = `${Math.min(22, canvas.width * 0.035)}px monospace`;
      ctx.fillText(`MEJOR: ${highScore}`, cx, cy + 38);

      ctx.shadowBlur  = 0;
      ctx.fillStyle   = '#888888';
      ctx.font        = '15px monospace';
      ctx.fillText('Pulsa ESC para salir', cx, cy + 84);
    }

    // ─── Cursor personalizado (nave pequeña) ──────────────────────────────────
    function drawCursor() {
      ctx.save();
      ctx.globalAlpha = 0.5;
      drawShip(mouse.x, mouse.y, 14, 18, '#ffffff');
      ctx.restore();
    }

    // ─── Loop principal ───────────────────────────────────────────────────────
    let lastTs = 0;

    function loop(ts) {
      if (!running) return;

      lastTs = ts;
      frameCount++;

      // ─ Fondo
      ctx.fillStyle = '#00000f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // ─ Estrellas
      ctx.globalAlpha = 1;
      for (const s of stars) {
        s.y += s.sp;
        if (s.y > canvas.height) { s.y = 0; s.x = Math.random() * canvas.width; }
        ctx.globalAlpha = s.op;
        ctx.fillStyle   = '#ffffff';
        ctx.fillRect(s.x, s.y, s.sz, s.sz);
      }
      ctx.globalAlpha = 1;

      if (!gameOver) {
        // ─ Mover jugador hacia el ratón (suave)
        player.x += (mouse.x - player.x) * 0.14;
        player.y += (mouse.y - player.y) * 0.14;
        player.x = Math.max(player.w / 2, Math.min(canvas.width  - player.w / 2, player.x));
        player.y = Math.max(player.h / 2, Math.min(canvas.height - player.h / 2, player.y));

        if (player.invincible > 0) player.invincible--;
        if (player.shootCd   > 0) player.shootCd--;
        if (mouseDown) tryShoot();

        // ─ Spawn
        if (ts - lastSpawn > spawnMs) {
          spawnEnemy();
          lastSpawn = ts;
          spawnMs = Math.max(500, 1600 - wave * 70);
          if (frameCount % 3 === 0 && wave > 2) spawnEnemy(); // doble spawn en waves altas
        }

        // ─ Progresión de wave
        if (score >= wave * 120) wave++;

        // ─ Actualizar balas
        for (let i = bullets.length - 1; i >= 0; i--) {
          bullets[i].y -= bullets[i].sp;
          if (bullets[i].y < -20) { bullets.splice(i, 1); }
        }

        // ─ Actualizar enemigos
        for (let i = enemies.length - 1; i >= 0; i--) {
          const e = enemies[i];
          e.y += e.sp;
          e.t += 0.05;
          if (e.zigzag) e.x += Math.sin(e.t * 3) * 2.5;
          if (e.dx)     e.x += e.dx;
          e.x = Math.max(e.w / 2, Math.min(canvas.width - e.w / 2, e.x));

          // Salió por abajo → pierde vida
          if (e.y > canvas.height + e.h + 5) {
            enemies.splice(i, 1);
            if (player.invincible === 0) {
              lives--;
              player.invincible = 110;
              explode(player.x, player.y, '#ff3333', 18);
              if (lives <= 0) {
                gameOver = true;
                if (score > highScore) { highScore = score; localStorage.setItem('dg_hs', score); }
              }
            }
            continue;
          }

          // Colisión con jugador
          if (player.invincible === 0 && hits(player, e)) {
            enemies.splice(i, 1);
            lives--;
            player.invincible = 110;
            explode(player.x, player.y, '#ff3333', 18);
            if (lives <= 0) {
              gameOver = true;
              if (score > highScore) { highScore = score; localStorage.setItem('dg_hs', score); }
            }
            continue;
          }

          // Colisión con balas
          let killed = false;
          for (let j = bullets.length - 1; j >= 0; j--) {
            if (hits(bullets[j], e)) {
              bullets.splice(j, 1);
              e.hp--;
              if (e.hp <= 0) {
                score += e.pts;
                explode(e.x, e.y, e.col, 14);
                enemies.splice(i, 1);
                killed = true;
                break;
              }
              explode(e.x, e.y, '#ffffff', 4);
              break;
            }
          }
          if (killed) continue;
        }

        // ─ Actualizar partículas
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx; p.y += p.vy; p.vy += 0.06;
          p.life -= p.decay;
          if (p.life <= 0) particles.splice(i, 1);
        }

        // ─ Dibujar partículas
        for (const p of particles) {
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.fillStyle   = p.col;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.sz, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        // ─ Dibujar balas
        ctx.shadowBlur  = 8;
        for (const b of bullets) {
          ctx.fillStyle   = b.col;
          ctx.shadowColor = b.col;
          ctx.fillRect(b.x - b.w / 2, b.y, b.w, b.h);
        }
        ctx.shadowBlur = 0;

        // ─ Dibujar enemigos
        for (const e of enemies) {
          if (e.maxHp > 1) {
            // barra de vida
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.fillRect(e.x - e.w / 2, e.y - e.h / 2 - 9, e.w, 4);
            ctx.fillStyle = e.col;
            ctx.fillRect(e.x - e.w / 2, e.y - e.h / 2 - 9, e.w * (e.hp / e.maxHp), 4);
          }
          drawShip(e.x, e.y, e.w, e.h, e.col, true);
        }

        // ─ Dibujar jugador (parpadea si es invencible)
        if (player.invincible === 0 || Math.floor(player.invincible / 7) % 2 === 0) {
          drawShip(player.x, player.y, player.w, player.h, '#00ffff');
        }

        // ─ Cursor
        drawCursor();

        // ─ HUD
        drawHUD();

      } else {
        // Partículas aún se animan en game over
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx; p.y += p.vy; p.vy += 0.06;
          p.life -= p.decay;
          if (p.life <= 0) particles.splice(i, 1);
        }
        for (const p of particles) {
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.fillStyle   = p.col;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.sz, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        drawGameOver();
        drawCursor();
      }

      requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);
  }

  // ─── Activar si la URL contiene "destroygame" ─────────────────────────────
  if (shouldActivate) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initDestroyGame);
    } else {
      initDestroyGame();
    }
  }

  // Exposición manual para activación desde consola
  window.activateDestroyGame = initDestroyGame;

})();

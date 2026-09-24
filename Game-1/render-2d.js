// Color Block — renderizador 2D de reserva (canvas 2D) para navegadores sin WebGL 2.
// Mismo estado y mismas reglas; dibuja el tablero con un falso relieve sencillo.
import { COLORS, FLOOR_TOP, FRAME_BOTTOM, FRAME_TOP, drawPickupIcon } from './shared.js';

function rr(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

export function create2DRenderer(canvas, S, opts) {
  const ctx = canvas.getContext('2d');
  let reduced = !!opts.reduced;
  let vw = 1, vh = 1, dpr = 1, scale = 1, ox = 0, oy = 0;
  let sq = 0, sqV = 0;
  const dying = []; // plataformas que caen y se desvanecen

  const VIEW_TOP = FLOOR_TOP - FRAME_TOP;          // y (2D) del borde superior a encuadrar
  const VIEW_H = FRAME_TOP - FRAME_BOTTOM + 14;    // alto a encuadrar (con el lateral de los bloques)

  function resize(w, h, safe) {
    vw = Math.max(1, w); vh = Math.max(1, h);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    const mx = safe.w > 800 ? 0.86 : 0.96;
    scale = Math.min(safe.w * mx / S.W, safe.h * 0.94 / VIEW_H, 1.8);
    ox = safe.x + (safe.w - S.W * scale) / 2;
    oy = safe.y + (safe.h - VIEW_H * scale) / 2 - VIEW_TOP * scale;
  }

  function event(type, data) {
    if (type === 'jump' && !reduced) { sq = 0.18; sqV = 0; }
    if (type === 'land' && !reduced) { sq = -0.22; sqV = 0; }
    if (type === 'dead') dying.push({ x: data.x, y: data.y, w: data.w, h: data.h, colorIdx: data.colorIdx, t: 0 });
    if (type === 'reset') { dying.length = 0; sq = 0; sqV = 0; }
  }

  function drawBlock(x, y, w, h, c, alpha) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = c.side;
    rr(ctx, x, y + 5, w, h + 9, 6); ctx.fill();
    ctx.fillStyle = c.hex;
    rr(ctx, x, y, w, h, 6); ctx.fill();
    ctx.globalAlpha = 1;
  }

  function render(now, dt) {
    const dts = Math.min(dt, 50) / 1000;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);

    const active = S.roundActive && S.started && !S.gameOver;
    const result = S.started && !S.roundActive && !S.gameOver && S.lastResult;
    const target = S.targetColorIdx;

    // Plataformas
    for (const p of S.platforms) {
      if (p.dead) continue;
      const col = COLORS[p.colorIdx];
      const isTarget = p.colorIdx === target;
      if (p.warningTimer > 0) {
        const progress = 1 - p.warningTimer / 2200;
        const osc = Math.sin(progress * Math.PI * 9);
        const s = reduced ? 1 : 1 + 0.15 * osc;
        const a = reduced ? 0.85 : 0.55 + 0.45 * Math.abs(osc);
        ctx.save();
        ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
        ctx.scale(s, s);
        ctx.shadowBlur = 22; ctx.shadowColor = '#ff4400';
        ctx.fillStyle = `rgba(255,90,20,${a})`;
        rr(ctx, -p.w / 2, -p.h / 2, p.w, p.h, 6); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('!', 0, 1);
        ctx.restore();
        continue;
      }
      const alpha = result && !isTarget ? 0.3 : 1;
      if ((active || result) && isTarget) {
        ctx.save();
        ctx.shadowBlur = 22; ctx.shadowColor = col.hex;
        drawBlock(p.x, p.y, p.w, p.h, col, 1);
        ctx.restore();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.globalAlpha = reduced ? 0.8 : 0.5 + 0.5 * Math.sin(now / 150);
        rr(ctx, p.x, p.y, p.w, p.h, 6); ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        drawBlock(p.x, p.y, p.w, p.h, col, alpha);
      }
    }

    // Plataformas eliminadas: caen y se desvanecen
    for (let i = dying.length - 1; i >= 0; i--) {
      const d = dying[i];
      d.t += dts / (reduced ? 0.4 : 0.8);
      if (d.t >= 1) { dying.splice(i, 1); continue; }
      const fall = reduced ? 0 : 160 * d.t * d.t;
      drawBlock(d.x, d.y + fall, d.w, d.h, COLORS[d.colorIdx], 1 - d.t);
    }

    // Objetos
    for (const pk of S.pickups) {
      const bob = reduced ? 0 : Math.sin(now / 400 + pk.x / 30) * 5;
      ctx.save();
      ctx.shadowBlur = 16; ctx.shadowColor = pk.glow;
      ctx.fillStyle = pk.color;
      rr(ctx, pk.x - 14, pk.y + bob - 14, 28, 28, 8); ctx.fill();
      ctx.restore();
      drawPickupIcon(ctx, pk.id, pk.x, pk.y + bob, 18);
    }

    // Jugador
    const pl = S.player;
    if (!reduced) {
      sqV += (-520 * sq - 26 * sqV) * dts;
      sq = Math.max(-0.4, Math.min(0.4, sq + sqV * dts));
    } else { sq = 0; sqV = 0; }
    const pw = pl.w * (1 - sq * 0.5), ph = pl.h * (1 + sq);
    const px = pl.x + pl.w / 2 - pw / 2, py = pl.y + pl.h - ph;
    if (S.shieldActive) {
      ctx.save();
      ctx.globalAlpha = reduced ? 0.8 : 0.65 + 0.35 * Math.sin(now / 180);
      ctx.shadowBlur = 24; ctx.shadowColor = '#f1c40f';
      ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(pl.x + pl.w / 2, pl.y + pl.h / 2, pl.w * 0.95, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.shadowBlur = 18; ctx.shadowColor = 'rgba(174,224,255,0.9)';
    const grd = ctx.createLinearGradient(0, py, 0, py + ph);
    grd.addColorStop(0, '#ffffff'); grd.addColorStop(1, '#cfeaff');
    ctx.fillStyle = grd;
    rr(ctx, px, py, pw, ph, 7); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#14131c';
    const look = Math.max(-1, Math.min(1, pl.vx / 4.5)) * 1.5;
    rr(ctx, px + pw * 0.24 + look, py + ph * 0.24, 4.5, 7, 1.5); ctx.fill();
    rr(ctx, px + pw * 0.76 - 4.5 + look, py + ph * 0.24, 4.5, 7, 1.5); ctx.fill();
  }

  return {
    kind: '2d',
    resize,
    render,
    event,
    busy: () => dying.length > 0 || Math.abs(sq) > 0.002 || Math.abs(sqV) > 0.02,
    setReducedMotion(v) { reduced = !!v; },
  };
}

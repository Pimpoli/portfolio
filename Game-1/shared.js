// Color Block 3D — datos compartidos por la lógica y los dos renderizadores (3D y 2D).

// Colores de las plataformas: principal (cara superior), lateral (cara oscura)
// y una versión clara para texto sobre fondo oscuro.
export const COLORS = [
  { name: 'ROJO',     hex: '#e74c3c', side: '#8e2a20', text: '#ff7b6e' },
  { name: 'AZUL',     hex: '#3498db', side: '#1f5f8a', text: '#5dade2' },
  { name: 'VERDE',    hex: '#2ecc71', side: '#1b7d44', text: '#58d68d' },
  { name: 'AMARILLO', hex: '#f1c40f', side: '#9a7c08', text: '#f7dc6f' },
  { name: 'MORADO',   hex: '#9b59b6', side: '#5e3570', text: '#c39bd3' },
  { name: 'NARANJA',  hex: '#e67e22', side: '#8f4d12', text: '#f0a35e' },
];

// Objetos que caen de vez en cuando
export const PICKUP_TYPES = [
  { id: 'heart',  color: '#e74c3c', glow: '#ff6b6b', label: '+1 VIDA'   },
  { id: 'heal',   color: '#2ecc71', glow: '#58d68d', label: 'CURACIÓN'  },
  { id: 'slow',   color: '#3498db', glow: '#5dade2', label: 'TIEMPO +'  },
  { id: 'shield', color: '#f1c40f', glow: '#f7dc6f', label: 'ESCUDO'    },
  { id: 'double', color: '#e67e22', glow: '#f0a35e', label: '×2 PUNTOS' },
];

// Mundo lógico (en "píxeles de juego", como el juego 2D original).
// El ancho W se adapta a la pantalla; el alto es fijo porque las filas
// están ancladas abajo: suelo en H-60, fila media en H-160, fila alta en H-260.
export const WORLD_H   = 480;
export const FLOOR_TOP = WORLD_H - 60;   // y (2D) de la cara superior del suelo
// Zona que siempre debe verse (alturas sobre el suelo): de la base del suelo
// a un poco por encima del jugador de pie en la fila alta.
export const FRAME_BOTTOM = -34;
export const FRAME_TOP    = 200 + 42 + 36;

// Dibuja el icono de un objeto (en blanco) centrado en (cx, cy) dentro de un cuadrado de lado s.
export function drawPickupIcon(ctx, id, cx, cy, s) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const u = s / 24; // el icono se diseña en una rejilla de 24×24
  ctx.scale(u, u);
  ctx.translate(-12, -12);
  switch (id) {
    case 'heart':
      ctx.beginPath();
      ctx.moveTo(12, 21);
      ctx.bezierCurveTo(12, 21, 5, 16.5, 2.5, 12);
      ctx.bezierCurveTo(0.6, 8.6, 3, 4.4, 7.2, 4.6);
      ctx.bezierCurveTo(9.4, 4.7, 11, 5.9, 12, 7.4);
      ctx.bezierCurveTo(13, 5.9, 14.6, 4.7, 16.8, 4.6);
      ctx.bezierCurveTo(21, 4.4, 23.4, 8.6, 21.5, 12);
      ctx.bezierCurveTo(19, 16.5, 12, 21, 12, 21);
      ctx.fill();
      break;
    case 'heal':
      ctx.beginPath();
      if (ctx.roundRect) { ctx.roundRect(9, 3, 6, 18, 1.5); ctx.roundRect(3, 9, 18, 6, 1.5); }
      else { ctx.rect(9, 3, 6, 18); ctx.rect(3, 9, 18, 6); }
      ctx.fill();
      break;
    case 'slow':
      ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.arc(12, 13, 8, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(12, 13); ctx.lineTo(12, 8.5); ctx.moveTo(12, 13); ctx.lineTo(15.2, 15); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(9.5, 2.6); ctx.lineTo(14.5, 2.6); ctx.stroke();
      break;
    case 'shield':
      ctx.beginPath();
      ctx.moveTo(12, 2.5);
      ctx.lineTo(20, 5.5);
      ctx.bezierCurveTo(20, 13, 17, 18.5, 12, 21.5);
      ctx.bezierCurveTo(7, 18.5, 4, 13, 4, 5.5);
      ctx.closePath();
      ctx.fill();
      break;
    case 'double':
      ctx.font = '800 13px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('×2', 12, 12.8);
      break;
  }
  ctx.restore();
}

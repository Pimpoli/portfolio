// Color Block 3D — renderizador con three.js.
// Dibuja el estado del juego (mundo 2D en "píxeles de juego") como escena 3D:
//   x → X (centrado), altura sobre el suelo → Y, y cada altura se aleja un poco
//   en Z (las filas altas quedan más al fondo), de modo que el tablero se lee en 3D.
// No toca la física: solo lee el estado S y reacciona a eventos (saltos, rondas...).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COLORS, PICKUP_TYPES, FLOOR_TOP, FRAME_BOTTOM, FRAME_TOP, drawPickupIcon } from './shared.js';

const K_DEPTH  = 0.45;                 // unidades de fondo por unidad de altura
const BLOCK_D  = 84;                   // fondo de las plataformas
const GROUND_Y = -120;                 // suelo con la rejilla (bajo los bloques)
const PITCH    = 24 * Math.PI / 180;   // la cámara mira hacia abajo ~24°
const FOV      = 40;
const P_W = 34, P_H = 40, P_D = 32;    // cubo del jugador (la caja de colisión sigue siendo 28×42)
const MAX_PARTICLES = 96;

const zAt = (h) => -K_DEPTH * Math.max(-60, Math.min(240, h));

export function create3DRenderer(canvas, S, opts) {
  // Lanza una excepción si no hay WebGL 2: game.js la captura y usa el modo 2D
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;   // sombras difuminadas (como las del diseño)

  let reduced = !!opts.reduced;
  const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 20, 12000);
  const camBase = new THREE.Vector3();
  const camTarget = new THREE.Vector3();

  // ─── Luces ────────────────────────────────────────────────────────────────
  const hemi = new THREE.HemisphereLight(0xd9d2ff, 0x3a2a78, 1.25);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.3);
  sun.position.set(-240, 720, 420);
  sun.target.position.set(0, 40, -45);
  sun.castShadow = true;
  const smSize = coarse ? 1024 : 2048;
  sun.shadow.mapSize.set(smSize, smSize);
  sun.shadow.bias = -0.0005;
  sun.shadow.radius = 7;
  sun.shadow.blurSamples = 12;
  sun.shadow.camera.near = 100;
  sun.shadow.camera.far = 2200;
  scene.add(sun, sun.target);

  // ─── Suelo: rejilla violeta que se desvanece + sombras suaves ─────────────
  const gridMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uColor: { value: new THREE.Color('#7c4dff') },
      uCell: { value: 64 },
      uFade: { value: 2000 },
      uCenter: { value: new THREE.Vector2(0, -40) },
    },
    vertexShader: /* glsl */`
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      uniform float uCell;
      uniform float uFade;
      uniform vec2 uCenter;
      varying vec3 vW;
      void main() {
        vec2 c = vW.xz / uCell;
        vec2 fw = max(fwidth(c), vec2(1e-4));
        vec2 g = abs(fract(c - 0.5) - 0.5) / fw;
        float line = 1.0 - min(min(g.x, g.y), 1.0);
        float dens = clamp(1.4 - max(fw.x, fw.y) * 2.0, 0.0, 1.0);   // evita moiré a lo lejos
        float d = length(vW.xz - uCenter);
        float fade = 1.0 - smoothstep(uFade * 0.15, uFade, d);
        float glow = exp(-d * d / (820.0 * 820.0));
        float a = (line * 0.3 * dens + glow * 0.1) * fade;
        gl_FragColor = vec4(uColor * (0.75 + line * 0.9), a);
        #include <colorspace_fragment>
      }`,
  });
  const groundGeo = new THREE.PlaneGeometry(9000, 9000);
  const grid = new THREE.Mesh(groundGeo, gridMat);
  grid.rotation.x = -Math.PI / 2;
  grid.position.y = GROUND_Y;
  grid.renderOrder = -10;
  scene.add(grid);

  const shadowCatcher = new THREE.Mesh(groundGeo, new THREE.ShadowMaterial({ color: 0x04020c, opacity: 0.55, depthWrite: false }));
  shadowCatcher.rotation.x = -Math.PI / 2;
  shadowCatcher.position.y = GROUND_Y + 0.5;
  shadowCatcher.receiveShadow = true;
  shadowCatcher.renderOrder = -9;
  scene.add(shadowCatcher);

  // ─── Texturas pequeñas generadas (halo radial, aviso "!", iconos) ─────────
  function canvasTex(size, draw) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    draw(c.getContext('2d'), size);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const haloTex = canvasTex(128, (g, s) => {
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgba(255,255,255,0.95)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
  });
  const warnTex = canvasTex(64, (g, s) => {
    g.fillStyle = '#ff5a1f';
    g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 2, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff';
    g.fillRect(s / 2 - 4, 13, 8, 24);
    g.beginPath(); g.arc(s / 2, 46, 5, 0, Math.PI * 2); g.fill();
  });

  const world = new THREE.Group();
  scene.add(world);

  // ─── Plataformas: 19 huecos fijos (fila, columna) reutilizados siempre ────
  const colorObjs = COLORS.map((c) => ({ main: new THREE.Color(c.hex), side: new THREE.Color(c.side) }));
  const ORANGE = new THREE.Color('#ff5a00');
  const ORANGE_SIDE = new THREE.Color('#8a2e05');
  const hullMats = COLORS.map((c) => new THREE.MeshBasicMaterial({
    color: new THREE.Color(c.hex).lerp(new THREE.Color('#ffffff'), 0.62),
    side: THREE.BackSide, transparent: true, opacity: 0.9, depthWrite: false,
  }));
  const haloMats = COLORS.map((c) => new THREE.SpriteMaterial({
    map: haloTex, color: c.hex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.8,
  }));
  const warnMat = new THREE.SpriteMaterial({ map: warnTex, transparent: true, depthWrite: false });

  const rowGeo = [null, null, null], hullGeo = [null, null, null], rowW = [0, 0, 0], rowH = [0, 0, 0];
  function ensureRowGeometry(row, w, h) {
    if (rowW[row] === w && rowH[row] === h) return;
    if (rowGeo[row]) { rowGeo[row].dispose(); hullGeo[row].dispose(); }
    const r = Math.min(7, h * 0.36);
    rowGeo[row] = sideTopGroups(new RoundedBoxGeometry(w, h, BLOCK_D, 3, r));
    hullGeo[row] = new RoundedBoxGeometry(w + 6, h + 6, BLOCK_D + 6, 2, r + 3);
    rowW[row] = w; rowH[row] = h;
    for (const s of slots) if (s.row === row) { s.mesh.geometry = rowGeo[row]; s.hull.geometry = hullGeo[row]; }
  }

  // Agrupa las 6 caras de la caja en 3 tramos (laterales | arriba | resto) para usar
  // solo 2 materiales y 3 llamadas de dibujo por bloque en vez de 6.
  function sideTopGroups(geo) {
    const face = geo.attributes.position.count / 6;   // orden de BoxGeometry: +x, -x, +y, -y, +z, -z
    geo.clearGroups();
    geo.addGroup(0, face * 2, 0);
    geo.addGroup(face * 2, face, 1);
    geo.addGroup(face * 3, face * 3, 0);
    return geo;
  }

  const slots = [];
  const slotIndex = new Map();
  const placeholder = new THREE.BoxGeometry(1, 1, 1);
  function makeSlot(row, col, colorIdx) {
    const top = new THREE.MeshStandardMaterial({
      color: colorObjs[colorIdx].main, roughness: 0.42, metalness: 0,
      emissive: colorObjs[colorIdx].main, emissiveIntensity: 0, transparent: true,
    });
    const side = new THREE.MeshStandardMaterial({
      color: colorObjs[colorIdx].side, roughness: 0.62, metalness: 0,
      emissive: colorObjs[colorIdx].main, emissiveIntensity: 0, transparent: true,
    });
    const mesh = new THREE.Mesh(rowGeo[row] || placeholder, [side, top]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const hull = new THREE.Mesh(hullGeo[row] || placeholder, hullMats[colorIdx]);
    hull.visible = false;
    mesh.add(hull);
    const halo = new THREE.Sprite(haloMats[colorIdx]);
    halo.visible = false;
    world.add(halo);
    const warn = new THREE.Sprite(warnMat);
    warn.visible = false;
    warn.scale.set(26, 26, 1);
    world.add(warn);
    world.add(mesh);
    const s = {
      row, col, colorIdx, mesh, top, side, hull, halo, warn,
      obj: null, state: 'alive', t: 0, pop: 1, dim: 0, spin: 0, warning: false,
    };
    slots.push(s);
    slotIndex.set(row * 10 + col, s);
    return s;
  }
  function slotFor(p) { return slotIndex.get(p.row * 10 + p.col) || makeSlot(p.row, p.col, p.colorIdx); }

  // ─── Jugador: cubo de hielo con ojos, brillo y aplastamiento ──────────────
  const pGeo = new RoundedBoxGeometry(P_W, P_H, P_D, 3, 7);
  pGeo.translate(0, P_H / 2, 0);
  {
    const pos = pGeo.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const cTop = new THREE.Color('#ffffff'), cBot = new THREE.Color('#cfeaff'), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      tmp.copy(cBot).lerp(cTop, Math.max(0, Math.min(1, pos.getY(i) / P_H)));
      cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
    }
    pGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  }
  const pMat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.32, metalness: 0, emissive: new THREE.Color('#bfe4ff'), emissiveIntensity: 0.22,
  });
  // El jugador se dibuja siempre encima: al saltar a través de una plataforma
  // (plataformas de un solo sentido, como en 2D) no debe quedar oculto dentro del bloque.
  // Es un cubo convexo con caras traseras descartadas, así que no necesita prueba de profundidad.
  pMat.transparent = true;
  pMat.depthTest = false;
  const pBody = new THREE.Mesh(pGeo, pMat);
  pBody.castShadow = true;
  pBody.renderOrder = 20;
  const eyeGeo = new RoundedBoxGeometry(4.8, 7.6, 2, 1, 1.2);
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#14131c', transparent: true, depthTest: false });
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-6.6, 26, P_D / 2 + 0.4);
  eyeR.position.set(6.6, 26, P_D / 2 + 0.4);
  eyeL.renderOrder = eyeR.renderOrder = 21;
  const pSquash = new THREE.Group();
  pSquash.add(pBody, eyeL, eyeR);
  const pHalo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: haloTex, color: '#aee0ff', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.55,
  }));
  pHalo.scale.set(118, 118, 1);
  pHalo.position.set(0, 20, -P_D / 2 - 6);
  const shield = new THREE.Mesh(
    new THREE.IcosahedronGeometry(36, 1),
    new THREE.MeshBasicMaterial({ color: '#f1c40f', wireframe: true, transparent: true, opacity: 0.6, depthWrite: false }),
  );
  shield.position.y = 21;
  shield.visible = false;
  const pRoot = new THREE.Group();
  pRoot.add(pHalo, pSquash, shield);
  world.add(pRoot);

  // ─── Objetos que caen (pool) ──────────────────────────────────────────────
  const pkGeo = new RoundedBoxGeometry(26, 26, 26, 3, 6);
  const pkMats = {}, pkHaloMats = {};
  for (const t of PICKUP_TYPES) {
    const tex = canvasTex(128, (g, s) => {
      g.fillStyle = t.color;
      g.fillRect(0, 0, s, s);
      drawPickupIcon(g, t.id, s / 2, s / 2, s * 0.6);
    });
    pkMats[t.id] = new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.4, metalness: 0, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35,
    });
    pkHaloMats[t.id] = new THREE.SpriteMaterial({
      map: haloTex, color: t.glow, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.7,
    });
  }
  const pkPool = [];
  const pkLive = new Map();
  const seen = new Set();
  function takePickupMesh(pk) {
    let e = pkPool.pop();
    if (!e) {
      const mesh = new THREE.Mesh(pkGeo, pkMats[pk.id]);
      mesh.castShadow = true;
      const halo = new THREE.Sprite(pkHaloMats[pk.id]);
      halo.scale.set(80, 80, 1);
      halo.position.z = -16;
      const root = new THREE.Group();
      root.add(halo, mesh);
      e = { root, mesh, halo };
    }
    e.mesh.material = pkMats[pk.id];
    e.halo.material = pkHaloMats[pk.id];
    world.add(e.root);
    return e;
  }

  // ─── Partículas (una sola InstancedMesh) ──────────────────────────────────
  const partMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(6, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
    MAX_PARTICLES,
  );
  partMesh.frustumCulled = false;
  partMesh.visible = false;
  const parts = Array.from({ length: MAX_PARTICLES }, () => ({
    life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, s: 1,
  }));
  const dummy = new THREE.Object3D();
  const tmpColor = new THREE.Color();
  for (let i = 0; i < MAX_PARTICLES; i++) {
    dummy.scale.setScalar(0); dummy.updateMatrix();
    partMesh.setMatrixAt(i, dummy.matrix);
    partMesh.setColorAt(i, tmpColor.set(0xffffff));
  }
  world.add(partMesh);
  let partActive = 0;

  function burst(x, y, z, color, count, speed = 1) {
    const n = Math.max(reduced ? 0 : 1, Math.round(count * (reduced ? 0.3 : 1)));
    const sp = speed * (reduced ? 0.45 : 1);
    tmpColor.set(color);
    let made = 0;
    for (let i = 0; i < MAX_PARTICLES && made < n; i++) {
      const p = parts[i];
      if (p.life > 0) continue;
      const a = Math.random() * Math.PI * 2;
      const v = (140 + Math.random() * 220) * sp;
      p.x = x; p.y = y; p.z = z;
      p.vx = Math.cos(a) * v;
      p.vy = (180 + Math.random() * 260) * sp;
      p.vz = Math.sin(a) * v * 0.6;
      p.max = p.life = 0.55 + Math.random() * 0.45;
      p.s = 0.6 + Math.random() * 0.8;
      p.rx = Math.random() * 6; p.ry = Math.random() * 6;
      partMesh.setColorAt(i, tmpColor);
      made++;
    }
    if (made) { partActive += made; partMesh.visible = true; partMesh.instanceColor.needsUpdate = true; }
  }

  function updateParticles(dts) {
    if (!partActive) return;
    partActive = 0;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = parts[i];
      if (p.life <= 0) continue;
      p.life -= dts;
      if (p.life <= 0) {
        dummy.scale.setScalar(0);
      } else {
        partActive++;
        p.vy -= 900 * dts;
        p.x += p.vx * dts; p.y += p.vy * dts; p.z += p.vz * dts;
        p.rx += dts * 7; p.ry += dts * 5;
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(p.rx, p.ry, 0);
        dummy.scale.setScalar(p.s * (p.life / p.max));
      }
      dummy.updateMatrix();
      partMesh.setMatrixAt(i, dummy.matrix);
    }
    partMesh.instanceMatrix.needsUpdate = true;
    if (!partActive) partMesh.visible = false;
  }

  // ─── Estado visual ────────────────────────────────────────────────────────
  let sq = 0, sqV = 0;             // aplastamiento/estiramiento del jugador
  let shakeT = 0;                  // temblor de cámara
  let hurtT = 0;                   // destello rojo del jugador
  let blinkIn = 2.5, blinkT = 0;   // parpadeo
  let W = S.W;
  let view = { vw: 1, vh: 1, safe: { x: 0, y: 0, w: 1, h: 1 } };
  let quality = 1, slowFrames = 0, frameAvg = 16.7;

  const toX = (x) => x - W / 2;

  function playerWorldPos(out) {
    const pl = S.player;
    const h = FLOOR_TOP - (pl.y + pl.h);
    return out.set(toX(pl.x + pl.w / 2), h, zAt(h));
  }
  const tmpV = new THREE.Vector3();

  function event(type, data) {
    switch (type) {
      case 'jump':
        if (!reduced) { sq = 0.2; sqV = 0; }
        break;
      case 'land':
        if (!reduced) { sq = -0.26 * Math.min(1, Math.max(0.35, (data || 0) / 13)); sqV = 0; }
        break;
      case 'drop':
        if (!reduced) { sq = -0.12; sqV = 0; }
        break;
      case 'win':
        playerWorldPos(tmpV);
        burst(tmpV.x, tmpV.y + 24, tmpV.z, COLORS[S.targetColorIdx].hex, 16, 1);
        break;
      case 'shield':
        playerWorldPos(tmpV);
        burst(tmpV.x, tmpV.y + 24, tmpV.z, '#f1c40f', 12, 0.9);
        break;
      case 'hurt':
        hurtT = 0.45;
        if (!reduced) shakeT = 0.32;
        playerWorldPos(tmpV);
        burst(tmpV.x, tmpV.y + 24, tmpV.z, '#ff6b6b', 10, 0.8);
        break;
      case 'pickup': {
        const h = FLOOR_TOP - data.y;
        burst(toX(data.x), h, zAt(h - 14), data.glow, 14, 1);
        break;
      }
      case 'dead': {
        const s = slotFor(data);
        if (s.state === 'alive') { s.state = 'dying'; s.t = 0; s.spin = (Math.random() - 0.5) * 1.2; }
        const top = FLOOR_TOP - data.y;
        burst(toX(data.x + data.w / 2), top, zAt(top), COLORS[data.colorIdx].hex, 12, 0.8);
        break;
      }
      case 'gameover':
        playerWorldPos(tmpV);
        burst(tmpV.x, tmpV.y + 20, tmpV.z, '#cfeaff', 18, 1.1);
        break;
      case 'reset':
      case 'respawn':
        sq = 0; sqV = 0; hurtT = type === 'reset' ? 0 : hurtT;
        break;
    }
  }

  // ─── Encuadre: el tablero cabe en la zona libre (entre HUD y controles) ──
  // El lienzo ocupa toda la ventana; con setViewOffset la "vista completa" de la
  // cámara coincide con el rectángulo libre y el resto del lienzo es su extensión.
  const corners = Array.from({ length: 8 }, () => new THREE.Vector3());
  function fitCamera() {
    const { vw, vh, safe } = view;
    camera.clearViewOffset();
    camera.fov = FOV;
    camera.aspect = safe.w / safe.h;
    camera.updateProjectionMatrix();

    const x0 = -W / 2 - 4, x1 = W / 2 + 4;
    const zF = BLOCK_D / 2 + 4, zB = zAt(200) - BLOCK_D / 2;
    let i = 0;
    for (const x of [x0, x1]) for (const y of [FRAME_BOTTOM, FRAME_TOP]) for (const z of [zF, zB]) corners[i++].set(x, y, z);
    camTarget.set(0, (FRAME_BOTTOM + FRAME_TOP) / 2, (zF + zB) / 2);
    const dir = new THREE.Vector3(0, Math.sin(PITCH), Math.cos(PITCH));
    const mx = safe.w > 800 ? 0.9 : 0.97, my = 0.96;
    const v = new THREE.Vector3();
    let bbox = null;
    const measure = (dist) => {
      camera.position.copy(camTarget).addScaledVector(dir, dist);
      camera.lookAt(camTarget);
      camera.updateMatrixWorld();
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const c of corners) {
        v.copy(c).project(camera);
        minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
        minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
      }
      bbox = { minX, maxX, minY, maxY };
      return Math.max((maxX - minX) / 2 / mx, (maxY - minY) / 2 / my);
    };
    let lo = 300, hi = 30000;
    for (let it = 0; it < 32; it++) {
      const mid = (lo + hi) / 2;
      if (measure(mid) > 1) lo = mid; else hi = mid;
    }
    measure(hi);
    camBase.copy(camera.position);
    // Centra el tablero; si sobra alto, lo baja un poco (más cielo para saltos y objetos)
    const cx = (bbox.minX + bbox.maxX) / 2, cy = (bbox.minY + bbox.maxY) / 2;
    const slackY = Math.max(0, 2 * my - (bbox.maxY - bbox.minY));
    const cyGoal = -slackY * 0.3;
    camera.setViewOffset(safe.w, safe.h, -safe.x + cx * safe.w / 2, -safe.y - (cy - cyGoal) * safe.h / 2, vw, vh);
    camera.updateProjectionMatrix();

    // Sombras: la cámara de la luz cubre todo el tablero
    const sc = sun.shadow.camera;
    sc.left = -W / 2 - 260; sc.right = W / 2 + 260;
    sc.top = 520; sc.bottom = -520;
    sc.updateProjectionMatrix();
  }

  function applyPixelRatio() {
    const { vw, vh } = view;
    const dpr = window.devicePixelRatio || 1;
    const budget = Math.sqrt(3.6e6 / Math.max(1, vw * vh)); // tope de píxeles para pantallas enormes
    const pr = Math.max(0.6, Math.min(dpr, 2, Math.max(0.75, budget)) * quality);
    renderer.setPixelRatio(pr);
    renderer.setSize(vw, vh, false);
  }

  function resize(vw, vh, safe) {
    view = { vw: Math.max(1, vw), vh: Math.max(1, vh), safe };
    W = S.W;
    applyPixelRatio();
    fitCamera();
  }

  // ─── Fotograma ────────────────────────────────────────────────────────────
  function render(now, dt) {
    const dts = Math.min(dt, 50) / 1000;
    if (S.W !== W) { W = S.W; fitCamera(); }
    const t = now / 1000;
    const active = S.roundActive && S.started && !S.gameOver;
    const result = S.started && !S.roundActive && !S.gameOver && S.lastResult;
    const target = S.targetColorIdx;
    const pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(now / 150);

    // Plataformas
    for (const p of S.platforms) {
      ensureRowGeometry(p.row, p.w, p.h);
      const s = slotFor(p);
      if (s.obj !== p) {
        if (s.obj && s.state !== 'alive') { s.state = 'alive'; s.pop = 0; }
        s.obj = p;
      }
      if (p.dead && s.state === 'alive') { s.state = 'dying'; s.t = 0; s.spin = (Math.random() - 0.5) * 1.2; }

      const topH = FLOOR_TOP - p.y;
      let x = toX(p.x + p.w / 2), y = topH - p.h / 2, z = zAt(topH);
      let opacity = 1, scale = 1, rotZ = 0, glow = 0;
      const isTarget = p.colorIdx === target;

      if (s.state === 'dying') {
        s.t += dts / (reduced ? 0.45 : 0.9);
        if (s.t >= 1) { s.state = 'dead'; s.t = 1; }
        const e = s.t;
        opacity = 1 - e;
        if (!reduced) { y -= 260 * e * e; rotZ = s.spin * e; z += 30 * e; }
      }
      if (s.pop < 1) {
        s.pop = Math.min(1, s.pop + dts / 0.4);
        const e = s.pop;
        opacity *= e;
        if (!reduced) { const b = 1 + 2.2 * Math.pow(e - 1, 3) + 1.2 * Math.pow(e - 1, 2); scale = 0.6 + 0.4 * b; y -= 30 * (1 - e); }
      }

      // Tras acabar el tiempo, los colores que no eran el objetivo se apagan un momento
      const dimTarget = result && !isTarget ? 1 : 0;
      const dimPrev = s.dim;
      s.dim += (dimTarget - s.dim) * Math.min(1, dts * 14);
      if (Math.abs(s.dim - dimTarget) < 0.01) s.dim = dimTarget;
      const warning = p.warningTimer > 0 && !p.dead;
      if (s.dim !== dimPrev || warning !== s.warning) {
        // Aviso de eliminación: el bloque se vuelve naranja; apagado: mismo tono, mucho más oscuro
        const w = warning ? 0.75 : 0, k = 1 - s.dim * 0.72;
        s.top.color.copy(colorObjs[s.colorIdx].main).lerp(ORANGE, w).multiplyScalar(k);
        s.side.color.copy(colorObjs[s.colorIdx].side).lerp(ORANGE_SIDE, w).multiplyScalar(k);
      }

      if (warning) {
        const prog = 1 - p.warningTimer / 2200;
        const osc = Math.sin(prog * Math.PI * 9);
        glow = reduced ? 0.6 : 0.25 + 0.65 * Math.abs(osc);
        if (!reduced) scale *= 1 + 0.12 * osc;
      } else if (active && isTarget) {
        glow = 0.22 + 0.2 * pulse;
      } else if (result && isTarget) {
        glow = 0.5;
      }
      if (warning !== s.warning) {
        s.warning = warning;
        const ec = warning ? ORANGE : colorObjs[s.colorIdx].main;
        s.top.emissive.copy(ec); s.side.emissive.copy(ec);
      }

      const visible = s.state !== 'dead' && opacity > 0.01;
      s.mesh.visible = visible;
      if (visible) {
        s.mesh.position.set(x, y, z);
        s.mesh.rotation.z = rotZ;
        s.mesh.scale.setScalar(scale);
        s.top.opacity = s.side.opacity = opacity;
        s.top.emissiveIntensity = glow;
        s.side.emissiveIntensity = glow * 0.8;
        s.mesh.castShadow = opacity > 0.5;
      }
      const showGlow = visible && s.state === 'alive' && isTarget && (active || result) && !warning;
      s.hull.visible = showGlow;
      s.halo.visible = showGlow;
      if (showGlow) {
        s.halo.position.set(x, y, z - BLOCK_D / 2 - 4);
        s.halo.scale.set(p.w * 1.5 + 60, p.h + 110, 1);
      }
      s.warn.visible = visible && warning;
      if (s.warn.visible) s.warn.position.set(x, topH + 26 + (reduced ? 0 : 3 * Math.sin(now / 120)), z);
    }
    for (const m of hullMats) m.opacity = 0.45 + 0.45 * pulse;
    warnMat.opacity = reduced ? 1 : 0.65 + 0.35 * pulse;

    // Jugador
    const pl = S.player;
    playerWorldPos(pRoot.position);
    if (!reduced) {
      sqV += (-520 * sq - 26 * sqV) * dts;
      sq = Math.max(-0.4, Math.min(0.4, sq + sqV * dts));
    } else { sq = 0; sqV = 0; }
    pSquash.scale.set(1 - sq * 0.5, 1 + sq, 1 - sq * 0.5);
    pSquash.rotation.z = reduced ? 0 : -(pl.vx / 4.5) * 0.07;
    const look = Math.max(-1, Math.min(1, pl.vx / 4.5)) * 1.8;
    eyeL.position.x = -6.6 + look; eyeR.position.x = 6.6 + look;
    if (!reduced && dts > 0) {
      blinkIn -= dts;
      if (blinkIn <= 0) { blinkT = 0.12; blinkIn = 2.5 + Math.random() * 3; }
      if (blinkT > 0) blinkT -= dts;
    }
    const eyeScale = blinkT > 0 ? 0.15 : 1;
    eyeL.scale.y = eyeR.scale.y = eyeScale;
    if (hurtT > 0) hurtT = Math.max(0, hurtT - dts);
    pMat.emissive.setRGB(0.75 + hurtT * 0.6, 0.89 - hurtT * 1.4, 1 - hurtT * 1.6);
    pMat.emissiveIntensity = 0.22 + hurtT;
    pHalo.material.opacity = S.gameOver ? 0.2 : 0.5 + 0.1 * pulse;
    shield.visible = S.shieldActive;
    if (shield.visible && !reduced) { shield.rotation.y = t * 1.2; shield.rotation.x = t * 0.5; }
    shield.material.opacity = reduced ? 0.55 : 0.4 + 0.25 * pulse;

    // Objetos
    seen.clear();
    for (const pk of S.pickups) {
      let e = pkLive.get(pk);
      if (!e) { e = takePickupMesh(pk); pkLive.set(pk, e); }
      seen.add(pk);
      const bob = reduced ? 0 : Math.sin(now / 400 + pk.x / 30) * 5;
      const hC = FLOOR_TOP - pk.y;              // centro del objeto
      e.root.position.set(toX(pk.x), hC + bob, zAt(hC - 14));
      e.mesh.rotation.y = reduced ? 0.35 : t * 1.4;
      e.mesh.rotation.x = reduced ? 0 : Math.sin(t * 1.1) * 0.2;
    }
    for (const [pk, e] of pkLive) {
      if (seen.has(pk)) continue;
      world.remove(e.root);
      pkPool.push(e);
      pkLive.delete(pk);
    }

    updateParticles(dts);

    // Cámara (temblor al perder una vida)
    camera.position.copy(camBase);
    if (shakeT > 0 && !reduced) {
      shakeT = Math.max(0, shakeT - dts);
      const a = 7 * (shakeT / 0.32);
      camera.position.x += (Math.random() - 0.5) * a * 2;
      camera.position.y += (Math.random() - 0.5) * a * 2;
    }

    // Calidad adaptable: si va lento de forma sostenida, baja la resolución interna
    if (dt > 0) {
      frameAvg += (dt - frameAvg) * 0.05;
      if (frameAvg > 38 && quality > 0.6) {   // < ~26 fps sostenidos (no salta con pantallas a 30 Hz)
        if (++slowFrames > 90) { quality = Math.max(0.6, quality - 0.15); slowFrames = 0; frameAvg = 16.7; applyPixelRatio(); }
      } else slowFrames = 0;
    }

    renderer.render(scene, camera);
  }

  function busy() {
    if (partActive > 0 || shakeT > 0 || Math.abs(sq) > 0.002 || Math.abs(sqV) > 0.02) return true;
    for (const s of slots) if (s.state === 'dying' || s.pop < 1 || (s.dim > 0 && s.dim < 1)) return true;
    return false;
  }

  return {
    kind: '3d',
    resize,
    render,
    event,
    busy,
    setReducedMotion(v) { reduced = !!v; },
    info: () => renderer.info,
  };
}

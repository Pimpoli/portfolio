// Ambidextro 3D — renderizador three.js.
// No tiene lógica de juego: cada frame lee el estado 2D (px, «y» hacia abajo) y lo proyecta
// a la escena: x → X, y → −Y, con el plano de juego en Z = 0 y la cámara algo por encima.
// Geometrías y materiales se comparten; lo propio de cada nivel se crea al cambiar de nivel
// (o de tamaño) y se libera al instante.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const PF_D  = 72;                               // profundidad de las plataformas
const PL_D  = 28;                               // profundidad de los jugadores
const PITCH = THREE.MathUtils.degToRad(20);     // cámara mirando ~20° hacia abajo
const FOV   = 30;
const COL   = { p1: 0xff6b6b, p2: 0x4ecdc4, gold: 0xf1c40f };
const PICKUP_COL = { heart: 0xff6b6b, shield: 0xf1c40f, time: 0x4ecdc4 };

// ─── Texturas generadas (una sola vez) ─────────────────────────────────────
function canvasTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = size[0]; c.height = size[1];
  draw(c.getContext('2d'), c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const makeGlowTexture = () => canvasTexture([128, 128], (g) => {
  const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  rg.addColorStop(0, 'rgba(255,255,255,1)');
  rg.addColorStop(0.22, 'rgba(255,255,255,0.6)');
  rg.addColorStop(0.55, 'rgba(255,255,255,0.14)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
});

const makeBackgroundTexture = () => canvasTexture([256, 256], (g) => {
  const lg = g.createLinearGradient(0, 0, 0, 256);
  lg.addColorStop(0, '#0a0b12'); lg.addColorStop(0.55, '#0f1a22'); lg.addColorStop(1, '#112a2c');
  g.fillStyle = lg; g.fillRect(0, 0, 256, 256);
  const rg = g.createRadialGradient(128, 175, 0, 128, 175, 130);
  rg.addColorStop(0, 'rgba(78,205,196,0.10)'); rg.addColorStop(1, 'rgba(78,205,196,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
});

const makeIconTexture = (type) => canvasTexture([64, 64], (g) => {
  g.scale(64 / 24, 64 / 24);
  const col = type === 'heart' ? '#4a0d0d' : type === 'shield' ? '#3a2c00' : '#093b37';
  g.fillStyle = col; g.strokeStyle = col;
  if (type === 'heart') {
    g.fill(new Path2D('M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z'));
  } else if (type === 'shield') {
    g.fill(new Path2D('M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z'));
  } else {
    g.lineWidth = 2.6; g.lineCap = 'round';
    g.beginPath(); g.arc(12, 13.5, 7.2, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(12, 13.5); g.lineTo(12, 9.6);
    g.moveTo(9.5, 2.6); g.lineTo(14.5, 2.6); g.moveTo(12, 2.6); g.lineTo(12, 6); g.stroke();
  }
});

// Sombra suave bajo cada plataforma: rectángulo con borde difuminado por alfa de vértice
function dropShadowGeometry(w, h, blur, alpha) {
  const xs = [-w / 2 - blur, -w / 2, w / 2, w / 2 + blur];
  const ys = [-h / 2 - blur, -h / 2, h / 2, h / 2 + blur];
  const pos = [], col = [], idx = [];
  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < 4; i++) {
      pos.push(xs[i], ys[j], 0);
      const inner = (i === 1 || i === 2) && (j === 1 || j === 2);
      col.push(0, 0, 0, inner ? alpha : 0);
    }
  }
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 3; i++) {
      const a = j * 4 + i, b = a + 1, c = a + 4, d = c + 1;
      idx.push(a, b, d, a, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  geo.setIndex(idx);
  return geo;
}

export function createRenderer3D(G, { onContextLost } = {}) {
  const canvas = document.createElement('canvas');
  // Sin WebGL 2 se lanza una excepción y game.js recurre al canvas 2D
  // (se comprueba aquí para no dejar errores de three.js en la consola)
  const gl = canvas.getContext('webgl2', {
    alpha: false, depth: true, stencil: false, antialias: true,
    premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance',
  });
  if (!gl) throw new Error('WebGL 2 no disponible');
  const renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true, powerPreference: 'high-performance' });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const lost = () => onContextLost && onContextLost();
  canvas.addEventListener('webglcontextlost', lost);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 10, 8000);
  const disposables = [];
  const keep = (x) => { disposables.push(x); return x; };

  // ─── Fondo, luces y suelo ──────────────────────────────────────────────
  scene.background = keep(makeBackgroundTexture());
  const glowTex = keep(makeGlowTexture());

  // Entorno mínimo para los reflejos brillantes de cubos y orbes (paneles de luz difusos)
  const envTex = (() => {
    const env = new THREE.Scene();
    env.background = new THREE.Color(0x0b0d16);
    const panel = (color, w, h, x, y, z) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
      return m;
    };
    const panels = [
      panel(0xffffff, 6, 3, -2, 6, 4),      // luz principal arriba-delante
      panel(0x4ecdc4, 8, 2, 0, -3, 6),      // rebote turquesa del suelo
      panel(0x7c4dff, 3, 5, 7, 1, -2),      // acento violeta lateral
    ];
    const pmrem = new THREE.PMREMGenerator(renderer);
    const rt = pmrem.fromScene(env, 0.02);
    pmrem.dispose();
    for (const m of panels) { m.geometry.dispose(); m.material.dispose(); }
    disposables.push(rt);
    return rt.texture;
  })();

  const hemi = new THREE.HemisphereLight(0xd9e2ff, 0x16222a, 2.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.6);
  sun.castShadow = true;
  const smallScreen = Math.min(window.innerWidth, window.innerHeight) < 600;
  sun.shadow.mapSize.set(smallScreen ? 1024 : 2048, smallScreen ? 1024 : 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0x4ecdc4, 0.55);   // reflejo turquesa desde abajo
  fill.position.set(0, -1, 0.6);
  scene.add(fill);

  const gridMat = keep(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      uColor: { value: new THREE.Color(0x4ecdc4) },
      uCell:  { value: 64 },
      uFade:  { value: new THREE.Vector2(120, 1100) },
    },
    vertexShader: /* glsl */`
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uCell; uniform vec2 uFade;
      varying vec3 vW;
      void main() {
        vec2 c = vW.xz / uCell;
        vec2 f = abs(fract(c - 0.5) - 0.5) / fwidth(c);
        float line = 1.0 - min(min(f.x, f.y), 1.0);
        float d = length(vec2(vW.x * 0.45, min(vW.z, 0.0)));
        float fade = 1.0 - smoothstep(uFade.x, uFade.y, d);
        gl_FragColor = vec4(uColor * (0.8 + 0.5 * line), (line * 0.32 + 0.03) * fade);
        #include <colorspace_fragment>
      }`,
  }));
  const gridGeo = keep(new THREE.PlaneGeometry(1, 1));
  const grid = new THREE.Mesh(gridGeo, gridMat);
  grid.rotation.x = -Math.PI / 2;
  grid.scale.set(7000, 4200, 1);
  grid.renderOrder = -1;
  scene.add(grid);

  // ─── Geometrías y materiales compartidos ───────────────────────────────
  const matPfTop   = keep(new THREE.MeshStandardMaterial({ color: 0x302e47, roughness: 0.8 }));
  const matPfFront = keep(new THREE.MeshStandardMaterial({ color: 0x2c2b40, roughness: 0.85 }));
  const matPfSide  = keep(new THREE.MeshStandardMaterial({ color: 0x1d1c2b, roughness: 0.9 }));
  // Orden de grupos de BoxGeometry: +x, −x, +y, −y, +z, −z
  const pfMaterials = [matPfSide, matPfSide, matPfTop, matPfSide, matPfFront, matPfSide];
  const matRim     = keep(new THREE.MeshBasicMaterial({ color: 0x4a4868 }));
  const geoRim     = keep(new THREE.BoxGeometry(1, 1.6, 1.6));
  const matShadow  = keep(new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, depthWrite: false }));

  const geoPlayer = keep(new RoundedBoxGeometry(28, 40, PL_D, 4, 7));
  const geoEye    = keep(new RoundedBoxGeometry(4.6, 8, 2, 1, 1.4));
  const matEye    = keep(new THREE.MeshBasicMaterial({ color: 0x14131c, depthFunc: THREE.AlwaysDepth }));
  const geoHalo   = keep(new THREE.TorusGeometry(28, 2.2, 10, 56));
  const matHalo   = keep(new THREE.MeshBasicMaterial({ color: COL.gold, transparent: true, opacity: 0.9 }));
  const matHaloGlow = keep(new THREE.SpriteMaterial({ map: glowTex, color: COL.gold, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));

  const geoSpike = keep(new THREE.ConeGeometry(8.5, 24, 4, 1).translate(0, 12, 0));
  const matSpikeHot = keep(new THREE.MeshStandardMaterial({ color: 0xe74c3c, emissive: 0xff2200, emissiveIntensity: 0.55, roughness: 0.4 }));
  const matSpikeDim = keep(new THREE.MeshStandardMaterial({ color: 0x993322, emissive: 0x661100, emissiveIntensity: 0.3, roughness: 0.6 }));
  const geoWarn  = keep(new THREE.TorusGeometry(1, 0.045, 6, 36, Math.PI));
  const matWarn  = keep(new THREE.MeshBasicMaterial({ color: 0xff5000, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }));

  const geoOrb = keep(new THREE.SphereGeometry(11, 28, 18));
  const pickupMats = {};
  for (const type of ['heart', 'shield', 'time']) {
    const c = PICKUP_COL[type];
    pickupMats[type] = {
      orb:  keep(new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.4, roughness: 0.22, envMap: envTex, envMapIntensity: 0.8 })),
      icon: keep(new THREE.SpriteMaterial({ map: keep(makeIconTexture(type)), transparent: true, depthWrite: false })),
      glow: keep(new THREE.SpriteMaterial({ map: glowTex, color: c, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })),
    };
  }

  const geoMarker = keep(new THREE.ConeGeometry(8, 15, 3).rotateX(Math.PI));
  const markerMats = [COL.p1, COL.p2].map((c) => keep(new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.5, transparent: true, opacity: 0.55 })));

  // ─── Jugadores (persistentes) ──────────────────────────────────────────
  function makeRig(hex) {
    const group = new THREE.Group();
    const mat = keep(new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.1, roughness: 0.2, metalness: 0.05, envMap: envTex, envMapIntensity: 0.9 }));
    // Las plataformas se atraviesan desde abajo (como en 2D): el cubo se dibuja siempre encima
    // de ellas para no desaparecer dentro de una losa. Es convexo, así que basta con que el test
    // de profundidad pase siempre (y siga escribiendo profundidad para tapar los brillos de detrás)
    mat.depthFunc = THREE.AlwaysDepth;
    const body = new THREE.Mesh(geoPlayer, mat);
    body.castShadow = true;
    body.renderOrder = 10;
    body.position.y = 20;
    const eyes = [-5.8, 5.8].map((x) => {
      const e = new THREE.Mesh(geoEye, matEye);
      e.renderOrder = 11;
      e.position.set(x, 7, PL_D / 2 + 0.2);
      body.add(e);
      return e;
    });
    const glowMat = keep(new THREE.SpriteMaterial({ map: glowTex, color: hex, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(130, 130, 1);
    glow.position.set(0, 20, -20);
    const halo = new THREE.Mesh(geoHalo, matHalo);
    halo.renderOrder = 12;
    halo.position.y = 20;
    const haloGlow = new THREE.Sprite(matHaloGlow);
    haloGlow.scale.set(96, 96, 1);
    haloGlow.position.set(0, 20, -6);
    const light = new THREE.PointLight(hex, 420, 190, 1.6);
    light.position.set(0, 30, 48);
    group.add(glow, body, halo, haloGlow, light);
    scene.add(group);
    return { group, body, mat, eyes, glow, halo, haloGlow, sq: 0, sqV: 0, eyeX: 0, prevGrounded: true, prevVy: 0 };
  }
  const rigs = [makeRig(COL.p1), makeRig(COL.p2)];

  // ─── Explosión al tocarse ──────────────────────────────────────────────
  const BURST_N = 64;
  const bPos = new Float32Array(BURST_N * 3), bCol = new Float32Array(BURST_N * 3), bVel = new Float32Array(BURST_N * 3);
  const burstGeo = keep(new THREE.BufferGeometry());
  burstGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
  burstGeo.setAttribute('color', new THREE.BufferAttribute(bCol, 3));
  const burstMat = keep(new THREE.PointsMaterial({ size: 80, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const burstPts = new THREE.Points(burstGeo, burstMat);
  burstPts.frustumCulled = false;
  burstPts.visible = false;
  const flash = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff1c2, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  flash.visible = false;
  scene.add(burstPts, flash);
  const burstPalette = [COL.p1, COL.p2, COL.gold, 0xffffff].map((h) => new THREE.Color(h));
  let burstT = -1;

  // ─── Objetos de cada nivel ─────────────────────────────────────────────
  const levelGroup = new THREE.Group();
  scene.add(levelGroup);
  let levelDisposables = [];
  let spikeRigs = [], pickupRigs = [], markers = [];
  let builtW = 0, builtH = 0;

  const wx = (x) => x - G.W / 2;
  const wy = (y) => G.H / 2 - y;

  function clearLevel() {
    levelGroup.clear();
    for (const d of levelDisposables) d.dispose();
    levelDisposables = [];
    spikeRigs = []; pickupRigs = []; markers = [];
  }

  function buildLevel() {
    clearLevel();
    builtW = G.W; builtH = G.H;

    for (const pf of G.platforms) {
      const h = Math.max(pf.h, 14);
      const geo = new RoundedBoxGeometry(pf.w, h, PF_D, 3, Math.min(6, h * 0.3));
      levelDisposables.push(geo);
      const m = new THREE.Mesh(geo, pfMaterials);
      m.position.set(wx(pf.x + pf.w / 2), wy(pf.y) - h / 2, 0);
      m.receiveShadow = true;
      levelGroup.add(m);

      // Borde superior más claro (como en el diseño)
      const rim = new THREE.Mesh(geoRim, matRim);
      rim.scale.x = Math.max(pf.w - 10, 2);
      rim.position.set(m.position.x, wy(pf.y) - 1.4, PF_D / 2 - 1.2);
      levelGroup.add(rim);

      // Sombra suave detrás/debajo de la plataforma
      const sg = dropShadowGeometry(pf.w + 6, h + 8, 30, 0.6);
      levelDisposables.push(sg);
      const sh = new THREE.Mesh(sg, matShadow);
      sh.position.set(m.position.x, m.position.y - 34, -PF_D / 2 - 2);
      sh.renderOrder = 0;
      levelGroup.add(sh);
    }

    for (const sp of G.spikes) {
      const mesh = new THREE.Mesh(geoSpike, matSpikeDim);
      mesh.castShadow = true;
      const glowMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xff3b1f, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      levelDisposables.push(glowMat);
      const glow = new THREE.Sprite(glowMat);
      glow.scale.set(58, 58, 1);
      const warn = new THREE.Mesh(geoWarn, matWarn);
      levelGroup.add(mesh, glow, warn);
      spikeRigs.push({ sp, mesh, glow, warn });
    }

    for (const pk of G.pickups) {
      const m = pickupMats[pk.type];
      const group = new THREE.Group();
      const orb = new THREE.Mesh(geoOrb, m.orb);
      orb.castShadow = true;
      const icon = new THREE.Sprite(m.icon);
      icon.scale.set(13, 13, 1);
      icon.position.set(0, 11.6 * Math.sin(PITCH), 11.6 * Math.cos(PITCH));
      const glow = new THREE.Sprite(m.glow);
      glow.scale.set(70, 70, 1);
      glow.position.z = -12;
      group.add(glow, orb, icon);
      levelGroup.add(group);
      pickupRigs.push({ pk, group });
    }

    const lv = G.level;
    [[lv.p1, 0], [lv.p2, 1]].forEach(([pos, i]) => {
      const mk = new THREE.Mesh(geoMarker, markerMats[i]);
      const x = pos[0] * G.W + 14, y = pos[1] * G.H - 37;
      mk.position.set(wx(x), wy(y), 0);
      mk.userData.baseY = mk.position.y;
      levelGroup.add(mk);
      markers.push(mk);
    });

    burstT = -1; burstPts.visible = false; flash.visible = false;
    updateSceneBounds();
  }

  // Luz, sombra y suelo dependen del tamaño del mundo
  function updateSceneBounds() {
    const W = G.W, H = G.H;
    sun.position.set(-0.32 * 1400, 1400, 0.62 * 1400);
    sun.target.position.set(0, 0, 0);
    const sc = sun.shadow.camera;
    const ext = Math.max(W, H) * 0.62 + 90;
    sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext;
    sc.near = 400; sc.far = 3200;
    sc.updateProjectionMatrix();
    grid.position.set(0, -H / 2 - 70, -200);
  }

  // ─── Cámara: encuadra el mundo W×H dentro del hueco de juego ───────────
  let view = null;
  const _v = new THREE.Vector3();
  const target = new THREE.Vector3();
  function fitCamera() {
    if (!view) return;
    const { vw, vh, rect } = view;
    const W = G.W, H = G.H;
    camera.aspect = vw / vh;
    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
    camera.setViewOffset(vw, vh, vw / 2 - cx, vh / 2 - cy, vw, vh);
    const hw = W / 2, hh = H / 2, zf = PF_D / 2;
    const pts = [[-hw, hh, -zf], [hw, hh, -zf], [-hw, hh, zf], [hw, hh, zf], [-hw, -hh, zf], [hw, -hh, zf]];
    const tanH = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    let dist = (H / 2) / tanH * 1.15;
    target.set(0, 0, 0);
    for (let i = 0; i < 6; i++) {
      camera.position.set(target.x, target.y + dist * Math.sin(PITCH), target.z + dist * Math.cos(PITCH));
      camera.lookAt(target);
      camera.near = dist * 0.25; camera.far = dist * 8;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of pts) {
        _v.set(p[0], p[1], p[2]).project(camera);
        const sx = (_v.x + 1) / 2 * vw, sy = (1 - _v.y) / 2 * vh;
        minX = Math.min(minX, sx); maxX = Math.max(maxX, sx);
        minY = Math.min(minY, sy); maxY = Math.max(maxY, sy);
      }
      const pxPerUnit = vh / (2 * dist * tanH);
      target.y -= ((minY + maxY) / 2 - cy) / pxPerUnit;
      const f = Math.max((maxX - minX) / (rect.w * 0.97), (maxY - minY) / (rect.h * 0.97));
      dist *= f;
    }
    camera.position.set(target.x, target.y + dist * Math.sin(PITCH), target.z + dist * Math.cos(PITCH));
    camera.lookAt(target);
    camera.near = dist * 0.25; camera.far = dist * 8;
    camera.updateProjectionMatrix();
  }

  function resize(v, worldChanged) {
    view = v;
    renderer.setSize(v.vw, v.vh, false);
    if (G.platforms.length && (worldChanged || builtW !== G.W || builtH !== G.H)) buildLevel();
    fitCamera();
  }

  // ─── Explosión ─────────────────────────────────────────────────────────
  function burst(x, y) {
    const cx = wx(x), cy = wy(y);
    flash.position.set(cx, cy, 24);
    flash.visible = true;
    burstT = 0;
    if (G.reducedMotion) return;
    for (let i = 0; i < BURST_N; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      const speed = 160 + Math.random() * 300;
      bPos[i * 3] = cx; bPos[i * 3 + 1] = cy; bPos[i * 3 + 2] = 10;
      bVel[i * 3] = r * Math.cos(a) * speed;
      bVel[i * 3 + 1] = u * speed * 0.8 + 170;
      bVel[i * 3 + 2] = r * Math.sin(a) * speed * 0.6;
      const c = burstPalette[i % burstPalette.length];
      bCol[i * 3] = c.r; bCol[i * 3 + 1] = c.g; bCol[i * 3 + 2] = c.b;
    }
    burstGeo.attributes.position.needsUpdate = true;
    burstGeo.attributes.color.needsUpdate = true;
    burstPts.visible = true;
  }

  function updateBurst(dt) {
    if (burstT < 0) return;
    burstT += dt;
    const LIFE = 1.1;
    const t = burstT / LIFE;
    if (t >= 1) { burstT = -1; burstPts.visible = false; flash.visible = false; return; }
    const s = G.reducedMotion ? 200 : 80 + 360 * Math.sqrt(t);
    flash.scale.set(s, s, 1);
    flash.material.opacity = (1 - t) * 0.85;
    if (burstPts.visible) {
      for (let i = 0; i < BURST_N; i++) {
        bVel[i * 3 + 1] -= 520 * dt;
        bPos[i * 3] += bVel[i * 3] * dt;
        bPos[i * 3 + 1] += bVel[i * 3 + 1] * dt;
        bPos[i * 3 + 2] += bVel[i * 3 + 2] * dt;
      }
      burstGeo.attributes.position.needsUpdate = true;
      burstMat.opacity = 1 - t * t;
    }
  }

  // ─── Frame ─────────────────────────────────────────────────────────────
  const players = () => [G.p1, G.p2];
  let perfFrames = 0, perfAcc = 0;

  function updateRig(rig, p, ts, dt) {
    const reduced = G.reducedMotion;
    rig.group.position.set(wx(p.x + p.w / 2), wy(p.y + p.h), 0);

    // Parpadeo de invencibilidad (con movimiento reducido: semitransparente, sin parpadeo)
    const inv = p.invincible > 0;
    rig.group.visible = !(inv && !reduced && Math.floor(ts / 90) % 2 === 0);
    const wantAlpha = inv && reduced ? 0.45 : 1;
    if (rig.mat.opacity !== wantAlpha) {
      rig.mat.transparent = wantAlpha < 1; rig.mat.opacity = wantAlpha; rig.mat.needsUpdate = true;
    }

    // Estirar al saltar / aplastar al aterrizar (muelle amortiguado)
    if (!reduced && G.state === 'playing') {
      if (p.grounded && !rig.prevGrounded) rig.sq = -0.3 * Math.min(1, Math.max(0.35, rig.prevVy / 14));
      else if (!p.grounded && rig.prevGrounded && p.vy < -5) rig.sq = 0.26;
      const goal = p.grounded ? 0 : Math.max(-0.08, Math.min(0.14, -p.vy * 0.011));
      rig.sqV += (320 * (goal - rig.sq) - 17 * rig.sqV) * dt;
      rig.sq += rig.sqV * dt;
      rig.sq = Math.max(-0.4, Math.min(0.4, rig.sq));
    } else {
      rig.sq = 0; rig.sqV = 0;
    }
    if (!p.grounded) rig.prevVy = p.vy;
    rig.prevGrounded = p.grounded;
    const sy = 1 + rig.sq, sxz = 1 - rig.sq * 0.55;
    rig.body.scale.set(sxz, sy, sxz);
    rig.body.position.y = 20 * sy;

    // Los ojos miran hacia donde se mueve
    const look = Math.abs(p.vx) > 0.4 ? Math.sign(p.vx) * 2.2 : 0;
    rig.eyeX += (look - rig.eyeX) * Math.min(1, dt * 12);
    rig.eyes[0].position.x = -5.8 + rig.eyeX;
    rig.eyes[1].position.x = 5.8 + rig.eyeX;

    // Escudo: halo amarillo
    rig.halo.visible = rig.haloGlow.visible = p.shielded;
    if (p.shielded) {
      rig.halo.position.y = rig.haloGlow.position.y = 20 * sy;
      rig.halo.rotation.y = reduced ? 0 : Math.sin(ts / 600) * 0.35;
    }
  }

  function render(ts, dtMs) {
    if (!view || document.hidden) return;
    const dt = dtMs / 1000;
    const reduced = G.reducedMotion;

    const ps = players();
    rigs.forEach((rig, i) => updateRig(rig, ps[i], ts, dt));
    matHalo.opacity = reduced ? 0.85 : 0.6 + 0.4 * Math.sin(ts / 180);

    for (const s of spikeRigs) {
      const e = s.sp.emerge;
      const x = wx(s.sp.x), y = wy(s.sp.yBase);
      s.mesh.visible = e > 0.001;
      s.mesh.scale.set(1, Math.max(e, 0.001), 1);
      s.mesh.position.set(x, y, 0);
      s.mesh.material = e > 0.7 ? matSpikeHot : matSpikeDim;
      s.glow.visible = e > 0.001;
      s.glow.position.set(x, y + 8 * e, 4);
      s.glow.material.opacity = e > 0.7 ? 0.75 : e * 0.35;
      s.warn.visible = e > 0 && e < 0.4;
      const r = s.sp.triggerDist * 0.3;
      s.warn.scale.set(r, r, r);
      s.warn.position.set(x, y, 0);
    }
    matWarn.opacity = reduced ? 0.3 : 0.28 + 0.16 * Math.sin(ts / 150);

    for (const r of pickupRigs) {
      const pk = r.pk;
      r.group.visible = !pk.collected;
      if (pk.collected) continue;
      const bob = Math.sin(ts / 600 + pk.x / 50) * 4;   // igual que la colisión
      r.group.position.set(wx(pk.x), wy(pk.y + bob), 0);
    }

    for (const mk of markers) {
      mk.position.y = mk.userData.baseY + (reduced ? 0 : Math.sin(ts / 450) * 3);
      mk.rotation.y = reduced ? 0 : ts / 900;
    }

    updateBurst(dt);
    renderer.render(scene, camera);

    // Si va muy justo (móviles modestos), baja la resolución una vez
    if (pixelRatio > 1 && dtMs > 0) {
      perfAcc += dtMs; perfFrames++;
      if (perfFrames >= 90) {
        if (perfAcc / perfFrames > 30) { pixelRatio = 1; renderer.setPixelRatio(1); renderer.setSize(view.vw, view.vh, false); }
        perfFrames = 0; perfAcc = 0;
      }
    }
  }

  function dispose() {
    canvas.removeEventListener('webglcontextlost', lost);
    clearLevel();
    for (const d of disposables) d.dispose();
    renderer.dispose();
  }

  return {
    kind: '3d', canvas, resize, buildLevel, render, burst, dispose,
    info: () => ({ ...renderer.info.render, pixelRatio, programs: renderer.info.programs?.length }),
  };
}

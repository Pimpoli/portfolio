// js/games.js - Carga con reintentos automáticos hasta que todo cargue

document.addEventListener('DOMContentLoaded', () => {
  const gamesContainer     = document.getElementById('games-container');
  const moreGamesContainer = document.getElementById('more-games');
  const loadMoreBtn        = document.getElementById('load-more-games');

  if (!gamesContainer) return;

  // ──────────────────────────────────────────────────────────────────────────
  // CONFIGURACIÓN: IDs de tus juegos
  // ──────────────────────────────────────────────────────────────────────────
  const GAME_IDS = [
    16125269940,       // Anime Color Block Run
    71541333892738,    // Bloxidextro
    108138370693321,   // Avalanche of objects
    107726833867004    // 67 Red Light Green Light
  ];

  // Datos de respaldo para si la API falla definitivamente
  const FALLBACK_GAMES = {
    16125269940:    { name: 'Anime Color Block Run',  desc: 'Corre por bloques de colores en un mapa dinámico.' },
    71541333892738: { name: 'Bloxidextro',            desc: 'Juego de Bloxidextro.' },
    108138370693321:{ name: 'Avalanche of objects',   desc: 'Sobrevive a la avalancha.' },
    107726833867004:{ name: '67 Luz Roja Luz Verde',  desc: 'Juego de supervivencia.' }
  };

  const gameDatabase = {};
  let memoryCleanupTimeout = null;

  // ──────────────────────────────────────────────────────────────────────────
  // Fetch con timeout individual por intento
  // ──────────────────────────────────────────────────────────────────────────
  async function fetchWithTimeout(url, options = {}, ms = 8000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Reintento con backoff exponencial
  // Intenta hasta maxAttempts veces antes de lanzar el error
  // Demoras: 1s → 2s → 4s entre intentos
  // ──────────────────────────────────────────────────────────────────────────
  async function retryFetch(url, options = {}, maxAttempts = 3, timeoutMs = 8000) {
    let lastError;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const res = await fetchWithTimeout(url, options, timeoutMs);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res;
      } catch (e) {
        lastError = e;
        if (attempt < maxAttempts - 1) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        }
      }
    }
    throw lastError;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Paso 1: obtener universeId con reintentos
  // ──────────────────────────────────────────────────────────────────────────
  async function fetchUniverseId(placeId) {
    const res = await retryFetch(
      `https://apis.roproxy.com/universes/v1/places/${placeId}/universe`,
      {}, 3, 8000
    );
    const data = await res.json();
    if (!data.universeId) throw new Error('No universeId in response');
    return data.universeId;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Paso 2: obtener info, icono y thumbnails con reintentos independientes
  // Cada parte falla por separado sin cancelar el resto
  // ──────────────────────────────────────────────────────────────────────────
  async function fetchGameParts(universeId, placeId) {
    const fb = FALLBACK_GAMES[placeId] || {};
    let name = fb.name || `Juego ${placeId}`;
    let desc = fb.desc || '';
    let iconUrl = 'img/MultiGameInc.webp';
    let thumbnails = [];

    const [infoRes, iconRes, thumbsRes] = await Promise.allSettled([
      retryFetch(`https://games.roproxy.com/v1/games?universeIds=${universeId}`, {}, 3, 8000),
      retryFetch(`https://thumbnails.roproxy.com/v1/games/icons?universeIds=${universeId}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`, {}, 3, 8000),
      retryFetch(`https://thumbnails.roproxy.com/v1/games/multiget/thumbnails?universeIds=${universeId}&countPerUniverse=10&defaults=true&size=768x432&format=Png&isCircular=false`, {}, 3, 8000)
    ]);

    if (infoRes.status === 'fulfilled') {
      try {
        const d = await infoRes.value.json();
        if (d.data?.[0]) { name = d.data[0].name || name; desc = d.data[0].description || desc; }
      } catch (e) { /* usa fallback */ }
    }

    if (iconRes.status === 'fulfilled') {
      try {
        const d = await iconRes.value.json();
        iconUrl = d.data?.[0]?.imageUrl || iconUrl;
      } catch (e) { /* usa fallback */ }
    }

    if (thumbsRes.status === 'fulfilled') {
      try {
        const d = await thumbsRes.value.json();
        thumbnails = d.data?.[0]?.thumbnails?.map(t => t.imageUrl).filter(Boolean) || [];
      } catch (e) { /* usa fallback */ }
    }

    return { name, desc, iconUrl, thumbnails };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Carga completa de un juego con reintentos en cada paso
  // Siempre devuelve algo (fallback en el peor caso)
  // ──────────────────────────────────────────────────────────────────────────
  async function fetchBasicGameData(placeId) {
    if (gameDatabase[placeId]) return gameDatabase[placeId];

    const fb = FALLBACK_GAMES[placeId] || {};
    let universeId = null;

    try {
      universeId = await fetchUniverseId(placeId);
    } catch (e) {
      console.warn(`No se pudo obtener universeId para ${placeId}. Usando datos de respaldo.`);
      gameDatabase[placeId] = {
        id: placeId, universeId: null,
        name: fb.name || `Juego ${placeId}`, desc: fb.desc || '',
        iconUrl: 'img/MultiGameInc.webp', coverUrl: 'img/MultiGameInc.webp',
        images: ['img/MultiGameInc.webp'], isFallback: true
      };
      return gameDatabase[placeId];
    }

    const { name, desc, iconUrl, thumbnails } = await fetchGameParts(universeId, placeId);

    gameDatabase[placeId] = {
      id: placeId, universeId,
      name, desc, iconUrl,
      coverUrl: thumbnails.length > 0 ? thumbnails[0] : iconUrl,
      images:   thumbnails.length > 0 ? thumbnails : [iconUrl],
      isFallback: false
    };

    return gameDatabase[placeId];
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Reintento silencioso en background si la tarjeta cargó con fallback
  // Actualiza la UI cuando lleguen los datos reales
  // ──────────────────────────────────────────────────────────────────────────
  async function backgroundRetryGame(placeId, cardEl) {
    // Espera 6 segundos antes de reintentar para no saturar la API
    await new Promise(r => setTimeout(r, 6000));
    delete gameDatabase[placeId]; // Limpia caché de fallback
    try {
      const game = await fetchBasicGameData(placeId);
      if (!game.isFallback && cardEl && cardEl.isConnected) {
        updateCardUI(cardEl, game);
      }
    } catch (e) { /* silencioso */ }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Renderizar tarjeta
  // ──────────────────────────────────────────────────────────────────────────
  function renderGameCard(game) {
    const card = document.createElement('div');
    card.className = 'game-card fade-in';
    card.dataset.gameId = String(game.id);

    const inner = document.createElement('div');
    inner.className = 'card-inner';

    const gi = document.createElement('div');
    gi.className = 'game-icon';
    const gimg = document.createElement('img');
    gimg.src = game.iconUrl;
    gimg.alt = game.name + ' icon';
    gi.appendChild(gimg);

    const gc = document.createElement('div');
    gc.className = 'game-cover';
    const coverImg = document.createElement('img');
    coverImg.src = game.coverUrl;
    coverImg.alt = 'cover';
    coverImg.style.cssText = 'width:100%;height:100%;object-fit:cover;';
    gc.appendChild(coverImg);

    inner.appendChild(gi);
    inner.appendChild(gc);

    const title = document.createElement('div');
    title.className = 'game-title';
    title.textContent = game.name;

    card.appendChild(inner);
    card.appendChild(title);
    card.style.cursor = 'pointer';

    return card;
  }

  function updateCardUI(cardEl, game) {
    const iconImg = cardEl.querySelector('.game-icon img');
    const coverImg = cardEl.querySelector('.game-cover img');
    const titleEl = cardEl.querySelector('.game-title');
    if (iconImg)  iconImg.src  = game.iconUrl;
    if (coverImg) coverImg.src = game.coverUrl;
    if (titleEl)  titleEl.textContent = game.name;
    // Actualizar datos en BD por si el modal se abre después
    gameDatabase[game.id] = game;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Carga inicial (2 primeros juegos en paralelo)
  // ──────────────────────────────────────────────────────────────────────────
  let extraGamesLoaded = false;

  async function loadInitialGames() {
    const initialIds = GAME_IDS.slice(0, 2);
    const results = await Promise.all(initialIds.map(id => fetchBasicGameData(id)));

    results.forEach((game) => {
      if (!game) return;
      const card = renderGameCard(game);
      gamesContainer.appendChild(card);
      setTimeout(() => card.classList.add('visible'), 50);
      // Si cargó con fallback, reintenta en segundo plano
      if (game.isFallback) backgroundRetryGame(game.id, card);
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Carga de juegos extra (botón +)
  // ──────────────────────────────────────────────────────────────────────────
  async function loadExtraGames() {
    const extraIds = GAME_IDS.slice(2);
    const results = await Promise.all(extraIds.map(id => fetchBasicGameData(id)));

    results.forEach((game) => {
      if (!game) return;
      const existing = moreGamesContainer.querySelector(`.game-card[data-game-id="${game.id}"]`);
      if (existing) return;
      const card = renderGameCard(game);
      moreGamesContainer.appendChild(card);
      setTimeout(() => card.classList.add('visible'), 50);
      if (game.isFallback) backgroundRetryGame(game.id, card);
    });

    extraGamesLoaded = true;
    loadMoreBtn.textContent = '−';
    moreGamesContainer.classList.add('visible-content');
  }

  loadInitialGames();

  // ─── Botón + / − ─────────────────────────────────────────────────────────
  if (loadMoreBtn && moreGamesContainer) {
    if (GAME_IDS.length > 2) {
      loadMoreBtn.style.display = 'block';
      loadMoreBtn.addEventListener('click', async () => {
        const isVisible = moreGamesContainer.classList.contains('visible-content');

        if (!extraGamesLoaded) {
          loadMoreBtn.textContent = '...';
          loadMoreBtn.style.pointerEvents = 'none';
          loadMoreBtn.style.opacity = '0.6';

          await loadExtraGames();

          loadMoreBtn.style.pointerEvents = 'auto';
          loadMoreBtn.style.opacity = '1';
        } else {
          if (isVisible) {
            moreGamesContainer.classList.remove('visible-content');
            loadMoreBtn.textContent = '+';
          } else {
            moreGamesContainer.classList.add('visible-content');
            loadMoreBtn.textContent = '−';
          }
        }
      });
    } else {
      loadMoreBtn.style.display = 'none';
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Modal de juego
  // ──────────────────────────────────────────────────────────────────────────
  function handleCardClick(e) {
    const card = e.target.closest('.game-card');
    if (!card) return;
    const game = gameDatabase[card.dataset.gameId];
    if (!game) return;
    openGameModal(game, game.images);
  }

  gamesContainer.addEventListener('click', handleCardClick);
  if (moreGamesContainer) moreGamesContainer.addEventListener('click', handleCardClick);

  function createModalsIfNeeded() {
    if (document.getElementById('game-modal-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'game-modal-overlay';
    overlay.style.display = 'none';
    overlay.innerHTML = `
      <div id="game-modal" role="dialog" aria-modal="true" aria-labelledby="game-modal-title">
        <button id="game-modal-close" aria-label="Cerrar modal" class="modal-close-btn">&times;</button>
        <div class="modal-inner">
          <div class="modal-cover" aria-hidden="false">
            <button class="cover-nav prev" aria-label="Anterior">&#10094;</button>
            <div class="cover-viewport"></div>
            <button class="cover-nav next" aria-label="Siguiente">&#10095;</button>
            <div class="cover-thumbs" id="game-cover-thumbs" aria-hidden="false"></div>
          </div>
          <div class="modal-meta-row">
            <img class="modal-icon" id="game-modal-icon" src="" alt="Icono juego" />
            <div class="meta-text"><h3 id="game-modal-title"></h3></div>
          </div>
          <div id="game-modal-desc-container"></div>
          <div class="modal-actions">
            <button id="game-modal-play" class="button-primary">Play</button>
            <button id="game-modal-page" class="button-secondary">Ir a la página</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const confirm = document.createElement('div');
    confirm.id = 'game-confirm-overlay';
    confirm.style.display = 'none';
    confirm.innerHTML = `
      <div id="game-confirm" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <h3 id="confirm-title">Iniciar juego</h3>
        <p id="confirm-text">¿Deseas iniciar el juego ahora?</p>
        <div class="confirm-actions">
          <button id="confirm-cancel" class="button-secondary">Cancelar</button>
          <button id="confirm-ok" class="button-primary">Confirmar</button>
        </div>
      </div>
    `;
    document.body.appendChild(confirm);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeGameModal(); });
    confirm.addEventListener('click', (e) => { if (e.target === confirm) closeConfirm(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (isConfirmOpen()) closeConfirm();
        else closeGameModal();
      }
    });
  }

  createModalsIfNeeded();

  let currentModalImages = [];
  let currentModalIdx = 0;
  let modalIntervalId = null;

  function updateModalImages(images) {
    currentModalImages = images;
    currentModalIdx = 0;
    const thumbsWrap = document.querySelector('#game-cover-thumbs');
    thumbsWrap.innerHTML = '';
    images.forEach((src, i) => {
      const t = document.createElement('button');
      t.className = 'thumb-btn'; t.type = 'button'; t.dataset.index = String(i);
      t.innerHTML = `<img src="${src}" alt="thumb-${i}" />`;
      t.addEventListener('click', (ev) => { ev.stopPropagation(); goToIndex(i); resetInterval(); });
      thumbsWrap.appendChild(t);
    });
    goToIndex(0);
    startInterval();
  }

  function setCoverViewport(src) {
    const viewport = document.querySelector('.cover-viewport');
    if (!viewport) return;
    viewport.innerHTML = '';
    const el = document.createElement('img');
    el.src = src;
    el.style.cssText = 'width:100%;height:var(--cover-height);object-fit:cover;';
    viewport.appendChild(el);
  }

  function updateView() {
    const safeSrc = currentModalImages[currentModalIdx] || '';
    setCoverViewport(safeSrc);
    const thumbsWrap = document.querySelector('#game-cover-thumbs');
    thumbsWrap.querySelectorAll('.thumb-btn').forEach(b => b.classList.remove('active'));
    const active = thumbsWrap.querySelector(`.thumb-btn[data-index="${currentModalIdx}"]`);
    if (active) active.classList.add('active');
  }

  function next() { currentModalIdx = (currentModalIdx + 1) % currentModalImages.length; updateView(); }
  function prev() { currentModalIdx = (currentModalIdx - 1 + currentModalImages.length) % currentModalImages.length; updateView(); }
  function goToIndex(i) { currentModalIdx = Math.max(0, Math.min(currentModalImages.length - 1, i)); updateView(); }

  function startInterval() { stopInterval(); modalIntervalId = setInterval(() => next(), 6000); }
  function stopInterval() { if (modalIntervalId) { clearInterval(modalIntervalId); modalIntervalId = null; } }
  function resetInterval() { stopInterval(); startInterval(); }

  function openGameModal(game, tempImages) {
    if (memoryCleanupTimeout) clearTimeout(memoryCleanupTimeout);
    const ov = document.getElementById('game-modal-overlay');
    ov.querySelector('#game-modal-title').textContent = game.name || '';
    ov.querySelector('#game-modal-icon').src = game.iconUrl || '';

    const descContainer = ov.querySelector('#game-modal-desc-container');
    if (game.desc && game.desc.trim()) {
      descContainer.innerHTML = `
        <div style="background:rgba(0,0,0,0.4);padding:15px;border-radius:8px;font-size:clamp(0.9rem,3vw,1rem);line-height:1.5;color:rgba(255,255,255,0.9);overflow-y:auto;max-height:25vh;border:1px solid rgba(255,255,255,0.05);text-align:left;margin-top:15px;">
          <strong style="display:block;margin-bottom:8px;font-size:1.1em;color:#ffffff;">Descripción:</strong>
          <div style="white-space:pre-wrap;font-family:inherit;">${game.desc.trim()}</div>
        </div>`;
    } else {
      descContainer.innerHTML = '';
    }

    updateModalImages(tempImages);

    const prevBtn = ov.querySelector('.cover-nav.prev');
    const nextBtn = ov.querySelector('.cover-nav.next');
    prevBtn.replaceWith(prevBtn.cloneNode(true));
    nextBtn.replaceWith(nextBtn.cloneNode(true));
    ov.querySelector('.cover-nav.prev').addEventListener('click', (e) => { e.stopPropagation(); prev(); resetInterval(); });
    ov.querySelector('.cover-nav.next').addEventListener('click', (e) => { e.stopPropagation(); next(); resetInterval(); });

    const coverArea = ov.querySelector('.modal-cover');
    coverArea.addEventListener('mouseenter', stopInterval);
    coverArea.addEventListener('mouseleave', startInterval);

    const gamePageUrl   = `https://www.roblox.com/games/${game.id}`;
    const gameLaunchUrl = `https://www.roblox.com/games/start?placeId=${game.id}`;

    ['#game-modal-play','#game-modal-page','#game-modal-close'].forEach(sel => {
      const el = ov.querySelector(sel);
      el.replaceWith(el.cloneNode(true));
    });

    ov.querySelector('#game-modal-play').addEventListener('click', () => openConfirm(gameLaunchUrl));
    ov.querySelector('#game-modal-page').addEventListener('click', () => window.open(gamePageUrl, '_blank', 'noopener'));
    ov.querySelector('#game-modal-close').addEventListener('click', closeGameModal);

    ov.style.display = 'flex';
    document.documentElement.style.overflow = 'hidden';
  }

  function closeGameModal() {
    const ov = document.getElementById('game-modal-overlay');
    if (!ov) return;
    stopInterval();
    ov.style.display = 'none';
    document.documentElement.style.overflow = '';
    memoryCleanupTimeout = setTimeout(() => {
      const vp = document.querySelector('.cover-viewport');
      const th = document.getElementById('game-cover-thumbs');
      const dc = document.getElementById('game-modal-desc-container');
      if (vp) vp.innerHTML = '';
      if (th) th.innerHTML = '';
      if (dc) dc.innerHTML = '';
    }, 10000);
  }

  function openConfirm(url) {
    const conf = document.getElementById('game-confirm-overlay');
    if (!conf) return;
    conf.dataset.targetUrl = url || '';
    conf.style.display = 'flex';
    const ok     = conf.querySelector('#confirm-ok');
    const cancel = conf.querySelector('#confirm-cancel');
    ok.replaceWith(ok.cloneNode(true));
    cancel.replaceWith(cancel.cloneNode(true));
    conf.querySelector('#confirm-ok').addEventListener('click', () => {
      const target = conf.dataset.targetUrl;
      if (target) { try { window.open(target, '_blank', 'noopener'); } catch (e) {} }
      closeConfirm(); closeGameModal();
    });
    conf.querySelector('#confirm-cancel').addEventListener('click', closeConfirm);
  }

  function closeConfirm() {
    const conf = document.getElementById('game-confirm-overlay');
    if (conf) conf.style.display = 'none';
  }

  function isConfirmOpen() {
    const conf = document.getElementById('game-confirm-overlay');
    return conf && conf.style.display === 'flex';
  }
});

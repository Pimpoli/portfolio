// js/games.js - Automatizado, Paralelo y con Sistema Anti-Cuelgues

document.addEventListener('DOMContentLoaded', () => {
  const gamesContainer     = document.getElementById('games-container');
  const moreGamesContainer = document.getElementById('more-games');
  const loadMoreBtn        = document.getElementById('load-more-games');

  if (!gamesContainer) return;

  // ==========================================
  // CONFIGURACIÓN: IDs DE TUS JUEGOS
  // ==========================================
  const GAME_IDS = [
    16125269940,       // Anime Color Block Run
    71541333892738,    // Bloxidextro
    108138370693321,   // Avalanche of objects
    107726833867004    // 67 Red Light Green Light
  ];

  // SISTEMA DE RESPALDO: Si la API se cuelga, usaremos esto para que aparezcan sí o sí
  const FALLBACK_GAMES = {
    16125269940: { name: 'Anime Color Block Run', desc: 'Corre por bloques de colores en un mapa dinámico.' },
    71541333892738: { name: 'Bloxidextro', desc: 'Juego de Bloxidextro.' },
    108138370693321: { name: 'Avalanche of objects', desc: 'Sobrevive a la avalancha.' },
    107726833867004: { name: '67 Luz Roja Luz Verde', desc: 'Juego de supervivencia.' }
  };

  const gameDatabase = {};
  let memoryCleanupTimeout = null;

  // Cronómetro: Si la API tarda más de 3 segundos, se corta la conexión para no hacer esperar al usuario.
  async function fetchWithTimeout(url, options = {}, ms = 3000) {
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

  // 1. Extraer Datos Seguros
  async function fetchBasicGameData(placeId) {
    if (gameDatabase[placeId]) return gameDatabase[placeId]; 

    try {
      const uniRes = await fetchWithTimeout(`https://apis.roproxy.com/universes/v1/places/${placeId}/universe`);
      if (!uniRes.ok) throw new Error("Fallo en la conexión");
      const uniData = await uniRes.json();
      const universeId = uniData.universeId;

      // Pedimos todo a la vez para ahorrar tiempo
      const [infoRes, iconRes, thumbsRes] = await Promise.all([
          fetchWithTimeout(`https://games.roproxy.com/v1/games?universeIds=${universeId}`),
          fetchWithTimeout(`https://thumbnails.roproxy.com/v1/games/icons?universeIds=${universeId}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`),
          fetchWithTimeout(`https://thumbnails.roproxy.com/v1/games/multiget/thumbnails?universeIds=${universeId}&countPerUniverse=10&defaults=true&size=768x432&format=Png&isCircular=false`)
      ]);

      const infoData = await infoRes.json();
      const iconData = await iconRes.json();
      const thumbsData = await thumbsRes.json();

      const gameInfo = infoData.data[0];
      const iconUrl = iconData.data[0]?.imageUrl || 'img/MultiGameInc.webp';
      const thumbnails = thumbsData.data[0]?.thumbnails.map(t => t.imageUrl) || [];

      gameDatabase[placeId] = {
          id: placeId,
          universeId: universeId,
          name: gameInfo.name || FALLBACK_GAMES[placeId]?.name || 'Juego de Roblox',
          desc: gameInfo.description || FALLBACK_GAMES[placeId]?.desc || '',
          iconUrl: iconUrl,
          coverUrl: thumbnails.length > 0 ? thumbnails[0] : iconUrl, 
          images: thumbnails.length > 0 ? thumbnails : [iconUrl] 
      };

      return gameDatabase[placeId];

    } catch(e) {
        console.warn(`Roblox tardó demasiado o falló para el juego ${placeId}. Cargando Respaldo Rápido.`);
        const fb = FALLBACK_GAMES[placeId];
        gameDatabase[placeId] = {
            id: placeId,
            universeId: null,
            name: fb ? fb.name : `Juego ${placeId}`,
            desc: fb ? fb.desc : '',
            iconUrl: 'img/MultiGameInc.webp', 
            coverUrl: 'img/MultiGameInc.webp',
            images: ['img/MultiGameInc.webp']
        };
        return gameDatabase[placeId];
    }
  }

  // 2. Renderizar Tarjeta 
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
    coverImg.style.width = '100%'; coverImg.style.height = '100%'; coverImg.style.objectFit = 'cover';
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

  // 3. Lógica de Carga Inicial MEJORADA (Carga en Paralelo)
  let extraGamesLoaded = false;

  async function loadInitialGames() {
    // Tomamos los 2 primeros IDs y los cargamos AL MISMO TIEMPO
    const initialIds = GAME_IDS.slice(0, 2);
    const promises = initialIds.map(id => fetchBasicGameData(id));
    
    // Esperamos a que ambos terminen (o usen el respaldo) al mismo tiempo
    const games = await Promise.all(promises);

    // Los dibujamos en la pantalla
    games.forEach((game) => {
      if (game) {
        const card = renderGameCard(game);
        gamesContainer.appendChild(card);
        setTimeout(() => { card.classList.add('visible'); }, 50);
      }
    });
  }

  async function loadExtraGames() {
    let allLoaded = true; 
    for (let i = 2; i < GAME_IDS.length; i++) {
      const placeId = GAME_IDS[i];
      const existingCard = moreGamesContainer.querySelector(`.game-card[data-game-id="${placeId}"]`);

      if (!existingCard) {
        const game = await fetchBasicGameData(placeId);
        if (game) {
          const card = renderGameCard(game);
          moreGamesContainer.appendChild(card);
          setTimeout(() => { card.classList.add('visible'); }, 50);
        } else {
          allLoaded = false; 
        }
      }
    }
    if (allLoaded) extraGamesLoaded = true;
    loadMoreBtn.textContent = '−';
    moreGamesContainer.classList.add('visible-content');
  }

  loadInitialGames();

  // BOTÓN + 
  if (loadMoreBtn && moreGamesContainer) {
    if (GAME_IDS.length > 2) {
      loadMoreBtn.style.display = 'block'; 
      loadMoreBtn.addEventListener('click', async () => {
        const isVisible = moreGamesContainer.classList.contains('visible-content');

        if (!extraGamesLoaded) {
          loadMoreBtn.textContent = '...';
          loadMoreBtn.style.pointerEvents = 'none'; 
          loadMoreBtn.style.opacity = '0.6';

          await new Promise(resolve => setTimeout(resolve, 3000));
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

  // 4. Modal 
  function handleCardClick(e) {
    const card = e.target.closest('.game-card');
    if (!card) return;
    const placeId = card.dataset.gameId;
    const game = gameDatabase[placeId];
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
    el.src = src; el.style.width = '100%'; el.style.height = 'var(--cover-height)'; el.style.objectFit = 'cover';
    viewport.appendChild(el);
  }

  function updateView() {
    const safeSrc = currentModalImages[currentModalIdx] || '';
    setCoverViewport(safeSrc);
    const thumbsWrap = document.querySelector('#game-cover-thumbs');
    thumbsWrap.querySelectorAll('.thumb-btn').forEach((b) => b.classList.remove('active'));
    const active = thumbsWrap.querySelector(`.thumb-btn[data-index="${currentModalIdx}"]`);
    if (active) active.classList.add('active');
  }

  function next() { currentModalIdx = (currentModalIdx + 1) % currentModalImages.length; updateView(); }
  function prev() { currentModalIdx = (currentModalIdx - 1 + currentModalImages.length) % currentModalImages.length; updateView(); }
  function goToIndex(i) { currentModalIdx = Math.max(0, Math.min(currentModalImages.length - 1, i)); updateView(); }

  function startInterval() {
    stopInterval();
    modalIntervalId = setInterval(() => next(), 6000);
  }
  function stopInterval() {
    if (modalIntervalId) { clearInterval(modalIntervalId); modalIntervalId = null; }
  }
  function resetInterval() { stopInterval(); startInterval(); }

  function openGameModal(game, tempImages) {
    if (memoryCleanupTimeout) clearTimeout(memoryCleanupTimeout); 
    const ov = document.getElementById('game-modal-overlay');
    const titleEl = ov.querySelector('#game-modal-title');
    const iconEl = ov.querySelector('#game-modal-icon');
    const descContainer = ov.querySelector('#game-modal-desc-container');

    titleEl.textContent = game.name || '';
    iconEl.src = game.iconUrl || '';

    if (game.desc && game.desc.trim() !== '') {
      descContainer.innerHTML = `
        <div style="background: rgba(0, 0, 0, 0.4); padding: 15px; border-radius: 8px; font-size: clamp(0.9rem, 3vw, 1rem); line-height: 1.5; color: rgba(255,255,255,0.9); overflow-y: auto; max-height: 25vh; border: 1px solid rgba(255, 255, 255, 0.05); text-align: left; margin-top: 15px;">
          <strong style="display: block; margin-bottom: 8px; font-size: 1.1em; color: #ffffff;">Descripción:</strong>
          <div style="white-space: pre-wrap; font-family: inherit;">${game.desc.trim()}</div>
        </div>
      `;
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

    const gameUrl = `https://www.roblox.com/games/${game.id}`;
    const playBtn = ov.querySelector('#game-modal-play');
    const pageBtn = ov.querySelector('#game-modal-page');
    const closeBtn = ov.querySelector('#game-modal-close');

    playBtn.replaceWith(playBtn.cloneNode(true));
    pageBtn.replaceWith(pageBtn.cloneNode(true));
    closeBtn.replaceWith(closeBtn.cloneNode(true));

    ov.querySelector('#game-modal-play').addEventListener('click', () => openConfirm(gameUrl));
    ov.querySelector('#game-modal-page').addEventListener('click', () => window.open(gameUrl, '_blank', 'noopener'));
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
      document.querySelector('.cover-viewport').innerHTML = '';
      document.getElementById('game-cover-thumbs').innerHTML = '';
      document.getElementById('game-modal-desc-container').innerHTML = '';
    }, 10000);
  }

  function openConfirm(url) {
    const conf = document.getElementById('game-confirm-overlay');
    if (!conf) return;
    conf.dataset.targetUrl = url || '';
    conf.style.display = 'flex';
    const ok = conf.querySelector('#confirm-ok');
    const cancel = conf.querySelector('#confirm-cancel');
    ok.replaceWith(ok.cloneNode(true));
    cancel.replaceWith(cancel.cloneNode(true));
    conf.querySelector('#confirm-ok').addEventListener('click', () => {
      const target = conf.dataset.targetUrl;
      if (target) { try { window.open(target, '_blank', 'noopener'); } catch(e){} }
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

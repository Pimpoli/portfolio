// js/games.js - Automatizado y Optimizado para Ahorro de Recursos (Portadas Reales)

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

  // Base de datos local
  const gameDatabase = {};
  let memoryCleanupTimeout = null;

  // 1. Extraer Datos (Nombre, Desc, Icono y la URL de la Portada Principal)
  async function fetchBasicGameData(placeId) {
    if (gameDatabase[placeId]) return gameDatabase[placeId]; 

    try {
      const uniRes = await fetch(`https://apis.roproxy.com/universes/v1/places/${placeId}/universe`);
      const uniData = await uniRes.json();
      const universeId = uniData.universeId;
      if (!universeId) throw new Error("No se encontró el juego.");

      // Obtenemos Información, Icono y Portadas (Solo descargamos el texto/URL, no la imagen pesada aún)
      const [infoRes, iconRes, thumbsRes] = await Promise.all([
          fetch(`https://games.roproxy.com/v1/games?universeIds=${universeId}`),
          fetch(`https://thumbnails.roproxy.com/v1/games/icons?universeIds=${universeId}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`),
          fetch(`https://thumbnails.roproxy.com/v1/games/multiget/thumbnails?universeIds=${universeId}&countPerUniverse=10&defaults=true&size=768x432&format=Png&isCircular=false`)
      ]);

      const infoData = await infoRes.json();
      const iconData = await iconRes.json();
      const thumbsData = await thumbsRes.json();

      const gameInfo = infoData.data[0];
      const iconUrl = iconData.data[0]?.imageUrl || 'img/MultiGameInc.webp';
      const thumbnails = thumbsData.data[0]?.thumbnails.map(t => t.imageUrl) || [];

      // Guardamos todo en la base de datos local
      gameDatabase[placeId] = {
          id: placeId,
          universeId: universeId,
          name: gameInfo.name,
          desc: gameInfo.description || '',
          iconUrl: iconUrl,
          coverUrl: thumbnails.length > 0 ? thumbnails[0] : iconUrl, // SOLUCIÓN: Usamos la portada real aquí
          images: thumbnails.length > 0 ? thumbnails : [iconUrl] // Guardamos las URLs para el modal
      };

      return gameDatabase[placeId];
    } catch(e) {
        console.error(`Error cargando el juego ${placeId}:`, e);
        return null; 
    }
  }

  // 2. Renderizar Tarjeta (Ahora usa coverUrl para el fondo)
  function renderGameCard(game) {
    const card = document.createElement('div');
    card.className = 'game-card fade-in';
    card.dataset.gameId = String(game.id);

    const inner = document.createElement('div');
    inner.className = 'card-inner';

    const gi = document.createElement('div');
    gi.className = 'game-icon';
    const gimg = document.createElement('img');
    gimg.src = game.iconUrl; // El icono cuadradito pequeño
    gimg.alt = game.name + ' icon';
    gi.appendChild(gimg);

    const gc = document.createElement('div');
    gc.className = 'game-cover';
    const coverImg = document.createElement('img');
    coverImg.src = game.coverUrl; // SOLUCIÓN: Imagen ancha real para el fondo de la tarjeta
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

  // 3. Lógica de Carga Perezosa (+ / -)
  let extraGamesLoaded = false;

  async function loadInitialGames() {
    for (let i = 0; i < 2; i++) {
      if (GAME_IDS[i]) {
        const game = await fetchBasicGameData(GAME_IDS[i]);
        if (game) {
          const card = renderGameCard(game);
          gamesContainer.appendChild(card);
          setTimeout(() => { card.classList.add('visible'); }, 50);
        }
      }
    }
  }

  async function loadExtraGames() {
    if (extraGamesLoaded) return; 
    
    const originalText = loadMoreBtn.textContent;
    loadMoreBtn.textContent = '...';

    for (let i = 2; i < GAME_IDS.length; i++) {
      const game = await fetchBasicGameData(GAME_IDS[i]);
      if (game) {
        const card = renderGameCard(game);
        moreGamesContainer.appendChild(card);
        setTimeout(() => { card.classList.add('visible'); }, 50);
      }
    }
    extraGamesLoaded = true;
    loadMoreBtn.textContent = '−';
    moreGamesContainer.classList.add('visible-content');
  }

  loadInitialGames();

  if (loadMoreBtn && moreGamesContainer) {
    if (GAME_IDS.length > 2) {
      loadMoreBtn.style.display = 'block'; 
      loadMoreBtn.addEventListener('click', async () => {
        if (!extraGamesLoaded) {
          await loadExtraGames();
        } else {
          const isVisible = moreGamesContainer.classList.contains('visible-content');
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

  // 4. Delegación de clics: Al tocar una tarjeta abrimos el modal
  function handleCardClick(e) {
    const card = e.target.closest('.game-card');
    if (!card) return;
    
    const placeId = card.dataset.gameId;
    const game = gameDatabase[placeId];
    if (!game) return;

    // Abrimos el modal con los datos y la lista de imágenes (El navegador recién las descarga aquí)
    openGameModal(game, game.images); 
  }
  
  gamesContainer.addEventListener('click', handleCardClick);
  if (moreGamesContainer) moreGamesContainer.addEventListener('click', handleCardClick);

  // 5. Creación y Manejo del Modal (Diseño Oscuro)
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
            <div class="meta-text">
              <h3 id="game-modal-title"></h3>
            </div>
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
      t.addEventListener('click', (ev) => {
        ev.stopPropagation(); goToIndex(i); resetInterval();
      });
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
      const textoLimpio = game.desc.trim();
      descContainer.innerHTML = `
        <div style="background: rgba(0, 0, 0, 0.4); padding: 15px; border-radius: 8px; font-size: clamp(0.9rem, 3vw, 1rem); line-height: 1.5; color: rgba(255,255,255,0.9); overflow-y: auto; max-height: 25vh; border: 1px solid rgba(255, 255, 255, 0.05); text-align: left; margin-top: 15px;">
          <strong style="display: block; margin-bottom: 8px; font-size: 1.1em; color: #ffffff;">Descripción:</strong>
          <div style="white-space: pre-wrap; font-family: inherit;">${textoLimpio}</div>
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

    // LIMPIEZA DE RAM (10 SEGUNDOS)
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
      if (target) {
        try { window.open(target, '_blank', 'noopener'); } catch(e){}
      }
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

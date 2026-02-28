// js/games.js - Automatizado con la API de Roblox

document.addEventListener('DOMContentLoaded', async () => {
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

  // 1. Extraer toda la información de Roblox Automáticamente
  async function fetchGameData(placeId) {
    try {
      const cacheBuster = `&_t=${Date.now()}`; 
      
      // A) Obtener el Universe ID
      const uniRes = await fetch(`https://corsproxy.io/?${encodeURIComponent(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`)}`);
      const uniData = await uniRes.json();
      const universeId = uniData.universeId;
      if (!universeId) throw new Error("No se encontró el juego.");

      // B) Obtener Nombre, Descripción, Icono y Portadas
      const [infoRes, iconRes, thumbsRes] = await Promise.all([
          fetch(`https://corsproxy.io/?${encodeURIComponent(`https://games.roblox.com/v1/games?universeIds=${universeId}${cacheBuster}`)}`),
          fetch(`https://corsproxy.io/?${encodeURIComponent(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false${cacheBuster}`)}`),
          fetch(`https://corsproxy.io/?${encodeURIComponent(`https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${universeId}&countPerUniverse=10&defaults=true&size=768x432&format=Png&isCircular=false${cacheBuster}`)}`)
      ]);

      const infoData = await infoRes.json();
      const iconData = await iconRes.json();
      const thumbsData = await thumbsRes.json();

      const gameInfo = infoData.data[0];
      const iconUrl = iconData.data[0]?.imageUrl || 'img/MultiGameInc.webp';
      const thumbnails = thumbsData.data[0]?.thumbnails.map(t => t.imageUrl) || [];

      return {
          id: placeId,
          name: gameInfo.name,
          desc: gameInfo.description || '',
          iconUrl: iconUrl,
          coverUrl: thumbnails.length > 0 ? thumbnails[0] : iconUrl,
          images: thumbnails.length > 0 ? thumbnails : [iconUrl]
      };
    } catch(e) {
        console.error(`Error cargando el juego ${placeId}:`, e);
        return null; 
    }
  }

  function isVideo(src) {
    return /\.(mp4|webm|ogg)(\?.*)?$/i.test(src);
  }

  function createCoverElement(src, cssClass = '') {
    if (isVideo(String(src))) {
      const v = document.createElement('video');
      v.src = src; v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
      v.setAttribute('loop', ''); v.autoplay = true; v.className = cssClass; v.preload = 'metadata';
      v.addEventListener('error', () => {}); 
      return v;
    } else {
      const i = document.createElement('img');
      i.src = src; i.alt = 'cover'; i.className = cssClass;
      i.onerror = () => { i.src = 'img/MultiGameInc.webp'; };
      return i;
    }
  }

  // 2. Renderizar Tarjeta de Juego
  function renderGameCard(game) {
    const card = document.createElement('div');
    card.className = 'game-card fade-in';
    card.dataset.gameId = String(game.id);
    card.dataset.gameUrl = `https://www.roblox.com/games/${game.id}`;
    card.dataset.gameName = game.name;
    card.dataset.gameDesc = game.desc || '';
    card.dataset.gameIcon = game.iconUrl;
    card.dataset.gameImages = JSON.stringify(game.images || [game.coverUrl]);

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
    const coverEl = createCoverElement(game.coverUrl);
    coverEl.style.width = '100%'; coverEl.style.height = '100%'; coverEl.style.objectFit = 'cover';
    gc.appendChild(coverEl);

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

  // 3. Obtener datos de Roblox y Distribuir en las cajas
  const loadedGames = [];
  
  // Descargamos los juegos uno por uno para no saturar la API
  for (const id of GAME_IDS) {
    const data = await fetchGameData(id);
    if (data) loadedGames.push(data);
  }

  // Repartimos los juegos: Los primeros 2 a la vista, el resto ocultos
  loadedGames.forEach((game, i) => {
    const card = renderGameCard(game);
    
    if (i < 2) {
      gamesContainer.appendChild(card);
    } else if (moreGamesContainer) {
      moreGamesContainer.appendChild(card);
    }

    // Forzar la animación de entrada
    setTimeout(() => { card.classList.add('visible'); }, 50);
  });

  // Lógica del Botón "+"
  if (loadMoreBtn && moreGamesContainer) {
    if (loadedGames.length > 2) {
      loadMoreBtn.style.display = 'block'; 
      // Clonar el botón para limpiar eventos viejos y evitar duplicados
      const newBtn = loadMoreBtn.cloneNode(true);
      loadMoreBtn.parentNode.replaceChild(newBtn, loadMoreBtn);
      
      newBtn.addEventListener('click', () => {
        const isVisible = moreGamesContainer.classList.contains('visible-content');
        if (isVisible) {
          moreGamesContainer.classList.remove('visible-content');
          newBtn.textContent = '+';
        } else {
          moreGamesContainer.classList.add('visible-content');
          newBtn.textContent = '−';
        }
      });
    } else {
      loadMoreBtn.style.display = 'none'; 
    }
  }

  // 4. Delegación de clics para abrir el Modal
  function handleCardClick(e) {
    const card = e.target.closest('.game-card');
    if (!card) return;
    const images = JSON.parse(card.dataset.gameImages || '[]');
    openGameModal({
      id: card.dataset.gameId,
      url: card.dataset.gameUrl,
      name: card.dataset.gameName,
      desc: card.dataset.gameDesc,
      icon: card.dataset.gameIcon,
      images: images.length ? images : [card.querySelector('.game-cover img')?.src || '']
    });
  }
  
  gamesContainer.addEventListener('click', handleCardClick);
  if (moreGamesContainer) moreGamesContainer.addEventListener('click', handleCardClick);

  // 5. Creación y Manejo del Modal (Ventana Flotante)
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

  function setCoverViewport(ov, src) {
    const viewport = ov.querySelector('.cover-viewport');
    if (!viewport) return;
    viewport.innerHTML = '';
    const el = createCoverElement(src, '');
    el.style.width = '100%'; el.style.height = 'var(--cover-height)'; el.style.objectFit = 'cover';
    viewport.appendChild(el);
  }

  function openGameModal(data) {
    const ov = document.getElementById('game-modal-overlay');
    if (!ov) return;

    const titleEl = ov.querySelector('#game-modal-title');
    const iconEl = ov.querySelector('#game-modal-icon');
    const thumbsWrap = ov.querySelector('#game-cover-thumbs');
    const prevBtn = ov.querySelector('.cover-nav.prev');
    const nextBtn = ov.querySelector('.cover-nav.next');
    const playBtn = ov.querySelector('#game-modal-play');
    const pageBtn = ov.querySelector('#game-modal-page');
    const closeBtn = ov.querySelector('#game-modal-close');
    const descContainer = ov.querySelector('#game-modal-desc-container');

    titleEl.textContent = data.name || '';
    iconEl.src = data.icon || '';

    // Inyección de la caja de descripción oscura (Igual que en Proyectos)
    if (data.desc && data.desc.trim() !== '') {
      const textoLimpio = data.desc.trim();
      descContainer.innerHTML = `
        <div style="background: rgba(0, 0, 0, 0.4); padding: 15px; border-radius: 8px; font-size: clamp(0.9rem, 3vw, 1rem); line-height: 1.5; color: rgba(255,255,255,0.9); overflow-y: auto; max-height: 25vh; border: 1px solid rgba(255, 255, 255, 0.05); text-align: left; margin-top: 15px;">
          <strong style="display: block; margin-bottom: 8px; font-size: 1.1em; color: #ffffff;">Descripción:</strong>
          <div style="white-space: pre-wrap; font-family: inherit;">${textoLimpio}</div>
        </div>
      `;
    } else {
      descContainer.innerHTML = '';
    }

    const images = Array.isArray(data.images) && data.images.length ? data.images.slice() : [data.images || data.cover || ''];
    let idx = 0;
    let intervalId = null;
    const AUTO_MS = 6000;

    thumbsWrap.innerHTML = '';
    images.forEach((src, i) => {
      const t = document.createElement('button');
      t.className = 'thumb-btn'; t.type = 'button'; t.dataset.index = String(i);
      
      if (isVideo(src)) {
        const tv = document.createElement('video');
        tv.src = src; tv.muted = true; tv.playsInline = true; tv.preload = 'metadata';
        tv.width = 84; tv.height = 48; tv.style.objectFit = 'cover';
        t.appendChild(tv);
      } else {
        t.innerHTML = `<img src="${src}" alt="thumb-${i}" />`;
      }
      t.addEventListener('click', (ev) => {
        ev.stopPropagation(); goToIndex(i); resetInterval();
      });
      thumbsWrap.appendChild(t);
    });

    function updateView() {
      const safeSrc = images[idx] || '';
      setCoverViewport(ov, safeSrc);
      thumbsWrap.querySelectorAll('.thumb-btn').forEach((b) => b.classList.remove('active'));
      const active = thumbsWrap.querySelector(`.thumb-btn[data-index="${idx}"]`);
      if (active) active.classList.add('active');
    }
    function next() { idx = (idx + 1) % images.length; updateView(); }
    function prev() { idx = (idx - 1 + images.length) % images.length; updateView(); }
    function goToIndex(i) { idx = Math.max(0, Math.min(images.length - 1, i)); updateView(); }

    prevBtn.replaceWith(prevBtn.cloneNode(true));
    nextBtn.replaceWith(nextBtn.cloneNode(true));
    const prev2 = ov.querySelector('.cover-nav.prev');
    const next2 = ov.querySelector('.cover-nav.next');
    prev2.addEventListener('click', (e) => { e.stopPropagation(); prev(); resetInterval(); });
    next2.addEventListener('click', (e) => { e.stopPropagation(); next(); resetInterval(); });

    function startInterval() {
      stopInterval();
      intervalId = setInterval(() => next(), AUTO_MS);
      ov.dataset.carouselInterval = String(intervalId);
    }
    function stopInterval() {
      if (intervalId) { clearInterval(intervalId); intervalId = null; delete ov.dataset.carouselInterval; }
    }
    function resetInterval() { stopInterval(); startInterval(); }

    const coverArea = ov.querySelector('.modal-cover');
    function onCoverEnter() { stopInterval(); }
    function onCoverLeave() { startInterval(); }
    coverArea.addEventListener('mouseenter', onCoverEnter);
    coverArea.addEventListener('mouseleave', onCoverLeave);

    goToIndex(0);
    startInterval();

    function onPlay() { openConfirm(data.url); }
    function onPage() { window.open(data.url, '_blank', 'noopener'); }
    function onClose() { closeGameModal(); }

    playBtn.replaceWith(playBtn.cloneNode(true));
    pageBtn.replaceWith(pageBtn.cloneNode(true));
    closeBtn.replaceWith(closeBtn.cloneNode(true));

    const play2 = ov.querySelector('#game-modal-play');
    const page2 = ov.querySelector('#game-modal-page');
    const close2 = ov.querySelector('#game-modal-close');

    play2.addEventListener('click', onPlay);
    page2.addEventListener('click', onPage);
    close2.addEventListener('click', onClose);

    ov.style.display = 'flex';
    document.documentElement.style.overflow = 'hidden';

    ov._cleanupCarousel = () => {
      stopInterval();
      coverArea.removeEventListener('mouseenter', onCoverEnter);
      coverArea.removeEventListener('mouseleave', onCoverLeave);
      document.documentElement.style.overflow = '';
    };
  }

  function closeGameModal() {
    const ov = document.getElementById('game-modal-overlay');
    if (!ov) return;
    if (ov._cleanupCarousel) { try { ov._cleanupCarousel(); } catch (e) {} delete ov._cleanupCarousel; }
    ov.style.display = 'none';
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

    const ok2 = conf.querySelector('#confirm-ok');
    const cancel2 = conf.querySelector('#confirm-cancel');

    ok2.addEventListener('click', () => {
      const target = conf.dataset.targetUrl;
      if (target) {
        try { window.open(target, '_blank', 'noopener'); } catch(e){}
        try {
          const match = String(target).match(/\/games\/(\d+)/);
          const gameId = match ? match[1] : null;
          if (gameId) {
            const ts = Date.now();
            const launchProto = `roblox-player:1+launchmode:play+gameinfo:${gameId}+launchtime:${ts}+placelauncherurl:${encodeURIComponent(target)}`;
            const a = document.createElement('a');
            a.href = launchProto; a.style.display = 'none'; document.body.appendChild(a);
            a.click();
            setTimeout(() => { try { document.body.removeChild(a); } catch(e){} }, 1000);
            setTimeout(() => { try { window.location.href = launchProto; } catch(e){} }, 900);
          }
        } catch (err) {}
      }
      closeConfirm(); closeGameModal();
    });
    cancel2.addEventListener('click', () => closeConfirm());
  }

  function closeConfirm() {
    const conf = document.getElementById('game-confirm-overlay');
    if (!conf) return;
    conf.style.display = 'none'; delete conf.dataset.targetUrl;
  }

  function isConfirmOpen() {
    const conf = document.getElementById('game-confirm-overlay');
    return conf && conf.style.display === 'flex';
  }
});

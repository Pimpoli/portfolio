// games.js
// Renderiza tarjetas desde el array GAMES y abre modal con galería/carousel.
// Para añadir/editar juegos: modifica el array GAMES abajo (id, name, iconUrl, coverUrl, images[], desc).
// Modal: portada arriba, icono solapado (con separación), título, descripción scrollable.
// Auto-advance cada 6000ms; pausa al hover; prev/next botones (circular).
// Play -> confirmación; Ir a la página -> abre URL.
// Guardado/restauración de scroll para evitar saltos al abrir/cerrar modal.

document.addEventListener('DOMContentLoaded', () => {
  const gamesContainer     = document.getElementById('games-container');
  const loadMoreBtn        = document.getElementById('load-more-games');
  const moreGamesContainer = document.getElementById('more-games');

  // ------------------------
  // CONFIGURACIÓN: AÑADE tus juegos aquí
  // ------------------------
  const GAMES = [
    {
      id: 16125269940,
      name: 'Anime Color Block Run',
      iconUrl: 'img/AnimeColor_icon.webp',
      coverUrl: 'img/AnimeColor_Cover.webp',
      images: [
        'img/AnimeColor_Cover.webp',
        'img/NextGame_Cover.webp',
        'img/Sea.webp'.replace('.webm', '.webp') // ejemplo
      ],
      desc: 'Corre por bloques de colores en un mapa dinámico. Actualizaciones semanales. ¡Nuevas pistas y mejoras!'
    },
    {
      id: 71541333892738,
      name: 'Bloxidextro',
      iconUrl: 'img/Bloxidextro_icon.webp',
      coverUrl: 'img/Bloxidextro_Cover.webp',
      images: [
        'img/Bloxidextro_Cover.webp',
        'img/Bloxidextro_icon.webp'
      ],
      desc: 'Juego experimental con menú personalizado y mecánicas únicas. Optimizado para móvil y PC.'
    },
    {
      id: 17166282321,
      name: 'Next Game Soon',
      iconUrl: 'img/NextGame_icon.webp',
      coverUrl: 'img/NextGame_Cover.webp',
      images: [
        'img/NextGame_Cover.webp'
      ],
      desc: 'Próximo juego — en desarrollo. Estad atentos a actualizaciones.'
    }
  ];

  // ------------------------
  // Creación de modales dinámicamente (one-time)
  // ------------------------
  function createModals() {
    if (!document.getElementById('game-modal-overlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'game-modal-overlay';
      overlay.style.display = 'none';
      overlay.innerHTML = `
        <div id="game-modal" role="dialog" aria-modal="true" aria-labelledby="game-modal-title">
          <button id="game-modal-close" aria-label="Cerrar modal" class="modal-close-btn">&times;</button>
          <div class="modal-inner">
            <div class="modal-cover" aria-hidden="false">
              <button class="cover-nav prev" aria-label="Anterior">&#10094;</button>
              <div class="cover-viewport">
                <img id="game-modal-current" src="" alt="Cover" />
                <div class="cover-counter" id="game-cover-counter" aria-hidden="true"></div>
              </div>
              <button class="cover-nav next" aria-label="Siguiente">&#10095;</button>
              <div class="cover-thumbs" id="game-cover-thumbs" aria-hidden="false"></div>
            </div>

            <div class="modal-meta-row">
              <img class="modal-icon" id="game-modal-icon" src="" alt="Icono juego" />
              <div class="meta-text">
                <h3 id="game-modal-title"></h3>
              </div>
            </div>

            <div class="modal-desc" id="game-modal-desc" tabindex="0"></div>

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

      // Cerrar al clicar fuera
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeGameModal();
      });
      confirm.addEventListener('click', (e) => {
        if (e.target === confirm) closeConfirm();
      });

      // ESC para cerrar
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          if (isConfirmOpen()) closeConfirm();
          else closeGameModal();
        }
      });
    }
  }
  createModals();

  // ------------------------
  // Render cards
  // ------------------------
  function renderGameCard(game) {
    const card = document.createElement('div');
    card.className = 'game-card fade-in';
    card.dataset.gameId = String(game.id);
    card.dataset.gameUrl = `https://www.roblox.com/games/${game.id}`;
    card.dataset.gameName = game.name;
    card.dataset.gameDesc = game.desc || '';
    card.dataset.gameIcon = game.iconUrl;
    // JSON stringify images para fácil lectura
    card.dataset.gameImages = JSON.stringify(game.images || [game.coverUrl]);

    card.innerHTML = `
      <div class="card-inner">
        <div class="game-icon"><img src="${game.iconUrl}" alt="${game.name} icon" /></div>
        <div class="game-cover"><img src="${game.coverUrl}" alt="${game.name} cover" /></div>
      </div>
      <div class="game-title">${game.name}</div>
    `;
    card.style.cursor = 'pointer';
    return card;
  }

  if (gamesContainer) {
    const initial = GAMES.slice(0, 2);
    initial.forEach(game => gamesContainer.appendChild(renderGameCard(game)));
  }
  if (moreGamesContainer) {
    const extra = GAMES.slice(2);
    extra.forEach(game => moreGamesContainer.appendChild(renderGameCard(game)));
  }

  // Toggle more-games
  if (loadMoreBtn && moreGamesContainer) {
    loadMoreBtn.addEventListener('click', () => {
      const showing = moreGamesContainer.classList.toggle('visible-content');
      loadMoreBtn.textContent = showing ? '−' : '+';
    });
  }

  // ------------------------
  // Delegación: abrir modal
  // ------------------------
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
      images: images.length ? images : [card.dataset.gameCover]
    });
  }
  if (gamesContainer) gamesContainer.addEventListener('click', handleCardClick);
  if (moreGamesContainer) moreGamesContainer.addEventListener('click', handleCardClick);

  // ------------------------
  // Modal & carousel logic
  // ------------------------
  const overlayEl = () => document.getElementById('game-modal-overlay');
  const confirmEl = () => document.getElementById('game-confirm-overlay');

  let savedScroll = 0;

  function lockScroll() {
    savedScroll = window.scrollY || window.pageYOffset || 0;
    document.documentElement.style.scrollBehavior = 'auto';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${savedScroll}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.documentElement.classList.add('modal-open');
    document.body.classList.add('modal-open');
  }

  function unlockScroll() {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.documentElement.classList.remove('modal-open');
    document.body.classList.remove('modal-open');
    // restore scroll
    window.scrollTo(0, savedScroll);
    // restore smooth behaviour if desired
    document.documentElement.style.scrollBehavior = '';
  }

  function openGameModal(data) {
    const ov = overlayEl();
    if (!ov) return;

    // elements
    const titleEl = ov.querySelector('#game-modal-title');
    const descEl = ov.querySelector('#game-modal-desc');
    const iconEl = ov.querySelector('#game-modal-icon');
    const currentImg = ov.querySelector('#game-modal-current');
    const thumbsWrap = ov.querySelector('#game-cover-thumbs');
    const prevBtn = ov.querySelector('.cover-nav.prev');
    const nextBtn = ov.querySelector('.cover-nav.next');
    const playBtn = ov.querySelector('#game-modal-play');
    const pageBtn = ov.querySelector('#game-modal-page');
    const closeBtn = ov.querySelector('#game-modal-close');
    const counterEl = ov.querySelector('#game-cover-counter');

    // populate meta
    titleEl.textContent = data.name || '';
    descEl.textContent = data.desc || '';
    iconEl.src = data.icon || '';
    iconEl.alt = (data.name || 'Game') + ' icon';

    // gallery images
    const images = Array.isArray(data.images) && data.images.length ? data.images.slice() : [data.images || data.cover || ''];
    let idx = 0;
    let intervalId = null;
    const AUTO_MS = 6000;

    // build thumbs
    thumbsWrap.innerHTML = '';
    images.forEach((src, i) => {
      const t = document.createElement('button');
      t.className = 'thumb-btn';
      t.type = 'button';
      t.dataset.index = String(i);
      t.innerHTML = `<img src="${src}" alt="thumb-${i}" />`;
      t.addEventListener('click', (ev) => {
        ev.stopPropagation();
        goToIndex(i);
        resetInterval();
      });
      thumbsWrap.appendChild(t);
    });

    function updateView() {
      const safeSrc = images[idx] || '';
      currentImg.src = safeSrc;
      // update active thumb
      thumbsWrap.querySelectorAll('.thumb-btn').forEach((b) => b.classList.remove('active'));
      const active = thumbsWrap.querySelector(`.thumb-btn[data-index="${idx}"]`);
      if (active) active.classList.add('active');
      // update counter (1-based)
      if (counterEl) counterEl.textContent = `${idx + 1} / ${images.length}`;
    }
    function next() { idx = (idx + 1) % images.length; updateView(); }
    function prev() { idx = (idx - 1 + images.length) % images.length; updateView(); }
    function goToIndex(i) { idx = Math.max(0, Math.min(images.length - 1, i)); updateView(); }

    // wire prev/next (remove old listeners safely)
    prevBtn.replaceWith(prevBtn.cloneNode(true));
    nextBtn.replaceWith(nextBtn.cloneNode(true));
    const prev2 = ov.querySelector('.cover-nav.prev');
    const next2 = ov.querySelector('.cover-nav.next');
    prev2.addEventListener('click', (e) => { e.stopPropagation(); prev(); resetInterval(); });
    next2.addEventListener('click', (e) => { e.stopPropagation(); next(); resetInterval(); });

    // auto advance control
    function startInterval() {
      stopInterval();
      intervalId = setInterval(() => next(), AUTO_MS);
      ov.dataset.carouselInterval = String(intervalId);
    }
    function stopInterval() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        delete ov.dataset.carouselInterval;
      }
    }
    function resetInterval() { stopInterval(); startInterval(); }

    // pause on hover
    const coverArea = ov.querySelector('.modal-cover');
    // To avoid duplicate closures, we attach named functions
    function onCoverEnter() { stopInterval(); }
    function onCoverLeave() { startInterval(); }
    coverArea.addEventListener('mouseenter', onCoverEnter);
    coverArea.addEventListener('mouseleave', onCoverLeave);

    // initial view & start
    goToIndex(0);
    startInterval();

    // Play / Page / Close handlers
    function onPlay() { openConfirm(data.url); }
    function onPage() { window.open(data.url, '_blank', 'noopener'); }
    function onClose() { closeGameModal(); }

    // replace nodes to remove old listeners
    playBtn.replaceWith(playBtn.cloneNode(true));
    pageBtn.replaceWith(pageBtn.cloneNode(true));
    closeBtn.replaceWith(closeBtn.cloneNode(true));

    const play2 = ov.querySelector('#game-modal-play');
    const page2 = ov.querySelector('#game-modal-page');
    const close2 = ov.querySelector('#game-modal-close');

    play2.addEventListener('click', onPlay);
    page2.addEventListener('click', onPage);
    close2.addEventListener('click', onClose);

    // show modal & lock scroll (store scroll)
    ov.style.display = 'flex';
    lockScroll();

    // cleanup hook to remove listeners & interval when closed
    ov._cleanupCarousel = () => {
      stopInterval();
      coverArea.removeEventListener('mouseenter', onCoverEnter);
      coverArea.removeEventListener('mouseleave', onCoverLeave);
      // remove counter text
      if (counterEl) counterEl.textContent = '';
    };
  }

  function closeGameModal() {
    const ov = overlayEl();
    if (!ov) return;
    // cleanup
    if (ov._cleanupCarousel) {
      try { ov._cleanupCarousel(); } catch (e) { /* ignore */ }
      delete ov._cleanupCarousel;
    }
    ov.style.display = 'none';
    unlockScroll();
    // also close confirm if open
    closeConfirm();
  }

  // ------------------------
  // Confirm dialog (Play)
  // ------------------------
  function openConfirm(url) {
    const conf = confirmEl();
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
      if (target) window.open(target, '_blank', 'noopener');
      closeConfirm();
      closeGameModal();
    });
    cancel2.addEventListener('click', () => closeConfirm());
  }

  function closeConfirm() {
    const conf = confirmEl();
    if (!conf) return;
    conf.style.display = 'none';
    delete conf.dataset.targetUrl;
  }

  function isConfirmOpen() {
    const conf = confirmEl();
    return conf && conf.style.display === 'flex';
  }

});

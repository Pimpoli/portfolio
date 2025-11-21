// games.js - render cards + modal + soporte video en covers
document.addEventListener('DOMContentLoaded', () => {
  const gamesContainer     = document.getElementById('games-container');
  const loadMoreBtn        = document.getElementById('load-more-games');
  const moreGamesContainer = document.getElementById('more-games');

  const GAMES = [
    {
      id: 16125269940,
      name: 'Anime Color Block Run',
      iconUrl: 'img/AnimeColor_icon.webp',
      coverUrl: 'img/AnimeColor_Cover.webp',
      images: [
        'img/AnimeColor_Cover.webp',
        'img/NextGame_Cover.webp',
        'video/Sea.webm'
      ],
      desc: 'Corre por bloques de colores en un mapa dinámico.'
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
      desc: 'Juego experimental con menú personalizado.'
    },
    {
      id: 108138370693321,
      name: 'Avalancha de Objetos',
      iconUrl: 'img/IconAvanlachadeobjectos.webp',
      coverUrl: 'img/FondoDeAvalanchaDeObjectos.webp',
      images: [
        'img/FondoDeAvalanchaDeObjectos.webp',
        'img/FondoAvalancha.webp'
      ],
      desc: 'Juego experimental con menú personalizado.'
    },
    {
      id: 17166282321,
      name: 'Next Game Soon',
      iconUrl: 'img/NextGame_icon.webp',
      coverUrl: 'img/NextGame_Cover.webp',
      images: [
        'img/NextGame_Cover.webp'
      ],
      desc: 'Próximo juego — en desarrollo.'
    }
  ];

  function isVideo(src) {
    return /\.(mp4|webm|ogg)(\?.*)?$/i.test(src);
  }

  function createCoverElement(src, cssClass = '') {
    if (isVideo(String(src))) {
      const v = document.createElement('video');
      v.src = src;
      v.setAttribute('playsinline', '');
      v.setAttribute('muted', '');
      v.setAttribute('loop', '');
      v.autoplay = true;
      v.className = cssClass;
      v.preload = 'metadata';
      // in case autoplay blocked, show controls fallback on click
      v.addEventListener('error', () => { /* ignore, browser will show nothing */ });
      return v;
    } else {
      const i = document.createElement('img');
      i.src = src;
      i.alt = 'cover';
      i.className = cssClass;
      i.onerror = () => { i.src = 'img/cover-placeholder.webp'; };
      return i;
    }
  }

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
    gimg.onerror = () => { gimg.src = 'img/icon-placeholder.webp'; };
    gi.appendChild(gimg);

    const gc = document.createElement('div');
    gc.className = 'game-cover';
    // prefer coverUrl (image/video) for card view (use poster for video)
    const coverEl = createCoverElement(game.coverUrl);
    coverEl.style.width = '100%';
    coverEl.style.height = '100%';
    coverEl.style.objectFit = 'cover';
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

  // render initial and more
  if (gamesContainer) {
    const initial = GAMES.slice(0, 2);
    initial.forEach(game => gamesContainer.appendChild(renderGameCard(game)));
  }
  if (moreGamesContainer) {
    const extra = GAMES.slice(2);
    extra.forEach(game => moreGamesContainer.appendChild(renderGameCard(game)));
  }

  if (loadMoreBtn && moreGamesContainer) {
    loadMoreBtn.addEventListener('click', () => {
      const showing = moreGamesContainer.classList.toggle('visible-content');
      loadMoreBtn.textContent = showing ? '−' : '+';
    });
  }

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
      images: images.length ? images : [card.querySelector('.game-cover img')?.src || card.querySelector('.game-cover video')?.src || '']
    });
  }
  if (gamesContainer) gamesContainer.addEventListener('click', handleCardClick);
  if (moreGamesContainer) moreGamesContainer.addEventListener('click', handleCardClick);

  // modal creation (same as before but supports video)
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
            <div class="cover-viewport">
              <!-- dynamic content -->
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

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeGameModal();
    });
    confirm.addEventListener('click', (e) => {
      if (e.target === confirm) closeConfirm();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (isConfirmOpen()) closeConfirm();
        else closeGameModal();
      }
    });
  }

  createModalsIfNeeded();

  // helper to place current media (video or image) in .cover-viewport
  function setCoverViewport(ov, src) {
    const viewport = ov.querySelector('.cover-viewport');
    if (!viewport) return;
    viewport.innerHTML = '';
    const el = createCoverElement(src, '');
    // ensure it's sized properly
    el.style.width = '100%';
    el.style.height = 'var(--cover-height)';
    el.style.objectFit = 'cover';
    viewport.appendChild(el);
  }

  function openGameModal(data) {
    const ov = document.getElementById('game-modal-overlay');
    if (!ov) return;

    const titleEl = ov.querySelector('#game-modal-title');
    const descEl = ov.querySelector('#game-modal-desc');
    const iconEl = ov.querySelector('#game-modal-icon');
    const thumbsWrap = ov.querySelector('#game-cover-thumbs');
    const prevBtn = ov.querySelector('.cover-nav.prev');
    const nextBtn = ov.querySelector('.cover-nav.next');
    const playBtn = ov.querySelector('#game-modal-play');
    const pageBtn = ov.querySelector('#game-modal-page');
    const closeBtn = ov.querySelector('#game-modal-close');
    const counterEl = ov.querySelector('#game-cover-counter');

    titleEl.textContent = data.name || '';
    descEl.textContent = data.desc || '';
    iconEl.src = data.icon || '';
    iconEl.alt = (data.name || 'Game') + ' icon';

    const images = Array.isArray(data.images) && data.images.length ? data.images.slice() : [data.images || data.cover || ''];
    let idx = 0;
    let intervalId = null;
    const AUTO_MS = 6000;

    // thumbs
    thumbsWrap.innerHTML = '';
    images.forEach((src, i) => {
      const t = document.createElement('button');
      t.className = 'thumb-btn';
      t.type = 'button';
      t.dataset.index = String(i);
      if (isVideo(src)) {
        // use a small poster-like element (video muted and paused)
        const tv = document.createElement('video');
        tv.src = src;
        tv.muted = true;
        tv.playsInline = true;
        tv.preload = 'metadata';
        tv.width = 84;
        tv.height = 48;
        tv.style.objectFit = 'cover';
        t.appendChild(tv);
      } else {
        t.innerHTML = `<img src="${src}" alt="thumb-${i}" />`;
      }
      t.addEventListener('click', (ev) => {
        ev.stopPropagation();
        goToIndex(i);
        resetInterval();
      });
      thumbsWrap.appendChild(t);
    });

    function updateView() {
      const safeSrc = images[idx] || '';
      setCoverViewport(ov, safeSrc);
      // update active thumb
      thumbsWrap.querySelectorAll('.thumb-btn').forEach((b) => b.classList.remove('active'));
      const active = thumbsWrap.querySelector(`.thumb-btn[data-index="${idx}"]`);
      if (active) active.classList.add('active');
      if (counterEl) counterEl.textContent = `${idx + 1} / ${images.length}`;
    }
    function next() { idx = (idx + 1) % images.length; updateView(); }
    function prev() { idx = (idx - 1 + images.length) % images.length; updateView(); }
    function goToIndex(i) { idx = Math.max(0, Math.min(images.length - 1, i)); updateView(); }

    // replace prev/next nodes safely
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
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        delete ov.dataset.carouselInterval;
      }
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

    // replace buttons to detach old listeners
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
    // lock scroll (simple)
    document.documentElement.style.overflow = 'hidden';

    ov._cleanupCarousel = () => {
      stopInterval();
      coverArea.removeEventListener('mouseenter', onCoverEnter);
      coverArea.removeEventListener('mouseleave', onCoverLeave);
      if (counterEl) counterEl.textContent = '';
      document.documentElement.style.overflow = '';
    };
  }

  function closeGameModal() {
    const ov = document.getElementById('game-modal-overlay');
    if (!ov) return;
    if (ov._cleanupCarousel) {
      try { ov._cleanupCarousel(); } catch (e) { /* ignore */ }
      delete ov._cleanupCarousel;
    }
    ov.style.display = 'none';
  }

  // confirm modal
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
        // try launching roblox protocol (desktop) - best-effort
        try {
          const match = String(target).match(/\/games\/(\d+)/);
          const gameId = match ? match[1] : null;
          if (gameId) {
            const ts = Date.now();
            const launchProto = `roblox-player:1+launchmode:play+gameinfo:${gameId}+launchtime:${ts}+placelauncherurl:${encodeURIComponent(target)}`;
            const a = document.createElement('a');
            a.href = launchProto;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { try { document.body.removeChild(a); } catch(e){} }, 1000);
            setTimeout(() => { try { window.location.href = launchProto; } catch(e){} }, 900);
          }
        } catch (err) { console.warn('launch proto failed', err); }
      }
      closeConfirm();
      closeGameModal();
    });

    cancel2.addEventListener('click', () => closeConfirm());
  }

  function closeConfirm() {
    const conf = document.getElementById('game-confirm-overlay');
    if (!conf) return;
    conf.style.display = 'none';
    delete conf.dataset.targetUrl;
  }

  function isConfirmOpen() {
    const conf = document.getElementById('game-confirm-overlay');
    return conf && conf.style.display === 'flex';
  }
});

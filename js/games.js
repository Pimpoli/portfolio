// js/games.js — Juegos de Roblox (home y MultiGameInc/). Los datos vienen de js/roblox.js.

(function () {
  'use strict';

  const grid = document.getElementById('games-container');
  if (!grid) return;

  const { t, tf, el, icon, ICONS, asset, isRateLimited, showMediaDialog, confirmAction } = window.U;
  const moreBtn = document.getElementById('load-more-games');
  const VISIBLE = 3;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FALLBACK_IMG = asset('img/MultiGameInc.webp');

  // Primero se pintan con los nombres de config.js y después con los datos reales
  let games = window.SITE.games.map((g) => ({
    placeId: g.placeId, name: g.name, description: '', icon: null, thumbnails: [], live: false,
  }));

  function card(g, i) {
    const cover = g.thumbnails[0];
    const node = el('button', { class: 'game-card reveal' + (i >= VISIBLE ? ' is-extra' : ''), type: 'button' }, [
      el('span', { class: 'game-card__thumb' + (cover ? '' : ' is-placeholder') }, [
        cover ? el('img', { src: cover, alt: '', loading: 'lazy', width: 768, height: 432 }) : null,
      ]),
      el('span', { class: 'game-card__body' }, [
        g.icon
          ? el('img', { class: 'game-card__icon', src: g.icon, alt: '', loading: 'lazy', width: 40, height: 40 })
          : el('span', { class: 'game-card__icon is-placeholder' }),
        el('span', { class: 'game-card__title', text: g.name }),
      ]),
    ]);
    node.addEventListener('click', () => openGame(g));
    return node;
  }

  function render() {
    const rerender = grid.children.length > 0;
    const cards = games.map(card);
    if (rerender) cards.forEach((c) => c.classList.add('is-visible'));
    grid.replaceChildren(...cards);
    if (moreBtn) {
      moreBtn.hidden = games.length <= VISIBLE;
      updateMoreBtn();
    }
    window.observeReveal?.(grid);
  }

  function updateMoreBtn() {
    const expanded = grid.dataset.expanded === 'true';
    moreBtn.textContent = expanded ? t('games.less', 'Show less') : tf('games.more', 'View all {n} games', { n: games.length });
    moreBtn.setAttribute('aria-expanded', String(expanded));
  }

  if (moreBtn) {
    moreBtn.addEventListener('click', () => {
      grid.dataset.expanded = grid.dataset.expanded === 'true' ? 'false' : 'true';
      updateMoreBtn();
    });
  }

  // ─── Modal del juego con carrusel de imágenes ─────────────────────────────
  function carousel(images, name) {
    const list = images.length ? images : [FALLBACK_IMG];
    let idx = 0;
    let timer = null;

    const view = el('img', { class: 'carousel__img', src: list[0], alt: name });
    const thumbs = list.map((src, i) => el('button', {
      class: 'carousel__thumb', type: 'button', 'aria-label': `${i + 1} / ${list.length}`,
    }, [el('img', { src, alt: '', loading: 'lazy' })]));

    const go = (i) => {
      idx = (i + list.length) % list.length;
      view.src = list[idx];
      thumbs.forEach((b, j) => b.setAttribute('aria-current', j === idx ? 'true' : 'false'));
    };
    const stop = () => { clearInterval(timer); timer = null; };
    const start = () => { if (!reduceMotion && list.length > 1 && !timer) timer = setInterval(() => go(idx + 1), 6000); };

    thumbs.forEach((b, i) => b.addEventListener('click', () => { go(i); stop(); }));
    const prev = el('button', { class: 'carousel__nav carousel__nav--prev icon-btn', type: 'button', 'aria-label': t('a11y.prev', 'Previous image') }, [icon(ICONS.prev)]);
    const next = el('button', { class: 'carousel__nav carousel__nav--next icon-btn', type: 'button', 'aria-label': t('a11y.next', 'Next image') }, [icon(ICONS.next)]);
    prev.addEventListener('click', () => { go(idx - 1); stop(); });
    next.addEventListener('click', () => { go(idx + 1); stop(); });

    const root = el('div', { class: 'carousel' }, [
      el('div', { class: 'carousel__viewport' }, [view, list.length > 1 ? prev : null, list.length > 1 ? next : null]),
      list.length > 1 ? el('div', { class: 'carousel__thumbs' }, thumbs) : null,
    ]);
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);
    root.addEventListener('focusin', stop);
    go(0);
    start();
    return { root, stop };
  }

  function openGame(g) {
    const c = carousel(g.thumbnails, g.name);
    const playBtn = el('button', { class: 'btn btn--primary', type: 'button' }, [
      icon(ICONS.play, { fill: true, size: 16 }), t('games.modal.play', 'Play'),
    ]);
    playBtn.addEventListener('click', async () => {
      const ok = await confirmAction({
        title: t('games.modal.confirmTitle', 'Start game'),
        text: t('games.modal.confirmText', 'Do you want to start the game now?'),
        ok: t('games.modal.confirm', 'Confirm'),
        cancel: t('games.modal.cancel', 'Cancel'),
      });
      if (ok) window.open(`https://www.roblox.com/games/start?placeId=${g.placeId}`, '_blank', 'noopener');
    });
    const pageLink = el('a', {
      class: 'btn btn--outline', href: `https://www.roblox.com/games/${g.placeId}`, target: '_blank', rel: 'noopener',
      text: t('games.modal.page', 'Go to page'),
    });
    showMediaDialog({
      media: c.root,
      kicker: 'Roblox',
      title: g.name,
      desc: g.description,
      actions: [playBtn, pageLink],
      onClose: c.stop,
    });
  }

  // ─── Carga ────────────────────────────────────────────────────────────────
  let retried = false;
  function load(refresh) {
    window.Roblox.getGames({ refresh }).then((list) => {
      games = list;
      render();
      // Si alguna petición falló (y no es por rate-limit), se reintenta una vez
      if (!retried && list.some((g) => !g.live) && !isRateLimited()) {
        retried = true;
        setTimeout(() => load(true), 8000);
      }
    });
  }

  render();
  load(false);
  document.addEventListener('languageLoaded', () => { if (moreBtn) updateMoreBtn(); });
})();

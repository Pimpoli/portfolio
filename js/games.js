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

  const lang = () => document.documentElement.lang || undefined;
  const num = (n) => n.toLocaleString(lang());

  function card(g, i) {
    const cover = g.thumbnails[0];
    const meta = [];
    if (g.visits !== null && g.visits !== undefined) meta.push(tf('games.visits', '{n} visits', { n: window.U.compact(g.visits) }));
    if (g.likes !== null && g.likes !== undefined) meta.push(tf('games.likes', '{n}% likes', { n: g.likes }));
    const node = el('button', { class: 'game-card reveal' + (i >= VISIBLE ? ' is-extra' : ''), type: 'button', 'data-tilt': '' }, [
      el('span', { class: 'game-card__thumb' + (cover ? '' : ' is-placeholder') }, [
        cover ? el('img', { src: cover, alt: '', loading: 'lazy', width: 768, height: 432 }) : null,
        g.playing ? el('span', { class: 'live-badge' }, [
          el('span', { class: 'live-badge__dot', 'aria-hidden': 'true' }),
          tf('games.playing', '{n} playing', { n: num(g.playing) }),
        ]) : null,
      ]),
      el('span', { class: 'game-card__body' }, [
        g.icon
          ? el('img', { class: 'game-card__icon', src: g.icon, alt: '', loading: 'lazy', width: 44, height: 44 })
          : el('span', { class: 'game-card__icon is-placeholder' }),
        el('span', { class: 'game-card__text' }, [
          el('span', { class: 'game-card__title', text: g.name }),
          meta.length ? el('span', { class: 'game-card__meta', text: meta.join(' · ') }) : null,
        ]),
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
    window.bindTilt?.(grid);
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

  // ─── Modal del juego: carrusel de vídeos e imágenes + estadísticas ────────
  const YT = /^[\w-]{11}$/;

  function carousel(images, name) {
    let slides = (images.length ? images : [FALLBACK_IMG]).map((src) => ({ type: 'img', src }));
    let idx = 0;
    let timer = null;

    const viewport = el('div', { class: 'carousel__viewport' });
    const thumbsWrap = el('div', { class: 'carousel__thumbs' });
    const prev = el('button', { class: 'carousel__nav carousel__nav--prev icon-btn', type: 'button', 'aria-label': t('a11y.prev', 'Previous image') }, [icon(ICONS.prev)]);
    const next = el('button', { class: 'carousel__nav carousel__nav--next icon-btn', type: 'button', 'aria-label': t('a11y.next', 'Next image') }, [icon(ICONS.next)]);

    const stop = () => { clearInterval(timer); timer = null; };
    const start = () => {
      if (reduceMotion || slides.length < 2 || timer || slides[idx].type === 'video') return;
      timer = setInterval(() => go(idx + 1), 6000);
    };

    function slideNode(s) {
      if (s.type === 'video') {
        return el('iframe', {
          class: 'carousel__video', src: `https://www.youtube-nocookie.com/embed/${s.id}?rel=0`, title: s.title || name,
          allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: true,
        });
      }
      return el('img', { class: 'carousel__img', src: s.src, alt: name });
    }

    function go(i) {
      idx = (i + slides.length) % slides.length;
      viewport.replaceChildren(slideNode(slides[idx]), ...(slides.length > 1 ? [prev, next] : []));
      thumbsWrap.querySelectorAll('.carousel__thumb').forEach((b, j) => b.setAttribute('aria-current', j === idx ? 'true' : 'false'));
      if (slides[idx].type === 'video') stop();
    }

    function renderThumbs() {
      thumbsWrap.replaceChildren(...slides.map((s, i) => {
        const b = el('button', {
          class: 'carousel__thumb' + (s.type === 'video' ? ' carousel__thumb--video' : ''), type: 'button',
          'aria-label': s.type === 'video' ? `${t('games.modal.video', 'Video')} ${i + 1}` : `${i + 1} / ${slides.length}`,
        }, [
          el('img', { src: s.type === 'video' ? `https://i.ytimg.com/vi/${s.id}/mqdefault.jpg` : s.src, alt: '', loading: 'lazy' }),
          s.type === 'video' ? el('span', { class: 'carousel__thumb-play' }, [icon(ICONS.play, { fill: true, size: 14 })]) : null,
        ]);
        b.addEventListener('click', () => { stop(); go(i); });
        return b;
      }));
      thumbsWrap.hidden = slides.length < 2;
    }

    prev.addEventListener('click', () => { stop(); go(idx - 1); });
    next.addEventListener('click', () => { stop(); go(idx + 1); });

    const root = el('div', { class: 'carousel' }, [viewport, thumbsWrap]);
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);
    root.addEventListener('focusin', stop);
    renderThumbs();
    go(0);
    start();

    // Los vídeos de la galería de Roblox llegan después: van primero en la tira
    function addVideos(videos) {
      const list = videos.filter((v) => YT.test(v.id)).map((v) => ({ type: 'video', id: v.id, title: v.title }));
      if (!list.length) return;
      stop();
      const current = slides[idx];
      slides = [...list, ...slides];
      renderThumbs();
      go(slides.indexOf(current));
      start();
    }
    return { root, stop, addVideos };
  }

  function openGame(g) {
    const c = carousel(g.thumbnails, g.name);
    const playBtn = el('button', { class: 'btn btn--primary', type: 'button' }, [
      icon(ICONS.play, { fill: true, size: 16 }), t('games.modal.play', 'Play on Roblox'),
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

    const stats = [];
    if (g.playing !== null && g.playing !== undefined) stats.push({ label: t('games.modal.playingNow', 'Playing now'), value: num(g.playing), tone: 'live' });
    if (g.visits !== null && g.visits !== undefined) stats.push({ label: t('games.modal.visits', 'Visits'), value: window.U.compact(g.visits) });
    if (g.favorites !== null && g.favorites !== undefined) stats.push({ label: t('games.modal.favorites', 'Favorites'), value: window.U.compact(g.favorites) });
    if (g.likes !== null && g.likes !== undefined) stats.push({ label: t('games.modal.likes', 'Likes'), value: `${g.likes}%` });

    const chips = [
      g.genre,
      g.maxPlayers ? tf('games.modal.maxPlayers', 'Up to {n} players', { n: g.maxPlayers }) : '',
      g.updated ? tf('games.modal.updated', 'Updated {date}', {
        date: new Intl.DateTimeFormat(lang(), { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(g.updated)),
      }) : '',
    ];

    const dlg = showMediaDialog({
      layout: 'split',
      media: c.root,
      icon: g.icon,
      kicker: `${g.creator || 'Multi Game Inc'} · Roblox`,
      title: g.name,
      desc: g.description,
      chips,
      stats,
      actions: [playBtn, pageLink],
      onClose: c.stop,
    });
    window.Roblox.gameVideos(g).then((videos) => { if (dlg.open && dlg.contains(c.root)) c.addVideos(videos); });
  }

  // ─── Carga ────────────────────────────────────────────────────────────────
  // 1) La copia de data/roblox.json (rápida y fiable) y 2) datos en vivo encima. Si en vivo
  // falla, se reintenta con espera creciente (o cuando termina el rate-limit), hasta 3 veces.
  let attempts = 0;
  function refreshLive() {
    window.Roblox.refreshGames(games).then((fresh) => {
      if (fresh && fresh.some((g) => g.live)) {
        games = fresh;
        render();
        return;
      }
      attempts += 1;
      if (attempts < 3) setTimeout(refreshLive, isRateLimited() ? 95_000 : 8000 * attempts);
    });
  }

  function load() {
    window.Roblox.getGames().then((list) => {
      games = list;
      render();
      refreshLive();
    });
  }

  render();
  load();
  // Las tarjetas llevan textos traducidos ("3 jugando", "visitas"…): se repintan al cambiar de idioma
  document.addEventListener('languageLoaded', render);
})();

// js/games.js — Roblox games: featured game, card grid and the detail dialog.
// Used by the home and by MultiGameInc/. Data comes from js/roblox.js.

(function () {
  'use strict';

  const grid = document.getElementById('games-grid');
  const featuredEl = document.getElementById('featured-game');
  if (!grid && !featuredEl) return;

  const { t, tf, el, icon, ICONS, asset, isRateLimited, showMediaDialog, confirmAction, compact } = window.U;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FALLBACK_IMG = asset('img/MultiGameInc.webp');
  const NEW_FOR_DAYS = 90;

  let games = window.SITE.games.map((g) => ({
    placeId: g.placeId, name: g.name, isNew: Boolean(g.isNew), description: '', icon: null, thumbnails: [], live: false,
  }));

  const lang = () => document.documentElement.lang || undefined;
  const num = (n) => n.toLocaleString(lang());
  const has = (v) => v !== null && v !== undefined;
  const monthYear = (iso) => new Intl.DateTimeFormat(lang(), { month: 'short', year: 'numeric' }).format(new Date(iso));
  const fullDate = (iso) => new Intl.DateTimeFormat(lang(), { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));

  function isNew(g) {
    if (g.isNew) return true;
    return Boolean(g.created) && Date.now() - new Date(g.created).getTime() < NEW_FOR_DAYS * 86_400_000;
  }

  // The featured game is the one with people playing right now; otherwise the most visited.
  function pickFeatured(list) {
    const playing = list.filter((g) => g.playing > 0).sort((a, b) => b.playing - a.playing);
    if (playing.length) return playing[0];
    const known = list.filter((g) => has(g.visits)).sort((a, b) => b.visits - a.visits);
    return known[0] || list.find((g) => !isNew(g)) || list[0];
  }

  function coverImg(g, cls, size) {
    const src = g.thumbnails[0];
    if (!src) return el('span', { class: `${cls} is-placeholder`, 'aria-hidden': 'true' });
    return el('img', { class: cls, src, alt: '', loading: 'lazy', decoding: 'async', width: size[0], height: size[1] });
  }
  function iconImg(g, size) {
    if (!g.icon) return el('span', { class: 'game-icon is-placeholder', 'aria-hidden': 'true' });
    return el('img', { class: 'game-icon', src: g.icon, alt: '', loading: 'lazy', decoding: 'async', width: size, height: size });
  }

  // ── Featured block ────────────────────────────────────────────────────────
  function renderFeatured(g) {
    if (!featuredEl) return;
    const status = g.playing > 0
      ? el('p', { class: 'featured__status is-live', text: tf('games.playingNow', '{n} playing now', { n: num(g.playing) }) })
      : el('p', { class: 'featured__status', text: t('games.mostVisited', 'most visited') });
    const figures = [
      has(g.visits) ? [num(g.visits), t('games.visits', 'visits')] : null,
      has(g.likes) ? [`${g.likes} %`, t('games.likes', 'likes')] : null,
      has(g.favorites) ? [num(g.favorites), t('games.favorites', 'favorites')] : null,
    ].filter(Boolean);

    const play = el('button', { class: 'btn btn--solid', type: 'button', text: t('games.play', 'Play on Roblox') });
    play.addEventListener('click', () => launch(g));
    const gallery = el('button', { class: 'btn', type: 'button', text: t('games.gallery', 'Gallery and details') });
    gallery.addEventListener('click', () => openGame(g));

    const cover = el('button', { class: 'featured__cover', type: 'button', 'aria-label': g.name }, [coverImg(g, 'featured__img', [768, 432])]);
    cover.addEventListener('click', () => openGame(g));

    featuredEl.replaceChildren(
      cover,
      el('div', { class: 'featured__body' }, [
        status,
        iconImg(g, 56),
        el('h3', { class: 'featured__title', text: g.name }),
        el('dl', { class: 'featured__figures' }, figures.map(([v, l]) => el('div', {}, [el('dt', { text: l }), el('dd', { text: v })]))),
        el('div', { class: 'featured__actions' }, [play, gallery]),
      ]),
    );
  }

  // ── Card grid ─────────────────────────────────────────────────────────────
  function card(g) {
    const fresh = isNew(g);
    const live = g.playing > 0;
    let badge = null;
    if (live) badge = el('span', { class: 'game-card__badge is-live', text: tf('games.playingNow', '{n} playing now', { n: num(g.playing) }) });
    else if (fresh) badge = el('span', { class: 'game-card__badge is-new', text: t('games.badgeNew', 'New') });

    const cover = el('button', { class: 'game-card__cover', type: 'button', tabindex: '-1', 'aria-hidden': 'true' }, [
      coverImg(g, 'game-card__img', [480, 270]), badge,
    ]);
    const open = el('button', { class: 'game-card__open', type: 'button' }, [g.name]);

    const stat = (value, label) => el('li', {}, [el('strong', { text: value }), ' ', label]);
    const stats = has(g.visits)
      ? el('ul', { class: 'game-card__stats' }, [
          stat(num(g.visits), t('games.visits', 'visits')),
          has(g.likes) ? stat(`${g.likes} %`, t('games.likes', 'likes')) : null,
          has(g.favorites) ? stat(num(g.favorites), t('games.favorites', 'favorites')) : null,
        ])
      : el('p', { class: 'game-card__stats', text: t('games.newNoData', 'Just released · no data yet') });

    const li = el('li', { class: 'game-card' + (fresh ? ' is-new' : '') + (live ? ' is-live' : '') }, [
      cover,
      el('div', { class: 'game-card__body' }, [
        iconImg(g, 44),
        el('div', { class: 'game-card__text' }, [
          el('h3', { class: 'game-card__title' }, [open]),
          stats,
          g.updated ? el('p', { class: 'game-card__date', text: tf('games.updated', 'Updated {date}', { date: monthYear(g.updated) }) }) : null,
        ]),
      ]),
    ]);
    // The whole card opens the game; the name button keeps it reachable by keyboard
    li.addEventListener('click', () => openGame(g));
    return li;
  }

  function render() {
    const featured = pickFeatured(games);
    renderFeatured(featured);
    if (grid) {
      const rest = games.filter((g) => g !== featured)
        .sort((a, b) => Number(isNew(b)) - Number(isNew(a)) || (b.visits || 0) - (a.visits || 0));
      grid.replaceChildren(...rest.map(card));
    }
    const note = document.getElementById('games-note');
    if (note) {
      window.Roblox.updatedAt().then((iso) => {
        note.textContent = iso
          ? tf('games.note', '{n} games. Data as of {date}.', { n: games.length, date: fullDate(iso) })
          : tf('games.noteSimple', '{n} games.', { n: games.length });
      });
    }
  }

  // ── Detail dialog ─────────────────────────────────────────────────────────
  const YT = /^[\w-]{11}$/;

  function carousel(images, name) {
    let slides = (images.length ? images : [FALLBACK_IMG]).map((src) => ({ type: 'img', src }));
    let idx = 0;
    let timer = null;

    const viewport = el('div', { class: 'carousel__viewport' });
    const thumbs = el('div', { class: 'carousel__thumbs' });
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
      thumbs.querySelectorAll('.carousel__thumb').forEach((b, j) => b.setAttribute('aria-current', j === idx ? 'true' : 'false'));
      if (slides[idx].type === 'video') stop();
    }

    function renderThumbs() {
      thumbs.replaceChildren(...slides.map((s, i) => {
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
      thumbs.hidden = slides.length < 2;
    }

    prev.addEventListener('click', () => { stop(); go(idx - 1); });
    next.addEventListener('click', () => { stop(); go(idx + 1); });

    const root = el('div', { class: 'carousel' }, [viewport, thumbs]);
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);
    root.addEventListener('focusin', stop);
    renderThumbs();
    go(0);
    start();

    // Roblox gallery videos arrive later; they go first in the strip.
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

  async function launch(g) {
    const ok = await confirmAction({
      title: t('games.modal.confirmTitle', 'Open Roblox'),
      text: t('games.modal.confirmText', 'Do you want to open the game on Roblox now?'),
      ok: t('games.modal.confirm', 'Open Roblox'),
      cancel: t('games.modal.cancel', 'Cancel'),
    });
    if (ok) window.open(`https://www.roblox.com/games/start?placeId=${g.placeId}`, '_blank', 'noopener');
  }

  function openGame(g) {
    const c = carousel(g.thumbnails, g.name);
    const playBtn = el('button', { class: 'btn btn--solid', type: 'button' }, [icon(ICONS.play, { fill: true, size: 16 }), t('games.modal.play', 'Play on Roblox')]);
    playBtn.addEventListener('click', () => launch(g));
    const pageLink = el('a', {
      class: 'btn', href: `https://www.roblox.com/games/${g.placeId}`, target: '_blank', rel: 'noopener',
      text: t('games.modal.page', 'See page on Roblox'),
    });

    const stats = [];
    if (has(g.playing)) stats.push({ label: t('games.modal.playingNow', 'Playing now'), value: num(g.playing), tone: 'live' });
    if (has(g.visits)) stats.push({ label: t('games.modal.visits', 'Visits'), value: num(g.visits) });
    if (has(g.favorites)) stats.push({ label: t('games.modal.favorites', 'Favorites'), value: num(g.favorites) });
    if (has(g.likes)) stats.push({ label: t('games.modal.likes', 'Likes'), value: `${g.likes} %` });

    const chips = [
      g.genre,
      g.maxPlayers ? tf('games.modal.maxPlayers', 'Up to {n} players', { n: g.maxPlayers }) : '',
      g.updated ? tf('games.modal.updated', 'Updated {date}', { date: fullDate(g.updated) }) : '',
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

  // ── Loading ───────────────────────────────────────────────────────────────
  // data/roblox.json first (fast, always there), then live numbers on top.
  // If the live call fails it retries a couple of times with a growing delay.
  const flagged = (list) => list.map((g, i) => ({ ...g, isNew: Boolean(window.SITE.games[i]?.isNew) }));
  let attempts = 0;
  function refreshLive() {
    window.Roblox.refreshGames(games).then((fresh) => {
      if (fresh && fresh.some((g) => g.live)) {
        games = flagged(fresh);
        render();
        return;
      }
      attempts += 1;
      if (attempts < 3) setTimeout(refreshLive, isRateLimited() ? 95_000 : 8000 * attempts);
    });
  }

  render();
  window.Roblox.getGames().then((list) => {
    games = flagged(list);
    render();
    refreshLive();
  });
  document.addEventListener('languageLoaded', render);

  window.formatCompact = compact;
})();

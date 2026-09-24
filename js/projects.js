// js/projects.js — Tarjetas de proyectos (imágenes propias + últimos vídeos de YouTube)

(function () {
  'use strict';

  const grid = document.getElementById('projects-grid');
  if (!grid) return;

  const { t, el, icon, ICONS, fetchJSON, cache, showMediaDialog } = window.U;
  const moreBtn = document.getElementById('projects-more');
  const VISIBLE = 3;
  const YT_ID = /^[\w-]{11}$/;

  const staticProjects = [
    { type: 'img', src: 'img/Nodos.webp', kickerKey: 'projects.kicker.system', kicker: 'System',
      titleKey: 'projects.nodes.title', title: 'Nodes System', descKey: 'projects.nodes.desc', desc: '' },
    { type: 'img', src: 'img/NodosDemostracion.webp', kickerKey: 'projects.kicker.demo', kicker: 'Demo',
      titleKey: 'projects.nodesDemo.title', title: 'Nodes System Demo', descKey: 'projects.nodesDemo.desc', desc: 'Visual connection between nodes.' },
  ];
  let videos = [];

  // Textos traducibles de los proyectos propios; los de YouTube se muestran tal cual
  const field = (p, name) => (p[name + 'Key'] ? t(p[name + 'Key'], p[name]) : p[name]);

  async function fetchVideos() {
    const KEY = 'yt_uploads';
    const hit = cache.get(KEY, 30 * 60_000);
    if (hit) return hit;
    const { apiKey, uploadsPlaylistId } = window.SITE.youtube;
    const data = await fetchJSON(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=6&key=${apiKey}`
    );
    const list = (data?.items || [])
      .map((item) => ({
        type: 'youtube',
        id: item.snippet?.resourceId?.videoId,
        title: item.snippet?.title || '',
        desc: item.snippet?.description || '',
        thumb: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || '',
        kickerKey: 'projects.kicker.video', kicker: 'Video',
      }))
      .filter((v) => YT_ID.test(v.id || '') && v.thumb);
    if (list.length) cache.set(KEY, list);
    return list;
  }

  function mediaFor(p, { autoplay = false } = {}) {
    if (p.type === 'img') return el('img', { src: p.src, alt: field(p, 'title') });
    return el('iframe', {
      src: `https://www.youtube-nocookie.com/embed/${p.id}?rel=0${autoplay ? '&autoplay=1' : ''}`,
      title: p.title,
      allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
      allowfullscreen: true,
      loading: 'lazy',
    });
  }

  function openProject(p) {
    const actions = p.type === 'youtube'
      ? [el('a', { class: 'btn btn--outline', href: `https://www.youtube.com/watch?v=${p.id}`, target: '_blank', rel: 'noopener', text: t('projects.watchOnYoutube', 'Watch on YouTube') })]
      : [];
    showMediaDialog({
      media: mediaFor(p, { autoplay: true }),
      kicker: field(p, 'kicker'),
      title: field(p, 'title'),
      desc: field(p, 'desc'),
      actions,
    });
  }

  function card(p, i) {
    const img = el('img', { class: 'media-card__img', src: p.type === 'img' ? p.src : p.thumb, alt: '', loading: 'lazy' });
    const thumb = p.type === 'youtube'
      ? [img, el('span', { class: 'play-badge' }, [icon(ICONS.play, { fill: true, size: 24 })])]
      : [img];
    const desc = field(p, 'desc');
    const node = el('button', { class: 'media-card reveal' + (i >= VISIBLE ? ' is-extra' : ''), type: 'button' }, [
      el('span', { class: 'media-card__thumb' }, thumb),
      el('span', { class: 'media-card__body' }, [
        el('span', { class: 'media-card__kicker', text: field(p, 'kicker') }),
        el('span', { class: 'media-card__title', text: field(p, 'title') }),
        desc ? el('span', { class: 'media-card__desc', text: desc }) : null,
      ]),
    ]);
    node.addEventListener('click', () => openProject(p));
    return node;
  }

  function render() {
    const all = [...staticProjects, ...videos];
    const rerender = grid.children.length > 0;
    const cards = all.map(card);
    if (rerender) cards.forEach((c) => c.classList.add('is-visible')); // sin repetir la animación
    grid.replaceChildren(...cards);
    if (moreBtn) {
      moreBtn.hidden = all.length <= VISIBLE;
      updateMoreBtn();
    }
    window.observeReveal?.(grid);
  }

  function updateMoreBtn() {
    const expanded = grid.dataset.expanded === 'true';
    moreBtn.textContent = expanded ? t('projects.less', 'Show less') : t('projects.more', 'View more projects');
    moreBtn.setAttribute('aria-expanded', String(expanded));
  }

  if (moreBtn) {
    moreBtn.addEventListener('click', () => {
      grid.dataset.expanded = grid.dataset.expanded === 'true' ? 'false' : 'true';
      updateMoreBtn();
    });
  }

  render();
  document.addEventListener('languageLoaded', render);
  fetchVideos().then((list) => { videos = list; render(); });
})();

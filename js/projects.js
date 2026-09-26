// js/projects.js — Node System demo dialog and the latest YouTube videos.

(function () {
  'use strict';

  const list = document.getElementById('videos-list');
  if (!list) return;

  const { t, el, icon, ICONS, fetchJSON, cache, showMediaDialog } = window.U;
  const YT_ID = /^[\w-]{11}$/;
  const empty = document.getElementById('videos-empty');

  // "Watch the demo" opens the demo capture in the dialog
  const demoBtn = document.getElementById('nodes-demo');
  if (demoBtn) {
    demoBtn.addEventListener('click', () => {
      showMediaDialog({
        media: el('img', { src: 'img/NodosDemostracion.webp', alt: t('projects.nodes.demoTitle', 'Node System demo'), width: 1600, height: 900 }),
        kicker: t('projects.nodes.kicker', 'Tool for Roblox Studio'),
        title: t('projects.nodes.demoTitle', 'Node System demo'),
        desc: t('projects.nodes.demoDesc', ''),
      });
    });
  }

  async function fetchVideos() {
    const KEY = 'yt_uploads';
    const hit = cache.get(KEY, 30 * 60_000);
    if (hit) return hit;
    const { apiKey, uploadsPlaylistId } = window.SITE.youtube;
    const data = await fetchJSON(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=4&key=${apiKey}`
    );
    const videos = (data?.items || [])
      .map((item) => ({
        id: item.snippet?.resourceId?.videoId,
        title: item.snippet?.title || '',
        desc: item.snippet?.description || '',
        thumb: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.high?.url || '',
        published: item.snippet?.publishedAt || '',
      }))
      .filter((v) => YT_ID.test(v.id || '') && v.thumb)
      .slice(0, 3);
    if (videos.length) cache.set(KEY, videos);
    return videos;
  }

  function openVideo(v) {
    showMediaDialog({
      media: el('iframe', {
        src: `https://www.youtube-nocookie.com/embed/${v.id}?rel=0&autoplay=1`,
        title: v.title,
        allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
        allowfullscreen: true,
      }),
      kicker: t('projects.videos.kind', 'Video'),
      title: v.title,
      desc: v.desc,
      actions: [el('a', { class: 'btn', href: `https://www.youtube.com/watch?v=${v.id}`, target: '_blank', rel: 'noopener', text: t('projects.watchOnYoutube', 'Watch on YouTube') })],
    });
  }

  let videos = [];
  let loaded = false;

  function render() {
    const lang = document.documentElement.lang || undefined;
    list.replaceChildren(...videos.map((v) => {
      const btn = el('button', { class: 'video', type: 'button' }, [
        el('span', { class: 'video__thumb' }, [
          el('img', { src: v.thumb, alt: '', loading: 'lazy', decoding: 'async', width: 320, height: 180 }),
          el('span', { class: 'video__play', 'aria-hidden': 'true' }, [icon(ICONS.play, { fill: true, size: 14 })]),
        ]),
        el('span', { class: 'video__title', text: v.title }),
        v.published ? el('span', { class: 'video__date', text: new Intl.DateTimeFormat(lang, { month: 'short', year: 'numeric' }).format(new Date(v.published)) }) : null,
      ]);
      btn.addEventListener('click', () => openVideo(v));
      return el('li', {}, [btn]);
    }));
    if (!loaded) return;
    if (empty) empty.hidden = videos.length > 0;
    list.hidden = videos.length === 0;
  }

  render();
  document.addEventListener('languageLoaded', render);
  fetchVideos().then((found) => { videos = found; loaded = true; render(); });
})();

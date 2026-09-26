// js/products.js — Store rows: each Gumroad product with its YouTube video.
// gumroad.js (the checkout overlay) is only loaded once someone shows interest in buying.

(function () {
  'use strict';

  const list = document.getElementById('products-list');
  if (!list) return;

  const { t, tf, el, icon, ICONS, fetchJSON, cache, showMediaDialog } = window.U;
  const YT_ID = /^[\w-]{11}$/;

  let products = window.SITE.store.map((p) => ({ ...p, title: '', desc: '', thumb: '' }));

  async function fetchVideoData() {
    const ids = products.map((p) => p.youtubeId).filter((id) => YT_ID.test(id));
    if (!ids.length) return null;
    const KEY = 'yt_store_' + ids.join(',');
    const hit = cache.get(KEY, 30 * 60_000);
    if (hit) return hit;
    const data = await fetchJSON(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${ids.join(',')}&key=${window.SITE.youtube.apiKey}`
    );
    if (!data?.items) return null;
    const map = {};
    data.items.forEach((item) => {
      map[item.id] = {
        title: item.snippet?.title || '',
        desc: item.snippet?.description || '',
        thumb: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.high?.url || '',
      };
    });
    cache.set(KEY, map);
    return map;
  }

  let gumroadLoaded = false;
  function loadGumroad() {
    if (gumroadLoaded) return;
    gumroadLoaded = true;
    const s = document.createElement('script');
    s.src = 'https://gumroad.com/js/gumroad.js';
    s.async = true;
    document.head.append(s);
  }

  // First sentence of the YouTube description, trimmed to a card-sized line
  const firstLine = (desc) => {
    const line = String(desc || '').split('\n').map((l) => l.trim()).find(Boolean) || '';
    return line.length > 150 ? line.slice(0, 147).trimEnd() + '…' : line;
  };
  const titleOf = (p, i) => p.title || tf('store.productFallback', 'System {n}', { n: i + 1 });

  function openProduct(p, i) {
    const media = YT_ID.test(p.youtubeId)
      ? el('iframe', {
          src: `https://www.youtube-nocookie.com/embed/${p.youtubeId}?rel=0&autoplay=1`,
          title: titleOf(p, i),
          allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
          allowfullscreen: true,
        })
      : null;
    showMediaDialog({
      media,
      kicker: t('nav.store', 'Store'),
      title: titleOf(p, i),
      desc: p.desc || t('store.noDesc', 'No description.'),
      actions: [buyLink(p, 'btn btn--solid', true)],
    });
  }

  function buyLink(p, cls, withPrice = false) {
    const label = t('store.buy', 'Buy on Gumroad');
    const a = el('a', {
      class: cls, href: p.gumroadUrl, target: '_blank', rel: 'noopener', 'data-gumroad-overlay-checkout': 'true',
    }, [withPrice ? `${label} · ${p.price} ${p.currency}` : label]);
    a.addEventListener('pointerenter', loadGumroad, { once: true });
    a.addEventListener('focus', loadGumroad, { once: true });
    return a;
  }

  function row(p, i) {
    const thumb = el('button', { class: 'product__thumb' + (p.thumb ? '' : ' is-placeholder'), type: 'button', 'aria-label': t('store.watch', 'Watch the video') }, [
      p.thumb ? el('img', { src: p.thumb, alt: '', loading: 'lazy', decoding: 'async', width: 320, height: 180 }) : null,
      el('span', { class: 'video__play', 'aria-hidden': 'true' }, [icon(ICONS.play, { fill: true, size: 14 })]),
    ]);
    thumb.addEventListener('click', () => openProduct(p, i));
    const watch = el('button', { class: 'link', type: 'button', text: t('store.watch', 'Watch the video') });
    watch.addEventListener('click', () => openProduct(p, i));
    return el('li', { class: 'product' }, [
      thumb,
      el('div', { class: 'product__body' }, [
        el('h3', { class: 'product__title', text: titleOf(p, i) }),
        el('p', { class: 'product__line', text: firstLine(p.desc) || t('store.line', '') }),
        watch,
      ]),
      el('div', { class: 'product__buy' }, [
        el('span', { class: 'product__price' }, [p.price, ' ', el('span', { class: 'product__currency', text: p.currency })]),
        buyLink(p, 'btn'),
      ]),
    ]);
  }

  function render() {
    list.replaceChildren(...products.map(row));
  }

  render();
  document.addEventListener('languageLoaded', render);
  fetchVideoData().then((map) => {
    if (!map) return;
    products = products.map((p) => ({ ...p, ...(map[p.youtubeId] || {}) }));
    render();
  });
})();

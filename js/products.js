// js/products.js — Tienda: productos de Gumroad presentados con su vídeo de YouTube

(function () {
  'use strict';

  const grid = document.getElementById('products-container');
  if (!grid) return;

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
        thumb: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || '',
      };
    });
    cache.set(KEY, map);
    return map;
  }

  const titleOf = (p, i) => p.title || tf('store.productFallback', 'Product {n}', { n: i + 1 });

  function price(p) {
    return el('span', { class: 'price' }, [p.price, ' ', el('span', { class: 'price__currency', text: p.currency })]);
  }

  function openProduct(p, i) {
    const media = YT_ID.test(p.youtubeId)
      ? el('iframe', {
          src: `https://www.youtube-nocookie.com/embed/${p.youtubeId}?rel=0&autoplay=1`,
          title: titleOf(p, i),
          allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
          allowfullscreen: true,
        })
      : null;
    const buy = el('a', {
      class: 'btn btn--primary btn--block', href: p.gumroadUrl, target: '_blank', rel: 'noopener',
      'data-gumroad-overlay-checkout': 'true',
    }, [`${t('store.buy', 'Buy')} · ${p.price} ${p.currency}`]);
    showMediaDialog({
      media,
      kicker: t('nav.store', 'Store'),
      title: titleOf(p, i),
      desc: p.desc || t('store.noDesc', 'No description.'),
      actions: [buy],
    });
  }

  function card(p, i) {
    const thumb = el('span', { class: 'product-card__thumb' + (p.thumb ? '' : ' is-placeholder') }, [
      p.thumb ? el('img', { src: p.thumb, alt: '', loading: 'lazy' }) : null,
      el('span', { class: 'play-badge' }, [icon(ICONS.play, { fill: true, size: 24 })]),
    ]);
    const more = el('button', { class: 'btn btn--primary', type: 'button', text: t('store.moreInfo', 'More info') });
    const node = el('article', { class: 'product-card reveal' }, [
      el('button', { class: 'product-card__media', type: 'button', 'aria-label': titleOf(p, i) }, [thumb]),
      el('div', { class: 'product-card__body' }, [
        el('h3', { class: 'product-card__title', text: titleOf(p, i) }),
        el('div', { class: 'product-card__footer' }, [price(p), more]),
      ]),
    ]);
    node.querySelector('.product-card__media').addEventListener('click', () => openProduct(p, i));
    more.addEventListener('click', () => openProduct(p, i));
    return node;
  }

  function render() {
    const rerender = grid.children.length > 0;
    const cards = products.map(card);
    if (rerender) cards.forEach((c) => c.classList.add('is-visible'));
    grid.replaceChildren(...cards);
    window.observeReveal?.(grid);
  }

  render();
  document.addEventListener('languageLoaded', render);
  fetchVideoData().then((map) => {
    if (!map) return;
    products = products.map((p) => ({ ...p, ...(map[p.youtubeId] || {}) }));
    render();
  });
})();

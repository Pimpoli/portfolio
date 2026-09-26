// js/utils.js — Utilidades compartidas por todos los scripts (cargar antes que el resto).
// Nada aquí usa innerHTML con datos externos: los textos de Roblox/YouTube se insertan
// siempre como texto, así un nombre o descripción con "<" o "&" no rompe la página.

(function () {
  'use strict';

  // Páginas en subcarpetas (MultiGameInc/…) declaran <meta name="locale-base" content="../">
  const base = document.querySelector('meta[name="locale-base"]')?.content || '';

  // ─── Traducciones ──────────────────────────────────────────────────────────
  function t(key, fallback) {
    let v = window.translations;
    for (const part of key.split('.')) {
      if (v && Object.prototype.hasOwnProperty.call(v, part)) v = v[part];
      else return fallback;
    }
    return typeof v === 'string' ? v : fallback;
  }

  // t() con variables: tf('games.more', 'Ver los {n} juegos', { n: 5 })
  function tf(key, fallback, vars) {
    return t(key, fallback).replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? String(vars[k]) : m));
  }

  // ─── Almacenamiento seguro (modo privado / cookies bloqueadas) ─────────────
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
  };

  // Caché con caducidad en sessionStorage. Las claves llevan versión: la web anterior guardaba
  // otros formatos con los mismos nombres (rbx_uid_…, rbx_fol_…) y los datos no cargaban.
  const CACHE_VERSION = 'pd3:';
  const cache = {
    get(k, ttl) {
      try {
        const raw = sessionStorage.getItem(CACHE_VERSION + k);
        if (!raw) return null;
        const { v, t: ts } = JSON.parse(raw);
        return Date.now() - ts < ttl ? v : null;
      } catch { return null; }
    },
    set(k, v) {
      try { sessionStorage.setItem(CACHE_VERSION + k, JSON.stringify({ v, t: Date.now() })); } catch { /* lleno o bloqueado */ }
    },
  };

  // Si roproxy devuelve 429, todas las llamadas a Roblox esperan 90 s
  function isRateLimited() {
    try { return Date.now() < Number(sessionStorage.getItem('rbx_rl') || 0); } catch { return false; }
  }
  function setRateLimited(ms = 90_000) {
    try { sessionStorage.setItem('rbx_rl', String(Date.now() + ms)); } catch { /* ignore */ }
  }

  // ─── Red ───────────────────────────────────────────────────────────────────
  async function fetchWithTimeout(url, opts = {}, ms = 8000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
      return await fetch(url, { ...opts, signal: controller.signal });
    } finally {
      clearTimeout(id);
    }
  }

  // Devuelve el JSON o null. Marca el rate-limit compartido si recibe 429.
  // retries: reintentos extra ante errores de red o 5xx (espera 0,8 s, 1,6 s…), nunca ante 429 o 4xx.
  async function fetchJSON(url, opts = {}, ms = 8000, retries = 0) {
    for (let attempt = 0; ; attempt++) {
      let retryable = true;
      try {
        const res = await fetchWithTimeout(url, opts, ms);
        if (res.status === 429) { setRateLimited(); return null; }
        if (res.ok) return await res.json();
        retryable = res.status >= 500;
      } catch { /* red o tiempo agotado: se puede reintentar */ }
      if (!retryable || attempt >= retries || isRateLimited()) return null;
      await new Promise((r) => setTimeout(r, 800 * 2 ** attempt));
    }
  }

  // ─── DOM ───────────────────────────────────────────────────────────────────
  // el('a', { class: 'card', href: url, text: 'Hola' }, [hijo1, hijo2])
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : v);
    }
    for (const c of [].concat(children)) {
      if (c === null || c === undefined || c === false) continue;
      node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return node;
  }

  // Icono SVG a partir de un <template id="icon-..."> o de un path simple
  function icon(pathD, { size = 20, fill = false } = {}) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    if (fill) { svg.setAttribute('fill', 'currentColor'); }
    else {
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
    }
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', pathD);
    svg.append(p);
    return svg;
  }
  const ICONS = {
    play: 'M8 5v14l11-7z',
    close: 'M18 6 6 18M6 6l12 12',
    prev: 'M15 18l-6-6 6-6',
    next: 'M9 18l6-6-6-6',
  };

  // <dialog> con cierre al pulsar fuera; devuelve funciones open/close
  function setupDialog(dialog, { onClose } = {}) {
    if (!dialog || dialog._setup) return dialog?._setup;
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => onClose && onClose());
    dialog._setup = {
      open() { if (!dialog.open) dialog.showModal(); },
      close() { if (dialog.open) dialog.close(); },
    };
    return dialog._setup;
  }

  // ─── Ventana modal de detalle (proyectos, juegos, tienda) ─────────────────
  // showMediaDialog({ media: Node, kicker, title, desc, actions: [Node], onClose })
  let mediaDialog = null;
  let mediaOnClose = null;
  function ensureMediaDialog() {
    if (mediaDialog) return mediaDialog;
    const closeBtn = el('button', { class: 'modal__close icon-btn', type: 'button', 'aria-label': t('a11y.close', 'Close') },
      [icon(ICONS.close)]);
    closeBtn.addEventListener('click', () => mediaDialog.close());
    mediaDialog = el('dialog', { class: 'modal', 'aria-labelledby': 'media-dialog-title' }, [
      el('div', { class: 'modal__panel' }, [
        closeBtn,
        el('div', { class: 'modal__media-col' }, [
          el('div', { class: 'modal__media' }),
          el('dl', { class: 'modal__stats' }),
        ]),
        el('div', { class: 'modal__body' }, [
          el('div', { class: 'modal__head' }, [
            el('img', { class: 'modal__icon', alt: '', width: 64, height: 64 }),
            el('div', { class: 'modal__heading' }, [
              el('p', { class: 'modal__kicker' }),
              el('h2', { class: 'modal__title', id: 'media-dialog-title' }),
            ]),
          ]),
          el('ul', { class: 'modal__chips' }),
          el('div', { class: 'modal__desc' }),
          el('div', { class: 'modal__actions' }),
        ]),
      ]),
    ]);
    document.body.append(mediaDialog);
    setupDialog(mediaDialog, {
      onClose() {
        mediaDialog.querySelector('.modal__media').replaceChildren(); // detiene vídeos
        if (mediaOnClose) { const fn = mediaOnClose; mediaOnClose = null; fn(); }
      },
    });
    document.addEventListener('languageLoaded', () => closeBtn.setAttribute('aria-label', t('a11y.close', 'Close')));
    return mediaDialog;
  }

  // Opciones extra (ventana de juego): layout 'split', icon (url), chips [texto], stats [{ label, value, tone }]
  function showMediaDialog({ media, kicker = '', title = '', desc = '', actions = [], onClose = null,
    layout = 'stack', icon: iconUrl = null, chips = [], stats = [] }) {
    const dlg = ensureMediaDialog();
    const q = (s) => dlg.querySelector(s);
    dlg.classList.toggle('modal--split', layout === 'split');
    q('.modal__media').replaceChildren(...(media ? [media] : []));
    q('.modal__media').hidden = !media;
    const iconEl = q('.modal__icon');
    iconEl.hidden = !iconUrl;
    if (iconUrl) iconEl.src = iconUrl; else iconEl.removeAttribute('src');
    q('.modal__chips').replaceChildren(...chips.filter(Boolean).map((c) => el('li', { class: 'chip', text: c })));
    q('.modal__chips').hidden = !chips.filter(Boolean).length;
    q('.modal__stats').replaceChildren(...stats.map((s) => el('div', { class: 'modal__stat' + (s.tone ? ` modal__stat--${s.tone}` : '') }, [
      el('dt', { text: s.label }), el('dd', { text: s.value }),
    ])));
    q('.modal__stats').hidden = stats.length === 0;
    q('.modal__kicker').textContent = kicker;
    q('.modal__kicker').hidden = !kicker;
    q('.modal__title').textContent = title;
    const descEl = q('.modal__desc');
    descEl.textContent = desc ? desc.trim() : '';
    descEl.hidden = !desc || !desc.trim();
    q('.modal__actions').replaceChildren(...actions);
    q('.modal__actions').hidden = actions.length === 0;
    mediaOnClose = onClose;
    dlg._setup.open();
    return dlg;
  }

  // Confirmación simple → Promise<boolean>
  let confirmDialog = null;
  function confirmAction({ title, text, ok, cancel }) {
    if (!confirmDialog) {
      confirmDialog = el('dialog', { class: 'modal modal--small', 'aria-labelledby': 'confirm-title' }, [
        el('form', { method: 'dialog', class: 'modal__panel modal__panel--small' }, [
          el('h2', { class: 'modal__title', id: 'confirm-title' }),
          el('p', { class: 'modal__text' }),
          el('div', { class: 'modal__actions' }, [
            el('button', { class: 'btn btn--outline', value: 'cancel', type: 'submit' }),
            el('button', { class: 'btn btn--primary', value: 'ok', type: 'submit' }),
          ]),
        ]),
      ]);
      document.body.append(confirmDialog);
      setupDialog(confirmDialog);
    }
    const q = (s) => confirmDialog.querySelector(s);
    q('.modal__title').textContent = title;
    q('.modal__text').textContent = text;
    q('button[value="cancel"]').textContent = cancel;
    q('button[value="ok"]').textContent = ok;
    confirmDialog.returnValue = '';
    return new Promise((resolve) => {
      confirmDialog.addEventListener('close', () => resolve(confirmDialog.returnValue === 'ok'), { once: true });
      confirmDialog.showModal();
      q('button[value="ok"]').focus();
    });
  }

  // Formato compacto: 1.4M+, 12K+
  function compact(n) {
    if (n >= 1_000_000) {
      const m = n / 1_000_000;
      return (Number.isInteger(m) ? m : m.toFixed(1)) + 'M+';
    }
    if (n >= 1_000) return Math.floor(n / 1000) + 'K+';
    return String(n);
  }

  window.U = {
    base,
    asset: (path) => base + path,
    t, tf, store, cache, isRateLimited, setRateLimited,
    fetchWithTimeout, fetchJSON, el, icon, ICONS, setupDialog, compact,
    showMediaDialog, confirmAction,
  };
})();

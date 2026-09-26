// js/i18n.js — Language handling.
// Saved choice → browser language → English. Elements with data-i18n="key" get their text
// replaced; with data-i18n-attr="aria-label" (or any attribute) that attribute is set instead.

(function () {
  'use strict';

  const SUPPORTED = ['es', 'en', 'pt'];
  const buttons = document.querySelectorAll('button[data-lang]');

  function detect() {
    const saved = window.U.store.get('locale');
    if (SUPPORTED.includes(saved)) return saved;
    const nav = (navigator.languages && navigator.languages[0]) || navigator.language || '';
    const code = nav.slice(0, 2).toLowerCase();
    return SUPPORTED.includes(code) ? code : 'en';
  }

  let current = detect();
  window.translations = window.translations || {};

  function apply(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((node) => {
      const text = window.U.t(node.getAttribute('data-i18n'), null);
      if (text === null) return;
      const attr = node.getAttribute('data-i18n-attr');
      if (attr) node.setAttribute(attr, text);
      else node.textContent = text;
    });
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === current)));
  }

  async function load(lang) {
    try {
      const res = await fetch(`${window.U.base}locales/${lang}.json`);
      if (!res.ok) throw new Error(`no locale file for ${lang}`);
      window.translations = await res.json();
      document.documentElement.lang = lang;
      apply();
      document.dispatchEvent(new CustomEvent('languageLoaded', { detail: { lang } }));
    } catch (e) {
      console.error('i18n:', e);
    }
  }

  buttons.forEach((b) => {
    b.addEventListener('click', () => {
      if (b.dataset.lang === current) return;
      current = b.dataset.lang;
      window.U.store.set('locale', current);
      load(current);
    });
  });

  window.I18N = { apply, get lang() { return current; } };
  load(current);
})();

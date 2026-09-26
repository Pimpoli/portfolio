// js/i18n.js — Sistema de idiomas
// Orden de elección: idioma guardado ("locale") → idioma del navegador → inglés.
// Reemplaza el texto de los elementos con data-i18n="clave" y, si tienen
// data-i18n-attr="aria-label" (u otro atributo), traduce ese atributo en su lugar.

(function () {
  'use strict';

  const SUPPORTED = ['es', 'en', 'pt'];
  // Puede haber varios selectores (cabecera y menú móvil); todos se mantienen sincronizados
  const switchers = document.querySelectorAll('select[data-lang-switch], #languageSwitcher');

  function detectLanguage() {
    const saved = window.U.store.get('locale');
    if (SUPPORTED.includes(saved)) return saved;
    const nav = (navigator.languages && navigator.languages[0]) || navigator.language || '';
    const code = nav.slice(0, 2).toLowerCase();
    return SUPPORTED.includes(code) ? code : 'en';
  }

  let current = detectLanguage();
  window.translations = window.translations || {};

  function apply(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const text = window.U.t(el.getAttribute('data-i18n'), null);
      if (text === null) return;
      const attr = el.getAttribute('data-i18n-attr');
      if (attr) el.setAttribute(attr, text);
      else el.textContent = text;
    });
  }

  async function load(lang) {
    try {
      const res = await fetch(`${window.U.base}locales/${lang}.json`);
      if (!res.ok) throw new Error(`No locale file for ${lang}`);
      window.translations = await res.json();
      document.documentElement.lang = lang;
      apply();
      document.dispatchEvent(new CustomEvent('languageLoaded', { detail: { lang } }));
    } catch (e) {
      console.error('i18n error:', e);
    }
  }

  switchers.forEach((sel) => {
    sel.value = current;
    sel.addEventListener('change', () => {
      current = sel.value;
      switchers.forEach((other) => { other.value = current; });
      window.U.store.set('locale', current);
      load(current);
    });
  });

  window.I18N = { apply, get lang() { return current; } };
  load(current);
})();

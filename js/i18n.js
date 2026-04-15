// i18n.js — Sistema de idiomas (guarda en "locale", inglés por defecto en primera visita)

const languageSwitcher = document.getElementById('languageSwitcher');

// Primera visita → inglés. Visitas siguientes → lo que guardó el usuario.
let currentLanguage = localStorage.getItem('locale') || 'en';
window.translations = {};

function applyTranslations(translations) {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key   = el.getAttribute('data-i18n');
    const parts = key.split('.');
    let text    = translations;
    for (const part of parts) {
      if (text && Object.prototype.hasOwnProperty.call(text, part)) {
        text = text[part];
      } else { text = null; break; }
    }
    if (typeof text !== 'string') return;
    const attr = el.getAttribute('data-i18n-atr');
    if (attr) { el.setAttribute(attr, text); } else { el.innerText = text; }
  });
}

async function loadLanguage(lang) {
  try {
    // Soporte para páginas en subdirectorios (MultiGameInc/, Game-1/, etc.)
    const base = document.querySelector('meta[name="locale-base"]')?.content || '';
    const res  = await fetch(`${base}locales/${lang}.json`);
    if (!res.ok) throw new Error(`No locale file for ${lang}`);
    const translations = await res.json();
    window.translations = translations;
    applyTranslations(translations);
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);
    document.dispatchEvent(new CustomEvent('languageLoaded', { detail: { lang, translations } }));
  } catch (e) {
    console.error('i18n error:', e);
  }
}

function initLanguageSwitcher() {
  if (!languageSwitcher) return;
  languageSwitcher.value = currentLanguage;
  languageSwitcher.addEventListener('change', () => {
    currentLanguage = languageSwitcher.value;
    localStorage.setItem('locale', currentLanguage);
    loadLanguage(currentLanguage);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initLanguageSwitcher();
  loadLanguage(currentLanguage);
});

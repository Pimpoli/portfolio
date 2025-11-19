// i18n.js
// (archivo completo) — sólo carga traducciones; removí el intento de fetch a la API de juegos.
const languageSwitcher = document.getElementById("languageSwitcher");
let currentLanguage = localStorage.getItem("lang") || "en";

async function loadLanguage(lang) {
  try {
    const response = await fetch(`locales/${lang}.json`);
    if (!response.ok) throw new Error("Language JSON not found");
    const translations = await response.json();

    const i18nElements = document.querySelectorAll("[data-i18n]");
    i18nElements.forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const parts = key.split(".");
      let text = translations;
      for (let part of parts) {
        if (text[part] !== undefined) {
          text = text[part];
        } else {
          console.warn(`Key '${key}' not found in ${lang} translations.`);
          text = null;
          break;
        }
      }
      if (text !== null) el.innerText = text;
    });

    if (["ar"].includes(lang)) {
      document.documentElement.setAttribute("dir", "rtl");
    } else {
      document.documentElement.setAttribute("dir", "ltr");
    }
  } catch (error) {
    console.error("Error loading language:", error);
  }
}

function initLanguageSwitcher() {
  if (!languageSwitcher) return;
  languageSwitcher.value = currentLanguage;
  languageSwitcher.addEventListener("change", () => {
    currentLanguage = languageSwitcher.value;
    localStorage.setItem("lang", currentLanguage);
    loadLanguage(currentLanguage);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initLanguageSwitcher();
  loadLanguage(currentLanguage);
});

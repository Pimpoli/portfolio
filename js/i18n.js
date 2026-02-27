// i18n.js
const languageSwitcher = document.getElementById("languageSwitcher");
let currentLanguage = localStorage.getItem("lang") || "en";
window.translations = {}; // Make translations globally available

// Function to apply translations to elements with data-i18n attribute
function applyTranslations(translations) {
  const i18nElements = document.querySelectorAll("[data-i18n]");
  i18nElements.forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const parts = key.split(".");
    let text = translations;
    for (let part of parts) {
      if (text && text.hasOwnProperty(part)) {
        text = text[part];
      } else {
        text = null; // Key not found
        break;
      }
    }
    if (typeof text === 'string') {
      // Use data-i18n-atr to set an attribute instead of innerText
      const targetAttr = el.getAttribute("data-i18n-atr");
      if (targetAttr) {
        el.setAttribute(targetAttr, text);
      } else {
        el.innerText = text;
      }
    }
  });
}

async function loadLanguage(lang) {
  try {
    const response = await fetch(`locales/${lang}.json`);
    if (!response.ok) throw new Error(`Language file not found for ${lang}`);
    const translations = await response.json();
    window.translations = translations; // Store loaded translations

    applyTranslations(translations); // Apply to static elements

    // Set document direction for RTL languages
    if (["ar"].includes(lang)) {
      document.documentElement.setAttribute("dir", "rtl");
    } else {
      document.documentElement.setAttribute("dir", "ltr");
    }

    // Dispatch a custom event to notify other scripts that the language has loaded
    document.dispatchEvent(new CustomEvent('languageLoaded', { detail: { lang: lang, translations: translations } }));

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
    loadLanguage(currentLanguage); // Reload translations for the new language
  });
}

// Initial load
document.addEventListener('DOMContentLoaded', () => {
  initLanguageSwitcher();
  loadLanguage(currentLanguage);
});

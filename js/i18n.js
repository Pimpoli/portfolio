/**
 * i18n.js
 * Maneja la carga dinámica de traducciones según el idioma seleccionado.
 * Los archivos de traducción están en la carpeta /locales (en.json, es.json, etc.).
 */

const languageSwitcher = document.getElementById("languageSwitcher");
const i18nElements = document.querySelectorAll("[data-i18n]");
let currentLanguage = localStorage.getItem("lang") || "en";

/**
 * Carga el archivo JSON correspondiente al idioma y aplica las traducciones.
 * @param {string} lang - Código de idioma (ej: "en", "es", "zh-CN", "ar").
 */
async function loadLanguage(lang) {
  try {
    const response = await fetch(`locales/${lang}.json`);
    if (!response.ok) {
      throw new Error("Language JSON not found");
    }
    const translations = await response.json();

    // Recuenta dinámicamente todos los elementos con data-i18n
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

      if (text !== null) {
        el.innerText = text;
      }
    });

    // Ajuste de dirección RTL si el idioma lo requiere (ej: árabe)
    if (["ar"].includes(lang)) {
      document.documentElement.setAttribute("dir", "rtl");
    } else {
      document.documentElement.setAttribute("dir", "ltr");
    }
  } catch (error) {
    console.error("Error loading language:", error);
  }
}

/**
 * Reemplaza el contenido de cada elemento con data-i18n.
 * Soporta claves anidadas con punto (ej: "about.title").
 * @param {object} translations - Objeto JSON con las traducciones.
 */
function applyTranslations(translations) {
  i18nElements.forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const parts = key.split(".");
    let text = translations;
    for (let part of parts) {
      if (text[part] !== undefined) {
        text = text[part];
      } else {
        console.warn(`Key '${key}' not found in ${currentLanguage} translations.`);
        text = null;
        break;
      }
    }
    if (text !== null) {
      el.innerText = text;
    }
  });

  // Ajuste de dirección RTL si el idioma requiere (ej: árabe)
  if (["ar"].includes(currentLanguage)) {
    document.documentElement.setAttribute("dir", "rtl");
  } else {
    document.documentElement.setAttribute("dir", "ltr");
  }
}

/**
 * Al cambiar el select de idioma, guarda la preferencia y recarga las traducciones.
 */
languageSwitcher.addEventListener("change", () => {
  currentLanguage = languageSwitcher.value;
  localStorage.setItem("lang", currentLanguage);
  loadLanguage(currentLanguage);
});

/**
 * Inicializa el selector con el idioma actual guardado.
 */
function initLanguageSwitcher() {
  languageSwitcher.value = currentLanguage;
}

// Ejecutar al cargar la página
document.addEventListener('DOMContentLoaded', () => {
  initLanguageSwitcher();
  loadLanguage(currentLanguage);

  const gamesContainer = document.getElementById('games-container');
  // IDs de los tres juegos
  const firstGames = [16125269940, 71541333892738];
  const thirdGame = 17166282321;

  // Función para cargar un juego (obtener nombre e ícono)
  function loadGame(universeId) {
    // Obtener datos del juego (nombre) usando la API v1
    fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`)
      .then(response => response.json())
      .then(data => {
        if (!data.data || data.data.length === 0) {
          console.error('Juego no encontrado:', universeId);
          return;
        }
        const gameInfo = data.data[0];
        const gameName = gameInfo.name || 'Juego sin nombre';

        // Obtener ícono del juego usando la API de thumbnails
        fetch(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&size=150x150&format=Png&isCircular=false`)
          .then(res => res.json())
          .then(iconData => {
            let iconUrl = '';
            if (iconData.data && iconData.data[0]) {
              iconUrl = iconData.data[0].imageUrl;
            }

            // Crear elementos para mostrar el juego
            const gameDiv = document.createElement('div');
            gameDiv.className = 'game-item';

            const img = document.createElement('img');
            img.src = iconUrl;
            img.alt = gameName;

            const title = document.createElement('p');
            title.textContent = gameName;

            gameDiv.appendChild(img);
            gameDiv.appendChild(title);
            gamesContainer.appendChild(gameDiv);
          })
          .catch(err => console.error('Error al cargar ícono:', err));
      })
      .catch(err => console.error('Error al cargar datos del juego:', err));
  }

  // Cargar al inicio los dos primeros juegos
  firstGames.forEach(id => loadGame(id));

  // Configurar evento clic para cargar el tercer juego
  document.getElementById('load-more').addEventListener('click', () => {
    loadGame(thirdGame);
    // (Opcional) Desactivar el botón después de cargar
    document.getElementById('load-more').disabled = true;
  });
});


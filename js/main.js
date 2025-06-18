// main.js

const hamburger = document.getElementById("hamburger");
const navList = document.querySelector(".nav-list");
const navLinks = document.querySelectorAll(".nav-link");
const themeToggle = document.getElementById("theme-toggle");
const themeIconImg = document.getElementById("theme-icon-img");
let currentTheme = localStorage.getItem("theme") || "dark";

const yearSpan = document.getElementById("year");
const gamesContainer = document.getElementById("games-container");

// IDs de juegos:
const ROBLOX_GAME_IDS = [
  16125269940,
  71541333892738
];
// El tercero (17166282321) se muestra en #more-games ya en HTML

const ROBLOX_USER_ID = 3404416545; // tu ID real de Roblox

// =====================
// Toggle tema oscuro/ligero
// =====================
function applyTheme(theme) {
  if (theme === "light") {
    themeIconImg.src = "img/moon.Webp"; // ícono de sol en modo light
    document.body.classList.add("light-mode");
  } else {
    themeIconImg.src = "img/sun.Webp";  // ícono de luna en modo dark
    document.body.classList.remove("light-mode");
  }
  localStorage.setItem("theme", theme);
}

applyTheme(currentTheme);

themeToggle.addEventListener("click", () => {
  currentTheme = currentTheme === "dark" ? "light" : "dark";
  applyTheme(currentTheme);
});

// =====================
// Scroll suave al hacer clic en enlaces internos
// =====================
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener("click", function (e) {
      const href = this.getAttribute("href");
      if (href === "#") return;
      e.preventDefault();
      const targetID = href.slice(1);
      const targetSection = document.getElementById(targetID);
      if (targetSection) {
        targetSection.scrollIntoView({ behavior: "smooth" });
      }
      if (navList.classList.contains("active")) {
        navList.classList.remove("active");
      }
    });
  });
}

// ===============================
// Carga dinámica de juegos de Roblox
// ===============================
async function fetchRobloxGameInfo(gameId) {
  try {
    const infoRes = await fetch(`https://games.roblox.com/v1/games?universeIds=${gameId}`);
    const infoData = await infoRes.json();
    if (!infoData.data || !infoData.data[0]) {
      console.warn(`No se encontró data para universeId=${gameId}`);
      return { id: gameId, name: null, iconUrl: null };
    }
    const name = infoData.data[0].name || null;

    const thumbRes = await fetch(
      `https://thumbnails.roblox.com/v1/games/icons?universeIds=${gameId}&size=100x100&format=Webp&isCircular=false`
    );
    const thumbData = await thumbRes.json();
    const iconUrl = (thumbData.data && thumbData.data[0] && thumbData.data[0].imageUrl) || null;

    return { id: gameId, name, iconUrl };
  } catch (err) {
    console.error("Error en fetchRobloxGameInfo:", err);
    return { id: gameId, name: null, iconUrl: null };
  }
}

async function loadGames() {
  const gamesContainer = document.getElementById("games-container");
  if (!gamesContainer) {
    console.error("games-container no existe en el DOM.");
    return;
  }

  const ROBLOX_GAME_IDS = [16125269940, 71541333892738];
  const resultados = await Promise.all(ROBLOX_GAME_IDS.map(id => fetchRobloxGameInfo(id)));

  resultados.forEach((game) => {
    if (!game.name || !game.iconUrl) {
      // Mostrar un mensaje visible en lugar de solo ignorar
      const aviso = document.createElement("p");
      aviso.textContent = `No se pudo cargar el juego ID ${game.id}.`;
      aviso.style.color = "var(--color-text-light)";
      aviso.style.background = "rgba(255,0,0,0.2)";
      aviso.style.padding = "4px";
      aviso.style.borderRadius = "4px";
      gamesContainer.appendChild(aviso);
      return;
    }
    const card = document.createElement("div");
    card.classList.add("game-card");
    card.innerHTML = `
      <a href="https://www.roblox.com/games/${game.id}" target="_blank" rel="noopener">
        <img src="${game.iconUrl}" alt="${game.name}" />
        <p>${game.name}</p>
      </a>
    `;
    gamesContainer.appendChild(card);
  });
}
// ===============================
// Scroll-trigger (Intersection Observer)
// ===============================
function initFadeInObserver() {
  const options = { root: null, rootMargin: "0px", threshold: 0.2 };
  const callback = (entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  };
  const observer = new IntersectionObserver(callback, options);
  document.querySelectorAll(".fade-in").forEach(el => {
    observer.observe(el);
  });
}
// ===============================
// Estado del avatar de Roblox (presencia)
// ===============================
async function updateAvatarStatus(userId) {
  try {
    const res = await fetch('https://presence.roproxy.com/v1/presence/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds: [userId] })
    });
    const data = await res.json();
    const p = data.userPresences?.[0];
    if (!p) return;

    const type = p.userPresenceType;  // <- CORRECCIÓN aquí
    const container = document.getElementById('avatar-container');
    container.classList.remove('avatar-offline','avatar-online','avatar-inGame','avatar-studio','avatar-invisible');

    switch (type) {
      case 1:
        container.classList.add('avatar-online');
        break;
      case 2:
        container.classList.add('avatar-inGame');
        break;
      case 3:
        container.classList.add('avatar-studio');
        break;
      case 4:
        container.classList.add('avatar-invisible');
        break;
      default:
        container.classList.add('avatar-offline');
    }
  } catch (err) {
    console.error(err);
    const container = document.getElementById('avatar-container');
    container.classList.remove('avatar-online','avatar-inGame','avatar-studio');
    container.classList.add('avatar-offline');
  }
}

// ==================================
// Explicación del problema del estado
// ==================================
// La API de presencia de Roblox bloquea solicitudes desde orígenes no autorizados (CORS).
// Si tu página no está alojada en un dominio permitido por Roblox o no usas HTTPS, la petición
// será bloqueada y nunca verás cambio de estado (se quedará siempre en gris).
// **Solución**: aloja en un hosting con HTTPS que Roblox reconozca, o configura un proxy 
// backend que requiera credenciales apropiadas. Roblox necesita el header 'Referer' desde
// un dominio válido (por ejemplo, un dominio público que hayas registrado en la configuración de tu aplicación).

// ===============================
// Expandir/colapsar secciones con “+”
// ===============================
function initExpandButtons() {
  document.querySelectorAll(".expand-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const container = document.getElementById(targetId);
      if (!container) return;

      if (container.classList.contains("visible-content")) {
        container.classList.remove("visible-content");
        btn.textContent = "+";
      } else {
        container.classList.add("visible-content");
        btn.textContent = "−";
      }
    });
  });
}

// ===============================
// Menú móvil
// ===============================
function initMobileMenu() {
  hamburger.addEventListener("click", () => {
    navList.classList.toggle("active");
  });
}

// ===============================
// Inicialización al cargar la página
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  const today = new Date();
  yearSpan.textContent = today.getFullYear();

  initMobileMenu();
  initSmoothScroll();
  initFadeInObserver();

  // Cargar avatar por primera vez
  loadAvatar(ROBLOX_USER_ID);

  // Cargar juegos
  loadGames();

  // Actualizar estado de avatar cada 60s
  updateAvatarStatus(ROBLOX_USER_ID);
  setInterval(() => updateAvatarStatus(ROBLOX_USER_ID), 60000);

  initExpandButtons();
});

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

const ROBLOX_USER_ID = 3404416545; // tu ID real de Roblox

// =====================
// Toggle tema oscuro/ligero (muestra icono del estado destino)
// =====================
function applyTheme(theme) {
  const body = document.body;
  if (theme === "light") {
    body.classList.add("light-mode");
  } else {
    body.classList.remove("light-mode");
  }

  if (themeIconImg) {
    // Si la página está en "light", mostrar luna (para cambiar a dark).
    // Si la página está en "dark", mostrar sol (para cambiar a light).
    if (theme === "light") {
      themeIconImg.src = "img/moon.webp";
      themeIconImg.alt = "Switch to dark theme";
    } else {
      themeIconImg.src = "img/sun.webp";
      themeIconImg.alt = "Switch to light theme";
    }
  }

  localStorage.setItem("theme", theme);
}

applyTheme(currentTheme);

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    currentTheme = currentTheme === "dark" ? "light" : "dark";
    applyTheme(currentTheme);
  });
}

// =====================
// Smooth scroll for internal links
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
      if (navList && navList.classList.contains("active")) {
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
  const gamesContainerLocal = document.getElementById("games-container");
  if (!gamesContainerLocal) {
    console.error("games-container no existe en el DOM.");
    return;
  }

  const resultados = await Promise.all(ROBLOX_GAME_IDS.map(id => fetchRobloxGameInfo(id)));

  resultados.forEach((game) => {
    if (!game.name || !game.iconUrl) {
      const aviso = document.createElement("p");
      aviso.textContent = `No se pudo cargar el juego ID ${game.id}.`;
      aviso.style.color = "var(--color-text-light)";
      aviso.style.background = "rgba(255,0,0,0.2)";
      aviso.style.padding = "4px";
      aviso.style.borderRadius = "4px";
      gamesContainerLocal.appendChild(aviso);
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
    gamesContainerLocal.appendChild(card);
  });
}

// ===============================
// Intersection Observer: fade-in
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
// Estado del avatar de Roblox (presencia) - FIXED
// - Mapea explícitamente los códigos posibles (0..4).
// - Maneja distintas formas de respuesta (userPresences / data).
// - Fallback a 'avatar-offline' si no hay dato o falla (CORS).
// ===============================
async function updateAvatarStatus(userId) {
  try {
    const res = await fetch('https://presence.roproxy.com/v1/presence/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds: [userId] })
    });

    if (!res.ok) {
      console.warn('Presence API responded with status', res.status);
      throw new Error('Presence fetch failed');
    }

    const data = await res.json();

    // Algunas respuestas pueden venir en data.userPresences o en data.data
    const presArray = data.userPresences || data.data || data.presences || null;
    const p = Array.isArray(presArray) ? presArray[0] : null;

    // Los campos comunes son userPresenceType o presenceType dependiendo de la API
    const type = p?.userPresenceType ?? p?.presenceType ?? null;

    const container = document.getElementById('avatar-container');
    if (!container) return;

    // Limpiar clases de estado previas
    container.classList.remove('avatar-offline', 'avatar-online', 'avatar-inGame', 'avatar-studio', 'avatar-invisible');

    // Mapeo explícito de códigos a clases (evita index-out-of-range)
    const map = {
      0: 'avatar-offline',   // offline
      1: 'avatar-online',    // online (in website)
      2: 'avatar-inGame',    // in game
      3: 'avatar-studio',    // in studio
      4: 'avatar-invisible'  // invisible / private
    };

    const cls = (type !== null && map.hasOwnProperty(type)) ? map[type] : 'avatar-offline';
    container.classList.add(cls);

    // (Opcional) también actualizar title para debugging/UX
    container.title = `Presence: ${cls.replace('avatar-','')}`;

  } catch (err) {
    console.error("updateAvatarStatus error:", err);
    // Fallback -> offline
    const container = document.getElementById('avatar-container');
    if (!container) return;
    container.classList.remove('avatar-online', 'avatar-inGame', 'avatar-studio', 'avatar-invisible');
    container.classList.add('avatar-offline');
    container.title = 'Presence: offline (fallback)';
  }
}

// Función para cargar avatar (headshot) y asignar al #avatar-img
async function loadAvatar(userId) {
  try {
    const res = await fetch(`https://thumbnails.roproxy.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Webp&isCircular=false`);
    if (!res.ok) throw new Error('Avatar thumbnail fetch failed');
    const data = await res.json();
    const url = data.data?.[0]?.imageUrl;
    if (url) {
      const avatarImg = document.getElementById('avatar-img');
      if (avatarImg) avatarImg.src = url;
    }
  } catch (err) {
    console.error("Error cargando avatar:", err);
  }
}

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
  if (!hamburger || !navList) return;
  hamburger.addEventListener("click", () => {
    navList.classList.toggle("active");
  });
}

// ===============================
// Inicialización al cargar la página
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  const today = new Date();
  if (yearSpan) yearSpan.textContent = today.getFullYear();

  initMobileMenu();
  initSmoothScroll();
  initFadeInObserver();

  // Cargar avatar por primera vez
  loadAvatar(ROBLOX_USER_ID);

  // Cargar juegos
  loadGames();

  // Intentar actualizar estado de avatar (si CORS lo permite)
  updateAvatarStatus(ROBLOX_USER_ID);
  setInterval(() => updateAvatarStatus(ROBLOX_USER_ID), 60000);

  initExpandButtons();
});

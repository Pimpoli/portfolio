// main.js
// (archivo completo)
const hamburger = document.getElementById("hamburger");
const navList = document.querySelector(".nav-list");
const navLinks = document.querySelectorAll(".nav-link");
const themeToggle = document.getElementById("theme-toggle");
const themeIconImg = document.getElementById("theme-icon-img");
let currentTheme = localStorage.getItem("theme") || "dark";

const yearSpan = document.getElementById("year");

// Cambia esto por la URL de tu Worker desplegado, por ejemplo:
// const PRESENCE_PROXY = 'https://mi-worker.workers.dev/presence';
const PRESENCE_PROXY = 'https://your-worker-url.workers.dev/presence';

const ROBLOX_USER_ID = 3404416545; // tu ID real de Roblox

// =====================
// Toggle tema oscuro/ligero
// =====================
function applyTheme(theme) {
  const body = document.body;
  if (theme === "light") {
    body.classList.add("light-mode");
  } else {
    body.classList.remove("light-mode");
  }

  if (themeIconImg) {
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
// Avatar: carga headshot
// ===============================
async function loadAvatar(userId) {
  try {
    const res = await fetch(`https://thumbnails.roproxy.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Webp&isCircular=false`);
    if (!res.ok) throw new Error('Avatar thumbnail fetch failed: ' + res.status);
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
// Estado del avatar: usa el proxy (Worker) para evitar CORS
// ===============================
async function updateAvatarStatus(userId) {
  const container = document.getElementById('avatar-container');
  if (!container) return;

  // estado temporal
  container.classList.remove('avatar-online','avatar-inGame','avatar-studio','avatar-invisible');
  container.classList.add('avatar-offline');
  container.title = 'Detectando presencia...';

  try {
    // Build body
    const body = JSON.stringify({ userIds: [userId] });

    // Si no has desplegado el Worker, esto fallará: revisa la URL en PRESENCE_PROXY.
    const res = await fetch(PRESENCE_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });

    console.log('Presence proxy status', res.status);
    if (!res.ok) {
      const txt = await res.text().catch(()=>'(no text)');
      console.warn('Presence proxy returned not ok:', res.status, txt);
      throw new Error('Presence proxy error');
    }

    const data = await res.json();
    console.log('updateAvatarStatus -> response JSON:', data);

    // Buscar array de presences en varias propiedades posibles
    const presArray = data.userPresences || data.data || data.presences || data.presence || null;
    const p = Array.isArray(presArray) ? presArray[0] : (presArray ?? null);

    const type = p?.userPresenceType ?? p?.presenceType ?? p?.type ?? null;
    console.log('Detected presence type:', type, 'raw object:', p);

    // limpiar clases previas
    container.classList.remove('avatar-offline','avatar-online','avatar-inGame','avatar-studio','avatar-invisible');

    const map = {
      0: 'avatar-offline',
      1: 'avatar-online',
      2: 'avatar-inGame',
      3: 'avatar-studio',
      4: 'avatar-invisible'
    };

    const cls = (type !== null && map.hasOwnProperty(type)) ? map[type] : 'avatar-offline';
    container.classList.add(cls);
    container.title = `Presence: ${cls.replace('avatar-','')}`;
  } catch (err) {
    console.error('updateAvatarStatus error:', err);
    // fallback
    container.classList.remove('avatar-online','avatar-inGame','avatar-studio','avatar-invisible');
    container.classList.add('avatar-offline');
    container.title = 'Presence: offline (fallback)';
  }
}

// ===============================
// Expand buttons & mobile menu
// ===============================
function initExpandButtons() {
  document.querySelectorAll(".expand-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const container = document.getElementById(targetId);
      if (!container) return;
      const showing = container.classList.toggle('visible-content');
      btn.textContent = showing ? '−' : '+';
    });
  });
}

function initMobileMenu() {
  if (!hamburger || !navList) return;
  hamburger.addEventListener("click", () => {
    navList.classList.toggle("active");
  });
}

// ===============================
// Intersection Observer
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
  document.querySelectorAll(".fade-in").forEach(el => observer.observe(el));
}

// ===============================
// Inicialización
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  const today = new Date();
  if (yearSpan) yearSpan.textContent = today.getFullYear();

  initMobileMenu();
  initSmoothScroll();
  initFadeInObserver();

  loadAvatar(ROBLOX_USER_ID);

  // Intentar actualizar estado de avatar (usa worker proxy)
  // IMPORTANTE: reemplaza PRESENCE_PROXY por tu URL del Worker.
  updateAvatarStatus(ROBLOX_USER_ID);
  setInterval(() => updateAvatarStatus(ROBLOX_USER_ID), 60000);

  initExpandButtons();
});

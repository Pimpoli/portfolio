// main.js - Cliente (usa proxy en http://localhost:3000)
// Pega en js/main.js

// -----------------------------
// Configuración / Constantes
// -----------------------------
const hamburger = document.getElementById("hamburger");
const navList = document.querySelector(".nav-list");
const navLinks = document.querySelectorAll(".nav-link");
const themeToggle = document.getElementById("theme-toggle");
const themeIconImg = document.getElementById("theme-icon-img");
let currentTheme = localStorage.getItem("theme") || "dark";

const yearSpan = document.getElementById("year");

// apuntar al proxy local (server.js)
const PRESENCE_PROXY = "http://localhost:3000/api/presence";
const PRESENCE_ROBLOX = "https://presence.roblox.com/v1/presence/users"; // solo fallback remoto
const THUMBNAIL_API = "http://localhost:3000/api/avatar";

const ROBLOX_USER_ID = 3404416545;

// -----------------------------
// Util: timeout fetch (AbortController)
// -----------------------------
async function fetchWithTimeout(url, opts = {}, timeoutMs = 7000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, ...opts });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// -----------------------------
// Theming
// -----------------------------
function applyTheme(theme) {
  const body = document.body;
  if (theme === "light") body.classList.add("light-mode");
  else body.classList.remove("light-mode");
  if (themeIconImg) {
    themeIconImg.src = theme === "light" ? "img/moon.webp" : "img/sun.webp";
    themeIconImg.alt = theme === "light" ? "Switch to dark theme" : "Switch to light theme";
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

// -----------------------------
// Smooth scroll
// -----------------------------
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener("click", function (e) {
      const href = this.getAttribute("href");
      if (href === "#") return;
      e.preventDefault();
      const targetID = href.slice(1);
      const targetSection = document.getElementById(targetID);
      if (targetSection) targetSection.scrollIntoView({ behavior: "smooth" });
      if (navList && navList.classList.contains("active")) navList.classList.remove("active");
    });
  });
}

// -----------------------------
// Cargar avatar (usa proxy image endpoint)
// -----------------------------
async function loadAvatar(userId) {
  const avatarImg = document.getElementById("avatar-img");
  if (!avatarImg) return;

  try {
    avatarImg.src = `${THUMBNAIL_API}/${userId}`;
    avatarImg.alt = "Avatar de Roblox";
    avatarImg.onerror = () => {
      avatarImg.onerror = null;
      avatarImg.src = "img/roblox.webp";
      avatarImg.alt = "Avatar fallback";
      console.warn("[loadAvatar] fallo al cargar desde proxy, usando fallback local");
    };
    console.log("[loadAvatar] cargando avatar desde proxy:", avatarImg.src);
  } catch (err) {
    console.warn("[loadAvatar] error (cliente):", err && err.message ? err.message : err);
    avatarImg.src = "img/roblox.webp";
    avatarImg.alt = "Avatar fallback";
  }
}

// -----------------------------
// Aplicar presencia (clases CSS en container)
// -----------------------------
function applyPresence(type) {
  const container = document.getElementById("avatar-container");
  if (!container) return;
  container.classList.remove("avatar-online", "avatar-inGame", "avatar-studio", "avatar-offline", "avatar-invisible");
  switch (type) {
    case 1:
      container.classList.add("avatar-online");
      container.title = "Online";
      break;
    case 2:
      container.classList.add("avatar-inGame");
      container.title = "In Game";
      break;
    case 3:
      container.classList.add("avatar-studio");
      container.title = "In Roblox Studio";
      break;
    case 4:
      container.classList.add("avatar-invisible");
      container.title = "Invisible / Offline";
      break;
    case 0:
    default:
      container.classList.add("avatar-offline");
      container.title = "Offline";
      break;
  }
}

// -----------------------------
// Parseo tolerante del presence object
// -----------------------------
function resolvePresenceType(presenceObj) {
  if (!presenceObj) return null;
  if (typeof presenceObj.userPresenceType === "number") return presenceObj.userPresenceType;
  if (typeof presenceObj.presenceType === "number") return presenceObj.presenceType;
  if (typeof presenceObj.type === "number") return presenceObj.type;
  const maybeStr = presenceObj.userPresenceType ?? presenceObj.presenceType ?? presenceObj.type;
  if (typeof maybeStr === "string") {
    const n = parseInt(maybeStr, 10);
    if (!Number.isNaN(n)) return n;
  }
  if (typeof presenceObj.lastLocation === "string") {
    if (/studio/i.test(presenceObj.lastLocation)) return 3;
    if (/^\d+$/.test(presenceObj.lastLocation)) return 2;
  }
  if (presenceObj.isOnline === true) return 1;
  if (presenceObj.isOnline === false) return 0;
  if (presenceObj.placeId || (presenceObj.currentPlace && presenceObj.currentPlace.placeId)) return 2;
  return null;
}

// -----------------------------
// Fetch presence via proxy or fallback
// -----------------------------
async function fetchPresenceFrom(endpoint, userId) {
  try {
    const body = JSON.stringify({ userIds: [Number(userId)] });
    const res = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    }, 7000);
    if (!res.ok) {
      console.warn("[fetchPresenceFrom] endpoint", endpoint, "respondió", res.status);
      return null;
    }
    const data = await res.json();
    const arr = data.userPresences ?? data.data ?? data.presences ?? data.presence ?? data;
    if (Array.isArray(arr) && arr.length > 0) return arr[0];
    if (typeof arr === "object" && arr !== null) return arr;
    return null;
  } catch (err) {
    console.warn("[fetchPresenceFrom] error al consultar", endpoint, err && err.message ? err.message : err);
    return null;
  }
}

// -----------------------------
// updateAvatarStatus: usa proxy (PRESENCE_PROXY)
// -----------------------------
async function updateAvatarStatus(userId) {
  const container = document.getElementById("avatar-container");
  if (!container) return;

  container.classList.remove("avatar-online", "avatar-inGame", "avatar-studio", "avatar-offline", "avatar-invisible");
  container.classList.add("avatar-offline");
  container.title = "Detectando presencia...";

  try {
    console.log("[updateAvatarStatus] intentando PRESENCE_PROXY...");
    let pres = await fetchPresenceFrom(PRESENCE_PROXY, userId);
    if (!pres) {
      console.log("[updateAvatarStatus] proxy no devolvió presencia, intentando oficial...");
      pres = await fetchPresenceFrom(PRESENCE_ROBLOX, userId);
    }
    if (!pres) {
      console.warn("[updateAvatarStatus] no se obtuvo presencia válida");
      applyPresence(0);
      return;
    }
    const resolved = resolvePresenceType(pres);
    if (resolved === null || typeof resolved !== "number" || Number.isNaN(resolved)) applyPresence(0);
    else applyPresence(resolved);
  } catch (err) {
    console.error("[updateAvatarStatus] excepción:", err && err.message ? err.message : err);
    applyPresence(0);
  }
}

// -----------------------------
// Expand buttons
// -----------------------------
function initExpandButtons() {
  document.querySelectorAll(".expand-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const container = document.getElementById(targetId);
      if (!container) return;
      const showing = container.classList.toggle("visible-content");
      btn.textContent = showing ? "−" : "+";
    });
  });
}

// -----------------------------
// Mobile menu
// -----------------------------
function initMobileMenu() {
  if (!hamburger || !navList) return;
  hamburger.addEventListener("click", () => {
    navList.classList.toggle("active");
  });
}

// -----------------------------
// Fade-in observer
// -----------------------------
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

// -----------------------------
// Inicialización
// -----------------------------
document.addEventListener("DOMContentLoaded", () => {
  const today = new Date();
  if (yearSpan) yearSpan.textContent = today.getFullYear();

  initMobileMenu();
  initSmoothScroll();
  initFadeInObserver();
  initExpandButtons();

  loadAvatar(ROBLOX_USER_ID);

  updateAvatarStatus(ROBLOX_USER_ID);
  const presenceInterval = setInterval(() => updateAvatarStatus(ROBLOX_USER_ID), 60_000);

  window.addEventListener("beforeunload", () => {
    clearInterval(presenceInterval);
  });
});

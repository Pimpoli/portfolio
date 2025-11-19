// main.js - Versión robusta (sin controles de simulación, presencia automática y fallback de thumbnail)
// ------------------------------------------------------------

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

// ENDPOINT de presencia público (RoProxy evita CORS desde navegador)
const PRESENCE_PROXY = "https://presence.roproxy.com/v1/presence/users";
// Intento alternativo (fallback) — puede o no funcionar desde navegador según CORS
const PRESENCE_ROBLOX = "https://presence.roblox.com/v1/presence/users";

// Thumbnails (Roblox)
const THUMBNAIL_API = "https://thumbnails.roblox.com/v1/users/avatar-headshot";

// Tu ID de Roblox (cámbialo si necesitas)
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
// Theming (dark / light)
// -----------------------------
function applyTheme(theme) {
  const body = document.body;
  if (theme === "light") body.classList.add("light-mode");
  else body.classList.remove("light-mode");

  if (themeIconImg) {
    // icon representa la acción que ocurrirá al pulsar (no el estado actual)
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
// Smooth scroll (internal anchors)
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
// Avatar: carga headshot (thumbnail) con fallback
// -----------------------------
async function loadAvatar(userId) {
  const avatarImg = document.getElementById("avatar-img");
  if (!avatarImg) return;

  // Primero tratamos la API oficial
  try {
    const url = new URL(THUMBNAIL_API);
    url.searchParams.set("userIds", String(userId));
    url.searchParams.set("size", "150x150");
    url.searchParams.set("format", "Png");
    url.searchParams.set("isCircular", "false"); // mejor false si queremos controlar el border

    console.log("[loadAvatar] fetch thumbnail:", url.toString());
    const res = await fetchWithTimeout(url.toString(), { method: "GET" }, 7000);
    if (!res.ok) throw new Error("Thumbnail API returned " + res.status);
    const json = await res.json();
    console.log("[loadAvatar] thumbnail response:", json);
    const imageUrl = json?.data?.[0]?.imageUrl;
    if (imageUrl) {
      avatarImg.src = imageUrl;
      avatarImg.alt = "Avatar de Roblox";
      return;
    } else {
      throw new Error("No imageUrl in thumbnail response");
    }
  } catch (err) {
    console.warn("[loadAvatar] primer intento falló:", err && err.message ? err.message : err);
    // Intentar fallback: probar variación con isCircular=true o tamaño distinto
    try {
      const url2 = new URL(THUMBNAIL_API);
      url2.searchParams.set("userIds", String(userId));
      url2.searchParams.set("size", "100x100");
      url2.searchParams.set("format", "Png");
      url2.searchParams.set("isCircular", "true");
      console.log("[loadAvatar] intento fallback thumbnail:", url2.toString());
      const res2 = await fetchWithTimeout(url2.toString(), { method: "GET" }, 7000);
      if (res2.ok) {
        const j2 = await res2.json();
        const img2 = j2?.data?.[0]?.imageUrl;
        if (img2) {
          avatarImg.src = img2;
          avatarImg.alt = "Avatar de Roblox (fallback)";
          return;
        }
      }
      throw new Error("Fallback thumbnail no disponible");
    } catch (err2) {
      console.warn("[loadAvatar] fallback también falló:", err2 && err2.message ? err2.message : err2);
    }
  }

  // Si todo falla, usamos una imagen local de respaldo (asegúrate de tenerla en /img)
  const fallback = "img/roblox.webp"; // tienes roblox.webp en tu carpeta img según tu árbol
  console.log("[loadAvatar] usando fallback local:", fallback);
  avatarImg.src = fallback;
  avatarImg.alt = "Avatar fallback";
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
// Parseo tolerante del objeto de presence recibido
// -----------------------------
function resolvePresenceType(presenceObj) {
  if (!presenceObj) return null;

  // 1) Campo directo más común
  if (typeof presenceObj.userPresenceType === "number") return presenceObj.userPresenceType;
  if (typeof presenceObj.presenceType === "number") return presenceObj.presenceType;
  if (typeof presenceObj.type === "number") return presenceObj.type;

  // 2) Si vienen como strings numéricos
  const maybeStr = presenceObj.userPresenceType ?? presenceObj.presenceType ?? presenceObj.type;
  if (typeof maybeStr === "string") {
    const n = parseInt(maybeStr, 10);
    if (!Number.isNaN(n)) return n;
  }

  // 3) Heurísticas: si hay lastLocation textual que contiene 'studio'
  if (typeof presenceObj.lastLocation === "string") {
    if (/studio/i.test(presenceObj.lastLocation)) return 3; // studio
    // si lastLocation parece un placeId (solo dígitos) -> in game
    if (/^\d+$/.test(presenceObj.lastLocation)) return 2;
  }

  // 4) si hay flags simples
  if (presenceObj.isOnline === true) return 1;
  if (presenceObj.isOnline === false) return 0;

  // 5) Current place info (algunos proxies devuelven currentPlace/lastLocation structured)
  if (presenceObj.placeId || (presenceObj.currentPlace && presenceObj.currentPlace.placeId)) return 2;

  // no resuelto
  return null;
}

// -----------------------------
// intentos de obtener presence desde endpoint dado (POST)
// devuelve objeto "presence" o null
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
    // Normalizar: buscar array típico o campo data
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
// Avatar presence: intenta RoProxy y fallback, aplica clase
// -----------------------------
async function updateAvatarStatus(userId) {
  const container = document.getElementById("avatar-container");
  if (!container) {
    console.warn("[updateAvatarStatus] no se encontró #avatar-container");
    return;
  }

  // Estado provisional
  container.classList.remove("avatar-online", "avatar-inGame", "avatar-studio", "avatar-offline", "avatar-invisible");
  container.classList.add("avatar-offline");
  container.title = "Detectando presencia...";

  try {
    // 1) Intento principal: RoProxy
    console.log("[updateAvatarStatus] intentando PRESENCE_PROXY (RoProxy)...");
    let pres = await fetchPresenceFrom(PRESENCE_PROXY, userId);

    // 2) Si no hay resultado, intentar endpoint oficial (puede fallar por CORS)
    if (!pres) {
      console.log("[updateAvatarStatus] RoProxy no devolvió presencia. Intentando endpoint oficial (fallback)...");
      pres = await fetchPresenceFrom(PRESENCE_ROBLOX, userId);
    }

    // 3) Si aún no hay presencia, dejar offline
    if (!pres) {
      console.warn("[updateAvatarStatus] no se obtuvo presencia válida de ninguno de los endpoints");
      applyPresence(0);
      return;
    }

    console.log("[updateAvatarStatus] presencia cruda:", pres);

    // Resolver tipo preferente y seguro
    const resolved = resolvePresenceType(pres);
    console.log("[updateAvatarStatus] tipo resuelto:", resolved);

    if (resolved === null || typeof resolved !== "number" || Number.isNaN(resolved)) {
      applyPresence(0);
    } else {
      applyPresence(resolved);
    }
  } catch (err) {
    console.error("[updateAvatarStatus] excepción:", err && err.message ? err.message : err);
    applyPresence(0);
  }
}

// -----------------------------
// Expand buttons (projects/games/store)
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
// Mobile menu (hamburger)
// -----------------------------
function initMobileMenu() {
  if (!hamburger || !navList) return;
  hamburger.addEventListener("click", () => {
    navList.classList.toggle("active");
  });
}

// -----------------------------
// Intersection observer para fade-in
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
// Inicialización principal
// -----------------------------
document.addEventListener("DOMContentLoaded", () => {
  const today = new Date();
  if (yearSpan) yearSpan.textContent = today.getFullYear();

  initMobileMenu();
  initSmoothScroll();
  initFadeInObserver();
  initExpandButtons();

  // Cargar avatar (thumbnail) — siempre intentará automáticamente
  loadAvatar(ROBLOX_USER_ID);

  // Actualizar presencia y refrescar cada 60s
  updateAvatarStatus(ROBLOX_USER_ID);
  const presenceInterval = setInterval(() => updateAvatarStatus(ROBLOX_USER_ID), 60_000);

  // Limpieza simple al descargar (opcional)
  window.addEventListener("beforeunload", () => {
    clearInterval(presenceInterval);
  });
});

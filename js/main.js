// js/main.js
// Cliente: avatar + presence + carga dinámica de vídeos YouTube en "more projects".
// Asume window.PROXY_BASE definido en index.html (p.ej. http://localhost:3000)

(function () {
  const PROXY_BASE = (typeof window.PROXY_BASE !== 'undefined') ? String(window.PROXY_BASE).replace(/\/$/,'') : (location.hostname === 'localhost' ? 'http://localhost:3000' : '/api');
  const API_VIDEOS = `${PROXY_BASE}/api/videos`;
  const API_COMMUNITY = `${PROXY_BASE}/api/community`;
  const ROBLOX_USER_ID = 3404416545;

  /* ---------- UTIL ---------- */
  function escapeHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function el(tag, cls, html) {
    const d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html !== undefined) d.innerHTML = html;
    return d;
  }

  /* ---------- Avatar & Presence (tu implementación funcional) ---------- */
  // (Copio la versión estable que tenías)
  const THUMBNAIL_PROXY = `${PROXY_BASE}/avatar`;
  const PRESENCE_PROXY = `${PROXY_BASE}/presence`;

  function fetchWithTimeout(url, opts={}, ms=7000) {
    const ctrl = new AbortController();
    const id = setTimeout(()=>ctrl.abort(), ms);
    return fetch(url, { signal: ctrl.signal, ...opts }).finally(() => clearTimeout(id));
  }

  function loadAvatar(userId, imgEl, size='420x420') {
    if (!imgEl) return;
    if (imgEl.dataset._loading) return;
    imgEl.dataset._loading = '1';
    imgEl.onerror = () => {
      if (imgEl.dataset._err) return;
      imgEl.dataset._err = '1';
      imgEl.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><rect width="100%" height="100%" fill="#ddd"/><text x="50%" y="50%" font-size="14" text-anchor="middle" dominant-baseline="middle" fill="#666">Avatar</text></svg>`);
    };
    const url = `${THUMBNAIL_PROXY}/${encodeURIComponent(userId)}?size=${encodeURIComponent(size)}&format=Png&isCircular=true`;
    imgEl.src = url;
  }

  function applyPresence(type) {
    const container = document.getElementById('avatar-container');
    if (!container) return;
    container.classList.remove("avatar-online", "avatar-inGame", "avatar-studio", "avatar-offline", "avatar-invisible");
    switch (type) {
      case 1: container.classList.add('avatar-online'); container.title = 'Online'; break;
      case 2: container.classList.add('avatar-inGame'); container.title = 'In Game'; break;
      case 3: container.classList.add('avatar-studio'); container.title = 'In Roblox Studio'; break;
      case 4: container.classList.add('avatar-invisible'); container.title = 'Invisible / Offline'; break;
      default: container.classList.add('avatar-offline'); container.title = 'Offline'; break;
    }
  }

  function resolvePresenceType(pres) {
    if (!pres) return null;
    if (typeof pres.userPresenceType === 'number') return pres.userPresenceType;
    if (typeof pres.presenceType === 'number') return pres.presenceType;
    if (typeof pres.type === 'number') return pres.type;
    const maybeStr = pres.userPresenceType ?? pres.presenceType ?? pres.type;
    if (typeof maybeStr === 'string') {
      const n = parseInt(maybeStr,10);
      if (!Number.isNaN(n)) return n;
    }
    if (typeof pres.lastLocation === 'string') {
      if (/studio/i.test(pres.lastLocation)) return 3;
      if (/^\d+$/.test(pres.lastLocation)) return 2;
    }
    if (pres.isOnline === true) return 1;
    if (pres.isOnline === false) return 0;
    if (pres.placeId || (pres.currentPlace && pres.currentPlace.placeId)) return 2;
    return null;
  }

  async function fetchPresenceFromProxy(userId) {
    try {
      const res = await fetchWithTimeout(PRESENCE_PROXY, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ userIds: [Number(userId)]})
      }, 7000);
      if (!res || !res.ok) return null;
      const j = await res.json();
      const arr = j?.userPresences ?? j?.data ?? j?.presences ?? j?.presence ?? j;
      if (Array.isArray(arr) && arr.length) return arr[0];
      if (typeof arr === 'object') return arr;
      return null;
    } catch (e) {
      return null;
    }
  }

  async function updateAvatarStatus(userId) {
    const container = document.getElementById('avatar-container');
    if (!container) return;
    container.classList.add('avatar-offline');
    container.title = 'Detecting presence...';
    try {
      const pres = await fetchPresenceFromProxy(userId);
      if (!pres) { applyPresence(0); return; }
      const resolved = resolvePresenceType(pres);
      if (resolved === null || typeof resolved !== 'number' || Number.isNaN(resolved)) applyPresence(0);
      else applyPresence(resolved);
    } catch (err) {
      applyPresence(0);
    }
  }

  /* ---------- Projects "More" loader (YouTube + Community images) ---------- */

  // Open video modal (iframe)
  function openVideoModal(videoId, title = '') {
    const modal = document.getElementById('img-modal');
    if (!modal) {
      alert('Modal container (#img-modal) no encontrado.');
      return;
    }
    modal.innerHTML = `
      <div style="position:relative;width:90%;max-width:900px;padding-bottom:56.25%;height:0;">
        <iframe
          src="https://www.youtube.com/embed/${encodeURIComponent(videoId)}?rel=0"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
          title="${escapeHtml(title)}"
          style="position:absolute;inset:0;width:100%;height:100%;border:0;">
        </iframe>
      </div>
      <button id="close-video-modal" style="position:fixed;top:18px;right:18px;z-index:9999;background:rgba(0,0,0,0.6);color:#fff;border:0;padding:8px 12px;border-radius:6px;cursor:pointer;">Cerrar</button>
    `;
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.background = 'rgba(0,0,0,0.85)';
    const closeBtn = modal.querySelector('#close-video-modal');
    if (closeBtn) closeBtn.addEventListener('click', closeVideoModal);
    modal.addEventListener('click', function onM(e) {
      if (e.target === modal) {
        closeVideoModal();
      }
    }, { once: true });
  }
  function closeVideoModal() {
    const modal = document.getElementById('img-modal');
    if (!modal) return;
    modal.style.display = 'none';
    modal.innerHTML = '';
  }

  // Render array of video items into #more-projects
  function renderVideosIntoMoreProjects(items) {
    const moreDiv = document.getElementById('more-games') || document.getElementById('more-projects');
    if (!moreDiv) return;
    // build grid container if not present (match projects layout)
    let grid = moreDiv.querySelector('.projects-grid');
    if (!grid) {
      grid = document.createElement('div');
      grid.className = 'projects-grid';
      moreDiv.innerHTML = '';
      moreDiv.appendChild(grid);
    }
    // Append each video as a project-card style
    items.forEach(v => {
      const thumb = v.thumbnails?.high?.url || v.thumbnails?.medium?.url || v.thumbnails?.default?.url || '';
      const card = document.createElement('div');
      card.className = 'project-card fade-in';
      card.innerHTML = `
        <div style="display:block;cursor:pointer" data-video-id="${escapeHtml(v.videoId)}" role="button">
          <img src="${escapeHtml(thumb)}" alt="${escapeHtml(v.title || '')}" />
        </div>
        <h3>${escapeHtml(v.title || '')}</h3>
        <p>${escapeHtml((v.description || '').slice(0, 160))}</p>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:.6rem">
          <small style="color:rgba(255,255,255,0.6)">${v.publishedAt ? new Date(v.publishedAt).toLocaleDateString() : ''}</small>
          <div>
            <button class="btn-open-video" data-video-id="${escapeHtml(v.videoId)}" style="padding:.45rem .7rem;border-radius:6px;border:0;background:var(--color-accent-green);color:#fff;cursor:pointer">Ver</button>
            <a href="https://www.youtube.com/watch?v=${encodeURIComponent(v.videoId)}" target="_blank" rel="noopener" style="margin-left:.5rem;color:var(--color-accent)">YouTube</a>
          </div>
        </div>
      `;
      // Button handler
      const btn = card.querySelector('.btn-open-video');
      if (btn) btn.addEventListener('click', (e) => {
        e.preventDefault();
        const id = e.currentTarget.dataset.videoId;
        openVideoModal(id, v.title);
      });
      // Also click thumbnail to open
      const thumbWrap = card.querySelector('[data-video-id]');
      if (thumbWrap) thumbWrap.addEventListener('click', (e) => {
        const id = thumbWrap.dataset.videoId;
        openVideoModal(id, v.title);
      });

      grid.appendChild(card);
    });
  }

  // Render community images (best-effort) into more-projects
  function renderCommunityImagesIntoMoreProjects(items) {
    if (!items || !items.length) return;
    const moreDiv = document.getElementById('more-games') || document.getElementById('more-projects');
    if (!moreDiv) return;
    let grid = moreDiv.querySelector('.projects-grid');
    if (!grid) {
      grid = document.createElement('div');
      grid.className = 'projects-grid';
      moreDiv.innerHTML = '';
      moreDiv.appendChild(grid);
    }
    // add each image as project-card (image posts)
    items.forEach(it => {
      const card = document.createElement('div');
      card.className = 'project-card fade-in';
      card.innerHTML = `
        <img src="${escapeHtml(it.image)}" alt="${escapeHtml(it.title || '')}" />
        <h3>${escapeHtml(it.title || '')}</h3>
      `;
      card.querySelector('img').addEventListener('click', () => {
        // open big image in modal (lightbox)
        const modal = document.getElementById('img-modal');
        if (!modal) return;
        modal.innerHTML = `<img src="${escapeHtml(it.image)}" alt="${escapeHtml(it.title || '')}" style="max-width:90%;max-height:90%" />`;
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.addEventListener('click', function onM(e) {
          if (e.target === modal) { modal.style.display='none'; modal.innerHTML=''; }
        }, { once: true });
      });
      grid.appendChild(card);
    });
  }

  // Fetch videos from server `/api/videos`
  async function loadVideosFromServer(maxResults=12) {
    try {
      const url = `${API_VIDEOS}?maxResults=${encodeURIComponent(maxResults)}`;
      const res = await fetch(url, { cache:'no-store' });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const j = await res.json();
      return j.items || [];
    } catch (err) {
      console.error('loadVideosFromServer error', err);
      return [];
    }
  }

  // Fetch community images
  async function loadCommunityImagesFromServer() {
    try {
      // server will use env handle if none provided
      const res = await fetch(API_COMMUNITY, { cache: 'no-store' });
      if (!res.ok) return [];
      const j = await res.json();
      return j.items || [];
    } catch (err) {
      return [];
    }
  }

  /* ---------- Hook expand button (projects) ---------- */
  function hookProjectsExpand() {
    const expandBtn = document.querySelector('.expand-btn') || document.getElementById('load-more-games') || document.querySelector('#projects-container .expand-btn');
    // prefer the projects expand button specifically if present
    const projectsExpand = document.querySelector('#projects-container .expand-btn') || expandBtn;
    if (!projectsExpand) return;

    let loaded = false;
    projectsExpand.addEventListener('click', async () => {
      // toggle visible-content for #more-projects (existing logic in projects.js)
      const more = document.getElementById('more-projects');
      if (!more) return;
      const nowShowing = more.classList.toggle('visible-content');

      // if now showing and not loaded yet, fetch YouTube videos + community images and append
      if (nowShowing && !loaded) {
        const statusNode = document.getElementById('avatar-debug-controls');
        if (statusNode) statusNode.textContent = 'Cargando vídeos de YouTube...';
        const vids = await loadVideosFromServer(12);
        if (statusNode) statusNode.textContent = `Vídeos: ${vids.length} — cargando imágenes de comunidad...`;
        const comm = await loadCommunityImagesFromServer();
        if (statusNode) statusNode.textContent = `Videos ${vids.length}, Community ${comm.length}`;
        // clear existing and render combined: first projects.moreItems are already rendered by projects.js
        // we append videos and community images here
        renderVideosIntoMoreProjects(vids);
        renderCommunityImagesIntoMoreProjects(comm);
        loaded = true;
      }
    });
  }

  /* ---------- helpers UI (menu, smooth scroll, fade-in) ---------- */
  function initMobileMenu() {
    const hamburger = document.getElementById('hamburger');
    const navList = document.querySelector('.nav-list');
    if (!hamburger || !navList) return;
    hamburger.addEventListener('click', () => navList.classList.toggle('active'));
  }
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href === '#') return;
        e.preventDefault();
        const id = href.slice(1);
        const t = document.getElementById(id);
        if (t) t.scrollIntoView({ behavior: 'smooth' });
        const nav = document.querySelector('.nav-list');
        if (nav && nav.classList.contains('active')) nav.classList.remove('active');
      });
    });
  }
  function initFadeInObserver() {
    const obs = new IntersectionObserver((entries, o) => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('visible'); o.unobserve(en.target); }});
    }, { threshold: 0.2 });
    document.querySelectorAll('.fade-in').forEach(el => obs.observe(el));
  }

  /* ---------- init on DOMContentLoaded ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    // Year
    const yearSpan = document.getElementById('year');
    if (yearSpan) yearSpan.textContent = new Date().getFullYear();

    initMobileMenu();
    initSmoothScroll();
    initFadeInObserver();

    // Avatar
    const avatarImg = document.getElementById('avatar-img');
    if (avatarImg) loadAvatar(ROBLOX_USER_ID, avatarImg, '420x420');

    // Presence
    updateAvatarStatus(ROBLOX_USER_ID);
    const interval = setInterval(() => updateAvatarStatus(ROBLOX_USER_ID), 60_000);
    window.addEventListener('beforeunload', () => clearInterval(interval));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        if (avatarImg) { delete avatarImg.dataset._loading; delete avatarImg.dataset._err; loadAvatar(ROBLOX_USER_ID, avatarImg, '420x420'); }
        updateAvatarStatus(ROBLOX_USER_ID);
      }
    });

    // hook expand on projects to load videos
    hookProjectsExpand();

    // close video modal with Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeVideoModal();
    });
  });

  // expose util for debugging
  window.__siteLoader = { loadVideosFromServer, loadCommunityImagesFromServer, openVideoModal };
})();

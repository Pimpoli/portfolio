// js/projects.js

document.addEventListener('DOMContentLoaded', async () => {
  const projectsContainer = document.getElementById('projects-container');
  if (!projectsContainer) return;
  
  // ==========================================
  // CONFIGURACIÓN
  // ==========================================
  const YOUTUBE_PLAYLIST_ID = 'UUH7nYiCQfSa78XfWIc5Nh6w';
  // En local: la key vive en server.js (proxy). En producción (GitHub Pages): se usa directa.
  // Restringe esta key por referrer HTTP en console.cloud.google.com para mayor seguridad.
  const _YK = 'AIzaSyAI0klDbsko8_UrYOe0Rwu6aK6vrIS2iNc';

  // Helper de traducción (igual que en about.js)
  const getT = (key, fallback) => {
    if (!window.translations) return fallback;
    const parts = key.split('.');
    let val = window.translations;
    for (const p of parts) {
      if (val && val[p] !== undefined) val = val[p];
      else return fallback;
    }
    return typeof val === 'string' ? val : fallback;
  };

  const staticProjects = [
    { id: 'nodes',     type: 'img', src: 'img/Nodos.webp',            titleKey: 'projects.nodes.title',     descKey: 'projects.nodes.desc',     title: 'Nodes System',      desc: '' },
    { id: 'nodesDemo', type: 'img', src: 'img/NodosDemostracion.webp', titleKey: 'projects.nodesDemo.title', descKey: 'projects.nodesDemo.desc', title: 'Nodes System Demo', desc: 'Visual connection between nodes.' },
  ];

  const h2 = document.createElement('h2');
  h2.className = 'fade-in';
  h2.setAttribute('data-i18n', 'projects.title');
  h2.innerText = getT('projects.title', 'My Work / Examples');
  projectsContainer.appendChild(h2);

  // 1. Fetch YouTube Videos
  async function fetchYouTubeVideos() {
    // Estrategia 1: proxy local (cuando el servidor Node está corriendo)
    if (window.PROXY_BASE) {
      try {
        const res = await fetch(`${window.PROXY_BASE}/youtube/playlist?playlistId=${YOUTUBE_PLAYLIST_ID}&maxResults=6`);
        if (res.ok) {
          const data = await res.json();
          if (data.items && !data.error) return mapItems(data.items);
        }
      } catch (e) { /* continúa */ }
    }
    // Estrategia 2: llamada directa a YouTube (producción / GitHub Pages)
    try {
      const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${YOUTUBE_PLAYLIST_ID}&maxResults=6&key=${_YK}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.items && !data.error) return mapItems(data.items);
      }
    } catch (e) { /* continúa */ }
    return [];
  }

  function mapItems(items) {
    return items.map(item => ({
      type: 'youtube',
      id: item.snippet.resourceId.videoId,
      title: item.snippet.title,
      desc: item.snippet.description || '',
      thumb: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
    }));
  }

  // 2. Función para crear las tarjetas
  function buildDescHtml(desc) {
    if (!desc || !desc.trim()) return '';
    const LIMIT = 80;
    let truncated = desc.substring(0, LIMIT).trim();
    if (desc.length > LIMIT) truncated += '... <span style="color:var(--color-accent);font-weight:bold;">Ver más</span>';
    return `<p class="project-desc" style="font-size:0.9rem;margin-top:5px;">${truncated}</p>`;
  }

  function createCard(p, index) {
    const card = document.createElement('div');
    card.className = `project-card fade-in scroll-delay-${(index % 5) + 1}`;
    card.dataset.projectData = JSON.stringify(p);
    if (p.titleKey) card.dataset.i18nTitle = p.titleKey;
    if (p.descKey)  card.dataset.i18nDesc  = p.descKey;

    const displayTitle = p.titleKey ? getT(p.titleKey, p.title) : p.title;
    const displayDesc  = p.descKey  ? getT(p.descKey,  p.desc)  : p.desc;

    let mediaHtml = '';
    if (p.type === 'img') {
      mediaHtml = `<img src="${p.src}" alt="${displayTitle}" loading="lazy" style="width:100%; display:block; border-radius: 4px;" />`;
    } else if (p.type === 'youtube') {
      mediaHtml = `
        <div class="yt-thumb" style="position:relative;width:100%;height:100%;">
          <img src="${p.thumb}" alt="${displayTitle}" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:4px;" />
          <div style="position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;border-radius:4px;">
            <svg width="60" height="60" viewBox="0 0 24 24" fill="white" style="filter:drop-shadow(0px 4px 6px rgba(0,0,0,0.6));">
              <path d="M8 5V19L19 12L8 5Z" />
            </svg>
          </div>
        </div>`;
    }

    card.style.cursor = 'pointer';
    card.innerHTML = `
      <div class="media-wrapper">${mediaHtml}</div>
      <h3 class="project-title" style="margin-top:10px;font-size:1.1rem;">${displayTitle}</h3>
      ${buildDescHtml(displayDesc)}
    `;
    return card;
  }

  // Actualiza títulos/descripciones de tarjetas estáticas al cambiar idioma
  function updateCardTranslations() {
    document.querySelectorAll('.project-card[data-i18n-title]').forEach(card => {
      const titleKey = card.dataset.i18nTitle;
      const descKey  = card.dataset.i18nDesc;
      const h3 = card.querySelector('.project-title');
      const descEl = card.querySelector('.project-desc');
      if (h3 && titleKey) h3.textContent = getT(titleKey, h3.textContent);
      if (descKey) {
        const translated = getT(descKey, '');
        if (descEl) {
          descEl.outerHTML = buildDescHtml(translated);
        } else if (translated) {
          card.querySelector('.project-title')?.insertAdjacentHTML('afterend', buildDescHtml(translated));
        }
      }
    });
    // También actualizar el h2
    const h2el = projectsContainer.querySelector('h2[data-i18n]');
    if (h2el) h2el.innerText = getT('projects.title', h2el.innerText);
  }

  document.addEventListener('languageLoaded', updateCardTranslations);

  // 3. Obtener todos los proyectos y unirlos (Estáticos + YouTube)
  const youtubeVideos = await fetchYouTubeVideos();
  const allProjects = [...staticProjects, ...youtubeVideos];

  // 4. Crear los contenedores y el botón
  const mainGrid = document.createElement('div');
  mainGrid.className = 'projects-grid';
  
  const moreGrid = document.createElement('div');
  moreGrid.id = 'more-projects';
  moreGrid.className = 'more-content'; // Oculto por defecto por tu CSS

  const expandBtn = document.createElement('button');
  expandBtn.id = 'load-more-projects';
  expandBtn.className = 'expand-btn fade-in';
  expandBtn.textContent = '+';

  // 5. Distribuir las tarjetas
  allProjects.forEach((p, i) => {
    const card = createCard(p, i);
    
    // Los primeros 2 van a la vista principal, el resto a la caja oculta
    if (i < 2) {
      mainGrid.appendChild(card);
    } else {
      moreGrid.appendChild(card);
    }

    // Forzar la animación de aparición
    setTimeout(() => { card.classList.add('visible'); }, 50);
  });

  // Agregar al HTML
  projectsContainer.appendChild(mainGrid);
  
  // Si hay más de 2 proyectos, agregamos el botón y la caja extra
  if (allProjects.length > 2) {
    projectsContainer.appendChild(expandBtn);
    projectsContainer.appendChild(moreGrid);
    
    // Animar el botón para que aparezca
    setTimeout(() => { expandBtn.classList.add('visible'); }, 100);

    // Lógica para abrir y cerrar
    expandBtn.addEventListener('click', () => {
      const isVisible = moreGrid.classList.contains('visible-content');
      if (isVisible) {
        moreGrid.classList.remove('visible-content');
        expandBtn.textContent = '+';
      } else {
        moreGrid.classList.add('visible-content');
        expandBtn.textContent = '−';
      }
    });
  }

  // ==========================================
  // 6. MODAL DE DETALLES
  // ==========================================
  const modal = document.getElementById('img-modal');
  const modalContainer = document.getElementById('modal-media-container');
  const closeBtn = modal ? modal.querySelector('.close-modal') : null;

  if (modal && modalContainer && closeBtn) {
    
    function openDetailsModal(project) {
      let mediaSection = '';
      if (project.type === 'img') {
        mediaSection = `<img src="${project.src}" alt="${project.title}" style="width:100%; max-height:45vh; object-fit:contain; border-radius:8px; display: block;" />`;
      } else if (project.type === 'youtube') {
        mediaSection = `
          <div style="position: relative; width: 100%; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 8px;">
            <iframe src="https://www.youtube.com/embed/${project.id}?autoplay=1&rel=0" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>
          </div>`;
      }

      let descSection = '';
      let titleMarginBottom = '0';

      if (project.desc && project.desc.trim() !== '') {
        titleMarginBottom = '15px';
        const textoLimpio = project.desc.trim(); 
        
        descSection = `
          <div style="background: rgba(0, 0, 0, 0.4); padding: 15px; border-radius: 8px; font-size: clamp(0.9rem, 3vw, 1rem); line-height: 1.5; color: rgba(255,255,255,0.9); overflow-y: auto; max-height: 30vh; border: 1px solid rgba(255, 255, 255, 0.05); text-align: left;">
            <strong style="display: block; margin-bottom: 8px; font-size: 1.1em; color: #ffffff;">Descripción:</strong>
            <div style="white-space: pre-wrap; font-family: inherit;">${textoLimpio}</div>
          </div>
        `;
      }

      modalContainer.innerHTML = `
        <div style="background: var(--color-bg-dark); padding: 20px; border-radius: 12px; max-width: 800px; width: 90vw; max-height: 90vh; display: flex; flex-direction: column; margin: auto; text-align: left; box-shadow: 0 10px 30px rgba(0,0,0,0.8);">
          
          <div style="flex-shrink: 0; width: 100%;">
            ${mediaSection}
          </div>

          <h2 style="margin: 15px 0 ${titleMarginBottom} 0; font-size: clamp(1.2rem, 4vw, 1.5rem); color: var(--color-text-dark); flex-shrink: 0;">
            ${project.title}
          </h2>
          
          ${descSection}

        </div>
      `;
      
      modal.style.display = 'flex';
      document.body.classList.add('modal-open');
    }

    function closeModal() {
      modal.style.display = 'none';
      modalContainer.innerHTML = ''; 
      document.body.classList.remove('modal-open');
    }

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    projectsContainer.addEventListener('click', evt => {
      const card = evt.target.closest('.project-card');
      if (!card) return;
      const p = JSON.parse(card.dataset.projectData);
      openDetailsModal(p);
    });
  }
});
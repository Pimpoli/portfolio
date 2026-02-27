// projects.js

document.addEventListener('DOMContentLoaded', async () => {
  const projectsContainer = document.getElementById('projects-container');
  if (!projectsContainer) return;
  
  // ==========================================
  // CONFIGURACIÓN
  // ==========================================
  // 1. Pon aquí tu ID de canal (empieza con UC...)
  const YOUTUBE_CHANNEL_ID = 'UCH7nYiCQfSa78XfWIc5Nh6w';
  // 2. (Opcional) Pon tu API Key de Google aquí para mayor estabilidad. Si lo dejas vacío, usa el método RSS.
  const YOUTUBE_API_KEY = 'AIzaSyBcp7sVpHVHfTF8aezpX0NgdXs8YkmjmJo';
  
  // 3. Proyectos estáticos (Imágenes locales que quieres conservar)
  const staticProjects = [
    { id: 'nodes', type: 'img', src: 'img/Nodos.webp', title: 'Nodes System', desc: '' },
    { id: 'nodesDemo', type: 'img', src: 'img/NodosDemostracion.webp', title: 'Nodes System Demo', desc: 'Conexión visual entre nodos.' },
    { id: 'comingSoon', type: 'img', src: 'img/MultiGameInc.webp', title: 'Próximamente', desc: 'Próximamente' }
  ];

  // ==========================================
  // LÓGICA
  // ==========================================
  
  // 1. Título
  const h2 = document.createElement('h2');
  h2.className = 'fade-in';
  h2.setAttribute('data-i18n', 'projects.title');
  h2.innerText = 'My Work / Examples';
  projectsContainer.appendChild(h2);

  // 2. Función para obtener videos de YouTube (RSS a JSON)
  async function fetchYouTubeVideos() {
    // Helper: Método de respaldo usando RSS (sin API Key)
    const fetchRSS = async () => {
      try {
        console.log('Intentando cargar videos vía RSS...');
        const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`;
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
        const res = await fetch(apiUrl);
        const data = await res.json();
        
        if (data.status === 'ok' && data.items) {
          return data.items.map(item => {
            // Extraer ID de guid (yt:video:ID) o del enlace
            let videoId = item.guid.split(':')[2];
            if (!videoId && item.link.includes('v=')) {
              videoId = item.link.split('v=')[1];
            }
            return {
              type: 'youtube',
              id: videoId,
              title: item.title,
              desc: 'Ver en YouTube',
              thumb: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
              link: item.link
            };
          });
        }
        return [];
      } catch (e) {
        console.error('Error en fallback RSS:', e);
        return [];
      }
    };

    try {
      // MODO A: Usando API Oficial de Google (Si pusiste la Key)
      if (YOUTUBE_API_KEY) {
        const apiUrl = `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&channelId=${YOUTUBE_CHANNEL_ID}&part=snippet,id&order=date&maxResults=6&type=video`;
        const res = await fetch(apiUrl);
        const data = await res.json();

        // Si la API falla (error 400/403/etc), usar RSS
        if (!res.ok || data.error) {
          console.warn('API Key falló o cuota excedida. Usando fallback RSS.');
          return await fetchRSS();
        }

        if (data.items && data.items.length > 0) {
          return data.items.map(item => ({
            type: 'youtube',
            id: item.id.videoId,
            title: item.snippet.title,
            desc: 'Ver en YouTube',
            thumb: item.snippet.thumbnails.high.url,
            link: `https://www.youtube.com/watch?v=${item.id.videoId}`
          }));
        }
        return []; // API OK pero sin videos
      }
      
      // MODO B: Sin API Key -> RSS directo
      return await fetchRSS();

    } catch (error) {
      console.error('Error general fetching videos, intentando RSS:', error);
      return await fetchRSS();
    }
  }

  // 4. Renderizar Grid Principal (Proyectos estáticos)
  const grid = document.createElement('div');
  grid.className = 'projects-grid';
  
  // Función helper para crear tarjeta
  function createCard(p, index) {
    const card = document.createElement('div');
    card.className = `project-card fade-in scroll-delay-${(index % 5) + 1}`;
    
    let mediaHtml = '';
    if (p.type === 'img') {
      mediaHtml = `<img src="${p.src}" alt="${p.title}" loading="lazy" />`;
    } else if (p.type === 'youtube') {
      // Usamos la miniatura, al hacer click se abre el video
      mediaHtml = `<img src="${p.thumb}" alt="${p.title}" class="yt-thumb" data-video-id="${p.id}" style="cursor:pointer;" />`;
    }

    card.innerHTML = `
      <div class="media-wrapper">${mediaHtml}</div>
      <h3>${p.title}</h3>
      <p>${p.desc}</p>
    `;
    return card;
  }

  // Renderizar estáticos
  staticProjects.forEach((p, i) => grid.appendChild(createCard(p, i)));
  projectsContainer.appendChild(grid);

  // 3. Obtener videos (Ahora esperamos a YouTube DESPUÉS de mostrar tus fotos)
  const youtubeVideos = await fetchYouTubeVideos();

  // 5. Renderizar Videos de YouTube (en sección "Ver más")
  if (youtubeVideos.length > 0) {
    const expandBtn = document.createElement('button');
    expandBtn.className = 'expand-btn fade-in scroll-delay-3';
    expandBtn.textContent = '+';
    projectsContainer.appendChild(expandBtn);

    const moreDiv = document.createElement('div');
    moreDiv.id = 'more-projects';
    moreDiv.className = 'more-content';
    
    const moreGrid = document.createElement('div');
    moreGrid.className = 'projects-grid';

    youtubeVideos.forEach((video, i) => {
      moreGrid.appendChild(createCard(video, i));
    });

    moreDiv.appendChild(moreGrid);
    projectsContainer.appendChild(moreDiv);

    expandBtn.addEventListener('click', () => {
      const showing = moreDiv.classList.toggle('visible-content');
      expandBtn.textContent = showing ? '−' : '+';
    });
  }

  // 6. Lightbox / Modal mejorado
  const modal    = document.getElementById('img-modal');
  const modalContainer = document.getElementById('modal-media-container');
  const closeBtn = modal.querySelector('.close-modal');

  function openModal(content) {
    modalContainer.innerHTML = content;
    modal.style.display = 'flex';
  }

  function closeModal() {
    modal.style.display = 'none';
    modalContainer.innerHTML = ''; // Detener video
  }

  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Delegación de eventos
  projectsContainer.addEventListener('click', evt => {
    // Click en imagen normal
    const img = evt.target.closest('.project-card img:not(.yt-thumb)');
    if (img) {
      openModal(`<img src="${img.src}" alt="${img.alt}" />`);
      return;
    }

    // Click en video de YouTube
    const ytThumb = evt.target.closest('.yt-thumb');
    if (ytThumb) {
      const videoId = ytThumb.dataset.videoId;
      const iframeHtml = `
        <iframe 
          src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0" 
          title="YouTube video player" 
          frameborder="0" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
          allowfullscreen>
        </iframe>`;
      openModal(iframeHtml);
    }
  });
});

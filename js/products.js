// js/products.js - Tienda estilo Proyectos integrada con YouTube y Gumroad

document.addEventListener('DOMContentLoaded', async () => {
  // Buscamos el contenedor 'products-container'
  const storeSection = document.getElementById('products-container') || document.getElementById('store-container');
  if (!storeSection) return;

  // ==========================================
  // CONFIGURACIÓN DE TUS PRODUCTOS
  // ==========================================
  const STORE_PRODUCTS = [
    {
      // Producto 1 (El tuyo real)
      youtubeId: 'iUatLzmCRtE', // <-- Reemplaza esto con el ID del video que explica tu script/modelo
      gumroadUrl: 'https://pimpolidev.gumroad.com/l/wyfdgk', 
      price: '$3.00 USD' 
    },
    {
      // Producto 2 (De prueba, para que veas cómo se dividen en 2 columnas perfectas)
      youtubeId: '8G_FWh10mqU', 
      gumroadUrl: 'https://pimpolidev.gumroad.com/l/rxlko',
      price: '$8.00 USD'
    }
    // Puedes seguir añadiendo más copiando y pegando los bloques hacia abajo
  ];

  const YOUTUBE_API_KEY = 'AIzaSyAI0klDbsko8_UrYOe0Rwu6aK6vrIS2iNc'; 

  // Limpiamos el contenedor
  storeSection.innerHTML = '';
  storeSection.className = ''; 

  // Función inteligente de traducciones
  const getT = (key, fallbackText) => {
    if (!window.translations) return fallbackText;
    const parts = key.split('.');
    let text = window.translations;
    for (let p of parts) {
      if (text && text[p]) {
        text = text[p];
      } else {
        return fallbackText;
      }
    }
    return typeof text === 'string' ? text : fallbackText;
  };

  // 1. Obtener la información de los videos de YouTube
  async function fetchProductsData() {
    const ids = STORE_PRODUCTS.map(p => p.youtubeId).filter(id => id).join(',');
    if (!ids) return STORE_PRODUCTS; 

    try {
      const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${ids}&key=${YOUTUBE_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.items) {
        return STORE_PRODUCTS.map(product => {
          const ytData = data.items.find(item => item.id === product.youtubeId);
          if (ytData) {
            return {
              ...product,
              title: ytData.snippet.title,
              desc: ytData.snippet.description,
              thumb: ytData.snippet.thumbnails?.high?.url || ytData.snippet.thumbnails?.default?.url
            };
          }
          return { ...product, title: 'Producto', desc: 'Descripción no disponible', thumb: 'img/MultiGameInc.webp' };
        });
      }
    } catch (error) {
      console.error("Error obteniendo datos de la tienda desde YouTube", error);
    }
    return STORE_PRODUCTS;
  }

  // Obtenemos todos los datos combinados
  const loadedProducts = await fetchProductsData();

  // 2. Crear las tarjetas y la cuadrícula (+ / -)
  const mainGrid = document.createElement('div');
  mainGrid.className = 'projects-grid'; 
  mainGrid.style.justifyContent = 'center'; // Centramos los elementos por si hay pocos

  const moreGrid = document.createElement('div');
  moreGrid.id = 'more-store';
  moreGrid.className = 'projects-grid'; 
  moreGrid.style.justifyContent = 'center'; 
  moreGrid.style.display = 'none'; // Oculto por defecto
  moreGrid.style.marginTop = '1.5rem';

  const expandBtn = document.createElement('button');
  expandBtn.className = 'expand-btn fade-in';
  expandBtn.textContent = '+';

  function renderStoreUI() {
    mainGrid.innerHTML = '';
    moreGrid.innerHTML = '';

    const moreInfoText = getT('store.moreInfo', 'Más Información');

    loadedProducts.forEach((p, index) => {
      const card = document.createElement('div');
      
      card.className = `project-card fade-in scroll-delay-${(index % 5) + 1}`;
      card.dataset.productData = JSON.stringify(p);

      // ¡SOLUCIÓN DE TAMAÑO!: Forzamos a que ninguna tarjeta sea más ancha que 450px
      card.style.maxWidth = '450px';
      card.style.width = '100%';
      card.style.margin = '0 auto'; 

      let descHtml = '';
      if (p.desc && p.desc.trim() !== '') {
        const LIMIT = 80; 
        let truncated = p.desc.substring(0, LIMIT).trim();
        if (p.desc.length > LIMIT) truncated += '...';
        descHtml = `<p style="font-size: 0.9rem; margin-top: 5px; flex-grow: 1;">${truncated}</p>`;
      }

      card.style.cursor = 'pointer';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';

      card.innerHTML = `
        <div class="media-wrapper">
          <div class="yt-thumb" style="position: relative; width: 100%; aspect-ratio: 16/9;">
            <img src="${p.thumb || 'img/MultiGameInc.webp'}" alt="${p.title}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; display: block; border-radius: 4px;" />
            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; border-radius: 4px;">
              <svg width="60" height="60" viewBox="0 0 24 24" fill="white" style="filter: drop-shadow(0px 4px 6px rgba(0,0,0,0.6));">
                <path d="M8 5V19L19 12L8 5Z" />
              </svg>
            </div>
          </div>
        </div>
        <h3 style="margin-top: 10px; font-size: 1.1rem;">${p.title || 'Producto'}</h3>
        ${descHtml}
        
        <div style="margin-top: auto; display: flex; flex-direction: column; gap: 8px; align-items: center; padding-top: 12px;">
          <span style="color: var(--color-accent); font-weight: bold; font-size: 1.1rem;">${p.price}</span>
          <button class="buy-btn" style="width: 100%; background-color: var(--color-accent); color: #fff; border: none; padding: .6rem 1rem; border-radius: 4px; cursor: pointer; font-weight: bold; transition: transform 0.2s;">
            ${moreInfoText}
          </button>
        </div>
      `;

      if (index < 2) {
        mainGrid.appendChild(card);
      } else {
        moreGrid.appendChild(card);
      }
      setTimeout(() => { card.classList.add('visible'); }, 50);
    });

    storeSection.appendChild(mainGrid);

    // Lógica del botón +
    if (loadedProducts.length > 2) {
      storeSection.appendChild(expandBtn);
      storeSection.appendChild(moreGrid);
      setTimeout(() => { expandBtn.classList.add('visible'); }, 100);

      expandBtn.addEventListener('click', () => {
        if (moreGrid.style.display === 'none') {
          moreGrid.style.display = 'grid'; // Mostrar en formato cuadrícula normal
          expandBtn.textContent = '−';
        } else {
          moreGrid.style.display = 'none'; // Ocultar
          expandBtn.textContent = '+';
        }
      });
    }
  }

  // Renderizamos de inmediato
  renderStoreUI();

  // ==========================================
  // 3. MODAL DE COMPRA Y DETALLES
  // ==========================================
  function createStoreModal() {
    if (document.getElementById('store-modal-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'store-modal-overlay';
    overlay.style.display = 'none';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.85)';
    overlay.style.zIndex = '4000';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '20px';

    overlay.innerHTML = `
      <div style="background: var(--color-bg-dark); padding: 20px; border-radius: 12px; max-width: 800px; width: 90vw; max-height: 92vh; display: flex; flex-direction: column; text-align: left; box-shadow: 0 10px 40px rgba(0,0,0,0.9); position: relative;">
        <button id="store-modal-close" style="position: absolute; top: 8px; right: 12px; background: transparent; border: none; color: #ff4b4b; font-size: 32px; cursor: pointer; z-index: 10;">&times;</button>
        
        <div id="store-modal-video" style="flex-shrink: 0; width: 100%; position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 8px; margin-top: 15px;">
        </div>

        <h2 id="store-modal-title" style="margin: 15px 0 10px 0; font-size: clamp(1.2rem, 4vw, 1.5rem); color: var(--color-text-dark); flex-shrink: 0;"></h2>
        
        <div id="store-modal-desc-container" style="background: rgba(0, 0, 0, 0.4); padding: 15px; border-radius: 8px; font-size: clamp(0.9rem, 3vw, 1rem); line-height: 1.5; color: rgba(255,255,255,0.9); overflow-y: auto; flex-grow: 1; max-height: 22vh; border: 1px solid rgba(255, 255, 255, 0.05);">
        </div>

        <div style="margin-top: 15px; text-align: center; flex-shrink: 0;">
          <a id="store-modal-buy-btn" href="#" data-gumroad-overlay-checkout="true" class="button-primary" style="display: block; width: 100%; text-decoration: none; font-size: 1.15rem; font-weight: bold; padding: 14px; box-sizing: border-box; background-color: var(--color-accent-green); color: white; border-radius: 8px; transition: transform 0.2s;">
          </a>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeStoreModal();
    });
    document.getElementById('store-modal-close').addEventListener('click', closeStoreModal);
  }

  createStoreModal();

  function openStoreModal(p) {
    const overlay = document.getElementById('store-modal-overlay');
    const videoContainer = document.getElementById('store-modal-video');
    const titleEl = document.getElementById('store-modal-title');
    const descContainer = document.getElementById('store-modal-desc-container');
    const buyBtn = document.getElementById('store-modal-buy-btn');

    // Textos traducidos
    const buyWord = getT('store.buy', 'Comprar');
    const forWord = getT('store.for', 'por');

    titleEl.textContent = p.title || 'Producto';
    
    if (p.youtubeId) {
      videoContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${p.youtubeId}?autoplay=1&rel=0" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
      videoContainer.style.display = 'block';
    } else {
      videoContainer.innerHTML = '';
      videoContainer.style.display = 'none';
    }

    if (p.desc && p.desc.trim() !== '') {
      descContainer.innerHTML = `
        <strong style="display: block; margin-bottom: 8px; font-size: 1.1em; color: #ffffff;">Descripción:</strong>
        <div style="white-space: pre-wrap; font-family: inherit;">${p.desc.trim()}</div>
      `;
    } else {
      descContainer.innerHTML = '<span style="opacity:0.5;">Sin descripción.</span>';
    }

    // Estructura: Comprar [Nombre] por [Precio]
    buyBtn.href = p.gumroadUrl || '#';
    buyBtn.textContent = `${buyWord} ${p.title || 'Artículo'} ${forWord} ${p.price}`;

    overlay.style.display = 'flex';
    document.body.classList.add('modal-open');
  }

  function closeStoreModal() {
    const overlay = document.getElementById('store-modal-overlay');
    const videoContainer = document.getElementById('store-modal-video');
    if (overlay) {
      overlay.style.display = 'none';
      videoContainer.innerHTML = ''; 
      document.body.classList.remove('modal-open');
    }
  }

  storeSection.addEventListener('click', (e) => {
    const card = e.target.closest('.project-card');
    if (!card) return;
    const p = JSON.parse(card.dataset.productData);
    
    // Si tocan el botón directamente, ignoramos y pasamos al modal
    if (e.target.closest('button.buy-btn')) {}
    
    openStoreModal(p);
  });

  document.addEventListener('languageLoaded', () => {
    renderStoreUI();
  });

});

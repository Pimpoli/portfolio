// projects.js

document.addEventListener('DOMContentLoaded', () => {
  const projectsContainer = document.getElementById('projects-container');

  // 1) Contenido principal
  const projectsContent = {
    title: 'My Work / Examples',
    items: [
      { type: 'img', src: 'img/Nodos.webp',           title: 'Nodes System', desc: '' },
      { type: 'img', src: 'img/MultiGameInc.webp',    title: 'Próximamente', desc: 'Próximamente' }
    ],
    moreItems: [
      {
        type: 'video',
        src: 'img/Sea.webm',
        poster: 'img/MultiGameInc.webp',
        title: 'Olas realistas',
        desc: 'Intento de simular olas de forma realista.'
      },
      {
        type: 'video',
        src: 'img/Menu-de-Bloxidextro.webm',
        poster: 'img/Bloxidextro_Cover.webp',
        title: 'Menú Personalizado para "Bloxidextro"',
        desc: 'Menú Personalizado para "Bloxidextro" → Juego desarrollado por Multi Game Inc.'
      },
      {
        type: 'video',
        src: 'img/Trampolin-coperativo.webm',
        poster: 'img/Bloxidextro_Cover.webp',
        title: 'Trampolín coperativo',
        desc: 'Trampolín que necesita que un Humanoid lo presione para inflar el otro y hacer saltar al segundo Humanoid.'
      },
      {
        type: 'img',
        src: 'img/NodosDemostracion.webp',
        title: 'Nodes System',
        desc: 'Conexión visual entre nodos para sistemas futuros, como un sistema cinemático avanzado.'
      }
    ]
  };

  // 2) Encabezado de la sección
  const h2 = document.createElement('h2');
  h2.className = 'fade-in';
  h2.setAttribute('data-i18n', 'projects.title');
  h2.innerText = projectsContent.title;
  projectsContainer.appendChild(h2);

  // 3) Grid principal
  const grid = document.createElement('div');
  grid.className = 'projects-grid';
  projectsContent.items.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = `project-card fade-in scroll-delay-${i + 1}`;

    // Elegir etiqueta según tipo
    const mediaHtml = p.type === 'img'
      ? `<img src="${p.src}" alt="${p.title}" />`
      : `<video controls width="100%" poster="${p.poster}">
           <source src="${p.src}" type="video/mp4">
           Tu navegador no soporta video HTML5.
         </video>`;

    card.innerHTML = `
      ${mediaHtml}
      <h3>${p.title}</h3>
      <p>${p.desc}</p>
    `;
    grid.appendChild(card);
  });
  projectsContainer.appendChild(grid);

  // 4) Botón “ver más”
  const expandBtn = document.createElement('button');
  expandBtn.className = 'expand-btn fade-in scroll-delay-3';
  expandBtn.textContent = '+';
  projectsContainer.appendChild(expandBtn);

  // 5) Contenedor oculto de más proyectos
  const moreDiv = document.createElement('div');
  moreDiv.id = 'more-projects';
  moreDiv.className = 'more-content';
  const moreGrid = document.createElement('div');
  moreGrid.className = 'projects-grid';

  projectsContent.moreItems.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = `project-card fade-in scroll-delay-${i + 1}`;

    const mediaHtml = p.type === 'img'
      ? `<img src="${p.src}" alt="${p.title}" />`
      : `<video controls width="100%" poster="${p.poster}">
           <source src="${p.src}" type="video/mp4">
           Tu navegador no soporta video HTML5.
         </video>`;

    card.innerHTML = `
      ${mediaHtml}
      <h3>${p.title}</h3>
      <p>${p.desc}</p>
    `;
    moreGrid.appendChild(card);
  });

  moreDiv.appendChild(moreGrid);
  projectsContainer.appendChild(moreDiv);

  // 6) Toggle “ver más” / “ver menos”
  expandBtn.addEventListener('click', () => {
    const showing = moreDiv.classList.toggle('visible-content');
    expandBtn.textContent = showing ? '−' : '+';
  });

  // 7) Lightbox: abrir imágenes en grande
  const modal    = document.getElementById('img-modal');
  const modalImg = modal.querySelector('img');

  function openLightbox(src, alt) {
    modalImg.src = src;
    modalImg.alt = alt;
    modal.style.display = 'flex';
  }

  // Cierra lightbox al hacer click
  modal.addEventListener('click', () => {
    modal.style.display = 'none';
    modalImg.src = '';
    modalImg.alt = '';
  });

  // Delegación de eventos: todas las imágenes de proyectos
  projectsContainer.addEventListener('click', evt => {
    const img = evt.target.closest('.project-card img');
    if (img) openLightbox(img.src, img.alt);
  });
});

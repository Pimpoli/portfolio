// projects.js

document.addEventListener('DOMContentLoaded', () => {
  const projectsContainer = document.getElementById('projects-container');

  // Objeto con contenido de Proyectos
  const projectsContent = {
    title: 'My Work / Examples',
    items: [
      {
        img: 'img/MultiGameInc.png',
        title: 'Proximamente',
        desc: 'Proximamente'
      },
      {
        img: 'img/MultiGameInc.png',
        title: 'Proximamente',
        desc: 'Proximamente'
      }
      // Si deseas agregar más proyectos, añade nuevos objetos aquí:
      // e.g.
      // {
      //   img: 'img/otraImg.png',
      //   title: 'Proyecto 3',
      //   desc: 'Descripción Proyecto 3'
      // }
    ]
  };

  // Crear el encabezado de la sección
  const h2 = document.createElement('h2');
  h2.className = 'fade-in';
  h2.setAttribute('data-i18n', 'projects.title');
  h2.innerText = projectsContent.title;
  projectsContainer.appendChild(h2);

  // Crear el grid de proyectos
  const grid = document.createElement('div');
  grid.className = 'projects-grid';

  projectsContent.items.forEach((proj, index) => {
    const card = document.createElement('div');
    card.className = `project-card fade-in scroll-delay-${index + 1}`;
    card.innerHTML = `
      <img src="${proj.img}" alt="${proj.title}" />
      <h3>${proj.title}</h3>
      <p>${proj.desc}</p>
    `;
    grid.appendChild(card);
  });

  // Añadir el botón para expandir más (si en un futuro quieres tener contenido oculto)
  const expandBtn = document.createElement('button');
  expandBtn.className = 'expand-btn fade-in scroll-delay-3';
  expandBtn.setAttribute('data-target', 'more-projects');
  expandBtn.textContent = '+';

  // Contenedor oculto (puedes dejarlo vacío o con ejemplos en video)
  const moreContent = document.createElement('div');
  moreContent.id = 'more-projects';
  moreContent.className = 'more-content';
  moreContent.innerHTML = `
     <div class="projects-grid">
      <div class="project-card fade-in">
        <video controls width="100%" poster="img/Bloxidextro_Cover.jpg">
          <source src="img/Sea.mp4" type="video/mp4" />
          Tu navegador no soporta video HTML5.
        </video>
        <h3>Sea</h3>
        <p>Video que muestra olas realistas.</p>
      </div>
    </div>

    <div class="projects-grid">
      <div class="project-card fade-in">
        <video controls width="100%" poster="img/MultiGameInc.jpg">
          <source src="img/Menu-de-Pausa.mp4" type="video/mp4" />
          Tu navegador no soporta video HTML5.
        </video>
        <h3>Demostración: Menú de Pausa</h3>
        <p>Video que muestra el menú de pausa implementado.</p>
      </div>
    </div>
  `;

  projectsContainer.appendChild(grid);
  projectsContainer.appendChild(expandBtn);
  projectsContainer.appendChild(moreContent);
});

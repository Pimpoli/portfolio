document.addEventListener('DOMContentLoaded', () => {
  const aboutContainer = document.getElementById('about-container');
  if (!aboutContainer) return;

  // Configuración de datos estáticos
  const aboutData = {
    img: 'img/MultiGameInc.webp',
    studioUrl: 'https://www.roblox.com/es/communities/17387910/Multi-Game-Inc#!/about'
  };

  // Limpiar contenido previo (el HTML antiguo)
  aboutContainer.innerHTML = '';

  // Crear título
  const h2 = document.createElement('h2');
  h2.className = 'fade-in';
  h2.setAttribute('data-i18n', 'about.title');
  h2.textContent = 'Sobre mí'; 
  aboutContainer.appendChild(h2);

  // Crear lista
  const ul = document.createElement('ul');
  ul.className = 'about-list';

  // Función para crear items de la lista
  const createItem = (labelKey, valueKey, isStudio = false, index) => {
    const li = document.createElement('li');
    li.className = `about-item fade-in scroll-delay-${index + 1}`;
    
    // Etiqueta (ej: "Nombre:")
    const strong = document.createElement('strong');
    strong.setAttribute('data-i18n', labelKey);
    
    li.appendChild(strong);
    li.appendChild(document.createTextNode(' ')); // Espacio

    if (isStudio) {
      // Caso especial para el Studio: Enlace con Texto + Imagen
      const a = document.createElement('a');
      a.href = aboutData.studioUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'studio-link';
      
      const spanText = document.createElement('span');
      spanText.setAttribute('data-i18n', valueKey);
      spanText.textContent = 'Multi Game Inc';
      
      const img = document.createElement('img');
      img.src = aboutData.img;
      img.alt = 'Multi Game Inc Logo';
      img.className = 'studio-logo-small';
      
      a.appendChild(spanText);
      a.appendChild(img);
      li.appendChild(a);
    } else {
      // Caso normal: Solo texto
      const span = document.createElement('span');
      span.setAttribute('data-i18n', valueKey);
      li.appendChild(span);
    }
    
    return li;
  };

  // Generar los 4 items solicitados
  ul.appendChild(createItem('about.list.nameLabel', 'about.list.nameValue', false, 0));
  ul.appendChild(createItem('about.list.expLabel', 'about.list.expValue', false, 1));
  ul.appendChild(createItem('about.list.enginesLabel', 'about.list.enginesValue', false, 2));
  ul.appendChild(createItem('about.list.studioLabel', 'about.list.studioName', true, 3));

  aboutContainer.appendChild(ul);
});

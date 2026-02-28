// js/about.js

document.addEventListener('DOMContentLoaded', () => {
  const aboutContainer = document.getElementById('about-container');
  if (!aboutContainer) return;

  // Configuración de datos estáticos
  const aboutData = {
    img: 'img/MultiGameInc.webp',
    studioUrl: 'https://www.roblox.com/es/communities/17387910/Multi-Game-Inc#!/about'
  };

  // Función constructora: Crea la sección entera
  function renderAboutSection() {
    // Limpiamos el contenedor por si estamos recargando un nuevo idioma
    aboutContainer.innerHTML = '';

    // Función inteligente que busca la traducción, y si no la encuentra, usa el texto por defecto
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

    // 1. Crear título
    const h2 = document.createElement('h2');
    h2.className = 'fade-in visible'; // Lo forzamos a ser visible por si cambia el idioma
    h2.setAttribute('data-i18n', 'about.title');
    h2.textContent = getT('about.title', 'Sobre mí'); 
    aboutContainer.appendChild(h2);

    // 2. Crear lista
    const ul = document.createElement('ul');
    ul.className = 'about-list';

    // Función para crear cada línea de información con su texto de respaldo
    const createItem = (labelKey, valueKey, defaultLabel, defaultValue, isStudio = false, index) => {
      const li = document.createElement('li');
      li.className = `about-item fade-in visible scroll-delay-${index + 1}`;
      
      // Etiqueta principal en negrita
      const strong = document.createElement('strong');
      strong.setAttribute('data-i18n', labelKey);
      strong.textContent = getT(labelKey, defaultLabel);
      
      li.appendChild(strong);
      li.appendChild(document.createTextNode(' ')); // Espacio separador

      if (isStudio) {
        // Caso especial para el Studio: Enlace con Texto + Imagen
        const a = document.createElement('a');
        a.href = aboutData.studioUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'studio-link';
        
        const spanText = document.createElement('span');
        spanText.setAttribute('data-i18n', valueKey);
        spanText.textContent = getT(valueKey, defaultValue);
        
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
        span.textContent = getT(valueKey, defaultValue);
        li.appendChild(span);
      }
      
      return li;
    };

    // 3. Generar los items con la NUEVA INFORMACIÓN como idioma de seguridad
    ul.appendChild(createItem('about.list.nameLabel', 'about.list.nameValue', 'Mi nombre:', 'Anthony // Alias: PimpoliDev', false, 0));
    ul.appendChild(createItem('about.list.expLabel', 'about.list.expValue', 'Experiencia:', 'Más de 4 años de experiencia como Programador', false, 1));
    ul.appendChild(createItem('about.list.enginesLabel', 'about.list.enginesValue', 'Motores que manejo:', 'Roblox Studio y Godot Engine 4', false, 2));
    ul.appendChild(createItem('about.list.studioLabel', 'about.list.studioName', 'Fundador de', 'Multi Game Inc', true, 3));

    aboutContainer.appendChild(ul);
  }

  // Ejecutamos la función de inmediato al abrir la página
  renderAboutSection();

  // Y le decimos que vuelva a ejecutarla (actualizando los textos) si el usuario toca el botón de idioma
  document.addEventListener('languageLoaded', () => {
    renderAboutSection();
  });
});

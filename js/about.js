// about.js

document.addEventListener('DOMContentLoaded', () => {
  const aboutContainer = document.getElementById('about-container');

  // Objeto con la información "Sobre mí"
  const aboutContent = {
    title: 'About Me',
    description: `Soy un desarrollador en Roblox con más de tres años de experiencia. 
    Puedo crear sistemas de olas procedurales realistas, optimizar scripts y juego, 
    y desarrollar poderes PvP para NPC.`,
    infoList: [
      {
        label: 'Years of Experience:',
        value: '+3 years'
      },
      {
        label: 'Primary Language & Engine:',
        value: 'Lua / Roblox Studio'
      },
      {
        label: 'Secondary Language & Engine:',
        value: 'GDScript / Godot (nivel básico)'
      }
    ],
    founder: {
      text: 'Fundador de Multi Game Inc',
      iconSrc: 'img/MultiGameInc.png',
      iconAlt: 'Roblox Group',
      iconLink: 'https://www.roblox.com/es/communities/17387910/Multi-Game-Inc#!/about'
    }
  };

  // Crear el encabezado
  const h2 = document.createElement('h2');
  h2.className = 'fade-in';
  h2.setAttribute('data-i18n', 'about.title');
  h2.innerText = aboutContent.title;
  aboutContainer.appendChild(h2);

  // Crear el párrafo de descripción
  const p = document.createElement('p');
  p.className = 'fade-in scroll-delay-1';
  p.setAttribute('data-i18n', 'about.description');
  p.innerText = aboutContent.description;
  aboutContainer.appendChild(p);

  // Crear la lista de datos
  const ul = document.createElement('ul');
  ul.className = 'info-list fade-in scroll-delay-2';

  aboutContent.infoList.forEach(item => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${item.label}</strong> ${item.value}`;
    ul.appendChild(li);
  });

  // Añadir el ítem de fundador con icono enlazado
  const liFounder = document.createElement('li');
  liFounder.className = 'fade-in scroll-delay-2';
  liFounder.innerHTML = `
    <strong>${aboutContent.founder.text}</strong>
    <a href="${aboutContent.founder.iconLink}" target="_blank" rel="noopener">
      <img src="${aboutContent.founder.iconSrc}" alt="${aboutContent.founder.iconAlt}" class="icon-inline small-icon" />
    </a>
  `;
  ul.appendChild(liFounder);

  aboutContainer.appendChild(ul);
});

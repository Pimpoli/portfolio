// games.js
document.addEventListener('DOMContentLoaded', () => {
  const gamesContainer     = document.getElementById('games-container');
  const loadMoreBtn        = document.getElementById('load-more-games');
  const moreGamesContainer = document.getElementById('more-games');

  /**
   * Define aquí todos tus juegos de forma manual. Cada objeto contiene:
   *   - id:        ID de Roblox (solo para el enlace en <a>).
   *   - name:      Nombre que aparece bajo la tarjeta.
   *   - iconUrl:   Ruta local o externa de la imagen del ícono (1000×1000 recomendado).
   *   - coverUrl:  Ruta local o externa de la imagen de la portada (1920×1080 recomendado).
   *
   * Si quieres agregar/quitar/modificar juegos, edita este arreglo.
   */
 const GAMES = [
    {
      id: 16125269940,
      name: 'Anime Color Block Run',
      iconUrl: 'img/AnimeColor_icon.png',
      coverUrl: 'img/AnimeColor_Cover.png'
    },
    {
      id: 71541333892738,
      name: 'Bloxidextro',
      iconUrl: 'img/Bloxidextro_icon.png',
      coverUrl: 'img/Bloxidextro_Cover.png'
    },
    {
      id: 17166282321,
      name: 'Next Game Soon',
      iconUrl: 'img/NextGame_icon.png',
      coverUrl: 'img/NextGame_Cover.png'
    }
    // …puedes agregar más objetos aquí si quieres
  ];

  /**
   * Crea y devuelve una tarjeta de juego completa (DOM Node).
   * Utiliza las clases CSS que ya existen en style.css (.game-card, .game-icon, etc.)
   *
   * @param {Object} game   { id, name, iconUrl, coverUrl }
   * @returns {HTMLElement} el <div> con la tarjeta lista para insertar
   */
  function renderGameCard(game) {
    const card = document.createElement('div');
    card.className = 'game-card fade-in';

    card.innerHTML = `
      <a href="https://www.roblox.com/games/${game.id}" target="_blank" rel="noopener">
        <div class="game-icon">
          <img src="${game.iconUrl}" alt="${game.name}" />
        </div>
        <div class="game-cover">
          <img src="${game.coverUrl}" alt="Portada ${game.name}" />
          <div class="gradient"></div>
        </div>
      </a>
      <div class="game-title">${game.name}</div>
    `;
    return card;
  }

  // —————————————————————————————
  // 1) Mostrar los dos primeros juegos al cargar la página
  // —————————————————————————————
  const initialGames = GAMES.slice(0, 2);
  initialGames.forEach(game => {
    const cardNode = renderGameCard(game);
    gamesContainer.appendChild(cardNode);
  });

  // —————————————————————————————
  // 2) Preparar los juegos restantes (ocultos inicialmente)
  // —————————————————————————————
  const extraGames = GAMES.slice(2);
  extraGames.forEach(game => {
    const cardNode = renderGameCard(game);
    moreGamesContainer.appendChild(cardNode);
  });
  // Nota: #more-games arranca con class="more-content" (oculto por CSS).
  // Cuando se añada la clase "visible-content", su display cambiará a flex y se hará visible.

  games.forEach(game => {
      const card = renderGameCard(game);
      container.appendChild(card);
      card.className = 'game-card';
      card.innerHTML = `<img src="${game.icon}" alt="${game.name}"><h3>${game.name}</h3>`;
      container.appendChild(card);
  });

  // —————————————————————————————
  // 3) El botón “+” alterna la visibilidad de #more-games
  // —————————————————————————————
  loadMoreBtn.addEventListener('click', () => {
    if (moreGamesContainer.classList.contains('visible-content')) {
      moreGamesContainer.classList.remove('visible-content');
      loadMoreBtn.textContent = '+';
    } else {
      moreGamesContainer.classList.add('visible-content');
      loadMoreBtn.textContent = '−';
    }
  });
});

// js/config.js — Configuración central del sitio (IDs, enlaces y claves públicas).
// Cambia aquí los datos una sola vez; el resto de scripts los leen de window.SITE.

window.SITE = {
  robloxUserId: 3404416545,
  robloxGroupId: 17387910,

  // Juegos publicados en Roblox (placeId). El número de juegos que muestra la web
  // se calcula a partir de esta lista.
  games: [
    { placeId: 108138370693321, name: 'Avalanche of objects' },
    { placeId: 107848717127408, name: "Don't Let Celebrities Crush You" },
    { placeId: 16125269940,     name: 'Anime Color Block Run' },
    { placeId: 107726833867004, name: '67 Red Light Green Light' },
    { placeId: 71541333892738,  name: 'Bloxidextro' },
  ],

  youtube: {
    // Clave de navegador de YouTube Data API v3. Es visible para cualquiera que abra
    // la web, así que debe estar restringida en console.cloud.google.com:
    //   · Restricción de aplicación: referentes HTTP → https://pimpolidev.com/*
    //   · Restricción de API: solo "YouTube Data API v3"
    apiKey: 'AIzaSyAI0klDbsko8_UrYOe0Rwu6aK6vrIS2iNc',
    uploadsPlaylistId: 'UUH7nYiCQfSa78XfWIc5Nh6w',
  },

  store: [
    { youtubeId: 'iUatLzmCRtE', gumroadUrl: 'https://pimpolidev.gumroad.com/l/wyfdgk', price: '$3.00', currency: 'USD' },
    { youtubeId: '8G_FWh10mqU', gumroadUrl: 'https://pimpolidev.gumroad.com/l/rxlko',  price: '$8.00', currency: 'USD' },
  ],
};

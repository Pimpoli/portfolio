# PimpoliDev — Portafolio web

Portafolio de **PimpoliDev** (desarrollador de Roblox y fundador de **Multi Game Inc**), publicado en GitHub Pages en [pimpolidev.com](https://pimpolidev.com).

Es un sitio estático: HTML, CSS y JavaScript sin frameworks ni paso de compilación. Tiene tema oscuro y claro, está en español, inglés y portugués, y muestra datos en vivo de Roblox y YouTube.

## Estructura

| Ruta | Qué es |
| --- | --- |
| `index.html` | Página principal: inicio, estadísticas, sobre mí, proyectos, juegos, tienda y contacto. |
| `MultiGameInc/` | Página del estudio Multi Game Inc. |
| `Game-1/`, `Game-2/` | Minijuegos en 3D (three.js): *Color Block* (1 jugador) y *Ambidextro* (2 jugadores). Funcionan con teclado y con pantalla táctil; sin WebGL usan el dibujo 2D de antes. |
| `js/vendor/` | three.js r170 (licencia MIT) y los addons que usan los juegos, servidos desde el propio sitio. |
| `404.html` | Redirige rutas antiguas o mal escritas (`/game1`, `/mgi`, `/destroygame`…). |
| `css/style.css` | Todos los estilos del sitio. Los colores están como variables en `:root` y el tema claro en `:root[data-theme="light"]`. |
| `css/destroygame.css` | Estilos del easter egg *DestroyGame* (se cargan solo al activarlo). |
| `js/config.js` | **Configuración central**: IDs de Roblox, lista de juegos, clave de YouTube y productos de la tienda. |
| `js/utils.js` | Utilidades compartidas: traducciones, caché, peticiones y ventanas modales. |
| `js/roblox.js` | Datos públicos de Roblox a través de roproxy (juegos, visitas, miembros, avatar y estado). |
| `js/i18n.js` | Idiomas: usa el idioma guardado, si no el del navegador, y si no inglés. |
| `js/main.js` | Tema, menú móvil, scroll, animaciones de entrada, avatar y estado de Roblox. |
| `js/stats.js`, `js/projects.js`, `js/games.js`, `js/products.js` | Cada sección dinámica de la home. |
| `js/destroygame.js` | Easter egg: añade `#destroygame` a la URL (o ve a `/destroygame`). |
| `locales/*.json` | Textos en `es`, `en` y `pt`. |
| `data/presence.json` | Estado de Roblox que escribe el GitHub Action. |
| `scripts/optimize-images.js` | Convierte a WebP y redimensiona las imágenes de `img/`. |

## Cómo cambiar el contenido

- **Añadir un juego de Roblox:** agrega su `placeId` y nombre a `games` en `js/config.js`. El contador de "Juegos publicados" se actualiza solo.
- **Añadir un producto:** agrega `{ youtubeId, gumroadUrl, price, currency }` a `store` en `js/config.js`. El título y la miniatura salen del vídeo de YouTube.
- **Cambiar textos:** edita `locales/es.json`, `locales/en.json` y `locales/pt.json`. Cada elemento con `data-i18n="clave"` toma su texto de ahí.
- **Imágenes nuevas:** ponlas en `img/` y ejecuta `npm install && npm run images` para convertirlas a WebP.

## Probar en local

Cualquier servidor estático sirve. Por ejemplo:

```bash
npm start            # npx serve en http://localhost:8080
# o
python3 -m http.server 8080
```

También funciona la extensión **Live Server** de VS Code.

## Estado de Roblox (GitHub Action)

`.github/workflows/presence.yml` consulta la API de presencia de Roblox y guarda en `data/presence.json` el tipo de estado (desconectado, en línea, jugando o en Studio), la hora y, si estás jugando, el nombre y el `placeId` del juego. No guarda el servidor (`gameId`), que permitiría a cualquiera entrar en tu mismo servidor, ni el lugar que tengas abierto en Studio, que puede ser un proyecto sin publicar.

Necesita uno de estos *secrets* del repositorio (Settings → Secrets and variables → Actions):

- `ROBLOX_API_KEY`: API key de Open Cloud. Es la opción recomendada.
- `ROBLOX_COOKIE`: cookie `.ROBLOSECURITY`. Da acceso completo a la cuenta, así que es mejor usar la de una cuenta secundaria.

GitHub puede retrasar bastante las ejecuciones programadas. Si `presence.json` tiene más de 60 minutos, la web lo ignora y consulta Roblox directamente.

## Clave de YouTube

La clave de `js/config.js` es de navegador y cualquiera puede verla. Para que no la usen desde otras webs, restríngela en [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

1. **Restricción de aplicación:** referentes HTTP → `https://pimpolidev.com/*`.
2. **Restricción de API:** solo *YouTube Data API v3*.

## Dependencias externas

- [Google Fonts](https://fonts.google.com): Fredoka y Figtree.
- [roproxy](https://roproxy.com): proxy público de las APIs de Roblox.
- YouTube Data API v3 y Gumroad.

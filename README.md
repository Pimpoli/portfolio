# PimpoliDev — Portafolio web

Portafolio de **PimpoliDev** (desarrollador de Roblox y fundador de **Multi Game Inc**), publicado en GitHub Pages en [pimpolidev.com](https://pimpolidev.com).

Es un sitio estático: HTML, CSS y JavaScript sin frameworks ni paso de compilación. Tiene tema oscuro y claro, está en español, inglés y portugués, y muestra datos en vivo de Roblox y YouTube. Las fuentes (Bricolage Grotesque y Source Sans 3) se sirven desde `fonts/`, así que no depende de Google Fonts.

## Estructura

| Ruta | Qué es |
| --- | --- |
| `index.html` | Página principal: inicio, estadísticas, sobre mí, proyectos, juegos, tienda y contacto. |
| `MultiGameInc/` | Página del estudio Multi Game Inc. |
| `404.html` | Redirige rutas antiguas o mal escritas (`/mgi`, `/destroygame`…). |
| `fonts/` | Las dos fuentes de la web en WOFF2 (subconjunto latino). |
| `css/style.css` | Todos los estilos del sitio. Los colores están como variables en `:root` y el tema claro en `:root[data-theme="light"]`. |
| `css/destroygame.css` | Estilos del easter egg *DestroyGame* (se cargan solo al activarlo). |
| `js/config.js` | **Configuración central**: IDs de Roblox, lista de juegos, clave de YouTube y productos de la tienda. |
| `js/utils.js` | Utilidades compartidas: traducciones, caché, peticiones y ventanas modales. |
| `js/roblox.js` | Datos públicos de Roblox a través de roproxy (juegos, visitas, miembros, avatar y estado). |
| `js/i18n.js` | Idiomas: usa el idioma guardado, si no el del navegador, y si no inglés. |
| `js/main.js` | Tema, menú móvil, enlace activo, animaciones de entrada, avatar, estado de Roblox y contadores. |
| `js/stats.js` | La fila de cifras (años, juegos, visitas, miembros). |
| `js/games.js` | Juego destacado, tarjetas de juegos (con insignia «Nuevo» o «jugando ahora») y la ventana de detalle. |
| `js/projects.js`, `js/products.js` | Demo del Sistema de Nodos y últimos vídeos; tienda de Gumroad. |
| `js/destroygame.js` | Easter egg: añade `#destroygame` a la URL (o ve a `/destroygame`). |
| `locales/*.json` | Textos en `es`, `en` y `pt`. |
| `data/presence.json` | Estado de Roblox que escribe el GitHub Action. |
| `data/roblox.json` | Copia de tus datos públicos de Roblox (juegos, portadas, iconos, vídeos, visitas, avatar, seguidores, miembros del grupo) que genera el Action. La web la usa primero, así que los juegos cargan aunque roproxy falle. |
| `scripts/fetch-roblox.mjs` | Script que genera `data/roblox.json` llamando a las APIs de Roblox. |
| `scripts/optimize-images.js` | Convierte a WebP y redimensiona las imágenes de `img/`. |

## Cómo cambiar el contenido

- **Añadir un juego de Roblox:** agrega su `placeId` y nombre a `games` en `js/config.js` (`isNew: true` lo marca como «Nuevo» hasta que le quites la marca; sin ella, se considera nuevo durante 90 días desde su fecha de creación en Roblox). El contador de juegos y la franja bajo la presentación se actualizan solos. El juego destacado es el que tiene gente jugando en ese momento o, si no, el más visitado.
- **Editar el «Sobre mí»:** los textos de las tarjetas están en `locales/*.json`, dentro de `about`; cambia los tres idiomas a la vez.
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

## Estado y datos de Roblox (GitHub Action)

`.github/workflows/presence.yml` consulta la API de presencia de Roblox y guarda en `data/presence.json` el tipo de estado (desconectado, en línea, jugando o en Studio), la hora y, si estás jugando, el nombre y el `placeId` del juego. No guarda el servidor (`gameId`), que permitiría a cualquiera entrar en tu mismo servidor, ni el lugar que tengas abierto en Studio, que puede ser un proyecto sin publicar.

Necesita uno de estos *secrets* del repositorio (Settings → Secrets and variables → Actions):

- `ROBLOX_API_KEY`: API key de Open Cloud. Es la opción recomendada.
- `ROBLOX_COOKIE`: cookie `.ROBLOSECURITY`. Da acceso completo a la cuenta, así que es mejor usar la de una cuenta secundaria.

El mismo Action ejecuta `scripts/fetch-roblox.mjs` y guarda `data/roblox.json` con los datos públicos de tus juegos y tu perfil; si Roblox no responde, se conserva la copia anterior. Después la web pide los datos en vivo a roproxy para tener los números al momento.

GitHub puede retrasar bastante las ejecuciones programadas. Si `presence.json` tiene más de 60 minutos, la web lo ignora y consulta Roblox directamente.

## Clave de YouTube

La clave de `js/config.js` es de navegador y cualquiera puede verla. Para que no la usen desde otras webs, restríngela en [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

1. **Restricción de aplicación:** referentes HTTP → `https://pimpolidev.com/*`.
2. **Restricción de API:** solo *YouTube Data API v3*.

## Dependencias externas

- [Google Fonts](https://fonts.google.com): Fredoka y Figtree.
- [roproxy](https://roproxy.com): proxy público de las APIs de Roblox.
- YouTube Data API v3 y Gumroad.

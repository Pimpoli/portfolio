# Portfolio Web - MultiGameInc (PmpoliDev)

Este repositorio contiene los archivos para un portafolio web profesional de un desarrollador de Roblox (PmpoliDev), con soporte multilingüe, modo oscuro/ligero, animaciones suaves y secciones:

- **index.html**: HTML principal con secciones: Home, About, Projects, Store, Contact.
- **css/style.css**: Estilos CSS, incluye diseño oscuro/ligero, animaciones, responsive.
- **js/i18n.js**: Lógica de internacionalización (carga de archivos JSON según idioma seleccionado).
- **js/main.js**: Script de interactividad: menú móvil, scroll suave, cambio de tema (dark/light), animaciones.
- **locales/**: Archivos JSON con traducciones para: en (inglés), es, pt, fr, zh-CN (chino simplificado), zh-TW (chino tradicional), ja (japonés), ko (coreano), ar (árabe).
- **img/**: Contiene:
  - `avatar.png`: Foto/avatar del desarrollador.
  - `logo-pattern.png`: Patrón de logotipos de Roblox para fondo.
  - `favicon.ico`: Icono de la página.
  - (Opcional) OTROS íconos estáticos si no usas Font Awesome.

## Estructura y propósito de cada archivo

### index.html
- Define la estructura del portafolio:
  - **`<header>`**: Barra de navegación fija, con logo y menú.
  - **Sección `#home`**: Introducción con nombre, subtítulo y avatar.
  - **Sección `#about`**: Información personal, experiencia, lenguajes y motores.
  - **Sección `#projects`**: Ejemplos de trabajo. Tarjetas con imágenes o videos.
  - **Sección `#store`**: Productos disponibles, cada uno con tarjeta.
  - **Sección `#contact`**: Iconos de redes sociales (Discord, Twitter, Roblox, YouTube).
  - **Footer**: Año dinámico.

- Incluye atributos `data-i18n="clave"` para text
- `<select id="languageSwitcher">` para cambiar idioma.
- Botón de modo oscuro/ligero con icono de luna/sol.
- Animaciones de scroll suave a secciones.

### css/style.css
- Variables CSS (`:root`) para colores en modo oscuro y claro.
- Mixins para transiciones suaves.
- Estilos responsive con grid y flex.
- Patrón de fondo semitransparente con logotipos de Roblox.
- Clases para animaciones: fade-in, scroll, hover.
- Estilos para `dark-mode` y `light-mode`.

### js/i18n.js
- Detecta idioma en `localStorage` o idioma del navegador.
- Carga JSON correspondiente (`locales/<lang>.json`).
- Reemplaza innerText de elementos con `data-i18n`.
- Maneja idiomas RTL como árabe.
- Comentarios explicativos en cada función.

### js/main.js
- **Menú móvil**: Abre/cierra menú deslizable.
- **Scroll suave**: Al hacer clic en enlaces del menú, desplaza suavemente a la sección.
- **Tema oscuro/ligero**: Cambia clases `dark-mode`/`light-mode` en `<body>`, anima transición de colores.
- **Detecta y aplica tema inicial de `localStorage`**.
- **Animaciones de entrada**: Al cargar cada sección, efecto fade-in.
- Comentarios detallados explicando cada bloque.

### locales/*.json
- Cada archivo JSON contiene un objeto anidado con llaves coincidentes con `data-i18n`.
- Traducciones para:
  - Inglés (`en.json`)
  - Español (`es.json`)
  - Portugués (`pt.json`)
  - Francés (`fr.json`)
  - Chino simplificado (`zh-CN.json`)
  - Chino tradicional (`zh-TW.json`)
  - Japonés (`ja.json`)
  - Coreano (`ko.json`)
  - Árabe (`ar.json`) (RTL)

## Datos personales configurables
- En `locales/*.json`, revisa secciones: `home`, `about`, `projects`, `store`, `contact`.
- Actualiza texto `about.description` y puntos de experiencia.
- Lista de proyectos: título, descripción, rutas de imágenes/videos.
- Sección de tienda: nombre, descripción, precio, enlace de pago (opcional).
- Redes sociales: actualiza enlaces en `index.html`.
- En sección "Juegos creados", se usa la API de Roblox para obtener íconos y nombres dinámicos.

## Instrucciones para correr localmente
1. Clonar o descargar este repositorio.
2. Abrir la carpeta en VS Code.
3. Instalar extensión **Live Server**.
4. Hacer clic derecho en `index.html` → **Open with Live Server**.
5. Navegar y probar:
   - Cambio de idioma en el selector.
   - Cambio de tema con el botón de luna/sol.
   - Scroll suave al hacer clic en enlaces.
   - Animaciones de fade-in.

## Cómo personalizar
- **Imágenes**: Reemplaza archivos en `img/` (avatar.png, fondos, íconos propios).
- **JSON de idiomas**: Agrega o modifica traducciones en `locales/<lang>.json`.
- **Colores**: Edita variables CSS en `:root` dentro de `style.css`.
- **Animaciones**: Agrega clases CSS animadas y usa en HTML.

## Dependencias externas
- **Font Awesome**: Proporciona íconos de redes sociales y sol/luna.
- **Normalize.css**: Resetea estilos base del navegador.
- **Google Fonts**: Carga fuente Roboto para textos.

---
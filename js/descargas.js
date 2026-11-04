// js/descargas.js — Páginas de ROME Engine y GodotLuau.
// La versión escrita en el HTML se compara con la última de GitHub: si sale una nueva,
// los botones, el tamaño, la huella y el historial se ponen al día sin tocar la página.

(function () {
  'use strict';

  const { t, el, cache, fetchJSON } = window.U;
  const Pagina = document.querySelector('[data-repo]');
  if (!Pagina) return;

  const Repo = Pagina.dataset.repo;
  const Ns = Pagina.dataset.ns;

  const Formatos = {
    windows: /windows.*\.(exe|zip)$/i,
    linux: /linux.*\.(zip|tar\.gz|appimage|x86_64)$/i,
  };

  // Sistema de quien visita, para enseñar el aviso o el botón que le toca
  const Agente = navigator.userAgent.toLowerCase();
  const Plataforma = (navigator.userAgentData?.platform || navigator.platform || '').toLowerCase();
  let Sistema = 'windows';
  if (/android|iphone|ipad|ipod/.test(Agente)) Sistema = 'mobile';
  else if (/mac/.test(Plataforma)) Sistema = 'mac';
  else if (/linux|cros/.test(Plataforma)) Sistema = 'linux';

  document.querySelectorAll('[data-os-only]').forEach((Cosa) => {
    Cosa.hidden = !Cosa.dataset.osOnly.split(' ').includes(Sistema);
  });
  document.querySelectorAll('[data-os-not]').forEach((Cosa) => {
    if (Cosa.dataset.osNot.split(' ').includes(Sistema)) Cosa.hidden = true;
  });

  // Fechas en el idioma elegido
  function pintarFechas() {
    const Formato = new Intl.DateTimeFormat(document.documentElement.lang || undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
    document.querySelectorAll('time[data-date]').forEach((Fecha) => {
      Fecha.textContent = Formato.format(new Date(Fecha.getAttribute('datetime')));
    });
  }

  // Botón de copiar la huella SHA-256
  document.addEventListener('click', async (e) => {
    const Boton = e.target.closest('[data-copy]');
    if (!Boton) return;
    const Texto = document.getElementById(Boton.dataset.copy)?.textContent.trim();
    if (!Texto) return;
    try {
      await navigator.clipboard.writeText(Texto);
    } catch {
      return;
    }
    const Antes = Boton.textContent;
    Boton.textContent = t(Ns + '.dl.copied', 'Copied');
    setTimeout(() => { Boton.textContent = Antes; }, 1600);
  });

  // Ver todas las versiones del historial
  document.querySelectorAll('[data-more]').forEach((Boton) => {
    const Lista = document.getElementById(Boton.dataset.more);
    if (!Lista) return;
    const Pintar = () => {
      const Abierta = Lista.dataset.expanded === 'true';
      Boton.textContent = Abierta ? t(Ns + '.log.less', 'Show fewer versions') : t(Ns + '.log.more', 'Show all versions');
      Boton.setAttribute('aria-expanded', String(Abierta));
    };
    Boton.addEventListener('click', () => {
      Lista.dataset.expanded = Lista.dataset.expanded === 'true' ? 'false' : 'true';
      Pintar();
    });
    document.addEventListener('languageLoaded', Pintar);
    Pintar();
  });

  // Las notas de GitHub vienen en Markdown: se pasan a texto con sus listas
  function notas(Texto) {
    const Partes = [];
    let Lista = null;
    for (const Linea of Texto.split(/\r?\n/)) {
      const Limpia = Linea.trim().replace(/\*\*/g, '');
      if (/^[-*] /.test(Limpia)) {
        if (!Lista) {
          Lista = el('ul');
          Partes.push(Lista);
        }
        Lista.append(el('li', { text: Limpia.slice(2) }));
      } else {
        Lista = null;
        if (Limpia) Partes.push(el('p', { class: 'release__summary', text: Limpia.replace(/^#+\s*/, '') }));
      }
    }
    return Partes;
  }

  // 178 MB o 9,4 MB, con la coma o el punto del idioma
  function megas(Bytes) {
    const Mb = Bytes / 1048576;
    const Redondo = Mb >= 100 ? Math.round(Mb) : Math.round(Mb * 10) / 10;
    return Redondo.toLocaleString(document.documentElement.lang || undefined) + ' MB';
  }

  async function buscarVersion() {
    const Clave = 'rel_' + Repo;
    let Lista = cache.get(Clave, 30 * 60_000);
    if (!Lista) {
      const Datos = await fetchJSON(`https://api.github.com/repos/${Repo}/releases?per_page=6`, {
        headers: {
          Accept: 'application/vnd.github+json',
        },
      });
      if (!Array.isArray(Datos)) return;
      Lista = Datos.filter((R) => !R.draft).map((R) => ({
        tag: R.tag_name,
        date: R.published_at,
        url: R.html_url,
        body: R.body || '',
        assets: (R.assets || []).map((A) => ({ name: A.name, size: A.size, url: A.browser_download_url })),
      }));
      cache.set(Clave, Lista);
    }

    const Ultima = Lista[0];
    if (!Ultima || Ultima.tag === Pagina.dataset.tag) return;
    if (new Date(Ultima.date) <= new Date(Pagina.dataset.date)) return;

    const Encontrada = Ultima.tag.match(/(\d+\.\d+(?:\.\d+)*(?:-(?:alpha|beta|rc)\.?\d*)?)/i);
    const Version = Encontrada ? Encontrada[1] : Ultima.tag;

    document.querySelectorAll('[data-release-version]').forEach((Cosa) => { Cosa.textContent = Version; });
    document.querySelectorAll('[data-release-short]').forEach((Cosa) => { Cosa.textContent = Version.replace(/^\d+\.\d+\.\d+-/, ''); });
    document.querySelectorAll('[data-release-date]').forEach((Fecha) => { Fecha.setAttribute('datetime', Ultima.date.slice(0, 10)); });
    document.querySelectorAll('[data-release-url]').forEach((Enlace) => { Enlace.href = Ultima.url; });

    for (const [Nombre, Formato] of Object.entries(Formatos)) {
      const Archivo = Ultima.assets.find((A) => Formato.test(A.name));
      if (!Archivo) continue;
      document.querySelectorAll(`[data-asset="${Nombre}"]`).forEach((Enlace) => { Enlace.href = Archivo.url; });
      document.querySelectorAll(`[data-asset-size="${Nombre}"]`).forEach((Cosa) => { Cosa.textContent = megas(Archivo.size); });
      document.querySelectorAll(`[data-asset-name="${Nombre}"]`).forEach((Cosa) => { Cosa.textContent = Archivo.name; });
    }

    // La huella va escrita en las notas de ROME; si no está, se quita la vieja
    const Huella = Ultima.body.match(/\b[a-f0-9]{64}\b/i);
    document.querySelectorAll('[data-release-sha]').forEach((Codigo) => {
      if (Huella) Codigo.textContent = Huella[0];
      else Codigo.closest('.hash').hidden = true;
    });

    // Entrada nueva arriba del historial con las notas tal cual estan en GitHub
    const Historial = document.querySelector('.timeline');
    if (Historial) {
      Historial.querySelector('.is-latest')?.classList.remove('is-latest');
      const Entrada = el('article', { class: 'release release--live is-latest' }, [
        el('div', { class: 'release__head' }, [
          el('span', { class: 'release__version', text: Version }),
          el('span', { class: 'state', 'data-i18n': Ns + '.log.new', text: t(Ns + '.log.new', 'New') }),
          el('time', { class: 'release__date', 'data-date': '', datetime: Ultima.date.slice(0, 10) }),
        ]),
        ...notas(Ultima.body),
        el('div', { class: 'release__links' }, [
          el('a', { class: 'text-link', href: Ultima.url, target: '_blank', rel: 'noopener', 'data-i18n': Ns + '.log.github', text: t(Ns + '.log.github', 'Release notes on GitHub →') }),
        ]),
      ]);
      Historial.prepend(Entrada);
    }
    pintarFechas();
  }

  pintarFechas();
  document.addEventListener('languageLoaded', pintarFechas);
  buscarVersion();
})();

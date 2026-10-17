(() => {
  'use strict';

  const DATA_URL = 'projects.json';

  const list = document.getElementById('project-list');
  const counter = document.getElementById('counter');
  const search = document.getElementById('search');
  const message = document.getElementById('message');
  document.getElementById('year').textContent = new Date().getFullYear();

  let projects = [];
  let items = []; // { project, li, haystack, button, panel }
  let openItem = null;

  // Normaliza para buscar sin importar tildes, diéresis ni mayúsculas (Agüera = aguera)
  const normalize = (s) =>
    String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  // Solo permite http/https en iframes y enlaces
  const safeUrl = (u) => {
    try {
      const url = new URL(u, window.location.href);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
    } catch {
      return null;
    }
  };

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const plural = (n) => `${n} ${n === 1 ? 'proyecto' : 'proyectos'}`;

  /* ---------- Construcción de cada fila ---------- */
  function buildItem(project, index) {
    const id = `panel-${project.id ?? index}`;
    const tags = Array.isArray(project.etiquetas) ? project.etiquetas : [];

    const li = el('li');

    const button = el(
      'button',
      'flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent'
    );
    button.type = 'button';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', id);

    const info = el('span', 'min-w-0');
    info.appendChild(el('span', 'block text-lg font-semibold', project.nombre ?? 'Sin nombre'));

    const tagRow = el('span', 'mt-1.5 flex flex-wrap gap-1.5');
    tags.forEach((t) =>
      tagRow.appendChild(
        el('span', 'rounded-full border border-line bg-paper px-2.5 py-0.5 text-xs font-medium text-accent', t)
      )
    );
    info.appendChild(tagRow);

    const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chevron.setAttribute('viewBox', '0 0 24 24');
    chevron.setAttribute('class', 'chevron h-5 w-5 shrink-0 text-slate-400');
    chevron.setAttribute('fill', 'none');
    chevron.setAttribute('stroke', 'currentColor');
    chevron.setAttribute('stroke-width', '2');
    chevron.setAttribute('stroke-linecap', 'round');
    chevron.setAttribute('stroke-linejoin', 'round');
    chevron.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'm6 9 6 6 6-6');
    chevron.appendChild(path);

    button.append(info, chevron);

    const panel = el('div', 'hidden border-t border-line bg-paper px-5 py-5');
    panel.id = id;
    panel.setAttribute('role', 'region');

    li.append(button, panel);

    const haystack = normalize([project.nombre, ...tags].join(' '));
    const item = { project, li, haystack, button, panel, built: false };

    button.addEventListener('click', () => toggle(item));
    return item;
  }

  /* ---------- Contenido del desplegable (se crea al abrir) ---------- */
  function fillPanel(item) {
    const { project, panel } = item;
    panel.textContent = '';

    if (project.descripcion) {
      panel.appendChild(el('p', 'mb-4 max-w-prose leading-relaxed text-slate-700', project.descripcion));
    }

    const url = safeUrl(project.url);
    if (!url) {
      panel.appendChild(el('p', 'text-sm text-slate-500', 'Este proyecto no tiene una URL válida.'));
      return;
    }

    // Contenedor responsivo 16:10 con estado de carga detrás del iframe
    const frameWrap = el('div', 'relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-line bg-white sm:aspect-[16/10]');
    frameWrap.appendChild(
      el('div', 'absolute inset-0 flex items-center justify-center text-sm text-slate-400', 'Cargando vista previa…')
    );

    const iframe = el('iframe', 'absolute inset-0 h-full w-full bg-white');
    iframe.title = `Vista previa de ${project.nombre ?? 'proyecto'}`;
    iframe.loading = 'lazy';
    iframe.referrerPolicy = 'no-referrer';
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
    iframe.src = url;
    frameWrap.appendChild(iframe);

    const actions = el('div', 'mt-4 flex flex-wrap items-center gap-x-4 gap-y-2');
    const link = el(
      'a',
      'inline-flex items-center rounded-lg bg-accent px-5 py-2.5 font-semibold text-white transition-colors hover:bg-accent-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
      'Ver web completa'
    );
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    actions.append(
      link,
      el('span', 'text-sm text-slate-500', 'Si la vista previa no carga, el sitio no permite incrustarse. Usa el botón para abrirlo.')
    );

    panel.append(frameWrap, actions);
  }

  function open(item) {
    fillPanel(item);
    item.panel.classList.remove('hidden');
    item.button.setAttribute('aria-expanded', 'true');
    openItem = item;
  }

  function close(item) {
    item.panel.classList.add('hidden');
    item.panel.textContent = ''; // libera el iframe
    item.button.setAttribute('aria-expanded', 'false');
    if (openItem === item) openItem = null;
  }

  function toggle(item) {
    if (openItem === item) return close(item);
    if (openItem) close(openItem);
    open(item);
  }

  /* ---------- Filtro en tiempo real ---------- */
  function applyFilter() {
    const terms = normalize(search.value).split(/\s+/).filter(Boolean);
    let visible = 0;

    items.forEach((item) => {
      const match = terms.every((t) => item.haystack.includes(t));
      item.li.classList.toggle('hidden', !match);
      if (match) visible++;
      else if (openItem === item) close(item);
    });

    counter.textContent =
      terms.length && visible !== items.length
        ? `${visible} de ${plural(items.length)}`
        : plural(items.length);

    list.classList.toggle('hidden', visible === 0);
    if (visible === 0 && items.length > 0) {
      showMessage('Ningún proyecto coincide con tu búsqueda. Prueba con otro nombre o etiqueta.');
    } else {
      message.classList.add('hidden');
    }
  }

  function showMessage(text) {
    message.textContent = text;
    message.classList.remove('hidden');
  }

  /* ---------- Carga de datos ---------- */
  async function init() {
    try {
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('projects.json debe contener una lista');
      projects = data;
    } catch (err) {
      console.error('Error al cargar projects.json:', err);
      counter.textContent = '0 proyectos';
      list.classList.add('hidden');
      showMessage('No se pudo cargar projects.json. Comprueba que el archivo existe y que es un JSON válido.');
      return;
    }

    items = projects.map(buildItem);
    items.forEach((i) => list.appendChild(i.li));

    if (items.length === 0) {
      counter.textContent = '0 proyectos';
      list.classList.add('hidden');
      showMessage('Todavía no hay proyectos. Añade uno en projects.json.');
      return;
    }

    applyFilter();
    search.addEventListener('input', applyFilter);
  }

  init();
})();

// Router por hash, sin datos: las rutas solo llevan índices/ids/fechas
// opacos (p.ej. #/item/i_vuelo1, #/dia/2026-10-29), nunca títulos ni nombres,
// así la URL nunca revela contenido del viaje (S9).

const routes = [];
let notFoundHandler = () => {};
let currentCleanup = null;

export function route(pattern, handler) {
  const paramNames = [];
  const regexStr = pattern
    .split('/')
    .map((seg) => {
      if (seg.startsWith(':')) {
        paramNames.push(seg.slice(1));
        return '([^/]+)';
      }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  routes.push({ regex: new RegExp('^' + regexStr + '$'), paramNames, handler });
}

export function notFound(handler) {
  notFoundHandler = handler;
}

function currentPath() {
  const hash = location.hash || '#/';
  return hash.slice(1) || '/';
}

async function dispatch() {
  if (typeof currentCleanup === 'function') {
    try {
      currentCleanup();
    } catch {
      /* ignorar errores de limpieza de la vista anterior */
    }
    currentCleanup = null;
  }
  const path = currentPath();
  for (const r of routes) {
    const m = path.match(r.regex);
    if (m) {
      const params = {};
      r.paramNames.forEach((name, i) => (params[name] = decodeURIComponent(m[i + 1])));
      const cleanup = await r.handler(params);
      if (typeof cleanup === 'function') currentCleanup = cleanup;
      return;
    }
  }
  await notFoundHandler(path);
}

export function navigate(path) {
  if (location.hash.slice(1) === path) {
    dispatch();
  } else {
    location.hash = path;
  }
}

export function startRouter() {
  window.addEventListener('hashchange', dispatch);
  dispatch();
}

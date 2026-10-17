// Construcción segura del DOM (S4). Nunca se usa innerHTML/outerHTML/
// insertAdjacentHTML: todo pasa por createElement + textContent + setAttribute
// con una lista blanca de atributos. Los manejadores de eventos se añaden con
// addEventListener, nunca como atributos on*=.

const ATTR_ALLOWLIST = new Set([
  'class', 'id', 'type', 'value', 'placeholder', 'name', 'for', 'alt', 'title',
  'role', 'tabindex', 'disabled', 'checked', 'readonly', 'required', 'min',
  'max', 'step', 'pattern', 'maxlength', 'minlength', 'rows', 'cols', 'accept',
  'multiple', 'capture', 'autocomplete', 'inputmode', 'rel', 'download',
  'aria-label', 'aria-hidden', 'aria-current', 'aria-expanded', 'aria-live',
  'aria-pressed', 'aria-describedby', 'aria-labelledby', 'draggable', 'colspan',
  'rowspan', 'scope', 'lang', 'dir', 'autofocus', 'novalidate', 'selected',
  'open', 'start',
]);

// Atributos que contienen una URL y deben pasar por safeUrl()/safeImgSrc().
const URL_ATTRS = new Set(['href', 'src', 'action']);

/**
 * Crea un elemento DOM de forma segura.
 * @param {string} tag
 * @param {object|null} attrs - atributos (lista blanca) y/o manejadores on<Evento>
 * @param {...(Node|string|Array|null|undefined|false)} children
 */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined || value === false) continue;
      if (key.startsWith('on') && typeof value === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), value);
        continue;
      }
      if (key === 'dataset' && typeof value === 'object') {
        for (const [dk, dv] of Object.entries(value)) {
          el.dataset[dk] = String(dv);
        }
        continue;
      }
      const lower = key.toLowerCase();
      if (URL_ATTRS.has(lower)) {
        // Las URLs deben llegar ya validadas por safeUrl/safeImgSrc; si no son
        // una cadena segura, se ignora el atributo (enlace/imagen sin destino).
        if (typeof value === 'string' && value !== '') el.setAttribute(lower, value);
        continue;
      }
      if (lower === 'style') {
        // Solo se permite un objeto de propiedades CSS (nunca una cadena),
        // y se aplica vía CSSOM, nunca como atributo HTML inline.
        if (typeof value === 'object') {
          for (const [cssProp, cssVal] of Object.entries(value)) {
            el.style.setProperty(cssProp, String(cssVal));
          }
        }
        continue;
      }
      if (!ATTR_ALLOWLIST.has(lower)) continue; // atributo no permitido: se descarta en silencio
      if (value === true) {
        el.setAttribute(lower, '');
      } else {
        el.setAttribute(lower, String(value));
      }
    }
  }
  appendChildren(el, children);
  return el;
}

function appendChildren(el, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) {
      appendChildren(el, child);
    } else if (child instanceof Node) {
      el.appendChild(child);
    } else {
      el.appendChild(document.createTextNode(String(child)));
    }
  }
}

/** Texto plano como nodo (atajo explícito, equivalente a pasar una cadena a h()). */
export function text(str) {
  return document.createTextNode(String(str ?? ''));
}

/** Vacía un elemento de forma segura (sin innerHTML = ''). */
export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

const ALLOWED_LINK_SCHEMES = new Set(['https:', 'tel:']);

/**
 * Valida una URL para usarla en href. Solo permite https: y tel:.
 * Devuelve null si el esquema no está permitido (S5) — el helper h() ignora
 * un href nulo, dejando el enlace sin destino en vez de arriesgarse.
 */
export function safeUrl(url) {
  if (typeof url !== 'string' || url.trim() === '') return null;
  let parsed;
  try {
    parsed = new URL(url, 'https://placeholder.invalid/');
  } catch {
    return null;
  }
  if (!ALLOWED_LINK_SCHEMES.has(parsed.protocol)) return null;
  // tel: no debe resolverse contra la base placeholder
  if (parsed.protocol === 'tel:') {
    // Reconstruye literalmente para evitar que URL normalice de forma rara.
    const raw = url.trim();
    if (!/^tel:[0-9+()\-.\s]{3,30}$/i.test(raw)) return null;
    return raw;
  }
  return parsed.href;
}

/**
 * Valida una URL de imagen: solo blob: (adjuntos en memoria) está permitido.
 */
export function safeImgSrc(url) {
  if (typeof url !== 'string' || url.trim() === '') return null;
  if (!url.startsWith('blob:')) return null;
  return url;
}

/** Construye una URL de Google Maps a partir de texto libre (nombre/dirección). */
export function mapsSearchUrl(query) {
  if (typeof query !== 'string' || query.trim() === '') return null;
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query.trim());
}

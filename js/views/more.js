import { h, clear } from '../dom.js';
import { navigate } from '../router.js';

const ENTRIES = [
  { path: '/notas', label: 'Notas' },
  { path: '/contactos', label: 'Contactos' },
  { path: '/consejos', label: 'Consejos' },
  { path: '/apps-utiles', label: 'Apps útiles' },
  { path: '/conversor', label: 'Conversor THB ↔ EUR' },
  { path: '/ajustes', label: 'Ajustes' },
];

export function renderMore(container) {
  clear(container);
  container.appendChild(h('h1', null, 'Más'));
  const list = h('ul', { class: 'list-plain' });
  for (const entry of ENTRIES) {
    list.appendChild(h('li', null, h('button', { class: 'btn', onClick: () => navigate(entry.path) }, entry.label)));
  }
  container.appendChild(list);
  return () => {};
}

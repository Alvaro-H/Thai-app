import { h, clear } from '../dom.js';
import { navigate } from '../router.js';

const ENTRIES = [
  { path: '/notas', label: 'Notas', hint: 'Lo que quieras apuntar' },
  { path: '/contactos', label: 'Contactos', hint: 'Agencia, seguro y emergencias' },
  { path: '/consejos', label: 'Consejos', hint: 'Costumbres y trucos locales' },
  { path: '/apps-utiles', label: 'Apps útiles', hint: 'Para moverse y pagar allí' },
  { path: '/conversor', label: 'Conversor', hint: 'Bahts y euros' },
  { path: '/ajustes', label: 'Ajustes', hint: 'Bloqueo y copia de seguridad' },
];

export function renderMore(container) {
  clear(container);
  container.appendChild(h('h1', null, 'Más'));
  const list = h('ul', { class: 'more-grid' });
  for (const entry of ENTRIES) {
    list.appendChild(h('li', null, h('button', { class: 'more-tile', onClick: () => navigate(entry.path) }, h('span', { class: 'more-label' }, entry.label), h('span', { class: 'more-hint' }, entry.hint))));
  }
  container.appendChild(list);
  return () => {};
}

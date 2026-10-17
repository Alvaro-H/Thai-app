import { h, clear } from '../dom.js';
import { getTripData } from '../session.js';
import { navigate } from '../router.js';

export function renderApps(container) {
  const trip = getTripData();
  clear(container);
  container.appendChild(h('button', { class: 'btn-back', onClick: () => navigate('/mas') }, '← Más'));
  container.appendChild(h('h1', null, 'Apps útiles'));

  if (!trip.apps.length) container.appendChild(h('div', { class: 'empty-state' }, 'Sin apps listadas.'));

  const ul = h('ul', { class: 'list-plain' });
  for (const app of trip.apps) {
    ul.appendChild(h('li', null, h('div', { class: 'card' }, h('div', { class: 'card-title' }, app.name), app.purpose ? h('div', { class: 'card-sub' }, app.purpose) : null)));
  }
  container.appendChild(ul);
  return () => {};
}

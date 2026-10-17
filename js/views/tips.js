import { h, clear } from '../dom.js';
import { getTripData } from '../session.js';
import { navigate } from '../router.js';
import { formatDateShort } from '../format.js';

export function renderTips(container) {
  const trip = getTripData();
  clear(container);
  container.appendChild(h('button', { class: 'btn btn-small', onClick: () => navigate('/mas') }, '← Más'));
  container.appendChild(h('h1', null, 'Consejos'));

  if (!trip.tips.length) container.appendChild(h('div', { class: 'empty-state' }, 'Sin consejos todavía.'));

  for (const tip of trip.tips) {
    container.appendChild(
      h(
        'div',
        { class: 'card' },
        h('div', { class: 'card-sub' }, tip.date ? formatDateShort(tip.date) : 'General'),
        h('div', { class: 'card-title' }, tip.title),
        tip.body ? h('p', null, tip.body) : null
      )
    );
  }
  return () => {};
}

import { h, clear, safeUrl } from '../dom.js';
import { getTripData } from '../session.js';
import { navigate } from '../router.js';

export function renderContacts(container) {
  const trip = getTripData();
  clear(container);
  container.appendChild(h('button', { class: 'btn btn-small', onClick: () => navigate('/mas') }, '← Más'));
  container.appendChild(h('h1', null, 'Contactos'));

  if (!trip.contacts.length) container.appendChild(h('div', { class: 'empty-state' }, 'Sin contactos todavía.'));

  for (const c of trip.contacts) {
    const telHref = c.phone ? safeUrl('tel:' + c.phone) : null;
    container.appendChild(
      h(
        'div',
        { class: 'card' },
        h('div', { class: 'card-title' }, c.name),
        c.role ? h('div', { class: 'card-sub' }, c.role) : null,
        c.phone ? (telHref ? h('a', { href: telHref }, c.phone) : h('div', null, c.phone)) : null,
        c.hours ? h('div', { class: 'card-sub' }, c.hours) : null,
        c.notes ? h('p', null, c.notes) : null
      )
    );
  }
  return () => {};
}

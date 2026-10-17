import { h, clear } from '../dom.js';
import { getTripData, persist } from '../session.js';
import { navigate } from '../router.js';
import { formatDateLong, formatDateShort } from '../format.js';
import { ITEM_TYPE_LABELS } from '../fields.js';

export function renderItinerary(container) {
  const trip = getTripData();
  clear(container);
  container.appendChild(h('h1', null, 'Itinerario'));

  if (!trip.days.length) {
    container.appendChild(h('div', { class: 'empty-state' }, 'Todavía no hay días cargados.'));
    return () => {};
  }

  const list = h('ul', { class: 'list-plain' });
  for (const day of trip.days) {
    const itemsCount = trip.items.filter((i) => i.date === day.date).length;
    list.appendChild(
      h(
        'li',
        null,
        h(
          'div',
          { class: 'card', onClick: () => navigate('/dia/' + day.date) },
          h('div', { class: 'row-between' }, h('div', { class: 'card-title' }, formatDateShort(day.date) + ' · ' + (day.title || day.region || '')), h('span', { class: 'pill' }, itemsCount + ' eventos')),
          day.sleepAt ? h('div', { class: 'card-sub' }, 'Duermes en: ' + sleepLabel(trip, day)) : null
        )
      )
    );
  }
  container.appendChild(list);
  return () => {};
}

function sleepLabel(trip, day) {
  const item = trip.items.find((i) => i.id === day.sleepAt);
  return item ? item.title : day.sleepAt;
}

export function renderDay(container, dateStr) {
  const trip = getTripData();
  clear(container);
  const day = trip.days.find((d) => d.date === dateStr) || { date: dateStr, notes: '' };

  container.appendChild(h('button', { class: 'btn btn-small', onClick: () => navigate('/itinerario') }, '← Itinerario'));
  container.appendChild(h('h1', null, formatDateLong(dateStr)));
  if (day.region) container.appendChild(h('p', { class: 'card-sub' }, day.region));

  const items = trip.items
    .filter((i) => i.date === dateStr)
    .sort((a, b) => (a.start || '').localeCompare(b.start || ''));

  if (!items.length) {
    container.appendChild(h('p', { class: 'empty-state' }, 'Sin eventos este día.'));
  }
  for (const item of items) {
    container.appendChild(
      h(
        'div',
        { class: 'timeline-item', onClick: () => navigate('/item/' + item.id) },
        h('div', { class: 'card-sub' }, (item.start ? item.start + ' – ' : '') + (item.end || '') + '  ·  ' + (ITEM_TYPE_LABELS[item.type] || '')),
        h('div', { class: 'card-title' }, item.title)
      )
    );
  }

  if (day.sleepAt) {
    const sleepItem = trip.items.find((i) => i.id === day.sleepAt);
    container.appendChild(h('div', { class: 'card' }, h('div', { class: 'card-sub' }, 'Duermes en'), h('div', { class: 'card-title' }, sleepItem ? sleepItem.title : day.sleepAt)));
  }

  container.appendChild(h('h2', null, 'Notas del día'));
  const textarea = h('textarea', { rows: 4, maxlength: 20000, placeholder: 'Escribe aquí...' }, day.notes || '');
  let saveTimer = null;
  textarea.addEventListener('input', () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const current = trip.days.find((d) => d.date === dateStr);
      if (current) {
        current.notes = textarea.value;
      } else {
        trip.days.push({ date: dateStr, notes: textarea.value });
      }
      await persist();
    }, 500);
  });
  container.appendChild(h('div', { class: 'field' }, textarea));

  return () => {
    if (saveTimer) clearTimeout(saveTimer);
  };
}

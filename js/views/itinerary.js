import { h, clear } from '../dom.js';
import { getTripData, persist } from '../session.js';
import { navigate } from '../router.js';
import { formatDateLong, formatDateShort } from '../format.js';
import { ITEM_TYPE_LABELS, describeNight } from '../fields.js';
import { regionKind } from '../scene.js';

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function dateBlock(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return h(
    'div',
    { class: 'day-date' },
    h('span', { class: 'day-wd' }, WEEKDAYS[wd]),
    h('span', { class: 'day-num' }, String(d)),
    h('span', { class: 'day-mon' }, MONTHS[m - 1])
  );
}

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
    const night = describeNight(trip, day);
    const place = day.region && day.title && !day.title.includes(day.region) ? day.region : '';
    list.appendChild(
      h(
        'li',
        null,
        h(
          'div',
          {
            class: 'day-card',
            dataset: { kind: regionKind(day.region) },
            role: 'button',
            tabindex: 0,
            onClick: () => navigate('/dia/' + day.date),
          },
          dateBlock(day.date),
          h(
            'div',
            { class: 'grow' },
            h('div', { class: 'card-title' }, day.title || day.region || 'Día libre'),
            place ? h('div', { class: 'day-place' }, place) : null,
            night ? h('div', { class: 'card-sub' }, night.label + ': ' + night.place) : null
          ),
          itemsCount ? h('span', { class: 'day-count', title: itemsCount + ' eventos' }, String(itemsCount)) : null
        )
      )
    );
  }
  container.appendChild(list);
  return () => {};
}


// Los alojamientos sin hora van al final del día: es donde se acaba durmiendo.
function sortKey(item) {
  if (item.start) return item.start;
  return item.type === 'hotel' ? '99:' + (item.checkinTime || '') : '00:00';
}

export function renderDay(container, dateStr) {
  const trip = getTripData();
  clear(container);
  const day = trip.days.find((d) => d.date === dateStr) || { date: dateStr, notes: '' };

  container.appendChild(h('button', { class: 'btn-back', onClick: () => navigate('/itinerario') }, '← Itinerario'));
  container.appendChild(h('h1', null, formatDateLong(dateStr)));
  if (day.region) container.appendChild(h('p', { class: 'region-tag', dataset: { kind: regionKind(day.region) } }, day.region));

  const items = trip.items
    .filter((i) => i.date === dateStr)
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

  if (!items.length) {
    container.appendChild(h('p', { class: 'empty-state' }, 'Sin eventos este día.'));
  }
  const timeline = h('div', { class: 'timeline' });
  container.appendChild(timeline);
  for (const item of items) {
    timeline.appendChild(
      h(
        'div',
        { class: 'timeline-item', dataset: { type: item.type }, role: 'button', tabindex: 0, onClick: () => navigate('/item/' + item.id) },
        h('div', { class: 'timeline-time' }, item.start ? item.start + (item.end ? ' – ' + item.end : '') : item.type === 'hotel' ? (item.checkinTime ? 'Entrada desde las ' + item.checkinTime : 'Alojamiento') : 'Todo el día'),
        h('div', { class: 'card-title' }, item.title),
        h('div', { class: 'card-sub' }, ITEM_TYPE_LABELS[item.type] || '')
      )
    );
  }

  const night = describeNight(trip, day);
  if (night) {
    container.appendChild(h('div', { class: 'card card-night' }, h('div', { class: 'card-sub' }, night.label), h('div', { class: 'card-title' }, night.place)));
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

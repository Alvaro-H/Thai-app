import { h, clear } from '../dom.js';
import { getTripData } from '../session.js';
import { navigate } from '../router.js';
import { formatDateLong, zonedTimeToUtc, nowInZone, relativeCountdown, formatTimeInZone } from '../format.js';
import { ITEM_TYPE_LABELS } from '../fields.js';

function nextUpcomingItem(trip, destTz) {
  const now = Date.now();
  let best = null;
  for (const item of trip.items) {
    const start = zonedTimeToUtc(item.date, item.start || '00:00', item.startTz || destTz);
    if (!start) continue;
    if (start.getTime() >= now - 30 * 60000) {
      if (!best || start.getTime() < best.at.getTime()) best = { item, at: start };
    }
  }
  return best;
}

function sleepLocationFor(trip, dateStr) {
  const day = trip.days.find((d) => d.date === dateStr);
  if (!day || !day.sleepAt) return null;
  const item = trip.items.find((i) => i.id === day.sleepAt);
  return item ? item.title : day.sleepAt;
}

export function renderToday(container) {
  const trip = getTripData();
  clear(container);

  const destTz = trip.trip.destTz || 'Asia/Bangkok';
  const homeTz = trip.trip.homeTz || 'Europe/Madrid';
  const { date: todayDest } = nowInZone(destTz);

  container.appendChild(h('h1', null, trip.trip.title || 'Hoy'));

  const clocksCard = h(
    'div',
    { class: 'card row-between' },
    h('div', null, h('div', { class: 'card-sub' }, 'Madrid'), h('div', { class: 'card-title' }, formatTimeInZone(new Date(), homeTz))),
    h('div', null, h('div', { class: 'card-sub' }, 'Tailandia'), h('div', { class: 'card-title' }, formatTimeInZone(new Date(), destTz)))
  );
  container.appendChild(clocksCard);

  const start = trip.trip.start;
  const end = trip.trip.end;
  const started = start && todayDest >= start;
  const ended = end && todayDest > end;

  if (!started && start) {
    const startAt = zonedTimeToUtc(start, '00:00', destTz);
    const { label } = relativeCountdown(startAt);
    container.appendChild(
      h('div', { class: 'card' }, h('div', { class: 'card-sub' }, 'Faltan'), h('div', { class: 'card-title' }, label, ' para el viaje'))
    );
  } else if (ended) {
    container.appendChild(h('div', { class: 'card' }, h('div', { class: 'card-title' }, 'El viaje ha terminado'), h('p', { class: 'card-sub' }, '¡Esperamos que lo hayáis disfrutado!')));
  } else {
    container.appendChild(h('h2', null, formatDateLong(todayDest)));

    const sleepAt = sleepLocationFor(trip, todayDest);
    if (sleepAt) {
      container.appendChild(h('div', { class: 'card' }, h('div', { class: 'card-sub' }, 'Esta noche duermes en'), h('div', { class: 'card-title' }, sleepAt)));
    }

    const next = nextUpcomingItem(trip, destTz);
    if (next) {
      const { label } = relativeCountdown(next.at);
      container.appendChild(
        h(
          'div',
          { class: 'card', onClick: () => navigate('/item/' + next.item.id) },
          h('div', { class: 'card-sub' }, 'Próximo · ' + (ITEM_TYPE_LABELS[next.item.type] || '')),
          h('div', { class: 'card-title' }, next.item.title),
          h('div', { class: 'card-sub' }, 'en ' + label)
        )
      );
    }
  }

  const pendingList = trip.checklists.find((c) => c.id === 'c_pendientes') || trip.checklists[0];
  const highPending = pendingList ? pendingList.items.filter((i) => !i.done && i.priority === 'high') : [];
  if (highPending.length) {
    container.appendChild(h('h2', null, 'Pendientes importantes'));
    const ul = h('ul', { class: 'list-plain' });
    for (const it of highPending) {
      ul.appendChild(h('li', null, h('span', { class: 'pill pill-pending' }, '!'), ' ', it.text));
    }
    container.appendChild(ul);
    container.appendChild(h('button', { class: 'btn btn-small', onClick: () => navigate('/listas') }, 'Ver todas las listas'));
  }

  return () => {};
}

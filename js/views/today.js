import { h, clear } from '../dom.js';
import { getTripData } from '../session.js';
import { navigate } from '../router.js';
import { formatDateLong, zonedTimeToUtc, nowInZone, relativeCountdown, formatTimeInZone } from '../format.js';
import { ITEM_TYPE_LABELS, describeNight } from '../fields.js';
import { scene } from '../scene.js';

const DAY_MS = 86400000;

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

// Días de calendario entre dos fechas AAAA-MM-DD (sin zonas horarias de por medio).
function daysBetween(a, b) {
  return Math.round((Date.UTC(...ymd(b)) - Date.UTC(...ymd(a))) / DAY_MS);
}
function ymd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return [y, m - 1, d];
}

function heroLines(trip, todayDest, destTz) {
  const { start, end } = trip.trip;
  if (start && todayDest < start) {
    const n = daysBetween(todayDest, start);
    const headline = n === 1 ? 'Mañana empieza el viaje' : `Faltan ${n} días`;
    return [headline, 'Salida el ' + formatDateLong(start)];
  }
  if (end && todayDest > end) {
    return ['De vuelta en casa', 'Ojalá haya sido un viaje para recordar'];
  }
  if (start && end) {
    const dayN = daysBetween(start, todayDest) + 1;
    const total = daysBetween(start, end) + 1;
    const day = trip.days.find((d) => d.date === todayDest);
    const where = day && day.region ? `, en ${day.region}` : '';
    return [`Día ${dayN} de ${total}${where}`, formatDateLong(todayDest)];
  }
  return [formatDateLong(todayDest), ''];
}

export function renderToday(container) {
  const trip = getTripData();
  clear(container);

  const destTz = trip.trip.destTz || 'Asia/Bangkok';
  const homeTz = trip.trip.homeTz || 'Europe/Madrid';
  const { date: todayDest } = nowInZone(destTz);
  const [headline, subline] = heroLines(trip, todayDest, destTz);

  container.appendChild(
    scene(
      'hero',
      h('p', { class: 'scene-greeting', lang: 'th' }, 'สวัสดี'),
      h('h1', { class: 'scene-title' }, trip.trip.title || 'Tailandia'),
      h('p', { class: 'scene-headline' }, headline),
      subline ? h('p', { class: 'scene-subline' }, subline) : null
    )
  );

  container.appendChild(
    h(
      'div',
      { class: 'clocks' },
      h('div', { class: 'clock' }, h('span', { class: 'clock-city' }, 'Madrid'), h('span', { class: 'clock-time' }, formatTimeInZone(new Date(), homeTz))),
      h('div', { class: 'clock clock-dest' }, h('span', { class: 'clock-city' }, 'Tailandia'), h('span', { class: 'clock-time' }, formatTimeInZone(new Date(), destTz)))
    )
  );

  const { start, end } = trip.trip;
  const onTrip = start && end && todayDest >= start && todayDest <= end;

  if (onTrip) {
    const night = describeNight(trip, trip.days.find((d) => d.date === todayDest));
    if (night) {
      container.appendChild(
        h('div', { class: 'card card-night' }, h('div', { class: 'card-sub' }, night.label === 'Duermes en' ? 'Esta noche duermes en' : 'Esta noche, a bordo'), h('div', { class: 'card-title' }, night.place))
      );
    }
  }

  const next = nextUpcomingItem(trip, destTz);
  if (next && (onTrip || (start && daysBetween(todayDest, start) <= 2))) {
    const { label } = relativeCountdown(next.at);
    container.appendChild(
      h(
        'div',
        { class: 'card card-next', role: 'button', tabindex: 0, onClick: () => navigate('/item/' + next.item.id) },
        h('div', { class: 'card-sub' }, 'Lo siguiente: ' + (ITEM_TYPE_LABELS[next.item.type] || '').toLowerCase() + ', en ' + label),
        h('div', { class: 'card-title' }, next.item.title)
      )
    );
  }

  const pendingList = trip.checklists.find((c) => c.id === 'c_pendientes') || trip.checklists[0];
  const highPending = pendingList ? pendingList.items.filter((i) => !i.done && i.priority === 'high') : [];
  if (highPending.length) {
    container.appendChild(h('h2', null, onTrip ? 'Pendiente' : 'Antes de salir'));
    const ul = h('ul', { class: 'list-plain pending-list' });
    for (const it of highPending) {
      ul.appendChild(h('li', null, h('span', { class: 'pill pill-pending' }, '!'), ' ', it.text));
    }
    container.appendChild(ul);
    container.appendChild(h('button', { class: 'btn btn-small', onClick: () => navigate('/listas') }, 'Ver todas las listas'));
  }

  return () => {};
}

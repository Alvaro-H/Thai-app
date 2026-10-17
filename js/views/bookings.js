import { h, clear, safeUrl, mapsSearchUrl } from '../dom.js';
import { getTripData, persist, getKey, getKdfMeta } from '../session.js';
import { saveBlob, loadBlob } from '../store.js';
import { navigate } from '../router.js';
import { ITEM_TYPE_LABELS, fieldsForType, FIELD_LABELS } from '../fields.js';
import { newId, nowIso } from '../ids.js';

const TABS = [
  { key: 'vuelos', label: 'Vuelos', types: ['flight'] },
  { key: 'traslados', label: 'Traslados', types: ['transfer', 'boat'] },
  { key: 'hoteles', label: 'Hoteles', types: ['hotel'] },
  { key: 'actividades', label: 'Actividades', types: ['activity', 'meal', 'place'] },
];

export function renderBookings(container, tabKey) {
  const trip = getTripData();
  clear(container);
  container.appendChild(h('h1', null, 'Reservas'));

  const strip = h('div', { class: 'tabs-strip' });
  for (const tab of TABS) {
    strip.appendChild(h('button', { 'aria-current': tab.key === tabKey, onClick: () => navigate('/reservas/' + tab.key) }, tab.label));
  }
  container.appendChild(strip);

  const current = TABS.find((t) => t.key === tabKey) || TABS[0];
  const items = trip.items
    .filter((i) => current.types.includes(i.type))
    .sort((a, b) => (a.date + (a.start || '')).localeCompare(b.date + (b.start || '')));

  if (!items.length) {
    container.appendChild(h('div', { class: 'empty-state' }, 'Sin elementos en esta categoría.'));
  }

  for (const item of items) {
    container.appendChild(renderItemCard(item));
  }

  container.appendChild(
    h('button', { class: 'btn', onClick: () => navigate('/item-nuevo/' + current.types[0]) }, '+ Añadir ' + (ITEM_TYPE_LABELS[current.types[0]] || '').toLowerCase())
  );

  return () => {};
}

function renderItemCard(item) {
  const sub = [item.date, item.start, item.from && item.to ? item.from + ' → ' + item.to : null].filter(Boolean).join(' · ');
  const card = h(
    'div',
    { class: 'card', onClick: () => navigate('/item/' + item.id) },
    h('div', { class: 'card-sub' }, sub),
    h('div', { class: 'card-title' }, item.title)
  );
  if (item.type === 'flight' && item.checkin) {
    card.appendChild(h('span', { class: item.checkin.status === 'done' ? 'pill pill-done' : 'pill pill-pending' }, item.checkin.status === 'done' ? 'Check-in hecho' : 'Check-in pendiente'));
  }
  return card;
}

export async function renderItemDetail(container, itemId) {
  const trip = getTripData();
  clear(container);
  const item = trip.items.find((i) => i.id === itemId);
  if (!item) {
    container.appendChild(h('div', { class: 'empty-state' }, 'Elemento no encontrado.'));
    return () => {};
  }

  const backTab = backTabFor(item.type);
  container.appendChild(h('button', { class: 'btn btn-small', onClick: () => navigate('/reservas/' + backTab) }, '← Reservas'));
  container.appendChild(h('h1', null, item.title));
  container.appendChild(h('p', { class: 'card-sub' }, ITEM_TYPE_LABELS[item.type] + ' · ' + item.date));

  if (item.type === 'flight') {
    container.appendChild(renderFlightDetail(item));
  } else if (item.type === 'hotel') {
    container.appendChild(renderHotelDetail(item));
  } else {
    container.appendChild(renderGenericDetail(item));
  }

  if (item.notes) {
    container.appendChild(h('h2', null, 'Notas'));
    container.appendChild(h('p', null, item.notes));
  }

  container.appendChild(h('h2', null, 'Documentos'));
  const attWrap = h('div', { class: 'row', style: { flexWrap: 'wrap' } });
  container.appendChild(attWrap);
  await renderAttachments(attWrap, item);

  const uploadInput = h('input', { type: 'file', accept: 'image/*,application/pdf', id: 'addDoc' });
  uploadInput.addEventListener('change', async () => {
    const file = uploadInput.files[0];
    if (!file) return;
    await addAttachmentToItem(item, file);
    await renderAttachments(attWrap, item);
    uploadInput.value = '';
  });
  container.appendChild(h('div', { class: 'field' }, h('label', { for: 'addDoc' }, 'Añadir mi documento'), uploadInput));
  container.appendChild(h('p', { class: 'card-sub' }, 'Solo se guarda en este móvil.'));

  container.appendChild(h('button', { class: 'btn', onClick: () => navigate('/item-editar/' + item.id) }, 'Editar'));

  return () => {};
}

function backTabFor(type) {
  return TABS.find((t) => t.types.includes(type))?.key || 'vuelos';
}

function renderFlightDetail(item) {
  const wrap = h('div', null);
  wrap.appendChild(
    h(
      'div',
      { class: 'card' },
      h('div', { class: 'row-between' }, h('div', null, h('div', { class: 'card-sub' }, 'Salida'), h('div', { class: 'card-title' }, item.start || '—')), h('div', null, h('div', { class: 'card-sub' }, 'Llegada'), h('div', { class: 'card-title' }, item.end || '—'))),
      h('div', { class: 'card-sub' }, item.from + ' → ' + item.to),
      item.provider ? h('div', { class: 'card-sub' }, item.provider + (item.number ? ' · ' + item.number : '')) : null,
      item.bookingRef ? h('div', { class: 'row' }, h('span', { class: 'card-sub' }, 'Localizador: '), h('button', { class: 'btn btn-small', onClick: () => copyToClipboard(item.bookingRef) }, item.bookingRef + ' · copiar')) : null,
      item.baggage ? h('div', { class: 'card-sub' }, 'Equipaje: ' + item.baggage) : null
    )
  );

  if (item.tickets && item.tickets.length) {
    const trip = getTripData();
    wrap.appendChild(h('h3', null, 'Billetes por viajero'));
    const ul = h('ul', { class: 'list-plain' });
    for (const t of item.tickets) {
      const traveler = trip.trip.travelers.find((tv) => tv.id === t.travelerId);
      ul.appendChild(h('li', null, (traveler ? traveler.name : t.travelerId) + ': ' + (t.ticketNo || t.bookingRef || '—')));
    }
    wrap.appendChild(ul);
  }

  const checkin = item.checkin || { status: 'pending' };
  const btn = h(
    'button',
    { class: checkin.status === 'done' ? 'btn' : 'btn btn-primary' },
    checkin.status === 'done' ? '✓ Check-in hecho (tocar para deshacer)' : 'Marcar check-in como hecho'
  );
  btn.addEventListener('click', async () => {
    const trip = getTripData();
    const current = trip.items.find((i) => i.id === item.id);
    const wasDone = current.checkin && current.checkin.status === 'done';
    current.checkin = wasDone ? { status: 'pending', doneAt: null } : { status: 'done', doneAt: nowIso() };
    await persist();
    navigate('/item/' + item.id);
  });
  wrap.appendChild(btn);
  return wrap;
}

function renderHotelDetail(item) {
  const wrap = h('div', null);
  wrap.appendChild(
    h(
      'div',
      { class: 'card' },
      h('div', { class: 'row-between' }, h('div', null, h('div', { class: 'card-sub' }, 'Entrada'), h('div', { class: 'card-title' }, (item.date || '') + (item.checkinTime ? ' ' + item.checkinTime : ''))), h('div', null, h('div', { class: 'card-sub' }, 'Salida'), h('div', { class: 'card-title' }, (item.endDate || '') + (item.checkoutTime ? ' ' + item.checkoutTime : '')))),
      item.address ? h('div', { class: 'card-sub' }, item.address) : null,
      item.rooms && item.rooms.length ? h('div', { class: 'card-sub' }, item.rooms.join(' · ')) : null,
      item.phone ? h('a', { href: safeUrl('tel:' + item.phone) }, 'Llamar: ' + item.phone) : null
    )
  );

  wrap.appendChild(h('button', { class: 'btn btn-primary', onClick: () => showTaxiScreen(item) }, 'Mostrar al taxista'));

  const mapsHref = safeUrl(mapsSearchUrl(item.mapQuery || item.address || item.title));
  if (mapsHref) wrap.appendChild(h('a', { class: 'btn', href: mapsHref, target: '_blank', rel: 'noopener noreferrer' }, 'Abrir en Maps'));

  return wrap;
}

function showTaxiScreen(item) {
  const overlay = h(
    'div',
    { class: 'taxi-view overlay-root' },
    h('div', { class: 'name' }, item.title),
    h('div', { class: 'address' }, item.addressLocal || item.address || ''),
    h('button', { class: 'btn btn-small', style: { marginTop: '24px', width: 'auto' }, onClick: () => overlay.remove() }, 'Cerrar')
  );
  document.body.appendChild(overlay);
}

function renderGenericDetail(item) {
  const wrap = h('div', { class: 'card' });
  if (item.start || item.end) wrap.appendChild(h('div', { class: 'card-sub' }, (item.start || '') + (item.end ? ' – ' + item.end : '')));
  if (item.provider) wrap.appendChild(h('div', { class: 'card-sub' }, item.provider));
  if (item.address) wrap.appendChild(h('div', { class: 'card-sub' }, item.address));
  if (item.details) wrap.appendChild(h('p', null, item.details));
  const mapsHref = safeUrl(mapsSearchUrl(item.mapQuery || item.address || item.title));
  if (mapsHref) wrap.appendChild(h('a', { class: 'btn', href: mapsHref, target: '_blank', rel: 'noopener noreferrer' }, 'Abrir en Maps'));
  return wrap;
}

async function renderAttachments(container, item) {
  clear(container);
  const trip = getTripData();
  const metas = trip.attachments.filter((a) => (item.attachments || []).includes(a.id));
  if (!metas.length) {
    container.appendChild(h('p', { class: 'card-sub' }, 'Sin documentos todavía.'));
    return;
  }
  for (const meta of metas) {
    const thumb = h('button', { class: 'btn btn-small', onClick: () => navigate('/adjunto/' + meta.id) }, meta.name || 'Documento');
    container.appendChild(thumb);
  }
}

function sniffMime(bytes, fallback) {
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes.length >= 12 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'application/pdf';
  return fallback;
}

async function reencodeImage(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.82 });
  return new Uint8Array(await blob.arrayBuffer());
}

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

export async function addAttachmentToItem(item, file) {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    alertUser('El archivo supera los 8 MB.');
    return;
  }
  const rawBytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffMime(rawBytes, file.type);
  const isImage = sniffed.startsWith('image/');
  const isPdf = sniffed === 'application/pdf';
  if (!isImage && !isPdf) {
    alertUser('Solo se aceptan imágenes o PDF.');
    return;
  }

  let bytesToStore = rawBytes;
  let mime = sniffed;
  if (isImage) {
    try {
      bytesToStore = await reencodeImage(new Blob([rawBytes], { type: sniffed }));
      mime = 'image/jpeg';
    } catch {
      /* si falla la recodificación, se guarda el original igualmente */
    }
  }

  const trip = getTripData();
  const id = newId('a');
  await saveBlob(id, bytesToStore, getKey(), getKdfMeta());
  trip.attachments.push({
    id,
    name: file.name.slice(0, 100),
    mime,
    itemId: item.id,
    addedBy: trip.settings?.myName || '',
    createdAt: nowIso(),
  });
  item.attachments = [...(item.attachments || []), id];
  await persist();
}

function alertUser(msg) {
  const el = h('div', { class: 'warn-banner' }, msg);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* portapapeles no disponible: sin acción */
  }
}

export function renderItemEditor(container, itemId, forcedType) {
  const trip = getTripData();
  clear(container);
  const existing = itemId ? trip.items.find((i) => i.id === itemId) : null;
  const type = existing ? existing.type : forcedType;
  const fields = fieldsForType(type);

  container.appendChild(h('h1', null, existing ? 'Editar' : 'Nuevo ' + (ITEM_TYPE_LABELS[type] || '').toLowerCase()));

  const draft = existing ? { ...existing } : { id: newId('i'), type, date: '', title: '' };
  const inputs = {};

  const form = h('form', {
    onSubmit: async (ev) => {
      ev.preventDefault();
      for (const f of fields) {
        if (f === 'checkin' || f === 'rooms') continue;
        draft[f] = inputs[f].value || undefined;
      }
      if (fields.includes('rooms')) {
        draft.rooms = inputs.rooms.value.split('\n').map((s) => s.trim()).filter(Boolean);
      }
      draft.updatedAt = nowIso();
      if (existing) {
        Object.assign(existing, draft);
      } else {
        trip.items.push(draft);
      }
      await persist();
      navigate('/item/' + draft.id);
    },
  });

  for (const f of fields) {
    if (f === 'checkin') continue;
    const label = FIELD_LABELS[f] || f;
    let input;
    if (f === 'notes' || f === 'details') {
      input = h('textarea', { rows: 3, maxlength: 20000 }, draft[f] || '');
    } else if (f === 'rooms') {
      input = h('textarea', { rows: 2 }, (draft.rooms || []).join('\n'));
    } else if (f === 'date' || f === 'endDate') {
      input = h('input', { type: 'date', value: draft[f] || '' });
    } else if (f === 'start' || f === 'end' || f === 'checkinTime' || f === 'checkoutTime') {
      input = h('input', { type: 'time', value: draft[f] || '' });
    } else {
      input = h('input', { type: 'text', value: draft[f] || '' });
    }
    inputs[f] = input;
    form.appendChild(h('div', { class: 'field' }, h('label', null, label), input));
  }

  form.appendChild(h('button', { class: 'btn btn-primary', type: 'submit' }, 'Guardar'));

  if (existing) {
    form.appendChild(
      h(
        'button',
        {
          class: 'btn btn-danger',
          type: 'button',
          onClick: async () => {
            if (!confirm('¿Borrar este elemento?')) return;
            trip.items = trip.items.filter((i) => i.id !== existing.id);
            await persist();
            navigate('/reservas/' + backTabFor(type));
          },
        },
        'Borrar'
      )
    );
  }

  container.appendChild(form);
  return () => {};
}

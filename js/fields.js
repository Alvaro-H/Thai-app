// Definición de campos del editor universal por tipo de item (PLAN.md §8.7).

export const ITEM_TYPE_LABELS = {
  flight: 'Vuelo',
  transfer: 'Traslado',
  boat: 'Barco',
  hotel: 'Hotel',
  activity: 'Actividad',
  meal: 'Comida',
  place: 'Lugar',
};

const ON_BOARD = { flight: 'vuelo', boat: 'barco', transfer: 'traslado' };

// Dónde se pasa la noche de un día. Si sleepAt apunta a un transporte (p.ej.
// un vuelo nocturno), se dice "a bordo" para que el título del trayecto
// ("Madrid → Bangkok") no se lea como si se durmiera en el destino.
export function describeNight(trip, day) {
  if (!day || !day.sleepAt) return null;
  const item = trip.items.find((i) => i.id === day.sleepAt);
  if (!item) return { label: 'Duermes en', place: day.sleepAt };
  if (ON_BOARD[item.type]) return { label: 'Noche a bordo', place: ON_BOARD[item.type] + ' ' + item.title, item };
  return { label: 'Duermes en', place: item.title, item };
}

const COMMON = ['title', 'date', 'start', 'end', 'startTz', 'endTz', 'notes'];

export const ITEM_FIELDS = {
  flight: [...COMMON, 'provider', 'number', 'from', 'to', 'bookingRef', 'baggage', 'checkin'],
  transfer: [...COMMON, 'provider', 'from', 'to', 'agencyRef'],
  boat: [...COMMON, 'provider', 'from', 'to', 'agencyRef'],
  hotel: ['title', 'date', 'endDate', 'checkinTime', 'checkoutTime', 'address', 'addressLocal', 'phone', 'rooms', 'agencyRef', 'mapQuery', 'notes'],
  activity: [...COMMON, 'provider', 'agencyRef', 'details', 'address', 'mapQuery'],
  meal: [...COMMON, 'address', 'mapQuery', 'details'],
  place: ['title', 'date', 'address', 'mapQuery', 'notes', 'details'],
};

export const FIELD_LABELS = {
  title: 'Título',
  date: 'Fecha',
  endDate: 'Fecha fin',
  start: 'Hora inicio',
  end: 'Hora fin',
  startTz: 'Zona horaria (inicio)',
  endTz: 'Zona horaria (fin)',
  provider: 'Compañía / proveedor',
  number: 'Número de vuelo',
  from: 'Origen',
  to: 'Destino',
  bookingRef: 'Localizador',
  agencyRef: 'Referencia agencia',
  baggage: 'Equipaje',
  address: 'Dirección',
  addressLocal: 'Dirección (idioma local)',
  phone: 'Teléfono',
  checkinTime: 'Hora de entrada',
  checkoutTime: 'Hora de salida',
  rooms: 'Habitaciones',
  mapQuery: 'Buscar en el mapa',
  details: 'Detalles',
  notes: 'Notas',
};

export function fieldsForType(type) {
  return ITEM_FIELDS[type] || COMMON;
}

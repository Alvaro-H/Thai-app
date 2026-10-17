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

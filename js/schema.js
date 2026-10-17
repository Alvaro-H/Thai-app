// Validación estricta del modelo TripData (PLAN.md §6).
// Se usa tanto al importar un .tvault como al leer de IndexedDB, y es la
// primera barrera contra datos malformados o maliciosos (S7).

export class SchemaError extends Error {
  constructor(message, path) {
    super(path ? `${path}: ${message}` : message);
    this.path = path;
  }
}

export const SCHEMA_VERSION = 1;

const ID_RE = /^[a-z0-9_-]{1,40}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const TZ_RE = /^[A-Za-z0-9_+-]+\/[A-Za-z0-9_+-]+$|^UTC$/;

const MAX_SHORT = 5000;
const MAX_LONG = 20000;
const MAX_ARRAY = 500;
const MAX_TRAVELERS = 20;

const ITEM_TYPES = new Set(['flight', 'transfer', 'boat', 'hotel', 'activity', 'meal', 'place']);
const CHECKIN_STATUS = new Set(['pending', 'done', 'na']);
const BOOKING_STATUS = new Set(['confirmed', 'pending']);
const CONTACT_ROLES = new Set(['agencia', 'hotel', 'seguro', 'emergencia', 'otro']);
const CHECKLIST_PRIORITY = new Set(['high', 'normal']);

function fail(msg, path) {
  throw new SchemaError(msg, path);
}

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function checkString(v, path, { max = MAX_SHORT, required = true, pattern = null } = {}) {
  if (v === undefined || v === null) {
    if (required) fail('cadena requerida', path);
    return;
  }
  if (typeof v !== 'string') fail('debe ser una cadena', path);
  if (v.length > max) fail(`demasiado larga (máx ${max})`, path);
  if (pattern && !pattern.test(v)) fail('formato inválido', path);
}

function checkId(v, path) {
  checkString(v, path, { max: 40, pattern: ID_RE });
}

function checkDate(v, path, required = true) {
  if (v === undefined || v === null || v === '') {
    if (required) fail('fecha requerida', path);
    return;
  }
  checkString(v, path, { max: 10, pattern: DATE_RE });
}

function checkTime(v, path, required = false) {
  if (v === undefined || v === null || v === '') {
    if (required) fail('hora requerida', path);
    return;
  }
  checkString(v, path, { max: 5, pattern: TIME_RE });
}

function checkTz(v, path, required = false) {
  if (v === undefined || v === null || v === '') {
    if (required) fail('zona horaria requerida', path);
    return;
  }
  checkString(v, path, { max: 40, pattern: TZ_RE });
}

function checkBool(v, path, required = false) {
  if (v === undefined || v === null) {
    if (required) fail('booleano requerido', path);
    return;
  }
  if (typeof v !== 'boolean') fail('debe ser booleano', path);
}

function checkEnum(v, allowed, path, required = true) {
  if (v === undefined || v === null) {
    if (required) fail('valor requerido', path);
    return;
  }
  if (!allowed.has(v)) fail(`valor no permitido: ${v}`, path);
}

function checkArray(v, path, max = MAX_ARRAY) {
  if (!Array.isArray(v)) fail('debe ser un array', path);
  if (v.length > max) fail(`demasiados elementos (máx ${max})`, path);
}

function rejectUnknownKeys(obj, allowed, path) {
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) fail(`campo desconocido no permitido: "${key}"`, path);
  }
}

// ---- sub-validadores ----

function validateTraveler(t, path) {
  if (!isPlainObject(t)) fail('debe ser un objeto', path);
  rejectUnknownKeys(t, new Set(['id', 'name']), path);
  checkId(t.id, `${path}.id`);
  checkString(t.name, `${path}.name`, { max: 200 });
}

function validateTrip(trip) {
  if (!isPlainObject(trip)) fail('debe ser un objeto', 'trip');
  rejectUnknownKeys(trip, new Set(['title', 'start', 'end', 'homeTz', 'destTz', 'travelers']), 'trip');
  checkString(trip.title, 'trip.title', { max: 200 });
  checkDate(trip.start, 'trip.start', false);
  checkDate(trip.end, 'trip.end', false);
  checkTz(trip.homeTz, 'trip.homeTz', true);
  checkTz(trip.destTz, 'trip.destTz', true);
  checkArray(trip.travelers, 'trip.travelers', MAX_TRAVELERS);
  trip.travelers.forEach((t, i) => validateTraveler(t, `trip.travelers[${i}]`));
}

function validateDay(day, path) {
  if (!isPlainObject(day)) fail('debe ser un objeto', path);
  rejectUnknownKeys(day, new Set(['date', 'title', 'region', 'sleepAt', 'notes']), path);
  checkDate(day.date, `${path}.date`);
  checkString(day.title, `${path}.title`, { max: 200, required: false });
  checkString(day.region, `${path}.region`, { max: 200, required: false });
  checkString(day.sleepAt, `${path}.sleepAt`, { max: 200, required: false });
  checkString(day.notes, `${path}.notes`, { max: MAX_LONG, required: false });
}

function validateTicket(t, path) {
  if (!isPlainObject(t)) fail('debe ser un objeto', path);
  rejectUnknownKeys(t, new Set(['travelerId', 'ticketNo', 'bookingRef']), path);
  checkId(t.travelerId, `${path}.travelerId`);
  checkString(t.ticketNo, `${path}.ticketNo`, { max: 100, required: false });
  checkString(t.bookingRef, `${path}.bookingRef`, { max: 100, required: false });
}

function validateCheckin(c, path) {
  if (c === undefined || c === null) return;
  if (!isPlainObject(c)) fail('debe ser un objeto', path);
  rejectUnknownKeys(c, new Set(['status', 'doneAt']), path);
  checkEnum(c.status, CHECKIN_STATUS, `${path}.status`, true);
  if (c.doneAt !== undefined && c.doneAt !== null) {
    checkString(c.doneAt, `${path}.doneAt`, { max: 40 });
  }
}

const ITEM_ALLOWED_KEYS = new Set([
  'id', 'type', 'date', 'endDate', 'start', 'end', 'startTz', 'endTz',
  'title', 'from', 'to', 'provider', 'number', 'bookingRef', 'agencyRef',
  'tickets', 'baggage', 'checkin', 'booking', 'address', 'addressLocal',
  'phone', 'checkinTime', 'checkoutTime', 'rooms', 'mapQuery', 'details',
  'notes', 'attachments', 'source', 'updatedAt',
]);

function validateItem(item, path) {
  if (!isPlainObject(item)) fail('debe ser un objeto', path);
  rejectUnknownKeys(item, ITEM_ALLOWED_KEYS, path);
  checkId(item.id, `${path}.id`);
  checkEnum(item.type, ITEM_TYPES, `${path}.type`, true);
  checkDate(item.date, `${path}.date`);
  checkDate(item.endDate, `${path}.endDate`, false);
  checkTime(item.start, `${path}.start`, false);
  checkTime(item.end, `${path}.end`, false);
  checkTz(item.startTz, `${path}.startTz`, false);
  checkTz(item.endTz, `${path}.endTz`, false);
  checkString(item.title, `${path}.title`, { max: 300 });
  checkString(item.from, `${path}.from`, { max: 100, required: false });
  checkString(item.to, `${path}.to`, { max: 100, required: false });
  checkString(item.provider, `${path}.provider`, { max: 200, required: false });
  checkString(item.number, `${path}.number`, { max: 100, required: false });
  checkString(item.bookingRef, `${path}.bookingRef`, { max: 100, required: false });
  checkString(item.agencyRef, `${path}.agencyRef`, { max: 100, required: false });
  if (item.tickets !== undefined) {
    checkArray(item.tickets, `${path}.tickets`, MAX_TRAVELERS);
    item.tickets.forEach((t, i) => validateTicket(t, `${path}.tickets[${i}]`));
  }
  checkString(item.baggage, `${path}.baggage`, { max: 500, required: false });
  validateCheckin(item.checkin, `${path}.checkin`);
  if (item.booking !== undefined) checkEnum(item.booking, BOOKING_STATUS, `${path}.booking`, false);
  checkString(item.address, `${path}.address`, { max: 500, required: false });
  checkString(item.addressLocal, `${path}.addressLocal`, { max: 500, required: false });
  checkString(item.phone, `${path}.phone`, { max: 50, required: false });
  checkTime(item.checkinTime, `${path}.checkinTime`, false);
  checkTime(item.checkoutTime, `${path}.checkoutTime`, false);
  if (item.rooms !== undefined) {
    checkArray(item.rooms, `${path}.rooms`, 20);
    item.rooms.forEach((r, i) => checkString(r, `${path}.rooms[${i}]`, { max: 200 }));
  }
  checkString(item.mapQuery, `${path}.mapQuery`, { max: 300, required: false });
  checkString(item.details, `${path}.details`, { max: MAX_LONG, required: false });
  checkString(item.notes, `${path}.notes`, { max: MAX_LONG, required: false });
  if (item.attachments !== undefined) {
    checkArray(item.attachments, `${path}.attachments`, MAX_ARRAY);
    item.attachments.forEach((a, i) => checkId(a, `${path}.attachments[${i}]`));
  }
  checkString(item.source, `${path}.source`, { max: 300, required: false });
  checkString(item.updatedAt, `${path}.updatedAt`, { max: 40, required: false });
}

function validateChecklistItem(ci, path) {
  if (!isPlainObject(ci)) fail('debe ser un objeto', path);
  rejectUnknownKeys(ci, new Set(['id', 'text', 'done', 'priority', 'itemId']), path);
  checkId(ci.id, `${path}.id`);
  checkString(ci.text, `${path}.text`, { max: MAX_SHORT });
  checkBool(ci.done, `${path}.done`, true);
  if (ci.priority !== undefined) checkEnum(ci.priority, CHECKLIST_PRIORITY, `${path}.priority`, false);
  if (ci.itemId !== undefined && ci.itemId !== null) checkId(ci.itemId, `${path}.itemId`);
}

function validateChecklist(cl, path) {
  if (!isPlainObject(cl)) fail('debe ser un objeto', path);
  rejectUnknownKeys(cl, new Set(['id', 'title', 'items']), path);
  checkId(cl.id, `${path}.id`);
  checkString(cl.title, `${path}.title`, { max: 200 });
  checkArray(cl.items, `${path}.items`, MAX_ARRAY);
  cl.items.forEach((ci, i) => validateChecklistItem(ci, `${path}.items[${i}]`));
}

function validateContact(c, path) {
  if (!isPlainObject(c)) fail('debe ser un objeto', path);
  rejectUnknownKeys(c, new Set(['id', 'name', 'role', 'phone', 'hours', 'notes', 'source']), path);
  checkId(c.id, `${path}.id`);
  checkString(c.name, `${path}.name`, { max: 200 });
  if (c.role !== undefined) checkEnum(c.role, CONTACT_ROLES, `${path}.role`, false);
  checkString(c.phone, `${path}.phone`, { max: 50, required: false });
  checkString(c.hours, `${path}.hours`, { max: 200, required: false });
  checkString(c.notes, `${path}.notes`, { max: MAX_LONG, required: false });
  checkString(c.source, `${path}.source`, { max: 300, required: false });
}

function validateNote(n, path) {
  if (!isPlainObject(n)) fail('debe ser un objeto', path);
  rejectUnknownKeys(n, new Set(['id', 'title', 'body', 'updatedAt']), path);
  checkId(n.id, `${path}.id`);
  checkString(n.title, `${path}.title`, { max: 300 });
  checkString(n.body, `${path}.body`, { max: MAX_LONG, required: false });
  checkString(n.updatedAt, `${path}.updatedAt`, { max: 40, required: false });
}

function validateTip(t, path) {
  if (!isPlainObject(t)) fail('debe ser un objeto', path);
  rejectUnknownKeys(t, new Set(['id', 'date', 'title', 'body']), path);
  checkId(t.id, `${path}.id`);
  checkDate(t.date, `${path}.date`, false);
  checkString(t.title, `${path}.title`, { max: 300 });
  checkString(t.body, `${path}.body`, { max: MAX_LONG, required: false });
}

function validateApp(a, path) {
  if (!isPlainObject(a)) fail('debe ser un objeto', path);
  rejectUnknownKeys(a, new Set(['name', 'purpose']), path);
  checkString(a.name, `${path}.name`, { max: 100 });
  checkString(a.purpose, `${path}.purpose`, { max: 300, required: false });
}

function validateAttachmentMeta(a, path) {
  if (!isPlainObject(a)) fail('debe ser un objeto', path);
  rejectUnknownKeys(a, new Set(['id', 'name', 'mime', 'itemId', 'addedBy', 'createdAt']), path);
  checkId(a.id, `${path}.id`);
  checkString(a.name, `${path}.name`, { max: 300 });
  checkString(a.mime, `${path}.mime`, { max: 100 });
  if (a.itemId !== undefined && a.itemId !== null) checkId(a.itemId, `${path}.itemId`);
  checkString(a.addedBy, `${path}.addedBy`, { max: 200, required: false });
  checkString(a.createdAt, `${path}.createdAt`, { max: 40, required: false });
}

function validateSettings(s) {
  if (s === undefined || s === null) return;
  if (!isPlainObject(s)) fail('debe ser un objeto', 'settings');
  rejectUnknownKeys(
    s,
    new Set(['autoLockHiddenSec', 'autoLockIdleSec', 'thbPerEur', 'lastBackupAt', 'myName']),
    'settings'
  );
  if (s.autoLockHiddenSec !== undefined) {
    if (!Number.isInteger(s.autoLockHiddenSec) || s.autoLockHiddenSec < 0 || s.autoLockHiddenSec > 3600) {
      fail('fuera de rango', 'settings.autoLockHiddenSec');
    }
  }
  if (s.autoLockIdleSec !== undefined) {
    if (!Number.isInteger(s.autoLockIdleSec) || s.autoLockIdleSec < 0 || s.autoLockIdleSec > 86400) {
      fail('fuera de rango', 'settings.autoLockIdleSec');
    }
  }
  if (s.thbPerEur !== undefined && s.thbPerEur !== null) {
    if (typeof s.thbPerEur !== 'number' || !Number.isFinite(s.thbPerEur) || s.thbPerEur <= 0 || s.thbPerEur > 1000) {
      fail('fuera de rango', 'settings.thbPerEur');
    }
  }
  checkString(s.lastBackupAt, 'settings.lastBackupAt', { max: 40, required: false });
  checkString(s.myName, 'settings.myName', { max: 200, required: false });
}

const ROOT_ALLOWED_KEYS = new Set([
  'schemaVersion', 'trip', 'days', 'items', 'checklists', 'contacts',
  'notes', 'tips', 'apps', 'attachments', 'settings',
]);

/**
 * Valida un TripData completo. Lanza SchemaError con un `path` legible si algo
 * no cumple el esquema. No muta el objeto de entrada.
 */
export function validateTripData(data) {
  if (!isPlainObject(data)) fail('el documento raíz debe ser un objeto', '');
  rejectUnknownKeys(data, ROOT_ALLOWED_KEYS, '');

  if (data.schemaVersion !== SCHEMA_VERSION) {
    fail(`versión de esquema no soportada: ${data.schemaVersion}`, 'schemaVersion');
  }

  validateTrip(data.trip);

  checkArray(data.days, 'days');
  data.days.forEach((d, i) => validateDay(d, `days[${i}]`));

  checkArray(data.items, 'items');
  const itemIds = new Set();
  data.items.forEach((it, i) => {
    validateItem(it, `items[${i}]`);
    if (itemIds.has(it.id)) fail(`id de item duplicado: ${it.id}`, `items[${i}].id`);
    itemIds.add(it.id);
  });

  checkArray(data.checklists, 'checklists');
  data.checklists.forEach((cl, i) => validateChecklist(cl, `checklists[${i}]`));

  checkArray(data.contacts, 'contacts');
  data.contacts.forEach((c, i) => validateContact(c, `contacts[${i}]`));

  checkArray(data.notes, 'notes');
  data.notes.forEach((n, i) => validateNote(n, `notes[${i}]`));

  checkArray(data.tips, 'tips');
  data.tips.forEach((t, i) => validateTip(t, `tips[${i}]`));

  checkArray(data.apps, 'apps');
  data.apps.forEach((a, i) => validateApp(a, `apps[${i}]`));

  checkArray(data.attachments, 'attachments');
  const attIds = new Set();
  data.attachments.forEach((a, i) => {
    validateAttachmentMeta(a, `attachments[${i}]`);
    if (attIds.has(a.id)) fail(`id de adjunto duplicado: ${a.id}`, `attachments[${i}].id`);
    attIds.add(a.id);
  });

  validateSettings(data.settings);

  return true;
}

export function createEmptyTripData() {
  return {
    schemaVersion: SCHEMA_VERSION,
    trip: { title: 'Mi viaje', start: '', end: '', homeTz: 'Europe/Madrid', destTz: 'Asia/Bangkok', travelers: [] },
    days: [],
    items: [],
    checklists: [],
    contacts: [],
    notes: [],
    tips: [],
    apps: [],
    attachments: [],
    settings: { autoLockHiddenSec: 120, autoLockIdleSec: 600, thbPerEur: null, lastBackupAt: null, myName: '' },
  };
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTripData, createEmptyTripData, SchemaError } from '../../js/schema.js';

function withItem(overrides = {}) {
  const data = createEmptyTripData();
  data.trip.start = '2026-10-22';
  data.trip.end = '2026-11-07';
  data.items.push({
    id: 'i_vuelo1',
    type: 'flight',
    date: '2026-10-29',
    start: '10:25',
    end: '12:20',
    startTz: 'Asia/Bangkok',
    endTz: 'Asia/Bangkok',
    title: 'Krabi → Chiang Mai',
    ...overrides,
  });
  return data;
}

test('un TripData vacío válido pasa la validación', () => {
  assert.doesNotThrow(() => validateTripData(createEmptyTripData()));
});

test('un item válido con todos los campos opcionales pasa', () => {
  assert.doesNotThrow(() => validateTripData(withItem()));
});

test('schemaVersion incorrecta se rechaza', () => {
  const data = createEmptyTripData();
  data.schemaVersion = 2;
  assert.throws(() => validateTripData(data), SchemaError);
});

test('un campo desconocido en la raíz se rechaza', () => {
  const data = createEmptyTripData();
  data.campoRaro = 'hola';
  assert.throws(() => validateTripData(data), SchemaError);
});

test('un campo desconocido dentro de un item se rechaza', () => {
  const data = withItem({ campoInventado: 'x' });
  assert.throws(() => validateTripData(data), SchemaError);
});

test('un id con mayúsculas o caracteres no permitidos se rechaza', () => {
  const data = withItem({ id: 'ID con espacios!' });
  assert.throws(() => validateTripData(data), SchemaError);
});

test('ids de item duplicados se rechazan', () => {
  const data = withItem();
  data.items.push({ ...data.items[0] });
  assert.throws(() => validateTripData(data), SchemaError);
});

test('una fecha con formato incorrecto se rechaza', () => {
  const data = withItem({ date: '29/10/2026' });
  assert.throws(() => validateTripData(data), SchemaError);
});

test('una hora con formato incorrecto se rechaza', () => {
  const data = withItem({ start: '25:99' });
  assert.throws(() => validateTripData(data), SchemaError);
});

test('un type fuera del conjunto permitido se rechaza', () => {
  const data = withItem({ type: 'crucero' });
  assert.throws(() => validateTripData(data), SchemaError);
});

test('una cadena que supera el límite de longitud se rechaza', () => {
  const data = withItem({ notes: 'x'.repeat(20001) });
  assert.throws(() => validateTripData(data), SchemaError);
});

test('una cadena justo en el límite de longitud se acepta', () => {
  const data = withItem({ notes: 'x'.repeat(20000) });
  assert.doesNotThrow(() => validateTripData(data));
});

test('un array con más de 500 elementos se rechaza', () => {
  const data = createEmptyTripData();
  data.notes = Array.from({ length: 501 }, (_, i) => ({ id: `n${i}`, title: 't' }));
  assert.throws(() => validateTripData(data), SchemaError);
});

test('checkin.status fuera del enum permitido se rechaza', () => {
  const data = withItem({ checkin: { status: 'maybe' } });
  assert.throws(() => validateTripData(data), SchemaError);
});

test('checkin.status válido se acepta', () => {
  const data = withItem({ checkin: { status: 'done', doneAt: '2026-10-20T10:00:00Z' } });
  assert.doesNotThrow(() => validateTripData(data));
});

test('un item que no es objeto (p.ej. una cadena) se rechaza', () => {
  const data = createEmptyTripData();
  data.items = ['no soy un objeto'];
  assert.throws(() => validateTripData(data), SchemaError);
});

test('ids de adjuntos duplicados se rechazan', () => {
  const data = createEmptyTripData();
  data.attachments.push({ id: 'a1', name: 'x', mime: 'image/jpeg' });
  data.attachments.push({ id: 'a1', name: 'y', mime: 'image/jpeg' });
  assert.throws(() => validateTripData(data), SchemaError);
});

test('settings con autoLockIdleSec fuera de rango se rechaza', () => {
  const data = createEmptyTripData();
  data.settings.autoLockIdleSec = 999999;
  assert.throws(() => validateTripData(data), SchemaError);
});

test('settings.thbPerEur negativo o cero se rechaza', () => {
  const data = createEmptyTripData();
  data.settings.thbPerEur = 0;
  assert.throws(() => validateTripData(data), SchemaError);
});

test('una zona horaria con formato inválido se rechaza', () => {
  const data = withItem({ startTz: 'no-es-una-tz' });
  assert.throws(() => validateTripData(data), SchemaError);
});

test('un checklist con item.text intentando inyectar HTML se acepta como texto plano (no se interpreta aquí)', () => {
  const data = createEmptyTripData();
  data.checklists.push({
    id: 'c1',
    title: 'Pendientes',
    items: [{ id: 'ci1', text: '<img src=x onerror="alert(1)">', done: false }],
  });
  // El esquema solo valida tipos/longitudes, no sanitiza HTML: eso lo hace la
  // capa de render (helper h() + textContent, S4). Aquí debe aceptarse como cadena.
  assert.doesNotThrow(() => validateTripData(data));
});

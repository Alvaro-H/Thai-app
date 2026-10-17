import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeUrl, safeImgSrc, mapsSearchUrl } from '../../js/dom.js';

test('safeUrl acepta https:', () => {
  assert.equal(safeUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1');
});

test('safeUrl acepta tel: con formato razonable', () => {
  assert.equal(safeUrl('tel:+34912345678'), 'tel:+34912345678');
});

test('safeUrl rechaza javascript:', () => {
  assert.equal(safeUrl('javascript:alert(1)'), null);
});

test('safeUrl rechaza variantes con mayúsculas mezcladas (JaVaScRiPt:)', () => {
  assert.equal(safeUrl('JaVaScRiPt:alert(1)'), null);
});

test('safeUrl rechaza data:', () => {
  assert.equal(safeUrl('data:text/html,<script>alert(1)</script>'), null);
});

test('safeUrl rechaza tel: con contenido no numérico (posible inyección)', () => {
  assert.equal(safeUrl('tel:javascript:alert(1)'), null);
});

test('safeUrl rechaza cadenas vacías o no-cadenas', () => {
  assert.equal(safeUrl(''), null);
  assert.equal(safeUrl(null), null);
  assert.equal(safeUrl(undefined), null);
});

test('safeImgSrc solo acepta blob:', () => {
  assert.equal(safeImgSrc('blob:https://example.com/abc-123'), 'blob:https://example.com/abc-123');
  assert.equal(safeImgSrc('https://example.com/a.png'), null);
  assert.equal(safeImgSrc('javascript:alert(1)'), null);
  assert.equal(safeImgSrc('data:image/png;base64,AAAA'), null);
});

test('mapsSearchUrl codifica el texto libre, neutralizando cualquier esquema que contenga', () => {
  const url = mapsSearchUrl('javascript:alert(1)');
  assert.ok(url.startsWith('https://www.google.com/maps/search/?api=1&query='));
  assert.ok(!url.includes('javascript:'));
});

test('mapsSearchUrl devuelve null para texto vacío', () => {
  assert.equal(mapsSearchUrl(''), null);
  assert.equal(mapsSearchUrl('   '), null);
});

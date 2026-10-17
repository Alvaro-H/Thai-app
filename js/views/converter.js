import { h, clear } from '../dom.js';
import { getTripData, persist } from '../session.js';
import { navigate } from '../router.js';
import { thbToEur, eurToThb } from '../format.js';

export function renderConverter(container) {
  const trip = getTripData();
  clear(container);
  container.appendChild(h('button', { class: 'btn btn-small', onClick: () => navigate('/mas') }, '← Más'));
  container.appendChild(h('h1', null, 'Conversor THB ↔ EUR'));
  container.appendChild(h('p', { class: 'card-sub' }, 'Sin conexión a internet: introduce tú mismo el tipo de cambio aproximado.'));

  const rateInput = h('input', { type: 'number', step: '0.01', min: '0.01', value: trip.settings?.thbPerEur || '' });
  const thbInput = h('input', { type: 'number', step: '0.01' });
  const eurInput = h('input', { type: 'number', step: '0.01' });

  rateInput.addEventListener('change', async () => {
    const v = parseFloat(rateInput.value);
    trip.settings = trip.settings || {};
    trip.settings.thbPerEur = Number.isFinite(v) && v > 0 ? v : null;
    await persist();
  });

  function recompute(from) {
    const rate = parseFloat(rateInput.value);
    if (!rate) return;
    if (from === 'thb') {
      const eur = thbToEur(parseFloat(thbInput.value), rate);
      if (eur !== null) eurInput.value = eur.toFixed(2);
    } else {
      const thb = eurToThb(parseFloat(eurInput.value), rate);
      if (thb !== null) thbInput.value = thb.toFixed(2);
    }
  }
  thbInput.addEventListener('input', () => recompute('thb'));
  eurInput.addEventListener('input', () => recompute('eur'));

  container.appendChild(h('div', { class: 'field' }, h('label', null, '1 EUR = ? THB'), rateInput));
  container.appendChild(h('div', { class: 'field' }, h('label', null, 'Baht (THB)'), thbInput));
  container.appendChild(h('div', { class: 'field' }, h('label', null, 'Euros (EUR)'), eurInput));

  return () => {};
}

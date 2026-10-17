// Escena decorativa "postal de las islas": cielo, sol (luna en modo oscuro),
// palmera, mar en tres capas y un barco long-tail. Es puramente visual
// (aria-hidden) y no contiene ningún dato del viaje.
import { h } from './dom.js';
import { themeSwitch } from './theme.js';

export function scene(variant, ...children) {
  return h(
    'section',
    { class: 'scene scene-' + variant },
    h(
      'div',
      { class: 'scene-art', 'aria-hidden': 'true' },
      h('div', { class: 'scene-stars' }),
      h('div', { class: 'scene-sun' }),
      h('div', { class: 'scene-palm' }),
      h(
        'div',
        { class: 'scene-sea' },
        h('div', { class: 'wave wave-back' }),
        h('div', { class: 'scene-boat' }),
        h('div', { class: 'wave wave-mid' }),
        h('div', { class: 'wave wave-front' })
      )
    ),
    themeSwitch(),
    children.length ? h('div', { class: 'scene-text' }, ...children) : null
  );
}

// Tipo de paisaje de un día, a partir del nombre de la zona. Solo afecta al
// color con que se pinta el día en el itinerario.
const KINDS = [
  ['mar', /\b(ko|koh)\b|railay|pak bara|krabi|phi ?phi|lanta|ao nang|phuket|island|isla|playa|beach/i],
  ['selva', /chiang|mae |pai\b|khao sok|jungla|selva|doi |trek|monta/i],
  ['ciudad', /bangkok|ayutthaya|ciudad|city/i],
];

export function regionKind(region) {
  if (!region) return 'ruta';
  for (const [kind, re] of KINDS) if (re.test(region)) return kind;
  return 'ruta';
}

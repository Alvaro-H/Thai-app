// Modo día / noche. La preferencia ('light' | 'dark', o nada = seguir al
// sistema) se guarda en localStorage: es solo una comodidad visual de este
// móvil, no un dato del viaje, y por eso puede vivir fuera de la bóveda
// cifrada (así la pantalla de entrada también la respeta).
import { h } from './dom.js';

const KEY = 'tv-theme';
const THEME_COLOR = { light: '#087c81', dark: '#071a21' };
const media = window.matchMedia('(prefers-color-scheme: dark)');

export function getThemePref() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function effectiveTheme() {
  const pref = getThemePref();
  if (pref !== 'auto') return pref;
  return media.matches ? 'dark' : 'light';
}

export function setThemePref(pref) {
  try {
    if (pref === 'light' || pref === 'dark') localStorage.setItem(KEY, pref);
    else localStorage.removeItem(KEY);
  } catch {
    /* sin almacenamiento: el cambio dura hasta cerrar la app */
    memoryPref = pref;
  }
  applyTheme();
}

let memoryPref = null;

export function applyTheme() {
  let pref = getThemePref();
  if (pref === 'auto' && memoryPref && memoryPref !== 'auto') pref = memoryPref;
  const root = document.documentElement;
  if (pref === 'auto') delete root.dataset.theme;
  else root.dataset.theme = pref;
  const eff = pref === 'auto' ? (media.matches ? 'dark' : 'light') : pref;
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.setAttribute('content', THEME_COLOR[eff]);
  }
  for (const sw of document.querySelectorAll('.theme-switch')) {
    sw.setAttribute('aria-checked', eff === 'dark' ? 'true' : 'false');
  }
}

media.addEventListener('change', applyTheme);

// Interruptor día/noche: un sol que se convierte en luna.
export function themeSwitch() {
  const btn = h(
    'button',
    {
      type: 'button',
      class: 'theme-switch',
      role: 'switch',
      'aria-label': 'Modo noche',
      onClick: () => setThemePref(effectiveTheme() === 'dark' ? 'light' : 'dark'),
    },
    h('span', { class: 'theme-switch-icon theme-switch-sun', 'aria-hidden': 'true' }),
    h('span', { class: 'theme-switch-icon theme-switch-moon', 'aria-hidden': 'true' }),
    h('span', { class: 'theme-knob', 'aria-hidden': 'true' })
  );
  btn.setAttribute('aria-checked', effectiveTheme() === 'dark' ? 'true' : 'false');
  return btn;
}

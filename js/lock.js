// S10/S11: bloqueo automático al pasar a segundo plano o por inactividad.
import { lock, isUnlocked, getTripData } from './session.js';

const DEFAULT_HIDDEN_SEC = 120;
const DEFAULT_IDLE_SEC = 600;

let idleTimer = null;
let hiddenTimer = null;

function getConfiguredSeconds(key, fallback) {
  try {
    const data = getTripData();
    const v = data?.settings?.[key];
    if (typeof v === 'number' && v >= 0) return v;
  } catch {
    /* sesión bloqueada u otro error: usar el valor por defecto */
  }
  return fallback;
}

function clearTimers() {
  if (idleTimer) clearTimeout(idleTimer);
  if (hiddenTimer) clearTimeout(hiddenTimer);
  idleTimer = null;
  hiddenTimer = null;
}

export function resetIdleTimer() {
  if (!isUnlocked()) return;
  if (idleTimer) clearTimeout(idleTimer);
  const sec = getConfiguredSeconds('autoLockIdleSec', DEFAULT_IDLE_SEC);
  if (sec <= 0) return;
  idleTimer = setTimeout(() => lock(), sec * 1000);
}

function onVisibilityChange() {
  if (!isUnlocked()) return;
  if (document.visibilityState === 'hidden') {
    // S10: ocultar contenido al instante se hace vía CSS (clase en <body>,
    // gestionada por main.js al escuchar este mismo evento). Aquí solo se
    // arranca el temporizador de bloqueo real.
    const sec = getConfiguredSeconds('autoLockHiddenSec', DEFAULT_HIDDEN_SEC);
    if (hiddenTimer) clearTimeout(hiddenTimer);
    if (sec <= 0) {
      lock();
    } else {
      hiddenTimer = setTimeout(() => lock(), sec * 1000);
    }
  } else {
    if (hiddenTimer) clearTimeout(hiddenTimer);
    hiddenTimer = null;
    resetIdleTimer();
  }
}

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart'];

export function initAutoLock() {
  document.addEventListener('visibilitychange', onVisibilityChange);
  for (const ev of ACTIVITY_EVENTS) {
    window.addEventListener(ev, resetIdleTimer, { passive: true });
  }
}

export function stopAutoLockTimers() {
  clearTimers();
}

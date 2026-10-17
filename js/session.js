// Estado de la sesión: la clave y el TripData descifrado viven SOLO en
// memoria, nunca en localStorage/sessionStorage (S9). lock() los descarta y
// revoca todas las blob: URL activas (S12).

import { saveTrip as storeSaveTrip } from './store.js';

let state = {
  unlocked: false,
  key: null,
  kdfMeta: null,
  tripData: null,
};

const blobUrls = new Map(); // attachmentId -> blob: URL activa
const listeners = new Set(); // se notifican en lock/unlock

export function onLockChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) fn(state.unlocked);
}

export function setUnlocked(tripData, key, kdfMeta) {
  state = { unlocked: true, key, kdfMeta, tripData };
  notify();
}

export function isUnlocked() {
  return state.unlocked;
}

export function getTripData() {
  return state.tripData;
}

export function getKey() {
  return state.key;
}

export function getKdfMeta() {
  return state.kdfMeta;
}

/** Persiste el TripData actual (ya modificado en memoria) cifrado en IndexedDB. */
export async function persist() {
  if (!state.unlocked) throw new Error('No se puede guardar: la sesión está bloqueada');
  await storeSaveTrip(state.tripData, state.key, state.kdfMeta);
}

export function registerBlobUrl(id, url) {
  revokeBlobUrl(id);
  blobUrls.set(id, url);
  return url;
}

export function getBlobUrl(id) {
  return blobUrls.get(id) || null;
}

export function revokeBlobUrl(id) {
  const existing = blobUrls.get(id);
  if (existing) {
    URL.revokeObjectURL(existing);
    blobUrls.delete(id);
  }
}

function revokeAllBlobUrls() {
  for (const url of blobUrls.values()) URL.revokeObjectURL(url);
  blobUrls.clear();
}

/** Bloquea la sesión: descarta la clave y los datos descifrados de memoria. */
export function lock() {
  revokeAllBlobUrls();
  state = { unlocked: false, key: null, kdfMeta: null, tripData: null };
  notify();
}

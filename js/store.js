// Capa de almacenamiento: IndexedDB con todo cifrado en reposo (PLAN.md §7).
// Solo funciona en el navegador (usa window.indexedDB). La lógica criptográfica
// vive en crypto.js y está cubierta por pruebas unitarias; este módulo es un
// adaptador delgado sobre IndexedDB, probado en los tests E2E (Playwright).
import {
  createKeyContext,
  deriveKey,
  sealWithKey,
  openEnvelope,
  openEnvelopeWithKey,
  encodeJson,
  decodeJson,
  randomSalt,
  b64encode,
} from './crypto.js';
import { validateTripData, createEmptyTripData } from './schema.js';

const DB_NAME = 'tv';
const DB_VERSION = 1;
const STORE = 'kv';
const META_KEY = 'meta';
const TRIP_KEY = 'trip';
const BLOB_PREFIX = 'blob:';

export class StoreError extends Error {}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new StoreError('No se pudo abrir la base de datos local'));
  });
}

function idbGet(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

function idbGetAllKeys(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAllKeys();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Ejecuta `fn(store)` dentro de una única transacción readwrite (atómica). */
function idbTransaction(db, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    let result;
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new StoreError('Transacción cancelada'));
    try {
      result = fn(store);
    } catch (err) {
      tx.abort();
      reject(err);
    }
  });
}

/** ¿Existe ya un almacén inicializado en este dispositivo? */
export async function hasVault() {
  const db = await openDb();
  try {
    const meta = await idbGet(db, META_KEY);
    return meta !== null;
  } finally {
    db.close();
  }
}

/**
 * Crea un almacén nuevo con una frase de paso y un TripData inicial (vacío por
 * defecto). Falla si ya existe un almacén (usar changePassphrase/importBundle
 * para sustituirlo explícitamente).
 */
export async function createVault(passphrase, tripData = createEmptyTripData()) {
  validateTripData(tripData);
  const db = await openDb();
  try {
    const existing = await idbGet(db, META_KEY);
    if (existing) throw new StoreError('Ya existe un almacén en este dispositivo');
    const { key, kdfMeta } = await createKeyContext(passphrase);
    const tripEnvelope = await sealWithKey(key, kdfMeta, encodeJson(tripData));
    await idbTransaction(db, (store) => {
      store.put({ kdf: { iter: kdfMeta.iter, salt: kdfMeta.salt } }, META_KEY);
      store.put(tripEnvelope, TRIP_KEY);
    });
    return { key, kdfMeta };
  } finally {
    db.close();
  }
}

/** Abre el almacén existente con la frase de paso. Lanza WrongPassphraseError si no coincide. */
export async function unlockVault(passphrase) {
  const db = await openDb();
  try {
    const meta = await idbGet(db, META_KEY);
    if (!meta) throw new StoreError('No hay ningún almacén en este dispositivo');
    const tripEnvelope = await idbGet(db, TRIP_KEY);
    if (!tripEnvelope) throw new StoreError('Almacén dañado: falta el registro del viaje');
    const { plaintext, key, kdfMeta } = await openEnvelope(tripEnvelope, passphrase);
    const tripData = decodeJson(plaintext);
    validateTripData(tripData);
    return { tripData, key, kdfMeta };
  } finally {
    db.close();
  }
}

/** Guarda (sobrescribe) el TripData completo, cifrado con la clave ya derivada. */
export async function saveTrip(tripData, key, kdfMeta) {
  validateTripData(tripData);
  const envelope = await sealWithKey(key, kdfMeta, encodeJson(tripData));
  const db = await openDb();
  try {
    await idbTransaction(db, (store) => store.put(envelope, TRIP_KEY));
  } finally {
    db.close();
  }
}

/** Guarda un adjunto (bytes en bruto) cifrado. Devuelve la clave de IndexedDB usada. */
export async function saveBlob(id, bytes, key, kdfMeta) {
  const envelope = await sealWithKey(key, kdfMeta, bytes);
  const db = await openDb();
  try {
    await idbTransaction(db, (store) => store.put(envelope, BLOB_PREFIX + id));
  } finally {
    db.close();
  }
  return BLOB_PREFIX + id;
}

export async function loadBlob(id, key) {
  const db = await openDb();
  try {
    const envelope = await idbGet(db, BLOB_PREFIX + id);
    if (!envelope) return null;
    return await openEnvelopeWithKey(envelope, key);
  } finally {
    db.close();
  }
}

export async function deleteBlob(id) {
  const db = await openDb();
  try {
    await idbTransaction(db, (store) => store.delete(BLOB_PREFIX + id));
  } finally {
    db.close();
  }
}

/**
 * Cambia la frase de paso: deriva una clave nueva con un salt nuevo y vuelve a
 * cifrar TODOS los registros (el viaje y cada adjunto) en una única transacción
 * atómica, para que nunca quede el almacén a medio migrar.
 */
export async function changePassphrase(oldKey, newPassphrase) {
  const db = await openDb();
  try {
    const keys = await idbGetAllKeys(db);
    const blobKeys = keys.filter((k) => typeof k === 'string' && k.startsWith(BLOB_PREFIX));
    const tripEnvelope = await idbGet(db, TRIP_KEY);
    if (!tripEnvelope) throw new StoreError('Almacén dañado: falta el registro del viaje');

    // Descifra todo con la clave antigua antes de tocar nada.
    const tripPlain = await openEnvelopeWithKey(tripEnvelope, oldKey);
    const blobPlains = new Map();
    for (const k of blobKeys) {
      const env = await idbGet(db, k);
      if (env) blobPlains.set(k, await openEnvelopeWithKey(env, oldKey));
    }

    const newSalt = randomSalt();
    const newIterations = 600000;
    const newKey = await deriveKey(newPassphrase, newSalt, newIterations);
    const newKdfMeta = { iter: newIterations, salt: b64encode(newSalt) };

    const newTripEnvelope = await sealWithKey(newKey, newKdfMeta, tripPlain);
    const newBlobEnvelopes = new Map();
    for (const [k, plain] of blobPlains) {
      newBlobEnvelopes.set(k, await sealWithKey(newKey, newKdfMeta, plain));
    }

    await idbTransaction(db, (store) => {
      store.put({ kdf: { iter: newKdfMeta.iter, salt: newKdfMeta.salt } }, META_KEY);
      store.put(newTripEnvelope, TRIP_KEY);
      for (const [k, env] of newBlobEnvelopes) store.put(env, k);
    });

    return { key: newKey, kdfMeta: newKdfMeta };
  } finally {
    db.close();
  }
}

/** Borra todo el almacén local de este dispositivo (requiere confirmación en la UI). */
export async function wipeVault() {
  await new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

/** Sustituye todo el contenido del almacén (usado al importar un .tvault). */
export async function replaceVault(passphrase, tripData, blobs /* Map<id, Uint8Array> */) {
  validateTripData(tripData);
  await wipeVault();
  const { key, kdfMeta } = await createVault(passphrase, tripData);
  const db = await openDb();
  try {
    for (const [id, bytes] of blobs) {
      const envelope = await sealWithKey(key, kdfMeta, bytes);
      await idbTransaction(db, (store) => store.put(envelope, BLOB_PREFIX + id));
    }
  } finally {
    db.close();
  }
  return { key, kdfMeta };
}

export async function listBlobIds() {
  const db = await openDb();
  try {
    const keys = await idbGetAllKeys(db);
    return keys
      .filter((k) => typeof k === 'string' && k.startsWith(BLOB_PREFIX))
      .map((k) => k.slice(BLOB_PREFIX.length));
  } finally {
    db.close();
  }
}

export { BLOB_PREFIX };

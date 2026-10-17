// Núcleo criptográfico (ver PLAN.md §7).
// PBKDF2-SHA256 -> AES-256-GCM. Cero dependencias; usa solo Web Crypto (globalThis.crypto).
// Funciona igual en el navegador y en Node >=19 (para las pruebas unitarias).

const KDF_NAME = 'PBKDF2';
const KDF_HASH = 'SHA-256';
export const DEFAULT_ITERATIONS = 600000;
export const MIN_ITERATIONS = 600000;
export const MAX_ITERATIONS = 5000000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BITS = 128;
const AAD = new TextEncoder().encode('tvault:v1');
export const FMT = 'tvault';
export const FMT_VERSION = 1;
export const MAX_ENVELOPE_BYTES = 30 * 1024 * 1024;

export class CryptoFormatError extends Error {}
export class WrongPassphraseError extends Error {}

function subtle() {
  const c = globalThis.crypto;
  if (!c || !c.subtle) throw new Error('Web Crypto no disponible en este entorno');
  return c;
}

// --- base64 sin dependencias, válido en navegador y en Node ---
export function b64encode(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function b64decode(str) {
  const binary = atob(str);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function randomBytes(n) {
  return subtle().getRandomValues(new Uint8Array(n));
}

export function randomSalt() {
  return randomBytes(SALT_BYTES);
}

export function randomIv() {
  return randomBytes(IV_BYTES);
}

/**
 * Deriva una CryptoKey AES-256-GCM no extraíble a partir de una frase de paso.
 * @param {string} passphrase
 * @param {Uint8Array} salt - debe tener SALT_BYTES bytes
 * @param {number} iterations
 */
export async function deriveKey(passphrase, salt, iterations = DEFAULT_ITERATIONS) {
  if (salt.length !== SALT_BYTES) throw new CryptoFormatError(`Salt debe tener ${SALT_BYTES} bytes`);
  if (!Number.isInteger(iterations) || iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS) {
    throw new CryptoFormatError(`Iteraciones fuera de rango permitido (${MIN_ITERATIONS}-${MAX_ITERATIONS})`);
  }
  const c = subtle();
  const passBytes = new TextEncoder().encode(passphrase.normalize('NFC'));
  const baseKey = await c.subtle.importKey('raw', passBytes, KDF_NAME, false, ['deriveKey']);
  return c.subtle.deriveKey(
    { name: KDF_NAME, salt, iterations, hash: KDF_HASH },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Cifra bytes en bruto. Genera un IV nuevo y aleatorio en cada llamada (nunca reutilizar).
 */
export async function encryptBytes(key, plaintextBytes) {
  const c = subtle();
  const iv = randomIv();
  const ctBuf = await c.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: AAD, tagLength: TAG_BITS },
    key,
    plaintextBytes
  );
  return { iv, ct: new Uint8Array(ctBuf) };
}

export async function decryptBytes(key, iv, ct) {
  const c = subtle();
  const ptBuf = await c.subtle.decrypt(
    { name: 'AES-GCM', iv, additionalData: AAD, tagLength: TAG_BITS },
    key,
    ct
  );
  return new Uint8Array(ptBuf);
}

function validateKdfMeta(kdf) {
  if (!kdf || kdf.name !== KDF_NAME || kdf.hash !== KDF_HASH) {
    throw new CryptoFormatError('Parámetros KDF no reconocidos');
  }
  if (!Number.isInteger(kdf.iter) || kdf.iter < MIN_ITERATIONS || kdf.iter > MAX_ITERATIONS) {
    throw new CryptoFormatError('Número de iteraciones fuera de rango');
  }
  if (typeof kdf.salt !== 'string') throw new CryptoFormatError('Salt ausente');
}

function validateEnvelopeShape(envelope) {
  if (!envelope || typeof envelope !== 'object') throw new CryptoFormatError('Sobre no válido');
  if (envelope.fmt !== FMT) throw new CryptoFormatError('Formato de archivo no reconocido');
  if (envelope.v !== FMT_VERSION) throw new CryptoFormatError('Versión de formato no soportada');
  validateKdfMeta(envelope.kdf);
  if (typeof envelope.iv !== 'string' || typeof envelope.ct !== 'string') {
    throw new CryptoFormatError('Sobre incompleto');
  }
  // Tamaño aproximado en base64 (~4/3 de los bytes reales)
  const approxBytes = (envelope.ct.length * 3) / 4;
  if (approxBytes > MAX_ENVELOPE_BYTES) throw new CryptoFormatError('Archivo demasiado grande');
}

/**
 * Construye un sobre cifrado {fmt, v, kdf, iv, ct} a partir de una clave ya derivada.
 * @param {CryptoKey} key
 * @param {{iter:number, salt:string}} kdfMeta - salt en base64
 * @param {Uint8Array} plaintextBytes
 */
export async function sealWithKey(key, kdfMeta, plaintextBytes) {
  validateKdfMeta({ name: KDF_NAME, hash: KDF_HASH, iter: kdfMeta.iter, salt: kdfMeta.salt });
  const { iv, ct } = await encryptBytes(key, plaintextBytes);
  return {
    fmt: FMT,
    v: FMT_VERSION,
    kdf: { name: KDF_NAME, hash: KDF_HASH, iter: kdfMeta.iter, salt: kdfMeta.salt },
    iv: b64encode(iv),
    ct: b64encode(ct),
  };
}

/**
 * Deriva una clave nueva a partir de una frase de paso y crea los metadatos KDF
 * (con un salt nuevo) listos para sellar uno o más registros con la misma clave.
 */
export async function createKeyContext(passphrase, iterations = DEFAULT_ITERATIONS) {
  const salt = randomSalt();
  const key = await deriveKey(passphrase, salt, iterations);
  return { key, kdfMeta: { iter: iterations, salt: b64encode(salt) } };
}

/**
 * Abre un sobre cifrado con una frase de paso. Lanza WrongPassphraseError si la
 * frase es incorrecta o el contenido fue alterado (fallo de autenticación GCM),
 * y CryptoFormatError si el formato del sobre no es válido.
 */
export async function openEnvelope(envelope, passphrase) {
  validateEnvelopeShape(envelope);
  const salt = b64decode(envelope.kdf.salt);
  const iv = b64decode(envelope.iv);
  if (iv.length !== IV_BYTES) throw new CryptoFormatError('IV con longitud inválida');
  const key = await deriveKey(passphrase, salt, envelope.kdf.iter);
  try {
    const plaintext = await decryptBytes(key, iv, b64decode(envelope.ct));
    return { plaintext, key, kdfMeta: { iter: envelope.kdf.iter, salt: envelope.kdf.salt } };
  } catch (err) {
    if (err instanceof CryptoFormatError) throw err;
    throw new WrongPassphraseError('Frase de paso incorrecta o archivo dañado');
  }
}

/** Igual que openEnvelope pero reutilizando una clave ya derivada (para registros sucesivos). */
export async function openEnvelopeWithKey(envelope, key) {
  validateEnvelopeShape(envelope);
  const iv = b64decode(envelope.iv);
  if (iv.length !== IV_BYTES) throw new CryptoFormatError('IV con longitud inválida');
  try {
    return await decryptBytes(key, iv, b64decode(envelope.ct));
  } catch {
    throw new WrongPassphraseError('No se pudo descifrar el registro (clave o datos incorrectos)');
  }
}

export function encodeJson(obj) {
  return new TextEncoder().encode(JSON.stringify(obj));
}

export function decodeJson(bytes) {
  return JSON.parse(new TextDecoder().decode(bytes));
}

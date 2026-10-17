import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createKeyContext,
  sealWithKey,
  openEnvelope,
  openEnvelopeWithKey,
  encryptBytes,
  decryptBytes,
  deriveKey,
  randomSalt,
  b64encode,
  b64decode,
  encodeJson,
  decodeJson,
  CryptoFormatError,
  WrongPassphraseError,
  MIN_ITERATIONS,
  MAX_ITERATIONS,
} from '../../js/crypto.js';

test('ida y vuelta: cifrar y descifrar con la frase correcta devuelve el mismo texto', async () => {
  const { key, kdfMeta } = await createKeyContext('una-frase-de-paso-larga');
  const plaintext = encodeJson({ hola: 'mundo', n: 42 });
  const envelope = await sealWithKey(key, kdfMeta, plaintext);
  const { plaintext: opened } = await openEnvelope(envelope, 'una-frase-de-paso-larga');
  assert.deepEqual(decodeJson(opened), { hola: 'mundo', n: 42 });
});

test('frase de paso incorrecta lanza WrongPassphraseError', async () => {
  const { key, kdfMeta } = await createKeyContext('frase-correcta-123');
  const envelope = await sealWithKey(key, kdfMeta, encodeJson({ a: 1 }));
  await assert.rejects(() => openEnvelope(envelope, 'frase-incorrecta-456'), WrongPassphraseError);
});

test('texto cifrado alterado (1 byte) lanza WrongPassphraseError (falla la autenticación GCM)', async () => {
  const { key, kdfMeta } = await createKeyContext('frase-de-prueba-abc');
  const envelope = await sealWithKey(key, kdfMeta, encodeJson({ a: 1 }));
  const ctBytes = b64decode(envelope.ct);
  ctBytes[0] ^= 0xff; // voltea un bit
  const tampered = { ...envelope, ct: b64encode(ctBytes) };
  await assert.rejects(() => openEnvelope(tampered, 'frase-de-prueba-abc'), WrongPassphraseError);
});

test('IV alterado también hace fallar la autenticación', async () => {
  const { key, kdfMeta } = await createKeyContext('otra-frase-de-prueba');
  const envelope = await sealWithKey(key, kdfMeta, encodeJson({ a: 1 }));
  const ivBytes = b64decode(envelope.iv);
  ivBytes[0] ^= 0xff;
  const tampered = { ...envelope, iv: b64encode(ivBytes) };
  await assert.rejects(() => openEnvelope(tampered, 'otra-frase-de-prueba'), WrongPassphraseError);
});

test('iter fuera de rango (muy bajo) se rechaza con CryptoFormatError', async () => {
  const salt = randomSalt();
  await assert.rejects(() => deriveKey('x', salt, 1000), CryptoFormatError);
});

test('iter fuera de rango (muy alto) se rechaza con CryptoFormatError', async () => {
  const salt = randomSalt();
  await assert.rejects(() => deriveKey('x', salt, MAX_ITERATIONS + 1), CryptoFormatError);
});

test('iter en el límite inferior permitido funciona', async () => {
  const salt = randomSalt();
  const key = await deriveKey('x', salt, MIN_ITERATIONS);
  assert.ok(key);
});

test('sobre con fmt o versión no reconocidos se rechaza', async () => {
  const { key, kdfMeta } = await createKeyContext('frase-xx');
  const envelope = await sealWithKey(key, kdfMeta, encodeJson({ a: 1 }));
  await assert.rejects(() => openEnvelope({ ...envelope, fmt: 'otra-cosa' }, 'frase-xx'), CryptoFormatError);
  await assert.rejects(() => openEnvelope({ ...envelope, v: 99 }, 'frase-xx'), CryptoFormatError);
});

test('salt o iv con longitud incorrecta en el sobre se rechazan', async () => {
  const { key, kdfMeta } = await createKeyContext('frase-yy');
  const envelope = await sealWithKey(key, kdfMeta, encodeJson({ a: 1 }));
  const badSalt = { ...envelope, kdf: { ...envelope.kdf, salt: b64encode(new Uint8Array(4)) } };
  await assert.rejects(() => openEnvelope(badSalt, 'frase-yy'), CryptoFormatError);
  const badIv = { ...envelope, iv: b64encode(new Uint8Array(4)) };
  await assert.rejects(() => openEnvelope(badIv, 'frase-yy'), CryptoFormatError);
});

test('dos cifrados del mismo texto producen IV distintos (nunca se reutiliza)', async () => {
  const { key } = await createKeyContext('frase-zz');
  const plaintext = encodeJson({ a: 1 });
  const r1 = await encryptBytes(key, plaintext);
  const r2 = await encryptBytes(key, plaintext);
  assert.notEqual(b64encode(r1.iv), b64encode(r2.iv));
  // y los textos cifrados resultantes también difieren
  assert.notEqual(b64encode(r1.ct), b64encode(r2.ct));
});

test('simulación de cambio de frase de paso: re-cifrar con una clave nueva conserva el contenido', async () => {
  const ctx1 = await createKeyContext('frase-antigua');
  const envelope1 = await sealWithKey(ctx1.key, ctx1.kdfMeta, encodeJson({ secreto: 'si' }));

  // "cambio de frase": se descifra con la clave antigua y se re-cifra con una nueva
  const plain = await openEnvelopeWithKey(envelope1, ctx1.key);
  const ctx2 = await createKeyContext('frase-nueva');
  const envelope2 = await sealWithKey(ctx2.key, ctx2.kdfMeta, plain);

  // la frase antigua ya no abre el nuevo sobre...
  await assert.rejects(() => openEnvelope(envelope2, 'frase-antigua'));
  // ...pero la nueva sí, y el contenido es idéntico
  const { plaintext: reopened } = await openEnvelope(envelope2, 'frase-nueva');
  assert.deepEqual(decodeJson(reopened), { secreto: 'si' });
});

test('openEnvelopeWithKey falla con una clave que no es la correcta', async () => {
  const ctx1 = await createKeyContext('frase-1');
  const ctx2 = await createKeyContext('frase-2');
  const envelope = await sealWithKey(ctx1.key, ctx1.kdfMeta, encodeJson({ a: 1 }));
  await assert.rejects(() => openEnvelopeWithKey(envelope, ctx2.key), WrongPassphraseError);
});

test('un sobre demasiado grande se rechaza antes de intentar descifrar', async () => {
  const { key, kdfMeta } = await createKeyContext('frase-grande');
  const envelope = await sealWithKey(key, kdfMeta, encodeJson({ a: 1 }));
  // Simula un ct enorme (>30MB en base64) sin necesidad de generarlo de verdad:
  const fakeHuge = { ...envelope, ct: 'A'.repeat(41 * 1024 * 1024) };
  await assert.rejects(() => openEnvelope(fakeHuge, 'frase-grande'), CryptoFormatError);
});

test('decryptBytes de bajo nivel también funciona de forma aislada', async () => {
  const salt = randomSalt();
  const key = await deriveKey('frase-bajo-nivel', salt, MIN_ITERATIONS);
  const { iv, ct } = await encryptBytes(key, new TextEncoder().encode('hola'));
  const pt = await decryptBytes(key, iv, ct);
  assert.equal(new TextDecoder().decode(pt), 'hola');
});

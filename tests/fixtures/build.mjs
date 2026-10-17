#!/usr/bin/env node
// Genera fake-trip.tvault a partir de fake-trip.json, para usarlo en las
// pruebas E2E (Playwright) como archivo de importación. Todo el contenido es
// ficticio: ver fake-trip.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { createKeyContext, sealWithKey, encodeJson, b64decode, b64encode } from '../../js/crypto.js';
import { validateTripData } from '../../js/schema.js';
import { FIXTURE_PASSPHRASE } from './passphrase.mjs';

const ROOT = new URL('.', import.meta.url).pathname;
const trip = JSON.parse(readFileSync(ROOT + 'fake-trip.json', 'utf8'));
validateTripData(trip);

const bundle = { trip, blobs: {} };
const { key, kdfMeta } = await createKeyContext(FIXTURE_PASSPHRASE);
const envelope = await sealWithKey(key, kdfMeta, encodeJson(bundle));

writeFileSync(ROOT + 'fake-trip.tvault', JSON.stringify(envelope));
console.log('fake-trip.tvault generado.');

// Variante con 1 byte del texto cifrado alterado (prueba de integridad GCM).
const tampered = { ...envelope };
const ctBytes = b64decode(envelope.ct);
ctBytes[0] ^= 0xff;
tampered.ct = b64encode(ctBytes);
writeFileSync(ROOT + 'fake-trip-tampered.tvault', JSON.stringify(tampered));
console.log('fake-trip-tampered.tvault generado.');

// Variante con un número de iteraciones fuera de rango (debe rechazarse
// rápido, sin intentar derivar la clave).
const hugeIter = { ...envelope, kdf: { ...envelope.kdf, iter: 50000000 } };
writeFileSync(ROOT + 'fake-trip-hugeiter.tvault', JSON.stringify(hugeIter));
console.log('fake-trip-hugeiter.tvault generado.');

#!/usr/bin/env node
// S16: comprueba que ningún patrón de app/private/denylist.txt aparece en web/.
// denylist.txt NUNCA debe copiarse a este repo ni a un entorno sin los datos reales;
// vive en app/private/ (fuera de git) junto a este repo (app/web/).
//
// Si no existe (p. ej. en un entorno de desarrollo que no tiene los datos reales,
// como el contenedor en la nube usado para construir y probar el código), la
// comprobación se omite con un aviso. Antes de cualquier commit real con los datos
// de verdad presentes en el equipo, este script DEBE ejecutarse con el denylist
// presente: así lo hace el hook pre-commit.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DENYLIST_PATH = join(ROOT, '..', 'private', 'denylist.txt');

const EXCLUDE_DIRS = new Set(['.git', 'node_modules', 'test-results', 'playwright-report']);

function walk(dir) {
  let files = [];
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(entry)) continue;
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) files.push(...walk(p));
    else files.push(p);
  }
  return files;
}

if (!existsSync(DENYLIST_PATH)) {
  console.warn(
    'check-no-secrets: AVISO — no se encontró app/private/denylist.txt.\n' +
      '  Esto es normal en un entorno sin los datos reales del viaje.\n' +
      '  Antes de un commit real con los datos ya extraídos, este script DEBE\n' +
      '  ejecutarse con el denylist presente (lo hace el hook pre-commit en el equipo).'
  );
  process.exit(0);
}

const patterns = readFileSync(DENYLIST_PATH, 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'));

if (patterns.length === 0) {
  console.log('check-no-secrets: denylist.txt vacío, nada que comprobar.');
  process.exit(0);
}

let violations = [];
for (const file of walk(ROOT)) {
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue; // binario, se ignora
  }
  const lower = content.toLowerCase();
  for (const pattern of patterns) {
    if (lower.includes(pattern.toLowerCase())) {
      violations.push(`${relative(ROOT, file)}: contiene el patrón prohibido "${pattern}"`);
    }
  }
}

if (violations.length) {
  console.error('check-no-secrets: ¡DATOS REALES ENCONTRADOS EN EL REPO!\n');
  for (const v of violations) console.error('  - ' + v);
  console.error('\nCommit BLOQUEADO. Elimina el dato real de ese archivo antes de continuar.');
  process.exit(1);
}

console.log(`check-no-secrets: OK, ninguno de los ${patterns.length} patrones del denylist aparece en el repo.`);

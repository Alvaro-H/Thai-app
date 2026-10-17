#!/usr/bin/env node
// Genera js/shell-manifest.js: la lista versionada de archivos que el
// service worker debe precachear (S8), con un hash de versión derivado
// del contenido real de esos archivos (así una actualización de código
// cambia automáticamente la versión de caché).
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

const SHELL_DIRS = ['css', 'js', 'icons', 'fonts'];
const SHELL_ROOT_FILES = ['index.html', 'manifest.webmanifest'];
const EXCLUDE = new Set(['shell-manifest.js']);

function walk(dir) {
  let files = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) files.push(...walk(p));
    else files.push(p);
  }
  return files;
}

let files = [...SHELL_ROOT_FILES.map((f) => join(ROOT, f))];
for (const d of SHELL_DIRS) {
  try {
    files.push(...walk(join(ROOT, d)));
  } catch {
    /* directorio aún no existe */
  }
}

const hash = createHash('sha256');
const relFiles = [];
for (const f of files.sort()) {
  const rel = relative(ROOT, f).split(sep).join('/');
  if (EXCLUDE.has(rel.split('/').pop())) continue;
  let content;
  try {
    content = readFileSync(f);
  } catch {
    continue;
  }
  hash.update(rel);
  hash.update(content);
  relFiles.push('./' + rel);
}

const version = hash.digest('hex').slice(0, 16);

const out = `// GENERADO por tools/build-shell-manifest.mjs — no editar a mano.
export const CACHE_VERSION = ${JSON.stringify('shell-' + version)};
export const SHELL_FILES = ${JSON.stringify(relFiles, null, 2)};
`;

writeFileSync(join(ROOT, 'js', 'shell-manifest.js'), out);
console.log(`build-shell-manifest: ${relFiles.length} archivos, versión ${version}`);

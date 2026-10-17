#!/usr/bin/env node
// S3: prohibe sumideros peligrosos de DOM/JS en el código fuente de la app.
// Se ejecuta con `npm run lint` y como hook pre-commit.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SCAN_DIRS = ['js', 'css'].map((d) => join(ROOT, d));
const HTML_FILES = ['index.html', 'seal.html'].map((f) => join(ROOT, f));

const JS_FORBIDDEN = [
  { re: /\.innerHTML\s*=/g, name: 'innerHTML (asignación)' },
  { re: /\.outerHTML\s*=/g, name: 'outerHTML (asignación)' },
  { re: /insertAdjacentHTML\s*\(/g, name: 'insertAdjacentHTML' },
  { re: /document\.write\s*\(/g, name: 'document.write' },
  { re: /\beval\s*\(/g, name: 'eval' },
  { re: /new\s+Function\s*\(/g, name: 'new Function' },
  { re: /set(?:Timeout|Interval)\s*\(\s*['"`]/g, name: 'setTimeout/setInterval con cadena' },
  { re: /\bFunction\s*\(\s*['"`]/g, name: 'Function(string)' },
];

const HTML_FORBIDDEN = [
  { re: /<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi, name: '<script> inline sin src' },
  { re: /\son[a-z]+\s*=\s*["']/gi, name: 'atributo on*= inline' },
  { re: /javascript:/gi, name: 'esquema javascript: en HTML' },
];

let violations = [];

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  let files = [];
  for (const entry of entries) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) files.push(...walk(p));
    else files.push(p);
  }
  return files;
}

for (const dir of SCAN_DIRS) {
  for (const file of walk(dir)) {
    if (!['.js', '.mjs'].includes(extname(file))) continue;
    const content = readFileSync(file, 'utf8');
    for (const { re, name } of JS_FORBIDDEN) {
      const matches = content.match(re);
      if (matches) {
        violations.push(`${file}: ${name} (${matches.length}x)`);
      }
    }
  }
}

for (const file of HTML_FILES) {
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const { re, name } of HTML_FORBIDDEN) {
    const matches = content.match(re);
    if (matches) {
      violations.push(`${file}: ${name} (${matches.length}x)`);
    }
  }
}

if (violations.length) {
  console.error('lint-sinks: se han encontrado sumideros prohibidos:\n');
  for (const v of violations) console.error('  - ' + v);
  console.error('\nRevisa la regla S3/S4 del plan (helper h(), textContent, safeUrl()).');
  process.exit(1);
}

console.log('lint-sinks: OK, ningún sumidero prohibido encontrado.');

// Generación de ids compatibles con la regex del esquema: /^[a-z0-9_-]{1,40}$/
let counter = 0;

export function newId(prefix = 'x') {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  const time = Date.now().toString(36).slice(-6);
  return `${prefix}_${time}${rand}${counter}`.toLowerCase().slice(0, 40);
}

export function nowIso() {
  return new Date().toISOString();
}

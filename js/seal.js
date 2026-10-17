// Página de sellado: convierte app/private/trip-bundle.json en viaje.tvault
// cifrado. Se usa UNA SOLA VEZ en el Chrome del PC. No escribe nada en
// IndexedDB ni en ningún almacenamiento del navegador, y limpia de memoria
// el contenido en claro en cuanto termina de generar la descarga.
import { h, clear } from './dom.js';
import { createKeyContext, sealWithKey, encodeJson } from './crypto.js';
import { validateTripData } from './schema.js';

const root = document.getElementById('root');

function render() {
  clear(root);

  let bundle = null; // { trip, blobs } en claro, solo en memoria, solo durante el sellado
  let statusEl;

  const fileInput = h('input', { type: 'file', accept: 'application/json', id: 'bundlefile' });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      validateTripData(parsed.trip);
      bundle = parsed;
      setStatus(`Cargado: ${parsed.trip.items?.length || 0} elementos, ${Object.keys(parsed.blobs || {}).length} documentos.`, false);
    } catch (err) {
      bundle = null;
      setStatus('No se ha podido leer el archivo: ' + (err?.message || 'formato no válido'), true);
    }
  });

  const passInput = h('input', { type: 'password', id: 'pass', minlength: 12, autocomplete: 'new-password' });
  const passInput2 = h('input', { type: 'password', id: 'pass2', minlength: 12, autocomplete: 'new-password' });

  const form = h(
    'form',
    {
      onSubmit: async (ev) => {
        ev.preventDefault();
        if (!bundle) return setStatus('Elige primero trip-bundle.json.', true);
        if (passInput.value.length < 12) return setStatus('La frase de paso debe tener al menos 12 caracteres.', true);
        if (passInput.value !== passInput2.value) return setStatus('Las dos frases de paso no coinciden.', true);
        try {
          const { key, kdfMeta } = await createKeyContext(passInput.value);
          const envelope = await sealWithKey(key, kdfMeta, encodeJson(bundle));
          downloadJson(envelope, 'viaje.tvault');
          setStatus('viaje.tvault generado y descargado correctamente.', false);
        } finally {
          // Limpieza: deja de haber datos en claro accesibles desde esta página.
          bundle = null;
          passInput.value = '';
          passInput2.value = '';
        }
      },
    },
    h('h1', null, 'Sellar el viaje'),
    h(
      'p',
      { class: 'card-sub' },
      'Esta página cifra app/private/trip-bundle.json en un único archivo viaje.tvault. No envía nada a ningún servidor: todo ocurre en este navegador.'
    ),
    h('div', { class: 'field' }, h('label', { for: 'bundlefile' }, 'Archivo trip-bundle.json'), fileInput),
    h('div', { class: 'field' }, h('label', { for: 'pass' }, 'Frase de paso')),
    passInput,
    h('div', { class: 'field' }, h('label', { for: 'pass2' }, 'Repite la frase de paso')),
    passInput2,
    h('button', { class: 'btn btn-primary', type: 'submit' }, 'Generar viaje.tvault')
  );

  statusEl = h('p', { class: 'card-sub' }, '');
  form.appendChild(statusEl);

  function setStatus(msg, isError) {
    statusEl.textContent = msg;
    statusEl.className = isError ? 'warn-banner' : 'card-sub';
  }

  root.appendChild(form);
}

function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

render();

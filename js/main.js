import { h, clear } from './dom.js';
import { route, notFound, startRouter, navigate } from './router.js';
import * as session from './session.js';
import { initAutoLock, resetIdleTimer } from './lock.js';
import { hasVault, createVault, unlockVault, replaceVault } from './store.js';
import { openEnvelope, decodeJson, b64decode } from './crypto.js';
import { getSwPolicy } from './tt-policy.js';

import { renderToday } from './views/today.js';
import { renderItinerary, renderDay } from './views/itinerary.js';
import { renderBookings, renderItemDetail, renderItemEditor } from './views/bookings.js';
import { renderLists } from './views/lists.js';
import { renderMore } from './views/more.js';
import { renderNotes, renderNoteEditor } from './views/notes.js';
import { renderContacts } from './views/contacts.js';
import { renderTips } from './views/tips.js';
import { renderApps } from './views/apps.js';
import { renderConverter } from './views/converter.js';
import { renderSettings } from './views/settings.js';
import { renderAttachmentViewer } from './views/viewer.js';

const appEl = document.getElementById('app');
const viewEl = document.getElementById('view');
const lockScreenEl = document.getElementById('lock-screen');
const hiddenCoverEl = document.getElementById('hidden-cover');
const tabbarEl = document.getElementById('tabbar');

const TABS = [
  { path: '/hoy', label: 'Hoy' },
  { path: '/itinerario', label: 'Itinerario' },
  { path: '/reservas/vuelos', label: 'Reservas' },
  { path: '/listas', label: 'Listas' },
  { path: '/mas', label: 'Más' },
];

let vaultExistsCache = false;

function renderTabbar() {
  clear(tabbarEl);
  const current = location.hash.slice(1) || '/hoy';
  for (const tab of TABS) {
    const tabRoot = '/' + tab.path.split('/')[1];
    const isActive = current.startsWith(tabRoot);
    tabbarEl.appendChild(h('button', { 'aria-current': isActive, onClick: () => navigate(tab.path) }, tab.label));
  }
}

window.addEventListener('hashchange', renderTabbar);

let routesReady = false;
function setupRoutes() {
  if (routesReady) return;
  routesReady = true;
  route('/hoy', async () => {
    renderTabbar();
    return renderToday(viewEl);
  });
  route('/itinerario', async () => {
    renderTabbar();
    return renderItinerary(viewEl);
  });
  route('/dia/:date', async (p) => renderDay(viewEl, p.date));
  route('/reservas/:tab', async (p) => {
    renderTabbar();
    return renderBookings(viewEl, p.tab);
  });
  route('/item/:id', async (p) => renderItemDetail(viewEl, p.id));
  route('/item-nuevo/:type', async (p) => renderItemEditor(viewEl, null, p.type));
  route('/item-editar/:id', async (p) => renderItemEditor(viewEl, p.id, null));
  route('/listas', async () => {
    renderTabbar();
    return renderLists(viewEl);
  });
  route('/mas', async () => {
    renderTabbar();
    return renderMore(viewEl);
  });
  route('/notas', async () => renderNotes(viewEl));
  route('/nota/:id', async (p) => renderNoteEditor(viewEl, p.id));
  route('/nota-nueva', async () => renderNoteEditor(viewEl, null));
  route('/contactos', async () => renderContacts(viewEl));
  route('/consejos', async () => renderTips(viewEl));
  route('/apps-utiles', async () => renderApps(viewEl));
  route('/conversor', async () => renderConverter(viewEl));
  route('/ajustes', async () => renderSettings(viewEl, { onLocked: lockNow }));
  route('/adjunto/:id', async (p) => renderAttachmentViewer(p.id));
  route('/', async () => navigate('/hoy'));
  notFound(async () => {
    clear(viewEl);
    viewEl.appendChild(h('div', { class: 'empty-state' }, 'Página no encontrada.'));
  });
}

function lockNow() {
  session.lock();
}

function showApp() {
  lockScreenEl.hidden = true;
  clear(lockScreenEl);
  appEl.hidden = false;
  setupRoutes();
  startRouter();
  renderTabbar();
  resetIdleTimer();
}

function showLockScreen(renderFn) {
  appEl.hidden = true;
  lockScreenEl.hidden = false;
  clear(lockScreenEl);
  lockScreenEl.appendChild(renderFn());
}

function passphraseForm({ title, confirm = false, extra = null, submitLabel, onSubmit }) {
  const passInput = h('input', {
    type: 'password', id: 'pass', required: true, minlength: 12,
    autocomplete: confirm ? 'new-password' : 'current-password',
  });
  const confirmInput = confirm
    ? h('input', { type: 'password', id: 'pass2', required: true, minlength: 12, autocomplete: 'new-password' })
    : null;
  const errorEl = h('p', { class: 'warn-banner' }, '');
  errorEl.hidden = true;

  function showFormError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }

  const form = h(
    'form',
    {
      onSubmit: async (ev) => {
        ev.preventDefault();
        errorEl.hidden = true;
        const pass = passInput.value;
        if (pass.length < 12) return showFormError('La frase de paso debe tener al menos 12 caracteres.');
        if (confirm && confirmInput.value !== pass) return showFormError('Las dos frases de paso no coinciden.');
        await onSubmit(pass, showFormError);
      },
    },
    title ? h('h1', null, title) : null,
    extra,
    errorEl,
    h('div', { class: 'field' }, h('label', { for: 'pass' }, 'Frase de paso'), passInput),
    confirm ? h('div', { class: 'field' }, h('label', { for: 'pass2' }, 'Repite la frase de paso'), confirmInput) : null,
    h('button', { class: 'btn btn-primary', type: 'submit' }, submitLabel || (confirm ? 'Crear' : 'Desbloquear'))
  );
  return form;
}

async function fileToBytes(file) {
  return new Uint8Array(await file.arrayBuffer());
}

function importScreen() {
  let chosenFile = null;
  const fileInput = h('input', { type: 'file', accept: 'application/json,.tvault', id: 'importfile' });
  fileInput.addEventListener('change', () => (chosenFile = fileInput.files[0] || null));

  const header = h(
    'div',
    null,
    h('h1', null, 'Importar viaje'),
    h('p', { class: 'card-sub' }, 'Elige el archivo .tvault y escribe la frase de paso que se usó para crearlo.'),
    h('div', { class: 'field' }, h('label', { for: 'importfile' }, 'Archivo .tvault'), fileInput)
  );

  const form = passphraseForm({
    extra: header,
    submitLabel: 'Importar',
    onSubmit: async (pass, showFormError) => {
      if (!chosenFile) return showFormError('Elige primero el archivo .tvault.');
      try {
        const bytes = await fileToBytes(chosenFile);
        const envelope = JSON.parse(new TextDecoder().decode(bytes));
        const { plaintext } = await openEnvelope(envelope, pass);
        const bundle = decodeJson(plaintext);
        const blobsMap = new Map(Object.entries(bundle.blobs || {}).map(([id, b64]) => [id, b64decode(b64)]));
        const { key, kdfMeta } = await replaceVault(pass, bundle.trip, blobsMap);
        session.setUnlocked(bundle.trip, key, kdfMeta);
        vaultExistsCache = true;
        showApp();
        navigate('/hoy');
        requestPersistentStorageOnce();
      } catch {
        showFormError('No se ha podido importar: frase de paso incorrecta o archivo dañado.');
      }
    },
  });

  return h('div', { class: 'screen-inner' }, form, h('button', { class: 'btn', type: 'button', onClick: () => showLockScreen(createScreen) }, 'O crear un viaje nuevo vacío'));
}

function createScreen() {
  const form = passphraseForm({
    title: 'Crear tu viaje',
    confirm: true,
    extra: h('p', { class: 'card-sub' }, 'Sin esta frase no hay forma de recuperar los datos: elige algo que no olvides y que nadie adivine (se recomiendan 4 o más palabras al azar).'),
    onSubmit: async (pass, showFormError) => {
      try {
        await createVault(pass);
        const unlocked = await unlockVault(pass);
        session.setUnlocked(unlocked.tripData, unlocked.key, unlocked.kdfMeta);
        vaultExistsCache = true;
        showApp();
        navigate('/hoy');
        requestPersistentStorageOnce();
      } catch (err) {
        showFormError('No se ha podido crear el viaje: ' + (err?.message || 'error desconocido'));
      }
    },
  });
  return h('div', { class: 'screen-inner' }, form, h('button', { class: 'btn', type: 'button', onClick: () => showLockScreen(importScreen) }, 'O importar un viaje (.tvault)'));
}

function unlockScreen() {
  const form = passphraseForm({
    title: 'Viaje',
    onSubmit: async (pass, showFormError) => {
      try {
        const { tripData, key, kdfMeta } = await unlockVault(pass);
        session.setUnlocked(tripData, key, kdfMeta);
        showApp();
        navigate('/hoy');
      } catch {
        showFormError('Frase de paso incorrecta.');
      }
    },
  });
  return h(
    'div',
    { class: 'screen-inner' },
    form,
    h('button', { class: 'btn', type: 'button', onClick: () => showLockScreen(importScreen) }, 'Importar otro archivo .tvault (sustituye los datos de este móvil)')
  );
}

async function boot() {
  vaultExistsCache = await hasVault();
  showLockScreen(vaultExistsCache ? unlockScreen : createScreen);

  initAutoLock();

  session.onLockChange((unlocked) => {
    if (!unlocked) {
      appEl.hidden = true;
      clear(viewEl); // S10/S11: no debe quedar texto del viaje en el DOM tras bloquear
      clear(tabbarEl);
      for (const overlay of document.querySelectorAll('.overlay-root')) overlay.remove();
      location.hash = '';
      showLockScreen(vaultExistsCache ? unlockScreen : createScreen);
    }
  });

  document.addEventListener('visibilitychange', () => {
    hiddenCoverEl.hidden = document.visibilityState !== 'hidden';
  });

  if ('serviceWorker' in navigator) {
    try {
      const swUrl = getSwPolicy().createScriptURL('./sw.js');
      await navigator.serviceWorker.register(swUrl, { type: 'module' });
    } catch {
      /* el service worker es una mejora progresiva */
    }
  }
}

async function requestPersistentStorageOnce() {
  if (navigator.storage && navigator.storage.persist) {
    try {
      await navigator.storage.persist();
    } catch {
      /* no crítico */
    }
  }
}

boot();

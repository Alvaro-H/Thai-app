import { h, clear } from '../dom.js';
import { getTripData, getKey, persist } from '../session.js';
import { navigate } from '../router.js';
import { changePassphrase, wipeVault, listBlobIds, loadBlob } from '../store.js';
import { sealWithKey, createKeyContext, encodeJson, b64encode } from '../crypto.js';

async function requestPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    try {
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }
  return null;
}

export async function renderSettings(container, { onLocked }) {
  const trip = getTripData();
  clear(container);
  container.appendChild(h('button', { class: 'btn btn-small', onClick: () => navigate('/mas') }, '← Más'));
  container.appendChild(h('h1', null, 'Ajustes'));

  // Nombre propio (para "addedBy" en documentos subidos por cada viajero)
  const nameInput = h('input', { type: 'text', maxlength: 200, value: trip.settings?.myName || '', placeholder: 'Tu nombre' });
  nameInput.addEventListener('change', async () => {
    trip.settings = trip.settings || {};
    trip.settings.myName = nameInput.value.slice(0, 200);
    await persist();
  });
  container.appendChild(h('div', { class: 'field' }, h('label', null, 'Soy:'), nameInput));

  // Tiempos de bloqueo
  const hiddenInput = h('input', { type: 'number', min: '0', max: '3600', value: trip.settings?.autoLockHiddenSec ?? 120 });
  const idleInput = h('input', { type: 'number', min: '0', max: '86400', value: trip.settings?.autoLockIdleSec ?? 600 });
  async function saveLockTimes() {
    trip.settings = trip.settings || {};
    trip.settings.autoLockHiddenSec = Math.max(0, Math.min(3600, parseInt(hiddenInput.value, 10) || 0));
    trip.settings.autoLockIdleSec = Math.max(0, Math.min(86400, parseInt(idleInput.value, 10) || 0));
    await persist();
  }
  hiddenInput.addEventListener('change', saveLockTimes);
  idleInput.addEventListener('change', saveLockTimes);
  container.appendChild(h('div', { class: 'field' }, h('label', null, 'Bloquear tras X segundos en segundo plano'), hiddenInput));
  container.appendChild(h('div', { class: 'field' }, h('label', null, 'Bloquear tras X segundos de inactividad'), idleInput));

  // Almacenamiento persistente
  const storageStatusEl = h('p', { class: 'card-sub' }, 'Comprobando...');
  container.appendChild(h('h2', null, 'Almacenamiento'));
  container.appendChild(storageStatusEl);
  (async () => {
    if (navigator.storage && navigator.storage.persisted) {
      const persisted = await navigator.storage.persisted();
      storageStatusEl.textContent = persisted ? 'Almacenamiento persistente: activado' : 'Almacenamiento persistente: no activado';
      if (!persisted) {
        const btn = h('button', { class: 'btn btn-small', onClick: async () => {
          await requestPersistentStorage();
          renderSettings(container, { onLocked });
        } }, 'Activar');
        container.insertBefore(btn, storageStatusEl.nextSibling);
      }
    } else {
      storageStatusEl.textContent = 'No disponible en este navegador.';
    }
  })();

  // Aviso de copia de seguridad
  container.appendChild(h('h2', null, 'Copia de seguridad'));
  const lastBackup = trip.settings?.lastBackupAt;
  container.appendChild(h('p', { class: 'card-sub' }, lastBackup ? 'Última copia: ' + new Date(lastBackup).toLocaleString('es-ES') : 'Todavía no has hecho ninguna copia.'));
  container.appendChild(
    h('button', { class: 'btn btn-primary', onClick: () => exportBackup(trip) }, 'Exportar copia cifrada (.tvault)')
  );

  // Cambiar frase de paso
  container.appendChild(h('h2', null, 'Cambiar frase de paso'));
  const newPassInput = h('input', { type: 'password', minlength: 12, autocomplete: 'new-password' });
  const newPassInput2 = h('input', { type: 'password', minlength: 12, autocomplete: 'new-password' });
  const changeError = h('p', { class: 'warn-banner' }, '');
  changeError.hidden = true;
  const changeForm = h(
    'form',
    {
      onSubmit: async (ev) => {
        ev.preventDefault();
        changeError.hidden = true;
        if (newPassInput.value.length < 12) {
          changeError.textContent = 'Mínimo 12 caracteres.';
          changeError.hidden = false;
          return;
        }
        if (newPassInput.value !== newPassInput2.value) {
          changeError.textContent = 'Las dos frases no coinciden.';
          changeError.hidden = false;
          return;
        }
        try {
          await changePassphrase(getKey(), newPassInput.value);
          if (onLocked) onLocked();
        } catch (err) {
          changeError.textContent = 'No se pudo cambiar: ' + (err?.message || 'error');
          changeError.hidden = false;
        }
      },
    },
    changeError,
    h('div', { class: 'field' }, h('label', null, 'Nueva frase de paso'), newPassInput),
    h('div', { class: 'field' }, h('label', null, 'Repite la nueva frase'), newPassInput2),
    h('button', { class: 'btn', type: 'submit' }, 'Cambiar')
  );
  container.appendChild(changeForm);

  // Borrar todo
  container.appendChild(h('h2', null, 'Zona de peligro'));
  const confirmInput = h('input', { type: 'text', placeholder: 'Escribe BORRAR' });
  container.appendChild(
    h(
      'div',
      { class: 'card' },
      h('p', { class: 'card-sub' }, 'Esto borra TODOS los datos de este móvil sin posibilidad de recuperarlos.'),
      h('div', { class: 'field' }, confirmInput),
      h(
        'button',
        {
          class: 'btn btn-danger',
          onClick: async () => {
            if (confirmInput.value !== 'BORRAR') return;
            await wipeVault();
            if (onLocked) onLocked();
          },
        },
        'Borrar todos los datos'
      )
    )
  );

  container.appendChild(h('p', { class: 'card-sub' }, 'Versión 1.0.0'));

  return () => {};
}

async function exportBackup(trip) {
  const key = getKey();
  const blobIds = await listBlobIds();
  const blobs = {};
  for (const id of blobIds) {
    const bytes = await loadBlob(id, key);
    if (bytes) blobs[id] = b64encode(bytes);
  }
  const bundle = { trip, blobs };
  const exportPass = await promptExportPassphrase();
  if (!exportPass) return;
  const { key: exportKey, kdfMeta } = await createKeyContext(exportPass);
  const envelope = await sealWithKey(exportKey, kdfMeta, encodeJson(bundle));
  const blob = new Blob([JSON.stringify(envelope)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'viaje.tvault';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);

  trip.settings = trip.settings || {};
  trip.settings.lastBackupAt = new Date().toISOString();
  await persist();
}

async function promptExportPassphrase() {
  // Pide una frase de paso específica para el archivo exportado (puede ser la
  // misma que la del almacén local, pero se pide de forma explícita para que
  // quien reciba el archivo no tenga que conocer la frase de este móvil).
  const pass = window.prompt('Frase de paso para proteger el archivo exportado (mínimo 12 caracteres):');
  if (!pass || pass.length < 12) return null;
  return pass;
}

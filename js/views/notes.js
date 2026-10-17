import { h, clear } from '../dom.js';
import { getTripData, persist } from '../session.js';
import { navigate } from '../router.js';
import { newId, nowIso } from '../ids.js';

export function renderNotes(container) {
  const trip = getTripData();
  clear(container);
  container.appendChild(h('button', { class: 'btn-back', onClick: () => navigate('/mas') }, '← Más'));
  container.appendChild(h('h1', null, 'Notas'));

  if (!trip.notes.length) container.appendChild(h('div', { class: 'empty-state' }, 'Sin notas todavía.'));

  for (const note of trip.notes) {
    container.appendChild(
      h('div', { class: 'card', onClick: () => navigate('/nota/' + note.id) }, h('div', { class: 'card-title' }, note.title || '(sin título)'), h('div', { class: 'card-sub' }, (note.body || '').slice(0, 80)))
    );
  }

  container.appendChild(h('button', { class: 'btn btn-primary', onClick: () => navigate('/nota-nueva') }, '+ Nueva nota'));
  return () => {};
}

export function renderNoteEditor(container, noteId) {
  const trip = getTripData();
  clear(container);
  const existing = noteId ? trip.notes.find((n) => n.id === noteId) : null;

  container.appendChild(h('button', { class: 'btn-back', onClick: () => navigate('/notas') }, '← Notas'));
  container.appendChild(h('h1', null, existing ? 'Editar nota' : 'Nueva nota'));

  const titleInput = h('input', { type: 'text', maxlength: 300, value: existing?.title || '', placeholder: 'Título' });
  const bodyInput = h('textarea', { rows: 10, maxlength: 20000, placeholder: 'Escribe aquí...' }, existing?.body || '');

  const form = h(
    'form',
    {
      onSubmit: async (ev) => {
        ev.preventDefault();
        if (existing) {
          existing.title = titleInput.value.slice(0, 300);
          existing.body = bodyInput.value;
          existing.updatedAt = nowIso();
        } else {
          trip.notes.push({ id: newId('n'), title: titleInput.value.slice(0, 300) || 'Nota', body: bodyInput.value, updatedAt: nowIso() });
        }
        await persist();
        navigate('/notas');
      },
    },
    h('div', { class: 'field' }, h('label', null, 'Título'), titleInput),
    h('div', { class: 'field' }, h('label', null, 'Contenido'), bodyInput),
    h('button', { class: 'btn btn-primary', type: 'submit' }, 'Guardar')
  );

  if (existing) {
    form.appendChild(
      h(
        'button',
        {
          class: 'btn btn-danger',
          type: 'button',
          onClick: async () => {
            if (!confirm('¿Borrar esta nota?')) return;
            trip.notes = trip.notes.filter((n) => n.id !== existing.id);
            await persist();
            navigate('/notas');
          },
        },
        'Borrar'
      )
    );
  }

  container.appendChild(form);
  return () => {};
}

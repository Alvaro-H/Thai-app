import { h, clear } from '../dom.js';
import { getTripData, persist } from '../session.js';
import { newId } from '../ids.js';

export function renderLists(container) {
  const trip = getTripData();
  clear(container);
  container.appendChild(h('h1', null, 'Listas'));

  for (const list of trip.checklists) {
    container.appendChild(renderChecklist(list));
  }

  const addListBtn = h('button', { class: 'btn', onClick: async () => {
    const title = window.prompt('Nombre de la lista nueva:');
    if (!title) return;
    trip.checklists.push({ id: newId('c'), title: title.slice(0, 200), items: [] });
    await persist();
    renderLists(container);
  } }, '+ Nueva lista');
  container.appendChild(addListBtn);

  return () => {};
}

function renderChecklist(list) {
  const trip = getTripData();
  const card = h('div', { class: 'card' });
  card.appendChild(h('h2', null, list.title));

  const sorted = [...list.items].sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1));
  const ul = h('ul', { class: 'list-plain' });
  for (const item of sorted) {
    const checkbox = h('input', { type: 'checkbox', checked: item.done || false });
    checkbox.addEventListener('change', async () => {
      const current = trip.checklists.find((c) => c.id === list.id);
      const ci = current.items.find((i) => i.id === item.id);
      ci.done = checkbox.checked;
      await persist();
    });
    const removeBtn = h('button', { class: 'btn btn-small', type: 'button' }, '✕');
    removeBtn.addEventListener('click', async () => {
      const current = trip.checklists.find((c) => c.id === list.id);
      current.items = current.items.filter((i) => i.id !== item.id);
      await persist();
      card.replaceWith(renderChecklist(current));
    });
    ul.appendChild(
      h(
        'li',
        { class: 'row' },
        checkbox,
        h('span', { class: 'grow', style: { textDecoration: item.done ? 'line-through' : 'none', color: item.priority === 'high' && !item.done ? 'var(--warn)' : 'inherit' } }, item.text),
        removeBtn
      )
    );
  }
  card.appendChild(ul);

  const newItemInput = h('input', { type: 'text', placeholder: 'Añadir...' });
  const addBtn = h('button', { class: 'btn btn-small', type: 'button' }, 'Añadir');
  const addRow = h('div', { class: 'row' }, h('div', { class: 'grow' }, newItemInput), addBtn);
  addBtn.addEventListener('click', async () => {
    const text = newItemInput.value.trim();
    if (!text) return;
    const current = trip.checklists.find((c) => c.id === list.id);
    current.items.push({ id: newId('ci'), text: text.slice(0, 5000), done: false, priority: 'normal' });
    await persist();
    newItemInput.value = '';
    card.replaceWith(renderChecklist(current));
  });
  card.appendChild(addRow);

  return card;
}

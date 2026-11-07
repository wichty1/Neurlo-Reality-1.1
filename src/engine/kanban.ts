// Kanban board view: columns from a select field's options. Drag & drop (mouse) plus a
// "Move to" select on each card so it also works by keyboard and on touch screens.
import * as db from '../core/db';
import { h } from '../core/util';
import { displayValue } from './fields';
import { openEditor } from './editor';
import { registerView, titleOf } from './views';

registerView('kanban', (ctx) => {
  const key = ctx.view.groupBy ?? ctx.col.fields.find((f) => f.type === 'select')?.key ?? 'status';
  const field = ctx.col.fields.find((f) => f.key === key);
  const options = field?.options ?? [];
  const cols = [...options];
  const hasNone = ctx.records.some((r) => !options.includes(String(r[key] ?? '')));
  if (hasNone) cols.unshift('');
  const extra = ctx.col.fields.filter((f) => f.key !== key && f.key !== ctx.col.titleField && !f.hidden && f.type !== 'longtext').slice(0, 2);

  const move = (id: string, to: string) => void db.update(ctx.store, id, { [key]: to || undefined });

  const board = h('div', { class: 'kanban', role: 'list', 'aria-label': `${ctx.col.name} board` });
  for (const c of cols) {
    const recs = ctx.records.filter((r) => (c ? r[key] === c : !options.includes(String(r[key] ?? ''))));
    const list = h('div', { class: 'kanban-list' });
    for (const r of recs) {
      const title = titleOf(ctx.col, r);
      const sel = h('select', { class: 'kanban-move', 'aria-label': `Move ${title} to`, onclick: (e: Event) => e.stopPropagation(),
        onchange: () => move(r.id, sel.value) }, ...options.map((o) => h('option', { value: o }, o)));
      sel.value = String(r[key] ?? '');
      if (!options.includes(sel.value)) sel.prepend(h('option', { value: '', selected: true }, 'No status'));
      const card = h('article', { class: 'card kanban-card', draggable: 'true', tabindex: 0, 'aria-label': title,
        onclick: () => openEditor(ctx.mod, ctx.col, r),
        onkeydown: (e: Event) => { if ((e as KeyboardEvent).key === 'Enter' && e.target === card) openEditor(ctx.mod, ctx.col, r); },
        ondragstart: (e: Event) => {
          const de = e as DragEvent;
          de.dataTransfer?.setData('text/plain', r.id);
          if (de.dataTransfer) de.dataTransfer.effectAllowed = 'move';
          card.classList.add('dragging');
        },
        ondragend: () => card.classList.remove('dragging') },
        h('strong', {}, title),
        ...extra.filter((f) => r[f.key] !== undefined && r[f.key] !== '').map((f) => h('div', { class: 'small muted' }, displayValue(f, r[f.key]))),
        sel);
      list.append(card);
    }
    const column = h('section', { class: 'kanban-col', role: 'listitem', 'aria-label': `${c || 'No status'}, ${recs.length}`,
      ondragover: (e: Event) => { e.preventDefault(); column.classList.add('over'); },
      ondragleave: () => column.classList.remove('over'),
      ondrop: (e: Event) => {
        e.preventDefault(); column.classList.remove('over');
        const id = (e as DragEvent).dataTransfer?.getData('text/plain');
        if (id && c) move(id, c);
      } },
      h('header', { class: 'kanban-head' },
        h('span', {}, c || 'No status'), h('span', { class: 'kanban-count' }, String(recs.length)),
        c ? h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Add to ${c}`, onclick: () => openEditor(ctx.mod, ctx.col, undefined, { [key]: c }) }, '+') : null),
      list);
    board.append(column);
  }
  return board;
});

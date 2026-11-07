// Today: schedule, due tasks, routines, mood check-in, quick-add for anything.
import * as db from '../core/db';
import { h, isoDate } from '../core/util';
import { watchStores, pageCtx } from '../core/page';
import { storeName } from '../core/types';
import { backupDue } from '../core/backup';
import { MODULES } from '../modules';
import { openEditor, newRecordData } from '../engine/editor';
import { openAddChooser } from '../ui/shell';
import { toast } from '../ui/toast';
import { section, eventsOn, dueTasks, routinesOn, scheduleList, taskList, routineList, moodCheckin } from './today-parts';

function quickAddAnything(): HTMLElement {
  const options = MODULES.flatMap((m) => m.collections.map((c) => ({ m, c, store: storeName(m.id, c.id) })));
  let remembered = '';
  try { remembered = localStorage.getItem('today:qa') ?? ''; } catch { /* ignore */ }
  const sel = h('select', { 'aria-label': 'Add to' }, ...MODULES.map((m) => h('optgroup', { label: m.name },
    ...m.collections.map((c) => h('option', { value: storeName(m.id, c.id) }, `${c.icon ?? m.icon} ${c.name}`)))));
  if (options.some((o) => o.store === remembered)) sel.value = remembered;
  const input = h('input', { type: 'text', 'aria-label': 'What to add', placeholder: 'Type and press Enter…' });
  const form = h('form', { class: 'quick-add' }, h('div', { class: 'field compact' }, sel), h('div', { class: 'field compact grow' }, input),
    h('button', { type: 'submit', class: 'btn btn-primary' }, 'Add'));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const o = options.find((x) => x.store === sel.value)!;
    try { localStorage.setItem('today:qa', o.store); } catch { /* ignore */ }
    const tf = o.c.fields.find((f) => f.key === o.c.titleField)!;
    const text = input.value.trim();
    const data = newRecordData(o.c);
    // Only plain text titles can be filled from a one-line box; anything else opens the full form.
    if (text && (tf.type === 'text' || tf.type === 'longtext')) data[tf.key] = text;
    const missing = o.c.fields.some((f) => f.required && (data[f.key] === undefined || data[f.key] === ''));
    if (missing || !text) { openEditor(o.m, o.c, undefined, data); return; }
    await db.create(o.store, data);
    input.value = '';
    toast(`Added to ${o.c.name}`);
  });
  return form;
}

export function renderToday(): HTMLElement {
  const today = isoDate();
  const now = new Date();
  const greet = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const banner = h('div');
  const grid = h('div', { class: 'today-grid' });
  pageCtx.fab = openAddChooser;

  async function paint(): Promise<void> {
    const [events, tasks, routines, mood] = await Promise.all([eventsOn(today), dueTasks(today), routinesOn(today), moodCheckin(today)]);
    grid.replaceChildren(
      section('Mood check-in', mood),
      section('Schedule', scheduleList(events)),
      section(`Due tasks${tasks.length ? ` (${tasks.length})` : ''}`, taskList(tasks, today)),
      section('Routines', routineList(routines, today)));
    banner.replaceChildren();
    if (await backupDue()) {
      banner.append(h('div', { class: 'banner' }, 'It has been over a week since your last backup. ',
        h('a', { href: '#/settings' }, 'Export a backup')));
    }
  }

  watchStores(db.dbEvents, null, () => void paint());
  void paint();
  return h('section', { class: 'today' },
    h('div', { class: 'page-head' },
      h('h1', {}, `${greet}`),
      h('p', { class: 'muted' }, now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }))),
    banner,
    h('section', { class: 'card today-sec' }, h('h2', {}, 'Quick add'), quickAddAnything()),
    grid);
}

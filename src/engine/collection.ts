// Generic collection page: quick-add, search, filters, sort, view switcher, live list.
import type { Collection, DBRecord, Field, ModuleDef } from '../core/types';
import { storeName } from '../core/types';
import * as db from '../core/db';
import { h, asArray } from '../core/util';
import { pageCtx, watchStores } from '../core/page';
import { toast } from '../ui/toast';
import { textValue, fieldInput, type FieldInput } from './fields';
import { openEditor, newRecordData, applyDerive } from './editor';
import { renderView, viewLabel } from './views';

interface UIState { view: number; sortKey: string; sortDir: 'asc' | 'desc'; }

function loadUI(store: string, col: Collection): UIState {
  const def: UIState = {
    view: 0,
    sortKey: col.defaultSort?.key ?? col.dateField ?? 'updatedAt',
    sortDir: col.defaultSort?.dir ?? 'desc',
  };
  try { return { ...def, ...JSON.parse(localStorage.getItem(`ui:${store}`) ?? '{}') }; } catch { return def; }
}
function saveUI(store: string, s: UIState): void {
  try { localStorage.setItem(`ui:${store}`, JSON.stringify(s)); } catch { /* storage unavailable */ }
}

export function searchText(col: Collection, r: DBRecord): string {
  return col.fields.map((f) => textValue(f, r[f.key])).join(' ').toLowerCase();
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === undefined || a === null || a === '') return 1;
  if (b === undefined || b === null || b === '') return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' || typeof b === 'boolean') return Number(a) - Number(b);
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export function sortRecords(recs: DBRecord[], key: string, dir: 'asc' | 'desc'): DBRecord[] {
  const m = dir === 'asc' ? 1 : -1;
  return [...recs].sort((x, y) => {
    const a = x[key], b = y[key];
    const empty = (v: unknown) => v === undefined || v === null || v === '';
    if (empty(a) || empty(b)) return compare(a, b); // empties always last
    return compare(a, b) * m;
  });
}

function filterFields(col: Collection): Field[] {
  return col.fields.filter((f) => f.type === 'select' || f.type === 'multiselect' || f.type === 'tags' || f.type === 'checkbox').slice(0, 4);
}

function quickAddForm(mod: ModuleDef, col: Collection, store: string): HTMLElement {
  const keys = col.quickAdd ?? [col.titleField];
  const fields = keys.map((k) => col.fields.find((f) => f.key === k)).filter((f): f is Field => !!f);
  const inputs = new Map<string, FieldInput>();
  const form = h('form', { class: 'quick-add', 'aria-label': `Quick add to ${col.name}` });
  // (Re)build fresh widgets so stateful inputs (ratings) fully reset after each add; defaults prefill.
  const mount = () => {
    const defaults = newRecordData(col);
    form.replaceChildren();
    for (const f of fields) {
      const fi = fieldInput(f, f.key === col.titleField ? undefined : defaults[f.key], () => {});
      fi.el.classList.add('compact');
      inputs.set(f.key, fi);
      form.append(fi.el);
    }
    form.append(h('button', { type: 'submit', class: 'btn btn-primary' }, 'Add'));
  };
  mount();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const data = newRecordData(col);
      for (const f of fields) {
        const v = inputs.get(f.key)!.read();
        if (f.required && (v === undefined || v === '')) throw new Error(`${f.label} is required`);
        if (v !== undefined) data[f.key] = v;
      }
      const missing = col.fields.find((f) => f.required && (data[f.key] === undefined || data[f.key] === ''));
      if (missing) { openEditor(mod, col, undefined, data); return; } // needs more info: open full form
      await db.create(store, applyDerive(col, data));
      mount();
      inputs.get(fields[0]?.key)?.focusEl.focus();
    } catch (err) { toast(err instanceof Error ? err.message : String(err)); }
  });
  return form;
}

export function renderCollection(mod: ModuleDef, col: Collection, openId?: string): HTMLElement {
  const store = storeName(mod.id, col.id);
  const ui = loadUI(store, col);
  if (ui.view >= col.views.length) ui.view = 0;
  const filters = new Map<string, string>();
  let query = '';
  let all: DBRecord[] = [];

  const body = h('div', { class: 'col-body' });
  const count = h('span', { class: 'muted small', 'aria-live': 'polite' });
  const search = h('input', { type: 'search', class: 'search', placeholder: `Search ${col.name.toLowerCase()}…`, 'aria-label': `Search ${col.name}`,
    oninput: () => { query = search.value.trim().toLowerCase(); paint(); } });
  pageCtx.search = search;
  pageCtx.fab = () => openEditor(mod, col);

  const filterBar = h('div', { class: 'filters' });
  const buildFilters = () => {
    filterBar.replaceChildren();
    for (const f of filterFields(col)) {
      let opts: string[];
      if (f.type === 'checkbox') opts = ['yes', 'no'];
      else if (f.type === 'tags') opts = Array.from(new Set(all.flatMap((r) => asArray(r[f.key])))).sort();
      else opts = f.options ?? [];
      if (!opts.length) continue;
      const s = h('select', { 'aria-label': `Filter by ${f.label}`, onchange: () => { if (s.value) filters.set(f.key, s.value); else filters.delete(f.key); paint(); } },
        h('option', { value: '' }, `All ${f.label.toLowerCase()}`), ...opts.map((o) => h('option', { value: o }, f.type === 'tags' ? `#${o}` : o)));
      s.value = filters.get(f.key) ?? '';
      filterBar.append(s);
    }
  };

  const sortOpts = [...col.fields.filter((f) => f.type !== 'longtext' && f.type !== 'tags' && f.type !== 'multiselect').map((f) => [f.key, f.label]),
    ['updatedAt', 'Last updated'], ['createdAt', 'Created']];
  const sortSel = h('select', { 'aria-label': 'Sort by', onchange: () => { ui.sortKey = sortSel.value; saveUI(store, ui); paint(); } },
    ...sortOpts.map(([k, l]) => h('option', { value: k }, `Sort: ${l}`)));
  sortSel.value = ui.sortKey;
  const dirBtn = h('button', { type: 'button', class: 'btn btn-sm', onclick: () => {
    ui.sortDir = ui.sortDir === 'asc' ? 'desc' : 'asc'; saveUI(store, ui); paintDir(); paint();
  } });
  const paintDir = () => { dirBtn.textContent = ui.sortDir === 'asc' ? '↑' : '↓'; dirBtn.setAttribute('aria-label', `Sort direction: ${ui.sortDir === 'asc' ? 'ascending' : 'descending'}`); };
  paintDir();

  const viewTabs = h('div', { class: 'seg', role: 'tablist', 'aria-label': 'View' });
  col.views.forEach((v, i) => viewTabs.append(h('button', { type: 'button', role: 'tab', 'aria-selected': String(i === ui.view),
    onclick: () => { ui.view = i; saveUI(store, ui); viewTabs.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-selected', String(j === i))); paint(); } }, viewLabel(v))));

  function visible(): DBRecord[] {
    let recs = all;
    if (query) recs = recs.filter((r) => searchText(col, r).includes(query));
    for (const [k, v] of filters) {
      const f = col.fields.find((x) => x.key === k)!;
      recs = recs.filter((r) => f.type === 'checkbox' ? (r[k] === true) === (v === 'yes')
        : f.type === 'select' ? r[k] === v : asArray(r[k]).includes(v));
    }
    return sortRecords(recs, ui.sortKey, ui.sortDir);
  }

  function paint(): void {
    const recs = visible();
    const view = col.views[ui.view];
    count.textContent = `${recs.length} of ${all.length}`;
    body.replaceChildren();
    if (!all.length && view.type !== 'calendar' && view.type !== 'kanban') {
      body.append(h('div', { class: 'empty' },
        h('div', { class: 'empty-icon', 'aria-hidden': 'true' }, col.icon ?? mod.icon),
        h('p', {}, `No ${col.name.toLowerCase()} yet.`),
        h('p', { class: 'muted' }, col.description ?? 'Use quick add above or the + button to create the first one.'),
        h('button', { type: 'button', class: 'btn btn-primary', onclick: () => openEditor(mod, col) }, `Add ${col.name.replace(/s$/, '').toLowerCase()}`)));
      return;
    }
    if (!recs.length && view.type !== 'calendar' && view.type !== 'kanban') {
      body.append(h('div', { class: 'empty' }, h('p', {}, 'Nothing matches your search or filters.')));
      return;
    }
    body.append(renderView({ mod, col, store, view, records: recs, all }));
  }

  async function load(): Promise<void> {
    all = await db.list(store);
    buildFilters();
    paint();
  }

  watchStores(db.dbEvents, [store], () => void load());
  void load().then(async () => {
    if (!openId) return;
    const r = await db.get(store, openId);
    if (r) openEditor(mod, col, r);
  });

  return h('section', { class: 'collection' },
    h('div', { class: 'page-head' }, h('h1', {}, h('span', { 'aria-hidden': 'true' }, col.icon ?? mod.icon), ' ', col.name), col.description ? h('p', { class: 'muted' }, col.description) : null),
    quickAddForm(mod, col, store),
    h('div', { class: 'toolbar' }, search, filterBar, h('div', { class: 'toolbar-right' }, sortSel, dirBtn, viewTabs, count)),
    body);
}

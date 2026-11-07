// Basic view renderers: table, cards, checklist. Calendar/kanban/chart plug in via registerView.
import type { Collection, DBRecord, ModuleDef, ViewDef, ViewType } from '../core/types';
import * as db from '../core/db';
import { h, relTime } from '../core/util';
import { displayValue, textValue } from './fields';
import { openEditor } from './editor';

export interface ViewCtx {
  mod: ModuleDef;
  col: Collection;
  store: string;
  view: ViewDef;
  records: DBRecord[];
  /** Unfiltered records (charts / calendars may want all of them). */
  all: DBRecord[];
}

export type ViewRenderer = (ctx: ViewCtx) => HTMLElement;

const renderers = new Map<ViewType, ViewRenderer>();
export function registerView(type: ViewType, fn: ViewRenderer): void { renderers.set(type, fn); }
export function renderView(ctx: ViewCtx): HTMLElement {
  const fn = renderers.get(ctx.view.type) ?? renderers.get('table')!;
  return fn(ctx);
}

export const viewLabel = (v: ViewDef): string =>
  v.label ?? ({ table: 'Table', cards: 'Cards', checklist: 'Checklist', calendar: 'Calendar', kanban: 'Board', chart: 'Chart' } as const)[v.type];

export function titleOf(col: Collection, r: DBRecord): string {
  const f = col.fields.find((x) => x.key === col.titleField);
  const v = f ? textValue(f, r[col.titleField]) : '';
  return v || '(untitled)';
}

const edit = (ctx: ViewCtx, r: DBRecord) => () => openEditor(ctx.mod, ctx.col, r);
const activate = (fn: () => void) => (e: Event) => {
  if (e instanceof KeyboardEvent && e.key !== 'Enter' && e.key !== ' ') return;
  e.preventDefault(); fn();
};

registerView('table', (ctx) => {
  const cols = ctx.col.fields.filter((f) => !f.hidden && f.type !== 'longtext').slice(0, 6);
  const table = h('table', { class: 'data-table' },
    h('thead', {}, h('tr', {}, ...cols.map((f) => h('th', { scope: 'col' }, f.label)))));
  const tbody = h('tbody');
  for (const r of ctx.records) {
    tbody.append(h('tr', { tabindex: 0, class: 'row-link', onclick: edit(ctx, r), onkeydown: activate(edit(ctx, r)), 'aria-label': `Edit ${titleOf(ctx.col, r)}` },
      ...cols.map((f) => {
        if (f.type === 'checkbox') return h('td', {}, checkToggle(ctx, r, f.key, f.label));
        return h('td', { 'data-label': f.label }, displayValue(f, r[f.key]));
      })));
  }
  table.append(tbody);
  return h('div', { class: 'table-wrap' }, table);
});

registerView('cards', (ctx) => {
  const grid = h('div', { class: 'card-grid' });
  const tf = ctx.col.fields.find((f) => f.key === ctx.col.titleField);
  for (const r of ctx.records) {
    const body = ctx.col.fields.filter((f) => f !== tf && !f.hidden && r[f.key] !== undefined && r[f.key] !== '' && r[f.key] !== false);
    grid.append(h('article', { class: 'card rec-card', tabindex: 0, onclick: edit(ctx, r), onkeydown: activate(edit(ctx, r)), 'aria-label': `Edit ${titleOf(ctx.col, r)}` },
      h('h3', {}, titleOf(ctx.col, r)),
      ...body.slice(0, 5).map((f) => f.type === 'longtext'
        ? h('p', { class: 'clamp' }, String(r[f.key]))
        : h('div', { class: 'kv' }, h('span', { class: 'k' }, f.label), h('span', { class: 'v' }, displayValue(f, r[f.key])))),
      h('footer', { class: 'muted small' }, `Updated ${relTime(r.updatedAt)}`)));
  }
  return grid;
});

export function checkToggle(ctx: { store: string }, r: DBRecord, key: string, label: string): HTMLElement {
  const c = h('input', { type: 'checkbox', 'aria-label': label,
    onclick: (e: Event) => e.stopPropagation(),
    onchange: () => void db.update(ctx.store, r.id, { [key]: c.checked }) });
  c.checked = r[key] === true;
  return c;
}

registerView('checklist', (ctx) => {
  const key = ctx.view.checkField ?? ctx.col.fields.find((f) => f.type === 'checkbox')?.key ?? 'done';
  const ul = h('ul', { class: 'checklist' });
  const sorted = [...ctx.records].sort((a, b) => Number(a[key] === true) - Number(b[key] === true));
  for (const r of sorted) {
    const title = titleOf(ctx.col, r);
    ul.append(h('li', { class: r[key] === true ? 'done' : '' },
      checkToggle(ctx, r, key, `Mark ${title} done`),
      h('button', { type: 'button', class: 'link-btn', onclick: edit(ctx, r) }, title)));
  }
  return ul;
});

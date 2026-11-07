// Month / week / day calendar over one or more collections. Registered as the "calendar" view.
import type { Collection, DBRecord, ModuleDef } from '../core/types';
import { h, isoDate, parseLocal, addDays, startOfWeek } from '../core/util';
import { occursOn, timeOf } from '../core/recur';
import { openEditor } from './editor';
import { registerView, titleOf } from './views';

export interface CalSource { mod: ModuleDef; col: Collection; records: DBRecord[]; }
interface Occ { s: CalSource; r: DBRecord; time: string; end: string; }
type Mode = 'month' | 'week' | 'day';

const state = new Map<string, { mode: Mode; cursor: string }>();

function hintFields(col: Collection) {
  const dateField = col.today?.dateField ?? col.dateField ?? 'date';
  return { dateField, timeField: col.today?.timeField, endField: col.fields.find((f) => f.key === 'end')?.key };
}

export function occurrences(sources: CalSource[], day: string): Occ[] {
  const out: Occ[] = [];
  for (const s of sources) {
    const { dateField, timeField, endField } = hintFields(s.col);
    for (const r of s.records) {
      if (!(s.col.today?.occursOn ? s.col.today.occursOn(r, day) : occursOn(r, day, dateField))) continue;
      const end = endField && typeof r[endField] === 'string' ? String(r[endField]).slice(-5) : '';
      out.push({ s, r, time: timeOf(r, dateField, timeField), end });
    }
  }
  return out.sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));
}

function addOn(s: CalSource, day: string): void {
  const { dateField } = hintFields(s.col);
  const f = s.col.fields.find((x) => x.key === dateField);
  openEditor(s.mod, s.col, undefined, { [dateField]: f?.type === 'datetime' ? `${day}T09:00` : day });
}

function chip(o: Occ, long = false): HTMLElement {
  const label = `${o.time ? o.time + (long && o.end ? `–${o.end}` : '') + ' ' : ''}${titleOf(o.s.col, o.r)}`;
  return h('button', { type: 'button', class: 'cal-chip', style: `--accent:${o.s.mod.color}`, title: `${label} (${o.s.col.name})`,
    onclick: (e: Event) => { e.stopPropagation(); openEditor(o.s.mod, o.s.col, o.r); } },
    label, long ? h('span', { class: 'muted small' }, ` · ${o.s.col.name}`) : null);
}

export function calendarWidget(sources: CalSource[], key: string): HTMLElement {
  const st = state.get(key) ?? { mode: (window.innerWidth < 640 ? 'week' : 'month') as Mode, cursor: isoDate() };
  state.set(key, st);
  const root = h('div', { class: 'calendar' });
  const today = isoDate();

  const paint = () => {
    const cur = parseLocal(st.cursor)!;
    const title = st.mode === 'month' ? cur.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : st.mode === 'week' ? `Week of ${startOfWeek(cur).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
      : cur.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const step = (n: number) => {
      const d = new Date(cur);
      if (st.mode === 'month') { d.setDate(1); d.setMonth(d.getMonth() + n); } else d.setDate(d.getDate() + (st.mode === 'week' ? 7 : 1) * n);
      st.cursor = isoDate(d); paint();
    };
    const modes = h('div', { class: 'seg', role: 'tablist', 'aria-label': 'Calendar mode' },
      ...(['month', 'week', 'day'] as Mode[]).map((m) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(st.mode === m),
        onclick: () => { st.mode = m; paint(); } }, m[0].toUpperCase() + m.slice(1))));
    const head = h('div', { class: 'cal-head' },
      h('button', { type: 'button', class: 'btn btn-sm', 'aria-label': 'Previous', onclick: () => step(-1) }, '‹'),
      h('button', { type: 'button', class: 'btn btn-sm', onclick: () => { st.cursor = today; paint(); } }, 'Today'),
      h('button', { type: 'button', class: 'btn btn-sm', 'aria-label': 'Next', onclick: () => step(1) }, '›'),
      h('h2', { class: 'cal-title', 'aria-live': 'polite' }, title), modes);
    let body: HTMLElement;
    if (st.mode === 'month') body = month(cur);
    else if (st.mode === 'week') body = week(cur);
    else body = dayView(st.cursor);
    root.replaceChildren(head, body);
  };

  const openDay = (d: string) => { st.mode = 'day'; st.cursor = d; paint(); };

  function month(cur: Date): HTMLElement {
    const first = new Date(cur.getFullYear(), cur.getMonth(), 1);
    const start = startOfWeek(first);
    const grid = h('div', { class: 'cal-month', role: 'grid' },
      ...['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => h('div', { class: 'cal-dow', role: 'columnheader' }, d)));
    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i);
      if (i === 35 && d.getMonth() !== cur.getMonth()) break;
      const iso = isoDate(d);
      const occ = occurrences(sources, iso);
      grid.append(h('div', { class: `cal-cell${d.getMonth() !== cur.getMonth() ? ' other' : ''}${iso === today ? ' today' : ''}`, role: 'gridcell' },
        h('button', { type: 'button', class: 'cal-date', 'aria-label': `${d.toDateString()}, ${occ.length} item${occ.length === 1 ? '' : 's'}`, onclick: () => openDay(iso) }, String(d.getDate())),
        ...occ.slice(0, 3).map((o) => chip(o)),
        occ.length > 3 ? h('button', { type: 'button', class: 'cal-more', onclick: () => openDay(iso) }, `+${occ.length - 3} more`) : null));
    }
    return grid;
  }

  function week(cur: Date): HTMLElement {
    const start = startOfWeek(cur);
    return h('div', { class: 'cal-week' }, ...Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i), iso = isoDate(d);
      const occ = occurrences(sources, iso);
      return h('div', { class: `cal-wday${iso === today ? ' today' : ''}` },
        h('button', { type: 'button', class: 'cal-wday-head', onclick: () => openDay(iso) },
          d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })),
        ...(occ.length ? occ.map((o) => chip(o, true)) : [h('span', { class: 'muted small' }, 'Free')]));
    }));
  }

  function dayView(iso: string): HTMLElement {
    const occ = occurrences(sources, iso);
    return h('div', { class: 'cal-day' },
      occ.length ? h('ul', { class: 'agenda' }, ...occ.map((o) => h('li', { style: `--accent:${o.s.mod.color}` },
        h('span', { class: 'agenda-time' }, o.time ? `${o.time}${o.end ? '–' + o.end : ''}` : 'All day'), chip(o, true))))
        : h('p', { class: 'muted' }, 'Nothing on this day.'),
      h('div', { class: 'btn-row' }, ...sources.map((s) => h('button', { type: 'button', class: 'btn btn-sm', onclick: () => addOn(s, iso) },
        `+ ${s.col.name.replace(/s$/, '')}`))));
  }

  paint();
  return root;
}

registerView('calendar', (ctx) => calendarWidget([{ mod: ctx.mod, col: ctx.col, records: ctx.records }], ctx.store));

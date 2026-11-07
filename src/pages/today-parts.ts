// Building blocks for the Today page. Every section is fed by collections' `today` hints.
import type { Collection, DBRecord, ModuleDef, TodayHint } from '../core/types';
import { storeName } from '../core/types';
import * as db from '../core/db';
import { h, isoDate, isoTime, parseLocal } from '../core/util';
import { href } from '../core/router';
import { isDoneOn, setDoneOn } from '../core/routine';
import { MODULES } from '../modules';
import { openEditor, newRecordData } from '../engine/editor';
import { titleOf } from '../engine/views';
import { fieldInput } from '../engine/fields';
import { toast } from '../ui/toast';

export interface Source { mod: ModuleDef; col: Collection; store: string; hint: TodayHint; }

export function sourcesOf(role: TodayHint['role']): Source[] {
  return MODULES.flatMap((mod) => mod.collections
    .filter((col) => col.today?.role === role)
    .map((col) => ({ mod, col, store: storeName(mod.id, col.id), hint: col.today! })));
}

const day = (v: unknown) => (typeof v === 'string' ? v.slice(0, 10) : '');

export function section(title: string, ...body: Node[]): HTMLElement {
  return h('section', { class: 'card today-sec' }, h('h2', {}, title), ...body);
}

/** Events happening on `today`, sorted by time. */
export async function eventsOn(today: string): Promise<{ s: Source; r: DBRecord; time: string }[]> {
  const out: { s: Source; r: DBRecord; time: string }[] = [];
  for (const s of sourcesOf('event')) {
    const df = s.hint.dateField ?? s.col.dateField ?? 'date';
    for (const r of await db.list(s.store)) {
      const hit = s.hint.occursOn ? s.hint.occursOn(r, today) : day(r[df]) === today;
      if (!hit) continue;
      const raw = s.hint.timeField ? r[s.hint.timeField] : r[df];
      const time = typeof raw === 'string' && raw.includes('T') ? raw.slice(11, 16) : typeof raw === 'string' && /^\d\d:\d\d/.test(raw) ? raw.slice(0, 5) : '';
      out.push({ s, r, time });
    }
  }
  return out.sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
}

/** Open tasks due today or earlier. */
export async function dueTasks(today: string): Promise<{ s: Source; r: DBRecord; due: string }[]> {
  const out: { s: Source; r: DBRecord; due: string }[] = [];
  for (const s of sourcesOf('task')) {
    const df = s.hint.dateField ?? 'due', done = s.hint.doneField ?? 'done';
    for (const r of await db.list(s.store)) {
      const due = day(r[df]);
      if (due && due <= today && r[done] !== true) out.push({ s, r, due });
    }
  }
  return out.sort((a, b) => a.due.localeCompare(b.due));
}

export async function routinesOn(today: string): Promise<{ s: Source; r: DBRecord }[]> {
  const out: { s: Source; r: DBRecord }[] = [];
  for (const s of sourcesOf('routine')) {
    for (const r of await db.list(s.store)) if (!s.hint.activeOn || s.hint.activeOn(r, today)) out.push({ s, r });
  }
  return out;
}

export function scheduleList(items: Awaited<ReturnType<typeof eventsOn>>): Node {
  if (!items.length) return h('p', { class: 'muted' }, 'Nothing scheduled for today.');
  return h('ul', { class: 'agenda' }, ...items.map(({ s, r, time }) => h('li', { style: `--accent:${s.mod.color}` },
    h('span', { class: 'agenda-time' }, time || 'All day'),
    h('button', { type: 'button', class: 'link-btn', onclick: () => openEditor(s.mod, s.col, r) }, titleOf(s.col, r)),
    h('span', { class: 'muted small' }, s.col.name))));
}

export function taskList(items: Awaited<ReturnType<typeof dueTasks>>, today: string): Node {
  if (!items.length) return h('p', { class: 'muted' }, 'No tasks due. Nice.');
  return h('ul', { class: 'checklist' }, ...items.map(({ s, r, due }) => {
    const c = h('input', { type: 'checkbox', 'aria-label': `Mark ${titleOf(s.col, r)} done`,
      onchange: () => void db.update(s.store, r.id, { [s.hint.doneField ?? 'done']: c.checked }) });
    const late = due < today ? `Overdue since ${parseLocal(due)!.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'Due today';
    return h('li', { style: `--accent:${s.mod.color}` }, c,
      h('button', { type: 'button', class: 'link-btn', onclick: () => openEditor(s.mod, s.col, r) }, titleOf(s.col, r)),
      h('span', { class: `small ${due < today ? 'warn' : 'muted'}` }, `${late} · ${s.col.name}`));
  }));
}

export function routineList(items: Awaited<ReturnType<typeof routinesOn>>, today: string): Node {
  if (!items.length) return h('p', { class: 'muted' }, 'No routines set up for today.');
  const groups = new Map<string, typeof items>();
  for (const it of items) {
    const g = it.s.hint.groupField ? it.r[it.s.hint.groupField] : '';
    const key = `${it.s.mod.name} · ${it.s.col.name}${g ? ` · ${g}` : ''}`;
    groups.set(key, [...(groups.get(key) ?? []), it]);
  }
  const wrap = h('div', { class: 'routine-groups' });
  for (const [name, list] of groups) {
    const done = list.filter((x) => isDoneOn(x.r, today)).length;
    wrap.append(h('h3', { class: 'routine-head', style: `--accent:${list[0].s.mod.color}` }, name, h('span', { class: 'muted small' }, ` ${done}/${list.length}`)),
      h('ul', { class: 'checklist' }, ...list.map(({ s, r }) => {
        const c = h('input', { type: 'checkbox', 'aria-label': titleOf(s.col, r),
          onchange: () => void setDoneOn(s.store, r, today, c.checked) });
        c.checked = isDoneOn(r, today);
        return h('li', { class: c.checked ? 'done' : '', style: `--accent:${s.mod.color}` }, c,
          h('button', { type: 'button', class: 'link-btn', onclick: () => openEditor(s.mod, s.col, r) }, titleOf(s.col, r)));
      })));
  }
  return wrap;
}

/** One-tap mood check-in for the first mood source. */
export async function moodCheckin(today: string): Promise<Node> {
  const s = sourcesOf('mood')[0];
  if (!s) return h('p', { class: 'muted' }, 'No mood log available.');
  const df = s.hint.dateField ?? 'date';
  const todays = (await db.list(s.store)).filter((r) => day(r[df]) === today).sort((a, b) => b.createdAt - a.createdAt);
  const ratings = (s.hint.ratingFields ?? []).map((k) => s.col.fields.find((f) => f.key === k)!).filter(Boolean);
  const tagsF = s.hint.tagsField ? s.col.fields.find((f) => f.key === s.hint.tagsField) : undefined;
  const inputs = [...ratings, ...(tagsF ? [tagsF] : [])].map((f) => ({ f, i: fieldInput(f, undefined, () => {}) }));
  const form = h('form', { class: 'mood-form' }, ...inputs.map((x) => x.i.el),
    h('button', { type: 'submit', class: 'btn btn-primary' }, 'Save check-in'));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = newRecordData(s.col, { [df]: today, time: isoTime() });
    for (const { f, i } of inputs) { const v = i.read(); if (v !== undefined) data[f.key] = v; }
    const missing = s.col.fields.find((f) => f.required && data[f.key] === undefined);
    if (missing) { toast(`Pick a ${missing.label.toLowerCase()} first`); return; }
    await db.create(s.store, data);
    toast('Check-in saved');
  });
  const last = todays[0];
  const summary = last
    ? h('p', { class: 'small' }, `Today: ${ratings.map((f) => `${f.label} ${last[f.key] ?? '–'}/10`).join(' · ')}`,
        h('a', { href: href('m', s.mod.id, s.col.id), class: 'small' }, ` (${todays.length} check-in${todays.length > 1 ? 's' : ''})`))
    : h('p', { class: 'muted small' }, 'How are you feeling right now?');
  return h('div', {}, summary, form);
}

export function todayISO(): string { return isoDate(); }

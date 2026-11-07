// Reusable collection builders and live-stat helpers shared by module configs.
import type { Collection, Field, DBRecord } from '../core/types';
import * as db from '../core/db';
import { isoDate, addDays } from '../core/util';
import { isDoneOn, dueEvery } from '../core/routine';

export const today = () => isoDate();
export const STATUS = ['Idea', 'Planning', 'In progress', 'Done'];

export function goalsCollection(extra: Field[] = []): Collection {
  return {
    id: 'goals', name: 'Goals', icon: '🎯', titleField: 'goal', dateField: 'target',
    fields: [
      { key: 'goal', label: 'Goal', type: 'text', required: true },
      { key: 'status', label: 'Status', type: 'select', options: ['Not started', 'In progress', 'Achieved', 'Paused'], default: 'Not started' },
      { key: 'target', label: 'Target date', type: 'date' },
      { key: 'measure', label: 'How I will measure it', type: 'text' },
      ...extra,
      { key: 'progress', label: 'Progress', type: 'rating', help: '1 = just started, 10 = done' },
      { key: 'notes', label: 'Notes', type: 'longtext' },
      { key: 'tags', label: 'Tags', type: 'tags' },
    ],
    views: [{ type: 'cards' }, { type: 'table' }, { type: 'kanban', groupBy: 'status', label: 'Board' }],
    defaultSort: { key: 'target', dir: 'asc' },
  };
}

/** Daily routine step list, with optional every-N-days repetition and grouping. */
export function routineCollection(opts: { groups: string[]; groupLabel: string; description: string }): Collection {
  return {
    id: 'routine', name: 'Routine', icon: '✅', titleField: 'step', description: opts.description,
    today: {
      role: 'routine', groupField: 'when',
      activeOn: (r: DBRecord, day: string) => r.active !== false && dueEvery(r, day, r.everyDays),
    },
    fields: [
      { key: 'step', label: 'Step', type: 'text', required: true, placeholder: 'e.g. Cleanser' },
      { key: 'when', label: opts.groupLabel, type: 'select', options: opts.groups, default: opts.groups[0] },
      { key: 'order', label: 'Order', type: 'number', min: 0, step: 1, help: 'Lower numbers come first' },
      { key: 'product', label: 'Product', type: 'text' },
      { key: 'everyDays', label: 'Repeat every (days)', type: 'number', min: 1, step: 1, default: 1, help: '1 = daily, 3 = every third day, 7 = weekly' },
      { key: 'active', label: 'Active', type: 'checkbox', default: true, filter: false },
      { key: 'notes', label: 'Notes', type: 'longtext' },
    ],
    views: [{ type: 'checklist', label: 'Today' }, { type: 'table' }],
    defaultSort: { key: 'order', dir: 'asc' },
  };
}

export async function records(store: string): Promise<DBRecord[]> {
  try { return await db.list(store); } catch { return []; }
}

/** Average of a numeric field over the last `days` days (by dateField). */
export async function avgRecent(store: string, field: string, dateField: string, days = 7): Promise<number | null> {
  const from = isoDate(addDays(new Date(), -days + 1));
  const vals = (await records(store))
    .filter((r) => String(r[dateField] ?? '').slice(0, 10) >= from && typeof r[field] === 'number')
    .map((r) => r[field] as number);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

export async function routineProgress(store: string): Promise<{ done: number; total: number }> {
  const t = isoDate();
  const items = (await records(store)).filter((r) => r.active !== false && dueEvery(r, t, r.everyDays));
  return { done: items.filter((r) => isDoneOn(r, t)).length, total: items.length };
}

export const round1 = (n: number) => Math.round(n * 10) / 10;

// Per-day completion for routines and habits, stored on the record as `_days: string[]` (YYYY-MM-DD).
import type { DBRecord } from './types';
import * as db from './db';
import { isoDate, addDays, parseLocal } from './util';

export function daysOf(r: DBRecord): string[] {
  return Array.isArray(r._days) ? (r._days as unknown[]).map(String) : [];
}

export function isDoneOn(r: DBRecord, day: string): boolean {
  return daysOf(r).includes(day);
}

export async function setDoneOn(store: string, r: DBRecord, day: string, done: boolean): Promise<void> {
  const set = new Set(daysOf(r));
  if (done) set.add(day); else set.delete(day);
  await db.update(store, r.id, { _days: Array.from(set).sort() });
}

/** Consecutive days completed ending today (or yesterday, if today is not done yet). */
export function streak(r: DBRecord, today = isoDate()): number {
  const set = new Set(daysOf(r));
  let d = parseLocal(today)!;
  if (!set.has(today)) d = addDays(d, -1);
  let n = 0;
  while (set.has(isoDate(d))) { n++; d = addDays(d, -1); }
  return n;
}

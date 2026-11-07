// Recurrence rules for events/time blocks: fields `repeat` (select) and `until` (date).
import type { DBRecord } from './types';
import { parseLocal } from './util';

export const REMIND = ['None', 'At start', '5 min before', '15 min before', '30 min before', '1 hour before', '1 day before'];
export const REPEAT = ['Does not repeat', 'Daily', 'Weekdays', 'Weekly', 'Every 2 weeks', 'Monthly', 'Yearly'];

const day = (v: unknown) => (typeof v === 'string' ? v.slice(0, 10) : '');

/** Whether record `r` (starting at r[dateField]) has an occurrence on `target` (YYYY-MM-DD). */
export function occursOn(r: DBRecord, target: string, dateField: string): boolean {
  const start = day(r[dateField]);
  if (!start || target < start) return false;
  if (start === target) return true;
  const until = day(r.until);
  if (until && target > until) return false;
  const rule = typeof r.repeat === 'string' ? r.repeat : '';
  if (!rule || rule === REPEAT[0]) return false;
  const a = parseLocal(start)!, b = parseLocal(target)!;
  const diff = Math.round((+b - +a) / 86400000);
  switch (rule) {
    case 'Daily': return true;
    case 'Weekdays': return b.getDay() >= 1 && b.getDay() <= 5;
    case 'Weekly': return diff % 7 === 0;
    case 'Every 2 weeks': return diff % 14 === 0;
    case 'Monthly': return a.getDate() === b.getDate()
      // Events on the 29th–31st fall on the last day of shorter months.
      || (a.getDate() > b.getDate() && b.getDate() === new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate());
    case 'Yearly': return a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    default: return false;
  }
}

/** HH:mm for a record: explicit time field, else the time part of a datetime field. */
export function timeOf(r: DBRecord, dateField: string, timeField?: string): string {
  const t = timeField ? r[timeField] : undefined;
  if (typeof t === 'string' && /^\d\d:\d\d/.test(t)) return t.slice(0, 5);
  const d = r[dateField];
  return typeof d === 'string' && d.length >= 16 ? d.slice(11, 16) : '';
}

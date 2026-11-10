// In-app reminders: while the app is open, checks every 30s for events whose `remind` time has come.
// Shows a toast and, if the user allowed it, a local browser notification. Nothing leaves the device.
import * as db from './db';
import { storeName } from './types';
import { isoDate, addDays, parseLocal } from './util';
import { occursOn, timeOf } from './recur';
export { REMIND } from './recur';
import { MODULES } from '../modules';
import { href, navigate } from './router';
import { toast } from '../ui/toast';

const OFFSET: Record<string, number> = { 'At start': 0, '5 min before': 5, '15 min before': 15, '30 min before': 30, '1 hour before': 60, '1 day before': 1440 };
const KEY = 'remindersFired';

function fired(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; }
}
function save(f: Record<string, number>): void {
  const cutoff = Date.now() - 3 * 86400000;
  for (const k of Object.keys(f)) if (f[k] < cutoff) delete f[k];
  try { localStorage.setItem(KEY, JSON.stringify(f)); } catch { /* ignore */ }
}

export async function checkReminders(now = new Date()): Promise<number> {
  const done = fired();
  let count = 0;
  for (const mod of MODULES) for (const col of mod.collections) {
    if (!col.fields.some((f) => f.key === 'remind') || !col.today) continue;
    const dateField = col.today.dateField ?? col.dateField ?? 'date';
    const store = storeName(mod.id, col.id);
    for (const r of await db.list(store)) {
      const off = OFFSET[String(r.remind ?? '')];
      if (off === undefined || r.done === true) continue;
      // An event today or tomorrow may have its reminder due now (1-day-before reminders look ahead).
      for (const d of [isoDate(now), isoDate(addDays(now, 1))]) {
        if (!occursOn(r, d, dateField)) continue;
        const t = timeOf(r, dateField, col.today.timeField) || '09:00';
        const start = parseLocal(`${d}T${t}`)!;
        const fireAt = +start - off * 60000;
        const k = `${r.id}@${d}`;
        if (done[k] || +now < fireAt || +now > +start + 3600000) continue;
        done[k] = Date.now();
        count++;
        const title = String(r[col.titleField] ?? col.name);
        const when = off >= 1440 ? `tomorrow at ${t}` : +now >= +start ? `now (${t})` : `at ${t}`;
        const msg = `${mod.icon} ${title} — ${when}`;
        toast(msg, { label: 'Open', run: () => navigate(href('m', mod.id, col.id, r.id)) }, 20000);
        if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
          try { new Notification('Neurlo reminder', { body: msg, tag: k }); } catch { /* some browsers need a SW */ }
        }
      }
    }
  }
  save(done);
  return count;
}

export function startReminders(): void {
  const tick = () => void checkReminders().catch((e) => console.warn('reminder check failed', e));
  tick();
  setInterval(tick, 30000);
}

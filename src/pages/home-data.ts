// Live data for the home page: per-module stat + activity level, and the "today at a glance" summary.
import * as db from '../core/db';
import { storeName } from '../core/types';
import type { ModuleDef } from '../core/types';
import { isoDate, isoTime, relTime } from '../core/util';
import { isDoneOn } from '../core/routine';
import { MODULES } from '../modules';
import { eventsOn, dueTasks, routinesOn, sourcesOf } from './today-parts';
import { titleOf } from '../engine/views';

export interface ModuleInfo {
  mod: ModuleDef;
  stat: string;
  /** 0.15 (neglected / empty) … 1 (updated today). */
  activity: number;
  lastUpdated: number | null;
  count: number;
}

export async function moduleInfo(): Promise<ModuleInfo[]> {
  return Promise.all(MODULES.map(async (mod) => {
    let last: number | null = null, count = 0;
    for (const c of mod.collections) {
      const recs = await db.list(storeName(mod.id, c.id));
      count += recs.length;
      for (const r of recs) if (last === null || r.updatedAt > last) last = r.updatedAt;
    }
    let stat = '';
    try { stat = mod.stat ? await mod.stat() : ''; } catch { stat = ''; }
    if (!stat) stat = count ? `${count} entr${count === 1 ? 'y' : 'ies'} · updated ${relTime(last!)}` : 'Nothing logged yet';
    const days = last === null ? Infinity : (Date.now() - last) / 86400000;
    const activity = last === null ? 0.15 : Math.max(0.15, Math.min(1, 1 - days / 14));
    return { mod, stat, activity, lastUpdated: last, count };
  }));
}

export interface Glance { nextEvent: string; tasks: number; mood: string; routines: string; }

export async function glance(): Promise<Glance> {
  const t = isoDate(), now = isoTime();
  const [events, tasks, routines] = await Promise.all([eventsOn(t), dueTasks(t), routinesOn(t)]);
  const upcoming = events.find((e) => !e.time || e.time >= now);
  const nextEvent = upcoming ? `${upcoming.time || 'All day'} · ${titleOf(upcoming.s.col, upcoming.r)}` : events.length ? 'Nothing else today' : 'Nothing scheduled';
  let mood = 'Not checked in';
  const ms = sourcesOf('mood')[0];
  if (ms) {
    const df = ms.hint.dateField ?? 'date';
    const todays = (await db.list(ms.store)).filter((r) => String(r[df] ?? '') === t).sort((a, b) => b.createdAt - a.createdAt);
    const key = ms.hint.ratingFields?.[0];
    if (todays[0] && key) mood = `${todays[0][key]}/10`;
  }
  const done = routines.filter((x) => isDoneOn(x.r, t)).length;
  return { nextEvent, tasks: tasks.length, mood, routines: routines.length ? `${done}/${routines.length}` : 'None set' };
}

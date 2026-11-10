// Schedule overview: one calendar combining every collection that feeds Today's schedule
// (events, reminders, time blocks, appointments, interviews, shifts).
import * as db from '../core/db';
import { h } from '../core/util';
import { calendarWidget } from '../engine/calendar';
import { sourcesOf } from './today-parts';
import { registerOverviewExtra } from './overview';

registerOverviewExtra('schedule', async () => {
  const sources = await Promise.all(sourcesOf('event').map(async (s) => ({ mod: s.mod, col: s.col, records: await db.list(s.store) })));
  return h('section', { class: 'card' },
    h('h2', {}, 'Everything on your calendar'),
    h('p', { class: 'muted small' }, 'Includes appointments, interviews and shifts from other areas. Click an item to edit it.'),
    calendarWidget(sources, 'schedule-all'));
});

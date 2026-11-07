import type { ModuleDef, DBRecord } from '../core/types';
import { REPEAT, REMIND, occursOn } from '../core/recur';
import { isoDate, isoDateTime } from '../core/util';
import { records } from './common';

const CATS = ['Personal', 'Work', 'Health', 'Job search', 'Social', 'Errand', 'Other'];

export const schedule: ModuleDef = {
  id: 'schedule', name: 'Schedule', icon: '🗓️', color: '#6fb6ff',
  description: 'Calendar of events, recurring plans, reminders and time blocks. Reminders pop up while the app is open.',
  stat: async () => {
    const t = isoDate();
    let n = 0;
    for (const s of ['schedule.events', 'schedule.blocks', 'schedule.reminders']) {
      const df = s === 'schedule.events' ? 'start' : s === 'schedule.blocks' ? 'date' : 'when';
      n += (await records(s)).filter((r: DBRecord) => occursOn(r, t, df)).length;
    }
    return n ? `${n} item${n > 1 ? 's' : ''} today` : 'Nothing scheduled today';
  },
  collections: [
    {
      id: 'events', name: 'Events', icon: '📌', titleField: 'title', dateField: 'start', quickAdd: ['title', 'start'],
      today: { role: 'event', dateField: 'start' },
      fields: [
        { key: 'title', label: 'Event', type: 'text', required: true },
        { key: 'start', label: 'Starts', type: 'datetime', required: true, default: () => `${isoDate()}T09:00` },
        { key: 'end', label: 'Ends (time)', type: 'time' },
        { key: 'location', label: 'Location', type: 'text' },
        { key: 'category', label: 'Category', type: 'select', options: CATS },
        { key: 'repeat', label: 'Repeats', type: 'select', options: REPEAT, default: REPEAT[0], filter: false },
        { key: 'until', label: 'Repeat until', type: 'date', help: 'Leave empty to repeat forever' },
        { key: 'remind', label: 'Reminder', type: 'select', options: REMIND, default: '15 min before', filter: false },
        { key: 'notes', label: 'Notes', type: 'longtext' },
        { key: 'tags', label: 'Tags', type: 'tags' },
      ],
      views: [{ type: 'calendar' }, { type: 'table' }],
      defaultSort: { key: 'start', dir: 'asc' },
    },
    {
      id: 'reminders', name: 'Reminders', icon: '⏰', titleField: 'title', dateField: 'when', quickAdd: ['title', 'when'],
      description: 'One-off or repeating nudges. They appear on Today and pop up at the set time while the app is open.',
      today: { role: 'event', dateField: 'when' },
      fields: [
        { key: 'title', label: 'Remind me to', type: 'text', required: true },
        { key: 'when', label: 'When', type: 'datetime', required: true, default: () => isoDateTime(new Date(Date.now() + 3600000)) },
        { key: 'repeat', label: 'Repeats', type: 'select', options: REPEAT, default: REPEAT[0], filter: false },
        { key: 'until', label: 'Repeat until', type: 'date' },
        { key: 'remind', label: 'Alert', type: 'select', options: REMIND, default: 'At start', filter: false },
        { key: 'done', label: 'Done (stop alerts)', type: 'checkbox', filter: false },
        { key: 'notes', label: 'Notes', type: 'text' },
      ],
      views: [{ type: 'table' }, { type: 'calendar' }],
      defaultSort: { key: 'when', dir: 'asc' },
    },
    {
      id: 'blocks', name: 'Time blocks', icon: '⏱️', titleField: 'title', dateField: 'date',
      description: 'Plan focused chunks of your day, e.g. "Job applications 10:00–12:00, weekdays".',
      today: { role: 'event', dateField: 'date', timeField: 'startTime' },
      fields: [
        { key: 'title', label: 'Block', type: 'text', required: true },
        { key: 'date', label: 'Date', type: 'date', required: true, default: () => isoDate() },
        { key: 'startTime', label: 'Start', type: 'time', required: true, default: '09:00' },
        { key: 'end', label: 'End', type: 'time' },
        { key: 'category', label: 'Category', type: 'select', options: CATS },
        { key: 'repeat', label: 'Repeats', type: 'select', options: REPEAT, default: REPEAT[0], filter: false },
        { key: 'until', label: 'Repeat until', type: 'date' },
        { key: 'remind', label: 'Reminder', type: 'select', options: REMIND, default: 'None', filter: false },
        { key: 'notes', label: 'Notes', type: 'text' },
      ],
      views: [{ type: 'calendar' }, { type: 'table' }],
      defaultSort: { key: 'date', dir: 'asc' },
    },
  ],
};

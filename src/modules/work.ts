import type { ModuleDef } from '../core/types';
import { goalsCollection, today, records, round1 } from './common';
import { isoDate, startOfWeek } from '../core/util';

const PRIORITY = ['High', 'Medium', 'Low'];

function shiftHours(d: Record<string, unknown>): Record<string, unknown> {
  const p = (t: unknown) => (typeof t === 'string' && /^\d\d:\d\d/.test(t) ? +t.slice(0, 2) * 60 + +t.slice(3, 5) : null);
  const a = p(d.startTime), b = p(d.end);
  if (a === null || b === null) return {};
  const mins = ((b - a + 1440) % 1440) - (typeof d.breakMin === 'number' ? d.breakMin : 0);
  return { hours: round1(Math.max(0, mins) / 60) };
}

export const work: ModuleDef = {
  id: 'work', name: 'Work', icon: '💼', color: '#8fd694',
  description: 'Shifts and hours, tasks, projects, notes, wins, and goals toward full-time work.',
  trends: [{ collection: 'shifts', title: 'Hours worked per week', view: { type: 'chart', chart: 'bar', valueFields: ['hours'], agg: 'sum' } }],
  stat: async () => {
    const wk = isoDate(startOfWeek(new Date()));
    const hrs = (await records('work.shifts')).filter((r) => String(r.date ?? '') >= wk).reduce((n, r) => n + (Number(r.hours) || 0), 0);
    const open = (await records('work.tasks')).filter((r) => r.done !== true).length;
    return [hrs ? `${round1(hrs)}h worked this week` : '', open ? `${open} open task${open > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');
  },
  collections: [
    {
      id: 'shifts', name: 'Shifts & hours', icon: '🕘', titleField: 'date', dateField: 'date', quickAdd: ['date', 'startTime', 'end'],
      description: 'Hours are calculated from start and end time minus break.',
      derive: shiftHours,
      today: { role: 'event', dateField: 'date', timeField: 'startTime' },
      fields: [
        { key: 'date', label: 'Date', type: 'date', required: true, default: today },
        { key: 'startTime', label: 'Start', type: 'time' },
        { key: 'end', label: 'End', type: 'time' },
        { key: 'breakMin', label: 'Break', type: 'number', unit: 'min', min: 0, step: 1 },
        { key: 'hours', label: 'Hours', type: 'number', unit: 'h', min: 0, step: 0.1 },
        { key: 'job', label: 'Job', type: 'text' },
        { key: 'rate', label: 'Hourly rate', type: 'number', unit: '$', min: 0, step: 0.01 },
        { key: 'notes', label: 'Notes', type: 'text' },
      ],
      views: [{ type: 'table' }, { type: 'calendar' }, { type: 'chart', chart: 'bar', valueFields: ['hours'], agg: 'sum', label: 'Hours / week' }],
      defaultSort: { key: 'date', dir: 'desc' },
    },
    {
      id: 'tasks', name: 'Tasks', icon: '☑️', titleField: 'task', dateField: 'due', quickAdd: ['task', 'due'],
      today: { role: 'task', dateField: 'due', doneField: 'done' },
      fields: [
        { key: 'task', label: 'Task', type: 'text', required: true },
        { key: 'done', label: 'Done', type: 'checkbox' },
        { key: 'due', label: 'Due', type: 'date' },
        { key: 'priority', label: 'Priority', type: 'select', options: PRIORITY, default: 'Medium' },
        { key: 'project', label: 'Project', type: 'text' },
        { key: 'notes', label: 'Notes', type: 'longtext' },
        { key: 'tags', label: 'Tags', type: 'tags' },
      ],
      views: [{ type: 'checklist', checkField: 'done' }, { type: 'table' }, { type: 'kanban', groupBy: 'priority', label: 'By priority' }],
      defaultSort: { key: 'due', dir: 'asc' },
    },
    {
      id: 'projects', name: 'Projects', icon: '📂', titleField: 'name', dateField: 'due',
      fields: [
        { key: 'name', label: 'Project', type: 'text', required: true },
        { key: 'status', label: 'Status', type: 'select', options: ['Planned', 'Active', 'On hold', 'Done'], default: 'Planned' },
        { key: 'start', label: 'Start', type: 'date' },
        { key: 'due', label: 'Due', type: 'date' },
        { key: 'description', label: 'Description', type: 'longtext' },
        { key: 'outcome', label: 'Outcome / result', type: 'longtext' },
        { key: 'tags', label: 'Tags', type: 'tags' },
      ],
      views: [{ type: 'kanban', groupBy: 'status' }, { type: 'table' }, { type: 'cards' }],
      defaultSort: { key: 'due', dir: 'asc' },
    },
    {
      id: 'notes', name: 'Work notes', icon: '🗒️', titleField: 'title', dateField: 'date',
      fields: [
        { key: 'title', label: 'Title', type: 'text', required: true },
        { key: 'date', label: 'Date', type: 'date', default: today },
        { key: 'body', label: 'Notes', type: 'longtext' },
        { key: 'tags', label: 'Tags', type: 'tags' },
      ],
      views: [{ type: 'cards' }, { type: 'table' }],
      defaultSort: { key: 'date', dir: 'desc' },
    },
    {
      id: 'wins', name: 'Wins & accomplishments', icon: '🏆', titleField: 'win', dateField: 'date', quickAdd: ['win'],
      description: 'Log wins as they happen. Use the STAR fields so they are ready for resumes and interviews.',
      fields: [
        { key: 'win', label: 'Win', type: 'text', required: true },
        { key: 'date', label: 'Date', type: 'date', default: today },
        { key: 'situation', label: 'Situation / task', type: 'longtext' },
        { key: 'action', label: 'What I did', type: 'longtext' },
        { key: 'result', label: 'Result (numbers if possible)', type: 'longtext' },
        { key: 'skills', label: 'Skills', type: 'tags' },
        { key: 'onResume', label: 'On resume', type: 'checkbox' },
      ],
      views: [{ type: 'cards' }, { type: 'table' }],
      defaultSort: { key: 'date', dir: 'desc' },
    },
    { ...goalsCollection(), name: 'Goals toward full-time', description: 'Steps toward a full-time role: certifications, skills, hours, references.' },
  ],
};

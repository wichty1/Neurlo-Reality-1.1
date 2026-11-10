import type { ModuleDef } from '../core/types';
import { records } from './common';
import { isoDate } from '../core/util';
import { isDoneOn, dueEvery, streak } from '../core/routine';

const AREAS = ['Health', 'Mind', 'Career', 'Money', 'Relationships', 'Learning', 'Home', 'Personal'];

export const habits: ModuleDef = {
  id: 'habits', name: 'Habits & Goals', icon: '🔥', color: '#ffb347',
  description: 'Daily habits with streaks, and long-term goals broken into milestones.',
  stat: async () => {
    const t = isoDate();
    const hs = (await records('habits.habits')).filter((r) => r.active !== false && dueEvery(r, t, r.everyDays));
    const best = Math.max(0, ...hs.map((r) => streak(r, t)));
    return hs.length ? `Habits ${hs.filter((r) => isDoneOn(r, t)).length}/${hs.length} today${best ? ` · best streak ${best}` : ''}` : '';
  },
  collections: [
    {
      id: 'habits', name: 'Habits', icon: '✅', titleField: 'habit',
      description: 'Tick habits each day here or on Today. Streaks count consecutive days completed.',
      today: { role: 'routine', groupField: 'when', activeOn: (r, day) => r.active !== false && dueEvery(r, day, r.everyDays) },
      fields: [
        { key: 'habit', label: 'Habit', type: 'text', required: true, placeholder: 'e.g. Walk 20 minutes' },
        { key: 'when', label: 'Time of day', type: 'select', options: ['Morning', 'Afternoon', 'Evening', 'Anytime'], default: 'Anytime' },
        { key: 'everyDays', label: 'Repeat every (days)', type: 'number', min: 1, step: 1, default: 1, help: '1 = daily' },
        { key: 'area', label: 'Area', type: 'select', options: AREAS },
        { key: 'active', label: 'Active', type: 'checkbox', default: true, filter: false },
        { key: 'why', label: 'Why this matters', type: 'text' },
        { key: 'notes', label: 'Notes', type: 'longtext' },
      ],
      views: [{ type: 'checklist', label: 'Today' }, { type: 'table' }],
      defaultSort: { key: 'when', dir: 'asc' },
    },
    {
      id: 'goals', name: 'Long-term goals', icon: '🏔️', titleField: 'goal', dateField: 'target',
      description: 'Break each goal into milestones (next tab). Progress is shown on the overview.',
      fields: [
        { key: 'goal', label: 'Goal', type: 'text', required: true },
        { key: 'area', label: 'Area', type: 'select', options: AREAS },
        { key: 'status', label: 'Status', type: 'select', options: ['Not started', 'In progress', 'Achieved', 'Paused'], default: 'Not started' },
        { key: 'target', label: 'Target date', type: 'date' },
        { key: 'why', label: 'Why', type: 'longtext' },
        { key: 'notes', label: 'Notes', type: 'longtext' },
        { key: 'tags', label: 'Tags', type: 'tags' },
      ],
      views: [{ type: 'cards' }, { type: 'kanban', groupBy: 'status', label: 'Board' }, { type: 'table' }],
      defaultSort: { key: 'target', dir: 'asc' },
    },
    {
      id: 'milestones', name: 'Milestones', icon: '🚩', titleField: 'milestone', dateField: 'due', quickAdd: ['milestone', 'goal', 'due'],
      description: 'Milestones with a due date show on Today until done.',
      today: { role: 'task', dateField: 'due', doneField: 'done' },
      fields: [
        { key: 'milestone', label: 'Milestone', type: 'text', required: true },
        { key: 'goal', label: 'Goal', type: 'text', suggestFrom: 'habits.goals.goal', help: 'Type or pick the goal name exactly' },
        { key: 'due', label: 'Due', type: 'date' },
        { key: 'done', label: 'Done', type: 'checkbox' },
        { key: 'notes', label: 'Notes', type: 'text' },
      ],
      views: [{ type: 'checklist', checkField: 'done' }, { type: 'table' }],
      defaultSort: { key: 'due', dir: 'asc' },
    },
  ],
};

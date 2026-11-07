import type { ModuleDef } from '../core/types';
import { isoDate, isoTime, isoDateTime } from '../core/util';
import { avgRecent, round1 } from './common';

const EMOTIONS = ['calm', 'happy', 'grateful', 'excited', 'proud', 'loved', 'focused', 'tired', 'bored',
  'anxious', 'stressed', 'sad', 'lonely', 'angry', 'frustrated', 'overwhelmed', 'hopeful', 'content'];

export const mind: ModuleDef = {
  id: 'mind',
  name: 'Mind & Feelings',
  icon: '💭',
  color: '#ff9ecf',
  description: 'Mood and energy, journal, stress triggers, gratitude, reflection and weekly reviews.',
  trends: [
    { collection: 'mood', title: 'Mood & energy', view: { type: 'chart', chart: 'line', valueFields: ['mood', 'energy'], agg: 'avg' } },
    { collection: 'mood', title: 'Mood heatmap', view: { type: 'chart', chart: 'heatmap', valueFields: ['mood'], agg: 'avg' } },
  ],
  stat: async () => {
    const m = await avgRecent('mind.mood', 'mood', 'date');
    return m !== null ? `Mood avg ${round1(m)}/10 (7d)` : '';
  },
  collections: [
    {
      id: 'mood', name: 'Mood log', icon: '🙂', titleField: 'date', dateField: 'date',
      description: 'A 10-second check-in: how you feel and how much energy you have.',
      quickAdd: ['mood', 'energy'],
      today: { role: 'mood', dateField: 'date', ratingFields: ['mood', 'energy'], tagsField: 'emotions' },
      fields: [
        { key: 'date', label: 'Date', type: 'date', required: true, default: () => isoDate() },
        { key: 'time', label: 'Time', type: 'time', default: () => isoTime() },
        { key: 'mood', label: 'Mood', type: 'rating', required: true },
        { key: 'energy', label: 'Energy', type: 'rating' },
        { key: 'emotions', label: 'Emotions', type: 'multiselect', options: EMOTIONS },
        { key: 'note', label: 'Note', type: 'longtext' },
        { key: 'tags', label: 'Tags', type: 'tags' },
      ],
      views: [{ type: 'table' }, { type: 'chart', chart: 'line', valueFields: ['mood', 'energy'], agg: 'avg', label: 'Trend' },
        { type: 'chart', chart: 'heatmap', valueFields: ['mood'], agg: 'avg', label: 'Heatmap' }],
      defaultSort: { key: 'date', dir: 'desc' },
    },
    {
      id: 'journal', name: 'Journal', icon: '📓', titleField: 'title', dateField: 'date',
      fields: [
        { key: 'title', label: 'Title', type: 'text', required: true },
        { key: 'date', label: 'Date', type: 'date', default: () => isoDate() },
        { key: 'body', label: 'Entry', type: 'longtext' },
        { key: 'tags', label: 'Tags', type: 'tags' },
      ],
      views: [{ type: 'cards' }, { type: 'table' }],
      defaultSort: { key: 'date', dir: 'desc' },
    },
    {
      id: 'triggers', name: 'Stress triggers', icon: '⚡', titleField: 'trigger', dateField: 'when',
      fields: [
        { key: 'trigger', label: 'Trigger', type: 'text', required: true },
        { key: 'when', label: 'When', type: 'datetime', default: () => isoDateTime() },
        { key: 'intensity', label: 'Intensity', type: 'rating' },
        { key: 'response', label: 'How I responded', type: 'longtext' },
        { key: 'helped', label: 'What helped', type: 'text' },
        { key: 'tags', label: 'Tags', type: 'tags' },
      ],
      views: [{ type: 'table' }, { type: 'cards' }],
      defaultSort: { key: 'when', dir: 'desc' },
    },
    {
      id: 'gratitude', name: 'Gratitude', icon: '🙏', titleField: 'item', dateField: 'date',
      fields: [
        { key: 'item', label: 'Grateful for', type: 'text', required: true },
        { key: 'date', label: 'Date', type: 'date', default: () => isoDate() },
        { key: 'tags', label: 'Tags', type: 'tags' },
      ],
      views: [{ type: 'table' }, { type: 'cards' }],
      defaultSort: { key: 'date', dir: 'desc' },
    },
    {
      id: 'reflection', name: 'Therapy & reflection', icon: '🪞', titleField: 'title', dateField: 'date',
      fields: [
        { key: 'title', label: 'Topic', type: 'text', required: true },
        { key: 'date', label: 'Date', type: 'date', default: () => isoDate() },
        { key: 'kind', label: 'Type', type: 'select', options: ['Therapy session', 'Self reflection', 'Insight'] },
        { key: 'notes', label: 'Notes', type: 'longtext' },
        { key: 'actions', label: 'Things to try', type: 'longtext' },
        { key: 'tags', label: 'Tags', type: 'tags' },
      ],
      views: [{ type: 'cards' }, { type: 'table' }],
      defaultSort: { key: 'date', dir: 'desc' },
    },
    {
      id: 'weekly', name: 'Weekly review', icon: '🗓️', titleField: 'week', dateField: 'week',
      fields: [
        { key: 'week', label: 'Week of', type: 'date', required: true, default: () => isoDate() },
        { key: 'rating', label: 'Overall week', type: 'rating' },
        { key: 'wins', label: 'Wins', type: 'longtext' },
        { key: 'hard', label: 'What was hard', type: 'longtext' },
        { key: 'learned', label: 'What I learned', type: 'longtext' },
        { key: 'next', label: 'Focus for next week', type: 'longtext' },
      ],
      views: [{ type: 'cards' }, { type: 'table' }],
      defaultSort: { key: 'week', dir: 'desc' },
    },
  ],
};

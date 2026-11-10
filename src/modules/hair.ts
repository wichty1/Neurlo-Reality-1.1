import type { ModuleDef } from '../core/types';
import { goalsCollection, routineCollection, today, routineProgress, records } from './common';
import { productsCollection } from './skin';
import { nextDue } from '../core/routine';
import { fmtDate, isoDate } from '../core/util';

export const hair: ModuleDef = {
  id: 'hair', name: 'Hair Care', icon: '💇', color: '#c9a27e',
  description: 'Wash schedule and routine, products, treatments and cuts, scalp and hair condition.',
  trends: [
    { collection: 'condition', title: 'Hair & scalp condition', view: { type: 'chart', chart: 'line', valueFields: ['hair', 'scalp'], agg: 'avg' } },
  ],
  stat: async () => {
    const p = await routineProgress('hair.routine');
    const wash = (await records('hair.routine')).filter((r) => r.when === 'Wash day' && r.active !== false);
    const next = wash.map((r) => nextDue(r, r.everyDays)).sort()[0];
    const washTxt = next ? (next === isoDate() ? 'Wash day today' : `Next wash ${fmtDate(next)}`) : '';
    return [washTxt, p.total ? `Routine ${p.done}/${p.total}` : ''].filter(Boolean).join(' · ');
  },
  collections: [
    routineCollection({ groups: ['Wash day', 'Daily', 'Weekly', 'Night'], groupLabel: 'When',
      description: 'Your hair steps. For your wash schedule, add "Wash day" steps with "repeat every" set to your wash interval (e.g. 3 days).' }),
    productsCollection(['Shampoo', 'Conditioner', 'Leave-in', 'Oil', 'Styling', 'Mask', 'Scalp treatment', 'Heat protectant', 'Other']),
    {
      id: 'treatments', name: 'Treatments & haircuts', icon: '✂️', titleField: 'what', dateField: 'date',
      fields: [
        { key: 'what', label: 'What', type: 'text', required: true, placeholder: 'e.g. Haircut, Deep condition, Color' },
        { key: 'date', label: 'Date', type: 'date', default: today },
        { key: 'kind', label: 'Type', type: 'select', options: ['Haircut', 'Color', 'Treatment', 'Styling', 'Other'] },
        { key: 'where', label: 'Salon / who', type: 'text' },
        { key: 'cost', label: 'Cost', type: 'number', unit: '$', min: 0, step: 0.01 },
        { key: 'rating', label: 'Result', type: 'rating' },
        { key: 'notes', label: 'Notes (style, length, what to ask next time)', type: 'longtext' },
      ],
      views: [{ type: 'table' }, { type: 'cards' }],
      defaultSort: { key: 'date', dir: 'desc' },
    },
    {
      id: 'condition', name: 'Scalp & hair log', icon: '🔎', titleField: 'date', dateField: 'date', quickAdd: ['date', 'hair', 'scalp'],
      fields: [
        { key: 'date', label: 'Date', type: 'date', required: true, default: today },
        { key: 'hair', label: 'Hair condition', type: 'rating', required: true },
        { key: 'scalp', label: 'Scalp condition', type: 'rating' },
        { key: 'issues', label: 'Issues', type: 'multiselect', options: ['Dry', 'Oily', 'Itchy', 'Flakes', 'Frizz', 'Breakage', 'Shedding', 'Split ends'] },
        { key: 'notes', label: 'Notes', type: 'longtext' },
        { key: 'tags', label: 'Tags', type: 'tags' },
      ],
      views: [{ type: 'table' }, { type: 'chart', chart: 'line', valueFields: ['hair', 'scalp'], label: 'Trend' }],
      defaultSort: { key: 'date', dir: 'desc' },
    },
    goalsCollection(),
  ],
};

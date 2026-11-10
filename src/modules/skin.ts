import type { ModuleDef, Collection } from '../core/types';
import { goalsCollection, routineCollection, today, routineProgress, records } from './common';
import { isoDate, addDays } from '../core/util';

const AREAS = ['Forehead', 'Nose', 'Cheeks', 'Chin', 'Jawline', 'Neck', 'Back', 'Chest', 'Body'];

export function productsCollection(categories: string[]): Collection {
  return {
    id: 'products', name: 'Products', icon: '🧴', titleField: 'name', dateField: 'opened', quickAdd: ['name', 'brand'],
    fields: [
      { key: 'name', label: 'Product', type: 'text', required: true },
      { key: 'brand', label: 'Brand', type: 'text' },
      { key: 'category', label: 'Category', type: 'select', options: categories },
      { key: 'inUse', label: 'In use', type: 'checkbox', default: true },
      { key: 'opened', label: 'Opened', type: 'date' },
      { key: 'expiry', label: 'Expires', type: 'date' },
      { key: 'rating', label: 'Rating', type: 'rating' },
      { key: 'price', label: 'Price', type: 'number', unit: '$', min: 0, step: 0.01 },
      { key: 'ingredients', label: 'Key ingredients', type: 'text' },
      { key: 'notes', label: 'Notes', type: 'longtext' },
      { key: 'tags', label: 'Tags', type: 'tags' },
    ],
    views: [{ type: 'cards' }, { type: 'table' }],
    defaultSort: { key: 'expiry', dir: 'asc' },
  };
}

export async function expiringSoon(store: string, days = 30): Promise<number> {
  const limit = isoDate(addDays(new Date(), days));
  return (await records(store)).filter((r) => r.inUse !== false && typeof r.expiry === 'string' && r.expiry && r.expiry <= limit).length;
}

export const skin: ModuleDef = {
  id: 'skin', name: 'Skin Care', icon: '🧖', color: '#ffc58a',
  description: 'AM/PM routines, product inventory, skin condition and reactions.',
  trends: [
    { collection: 'condition', title: 'Skin condition', view: { type: 'chart', chart: 'line', valueFields: ['overall', 'hydration'], agg: 'avg' } },
  ],
  stat: async () => {
    const p = await routineProgress('skin.routine');
    const exp = await expiringSoon('skin.products');
    return [p.total ? `Routine ${p.done}/${p.total} today` : '', exp ? `${exp} product${exp > 1 ? 's' : ''} expiring soon` : ''].filter(Boolean).join(' · ');
  },
  collections: [
    routineCollection({ groups: ['AM', 'PM'], groupLabel: 'AM or PM', description: 'Your AM and PM steps. Set "repeat every" to 7 for weekly treatments like masks or exfoliation.' }),
    productsCollection(['Cleanser', 'Toner', 'Serum', 'Moisturizer', 'Sunscreen', 'Treatment', 'Mask', 'Exfoliant', 'Eye', 'Lip', 'Body', 'Other']),
    {
      id: 'condition', name: 'Condition log', icon: '🔎', titleField: 'date', dateField: 'date', quickAdd: ['date', 'overall'],
      fields: [
        { key: 'date', label: 'Date', type: 'date', required: true, default: today },
        { key: 'overall', label: 'Overall skin', type: 'rating', required: true },
        { key: 'hydration', label: 'Hydration', type: 'rating' },
        { key: 'oiliness', label: 'Oiliness', type: 'rating' },
        { key: 'breakouts', label: 'Breakout count', type: 'number', min: 0, step: 1 },
        { key: 'areas', label: 'Problem areas', type: 'multiselect', options: AREAS },
        { key: 'notes', label: 'Notes', type: 'longtext' },
        { key: 'tags', label: 'Tags', type: 'tags' },
      ],
      views: [{ type: 'table' }, { type: 'chart', chart: 'line', valueFields: ['overall', 'hydration', 'oiliness'], label: 'Trend' }, { type: 'chart', chart: 'heatmap', valueFields: ['overall'], label: 'Heatmap' }],
      defaultSort: { key: 'date', dir: 'desc' },
    },
    {
      id: 'reactions', name: 'Reactions & breakouts', icon: '⚠️', titleField: 'what', dateField: 'date', quickAdd: ['what', 'cause'],
      fields: [
        { key: 'what', label: 'What happened', type: 'text', required: true },
        { key: 'date', label: 'Date', type: 'date', default: today },
        { key: 'areas', label: 'Where', type: 'multiselect', options: AREAS },
        { key: 'severity', label: 'Severity', type: 'rating' },
        { key: 'cause', label: 'Suspected cause', type: 'text', placeholder: 'product, food, stress, sleep…' },
        { key: 'product', label: 'Product involved', type: 'text' },
        { key: 'resolved', label: 'Resolved', type: 'checkbox' },
        { key: 'notes', label: 'Notes', type: 'longtext' },
      ],
      views: [{ type: 'table' }, { type: 'cards' }],
      defaultSort: { key: 'date', dir: 'desc' },
    },
    goalsCollection(),
  ],
};

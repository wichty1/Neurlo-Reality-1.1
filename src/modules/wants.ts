import type { ModuleDef, Collection, Field } from '../core/types';
import { STATUS, records } from './common';

function statusCollection(id: string, name: string, icon: string, title: Field, extra: Field[], description?: string): Collection {
  return {
    id, name, icon, titleField: title.key, description,
    fields: [title, { key: 'status', label: 'Status', type: 'select', options: STATUS, default: 'Idea' }, ...extra,
      { key: 'notes', label: 'Notes', type: 'longtext' }, { key: 'tags', label: 'Tags', type: 'tags' }],
    views: [{ type: 'kanban', groupBy: 'status', label: 'Board' }, { type: 'table' }, { type: 'cards' }],
    defaultSort: { key: 'updatedAt', dir: 'desc' },
  };
}

const PRIORITY: Field = { key: 'priority', label: 'Priority', type: 'select', options: ['High', 'Medium', 'Low'], default: 'Medium' };

export const wants: ModuleDef = {
  id: 'wants', name: 'Wants & Wishes', icon: '✨', color: '#b59cff',
  description: 'Wishlist, goals, bucket list, dreams and ideas, and things to learn.',
  stat: async () => {
    const wish = (await records('wants.wishlist')).filter((r) => r.status !== 'Done');
    const total = wish.reduce((n, r) => n + (Number(r.cost) || 0), 0);
    const active = (await Promise.all(['goals', 'bucket', 'learn'].map((c) => records(`wants.${c}`)))).flat().filter((r) => r.status === 'In progress').length;
    return [wish.length ? `${wish.length} on wishlist${total ? ` (~$${Math.round(total)})` : ''}` : '', active ? `${active} in progress` : ''].filter(Boolean).join(' · ');
  },
  collections: [
    statusCollection('wishlist', 'Wishlist', '🎁', { key: 'item', label: 'Item', type: 'text', required: true }, [
      PRIORITY,
      { key: 'cost', label: 'Estimated cost', type: 'number', unit: '$', min: 0, step: 0.01 },
      { key: 'link', label: 'Link', type: 'url' },
      { key: 'by', label: 'Want by', type: 'date' },
    ]),
    statusCollection('goals', 'Goals', '🎯', { key: 'goal', label: 'Goal', type: 'text', required: true }, [
      PRIORITY, { key: 'target', label: 'Target date', type: 'date' }, { key: 'why', label: 'Why it matters', type: 'text' },
    ]),
    statusCollection('bucket', 'Bucket list', '🪣', { key: 'item', label: 'Experience', type: 'text', required: true }, [
      { key: 'category', label: 'Category', type: 'select', options: ['Travel', 'Adventure', 'Creative', 'Personal', 'Career', 'Other'] },
      { key: 'when', label: 'Hoping for', type: 'text', placeholder: 'e.g. Summer 2027' },
      { key: 'cost', label: 'Estimated cost', type: 'number', unit: '$', min: 0, step: 1 },
    ]),
    statusCollection('dreams', 'Dreams & ideas', '💡', { key: 'idea', label: 'Idea', type: 'text', required: true }, [],
      'Anything you might want to do someday. Move it along the board when it becomes real.'),
    statusCollection('learn', 'Things to learn', '📚', { key: 'skill', label: 'Skill / topic', type: 'text', required: true }, [
      PRIORITY, { key: 'resource', label: 'Resource', type: 'text' }, { key: 'link', label: 'Link', type: 'url' },
      { key: 'progress', label: 'Progress', type: 'rating' },
    ]),
  ],
};

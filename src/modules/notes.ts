import type { ModuleDef } from '../core/types';

export const notes: ModuleDef = {
  id: 'notes',
  name: 'Notes',
  icon: '📝',
  color: '#c7a6ff',
  description: 'Free-form notes with tags and search.',
  collections: [
    {
      id: 'notes',
      name: 'Notes',
      icon: '📝',
      titleField: 'title',
      pinField: 'pinned',
      description: 'Pinned notes stay at the top. Use tags and search to find anything.',
      fields: [
        { key: 'title', label: 'Title', type: 'text', required: true },
        { key: 'body', label: 'Note', type: 'longtext' },
        { key: 'tags', label: 'Tags', type: 'tags' },
        { key: 'pinned', label: 'Pinned', type: 'checkbox' },
        { key: 'notebook', label: 'Notebook', type: 'text', suggestFrom: 'notes.notes.notebook', filter: false },
      ],
      views: [{ type: 'cards' }, { type: 'table' }],
      defaultSort: { key: 'updatedAt', dir: 'desc' },
    },
  ],
};

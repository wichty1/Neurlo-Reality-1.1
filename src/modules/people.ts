import type { ModuleDef, DBRecord } from '../core/types';
import { today, records } from './common';
import { isoDate, addDays, parseLocal } from '../core/util';

/** Birthday falls on `day` (Feb 29 birthdays are shown on Feb 28 in non-leap years). */
export function birthdayOn(r: DBRecord, day: string): boolean {
  const b = typeof r.birthday === 'string' ? r.birthday : '';
  if (!b) return false;
  const md = b.slice(5, 10), dmd = day.slice(5, 10);
  if (md === dmd) return true;
  const y = +day.slice(0, 4);
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return md === '02-29' && dmd === '02-28' && !leap;
}

/** Days since last contact is at least the chosen "keep in touch" interval. */
export function needsCatchUp(r: DBRecord, t = isoDate()): boolean {
  const every = Number(r.every);
  if (!every || every < 1) return false;
  const last = typeof r.lastContacted === 'string' ? r.lastContacted : '';
  if (!last) return true;
  return isoDate(addDays(parseLocal(last)!, every)) <= t;
}

export const people: ModuleDef = {
  id: 'people', name: 'People', icon: '👥', color: '#ff9f7a',
  description: 'Contacts, birthdays, last-contacted dates and relationship notes.',
  stat: async () => {
    const t = isoDate();
    const recs = await records('people.contacts');
    let soon = 0;
    for (let i = 0; i < 14; i++) { const d = isoDate(addDays(new Date(), i)); soon += recs.filter((r) => birthdayOn(r, d)).length; }
    const catchUp = recs.filter((r) => needsCatchUp(r, t)).length;
    return [soon ? `${soon} birthday${soon > 1 ? 's' : ''} in 2 weeks` : '', catchUp ? `${catchUp} to catch up with` : ''].filter(Boolean).join(' · ');
  },
  collections: [
    {
      id: 'contacts', name: 'Contacts & birthdays', icon: '🎂', titleField: 'name', dateField: 'lastContacted', quickAdd: ['name', 'relationship'],
      description: 'Birthdays appear on Today and in the calendar. Set "keep in touch every" to get catch-up nudges on the People overview.',
      today: { role: 'event', dateField: 'birthday', occursOn: birthdayOn },
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true },
        { key: 'relationship', label: 'Relationship', type: 'select', options: ['Family', 'Partner', 'Friend', 'Colleague', 'Mentor', 'Neighbor', 'Other'] },
        { key: 'birthday', label: 'Birthday', type: 'date', help: 'If you do not know the year, any year works.' },
        { key: 'phone', label: 'Phone', type: 'text' },
        { key: 'email', label: 'Email', type: 'text' },
        { key: 'address', label: 'Address', type: 'text' },
        { key: 'lastContacted', label: 'Last contacted', type: 'date' },
        { key: 'every', label: 'Keep in touch every', type: 'number', unit: 'days', min: 1, step: 1 },
        { key: 'likes', label: 'Likes / gift ideas', type: 'text' },
        { key: 'notes', label: 'Relationship notes', type: 'longtext' },
        { key: 'tags', label: 'Tags', type: 'tags' },
      ],
      views: [{ type: 'cards' }, { type: 'table' }, { type: 'calendar', label: 'Birthdays' }],
      defaultSort: { key: 'name', dir: 'asc' },
    },
    {
      id: 'interactions', name: 'Interactions', icon: '💬', titleField: 'person', dateField: 'date', quickAdd: ['person', 'kind'],
      fields: [
        { key: 'person', label: 'Who', type: 'text', required: true, suggestFrom: 'people.contacts.name' },
        { key: 'date', label: 'Date', type: 'date', default: today },
        { key: 'kind', label: 'How', type: 'select', options: ['Call', 'Text', 'Video', 'In person', 'Email', 'Letter / card'] },
        { key: 'notes', label: 'What we talked about', type: 'longtext' },
        { key: 'followUp', label: 'Remember for next time', type: 'text' },
      ],
      views: [{ type: 'table' }, { type: 'chart', chart: 'bar', agg: 'count', label: 'Per week' }],
      defaultSort: { key: 'date', dir: 'desc' },
    },
  ],
};

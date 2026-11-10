import type { ModuleDef } from '../core/types';
import { today, records } from './common';
import { isoDate, startOfWeek, isoDateTime } from '../core/util';
import { REMIND } from '../core/recur';

export const STAGES = ['Researching', 'Applied', 'Phone screen', 'Interview', 'Offer', 'Rejected', 'Withdrawn'];
const SECTORS = ['Congressional', 'Federal', 'Legal', 'Nonprofit', 'Private', 'Other'];

export const jobs: ModuleDef = {
  id: 'jobs', name: 'Job Search', icon: '🔍', color: '#ffd166',
  description: 'Pipeline, applications, networking and outreach, interview prep, and resume versions.',
  trends: [{ collection: 'applications', title: 'Applications per week', view: { type: 'chart', chart: 'bar', agg: 'count' } }],
  stat: async () => {
    const wk = isoDate(startOfWeek(new Date())), t = isoDate();
    const apps = (await records('jobs.applications')).filter((r) => String(r.dateApplied ?? '') >= wk).length;
    const fu = (await records('jobs.contacts')).filter((r) => r.followedUp !== true && r.followUp && String(r.followUp) <= t).length
      + (await records('jobs.applications')).filter((r) => r.nextDone !== true && r.nextDue && String(r.nextDue) <= t).length;
    return [`${apps} application${apps === 1 ? '' : 's'} this week`, fu ? `${fu} follow-up${fu > 1 ? 's' : ''} due` : ''].filter(Boolean).join(' · ');
  },
  collections: [
    {
      id: 'applications', name: 'Applications', icon: '📨', titleField: 'company', dateField: 'dateApplied', quickAdd: ['company', 'role'],
      description: 'Drag cards between stages on the board, or use the "move to" menu on each card.',
      today: { role: 'task', dateField: 'nextDue', doneField: 'nextDone' },
      fields: [
        { key: 'company', label: 'Company / office', type: 'text', required: true },
        { key: 'role', label: 'Role', type: 'text' },
        { key: 'status', label: 'Stage', type: 'select', options: STAGES, default: 'Researching' },
        { key: 'sector', label: 'Sector', type: 'select', options: SECTORS },
        { key: 'location', label: 'Location', type: 'text' },
        { key: 'link', label: 'Posting link', type: 'url' },
        { key: 'dateApplied', label: 'Date applied', type: 'date' },
        { key: 'salary', label: 'Salary / grade', type: 'text', placeholder: 'e.g. $65k or GS-9' },
        { key: 'nextStep', label: 'Next step', type: 'text' },
        { key: 'nextDue', label: 'Next step due', type: 'date' },
        { key: 'nextDone', label: 'Next step done', type: 'checkbox', filter: false },
        { key: 'contact', label: 'Contact', type: 'text' },
        { key: 'resume', label: 'Resume version used', type: 'text' },
        { key: 'notes', label: 'Notes', type: 'longtext' },
        { key: 'tags', label: 'Tags', type: 'tags' },
      ],
      views: [{ type: 'kanban', groupBy: 'status', label: 'Pipeline' }, { type: 'table' },
        { type: 'chart', chart: 'bar', agg: 'count', label: 'Per week' }],
      defaultSort: { key: 'dateApplied', dir: 'desc' },
    },
    {
      id: 'contacts', name: 'Networking contacts', icon: '🤝', titleField: 'name', dateField: 'lastContact', quickAdd: ['name', 'org'],
      description: 'People to reach out to. Set a follow-up date and it shows on Today when due.',
      today: { role: 'task', dateField: 'followUp', doneField: 'followedUp' },
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true },
        { key: 'org', label: 'Office / organization', type: 'text' },
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'sector', label: 'Sector', type: 'select', options: SECTORS },
        { key: 'status', label: 'Status', type: 'select', options: ['To reach out', 'Contacted', 'Replied', 'Meeting set', 'Ongoing', 'Not now'], default: 'To reach out' },
        { key: 'email', label: 'Email', type: 'text' },
        { key: 'phone', label: 'Phone', type: 'text' },
        { key: 'profile', label: 'Profile link', type: 'url' },
        { key: 'howMet', label: 'How we are connected', type: 'text' },
        { key: 'lastContact', label: 'Last contacted', type: 'date' },
        { key: 'followUp', label: 'Follow up on', type: 'date' },
        { key: 'followedUp', label: 'Followed up', type: 'checkbox', filter: false },
        { key: 'notes', label: 'Notes', type: 'longtext' },
        { key: 'tags', label: 'Tags', type: 'tags' },
      ],
      views: [{ type: 'table' }, { type: 'kanban', groupBy: 'status', label: 'Outreach board' }, { type: 'cards' }],
      defaultSort: { key: 'followUp', dir: 'asc' },
    },
    {
      id: 'outreach', name: 'Outreach log', icon: '✉️', titleField: 'contact', dateField: 'date', quickAdd: ['contact', 'method'],
      fields: [
        { key: 'contact', label: 'Who', type: 'text', required: true },
        { key: 'date', label: 'Date', type: 'date', default: today },
        { key: 'method', label: 'Method', type: 'select', options: ['Email', 'LinkedIn', 'Phone', 'Coffee chat', 'Event', 'Referral ask', 'Thank-you note'] },
        { key: 'summary', label: 'What I sent / discussed', type: 'longtext' },
        { key: 'response', label: 'Response', type: 'select', options: ['Waiting', 'Replied', 'No reply', 'Positive', 'Declined'], default: 'Waiting' },
        { key: 'tags', label: 'Tags', type: 'tags' },
      ],
      views: [{ type: 'table' }, { type: 'chart', chart: 'bar', agg: 'count', label: 'Per week' }],
      defaultSort: { key: 'date', dir: 'desc' },
    },
    {
      id: 'interviews', name: 'Interview prep', icon: '🎤', titleField: 'company', dateField: 'when',
      today: { role: 'event', dateField: 'when' },
      fields: [
        { key: 'company', label: 'Company / office', type: 'text', required: true },
        { key: 'role', label: 'Role', type: 'text' },
        { key: 'when', label: 'Interview time', type: 'datetime', default: () => isoDateTime() },
        { key: 'kind', label: 'Type', type: 'select', options: ['Phone screen', 'Video', 'In person', 'Panel', 'Writing test', 'Final'] },
        { key: 'remind', label: 'Reminder', type: 'select', options: REMIND, default: '1 hour before', filter: false },
        { key: 'interviewers', label: 'Interviewers', type: 'text' },
        { key: 'research', label: 'Research notes', type: 'longtext' },
        { key: 'questions', label: 'Likely questions & my answers', type: 'longtext' },
        { key: 'stories', label: 'Stories to tell (see Work › Wins)', type: 'longtext' },
        { key: 'askThem', label: 'Questions to ask them', type: 'longtext' },
        { key: 'reflection', label: 'How it went', type: 'longtext' },
        { key: 'thanked', label: 'Thank-you sent', type: 'checkbox', filter: false },
      ],
      views: [{ type: 'cards' }, { type: 'table' }, { type: 'calendar' }],
      defaultSort: { key: 'when', dir: 'desc' },
    },
    {
      id: 'documents', name: 'Resume & cover letters', icon: '📄', titleField: 'name', dateField: 'date',
      description: 'Track versions and where each file lives on your device. Files themselves are not stored here.',
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Resume – Hill v3' },
        { key: 'kind', label: 'Type', type: 'select', options: ['Resume', 'Cover letter', 'Writing sample', 'References', 'Federal resume'], default: 'Resume' },
        { key: 'version', label: 'Version', type: 'text' },
        { key: 'date', label: 'Updated', type: 'date', default: today },
        { key: 'target', label: 'Tailored for', type: 'text' },
        { key: 'location', label: 'File location', type: 'text', placeholder: 'e.g. Documents/Jobs/resume-v3.pdf' },
        { key: 'changes', label: 'What changed', type: 'longtext' },
        { key: 'current', label: 'Current version', type: 'checkbox', filter: false },
      ],
      views: [{ type: 'table' }, { type: 'cards' }],
      defaultSort: { key: 'date', dir: 'desc' },
    },
  ],
};

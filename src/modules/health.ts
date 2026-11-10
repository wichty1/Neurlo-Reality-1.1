import type { ModuleDef } from '../core/types';
import { isoDate, isoDateTime } from '../core/util';
import { goalsCollection, today, avgRecent, routineProgress, round1 } from './common';

const TIMES = ['Morning', 'Midday', 'Evening', 'Bedtime', 'As needed'];

/** Hours between bedtime and wake time (crosses midnight). */
function sleepHours(d: Record<string, unknown>): Record<string, unknown> {
  const p = (t: unknown) => (typeof t === 'string' && /^\d\d:\d\d/.test(t) ? +t.slice(0, 2) * 60 + +t.slice(3, 5) : null);
  const bed = p(d.bedtime), wake = p(d.wake);
  if (bed === null || wake === null) return {};
  return { hours: round1((((wake - bed) % 1440) + 1440) % 1440 / 60) };
}

export const health: ModuleDef = {
  id: 'health', name: 'Health', icon: '❤️', color: '#ff7a8a',
  description: 'Sleep, exercise, body metrics, vitals, nutrition, symptoms, meds, appointments and labs.',
  trends: [
    { collection: 'sleep', title: 'Sleep (hours)', view: { type: 'chart', chart: 'line', valueFields: ['hours'], agg: 'sum' } },
    { collection: 'body', title: 'Weight', view: { type: 'chart', chart: 'line', valueFields: ['weight'], agg: 'avg' } },
    { collection: 'workouts', title: 'Exercise minutes per week', view: { type: 'chart', chart: 'bar', valueFields: ['duration'], agg: 'sum' } },
  ],
  stat: async () => {
    const s = await avgRecent('health.sleep', 'hours', 'date');
    const m = await routineProgress('health.meds');
    const parts = [s !== null ? `Sleep avg ${round1(s)}h (7d)` : '', m.total ? `Meds ${m.done}/${m.total} today` : ''].filter(Boolean);
    return parts.join(' · ');
  },
  collections: [
    {
      id: 'sleep', name: 'Sleep', icon: '😴', titleField: 'date', dateField: 'date', quickAdd: ['date', 'hours', 'quality'],
      description: 'Log the night by the date you woke up. Hours are calculated from bedtime and wake time when both are set.',
      derive: sleepHours,
      fields: [
        { key: 'date', label: 'Date (woke up)', type: 'date', required: true, default: today },
        { key: 'bedtime', label: 'Bedtime', type: 'time' },
        { key: 'wake', label: 'Wake time', type: 'time' },
        { key: 'hours', label: 'Hours slept', type: 'number', unit: 'h', min: 0, max: 24, step: 0.1 },
        { key: 'quality', label: 'Quality', type: 'rating' },
        { key: 'wakeups', label: 'Times woke up', type: 'number', min: 0, step: 1 },
        { key: 'notes', label: 'Notes', type: 'longtext' },
        { key: 'tags', label: 'Tags', type: 'tags' },
      ],
      views: [{ type: 'table' }, { type: 'chart', chart: 'line', valueFields: ['hours', 'quality'], label: 'Trend' }, { type: 'chart', chart: 'heatmap', valueFields: ['hours'], label: 'Heatmap' }],
      defaultSort: { key: 'date', dir: 'desc' },
    },
    {
      id: 'workouts', name: 'Exercise', icon: '🏃', titleField: 'activity', dateField: 'date', quickAdd: ['activity', 'duration'],
      fields: [
        { key: 'activity', label: 'Activity', type: 'text', required: true, placeholder: 'e.g. Run, Push day' },
        { key: 'date', label: 'Date', type: 'date', default: today },
        { key: 'kind', label: 'Type', type: 'select', options: ['Cardio', 'Strength', 'Mobility', 'Sport', 'Walk', 'Other'] },
        { key: 'duration', label: 'Duration', type: 'duration' },
        { key: 'distance', label: 'Distance', type: 'number', unit: 'km', min: 0, step: 0.01 },
        { key: 'intensity', label: 'Intensity', type: 'rating' },
        { key: 'details', label: 'Sets / details', type: 'longtext' },
        { key: 'tags', label: 'Tags', type: 'tags' },
      ],
      views: [{ type: 'table' }, { type: 'chart', chart: 'bar', valueFields: ['duration'], agg: 'sum', label: 'Minutes / week' }, { type: 'chart', chart: 'heatmap', agg: 'count', label: 'Heatmap' }],
      defaultSort: { key: 'date', dir: 'desc' },
    },
    {
      id: 'body', name: 'Body metrics', icon: '⚖️', titleField: 'date', dateField: 'date', quickAdd: ['date', 'weight'],
      fields: [
        { key: 'date', label: 'Date', type: 'date', required: true, default: today },
        { key: 'weight', label: 'Weight', type: 'number', unit: 'lb', min: 0, step: 0.1 },
        { key: 'bodyFat', label: 'Body fat', type: 'number', unit: '%', min: 0, max: 100, step: 0.1 },
        { key: 'waist', label: 'Waist', type: 'number', unit: 'in', min: 0, step: 0.1 },
        { key: 'chest', label: 'Chest', type: 'number', unit: 'in', min: 0, step: 0.1 },
        { key: 'hips', label: 'Hips', type: 'number', unit: 'in', min: 0, step: 0.1 },
        { key: 'notes', label: 'Notes', type: 'longtext' },
      ],
      views: [{ type: 'table' }, { type: 'chart', chart: 'line', valueFields: ['weight'], label: 'Weight' }, { type: 'chart', chart: 'line', valueFields: ['waist', 'chest', 'hips'], label: 'Measurements' }],
      defaultSort: { key: 'date', dir: 'desc' },
    },
    {
      id: 'vitals', name: 'Vitals', icon: '🩺', titleField: 'when', dateField: 'when',
      fields: [
        { key: 'when', label: 'When', type: 'datetime', required: true, default: () => isoDateTime() },
        { key: 'systolic', label: 'Blood pressure (systolic)', type: 'number', unit: 'mmHg', min: 0, step: 1 },
        { key: 'diastolic', label: 'Blood pressure (diastolic)', type: 'number', unit: 'mmHg', min: 0, step: 1 },
        { key: 'heartRate', label: 'Resting heart rate', type: 'number', unit: 'bpm', min: 0, step: 1 },
        { key: 'temp', label: 'Temperature', type: 'number', unit: '°F', step: 0.1 },
        { key: 'spo2', label: 'Oxygen (SpO₂)', type: 'number', unit: '%', min: 0, max: 100, step: 1 },
        { key: 'glucose', label: 'Blood glucose', type: 'number', unit: 'mg/dL', min: 0, step: 1 },
        { key: 'notes', label: 'Notes', type: 'text' },
      ],
      views: [{ type: 'table' }, { type: 'chart', chart: 'line', valueFields: ['systolic', 'diastolic', 'heartRate'], label: 'BP & HR' }],
      defaultSort: { key: 'when', dir: 'desc' },
    },
    {
      id: 'nutrition', name: 'Nutrition & water', icon: '🥗', titleField: 'item', dateField: 'date', quickAdd: ['item', 'meal', 'water'],
      fields: [
        { key: 'item', label: 'What', type: 'text', required: true, placeholder: 'e.g. Oatmeal with berries, or Water' },
        { key: 'date', label: 'Date', type: 'date', default: today },
        { key: 'meal', label: 'Meal', type: 'select', options: ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Drink'] },
        { key: 'calories', label: 'Calories', type: 'number', unit: 'kcal', min: 0, step: 1 },
        { key: 'protein', label: 'Protein', type: 'number', unit: 'g', min: 0, step: 1 },
        { key: 'water', label: 'Water', type: 'number', unit: 'oz', min: 0, step: 1 },
        { key: 'notes', label: 'Notes', type: 'text' },
        { key: 'tags', label: 'Tags', type: 'tags' },
      ],
      views: [{ type: 'table' }, { type: 'chart', chart: 'bar', valueFields: ['water'], agg: 'sum', bucket: 'day', label: 'Water / day' }, { type: 'chart', chart: 'bar', valueFields: ['calories'], agg: 'sum', bucket: 'day', label: 'Calories / day' }],
      defaultSort: { key: 'date', dir: 'desc' },
    },
    {
      id: 'symptoms', name: 'Symptoms', icon: '🤒', titleField: 'symptom', dateField: 'when', quickAdd: ['symptom', 'severity'],
      fields: [
        { key: 'symptom', label: 'Symptom', type: 'text', required: true },
        { key: 'when', label: 'When', type: 'datetime', default: () => isoDateTime() },
        { key: 'severity', label: 'Severity', type: 'rating' },
        { key: 'duration', label: 'Lasted', type: 'duration' },
        { key: 'cause', label: 'Possible cause', type: 'text' },
        { key: 'relief', label: 'What helped', type: 'text' },
        { key: 'notes', label: 'Notes', type: 'longtext' },
        { key: 'tags', label: 'Tags', type: 'tags' },
      ],
      views: [{ type: 'table' }, { type: 'chart', chart: 'line', valueFields: ['severity'], seriesBy: 'symptom', label: 'Severity' }],
      defaultSort: { key: 'when', dir: 'desc' },
    },
    {
      id: 'meds', name: 'Meds & supplements', icon: '💊', titleField: 'name',
      description: 'Add each medication or supplement once; tick it off daily on the Today page or the Today view here.',
      today: { role: 'routine', groupField: 'time', activeOn: (r) => r.active !== false && r.time !== 'As needed' },
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true },
        { key: 'kind', label: 'Type', type: 'select', options: ['Medication', 'Supplement', 'Vitamin'], default: 'Medication' },
        { key: 'dose', label: 'Dose', type: 'text', placeholder: 'e.g. 10 mg' },
        { key: 'time', label: 'When', type: 'select', options: TIMES, default: 'Morning' },
        { key: 'active', label: 'Currently taking', type: 'checkbox', default: true },
        { key: 'start', label: 'Started', type: 'date', default: today },
        { key: 'end', label: 'Stopped', type: 'date' },
        { key: 'prescriber', label: 'Prescribed by', type: 'text' },
        { key: 'purpose', label: 'For', type: 'text' },
        { key: 'notes', label: 'Notes / side effects', type: 'longtext' },
      ],
      views: [{ type: 'checklist', label: 'Today' }, { type: 'table' }],
      defaultSort: { key: 'time', dir: 'asc' },
    },
    {
      id: 'appointments', name: 'Appointments', icon: '📅', titleField: 'title', dateField: 'when',
      today: { role: 'event', dateField: 'when' },
      fields: [
        { key: 'title', label: 'Appointment', type: 'text', required: true, placeholder: 'e.g. Dentist cleaning' },
        { key: 'when', label: 'When', type: 'datetime', required: true },
        { key: 'provider', label: 'Provider', type: 'text' },
        { key: 'location', label: 'Location', type: 'text' },
        { key: 'kind', label: 'Type', type: 'select', options: ['Primary care', 'Specialist', 'Dentist', 'Eye', 'Therapy', 'Lab', 'Other'] },
        { key: 'reason', label: 'Reason / questions to ask', type: 'longtext' },
        { key: 'outcome', label: 'Outcome', type: 'longtext' },
        { key: 'followUp', label: 'Follow-up date', type: 'date' },
      ],
      views: [{ type: 'table' }, { type: 'calendar' }, { type: 'cards' }],
      defaultSort: { key: 'when', dir: 'desc' },
    },
    {
      id: 'labs', name: 'Lab & test results', icon: '🧪', titleField: 'test', dateField: 'date',
      fields: [
        { key: 'test', label: 'Test', type: 'text', required: true, placeholder: 'e.g. Vitamin D' },
        { key: 'date', label: 'Date', type: 'date', default: () => isoDate() },
        { key: 'value', label: 'Result', type: 'number' },
        { key: 'unit', label: 'Unit', type: 'text' },
        { key: 'range', label: 'Reference range', type: 'text' },
        { key: 'flag', label: 'Flag', type: 'select', options: ['Normal', 'High', 'Low', 'Borderline'] },
        { key: 'notes', label: 'Notes', type: 'longtext' },
      ],
      views: [{ type: 'table' }, { type: 'chart', chart: 'line', valueFields: ['value'], seriesBy: 'test', label: 'History' }],
      defaultSort: { key: 'date', dir: 'desc' },
    },
    goalsCollection(),
    {
      id: 'doctorNotes', name: 'Doctor notes', icon: '🗒️', titleField: 'title', dateField: 'date',
      fields: [
        { key: 'title', label: 'Title', type: 'text', required: true },
        { key: 'date', label: 'Date', type: 'date', default: today },
        { key: 'doctor', label: 'Doctor', type: 'text' },
        { key: 'notes', label: 'Notes', type: 'longtext' },
        { key: 'tags', label: 'Tags', type: 'tags' },
      ],
      views: [{ type: 'cards' }, { type: 'table' }],
      defaultSort: { key: 'date', dir: 'desc' },
    },
  ],
};

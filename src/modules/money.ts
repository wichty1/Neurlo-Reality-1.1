import type { ModuleDef } from '../core/types';
import { REPEAT, REMIND } from '../core/recur';
import { today, records } from './common';
import { isoDate } from '../core/util';

export const CATEGORIES = ['Housing', 'Utilities', 'Groceries', 'Dining', 'Transport', 'Health', 'Personal care', 'Shopping',
  'Entertainment', 'Subscriptions', 'Education', 'Job search', 'Gifts', 'Savings', 'Debt', 'Other'];
const INCOME = ['Paycheck', 'Side work', 'Gift', 'Refund', 'Other income'];

export const fmtMoney = (n: number) => '$' + n.toLocaleString(undefined, { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });

export async function monthTotals(month = isoDate().slice(0, 7)): Promise<{ income: number; expense: number; byCat: Map<string, number> }> {
  let income = 0, expense = 0;
  const byCat = new Map<string, number>();
  for (const r of await records('money.transactions')) {
    if (String(r.date ?? '').slice(0, 7) !== month) continue;
    const amt = Number(r.amount) || 0;
    if (r.kind === 'Income') income += amt;
    else { expense += amt; const c = String(r.category ?? 'Other'); byCat.set(c, (byCat.get(c) ?? 0) + amt); }
  }
  return { income, expense, byCat };
}

export const money: ModuleDef = {
  id: 'money', name: 'Money', icon: '💵', color: '#5fd3a0',
  description: 'Income and expenses, monthly budget, bills and savings goals.',
  trends: [
    { collection: 'transactions', title: 'Spending per month', days: 365, view: { type: 'chart', chart: 'bar', valueFields: ['amount'], agg: 'sum', bucket: 'month', where: { kind: 'Expense' } } },
    { collection: 'transactions', title: 'Income per month', days: 365, view: { type: 'chart', chart: 'bar', valueFields: ['amount'], agg: 'sum', bucket: 'month', where: { kind: 'Income' } } },
  ],
  stat: async () => {
    const t = await monthTotals();
    return t.income || t.expense ? `This month: ${fmtMoney(t.expense)} spent · ${fmtMoney(t.income)} in` : '';
  },
  collections: [
    {
      id: 'transactions', name: 'Income & expenses', icon: '🧾', titleField: 'description', dateField: 'date', quickAdd: ['description', 'amount', 'category'],
      description: 'Amounts are always positive; choose Income or Expense.',
      fields: [
        { key: 'description', label: 'Description', type: 'text', required: true },
        { key: 'amount', label: 'Amount', type: 'number', unit: '$', required: true, min: 0, step: 0.01 },
        { key: 'kind', label: 'Type', type: 'select', options: ['Expense', 'Income'], default: 'Expense' },
        { key: 'category', label: 'Category', type: 'select', options: [...CATEGORIES, ...INCOME] },
        { key: 'date', label: 'Date', type: 'date', required: true, default: today },
        { key: 'method', label: 'Paid with', type: 'select', options: ['Debit', 'Credit', 'Cash', 'Transfer', 'App'], filter: false },
        { key: 'notes', label: 'Notes', type: 'text' },
        { key: 'tags', label: 'Tags', type: 'tags' },
      ],
      views: [{ type: 'table' },
        { type: 'chart', chart: 'bar', valueFields: ['amount'], agg: 'sum', bucket: 'month', where: { kind: 'Expense' }, label: 'Spending / month' },
        { type: 'chart', chart: 'bar', valueFields: ['amount'], agg: 'sum', bucket: 'week', where: { kind: 'Expense' }, label: 'Spending / week' }],
      defaultSort: { key: 'date', dir: 'desc' },
    },
    {
      id: 'budget', name: 'Monthly budget', icon: '📊', titleField: 'category',
      description: 'One row per category with your monthly limit. The Money overview compares it with this month’s spending.',
      fields: [
        { key: 'category', label: 'Category', type: 'select', options: CATEGORIES, required: true },
        { key: 'limit', label: 'Monthly limit', type: 'number', unit: '$', required: true, min: 0, step: 1 },
        { key: 'notes', label: 'Notes', type: 'text' },
      ],
      views: [{ type: 'table' }],
      defaultSort: { key: 'category', dir: 'asc' },
    },
    {
      id: 'bills', name: 'Bills', icon: '📬', titleField: 'name', dateField: 'due', quickAdd: ['name', 'amount', 'due'],
      description: 'Set the first due date and how often it repeats. Mark each bill paid from the Money overview.',
      today: { role: 'event', dateField: 'due' },
      fields: [
        { key: 'name', label: 'Bill', type: 'text', required: true },
        { key: 'amount', label: 'Amount', type: 'number', unit: '$', min: 0, step: 0.01 },
        { key: 'due', label: 'Due date', type: 'date', required: true, default: today },
        { key: 'repeat', label: 'Repeats', type: 'select', options: REPEAT, default: 'Monthly', filter: false },
        { key: 'until', label: 'Ends', type: 'date' },
        { key: 'remind', label: 'Reminder', type: 'select', options: REMIND, default: '1 day before', filter: false },
        { key: 'autopay', label: 'Autopay', type: 'checkbox' },
        { key: 'category', label: 'Category', type: 'select', options: CATEGORIES },
        { key: 'notes', label: 'Notes', type: 'text' },
      ],
      views: [{ type: 'table' }, { type: 'calendar' }],
      defaultSort: { key: 'due', dir: 'asc' },
    },
    {
      id: 'savings', name: 'Savings goals', icon: '🐷', titleField: 'goal', dateField: 'by',
      fields: [
        { key: 'goal', label: 'Saving for', type: 'text', required: true },
        { key: 'target', label: 'Target amount', type: 'number', unit: '$', required: true, min: 0, step: 1 },
        { key: 'saved', label: 'Saved so far', type: 'number', unit: '$', min: 0, step: 0.01, default: 0 },
        { key: 'by', label: 'Target date', type: 'date' },
        { key: 'notes', label: 'Notes', type: 'text' },
      ],
      views: [{ type: 'cards' }, { type: 'table' }],
      defaultSort: { key: 'by', dir: 'asc' },
    },
  ],
};

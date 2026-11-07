// Custom overview widgets for Money, People, and Habits & Goals.
import * as db from '../core/db';
import type { DBRecord } from '../core/types';
import { h, isoDate, addDays, fmtDate, parseLocal } from '../core/util';
import { occursOn } from '../core/recur';
import { daysOf, isDoneOn, setDoneOn, streak } from '../core/routine';
import { heatmap } from '../engine/charts';
import { monthTotals, fmtMoney } from '../modules/money';
import { birthdayOn, needsCatchUp } from '../modules/people';
import { registerOverviewExtra } from './overview';

function bar(value: number, max: number, label: string, over = false): HTMLElement {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return h('div', { class: `bar${over ? ' over' : ''}`, role: 'progressbar', 'aria-label': label,
    'aria-valuemin': 0, 'aria-valuemax': Math.round(max), 'aria-valuenow': Math.round(value) },
    h('span', { style: `width:${pct.toFixed(1)}%` }));
}

const card = (title: string, ...body: (Node | null)[]) => h('section', { class: 'card extra-card' }, h('h2', {}, title), ...body);
const empty = (text: string) => h('p', { class: 'muted small' }, text);

registerOverviewExtra('money', async () => {
  const t = await monthTotals();
  const budget = await db.list('money.budget');
  const bills = await db.list('money.bills');
  const savings = await db.list('money.savings');
  const net = t.income - t.expense;

  const budgetRows = budget.sort((a, b) => String(a.category).localeCompare(String(b.category))).map((b) => {
    const spent = t.byCat.get(String(b.category)) ?? 0, limit = Number(b.limit) || 0;
    return h('div', { class: 'meter-row' },
      h('div', { class: 'meter-label' }, h('span', {}, String(b.category)), h('span', { class: spent > limit ? 'error small' : 'muted small' }, `${fmtMoney(spent)} / ${fmtMoney(limit)}`)),
      bar(spent, limit, `${b.category} spent ${fmtMoney(spent)} of ${fmtMoney(limit)}`, spent > limit));
  });

  // Bill occurrences from 7 days ago to 21 days ahead; paid dates kept in the bill's `_days`.
  const t0 = isoDate();
  const occ: { r: DBRecord; d: string }[] = [];
  for (let i = -7; i <= 21; i++) {
    const d = isoDate(addDays(new Date(), i));
    for (const r of bills) if (occursOn(r, d, 'due') && !(i < 0 && isDoneOn(r, d))) occ.push({ r, d });
  }
  const billList = occ.length ? h('ul', { class: 'checklist' }, ...occ.map(({ r, d }) => {
    const paid = isDoneOn(r, d);
    const c = h('input', { type: 'checkbox', 'aria-label': `${r.name} due ${fmtDate(d)} paid`, onchange: () => void setDoneOn('money.bills', r, d, c.checked) });
    c.checked = paid;
    const late = !paid && d < t0;
    return h('li', { class: paid ? 'done' : '' }, c, h('span', {}, String(r.name)),
      h('span', { class: `small ${late ? 'warn' : 'muted'}` }, `${typeof r.amount === 'number' ? fmtMoney(r.amount) + ' · ' : ''}${late ? 'overdue ' : ''}${d === t0 ? 'due today' : fmtDate(d)}${r.autopay ? ' · autopay' : ''}`));
  })) : empty('No bills due in the next three weeks.');

  const saveRows = savings.map((s) => {
    const saved = Number(s.saved) || 0, target = Number(s.target) || 0;
    return h('div', { class: 'meter-row' },
      h('div', { class: 'meter-label' }, h('span', {}, String(s.goal)), h('span', { class: 'muted small' }, `${fmtMoney(saved)} / ${fmtMoney(target)}${s.by ? ` by ${fmtDate(s.by)}` : ''}`)),
      bar(saved, target, `${s.goal}: ${fmtMoney(saved)} of ${fmtMoney(target)}`));
  });

  return h('div', { class: 'extra-grid' },
    card('This month',
      h('div', { class: 'kpis' },
        h('div', {}, h('span', { class: 'muted small' }, 'In'), h('strong', {}, fmtMoney(t.income))),
        h('div', {}, h('span', { class: 'muted small' }, 'Spent'), h('strong', {}, fmtMoney(t.expense))),
        h('div', {}, h('span', { class: 'muted small' }, 'Net'), h('strong', { class: net < 0 ? 'error' : '' }, (net < 0 ? '−' : '') + fmtMoney(Math.abs(net)))))),
    card('Budget vs spent', ...(budgetRows.length ? budgetRows : [empty('Add categories in Monthly budget to compare against spending.')])),
    card('Upcoming bills', billList),
    card('Savings goals', ...(saveRows.length ? saveRows : [empty('No savings goals yet.')])));
});

registerOverviewExtra('people', async () => {
  const recs = await db.list('people.contacts');
  const t = isoDate();
  const upcoming: { r: DBRecord; d: string; inDays: number }[] = [];
  for (let i = 0; i < 31; i++) {
    const d = isoDate(addDays(new Date(), i));
    for (const r of recs) if (birthdayOn(r, d)) upcoming.push({ r, d, inDays: i });
  }
  const catchUp = recs.filter((r) => needsCatchUp(r, t));
  return h('div', { class: 'extra-grid' },
    card('Birthdays in the next 30 days', upcoming.length ? h('ul', { class: 'plain-list' }, ...upcoming.map(({ r, d, inDays }) => {
      const born = parseLocal(r.birthday)!.getFullYear(), age = +d.slice(0, 4) - born;
      return h('li', {}, h('strong', {}, String(r.name)), h('span', { class: 'muted small' },
        ` · ${inDays === 0 ? 'today 🎉' : inDays === 1 ? 'tomorrow' : `${fmtDate(d)} (in ${inDays} days)`}${age > 0 && age < 120 ? ` · turns ${age}` : ''}`));
    })) : empty('No birthdays coming up. Add birthdays to contacts to see them here and on Today.')),
    card('Time to catch up', catchUp.length ? h('ul', { class: 'plain-list' }, ...catchUp.map((r) => h('li', { class: 'row-between' },
      h('span', {}, h('strong', {}, String(r.name)), h('span', { class: 'muted small' }, r.lastContacted ? ` · last ${fmtDate(r.lastContacted)}` : ' · never logged')),
      h('button', { type: 'button', class: 'btn btn-sm', onclick: () => void db.update('people.contacts', r.id, { lastContacted: t }) }, 'Contacted today'))))
      : empty('Everyone is up to date. Set "keep in touch every" on a contact to get nudges.')));
});

registerOverviewExtra('habits', async () => {
  const t = isoDate();
  const habits = (await db.list('habits.habits')).filter((r) => r.active !== false);
  const goals = await db.list('habits.goals');
  const ms = await db.list('habits.milestones');
  const habitCards = habits.map((r) => {
    const days = daysOf(r);
    const recent = days.filter((d) => d >= isoDate(addDays(new Date(), -83))).length;
    return h('div', { class: 'habit-row' },
      h('div', { class: 'meter-label' }, h('strong', {}, String(r.habit)),
        h('span', { class: 'muted small' }, `🔥 ${streak(r, t)} · ${recent} of last 84 days${isDoneOn(r, t) ? ' · done today' : ''}`)),
      heatmap(new Map(days.map((d) => [d, 1])), { title: `${r.habit} completions`, weeks: 12, min: 0, max: 1 }));
  });
  const goalRows = goals.map((g) => {
    const mine = ms.filter((m) => String(m.goal ?? '').trim().toLowerCase() === String(g.goal).trim().toLowerCase());
    const done = mine.filter((m) => m.done === true).length;
    return h('div', { class: 'meter-row' },
      h('div', { class: 'meter-label' }, h('span', {}, String(g.goal), g.status ? h('span', { class: 'pill' }, ` ${g.status}`) : null),
        h('span', { class: 'muted small' }, mine.length ? `${done}/${mine.length} milestones` : 'no milestones yet')),
      bar(done, mine.length, `${g.goal}: ${done} of ${mine.length} milestones`));
  });
  return h('div', { class: 'extra-grid' },
    card('Habit history (12 weeks)', ...(habitCards.length ? habitCards : [empty('Add a habit to start a streak.')])),
    card('Goal progress', ...(goalRows.length ? goalRows : [empty('Add a long-term goal, then milestones linked to it.')])));
});

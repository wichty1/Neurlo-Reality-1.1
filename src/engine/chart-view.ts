// The "chart" collection view, plus trendChart() reused by module overviews.
import type { Collection, DBRecord, ViewDef } from '../core/types';
import { h, isoDate, addDays, startOfWeek, parseLocal } from '../core/util';
import { aggregate, toPoints, lineChart, barChart, heatmap, SERIES_COLORS, type Series } from './charts';
import { registerView } from './views';

export function trendChart(col: Collection, recs: DBRecord[], v: ViewDef, days: number | null, title: string): HTMLElement {
  const dateField = col.dateField ?? 'createdAt';
  const from = days ? addDays(new Date(), -days + 1) : undefined;
  const fromDay = from ? isoDate(from) : '';
  const where = Object.entries(v.where ?? {});
  const inRange = recs.filter((r) => where.every(([k, val]) => r[k] === val)).filter((r) => !fromDay || String(r[dateField] ?? isoDate(new Date(r.createdAt))).slice(0, 10) >= fromDay);
  const fields = (v.valueFields ?? []).map((k) => col.fields.find((f) => f.key === k)).filter((f) => !!f);
  const agg = v.agg ?? (fields.length ? 'avg' : 'count');
  const kind = v.chart ?? 'line';

  if (kind === 'heatmap') {
    const f = fields[0];
    const vals = aggregate(inRange, dateField, f?.key ?? null, agg);
    const isRating = f?.type === 'rating';
    return heatmap(vals, { title, weeks: days ? Math.min(53, Math.ceil(days / 7)) : 53, min: isRating ? 1 : f?.min, max: isRating ? 10 : f?.max, unit: f?.unit });
  }
  if (kind === 'bar') {
    const f = fields[0];
    const bucket = v.bucket ?? 'week';
    const vals = aggregate(inRange, dateField, f?.key ?? null, agg, bucket);
    const keys = Array.from(vals.keys()).sort();
    if (!keys.length) return barChart([], { title });
    const bars: { label: string; value: number; tip: string }[] = [];
    let d = from ? (bucket === 'week' ? startOfWeek(from) : bucket === 'month' ? new Date(from.getFullYear(), from.getMonth(), 1) : from) : parseLocal(keys[0])!;
    const end = new Date();
    while (d <= end) {
      const k = isoDate(d);
      const value = vals.get(k) ?? 0;
      const label = d.toLocaleDateString(undefined, bucket === 'month' ? { month: 'short', year: '2-digit' } : { month: 'short', day: 'numeric' });
      bars.push({ label, value, tip: `${bucket === 'week' ? 'Week of ' : ''}${label}: ${Math.round(value * 10) / 10}${f?.unit ? ' ' + f.unit : ''}` });
      d = bucket === 'month' ? new Date(d.getFullYear(), d.getMonth() + 1, 1) : addDays(d, bucket === 'week' ? 7 : 1);
    }
    return barChart(bars, { title });
  }
  let series: Series[];
  if (v.seriesBy && fields[0]) {
    const groups = new Map<string, DBRecord[]>();
    for (const r of inRange) { const g = String(r[v.seriesBy] ?? '').trim(); if (g) groups.set(g, [...(groups.get(g) ?? []), r]); }
    series = Array.from(groups).sort((a, b) => b[1].length - a[1].length).slice(0, 5)
      .map(([name, rs], i) => ({ name, color: SERIES_COLORS[i], points: toPoints(aggregate(rs, dateField, fields[0]!.key, agg)) }));
  } else {
    series = fields.map((f, i) => ({ name: f!.label, color: SERIES_COLORS[i % SERIES_COLORS.length], points: toPoints(aggregate(inRange, dateField, f!.key, agg)) }));
  }
  return lineChart(series, { title, unit: fields.length === 1 ? fields[0]!.unit : undefined });
}

const RANGES: [string, number | null][] = [['30 days', 30], ['90 days', 90], ['1 year', 365], ['All', null]];

registerView('chart', (ctx) => {
  const key = `chart:${ctx.store}`;
  let idx = 1;
  try { idx = Number(localStorage.getItem(key) ?? 1) || 0; } catch { /* ignore */ }
  if (idx >= RANGES.length) idx = 1;
  const holder = h('div', { class: 'chart-holder' });
  const tabs = h('div', { class: 'seg', role: 'tablist', 'aria-label': 'Date range' });
  const paint = () => {
    tabs.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-selected', String(i === idx)));
    holder.replaceChildren(trendChart(ctx.col, ctx.records, ctx.view, RANGES[idx][1], `${ctx.col.name} ${ctx.view.label ?? 'chart'}`));
  };
  RANGES.forEach(([label], i) => tabs.append(h('button', { type: 'button', role: 'tab', onclick: () => {
    idx = i; try { localStorage.setItem(key, String(i)); } catch { /* ignore */ } paint();
  } }, label)));
  paint();
  return h('div', { class: 'card chart-card' }, tabs, holder,
    h('p', { class: 'muted small' }, 'Chart uses the entries matching your current search and filters. Hover a point for its value.'));
});

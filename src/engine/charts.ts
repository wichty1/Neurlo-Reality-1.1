// Dependency-free SVG charts: line, bar, calendar heatmap. Colors come from CSS variables.
import type { DBRecord } from '../core/types';
import { isoDate, parseLocal, addDays, startOfWeek } from '../core/util';

const NS = 'http://www.w3.org/2000/svg';
export const SERIES_COLORS = ['var(--accent)', '#5fd3c6', '#f2c14e', '#ff8a65', '#9fa8ff'];

function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, text?: string): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  if (text !== undefined) el.textContent = text;
  return el;
}

export type Agg = 'avg' | 'sum' | 'count';
export interface Point { x: Date; y: number; }
export interface Series { name: string; color: string; points: Point[]; }

const dayOf = (v: unknown) => (typeof v === 'string' ? v.slice(0, 10) : '');

/** Groups records per day (or per ISO week) and aggregates one numeric field. */
export function aggregate(recs: DBRecord[], dateField: string, valueField: string | null, agg: Agg, bucket: 'day' | 'week' | 'month' = 'day'): Map<string, number> {
  const groups = new Map<string, number[]>();
  for (const r of recs) {
    // Records without a date are skipped (e.g. applications not yet sent), except when charting by creation time.
    let d = dateField === 'createdAt' ? isoDate(new Date(r.createdAt)) : dayOf(r[dateField]);
    if (!d) continue;
    if (bucket === 'week') d = isoDate(startOfWeek(parseLocal(d)!));
    else if (bucket === 'month') d = d.slice(0, 8) + '01';
    const v = valueField ? Number(r[valueField]) : 1;
    if (valueField && (r[valueField] === undefined || r[valueField] === '' || !isFinite(v))) continue;
    groups.set(d, [...(groups.get(d) ?? []), v]);
  }
  const out = new Map<string, number>();
  for (const [d, vals] of groups) {
    const sum = vals.reduce((a, b) => a + b, 0);
    out.set(d, agg === 'avg' ? sum / vals.length : agg === 'sum' ? sum : vals.length);
  }
  return out;
}

export function toPoints(m: Map<string, number>, from?: Date): Point[] {
  return Array.from(m, ([d, y]) => ({ x: parseLocal(d)!, y }))
    .filter((p) => !from || p.x >= from).sort((a, b) => +a.x - +b.x);
}

const fmtN = (n: number) => (Math.abs(n) >= 100 ? Math.round(n).toString() : (Math.round(n * 10) / 10).toString());
const fmtD = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

function frame(w: number, hgt: number, label: string): SVGSVGElement {
  return s('svg', { viewBox: `0 0 ${w} ${hgt}`, class: 'chart', role: 'img', 'aria-label': label, preserveAspectRatio: 'xMidYMid meet' });
}

function legend(series: Series[]): HTMLElement {
  const el = document.createElement('div');
  el.className = 'chart-legend';
  for (const se of series) {
    const it = document.createElement('span');
    it.innerHTML = '<i></i>';
    (it.firstChild as HTMLElement).style.background = se.color;
    it.append(se.name);
    el.append(it);
  }
  return el;
}

export function lineChart(series: Series[], opts: { unit?: string; title: string }): HTMLElement {
  const W = 420, H = 200, L = 34, R = 10, T = 10, B = 24;
  const pts = series.flatMap((x) => x.points);
  const wrap = document.createElement('figure');
  wrap.className = 'chart-fig';
  if (!pts.length) { wrap.append(emptyMsg()); return wrap; }
  let x0 = Math.min(...pts.map((p) => +p.x)), x1 = Math.max(...pts.map((p) => +p.x));
  if (x0 === x1) { x0 -= 86400000; x1 += 86400000; }
  let y0 = Math.min(...pts.map((p) => p.y)), y1 = Math.max(...pts.map((p) => p.y));
  const pad = (y1 - y0) * 0.1 || Math.max(1, Math.abs(y1) * 0.1);
  y0 -= pad; y1 += pad;
  const X = (t: number) => L + ((t - x0) / (x1 - x0)) * (W - L - R);
  const Y = (v: number) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  const last = series.map((x) => x.points.at(-1)).filter(Boolean).map((p, i) => `${series[i].name} latest ${fmtN(p!.y)}`).join(', ');
  const svg = frame(W, H, `${opts.title}. ${pts.length} points from ${fmtD(new Date(x0))} to ${fmtD(new Date(x1))}. ${last}`);
  for (let i = 0; i <= 4; i++) {
    const v = y0 + ((y1 - y0) * i) / 4, y = Y(v);
    svg.append(s('line', { x1: L, x2: W - R, y1: y, y2: y, class: 'grid' }), s('text', { x: L - 6, y: y + 4, 'text-anchor': 'end', class: 'axis' }, fmtN(v)));
  }
  for (let i = 0; i <= 3; i++) {
    const t = x0 + ((x1 - x0) * i) / 3;
    svg.append(s('text', { x: X(t), y: H - 8, 'text-anchor': i === 0 ? 'start' : i === 3 ? 'end' : 'middle', class: 'axis' }, fmtD(new Date(t))));
  }
  for (const se of series) {
    if (!se.points.length) continue;
    const d = se.points.map((p, i) => `${i ? 'L' : 'M'}${X(+p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
    svg.append(s('path', { d, class: 'line', style: `stroke:${se.color}` }));
    for (const p of se.points) {
      const c = s('circle', { cx: X(+p.x), cy: Y(p.y), r: se.points.length > 60 ? 1.6 : 3, style: `fill:${se.color}` });
      c.append(s('title', {}, `${se.name} ${fmtD(p.x)}: ${fmtN(p.y)}${opts.unit ? ' ' + opts.unit : ''}`));
      svg.append(c);
    }
  }
  wrap.append(svg, legend(series));
  return wrap;
}

export function barChart(bars: { label: string; value: number; tip: string }[], opts: { title: string; color?: string }): HTMLElement {
  const W = 420, H = 180, L = 30, R = 6, T = 10, B = 24;
  const wrap = document.createElement('figure');
  wrap.className = 'chart-fig';
  if (!bars.length) { wrap.append(emptyMsg()); return wrap; }
  const max = Math.max(...bars.map((b) => b.value), 1);
  const bw = (W - L - R) / bars.length;
  const svg = frame(W, H, `${opts.title}. ${bars.map((b) => b.tip).join('; ')}`);
  for (let i = 0; i <= 4; i++) {
    const v = (max * i) / 4, y = T + (1 - v / max) * (H - T - B);
    svg.append(s('line', { x1: L, x2: W - R, y1: y, y2: y, class: 'grid' }), s('text', { x: L - 6, y: y + 4, 'text-anchor': 'end', class: 'axis' }, fmtN(v)));
  }
  const every = Math.ceil(bars.length / 6);
  bars.forEach((b, i) => {
    const hgt = (b.value / max) * (H - T - B);
    const r = s('rect', { x: L + i * bw + bw * 0.15, y: H - B - hgt, width: Math.max(bw * 0.7, 1), height: Math.max(hgt, 0), rx: 2, style: `fill:${opts.color ?? 'var(--accent)'}` });
    r.append(s('title', {}, b.tip));
    svg.append(r);
    if (i % every === 0) svg.append(s('text', { x: L + i * bw + bw / 2, y: H - 8, 'text-anchor': 'middle', class: 'axis' }, b.label));
  });
  wrap.append(svg);
  return wrap;
}

/** GitHub-style calendar of the last `weeks` weeks. Values are scaled between min and max. */
export function heatmap(values: Map<string, number>, opts: { title: string; weeks?: number; min?: number; max?: number; unit?: string }): HTMLElement {
  const weeks = opts.weeks ?? 26, C = 13, L = 28, T = 16;
  const wrap = document.createElement('figure');
  wrap.className = 'chart-fig';
  const start = addDays(startOfWeek(new Date()), -7 * (weeks - 1));
  const vals = Array.from(values.values());
  const min = opts.min ?? Math.min(...vals, 0), max = opts.max ?? Math.max(...vals, 1);
  const svg = frame(L + weeks * C + 4, T + 7 * C + 4, `${opts.title}. ${values.size} days with data in the last ${weeks} weeks.`);
  ['Mon', 'Wed', 'Fri'].forEach((d, i) => svg.append(s('text', { x: 0, y: T + (i * 2 + 1) * C - 3, class: 'axis' }, d)));
  const today = isoDate();
  for (let w = 0; w < weeks; w++) {
    const wd = addDays(start, w * 7);
    if (wd.getDate() <= 7) svg.append(s('text', { x: L + w * C, y: 10, class: 'axis' }, wd.toLocaleDateString(undefined, { month: 'short' })));
    for (let d = 0; d < 7; d++) {
      const day = isoDate(addDays(start, w * 7 + d));
      if (day > today) continue;
      const v = values.get(day);
      const t = v === undefined ? 0 : 0.2 + 0.8 * ((v - min) / (max - min || 1));
      const r = s('rect', { x: L + w * C, y: T + d * C, width: C - 2, height: C - 2, rx: 2,
        class: v === undefined ? 'hm-empty' : 'hm-cell', style: v === undefined ? '' : `fill:var(--accent);fill-opacity:${t.toFixed(2)}` });
      r.append(s('title', {}, `${fmtD(parseLocal(day)!)}: ${v === undefined ? 'no entry' : fmtN(v) + (opts.unit ? ' ' + opts.unit : '')}`));
      svg.append(r);
    }
  }
  wrap.append(svg);
  return wrap;
}

function emptyMsg(): HTMLElement {
  const p = document.createElement('p');
  p.className = 'muted';
  p.textContent = 'Not enough data to chart yet. Add a few entries with numbers to see a trend.';
  return p;
}

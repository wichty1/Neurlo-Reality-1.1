// Generic module overview: one summary card per collection + recent entries.
import type { DBRecord, ModuleDef } from '../core/types';
import { storeName } from '../core/types';
import * as db from '../core/db';
import { h, relTime } from '../core/util';
import { href } from '../core/router';
import { pageCtx, watchStores } from '../core/page';
import { openEditor } from '../engine/editor';
import { titleOf } from '../engine/views';
import { trendChart } from '../engine/chart-view';
import { getCollection } from '../modules';

/** Modules can add custom overview widgets (charts, streaks) by registering here. */
const extras = new Map<string, (mod: ModuleDef) => Promise<HTMLElement | null>>();
export function registerOverviewExtra(modId: string, fn: (mod: ModuleDef) => Promise<HTMLElement | null>): void {
  extras.set(modId, fn);
}

export function renderOverview(mod: ModuleDef): HTMLElement {
  const stores = mod.collections.map((c) => storeName(mod.id, c.id));
  const cards = h('div', { class: 'summary-grid' });
  const extra = h('div', { class: 'overview-extra' });
  const recent = h('div', { class: 'recent' });
  const trends = h('div', { class: 'trend-grid' });
  const stat = h('p', { class: 'stat-line', 'aria-live': 'polite' });
  pageCtx.fab = mod.collections.length === 1 ? () => openEditor(mod, mod.collections[0]) : null;

  async function paint(): Promise<void> {
    const data = await Promise.all(mod.collections.map(async (c) => ({ c, recs: await db.list(storeName(mod.id, c.id)) })));
    cards.replaceChildren(...data.map(({ c, recs }) => {
      const last = recs.reduce<DBRecord | null>((a, r) => (!a || r.updatedAt > a.updatedAt ? r : a), null);
      return h('a', { class: 'card summary-card', href: href('m', mod.id, c.id) },
        h('div', { class: 'summary-top' }, h('span', { class: 'summary-icon', 'aria-hidden': 'true' }, c.icon ?? mod.icon), h('h3', {}, c.name)),
        h('div', { class: 'big' }, String(recs.length)),
        h('div', { class: 'muted small' }, last ? `Last update ${relTime(last.updatedAt)}` : 'No entries yet'));
    }));
    if (mod.stat) stat.textContent = await mod.stat().catch(() => '');
    trends.replaceChildren(...(mod.trends ?? []).map((t) => {
      const col = getCollection(mod, t.collection);
      const recs = data.find((d) => d.c.id === t.collection)?.recs ?? [];
      if (!col) return h('div');
      return h('a', { class: 'card trend-card', href: href('m', mod.id, col.id), 'aria-label': `${t.title}: open ${col.name}` },
        h('h3', {}, t.title, h('span', { class: 'muted small' }, t.view.chart === 'heatmap' ? ' · last 26 weeks' : ' · last 90 days')),
        trendChart(col, recs, t.view, t.view.chart === 'heatmap' ? 182 : 90, t.title));
    }));
    const fn = extras.get(mod.id);
    extra.replaceChildren();
    if (fn) { const el = await fn(mod); if (el) extra.append(el); }
    const items = data.flatMap(({ c, recs }) => recs.map((r) => ({ c, r })))
      .sort((a, b) => b.r.updatedAt - a.r.updatedAt).slice(0, 8);
    recent.replaceChildren(h('h2', {}, 'Recent entries'));
    if (!items.length) {
      recent.append(h('p', { class: 'muted' }, `Nothing logged in ${mod.name} yet. Pick a section above to add your first entry.`));
      return;
    }
    recent.append(h('ul', { class: 'recent-list' }, ...items.map(({ c, r }) => h('li', {},
      h('button', { type: 'button', class: 'link-btn', onclick: () => openEditor(mod, c, r) }, titleOf(c, r)),
      h('span', { class: 'muted small' }, ` · ${c.name} · ${relTime(r.updatedAt)}`)))));
  }

  watchStores(db.dbEvents, stores, () => void paint());
  void paint();
  return h('section', { class: 'overview' },
    h('div', { class: 'page-head' }, h('h1', {}, h('span', { 'aria-hidden': 'true' }, mod.icon), ' ', mod.name), h('p', { class: 'muted' }, mod.description), stat),
    cards, trends, extra, recent);
}

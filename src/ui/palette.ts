// Command palette (Ctrl/Cmd+K): jump to pages, run actions, search every record.
import * as db from '../core/db';
import { h } from '../core/util';
import { href, navigate } from '../core/router';
import { storeName } from '../core/types';
import { exportJSON } from '../core/backup';
import { MODULES } from '../modules';
import { openEditor } from '../engine/editor';
import { searchText } from '../engine/collection';
import { titleOf } from '../engine/views';
import { PAGES, getTheme, setTheme } from './shell';
import { closePanel } from './panel';

interface Item { label: string; hint: string; icon: string; hay: string; run: () => void; kind: number; }

let overlay: HTMLElement | null = null;

async function buildItems(): Promise<Item[]> {
  const items: Item[] = [
    { label: 'Home', hint: 'Page', icon: '🏠', hay: 'home brain', run: () => navigate('/'), kind: 0 },
    ...PAGES.map((p) => ({ label: p.name, hint: 'Page', icon: p.icon, hay: p.name.toLowerCase(), run: () => navigate(href(p.id)), kind: 0 })),
    { label: 'Toggle light/dark theme', hint: 'Action', icon: '◐', hay: 'theme dark light toggle', run: () => setTheme(getTheme() === 'dark' ? 'light' : 'dark'), kind: 1 },
    { label: 'Export backup (JSON)', hint: 'Action', icon: '💾', hay: 'export backup json download', run: () => void exportJSON(), kind: 1 },
  ];
  for (const m of MODULES) {
    items.push({ label: m.name, hint: 'Area', icon: m.icon, hay: `${m.name} ${m.description}`.toLowerCase(), run: () => navigate(href('m', m.id)), kind: 0 });
    for (const c of m.collections) {
      items.push({ label: `${m.name} › ${c.name}`, hint: 'Section', icon: c.icon ?? m.icon, hay: `${m.name} ${c.name}`.toLowerCase(), run: () => navigate(href('m', m.id, c.id)), kind: 0 });
      items.push({ label: `New: ${c.name}`, hint: m.name, icon: '+', hay: `new add create ${c.name} ${m.name}`.toLowerCase(), run: () => openEditor(m, c), kind: 1 });
      const store = storeName(m.id, c.id);
      for (const r of await db.list(store)) {
        items.push({ label: titleOf(c, r), hint: `${m.name} › ${c.name}`, icon: c.icon ?? m.icon, hay: searchText(c, r),
          run: () => navigate(href('m', m.id, c.id, r.id)), kind: 2 });
      }
    }
  }
  return items;
}

function score(it: Item, words: string[]): number {
  const label = it.label.toLowerCase();
  const hay = `${label} ${it.hay}`;
  if (!words.every((w) => hay.includes(w))) return -1;
  let s = 0;
  if (label.startsWith(words[0])) s += 4;
  if (words.every((w) => label.includes(w))) s += 2;
  return s - it.kind * 0.5;
}

export function closePalette(): void {
  overlay?.remove();
  overlay = null;
}

export async function openPalette(): Promise<void> {
  if (overlay) return;
  closePanel();
  const items = await buildItems();
  const input = h('input', { type: 'text', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'palette-list', 'aria-autocomplete': 'list',
    'aria-label': 'Search everything', placeholder: 'Search entries, pages and actions…', autocomplete: 'off' });
  const list = h('ul', { id: 'palette-list', role: 'listbox', class: 'palette-list' });
  let shown: Item[] = [];
  let active = 0;
  const prevFocus = document.activeElement;

  const paintActive = () => {
    list.querySelectorAll('li').forEach((li, i) => li.setAttribute('aria-selected', String(i === active)));
    const el = list.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
    if (el) input.setAttribute('aria-activedescendant', el.id); else input.removeAttribute('aria-activedescendant');
  };
  const run = (it: Item | undefined) => {
    if (!it) return;
    closePalette();
    it.run();
  };
  const paint = () => {
    const words = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    shown = words.length
      ? items.map((it) => ({ it, s: score(it, words) })).filter((x) => x.s >= 0).sort((a, b) => b.s - a.s).slice(0, 40).map((x) => x.it)
      : items.filter((it) => it.kind === 0).slice(0, 40);
    active = 0;
    list.replaceChildren(...shown.map((it, i) => h('li', { id: `pal-${i}`, role: 'option', class: 'palette-item',
      onclick: () => run(it), onmousemove: () => { if (active !== i) { active = i; paintActive(); } } },
      h('span', { class: 'pal-icon', 'aria-hidden': 'true' }, it.icon), h('span', { class: 'pal-label' }, it.label), h('span', { class: 'muted small' }, it.hint))));
    if (!shown.length) list.append(h('li', { class: 'muted palette-empty' }, 'No matches'));
    paintActive();
  };

  input.addEventListener('input', paint);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, shown.length - 1); paintActive(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); paintActive(); }
    else if (e.key === 'Enter') { e.preventDefault(); run(shown[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); closePalette(); if (prevFocus instanceof HTMLElement) prevFocus.focus(); }
    else if (e.key === 'Tab') e.preventDefault();
  });

  overlay = h('div', { class: 'palette-wrap', onclick: (e: Event) => { if (e.target === overlay) closePalette(); } },
    h('div', { class: 'palette', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Command palette' }, input, list,
      h('div', { class: 'palette-foot muted small' }, '↑↓ to move · Enter to open · Esc to close')));
  document.body.append(overlay);
  paint();
  input.focus();
}

export function installPalette(): void {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (overlay) closePalette(); else void openPalette();
    }
  });
}

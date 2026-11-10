// App shell: sidebar (desktop), bottom tab bar (mobile), breadcrumbs, floating + button.
import { h } from '../core/util';
import { href, type Route } from '../core/router';
import { pageCtx } from '../core/page';
import { MODULES } from '../modules';
import { storeName } from '../core/types';
import { openPanel, closePanel } from './panel';
import { openEditor } from '../engine/editor';
import { openPalette } from './palette';

export interface PageDef {
  id: string; name: string; icon: string;
  position: 'top' | 'bottom';
  render: (r: Route) => HTMLElement;
}
export const PAGES: PageDef[] = [];
export function registerPage(p: PageDef): void { PAGES.push(p); }

export type Theme = 'dark' | 'light';
export function getTheme(): Theme {
  try { return localStorage.getItem('theme') === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
}
export function setTheme(t: Theme): void {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('theme', t); } catch { /* ignore */ }
  document.querySelectorAll('.theme-toggle').forEach((b) => b.setAttribute('aria-pressed', String(t === 'light')));
}

/** Panel listing every collection; used by the + button where a page has no single target. */
export function openAddChooser(): void {
  const list = h('div', { class: 'chooser' });
  for (const m of MODULES) {
    list.append(h('h3', { class: 'chooser-head', style: `--accent:${m.color}` }, `${m.icon} ${m.name}`));
    for (const c of m.collections) {
      list.append(h('button', { type: 'button', class: 'chooser-item', 'data-store': storeName(m.id, c.id),
        onclick: () => { closePanel(); setTimeout(() => openEditor(m, c), 200); } }, `${c.icon ?? m.icon} ${c.name}`));
    }
  }
  openPanel('Add something', list);
}

function navLink(id: string, label: string, icon: string, link: string, color?: string): HTMLElement {
  return h('a', { class: 'nav-link', href: link, 'data-nav': id, style: color ? `--accent:${color}` : null },
    h('span', { class: 'nav-icon', 'aria-hidden': 'true' }, icon), h('span', { class: 'nav-label' }, label));
}

export function buildShell(root: HTMLElement): { main: HTMLElement; crumbs: HTMLElement } {
  const themeBtn = h('button', { type: 'button', class: 'icon-btn theme-toggle', 'aria-label': 'Light theme', 'aria-pressed': String(getTheme() === 'light'),
    onclick: () => setTheme(getTheme() === 'dark' ? 'light' : 'dark') }, '◐');
  const side = h('nav', { class: 'sidebar', 'aria-label': 'Main' },
    h('div', { class: 'brand' }, h('a', { href: '#/', class: 'brand-link' }, '🧠 Neurlo'), themeBtn),
    navLink('home', 'Home', '🏠', '#/'),
    ...PAGES.filter((p) => p.position === 'top').map((p) => navLink(p.id, p.name, p.icon, href(p.id))),
    h('div', { class: 'nav-sep', role: 'presentation' }),
    ...MODULES.map((m) => navLink(m.id, m.name, m.icon, href('m', m.id), m.color)),
    h('div', { class: 'nav-sep', role: 'presentation' }),
    ...PAGES.filter((p) => p.position === 'bottom').map((p) => navLink(p.id, p.name, p.icon, href(p.id))));

  const moreBtn = h('button', { type: 'button', class: 'tab', onclick: () => {
    const grid = h('div', { class: 'more-grid' }, ...Array.from(side.querySelectorAll('a.nav-link'), (a) => {
      const c = a.cloneNode(true) as HTMLElement;
      c.addEventListener('click', () => closePanel());
      return c;
    }));
    openPanel('All areas', grid);
  } }, h('span', { 'aria-hidden': 'true' }, '☰'), h('span', {}, 'More'));
  const tabs = h('nav', { class: 'tabbar', 'aria-label': 'Main (mobile)' },
    navLink('home', 'Home', '🏠', '#/'),
    ...PAGES.filter((p) => p.position === 'top').slice(0, 1).map((p) => navLink(p.id, p.name, p.icon, href(p.id))),
    h('button', { type: 'button', class: 'tab', onclick: () => void openPalette() }, h('span', { 'aria-hidden': 'true' }, '🔍'), h('span', {}, 'Search')),
    moreBtn);

  const crumbs = h('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' });
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  const topbar = h('div', { class: 'topbar' }, crumbs,
    h('div', { class: 'topbar-actions' },
      h('button', { type: 'button', class: 'btn btn-sm search-btn', onclick: () => void openPalette(), 'aria-keyshortcuts': 'Control+K Meta+K' },
        '🔍 Search', h('kbd', {}, isMac ? '⌘K' : 'Ctrl K')),
      h('button', { type: 'button', class: 'btn btn-sm', onclick: openAddChooser }, '⚡ Quick log')));
  const main = h('main', { id: 'main', tabindex: -1 });
  const fab = h('button', { type: 'button', class: 'fab', 'aria-label': 'Add new (N)', title: 'Add new (N)',
    onclick: () => (pageCtx.fab ?? openAddChooser)() }, '+');

  root.replaceChildren(
    h('a', { href: '#main', class: 'skip-link', onclick: (e: Event) => { e.preventDefault(); main.focus(); } }, 'Skip to content'),
    side, h('div', { class: 'content' }, topbar, main), tabs, fab);
  return { main, crumbs };
}

export function setActiveNav(id: string, color?: string): void {
  document.querySelectorAll('.nav-link').forEach((a) => {
    const on = a.getAttribute('data-nav') === id;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.documentElement.style.setProperty('--accent', color ?? 'var(--brand)');
}

export function setCrumbs(el: HTMLElement, items: { label: string; link?: string }[]): void {
  el.replaceChildren();
  if (items.length < 2) { el.hidden = true; return; }
  el.hidden = false;
  const ol = h('ol');
  items.forEach((it, i) => ol.append(h('li', {},
    it.link && i < items.length - 1 ? h('a', { href: it.link }, it.label) : h('span', { 'aria-current': 'page' }, it.label))));
  el.append(ol);
}

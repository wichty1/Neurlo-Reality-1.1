// Home: module tile grid (also the fallback for the 3D brain).
import { MODULES } from '../modules';
import { h } from '../core/util';
import { href } from '../core/router';

export function renderModuleGrid(): HTMLElement {
  return h('div', { class: 'module-grid' }, ...MODULES.map((m) => {
    const stat = h('span', { class: 'muted small' }, m.description);
    if (m.stat) void m.stat().then((s) => { if (s) stat.textContent = s; }).catch(() => {});
    return h('a', { class: 'card module-tile', href: href('m', m.id), style: `--accent:${m.color}` },
      h('span', { class: 'tile-icon', 'aria-hidden': 'true' }, m.icon), h('strong', {}, m.name), stat);
  }));
}

export function renderHome(): HTMLElement {
  return h('section', { class: 'home' },
    h('div', { class: 'page-head' }, h('h1', {}, 'Your life, at a glance'), h('p', { class: 'muted' }, 'Pick an area to open it.')),
    renderModuleGrid());
}

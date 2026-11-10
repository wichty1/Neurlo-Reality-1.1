// Home: 3D brain (lazy-loaded) or a 2D module grid, plus "today at a glance".
import { MODULES } from '../modules';
import * as db from '../core/db';
import { h } from '../core/util';
import { href, navigate } from '../core/router';
import { onLeave, watchStores } from '../core/page';
import { toast } from '../ui/toast';
import { moduleInfo, glance, type ModuleInfo } from './home-data';

type Mode = 'brain' | 'grid';
const KEY = 'homeView';

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

function lowEnd(): boolean {
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return (navigator.hardwareConcurrency ?? 4) <= 2 || (mem !== undefined && mem <= 2);
}

function savedMode(): Mode | null {
  try { const v = localStorage.getItem(KEY); return v === 'brain' || v === 'grid' ? v : null; } catch { return null; }
}
function saveMode(m: Mode): void { try { localStorage.setItem(KEY, m); } catch { /* ignore */ } }

export function renderModuleGrid(infos?: ModuleInfo[]): HTMLElement {
  return h('div', { class: 'module-grid' }, ...MODULES.map((m) => {
    const info = infos?.find((i) => i.mod.id === m.id);
    return h('a', { class: 'card module-tile', href: href('m', m.id), style: `--accent:${m.color}`,
      'data-activity': info ? (info.activity > 0.6 ? 'high' : info.activity > 0.3 ? 'mid' : 'low') : null },
      h('span', { class: 'tile-icon', 'aria-hidden': 'true' }, m.icon), h('strong', {}, m.name),
      h('span', { class: 'muted small' }, info?.stat ?? m.description));
  }));
}

function glancePanel(): HTMLElement {
  const el = h('section', { class: 'glance', 'aria-label': 'Today at a glance' });
  const paint = async () => {
    const g = await glance();
    const item = (label: string, value: string) => h('a', { class: 'glance-item', href: '#/today' }, h('span', { class: 'muted small' }, label), h('strong', {}, value));
    el.replaceChildren(h('h2', {}, 'Today at a glance'),
      h('div', { class: 'glance-grid' },
        item('Next up', g.nextEvent), item('Tasks due', g.tasks ? String(g.tasks) : 'None'),
        item('Mood', g.mood), item('Routines done', g.routines)));
  };
  void paint();
  watchStores(db.dbEvents, null, () => void paint());
  return el;
}

export function renderHome(): HTMLElement {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGL = webglAvailable();
  let mode: Mode = savedMode() ?? (hasGL && !lowEnd() ? 'brain' : 'grid');
  if (!hasGL) mode = 'grid';

  const stage = h('div', { class: 'home-stage' });
  const toggle = h('button', { type: 'button', class: 'btn btn-sm', 'aria-pressed': 'false' });
  const note = h('p', { class: 'muted small', 'aria-live': 'polite' });
  let dispose: (() => void) | null = null;
  let left = false;
  let token = 0;
  onLeave(() => { left = true; dispose?.(); dispose = null; });

  async function show(m: Mode): Promise<void> {
    const my = ++token;
    dispose?.(); dispose = null;
    mode = m;
    toggle.textContent = m === 'brain' ? '▦ Switch to grid view' : '🧠 Switch to 3D brain';
    toggle.setAttribute('aria-pressed', String(m === 'grid'));
    toggle.disabled = m === 'grid' && !hasGL;
    note.textContent = !hasGL ? '3D view needs WebGL, which is not available in this browser, so the grid is shown.' : '';
    const infos = await moduleInfo();
    if (left || my !== token) return;
    if (m === 'grid') { stage.className = 'home-stage grid'; stage.replaceChildren(renderModuleGrid(infos)); return; }
    stage.className = 'home-stage brain';
    stage.replaceChildren(h('p', { class: 'muted brain-loading' }, 'Loading 3D brain…'));
    try {
      const { mountBrain } = await import('../engine/brain');
      if (left || my !== token) return;
      stage.replaceChildren(h('p', { class: 'visually-hidden' }, 'Interactive 3D brain. Each area of your life is a labeled node; use the buttons to open one. Drag to rotate, scroll or pinch to zoom.'));
      const handle = mountBrain(stage, infos.map((i) => ({ id: i.mod.id, name: i.mod.name, icon: i.mod.icon, color: i.mod.color, stat: i.stat, activity: i.activity })), {
        reducedMotion: reduced,
        onSelect: (id) => navigate(href('m', id)),
        onSlow: () => { saveMode('grid'); toast('3D view was running slowly, so the grid is shown. You can switch back any time.'); void show('grid'); },
        onLost: () => { note.textContent = 'The 3D view stopped (graphics context lost), so the grid is shown.'; void show('grid'); },
      });
      dispose = () => handle.dispose();
    } catch (e) {
      console.warn('3D brain unavailable, using grid', e);
      note.textContent = 'The 3D view could not start on this device, so the grid is shown.';
      if (my === token) { stage.className = 'home-stage grid'; stage.replaceChildren(renderModuleGrid(infos)); toggle.disabled = true; }
    }
  }

  toggle.addEventListener('click', () => { const m: Mode = mode === 'brain' ? 'grid' : 'brain'; saveMode(m); void show(m); });
  void show(mode);

  return h('section', { class: 'home' },
    h('div', { class: 'page-head home-head' },
      h('div', {}, h('h1', {}, 'Your life, at a glance'),
        h('p', { class: 'muted' }, 'Brighter nodes are areas you have updated recently; dim ones could use some attention.')),
      toggle),
    note,
    h('div', { class: 'home-layout' }, stage, glancePanel()));
}

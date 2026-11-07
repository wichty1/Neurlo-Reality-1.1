import './styles/base.css';
import './styles/components.css';
import './styles/pages.css';
import { initDB } from './core/db';
import { currentRoute, onRoute, href, type Route } from './core/router';
import { runLeave, pageCtx } from './core/page';
import { h } from './core/util';
import { getModule, getCollection, allStoreNames } from './modules';
import { buildShell, setActiveNav, setCrumbs, setTheme, getTheme, PAGES } from './ui/shell';
import { closePanel, isPanelOpen } from './ui/panel';
import { renderCollection } from './engine/collection';
import './engine/chart-view';
import './engine/calendar';
import './engine/kanban';
import { startReminders } from './core/reminders';
import './pages/schedule-overview';
import { renderOverview } from './pages/overview';
import { renderHome } from './pages/home';
import { renderToday } from './pages/today';
import { renderSettings } from './pages/settings';
import { installPalette } from './ui/palette';
import { registerPage } from './ui/shell';

registerPage({ id: 'today', name: 'Today', icon: '☀️', position: 'top', render: renderToday });
registerPage({ id: 'settings', name: 'Settings & Data', icon: '⚙️', position: 'bottom', render: renderSettings });

setTheme(getTheme());

function notFound(): HTMLElement {
  return h('section', { class: 'empty' }, h('p', {}, 'That page does not exist.'), h('a', { class: 'btn', href: '#/' }, 'Go home'));
}

function render(r: Route, main: HTMLElement, crumbs: HTMLElement): void {
  runLeave();
  closePanel();
  const home = { label: 'Home', link: '#/' };
  const [p0, p1, p2, p3] = r.parts;
  let el: HTMLElement;
  if (!p0) {
    el = renderHome(); setActiveNav('home'); setCrumbs(crumbs, []);
  } else if (p0 === 'm') {
    const mod = p1 ? getModule(p1) : undefined;
    const col = mod && p2 ? getCollection(mod, p2) : undefined;
    if (!mod || (p2 && !col)) { el = notFound(); setCrumbs(crumbs, []); }
    else if (col) {
      el = renderCollection(mod, col, p3);
      setCrumbs(crumbs, [home, { label: mod.name, link: href('m', mod.id) }, { label: col.name }]);
    } else {
      el = renderOverview(mod);
      setCrumbs(crumbs, [home, { label: mod.name }]);
    }
    setActiveNav(mod?.id ?? '', mod?.color);
  } else {
    const page = PAGES.find((p) => p.id === p0);
    el = page ? page.render(r) : notFound();
    setActiveNav(page?.id ?? '');
    setCrumbs(crumbs, page ? [home, { label: page.name }] : []);
  }
  main.replaceChildren(el);
  window.scrollTo(0, 0);
}

function isTyping(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
}

function shortcuts(): void {
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || isPanelOpen()) return;
    if (e.key === 'n') { e.preventDefault(); document.querySelector<HTMLButtonElement>('.fab')?.click(); }
    else if (e.key === '/' && pageCtx.search) { e.preventDefault(); pageCtx.search.focus(); }
  });
}

async function boot(): Promise<void> {
  const app = document.getElementById('app')!;
  try {
    await initDB(allStoreNames());
  } catch (e) {
    app.replaceChildren(h('div', { class: 'empty' },
      h('h1', {}, 'Storage unavailable'),
      h('p', {}, 'This app stores everything in your browser (IndexedDB), which is blocked here. Private browsing modes sometimes disable it.'),
      h('pre', { class: 'small' }, String(e))));
    return;
  }
  const { main, crumbs } = buildShell(app);
  shortcuts();
  installPalette();
  startReminders();
  onRoute((r) => render(r, main, crumbs));
  render(currentRoute(), main, crumbs);
}

void boot();

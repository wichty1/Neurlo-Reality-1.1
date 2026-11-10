// Side panel (desktop) / bottom sheet (mobile) used for editing records.
import { h } from '../core/util';

let open: { el: HTMLElement; onClose?: () => void; prevFocus: Element | null } | null = null;

export function closePanel(): void {
  if (!open) return;
  const { el, onClose, prevFocus } = open;
  open = null;
  el.classList.remove('show');
  setTimeout(() => el.remove(), 180);
  onClose?.();
  if (prevFocus instanceof HTMLElement) prevFocus.focus();
}

export function isPanelOpen(): boolean { return open !== null; }

export function openPanel(title: string, body: Node, opts: { onClose?: () => void; actions?: Node[] } = {}): HTMLElement {
  closePanel();
  const titleId = 'panel-title';
  const sheet = h('div', { class: 'panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
    h('header', { class: 'panel-head' },
      h('h2', { id: titleId }, title),
      ...(opts.actions ?? []),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close panel', onclick: closePanel }, '×')),
    h('div', { class: 'panel-body' }, body));
  const wrap = h('div', { class: 'panel-wrap' },
    h('div', { class: 'panel-scrim', onclick: closePanel }), sheet);
  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); closePanel(); return; }
    if (e.key !== 'Tab') return;
    // Minimal focus trap.
    const f = sheet.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex="0"]');
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  open = { el: wrap, onClose: opts.onClose, prevFocus: document.activeElement };
  document.body.append(wrap);
  requestAnimationFrame(() => {
    wrap.classList.add('show');
    const target = sheet.querySelector<HTMLElement>('.panel-body input, .panel-body textarea, .panel-body select');
    (target ?? sheet.querySelector<HTMLElement>('button'))?.focus();
  });
  return sheet;
}

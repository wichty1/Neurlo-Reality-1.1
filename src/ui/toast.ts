// Toast notifications with an optional action (used for Undo).
import { h } from '../core/util';

let host: HTMLElement | null = null;

export function toast(message: string, action?: { label: string; run: () => void }, ms = action ? 7000 : 2500): void {
  if (!host) {
    host = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(host);
  }
  const el = h('div', { class: 'toast' }, h('span', {}, message));
  let done = false;
  const close = () => { if (!done) { done = true; el.classList.add('out'); setTimeout(() => el.remove(), 200); } };
  if (action) {
    el.append(h('button', { class: 'btn btn-sm', type: 'button', onclick: () => { action.run(); close(); } }, action.label));
  }
  el.append(h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Dismiss', onclick: close }, '×'));
  while (host.children.length >= 3) host.firstElementChild?.remove();
  host.append(el);
  setTimeout(close, ms);
}

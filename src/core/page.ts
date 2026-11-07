// Page lifecycle: pages register cleanups (event listeners, timers) that run on navigation,
// and may expose a primary "new" action (floating + button, "n" key) and a search box ("/" key).
const cleanups: (() => void)[] = [];

export const pageCtx: { fab: (() => void) | null; search: HTMLInputElement | null } = { fab: null, search: null };

export function onLeave(fn: () => void): void { cleanups.push(fn); }

export function runLeave(): void {
  pageCtx.fab = null;
  pageCtx.search = null;
  while (cleanups.length) {
    try { cleanups.pop()!(); } catch (e) { console.warn('cleanup failed', e); }
  }
}

/** Subscribe to DB changes for the lifetime of the current page. */
export function watchStores(target: EventTarget, stores: string[] | null, fn: () => void): void {
  const handler = (e: Event) => {
    const s = (e as CustomEvent<string>).detail;
    if (!stores || stores.includes(s)) fn();
  };
  target.addEventListener('change', handler);
  onLeave(() => target.removeEventListener('change', handler));
}

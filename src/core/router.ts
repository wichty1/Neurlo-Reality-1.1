// Hash router: works from any static host or file path without server rewrites.

export interface Route { parts: string[]; query: URLSearchParams; }

export function currentRoute(): Route {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs = ''] = raw.split('?');
  return { parts: path.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(qs) };
}

export function href(...parts: string[]): string {
  return '#/' + parts.map(encodeURIComponent).join('/');
}

export function navigate(path: string): void {
  const target = path.startsWith('#') ? path : '#' + (path.startsWith('/') ? path : '/' + path);
  if (location.hash === target) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = target;
}

export function onRoute(fn: (r: Route) => void): void {
  window.addEventListener('hashchange', () => fn(currentRoute()));
}

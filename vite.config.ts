import { defineConfig, type Plugin } from 'vite';
import { createHash } from 'node:crypto';

/**
 * Emits sw.js after bundling with the exact list of built files, so the whole app (including the
 * lazily loaded 3D brain chunk) is cached for offline use. No third-party service worker tooling.
 */
function offlineServiceWorker(): Plugin {
  return {
    name: 'neurlo-offline-sw',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const extra = ['manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];
      const assets = ['./', ...[...files, ...extra].map((f) => `./${f}`)];
      const version = createHash('sha256').update(assets.join('|')).digest('hex').slice(0, 10);
      const source = `// Generated at build time. Caches the app shell for offline use; never contacts other origins.
const CACHE = 'neurlo-${version}';
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('neurlo-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // Network first so updates arrive; fall back to the cached shell when offline.
    e.respondWith(fetch(req).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('./'))));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  })));
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

// base './' makes the built folder work from any static host path or subfolder.
export default defineConfig({
  base: './',
  plugins: [offlineServiceWorker()],
  // The 3D brain chunk (three.js) is ~570 kB but lazy-loaded only for the brain view.
  build: { outDir: 'dist', assetsInlineLimit: 0, sourcemap: false, chunkSizeWarningLimit: 700 },
});

import { defineConfig } from 'vite';

// base './' makes the built folder work from any static host path or subfolder.
export default defineConfig({
  base: './',
  // The 3D brain chunk (three.js) is ~570 kB but lazy-loaded only for the brain view.
  build: { outDir: 'dist', assetsInlineLimit: 0, sourcemap: false, chunkSizeWarningLimit: 700 },
});

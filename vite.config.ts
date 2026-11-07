import { defineConfig } from 'vite';

// base './' makes the built folder work from any static host path or subfolder.
export default defineConfig({
  base: './',
  build: { outDir: 'dist', assetsInlineLimit: 0, sourcemap: false },
});

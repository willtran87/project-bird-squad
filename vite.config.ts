import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: '.artifacts/build',
    emptyOutDir: true
  },
  server: {
    port: 5173,
    strictPort: false
  },
  preview: {
    port: 4173
  }
});

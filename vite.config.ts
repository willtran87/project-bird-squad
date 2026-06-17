import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: '.artifacts/build',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const moduleId = id.replace(/\\/g, '/');
          if (moduleId.includes('node_modules/phaser')) return 'vendor-phaser';
          if (
            moduleId.includes('/src/game/codex-data')
            || moduleId.includes('/data/cards/arcana/')
            || moduleId.includes('/data/game/bird-facts.json')
            || moduleId.includes('/data/game/card-meanings.json')
            || moduleId.includes('/data/game/enemy-variety-contracts.json')
          ) return 'codex-data';
          if (moduleId.includes('node_modules')) return 'vendor';
        }
      }
    }
  },
  server: {
    port: 5173,
    strictPort: false
  },
  preview: {
    port: 4173
  }
});

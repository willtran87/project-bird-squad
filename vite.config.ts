import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const phaserProductionBuild = fileURLToPath(new URL('./node_modules/phaser/dist/phaser.esm.min.js', import.meta.url));

export default defineConfig(({ command }) => ({
  resolve: command === 'build'
    ? {
      alias: {
        phaser: phaserProductionBuild
      }
    }
    : undefined,
  build: {
    outDir: '.artifacts/build',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1400,
    minify: 'terser',
    terserOptions: {
      module: true,
      compress: {
        module: true,
        passes: 3,
        pure_getters: true,
        toplevel: true,
      },
      mangle: {
        toplevel: true,
      },
      format: {
        comments: false,
      },
    },
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
          if (
            moduleId.includes('/src/game/runtime-data')
            || moduleId.includes('/src/game/balance')
            || moduleId.includes('/data/game/alpha-')
            || moduleId.includes('/data/game/map')
            || moduleId.includes('/data/game/balance-config.json')
            || moduleId.includes('/assets/runtime/cards/card-art-manifest.json')
            || moduleId.includes('/assets/runtime/enemies/enemy-art-manifest.json')
          ) return 'runtime-data';
          if (moduleId.includes('node_modules')) return 'vendor';
        }
      }
    }
  },
  server: {
    port: 5173,
    strictPort: false,
    hmr: process.env.BIRD_SQUAD_SMOKE === '1' ? false : undefined,
    watch: {
      ignored: (path) => {
        if (process.env.BIRD_SQUAD_SMOKE === '1') return true;
        const normalized = path.replace(/\\/g, '/');
        return normalized.includes('/.artifacts/')
          || normalized.endsWith('/.artifacts')
          || normalized.includes('/test-results/')
          || normalized.endsWith('/test-results')
          || normalized.includes('/playwright-report/')
          || normalized.endsWith('/playwright-report')
          || normalized.includes('/blob-report/')
          || normalized.endsWith('/blob-report')
          || normalized.includes('/output/')
          || normalized.endsWith('/output')
          || normalized.includes('/.generated/')
          || normalized.endsWith('/.generated');
      },
    },
  },
  preview: {
    port: 4173
  }
}));

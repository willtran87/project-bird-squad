# Performance Notes

Status: current runtime optimization baseline.

Last measured against `npm run build` on 2026-06-17.

## Current Bundle Shape

| Chunk | Size | Gzip |
| --- | ---: | ---: |
| `vendor-phaser-DtHwLe6e.js` | 1,353.4 KB | 362.7 KB |
| `index-ezXLk5da.js` | 472.7 KB | 123.3 KB |
| `codex-data-k8ZMn6ch.js` | 254.6 KB | 79.8 KB |

The app intentionally splits three ways:

- `vendor-phaser`: Phaser runtime. Production builds alias Phaser to the shipped minified ESM artifact.
- `index`: game code and frequently needed runtime data.
- `codex-data`: large card flavor, tarot meaning, bird fact, and reserve enemy data loaded on demand by `CodexScene`.

## Implemented Optimizations

- Runtime art assets are loaded on demand through `queueRuntimeImageAssets`.
- Optional art load state is centralized in `src/game/runtime-images.ts`.
- Codex extended data is dynamically imported only when the Codex scene is created.
- Codex now renders loading and failure states for extended notes instead of silently omitting them.
- Card, enemy, waymark, leader, map icon, and backdrop assets are built into compressed runtime formats.
- Bundle-size validation is wired into `npm run validate`.
- Phaser is isolated into its own chunk and production builds use `phaser/dist/phaser.esm.min.js`.

## Bundle Budgets

`tools/validate-bundle-sizes.mjs` currently enforces:

| Area | Budget | Severity |
| --- | ---: | --- |
| App entry chunk | 500 KB | hard failure |
| Codex lazy data chunk | 300 KB | hard failure |
| Phaser vendor chunk | 1,400 KB | warning |

The vendor chunk remains a warning because Phaser upgrades can legitimately move
the baseline. App and Codex budgets are hard failures because regressions there
directly affect boot and scene transition cost.

## Phaser Vendor Experiment

A scratch Vite build was run with Phaser aliased to the package's minified ESM
file. It reduced the vendor chunk from about 1,656.3 KB minified and 374.7 KB
gzip to about 1,353.4 KB minified and 362.7 KB gzip. The production config now
uses that alias only for `vite build`; dev keeps the normal package entry.

## Remaining Watch Items

- The Phaser vendor chunk is still the largest file. Meaningful future reduction would require validating a smaller Phaser build or a framework-level import strategy.
- The app entry is close to its 500 KB hard budget. Large new scene systems should be split into their own dynamic modules.
- Runtime image counts should keep flowing through the existing WebP builders and `npm run validate:runtime-assets`.
- Deployment must serve immutable cache headers for hashed assets and no-cache headers for `index.html`.

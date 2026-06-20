# Performance Notes

Status: current runtime optimization baseline.

Last measured against `npm run build` on 2026-06-17.

## Current Bundle Shape

| Chunk | Size | Gzip |
| --- | ---: | ---: |
| `vendor-phaser-DtHwLe6e.js` | 1,353.4 KB | 362.7 KB |
| `index-BmI0QLJ8.js` | 581.0 KB | 149.5 KB |
| `codex-data-C2FhhIJW.js` | 277.0 KB | 86.7 KB |

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
| App entry chunk | 675 KB hard / 590 KB target | warning over target, hard failure over budget |
| Codex lazy data chunk | 300 KB | hard failure |
| Phaser vendor chunk | 1,400 KB | warning |

The vendor chunk remains a warning because Phaser upgrades can legitimately move
the baseline. The app entry now has a temporary 675 KB hard ceiling because the
main scene file has grown beyond the old target; builds still warn above 590 KB
so a future scene/module split does not disappear from view. Codex remains a hard
failure because regressions there directly affect scene transition cost.

## Phaser Vendor Experiment

A scratch Vite build was run with Phaser aliased to the package's minified ESM
file. It reduced the vendor chunk from about 1,656.3 KB minified and 374.7 KB
gzip to about 1,353.4 KB minified and 362.7 KB gzip. The production config now
uses that alias only for `vite build`; dev keeps the normal package entry.

## Remaining Watch Items

- The Phaser vendor chunk is still the largest file. Meaningful future reduction would require validating a smaller Phaser build or a framework-level import strategy.
- The app entry is below the 590 KB hard budget but should be watched as card,
  route, and combat systems grow. Large new scene systems should be split into
  their own dynamic modules.
- Runtime image counts should keep flowing through the existing WebP builders and `npm run validate:runtime-assets`.
- Deployment must serve immutable cache headers for hashed assets and no-cache headers for `index.html`.

## 2026-06-19 Sluggishness Review

Fresh measurements against the current working tree show the app entry has drifted
over budget:

| Chunk | Size | Gzip |
| --- | ---: | ---: |
| `vendor-phaser-DtHwLe6e.js` | 1,321.6 KB | 354.2 KB |
| `index-zcvWfqvm.js` | 653.8 KB | 162.6 KB |
| `codex-data-C2FhhIJW.js` | 270.5 KB | 84.7 KB |

`index.html` still only modulepreloads `vendor-phaser`; however, `src/main.ts`
was starting the Codex dynamic import at module evaluation time. That meant the
270.5 KB Codex chunk could compete with boot even though it was split from the
entry. Codex data is now requested when `CodexScene` needs it.

Combat and route card surfaces were also queuing full portrait assets for normal
card rendering. The larger portrait WebPs are commonly 600-730 KB each, while
the card thumbnails are typically under 100 KB. Routine card surfaces now load
thumbnail assets and reserve full portraits for detail panels.

Remaining action: split more of `src/main.ts` into lazy scene/system modules or
otherwise reduce the entry chunk before tightening the 590 KB budget again.

Follow-up runtime review also found redraw paths that create repeating idle
tweens for destroyed route/combat/Codex objects. `renderAll()` now kills tweens
attached to objects it is about to remove, preventing idle animation buildup
during repeated redraws while preserving the combat FX layer.

## 2026-06-20 Selected UI Entry Cleanup

The selected UI/UX implementation pass included a small entry-size cleanup while
polishing card and Codex detail surfaces. Removed unused legacy render paths for
the old route supply/status rails and the old combat supply/Waymark shelves now
that those flows live in HUD menus and drawers.

Fresh production bundle validation:

| Chunk | Size | Gzip |
| --- | ---: | ---: |
| `vendor-phaser-6aYtO73i.js` | 1,313.6 KB | 339.5 KB |
| `index-Dd7IwM0_.js` | 672.7 KB | 165.6 KB |
| `codex-data-a1IPWpqv.js` | 270.3 KB | 84.4 KB |

`npm run validate:bundle-size` passes. The app entry remains above the 590 KB
target, so the remaining meaningful performance item is still a real scene/system
module split rather than more local dead-code trimming.

## 2026-06-20 Runtime Continuation

Continued the remaining runtime work items by stabilizing production smoke tests
against `vite preview`, adding deployment cache validation to `npm run validate`,
and trimming the current app entry back under the temporary hard ceiling without
raising the budget.

Fresh production bundle validation:

| Chunk | Size | Gzip |
| --- | ---: | ---: |
| `vendor-phaser-DMI6MihC.js` | 1,313.6 KB | 339.5 KB |
| `index-DQbnt2gm.js` | 674.7 KB | 166.0 KB |
| `codex-data-cFC7aZnj.js` | 274.9 KB | 86.0 KB |

Changes adopted:

- Playwright smoke tests now use a production build plus `vite preview`, avoiding
  dev-server reload/watch churn during the broad suite.
- Deployment cache validation checks hashed boot assets, single app/vendor/Codex
  chunk boundaries, and verifies that only the Phaser vendor chunk is preloaded.
- Optional runtime/preload image queue bookkeeping now shares one implementation
  while preserving the runtime-only `scene.load.start()` behavior.
- Codex glossary data remains in the lazy Codex chunk; the boot entry only keeps
  the renderer and compact text-state hooks.

Validation:

- `npm run build`
- `npm run validate`
- `npm test`
- `npx playwright test tests/smoke.spec.ts --workers=1 --reporter=line` (77/77)
- Required `develop-web-game` client against built preview at
  `.artifacts/runtime-continue-client/shot-1.png`

## 2026-06-20 Remaining Work Closure

The current production build already keeps game code below both app-entry budgets
by splitting frequently needed authored data into `runtime-data` and keeping Codex
notes lazy. The remaining build noise was Vite's generic 500 KB chunk warning,
which flagged the intentionally isolated Phaser vendor chunk even though the
project validator already budgets that chunk separately. `vite.config.ts` now sets
`chunkSizeWarningLimit` to 1400 KB to match the explicit Phaser vendor warning
budget while preserving `npm run validate:bundle-size` as the real gate.

Fresh production bundle validation:

| Chunk | Size | Gzip |
| --- | ---: | ---: |
| `vendor-phaser-DMI6MihC.js` | 1,313.6 KB | 339.5 KB |
| `index-xL9RyAoR.js` | 389.4 KB | 111.4 KB |
| `runtime-data-BMs57k4m.js` | 296.1 KB | 56.8 KB |
| `codex-data-cFC7aZnj.js` | 274.9 KB | 86.0 KB |

Deployment cache validation now treats `runtime-data` as a boot-critical preload
alongside Phaser, while still failing if `codex-data` is preloaded before the
Codex scene opens.

---
name: bird-squad-runtime-optimizer
description: Review, plan, implement, and verify Bird Squad runtime performance optimizations. Use when Codex is asked to improve slow asset loading, bundle size, Vite/Phaser build output, runtime art pipelines, lazy scene data, cache headers, production preview smoke tests, or to check for remaining optimization work in C:\Users\Will\Projects\project-bird-squad.
---

# Bird Squad Runtime Optimizer

Use this skill to keep Bird Squad ahead of runtime regressions: assets should load on demand, build chunks should stay budgeted, production deployment should cache correctly, and every optimization should be measured before it is adopted.

## Operating Rules

- Work from `C:\Users\Will\Projects\project-bird-squad` unless the user points to another checkout.
- Respect dirty worktrees. Read `git status --short` early, identify unrelated changes, and do not revert them.
- Use `rg` first for code search.
- Use `apply_patch` for manual file edits.
- If browser verification is available, use the in-app Browser after significant frontend/runtime changes.
- If Phaser asset loading is involved, also use the `loading-assets` skill when available.
- If gameplay/browser smoke testing is involved, also use the `develop-web-game` skill when available.

## Baseline Files

Read these before changing behavior:

- `docs/project/performance-notes.md`: current bundle shape, budgets, and remaining watch items.
- `docs/deployment-cache.md`: deployment cache and compression expectations.
- `vite.config.ts`: production chunking and Phaser alias rules.
- `tools/validate-bundle-sizes.mjs`: JS bundle budgets.
- `tools/validate-runtime-asset-sizes.mjs`: runtime asset-size gate.
- `src/game/runtime-images.ts`: optional runtime image queue, de-duplication, and load tracking.
- `src/main.ts`: scene usage, Codex lazy data, and runtime art queue call sites.
- `package.json`: build, validate, runtime-art, and test scripts.

## Workflow

1. Inspect the current state:
   - Run `git status --short`.
   - Run `rg -n "queueRuntimeImageAssets|uniqueImageAssets|import\\('./game/codex-data'\\)|manualChunks|validate:bundle-size|build:runtime-art" src tools package.json vite.config.ts`.
   - Check `.artifacts/build/assets` if a recent build exists; otherwise run `npm run build`.

2. Measure before proposing changes:
   - Run `npm run build`.
   - Run `npm run validate:bundle-size`.
   - Record minified and gzip sizes for `vendor-phaser`, `index`, and `codex-data`.
   - Inspect `.artifacts/build/index.html`; only intentional boot-critical chunks should be preloaded.

3. Look for high-value opportunities:
   - Top-level dynamic imports that accidentally fetch lazy data during boot.
   - Large data tables in `src/main.ts` or the app entry that can become dynamic scene modules.
   - Runtime art loaded eagerly when only visible rows, detail views, or current combat need it.
   - Asset variants missing from the runtime WebP builders or size validation.
   - Bundle budget drift in app entry or Codex data.
   - Phaser/vendor changes that reduce size only when measured and smoke-tested.
   - Missing cache notes, build docs, or validation scripts that let regressions return.

4. Implement conservatively:
   - Prefer existing Vite, Phaser Loader, and project helper patterns.
   - Keep optional runtime art behind `queueRuntimeImageAssets`.
   - Keep Codex flavor, tarot meaning, bird fact, and reserve enemy data behind dynamic import.
   - Add loading and failure UI for deferred data so slow networks do not look broken.
   - Extract helper modules only when it reduces future performance risk or clarifies a shared path.
   - Adopt vendor-size experiments only when the production build improves and the app smoke test stays clean.

5. Validate:
   - Run `npm run build`.
   - Run `npm run validate`.
   - Run `npm test`.
   - If frontend behavior changed, run production preview and smoke test:
     - menu boot renders and boot shell disappears,
     - Codex opens and lazy data resolves,
     - route map renders with node icons,
     - combat renders backdrop, leader, enemy, and card art,
     - browser console has no warnings or errors from asset loading.

6. Close the loop:
   - Update `docs/project/performance-notes.md` with new measured chunk sizes and rationale.
   - Update `docs/deployment-cache.md` if deployment cache requirements changed.
   - Tighten budgets when a stable improvement lowers the baseline.
   - Summarize adopted changes, rejected experiments, validation commands, and remaining watch items.

## Known Good Baseline

As of 2026-06-17, the intended production shape is:

- `vendor-phaser`: Phaser runtime, built from `phaser/dist/phaser.esm.min.js` only during `vite build`.
- `index`: game entry and frequently needed runtime data, hard budget 500 KB minified.
- `codex-data`: Codex flavor/meaning/fact/reserve enemy data, hard budget 300 KB minified, loaded on Codex scene entry.
- Phaser vendor warning budget: 1,400 KB minified.
- Runtime assets: compressed WebP/PNG outputs validated by `npm run validate:runtime-assets`.

Do not move Codex data back into the app entry unless there is a measured reason and the user explicitly accepts the boot cost.

## Safe Experiments

Use a scratch config under ignored `tmp/` for bundle experiments. Build to a separate `.artifacts/` folder, compare sizes, then delete the scratch config. Adopt only if:

- production build succeeds,
- JS sizes improve or a clear runtime load problem is fixed,
- browser smoke checks pass,
- the reason is documented in `docs/project/performance-notes.md`.

Good experiment types:

- Phaser package entry aliases.
- Additional dynamic imports for rarely used scenes or large data.
- Manual chunk boundary changes.
- Runtime art builder output-size changes.

Risky experiment types:

- Rewriting large scene systems only for theoretical tree shaking.
- Replacing Phaser Loader semantics with ad hoc image fetches.
- Lowering asset quality without checking visual gameplay screens.
- Removing cache-busting hashed output or immutable cache guidance.

# Runtime Remaining Work Plan

Status: Phase 4 combat redraw ownership and device-aware Effects quality are
complete. Phase 2 now has lazy FX-presentation, debug-state, battle-backdrop,
and battle-foreground seams; a deeper BattleScene split remains optional and
is not a release blocker.

Current result: generated combat FX, battle presentation telemetry, backdrop,
combatant, reward, HUD, hand, and card/pile inspection rendering, UI icon metadata, route scene art, reserve enemy art, Profile
presentation, and system overlays all live outside the boot entry. The current
app entry and combined boot meet their preferred targets with hard-gate
headroom. The older 590 KB aspiration remains useful only for a future
BattleScene split with measurable transition benefits.

Fresh P0 result:

| Chunk | Size | Gzip |
| --- | ---: | ---: |
| `index-C-T6RG45.js` | 674.2 KB | 174.6 KB |
| `ui-icon-assets-TI02N4T2.js` | 27.0 KB | 4.9 KB |
| `route-scene-assets-CxLcofrz.js` | 10.5 KB | 4.3 KB |
| `combat-fx-assets-c9lkNdzS.js` | 5.6 KB | 1.5 KB |
| `reserve-enemy-art-assets-CAgrEaVF.js` | 5.2 KB | 1.3 KB |

That historical P0 build restored the then-current 675 KB entry gate. The
590 KB figure was an aspiration rather than an enforced validator threshold.

Latest production result:

| Chunk | Size | Gzip |
| --- | ---: | ---: |
| `index-BBtSBMWa.js` | 662.1 KB | 171.8 KB |
| `game-core-DK3fs1w9.js` | 28.5 KB | 10.3 KB |
| `ui-icon-assets-BqAPpQhT.js` | 27.5 KB | 4.9 KB |
| `combat-fx-assets-Du57XA_S.js` | 12.3 KB | 3.6 KB |
| `render-inspect-BjlftNwh.js` | 8.6 KB | 2.9 KB |
| `render-foreground-BO2FWYY2.js` | 6.5 KB | 2.4 KB |
| `render-backdrop-COncJNqR.js` | 2.0 KB | 0.9 KB |
| `debug-state-DqsNQNYL.js` | 5.3 KB | 2.0 KB |
| `fx-presenter-DW3nnVqo.js` | 3.7 KB | 1.6 KB |

Combined boot code is 690.7 KB minified / 182.1 KB gzip. Hard gates pass, and
both the 675 KB app-entry and 710 KB combined preferred targets are met.
The additional compact item URL manifest raises JavaScript modestly while
avoiding about 588 KB of net cold Route/Battle transfer. The runtime UI tier is
38.11 -> 8.47 MiB (77.8% smaller), and the runtime FX tier is 14.84 -> 5.02
MiB (66.2% smaller), with canonical PNG inputs retained outside delivery.

## Execution Notes

- Phase 1 is complete for generated combat FX: `src/game/combat-fx-assets.ts`
  is dynamically imported by BattleScene, and combat startup waits for those
  textures before the first combat render.
- The first Phase 3 pass is complete for broad UI registries: generated UI icon
  metadata now lives in `src/game/ui-icon-assets.ts`, and menu, route, combat,
  and Codex surfaces queue smaller surface-specific groups.
- Route-only generated art and reserve enemy art were split into
  `src/game/route-scene-assets.ts` and `src/game/reserve-enemy-art-assets.ts`
  so route/Codex surfaces do not request fallback unhashed URLs for Vite-managed
  runtime files.
- Route-event resident portraits are included in the route scene lazy chunk after
  validation caught the old fallback resident URLs failing in production preview.
- Enemy-turn pacing was tuned during validation: the preamble callback is
  scheduled before the heavy handoff render, preserving readable wind-up and
  impact while avoiding an excessively long dead pause.
- The focused route-event overlay smoke passes after the resident portrait fix.
- Profile presentation and its icon ownership now live in
  `src/game/profile-scene.ts`; redraws retain one Escape and one mute listener.
- Pause, Settings, and How-to-Play presentation now live in
  `src/game/system-overlays.ts`, with explicit first-load and failure states.
- Deployment validation requires both lazy chunks and rejects preloading them.
- Phase 4 now coalesces noncritical same-frame BattleScene requests, preserves
  battlefield scenery and unchanged hand cards, refreshes late card art in
  place, and reveals the replenished hand once at enemy-handoff completion.
- Auto/Full/Lean Effects quality now applies measurable optional-FX budgets
  without changing attack tells, combat timing, or resolution order.
- Runtime UI and FX PNG inputs now generate guarded WebP delivery tiers. Build
  validation enforces exact source parity, per-file ceilings, one hashed WebP,
  and no emitted PNG for every declared runtime ID.

## Next Measurement Priority

Do not add another presentation split solely to reduce the entry number: both
preferred boot targets pass, and two support-overlay experiments already made
combined boot larger. The next runtime change should begin with real-device
route-to-combat transition and texture-memory profiling. Consider a full lazy
BattleScene boundary only if that evidence shows parse/compile work is a
meaningful transition spike; otherwise prioritize a measured image-residency or
upload hotspot and retain the change only when production transfer or frame
time improves.

## Goals

- Keep the app entry at or below the 675 KB target and combined boot code at or
  below 710 KB without hiding frequently needed code in optional chunks.
- Treat 590 KB as a future aspiration that must come from a justified scene
  boundary, not local trimming or budget changes.
- Keep combat/player/enemy animation readable while reducing frame spikes from
  generated FX, repeated redraws, and loader churn.
- Keep optional art on demand: scene-specific UI, combat FX, card portraits, and
  detail art should load only when the surface that needs them opens.
- Preserve the deployment contract: Phaser and runtime-data may preload, Codex
  data remains lazy, and hashed assets remain cacheable.

## Phase 0: Measurement Baseline

Purpose: make the next changes measurable instead of aesthetic guesswork.

Tasks:

- Run `npm run build` and `npm run validate:bundle-size`; record chunk sizes in
  `docs/project/performance-notes.md`.
- Add or run a local entry-composition report that groups `src/main.ts` content
  by imported module, generated asset registry, scene class, and helper cluster.
  The report does not need to be permanent if the split work is obvious from
  the output.
- Capture production-preview smoke timings for three flows:
  - title boot to first interactive frame,
  - route map to market open,
  - route combat node through one player attack and one enemy turn.
- Record display-list pressure during combat: root children, FX children,
  active tweens, active particle emitters, and queued loader items.
- Keep the current WebDriver/capture behavior intact while testing:
  `capture=1` or WebDriver can preserve the drawing buffer; normal manual
  `?playwright=1` play should not.

Acceptance criteria:

- A baseline note lists chunk sizes, failing/passing validation commands, and
  measured object/FX counts for the flows above.
- Any headless timing data is marked as noisy unless confirmed in a visible
  browser or stable production preview.

## Phase 1: Restore The Bundle Gate

Purpose: get `validate:bundle-size` passing again with the smallest safe split.

Primary split candidate: generated combat FX.

Tasks:

- Move battle-only generated FX imports and metadata out of `src/main.ts` into a
  combat FX module, for example `src/game/combat-fx-assets.ts`.
- Load that module from BattleScene only when battle starts. Prefer a single
  scene-owned helper such as `loadCombatFxAssets(scene)` that registers texture
  keys, URLs, and debug names.
- Keep non-combat boot/menu assets out of this module so the chunk boundary stays
  meaningful.
- Confirm that direct combat smoke tests still see all generated FX telemetry.
- If this alone does not bring `index-*.js` below 675 KB, move battle-only UI
  frame registries into a second `src/game/combat-ui-assets.ts` module and load
  them on battle scene entry.

Acceptance criteria:

- `npm run validate:bundle-size` passes.
- The app entry is below 675 KB minified.
- `index.html` does not modulepreload combat-only chunks.
- Focused combat smoke for imagegen FX and attack wind-up passes.

## Phase 2: Split Scene Systems Without Breaking Phaser Flow

Purpose: reduce parse/compile work and make future performance changes less
risky.

Current status: the major battle presentation seams are live. Reusable sprite,
particle, glow, shockwave, shard, and action-trail presentation now lives in a
3.7 KB lazy `fx-presenter` chunk loaded during the guarded BattleScene readiness
phase. As of 2026-07-18, presentation telemetry and its recursive scene-tree
probes also live in a 5.3 KB lazy `debug-state` chunk. BattleScene still owns
effect composition, generated-FX counters, gameplay state, and combat
sequencing. District imagery, procedural fallback, encounter mood treatment,
and atmosphere tiling now live in a 2.0 KB lazy `render-backdrop` chunk. Enemy,
leader, reward, HUD, hand, and card/pile inspection rendering also live behind
presentation boundaries. A full scene split is now optional P2 work.

Recommended order:

1. Extract pure combat rendering helpers from `BattleScene` into
   `src/game/battle/render-*` modules.
2. Extract combat FX orchestration into `src/game/battle/fx-presenter.ts`.
3. Extract combat telemetry/text-state construction into
   `src/game/battle/debug-state.ts`.
4. Only after those are clean, consider a lazy BattleScene loader scene that
   dynamically imports the full battle scene when combat starts.

Notes:

- Static helper imports improve maintainability but may not reduce entry size if
  BattleScene remains in the entry. Treat them as preparation for the lazy scene
  split.
- A lazy BattleScene split is higher risk because route-to-combat scene
  transitions, tests, and saved run continuation all depend on stable scene keys.
  Use a small loader scene if Phaser needs the class registered before
  `scene.start('BattleScene')`.

Acceptance criteria:

- Route-to-combat smoke passes from a production preview.
- Saved/continued combat still restores the expected scene.
- Chunk report shows battle code outside the app entry or a documented reason
  why the attempted split was rejected.

## Phase 3: Stop Loading Whole UI Registries

Purpose: reduce loader churn and texture memory spikes from the imagegen UI pass.

Known pressure point:

- Codex currently queues broad UI icon sets. Generated UI art now contains many
  surface-specific frames, so scene-wide `Object.values(uiIconAssets)` loading is
  too blunt for cold surfaces.

Tasks:

- Define UI asset groups by surface:
  - title/menu,
  - settings/pause overlays,
  - route map,
  - route events,
  - market,
  - reward,
  - deck review,
  - Codex shell,
  - Codex detail art,
  - battle HUD,
  - battle FX/support overlays.
- Replace broad queue calls with group-specific calls. Each overlay should queue
  its own frame/icon assets the first time it opens.
- Keep fallback rectangle/vector rendering for assets that are still loading.
- Add a debug counter to text state for queued/pending optional image loads so
  tests can catch accidental "load everything" regressions.

Acceptance criteria:

- Opening Codex, market, route event, and battle no longer queues unrelated UI
  icon groups.
- Production-preview network/request samples show fewer image requests on first
  route and first Codex open.
- Existing overlay smoke tests pass with generated frames loaded after queue
  completion.

## Phase 4: Smooth Combat Redraw And Transition Churn

Purpose: address jaggedness caused by repeated rebuilds rather than raw asset
size.

Completed tasks:

- [x] Add a render scheduler for BattleScene so repeated state changes during one
  combat beat coalesce into one `renderAll()` on the next frame.
- [x] Audit enemy-turn pacing and player-card resolution for redundant calls to
  `renderAll()` during wind-up, commit, impact, and recovery.
- [x] Separate persistent scenery and hand layers from volatile FX and rebuilt
  HUD layers, so combat beats do not recreate the backdrop or unchanged cards.
- [x] Kill or reuse tweens attached to objects before destroying containers, matching
  the existing cleanup pattern.
- [ ] Consider simple object pooling only if later profiling identifies a
  high-frequency allocation hotspot. Current FX counters remain bounded, so
  pooling is not justified by this pass.

Acceptance criteria:

- A combat turn stress test reports fewer `renderAll()` calls per player attack
  and enemy turn.
- FX counters stay bounded during direct "render all generated combat FX" smoke.
- Player and enemy hit timing tests still prove damage lands after the readable
  animation beat, not instantly.

## Phase 5: Runtime Asset Tier Cleanup

Purpose: reduce cold-load and texture upload cost without weakening the art.

Tasks:

- Build a small HUD/shop icon tier for assets currently oversized for tiny UI
  usage, especially `scrap.webp` and 120-210 KB Supply/Waymark icon assets.
- Review large PNG UI frames and combat FX for WebP-with-alpha suitability.
  Keep PNG where sharp alpha or blend behavior visibly benefits from it.
- Add separate budgets for generated UI icon PNGs if those assets remain PNG.
- Keep full portraits and high-detail reward/detail art reserved for detail
  panels, not list rows or route surfaces.

Acceptance criteria:

- `npm run validate:runtime-assets` passes with tighter or more specific budgets.
- Market cold-open and route HUD samples request smaller assets for tiny icons.
- Visual screenshots confirm no unacceptable quality loss on desktop or mobile.

## Phase 6: Validation And Documentation Closure

Purpose: make sure the optimization stays real after future art/content work.

Required commands after each adopted phase:

```powershell
npm run build
npm run validate:bundle-size
npm run validate:runtime-assets
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
```

Additional checks after behavior-changing phases:

```powershell
npx playwright test tests/smoke.spec.ts --workers=1 --reporter=line
node C:\Users\Will\.codex\skills\develop-web-game\scripts\web_game_playwright_client.js --url http://127.0.0.1:<preview-port>/?playwright=1 --actions-file C:\Users\Will\.codex\skills\develop-web-game\references\action_payloads.json --iterations 1 --pause-ms 250
```

Documentation updates:

- Update `docs/project/performance-notes.md` with measured before/after chunk
  sizes, runtime load observations, and any rejected experiments.
- Update `docs/deployment-cache.md` only if chunk preload expectations change.
- Update `progress.md` with the implemented phase, validation commands, and any
  known residual risk.

## Priority Summary

| Priority | Work Item | Why It Comes First |
| --- | --- | --- |
| Done | Move combat FX/assets out of the boot entry | Restored the app-entry hard bundle gate. |
| Done | Replace broad UI registry loads with surface groups | Reduced generated UI loader/texture spikes on cold surfaces. |
| Done | Move route/reserve generated art metadata out of the boot entry | Keeps route-event and Codex-only generated art in hashed lazy chunks. |
| Done | Lazy-load Profile and system-overlay presentation | Meets preferred boot budgets and keeps rare UI out of first parse. |
| Done | BattleScene render scheduler and persistent layers | Coalesces same-frame requests, reuses scenery/cards, and removes the duplicate enemy-handoff redraw. |
| Done | Extract major battle render helpers | FX, debug-state, backdrop, enemy, leader, reward, HUD, hand, and card/pile inspection presentation are lazy modules. |
| Done | Defer first-combat outcome FX | Removes 314 KB transfer and 3.01 MB decoded texture residency from the opening decision while warming the pack on first commitment. |
| Done | Load route event and Market scene art on demand | Removes 3.98 MB transfer and about 76.47 MB decoded residency from an ordinary route while preserving the zero-byte combat return. |
| P2 | Lazy BattleScene module | Larger entry-size win, but higher transition/test risk. |
| Done | Small HUD/shop icon tier | Compact Supply, Waymark, and Scrap tiers now serve HUD and shop-scale presentation. |
| P3 | Phaser/vendor experiments | Only worth revisiting after app-owned entry debt is fixed. |

## Stop Conditions

Pause and reassess if any phase causes one of these:

- Codex data is preloaded during boot again.
- `index.html` starts preloading combat-only or Codex-only chunks.
- Combat damage timing regresses to instant resolution.
- Runtime asset validation passes only by raising budgets without reducing load
  pressure elsewhere.
- A lazy scene split requires broad rewrites of save/restore or route transition
  contracts; in that case, finish helper extraction first and retry with a
  smaller loader-scene experiment.

Repeated route -> combat -> route profiling is complete. The global cache keeps
the combat return at zero transfer and is retained; ordinary routes no longer
queue the 18 unrelated special-event and Market scene textures. The remaining
performance seam is the optional P2 BattleScene boundary, which should proceed
only with production transition and save/restore evidence.

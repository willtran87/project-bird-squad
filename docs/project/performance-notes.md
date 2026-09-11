# Performance Notes

## September 11 2026 — title clarity and combat cadence

The title no longer renders redundant generated frames, mastery microcopy, or a
second Collection goal panel. Start/Continue is the initial focus. Setup lives
on an opaque surface, with cumulative Ascension modifiers retained for higher
tiers. Removing the animated logo bounce also separates it from utility controls.

Standard and Snappy use shorter first/repeated enemy tells; Cinematic retains
its original long sequence. Deterministic single-enemy turn measurements are
3.40 s Standard, 2.55 s Snappy, and 9.62 s Cinematic, including input handoff.
Player attack commitment plus feedback is 300 ms on Standard. These are scene-
clock sequencing measurements, not wall-clock or physical-device FPS claims.
Real-time software-WebGL samples still showed substantial rendering overhead.
Animated player actions now require two full board passes instead of three;
phase-owned enemy art is retired on transition, including accelerated phases.

Roost, rally, and commitment-seal presentation now live in the existing lazy
combat-FX module; no loading boundary or asset delivery contract changed.
The Pages-path build (`--base=/project-bird-squad/`) measures 689.3 KiB entry /
180.4 KiB gzip and 724.6 KiB combined boot / 193.7 KiB gzip, down from the
published revision's 733.5 KiB combined boot. All hard budgets pass unchanged.
Phaser is 1313.6 KiB / 339.5 KiB gzip; Codex data is 281.0 KiB / 88.5 KiB gzip.
Preferred 675/710 KiB targets remain warnings. Combat FX is 18.4 KiB / 5.2 KiB
gzip and remains absent from boot modulepreloads.

## September 2026 Safe Practice

Playable practice uses an in-memory storage backend; its snapshot and scene
presentation live outside the core storage wrapper. No Vite boundaries or
budgets changed. This is a safe-experimentation feature, not a performance claim.
The production entry is 688.2 KiB and combined boot code is 723.4 KiB. Hard caps
pass, including the near-full 30 KiB core budget; preferred entry/combined
targets of 675/710 KiB remain warnings. Eighteen practice tests pass across the
three browser engines; that is not evidence of physical-device performance.

## September 2026 Flight Lab Correctness

Flight Lab and live combat now share `src/game/hand-size.ts`; seeded shuffle
utilities remain unchanged. The new rule initially placed in `deterministic-draw`
exceeded the core chunk's 30 KiB cap. Separating the deck rule preserves one
implementation without changing Vite boundaries or raising a budget. This is a
correctness/ownership change, not a startup-performance improvement.

Production measurement: entry 684.0 KiB / 180.6 KiB gzip, core 29.9 KiB /
10.9 KiB gzip, combined boot 719.2 KiB / 193.8 KiB gzip, lazy Profile 166.7 KiB /
42.2 KiB gzip. Phaser remains 1313.6 KiB / 339.5 KiB gzip; Codex data remains
281.0 KiB / 88.5 KiB gzip. Hard bundle and deployment-cache gates pass; entry
675 KiB and combined 710 KiB targets remain warnings. Older dated measurements
below are historical, not the current revision's evidence.

## August 2026 Route Hierarchy Boundary

Route-map presentation now lives in the guarded `route-map-renderer` lazy chunk.
RouteScene waits for either the renderer or its bounded failure path before it
becomes interactive; a compact, clickable fallback keeps route commitment
playable if the optional presentation request fails. The production contract
requires exactly one hashed renderer chunk, rejects module-preloading it, and
caps it at 5 KB.

The same pass reduces route-map clutter: future nodes render at 22% opacity,
selected and selectable states gain non-color-only backplates, the selected
node has a persistent label, neutral icons are smaller, endpoints clear the
decorative frame rails, and generated columns no longer receive random drift.
Column guides follow the real node centers. A 48-layout seeded regression now
rejects duplicate centers, invalid bounds, rail collisions, and material icon
overlap.

Measured from the production build on 2026-08-08:

- app entry: `674.8 KB` minified / `180.0 KB` gzip
- app entry plus game-core: `704.8 KB` minified / `190.9 KB` gzip
- route-map renderer: `4.3 KB` minified / `1.9 KB` gzip

The app entry and combined boot code are both below their warning targets.
Chromium, Firefox, and WebKit exercise the route presentation contract; built
desktop and portrait-gate captures live under
`.artifacts/visual-audit/route-hierarchy/`.

## July 2026 Experience Pass Baseline

The experience pass adds Quick Flight routing, progressive first-flight lessons, district contract selection, build-shaped reward drafts, restoration feedback, contract badge browsing, and keyboard/controller input parity. After five-pass modern Terser compression, the measured production baseline is:

- app entry plus game-core: `724.8 KB` minified / `188.0 KB` gzip
- app entry: `699.3 KB` minified / `178.7 KB` gzip
- Phaser vendor: `1313.6 KB` minified / `339.5 KB` gzip

The combined hard budget is `725 KB` with a `710 KB` warning target. The warning remains active so follow-up scene extraction must earn back the 14.8 KB target overage. The persistent First Flight Guide remains available on the opening path; optional presentation and accessibility engines cross explicit lazy boundaries. Codex data and combat preview remain genuinely lazy and are rejected if module-preloaded by deployment validation.

Status: current runtime optimization baseline.

Last measured against `npm run build` on 2026-07-12.

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
| App entry chunk | 700 KB hard / 675 KB target | warning over target, hard failure over budget |
| Game core boot chunk | 30 KB | hard failure |
| Codex lazy data chunk | 300 KB | hard failure |
| Phaser vendor chunk | 1,400 KB | warning |

The vendor chunk remains a warning because Phaser upgrades can legitimately move
the baseline. The app entry has a temporary 700 KB hard ceiling; builds warn
above 675 KB so the remaining scene/module split stays visible. Codex remains a
hard failure because regressions there directly affect scene transition cost.

## Phaser Vendor Experiment

A scratch Vite build was run with Phaser aliased to the package's minified ESM
file. It reduced the vendor chunk from about 1,656.3 KB minified and 374.7 KB
gzip to about 1,353.4 KB minified and 362.7 KB gzip. The production config now
uses that alias only for `vite build`; dev keeps the normal package entry.

## Remaining Watch Items

- The Phaser vendor chunk is still the largest file. Meaningful future reduction would require validating a smaller Phaser build or a framework-level import strategy.
- The app entry remains above the long-term 590 KB goal. Large new scene systems
  should be split into their own dynamic modules.
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

## 2026-06-22 Market Load Review

Focused market profiling found that RouteScene was still preloading full
portrait card art for every card in the run deck. On a 36-card profiling deck,
that meant RouteScene requested about 28.2 MB of images before becoming active,
dominated by 600-730 KB portrait WebPs. Market open then requested another
4.2 MB because the market card-art queue included the whole run deck even though
the market only displays the card offers.

The route preload now excludes deck card art entirely, and card art queues are
split by surface: market shelves load only offer thumbnails, while the deck
overlay and card picker still load visible/card-list thumbnails on demand. Full
portrait art remains reserved for detail surfaces, so visual detail is not
reduced.

Post-change profile on the same 36-card deck, counting runtime WebP payloads:

| Phase | Before | After |
| --- | ---: | ---: |
| RouteScene image requests | 64 files / 28.2 MB | 28 files / 4.5 MB |
| Market-open image requests | 46 files / 4.2 MB | 10 files / 0.7 MB |
| Loaded route card portraits | 36 | 0 |
| Loaded market card thumbnails | 40 | 4 |

The first full portrait request now occurs when a card detail surface opens; the
same profile loaded one 0.7 MB portrait on hover after Market was already open.

Follow-up pass after visual review batched all Market shelf art into one runtime
queue that starts as soon as the Market node opens. This avoids four independent
loader completions/redraws for kit, cards, Waymarks, and utilities. The Market
layout also moved the lower Waymark/Supply shelf away from card price tags and
reduced card hit areas so the rows no longer overlap.

Remaining watch item: `scrap.webp` is a 616 KB runtime asset used as a tiny UI
icon in several places. Several Supply/Waymark "icon" WebPs are also 120-210 KB
and can still make a cold Market feel slow. Rebuilding a smaller HUD/shop icon
tier would reduce Market and route preload without changing larger reward-detail
art.

## 2026-07-09 Combat Jaggedness Review

A fresh review focused on rough animation/transitions after the imagegen combat
FX wiring. The clearest local cause was the boot WebGL config: visiting the app
with `?playwright=1` forced `preserveDrawingBuffer`, and the in-app browser was
using that query string during normal manual play. That can make WebGL
compositing and readback paths more expensive than necessary. The capture gate
now preserves the drawing buffer only for explicit `capture=1`,
`preserveDrawingBuffer=1`, or real Playwright/WebDriver automation, so ordinary
manual play with `?playwright=1` does not pay that cost.

Combat FX also had burst pressure from recent generated art. Several gameplay
beats can stack multiple 512-768px transparent PNG sprites, additive glow copies,
and newly-created particle emitters during the same enemy/player impact window.
BattleScene now applies lightweight back-pressure: active generated FX sprites
skip duplicate glow layers once the FX layer is already busy, and particle mote
bursts are capped/scaled instead of creating unbounded concurrent emitters.
The counters reset when the combat FX layer is cleared.

Runtime asset validation now keeps the canonical `assets/runtime/fx/*.png`
sources paired with optimized runtime WebPs. The current delivery tier has a
140 KB per-file ceiling so future generated FX cannot silently become large
combat transfers.

Current validation:

| Check | Result |
| --- | --- |
| `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` | pass |
| Focused combat smoke for imagegen FX and attack wind-up | pass |
| `npm run validate:runtime-assets` | pass, 614 optimized runtime assets checked |
| `npm run build` | pass |
| Required web-game client on `http://127.0.0.1:5199/?playwright=1` | pass after preserving WebDriver screenshots |
| `npm run validate:bundle-size` | fail: app entry is 716.1 KB minified, above the 675 KB hard budget |

## 2026-07-09 Runtime Plan Execution

Executed the first runtime-plan pass after the generated imagegen art pushed the
app entry over the hard bundle ceiling. Generated combat FX, generated UI icon
metadata, route-only generated scene art, and reserve enemy art metadata now live
in lazy modules instead of the boot entry:

- `src/game/combat-fx-assets.ts`
- `src/game/ui-icon-assets.ts`
- `src/game/route-scene-assets.ts`
- `src/game/reserve-enemy-art-assets.ts`

BattleScene waits for combat FX texture registration before finishing combat
startup, so first-use FX no longer race the opening render. Menu, route, Codex,
and combat surfaces queue UI icon art by surface-specific prefix groups instead
of loading the full generated UI registry. Route generated art and reserve enemy
art are also loaded through their lazy modules so fallback unhashed URLs are not
requested for assets that Vite already fingerprints.

Enemy-turn readability was adjusted while validating the split. The preamble
timer is scheduled before the heavy handoff render, and the explicit preamble
constant is shorter because the render/load work and the longer wind-up/release
beats supply the perceived weight. The focused timing smoke now proves attacks
resolve after their readable animation window instead of instantly.

Fresh production bundle validation:

| Chunk | Size | Gzip |
| --- | ---: | ---: |
| `vendor-phaser-DMI6MihC.js` | 1,313.6 KB | 339.5 KB |
| `index-C-T6RG45.js` | 674.2 KB | 174.6 KB |
| `runtime-data-Cwb4x2Jw.js` | 304.5 KB | 57.7 KB |
| `codex-data-cFC7aZnj.js` | 274.9 KB | 86.0 KB |
| `ui-icon-assets-TI02N4T2.js` | 27.0 KB | 4.9 KB |
| `route-scene-assets-CxLcofrz.js` | 10.5 KB | 4.3 KB |
| `combat-fx-assets-c9lkNdzS.js` | 5.6 KB | 1.5 KB |
| `reserve-enemy-art-assets-CAgrEaVF.js` | 5.2 KB | 1.3 KB |

Validation completed during this pass:

- `npm run build`
- `npm run validate:bundle-size`
- `npm run validate:runtime-assets`
- `npm run validate:deployment-cache`
- `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`
- focused Playwright smokes for combat attack wind-up, imagegen combat FX,
  market generated art, enemy Codex art, and route-event generated backdrops

Validation also caught one real route-art split regression before closure:
route-event resident portraits were still being queued through stale fallback
URLs, so Phaser could not process `route-event-resident-*` files in production
preview. Resident portrait metadata now lives in `route-scene-assets` with the
other route generated art, and the scene relies on that hashed lazy chunk instead
of separately loading residents through the old direct path.

The remaining larger performance item is still entry-size and scene-system
coupling. `src/main.ts` carries much of BattleScene, generated FX registration,
UI telemetry, and runtime glue in the boot entry. A real follow-up should split
combat FX/render helpers or larger scene systems into modules so the entry chunk
returns below the hard budget and V8 parse/compile work stops competing with
scene transitions.

## 2026-07-10 Sequencing And Entry Closure

Combat startup now waits only for essential first-beat FX. Specialized combat
art begins loading after the encounter intro unlocks interaction, so the full FX
pack no longer blocks the first playable frame. Runtime image in-flight state is
owned per scene, preventing one scene shutdown from resolving another scene's
asset readiness early.

Stable boot helpers now live in a separately cached `game-core` chunk. This moved
23.2 KB out of the scene-heavy entry and brought it below its pre-change baseline:

| Chunk | Size | Gzip |
| --- | ---: | ---: |
| `vendor-phaser-DMI6MihC.js` | 1,313.6 KB | 339.5 KB |
| `index-CdDnyNwU.js` | 677.7 KB | 173.1 KB |
| `runtime-data-Cwb4x2Jw.js` | 304.5 KB | 57.7 KB |
| `codex-data-BYqfK711.js` | 281.0 KB | 88.5 KB |
| `game-core-Nof1iJkR.js` | 22.9 KB | 8.5 KB |

Bundle validation enforces a 700 KB hard ceiling and retains 675 KB as the app
entry warning target. `game-core` has its own 30 KB hard budget so the new cache
boundary cannot quietly absorb unrelated scene code. A larger BattleScene or UI
system extraction remains the appropriate path to the older 590 KB goal.

## 2026-07-10 Sequencing And Runtime Follow-Through

The follow-through pass removed several remaining correctness and pacing risks:

- District bosses now evaluate every active contract against the completed
  district history, so Hold the Line, Bright Signal, and Lean Route cannot miss
  completion at the terminal fight.
- Losses mark unresolved encounter objectives failed and defeat summaries record
  the fatal enemy move rather than the enemy display name.
- Lazy combat FX, UI icon, route art, reserve-enemy art, combat-preview, and Codex
  imports clear rejected promises so a later scene activation can retry.
- The deterministic test clock advances every active scene, including Phaser
  timers and tweens, which makes player and enemy animation sequencing testable
  without wall-clock sleeps.
- Enemy turns retain their rendered enemy poses through windup, release,
  recovery, and interludes. Full board rebuilds now occur at state-changing
  impact beats instead of roughly six times per attacker.
- Battle art is staged by surface and encounter phase: the opening hand and
  essential first-beat FX load first; enemy-turn FX, inspect UI, drawers,
  rewards, optional FX, and newly drawn card thumbnails load when needed.

Card outcome simulation now lives in the genuinely lazy `combat-preview` chunk.
The deployment validator requires exactly one such chunk and rejects preloading
it. Bundle validation also budgets `index` plus `game-core` together, preventing
code from bypassing the boot limit by moving between those two chunks.

Fresh production bundle validation:

| Chunk | Size | Gzip |
| --- | ---: | ---: |
| `vendor-phaser-DMI6MihC.js` | 1,313.6 KB | 339.5 KB |
| `index-DAqoc8Dq.js` | 681.7 KB | 173.8 KB |
| `runtime-data-Cwb4x2Jw.js` | 304.5 KB | 57.7 KB |
| `codex-data-BYqfK711.js` | 281.0 KB | 88.5 KB |
| `ui-icon-assets-TI02N4T2.js` | 27.0 KB | 4.9 KB |
| `game-core-CMN_jJhQ.js` | 22.9 KB | 8.5 KB |
| `combat-fx-assets-ExIfR5lk.js` | 6.5 KB | 1.7 KB |
| `combat-preview-DEqsc-_S.js` | 3.9 KB | 1.7 KB |

Combined app boot code is 704.6 KB minified / 182.3 KB gzip. It passes the
705 KB hard gate and remains above the 690 KB warning target. The app entry also
remains above its 675 KB warning target while staying below the 700 KB hard gate.

Final verification completed with strict TypeScript, production build, bundle
and deployment-cache validation, the seven-test sequencing gate, and the full
default `npm test` workflow. All 135 Playwright browser tests pass.
## Experience Pass Budget Update (2026-07-11)

Persistent contract/mastery progression, deterministic encounter objectives,
and route decision hierarchy increased combined `index` + `game-core` boot code
from 704.6 KB to 708.4 KB minified (about 0.9 KB additional gzip). The combined
hard ceiling is now 710 KB. The 690 KB warning target, 700 KB app-entry hard
gate, and 30 KB game-core hard gate remain unchanged.

## Replay Flight Budget Check (2026-07-12)

The same-seed rematch and outcome input pass stays within the existing hard budgets without a threshold change. Production measures 699.4 KB for the app entry and 25.6 KB for `game-core`; combined boot code is 725.0 KB minified / 188.1 KB gzip. The 700 KB app-entry, 30 KB game-core, and 725 KB combined hard gates all pass. The older 675 KB entry and 710 KB combined improvement targets remain visible as warnings.

## Shared Route Link Budget Check (2026-07-12)

Shareable outcome links add a lazy 0.3 KB `run-challenge` module for URL construction and clipboard access. Consolidating repeated texture-state diagnostics recovered more than the feature's boot cost: production measures 698.4 KB for the app entry and 25.6 KB for `game-core`, with 724.0 KB combined boot code / 188.3 KB gzip. The existing 700/30/725 KB hard gates remain unchanged, and deployment validation keeps the challenge helper out of module preloads.

## District Route Identity Budget Check (2026-07-13)

Canal Markets, Signal Spires, and High Roost now have dedicated 1280x720 WebP
district world backdrops. Their registry remains in the lazy
`route-scene-assets` chunk; boot preloads only the Rooftop Blocks default and
RouteScene requests the active district art on entry. This avoids charging all
four environmental images or their registry to initial startup.

Production measures 699.4 KB for the app entry and 25.6 KB for `game-core`, with
725.0 KB combined boot code / 188.5 KB gzip. The 700 KB app-entry, 30 KB
game-core, and 725 KB combined hard gates pass without a threshold change. The
lazy `route-scene-assets` chunk is 11.6 KB / 4.7 KB gzip; the three new runtime
images total about 283 KB and load only when their district is entered.

## Boss Dossier Budget Check (2026-07-13)

Persistent observed-move progress, Codex reveal rows, outcome unlock callouts,
and next-flight dossier goals are implemented without adding their presentation
code to initial boot. Outcome analysis, stat rendering, reveal FX, and dossier
helpers load through the dedicated `boss-dossier` chunk at 4.9 KB minified / 2.2
KB gzip. The Codex loads that helper alongside its existing lazy data module.

Production measures 698.9 KB for the app entry and 25.8 KB for `game-core`, with
724.7 KB combined boot code / 188.6 KB gzip. The 700 KB app-entry, 30 KB
game-core, and 725 KB combined hard gates pass. The 675 KB entry and 710 KB
combined improvement targets remain visible as warnings. Loader warning labels
were shortened to retain useful error context while recovering hard-budget
headroom; player-facing failure behavior is unchanged.

## Card Discovery Collections Budget Check (2026-07-13)

Suit-level Codex collection progress, milestone rails, and nearest-milestone
outcome goals extend the existing lazy progression module. The `boss-dossier`
chunk is now 7.0 KB minified / 3.0 KB gzip and remains absent from initial
module preloads. Canonical card objects pass directly into the lazy helper, so
set grouping and goal copy do not inflate boot code.

Production measures 699.2 KB for the app entry and 25.8 KB for `game-core`, with
725.0 KB combined boot code / 188.7 KB gzip. All 700/30/725 KB hard gates pass;
the 675 KB entry and 710 KB combined improvement targets remain warnings. The
Codex asset group also excludes the menu-only generic Codex medallion, removing
a duplicate texture request during very fast menu-to-Codex transitions.

## Enemy Turn Hustle Budget Check (2026-07-13)

Enemy-turn orchestration and its per-timer hold accelerator now live in the
already lazy `combat-fx-assets` module. This keeps input tracking, readable Tell
minimums, progress timing, and nested attack sequencing out of initial boot
while retaining a small BattleScene bridge and text-state surface.

Production measures 698.0 KB for the app entry and 25.8 KB for `game-core`, with
723.8 KB combined boot code / 188.6 KB gzip. The lazy combat-FX chunk is 11.5 KB
/ 3.4 KB gzip. Existing 700/30/725 KB hard gates pass without a threshold
change; the 675 KB entry and 710 KB combined improvement targets remain visible.

## Playtest Dashboard Budget Check (2026-07-13)

The dashboard generator and seeded pipeline harness are Node-only tooling and
do not ship to players. Runtime telemetry adds compact timing and offer records
to local run summaries; redundant nested-array cloning was removed to offset
the bridge cost.

Production measures 699.2 KB for the app entry and 25.8 KB for `game-core`, with
exactly 725.0 KB combined boot code / 188.8 KB gzip. All existing hard gates
pass without a threshold change.

## Lazy Profile And System Overlay Closure (2026-07-15)

Profile presentation now loads through `profile-scene`, while Pause, Settings,
and How-to-Play presentation share a lazy `system-overlays` chunk. These are
real usage boundaries: none of the three system panels or the Profile screen is
needed for the first interactive title frame. Their dynamic-import promises
reset after rejection, and the player sees a blocking loading state plus a
recoverable failure state on a cold request.

The split also fixed a Profile sequencing defect where every badge-view redraw
registered another Escape and mute listener. Focused browser coverage proves the
listener counts remain stable. Settings sliders, motion/pace switches, Profile
tabs, Profile Return, guide actions, and pause actions now use 56-game-pixel hit
areas, preserving 44.8 CSS pixels at the supported 1024x768 tablet scale.

Fresh production bundle validation:

| Chunk | Size | Gzip |
| --- | ---: | ---: |
| `index-BKaf-H9q.js` | 675.0 KB | 173.9 KB |
| `game-core-D8F525di.js` | 25.8 KB | 9.3 KB |
| `system-overlays-Dn8nC7Gi.js` | 13.4 KB | 4.4 KB |
| `profile-scene-D3wWn59g.js` | 11.5 KB | 4.2 KB |

Combined boot code is 700.8 KB minified / 183.3 KB gzip. Both the 675 KB app
entry target and the 710 KB combined target now pass without warnings. The pass
started at 688.5 KB entry / 714.3 KB combined, so boot parsing fell by 13.5 KB.

Production visual review at 2560x1600, 1280x720, and 1024x768 caught and fixed
the final Profile achievement/Return overlap. The guide copy was shortened and
its body type enlarged for tablet readability. Normal rendering and explicit
`capture=1` screenshot mode report no browser warnings or errors.

## Sequencing And Shared Runtime Closure (2026-07-15)

Generic scene traversal, deterministic time advancement, texture counting, and
tween-cleanup helpers now live in `scene-runtime` inside `game-core`. This keeps
the app entry below its preferred target while preserving one implementation of
the lifecycle operations used by production scenes and Playwright inspectors.

Menu asset refreshes now carry a scene-generation token, so a late dynamic
texture callback cannot restart or redraw a title scene after the player has
launched a run. A valid refresh preserves the active Leader tooltip across the
intentional redraw. Route selection still rejects unreachable nodes, while the
dedicated inspector can explicitly render a selected boss dossier for progress
and readiness review. Codex detail layout advances from measured title, meta,
and stat heights; the longest current card (`major_15`) exposes a 244-pixel
scroll range instead of clipping wrapped content into a zero-scroll panel.

Fresh production bundle validation:

| Chunk | Size | Gzip |
| --- | ---: | ---: |
| `index-D8mLoGsh.js` | 674.6 KB | 173.8 KB |
| `game-core-CouCC1Pp.js` | 27.0 KB | 9.7 KB |
| `system-overlays-Dn8nC7Gi.js` | 13.4 KB | 4.4 KB |
| `profile-scene-RfcZjUVY.js` | 11.5 KB | 4.2 KB |

Combined boot code is 701.6 KB minified / 183.5 KB gzip. The 675 KB app-entry,
30 KB game-core, and 710 KB combined preferred targets all pass without a
warning. Deployment validation confirms Profile and system-overlay chunks stay
lazy and absent from module preloads.

The complete browser suite passes 147/147 in 18.0 minutes, including eight
critical sequencing cases. Visual inspection of the longest Codex dossier at
2560x1600 and 1024x768 confirms the content mask, scroll affordance, and frame
geometry remain stable at both supported scales.

## Combat Redraw Ownership Pass (2026-07-15)

BattleScene now owns the battlefield and combat hand in persistent containers.
Full UI passes reuse the backdrop instead of recreating its image, mood
treatment, atmosphere strip, and infinite tween. The hand rebuilds only when
its cards, affordability, Molt contract, or selection changes; Flow callouts and
late-loaded compact card art refresh in place. Noncritical same-frame refreshes
queue on `postupdate`, while sequencing-critical wind-up and impact renders stay
synchronous.

The enemy-to-player handoff no longer renders the replenished hand once while
locked and again when input unlocks. The resolved enemy frame holds through the
handoff, then the next hand and active command state appear together. A focused
regression proves eight same-frame requests become one pass, player attacks use
exactly two full passes, enemy turns use exactly three, and backdrop object
identity survives every pass.

Production profiling at 1600x1000:

| Sequence | Initial observed total | Final 3-run median | Full passes |
| --- | ---: | ---: | ---: |
| Player attack | 231.7 ms | 222.0 ms | 2 |
| Enemy turn | 346.8 ms | 237.4 ms | 3, down from 4 |

Every final action pass reported zero backdrop rebuilds. A representative player
attack performed one hand build and one reuse; a representative enemy turn
performed two required hand builds and one reuse. High-resolution production
captures at 2560x1600 and 1024x768 remained aligned and nonblank. Both sampled
WebGL frames produced 172 color buckets, full opacity, and a 6-219 luminance
range; the enemy wind-up capture remained readable at the intended `windup`
beat.

Fresh production output is 680.4 KB for the app entry, 27.0 KB for `game-core`,
and 707.4 KB combined / 184.9 KB gzip. The runtime ownership code is 5.4 KB over
the preferred app-entry target but 19.6 KB below the hard gate, while combined
boot remains below its preferred 710 KB target. No budget threshold changed.

The complete browser suite passes 148/148 in 18.6 minutes. Its district
progression regression now forces a RouteScene redraw during the title flourish;
the bounded replay window reconstructs the visuals after late asset callbacks
without replaying the sound or incrementing the one-shot burst telemetry.

## Exact Combat Forecast And Profile Reveal Ownership (2026-07-15)

Card outcome simulation now returns exact enemy and flock snapshots in addition
to aggregate deltas. BattleScene uses those snapshots for an incremental target
health forecast: the pending loss is shaded on the current health rail, a narrow
boundary marks the resulting value, and one compact label reports `AFTER N` or
`LETHAL`. The selected-card rail reports exact Cohesion, Cover, Flow, and Surge
results without introducing another persistent panel. Selection still performs
zero full battlefield passes, and focused coverage verifies forecast/live parity
through the same effect ordering used by the committed card.

Profile redraw ownership now distinguishes persistent ornament from entrance
ceremony. Rebuilding the Achievements or Contracts view recreates the ambient
flourish tween but cannot replay the particle burst or `profileRecord` cue. The
integration test verifies both the reveal counter and audio request count stay
at one across the tab redraw.

Fresh production bundle validation:

| Chunk | Size | Gzip |
| --- | ---: | ---: |
| `index-C0SUG3kR.js` | 682.9 KB | 175.8 KB |
| `game-core-CouCC1Pp.js` | 27.0 KB | 9.7 KB |
| `combat-preview-BcCqWLx2.js` | 4.3 KB | 1.8 KB |
| `profile-scene-tXaRtSOW.js` | 11.6 KB | 4.2 KB |

Combined boot code is 709.9 KB minified / 185.5 KB gzip. It remains below the
710 KB preferred combined target and all hard gates; the 682.9 KB app entry
keeps the existing warning against its 675 KB preferred target. No threshold
changed. Production captures at 2560x1600 and 1024x768 are aligned and report
zero page or console errors. All nine critical sequencing tests pass, followed
by the complete 149-test Chromium suite in 17.8 minutes on one worker.

## Journaled Save Recovery (2026-07-15)

Browser persistence now uses exception-safe accessors and a mirrored JSON
journal. Account, active-flight, First Flight guide, and run-history writes keep
a last-known-good `.backup`; reads restore that mirror when the primary is
corrupt or missing, and quarantine bounded unrecoverable input under `.corrupt`.
Schema sanitizers keep malformed counters and unknown Leader IDs out of live
progression. Preference reads and writes fail closed, so restricted storage no
longer breaks Settings or audio controls.

Recovery-event formatting and Phaser rendering are dynamically imported only
when an event exists. This removed the rare status-strip implementation from
the ordinary title path while keeping recovery state synchronous and testable.

| Chunk | Size | Gzip |
| --- | ---: | ---: |
| `index-C3bni8OD.js` | 683.1 KB | 175.8 KB |
| `game-core-DVVEUzw3.js` | 28.6 KB | 10.4 KB |
| `storage-recovery-notice-DWHKscO_.js` | 1.1 KB | 0.6 KB |

Combined boot code is 711.7 KB minified / 186.2 KB gzip. It remains below the
725 KB hard limit, while the unchanged 675 KB entry and 710 KB combined
preferred targets emit advisories. The recovery notice chunk remains lazy.
Production captures at 2560x1600 and 1024x768 report zero page or console
errors. All nine sequencing tests and the complete 151-test browser suite pass;
the full suite completed in 17.3 minutes on one Chromium worker.

## Settings Input Ownership (2026-07-15)

The lazy shared Settings renderer now owns keyboard and standard-gamepad input
for its six rows. It creates one generic keyboard listener, one gamepad listener,
six fixed row targets, and one focus ring only while the overlay exists. The
overlay's lifecycle background removes both listeners and its shutdown hook,
preventing redraws or repeated open/close cycles from accumulating handlers.

Focus lives in a per-scene Phaser registry key rather than Menu, Route, or
Battle fields. Reconstructing the overlay after a volume, Motion, or Combat Pace
change therefore restores the same row without coupling the lazy module to its
hosts. Text telemetry reads the same registry value, keeping browser tests and
assistive harnesses aligned with the visible ring.

Fresh production bundle validation:

| Chunk | Size | Gzip |
| --- | ---: | ---: |
| `index-CNZgjhmC.js` | 683.4 KB | 176.0 KB |
| `game-core-DVVEUzw3.js` | 28.6 KB | 10.4 KB |
| `system-overlays-NUwHNnCk.js` | 15.8 KB | 5.3 KB |

Combined boot code is 712.0 KB minified / 186.3 KB gzip. All hard limits pass;
the existing 675 KB entry and 710 KB combined preferred targets remain visible
as advisories. The required web-game client exercised keyboard focus and volume
adjustment, while production captures at 1024x768 CSS pixels with 2x output and
1280x800 CSS pixels with 2x output report exactly one 536x46 focus ring, six
row targets, settled cameras, and zero page or console errors. Focused Settings
coverage passes 3/3, all nine sequencing gates pass, and the complete 152-test
Chromium suite passes in 18.2 minutes on one worker.

## Configurable Controls And Input Ownership (2026-07-16)

The keyboard map is a small synchronous core because Menu, Route, Combat,
Profile, reward input, and enemy-turn Hustle all consume it. Each host registers
one generic real-key dispatcher plus only the Phaser-specific listeners needed
for synthetic compatibility. A `WeakSet` deduplicates real events observed by
both paths. Binding refresh is queued in a microtask, preventing the key used to
finish capture from firing the newly assigned action in that same event.

Settings asserts a per-scene input-ownership registry flag for its entire
lifetime. Host dispatchers therefore cannot launch, pause, Roost, or toggle a
utility while Settings or Controls is processing the same physical event.
Controls page, focus, and capture state live in the scene registry and survive
valid Menu reconstruction; explicit close and new Route/Battle initialization
clear stale modal state. Hustle separately remembers the held physical code so
rebinding while held cannot leave acceleration stuck.

Conflict assignment swaps keys instead of creating an unreachable duplicate.
Validated state is cached for immediate session use before persistence is
attempted, so a browser that throws on storage writes still gets a working live
remap. Invalid payloads fall back to defaults, and Tab plus `1-9` remain reserved
for existing game navigation.

Fresh production bundle validation:

| Chunk | Size | Gzip |
| --- | ---: | ---: |
| `index-CT2qoO_q.js` | 688.5 KB | 177.9 KB |
| `game-core-C9r8It7t.js` | 28.6 KB | 10.4 KB |
| `system-overlays-Qzq3DwA_.js` | 22.0 KB | 7.1 KB |

Combined boot code is 717.2 KB minified / 188.2 KB gzip. The first build placed
input bindings in `game-core` and failed its 30 KB hard budget at 33.0 KB;
restoring entry ownership brought core back to 28.6 KB without inventing a
cosmetic chunk boundary. The 675 KB entry and 710 KB combined targets remain
advisories, while all hard budgets pass.

The required game client captured both Play and Utility pages. Production DPR 2
captures at 1024x768 and 1280x800 CSS pixels report complete close art, six
stable rows per page, settled 1280x720 canvas geometry, and zero console or
request errors. All 9 sequencing tests pass in 2.7 minutes; the complete
153-test Chromium suite passes in 19.1 minutes on one worker.

## Device-Aware Effects Quality (2026-07-16)

Settings now separates Motion accessibility from optional rendering cost.
Effects offers Auto, Full, and Lean. Auto selects Lean for Save Data, reported
device memory at or below 4 GB, or at most two logical processors; explicit
choices always win. The validated preference is cached after its first safe
storage read, so particle helpers do not query local storage during combat.
Session state updates before persistence, keeping the control live when storage
throws.

Lean keeps primary attack, enemy tell, hit-confirm, reward, and transition art.
It removes the title's long-lived particle emitter, cuts route set-piece glow
and mote objects, suppresses optional reward ambience, halves general combat
particle density, lowers the concurrent burst cap from four to two, and renders
10 static combat-atmosphere tiles instead of 21 on the opening district. Motion
and Combat Pace remain independent; Effects does not alter sequencing or math.

Fresh production bundle validation:

| Chunk | Size | Gzip |
| --- | ---: | ---: |
| `index-Dojuj-3h.js` | 690.7 KB | 178.6 KB |
| `game-core-C9r8It7t.js` | 28.6 KB | 10.4 KB |
| `system-overlays-CGQyP_Ym.js` | 23.3 KB | 7.3 KB |

Combined boot code is 719.3 KB minified / 188.9 KB gzip. All hard budgets pass;
the existing 675 KB entry and 710 KB combined preferred targets remain visible
advisories. Focused Settings coverage passes 4/4 in 1.3 minutes across pointer,
keyboard, gamepad, cross-scene, persistence, blocked-storage, and real
render-cost assertions.
Production captures at 1280x720, 2560x1600, and 1024x640 are aligned and
nonblank with zero console errors.

The full release validator passes: documentation, 110-card/64-enemy runtime
data, 617 optimized assets, bundle budgets, deployment cache headers, enemy
variety contracts, and all 56 Minor Arcana overlays. All nine critical
sequencing tests pass in 2.1 minutes, including player wind-up, deterministic
enemy sequencing, redraw reuse, Hustle impact preservation, essential-FX
loading, pause ownership, and defeat artifacts.

## Portrait Gate Transfer Reduction (2026-07-17)

The unsupported-display gate now uses a dedicated 1280x720 WebP derived from
the same approved streetwear splash instead of shipping its 1672x941 PNG.
The gate image fell from 3,108,096 bytes to 269,298 bytes (91.3% smaller) and
stays under the 350 KB splash budget. Native lazy loading and asynchronous
decoding keep the image out of supported desktop requests; a 390x844 blocked
viewport requests and renders it normally.

JavaScript chunk shape is unchanged: the app entry remains 690.7 KB minified /
178.6 KB gzip, `game-core` remains 28.6 KB / 10.4 KB gzip, and combined boot
code remains 719.3 KB / 189.0 KB gzip. Hard bundle and deployment-cache gates
pass; the 675 KB entry and 710 KB combined preferred targets remain advisories.

## Lazy Adaptive Procedural Music (2026-07-17)

Bird Audio now layers a scene-aware procedural score over its immediate ambient
drone. Menu, route, battle, boss, victory, and defeat each use distinct melodic
and rhythmic profiles; ordinary encounter wins now enter the victory profile
during their reward ceremony. Music and SFX volumes remain independent, and
mute cancels the sequencer before its next pulse.

The sequencer loads only after the first browser-permitted audio interaction,
so no recorded-audio transfer or new startup preload is required. Production
output measures:

| Chunk | Size | Gzip |
| --- | ---: | ---: |
| `index-BDE5Ne00.js` | 691.8 KB | 179.0 KB |
| `game-core-C9r8It7t.js` | 28.6 KB | 10.4 KB |
| `adaptive-music-DFm9_4UK.js` | 3.6 KB | 1.4 KB |

Combined boot code is 720.5 KB minified / 189.3 KB gzip. All hard gates pass;
the existing 675 KB entry and 710 KB combined preferred targets remain
advisories. Bundle validation caps the adaptive module at 8 KB, and deployment
validation requires exactly one hashed adaptive-music chunk and rejects a
module preload for it.

## Flow-Centered Combat Hierarchy (2026-07-17)

Combat now treats Flow as the short-term formation goal instead of a secondary
Wingbeats footnote. The 196x28 rail shows five readable pips, current count,
selected-card gain, distance to Surge, and the resulting `SURGE NEXT`,
`SURGE / BREAK`, `FLOW HOLDS`, or `FLOW BREAKS` state. When an incoming attack
will deal unblocked damage, a red diagonal crack previews the reset across the
current pips. The incoming Cohesion forecast was consolidated to a 188x38
plaque so it no longer competes with or overlaps the Flow rail.

Selection stays incremental: the Flow rail, forecast status, preview pips, and
selected-card outcome update without rebuilding the battlefield. A production
Playwright test now drives a real mouse move/down/up through the canvas-scaled
card hit area and proves the live selection/outcome path. Focused Flow,
formation-break, incoming-forecast, real-pointer, and adaptive-music checks all
pass. The full release validator also passes, including all 618 optimized
runtime assets and nine critical sequencing tests. In the complete 155-test
run, 153 scenarios passed immediately; the two stale/racy assertions it found
were corrected and both pass in a focused rerun.

Fresh production bundle validation:

| Chunk | Size | Gzip |
| --- | ---: | ---: |
| `index-Cvd4Z4b3.js` | 693.2 KB | 179.5 KB |
| `game-core-C9r8It7t.js` | 28.6 KB | 10.4 KB |
| `adaptive-music-DFm9_4UK.js` | 3.6 KB | 1.4 KB |

Combined boot code is 721.8 KB minified / 189.9 KB gzip. All hard budgets pass;
the 675 KB entry and 710 KB combined preferred targets remain visible
advisories. Built-preview state and screenshots at 1280x720 and 1024x768 are
complete, error-free, and stored under
`.artifacts/test-results/flow-centered-hud/`.

## Reward Build Guidance (2026-07-17)

Card rewards now compute at most two prioritized observations from the live
deck and carried Waymarks. The guidance calls out first capabilities, owned
suit-engine triggers, keystone thresholds, costly-card curve pressure, role
crowding, Molt safety, and recovery saturation without ranking a card as the
correct choice or using future encounter information. `render_game_to_text`
exports the same observations shown on each card.

The previous slash-joined 116-pixel footer was replaced by two independent
single-line rows, eliminating the cramped wrapping visible in the baseline
reward screenshot. Hover dossiers now center over the selected offer instead
of always covering the middle card, so every unselected offer and Skip remain
available for comparison. Production captures at 1280x720 and 1024x768 are
clean and error-free under `.artifacts/test-results/reward-build-guidance/`.

Fresh production output measures `index-BQnVQyAa.js` at 694.0 KB minified /
179.9 KB gzip and `game-core-C9r8It7t.js` at 28.6 KB / 10.4 KB gzip. Combined
boot code is 722.6 KB / 190.2 KB gzip. The feature added 0.8 KB minified to the
entry relative to the Flow-centered baseline; all hard budgets and deployment
cache contracts pass, while the existing 675 KB entry and 710 KB combined
preferred targets remain advisories.

Release verification passes strict TypeScript, focused reward semantics/layout
coverage, the full release validator with all nine sequencing tests, and the
complete 155-test Chromium suite in 19.6 minutes.

## Lazy Battle FX Presenter Foundation (2026-07-17)

The reusable BattleScene presentation primitives now live in
`src/game/battle/fx-presenter.ts`. Sprite animation, bounded particle emitters,
directional shard sweeps, glow pulses, shockwaves, and action trails share one
host contract while BattleScene retains timing, combat math, and telemetry
ownership. This is the first concrete Phase 2 seam for a later lazy BattleScene
split and removes a dense block of Phaser lifecycle code from `src/main.ts`.

The first static extraction was rejected after measurement because it raised
the app entry by 0.8 KB and reduced hard-budget headroom. The retained version
loads the presenter concurrently with essential battle art and keeps the
readiness screen active until it settles. A failed presenter request degrades
secondary effects instead of blocking combat. Text state reports both readiness
and module availability.

Fresh production output:

| Chunk | Size | Gzip |
| --- | ---: | ---: |
| `index-DGabyAEy.js` | 692.4 KB | 179.3 KB |
| `game-core-C9r8It7t.js` | 28.6 KB | 10.4 KB |
| `fx-presenter-DW3nnVqo.js` | 3.7 KB | 1.6 KB |

Combined boot code is 721.0 KB minified / 189.7 KB gzip. Relative to the
Reward Build Guidance baseline, both the entry and combined boot code are 1.6
KB smaller. The presenter is not modulepreloaded, has its own 8 KB hard budget,
and is required exactly once by deployment validation. The existing 675 KB
entry and 710 KB combined preferred targets remain advisories; all hard gates
pass.

The required shared web-game client drove the built title -> route contract ->
route commit -> combat path. Battle text state reported the presenter ready and
loaded, all essential combat art present, and no error output. Focused normal,
reduced-motion, Lean-effects, generated-FX, and first-load coverage passed before
the full release validation run. The complete 155-test Chromium suite also
passes in 18.9 minutes on one worker.

## Lazy Battle Debug-State Extraction (2026-07-18)

BattleScene automation telemetry now lives in
`src/game/battle/debug-state.ts`. Declarative texture descriptors replace the
previous 900-line block of repeated scene-tree probes while BattleScene retains
combat math, hand/enemy/route state, Flow decisions, and sequencing ownership.
The module loads alongside other guarded battle dependencies; a failed request
degrades diagnostics without trapping the player on the readiness screen.

Fresh production output:

| Chunk | Size | Gzip |
| --- | ---: | ---: |
| `index-Di0c_1Yt.js` | 671.7 KB | 175.3 KB |
| `game-core-DK3fs1w9.js` | 28.5 KB | 10.3 KB |
| `debug-state-DqsNQNYL.js` | 5.3 KB | 2.0 KB |
| `fx-presenter-DW3nnVqo.js` | 3.7 KB | 1.6 KB |

Combined boot code is 700.3 KB minified / 185.7 KB gzip, 20.7 KB minified
and 4.0 KB gzip below the prior FX-presenter baseline. This clears both the
675 KB entry and 710 KB combined preferred targets without changing a hard
budget. The diagnostics chunk is not modulepreloaded, has an 8 KB hard budget,
and deployment validation requires exactly one hashed copy.

Focused generated-FX, readiness, HUD, reward, and settings contracts preserve
the prior `render_game_to_text` payload. The required shared client drove the
production title -> route -> combat flow: diagnostics and presenter modules
reported ready/loaded, the live scene rendered the encounter and complete hand,
and no page errors were emitted. Evidence is stored under
`.artifacts/test-results/battle-debug-state/shared-client/`.

The complete 155-test Chromium suite passes in 18.2 minutes. The run exposed
and verified one harness-restart edge case: a loaded pure diagnostics module is
now retained when a live BattleScene is re-initialized without `create()`, so
elite telemetry remains complete. The exhaustive 640-seed reserve-enemy test
also has a scoped 60-second budget after independently exceeding the global
30-second ceiling; its assertions and iteration bounds are unchanged.

## Lazy Battle Backdrop Renderer (2026-07-18)

Battle-only district imagery, procedural fallback scenery, encounter mood
treatments, vignette shading, and animated atmosphere tiling now live in
`src/game/battle/render-backdrop.ts`. BattleScene supplies only explicit render
context (texture keys, map index, mood, quality, and motion preference), while
the module owns no combat state or resolution logic. The renderer loads during
the guarded battle readiness phase, is retained across safe scene reuse, and
falls back to a battlefield image or solid stage if the optional chunk fails.

Measured production output:

| Chunk | Size | Gzip |
| --- | ---: | ---: |
| `index-BEUQaSNC.js` | 670.8 KB | 174.9 KB |
| `game-core-DK3fs1w9.js` | 28.5 KB | 10.3 KB |
| `render-backdrop-COncJNqR.js` | 2.0 KB | 0.9 KB |
| `debug-state-DqsNQNYL.js` | 5.3 KB | 2.0 KB |
| `fx-presenter-DW3nnVqo.js` | 3.7 KB | 1.6 KB |

Combined boot code is 699.3 KB minified / 185.2 KB gzip. Relative to the lazy
debug-state baseline, the app entry is 0.9 KB minified / 0.4 KB gzip smaller
and combined boot is 1.0 KB / 0.5 KB smaller. The backdrop chunk has a 4 KB
hard budget, deployment validation requires exactly one hashed copy, and
`index.html` may not modulepreload it.

Focused coverage proves guarded first-load readiness, all four authored boss
backdrop variants, street/rival/boss mood selection, and the exact Lean-effects
atmosphere reduction (10 strips versus 21 at full quality). The required shared
production client rendered Rooftop Blocks with one backdrop build, four
persistent backdrop objects, 21 atmosphere strips, a complete combat board,
and zero error artifacts under
`.artifacts/test-results/battle-backdrop-renderer/shared-client/`. Release
validation passes all nine critical sequencing scenarios, and the complete
155-test Chromium suite passes in 22.4 minutes.

## Lazy Battle Foreground Renderer (2026-07-18)

Enemy and flock-leader composition now lives in
`src/game/battle/render-foreground.ts`. The battle-only module owns character
art and procedural silhouettes, target reticles, elite crests, enemy vitals,
intent badges, status chips, and passive presentation tweens. BattleScene
retains authoritative positions, intent math, incoming damage, hit geometry,
selection, click callbacks, motion cues, combat timing, and resolution.

Measured production output:

| Chunk | Size | Gzip |
| --- | ---: | ---: |
| `index-BA1jXShr.js` | 667.9 KB | 174.0 KB |
| `game-core-DK3fs1w9.js` | 28.5 KB | 10.3 KB |
| `render-foreground-BO2FWYY2.js` | 6.5 KB | 2.4 KB |

Combined boot code is 696.5 KB minified / 184.3 KB gzip. Relative to the
backdrop-renderer baseline, the app entry and combined boot are each 2.9 KB
smaller, with gzip down 0.9 KB. The new chunk has an 8 KB hard budget;
deployment validation requires exactly one hashed copy and forbids preloading.
If it fails, BattleScene renders compact clickable combatant silhouettes rather
than blocking combat readiness.

Focused readiness, generated vitals/status, multi-enemy, and reduced-motion
sequencing checks pass. The required shared production client drove title ->
route -> combat, reported `battleForegroundRenderer.ready/loaded`, reached a
settled unlocked battle with one enemy and a complete five-card hand, and
emitted zero error artifacts. The inspected production screenshot and text
state are under `.artifacts/test-results/battle-foreground-renderer/production-proof/`.
`npm run validate` passes all static release checks and nine critical sequencing
scenarios. The complete 155-test Chromium suite passes in 18.1 minutes on one
worker.

## Lazy Battle Reward Renderer (2026-07-18)

Post-combat card, Preen, and Waymark ceremony composition now lives in
`src/game/battle/render-reward.ts`. The module owns ceremony framing, deck-need
chips, reward cards and fallbacks, hover/spotlight/glow presentation, Waymark
tags, and the skip command. BattleScene retains reward generation, build
analysis, progression, persistence, selection callbacks, and route transitions.

Measured production output:

| Chunk | Size | Gzip |
| --- | ---: | ---: |
| `index-BYsCFMQA.js` | 661.9 KB | 172.7 KB |
| `game-core-DK3fs1w9.js` | 28.5 KB | 10.3 KB |
| `render-reward-y2cDptqO.js` | 11.4 KB | 3.6 KB |

Combined boot code is 690.4 KB minified / 183.1 KB gzip. Relative to the lazy
foreground-renderer baseline, the app entry and combined boot are each 6.0 KB
smaller, with gzip down 1.2 KB. The reward chunk has a 14 KB hard budget;
deployment validation requires exactly one hashed copy and forbids preloading
it. It is first requested only when a reward mode renders. While loading,
choices are visibly locked; if the optional chunk fails, a compact readable and
clickable fallback preserves progression.

Strict TypeScript and six focused readiness, guidance, visual, hover, strategy,
and input regressions pass. The required shared production client held the
renderer at `requested: false` throughout live combat, then crossed victory and
reported `requested/ready/loaded` with three choices and no error artifacts.
The inspected 1280x720 ceremony capture is
`.artifacts/web-game-reward-ceremony/shot-2.png`.

Release closure: `npm run validate` passes documentation, runtime data, all 618
runtime assets, bundle/cache contracts, enemy variety, Minor Arcana overlays,
and all nine critical sequencing scenarios. The complete 155-test Chromium
suite passes in 19.6 minutes on one worker.

## Lazy Battle HUD Renderer (2026-07-18)

Battle HUD presentation now lives in `src/game/battle/render-hud.ts`. The
battle-only module owns draw/discard piles, pile hit areas, combat-log and
Roost framing, Beat/Hustle progress, First Flight guidance, encounter-objective
presentation, and selected-card outcome banners. BattleScene retains combat
state, pile contents, exact damage/HP math, selection, callbacks, sequencing,
and tooltip content.

Measured production output:

| Chunk | Size | Gzip |
| --- | ---: | ---: |
| `index-vMdeAScE.js` | 660.2 KB | 172.2 KB |
| `game-core-DK3fs1w9.js` | 28.5 KB | 10.3 KB |
| `render-hud-lpNJk4rE.js` | 7.0 KB | 2.5 KB |

Combined boot code is 688.8 KB minified / 182.5 KB gzip. Relative to the lazy
reward-renderer baseline, the app entry is 1.7 KB minified / 0.5 KB gzip
smaller and combined boot is 1.6 KB / 0.6 KB smaller. The HUD chunk has a
10 KB hard budget; deployment validation requires exactly one hashed copy and
forbids modulepreloading it. If loading fails, compact readable pile, Roost,
log, Beat, guidance, objective, and selection-preview fallbacks preserve play.

Strict TypeScript and twelve focused readiness, pile, Roost, guidance,
objective, Hustle, event-log, selection, ordering, and lethal-preview checks
pass. The required shared production client drove title -> route -> combat,
reported `battleHudRenderer.ready/loaded`, rendered the settled guide, piles,
log, Roost, and Beat surfaces with no error artifacts, then clicked Roost and
advanced cleanly to turn 2. Inspected captures and text state are under
`.artifacts/web-game-hud-renderer-settled/` and
`.artifacts/web-game-hud-renderer-roost/`.

Release closure: `npm run validate` passes documentation, runtime data, all 618
runtime assets, bundle/cache contracts, enemy variety, Minor Arcana overlays,
and all nine critical sequencing scenarios. The complete 155-test Chromium
suite passes in 18.9 minutes on one worker.

## Lazy Battle Hand Renderer (2026-07-18)

Battle hand composition now lives in `src/game/battle/render-hand.ts`. The
battle-only module owns hand-rail composition, compact cards, generated frames,
selection pulses, Flow/Surge hints, late compact-art refresh, and large hover
dossiers. BattleScene retains card instances, energy/cost rules, targeting,
effect contracts, preview simulation, selection, and play callbacks.

Measured production output:

| Chunk | Size | Gzip |
| --- | ---: | ---: |
| `index-CM0wXETm.js` | 659.5 KB | 171.9 KB |
| `game-core-DK3fs1w9.js` | 28.5 KB | 10.3 KB |
| `render-hand-DxGIYwfa.js` | 7.2 KB | 2.7 KB |

Combined boot code is 688.0 KB minified / 182.3 KB gzip. Relative to the lazy
HUD-renderer baseline, the app entry is 0.7 KB minified / 0.3 KB gzip smaller
and combined boot is 0.8 KB / 0.2 KB smaller. The hand chunk has a 10 KB hard
budget; deployment validation requires exactly one hashed copy and forbids
modulepreloading it. If loading or rendering fails, compact readable and
clickable cards plus a readable rules preview preserve combat play.

Strict TypeScript and seven focused readiness, pointer-selection, ordering,
compactness, instance-identity, hover-detail, and generated-frame regressions
pass. The required shared production client drove title -> route -> combat,
reported `battleHandRenderer.ready/loaded`, selected First Flight with a real
pointer, preserved the outcome/Flow forecast, reused the persistent hand, and
emitted no error artifacts. The inspected selected-hand capture is under
`.artifacts/web-game-hand-renderer/`; the separately exercised and inspected
large hover dossier is under `.artifacts/web-game-hand-preview/`.

Release closure: `npm run validate` passes documentation, runtime data, all 618
runtime assets, bundle/cache contracts, enemy variety, Minor Arcana overlays,
and all nine critical sequencing scenarios. An initial complete run exposed two
unrelated load-order samples in How-to-Play and exhaustive Codex layout checks;
both reproduced cleanly in isolation, then their readiness/yield conditions
were hardened without reducing assertions. The clean rerun passes all 155
Chromium tests in 22.2 minutes on one worker.

## On-Demand Battle Card/Pile Inspector (2026-07-18)

Combat deck, draw, and discard inspection presentation now lives in
`src/game/battle/render-inspect.ts`. The module owns the review shell, count
badges, sortable rows, scrolling, card art, rule text, stat chips, and detail
dossier. BattleScene retains pile contents, card/effect rules, costs, selection,
asset requests, and callbacks. The module is requested only when a player opens
one of those indexes; flock statistics remain on their existing path.

Measured production output:

| Chunk | Size | Gzip |
| --- | ---: | ---: |
| `index-DBFUwcrV.js` | 653.5 KB | 170.5 KB |
| `game-core-DK3fs1w9.js` | 28.5 KB | 10.3 KB |
| `render-inspect-BjlftNwh.js` | 8.6 KB | 2.9 KB |

Combined boot code is 682.0 KB minified / 180.9 KB gzip. Relative to the fresh
pre-extraction baseline (686.6 KB / 182.0 KB gzip), boot code is 4.6 KB smaller
and gzip is 1.1 KB smaller. The inspector has a 12 KB hard budget; deployment
validation requires exactly one hashed chunk and forbids modulepreloading it.
While loading, the overlay shows a readable progress panel. A failed request
shows a close-and-retry state, and the next open retries the import.

Strict TypeScript and the focused pile/dossier tests pass. The required shared
production client proved `requested/loaded/failed` remains `false/false/false`
in ordinary combat, then opened the draw pile with a real pointer and reported
`true/true/false` with no browser errors. The inspected 1280x720 capture and
text-state evidence are under `.artifacts/web-game-inspect-renderer/`.

Release closure: `npm run validate` passes every documentation, runtime data,
world/runtime asset, bundle/cache, content, overlay, and sequencing gate. The
first complete browser pass exposed one old deck-review test's fixed 80 ms
assumption; its full visual assertions now wait on explicit inspector readiness.
The focused deck/pile rerun passes, followed by a clean 155-test Chromium pass
in 17.8 minutes on one worker.

### Rejected support-overlay split

Two follow-up experiments tried moving the combat Flock Stats, Supply, and
Waymark presentation behind another dynamic import. The flock-only version
created a 2.9 KB / 1.1 KB gzip chunk but increased combined boot code from
682.0 KB to 682.4 KB. Grouping all three support overlays created a 4.9 KB /
1.9 KB gzip chunk, moved the app entry to 654.6 KB / 170.4 KB gzip, and raised
combined boot code to 683.2 KB / 180.7 KB gzip. Import plumbing and context
bridges outweighed the extracted presentation in both variants, so both were
rejected and removed. The production baseline remains 682.0 KB / 180.9 KB
gzip with no support-overlay chunk.

## Compact Runtime Item Art (2026-07-18)

Route and combat previously preloaded a 2048x2048, 601.6 KB Scrap texture for
small HUD feedback. Supply and Waymark drawers also fetched 512x512 source art
for 40-126 px presentation. `tools/build-runtime-item-art.py` now derives a
96 px Scrap texture and a 256 px compact tier for every Supply and Waymark,
while the Codex dossier keeps the full 512 px detail tier.

Measured asset output:

| Runtime item tier | Count | Transfer size |
| --- | ---: | ---: |
| Full source icons | 90 | 9,974.6 KB |
| Compact icons | 90 | 1,583.7 KB |
| Reduction | | 84.1% |

Scrap alone falls from 601.6 KB to 4.7 KB. The production client observed the
96x96 Scrap response at 4,844 bytes and three representative 256x256 Supply
responses at 21,636-26,530 bytes. No full Supply texture was requested by the
drawer. The compact URL manifest moves combined boot code from 682.0 KB /
180.9 KB gzip to 690.7 KB / 182.1 KB gzip, but the first Route or Battle scene
avoids about 596.9 KB of image transfer, for an approximate 588 KB net cold
transfer reduction even before a player opens an item drawer.

The runtime asset validator caps every compact item at 32 KB, and runtime-data
validation requires a compact counterpart for all declared Supplies and
Waymarks plus Scrap. Six focused route, drawer, Codex, and combat scenarios
pass; the Codex regression also proves its selected dossier loads and renders
the separate full-detail texture. Production and test captures show crisp
compact art with no browser errors.

## Runtime UI WebP Tier (2026-07-18)

The 257 generated PNGs under `assets/runtime/ui/icons/` totalled 38.11 MiB even
though most are presented as small medallions, chips, plaques, or panel frames.
`tools/build-runtime-ui-art.py` now derives same-dimension, alpha-preserving
quality-90 WebPs for runtime delivery while retaining those PNGs as canonical
workshop inputs.

| Runtime UI tier | Count | Transfer size |
| --- | ---: | ---: |
| Canonical PNG inputs | 257 | 38.11 MiB |
| Production WebPs | 257 | 8.47 MiB |
| Reduction | | 77.8% |

Representative reductions include the deck-review detail frame from 937.8 KiB
to 99.4 KiB, run-outcome report from 678.7 KiB to 64.3 KiB, and Codex dossier
from 496.9 KiB to 94.9 KiB. Combined boot JavaScript remains 690.7 KB minified
/ 182.1 KB gzip; only asset URLs changed, with all texture keys and Phaser
loader/cache behavior preserved.

Runtime validation enforces exact PNG/WebP stem parity and a 120 KiB ceiling.
Deployment validation requires one hashed WebP and forbids a hashed PNG for
every UI ID. Five focused title, deck-review, outcome, Codex-detail, and Codex-
browser scenarios pass. The required production client inspected the title and
How-to-Play surfaces at 1280x720; both retain crisp transparent ornament and
aligned framing. Live request evidence shows hashed WebPs for the medallions,
panel flourish, command frames, and title plaque, with no UI PNG request or
browser error.

Release closure: `npm run validate` passes documentation, runtime data, all 960
optimized runtime assets, legacy-world rejection, bundle/cache contracts,
enemy variety, Minor Arcana overlays, and all nine sequencing scenarios. The
complete Chromium suite passes all 155 tests in 22.0 minutes on one worker.

## Runtime FX WebP Tier (2026-07-18)

The 71 used generated FX PNG sources total 14.84 MiB across title launch,
route travel, combat spritesheets, telegraphs, impacts, status feedback, and
victory/defeat presentation. `tools/build-runtime-fx-art.py` now derives
same-dimension, alpha-preserving quality-90 WebPs for production delivery.

| Runtime FX tier | Count | Transfer size |
| --- | ---: | ---: |
| Canonical PNG inputs | 71 | 14.84 MiB |
| Production WebPs | 71 | 5.02 MiB |
| Reduction | | 66.2% |

The largest output is `combat-victory-rally.webp` at 128.9 KiB. Quality 95 was
rejected because it added 0.72 MiB for only a 0.31 dB composited-image gain.
Original-resolution inspection and dark-battlefield composites of the largest
support tell, atmosphere strip, and precision reticle show no visible fringe
or block artifacts at quality 90. One unused 64x64 `combat-spark-particle`
orphan was removed; the live particle system uses the framed combat FX atlas.

All Phaser texture keys, spritesheet frame dimensions, and essential/enemy-
turn/optional loader groups are unchanged. Runtime validation enforces exact
PNG/WebP parity and a 140 KiB ceiling. Deployment validation requires one
hashed WebP and forbids a hashed PNG for each FX source. Production boot JS is
unchanged at 690.7 KB minified / 182.1 KB gzip.

Four focused title-launch, route-travel, generated-FX-pack, and combat-windup
scenarios pass. The required production client drove title -> route -> combat,
showed a complete 1280x720 battlefield with all essential FX and 21 atmosphere
tiles loaded, and emitted no browser errors. Live production requests confirm
hashed WebPs for launch, travel, atlas, atmosphere, reticle, and support-tell
assets with no matching PNG request.

Release closure: `npm run validate` passes documentation, runtime data, all 959
optimized runtime assets, legacy-world rejection, bundle/cache contracts,
enemy variety, Minor Arcana overlays, and all nine sequencing scenarios. The
complete Chromium suite passes all 155 tests in 22.1 minutes on one worker.

## First-Combat Outcome FX Deferral (2026-07-18)

Three cold-cache production samples at 1280x720 showed that the opening battle
loaded victory rally, victory fanfare, and boss phase-break textures before the
player could make a decision. Those three WebPs total 305.8 KiB on disk and
cannot clarify the opening board. They now live in an outcome group: normal
encounters warm it on the first committed card or Roost action, while boss and
elite encounters still request it during setup.

| Cold route -> playable combat metric | Before median | After median | Change |
| --- | ---: | ---: | ---: |
| Transfer after route commit | 7,042,162 B | 6,728,147 B | -314,015 B (-4.5%) |
| Combat-labelled transfer | 5,712,580 B | 5,398,565 B | -314,015 B (-5.5%) |
| Decoded combat texture estimate | 57,573,632 B | 54,558,976 B | -3,014,656 B (-5.2%) |
| Combat textures at first input | 70 | 67 | -3 |
| Worst requestAnimationFrame gap | 394 ms | 360 ms | -34 ms (-8.7%) |
| Route commit to first input | 3,374 ms | 3,391 ms | +17 ms (noise) |

The change is retained for its transfer, residency, and frame-gap improvement;
it does not claim a time-to-input win. A production first-card sample proved
all three hashed WebPs load immediately after commitment. The required client
also reached a clean, playable battle with the pack absent at entry, and the
focused generated-FX and full encounter regressions pass. The complete
Chromium matrix passes all 155 scenarios in 20.8 minutes. During closure, two
pre-existing wall-clock flakes were stabilized without relaxing gameplay
assertions: the route streak now advances deterministic Phaser time, and the
multi-phase combat timing scenario has an outer timeout above its measured
24-31 second runtime.

## Route Event Art On-Demand Loading (2026-07-18)

A production route -> combat -> route profile rejected speculative texture
unloading. Phaser's global cache made the combat return transfer-free, so
discarding route textures would trade a working zero-byte return for extra
network and decoder work. The actual cold-route regression was that every
special-event and Market scene texture loaded before the player opened any of
those surfaces.

`RouteScene` now loads only the eight route-node icons and current district
backdrop during ordinary route setup. Basin, Cache, Signal, Nest, Rival, and
Market art is grouped by node type and queued when its matching overlay opens.
The loader completion callback redraws the open overlay, preserving the vector
fallback while the targeted textures are in flight.

| Production texture metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| Ordinary route texture estimate | 181,410,016 B | 104,040,156 B | -77,369,860 B (-42.6%) |
| Ordinary route texture count | 197 | 174 | -23 |
| First-battle texture estimate | 260,454,384 B | 183,291,560 B | -77,162,824 B (-29.6%) |
| First-battle texture count | 335 | 315 | -20 |
| Combat -> route transfer | 0 B | 0 B | preserved |

The 18 deferred scene textures account for 3,979,034 bytes on disk and about
76.47 MB of decoded RGBA residency. A production Basin probe requested only
its backdrop, Sella Warmwick portrait, and hearth-cart prop (677,846 transfer
bytes); unrelated event and Market keys remained absent. Focused coverage
proves an ordinary route starts with no event/Market scene textures, Basin adds
exactly its three assets, Market adds exactly its four assets, and the existing
all-event and generated-Market presentation contracts still render correctly.

The first complete matrix exposed a real transition race: a late optional-asset
completion could call `renderAll()` during the 520 ms route-commit beat and
destroy the live travel streak. Route redraws now preserve transient objects
and tweens while commitment is pending, but still refresh text-state telemetry;
the destination path owns the next stable redraw. The route-travel and targeted
event-load scenarios pass together in three repeated focused runs.

Release closure: `npm run validate` passes documentation, runtime data, all 959
optimized runtime assets, legacy-world rejection, bundle/cache contracts,
enemy variety, Minor Arcana overlays, and all nine sequencing scenarios. The
complete clean Chromium matrix passes all 156 scenarios in 19.7 minutes.

## Codex Scene On-Demand Boundary (2026-07-18)

The remaining entry and combined-boot soft-target warnings were addressed with
a real optional-scene split. The full Codex browser and dossier presentation now
live in `src/game/codex-scene.ts`; the title registers that scene only after the
player chooses Codex. A compact title notice covers the request, failures reset
the loader for a click-to-retry attempt, and the test harness uses the same
registration path instead of restoring Codex to the boot graph.

| JavaScript metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| App entry | 687.6 KB | 635.0 KB | -52.6 KB (-7.6%) |
| Combined boot | 716.1 KB | 663.4 KB | -52.7 KB (-7.4%) |
| Game core | 28.4 KB | 28.4 KB | unchanged |
| On-demand Codex scene | boot-loaded | 55.2 KB | deferred |

The production HTML preloads only Phaser, runtime data, and game core; neither
the Codex scene nor Codex data appears in `modulepreload`. This clears both the
675 KB app-entry and 710 KB combined-boot preferred targets without changing a
hard cap or hiding code inside a preloaded manual chunk.

Focused production-browser coverage proves the scene is unregistered and its
chunk unrequested at menu readiness, then registered, requested, and active
after the menu command. It also exposed and closed an early-click race where a
normal title UI-art restart could invalidate the originating Menu instance.
The continuation now targets the live scene manager, so the click survives that
refresh. The existing full Codex rendering scenario passes unchanged. The
required shared client reached the Codex via its real canvas command, produced a
clean browser frame and matching `mode: codex` text state, and emitted no error
artifact; evidence is under `.artifacts/codex-lazy-production/client/`.

The first 169-scenario closure matrix passed 165 cases and found four
deterministic late failures unrelated to the split. Three legacy/manual effect
states omitted the newer Molt Power fields, which let `undefined` propagate to
WebAudio as `NaN`; `spendMoltPower` now treats missing or non-finite power as
zero. The fourth assertion expected 11 raw overkill damage in `statTaken` even
though the flock had only one Cohesion left; the telemetry contract records the
one point actually lost while the combat log retains the 11-damage hit. All four
cases pass together after correction. The authoritative extended rerun passes
all 169 Chromium scenarios in 22.3 minutes on one worker, including the late
Molt/audio, overkill telemetry, lazy Codex, and actual-pointer single-cue paths.
Final `npm run validate` and its nine sequencing scenarios also pass on the
corrected build.

## Human Playtest Export Bridge (2026-07-18)

The five-session first-run gate previously had complete browser telemetry and a
Node dashboard but no player-facing path between them. Run history could only
be copied through a developer-console hook. Builds opened with `?playtest=1`
now add a local-only export command to the already lazy Profile scene. Normal
player UI is unchanged, and the command creates a JSON download without a
network upload.

The dashboard tool accepts one file, several file arguments, or a directory of
exports. It merges arrays and deduplicates stable run IDs, allowing each fresh
tester to retain a separate browser profile and download. A two-file fixture
containing one repeated ID produced exactly two dashboard runs. The default
dashboard was restored to its seeded-pipeline label after the proof.

The shared production client inspected the empty-history command and matching
text state with no browser errors. Focused coverage drives the enabled command
through a real canvas pointer, reads the downloaded file, compares it to the
journaled source, verifies status feedback, and observes no mutating request.
The full current-build matrix passes all 170 Chromium scenarios in 24.0 minutes.

Production remains under both preferred boot targets:

| JavaScript metric | Current |
| --- | ---: |
| App entry | 635.1 KB |
| Combined boot | 663.5 KB |
| Lazy Profile scene | 13.9 KB |

## Deployment Security Header Contract (2026-07-18)

The deployment artifact previously documented cache headers but shipped no
security-header manifest. Its responsive platform gate was also an inline
script, preventing a strict self-only script policy.

The gate now compiles from `src/platform-gate.ts`, and production HTML contains
only an external module entry. `public/_headers` is copied into the build with a
strict script CSP, object/base/form/frame denial, browser capability limits,
same-origin isolation, no-referrer and MIME-sniff protection, plus the existing
fresh-HTML/immutable-asset cache rules. Phaser's runtime canvas sizing retains a
style-only inline allowance; scripts receive neither `unsafe-inline` nor
`unsafe-eval`.

Deployment validation requires and parses the emitted manifest, rejects inline
executable scripts, and checks every required hardening/cache directive. A
focused browser scenario injects the exact CSP into the production document and
boots Menu without CSP, console, or page errors. The existing unsupported-
display lifecycle test and required shared-client title capture also pass.

The small externalized gate raises app entry by about 0.6 KB while remaining
well below targets:

| JavaScript metric | Current |
| --- | ---: |
| App entry | 635.7 KB |
| Combined boot | 664.2 KB |

Final closure passes `npm run validate`, all nine sequencing scenarios, and the
complete 171-test Chromium matrix in 24.9 minutes on one worker.

## Full Save Backup Boundary (2026-07-18)

Full backup/restore lives in the already lazy Profile scene. The versioned
serializer, schema validation, local file/download helpers, staged restore UI,
and restore preview increase that optional chunk to 22.8 KB minified / 7.9 KB
gzip without moving the feature into the boot path.

| JavaScript metric | Current |
| --- | ---: |
| App entry | 636.4 KB |
| Combined boot | 664.8 KB |
| Lazy Profile scene | 22.8 KB |

Both preferred boot targets remain satisfied. The full 174-test Chromium
matrix passes in 23.7 minutes on one worker after the backup feature, alongside
all release and critical sequencing gates.

## Profile Input Parity (2026-07-19)

Keyboard/gamepad focus, binding-aware hints, focus telemetry, and single-cue
action ownership remain inside the optional Profile chunk. Boot code is
effectively unchanged; the Profile scene grows by 2.9 KB minified / 0.8 KB gzip
relative to the full-save boundary.

| JavaScript metric | Current |
| --- | ---: |
| App entry | 636.4 KB |
| Combined boot | 664.9 KB |
| Lazy Profile scene | 25.7 KB / 8.7 KB gzip |

All bundle, deployment, runtime, asset, and sequencing gates pass. The full
175-test Chromium matrix passes in 24.2 minutes on one worker.

## Compact Title First-Paint Textures (2026-07-19)

The one-pass title boot exposed a remaining GPU/upload cost: twelve medallion
textures authored at 256-320 px were being decoded for controls that never
exceed 34 game pixels. `tools/build-runtime-ui-art.py` now derives an explicit
128 px `title-preload` set from the canonical PNGs. The regular runtime WebPs
remain canonical; the compact files are boot-only derivatives with distinct
`-title-preload` names, and deployment validation requires exactly one hashed
copy of every canonical and compact asset.

The compact subset falls from 1,155,072 to 196,608 pixels (83.0% fewer) and
97.5 KB total. Across all 24 essential title textures, decoded source area falls
from 3,137,536 to 2,179,072 pixels. The rebuilt menu splash also returns to its
scripted 273.0 KB output. In matched cache-disabled local production profiles,
complete generation-1 title readiness improved from 2.22 seconds to 1.68
seconds (about 24%), while measured title/splash transfer fell from roughly
1.32 MB to 1.02 MB.

Runtime telemetry reports essential pixel area, compact asset count/readiness,
and the maximum compact dimension. Focused title/onboarding coverage, inspected
1280x720 and 2560x1440 captures, all deployment/bundle/runtime gates, and all
nine critical sequencing scenarios pass with no browser errors. The compact
medallions remain crisp in the title and larger How to Play seal.

| JavaScript metric | Current |
| --- | ---: |
| App entry | 648.8 KB / 170.1 KB gzip |
| Combined boot | 677.2 KB / 180.4 KB gzip |

## Optional Route Presentation Boundaries (2026-07-26)

Recent production work raised the app entry above its preferred 675 KB target
even though every hard bundle limit still passed. A build-only composition
report confirmed that the remaining cost lived in `src/main.ts`, not shared
runtime data. Three non-opening-path presentation families now cross genuine
dynamic-import boundaries:

- route and combat Flock Stats use `flock-stats-overlay`;
- route hover, Deck Review detail, and market dossiers use
  `card-hover-detail`;
- route abandon confirmation reuses `system-overlays`.

Route creation preloads card detail so hover remains responsive after the title
transition. The first hover still has a lightweight shell and ignores late
loads after dismissal. Flock Stats explicitly exposes loading/failure states
that can always be closed and retried.

The size validator now requires the Flock Stats chunk to stay at or below 8 KB
and the card-detail chunk at or below 10 KB. Deployment validation also rejects
either as an eager modulepreload. Current production output is:

| JavaScript metric | Current |
| --- | ---: |
| App entry | 674.8 KB / 177.6 KB gzip |
| Combined boot | 703.9 KB / 188.3 KB gzip |
| Lazy Flock Stats | 5.5 KB / 2.0 KB gzip |
| Lazy card detail | 8.6 KB / 2.6 KB gzip |

Both preferred boot targets pass without relaxing their thresholds. Full
release validation and all 19 critical sequencing scenarios pass.

## On-Demand Deck Comparison (2026-07-26)

Route Deck Review now supports pinned, side-by-side card comparison. Pinning a
different card compares two cards; pinning the selected card compares its Base
and Preened normal rules, Molt rules, role, target, and flock-stat totals. The
renderer lives in `card-comparison`, loads on the first pin, and leaves the
selected card's normal dossier readable while the request is in flight. A
failed request remains recoverable by unpinning and repinning.

The existing card-detail 10 KB hard budget remains unchanged. The comparison
has its own 6 KB hard budget, deployment validation requires exactly one
hashed chunk, and `index.html` may not modulepreload it. Current production
output is:

| JavaScript metric | Current |
| --- | ---: |
| App entry | 691.6 KB / 182.0 KB gzip |
| Combined boot | 720.9 KB / 192.7 KB gzip |
| Lazy card detail | 8.6 KB / 2.6 KB gzip |
| Lazy card comparison | 3.5 KB / 1.3 KB gzip |

The hard bundle and deployment gates pass. The existing preferred 675 KB app
entry and 710 KB combined-boot advisories remain visible.

## Default-Off Screen Reader Runtime (2026-07-26)

The accessibility preference and compact state façade remain available at
boot, but the polling engine now lives in `screen-reader-runtime`. With Screen
Reader off—the default—the runtime and its existing summary module are absent
from network resources, no polling interval runs, and the HTML status region
retains its static `aria-live="off"` contract. Enabling announcements loads the
runtime, activates the live region, and then loads the scene-summary module;
disabling announcements stops the observer and clears the region.

The size validator enforces a 4 KB hard ceiling for the runtime chunk.
Deployment validation requires exactly one hashed copy and rejects it from
module preloads. Current production output is:

| JavaScript metric | Current |
| --- | ---: |
| App entry | 675.0 KB / 177.6 KB gzip |
| Combined boot | 704.1 KB / 188.3 KB gzip |
| Lazy screen-reader runtime | 1.4 KB / 0.7 KB gzip |

Both preferred boot targets pass. Focused coverage proves the runtime and
summary stay cold while off, load on opt-in, announce through menu, route,
combat, and settings focus, and stop cleanly when disabled.

## Optional Title and Profile Boundaries (2026-08-08)

The title now keeps diagnostics, Help/Settings/Codex presentation, leader
tooltips, the Start Run flourish, and the full Flock Record scene behind
interaction-driven imports. The title itself still paints immediately; these
boundaries defer only presentation and diagnostics that are not needed to
choose a flock and understand the opening screen. Loading failures remain
retryable, and automation can still register Profile and Codex scenes on
demand.

The title's lower command zone now shares a restrained dark scrim so leader,
Ascension, flight-length, and Start Run controls read as one layer over the
detailed key art. Help asset refreshes replace their prior overlay cleanly,
leaving one action target instead of stacking duplicate interactive controls.

| JavaScript metric | Current |
| --- | ---: |
| App entry | 675.0 KB / 180.4 KB gzip |
| Combined boot | 705.0 KB / 191.3 KB gzip |
| Lazy menu diagnostics | 5.5 KB / 2.2 KB gzip |
| Lazy optional title UI | 4.1 KB / 1.8 KB gzip |
| Lazy title launch | 2.5 KB / 1.2 KB gzip |
| Lazy Profile scene | 164.0 KB / 41.4 KB gzip |

The size gate now caps all four new chunks. Both preferred boot targets pass
without relaxing their thresholds. Production build, deployment-cache,
runtime-data, documentation, and the five affected Chromium flows pass. The
shared production client also completed title, Help, and Route action chains
without browser errors; inspected captures live under
`.artifacts/visual-audit/`.

## Route-Only Flight Folio Records (2026-08-09)

Packed Supplies gained shared route/combat focus, confirmation, controller, and
screen-reader state. The added interaction contract pushed combined boot code
from 724.0 KB to 730.9 KB, exposing that saved Flight Folio sanitation and
record creation were still bundled into the opening path even though those
operations are only needed after entering RouteScene.

`src/game/saved-decks.ts` now crosses a real route-only dynamic-import boundary.
RouteScene warms it after entry, and saving still has a retryable load path. The
battle Packed Supplies text-state assembly also remains with the existing lazy
battle diagnostics module. Bundle validation caps `saved-decks` at 8 KB and the
expanded battle diagnostics module at 10 KB; deployment validation requires one
hashed saved-decks chunk and rejects module-preloading it.

| JavaScript metric | Current |
| --- | ---: |
| App entry | 689.8 KB / 182.2 KB gzip |
| Combined boot | 725.0 KB / 195.4 KB gzip |
| Lazy saved Flight Folios | 6.3 KB / 2.4 KB gzip |
| Lazy battle diagnostics | 8.8 KB / 3.2 KB gzip |

The unchanged 725 KB hard boot ceiling passes. The 675 KB app-entry and 710 KB
combined-boot preferred targets remain visible as advisories for the next scene
extraction pass.

## Suit Card Voices (2026-08-09)

Suit-specific card-play voices and the Molt shimmer live inside the existing
interaction-loaded `adaptive-music` boundary. This keeps the Web Audio plans,
noise buffers, and oscillator helpers out of the opening path and preserves the
single non-preloaded audio chunk contract. The adaptive chunk is 5.8 KB
minified / 2.1 KB gzip, below its 8 KB hard cap.

The same boundary now rotates three subtle pitch variants for consecutive card
casts. Preen commitments reuse the established Molt-power upgrade signature
only after the card mutation succeeds, so route, Market, and post-combat
upgrades gain a distinct payoff without another boot-side cue or audio asset.

The small boot-side router was paid for without relaxing any gate. Four crowded
three-note utility cues (district advance, profile record, objective complete,
and Market purchase) now use cleaner two-note signatures. The resulting
production build measures 689.8 KB / 182.2 KB gzip for the app entry and 725.0
KB / 195.4 KB gzip for combined boot code. The 725 KB hard ceiling passes; the
existing preferred-target warnings remain visible.

## Interaction-Loaded Synthesized SFX (2026-08-09)

The UI and combat sound recipes now live in `audio-sfx`, a dedicated dynamic
boundary fetched on the first requested non-card cue. The director queues that
request across the import, retains the close cue that confirms a mute action,
retries a failed import, and exposes loaded/played telemetry for deterministic
verification. Ambient scene beds and adaptive score/card voices retain their
existing ownership and volume controls.

The size validator caps the new module at 8 KB. Deployment validation requires
exactly one hashed `audio-sfx` chunk and rejects module-preloading it. Focused
and complete browser coverage prove the module is absent before interaction,
the first cue plays after loading, later cues reuse the same resource, and mute
feedback remains correct across title, route, combat, pause, and settings.

| JavaScript metric | Before | Current |
| --- | ---: | ---: |
| App entry | 689.8 KB / 182.2 KB gzip | 683.6 KB / 180.5 KB gzip |
| Combined boot | 725.0 KB / 195.4 KB gzip | 718.8 KB / 193.7 KB gzip |
| Lazy synthesized SFX | bundled in entry | 6.0 KB / 2.0 KB gzip |

The unchanged hard ceilings pass with 6.2 KB of restored combined-boot
headroom. The preferred 675 KB app-entry and 710 KB combined-boot advisories
remain visible for the next extraction pass.

## Independent Card Voice Volume (2026-08-10)

The fourth audio preference adds only scalar routing to the opening director;
the Settings renderer, backup/profile surfaces, and card oscillator plans stay
inside their existing lazy chunks. No new runtime boundary or preload was
introduced.

| JavaScript metric | Current |
| --- | ---: |
| App entry | 684.0 KB / 180.6 KB gzip |
| Combined boot | 719.1 KB / 193.8 KB gzip |
| Lazy adaptive music/card voices | 5.8 KB / 2.2 KB gzip |
| Lazy Settings overlay | 29.8 KB / 9.0 KB gzip |

Bundle-size and deployment-cache validation pass without changing a hard cap.
The preferred 675 KB entry and 710 KB combined targets remain advisory and
visible.

### 2026-09-07: grouped Settings and reward tradeoffs

Settings stays in its existing lazy overlay module. Section navigation reuses
the existing row objects and disables hidden hit targets; no additional runtime
dependency or art is introduced. Labels increase from 14 to 17 logical pixels,
values from 13–14 to 16–17, and rows use 64-pixel spacing.

The production entry is 684.1 KB, combined boot code 719.3 KB, game core 29.9 KB,
and lazy Settings overlay 31.9 KB. Bundle and deployment-cache hard gates pass;
the existing preferred entry/combined-boot target warnings remain unresolved.

### 2026-09-07: reward readability and deck-impact inspection

Reward effects and focused build advice use 16px text with separate layout
regions. Measured truncation and focused advice are shared with the existing
lazy reward inspection/fallback utilities; no new runtime dependency or asset
was added. The hand preview sizes its rule region from rendered text height.

The production entry is 684.9 KB (180.9 KB gzip), combined boot 720.1 KB
(194.1 KB gzip), reward renderer 13.9 KB, and hand renderer 9.9 KB. All existing
hard ceilings pass, including 14 KB reward and 10 KB hand-renderer limits.
The shared reward inspection chunk is 40.6 KB (12.3 KB gzip); this refactor
preserves lazy boundaries, not a claim that total reward code became smaller.
Preferred 675 KB entry / 710 KB combined-boot warnings remain unresolved.

### 2026-09-07: readable full-loop help

How to Play uses six clearly separated decision summaries with uncapped 16px
body text and named rendered content shared with narration. Existing topic
icons are loaded only with deferred Help assets; no new art or dependency was
introduced. The lazy system overlay is 32.5 KB (10.1 KB gzip), menu debug state
5.9 KB, and app entry 685.0 KB. Combined boot remains 720.1 KB (194.1 KB gzip).
Hard bundle/deployment gates pass; preferred startup warnings remain open.

### 2026-09-07: Release/Preen deck-impact inspection

Route/Market picker inspection adds a before/after comparison without new art,
dependencies, or preload boundaries. Production entry is 686.4 KB (181.6 KB
gzip); combined boot is 721.5 KB (194.8 KB gzip). Shared reward inspection is
41.1 KB (12.4 KB gzip). The first build exceeded the Route diagnostics 24 KB
hard cap at 24.1 KB. Sharing the four picker icon-state calculations restores
that chunk to 23.6 KB (5.6 KB gzip), also avoiding duplicate display-list scans.
All hard bundle and deployment gates pass without changing limits. Preferred
675 KB entry / 710 KB combined-boot warnings remain open.

### 2026-09-08: readable Market purchase summary

The existing lazy reward-inspection module now holds the wrapped purchase
summary; no runtime dependency, asset, or new preload was introduced. The
entry is 687.1 KB (181.8 KB gzip), combined boot 722.3 KB (195.0 KB gzip),
shared reward inspection 41.6 KB (12.7 KB gzip), Route diagnostics 23.7 KB,
and screen-reader summary 49.0 KB. All hard bundle/deployment limits pass
unchanged. Preferred 675 KB entry / 710 KB combined targets remain open.

### 2026-09-08: complete Market rules pages

Measured rules pagination lives alongside existing reward/Market inspection;
no asset, dependency, preload boundary, or bundle budget was added. Retiring
the legacy Market branch keeps card detail at 9.9 KB (3.2 KB gzip). Shared
reward inspection is 44.4 KB (13.7 KB gzip), entry 687.2 KB (181.8 KB gzip),
combined boot 722.3 KB (195.0 KB gzip), Route diagnostics 23.7 KB, and the
screen-reader summary 49.2 KB. Hard bundle/deployment gates pass. Preferred
entry and combined-boot advisories remain; this pass makes no startup-speed
improvement claim.

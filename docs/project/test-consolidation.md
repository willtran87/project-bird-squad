# Browser test consolidation

Goal: a faster, less brittle Playwright suite that still catches the real
bugs. In recent sessions about 64 browser failures appeared and only about 10
were real bugs; the rest were tests pinned to exact positions, widths, row
counts, label lists or wording that had changed on purpose. The real bugs were
caught by behaviour tests (input ownership, save/resume, recovery, intentional
selection) and by general geometry rules (text floors, 8 unit separation,
44 CSS px targets, nothing off stage).

## What changed

1. **`tests/smoke.spec.ts` split into topic files.** The 35k-line file is now
   fourteen `tests/smoke-<topic>.spec.ts` files (title, onboarding, settings,
   audio, route, combat, combat-presentation, cards, rewards, market, deck,
   run, codex, folio). Shared helpers (`boot`, `clickNamedGameObject`,
   `clickFlightLabTool`, `focusFolioControl`, `openLabFixture`, the window
   typings) live in `tests/helpers/smoke.ts`. Test bodies and titles are
   unchanged, so the `test:sequencing` grep, `playwright.gate.config.ts`
   (now `**/smoke-*.spec.ts`), `tools/run-cross-browser-smoke.mjs` and the
   `browsers` job in `.github/workflows/deploy-pages.yml` (now `tests/smoke-`)
   select the same tests.
2. **Per-screen geometry sweep.** `tests/screen-geometry-sweep.spec.ts` with
   the surface driver in `tests/helpers/screen-surfaces.ts` visits every main
   screen and state and checks only general rules (see below). It replaces
   `tests/compact-type-inventory.spec.ts`, whose 45 surfaces it includes.
   The gate runs its 1000x560 tests (`gate-geometry` project).
3. **Consolidation.** Layout-pinning tests the sweep covers were removed,
   remapped=true/false duplicates collapsed, repeated viewport loops reduced to
   the smallest supported window, and four read-only combat tests share one
   booted page. Every removed or merged test is listed at the end.

## The sweep

Groups and surfaces (each group is one test; it boots once and reloads the page
per surface because scenes keep instance state across restarts):

| Group | Surfaces |
| --- | --- |
| menu | title, setup, how to play, settings (all four sections), storage-recovery notice |
| profile and codex | Flock Record, Folios tab, Codex collection, card/supply/Waymark/leader/enemy/glossary dossiers, items, leaders, enemies, glossary, empty search, tools, Atlas, saved views |
| route | route, node tooltip, Supply feedback, contract, district notice, event choice, pause, abandon confirmation, Flock stats, deck review (13 cards), Waymark and Supply drawers, every market shelf, sold stock, Preen picker and its reader |
| combat | idle, card selected, enemy target selected, tooltip, Supply feedback, intro, draw pile (13 cards), history, Supply drawer, Waymarks, pause, return choice, discard choice, card reward, reward hover, defeat outcome, flight details |

Viewports: 1000x560 (smallest supported desktop window, strictest CSS floors)
and 1280x720 (authored size) for every group; 2560x1600 for menu and combat.

Rules (all general, none pinned to a screen):

- text floors: 14 CSS px for any text, 16 CSS px for primary readouts; dense
  card faces tagged with a 15-17px tier may go to 11.5 CSS px;
- 44 CSS px touch targets and 8 game units between reachable commands
  (`checkTargetGeometry`'s rules, via the new `targetGeometryIssues`);
- no labelled command hidden under another command in the same layer (a
  separate overlay layer or a modal backdrop may cover one);
- no text or labelled command straddling the stage edge (text parked fully off
  stage or under an opaque scroll curtain counts as hidden);
- no text spilling out of the quiet panel it is laid out on, and no wrapped or
  fixed-width text whose longest line is wider than its box.

The sweep reports every failing surface of a group at once, with a JSON
inventory and a screenshot attached for each.

### Known issues found by the wider coverage

The sweep reaches states the type inventory never visited. It found three
product issues, all fixed before merging, so `KNOWN` in the spec is empty:

- Folios tab: library/template/import commands sat 3 units below the Profile
  tab row (rule: 8). The tab row moved up 5 units.
- Combat confirm in a side spot: the "CONFIRM TO PLAY" label dropped to
  16-17px, 12.4-13.2 CSS px at 1000x560 (floor: 14). Narrow spots now keep
  18px and wrap the label onto two lines in a 46-unit frame inside the same
  touch area.
- Draw/discard pile reader: row hits touched (gap 0) and the row metadata
  ("Draw · 0 Wingbeats", "ACTIVE · NOW") was 16px. Rows are now 66 units
  apart (six per page instead of seven) and those labels are 18px; the deck
  smoke tests that pinned seven rows were updated.

### Proof that the sweep catches real bugs

Two known past bugs were put back by hand and the gate's `gate-geometry`
project (the four 1000x560 sweep tests) was run against each, then the change
was reverted:

| Seeded bug | Result |
| --- | --- |
| Reward rule text shrunk to 15px (`rules.setFontSize(15)` after the face fit in `reward-card-face.ts`) | combat group failed: `reward` and `reward-hover` report `secondary text floor: reward-card-effect "..." 11.7 CSS px` for every card |
| Combat confirm moved back over Roost (confirm forced to the Roost spot 1196,470 in `render-hud.ts`) | combat group failed: `combat-selected` and `combat-targeting` report `command hidden: combat-roost-hit is covered by combat-selection-command-frame` and an 8 unit gap to the hand |

The first Roost run showed the cross-container rule was needed: before it, a
control drawn wholly over a larger command from a different container counted
as a nested action, and the bug was caught only through the neighbouring card
gap. Only a control in the same container now counts as nested.

## Counts and time

Counts from `npx playwright test --list`; times from full
`npm run test:e2e:standard` runs on the same machine (3 workers, JSON reporter,
summed = every test attempt's duration added up).

| Tier | Tests before | Tests after | Summed before | Summed after | Wall before | Wall after |
| --- | --- | --- | --- | --- | --- | --- |
| standard (`test:e2e:standard`) | 1,225 in 188 files | 1,135 in 201 files | 4.85 h | 3.78 h (-22%) | 98 min | 77 min (-21%) |
| long (`test:e2e:long`, unchanged) | 57 | 57 | 2.50 h (earlier timing run) | unchanged | | |
| full (`test:e2e`) | 1,282 | 1,192 | | | | |
| gate (`test:e2e:gate`) | 224 | 183 | | | | 17.4 min, all passed |
| sequencing (`test:sequencing`) | 75 | 75 | | | | 7.1 min, all passed |

Where the standard tier's summed time went:

| Part | Before | After |
| --- | --- | --- |
| smoke tests (`smoke.spec.ts` / `smoke-*.spec.ts`) | 58.4 min | 50.7 min |
| type inventory / geometry sweep | 3.7 min (45 tests) | 11.7 min (10 tests, 3 viewports, about 3x the surfaces) |
| everything else | 228.8 min | 164.6 min |
| median test | 10.3 s | 9.3 s |

Caveat: the machine is shared. The before run overlapped with the sweep's
development runs and a gate run, so part of the drop in "everything else" is
load, not consolidation. The removed tests alone accounted for 28.9 min of the
before run; the rest of the saving comes from the collapsed viewport loops.

Results: before, 1,219 passed, 5 flaky (passed on retry), 1 failed; after,
1,133 passed, 2 failed. Each failure was re-run alone:

- `codex: card search filters real metadata ...` fails alone on `origin/main`
  too (`#codex-card-search-input` stays visible after closing the search at
  1000x560). This is a product or test issue that predates this change and
  is left as it is.
- `complete card pool preserves measured rules and bounded frames in every
  stance` counted 12 checks per card (3 viewports x 4 stances); after the
  viewport collapse it is 4. Fixed; it passes alone.

## Kept although they looked removable

- `reduced=true/false` pairs: reduced motion takes a different code path
  (timing, FX, camera), so both stay.
- `waymark-decision-polish` keeps both bindings: its remapped variant also
  switches reduced motion. `outcome-reader-polish` and `route-decision-polish`
  keep both bindings because each variant commits through a different path
  (pointer claim versus keyboard).
- The long specs (`LONG_SPECS`), including the remapped pairs in
  `event-navigation-polish`, `market-navigation-polish` and
  `folio-tools-polish`, are untouched.
- Viewport loops stay in files that read the device pixel ratio or index their
  size list (`codex-card-gallery`, `codex-collection-dialogs`,
  `flock-identity`, `flock-motion`, `numeric-feedback-polish`,
  `overlay-download-recovery`, `practice`, `shared-overlay-ownership`,
  `waymark-decision-polish`) and in the three specs another change owns
  (`high-dpi-rendering`, `spectacle-occlusion`, `platform-performance`).
- `title screen fits landscape tablet viewport with readable uncluttered
  controls` is the only check of a 4:3 window and of the title composition
  flags, so it stays.
- The combat "without decorative frames" tests are art-direction contracts
  (retired frame textures must not come back), not layout pins.
- `boss-prep-reading` runs once per district because boss names and pressure
  sets differ: content coverage the single-district sweep does not give.
- Catalog checks (every Supply, every Market rule, every boss name) and exact
  wording that is a rules or input contract (hint text that names the live
  binding, screen reader announcements) were kept everywhere.
- Shared-boot merging was limited to four combat tests that only read state.
  Most smoke tests mutate the scene, and scenes keep instance fields across
  restarts (the sweep met this directly), so sharing a page would risk order
  dependence.

## Removed or merged tests

Titles as listed by `npx playwright test --list` before the change (smoke tests
then lived in `smoke.spec.ts`). 100 tests removed, 4 merged, 10 sweep tests
added.

### Replaced by the geometry sweep

| Test(s) | Count | Now covered by |
| --- | --- | --- |
| compact-type-inventory.spec.ts: compact typography inventory: card-dossier, collection, collection-atlas, collection-empty, collection-saved, collection-tools, combat, combat-feedback, combat-intro, combat-tooltip, deck, enemies, enemy-dossier, flight-details, glossary, glossary-dossier, guide, items, leader-dossier, leaders, market-cards, market-services, market-sold, market-supplies, market-waymarks, outcome, picker, picker-read, profile, return-choice, reward, reward-hover, route, route-contract, route-feedback, route-notice, route-tooltip, settings, setup, storage-recovery, supplies, supply-dossier, title, waymark-dossier, waymarks | 45 | screen-geometry-sweep: the same surfaces with the same floors and target rules, at 1000x560 and 1280x720 |
| smoke: "settings and remapping controls keep touch targets at the minimum supported viewport"; "shared onboarding and pause commands keep touch targets at the minimum supported viewport"; "deck, pile, and reward commands keep touch targets at the minimum supported viewport"; "Codex and Flock Record controls keep touch targets at the minimum supported viewport"; "route decisions and outcome commands keep touch targets at the minimum supported viewport"; "run HUD, card picker, market close, and combat log keep touch targets at the minimum supported viewport" | 6 | screen-geometry-sweep (44 px, separation, containment on every settings section, how to play, pause, abandon confirmation, deck review, piles, card reward, Codex, profile, route, market shelves, picker, combat HUD and history). Their pinned x positions, label lists, row counts, font sizes and alpha values are gone. Behaviour stays in "route ESC opens pause and abandoning still requires confirmation", "pause overlay opens on route and combat without advancing play" and "settings are fully navigable by keyboard and standard gamepad controls" |
| smoke: "route decision hierarchy remains readable at high resolution and landscape tablet" | 1 | screen-geometry-sweep route group; the guidance flag it read is asserted by "first-flight guidance exposes route tradeoffs and Flow outcome previews" |

### Viewport duplicates

| Test(s) | Count | Now covered by |
| --- | --- | --- |
| clipboard-ownership.spec.ts: "folio / outcome / review copy exposes pending/error/retry and rejects duplicate input at 1440" and "... at 2560" | 6 | The "at 1000" variant of each (same flow); screen-geometry-sweep at 1280x720 and 2560x1600 |
| combat-hud-readability.spec.ts: "combat HUD keeps actionable text readable and secondary goals out of enemy turns at 1440" and "... at 2560" | 2 | The "at 1000" variant; screen-geometry-sweep combat group at 1280x720 and 2560x1600 |
| outcome-reader-polish.spec.ts: "supply / waymark outcome reader complete reading / transaction ownership, remapped=false, width=1440" and "... width=2560" | 8 | The same check at width=1000 (both bindings kept); screen-geometry-sweep at 1280x720 and 2560x1600 |

Inside about 100 other tests, loops over 2560x1600, 1440x900 and 1000x560 now
run 1000x560 only (titles unchanged).

### remapped=false duplicates

Each is covered by the remapped=true variant of the same test in the same file:
the same flow and assertions, driven through the binding lookup.

| File | Removed test(s) | Count |
| --- | --- | --- |
| card-dossier-polish.spec.ts | "explicit card details preserve decisions and paginate complete rules, remapped=false" | 1 |
| card-fallback-polish.spec.ts | "failed ceremony keeps card art, readable Preens and intentional choices, mode=cardReward, remapped=false"; "... mode=upgradeReward, remapped=false" | 2 |
| choice-input-hints.spec.ts | "choice hints follow real bindings and device without committing, remapped=false" | 1 |
| combat-history-polish.spec.ts | "trigger bursts and read-only history, reduced=false, remapped=false"; "... reduced=true, remapped=false" | 2 |
| combat-pile-reading.spec.ts | "combat piles use quiet navigation and preserve decisions, remapped=false" | 1 |
| combat-reward-reader.spec.ts | "combat rewards keep full rules and pending decisions, remapped=false" | 1 |
| combat-waymark-reader.spec.ts | "combat Waymark reading is complete and Back preserves the pending card, remapped=false" | 1 |
| deck-review-input-hints.spec.ts | "Deck Review hints follow input without changing decisions, remapped=false" | 1 |
| discard-choice-polish.spec.ts | "discard decisions are readable and explicit, remapped=false" | 1 |
| flock-stats-reading.spec.ts | "BattleScene Flock Stats stays readable and preserves the pending decision, remapped=false"; "RouteScene ..., remapped=false" | 2 |
| folio-reader-polish.spec.ts | "Folio readers retain readable geometry, identity and editing ownership, remapped=false" | 1 |
| folio-starter-record-polish.spec.ts | "Starter and Field Record readers stay readable and preserve private data, remapped=false" | 1 |
| large-hand-polish.spec.ts | "large hands remain readable and page without playing, remapped=false" | 1 |
| market-card-reader-polish.spec.ts | "Market cards use one readable decision surface, remapped=false" | 1 |
| market-reader-polish.spec.ts | "Market item reader keeps complete text and purchase intent, remapped=false" | 1 |
| overlay-retirement.spec.ts | "MenuScene held Back retires exactly one owner, remapped=false"; "RouteScene ..., remapped=false" | 2 |
| owned-waymark-reader.spec.ts | "owned Waymarks preserve complete reading and paused focus, remapped=false" | 1 |
| packed-supplies-polish.spec.ts | "Packed Supplies are readable and deliberate in BattleScene, remapped=false"; "... in RouteScene, remapped=false" (its every-Supply catalog check now runs in the remaining variant) | 2 |
| pile-polish.spec.ts | "pile reading preserves pending decisions, remapped=false" | 1 |
| preen-choice-polish.spec.ts | "Preen choices expose readable changes and explicit commitment, remapped=false" | 1 |
| route-reader-polish.spec.ts | "route reward and Market candidate reading is complete and read-only, remapped=false" | 1 |
| supply-reader-polish.spec.ts | "Supply inspection is complete, readable and never commits, remapped=false" (its every-Supply reading check now runs in the remaining variant) | 1 |
| supply-reading.spec.ts | "BattleScene packed Supply reading is complete, bounded and read-only, remapped=false"; "RouteScene ..., remapped=false" | 2 |
| waymark-failure-polish.spec.ts | "failed reward art module retains readable Waymark choices and safe inspection, remapped=false" | 1 |
| waymark-shelf-reading.spec.ts | "BattleScene Waymark shelf reaches every artifact without losing reading, remapped=false"; "RouteScene ..., remapped=false" | 2 |

### Merged (shared boot, not removed)

| Test(s) | Count | Now |
| --- | --- | --- |
| smoke: "battle hand is compact (no full effect text) and enemies expose intents"; "hand cards carry unique per-combat instance ids"; "boss uses a scripted attack pattern that loops from move 2"; "combat tracks per-fight stats (damage dealt / taken / blocked)" | 4 | Same tests inside `smoke-combat.spec.ts` › "combat state reads", sharing one booted page; each restarts BattleScene itself |

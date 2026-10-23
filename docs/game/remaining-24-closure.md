# Fixed closure checklist — remaining 24 acceptance items

Scope: the unchecked items of `a-grade-acceptance-plan.md`, unchanged. This is
an execution/evidence index, not additional product scope. A checkbox requires
all listed checks and current candidate evidence. Failed checks are repaired and
rerun; no skips, budget increases or removed assertions count as completion.

Final status: **all 24 fixed-scope items verified; authoritative plan 60/60.**

Order: shared controls (22–25), compact layouts (11–15), card/art (17–20,
41–45), menu state matrix (55), final qualification (56–60).

| Item | Finite acceptance checklist | Status |
| --- | --- | --- |
| 22 | Inventory control families across title/setup, system panels, Collection, Flock/Folio, route/events/market, battle/reward/readers; primary/secondary/navigation/destructive roles are intentional; safe action distinguished from destructive confirmation; live consumer regressions pass | Verified |
| 23 | Shared hover/focus/selected/armed/disabled/loading/error differ without moving bounds; consumers honor disabled/loading across inputs; failures retain recovery and do not double commit; state regressions pass | Verified |
| 24 | Inventory rendered decorative frames; aspect-preserving composition or quiet vector replacement; no stretched canonical card borders; three-size visual/geometry checks | Verified |
| 25 | Enumerate overlay families and nesting; close/back, exact opener restoration, background isolation, held/repeated input, loading cancellation, shutdown, and late completion checks pass | Verified |
| 11 | Primary 16px/secondary 14px rendered floor at supported 1000×560; full text available in reader for intentionally abbreviated micro labels; dense-screen geometry checks pass | Verified |
| 12 | Dense cards, grids, readers and menus use pagination/sections/drawers at compact size; no overflow or lost actions at all three sizes | Verified |
| 13 | Secondary rules/stats/tools remain optional and directly reachable; return preserves selection/scroll; drawer/reader input tests pass | Verified |
| 14 | Interactive targets meet 44×44 CSS pixels with separation at compact size; all surface-family geometry assertions pass | Verified |
| 15 | Long/max/empty/restored data and nested overlays fit; no text/control overlap in three-size geometry matrix | Verified |
| 17 | Shared runtime card ID/name/family/art mapping across hand, reward, picker, Collection, deck, market and Folio; all-card identity tests pass | Verified |
| 18 | Cropped uses have explicit subject-safe placement; full canonical cards remain contained; crop inventory and context checks pass | Verified |
| 19 | Loading/failure reserve stable artwork slots and preserve state; late success and explicit recovery tests pass | Verified |
| 20 | Inspect all runtime card illustrations at gameplay scale, record per-card disposition and resolve actionable defects | Verified |
| 41 | Reproducible inventory links runtime use, source/export, dimensions, alpha, crop policy and load state for active artwork | Verified |
| 42 | Inspect active characters/cards/enemies for anatomy, silhouette, density, outline, light and material consistency; record dispositions | Verified |
| 43 | Evidence-backed replacement queue accounts for every reviewed defect; preserve successful art; no unresolved must-fix entry | Verified |
| 44 | Canonical borders/title typography remain deterministic; source/composite/export validators pass | Verified |
| 45 | Alpha/edge/compression/scale checks and rendered loading/recovery context pass; no missing active exports | Verified |
| 55 | Fresh/populated/long/saved/corrupt/empty/maximum title/setup/Collection/Flock/Folio/Settings states pass; no data loss | Verified |
| 56 | Complete named surface-family visual matrix at 2560×1600, 1440×900, 1000×560; inspect current captures | Verified |
| 57 | Pointer/keyboard/virtual controller/emulated touch/reduced-motion/delayed-download/focus journeys pass on current candidate | Verified |
| 58 | Map all 41 previous release failures to fixes/current tests; fresh uninterrupted full regression passes with existing gates | Verified |
| 59 | Full victory/defeat/replay journeys pass; report measured performance; stop all owned preview/browser/test processes | Verified |
| 60 | Regrade each named area against the completed evidence; close only with supported A assessment, disclose automation/device limits | Verified |

Earlier reports remain under `.artifacts/closure24-*`; final qualification evidence
is under `D:/codex-bird-squad-closure24-20261021/evidence`. The original
60-item acceptance plan remains authoritative for item totals.

## Item 19 — loading/failure continuity

Closed on `index-xEJR3yYv.js`. The surface/recovery inventory is
`docs/art/loading-recovery-contract.md`. Scope remains the fixed checklist.

- Reproduced Market/picker failure → redraw → request loops (both baseline
  tests timed out). Shelf/picker attempts now remain bounded until explicit
  art-only recovery. Retry, keyboard Inspect and the controller's same action
  retain the armed decision. Market no longer requests a full portrait for its
  rules-only dossier. Its retry target is separated from Clear and category tabs.
- Reproduced late hand art replacing the selected input object. The regular
  hand cache now treats selection as an in-place update, while structural state,
  costs, Retain/discard and fallback-renderer changes still invalidate correctly.
- `closure24-art-recovery.json`: 15/16; the redundant Market full portrait made
  36 requests instead of six. Fixed, not waived. `closure24-art-recovery2.json`:
  27/29, covering shared observer shutdown/timeout, complete deployed-image
  decoding, eight district transitions, Collection, Deck, Folio, setup,
  reward/fallback recovery and real Market/Preen/Release transactions. The two
  failures were the hand target replacement and overlapping Market Retry/Clear.
- `closure24-art-recovery-final.json`: **17/17** on xEJR3yYv. Both failures and
  all Market/picker delayed/failed recovery cases pass; includes all 1,320 card
  stance/viewport combinations, large/remapped hands, fallback, three pilot
  battles, coalesced redraws and pointer/keyboard/controller intentional play.
- `closure24-hand-art-retry.json`: **1/1**. Real Deck-button opening recovers
  persistently failed hand artwork; closing retains selection, bounds, turn,
  energy and cards. Ten ordinary redraws do not trigger new image requests.
- Inspected compact failed/recovered Market, selected late hand, high-resolution
  recovered Market/picker, plus shared-client real card play. Shared client has
  full-art readiness, energy 2, enemy 23/27, no animation pending or error file.
  TypeScript/build, runtime/docs, and unchanged bundle/cache gates pass.

All runners and their browsers exited. Only owned preview 35116 on local 5496
is retained for the next item; unrelated processes remain untouched. Total:
48/60 verified, 12 open; 12 of this fixed 24-item list closed. Full release
regression and artistic regrading remain separate open items.

## Item 15 — complete data-state geometry

Candidate `index-B99OHeup.js`, unchanged from item 14. Current matrix
`closure24-data-layout.json`: 29/31 passed; both new restore cases were corrected
and passed in `closure24-data-restore2.json` (2/2). Intermediate
`closure24-data-restore.json` exposed a test input-registration race; no product
gate, geometry assertion or timeout was weakened. The test now waits for the
actual topmost Phaser input receiver, follows the intentional post-restore
reload, and compares normalized exported history rather than legacy raw JSON.

- Collection: 0/1/4 saved views, maximum 40-character queries, every status;
  empty/partial/complete Atlas across all seven families; nested return/scroll.
- Deck: long names, full rules, empty queries, capacity, pin/comparison,
  delayed/failed readers and writes, cancellation and ownership.
- Folio: maximum 30 entries/60-card decks/revision history, long identity and
  descriptions, nested Organizer/Identity/Lab/Trail/Tuning readers, default and
  remapped controls, delayed/failed/recovered artwork.
- Reports: complete long entries and retained pagination; title/setup: saved
  context across leaders/districts and complete leader/difficulty descriptions.
- Real backup workflow: empty and 50-flight histories; maximum 30 Folios with
  60 cards each, 32-character names, 120-character descriptions and 240-character
  notes. Preview does not mutate; confirmation, reload and reopening preserve
  every exported deck/history entry. History, save, invalid, confirmation and
  ratings geometry pass at 2560×1600, 1440×900 and 1000×560.
- Inspected current long/empty Deck, complete report, restored maximum-history
  compact layout and high-resolution restore confirmation captures. All are
  local under the corresponding D-drive `closure24-data-*` evidence folders.

All runners and diagnostic browsers exited. Preview 26296 is retained for the
next checklist item. No source UI change or external operation in this closure.

## Item 17 — runtime card identity

`closure24-card-identity3.json` passes 2/2 on B99OHeup. The new contract checks
all 110 runtime IDs against the approved manifest, both base/Preened display
names and family labels in hand/reward/pile/Deck adapters, Release picker
identities, actual Collection and Market renderers, and all 110 Folio covers.
Every loaded thumbnail is also decoded-pixel-equal to its canonical local
export; this catches a correct key accidentally assigned the wrong artwork.
The dossier test verifies the explicit illustration-title/gameplay-name
explanation without revealing undiscovered cards. High-resolution Folio capture
was inspected, including the Snag family.

Shared identity comes from `cardLibrary`, `displayName`, `cardLabel`,
`cardCompactArtAsset` and the approved `cardArtAssets` mapping. Market, picker,
Collection and Folio consumers were inspected for these same sources. Preened
gameplay names add `+`; a Folio cover intentionally displays the base card name.

Earlier test-only failures were reconciled: Phaser's blob image URLs require
pixel comparison, not filename comparison; the synthetic Folio fixture now
sets its real owner deck ID. No product data or artwork was changed to satisfy
those fixture errors. Every runner/browser exited; preview 26296 remains local.

## Item 18 — subject-safe placement

Candidate `index-CJKkbsRu.js`. The active-consumer inventory is
`docs/art/card-placement-contract.md`. No active consumer uses the exporter's
legacy square icon or a texture crop; canonical portrait/thumbnail images use
containment. Subject-focal metadata is therefore not needed for any current
cropped consumer. The unused square derivative is explicitly not approved for
future UI use without authored focal metadata and visual review.

Visual review nevertheless found a real accidental crop: hand name/rules panels
covered most of the complete image. Regular and failed-module hands now reserve
a separate unobstructed 60×90 portrait beside the readable name. Cost, Molt,
Retain/discard, color cues, Flow and ordered rule excerpts occupy separate lanes.
All full rules remain in the existing read-only inspector; no gameplay changed.

- `closure24-card-placement.json`: eight passes; four Deck tests lacked touch
  in the focused configuration. `closure24-card-placement2.json`: all four pass
  with touch enabled, no assertion/time-limit changes. All-110 identity and
  actual Collection/Market/picker/Folio intact-image checks pass.
- `closure24-hand-placement2.json`: 9/9 regular hand, large-hand paging/input,
  typography, forecast and normal/offline reward checks. Four earlier reward
  tests expected Enter not to activate the new safe initial Resume action;
  they now assert Resume, retained reader and no mutation before Back closes it.
- `closure24-hand-placement3.json`: 4/4, including expanded 110-card × four-state
  × three-size geometry, failed hand renderer/art recovery and actual pilot art.
- Badge stress then exposed a 1px shortfall and Surge width, followed by an
  18px label falling below the strict compact floor. These were corrected, not
  waived. `closure24-placement-verified.json`: **7/7**, no retries/skips, including
  all three pilot encounters with simultaneous Keep 10/Molt/discard/Surge/cues.
- Current compact and 2560×1600 captures inspected; the shared gameplay client
  commits a card, retires its animation and shows matching art/state without
  an error artifact. Python canonical export tests 5/5; TypeScript/build, runtime,
  docs, unchanged bundle/cache gates and diff checks pass. Boot 721.3 KiB/725 cap.

All runners/client browsers exited. Owned preview 5932 remains only for the next
local acceptance item. Total: 47/60 verified, 13 open; 11 of fixed 24 closed.

## Item 22 — role inventory and verification boundary

| Active surface family | Forward / primary | Secondary / navigation | Destructive |
| --- | --- | --- | --- |
| Title and setup | Start/resume flight | Setup choices, utility destinations, Back | Abandon confirmation is separate |
| Pause, Settings, guide, lessons | Resume / Keep Playing | Settings sections, Close, lesson and guide choices | Abandon Run |
| Native download/save recovery | Keep playing / Cancel | Recovery options, return | Explicit reload or save replacement confirmation |
| Collection toolbar, Saved Views, Atlas | Apply view; safe Cancel when removal is armed | Browse/filter/search, Save view, Atlas Back | Remove view with separate confirmation |
| Collection card dossier | No purchase or combat commitment exists here | Favorite, tag, protect/track, showcase, mark seen, flight-deck link and Back | None: toggles are reversible and do not remove owned cards |
| Flock, Folios, Lab, Organizer, Identity | Build/launch/apply cover/save tuned revision/restore as a new revision | Library, tools, pages, tags, archive/restore, copy and Back | None: archive and revision operations preserve the source |
| Flight Log and Save Data | Review flight / Download / safe Cancel | Rows, paging, Restore opener, ratings, Back | Confirm Restore |
| Map, event and reward readers | Claim reward / selected reward confirmation | Inspect, details, page, close/cancel | None: world choices communicate their exact effects separately |
| Market | Select offer / Buy after arming | Shelf categories, sections, reader paging and Close | None: irreversible spending requires its own armed confirmation |
| Combat | Roost / ready discard or return confirmation | Card/history/pile readers, stats, Supplies, Waymarks | Run abandonment uses the system confirmation |
| Combat and offline reward fallback | Focused Select / Confirm | Other choices, Read, Skip with separate arming | None |
| Preen / Release picker | Confirm Preen | Inspect, paging and Cancel / Back | Confirm Release, after the selected card and removal effect are shown |
| Victory/defeat and recorded flight | Replay | Return, copy seed/record, details, Back | None |

Art-bearing cards, map nodes, enemy targets, slider values and list rows retain
their domain-specific selection surfaces. They are not relabeled as destructive
buttons or promoted to gold merely because they are interactive. Shared action
buttons use the same role palette and caption hierarchy; quiet vector frames do
not depend on image arrival. Card identity, compact layouts and complete overlay
ownership remain their separate fixed acceptance items.

Implementation includes reader paging, Collection dossier actions, safe Back
instead of a red destructive-looking close, combat confirmations, Supply use,
outcome commands and offline reward controls.

The final source inventory also includes the main Collection Back, Market
section/paging controls, Waymark selection/inspection, the shared normal/offline
Skip command, large-hand and card-picker paging, boss-preparation opener, event
Read actions, and the Preen/Release confirmation rail. Category tabs, audio/pause
medallions and art-bearing choices retain their purpose-specific selection
presentation; they do not impersonate destructive or principal commit actions.

### Item 22 closure evidence

- Candidate `index-CJhx5GT4.js`: TypeScript/build and unchanged bundle/cache
  validators passed; entry 682.1 KiB, combined boot 722.6 KiB (725 KiB cap).
- `.artifacts/closure24-role-final.json`: 44/46 passed. The two failures were
  a test selector missing the hyphen in card action names, not missing controls.
  Corrected selector now also asserts the exact number of controls.
- `.artifacts/closure24-role-smoke.json`: all six passed on that same candidate,
  including all three ceremonies and normal/fallback confirmation journeys.
  Old whitespace and pointer-hint expectations were corrected without removing
  commitment, cancellation, disabled, focus or no-double-spend assertions.
- Earlier local qualification during this execution: shared/system/Folio/Save
  suite 61/61; the 52-case role-repair run's Supply, reference, Collection and
  19 outcome cases passed. Its five failures (card-reader geometry, named-label
  lookup, and busy Roost input being re-enabled by a tooltip) were repaired and
  all passed in the final 46-case run. No failed run is represented as all-green.
- Inspected current captures at 2560×1600, 1440×900 and 1000×560, including
  title/setup, Collection/card dossiers, combat, boss preparation, Market,
  Preen/Release, card/Waymark rewards and Skip confirmation. Shared gameplay
  client also completed with matching Flight Log image/state and no error output.
- Remaining compact-layout, asynchronous-state, decorative-frame and overlay
  criteria remain separately open. No external publication or Git mutation.

## Item 23 — state/transaction inventory and closure

| Family | Pending / failure / commitment contract | Regression |
| --- | --- | --- |
| Shared primary, secondary, utility, destructive | Fixed bounds, opaque disabled/loading/error, explicit captions, independent focus/hover/selection; primary hover uses contrasting dark outline | shared-control-contract, ui-token-contract |
| System/Collection entry and guide lessons | Cancelable pending owner, slow-download recovery, explicit retry, no late reopen | overlay-download-recovery, shared-overlay-ownership |
| Collection Saved Views/journal | Separate armed removal, safe Cancel, failed-write preservation, fresh confirmation on retry | collection-control-focus, collection-tools-polish |
| Folio editors/organization | Failed drafts preserved, retry without duplicate revision, no shutdown commit | folio-editor-recovery |
| Clipboard: Folio, recorded flight, outcome | Synchronous user-initiated request; disabled Copying, eight-second deadline, Retry, retired-owner isolation, released timer/listener references | clipboard-ownership |
| Route Save Folio | Loading disables duplicate requests; timeout/retry invalidates old request; late module arrival never saves by itself; close/restart/shutdown clear timer | deck-browser-polish |
| Flight Log review | Pending, rejected/missing result, eight-second timeout, retry, record/owner isolation | flight-log-ownership |
| Backup file read/restore | Untimed native picker; bounded local read; explicit failure/retry; canceled/late read cannot restore; separate destructive confirmation and safe Cancel | flight-log-ownership, shared-save-controls |
| Settings persistence | Applied/disabled state and failed-write recovery preserve prior settings | settings-readability |
| Market, Preen/Release, rewards and Supplies | Inspect/select/armed/commit distinct; unavailable opaque; cancellation and repeated input never double spend/consume | market-transaction-polish, picker-confirmation-polish, reward smoke/ceremony, packed-supplies-polish |

### Closure evidence

- Candidate `index-CRxiCIrs.js`: TypeScript/build, unchanged bundle/cache and
  documentation checks pass (723.2 KiB combined boot, 725 KiB cap).
- `.artifacts/closure24-state-final.json`: 54/54 pass, zero retries/skips,
  including all control states at three viewports, clipboard owner retirement,
  timeout/retry, late save/read isolation and exact restoration after failure.
- `.artifacts/closure24-armed-final.json`: 5/5 pass. Reward, offline fallback,
  Skip, route reward and Preen/Release journeys preserve intentional confirmation
  across pointer, keyboard and controller. Stale presentation expectations were
  corrected to current captions and the larger 500×56 hint panel; spacing,
  no-double-commit, cancellation and state-preservation assertions remain.
- Earlier state qualification: 65/68 pass; three C: ENOSPC screenshot writes
  failed. Those same cases pass in the final 54-case run. Collection, Folio,
  Settings, Market, Supply and picker transaction checks passed in that run.
- Current shared gameplay client: Flight Log → review → exact Review opener
  restoration; image/state inspected, no errors. Captures and client output are
  in `D:/codex-bird-squad-closure24-20261021/evidence/closure24-state-*`.
- Inspected compact error/retry and large pending-state captures for Folio,
  recorded flight, outcome, save/read recovery and shared controls. Full compact
  typography and overlay-family qualification remain their separate items.

## Item 24 — decorative frames verified

`decorative-frame-inventory.md` records live families and the distinction between
authored whole-image art, nine-slice surrounds and vector surfaces. Page/scroll
indicators, redundant hover trim, arbitrary-size tooltip frames, route heading,
feedback/contract panels and legacy Market price/service trays now use stable
vectors. Retained sold slats and encounter plaques preserve source proportions;
the shared Snag fallback contains the canonical border.

Candidate `index-Dx6gds9m.js` passes build, bundle/cache and documentation checks
(720.5 KiB combined boot against the unchanged 725 KiB cap).

- `.artifacts/closure24-frames-final.json`: 37/37 pass, zero retries/skips:
  24 surface families at all three viewports plus Market, picker, reward and
  shared-token transaction checks. Per-image dimensions/scales are attached.
- `.artifacts/closure24-frames-smoke.json`: 5/5 pass. Map boss/cache tooltips
  are measured independently and replacement destroys the prior owner; utility
  surfaces and Collection Back/Close are checked as actual quiet controls,
  not retired raster decorations. No transaction or focus guards were removed.
- Earlier 18-surface run exposed nine real stretched-frame failures, repaired
  before the final qualification. Subsequent smoke failures were stale raster
  expectations and an obsolete simultaneous-tooltip expectation; corrected
  assertions retain both tooltip heights and enforce single-owner retirement.
- Inspected current route, Market, dossier, transition, tooltip, sold slat and
  picker captures, including full-resolution 2560×1600 and compact 1000×560.
  Existing compact text/overlap findings remain under items 11–15, not new scope.
- Shared gameplay client passed Flight Log review/return with matching image
  and state, no errors. Current captures/client output live under
  `D:/codex-bird-squad-closure24-20261021/evidence/closure24-frames-*`.

Item 25 follows below; full release qualification remains open.

## Item 25 — overlay ownership verified

`overlay-ownership-inventory.md` maps every active family and nested reader to
its context/return contract and lifecycle tests. A fresh physical-key regression
exposed held Back clearing the card underneath History or leaving an outcome,
and held `1` replaying after closing Flight Details. Shared Back/Confirm dispatch
and numeric activation now reject autorepeat. Controller-held nested Back was
already safe. Outcome Copy is now included in keyboard/controller traversal and
uses the live control's existing pending/error/retry guard.

The original candidate `index-CAyh1up1.js` completed its 139-case family suite:
123 pass, 16 fail. Seven failures were missing touch context, one a removed
direct Saved Views entry, three a selector measuring the button's label instead
of its hit target, one a stale lesson recovery label/owner, and four 30-second
timeouts during concurrent high-resolution suites. Those failures remain in
the report and are rechecked without larger timeouts or retries.
Its Collection touch test used the removed direct Saved Views entry and expected
one-step removal; the test now follows Tools and verifies the first removal tap
does not delete. Event lifecycle touch cases lacked a touch-enabled browser
fixture; that fixture is corrected without dropping any input path.

Repair candidate `index-BcCSx_Bp.js`, isolated on local port 5496, passes
TypeScript/build and unchanged bundle/cache gates (720.9 KiB boot, cap 725).
Its 45-case repair run finished 43/45: all eight held-input cases pass, including
the two title cases after waiting for an interactive frame. The remaining
failures exposed a native recovery test ordering error and the stale lesson
label. The event recovery investigation also found that a dismissed recovery
dialog could not be reopened from the route failure panel.

Candidate `index-BVLVOWqu.js` adds shared route module-status ownership and an
explicit Recovery options control with exact focus restoration. Build and
unchanged bundle/cache gates pass (721.1 KiB boot). The shared gameplay client
passes review/return with matching image/state and no error artifact. The final
overlay recheck runs alone, with the original time limits and no retries.
### Closure evidence

- `.artifacts/closure24-overlay-final.json`: 57/58 pass on `index-BVLVOWqu.js`.
  The remaining case reopened the failed import, which automatically reopened
  the native recovery dialog; it incorrectly tried to navigate the canvas
  beneath that owner. The corrected sequence dismisses that native owner first,
  then verifies the panel's Recovery options, exact focus return and confirmed
  checkpoint reload. `.artifacts/closure24-overlay-recovery-final.json`: 1/1 pass
  on the same unchanged build. No assertions, time limits or input paths removed.
- All four earlier Supplies/pile timeouts pass in the final run under the same
  30-second limits. All eight held-key/controller retirement tests, both route
  download panels, six lesson cases, eight decision readers and shared pause,
  shutdown, background-input and safe-exit ownership checks pass.
- The earlier 26-case leaf suite has 24 passes (map/Flock/history and retirement)
  and two title fixture readiness failures, both passing in the 45-case repair
  and final runs. The ten affected gameplay smoke journeys all pass on the repair
  candidate, including discard/return and reward/picker/Collection inspection.
- The 139-case family run's Collection Tools/touch failure passes in the 45-case
  repair run; all seven missing-touch-fixture failures pass with real touch
  enabled. The lesson recovery caption and decision hit-target selectors are
  corrected and pass in the final run. Reports retain all intermediate failures.
- Inspected current compact and 2560×1600 failed-download panels and Deck Review,
  plus family captures for native recovery, Saved Views, Flight Log, Folio,
  boss preparation, map inspection and outcome Copy. Current shared-client
  review/return image and state agree, with no error artifact.
- Direct lifecycle/input review, TypeScript/build, unchanged bundle/cache gates,
  whitespace and documentation checks pass. Superseded previews 27232 and 34712
  were ownership-checked and stopped. Only the current local preview remains for
  the next acceptance item; no external writes or publication.

Item 11 is next. These item-level checks are not a full-release/all-A claim.

## Item 11 — readability qualification

Current candidate: `index-Dh9ukFS0.js`. Typography is measured in rendered CSS
pixels, not just Phaser's font-size property: at 1000×560 the 1280×720 canvas
scale is 7/9. Primary copy uses at least 21 design pixels; secondary copy uses
at least 18, with 19 used for most contextual labels. Rules remain complete in
readers; thumbnail excerpts store their full source and explicitly mark omission.

| Family | Compact contract / full-content destination |
| --- | --- |
| Collection cards, items, leaders, enemies, glossary | Readable tile identity and summary; complete measured dossier, reachable final section, original grid/scroll restored |
| Combat hand and reward | Readable name, primary effect and quantities; explicit Inspect for full base/Preened/Molt rules and terms |
| Market and Preen/Release | Readable price and two-line names; existing card reader retains all eight deck-impact lines; confirmation remains separate |
| Supplies and Waymarks | Measured sections/pages, original selection preserved; full recent Supply histories remain readable after the last item is consumed |
| Route/combat feedback | Compact readable name and explicit destination in Supplies, not miniature duplicated rules |
| Flight results/history | Measured pages preserve every deck/path/decision/result line, including long identity text; keyboard/controller/touch pagination; owner cleanup on redraw/close |
| Title/setup and save recovery | Readable controls/descriptions; recovery notice reserves lower-right artwork space without covering home actions and hides during setup |
| Flock/Folio/Settings and optional readers | Existing three-size geometry/input fixtures enforce text floors, full reading and separate controls |

Repairs include Collection hierarchy and scroll-cue clearance, measured tooltip
bounds, route heading/HUD labels, readable enemy names/health, setup descriptions,
outcome values, Supply feedback/readers and reward hover rules. Card-loading slots
no longer flash duplicate miniature identity letters; external labels remain.
Picker artwork is contained at 66×99 with clearance for two-line 21px names.

The report lifecycle investigation found a real ownership error: DisplayList
`removeAll(true)` detaches children without destroying them. Profile redraw now
destroys its children, retiring report input listeners. Full page text and page
position survive redraw; held input and duplicate pagination remain covered.

Intermediate evidence is retained, not represented as clean runs:

- `closure24-type-surfaces.json`: 44/51. Five typography defects, one live-reader
  listener leak and one test's pending-scene-redraw setup were repaired.
- `closure24-type-repair.json`: 73/79. Two old 18px picker expectations updated
  to the new 21px contract; four Supply-history fixtures corrected to the actual
  R inspect binding. Their complete content and no-mutation assertions remain.
- `closure24-type-gate.json`: 18/21. All 220 reward-hover variants, report
  completeness, Supply-history variants, route readers, deck-impact reading and
  recovery-notice collisions passed. Three failures identified the temporary
  card letters and insufficient picker name clearance, both repaired in Dh9ukFS0.
- Dh9ukFS0 focused recheck: all four picker/reader/confirmation cases passed,
  including three sizes, long names, failed affordability and exactly-once spend.
- TypeScript/build, unchanged bundle/cache gates and docs pass. Boot is 720.8 KiB
  against the unchanged 725 KiB cap. Preferred 710 KiB target warning is retained.
- Shared gameplay client on Dh9ukFS0 completed Flight Log review and exact opener
  restoration with matching screenshot/state and no error artifact. The client
  exited; only the owned 5496 preview and qualification runner remain.

Source review then found the old report builder still capped deck/path at 20
and decisions at eight before the measured renderer. Those caps are removed;
the new real-builder test requires 110 deck entries, 44 stops and 18 signals
to survive into rendered pages. Complete defeat explanations and all unlock
descriptions are included in Results. Outcome excerpts now visibly mark omission.
The main run also caught three-digit estimated damage crossing its HUD lane;
the compact forecast retains the complete damage quantity while the full
remaining-Cohesion projection stays in the Roost detail. The regression checks
both lane separation and that actual detail text.

The main readability run on Dh9ukFS0 finished 117/118 with only the three-digit
HUD forecast overflow failing. Its report is `closure24-type-final.json`.
The real-source baseline test on that candidate failed at the expected
110-versus-20 deck-entry assertion (`closure24-report-source-baseline.json`),
confirming the regression catches the old cap before repair. The current source
must pass its focused repair gate and secondary-reader qualification before this
item is checked off. Current compact/large captures inspected include setup,
combat, picker/inspection, Collection/items/enemies, route/feedback, Flight Log,
long reports, empty/packed Supplies and Folio organization/identity.

BmF7S-Gy focused gate: 5/7 pass. The real 110-card/44-stop/18-signal source
completeness test, long-report paging, repaired forecast and both outcome smoke
journeys pass. Two outcome-surface cases caught the enlarged unlock name extending
two pixels beyond its reserved strip. Spacing is corrected in DfPxCSfg; its
TypeScript/build and unchanged bundle/cache gates pass (721.1 KiB boot).
`closure24-type-secondary.json` is the in-progress 101-case qualification report.

That secondary run finished 96/101 on DfPxCSfg. All report, Folio, outcome,
reward, Settings, boss, large-hand, keyword and Waymark shelf cases passed.
Five failures are reconciled as follows: filtered Collection row overflow is
repaired below; the hand test now verifies disabled input/no repeated commitment
instead of requiring removal of the shared guarded handler; two Market reader
tests now inspect the persistent transaction blocker rather than the removed
duplicate; service typography expectations are raised from 20px to the current
21px contract. These retain geometry, completeness and no-spend checks. The
focused rerun also checks actual purchase disabled state on each reader page.

The secondary run exposed filtered Collection rows exceeding the reserved grid
height after the readable footer was introduced. Shared tile/focus/row geometry
now uses 398/398/408 pixels; full 2:3 art is contained at 244 pixels high, with
unchanged 21/18px labels outside the illustration. A new all-110-card label
inventory and three-size filtered-row check accompany the existing gallery,
touch, late-art and exact-return tests. This correction awaits a rebuilt candidate.
Visual review also caught event Read captions wrapping inside their buttons;
88px controls and reserved summary clearance retain the text floor and one-line
caption. The five-event, three-size regression now checks this explicitly.

CMAEw1CT focused qualification passed all 15 cases (`closure24-type-collection.json`),
including every illustration, all 110 card labels, filtered row bounds, exact
touch return, late artwork hit-target continuity, the five event types and all
hand/Market failures above. The event Read caption now stays on one line.
Visual review additionally widened the NEW badge to show the complete word at
18px; its final all-card/no-overlap check passes on Bmv6fgWC.

### Item 11 closure

- Final Bmv6fgWC: TypeScript/build and unchanged bundle/cache gates pass;
  721.1 KiB boot against the 725 KiB cap, with preferred-target warnings retained.
- `closure24-type-verified.json`: 6/6, including all 110 card illustrations,
  all-marker bounds, complete NEW badges, filtered rows at three sizes, exact
  artwork/title return and compact Collection/Market primary/secondary floors.
- Main and secondary matrices above cover the remaining named live families;
  all failures have passing focused rechecks. The final production changes after
  the 15/15 run only widen the NEW badge and move its adjacent tag by 10 pixels;
  the final all-card overlap and typography matrix covers that exact delta.
- Full text remains accessible through explicit, read-only sections/pages;
  real report-source checks preserve 110 deck entries, 44 stops, 18 decisions,
  complete defeat explanations and six unlock descriptions. No hidden caps.
- Current compact/high-resolution captures inspected; shared gameplay client
  completed review/close with exact Flight Log opener restored and matching
  image/state, no error artifact. Documentation validation passes.
- All runners and their browsers exited; owned preview 40356 is retained solely
  for the next acceptance checks. No commit, push, publication or unrelated
  process change. Item 12 is next; final regression remains item 58.

## Item 12 — dense-screen reflow acceptance

| Surface | Compact content strategy | Reachability evidence |
| --- | --- | --- |
| Title/setup/Settings | Separate setup surface and Settings sections; only focused option explanation | Title/setup and Settings three-size matrices; current menu follow-up |
| Collection cards/items/reference | Fixed readable tiles, virtualized rows, filtered-row fit; independently scrollable dossiers | All-110 gallery/focus/return; 89-item and leader/reference reader matrices; toolbar/Atlas/Saved Views checks |
| Flock/Folio/history | Paged records, separate tools/identity/organizer, measured report pages | Empty/50-flight record tests; maximum Folio tools and real long-flight reports |
| Deck/Preen/Release | Six-row Deck browser with separately paged details/comparison; visible picker window and explicit inspection | Current Deck follow-up; picker all-impact reading and confirmation tests |
| Combat | Paged large hands and return choices; optional piles/stats/Supplies/Waymarks/history | Large-hand and complete card-pool geometry; reader traversal and preservation tests |
| Route/events/Market/rewards | Decision summaries plus explicit full readers; direct sections and measured pages; separate transaction rail | Event and Market final focused tests; all reward types and Waymark/Supply readers |

The UI uses a 1280×720 design canvas, with layout and type budgets chosen to
remain readable at the supported 1000×560 viewport. Overflow is handled by the
above content controls, not by progressively shrinking fonts as content grows.
Current item-12 follow-up adds full card-pool stance geometry and Deck/menu
stress tests to the already-qualified live-family matrices.

Item 12 is verified on unchanged Bmv6fgWC. `closure24-reflow.json` passed 9/10:
all 100 authored cards in four stances at three sizes (1,200 layout checks),
Deck long/empty/save-state layouts, home/resume, every leader/difficulty and
highest-Ascension setup. The comparison test's old seven-row/58px Pin/20px
body expectations and label-inclusive selector were corrected to the current
six-row/88px/21px contract. Its first recheck then caught an outdated Molt
heading string. `closure24-reflow-recheck2.json` passes the complete test,
including all long rules, full identity, pin/selection separation, paused input,
three sizes, no mutation and end-of-reader bounds. Original failed reports remain.
Current compact Deck/full-capacity and high-resolution comparison captures were
inspected. No production change was needed after item 11. Item 13 is next.

## Item 13 — optional secondary information and return context

| Entry point | Optional information | Preservation contract / existing verification |
| --- | --- | --- |
| Collection Tools, card dossier, Atlas | Search/saved views/filters, journal and collection metadata | Same query, selected card, grid scroll and exact opener after nested close/recovery |
| Flock/Folio tools | Identity, organization, Lab, Signals, Field Record, Revision Trail and tuning | Same Folio, sampled hand, revision and exact initiating action; no launch from reading |
| Route/battle HUD and selected card | Deck, comparison, Flock Stats, Supplies, Waymarks, piles/history, complete rules/terms | No card play, Supply consumption, purchase or route commitment from inspection |
| Market/reward/picker | Effect/upgrade/details sections, terms, purchase consequences and full deck impact | Direct sections; original selection, armed state and page survive return |
| Boss preparation / results / Flight Log | Threat/strategy/readiness, full recorded flight | Reading is optional and read-only; returning restores selection and action focus |
| Guide/Settings/pause | Help, lessons and preferences | Background reader retains its selection/scroll; canceled loading cannot reopen it |

Item-11/12 live-reader matrices already verify full content, direct sections,
remapped inputs and no mutation for these families. The item-13 follow-up on
the same Bmv6fgWC candidate specifically rechecks Collection/Atlas/Folio nested
return, shared reader controls and Supply inspection. `closure24-drawers.json`
passed all 16 cases with no retries/skips, covering three sizes, pointer/touch,
keyboard and virtual controller, remapped bindings, nested failed-draft recovery,
exact shelf/opener restoration and read-only Supply inspection. Current compact
Revision Trail and returned-journal captures were inspected. Combined with the
complete direct-reader matrices above, item 13 is verified on Bmv6fgWC without
further production changes. Its runner/browser exited; item 14 is next.

## Item 14 — target inventory and closure

The 45-surface runtime inventory records actual Phaser hit regions rather than
art bounds. The strengthened checks use the engine's topmost receiver, viewport
bounds and true circle/rectangle distance. Optional click-outside margins are
not command buttons; each has a separate full-size Back action. Enemy body,
portrait, vitals and status strip are aliases for the same selection action,
not four independent commands. Native editor inputs/buttons are measured in
CSS pixels. Independent controls must retain the existing 8px game-space gap.

Repairs cover map circular hit regions; pause/audio/Waymark spacing; the leader
inspection region ending above the hand; Roost/pile/history clearance; Collection
toolbar, Atlas and Saved View rows; Return rows/rule pagination; Flight Log,
Organizer, Tuning Bench and rating controls; Market Close and reward actions.
Collection card rows retain full readable text and canonical art proportions.
Folio text editors now provide explicit touch Save/Import and Cancel commands,
using the existing retained-draft/failed-write owner and cleanup lifecycle.

The first expanded run (`closure24-targets.json`) passed 50/70. Its failed
checks remain recorded: real narrow gaps plus the diagnostic's off-viewport
and circular-distance false positives are being repaired and rechecked. The
97-case expanded repair run uses fixed candidate `index-BC7tm9s1.js` and unchanged
timeouts/gates. No item-14 completion is claimed until these checks and the
native held-input follow-up pass and current captures are inspected.

The 97-case BC7tm9s1 run finished 88/97: remaining failures were Market Close
(five shelves), large-hand Next (two mappings), a boss portrait's transparent
hit padding, and the last Accessibility row against Full Screen. Exact repairs
retain the same target floors/gaps. Native touch/controller held-confirm tests
passed; visual inspection additionally caught a black browser-compositor tile
over the error-state editor heading. Canvas-only pixels were unaffected.
The pCCafXHQ focused run passed 4/6 (all Settings cases and held Confirm), with
four-enemy boss column gaps and the compositor artifact still failing.
The latter was isolated by DOM diagnostics: hiding the independent error layer
or moving it into the action bar's normal flow removed the black pixels. The
source now uses that shared flow, with a screenshot pixel regression retained;
boss-support columns gain the required spacing. No completion is claimed yet.

`closure24-targets-focus2.json` passed 3/3 on Bbau0p5N: all 36 enemy-cluster
combinations, native touch/controller actions without held-confirm leakage,
and the nested-recovery screenshot pixel regression. The final delta reserves
additional frame padding for failed notes with the new touch buttons; the
broader target/recovery matrix and explicit error containment will verify it.

`closure24-targets-final.json` passed 62/62 on C8RKm7-G, including all 45 compact
surface targets, both discard mappings, 36 enemy clusters, all editor recovery
cases, held-input/pixel checks, failed notes containment and Settings. Current
compact Market/discard/editor captures and high-resolution recovery captures
were inspected. A final native Import/Retry label measurement found a 3px width
shift; the primary native command now has a fixed 148px width. Explicit stable
bounds, native error recovery, Pause/Abandon target geometry and the Settings
touch smoke test remain to qualify that last delta.

Item 14 is verified on B99OHeup. `closure24-targets-stability.json` passed 9/9:
all native retry labels preserve exact command bounds; touch/controller/held
input, nested recovery and failed notes pass; Pause/Abandon and Settings/remap
targets satisfy the same floors and separation. The prior 62/62 matrix covers
all other current targets; the only subsequent production delta fixes the
native command width. Every earlier failed target case has a passing recheck.
Build/TypeScript, unchanged bundle/cache gates, docs and diff checks pass.
Current compact/high-resolution captures were inspected, including error-state
editors, Market, discard, Atlas, Saved Views and boss groups. The shared gameplay
client completed review/return with matching image/state, exact opener restored,
and no error artifact. All runners/browsers exited; only owned preview 31576 is
retained for item 15. Total: 44/60 verified, 16 open (8 of the fixed 24 closed).

## Items 20 and 41–44 — complete artwork review

Closed on `index-By96udgS.js`. The complete per-card disposition is in
`../art/card-gameplay-review.md`; all other active families and repair decisions
are in `../art/art-review-2026-10-22.md`. The exact delivered inventory records
872 images, with source/export hashes, dimensions, alpha, consumers, crop and
load policies; no unresolved entries. All 110 card thumbnails match the reviewed
SHA index. Browser identity, all-card layout and fallback catalog cases pass on
the final candidate. Twenty item cutouts and the Signal icon were repaired;
selected masters, prompts and deterministic exporters are preserved.

Canonical validation passes 56 Minor and 22 Aviary shared frames, 22 immutable
approved Major frame/title layers, ten Snag source/template/font recompositions,
and 220 lossless portrait/thumbnail exports. Major titles are approved original
raster lettering, now locked separately; no claim of newly typeset Major titles.
Lossless WebP equality ignores only RGB beneath fully transparent alpha pixels.

Final evidence: `D:/codex-bird-squad-closure24-20261021/evidence/` contains
`final-canonical.log`, `final-delivered-art.json` (872 decodes, one passing case),
`art-inventory-final/inventory.json`, card/item review sheets and before images.
The shared gameplay client also completed a real card play on the final build,
with matching screenshot/state and no error artifact. Full release and remaining
context/input/menu/flight gates are still open. Total: 53/60 verified, seven open.

## Item 45 — final artwork context

Verified on the same By96udgS candidate. The 60 repaired-item context captures,
20 inspected compact contexts, Signal three-size route captures, complete
alpha/edge/export review and passing current loading/recovery checks are indexed
in `../art/art-review-2026-10-22.md`. The 872-image decoder audit has no missing
export. Waymark recovery and both generated-FX ownership cases have passing
focused rechecks after correcting readiness/modal sequencing in their fixtures.
No production change or acceptance threshold was needed. Total: 54/60 verified,
six open; full release qualification remains open.


## Item 56 — final visual matrix

Verified on the Cl7N8-97 qualification lineage. The 186 individually inspected
captures include all named surface families and live victory/defeat outcomes
at all three required sizes. Exact capture/candidate/hash records and delta
scope are in `visual-review-2026-10-22.json`; state/family coverage is mapped in
`final-state-coverage-2026-10-22.md`. Rejected attempts are retained but excluded
from accepted evidence. Input, full-suite reconciliation and final grading are
still separate open gates. Total: 55/60 verified, five open.


## Item 55 — menu data states

Verified across the qualification lineage and exact focused rechecks. Fresh,
populated, long, saved, corrupt, empty and maximum/restored states are mapped to
specific tests and inspected images in `final-state-coverage-2026-10-22.md`.
The zero/50-flight matrix performs real export/restore/reload of maximum
Folios/cards/text; the current focus and toolbar changes preserve exact state.
The complete fresh suite remains required separately by item 58. Total:
56/60 verified; items 57–60 remain open.


## Item 57 — input and resilience

Final live input journeys pass 4/4, browser smoke passes 9/9, Pages passes 1/1
and the unmodified shared gameplay client performs a real card play with exact
image/state agreement. Dedicated remap/touch/reduced-motion/delayed-load/focus
coverage and corrected fixtures are indexed in the qualification report.
Virtual/emulated evidence remains labeled. The 903-case fresh full run is now
in progress with unchanged source/artifact hashes and unchanged gates.
Total: 57/60 verified; full regression, final resource closure and grading remain.


## Items 58–60 — final qualification and assessment complete

Final candidate Cl7N8-97 passes the uninterrupted 903-case deployment-equivalent
regression in 106.5 minutes: no skipped, failed, flaky or retried cases. Every
one of the 41 remote failures maps to passing current coverage (52 cases because
three reader cases split explicitly); all 49 discovery failures also pass.
Source/tests/config and all 933 production files match the pre-run SHA snapshot.

Four live journeys pass: natural keyboard defeat/replay, keyboard victory with
pointer targeting, pointer-only victory/replay and virtual-controller-only
victory/replay. Each victory clears the final boss with 119 played cards and
43 turns. Browser smoke is 9/9; Pages is 1/1; shared client image/state agrees;
six native-clock samples disclose software-rendering limits. Cleanup records
no remaining owned process or qualification-port listener. The twelve named
assessment areas are A within the explicit automated/LLM scope. Human/device/AT
waivers and preferred bundle warnings remain visible. See the final qualification
and area-assessment reports. Total: **60/60 verified, zero open**.

# Backlog and performance release — October 24, 2026

## Scope

The [reconciled ledger](../game/backlog-reconciliation-2026-10-24.md) maps the
original 52 enhancements and all 70 normalized work packages to implementation,
verification, conditional ideas or existing owner waivers. Historical entries
remain dated rather than being rewritten as current results.

This pass adds optional Preen and Release practice, numerical draw comparisons,
deferred HUD/route presentation and a renderer configuration improvement. It
also fixes reduced-motion flourish retention. Save isolation, real selection
and commitment, retry/cancellation and failed renderer controls are covered.

## Build identity

Repaired candidate app: `index-yrgadWQn.js`, 682,751 bytes, SHA256
`7b4ddce1bc979bedfd067f6eeb4da0c004c5314e947ebeba97bfc703bcb26818`.
Pages app has the same Vite filename but different base-path bytes: 683,815 bytes,
SHA256 `6906acd86193d5a431c2ec4112ffcc9301e004c83cbd05d8c2882f14d1c48509`.
Compare content hashes, not filenames alone.

Combined boot is 708.8 KiB at root and 709.9 KiB on Pages. Both meet the existing
710 KiB preferred target and 725 KiB hard limit. Pages has only 129 bytes below
the preferred target; this is not ample room for more startup code. The existing
675/700 KiB entry targets also pass. No pre-existing allowance was enlarged.
The new deferred HUD, transition and breathing chunks have 10, 7 and 2 KiB limits.

Local identities are in `.artifacts/backlog-repaired-identity.json` and
`.artifacts/backlog-pages-repaired-identity.json`. They identify dirty candidates;
the clean GitHub workflow artifact will identify the merged publication.

The full sweep exposed a breathing-envelope defect. A deterministic full-cycle
reproduction reached y=105.65, above the 106px HUD clearance boundary. The repair
limits vertical lift/stretch to available silhouette clearance with a 2px margin;
its presentation remains deferred. The repaired identity above supersedes the
full-sweep candidate (`index-m393BKb-.js`). The new complete-cycle regression
passes in Chromium, Firefox and WebKit.

## Verification

| Check | Evidence / status |
| --- | --- |
| Full production sweep | 981 cases: 977 passed, four failed; no skipped cases; all four matched to passing repaired-build reruns |
| Final-source qualification | GitHub runs all 982 cases, including the added complete-cycle breathing regression, before Pages publication |
| New cross-browser checks | 15 passed, zero failed/skipped; `.artifacts/backlog-qualified-cross.json` |
| Existing release browser smoke | All nine passed on the repaired build; `.artifacts/backlog-repaired-smoke-cross.json` |
| Repaired stage / breathing matrix | Nine passed across Chromium, Firefox and WebKit with clean worker exit; `.artifacts/backlog-stage-cleanup.json` |
| Unit checks | 18 passed; `.artifacts/backlog-final-unit.log` |
| Existing practice checks | Passed in the full sweep; new Preen/Release practice also passed the three-browser matrix |
| Strategy fixtures | 15 cases / 45 battles; no loops or defeats; `.artifacts/backlog-strategy-summary.json` |
| Warm lifecycle | Eight scene cycles; bounded textures/objects/listeners, no stopped-scene timers |
| Campaigns / live journeys | All 14 seeded campaigns and four keyboard/pointer/controller journeys passed in the full sweep |
| Economy | 1,000 seeds; all four district deck/Waymark targets passed |
| Content | 32 checks, zero drift and zero pending |
| Delivery | Root and Pages builds, unchanged budgets and cache contracts passed |
| Repaired Pages artifact | Actual base-path smoke passed, including lazy screens, combat and checkpoint reload |
| Visuals | Inspected 2560×1600, 1440×900 and 1000×560 lesson/reader/HUD captures; IAB title/guide/lesson/cancellation review |
| Shared gameplay client | Final unmodified client played First Flight; screenshot/state inspected, no error file; `.artifacts/backlog-repaired-client` |
| Local evidence reconciliation | Machine-checked failure mapping and matrix results: `.artifacts/backlog-local-release-summary.json` |
| Publication gate | Complete final-source GitHub workflow, clean build identity and live Pages smoke; publication outcome is recorded in the release PR |

Early attempts are retained. Strategy fixtures initially used the wrong node
type and an unavailable Clock inspection method; corrected fixtures passed all
16 cases. New lessons initially lost their owner on Route restart; that lifecycle
was fixed. The first cross-browser replay check pressed Confirm before the next
frame installed its new action-focus owner: two WebKit failures are preserved in
`backlog-cross-browser-results`. The corrected final tests wait for that frame
and all 15 pass. That failed run's browser teardown stalled and was stopped after
all cases reported; its log is not described as a clean run.

A root rebuild hit a Windows `ENOTEMPTY` cleanup error. Subsequent qualification
uses fresh, immutable output directories; no tests run against files being rebuilt.
The initial full-sweep asset-decode fixture used the default empty build directory.
Its rerun points to the immutable repaired build and passes in all three browsers.
The battle-stage fixture now waits for title startup before launching a battle,
and asserts that only BattleScene is active; this removes a fixture-created second
scene from captures without weakening HUD or interaction assertions.
The first repaired nine-case stage run passed its assertions, then WebKit's
worker exceeded its 300-second shutdown deadline and the runner reported two
infrastructure errors. That report remains in `backlog-final-stage.json`; the
isolated rerun and a Node 24 retry also passed assertions but stalled at worker
exit and were interrupted. Explicitly unloading the live WebGL page in test
cleanup resolved this: all nine final cases and worker shutdown pass on the
normal Node 20 runtime in `backlog-stage-cleanup.json`. No game assertion was
removed or relaxed.
The remapped route-reader fixture also reproduced a missed first pointer click
(two failures in three repeats). It now waits for interactive route readiness
and two rendered frames after pointer movement, retaining all page, state,
geometry and input-ownership assertions. Three consecutive repaired-build
repeats pass; `.artifacts/backlog-reader-fixed.json`. Diagnostic output confirms
that a delivered click advances the reader and preserves its control objects.
The route-commit label click was intermittent: its original isolated repeats
passed, while the loaded full run missed the click. Its fixture now settles the
pointer on a rendered frame before clicking the exact visible label center;
all geometry and transition assertions remain. Three corrected repeats pass
in `.artifacts/backlog-commit-fixed.json`.

Six final native-clock performance cases passed with real card and enemy turns.
Combat frame interval fell from about 50 ms to 23–34 ms in the repaired build. The complete
table, method, outlier and host limitations are in
[performance-notes.md](performance-notes.md). Final measurements ran after the
regression browsers exited; the earlier qualification measurements are retained.

## Limits

The strategy fixtures use explicit decks and upgrades, not naturally acquired
campaigns. A bounded scripted policy does not establish universal balance or
enjoyment. Full campaigns and live-control journeys remain separate release
requirements. Performance is measured on this automation host; physical devices,
human playtesting and actual NVDA/VoiceOver sessions remain unverified under the
existing version-scoped waivers. Windows Playwright WebKit does not qualify
Safari hardware audio. Passing tests do not prove the absence of every bug.

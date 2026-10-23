# Final acceptance qualification — October 22, 2026

Status: **complete — 60/60 acceptance items verified.** Final candidate:
`index-Cl7N8-97.js`. All named areas are assessed A within the plan's explicit
automated/LLM scope; see `final-area-assessment-2026-10-22.md`.

The uninterrupted final suite passes **903/903**, with **zero failed, skipped,
flaky or retried cases**, in 106.5 minutes. All 41 previous remote failures map
to passing current coverage (52 cases after explicit splits); all 49 discovery
failures also pass. Source/test/config and production hashes match the snapshot
from qualification start. All owned qualification processes/ports are closed.

Initial qualification candidate: `index-By96udgS.js`, production artifact in
`D:/codex-bird-squad-closure24-20261021/final-build`. Evidence paths below are
relative to `D:/codex-bird-squad-closure24-20261021/evidence`.

The visual review found that the persistent Practice badge covered the Scrap
label. The first correction (`index-1ADhLg7l.js`) passed combat checks but its
Route captures were rejected because the shifted HUD crowded the summary.
Practice correction `index-BTY8t1E_.js` in `../practice-final-build` reserves twelve
game pixels above the Practice combat HUD, including controls and Flow preview.
Practice Route uses the spare right-hand HUD lane and keeps its original bounds.
Other sessions keep their existing positions. Build/TypeScript and unchanged
bundle/cache limits pass (`practice-final-build.log`, `practice-final-bundle.log`,
`practice-final-cache.log`). Every one of the 872 reviewed images is byte-identical
to By96udgS (`practice-final-art-continuity.json`). All 15 final Practice/Preen
checks pass (`practice-final-check.log`); twelve replacement captures were
inspected at the three supported sizes. Screenshot records identify their exact
candidate. The visual index currently records 186 inspected captures.

Current candidate is `index-Cl7N8-97.js` in `../release-qualified-build`.
Further production changes reserve eight pixels above card-picker choices,
correct the Codex reader's spoken Confirm/Back instruction, and widen the
Waymark effect area from 248 to 252 pixels so Razor Kite Tail remains complete
at the unchanged 21px primary role. The shared normal/offline renderer keeps
its panel and action geometry. Build/TypeScript, unchanged bundle hard caps
(722.5 KiB boot / 725 KiB limit), deployment cache and 872-image byte continuity
pass (`release-qualified-build.log`, `release-bundle.log`, `release-cache.log`,
`qualified-art-continuity.json`). Existing preferred-size warnings remain.
The first earlier bundle/cache invocations supplied unsupported `--dist`; the
corrected positional invocations are the evidence. No gate was bypassed.

The discovery suite completed **854 passed / 49 failed** in two hours. Its
failures are retained and every case now has a passing final result; this was
not a full regression pass. Six current picker captures were inspected.
The Waymark catalog found one real truncation; both normal mappings now pass
all catalog, pagination, modal, immutability and commitment checks. The fallback
also needs its native download dialog dismissed through Keep playing before
canvas actions are tested. The subsequent fresh full suite passed; its exact report is indexed below.

## Completed current gates

| Gate | Evidence | Result |
| --- | --- | --- |
| Build and TypeScript | `release-qualified-build.log` | Pass |
| Bundle limits and deployment cache | `release-bundle.log`, `release-cache.log` | Pass; existing hard limits unchanged, preferred warnings retained |
| Docs/runtime/assets/release policy/enemy/overlay contracts | `complete-docs.log`, `release-runtime.log`, `release-assets.log`, `release-policy.log`, `release-enemies.log`, `release-overlays.log` | Pass; explicit release waivers retained |
| Canonical card integrity and delivered artwork | `final-canonical.log`, `final-delivered-art.json`, `qualified-art-continuity.json` | Canonical checks and 872 decodes pass; all image bytes identical in current artifact |
| Chromium / Firefox / WebKit | `qualified-cross.json` | 9/9 |
| Pages subdirectory deployment | `release-pages.log` | 1/1, lazy scenes, full-art combat and checkpoint reload |
| Visual review | `visual-review-2026-10-22.json` | 186 inspected captures; three-size family matrix complete |
| Shared real-input browser client | `release-shared-client` | Real First Flight play, matching screenshot/text state, no error artifact |
| Complete live journeys | `clean-reference.json` | 4/4, including natural defeat and three victory/replay paths |
| Native-clock performance | `final-performance.json` | Six complete cases; software-rendering limits disclosed in `performance-measurement-2026-10-22.md` |
| Fresh full regression | `acceptance-clean.json` | 903/903; no skipped, unexpected, flaky or retried cases; 106.5 minutes |
| Historical failure reconciliation | `remote-reconciliation.log`, `discovery-reconciliation.log` | 41/41 remote failures and 49/49 discovery failures resolved by passing final cases |
| Frozen qualification inputs | `qualification-inputs.json`, `qualification-inputs-verification.log` | 321 source/test/config inputs and 933 production files unchanged |
| Owned resource cleanup | `release-resource-cleanup.json` | No remaining owned process or listener on ports 5497–5499 |


Victory journeys each play 119 cards and clear the final boss in 43 turns with
13/42 Cohesion. Keyboard with pointer targeting uses 273 decisions (322.4 s),
pointer-only 253 (407.3 s), and virtual controller-only 270 (607.6 s). Natural
keyboard defeat/replay takes 23.9 s. These are reproducible scripted players,
not authentic player or balance evidence. Each replay uses the live outcome
command, without scene jumps or game-state grants.

The three-size visual review is complete. Original high-resolution title/guide
captures taken during fade and the first Practice badge correction were rejected;
settled/corrected replacements were inspected. Geometry alone is not visual
acceptance. Exact candidate, dimensions and hashes are retained per image.

The fresh 903-case suite uses two workers, existing timeouts and zero retries.
`qualification-inputs.json` records source/test/config and production file hashes
before it starts; the final verification matches them exactly. The completed
report records all 903 cases passing.

## Failed and interrupted attempts

All attempts are retained. No retries, skipped assertions, enlarged budgets or
historical passes are used to turn an incomplete suite into a full pass.

The first `acceptance-clean` launch omitted `BIRD_SQUAD_TEST_BUILD_DIR`.
Its exact-image audit therefore compared current source art with the older
default `.artifacts/build` instead of the served release artifact and failed.
That early run was stopped; its files are retained with the
`early-missing-build-env-` prefix. The launcher now explicitly points the audit
at `release-qualified-build`, and the input snapshot records that value and the
launcher itself. The same image audit passed before the fresh full restart (`release-art-path-check.log`) and again inside the completed full suite.
No test, image-byte assertion, worker count or timeout was relaxed.

| Finding | Resolution and current evidence |
| --- | --- |
| Waymark failure check tried Pause under the native download dialog | Dismiss Keep playing, then verify the underlying reader/Pause/reload lifecycle; `remaining-fixture-recheck.log` passes. |
| Two Deck hints asserted obsolete 18px text | Assert current shared 19px secondary role plus actual 14px CSS minimum; both mappings pass in `remaining-fixture-recheck.log`. |
| Deck comparison opened before ready input registration | Wait for route readiness and the actual topmost pointer receiver; full comparison, long text and immutability pass in `deck-pin-recheck2.log`. |
| Generated FX batch probe used an unloaded deferred texture | Wait for the required contact texture; both motion settings pass all ownership/retirement assertions in `final-fx-texture-recheck.log`. |
| Market shelf asserted obsolete 18px primary text | Assert current 21px role and rendered 16px minimum while retaining every bounds/content assertion; `final-market-shelf-recheck.log` passes. |
| Market transaction ignored Ledger Tab's authored 12 Scrap rebate | Fix the fixture to explicitly buy Ledger Tab; exact payment/rebate and one owned item pass in `final-market-transaction-recheck.log`. |
| Empty Packed Supplies retained a recent-use history | Verify both the expanded history state and genuinely empty compact state; Route and Battle pass in `final-packed-supplies-recheck.log`. |
| Preen checks asserted obsolete 16px/18px roles | Current 19px/21px roles retain original bounds and actual rendered minimums; the 440-state catalog passes in `practice-qualification.log`. |
| Preen fixture expected Pause to remain open after activating Resume | Explicitly verify Confirm resumes to the reader, reopen Pause, then verify Back resumes before a second Back closes the reader. Both mappings pass in `practice-preen-recheck.log`; armed decisions stay unchanged throughout. |
| Practice badge covered the Scrap label | Separate combat and route badge lanes; three-size overlap/readability checks and final replacement review on BTY8t1E_. |
| Boss preview waited for retired tooltip artwork; Molt lesson expected compressed copy | Check the current quiet tooltip's full text and containment; select the lesson by semantic name and verify its plain instruction and lifecycle. Both pass in `route-molt-recheck.log`. |
| Return picker expected 70px rows before separation repair | Current 62px rows retain at least 44 CSS pixels and 8px gaps; ordered effects and explicit pointer recovery pass in `return-target-recheck.log`. |
| Reward loading expected the former hint plaque and old button offset | Verify current 19px hint, stable loading/ready bounds, locked keyboard/controller input and exactly-once announcements; `reward-loading-recheck.log` passes. |
| Add-reward fixture required a deck chip in the first-collection status row | Exercise Read and assert the displayed before/after deck impact before actual add and Preen commitments; passes in `market-reward-recheck.log`. |
| Market dossier expected 15px text and a 10px footer inset | Verify current 19px minimum and shared 8px inset on all four sides; no text escaped the panel. Full build-read narration, sections, payment preview and sold dismissal pass in `market-reward-recheck.log`. |
| Market sold slat and catalog checks expected stretched image frames | Preserve the slat's source aspect and assert current quiet surface counts/dimensions while retaining generated vendor/sign/counter/icon checks; transaction passes in `market-reward-recheck.log`, catalog in `menu-market-recheck.log`. |
| Grouped Settings retained old row bounds | Verify 58px rows with 8px gaps through all groups and scenes, focus, persistence, listener counts and narration; `menu-market-recheck.log` passes. |
| Help waited for unused decoration downloads and indexed an old introductory field | Wait for six actual topics, check all twelve complete fields, matching narration, current shortcuts and three stable controls; both cases pass in `menu-market-recheck.log`. |
| Deck pointer filter clicked before Phaser input registration | Wait for actual canvas frames before clicking; filtering, sorting, search and keyboard navigation pass in `menu-market-recheck.log`. |
| Quiet guide still expected unused decorative Help images | Assert 12 readable fields and actual guide actions, unused Help art stays unfetched, Settings art and original boot budget remain checked; all three browsers pass. |
| Pointer reference player selected a card on another hand page | Driver clicks actual Next/Previous controls; final complete pointer victory/replay passes in 407.3 seconds. |
| Controller reference flight exceeded 20 minutes during overlapping browser work | Original limit and all controls retained; final isolated controller victory/replay passes in 607.6 seconds. |
| Overlapping `acceptance-qualified` timed out in the 48-capture boss-prep case | Incomplete runner stopped to remove contention. No budget increase; the case passes in the final uninterrupted 903/903 run. |

`acceptance-final` is discovery evidence and has known failures. The stopped
`acceptance-qualified` attempt is incomplete. Neither is a fresh full-suite pass.
The previous remote run's 41 cases remain separately indexed in
`remote-release-reconciliation.json`; their final status now comes from the
completed fresh regression.

Three historical outcome-reader cases were split into complete-reading and
transaction-ownership cases. Reconciliation requires all six replacements for
each normal-input case (three sizes × two checks), and both compact remapped
replacements. These are not treated as missing or silently matched to a single
pass. The repository's local default remains 30 seconds; this final suite uses
the existing deployment workflow's 90-second default, two workers and full
parallelism, with the same reference-flight exclusion and separate serial run.

## Final focused reconciliation additions

The remaining discovery failures have passing focused rechecks:

- Deck artwork counts, Atlas opening through Tools, current Collection toolbar
  bounds, correct focused-action close, dossier shortcuts and Flight Lab focus:
  `legacy-geometry-recheck.log`, `qualified-regression-recheck.log`,
  `qualified-collection-recheck.log`, `collection-input-recheck.log`.
- Local ratings select their next command through Tab before Confirm; the
  export still verifies real download, exact primary/mirror values and no POST.
- Audio checks preserve scene identity and require the existing cue wherever
  that surface renders it; Profile has no invented audio button requirement.
- Shared-route labels distinguish fresh and checkpoint context while preserving
  exact seed/length launch. Starter and pointer reference drivers use visible
  hand pagination instead of looking for an off-page card.
- The lethal Supply fixture predicts the authored reward stage, verifies exact
  consumption and unchanged turn, then intentionally claims a Waymark if needed
  before checking card rewards (`starter-supply-recheck.log`). Spark Caller
  passes its full journey (`starter-final-recheck.log`).
- Both Waymark mappings pass the complete catalog and safe inspection lifecycle
  after the 252px effect fix (`release-waymark.log`: normal cases pass).
  Both offline mappings pass after dismissing the native download owner through
  Keep playing (`release-waymark-fallback.log`: 2/2).

Earlier failures remain retained, including the partial Waymark runs. The
performance probe's first attempt expected an untargeted number-shortcut card
still to be selected after it had already committed. It now accepts either the
actual selection/Confirm path or exactly one immediate play, and still requires
exactly one played card, its resolved log entry and a completed real enemy turn.
No game-state mutation or clock fast-forward is used for those measurements.

## Final closure

All 60 plan items are verified. Menu data-state and named surface reviews,
input/resilience checks, complete live journeys, native-clock measurements,
full regression and all historical failure mappings are complete. The owned
preview was stopped after testing; the cleanup report records no remaining
owned qualification process or listener. Evidence and all failed/interrupted
attempts remain preserved locally. The area assessment records the final grades
and retains the software-rendering limits, preferred bundle warnings and existing
0.1.0 human/device/AT waivers.

## Scope of the assessment

This is automated browser verification and LLM visual assessment. Virtual
controllers, emulated touch and DOM live-region checks do not establish physical
device or human-operated assistive-technology performance. Existing 0.1.0 release
waivers remain explicit. No claim of player enjoyment, physical-device
certification, remote CI success or publication is made.

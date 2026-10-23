# A-grade acceptance plan — September 30, 2026

This is the expanded 60-item plan requested after the September 29 visual review.
It supersedes the scope (not the evidence) of `a-grade-ui-backlog.md`.
All acceptance is achievable with code, automated tools, generated assets and
LLM visual review. No human feedback, physical device session or human-operated
assistive technology is a dependency. An A is an assessed implementation grade,
not a guarantee of player enjoyment or real-device performance.

Status: **60 of 60 acceptance items verified; none remain open.** All named
areas are assessed A against this plan's implementation/visual criteria, with
the scope and limitations recorded in `final-area-assessment-2026-10-22.md`.
This is automated verification and LLM visual assessment, not proof of player
enjoyment, physical-device performance or human-operated AT usability.

Final candidate: `index-Cl7N8-97.js`. The fresh uninterrupted regression passed
903/903 with zero failures, skips, flaky results or retries; all 41 prior remote
failures (52 current cases after explicit splits) and all 49 discovery failures
reconcile to passing final evidence. Four complete live-control journeys,
nine cross-browser checks, Pages deployment, six native-clock performance
samples and the shared gameplay client pass. The 186-capture visual matrix and
872-image inventory are complete. Source/test/config and artifact hashes stayed
unchanged during qualification. Owned qualification processes/ports are closed.

See `final-qualification-2026-10-22.md`, `final-state-coverage-2026-10-22.md`,
`visual-review-2026-10-22.json` and the fixed closure ledger. Performance on this
software-rendered test host remains approximately 20-fps combat with loading
spikes; no hardware performance claim is made. Existing release waivers and
preferred bundle-size warnings remain explicit. Failed/historical attempts are
retained separately and are not promoted to the fresh release result.

## Combat cards — lowest grade first

- [x] 01 Replace punctuation-compressed hand rules with plain-language summaries.
- [x] 02 Separate primary and conditional effects without changing written order.
- [x] 03 Verify summaries against structured effects, including targets and spending.
- [x] 04 Establish stable cost/name/art/primary/conditional hierarchy.
- [x] 05 Exercise every card in base, Preened, Molt and Preened-Molt states; large hands and long text.

## Collection

- [x] 06 Keep advanced tools secondary to default browsing.
- [x] 07 Distinguish global sections, card families and filters.
- [x] 08 Use intentional undiscovered card backs without redundant labels.
- [x] 09 Distinguish undiscovered, loading and failed artwork; provide recovery.
- [x] 10 Restore exact search, filter, sort, scroll and focus after inspection.

## Compact layouts

- [x] 11 Enforce rendered CSS floors: primary 16px and secondary 14px.
- [x] 12 Reflow dense screens instead of uniformly shrinking them.
- [x] 13 Put secondary information in accessible drawers.
- [x] 14 Verify at least 44×44 CSS-pixel targets and separation.
- [x] 15 Test long text, maximum content, overlays and restored saves geometrically.

## Card identity and art

- [x] 16 Explain illustration titles versus gameplay names.
- [x] 17 Maintain consistent identity across every card presentation.
- [x] 18 Author subject-preserving crop metadata where cropping is needed.
- [x] 19 Reserve artwork bounds during loading and failure.
- [x] 20 Review every illustration at gameplay scale.

## Shared UI

- [x] 21 Consolidate typography, spacing, color, border, corner and contrast tokens.
- [x] 22 Standardize primary, secondary, navigation and destructive controls.
- [x] 23 Distinguish hover, focus, selected, armed, disabled, loading and error.
- [x] 24 Preserve decorative-frame proportions; prefer quiet surfaces where appropriate.
- [x] 25 Standardize overlay bounds, close behavior, focus restoration and background input ownership.

## Combat

- [x] 26 Prioritize actionable HUD information.
- [x] 27 Unify intent, health, status and target presentation.
- [x] 28 Improve character grounding, shadows, scale, lighting and positioning.
- [x] 29 Keep action feedback driven by authoritative combat state.
- [x] 30 Measure timing budgets; eliminate dead time and verify reduced motion.

## Route map

- [x] 31 Make future paths readable.
- [x] 32 Make node types recognizable and inspectable through every input mode.
- [x] 33 Present one selected-destination summary.
- [x] 34 Distinguish current, available, selected, completed and future states without color alone.
- [x] 35 Establish boss hierarchy and preparation information.

## Market and dossiers

- [x] 36 Present effect, price, affordability, target, primary action and blocker together.
- [x] 37 Make supplementary sections directly optional, not a serial reading tunnel.
- [x] 38 Support direct keyboard/controller section navigation.
- [x] 39 Distinguish inspect, select, confirm, sold and unaffordable states.
- [x] 40 Integrate vendor composition while subordinating the background.

## Art production

- [x] 41 Inventory usage, source, export, dimensions, alpha, crop and load state.
- [x] 42 Audit character anatomy, silhouette, pixel density, outlines, lighting and materials.
- [x] 43 Maintain an evidence-backed replacement queue; preserve successful art.
- [x] 44 Keep canonical borders and typography deterministic, separate from generated illustrations.
- [x] 45 Review alpha, edges, scale, compression, loading and recovery in context.

## Events

- [x] 46 Present concise narrative context.
- [x] 47 Present exact structured consequences.
- [x] 48 Remove redundant decorative elements.
- [x] 49 Verify resident/environment grounding, scale and clearances.
- [x] 50 Test all outcomes, unavailable states, cancellation, reload and repeated-input guards.

## Menus

- [x] 51 Align title-screen and shared controls.
- [x] 52 Verify setup portraits, locked requirements on all inputs and launch summary.
- [x] 53 Polish deeper Flock, history, Folio and save screens.
- [x] 54 Clarify Settings explanations, applied/disabled states and save failures.
- [x] 55 Exercise fresh, populated, long, saved, corrupt, empty and maximum menu states.

## Acceptance and release qualification

- [x] 56 Complete visual matrix at 2560×1600, 1440×900 and 1000×560.
- [x] 57 Verify pointer, keyboard, virtual controller, emulated touch, reduced motion, delayed assets/modules and focus.
- [x] 58 Reconcile the previous 41 remote release failures and run fresh full regression without weakened gates.
- [x] 59 Exercise full victory/defeat/replay flights; measure performance and clean owned resources.
- [x] 60 Regrade each area against current evidence; do not claim all A prematurely.

## Current pass

### October 22 — All 60 items complete

Items 58–60 close on the final Cl7N8-97 candidate. `acceptance-clean.json`
records 903 expected results, zero unexpected/skipped/flaky, in 106.5 minutes.
`remote-release-reconciliation.json` and `discovery-failure-reconciliation.json`
resolve every historical failure without waived assertions. The full input,
source and artifact snapshot matches after the run. Four live journeys pass,
including three final-boss victories/replays and natural defeat/replay. Six
native-clock measurements disclose the automation host's rendering limits.
`release-resource-cleanup.json` records no remaining owned process or listener
on qualification ports. Every named area now has a supported scoped A assessment.
All work remains local; this does not claim a remote CI pass or publication.

The dated entries below retain the history and counts at their original checkpoints.

### October 20 — Item 22 closed; fixed-scope execution continues

The cross-game role inventory and shared consumers are now qualified on local
candidate `index-CJhx5GT4.js`. Primary, secondary/navigation and destructive
actions are intentional across the named families; safe Back no longer uses a
destructive close, disabled actions remain readable, and normal/offline rewards
share their commitment controls. Exact evidence is indexed in
`remaining-24-closure.md`. Item 23 is next; this is not full-release or all-A
qualification. The dated continuation entries below retain their historical counts.

### October 17 — Collection action controls and nested editor focus

Collection tools now use shared quiet-control styling and readable two-line labels.
Saved Views exposes individually focusable actions; destructive removal has a
separate confirmation with safe Cancel focus and failed-write preservation.
Card dossiers expose their action sequence to keyboard/controller focus, bring
the journal opener into view and restore it after native editing. A second
download-recovery dialog preserves the underlying editor's draft and focus.
Canceled search restores the original shelf position, query and selected entry.
Remapped Confirm/Back take precedence over Collection shortcut keys.

This advances items 22, 23 and 25; **36/60 remain verified and 24 remain open**.
Still required: consistent roles/states on the remaining bespoke dossier and
Folio controls, complete nested Collection/Atlas/Folio transition coverage, and
the separate decorative-frame and compact-layout matrices. Local evidence and
testing-process cleanup for this continuation are recorded in `progress.md`.

Final `index-D06heTZV.js`: 15/15 Collection and 5/5 persistence/search/journal
Chromium checks, plus 6/6 Firefox checks; zero retries or skips. Built-app
screenshots/geometry cover 2560×1600, 1440×900 and 1000×560. The shared gameplay
client and build/docs/bundle/cache checks passed. Owned test processes were
cleaned up, with the user's port-5173 preview preserved. No full-release claim.

### October 17 — Cancelable downloads, safe recovery and opener focus

Shared system panels and Collection launch now have a boot-resident pending
surface: Close works before the requested module arrives, slow downloads expose
recovery after eight wall-clock seconds even during combat Pause, and failure
keeps readable recovery choices. Closing or restarting the scene invalidates late
completion. Guide lessons retain visible loading/failure text and cannot reopen
after cancellation. Guide preference redraws preserve the selected action;
returning from lessons restores the Practice opener.

Download recovery is a native modal with safe initial focus, a separate checkpoint
reload confirmation, explicit Cancel focus, keyboard/controller/touch isolation
and canvas/opener focus restoration. Held controller input cannot fall through
when it closes. Reload remains user-confirmed, whole-page and cache-safe; it never
silently discards the current in-memory flight. Settings art refresh cannot replace
a pending download or redraw a retired panel.

The count remains **36 verified / 24 open**. This completes the system-module
loading/recovery portion of item 25, not the entire cross-game overlay criterion.
Remaining shared work: bespoke Collection control roles (22), remaining async and
armed controls (23), decorative-frame inventory (24), and the full nested
reader/Collection/Folio opener-focus and ownership matrix (25). The prior-pass
evidence below is historical; current verification is recorded in `progress.md`.

Candidate `index-tw7OnvL4.js` passed **42/42 Chromium** and **18/18 Firefox**
targeted checks without retries or skips, plus the shared gameplay client and
build/data/asset/cache validations. Pending/failure/confirmation layouts were
inspected at 2560×1600, 1440×900 and 1000×560. Owned testing processes were cleaned;
the user's port-5173 preview remains. This is local targeted evidence, not a full
release qualification.

### October 17 — Shared overlay ownership and control-state continuation

This continuation targets items 22, 23 and 25. Pause and run-exit confirmation
now use exclusive keyboard/controller owners, safe initial focus, remapped
bindings, scene-shutdown cleanup and a controller-release latch that survives
closing the panel. Route polling and combat navigation respect modal ownership.
Returning from Settings restores its pause-list focus; fresh pause starts at
Resume. An underlying deck reader also keeps its selected card while paused.

Shared controls now have explicit armed/loading/error status labels with stable
bounds. Lesson downloads disable repeated activation, remain cancelable through
the guide, and cannot resurrect it after close. Hidden ancestor containers block
pointer and focused activation. Save restore uses a destructive Confirm Restore
and safe primary Cancel. No artwork or existing theme was replaced.

The item-level total remains **36 verified / 24 open**. These broad shared
criteria must not be closed from only the system-panel subset. Remaining shared
work is concrete:

- **22:** migrate bespoke Collection search/sort/saved-view and dossier actions,
  then audit primary/secondary/navigation/destructive roles across every surface.
- **23:** apply the state contract to every asynchronous/armed bespoke control;
  verify genuine failure recovery as well as synthetic state rendering.
- **24:** finish the decorative-frame inventory and aspect-ratio matrix outside
  the already-quiet shared control adapters.
- **25:** complete nested reader/Collection/Folio ownership and exact opener-focus
  restoration coverage, including late redraws. The formerly outstanding
  system-module cancel/recovery surface is completed in the continuation above.

Final candidate `index-C4KA15ca.js` passed 58/58 broad Chromium checks, 10/10
focused Firefox controls/ownership checks and 4/4 transactional-save/pause smoke
checks. All runners exited cleanly, without retries or skips. Reports are
`.artifacts/oct17-overlay-accepted.json`, `oct17-overlay-accepted-firefox.json`,
`oct17-overlay-save.json` and `oct17-overlay-pause-smoke.json`. The shared client
also resumed full-art combat without errors. Owned preview/testing processes were
cleaned up; the user's port-5173 preview remains. Details are in `progress.md`.
Historical reports below remain historical; no full release or all-A claim is made.

### October 17 — Shared UI foundation and control behavior

Item 21 is complete: `ui-tokens.ts` owns shared fonts, readable type sizes,
semantic palettes, spacing, border/corner weights and contrast requirements.
Existing `theme` imports and legacy text-style helpers consume those defaults.
Font-only FX/encounter presentation receives canonical fonts through options so
the core and lazy chunks stay within their unchanged budgets. The implementation
contract is in `shared-ui-contract.md`.

Items 22–25 advance but remain open. Field/close, decision, system-menu and
practice controls now delegate to `quietButton`, including destructive actions.
Focus survives hover; disabled and hidden controls cannot activate; live labels
survive state repaint; guide input ownership is released on close. The guide,
pause and abandonment confirmation use readable text and measured clearances.
This does not close every bespoke control state, decorative frame or overlay.

Final candidate `index-DVS_lIuE.js` passed all 40 focused Chromium regressions,
zero retries/skips, with clean exit in 4.5 minutes:
`.artifacts/oct17-shared-accepted.json`. Coverage includes shared tokens/control
states, title/setup, Settings persistence failure, deck-reader delayed/failed
modules, reward recovery and existing A-grade UI flows. New geometry checks and
screenshots cover 2560×1600, 1440×900 and 1000×560. The final shared web-game client
also resumed actual combat with full art and no error artifact; screenshots and
text state are in `.artifacts/oct17-shared-final-client`.

Both final cross-browser attempts completed all nine test bodies successfully,
but WebKit worker shutdown hung afterward. The completed workers had no browser
children and were identity-checked and stopped. Logs are
`.artifacts/oct17-shared-accepted-cross.log` and
`.artifacts/oct17-shared-cross-clean.log`. This is assertion evidence, **not a
clean cross-browser qualification pass**. Item 58 remains open and includes
resolving that runner shutdown issue before claiming full release qualification.

Production build, hard bundle, local cache, runtime data, 961 asset, world/FX
and docs checks pass. Preferred bundle targets still warn. No full release suite
or all-A reassessment is claimed. All work remains local; no commit or deployment.

### October 17 — Cross-district rollout and reward refinement

The pilot's shared combat-card implementation was exercised across all four
districts: 80 authored encounters at three sizes (240 captures), and 110 cards
in base, Preened, Molt and Preened-Molt states at three sizes (1,320 layouts).
The 24-case rollout passed without retries and exited cleanly on intermediate
candidate `index-DcFDPhgt.js`; report `.artifacts/oct17-rollout.json`. This is
broader rollout evidence, not a fresh full-release pass on the final candidate.

Card rewards, Preens and their renderer fallback now share measured name, cost,
family, contained-art and rules slots. Waymarks and deck-impact inspection use
the same readable scale. Quiet surfaces replace stretched choice borders and
crowded decorative chips. Explicit Read replaces the automatic hover dossier;
device-specific hints retain remapped bindings. Failed illustrations reserve
their bounds and offer explicit Retry without redraw-driven download loops.
Successful recovery repaints only the art slot, preserving focus, the armed
choice and the deck. No canonical art was replaced in this pass.

Final candidate `index-1f5OIFNg.js`, SHA256
`E6A7AA5B9B33803676BA65610236E88184A1224F869323D57B895DF38851692A`:

- 27/27 reward/fallback checks passed on Chromium, Firefox and WebKit, with
  zero retries or skips and clean runner exit. Includes all three viewport
  sizes, text/target geometry, intentional commitment, remapped input and
  failed-art retry preserving the original slots and armed state. Report:
  `.artifacts/oct17-qualified.json`.
- 10/10 targeted legacy regressions passed with clean exit. Covers reward
  commitment, Collection/Hunt updates, Waymarks, deck impact, remapped input
  and inspection. Report: `.artifacts/oct17-recovery-regression.json`.
- Shared web-game client captures verified reward Read without commitment and
  an actual combat enemy turn; no captured console-error report. Evidence:
  `.artifacts/oct17-recovery-client` and
  `.artifacts/oct17-recovery-combat-client`.
- Production build, hard bundle gates and deployment-cache validation passed.
  Entry/boot preferred size targets still warn (685.0 / 724.8 KiB). Runtime,
  data, 961-asset, world/FX and documentation checks passed during this pass.

Intermediate art-retry failures drove the implementation fix. A subsequent
WebKit check was corrected to wait for the actual asynchronous art-slot repaint,
not merely texture insertion; the same identity, readiness and state assertions
remain required. Only the final clean 27-case run is acceptance evidence here.

Global status remains **35/60 verified, 25 open**. These changes advance items
11–25 and 56–59, but do not establish every screen's compact layout, a complete
art-production audit, full-flight coverage or a fresh full-release regression.
No blanket A grade is claimed. All changes and verification remain local.
Owned test previews were stopped, ports 5495/5496 are closed, and the temporary
browser tab was closed; the pre-existing port-5173 server was preserved.

### October 17 — Rooftop pilot verified before wider rollout

The requested one-level pilot covers Roof Rat, Gutter Baron and Tar-Crowned
Crow. Combat hand artwork keeps its proportions; Molt, Retain, discard and Flow
cues use separated slots and readable typography. Renderer/illustration failure
now retains a usable, readable hand with stable art bounds, explicit load states,
in-place recovery and an independently available full-rules reader. Inspection
does not commit cards or allow background turn actions.

The current candidate is `index-CMqM1avE.js`, SHA256
`1DBE0A20FE2C53E653FCE25AA3867C2A187CDA84B514ED7B47CD81E569C145E4`.
All 33 focused cases pass on Chromium/Firefox/WebKit, with no retries or skips
and clean process exit. They cover three screen sizes, authored enemy rosters,
crowded badge states, large hands, discard controls, real enemy turns and fault
recovery. Screenshots and reports: `.artifacts/oct17-verified`; the shared
real-input client capture is `.artifacts/oct17-client`. Build and unchanged hard
bundle/data/asset/cache/docs gates pass. Preferred boot-size targets still warn.

This advances portions of items 11–15, 17, 19, 21, 23–25 and 45. None is checked
globally from a three-battle sample. The total stays **35/60 verified, 25 open**.
Broader presentation coverage and full-flight/release verification remain open;
this pass stays local and does not assert all-A quality or live publication.

### October 16 — Combat grounding and feedback implementation verified

Items 28–29 are verified for their implementation/visual criteria. All 64 enemy
cutouts and five leaders were reviewed at gameplay scale. Source-coordinate
contacts correct floor placement where tails, wings or tools extend past the
feet. Soft contact shadows remain on the stage during breathing/casting poses;
leader shadows no longer sit below their feet. Uniform scaling is preserved and
a restrained cool ambient fill reveals dark enemy feather/workwear detail.
Actual encounter screenshots exposed an optional objective plaque covering
right-side enemy heads. It now occupies the quiet upper-left lane, yielding to
first-flight guidance and enemy actions. Geometry checks include that plaque.

Resonance labels, history and surge feedback now use the actual capped meter
change. A full meter produces a neutral status without a false gain animation.
Coverage includes 24 starting-value/gain pairs in both motion modes, incoming
damage forecast/resolution parity, blocked hits, debuffs, Open Sky, explicit
source aggregation, rejected actions and card-to-impact timing.

Candidate `index-vTW5YUtZ.js` (SHA256
`70C53963ECDC748B4CC3B7859251B2AAF7ED9D9E237FFB3FD8FAD3FFCA367A47`)
completed all 90 test bodies with zero failures, retries, flakes or skips in
Chromium, Firefox and WebKit. This includes all 80 authored encounters and
full-cast layouts at 2560×1600, 1440×900 and 1000×560. Report/captures:
`.artifacts/oct16-combat-closure.json` and `.artifacts/oct16-combat-closure/`.
The required real-input client completed an enemy turn with full artwork and
no pending action or error artifact (`.artifacts/oct16-combat-closure-client`).
High-resolution, ordinary and compact captures were inspected, including
full-cast stage sheets in `.artifacts/oct16-closure-stage-review`.

Qualification limit: after all test bodies completed and browsers exited, one
Playwright worker remained alive during teardown. It was identity-checked and
stopped before the runner emitted its report. Similar stalls occurred on both
Node 20 and Node 24 in earlier runs. Thus these are passing game assertions,
not a clean unattended release-gate pass. Diagnostics and exact cleanup are in
`.artifacts/oct16-worker-cleanup-notes.md`. Items 58–60 remain open, as do the
broader compact/shared-UI and art acceptance criteria; this is not an all-A grade.

Build, documentation, runtime data, 961 runtime-asset budgets, deployment-cache
checks and the existing 56 Minor/22 Aviary canonical frame validators pass.
The two art QA sheet makers now composite alpha before RGB export; their new
regression passes without changing production art. Foreground/HUD bundles are
8,090/10,221 bytes under unchanged caps. Preferred entry/boot targets still warn.

### October 16 — Deeper-menu implementation complete

Item 53 is verified for its named menu scope. Flight Lab now separates sample
hands, deck study and tools; Collection Signals shows one readable category at
a time; Revision Trail exposes every card and metadata change with independent
revision/change navigation; Tuning Bench separates the source portrait from
owned replacement choices. Artwork keeps its proportions and reserved bounds
while loading or unavailable. Card-page shortcuts return to the visible hand,
and revision announcements describe the current comparison rather than reread
the entire deck. Immutable revisions, collection ownership, private data and
active-flight protection are unchanged. The dark theme is preserved.

The broad 75-case Chromium/Firefox/WebKit menu matrix passed with zero retries,
failures or skips on `index-Cas5JsyN.js` (SHA256
`F82EDFF7A43B3A6DDA1AB898CDC22C2A77D7A05E3D90EF8A9043F52B6FDD7A3C`).
It covers fresh/populated Flock views, organizers, identity, starters, notes,
imports, history/save readers and the four newly polished Folio tools.
Reports and screenshots are in `.artifacts/oct16-menus-verified` with matching
`.json` and `.log` reports. An ensuing copy-only correction fixes singular
revision/Folio counts and clarifies count labels. All 21 affected cross-browser
cases pass again without retries or skips on final `index-Bdg3Pk9y.js` (SHA256
`378FF52F1382FDE1F6B4CAEEF19B3A52251EAC76305749B88807FBFE2FDDBB4D`),
in `.artifacts/oct16-menus-copy-final` and its matching reports. The 75-case
report is not relabeled as a run against this later artifact.

Screenshots and measured geometry were reviewed at 2560×1600, 1440×900 and
1000×560. The new tools enforce primary 16px/secondary 14px rendered floors,
44px touch targets, bounded text/art and non-overlapping controls. Coverage
includes 60-card Folios, 29 related revisions, all 62 metadata/card changes,
32-character names, full capacity, empty/unavailable definitions, failed writes,
delayed/failed/recovered art, touch, default/remapped keyboard and virtual
controller input. The shared game client also verifies actual Folios → Lab →
Tools clicks with matching image/text state and no error artifact in
`.artifacts/oct16-menus-copy-client`.

Build, runtime data/assets/world/FX, hard bundle limits and local deployment-cache
checks pass. Preferred boot-size targets still warn. Initial reports retain two
obsolete layout assertions and one invalid art-test fixture; these were corrected,
not bypassed. This closes deeper-menu implementation, not global criteria 11–25,
art production, all menu-state combinations or full release qualification.
The overall plan remains 33/60 verified and 27 open; no all-A claim is made.

Earlier pass records below are historical, including their then-open counts.

### October 16 — Starter Folios, Field Record and private editors

Further partial progress on 53 and shared readability/control criteria. Starter
selection now separates five readable leader choices from ownership and build
requirements. Field Record separates aggregate results and private notes from
five recent exact-match flights. Quiet, isolated code/notes editors retain the
existing dark theme. All four surfaces use larger text and explicit hierarchy;
failed note saves now explain that existing notes are unchanged. Ownership,
card order, revisions, exact-match rules and private share-code exclusions are
preserved. No illustration replacement or gameplay rebalance is part of this pass.

Candidate `index-DFWXdm5H.js` has passing evidence for all 21 distinct focused
Chromium/Firefox/WebKit cases: 12 layout/input matrix cases in
`.artifacts/oct16-starter-final` and nine existing starter, Field Record and
BSF1 regressions in `.artifacts/oct16-starter-regression`, with matching JSON
reports. The initial combined run retained a WebKit timeout: the Tools click
arrived before Phaser registered the newly rendered control. The test helper
now waits for rendered frames before clicking; all nine regressions then pass
without retries or skips. No product assertion or timeout was weakened.
Three additional repetitions of the affected WebKit case also pass; the
stability log is retained in `.artifacts/oct16-starter-stability.log`.
Screenshots were reviewed at 2560×1600, 1440×900 and 1000×560, including empty,
maximum-content, blocked, editing and save-failure states. This is scoped
verification, not full-release qualification.
Build, runtime data/assets, hard bundle limits and local cache checks pass.
Preferred boot-size targets still warn. The shared gameplay client's actual
Folios → starter-picker clicks produce matching image/text state without an
error artifact in `.artifacts/oct16-starter-client`.

The remainder of item 53 includes Flight Lab, Collection Signals, Revision
Trail and Tuning Bench. Items 55–60 and the other global/art criteria remain
open; the ledger stays 32/60 verified, 28 open, not an all-A assessment.

### October 16 — Folio Organizer and Identity

Further partial progress on 53 and shared readability/control criteria. The
Organizer separates folders from strategy labels with readable descriptions,
explicit Set labels and a distinct focus outline. Identity preserves portrait
art proportions, separates card identity/description from four sleeve choices,
and uses padded card surfaces. Both retain readable text and touch targets at
the compact boundary, isolated text editing, clear save-failure feedback and
existing persistence/privacy rules. Cover navigation now advances on the first
tap from the sleeve section without committing the preview.

Final candidate `index-BH7nN44Z.js` passes 12 focused Chromium/Firefox/WebKit
cases with zero retries/skips. Tests cover all three viewports, long text, state
geometry, delayed/failed art and reopen recovery, failed storage writes, editing
ownership and real input paths, alongside existing immutable-copy/backup/share-
code regressions. Final screenshots were visually reviewed at 2560×1600,
1440×900 and 1000×560, including failed-art and editing states. The shared skill
client's actual Folios → Organizer → Identity clicks produce matching image/text
state and no error artifact. Build, data/assets, hard bundle limits and local
cache validation pass; preferred boot-size targets still warn. Evidence lives
under `.artifacts/oct16-folio-final` and `.artifacts/oct16-folio-client-final`,
with the matching JSON report. No prior result is promoted to full-release
evidence, and no release gate was weakened.

The remainder of item 53 includes Flight Lab, Collection Signals, Field Record,
Revision Trail, Tuning Bench, templates, notes and code entry. No global or
release criterion is closed by this scoped work; 32/60 verified, 28 open.

### October 16 — Flight Log and save-data readers

Further partial progress on 53 and the shared readability/control criteria.
Flight Log now separates a seven-flight list from a readable summary and a
direct Review flight action. Paging retains seven records per page, larger
targets and the existing history selection, sharing and full-review behavior.
Save Data uses quiet surfaces, readable backup/restore explanations and a
distinct confirmation preview. Optional local ratings occupy a separate column;
score targets have visible gaps instead of touching. Back restores the parent
focus and retains its close cue. Flock Stats loses a redundant eyebrow and its
input hint meets the compact text floor. The dark theme is unchanged.

Candidate `index-CKGd5mr-.js` passes 16 focused Chromium checks and six
Firefox/WebKit checks without retries/skips. Coverage includes empty and
50-flight histories, save/invalid/restore/rating states at all three supported
viewports, measured text floors/target sizes/separation, actual touch closing,
focus restoration and unchanged history storage. Existing regressions verify
backup download, invalid-file rejection, transactional restore, local rating
export, history review/sharing, combat history and Flock Stats input ownership.
The shared gameplay client opens Save Data through an actual pointer click,
with matching image/text state and no error artifact. Build, data/assets,
hard bundle limits and local deployment-cache checks pass; preferred boot-size
targets still warn. No balance, timing, artwork or dependency changes.

Evidence: `.artifacts/oct16-record-results`, `.artifacts/oct16-record-matrix`
and `.artifacts/oct16-record-client-final`, with the matching JSON reports.
Six additional layout cases pass across all three browser engines after
waiting for the opening fade to finish: 90 state/viewport captures under
`.artifacts/oct16-record-layout-final`. Final layouts were visually reviewed
at 2560×1600, 1440×900 and 1000×560. Documentation and whitespace checks pass.
These scoped checks do not establish full-regression or all-A qualification.

Item 53 remains open: the advanced Folio Organizer, Identity, Flight Lab,
Collection Signals, Field Record, Revision Trail, Tuning Bench, templates and
code-entry screens still need the same readability and interaction treatment.
No global typography/control or full-release criterion is closed by these
focused changes. Status remains 32/60 verified, 28 open.

### October 16 — actionable combat HUD

Item 26 verified; further partial progress on 11, 15 and 21. Cohesion, Cover,
Wingbeats, Flow and the Roost forecast take priority over inventory counts.
Labels/counts now retain readable CSS sizes at the compact boundary; activated
suit bonuses use quiet proportional surfaces. The Roost action and consequence
occupy separate rows, and its enemy-turn state has no action handler. Phase,
move and Hustle feedback use a readable right-side strip with measured explicit
move excerpts. Optional goals yield to enemy resolution and return on the
player turn. First-flight guidance uses concise sentence case in open space
away from the opening enemy silhouette. Full objective detail remains available.

Candidate `index-gTdOy51e.js` is verified with six combat layout/interaction
tests and four existing guidance/timing regressions, zero retries/skips.
Coverage includes seven turn states at 2560×1600, 1440×900 and 1000×560,
24 goal/status strings, zero energy, high resource counts, all four suit bonuses,
long move names, selection forecasts, normal/boss encounters and one-to-four
enemy clusters. The shared gameplay client performs a real Roost click and
returns to Beat 2, 32/38 Cohesion and 3 Wingbeats with matching image/text state.
Screenshots were visually reviewed at all three viewport sizes.

Build, runtime/assets/world/FX, unchanged hard bundle caps, local cache and
whitespace checks pass. The renderer is 10,211 bytes against its 10,240-byte
limit; preferred entry/combined-boot targets still warn. No balance, timing,
preload boundary or generated artwork was changed. Evidence lives under
`.artifacts/oct16-combat-hud-results`, `.artifacts/oct16-combat-smoke-results`
and `.artifacts/oct16-combat-client-final` (plus their JSON reports). This is
scoped combat evidence, not full-suite, cross-browser or all-A qualification.

### October 16 — reward review readability

Further partial progress on 11, 15 and 21. Reward review uses the shared
21px primary / 19px secondary text sizes for consequences, projected changes,
selection names, confirmation controls and reader labels. A single readable
heading replaces the tiny category eyebrow and redundant instruction paragraph;
expanded input hints and repositioned build advice prevent text collisions.
Long summaries remain explicitly abbreviated and complete in the reader.
The existing dark theme, illustrations, deterministic card frames, transaction
semantics and hard bundle limits are preserved. This does not close typography
across the entire game.

Final candidate `index-C_sMyOTy.js`: 33/33 Chromium regression cases and 4/4
Firefox/WebKit recovery checks pass, zero retries/skips. All 168 event options
are revalidated across 504 state fixtures, including repeated zero-effect exits.
The Waymark/Supply catalogs, complete long text, preserved armed selections,
modal ownership and all four input paths pass. Six visual fixtures cover plain,
mixed, card, Supply, Waymark and no-reward reviews at 2560×1600, 1440×900 and
1000×560; screenshots and the shared client's real Inspect action were reviewed.
Build, runtime/assets, docs, unchanged hard bundle limits and local cache checks
pass. Evidence: `.artifacts/oct16-reward-readability-results.json`,
`.artifacts/oct16-reward-readability-results`, `.artifacts/oct16-reward-client`.
Owned preview/test resources are closed and port 5490 released. This is focused
verification, not full-release qualification; 29 acceptance items remain open.

### October 16 — event outcomes and recovery input isolation

Item 50 verified on `index-Cykjfzi9.js`. The authored-choice matrix covers all
38 Signals plus Basin, Nest and Cache: 168 distinct options across 504 funded,
poor and full-inventory fixtures. Every option is exercised while available;
38 unavailable cases preserve resources. The 340 preview/cancel/commit cases
match authoritative projected state, with 44 picker rollbacks. This matrix
retains real transactions while isolating rendering and scene scheduling;
separate real UI journeys confirm service outcomes, reload persistence and
Rival decline/challenge transitions. It does not enumerate every random reward
combination or constitute a complete-game balance test.

Fixed a reproduced native recovery-panel click-through that could select a
Basin option beneath Reload options and replace the saved checkpoint. Pointer,
mouse, touch and keyboard events now stay within the native panel without
preventing its controls. The reward module's loading/failure surface has
readable text, a touch-sized Close and accurate confirmed-reload guidance.
Cancellation preserves resources; late code cannot reopen the abandoned review.

Final scoped regression: 24/24 Chromium cases and 4/4 focused Firefox/WebKit
recovery cases pass, zero retries. The former includes all 38 Signal reading
fixtures, remapped navigation and nine shared deck-browser cases. Screenshots
were reviewed at 2560×1600, 1440×900 and 1000×560; the unchanged shared gameplay
client performed a real Close with matching screenshot/text state. Build,
runtime/assets, documentation, unchanged hard bundle limits and local cache
checks pass. Evidence: `.artifacts/oct16-event-outcomes-results.json`,
`.artifacts/oct16-event-recovery-browsers-results.json`,
`.artifacts/oct16-event-client`. Wider typography, art and release checks remain
open; this closes event lifecycle acceptance, not every visual surface or all A.

### October 16 — deck browser hierarchy, touch controls and saving

Further partial progress on 11–12, 14–15, 21–25, 53, 55 and 57. The route
deck browser now shows six spaced rows instead of seven touching rows, with
21px primary / 19px secondary stage text and shared quiet controls. At the
1000×560 minimum viewport, primary/secondary CSS floors remain 16/14px and
interactive targets meet 44×44 CSS pixels. Long row names explicitly indicate
omission; the full query stays available below the toolbar. Pin/Unpin, scroll,
selection and save states remain distinct without adding decorative assets.

Folio saving has explicit loading, saved, full and retry states. Repeated input
during lazy loading coalesces into one save; closing/reopening or restarting
the route invalidates pending intent. Storage failure does not report success,
and retry/capacity/archive preservation are covered. Retained controls cannot
act behind pause or Settings. Delayed/failed reader modules retain a readable
touch exit; failed imports direct the player to the existing confirmed reload
recovery, which preserves the saved checkpoint. Reopening the same failed
import was experimentally insufficient and is no longer suggested.

Candidate `index-CsRPilbq.js` preserves all hard bundle limits; preferred boot
targets remain open. This scoped implementation does not close shared UI,
all deep menus, every card presentation or the whole-game acceptance matrix.
The ledger remains 30/60 verified. Final test and visual evidence is recorded
in the matching progress entry; no all-A or fresh full-release claim is made.

### October 16 — deck portrait continuity and reader text

Partial progress on items 11, 19, 25 and 45; no global item is closed by one
surface. Detail/comparison portraits now occupy stable reserved slots and load
without rebuilding paging controls. Missing art has a readable unavailable
state and reopening retries it. Existing compact art is retained when available;
image fitting preserves source proportions. Closing a reader prevents late art
from restoring its objects. The underlying dark bird-city art is unchanged.

Primary detail/comparison reading text is at least 21 stage pixels; secondary
labels are 19. Long rules still paginate rather than shrink. Comparison paging
now respects pause, Settings and search ownership like the detail reader.
Candidate `index-CtDVA92k.js`: 18/18 focused tests pass with zero retries.
Complete long-rule/bonus content, stable portrait bounds and control identity,
failure/reopen recovery, closure safety, text floors and modal ownership are
verified. High-resolution, normal and compact screenshots were inspected;
the unchanged shared game client completed two real paging actions. Build,
runtime/assets, docs, hard bundle limits and local cache checks pass. Evidence
is recorded in the October 16 progress entry. Preferred boot-size warnings remain.
The wider compact menu controls, other card presentations, whole-game art
review and full release regression remain open; this is not an all-A claim.

### October 7 — map inspection

October 7 candidate `index-DvBUtnbY.js`: item 32 verified. A quiet read-only
map dossier pairs the existing node icon with its type, encounter title,
availability, complete gains and risks. Future/current/completed stops are
directly inspectable by pointer or emulated touch; the Inspect control reaches
every stop with pointer, touch, remapped keyboard or virtual controller.
I opens the reader, reserved F2 remains available when I is remapped, and LB
opens it on controller. Previous/Next navigation and paginated long details
never change the selected destination, spend resources or commit travel.

Final-build regression: 17/17 map, boss-preparation and route-state cases pass,
zero retries, in 4.9 minutes. Four deterministic district fixtures contain all
eight node types; every stop is inspected at 2560×1600, 1440×900 and 1000×560.
Geometry checks enforce 16px primary / 14px secondary rendered text, 44px
targets, contained text and clearance from node/Collection hitboxes. Also
verified current/completed states, long content, remapped I/F2, reduced motion,
pause ownership, held-confirm protection, listener cleanup, delayed/failed
module handling, and an explicitly reopened reader after scene restart.

High-resolution, ordinary and compact screenshots were visually reviewed.
In-app inspection caught and corrected an entry-control overlap with Collection;
the final in-app check confirms the fix. The unchanged shared game client
completed two navigation bursts with matching screenshot/text state and no
browser-error artifact. Evidence: `.artifacts/oct7-map-inspection-verified-results`,
`.artifacts/oct7-map-inspection-verified-results.json`,
`.artifacts/oct7-map-inspection-clearance-client`.

All static stages of `npm run validate` pass, with sequencing explicitly scoped
to four additional smoke cases: combat-art recovery, delayed route art and
Collection shortcut return via pointer/keyboard/controller in two districts.
All four pass. `npm test` was explicitly scoped to the 17-case configuration;
these 21 passes are not a full release regression. Existing hard bundle caps
remain unchanged; the lazy inspector is 4.2 KiB with a new 5 KiB cap. Preferred
boot-size warnings remain: 684.6 KiB entry / 724.5 KiB combined. The scoped node
inspection assessment is A. Global layout/art/deeper-menu/release items remain
open. No commit, push or publication was performed.
Owned preview/test resources and the in-app tab were closed; port 5490 is released.

## Earlier verified passes

October 7 candidate `index-Pm0rmXMC.js`: items 51 and 52 verified. Title actions
now use the shared quiet-button hierarchy, 21px primary text and 58px targets.
Setup primary headings/labels meet the 16px rendered CSS floor at 1000×560;
secondary text remains above 14px. The existing dark bird-city art is preserved.

Leader inspection is separate from selection. Pointer, emulated touch, remapped
keyboard and polled virtual-controller input reach all five leaders, including
locked requirements, without selecting a locked leader. The focus outline tracks
the inspected card while the selection fill remains on the playable leader.
Accessible narration includes the complete requirement. A persistent summary
states the selected leader, tier and flight length; saved-flight Continue
preserves the saved run, while Start New Run honors the displayed new-flight
choices. Obscured title launch/selection/mode/difficulty callbacks are guarded.

Final-build regression: 24/24 passed, zero retries, in 3.4 minutes. Includes the
existing Flock/shared-control, resident, Market navigation and map checks;
fresh/saved title, all leaders locked/unlocked, maximum Ascension, all four input
paths, reduced motion, failed/delayed portraits and a failed optional setup
module. Portrait bounds stay reserved and proportionate, and late portraits
cannot reappear over home. Fresh high-resolution and compact screenshots were
visually reviewed at 2560×1600, 1440×900 and 1000×560. The unchanged shared client
completed two navigation/inspection iterations with matching text state and no
browser-error artifact. Evidence: `.artifacts/oct7-title-results`,
`.artifacts/oct7-title-results.json`, `.artifacts/oct7-title-client`.

Build, runtime data/assets, world/FX, documentation, unchanged hard bundle limits
and local cache validation pass. Preferred boot-size warnings remain (681.8 KiB
entry / 721.6 KiB combined). Scoped title-control and setup assessments are A;
this does not close deeper menus, global typography/input matrices, full-release
qualification or the all-game grade. Owned preview/test resources were stopped
and port 5490 released. No commit, push or publication was performed.

October 7 candidate `index-CiqaJLz7.js`: items 46 and 48 verified. The single
event header pairs resident identity with the situation before any choice is
made. All 38 authored Signal titles/prompts fit without omission; short bird-led
context describes the other stops. Full context, species and exact consequences
remain in Read. A deliberately oversized future narrative receives an explicit
ellipsis in the header and remains complete in the paginated reader.

Removed free-floating procedural glows/streaks, duplicate Roost edge rules,
the cabinet highlight and geometric prop substitutes. Missing decorative prop
textures leave the scene visible without moving options or changing run state.
This does not close the wider art-loading/recovery items 19 and 45.

Final-build regression: 14/14 passed, zero retries: three event cases, three
Market transaction cases and eight reward-decision cases. The event catalog
audit verifies 38 Signal contexts and 152 complete choice reads. Coverage also
includes all five event scenes at 2560×1600, 1440×900 and 1000×560, measured text
floors and containment, missing/restored props, pointer, emulated touch, remapped
keyboard, virtual controller, long text, unavailable choices, modal ownership,
held-input guards, cancellation, and preservation of armed card/Supply choices.
Screenshots were inspected at high resolution and compact sizes. The unchanged
shared client completed two pointer Read/return iterations without browser errors.
Evidence: `.artifacts/oct7-events-final-results`,
`.artifacts/oct7-events-final-results.json`, `.artifacts/oct7-events-final-client`.

Build, runtime data/assets, world/FX, documentation, unchanged hard bundle limits
and local cache validation pass. Preferred boot-size warnings remain (680.0 KiB
entry / 719.8 KiB combined). Scoped event context and decorative restraint assess
as A; this is not a grade for every event outcome or the full game. The final
test preview and owned test processes were stopped; no publication was attempted.

October 7 candidate `index--1iBQF3o.js`: items 36 and 39 verified. One permanent
transaction rail presents inspection/selection state, price, available Scrap,
authoritative projected balance, purchase action and blockers alongside the full
effect reader. Targeting remains visible when an offer is unavailable. Pointer
and emulated touch select before confirming; subsequent stock must be selected
again. Keyboard/controller explicit confirmation, Clear/Close, target pickers,
pause ownership and sold stock retain their separate behavior.

All 15 focused Market cases pass (three new, 12 existing), zero retries. Coverage
includes all four shelves at 2560×1600, 1440×900 and 1000×560; measured primary
and secondary text floors, 44px action targets, containment and non-overlap;
full rules and long names; remapped keyboard, virtual controller and touch;
unaffordable, full-pouch, no-eligible-card and sold states; exact preview/commit
parity; Preen/Release cancellation and route-commit guards. Final screenshots
were visually reviewed, including high-resolution cards and compact services
and sold stock. Evidence: `.artifacts/oct7-market-results`,
`.artifacts/oct7-market-regression.json`, `.artifacts/oct7-market-final-client`.
The unchanged shared client exercises actual pointer purchase and reports no
browser errors. Build, data/assets, world/FX, documentation, hard bundle budgets
and local cache checks pass; preferred boot-size warnings remain.

The scoped Market decision and transaction-state assessment is A. This is not
an all-game or full-release grade. Item 44 remains open: strict canonical pixel
validation passes 56 Minor and 22 Aviary masters, but does not yet establish
equivalent evidence for 22 Major and 10 Snag cards.

October 7 candidate `index-C6Z9oc3G.js`: item 35 verified. A quiet footer names
the boss, signals the phase change and opens a read-only Threat / Strategy /
Readiness dossier. It replaces the tiny, ornate preparation cluster without
discarding its information. Shared 21px/19px text, full authored strategy,
plain-language pressures and explicit coverage thresholds remain legible at
2560×1600, 1440×900 and 1000×560. All four bosses and all three dossier pages
pass CSS text-floor, target-size, containment and non-overlap checks; screenshots
were visually inspected. The Flyway strip no longer draws over the reader.

Six new preparation tests pass: the complete visual/content matrix, remapped
keyboard and virtual controller lifecycle, save-failure retry separation,
reachable-only advice, long shortcut labels, and delayed module close/reopen.
Real pointer and emulated touch are exercised; inspection retains exact run
state and selection, never commits travel, and cleans input listeners on close.
The repeated three-cycle input test has a 90-second overall budget after a
trace showed continuous successful progress beyond its initial 30-second
default; no assertion, cycle, existing release gate or product limit was removed.
All ten focused boss/route/Flock cases and the 15 save/recovery cases pass on
this build, zero retries. Evidence is in
`.artifacts/oct7-boss-results`, `.artifacts/oct7-storage-results.json` and the
required unchanged shared client's `.artifacts/oct7-boss-final-client`.

Build, runtime data/assets, documentation, unchanged hard bundle budgets and
local deployment-cache policy pass. Preferred boot-size warnings remain. This
closes boss preparation only, not the global visual/input matrix, full regression
or all-A release qualification. The remaining 37 items retain their scope.

October 7 candidate `index-B2Sr5rnU.js`: item 54 verified. All 16 Settings rows
have focused explanations, immediate-application guidance and per-preference
session-only warnings after failed persistence. Controls remapping and reset
report failed writes instead of claiming a saved change. Successful retries
clear the matching warning; a different setting's failed write stays visible.
Disposable practice writes do not overwrite durable-storage outcomes. Reduced
Motion explicitly explains why chosen shake/flash preferences are overridden.
The live region announces these explanations and Controls focus/page/status.

Settings/Controls labels use shared 21px primary and 19px secondary authored
text. Tests measure actual CSS floors, 44px row targets, label/value separation,
containment and non-overlap at 2560×1600, 1440×900 and 1000×560. The captured
screens were visually inspected; the quiet dark palette and existing theme are
preserved. Eleven focused Settings/storage-feedback tests, 15 save/recovery
tests and four shared Help/Pause tests pass without retries on this candidate.
Reports: `.artifacts/oct7-settings-results.json`,
`.artifacts/oct7-storage-results.json`, `.artifacts/oct7-shared-controls-results.json`.
The Settings test's tab navigation was corrected to cycle from its actual state
before asserting the destination; no product gate or timeout was weakened.
The required shared browser client completed two iterations; its final image
and full text state agree and no error artifact was emitted
(`.artifacts/oct7-final-settings-client`).

TypeScript/build, runtime data/assets, docs, bundle and local cache checks pass.
Existing preferred boot-size warnings remain; hard budgets are unchanged.
This is scoped acceptance, not a fresh full regression, release qualification,
all-screen typography closure, or an all-A grade. Item 35 boss preparation still
needs its complete readable presentation; source investigation did not change it.

October 2 candidate `index-DEN5Me_l.js`: seven Flock/control/save tests and three
map tests pass, zero retries. The map matrix covers all four districts at
2560×1600, 1440×900 and 1000×560. Current location has a white ring and `Here`
label, distinct from completed checks, selected label/focus, available rings/
arrows and future nodes. Pointer, emulated touch and keyboard destination changes
retain exactly one authoritative gain/risk summary and do not change run state.
Replacing inspection tooltips retires the previous root and input listener.
Evidence: `.artifacts/oct2-ui-results.json` and `.artifacts/oct2-route-results.json`.

All five event residents were reviewed in their environments at the three
supported sizes. The strengthened event-clarity case passes loaded-art,
proportional scaling, on-stage bounds, floor-shadow grounding, and resident/
choice-panel/title clearances. Evidence: `.artifacts/oct2-event-staging-results.json`.
This verifies item 49 for the current five authored resident compositions, not
the separate entire-cast anatomy/lighting inventory or delayed-art recovery.
Event and Flock primary controls use 21px authored text; event consequences and
secondary reader text use 19px. Dense summaries disclose omissions and retain
complete read-only details. Typography elsewhere remains item 11 work.
Build, runtime data/assets, documentation, local cache policy and unchanged
bundle budgets pass. The route renderer remains below its original 5 KiB cap
after removing unused column guides. Preferred boot-size targets still warn.
The 21-case shared-reader suite also passes, zero retries, in 13.1 minutes
(`.artifacts/oct2-events-results.json`). Item 47 is verified by the complete
38-Signal / 152-choice reading audit and exact before/after consequence previews,
including mixed rewards, costs, Snags, card/Supply choices and cancellation.
Default/remapped keyboard, virtual controller, held-input guards, complete
read-only paging and pause/settings ownership pass. This closes consequence
presentation, not the exhaustive every-outcome/reload criterion in item 50.
There are 31 distinct focused tests on this build, plus the strengthened event
staging rerun. Required real-input browser clients reach Flock → Badges and a
committed combat card with matching screenshots/text and no error artifacts
(`.artifacts/oct2-final-profile-client`, `.artifacts/oct2-final-flight-client`).
None of this is a fresh full-suite or all-A release claim. Remaining work includes
the small boss-preparation footer typography, broader Settings/dossier font and
layout adoption, every-input future-node inspection, the full art review and
release qualification; those items have not been silently waived.

Production candidate `index-BxCl7gnd.js` passes the combined 61-case
affected-flow suite, zero retries, in 12.1 minutes
(`.artifacts/a-quality-complete-pass-results.json`). This includes all nine
Collection cases, combat presentation/input, Market readers, setup recovery,
map hierarchy and six legacy combat regressions. The delayed-art continuity
case also passes three consecutive repetitions. Current Collection, map,
Market, boss/crowded combat and large-hand captures were inspected at the
supported resolutions; broad compact typography remains open. The large-hand
fixture is additionally being qualified with the normal artwork-loading path,
after visual review caught that direct fixture insertion bypassed draw-time
loading. Both strengthened large-hand cases passed on that candidate. A later
catalog screenshot exposed an elite crest overlapping the HUD: candidate
`index-ehLrDjjq.js` moves rank into the measured enemy-label stack and reserves
space for elite objectives too. Its follow-up passes all four catalogue tests:
80 encounters, 240 captures, with loaded art, live target controls and measured
panel/art clearances. The 12-case run finished 11/12: a worker retained the old
standalone-intent gap assertion. A fresh three-case rerun passes the corrected
containment/name-clearance assertion, elite mechanics, and the expanded 36-layout
normal/elite/boss matrix including elite objective targets, zero retries.
Evidence: `.artifacts/a-quality-catalog-results.json` and
`.artifacts/a-quality-elite-objective-results.json`. The earlier 61-case result
is not promoted to an exact-build full pass.
This focused work does not replace fresh full-suite qualification.
The required shared browser client was rerun on `index-ehLrDjjq.js`: title →
Collection → optional tools and title → route → combat → actual card commitment.
Screenshots and text state agree; the combat ends with 2 Wingbeats, 22/27 enemy
HP, no pending animation and full art ready. Neither client emitted an error
artifact (`.artifacts/a-quality-complete-collection-client` and
`.artifacts/a-quality-complete-combat-client`). Build, runtime, bundle, docs and
local cache gates pass. Owned test runners completed and the final preview was
stopped; port 5489 and canonical-art staging are clear. Existing unrelated
services were preserved.
Item 28 remains open: preventing label collisions is not sufficient evidence of
consistent visual scale, contact shadows and lighting across the entire cast.
In particular, compact back-row elites need a broader staging pass rather than
being graded A merely because their silhouettes fit the reserved label bounds.

Candidate `index-qHuAh71-.js` passes 46 affected-flow tests and six legacy combat
regressions, with zero retries. Evidence is `.artifacts/a-quality-qualified-results.json`
and `.artifacts/a-quality-smoke-results.json`. Item 05 now includes all 1,320
card/state/viewport layouts and a 17-card hand: all four pages, remapped keyboard,
virtual controller, pointer selection and actual later-page commitment, Retain,
discard selection, overlay ownership, and shrinking the hand back to one page.
Cards keep full-size text rather than compressing into overlapping strips.

Item 27 covers one through four normal/boss enemies at all three viewport sizes,
with complete status labels, measured panel/art clearances, intent meaning and
forecast containment. Item 30 covers all pacing combinations in the card-motion
matrix, impacts after cast retirement, and repeated two-enemy turns at 1,860ms
normal / 1,450ms reduced motion in the deterministic game clock. These are timing
and cleanup checks, not wall-clock frame-rate or physical-device performance claims.
Current compact, desktop and high-resolution captures were inspected. The required
real-input browser client completed a card play with matching image/text state,
all art ready and no error artifact (`.artifacts/a-quality-qualified-client`).
Item 31 uses stronger future/secondary paths with measured node hierarchy and
reviewed compact, desktop and high-resolution map captures. The route hierarchy
test also passed in the broader run; this does not close every map/input criterion.
The 630-case full regression was interrupted after 67 passes to address Collection
asset-arrival input continuity. It is not a full-suite pass.

The failed remote run 36297889787 was inspected directly: 41 failures comprise
27 timeout/closed-page failures and 14 assertion/runtime failures. It is not valid
to label all 41 as infrastructure problems. Market whitespace assertions and
toolbar geometry have focused passing evidence; the remaining failures still
require reconciliation and a fresh full run. No remote release was triggered.

Follow-on composition evidence: 40 is verified by the named vendor portrait,
uniform texture scaling and measured header clearances, stronger scenic scrim,
and successful Market screenshots at 2560×1600, 1440×900 and 1000×560. The
27-case candidate `index-e-mBFcp-.js` passed without retries, including Market,
setup, map, combat stage, history and the 1,320 card/state/viewport layouts.
Evidence is `.artifacts/a-quality-final-results.json`. Large-hand pagination and
additional combat-lane corrections are qualified in the later candidate above.
Broader compact typography remains open.

`npm run validate:canonical-card-art` additionally passed the exact 56 Minor and
22 Aviary source masters selected by the runtime manifest, using the existing
strict composite validators and cleaning its disposable copies. This closes a
source-selection validation gap; it is not an in-context review of every image.

Verified 01–04, 06–10, 16 and 37–38. Combat effect data and resolution are
unchanged. Long hand rules now retain complete leading effect clauses or direct
the player to inspection; omitted effects are counted explicitly. The entire
ordered readable rule list remains available in diagnostics and the full reader.
Collection tools collapse without changing shelf geometry or browse state.
Existing shortcuts reveal the relevant tools so restored focus stays visible.
Undiscovered cards do not expose names or effects. Dossiers connect the canonical
illustration title to the gameplay name from the existing art metadata.

Evidence: current production candidate `index-DfC_SCMa.js`, 24/24 affected-flow
tests, zero retries (`.artifacts/readability-qualified-results.json`). An earlier
candidate `index-yp0DK2Mf.js` passed a broader 41-case affected-flow run; keep
that historical evidence separate (`.artifacts/readability-final-results.json`). The full card
pool covers 110 cards × four states × three viewports = 1,320 measured layouts.
At that earlier checkpoint, item 05 still needed the large-hand presentation criterion.
Summary conditions were checked against live engine predicates (including
half-health inclusivity, spent/no Resonance and previous-hit defeat); pure
formatter cases guard order, targets, spending and explicit omission.

Collection evidence covers pointer, remapped keyboard, virtual controller,
touch-size geometry, saved views, sorting, search, favorites, Hunt List, private
journals and return context. Injected artwork failures stop retrying during
redraw and recover through the visible retry action. The default shelf, expanded
tools and hand were reviewed at 2560×1600, 1440×900 and 1000×560. Dossiers retain
complete rules and identity text; this does not close cross-surface identity 17.

Market sections are directly selectable through pointer, Home/End and LT/RT;
remapped controls and modal input ownership pass without changing or arming a
purchase. Long primary effects can still require paging, so 36 remains open.
The keyboard hint now occupies a single footer row below the paging controls;
tests measure its separation and containment, not only its panel bounds.

The required shared browser client exercised title -> Collection -> tools and
title -> route -> combat -> card resolution. Its captured images and text agree,
and no error artifact was emitted. The in-app Browser rejected localhost; the
created blank tab was closed. Broad validation and release gates remain separate.
The current candidate's real-input combat capture is in
`.artifacts/readability-final-client`; card resolution completed, with matching
image/text state and no error artifact. Current Market footer captures were
inspected at compact and high resolution.

Qualification limits: the broader validation ran 74/75 before a stale pagination
fixture was corrected and passed in the focused run. Full regression stopped
after 35 passes and one combined-journey timeout (590 cases not run). Its two
independent journeys are now separate tests with all assertions and the same
30-second limit retained, and all four variants pass. Neither result is a fresh
full-suite pass. Collection title/art clicking also failed intermittently in an
earlier mixed run. A delayed-art regression subsequently reproduced registered
tile replacement: both card-art and decorative UI arrival could rebuild the grid
under the pointer. The current implementation refreshes artwork in place and
retains that grid when decorative chrome arrives. Identity, hover, input
registration, browse state and real pointer opening pass three consecutive
runs; locked-card medallions are also required to replace their temporary fallback.
This resolves that reproduced cause, not every earlier remote failure.
Firefox/WebKit completed four toolbar test bodies,
but their runner required owned-worker cleanup during shutdown; do not count
that as clean unattended cross-browser qualification. These remain item 58 work.

The existing 9/44 completions remain historical evidence in the earlier ledger;
they are not automatically equivalent to the wider acceptance criteria here.


### October 22 — Item 56: final visual matrix complete

The production visual matrix is complete: 186 inspected captures at 2560×1600,
1440×900 and 1000×560, indexed with exact candidate, dimensions and SHA-256 in
`visual-review-2026-10-22.json`. The named family/state mapping is in
`final-state-coverage-2026-10-22.md`. Rejected fade/Practice-overlap attempts
were replaced, and subsequent picker/Waymark changes have explicit replacement
captures. Final live pointer victory/replay supplies the three-size victory
screen review; natural defeat/replay is also verified. Current candidate is
`index-Cl7N8-97.js`. All 872 delivered artwork files remain byte-identical to
the reviewed inventory. No unresolved actionable visual defect was found in
this scoped review. Full regression and remaining release qualification stay
open. Total: 55/60 verified, five open.


### October 22 — Item 55: menu state coverage complete

All seven named menu data states are exercised and mapped in
`final-state-coverage-2026-10-22.md`: fresh, populated, long, saved, corrupt,
empty and maximum/restored. The record matrix uses zero/50 flights, 30 Folios,
60 cards per Folio and maximum text lengths, with real export, replacement,
filechooser import, confirmation and reload before three-size inspection.
Dedicated state tests pass in discovery; corrected current focus/geometry
fixtures have passing focused rechecks, indexed in the final qualification
report. The subsequent production deltas are individually reviewed and do not
change these save semantics. Fresh full regression remains a separate open
item; discovery is not represented as a release pass. Total: 56/60 verified,
four open (57–60).


### October 22 — Item 57: input and resilience qualification

Verified across the dedicated input/failure/focus matrix and final Cl7N8-97
journeys. All four live reference flights pass: natural keyboard defeat/replay,
keyboard victory with pointer targeting, pointer-only victory/replay and virtual
controller-only victory/replay. Final cross-browser checks pass 9/9 in Chromium,
Firefox and WebKit. Emulated touch, remapped keys, reduced motion, held-input
rejection, late/failed art/modules and native/modal focus ownership retain their
dedicated passing checks and focused failure reconciliations. The shared client
also completes a real card play with matching image/state and no error artifact.
See `final-qualification-2026-10-22.md`; no physical-controller, touch-device or
human AT claim is made. The fresh uninterrupted 903-case suite is running and
remains a separate open gate. Total: 57/60 verified; items 58–60 remain open.

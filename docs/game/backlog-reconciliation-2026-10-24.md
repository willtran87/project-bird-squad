# Backlog reconciliation — October 24, 2026

This is the current disposition of the original 52 enhancements and the later
70-package index. Older dated checkpoints remain historical evidence. They do
not describe the current release. The 60-item visual acceptance plan and the
18-item Flyway expansion are complete within their documented scope.

Status: actionable implementation work completed and local failures reconciled.
The final-source GitHub workflow is the required publication gate; see release
qualification below and the linked evidence report.

## Work completed in this pass

- Added optional Preen and deck-shaping practice using real route inspection,
  selection and confirmation, with disposable storage and saved-flight checks.
- Added numerical before/after draw comparisons to complete decision readers.
  The uniform sample benchmark explicitly excludes protected opening draws,
  Retain and temporary effects; it does not promise a particular next hand.
- Deferred shared HUD/guidance and route transition presentation until needed.
  Failed renderer downloads retain clickable status/inspection controls.
- Removed WebGL backbuffer multisampling while retaining texture antialiasing,
  trilinear filtering and high-resolution text; measured before and after.
- Retired reduced-motion district flourish objects without requiring a redraw.
- Kept the complete boss breathing animation below the HUD, including its
  maximum vertical stretch; added a deterministic full-cycle regression.
- Added 15 strategy scenarios: five Leaders × lean/wide/Molt decks, each against
  an opening, rival and boss fixture. These use real rules and a bounded policy,
  with explicit fixture decks; they do not represent naturally acquired runs.
- Added repeated warm scene-transition checks for objects, textures, listeners
  and timers. Full seeded campaigns and live-control journeys remain required.
- Ran authored balance/content and 1,000-seed economy audits. No speculative
  stat changes are justified merely by different outcomes between policies.
  All 45 strategy battles resolved: opening 2–3 turns, rival 2, boss 4–7.
  All district economy targets passed; content checks found no drift or pending
  items. GitHub had no open issues or pull requests when reconciliation began.

## Original 52 enhancements

“Implemented” describes observable product behavior. “Audited” describes the
bounded automated evidence, not a claim of universally optimal balance or fun.
Test filenames below refer to `tests/` unless otherwise stated.

| ID | Disposition | Current implementation / verification |
| --- | --- | --- |
| 1 | Implemented | Complete-loop guide plus live Cover/Flow/Molt/Preen/Release lessons; `practice-lessons`, `backlog-closure` |
| 2 | Implemented | Optional decision lessons use live rules and protect saves |
| 3 | Implemented | Contextual first-flight/Molt guide, dismissible inspection and shared glossary; `smoke`, `practice-lessons` |
| 4 | Implemented | Continue shows actual checkpoint/build/recovery context; `menu-resume-context` |
| 5 | Implemented | Base-hand/stat deltas and explicit quantitative draw comparison; `draw-comparison.test.mjs`, `backlog-closure` |
| 6 | Implemented | Build observations include suit engines, costs, recovery and Waymark triggers; `smoke`, `reward-review-readability` |
| 7 | Implemented | Benefits retain cautions; full readers distinguish conditional effects and draw assumptions |
| 8 | Verified | Flight Lab shares the live hand rule, legal budgets and bounded pages; `smoke` |
| 9 | Verified | Owned Folios launch isolated playable practice; `practice` |
| 10 | Audited | Lean/wide/Molt strategy matrix plus seeded campaigns; outcomes retained, no universal balance claim |
| 11 | Audited | Bounded real-rule decisions and interactive sequences terminate in strategy/campaign coverage |
| 12 | Implemented | Defeat/history explains observed events and recovery; `flight-report-reading`, `reference-flight-controls` |
| 13 | Audited | Three distinct plans per Leader have reproducible opening/rival/boss measurements |
| 14 | Audited | Card contributions recorded in strategy decisions; canonical rule/catalog checks retained |
| 15 | Audited | Common-card-heavy fixtures exercised at opening and later stages without rarity substitutions |
| 16 | Implemented | Canonical upgrades plus six explicit Shelter/Flight branches; `flyway-expansion`, `flyway-rules.test.mjs` |
| 17 | Implemented/audited | Complementary drafts, Release/Preen/services, Supplies and route choices; seeded progression |
| 18 | Implemented/audited | Structured drafts with wildcard/complement rules; `smoke`, content/economy audits |
| 19 | Verified | Full authored encounter catalog and multi-enemy sequencing/preview cases; `p0-encounter-catalog`, `enemy-intent-clarity` |
| 20 | Verified | Previewed phases and disclosed boss disruptions; `flyway-expansion`, `enemy-cadence`, `smoke` |
| 21 | Audited | Distinct strategy fixtures reach authored later threats; 45 battles resolved without loops or defeats using a bounded policy |
| 22 | Implemented | Current risk, recovery, deck and economy context; `route-decision-polish`, `boss-prep-reading` |
| 23 | Audited | Exact service/merchandise costs and 1,000-seed opportunity measurement; `market-transaction-polish` |
| 24 | Verified | Full Supply rules, timing, ownership and explicit use; `smoke`, `run-progression-journey` |
| 25 | Implemented | Resident contributions, rival adaptation and district consequences; `flyway-expansion` |
| 26 | Audited | Route safety, rewards and bounded fight durations across fixtures/campaigns; economy audit |
| 27 | Verified | Grouped Settings with mapped input and cleanup; `shared-control-contract`, `smoke` |
| 28 | Verified | Complete measured readers at three supported sizes; 60-item visual acceptance |
| 29 | Verified | Inspect/select/commit remain distinct across decision surfaces; `reference-input-paths` |
| 30 | Verified | Canonical glossary, contextual definitions and semantic icons; `smoke`, Codex reading suites |
| 31 | Verified | Collection/flight/temporary scope is explicit in readers; reward/checkpoint and practice suites |
| 32 | Verified | Bounded result lanes plus complete ordered history; `smoke`, Flyway FX coverage |
| 33 | Verified | Live hints follow pointer, keyboard mappings and controller; `shared-control-contract` |
| 34 | Verified | Inspection is read-only; consequential actions require deliberate commitment; ownership suites |
| 35 | Verified | Collection, Atlas, comparison, Folio and practice navigation; Folio/Collection suites |
| 36 | Verified | Outcome summary, optional full report, illustrated ending archive; `flight-report-reading`, `flyway-expansion` |
| 37 | Verified | Bounded voice/cue mixing and adaptive music states; `audio-cue-budget`, `flyway-expansion` |
| 38 | Implemented | Strategy achievements, Folio Field Record and cosmetic Flight Story seals; `smoke`, `flyway-expansion` |
| 39 | Implemented | Acquisition paths, Hunt and collection milestones with uncertainty; `smoke`, `folio-atlas-focus` |
| 40 | Implemented | Collection Signals, Tuning Bench and owned-card Folio suggestions; `smoke` |
| 41 | Implemented | Three authored fixed-seed Flight Stories with cosmetic rewards; `flyway-expansion` |
| 42 | Implemented | Stories remain permanently available without deadlines/streak requirements |
| 43 | Implemented | Sella/Ivo/Oren, Caldra and persistent restoration connect districts; Flyway rules/integration |
| 44 | Verified | Canonical mechanical identity retained in art/frames and cosmetic seals; card-art acceptance |
| 45 | Verified | Advertised checkpoint recovery, reward receipts and file/import ownership; interruption suites |
| 46 | Waived/unverified | Real NVDA/VoiceOver sessions: existing version-scoped owner waiver |
| 47 | Waived/unverified | Physical touch/controller/suspension/thermal qualification: existing owner waiver |
| 48 | Measured/improved | Native-clock before/after, deferred boot presentation and delivery gates |
| 49 | Reconciled | This ledger supersedes stale statuses; historical measurements remain labeled |
| 50 | Verified | Version-scoped release policy retains explicit WAIVED output and strict override |
| 51 | Waived/unverified | Authentic player feedback/enjoyment is not replaced by scripted play |
| 52 | Release gate | Full final-source tests, artifact identity, publication smoke and owned-process cleanup |

## Normalized 70-package index

Every package is mapped here; this table supersedes the September 27 P0-only
status statement. References to the original IDs above preserve the underlying
requirements rather than treating renamed packages as new features.

| Packages | Disposition / evidence |
| --- | --- |
| D01–D05 | Implemented/reviewed: 60-item acceptance, final area assessment, three-size captures; IDs 28–29, 49, 52 |
| V01–V05 | Verified presentation/interaction: encounter catalog, HUD, preview and ownership suites; IDs 19, 20, 29, 32 |
| A01–A05 | Art reviewed: 872-image inventory, replacements and gameplay-scale review; grounded staging, district environments and Flyway suit FX; ID 44 |
| C01–C05 | Complete card/rule/identity readers, quantitative decision comparisons and contextual definitions; IDs 5–8, 16, 28, 30–31 |
| I01–I05 | Verified input, commitment, interruption and focus ownership; IDs 29, 33–34, 45 |
| F01–F05 | Measured timing, bounded FX/audio, reduced-motion parity and render improvement; IDs 32, 37, 48 |
| G01–G05 | Bounded strategy/card/upgrade/randomness audit and viable opening fixtures for each Leader; IDs 10–18, 21 |
| E01–E05 | Authored role/formation/phase/disruption coverage and recorded fight durations; IDs 19–21, 26 |
| R01–R05 | Contextual route/reward/Market/defeat decisions and seeded economy/progression; IDs 17–18, 22–26 |
| U01–U05 | Continue, grouped controls, five playable lessons and connected collection/practice paths; IDs 1–4, 9, 12, 27, 35–36 |
| P01–P05 | Ownership strategies, discovery guidance, experiment records, permanent cosmetic Stories and resident consequences; IDs 38–44 |
| X01–X03 | Automated text/contrast/input/narration checks retained; IDs 28, 30, 33 |
| X04–X05 | Existing owner waivers: actual assistive technology and physical devices unverified; IDs 46–47 |
| T01–T05 | Deferred boot code, bounded repeated lifecycle, durable saves, shared presentation and download recovery; IDs 45, 48–49 |
| Q01–Q02 | Rule/sequence/stress checks and inspected production captures; IDs 19–20, 28, 52 |
| Q03 | Authentic player sessions waived/unverified; ID 51 |
| Q04–Q05 | Final revision/artifact identity, retained failures, current ledger and resource cleanup; IDs 49–52 |

## Conditional ideas and qualification limits

- Further scene splitting/object pooling is conditional on a demonstrated
  bottleneck. This pass adopts measured boot splits; it does not require a
  speculative rewrite or pool objects without measured allocation pressure.
- The old image-generation roadmap is a source of briefs for demonstrated art
  outliers or new content. The completed art inventory/replacement acceptance
  supersedes its old inventory counts. It is not a queue to regenerate every asset.
- Human enjoyment, physical hardware performance and native assistive technology
  remain unverified under the existing 0.1.0 waivers. Windows Playwright WebKit
  does not qualify Safari hardware audio.
- Automated audits sample policies, seeds and encounters. Their limits remain
  explicit; they do not prove that no other bug or balance outlier can exist.

## Release qualification

The full local sweep ran 981 cases: 977 passed and four failed. All four failures
are mapped to passing repaired-build reruns. The added breathing regression
raises the final-source suite to 982 cases. All 14 campaigns and four live-input
journeys passed. The nine-case stage matrix now exits cleanly after explicit
WebGL-page cleanup. Original failures and interrupted runner attempts remain
recorded in [the release evidence](../project/backlog-release.md).

The [Pages workflow](https://github.com/willtran87/project-bird-squad/actions/workflows/deploy-pages.yml)
requires the complete final-source suite, static checks, production build,
delivery budgets and actual Pages-base smoke before publishing. Its clean build
identity and the release PR carry the publication result; local final evidence
is retained under `.artifacts/backlog-*`.

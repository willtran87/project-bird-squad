# P0 resolution and acceptance record

September 26–27, 2026. **33/33 P0 packages implemented and locally verified;
0 open P0 packages. Not publication or universal quality certification.**

Scope: the 33 P0 packages in the normalized product-enhancement backlog.
Preserve the dark urban bird/tarot direction. No publication or branch changes
are included. Existing human, physical-device and assistive-technology waivers
remain waivers, never passing evidence.

## Implementation and qualification map

| Packages | Implemented acceptance surface | Verification sources |
| --- | --- | --- |
| D01, D02 | Shared dark surface/type/spacing contract, menu/reader palette, restrained framing | `theme.ts`; menu, art hierarchy, Codex hierarchy and layout tests |
| D03 | Reference title → route → combat → reward → Preen → result → replay flow | Live pointer, keyboard and virtual-Gamepad flights pass; controller completes 270 decisions |
| D04 | Quieter selection, explicit paged readers, text-led collection navigation, bounded result lanes | Codex catalogs; reward, Market, item, pile and deck readers; numeric feedback tests |
| V01 | Full authored enemy artwork, separate intent/vital/status/phase regions in all four districts | 80 encounters × three supported sizes; representative captures inspected |
| V02, V03 | Survival/resource/action hierarchy; distinct selection, forecast and commitment | Combat HUD/priority, incoming damage, confirmation and hand tests |
| V04, V05 | Bounded target-associated results; reserved hand, intent and action regions during motion/overlays | Numeric/trigger lane, hand/motion, incoming feedback, effect-order and reduced-flash tests |
| C01, C02, C03 | Complete card rules in measured readers; intact art; honest excerpts and defined keywords | 110-card galleries/readers; card rule, comparison and keyword tests |
| I01, I02 | First-action response, guarded selection/commit, stale/double-event rejection | First-input, action-rejection, commitment, district-contract and parity tests |
| I03, I04 | Inspection/Back retains choices and focus; pointer/remapped keyboard/controller access | Inspection-continuity, reader, input-hint and reference-flight tests |
| I05 | Routine inspection is read-only; skips, purchases and irreversible actions remain deliberate | Choice, Market, picker, reward and save-recovery tests |
| F01, F02, F05 | Measured cadence, causal tell/action/impact, consistent Pace/Hustle/pause/reduced-motion results | Enemy cadence, manual-clock parity, motion and sequencing tests |
| E03 | Intent and phase forecasts use actual results across interrupts/statuses | Incoming-damage parity, healing preview, counterstrike and smoke sequence tests |
| U01, U02 | Primary start/continue path and consistent settings/help/reward/result navigation | Menu, resume, onboarding, system controls and outcome tests |
| X01, X02, X03 | Measured readable text/targets, non-color state cues, remapping and accessibility options | Three-size geometry, narration, contrast, controls, motion/flash/audio checks |
| T01 | Hard bundle/asset caps retained; lazy encounter presentation and recorded startup identity | Bundle/cache validators, readiness milestones; preferred size targets still warn |
| T03 | Durable reward steps, claim receipts, finished-flight outbox, explicit storage retry and backup recovery | Reward, card-claim, finished-run and checkpoint fault-injection suites |
| T05 | Explicit cancellable failed-download recovery, coherent whole-document reload, Pages base-path check | Real HTTP 503 tests across three engines; local Pages smoke and cache contract |
| Q01, Q02 | Repeatable mechanics/stress checks and actual built visual evidence | Broad baseline plus focused regressions, catalogs and three-size captures |
| Q04, Q05 | Exact artifact identity, retained failure reports, explicit waivers, owned-process cleanup | Build-evidence writer, release-policy validation, progress/resource ledger |

The table maps scope to evidence. All P0 acceptance defects are reconciled; this
does **not** assert that every historical test run was green, close P1/P2 work,
or convert waived human/device sessions into passes.

## Current evidence, including failures

- Broad frozen baseline: `.artifacts/p0-final-results.json`, 598 cases,
  **542 passed / 56 failed / 0 skipped**. Preserve this report. Several failures
  were obsolete decorative-object assertions or tests exhausting their total
  allowance under simultaneous software-rendered browser load. They require
  meaningful replacement assertions or isolated reruns, not a blanket waiver.
- On `index-CmFDfjgF.js`, all 18 reward-checkpoint cases pass across Chromium,
  Firefox and WebKit. The same 27-case run had one outstanding WebKit download
  failure: `.artifacts/.artifacts/p0-recovery-recheck.json` records **26 pass / 1 fail**.
- Genuine HTTP 503 recovery on `index-6m34EsV1.js`: **3/3 pass** in
  `.artifacts/.artifacts/p0-http-recovery-fixed.json`. Later hardening waits for complete
  cache replacement before navigation and rejects malformed reward claim journals;
  these final changes pass all 30 final recovery cases across Chromium, Firefox
  and WebKit on `index-0ZUXstUw.js` in
  `.artifacts/.artifacts/p0-final-recovery-results.json` (zero skipped/errors).
  This includes malformed-journal backup recovery, final-boss turn records,
  committed-Preen retry and every reward step through reload.
- All 80 authored encounters pass three-size artwork/geometry checks. Inspected
  examples include crowded district-1 formations, the canal boss, Beacon-Breaker
  and Roost Warden. Automated geometry is not a subjective-art or device audit.
- Baseline reconciliation reports retain intermediate failures rather than
  hiding them: `p0-regression-recheck.json` records 44/52 passing,
  `p0-final-smoke-recheck.json` records 6/9 passing, and
  `p0-last-smoke-recheck.json` closes the last three presentation assertions
  with 3/3 passing. Renamed checks still exercise current readable controls,
  full rules, purchase effects and geometry rather than removed decoration.
  These three recheck JSON reports are under `.artifacts/.artifacts/` because
  Playwright resolves the configured output name relative to its config directory.
- The final-candidate keyboard-only live flight reaches three-district victory
  and Replay in 5.6 minutes without mechanical overrides or fast-forwarding.
  Its outcome screenshot was inspected. The controller-only flight also wins
  and replays after 270 decisions in 12.0 minutes, with zero keyboard events.
  `.artifacts/.artifacts/p0-isolated-live-controls.json` records **2/2 pass**
  with zero skipped/errors. Its 2560×1600 outcome capture was inspected.
- Runtime data, documentation, all 961 optimized assets and release-waiver policy
  pass. TypeScript and whitespace checks pass. All hard bundle/cache contracts
  pass; preferred 675 KiB entry and 710 KiB combined-boot targets remain warnings.
- Final local Pages subdirectory smoke passes in
  `.artifacts/p0-pages-compact-results.json`, on
  `.artifacts/p0-pages-compact-build`. The built 2560×1600 full-art combat capture
  was inspected. The preceding Pages build passed gameplay but exceeded its
  combined hard budget; document-relative image URLs fix that overhead without
  raising limits or weakening CSP. Final root/Pages combined boot is 721.9/722.7
  KiB, both below 725 KiB. Preferred size targets still warn.
  Workflow changes are unpushed and unexercised on GitHub. Local `_headers` validation does not
  certify GitHub Pages response headers or a live deployment.

## Final reconciliation and boundaries

All 53 non-recovery/non-live baseline failures are now reconciled by passing
targeted tests (including the renamed hand and inventory presentation checks).
The committed-Preen failure is covered by the passing cross-engine reward suite.
The original 598-case report remains a failed run, not a retroactively green one.

- Post-packaging `.artifacts/p0-compact-assets-recovery.json`: **9/9 pass**,
  zero skipped/errors across Chromium, Firefox and WebKit. Approved card/enemy/
  district images decode, district/boss transitions retain art, and actual failed
  downloads recover. The test now takes an explicit artifact directory rather
  than accidentally inspecting an older default build.
- Required gameplay client: `.artifacts/p0-compact-qualified-client`, two input
  iterations, inspected final combat screenshot, no error artifact, full art
  and interaction ready with no pending/failed/timed-out groups. The 1,211 ms
  full-art and 1,286 ms interaction readings are one local sample, not a benchmark.
- Final identities: `.artifacts/p0-compact-candidate-identity.json` and
  `.artifacts/p0-pages-compact-identity.json`, paired with their actual artifact
  directories. Use SHA-256, not only Vite's filename: base-path replacement can
  leave equal filenames with different bytes. Dirty source is recorded explicitly.
- Owned previews, test runners and browser workers were stopped. No listeners
  remain on test ports 5373, 5430–5433 or 5440. Completed WebKit workers 20664 and
  14180 needed explicit termination after all cases passed and after checking
  that they had no browser children; both runners exited 0 with empty error lists.
  Other applications were left alone; generated evidence was retained.
- Documentation, runtime data, 961 assets, release-waiver policy, TypeScript,
  whitespace, both hard bundle budgets and both cache manifests pass. Root and
  Pages preferred size targets remain warnings. CI configuration is local only;
  no commit, push, deployment, live-header enforcement or rollback was performed.

Authentic enjoyment, physical-device performance and actual NVDA/VoiceOver
usability remain unverified under the existing owner waiver. No unqualified
“all A” or universal-device claim follows from automated acceptance.

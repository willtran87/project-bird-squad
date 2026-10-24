# Flyway release qualification — October 24, 2026

Scope: the complete Flyway expansion, both preceding audits, full release tests,
and publication through the existing gated GitHub Pages workflow.

## Findings resolved during release testing

- Preserved remapped Help and combat history: the journal uses F8 when J is
  assigned to another control. J and Shift+J retain their existing actions.
- Made fresh resident state match normalized checkpoints, so cancelling a
  reward preserves the exact serialized run rather than adding zero fields.
- Consumed held controller buttons when opening the journal/Preen dialog.
  The A press opening a Preen can no longer immediately activate Cancel.
- Replaced the Molt caption's literal font with the shared UI font token.
- Updated scripted players and reward tests to make explicit Preen choices.
  The keyboard journey now uses real arrow-key navigation beyond nine cards.
- Corrected test readiness for lazy outcome controls and newly registered
  Collection Lens targets; sampled short-lived FX at an exact game-clock age;
  updated the overflow-healing assertion to its precise Cover amount.

## Local results

The full four-worker production run executed **956 cases: 938 passed and 18
failed**, with no skips or retries. It ran for 91.8 minutes. This original run
is retained as failed evidence, not described as a clean run.

Every failed case has a passing affected-path rerun after investigation or
correction. The reconciliation report matches failures to passing cases by
browser project and test title: **18 resolved, zero unresolved, zero failures
across 44 recorded rerun cases**. These include the two new release regressions
in Chromium, Firefox and WebKit. Some tests repeat across these focused runs.

- All 14 seeded campaign scenarios passed.
- All four live-control journeys passed: natural defeat/replay, complete
  keyboard, pointer-only, and controller-only flights. The corrected keyboard
  and controller journeys took 10.4 and 18.3 minutes respectively.
- All nine required cross-browser smoke cases passed.
- All 16 Node unit cases passed, including checkpoint normalization stability.
- Strict TypeScript, production builds, docs/data/assets, enemy contracts,
  card overlays, release-evidence policy, cache contracts and hard bundle
  budgets passed.
- The actual Pages subdirectory smoke passed on the corrected build, exercising
  title, lazy scenes, full-art combat and checkpoint reload. Captures were
  inspected at 2560×1600, 1440×900 and 1000×560.
- The unmodified shared gameplay client started a flight and played a card.
  Its final screenshot/state were inspected; full art loaded without asset
  failures and no client error file was produced.

Evidence is retained locally under `.artifacts/flyway-release-*`, including
`complete.log`, `reconciliation.json`, `input-v2.log`, `controller-final.log`,
`keyboard-final.log`, `cross-final.log`, `unit-final.log`, `static-final.log`,
`pages-final.log`, and `final-pages-play/`. JSON reports from the temporary configs are
under `.artifacts/.artifacts/`; the reconciliation also records their totals.
Source/build identity is recorded separately in `flyway-release-build-evidence.json`.

## Publication gate and limits

The GitHub Pages workflow runs the final committed source in 16 regression,
six campaign and four live-journey shards. Build and deployment require all
three groups to pass. Flyway's pure rule tests are also part of the build gate.
The workflow run and deployment record identify the published commit.

The Pages candidate uses 681.4 KiB of app entry code and 723.5 KiB of combined
boot code, below unchanged 700/725 KiB hard limits and above preferred
675/710 KiB targets. This release preserves existing explicit 0.1.0 evidence
waivers for human playtesting, physical devices and native screen readers.
Windows Playwright WebKit's missing Web Audio support does not qualify Safari
hardware audio. Automated passing results are not a guarantee of zero bugs.

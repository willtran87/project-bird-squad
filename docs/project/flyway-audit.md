# Flyway expansion audit — October 23–24, 2026

Scope: the uncommitted expansion on `codex/flyway-expansion`, its combat/save
integration, deferred scene adapters, input ownership and failure recovery.
Baseline revision: `60a10f36`. This is a focused source and production-browser
audit, not a claim that every possible game state is bug-free.

## Findings and fixes

| Finding | Player impact | Resolution |
| --- | --- | --- |
| Malformed archived bird entries were trusted | A null or invalid entry could throw while opening the ending journal | Validate the archive and every bird ID before rendering; bound the displayed list |
| Journal section changes replaced the focused button | Keyboard/controller focus disappeared after switching tabs | Restore the corresponding enabled control after rendering, with a safe fallback |
| Journal shortcuts ignored some existing decision owners | J could open over exit confirmation, district-contract selection or recovery | Respect those owners, scene activity and native dialogs before handling input |
| Storm Pin's extra Wingbeat was absent from forecasts | A Molt card's predicted energy differed from its actual result | Project the Wingbeat once when entering Molt, matching combat |
| Cover penalties missed direct gains | Waymarks, boss prep and overflow healing bypassed Rain/Woven Roost costs | Share the cost calculation across all Cover sources and their forecasts |
| Failed journal imports were retried in place | Cached module failures made the Retry button repeatedly fail | Use the established explicit saved-checkpoint recovery/reload flow |
| Boss phase forecasts retained the old intent index | Predicted disruption could inspect the wrong phase-II move | Reset the preview intent index to zero when the phase changes |
| Ending renderer download failure had no local actions | After dismissing download recovery, the result showed a permanent loading message | Use the existing owned pending panel with recovery and a save-checked Main Menu action |
| Supply-triggered boss conditions were not evaluated | Winded from a Supply failed to cancel the promised boss attack | Evaluate disruption after the complete Supply sequence and its Waymark triggers; evaluate card triggers after their final Waymark effects |

All nine findings are fixed. Eight were reproduced as failing browser cases;
the phase-index defect was identified in source and covered by a focused
phase-transition test. A separate held-controller-confirm check verifies that
activating a Leader call does not also play a card.

## Verification

First-pass result: **55 checks passed** — 34 expansion/audit browser cases, 14
existing regression cases and seven pure rule cases. All build and static
validation gates listed below passed. No confirmed finding remains unresolved
within this audit's scope.

The audit suite is [tests/flyway-audit.spec.ts](../../tests/flyway-audit.spec.ts).
Reproductions are retained locally in `.artifacts/flyway-audit-repro.log`,
`flyway-audit-download-repro.log`, `flyway-audit-outcome-repro2.log`, and
`flyway-audit-supply-repro.log`. The synthetic boss test uses the authored enemy
effect syntax `damage(flock,5)`. The later-district resident test now resolves
the existing contract choice first, matching actual route input ownership.

Final results and build identity are recorded in:

- `.artifacts/flyway-audit-final.log`: expansion and audit browser suites.
- `.artifacts/flyway-audit-final-regressions.log`: existing practice isolation,
  ordered previews, real boss-phase commits, Preen and Waymark regressions.
- `.artifacts/flyway-audit-forecasts.log`: four existing forecast regressions,
  including live parity across authored enemy moves and nested healing hooks.
- `.artifacts/flyway-audit-final-rules.log`: seven pure rule cases.
- `.artifacts/flyway-audit-final-build.log`: TypeScript and production build.
- `.artifacts/flyway-audit-final-{docs,runtime,assets,bundle,cache}.log`:
  documentation, data, assets, bundle and cache/security checks.
- `.artifacts/flyway-audit-final-play/`: the unmodified shared gameplay client's
  real start/route/card-play screenshot and state; no error file was produced.
- `.artifacts/flyway-audit-final-results/`: 2560×1600, 1440×900 and 1000×560
  journal/battle/Molt captures, all district bosses, and outcome recovery.
- `.artifacts/flyway-audit-build-evidence.json`: source/build hashes.

## Second pass: interrupted persistence, cancellation and browser coverage

The follow-up reproduced five additional problems:

| Finding | Player impact | Resolution |
| --- | --- | --- |
| Ending persistence lived in the optional journal module | A failed or delayed download could prevent the birds and story seal from being saved | Run-owned persistence writes the ending independently of presentation downloads |
| The result exit guard ignored journal and seal write failures | Leaving the result could discard the only live copy of the ending | Require all ending writes before committing the result and clearing the active checkpoint; reuse save recovery and idempotent retries |
| A cancelled Preen remained queued during its module download | A stale choice could reopen after cancellation | Clear cancelled requests; validate the picker, card and purchase context before displaying or accepting a branch; retire requests on shutdown |
| WebKit pointer activation did not focus the selected journal control | Re-rendering restored the previous tab instead of the newly chosen one | Explicitly focus the activated control before its action, then restore that control after rendering |
| Journal closure only resumed an already-paused scene | Opening and closing within one frame left the queued pause without a matching resume, freezing play | Always queue the matching resume when closing the owned journal |

Six cases in `tests/flyway-second-audit.spec.ts` cover the two ending failure
paths (journal and seals separately), unavailable presentation, cancelled
downloads, scene restarts, and opening/closing within one frame. All four original ending/cancellation cases
failed against the previous production build. The existing focus test failed
in WebKit. Reproductions: `.artifacts/flyway-second-before.log` and
`.artifacts/flyway-second-cross.log`. The freeze reproduction is retained in
`.artifacts/flyway-second-fast-close-before.log`.

The ordinary journal and reward-cancellation tests now wait for Phaser's queued
scene transition before asserting state or issuing the next direct scene command.
Their immediate operations failed in WebKit; the separate same-frame test proves
the actual freeze and its repair.

The persistence implementation is `src/game/flyway-storage.ts`; practice writes
continue to use the disposable storage backend. Automatic Preens retain their
existing behavior. Manual commits validate their original context again before
changing the bird.

### Second-pass verification result

- The broad three-browser sweep recorded 113 passing cases and four WebKit
  failures: two immediate scene-transition assumptions and two checks requiring
  its missing Web Audio API. All 117 case outcomes are retained in
  `.artifacts/flyway-second-final.log`; the runner was stopped after the last
  outcome when teardown did not exit. This is not presented as a clean run.
- After fixing the pause race and correcting those test assumptions, the final
  production build passed **44 browser checks with zero failures**, plus one
  explicit WebKit audio skip. This rerun covers every new reproduction, affected
  journal/Preen interaction, persistence, controller ownership and music/Molt
  behavior across Chromium, Firefox and WebKit. It is an affected-path rerun,
  not a second complete sweep. Log: `.artifacts/flyway-second-fixed.log`.
- Seven existing finished-result recovery, practice isolation and Preen cases
  passed in `.artifacts/flyway-second-regressions.log`, before the final change
  to journal close. Seven pure rule cases passed in `flyway-second-rules.log`.
- TypeScript/production build, docs, data, asset validation, hard bundle limits
  and deployment-cache checks passed. Latest build/cache/bundle logs use
  `.artifacts/flyway-second-fixed-*`; unchanged data/assets use
  `.artifacts/flyway-second-{runtime,assets}.log`.
- The unmodified shared gameplay client exercised start, route and card play
  on the final build. Its screenshot/state were inspected and no error file was
  produced: `.artifacts/flyway-second-fixed-play/`. Journal captures at
  2560×1600, 1440×900 and 1000×560 and compact save recovery were inspected.
- Final source/build identity: `.artifacts/flyway-second-build-evidence.json`.

All five additional product findings are fixed; none remains unresolved within
this follow-up's scope. The coverage limits below still apply.

## Remaining qualification limits

- The subsequent [release qualification](flyway-release.md) ran the complete
  local regression/campaign matrix and resolved every recorded failure through
  passing reruns. It also records three additional runtime fixes, the font
  contract correction, and release test updates.
- Windows Playwright WebKit exposes neither `AudioContext` nor
  `webkitAudioContext` (verified in `flyway-second-webkit-audio-probe.log`). Its
  music-only test is explicitly skipped; the mixed Molt test still verifies
  visuals/gameplay and inactive audio. Audio sequencing is tested in Chromium
  and Firefox. This does not establish audio compatibility on Safari hardware.
- Entry code is 680.4 KiB and combined boot code is 722.5 KiB. Both pass the
  unchanged hard limits, while exceeding the preferred 675/710 KiB targets.
- Network failure recovery explicitly offers a checkpoint reload. It does not
  promise to preserve unsaved in-combat progress across a reload.
- Publication is gated by the final committed source's GitHub Actions run;
  the deployment record identifies the released Pages commit.

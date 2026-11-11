# Tactical payoffs and survival — November 11, 2026

Accepted scope: preview survival after a selected card and Roost; investigate
native frame stalls; measure earned strategy opportunities and tune supported
bottlenecks; strengthen ordinary encounter decisions; keep action feedback quiet
and canonical. Finish full release qualification, merge, Pages publication and
branch cleanup. Human sessions remain unavailable; update the existing handoff.

## Acceptance

- Survival compares the current Roost outcome with the selected card followed
  by Roost, without playing the card or mutating combat. Unresolved choices and
  unsupported triggers are explicit. Actual Roost remains an independent action.
- Preview/live parity covers protection, healing, Winded, kills, phase changes,
  disruption, Molt, overextension, choices and relevant trigger boundaries.
- Presentation uses existing information lanes and preserves identities, full
  rules, input ownership, pause behavior and reduced-motion alternatives.
- Native production traces identify expensive work before optimization. Compare
  before/after with unchanged artwork and text quality; retain outliers and
  limitations. No latency or FPS claim without supporting measurements.
- Earned-deck evidence records acquisition opportunities, activations and
  per-fight contributions. Tune existing rewards/Preens only where evidence
  identifies a bottleneck. No fabricated wins or claim of human enjoyment.
- Ordinary encounter changes provide two viable tactical approaches with clear
  enemy tells and shared preview/live rules; validate each in actual resolution.
- Verify at 2560×1600, 1440×900 and 1000×560, all three browser engines, the
  shared game client, full release workflow and deployed Pages artifact.

Baseline: `8a04cf84` (published runtime `a072362d`). Work is in progress.

## Implementation and evidence

- The selected card reuses the Roost risk control: “Now” is immediate Roost;
  “Then” is the card followed by Roost. Full rules and the spoken selection
  summary include remaining Cohesion and scope. `~` marks estimates, `?`
  unresolved choices or an unaffordable card. Next-turn Fouled/Regen remain
  outside this enemy-phase forecast. Roost never commits a selected card.
- Projection uses copied card/enemy state, including Winded, phase changes,
  disruption, overextension and combat-ending kills/interception. Draw-dependent
  held cards and unsupported Leader/Waymark triggers remain explicit estimates.
- The first branch-aware baseline seed completed all three strategy policies.
  Its early branch dialogs offered Shelter/Flight only. Preened cards cannot
  later change branches, so that timing could close a complementary build before
  the Canal. Existing complementary Preens now appear at the first earned Preen;
  prices, effects and district-specific branches are unchanged.
- Campaign qualification expands from nine to eighteen earned strategy runs,
  follows real branch dialogs and records offers, affordable hands, branch rules
  and actual per-action damage, blocked damage, Resonance spend and Molt entry.
  These bounded heuristics are mechanical evidence, not human play or optimal
  strategy. No damage, reward probability or cost tuning is inferred from wins.
- Quiet Beat's existing preparation now checks `notHitThisTurn`: a hit prevents
  its three stored force. Cover remains an alternative. Enemy Tell, encounter
  lesson, decision text, preview and live resolution share that rule.
- History, ordinary objectives and phase coaching yield while an action or its
  payoff owns the reading beat. Enemy Tells, vitals and commands remain visible.
  Canonical portraits and the single canonical card actor are unchanged.
  A per-frame diagnostic caught a brief history flash between layout polls;
  ownership now refreshes at presentation boundaries before rendering and
  immediately after queued HUD rebuilds. The regression samples every action
  frame, in addition to the settled screenshots.
- Native CPU traces identified Phaser's repeated `setFilter` calls reuploading
  identical pixels during HUD and action rendering. The shared filter guard
  reads current texture and data-source modes, so genuine changes/replacements
  still upload. No Phaser patch, texture reduction or text-resolution reduction.

All 15 focused production checks passed, including actual card/Roost parity,
interception, uncertainty, independent Roost, filtering, early branch commit,
feedback ownership and geometry. Adjacent Clear Choices/Distinct Builds checks
passed. Two stale-served-label diagnostics are superseded by the fresh-build
pass. Native high-resolution and minimum-size images were inspected, and live
selection was checked in the integrated browser. Boot code is 699.1 KiB against
the unchanged 700 KiB ceiling; documentation, content and bundle checks pass.
The release inventory is 1,176 core and 549 cross-browser cases. Full workflow
qualification and publication are pending.

## Native timing comparison

Three isolated before/after pairs at 1440×900 used the native browser clock,
unchanged art and a fixed First Flight timing fixture. The measured candidate
was `f2e594b9`, before the later Market input-boundary correction. Each side contains 108
selections, 27 plays, nine entries and six warm entries. The fixture's extra
HP/energy isolates timing; it is not balance evidence.

| Operation | Median before → after | Frame P95 before → after | Maximum frame before → after |
| --- | --- | --- | --- |
| Selection | 28.8 → 30.0 ms | 33.4 → 33.4 ms | 50.1 → 50.0 ms |
| Card play | 338.7 → 287.9 ms | 66.6 → 33.4 ms | 100.0 → 66.7 ms |
| Entry, all | 1909.0 → 1839.4 ms | 83.3 → 83.3 ms | 266.6 → 299.9 ms |
| Entry, warm | 1906.6 → 1839.0 ms | 33.4 → 33.4 ms | 100.1 → 66.7 ms |

The card-play median fell about 15%; selection did not improve. The 299.9 ms
entry outlier remains. No claim that every stall is fixed, or that these browser
measurements guarantee physical-device performance. No page errors occurred.
The diagnostic CPU trace pair reduced texture-upload samples beneath
`setFilter` from 1105.3 ms/631 samples to zero; other texture creation remains.
Evidence: `.artifacts/payoff-stable-performance-summary.json` and the paired
native captures, plus `choices-payoff-baseline-trace` / `choices-payoff-filter-trace`.

## Earned strategy observations

The eighteen recorded runs (six seeds per policy) used actual routes, rewards,
shops and Preen dialogs, without deck grants or reordered draws. The first full
qualification attempt produced the following strategy evidence, although two
unrelated UI test boundaries prevented that run from qualifying the release.

| Policy | Wins / runs | Fights | Blocked / fight | Resonance spent / fight | Affordable branch hands |
| --- | --- | --- | --- | --- | --- |
| Shelter | 5 / 6 | 61 | 42.36 | 2.95 | 79 |
| Tempo | 2 / 6 | 33 | 12.82 | 1.15 | 20 |
| Molt | 5 / 6 | 61 | 26.51 | 2.00 | 94 |

Complementary branches activated in play: Shelter Song once, Returning Call
three times and Homeward Wing eight times. Generic Shelter/Flight branches also
contributed. The three policies produced 89/29/149 Molt actions respectively.
These are bounded scripted policies: card ranking before a branch choice still
uses the canonical-upgrade heuristic, and the policies are not optimal or equally
strong. Tempo's lower results are an observation for the human handoff, not
proof of a particular balance defect. The concrete early-Preen availability
bottleneck is fixed; damage, prices and reward probabilities remain unchanged.

## Release-boundary corrections

Qualification run `43016816762` passed 1,175/1,176 core and 548/549 browser cases.
It was not merged. The Market could expose a newly constructed object
before Phaser's next PRE_UPDATE inserted its hit area. A controlled scheduling
probe reproduced an ignored pre-registration click and successful selection
after registration. A repeated native Firefox check confirmed that a late art
refresh could cause the same gap after the initial controls were ready. Route
art refresh now runs at the game STEP before scene input registration; it keeps
coalescing and reader/paused-scene deferral, and removes its global listener on
shutdown. A deterministic post-step assertion fails on the previous build and
checks that the rebuilt action is registered in the same rendered frame. The
test helper also waits for canvas/input readiness.

The synthetic story-ending fixture reloaded during its first outcome-art XHRs,
which WebKit reported as navigation-abort access-control errors; saved-story
assertions themselves passed. The fixture now observes the rendered ending and
loaded outcome textures before checking persistence through reload. Error
assertions and zero-retry release requirements remain intact.

The next run, `43024040769`, passed all 1,176 core cases and 548/549 browser
cases, but WebKit missed a Practice This Fight click after defeat. It was not
merged. A deterministic post-step check confirmed that a late outcome redraw
could show its replacement controls before their hit areas were registered.
The existing early-frame scheduling for reward screens now includes defeat and
run-complete screens. Regression assertions cover both outcomes, followed by a
real Practice click, exact opening-state restoration and unchanged saved rewards.
The combat rendering path and timing fixture are unchanged by this correction.

Run `43031065967` passed every executed test: 966 core and all 549 browser
cases. Three regression shards could not install browser dependencies because
the hosted runner's Azure Ubuntu mirror failed DNS resolution. An infrastructure
retry failed at the same installation step, still before any tests started.
Neither attempt qualified the release. A bounded standard-mirror fallback in
run `43038007268` confirmed DNS failures for both archive.ubuntu.com and
security.ubuntu.com; it was canceled after setup failures, before qualification.
All five test/build jobs now use the official Playwright 1.60.0 Ubuntu Noble
image, pinned by digest, with browsers and system dependencies already included.
A shared verification action rejects mismatched Playwright package versions or
missing executables. Node 22, browser versions, test coverage, build gates and
zero-test-retry requirements are unchanged. No package verification is disabled.

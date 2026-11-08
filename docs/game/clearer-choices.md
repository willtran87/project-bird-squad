# Clearer choices and distinct builds — November 7, 2026

Accepted scope: readable combat consequences, useful owned-flock reward advice,
strategy-aware earned-deck audits on shared seeds, measured interaction work,
and the prepared five-player handoff. Canonical art and game rules are retained.
Implementation and qualification are in progress; this is not a release claim.

## Player-facing changes

- Cost, enemy/utility outcome and Cover occupy separate forecast fields. Defeat,
  phase change, attack disruption and unresolved choice warnings remain visible.
  Complete ordered outcomes remain in Full rules. The two-row preview keeps
  its original 52-pixel lane above the hand, below enemy statuses. Confirmation
  sits to the right of the forecast, above Roost and clear of hand paging.
  The selected card and target retain
  their existing identity labels; secondary feedback yields during selection.
- Reward advice uses normal/upgraded rules, owned cards, actual Resonance
  thresholds, guaranteed producers and a stated three-Wingbeat base budget.
  Conditional refunds cannot fund a recommendation. Molt-changing producers
  cannot silently substitute a different second-card ability. Combination
  advice discloses consecutive play and the once-per-fight limit. Full conditions
  are available in the existing reader; compact faces retain bounded text.
- Advice is potential, not a promised draw or a win-rate estimate. Unsupported
  pairings are labeled as unverified instead of invented. Temporary discounts,
  future draws and passive triggers are not assumed.

## Performance method

Baseline is `6ebcb887`. Production Pages builds use separate local previews;
native-clock Chromium runs at 1440×900 without synthetic stepping. Alternate
baseline/candidate samples and keep other browser tests stopped during timing.
Record selection, play and entry separately. Instrument redundant calls only
after timing, so instrumentation does not affect the native-clock samples.

Selection previously rebuilt five full card views and simulated seven outcomes
in the sampled selection. The new path refreshes only visible selection/Flow
state and reuses the current forecast for its pips. The Inspect control builds
its full dossier only when opened. No persistent simulation cache is introduced;
changed resources, targets and rules are read again on the next refresh.

The new HUD measures about 11.4 KiB; its separate lazy-module ceiling changes
from 10 to 12 KiB to accommodate the forecast fields and critical warning row.
The combined boot ceiling stays 700 KiB (final candidate 696.5 KiB).
Artwork, text resolution and motion quality are unchanged. Three final alternating
runs (108 selections, 27 plays and nine entries per build) reduced sampled
selection work from seven simulations/five full card views to two/zero.
Native timings were mixed: baseline selection medians were 30.6–33.1 ms versus
31.1–42.1 ms; play medians were 337.3–352.2 versus 342.5–366.4 ms. No frame-rate
or interaction-latency improvement is established. See performance notes for
the complete samples, including an earlier 1.8-second cold-entry outlier
whose cause remains unverified. This is reduced redundant work, with explicit UI cost.

## Strategy audit

Three plans use the same three seeds (`opening-strategy-1` through `-3`), ordinary
starter cards, legal offers, actual purchases and unchanged combat rules. The
test-only policy ranks rewards, canonical Preens, Market cards and Waymarks by
authored effects and uses distinct combat priorities. Conditional effects are
discounted in its heuristic. It never grants cards, money or extra draws.

Reports retain all offered rewards and scores, purchases and prices, chosen
upgrades, actual plays with form/resources, combinations, Resonance spent,
blocked damage, cleanup turns and terminal outcomes. A defeat is valid evidence.
The scores describe the policy, not intrinsic card strength. They cannot prove
human understanding, enjoyment or universally optimal balance. No speculative
card or reward rebalance is included.

Local audit: all nine terminal-state checks passed with ordinary earned decks.
Results below are raw totals; differing run lengths prevent direct rate or
power comparisons. Canonical Preens are tested, not player-selected branches.

| Seed | Plan | Outcome / fights | Blocked | Resonance spent | Molt plays | Cleanup Roosts |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| 1 | Shelter | Complete / 10 | 542 | 30 | 21 | 4 |
| 1 | Tempo | Defeat / 2 | 42 | 3 | 6 | 0 |
| 1 | Molt | Complete / 10 | 327 | 21 | 13 | 5 |
| 2 | Shelter | Complete / 11 | 479 | 35 | 16 | 4 |
| 2 | Tempo | Complete / 11 | 95 | 13 | 4 | 3 |
| 2 | Molt | Complete / 11 | 192 | 4 | 16 | 1 |
| 3 | Shelter | Defeat / 2 | 47 | 0 | 3 | 0 |
| 3 | Tempo | Defeat / 2 | 16 | 0 | 1 | 0 |
| 3 | Molt | Defeat / 2 | 30 | 0 | 8 | 0 |

Shelter selected Nests-heavy rewards and blocked more in each shared seed;
the other policies made different legal reward/purchase choices. All policies
lost early on seed 3. Tempo did not consistently spend more Resonance than
Shelter, and Molt did not consistently produce more Molt plays. The audit
therefore verifies differentiated decisions and records their limitations;
it does not establish exclusive identities, balanced win rates or a needed
card nerf/buff. Reports: local `.artifacts/choices-strategy-summary.json` and
the nine `mechanical-run.json` files; CI retains exact-revision campaign reports.

## Acceptance

Check all authored normal/upgraded/Molt forecasts; verify readable fields and
critical notices at 2560×1600, 1440×900 and 1000×560. Exercise selection, target
changes, inspection/return, reward and Preen choice preservation, three browser
engines, existing controller/input ownership, and the complete release gates.

No new human sessions are available. The existing handoff now includes forecast
comprehension and pairing-condition observations; preparation remains the
accepted deliverable, and existing device/AT waivers remain explicit.

The initial 24 new cross-browser and 18 affected regression checks passed,
as did 33 unit/policy checks. Review then found a duplicate-identity reader
edge case: an owned Preened copy could replace the offered base copy's advice.
Readers now carry the exact inspected card; both reward and Preen tests include
an owned duplicate with different rules. Initial CI run `42427628611` was
cancelled as superseded and is not qualifying evidence. Final qualification
must cover this fix.

The next diagnostic run (`42428071928`) exposed an actual crowded-status
overlap from the initial 80-pixel forecast, plus an old empty-deck copy
expectation. The forecast now uses the original 52-pixel lane with a separate
confirmation hint; the semantic no-invented-pairing assertion is retained with
the new wording. Crowded statuses are now included in the new browser coverage,
and the whole-cast geometry check includes the confirmation hint. This failed
diagnostic run is not release qualification.

Corrected local qualification passed 13 cases covering all four authored
encounter catalogs, the entire combat cast and new choices, plus 27 browser
checks across Chromium, Firefox and WebKit. Crowded status/critical-warning
screens were inspected at supported sizes. The unmodified shared game client
selected and played First Flight, with clean forecast dismissal and no captured
errors. Final exact-revision release qualification remains required.

Diagnostic `42430004689` completed all 1,152 core cases (1,150 passed) and all
498 browser cases (passed). Its two large-hand cases exposed the left-side
confirmation hint overlapping a paged hand; the same gutter also belongs to
paging controls. The final hint uses the right end of the forecast lane.
Geometry checks now cover cards, paging, inspection, Roost, enemy statuses and
text containment separately. Large-hand cases join the permanent browser gate,
raising qualification to 168 cases per engine (504 total). This diagnostic is
not qualifying release evidence.

The final right-side hint passes 23 layout/identity/catalog checks, 33 checks
across Chromium, Firefox and WebKit, and three additional critical-warning
clearance checks. The unmodified shared client selected and played First Flight;
reviewed screenshots show the forecast dismissing cleanly. Six final native
timing runs captured no page errors, with mixed timing results documented in
the performance notes. Full qualification must pass on this exact revision.

Diagnostic `42433365993` exposed an older title-flourish test sampling a fading
glow after a fixed wall-clock delay. It now waits for lazy-module readiness
with scene timers/tweens paused, then samples a defined animation beat. The
existing visible-art, pending-launch and route-transition assertions remain.
This superseded run is not qualifying evidence.

# Clearer choices and distinct builds — November 7, 2026

Accepted scope: readable combat consequences, useful owned-flock reward advice,
strategy-aware earned-deck audits on shared seeds, measured interaction work,
and the prepared five-player handoff. Canonical art and game rules are retained.
Implementation and qualification are in progress; this is not a release claim.

## Player-facing changes

- Cost, enemy/utility outcome and Cover occupy separate forecast fields. Defeat,
  phase change, attack disruption and unresolved choice warnings remain visible.
  Complete ordered outcomes remain in Full rules. The preview stays above the
  hand, and secondary feedback yields while a card is selected.
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
The combined boot ceiling stays 700 KiB (candidate currently 696.4 KiB).
Artwork, text resolution and motion quality are unchanged. Three alternating
runs per build (108 selections, 27 plays and nine entries each) reduced sampled
selection work from seven simulations/five full card views to two/zero.
Native timings were mixed: baseline selection medians were 40.3–42.3 ms versus
31.7–60.6 ms; play medians were 332.7–342.0 versus 322.3–361.8 ms. No frame-rate
or interaction-latency improvement is established. See performance notes for
the complete samples. This is reduced redundant work, with explicit UI cost.

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

## Acceptance

Check all authored normal/upgraded/Molt forecasts; verify readable fields and
critical notices at 2560×1600, 1440×900 and 1000×560. Exercise selection, target
changes, inspection/return, reward and Preen choice preservation, three browser
engines, existing controller/input ownership, and the complete release gates.

No new human sessions are available. The existing handoff now includes forecast
comprehension and pairing-condition observations; preparation remains the
accepted deliverable, and existing device/AT waivers remain explicit.

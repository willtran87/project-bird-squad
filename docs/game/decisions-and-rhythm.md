# Decisions and rhythm — 2026-11-04

Accepted scope: improve combat hierarchy, review naturally acquired strategies,
vary route tactical demands, record meaningful observed victories, and restore
measured performance headroom. Complete release qualification, merge, publish,
verify the public artifact and clean task resources. Human sessions remain a
prepared five-player handoff; automated policies cannot establish enjoyment.

## Work and acceptance

- Selection focus: selected card, affected target and actual forecast take
  priority. Secondary progress and notices yield while choosing or resolving.
  Original identities and one action-feedback lane remain authoritative.
- Strategy audit: follow real campaign acquisitions and compare the three plans;
  change availability only if measured runs establish a missing opportunity.
  Record actual early payoffs and tradeoffs without claiming human balance proof.
- Route rhythm: measure repeated tactical demands, use authored encounters to
  vary them, and preserve existing saved-route behavior and path safety rules.
- Turning points: record actual blocked attacks and combination finishes with
  bounded, normalized save data; prefer one concrete observed event in highlights.
- Performance: compare production bytes and native-clock browser timings before
  and after; defer secondary presentation with cancellation/recovery. Measure
  cleanup turns and shorten only redundant presentation, preserving enemy tells.
- Verify changed interactions, lifecycle and failure paths at 2560×1600,
  1440×900 and 1000×560, then run the complete release pipeline and public checks.

## Evidence

Implementation and local qualification complete; remote release qualification
and publication are pending. Evidence uses `.artifacts/rhythm-*`.

- Objectives now yield to selection forecasts and restore their previous
  visibility on cancel. Signature notices yield to the active bird action.
  Canonical art and existing action-feedback ownership remain unchanged.
- New flights opt into route rhythm version 1. Old saves omit that flag and use
  the original algorithm. Across 1,024 seeded districts, repeated street demands
  fell from 1,207 to 212 (82.4%); 1,064 payloads changed. Graphs, node types,
  openers, bosses, rivals and enemy-count bands were preserved. This measures
  authored demand tags, not equivalent difficulty or player enjoyment.
- Highlights prefer a recorded combination finish, otherwise the largest actual
  fully blocked hit. Labels, turn and damage are normalized and bounded. Partial
  blocks are excluded; these records do not claim that an action saved the run.
- Familiar empty recovery beats retain their preparation but shorten the impact
  hold from 650 to 420 ms and recovery from 240 to 160 ms before pace scaling.
  First sightings, attacks, support effects and cinematic pacing are unchanged.
- All 24 extracted market/picker renderer bodies are identical after TypeScript
  erasure. The optional 22.0 KiB presentation chunk loads on demand with a
  cancellable pending panel and existing download recovery.

### Earned-deck audit

The three plan variants used the same `opening-strategy-1` seed, ordinary
starter cards, actual offered rewards, affordable purchases and legal Supplies.
The existing cache-first policy chooses the first offered non-Snag reward; it is
not an optimal policy for any plan. No cards or resources were granted.

| Plan | Result | Fights | Turns | Damage blocked | Combinations |
| --- | --- | ---: | ---: | ---: | ---: |
| Hold & Answer | Complete | 10 | 29 | 124 | 7 |
| Chorus Engine | Complete | 10 | 33 | 103 | 11 |
| Storm Window | Complete | 10 | 33 | 103 | 11 |

All three recorded Cover, Resonance and a Molt play in the opener. The first
district boss recorded 43 blocked damage for Hold & Answer and 37 for each
other plan. The identical Chorus/Storm outcomes expose this policy's limited
ability to distinguish those builds; they are not evidence of equal balance.
An additional sheltered policy on another seed lost its second fight. None of
the 32 sampled fights needed a Roost with only one enemy below 20% Cohesion.
There is no measured justification here for a general health, damage or reward
availability rebalance. Preserve the existing draft bias and use the prepared
five-player handoff for understanding, enjoyment and build-choice evidence.

### Delivery and native-clock measurements

| Measure | Baseline | Candidate |
| --- | ---: | ---: |
| Combined app boot, minified | 709.7 KiB | 694.1 KiB |
| Boot ceiling | 710 KiB | 700 KiB |
| Median card resolution, 9 samples | 334.5 ms | 337.7 ms |
| Median battle entry, 3 samples | 1,932.0 ms | 1,957.6 ms |
| Warm-entry frame P95, 2 entries | 33.4 ms | 50.1 ms |

The measured gain is 15.6 KiB less boot code, not a frame-rate improvement.
Native-clock Chromium measurements were taken at 1440×900 with the same fixed
card/transition fixture and no synthetic stepping. The sample is small and
frame timing remains variable; candidate max warm-entry frame was 116.7 ms.
Game-core's individual ceiling rises from 30 to 31 KiB for versioned route
logic, within the tighter 700 KiB combined cap. The optional panel has a new
23 KiB cap. No textures, text resolution or motion-quality settings were reduced.

### Local qualification

- 33 unit/release-policy tests passed; docs, build, delivery budgets and cache
  contract passed. Inventory: 1,138 core cases and 158 browser cases per engine.
- Seven new cases passed in Chromium, Firefox and WebKit: 21/21, zero retries,
  skips or flaky cases. Four earned-deck campaign cases passed their terminal
  assertions; a measured defeat is a valid campaign outcome.
- Screens inspected at 2560×1600, 1440×900 and 1000×560 for selection, Market,
  pending/cancel and failed-download recovery. The unmodified shared game client
  reached combat; state/screenshot were reviewed and it reported no errors.
  The candidate title also rendered in the in-app browser.
- Initial local failures were test assumptions: the recovery dialog owns Escape,
  enemy bonuses contribute to blocked damage, and WebKit can render cancellation
  on the next frame. Assertions now check the actual modal, damage and settled
  state. Failed runs remain retained alongside the clean run.

No new human, physical-device or native-AT evidence exists. Existing waivers
remain explicit; zero player sessions are represented as passes.

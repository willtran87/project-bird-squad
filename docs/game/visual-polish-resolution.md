# Visual clarity and interaction polish

This pass addresses the ten findings from the visual-clutter and interaction audit.
It does not close the broader product roadmap or certify a release.

| Finding | Resolution |
| --- | --- |
| Combat cards were hard to read | Raised hand summaries to 16 logical pixels and added a fixed, opaque rules dossier with 20-pixel active rules and 16-pixel alternate rules. The dossier stays clear of enemy intents and the hand. |
| Card actions felt unresponsive | Reduced cosmetic recovery from 240 to at most 100 ms. Players can preselect the next card during a player-card animation without executing or queuing it. The selection survives resolution. Enemy turns and modal decisions remain guarded. |
| End turn was difficult to recognize | Replaced the unlabeled medallion with a labeled Roost button, current key binding, and projected incoming HP loss. |
| Combat HUD competed for attention | Kept Cover in a stable position, enlarged Flow text, simplified inventory chips, separated keystone badges from Flow, and removed the hint that overlapped the selected-card outcome preview. |
| Map paths were too subdued | Increased future-node and route-edge visibility and reduced the surrounding decorative frame. Existing select/commit behavior is preserved. |
| Rewards lacked a clear commitment action | Added explicit Select card / Take buttons beside Inspect, retained intentional two-activation commitment, quieted Skip, and reserved collection badges for new cards or hunt targets. Reward previews remain opposite the hovered card. |
| Back/cancel behavior was risky or inconsistent | An empty combat Back action opens pause after selection/overlay cancellation. Route pause exposes Abandon Flight separately, retaining its confirmation and safe cancellation. |
| Flight Lab had too many small controls | Consolidated seven footer actions into four wider controls, with advanced tools in a toggleable panel. Increased analysis labels and values; existing keyboard/controller shortcuts and protected Practice remain available. |
| Pause was visually busy | Removed stacked decorative frames, aligned detail values, emphasized Resume, and separated abandonment from routine navigation. |
| Post-run information lacked hierarchy | Reduced the front-page statistics to three larger rows, enlarged the actionable defeat review, and retained Flight Details, seeded replay, and seed-copy access. |

## Verification

- Production TypeScript/Vite build; documentation, runtime data, runtime assets,
  bundle hard limits, deployment-cache, and whitespace checks pass.
- Four new scenarios pass in Chromium, Firefox, and WebKit. They cover combat
  selection and end turn, cancellation and pause, explicit reward commitment,
  outcome rendering, Flight Lab tools, and protected Practice.
- Expanded bounds checks pass in all three engines for all 440 base/Preened ×
  normal/Molt combinations, with all four keystone badges clear of Flow.
- Focused existing Chromium regressions cover attack windup, incremental previews,
  pointer/keyboard/controller commitment, discard sequencing, reward Skip,
  reward inspection/commitment, pause sequencing, animation pace, Flight Lab,
  and defeat review. Decoration-specific assertions were updated to the new
  intended layout; functional guards and containment checks were retained.
- Production captures cover 2560×1600, 1440×900, and 1000×560. The shared gameplay
  client also exercised a real menu → route → battle path without an error artifact.
- Evidence is retained under `.artifacts/test-results/polish*` and
  `.artifacts/shared-client/polish-final` (ignored local test outputs).
- Windows WebKit workers lingered after all tests completed. They were identified
  and stopped explicitly; the test runners then reported success. The expanded
  bounds-only three-engine run exited normally. Owned preview/testing processes
  and temporary helpers were cleaned up; port 43381 has no listener.

## Qualification still required

Human playtesting is needed to judge sustained fun, learning, and balance. Physical
touch/controller devices and assistive-technology sessions are not certified by
desktop browser automation. Preferred startup-size advisories remain: combined
boot code is 724.0 KiB against a 710 KiB preferred target (hard limit passes).
No progression grind, balance inflation, or monetization pressure was introduced.
This pass does not include a commit, push, or publication.

## Subsequent Pages publication check

The publication build uses `--base=/project-bird-squad/`, unlike the root-path
build checked above. It builds successfully and passes deployment-cache checks,
but repeated path prefixes raise combined boot code to 733.5 KiB, exceeding the
725 KiB hard budget. This is an outstanding performance-budget issue; no budget
was raised or validator disabled. The existing Pages workflow gates on the build,
not the complete release-qualification suite.

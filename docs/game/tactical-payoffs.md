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
selection was checked in the integrated browser. Boot code is 698.8 KiB against
the unchanged 700 KiB ceiling; documentation, content and bundle checks pass.
The release inventory is 1,176 core and 549 cross-browser cases. Full workflow,
final timing comparison and publication are pending.

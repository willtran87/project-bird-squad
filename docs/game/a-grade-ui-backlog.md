# A-grade visual and UI implementation backlog

Requested September 29, 2026. Scope is the 44-item review backlog, preserving
the existing bird-city palette and theme. Acceptance is LLM-assessed and tool-
verified; human feedback, physical-device sessions and human-operated assistive
technology are not completion dependencies. This is not a claim of proven fun.

Historical status: 9 of 44 items were complete at this checkpoint. The expanded
[September 30 acceptance plan](a-grade-acceptance-plan.md) is the active ledger;
do not combine the two counts or treat the older checks as new release evidence.
Unchecked here includes partial work and work awaiting verification. Release
gates remain separate and open.

## Flock Record

- [x] 01 Remove nested decorative frames from the dashboard.
- [x] 02 Separate overview, leaders and detailed records.
- [x] 03 Increase dashboard text size and contrast.
- [x] 04 Unify dashboard navigation and isolate save management.
## Shared UI

- [ ] 05 Primary, secondary and utility button hierarchy.
- [ ] 06 Shared typography and spacing.
- [ ] 07 Distinct hover, focus, selected, armed, disabled and loading states.
- [ ] 08 Proportion-preserving frame construction.
## Art

- [x] 09 Replace Marn's humanoid anatomy.
- [ ] 10 Audit every resident and bird character against anatomy rules.
- [ ] 11 Audit pixel density, lighting, outlines and material consistency.
- [ ] 12 Produce and verify the targeted replacement queue.
## Market

- [ ] 13 Complete primary effect, target and cost in one decision view.
- [ ] 14 Optional supplementary rules instead of a serial reading tunnel.
- [x] 15 Simplify signage, frames and background competition.
- [ ] 16 Distinguish inspecting, selecting, affordability and buying.
## Cards

- [ ] 17 Readable combat effect summaries without punctuation compression.
- [ ] 18 Explicit relationship between art titles and gameplay names.
- [ ] 19 Stable cost/title/art/effect/condition hierarchy.
- [ ] 20 Consistent subject-preserving gameplay crops.
## Map

- [x] 21 Legible paths and non-color-only route states.
- [ ] 22 One selected-destination information summary.
- [ ] 23 Recognizable node types and inspection labels.
- [ ] 24 Current position, immediate choices and boss hierarchy.
## Compact layouts

- [ ] 25 Dense-screen reflow rather than uniform shrinking.
- [ ] 26 Minimum rendered font-size checks.
- [ ] 27 Secondary information drawers.
- [ ] 28 Touch targets, overlay ownership and positioning checks.
## Setup

- [x] 29 Restrained leader portraits.
- [x] 30 Concise playstyle summaries.
- [ ] 31 Clear locked-leader requirements and states.
- [ ] 32 Configuration hierarchy and launch summary.
## Combat

- [ ] 33 Actionable HUD priority.
- [ ] 34 Contact shadows, grounding, scale and lighting.
- [ ] 35 Consistent targeting and action feedback.
- [ ] 36 Measured motion and reduced-motion interaction verification.
## Collection and events

- [ ] 37 Secondary advanced Collection controls.
- [ ] 38 Distinct undiscovered/loading/error presentations.
- [ ] 39 Narrative context and choice hierarchy.
- [ ] 40 Exact gains, costs, conditions and irreversible consequences.
## Final polish

- [ ] 41 Title/Settings control consistency.
- [ ] 42 Screen-specific background contrast.
- [ ] 43 Gameplay-scale card/enemy review.
- [ ] 44 Full-run visual consistency and state review.

## Release gates

- [ ] Reconcile the 41 failures in run 36297889787 without weakening gates.
- [ ] Fresh uninterrupted full regression pass.
- [ ] Inspect 2560x1600, 1440x900 and 1000x560 production captures.
- [ ] Mouse, keyboard, virtual controller and emulated touch journeys.
- [ ] Delayed/failed art and module loading checks.
- [ ] Complete representative flight including rewards and upgrades.
- [x] Cleanup of all owned test servers/browsers for this implementation pass.

Human/device/AT sessions remain outside this backlog. Grades must state their
LLM-assessed scope. Historical passes do not qualify modified surfaces.

## September 29 implementation evidence and remaining scope

- Dashboard completion applies to its overview, five content tabs and separated
  save entry point. Deep editors, history and restore dialogs still need the
  shared-UI/compact-layout passes; they are not implicitly certified by 01–04.
- Ivo, Oren, Caldra and Veyra also received reviewed avian replacements. Sella
  was inspected and retained. Items 10–12 remain open until the broader bird,
  card and enemy inventory has a recorded review and replacement queue.
- Market Effect/Upgrades/Details tabs now allow direct pointer/touch access;
  full rule pages remain available and purchases remain deliberate. Keyboard
  and controller section shortcuts, and all-card single-view effect coverage,
  are still open under 13–14. No full Market grade is claimed.
- Setup portraits are lazy, aspect-preserving, hidden on return home, and
  nonblocking when downloads fail. Locked requirements still need the complete
  keyboard/controller discovery pass (31); launch-summary work remains (32).
- Production captures cover 2560×1600, 1440×900 and 1000×560 for the modified
  dashboard, residents, Market, map and setup. The release capture gate above
  means the complete product, not only those modified screens.
- New regression coverage lives in `tests/a-grade-ui.spec.ts`. The Showcase
  title/card overlap was found visually and now has an explicit geometry check.
- The previous remote 603-case release run's 41 failures are not reconciled by
  focused local passes. Full regression, complete flights and delivery gates
  must remain open until freshly qualified.
- Final build passed 19 focused browser cases, including all modified surfaces,
  remapped Market/setup input, late/failed portrait requests and a failed optional
  module. The preceding 37-case run passed 36; its one obsolete Market panel
  coordinate assertion was updated to the intentionally moved panel and passed
  in the final run. Broader save/restore, rewards, upgrades, Folios and compact
  control checks passed in that preceding run. These are not 603-case release
  evidence. Runtime data/assets, documentation, bundle and local deployment-cache
  checks pass; the existing preferred entry/boot-size warnings remain.

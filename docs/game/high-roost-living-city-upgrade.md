# High Roost + The Living City

User request: implement the full upgrade, complete all items, run the full release
tests, commit, push, merge, publish GitHub Pages, and clean up branches.

## Acceptance

- [x] Six distinct final-district encounters with tactical purpose before combat.
- [x] Warden with selectable shield and signal perches, forecast/live parity,
  distinct openings, defensive and aggressive responses, safe phase transition.
- [x] Three durable resident consequences tied to earlier choices.
- [x] Three choice-sensitive, skippable ending scenes, finishing flock and replay invitation.
- [x] Predawn-to-morning presentation, cables, rooftop birds, answering calls,
  brace/stagger/recovery poses, reduced motion and protected decision UI.
- [x] Pressure/recovery/commitment pacing and fewer repetitive cleanup turns.
- [x] Focused mechanics, save failure, reload, browser and high-resolution checks.
- [x] Full release suite, PR merge, Pages verification and branch cleanup.

## Design contract

The Two Perches, Hold the Crossing, Tangled Approach, The Molt Window, Split the
Watch and Last Courier retain their encounter IDs. The opening formation has
three distinct roles instead of four repeated attackers. Sentinel and Falcon
have 24/22 Cohesion, support → attack → recovery cycles, and existing bird art.
Sentinel gives its front living ally 8 Cover; Falcon gives its front living ally
3 stored attack. Removing a perch prevents future support; already stored force
remains visible. Support uses existing shared live/forecast verbs. The Warden has
68 Cohesion; its half-health transition clears Cover and force before the next
telegraphed move. Existing Winded/hit disruption remains available once per fight.

An earlier Sella visit plus trust opens a one-time 8-Cohesion shelter stop, disabled
at full health. Oren's completed ferry opens a one-time supply crossing granting
3 Open Sky Guard next fight. Ivo's completed relay reveals the exact authored
Phase II loop and perch interaction. Existing Spires delivery rewards remain.
All claims use journaled save rollback, persist in cityAid, and cannot be repeated.

The ending uses actual shelter help, ferry pledge/completion and relay
pledge/completion. Three user-paced scenes can be skipped or replayed. The existing
finishing-flock gallery follows; a specific invitation targets an unfinished
resident story, otherwise Ten Familiar Wings. No automatic new-run launch.

Presentation lives in a lazy module with a 14 KiB cap, shares the existing tick,
owns no input, and cleans up scene events/tweens. Still poses and scenery remain
in reduced motion. Existing human/device/accessibility waivers remain explicit;
prepared playtest instructions are not evidence of completed sessions.

## Verification

Local production build and 13 focused encounter/story/intent/parity checks passed.
The reduced-motion lifecycle case additionally verifies bounded scenery, purpose
before commitment and event cleanup after the queued scene shutdown. Fourteen
Flyway unit cases pass, including duplicate/invalid favor normalization. Shared
unmodified web-game client reached real combat and played a card without errors.
Reviewed rendered 2560×1600, 1440×900 and 1000×560 layouts. Runtime, asset, docs,
bundle, cache and release-policy checks pass. Final Pages boot measured 716.9 KiB:
above the 710 KiB preferred target, below the unchanged 725 KiB hard cap. The lazy
High Roost module is 8.7 KiB against its 14 KiB cap. No physical-device FPS claim
is made.

### Release completion — 2026-10-26

- [PR #14](https://github.com/willtran87/project-bird-squad/pull/14) merged as
  `d87bd9c1`. The subsequent atmosphere-test correction `5142217a` is the
  published game revision; final record edits are documentation only.
- [Release run 40325340530](https://github.com/willtran87/project-bird-squad/actions/runs/40325340530)
  passed 1,043 unique core tests across all regression shards, 17 campaign cases
  and four live-control journeys. Separate browser qualification passed 189 cases
  (63 each on Chromium, Firefox and WebKit; intentional overlap with core tests).
  Logs were reconciled with no failed, skipped, flaky or duplicate core cases.
- All 23 unit/policy checks, content/assets/contracts, delivery budgets, cache
  checks and the actual Pages-base smoke passed. The workflow deployed its
  clean-source artifact from `5142217a7dad2bca2826c2ab497ace58ad9b65ab`.
- Public HTML and app-chunk hashes match that artifact. Four checks against
  [the public game](https://willtran87.github.io/project-bird-squad/) passed:
  perch/phase forecast parity, durable resident claims and rollback, completed
  choice ending/skip, and bounded reduced-motion scenery with encounter purpose.
- The merged feature branch was deleted locally and remotely; only `main`
  remains. Owned preview servers were stopped.

### Repairs found during verification

- Restricted the new phase audio handler to BattleScene, preserving route silence.
- Preserved breathing/hit tweens when changing Roost stances, distinguished ally
  Cover/Charge Tells, and extended the dawn overlay to the full backdrop.
- Corrected optional favor normalization while preserving older save serialization.
- Updated map-inspection expectations for the new purpose text without dropping
  geometry or immutability checks. The legacy boss-atmosphere test now checks the
  three Roost stances while retaining other districts' idle-presentation checks.
- Made the resident reload test await the queued RouteScene resume before
  reopening its journal. Corrected fixture phase updates and innate Guard accounting.

Earlier superseded CI attempts and Windows WebKit shutdown stalls are not counted
as passes. Final Linux qualification passed all three browsers. Existing human,
physical-device and native assistive-technology waivers remain unchanged; the
updated playtest handoff is ready, but no human sessions are claimed.

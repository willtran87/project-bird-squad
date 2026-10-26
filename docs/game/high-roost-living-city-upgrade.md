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
- [ ] Focused mechanics, save failure, reload, browser and high-resolution checks.
- [ ] Full release suite, PR merge, Pages verification and branch cleanup.

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
bundle, cache and release-policy checks pass. Boot measured 715.6 KiB: above the
710 KiB preferred target, below the unchanged 725 KiB hard cap.

Full release matrix, publication and live verification pending.

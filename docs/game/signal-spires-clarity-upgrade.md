# Signal Spires + Combat Clarity

User request: implement the full milestone, complete all items, run full release
tests, commit, push, merge, publish GitHub Pages and clean up the feature branch.

## Acceptance

- [x] Six curated Spires crossings with distinct sequencing/tempo decisions.
- [x] Beacon-Breaker charge → broadcast → exposed cycle and multiple responses.
- [x] Three optional strategy Preens, including paid retraining for upgraded birds.
- [x] Ivo relay story, durable one-time rewards and a visible High Roost payoff.
- [x] Grounded signal lamps, cables, answering calls and bounded district effects.
- [x] Combat information protected from effects, concise truthful card summaries,
  clearer selected-card resource forecasts and appropriately paced routine actions.
- [x] Focused rules/integration/browser tests and 2560×1600, 1440×900, 1000×560 review.
- [x] Full release tests, merge, Pages publication, live verification and cleanup.

Existing version-scoped human/device/accessibility waivers remain unchanged.
Update the prepared playtest handoff for this milestone; no invented sessions,
ratings, enjoyment claims or physical-device performance claims.

## Authored behavior

Crossed Wires, Silent Relay, Open-Air Courier, Tower Shelter, The Answering Beat
and Lantern Watch retain their route IDs. Formations and move order emphasize
interrupting Settle, covering a charged dive, preserving Cover through a heavy
strike, and preparing during a non-attacking beat.

Beacon-Breaker cycles charge, broadcast, exposed. Phase I broadcasts for 8 plus
stored force; Phase II for 12 plus stored force. Charge adds 4 force and 6 Cover;
the exposed beat grants 0 Cover and does not attack. The half-health transition
clears existing Cover/force. Applying 2 Winded disrupts one boss attack per fight.
Escorts remain independent; the exposed boss does not make their attacks safe.

Patient Watch costs 2 Wingbeats and banks 1 for next turn while retaining two
cards. Relay Chorus rewards Basins before Plumes and Quills before its Molt form.
Storm Aperture refunds its 1-Wingbeat entry cost but adds Open Sky with no active
Guard; its Molt strike loses 4 Cover. Normal Spires Preens and optional 25-Scrap
retraining share these exact rules. Retraining requires confirmation, preserves
canonical passive stats and rolls back on save failure.

Ivo's 18-Scrap wires/lenses pledge needs two new Spires victories or the boss
defeat. Wires grant 1 opening-turn Wingbeat next fight; lenses grant 2 Open Sky
Guard. After collection, High Roost offers one final delivery: 1 opening-turn
Wingbeat, plus 2 Guard if Oren's ferry was restored. All gifts persist through
reload and are collected only once. Decorations use existing artwork, static
cables and event-driven lamps (maximum two transient groups, 650 ms lifetime).

Combat effects stay below the hand, HUD and enemy Tell labels. Intro and reward
presentations retain their separate ordering. Card faces show at most two
complete effect clauses with explicit omission markers and full inspection.
Selected-card forecasts lead with remaining Wingbeats, including refunds.
Ordinary attack/support commitments are 200/140 ms before pace scaling;
cinematic pacing and readable enemy timing are preserved.

## Local verification

- Production build, 15 rules/draw unit tests, seven release-policy unit tests,
  content/assets, documentation, enemy contracts, overlays, bundle/cache checks
  and policy validation passed. Existing evidence waivers remain explicit.
- Final Chromium run: 49 focused cases passed, plus two forecast/layout
  regressions. Firefox: all 22 new integration cases passed. The shared gameplay
  client ran against the final production build; its screenshot was inspected.
- Windows WebKit reported all 22 individual cases passing but stalled during
  worker shutdown without writing its final JSON report. The owned runner was
  stopped; this is not recorded as a clean completed suite. Linux CI provides
  the release WebKit gate.
- Screenshots at 2560×1600, 1440×900 and 1000×560 were inspected for Preen
  choices, encounter purpose, selected-card forecast/inspection, boss effects
  and relay delivery. The reaction caption was raised above portrait art while
  its decorative echo remains below the protected combat UI.
- Verification exposed and fixed paid Aviary Molt cards incorrectly receiving
  the normal-card discount: runtime kind now controls the rule. Full inspection
  was also moved above battle effects. The old Canal isolation assertion now
  checks Canal cues specifically because Signal Spires has its own calls.

Evidence: `.artifacts/spires-final-focused.json`, `.artifacts/spires-forecast.json`,
`.artifacts/spires-firefox.json`, `.artifacts/spires-webkit.log`,
`.artifacts/spires-final-client/` and corresponding screenshot directories.
Full release and publication evidence follows after the CI gates finish.

The first full PR run exposed an old pause-layer assertion that required combat
effects above the battle UI. It now asserts the intended protected UI ordering
both while paused and after closing, with the pause overlay above both layers.
The complete pause/input/time-freeze test passes locally with these assertions;
original failure evidence remains in PR run 40283131686 and
`.artifacts/spires-pause.log`. Final local result: `.artifacts/spires-pause-final.json`.

The full run also found the added resource line displacing Surge and boss
Cover-reset information from the compact forecast model. The new Wingbeat slot
now preserves the existing three outcome slots (two before a required choice).
The renderer still measures and bounds the visible excerpt, shows omissions,
and retains all outcomes in Full rules and narration. Both original regressions,
the pause check and three responsive forecast/inspection checks pass on the
repaired production build: `.artifacts/spires-forecast-final.json`. The shared
client was rerun and visually inspected in `.artifacts/spires-release-client/`.
The local actual-Pages-base smoke also passed: `.artifacts/spires-pages.json`.

## Release verification

PR run [40283131686](https://github.com/willtran87/project-bird-squad/actions/runs/40283131686)
completed 1,029 passing core cases, the three failures described above, and all
156 browser qualification cases. All 29 test-job logs were reconciled in
`.artifacts/spires-pr-verification.json`. The fixed commit is `7d73ccef`;
[PR #13](https://github.com/willtran87/project-bird-squad/pull/13) merged as
`5202143493ec4ba1a3927791ac73daa14939de10`. The duplicate post-fix PR run was
canceled after merge; the first main release attempt is 40285945858.

That main attempt passed 1,031 core and all 156 browser cases, including all
three repaired PR failures. One existing route-exit geometry test sampled the
lazy confirmation before both real input receivers were available. Five local
reruns passed unchanged; an explicit redraw probe confirmed the transient
missing-controls window. The test now polls for both reachable confirmation
buttons and applies the unchanged geometry checks to that same snapshot. This
does not change game code or relax target-size, spacing or accidental-abandon
checks. Evidence: `.artifacts/spires-exit-registration.json`,
`.artifacts/spires-exit-repro.json`, and `.artifacts/spires-exit-snapshot-final.json`.
A fresh full main release run qualifies this test-readiness repair.

The final local root build's combined boot code is 715.4 KiB, above the 710 KiB
preferred target and below the unchanged 725 KiB release ceiling. The lazy
Signal Spires module is approximately 7 KiB against its 12 KiB cap, with no
new artwork downloads. No physical-device performance improvement is claimed.

The final main run [40289945992](https://github.com/willtran87/project-bird-squad/actions/runs/40289945992)
at `160613c1e39e2a4084e0082509e89c3757504882` passed all **1,032 unique core
tests** and all **156 browser qualification cases**. All 29 test-job logs were
reconciled, with zero failed, skipped or flaky cases in this final run. This
includes 17 campaign progression cases and four live-control journeys. All
earlier failures remain documented above and are superseded by this clean run.

Case-level evidence: `.artifacts/spires-main-test-verification.json`.

## Published release

- Release run 40289945992 completed successfully, including build and Pages
  deployment of `160613c1e39e2a4084e0082509e89c3757504882` on 2026-10-26.
- All 22 unit/policy tests, content/assets/contracts, docs, overlays, bundle/cache
  checks and the actual Pages-subdirectory smoke passed. The Pages boot total
  is 716.5 KiB, below the unchanged 725 KiB release ceiling (preferred: 710 KiB).
- [The public game](https://willtran87.github.io/project-bird-squad/) matched
  the tested artifact's HTML, loader and both app-chunk hashes at 08:34 UTC.
- Three public-site checks passed: saved Storm Aperture Molt cost/live rules;
  Ivo's wires after two real victories, one-time collection and High Roost
  delivery; Beacon-Breaker phase/reset, forecast parity, recovery, disruption
  and bounded effects. Live screenshots were inspected at 2560×1600, 1440×900
  and 1000×560.
- The merged `codex/signal-spires-clarity` branch was deleted locally and
  remotely after verifying both refs' ancestry. Owned previews and test runners
  were stopped. Final record edits are documentation only; the published game
  revision remains `160613c1`.

Local release evidence: `.artifacts/spires-main-verification/` (downloaded CI
artifact), `.artifacts/spires-live-identity.json`, `.artifacts/spires-live-results.json`
and `.artifacts/spires-live/` (screenshots). Human, physical-device and
assistive-technology waivers remain unchanged; no such sessions were performed.

# Canal Markets upgrade

User request: implement the full Canal Markets upgrade, complete all items,
run full release tests, commit, push, merge, publish Pages and clean branches.

## Acceptance

- [x] Six curated encounters: Pantry Line, Net & Shell, Loaded Barge,
  Three-Card Crossing, False Mooring and Lock Release.
- [x] Gatekeeper Phase II changes from escort management to a charged strike
  and a disclosed recovery window, preserving the once-per-fight disruption.
- [x] Six optional named Preen alternatives, two for each existing strategy,
  with explicit active-rule costs/benefits and durable save reconstruction.
- [x] Oren's ferry story: invest, clear two Canal battles, reopen the crossing,
  claim one reward, retain visible consequences and journal memory.
- [x] Teal water/brass lighting, bounded canal effects and distinct sound cues,
  with reduced-motion, mute, input ownership and lazy-load recovery preserved.
- [x] Meaningful rules/integration/campaign/browser tests and visual inspection
  at 2560×1600, 1440×900 and 1000×560.
- [x] Full release gates, live verification, commit/push/merge/publication and
  cleanup of this task's branch.

Existing version-scoped human/device/accessibility waivers remain unchanged.
Automated wins, test coverage and visuals do not establish human enjoyment.

## Player-facing changes

The six crossings keep their stable encounter IDs and authored route pools.
Their formations now present different decisions: deny healing, stop Snags,
prepare for a charged dive, keep a compact turn, interrupt a feint, or cover
both hits of Twin Press. Their introductions state the tactical purpose.

The Gatekeeper's second phase cycles Charge Floodgate, Release, then Reset the
Sluice. The charge grants 6 Cover and +4 to its next 12-damage attack. The reset
grants 3 Cover without attacking. Crossing half Cohesion breaks existing Cover
and stored force. Hit the boss and strip its Cover to disrupt one attack per
fight; escort actions remain independent.

| Strategy | Bird | Two optional Canal Preens |
| --- | --- | --- |
| Hold & Answer | Locked Nest | Mooring Anchor: immediate Cover; Countercurrent: retention and conditional next-turn draws |
| Chorus Engine | Plume Flash | Ferry Chorus: conditional draws and Resonance; Lockstep Cadence: conditional burst damage |
| Storm Window | Hot Feathers | Sheltered Harbor: pay 1 Wingbeat for protection; Running Current: free entry with draws, without the normal active Guard |

These replace active upgrade effects and preserve canonical passive Flock Stats.
Shelter and Flight remain available. Choices are offered at Canal Preen services
and rewards; the saved branch remains effective in subsequent districts.

Oren's optional 15-Scrap pledge reopens the ferry after two new Canal victories
or the Canal boss's defeat. Timber restores up to 8 Cohesion; lamps grant 2 Open
Sky Guard for the next fight. Payment and collection use the existing durable
checkpoint with rollback on failure. The reward is granted once; the ferry,
resident trust and journal preserve the consequence.

## Verification record

Initial focused testing exposed a real cost-reconstruction error: Sheltered
Harbor displayed 1 Wingbeat but cost 0 after reloading. Saved and reward upgrades
now apply the chosen upgrade's cost. The new integration case checks actual
energy spent, active normal/Molt effects and preview/live damage parity.

The presentation loads after entering Canal Markets (or resuming its story),
stays off title boot, and offers the existing download recovery flow. It adds
no per-frame loop. At most two ripple groups exist, each with one reduced-motion
ring or three ordinary rings, retiring after 750 ms. Sound uses the existing
mute, volume, cue budget and audio-node cleanup. No new image payload is added.

Local build, 13 rules/draw units, documentation, content, asset, enemy-contract,
overlay, deployment-cache and release-policy checks pass. The Canal chunk is
5.5 KiB against a new 10 KiB cap. Combined app boot code is 713.4 KiB: above the
710 KiB preferred target, below the unchanged 725 KiB release ceiling. No
physical-device frame-rate gain is claimed.

The shared gameplay client exercised real inputs and produced screenshots/text
state in `.artifacts/canal-client-final`. Visual review includes 2560×1600,
1440×900 and 1000×560. Chromium, Firefox and WebKit qualification each passed
all 30 cases on merged revision `10f49f6f`, including the 18 Canal scenarios.
Final full-suite and deployed-build evidence is recorded below.

All 18 Canal scenarios have passing focused evidence, including final boss and
mute reruns, plus the updated all-district boss-footer check. The initial mute
fixture used `true` instead of the game's stored `1` and accessed storage on
`about:blank`; both test setup errors are corrected. The complete Canal suite
passed together in all three CI browsers. Existing campaigns and input journeys
also passed on the merged build.

The first CI attempt exposed Firefox test synchronization races: the ferry
journey could select an already-cleared reward during the queued route
transition, and recovery checked scene activity before the resume frame.
The tests now wait for a populated reward choice or the active Route scene,
and poll for resume. Gameplay assertions and release gates are unchanged.

WebKit then exposed a redundant close/reopen between ferry readiness and reward
collection, and teardown-origin errors from cancelled outcome image requests.
The journey now collects from the already-open journal; error assertions run
before navigating away from the app. All three affected WebKit cases pass
locally. These are test-lifecycle fixes, not waived gameplay failures.

The full regression also found the intent catalog's old 222-move expectation.
The three added Gatekeeper moves correctly raise the catalog to 225. The
updated catalog and label tests pass, including written-rule descriptions and
bounded labels at all three viewports; no production change was needed.

The merged main release run [40243283305](https://github.com/willtran87/project-bird-squad/actions/runs/40243283305)
passed all 1,010 unique core tests and all 90 browser qualification cases. All
29 test-job logs were reconciled with no failed, skipped or flaky cases. This
includes 17 campaign progression cases and four live-control journeys. The
earlier PR run's sole stale catalog expectation is superseded by this clean
full run; its original failure evidence is retained.

Local case-level evidence: `.artifacts/canal-main-test-verification.json`.

## Published release

- [PR #12](https://github.com/willtran87/project-bird-squad/pull/12) merged as
  `10f49f6f22d9c7a38c22eb93f24e6d96ae1794d7` on 2026-10-25. Release run
  40243283305 completed successfully, including build and Pages deployment.
- All 20 unit/policy checks, content/assets/contracts, documentation, overlays,
  bundle budgets, cache checks and the actual Pages-subdirectory smoke passed.
- The Pages build's combined boot code is 714.5 KiB, above the 710 KiB preferred
  target but below the unchanged 725 KiB release ceiling. Its Canal module is
  5.6 KiB against the 10 KiB cap. Root-build figures above are recorded separately.
- [The public game](https://willtran87.github.io/project-bird-squad/) matched
  the CI artifact's HTML, loader and both app-chunk hashes at 23:37 UTC.
- Three additional public-site checks passed: Sheltered Harbor's saved cost and
  live rule execution; ferry lamps after two real victories with one-time reward
  persistence; Gatekeeper phase, charge/recovery, disruption and bounded effects.
  Live screenshots at 2560×1600, 1440×900 and 1000×560 were inspected.
- The merged `codex/canal-markets` branch was deleted locally and remotely after
  checking ancestry. The owned local preview was stopped. Final record edits
  are documentation only; the published game revision remains `10f49f6f`.

Local release evidence: `.artifacts/canal-main-verification/` (downloaded CI
artifact), `.artifacts/canal-live-identity.json`, `.artifacts/canal-live-results.json`
and `.artifacts/canal-live-results/` (screenshots). Existing human, physical-device
and assistive-technology waivers remain in force; these sessions were not performed.

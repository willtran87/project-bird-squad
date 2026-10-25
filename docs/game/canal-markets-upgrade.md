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
- [ ] Meaningful rules/integration/campaign/browser tests and visual inspection
  at 2560×1600, 1440×900 and 1000×560.
- [ ] Full release gates, live verification, commit/push/merge/publication and
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
1440×900 and 1000×560. Full CI and deployed-build evidence will be recorded here
after qualification; unfinished release gates are not counted as passing.

All 18 Canal scenarios have passing focused evidence, including final boss and
mute reruns, plus the updated all-district boss-footer check. The initial mute
fixture used `true` instead of the game's stored `1` and accessed storage on
`about:blank`; both test setup errors are corrected. The complete final suite
will run together in CI, including the existing campaigns and input journeys.

The first CI attempt exposed Firefox test synchronization races: the ferry
journey could select an already-cleared reward during the queued route
transition, and recovery checked scene activity before the resume frame.
The tests now wait for a populated reward choice or the active Route scene,
and poll for resume. Gameplay assertions and release gates are unchanged.

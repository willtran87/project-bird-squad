# Flyway expansion — October 23, 2026

User authorization: implement all 18 proposals from the next-level ideas list.
This ledger tracks implementation and evidence; unchecked entries are unfinished.
Existing shared-Flock combat, singleton cards, input accessibility, save recovery,
practice isolation, and reduced-motion preferences remain supported.

## Acceptance ledger

- [x] 01 Coordinated Molt transformation and Open Sky presentation: captions, wing shapes, backdrop wash, hand rail and music state.
- [x] 02 Earned, player-activated abilities for all five Leaders: visible charge, explicit activation, once per combat.
- [x] 03 Three discoverable cross-suit combinations: journal conditions, consecutive suit tracking, once per turn, preview integration.
- [x] 04 Authored boss disruption conditions: four district rules, visible Tell changes, one disruption per boss fight.
- [x] 05 Shelter and Flight Preen branches for six signature cards: manual choice, cancellation, canonical and Molt effects, save reconstruction.
- [x] 06 Woven Roost, Storm Pin and Light Travel: optional strategic keepsake slot with benefits and explicit costs.
- [x] 07 Signature bird action cameos: canonical sparrow, shrike and heron portraits, owned transient effects.
- [x] 08 Four suits have distinct physical effects paired with their existing sound signatures.
- [x] 09 Five Leader and four boss personality poses/tweens, with reduced-motion handling.
- [x] 10 Battlefield impact rings, wingbeats and phase-change paper lift.
- [x] 11 Phrase-aligned music states for planning, Flow, Surge, Molt, Open Sky and boss phase II.
- [x] 12 Four district tints, ambient materials/weather motifs, impact shapes and musical progression.
- [x] 13 District victories persist restoration and reveal full-color connected city panels.
- [x] 14 Sella, Ivo and Oren remember contributions and provide later district consequences.
- [x] 15 Caldra's recurring Pinion Crew tracks victories and discloses its Cover/damage adaptations.
- [x] 16 Crosswind, heavy rain and scaffold conditions disclose their costs and once-only victory bonuses.
- [x] 17 Three permanent fixed-seed Flight Stories with authored goals and distinct cosmetic seals.
- [x] 18 Illustrated ending archive retains actual birds, branch choices, city restoration and this flight's decisions.

## Implementation order

1. Typed expansion state, authored content, compatibility, pure rule tests.
2. Combat integration, deliberate controls, previews, branching upgrades.
3. Presentation and adaptive music, bounded effects and cleanup.
4. Route consequences, residents, rival, restoration, stories and ending.
5. Production build, meaningful integration tests, shared gameplay client,
   2560×1600 / 1440×900 / 1000×560 visual inspection and regression checks.

## Evidence

Implementation is complete. The original evidence below is supplemented by
the [full release qualification](../project/flyway-release.md), including
campaigns, live-control journeys, release fixes and passing affected reruns.
Subjective player enjoyment is not established by automated tests.

### Implementation map

- [Authored rules and state](../../src/game/flyway-rules.ts): items 02–06 and 13–18.
- [Journal and presentation](../../src/game/flyway-expansion.ts): all player-facing
  expansion controls, presentation, stories and archive.
- [Combat integration](../../src/main.ts): real card/Leader effects, boss rules,
  costs, progression, save reconstruction and durable settlement receipts.
- [Adaptive music](../../src/game/adaptive-music.ts): item 11 and district audio.
- [Focused browser tests](../../tests/flyway-expansion.spec.ts) and
  [pure rule tests](../../tools/tests/flyway-rules.test.mjs).

### Verified results

49 distinct focused checks passed across the recorded runs:

- 24 new browser cases: 21 passed in `flyway-production-tests.log`; the final
  focused run passed five cases, comprising two affected rechecks and three new
  cases (`flyway-final-focused.log`). These cover real card plays and calls,
  branch commit/cancel/reload, residents, settlement recovery, boss disruption,
  journal input ownership, all music states, stories/seals, and bounded FX.
- 18 existing regression cases: 15 initially passed in `flyway-regressions.log`.
  Three manual/automatic Preen regressions were fixed and all three passed in
  `flyway-preen-regressions.log`. Existing tests were not weakened.
- Seven pure rule cases passed in `flyway-unit-final.log`.
- Strict TypeScript and production build passed (`flyway-candidate2-build.log`).
- Documentation, runtime data, runtime assets, hard bundle budgets and deployment
  cache/security contracts passed (`flyway-*-validation.log`,
  `flyway-final-bundle.log`, `flyway-final-cache.log`).
- Final build identity: `.artifacts/flyway-build-evidence.json`.
- The unmodified shared gameplay client started a flight and played a card on
  production: `.artifacts/flyway-final-play/{state-0.json,shot-0.png}`; no client
  error file was produced.

All evidence paths above are under repository-local `.artifacts/` and are not
tracked source. The entire existing suite was subsequently run during release
qualification; its original failures and corrected reruns are recorded there.

### Visual review and practical limits

Journal and battle/Molt captures were checked at 2560×1600, 1440×900 and 1000×560
under `.artifacts/flyway-production-results/`. All four district boss stages
were checked at 2560×1600 under `.artifacts/flyway-final-focused/`. The ending
archive and final title button placement were checked; the title capture is
`.artifacts/flyway-final-title.png`. New controls remain readable and reachable,
with scroll access at small sizes and no horizontal journal overflow.

Canonical art is reused for cameos and restoration panels; personality uses
procedural poses and tweens. Entry code is 679.3 KiB and combined boot code is
721.4 KiB: below the unchanged 700/725 KiB hard limits, above the preferred
675/710 KiB targets. The follow-up [audit](../project/flyway-audit.md) supersedes
the original network-recovery coverage and records nine fixes, including
explicit checkpoint reload recovery. The later release report supersedes the
original audit's campaign and publication scope limits.

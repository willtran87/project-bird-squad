# Bird Squad Alpha Run Spec

Version: 0.1

Status: code-ready content target for the first playable roguelike slice.

Related sources:

- `docs/game/game-design.md` defines overall direction and player-facing terms.
- `docs/game/core-gameplay-spec.md` defines combat, cards, Flock Stats, and
  Molt.
- `docs/game/run-design-spec.md` defines the four-map route structure, Route
  Marks, Scrap, Markets, Signals, Supplies, Snags, Rival Crews, and boss
  rewards.
- `data/game/alpha-cards.json`, `data/game/alpha-enemies.json`, and
  `data/game/alpha-route-map.json` are the runtime-ready Alpha data mirrors of
  this spec.

## Purpose

The Alpha Run proves Bird Squad can work as a deckbuilding roguelike, not only a
combat prototype. It was intentionally Map 1 only, polished enough to test the
core loop before building the remaining three maps.

Map 1 only: Rooftop Blocks.

**Status (scope expanded):** the alpha slice is achieved, and the build has since
grown past it — all four districts (Rooftop Blocks → Canal Markets → Signal
Spires → High Roost) are wired and playable, and the full 84-card arcana deck is
implemented. This document still owns Map 1's reference tuning; the targets below
describe that Map 1 slice, not a cap on the shipped build.

Alpha should answer one question:

> Is it fun to restore the first broken flyway through card combat, route
> choices, Flock growth, Route Marks, Scrap, Signals, Supplies, and a boss?

## Alpha Scope

| Area | Alpha Target |
| --- | --- |
| Maps | All 4 districts are playable; Map 1 (Rooftop Blocks) is the tuning reference detailed below. |
| Route length | 6-8 nodes plus boss. |
| Normal enemies | 3. |
| Rival Crew | 1. |
| Boss | 1 rival bird crew leader. |
| Starter deck | 10 cards. |
| Reward pool | 74 cards (every non-starter playable card; the full arcana deck is implemented). |
| Route Marks | 10. |
| Supplies | 5. |
| Signals | 5. |
| Snags | 3. |
| Market | 1 inventory model. |
| Basin Stop | 1 recovery rule set. |
| Nest Workshop | 1 upgrade/removal rule set. |

Out of scope for the original Alpha cut (note: Maps 2-4 have since shipped as
playable routes):

- Favors
- broad Bad Signal system
- Flock Leader variants
- complex event chains
- advanced parked mechanics such as Mark, Bond, Shine, Scry, Discover, Retain,
  Seed, Route, and temporary cards

## Map 1 Frame

Map 1 is `Rooftop Blocks`.

Narrative:

The local roofline is the first broken flyway. Old chalk marks have faded,
repair perches are stripped, and a rival corvid line-worker is charging passage
through the best crossing. The flock needs to reopen this route before it can
reach the Canal Markets.

Alpha map promise:

- teach the route map
- teach enemy Tells
- teach Cover and damage
- teach recovery pressure
- teach `Add to the Flock`
- teach `Preen a Card`
- introduce Scrap and Markets
- introduce Route Marks and Supplies
- end with a boss that tests Molt and Open Sky

## Route Shape

Alpha should use a small deterministic route graph before procedural generation
is generalized.

| Column | Node Options | Notes |
| --- | --- | --- |
| 0 | Street Encounter | Fixed opening fight. |
| 1 | Street Encounter, Signal | First route choice. |
| 2 | Basin, Nest, Street Encounter | First recovery versus upgrade decision. |
| 3 | Rival Crew, Market, Rooftop Cache | Risk/reward fork. |
| 4 | Street Encounter, Signal | Final tuning before boss lane. |
| 5 | Basin, Nest | Last safety or power choice. |
| 6 | Boss | Fixed endpoint. |

Minimum route requirements:

- every route has at least 3 combats before the boss
- every route has at least 1 non-combat node
- every route offers either a Basin or Nest before the boss
- at least one route exposes the Rival Crew
- at least one route exposes the Market

## Starting Run State

| Value | Alpha Target |
| --- | ---: |
| Starting Cohesion | 36 |
| Starting Wingbeats | 3 |
| Starting hand target | 5 |
| Starting Resonance cap | 5 |
| Starting Scrap | 60 |
| Supply slots | 2 |
| Starting Route Marks | 0 |
| Starting Snags | 0 |

## Starter Deck

The starter deck should teach all four suits and Molt. It is also the baseline
for tuning enemy health.

| ID | Card | Suit | Cost | Base Effect | Improved Effect |
| --- | --- | --- | ---: | --- | --- |
| `major_00` | First Flight | Legend | 1 | Deal 3. Gain 2 Cover. First time played each combat, draw 1. | Deal 5. Gain 4 Cover. First time played each combat, draw 1. |
| `wands_ace` | Plume Flash | Plumes | 1 | Deal 2. Gain 1 Resonance. | Deal 3. Gain 2 Resonance. |
| `wands_08` | Plume Rush | Plumes | 0 | Draw 1. If Molting, gain 1 Wingbeat. | Draw 2. If Molting, gain 1 Wingbeat. |
| `swords_02` | Crossed Quills | Quills | 1 | Deal 4, or 7 if the target is below half health. | Deal 5, or 9 if the target is below half health. |
| `swords_ace` | Quill Point | Quills | 1 | Deal 3. Apply 1 Winded. | Deal 5. Apply 1 Winded. |
| `cups_ace` | Open Basin | Basins | 1 | Heal 3 Cohesion. If at full Cohesion, draw 1. | Heal 5 Cohesion. If at full Cohesion, draw 1. |
| `cups_03` | Basin Chorus | Basins | 1 | Heal 2 Cohesion. Draw 1. | Heal 3 Cohesion. Draw 1. |
| `pentacles_04` | Locked Nest | Nests | 1 | Gain 7 Cover. | Gain 10 Cover. |
| `pentacles_02` | Nest Juggle | Nests | 1 | Gain 4 Cover. Draw 1, then discard 1. | Gain 6 Cover. Draw 1, then discard 1. |
| `aviary_25` | Hot Feathers | Molt | 0 | Enter Molt. | Enter Molt. Gain 1 Open Sky Guard this combat. |

## Alpha Reward Pool

The full arcana deck (84 playable cards) is implemented; the reward pool is every
playable card not in the starter deck, so any card can be acquired across a run.

Reward rules:

- Rewards offer up to 3 unowned cards.
- Reward cards must respect singleton ownership.
- Offers are rarity-weighted (common 100 / uncommon 45 / rare 16 / legendary 5),
  so Common/uncommon rewards dominate Map 1 and rares appear occasionally.
- Rare cards can appear, but should not solve the run by themselves.
- Legend/Legendary cards (the Major Arcana + Aviary trumps) are heavily
  down-weighted, so they read as rare treats rather than staple street rewards.

| ID | Card | Suit | Rarity | Cost | Base Effect | Improved Effect |
| --- | --- | --- | --- | ---: | --- | --- |
| `wands_02` | Twin Plume Lookout | Plumes | Common | 1 | Gain 1 Resonance. Draw 1. | Gain 2 Resonance. Draw 1. |
| `wands_03` | Plume Horizon | Plumes | Common | 1 | Deal 3. Spend 1 Resonance to draw 1. | Deal 5. Spend 1 Resonance to draw 2. |
| `wands_04` | Plume Street Party | Plumes | Common | 1 | Gain 2 Resonance. Gain 2 Cover. | Gain 3 Resonance. Gain 3 Cover. |
| `wands_05` | Plume Clash | Plumes | Common | 1 | Deal 4. Spend 1 Resonance to deal 2 more. | Deal 6. Spend 1 Resonance to deal 3 more. |
| `wands_06` | Plume Victory Wire | Plumes | Uncommon | 1 | Deal 5. If this defeats an enemy, gain 1 Wingbeat. | Deal 7. If this defeats an enemy, gain 1 Wingbeat and draw 1. |
| `wands_09` | Plume Barricade | Plumes | Uncommon | 1 | Gain 4 Cover. Gain 1 Resonance. | Gain 6 Cover. Gain 2 Resonance. |
| `swords_03` | Storm Quill | Quills | Common | 1 | Deal 5. If the enemy intends to attack, apply 1 Winded. | Deal 7. If the enemy intends to attack, apply 1 Winded. |
| `swords_04` | Sheathed Quills | Quills | Common | 0 | Gain 3 Cover. Draw 1, then discard 1. | Gain 5 Cover. Draw 1, then discard 1. |
| `swords_05` | Scattered Quills | Quills | Common | 1 | Deal 3 to all enemies. | Deal 5 to all enemies. |
| `swords_fledgling` | Quill Fledgling | Quills | Common | 1 | Deal 4. Draw 1 if the target is Winded. | Deal 6. Draw 1 if the target is Winded. |
| `swords_06` | Quill Crossing | Quills | Uncommon | 1 | Deal 6. Gain 3 Cover. | Deal 8. Gain 4 Cover. |
| `swords_07` | Quill Slip | Quills | Uncommon | 0 | Deal 3. If Molting, deal 3 more. | Deal 4. If Molting, deal 5 more. |
| `cups_02` | Twin Basin Bond | Basins | Common | 1 | Heal 2. Gain 3 Cover. | Heal 3. Gain 5 Cover. |
| `cups_04` | Closed Basin | Basins | Common | 1 | Gain 5 Cover. Heal 1. | Gain 7 Cover. Heal 2. |
| `cups_05` | Spilled Basin | Basins | Common | 1 | Heal 4. If Open Sky, gain 1 Open Sky Guard this combat. | Heal 6. If Open Sky, gain 1 Open Sky Guard this combat. |
| `cups_fledgling` | Basin Fledgling | Basins | Common | 0 | Heal 1. Draw 1. | Heal 2. Draw 1. |
| `cups_06` | Basin Memory | Basins | Uncommon | 1 | Return a non-Molt card from discard to hand. It costs 1 more this turn. | Return a non-Molt card from discard to hand. |
| `cups_08` | Basin Walkaway | Basins | Uncommon | 1 | Discard up to 2 cards. Heal 2 for each discarded. | Discard up to 2 cards. Heal 3 for each discarded. |
| `pentacles_ace` | Nest Seed | Nests | Common | 1 | Gain 5 Cover. | Gain 7 Cover. |
| `pentacles_03` | Nest Blueprint | Nests | Common | 1 | Gain 4 Cover. Next Nests card this turn gains +2 Cover. | Gain 6 Cover. Next Nests card this turn gains +3 Cover. |
| `pentacles_05` | Cold Nest | Nests | Common | 1 | Gain 6 Cover. If Cohesion is below half, gain 3 more. | Gain 8 Cover. If Cohesion is below half, gain 4 more. |
| `pentacles_fledgling` | Nest Fledgling | Nests | Common | 0 | Gain 3 Cover. | Gain 5 Cover. |
| `pentacles_06` | Shared Nest | Nests | Uncommon | 1 | Gain 5 Cover. Heal 2. | Gain 7 Cover. Heal 3. |
| `pentacles_08` | Workshop Nest | Nests | Uncommon | 1 | Gain 8 Cover. If this fully blocks the next attack, draw 1 next turn. | Gain 11 Cover. If this fully blocks the next attack, draw 1 next turn. |

## Alpha Card Implementation Contract

Alpha card data should use the normalized effect syntax from
`docs/game/core-gameplay-spec.md`. Player-facing copy may be shorter, but tests
and runtime data should preserve the ordered effect expressions below.

Flock Stat rules:

- Every Alpha card grants at least one whole-number Flock Stat.
- Base Flock Stats apply while the card is owned.
- Preen Delta applies only after the card is improved.
- These values are first-pass Alpha tuning, not final full-run balance.

| ID | Target | Tags | Base Effects | Improved Effects | Base Flock Stats | Preen Delta |
| --- | --- | --- | --- | --- | --- | --- |
| `major_00` | enemy | attack, cover, draw | `damage(target, 3); gainCover(2); if firstPlayedThisCombat then draw(1)` | `damage(target, 5); gainCover(4); if firstPlayedThisCombat then draw(1)` | `Cohesion +2; Draw +1` | `Cohesion +1` |
| `wands_ace` | enemy | attack, resonance | `damage(target, 2); gainResonance(1)` | `damage(target, 3); gainResonance(2)` | `Resonance +1` | `Resonance +1` |
| `wands_08` | none | draw, tempo | `draw(1); if isMolting then gainWingbeat(1)` | `draw(2); if isMolting then gainWingbeat(1)` | `Draw +1` | `Resonance +1` |
| `swords_02` | enemy | attack, finisher | `damage(target, 4); if targetBelowHalf then damage(target, 3)` | `damage(target, 5); if targetBelowHalf then damage(target, 4)` | `Damage +1` | `Damage +1` |
| `swords_ace` | enemy | attack, winded | `damage(target, 3); applyWinded(target, 1)` | `damage(target, 5); applyWinded(target, 1)` | `Damage +1` | `Damage +1` |
| `cups_ace` | self | heal, draw | `heal(3); if fullCohesion then draw(1)` | `heal(5); if fullCohesion then draw(1)` | `Regen +1` | `Cohesion +1` |
| `cups_03` | self | heal, draw | `heal(2); draw(1)` | `heal(3); draw(1)` | `Cohesion +1` | `Regen +1` |
| `pentacles_04` | self | cover | `gainCover(7)` | `gainCover(10)` | `Cover +1` | `Cover +1` |
| `pentacles_02` | self | cover, draw, discard | `gainCover(4); draw(1); discard(1)` | `gainCover(6); draw(1); discard(1)` | `Cover +1` | `Draw +1` |
| `aviary_25` | none | molt | `enterMolt()` | `enterMolt(); gainOpenSkyGuard(1)` | `Molt Power +1; Open Sky Guard +1` | `Open Sky Guard +1` |
| `wands_02` | none | resonance, draw | `gainResonance(1); draw(1)` | `gainResonance(2); draw(1)` | `Resonance +1` | `Draw +1` |
| `wands_03` | enemy | attack, draw, resonance | `damage(target, 3); if hasResonance then spendResonance(1); if spentResonance then draw(1)` | `damage(target, 5); if hasResonance then spendResonance(1); if spentResonance then draw(2)` | `Resonance +1` | `Damage +1` |
| `wands_04` | self | resonance, cover | `gainResonance(2); gainCover(2)` | `gainResonance(3); gainCover(3)` | `Resonance +1` | `Cover +1` |
| `wands_05` | enemy | attack, resonance | `damage(target, 4); if hasResonance then spendResonance(1); if spentResonance then damage(target, 2)` | `damage(target, 6); if hasResonance then spendResonance(1); if spentResonance then damage(target, 3)` | `Damage +1` | `Resonance +1` |
| `wands_06` | enemy | attack, tempo, draw | `damage(target, 5); if defeatsEnemy then gainWingbeat(1)` | `damage(target, 7); if defeatsEnemy then gainWingbeat(1); if defeatsEnemy then draw(1)` | `Resonance +2` | `Damage +1` |
| `wands_09` | self | cover, resonance | `gainCover(4); gainResonance(1)` | `gainCover(6); gainResonance(2)` | `Resonance +2` | `Cover +1` |
| `swords_03` | enemy | attack, tell, winded | `damage(target, 5); if targetIntendsAttack then applyWinded(target, 1)` | `damage(target, 7); if targetIntendsAttack then applyWinded(target, 1)` | `Damage +1` | `Damage +1` |
| `swords_04` | self | cover, draw, discard | `gainCover(3); draw(1); discard(1)` | `gainCover(5); draw(1); discard(1)` | `Draw +1` | `Damage +1` |
| `swords_05` | allEnemies | attack, aoe | `damageAll(3)` | `damageAll(5)` | `Damage +1` | `Damage +1` |
| `swords_fledgling` | enemy | attack, winded, draw | `damage(target, 4); if targetWinded then draw(1)` | `damage(target, 6); if targetWinded then draw(1)` | `Damage +1` | `Draw +1` |
| `swords_06` | enemy | attack, cover | `damage(target, 6); gainCover(3)` | `damage(target, 8); gainCover(4)` | `Damage +2` | `Cover +1` |
| `swords_07` | enemy | attack, molt | `damage(target, 3); if isMolting then damage(target, 3)` | `damage(target, 4); if isMolting then damage(target, 5)` | `Damage +2` | `Molt Power +1` |
| `cups_02` | self | heal, cover | `heal(2); gainCover(3)` | `heal(3); gainCover(5)` | `Cohesion +1` | `Cover +1` |
| `cups_04` | self | cover, heal | `gainCover(5); heal(1)` | `gainCover(7); heal(2)` | `Cohesion +1` | `Regen +1` |
| `cups_05` | self | heal, open-sky | `heal(4); if openSky then gainOpenSkyGuard(1)` | `heal(6); if openSky then gainOpenSkyGuard(1)` | `Open Sky Guard +1` | `Cohesion +1` |
| `cups_fledgling` | self | heal, draw | `heal(1); draw(1)` | `heal(2); draw(1)` | `Regen +1` | `Draw +1` |
| `cups_06` | choice | discard, recursion | `returnDiscard(nonMolt, +1)` | `returnDiscard(nonMolt, 0)` | `Cohesion +2` | `Draw +1` |
| `cups_08` | self | discard, heal | `discardUpTo(2); heal(2 perDiscarded)` | `discardUpTo(2); heal(3 perDiscarded)` | `Regen +2` | `Cohesion +1` |
| `pentacles_ace` | self | cover | `gainCover(5)` | `gainCover(7)` | `Cover +1` | `Cover +1` |
| `pentacles_03` | self | cover, setup | `gainCover(4); nextCoverBonus(nests, 2)` | `gainCover(6); nextCoverBonus(nests, 3)` | `Cover +1` | `Cover +1` |
| `pentacles_05` | self | cover, low-cohesion | `gainCover(6); if cohesionBelowHalf then gainCover(3)` | `gainCover(8); if cohesionBelowHalf then gainCover(4)` | `Cohesion +1` | `Cover +1` |
| `pentacles_fledgling` | self | cover | `gainCover(3)` | `gainCover(5)` | `Cover +1` | `Cohesion +1` |
| `pentacles_06` | self | cover, heal | `gainCover(5); heal(2)` | `gainCover(7); heal(3)` | `Cover +2` | `Cohesion +1` |
| `pentacles_08` | self | cover, draw-next | `gainCover(8); if fullyBlocksNextAttack then nextTurnDraw(1)` | `gainCover(11); if fullyBlocksNextAttack then nextTurnDraw(1)` | `Cover +2` | `Draw +1` |

## Alpha Enemies

Enemy intent must be visible before the player commits cards.

| Enemy | Type | Health | Lesson | Intent Pattern |
| --- | --- | ---: | --- | --- |
| Roof Rat | Normal | 20 | Read a basic attack Tell and use Cover. | Strike 6, Strike 6, Scurry: gain 4 Cover, repeat. |
| Signal Gull | Normal | 24 | Manage Brace and Scavenge. | Peck 5, Scavenge: heal 4 unless damaged this turn, Brace: gain 6 Cover, repeat. |
| Wire Hawk | Normal | 28 | Respect Heavy Strike and Open Sky risk. | Watch: apply 1 Winded, Heavy Strike 11, Strike 7, repeat. |
| Tarline Jackdaw | Rival Crew | 34 | Optional elite pressure with better rewards. | Harass 6 and apply 1 Winded, Brace 8 Cover, Heavy Strike 12, repeat. |

Normal encounter rewards:

- 25-40 Scrap
- `Add to the Flock`
- 25% chance to offer `Preen a Card`
- 15% chance to offer a common Route Mark instead of Preen

Rival Crew rewards:

- 70-90 Scrap
- `Add to the Flock` with improved rarity odds
- guaranteed `Preen a Card`
- guaranteed Route Mark offer from 3 choices

## Alpha Boss

Boss: `The Tar-Crowned Crow`

Role:

A rival corvid toll boss who controls the final rooftop crossing out of the
Rooftop Blocks. The crow is not evil for its own sake: it has been hoarding safe
route marks, Scrap, and warning access because scarcity made passage valuable.

Narrative beat:

Defeating the Tar-Crowned Crow breaks the first chokepoint, restores the local
roofline, and opens the route toward the Canal Markets.

Stats:

| Value | Target |
| --- | ---: |
| Health | 46 |
| Fight length | 6-8 player turns |
| Reward Scrap | 120 |

Intent pattern:

| Turn | Intent | Rule |
| --- | --- | --- |
| 1 | Toll Line | Gain 8 Cover. Add `Tangled Line` to discard if the Flock has no Cover. |
| 2 | Crowbar Tap | Deal 8. |
| 3 | Tar Toss | Deal 5. Apply Open Sky for 1 enemy turn if already Molting. |
| 4 | Chokepoint Call | Gain 6 Cover. Next attack deals +3. |
| 5 | Heavy Strike | Deal 13. |
| 6+ | Repeat from Turn 2 | Continue pressure until defeated. |

Boss rewards:

- choose 1 of 3 boss Route Marks
- choose 1 rare card from 3 options
- Preen 1 card
- gain 120 Scrap
- unlock Map 2 in later builds

## Route Marks

Alpha Route Marks should be simple and visible.

| Route Mark | Source | Effect |
| --- | --- | --- |
| Chalk Wingmark | Street Encounter / Cache | Start each combat with 2 Cover. |
| Rooftop Shortcut | Signal / Cache | The first time you play 3 cards in a turn each combat, draw 1. |
| Patched Harness | Market | Market Preen costs 30 less Scrap. |
| Quiet Landing | Rival Crew | The first Open Sky damage increase each combat is reduced by 1. |
| Loose Change Tin | Market / Cache | Gain 15 extra Scrap after each Street Encounter. |
| Rain Gutter | Market / Cache | Basin Stops heal 4 more Cohesion. |
| Wire Map | Market / Cache | Signals pay out 25 Scrap. |
| Feather Tape | Nest Workshop | The first card improved each run also gains `Cohesion +1` as a bonus Flock Stat. |
| Crowbar Debt | Boss | Start each combat with 1 Wingbeat on turn 1 only. |
| Reopened Roofline | Boss | At the start of each map, gain 1 Supply choice. |

## Supplies

The player can carry 2 Supplies.

| Supply | Type | Effect |
| --- | --- | --- |
| Seed Packet | Snack | Heal 6 Cohesion. |
| Signal Flare | Flare | Gain 2 Resonance. Draw 1. |
| Zip Tie Roll | Tool | Gain 10 Cover. |
| Emergency Call | Call | Gain 1 Wingbeat. Draw 1. |
| Shade Cloth | Tool | Reduce the next Open Sky damage increase by 2. |

## Signals

Signals are short narrative choices. Alpha needs five.

### Faded Chalk Line

Situation:

An old route mark is still visible under rain grime, but reaching it means
crossing an exposed billboard frame.

| Choice | Result |
| --- | --- |
| Repaint the mark. | Lose 4 Cohesion. Gain `Chalk Wingmark`. |
| Send a fast scout. | Gain 45 Scrap. Add `Bad Directions` to the discard pile. |
| Keep moving. | Reveal the next two route nodes. |

### Loose Wire Perch

Situation:

A broken wire perch can become a shortcut if the flock spends time and Scrap to
stabilize it.

| Choice | Result |
| --- | --- |
| Repair it. | Pay 50 Scrap. Gain `Rooftop Shortcut`. |
| Strip it for parts. | Gain 60 Scrap. Lose 3 Cohesion. |
| Leave it. | No effect. |

### Rain Barrel Watch

Situation:

A hidden barrel still holds clean rainwater, but a lookout warns that the route
ahead is watched.

| Choice | Result |
| --- | --- |
| Rest and refill. | Heal 8 Cohesion. Next combat starts with enemy Cover +4. |
| Trade the location. | Gain 35 Scrap and a random Supply. |
| Mark it for later. | Gain `Rain Barrel Key`. |

### Rooftop Courier

Situation:

A tired courier offers a shortcut in exchange for help clearing a Snag from its
own route.

| Choice | Result |
| --- | --- |
| Help the courier. | Preen 1 card. Add `Tangled Line` to the draw pile. |
| Pay for the shortcut. | Pay 40 Scrap. Skip the next non-boss Street Encounter. |
| Invite the courier. | Add 1 random common Plumes or Quills card. |

### Blackout Sign

Situation:

A dead neon sign blocks the route. Cutting through it could reveal a cache, but
the flock will cross under Open Sky.

| Choice | Result |
| --- | --- |
| Cut through. | Become Open Sky for the next combat. Gain a Rooftop Cache reward. |
| Go around. | Lose access to one route choice. Gain 30 Scrap. |
| Patch the sign. | Pay 30 Scrap. Gain `Signal Flare`. |

## Snags

Snags are negative cards. They do not provide beneficial Flock Stats.

| Snag | Cost | Effect | Removal Notes |
| --- | ---: | --- | --- |
| Tangled Line | Unplayable | When drawn, lose 1 Wingbeat once this turn. | Can be removed by Release a Card, Nest Workshop, or certain Signals. |
| Wet Feathers | 1 | Gain 2 Cover, then discard a random card. | Mild Snag; can occasionally help. |
| Bad Directions | Unplayable | At end of turn, shuffle this into the draw pile. | High-friction Snag; avoid adding too often. |

## Market Model

The Alpha Market should be deterministic enough to test and varied enough to
feel like a real node.

Inventory:

| Slot | Count | Rule |
| --- | ---: | --- |
| Cards | 4 | 2 common, 1 uncommon, 1 weighted random. Exclude owned cards. |
| Route Marks | 2 | Pull from non-boss Route Marks. |
| Supplies | 2 | Pull from Supply pool. |
| Services | 2 | `Release a Card`; `Preen a Card`. |

Playable prototype prices:

| Item | Cost |
| --- | ---: |
| Card offer | 65 Scrap |
| Loose Change Tin | 95 Scrap |
| Rain Gutter | 105 Scrap |
| Wire Map | 100 Scrap |
| Patched Harness | 110 Scrap |
| Preen a Card | 90 Scrap |

Full Alpha target prices:

| Item | Cost |
| --- | ---: |
| Common card | 55 Scrap |
| Uncommon card | 85 Scrap |
| Rare card | 130 Scrap |
| Route Mark | 110 Scrap |
| Supply | 45 Scrap |
| Release a Card | 75 Scrap, +25 each later use |
| Preen a Card | 100 Scrap |

## Basin And Nest Nodes

### Basin

Choose one:

| Option | Effect |
| --- | --- |
| Recover | Heal 35% of missing Cohesion, minimum 6. |
| Take Shelter | Gain 1 Open Sky Guard for the next combat and heal 4. |
| Refill Supplies | Choose 1 of 2 Supplies. |

### Nest

Choose one:

| Option | Effect |
| --- | --- |
| Preen a Card | Improve 1 owned, unimproved card. |
| Release a Card | Remove 1 non-required card. Costs 50 Scrap. |
| Reinforce Gear | Gain 1 random non-boss Route Mark if you pay 90 Scrap. |

## Rooftop Cache

Choose one of 3:

- gain 50 Scrap
- choose 1 of 2 Supplies
- choose 1 common Route Mark
- Add to the Flock from 2 common cards
- heal 5 Cohesion

## Tuning Targets

| Metric | Target |
| --- | --- |
| Average normal fight length | 4-6 turns |
| Boss fight length | 6-8 turns |
| Average Cohesion loss per normal fight | 4-9 |
| Average Cohesion loss per Rival Crew | 8-14 |
| Average Scrap before first Market | 100-160 |
| Average deck size before boss | 13-16 cards |
| Average Route Marks before boss | 1-3 |
| Average Supplies used before boss | 1-2 |

If players consistently reach the boss at full Cohesion, route pressure is too
low. If players reach the boss unable to survive one Heavy Strike, route
pressure is too high.

## Implementation Order

1. Implement Alpha card data from this spec.
2. Implement the four Alpha enemies and Tar-Crowned Crow boss.
3. Implement deterministic Map 1 route graph.
4. Implement `Add to the Flock`, Preen, Basin, Nest, Market, and Cache nodes.
5. Implement Scrap wallet and rewards.
6. Implement Route Marks.
7. Implement Supplies.
8. Implement Signals.
9. Implement Snags.
10. Tune numbers by playing full Map 1 repeatedly.

## Acceptance Criteria

Alpha is ready when:

- a player can complete or lose Map 1 through understandable decisions
- the route map creates at least two meaningful path choices
- the starter deck teaches all four suits and Molt
- every reward respects singleton ownership
- every added card changes active deck options and Flock Stats
- Route Marks visibly alter the run
- Scrap creates a real Market decision
- Supplies are useful but not required every fight
- Snags feel like a cost, not a random punishment
- Basin and Nest choices create recovery-versus-upgrade tension
- Tar-Crowned Crow feels like a route blocker
- beating the boss clearly reopens the Rooftop Blocks flyway

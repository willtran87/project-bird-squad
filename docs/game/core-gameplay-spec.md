# Bird Squad Core Gameplay Spec

Version: 1.0

Status: consolidated source of truth for combat, cards, Flock Stats, Molt, and
foundation rewards.

Related sources:

- `docs/game/game-design.md` defines the high-level product direction.
- `docs/game/run-design-spec.md` defines route-map and run-system structure.
- `docs/game/alpha-run-spec.md` defines the first playable Map 1 content slice.
- `docs/art/art-bible.md` defines visual identity and card art direction.
- `data/cards/arcana/` defines canonical card identity, species, rarity, and
  production fields.

## Purpose

This document consolidates the former combat, card mechanics, and Flock Stats
contracts. It answers:

- how combat works
- what a card is
- how rewards and improvements work
- how passive Flock Stats work
- how Molt and Open Sky work
- what implementation should build first

Alpha-specific cards, enemies, Waymarks, Signals, Supplies, and tuning live
in `docs/game/alpha-run-spec.md`.

## Foundation Rules

- Bird Squad is a card-based roguelike deckbuilder, not a tactics game.
- The player controls one shared Flock state, not individual bird units.
- The run deck is singleton: it can contain at most one copy of any card ID.
- Cards are birds joining with route memory, skill, shelter, warning patterns,
  fighting style, or survival tricks.
- Every owned playable card contributes passive Flock Stats.
- Reward samples exclude cards already in the run deck.
- Improved cards show a `+` suffix and use their improved effect.
- Foundation combat should prioritize readability before adding new mechanics.

Do not add parked mechanics to the foundation by default: Ruffled, Mark, Bond,
Shine, Scry, Discover, Retain, Cleanse, Route, Seed, replay/reflection, status
conversion, intent delay/freeze, temporary cards, or all-four-suits payoffs.

## Shared Terms

| Player Term | Rule |
| --- | --- |
| Cohesion | Shared Flock health. If it reaches 0, the flock scatters. |
| Cover | Temporary defense. Reduces incoming damage and clears at start of player turn. |
| Wingbeats | Energy. Starts at 3 each player turn. |
| Damage | Reduces enemy health. |
| Healing | Restores Flock Cohesion. |
| Draw / Discard | Moves cards through hand, draw pile, and discard pile. |
| Enemy Tell | Visible enemy intent for the next enemy action. |
| Add to the Flock | Post-encounter singleton card reward. |
| Preen a Card | Improve one owned card. |
| Flock Stats | Passive stats supplied by owned cards. |
| Resonance | Plumes tempo resource. Foundation cap target is 5. |
| Winded | Enemy deals roughly 25% less attack damage while active. |
| Molt | The next non-Molt card is cheaper and stronger. |
| Open Sky | Vulnerable aftermath after Molt; incoming damage is increased. |
| Open Sky Guard | Reduces or blocks Open Sky backlash. |

## Combat Loop

1. Start player turn.
2. Clear old Cover.
3. Draw to hand size 5, plus any Draw stat bonus.
4. Set Wingbeats to 3, plus any turn modifiers.
5. Show enemy Tells.
6. Player plays cards until done or out of Wingbeats.
7. Player chooses `Roost`.
8. Enemies resolve their Tells.
9. Status durations tick.
10. If all enemies are defeated, resolve route/reward flow.

Good turns should ask the player to choose between at least two attractive
options:

- push damage now
- build Cover before a Tell lands
- recover Cohesion
- apply Winded
- build or use Resonance
- enter Molt and accept Open Sky afterward
- draw/discard to find a better line

## Card Contract

Every playable card has:

- stable ID
- Bird Squad display name
- bird species
- type: Legend, Crew, Molt, or Aviary
- suit, if Crew
- rarity
- cost
- base active effect
- improved active effect
- passive Flock Stats
- optional Preen Flock Stat delta

Card types:

| Type | Role |
| --- | --- |
| Legend | Run-defining, rule-bending cards with strong identity. |
| Crew | Core tactical cards organized by suit. |
| Molt | Risk/reward transformation cards that create burst and exposure. |
| Aviary | Suitless bird-quality cards that add flexible field instincts without being tarot cards. |

Suit jobs:

| Suit | Crew | Foundation Job | Fiction |
| --- | --- | --- | --- |
| Plumes | Brightwing | Resonance, Wingbeat tempo, draw, chains | Display, rhythm, calls, color, performance. |
| Quills | Razorwind | Damage, Winded, conditional strikes | Sharp feathers, messages, signal cuts, tactics. |
| Basins | Tidewatch | Recovery, healing, stabilization | Rain, canals, shelter, care, recovery. |
| Nests | Brassnest | Cover, defense, bracing, setup | Materials, repairs, scaffold nests, preparation. |

Classic suit names may remain in archival data fields for tarot lineage, but
player-facing text uses Plumes, Basins, Quills, and Nests.

## Gameplay Data Contract

Card runtime data should be explicit enough that the card resolver does not need
hardcoded per-card branches except for deliberately unique Legend behavior.

Required runtime fields:

| Field | Type | Rule |
| --- | --- | --- |
| `id` | string | Stable singleton key. Must match card identity data. |
| `displayName` | string | Player-facing Bird Squad card name. |
| `kind` | enum | `legend`, `crew`, `molt`, `aviary`, or `snag`. |
| `suit` | enum/null | `plumes`, `quills`, `basins`, `nests`, or null. |
| `rarity` | enum | `common`, `uncommon`, `rare`, or `legendary`. |
| `cost` | number | Base Wingbeat cost. |
| `target` | enum | `enemy`, `allEnemies`, `self`, `none`, or `choice`. |
| `effects` | string[] | Ordered base effect expressions. |
| `upgrade` | object | Improved cost/effects/Flock Stat delta. |
| `flockStats` | object | Passive whole-number stats granted while owned. |
| `tags` | string[] | Resolver hints such as `attack`, `skill`, `heal`, `cover`, `molt`. |

Upgrade rules:

- Improved cards keep the same ID and gain a `+` display suffix.
- Upgrades may change cost, effect values, conditions, and Flock Stats.
- Upgrades should not change the card's suit, kind, or bird identity.
- A card can be improved once in the foundation rules.

## Effect Syntax

Implementation specs should use normalized effect expressions. Player-facing
copy can be more flavorful, but data and tests should use these verbs.

Core verbs:

| Expression | Meaning |
| --- | --- |
| `damage(target, N)` | Deal N base damage to the selected enemy. |
| `damageAll(N)` | Deal N base damage to each enemy. |
| `gainCover(N)` | Gain N base Cover. |
| `heal(N)` | Restore N base Cohesion. |
| `draw(N)` | Draw N cards. |
| `discard(N)` | Player discards N cards. |
| `discardUpTo(N)` | Player may discard up to N cards. |
| `gainWingbeat(N)` | Gain N Wingbeats this turn. |
| `gainResonance(N)` | Gain N Resonance, capped by Resonance cap. |
| `spendResonance(N)` | Spend N Resonance if available; the next `spentResonance` condition sees whether the spend succeeded. |
| `applyWinded(target, N)` | Apply N turns/stacks of Winded to target. |
| `enterMolt()` | Enter Molt. |
| `gainOpenSkyGuard(N)` | Gain N Open Sky Guard for the current combat. |
| `returnDiscard(filter, costDelta)` | Return one matching discard card to hand with a cost modifier this turn. |
| `nextCoverBonus(suit, N)` | Next matching suit card this turn gains N base Cover. |
| `nextTurnDraw(N)` | Draw N extra cards at the start of next player turn. |

Conditions use `if CONDITION then EFFECT`. Supported foundation conditions:

| Condition | Meaning |
| --- | --- |
| `firstPlayedThisCombat` | This is the first time this card ID resolved during the current combat. |
| `targetBelowHalf` | Selected enemy is below half health before the effect resolves. |
| `targetIntendsAttack` | Selected enemy's visible Tell includes damage. |
| `targetWinded` | Selected enemy currently has Winded. |
| `hasResonance` | Current Resonance is at least 1. |
| `spentResonance` | The immediately preceding `spendResonance` effect succeeded. |
| `playedSuitThisTurn(suit)` | Player already played a card of that suit this turn. |
| `isMolting` | Flock is currently Molting. |
| `openSky` | Flock currently has Open Sky. |
| `fullCohesion` | Current Cohesion equals maximum Cohesion. |
| `cohesionBelowHalf` | Current Cohesion is below half maximum Cohesion. |
| `defeatsEnemy` | The immediately preceding damage effect defeats an enemy. |
| `fullyBlocksNextAttack` | Cover prevents all damage from the next attack. |

Supported value scalars:

| Scalar | Meaning |
| --- | --- |
| `perDiscarded` | Multiply the value by cards actually discarded by the preceding discard effect. |

Formula order:

1. Pay card cost.
2. Select target.
3. Resolve effects in written order.
4. Add Flock `Damage` to `damage` and `damageAll` values.
5. Add Flock `Cover` to `gainCover` values.
6. Add Molt Power to the next non-Molt damage, Cover, or heal value.
7. Clamp healing at maximum Cohesion.
8. Apply post-effect triggers such as `defeatsEnemy`.

Flock `Regen`, `Draw`, `Resonance`, `Molt Power`, and `Open Sky Guard` are not
added to every matching card line. They modify their named system rules instead.

## Timing And Status Rules

Timing rules:

- Start-of-turn effects resolve before the player draws.
- Cover clears at the start of the player's turn before new Cover is gained.
- Regen resolves after Cover clears and before drawing.
- Draw stat changes the turn draw target before cards are drawn.
- Start-of-turn Resonance is granted after drawing and before the first action.
- Player card effects resolve fully before enemy Tells update.
- Enemy Tells resolve in visible order after `Roost`.
- End-of-turn card costs and temporary modifiers clear after enemy actions.

Status rules:

| Status | Owner | Duration Rule | Stacking Rule |
| --- | --- | --- | --- |
| Winded | Enemy | Ticks down after the enemy acts. | Higher value extends duration/stacks; foundation tuning treats it as roughly 25% attack reduction. |
| Molt | Flock | Ends after the next non-Molt card resolves. | Re-entering Molt refreshes the pending boosted card. |
| Open Sky | Flock | Ticks down after enemy turns. | Duration can refresh; incoming damage increase does not stack unless a later spec adds it. |
| Open Sky Guard | Flock | Lasts for the current combat unless spent. | Each point reduces one Open Sky damage increase by 1. |

Targeting rules:

- Cards with `target: enemy` require one living enemy.
- Cards with `target: allEnemies` do not prompt for a target.
- Cards with `target: self` affect the Flock.
- Cards with `target: none` resolve without a prompt.
- If a card's only legal target disappears before resolution, the card fizzles
  after cost payment only if the implementation supports asynchronous effects.
  Foundation card resolution is synchronous, so this should rarely happen.

## Rarity And Rewards

| Rarity | Default Role | Normal Reward Rate |
| --- | --- | ---: |
| Common | Simple, reliable tactics. | 60% |
| Uncommon | Conditional value, suit synergy, or sequencing payoff. | 30% |
| Rare | Suit engine, capstone, or strong delayed value. | 10% |
| Legendary | Encounter-shaping rule-bender. | 0% in normal rewards |

Special reward targets:

| Reward Source | Common | Uncommon | Rare | Legendary |
| --- | ---: | ---: | ---: | ---: |
| Normal crew reward | 60% | 30% | 10% | 0% |
| Rival Crew / elite | 30% | 45% | 22% | 3% |
| Boss reward | 0% | 20% | 55% | 25% |
| Dedicated Legend offer | 0% | 0% | 0% | 100% |

Minor rarity is rank-based unless a later balance pass overrides it:

| Minor Rank | Rarity |
| --- | --- |
| Ace, 2, 3, 4, 5, Fledgling | Common |
| 6, 7, 8, 9, Outrider | Uncommon |
| 10, Matron, Elder | Rare |

## Flock Stats

Flock Stats are the passive deckbuilding layer. Every owned card changes the
shared Flock even before it is drawn.

Rules:

- Every playable card must grant at least one Flock Stat.
- Flock Stat entries are whole numbers.
- If a card grants a stat, that stat must be at least `+1`.
- Omitted stats count as 0.
- Stats are summed across every owned card before combat.
- Improved cards add their Preen stat delta on top of base stats.
- Snags do not grant beneficial Flock Stats.

Foundation stats:

| Stat | Rule | Primary Fit |
| --- | --- | --- |
| Cohesion | Adds directly to maximum Flock Cohesion. | Basins, Nests |
| Damage | Adds damage to player attack cards. | Quills |
| Cover | Adds Cover to cards that gain Cover. | Nests |
| Regen | Heals at the start of player turn. | Basins |
| Draw | Increases player turn draw target. | Plumes, Nests |
| Resonance | Grants start-of-turn Resonance, capped by Resonance cap. | Plumes |
| Molt Power | Increases Molt value bonus. | Molt, Legend |
| Open Sky Guard | Reduces or blocks Open Sky damage increase. | Basins, Molt, Legend |

Suit boundaries:

| Suit | Often | Sometimes | Foundation Never |
| --- | --- | --- | --- |
| Plumes | Resonance, Draw | Damage, rare Cohesion | Regen, Open Sky Guard, Molt Power |
| Quills | Damage | Draw, Cohesion, rare Resonance | Regen, Cover, Open Sky Guard, Molt Power |
| Basins | Cohesion, Regen | Open Sky Guard, Draw, rare Cover | Damage, Resonance, Molt Power |
| Nests | Cover, Cohesion | Draw, rare Open Sky Guard | Damage, Regen, Resonance, Molt Power |
| Molt | Molt Power, Open Sky Guard | Damage, rare Cohesion | Draw, Regen, Cover |
| Legend | Unique packages | Any thematic stat | None, but theme must justify it |
| Aviary | Flexible glue stats tied to bird behavior | Any modest foundation stat | Suit-only identity claims |

Rarity budget:

| Rarity | Baseline Passive Budget | Preen Budget |
| --- | --- | --- |
| Common | One thematic `+1`, sometimes plus `Cohesion +1`. | Add `+1` to main stat or Cohesion. |
| Uncommon | One main stat at `+2`, or two suit-aligned stats at `+1`. | Add `+1` to main stat. |
| Rare | Main stat at `+3`, or `+2` main plus secondaries. | Add `+1` to main and sometimes secondary. |
| Legendary | Larger package plus unique passive/scaling modifier. | Improve unique modifier and key stat. |
| Molt Signature | Molt Power/Open Sky Guard package. | Improve risk/reward modifier. |

The first code-ready card values are in `docs/game/alpha-run-spec.md`. Full-run
card stat values should move into production card data when implemented.

## Molt And Open Sky

Molt is the signature reversal mechanic.

Foundation Molt rule:

1. A card or effect enters Molt.
2. The next non-Molt card costs 1 less, minimum 0.
3. If that card deals damage, it gains the Molt value bonus.
4. If that card gains Cover or heals, it gains the Molt value bonus.
5. Molt ends after that non-Molt card resolves.
6. The Flock enters Open Sky for 2 enemy turns.

Base Molt value bonus is `+2`, increased by Molt Power.

Open Sky:

- increases incoming damage by 1 while active
- is the visible cost of using Molt
- can be softened by Open Sky Guard

Design target:

Molt should feel obviously powerful when used well, but dangerous before a Heavy
Strike or when Cohesion is low.

## Enemy Tells

Enemies should not be generic HP bags. Each enemy needs a Tell pattern that
teaches one combat idea and expresses why this stretch of route is unsafe.

Foundation Tell types:

| Tell Type | Purpose |
| --- | --- |
| Strike | Tests Cover and Winded. |
| Heavy Strike | Tests Molt greed and defensive planning. |
| Brace | Tests burst timing. |
| Rattle | Tests recovery planning and Open Sky risk. |
| Scavenge | Tests damage race. |

Enemy Tells should be strong enough that ignoring them hurts, but not so strong
that there is only one correct card line.

## Implementation Notes

Build order for the gameplay foundation:

1. Move card definitions from prototype code into typed data.
2. Implement singleton ownership.
3. Implement Flock Stat aggregation.
4. Implement the card effect resolver for foundation effects.
5. Implement Molt/Open Sky timing and presentation.
6. Implement enemy Tell patterns.
7. Implement `Add to the Flock` and `Preen a Card` with previews.
8. Add tests for combat math, singleton rewards, Flock Stats, Molt/Open Sky, and
   Preen stat deltas.

## Acceptance Criteria

Core gameplay is ready when:

- a single fight is interesting to replay without meta progression
- enemy Tells visibly change player choices
- the player can explain why they chose damage, Cover, recovery, draw, or Molt
- Basins read as recovery
- Nests read as Cover/defense
- every owned playable card contributes visible Flock Stats
- adding a card previews active effect and Flock Stat changes
- Preen improves active effect and Flock Stat line
- Molt creates at least one memorable decision per fight
- no parked mechanics are required for the foundation cards to work

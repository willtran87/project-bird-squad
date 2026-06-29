# Bird Squad Game Design

Version: 3.0

Status: high-level product and narrative hub.

## Documentation Context

For the full documentation map, ownership rules, and reading paths, start with
`docs/README.md`.

This document answers what Bird Squad is and why its systems belong together.
It does not own detailed combat math, route schemas, Alpha tuning, or art
production rules.

## Source Map

| Question | Source |
| --- | --- |
| What is the game? | This document. |
| How do combat, cards, Flock Stats, and Molt work? | `docs/game/core-gameplay-spec.md` |
| How do maps, route systems, economy, events, and bosses work? | `docs/game/run-design-spec.md` |
| What exactly are we building first? | `docs/game/alpha-run-spec.md` |
| How is the current runtime wired? | `docs/project/runtime-architecture.md` |
| What should the game look like? | `docs/art/art-bible.md` |
| What are the card identities and species? | `data/cards/arcana/` |
| Which external implementation ideas are being considered? | `docs/game/spire-codex-adaptation-study.md` |

## Direction

Bird Squad is a Slay the Spire-like deckbuilder where the playable deck is built
from bird-embodied cards. Tarot is the hidden symbolic rules lineage. Birds are
the identities on the cards, not separate battlefield units.

There is no tactical grid, no battlefield movement, no persistent crew-card row,
and no individual bird HP bars. Out of combat, runs use a branching route map.

## One-Line Pitch

Bird Squad is a rooftop card battler about building a singleton crew deck of
bird-embodied cards, restoring the city's broken flyways, surviving enemy Tells,
and using risky Molt turns for short bursts of power.

## Narrative Frame

The flock is trying to restore the city's broken flyways: safe routes between
rooftops, basins, markets, signal towers, and high roosts. These routes used to
let birds move, rest, trade, warn each other, and survive the city. Now the
paths are blocked by hostile crews, predators, failing infrastructure, bad
weather, and lost signals.

A run is a route-repair mission. Each map is a district route the flock must
reopen, and each boss is a chokepoint preventing safe passage. Clearing all four
maps lets the flock carry the final signal to the High Roost and reconnect the
citywide flyway network.

Cards join because each bird brings route memory: a shortcut, shelter, warning
pattern, repair skill, fighting style, or survival trick.

## Core Pillars

1. **Bird-city cards.** Every playable card uses Bird Squad names, suit
   language, bird identity, and urban route fantasy.
2. **The Flock.** The player survives as one shared Flock, not individual units.
3. **Singleton deckbuilding.** A run deck can contain at most one copy of any
   card ID.
4. **The City.** Rooftops, water towers, powerlines, basins, markets, signal
   towers, and street-level threat define play.
5. **The Molt.** Molt is the signature reversal mechanic: power now,
   vulnerability next.
6. **The Flyways.** Runs are about reopening safe bird routes through the city,
   one branching map at a time.
7. **The Fit.** Streetwear is game language. Harnesses, patches, talon bands,
   wraps, pins, chains, hoods, bags, and protective gear communicate identity
   without breaking bird anatomy.

## Core Systems

Bird Squad should feel like these ten systems working together:

| System | Includes | Source |
| --- | --- | --- |
| Crew survival | Cohesion and Cover | `core-gameplay-spec.md` |
| Turn economy | Wingbeats | `core-gameplay-spec.md` |
| Card flow | Hand, draw pile, discard pile | `core-gameplay-spec.md` |
| Combat readability | Damage, healing, Winded, enemy Tells | `core-gameplay-spec.md` |
| Deck growth | Singleton rewards, Add to the Flock, Preen | `core-gameplay-spec.md` |
| Flock growth | Passive Flock Stats | `core-gameplay-spec.md` |
| Signature risk/reward | Molt and Open Sky | `core-gameplay-spec.md` |
| Suit identity | Plumes, Quills, Basins, Nests | `core-gameplay-spec.md` |
| Route choice | Branching maps, node types, bosses | `run-design-spec.md` |
| Run texture | Waymarks, Scrap, Markets, Signals, Supplies, Snags, Rival Crews | `run-design-spec.md` |

## Player-Facing Vocabulary

| Term | Meaning |
| --- | --- |
| Cohesion | Shared Flock HP. |
| Cover | Temporary defense. |
| Wingbeats | Turn energy. |
| Resonance | Plumes tempo resource. |
| Winded | Enemy attack reduction. |
| Molt | Temporary power state. |
| Open Sky | Vulnerability after Molt. |
| Add to the Flock | Add a singleton card. |
| Preen a Card | Improve an owned card. |
| Waymarks | Permanent run artifact items. |
| Scrap | Market/workshop currency. |
| Signals | Event nodes and log language. |
| Basin | Recovery node. |
| Nest | Upgrade/preparation node. |

## Alpha Target (achieved) and current build

The first implementation target was `docs/game/alpha-run-spec.md`: Map 1 only
(Rooftop Blocks), a deterministic 6-8 node route plus boss, a 10-card starter
deck, 3 normal enemies + 1 Rival Crew + `The Tar-Crowned Crow` boss, and the full
node-type set (Waymarks, Scrap, Market, Supplies, Signals, Snags, Basin, Nest).
That alpha slice proved the game feels like a bird-native deckbuilding roguelike.

**Scope expanded post-alpha (current build):** the playable game now spans all
four districts: Rooftop Blocks -> Canal Markets -> Signal Spires -> High Roost
(`src/game/runtime-data.ts` `alphaMaps`). The runtime card file contains **100
playable cards** (10-card starter + **90-card reward pool**) plus **10 Snags**,
with rarity-weighted reward offers. The broader runtime also ships 58 Waymarks,
31 Supplies, 64 enemies, 80 encounters, and 38 Signals. Map 1 remains the
balance/tuning reference; see `docs/game/alpha-run-spec.md` for per-map detail
and `docs/project/runtime-architecture.md` for the implementation map.

## Document Ownership

- Update this document when the pitch, pillars, vocabulary, or product direction
  changes.
- Update `docs/game/core-gameplay-spec.md` when combat, cards, Flock Stats,
  Molt, enemy Tells, or foundation rewards change.
- Update `docs/game/run-design-spec.md` when route maps, node types, economy,
  Waymarks, Markets, Signals, Supplies, Snags, Rival Crews, bosses, Basin, or
  Nest rules change.
- Update `docs/game/alpha-run-spec.md` when Map 1 Alpha content changes.
- Update `docs/art/art-bible.md` when visual, world, prompt, suit, or Molt art
  rules change.
- Update `docs/README.md` when documentation ownership or reading paths change.

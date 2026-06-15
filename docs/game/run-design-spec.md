# Bird Squad Run Design Spec

Version: 1.0

Status: consolidated source of truth for route maps, flyway narrative, run
systems, route rewards, economy, events, and bosses.

Related sources:

- `docs/game/game-design.md` defines the high-level product direction.
- `docs/game/core-gameplay-spec.md` defines combat, cards, Flock Stats, and
  Molt.
- `docs/game/alpha-run-spec.md` defines the first playable Map 1 content slice.
- `docs/art/art-bible.md` defines visual identity and world language.

## Purpose

This document consolidates the former run map and run systems specs. It answers:

- why the flock is moving through the city
- how the four-map route structure works
- what route node types exist
- how Route Marks, Scrap, Markets, Signals, Supplies, Snags, Rival Crews,
  Basin Stops, Nest Workshops, and bosses work
- what belongs in MVP versus later

Alpha-specific content values live in `docs/game/alpha-run-spec.md`.

## Narrative Frame

The flock is restoring the city's broken flyways: safe routes between rooftops,
basins, markets, signal towers, and high roosts. These routes used to let birds
move, rest, trade, warn each other, and survive the city.

The run is a route-repair mission. Each map is one district route the flock must
reopen. Each boss blocks a chokepoint. Clearing all four maps lets the flock
carry the final signal to the High Roost and reconnect the citywide flyway
network.

Cards join the flock because they bring route memory: shortcuts, shelter,
warning patterns, repair skills, fighting styles, or survival tricks.

## Run Structure

| Layer | Rule |
| --- | --- |
| Run | A complete run contains 4 maps. |
| Map | A branching network of nodes with a boss at the end. |
| Node | A single encounter, recovery stop, reward, event, shop, or boss. |
| Path | The chosen route through connected nodes on the current map. |

Each map should show:

- current node
- available next nodes
- node type icons
- known boss endpoint
- visible route risk
- deck/Flock summary before confirming the next node

## Four-Map Arc

| Map | Working Name | Narrative Job | Mechanical Job |
| --- | --- | --- | --- |
| 1 | Rooftop Blocks | Reopen the local roofline. | Teach core combat, rewards, Preen, first Molt risk. |
| 2 | Canal Markets | Reconnect water, food, repair, and rest stops. | Test recovery and attrition. |
| 3 | Signal Spires | Restore warning calls and skyline signals. | Test tempo, Tells, Plumes/Quills sequencing. |
| 4 | High Roost | Carry the final signal and bind routes together. | Final Flock build, Molt timing, route consequences. |

Map names can evolve in art/world passes, but the four-map structure should stay
stable unless run length is redesigned.

## Node Types

| Node Type | Player Label | Story Role | Mechanical Role |
| --- | --- | --- | --- |
| Normal Encounter | Street Encounter | Clear a blocked route stretch. | Standard fight and card reward. |
| Elite Encounter | Rival Crew | Challenge a crew or threat holding valuable passage. | Harder fight, better rewards. |
| Boss | Boss | Break district chokepoint. | Required map endpoint. |
| Basin Stop | Basin | Recover at water, shelter, or care point. | Heal/stabilize. |
| Nest Workshop | Nest | Repair gear and prepare the flock. | Preen/removal/preparation. |
| Market | Market | Trade in a bird-city exchange. | Spend Scrap on cards, Route Marks, Supplies, services. |
| Signal Event | Signal | Follow rumors, warnings, calls, route marks. | Narrative risk/reward choice. |
| Cache | Rooftop Cache | Find a stash left by route-runners. | Small reward without combat. |

Terminology guardrails:

- Basin is recovery language.
- Nest is upgrade, preparation, Cover, and mechanical support language.
- Signal is event/log language.
- Avoid generic fantasy labels like shrine, campfire, dungeon, relic chest, or
  tavern.

## Map Generation Rules

Each map should be a directed branching graph:

- one start column
- 5-7 route columns before the boss
- 3-5 nodes per middle column
- 2-3 choices from most nodes
- no dead ends except the boss
- at least two materially different route lanes
- one required boss node

Target node counts:

| Node Count | Map 1 | Maps 2-3 | Map 4 |
| --- | ---: | ---: | ---: |
| Normal encounters | 5-7 | 6-8 | 6-8 |
| Rival Crews | 1-2 | 2-3 | 2-4 |
| Basins | 1-2 | 1-2 | 1 |
| Nests | 1-2 | 1-2 | 1-2 |
| Markets | 0-1 | 1-2 | 1 |
| Signals | 1-2 | 2-3 | 2-3 |
| Caches | 1-2 | 1-2 | 1 |
| Boss | 1 | 1 | 1 |

## Route Data Contract

Route data should be buildable as either deterministic authored maps or seeded
procedural maps. Alpha uses an authored Map 1 graph. Later maps can use the same
schema with generated node placement.

Required map fields:

| Field | Type | Rule |
| --- | --- | --- |
| `id` | string | Stable map key, such as `map_01_rooftop_blocks`. |
| `name` | string | Player-facing district name. |
| `index` | number | 1 through 4. |
| `seed` | string/null | Seed used for generated maps; null for authored Alpha map. |
| `columns` | array | Ordered route columns from start to boss. |
| `nodes` | array | All nodes in the map. |
| `edges` | array | Directed connections between node IDs. |
| `bossNodeId` | string | Required final node. |
| `entryNodeId` | string | Required starting node. |

Required node fields:

| Field | Type | Rule |
| --- | --- | --- |
| `id` | string | Stable within the map. |
| `column` | number | Horizontal route position. |
| `lane` | number | Vertical ordering within the column. |
| `type` | enum | `street`, `rival`, `boss`, `basin`, `nest`, `market`, `signal`, or `cache`. |
| `label` | string | Player-facing label. |
| `payloadId` | string | Encounter, event, market, cache, or boss content key. |
| `risk` | enum | `low`, `medium`, `high`, or `boss`. |
| `revealed` | boolean | Whether node type is known to the player. |
| `completed` | boolean | Whether the node has resolved. |

Required edge fields:

| Field | Type | Rule |
| --- | --- | --- |
| `from` | string | Source node ID. |
| `to` | string | Destination node ID. |
| `locked` | boolean | True when a Signal or route effect can unlock it later. |
| `preview` | enum | `known`, `typeOnly`, or `hidden`. |

## Route Generation Contract

Generated maps should follow these rules:

1. Create the entry column and boss column.
2. Create 5-7 middle columns.
3. Place 3-5 nodes in each middle column.
4. Assign required node quotas for the current map index.
5. Connect each node to 2-3 nodes in the next column when possible.
6. Ensure every non-boss node has at least one route to the boss.
7. Ensure every route contains at least one combat before the boss.
8. Ensure at least two lanes have meaningfully different risk/reward profiles.
9. Reveal current node, next-node types, and boss endpoint by default.
10. Apply Route Marks or Signals that reveal additional nodes after generation.

Legal transition guardrails:

| From | Avoid Immediately After |
| --- | --- |
| Basin | Basin, Cache |
| Nest | Nest, Market |
| Market | Market, Cache |
| Signal | Signal, Boss unless late-map |
| Rival Crew | Rival Crew before Map 3 |

These are guardrails, not absolute rules. A handcrafted map can break them when
the route choice is clearly intentional.

## Node Resolution Contract

Node resolution should follow one state transition shape:

1. Player previews reachable next nodes.
2. Player commits to one node.
3. Route state moves to that node.
4. Node payload resolves.
5. Rewards, costs, Snags, or route changes apply.
6. Completed node is marked complete.
7. Newly reachable nodes are revealed.
8. Player returns to route preview, unless the map or run is complete.

Node payload rules:

| Type | Payload | Completion Reward |
| --- | --- | --- |
| `street` | Normal encounter ID. | Scrap, Add to the Flock, possible Preen or Route Mark. |
| `rival` | Elite encounter ID. | Higher Scrap, improved reward odds, Route Mark, Preen. |
| `boss` | Boss encounter ID. | Map-clear rewards and next-map transition. |
| `basin` | Basin option set ID. | Recovery, shelter, or Supply refill. |
| `nest` | Nest option set ID. | Preen, Release a Card, or route preparation. |
| `market` | Market inventory ID. | Purchases only; no automatic reward. |
| `signal` | Signal event ID. | Choice-dependent reward, cost, Snag, or route change. |
| `cache` | Cache table ID. | Small non-combat reward choice. |

Reward ordering after combat:

1. Scrap.
2. Route Mark offers, if any.
3. Add to the Flock card reward, if any.
4. Preen offer, if any.
5. Supplies or Snags.
6. Route reveal/change effects.

Singleton card filtering applies before card rewards are shown.

## Route Marks

Route Marks are Bird Squad's relic-equivalent: permanent run modifiers earned by
reopening routes, clearing Rival Crews, resolving Signals, opening Caches, or
beating bosses.

Rules:

- Route Marks persist for the rest of the run.
- Route Marks are not cards and do not enter the deck.
- Route Marks should be visible in a compact run panel.
- Most Route Marks should modify one clear thing.
- Boss Route Marks can be stronger and map-defining.

Examples:

| Route Mark | Effect |
| --- | --- |
| Chalk Wingmark | Start each combat with Cover. |
| Rooftop Shortcut | First time you play 3 cards in a turn each combat, draw 1. |
| Patched Harness | First Preen each map costs less Scrap. |
| Quiet Landing | First Open Sky damage increase each combat is reduced. |
| Rain Barrel Key | Basin Stops heal more Cohesion. |

## Scrap And Markets

Scrap is the primary economy. The flock spends Scrap at Markets and sometimes at
Nest Workshops.

Scrap sources:

- Street Encounters
- Rival Crews
- Bosses
- Rooftop Caches
- Signals

Scrap sinks:

- buy cards
- buy Route Marks
- buy Supplies
- Release a Card
- pay for extra Preen
- resolve certain Signal choices safely

Market inventory target:

| Slot | Count | Rule |
| --- | ---: | --- |
| Cards | 3-5 | Exclude owned singleton cards. |
| Route Marks | 2-3 | At least one affordable option. |
| Supplies | 2-3 | One-use tactical effects. |
| Services | 1-2 | Release a Card, Preen, or future deck tuning. |

## Release A Card

Release a Card is the deck-trimming service.

Rules:

- Removes one owned non-required card from the run deck.
- Removed cards no longer contribute Flock Stats.
- Starter or story-critical cards can be protected until later.
- Cost increases each time it is used during a run.
- The UI must preview lost active effect and lost Flock Stats.

Narratively, the bird is not destroyed. It leaves the active route team, returns
to a safer perch, scouts elsewhere, or carries a message off-map.

## Supplies

Supplies are one-use tactical tools, Bird Squad's potion-equivalent.

Rules:

- Starting target is 2 carry slots.
- Supplies are consumed when used.
- Supplies can be combat or route-only, but Alpha should focus on combat use.
- Supplies should be simple and high-impact.

Supply categories:

| Category | Role |
| --- | --- |
| Snacks | Recovery. |
| Flares | Signal, tempo, Tell support. |
| Tools | Defense, repair, Open Sky protection. |
| Calls | Draw, Wingbeats, flock coordination. |

## Snags And Bad Signals

Snags are negative deck cards or burdens attached to tempting choices.

Rules:

- Snags enter the deck like cards.
- Snags should not contribute beneficial Flock Stats.
- Snags can be removed through Release, Nest services, or certain Signals.
- Snags should be rare in MVP and tied to clear risk/reward.

Bad Signals are route-level penalties. They are later-layer unless a specific
event needs them.

## Signals

Signals are narrative event nodes.

Signal structure:

| Part | Requirement |
| --- | --- |
| Situation | One or two sentences explaining the route problem. |
| Choices | 2-3 options with clear costs or risks. |
| Outcome | Immediate mechanical result and short narrative beat. |
| Memory | Optional Route Mark, card offer, Scrap, Supply, Snag, or route change. |

Signals should be about route repair, warning calls, stranded birds, rival
bargains, weather, or infrastructure.

## Rival Crews

Rival Crews are elite nodes: optional, dangerous, and rewarding.

Rules:

- Visible on the route map before commitment.
- Harder than normal encounters.
- Tuned around a specific combat test.
- Better reward odds than normal encounters.
- Can be rival birds, predators, infrastructure hazards, or mixed threats, but
  the node label remains Rival Crew for clarity.

Reward target:

- better rarity odds
- high Route Mark chance
- medium/high Scrap
- usually Preen after victory
- higher Cohesion loss, Snag, or route pressure risk

## Bosses

Bosses are required route blockers. They should feel like chokepoints, not
random end-of-map monsters.

Boss roles:

| Map | Boss Role | Mechanical Test |
| --- | --- | --- |
| 1 | Rooftop Chokepoint | Cover timing, direct damage, Molt restraint. |
| 2 | Canal Gatekeeper | Attrition, healing windows, longer planning. |
| 3 | Signal Jammer | Tempo, draw, Resonance, Tell reading. |
| 4 | High Roost Blocker | Full build, Molt timing, Open Sky management. |

Boss rewards:

- map-clear Route Mark
- stronger Preen or Nest service
- possible Legend or Molt-signature offer
- Scrap
- map transition narrative beat

## Basin Versus Nest

Basins and Nests are the core non-combat pathing tension.

- Basin means recovery, safety, stabilization, and Open Sky relief.
- Nest means Preen, preparation, mechanical tuning, and deck improvement.

Routes should often force a choice between Basin and Nest. A single node should
not usually offer full recovery and full upgrade at once.

## Flock Leaders

Flock Leaders are later replay identities, not MVP.

Possible model:

| Leader Type | Run Identity |
| --- | --- |
| Plumes Leader | Draw, Resonance, fast fights. |
| Quills Leader | Precision damage and Winded. |
| Basins Leader | Recovery and attrition resistance. |
| Nests Leader | Defense, Preen, route control. |
| Molt Leader | Burst and Open Sky management. |

## MVP Cut

Build these for the first full roguelike run:

- Route Marks
- Scrap
- Markets
- Release a Card
- Supplies
- Signals
- Rival Crews
- four map bosses
- Basin Stops
- Nest Workshops
- light Snags attached to high-upside choices

Defer:

- Favors
- broad Bad Signal system
- Flock Leaders
- complex Signal chains
- advanced deck services
- large Route Mark pools with rare build-arounds

## Acceptance Criteria

Run design is ready when:

- a run contains exactly four maps
- each map is a branching route with a visible boss endpoint
- route choices affect more than the next fight
- Route Marks give runs identity beyond deck contents
- Scrap creates meaningful Market decisions
- Release a Card gives singleton decks control without breaking flock theme
- Supplies create tactical safety valves
- Signals add narrative choices with mechanical outcomes
- Rival Crews are tempting but risky
- bosses feel like route blockers and reward map completion
- Basin and Nest nodes create recovery-versus-upgrade tension
- the player understands why restoring the flyways matters

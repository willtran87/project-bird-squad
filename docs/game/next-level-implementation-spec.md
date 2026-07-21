# Bird Squad Next-Level Implementation Spec

Version: 0.1

Status: implementation roadmap derived from current Bird Squad specs and
Spire Codex reference findings.

Related sources:

- `docs/game/game-design.md` defines the product direction.
- `docs/game/core-gameplay-spec.md` defines combat, cards, Flock Stats, Molt,
  and enemy Tells.
- `docs/game/run-design-spec.md` defines route maps, economy, events, Route
  Marks, Supplies, Snags, Rival Crews, and bosses.
- `docs/game/alpha-run-spec.md` defines the Map 1 Alpha content target.
- `docs/game/spire-codex-adaptation-study.md` records the reference-repo
  findings behind this plan.

## Purpose

This spec turns the Spire Codex reference analysis into an implementation plan
for making Bird Squad feel cleaner, more readable, more strategic, and easier
to expand.

It is focused on four outcomes:

1. Make battle and map screens easier to read.
2. Move scalable roguelike content out of scene code and into validated data.
3. Make deckbuilding, route choice, and boss preparation feel intentional.
4. Add local run history and playtest feedback loops before building more
   content.

## Non-Goals

Do not add these as part of this spec:

- online accounts, community submissions, or a backend
- Slay the Spire 2 content, assets, names, or extracted data
- broad procedural generation before authored Map 1 proves the data model
- optional challenge layers before the base run is readable and fun
- new parked card mechanics unless they directly support Alpha goals

## Design Principles

### Show The Next Decision First

The default UI should show only what the player needs for the current decision:

- current resources
- enemy threat
- playable hand
- selected target or selected route node
- immediate action buttons

Everything else should be available through hover, selection, drawer, or overlay.

### Make The Map A Planning Surface

The route map should help the player plan backward from visible risk:

- What is the boss testing?
- Which route gives recovery?
- Which route gives power?
- Which route is risky but rewarding?
- What does this node likely solve for my deck?

### Treat Rewards As Problem Solving

Card rewards should not feel like collecting everything. They should ask:

- Does the deck need damage?
- Does the deck need Cover?
- Does the deck need recovery?
- Does the deck need draw or Wingbeats?
- Does the deck need Molt safety?
- Is skipping or Preening better than adding a card?

### Build Data Before More Content

Bird Squad already has enough Alpha content to prove the loop. The next step is
to make the content model strong enough that more enemies, Signals, Markets,
Supplies, and Route Marks can be added without bloating `src/main.ts`.

## Target Player Experience

The player starts a run on a clean rooftop route map. Nodes are compact symbols,
the boss is visible, and selecting a node reveals risk, likely reward, and the
route lesson in a side panel. The player can inspect deck and Route Marks
without leaving the map.

In battle, the battlefield art and enemy threat are visually dominant. The top
ribbon shows resources. The hand shows compact cards. Selecting a card expands
its details. Enemy intents are badges that show danger immediately and explain
themselves on hover or selection. The combat log is a drawer, not a permanent
panel.

After battles and route events, rewards explain what they do for the current
deck. At the end of a run, the player sees path, deck, picks, Preens, Route
Marks, Supplies, damage taken, and loss/win context.

## Phase 1: Battle Readability Pass

Goal: make combat cleaner without changing combat rules.

### Battle Layout

Use four stable screen zones:

```text
Top ribbon:
  Cohesion | Cover | Wingbeats | Resonance | Draw | Discard | Scrap | Route Marks

Battlefield:
  Flock anchor on the left
  enemies on the right
  intent badges attached to enemies
  animation and art take priority over text

Command strip:
  selected card detail, selected target, Roost button

Hand:
  five compact cards with cost, name, role chip, suit accent, playable state
```

### Top Ribbon

Always visible:

| Chip | Contents | Detail On Hover/Select |
| --- | --- | --- |
| Cohesion | `current/max` | Flock survival explanation and Regen preview. |
| Cover | current Cover | Clears at start of player turn. |
| Wingbeats | current/turn max | Energy rules and card affordability. |
| Resonance | current/cap | Plumes tempo explanation. |
| Draw | draw pile count | Opens draw pile browser. |
| Discard | discard pile count | Opens discard pile browser. |
| Scrap | current Scrap | Economy tooltip. |
| Route Marks | count or icons | Opens Route Mark drawer. |

Implementation notes:

- Replace separate Deck and Discard pile buttons with top-ribbon chips.
- Move Flock Stats out of the default battlefield and into a drawer.
- Keep chip text short and use icons or suit-colored dots where possible.

### Hand Cards

Default hand card:

- cost
- display name
- suit/type accent
- role chip
- playable/unplayable state

Selected hand card:

- full effect text
- bird species
- target
- role
- Flock Stat contribution
- Preen preview if relevant
- large art crop or full card preview

Hand card display model:

```ts
interface HandCardView {
  instanceId: string;
  cardId: string;
  costLabel: string;
  name: string;
  suitAccent: string;
  roleChip: string;
  playable: boolean;
  selected: boolean;
  exhaustedPreview?: boolean;
}
```

Acceptance criteria:

- A normal battle screen shows no full card effect text unless a card is
  selected or hovered.
- Card affordability is obvious at a glance.
- Card selection never hides enemy intent or Flock survival state.

### Enemy Intent Badges

Replace intent text boxes with compact badges.

Badge examples:

| Intent | Badge | Detail |
| --- | --- | --- |
| Strike | attack icon + `6` | Deals 6 damage after Roost. |
| Heavy Strike | attack icon + `13` with high-danger ring | Large attack; prepare Cover or Winded. |
| Brace | shield icon + `8` | Enemy gains Cover. |
| Debuff | status icon | Applies Winded or other pressure. |
| Special | question/signal icon | Shows detail on hover/selection. |

Intent view model:

```ts
interface IntentBadgeView {
  icon: 'attack' | 'block' | 'debuff' | 'special';
  value?: number;
  hits?: number;
  danger: 'low' | 'medium' | 'high';
  shortLabel: string;
  detail: string;
}
```

Acceptance criteria:

- Incoming attack damage can be read without parsing a sentence.
- Non-attack intents are visually distinct from attacks.
- Multi-part future intents can show more than one badge.

### Log Drawer

Default:

- latest important event appears as a short fading toast
- a small `Signals` or `Log` chip opens the full recent log

Drawer:

- last 50 events
- event type color: damage, Cover, heal, status, reward, route
- no more than one or two lines per event

Acceptance criteria:

- The battle screen does not reserve a large permanent panel for the log.
- The player can still review the last several actions.

### Tooltip System

Shared tooltip model:

```ts
interface TooltipModel {
  title: string;
  subtitle?: string;
  body: string;
  iconKey?: string;
  accent?: number;
}
```

Tooltip targets:

- cards
- Route Marks
- Supplies
- Flock Stats
- Winded
- Molt
- Open Sky
- Open Sky Guard
- enemy intent badges
- route node symbols

Acceptance criteria:

- Every non-obvious chip or badge has a tooltip.
- Tooltips never block the primary click target.
- Tooltips can be disabled or ignored on touch without breaking play.

## Phase 2: Glyph-First Route Map

Goal: make route planning visual, clean, and strategic.

### Map Layout

```text
Header:
  District | Cohesion | Scrap | Route Marks | Deck | Back

Main:
  left 70 percent: route graph
  right 30 percent: selected-node detail panel

Footer:
  current objective or latest route note
```

### Node Rendering

Default graph node:

- circle or compact marker
- node glyph
- risk ring
- completion state
- selectable state

Node glyphs:

| Node Type | Glyph |
| --- | --- |
| Street Encounter | crossed feather or claw mark |
| Rival Crew | crown or warning mark |
| Boss | large crown/roost mark |
| Basin | water drop |
| Nest | nest/gear |
| Market | scrap tag |
| Signal | signal mark |
| Cache | box |

Visual rules:

- current node gets the only animated pulse
- selectable nodes get strong rings
- completed nodes are dim but legible
- unavailable nodes are quiet
- route lines are subdued unless on the chosen path

### Selected Node Panel

Panel fields:

- node title
- node type
- risk
- lesson or route purpose
- likely rewards
- expected cost or pressure
- boss-prep relevance if any
- confirm button

Example:

```text
Rival Crew
Tarline Jackdaw
High risk

Tests Cover and Open Sky restraint.
Reward bias: Route Mark, Preen, high Scrap.
Boss prep: helps against Tar-Crowned Crow's Heavy Strike.

[Take this route]
```

Acceptance criteria:

- The route graph remains readable without node text.
- Selecting a node explains why the player might choose it.
- Boss pressure is visible before the final node.

## Phase 3: Data Backbone

Goal: move scalable roguelike systems into data files with validation.

### Encounters

New file:

```text
data/game/alpha-encounters.json
```

Schema:

```ts
type EncounterBand = 'weak' | 'standard' | 'pressure' | 'rival' | 'boss';

interface RuntimeEncounter {
  id: string;
  name: string;
  mapId: string;
  nodeType: RouteNodeType;
  band: EncounterBand;
  lesson: string;
  tags: string[];
  enemies: string[];
  rewardProfileId: string;
  introText?: string;
  victoryText?: string;
  lossText?: string;
}
```

Migration:

1. Add encounter records for existing Alpha enemies.
2. Change combat route node `payloadId` values to encounter IDs.
3. Resolve enemies through encounter records.
4. Move reward tuning from enemy records into encounter reward profiles.

Acceptance criteria:

- A route node can start a one-enemy or multi-enemy encounter.
- Encounter reward tuning does not live on enemy definitions.
- Every encounter has a lesson, band, and tag list.

### Enemy Moves

Enemy schema additions:

```ts
interface EnemyMove {
  id: string;
  label: string;
  intent: IntentBadgeView[];
  effects: string[];
  tags: string[];
}

type AttackPattern =
  | { type: 'cycle'; moveIds: string[] }
  | { type: 'weighted'; entries: Array<{ moveId: string; weight: number }> }
  | { type: 'conditional'; entries: Array<{ moveId: string; if: string }>; fallback: string }
  | { type: 'scripted'; moveIds: string[]; loopFrom?: number };
```

Migration:

1. Convert current `intentPattern` rows into `moves`.
2. Add `attackPattern` to each enemy.
3. Keep backward compatibility during migration.
4. Add tests for move selection.

Acceptance criteria:

- Bosses can use scripted phases.
- Normal enemies can use simple cycles.
- Future enemies can branch on Flock state, enemy HP, or route conditions.

### Market Data

New file:

```text
data/game/alpha-market.json
```

Schema:

```ts
interface MarketConfig {
  id: string;
  cardSlots: MarketCardSlot[];
  routeMarkSlots: MarketRouteMarkSlot[];
  supplySlots: MarketSupplySlot[];
  services: MarketService[];
}

interface MarketPriceBand {
  base: number;
  min: number;
  max: number;
}

interface MarketService {
  id: 'preen' | 'release';
  basePrice: number;
  priceIncrease?: number;
  discountRouteMarkIds?: string[];
}
```

Acceptance criteria:

- Market card, Route Mark, Supply, Preen, and Release prices are data-driven.
- Sold-out and sale states are represented in run state.
- Singleton deck filtering is applied before Market offers render.

### Supplies

New file:

```text
data/game/alpha-supplies.json
```

Schema:

```ts
type SupplyAnswerType =
  | 'coverNow'
  | 'drawNow'
  | 'wingbeatNow'
  | 'healNow'
  | 'openSkySafety'
  | 'tellControl';

interface RuntimeSupply {
  id: string;
  name: string;
  category: 'snack' | 'flare' | 'tool' | 'call';
  rarity: 'common' | 'uncommon' | 'rare';
  answerType: SupplyAnswerType;
  timing: 'combat' | 'route' | 'either';
  effects: string[];
  description: string;
}
```

Acceptance criteria:

- Supplies render in a compact top-ribbon slot.
- Supplies can be used or inspected without cluttering the hand.
- Boss-prep UI can recommend relevant Supplies by `answerType`.

### Signals And Snags

New files:

```text
data/game/alpha-signals.json
data/game/alpha-snags.json
```

Signal schema:

```ts
interface SignalChoice {
  key: string;
  text: string;
  requirements?: string[];
  lockedText?: string;
  cost?: string[];
  outcomes: string[];
  proceed?: boolean;
}

interface RuntimeSignal {
  id: string;
  title: string;
  mapId: string;
  prompt: string;
  choices: SignalChoice[];
}
```

Card pressure schema:

```ts
interface CardPressure {
  id: string;
  label: string;
  stackable: boolean;
  extraCardText: string;
  effect: string;
  duration: 'combat' | 'map' | 'run';
}
```

Acceptance criteria:

- Signal choices preserve authored order.
- Locked choices are visible but muted when useful.
- Snag cards and temporary card-pressure overlays are separate concepts.

### Route Marks

Route Mark schema:

```ts
type RouteMarkFamily =
  | 'safety'
  | 'economy'
  | 'route'
  | 'suit'
  | 'molt'
  | 'bossPrep';

interface RuntimeRouteMark {
  id: string;
  name: string;
  family: RouteMarkFamily;
  source: 'street' | 'rival' | 'boss' | 'market' | 'signal' | 'cache' | 'nest';
  rarity: 'common' | 'uncommon' | 'rare' | 'boss';
  trigger: string;
  effect: string;
  description: string;
}
```

Acceptance criteria:

- Route Marks display as compact chips/icons.
- Route Mark tooltips explain trigger and effect.
- Boss-prep Route Marks can be highlighted before a boss.

## Phase 4: Reward And Deck Decision UX

Goal: make deckbuilding choices feel intelligent and intentional.

### Owned Cards And Combat Instances

Types:

```ts
interface OwnedCard {
  id: string;
  upgraded?: boolean;
  joinedAtNodeId?: string;
  source?: 'starter' | 'reward' | 'market' | 'signal' | 'boss';
}

interface CombatCardInstance {
  instanceId: string;
  cardId: string;
  upgraded?: boolean;
  temporaryCostDelta?: number;
  temporary?: boolean;
  pressures?: string[];
}

interface CombatDeckZones {
  drawPile: CombatCardInstance[];
  hand: CombatCardInstance[];
  discardPile: CombatCardInstance[];
  exhaustPile: CombatCardInstance[];
}
```

Rule:

- Run deck is durable ownership.
- Combat deck zones are created at combat start and discarded after combat.

### Reward Events

Types:

```ts
interface CardRewardEvent {
  nodeId: string;
  offeredCardIds: string[];
  pickedCardId?: string;
  skipped: boolean;
  fallbackChoice?: 'preen' | 'scrap' | 'routeMark';
}
```

Reward UI should show:

- deck needs summary
- offered cards
- active effect
- Flock Stat delta
- role chip
- skip value
- Preen alternative when available

Deck need summary:

```ts
interface DeckNeedSummary {
  damage: 'low' | 'steady' | 'strong';
  cover: 'low' | 'steady' | 'strong';
  recovery: 'low' | 'steady' | 'strong';
  draw: 'low' | 'steady' | 'strong';
  moltSafety: 'low' | 'steady' | 'strong';
}
```

Acceptance criteria:

- Rewards can be skipped intentionally.
- Preen is presented as a meaningful alternative, not only a separate reward
  step.
- Reward choices are recorded in run history.

## Phase 5: Run History, Live State, And Playtest Stats

Goal: make playtesting observable.

### Run Summary

Emit after win, loss, or abandon:

```ts
interface RunSummary {
  id: string;
  seed: string;
  result: 'win' | 'loss' | 'abandon';
  mapId: string;
  finalNodeId: string;
  killedBy?: string;
  turnsTaken: number;
  currentCohesion: number;
  maxCohesion: number;
  scrapEarned: number;
  scrapSpent: number;
  path: string[];
  deck: OwnedCard[];
  routeMarks: string[];
  suppliesUsed: string[];
  cardRewards: CardRewardEvent[];
  signals: SignalChoiceEvent[];
  markets: MarketPurchaseEvent[];
  combatResults: CombatResultSummary[];
  experienceFeedback?: {
    fun?: number;
    fairness?: number;
    clarity?: number;
    replay?: number;
    updatedAt?: string;
  };
}
```

### Live State Snapshot

Keep in memory and expose through `window.__birdSquadState`:

```ts
interface BirdSquadLiveState {
  mode: GameMode;
  runId: string;
  seed: string;
  map: {
    id: string;
    currentNodeId?: string;
    selectableNodeIds: string[];
    completedNodeIds: string[];
  };
  deck: OwnedCard[];
  combat?: {
    zones: CombatDeckZones;
    enemies: Array<{ id: string; hp: number; maxHp: number; intents: IntentBadgeView[] }>;
    resources: BattleResourceState;
  };
  screen?: {
    signalId?: string;
    marketId?: string;
    rewardId?: string;
  };
  ticker: Array<{ type: string; text: string; turn?: number; nodeId?: string }>;
}
```

### Local Playtest Stats

Aggregate locally from run summaries:

- reward offers shown versus picked
- reward skips
- Preen choices
- card removals/releases
- deadliest enemies and moves
- Cohesion loss by node type
- Signal choices
- Market purchases
- Route Marks acquired
- boss losses by cause
- complete 1–5 human ratings for fun, fairness, clarity, and replay intent

Acceptance criteria:

- A playtest run leaves a readable local artifact.
- The post-run screen explains what happened.
- Debug state is enough to reproduce route/combat transition bugs.

## Phase 6: Map Identity And Boss Prep

Goal: make each district feel mechanically distinct.

### Map Design Profile

Schema:

```ts
interface MapDesignProfile {
  mapId: string;
  thesis: string;
  primaryTests: string[];
  preferredNodeTypes: RouteNodeType[];
  encounterTags: string[];
  rewardBias: string[];
  bossPrepHints: string[];
}
```

Map theses:

| Map | Thesis | Pressure |
| --- | --- | --- |
| Rooftop Blocks | Learn visible Tells and form a first deck identity. | Cover, direct damage, first Molt risk. |
| Canal Markets | Survive attrition while tuning the deck. | Recovery, Scrap tension, Market/Nest choices. |
| Signal Spires | Sequence tempo and react to complex intents. | Resonance, draw, Winded, multi-part Tells. |
| High Roost | Prove the full build under route consequences. | Boss prep, Route Mark payoff, Molt discipline. |

### Boss Prep Readout

Before final column:

- boss name
- signature Tell theme
- expected pressure
- current deck readiness
- useful upcoming nodes
- relevant Supplies or Route Marks

Example:

```text
Tar-Crowned Crow
Tests Cover and Molt restraint.
Readiness: Cover low, Open Sky Guard steady.
Useful prep: Nest, Basin, Zip Tie Roll, Quiet Landing.
```

Acceptance criteria:

- Boss losses feel fair because the pressure was previewed.
- Rival Crew rewards can be framed as boss-prep bets.

## Implementation Order

1. Battle readability pass.
2. Shared tooltip and display models.
3. Glyph-first route map.
4. Encounter layer and enemy move model.
5. Market, Supplies, Signals, Snags, and Route Mark data files.
6. Reward decision UX and durable reward events.
7. Run summaries and local stats.
8. Map design profiles and boss-prep readouts.

This order keeps the visible experience cleaner before adding more systems.

## Validation Plan

Extend validators as data files land:

| File | Validation |
| --- | --- |
| `alpha-encounters.json` | IDs unique, enemies exist, reward profiles exist, bands valid. |
| `alpha-market.json` | prices positive, slots valid, card/Route Mark/Supply IDs exist. |
| `alpha-supplies.json` | answer types valid, effects parse, rarity valid. |
| `alpha-signals.json` | choices have stable keys, outcomes parse, requirements parse. |
| `alpha-snags.json` | Snag card IDs exist or card-pressure IDs are unique. |
| route marks | family/source valid, triggers parse, effects parse. |
| run summaries | schema stable, path nodes exist, card IDs exist. |

Testing:

- `npm run validate:docs`
- `npm run validate:runtime`
- Playwright route-map smoke test
- Playwright battle readability smoke test
- reward-selection smoke test
- market/signal smoke test after those screens become data-driven

## Release Acceptance Criteria

The next-level pass is ready when:

- the battle screen has a clear top ribbon, clean battlefield, compact hand, and
  no permanent large log panel
- enemy intent can be understood in under two seconds
- route map nodes are glyph-first with selected-node details in a side panel
- route nodes resolve through encounters, not direct enemy IDs
- enemy moves are data-driven and support at least cycle and scripted patterns
- Market prices and services are data-driven
- Signals use structured choices
- Supplies exist as a tactical item layer
- Route Marks have family/source metadata and compact UI
- card rewards support skip or fallback decisions
- run summary artifacts are emitted locally
- local playtest stats can identify deadliest enemies, most skipped rewards,
  and most chosen Signals

## First Implementation Slice

The first slice should be small and visible:

1. Add top resource ribbon in battle.
2. Move Roost to the hand command area.
3. Replace the large log panel with a one-line toast.
4. Compact hand cards and show full effect only on selected card.
5. Convert enemy intent text to a simple badge.

This slice does not need new data files. It should make the game feel cleaner
immediately and create the UI foundation for later systems.

# Spire Codex Adaptation Study

Version: 0.4

Status: non-canonical implementation pattern intake

Source reviewed:

- `C:\Users\Will\Projects\spire-codex`
- `C:\Users\Will\Projects\project-bird-squad`

## Purpose

This document records implementation patterns from Spire Codex that can help
Bird Squad become a stronger playable deckbuilder. Spire Codex is not a game
runtime; it is a full-stack data/reference application for Slay the Spire 2.
The value for Bird Squad is in its data modeling, tooling, browser UX patterns,
run summaries, rich text handling, asset pipeline, and balance-analysis habits.

Do not copy Slay the Spire 2 content, extracted data, or extracted art into Bird
Squad. Adapt only architecture, workflow, and general implementation patterns.

## How To Use This Document

This document is an intake backlog, not a gameplay spec. Use it to decide which
patterns are worth adapting. Once accepted, move the actual Bird Squad rule or
data contract into the owning canonical document:

| Pattern Area | Promote To |
| --- | --- |
| Combat resolver, card display, deck zones, enemy moves | `docs/game/core-gameplay-spec.md` |
| Encounters, route map, Signals, Market, run history, local stats | `docs/game/run-design-spec.md` |
| Map 1 content, Alpha enemies, Alpha market prices, Alpha route tuning | `docs/game/alpha-run-spec.md` |
| Art pipeline or runtime asset expectations | `docs/art/art-bible.md` |
| Implementation status or handoff notes | `docs/project/progress.md` |

## Consolidated Intake

| Priority | Pattern | Bird Squad Fit | Next Action |
| --- | --- | --- | --- |
| High | Encounter layer | Decouples route nodes from enemies and unlocks multi-enemy fights. | Add `data/game/alpha-encounters.json` and route-node encounter payloads. |
| High | Enemy moves plus attack patterns | Makes Tells expressive enough for bosses and enemy families. | Extend enemy data beyond simple repeating `intentPattern`. |
| High | Combat resolver extraction | Keeps Phaser scenes readable as effects, Molt, and rewards grow. | Move effect parsing/resolution into a tested gameplay module. |
| High | Card and deck management | Separates durable owned cards from temporary combat card instances. | Add owned-card, reward-event, and combat-zone runtime types. |
| Medium | Shared card display model | Keeps combat cards, deck views, rewards, and codex previews consistent. | Extract display helpers before adding more card UI. |
| Medium | Market/service data model | Lets Scrap prices, service slots, and singleton fallbacks be tuned in JSON. | Add `data/game/alpha-market.json` or equivalent. |
| Medium | Signal event screen model | Supports authored choices, locked options, and dynamic outcomes. | Convert placeholder Signals to structured event data. |
| Medium | Local live-state snapshot | Improves bug reports, Playwright checks, run review, and future debug overlays. | Emit current route/combat/deck/ticker state at key transitions. |
| Medium | Run history and stats lite | Makes balance decisions visible without building a backend. | Write local run-summary artifacts after wins/losses. |
| Medium | Deckbuilding decision prompts | Helps rewards feel like problem-solving instead of collection. | Show why taking, skipping, or preening changes the current deck. |
| Medium | Map identity pressure | Makes each district test a different skill. | Give each map a small encounter/event/reward thesis. |
| Medium | Snag and card-pressure overlays | Adds costs that touch the deck without adding many new card IDs. | Model negative or temporary card modifiers separately from base cards. |
| High | Battle information hierarchy | Reduces clutter by separating always-visible state from inspectable detail. | Re-layout battle into top ribbon, battlefield, compact hand, and detail-on-demand panels. |
| High | Detail-on-demand tooltips | Keeps dense card/status text out of the default view. | Add hover/selected popovers for card, Route Mark, status, and intent details. |
| Medium | Glyph-first route map | Makes the route map scannable and beautiful without node text overload. | Replace large route cards with icon/glyph nodes plus a side detail panel. |
| Low | Optional difficulty modifiers | Creates replay goals after the foundation loop works. | Defer until Map 1 and one full run are stable. |
| Low | Searchable in-game codex | Useful once content volume is larger than Alpha. | Defer until after the first full route loop is stable. |
| Low | Runtime WebP asset pipeline | Valuable when asset loading becomes a real performance bottleneck. | Keep current manifest discipline; optimize later. |

## Current Bird Squad Shape

Bird Squad is a compact Phaser/Vite game prototype.

Current strengths:

- A playable loop exists: menu, route map, combat, rewards, market, and boss.
- Runtime cards, enemies, route map, and card art manifest already live in JSON.
- `window.render_game_to_text` and `window.__birdSquadState` provide useful
  browser-test hooks.
- The art pipeline is unusually strong for an early prototype, with prompt
  generation, dimension checks, composite checks, and runtime art manifests.
- The gameplay specs are already explicit about the card effect DSL, route data,
  and Alpha scope.

Current pressure points:

- Most runtime logic lives in `src/main.ts`, including scenes, rules, display
  formatting, enemy behavior, reward logic, and helper functions.
- Enemy behavior is a flat intent cycle, which will become limiting for bosses,
  multi-enemy fights, and conditional tells.
- Route nodes point directly at enemy payloads; there is no encounter layer
  between route map and enemies.
- Card display formatting is coupled to Phaser scene rendering.
- There is no durable run-history model for post-run summary, analytics, or
  high-signal browser tests.
- There is no in-game compendium/search surface for cards, enemies, route marks,
  and route nodes.

## Bird Squad Gap Matrix

This matrix translates the reference-repo review into Bird Squad shortcomings
that are worth shoring up. It is intentionally focused on game quality and
production leverage, not on copying Spire Codex's website stack.

| Gap | Current Risk | Reference Pattern | Bird Squad Fix |
| --- | --- | --- | --- |
| Battle information hierarchy is cluttered. | Combat is harder to read than it needs to be, especially once more statuses, Supplies, and enemies arrive. | Compact top bars, pills, hover details, and detail-on-demand components. | Re-layout battle into top resource ribbon, clean battlefield, compact hand, intent badges, and optional drawers. |
| Route nodes point directly at enemies. | Multi-enemy fights, boss intros, encounter lessons, and reward tuning will become awkward. | Separate encounter data with room type, act/map, tags, monsters, and loss/summary text. | Add `alpha-encounters.json`; route nodes reference encounters, encounters reference enemies and rewards. |
| Enemy Tells are flat cycles. | Bosses and later enemies may feel predictable or generic. | Monster data separates moves from encounter composition and supports richer intent categories. | Add `moves`, `attackPattern`, conditional moves, and multi-part intent badges. |
| Rewards do not yet teach deckbuilding decisions. | Card rewards can feel like collecting cards instead of solving deck problems. | Run/history UI tracks card choices, skips, picked cards, upgrades, removals, and deck composition. | Add reward-screen state and UI hints for deck gaps, skip value, Preen value, and Flock Stat deltas. |
| Market and services are hardcoded in scene logic. | Economy tuning requires code edits and will not scale to map-specific shops. | Merchant config separates prices, variance, sale state, card removal, and item categories. | Move Market inventory, prices, services, sale flags, and singleton fallbacks into runtime data. |
| Signals are placeholder node resolutions. | Event choices cannot become memorable route decisions. | Event data uses pages, options, locked/chosen states, costs, and outcomes. | Add structured Signal event data and a reusable event choice UI. |
| Route Marks are few and ungrouped. | Passive rewards may become disconnected stat bumps. | Relic-style pools have rarity/source/pool identity and can define run shape outside the deck. | Group Route Marks by safety, economy, route control, suit support, Molt safety, and boss prep. |
| Supplies are not yet a full tactical layer. | Players have fewer emergency answers and boss-prep tools. | Potion-style items are separate from cards, with rarity/pool and compact UI. | Add Supply data with answer types: Cover now, draw now, Wingbeat now, heal now, Open Sky safety, Tell control. |
| Snags are underspecified. | Negative choices may feel random or too binary. | Afflictions distinguish stackable and non-stackable pressure and add extra card text. | Split Snags into negative cards, temporary card-pressure overlays, and route-level Bad Signals. |
| No durable run history. | Balance review depends on memory and one-off playthroughs. | Run summaries track map path, deck, relics, potions, events, card choices, deaths, and post-run stats. | Emit local run-summary JSON after wins/losses and show a post-run summary screen. |
| No local aggregate playtest stats. | It is hard to know which enemies, cards, nodes, or rewards are actually working. | Community stats aggregate picks, skips, deaths, rest choices, event choices, and encounter danger. | Add local stats lite: reward picks/skips, deadliest moves, Cohesion loss by node type, Signal choices, boss losses. |
| No shared card display model. | Card text, deck views, rewards, and tooltips can drift from each other. | Card rendering flows through shared display helpers and rich text parsing. | Extract a display model for cost, role, suit, effect text, upgraded state, art key, and Flock Stats. |
| No shared tooltip/popover system. | More mechanics will either clutter the screen or remain unexplained. | Reusable card/relic/potion pills and hover tooltips expose detail only when needed. | Build Phaser tooltips for cards, statuses, Route Marks, Supplies, intents, and route nodes. |
| Map does not yet express planning cleanly. | Route choice can read as a node list instead of strategic pathing. | Live map uses glyph nodes, quiet paths, path highlighting, current-position animation, and external detail panels. | Use glyph-first route nodes plus a selected-node side panel with risk, reward, and lesson preview. |
| Content lacks map-level mechanical theses in data. | Later maps may become more content rather than different tests. | Acts organize encounter/event/boss pools and create distinct progression pressure. | Add map design profiles: thesis, primary tests, encounter tags, reward bias, and node-type bias. |
| No boss-prep readout. | Boss losses can feel surprising rather than fair. | Guides and run views frame bosses as tests of damage, defense, speed, scaling, and answers. | Show boss pressure preview on the map and readiness hints before the final column. |
| Weak/standard/pressure encounter pacing is informal. | Difficulty curve may feel spiky as content expands. | Encounter data distinguishes weak, normal, elite, and boss bands. | Add encounter bands: `weak`, `standard`, `pressure`, `rival`, `boss`. |
| Debug and QA hooks are useful but not complete. | Bugs in route/combat transitions will be harder to reproduce. | Live-state contracts expose deck, map, combat, event/shop, and recent ticker data defensively. | Add a local live-state snapshot with current node, deck, combat zones, intents, event/shop state, and last 50 events. |

Priority order:

1. Battle readability and detail-on-demand UI.
2. Encounter layer plus enemy move model.
3. Data-driven Signals, Markets, Supplies, and Route Marks.
4. Run history and local playtest stats.
5. Map-level design profiles, boss-prep readouts, and optional challenge layers.

## Reference Findings By Gap Area

These are the concrete findings from Spire Codex that map to the gaps above.
They are written as implementation notes for Bird Squad, not as requirements to
copy reference content.

### Battle Readability And Detail-On-Demand

Reference findings:

- `RunSummary.tsx` uses a compact top stat bar for HP, gold, potions, floor,
  time, and difficulty instead of spreading those values across multiple panels.
- `RunPills.tsx`, `CardHover.tsx`, and `HoverTooltip.tsx` keep dense detail out
  of the default view and reveal card/relic/potion/rules text only on hover.
- `TinyCard.tsx` proves that a card can be represented as a tiny colored icon
  when the player only needs identity/category, not full rules text.
- `LiveEventShop.tsx` uses short item rows with price/status chips and hover
  previews instead of full item cards everywhere.

Bird Squad takeaway:

- The default battle screen should be a decision surface, not a rules document.
- Always-visible UI should be limited to current resources, enemy threat, hand
  affordances, and the end-turn command.
- Full card text, Flock Stats, Route Mark text, and log history should move into
  selected panels, drawers, or tooltips.

Implementation note:

- First battle cleanup should create a top ribbon, compact hand cards, intent
  badges, and a shared tooltip model before adding more combat mechanics.

### Map And Route Planning

Reference findings:

- `LiveMap.tsx` renders route state as an SVG graph: quiet edges, compact glyph
  nodes, highlighted path, and an animated current-position ring.
- Node detail is not embedded into every node. The graph stays visual, while
  labels and details live elsewhere.
- `RunSummary.tsx` renders route history as a row of map icons with tier rings,
  making weak/normal/elite/boss pacing scannable after the run.

Bird Squad takeaway:

- The route map should be glyph-first. Node cards should not carry all text in
  the graph itself.
- The selected node should own the detail panel: title, risk, reward preview,
  encounter lesson, and confirm action.
- Boss visibility should help the player plan backward from the chokepoint.

Implementation note:

- Replace large rectangular route nodes with compact icons and add a right-side
  selected-node panel. Keep only current/selectable nodes high-emphasis.

### Encounter And Enemy Modeling

Reference findings:

- `data/encounters.json` separates encounter identity from monster identity:
  room type, weak flag, act, tags, monster lineup, and loss text.
- `data/monsters.json` stores monster health ranges and move names separately
  from encounter composition.
- Encounter listings distinguish Monster, Elite, Boss, and Weak filters.
- `intents.json` describes intent categories as referenceable concepts, not
  only strings embedded in monster behavior.

Bird Squad takeaway:

- Route node -> enemy is too narrow. Route node -> encounter -> enemies gives
  room for multi-enemy fights, boss intros, encounter lessons, reward tuning,
  and better route previews.
- Enemy Tells should become structured badges and move objects instead of flat
  repeating strings.

Implementation note:

- Add `data/game/alpha-encounters.json`, `EncounterBand`, enemy `moves`, and
  `attackPattern` before expanding the enemy roster.

### Rewards, Deck Management, And Run Decisions

Reference findings:

- Run data stores deck entries with card ID, upgraded state, enchantment, and
  floor-added metadata.
- Run summaries track card choices, picked/skipped rewards, cards gained,
  removed cards, upgraded cards, potion use, relic choices, rest choices, event
  choices, and death context.
- Run UI stacks duplicate cards by card ID plus upgrade/modifier state and uses
  stable ordinal keys where duplicate IDs can appear.

Bird Squad takeaway:

- The durable run deck should be separate from temporary combat card instances.
- Reward screens should become recorded events, not just transient UI.
- Singleton deckbuilding needs explicit support for skip, Preen, removal, and
  fallback rewards so the rule feels intentional.

Implementation note:

- Add `OwnedCard`, `CombatCardInstance`, `CombatDeckZones`, and
  `CardRewardEvent` types. Record offered, picked, skipped, preened, and removed
  cards in run history.

### Market, Supplies, And Economy

Reference findings:

- `merchant_config.json` keeps card, relic, potion, sale, and removal pricing
  outside UI code.
- Shop rows represent category, item, price, sale state, sold state, and item
  preview separately.
- Potions are their own tactical item layer with rarity and pool identity.

Bird Squad takeaway:

- Scrap economy should be tuneable without editing `src/main.ts`.
- Market inventory should use categories: Cards, Route Marks, Supplies,
  Services.
- Supplies should be tactical answers, not just extra rewards.

Implementation note:

- Add `data/game/alpha-market.json` and `data/game/alpha-supplies.json`.
  Include price bands, sale/sold state, service prices, supply answer types, and
  singleton fallback behavior.

### Signals, Snags, And Choice Pressure

Reference findings:

- `data/events.json` uses event IDs, act placement, descriptions, options, and
  pages.
- `LiveEventShop.tsx` renders event choices as rows with chosen, locked, and
  proceed states.
- `data/afflictions.json` separates negative pressure from normal card
  definitions and marks whether that pressure is stackable.

Bird Squad takeaway:

- Signals need authored choices with stable keys, costs, requirements, locked
  states, outcomes, and route memory.
- Snags should not be only permanent bad cards. Some pressure can be temporary
  overlays or route-level Bad Signals.

Implementation note:

- Add structured Signal data and `CardPressure` overlays. Keep Alpha Signals
  simple, but give them the same durable shape future events will need.

### Route Marks And Run Identity

Reference findings:

- Relics are grouped by rarity and pool, giving passive rewards a source and
  acquisition identity.
- Run pages display relic strips as compact icons with hover details, making
  passive build identity visible without taking over the screen.
- Stats systems can later analyze relic pickup timing and win/loss impact.

Bird Squad takeaway:

- Route Marks should become the visible run-identity layer outside the deck.
- They need families and sources, not only one-off effects.

Implementation note:

- Add Route Mark family/source fields: safety, economy, route control, suit
  support, Molt safety, boss prep. Display them as compact top-ribbon chips with
  hover details.

### Run History, Playtest Data, And QA

Reference findings:

- Run summaries preserve path, deck, resources, choices, deaths, upgrades,
  removals, and event outcomes.
- Community stats aggregate card picks/skips, rest choices, deaths, event
  choices, removed cards, stolen/negative cards, and encounter danger.
- Live presence data exposes current map, path, deck, combat, event/shop state,
  and recent ticker events defensively.

Bird Squad takeaway:

- The game needs local playtest memory before it needs online analytics.
- Post-run summaries and local JSON artifacts will make balance work much more
  concrete.
- Debug snapshots will make route/combat bugs easier to reproduce.

Implementation note:

- Emit local run-summary JSON after victory/defeat and maintain a live-state
  snapshot with current route node, deck, combat zones, enemy intents, active
  Signal/Market, and recent events.

### Content Scale And Documentation Discipline

Reference findings:

- Data is split by domain: cards, relics, potions, events, encounters,
  monsters, acts, intents, keywords, afflictions, modifiers, merchant config,
  and changelogs.
- Search/filter surfaces rely on consistent tags, rarity, type, pool, act, and
  ID fields.
- Diff/changelog tooling helps track balance changes across data versions.

Bird Squad takeaway:

- Bird Squad should continue moving runtime content out of scene code and into
  small, validated data files.
- Every new content domain should have stable IDs, source docs, validation, and
  a clear owner.

Implementation note:

- Extend runtime validation as each data file lands: encounters, markets,
  supplies, signals, route marks, run summaries, and card-pressure overlays.

## Best Adaptation Candidates

### 1. Encounter Layer

Spire Codex separates monsters from encounters. Encounters know room type,
monster lineup, act, tags, and related presentation text. Bird Squad route nodes
currently point directly at enemy IDs through `payloadId`.

Adaptation:

- Add `data/game/alpha-encounters.json`.
- Change combat route nodes so `payloadId` references an encounter ID.
- Let encounters reference one or more enemy IDs.
- Move combat rewards and lesson text from enemy data to encounter data where
  possible.

Proposed shape:

```json
{
  "id": "enc_roof_rat_opening",
  "name": "Roof Rat Crossing",
  "type": "street",
  "lesson": "Read a basic attack Tell and use Cover.",
  "enemies": ["roof_rat"],
  "rewards": {
    "scrap": [25, 40],
    "cardReward": true,
    "preenChance": 0.25,
    "routeMarkChance": 0.15
  }
}
```

Why it helps:

- Multi-enemy fights become data-driven.
- Route nodes can reuse encounters without duplicating enemy data.
- Reward tuning becomes route/encounter based instead of enemy based.
- Boss and rival encounters can carry special intro/outro text.

Implementation priority: high.

### 2. Enemy Moves Plus Attack Patterns

Spire Codex models monsters as a set of moves plus an attack-pattern state
machine. Bird Squad currently stores `intentPattern` as a simple repeating list.

Adaptation:

- Replace or extend `intentPattern` with `moves` and `attackPattern`.
- Support these first:
  - `cycle`: deterministic move order.
  - `random`: weighted move choice.
  - `conditional`: choose a move when a condition passes.
  - `mixed`: simple state graph with branches.

Proposed shape:

```json
{
  "id": "wire_hawk",
  "name": "Wire Hawk",
  "health": 28,
  "moves": [
    {
      "id": "watch_winded",
      "label": "Watch",
      "intent": "debuff",
      "effects": ["applyWinded(flock, 1)"]
    },
    {
      "id": "heavy_strike",
      "label": "Heavy Strike 11",
      "intent": "attack",
      "effects": ["damage(flock, 11)"]
    }
  ],
  "attackPattern": {
    "type": "cycle",
    "initialMove": "watch_winded",
    "states": [
      { "id": "watch", "moveId": "watch_winded", "next": "heavy" },
      { "id": "heavy", "moveId": "heavy_strike", "next": "strike" },
      { "id": "strike", "moveId": "strike_7", "next": "watch" }
    ]
  }
}
```

Why it helps:

- Boss patterns can escalate without hardcoded branches.
- Enemy intent tooltips can show move details consistently.
- Tests can verify enemy AI independently from Phaser rendering.
- Later route marks can manipulate tells, state, or next moves.

Implementation priority: high.

### 3. Combat Resolver Extraction

Bird Squad's combat rules are currently embedded in the BattleScene class.
Spire Codex's value here is not a direct game-loop pattern, but its strict
separation between data models, display models, and service logic.

Adaptation:

- Extract a pure combat module under `src/game/combat/`.
- Keep Phaser scenes responsible for input and rendering.
- Move effect parsing, condition checks, damage math, healing, cover, Molt, and
  enemy effects into pure functions.

Suggested files:

- `src/game/combat/effects.ts`
- `src/game/combat/conditions.ts`
- `src/game/combat/resolver.ts`
- `src/game/combat/enemy-ai.ts`
- `src/game/combat/run-state.ts`

Why it helps:

- Combat tests can run without a browser.
- Card additions stop requiring scene edits.
- The effect DSL becomes a real engine surface.
- Future mechanics can be added behind explicit resolver functions.

Implementation priority: high.

### 4. Card Display Model

Spire Codex uses a dedicated card display model to calculate upgraded cost,
upgraded text, visible keywords, and display fields before rendering.

Adaptation:

- Add `src/game/card-display.ts`.
- Move display helpers out of `src/main.ts`.
- Make all card render surfaces consume the same display model:
  - hand card
  - card detail panel
  - reward choice
  - deck overlay
  - market card
  - run summary

Suggested API:

```ts
export interface CardDisplayModel {
  id: string;
  name: string;
  displayName: string;
  cost: number;
  suitLabel: string;
  typeLabel: string;
  targetLabel: string;
  activeText: string;
  upgradedText: string;
  statRows: string[];
  artKey?: string;
}
```

Why it helps:

- Card text stays consistent everywhere.
- Upgrade and suit display logic has one owner.
- Phaser rendering code gets smaller and easier to tune visually.

Implementation priority: high.

### 5. Card And Deck Management Clues

Spire Codex does not implement live deckbuilder combat zones like draw pile,
hand, discard pile, exhaust, or end-of-turn cleanup. Its useful deck-management
clues come from how it stores, displays, and analyzes completed and live run
decks.

Patterns worth adapting:

- Treat a deck card as a small owned-card record, not just a card ID.
- Preserve upgrade state on the owned card.
- Preserve special modification state on the owned card.
- Preserve when the card entered the deck.
- Record reward screens as offer groups, including which card was picked.
- Record cards gained, removed, and upgraded at the floor/node where they
  happened.
- Stack duplicate deck entries for display by `id + upgraded + modifier`.
- Use stable duplicate keys when rendering repeated card IDs.
- Separate card definition data from owned-card instance data.

Spire-style owned-card shape:

```ts
interface OwnedDeckCard {
  id: string;
  upgraded: number;
  modifier?: string | null;
  floorAdded?: number | null;
}
```

Bird Squad equivalent:

```ts
interface OwnedCard {
  id: string;
  upgraded?: boolean;
  joinedAtNodeId?: string;
  source?: 'starter' | 'reward' | 'market' | 'signal' | 'boss';
}
```

This is close to Bird Squad's current `SavedCard`, but the extra source and
route-node fields would make post-run summaries, playtest telemetry, and reward
validation much stronger.

Spire-style reward-choice shape:

```ts
interface CardRewardChoice {
  cardId: string;
  wasPicked: boolean;
  floor: number;
}
```

Bird Squad equivalent:

```ts
interface CardRewardEvent {
  nodeId: string;
  offeredCardIds: string[];
  pickedCardId?: string;
  skipped: boolean;
}
```

Why it helps:

- Reward quality can be measured by what players pick and skip.
- Singleton filtering can be audited after each reward screen.
- The run summary can show "joined the flock", "preened", and "released"
  moments in route order.
- Upgrade choices become a real preference signal instead of just a final deck
  flag.
- Future duplicate or temporary-card rules can be added without rewriting the
  deck model.

Bird Squad should keep its live combat zones as separate arrays of card
instances:

```ts
interface CombatCardInstance {
  instanceId: string;
  cardId: string;
  upgraded?: boolean;
  temporaryCostDelta?: number;
  temporary?: boolean;
}

interface CombatDeckZones {
  drawPile: CombatCardInstance[];
  hand: CombatCardInstance[];
  discardPile: CombatCardInstance[];
  exhaustPile: CombatCardInstance[];
}
```

The run deck should remain the durable ownership list. Combat zones should be
derived from the run deck at combat start and discarded after combat ends. This
keeps route ownership, card rewards, and combat shuffling from stepping on each
other.

Implementation priority: high.

### 6. Rich Text Tokens For Game Terms

Spire Codex has a rich description tokenizer for color tags, icons, dynamic
placeholders, and nested formatting. Bird Squad does not need React rendering,
but it can use the same idea.

Adaptation:

- Define a tiny Bird Squad text token format:
  - `[cohesion]`
  - `[cover]`
  - `[wingbeat]`
  - `[resonance]`
  - `[molt]`
  - `[winded]`
  - `[opensky]`
  - `[plumes]`, `[quills]`, `[basins]`, `[nests]`
- Add a tokenizer that returns text segments with semantic classes.
- Render tokens in Phaser card detail panels and logs using colored text
  segments or inline icons.

Why it helps:

- Player-facing text becomes more readable.
- Effects can keep using normalized syntax while UI text feels polished.
- Tooltips can later be attached to terms.

Implementation priority: medium.

### 7. Searchable In-Game Codex

Spire Codex has reusable search/filter UX and a unified search endpoint. Bird
Squad can adapt the user experience inside the game without adding a backend.

Adaptation:

- Add an in-game Codex overlay reachable from route map and menu.
- Search across cards, enemies, route marks, and route nodes.
- Add filters:
  - cards: suit, rarity, type, cost
  - enemies: type, lesson, intent
  - route marks: source, effect category
- Include result count and keyboard navigation.

Why it helps:

- Makes the game more self-explaining without tutorial walls.
- Helps QA browse all runtime data from inside the running game.
- Useful for balancing and card implementation checks.

Implementation priority: medium.

### 8. Run History And Post-Run Summary

Spire Codex's shared run page turns run data into a compact, readable summary:
map path, stats, cards, relics, potions, node outcomes, and death/victory text.

Adaptation:

- Add a `RunHistory` object to Bird Squad.
- Append structured events as the player chooses nodes and resolves rewards.
- Render a post-run summary after victory or defeat.
- Expose the same model through `window.__birdSquadState`.

Suggested event types:

```ts
type RunHistoryEvent =
  | { type: 'node_entered'; nodeId: string; encounterId?: string }
  | { type: 'combat_won'; nodeId: string; turns: number; damageTaken: number }
  | { type: 'card_added'; cardId: string; source: string }
  | { type: 'card_preen'; cardId: string; source: string }
  | { type: 'route_mark_added'; markId: string; source: string }
  | { type: 'scrap_changed'; amount: number; reason: string }
  | { type: 'defeat'; nodeId: string; cause: string }
  | { type: 'map_complete'; mapId: string };
```

Why it helps:

- Gives the player a sense of journey and consequence.
- Creates better smoke-test assertions.
- Opens the door to balance metrics later.

Implementation priority: high.

### 9. Runtime Asset WebP Pipeline

Spire Codex copies source PNGs and writes WebP siblings only when stale. Bird
Squad already validates art dimensions and manifests, but runtime asset
generation can become more repeatable.

Adaptation:

- Add a single script that creates:
  - `assets/runtime/cards/portrait/{cardId}.webp`
  - `assets/runtime/cards/thumb/{cardId}.webp`
  - `assets/runtime/cards/icon/{cardId}.webp`
- Skip outputs newer than the source PNG.
- Update `assets/runtime/cards/card-art-manifest.json`.
- Validate all manifest paths and dimensions.

Why it helps:

- Smaller runtime assets.
- Less manual churn in generated images.
- More reliable card art loading in Phaser.

Implementation priority: medium.

### 10. Field-Level Runtime Data Diff

Spire Codex has data diff tooling that reports changed fields instead of opaque
whole-object changes.

Adaptation:

- Add `tools/diff-runtime-data.mjs`.
- Compare cards, enemies, route maps, route marks, and eventually encounters.
- Match list items by stable `id` when possible.
- Preserve hand-authored release notes if writing changelog files.

Example output:

```text
cards.wands_ace.effects[0]: damage(target, 2) -> damage(target, 3)
enemies.wire_hawk.health: 28 -> 30
route.m1_c3_market_rooftop.risk: low -> medium
```

Why it helps:

- Faster balance review.
- Safer generated-data updates.
- Easier to explain why a playtest build feels different.

Implementation priority: medium.

### 11. Stronger Schema Validation

Bird Squad already has `tools/validate-runtime-data.mjs`. Spire Codex reinforces
the value of strict contracts, especially once content expands.

Adaptation:

- Keep dependency-free validation for fast runs.
- Add deeper checks as the schemas expand:
  - every effect verb is supported by resolver
  - every condition is supported by resolver
  - every encounter enemy ID exists
  - every attack-pattern move ID exists
  - every state graph can reach a move
  - every route node payload exists in the right data file
  - every route offers required node variety
  - every reward table can produce a valid reward after singleton filtering

Why it helps:

- Content errors fail in tooling, not during play.
- New cards and enemies can be added confidently.

Implementation priority: high.

## Additional Findings For A Better Game

### Make Tells More Expressive

Bird Squad's visible enemy tells are already core to combat. Spire Codex's
monster move data suggests a richer tell model:

- intent category
- damage value
- hit count
- block value
- heal value
- powers/statuses applied
- target
- tooltip text

Bird Squad should promote enemy intent from a short label into a structured UI
object. The player should be able to quickly read "Attack 6", "Brace 8",
"Debuff: Winded", or "Attack 5 + Open Sky pressure" without parsing logs.

### Use Encounter Lessons As Design Constraints

Bird Squad enemy data already has `lesson` fields. Turn those into a balancing
tool:

- every encounter should teach or test one idea
- route placement should control when lessons appear
- reward cards after an encounter can reinforce the lesson
- boss phases should combine lessons from that map

This is a practical design loop:

1. Choose the lesson.
2. Create the enemy or route node.
3. Add one or two card/reward hooks that answer it.
4. Test whether the player sees the choice.

### Add Enemy Families Before Adding Many Enemies

Instead of adding many one-off enemies, define small enemy families:

- scavengers: heal, brace, scrap pressure
- wire threats: Winded, heavy attacks, delayed tells
- rival crews: stronger rewards, more layered patterns
- boss crews: multi-phase versions of map lessons

This keeps the Alpha readable and helps route identity.

### Make Route Marks The Build-Identity Layer

Bird Squad's cards are singleton, which makes Route Marks especially important.
They can carry repeated run identity without needing duplicate cards.

Good Route Marks should modify a clear rule:

- first Plumes each turn gives Resonance
- first Basin at full Cohesion draws
- Nests retain some Cover
- Quills apply extra Winded against attacking enemies
- first Molt each combat gains Open Sky Guard

Spire Codex's relic/stat surfaces suggest that Route Marks should eventually
have their own browser, tooltip, and run-summary strip.

### Track Balance Data Locally Before Building Analytics

Spire Codex has large community-stat systems, but Bird Squad only needs local
telemetry at first.

Track per run:

- cards offered
- cards picked
- cards played
- cards upgraded
- node path
- damage taken per encounter
- turn count per encounter
- defeat node and cause
- route marks acquired

This can start as JSON emitted to `.artifacts/playtest-runs/`. No backend is
needed.

### Build A Debug Battle Launcher

Spire Codex makes data easy to inspect. Bird Squad should make scenarios easy to
launch.

Useful debug launch options:

- start combat by encounter ID
- choose starting deck IDs
- choose route mark IDs
- set Cohesion and Scrap
- force specific draw order
- force enemy pattern state

This would make balancing much faster than clicking through the route every
time.

### Make Card Rewards Explain Singleton Filtering

The singleton deck is a core Bird Squad rule. The reward UI should make it feel
intentional:

- reward pool excludes owned cards
- when the pool is thin, offer Preen, Scrap, or Route Mark alternatives
- run summary should show "new flock members" separately from preened cards

### Prefer Data-Driven Events Early

Spire Codex's event modeling highlights how quickly events become complex. Bird
Squad should keep Alpha Signals small but structured:

- event ID
- title
- pages
- choices
- preconditions
- outcomes
- text snippets

Do not hardcode Signal outcomes directly in the scene once there are more than
two or three.

### Add Small Motion And Feedback Systems

Spire Codex is a static app, so this is a contrast finding: Bird Squad should
lean into game feel where Spire Codex cannot.

High-value feedback:

- card lift and snap-back on hover
- enemy tell pulse before Roost
- damage number rise/fade
- Cover chip animation before Cohesion damage
- Molt state vignette or feather flash
- route node completion stamp
- reward card arrival animation

These can be implemented after combat extraction so scene code stays readable.

### Add A Tiny Card Primitive

Spire Codex has both full card views and tiny card views. That separation is a
strong fit for Bird Squad because a singleton deck still needs compact,
scan-friendly displays:

- route reward previews
- deck inspection
- run summary
- debug battle setup
- codex search results

Bird Squad can add a small card chip component that uses suit, card kind, and
rarity colors instead of trying to render full art everywhere. This can be a
Phaser container with a fixed size, rank/name text, cost, and suit accent. The
important pattern is that tiny cards are their own display primitive, not just a
scaled-down full card.

### Keep Full Card Rendering On A Shared Display Model

Spire Codex routes card rendering through shared display-model helpers before it
draws full-size cards, tiny cards, and tooltips. Bird Squad should do the same
before card UI spreads further through `src/main.ts`.

Useful display-model fields:

- display name
- cost label
- suit label
- card kind label
- rarity label
- effect text with token markers
- upgraded or altered state
- art key and fallback art key

This gives reward cards, codex cards, deck cards, and combat cards the same
source of truth while still allowing different layouts.

### Move Market And Service Rules Into Data

Spire Codex keeps merchant configuration outside component code. Bird Squad has
a natural equivalent in market, nest, and service nodes.

Candidate data file:

```text
data/game/alpha-market.json
```

Useful fields:

- card slot rules by suit, kind, or rarity
- price bands
- discount flags
- singleton-deck fallback rewards
- Preen or remove-card service price
- Scrap, Cohesion, or Route Mark exchange rates
- stock IDs and sold-out state for run history

This would let Bird Squad tune economy without editing Phaser scene code.

### Model Signals As Authored Event Screens

Spire Codex's event data shows that event screens need more structure than a
title plus text once preconditions and branching choices arrive. Bird Squad
Signals can stay small while still using a durable shape:

```ts
interface SignalChoice {
  key: string;
  text: string;
  locked?: boolean;
  requires?: string[];
  outcomeId?: string;
  proceed?: boolean;
}

interface SignalEvent {
  id: string;
  title: string;
  prompt: string;
  choices: SignalChoice[];
}
```

Two details matter:

- preserve authored choice order instead of sorting alphabetically
- keep internal keys separate from player-facing text

That keeps Signals readable for designers and stable for saves, summaries, and
tests.

### Add A Local Live-State Snapshot

Spire Codex's live view is built around a compact, defensive state contract: run
identity, current map position, deck, relics or potions, current combat, enemy
intents, event/shop screen, and a short ticker of recent actions.

Bird Squad can use the same idea locally without a backend. A debug snapshot
could be emitted to memory, local storage, or `artifacts/playtests/` after key
actions:

- current node and route path
- deck ownership list
- combat zones if combat is active
- enemy intents and pending move IDs
- active Signal or market screen
- last 50 run events
- run seed and data version

This is useful for screenshots, bug reports, Playwright checks, balancing, and
future spectator/debug overlays.

### Track A Playtest Stats Lite File

Spire Codex aggregates community run stats such as event choices, skipped card
rewards, removed cards, deaths, and rest-site choices. Bird Squad does not need
community infrastructure, but it would benefit from a local aggregate file.

High-value local metrics:

- reward offers shown versus picked
- reward skips and fallback choices
- deadliest enemy moves
- damage taken by node type
- Signals chosen and skipped
- cards preened or removed
- Route Marks acquired
- average deck size by act
- loss node and loss cause

This makes balance work more concrete, especially once Alpha content grows past
hand testing.

### Use Stable Duplicate Keys Everywhere

Even with a singleton deck, duplicates can still appear in UI lists: rewards can
include repeated fallback services, combat previews can show repeated temporary
instances, and history can include the same card appearing across multiple
events. Spire Codex handles this by adding ordinal keys around repeated IDs.

Bird Squad should avoid using raw `card.id` as a UI key when rendering dynamic
lists. Prefer helpers like:

```ts
function withOrdinalKeys<T extends { id: string }>(items: T[]) {
  const counts = new Map<string, number>();
  return items.map((item) => {
    const next = (counts.get(item.id) ?? 0) + 1;
    counts.set(item.id, next);
    return { ...item, uiKey: `${item.id}:${next}` };
  });
}
```

That prevents future animation, selection, and tooltip bugs when repeated
entries become possible.

### Render Defensively Around Optional Runtime Data

Spire Codex frequently treats extracted or live data as optional: card images
can be missing, enemy intents can have multiple parts, event options can be
locked, and localized strings can fall back to IDs. Bird Squad should adopt that
same posture in UI even though its current data is local and curated.

Practical rules:

- every art lookup gets a fallback
- every tooltip tolerates missing description text
- every enemy intent supports multiple effect parts
- every route/event node renders a known unknown state
- every player-facing label falls back to the stable internal ID

This makes content iteration less fragile and improves QA when new JSON is
half-finished.

## Game Design Pass Findings

This pass looked less at code structure and more at what Spire Codex reveals
about durable deckbuilder design: player decision pressure, run pacing, reward
ecology, and teachable systems. These are design patterns to adapt, not content
to copy.

### Turn Card Rewards Into Deck Problem Solving

Spire-style deckbuilding works because card rewards are not simply "take the
best card." They ask whether the current deck needs damage, defense, scaling,
draw, economy, cleanup, or boss answers.

Bird Squad already has singleton rewards and Preen. The next quality jump is to
make the reward UI explain the decision:

- show current deck gaps before choosing a card
- mark each reward with a role: damage, Cover, recovery, draw, Resonance, Molt,
  Winded, or setup
- show whether the card improves a weak area or doubles down on an existing
  route
- include `Skip` and `Preen instead` as intentional choices when appropriate
- show Flock Stat deltas beside active-effect deltas

Good Bird Squad reward prompt:

```text
Current Flock: low Cover, strong Damage, light recovery.
Pick a card, skip for Scrap, or Preen an owned card.
```

Implementation detail:

```ts
interface DeckNeedSummary {
  damage: 'low' | 'steady' | 'strong';
  cover: 'low' | 'steady' | 'strong';
  recovery: 'low' | 'steady' | 'strong';
  draw: 'low' | 'steady' | 'strong';
  moltSafety: 'low' | 'steady' | 'strong';
}
```

This makes singleton deckbuilding feel strategic rather than restrictive.

### Give Each Map A Mechanical Thesis

Spire Codex data organizes acts, encounters, events, bosses, and pools by act.
Bird Squad's four-map arc already has narrative roles, but each map should also
have a gameplay thesis that content can be judged against.

Suggested map theses:

| Map | Design Thesis | Content Pressure |
| --- | --- | --- |
| Rooftop Blocks | Learn visible Tells and build a first deck identity. | Cover versus attacks, first Molt risk, simple rewards. |
| Canal Markets | Survive attrition while tuning the deck. | Recovery pressure, Scrap tension, Market/Nest choices. |
| Signal Spires | Sequence tempo and react to complex intents. | Resonance, draw, Winded, multi-part Tells. |
| High Roost | Prove the full build under route consequences. | Boss prep, Route Mark payoffs, Molt discipline. |

Implementation detail:

Add map-level design fields when the route schema grows:

```ts
interface MapDesignProfile {
  thesis: string;
  primaryTests: string[];
  preferredNodeTypes: RouteNodeType[];
  encounterTags: string[];
  rewardBias: string[];
}
```

This gives future content reviews a sharper question: "Does this node support
the map's thesis?"

### Make Rival Crews A Boss-Prep Bet

Spire-like elite nodes are not just harder fights. They are a route bet: take
more damage now to gain power needed for later bosses.

Bird Squad's Rival Crew rule is already close. The design improvement is to
make the boss-prep value explicit:

- show the boss endpoint from the start of the map
- show a short boss pressure preview, such as "tests Molt restraint"
- make Rival Crew rewards answer that pressure more often than normal rewards
- let Rival Crews drop Route Marks that visibly prepare for the district boss

Example Bird Squad pattern:

```text
Tarline Crew reward bias: Cover, Open Sky Guard, Preen, boss-prep Route Mark.
Tar-Crowned Crow pressure: Heavy Strike and Open Sky punishment.
```

This connects optional difficulty to informed preparation instead of raw greed.

### Add Weak, Normal, And Rival Encounter Bands

Spire Codex distinguishes weak and normal encounters. Bird Squad can adapt that
as route pacing without needing many new enemies.

Proposed encounter bands:

| Band | Bird Squad Use |
| --- | --- |
| `weak` | Opening fights that teach one rule and should not punish experimentation. |
| `standard` | Main street encounters with one clear Tell lesson. |
| `pressure` | Late-map normal fights that demand a more complete answer. |
| `rival` | Optional high-risk fights with better rewards and boss-prep value. |
| `boss` | Required chokepoint with signature mechanic. |

Implementation detail:

```ts
type EncounterBand = 'weak' | 'standard' | 'pressure' | 'rival' | 'boss';
```

This gives Map 1 better pacing even before procedural generation exists.

### Separate Route Marks Into Design Families

Spire-style relic pools contain many passive effects, but the important design
lesson is not volume. It is that passive rewards create run identity outside the
deck.

Bird Squad should group Route Marks by the kind of run story they create:

| Family | Example Role |
| --- | --- |
| Opening safety | Start combat with Cover, Wingbeat, or Open Sky Guard. |
| Economy | More Scrap, cheaper Preen, better Market slots. |
| Route control | Reveal nodes, unlock edges, improve Cache or Signal outcomes. |
| Suit support | Reward playing Plumes, Quills, Basins, or Nests. |
| Molt safety | Reduce Open Sky risk or improve the boosted card. |
| Boss prep | Answer a specific boss pressure. |

Implementation detail:

```ts
interface RouteMark {
  id: string;
  family: 'safety' | 'economy' | 'route' | 'suit' | 'molt' | 'bossPrep';
  trigger: string;
  effect: string;
}
```

This prevents Route Marks from becoming a pile of disconnected stat bonuses.

### Treat Supplies As Tactical Insurance

Spire Codex separates potions from cards and relics, with rarity and pools. Bird
Squad already names Supplies as potion-equivalents. The missing design detail is
that Supplies should help players survive a known tactical failure:

- I cannot block this turn.
- I need one more Wingbeat.
- I need to draw into an answer.
- I am exposed by Open Sky.
- I need emergency recovery.

Bird Squad's Supply categories already fit. The implementation should make each
Supply carry an `answerType` so rewards and shops can offer useful safety valves:

```ts
type SupplyAnswerType =
  | 'coverNow'
  | 'drawNow'
  | 'wingbeatNow'
  | 'healNow'
  | 'openSkySafety'
  | 'tellControl';
```

This also improves boss-prep UI: before a boss, the game can hint that a Supply
answers a visible threat.

### Model Snags As Cards Plus Pressure Modifiers

Spire Codex has both negative cards and card-affecting afflictions, including
stackable and non-stackable pressure. Bird Squad should keep Alpha Snags simple,
but a useful long-term model is:

- Snag cards: actual negative cards in deck zones
- Snag overlays: temporary pressure attached to an owned card or combat instance
- Bad Signals: route-level pressure that may create Snags later

Implementation detail:

```ts
interface CardPressure {
  id: string;
  label: string;
  stackable: boolean;
  extraCardText: string;
  effect: string;
}
```

Bird-themed examples could include wet, tangled, exposed, or noisy states. The
design goal is to create costs that alter play patterns without bloating the
permanent card list.

### Add Boss Prep Checks To The Route Map

Spire guide material repeatedly frames bosses as tests of damage, defense,
speed, scaling, and answer cards. Bird Squad should expose a lightweight version
of that thinking to the player.

Before the boss column, show:

- boss name and signature Tell theme
- expected pressure: Heavy Strike, Open Sky punishment, summons, scaling, etc.
- current deck readiness signals
- best upcoming prep nodes: Basin, Nest, Market, Rival Crew, or Cache

This can be compact and diegetic:

```text
Crow crossing ahead: tests Cover and Molt restraint.
Flock read: Cover thin, Open Sky Guard steady.
```

This makes route planning feel fair and strategic.

### Add Optional Run Modifiers After The Core Loop

Spire Codex tracks ascensions and run modifiers. Bird Squad should not add this
early, but it is a good replayability pattern once the core game works.

Bird Squad equivalents:

- harder Rival Crew density
- fewer reward choices
- harsher Open Sky
- higher Release/Preen prices
- fewer Supply slots
- hidden route previews
- lower starting Cohesion

These should be opt-in challenge layers, not Alpha balance patches. The base
game should stand on its own first.

### Give Future Flock Leaders Starting Loadouts

Spire Codex character data combines starting health, starting deck, starting
passives, color identity, and unlock order. Bird Squad's Flock Leaders are
deferred, but this confirms a good shape when they arrive.

Future leader contract:

```ts
interface FlockLeader {
  id: string;
  name: string;
  suitBias: Suit | 'molt' | 'mixed';
  startingCohesion: number;
  startingScrap: number;
  startingDeckIds: string[];
  startingRouteMarks: string[];
  passiveRule: string;
  unlocksAfter?: string;
}
```

Do not add leaders before the first full run is good. But when replay identity
is needed, leaders should be loadout plus rule bias, not just portraits.

## UI/UX Pass Findings

This pass focused on Spire Codex's interface patterns that can improve Bird
Squad's map and battle scenes. Spire Codex is not a Phaser battle UI, but its
best reusable ideas are strong information hierarchy, compact visual tokens,
detail-on-demand, and separation between the main decision surface and deep
inspection.

### Battle Scene Clutter Diagnosis

Bird Squad's current battle scene renders too many full-detail panels at the
same priority:

- HUD panel with turn, Wingbeats, Resonance, draw/discard, selected card, and
  route node
- Flock panel with Cohesion, Cover, statuses, and a Flock Stats button
- enemy body, name, health, intent text, and status text
- Roost button in the battlefield area
- five hand cards, each with name, bird, effect text, and type
- Deck and Discard pile buttons
- Signals log panel

The result is that combat has little quiet space. The screen is trying to be
battlefield, dashboard, card inspector, combat log, and deck browser at once.

The cleaner pattern is:

- always show only the state needed for the next decision
- put explanatory text behind hover, selected state, or modal inspection
- make the battlefield visually dominant
- make cards readable as tools, not mini documentation pages
- give every screen region one job

### Recommended Battle Layout

Use four stable zones:

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Top ribbon: Cohesion/Cover | Wingbeats/Resonance | Draw/Discard | Map │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ Battlefield: Flock left, enemies right, intents attached to enemies  │
│                                                                      │
│                              [Roost]                                 │
├──────────────────────────────────────────────────────────────────────┤
│ Hand: 5 compact cards, selected card expands/lifts with detail        │
└──────────────────────────────────────────────────────────────────────┘
```

Implementation guidance:

- Move Wingbeats, Resonance, Draw, Discard, Scrap, and Route Marks into a
  compact top ribbon.
- Keep Flock visible as a character/state anchor, but remove the large Flock
  Stats button from the default battlefield.
- Put Roost near the hand as the end-turn command, not floating beside enemies.
- Replace the Signals log box with a one-line last-action toast and a small log
  button.
- Show only one expanded card detail at a time.
- Reserve the center for art, enemy silhouettes, intent badges, and animation.

### Use Intent Badges Instead Of Intent Sentences

Spire Codex's live map and intent reference patterns are glyph-first: the icon
or badge carries the scan, while text is available in detail. Bird Squad should
render enemy Tells the same way.

Default enemy intent badge:

```text
[Attack icon] 6
```

Expanded/hover detail:

```text
Strike
Deals 6 damage after Roost.
Cover and Winded reduce this.
```

Implementation detail:

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

This removes repeated strings like `Intent: Heavy Strike 11` from the main
view while making danger easier to read.

### Make The Hand Compact Until A Card Is Selected

Spire Codex uses `TinyCard`, `CardHover`, and pill components so dense lists do
not show full card text by default. Bird Squad can adapt that directly in the
hand.

Default hand card should show:

- cost
- card name
- suit/type accent
- one role chip, such as Damage, Cover, Draw, Heal, Molt, Winded
- simple playable/unplayable state

Selected or hovered card should show:

- full effect text
- bird species
- Flock Stat contribution
- Preen preview if relevant
- large art crop or full card preview

Implementation detail:

```ts
interface HandCardView {
  id: string;
  cost: string;
  name: string;
  suitAccent: string;
  roleChip: string;
  playable: boolean;
  selected: boolean;
}
```

This change alone would remove most battle-scene text clutter.

### Convert Piles And Stats Into Icon Chips

Spire Codex's run summary top bar uses compact icon stats rather than large
panels. Bird Squad can use the same idea for battle resources.

Always-visible chips:

- Cohesion `current/max`
- Cover
- Wingbeats
- Resonance
- Draw pile count
- Discard pile count
- Supplies count
- Route Marks count

Each chip can open or hover a detail panel. The default screen does not need a
large Flock Stats panel, deck stack button, and discard stack button all taking
separate real estate.

### Treat The Log As A Drawer, Not A Panel

Spire Codex's live UI keeps recent ticker events as supporting context. Bird
Squad's Signals log should not compete with the fight.

Recommended behavior:

- show the latest important event as a fading toast
- keep a small `Signals` or `Log` button in the top ribbon
- open a right-side drawer for the full recent log
- use color-coded event types: damage, Cover, heal, status, reward

This gives feedback without permanently occupying a large panel.

### Map Screen Should Be Glyph-First

Spire Codex's `LiveMap` renders a route graph with quiet lines, compact nodes,
node-type glyphs, path highlighting, and an animated current-position ring. Bird
Squad's current route map uses large rectangular node cards with repeated text.

Recommended map changes:

- render route nodes as circles or compact markers, not text-heavy cards
- use one icon/glyph per node type
- highlight only selectable nodes and current node strongly
- dim completed and unavailable paths
- move node title, risk, reward preview, and lesson text into a side panel
- keep a small legend for node symbols
- animate only the current/selected node

Suggested map layout:

```text
┌──────────────────────────────────────────────────────────────────────┐
│ District title | Scrap | Route Marks | Deck | Back                   │
├──────────────────────────────────────────────┬───────────────────────┤
│                                              │ Selected node detail  │
│               route graph                    │ rewards / risk / tell │
│                                              │ Confirm / inspect     │
├──────────────────────────────────────────────┴───────────────────────┤
│ Last route note / current objective                                  │
└──────────────────────────────────────────────────────────────────────┘
```

This would make the map feel more like route planning and less like reading a
spreadsheet of nodes.

### Use Side Panels For Event And Market Detail

Spire Codex's live event and shop panels use compact sections, price chips,
sold/locked state, and hoverable item previews. Bird Squad's Market and future
Signal screens should adopt the same hierarchy.

Market pattern:

- left: vendor scene or route context
- right: categorized rows for Cards, Route Marks, Supplies, Services
- each row: small icon, name, price, sold/locked state
- hover/selected: detail preview
- show current Scrap once in the header

Signal pattern:

- prompt at top
- 2-3 choice rows
- locked choices visually muted
- chosen row highlighted
- rewards/costs shown as chips at the row end

This keeps non-combat screens consistent with the map's detail-panel model.

### Add A Shared Tooltip And Detail-Popover System

Spire Codex has reusable hover components for cards, relics, potions, and plain
text terms. Bird Squad should add a Phaser equivalent for:

- cards
- Route Marks
- Supplies
- Flock Stats
- statuses such as Winded, Molt, Open Sky, Open Sky Guard
- enemy intent badges
- route node symbols

Implementation detail:

```ts
interface TooltipModel {
  title: string;
  subtitle?: string;
  body: string;
  iconKey?: string;
  accent?: number;
}
```

The important design rule: UI text lives in tooltips and selected panels unless
the player needs it every second.

### Proposed Battle Cleanup Order

1. Move HUD resources into a single top ribbon.
2. Replace the large log panel with a toast plus log drawer.
3. Move Roost to the bottom-right near the hand.
4. Compact hand cards so only selected/hovered card shows full effect text.
5. Replace enemy intent text boxes with intent badges.
6. Convert Deck, Discard, Flock Stats, Supplies, and Route Marks into icon chips.
7. Add shared tooltip/detail popover helpers.
8. Rebalance battlefield art and spacing after the UI is lighter.

The first three steps should noticeably reduce clutter without changing game
rules.

## Suggested Implementation Roadmap

### Phase 1: Data Backbone

1. Add `alpha-encounters.json`.
2. Update route nodes to reference encounter IDs.
3. Extend validation for encounters and route payloads.
4. Add `moves` and `attackPattern` to enemies.
5. Implement `selectNextEnemyMove(enemyState, enemyRuntime)`.

Result: content scales beyond one-enemy cycles.

### Phase 2: Runtime Separation

1. Extract card display helpers.
2. Extract combat effect parsing and resolution.
3. Add unit-style tests for effect resolution.
4. Keep Phaser scenes focused on rendering and input.

Result: new cards and mechanics stop bloating `src/main.ts`.

### Phase 3: Player-Facing Clarity

1. Add structured intent tooltips.
2. Add rich text tokens for game terms.
3. Add route mark tooltip/detail display.
4. Add in-game Codex overlay.

Result: the game explains itself through UI, not paragraphs.

### Phase 4: Playtest Loop

1. Add `RunHistory`.
2. Add post-run summary.
3. Emit local playtest JSON artifacts.
4. Add runtime data diff tooling.
5. Add a debug battle launcher.

Result: faster iteration, stronger balance review, and better QA hooks.

### Phase 5: Content Expansion

1. Add Signal event data.
2. Add multi-enemy encounters.
3. Add Map 2 route content.
4. Add Route Mark families by suit.
5. Add local aggregate playtest summaries.

Result: Bird Squad grows from Alpha slice into a real roguelike structure.

## Patterns To Avoid

Avoid copying from Spire Codex:

- extracted Slay the Spire 2 card, monster, relic, event, or asset data
- public website infrastructure
- MongoDB/community account systems
- SEO, sitemap, and localization machinery
- FastAPI backend until Bird Squad actually needs remote services
- complex community scoring before local playtest data exists

Avoid overbuilding in Bird Squad:

- a backend for local-only content
- React UI for Phaser-only screens
- broad analytics before a stable run-history schema
- procedural route generation before authored maps prove the content model
- many enemy one-offs before enemy families and attack-pattern rules are solid

## Reference Files Reviewed

Spire Codex:

- `contributing/ARCHITECTURE.md`
- `contributing/DATA_GUIDE.md`
- `frontend/lib/api.ts`
- `backend/app/models/schemas.py`
- `frontend/app/components/RichDescription.tsx`
- `frontend/app/components/CardRender.tsx`
- `frontend/app/components/TinyCard.tsx`
- `frontend/app/components/SearchFilter.tsx`
- `frontend/app/runs/[hash]/RunSummary.tsx`
- `frontend/app/runs/[hash]/RunPills.tsx`
- `frontend/app/live/live-shared.tsx`
- `frontend/lib/card-display.ts`
- `backend/scripts/copy_images.py`
- `backend/app/routers/search.py`
- `backend/app/routers/merchant.py`
- `backend/app/services/community_stats.py`
- `backend/app/services/runs_db_mongo.py`
- `backend/app/services/run_entity_stats.py`
- `backend/app/services/beta_diff.py`
- `backend/app/parsers/character_parser.py`
- `markdown-docs/live-presence.md`
- `data/cards.json`
- `data/relics.json`
- `data/potions.json`
- `data/events.json`
- `data/encounters.json`
- `data/monsters.json`
- `data/characters.json`
- `data/keywords.json`
- `data/intents.json`
- `data/afflictions.json`
- `data/modifiers.json`
- `data/acts.json`
- `data/ascensions.json`
- `data/merchant_config.json`
- `data/guides/new-players-guide.md`
- `data/guides/understanding-encounters.md`
- `tools/diff_data.py`

Bird Squad:

- `src/main.ts`
- `src/game/types.ts`
- `src/game/runtime-data.ts`
- `data/game/alpha-cards.json`
- `data/game/alpha-enemies.json`
- `data/game/alpha-route-map.json`
- `tools/validate-runtime-data.mjs`
- `docs/game/core-gameplay-spec.md`
- `docs/game/run-design-spec.md`
- `docs/game/alpha-run-spec.md`

# Bird Squad Runtime Architecture

Status: current codebase map for implementation and documentation maintenance.

This note describes how the playable build is wired today. It is a companion to
the design specs, not a replacement for them:

- Game rules and player-facing terms: `docs/game/`
- Visual and art pipeline rules: `docs/art/`
- Runtime JSON contracts and validation: `data/game/`, `src/game/types.ts`,
  and `tools/validate-runtime-data.mjs`
- Phaser scene implementation: `src/main.ts`

## Current Snapshot

| Area | Current shape |
| --- | --- |
| Runtime framework | Phaser 4 through Vite. |
| Main scene file | `src/main.ts`, with helper modules under `src/game/`. |
| Districts | 4 playable maps: Rooftop Blocks, Canal Markets, Signal Spires, High Roost. |
| Runtime cards | 110 total: 100 playable cards plus 10 Snags. |
| Starter / reward cards | 10 starter cards, 90 reward-pool cards. |
| Enemies / encounters | 64 enemies, 80 encounters. Encounters can spawn up to 4 enemies. |
| Signals / Supplies / Waymarks | 38 Signals, 31 Supplies, 58 Waymarks. |
| Route maps | Authored district maps feed seeded generated maps per run. |
| Persistence | Active run, account unlocks, and run summaries use `localStorage`. |
| Test harness | `window.__birdSquadState()` and `render_game_to_text()` drive Playwright smoke tests. |

## Code And Data Flow

```mermaid
flowchart LR
  subgraph Data["Authored data"]
    Cards["data/game/alpha-cards.json"]
    Map1["data/game/alpha-route-map.json"]
    Maps["data/game/map02-content.json<br/>map03-content.json<br/>map04-content.json"]
    Economy["alpha-market / supplies / signals<br/>basins / nests / cache"]
    ArtManifests["assets/runtime/**/manifest.json"]
  end

  subgraph RuntimeModules["src/game modules"]
    Types["types.ts"]
    RuntimeData["runtime-data.ts"]
    RouteGen["route-gen.ts"]
    CardEffects["effects/card-effect-runner.ts"]
    RouteEffects["effects/route-effect-runner.ts"]
    Images["runtime-images.ts"]
    Meta["meta.ts / leaders.ts"]
  end

  subgraph Phaser["src/main.ts Phaser scenes"]
    Menu["MenuScene / ProfileScene"]
    Codex["CodexScene"]
    Route["RouteScene"]
    Battle["BattleScene"]
  end

  Cards --> RuntimeData
  Map1 --> RuntimeData
  Maps --> RuntimeData
  Economy --> RuntimeData
  ArtManifests --> RuntimeData
  Types --> RuntimeData
  RuntimeData --> RouteGen
  RuntimeData --> Route
  RuntimeData --> Battle
  RouteGen --> Route
  RouteEffects --> Route
  CardEffects --> Battle
  Images --> Route
  Images --> Battle
  Images --> Codex
  Meta --> Menu
  Meta --> Battle
```

The important boundary is that JSON data names the cards, encounters, route
payloads, items, and art targets. The scene code resolves those names through
typed maps in `runtime-data.ts`, then delegates effect strings to small
interpreters instead of hardcoding most card or route outcomes directly.

## Scene Lifecycle

```mermaid
stateDiagram-v2
  [*] --> BootScene
  BootScene --> MenuScene
  MenuScene --> ProfileScene: profile / leader view
  ProfileScene --> MenuScene
  MenuScene --> CodexScene: codex
  CodexScene --> MenuScene
  MenuScene --> RouteScene: new or continued run
  RouteScene --> BattleScene: street / rival / boss node
  BattleScene --> RouteScene: combat victory and rewards resolved
  BattleScene --> MenuScene: defeat or run complete
  RouteScene --> RouteScene: basin / nest / cache / signal / market
  RouteScene --> MenuScene: abandon / back to menu
```

`RouteScene` owns path choice, non-combat node resolution, Market shelves,
Waymark/Supply drawers, card reward/preen/release pickers, and active-run
checkpoints. `BattleScene` owns combat state, hand/draw/discard zones, enemy
Tells, Supplies used in combat, Waymark combat triggers, rewards after victory,
and run-summary emission.

## Run Lifecycle

```mermaid
sequenceDiagram
  participant Player
  participant Menu as MenuScene
  participant Route as RouteScene
  participant Gen as generateRouteMap
  participant Battle as BattleScene
  participant Effects as Effect runners
  participant Store as localStorage

  Player->>Menu: Start run
  Menu->>Route: createInitialRunState()
  Route->>Gen: seed + district blueprint
  Gen-->>Route: generated RuntimeRouteMap
  Route->>Store: persist active run checkpoint
  Player->>Route: choose reachable node
  alt combat node
    Route->>Battle: routeNodeId + RunState
    Battle->>Effects: resolve card / enemy / Waymark effects
    Battle-->>Route: updated RunState after victory
    Route->>Store: persist active run checkpoint
  else non-combat node
    Route->>Effects: resolve route effects
    Route->>Store: persist active run checkpoint
  end
  Route-->>Player: next route preview or run ending
```

## Effect Resolution

```mermaid
flowchart TB
  EffectText["effect string<br/>example: damage(target, 5)"]
  Parser["effect-parser.ts<br/>parseEffect / parseEffectValue"]
  CardRunner["card-effect-runner.ts<br/>combat card verbs"]
  RouteRunner["route-effect-runner.ts<br/>route verbs"]
  MainContext["src/main.ts context callbacks"]
  CombatState["Battle state<br/>flock, enemies, zones, logs"]
  RunState["RunState<br/>scrap, deck, supplies, Waymarks"]
  Validator["tools/validate-runtime-data.mjs"]

  Validator -. "closed verb and condition allowlists" .-> EffectText
  EffectText --> Parser
  Parser --> CardRunner
  Parser --> RouteRunner
  CardRunner --> MainContext
  RouteRunner --> MainContext
  MainContext --> CombatState
  MainContext --> RunState
```

Card effects and route effects intentionally share the same simple expression
shape, but they do not share the same verb set. `validate-runtime-data.mjs`
mirrors the runtime interpreters so a typo or unsupported verb fails validation
instead of silently doing nothing in game.

Current card-effect extensions beyond the original foundation set include
`damagePierce`, `removeCover`, `resonanceBurst`, `windedBurst`, `overhealCover`,
`loseCohesion`, `damageFlock`, `retainHand`, `gainEnergyNextTurn`,
`enemyNextAttackBonus`, `enemyGainCover`, `shuffleSelfToDraw`, and `exhaustSelf`.
Cards can also define `heldEffects`, `moltEffects`, and upgraded
`upgrade.moltEffects`.

## Route Generation

```mermaid
flowchart TD
  AuthoredMap["Authored district map<br/>routeMap"]
  Libraries["Encounter and Signal libraries"]
  Blueprint["runtime-data.ts<br/>blueprintFromMap()"]
  Balance["data/game/balance-config.json"]
  Seed["run seed + map index"]
  Generated["generateRouteMap()"]
  Repairs["path-rule repair pass<br/>safety, build, pressure"]
  SceneMap["RouteScene current map"]

  AuthoredMap --> Blueprint
  Libraries --> Blueprint
  Balance --> Generated
  Seed --> Generated
  Blueprint --> Generated
  Generated --> Repairs
  Repairs --> SceneMap
```

The authored maps are still useful content sources: they provide district IDs,
entry and boss payloads, and pools of combat/non-combat payloads. At runtime,
the generated map uses those pools plus `balance-config.json` to produce a
seeded graph with controlled pacing beats, non-combat relief, and boss access.

## Validation And Build Gates

```mermaid
flowchart LR
  Docs["Docs and prompt packs"] --> DocsCheck["npm run validate:docs"]
  Data["Runtime JSON and manifests"] --> RuntimeCheck["npm run validate:runtime"]
  Art["Runtime image assets"] --> AssetCheck["npm run validate:runtime-assets"]
  Build["Vite production build"] --> BundleCheck["npm run validate:bundle-size"]
  Build --> CacheCheck["npm run validate:deployment-cache"]
  RuntimeCheck --> Validate["npm run validate"]
  AssetCheck --> Validate
  DocsCheck --> Validate
  BundleCheck --> Validate
  CacheCheck --> Validate
```

Use `npm run validate` after changes to cards, runtime data, art manifests,
effect syntax, route systems, or mechanics docs. Use `npm run build` when code or
asset loading changes, because the production split and deployment-cache
contract are part of the shipped runtime.

## Maintenance Notes

- `src/main.ts` remains the largest maintenance risk. Prefer moving new generic
  logic into `src/game/` modules when it has a clear data or rules boundary.
- `data/game/alpha-cards.json` is now a broader runtime card file despite the
  historical `alpha` name. It includes the starter deck, reward pool, Legends,
  Crew, Aviary cards, the Molt signature card, and Snags.
- The player-facing term is `Waymarks`; the runtime field remains `routeMarks`
  for compatibility with existing save/run code.
- Snags are runtime-only cards. They are exempt from the tarot arcana source
  cross-check and do not need individual card art manifest entries.
- `CodexScene` lazy-loads extended codex data. Do not eagerly import that data
  into boot paths unless bundle budgets are intentionally revisited.
- Generated/source art belongs under `.generated/`; optimized runtime assets
  belong under `assets/runtime/` and should be referenced through manifests or
  Vite-managed imports.

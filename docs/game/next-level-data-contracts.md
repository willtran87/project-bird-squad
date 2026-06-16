# Bird Squad Next-Level Data Contracts

Version: 0.1

Status: blocker-resolution spec. Resolves the open design contracts that gate
`docs/game/next-level-implementation-spec.md` Phases 3-6 so the data-backbone
work becomes transcription rather than invention.

Related sources:

- `docs/game/next-level-implementation-spec.md` — the roadmap this unblocks.
- `docs/game/core-gameplay-spec.md` §Effect Syntax — the canonical combat verb
  grammar this extends (do not duplicate; extend).
- `docs/game/run-design-spec.md` — owns Route Marks, Supplies, Signals, Snags.
- `docs/game/alpha-run-spec.md` — the authored Map 1 content these files encode.
- `data/game/alpha-enemies.json` — source for enemy moves and reward profiles.
- `tools/validate-runtime-data.mjs` — the validator these contracts extend.

## How To Read This

Each section below is written to **graduate into an owning canonical spec** once
accepted (per `docs/README.md` promotion guidance). Sections 1-2 graduate into
`core-gameplay-spec.md`; sections 3-7 graduate into `run-design-spec.md`;
section 8 graduates into the implementation spec's validation plan. Until then,
this file is authoritative for the values below.

Severity tags map to the readiness audit: **[BLOCKER]** items gated Phase 3+;
**[DECISION]** items had no canonical answer; **[MICRO]** items are First-Slice
defaults.

---

## 1. Enemy Effect DSL (graduates into core-gameplay-spec §Effect Syntax) — [BLOCKER #1]

The enemy-side verbs already appear in `alpha-enemies.json` and already pass the
validator's `effectPattern` regex (`tools/validate-runtime-data.mjs:50`). They
were never documented. This section formalizes the de-facto grammar and closes
the AttackPattern condition gap.

### 1.1 The `flock` target token

Enemy effects use `flock` as the target token for effects applied to the player
Flock. Defensive/self verbs in an enemy move resolve on the **acting enemy**
(no token needed). This mirrors the player side where `self` = the Flock.

### 1.2 Enemy effect verbs

All verbs below are already in use except where marked *new*. They reuse the
combat resolver formula order in core-gameplay-spec §Effect Syntax.

| Expression | Owner | Meaning |
| --- | --- | --- |
| `damage(flock, N)` | Flock | Deal N damage to the Flock (reduced by Flock Cover, increased by Open Sky). |
| `applyWinded(flock, N)` | Flock | Apply N Winded to the Flock (reduces Flock attack output). |
| `applyOpenSky(N)` | Flock | Flock gains N Open Sky (increases incoming damage; reduced by Open Sky Guard). |
| `addSnagToDiscard(cardId)` | Flock | Insert the named Snag card into the Flock discard pile. |
| `addSnagToDraw(cardId)` | Flock | *new* Insert the named Snag card into the Flock draw pile. |
| `gainCover(N)` | Enemy | Acting enemy gains N Cover (reduces player damage to it). |
| `heal(N)` | Enemy | Acting enemy restores N health, clamped at max health. |
| `nextAttackBonus(N)` | Enemy | Acting enemy's next damaging move deals +N. |

`cardId` arguments must reference a Snag card id present in
`data/game/alpha-cards.json`.

### 1.3 Enemy / pattern conditions

`if CONDITION then EFFECT` reuses the player condition syntax. Enemy moves and
`AttackPattern` selection share this closed condition set:

| Condition | Meaning |
| --- | --- |
| `notHitThisTurn` | The acting enemy took no damage during the player's preceding turn. |
| `flockHasNoCover` | The Flock has 0 Cover when the effect resolves. |
| `isMolting` | The Flock is currently Molting. |
| `flockOpenSky` | The Flock currently has Open Sky. |
| `flockCohesionBelowHalf` | Flock Cohesion is below half its maximum. |
| `selfBelowHalf` | The acting enemy is below half its max health. |
| `turn >= N` | The current combat turn index is at least N (1-based). |

`turn >= N` is the only comparison form; `N` is a positive integer. No other
operators are permitted, keeping the validator regex simple. The validator regex
must be widened to accept this form (§8.3) — it does **not** parse today.

**Route conditions** (`branch on route conditions`, implementation spec Phase 3
Enemy Moves) are intentionally out of scope for Alpha: §1.3 covers Flock state
and enemy HP (`selfBelowHalf`), and `turn >= N` is combat-local. The same `if`
mechanism is forward-compatible with route-condition tokens
(e.g. `flockHasRouteMark(id)`, `mapIndex >= N`) added when a later map needs
them. Until then the acceptance criterion is met as "can branch on Flock state
and enemy HP now; route-condition branching is a forward-compatible extension."

---

## 2. Enemy Moves + AttackPattern + Intent Badges (graduates into core-gameplay-spec) — [BLOCKER #1 / DECISION]

### 2.1 Move and pattern schema

Replaces the flat `intentPattern: EnemyIntent[]`. Keep `intentPattern` readable
during migration (dual-read), then remove.

```ts
interface StatusApplication {     // structured buff/debuff (spire-codex powers[] pattern)
  status: string;                 // id from the status registry (§5.5 / alpha-statuses.json)
  target: 'self' | 'flock';       // 'self' = acting enemy, 'flock' = player Flock
  amount: number;
}

interface EnemyMove {
  id: string;
  label: string;                  // player-facing, e.g. "Heavy Strike 13"
  effects: string[];              // §1 expressions: damage(flock,N) + bespoke long-tail verbs
  powers?: StatusApplication[];   // PREFERRED for status applications (Winded/Open Sky/...); see §2.2
  tags: string[];                 // from the move tag set (§5.2)
}

// Per-entry selection constraint (spire-codex repeat / use-once pattern)
type PatternEntry = { moveId: string; weight?: number; repeat?: 'cannotRepeat' | 'oncePerCombat' };

type AttackPattern =
  | { type: 'cycle'; moveIds: string[] }
  | { type: 'weighted'; entries: PatternEntry[] }
  | { type: 'conditional'; entries: Array<{ moveId: string; if: string }>; fallback: string }
  | { type: 'scripted'; moveIds: string[]; loopFrom?: number };
```

Two spire-codex-validated refinements (provenance §13):

- **`powers[]`** is the structured form of the common "apply N of status X to
  self/flock" case. Only `EnemyMove.powers` ships in Alpha. The same
  `StatusApplication` shape is designed to be **reused later** by a player-card
  field (a future `RuntimeCard.powers_applied?`) and a future enemy
  `combatStartPowers[]` (where §6.3's `enemyCoverNextCombat` would land) — these
  are forward-compatible extensions, not Alpha fields, and are not yet in
  `types.ts`. Keep `effects:string[]` only for damage and the bespoke long tail
  (`addSnagToDraw`, `nextAttackBonus`, enemy `gainCover`/`heal`). During migration,
  existing `applyWinded`/`applyOpenSky` strings may stay (dual-read) or move to
  `powers[]`.
- **`repeat`** on a weighted entry encodes "never twice in a row"
  (`cannotRepeat`) or "once per combat" (`oncePerCombat`) as data, not as resolver
  special-cases — the clean place for boss-variety constraints. Omitting `repeat`
  means no constraint (the move may repeat in any adjacent turn).

`intent: IntentBadgeView[]` is **derived at render time** from `effects` (§2.2),
not authored per move. This removes the audit's "every move needs an authored
IntentBadgeView" gap — moves only carry effects + tags.

This `EnemyMove` **supersedes** the implementation spec's Phase-3 `EnemyMove`,
which carried a required authored `intent: IntentBadgeView[]`. That field is
dropped here and derived per §2.2; transcribers should use this shape, not the
roadmap's.

### 2.2 Effects → IntentBadge derivation (deterministic)

The renderer derives badges from a move's `effects` **and** `powers[]`, with no
string parsing for the status case:

1. If `effects` has `damage(flock, N)` → one `attack` badge, `value` = summed N.
2. If `powers[]` has a `debuff`-kind status (or, pre-migration, `effects` still
   carries `applyWinded`/`applyOpenSky`/`addSnag*`) → one `debuff` badge.
3. If `effects` has `gainCover(N)` (enemy) and there is no damage → one `block` badge, `value` = N.
4. If `effects` has `nextAttackBonus`/another enemy self-buff (or `powers[]` has a `buff`-kind status) and no damage/cover → one `special` badge.
5. A move may emit **multiple** badges (e.g. attack + debuff for Tar Toss).

A status's `kind` (buff/debuff) comes from the §5.5 registry, so steps 2/4 are a
table lookup, not a hardcoded verb list.

```ts
interface IntentBadgeView {
  icon: 'attack' | 'block' | 'debuff' | 'special';
  value?: number;
  danger: 'low' | 'medium' | 'high';
  shortLabel: string;   // e.g. "13", "Cover 8", "Winded"
  detail: string;       // hover text, from move.label + effect prose
}
```

### 2.3 Danger thresholds — [MICRO] (also fixes First-Slice step 5)

Danger is a function of the badge's effective damage value:

| Damage value `N` | danger |
| --- | --- |
| `N <= 6` | low |
| `7 <= N <= 10` | medium |
| `N >= 11` | high |

Non-attack badges (`block`/`debuff`/`special`) are `low` unless a future move
flags otherwise. This makes Strike 6 = low, Crowbar Tap 8 = medium, Heavy Strike
11/12/13 = high, matching the authored Tells and the "respect Heavy Strike"
lesson. Thresholds are absolute for Alpha; a later pass may scale them to current
Cohesion.

### 2.4 Authored AttackPattern per Alpha enemy

| Enemy | Pattern | Notes |
| --- | --- | --- |
| `roof_rat` | `{ type: 'cycle', moveIds: ['strike_6_a','strike_6_b','scurry_cover'] }` | array order preserved |
| `signal_gull` | `{ type: 'cycle', moveIds: ['peck_5','scavenge_heal','brace_6'] }` | `scavenge_heal` keeps its `if notHitThisTurn then heal(4)` |
| `wire_hawk` | `{ type: 'cycle', moveIds: ['watch_winded','heavy_strike_11','strike_7'] }` | |
| `tarline_jackdaw` | `{ type: 'cycle', moveIds: ['harass_6','brace_8','heavy_strike_12'] }` | |
| `tar_crowned_crow` | `{ type: 'scripted', moveIds: ['toll_line','crowbar_tap','tar_toss','chokepoint_call','heavy_strike'], loopFrom: 1 }` | matches alpha-run-spec boss "6+ repeat from turn 2" |

Move ids and effects are unchanged from `alpha-enemies.json`; only the wrapper
(`moves` + `attackPattern`) is new.

---

## 3. Reward Profiles (new file: `data/game/alpha-reward-profiles.json`) — [BLOCKER #2]

`rewardProfileId` referenced by every encounter had no schema or file. The
profile **values already exist inline** on enemies; this extracts the three
distinct profiles in use. The schema is the existing inline `rewards` block shape
(today untyped JSON on each enemy record), now named and keyed by id.

```ts
interface RewardProfile {
  id: string;
  scrap?: [number, number] | number;
  cardReward?: boolean;
  preenChance?: number;
  routeMarkChance?: number;
  preenGuaranteed?: boolean;
  routeMarkGuaranteed?: boolean;
  bossRouteMarkChoices?: number;
  rareCardChoices?: number;
  preen?: number;
  unlocks?: string;
}
```

Transcription-ready content:

| Profile id | Values (verbatim from alpha-enemies.json) |
| --- | --- |
| `street_standard` | `{ scrap: [25,40], cardReward: true, preenChance: 0.25, routeMarkChance: 0.15 }` |
| `rival_standard` | `{ scrap: [70,90], cardReward: true, preenGuaranteed: true, routeMarkGuaranteed: true }` |
| `boss_alpha` | `{ scrap: 120, bossRouteMarkChoices: 3, rareCardChoices: 3, preen: 1, unlocks: "map_02_canal_markets" }` |

Migration: delete the inline `rewards` block from each enemy record; the
encounter (§4) references the profile id. `rewardScrap`/`scrap` duplication on
the boss collapses into `boss_alpha`.

---

## 4. Encounters (new file: `data/game/alpha-encounters.json`) — [BLOCKER / DECISION]

`RuntimeEncounter` per implementation spec Phase 3. Bands and tags were
undefined; assigned below. `mapId` is `map_01_rooftop_blocks` for all Alpha
encounters. `enemies` is 1:1 with existing enemies (no multi-enemy fights in
Alpha). `lesson` is verbatim from the enemy records.

| Encounter id | nodeType | band | enemies | tags | rewardProfileId |
| --- | --- | --- | --- | --- | --- |
| `enc_roof_rat` | street | weak | `['roof_rat']` | `['cover','basic']` | `street_standard` |
| `enc_signal_gull` | street | standard | `['signal_gull']` | `['scavenge','cover']` | `street_standard` |
| `enc_wire_hawk` | street | pressure | `['wire_hawk']` | `['heavy','winded','openSky']` | `street_standard` |
| `enc_tarline_jackdaw` | rival | rival | `['tarline_jackdaw']` | `['heavy','winded','elite']` | `rival_standard` |
| `enc_tar_crowned_crow` | boss | boss | `['tar_crowned_crow']` | `['boss','cover','snag','openSky']` | `boss_alpha` |

`introText`/`victoryText`/`lossText` are optional and may stay empty for Alpha.

Route-map migration (implementation spec migration step 2): change combat node
`payloadId` from enemy id to encounter id (`roof_rat` → `enc_roof_rat`,
`tar_crowned_crow` → `enc_tar_crowned_crow`, etc.). See §8 for the validator
change this requires.

---

## 5. Closed Vocabularies — [DECISION]

### 5.1 Encounter bands

`weak | standard | pressure | rival | boss`. Band assignment for the three Alpha
normals is by health + Tell pressure: `roof_rat` (HP20, basic) = weak,
`signal_gull` (HP24) = standard, `wire_hawk` (HP28, Heavy Strike + Winded +
Open Sky) = pressure. This is the canonical mapping; the implementation spec's
EncounterBand and the study's bands are hereby promoted with these assignments.

### 5.2 Tag vocabulary (encounters and moves)

Closed set: `basic | cover | scavenge | heavy | winded | openSky | snag | elite | boss | tempo | molt`.
The validator rejects tags outside this set. Extend the set here, not ad hoc.

### 5.3 Route Mark families

`safety | economy | route | suit | molt | bossPrep`. Family is a **UI grouping
and boss-prep hint**, not a rules construct. Mapping for the 10 Alpha Route
Marks (§6).

### 5.4 Supply answer types

`coverNow | drawNow | wingbeatNow | healNow | openSkySafety | tellControl`.
`tellControl` is reserved (no Alpha Supply uses it). Mapping in §7.

### 5.5 Status registry (new file: `data/game/alpha-statuses.json`) — spire-codex `{kind, stack}`

Every transient status is declared once as `{ id, kind, stack }` — spire-codex's
two-axis type × stack model (minus its unused negative-clamp axis):

```ts
type StatusKind  = 'buff' | 'debuff';
type StatusStack = 'counter' | 'flag';   // counter = numeric magnitude; flag = on/off

interface RuntimeStatus { id: string; kind: StatusKind; stack: StatusStack; }
```

Alpha registry (register **only** shipped statuses — no parked or StS-style
keywords; core-gameplay-spec forbids parked mechanics):

| id | kind | stack | notes |
| --- | --- | --- | --- |
| `winded` | debuff | counter | on Flock; reduces attack output; ticks down |
| `openSky` | debuff | counter | on Flock; increases incoming damage |
| `openSkyGuard` | buff | counter | on Flock; each point cancels one Open Sky increase |
| `molt` | buff | flag | on Flock; ends after the next non-Molt card |

(`nextAttackBonus` stays a bespoke enemy verb in §1.2, **not** a registry status —
it is a one-shot enemy self-modifier with no tick/stack lifecycle, so it does not
belong in the status table. The registry holds only statuses with real
duration/stacking rules.)

**Verb → status id** (so the registry resolves the §1.2/§6.3 verbs):
`applyWinded`→`winded`, `applyOpenSky`→`openSky`, `gainOpenSkyGuard`→`openSkyGuard`,
`enterMolt`→`molt`. A `powers[]` entry names the registry id directly.

This registry id set is the **status allowlist**: every `StatusApplication.status`
(§2.1 `powers[]`), every status produced by a verb (per the mapping above), and
every status in the core-gameplay-spec Timing-And-Status-Rules table must resolve
to a registry id.
The `kind`/`stack` descriptor also lets `main.ts`'s per-status switch arms
(~2065–2290) collapse into one table-driven `applyStatus`/`tickStatuses` routine.

---

## 6. Route Marks (data) + Route Effect Grammar (graduates into run-design-spec) — [BLOCKER #3]

### 6.1 Route Mark trigger/effect model

`RuntimeRouteMark` per implementation spec, with `trigger` from a closed event
set and `effect` from the route-effect verb set (§6.3). Passive market modifiers
use the `passive` trigger and are realized by `MarketService.discountRouteMarkIds`
(§9), not by an event.

Trigger event vocabulary:

| Trigger | Fires when |
| --- | --- |
| `combatStart` | At the start of each combat (optionally gated by `if turn >= N`). |
| `afterStreetEncounter` | After a Street Encounter resolves. |
| `onNthCardThisTurn(N)` | The Nth card played in a turn (once per combat). |
| `firstOpenSkyIncrease` | The first Open Sky damage increase each combat. |
| `basinHeal` | When a Basin heal resolves. |
| `signalResolved` | When a Signal choice resolves. |
| `firstImproveThisRun` | The first card improved in a run. |
| `mapStart` | At the start of each map. |
| `passive` | Always active; handled by another system (e.g. Market pricing). |

### 6.2 Transcription-ready mapping (10 Alpha Route Marks)

| id | family | rarity | source | trigger | effect |
| --- | --- | --- | --- | --- | --- |
| `chalk_wingmark` | safety | common | street/cache | `combatStart` | `gainCover(2)` |
| `rooftop_shortcut` | route | common | signal/cache | `onNthCardThisTurn(3)` | `draw(1)` |
| `patched_harness` | economy | uncommon | market | `passive` | `reducePreenPrice(30)` |
| `quiet_landing` | molt | uncommon | rival | `firstOpenSkyIncrease` | `reduceOpenSky(1)` |
| `loose_change_tin` | economy | common | market/cache | `afterStreetEncounter` | `gainScrap(15)` |
| `rain_gutter` | safety | common | market/cache | `basinHeal` | `addHeal(4)` |
| `wire_map` | economy | uncommon | market/cache | `signalResolved` | `gainScrap(25)` |
| `feather_tape` | suit | uncommon | nest | `firstImproveThisRun` | `addBonusStat(cohesion, 1)` |
| `crowbar_debt` | bossPrep | boss | boss | `combatStart` | `gainWingbeat(1)` |
| `reopened_roofline` | bossPrep | boss | boss | `mapStart` | `gainSupplyChoice(1)` |

(`crowbar_debt` grants the Wingbeat once at combat start, i.e. on turn 1 only;
`combatStart` already fires exactly once per combat, so no turn gate is needed.)

A trigger MAY carry an optional `if turn >= N` gate (e.g. `combatStart if turn >= 2`)
for future Route Marks; it is validated separately from the trigger enum (§8.2)
and is not used by any Alpha Route Mark.

### 6.3 Route effect verb set (immediate route effects)

Used by Signal outcomes, Cache/Basin/Nest options, Route Mark effects, and
route-timed Supplies. Validated by name allowlist (§8).

| Expression | Meaning |
| --- | --- |
| `gainScrap(N)` / `payScrap(N)` | Add / spend Scrap. |
| `loseCohesion(N)` / `healCohesion(N)` | Lose / restore Cohesion (route timing). |
| `healMissingPct(P, min)` | Heal P% of missing Cohesion, at least `min` (Basin Recover). |
| `gainRouteMark(idOrSelector)` | Grant a Route Mark; selector: an id, `random`, `randomCommon`, `randomNonBoss`, or `choice`. |
| `gainSupply(selector)` | Grant a Supply; selector: an id, `random`, or `choice`. |
| `gainSupplyChoice(N)` | Offer a choice of N Supplies. |
| `addSnagToDiscard(id)` / `addSnagToDraw(id)` | Insert a Snag card. |
| `revealNodes(N)` | Reveal the next N route nodes. |
| `skipNextStreet()` | Skip the next non-boss Street Encounter. |
| `removeRouteChoice()` | Remove one available route choice. |
| `gainCacheReward()` | Resolve a Rooftop Cache reward (§ alpha-cache options). |
| `addCard(selector)` | Add a card; selector: `randomCommon`, `randomCommonPlumesOrQuills`, or `chooseOneOfTwoCommon`. |
| `releaseCard(N)` | Remove N non-required cards (Nest Release). |
| `preenCard(N)` | Offer to improve N owned, unimproved cards. |
| `gainOpenSkyGuard(N)` | Gain N Open Sky Guard for the next combat. |
| `reduceNextOpenSky(N)` | Reduce the next Open Sky increase by N. |
| `enemyCoverNextCombat(N)` | Next combat begins with enemy Cover +N. |
| `startNextCombatOpenSky()` | The Flock starts the next combat with Open Sky. |
| `gainCover(N)` / `gainResonance(N)` / `gainWingbeat(N)` / `draw(N)` / `heal(N)` | Reused combat verbs for combat-timed Supplies. |

Resolver-side helper effects used only inside Route Mark `effect` (not authored
elsewhere): `reducePreenPrice(N)`, `reduceOpenSky(N)`, `addHeal(N)`,
`addBonusStat(stat, N)`. These are listed in the verb allowlist (§8.3). The
`stat` argument of `addBonusStat` is drawn from the closed Flock Stat key set
(the validator's existing `validStatKeys`, `tools/validate-runtime-data.mjs:35`):
`cohesion | damage | cover | regen | draw | resonance | moltPower | openSkyGuard`.

---

## 7. Supplies, Signals, Snags, Node Options (data) — [DECISION / authoring]

### 7.1 Supplies (new file: `data/game/alpha-supplies.json`)

`RuntimeSupply` per implementation spec. answerType/rarity derived; effects use
§6.3 verbs.

| id | category | rarity | answerType | timing | effects |
| --- | --- | --- | --- | --- | --- |
| `seed_packet` | snack | common | healNow | either | `['healCohesion(6)']` |
| `signal_flare` | flare | common | drawNow | combat | `['gainResonance(2)','draw(1)']` |
| `zip_tie_roll` | tool | common | coverNow | combat | `['gainCover(10)']` |
| `emergency_call` | call | uncommon | wingbeatNow | combat | `['gainWingbeat(1)','draw(1)']` |
| `shade_cloth` | tool | uncommon | openSkySafety | either | `['reduceNextOpenSky(2)']` |

### 7.2 Signals (new file: `data/game/alpha-signals.json`)

`RuntimeSignal`/`SignalChoice` per implementation spec. All 5 authored Signals
are encoded; choice `outcomes` use §6.3 verbs. Choice order is preserved (the
authoring order is canonical). Example (Faded Chalk Line):

```json
{
  "id": "faded_chalk_line",
  "title": "Faded Chalk Line",
  "mapId": "map_01_rooftop_blocks",
  "prompt": "An old route mark is still visible under rain grime...",
  "choices": [
    { "key": "repaint", "text": "Repaint the mark.", "outcomes": ["loseCohesion(4)", "gainRouteMark(chalk_wingmark)"] },
    { "key": "scout",   "text": "Send a fast scout.", "outcomes": ["gainScrap(45)", "addSnagToDiscard(bad_directions)"] },
    { "key": "move",    "text": "Keep moving.", "outcomes": ["revealNodes(2)"] }
  ]
}
```

The remaining four (`loose_wire_perch`, `rain_barrel_watch`, `rooftop_courier`,
`blackout_sign`) encode identically from alpha-run-spec §Signals.

**Choice preconditions (closed predicate grammar — spire-codex `IsAllowed`).**
`SignalChoice.requirements` and `cost` stay authoring-friendly `string[]`, but
every string must parse to a closed, typed predicate (mirroring the §6.3
effect-verb allowlist):

| Predicate | True when |
| --- | --- |
| `scrapAtLeast(N)` | Flock has ≥ N Scrap (gates pay-Scrap choices). |
| `cohesionAtLeast(N)` / `cohesionBelowPct(P)` | Cohesion ≥ N / below P% of max. |
| `hasRouteMark(id)` | Run owns the named Route Mark. |
| `hasSupplySlot()` | A Supply slot is free. |
| `deckHasTag(tag, N)` | Deck holds ≥ N cards of that suit/tag. |
| `mapIndexAtLeast(N)` | Current map index ≥ N. |
| `not(PREDICATE)` | Negation — one predicate serves both "requires X" (locks/greys the choice with `lockedText`) and "hidden when X". |

A choice with an unmet requirement renders muted with its `lockedText` (per the
implementation spec). The validator parses-and-allowlists each predicate exactly
like effect verbs (§8.3), so a typo'd or invented requirement fails loudly
instead of silently never-triggering.

**[DECISION — wiring]** The route map currently places only `faded_chalk_line`
and `loose_wire_perch`. Resolution: author all 5 in the data file; the two
Signal nodes draw from the unplaced pool at run start (deterministic by seed) so
all 5 are reachable across runs. No new nodes required.

**[DECISION — Rain Barrel Key]** `rain_barrel_watch` → "Mark it for later" grants
`Rain Barrel Key`, which is absent from the 10-mark table. Resolution: redirect
that single outcome to `gainSupplyChoice(1)` (thematically a refill) to avoid an
11th mark. If an 11th mark is later desired, add `rain_barrel_key` (family
`route`, trigger `passive`) — but Alpha ships the redirect.

### 7.3 Snags + CardPressure — [BLOCKER — Snags must be authored]

Correction: the 3 Snags do **not** exist yet. `alpha-cards.json` contains zero
`kind: 'snag'` cards (kinds present: crew ×32, legend ×1, molt ×1), and
`tangled_line`/`wet_feathers`/`bad_directions` appear nowhere — the boss move
`addSnagToDiscard(tangled_line)` is a **dangling reference today**. So the
validator's "Snag card ids exist OR card-pressure ids unique" rule is currently
**unsatisfied**.

Resolution: author the 3 Snags as `kind: 'snag'` cards in `alpha-cards.json`,
each with `displayName`, `bird`, `cost` (or unplayable marker), `target`, `tags`,
`effects`, `upgrade`, and `flockStats: {}` (Snags grant no beneficial stats).
Two validator implications must be handled in §8:

- the existing rule that every alpha card id exists in arcana source data must be
  **relaxed for `kind: 'snag'`** (Snags have no tarot origin), and
- Snags need no `card-art-manifest` portrait, or a placeholder entry.

`data/game/alpha-snags.json` is therefore **not** created (Snags live in the card
set, like any deck card). The `CardPressure` overlay layer is defined as a
forward schema but ships **zero instances in Alpha**, so the card-pressure half
of the validator rule is vacuously satisfied. Authoring the 3 snag cards (above)
satisfies the snag half and clears the boss's dangling reference.

### 7.4 Basin / Nest / Cache (new files) — [DECISION — absent from spec file list]

The implementation spec's Phase-3 file list omits these, but the route map
references `basin_alpha`, `nest_alpha`, `alpha_rooftop_cache`. Resolution: add
three small option files, each an array of `{ id, label, effects[], cost? }`
using §6.3 verbs:

- `data/game/alpha-basins.json` — Recover (`healMissingPct(35, 6)`), Take Shelter (`gainOpenSkyGuard(1)`, `healCohesion(4)`), Refill Supplies (`gainSupplyChoice(1)`).
- `data/game/alpha-nests.json` — Preen (`preenCard(1)`), Release (`payScrap(50)`, `releaseCard(1)`), Reinforce Gear (`payScrap(90)`, `gainRouteMark(randomNonBoss)`).
- `data/game/alpha-cache.json` — choose 1 of: `gainScrap(50)`, `gainSupplyChoice(1)`, `gainRouteMark(randomCommon)`, `addCard(chooseOneOfTwoCommon)`, `healCohesion(5)`.

(`releaseCard(N)` is a verb, now in the §6.3 verb set and the §8.3 verb
allowlist. `chooseOneOfTwoCommon` is a **selector argument** to `addCard`, not a
verb — it is documented under §6.3's `addCard(selector)` row and is validated as
a selector, not added to the verb-name allowlist.)

---

## 8. Validator Migration (extends tools/validate-runtime-data.mjs) — [BLOCKER / code]

### 8.1 Redirect the payloadId check (the migration-breaking one)

Today `validate-runtime-data.mjs:230` requires street/rival/boss `payloadId` to
exist in `alpha-enemies.json`. After §4, route nodes carry **encounter** ids.
Change the check to:

- combat node `payloadId` resolves to an encounter id in `alpha-encounters.json`;
- non-combat node `payloadId` resolves to the matching file by type:
  `basin` → alpha-basins, `nest` → alpha-nests, `market` → alpha-market,
  `signal` → alpha-signals, `cache` → alpha-cache.

This also eliminates the currently-unchecked orphan payloads. (Confirmed: the
current check at line 230 is `['street','rival','boss'].includes(node.type) &&
!enemiesByPayload.has(node.payloadId)`; non-combat payloads are only checked for
presence, never resolved against a file.)

Two card-validator changes also land here (driven by §7.3):

- relax the "every alpha card id exists in arcana source data" rule to **skip
  `kind: 'snag'` cards**, and
- add a **snag-existence check**: every `addSnagToDiscard(id)`/`addSnagToDraw(id)`
  argument (in enemy effects, signals, route effects) must resolve to a
  `kind: 'snag'` card id. This is currently failing silently for the boss's
  `addSnagToDiscard(tangled_line)` and cannot pass until the snags are authored.

### 8.2 New per-file validation blocks (additive, same single-file pattern)

| File | Checks |
| --- | --- |
| `alpha-reward-profiles.json` | ids unique; scrap shapes valid; no unknown fields. |
| `alpha-statuses.json` | ids unique; `kind` ∈ {buff, debuff}; `stack` ∈ {counter, flag}; every status referenced elsewhere (powers[], verbs, core-spec) resolves here. |
| `alpha-encounters.json` | ids unique; `enemies[]` exist in alpha-enemies; `rewardProfileId` exists; `band` ∈ §5.1; every `tags[]` ∈ §5.2; `nodeType` ∈ validNodeTypes; non-empty lesson. |
| enemy `moves` + `attackPattern` | `attackPattern.moveIds`/entries reference defined moves; `cycle` non-empty; `scripted.loopFrom` in range; `weighted.weight > 0`; optional `entry.repeat` ∈ {cannotRepeat, oncePerCombat}; `conditional.fallback` defined and every `if` ∈ §1.3 set; every `powers[].status` ∈ §5.5 registry and `target` ∈ {self, flock}. |
| `alpha-market.json` | prices positive; slot shapes valid (§9 slot interfaces); slot counts match inventory rule; referenced card/RouteMark/Supply ids exist; service ids ∈ `{preen,release}`. |
| `alpha-supplies.json` | `answerType` ∈ §5.4; `rarity` valid; effects parse + verb allowlist. |
| `alpha-signals.json` | choice `key`s unique and order-stable; `outcomes` parse + verb allowlist; `requirements`/`cost` parse + **predicate allowlist** (§7.2). |
| `alpha-basins/nests/cache.json` | option ids unique; effects parse + verb allowlist; `cost` non-negative. |
| route marks | `family` ∈ §5.3; `rarity` valid; `source` valid; `trigger` valid (trigger rule below); `effect` parse + allowlist. |
| snag cards | each `kind:'snag'` card id referenced by `addSnag*` exists; snags carry no beneficial `flockStats`. |
| run summaries | schema stable (§10 event types); `path` nodes exist; card ids exist. |

**Trigger validation rule** (route marks): a trigger string is **not** routed
through `effectPattern`. Split it on ` if `; validate the left side against the
§6.1 trigger enum (`onNthCardThisTurn(N)` etc. accepted with an integer arg); if
a right side exists, validate it as exactly `turn >= <positiveInt>`. This is the
only place the `turn >= N` gate appears in a trigger.

### 8.3 Regex change + verb/condition allowlists

**Regex must change (do not "keep as-is").** The current `effectPattern`
(`tools/validate-runtime-data.mjs:50`) accepts `verb(args)` and
`if name(arg)? then verb(args)`, where the condition name charset is
`[a-zA-Z][a-zA-Z0-9]*` with no spaces or operators. It already accepts every
shape **shipped today** (all 21 enemy effects pass, so CI is latently green), and
it accepts the `flock` token. But it **rejects** the new `turn >= N` comparison
form introduced in §1.3 — empirically `if turn >= 1 then gainWingbeat(1)` fails
as "malformed effect." Widen the condition slot to also accept
`turn >= <digits>` (the single operator §1.3 permits), e.g. allow an optional
` >= [0-9]+` after a condition name scoped to `turn`. This regex fix must land
**before** any `turn >= N` effect is authored.

**Verb allowlist** (upgrade "malformed" → "unknown verb"): the verb in each
expression must be in the union of:

- combat verbs (core-gameplay-spec §Effect Syntax),
- enemy verbs (§1.2),
- route verbs + Route Mark resolver helpers (§6.3), including `releaseCard`.

(`chooseOneOfTwoCommon` is an `addCard` selector, validated as a selector
argument — not a verb name.)

**Condition allowlist** (new — closes the silent-pass gap): the condition name in
any `if COND then …` effect prefix must be in the §1.3 closed set
(`notHitThisTurn`, `flockHasNoCover`, `isMolting`, `flockOpenSky`,
`flockCohesionBelowHalf`, `selfBelowHalf`, plus the `turn >= N` form). Without
this, an invented condition (`if flockHasNoArmor then …`) passes silently. The
same set validates enemy `AttackPattern.conditional.if` (§8.2).

**Status allowlist**: every `StatusApplication.status` (§2.1 `powers[]`) and every
status id referenced by a verb must be in the §5.5 registry id set.

**Predicate allowlist**: every `SignalChoice.requirements`/`cost` string must
parse to a §7.2 predicate, via the same parse-and-allowlist machinery as verbs.

**Reject unknown — the contract is exhaustive.** Two mechanisms, both in the
existing dependency-free `validate-runtime-data.mjs` (no schema library added):

- **Strings** — unknown verbs, conditions, statuses, and predicates fail via the
  allowlists above (the regex shape-checks, the allowlist name-checks).
- **Object fields** — each record's `Object.keys()` is checked against a per-type
  **known-key set** (the same lists `types.ts` declares); an unexpected key fails
  loudly. This is plain JS key-checking, not JSON-Schema/Zod — `powers?`/`repeat?`
  and other optional fields are *in* the known-key set, so their absence is fine
  and their presence is allowed; only genuinely unrecognized keys fail.

Together these prevent silent-drop drift, where a typo'd or invented field/verb is
ignored instead of flagged. (Lesson borrowed from spire-codex's schema-as-contract:
an undeclared field was silently stripped until added to the contract.)

### 8.4 Runtime wiring (the validator change alone does not load the data)

`src/game/runtime-data.ts` uses static ES imports with typed `as Runtime*`
re-exports; Vite bundles the JSON directly (no codegen). Every new data file
(reward-profiles, statuses, encounters, market, supplies, signals, basins, nests,
cache) needs three additions beyond its validator block:

1. a static `import x from '../../data/game/alpha-x.json'` in `runtime-data.ts`,
2. a typed `as RuntimeX` re-export, and
3. a matching interface in `src/game/types.ts`.

Validation proves a file is well-formed; these three make it reachable by the
game.

---

## 9. Market (new file: `data/game/alpha-market.json`) — [authoring, low risk]

`MarketConfig` per implementation spec. `MarketPriceBand` needs `min`/`max`; the
spec gives a single base, so default `min = base - 20`, `max = base + 20` (tune
later). The slot shapes the implementation spec references but does not define:

```ts
interface MarketCardSlot      { rarity: 'common' | 'uncommon' | 'rare' | 'weighted'; price: MarketPriceBand; }
interface MarketRouteMarkSlot { selector: 'nonBoss'; price: MarketPriceBand; }
interface MarketSupplySlot    { selector: 'pool'; price: MarketPriceBand; }
```

`MarketConfig` is the **static offer template**; per-offer **sold-out and sale**
state lives in **run state**, not config — a `MarketOfferState`
`{ slotIndex: number; soldOut: boolean; onSale?: boolean; finalPrice: number }[]`
materialized when the Market node opens (after singleton filtering). The
validator checks `MarketConfig` shape; sold-out/sale are runtime-only.

Prototype prices from alpha-run-spec:

- card offer 65, Loose Change Tin 95, Rain Gutter 105, Wire Map 100, Patched Harness 110, Preen 90.
- Services: `release` `{ basePrice: 75, priceIncrease: 25 }`; `preen`
  `{ basePrice: 100, discountRouteMarkIds: ['patched_harness'] }` — this realizes
  the `patched_harness` `passive` Route Mark (§6.2).

Singleton filtering (exclude owned cards) is applied before offers render.

---

## 10. Phase 5 Live State + Run Summary — [DECISION]

`window.__birdSquadState` currently returns `RenderPayload` and is consumed by
`render_game_to_text`/`advanceTime` (an external text harness). Resolution:

- Keep `render_game_to_text` returning a stable text view (do not break the
  harness contract).
- Add `BirdSquadLiveState` as a **new** field/global rather than overloading the
  existing one, so Phase 5 is additive. Implement `advanceTime` (currently a
  no-op stub) so headless smoke tests can drive runs.
- `RunSummary` artifacts write to `localStorage` under a `birdsquad.runs` key in
  the app, with a dev-only export to `.artifacts/runs/*.json` for the local
  stats aggregator to read. The run-summary validator reads the `.artifacts`
  copy.

### 10.1 Undefined types the implementation spec references (defined here)

The roadmap's `RunSummary` and `BirdSquadLiveState` reference types that exist
nowhere. Defined inline so Phase 5 is implementable and the "schema stable"
validation row has a target:

```ts
interface BattleResourceState {
  cohesion: number; maxCohesion: number;
  cover: number;
  wingbeats: number; wingbeatMax: number;
  resonance: number; resonanceCap: number;
  drawCount: number; discardCount: number;
  scrap: number;
}

interface SignalChoiceEvent  { signalId: string; choiceKey: string; outcomes: string[]; }
interface MarketPurchaseEvent { marketId: string; itemId: string; itemType: 'card' | 'routeMark' | 'supply' | 'service'; pricePaid: number; }
interface CombatResultSummary { encounterId: string; enemyId: string; turnsTaken: number; cohesionLost: number; killedByMove?: string; }
```

These back the local-stats bullets: `CombatResultSummary` → "deadliest enemies
and moves" and "Cohesion loss by node type"; `SignalChoiceEvent` → "Signal
choices"; `MarketPurchaseEvent` → "Market purchases". `RunSummary.cardRewards`
collects the implementation spec's `CardRewardEvent` at reward-resolution time;
the aggregator derives "reward skips" and "Preen choices" from
`CardRewardEvent.skipped` and `.fallbackChoice`.

---

## 11. First-Slice Micro-Decisions — [MICRO]

- **Intent badge danger thresholds**: §2.3 (low ≤6, medium 7-10, high ≥11).
- **Authoritative HandCardView**: use the implementation-spec shape
  (`instanceId/cardId/costLabel/name/suitAccent/roleChip/playable/selected/
  exhaustedPreview?`), not the study's. Until Phase 4 instance identity exists,
  `instanceId` is a synthesized per-render key (e.g. `cardId#slot`); Phase 4
  replaces it with the durable `CombatCardInstance.instanceId`.

---

## 11a. Phase 4 Design Decisions (still open — engineering + 2 decisions)

Phase 4 is mostly engineering, but two design points are genuinely undecided and
must be set before coding:

- **`instanceId` minting**: assign a per-run monotonic counter at the moment a
  card joins the run deck (`OwnedCard.instanceId`), stable across save/reload so
  `RunSummary.deck` and `CardRewardEvent` can reference it. `CombatCardInstance`
  derives its `instanceId` from the owning `OwnedCard` plus a per-combat suffix
  for cards that split/duplicate mid-combat. This is the linkage Phase 5 stats
  rely on, so it cannot be deferred past Phase 4.
- **Exhaust semantics**: `CombatDeckZones.exhaustPile` and
  `HandCardView.exhaustedPreview?` exist, but no §1/§6 verb exhausts a card, and
  no Alpha card uses exhaust. Decision for Alpha: `exhaustPile` is **reserved**
  (always empty); add an `exhaust()` verb only when a card needs it. State this
  explicitly so the empty pile is intentional, not an oversight.

## 12. Residual Items (not blockers; tracked)

- **Playwright harness** is greenfield (no project dependency). Recommended:
  `@playwright/test` asserting against `render_game_to_text`/`__birdSquadState`
  (fast, deterministic) rather than canvas pixels; wire to `vite preview`. This
  is tooling work, sequenced after the Phase 1 slice; it does not block authoring
  the data files above.
- **Subjective acceptance criteria** ("readable", "under two seconds", "feels
  fair") should be restated as observable assertions when the smoke tests land
  (e.g. "intent badge exposes a numeric `value` for every attack move";
  "default battle text-state contains no full card effect string unless a card is
  selected"). Until then they remain directional.

## 13. Spire-Codex-Validated Refinements (provenance)

Sections above marked "spire-codex" fold in five patterns from a review of the
`spire-codex` reference repo (a reverse-engineered StS2 **database**; only
field-shapes/techniques transferred — no content, names, or numbers). The review
independently **validated** the core contracts (the cycle/weighted/conditional/
scripted taxonomy, config-vs-runtime Market split, choice-order canonicality).
The five adopted refinements:

| # | Pattern | Lands in | Effort |
| --- | --- | --- | --- |
| 1 | Closed precondition grammar for `SignalChoice.requirements`/`cost` | §7.2 + §8.2/§8.3 | medium |
| 2 | Structured `powers[]` (`{status, target, amount}`) for buff/debuff, shared by enemy moves + card buffs; feeds IntentBadge with no string parsing | §2.1, §2.2 | medium |
| 3 | Status registry `alpha-statuses.json` (`{id, kind, stack}`) as the status allowlist + table-driven tick/stack | §5.5, §8.2, §8.4 | medium |
| 4 | Per-entry `repeat` (`cannotRepeat`/`oncePerCombat`) on attack patterns for boss variety as data | §2.1, §8.2 | small |
| 5 | Validator **rejects unknown** fields/verbs/conditions/statuses/predicates (types.ts + allowlists = one exhaustive contract) | §8.3 | small |

Two Phase-4-tooling ideas from the same review are **built** (they are tooling,
not data contracts):

- `tools/diff-runtime-data.mjs` (`npm run diff:data`) — id-matched field-level diff
  of `data/game/alpha-*.json` between two snapshots (working tree vs a git ref, or
  two explicit files), skipping a presentation-key set so balance changes aren't
  buried under art/copy/reorder churn. `--all` includes presentation keys;
  `--check` exits 1 on any change (CI gate).
- `tools/audit-content.mjs` (`npm run audit:content`) — source-vs-data balance
  audit: asserts the authored spec numbers (enemy health, per-move damage, reward
  scrap bands, deck sizes, and the §3/§5.5 contract values) against the data and
  fails on drift. Not-yet-authored Phase-3 files report as PENDING and their
  checks activate automatically when the file lands.

The IP boundary is strict: shapes and enum keys only; every StS2 name/number is
out of bounds.

## Net Effect On Phase Readiness

With sections 1-10 accepted, Phase 3 moves from **blocked** to **transcription**:
every new data file has a schema, a closed vocabulary, transcription-ready
content, and a validation rule — provided the §8.3 regex change and the §7.3 snag
authoring land first (both are prerequisites, not blockers of unknown shape).
Phase 6 unblocks (bands/tags assigned). Phase 5 has a complete additive contract
(§10.1). Phase 4 has **remaining design decisions** (instance-id minting, exhaust
semantics — §11a) plus engineering work; the Playwright harness is greenfield
tooling (§12). None of these is missing information after this doc.

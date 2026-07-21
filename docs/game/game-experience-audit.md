# Bird Squad Game Experience Audit

Version: 1.0

Status: current-state design audit and prioritized improvement roadmap.

Audit date: 2026-07-09

Implementation update: 2026-07-18

The first experience pass is now live in the runtime: route paths use stronger
continuous connections, selected routes keep gain/risk visible, the commit
medallion has an explicit command label, encounter goals are selected from a
seeded seven-pattern tactical pool, district contract badges persist in the
Flock Record, and Leader mastery begins with behavior-specific goals. Shareable
challenge links carry the route seed and Quick/Full length from every outcome,
while same-seed `Replay Flight` rematches preserve Leader, Ascension, and
Quick/Full setup while resetting run progress. The First Flight Guide now
persists a four-step live decision path
(route, card, Roost/Tell, reward), records seen/completed/skipped/replayed state,
and exposes Skip Guide / Replay Guide from How to Play. Route planning now
changes its generated skyline, lighting, and environmental landmarks for every
district while keeping the tactical plotting surface quiet. Remaining larger
visual experiments can therefore focus on encounter-specific evolution inside
each district instead of basic route identity. Boss tactics that resolve in
combat now persist to the Flock Record, reveal one move at a time in Codex boss
dossiers, appear as outcome updates, and can become the next-flight objective.
Leader records now separate Full and Quick clears at every Ascension tier,
retain the fastest total-flight beat count, celebrate first clears and genuine
speed improvements at the outcome, and surface each Leader's best Full tier plus
Full/Quick pace in the Profile. Old saves migrate without inventing records.

Related sources:

- `docs/game/game-design.md` owns the product direction and vocabulary.
- `docs/game/core-gameplay-spec.md` owns combat and card rules.
- `docs/game/run-design-spec.md` owns route and economy rules.
- `docs/game/next-level-implementation-spec.md` records the earlier systems roadmap.
- `docs/game/look-and-feel-plan.md` records the earlier presentation roadmap.
- `docs/project/runtime-architecture.md` maps the current implementation.

## Purpose

This audit answers five questions about the current playable game:

1. How can it become more fun?
2. How can it look more beautiful?
3. How can it play better?
4. How can its loop become more compelling and replayable?
5. How can it become more intuitive for a new player?

This is a post-content audit. It assumes the existing four-district run, card
pool, enemy roster, item pools, generated art, meta progression, and combat FX
remain valuable. The recommendation is to organize and teach what exists before
adding another broad content pack.

## Executive Verdict

Bird Squad has a strong identity and unusually complete content foundation. Its
best material is already present:

- bird-city streetwear fantasy with premium card, enemy, route, and market art
- singleton deckbuilding where every new card also changes passive Flock Stats
- readable enemy Tells and a meaningful Cover-versus-damage decision
- Molt and Open Sky as a signature risk/reward cycle
- Flow, Surge, and formation break as a promising moment-to-moment combo loop
- branching districts with recovery, upgrades, events, Markets, and boss prep
- five Leaders, Ascension tiers, achievements, Codex discovery, and run summaries

The primary weakness is not lack of systems. It is that too many systems compete
for attention before the player understands which one matters now. The game is
beautiful in aggregate but visually dense at decision scale. It has satisfying
animation beats, but their full duration will become repetitive across a long
run. It has meta progression, but it does not yet turn that progression into a
clear next-run goal.

The next quality push should therefore be:

1. progressive onboarding
2. decision-first visual hierarchy
3. adaptive combat pacing
4. a clearer Flow-centered combat rhythm
5. trustworthy playtest instrumentation
6. visible, horizontal mastery goals between runs

## Evidence Reviewed

| Evidence | Current Signal | Design Meaning |
| --- | --- | --- |
| Live title screen | Strong first image; five Leaders and Ascension are presented immediately. | Premium identity, but first-run choice density is high and Leader details are small. |
| Live How to Play overlay | Explains route, battle, Cohesion, and meta progression at a high level. | It does not teach target selection, Roost, Tell math, Flow, Surge, Molt, Open Sky, or route confirmation. |
| Live first route load | Route becomes visible with fallback letters before generated node art finishes loading. | A debug-looking first impression reaches the player. Interaction should wait behind a short diegetic loading reveal. |
| Stable route capture | The finished map is attractive and boss prep is useful. | The whole board uses similar ornament weight, so reachable nodes and the next decision do not dominate enough. |
| Stable combat capture | Player, enemy, hand, intent, resources, and log are all readable at 1280x720. | The action hierarchy is still distributed across many small labels and meters. |
| Reward capture | Card art and hover detail are rich; deck-need guidance exists. | The large center dossier obscures competing rewards, making comparison harder while inspecting. |
| Market capture | The vendor scene is distinctive and visually memorable. | Price, item identity, services, and detailed choices compete at small sizes. |
| Mobile captures | The fixed 1280x720 canvas is scaled into a narrow landscape strip in portrait. | Portrait mobile is not meaningfully playable despite touch input being enabled. |
| `npm run audit:balance` | Four districts have authored pressure progression and safety stops. | Balance scaffolding exists; the next need is behavioral evidence, not more target tables. |
| `npm run audit:economy` | 500 simulated runs hit deck, Waymark, Preen, and safety targets. | Economy is numerically plausible, but uniform random route choice does not prove choices are fun or legible. |
| `npm run stats:playtest` | Produces a nonempty ten-run seeded dashboard when no local human summaries exist, and labels that source as pipeline evidence rather than balance evidence. | The report contract is operational; real playtest rows are still required before making retention or balance claims. |
| Run summary code | Stores summed encounter turns, real duration, earned/spent/final Scrap, route and reward decisions, guide state, pacing preference, enemy-move pressure, and invalid/cancelled input actions. | The event contract now supports analysis and save recovery, while conclusions still depend on representative human sessions. |
| Current content volume | 110 cards, 64 enemies, 80 encounters, 58 Waymarks, 31 Supplies, and 38 Signals. | Content quantity is not the present bottleneck. |

## Experience Hierarchy

Every screen should answer three questions in this order:

1. What is happening?
2. What decision can I make now?
3. Why might one option be better?

The current UI often answers all three at the same visual weight. The new
hierarchy should be:

### Combat

Primary, always visible:

- current enemy threat after Cover and status modifiers
- playable cards and Wingbeats
- selected target and predicted result
- Flow state and the next Surge threshold
- Roost when the player is ready to hand control to enemies

Secondary, contextual:

- Resonance only when the deck or hand can use it
- Molt and Open Sky only when active or immediately available
- suit keystones when one is near triggering
- draw/discard/deck detail on demand
- full combat history in a drawer

### Route

Primary, always visible:

- reachable nodes
- concrete tradeoff for each reachable node
- current Cohesion and relevant Supplies
- boss test and the largest readiness gap

Secondary, contextual:

- full deck and Flock Stats
- all Waymarks
- distant-node details
- district lore and route history

### Rewards And Market

Primary, always visible:

- what changes if the player picks this option
- cost or opportunity cost
- how it supports the current build
- skip, Preen, or leave alternative

Secondary, contextual:

- full art and lore
- complete keyword definitions
- complete Flock Stat breakdown

## Priority Findings

### P0. The First Run Needs A Guided Flight

Implementation status: the persistent four-step First Flight Guide is live. It
teaches route confirmation and tradeoffs, Wingbeats/Flow card play, Roost with
incoming-minus-Cover arithmetic, and reward comparison. It never blocks legal
alternatives, can be skipped or replayed, and records local progression. After
that sequence is complete, a one-time contextual Molt lesson waits until an
actual Molt card reaches hand, identifies that card without blocking alternatives,
explains the Beat/Open Sky tradeoff, and retires permanently when the card is
played. Skipping the core guide also suppresses the contextual lesson.

The How to Play overlay is a useful reference, but it is not an onboarding
sequence. A first-time player must infer too much from compact labels.

Add an optional, stateful first-run guide that teaches through live decisions:

1. Route: highlight the reachable Street Encounter and label the confirmation
   control `Take Route` for the first two selections.
2. Combat: highlight Wingbeats, one affordable card, and its legal target.
3. Prediction: show `Deals 3 -> Roof Rat 24/27` before confirmation.
4. Defense: translate the Tell into `Incoming 8 - Cover 3 = 5 Cohesion`.
5. Roost: label the control `Roost (End Beat)` until the player has used it
   three times.
6. Flow: explain that each card builds Flow, full Flow creates Surge, and an
   unblocked hit breaks the formation.
7. Reward: compare one card against the current deck need and explain that Skip
   is intentional.
8. Molt: delay the Molt lesson until a Molt card first enters hand.

Rules:

- one coach mark at a time
- never block a legal alternative after the concept is introduced
- persist tutorial progress across reloads
- provide `Skip Guide` and `Replay Guide`
- do not explain all suits, statuses, Markets, or meta progression up front

Acceptance:

- five fresh testers can start a run, enter combat, play a targeted card, read
  incoming damage, Roost, and choose a reward without outside instruction
- at least four of five can explain Cohesion, Cover, Wingbeats, and enemy Tells
  after the first fight
- tutorial completion and skipped-step counts are recorded locally

### P0. Gate First Interaction On Essential Art Readiness

The route currently renders fallback node letters while generated assets load.
Fallbacks are valuable for failure recovery, but they should not be the normal
first frame.

Add a scene readiness contract:

- essential route bundle: map backing, node icons, selected ring, route frame,
  district banner, and commit control
- essential battle bundle: battlefield, player/enemy art, hand chrome, HP and
  intent chrome, Roost control
- optional bundle: hover dossiers, rare reward ceremony art, Codex detail art,
  and nonessential FX

Keep the previous screen visible or show a short `Charting the route...` / `Flock
taking position...` transition until essential assets are ready. Do not expose
the interactive scene underneath.

Acceptance:

- first route and first combat screenshots never contain fallback letters,
  missing textures, or debug geometry under normal network conditions
- failure fallback still appears after a bounded timeout and reports the failed
  asset group in debug state
- time-to-first-interaction is measured separately from time-to-full-art

### P0. Fix Telemetry Before Tuning Retention

Implementation status: substantially complete. Run summaries now keep encounter
turns and durations, distinct earned/spent/final Scrap, route and reward offer
denominators with decision time, guide state, combat pacing, district/boss
context, actual Cohesion loss and Cover blocked per enemy move, and invalid or
cancelled card/target actions. The active-run checkpoint sanitizer and clone
path preserve the new combat fields. `npm run stats:playtest` reads these local
summaries into the requested funnel, duration, death, choice-rate, Leader, enemy
pressure, and input-friction views. Its seeded fallback is explicitly pipeline
proof only; representative human playtests remain the prerequisite for tuning
or retention conclusions.

Human collection is now operational rather than console-only. Opening a build
with `?playtest=1` adds a local-only export command to the Flock Record; it
downloads the journaled run-history array without a network upload. The
dashboard accepts one export, several exports, or a directory of tester files,
merges them, and removes duplicate run IDs. The observed-session procedure and
release evidence rules live in `docs/game/playtest-runbook.md`.

The original audit found useful event data but aggregate fields that were not
trustworthy enough for design decisions. The following contract remains the
standard for future telemetry changes:

Correct and add:

- total run beats, plus beats per encounter
- Scrap earned, spent, skipped, and final balance as separate values
- real run duration and active decision time
- district reached and boss attempts
- damage taken by enemy move
- reward offers, picks, skips, and time-to-pick
- route node previews, selections, and time-to-commit
- invalid or cancelled card/target actions
- tutorial steps viewed, completed, replayed, or skipped
- animation-speed preference

Add a developer-only run dashboard that reads local summaries and shows:

- first-run completion funnel
- median first-fight duration
- death distribution by district and move
- reward pick rates and skip rates
- route node pick rates by visible alternative
- Leader win rate and run duration

Acceptance:

- `npm run stats:playtest` distinguishes earned, spent, and final Scrap
- full-run turns equal the sum of encounter turns
- ten seeded internal runs produce a nonempty dashboard without manual console
  export steps
- every balancing claim names the telemetry field that supports it

### P0. Add Adaptive Animation Pacing

Readable attack staging is now a strength. Repeating full cinematic timing for
every common action across roughly fourteen combats per run will become drag.

Add a setting independent of reduced motion:

| Mode | Use |
| --- | --- |
| Cinematic | Full anticipation, impact, and recovery timing. Default for first encounters and bosses. |
| Standard | Current readable timing with repeated common moves shortened after first viewing. |
| Snappy | Keeps tells and impact order but trims holds and recovery. |

Also support press-and-hold acceleration during enemy sequences after the Tell
has been visible for a minimum readable window. Never skip damage feedback,
status changes, death, boss phase changes, or the first use of a new move.

Acceptance:

- a new enemy move remains readable on first use
- repeated common attacks complete 25-40% faster in Standard after first use
- Snappy never changes combat outcome or event order
- the player can always identify which enemy acted and what changed

### P1. Make Flow The Core Emotional Combat Meter

Flow is mechanically promising: playing cards builds it, Surge improves attack
and defense, and unblocked damage breaks it. It connects aggression and defense
in one understandable loop. Today it is a small secondary readout and is absent
from the canonical combat spec.

Promote it instead of adding another combat system:

- place Flow adjacent to Wingbeats as a clear pip rail
- preview how much Flow the selected card adds
- show `Surge next` on the card that fills the meter
- preview the Surge bonus on damage and Cover numbers
- animate Flow cracking toward zero when an unblocked hit is forecast
- show a small `Formation holds` payoff when Cover preserves Flow
- document Flow, Hold, Surge, Scatter, and Regroup in the core gameplay spec

Implementation status (2026-07-17): live. Combat now gives Flow a dedicated
five-pip rail beside Wingbeats, previews selected-card gain in gold, labels the
Surge threshold, and forecasts whether incoming damage will hold or break the
formation. A red crack crosses the rail before an unblocked reset, while exact
selected-card outcome rails keep enemy Cohesion, Cover, Flow, and Surge math
visible without covering enemy Tells. The canonical gameplay spec now defines
Flow, Hold, Surge, Scatter, and Regroup.

Acceptance:

- a tester can explain how to gain and lose Flow after one combat
- the player can predict whether a card creates Surge before playing it
- the player can predict whether the incoming hit breaks formation
- Flow feedback never covers the enemy Tell or selected card result

### P1. Add Outcome Preview To Every Irreversible Decision

The game has many effects, passives, and statuses. The interface should do the
arithmetic rather than asking the player to mentally combine small labels.

Combat preview examples:

- `3 base + 2 Flock + 1 Surge = 6 damage`
- `Incoming 8 - 5 Cover = 3 Cohesion`
- `This hit breaks Flow`
- `Molt: cost 0, then Open Sky +1`

Route/reward preview examples:

- `After purchase: 47 Scrap`
- `Deck 14 -> 15; Damage steady -> strong`
- `Preen: +2 Cover, +1 Flock Cover`
- `Basin: 21/38 -> 31/38 Cohesion`

Use concise preview chips by default and a breakdown tooltip on demand.

Acceptance:

- all irreversible card, route, reward, and Market decisions show their primary
  immediate delta before confirmation
- previews are generated by the same resolver logic as the real action
- preview and actual result are covered by parity tests

Implementation status (2026-07-18): complete. Route selection already
shows its selected gain/risk contract, Market purchases show remaining Scrap,
and card rewards now keep an always-visible decision chip above every offer.
Adding a card previews the exact deck-size change; Preen compares the first
changed base or Molt effect (with Flock Stat fallback). The reward chips consume
the same raw card/deck contract as commitment, and focused browser coverage
proves displayed Add/Preen outcomes against the resulting deck and upgraded
card. The shared Market/route workbench picker now carries that preview into the
final card commitment: Preen cards show their first changed normal, Molt, or
Flock Stat result, while Release cards show the exact live deck-size reduction.
Paid choices retain their per-card Scrap badge and full hover dossier, and
focused parity coverage proves both Market commits plus recalculation after a
route workbench removal. Market coverage now includes every purchase family:
cards, Waymarks, Supplies, boss rigging, route planning, and stock refresh all
show their exact primary before/after rows before commitment. The projection
also resolves carried `afterMarketPurchase` Waymarks, so Scrap refunds, Open Sky
Guard, and Open Sky reduction cannot make the preview disagree with the actual
purchase. Preen and Release correctly defer payment until the chosen card shows
its exact per-card cost and result. The long-tail route-event grammar now uses
the same route-effect resolver for Basin, Cache, Nest, and all 38 Signal
definitions. Its confirmation panel shows Cohesion, Scrap, deck, Supply,
Waymark, boss shield, Open Sky Guard/cut, enemy Cover, and forced Open Sky
changes before commitment. Random cache outcomes and reward selections are
frozen when the panel opens, and active Basin, Cache, and Signal Waymark
triggers are resolved in the same projection. Preen and Release remain safely
two-stage, with their exact result shown on each final card. Rival choices show
their Battle handoff before selection. Event-family parity coverage proves the
displayed projection against the committed state, including hidden Waymark
bonuses and a cache card choice. Combat, rewards, Market purchases, and route
events therefore all have resolver-parity proof for this acceptance item.

Implementation status: selected combat cards now use the live effect resolver
to forecast exact enemy Cohesion and Cover, flock Cohesion and Cover, and Flow.
The selected enemy health rail shades the pending loss, marks the remaining
boundary, and switches from `AFTER N` to `LETHAL` when the target will be
defeated. The compact selected-card rail reports before/after values and Surge
without adding another permanent HUD panel. Parity coverage commits the same
card after inspection and verifies the forecast against the resolved state.

### P1. Simplify Visual Hierarchy Without Removing Art

The art quality is high. The problem is that frames, glows, metallic ornament,
icons, and text often all compete at once. More assets will not solve this.

Apply a three-level ornament budget:

1. Hero: boss, selected card, chosen route, rare reward, district transition.
2. Interactive: reachable node, playable card, purchasable item, Roost.
3. Structural: passive frames, dividers, inactive inventory, distant route.

Only Hero elements receive full gold/cyan/magenta contrast and active glow.
Structural chrome should be darker and quieter. Reserve particles for state
change, not idle decoration.

Specific surface changes:

- Reward: dock the full card dossier to one side so all offers remain comparable.
- Market: keep item name, effect role, and price readable before full art/lore.
- Route: brighten reachable edges and dim distant ornamental nodes.
- Combat: make enemy threat and selected-card outcome brighter than the log.
- Title: mark Fledgling as `Recommended first flight`; hide advanced Leader
  detail until hover or selection.

Acceptance:

- grayscale screenshots still reveal the current decision by contrast alone
- a selected reward never hides the other offers or Skip
- inactive ornament never has more luminance than the primary action
- text remains readable without relying on glow or stroke alone

Implementation status (2026-07-18): complete. A production grayscale pass now
covers title, route confirmation, reward comparison, Market inspection, and
settled combat. Start Run and the recommended Fledgling remain the title's
dominant actions; route confirmations hold their exact ledger beside the reward
without competing with the dimmed world; Market inspection centers one readable
dossier while keeping stock visible; all three reward offers and Skip remain
simultaneously comparable; and combat keeps enemy threat plus playable cards
brighter than its event log and structural chrome. Text survives grayscale
without depending on suit color. The route confirmation is additionally clean
and anchored at 2560x1600 (a centered 1920x1080 stage), 1280x720, and the
minimum supported 1000x560 viewport, with no clipping, mixed-coordinate drift,
or browser errors. Existing high-resolution route and landscape-tablet coverage
keeps this breakpoint contract durable.

### P1. Turn Route Choice Into A Concrete Build Decision

The route is visually rich and boss prep is a strong foundation. Reachable nodes
should answer `why this path now?` in one glance.

For each reachable node, show one concise benefit and one risk:

- `Street: card + Scrap / medium damage risk`
- `Basin: heal 10 / no deck growth`
- `Nest: Preen / no recovery`
- `Rival: rare Waymark / high pressure`
- `Market: spend Scrap / inventory unknown`

Add one district contract selected at district start. Contracts are optional
micro-goals that turn route planning and combat style into a short arc:

- Hold The Line: finish two combats without an unblocked hit.
- Clean Flight: reach the boss without adding a Snag.
- Bright Signal: trigger Surge in three encounters.
- Lean Route: skip two card rewards before the boss.

Rewards should be horizontal or run-limited: bonus Scrap, a Supply choice,
Leader mastery, Codex embellishment, or a cosmetic record badge.

Acceptance:

- every reachable node communicates benefit and risk before selection
- contracts can be completed through at least two viable route/build strategies
- contracts do not become mandatory power progression
- completion is celebrated in under three seconds and recorded in run history

Implementation status (2026-07-18): complete. Every reachable node exposes a
concise live benefit/risk pair in both the route UI and text-state contract.
District start offers three of four seeded plans spanning defensive play,
Surge builds, lean-deck reward skipping, and Snag avoidance; all pay horizontal
Scrap plus permanent record/mastery credit rather than mandatory power. Contract
progress remains visible on the route, all four resolver paths have completion
coverage, and completed contracts persist into run summaries, Flock Record
badges, Leader mastery, and flyway restoration. Completion now produces one
generated route callout and the existing ascending objective-complete cue, names
the exact Scrap/badge reward, expires after 1.8 seconds, and stores a celebrated
latch so reloads cannot replay it.

### P1. Improve Reward Comparison And Build Direction

Deck-need labels already exist, but `Damage strong` does not fully explain why
one offered card is better than another.

Add comparative guidance:

- role delta: `Adds first reliable Winded source`
- curve delta: `Fourth 2-cost card; may strain Wingbeats`
- suit delta: `Plumes 3 -> 4; unlocks Plumes keystone`
- duplicate function warning: `Third single-target attack`
- anti-synergy warning: `Healing is weak at full Cohesion builds`
- skip framing: `Skip +12 Scrap keeps the deck at 13`

Never label one card as objectively best. Explain consequences and let the player
choose the plan.

Acceptance:

- each reward option shows at most two high-signal build observations
- comparisons update from the actual run deck and owned Waymarks
- no guidance uses hidden information about future random encounters

Implementation status (2026-07-17): live. Each card reward now shows one or
two separately rendered observations derived from the current deck and carried
Waymarks. Priority signals cover first reliable capabilities, owned suit-engine
triggers, 4-to-5 keystone thresholds, curve strain, role crowding, Molt safety,
and existing recovery saturation. Guidance is descriptive rather than a best-
pick ranking, and the Skip action still states both resulting deck size and
Scrap. The full dossier follows the hovered offer, keeping every unselected
offer and Skip visible for side and middle choices.

### P2. Add Encounter Goals, Not Just More Enemies

Implementation status (2026-07-18): live. Non-boss encounters draw
deterministically from district-specific strategic pools. Rooftop goals teach
Flow, restraint, and finishing guarded; Canal goals add banked-Wingbeat and
damage-blocking plans; Signal Spires favor Surge/Flow timing and fast clears;
High Roost raises the blocking target and mixes defense with efficiency. The
goal plate now replaces static copy with live progress such as `Wingbeat banked
1/1` or `Damage blocked 5/8`, while hover reveals the complete condition and
Scrap reward. Goals remain optional horizontal rewards and never turn a combat
win into a loss. Priority goals additionally mark their actual target beside
that enemy's Tell/Cohesion rail, show the remaining Beat window, and switch to a
clear missed state after the deadline. The target marker and global goal plate
share the same live objective state. Every active-to-terminal transition also
fires one compact generated callout and a matching audio cue: bright/ascending
for completion, softer/descending for a miss. The one-shot latch prevents
redraws from replaying either signal, and the roughly 1.3-second presentation
remains below the three-second celebration budget.

The roster is already broad. Increase encounter texture through objective and
priority changes before producing another large enemy wave.

Candidate encounter goals:

- break a signal jammer before its third broadcast
- survive three beats while a route gate opens
- defeat a courier before it escapes with Scrap
- protect a neutral route worker from splash pressure
- choose which of two enemy supports to disrupt first
- win while preserving a temporary shelter for a bonus reward

These remain card-battle objectives, not a tactical grid. They should reuse
Tells, move sequencing, status, reward, and encounter data.

Acceptance:

- each district has at least two encounters whose optimal plan is not simply
  `deal maximum damage to the lowest HP target`
- objective state is visible near enemy Tells
- failure changes reward or route state without creating an unexplained loss

### P2. Build A Horizontal Mastery Loop

Current progression unlocks Leaders, Ascension, achievements, and Codex entries.
Make the next desirable goal visible without adding permanent power creep.

Add:

- Leader mastery tracks with named milestones (implemented)
- suit discovery sets in the Codex (implemented with 25%, 50%, and complete milestones)
- boss dossier completion through observed moves, not grind count (implemented)
- district contract badges (implemented)
- personal records by Leader, flight length, and Ascension (implemented)
- same-seed replay and shareable route challenge links (implemented)
- optional weekly curated route after the base loop is proven

Good rewards:

- title-screen Leader poses or frames
- alternate card-back treatments
- route-board pins and record badges
- lore pages and bird facts
- alternate non-power signature VFX
- challenge mutators that are opt-in

Avoid permanent stat upgrades, stamina, login streak punishment, expiring
rewards, or random paid-style progression. The loop should be compelling because
the player sees mastery and new strategic identities, not because absence is
punished.

Acceptance:

- the outcome screen always offers one understandable next-run goal
- mastery progress is visible before starting and after ending a run
- all mastery rewards are horizontal, cosmetic, informational, or opt-in

Implementation status (2026-07-18): complete. Every unlocked Leader card shows
its named mastery tier, next behavior goal, and live progress before a run. Every
win or loss outcome shows one prioritized `NEXT FLIGHT` goal: an unfinished boss
dossier observation first, then a suit-collection milestone, then the active
Leader mastery target. Fresh contract badges, dossier discoveries, achievements,
and personal records receive a compact outcome celebration and remain visible in
the Flock Record/Codex. Same-seed replay, challenge links, Ascension, and Leader
identities are opt-in strategic or informational goals; none grant permanent
combat stats. Focused coverage proves dossier and collection goal selection,
shared-route fidelity, and fresh-progress outcome presentation. The optional
weekly route remains intentionally deferred until observed retention proves the
base loop: adding calendar pressure now would contradict the no-streak/no-FOMO
direction.

### P2. Choose A Mobile Product Direction

Implementation status: complete for the desktop-first direction (2026-07-14).

The current fixed 1280x720 canvas is a desktop/landscape product. Portrait
screens display the game as a very small strip with large empty bands. Enabling
touch does not make that experience usable.

Choose one:

1. Desktop-first: detect narrow portrait viewports and show a polished rotate or
   desktop recommendation screen. Support landscape tablets only.
2. Responsive mobile: build a separate portrait layout with stacked battlefield,
   horizontally scrollable hand, bottom action bar, and touch-first detail sheets.

Recommendation: declare desktop/landscape first now. Do not spend design effort
on full portrait mobile until first-run desktop retention is measured.

The shipped boundary supports desktop and landscape-tablet viewports at
1000x560 CSS pixels or larger. Unsupported portrait and compact landscape
displays show a branded game-art gate, make the canvas unavailable to input,
and sleep the Phaser loop. Returning to a supported viewport refreshes canvas
scaling and resumes the same run state. The loading shell states the supported
platforms. Title actions, shared audio/pause controls, configurable Settings
rows and switches, and control-remapping tabs and rows use a 58-game-pixel
minimum hit region, equivalent to about 45 CSS pixels at the smallest supported
1000x560 canvas scale. Settings uses two columns and remapping rows use wider
vertical spacing so those targets do not overlap at the larger size. Shared
field commands separate their visual frame from a minimum-size interaction and
focus region, so compact pause, onboarding, Profile, and fallback commands keep
their authored proportions without sacrificing the touch floor. Deck and pile
review lists show seven comfortably spaced rows instead of eleven compressed
rows, with independent 58-pixel row and scroll targets; the card-reward Scrap
fallback uses the same minimum without enlarging its command artwork.

Acceptance:

- unsupported portrait viewports no longer expose unreadable gameplay
- supported landscape touch targets are at least 44 CSS pixels
- platform support is stated clearly on the title/loading surface

## Compelling Loop Design

The loop should work at four nested timescales.

### Ten Seconds: Satisfying Card Decision

1. Read threat.
2. Preview a card result.
3. Play it and build Flow.
4. Feel clear commitment and impact.
5. See the battlefield state settle quickly.

### Two Minutes: Beat And Encounter Arc

1. Establish a plan from the opening hand.
2. Build toward Surge or a suit payoff.
3. Protect Flow with Cover or accept a calculated break.
4. Adapt to a new Tell.
5. Finish with a decisive payoff and concise victory recap.

### Fifteen Minutes: District Arc

1. See the boss test and choose a contract.
2. Route for one build gap.
3. Add or improve a card.
4. Take one meaningful risk at a Rival, Signal, or Market.
5. Beat the boss and earn a district-defining reward.

### Multiple Runs: Mastery Arc

1. Choose a Leader identity or mastery goal.
2. Try a build hypothesis.
3. Receive an outcome explanation, not only win/loss.
4. Unlock visible horizontal progress.
5. Start the next run with a specific question to answer.

## Recommended Sequence

| Order | Work Package | Impact | Effort | Why Now |
| ---: | --- | --- | --- | --- |
| 1 | Correct run telemetry and automatic local dashboard | High | Medium | Prevents tuning by anecdote. |
| 2 | Essential-asset readiness gates | High | Small/Medium | Removes the debug-looking first route impression. |
| 3 | Guided first route and first combat | Very high | Medium | Largest gain in comprehension and first-run completion. |
| 4 | Outcome previews and temporary explicit labels | Very high | Medium | Reduces arithmetic and misclick anxiety. |
| 5 | Adaptive animation speed | High | Medium | Preserves impact while reducing long-run drag. |
| 6 | Flow-centered combat hierarchy | High | Medium | Gives combat one memorable emotional meter. |
| 7 | Reward/Market/route contrast hierarchy | High | Medium | Lets existing art support decisions instead of competing with them. |
| 8 | District contracts and improved reward guidance | High | Medium | Creates short goals and stronger build direction. |
| 9 | Encounter objectives | Medium/High | Large | Adds strategic texture using existing content. |
| 10 | Horizontal Leader/Codex mastery | High | Large | Strengthens replay motivation after the core funnel works. |

## Measurement Plan

Record a baseline before changing balance or adding broad content.

First-run funnel:

- title to run start
- run start to first route commit
- first route commit to first card play
- first card play to first Roost
- first combat completion
- first reward completion
- first district completion

Quality metrics:

- time to first legal action
- invalid clicks before first card resolution
- first combat duration
- reward inspect and pick time
- percent of players who use Cover before first incoming hit
- percent who reach Surge in first three combats
- percent who understand Roost without opening Help
- district and boss death distribution
- run abandon point
- second-run start rate in local playtests

Qualitative questions:

- What did you look at first?
- What did you expect Roost to do?
- How did you know how much damage was coming?
- What made you choose your route?
- Why did you pick or skip the reward?
- What would you try differently next run?

## Do Not Do Yet

- Do not add another large card, enemy, Supply, or Waymark batch.
- Do not add another permanent combat currency or status family.
- Do not solve legibility by adding more permanent text to every screen.
- Do not make every animation faster; preserve first-use and boss drama.
- Do not add power-based meta upgrades that weaken run integrity.
- Do not build daily FOMO systems before the base first-run funnel is measured.
- Do not treat passing simulation targets as proof that route choices are fun.
- Do not treat high-resolution screenshots as proof that portrait mobile works.

## Release Gate For The Next Experience Milestone

The next milestone is ready when:

- essential route and battle art is present before interaction
- a fresh player can finish the first encounter without outside explanation
- combat previews explain incoming and outgoing outcomes accurately
- Flow is understood and visibly drives a short-term goal
- repeated combat beats can run faster without losing event order
- reward inspection preserves comparison between all options
- run telemetry measures total run behavior accurately
- the outcome screen gives the player a specific next-run mastery goal
- portrait mobile is either deliberately supported or deliberately gated
- five observed first-run sessions produce no repeated confusion around route
  confirmation, targeting, Roost, Tells, Cover, or reward skipping

## Implemented Accessibility Follow-Through

Settings now exposes a persistent Standard/High Contrast preference alongside
Motion and Effects. High Contrast applies to the complete game surface before
the opening scene renders and remains active through Menu, Profile, Codex,
Route, Battle, and outcome transitions. It changes presentation only: combat
math, timing, random outcomes, asset selection, and progression are untouched.

The control shares the same pointer, keyboard, and standard-gamepad focus model
as every other Settings row. Browser-storage failure falls back to a session
preference instead of making the control inert. Production comparison captures
at `.artifacts/high-contrast-standard-production.png` and
`.artifacts/high-contrast-high-production.png` show the complete Settings panel
with matching text state and no browser-error artifact.

Settings also provides an opt-in Screen Reader row. When enabled, a hidden
polite live region announces the current menu focus, selected route and core
resources, combat turn/resources, selected card rules and target, reward
choices, Flock Record focus, Codex section, and Settings focus. The channel
uses the same authoritative state exposed by `render_game_to_text`, deduplicates
unchanged summaries, and polls only while enabled. It never changes gameplay,
timing, input locks, balance, or audio. The preference is local, included in
Save Data backups, defaults off, and can be disabled from Menu, Route, or paused
Combat with pointer, keyboard, or standard gamepad controls.

Codex browsing now shares that complete input model. A visible focus ring moves
between sections, collection filters, virtualized entries, Back, and dossier
close controls. Tab and D-pad Up/Down change focus bands; remapped
Previous/Next and D-pad Left/Right navigate within the active band; Confirm/A
opens or closes a dossier; Back/B closes or returns; and entry focus scrolls
into view. The serialized focus label, position, binding hints, and scroll state
drive the same screen-reader announcement, so pointer-free browsing never
depends on hidden internal IDs.

Combat and reward ceremonies now follow the same contract. Remapped
Previous/Next or Tab visibly focuses a hand card or reward; Confirm/A plays or
claims it instead of ending the Beat; Up/Down, D-pad Up/Down, or shoulder
buttons retarget living enemies; and Roost/Y remains an explicit separate
commitment. Gamepad B dismisses selections and overlays or resumes from pause,
while Start pauses combat. A binding-aware focus strip appears only after
keyboard/controller navigation begins, and `combatInputFocus` exposes the
player-facing label, target, position, bindings, and visible-focus state.
Reward narration now identifies the focused Card, Preen, or Waymark choice
instead of announcing only card-reward options.

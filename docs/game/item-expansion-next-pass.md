# Item Expansion Next Pass

This brief defines the next meaningful item pass after the 71-item Codex expansion. The goal is not just "more stuff"; the next pass should add item lanes that create new run decisions, more build identities, and imagegen-ready objects that still feel like Bird Squad title-splash salvage.

## Current Coverage Snapshot

| Area | Current shape | Gap to target |
| --- | --- | --- |
| Supplies | 23 total: 19 combat, 4 either, 0 route-only | Add route-only and either-timing supplies so packing choices matter outside combat. |
| Supply categories | 12 tool, 6 flare, 3 call, 2 snack | Add snack and call items. Tools are healthy. |
| Supply answers | Good cover, anti-Cover, draw, burst, and hand-fix coverage | Add preview, retain, duplicate, protection from enemy intent, supply-slot manipulation, and route risk conversion. |
| Waymarks | 48 total with strong suit/economy/route coverage | Add fewer combat-start stat bumps and more conditional build-around triggers. |
| Waymark triggers | 20 combatStart, 6 onNthCard, small coverage for Supply/Molt/suit/heal | Add triggers for discard, Resonance spend, enemy Cover break, no-damage turns, route choices, and supply acquisition. |
| Art style | Runtime item art now works as transparent pixel-art cutouts | Continue standalone objects with no circles, plaques, frames, or UI backplates. |

## Design Targets

1. Add 8 supplies and 10 Waymarks as the next pass size.
2. Bias supplies toward route/either timing: at least 3 route-only and 2 either-timing items.
3. Add at least 2 snack supplies and 2 call supplies.
4. Add at least 5 Waymarks that trigger outside `combatStart`.
5. Add no more than 2 flat start-of-combat stat Waymarks.
6. Give every new item a short player-facing use case, a crisp mechanical identity, and an imagegen-ready object brief.
7. Prefer verbs that can be covered by the current runtime; add new verbs only when they unlock a distinct build pattern.

## Mechanics To Add

| Mechanic | Type | Why it matters | Runtime work |
| --- | --- | --- | --- |
| Route-only supplies | Supply timing | Lets Supply slots compete with route planning instead of only combat bailout. | Add route use UI or route-node auto-consume hooks. |
| Retain next card | Supply or Waymark | Supports combo decks without raw draw inflation. | New verb: `retainNextDrawn(1)` or `retainHand(1)`. |
| Duplicate next Supply | Waymark | Makes supply builds feel powerful and distinct from card builds. | New mark effect: `repeatNextSupply(1)` with once-per-combat latch. |
| Enemy Cover break trigger | Waymark | Gives Quills/anti-Cover decks a payoff lane. | New trigger: `onEnemyCoverBroken`; effects can reuse `draw`, `gainWingbeat`, `damageAll`. |
| Resonance spend trigger | Waymark | Gives Spark-Caller burst builds persistent identity. | New trigger: `onResonanceSpent`; effects can reuse `gainCover`, `draw`, `gainOpenSkyGuard`. |
| No-damage turn trigger | Waymark | Rewards defensive Nest/Basin lines without being a flat combat-start bonus. | New trigger: `onTurnEndNoHpLoss`. |
| Scout/preview reward | Supply | Route-control utility with high agency and low combat power creep. | New route verb: `peekNextNodes(1)` or `rerollNodeReward(1)`. |
| Supply-slot manipulation | Supply/Waymark | Makes Supplies a build lane instead of two incidental consumables. | New route/combat verbs: `refillSupply(random)`, `increaseSupplySlots(1)` with cap audit. |

## Proposed Supplies

| ID | Name | Category | Rarity | Timing | Effects | Role | Visual brief |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `map_sticker_strip` | Map Sticker Strip | call | common | route | `peekNextNodes(1)` | Route scout. See one upcoming route fork before choosing. | A strip of tiny neon route stickers, half peeled from wax paper, with arrows, rooftop marks, and one red thread tab. |
| `thermos_lid` | Thermos Lid | snack | common | either | `healCohesion(5)`, `gainOpenSkyGuard(1)` | Small sustain that also softens exposed routes. | A dented teal thermos cap filled with warm seed broth, steam curling around a tiny spoon and safety-pin handle. |
| `bus_token_cache` | Bus Token Cache | call | uncommon | route | `gainScrap(15)`, `gainSupplyChoice(1)` | Route economy conversion if a slot is open. | Three brass transit tokens tied in a red cord bundle, one stamped with a wing, glowing with city-platform reflections. |
| `chalk_dust_pouch` | Chalk Dust Pouch | tool | uncommon | combat | `removeCover(6)`, `draw(1)` | Anti-Cover tempo without pure damage. | A small black pouch spilling pale blue chalk dust, clipped to a climbing buckle and scratched roof tile. |
| `market_iou` | Market IOU | call | rare | route | `freePreenNextDistrict(1)`, `loseCohesion(2)` | Risky future deck cleanup. | A waterproof IOU slip folded around a brass tally charm, red string seal, and oily market ink. |
| `sky_sugar` | Sky Sugar | snack | rare | combat | `gainWingbeat(1)`, `draw(1)`, `nextTurnDraw(1)` | Fast combo fuel without direct damage. | A cracked candy tin of bright amber sugar crystals with a tiny feather scoop and electric-blue wrapper scraps. |
| `anchor_threader` | Anchor Threader | tool | uncommon | combat | `gainCover(5)`, `retainHand(1)` | Defensive combo setup. | A curved needle threaded with black anchor cord, wrapped around a green-taped micro spool and brass washer. |
| `spare_pocket` | Spare Pocket | tool | rare | route | `increaseSupplySlots(1)` | Build-defining supply capacity upgrade for one district or run. | A stitched navy harness pocket with orange zipper teeth, clipped-on bottlecap tag, and bright fabric patches. |

## Proposed Waymarks

| ID | Name | Family | Rarity | Trigger | Effect | Build lane | Visual brief |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `broken_cover_chime` | Broken Cover Chime | route | uncommon | `onEnemyCoverBroken` | `draw(1)` | Anti-Cover payoff for Quills/tools. | A cracked brass wind chime made from wire snips and bottlecaps, tied to a black cord with cyan chalk dust. |
| `spark_ground_clip` | Spark Ground Clip | suit | rare | `onResonanceSpent` | `gainCover(5)` | Spark burst protection. | A tiny alligator clip biting a teal battery plate, gold-blue arcs grounding into a washer charm. |
| `quiet_roost_token` | Quiet Roost Token | safety | uncommon | `onTurnEndNoHpLoss` | `heal(2)` | Defensive sustain loop. | A flat rubber roost pad stamped with a faded wing, rain-dark edges, and one soft green bead. |
| `double_packed_buckle` | Double-Packed Buckle | economy | rare | `onSupplyUsed` | `repeatNextSupply(1)`, `gainWingbeat(1)` | Supply build centerpiece that converts packing into immediate card-play tempo. | A heavy two-slot harness buckle with mirrored brass teeth, red pull cords, and a tiny market seal. |
| `ledger_tab` | Ledger Tab | economy | common | `afterMarketPurchase` | `gainScrap(8)` | Market snowball with small rebates. | A small black ledger tab with gold tally marks, clipped to a torn receipt and coin washer. |
| `basin_safety_pin` | Basin Safety Pin | suit | uncommon | `onHealFlock` | `cleanseFlock(1)` | Healing also clears pressure. | A blue enamel safety pin threaded through cloth wrap, with a water bead and tiny white feather tag. |
| `nest_measure_line` | Nest Measure Line | suit | rare | `onSuitPlayed(nests)` | `retainHand(1)` | Nest setup and brace planning. | A retractable tape line in a scratched green case, orange measurement marks, and a hook shaped like a talon. |
| `plumes_applause_cap` | Plumes Applause Cap | suit | uncommon | `onNthCardThisTurn(4)` | `gainResonance(2)` | High-action Plumes payoff. | A purple bottlecap badge with gold wing embroidery, stage-thread tassel, and a tiny spark mark. |
| `molt_shadow_tag` | Molt Shadow Tag | molt | rare | `onEnterMolt` | `reduceNextOpenSky(2)` | Molt safety without pure draw. | A dark translucent luggage tag holding one pale pinfeather, edged with orange hazard stitching. |
| `cache_divining_hook` | Cache Divining Hook | economy | rare | `cacheChoice` | `gainSupplyChoice(1)` | Cache nodes become supply engines. | A bent copper hook tied to a glowing blue bead strand, pointing toward a tiny hidden cache mark. |

## Implementation Notes

The cleanest implementation order:

1. Add route-use support for supplies, or deliberately constrain this pass to `combat` and `either` until route supply UI exists.
2. Add the smallest useful new trigger batch: `onEnemyCoverBroken`, `onResonanceSpent`, `onTurnEndNoHpLoss`, `afterMarketPurchase`.
3. Add the smallest useful new verb batch: `peekNextNodes`, `retainHand`, `repeatNextSupply`, `increaseSupplySlots`.
4. Add data entries with imagegen-ready `visualBrief` fields before generating art.
5. Generate art in sheets: 4x2 for supplies, 5x2 for Waymarks, chroma-key green background, standalone objects, no border circles.
6. Wire runtime icons into existing `supplyArtAssets` and `waymarkArtAssets`, then verify in Codex, Market, route reward screens, and Battle.

## Test Targets

| Test | What it should prove |
| --- | --- |
| Runtime validation | Data IDs, effect verbs, art asset paths, and item counts are valid. |
| Supply route-use smoke | Route-only supplies can be gained, shown, used, and consumed at the intended route timing. |
| New trigger smoke | Each new Waymark trigger fires once at the intended time and does not double-fire across turns/combats. |
| Supply build smoke | `Double-Packed Buckle` or equivalent actually repeats the next Supply once. |
| Codex smoke | Items count increases, details show mechanics and image briefs, and all new art textures load. |
| Visual QA | New item cutouts render in Codex and market with transparent backgrounds and NEAREST filtering. |

## Recommended Scope For The Next Commit

The best next pass is the "route supply and trigger payoff" pass:

- Add 4 route/either supplies: `Map Sticker Strip`, `Thermos Lid`, `Bus Token Cache`, `Spare Pocket`.
- Add 5 Waymarks: `Broken Cover Chime`, `Spark Ground Clip`, `Quiet Roost Token`, `Double-Packed Buckle`, `Basin Safety Pin`.
- Add only the runtime hooks needed for those 9 items.
- Generate art for only those implemented items, then leave the remaining proposals as backlog.

That scope is large enough to feel like a new item layer but small enough to balance and test without turning every combat hook into a moving target.

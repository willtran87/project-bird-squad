# Bird Squad Imagegen Asset Roadmap

Status: planning document for future image-generation passes.
Last audited: 2026-07-09.

This document turns the current piecemeal art work into a reusable asset backlog. It identifies the screens, systems, and components that should receive image-generated assets when they are expanded or refreshed, gives chroma-key-ready prompt briefs for later production, and includes a concrete prompt pack for the named future candidates.

The current runtime already has broad coverage:

- 244 registered UI icon/chrome assets are present in `assets/runtime/ui/icons/`.
- 51 runtime combat FX files are present in `assets/runtime/fx/`.
- 110 approved card portraits and thumbnails are present in the card art manifest.
- 64 approved enemy full-body runtime assets are present in the enemy art manifest.
- 58 Waymark item icons, 32 Supply/item icons, and 8 route node icons are present.
- Current district backdrops, boss variants, route set pieces, residents, and market kit assets are present.

That means the next imagegen work should usually be one of three things:

1. A new feature/content pack needs matching art.
2. A procedural or fallback-drawn component should graduate into generated art.
3. An existing asset needs a coherent style refresh because the mechanic changed.

## Global Chroma-Key Rules

Use this for transparent UI icons, FX bursts, character/enemy cutouts, residents, props, badges, and frames.

```text
Create the requested subject on a perfectly flat solid #00ff00 chroma-key background for background removal.
The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation.
Keep the subject fully separated from the background with crisp edges and generous padding.
Do not use #00ff00 anywhere in the subject.
No cast shadow, no contact shadow, no reflection, no watermark, and no text unless explicitly requested.
```

Use `#ff00ff` only when the subject itself needs green or teal-green edges. Avoid key colors that appear in the subject.

Default post-process command:

```powershell
python C:\Users\Will\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py `
  --input <source.png> `
  --out <runtime-or-artifact.png> `
  --auto-key border `
  --soft-matte `
  --transparent-threshold 12 `
  --opaque-threshold 220 `
  --despill `
  --edge-contract 1
```

Validate every transparent asset:

- Corners are transparent.
- Alpha channel exists.
- No visible green fringe at edges.
- Subject remains readable at intended in-game size.
- UI text is not baked into the image unless exact text was explicitly requested.
- Runtime asset size passes `npm run validate:runtime-assets`.

Opaque full-screen art such as battlefields, route-event backdrops, and title/menu backgrounds should not use chroma key. Generate those as full rectangular plates.

## Shared Visual Language

All generated assets should match the existing Bird Squad language:

- Modern bird streetwear and practical rooftop/canal field gear.
- Dark navy, blackened steel, aged brass, teal/cyan glass, magenta/purple enamel, warm cream highlights.
- Pixel-painterly or high-resolution painterly detail with strong silhouettes.
- Grounded materials: straps, buckles, rope, feathers, card stock, glass, rivets, repaired metal, rain-wet roof surfaces, canal-market objects.
- No fantasy spell circles unless translated into physical signage, signal hardware, lens glass, enamel seals, or bird-world tools.
- No legible text inside generated art unless the prompt supplies exact text verbatim.

## Priority Map

| Priority | Pack | Why |
| --- | --- | --- |
| P0 | New mechanics and status effects | Prevent new gameplay from falling back to rectangles, generic particles, or reused FX. |
| P0 | New cards, enemies, Waymarks, and Supplies | Content should not ship without matching art and codex/reward support. |
| P1 | Procedural combat micro-FX refresh | Some effects still rely on generated shapes, particles, and line graphics. |
| P1 | Battlefields and route-event variants | Adds contextual freshness without changing game rules. |
| P1 | Boss and elite presentation | High-impact moments should get bespoke art reads. |
| P2 | UI chrome variants | Current UI coverage is broad; future work should be tied to new panels/screens. |
| P2 | Title/profile/codex expansions | Generate only when new categories, leaders, records, or unlocks are added. |

## Asset Pack Briefs

### 1. New Card Art Pack

Use when adding new cards or replacing cards whose mechanics changed enough that the current art no longer reads.

Runtime targets:

- `assets/runtime/cards/portrait/<card_id>.webp`
- `assets/runtime/cards/thumb/<card_id>.webp`
- `assets/runtime/cards/card-art-manifest.json`

Chroma key: no. Card art is an opaque rectangular image composed into a card frame.

Prompt brief:

```text
Use case: stylized-concept
Asset type: Bird Squad card portrait
Primary request: <card name and mechanic read>
Scene/backdrop: grounded rooftop/canal-city setting that matches the suit and map context
Subject: bird as the active agent performing the mechanic, not a passive emblem
Style/medium: high-resolution painterly card art, modern bird streetwear, grounded urban fantasy without magic effects
Composition/framing: vertical 2:3 portrait, clear focal bird silhouette, readable action at card size
Lighting/mood: jewel-toned city lighting, cyan rim light, warm brass highlights
Color palette: suit accent only as a secondary cue; keep overall palette grounded
Constraints: no card border, no title text, no watermark, no extra birds unless implied by the card
Avoid: floating magical objects, ornate fantasy robes, unreadable tiny action
```

Known future refresh candidates from mechanics:

- `swords_04` / Sheathed Quills: show cover stripping or disarming.
- `swords_08` / Quill Ring: show pressure slipping around Cover.
- `swords_elder` / Quill Elder: show veteran precision through defenses.

### 2. Enemy and Boss Cutout Pack

Use when adding enemies, replacing low-readability enemy art, or giving bosses/elite variants stronger silhouettes.

Runtime targets:

- `assets/concept-art/enemies/sources/<enemy_id>-source-v1.png`
- `assets/runtime/enemies/full/<enemy_id>.webp`
- `assets/runtime/enemies/reserve/<enemy_id>.webp` when the enemy is reserve-only
- `assets/runtime/enemies/enemy-art-manifest.json`

Chroma key: yes, default `#00ff00`.

Prompt brief:

```text
Use case: stylized-concept
Asset type: transparent enemy combat cutout
Primary request: <enemy name>, <species>, <combat role>, <district>
Subject: full-body enemy in a readable 3/4 combat stance, silhouette clear at 180-260 px tall
Style/medium: painterly high-resolution game character cutout, modern rooftop/canal streetwear
Composition/framing: full body visible, centered, generous padding, no crop
Lighting/mood: cyan rim light and warm brass highlights, grounded urban combat mood
Materials/textures: practical straps, patched cloth, metal tools, district-specific gear
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no floor shadow, no background props, no text, no watermark, do not use #00ff00 in the subject
Avoid: generic fantasy armor, cute mascot posing, tiny weapons that do not read
```

Component needs:

- Standard enemy full-body cutout.
- Elite/boss overpaint variant with stronger crest, extra equipment, or damaged district props.
- Optional codex portrait crop if the full combat pose does not read in codex panels.
- Role-specific silhouettes: blocker, healer/repairer, tempo taxer, pressure dealer, boss commander.

Specific future candidates:

- `gutter_baron`: emphasize barricade pressure and Wingbeat tax.
- `tar_crowned_crow`: emphasize command presence and route control.
- New healer/repair enemy for Maps 2-3.

### 3. Flock Leader and Costume Pack

Use when adding leaders, alternate leader skins, leader unlock panels, or codex leader updates.

Runtime targets:

- `assets/runtime/flock/leaders/<leader>-combat-back-ne.webp`
- `assets/runtime/flock/leaders/<leader>-combat-front-3q.webp`

Chroma key: yes, default `#00ff00`.

Prompt brief:

```text
Use case: stylized-concept
Asset type: transparent flock leader character cutout
Primary request: <leader name>, <species>, <role fantasy>, <unlock or combat context>
Subject: full-body bird leader with modern fieldwear, readable species silhouette, practical gear
Style/medium: painterly high-resolution game character cutout matching existing leader art
Composition/framing: full body visible, centered, generous padding; produce back-facing NE combat pose or front 3/4 codex pose as requested
Lighting/mood: cyan rim light, warm brass highlights, rain-polished rooftop mood
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no cast shadow, no text, no watermark, no background scene
Avoid: humanized hands, fantasy robes, abstract magic, pose mismatch with existing leaders
```

Components:

- Combat back/NE pose for battle.
- Front 3/4 codex/title pose.
- Optional leader selection portrait badge or unlock vignette.

### 4. Combat FX Expansion Pack

Use when adding a new resource, status, keyword, card effect family, enemy intent family, or boss phase.

Runtime targets:

- `assets/concept-art/fx/sources/<fx-id>-source-v1.png`
- `assets/runtime/fx/<fx-id>.webp`

Chroma key: yes, default `#00ff00`. Use no soft smoke or translucent glass unless prepared to validate carefully.

Prompt brief:

```text
Use case: stylized-concept
Asset type: transparent combat FX sprite
Primary request: <effect name> for <gameplay moment>
Subject: physical Bird Squad effect made from enamel, brass, feathers, card shards, signal glass, or rooftop debris
Style/medium: high-resolution painterly game FX, crisp silhouette, no background
Composition/framing: centered sprite with generous transparent padding, readable at <intended display size>
Lighting/mood: bright contact highlights, cyan/magenta accents, warm brass sparks
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no text, no watermark, no cast shadow, do not use #00ff00 in subject
Avoid: blurry smoke clouds, pure neon magic, large dark blobs that hide gameplay
```

Current asset-backed FX families exist, but these are the likely future gaps:

| Component | When To Generate | Description |
| --- | --- | --- |
| `combat-overextension-warning` | If overextension gets a dedicated moment | Strained feather harness ring, cracked red/orange enamel, clear warning silhouette. |
| `combat-boss-phase-break` | Boss phase transitions | Large fractured district seal, boss-colored enamel, screen-center readable but transparent. |
| `combat-perfect-chain` | Combo/sequence bonuses | Interlocking brass card links with cyan pulse, long horizontal sprite. |
| `combat-status-cleanse-specific` | If Cleanse branches by status | Small status-specific shatter icons for Fouled/Winded/Open Sky. |
| `combat-open-sky-break` | Open Sky exposed damage spike | Broken roofline guard and wind slash, distinct from `combat-open-sky-exposure`. |
| `combat-cache-choice-reveal` | Cache Waymarks grant extra choices | Lockbox lids snapping open, multiple tagged bundles. |
| `combat-molt-trigger-choice` | New Molt-specific rewards | Feather-shed silhouette with brass hinge and clean before/after read. |
| `combat-enemy-heavy-contact` | Boss or elite attacks | Larger contact burst than standard enemy hit, anchored on flock, no text. |
| `combat-enemy-heal-beam` | Repair/healer enemy | Tool-lamp arc and threaded brass repair line, not magic green beam. |
| `combat-resource-overcap` | Resource cap or overflow moments | Gauge spilling cyan/amber pips into a catch tray. |

Procedural micro-FX that can graduate later:

- `MENU_SOFT_MOTE_TEXTURE`: currently generated from simple graphics.
- `COMBAT_FX_PARTICLE_TEXTURE`: currently an 8x8 generated particle.
- Pulse rings, spark bursts, strike lines, and route-line graphics drawn with Phaser graphics.
- Vignette/treatment overlays for boss/rival/standard battlefield moods.

### 5. Combat UI and HUD Chrome Pack

Use only when adding new combat panels or replacing a procedural fallback. The existing combat HUD already has generated assets for core frames.

Runtime targets:

- `assets/runtime/ui/icons/combat-*.png`

Chroma key: yes, default `#00ff00`.

Prompt brief:

```text
Use case: stylized-concept
Asset type: transparent combat UI frame
Primary request: <component name> for the Bird Squad combat HUD
Subject: dark metal/brass/cyan/magenta UI hardware frame with practical rooftop construction
Style/medium: painterly game UI chrome, crisp edges, transparent cutout
Composition/framing: exact frame orientation, generous padding, empty center where game text/UI will be drawn
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no baked text, no logos, no watermark, do not use #00ff00 in the frame
Avoid: filled opaque centers unless the component is meant to be a backing plate
```

Existing combat component families:

- Top HUD rail, Cohesion gauge, incoming forecast, beat progress, metric chips, suit keystone chips.
- Hand rail, hand card frame, selected pulse.
- Enemy vitals/status, intent ring, elite crest, encounter plaque.
- Combat log frame and event bead.
- Pile dock, pile review, row, counters, stat chips, page indicators, scroll controls.
- Tooltip frame, supply feedback, waymark feedback, stats tally, Roost command frame.

Future component candidates:

| Component | Reason |
| --- | --- |
| `combat-intent-detail-card-frame` | If enemy intent hover previews become richer than the current tooltip. |
| `combat-status-stack-frame` | If enemies/flock can carry many statuses and need a compact stack UI. |
| `combat-boss-phase-meter-frame` | Boss encounters need phase-specific HUD weight. |
| `combat-cache-choice-panel-frame` | Cache-control Waymarks can show extra choices cleanly. |
| `combat-tutorial-callout-frame` | First-run combat teaching should not use generic overlay chrome. |

### 6. Route Map and District Travel Pack

Use when adding map node types, route choice variants, district transitions, or route-specific overlays.

Runtime targets:

- `assets/runtime/map-icons/icons/<node_type>.webp`
- `assets/runtime/ui/icons/route-*.png`
- `assets/runtime/fx/route-*.webp`
- `assets/runtime/backdrops/<route-map-or-board>.webp`

Chroma key:

- Node icons, medallions, rings, route badges, streaks: yes.
- Route map boards/backdrops: no, opaque.

Prompt brief for transparent route components:

```text
Use case: stylized-concept
Asset type: transparent route map UI component
Primary request: <node/icon/frame/effect name>
Subject: physical route-planning hardware made from brass, enamel, card-stock, pins, wire, and rooftop map marks
Style/medium: painterly game UI icon/chrome, clear at 48-120 px
Composition/framing: centered object, generous padding, no background
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no text, no watermark, do not use #00ff00 in subject
Avoid: generic GPS symbols, fantasy runes, flat app icons
```

Current route component families:

- Route node icon atlas/types: street, rival, boss, basin, nest, market, signal, cache.
- Route map frame/backing, selected node ring, risk meter, commit tooltip, route commit streak.
- Route resource medallions: neutral, commit, open sky, scout, control, preen, supply, waymark, card, release, snag, rival, scrap, cohesion, cover.
- District advance banner/flourish/title plaque.
- Boss prep dossier, readiness chip, pressure plaque, signal module, route-for plate.

Future component candidates:

| Component | Reason |
| --- | --- |
| `route-node-event-medallion` | Add if non-battle node types expand beyond the current five set pieces. |
| `route-node-danger-forecast-ring` | More readable risk preview around high-danger routes. |
| `route-branch-lock-frame` | For route choices blocked by supplies, marks, or boss prep. |
| `district-map-transition-strip` | Visual bridge between districts instead of generic fade. |
| `route-cache-extra-choice-badge` | Explicit read for cache-control Waymarks. |

### 7. Route Event Set Piece Pack

Use when adding new non-battle encounters or refreshing existing event scenes.

Runtime targets:

- `assets/runtime/route-events/<scene>.webp` for opaque scene plates.
- `assets/runtime/route-events/<resident>.webp` for transparent residents.
- `assets/runtime/route-events/props/<prop>.webp` for transparent or isolated props.

Chroma key:

- Backdrop scene plates: no.
- Residents and isolated props: yes.

Prompt brief for opaque scene plate:

```text
Use case: stylized-concept
Asset type: opaque route-event scene plate
Primary request: <event name> landmark scene
Scene/backdrop: <district>, <centerpiece>, compact UI-safe landmark composition
Subject: empty or lightly occupied landmark with clear negative space for overlay UI
Style/medium: painterly Bird Squad set-piece background, modern rooftop/canal streetwear world
Composition/framing: 16:9 scene plate, strong focal centerpiece, no important detail under likely UI panels
Lighting/mood: jewel-toned night city lighting, rain sheen, warm brass practical lights
Constraints: no readable text, no watermark, no UI baked into the image
Avoid: generic fantasy shop, cluttered composition, tiny focal object
```

Prompt brief for resident cutout:

```text
Use case: stylized-concept
Asset type: transparent route-event resident cutout
Primary request: <resident name>, <species>, <role>, <fashion>
Subject: full-body bird resident with clear silhouette and role-specific outfit
Style/medium: painterly character cutout matching Bird Squad resident art
Composition/framing: full body visible, centered, generous padding, friendly landmark host pose
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no cast shadow, no text, no watermark, do not use #00ff00 in subject
Avoid: combat pose unless this is a rival, generic fantasy merchant clothing
```

Current set pieces:

- Lantern Roost: Sella Warmwick, golden weaver finch, heated brass roost hearth.
- Rooftop Cache: Marn Valeclip, hooded crow, sealed pulley cache cabinet.
- Signal Landmark: Ivo Tallymast, kestrel, illuminated switchboard route map.
- Featherwright Studio: Oren Shearbright, pileated woodpecker, grooming chair and feather press.
- Rival Wager: Caldra Pinion, peafowl, contract case and prize board.
- Market: Veyra/market kit starling shopkeeper language; do not reuse this species/silhouette for new residents.

Future component candidates:

- New district-specific resident variants for later maps.
- Alternate event plate when a Waymark changes a node outcome.
- Cache expanded-choice prop art.
- Preen/remove/route-plan service props if market services need staged visuals.

### 8. Market and Service Pack

Use when adding services, market vendors, shop states, or offer types.

Runtime targets:

- `assets/runtime/market-kit/*.webp` for opaque market scene/layers.
- `assets/runtime/ui/icons/market-*.png` for service buttons, price frames, badges, crates.

Chroma key:

- Vendor cutouts, service icons, crates, badges, offer trays: yes.
- Full market background: no.

Prompt brief:

```text
Use case: stylized-concept
Asset type: transparent market UI/service asset
Primary request: <service or market component name>
Subject: canal-market object that clearly communicates <buy/refresh/preen/remove/route plan/boss rigging>
Style/medium: painterly item icon or UI chrome, practical market hardware
Composition/framing: centered object or empty-center frame, readable at HUD size
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Lighting/mood: warm vendor light, cyan rim highlights, brass and teal enamel
Constraints: no baked text, no watermark, do not use #00ff00 in subject
Avoid: generic shopping carts, flat app icons, modern retail signage
```

Current market component families:

- Offer tray, detail dossier, enamel commands, service button, item label, card price tag, sold slat, object backplate, section header, vendor title plaque.
- Market badges/services: Waymark badge, Preen service, Remove service, Refresh service, Boss rigging service, Route plan service, Purchase flourish, Price chip, Supply crate.

Future component candidates:

- `market-trade-service` for exchanging supplies/cards.
- `market-repair-service` if durability or broken-card mechanics arrive.
- `market-rumor-service` if scouting/route info is sold.
- `market-discount-token` if price manipulation gets a visible state.

### 9. Reward Ceremony Pack

Use when adding new reward types, ceremonies, unlock flows, or choice affordances.

Runtime targets:

- `assets/runtime/ui/icons/reward-*.png`
- `assets/runtime/ui/icons/progression-*.png`

Chroma key: yes, default `#00ff00`.

Prompt brief:

```text
Use case: stylized-concept
Asset type: transparent reward ceremony UI asset
Primary request: <reward component name>
Subject: celebratory but grounded Bird Squad object, brass/enamel/card-stock construction
Style/medium: painterly game UI chrome or FX sprite
Composition/framing: centered, generous padding, clear empty center if it is a frame
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Lighting/mood: warm reward glow, cyan rim light, subtle magenta accents
Constraints: no baked text, no watermark, do not use #00ff00 in subject
Avoid: confetti overload, generic treasure chest, pure fantasy magic
```

Current reward component families:

- Header plaque, deck-need chip, skip command frame.
- Choice card frame, glow burst, hover ring, spotlight.
- Badges: card, Waymark, supply, Preen, heal, Scrap.
- Spark burst, reveal halo, ceremony backdrop.
- Progression unlock flourish and unlock badge.

Future component candidates:

- `reward-molt-badge` for Molt-trigger rewards.
- `reward-cache-expanded-choice-frame` for extra cache choices.
- `reward-boss-relic-frame` for boss-exclusive Waymarks.
- `reward-leader-unlock-medallion` if unlock presentation becomes richer.

### 10. Deck Review, Card Picker, Codex, Profile, and Records Pack

Use when adding new information panels, tabs, categories, profile records, or codex filters.

Runtime targets:

- `assets/runtime/ui/icons/card-picker-*.png`
- `assets/runtime/ui/icons/deck-review-*.png`
- `assets/runtime/ui/icons/codex-*.png`
- `assets/runtime/ui/icons/profile-*.png`
- `assets/runtime/ui/icons/record-*.png`

Chroma key: yes, default `#00ff00`.

Prompt brief:

```text
Use case: stylized-concept
Asset type: transparent information UI chrome
Primary request: <panel/tab/row/chip/category medallion>
Subject: dark metal, brass, teal glass, and magenta enamel UI hardware matching Bird Squad information screens
Style/medium: painterly game UI frame or medallion
Composition/framing: empty-center frame or centered medallion as requested, generous padding
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no baked text, no watermark, do not use #00ff00 in subject
Avoid: dense decoration that competes with small text
```

Current component families:

- Card picker frame, scroll buttons, cost badge, page indicator, nameplate, context plaque.
- Deck review flourish, rows, page indicators, title plaque, detail frame, cost badge, meta chip, section tabs.
- Codex dossier, entries, art preview, back/close commands, tabs, scroll cues, category medallions.
- Profile record flourish, title plaque, stat chips, row frames, section tabs, progress rail/fill, return command.
- Record, achievement, help, settings, pause, start-run, ascension medallions.

Future component candidates:

- New codex category medallions if mechanics expand.
- Profile achievement-tier frames.
- Search/filter chips if codex grows.
- Compare/deck-delta frames if deck review gets richer.

### 11. System, Settings, Help, and Overlay Pack

Use when adding new system controls, settings rows, accessibility toggles, or tutorial panels.

Runtime targets:

- `assets/runtime/ui/icons/system-*.png`
- `assets/runtime/ui/icons/how-to-play-*.png`
- `assets/runtime/ui/icons/confirm-exit-*.png`
- `assets/runtime/ui/icons/overlay-*.png`

Chroma key: yes, default `#00ff00`.

Prompt brief:

```text
Use case: stylized-concept
Asset type: transparent system overlay UI chrome
Primary request: <overlay/settings/help component>
Subject: sober Bird Squad system hardware, dark panel materials, brass trim, cyan active accents
Style/medium: painterly game UI chrome with clean empty areas for Phaser text
Composition/framing: exact orientation for row/frame/button/toggle, generous padding
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no baked text, no watermark, do not use #00ff00 in subject
Avoid: decorative clutter, tiny labels, smartphone-app flat controls
```

Current component families:

- System menu command frame, field command frame, overlay title plaque.
- Settings row, toggle, volume slider, motion switch.
- Pause detail row, confirm-exit frame/command.
- How-to-play guide frame, topic card frame, tip row frame.
- Overlay panel flourish and close command frame.

Future component candidates:

- `system-settings-keybind-row-frame` if remapping controls is added.
- `system-settings-accessibility-chip-frame` for colorblind/contrast modes.
- `how-to-play-keycap-medallion` if keyboard/controller teaching needs icons.
- `system-save-slot-frame` if run profiles expand.

### 12. Title, Leader Select, and Run Start Pack

Use when adding title variants, new leaders, new ascension states, or launch animations.

Runtime targets:

- `assets/runtime/ui/icons/title-*.png`
- `assets/runtime/fx/title-*.webp`
- `assets/runtime/ui/icons/leader-*.png`
- `assets/splash/*.webp` for opaque title backgrounds.

Chroma key:

- UI chrome, leader badges, launch flourish: yes.
- Full splash/title background: no.

Prompt brief:

```text
Use case: stylized-concept
Asset type: transparent title/menu UI asset
Primary request: <title/leader/start component name>
Subject: premium Bird Squad title-screen hardware with brass, teal glass, magenta enamel, and card-table materials
Style/medium: painterly game UI chrome or FX flourish
Composition/framing: centered object/frame with empty text area where needed
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no baked text unless exact logo/text is requested, no watermark, do not use #00ff00 in subject
Avoid: marketing-page hero layout, generic fantasy menu ornament
```

Current component families:

- Title utility command frame, leader card frame, selected flourish, tooltip frame, start command frame.
- Home command dais, logo backplate, leader header, ascension plaque/value/stepper/status strip.
- Leader select/lock/ready/record medallions.
- Start-run, achievement, record, help, settings medallions.
- Title run launch flourish.

Future component candidates:

- New leader unlock celebration assets.
- Seasonal/title background variants.
- Ascension capstone plaque or tier transition flourish.

### 13. Waymark, Supply, and Item Icon Pack

Use when adding new Waymarks, Supplies, Scrap variants, or item-based rewards.

Runtime targets:

- `assets/runtime/waymarks/icons/<waymark_id>.webp`
- `assets/runtime/supplies/icons/<supply_id>.webp`

Chroma key: yes, default `#00ff00`.

Prompt brief:

```text
Use case: stylized-concept
Asset type: transparent Bird Squad item icon
Primary request: <item name> that communicates <mechanic>
Subject: single physical rooftop/canal object, strong silhouette, mechanic-specific prop read
Style/medium: high-resolution pixel-painterly item icon, readable at 32-64 px
Composition/framing: centered 3/4 object, generous padding, no background
Lighting/mood: cyan rim light, warm brass highlights, dark navy shadows
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Materials/textures: worn brass, teal glass, stitched cloth, rope, feathers, card stock, patched metal as appropriate
Constraints: no text, no watermark, do not use #00ff00 in subject
Avoid: generic flat icons, coins for every economy item, tiny mechanical details that vanish at 32 px
```

Future/refresh candidates:

- `cache_hook`: hook lifting multiple cache lids or tagged bundles.
- `roofline_compass`: rare route-planning tool, not generic Scrap economy.
- `sky_safe_harness`: reinforced boss-ready harness/plates.
- `reopened_roofline`: opened route sign plus repair/preening marks.
- New Molt, cache-control, boss, or route-risk Waymarks.

### 14. Battlefield and District Variant Pack

Use when adding districts, map moods, boss versions, market/workshop variants, or high-value route-node variants.

Runtime targets:

- `assets/runtime/backdrops/<district>.webp`
- `assets/runtime/backdrops/variants/<district>-<variant>-v1.webp`

Chroma key: no. These are opaque 16:9 background plates.

Prompt brief:

```text
Use case: stylized-concept
Asset type: opaque battle backdrop
Primary request: <district/variant> Bird Squad combat battlefield
Scene/backdrop: <district location>, wide rooftop/canal battlefield with clear left and right combat staging zones
Subject: readable urban battlefield with enough empty floor/air for flock, enemies, HP bars, combat log, and FX
Style/medium: high-resolution painterly environment, grounded modern rooftop/canal city
Composition/framing: 16:9, horizon and focal details kept out of HUD-critical areas, no central clutter where combat log sits
Lighting/mood: rainy night, jewel-toned lights, cyan and warm brass accents
Constraints: no text, no logos, no watermark, no characters baked into combat staging zones
Avoid: overly dark details, busy foreground, strong focal object behind enemy HP bars
```

Current districts and variants:

- Rooftop Blocks, Canal Markets, Signal Spires, High Roost.
- Boss variants for each district.
- Utility variants: cache billboard, supply market, signal relay, workshop prep.

Future candidates:

- Route-node-specific combat variants for cache/signal/nest/market streets.
- Elite encounter variants.
- Weather/time variants that preserve gameplay readability.
- District transition plates.

### 15. Procedural Fallback Graduation Pack

Use this when replacing code-drawn graphics with art assets after the mechanics settle.

Current procedural/fallback categories:

- Menu soft mote texture.
- Combat pixel particle texture.
- Spark burst/pulse ring/strike lines using Phaser graphics.
- Battlefield treatment overlays for boss/rival/standard moods.
- Some UI fallback rectangles/circles still exist as safety paths for frames that already have assets.
- Shared panel helper in `src/game/theme.ts` still draws panels procedurally by design.

Candidate asset briefs:

| Component | Chroma | Description |
| --- | --- | --- |
| `menu-soft-mote-sheet` | Yes | Small translucent dust/light motes in teal, amber, and magenta; replace single procedural mote. |
| `combat-spark-particle-sheet` | Yes | 8-16 tiny shard particles: feather chip, brass fleck, teal glass mote, magenta enamel shard. |
| `combat-pulse-ring-sheet` | Yes | 4 ring styles: cover, danger, healing, resonance; empty centers, transparent padding. |
| `battlefield-boss-vignette-strip` | Yes | Transparent edge overlay strip with red/orange threat treatment, no opaque center. |
| `battlefield-rival-vignette-strip` | Yes | Transparent edge overlay strip with wager/magenta pressure treatment. |
| `system-panel-corner-kit` | Yes | Reusable panel corners/rails if the procedural panel helper needs an art upgrade. |

Generic prompt:

```text
Use case: stylized-concept
Asset type: transparent procedural-FX replacement sheet
Primary request: <component name> for Bird Squad
Subject: multiple small variations of <particle/ring/overlay/corner> arranged with generous spacing
Style/medium: painterly game FX/UI parts, crisp silhouettes, transparent-ready
Composition/framing: sprite-sheet style layout with isolated elements and no overlap
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no text, no watermark, no cast shadows, do not use #00ff00 in subject
Avoid: foggy edges that fail chroma key, dense texture that cannot be isolated
```

## Ready-To-Generate Prompt Pack

These prompts are intentionally concrete enough to paste into image generation with the built-in chroma-key workflow. For transparent assets, generate the source PNG, preserve it under the listed source path, remove the key with the default command above, then crop/downsample into the runtime path.

### Card Refresh Prompts

#### `swords_04` / Sheathed Quills

Source: `assets/concept-art/cards/sources/swords_04-source-v2.png`
Runtime: `assets/runtime/cards/portrait/swords_04.webp` and `assets/runtime/cards/thumb/swords_04.webp`
Chroma key: no
Target size: vertical 2:3 opaque card portrait

```text
Use case: stylized-concept
Asset type: Bird Squad card portrait
Primary request: Sheathed Quills card art showing a Quills bird stripping enemy Cover without direct magical effects
Scene/backdrop: rain-dark rooftop service lane with repaired metal barriers and loose cable guides
Subject: a sharp-eyed black-and-white bird in practical streetwear sliding a sheathed quill tool under a hostile shield plate, disarming the defense with controlled precision
Style/medium: high-resolution painterly card art, modern Bird Squad streetwear, grounded rooftop action
Composition/framing: vertical 2:3 portrait, strong bird silhouette, shield-stripping action clear at small card size, no card border
Lighting/mood: cyan rim light, warm brass glints, magenta enamel accents, tense but disciplined
Constraints: no title text, no watermark, no floating magic, no ornate fantasy robes
Avoid: passive emblem composition, tiny unreadable tool detail, generic sword fantasy imagery
```

#### `swords_08` / Quill Ring

Source: `assets/concept-art/cards/sources/swords_08-source-v2.png`
Runtime: `assets/runtime/cards/portrait/swords_08.webp` and `assets/runtime/cards/thumb/swords_08.webp`
Chroma key: no
Target size: vertical 2:3 opaque card portrait

```text
Use case: stylized-concept
Asset type: Bird Squad card portrait
Primary request: Quill Ring card art showing pressure slipping around Cover
Scene/backdrop: narrow rooftop walkway with layered guard rails, rain beads, and utility conduits
Subject: an agile Quills bird in dark field gear threading a ring of small feather-like quill markers around a barricade, creating a precise opening around the defense
Style/medium: high-resolution painterly card art, grounded modern bird-world action
Composition/framing: vertical 2:3 portrait, bird and ring path readable at card size, no card border
Lighting/mood: cool cyan edge light, warm brass marker points, subtle magenta enamel
Constraints: no title text, no watermark, no fantasy spell circle; the ring must read as physical markers and signal hardware
Avoid: pure neon halo, floating magical objects, cluttered background hiding the mechanic
```

#### `swords_elder` / Quill Elder

Source: `assets/concept-art/cards/sources/swords_elder-source-v2.png`
Runtime: `assets/runtime/cards/portrait/swords_elder.webp` and `assets/runtime/cards/thumb/swords_elder.webp`
Chroma key: no
Target size: vertical 2:3 opaque card portrait

```text
Use case: stylized-concept
Asset type: Bird Squad card portrait
Primary request: Quill Elder card art showing veteran precision through defenses
Scene/backdrop: high rooftop command perch overlooking a canal-lit city grid
Subject: an elder Quills bird in worn tactical streetwear calmly aligning brass quill tools through gaps in layered cover plates, demonstrating expert accuracy
Style/medium: high-resolution painterly card art, modern Bird Squad field gear, grounded urban fantasy without magic
Composition/framing: vertical 2:3 portrait, dignified elder silhouette, clear line-of-action through defenses
Lighting/mood: night rain, cyan rim light, warm brass highlights, serious veteran calm
Constraints: no title text, no watermark, no glowing fantasy runes, no passive portrait-only read
Avoid: generic wizard elder, unreadable tiny quills, fantasy robes
```

### Enemy and Boss Prompts

#### `gutter_baron`

Source: `assets/concept-art/enemies/sources/gutter_baron-source-v2.png`
Runtime: `assets/runtime/enemies/full/gutter_baron.webp`
Chroma key: yes, `#00ff00`
Target size: full-body cutout readable at 180-260 px tall

```text
Use case: stylized-concept
Asset type: transparent enemy combat cutout
Primary request: Gutter Baron boss-like pressure enemy emphasizing barricade control and Wingbeat tax
Subject: full-body urban bird crime-boss silhouette in a readable 3/4 combat stance, heavy patched coat, brass toll tags, strapped barricade tools, and a commanding hooked posture
Style/medium: painterly high-resolution game character cutout matching Bird Squad enemies
Composition/framing: full body visible, centered, generous padding, no crop
Lighting/mood: cyan rim light, warm brass highlights, menacing rooftop authority
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no floor shadow, no background props, no text, no watermark, do not use #00ff00 in the subject
Avoid: cute mascot posing, generic fantasy armor, tiny unreadable tax props
```

#### `tar_crowned_crow`

Source: `assets/concept-art/enemies/sources/tar_crowned_crow-source-v2.png`
Runtime: `assets/runtime/enemies/full/tar_crowned_crow.webp`
Chroma key: yes, `#00ff00`
Target size: full-body cutout readable at 180-260 px tall

```text
Use case: stylized-concept
Asset type: transparent enemy combat cutout
Primary request: Tar-Crowned Crow boss commander with route-control presence
Subject: full-body crow enemy in a 3/4 combat-command stance, tar-dark feather crown shape, patched officer coat, route tags, signal baton, and damaged district-map plates strapped to gear
Style/medium: painterly high-resolution game character cutout, grounded Bird Squad rooftop/canal streetwear
Composition/framing: full body visible, centered, broad readable silhouette, generous padding
Lighting/mood: cyan rim light, warm brass and tar-black contrast, hostile command mood
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no cast shadow, no background scene, no text, no watermark, do not use #00ff00 in the subject
Avoid: fantasy crown, magic aura, tiny route symbols that vanish in combat
```

#### `repair_healer_enemy`

Source: `assets/concept-art/enemies/sources/repair_healer_enemy-source-v1.png`
Runtime: `assets/runtime/enemies/full/repair_healer_enemy.webp`
Chroma key: yes, `#00ff00`
Target size: full-body cutout readable at 180-260 px tall

```text
Use case: stylized-concept
Asset type: transparent enemy combat cutout
Primary request: new healer and repair enemy for Maps 2-3
Subject: full-body canal-side repair bird in a readable 3/4 support stance, utility apron, tool-lamp, thread spool, patched satchel, and small brass repair clamps
Style/medium: painterly high-resolution game character cutout, modern rooftop/canal workwear
Composition/framing: full body visible, centered, healer role readable from tools and posture, generous padding
Lighting/mood: cyan rim light, warm work-lamp highlights, practical support mood
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no floor shadow, no background props, no text, no watermark, do not use #00ff00 in the subject
Avoid: green magic healer beam, medical cross icon, fantasy priest clothing
```

### Combat FX Prompts

#### `combat-overextension-warning`

Source: `assets/concept-art/fx/sources/combat-overextension-warning-source-v1.png`
Runtime: `assets/runtime/fx/combat-overextension-warning.webp`
Chroma key: yes, `#00ff00`
Target size: 512x256 transparent sprite

```text
Use case: stylized-concept
Asset type: transparent combat FX sprite
Primary request: overextension warning effect for a risky combat moment
Subject: strained feather harness ring with cracked red-orange enamel, brass stress clips, and small cyan warning glints, clear warning silhouette
Style/medium: high-resolution painterly game FX with crisp edges
Composition/framing: centered horizontal sprite with generous padding, readable at 180-260 px wide
Lighting/mood: hot amber stress highlights, cyan edge glints, urgent but grounded
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no text, no watermark, no cast shadow, do not use #00ff00 in subject
Avoid: generic exclamation icon, pure neon magic, smoky fog edges
```

#### `combat-boss-phase-break`

Source: `assets/concept-art/fx/sources/combat-boss-phase-break-source-v1.png`
Runtime: `assets/runtime/fx/combat-boss-phase-break.webp`
Chroma key: yes, `#00ff00`
Target size: 768x384 transparent sprite

```text
Use case: stylized-concept
Asset type: transparent combat FX sprite
Primary request: boss phase break transition burst
Subject: large fractured district seal made of brass, blackened steel, cyan glass, and boss-colored magenta enamel shards splitting outward from the center
Style/medium: high-resolution painterly game FX, premium boss-transition read
Composition/framing: centered wide sprite, strong middle break, transparent padding, screen-center readable
Lighting/mood: bright contact highlights, warm brass sparks, cyan fracture glow
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no text, no watermark, no cast shadow, do not use #00ff00 in subject
Avoid: magical portal, dark opaque blob, tiny shard details only visible at full size
```

#### `combat-perfect-chain`

Source: `assets/concept-art/fx/sources/combat-perfect-chain-source-v1.png`
Runtime: `assets/runtime/fx/combat-perfect-chain.webp`
Chroma key: yes, `#00ff00`
Target size: 768x192 transparent sprite

```text
Use case: stylized-concept
Asset type: transparent combat FX sprite
Primary request: combo or sequence bonus perfect-chain effect
Subject: interlocking brass card links and feather-shaped clasps carrying a cyan pulse through the chain, with small magenta enamel inlays
Style/medium: high-resolution painterly game FX, crisp UI-combat hybrid
Composition/framing: long horizontal sprite, centered, generous transparent padding, readable at 260-520 px wide
Lighting/mood: confident cyan pulse, warm brass highlights, celebratory but not magical
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no text, no watermark, no cast shadow, do not use #00ff00 in subject
Avoid: fantasy chain lightning, opaque background plate, illegible tiny links
```

#### `combat-status-cleanse-specific`

Source: `assets/concept-art/fx/sources/combat-status-cleanse-specific-source-v1.png`
Runtime: `assets/runtime/fx/combat-status-cleanse-specific.webp`
Chroma key: yes, `#00ff00`
Target size: 768x256 transparent sprite sheet

```text
Use case: stylized-concept
Asset type: transparent combat FX sprite sheet
Primary request: three status-specific cleanse shatter icons for Fouled, Winded, and Open Sky
Subject: three isolated shatter emblems arranged left to right with generous spacing: a tar-splatter clamp breaking for Fouled, a snapped wind strap for Winded, and a cracked roofline guard for Open Sky
Style/medium: high-resolution painterly game FX, crisp silhouettes, transparent-ready
Composition/framing: sprite-sheet style, three separate centered icons with no overlap, each readable at 72-96 px
Lighting/mood: clean cyan highlights, warm brass chips, magenta enamel accents
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no text, no watermark, no cast shadow, do not use #00ff00 in subject
Avoid: green healing magic, blurry smoke, icons touching each other
```

#### `combat-open-sky-break`

Source: `assets/concept-art/fx/sources/combat-open-sky-break-source-v1.png`
Runtime: `assets/runtime/fx/combat-open-sky-break.webp`
Chroma key: yes, `#00ff00`
Target size: 512x384 transparent sprite

```text
Use case: stylized-concept
Asset type: transparent combat FX sprite
Primary request: Open Sky exposed damage spike break effect
Subject: broken roofline guard and wind-slashed brass brace splitting open, with feather chips and sharp cyan air streaks
Style/medium: high-resolution painterly game FX, grounded physical impact
Composition/framing: centered diagonal burst, transparent padding, readable at 120-220 px
Lighting/mood: cold sky-cyan slash light, warm brass fracture points, dangerous exposure mood
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no text, no watermark, no cast shadow, do not use #00ff00 in subject
Avoid: tornado cloud, fantasy magic circle, large dark mass
```

#### `combat-cache-choice-reveal`

Source: `assets/concept-art/fx/sources/combat-cache-choice-reveal-source-v1.png`
Runtime: `assets/runtime/fx/combat-cache-choice-reveal.webp`
Chroma key: yes, `#00ff00`
Target size: 768x384 transparent sprite

```text
Use case: stylized-concept
Asset type: transparent combat FX sprite
Primary request: cache extra-choice reveal effect
Subject: several small brass lockbox lids snapping open with tagged bundles, teal glass pips, card-stock tabs, and warm interior glints
Style/medium: high-resolution painterly game FX, physical cache hardware
Composition/framing: centered wide sprite with multiple separated objects, transparent padding, readable at 220-360 px
Lighting/mood: warm discovery light, cyan rim highlights, subtle magenta tags
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no text, no watermark, no cast shadow, do not use #00ff00 in subject
Avoid: treasure chest fantasy trope, coins everywhere, opaque smoke
```

#### `combat-molt-trigger-choice`

Source: `assets/concept-art/fx/sources/combat-molt-trigger-choice-source-v1.png`
Runtime: `assets/runtime/fx/combat-molt-trigger-choice.webp`
Chroma key: yes, `#00ff00`
Target size: 512x512 transparent sprite

```text
Use case: stylized-concept
Asset type: transparent combat FX sprite
Primary request: Molt-specific choice trigger effect
Subject: feather-shed silhouette with a brass hinge, split before-and-after feather plates, cyan repair seams, and magenta enamel choice markers
Style/medium: high-resolution painterly game FX, crisp symbolic object
Composition/framing: centered square sprite, clear before/after read, generous transparent padding
Lighting/mood: clean transition glow, warm brass hinge highlights, calm transformation mood
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no text, no watermark, no cast shadow, do not use #00ff00 in subject
Avoid: magical cocoon, soft smoke, realistic loose feather fuzz that keys poorly
```

#### `combat-enemy-heavy-contact`

Source: `assets/concept-art/fx/sources/combat-enemy-heavy-contact-source-v1.png`
Runtime: `assets/runtime/fx/combat-enemy-heavy-contact.webp`
Chroma key: yes, `#00ff00`
Target size: 768x256 transparent sprite

```text
Use case: stylized-concept
Asset type: transparent combat FX sprite
Primary request: heavy enemy contact burst for boss or elite attacks
Subject: large grounded impact burst made from brass shards, cracked enamel plates, feather chips, and cyan contact sparks exploding outward from one hit point
Style/medium: high-resolution painterly game FX, crisp silhouette, strong gameplay readability
Composition/framing: wide centered sprite, impact core slightly left of center, transparent padding, readable at 140-280 px wide
Lighting/mood: hot brass core, magenta enamel fragments, teal glass glints, forceful hit mood
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no text, no watermark, no cast shadow, do not use #00ff00 in subject
Avoid: blurry explosion smoke, pure fireball, opaque dark blast
```

#### `combat-enemy-heal-beam`

Source: `assets/concept-art/fx/sources/combat-enemy-heal-beam-source-v1.png`
Runtime: `assets/runtime/fx/combat-enemy-heal-beam.webp`
Chroma key: yes, `#00ff00`
Target size: 768x192 transparent sprite

```text
Use case: stylized-concept
Asset type: transparent combat FX sprite
Primary request: repair/healer enemy support arc
Subject: tool-lamp arc and threaded brass repair line stretching horizontally, with tiny clamp sparks, teal glass lens flares, and warm work-light beads
Style/medium: high-resolution painterly game FX, physical repair hardware rather than magic
Composition/framing: long horizontal sprite, clear directionality, transparent padding, readable at 200-420 px wide
Lighting/mood: warm repair lamp glow, cyan rim glints, practical support mood
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no text, no watermark, no cast shadow, do not use #00ff00 in subject
Avoid: green healing beam, medical symbols, fantasy spell trail
```

#### `combat-resource-overcap`

Source: `assets/concept-art/fx/sources/combat-resource-overcap-source-v1.png`
Runtime: `assets/runtime/fx/combat-resource-overcap.webp`
Chroma key: yes, `#00ff00`
Target size: 512x384 transparent sprite

```text
Use case: stylized-concept
Asset type: transparent combat FX sprite
Primary request: resource cap or overflow moment effect
Subject: brass combat gauge spilling cyan and amber pips into a shallow catch tray, with magenta enamel warning flecks and card-stock tick marks
Style/medium: high-resolution painterly UI-combat FX, crisp object silhouette
Composition/framing: centered object sprite, readable at 96-180 px, generous transparent padding
Lighting/mood: bright overflow glints, warm brass highlights, satisfying surplus mood
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no baked numbers, no text, no watermark, no cast shadow, do not use #00ff00 in subject
Avoid: generic battery icon, coins, liquid spill that keys poorly
```

### Combat UI and Route UI Prompts

#### `combat-intent-detail-card-frame`

Source: `assets/concept-art/ui/icons/sources/combat-intent-detail-card-frame-source-v1.png`
Runtime: `assets/runtime/ui/icons/combat-intent-detail-card-frame.png`
Chroma key: yes, `#00ff00`
Target size: 768x384 transparent frame

```text
Use case: stylized-concept
Asset type: transparent combat UI frame
Primary request: enemy intent hover preview detail card frame
Subject: dark gunmetal and aged-brass dossier frame with teal glass accent slots, magenta enamel pins, and an empty center for live Phaser text
Style/medium: painterly game UI chrome, crisp transparent cutout
Composition/framing: horizontal detail-card frame, empty center, readable edge hardware, generous padding
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no baked text, no icons in the empty center, no watermark, do not use #00ff00 in the frame
Avoid: filled opaque center, ornate clutter competing with small text
```

#### `combat-status-stack-frame`

Source: `assets/concept-art/ui/icons/sources/combat-status-stack-frame-source-v1.png`
Runtime: `assets/runtime/ui/icons/combat-status-stack-frame.png`
Chroma key: yes, `#00ff00`
Target size: 512x192 transparent frame

```text
Use case: stylized-concept
Asset type: transparent combat UI frame
Primary request: compact frame for multiple status icons on enemies or flock
Subject: short brass-and-gunmetal status rail with small empty circular sockets, cyan glass separators, and magenta enamel end caps
Style/medium: painterly game UI chrome, crisp transparent cutout
Composition/framing: compact horizontal rail, empty icon sockets, generous padding, readable at HUD size
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no baked status icons, no text, no watermark, do not use #00ff00 in subject
Avoid: opaque backing slab, dense decoration, fantasy rune sockets
```

#### `combat-boss-phase-meter-frame`

Source: `assets/concept-art/ui/icons/sources/combat-boss-phase-meter-frame-source-v1.png`
Runtime: `assets/runtime/ui/icons/combat-boss-phase-meter-frame.png`
Chroma key: yes, `#00ff00`
Target size: 768x160 transparent frame

```text
Use case: stylized-concept
Asset type: transparent combat UI frame
Primary request: boss phase meter frame for combat HUD
Subject: long heavy brass and blackened-steel meter frame with three empty phase sockets, cyan glass fill channel, and restrained magenta enamel warning marks
Style/medium: painterly game UI chrome, premium boss-HUD hardware
Composition/framing: long horizontal frame with empty center/fill area, generous transparent padding
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no baked numbers, no text, no watermark, do not use #00ff00 in subject
Avoid: one-note red danger bar, filled center, fantasy boss ornament
```

#### `combat-cache-choice-panel-frame`

Source: `assets/concept-art/ui/icons/sources/combat-cache-choice-panel-frame-source-v1.png`
Runtime: `assets/runtime/ui/icons/combat-cache-choice-panel-frame.png`
Chroma key: yes, `#00ff00`
Target size: 768x512 transparent frame

```text
Use case: stylized-concept
Asset type: transparent combat UI frame
Primary request: cache-control choice panel frame
Subject: lockbox-inspired UI panel frame with brass hinges, teal glass latch details, card-stock tabs, and magenta enamel rivets, empty center for live choices
Style/medium: painterly game UI chrome, crisp transparent cutout
Composition/framing: medium rectangular frame, empty center, clean corners, generous padding
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no baked text, no icons in center, no watermark, do not use #00ff00 in subject
Avoid: treasure chest lid covering content, opaque background fill
```

#### `combat-tutorial-callout-frame`

Source: `assets/concept-art/ui/icons/sources/combat-tutorial-callout-frame-source-v1.png`
Runtime: `assets/runtime/ui/icons/combat-tutorial-callout-frame.png`
Chroma key: yes, `#00ff00`
Target size: 768x320 transparent frame

```text
Use case: stylized-concept
Asset type: transparent combat UI frame
Primary request: first-run combat tutorial callout frame
Subject: approachable brass and teal-glass callout frame with a small pointer tab, dark metal supports, and subtle magenta enamel accents
Style/medium: painterly game UI chrome, clean instructional hardware
Composition/framing: horizontal empty-center callout with one small pointer notch, generous transparent padding
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no baked text, no watermark, do not use #00ff00 in subject
Avoid: speech bubble cartoon style, dense decoration, opaque fill hiding gameplay
```

#### `route-node-event-medallion`

Source: `assets/concept-art/ui/icons/sources/route-node-event-medallion-source-v1.png`
Runtime: `assets/runtime/ui/icons/route-node-event-medallion.png`
Chroma key: yes, `#00ff00`
Target size: 256x256 transparent medallion

```text
Use case: stylized-concept
Asset type: transparent route map UI component
Primary request: non-battle route event node medallion
Subject: circular brass route medallion with a folded card-stock event marker, teal glass pin, magenta enamel edge chips, and empty center symbol space
Style/medium: painterly game UI icon, clear at 48-96 px
Composition/framing: centered circular medallion, generous transparent padding
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no text, no watermark, do not use #00ff00 in subject
Avoid: generic calendar or GPS icon, fantasy rune
```

#### `route-node-danger-forecast-ring`

Source: `assets/concept-art/ui/icons/sources/route-node-danger-forecast-ring-source-v1.png`
Runtime: `assets/runtime/ui/icons/route-node-danger-forecast-ring.png`
Chroma key: yes, `#00ff00`
Target size: 384x384 transparent ring

```text
Use case: stylized-concept
Asset type: transparent route map UI component
Primary request: high-danger route forecast ring
Subject: thin warning ring of cracked brass, amber hazard pips, cyan glass ticks, and restrained magenta pressure marks with a completely empty center
Style/medium: painterly game UI ring, crisp transparent cutout
Composition/framing: centered circular ring, empty center, generous padding, readable around route nodes
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no text, no filled center, no watermark, do not use #00ff00 in subject
Avoid: red app notification badge, fantasy aura, smoky glow
```

#### `route-branch-lock-frame`

Source: `assets/concept-art/ui/icons/sources/route-branch-lock-frame-source-v1.png`
Runtime: `assets/runtime/ui/icons/route-branch-lock-frame.png`
Chroma key: yes, `#00ff00`
Target size: 512x256 transparent frame

```text
Use case: stylized-concept
Asset type: transparent route map UI component
Primary request: locked route branch frame
Subject: brass and blackened-steel branch-lock frame with a mechanical latch, small teal lens, card-stock route tabs, and magenta enamel warning chips
Style/medium: painterly game UI chrome, physical route-planning hardware
Composition/framing: horizontal frame with empty middle space for live route text, transparent padding
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no baked lock text, no watermark, do not use #00ff00 in subject
Avoid: generic padlock app icon, opaque center fill
```

#### `district-map-transition-strip`

Source: `assets/concept-art/fx/sources/district-map-transition-strip-source-v1.png`
Runtime: `assets/runtime/fx/district-map-transition-strip.webp`
Chroma key: yes, `#00ff00`
Target size: 1024x256 transparent strip

```text
Use case: stylized-concept
Asset type: transparent route transition FX strip
Primary request: district map transition strip between route regions
Subject: wide strip of route-board hardware, brass map rails, teal signal glass, card-stock district tabs, and rain-polished black metal sliding across the screen
Style/medium: painterly game UI/FX strip, grounded route hardware
Composition/framing: long horizontal strip, transparent top and bottom padding, no opaque center block
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no text, no watermark, do not use #00ff00 in subject
Avoid: generic wipe gradient, fantasy portal, heavy opaque rectangle
```

#### `route-cache-extra-choice-badge`

Source: `assets/concept-art/ui/icons/sources/route-cache-extra-choice-badge-source-v1.png`
Runtime: `assets/runtime/ui/icons/route-cache-extra-choice-badge.png`
Chroma key: yes, `#00ff00`
Target size: 256x256 transparent badge

```text
Use case: stylized-concept
Asset type: transparent route map UI component
Primary request: cache-control extra-choice badge
Subject: compact lockbox badge with two small open lids, stacked card-stock choice tabs, brass rivets, teal glass bead, and magenta enamel accent
Style/medium: painterly game item/UI badge, readable at 32-64 px
Composition/framing: centered badge, strong silhouette, generous transparent padding
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no text, no watermark, do not use #00ff00 in subject
Avoid: treasure chest, coin pile, flat app plus icon
```

### Market, Reward, System, and Item Prompts

#### `market-trade-service`

Source: `assets/concept-art/ui/icons/sources/market-trade-service-source-v1.png`
Runtime: `assets/runtime/ui/icons/market-trade-service.png`
Chroma key: yes, `#00ff00`
Target size: 384x384 transparent icon

```text
Use case: stylized-concept
Asset type: transparent market UI/service asset
Primary request: market trade service icon for exchanging supplies or cards
Subject: two small canal-market trays crossing paths, brass barter tags, teal glass beads, card-stock slips, and a practical swap clasp
Style/medium: painterly item icon, Bird Squad market hardware
Composition/framing: centered 3/4 object, readable at HUD size, generous padding
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Lighting/mood: warm vendor light, cyan rim highlights, brass and teal enamel
Constraints: no text, no watermark, do not use #00ff00 in subject
Avoid: shopping cart, currency-only read, flat app arrows
```

#### `market-repair-service`

Source: `assets/concept-art/ui/icons/sources/market-repair-service-source-v1.png`
Runtime: `assets/runtime/ui/icons/market-repair-service.png`
Chroma key: yes, `#00ff00`
Target size: 384x384 transparent icon

```text
Use case: stylized-concept
Asset type: transparent market UI/service asset
Primary request: market repair service icon for durability or broken-card mechanics
Subject: compact brass repair clamp holding a cracked card plate, teal lens screwdriver, stitched cloth strip, and warm work-lamp glint
Style/medium: painterly item icon, practical canal-market hardware
Composition/framing: centered 3/4 object, clear repair silhouette, generous padding
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Lighting/mood: warm vendor light, cyan rim highlights, brass and patched metal
Constraints: no text, no watermark, do not use #00ff00 in subject
Avoid: medical cross, magic mend beam, generic wrench alone
```

#### `market-rumor-service`

Source: `assets/concept-art/ui/icons/sources/market-rumor-service-source-v1.png`
Runtime: `assets/runtime/ui/icons/market-rumor-service.png`
Chroma key: yes, `#00ff00`
Target size: 384x384 transparent icon

```text
Use case: stylized-concept
Asset type: transparent market UI/service asset
Primary request: market rumor service icon for scouting or route information
Subject: folded rooftop route note tucked under a teal signal lens, brass whisper horn, magenta enamel pin, and small string-tied clue tags
Style/medium: painterly item icon, grounded Bird Squad information-market prop
Composition/framing: centered object cluster, readable at HUD size, generous padding
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Lighting/mood: warm vendor light, cyan signal glint, subtle secretive mood
Constraints: no readable writing, no text, no watermark, do not use #00ff00 in subject
Avoid: speech bubble icon, newspaper headline, fantasy crystal ball
```

#### `market-discount-token`

Source: `assets/concept-art/ui/icons/sources/market-discount-token-source-v1.png`
Runtime: `assets/runtime/ui/icons/market-discount-token.png`
Chroma key: yes, `#00ff00`
Target size: 256x256 transparent icon

```text
Use case: stylized-concept
Asset type: transparent market UI/service asset
Primary request: market discount token icon
Subject: small worn brass token with teal glass notch, clipped card-stock price tab, magenta enamel chip, and practical vendor punch mark
Style/medium: painterly item icon, readable at 32-64 px
Composition/framing: centered token, strong silhouette, generous padding
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Lighting/mood: warm vendor glint, dark metal shadows, cyan rim light
Constraints: no numbers, no percent sign, no text, no watermark, do not use #00ff00 in subject
Avoid: generic coin, dollar sign, flat coupon graphic
```

#### `reward-molt-badge`

Source: `assets/concept-art/ui/icons/sources/reward-molt-badge-source-v1.png`
Runtime: `assets/runtime/ui/icons/reward-molt-badge.png`
Chroma key: yes, `#00ff00`
Target size: 256x256 transparent badge

```text
Use case: stylized-concept
Asset type: transparent reward ceremony UI asset
Primary request: Molt reward badge
Subject: feather-shed brass medallion with a clean before/after feather motif, teal glass hinge, warm reward glow, and magenta enamel inlays
Style/medium: painterly game UI badge, celebratory but grounded
Composition/framing: centered badge, readable at 48-96 px, generous padding
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no text, no watermark, do not use #00ff00 in subject
Avoid: magical transformation smoke, generic feather icon, cluttered details
```

#### `reward-cache-expanded-choice-frame`

Source: `assets/concept-art/ui/icons/sources/reward-cache-expanded-choice-frame-source-v1.png`
Runtime: `assets/runtime/ui/icons/reward-cache-expanded-choice-frame.png`
Chroma key: yes, `#00ff00`
Target size: 768x512 transparent frame

```text
Use case: stylized-concept
Asset type: transparent reward ceremony UI asset
Primary request: expanded cache choice reward frame
Subject: reward choice frame built from brass lockbox hinges, teal glass latch beads, card-stock tabs, and magenta enamel reward pins, with a clear empty center
Style/medium: painterly game UI chrome, crisp transparent cutout
Composition/framing: rectangular choice-card frame, empty center, generous padding
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no baked text, no watermark, do not use #00ff00 in subject
Avoid: treasure chest lid, filled center, confetti overload
```

#### `reward-boss-relic-frame`

Source: `assets/concept-art/ui/icons/sources/reward-boss-relic-frame-source-v1.png`
Runtime: `assets/runtime/ui/icons/reward-boss-relic-frame.png`
Chroma key: yes, `#00ff00`
Target size: 768x512 transparent frame

```text
Use case: stylized-concept
Asset type: transparent reward ceremony UI asset
Primary request: boss-exclusive Waymark relic reward frame
Subject: heavier brass and blackened-steel relic frame with cracked boss enamel, teal glass sockets, riveted route plates, and an empty center for live relic art/text
Style/medium: painterly game UI chrome, premium boss reward treatment
Composition/framing: rectangular frame, strong top crest, empty center, generous transparent padding
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no baked text, no watermark, do not use #00ff00 in subject
Avoid: fantasy treasure frame, skull motif, opaque center
```

#### `reward-leader-unlock-medallion`

Source: `assets/concept-art/ui/icons/sources/reward-leader-unlock-medallion-source-v1.png`
Runtime: `assets/runtime/ui/icons/reward-leader-unlock-medallion.png`
Chroma key: yes, `#00ff00`
Target size: 384x384 transparent medallion

```text
Use case: stylized-concept
Asset type: transparent reward ceremony UI asset
Primary request: leader unlock medallion
Subject: premium brass bird-leader medallion with teal glass center socket, magenta enamel victory ticks, small feather clasp, and warm unlock glow
Style/medium: painterly game UI medallion, celebratory but grounded
Composition/framing: centered circular medallion, empty center suitable for live leader icon, generous padding
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no text, no specific leader portrait baked in, no watermark, do not use #00ff00 in subject
Avoid: trophy cup, fantasy crown, dense tiny decorations
```

#### `system-settings-keybind-row-frame`

Source: `assets/concept-art/ui/icons/sources/system-settings-keybind-row-frame-source-v1.png`
Runtime: `assets/runtime/ui/icons/system-settings-keybind-row-frame.png`
Chroma key: yes, `#00ff00`
Target size: 768x128 transparent frame

```text
Use case: stylized-concept
Asset type: transparent system overlay UI chrome
Primary request: settings keybind row frame
Subject: sober horizontal row frame with dark metal rail, brass trim, teal active sockets for keycaps, and subtle magenta enamel corner pins
Style/medium: painterly game UI chrome with clean empty areas for Phaser text
Composition/framing: long thin empty-center row, generous transparent padding
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no baked key labels, no text, no watermark, do not use #00ff00 in subject
Avoid: keyboard photo, smartphone setting row, cluttered decoration
```

#### `system-settings-accessibility-chip-frame`

Source: `assets/concept-art/ui/icons/sources/system-settings-accessibility-chip-frame-source-v1.png`
Runtime: `assets/runtime/ui/icons/system-settings-accessibility-chip-frame.png`
Chroma key: yes, `#00ff00`
Target size: 384x128 transparent frame

```text
Use case: stylized-concept
Asset type: transparent system overlay UI chrome
Primary request: accessibility setting chip frame for contrast or color modes
Subject: compact brass-and-gunmetal chip frame with teal glass status notch, magenta enamel pin, and clean empty center for live setting text
Style/medium: painterly game UI chrome, crisp transparent cutout
Composition/framing: small horizontal chip frame, empty center, generous padding
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no baked icon, no text, no watermark, do not use #00ff00 in subject
Avoid: medical accessibility symbol, flat app pill, filled center
```

#### `how-to-play-keycap-medallion`

Source: `assets/concept-art/ui/icons/sources/how-to-play-keycap-medallion-source-v1.png`
Runtime: `assets/runtime/ui/icons/how-to-play-keycap-medallion.png`
Chroma key: yes, `#00ff00`
Target size: 256x256 transparent medallion

```text
Use case: stylized-concept
Asset type: transparent system overlay UI chrome
Primary request: how-to-play keycap medallion
Subject: small brass-rimmed keycap medallion with dark metal face, teal glass highlight, magenta enamel corner tabs, and an empty face for live key label
Style/medium: painterly game UI icon, readable at guide size
Composition/framing: centered keycap-like medallion, empty face, generous padding
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no baked letters, no text, no watermark, do not use #00ff00 in subject
Avoid: photoreal keyboard key, flat app icon, ornate clutter
```

#### `system-save-slot-frame`

Source: `assets/concept-art/ui/icons/sources/system-save-slot-frame-source-v1.png`
Runtime: `assets/runtime/ui/icons/system-save-slot-frame.png`
Chroma key: yes, `#00ff00`
Target size: 768x256 transparent frame

```text
Use case: stylized-concept
Asset type: transparent system overlay UI chrome
Primary request: save slot frame for expanded run profiles
Subject: sturdy horizontal dossier frame with brass file rails, dark metal panels, teal glass status window, card-stock tab, and subtle magenta enamel pins
Style/medium: painterly game UI chrome, clean empty areas for save details
Composition/framing: wide rectangular frame, empty center, generous padding
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no baked text, no watermark, do not use #00ff00 in subject
Avoid: floppy disk icon, opaque center, modern OS window style
```

#### `cache_hook`

Source: `assets/concept-art/waymarks/sources/cache_hook-source-v2.png`
Runtime: `assets/runtime/waymarks/icons/cache_hook.webp`
Chroma key: yes, `#00ff00`
Target size: transparent item icon readable at 32-64 px

```text
Use case: stylized-concept
Asset type: transparent Bird Squad item icon
Primary request: Cache Hook Waymark icon that communicates lifting multiple cache lids or tagged bundles
Subject: single brass hook tool pulling two small lockbox lids open, tied cache tags, teal glass bead, and worn rope loop
Style/medium: high-resolution pixel-painterly item icon, strong silhouette
Composition/framing: centered 3/4 object, generous padding, no background
Lighting/mood: cyan rim light, warm brass highlights, dark navy shadows
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no text, no watermark, do not use #00ff00 in subject
Avoid: fishing hook alone, treasure chest, tiny unreadable tags
```

#### `roofline_compass`

Source: `assets/concept-art/waymarks/sources/roofline_compass-source-v1.png`
Runtime: `assets/runtime/waymarks/icons/roofline_compass.webp`
Chroma key: yes, `#00ff00`
Target size: transparent item icon readable at 32-64 px

```text
Use case: stylized-concept
Asset type: transparent Bird Squad item icon
Primary request: Roofline Compass rare route-planning Waymark icon
Subject: compact rooftop compass made of aged brass, teal glass needle, folded card-stock route tab, stitched strap, and magenta enamel bearing mark
Style/medium: high-resolution pixel-painterly item icon, readable at small size
Composition/framing: centered 3/4 object, generous padding, no background
Lighting/mood: cyan rim light, warm brass highlights, practical route-planning mood
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no letters, no text, no watermark, do not use #00ff00 in subject
Avoid: generic compass rose, coin-like economy read, fantasy map rune
```

#### `sky_safe_harness`

Source: `assets/concept-art/waymarks/sources/sky_safe_harness-source-v1.png`
Runtime: `assets/runtime/waymarks/icons/sky_safe_harness.webp`
Chroma key: yes, `#00ff00`
Target size: transparent item icon readable at 32-64 px

```text
Use case: stylized-concept
Asset type: transparent Bird Squad item icon
Primary request: Sky Safe Harness Waymark icon for reinforced boss-ready protection
Subject: compact reinforced bird harness with brass plates, teal glass buckles, stitched dark cloth, rope loop, and magenta enamel safety mark
Style/medium: high-resolution pixel-painterly item icon, strong silhouette
Composition/framing: centered 3/4 object, generous padding, no background
Lighting/mood: cyan rim light, warm brass highlights, protective practical mood
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no text, no watermark, do not use #00ff00 in subject
Avoid: human armor chestplate, fantasy shield, tiny strap tangle
```

#### `reopened_roofline`

Source: `assets/concept-art/waymarks/sources/reopened_roofline-source-v1.png`
Runtime: `assets/runtime/waymarks/icons/reopened_roofline.webp`
Chroma key: yes, `#00ff00`
Target size: transparent item icon readable at 32-64 px

```text
Use case: stylized-concept
Asset type: transparent Bird Squad item icon
Primary request: Reopened Roofline Waymark icon for restored route access
Subject: small hinged route sign propped open with brass bracket, teal glass route bead, repair stitch marks, and magenta enamel reopening chip
Style/medium: high-resolution pixel-painterly item icon, readable at small size
Composition/framing: centered 3/4 object, generous padding, no background
Lighting/mood: cyan rim light, warm brass highlights, repaired route mood
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no readable sign text, no watermark, do not use #00ff00 in subject
Avoid: generic road sign, large map background, flat app unlock icon
```

### Battlefield and Procedural Fallback Prompts

#### `cache-street-battlefield-v1`

Source: `assets/concept-art/backdrops/sources/cache-street-battlefield-v1.png`
Runtime: `assets/runtime/backdrops/variants/cache-street-battlefield-v1.webp`
Chroma key: no
Target size: opaque 16:9 battlefield plate

```text
Use case: stylized-concept
Asset type: opaque battle backdrop
Primary request: cache route-node-specific Bird Squad combat battlefield
Scene/backdrop: rainy rooftop cache street with pulley lockboxes, sealed cabinets, and distant canal lights
Subject: wide urban battlefield with clear left and right staging zones for flock and enemies, enough empty center for combat log and FX
Style/medium: high-resolution painterly environment, grounded modern rooftop/canal city
Composition/framing: 16:9, horizon and focal details kept out of HUD-critical areas, no central clutter
Lighting/mood: jewel-toned night lighting, cyan reflections, warm brass practical lights
Constraints: no text, no logos, no watermark, no characters baked into combat staging zones
Avoid: overly dark details, busy foreground, strong focal object behind enemy HP bars
```

#### `elite-rooftop-battlefield-v1`

Source: `assets/concept-art/backdrops/sources/elite-rooftop-battlefield-v1.png`
Runtime: `assets/runtime/backdrops/variants/elite-rooftop-battlefield-v1.webp`
Chroma key: no
Target size: opaque 16:9 battlefield plate

```text
Use case: stylized-concept
Asset type: opaque battle backdrop
Primary request: elite encounter rooftop battlefield variant
Scene/backdrop: rain-wet rooftop arena with reinforced rails, signal hardware, elite patrol markings, and canal skyline depth
Subject: readable combat floor with clear flock and enemy staging zones, premium but not cluttered
Style/medium: high-resolution painterly environment, grounded modern Bird Squad city
Composition/framing: 16:9, central floor open for combat log and FX, top HUD area calm
Lighting/mood: tense cyan rim light, warm brass fixtures, magenta elite enamel accents
Constraints: no text, no logos, no watermark, no characters baked into staging zones
Avoid: boss-only throne scene, crowded foreground, unreadable dark floor
```

#### `weather-rain-battlefield-v1`

Source: `assets/concept-art/backdrops/sources/weather-rain-battlefield-v1.png`
Runtime: `assets/runtime/backdrops/variants/weather-rain-battlefield-v1.webp`
Chroma key: no
Target size: opaque 16:9 battlefield plate

```text
Use case: stylized-concept
Asset type: opaque battle backdrop
Primary request: rainy weather/time battlefield variant that preserves gameplay readability
Scene/backdrop: rooftop combat lane after heavy rain, reflective puddles, softened distant city lights, practical brass lamps
Subject: open battlefield with clear left/right staging zones and low-contrast center that will not fight HUD text
Style/medium: high-resolution painterly environment, grounded Bird Squad rooftop city
Composition/framing: 16:9, no important detail under combat log or HP bars
Lighting/mood: cool rain atmosphere, cyan reflections, warm lamp pools
Constraints: no text, no logos, no watermark, no characters baked into staging zones
Avoid: rain streaks so bright they obscure cards/FX, black crush, busy puddle patterns in the center
```

#### `menu-soft-mote-sheet`

Source: `assets/concept-art/fx/sources/menu-soft-mote-sheet-source-v1.png`
Runtime: `assets/runtime/fx/menu-soft-mote-sheet.webp`
Chroma key: yes, `#00ff00`
Target size: 512x512 transparent sprite sheet

```text
Use case: stylized-concept
Asset type: transparent procedural-FX replacement sheet
Primary request: menu soft mote sheet replacing the single procedural mote texture
Subject: twelve isolated small translucent dust and light motes in teal, amber, cream, and magenta, each with crisp keyed edges and no overlap
Style/medium: painterly game FX parts, small readable particles
Composition/framing: sprite-sheet layout with generous spacing on a square canvas
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no text, no watermark, no cast shadows, do not use #00ff00 in subject
Avoid: fog clouds, bokeh blobs merging together, soft green fringe
```

#### `combat-spark-particle-sheet`

Source: `assets/concept-art/fx/sources/combat-spark-particle-sheet-source-v1.png`
Runtime: `assets/runtime/fx/combat-spark-particle-sheet.webp`
Chroma key: yes, `#00ff00`
Target size: 512x512 transparent sprite sheet

```text
Use case: stylized-concept
Asset type: transparent procedural-FX replacement sheet
Primary request: combat spark particle sheet with 8-16 tiny shard particles
Subject: isolated feather chips, brass flecks, teal glass motes, amber sparks, and magenta enamel shards, each separated with generous padding
Style/medium: painterly game FX parts, crisp silhouettes, readable at 8-24 px
Composition/framing: sprite-sheet layout with no overlapping particles, evenly spaced cells
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no text, no watermark, no cast shadows, do not use #00ff00 in subject
Avoid: large smoke puffs, green particles, tiny details that vanish completely
```

#### `combat-pulse-ring-sheet`

Source: `assets/concept-art/fx/sources/combat-pulse-ring-sheet-source-v1.png`
Runtime: `assets/runtime/fx/combat-pulse-ring-sheet.webp`
Chroma key: yes, `#00ff00`
Target size: 1024x256 transparent sprite sheet

```text
Use case: stylized-concept
Asset type: transparent procedural-FX replacement sheet
Primary request: four combat pulse ring styles for cover, danger, healing, and resonance
Subject: four isolated empty-center rings arranged left to right: brass cover ring, amber danger ring, teal repair/healing ring, and cyan-magenta resonance ring
Style/medium: painterly game FX/UI parts, crisp ring silhouettes
Composition/framing: sprite-sheet row with four separate rings, empty centers, generous spacing
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no text, no watermark, no cast shadows, do not use #00ff00 in subject
Avoid: filled centers, foggy ring edges, fantasy spell runes
```

#### `battlefield-boss-vignette-strip`

Source: `assets/concept-art/fx/sources/battlefield-boss-vignette-strip-source-v1.png`
Runtime: `assets/runtime/fx/battlefield-boss-vignette-strip.webp`
Chroma key: yes, `#00ff00`
Target size: 1280x720 transparent overlay

```text
Use case: stylized-concept
Asset type: transparent procedural-FX replacement overlay
Primary request: boss battlefield edge treatment strip
Subject: transparent edge-only overlay with red-orange threat enamel, cracked brass corner pressure marks, and subtle dark metal scratches, leaving the center fully empty
Style/medium: painterly game overlay, crisp keyed edges
Composition/framing: 16:9 edge frame/strip, no opaque center, generous transparent central gameplay space
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no text, no watermark, no cast shadows, do not use #00ff00 in subject
Avoid: full-screen dark wash, smoky center, heavy blur that keys poorly
```

#### `battlefield-rival-vignette-strip`

Source: `assets/concept-art/fx/sources/battlefield-rival-vignette-strip-source-v1.png`
Runtime: `assets/runtime/fx/battlefield-rival-vignette-strip.webp`
Chroma key: yes, `#00ff00`
Target size: 1280x720 transparent overlay

```text
Use case: stylized-concept
Asset type: transparent procedural-FX replacement overlay
Primary request: rival battlefield wager-pressure edge treatment
Subject: transparent edge-only overlay with magenta wager enamel, brass contract clips, teal glass pressure ticks, and dark card-table corner scratches, leaving center fully empty
Style/medium: painterly game overlay, crisp transparent-ready edges
Composition/framing: 16:9 edge frame/strip, clear center, no overlap with HUD-critical areas
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no text, no watermark, no cast shadows, do not use #00ff00 in subject
Avoid: full-screen color wash, poker/casino symbols, smoky center
```

#### `system-panel-corner-kit`

Source: `assets/concept-art/ui/icons/sources/system-panel-corner-kit-source-v1.png`
Runtime: `assets/runtime/ui/icons/system-panel-corner-kit.png`
Chroma key: yes, `#00ff00`
Target size: 512x512 transparent sprite sheet

```text
Use case: stylized-concept
Asset type: transparent procedural UI replacement sheet
Primary request: reusable system panel corner and rail kit
Subject: isolated brass/gunmetal panel corners, straight rail segments, teal glass rivets, and magenta enamel pins arranged as separate parts with no overlap
Style/medium: painterly game UI parts, crisp transparent cutouts
Composition/framing: sprite-sheet layout with generous spacing and clear separate components
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no text, no watermark, no cast shadows, do not use #00ff00 in subject
Avoid: assembled full panel, opaque fills, tiny decorations that cannot tile
```

## Naming and Storage Conventions

For transparent generated sources:

- Source: `assets/concept-art/<category>/sources/<slug>-source-v1.png`
- Keyed raw artifact: `.artifacts/test-results/<slug>/<slug>-keyed-raw.png`
- Runtime: `assets/runtime/<category>/<slug>.png` or `.webp`

For opaque generated sources:

- Source: `assets/concept-art/<category>/sources/<slug>-source-v1.png`
- Runtime: `assets/runtime/<category>/<slug>.webp`

Recommended slug format:

- UI chrome: `<screen>-<component>-frame`
- FX: `combat-<trigger>-<read>`
- Route events: `<event>-<resident-or-prop>-v1`
- Items: exact data id, e.g. `sky_safe_harness`
- Enemies/cards: exact runtime id, e.g. `tar_crowned_crow`, `swords_04`

## Acceptance Checklist

Before wiring a generated asset:

- The source file is preserved in `assets/concept-art/.../sources/`.
- The runtime file is optimized into the correct `assets/runtime/...` folder.
- Transparent assets have clean alpha and transparent corners.
- No baked text exists unless supplied verbatim.
- The asset is readable at actual game display size.
- The asset does not hide critical HUD text, HP bars, combat logs, card text, or mobile fixed-canvas letterboxing.
- The consuming code exposes telemetry in `render_game_to_text` when the asset is tied to visible behavior.
- Run at least:
  - `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`
  - `npm run validate:runtime-assets`
  - `npm run validate:runtime`
  - relevant focused Playwright test or smoke path
  - shared web-game client if gameplay/UI behavior changed
  - high-res, desktop, and mobile screenshots for visual assets

## Do Not Generate Yet

Avoid generating these until a concrete feature needs them:

- Replacement art for all 244 UI icons just for consistency; they are currently present.
- Replacement art for all 110 cards or 64 enemies; manifests are approved.
- Text-heavy buttons. Prefer Phaser text over baked image text.
- Highly translucent smoke/glass assets through chroma key unless true transparency fallback is explicitly approved.
- Decorative hero/landing imagery. Bird Squad should boot into the actual game experience, not a marketing page.

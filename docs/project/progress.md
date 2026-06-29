Original prompt: make it happen

This log is historical context and handoff memory. It is not a canonical design
source. Current game rules live in `docs/game/`, art direction lives in
`docs/art/`, and card production data lives in `data/cards/`.

## 2026-06-29 Documentation Architecture Refresh

- Added `docs/project/runtime-architecture.md` with Mermaid diagrams for data
  flow, scene lifecycle, run lifecycle, effect resolution, route generation, and
  validation/build gates.
- Updated README and documentation index links so the architecture note is the
  entry point for code/data/scene changes.
- Refreshed current runtime counts in the game docs: 4 districts, 100 playable
  cards plus 10 Snags, 90 reward cards, 58 Waymarks, 31 Supplies, 64 enemies, 80
  encounters, and 38 Signals.
- Expanded canonical notes for live effect syntax, Snags, `moltEffects`,
  `heldEffects`, generated route maps, and Waymark family counts.

## 2026-06-17 Route Map Field-Kit Reanalysis

- Revisited the route map after the non-map field-kit surfaces established the
  shared language.
- Kept route node/data layout stable and changed map chrome only: the planning
  board frame, lighter status rail, field-kit top controls, legend strip, and
  inspector dossier.
- Verified the selected-route screenshot at
  `output/web-game-final-pass/route-selected-fieldkit-final.png`; console output
  only reported expected WebGL ReadPixels screenshot warnings.

## 2026-06-17 AAA Field-Kit UI Pass

- Shelved route-map redesign work while keeping existing map layout changes
  untouched for later reanalysis.
- Added shared field-kit UI helpers for dossier frames, lighter controls,
  compact action buttons, and quiet UI feedback.
- Reworked non-map route overlays into distinct surfaces: Flock as a crew
  dossier, Deck as a field binder, and Market as a rooftop stall.
- Matched route/card hover detail to the full deck-card detail format while
  keeping shop and preen shelves compact.
- Lightened combat HUD chips and inspect overlays so stats read as tactical
  rails and dossier tables instead of repeated blue blocks.
- Verified with build, focused smoke tests, runtime/docs validation, and
  Playwright visual screenshots under `output/web-game-aaa-ui/`.

## 2026-06-16 Encounter Enemy Scaling

- Expanded authored encounters so street, rival, and boss fights can include up
  to four enemies.
- Added boss helper compositions for district bosses while keeping the boss as
  the first combatant in each encounter payload.
- Wired the authored route maps to use larger street/rival encounters after the
  opening tutorial beat, so generated route pools and fixed map previews agree.
- Updated battle enemy placement so four-enemy fights use a two-row formation
  and boss fights keep the boss visually dominant with helpers staged lower.
- Added runtime validation that encounter `enemies` arrays may not exceed four
  combatants.
- Tuned enemy idle breathing from a nearly imperceptible scale-only pulse into a
  clearer Travquest-style squash/stretch, small bob, and ground-shadow pulse.
- Fixed dead-enemy targeting so defeated enemies stop being selected, stale
  target ids no-op, and the next playable enemy becomes the default target.
- Fixed combat sequencing edge cases: reward screens no longer restart from
  end-turn input, played cards leave hand before discard effects resolve, lethal
  enemy phases stop immediately, enemy Cover expires after the player turn, and
  `fullyBlocksNextAttack` checks the next actual incoming attack.

## 2026-06-16 Concept Art Rehome

- Moved remaining raw concept-art PNGs out of `assets/concept-art/` and into
  ignored `.generated/imagegen/` source folders.
- Converted the four battle backdrop masters into optimized WebP runtime assets
  under `assets/runtime/backdrops/` and wired battle loading through Vite-managed
  asset URLs.
- Updated current art pipeline docs and tooling defaults to use `.generated`
  roots for raw Minor Arcana work instead of recreating `assets/concept-art/`.

## 2026-06-16 Enemy Art Contract Fields

- Added `description`, `visualBrief`, and `silhouette` to all 33 authored enemy
  contracts across Map 1 Alpha and maps 02-04.
- Added required `artPose` guidance so enemy generation defaults to front-facing
  3/4 cutout poses instead of straight-on symmetry.
- Tightened `artPose` guidance so the face/head align with the same 3/4 angle as
  the body rather than snapping to a straight-on portrait angle.
- Clarified that tar/oil enemy motifs should translate into fashion, accessories,
  and environment rather than literal material smeared on animal bodies.
- Added enemy art guidance that props and clothing must not impede natural animal
  movement.
- Added grounded cutout guidance so enemy stills stand or rest on an implied
  ground line instead of floating, flying, or depending on visible support props.
- Added single-character enemy art guidance and reworked multi-character enemy
  contracts into single readable threats: Tarline Jackdaw, Ferry Cormorant,
  Aerial Signal Kite, and Kettle Harrier.
- Trued up internal enemy, encounter, route payload, and audit ids so the old
  group-based `*_crew`, `*_corps`, and `*_gang` names no longer remain in data.
- Updated all enemy `artPose` contracts to prefer dramatic idle poses: braced,
  watchful, guarding, mid-feint, coiled, or ready to act without becoming full
  attack poses.
- Created `docs/art/enemy-art-bible.md` to keep enemy art aligned with the
  existing high-resolution pixel art, non-humanoid animal anatomy, and modern
  urban streetwear visual language.
- Updated runtime TypeScript types and validation so every enemy must carry the
  new art contract fields.
- Linked the enemy art bible from the documentation index and the main art
  bible.
- Verified `npm run validate:runtime`.

## 2026-06-16 Generated Art Runtime Pipeline

- Added `.generated/imagegen/` as the home for selected generated tarot and enemy
  masters, contact sheets, and source/provenance art.
- Added runtime art builders:
  - `npm run build:runtime-card-art`
  - `npm run build:runtime-enemy-art`
  - `npm run build:runtime-art`
- Built optimized WebP runtime assets under `assets/runtime/cards/` and
  `assets/runtime/enemies/`.
- Added `assets/runtime/enemies/enemy-art-manifest.json` and wired enemy art into
  combat rendering with the existing fallback ellipse still available.
- Switched card art loading to optimized runtime portraits instead of loading
  archival PNG sources directly.
- Kept raster imagegen art as raster WebP/PNG for runtime; SVG remains reserved
  for deterministic overlays, icons, borders, and templates.

## 2026-06-13

- Started the Bird Squad Phaser graybox build.
- Chosen implementation stack for the prototype: Phaser 4.1.0, TypeScript, Vite.
- Created the initial app scaffold and first playable target:
  - title screen using `assets/splash/bird-squad-splash-v1.png`
  - rooftop tactical board
  - three starter birds
  - movement preview
  - minimal card hand
  - Squad Actions, Spark, turn counter
  - `window.render_game_to_text` and `window.advanceTime` hooks for browser checks
- Installed npm dependencies.
- Ran `npm run build`; TypeScript and Vite production build pass.
- npm reported 2 high-severity audit findings in dependencies; no forced upgrade was applied during scaffold.
- Switched Phaser to Canvas renderer after headless WebGL screenshots captured black frames.
- Verified with the web-game Playwright client:
  - Start Run enters `GameScene`.
  - Sparrow movement changes grid position from `(1,4)` to `(1,2)` and spends 1 Squad Action.
  - Hot Feathers applied to Hummingbird, then End Turn advances to turn 2 and changes Molt into Exposed.
- Dev server is currently running at `http://127.0.0.1:5175/`.

## 2026-06-13 Card Battler Pivot

- User clarified the game should not be grid tactics; it should lean toward Slay the Spire.
- Replaced the grid-based tactical prototype with a card-combat prototype:
  - squad row with House Sparrow, Anna's Hummingbird, and Magpie
  - enemy row with Roof Rat and visible intent
  - hand of cards
  - Energy, Spark, draw pile, discard pile
  - attack, block, utility, and Molt card handling
  - End Turn enemy resolution
  - Molt into visible Exposed status
- Rewrote `docs/bird-squad-playable-spec.md` as a card battler spec and explicitly removed grid tactics from the design.
- Verification:
  - `npm run build` passes.
  - Playwright start smoke test shows `BattleScene` with hand, Energy, Spark, enemy intent, and no grid.
  - Lucky Peck test drops Roof Rat from 18 HP to 15 HP, spends 1 Energy, and moves the card to discard.
  - Hot Feathers test Molts Hummingbird, resolves enemy turn, and shows Hummingbird as Exposed on turn 2.

## 2026-06-13 Tarot Reward Integration

- User clarified that tarot cards should be integrated into run progression:
  - collect tarot cards during a run
  - choose from a random sample after each encounter
  - improve cards over time
- Added a tarot reward pool:
  - 0 The Fool
  - I The Magician
  - II High Priestess
  - VII The Chariot
  - XVI The Tower
  - XVII The Star
  - Ace of Wands
  - Three of Cups
- Added post-encounter flow:
  - defeating the first Roof Rat opens `Choose a Tarot Card`
  - selecting a reward adds it to the run deck
  - then `Improve a Card` opens with random existing deck choices
  - selecting one upgrades it with a `+` suffix and stronger mechanics
  - encounter 2 begins with the modified deck
- Re-tuned first Roof Rat to 10 HP so the reward loop is reachable quickly in the graybox.
- Updated `docs/bird-squad-playable-spec.md` with tarot-as-run-progression rules.
- Verification:
  - `npm run build` passes.
  - Playwright reward-flow test defeated encounter 1, collected a random tarot card, improved a card, and entered encounter 2.
  - Reward-screen screenshot shows 3 readable tarot choices.

## 2026-06-13 Bird Squad As Cards Pivot

- User clarified that the bird squad are the cards, not necessarily units.
- This section is historical; the later Arcana Deck Pivot supersedes the separate `BIRD SQUAD` card label.
- Refactored combat away from individual bird units:
  - removed separate bird HP/Block/status rows
  - added one shared `The Flock` player state with HP, Block, and statuses
  - starter deck now consists of bird cards: House Sparrow, Anna's Hummingbird, Magpie, Vermilion Flycatcher, Common Swift, American Kestrel, Wingbeat, Hot Feathers
  - bird cards are labeled `BIRD SQUAD`
  - tarot cards remain collectible rewards after encounters
- Updated Molt:
  - Hot Feathers puts the flock into Molt
  - bird cards are stronger/cheaper while Molting
  - after a bird card consumes Molt, the flock becomes Exposed
- Updated `docs/bird-squad-playable-spec.md` to state that Bird Squad members are playable cards, not persistent battlefield units.
- Verification:
  - `npm run build` passes.
  - Playwright smoke test shows one shared flock state and bird cards in hand.
- Reward-flow test clears encounter 1, adds a tarot card, improves an existing card, and begins encounter 2 with an 11-card deck.

## 2026-06-13 Arcana Deck Pivot

- User clarified that the deck should be cards based on the Arcana.
- Refactored the prototype language and data model around Arcana-first cards:
  - card types are now `major`, `minor`, and `molt`
  - the starter deck is made from Arcana cards with bird identities as subtitles
  - reward choices come from the Arcana pool instead of a separate tarot reward category
  - the shared player state remains `The Flock`, with the deck representing the squad
- Updated UI copy so reward selection says `Choose an Arcana Card`.
- Tightened card text to match current mechanics and shortened Molt copy so hand cards stay readable.
- Added bird identity to `window.render_game_to_text` card payloads for test/debug parity with the visible cards.
- Verification:
  - `npm run build` passes.
  - Playwright reward-flow test clears encounter 1, adds an Arcana card, improves an Arcana card, and begins encounter 2 with an 11-card deck.

## 2026-06-13 Asset Integration Pass

- Integrated available artwork into the playable prototype:
  - battle scene now uses `assets/concept-art/rooftop-combat-scene-arcana-v1.png` as the atmospheric combat backdrop
  - available Major Arcana concept art is loaded for current Major cards and rewards after the battle scene starts
  - `0 The Fool` card art now appears in the starting hand
  - Major Arcana reward choices show their matching card art when available
  - Minor and Molt cards remain styled text cards until matching assets exist
- Verification:
  - `npm run build` passes.
  - Playwright start-battle screenshot confirms rooftop art and Fool card art render.
  - Playwright reward-screen screenshot confirms Major reward art renders.
  - Playwright reward-flow test still clears encounter 1, selects a reward, upgrades a card, and enters encounter 2.
- Load-failure fix: optional battle/card art is no longer part of the mandatory boot preload. The game renders playable fallback art first, then loads optional artwork at runtime and keeps running if an asset path fails.
- Note: current runtime art still points at full-resolution concept PNGs. Before shipping, generate smaller runtime thumbnails/optimized textures for battle cards and reward cards.

## 2026-06-13 Singleton Deck Rule

- User clarified that the run should only ever contain one copy of any card.
- Enforced singleton card ownership:
  - starter deck now has one copy per card ID
  - reward choices exclude cards already in the run deck
  - reward selection defensively refuses to add a duplicate if stale state ever presents one
  - `window.render_game_to_text` now exposes `deckIds` so automated checks can verify uniqueness
- Updated `docs/bird-squad-playable-spec.md` to v0.4 with the singleton deck rule.
- Verification:
  - `npm run build` passes.
  - Start-battle state has 8 cards and 8 unique card IDs.
  - Reward-screen state has no overlap between `rewardChoices` and `deckIds`.
  - Full reward-flow state enters encounter 2 with 9 cards and 9 unique card IDs.

## 2026-06-13 Game Docs Singleton Update

- Updated game documentation to reflect the current singleton Arcana deckbuilder direction:
  - `docs/bird-squad-prototype-brief.md` now replaces the old grid-tactics/recruiting brief with the current card battler model
  - `docs/bird-squad-playable-spec.md` now uses `V0.4 Acceptance Criteria`
  - both docs list the singleton starter deck and clarify that reward samples filter out already-owned cards

## 2026-06-13 Card Mechanics Contract

- Created `docs/card-mechanics-contract.md` as the dedicated source for current implemented card behavior.
- Contract includes global rules, Molt interactions, starter deck cards, reward pool cards, base effects, upgraded effects, and implementation notes.
- Linked the card contract from `docs/bird-squad-playable-spec.md` and `docs/bird-squad-prototype-brief.md`.

## 2026-06-13 Full Arcana Mechanics Contract Expansion

- Expanded `docs/card-mechanics-contract.md` to v0.2.
- Added target mechanics for all 22 Major Arcana cards and all 56 Minor Arcana cards.
- Major Arcana rows now define game-changing, encounter-shaping effects rather than simple bigger numbers.
- Minor Arcana rows are suit-coded:
  - Wands: Spark, Energy, speed, tempo attacks
  - Cups: Block, healing, Bond, recovery
  - Swords: Weak, Mark, scry, precision/disruption
  - Pentacles: Coin, durable Block, delayed value
- Originally preserved a separate live deck table for `src/main.ts`; this was
  later superseded by the deck documentation cleanup.
- Noted early implementation bird placeholders where they differ from the full
  suit data.
- Verified full-deck table counts: 22 Majors, 56 Minors, 78 target cards total.

## 2026-06-13 Bird-Themed Non-Card Vocabulary Pass

- Updated the playable prototype's player-facing non-card language:
  - HP display is now `Cohesion`.
  - Block display is now `Cover`.
  - Energy display is now `Wingbeats`.
  - End Turn button is now `Roost`.
  - Encounter/Turn display is now `Rooftop`/`Beat`.
  - Battle Log is now `Street Log`.
  - Post-encounter acquisition is now `Claim a Shiny Arcana`.
  - Card improvement is now `Preen an Arcana`.
  - Frail/Weak/Exposed presentation now maps toward `Ruffled`, `Winded`, and `Open Sky`.
- Kept implementation field names (`hp`, `block`, `energy`, `frail`, `weak`, `exposed`) stable so the engine and test payloads remain simple.
- Updated `docs/bird-squad-playable-spec.md` to v0.5 and `docs/bird-squad-prototype-brief.md` to v0.3 with the themed vocabulary.
- Updated `docs/card-mechanics-contract.md` to v0.3 with a Shared Terms mapping and implemented prototype card copy using Cover/Wingbeats/Winded/Open Sky where visible.
- Verification:
  - `npm run build` passes.
  - Restarted the Vite dev server on `http://127.0.0.1:5175/`.
  - Playwright battle screenshot confirms `Rooftop`, `Beat`, `Wingbeats`, `Cohesion`, `Cover`, `Street Log`, and `Roost` render cleanly.
  - Playwright reward screenshot confirms `Claim a Shiny Arcana` renders cleanly.
  - Playwright full reward-flow screenshot confirms a new Arcana joins the flock deck, a card is preened, and rooftop 2 starts with singleton deck state intact.

## 2026-06-13 Player-Facing Card Vocabulary Pass

- Replaced live prototype card titles with Bird Squad names:
  - `First Flight`, `Plume Flash`, `Plume Fledgling`, `Crossed Quills`, `Nest Juggle`, `Plume Rush`, `Open Basin`, `Hot Feathers`, `Shiny Toolkit`, `Moonlit Lookout`, `Dive Line`, `Signbreak`, `Rooftop Glow`, and `Basin Chorus`.
- Replaced player-facing `Spark` with `Resonance` in HUD text, card text, logs, upgraded card text, and `render_game_to_text`.
- Replaced card category labels with `LEGEND`, `PLUMES`, `BASINS`, `QUILLS`, `NESTS`, and `MOLT`.
- Updated reward and upgrade screens to say `Claim a Shiny Find` and `Preen a Card`.
- Added `gameName` to card JSON and normalized card data prose away from traditional suit/card names for future UI loading.
- Masked the baked title area on imported concept-art card images so traditional tarot titles do not show through under the game overlay.
- Verification:
  - strict old-name search across `src`, `docs/game-design.md`, `docs/card-mechanics-contract.md`, and card JSON returns no matches.
  - JSON parses cleanly.
  - `npm run build` passes.
  - Playwright battle and reward screenshots confirm Plumes/Quills/Nests/Basins/Legend vocabulary renders in-game.

## 2026-06-13 Project Directory Boundary Cleanup

- Added `README.md` with a concise project map and boundary rules.
- Kept canonical design docs under `docs/game/` and `docs/art/`.
- Kept card production data under `data/cards/arcana/` and `data/cards/reversals/`.
- Moved generated browser-test output out of root `output/` and into ignored `test-artifacts/web-game-output/`.
- Moved local Phaser reference skill files out of root `skills/` and into ignored `tools/phaser-skills/`.
- Updated `.gitignore` so `output/`, `test-artifacts/`, `dist/`, and `tools/phaser-skills/` stay out of source control.
- Updated stale docs/data path references to the canonical `docs/game`, `docs/art`, and `data/cards` paths.
- Verification:
  - `npm run build` passes.

## 2026-06-13 Root Directory Tidy Pass

- Moved the progress log from root `progress.md` to `docs/project/progress.md`.
- Moved generated browser-test captures from root `test-artifacts/` to ignored
  `.artifacts/test/`.
- Removed root `dist/` and configured Vite to emit production builds to ignored
  `.artifacts/build/`.
- Updated `README.md` to document the cleaner root boundary.
- Updated `.gitignore` to ignore `.artifacts/` while keeping legacy `dist/`,
  `output/`, and `test-artifacts/` ignored in case older tooling recreates
  them.

## 2026-06-13 Mechanics Scope Simplification

- Updated `docs/game/game-design.md` to v1.2 with a Mechanic Scope section that
  separates foundation mechanics, near-term expansion, and parked expansion
  hooks.
- Updated `docs/game/card-mechanics-contract.md` to v0.5 with scope labels in
  Shared Terms and a Mechanic Maturity Matrix.
- Narrowed the first playable foundation around Cohesion, Cover, Wingbeats,
  damage, healing, draw/discard, enemy intent, singleton rewards,
  improvements, rarity, Molt, Open Sky, Resonance, and Winded.
- Parked Ruffled, Mark, Bond, Shine, Scry, Discover, Retain, Cleanse, Route,
  Seed, replay/reflection, cost modification, status conversion, intent control,
  temporary cards, and all-four-suits payoffs for later expansion.
- Reframed suit guidance so Plumes, Basins, Quills, and Nests have simple
  foundation identities first, with deeper mechanics promoted one at a time.

## 2026-06-13 Deck Documentation Cleanup

- Updated `docs/game/game-design.md` to v1.3 and removed the Starting Deck,
  reward pool, and sample card/species inventory sections so the game
  overview no longer forks card definitions.
- Updated `docs/game/card-mechanics-contract.md` to v0.6 and removed the Current
  live deck table.
- Removed implementation-status columns from the canonical card contract tables.
  Implementation status now belongs in code, tests, or task tracking; the docs
  remain the intended design contract.

## 2026-06-13 Card Style Direction Pass

- Updated `docs/art/art-bible.md` to v1.2.
- Added a requirement that every card/bird mapping include both a style
  direction and a description.
- Reworked Major, Aviary Legend, and Minor Arcana card maps so all 84 mapped
  cards have individual streetwear/culture styling guidance.
- Added the six Aviary Legends to the art bible card map.
- Reinforced that styling should show modern urban culture through fit,
  materials, accessories, and setting without readable clothing text, uniforms,
  territory marks, or gang-coded affiliation signals.

## 2026-06-13 Documentation Hardening Pass

- Added a Source Of Truth table to `README.md`.
- Added `npm run validate:docs` and the dependency-free
  `tools/validate-docs.mjs` validator.
- Validator checks canonical card counts, unique species, required card data
  fields, art-bible style/description table coverage, minor rarity distribution,
  visible traditional suit/rank names, and stale duplicate-doc references.
- Updated active arcana data references from `major-arcana-bird-map.v0.2.json`
  to `major-arcana-bird-map.json`.
- Removed the duplicate `data/cards/arcana/major-arcana-bird-map.v0.2.json`
  file so the Major Arcana map has one active home.
- Marked this progress log as historical context rather than canonical design
  source.

## 2026-06-13 Minor Arcana Prompt Pack Correction

- Updated `docs/art/art-bible.md` to v1.3.
- Clarified that Minor Arcana generated art uses formal rank-and-suit titles in
  the bottom cartouche, such as `Ace of Plumes`, not game/design names such as
  `Plume Flash`.
- Strengthened anatomy rules against humanized birds: no hands, fingers,
  wing-hands, humanoid posture, or wings posed as arms.
- Updated `tools/export-minor-prompts.mjs` so prompt exports derive formal Minor
  display titles from rank and suit while keeping game/design names as prompt
  context only.
- Regenerated `docs/art/prompt-packs/minor-arcana-prompts.json`,
  `docs/art/prompt-packs/minor-arcana-prompts.md`, and all four suit briefs
  under `docs/art/prompt-packs/subagent-briefs/`.
- Treated the earlier in-card-title draft generations as obsolete because they
  used game/design names in the title cartouche.

## 2026-06-13 Minor Arcana Dimension Lock

- Updated `docs/art/art-bible.md` to v1.4.
- Locked generated Minor Arcana cards to a fixed `1024x1536` canvas with a
  `2:3` vertical portrait aspect ratio.
- Updated prompt export rules so every generated prompt calls out fixed output
  geometry, consistent frame crop, and consistent bottom cartouche placement.
- Added `npm run validate:art-dimensions` and `npm run normalize:minor-art`.
- Normalized 21 existing Minor Arcana PNGs to `1024x1536` so all 56 current
  Minor Arcana concept images share the same dimensions.

## 2026-06-13 Bird-Originated Action Rule

- Updated `docs/art/art-bible.md` to v1.5.
- Added a bird-originated action rule: each card's behavior or effect should
  read as coming from the bird's species behavior, posture, movement, voice,
  plumage, gaze, or interaction.
- Clarified that props, antennas, borders, lights, tools, plumes, quills,
  basins, nests, and scenery may frame or echo the action, but should not look
  like the source of the effect.
- Updated Plume Flash so the flash comes from Anna's Hummingbird through throat
  color, wingbeat, and plume display rather than from an antenna or loose
  feather.
- Audited Minor Arcana wording for prop-led action and revised clear offenders:
  Spilled Basin, Plume Victory Wire, Plume Stand, Plume Fledgling, Storm Quill,
  Dawn Quills, Quill Fledgling, Quill Matron, Workshop Nest, Treasure Nest, and
  Nest Matron now read more clearly as bird-sourced behavior.
- Corrected two species wording slips found during the audit: Full Basin Row now
  names Scarlet Ibis instead of spoonbill, and Cold Nest uses mourning doves
  instead of pigeons.
- Regenerated the Minor Arcana prompt pack and suit briefs with explicit
  `Action source` and `Bird-originated action` requirements.

## 2026-06-13 Locked Minor Arcana Border Template

- Updated `docs/art/art-bible.md` to v1.6.
- Added a locked border-template table for Minor Arcana cards covering outer
  margin, inner rail, corner medallions, side rails, top medallion, central
  image window, and bottom cartouche.
- Clarified that suit motifs, rarity details, birds, props, lights, weather,
  motion trails, plumes, quills, basins, nests, shine tags, antennas, and
  scenery must not break through, cover, replace, distort, crop, or redraw the
  shared border.
- Updated Minor Arcana prompt export so every prompt includes the locked border
  template, fixed `1024x1536` canvas, and suit-specific border inserts that stay
  inside fixed medallions, side rails, top crest, or filigree zones.
- Updated `npm run validate:docs` to require the locked-border prompt language.

## 2026-06-13 Minor Arcana Subagent Art Generation

- Used four parallel subagents to generate a fresh Minor Arcana concept-art
  series from the regenerated suit briefs.
- Saved the new series beside the older run under game-facing suit folders:
  `assets/concept-art/minor-arcana/plumes/`,
  `assets/concept-art/minor-arcana/basins/`,
  `assets/concept-art/minor-arcana/quills/`, and
  `assets/concept-art/minor-arcana/nests/`.
- Generated all 56 Minor Arcana PNGs: 14 Plumes, 14 Basins, 14 Quills, and
  14 Nests.
- All new generated PNGs validated at `1024x1536`; no normalization was needed.
- The older `wands/`, `cups/`, `swords/`, and `pentacles/` folders remain
  intact for comparison.

## 2026-06-13 Minor Arcana Streetwear Grounding Correction

- Updated `docs/art/art-bible.md` to v1.7 after reviewing the generated Minor
  Arcana run against `assets/splash/bird-squad-bold-streetwear-splash-v3.png`.
- Added the splash image as the primary grounded style reference: modern
  bird-city rooftops, canals, repair markets, utility harnesses, hoodies,
  beanies, rain shells, pouches, straps, antennas, HVAC units, crates, concrete,
  wet pavement, and neon signage.
- Strengthened hard negatives against old-world fantasy, medieval markets,
  wizard robes, fantasy craft tables, future-tech cityscapes, holograms,
  cybernetic armor, floating UI, magical particles, sparkles, aura clouds,
  spell circles, runes, and generic energy bursts.
- Reworked suit lanes:
  - Plumes now emphasizes baggy bombers, oversized hoodies, puffer/varsity
    silhouettes, grounded stage light, signage, color, motion, and performance
    without magic particles.
  - Basins keeps the strong rainwear/fashion lane but anchors backdrops in
    modern canals, underpasses, harbor railings, pump stations, and utility
    fountains.
  - Quills keeps the closest-fit clothing direction but grounds backgrounds in
    present-day rooftop radio rigs, transit wires, utility boxes, and antennas
    rather than future sci-fi.
  - Nests now blends streetwear and workwear: beanies, flannel wraps, hoodies,
    chore coats, utility vests, aprons, tool slings, salvage satchels, loading
    docks, repair markets, maker stalls, crates, concrete, and work lights.
- Regenerated the Minor Arcana prompt pack and suit briefs with the corrected
  grounding constraints. No new images were generated in this pass.

## 2026-06-13 Reward And UI Language Tightening

- Replaced `Claim a Shiny Find` with `Add to the Flock` in the live reward
  screen and game design doc.
- Kept `Preen a Card` as the upgrade screen language.
- Replaced `Street Log` with `Signals`.
- Replaced reward log copy from `joins the flock deck` to `joins the flock`.
- Replaced the outcome button label `Restart` with `Run It Back`.
- Replaced future design references to `rare Shiny Find` with `rare flock
  offer`.
- Verification:
  - old phrase scan is clean across `src`, `docs/game`, and `README.md`.
  - `npm run build` passes.
  - Playwright screenshots confirm `Signals` in battle and `Add to the Flock`
    on the reward screen.

## 2026-06-13 Combat Design Spec

- Created `docs/game/combat-design-spec.md` as the design target for the next
  combat overhaul.
- Spec defines the combat north star, foundation mechanics, turn structure,
  enemy Tell patterns, three-encounter rooftop slice, starter deck target,
  Molt/Open Sky rules, balance targets, reward design, UI requirements,
  implementation plan, and acceptance criteria.
- Locked the corrected suit roles:
  - Plumes: Resonance, Wingbeats, draw, tempo chains.
  - Quills: damage, Winded, conditional strikes.
  - Basins: recovery, healing, stabilization.
  - Nests: Cover, defense, bracing, setup.
- Updated `README.md`, `docs/game/game-design.md`, and
  `docs/game/card-mechanics-contract.md` to reference the new spec and align
  Basins/Nests wording.
- Retuned the Basins section in the card mechanics contract so Basins are
  recovery-first rather than Cover-first.
- Verification:
  - `npm run validate:docs` passes.

## 2026-06-13 Nests Art Direction Split

- Stopped the Nests repair/generation workers after review showed the suit was
  still collapsing into repeated old repair-market imagery.
- Reworked Nests into explicit card-by-card modern hipster workwear scenes:
  community garden, bike shop, hardware co-op, storage unit, laundromat/corner
  store, food-pantry table, rooftop planter crew, maker bench, thrift-alley
  record stall, loading-dock block party, coffee-roastery maker corner, cargo
  courier route, parts-library alcove, and hardware co-op mezzanine.
- Updated `data/cards/arcana/minor-arcana-pentacles.json`,
  `docs/art/art-bible.md`, and the prompt exporter, then regenerated
  `docs/art/prompt-packs/*`.
- Verification:
  - `npm run validate:docs` passes.

## 2026-06-13 Plumes Art Direction Split

- Reworked Plumes after review showed the suit risked repeating the same flashy
  rooftop composition.
- Split the suit into explicit modern performance lanes: rooftop busker set,
  billboard scout lookout, rooftop runway fit-check, block-party stage setup,
  dance cypher, festival victory wire, skate-ledge standoff, parkour speed run,
  sound-system barricade, stage-tech overload, poster-runner route, skyline
  courier run, rooftop runway lead, and water-tower sound-system director.
- Updated `data/cards/arcana/minor-arcana-wands.json`,
  `docs/art/art-bible.md`, and the prompt exporter, then regenerated
  `docs/art/prompt-packs/*`.
- Verification:
  - `npm run validate:docs` passes.

## 2026-06-13 Plumes Reference Refinement

- Reviewed the strongest Plumes visual references and tightened the suit around
  grounded bird anatomy, dark utility streetwear, cap/hood silhouettes,
  crossbody pouches, orange/magenta zipper pulls, abstract no-text patches, wet
  neon rooftops, waterfront rails, and dense city light.
- Updated Plumes so special action must come from the bird's own throat color,
  chest color, plume display, wingbeat rhythm, call posture, or body motion,
  with practical performance gear as support.
- Added warnings against readable logos, tactical armor drift, antenna-driven
  action, magical particles, aura effects, and fantasy performer costuming.
- Updated `data/cards/arcana/minor-arcana-wands.json`,
  `docs/art/art-bible.md`, and the prompt exporter, then regenerated
  `docs/art/prompt-packs/*`.

## 2026-06-13 Quills Variety Pass

- Reworked Quills after review showed the suit risked repeating one storm-shell
  outfit across too many cards.
- Split the suit into explicit modern signal-and-strategy lanes: rooftop radio
  analyst, billboard decision perch, rain-alley witness, utility-room night
  watch, ledge salvage runner, elevated-transit storm crossing, service-wire
  sneak thief, HVAC antenna enclosure, 3am apartment-wire insomnia, dawn
  recovery ledge, rookie message runner, aerial strategy racer, rooftop
  tactician, and radio-tower commander.
- Updated individual Quills descriptions, poses, and wardrobe details with
  distinct silhouettes such as courier jackets, varsity windbreakers, rain
  ponchos, roost parkas, salvage vests, flight capes, thrifted anoraks, mesh
  utility wraps, knit snoods, coach jackets, racing shells, tailored tactician
  coats, and command mantles.
- Suit variety risk after this pass:
  - Low risk: Nests, because each card has a distinct modern workwear scene.
  - Low-to-moderate risk: Plumes, because recent reference and performance-lane
    updates added stronger variation, though dark streetwear should be watched.
  - Moderate risk: Basins, because the source data still repeats rain wraps,
    droplet charms, and cuffs more than the other suits.
  - Low risk after update: Quills.

## 2026-06-13 Numbered Minor Arcana Pip Contract

- Added `numberSymbolism` to all 40 numbered Minor Arcana cards, covering the
  exact count, the suit-coded element carrying the count, what the number
  represents, and the required visual treatment.
- Updated the Minor Arcana prompt exporter so every numbered card includes a
  `Pip representation` line in the generated prompt packs.
- Strengthened documentation validation so numbered Minor Arcana cards fail if
  `numberSymbolism` is missing, mismatched to the rank, or missing its element,
  meaning, or visual requirement.
- Strengthened bird-species validation by normalizing species names before
  duplicate checks, preserving the global one-card-one-species rule across all
  84 cards.

## 2026-06-13 Flock Stats First-Class System

- Added Flock Stats as a first-class deckbuilding system across
  `docs/game/game-design.md`, `docs/game/combat-design-spec.md`, and
  `docs/game/card-mechanics-contract.md`.
- Foundation stats are Cohesion, Damage, Cover, Regen, Draw, Resonance, Molt
  Power, and Open Sky Guard.
- Defined threshold rules: Cohesion is direct, while the other stats may be
  fractional and create bonuses at whole-number totals.
- Defined suit affinities and rarity budgets, with Critical Chance and
  Repeat/Echo deliberately excluded from the foundation stat set.
- Added future card data guidance and Preen rules so card improvements affect
  both active effects and passive stat lines.

## 2026-06-13 Flock Stats Cohesion Pass

- Created `docs/game/flock-stats-contract.md` as the first-pass source of truth
  for passive Flock Stats.
- Locked exact threshold execution rules, including `floor(total)` behavior for
  non-Cohesion stats and encounter-refresh behavior for Open Sky Guard.
- Added stricter suit boundaries so Plumes, Quills, Basins, Nests, Molt, and
  Legend cards do not drift into generic stat bundles.
- Added concrete rarity budgets, Preen budgets, Legend threshold modifiers, and
  first-pass Flock Stat assignments for all 84 cards.
- Linked the new contract from `README.md`, `docs/game/game-design.md`,
  `docs/game/combat-design-spec.md`, and `docs/game/card-mechanics-contract.md`.

## 2026-06-13 Flock Stats Whole-Number Pass

- Changed Flock Stats from fractional threshold progress to whole-number passive
  values with a minimum granted value of `+1`.
- Updated all 84 card assignments so every card grants at least one immediate
  whole-number Flock Stat.
- Updated rarity and Preen budgets so theme and rarity control stat size and
  mix, with tuning deferred to later balance passes.
- Updated the combat spec, game design, and mechanics contract to remove
  fractional-stat language.

## 2026-06-13 Minor Arcana Pip-Contract Generation

- Used four suit-specific subagents to regenerate the full 56-card Minor Arcana
  set from the current prompt packs and numbered pip contracts.
- Output folder:
  `assets/concept-art/minor-arcana-regenerated-2026-06-13-pip-contract`.
- Generated 14 cards each for Plumes, Basins, Quills, and Nests, with per-suit
  `QA_MANIFEST.md` files plus a top-level `QA_SUMMARY.md`.
- Aggregate mechanical audit passed:
  - 56 PNGs present.
  - 14 PNGs per suit.
  - All PNGs are `1024x1536`.
  - All four suit QA manifests are present.
- `npm run validate:docs` passes after the generation run.

## 2026-06-13 Branching Run Map Contract

- Added `docs/game/run-map-contract.md` as the first-pass source of truth for
  branching run structure.
- Defined a full run as four maps total, each represented by a branching route
  graph with a required boss endpoint.
- Added Bird Squad node types: Street Encounter, Rival Crew, Boss, Basin Stop,
  Nest Workshop, Market, Signal Event, and Rooftop Cache.
- Clarified that Bird Squad still has no tactical grid or battlefield movement;
  the branching map is an out-of-combat route system.
- Linked the route contract from `README.md`, `docs/game/game-design.md`, and
  `docs/game/combat-design-spec.md`.

## 2026-06-13 Flyway Narrative Frame

- Added the core run narrative: the flock is restoring the city's broken
  flyways so birds can move, rest, trade, warn each other, and survive.
- Defined each run as a route-repair mission across four district maps, ending
  with the final signal carried to the High Roost.
- Clarified that cards join as birds bringing route memory, shelter knowledge,
  warning patterns, repair skill, fighting style, or survival tricks.
- Updated combat framing so encounters represent blocked or unsafe route
  segments, not disconnected fights.

## 2026-06-13 Run Systems Spec

- Added `docs/game/run-systems-spec.md` as the source of truth for roguelike
  run depth beyond the combat foundation.
- Covered the major missing layers: Route Marks, Scrap, Markets, Release a
  Card, Supplies, Snags, Bad Signals, Signals, Rival Crews, bosses, Basin/Nest
  path tension, Flock Leaders, and flyway stakes.
- Defined chosen Bird Squad terms alongside considered alternatives and rationale
  so future naming changes have context.
- Split systems into MVP and later scope, with implementation milestones and
  acceptance criteria.
- Integrated the spec into `README.md`, `docs/game/game-design.md`,
  `docs/game/run-map-contract.md`, `docs/game/combat-design-spec.md`, and
  `tools/validate-docs.mjs`.

## 2026-06-13 Alpha Run Spec

- Added `docs/game/alpha-run-spec.md` as the code-ready content target for the
  first playable roguelike slice.
- Scoped Alpha to Map 1 only: Rooftop Blocks, with 6-8 route nodes plus a rival
  bird crew leader boss.
- Defined starting run state, deterministic route shape, 10-card starter deck,
  24-card reward pool, 4 Alpha enemy encounters, Tar-Crowned Crow boss, 10 Route
  Marks, 5 Supplies, 5 Signals, 3 Snags, Market model, Basin rules, Nest rules,
  tuning targets, implementation order, and acceptance criteria.
- Integrated the Alpha spec into `README.md`, `docs/game/game-design.md`,
  `docs/game/combat-design-spec.md`, `docs/game/run-map-contract.md`,
  `docs/game/run-systems-spec.md`, and `tools/validate-docs.mjs`.

## 2026-06-13 Game Doc Consolidation

- Consolidated combat, card mechanics, Flock Stats, Molt, enemy Tells, and
  foundation reward rules into `docs/game/core-gameplay-spec.md`.
- Consolidated branching maps, flyway narrative, Route Marks, Scrap, Markets,
  Release a Card, Supplies, Signals, Snags, Rival Crews, bosses, Basin, and Nest
  rules into `docs/game/run-design-spec.md`.
- Reworked `docs/game/game-design.md` into the high-level hub for pitch, pillars,
  vocabulary, source ownership, and Alpha direction.
- Updated canonical source references so durable game docs now point to the
  consolidated specs instead of the superseded contract files.

## 2026-06-13 Implementation Contract Hardening

- Added a gameplay data contract, normalized effect syntax, formula order,
  targeting rules, and timing/status rules to `docs/game/core-gameplay-spec.md`.
- Added `Alpha Card Implementation Contract` to `docs/game/alpha-run-spec.md`,
  covering every starter and Alpha reward-pool card with target, tags,
  normalized base/improved effects, Base Flock Stats, and Preen Delta values.
- Added route map, node, edge, generation, legal-transition, and node-resolution
  contracts to `docs/game/run-design-spec.md`.
- Added runtime card-art asset naming, size, manifest, fallback, crop, and review
  rules to `docs/art/art-bible.md`.
- Expanded `tools/validate-docs.mjs` so the new implementation contracts are
  required and Alpha card stat/effect coverage is checked.
- `npm run validate:docs` passes after the hardening pass.

## 2026-06-13 Runtime Data Contract Pass

- Added runtime-ready Alpha data files:
  - `data/game/alpha-cards.json`
  - `data/game/alpha-enemies.json`
  - `data/game/alpha-route-map.json`
- Added typed import/export surface in `src/game/types.ts` and
  `src/game/runtime-data.ts`.
- Added `tools/validate-runtime-data.mjs` to validate Alpha card schema, effect
  syntax, Flock Stats, singleton starter/reward pools, enemy intent payloads,
  route node/edge integrity, and boss reachability.
- Added `assets/runtime/cards/card-art-manifest.json` for Alpha card art
  coverage, with approved source-art rows where source assets exist and a
  placeholder row for `aviary_25`.
- Added `npm run validate:runtime`, `npm run validate`, and `npm test` scripts.
- `npm run validate:runtime`, `npm run validate:docs`, and `npm run build` pass.

## 2026-06-13 Runtime Integration Pass

- Migrated `src/main.ts` card templates to derive from `data/game/alpha-cards.json`
  instead of hardcoded prototype card IDs.
- Replaced the old card-specific `switch(card.id)` combat behavior with a small
  effect resolver for the normalized Alpha effect strings.
- Wired Alpha enemy intent patterns from `data/game/alpha-enemies.json` into the
  battle scene.
- Added Flock Stat aggregation for Cohesion, Damage, Cover, Regen, Draw,
  Resonance, Molt Power, and Open Sky Guard during combat.
- Added a lightweight route-state payload to `render_game_to_text`, backed by
  `data/game/alpha-route-map.json`.
- Moved the Roost button up so larger hands from Draw stats no longer overlap
  the control.
- Verified on clean local port `5599` with the web-game Playwright client and
  inspected screenshots in `.artifacts/test/runtime-migration-bird-5599-final`.
- `npm run validate` and `npm run build` pass after the runtime migration.

## 2026-06-13 Battle Readability Pass

- Added persistent Deck and Discard pile controls to the battle footer, with
  visible stack treatments, live counts, and review buttons.
- Added a Deck Review overlay that lists every owned singleton card and its
  current zone: draw deck, hand, or discard.
- Added a Discard overlay so recently played cards can be inspected during
  combat.
- Added a Flock Stats overlay that separates base values, card-granted Flock
  bonuses, and current totals for Cohesion, Wingbeats, Hand Target, Resonance
  Cap, Damage, Cover, Regen, Start Resonance, Molt Power, and Open Sky Guard.
- Moved the Roost control away from the hand and pile area to reduce bottom-row
  clutter.
- Extended `render_game_to_text` with inspect overlay, pile counts, and Flock
  Stat rows for UI verification.
- Verified the Deck, Discard, and Flock Stats overlays on clean local port
  `5599` with the web-game Playwright client.

## 2026-06-13 New Run Route Selection Flow

- Added a dedicated `RouteScene` between the splash menu and combat so starting
  a new run lands on the `Rooftop Blocks` route map instead of immediately
  entering battle.
- Rendered the Alpha route graph from `data/game/alpha-route-map.json`, including
  node types, risk labels, route edges, a selectable first crossing, and previewed
  future nodes.
- Updated `Start Run` and Enter on the menu to open route selection; selecting
  the entry node starts battle with that route node passed into `BattleScene`.
- Updated `Run It Back` to return to route selection for a fresh run start.
- Added route-selection state to `render_game_to_text` and verified the menu ->
  route selection -> battle click-through on clean local port `5599`.

## 2026-06-13 Return To Map After Battle

- Added persistent run state shared by `RouteScene` and `BattleScene`, covering
  singleton deck contents, upgraded cards, current Cohesion, completed route
  nodes, current route node, and route log.
- Updated battle completion so Add to the Flock and Preen still resolve in
  combat, then the run returns to the route map instead of auto-starting the
  next fight.
- Marked the completed combat node on the map and made legal outgoing route
  nodes selectable from the authored route edges.
- Added lightweight immediate resolution for non-combat route stops so Signal,
  Basin, Nest, Market, and Cache nodes can be selected without dead-ending the
  route.
- Verified the full menu -> map -> battle -> reward -> preen -> map loop with a
  state-aware Playwright script and inspected the returned-map screenshot.

## 2026-06-13 Deck Card Detail Inspection

- Upgraded the Deck, Draw, and Discard review overlays from simple lists into a
  clickable card browser.
- Added a selected-card detail pane showing cost, name, bird, suit/type, current
  zone, target, role, current effect, preened effect, Flock Stats contribution,
  and card art when the runtime asset is loaded.
- Kept combat card selection separate from deck inspection so examining cards
  does not accidentally select or play combat cards.
- Extended `render_game_to_text` with `inspectedCard` details for browser
  verification.
- Verified opening the deck, selecting a card row, and reading the detail pane
  with the web-game Playwright client.
- Enlarged inspected card art so the detail pane presents a readable tarot-card
  preview instead of a small thumbnail.

## 2026-06-13 Map Deck Browser And Large Art Pass

- Reworked deck review into a single scrollable card column with Up/Down controls
  and mouse-wheel support.
- Enlarged inspected card art again to a large 2:3 preview area, with card text
  shifted to the right side of the detail panel.
- Added a Deck button to the route map so the flock deck can be inspected before
  choosing the next route node.
- Added route-map deck overlay state to `render_game_to_text`, including
  `deckOverlayOpen` and `inspectedCard`.
- Moved route-map card art loading to deck-overlay open time and guarded optional
  art queueing so fast map-to-battle transitions do not double-load textures.
- Verified deck inspection from both battle and map with Playwright screenshots.

## 2026-06-14 Runtime Route Systems Pass

- Implemented first playable pass for Scrap, Route Marks, Market, Cache, Signal,
  Nest, and combat Scrap rewards.
- Made Route Marks the prototype relic layer: Loose Change Tin, Rain Gutter,
  Wire Map, and Patched Harness.
- Added Resonance spending support through `spendResonance()` and
  `spentResonance` conditions, then converted Plume Horizon and Plume Clash into
  real Resonance spenders.
- Allowed all-enemy and choice-target cards to resolve from hand so runtime cards
  are no longer blocked by target UI gaps.
- Tightened Map 1 route shortcuts so the first map has a denser encounter cadence
  before the boss.
- Fixed duplicate-payload combat node detection so every `street`, `rival`, and
  `boss` node starts a battle, even when two nodes reuse the same enemy payload.
- Added Market flow automation covering two fights, Basin recovery, Market open,
  and Route Mark purchase.
- Updated gameplay docs for spendable Resonance and current prototype
  Market/Route Mark tuning.

## Updated TODO

- Define full Molt/Aviary Arcana card mechanics beyond the current `Hot Feathers` foundation card.
- Replace placeholder non-combat route stop resolution with real Signal, Basin,
  Nest, Market, and Cache screens/reward systems.
- Make reward-selected Arcana cards explicitly visible in the deck viewer flow after reward selection.
- Add a clearer Molt preview on Arcana cards before playing them.
- Replace placeholder text cards with tarot/bird card art treatments.
- Generate optimized in-game thumbnail/card textures from the full-resolution concept art.
- Replace automatic choice-card resolution with a proper choice/discard picker UI.
- Expand Market into seeded inventory by map/node once random-run generation lands.
- Add richer Route Mark effects after the combat loop is tuned.

## 2026-06-14 Next-Level Implementation Spec

- Added `docs/game/next-level-implementation-spec.md` as the detailed roadmap
  for improving Bird Squad from the Spire Codex reference findings and current
  project gaps.
- Covered battle readability, glyph-first route map, encounter data,
  enemy-move data, Market/Supply/Signal/Snag/Route Mark data models, reward
  decision UX, run history, local playtest stats, map theses, and boss-prep
  readouts.
- Linked the new spec from `docs/README.md` as the next quality and
  implementation push.

Follow-up TODO:

- Start the first implementation slice from the spec: top battle resource
  ribbon, relocated Roost command, log toast, compact hand cards, and intent
  badges.

## 2026-06-14 Minor Arcana Audit Repair Pass

- Audited the current Minor Arcana generation pipeline, card data, prompt
  exporter, art bible, runbook, border templates, and compositor.
- Added card-specific `repairDirective` fields for the 21 misaligned Minor
  Arcana cards called out in QA, covering wrong suit reads, exact pip counts,
  bird anatomy, mixed species, extra birds, and countable clutter.
- Updated the prompt exporter so repair directives appear in both full-card and
  center-art prompt packs as hard reject gates.
- Tightened the art bible rows and pip summary for the impacted Basins, Plumes,
  Quills, and Nests cards.
- Added the current repair scope to the Minor Arcana generation runbook and
  documented `repairDirective` in the border-first pipeline.
- Created the full 56-card imagegen center-art repair run at
  `assets/concept-art/minor-arcana-center-art-runs/2026-06-14-imagegen-audit-repairs/`,
  replacing the 21 impacted cards with imagegen repair candidates generated
  from the tightened card prompts.
- Composited the full imagegen repaired set under the locked raster border
  templates at
  `assets/concept-art/minor-arcana-border-first-runs/2026-06-14-imagegen-audit-repairs/`.
- Generated center and final contact sheets under
  `tmp/qa/imagegen-audit-repairs-2026-06-14/`.
- Verified `npm run validate`, `npm run validate:minor-center-art`,
  `npm run validate:minor-composites`, and
  `npm run validate:minor-border-templates -- --require-all`.

## 2026-06-14 Minor Arcana Prompt Contract Tightening

- Added stricter global prompt rules for center-art generation:
  high-resolution pixel art only, no realistic painting, no semi-realistic
  illustration, no smooth digital painting, no photographic rendering, and no
  soft airbrush realism.
- Added explicit overlay-safe composition rules: center the subject mass, keep
  bird heads/feet/tails and every countable pip inside the safe area, and keep
  pips at least one pip-width away from the future border and title cartouche.
- Strengthened avian anatomy language so clothing cannot create shoulders,
  elbows, forearms, sleeve-arms, palms, hands, or humanoid side-limb silhouettes.
- Added or expanded repair directives for the newly reviewed problem cards:
  `cups_04`, `cups_05`, `cups_07`, `cups_10`, `cups_ace`, `cups_elder`,
  `pentacles_05`, `pentacles_06`, `pentacles_07`, `pentacles_09`,
  `pentacles_10`, `wands_ace`, `wands_06`, `wands_07`, `wands_08`,
  `wands_09`, `wands_10`, `wands_fledgling`, `wands_matron`,
  `wands_elder`, `wands_outrider`, `swords_ace`, `swords_03`,
  `swords_04`, `swords_05`, `swords_06`, `swords_07`, `swords_08`,
  `swords_09`, `swords_10`, and `swords_matron`.
- Updated `cups_10` to require exactly ten same-species Mallards and exactly ten
  oval basin-light markers because the family count is part of the visual read.
- Regenerated both Minor Arcana prompt packs and suit briefs from the updated
  source data.
- Verified `npm run validate:docs`, `npm run validate:minor-overlays`, and
  `npm run validate:minor-border-templates -- --require-all`.

## 2026-06-14 Minor Arcana Imagegen Contract Repair Run

- Regenerated the latest QA-flagged Minor Arcana center-art cards with imagegen
  using the tightened contract: no vignette, full-frame urban environments,
  centered birds and pip elements, high-resolution pixel art only, strict
  bird anatomy, and suit-isolated action.
- Replaced the impacted Basins, Nests, Plumes, and Quills cards in
  `assets/concept-art/minor-arcana-center-art-runs/2026-06-14-imagegen-contract-repairs/`.
- Rejected and rerolled candidates that failed exact count, aspect-ratio,
  border-safe composition, wrong-suit motif, or arm/hand anatomy checks before
  copying them into the run folder.
- Composited the full 56-card set with locked raster border templates at
  `assets/concept-art/minor-arcana-border-first-runs/2026-06-14-imagegen-contract-repairs/`.
- Generated QA contact sheets under
  `tmp/qa/imagegen-contract-repairs-2026-06-14/`.
- Verified `npm run validate:minor-center-art`,
  `npm run validate:minor-composites`, and `npm run validate`.

## 2026-06-16 Economy And Route-Decision Balance Pass

- Tightened the early-run economy so choices have more bite: starting Scrap is
  now 40, normal encounters average 24 Scrap, rivals average 65, boss payouts
  are 90, and skipped card rewards pay 12 Scrap.
- Made Market card, Route Mark, and Preen shelves finite per visit. Buying a
  card no longer reveals the next unowned card in the same shop.
- Raised Market prices for cards, Route Marks, and Preen service so entering a
  shop usually means choosing one major purchase unless the run deliberately
  saved Scrap.
- Converted Nest upgrades/removals from free scaling into paid services:
  Preen costs 35, Release costs 40, and Route Mark rigging costs 115.
- Reworked Basin and Cache option labels/outcomes to feel more like route
  moments and less like abstract payout buttons; Supplies, Route Marks, and
  card recruitment now carry small Scrap, Cohesion, or Snag tradeoffs.
- Reduced high-Scrap Signal outcomes so event nodes stop overwhelming the run
  economy.
- Added a smoke test proving Market card shelves sell out after purchase and
  updated the skip-reward Scrap expectation.
- Verified `npm run validate:runtime`, `npm run validate:docs`, `npm run build`,
  and `npx playwright test --reporter=line --workers=1`.
- Captured visual checks at `output/web-game/route-page.png` and
  `output/web-game/market-after-card-buy.png`; route starts at Scrap 40 and the
  post-purchase Market card shelf is visibly disabled.

Follow-up TODO:

- Run several real playtest runs and export `.artifacts/runs.json` so the new
  economy can be tuned from win rate, average deck size, shop purchases, and
  death points instead of feel alone.
- Consider making Markets show two fixed card shelves and one fixed Supply
  shelf later; this pass intentionally fixed the infinite-buy problem without
  broadening shop UI scope.

## 2026-06-16 Post-Combat Preen Cadence Balance Pass

- Changed post-combat reward sequencing so a card reward no longer always chains
  into a free Preen choice.
- Added deterministic Preen windows from encounter reward profiles: routine
  fights can miss their Preen window, while rivals, bosses, and guaranteed
  profile rewards still offer one when unupgraded cards remain.
- Kept the skip-card flow meaningful: skipping now either enters a real Preen
  window or immediately returns to the route map instead of granting automatic
  extra scaling.
- Added smoke coverage proving routine encounters include at least one no-Preen
  outcome for a fixed route seed while rival encounters still guarantee Preen.
- Verified `npm run validate:runtime`, `npm run validate:docs`, `npm run build`,
  and `npx playwright test --reporter=line --workers=1` after the change.
- Ran the web-game Playwright client for two iterations and captured a normal
  page screenshot at `output/web-game-balance2/page-combat.png`; the game boots
  into a readable combat state with the reward-gating code loaded.

## 2026-06-16 Next-Level Run Feedback And Leader Pass

- Added once-per-combat Flock Leader signature hooks for Fledgling,
  Spark-Caller, Talon, Tidewarden, and Roostkeeper so leader choice changes
  combat texture immediately.
- Added boss-prep readiness readouts on the route map and reward tags that call
  out what a card offer helps the current deck solve.
- Extended run summaries and playtest stats with combat results, reward
  fallbacks, skipped offers, and Supplies used so future balance passes have
  sharper telemetry.
- Kept the route-mark expansion item out of scope for this pass.
- Verified `npm run validate:runtime`, `npm run build`, and
  `npm run test:e2e`.

## 2026-06-16 Card Choice Hover Detail Pass

- Added a compact card-shaped hover detail panel for decision surfaces.
- Wired hover details into post-battle card rewards, post-battle Preen choices,
  Market card offers, Market Preen offers, and route Preen/Release pickers.
- Added smoke coverage proving reward, market, and Preen hover details include
  current effect, preened effect, and Flock Stats.
- Verified `npm run build`, `npm run validate:runtime`, and `npm run test:e2e`.
- Captured visual QA at `output/web-game-card-hover-compact/market-hover-detail.png`.

## 2026-06-16 Full Enemy Codex Cast

- Expanded the Codex enemy section from the 48 reserve enemy contracts to the
  complete 81-enemy cast: 33 playable encounter enemies plus 48 reserve
  enemies.
- Normalized playable encounter enemies and reserve contracts into one Codex
  enemy catalog while preserving encounter combat kits, reserve fashion notes,
  district tabs, and runtime art lookups.
- Added smoke coverage proving the Codex reports 81 enemies and renders both a
  playable encounter enemy and a reserve enemy with art and detail text.
- Verified `npm run build`, `npx playwright test tests/smoke.spec.ts -g
  "enemy codex"`, the web-game Playwright client, and a direct Codex screenshot
  at `.artifacts/codex-enemy-page.png`.

## 2026-06-16 Route Map Status Rail

- Added a compact route-map status rail so Cohesion and Scrap are visible
  without opening the Flock menu.
- Surfaced Deck size, Waymarks, and Supplies beside the requested core run
  resources because they affect route planning decisions on the same screen.
- Reflowed the boss-prep strip below the status rail so the added information
  stays readable alongside map preview details.
- Added smoke coverage proving the route map exposes the run status while the
  Flock overlay remains closed.

## 2026-06-16 Route Layout Polish

- Removed the standalone Bird Squad masthead from the route map so the district
  title, navigation buttons, and run resources fit in a tighter header.
- Compressed the route-map resource rail into primary Cohesion/Scrap chips plus
  one inline Deck/Waymarks/Supplies readout to reduce crowding.
- Re-centered the route Flock Stats overlay contents inside a wider panel.

## 2026-06-16 Combat Beauty Polish Completion

- Replaced the remaining abstract combat FX sheet frames with deterministic
  pixel-art effect silhouettes for suit casts, Cover, Heal, Winded, Open Sky,
  and hostile impacts.
- Added a reproducible `tools/generate-combat-fx-atlas.py` pipeline for the
  runtime combat FX atlas so future polish can tune authored frames instead of
  editing opaque binary output.
- Upgraded combat card casting from a floating label cue to a physical card
  ghost that lifts from its hand slot, passes through the Flock Leader, and
  resolves on the target with suit-specific FX.
- Split Flock Leader idle breathing from combat pose reactions so cast, brace,
  heal, and hit cues layer cleanly over the leader art.
- Verified route map canvas clicking through Start Run and Take This Route
  lands in BattleScene without bouncing back to MenuScene.
- Verified `npm run build`, `npm test`, `npm run test:e2e`, the web-game
  Playwright client, and targeted combat screenshots under
  `.artifacts/test-results/`.

## 2026-06-16 Combat FX Quality Lift

- Increased runtime combat FX quality with denser generated pixel frames,
  sparkle breakup, stronger shield facets, basin foam, and richer hostile/status
  silhouettes.
- Added a generated in-scene pixel particle texture plus reusable burst helpers
  for additive motes, directional cast trails, cover flecks, heal motes, and hit
  shards.
- Layered secondary FX into card casts, impact pulses, Cover, Heal, Winded, and
  suit pulse helpers so combat feedback reads as authored motion rather than a
  single overlay sprite.
- Verified `npm run build`, `npm test`, `npm run test:e2e`, and direct combat
  Playwright captures at `.artifacts/test-results/combat-fx-quality-*.png`.

## 2026-06-17 Aviary Master-Border Art Workflow

- Added an Aviary Legend center-art prompt exporter and generated the six-card
  prompt pack under `docs/art/prompt-packs/`.
- Added the Aviary master-border compositor, composite validator, contact-sheet
  helper, and runbook using the existing raster `master.png` border template.
- Generated six Aviary center-art images with imagegen and composited them under
  the master border at
  `.generated/imagegen/tarot/aviary-border-first-runs/2026-06-17-imagegen-aviary-master-border-v1/`.
- Recorded QA notes and contact sheets under
  `tmp/qa/aviary/2026-06-17-imagegen-aviary-master-border-v1/`.
- Verified `npm run validate:docs`, `npm run validate:minor-border-templates -- --require-all`,
  `npm run validate:aviary-composites`, and `npm run validate`.

## 2026-06-17 Aviary Runtime Art Wiring

- Promoted the six approved Aviary master-border composites into the runtime
  card-art manifest as approved sources.
- Generated optimized portrait, thumbnail, and icon WebP assets for
  `aviary_22` through `aviary_27`.
- Verified the Codex can load all six Aviary runtime card textures and captured
  an in-game detail view at `.artifacts/aviary-codex-runtime-art.png`.

## 2026-06-17 Aviary Quality Expansion

- Added eight suitless Aviary quality cards (`aviary_28` through `aviary_35`)
  to the identity data, runtime card data, reward pool, Codex meanings, bird
  facts, and placeholder art manifest.
- Added `kind: "aviary"` to the gameplay data contract and validators so Aviary
  cards are not treated as tarot cards or suit cards.
- Updated art docs, alpha/game design counts, audit targets, the Aviary prompt
  exporter, and the Aviary compositor to support 14 Aviary cards and
  compositor-owned top badge/title marks instead of roman-numeral tarot trumps.
- Regenerated the Aviary center-art prompt pack and verified with runtime/docs
  validation, content audit, build, full validate, smoke tests, and the generic
  web-game client.

## 2026-06-17 Aviary Fieldcraft Expansion

- Added a second eight-card suitless Aviary batch (`aviary_36` through
  `aviary_43`) centered on practical bird qualities: drumming signal, footwork,
  methodical search, balance, plunge commitment, current resilience, formation
  drafting, and tool use.
- Wired the cards into runtime data, reward pool, Aviary arcana identity data,
  Codex meanings, bird facts, placeholder card art manifest entries, art bible
  rows, alpha spec card tables, and the generated Aviary center-art prompt pack.
- Updated current deck/count contracts to 100 playable cards and a 90-card reward
  pool.
- Raised the app-entry bundle-size guard to 540 KB for the current full-content
  build while leaving bundle-size validation active.
- Verified with runtime/docs validation, content audit, build, full validate,
  tests, full smoke suite, `git diff --check`, and the generic web-game client.
- Verified `npm run validate:runtime`, `npm run validate:runtime-assets`,
  `npm run build`, and `npm run validate`.

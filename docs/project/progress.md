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

## 2026-07-13 Enemy Turn Hustle

- Added hold-to-accelerate for familiar non-boss enemy sequences on Standard
  and Snappy pacing. Wind-up, Commit, Recovery, and interludes accelerate at
  2.2x only after minimum readable windows; Impact, first sightings, bosses,
  and Cinematic pacing remain protected.
- Added a compact contextual state to the existing beat plaque and support for
  keyboard, pointer/touch, and controller holds. Text-state telemetry reports
  availability, eligibility, held input, active acceleration, and multiplier.
- Moved enemy-turn orchestration into the lazy combat-FX module, preserving
  ordered effects and damage-at-Impact while reducing combined boot code to
  723.8 KB minified / 188.6 KB gzip.
- Verified strict TypeScript, focused sequencing/browser coverage, production
  build and bundle gates, the required web-game client, and captures at
  2560x1600, 1440x900, and 844x390 with no page or console errors.

## 2026-07-13 Playtest Evidence Dashboard

- Extended local run summaries with per-fight duration, exact fatal move,
  route-offer denominators and decision time, reward decision time, combat pace,
  and First Flight Guide state.
- Rebuilt `npm run stats:playtest` as a Markdown dashboard covering the run
  funnel, first-fight/decision timing, economy, offer-based reward and route
  pick rates, Leader performance, death distribution, and pace preference.
- Added a clearly labeled ten-seed pipeline harness when no human run export is
  present. The generated report explicitly rejects synthetic balance claims.
- Verified strict TypeScript, live summary regression coverage, dashboard
  generation, production build, and bundle validation at exactly 725.0 KB
  combined boot code without changing a threshold.

## 2026-07-14 Production Display Boundary

- Completed the desktop-first mobile product direction with a branded,
  game-art-backed gate for portrait and compact landscape displays.
- Added a dedicated platform lifecycle controller that makes the hidden game
  inert, sleeps the Phaser loop after boot, preserves current run state, and
  refreshes scaling before resuming on a supported display.
- Declared support for desktop and landscape-tablet viewports of at least
  1000x560 CSS pixels on the loading surface and in the project README.
- Raised compact title, audio, close, difficulty, flight-length, and run-command
  interactions to a 56-game-pixel minimum. Representative controls measure at
  least 44.8 CSS pixels at the 1024x768 tablet breakpoint.
- Added browser coverage for frame freezing, compact-landscape gating,
  rotate-to-resume behavior, ARIA state, platform copy, and touch geometry.
- Visually verified the production build at 390x844, 1024x768, and 2560x1600;
  the platform gate and both supported layouts render without overlap or new
  browser warnings/errors.

## 2026-07-15 Lazy Profile And System Overlays

- Moved Flock Record presentation and Profile-only icon ownership into the lazy
  `profile-scene` module; fixed redraws accumulating Escape and mute listeners.
- Moved Pause, Settings, and How-to-Play presentation into a shared lazy
  `system-overlays` module with visible loading/failure handling.
- Raised system-overlay and Profile action geometry to 56 game pixels and added
  focused browser assertions for tablet-safe touch targets.
- Shortened and enlarged How-to-Play copy for faster scanning at the smallest
  supported scale, and removed the final achievement/Return visual collision.
- Extended deployment validation to require one Profile chunk and one system
  overlay chunk while rejecting modulepreloads for both.
- Reduced production boot code to 675.0 KB for the app entry and 700.8 KB
  combined, clearing both preferred budgets without warnings.
- Focused Profile, Settings, guide, and first-flight tests pass. Production
  screenshots at 2560x1600, 1280x720, and 1024x768 are clean, with no browser
  warnings or errors.

## 2026-07-15 Sequencing And Regression Closure

- Added generation-aware Menu asset refreshes so stale asynchronous callbacks
  cannot interrupt a title launch, while preserving an open Leader tooltip
  through a valid redraw.
- Kept normal route selection constrained to reachable nodes and retained an
  explicit inspector path for viewing the boss-preparation dossier before the
  final crossing.
- Made Codex detail flow use measured wrapped-text heights. The longest current
  dossier now reports a 244-pixel scroll range and remains contained at
  2560x1600 and 1024x768.
- Moved shared scene time, texture, display-tree, and tween helpers into
  `scene-runtime` in `game-core`. Production measures 674.6 KB app entry,
  27.0 KB game core, and 701.6 KB combined boot code / 183.5 KB gzip, clearing
  all preferred targets without warnings.
- Passed runtime/docs/assets/bundle/cache/enemy/overlay validation, all 8
  critical sequencing tests, and the complete 147-test Playwright suite in
  18.0 minutes.

## 2026-07-15 Combat Redraw Ownership

- Added a BattleScene frame scheduler that coalesces noncritical same-frame
  refreshes while preserving synchronous wind-up and impact sequencing.
- Moved battlefield scenery and the combat hand into persistent layers. The
  atmosphere tween survives UI updates, unchanged hand cards keep their Phaser
  objects, and compact art plus Flow cues refresh in place.
- Removed the duplicate next-hand build during enemy-to-player handoff. Player
  attacks retain two required full passes; enemy turns now use three instead of
  four and reveal the replenished hand together with input unlock.
- Added production telemetry and a critical regression for request coalescing,
  pass counts, persistent object identity, and scenery/hand build reuse.
- Preserved the district-advance flourish through late RouteScene asset redraws
  with a bounded replay window; its sound and telemetry still fire once.
- Final three-run production medians are 222.0 ms per player attack and 237.4 ms
  per enemy turn, versus initial observations of 231.7 ms and 346.8 ms.
- Verified the production WebGL surface at 2560x1600 and 1024x768, including an
  enemy wind-up capture. Both layouts remain aligned and nonblank.
- Production measures 680.4 KB app entry, 27.0 KB game core, and 707.4 KB
  combined boot / 184.9 KB gzip. The app entry is 5.4 KB over its preferred
  target but safely below the hard gate; combined boot remains below target.
- Strict TypeScript, the final production build, focused district-redraw
  coverage, and the complete 148-test browser suite pass; the full suite took
  18.6 minutes on one Chromium worker.

## 2026-07-15 Exact Combat Forecast And Profile Reveal Ownership

- Extended the lazy combat outcome simulator with exact before/after snapshots
  for each enemy and the flock while preserving the same ordered effect resolver
  used by committed cards.
- Selected attacks now shade pending enemy Cohesion loss, mark the remaining
  health boundary, and show `AFTER N` or `LETHAL` under the target health rail.
  The selected-card summary exposes exact target, Cover, Flow, and Surge deltas.
- Selection and deselection update only the existing preview objects. Focused
  coverage proves zero full battlefield redraws, exact preview/live parity, and
  lethal resolution.
- Split the Profile record flourish into persistent decoration and a one-shot
  reveal. Badge-tab and late-asset rerenders no longer replay its particles or
  `profileRecord` audio cue; the existing listener-ownership checks remain green.
- Production captures at 2560x1600 and 1024x768 show nonlethal and lethal
  forecasts clear of intents, actors, target rings, and hand text, with zero
  page or console errors.
- Production measures 682.9 KB app entry, 27.0 KB `game-core`, and 709.9 KB
  combined boot / 185.5 KB gzip. Combined boot remains under its preferred
  target; the app entry retains its existing over-target advisory without a
  threshold change.
- Documentation, runtime, asset, bundle, deployment-cache, enemy, overlay, and
  all 9 critical sequencing gates pass. The complete 149-test Chromium suite
  passes in 17.8 minutes on one worker.

## 2026-07-15 Journaled Save Recovery

- Added exception-safe browser storage access plus mirrored `.backup` journals
  for the Flock Record, active flight, First Flight guide, and run history.
  Valid mirrors restore corrupt or missing primary keys; unrecoverable payloads
  are bounded, quarantined under `.corrupt`, and removed from live play.
- Added schema-aware account, guide, history, and active-run sanitization.
  Progression counters reject unknown Leader IDs, run totals remain coherent,
  and Ascension unlocks can be reconstructed from the best recorded win.
- Settings and audio preferences now remain usable when browser storage throws.
  Corrupt run history no longer prevents future telemetry saves or exports.
- The title reports a recovered checkpoint or isolated save in one compact
  bottom status strip. Its formatter and renderer live in a 1.1 KB lazy chunk,
  so normal launches do not load recovery presentation code.
- Production captures at 2560x1600 and 1024x768 show the notice contained below
  the launch controls with zero page or console errors. Production measures
  683.1 KB app entry, 28.6 KB `game-core`, and 711.7 KB combined boot / 186.2 KB
  gzip. Hard gates pass; the existing app-entry warning and a 1.7 KB combined
  preferred-target advisory remain visible without changing either threshold.
- Strict TypeScript, focused blocked-storage/corruption/interrupted-write cases,
  all release validators, all 9 sequencing gates, and the complete 151-test
  Chromium suite pass. The full browser run completed in 17.3 minutes.

## 2026-07-15 Keyboard And Controller Settings Navigation

- Made all six shared Settings rows directly navigable from Menu, Route, and
  paused Combat. Arrow keys and Tab move focus, Left/Right adjust values, and
  Enter/Space activate the focused control.
- Added standard gamepad support: D-pad navigation and adjustment, A to
  activate, and B to close. Music and SFX move in five-percent steps while
  Audio, Motion, and Combat Pace retain their existing cycles.
- Kept one visible focus ring and six stable row targets. The focused row is
  stored per scene in Phaser's registry, so lazy icon redraws and scene-local
  Settings reconstruction preserve position without adding host-scene fields.
- Added shutdown-owned keyboard and gamepad cleanup. Regression coverage proves
  one listener and one ring while open, no retained listener or ring after
  close, and focus persistence while volume, Motion, and pace redraw controls.
- `render_game_to_text` now reports the focused index and label in all three
  host scenes. The required web-game client completed a real keyboard
  adjustment, and settled production captures at 2048x1536 and 2560x1600 show
  the focus ring contained within Music and Combat Pace with zero browser
  errors.
- Production measures 683.4 KB app entry, 28.6 KB `game-core`, and 712.0 KB
  combined boot / 186.3 KB gzip. The lazy `system-overlays` chunk is 15.8 KB /
  5.3 KB gzip. All hard gates pass; the unchanged entry and combined preferred
  targets continue to emit advisories without a threshold change.
- Focused Settings coverage passes 3/3, and the full release validator passes
  documentation, runtime, 617-asset, bundle, deployment-cache, enemy, overlay,
  and all 9 critical sequencing checks.
- The complete 152-test Chromium suite passes in 18.2 minutes on one worker.

## 2026-07-16 Configurable Keyboard Controls

- Replaced the redundant Settings Display row with a focused Controls entry;
  Full Screen remains a dedicated command at the bottom of Settings.
- Added twelve remappable actions across Play and Utility pages: Confirm, Back,
  Previous, Next, Pause, Roost, Hustle, Skip Reward, Mute, Full Screen,
  Settings, and How to Play. Number keys `1-9` and Tab remain reserved for
  direct game selection and navigation.
- Bindings apply live across Menu, Profile, Route, Combat, reward, pause, and
  enemy-turn Hustle input. Assigning an occupied key swaps the displaced action
  onto the prior key, so every action remains reachable.
- Added exception-safe local persistence, malformed-data fallback, session-only
  operation when storage is blocked, Reset Defaults, human-readable key labels,
  and live subscriber refresh after each change.
- The modal Controls surface supports pointer, keyboard, and standard gamepad
  navigation. It retains page, focus, and capture state through valid lazy
  Menu redraws, owns host input while open, and defers listener refresh so the
  captured key cannot immediately trigger its newly assigned action.
- `render_game_to_text` reports customization, modal/page/focus/capture state,
  and all twelve live bindings in Menu, Route, and Battle. How to Play now
  derives its quick-key copy from the active map.
- Menu, Route, and Combat preload the complete generated close command. A
  branded existing medallion now serves as the production favicon, eliminating
  the browser's fallback `/favicon.ico` 404.
- The required web-game client exercised both pages. Final production captures
  at 1024x768 and 1280x800 CSS pixels with DPR 2 show stable rows, contained
  focus rings, complete close commands, and zero console or request errors.
- Production measures 688.5 KB app entry, 28.6 KB `game-core`, 22.0 KB lazy
  `system-overlays`, and 717.2 KB combined boot / 188.2 KB gzip. All hard gates
  pass; the 675 KB entry and 710 KB combined preferred targets remain explicit
  advisories without changing thresholds.
- Strict TypeScript, focused blocked-storage/remapping/Settings/Profile/Hustle
  coverage, the full release validator, all 9 sequencing checks, and the
  complete 153-test Chromium suite pass. The full suite took 19.1 minutes on
  one worker.

## 2026-07-16 Device-Aware Effects Quality

- Added Auto, Full, and Lean Effects quality as a seventh shared Settings row,
  with pointer, keyboard, and standard-gamepad operation across Menu, Route,
  and paused Combat.
- Auto responds to Save Data and constrained memory/processor signals. Explicit
  preferences persist safely, cache after the first read, and remain active for
  the session when browser storage throws.
- Lean removes passive title particles, reduces route ambience and reward
  ornament, halves optional combat particle density, caps concurrent particle
  bursts at two, and cuts opening-district atmosphere strips from 21 to 10
  while preserving primary attack, tell, impact, and reward feedback.
- Added text-state evidence for preference/effective quality, selection reason,
  cost budgets, title emitter ownership, and combat atmosphere pressure.
  Four focused regressions pass in 1.3 minutes and prove Full/Lean runtime
  changes, cross-scene propagation, local persistence, blocked-storage fallback,
  and seven-row input navigation.
- The required game client and production captures at 1280x720, 2560x1600,
  and 1024x640 show a clean seven-row panel with no clipping, overlap, blank
  frames, or console errors.
- Production is 690.7 KB app entry, 28.6 KB game core, 23.3 KB lazy system
  overlays, and 719.3 KB combined boot / 188.9 KB gzip. Hard bundle gates pass;
  existing preferred-target advisories remain.
- Documentation, runtime data, all 617 runtime assets, bundle/deployment
  contracts, enemy variety, and all 56 Minor Arcana overlays validate. All nine
  critical sequencing tests pass in 2.1 minutes.

## 2026-07-18 Compact Runtime Item Art

- Added a reproducible 256 px compact tier for all Supplies and Waymarks plus a
  dedicated 96 px Scrap texture; Codex dossiers retain the full 512 px tier.
- Rewired route/combat preload, item drawers, rewards, market fallbacks, combat
  feedback, and Codex grids to compact cache keys without changing gameplay.
- Runtime item transfer falls from 9,974.6 KB to 1,583.7 KB (84.1%); always-
  preloaded Scrap falls from 601.6 KB to 4.7 KB.
- Added 32 KB budgets and complete runtime-data counterpart validation. Six
  focused item scenarios pass, and the production client verified 96/256 px
  textures, compact network responses, crisp visuals, and zero browser errors.

## 2026-07-18 Runtime UI WebP Tier

- Added a reproducible same-dimension, alpha-preserving WebP delivery tier for
  all 257 generated runtime UI icons, medallions, chips, and panel frames.
- Reduced that tier from 38.11 MiB of PNG inputs to 8.47 MiB of production
  WebPs (77.8%) without changing Phaser texture keys or loader behavior.
- Rewired the Phaser manifest, direct runtime helper, and favicon; production
  builds now emit one hashed WebP and no PNG for every runtime UI ID.
- Added exact PNG/WebP parity, stale-output rejection, 120 KiB budgets, and
  deployment guards. Five focused multi-surface regressions pass.
- The required production client inspected title and How-to-Play at 1280x720;
  live requests contain only hashed WebPs for the checked UI assets and no
  browser errors.
- Release validation and the complete 155-test Chromium suite pass; the full
  browser run took 22.0 minutes on one worker.

## 2026-07-18 Runtime FX WebP Tier

- Added a reproducible same-dimension, alpha-preserving WebP delivery tier for
  all 71 used title, route, and combat FX sources.
- Reduced FX transfer from 14.84 MiB to 5.02 MiB (66.2%) while preserving
  Phaser keys, spritesheet frames, and staged loader ownership.
- Removed one unreferenced 64x64 particle orphan; the live particle system uses
  the generated combat FX atlas.
- Added exact PNG/WebP parity, stale-output rejection, a 140 KiB budget, and
  deployment checks requiring one hashed WebP and no emitted PNG per FX ID.
- Four focused visual/timing regressions pass. The required production client
  reached a complete battle at 1280x720 with all essential FX loaded, clean
  visuals, WebP-only request evidence, and zero browser errors.
- Release validation and the complete 155-test Chromium suite pass; the full
  browser run took 22.1 minutes on one worker.

## 2026-07-18 First-Combat Outcome FX Deferral

- Measured three cold production route-to-combat transitions and found victory
  rally, victory fanfare, and boss phase-break art resident before first input.
- Split those three textures from the opening optional pack. Normal encounters
  warm them on the first committed card or Roost action; boss/elite encounters
  retain setup-time loading.
- Cold transition transfer falls by 314,015 bytes, decoded combat residency by
  3,014,656 bytes, and the median worst frame gap from 394 ms to 360 ms. Median
  time-to-input remains neutral within noise.
- A first-card production probe confirms all three hashed WebPs load on demand.
  The required client reached a clean playable battle with the pack deferred,
  and the focused FX plus full encounter regressions pass.
- `npm run validate` passes every release gate and `npm test` passes all 155
  Chromium scenarios in 20.8 minutes. Two wall-clock test flakes found by the
  first full run were made deterministic, then passed three repeated focused
  runs and the complete clean rerun.

## 2026-07-18 Route Event Art On-Demand Loading

- Profiled production route -> combat -> route cycles and retained Phaser's
  global texture cache because the combat return already transfers zero bytes.
- Removed the eager all-event load from ordinary route creation. Basin, Cache,
  Signal, Nest, Rival, and Market now queue only their matching scene art when
  the overlay opens, then redraw through the existing fallback-safe path.
- Ordinary-route decoded texture residency fell from 181,410,016 to
  104,040,156 bytes (-42.6%); first-battle residency fell from 260,454,384 to
  183,291,560 bytes (-29.6%). The 18 deferred textures total 3,979,034 bytes on
  disk and about 76.47 MB decoded.
- A production Basin probe loaded exactly its three matching textures in
  677,846 transfer bytes. Focused lazy-load, all-event, and Market presentation
  regressions pass, and the shared client captured the optimized route with no
  page or console errors.
- Closure found and fixed a route-travel lifecycle race where a late asset
  callback could redraw during commitment and destroy the generated streak.
  Travel now preserves its transient objects/tweens until handoff; travel plus
  lazy-load coverage passes three repeated focused runs.
- Final release closure is green: `npm run validate` passes all gates and
  `npm test` passes all 156 Chromium scenarios in 19.7 minutes.

## 2026-07-18 District Encounter Objective Depth

- Re-audited the current game before selecting the pass: 32/32 content checks
  pass with no drift, the 500-seed economy simulation meets every authored
  target, balance pressure remains progressive, and the ten-row seeded
  dashboard is explicitly telemetry evidence rather than human balance proof.
- Replaced the shared late-run objective pool with district-specific strategic
  pools. Added `Keep A Reserve` (Roost with banked Wingbeat) and district-scaled
  damage-blocking goals, while retaining Flow, Surge, restraint, speed, Cover,
  no-damage, and priority-target plans where they fit each district.
- Encounter goal text state now reports exact live progress. The battle HUD
  shows the compact progress value and exposes the full condition/reward in an
  interactive tooltip; save sanitization preserves both new objective types.
- Five focused district-pool, resolution, HUD/tooltip, horizontal-reward, and
  checkpoint tests pass. The required shared production client reached combat
  without errors, and the separately inspected Canal objective capture proves
  `Wingbeat banked 1/1` and its tooltip remain clear of the HUD and hand.
- Release closure passes: `npm run validate` is green across documentation,
  runtime data, all 959 optimized assets, legacy-world rejection, bundle/cache
  rules, enemy variety, Minor Arcana overlays, and nine sequencing gates;
  `npm test` passes all 158 Chromium scenarios in 19.9 minutes.

## 2026-07-18 Legacy World Asset Removal

- Removed 117 superseded world files totaling 64.7 MB: 16 old splash/title
  generations, 46 old route-map atlases/crops, 28 obsolete route-event source
  layers, 20 old runtime route-event layers, five retired backdrop variants,
  and two obsolete runtime node atlases.
- The remaining route/battle graph uses only explicit current assets: four
  district world backdrops, four district battlefields, four boss battlefields,
  ten current route-event plates/residents, four props, the market kit, and the
  eight splash-v7 route-node crops. The laminated planning-board path and broad
  world-art globs remain forbidden.
- `tools/build-runtime-ui-art.py` now regenerates the current v11 title image
  instead of the retired v4 output. `tools/validate-world-assets.mjs` now exact-
  allowlists 42 runtime/style assets and 41 matching source assets, scans runtime
  and build code for retired names, and runs through `validate:runtime-assets`.
- Production build and `npm run validate` pass. The shared web-game client drove
  title -> RouteScene -> BattleScene; inspected route and battle captures show
  the current Rooftop Blocks world art, matching text-state keys, and no console
  error artifact.
- Hardened the canonical inventory after a follow-up audit: the validator now
  checks every file below all ten owned world-art roots. Retired art cannot be
  hidden in an unregistered nested directory and later mistaken for a current
  source; new world files must enter the exact allowlist when they are wired.

## 2026-07-18 Leader And Ascension Personal Records

- Closed the horizontal-mastery promise behind `Set a new personal record`.
  Every winning flight now tracks clear count and fastest total beats by Leader,
  Full/Quick length, and Ascension tier. Quick results never overwrite Full
  records, slower repeats do not claim a record, and Full clears alone remain
  responsible for unlocking higher Ascension tiers.
- First clears and faster repeats become `record` outcome highlights. The strip
  uses `NEW PROGRESS`, counts records separately from badges/unlocks, and places
  record names first so a four-item first-win celebration does not hide them.
- Profile Leader rows now show highest Full Ascension plus fastest Full and Quick
  flights (`A2 / FULL 42B / QUICK 24B`). The global chip is labeled `Boss
  Fastest` to preserve its existing final-fight meaning without ambiguity.
- Account migration defaults old saves to an empty record table rather than
  fabricating history. Sanitization accepts only known Leaders, Full/Quick modes,
  Ascension 0-6, positive clear counts, and positive times; mirrored checkpoint
  recovery preserves valid records.
- Production optimization kept player-facing formatting in the lazy Profile and
  outcome modules. Final bundles are 29.7 KB for `game-core`, 664.7 KB for the
  app entry, and 694.4 KB combined boot code; all existing hard budgets pass.
- Focused record, outcome, Profile, migration, and recovery regressions pass.
  The shared production client and populated production probe were visually
  inspected with matching text state and zero console errors; proof is
  `.artifacts/leader-record-profile-populated.png`. `npm run validate` passes all
  release gates, and the complete Chromium suite passes 159/159 in 20.2 minutes.

## 2026-07-18 Enemy-Local Priority Objective Read

- Closed the remaining encounter-goal placement gap for priority fights. The
  actual target now carries a compact gold objective marker immediately above
  its Cohesion rail and beside its Tell, including the remaining Beat window.
- The marker shares the objective resolver used by the global goal plate. It
  turns into `OBJECTIVE MISSED` after the deadline, keeps the combat victory
  valid, and exposes the full condition plus Scrap reward through hover.
- Added a production regression proving the marker follows the configured enemy,
  reports `2 BEATS` on Beat 2 of a Beat-3 deadline, remains interactive, and
  switches to the failed state when the deadline passes.
- Production proof is `.artifacts/objective-target-production.png`; visual
  inspection confirms the marker does not cover enemy art, Cohesion, Tell, or
  the global objective plate. The required shared client also drove title ->
  route -> battle with a complete hand/enemy state and no browser errors.
- Strict TypeScript and two focused objective/HUD tests pass. `npm run validate`
  is green across docs, runtime data, all 951 optimized assets, canonical-world
  rejection, bundle/deployment contracts, art contracts, and nine sequencing
  gates. App entry is 665.0 KB, combined boot code is 694.7 KB, and the lazy
  foreground renderer is 7.2 KB.

## 2026-07-18 Encounter Objective Audio And Celebration

- Closed the feedback gap where an encounter objective could complete or fail
  silently between renders. Every active-to-terminal transition now fires one
  generated callout plus a result-specific procedural audio cue.
- Completion uses a bright ascending motif and reports the earned Scrap;
  failure uses a softer descending cue and `GOAL MISSED` so the optional goal is
  clear without making the continuing fight feel punitive.
- A resolver latch owns the transition, so redundant and coalesced redraws
  cannot replay either sound or callout. Text state exposes current feedback
  status, burst count, and visibility for production verification.
- Extended only milestone callouts to a readable roughly 1.3-second lifetime.
  Production captures prove both outcomes remain clear of the enemy Tell,
  target rail, objective plate, combat log, and hand:
  `.artifacts/objective-feedback-complete-production.png` and
  `.artifacts/objective-feedback-missed-production.png`.
- Strict TypeScript and three focused objective HUD/target/feedback scenarios
  pass. Production text state matches both captures with one burst, one matching
  cue, no opposite cue, and no console or page-error artifact.
- `npm run validate` passes all release gates and nine sequencing scenarios.
  The app entry remains within target at 666.4 KB, combined boot is 696.2 KB,
  and `game-core` remains within its hard cap at 29.7 KB.

## 2026-07-18 Persistent High Contrast Accessibility

- Added Standard/High Contrast as the eighth shared Settings row. The option is
  available from title, paused route, and paused combat Settings and applies to
  the whole game surface before scene boot, so Profile, Codex, rewards, and
  outcomes inherit it without scene-specific wiring.
- High Contrast increases luminance separation while retaining the authored
  enamel, brass, cyan, tarot, and rooftop artwork. It changes no combat rules,
  timing, random outcomes, input locks, progression, or asset selection.
- The preference persists through safe browser storage and keeps a session
  fallback when storage is blocked. Text state reports preference, effective
  state, and whether the expected game-container treatment is actually applied.
- Pointer, keyboard, and standard-gamepad coverage proves live switching;
  focused tests also cover Menu/Route/Battle propagation, reload persistence,
  blocked storage, exact row/focus ownership, and configurable-control reuse.
- The required production client reached the complete eight-row Settings panel
  with eight generated row frames and no error artifact. Inspected Standard and
  High captures are `.artifacts/high-contrast-standard-production.png` and
  `.artifacts/high-contrast-high-production.png`; their state files report the
  matching preference and applied status.
- A separate production combat proof at
  `.artifacts/high-contrast-battle-production.png` reports one enemy, five hand
  cards, ready foreground/hand renderers, and applied High Contrast; inspection
  confirms the Leader, enemy, Tell, Cohesion rails, HUD, event rail, piles, and
  card art all remain distinct. No console/page-error artifact was emitted.
- `npm run validate` passes every release gate, including the 42-runtime/
  41-source canonical-world allowlist and legacy-path rejection, plus all nine
  sequencing scenarios. Production is 667.4 KB app entry, 697.1 KB combined
  boot code, 29.7 KB game core, and 24.1 KB lazy system overlays.

## 2026-07-18 Molt Power Resolver And Canonical Rule Repair

- Closed a live progression defect where cards and the Flock Stats panel granted
  Molt Power but neither combat preview nor card resolution consumed the stat.
  Every Molt-active card now applies the deck's Molt Power once to its first
  positive damage, Cover, or recovery line; area damage receives half, rounded
  up, per target, and a zero-value burst cannot waste the bonus.
- Preview and live resolution share the same small Molt Power helper. Selected
  card outcomes report the applied amount, while combat telemetry records total,
  bursts, and rendered feedback. The production action uses an unobstructed
  `MOLT POWER +N` callout, orange sparks, combat-log confirmation, and the normal
  target damage read.
- Replaced the retired single-card Molt documentation with the shipped whole-turn
  stance: alternate `moltEffects`, 1-Wingbeat discount for active non-Molt cards,
  once-per-card Molt Power, Roost termination, and one Open Sky enemy phase.
  Documentation validation now rejects the old next-card/end-after-card phrases.
- Five focused Molt browser scenarios pass, including normal/Molt separation,
  preview/live parity, stat scaling, first-positive-line ownership, half-strength
  area damage, derived targeting, and Preen behavior. `npm run validate` passes
  every release gate and all nine sequencing scenarios; game core remains within
  its hard cap at 29.9 KB and combined boot code is 698.3 KB.
- The required shared production client completed title -> route -> battle with
  no errors. The inspected live proof is `.artifacts/molt-power-production.png`:
  starter Molt Power 3 turns Locked Nest's 7 damage into 10, updates Roof Rat
  from 30 to 20 Cohesion, and emits one readable bonus burst with no console or
  page-error artifact.
- Added a dedicated procedural Molt Power cue: a brief feather-noise accent and
  rising three-tone shimmer whose intensity follows the applied bonus. The pure
  preview stays silent, normal cards emit nothing, and the resolver-owned spend
  produces exactly one cue even when other Molt lines follow. It inherits the
  existing mute and SFX-volume controls.
- A fresh production interaction first unlocked Web Audio through the real title
  Start Run control, then resolved Molt Power in battle. Text state reports one
  Molt Power cue and one visual burst with the enemy at 20/30 Cohesion; the
  inspected frame keeps `MOLT POWER +3` in a stable upper-center lane clear of
  the simultaneous four-suit rally wheel. No console/page-error artifact was
  emitted. Three focused audio/preview/resolution scenarios and `npm run
  validate` pass; combined boot remains within target at 698.5 KB.
- Added the delayed contextual Molt lesson called for by the experience audit.
  It activates only after the core First Flight Guide is complete and a true
  Molt-mechanic card enters hand, then uses a compact orange HUD explanation,
  card pulse, and `MOLT CARD` chip without blocking other plays. Playing that
  card retires the lesson persistently; Skip Guide suppresses it and Replay
  Guide resets it.
- Focused browser coverage passes skipped, active, seen, played, and restarted
  states. The required shared production client completed title -> route ->
  battle, and `.artifacts/molt-guide-production.png` shows the final Hot Feathers
  treatment with matched text state and no console/page errors. `npm run
  validate` passes all release gates and nine sequencing scenarios at 700.0 KB
  combined boot, 671.6 KB app entry, and 28.4 KB game core.

## 2026-07-18 Reward Decision Outcome Previews

- Added an always-visible primary consequence chip to every card reward. Add
  choices show the exact deck-size change before commitment; Preen choices show
  the first changed normal or Molt effect, with a changed Flock Stat as fallback.
- The main scene supplies the live raw card/deck decision contract and the lazy
  reward renderer owns compact presentation diffing. This keeps reward-only work
  out of boot while allowing the same source values to drive preview and commit.
- Focused Chromium coverage commits both decision types and proves the displayed
  Add delta against the resulting deck size and the Preen contract against the
  upgraded card's actual effect text.
- The required shared production client completed title -> route -> battle with
  audio unlocked. Inspected focused captures are
  `.artifacts/reward-delta-production.png` and
  `.artifacts/preen-delta-production.png`; all three offers remain visible, the
  latter includes clear `Heal 1 > Heal 2` and `Gain 6 Cover > Gain 8 Cover`
  examples, text state matches, and no console/page errors were recorded.
- `npm run validate` passes every release gate and all nine sequencing scenarios.
  Production remains within budget at 700.4 KB combined boot, 672.0 KB app
  entry, 28.4 KB game core, and 12.2 KB for the lazy reward renderer.

## 2026-07-18 Final Card-Picker Consequence Previews

- Extended primary outcome previews into the shared final-choice picker used by
  Market Preen/Release services and route workbenches. Every candidate now owns
  a compact consequence plate inside its card rather than requiring a hover.
- Preen compares the first changed normal or Molt effect, then falls back to an
  aggregated Flock Stat delta. Its formatter isolates changed numbers from long
  shared prefixes (`Deal 2 > Deal 3`), retains useful effect context (`Gain 6
  Cover > Gain 8 Cover`), and identifies newly added effects. The full existing
  hover dossier remains available for unabridged rules.
- Release shows the exact live deck reduction on all candidates. With repeated
  route removals, the rendered contract recalculates from `DECK 10 > 9` to
  `DECK 9 > 8` immediately after the first commit.
- Three focused Chromium scenarios pass Market Preen, Market Release, and the
  repeated route-workbench path. They verify visible text-state deltas, Scrap
  payment timing, upgraded state, deck mutation, and recalculation after commit.
- The required shared production client completed title -> route -> battle with
  audio unlocked and no error artifact. Inspected focused proofs are
  `.artifacts/card-picker-preen-production.png` and
  `.artifacts/card-picker-release-production.png`; both match text state and
  preserve card art, costs, names, navigation, and all ten competing choices.
- Bundle validation passes at 702.5 KB combined boot, 674.1 KB app entry, 28.4
  KB game core, and 12.2 KB lazy reward rendering.

## 2026-07-18 Enemy-Move And Input-Friction Telemetry

- Added resolver-owned enemy-move pressure rows to every combat summary: enemy
  and move identifiers, readable move label, actual Cohesion lost, Cover
  blocked, and hit count. Repeated hits aggregate under the same move boundary.
- Corrected damage telemetry at enemy, card/self-damage, and Fouled sources so
  overkill cannot inflate Cohesion loss. A 20-point Review Strike against one
  remaining Cohesion now records exactly one point lost.
- Added separate invalid-action and cancelled-selection counters at the live
  card and target click handlers. Selecting an enemy-target card and clicking it
  again counts as a cancellation; missing or unaffordable cards and invalid
  targets count as input friction, while animation locks do not.
- Carried both contracts through completed-combat cloning, active-run save
  sanitization, continuation, run aggregation, and local playtest history.
- Extended the developer dashboard with Enemy Move Pressure and Input Friction
  tables. Its seeded fallback remains explicitly labeled as pipeline evidence
  and is not treated as human balance evidence.
- Focused Chromium coverage passes live loss emission, cross-fight aggregation,
  exact overkill accounting, and checkpoint recovery. The required shared
  production client completed title -> route -> battle with no error artifact.
- Inspected production proof at `.artifacts/telemetry-outcome-production.png`
  matches `.artifacts/telemetry-outcome-production-summary.json`: Review Strike
  caused one actual Cohesion loss, two invalid actions and one cancellation were
  recorded, the outcome chrome loaded, and the browser error list is empty.
- Bundle validation passes at 703.9 KB combined boot, 675.5 KB app entry, and
  28.4 KB game core. The entry emits a soft 0.5 KB target warning but remains
  below the hard release budget. `npm run validate` passes every release gate
  and all nine sequencing scenarios.

## 2026-07-18 Complete Market Purchase Outcome Previews

- Added a uniform primary decision contract for every irreversible Market
  purchase: cards, Waymarks, Supplies, boss rigging, route planning, and paid
  stock refreshes now show exact before/after values before commitment.
- Card dossiers replace secondary taxonomy in the decision line with the live
  deck-size and post-purchase Scrap totals. Non-card dossiers render separate
  rows for the purchased inventory, Boss Shield, Open Sky Guard, Open Sky
  reduction, stock round, and resulting Scrap as applicable.
- Purchase projection reuses the route-effect resolver for carried
  `afterMarketPurchase` Waymarks. Refunds and route-preparation bonuses are
  included rather than subtracting only the shelf price.
- Preen and Release remain safe two-stage actions: opening the picker spends
  nothing, and each final card shows its exact cost and result before the paid
  selection.
- Focused Chromium parity coverage commits every purchase family and compares
  each rendered preview with the resulting state. It explicitly carries Ledger
  Tab to prove refund, Guard, and Open Sky projection; six surrounding Market
  purchase/detail/picker regressions pass.
- The required shared production client completed title -> route -> battle with
  audio unlocked and no error artifact. Inspected focused captures are
  `.artifacts/market-card-preview-production.png` and
  `.artifacts/market-boss-preview-production.png`; matching text state reports
  `DECK 3 > 4`, `SCRAP 480 > 390`, `BOSS SHIELD 0 > 18`, and
  `SKY GUARD 0 > 1`, with an empty browser-error list.
- Bundle validation passes at 707.7 KB combined boot, 679.3 KB app entry, and
  28.4 KB game core. The entry produces a preferred-target warning but remains
  below the 700 KB hard cap. `npm run validate` passes every release gate and all
  nine sequencing scenarios.

## 2026-07-18 Complete Route-Event Outcome Previews

- Added exact confirmation-ledger rows to every Basin, Cache, Nest, and Signal
  choice, covering Cohesion, Scrap, deck, Supplies, Waymarks, boss shield, Open
  Sky Guard/reduction, enemy Cover, and forced Open Sky state.
- Built the preview through the production route-effect resolver and replayed
  active Basin, Cache, and Signal Waymark triggers in the projection. Random
  cache outcomes and selected item/card rewards are frozen before confirmation.
- Kept Preen and Release as safe two-stage choices with exact results on the
  final card picker; rival choices now preview their Battle transition.
- Focused Chromium parity coverage passes Basin, expanded Signal cache rewards,
  Cache card selection, Nest/Preen, hidden Waymark bonuses, and rival handoff.
  Five surrounding route-art, district-world, and card-picker regressions pass.
- The production build and required shared-client route run pass. The inspected
  confirmation capture at `.artifacts/route-decision-production/route-decision.png`
  matches its text state and has an empty browser-error list; shared-client
  evidence is under `.artifacts/route-decision-shared-client/`.
- `npm run validate` passes every release gate and all nine sequencing
  scenarios. Bundle hard caps pass at 714.2 KB combined boot, 685.8 KB app
  entry, and 28.4 KB game core; combined boot and entry remain above their
  preferred soft targets.

## 2026-07-18 P1 Visual-Hierarchy Evidence Closure

- Inspected production grayscale captures for title, route confirmation,
  rewards, Market, combat intro, and settled combat. Each surface retains an
  obvious current decision without relying on suit color or glow alone.
- Verified that interactive offers and primary actions lead structural chrome,
  the combat log recedes behind threat/cards, and selected reward/Market
  dossiers keep all alternatives visible.
- Rechecked the route confirmation at 2560x1600, 1280x720, and the minimum
  supported 1000x560 viewport. The centered stage, ledger, reward dossier, and
  Confirm/Cancel controls remain anchored and unclipped with no browser errors.
- Evidence is stored under `.artifacts/visual-hierarchy-grayscale/` and
  `.artifacts/route-decision-breakpoints/`; existing high-resolution route and
  landscape-tablet smoke coverage preserves the breakpoint contract.

## 2026-07-18 Route-Contract Completion Feedback Closure

- Closed the final concrete-route-decision acceptance gap: contract completion
  now fires a generated route callout and the ascending objective-complete cue
  instead of relying only on a badge/log update.
- The callout names the completed plan, exact Scrap reward, and permanent record
  badge, then clears after 1.8 seconds so it never stalls route planning.
- Added a persisted `celebrated` latch to sanitized active-run state so reloads
  cannot replay earned reward feedback.
- Focused Chromium coverage proves all four contract completion resolvers,
  account and run-summary recording, callout/audio emission, expiry below three
  seconds, and the one-shot state.
- Inspected production proof at
  `.artifacts/contract-celebration-production/contract-complete.png`; it remains
  clear of the selected route and Take Route action, with an empty browser-error
  list.
- `npm run validate` passes every release gate and all nine sequencing
  scenarios. Bundle hard caps pass at 716.1 KB combined boot, 687.6 KB app
  entry, and 28.4 KB game core; combined boot and entry remain above their
  preferred soft targets.

## 2026-07-18 Horizontal Mastery Acceptance Closure

- Verified pre-run named Leader mastery with live progress and post-run
  `NEXT FLIGHT` goal priority across boss dossier, suit collection, and Leader
  mastery targets.
- Confirmed that contract badges, dossier discoveries, achievements, personal
  records, Ascension, same-seed replay, and challenge links remain horizontal,
  informational, or opt-in rather than permanent stat power.
- Four focused browser scenarios pass dossier persistence/goal priority,
  collection milestones, shared-route fidelity, and fresh-progress outcome
  presentation.
- Deliberately deferred a calendar-based weekly route until observed retention
  proves the base loop; adding time pressure now would conflict with the
  no-streak/no-FOMO product direction.

## 2026-07-18 Codex Boot-Bundle Deferral

- Moved the complete Codex scene into an on-demand module and removed it from
  Phaser's initial scene registration. The title shows a compact loading notice,
  retries cleanly after a chunk failure, and preserves early clicks across its
  normal UI-art restart.
- Production HTML does not preload the new 55.2 KB Codex scene or Codex data.
  App entry dropped from 687.6 KB to 635.0 KB and combined boot from 716.1 KB
  to 663.4 KB, clearing both preferred targets while game core remains 28.4 KB.
- Added focused coverage for unregistered/unrequested boot state, actual menu
  activation, dynamic request/registration, scene handoff, and the existing full
  Codex renderer. Both focused scenarios pass.
- The required production client opened Codex through the real top-bar canvas
  control. Its screenshot and `mode: codex` text state agree, all expected Codex
  frames are present, and no browser-error artifact was emitted. Evidence is in
  `.artifacts/codex-lazy-production/client/`.
- The broad matrix passed 165/169 before exposing three missing-field Molt Power
  states that propagated `NaN` into WebAudio and one stale overkill telemetry
  expectation. The state helper now safely treats missing/non-finite power as
  zero, telemetry asserts actual Cohesion lost, and all four cases pass together.
  The authoritative extended rerun passes all 169 Chromium scenarios in 22.3
  minutes; the final bounded `npm run validate` gate and all nine sequencing
  tests also pass.

## 2026-07-18 Fairness Audit And Single-Cue Feedback Closure

- Re-ran the authored balance, 500-seed economy, content-drift, and ten-row
  telemetry-pipeline audits. All 32 content checks pass with zero drift; every
  district economy profile remains inside its Scrap, deck, Waymark, Preen, and
  safety tolerances. The seeded dashboard is retained strictly as pipeline proof,
  not human retention or balance evidence.
- Rejected a speculative starter buff. The simple Flock Power Index reports the
  Fledgling below specialists because it counts static Flock Stats and five-card
  suit keystones but omits the starter's three zero-cost cards and Four-Suit
  Rally's up-to-four Flow. Changing live balance from that proxy would weaken the
  evidence standard.
- Production evidence exposed one real feedback defect: the shared title utility
  button and the lazy Codex opener each emitted `confirm`, producing two cues for
  one click. The opener no longer duplicates the shared control sound.
- Pointer-level coverage now proves the real Codex button requests/registers the
  lazy scene, stops Menu, clears its notice, and increments confirm telemetry by
  exactly one. Both focused Codex scenarios pass.
- The required shared production client confirms `cueRequests.confirm: 1`, a
  matching clean Codex frame, and no browser-error artifact. Evidence is under
  `.artifacts/codex-single-cue-production/client/`.
- The complete 169-scenario Chromium matrix passes in 22.3 minutes on one worker,
  including the real-pointer single-cue path and every late combat-state case.

## 2026-07-18 Human Playtest Export Bridge

- Closed the operational gap between browser-local run telemetry and the Node
  playtest dashboard. `?playtest=1` now adds an explicit Flock Record export
  command without changing gameplay or normal player UI.
- The command reads the same journaled, sanitized history used by the runtime,
  downloads pretty JSON locally, reports its run count/status in text state,
  and labels the operation `LOCAL ONLY / NO NETWORK UPLOAD`.
- `tools/playtest-stats.mjs` now accepts one file, several files, or a directory
  of JSON exports, merges their arrays, and deduplicates stable run IDs.
- Added `docs/game/playtest-runbook.md` with fresh-profile setup, observation
  rules, export/aggregation steps, and the exact five-session release evidence
  standard. Seeded rows remain explicitly ineligible as human evidence.
- Focused Chromium coverage proves normal builds hide the command, the gated
  control works through a real canvas pointer, the downloaded JSON exactly
  matches journaled history, status feedback updates, and no POST/PUT/PATCH
  request occurs. Both Profile scenarios pass.
- The required production client inspected the empty-history boundary. The
  disabled command and local-only subtitle fit inside the Flock Record without
  obscuring achievements, text state matches, and no browser-error artifact was
  emitted. Evidence is under `.artifacts/playtest-export-production/`.
- A two-file directory fixture merged into two unique runs despite one repeated
  ID; proof is `.artifacts/playtest-export-production/dashboard-merge-proof.md`.
  The default dashboard was then restored to its clearly labeled seeded state.
- Final release closure passes `npm run validate`, all nine sequencing gates,
  and the complete 170-scenario Chromium matrix in 24.0 minutes on one worker.
  Production remains below preferred boot targets at 635.1 KB app entry and
  663.5 KB combined boot; the optional Profile module is 13.9 KB.

## 2026-07-18 Deployment Security Closure

- Replaced the inline responsive platform-gate script with
  `src/platform-gate.ts`. The emitted document now has no inline executable
  script and can enforce a strict self-hosted script policy without
  `unsafe-inline` or `unsafe-eval`.
- Added `public/_headers` with CSP, no-referrer, MIME-sniff protection, framing
  denial, sensitive-capability denial, same-origin opener/resource isolation,
  no-cache HTML, and immutable hashed assets. Fullscreen remains allowed to the
  game itself; Phaser's runtime canvas styles retain a narrow style-only inline
  allowance.
- Deployment validation now requires the emitted manifest, validates the
  security directives, rejects unsafe script sources or inline execution, and
  still enforces the existing cache and lazy-chunk contracts.
- Focused Chromium coverage injects the exact production CSP into the document
  response and proves Menu boots with a canvas, hidden platform gate, no inline
  scripts, and zero console/page errors. The existing portrait/compact sleep,
  landscape resume, and minimum touch-target scenario also passes.
- The required shared production client shows an unchanged complete title with
  matching menu/accessibility telemetry and no error artifact under
  `.artifacts/deployment-security/client/`.
- Production build and deployment/bundle validation pass at 635.7 KB app entry
  and 664.2 KB combined boot, both below preferred targets.
- Final `npm run validate` passes all release gates and nine sequencing
  scenarios. The complete hardened-build Chromium matrix passes 171/171 in
  24.9 minutes on one worker, including the injected strict-CSP boot path.

## 2026-07-18 Full Save Backup And Restore

- Added `src/game/save-backup.ts`, a versioned full-save boundary for the
  account, active flight, run history, first-flight guide, controls, graphics,
  contrast, motion, combat pace, audio volumes/mute, and unlocked tier.
- Flock Record now exposes **Save Data** in normal play. Players can download a
  local JSON backup or select one for restore; valid files show runs, wins,
  unlocked leaders, active-checkpoint presence, and export date before a
  separate confirmation action.
- Restore is limited to 2 MB, uses runtime sanitizers, requires valid unique
  controls, replaces only an explicit Bird Squad storage allowlist, rebuilds
  all four journal mirrors, verifies writes, and attempts rollback on failure.
  Unrelated origin storage is neither exported nor changed.
- The gated `?playtest=1` run-history export remains available inside the Save
  Data panel, keeping the normal Flock Record footer uncluttered.
- Focused real-canvas coverage proves the complete download contract and no
  mutating network request, invalid-file and pre-confirm immutability,
  transactional confirmed restore, journal mirror equality, unrelated-key
  preservation, and playtest-export compatibility.
- The required production client inspected the compact normal panel with
  matching text state and no error artifact under
  `.artifacts/save-backup/client-polished/`.
- Production is 636.4 KB app entry and 664.8 KB combined boot. `npm run
  validate` passes all release gates and nine sequencing cases; the full
  current-build Chromium matrix passes 174/174 in 23.7 minutes on one worker.

## 2026-07-19 Flock Record Input Parity

- Added a lifecycle-owned focus model to Flock Record, covering both badge
  tabs, Return, Save Data, download/restore, gated playtest export, and staged
  restore confirmation/cancellation.
- Configured Previous, Next, Confirm, and Back bindings now operate the complete
  flow. Tab cycles focus; D-pad directions navigate; gamepad A confirms and B
  backs out. Pointer/touch behavior remains unchanged.
- A bright named focus ring and compact on-canvas hint use the player's actual
  binding labels. Profile text state exposes current focus, legal order, and
  those bindings for accessibility and deterministic automation.
- Corrected Save Data audio ownership: pointer actions now request exactly one
  confirmation cue, while Cancel, Return, Escape, Q-equivalent bindings, and
  gamepad B request one close cue rather than layered confirm/close feedback.
- Focused Chromium coverage drives remapped A/D/Space/Q controls plus D-pad,
  gamepad A/B, exact cue deltas, and a pointer backup download with one cue.
- The required production client drove Menu -> Flock Record -> keyboard focus
  -> Save Data. The inspected capture and matching text state are under
  `.artifacts/profile-input/client-final/`; no error artifact was emitted.
- Production remains below preferred targets at 636.4 KB app entry and 664.9
  KB combined boot. The optional Profile scene is 25.7 KB / 8.7 KB gzip.
  `npm run validate` passes all release gates and nine sequencing cases; the
  complete Chromium matrix passes 175/175 in 24.2 minutes on one worker.

## 2026-07-19 Legacy World Asset Guard Closure

- Re-audited the July 18 removal and confirmed all 117 retired world files
  remain absent from the working tree, runtime imports, and production bundle.
- Removed the last active-documentation reference to the retired
  `assets/battlefields/` directory from the root README.
- Added the three canonical route-event centerpiece masters to the exact source
  allowlist and extended the world validator to reject retired asset guidance
  in current documentation while permitting the canonical denylist and this
  historical progress log.
- The release contract now checks exactly 42 runtime/style assets and 44 source
  assets. Production build and `npm run validate` pass, including all nine
  sequencing gates.
- Required-client captures under `.artifacts/world-cleanup-proof-route/` and
  `.artifacts/world-cleanup-proof-battle/` visually confirm the current Rooftop
  Blocks route backdrop and matching battlefield; text state reports ready
  renderers and neither run emitted browser errors.

## 2026-07-21 Minimum Supported Touch Targets

- Replaced the title/shared 56-game-pixel hit regions with a documented
  58-game-pixel minimum. At the declared 1000x560 viewport this keeps the
  smallest controls at roughly 45 CSS pixels instead of 43.6 pixels.
- Moved the platform regression from 1024x768 to the exact 1000x560 support
  boundary while preserving the portrait and compact-landscape gate checks.
- The exact-boundary capture at
  `.artifacts/test-results/min-supported/title-1000x560.png` was visually
  inspected: the complete title setup remains visible without clipping.
- Shared audio feedback still passes across Menu, Route, and Battle. The
  required production client reached a focused playable battle with matching
  text state and no browser errors under
  `.artifacts/min-supported-touch-client/`.
- Strict TypeScript, production build, both focused regressions, and
  `npm run validate` pass, including all nine sequencing scenarios. App entry
  remains 659.4 KiB and combined boot code 687.8 KiB.

## 2026-07-21 Settings And Remapping Touch Closure

- Extended the 58-game-pixel minimum from title/shared controls to the
  configurable Settings and keyboard-remapping surfaces. The former Settings
  rows measured 31.1 CSS pixels, Contrast 34.2, and nominal 56-game-pixel
  switches 43.6 at the supported 1000x560 boundary.
- Reflowed Settings into two roomy columns with non-overlapping 58-pixel rows.
  Remapping tabs and six binding rows now use the same floor with 58-pixel
  spacing; close and footer actions retain matching accessible hit regions.
- Added an exact-boundary regression that measures 15 Settings targets and 10
  remapping targets in CSS pixels, requires every one to be at least 44x44,
  and captures both final artwork-loaded layouts.
- Inspected exact-boundary captures under `.artifacts/test-results/min-supported/`
  and production-client captures under `.artifacts/min-touch-settings-client/`
  and `.artifacts/min-touch-controls-client/`. Both client states match the
  visible focus/panel state and contain no browser errors.
- Strict TypeScript, the four focused Settings/remapping scenarios, production
  build, every static release validator, and all nine sequencing scenarios
  pass. App entry remains 659.4 KiB and combined boot code 687.8 KiB.

## 2026-07-21 Shared Field Command Touch Floor

- Reproduced the remaining shared-command boundary mismatch: How to Play and
  route pause actions authored at 56 game pixels measured 43.6 CSS pixels at
  the supported 1000x560 viewport.
- Split the shared field button's visual frame from its interaction target.
  Visual art keeps its authored size, while every enabled shared command now
  returns a transparent, named hit/focus region of at least 58x58 game pixels.
  This also covers Profile save/restore/export actions and compact fallback
  commands without inflating their artwork.
- Added an exact-boundary regression for both How to Play actions and all three
  route-pause actions. Final artwork-loaded captures under
  `.artifacts/test-results/min-supported/` confirm both layouts remain readable,
  separated, and unclipped.
- Required production-client runs reached How to Play and route pause through
  real pointer/title navigation. Captures and matching text state are under
  `.artifacts/shared-field-help-client/` and
  `.artifacts/shared-field-pause-client/`; neither emitted browser errors.
- Strict TypeScript, six focused shared-command consumers, isolated deck-review
  confirmation, production build, and full `npm run validate` pass, including
  all nine sequencing scenarios. App entry is 659.5 KiB and combined boot code
  is 687.9 KiB.

## 2026-07-21 Review And Reward Touch Closure

- Reproduced the final compact-command mismatch at the exact 1000x560 support
  boundary: deck and pile rows measured 26.4 CSS pixels high, review scroll
  controls were below the 44x44 contract, and reward Skip measured 37.3 CSS
  pixels high.
- Reduced deck and pile review pages from eleven compressed rows to seven
  comfortably spaced rows. Visual frames keep their compact authored size,
  while independent row and scroll hit regions use the shared 58-game-pixel
  floor and remain non-overlapping.
- Expanded only the transparent card-reward Skip target to the same floor,
  preserving its existing command artwork and placement.
- Added one exact-boundary regression that measures route rows/navigation,
  combat pile rows/navigation, and reward Skip in CSS pixels. All three final
  artwork-loaded captures under `.artifacts/test-results/min-supported/` are
  readable, separated, and unclipped.
- The required production client reached the live seven-row Deck Review through
  title and route pointer navigation. Its capture and matching state are under
  `.artifacts/shared-review-client-final/`; no browser error file was emitted.
- Production build, seven focused Settings, pause/help, review, pile, and reward
  regressions, and full `npm run validate` pass, including all nine sequencing
  scenarios. App entry is 659.7 KiB and combined boot code is 688.2 KiB.

## 2026-07-21 Codex And Flock Record Touch Closure

- Continued the exact-boundary audit into the two lazy optional scenes. At
  1000x560, Codex navigation measured as little as 23-34 CSS pixels high;
  Flock Record badge tabs measured 43.6, rating rows 24.9, and direct rating
  chips 26.4x18.7.
- Separated Codex section, type, filter, Back, and dossier Close artwork from
  minimum 58-game-pixel hit regions. The Supplies/Waymarks secondary filter row
  moved down so its larger targets meet the type row edge without overlap.
- Reflowed the local-only playtest panel into a taller layout with four
  58-pixel-spaced rating rows and five independently selectable 58x58 rating
  targets per row. Existing compact chip art and the main Flock Record badge
  styling remain intact.
- Added exact 1000x560 coverage for 18 Codex navigation controls, dossier Close,
  two Flock Record tabs, and 27 playtest/save controls. Captures under
  `.artifacts/test-results/min-supported/` confirm the two-row filters, complete
  Supply dossier, and rating matrix remain readable and unclipped.
- Required production clients reached Supplies / Plan and the Contracts tab
  through real pointer navigation. Captures and matching state are under
  `.artifacts/optional-touch-codex-client/` and
  `.artifacts/optional-touch-profile-client/`; neither emitted browser errors.
- Strict TypeScript, production build, five focused Codex/Profile input, export,
  detail, and exact-boundary regressions, and full `npm run validate` pass,
  including all nine sequencing scenarios. App entry remains 659.7 KiB and
  combined boot code remains 688.2 KiB.

## 2026-07-21 Core Route Decision Touch Closure

- Continued exact-boundary measurement into high-frequency route decisions.
  At 1000x560, abandon confirmation measured 42 CSS pixels high, reward Claim
  29.6, market category tabs 26.4, market services/refresh 43.6, and outcome
  commands 40.4, all below the 44x44 supported-device contract.
- Kept the authored command artwork compact while adding independent,
  non-overlapping 58-game-pixel hit regions to exit confirmation, market tabs,
  services and refresh, route reward Claim, and both run-outcome commands.
- Added a single exact-boundary traversal that measures every affected target
  across exit confirmation, Market Services, route reward review, and defeat.
  All four artwork-loaded captures under
  `.artifacts/test-results/min-supported/` remain readable and unclipped.
- The required production client reached a live paused route with matching
  serialized state and no browser errors under
  `.artifacts/core-route-touch-client/`.
- Strict TypeScript, five focused route/market/reward/outcome regressions,
  production build, and full release validation pass, including all nine
  sequencing scenarios. App entry is 660.4 KiB and combined boot code is
  688.8 KiB.

## 2026-07-21 Runtime Pointer-Target Closure

- Replaced named-target spot checks with broad runtime inventory across Menu,
  baseline Route, long-deck card picker, loaded Market, settled Battle,
  deck/pile/reward review, Codex/detail, Flock Record/playtest, exit/reward, and
  outcome states at the exact 1000x560 support boundary.
- Closed the remaining gaps: route Cohesion measured 18.7 CSS pixels high;
  route/battle HUD actions 29.6; card-picker scroll 35.8x28; picker Cancel and
  Market back 29.6 high; Market Close 23.3; combat log 38.9; and outcome Copy
  Route Link 24.9. Each now uses a separated 58-game-pixel interaction region
  while retaining its compact authored artwork.
- Exact-boundary tests now reject every enabled hand-cursor target below 44 CSS
  pixels in all exercised states, while retaining explicit counts for named
  controls. The route-link copy test still launches the identical seed and run
  length after input moved from the text to its accessible hit region.
- Inspected exact-boundary captures under
  `.artifacts/test-results/min-supported/` remain readable and unclipped. The
  required production client used the enlarged live Deck HUD target to open
  Deck Review with matching serialized state and no browser errors under
  `.artifacts/final-touch-client/`.
- Strict TypeScript, production build, the broad boundary regressions, and
  focused market/card-picker/route/outcome behavior regressions pass. Full
  release validation also passes all nine sequencing scenarios; app entry is
  661.1 KiB and combined boot code is 689.6 KiB. Remaining release evidence is
  unchanged: five observed fresh-player sessions through
  `docs/game/playtest-runbook.md`.

## 2026-07-21 Scene Asset Readiness Contract

- Replaced route/battle readiness booleans as the only evidence with a shared
  contract that reports loading, transition, interactive, and full-art phases;
  independent time-to-first-interaction and time-to-full-art values; pending
  groups; and
  exact failed/timed-out groups and keys through `render_game_to_text`.
- Added an eight-second production ceiling to runtime image waits and required
  presentation-module imports. A stalled request now releases the existing
  playable fallback and remains diagnosable instead of leaving the player on an
  indefinite `Charting the route...` or `Flock taking position...` transition.
- Route tracks essential UI, essential node/backdrop art, and the full current
  route UI bundle. Battle tracks preloaded combat art, essential/core UI,
  essential combat FX, required render modules, current art, and optional FX.
- Added focused healthy-path coverage across both scenes plus a real browser
  request stall for `route-map-frame`. The timeout regression proves route
  interaction returns after the ceiling and identifies `route-essential-ui`
  and `route-full-ui`, including the exact missing texture key.
- Required production-client captures under `.artifacts/readiness-client-route/`
  and `.artifacts/readiness-client-battle-settled-real/` were visually
  inspected. Route measured 436 ms to interaction and 1,535 ms to full art;
  combat measured 4,803 ms to interaction and 1,468 ms to full art because its
  encounter-intro beat intentionally holds controls after art settles. Both
  states had no pending, failed, or timed-out groups and no browser error file.
- Added binding-aware encounter-intro dismissal for keyboard confirm, gamepad A,
  and pointer/touch. Early input queues behind a 600 ms readable floor, then
  releases combat interaction without skipping the presentation minimum.
- Strict TypeScript, focused readiness and intro regressions, the production
  build, and full release validation pass, including all nine sequencing
  scenarios. App entry is 669.0 KiB and combined boot code is 697.6 KiB.
  Remaining release evidence is unchanged: five observed fresh-player sessions
  through `docs/game/playtest-runbook.md`.

Original prompt: make it happen, can you wire the found artifacts in an appropriate spot that I can view during the run, along with a tooltip to tell me what they do

## 2026-06-16

- Generated a 40-cell Waymark found-object icon atlas with the built-in imagegen path.
- Copied the atlas into `assets/runtime/waymarks/waymark-icon-atlas-v1.png` and cropped 40 per-id `.webp` runtime icons under `assets/runtime/waymarks/icons/`.
- Wired Waymark icons into Codex item thumbnails/details and BattleScene.
- Added a left-side run shelf for found Waymarks plus a top-bar Waymarks chip that opens a drawer.
- Added hover tooltips with family/rarity, mechanical effect, trigger/effect grammar, and found-object flavor.
- Verification: `npm run build`, `npm run validate:runtime`, `npm run validate:docs`, and focused smoke tests passed. Visual screenshots inspected at `.artifacts/test-results/waymark-artifact-drawer.png` and `.artifacts/test-results/waymark-artifact-tooltip.png`.
- Note: the generic `develop-web-game` client completed but captured a blank screenshot in `output/web-game/shot-0.png`; the project Playwright screenshots rendered the canvas correctly and were used for visual verification.
- Converted all 40 Waymark item icons to transparent-background WebP assets and verified every icon has full alpha range. Checkerboard review sheet: `.artifacts/test-results/waymark-transparent-contact-sheet-small.png`.

## 2026-06-17

- New user prompt: generate map icons to make the route map more readable.
- Generated an 8-icon route node atlas with built-in imagegen, copied the source to `assets/runtime/map-icons/map-node-icon-atlas-v1.png`, and cropped transparent 192x192 WebP icons under `assets/runtime/map-icons/icons/`.
- Wired route node icons into `RouteScene` map nodes and the legend, keeping the existing text glyphs as fallback if icon textures have not loaded.
- Added smoke coverage that waits for all route-node icon textures and confirms icon images render in the RouteScene.
- Verification: `npm run build`, `npm run validate:runtime`, `npm run validate:docs`, focused route-map smoke tests, and transparent icon alpha validation passed. Visual screenshots inspected at `.artifacts/test-results/map-node-icons-contact-sheet.png` and `.artifacts/test-results/route-map-node-icons.png`.
- Note: the generic `develop-web-game` client still captures a blank screenshot in `output/web-game/shot-0.png`; the project Playwright route screenshot rendered correctly and was used for visual verification.
- Follow-up map readability pass: removed the old type-colored node fills/legend dots now that icons carry type identity, switched nodes to neutral plates with state rings, added subtle route-column guide lines, and brightened edges that lead to currently available choices.
- Verification after neutral map pass: `npm run build`, `npm run validate:runtime`, `npm run validate:docs`, focused route-map smoke tests passed. Final visual screenshot: `.artifacts/test-results/route-map-neutral-icons-final.png`.

- New user prompt: make the accepted visual beauty improvements happen, excluding extra flock companion silhouettes.
- Planned scope: ambient district battlefield layers, battle intro vignette, suit-based card/effect language, stronger hit/block/heal/Winded reactions, card play micro-cinematics, and a field-dossier Codex polish pass.
- Implemented first visual polish pass in `src/main.ts`: generated soft-dot FX texture, district atmosphere overlays, battle intro vignette, card-cast micro-cinematic, suit-colored hit bursts, richer Cover/heal/Winded/Open Sky reactions, and Codex leader dossier framing.
- New user prompt: wire recommended ability updates into cards, items, enemies, and identify existing assets that should be refreshed.
- Planned scope: add a small supported mechanic set for anti-Cover cards, route-control Waymarks, boss-prep Waymarks, and more varied enemy pressure without broad engine churn.
- Added runtime/data support for `damagePierce`, `removeCover`, `targetHasCover`, `loseWingbeat`, `flockHasCover`, `extraCacheChoice`, `bossDamageShield`, and `freePreenNextDistrict`.
- Updated Sheathed Quills, Quill Ring, Quill Elder, Cache Hook, Roofline Compass, Sky-Safe Harness, Reopened Roofline, Gutter Baron, and Tar-Crowned Crow to use the new mechanics.
- Added `cache_boss_line` as a hidden sixth Cache option revealed by cache-choice Waymarks.
- Added `docs/game/ability-asset-update-recommendations.md` with art/content refresh candidates.
- Verification: `npm run validate:runtime`, `npm run build`, `npx playwright test tests/smoke.spec.ts`, and a focused Playwright harness check all passed. The generic web-game client still produced the known blank screenshot but returned valid `render_game_to_text` menu state.

- Visual beauty pass verification follow-up: extended the card-cast micro-cinematic timing so suit/card moments are visible during play.
- Verification: `npm run build` and `npm test` passed. In-app browser checks covered the main menu, a route into Rooftop Blocks combat, card play/impact/readability, and the Fledgling Flock Codex leader dossier; no browser warnings or errors were reported during the visual pass.

- Route map readability polish: added selected-route preview highlighting, reward/source badges under route nodes, compact route-kit stats, and moved the Signals log into the legend strip so it no longer overlaps the selected-node action panel.
- Verification: `npm run build`, `npm run validate:runtime`, `npm run validate:docs`, and focused route-map Playwright smoke tests passed. Final visual screenshot: `.artifacts/test-results/route-map-reward-badges-final.png`.
- Note: the generic `develop-web-game` client completed successfully; its `output/web-game/shot-0.png` capture remains the known blank/tiny harness artifact, so the project Playwright screenshot was used for visual QA.

- Route map menu redesign pass: converted the map view into a clearer planning-board layout with shared layout bounds, a wider graph lane, a dedicated right inspector, boss prep moved out of the map banner and into the inspector, a slimmer footer legend, and the Signals line moved away from node-type labels.
- Added smoke coverage proving the inspector renders the `BOSS PREP` summary in addition to the route text-state boss-prep payload.
- Verification: `npm run build`, `npm run validate:runtime`, `npm run validate:docs`, focused route-map Playwright smoke tests, generic `develop-web-game` client, and in-app browser route-map check all passed. Visual screenshot inspected at `.artifacts/test-results/route-map-layout-redesign-selected.png`.

- New user prompt: execute the production path for the visual beauty items, replacing stand-in lines/animations with real paths forward.
- Added transparent pixel-FX spritesheets under `assets/runtime/fx/` for combat suit effects and subtle district atmosphere texture strips.
- Replaced the procedural combat atmosphere lines, generic pulse rings, soft-dot particles, and card-cast debug line/plate with Phaser spritesheet animations in `src/main.ts`.
- Suit/card play, damage, Cover, healing, Winded, Open Sky, and hostile impact hooks now route through authored pixel-FX animation keys while keeping existing combat logic intact.
- Verification: `npm run build`, `npm test`, and the required generic `develop-web-game` client completed. The generic client screenshot remained the known blank harness artifact; direct Playwright battle screenshots were captured at `.artifacts/test-results/combat-fx-asset-backed-battle.png`, `.artifacts/test-results/combat-fx-card-mid.png`, `.artifacts/test-results/combat-fx-card-after.png`, and `.artifacts/test-results/combat-fx-support-mid.png`.
- Browser/direct-scene QA: direct BattleScene harness confirmed card play reduced Roof Rat from 20 to 15 and support FX restored Cohesion. Only WebGL `ReadPixels` screenshot performance warnings appeared during Playwright capture.

- New user prompt: execute balance/variety recommendations from the cards/enemies/artifacts/mechanics audit.
- Implemented first balance contract chunk: Waymark economy/recovery hooks now resolve by trigger/effect instead of hardcoded IDs for Signal Scrap, Street bonus Scrap, Basin healing, and Market Preen discount.
- Added deterministic `routeMarkChance` payout support for normal combat reward profiles.
- Added map-scaled reward profiles for Maps 2-4 and repointed district encounters to the map-specific street/rival/boss profiles.
- Verification: `npm run validate:runtime` passed after the resolver/profile changes.
- Added balance/variety content pass: Plume Barricade and Growing Nest now contribute anti-Cover pressure, Basin Mirage can loop itself under Open Sky, three duplicate combat-start Waymarks now use timing/Open Sky triggers, and selected Map 3-4 enemies now react to Cover/low-health/unguarded states.
- Verification: `npm run validate:runtime` and `npm run build` passed. The generic `develop-web-game` client completed successfully and produced valid menu state JSON; its screenshot remains the known blank harness artifact, so the in-app browser was used for visual QA. Browser verification loaded the route map, displayed the new 15% Waymark street reward line, entered Rooftop Blocks combat, and captured no console errors.

- New user prompt: make remaining work items/improvements happen after the balance pass.
- Added `tools/simulate-run-economy.mjs` plus `npm run audit:economy` to sample 500 seeded full-run route/economy outcomes and compare boss-entry deck/Waymark counts against `balance-config.json` targets.
- Reconciled `balance-config.json`, `balance-scaling-plan.md`, and `tools/audit-content.mjs` with the current map-scaled reward profile numbers.
- Added focused smoke coverage for generic Waymark economy hooks, cache choice expansion, Basin/Signal/Market bonuses, timed Waymark triggers, `shuffleSelfToDraw`, and anti-Cover conditionals.
- Verification: `npm run validate:runtime`, `npm run validate:docs`, `npm run audit:economy`, `npm run audit:content`, `npm run build`, and the full `npx playwright test tests/smoke.spec.ts` suite all passed. The generic `develop-web-game` client completed and returned valid menu state JSON; its screenshot remains the known blank harness artifact.

- Route map backdrop/inspector polish: generated a dedicated imagegen rooftop planning backdrop and saved the project asset as `assets/runtime/backdrops/rooftop-blocks-route-map-v1.webp`.
- Wired `RouteScene` to load and render the route-specific backdrop instead of reusing the splash art, reduced the map board opacity so the district art remains visible, and added a larger selected-node type icon plus labeled likely-find badges in the inspector.
- Fixed the existing combat FX compile blocker by completing the missing flock motion cue helper that matched the already-present enemy motion cue system.
- Verification: `npm run build`, `npm run validate:runtime`, `npm run validate:docs`, focused route-map Playwright smoke tests, required generic `develop-web-game` client, direct Playwright route-map screenshot, and in-app browser bridge check all completed. Final inspected screenshot: `.artifacts/test-results/route-map-imagegen-backdrop-selected.png`.

- Home screen compactness follow-up: moved the animated Bird Squad title higher, reduced the bottom setup dock height/opacity, and made the leader chips, Ascension arrows, run actions, Codex, and Flock Record buttons smaller so the splash art remains more visible.
- Verification: `npm run build`, in-app browser menu screenshot, and required generic `develop-web-game` client passed. The generic client returned valid `MenuScene` state JSON and its screenshot remains the known black WebGL capture artifact.
- Home screen text-sharpness follow-up: increased menu text texture resolution, reduced heavy text strokes, slightly enlarged the smallest Ascension/leader detail labels, and strengthened only the local backing panels needed for readability.
- Verification: `npm run build`, direct Playwright menu screenshot at `.artifacts/test-results/menu-text-detail-pass.png`, and required generic `develop-web-game` client passed. The direct screenshot reported no console errors; only repeated WebGL `ReadPixels` performance warnings appeared during capture. The generic client returned valid `MenuScene` state JSON and its screenshot remains the known black WebGL capture artifact.
- Codex header layout follow-up: shifted the Cards/Items/Leaders/Enemies section tabs left and tightened their width so the Enemies tab no longer overlaps the Back button.
- Verification: `npm run build`, direct Playwright Codex screenshots at `.artifacts/test-results/codex-header-tabs-no-overlap.png` and `.artifacts/test-results/codex-enemies-tab-no-overlap.png`, and required generic `develop-web-game` client passed. The direct screenshots showed clear separation between Enemies and Back; only WebGL `ReadPixels` performance warnings appeared during capture. The generic client returned valid `MenuScene` state JSON and its screenshot remains the known black WebGL capture artifact.
- Codex card-filter alignment follow-up: shifted the Major/Aviary/Plumes/Quills/Basins/Nests row 12px right so the Major button no longer hugs/clips against the left edge.
- Verification: `npm run build`, direct Playwright Codex screenshot at `.artifacts/test-results/codex-major-tab-inset.png`, and required generic `develop-web-game` client passed. The direct screenshot showed the Major tab inset cleanly; only WebGL `ReadPixels` performance warnings appeared during capture. The generic client returned valid `MenuScene` state JSON and its screenshot remains the known black WebGL capture artifact.

- Route map highlight refinement: reduced selected/available node ring thickness, replaced the selected-node halo with thin cyan focus ticks, softened route-preview line weights/dots, and changed the large map board frame from gold to muted steel blue so the map no longer feels over-highlighted.
- Verification: `npm run build`, `npm run validate:runtime`, focused route-map Playwright smoke tests, required generic `develop-web-game` client, and visual screenshot inspection passed. Final screenshot: `.artifacts/test-results/route-map-thin-node-highlight-steel-frame.png`.

- Generated the first encounter/situation backdrop variant set with built-in imagegen and saved normalized 1280x720 WebP runtime assets under `assets/runtime/backdrops/variants/`.
- New boss variants: `rooftop-blocks-boss-tar-crow-v1.webp`, `canal-markets-boss-gatekeeper-v1.webp`, `signal-spires-boss-beacon-breaker-v1.webp`, `high-roost-boss-warden-v1.webp`.
- New special-node variants: `rooftop-blocks-cache-billboard-v1.webp`, `canal-markets-supply-market-v1.webp`, `signal-spires-signal-relay-v1.webp`, `high-roost-workshop-prep-v1.webp`.
- Validation: every variant is 1280x720 RGB WebP. Contact sheet inspected at `.artifacts/test-results/backdrop-variant-contact-sheet-v1.jpg`.

- Home screen text-detail follow-up: added compact mechanical detail to the leader chips, surfaced the selected leader's signature rule in a readable two-line strip, and expanded the Ascension text to show current enemy Cohesion, reward, hit, and Open Sky modifiers.
- Refined text readability with subtle strokes and a low-opacity backing strip while keeping the splash art visible.
- Verification: `npm run build`, in-app browser menu screenshot, and required generic `develop-web-game` client passed. The generic client returned valid `MenuScene` state JSON; its screenshot remains the known black WebGL capture artifact.

- Home screen selected-detail implementation follow-up: removed the full-width tinted bottom dock and permanent leader description strip, keeping only compact control panels over the splash art.
- Converted flock leader descriptions/signature rules into hover tooltips for both unlocked and locked leader chips; pointer-out hides the tooltip cleanly.
- Verification: `npm run build`, in-app browser idle/leader-hover/pointer-out screenshots, and required generic `develop-web-game` client passed. Browser console had no errors; the generic client returned valid `MenuScene` state JSON and its screenshot remains the known black WebGL capture artifact.

- Runtime optimization follow-up: added reproducible UI and enemy-art optimization paths, including active menu splash WebP regeneration, lossy/capped large encounter enemy outputs, and reserve enemy WebP generation from transparent masters.
- Added `tools/validate-runtime-asset-sizes.mjs`, wired it into `npm test` and `npm run validate`, and set budgets for optimized splash, leader, encounter enemy, reserve enemy, card thumbnail/icon, Waymark icon, route icon, and backdrop assets.
- Tightened Codex optional art loading to visible grid rows plus the open detail item instead of queueing every asset in the active section.
- Split Phaser into a dedicated Vite `vendor-phaser` chunk for better long-term caching. Remaining note: Vite still warns because Phaser is a large dependency and the app entry remains above 500 KB minified; deeper scene/module splitting would be the next larger-scope bundle task.
- Verification: `npm run build:runtime-ui-art`, `npm run build:runtime-enemy-art`, `npm test`, `npm run build`, `npm run validate`, required generic `develop-web-game` client, and in-app browser menu/route/battle/Codex enemy smoke checks all passed with no browser warnings or errors.

- Startup bundle optimization follow-up: moved Codex-only tarot lore, bird facts, card meanings, and reserve enemy contract data into lazy `src/game/codex-data.ts`.
- Updated `CodexScene` to import the Codex data chunk on demand, rerender when it arrives, and keep visible card/enemy grids usable while the chunk resolves.
- Added a lightweight HTML/CSS boot shell so players see immediate feedback before Phaser finishes booting, removed by `BootScene.create()`.
- Build output after the split: app entry `index` is ~459 KB minified, lazy `codex-data` is ~249 KB, and `vendor-phaser` remains ~1.62 MB. Built HTML modulepreloads only `vendor-phaser`, confirming `codex-data` is deferred until Codex opens.
- Verification: `npm run build`, `npm test`, `npm run validate`, required generic `develop-web-game` client, and in-app browser menu/route/battle/Codex card-detail/enemy-grid smoke checks passed with no browser warnings or errors.

- Home screen splash-pop follow-up: generated `assets/splash/bird-squad-canal-run-splash-v4-menu-pop.webp` from the original splash PNG with a brighter, higher-saturation menu grade, removed the remaining full-screen dark wash, and pointed the menu splash import at the new asset.
- Verification: `npm run build`, in-app browser idle and leader-tooltip screenshots, and required generic `develop-web-game` client passed. Browser console had no errors; the generic client returned valid `MenuScene` state JSON and its screenshot remains the known black WebGL capture artifact.

- Home screen title placement follow-up: moved the animated Bird Squad title 22px higher and reduced the textured title image sizes by roughly 6% so the splash art has more room to read.
- Verification: `npm run build`, in-app browser menu screenshot, and required generic `develop-web-game` client passed. Browser console had no errors; the generic client returned valid `MenuScene` state JSON and its screenshot remains the known black WebGL capture artifact.

- Home screen Ascension/readability follow-up: added a compact translucent backing plate behind the Ascension controls, brightened/stroked its label/detail text, unified title-screen button borders under a shared thin `MENU_BORDER_WIDTH`, and removed the thicker selected-leader outline in favor of color/fill state.
- Verification: `npm run build`, direct Playwright menu screenshot at `.artifacts/test-results/menu-ascension-border-pass.png`, and required generic `develop-web-game` client passed on rerun. The in-app browser navigation got stuck during reload, but direct Playwright reported no console errors and rendered the canvas correctly; the generic client returned valid `MenuScene` state JSON and its screenshot remains the known black WebGL capture artifact.

- Boss backdrop variant wiring follow-up: added a generated backdrop variant registry for `assets/runtime/backdrops/variants/*.webp`, routed boss combat nodes through district-specific boss arenas, queued the selected arena via the existing optional art loader, and exposed `route.battlefieldAssetKey` / `route.battlefieldVariant` in the battle text-state.
- Added smoke coverage that starts each district boss fight and confirms the expected generated boss backdrop texture is loaded and rendered: Rooftop Blocks Tar-Crowned Crow, Canal Markets Gatekeeper, Signal Spires Beacon Breaker, and High Roost Warden.
- Verification: `npm run build`, `npm run validate:runtime`, `npm run validate:runtime-assets`, focused boss Playwright smoke tests, required generic `develop-web-game` client, and direct Playwright boss-scene visual capture passed. Inspected screenshot: `.artifacts/test-results/boss-backdrop-variant-rooftop.png`.
- Note: the special-node backdrop variants are generated and bundled but remain staged until the non-combat route/encounter presentation gets a proper backdrop surface.

- Text overflow/tidiness execution pass: tightened compact reward/preen card text bounds, removed lore paragraphs from small choice cards, kept full details on hover in the deck-card detail format, and shifted card reward/preen choices down to clear the deck-needs row.
- Cleaned the route boss inspector by allowing long titles to drive spacing, removing crowded likely-find micro-labels, and constraining boss prep pressure/prep/readiness text to the panel.
- Improved modal/overlay readability by making Codex detail curtains fully opaque, lowering the Codex detail viewport bottom, repositioning market hover detail away from buy controls, and darkening reward backdrops so battle text does not compete with choices.
- Verification: `npm run build`, `npm run validate:runtime`, focused route/reward/hover Playwright smoke tests, `git diff --check`, required generic `develop-web-game` client, and final screenshots under `output/text-audit-after/` passed/inspected.

- Codex visual upgrade pass: added shared tab/chip styling, a stronger header band, count-bearing section/filter tabs, intentional locked card backs, suit/family accents, Waymark trigger/effect chips, leader suit/status chips, enemy source/role chips, and card/enemy dossier framing.
- Verification: `npm run build`, direct Playwright Codex screenshots for cards/items/enemies/leaders and enemy detail, and required generic `develop-web-game` client passed. Final inspected screenshots include `.artifacts/test-results/codex-polish-leaders-final.png` and `.artifacts/test-results/codex-polish-enemy-detail.png`; only WebGL `ReadPixels` screenshot performance warnings appeared during direct capture, and the generic client returned valid `MenuScene` state JSON while its screenshot remained the known black WebGL capture artifact.

- Codex enemy bounds follow-up: tightened enemy thumbnail art into a framed 108x124 art well, shifted the text column right, and reduced the enemy type chip width so wide/tall enemy silhouettes no longer spill past card borders.
- Verification: `npm run build`, built-preview Playwright captures at `.artifacts/test-results/codex-enemy-bounds-top.png`, `codex-enemy-bounds-mid.png`, `codex-enemy-bounds-lower.png`, and `codex-enemy-bounds-deep.png`, `git diff --check -- src/main.ts progress.md`, and the required generic `develop-web-game` client passed. The generic client returned valid `MenuScene` state JSON; only the known WebGL screenshot artifact/performance warnings appeared during capture.

- Codex enemy border harmonization follow-up: replaced the full bright district-colored enemy card outline with a muted steel outer frame, slim district top line, and small corner marker so enemy cards better match the broader Codex styling.
- Codex enemy sprite cleanup follow-up: removed the visible rectangular art-well border around real enemy cutout sprites and replaced it with a subtle grounding shadow, while keeping fallback art boxes for missing art.
- Verification: `npm run build`, built-preview Playwright captures at `.artifacts/test-results/codex-enemy-border-harmonized-top.png`, `.artifacts/test-results/codex-enemy-border-harmonized-reserve.png`, `.artifacts/test-results/codex-enemy-sprite-borderless-top.png`, and `.artifacts/test-results/codex-enemy-sprite-borderless-reserve.png`, `git diff --check -- src/main.ts progress.md`, and the required generic `develop-web-game` client passed. The direct captures showed contained enemy art with no visible sprite boxes; the generic client returned valid `MenuScene` state JSON.

- Aviary quality expansion implementation: added eight suitless Aviary cards (`aviary_28` through `aviary_35`) centered on bird qualities rather than tarot roles: Hover Check, Mobbing Call, Underwing Shelter, Scavenger Eye, Thermal Lift, Cache Memory, Brood Shield, and Mimic Thread.
- Wired the new Aviary cards into `data/game/alpha-cards.json`, the reward pool, Codex meanings, bird facts, runtime card art manifest placeholders, and the Aviary arcana identity data.
- Updated gameplay/docs/tooling so Aviary can be a no-suit card family rather than tarot: added `kind: "aviary"`, expanded the card count from 84/74 to 92/82, regenerated the 14-card Aviary center-art prompt pack, and changed Aviary art prompts/compositing language from roman-numeral trumps to compositor-owned top badge/title marks.
- Verification: `npm run validate:runtime`, `npm run validate:docs`, `npm run audit:content`, `npm run build`, `npm run validate`, `npm test`, full `npx playwright test tests/smoke.spec.ts` with 48/49 passing then focused rerun of the one flaky enemy Codex test passed, and the required generic `develop-web-game` client rendered the menu with valid `MenuScene` text state.

- Aviary fieldcraft expansion implementation: added eight more suitless Aviary cards (`aviary_36` through `aviary_43`) focused on practical bird instincts: Drumline Tap, Curb Step, Spiral Search, Reed Balance, Plunge Claim, Cold Plunge, Formation Draft, and Tool Probe.
- Wired the new fieldcraft cards into runtime card data, reward pool, Aviary arcana identity data, Codex meanings, bird facts, placeholder art manifest rows, art bible rows, alpha spec tables, and the generated Aviary center-art prompt pack.
- Updated deck/count contracts from 92/82 to 100 playable cards / 90-card reward pool and raised the app-entry bundle-size guard from 500 KB to 540 KB to match the current full-content build while keeping the check active.
- Verification: `npm run validate:runtime`, `npm run validate:docs`, `npm run audit:content`, `npm run build`, `npm run validate`, `npm test`, full `npx playwright test tests/smoke.spec.ts` (50/50 passed), `git diff --check`, and the required generic `develop-web-game` client against strict local port 5317 with valid `MenuScene` state and inspected menu screenshot.

- Enemy roster route-wiring follow-up: promoted 11 reserve enemy concepts into playable runtime enemies across the four districts, copied their optimized reserve art into combat full-art assets, added enemy-art manifest entries, and authored matching street/rival encounter definitions so the Codex reserve list now reflects true future concepts only.
- Tightened generated route combat payload selection so middle nodes receive encounter payloads after their final node type is chosen and street/rival/signal pools cycle through fresh payloads before repeats, improving per-run enemy variety without changing authored route quotas.
- Updated the enemy Codex to report `44 playable / 37 reserve concepts`, label reserve-only thumbnails as concepts, and keep promoted contracts displayed through the playable combat roster.
- Added focused smoke coverage for the new roster split and a deterministic seed sweep proving all 11 promoted encounter payloads can surface in generated route maps.
- Verification: `npm run validate:runtime`, `npm run build`, `npx playwright test tests/smoke.spec.ts --grep "enemy codex|promoted reserve"`, built-preview Codex screenshot `.artifacts/test-results/codex-enemy-promoted-playable-top.png`, and the required generic `develop-web-game` client all passed. The generic client returned valid `MenuScene` state JSON.

- Enemy roster batch 2 follow-up: promoted 12 more reserve concepts into playable enemies: Rat Courier, Weasel Cutpurse, Skunk Chemist, Armadillo Roller, Turtle Barricader, Cormorant Netter, Kingfisher Snapdiver, Heron Spearstepper, Bat Nightcaller, Kite Hawk Courier, Fox Lookout, and Peacock Intimidator.
- Added matching street/rival encounter payloads and mixed encounters across Rooftop Blocks, Canal Markets, Signal Spires, and High Roost, emphasizing meaningful additions that use current verbs: setup pressure, Snags, Winded, Open Sky, Frail, Cover locks, and heavy telegraphs.
- Copied each promoted reserve WebP into `assets/runtime/enemies/full/`, added enemy-art manifest entries, and updated the Codex/route-exposure smoke expectations to `56 playable / 25 reserve concepts` and 23 total promoted encounter payloads.
- Verification: `npm run validate:runtime`, `npm run build`, `npx playwright test tests/smoke.spec.ts --grep "enemy codex|promoted reserve"`, built-preview Codex screenshot `.artifacts/test-results/codex-enemy-batch2-playable-top.png`, direct generated-route combat screenshot `.artifacts/test-results/battle-batch2-rat-courier.png`, and the required generic `develop-web-game` client all passed. The combat capture launched `enc_rat_courier` from a generated route and showed Rat Courier's `Run Message` Tell.

- Enemy roster batch 3 follow-up: promoted 8 more reserve concepts that fit current combat verbs without new terrain/object rules: Alley Cat, Jackrabbit Sprinter, Hedgehog Curb-Crosser, Mongoose Counterfighter, Opossum Decoy, Goose Bouncer, Mantis Street Duelist, and Moth Lantern-Drifter.
- Added single and mixed street/rival encounters for Rooftop Blocks, Canal Markets, and Signal Spires, with gameplay shapes focused on burst setup, speed pressure, low Cover blockers, counterfighting, feints, lane-control charging, precision duels, and lantern distraction.
- Copied the promoted reserve WebPs into `assets/runtime/enemies/full/`, added enemy-art manifest entries, and updated smoke expectations to `64 playable / 17 reserve concepts` and 31 total promoted encounter payloads.
- Verification: `npm run validate:runtime`, `npm run build`, `npx playwright test tests/smoke.spec.ts --grep "enemy codex|promoted reserve"`, built-preview Codex screenshot `.artifacts/test-results/codex-enemy-batch3-playable-top.png`, direct generated-route combat screenshot `.artifacts/test-results/battle-batch3-alley-cat.png`, and the required generic `develop-web-game` client all passed. The combat capture launched `enc_alley_cat` from a generated route and showed Alley Cat's `Stalk` Tell.

- Codex enemy shadow follow-up: replaced the fixed enemy thumbnail/detail ellipse placement with texture-alpha visible-bounds anchoring so enemies with different transparent crops have shadows under their actual stance instead of a shared low offset.
- Verification: `npm run build`, focused enemy Codex smoke test, direct Playwright Codex screenshots at `.artifacts/test-results/codex-enemy-shadows-grid.png`, `.artifacts/test-results/codex-enemy-shadow-roof-rat-detail.png`, and `.artifacts/test-results/codex-enemy-shadow-alley-cat-detail.png`, plus required generic `develop-web-game` client. The first generic-client attempts failed only from PowerShell JSON quoting; the rerun with the skill reference actions file passed and returned valid `MenuScene` state JSON.

- Molt state/targeting contract pass: added an active card contract that derives the current effect text, active target, base target, and Molt label from the card plus current flock Molt state.
- Wired the active contract through hand cards, hover previews, card detail/inspect payloads, click targeting, card resolution, and card-cast VFX so Molt cards that turn self/none cards into enemy-targeted effects now require an enemy click and display their true active behavior.
- Added runtime validation visibility for Molt target shifts; the current data set intentionally reports 68 cards whose active Molt target differs from their base card target.
- Added smoke coverage for Locked Nest's self-to-enemy Molt behavior and a synthetic none-target card that Molts into target damage/Winded without auto-firing ambiguously.
- Verification: `npm run build`, `npm test`, focused Molt Playwright smoke tests, full `npm run test:e2e` (52/52 passed), required generic `develop-web-game` client, and direct Molt combat capture passed. Inspected screenshot/state artifacts: `.artifacts/test-results/molt-active-card-contract.png` and `.artifacts/test-results/molt-active-card-contract-state.json`.

- Enemy description art-direction polish follow-up: strengthened seven weaker runtime enemy descriptions/visualBriefs with concrete fashion/accessory, streetwear, and urban-place cues while preserving anatomy constraints and gameplay data.
- Re-ran the fashion/urban heuristic audit: all 64 playable enemies now meet the cue threshold. Verification passed with `npm run validate:runtime`, `npm run build`, focused enemy Codex smoke, the required generic `develop-web-game` client, and direct Codex detail screenshot `.artifacts/test-results/codex-enemy-fashion-copy-pass.png`.

- Reward card-choice visual polish follow-up: replaced the post-combat Add-to-Flock/Preen choice cards' heavy text slabs with larger art-forward card frames, lighter glass panels, suit-accent borders, stroked labels, and compact footer metadata; also aligned the market Add-to-Flock offer tile with the same mini-card treatment.
- Verification: `npm run build`, focused reward/market/card-detail Playwright smoke tests, required generic `develop-web-game` client, and production-preview screenshots in `.artifacts/test-results/reward-card-polish-final/`.

- Combat tension tuning follow-up: audited flock/card/enemy scaling and found the main player-favoring pressure came from passive Damage/Cover stats compounding through multi-hit, AoE, burst, Surge, and Nests carry interactions rather than from route economy drift.
- Tuned runtime combat scaling so passive Damage applies once per played card, AoE gets a smaller passive Damage bonus, Resonance/Winded bursts no longer double-dip passive Damage, passive Cover is softened, Surge gives +1 instead of +2, and the Nests Cover carry cap is 8.
- Added `npm run audit:balance` for the existing balance-audit script and updated formation smoke coverage for the new Surge contract.
- Verification: `npm run audit:balance`, `npm run audit:economy`, `npm run build`, `npm test`, `npx playwright test tests/smoke.spec.ts --grep combat`, `npx playwright test tests/smoke.spec.ts --grep "Cover"`, and the generic `develop-web-game` client passed. Latest generic client screenshot/state: `output/web-game/shot-1.png`, `output/web-game/state-1.json`.

- Market layout polish follow-up: rebuilt the route market overlay as a stall row with a string-light lane, awning trim, a recruit perch, waymark board, and preen bench so the screen reads like visiting a market instead of three menu boxes.
- Verification: `npm run build`, focused Playwright smoke tests for market shelves/route event backdrops/card hover details, required generic `develop-web-game` client, and production-preview screenshot `.artifacts/test-results/market-layout-polish/market-stall-layout-final.png`.

- Market decision pass: replaced one-shot market offers with seeded per-visit shelves: four rarity-priced card listings, two unowned Waymark listings, a utility shelf with Preen/Release/Supply options, and paid Scrap refresh that rerolls fresh stock while individual purchases sell out their row.
- Market prices now use the existing `alpha-market.json` bands with rarity/district scaling, and the route text-state exposes full market shelves plus refresh cost/count for tests and debugging.
- While verifying, build surfaced existing in-progress combat-state type drift (`fouled`, enemy roles/solo/damageBonus); aligned the constructors/text payloads with those fields without rolling back that work.
- Verification: `npm run build`, focused Playwright smoke tests for market shelves/route event backdrops/card hover details, required generic `develop-web-game` client, in-app browser opened `http://127.0.0.1:5173/`, and inspected market screenshot `.artifacts/test-results/market-meaning/market-stocked-final.png`.

- Route map node-spacing fix: route node placement now reserves explicit visual room for focus ticks above icons and reward-badge pips below icons, then spaces lanes across the usable graph band so four-lane generated columns do not overlap.
- Exposed `position` and `visualBounds` for route nodes in the text-state harness and added a smoke test that sweeps 4 districts x 12 seeds to fail on any overlapping generated route-node footprint.
- Verification: `npm run build`, focused route-map Playwright smoke tests, required generic `develop-web-game` client against built preview, in-app browser opened built preview `http://127.0.0.1:5324/`, and inspected built-preview screenshot `.artifacts/test-results/route-node-spacing/route-four-lane-spacing.png`.

- Enemy tension/mechanics pass: added explicit enemy roles, solo non-boss encounter tuning (+HP and +1 persistent damage), ally-support enemy verbs, and the new Fouled poison status.
- Authored support/poison identities into existing enemies: Signal Gull, Market Crow, Cicada Static Swarm, Crane Signal Caller, Moth Lantern-Drifter, Skunk Chemist, and Vulture Cleanup Crew; tagged supporting/poison encounters across districts.
- Expanded runtime validation/audit coverage for enemy roles, support/poison verbs, encounter tags, status registry, and balance-audit composition reporting.
- Added smoke coverage for solo tuning, support companion targeting, and Fouled tick behavior.
- Verification: `npm run validate:runtime`, `npm run audit:balance`, `npm run build`, `npm test`, full `npx playwright test tests/smoke.spec.ts`, and the required generic `develop-web-game` client passed. Latest generic screenshot/state: `output/web-game/shot-1.png` and `output/web-game/state-1.json`.

- Combat convenience HUD pass: added an incoming-damage prediction to the flock Cohesion bar. Visible enemy attack intents now create a red at-risk segment on the current Cohesion fill with a `-N / After X` marker after current Cover is applied.
- Exposed the same prediction in the combat text-state as `flock.incoming` (`total`, `blocked`, `hpLoss`, `afterHp`, `attackers`) and added smoke coverage for the math.
- Verification: `npm run build`, focused Playwright smoke test `flock Cohesion bar exposes incoming damage prediction after Cover`, `npm test`, required generic `develop-web-game` client, and inspected combat screenshot `.artifacts/test-results/combat-incoming-health-preview.png`.

- Support encounter composition follow-up: converted every solo support encounter into a paired fight with at least one non-support threat so support enemies create target-priority decisions instead of low-pressure stall turns.
- Updated Signal Gull, Market Crow, Cicada Static Swarm, Crane Signal Caller, and Vulture Cleanup Crew encounters with companion enemies and `multi`/`support` tags where needed.
- Added a runtime data validation guard that fails any support-only encounter composition, including future support-only pairs.
- Verification: focused support-composition audit script, `npm run validate:runtime`, `npm run audit:balance`, `npm run build`, `npm test`, required generic `develop-web-game` client, and inspected `output/web-game/shot-1.png`.

- Market shop-scene redesign follow-up: researched Slay the Spire and Monster Train shop presentation, then rebuilt the market overlay from a row-list layout into a place-like shop scene with a vendor, awning/string lights, card rack, waymark tray, service signs, object-mounted price tags, refresh sign, and sold slats.
- Kept the existing randomized shelves, rarity-priced offers, paid refresh, finite purchases, and hover details intact while making the visual grouping follow goods/services/currency rather than three menu boxes.
- Verification: `npm run build`, focused market/hover/event Playwright smoke tests, required generic `develop-web-game` client against built preview, and inspected `.artifacts/test-results/market-shop-redesign/market-shop-scene-final.png`.

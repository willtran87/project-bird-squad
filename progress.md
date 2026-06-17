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

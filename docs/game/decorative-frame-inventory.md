# Decorative-frame implementation inventory

Fixed acceptance item 24; this is not a new backlog. Authored card borders are
part of their illustrations and must remain intact. Repeating an ornate raster
border around an arbitrary-size text panel is not an acceptable substitute for
a real layout. Whole-image scaling preserves source proportions; stretchable
panels use nine-slice composition with uniformly scaled corners.

| Rendered family | Composition | Implementation / check |
| --- | --- | --- |
| Title, setup, buttons, Settings, guide, pause | Quiet vector surfaces and outlines | quiet-ui, system-overlays, title/setup tests |
| Collection toolbar, reader, dossier and scroll cues | Vector panels; canonical card contained in its art slot | codex-scene; frame-composition Collection/dossier |
| Flock, Folio, editor and recorded-flight panels | Vector surfaces; intact portrait slots | profile-scene, deck-portrait |
| Route map surround | Nine-slice, fixed 64px horizontal / 42px vertical corner sections, uniform scale | renderRouteMapFrame |
| Route heading, feedback and contract notice | Quiet vector surfaces; no arrival-dependent border replacement | renderRouteDistrictBanner, renderRouteSupplyFeedbackStrip, renderDistrictContractCelebration |
| Route selection / boss rings | Square authored rings with uniform scale | renderSelectedRouteNodeFocus, renderRouteBossBeaconRing |
| District transition title | Authored 1024×224 plaque at 610×134; rounding error below 0.5% | renderDistrictAdvanceFlourish |
| Deck, Supply and Waymark readers | Vector panels; Waymark rail uses nine-slice with fixed endcaps | route-deck-browser, route-supply-drawer, waymark-review, addRouteWaymarkScrollRailFrame |
| Market merchandise | Authored 512×384 backplate at 152×114; no distortion | renderMarketMerchandise |
| Market service shelves | Nine-slice horizontal extension with uniform corner scale | renderMarketServices |
| Market fallback price / service / tray panels | Vector surfaces; no arbitrary raster stretch | renderMarketPriceChipFrame, renderMarketServiceButtonFrame, renderMarketCardPriceTagFrame, renderMarketOfferTray |
| Sold slat | Authored 640×192 aspect at every card width | renderMarketSoldSlat |
| Preen / Release page indicator and confirmation | Vector surfaces independent of artwork loading | renderCardPickerPageIndicatorFrame, renderCardPickerConfirmationRail |
| Route / battle tooltips and card-hover stats | Vector surfaces; duplicate decorative card-dossier border removed | showSimpleTooltip, buildTooltip, renderCardHoverDetail |
| Combat HUD, commands, reward choice and outcome | Vector surfaces; authored ornament only for semantic accents | render-hud, render-reward, boss-dossier |
| Combat Molt card edge | Authored 2:3 frame with subpixel inset rounding; stable selection geometry | render-hand |
| Encounter plaque | Contain fit based on actual source dimensions, never independent X/Y stretch | encounter-intro |
| Reward hover ring | Nine-slice 24px corners, uniformly scaled | render-reward |
| Canonical card / Snag borders | Full illustration containment; shared Snag fallback contains even unexpected slot ratios | renderSnagCardBorder, deck-portrait, reward-card-face, render-hand |

Source inspection distinguished inactive legacy functions from live consumers.
The old Profile title/stat/progress/return flourishes and system menu/title/guide
image-frame helpers have no call sites. `addSystemFieldCommandFrame` and
`addDeckReviewDetailFrame` likewise have no consumers. They are not presented as
rendered artwork and are not counted as new defects merely because they remain
in source. Re-enabling them requires the same composition checks.

`tests/frame-composition.spec.ts` inventories actual visible Image/NineSlice
objects and source/display dimensions, checks aspect ratios at 2560×1600,
1440×900 and 1000×560, and captures each named surface. It also visits feedback,
contract/transition, sold-offer and tooltip states. Inventory attachments make
zero-ornament surfaces explicit rather than requiring decorative images to exist.
Current qualification results are recorded in `remaining-24-closure.md`.

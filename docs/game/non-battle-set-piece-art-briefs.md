# Non-Battle Set Piece Art Briefs

Market is already represented by Veyra Tallybright, a starling canal curator with jewel-toned canal-market tailoring. New non-battle encounters should not reuse her species, silhouette, or fashion language.

Each set piece needs a distinct resident species, fashion style, and centerpiece object:

| Encounter | Resident | Species | Fashion Style | Centerpiece |
| --- | --- | --- | --- | --- |
| Lantern Roost | Sella Warmwick, Lantern Roost Keeper | Golden weaver finch | Insulated roost-host layers, plaid scarf, brass charms, practical winter workwear | Heated brass roost hearth |
| Rooftop Cache | Marn Valeclip, Lockbox Archivist | Hooded crow | Numbered archive coat, wax-tag straps, salvage-office tailoring | Sealed pulley cache cabinet |
| Signal Landmark | Ivo Tallymast, Wire Cartographer | Kestrel | Signal-runner sash, lens cords, chalk tabs, lean rooftop technician gear | Illuminated switchboard route map |
| Featherwright Studio | Oren Shearbright, Deck Tailor | Pileated woodpecker | Lacquered work smock, measuring cords, boutique repairwear | Grooming chair and feather press |
| Rival Wager | Caldra Pinion, Velvet Wager Broker | Peafowl | Glossy statement capelet, jewel pins, wager-table evening streetwear | Contract case and prize board |

Art direction stays consistent with the title splash and market scene: modern bird-streetwear, jewel-toned lighting, grounded canal-city materials, large readable resident silhouettes, and set pieces that feel like landmark visits rather than menus.

Generated assets should be decomposed like the market where useful: background, resident cutout, centerpiece/sign prop, and compact UI-safe text zones. Do not generate legible text inside the art unless the text is supplied verbatim.

## Implementation Status

The playable set-piece pass uses decomposed route-event assets: individual scene plates for each landmark, chroma-key source PNGs for each resident, alpha-source PNGs for review, and transparent runtime WebPs for in-game composition.

| Encounter | Current Backdrop | Current Resident Art | Centerpiece Props |
| --- | --- | --- | --- |
| Lantern Roost | `route-events/lantern-roost-shelter-v2.webp` | `route-events/sella-warmwick-v1.webp` | `route-events/lantern-roost-hearth-v1.webp`, `route-events/lantern-roost-sign-v1.webp`, `route-events/lantern-roost-rain-pipe-v1.webp`, `route-events/lantern-roost-awning-v1.webp`, `route-events/lantern-roost-wrapped-snack-v1.webp` |
| Rooftop Cache | `route-events/rooftop-cache-office-v1.webp` | `route-events/marn-valeclip-v1.webp` | Pending |
| Signal Landmark | `route-events/signal-switchboard-v1.webp` | `route-events/ivo-tallymast-v1.webp` | Pending |
| Featherwright Studio | `route-events/featherwright-studio-v1.webp` | `route-events/oren-shearbright-v1.webp` | Pending |
| Rival Wager | `route-events/rival-wager-board-v1.webp` | `route-events/caldra-pinion-v1.webp` | Pending route-choice flow |

Each resident's source folder includes `*-chroma-source.png` on a flat green background and `*-alpha-source.png` for transparent review. Rival assets are prepared for the plan, but Rival still needs a route-choice flow before it can use the set-piece overlay in play.

Lantern Roost is the first completed scene in this set-piece pass. It now uses a dedicated scene plate, Sella Warmwick's decomposed resident cutout, separate hearth/sign prop art, and choice-specific rain pipe/awning/wrapped snack props so the Basin visit feels like a landmark stop rather than the generic route-event layout.

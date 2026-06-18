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

The playable set-piece pass uses scene-and-resident route-event assets: individual scene plates for each landmark, chroma-key source PNGs for each resident, alpha-source PNGs for review, and transparent resident runtime WebPs for in-game composition.

| Encounter | Current Backdrop | Current Resident Art | Scene Focus |
| --- | --- | --- | --- |
| Lantern Roost | `route-events/lantern-roost-shelter-v3.webp` | `route-events/sella-warmwick-v2.webp` | Heated brass roost hearth integrated into the background |
| Rooftop Cache | `route-events/rooftop-cache-office-v2.webp` | `route-events/marn-valeclip-v2.webp` | Sealed pulley cache cabinet integrated into the background |
| Signal Landmark | `route-events/signal-switchboard-v2.webp` | `route-events/ivo-tallymast-v2.webp` | Illuminated switchboard route map integrated into the background |
| Featherwright Studio | `route-events/featherwright-studio-v2.webp` | `route-events/oren-shearbright-v2.webp` | Grooming chair and feather press integrated into the background |
| Rival Wager | `route-events/rival-wager-board-v2.webp` | `route-events/caldra-pinion-v2.webp` | Contract case and prize board integrated into the background |

Each resident's source folder includes `*-chroma-source.png` on a flat green background and `*-alpha-source.png` for transparent review. Rival now uses its set-piece overlay as a pre-battle wager stop: the player can take Caldra's wager to enter the rival battle or decline and move on.

Lantern Roost is the first completed scene in this set-piece pass. It now uses a dedicated scene plate and Sella Warmwick's decomposed resident cutout so the Basin visit feels like a landmark stop rather than the generic route-event layout.

The current scene and resident pass uses the supplied image-generated Desktop exports (`1.png`/`1-1.png` through `5.png`/`5-1.png`) as the canonical art source. Full scene PNGs are preserved in the matching concept-art folders and exported as opaque runtime WebPs; each resident keeps the original chroma-source PNG, a transparent alpha-source review PNG, and a transparent runtime WebP. The in-game presentation intentionally uses only the opaque scene plate plus the resident cutout so the landmark art stays visible and uncluttered.

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

## Art-use audit: next image-generation opportunities (2026-09-24)

The current cards, enemies, residents, event backdrops, and district backdrops are already authored. Their biggest problem was presentation, not missing images: opaque map UI buried the district painting, transient route letters appeared before icon art, and geometric accents overrode the set pieces. Those are integration fixes, not reasons to regenerate the existing images.

New image-generation work would have the most value in these bounded replacements, in priority order:

1. **Quieter route-map frame variant.** Replace `route-map-frame` with a transparent 1024×500 border that preserves the exact current center opening and edge safe zones but uses only restrained brass/teal corner hardware and short inset rails. Keep the interior empty and never paint labels, paths, nodes, or text. Compare at 2560×1600 and 1000×560 before switching; the current frame is valid but visually heavier than the map content.
2. **Reward ceremony backdrop variant.** The reward screen has good card art but its large architectural frame competes with the three selections. Generate an alternate, text-free rooftop-material plate with its brightest detail outside the card and rule regions. Preserve the current 1280×640 composition and use the deterministic exporter; do not bake buttons or card slots into the painting.
3. **Rival-wager foreground prop.** Caldra and the rival scene are complete, but a small transparent contract case or prize-board cutout could ground the decision instead of relying only on the backdrop. Keep it at the side of the central reading lane, never behind choice copy. This should be approved from a full 1000×560 layout mockup before export.

Do not generate new card borders, text-bearing controls, generic combat glows, or replacement node glyphs. Those require exact repeatable geometry, interaction-state rendering, and readable scaling; the deterministic UI/asset pipeline is the better tool. For any new painted asset, retain the source PNG, derive the runtime WebP through the existing exporter, verify alpha/dimensions, and test it in the three supported viewport captures before adoption.

### Follow-up visual audit: market and event surfaces

The market already has useful object backplates and offer-tray hardware. The live merchandise cards had not used the backplates, while service offers were flat rectangles. The backplates now sit behind the goods at their native 4:3 proportion, and the existing offer tray is sliced horizontally so its end fittings remain round. This is a rendering correction, not a new-art brief.

Two genuinely useful future image-generation candidates remain after that correction:

4. **Quiet market reading-surface plate.** The 360×436 rules reader is still a mostly featureless dark rectangle beside Veyra's richly painted stall. Create a portrait paper/enamel texture with only faint edge wear and a dark, low-contrast central reading lane. Keep a minimum 20 px clear inset for body text and 58 px clear zones for page controls. Do not generate headings, glyphs, or a heavy ornate border: the current dossier frame's thick sides would collide with the reader's text. Compose and validate the final 360×436 crop deterministically.
5. **Shallow merchandise shelf grounding.** The three illustrated goods still appear to float above the market background. A low-contrast, text-free counter/shelf prop behind the offer row could ground them without changing the product cards. Generate it as a transparent scene prop, not a UI panel, and ensure its brightest detail stays below the product illustrations and away from prices. Reject it if the 1000×560 comparison becomes busier.

Event option rows and reward buttons look geometric next to their painted scenes, but these are interaction surfaces with variable copy and focused/disabled states. Prefer a code-native, restrained state treatment or carefully sliced existing hardware there; do not bake choices or button labels into generated paintings. The unused ornate route-choice frame is too visually heavy to repeat across every option.

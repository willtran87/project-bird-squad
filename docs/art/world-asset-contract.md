# World Asset Contract

This is the canonical inventory for the current Bird Squad world-demo direction. World art must match the modern, rain-wet bird-city language defined by the art bible and its primary splash reference: present-day or near-present rooftops, canals, antennas, utility hardware, practical lighting, and grounded materials. Old planning-paper, flat prototype, generic arena, fantasy, and superseded generation assets are not part of the current implementation.

## Canonical Runtime Families

- District route backdrops: the four `assets/runtime/backdrops/<district>-route-map-v1.webp` files.
- District battlefields: the four `assets/runtime/backdrops/<district>.webp` files.
- Boss battlefields: the four named boss files under `assets/runtime/backdrops/variants/`.
- Non-battle landmarks: the five current scene plates, five v2 resident cutouts, and four current props under `assets/runtime/route-events/`; the three standalone centerpiece masters under `assets/concept-art/route-event-centerpieces/sources/` are part of the matching source allowlist.
- Market: the four files under `assets/runtime/market-kit/`.
- Route nodes: the eight individual WebPs under `assets/runtime/map-icons/icons/`, sourced from the splash-v7 set.
- Style/title anchors: only the current canal-run v11 PNG/WebP pair and the canonical bold-streetwear v3 PNG/gate WebP remain under `assets/splash/`. Earlier numbered splash generations are retired.

The matching world source directories are also exact allowlists. Current district route-map sources, route-event sources, market-kit sources, and splash anchors may remain; superseded generations may not accumulate beside them.

The exact filenames are enforced by `tools/validate-world-assets.mjs`, which runs as part of `npm run validate:runtime-assets`. Adding or replacing world art requires updating the runtime wiring and that allowlist in the same change.

## Retired Legacy Families

The cleanup removed 117 superseded files: 43 runtime/style assets and 74 matching concept sources. These families must not be restored or used as implementation references:

- The laminated planning-board route backing (`route-board-laminated-plan-v1`) and the retired `assets/battlefields/` path.
- Runtime node atlases `map-node-icon-atlas-v1` and `map-node-icon-atlas-contrast-v2`; concept atlases and crops from contrast-v2 and splash-v3 through splash-v6. Splash-v7 is the only route-node source generation that remains.
- Title/style generations `bird-squad-splash-v1` and canal-run splash-v4 through splash-v10. Canal-run v11 and bold-streetwear v3 are the only current splash anchors.
- Generic district variants `rooftop-blocks-cache-billboard-v1`, `canal-markets-supply-market-v1`, `signal-spires-signal-relay-v1`, and `high-roost-workshop-prep-v1`. District battlefields and the four named boss variants replace them.
- The v1 route-event scene plates, resident cutouts, and loose decor for Lantern Roost, Rooftop Cache, Signal Switchboard, Featherwright Studio, and Rival Wager. Only the exact current v2/v3 plates, v2 residents, and four named props in the canonical inventory above may be wired.

The validator checks the complete owned directory trees as exact allowlists, as well as retired source-code tokens. Reintroducing a removed file under an old or newly invented subdirectory, a legacy directory, obsolete builder reference, or string-based fallback fails the release validation.

## Ownership Rules

- Runtime code must import explicit world filenames. Broad eager globs over a world-art directory are forbidden because they silently ship discarded generations.
- The owned world roots are closed inventories. New nested folders are not archival space; every new world file must be added to the canonical allowlist in the same change that wires it.
- `assets/battlefields/` is a retired path and must stay absent.
- The pale laminated planning-board backing is retired. Route nodes now sit directly over the district world backdrop inside the current map frame.
- Only the splash-v7 route-node source atlas and crops remain under `assets/concept-art/ui/route-map/`; earlier contrast and splash generations are retired.
- Runtime-art builders must target the current named source. They may not regenerate an older numbered splash or silently restore retired outputs.
- Historical progress logs can describe removed work, but they are not asset manifests or implementation guidance.

## Replacement Checklist

When a world asset is replaced, remove the superseded runtime export and its obsolete concept source, update every explicit import, update the validator allowlist, build the game, and visually inspect both route and battle surfaces. Do not preserve numbered alternates in runtime directories “just in case”; source history belongs in version control, not the live asset tree.

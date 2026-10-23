# Runtime artwork review — October 22, 2026

This is an LLM visual review for acceptance items 20 and 41–45. It records
implementation quality at the supported game sizes, not human enjoyment.
Release qualification and the final build identity are recorded separately in
`../game/remaining-24-closure.md`.

## Complete inventory and method

`tools/build-art-review-inventory.py` matches every delivered raster by SHA-256
to its repository export, records identical aliases, selected source and source
hash, dimensions, bytes, alpha range/bounds, consumers, crop and loading policy.
It produces a JSON inventory and contact sheets with alternating dark and light
backgrounds. An inventory entry is a delivered file, not a count of unique game
objects. Full and compact tiers are distinct entries.

The final candidate has 872 distinct delivered rasters: 221 card images, 81 enemy
images, 10 Flock portraits, 14 route-event images, 4 Market images, 12 backdrops,
8 map icons, 64 Supply images, 116 Waymark images, 69 effects, 269 UI images and
4 title images. Duplicate enemy full/reserve exports are recorded as aliases.
The browser decoder check covers all entries, including their alpha extrema.

Five older world plates retain their published WebP as the only available
master. `runtime-art-source-overrides.json` identifies this explicitly; no
upstream PNG provenance is invented. Both title logo PNGs are lossless masters.

## Reviewed dispositions

| Family | Review and disposition |
| --- | --- |
| All 110 cards | Complete per-card decisions, species checks, gameplay scales and 18 repairs/reframes are in `card-gameplay-review.md`. Ninety-two illustrations retained. |
| Enemies | All 81 delivered silhouettes inspected on seven sheets. Avian wings/feet, mammal paws, tails and non-avian bodies remain distinguishable. Clothing occlusion is intentional; no additional anatomical repair identified. Dark outer contours, bright local material highlights and readable target silhouettes retained. |
| Flock | Ten leader views inspected together: avian bodies, beaks, wings, stance and streetwear remain consistent across full/compact representations. Retain. |
| Residents and Market | All 18 images inspected: revised avian residents use wings and talons; scene plates and props preserve their city/workshop context. Retain. |
| Backdrops and title | All 16 images inspected for horizon, subject hierarchy, lighting, usable contrast and cropping. Retain; live placement is governed by the world and decorative-frame contracts. |
| Map icons | Seven retained. Signal had disconnected right-edge specks and green fringe; repaired using the image tool, then exported uniformly to 384×384 with alpha, 31,440 bytes under the existing 32 KiB cap. |
| Supplies and Waymarks | Both tiers inspected on all 16 sheets. Twenty illustrated objects had clipped boundaries or disconnected atlas fragments. The exact repair queue, prompts and selected masters are in `item-art-repairs.json`. Remaining objects retain their existing designs. Frayed cloth, severed wires, sparks, drips and loose chalk are intentional authored content. |
| UI | All 23 sheets inspected. Circular medallions, directional glyphs, frames and flourishes retained. Compact preload copies are deliberately lower resolution; live consumers use them at small sizes. Decorative frame placement is separately specified in `../game/decorative-frame-inventory.md`. |
| Effects | All six sheets inspected. Separated particles, transparent fades and directional strips are intentional. These are effects rather than isolated object cutouts; their animation geometry is covered by combat FX contracts. Retain. |

The item repairs preserve object identity, palette, material, orientation and
pixel-art treatment. New transparent masters have complete boundaries. No
canonical card frame or generated card typography was edited by image generation.

## Reproducibility and evidence

- Selected card master/composite/export equality and deterministic borders and
  typography: `validate:canonical-card-art` plus the Python card tests.
- Enemy export now rebuilds every selected manifest entry, including adopted
  reserve enemies, and validates all masters before writing. The old hard-coded
  33-enemy bootstrap no longer discards the current 64-enemy manifest.
- Repaired item masters: `build:runtime-item-art`; full 512px exports precede
  the existing 256px compact tier. The selected repair manifest is versioned.
- Signal: `python tools/build-runtime-ui-art.py --signal` reproduces its export.
- The final browser audit decoded all 872 images with exact dimensions/alpha,
  including the repaired item exports; zero missing sources or consumer mappings.
- Major cards retain their individually approved raster lettering and frames as
  immutable separate layers. Exact pixel/hash/recomposition checks preserve those
  designs. All ten Snags reproduce from borderless sources, template and font.
  All 220 lossless card tiers match their selected masters at the export sizes.
- Initial/full-resolution sheets and before images are retained under
  `D:/codex-bird-squad-closure24-20261021/evidence/`.

## Item 45 — delivered artwork in context

Verified on `index-By96udgS.js`. `repaired-item-context/review-index.json` records
60 loaded dossier captures: all 20 repairs at 2560×1600, 1440×900 and 1000×560.
Every image retains uniform scaling and contained bounds; saved data is unchanged
and no page errors occur. All 20 compact contexts and their 64px exports were
visually inspected. Dark/light review sheets expose alpha edges, fringe and
compression; no remaining must-fix repair was identified. Signal was inspected
on the route at all three sizes. Current live card, character, Market, event,
title and dossier captures complement the complete delivered-image review.

Current candidate checks pass delayed/failed combat and route art, eight district
transitions, Collection/Deck/Folio recovery, hand-art continuity, fallback reward
and hand renderers, and Waymark failure/reload recovery. Waymark's native download
dialog is dismissed through Keep playing before checking underlying Pause input;
the focused four-case recheck retains state and narration assertions. Generated
FX ownership passes both motion settings after waiting for its actual deferred
texture (`final-fx-texture-recheck.log`, 2/2). All 872 delivered rasters decode
with exact dimensions and alpha; no missing active export remains.

Review status: items 20 and 41–45 verified. This evidence does not substitute
for the separate fresh full regression or final performance/input qualification.

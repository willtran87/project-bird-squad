# Runtime card placement contract

The approved runtime card surface is the complete canonical 2:3 card. Identity
is joined by card ID through `assets/runtime/cards/card-art-manifest.json`.
Do not replace it with a centered square or stretch its frame to fill a panel.

| Consumer | Export | Placement / subject policy |
| --- | --- | --- |
| Combat hand | thumbnail | Complete 60×90 portrait beside the name. Name, cost, state badges, Flow and rules occupy separate reserved regions, never cover the illustration. The full reader remains available. |
| Combat pile reader | loaded portrait or thumbnail | Complete 2:3 image in the reserved portrait area. |
| Reward / Preen / offline reward | thumbnail | Uniform contain in the 72×108 slot; identity and rules outside it. |
| Release / Preen picker | thumbnail | Complete 66×99 card, with identity below and price above. |
| Collection gallery | thumbnail | Complete card in the 244-high portrait area; markers outside the illustration. |
| Collection dossier | portrait | Complete canonical card; gameplay name and illustration title are separate facts. |
| Deck detail / comparison | portrait, thumbnail fallback | Uniform contain in the reserved slot even if a replacement has unexpected dimensions. |
| Market shelf | thumbnail | Complete 148×222 or 176×264 card; price and gameplay title outside. |
| Market dossier | none | Rules-only reader; the complete image remains on the adjacent shelf. No redundant portrait request. |
| Route card reader | portrait or thumbnail | Complete 2:3 image; no cover-fit crop. |
| Folio / starter / showcase | thumbnail | Uniform contain in the owned cover slot, with card ID and name retained. |

`build-runtime-card-art.py` uses `ImageOps.contain` for both active exports.
Current approved assets are 512×768 portraits and 184×276 thumbnails. All 110
active cards must retain those proportions; geometry tests also check that
rendered scale is uniform and texture crop/mask is absent.

## Square export boundary

The exporter also retains a legacy 128×128 icon derivative made with focal
position `(0.5, 0.38)`. It is **not imported or used by the runtime**: the active
asset globs include only `portrait/` and `thumb/`. Its presence in the asset
manifest does not approve that generic crop for a gameplay consumer. No current
surface needs per-card focal metadata because no active card illustration is
cropped. A future square consumer must first supply per-card subject-safe crop
metadata and visual evidence; this fixed backlog does not add such a consumer
or regenerate unused assets.

## Regression coverage

- `card-identity-contract.spec.ts`: every Collection/Market/picker/Folio card
  uses its correct, uncropped, unmasked, uniformly scaled image; loaded pixels
  match canonical exports.
- `card-pool-layout.spec.ts`: all 110 runtime cards in four stance combinations
  and three viewport sizes retain contained, uniformly scaled hand art, with
  no intersection between artwork and name/rules panels or text.
- `codex-card-gallery.spec.ts`: all 110 illustrations and external markers.
- `deck-art-continuity.spec.ts`: reserved portrait containment and proportions
  through loading, failure, recovery and comparison.

This contract concerns placement, not a blanket artistic-quality grade. The
per-illustration visual review and anatomy/style audit are separate items.

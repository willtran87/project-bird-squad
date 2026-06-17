# Aviary Generation Runbook

This runbook is the operator checklist for generating Bird Squad Aviary cards.
Aviary cards are not tarot cards. They follow the Minor Arcana border-first
workflow, but use the shared master raster border instead of per-suit border
templates.

Source references:

- `docs/art/art-bible.md`
- `docs/art/border-first-generation-pipeline.md`
- `docs/art/tarot-border-template-pipeline.md`
- `data/cards/arcana/aviary-arcana.json`
- `assets/templates/minor-arcana/raster-border-templates/master.png`
- `docs/art/prompt-packs/aviary-center-art-prompts.md`

## Target Outputs

Create one dated run folder:

```powershell
$run = "2026-06-17-aviary-master-border-v1"
$centerRoot = ".generated/imagegen/tarot/aviary-center-art-runs/$run"
$finalRoot = ".generated/imagegen/tarot/aviary-border-first-runs/$run"
$qaRoot = "tmp/qa/aviary/$run"

New-Item -ItemType Directory -Force "$centerRoot/aviary", "$finalRoot/aviary", $qaRoot
```

Expected center-art filenames:

```text
aviary_22.png
aviary_23.png
aviary_24.png
aviary_25.png
aviary_26.png
aviary_27.png
aviary_28.png
aviary_29.png
aviary_30.png
aviary_31.png
aviary_32.png
aviary_33.png
aviary_34.png
aviary_35.png
aviary_36.png
aviary_37.png
aviary_38.png
aviary_39.png
aviary_40.png
aviary_41.png
aviary_42.png
aviary_43.png
```

Save center art under:

```text
.generated/imagegen/tarot/aviary-center-art-runs/{run}/aviary/{cardId}.png
```

Final composited cards are written to:

```text
.generated/imagegen/tarot/aviary-border-first-runs/{run}/aviary/{cardId}.png
```

## Prepare Prompts

Regenerate the Aviary center-art prompt pack from the current art bible and card
data:

```powershell
npm run export:aviary-center-prompts
```

The prompt pack is written to:

```text
docs/art/prompt-packs/aviary-center-art-prompts.md
docs/art/prompt-packs/aviary-center-art-prompts.json
docs/art/prompt-packs/subagent-aviary-center-art-briefs/aviary-legends-brief.md
```

Use these prompts with imagegen. Generate center art only: no card border, no
title cartouche, no medallions, no top badge/title, no readable title, no
labels, and no readable text anywhere in the raw image.

## Imagegen Step

Use one prompt per card from `aviary-center-art-prompts.md`.

Hard requirements for each generated center-art candidate:

- high-resolution pixel art only;
- fixed 1024x1536 portrait canvas;
- bird and card-defining action centered inside the future overlay-safe area;
- modern urban bird-city setting fills the full canvas behind the subject;
- no generated border, title, medallion, cartouche, top badge/title, logo, or
  readable text;
- bird anatomy remains avian: exactly two wings, exactly two legs, no arms, no
  hands, no fingers, no human torso, no wing-hands, no extra limbs;
- only the named bird species appears, except `Flock Signal`, which may use a
  same-species Red-billed Quelea murmuration;
- action reads as bird-originated, not produced by technology, magic, or the
  future border.

## Compositing

Composite approved center art under the shared master raster border:

```powershell
npm run compose:aviary-art -- `
  --source-root $centerRoot `
  --output-root $finalRoot `
  --template assets/templates/minor-arcana/raster-border-templates/master.png `
  --strict
```

The compositor will:

- fit center art to the master template opening;
- place `master.png` above the center art;
- render the Aviary title from `gameName` in the bottom cartouche;
- render the top badge/title from `qualityCode` or `roman` in the top medallion;
- export exactly 1024x1536 PNGs.

## Contact Sheets And Validation

Create contact sheets after center-art review and after final compositing:

```powershell
npm run qa:aviary-contact-sheet -- `
  --source-root $centerRoot `
  --output-root "$qaRoot/center"

npm run validate:aviary-composites -- `
  $finalRoot `
  --source-root=$centerRoot

npm run qa:aviary-contact-sheet -- `
  --source-root $finalRoot `
  --output-root "$qaRoot/final"
```

## QA Checklist

Each final Aviary card must pass:

| Gate | Pass Criteria |
| --- | --- |
| Count | Twenty-two final PNGs, `aviary_22` through `aviary_43` |
| Dimensions | Every final PNG is exactly 1024x1536 |
| Border | Uses the shared `master.png` raster border as the visible frame |
| Top Badge | Top medallion shows the compositor-owned badge/title mark from card data |
| Title | Bottom cartouche shows the Bird Squad title from `gameName` |
| Anatomy | Bird has natural avian body, exactly two wings, exactly two legs, no hands, no arms, no wing-hands, and no extra limbs |
| Species | Card depicts only the named species; `Flock Signal` may include same-species Red-billed Quelea support only |
| Composition | Bird, beak, feet, tail, action, and symbolic objects are not cropped by the master border |
| Streetwear | Fashion is modern, individual, bird-safe, and not gang-coded |
| World | Present-day urban bird-city, not medieval fantasy or future sci-fi |
| Medium | High-resolution pixel art with crisp clusters and deliberate dithering |
| Text Hygiene | No readable generated text except compositor-owned title and top badge/title |

## Reroll Criteria

Reroll center art before compositing if any of these appear:

- generated card border, title cartouche, medallions, top badge/title, or title
  text;
- realistic painting, smooth illustration, photographic rendering, or
  non-pixel-art style;
- hands, arms, fingers, wing-hands, sleeve-arms, humanoid torso, or human pose;
- more or fewer than two wings or two legs;
- mixed bird species, hybrid traits, or unrelated background birds;
- old-world fantasy, future sci-fi, magical particles, holograms, or
  technology-sourced spectacle;
- subject head, beak, feet, tail, or card-defining action too close to the
  future border or title cartouche;
- readable clothing text, logos, slogans, brand names, crew names, or
  pseudo-writing.

Recompose instead of rerolling if the center art is good but the overlay is
misaligned, the final dimensions are wrong, or the title/top badge rendering needs
adjustment.

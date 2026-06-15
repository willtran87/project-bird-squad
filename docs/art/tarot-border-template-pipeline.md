# Tarot Border Template Pipeline

This pipeline upgrades the Minor Arcana border system from procedural placeholder
frames to polished reusable tarot border templates.

The goal is to let imagegen create the visual frame once, then let the repo own
reuse, title text, dimensions, validation, and compositing.

## Asset Model

Each final card is assembled from three layers:

```text
 center art PNG
+ transparent raster border template PNG
+ deterministic title text
= final 1024x1536 card PNG
```

Imagegen should create **blank border templates**, not finished cards.

Use the existing full-card Minor Arcana art under
`assets/concept-art/minor-arcana/` as the primary style reference. The approved
frame language should feel hand-inked, dark, gilt, ornate, and tarot-fantasy
first: black outer keyline, aged gold filigree, colored enamel medallions,
weathered illustrated texture, and a slightly magical storybook finish. Urban
streetwear culture should surface only as subtle patina, worn paint, sticker-wear
shapes without text, and city-night color accents. Avoid a hard technological,
machined, cyberpunk, or industrial panel frame.

## Required Template Files

Store approved template overlays here:

```text
assets/templates/minor-arcana/raster-border-templates/master.png
assets/templates/minor-arcana/raster-border-templates/plumes.png
assets/templates/minor-arcana/raster-border-templates/basins.png
assets/templates/minor-arcana/raster-border-templates/quills.png
assets/templates/minor-arcana/raster-border-templates/nests.png
assets/templates/minor-arcana/raster-border-templates/template-manifest.json
```

Each PNG must be:

- `1024x1536`;
- RGBA with transparency;
- transparent through the central art window;
- an opaque blank illustrated bottom title cartouche with clean contrast for
  compositor-owned title text;
- no readable text;
- no bird, character, figure, clothing, logo, rank, number, or suit word;
- visually aligned to the shared geometry from the manifest.

## Geometry

The template must preserve this shared geometry:

| Region | Coordinates |
| --- | --- |
| Canvas | `1024x1536` |
| Image window | `x=104, y=164, width=816, height=1146` |
| Title cartouche | `x=154, y=1310, width=716, height=112` |
| Top medallion | `cx=512, cy=92, r=46` |
| Left rail | `x=60, y=176, width=46, height=1090` |
| Right rail | `x=918, y=176, width=46, height=1090` |

The image window must remain open so center art can show through. The title
cartouche can be decorative, but it must leave enough clean contrast for the
repo compositor to render titles like `Ace of Plumes`.

## Creation Workflow

1. Generate the master blank template from:

   ```text
   docs/art/prompt-packs/tarot-border-template-prompts.md
   ```

2. Use a flat chroma-key color for the center window, preferably `#00ff00`.

3. Save raw imagegen outputs under:

   ```text
   assets/templates/minor-arcana/raster-border-templates/raw/
   ```

4. Convert a raw template into a transparent overlay. Clear the center image
   window only; keep the blank illustrated title cartouche intact so the
   compositor can draw title text on top of it:

   ```powershell
   npm run prepare:minor-border-template -- `
     --input assets/templates/minor-arcana/raster-border-templates/raw/plumes-raw.png `
     --output assets/templates/minor-arcana/raster-border-templates/plumes.png `
     --clear-image-window
   ```

5. Validate templates:

   ```powershell
   npm run validate:minor-border-templates
   ```

6. Compose cards using approved templates:

   ```powershell
   npm run compose:minor-art -- `
     --source-root assets/concept-art/minor-arcana-center-art-runs/{run} `
     --output-root assets/concept-art/minor-arcana-border-first-runs/{run} `
     --template-root assets/templates/minor-arcana/raster-border-templates `
     --strict
   ```

If a suit template is missing, the compositor falls back to the procedural
border so work can continue, but final art review should use the approved
raster templates.

## Prototype Font Overrides

The compositor can preview an alternate title font without putting the font file
in tracked assets:

```powershell
npm run compose:minor-art -- `
  --source-root assets/concept-art/minor-arcana-center-art-runs/{run} `
  --output-root tmp/qa/taroth-title-preview/composited `
  --template-root assets/templates/minor-arcana/raster-border-templates `
  --title-font .artifacts/fonts/taroth-sharp/TarothSharp-Regular.ttf `
  --strict
```

Taroth Sharp from 1001 Fonts is a personal-use demo font. Keep it in
`.artifacts/` for local visual tests only unless a commercial license is
confirmed. Do not publish the font file in tracked repo assets.

## QA Gates

Reject or revise a border template if:

- the center window is opaque or muddy;
- the generated frame contains readable text or pseudo-writing;
- the title cartouche already contains generated words, numbers, or symbols;
- suit motifs drift into another suit;
- the border feels like hard technology, sci-fi UI, industrial machinery, or a
  machined equipment panel;
- the border feels like plain old-world parchment instead of Bird Squad's
  modern urban tarot-fantasy;
- the frame is asymmetric, cropped, too light, too flat, or visually cheap;
- the frame competes with the bird art instead of supporting it.

The template should feel premium and tarot-like, but still grounded in Bird
Squad's modern streetwear city world.

# Minor Arcana Generation Runbook

This runbook is the operator checklist for the next Minor Arcana generation
pass. It uses the border-first pipeline so generated art focuses on bird,
fashion, scene, anatomy, suit identity, and natural pip storytelling while the
repo owns final borders, titles, and dimensions.

Source references:

- `docs/art/art-bible.md`
- `docs/art/border-first-generation-pipeline.md`
- `docs/art/tarot-border-template-pipeline.md`
- `docs/art/prompt-packs/tarot-border-template-prompts.md`
- `assets/templates/minor-arcana/card-overlays/overlay-manifest.json`
- `assets/templates/minor-arcana/raster-border-templates/template-manifest.json`
- `docs/art/prompt-packs/minor-arcana-center-art-prompts.md`

## Target Outputs

Create one dated run folder for the pass:

```powershell
$run = "2026-06-13-border-first-v2"
$centerRoot = ".generated/imagegen/tarot/minor-arcana-center-art-runs/$run"
$finalRoot = ".generated/imagegen/tarot/minor-arcana-border-first-runs/$run"
$qaRoot = "tmp/qa/minor-arcana/$run"

New-Item -ItemType Directory -Force `
  "$centerRoot/plumes", "$centerRoot/basins", "$centerRoot/quills", "$centerRoot/nests", `
  "$finalRoot/plumes", "$finalRoot/basins", "$finalRoot/quills", "$finalRoot/nests", `
  $qaRoot
```

Expected center-art filenames should match card ids:

- `wands_ace.png` through `wands_elder.png`
- `cups_ace.png` through `cups_elder.png`
- `swords_ace.png` through `swords_elder.png`
- `pentacles_ace.png` through `pentacles_elder.png`

Save center art under the suit folder matching the overlay manifest:

```text
.generated/imagegen/tarot/minor-arcana-center-art-runs/{run}/plumes/{cardId}.png
.generated/imagegen/tarot/minor-arcana-center-art-runs/{run}/basins/{cardId}.png
.generated/imagegen/tarot/minor-arcana-center-art-runs/{run}/quills/{cardId}.png
.generated/imagegen/tarot/minor-arcana-center-art-runs/{run}/nests/{cardId}.png
```

Final composited cards should be saved separately:

```text
.generated/imagegen/tarot/minor-arcana-border-first-runs/{run}/{suit}/{cardId}.png
```

Do not overwrite prior generation runs. Keep rejected candidates in a
`rejected` subfolder or leave them in the generator archive with notes.

## Prepare Repo-Owned Assets

Regenerate deterministic fallback overlays and prompt packs from current card
data:

```powershell
npm run generate:minor-overlays
npm run validate:minor-overlays
npm run export:minor-center-prompts
npm run validate:docs
```

Prepare polished raster border templates before the next production art pass.
Generate raw imagegen candidates from
`docs/art/prompt-packs/tarot-border-template-prompts.md`, save them under
`assets/templates/minor-arcana/raster-border-templates/raw/`, then convert each
approved raw candidate into a transparent template:

```powershell
npm run prepare:minor-border-template -- `
  --input assets/templates/minor-arcana/raster-border-templates/raw/plumes-raw.png `
  --output assets/templates/minor-arcana/raster-border-templates/plumes.png `
  --clear-image-window

npm run validate:minor-border-templates -- --require-all
```

The center-art prompt pack is written to:

```text
docs/art/prompt-packs/minor-arcana-center-art-prompts.md
docs/art/prompt-packs/minor-arcana-center-art-prompts.json
docs/art/prompt-packs/subagent-center-art-briefs/
```

Use the center-art prompts, not the full-card prompts, for the next generation
round.

## Subagent Split

Use subagents by responsibility:

| Role | Inputs | Output |
| --- | --- | --- |
| Prompt/pip agent | Art bible, center-art prompt pack, card JSON | Confirms each card prompt has a natural pip plan and no suit bleed |
| Generation agent | Suit brief plus card prompts | Center-art candidates only, no generated borders or titles |
| Anatomy/style QA agent | Center-art candidates | Reject list for hands, arms, extra limbs, duplicate wings, wrong species, poor fashion variety, or suit drift |
| Composite operator | Approved center art and SVG overlays | Final 1024x1536 composited PNGs |
| Final QA agent | Final PNGs and contact sheets | Accepted list and reroll list |

Every subagent should treat `docs/art/art-bible.md` as the authority. No
subagent should invent a new frame, title format, suit vocabulary, bird anatomy
rule, or output path.

## Generation Rules

Generate center art only:

- no card border;
- no bottom title cartouche;
- no medallions or side rails;
- no readable title, rank, suit, logos, slogans, clothing text, or
  pseudo-writing;
- leave clean margins for the locked overlay;
- keep bird, feet, beak, tail, action, and important pips inside the central
  image window.

Hard art requirements:

- bird remains anatomically avian;
- exactly two wings and exactly two legs;
- no arms, hands, fingers, wing-hands, sleeve-arms, humanoid torso, human
  posture, or extra limbs;
- no clothing silhouette that reads as shoulders, elbows, forearms, sleeve-arms,
  palms, hands, or human side limbs; ponchos, jackets, capes, and harnesses must
  sit on the bird torso or folded wings;
- only the named bird species appears on the card;
- props may be held only by beak, talons, feet, or legs;
- pip counts are exact for Ace through Ten, using the single count element named
  in the card prompt and data;
- center the bird, held props, and every countable pip element inside the
  overlay-safe image area, away from the future border and title cartouche;
- border-safe means visible in the final composited card, not merely present in
  the raw center art; reject any candidate where side rails, medallions, or the
  title cartouche would hide part of the count;
- fill the whole raw image with the modern urban setting behind the centered
  subject; do not use blank margins, dark vignettes, spotlight falloff, faded
  edges, empty safety moats, or cropped-looking generated borders;
- every counted pip must remain fully visible after the border overlay is placed
  on top;
- pip elements are part of the scene, not pasted icons;
- action originates from the bird, not from technology, loose props, or the
  background;
- clothing is modern, individualized, bird-safe streetwear without gang-uniform
  reads;
- output must read as high-resolution pixel art with crisp clusters and
  deliberate dithering, not realistic painting, semi-realistic illustration, or
  smooth digital concept art.

Suit emphasis:

| Suit | Keep | Avoid |
| --- | --- | --- |
| Plumes | Biological calls, wingbeats, throat flash, feather buzz, iridescence, wet reflections, varied performance streetwear | Electric beams, antenna-driven action, spell particles, black-plus-bright uniform palettes |
| Basins | Modern rainwear, canal care, shelter, vessels, wet reflections, first-aid pouches | Plume stage language, Quill signal arrays, Nest shine tags, old bathhouse fantasy |
| Quills | Modern signalwear, rooftop pressure, wind-cut marks, route logic, courier/tactician variety | Pasted loose feathers, sci-fi armor, Plume glow, Nest workbench scenes |
| Nests | Hipster workwear, beanies, flannel, chore coats, maker spaces, crates, scaffold resources | Medieval markets, fantasy workshops, Basin care vessels, Quill signal fields |

## Exact Count QA

For every Ace-Ten card, use the card data's `numberSymbolism.element` as the
only countable pip object. The prompt can include other scene details, but those
details must not create extra countable vessels, feathers, lights, shine tags,
charms, reflections, birds, or marks.

## Current Repair Scope

The next repair pass should regenerate only the misaligned center-art sources
listed below, then composite them under the locked border templates. Do not
reuse prior bad full-card outputs as source art.

| Suit | Cards | Known Failure To Reject |
| --- | --- | --- |
| Basins | `cups_ace`, `cups_04`, `cups_06`, `cups_07`, `cups_09`, `cups_10` | Arms/hands, wrong suit reads, realistic/non-pixel rendering, and undercounted or overcounted basin vessels/lights. |
| Plumes | `wands_06`, `wands_08`, `wands_outrider`, `wands_elder` | Extra birds, magical/electrical streaks, extra wings, or cards that read as Basins, Quills, or Nests. |
| Quills | `swords_ace`, `swords_03`, `swords_04`, `swords_05`, `swords_06`, `swords_07`, `swords_08`, `swords_09`, `swords_10` | Wrong suit reads, Basin-like rainwear, missing exact count, too many loose feathers, extra birds, cropped posts/marks, or talon marks substituted for pressure marks. |
| Nests | `pentacles_04`, `pentacles_05`, `pentacles_06`, `pentacles_07`, `pentacles_10` | Missing count representation, overcounted charms/tags, countable clothing trim, or pips cropped by the border. |

Every listed card now has a `repairDirective` in its canonical card JSON. The
prompt exporter includes that directive in both full-card prompts and
center-art-only prompts. Treat the directive as a hard acceptance gate.

Known failure patterns to reject immediately:

| Suit | Common Failure | Required Fix |
| --- | --- | --- |
| Basins | Too many or too few basin vessels/lights; extra reflected bowls; bird given an arm while lifting a vessel | Count only the named basin element exactly; vessel handling must use beak, talons, feet, or legs |
| Plumes | Extra birds added to a single-bird pip; mixed species in a same-species group; magical or electrical streaks | Bird count follows the card description exactly; light/sound reads as plumage, call, wingbeat, motion blur, or reflection |
| Quills | Bonus feather texture becomes extra pips; wrong suit scene; Basin-like raincoat/caretaker styling; missing numbered pressure/thorn/quill marks | Count only the named Quills element; no extra loose feathers, quill trim, or pressure marks; use signalwear, wind shells, utility vests, courier layers, and rooftop infrastructure |
| Nests | Shine tags, charms, and birds all compete as count objects | Count only the named resource marker; no extra charm/tag clutter around the work scene |

## Compositing

The repo provides deterministic SVG overlays plus a local Pillow compositor.
The compositor draws the same locked frame and data-derived title onto approved
center art and writes final PNGs to `$finalRoot`.

```powershell
npm run compose:minor-art -- `
  --source-root $centerRoot `
  --output-root $finalRoot `
  --template-root assets/templates/minor-arcana/raster-border-templates `
  --strict
```

The compositor will:

- fit the center art to the manifest image window;
- use an approved transparent raster border template when available;
- fall back to the procedural locked border when a raster template is missing;
- render deterministic title text above the image;
- preserve the final canvas at exactly 1024x1536;
- avoid stretching the bird or cropping beak, feet, tail, or pip action.

Validate final composites:

```powershell
npm run validate:minor-composites -- `
  $finalRoot `
  --source-root=$centerRoot
```

The SVG overlays are still the inspectable template source for border/title
continuity. If a different imaging tool is used, it should read
`assets/templates/minor-arcana/card-overlays/overlay-manifest.json` and preserve:

- `geometry.imageWindow.x`
- `geometry.imageWindow.y`
- `geometry.imageWindow.width`
- `geometry.imageWindow.height`
- each card's `overlay` path
- each card's `cardId`

Do not count generated border remnants as acceptable. If center art contains a
visible generated frame or title, reroll it before compositing.

## Contact Sheets

Create contact sheets after center-art QA and again after final compositing.

Repo contact-sheet command:

```powershell
npm run validate:minor-center-art -- $centerRoot

npm run qa:minor-contact-sheet -- `
  --source-root $centerRoot `
  --output-root "$qaRoot/center"

npm run qa:minor-contact-sheet -- `
  --source-root $finalRoot `
  --output-root "$qaRoot/final"
```

This creates one sheet per suit and one full Minor Arcana sheet. Keep the review
order: Plumes, Basins, Quills, Nests, then the full 56-card sheet.

## QA Checklist

Run repo validation:

```powershell
npm run validate
```

Then visually review every final card:

| Gate | Pass Criteria |
| --- | --- |
| Count | 56 final PNGs, 14 per suit |
| Dimensions | Every final PNG is exactly 1024x1536 |
| Border | The locked overlay is visible, aligned, and consistent across the suit |
| Title | Bottom title is the data-derived rank-and-suit title |
| Anatomy | No hands, arms, fingers, wing-hands, extra wings, duplicate wings, extra legs, or humanoid posture |
| Clothing Anatomy | Jackets, ponchos, capes, wraps, and harnesses do not create shoulder, elbow, sleeve-arm, hand, or human side-limb silhouettes |
| Species | Only the named bird species appears |
| Suit Identity | Card reads as its suit without borrowing another suit's props or behavior |
| Pip Count | Ace through Ten show the exact number through the card's named count element, with no overcount, undercount, mixed count-object type, or ambiguous lookalike clutter |
| Pip Safe Area | Every countable pip remains fully visible after the border overlay, with no pip cropped by side rails, top medallion, corners, or title cartouche |
| Frame Fill | Background art fills the full raw image behind the centered subject; no blank margins, dark vignettes, faded edges, or empty safety moats |
| Pip Integration | Count elements are carried, worn, reflected, built, guarded, clipped, or bird-produced |
| Bird-Originated Action | Effect comes from bird posture, call, plumage, movement, gaze, carrying, guarding, or nurturing |
| Fashion | Clothing is modern, individual, bird-safe, and not a repeated uniform |
| World | Present-day urban bird-city, not medieval fantasy or future sci-fi |
| Medium | High-resolution pixel art with crisp clusters and deliberate dithering, not realistic painting or smooth digital illustration |
| Text Hygiene | No readable clothing text, logos, slogans, crew names, brand marks, or pseudo-writing |

Optional dimension audit:

```powershell
Add-Type -AssemblyName System.Drawing
Get-ChildItem $finalRoot -Recurse -Filter *.png | ForEach-Object {
  $img = [System.Drawing.Image]::FromFile($_.FullName)
  [PSCustomObject]@{
    File = $_.FullName
    Width = $img.Width
    Height = $img.Height
  }
  $img.Dispose()
} | Where-Object { $_.Width -ne 1024 -or $_.Height -ne 1536 }
```

The audit should return no rows.

## Reroll Criteria

Reroll center art before compositing if any of these appear:

- generated card border, title cartouche, medallions, title text, or suit text;
- realistic painting, semi-realistic illustration, smooth digital painting,
  photographic rendering, soft airbrush realism, or non-pixel-art concept art;
- hands, arms, fingers, wing-hands, sleeve-arms, humanoid torso, or human pose;
- clothing that creates shoulders, elbows, forearms, hands, palms, or arm-like
  side limbs;
- more or fewer than two wings or two legs;
- mixed bird species, hybrid species traits, or unrelated background birds;
- wrong suit language, suit bleed, or card that reads as another suit;
- more pips than the card requires, fewer pips than the card requires,
  ambiguous pips, mixed count-object types, hidden pips, or lookalike clutter
  that makes the count unclear;
- count elements, subject heads, beaks, feet, tails, or suit-defining actions
  that sit too close to the edge and will be cropped or covered by the final
  overlay;
- blank margins, dark vignettes, spotlight falloff, faded edges, empty safety
  moats, or generated border-like edge treatments used to solve centering;
- forced pip count, pasted icons, floating count symbols, or loose objects that
  do not participate in the scene;
- action appears to come from technology, antenna flashes, props, lights, or the
  background instead of the bird;
- Plumes use electrical, magical, or technology-sourced light/sound instead of
  biological calls, wingbeats, plumage, and reflections;
- black-plus-bright Plumes styling collapses into a uniform or gang-coded look;
- Nests drift into old-world fantasy workshops;
- Quills drift into future sci-fi or repeated identical outfits;
- readable clothing text, logos, slogans, crew names, or pseudo-writing;
- center art crops the beak, feet, tail, or suit-defining action under the
  overlay safe area.

Recompose instead of rerolling if the center art is good but the overlay is
misaligned, the final dimensions are wrong, or the image was stretched during
fit.

## Review Notes

For each card, record:

- `accepted`, `reroll`, or `recompose`;
- the reason for any rejection;
- whether the issue is anatomy, species, suit identity, pip count, pip
  integration, fashion variety, world drift, border alignment, or dimensions;
- the candidate filename or generator archive id.

Keep QA notes beside the run:

```text
tmp/qa/minor-arcana/{run}/QA_SUMMARY.md
```

Accepted final cards can later be copied into the production concept-art or
runtime asset paths once the full set passes review.

# Readability-first art pilot

Accepted direction: preserve Bird Squad's dark, rain-wet modern city, avian
anatomy and tarot identity. This is a production pilot, not a new visual theme.

## Reference set and invariants

- Character/wardrobe: `assets/splash/bird-squad-bold-streetwear-splash-v3.png`.
- World/title: `assets/splash/bird-squad-canal-run-splash-v11.png`.
- Rooftop geometry: the previous canonical `rooftop-blocks.webp` (in Git history;
  local comparison copy `.artifacts/rooftop-blocks-pre-readability.webp`).
- Character contact example: `assets/runtime/enemies/full/roof_rat.webp`.
- Card framing/titles remain deterministic; follow the existing border-first
  pipeline. Do not generate lettering or replacement UI chrome into scene art.

Maintain crisp high-resolution pixel clusters, restrained dithering, dark navy
and steel, warm practical lamps, subdued wet cyan reflections. Keep architecture
present-day: antennas, parapets, HVAC, water tanks, utility structures. No fantasy
or sci-fi additions. Birds remain birds; clothing adapts to anatomy. Characters
act, props support. Existing character identity/species are invariants.

## Plume Flash / Ace of Plumes — 2026-09-13

Mechanic-first pilot for `wands_ace`: an open-bill busker call and lifted wing
make the bird the acting subject. The reference was the existing portrait,
Malachite Sunbird species/wardrobe description and canonical Plumes frame.
Four built-in imagegen edits were inspected (no CLI/API fallback): the first
redrew the border and was rejected, the borderless extraction cropped a wing
under the canonical mask, the safe-margin correction was too small/noisy at
thumbnail size, and the final correction enlarges the bird while simplifying
roof reflections. No card effects, cost, targeting or timing changed.

User explicitly approved the existing Python compositor/exporter. Final files:

- Center source: `.generated/imagegen/tarot/readability-center-final-2026-09-13/plumes/wands_ace.png`.
- Canonical master: `.generated/imagegen/tarot/readability-composited-final-2026-09-13/plumes/wands_ace.png`.
- Selected master copy: `.generated/imagegen/tarot/selected/wands_ace_readability_20260913.png`.
- Both are 1024×1536. The master uses `raster-border-templates/plumes.png`,
  the existing title font/cartouche and rounded alpha mask without repainting.
- Runtime: `assets/runtime/cards/portrait/wands_ace.webp` (512×768; 636848 bytes),
  `thumb/wands_ace.webp` (184×276; 95282 bytes) and `icon/wands_ace.webp`
  (128×128; 33132 bytes). Existing `selected/wands_ace.png` is retained; the
  manifest records the versioned selected copy. Other 109 entries/exports are untouched.
- Composite validation: no opaque non-title border mismatches, no opening
  gaps, no art leaks; exact dimensions and transparent outer corners pass.
  Whole card, portrait, thumbnail and icon were viewed, not only generated.
- Browser evidence and any outstanding limitations are recorded in `progress.md`.
  This is one integrated pilot, not completion of every card or character pose.

The exporter now accepts `--card-id` (repeatable) and a versioned `--source`
for exactly one approved card. Invalid ids, missing/outside-selected sources
and ambiguous overrides fail before manifest writes. The compositor validator
accepts `--card-id=wands_ace` for an isolated one-card output directory; without
that flag its complete 56-card gate is unchanged. Regression tests cover both.

### Final built-in imagegen prompt

Use case: precise-object-edit. Edit target: supplied borderless Bird Squad
sunbird illustration. Final small-card readability correction: enlarge ONLY
the same bird by roughly 20 percent, centered around its current body, with all
its wing tips, bill, tail and talons still inside x=150..800,y=320..1170 on this
1024x1536 portrait. Keep the open case and single feather at their current size
and position. Preserve the exact bird identity, wing-flick and open-bill action,
teal streetwear, emerald plumage and crisp pixel-cluster style. Quiet the rooftop
background by reducing the many tiny orange specular flecks into broad subdued
navy/warm reflection shapes; do not flatten the detailed bird. The bird's luminous
natural emerald throat and readable wing silhouette must clearly dominate at a
184x276 thumbnail. Keep the existing distant modern apartment silhouettes and
practical dusk lights. No magical glow, particles, sound waves, title, border or
extra props. Opaque borderless 2:3 illustration. This is not a new composition or
style; preserve everything except this modest bird scale increase and background
simplification.

Final generation: `exec-2899a847-b77a-408b-af64-14811d5b24b8.png`; supporting
safe-margin edit: `exec-3638fc6a-909c-4341-b731-ab05318788bb.png`. Earlier
border/extraction candidates: `exec-a546ffb2-6627-4701-a00e-fb42d1e89a58.png`
and `exec-6a294ba4-3edb-4d6c-8a3e-f4e7296c9cdc.png`. Only the final source is
referenced by the production manifest; intermediate composites are local review
artifacts, not alternate shipped cards.

## Rooftop v2

- Built-in imagegen edit, one target image and one generation; no CLI/API fallback.
- Source: `assets/concept-art/backdrops/sources/rooftop-blocks-readability-source-v2.png`.
- Runtime: `assets/runtime/backdrops/rooftop-blocks-readability-v2.webp`.
- Source/runtime dimensions: 1672×941. WebP encoding only, quality 90 / effort 6;
  no geometric resize or pixel repaint. Runtime 235342 bytes, below 420 KiB limit.
- Explicit runtime import and closed world source/runtime allowlists updated.
- Old export moved out of the runtime inventory into the local comparison copy;
  recoverable there and through Git. No other world asset changed.
- Scene remains 1280×720. Do not move actor or input anchors to compensate for art.

### Final prompt

Use case: precise-object-edit. Asset type: production Bird Squad 16:9 battle
background, no UI. Image 1 is the edit target. Preserve this dark navy rain-wet
modern rooftop, exact camera perspective, horizon, surrounding skyline,
parapets, left utility hut, billboard, right water tank and perimeter HVAC.
Change only visual noise on the broad central roof surface: simplify the dense
tile seams, cracks, bright speckles and many tiny puddles into larger quiet dark
slate material areas with subtle low-contrast seams and a few broad subdued blue
reflections. Preserve believable aged roofing, not a featureless gradient.
In normalized image coordinates, the main actor zone x .10–.90 y .24–.57 should
have minimal high contrast edges so bird and enemy silhouettes read clearly;
lower central zone x .18–.85 y .60–.90 should stay dark and quiet behind game cards.
Keep detailed urban texture at the perimeter and distant skyline. Existing
restrained warm utility lamps and cool rain highlights, same crisp
high-resolution pixel clusters and deliberate dithering. No characters, no
labels, no text, no UI, no new props, no magic or futuristic architecture.
Deliver a polished cohesive battlefield plate in 16:9 landscape.

## Grounding correction

Roof Rat's 768×512 cutout has a tail below its front paws. Alpha-bottom fitting
therefore does not locate the contact plane. Reviewed paw contact row: 416/512.
The foreground renderer now puts its contact shadow and selection ring on that
row plus a two-stage-pixel allowance at unit scale. Art fitting, hit targets,
intent and vitals positions remain unchanged. Other species retain their prior
anchors pending inspection; this is not a claim that one heuristic fits all art.

## Acceptance and next gates

Inspect rendered combat at 2560×1600, 1440×900 and 1000×560: loaded art, selected
target, full hand, forecast, multi-enemy fixture and unchanged boss variant.
Check no failed assets/errors and unchanged gameplay state. Screenshots alone
do not prove frame-time, physical-device accessibility or human enjoyment.

Before further generation: choose one priority character pose set, one enemy
role example and a small named card set. For each, record source/identity
reference, dimensions, alpha requirements, intended runtime size and exact
consumer. Generate one asset at a time, inspect anatomy and silhouette, align
anchors, wire to real states, test reduced motion and inspect in-game. Reject
misregistered or off-style output before extending the family. Do not mark the
broader pose/card/state-variant work complete based on this single plate.

## Roof Rat anticipation pilot — rejected 2026-09-13

The existing `assets/runtime/enemies/full/roof_rat.webp` was the identity,
wardrobe, lighting and registration reference. Two built-in imagegen edits
were inspected; neither was copied into the runtime or approved source set.
The original enemy art remains unchanged.

- First candidate: 1536×1024 RGB, no alpha channel; checkerboard was painted
  into the background. Rejected despite a plausible loaded crouch.
- Transparency correction: 1536×1024 RGBA, but a broad colored halo remained
  around the silhouette. Rejected: having an alpha channel alone does not
  establish a clean production cutout.
- No manual color-keying, anatomy repaint, or runtime fallback wait was added.
  Pose-state integration remains open until a clean, registered asset passes.

Generation brief: edit the same brown Roof Rat into a pre-pounce crouch,
preserving its navy jacket, tan satchel, cream paw wraps, four legs, one tail,
three-quarter orientation and crisp pixel clusters. Maintain a 3:2 canvas,
whole silhouette, similar margins and paw contact at about 81% height. Require
genuine transparent PNG alpha, no ground shadow, glow, particles or new props.
The correction requested removal of the checkerboard only, preserving the rat
pixel-for-pixel with zero-alpha exterior and clean whisker/tail edges.

Before approval, inspect alpha values as well as metadata, view against light
and dark surfaces, compare identity and contact anchors, and inspect at actual
combat size. A failed pilot is not a shipped pose or a closed roadmap area.

### Third anticipation candidate — rejected in the continuation

The built-in imagegen edit used the same runtime Roof Rat reference. Output
`exec-46b60349-06a2-453e-855e-9a5edc40941b.png` in the session generated-images
folder is 1536x1024, PNG color type 2 (RGB), with no alpha. Visual inspection
confirmed a painted checkerboard. It is not an approved source or runtime
asset; the original remains in use. No CLI fallback or manual color-keying
was attempted. Clean transparency, pose registration and integration remain
open, rather than being hidden behind a completed-generation checkbox.

Brief: preserve Roof Rat identity, brown fur, navy jacket, tan satchel, cream
paw wraps, four legs and one tail; slightly deepen the pre-pounce crouch.
Keep the same three-quarter camera, color palette and crisp pixel clusters,
whole silhouette and paw contact at about 81% height on a 3:2 canvas.
Require genuine transparent alpha, without a checkerboard, glow, ground shadow,
new props or extra effects. This candidate failed the transparency requirement.

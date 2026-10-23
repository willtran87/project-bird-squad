# Resident anatomy correction — September 29, 2026

Mode: built-in image generation, transparent image edits. The existing deterministic
Python image exporter produces optimized WebPs; no generated text or borders are used.
Old cutouts remain recoverable in Git history and locally under
`.artifacts/retired-residents-2026-09-29/`.

## Reviewed replacements

| Resident | Source master | Runtime export |
| --- | --- | --- |
| Marn | assets/concept-art/route-events/marn-valeclip-v3.png | assets/runtime/route-events/marn-valeclip-v3.webp |
| Ivo | assets/concept-art/route-events/ivo-tallymast-v3.png | assets/runtime/route-events/ivo-tallymast-v3.webp |
| Oren | assets/concept-art/route-events/oren-shearbright-v3.png | assets/runtime/route-events/oren-shearbright-v3.webp |
| Caldra | assets/concept-art/route-events/caldra-pinion-v3.png | assets/runtime/route-events/caldra-pinion-v3.webp |
| Veyra | assets/concept-art/market-kit/layers/starling-shopkeeper-v2.png | assets/runtime/market-kit/starling-shopkeeper-v2.webp |

Sella's existing cutout passed the resident anatomy inspection and was retained.
All replacements were visually inspected: natural feathered body, folded wings,
two legs, talons, no human arms or hands. Props are passive harness attachments.
This records LLM visual assessment, not human review or all-card certification.

## Marn edit brief (summary)

Correct the humanoid hooded-crow resident into a natural gray-bodied crow with
folded black wings, short bird legs and two taloned feet. Preserve the hooded
archive cape, brass/teal palette and lockbox identity. Carry the box on a harness,
not in hands. No human arms, fingers, torso or sleeve-arms. Transparent cutout,
high-resolution pixel art, full silhouette with safe margins, no background,
text, watermark or frame.

## Exact prompt set for matching residents

### Ivo

Use case: precise-object-edit. Asset type: full-body transparent game resident sprite for Bird Squad. Input image 1 is the edit target, preserving this character's identity and palette; image 2 is the approved anatomy and rendering reference, not a second character to copy.
Primary request: redraw image 1 to correct its humanoid anatomy, matching the pixel-art rendering of image 2. Ivo Tallymast, a kestrel wire cartographer. Preserve tawny black-speckled plumage, falcon facial markings, slate-blue hooded signal-runner cape, turquoise cords, small brass lens medallion. The wire reel and abstract signal tags hang passively from a chest harness. Face toward the right, natural kestrel perched stance, bird body horizontal-to-diagonal and short legs.
Anatomy MUST be entirely avian: naturally rounded feathered body, one beak, one head, one neck, exactly two natural wings folded against the bird's sides, exactly two bird legs with taloned feet, tail. No human torso, human waist, upright human posture, human arms, human hands, fingers, palms, elbows, sleeves shaped like arms, grasping wings, extra limbs or feathers posed as fingers. Clothing is a short cape/poncho/harness fitted over a BIRD, not a person in a bird mask. Props only hang from straps or sit in pouches; no active hand-like holding.
Style: high-resolution pixel art, visible crisp clusters and controlled dithering, dark canal-city streetwear, warm upper-left key light and restrained teal rim light. Match image 2's pixel density and finish. Entire silhouette including feet and tail visible with 5% clear margins. No scenery, no floor, no cast shadow, no background pixels. Genuine transparent background. No text, logos, watermark, frames, fantasy spell effects, or extra birds. One character only.

### Oren

Use case: precise-object-edit. Asset type: full-body transparent game resident sprite for Bird Squad. Input image 1 is the edit target, preserving this character's identity and palette; image 2 is the approved anatomy and rendering reference, not a second character to copy.
Primary request: redraw image 1 to correct its humanoid anatomy, matching the pixel-art rendering of image 2. Oren Shearbright, a pileated woodpecker deck tailor. Preserve red crest, black-and-white plumage, long black beak, burgundy bird-tailored work smock/cape with brass details. Measuring ribbon with plain tick marks but NO numerals drapes from harness. Spools and folded navy cloth are tucked passively into side satchel. Face right, full natural woodpecker body, short bird legs.
Anatomy MUST be entirely avian: naturally rounded feathered body, one beak, one head, one neck, exactly two natural wings folded against the bird's sides, exactly two bird legs with taloned feet, tail. No human torso, human waist, upright human posture, human arms, human hands, fingers, palms, elbows, sleeves shaped like arms, grasping wings, extra limbs or feathers posed as fingers. Clothing is a short cape/poncho/harness fitted over a BIRD, not a person in a bird mask. Props only hang from straps or sit in pouches; no active hand-like holding.
Style: high-resolution pixel art, visible crisp clusters and controlled dithering, dark canal-city streetwear, warm upper-left key light and restrained teal rim light. Match image 2's pixel density and finish. Entire silhouette including feet and tail visible with 5% clear margins. No scenery, no floor, no cast shadow, no background pixels. Genuine transparent background. No text, logos, watermark, frames, fantasy spell effects, or extra birds. One character only.

### Caldra

Use case: precise-object-edit. Asset type: full-body transparent game resident sprite for Bird Squad. Input image 1 is the edit target, preserving this character's identity and palette; image 2 is the approved anatomy and rendering reference, not a second character to copy.
Primary request: redraw image 1 to correct its humanoid anatomy, matching the pixel-art rendering of image 2. Caldra Pinion, a peafowl wager broker. Preserve teal-blue peafowl neck/head with crest, long folded eye-patterned tail, magenta glossy evening-streetwear capelet, subtle jewel pins and gold trim. Compact contract case attached to waist-free chest harness. NO held tray, NO held pen; these props are omitted. Face left, natural peafowl silhouette with horizontal rounded body, two bird legs under it, tail trails behind.
Anatomy MUST be entirely avian: naturally rounded feathered body, one beak, one head, one neck, exactly two natural wings folded against the bird's sides, exactly two bird legs with taloned feet, tail. No human torso, human waist, upright human posture, human arms, human hands, fingers, palms, elbows, sleeves shaped like arms, grasping wings, extra limbs or feathers posed as fingers. Clothing is a short cape/poncho/harness fitted over a BIRD, not a person in a bird mask. Props only hang from straps or sit in pouches; no active hand-like holding.
Style: high-resolution pixel art, visible crisp clusters and controlled dithering, dark canal-city streetwear, warm upper-left key light and restrained teal rim light. Match image 2's pixel density and finish. Entire silhouette including feet and tail visible with 5% clear margins. No scenery, no floor, no cast shadow, no background pixels. Genuine transparent background. No text, logos, watermark, frames, fantasy spell effects, or extra birds. One character only.

### Veyra

Use case: precise-object-edit. Asset: transparent full-body Bird Squad game resident sprite. Image 1 is edit target Veyra Tallybright, starling canal-market curator. Image 2 is approved bird anatomy and pixel finish reference.
Redraw image 1 to remove its humanoid anatomy while preserving Veyra's iridescent violet/teal starling plumage, alert gaze, slender starling beak, charcoal and jewel-teal short hooded market cape, quilted satchel and small brass tags. Natural rounded starling body leaning forward, horizontal-to-diagonal avian posture, two wings folded along sides, two short bird legs and talons. No human hands, fingers, arms, forearms, human torso/waist, pants, sleeve-arms or gripping wing tips. Satchel and tags hang passively from a fitted bird chest harness; do not hold any object. Cloth is a short bird-tailored cape/poncho; feathers stay visible.
Match image 2: high-resolution pixel art with crisp clusters, controlled dithering, warm upper-left key light, subtle teal rim, natural avian anatomy, grounded modern bird-city streetwear, not fantasy or sci-fi. Full silhouette facing right, feet and tail fully visible inside 5% clear margins, one bird only. Genuine transparent background, no ground plane, no scenery, no cast shadow, no logos, no readable text, no watermark, no frame.

## Export and integration

Run `python tools/build-runtime-ui-art.py --resident <versioned-name>`.
The exporter requires actual alpha transparency, preserves aspect ratio, fits at
most 768 × 1024, and writes WebP quality 90. Runtime imports and exact world
allowlists select only reviewed generations. Scene renderers preserve proportions
and reserve margins for feet, tails and choice controls.

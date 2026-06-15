# Bird Squad Art Bible

Version: 2.0

This is the source of truth for Bird Squad's visual identity, world language,
tarot symbolism, prompt writing, asset review, Minor Arcana crews, Molt/reversal
art rules, and card-scale variety guidance.

Related sources:

- `docs/game/game-design.md` defines the playable deckbuilder structure.
- `docs/game/core-gameplay-spec.md` defines canonical foundation and future card
  behavior.
- `docs/art/border-first-generation-pipeline.md` defines the preferred Minor
  Arcana regeneration workflow using locked overlays, center-art generation,
  deterministic titles, and QA gates.
- `data/cards/arcana/major-arcana-bird-map.json` and the Minor Arcana JSON
  files define the card-by-card production data.

## Core Rule

Every character remains anatomically bird.

Do not make the birds humanoid. Do not give them human torsos, arms, hands,
fingers, human faces, human legs, or human posture. The body plan should stay avian:
beak, skull, neck, feathered body, wings, tail feathers, bird legs, and taloned
or webbed feet depending on species.

Wings are never hands or arms. Do not pose wing tips as fingers, palms, elbows,
forearms, sleeves, or human-like graspers. Birds have exactly two legs and two
wings; never accept a three-legged bird, extra wing set, arm-like wing, or any
extra limb. Any actively held prop must be held by the beak, talons, feet, or
legs. Harnesses, satchels, straps, perches, and environmental supports may carry
or stage passive objects, but they must never read as hands, fingers, or gripping
arms.

Each card has one named bird species. Depict only that species on the card. Do
not add mixed flocks, background birds of another species, hybrid traits, or a
second species because the scene needs more energy. If tarot meaning calls for
more than one bird, every additional bird must be the same listed species and
remain secondary to the main subject.

Card action should originate from the bird, not from external props,
background elements, or surrounding scenery. The bird's natural behavior,
species anatomy, movement, posture, call, plumage display, gaze, balance,
flight, dive, preen, carry, guard, gather, or nurture action should be the
first read. Props, buildings, antennas, tools, basins, nests, shine objects,
quills, and plumes may amplify or symbolize the action, but they should never
look like the source of the card's effect.

Modern street clothing must adapt to the bird, not reshape the bird into a
person. Clothing can appear as fitted feather-safe garments, tiny jackets,
baggy jackets, hoodies, hood shapes, workwear layers, beanies, flannel wraps,
rain shells, talon bands, sneaker-like talon covers, harness pouches, chains,
pins, patches, scarves, caps, or accessories.

No readable text belongs on clothing. Jackets, wraps, caps, pouches, harnesses,
pins, and patches may use abstract shapes, suit motifs, color blocking, stitch
patterns, tiny icons, or worn textures, but they should not contain letters,
numbers, slogans, crew names, brand names, or pseudo-writing. The only intended
readable text is the formal card title in the bottom cartouche.

## Visual Pillars

- High-resolution pixel art with crisp clusters, deliberate dithering, and
  readable silhouettes.
- Tarot card composition with full-body subject focus, a consistent ornate
  border system, symbolic framing, and a clear title cartouche.
- Fixed card canvas: every finished tarot card image should be a vertical 2:3
  portrait at 1024 px wide by 1536 px tall. Do not vary canvas width, canvas
  height, aspect ratio, border crop, or title-cartouche position between cards.
- Bird-originated action: the behavior, effect, or emotional force of a card
  should visibly come from the bird's pose, movement, voice, plumage, gaze, or
  species behavior first. Props and environments are supporting context.
- Modern bird-city streetwear tone: fitted or baggy gear, utility harnesses,
  hoodies, beanies, rain shells, flannel and workwear layers, neon accents,
  night city texture, worn signage, transit marks, abstract patches, stickers,
  tags, and tarot symbols translated into physical urban props.
- The mood should be stylish, strange, sincere, and iconic rather than cute
  parody.
- Each card should be strong enough to guide a playable character, faction, or
  combat archetype later.

## Streetwear Tone

Streetwear should read as city fashion, outdoor utility, performance gear,
market workwear, rainwear, courier gear, skate/stage influence, and handmade
bird-safe accessories. It should not read as a gang uniform.

Primary style reference: `assets/splash/bird-squad-bold-streetwear-splash-v3.png`.
Use it as the grounding target for modern urban worldbuilding: dense rooftops,
canal infrastructure, utility crates, antennas, HVAC units, city lights,
contemporary harnesses, hoodies, rain shells, beanies, pouches, straps, and
workwear layers. The world should feel like a present-day or near-present
bird-city, not old-world fantasy and not futuristic sci-fi.

Every card/bird mapping needs both a **style direction** and a **description**.
The style direction defines the bird's culture, fit, material language, and
accessory lane. The description defines the card scene, action, and symbolic
read. Style should make each cast member feel individual without using readable
logos, slogans, rank marks, territory signs, matching intimidation uniforms, or
gang-coded affiliation marks.

Use suit identity through material, silhouette, color, accessory choice, and
environment:

| Suit | Streetwear Signal |
| --- | --- |
| Plumes | Individualized performance streetwear: cropped bombers, varsity shells, hoodies, puffers, mesh overshirts, dance wraps, windbreakers, crossbody pouches, talon bands, abstract patches, iridescent throat/plumage accents, poster/skate/busker details, wet rooftops, waterfront reflections, and varied personal color stories. Plumes should not collapse into black outfits with identical bright orange/magenta accents. |
| Basins | Modern rain shells, soft hooded wraps, canal-worker satchels, first-aid pouches, thermos charms, reflective wet-weather trim, contemporary harbor/canal utility gear. |
| Quills | Varied modern signalwear: cropped courier jackets, varsity windbreakers, wind-cut shells, padded roost vests, asymmetric salvage vests, waterproof flight capes, thrifted anoraks, mesh utility wraps, rumpled knit snoods, patched coach jackets, racing shells, tailored tactician coats, and heavy command mantles; modern infrastructure, not sci-fi armor or Basin-like caretaker rainwear. |
| Nests | Hipster streetwear-workwear blend: beanies, flannel wraps, hoodies, denim/canvas chore coats, utility vests, work aprons, salvage satchels, tool slings, scaffold clips, bike-shop/record-stall/coffee-roastery/maker-market layers. |

Avoid gang-coded styling: matching intimidation uniforms, territory markings,
readable crew names, slogan patches, hand signs, bandana-mask coding, weapon
display, aggressive group posturing, or graffiti used as ownership tags. Graffiti,
stickers, and signage can appear in the environment as city texture, but not as
threat labels or readable affiliation marks on clothing.

Avoid art-direction drift: no medieval or old-world fantasy market streets, no
storybook villages, castles, temples, wizard robes, cloaks-as-costume, tavern
lighting, parchment-shop staging, fantasy treasure rooms, or Renaissance fair
craft tables. Also avoid futurist sci-fi cityscapes, hologram interfaces,
spaceship panels, cybernetic armor, robotic accessories, and floating UI. Magic
must not appear as sparkles, glowing motes, aura clouds, spell circles,
particle swirls, floating runes, or generic energy bursts. Plumes may use
grounded color, call-wave graphics, reflections, posture, feather display,
motion, and practical city lighting, but not magical particle effects,
electric arcs, antenna flashes, holograms, LED-tech beams, or technology as the
source of resonance.

Avoid suit bleed. Plumes should not borrow Basin vessels, Quill antenna fields,
or Nest shine tags. Basins should not borrow stage plumes, signal-quills, or
scaffold-resource props. Quills should not borrow Basin care vessels, Plume
performance flashes, or Nest shine tags. Nests should not borrow Plume magic
spectacle, Basin rain-care vessels, or Quill signal fields.

### Plumes Reference Takeaways

Plumes should read as grounded city birds wearing individualized streetwear
before they read as performers or fantasy figures. Use a wider range of fit
families: cropped utility bombers, soft hood silhouettes, varsity shells, mesh
overshirts, dance wraps, windbreakers, puffers, crossbody pouches, small utility
pockets, talon wraps, and small abstract pins or patches with no letters, logos,
crests, slogans, or brand marks. Avoid making the suit look like a black uniform
with matching orange/magenta gang colors; each Plumes bird should have a personal
palette, material mix, and fashion subculture.

The Plumes mood is wet neon city at dusk or night: rooftop tar, waterfront rails,
billboard catwalks, dense apartment windows, reflected color, poster walls,
stage tape, chalk circles, skate surfaces, and ordinary city lighting. The
special action must come from the bird's own throat color, chest color, plume
display, wingbeat rhythm, call posture, feather vibration, iridescence, or body
motion, supported by grounded performance gear. Sound should feel biological:
calls, wingbeats, chorus timing, feather buzz, and crowd attention. Light should
feel biological or reflective: plumage color, throat flash, sheen, wet pavement,
window reflection, and sun/neon bounce. Do not solve the card with external
magical props, antenna flashes, electric beams, floating particles, aura clouds,
or spell effects.

Keep Plumes distinct from Quills by avoiding over-militarized techwear, tactical
armor, radio-operator silhouettes, and antenna-driven action. Plumes can have
utility straps and pouches, but the final read should be performance, movement,
sound, color, and street style.

## Anatomy Rules

- Birds must retain natural species-specific proportions.
- Wings are wings, not arms.
- Birds have exactly two legs and two wings. Reject three-legged birds, extra
  wing sets, duplicate wings, arm-like wings, and extra limbs.
- Held props use beaks, talons, feet, or legs only. No hands, fingers, palms, or
  wing-tip grasping.
- Clothing must never create a human arm silhouette. Sleeves, capes, ponchos,
  jackets, harnesses, and straps must follow the bird torso or folded wings;
  reject shoulder, elbow, forearm, sleeve-arm, palm, or side-limb shapes even if
  they are partly hidden by streetwear.
- Feet are talons or webbed bird feet, not shoes on human feet.
- Accessories can wrap, hang, clip, or sit on the bird's natural form.
- Expressions come from eye shape, head angle, feather posture, beak angle, pose,
  and lighting.
- Avoid human hand gestures, bipedal superhero poses, human shoulders, human
  hips, and upright human fashion-model stance.

## Center-Art Safe Area

Minor Arcana center art is generated underneath a deterministic overlay. The
overlay will cover the card edges, top medallion area, side rails, and bottom
title cartouche, so the raw center art must be composed inward.

For center-art-only prompts and review:

- Keep the entire primary bird silhouette, head, beak, tail, feet, held props,
  and suit-defining action comfortably inside the central safe area.
- Keep every countable pip element at least one full pip-width away from the
  future border and title cartouche.
- If the pip plan uses vessels, tags, quills, lights, marks, reflections, birds,
  rods, or scuffs, every counted element must be fully visible before
  compositing and must remain fully visible after compositing.
- Count elements must sit inside the final overlay opening, not under side
  rails, corner medallions, the top medallion, or the bottom title cartouche.
  Treat any partially covered pip as a failed count, even if it exists in the
  raw generated art.
- Pull clustered count elements toward the middle of the scene instead of
  spreading them across the full canvas.
- Keep the urban environment full-frame behind the subject. Do not create blank
  margins, dark vignettes, spotlight falloff, faded edges, empty safety moats,
  or cropped-looking borders in the generated center art. Center the bird and
  pips inward, but let pavement, water, rooftops, rails, windows, walls,
  scaffolds, and city texture continue to the canvas edges.
- Reject otherwise-good center art if the final overlay would crop a count
  element, crop the bird's head, or hide the card action.

## Pixel-Art Gate

Bird Squad card art should read as high-resolution pixel art. Reject realistic
painting, semi-realistic illustration, photographic rendering, smooth digital
painting, soft airbrush realism, and non-pixel-art concept art even when the
scene, species, and count are correct.

Accepted center art should show crisp pixel clusters, deliberate dithering,
controlled edges, readable silhouettes, and game-art finish consistent with the
existing deck. If a generated image reads like a realistic painting with a
pixel-art filter, reroll it before compositing.

## Tarot Card Rules

- Each card should preserve the tarot archetype while reinterpreting it through
  bird behavior, habitat, movement, and symbolism.
- Ace-Ten cards must preserve the pip number with exact suit-coded physical
  elements. Each card's data names one primary count element, and the image must
  show exactly that element count: no more, no fewer, and no mixed alternate
  count-object types. Do not satisfy a pip count by adding unrelated bird
  species, unreadable numerals, border motifs, extra reflections, extra lights,
  clothing trim, or background clutter that can be counted.
- Pip count review is literal. Before accepting an Ace-Ten candidate, count the
  visible pip elements one by one. Reject overcounts, undercounts, ambiguous
  counts, split counts across multiple object families, hidden pips, and extra
  lookalike objects that make the number unclear.
- Recount after border compositing. If the border hides one or more pips, the
  center art should be regenerated with the subject and pips pulled inward
  rather than accepted as-is.
- Pip counts should feel motivated by the scene. Count elements may be carried,
  worn, built, guarded, reflected, clipped to working equipment, arranged by the
  bird, or produced by bird behavior. Avoid rows of pasted icons, floating
  tokens, isolated prop clusters, or count objects that look glued onto the art
  after the scene was composed.
- The card's action should be legible as something the bird is doing or causing.
  Avoid compositions where the primary effect appears to come from a tool,
  antenna, loose feather, background light, border motif, or environmental prop
  instead of the bird.
- Dark cards should be strange and transformative, not gore-focused.
- The Hanged Man should use natural inverted bird behavior or peaceful levitation.
  No rope, no noose, no hanging device, no harm imagery.
- Legend and Aviary Legend card titles use Bird Squad names in production
  prompts. Minor Arcana card titles use formal rank-and-suit display titles in
  generated art: `Ace of Plumes`, `Two of Basins`, `Fledgling of Quills`,
  `Elder of Nests`, and so on. Bird Squad game/design names such as `Plume
  Flash` or `Nest Seed` may guide prompts, files, and mechanics, but should not
  be the readable title inside Minor Arcana card art.
- Text should be minimal and readable. Prefer title only.

## Border System

All cards use the same Tarot Aviary frame structure: a dark outer keyline, a
gilded inner filigree rail, four corner medallions, slim vertical side rails, a
top numeral or crest medallion, and a bottom title cartouche.

All generated and accepted card rasters should use the same geometry:

| Property | Required Value |
| --- | --- |
| Canvas | 1024 px wide x 1536 px tall |
| Aspect Ratio | 2:3 vertical portrait |
| Frame Placement | Full card frame visible inside the canvas with no clipped border |
| Title Cartouche | Same height and baseline position across the series |
| Post-processing | If generation returns a near-miss size, normalize to 1024 x 1536 before accepting the asset |

Minor Arcana cards use a locked border template. Treat the frame like a printed
deck plate that is reused for every card:

| Template Zone | Locked Requirement |
| --- | --- |
| Outer Margin | Same visible margin and dark keyline distance from the canvas edge on every card |
| Inner Rail | Same gilded filigree rail width, corner radius, and distance from the outer keyline |
| Corner Medallions | Same size, shape, and distance from edges; only tiny suit motif details may change inside them |
| Side Rails | Same vertical rail width and placement; suit motifs stay inside rail insets |
| Top Medallion | Same size, centerline, and vertical position; only the suit crest or numeral insert changes |
| Image Window | Same central image area; bird, props, and scenery must not cover or reshape the frame |
| Bottom Cartouche | Same width, height, baseline, and position; title text is the only readable text |

The border should feel like a single deck system. Keep frame thickness, symmetry,
corner placement, side-rail placement, and title-cartouche placement consistent
from card to card. Card-specific symbolism belongs inside the medallions,
side-rail insets, top crest, or small filigree details; it should not change the
frame silhouette, crop, title area, or overall border width.

Card-specific objects, birds, props, lights, weather, motion trails, wings,
plumes, quills, basins, nests, shine tags, antennas, and scenery should remain
inside the central image window or established motif insets. They should not
break through, cover, replace, distort, crop, or redraw the border.

Minor Arcana borders use game-facing suit inserts:

| Suit | Border Motifs |
| --- | --- |
| Plumes | plume flash, crest, call-wave, feather rhythm, biological resonance marks |
| Basins | basin, rain, canal ripple, droplet, care-station marks |
| Quills | quill, antenna, wind-cut, signal, pressure-mark details |
| Nests | nest, scaffold, gear, shine tag, vine marks |

Reversal or Molt variants distress the same frame rather than inventing a new
one. The border should be prominent enough to identify the deck, but never so
heavy that it crowds the bird, covers the background story, or competes with the
title.

Rarity may change material detail inside the established frame, but never the
frame silhouette, border width, title area, crop, or medallion placement:

| Rarity | Frame Treatment |
| --- | --- |
| Common | Clean shared frame, simple suit-color insets, restrained corner marks. |
| Uncommon | Slightly brighter suit insets, one extra texture pass, stronger medallion accent. |
| Rare | Richer metal or enamel accents, clearer suit crest, more detailed side-rail motifs. |
| Legendary | Full Legend treatment: ornate crest, richer gilding, stronger top medallion, dramatic but still readable frame detail. |

## Shared Image Prompt Template

```text
Use case: stylized-concept
Asset type: high-resolution Bird Squad card illustration
Primary request: A Bird Squad card for [CARD], featuring an anatomically correct [BIRD] in modern streetwear details.
Scene/backdrop: consistent Tarot Aviary card frame with dark outer keyline, gilded inner filigree rail, four corner medallions, slim side rails, top numeral or crest medallion, and bottom title cartouche. Add bird-city streetwear details and symbolic objects tied to the card meaning inside the image area and frame insets.
Subject: a fully anatomically avian [BIRD]. Natural beak, head, neck, feathered body, exactly two wings, tail feathers, exactly two bird legs, and taloned or webbed feet. No human torso, arms, hands, fingers, human face, human legs, or humanoid posture. Wings are wings, never hands, arms, sleeves, elbows, forearms, or graspers.
Species lock: depict only [BIRD]. Do not add mixed flocks, background birds from other species, hybrid traits, or a second species. If the scene includes additional birds for tarot meaning, they must be the same species and visually secondary.
Prop handling: any actively held prop must be held only by beak, talons, feet, or legs. Harnesses, straps, and satchels may carry passive attachments, but they must not look like hands, fingers, palms, or gripping arms. Birds have exactly two legs and two wings; no extra legs, duplicate wings, arm-like wings, or extra limbs.
Tarot count: for Ace-Ten cards, show the exact pip number with suit-coded physical elements, not with unrelated extra birds or unreadable numerals.
Natural pip integration: pip elements must be part of the action or environment: carried, worn, guarded, clipped to working objects, reflected in water/glass, built into shop infrastructure, or produced by bird behavior. Do not paste count icons into empty space or line them up as decorative props with no role in the scene.
Suit isolation: use only the card's suit language, motifs, setting, and border inserts. Do not mix Plumes, Basins, Quills, and Nests props on one card.
Bird-originated action: [THE CARD EFFECT] should visibly come from the bird's species behavior, movement, posture, call, plumage display, gaze, or interaction. Props and surroundings may frame or echo the action, but they are not the source of it.
Streetwear adaptation: [GARMENTS AND ACCESSORIES] fitted to bird anatomy. Suit-coded by materials, color, silhouette, and small abstract motifs; no readable text on clothing, patches, caps, pouches, or harnesses. Give each bird a distinct outfit silhouette within the suit theme rather than repeating the same uniform shape.
Style/medium: high-resolution pixel art, crisp pixel clusters, detailed dithering, polished game-art quality.
Composition/framing: fixed 1024 px wide x 1536 px tall canvas, 2:3 vertical portrait tarot card, centered full-body bird, clear silhouette, consistent border width and symmetry, readable card title at bottom inside the shared title cartouche. The whole card frame must fit inside the canvas with no clipped edge.
Locked border template: reuse the exact accepted Minor Arcana deck frame: same outer margin, dark keyline, gilded inner rail, four corner medallions, side rails, centered top medallion, central image window, and bottom title cartouche across the full Minor Arcana. Do not alter frame thickness, cartouche height, cartouche baseline, medallion placement, side-rail placement, crop, border palette, or border silhouette. Reject borders that look lighter, simpler, cream-card, newly drawn, or from a different deck.
Lighting/mood: [MOOD AND LIGHTING]
Color palette: [PALETTE]
Text (verbatim): "[CARD TITLE]" only in the bottom title cartouche. For Minor Arcana, this must be the formal rank-and-suit display title, not the Bird Squad game/design name.
Constraints: anatomically bird, not humanoid, one named species per card, exact accepted Tarot Aviary border structure, no watermark, no extra text, no readable text on clothing.
Avoid: human anatomy, hands, fingers, wing-hands, wing-arms, sleeve-arms, human face, human limbs, three-legged birds, extra wings, duplicate wings, extra limbs, humanoid bird bodies, mixed bird species, suit motif bleed, repeated outfit uniforms, pasted-on pip icons, blurry pixel art, mismatched card borders, cream/light simplified borders, generic fantasy costume, generic spellcasting, floating magic icons with no physical source, gang uniforms, gang signs, readable slogans, readable logos, readable crew names, brand names, pseudo-writing on clothing.
```

## Major Arcana Bird Map

Major Arcana production prompts use Bird Squad card names first. Traditional
tarot names are lineage notes only, included here so archetypal meaning remains
traceable without becoming the visible card identity.

| Card | Lineage | Bird | Rarity | Style Direction | Description |
| --- | --- | --- | --- | --- | --- |
| First Flight | The Fool | House Sparrow | legendary | Oversized wing-safe hoodie, tiny sling pack, curb-skater charm, scuffed talon wraps. | A small, scrappy traveler with bright eyes and restless energy at the edge of a rooftop leap. |
| Shiny Toolkit | The Magician | Black-billed Magpie | legendary | Tool-core utility harness, cropped patchwork jacket, thin chain, shiny found-object clips. | A sharp-eyed collector arranging practical tools and symbolic objects like a street magician's workbench. |
| Moonlit Lookout | The High Priestess | Barn Owl | legendary | Oversized hood, translucent mesh scarf, reflective moon trim, quiet crossbody sling. | A silent watcher of hidden knowledge perched in a moonlit urban threshold. |
| Canal Bloom | The Empress | Mute Swan | legendary | Soft luxury canalwear, floral enamel pins, draped feather-safe shawl, gold ankle chain. | An elegant swan surrounded by lush growth and soft city-water reflections. |
| High Perch | The Emperor | Golden Eagle | legendary | Structured civic-street coat, reinforced perch bands, bronze hardware, disciplined utility lines. | A commanding raptor with a monumental silhouette and controlled protective presence. |
| Old Route | The Hierophant | Sandhill Crane | legendary | Long wrapped scarf, old transit-token charms, weathered teaching satchel, calm ritual layers. | A ritual teacher bridging old symbols, migration memory, and street-temple culture. |
| Paired Wings | The Lovers | Rosy-faced Lovebird | legendary | Complementary color accents, linked charm beads, soft twin harnesses, date-night streetwear. | Two natural birds in balanced relationship, choosing together without becoming fused or humanoid. |
| Dive Line | The Chariot | Peregrine Falcon | legendary | Aero techwear bands, race-shell vest, wind-cut trims, signal-red speed accents. | A sleek falcon slicing through city wind with total intent. |
| Steady Talon | Strength | Secretarybird | legendary | Minimal bomber vest, wrapped long-leg guards, warm restraint charm, calm training gear. | A tall, composed hunter whose strength is patience and restraint. |
| Lantern Roost | The Hermit | Snowy Owl | legendary | Heavy winter cloak, weathered scarf, small lantern charm, quiet night-walker layers. | A pale owl carrying quiet light through cold urban night. |
| Turn Current | Wheel of Fortune | Belted Kingfisher | legendary | Bright windbreaker, rotating shine-tag charm, river-courier straps, splashproof bands. | A bright bird caught at the instant the current turns. |
| Level Line | Justice | Black-Necked Stilt | legendary | Symmetrical black-white tailoring, balance-scale pin, narrow legal-runner satchel, clean cuffs. | A precise wading bird balanced between opposing signs. |
| Upside View | The Hanged Man | White-breasted Nuthatch | legendary | Reversible tech knit, inverted sling pack, soft grip wraps, quiet contemplative streetwear. | A natural upside-down bird turning inversion into calm insight. |
| Clean Break | Death | Turkey Vulture | legendary | Salvage-worker cloak, rusted cleanup tags, matte gloves for talons, dawn-orange lining. | A solemn carrion bird representing cleanup, transition, and necessary endings. |
| Measured Flow | Temperance | American Flamingo | legendary | Balanced color-block rainwear, mixing-vessel charms, elegant canal sandals for webbed feet. | A graceful bird blending colors, water, and opposing forces. |
| Gleam Trap | The Devil | Common Raven | legendary | Dark luxe streetwear, broken-chain jewelry, oil-slick accents, temptation-market accessories. | A stylish raven surrounded by broken chains and tempting objects. |
| Signbreak | The Tower | Red-Headed Woodpecker | legendary | Impact-worker harness, cracked reflector plates, emergency-orange wraps, rooftop repair gear. | A sharp bird tied to impact, alarm, and sudden structural change. |
| Rooftop Glow | The Star | Superb Fairywren | legendary | Tiny luminous stage cape, soft reflective trim, delicate talon bands, skywatch charms. | A tiny radiant bird beneath a huge sky. |
| Night Road | The Moon | Common Nightjar | legendary | Camouflage night shell, low-visibility hood, moonlit dust patterning, quiet road charms. | A camouflaged night bird nearly hidden in surreal moonlight. |
| Morning Burst | The Sun | American Goldfinch | legendary | Bright athletic streetwear, sunlit wing bands, warm track trim, playful festival clips. | A gold bird bursting with clear morning energy. |
| Wake Call | Judgment | Red Junglefowl | legendary | Herald streetwear, sunrise scarf, brass call-charm, rooftop announcer harness. | A bold herald whose cry wakes the whole scene. |
| Long Loop | The World | Arctic Tern | legendary | Long-haul travel techwear, migration-map lining with abstract marks, weathered flight bands. | A long-distance traveler framed by circular migration and world symbols. |

## Aviary Legend Bird Map

Aviary Legends are Bird Squad-original trumps beyond the 22 classic Legend
lineage cards. They follow the same style/description contract as the Majors.

| Card | Bird | Rarity | Style Direction | Description |
| --- | --- | --- | --- | --- |
| Migration Line | Bar-tailed Godwit | legendary | Weathered long-haul flight harness, layered travel patches without text, compass-feather charm. | A long-haul flier mid-crossing over an endless dusk skyline. |
| Home Roost | Purple Martin | legendary | Soft home-knit wrap, lantern-key charm, doorkeeper talon bands, colony-tower workwear. | A guardian of the communal roost-tower welcoming the flock home at last light. |
| Storm Ride | Magnificent Frigatebird | legendary | Slick storm-shell wrap, charged static charm, grip talon bands, hot-red weather accents. | A storm-rider angled into the gale, thriving where others flee. |
| Hot Feathers | Scarlet Tanager | legendary | Half-shed layered wrap, transition cuffs, loose feather charms, two-tone renewal styling. | A bird caught between two selves, brilliant plumage giving way to a quieter new coat. |
| Flock Signal | Red-billed Quelea | legendary | Lightweight shared-culture bands, signal-tag cuffs, dawn-colored flock trims, no uniform marks. | A single small bird leading a vast murmuration that moves as one mind. |
| Eclipse Watch | Tawny Frogmouth | legendary | Shadow-bark camo wrap, ringed-eclipse pin, still-watch talon bands, muted night layers. | A masked, motionless watcher at the moment the light goes out. |

## Minor Arcana Crews

Minor Arcana cards should read as bird-city crew scenes before they read as
mystical tarot scenes. The bird is a street character doing a suit-coded job; the
tarot layer is the graphic language around that job.

Use tarot symbols as abstract crew culture: patch shapes, props, border motifs,
staged objects, transit tokens, stickers, flyers, graffiti marks, signage
shapes, and practical city infrastructure. Keep all clothing marks nonverbal.
Avoid making pip cards look like spellcasting tableaux, temple scenes, sacred
rituals, floating magical artifacts, generic fantasy costume portraits, or
gang-identification portraits.

Each card in the full Arcana set must use a globally unique bird species. Suits
still have repeated silhouettes and bird families, but not repeated species.

| Game Suit | Crew | Domain | Habitat / Time | Palette | Species Direction |
| --- | --- | --- | --- | --- | --- |
| Plumes | Brightwing | biological resonance, drive, creativity, hustle, performance | rooftop cyphers, busker corners, billboard catwalks, block-party stages, skate ledges, poster walls, fashion tarps, wet rooftops, waterfront rails, high summer noon | varied personal palettes with iridescent plumage color, warm gold, sky blue, jade, coral, cream, ash, and selective orange/magenta pops | sunbirds, swallows, bee-eaters, rollers, flycatchers, lyrebirds, birds-of-paradise, falcons |
| Basins | Tidewatch | healing, emotion, memory, bonds, protection | modern canals, rain-slick streets, underpasses, harbor railings, utility fountains, dusk | teal, rain gray, pearl, harbor blue, soft rose | herons, spoonbills, ducks, mergansers, shorebirds, skimmers, gannets, pelicans, shoebills |
| Quills | Razorwind | damage, intellect, conflict, truth, words, strategy | antennas, rooftop utility boxes, radio towers, transit wires, storm wind, night | steel, ink black, glass blue, white, cold cyan | shrikes, jays, hawks, drongos, falcons, mockingbirds, caracaras, butcherbirds, kea |
| Nests | Brassnest | resources, craft, work, home, material value | community gardens, bike shops, record stalls, laundromats, food-pantry tables, rooftop planters, maker benches, thrift alleys, loading docks, coffee-roastery corners, hardware co-ops, morning | brass, copper, soil brown, moss, pewter shine | bowerbirds, weavers, city pigeons/doves, starlings, hoopoes, hamerkops, tailorbirds, nutcrackers, oropendolas, mound-builders |

Why these casts work:

- **Plumes** use sunbirds, swallows, bee-eaters, rollers, lyrebirds,
  birds-of-paradise, and a few sharp fliers for motion, color, sound, tempo,
  display, and readable silhouette variety.
- **Basins** use waders, skimmers, pelicans, gannets, ducks, and mergansers for
  patience, tenderness, care, courtship, and distinct water-side body shapes.
- **Quills** use shrikes, jays, raptors, drongos, mockingbirds, caracaras,
  butcherbirds, and kea for intellect and conflict. The edge remains symbolic:
  thorns,
  signal-quills, storm, and signal cuts, never gore.
- **Nests** use bowerbirds, weavers, hamerkops, tailorbirds, nutcrackers,
  oropendolas, mound-builders, and city birds for building, hoarding, carrying,
  repair, trade, and shelter.

## Minor Arcana Card Map

These card maps are the production-level species contract for the 56 Crew cards.
Every row must keep a globally unique bird species, match the suit family, and
preserve the card's urban crew job before tarot symbolism. Rarity comes from the
mechanics contract and should inform both visual complexity and effect ambition.

### Plumes / Brightwing

| Card | Bird | Rarity | Style Direction | Description |
| --- | --- | --- | --- | --- |
| Plume Flash | Malachite Sunbird | common | Cropped teal busker bomber, coral zipper pull, one feather-color case charm, iridescent talon bands, sidewalk-performer accents. | A centered Malachite Sunbird starts a rooftop busker set with emerald throat-and-breast color, wing-flick rhythm, and exactly one feather-color marker near its case; no sound-wave lines or magical wave graphics. |
| Twin Plume Lookout | Barn Swallow | common | Oversized sky-runner hoodie in faded blue-gray, two cloth wind-flag clips, cream grip cuffs, billboard-scout styling. | A Barn Swallow works a billboard-scout lookout, reading the skyline between two cloth wind flags moved by its wingbeat. |
| Plume Horizon | Greater Bird-of-Paradise | common | Baggy runway jacket fitted around display plumes, three mirror-tag charms, gold runway talon bands. | A Greater Bird-of-Paradise treats a rooftop runway as a fit-check while three mirror panels catch its display plumes. |
| Plume Street Party | Vermilion Flycatcher | common | Rooftop party hoodie in warm rust, cloth streamer clips, dancer talon wraps, block-party setup styling. | Four Vermilion Flycatchers set up a block-party stage, tying practical streamers between four corner anchors by beak and talons. |
| Plume Clash | Red-whiskered Bulbul | common | Dance-cypher hoodie in washed navy, red cheek-flash accent, mismatched abstract patches without text, padded practice talon wraps. | Five Red-whiskered Bulbuls clash in a rooftop dance cypher, using raised crests, call posture, wingbeat rhythm, and body motion. |
| Plume Victory Wire | American Kestrel | uncommon | Cropped puffer victory vest in cream and red-brown, laurel-plume talon charm, muted gold champion bands. | One American Kestrel claims a festival win on a high utility wire while exactly six feather-shaped puddle reflections answer its raised-wing pose; no other birds appear. |
| Plume Stand | Scissor-tailed Flycatcher | uncommon | Ledge-guard baggy flight wrap in dusty green, long-tail accent bands, reinforced skate-grip talon cuffs. | A centered Scissor-tailed Flycatcher holds a skate-ledge standoff above exactly seven ledge scuffs and feather rhythm marks pulled inward from the future border. |
| Plume Rush | Lilac-breasted Roller | uncommon | Turquoise-lilac speed-runner windbreaker shell, silver throat scarf, motion-stripe talon cuffs, parkour-route styling. | One Lilac-breasted Roller launches across a rooftop gap, its motion echoed by exactly eight physical reflective speed tabs fixed to the ledges; no magical or electric air streaks. |
| Plume Barricade | Rufous Hummingbird | uncommon | Sentry bomber in smoke amber and slate, patched protective wrap without text, sound-crew talon bands. | A centered Rufous Hummingbird guards a worn rooftop barricade where exactly nine strain marks and wrapped plume markers stay inside the safe image area. |
| Plume Load | Wilson's Bird-of-Paradise | rare | Overloaded performance-runner work jacket, baggy velvet-trim layers, heavy fabric-sling talon bands. | A centered Wilson's Bird-of-Paradise hauls exactly ten bundled performance rods and plume props through a rooftop service area after the show, with the whole bundle clear of the border. |
| Plume Fledgling | Rainbow Bee-eater | common | Poster-runner hoodie in green-gold and sky blue, tiny crossbody plume pouch, poster-runner talon cuffs, wheatpaste wall styling. | A centered Rainbow Bee-eater poster-runner darts along a wheatpaste wall with a fresh physical signal plume and blank abstract flyers, rendered as crisp pixel art. |
| Plume Outrider | Alpine Swift | uncommon | Slate-and-cream flight-courier shell, crossbody plume sling, long-distance wing bands, aero talon cuffs, skyline courier styling. | An Alpine Swift tears between rooftops and billboards through wingbeat rhythm, body angle, and feather sheen; no Basin, Quill, or Nest props define the action. |
| Plume Matron | Superb Lyrebird | rare | Oversized runway jacket panels, tail-safe iridescent trim, elegant command harness, rooftop-runway lead styling. | A centered Superb Lyrebird commands a rooftop runway through sweeping tail display, call posture, fashion presence, and grounded Plumes stage language; no Basin, Quill, or Nest props. |
| Plume Elder | Aplomado Falcon | rare | Deep green rooftop director puffer coat, brass hardware pulls, reinforced rhythm-crew talon bands. | An Aplomado Falcon rules from a water-tower perch as a Plumes rhythm director, commanding billboards, calls, and rooftop movement without care vessels, signal props, or resource staging. |

### Basins / Tidewatch

| Card | Bird | Rarity | Style Direction | Description |
| --- | --- | --- | --- | --- |
| Open Basin | Great Blue Heron | common | Tall modern rain shell, basin sling, reflective canal trim, patient caretaker bands. | A Great Blue Heron lifts exactly one brimming dew-vessel from a modern utility fountain using only beak and talons; wings remain wings, not arms. |
| Twin Basin Bond | Hooded Merganser | common | Paired wet-weather wraps, mirrored color accents, courtship bead charms, soft hoods. | Two mergansers mirror each other in a courtship display over still water. |
| Basin Chorus | Roseate Spoonbill | common | Joyful fountainwear, rose rain poncho, splashproof satchel, shared celebration clips. | Spoonbills splash together in a fountain in shared celebration. |
| Closed Basin | Green Heron | common | Folded rain hoodie, closed satchel, muted teal layers, guarded posture styling. | A Green Heron ignores exactly four closed basin vessels at a modern canal shelter, one offered and three untouched on the wet ledge. |
| Spilled Basin | Wood Duck | common | Water-stained jacket, softened scarf, worn basin strap, melancholy gutter palette. | A centered Wood Duck turns away in grief from exactly five basin vessels placed safely inward: three tipped vessels in the gutter and two upright basins still standing behind it. |
| Basin Memory | Sanderling | uncommon | Beachcomber rain wrap, elder-care pouch, shell charm, gentle handoff styling. | Two Sanderlings share food at a city fountain while exactly six capped basin cups line the wet fountain rim. |
| Basin Mirage | Mandarin Duck | uncommon | Reflective luxe raincoat, mirrored bubble charms, iridescent scarf, dreamy canal colors. | A centered Mandarin Duck gazes at exactly seven reflected basin choices in rainwater and shop glass, all pulled inward so the border cannot crop them. |
| Basin Walkaway | Black Skimmer | uncommon | Low-slung dusk commuter rain shell, packed-away basin strap, broad-bill reflective bands, farewell talon wraps. | A Black Skimmer leaves arranged basins behind, gliding low down the canal into the dusk rain. |
| Full Basin Row | Scarlet Ibis | uncommon | Celebratory harbor suit, polished basin charms, rose-red rain trim, content lounge posture. | A content Scarlet Ibis settles before exactly nine full basin vessels arranged in one clear arc, with reflections blurred so they cannot be counted. |
| Canal Shelter | Mallard | rare | Family rainwear layers, shelter tarp harness, warm thermos charm, rainbow wet-weather trim. | Exactly ten same-species Mallards gather in the center under exactly ten oval canal-light basin markers at a modern waterfront shelter. |
| Basin Fledgling | Piping Plover | common | Tiny lifeguard poncho, sealed dew-vessel sling, soft sand-gray wraps, earnest charm. | The youngest of Tidewatch bears a sealed dew-vessel. |
| Basin Outrider | Northern Gannet | uncommon | Canal courier rain shell, fast-water satchel, streamlined wet trim, long-wing questing posture. | Tidewatch's mobile actor cuts low over the canal on a quest of feeling. |
| Basin Matron | Dalmatian Pelican | rare | Fountainhead caretaker raincoat, pearl rain trim, soft pouch-sling basin wrap, poised authority. | The inner master of Tidewatch sits poised at a modern canal pump station and fountainhead. |
| Basin Elder | Shoebill | rare | Oversized harbor-master raincoat, broad-bill hood trim, utility lantern charm, dignified dusk silhouette. | A monumental Shoebill stands centered and slightly lower in frame at a calm modern harbor, with its head, broad bill, feet, and mooring-post perch clear of the future border. |

### Quills / Razorwind

| Card | Bird | Rarity | Style Direction | Description |
| --- | --- | --- | --- | --- |
| Quill Point | Loggerhead Shrike | common | Cropped ink-black courier jacket, cold-cyan signal-quill lapel pin, ribbed wind-band talon wraps, rooftop radio-analyst kit. | A Loggerhead Shrike works a rooftop radio-analyst perch, lifting one signal-quill from a compact weatherproof radio kit. |
| Crossed Quills | Blue Jay | common | Cropped glass-blue varsity windbreaker, soft no-text visor band, balanced twin strap pins, billboard decision-perch styling. | A Blue Jay occupies a billboard decision perch between two crossed rooftop antennas, eyes shut above city traffic. |
| Storm Quill | Northern Mockingbird | common | Cropped wind shell, courier utility vest, taped seam accents, pale wing-flash trim, chain-link rain-alley signalwear. | A Northern Mockingbird stands as a rain-alley witness beside exactly three large thorns holding one shed feather; no Basin-like raincoat, extra thorns, wounds, or loose quills appear. |
| Sheathed Quills | Northern Goshawk | common | Padded roost parka, quilted shoulder panels, quiet-clasp pin, insulated talon rests, utility-room night-watch styling. | A Northern Goshawk roosts beneath breaker boxes and bundled conduit while exactly four sheathed signal-quills rest on a service tray. |
| Scattered Quills | Black Drongo | common | Asymmetric salvage vest, loose pocket flaps, trophy-feather crossbody sash, rubberized grip talon cuffs. | A Black Drongo acts as ledge salvage runner after a hard rooftop argument, gathering exactly five large signal-quills while same-species rivals retreat. |
| Quill Crossing | Merlin | uncommon | Waterproof slate flight cape, folded route-map charm, reflective trek talon bands, elevated-transit storm-crossing styling. | Exactly six Merlins of the same species cross under elevated tracks over a grey flood channel toward a break in the weather. |
| Quill Slip | Steller's Jay | uncommon | Thrifted black hooded anorak, hidden side-pouch harness, soft-step felt talon wraps, service-alley wire-sneak styling. | A Steller's Jay slips along a service wire with exactly five carried signal-quills while exactly two decoy signal-quills remain behind. |
| Quill Ring | Fork-tailed Drongo | uncommon | Loose mesh utility wrap, unclasped cyan band pin, open-buckle talon cuffs, rooftop service-enclosure styling. | A centered Fork-tailed Drongo stands inside exactly eight signal posts built into a rooftop service enclosure, all safely inside the overlay window while the open gate shows the way out. |
| Night Quills | Crested Caracara | uncommon | Rumpled knit snood, short night shell, crest-line rain hood, dim reflective worry pin, tight uneven talon wraps, apartment-wire insomnia styling. | A Crested Caracara sits awake at 3am on a wet rooftop service rail, with nine quill-like pressure reflections appearing across lit windows and rain streaks. |
| Dawn Quills | Pied Butcherbird | rare | Patched dawn coach jacket, small sunrise lining tab, fresh-start white talon cuffs, recovery-ledge styling. | A Pied Butcherbird reaches a dawn recovery ledge after a night marked by exactly ten quill-like pressure marks embedded into rooftop cracks and rain streaks. |
| Quill Fledgling | Green Jay | common | Rookie green-blue messenger hoodie, compact word-tube chest sling, bright tag-clipped talon cuffs, utility-box antenna-row styling. | A Green Jay rookie message runner bears word across a wet rooftop antenna row. |
| Quill Outrider | Prairie Falcon | uncommon | Sleek slate racing shell, forward wind-quill talon charm, aero compression talon bands, radio-tower speed-run styling. | A Prairie Falcon becomes the aerial strategy racer, cutting between radio towers at high speed. |
| Quill Matron | Kea | rare | Minimal olive tactician coat, thin crowned-quill collar pin, orange underwing accent cuffs, fine layered talon wraps, taped roof-diagram styling. | A centered Kea rooftop tactician sits on an antenna mast with wings folded as wings and one signal-quill balanced only in its beak, with no arm-like clothing silhouette. |
| Quill Elder | Cooper's Hawk | rare | Heavy command mantle, broad shoulder paneling, deep-quill no-text seal pin, reinforced steel talon bands. | A Cooper's Hawk radio-tower commander rules the storm-lit rooftop array from the highest mast. |

### Nests / Brassnest

| Card | Bird | Rarity | Style Direction | Description |
| --- | --- | --- | --- | --- |
| Nest Seed | Satin Bowerbird | common | Slouch beanie, cropped olive chore vest, single shine-berry pouch, mud-splashed brass talon bands. | A Satin Bowerbird presents one gleaming shine berry at a modern community garden gate beside stacked milk crates and planter boxes. |
| Nest Juggle | European Starling | common | Reflective bike-courier vest, flannel waist wrap adapted around tail, two shine tag cable clips. | A European Starling balances two shine tags on a bike-shop cable strung above a repair stand and cargo-bike wheel. |
| Nest Blueprint | Hamerkop | common | Contrasting canvas shop aprons, rolled plan tube, bright work-grip talon wraps, modular co-op hardware styling. | Three Hamerkops build a modular display arch at a neighborhood hardware co-op pegboard, guided by three abstract plan cards. |
| Locked Nest | Rock Pigeon | common | Zippered city utility hoodie, tiny padlock pouch, concrete-gray talon wraps, storage-unit streetwear. | A Rock Pigeon guards four shine tags on a concrete storage-unit ledge beside a modern padlocked crate. |
| Cold Nest | Mourning Dove | common | Oversized thrift hoodie, frayed flannel blanket wrap, empty canvas shine pouch, laundromat-window palette. | Two Mourning Doves huddle outside a laundromat-corner-store window, with exactly five dull shine tags out of reach behind glass. |
| Shared Nest | Common Myna | uncommon | Volunteer utility vest, soft bucket hat fitted to crest line, plain apron loops with no token shapes, food-pantry table styling. | A Common Myna runs a mutual-aid folding table, sharing seed while exactly six brass resource tokens sit beside a digital scale. |
| Growing Nest | Clark's Nutcracker | uncommon | Canvas gardener vest, rolled knit cap, soil-dusted cache satchel, rooftop planter crew styling. | A Clark's Nutcracker waits beside rooftop planters and scaffold rails, watching exactly seven shine-seed cache markers mature under one continuous grow-light strip. |
| Workshop Nest | Common Tailorbird | uncommon | Selvedge denim micro-apron, thread-loop shoulder sling, paint-speckled talon wraps, LED maker-bench styling. | A Common Tailorbird works at a modern maker-space bench, stitching and shaping the eighth shine tag beneath pegboard tools and task lights. |
| Treasure Nest | Regent Bowerbird | uncommon | Polished thrifted satin jacket, small round sunglasses above beak line, collector shine medallion, record-stall styling. | A centered Regent Bowerbird stands in a curated thrift-alley record stall beside exactly nine shine tags on a folding display rack, with wings tucked and no arm-like silhouette. |
| Legacy Nest | Baya Weaver | rare | Mixed denim chore coats and flannel wraps, heirloom tool charms, family shine-tag garland, loading-dock block-party layers. | Three to five Baya Weavers gather at a modern loading-dock block party beneath exactly ten shine tags strung across one scaffold arch. |
| Nest Fledgling | Eurasian Hoopoe | common | Cropped apprentice hoodie, tiny coffee-brown tool satchel, single lens charm, coffee-roastery maker-corner styling. | A Eurasian Hoopoe apprentice studies a single shine tag beside burlap coffee sacks and a compact tool tray. |
| Nest Outrider | Montezuma Oropendola | uncommon | Boxy courier work jacket, weighted salvage satchel, cargo-route talon bands, hanging-nest cord accents, loading-dock route-runner styling. | A Montezuma Oropendola courier cuts between loading docks and rooftops with a shine-laden salvage satchel and cargo-route tags. |
| Nest Matron | Golden Bowerbird | rare | Long indigo shop apron, gold chore jacket panels, refined hardware cuffs, parts-library curator styling. | A Golden Bowerbird master curator sits in a modern parts-library alcove among color bins, shine tags, and clamp lights. |
| Nest Elder | Malleefowl | rare | Heavy canvas architect chore coat, rolled beanie with brass clip, reinforced talon bands, hardware co-op authority. | A Malleefowl rules from a hardware co-op mezzanine above a communal scaffold-mound, pegboards, crates, and roll-up doors below. |

## Court Names

Pages, Knights, Queens, and Kings can be renamed in the bird world:

| Classic | Renamed | Role | Pose Energy |
| --- | --- | --- | --- |
| Page | Fledgling | apprentice / messenger; the suit's youngest hero species | active, curious |
| Knight | Outrider | the mobile actor; always in flight or motion | dynamic |
| Queen | Matron | inner mastery of the suit; commanding, nurturing | static, poised |
| King | Elder | full external authority of the suit; the crew boss | static, monumental |

## Pip Method

Each Ace-Ten depicts the suit's recurring cast in a behavioral scene matching
the traditional pip meaning, translated into bird behavior. The suit number is
read from motivated scene details such as carried shine berries, clipped
signal-quills, feather-color echoes, call-wave marks, basin vessels, rain
reflections, staged tools, or built objects. Count elements should feel arranged,
used, guarded, carried, reflected, or produced by the bird's action, not like a
literal row of identical icons pasted onto the composition.

Use the card data's `numberSymbolism.element` as the acceptance contract for
each pip card. The prompt may describe scene texture, but only that named
element should carry the count. For example, Ten of Basins counts ten
canal-light basin markers, not extra bowls in reflections; Seven of Quills
counts five carried signal-quills plus two decoys, not every feather-shaped
mark; Ten of Nests counts ten shine tags, not every bird and charm in the
family scene.

| # | Plumes | Basins | Quills | Nests |
| --- | --- | --- | --- | --- |
| Ace | a sunbird creates the first flash through emerald plumage, wingbeat, and a single feather-color echo | a heron lifts a brimming dew-vessel | a shrike holds one gleaming signal-quill aloft | a bowerbird presents one shine berry |
| 2 | one swallow surveys the skyline between exactly two wind flags moved by its wingbeat | two Hooded Mergansers of the same species mirror in courtship | one jay balances between exactly two crossed signal lines | one starling balances exactly two shine tags |
| 3 | one bird-of-paradise watches the horizon as exactly three mirror panels catch its own display plumes | three Roseate Spoonbills of the same species splash together | one mockingbird turns toward one caught feather and exactly three thorns | three Hamerkops of the same species build from a shared blueprint |
| 4 | one flycatcher threads a block-party rhythm through exactly four anchored corners | one heron ignores an offered basin, with four basin markers in the scene | one goshawk rests near exactly four sheathed quills | one pigeon guards exactly four shine tags |
| 5 | five Red-whiskered Bulbuls of the same species dance-battle with crest snaps and call-waves | one wood duck turns away from three spilled vessels while exactly two basins remain upright | one drongo gathers exactly five scattered signal-quills | two Mourning Doves of the same species outside a warm market window with five resource markers |
| 6 | one kestrel raises its wings as exactly six feather-shaped reflections answer the victory pose | two Sanderlings of the same species share food with six basin markers nearby | six Merlins of the same species ferry toward calmer sky | one myna shares seed beside exactly six balanced resource markers |
| 7 | a flycatcher defends a ledge with seven scuffs and feather rhythm marks integrated into the standoff | a bird faces many reflections | a jay slips away with signal-quills | a nutcracker waits over seven shine-seed cache markers |
| 8 | one Lilac-breasted Roller launches across a rooftop gap with exactly eight physical reflective speed tabs fixed to the ledges | one skimmer leaves exactly eight basin markers behind in dusk rain | one drongo finds the open gap in exactly eight signal posts built into the enclosure | one tailorbird practices at a workbench with exactly eight shine tags |
| 9 | a hummingbird guards a barricade whose nine signs of strain come from worn wraps, feather posture, and staged plume markers | a satisfied bird before full basins | a caracara awake beside nine apartment-window pressure reflections, not a pasted row of quills | a bowerbird in an alley market display |
| 10 | one bird hauls exactly ten bundled performance rods integrated into the load | a Mallard family of the same species gathers under exactly ten oval canal-light basin markers | one butcherbird rises beside exactly ten quill-like pressure marks embedded in rooftop cracks and rain streaks | three to five Baya Weavers gather at the loading-dock scaffold arch with exactly ten shine tags |

## Suit Reframes

- **Plumes / Brightwing:** rooftop performance, skate, dance-cypher,
  street-stage, busker, and billboard crew; display, hustle, color, sound,
  calls, wingbeats, choreography, feather vibration, reflective city color, and
  dance-battle energy. Its
  supernatural-feeling outcomes are expressed as plumage flash, rhythm, volume,
  resonance, attention control, and crew synchronization rather than spells,
  literal pyrotechnics, electrical effects, antenna beams, fantasy robes,
  glowing spell effects, or occult spectacle.
- **Basins / Tidewatch:** canal crew, rainwear, mutual aid, first-aid kits,
  thermos charms, harbor lights, shelter, emotional support, and regrouping.
  Healing reads as patching up, cleansing, sheltering, and keeping the crew
  together.
- **Quills / Razorwind:** antenna crews, messengers, signal hacking, tactical
  routes, sharp rhetoric, expose/mark effects, quill-shaped signage and feathers.
  Damage reads as precision, interruption, and cutting through lies.
- **Nests / Brassnest:** hipster workwear builders, couriers, bike-shop repair
  crews, record-stall tinkerers, coffee-roastery makers, tool belts, shine tags,
  ledgers, scaffold nests, supply routes, and persistent upgrades. Resources
  read as materials, barriers, trade, construction, and upkeep in modern urban
  spaces with beanies, flannel, hoodies, chore coats, denim/canvas layers,
  folding tables, roll-up doors, crates, concrete, and work lights.

## Plumes Resonance Language

Plumes are the deck's resonance and tempo suit, but their prose should stay
birdy and urban. They do not cast spells in the fiction; they perform effects
through color, sound, display, rhythm, and attention.

Preferred Plumes verbs: flash, call, trill, drum, shimmer, preen, fan, sync,
echo, rally, display, ripple.

Preferred Plumes nouns: color, volume, rhythm, display, chorus, throat flash,
wingbeat, feather buzz, resonance, sheen, reflection, tempo, afterimage,
crescendo.

Avoid in Plumes prose unless a Major Arcana card is deliberately breaking the
rules: spell, cast, arcane, mana, enchant, invoke, ritual projectile,
wizard, staff-like prop, or generic magical energy.

## Molt / Reversals

Every tarot card carries upright and reversed readings. Bird Squad renders the
reversed state as the Molt: the same bird, the same archetype, caught in its
shedding/transitional form.

Molt is transformative, not evil. Reversed meanings derive through one of five
modes:

| Mode | Meaning |
| --- | --- |
| blocked | stuck, resisted, delayed |
| inward | turned private/internal, dimmed |
| shadow | in toxic excess |
| deficiency | collapsed, too little |
| renewal | the positive reversal, common on dark cards |

Molt visual signals, in priority order:

1. **Inverted light:** cold uplight or under-rim instead of the upright key light.
2. **Eclipse palette shift:** accent drains toward ash or mutates into oil-slick
   iridescence depending on mode.
3. **Feather state:** loose feathers, pin-feathers, scruffy broken edges, never
   gore or bare-skin shock.
4. **Border unravel:** the same frame remains intact; only motif layers fray or
   loosen. Suit filigree becomes plume/basin/quill/nest distress.
5. **Weighted pose:** the same pose becomes off-balance, heavier, or mid-preen.

## Silhouette And Variety

Species variety is already strong. The real risk is that several species share a
body plan and can blur at thumbnail or in-hand scale. Keep shape, pose energy,
and accent hue distinct.

High-risk silhouette clusters:

| Cluster | Cards | Separation Rule |
| --- | --- | --- |
| Small perching songbird | Fool, Hanged Man, Star, Sun | Vary pose and scale-in-frame: leap, inversion, tiny under huge sky, open-wing flight. |
| Perched raptor | Emperor, Chariot, High Priestess, Hermit, Death | Separate posture and framing: monumental, diving, hooded crop, full bright mass, hunched/circling. |
| Owl subset | High Priestess, Hermit | Barn Owl = tight urban hood and sling; Snowy Owl = full-body bright mass and heavy cloak. |
| Black corvid | Magician, Devil | Black-billed Magpie keeps black/white tool clutter; Raven stays glossy, sparse, dark luxe. |
| Tall wader | Hierophant, Justice, Temperance, Strength | Lean on neck/leg/crest shape and palette. |
| Glossy dark body | Devil, Death | Death uses rust/pale dawn warmth; Devil uses oil-slick purple/silver. |

Pose energy target across the Major Arcana should trend toward roughly 40%
static, 35% active, and 25% dynamic. Push Fool, Strength, Wheel, Judgment, and
Tower upward in energy when regenerating or refining them.

Palette watch: avoid letting Magician, Justice, Devil, Death, and Moon collapse
into one monochrome-neon block. Avoid letting High Priestess, Hermit, Star, Moon,
and World collapse into one cool blue/silver block; each needs a distinct
secondary accent.

## Runtime Asset Rules

Generated art is production source material. Runtime assets should be derived
from it through an explicit manifest so the game never relies on ad hoc file
paths or manual crop assumptions.

Source asset rules:

| Asset Type | Source Size | Rule |
| --- | ---: | --- |
| Full card art | 1024x1536 | Archival concept/source image. Do not crop destructively. |
| Runtime card portrait | 512x768 | Main in-game card image. Preserve full tarot frame and title cartouche unless UI intentionally hides the frame. |
| Runtime thumbnail | 256x384 | Deck, reward, and map preview image. Must keep species silhouette readable. |
| Small icon crop | 128x128 | Optional UI accent. Use bird head, suit crest, or readable silhouette, not arbitrary center crop. |

Naming rules:

| Asset | Pattern |
| --- | --- |
| Source card | `assets/concept-art/cards/{set}/{cardId}.png` |
| Minor Arcana border/title overlay | `assets/templates/minor-arcana/card-overlays/{suit}/{cardId}.svg` |
| Minor Arcana overlay manifest | `assets/templates/minor-arcana/card-overlays/overlay-manifest.json` |
| Runtime portrait | `assets/runtime/cards/portrait/{cardId}.webp` |
| Runtime thumbnail | `assets/runtime/cards/thumb/{cardId}.webp` |
| Runtime icon | `assets/runtime/cards/icon/{cardId}.webp` |
| Manifest | `assets/runtime/cards/card-art-manifest.json` |

Border-first generation rule:

- For future Minor Arcana regeneration, generate the expressive center art first,
  then composite it under the deterministic suit overlay. The overlay owns the
  final border, medallions, side rails, cartouche, and title text. The image
  model should not be asked to invent borders or readable titles for accepted
  production cards.

Manifest fields:

| Field | Rule |
| --- | --- |
| `cardId` | Must match `data/cards/arcana/` ID. |
| `source` | Full source art path, or null when status is `placeholder`. |
| `portrait` | Runtime portrait path. |
| `thumbnail` | Runtime thumbnail path. |
| `icon` | Optional icon crop path. |
| `version` | Asset generation version or date. |
| `status` | `approved`, `placeholder`, or `needs-review`. |

Fallback rules:

- Missing approved art should use a suit-coded placeholder frame.
- Placeholder art must be visibly marked in development builds.
- Runtime should never fail to load a card because finished art is missing.
- A card reward should still show ID, name, suit, rarity, cost, and effect text
  when art is placeholder.

Crop/review rules:

- Do not crop off the beak, feet, tail, or suit-defining prop unless the image is
  explicitly an icon crop.
- Preserve enough border to keep the tarot-card identity visible.
- The bird must remain readable at thumbnail size.
- Text in generated title cartouches is allowed to be hidden by UI overlays, but
  should not conflict with the player-facing card name.
- Runtime exports should prefer WebP for game load size while keeping PNG source
  files intact.

## Review Checklist

- Is the bird anatomically bird?
- Does the card depict only the named bird species, with no mixed-species flock
  or unrelated background birds?
- Does the bird have exactly two legs and no extra limbs?
- If a prop is held, is it held by beak, talons, feet, or legs rather than
  hands, fingers, wing-hands, or human-like grasping?
- Does the species choice support the Bird Squad card meaning?
- Is streetwear fitted to bird anatomy?
- Does clothing avoid readable text, slogans, letters, numbers, brand marks,
  crew names, and pseudo-writing?
- Is the suit identity visible through color, material, accessory, and setting
  without looking like a gang uniform?
- Is the silhouette readable at card scale?
- Does the card feel like crisp pixel art, not a blurred painting with pixel
  artifacts?
- Is the title readable and limited to the intended card name?
- Does the card use the shared frame while keeping card-specific motifs inside
  established frame zones?
- Does the card read as an urban bird crew scene before occult card art,
  especially for Minor Arcana?
- Is the suit identifiable before reading the title?
- Does the card avoid suit motif bleed from the other three suits?
- For Ace-Ten: is the exact pip number shown with the card's named count
  element, not unrelated extra birds, unreadable numerals, alternate suit
  objects, extra reflections, or lookalike clutter?
- Can the visible pips be counted one by one without uncertainty, and is there
  no overcount or undercount?
- Does the bird's outfit feel individual within its suit rather than a repeated
  uniform?
- For Quills: are conflict elements symbolic, with no wounds, blood,
  ropes, or nooses?
- For Molt: does the variant read as the same card turned over, not a new card?
- Does the card avoid human anatomy, hands, gore, ropes, nooses, watermark text,
  clothing text, readable logos, gang-coded styling, generic spellcasting, and
  floating icons with no physical source?

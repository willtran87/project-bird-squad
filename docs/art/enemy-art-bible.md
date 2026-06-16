# Bird Squad Enemy Art Bible

Version: 0.1

This document extends `docs/art/art-bible.md` for enemy art. The core visual
language is unchanged: high-resolution pixel art, anatomically grounded animals,
modern urban street clothing, and a present-day bird-city world of rooftops,
canals, antennas, markets, signal towers, utility structures, and high roosts.

## Core Rule

Enemies are animals, not humanoids. Birds, rats, eels, and other threats must
keep their natural body plans: beaks, muzzles, wings, tails, talons, paws, claws,
scales, feathers, fur, or fins as appropriate. Do not give enemies human torsos,
arms, hands, fingers, human faces, human legs, or upright human posture.

Clothing adapts to the animal. Use feather-safe or body-safe streetwear:
cropped jackets, hooded wraps, rain shells, utility harnesses, sling pouches,
talon bands, paw wraps, caps, scarves, reflective trim, patched workwear,
chain clips, and tiny abstract pins. Props must be carried by beak, talons,
paws, teeth, harnesses, carts, rigging, or the environment, never by invented
hands.

Props and clothing must not impede natural animal movement. Outfits should leave
wings able to fold, flare, or fly; legs able to perch, run, wade, or hop; tails
able to balance; and paws, talons, fins, or webbed feet able to move naturally.
Avoid bulky sleeves, rigid shoulder shapes, strapped-down wings, tight human
jackets, heavy props, or harness layouts that would prevent the animal from
moving like its species.

Enemy stills must be usable as grounded combat cutouts. Pose enemies as if they
can stand on an implied ground line with their natural weight supported by paws,
talons, webbed feet, claws, hooves, or body coils as appropriate. Avoid floating,
mid-flight, hanging, or prop-dependent poses unless a future contract explicitly
asks for a flying or suspended enemy.

Default enemy poses should be dramatic idles: braced, watchful, coiled, guarding,
mid-feint, or ready to spring. The enemy should look like it is about to act, not
already halfway through an attack. Avoid full action poses that twist the body
too far, hide the animal silhouette, require a support prop, or make the cutout
hard to crop and read in combat.

Each enemy contract should describe one readable character. A gameplay category
can still be called a Rival Crew, but the generated enemy art should not depict
a flock, formation, gang, pair, trio, or clustered group as the primary subject.

## Art Contract Fields

Enemy JSON contracts carry the per-enemy source text:

- `description`: concise identity/lore read for the enemy.
- `visualBrief`: generation guidance for species/body, clothing, props, pose,
  and district environment.
- `silhouette`: quick shape language for scanning the enemy in combat.
- `artPose`: default cutout framing. Use a dramatic idle in a front-facing 3/4
  view, with the body angled slightly left or right and the face/head aligned to
  the same 3/4 angle; the enemy should stand on an implied ground line.

These fields should be specific enough to generate art without inventing a new
character, but short enough to stay stable as gameplay tuning changes.

## Shared Style

- Use high-resolution pixel art with crisp clusters, deliberate dithering, and
  readable combat silhouettes.
- Keep enemies stylish, grounded, and slightly dangerous rather than monstrous
  fantasy creatures.
- Avoid readable text on clothing, patches, signs, caps, pouches, or harnesses.
- Avoid medieval fantasy, sci-fi armor, holograms, robotic parts, spell effects,
  magic particles, aura clouds, and floating runes.
- Let danger come from animal posture, weather, urban infrastructure, Tells,
  Cover, snags, Open Sky exposure, and route pressure.
- Translate hazardous materials into fashion, accessories, props, or the ground
  plane before putting them on the animal body. Oil, tar, rust, wet rope, and
  grime should usually read as rain-shell sheen, trim, straps, stains on
  clothing, puddles, tar paper, dock residue, or route debris; do not smear
  literal tar, sludge, or oil across feathers, fur, scales, faces, or skin unless
  a future contract explicitly calls for injury or contamination.
- Prefer front-facing 3/4 cutout poses over straight-on symmetry. Straight-on
  art is allowed for special portraits, but gameplay enemy concepts should show
  beak depth, wing mass, tail, talons, and clothing dimension.
- Use dramatic idle poses, not full attack poses. The enemy can lean, brace,
  glare, guard, coil, tense a cord, or set one foot forward, but should remain
  balanced, readable, and useful as a reusable combat cutout.
- The enemy must use a coherent 3/4 pose: body, face, and head share the same
  3/4 angle. The eyes or expression can still engage the viewer, but the beak,
  muzzle, or head should not snap to a straight-on portrait angle or drift into
  a full profile.
- The enemy should be able to stand naturally on the ground in the final cutout.
  Perches, rails, wires, ledges, and props can inspire the design, but the final
  still should not depend on a visible support object to make the pose work.
- The primary subject must be a single enemy character. Avoid multi-character
  clusters, coordinated flocks, crews, formations, gangs, pairs, or trios unless
  a future contract explicitly creates a multi-unit enemy type.
- Clothing can signal role and district, but should not become gang-coded:
  avoid matching intimidation uniforms, readable crew labels, hand signs, and
  territory marks.

## District Language

| District | Enemy Art Direction |
| --- | --- |
| Rooftop Blocks | Tar paper, HVAC boxes, parapets, rain-slick roofs, wire bundles, scavenged streetwear, low rooftop pressure. |
| Canal Markets | Wet dock boards, locks, rope, tarps, reflective rain shells, market salvage, utility satchels, waterline grit. |
| Signal Spires | Antennas, beacon cages, wind-cut jackets, courier straps, warning-call posture, skyline ledges, storm light. |
| High Roost | Heavy utility layers, roost scaffolds, final-route chokepoints, snagged lines, battered high-perch gear, boss-scale silhouettes. |

## Prompt Pattern

Use this structure when generating enemy art:

```text
High-resolution pixel art enemy concept for Bird Squad. [Enemy name], [description].
Anatomically grounded [species/body] wearing [urban clothing/accessories from visualBrief].
Pose/framing: [artPose]. Silhouette: [silhouette]. Scene: [district environment].
Single enemy character only; no secondary enemies, flock, crew, formation, pair, trio,
  or clustered group as the subject.
Use a dramatic idle pose: braced, watchful, guarding, mid-feint, coiled, or ready
  to spring; not a full attack pose, not flying, not lunging out of frame.
Keep the animal non-humanoid: no human arms, hands, fingers, human face, or upright
  human body. Clothing adapts to the animal body. No readable text, no magic particles,
  no sci-fi armor, no fantasy costume. Props and clothing do not impede natural animal
  movement. The enemy stands naturally on an implied ground line without needing a
  visible perch, rail, wire, or support prop. Stylish present-day bird-city streetwear,
  crisp pixel clusters, readable combat pose.
```

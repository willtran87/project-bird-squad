# Bird Squad UI Iconography Workshop

Status: workshop reference.

This document captures the first UI icon concept sheet and turns it into
repeatable generation notes. It is meant for workshopping and consistent
regeneration before icons graduate into runtime assets.

Related sources:

- `docs/art/art-bible.md` owns the overall visual identity.
- `assets/runtime/waymarks/icons/` owns established Waymark item-icon language.
- `assets/runtime/supplies/icons/` owns established Supply and Scrap icon language.
- `assets/runtime/waymarks/thumb/` and `assets/runtime/supplies/thumb/` are the
  generated compact runtime tier; rebuild them with
  `npm run build:runtime-item-art` rather than editing them independently.
- `assets/splash/bird-squad-canal-run-splash-v11-menu-pop.webp` anchors the
  dark canal-rooftop mood.
- `C:/Users/Will/Desktop/icons-alpha.png` is the processed transparent concept
  sheet used for this mapping.

## Global Art Direction

Use high-resolution pixel-painterly item icons with strong readable silhouettes.
Each icon should feel like a physical object from Bird Squad's rooftop/canal
world: worn brass, slate metal, teal glass, stitched cloth, feathers, rope,
clips, pouches, card stock, enamel chips, tiny screws, and practical field gear.

The UI icon set should not read as generic flat app symbols. The first read
should be clear at 32-48 px, but the object can reveal more hand-painted detail
at larger sizes.

Core palette:

- Dark navy and black shadow shapes.
- Aged brass and warm gold for rims, hardware, and value accents.
- Teal and cyan for active energy, route information, and rim light.
- Magenta or purple enamel for special, locked, or Codex-like accents.
- Cream parchment and off-white feather marks for bird-world identity.

Lighting:

- Use a dark object-lighting setup with cyan rim light and warm brass highlights.
- Avoid ground shadows when generating icons for transparency processing.
- Preserve crisp edges and chunky silhouettes.

Transparency workflow:

- Generate on a perfectly flat solid `#00ff00` chroma-key background.
- Do not use `#00ff00` anywhere inside the icon.
- Use no background texture, no gradient, no floor plane, no reflection, and no
  cast shadow.
- Keep each icon isolated with generous padding.
- Process with `remove_chroma_key.py` using border auto-key, soft matte, and
  despill.

## Icon Mapping

| Sheet Position | Working Name | Replaces Text Or Concept | Primary UI Use | Keep, Change, Or Alternate |
| --- | --- | --- | --- | --- |
| Row 1, Col 1 | Flock Heart | Cohesion, Flock health | HUD Cohesion chip, Flock Stats, survival previews | Change |
| Row 1, Col 2 | Cover Shield | Cover | Combat HUD, card keywords, boss prep | Keep |
| Row 1, Col 3 | Resonance Battery | Resonance | HUD resonance chip, Plumes resource | Keep |
| Row 1, Col 4 | Scrap Gear | Scrap | Market prices, reward fallback, resource chips | Keep |
| Row 1, Col 5 | Deck Stack | Deck | HUD deck chip, deck review entry | Keep |
| Row 2, Col 1 | Waymark Compass | Waymarks | HUD Waymark drawer, route artifacts | Keep |
| Row 2, Col 2 | Supply Pouch | Supplies | HUD supplies chip, packed supplies, supply capacity | Keep |
| Row 2, Col 3 | Market Stock Bin | Market stock, inventory, supply stock | Market utility shelf, alternate supply inventory | Alternate |
| Row 2, Col 4 | Draw Stack | Draw pile, draw action | Battle draw pile, Draw keyword | Keep |
| Row 2, Col 5 | Discard Basket | Discard pile, discard action | Battle discard pile, Discard keyword | Keep |
| Row 3, Col 1 | Roost Nest | Roost, End Turn | End turn button | Keep |
| Row 3, Col 2 | Back Chevron | Back | Codex, menu, market, modal navigation | Keep |
| Row 3, Col 3 | Close Medallion | Close | Modal close buttons, drawers, overlays | Keep |
| Row 3, Col 4 | Scroll Up Chevron | Up, scroll up | Deck review, Codex, scroll controls | Keep |
| Row 3, Col 5 | Scroll Down Chevron | Down, scroll down | Deck review, Codex, scroll controls | Keep |
| Row 4, Col 1 | Route Pin | Take this route | Route confirm button, selected crossing | Keep |
| Row 4, Col 2 | Market Basket | Buy, Market | Market purchase buttons and market entry | Keep |
| Row 4, Col 3 | Refresh Ring | Refresh stock, reroll | Market refresh button | Keep |
| Row 4, Col 4 | Preen Kit | Preen, upgrade | Preen reward, Nest workshop, market preen service | Keep |
| Row 4, Col 5 | Release Card | Remove card, release card | Market remove service, Nest remove option | Keep |
| Row 4, Col 6 | Locked Padlock | Locked | Locked leaders, locked route choices, unavailable actions | Keep |

## Per-Icon Generation Notes

### Flock Heart

Current concept: a round medallion with a leaf-like motif. It reads as polished
and valuable, but not strongly enough as Flock survival.

Revised direction: make this icon clearly heart-shaped while keeping it physical
and bird-specific. Use a compact brass-and-enamel heart charm, slightly
asymmetric like a field badge, with two small feather vanes or wing-feather
cuts forming the upper lobes. The center should show a warm protected glow or a
tiny nested feather mark, not a medical cross. It should read as "the flock is
still together" before it reads as a generic heart.

Prompt phrase:

> A heart-shaped brass and teal enamel flock badge, feather-wing lobes forming
> the heart silhouette, tiny nested feather mark in the center, worn rooftop
> gear texture, cyan rim light, no medical cross.

Avoid:

- Perfect emoji heart shape with flat red fill.
- Leaf-only reads.
- Medical cross, potion bottle, or fantasy magic heart.
- Human anatomical heart.

### Cover Shield

Use a compact shield plate with a feather set into the center. The shield should
feel bolted, repairable, and carried by a small crew, not royal or medieval.
Keep teal enamel, brass rim, scratched slate metal, and off-white feather detail.

Prompt phrase:

> A compact rooftop shield badge with brass rim, teal chipped enamel, and one
> off-white feather set into the face, practical field gear, strong readable
> shield silhouette.

Avoid ornate heraldry, readable letters, or a full coat of arms.

### Resonance Battery

Use a small teal glass energy cell with brass caps and a bright lightning-like
cyan charge inside. It should look portable, strapped, and mechanical, not
purely magical.

Prompt phrase:

> A small cylindrical teal glass resonance battery with brass caps, tiny screws,
> cyan lightning charge inside, worn canal-market hardware, 3/4 view.

Avoid sci-fi plastic, neon tube signs, or loose lightning without an object.

### Scrap Gear

Use a chipped metal gear-token with brass, slate steel, and small magenta/teal
repair marks. This should remain the main currency icon and should align with
the existing `scrap.webp`.

Prompt phrase:

> A chunky worn scrap gear token, aged brass and dark steel, chipped enamel
> repair tabs, central bolt hole, small cyan and magenta accents.

Avoid gold coins, clean fantasy currency, or tiny details that disappear at
32 px.

### Deck Stack

Use a strapped stack of dark cards with a purple feather emblem. The silhouette
should be a readable rectangular deck, slightly angled, with brass corner
hardware and a band.

Prompt phrase:

> A strapped stack of dark Bird Squad cards, purple feather enamel emblem,
> brass corners and band, thick readable card-stack silhouette.

Avoid showing individual card text or tarot title plates.

### Waymark Compass

Use a round compass charm with a dangling route arrow and brass loop. It should
signal route artifacts and carried navigation.

Prompt phrase:

> A round teal compass charm with brass rim, dangling route arrow token, rope
> loop, scratched glass face, cyan rim light.

Avoid modern map pins as the primary read here; the route pin has that job.

### Supply Pouch

Use the stitched field pouch as the primary Supplies icon. It should show a
zipper, patches, small bottlecap charm, and practical storage silhouette.

Prompt phrase:

> A compact stitched rooftop supply pouch, dark fabric, brass zipper, teal and
> purple patches, small bottlecap charm, packed and ready.

Avoid generic backpack, medicine bag, or shopping bag.

### Market Stock Bin

Use this as an alternate for market inventory or stock, not the main Supplies
HUD icon. It should read as an open bin of useful gear from a canal market.

Prompt phrase:

> An open teal market stock bin filled with small bottles, rolled tools, brass
> cylinders, and field supplies, rope rim, worn enamel tag.

Avoid making it too close to the discard basket.

### Draw Stack

Use a neat stack of cards with a feather emblem, less dark and less sealed than
the deck icon. It should imply incoming cards or cards ready to be pulled.

Prompt phrase:

> A neat angled stack of teal-backed cards with a pale feather emblem, brass
> corners, ready-to-draw silhouette.

Avoid looking identical to the main Deck Stack.

### Discard Basket

Use a basket, cup, or small bin containing used cards. The open top and visible
loose card edges should be the first read.

Prompt phrase:

> A small woven discard basket holding loose dark cards, brass rim, teal card
> backs visible inside, practical table-bin silhouette.

Avoid trash-can reads that feel like deleting the card permanently.

### Roost Nest

Use the nest as the End Turn/Roost icon. It should feel restful but tactical:
twigs, one brass token, and a teal feather tucked in. It should not look like a
reward nest or generic nature icon.

Prompt phrase:

> A compact rooftop roost nest with twigs, one brass token, and a teal feather,
> warm resting silhouette, dark tactical rim light.

Avoid eggs as the main symbol if they make the action feel like hatching.

### Back Chevron

Use a left-facing physical chevron plate, dark metal with brass rim and magenta
inset. It should read instantly at small size.

Prompt phrase:

> A left-facing metal chevron plate, brass-rimmed dark enamel, small magenta
> inset, thick readable silhouette.

Avoid arrow text, thin line arrows, or decorative arrows with unclear direction.

### Close Medallion

Use a round riveted button with a bold magenta X. It should be a physical UI
object, not a flat overlay.

Prompt phrase:

> A round riveted dark-metal close button with a bold magenta enamel X, brass
> studs, thick outline, readable at small size.

Avoid letters, words, or delicate X marks.

### Scroll Up Chevron

Use an upward double-chevron plate with teal enamel and brass edges. It should
pair with the down icon.

Prompt phrase:

> An upward double-chevron metal plate, teal enamel center, brass rim, chunky
> readable direction icon.

Avoid looking like route progression if used only for scrolling.

### Scroll Down Chevron

Use a downward double-chevron plate matching the Scroll Up icon.

Prompt phrase:

> A downward double-chevron metal plate, teal enamel center, brass rim, chunky
> readable direction icon.

Avoid making the down icon feel like discard; reserve discard for the basket.

### Route Pin

Use a magenta route marker standing on a small dark tile base with cyan path
segments. It should replace "Take this route" and show a committed crossing.

Prompt phrase:

> A magenta route pin on small dark rooftop tiles, cyan path segments glowing
> around the base, brass rim, strong destination marker silhouette.

Avoid generic GPS pin if it loses the Bird Squad material language.

### Market Basket

Use a compact basket or crate packed with market goods and a brass token. It
should say buy, shop, or market without words.

Prompt phrase:

> A small canal-market basket packed with tools, card bundle, bottle, and brass
> token, dark woven sides, teal feather tag.

Avoid shopping cart icon language.

### Refresh Ring

Use a circular arrow made from brass and teal metal, with a triangular arrow
head and rivets. It should read as market stock refresh or reroll.

Prompt phrase:

> A circular refresh arrow made of teal metal and brass rivets, triangular brass
> arrowhead, worn enamel, clear loop silhouette.

Avoid magical swirl or browser-refresh flat vector style.

### Preen Kit

Use a feather polish kit: folded purple cloth, white/teal feather, brass clasp,
tiny spark accents. It should read as improving or grooming a card.

Prompt phrase:

> A feather preen kit on folded purple cloth, pale feather and teal feather,
> brass clasp, tiny polish spark accents, careful upgrade-tool feel.

Avoid making it look like a loot reward instead of a service action.

### Release Card

Use a dark card with a bird profile and a bold diagonal magenta slash, plus
small broken fragments. It should mean remove/release from deck, not damage.

Prompt phrase:

> A dark Bird Squad card with bird profile art, crossed by a diagonal magenta
> release slash, small card fragments, brass corners, clear remove-card read.

Avoid red danger-only styling that makes it look like taking damage.

### Locked Padlock

Use a heavy dark padlock with brass rivets and a warm keyhole. It should read
as unavailable/locked from far away.

Prompt phrase:

> A heavy dark metal padlock with brass rivets, warm brass keyhole, thick
> shackle, cyan edge light, clear locked silhouette.

Avoid tiny key details or ornate lock shapes that do not read at HUD size.

## Workshop Questions

- Should the Flock Heart use a teal center for consistency, or a warmer amber
  center to make survival feel more urgent?
- Should Deck and Draw remain two separate card-stack icons, or should Draw use
  a hand/card-pull motif for stronger distinction?
- Should Market Basket and Market Stock Bin both survive, or should one become
  the dedicated shop icon while the other is retired?
- Should Close use the magenta X medallion everywhere, or should danger/service
  overlays use a warmer red variant?

## Graduation Criteria

Before a workshopped icon becomes a runtime asset:

- It remains readable at 32 px and 48 px.
- It has transparent corners and no visible chroma fringe.
- It still reads correctly on dark blue, black, and semi-transparent UI panels.
- It does not rely on readable text, letters, or numbers.
- It does not duplicate another icon's silhouette too closely.
- It has a tooltip title in UI when used without a visible text label.

## Runtime Delivery Tier

The PNG files under `assets/runtime/ui/icons/` are the canonical generated
authoring inputs. The production game loads same-dimension, alpha-preserving
WebP counterparts from that folder so high-detail frames and medallions do not
ship their much larger PNG payloads.

After adding, replacing, or removing a PNG, run:

```powershell
npm run build:runtime-ui-art
```

The builder regenerates every WebP at quality 90 and rejects stale WebPs that
no longer have a PNG source. Runtime validation requires exact PNG/WebP stem
parity and caps each delivered WebP at 120 KiB. PNGs remain workshop sources;
do not point Phaser loaders or HTML entry assets back at them.

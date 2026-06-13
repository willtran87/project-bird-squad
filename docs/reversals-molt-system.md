# Reversals — The Molt System

Version: 0.1 (extends `tarot-aviary-art-direction.md`, the v0.2 bird map, and
`minor-arcana-expansion.md`)

Every tarot card carries two readings: **upright** and **reversed**. Tarot Aviary
renders the reversed state as the **Molt** — the same bird, the same archetype,
caught in its shedding/transitional form. This adds a second meaning layer to all
84 cards (a full shadow-deck) and a clean, on-theme game mechanic, without breaking
any existing rule: still anatomically bird, streetwear-fitted, pixel-art, no gore.

---

## 1. Why "Molt"

Real birds molt: they shed and regrow feathers and, mid-molt, look ragged, fly
poorly, and are briefly vulnerable. Some ducks drop into drab **eclipse plumage**,
trading bright color for camouflage while they change. That is exactly what a
reversed card *is* — the archetype's energy turned inward, blocked, in excess, or
mid-transformation. So Molt = reversed, and it stays **transformative, not evil**,
consistent with the deck's existing "dark cards are transformative, not gory" rule.

The Molt is not a downgrade — it is the card *becoming*. The Aviary Arcana trump
**XXV The Molt** (Scarlet Tanager) is the patron of this state: in the game it is
the card that governs and triggers Molt flips.

---

## 2. How a reversed meaning is derived (the five modes)

Reversed meanings are not random opposites. Derive each one through one of five
modes, and tag it so designers and artists stay consistent:

| Mode | The energy is… | Example (upright → reversed) |
| --- | --- | --- |
| **blocked** | stuck, resisted, delayed | Death → resisting change, stagnation |
| **inward** | turned private/internal, dimmed | The Sun → quiet or hidden joy, dimmed clarity |
| **shadow** | in toxic excess | The Emperor → tyranny, rigidity, control |
| **deficiency** | collapsed, too little | Strength → self-doubt, lost nerve |
| **renewal** | the *positive* reversal (common on dark cards) | The Tower → disaster averted, the inevitable delayed |

Rule of thumb: the bright Majors usually molt toward **inward / shadow / deficiency**;
the dark Majors often molt toward **renewal** (relief). Minors molt mostly
**blocked** (delay, scatter) or **shadow** (the trait soured).

---

## 3. Visual treatment of a Molt card

A Molt variant must read as unmistakably the *same card*, transformed — never a new
illustration. Five stackable signals, in priority order:

1. **Inverted light.** The light source flips — cold uplight / under-rim instead of
   the upright's key light. This literally signals "the card is turned over."
2. **Eclipse palette shift.** The upright `accent` hue mutates to its **molt
   counterpart**: either *drained* (desaturated toward ash) for inward/deficiency
   modes, or *oil-slick iridescent* (the "molt sheen") for shadow/renewal modes.
   The base palette cools and loses one step of saturation.
3. **Feather state.** Loose/missing feathers, pin-feathers, scruffy broken edges,
   a few feathers drifting in the air. Mid-shed, never wounded — no bare skin played
   for gore.
4. **Border unravel.** The suit's filigree (flame/wave/blade/coin) frays or comes
   loose; the title cartouche gains the small **molt glyph** — a single shed feather.
5. **Weighted pose.** The same pose, subtly off-balance or heavier — a dropped wing,
   a turned head, weight shifted back. Courts/Majors may instead show the bird
   actively preening/mid-shed.

Hard constraints carry over: anatomically bird, no gore, no harm, no humanoid forms,
title text unchanged (the orientation, not the name, marks the Molt).

### Accent → molt-accent rule
- Warm/bright accent + inward/deficiency mode → **drained ash** version of the hue.
- Any accent + shadow/renewal mode → **oil-slick iridescent** version of the hue.
- Cool accent + blocked mode → **frost-dimmed** version (one value darker, desaturated).

---

## 4. Production: 84 cards × 2 states = 168

Two paths, and a recommended hybrid:

- **A — Bespoke Molt art per card.** Best quality, highest cost.
- **B — Procedural "Molt filter."** A deterministic pixel-art post-process applied
  to the upright art: cool + desaturate base, remap the accent to its molt
  counterpart, flip the lighting ramp, overlay a shed-feather particle layer, fray
  the border. The repo's Phaser stack already supports this — see
  `skills/filters-and-postfx` (custom post-FX / shaders) and `skills/particles`
  (drifting feathers). This makes Molt a *runtime* state, not 84 extra assets.

**Recommended hybrid:** procedural Molt filter for the 40 pip cards (volume, low
individuality), **bespoke Molt art** for the 22 Majors, 16 courts, and 6 Aviary
trumps (the cards players stare at). ~44 bespoke variants instead of 84.

---

## 5. Gameplay integration

The Molt turns a flavor layer into a mechanic. Options, in increasing ambition:

- **Orientation on entry.** A card enters play upright or Molt (reversed). Molt is a
  **high-risk / high-reward shadow mode**: a different — often stronger but costlier
  or self-damaging — effect, drawn from the reversed meaning.
- **Molting as an action.** Spend a beat to flip your own card to Molt: it becomes
  powerful but **vulnerable** (the bird is flightless mid-shed) for a turn, then
  "regrows" back to upright.
- **The Molt (XXV) as a control card.** It forces or enables Molt flips across the
  board — the on-theme engine for the whole mechanic.
- **Tiered weight.** Reversed **Majors** (fate) hit hard and rarely; reversed
  **Minors** (daily life) are common, smaller swings — a built-in rarity curve.
- **Spread orientation.** In any "reading"-style board mode (see the spreads idea),
  a card's slot can deal it upright or Molt, so position + orientation both matter.

---

## 6. Data schema

Each card gains a parallel reversed block and a molt art-direction block. The full
layer is delivered as per-set overlays keyed by card id — `data/reversals-major.json`,
`data/reversals-{cups,wands,swords,pentacles}.json`, and `data/reversals-aviary.json`
(84 entries total). Proposed shape:

```json
{
  "id": "major_19",
  "uprightMeaning": "Joy, clarity, success, vitality",
  "reversed": {
    "mode": "inward",
    "meaning": "Dimmed clarity, private or blocked joy, temporary gloom, over-optimism",
    "gameplayFantasy": "A muted-buff mode: smaller, self-only version of the radiant effect."
  },
  "molt": {
    "accentShift": "sun yellow -> drained ash-gold",
    "featherState": "scruffy, a few primaries shed and drifting",
    "lighting": "cold uplight instead of warm key",
    "borderState": "ember/ray filigree dimmed and frayed",
    "moltGlyph": "single shed gold feather in the cartouche"
  }
}
```

`uprightMeaning` simply aliases each card's existing `coreMeaning`; nothing in the
current files is lost — the reversed/molt blocks are additive.

---

## 7. Review checklist (Molt additions)

- Does the Molt read as the *same card* turned over, not a new illustration?
- Is the reversed meaning derived through one of the five modes, and tagged?
- Is the accent remapped to its correct molt counterpart (drained vs iridescent)?
- Is the light visibly inverted?
- Feathers shed/scruffy — and still no gore, no bare-skin shock, no harm?
- Title text unchanged (orientation marks the Molt, not the name)?
- For dark Majors: does the Molt lean toward **renewal/relief** where tradition does?

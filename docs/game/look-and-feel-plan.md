# Bird Squad Look-and-Feel Plan

Version: 0.1

Status: implementation plan for raising Bird Squad from "prototype" to "polished,"
derived from the look-and-feel review (spire-codex visual-language mining + a
code-level game-feel critique).

Related sources:

- `docs/game/next-level-implementation-spec.md` — the systems roadmap (now built).
- `docs/game/next-level-data-contracts.md` — the data layer (now built + consumed).
- `docs/art/art-bible.md` — visual identity and art direction.
- The spire-codex frontend was mined for VISUAL DESIGN TOKENS only (palette,
  typography, card framing). It is a data website — it has **no game feel** to
  offer; every "plays poorly" fix below is Bird-Squad-specific.

## The diagnosis

Two separable problems with separate fixes:

1. **It looks flat.** Arial on flat colored rectangles, ellipse enemies labeled
   `"RR"`, and — the worst offender — card art that **already loads** but is
   hidden behind opaque veil rectangles (alpha 0.62) in `renderHandCardArt` /
   `renderChoiceCardArt`. Cheap to fix; this is what spire-codex's tokens address.
2. **It plays flat.** Nothing animates, and the cause is architectural:
   `renderAll()` calls `this.root.removeAll(true)` on every state change
   (`src/main.ts` ~1645), which destroys any tween before it can play.

**Keystone:** a persistent FX layer that `renderAll()` never clears. Without it,
every juice fix is deleted on the next redraw; with it, the rest are easy.

## Guiding principles

- **Separate LOOK from FEEL.** The look pass needs no new architecture and lands
  in ~a day; the feel work is the real investment and depends on the FX layer.
- **Verify visually.** Every phase is checked with `tsc` + `vite build` + a
  Playwright screenshot of the affected screen (the project's standing method).
- **Patterns, not content.** Borrow spire-codex's design tokens (palette, type,
  framing); never its StS2 names/numbers/copy.
- **Two landmines.** (a) `assets/fonts/grindy-brush/Grindy Brush.otf` is
  PERSONAL-USE-ONLY and must not ship — pick an OFL/licensed face. (b) The
  immediate-mode redraw fights animation; the FX layer is the cheap down payment,
  a retained-mode refactor is the large long-term unlock (Phase G, optional).

## Design tokens (shared, define once)

Adopt the spire-codex recipe as Phaser constants used by every phase:

```ts
// Background ramp (depth from layering near-black, not bright fills)
PAGE = 0x0a1118; PANEL = 0x132028; PANEL_HOVER = 0x1a2b35;
BORDER_SUBTLE = 0x1e3040; BORDER_ACCENT = 0x2a4555;
// Accents (sparse, warm)
GOLD = 0xe8b830; GOLD_LIGHT = 0xfbd91e; RED = 0xc41e3a; TEAL = 0x45cfd8;
// Text ramp (hierarchy from weight + tint, not size jumps)
TEXT = '#e0ddd8'; TEXT_DIM = '#8a9298'; TEXT_MUTE = '#506570'; CARD_CREAM = '#fff6e2';
```

Suit/element identity (Plumes/Basins/Quills/Nests) is used **only** as a border
stroke + name/rarity text tint (60% at rest, full on hover/select); card bodies
stay neutral dark. Interaction grammar everywhere: idle = muted, hover = brighter
(~150 ms), active/selected = gold, focused card scales ~1.04.

---

## Phase A — Quick-win look pass (no new architecture)

Goal: kill the "flat rectangles + hidden art" read using assets that already
load. Lands in ~a day; biggest perceived-quality jump per hour.

| # | Item | Target | Effort |
| --- | --- | --- | --- |
| A1 | Define the design-token constants (above) | new `src/game/theme.ts` or top of `main.ts` | trivial |
| A2 | Un-veil card art (remove opaque veils, art alpha → 1.0, text behind a small ~0.5 gradient banner) | `renderHandCardArt`, `renderChoiceCardArt` | small |
| A3 | Rounded card frame + suit-color border (`fillRoundedRect`) replacing the flat `0x161b27` rect | `renderHand` | small |
| A4 | Cost badge as a recessed dark coin (filled circle in PAGE + thin border + gold number) | `renderHand` (cost circle) | small |
| A5 | Card metadata line: dot-separated, 3-tier text ramp, suit/rarity tint | `renderHand` / command strip | small |
| A6 | Shared `drawPanel()` helper (rounded + soft drop-shadow rect + 1px top highlight + border) applied to chips, command strip, flock, market/overlays | `renderChip`, `renderCommandStrip`, `renderFlock`, market | medium |
| A7 | Drop shadows behind hand cards | `renderHand` | small |
| A8 | Replace backdrop's two teal lines with a vignette/gradient | `renderBackdrop` | small |
| A9 | `"RR"` → enemy's first initial (interim, ungated) | `renderEnemyRow` | trivial |
| A10 | `cameras.main.fadeIn(200)` at the top of every scene `create()` | all scenes | small |

Acceptance: a battle screenshot shows full-bleed card art in rounded suit-bordered
frames with coin cost badges, layered panels with depth, a vignette backdrop, and
no `"RR"`. `tsc` + `build` clean.

---

## Phase B — FX foundation (the keystone)

Goal: make animation possible at all.

| # | Item | Target | Effort |
| --- | --- | --- | --- |
| B1 | Add `this.fxLayer = this.add.container(0,0)` in `BattleScene.create` alongside `this.root`; `renderAll()` clears **only** `this.root`. All transient juice spawns into `fxLayer` and survives the synchronous `renderAll()`. | `BattleScene.create`, `renderAll` (~1645) | small |

Acceptance: a tween spawned into `fxLayer` survives a `renderAll()` call (smoke
test: spawn a text, call `renderAll()`, assert it still exists). Depends on: none.
Unblocks: all of Phase C.

---

## Phase C — Combat juice (depends on B1)

Goal: make actions feel impactful. This is the heart of "plays well."

| # | Item | Target | Effort |
| --- | --- | --- | --- |
| C1 | Floating damage/heal/cover numbers (red=flock dmg, amber=enemy dmg, green=heal, blue=cover), tween up + fade in `fxLayer` | `damageFlock`, `damageEnemy`, `gainCover`/enemy block, heal paths | medium |
| C2 | Enemy hit flash (`setTint`) + short x-shake | `damageEnemy` | small |
| C3 | Flock-hit `cameras.main.shake(120, 0.004)` + screen-edge vignette pulse | `damageFlock` | small |
| C4 | Card-play motion: tween a card snapshot from hand to target, then resolve + `renderAll()` on complete | `playCard` | medium |
| C5 | Draw/discard card animations (scale/fade in/out) | `drawCards`, `moveCardFromHandToDiscard` | small |
| C6 | Impact/heal/death particles — reuse the `burstGoldFlecks` pattern from `MenuScene` (~367–426) | `fxLayer`, combat resolution | medium |
| C7 | Enemy attack telegraph + lunge/recoil on its turn | `resolveEnemyTurn`, `renderEnemyRow` | medium |
| C8 | Turn banner + "Rooftop cleared" banner between combat and reward | `endTurn`, `returnToRouteMap` | small |

Acceptance: playing an attack visibly flies the card to the enemy, the enemy
flashes/shakes, a damage number floats up, and a fully-blocked hit reads
differently from a big hit. Verified by screenshot mid-animation + manual run.

---

## Phase D — Typography (D2 gated on font choice)

Goal: remove the canonical "unstyled prototype" signal (Arial everywhere).

| # | Item | Target | Effort |
| --- | --- | --- | --- |
| D1 | Named text-style module (`titleStyle`/`headingStyle`/`bodyStyle`/`labelStyle`) replacing the 124 inline `fontFamily:'Arial'` refs; hierarchy from weight + the 3-tier text ramp | new text-styles module + all render methods | medium |
| D2 | Load a licensed serif (card names) + clean sans (HUD) pairing; cream card text with a layered-ring outline (8–16 offset copies); bake to a Phaser bitmap font for crisp small sizes | `index.html` `@font-face` / loader; card render | medium |

Acceptance: no `fontFamily:'Arial'` remains in render code; card names render in
the serif with a clean outline; HUD uses the sans. Decision required: which OFL/
licensed faces (Kreon-class serif + a sans). Do **not** use Grindy Brush.

---

## Phase E — Interaction grammar + transitions

| # | Item | Target | Effort |
| --- | --- | --- | --- |
| E1 | Interaction grammar pass: idle-muted → hover-brighter (~150 ms tween) → active/selected-gold; focused hand card scales ~1.04 | hover handlers across scenes | small |
| E2 | Scene fade transitions: wrap every `scene.start`/`scene.restart` in `fadeOut(180)` → `camerafadeoutcomplete` → start (pairs with A10's fadeIn) | all `scene.start/restart` sites | small |
| E3 | Inline icon glyphs for type/energy + a `[energy:N]`→pips tokenizer in ability text; dotted-underline + tooltip for keywords | card/ability text rendering; small icon atlas | medium |

Acceptance: hovering any interactive element brightens it smoothly; scene swaps
fade instead of hard-cut; ability text shows inline resource pips.

---

## Phase F — Enemy art (gated on asset production)

| # | Item | Target | Effort |
| --- | --- | --- | --- |
| F1 | (interim, already in A9) enemy initial instead of `"RR"` | `renderEnemyRow` | trivial |
| F2 | Per-enemy art pipeline: add an art key to `RuntimeEnemy` + the runtime manifest, produce/crop enemy sprites, load via `queueOptionalArtLoad`, render `this.add.image` instead of the ellipse; spread enemies across an x-range | `RuntimeEnemy` type, manifest, `renderEnemyRow`, `queueOptionalArtLoad` | large |

Acceptance: a Roof Rat and the Tar-Crowned Crow render as distinct sprites.
Decision/blocker: enemy sprites do not exist yet (only card art) — needs art
production before F2 can land.

---

## Phase G — Retained-mode refactor (optional, large, long-term)

Goal: the structural unlock that removes the redraw/animation tension entirely.

| # | Item | Target | Effort |
| --- | --- | --- | --- |
| G1 | Split `renderAll()` into a **stable** layer (enemy sprites, flock panel, hand cards as persistent containers keyed by `instanceId`, mutated in place) vs the transient `fxLayer`; tween values (HP-bar drains, hover lift, smooth number changes) instead of `removeAll`/recreate | `BattleScene` render architecture | large |

Acceptance: HP changes animate as a drain rather than snapping; hand cards lift on
hover without a full redraw. Only undertake if Phase C's FX-layer approach hits
limits — it is not required for a polished feel, just a cleaner foundation.

---

## Sequencing & rationale

1. **Phase A first** (look pass) — biggest perceived-quality jump per hour, no
   architecture, ships in ~a day, and makes the game presentable immediately.
2. **Phase B** (FX layer) — tiny but non-negotiable; gates all juice.
3. **Phase C** (combat juice) — the core "plays well" work; do C1–C3 first
   (damage numbers + flash + shake) for the biggest single feel jump.
4. **Phase D/E** (type + interaction) — raise production quality across all
   screens; D2 waits on a font decision.
5. **Phase F2** (enemy art) — high impact but blocked on asset production.
6. **Phase G** — optional; revisit only if the FX-layer approach proves limiting.

## Open decisions (needed from the owner)

- **Font choice** (D2): which OFL/licensed serif + sans? (Grindy Brush is
  personal-use-only and out.)
- **Enemy art** (F2): produce enemy sprites now, or ship with initials/glyphs and
  add art later?
- **Retained-mode refactor** (G): do it, or stay with `fxLayer` + selective
  animation? (Recommendation: defer until proven necessary.)

## Work-item count

26 discrete items: Phase A (10) · B (1) · C (8) · D (2) · E (3) · F (2 incl. the
interim) · G (1). By effort: ~2 trivial, ~14 small, ~8 medium, ~2 large. Quick-win
cluster (≈1 day): A1–A5, A7, A8, A9, A10. Gated: F2 (art), D2 (font).

## Verification

Each phase: `npx tsc --noEmit` + `npx vite build` clean, the existing
`npm run test:e2e` (9–10 Playwright smoke tests) still green, and a fresh
Playwright screenshot of the affected screen reviewed for the acceptance criteria
above. Add e2e assertions where behavior (not just pixels) changes — e.g. fxLayer
persistence, banner state.

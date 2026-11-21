# Visual spectacle and modern polish — November 16–17, 2026

Accepted scope: three lists from the conversation, each with "make all of it
happen":

1. **Visually stunning** (41 items): cards, combat feel, chrome, screens,
   enablers.
2. **Impact, coherence and effects** (45 items): combat impact, sound, theme
   coherence, effects, visual polish.
3. **Modern and polished** (50 items): layout, type, surface, motion,
   feedback, screens, onboarding, technical finish.

Baseline: `505e5a47` (Coherent City, PR #25). Work lives on two stacked
branches:

| Branch | PR | Contents | State |
| --- | --- | --- | --- |
| `codex/visual-spectacle` | #26 | Lists 1 and 2 | CI re-running on `c551ca21`; not merged or published |
| `codex/modern-polish` | none yet | List 3, this ledger | Local; stacked on #26 |

Constraints held throughout: canonical art, real rules, input ownership,
saved flights, the 700 KiB boot ceiling, Lean graphics and every motion and
flash preference. User edits in `AGENTS.md` are outside this change.

## Status vocabulary

- **Done:** built, covered by an automated check or inspected in captures.
- **Partial:** part of the item is built; the remainder is listed.
- **Not started:** nothing built for this item in this pass.
- **Reverted:** built, then removed for the stated reason.

Not one item has human, physical-device or real-GPU acceptance. Every capture
used software rendering with `?fx=full` forcing the shader passes on.

## List 1 — Visually stunning

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| 1 | Hand cards show the full illustration | Done | `render-hand.ts`; `card-pool-layout` now requires art to fill the card with a 90px clear window |
| 2 | Real typeface | Done | Barlow (UI) and Fraunces (display), SIL OFL; see Typography |
| 3 | Post-processing | Done | Bloom and grade on battle, title and route backdrops; hardware GL only |
| 4 | Living backdrop | Partial | Title and route: three depth layers drift with the pointer; birds cross, windows light and vents steam, per district (`life/backdrop-life.ts`). Battle keeps lamps, rain, fog and motes only |
| 5 | Less shading over the battlefield | Partial | Backdrop shade lightened; fixed enemy tint unchanged |
| 6 | Hand fan, hover lift, tilt | Done | The hand fans; the hovered card lifts and straightens while neighbours part; cards slide to new slots. Drawn only: card bounds and hit areas stay on the slot (`battle/actors.ts`) |
| 7 | Card frame, radius, shadow, cost coin | Done | |
| 8 | Rarity treatment | Done | Procedural frame per rarity on hand, reward and pile-inspect faces; ornament weight rises with rarity; rare and legendary carry a sweeping sheen (off under Reduced Motion and Lean graphics). Captures only at 1280×720 software GL |
| 9 | Upgraded cards look different | Done | Gilt inner frame; numbers the Preen changed are gilt, and damage or Cover numbers that current status raises or lowers are green or red. Rules text is not rewritten. Hand and inspector faces only |
| 10 | Deal and discard as card objects | Done | Drawn cards fly from the draw pile in a stagger; discards travel as themselves; cleared cards burn; pile counters tick as cards leave and arrive. The opening hand is dealt when the encounter intro clears. The shuffle keeps its card back |
| 11 | Playable and unplayable states | Done | Unplayable art desaturates; playable cards carry a suit halo |
| 12 | Large inspect view | Done | The reader shows the card at 1.5× with rules, glosses, rarity and flavor; it grows from the card's slot and returns to it |
| 13 | Hit-stop | Done | Contact freezes the actor clock for 2–4 frames (enemy, flock and hand bodies). Game logic, FX tweens and particles keep running |
| 14 | Camera punch and flash | Done | Follows Screen Shake and Flash Effects |
| 15 | Enemy death | Done | Defeat stagger plus feathers. Spawn verified; full playout not observed under the test harness |
| 16 | Status icons | Not started | |
| 17 | Contact shadows and rim light | Partial | Shadows already existed; no rim light |
| 18 | Normalise character scale | Not started | |
| 19 | Targeting arc | Done | |
| 20 | Surge as a set piece | Not started | A flash was tried on `combatFlowSurge`; it fires on every Flow gain, so it was removed |
| 21 | Intent icon badges | Not started | |
| 22 | Character frame animation | Not started | Needs art. Bodies are now retained, so frames can be swapped on a live object |
| 23 | One panel material | Partial | Every authored panel is rounded from one place; no texture or layered depth |
| 24 | Button bevel, glow, press depth | Done | `life/button-fx.ts` dresses every `quietButton`: lip, top light, hover and focus glow, and a press that sinks at draw time. Hit areas and labels untouched |
| 25 | HUD rebuild | Not started | |
| 26 | Letterbox atmosphere | Reverted | Doubled WebKit frame time; see Performance |
| 27 | Overlay blur and slide | Partial | Pause, settings, how to play and confirm rise and gather in over a slate scrim; rain no longer draws over them. No blur: see Performance |
| 28 | Wider icon use | Not started | |
| 29 | Animated numbers | Partial | Tabular figures only (list 3, item 10) |
| 30 | Outgoing transitions | Done | Wing wipe between menu, route and battle; a slower gold wipe into a new district. The scene change itself stays instant (`life/transitions.ts`) |
| 31 | Animated title | Done | Rain, glowing puddles and neon, bloom. No wordmark shimmer |
| 32 | District arrival card | Done | Full-screen title over the district painting, once per district per run, skippable. Not modal: see Rules changed |
| 33 | Boss entrance | Not started | Boss fights gain sheet lightning instead (list 2, item 32) |
| 34 | Route map life | Done | Flock marker that flies the chosen edge, pulsing reachable nodes, flown edges drawn as flight trails, node legend. No fog of war |
| 35 | Reward reveal | Not started | |
| 36 | Victory and defeat moments | Partial | Gold edge flash on victory; grey grade on defeat, never observed |
| 37 | Lighting across a run | Done | Dusk, night, night, dawn: route and battle paintings are graded continuously by district and nodes flown |
| 38 | Device-pixel-ratio rendering | Not started | Touches every screen's coordinates; belongs in its own change |
| 39 | Retained-mode battle rendering | Partial | Enemy bodies, the flock body and hand cards are retained actors with a logical slot and a visual pose. HUD, vitals, intent badges, shadows, reticles and overlays are still immediate-mode. See the runtime architecture doc |
| 40 | More particle systems | Done | Contact dressing in `spectacle/impact.ts` |
| 41 | Respect quality and motion tiers | Done | `tests/spectacle-stage.spec.ts` |

## List 2 — Impact, coherence and effects

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| 1 | Three beats per hit | Done | Crouch, dive or lunge, then a frozen contact frame and a recoil |
| 2 | Enemies react physically | Done | Wind-up, lunge toward the flock, recoil scaled by damage, stagger on a heavy hit |
| 3 | Feedback scales with damage | Partial | Body motion and hit-stop scale with the share of maximum Cohesion removed (heavy from 20%). Sparks and camera shake still use the fixed 8 |
| 4 | Finishing blows | Partial | Punch, gold flash and defeat stagger; no slow motion |
| 5 | Cover feels like armour | Done | Sparks on block; heavier sparks on shatter |
| 6 | Each suit strikes differently | Done | Plumes slash, Basins ripple, Quills volley, Nests thud |
| 7 | Card flies into the action | Done | The played-card cue is now the card, thrown on an arc from its slot to its target inside the existing resolve delay, then on to the discard pile. Reduced Motion and Lean keep the still cue |
| 8 | Telegraph enemy attacks on stage | Done | Danger line grows during the wind-up |
| 9 | Surge as a state | Not started | |
| 10 | Combo feedback | Partial | Audio only: pitch climbs on consecutive card plays within a turn. Not auditioned |
| 11 | Status effects have a body | Not started | |
| 12 | Animate characters | Partial | Whole-body motion on retained actors: breathing, dive, brace, lunge, recoil, stagger. No frame animation |
| 13 | Layered hit sounds | Done | Impacts now scale by damage share of max HP; Cover absorb and Cover break differ. Not auditioned; see [audio events](audio-events.md) |
| 14 | Recorded bird calls | Partial | Still no recordings. Synthesised stylised calls per suit and per Flock Leader stand in. Not auditioned |
| 15 | Duck music on big moments | Done | Heavy hits, finishing blows, stingers, boss entrances. Stems add on Surge, thin on Scatter, intensify for elites and bosses. Not auditioned |
| 16 | District ambient beds | Done | Continuous rain, canal, static-and-wires and high-wind beds; crossfade on district change; lower under the pause overlay only. Not auditioned |
| 17 | Material interface sounds | Partial | Paper, metal, wood, water, soft click and cancel are live. `ui.confirm` and `count.tick` have no call site yet. Not auditioned |
| 18 | One vocabulary (HP versus Cohesion) | Not started | 20 source strings and 3 test files involved |
| 19 | One lighting direction | Not started | |
| 20 | One frame material | Not started | |
| 21 | Tarot made visible in play | Not started | |
| 22 | Suit colour everywhere | Partial | Strikes and card halos |
| 23 | District identity kit | Partial | Per-district light, weather, ambient life and arrival card |
| 24 | Leader visual signature | Not started | |
| 25 | Consistent button wording | Not started | |
| 26 | Icons from the world | Not started | |
| 27 | Particle systems over single images | Done | |
| 28 | Feathers as signature debris | Done | |
| 29 | Effects light the scene | Done | Floor pool and air glow on contact |
| 30 | Screen-space distortion | Not started | |
| 31 | Marks left on the floor | Done | Up to 36 settled feathers per fight |
| 32 | Weather events | Done | Sheet lightning in boss fights; follows Flash Effects |
| 33 | Gains rise, damage falls | Done | Rising motes on heal and Cover |
| 34–45 | Visual polish repeats from list 1 | See list 1 | Fan 6, rarity 8, reward 35, HUD 25, plates 21, route 34, boss 33, arrival 32, scale 18, DPR 38, foreground depth (not started), outcomes 36 |

## List 3 — Modern and polished

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| 1–7 | Layout and hierarchy | Not started | Each changes positions or wording locked by tests; needs deliberate contract revision |
| 8–9 | Type scale and hierarchy | Not started | |
| 10 | Tabular figures | Done | Frozen into the UI faces by `tools/build-ui-fonts.py` |
| 11–12 | Line length; replace ASCII conventions | Not started | |
| 13–16 | Layered panels, elevation, accents, overlay blur | Not started | Needs one shared panel component across ~550 call sites |
| 17 | Film grain | Done | Hardware GL only; see Performance |
| 18 | Contrast in context | Not started | |
| 19–23 | Transitions, easing, stagger, numbers, bar trails | Partial | Transitions and staggered list entrances are built as draw-time poses, which leave the geometry and opacity tests read untouched. Numbers and bar trails not started |
| 24 | Pressed, hover and focus states | Done | See list 1, item 24 |
| 25–26 | Continuity transitions; motion-reduced cross-fades | Not started | |
| 27–33 | Feedback and micro-interactions | Not started | Includes drag-to-play and haptics, which are new features |
| 34 | Loading state | Partial | Boot screen in the game's palette and title treatment |
| 35–41 | Screens and flow | Not started | |
| 42–44 | Onboarding and iconography | Not started | |
| 45 | Device-pixel-ratio rendering | Not started | Same as list 1, item 38 |
| 46 | Steady frame rate | Partial | WebKit regression found and removed; grain and filters gated |
| 47–49 | Preloading, breakpoints, photo mode | Not started | |
| 50 | Page around the game | Partial | Description, theme colour and social preview tags |

## Typography

Interface text uses **Barlow** (500 and 700) and titles use **Fraunces** (400,
700, 400 italic), self-hosted from `assets/fonts/ui/` with their licences.
`tools/build-ui-fonts.py` rebuilds them from the Fontsource latin subsets:

- Vertical metrics copy Arial (UI) and Georgia (display), the faces every
  authored layout was measured against.
- Tabular figures become the default digits, because canvas text cannot
  request OpenType features.

Phaser sizes each text line by scanning rendered glyphs, so new outlines still
shifted line heights by a pixel either way. `keepAuthoredLineMetrics` in
`spectacle/stage.ts` gives text set in these faces the line metrics of its
system fallback while drawing the new glyphs. Advance widths come from the face
actually drawn.

Boot waits for the faces, capped at 1.5 seconds.

## Performance

Measured in Playwright on Windows, battle with three enemies, 90 frames.
WebKit reports its renderer as "Apple GPU" even when rendering in software.

| Build | WebKit frame median | Chromium (SwiftShader) frame median |
| --- | --- | --- |
| `main` (`505e5a47`) | 31 ms | 29 ms |
| #26 with letterbox gradient | 70 ms | 38 ms |
| #26 after removing the gradient (`c551ca21`) | 32 ms | 37 ms |
| `modern-polish` with ungated film grain | 32 ms | 64 ms |
| `modern-polish` with gated grain | 35 ms | 36 ms |

Details and the bisection are in `docs/project/performance-notes.md`.

Boot code stays at 698.7 of 700 KiB; all new presentation is lazy. Budgets
raised deliberately: hand renderer 10 to 12 KiB, hand plus reward allowance
24 to 26 KiB, new `spectacle` chunk capped at 24 KiB (17.1 KiB measured).

## Rules changed

- `card-pool-layout`: art must fill the card and keep an unobstructed window of
  at least 90px, rather than sit beside the text.
- Art bible, combat effects: the core presenter still owns each impact, and
  contact dressing may now add suit shapes, feathers, ripples and a defeat
  stagger on separate layers. This reverses the earlier "no second set of suit
  particles, portrait echoes, replacement bodies or ground ripples" rule, at the
  owner's request in list 2.

- Route layout: the graph starts below the banner row (`top` 146 to 177,
  `bottom` 638 to 647, `left` 88 to 104) so a four-lane column clears the
  header; the Flyway bar moved from the lower left of the graph to the header
  row; the "Here"/"Selected" label sits 8px closer to its medallion.
- The district arrival card is a picture, not a modal. It owns no input: any
  key or click dismisses it and also reaches the route beneath. Making it
  modal would put an extra dismissal in front of every route flow.
- Pause and confirm scrims changed from `0x020409` at 0.9 to slate `0x0a121c`
  at 0.84.

## Scene life (November 19–20)

`src/game/spectacle/life/` is a second lazy chunk (`scene-life`), loaded by the
stage and applied from outside the scenes. Two techniques keep it invisible to
game logic and to tests that read geometry between frames:

- **Draw-time poses** (`kit.ts`, `renderPose`): an entrance offsets an object
  only inside its own draw call and restores it before returning, the way
  Phaser's container renderer treats children. Position, alpha, bounds and hit
  areas are final from the first frame. Overlay entrances, list staggers,
  button presses, parallax and the light grade all use it.
- **Clock functions**: the route and battle scenes destroy and redraw
  everything on each state change, so nothing here is a tween. Pulses, the
  flock's idle motion, birds, steam and the arrival card are functions of a
  scene stopwatch that `advanceTime` drives, rebuilt on demand.

Exit transitions do not delay a scene change. The outgoing frame is drawn once
into a texture when `scene.start` is called; the next scene starts at once and
the picture is wiped off it behind the wing.

Route scene frame time, Playwright on Windows, 90 frames, district 1 with the
arrival card dismissed. Other agents were building on the same machine, so
treat single steps of the 16.7 ms Chromium vsync grid as noise.

| Build | WebKit 1280×720 | WebKit 1024×600 | Chromium (SwiftShader) 1280×720 | Chromium 1024×600 |
| --- | --- | --- | --- | --- |
| Before (`53c72619`) | 36 ms | 33 ms | 33 ms | 50 ms |
| With scene life | 37 ms | 36 ms | 50–67 ms | 50 ms |

Hiding layers one at a time on Chromium (150-frame means): everything 50–58 ms,
without the life layer 45–46 ms, also without the stage's rain and fog
36–38 ms. So the new backdrop life costs about 5 ms of software rendering and
the weather that was already there about 10 ms. On WebKit the same steps all
measured 36–44 ms with no trend. Overlay blur was not built or measured: a
blur is a full-screen shader pass like bloom, which is already gated off
software renderers, and the route draws overlays into the same display list as
the scene, so there is no separate layer to blur.

Boot code is 703.9 of 708 KiB (was 703.0 before this work, 703.8 after the
audio merge). New budget: `scene-life` 30 KiB (25.5 measured). Raised for
import-rename drift of a few bytes: `run-hud` 10 to 10.25, `route-reward-overlay`
6 to 6.25; `route-map-renderer` 5 to 5.5 for its calls into route life.

Known limits: the outgoing picture is only captured when `scene.start` is
called inside a game step (drawing to a texture between frames corrupts the
WebGL batch in production builds), so changes made from DOM handlers get the
wing without the picture. The Flight Stories/Strategy DOM button draws over
the arrival card. List staggers cover title rows, node options, contract
options, market offers and route card rewards; battle rewards are untouched.

## Failures retained during development

- The first full CI run failed six tests: hover lift moved card bounds the
  forecast and touch-separation contracts read; the halo occupied the reserved
  selection-pulse map; new glyphs shifted line heights by a pixel. All fixed.
- A second run failed `hand-art-retry`: the hover lift was still moving bounds.
  Hover now changes light only.
- WebKit qualification hit its 45-minute limit three times on the letterbox
  gradient before the cause was found.
- Two smoke tests (`outcome flight codes…`, `codex: leaders tab…`) failed once
  in CI and passed three times locally. Both read the lazily loaded menu
  diagnostics; treated as flaky, not fixed.
- High Roost was first given rain, contradicting the art bible's clear summit.
  Corrected on `codex/modern-polish`.

## Verification evidence

- `npm run validate`: all validators and 75/75 sequencing tests, on each slice.
- `tests/spectacle-stage.spec.ts`: own layer, Reduced Motion, Lean,
  software-renderer gating, full-portrait cards, hover without movement.
- Re-run locally after fixes: `card-pool-layout`, `rooftop-polish-pilot`,
  `hand-readability`, `large-hand-polish`, `enemy-cluster-layout`,
  `gameplay-clarity`, `event-navigation-polish`, `hand-art-retry`,
  `ui-token-contract` and the hand-selection smoke test.
- Captures inspected: title, route, one- and three-enemy battles, a card play,
  a kill, and reward screens, at 1280×720 with `?fx=full`.

## Retained actors — November 19–20, 2026

`renderAll()` used to destroy every combatant and card on each state change,
so nothing could hold a motion. Enemy bodies, the flock body and hand cards
are now retained actors on one stage (`src/game/battle/actors.ts`).

- Each actor has a logical slot (layout, bounds, hit area) and a visual pose
  (offset, scale, tilt, flash). Animation writes only the pose.
- Hand cards keep their logical transforms at all times; the pose is applied
  while the card is drawn. That is why the hover lift that failed in the first
  pass (see Failures) now ships without touching a layout contract.
- One actor clock follows scene time and the manual `advanceTime` test clock,
  scales with Animation Pace, stops for Reduced Motion and freezes for
  hit-stop. Stagger judder follows Screen Shake; the hit flash follows Flash
  Effects.
- Still immediate-mode: the HUD, vitals and intent badges, contact shadows,
  target reticle, selection preview, pager and every overlay.

Specs changed: `spectacle-stage` (hover now lifts the drawn card; bounds and
selection must still not change), `p0-encounter-catalog` (the click target is
the slot-owned `combat-enemy-hit`, not the animated portrait). New:
`tests/retained-actors.spec.ts`.

## Open handoff

- Merge #26 when CI is green, then open `codex/modern-polish` as its own PR.
- Decide whether the reversed effect-ownership rule stands.
- Check bloom, grain and frame rate on real GPUs, including Safari on Mac.
- Remaining items above, starting with device-pixel-ratio rendering and the
  rest of the retained-mode work (vitals and HP drains as retained objects,
  deal and discard as card actors), each as its own change.

## Cards as objects — November 20, 2026

Scope: the hand and card presentation only. Enemy and flock bodies, status and
intent badges, the HUD and set pieces were left alone.

| Item | Status | Notes |
| --- | --- | --- |
| Card flight on play | Done | List 2 item 7. Lands as the unchanged resolve delay ends. The thrown card is drawn in `fxLayer`, which sits under the hand, so for its first frames it passes behind neighbouring hand cards |
| Deal and discard as objects | Done | List 1 item 10. The opening hand is dealt once the encounter intro has cleared (its counter is not ticked: the pile already shows the settled count). The shuffle still uses one stand-in card back |
| Drag to play | Done | Mouse and touch. Coexists with click-select-then-confirm and keyboard or controller; a stray click still only selects. A press on a card that is already selected still plays it at once, as before, so a drag has to start on an unselected card |
| Rarity frames | Done | List 1 item 8 |
| Number highlights | Done | List 1 item 9. Reward and pile faces are not tinted |
| Large inspect view | Done | List 1 item 12 |
| Unplayable feedback | Done | Refusal shake on the card; the reason line is the existing "Cannot play" notice ("Needs 1 more Wingbeat.") and the sound is the existing `locked` cue. No new audio event |

Tests changed because the behaviour changed:

- `identity-continuity` (card cue clearance): the cue used to wait in a pocket
  beside the leader; it now flies from the hand to the target, so the check is
  that it never enters the top bar and that where it lands it covers no enemy
  label and no other combatant.
- `pile-motion-continuity` and three `smoke` expectations: draws, discards and
  returns are the real cards, so only the shuffle still creates a
  `combat-pile-transfer` card back.
- `retained-actors`: its setup now advances the clock past the opening deal, so
  each check still starts from cards at rest.

No readability, overlap or touch-target assertion was changed.

Not verified: human play, a physical touch device (touch was driven through
CDP touch events), real-GPU rendering, WebKit and Firefox, and how the sheen
and burn read at speed. No new sound was auditioned because none was added.

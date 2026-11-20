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
| 4 | Living backdrop | Partial | Lamps, beacons, rain, splash rings, fog, motes. No parallax or crossing birds |
| 5 | Less shading over the battlefield | Partial | Backdrop shade lightened; fixed enemy tint unchanged |
| 6 | Hand fan, hover lift, tilt | Done | The hand fans; the hovered card lifts and straightens while neighbours part; cards slide to new slots. Drawn only: card bounds and hit areas stay on the slot (`battle/actors.ts`) |
| 7 | Card frame, radius, shadow, cost coin | Done | |
| 8 | Rarity treatment | Not started | |
| 9 | Upgraded cards look different | Partial | Gilt inner frame. Changed numbers are not highlighted |
| 10 | Deal and discard as card objects | Not started | Existing pile motion retained |
| 11 | Playable and unplayable states | Done | Unplayable art desaturates; playable cards carry a suit halo |
| 12 | Large inspect view | Not started | |
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
| 24 | Button bevel, glow, press depth | Partial | Rounded, plus a brief press dip on shared buttons |
| 25 | HUD rebuild | Not started | |
| 26 | Letterbox atmosphere | Reverted | Doubled WebKit frame time; see Performance |
| 27 | Overlay blur and slide | Not started | |
| 28 | Wider icon use | Not started | |
| 29 | Animated numbers | Partial | Tabular figures only (list 3, item 10) |
| 30 | Outgoing transitions | Partial | Arrival light sweep on every scene; no exit transition |
| 31 | Animated title | Done | Rain, glowing puddles and neon, bloom. No wordmark shimmer |
| 32 | District arrival card | Not started | |
| 33 | Boss entrance | Not started | Boss fights gain sheet lightning instead (list 2, item 32) |
| 34 | Route map life | Partial | Light rain, bloom, lighter panel. No flock marker or fog of war |
| 35 | Reward reveal | Not started | |
| 36 | Victory and defeat moments | Partial | Gold edge flash on victory; grey grade on defeat, never observed |
| 37 | Lighting across a run | Not started | Per-district plans exist but do not progress |
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
| 7 | Card flies into the action | Not started | |
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
| 23 | District identity kit | Partial | Per-district light and weather plans |
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
| 19–23 | Transitions, easing, stagger, numbers, bar trails | Not started | Fades change opacity during frames that geometry tests read |
| 24 | Pressed, hover and focus states | Partial | Press dip on shared buttons |
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

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
| 16 | Status icons | Done | Procedural icon badges (`battle/combat-life.ts`): Cover, Winded, Ruffled, Fouled, Open Sky, Open Sky Guard, Molt and Resonance with stack numbers in a row by the flock; Cover and Winded icons beside each enemy's status text when they fit. The text stays as it was for `render_game_to_text`, tooltips and tests. Retained per enemy, so a redraw does not flicker |
| 17 | Contact shadows and rim light | Partial | The targeted enemy's ambient tint brightens and pulses (rim light). No scale lift: the breathing envelope is fitted to the HUD and label clearance, and a lift would cross it |
| 18 | Normalise character scale | Not started | |
| 19 | Targeting arc | Done | |
| 20 | Surge as a set piece | Done | Fires on the transition into Surging only: cyan screen-edge glow, the flock rises, a short SURGE title above the flock and the Leader's flourish. 1.1 s, skippable by any input |
| 21 | Intent icon badges | Done | Attack, defend, buff, debuff and unknown icons in the free left margin of each Tell badge; hidden rather than squeezed when the text fills the badge |
| 22 | Character frame animation | Not started | Needs art. Bodies are now retained, so frames can be swapped on a live object |
| 23 | One panel material | Partial | Every authored panel is rounded from one place. One shared panel helper (`ui-panel.ts`: scrim, frame, header, body, footer actions) now draws the route reward overlay and the loading card; other overlays not migrated |
| 24 | Button bevel, glow, press depth | Done | `life/button-fx.ts` dresses every `quietButton`: lip, top light, hover and focus glow, and a press that sinks at draw time. Hit areas and labels untouched |
| 25 | HUD rebuild | Not started | |
| 26 | Letterbox atmosphere | Reverted | Doubled WebKit frame time; see Performance |
| 27 | Overlay blur and slide | Partial | Pause, settings, how to play and confirm rise and gather in over a slate scrim; rain no longer draws over them. No blur: see Performance |
| 28 | Wider icon use | Partial | Procedural route node signs and suit sigils (`world-glyphs.ts`); see Presentation polish |
| 29 | Animated numbers | Done | Cover, Wingbeats, Scrap and Flow roll to their new value with `count.tick` per step (≤ 420 ms). The real HUD text is exact at once and hidden while an overlay rolls over it. Damage numbers pop by the share of the target's maximum |
| 30 | Outgoing transitions | Done | Wing wipe between menu, route and battle; a slower gold wipe into a new district. The scene change itself stays instant (`life/transitions.ts`) |
| 31 | Animated title | Done | Rain, glowing puddles and neon, bloom. No wordmark shimmer |
| 32 | District arrival card | Done | Full-screen title over the district painting, once per district per run, skippable. Not modal: see Rules changed |
| 33 | Boss entrance | Done | Once per boss per fight, after the encounter intro: a name card and a 3% camera push, 1.4 s, skippable. No push under Reduced Motion |
| 34 | Route map life | Done | Flock marker that flies the chosen edge, pulsing reachable nodes, flown edges drawn as flight trails, node legend. No fog of war |
| 35 | Reward reveal | Done | Combat and route card rewards are dealt face down and turn over in order with a rarity glint; any input skips. Draw-time only; see Presentation polish |
| 36 | Victory and defeat moments | Done | Gold light sweep and falling feathers over the reward screen; dark vignette and grey feathers over the defeat report. The outcome state is immediate; the beat is layered and holds no input |
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
| 3 | Feedback scales with damage | Done | Body motion, hit-stop, sparks, motes, camera shake and damage-number pop all scale with the share of maximum Cohesion removed (`hitWeight`, heavy from 20%). Audio cue choice is unchanged |
| 4 | Finishing blows | Done | The killing hit slows the actor clock to 30% for 320 ms on top of a 4-frame hit-stop, with a larger ring and shard burst. Game timers are untouched |
| 5 | Cover feels like armour | Done | Sparks on block; heavier sparks on shatter |
| 6 | Each suit strikes differently | Done | Plumes slash, Basins ripple, Quills volley, Nests thud |
| 7 | Card flies into the action | Done | The played-card cue is now the card, thrown on an arc from its slot to its target inside the existing resolve delay, then on to the discard pile. Reduced Motion and Lean keep the still cue |
| 8 | Telegraph enemy attacks on stage | Done | Danger line grows during the wind-up |
| 9 | Surge as a state | Partial | Entry set piece only (list 1, item 20); no persistent Surge look |
| 10 | Combo feedback | Done | A CHAIN ×N chip from the second card of a turn; it grows and shifts hue with the chain and clears on Roost. Audio pitch ladder unchanged |
| 11 | Status effects have a body | Done | Cover: shield plates in front of the flock and a shimmer on a covered enemy; Winded: slower, drooping breath; Ruffled: jitter (Screen Shake on); Molt: feathers drift off and the flock shifts violet. No particles under Lean graphics, no motion under Reduced Motion |
| 12 | Animate characters | Partial | Whole-body motion on retained actors: breathing, dive, brace, lunge, recoil, stagger. No frame animation |
| 13 | Layered hit sounds | Done | Impacts now scale by damage share of max HP; Cover absorb and Cover break differ. Not auditioned; see [audio events](audio-events.md) |
| 14 | Recorded bird calls | Partial | Still no recordings. Synthesised stylised calls per suit and per Flock Leader stand in. Not auditioned |
| 15 | Duck music on big moments | Done | Heavy hits, finishing blows, stingers, boss entrances. Stems add on Surge, thin on Scatter, intensify for elites and bosses. Not auditioned |
| 16 | District ambient beds | Done | Continuous rain, canal, static-and-wires and high-wind beds; crossfade on district change; lower under the pause overlay only. Not auditioned |
| 17 | Material interface sounds | Partial | Paper, metal, wood, water, soft click and cancel are live. `count.tick` ticks rolling HUD counters; committing shared buttons now play `ui.confirm` (see Presentation polish). Not auditioned |
| 18 | One vocabulary (HP versus Cohesion) | Not started | 20 source strings and 3 test files involved |
| 19 | One lighting direction | Not started | |
| 20 | One frame material | Not started | |
| 21 | Tarot made visible in play | Partial | Suit sigil and roman numeral on reward faces (combat and route) and in the Codex dossier. Hand faces untouched |
| 22 | Suit colour everywhere | Partial | Strikes and card halos |
| 23 | District identity kit | Partial | Per-district light, weather, ambient life and arrival card |
| 24 | Leader visual signature | Done | Each Leader has a flourish in their Codex accent on Surge entry and on their signature trigger: Fledgling spiral, Spark-Caller arcs, Talon slashes, Tidewarden ripples, Roostkeeper ward |
| 25 | Consistent button wording | Not started | |
| 26 | Icons from the world | Partial | Route map and legend: claw marks, crew shield, crown, lantern, wrench, stall awning, mast, crate. Not yet on other screens |
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
| 13–16 | Layered panels, elevation, accents, overlay blur | Partial | The shared panel component exists (`src/game/ui-panel.ts`) and draws two overlays; migration of the rest is opportunistic. No blur |
| 17 | Film grain | Done | Hardware GL only; see Performance |
| 18 | Contrast in context | Not started | |
| 19–23 | Transitions, easing, stagger, numbers, bar trails | Done | Transitions and staggered list entrances are draw-time poses. Numbers roll (list 1, item 29); Cohesion and enemy bars drain with a lighter ghost that catches up after 420 ms while the real fill stays exact |
| 24 | Pressed, hover and focus states | Done | See list 1, item 24 |
| 25–26 | Continuity transitions; motion-reduced cross-fades | Not started | |
| 27–33 | Feedback and micro-interactions | Not started | Includes drag-to-play and haptics, which are new features |
| 34 | Loading state | Done | Boot screen in the game's palette; route and battle readiness screens stay dark for 250 ms, then show a panel with the flock crossing and a progress bar |
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

## Engagement outside combat (November 20)

Four features around the run, none of them in `battle-scene.ts` or
`src/game/battle/` (another change owns battle rendering). Scenes and pure
logic are in `src/game/engagement/`, one lazy chunk (`engagement`, 27.9 KB)
that the title requests after it has drawn; narrative copy is its own chunk
(`narrative-threads`, 10.4 KB) beside the arrival card. Boot grew 0.8 KB
(703.9 to 704.7 KB of the 708 KB cap): the unlock-queue append, three title
focus hooks and one import.

| Feature | State | What exists |
| --- | --- | --- |
| Daily Flight | Done | Title entry (keyboard, controller, pointer) opening `DailyFlightScene`: the date, the day's Leader, today's best, up to four earlier days, the score rule, and Fly/Back. The seed is `daily-YYYYMMDD` from the local calendar date; the Leader is `hashSeed(seed) % 5` over the whole roster, locked or not. Bests (score, districts, result, Leader, attempts) are kept per date in `birdsquad.daily` through the journaled storage helper, folded in from the flight log on each title visit, so no battle hook is needed and nothing is counted twice. Local only. |
| Run recap | Partial | `RecapScene` reads any flight from the existing flight log (`birdsquad.runs`): Leader, districts cleared, fights won, damage dealt and taken, biggest fight, top card, deck size, cards added, Waymarks, time, score, and a closing line. Older/Newer page the log. Photo view hides every control and enlarges the card over the district painting; Save PNG snapshots that view (1280x720) and downloads it. Card rises in and numbers count up on the scene clock; Reduced Motion fades and shows final numbers. **Missing:** it opens from the title (Flight Recap, with a gold mark until the newest flight has been read), not from the outcome screen, which is battle code. Best single hit is not recorded by combat, so the card shows the biggest fight and the top card instead. |
| Collection ceremony | Done | Unlocks are queued where they happen: `recordRun` (Leaders, achievements) and the first claim of a non-starter card. `CeremonyScene` shows them once, on the title or the Collection, whichever comes first: the card flips in, with its name and one line of why. Leaders, then achievements, then at most three cards; the third stands in for the rest. Any key, click or controller button moves on; Back skips the rest. |
| Narrative threads | Partial | `narrative-content.ts`: five Leaders, four districts, four arrival lines each (80), plus three win and three loss closings per Leader (30). Picked by run seed. The arrival line is on the district arrival card, under the premise; the card holds 3.4 s instead of 2.6 s when it has one, and still owns no input. The closing line is on the recap card. **Missing:** the closing line is not on the outcome screen (battle code). |

Decisions that are not obvious from the code:

- **The ceremony is modal; the arrival card is not.** Existing overlays own
  input exclusively, so the reveal follows them. It runs as its own scene
  above the title or Collection and switches that scene's pointer, keyboard
  and gamepad plugins off while it is up, then back on after the step in
  which it closed. The key that dismisses a reveal therefore never reaches
  the screen underneath. The Flyway DOM launcher treats a scene whose
  keyboard is off as busy and hides.
- **Queue, not diff.** Reveals come from events, not from comparing the
  account with a "seen" list, so restoring a backup or seeding storage never
  produces a ceremony for things the player already had.
- **The score is small enough to check by hand:** 1,000 per district cleared
  and 150 per fight won; a completed flight adds 2,000, 20 per Cohesion kept
  and a pace bonus of 900 minus 6 per beat (never below zero). It has no
  Ascension term because Daily Flight is always Standard.
- **Daily Flight replaces a saved flight only from its own screen,** which
  says so first. If the saved flight is today's, the button continues it.
- **Title focus order is appended to,** not reordered: Daily Flight and
  Flight Recap come after Flock Record, so every existing Tab sequence holds.

What the daily seed fixes, and what it does not: the district maps, node
contents, encounters, enemy openings, draw order, encounter objectives, reward
drafts, Waymark and Preen rolls, district contracts, cache outcomes and market
stock all derive from the run seed, so two players making the same choices see
the same flight. Reward and market draws also mix in the deck, Waymarks,
supplies, Cohesion and Scrap at that moment, so flights diverge once choices
do. Not from the seed: visual effect jitter, and anything a player carries in
from their own profile (Flight Story plans and medals were not audited).
Nothing prevents replaying a date's seed through a shared-route link on
another day; it counts toward the date in the seed.

Battle hooks this needs, none made here:

1. Outcome screen: a Flight Recap action calling
   `openRunRecap(scene, { runId: summary.id, returnTo: 'MenuScene' })` from
   `src/game/engagement`, so the recap follows a run directly.
2. Outcome screen: show `closingLine(seed, leaderId, result, districtName)`
   under the title, and the Daily Flight score when the seed is a daily one.
3. Combat: record the best single hit in `CombatResultSummary` (and keep it in
   `sanitizeCombatResults`) so the recap can show it.

Not built: an online leaderboard (out of scope), Daily Flight bests and the
unlock queue in save backups (they are cleared with the profile, and bests
rebuild from an imported flight log), a recap entry in the Flock Record's
flight history, and reveals for contract badges or Collection milestones.

Checks: `tests/daily-flight.spec.ts`, `tests/run-recap.spec.ts`,
`tests/collection-ceremony.spec.ts`, `tests/narrative-threads.spec.ts`
(14 tests) and four unit files (37 tests) under `src/game/engagement/` and
`src/game/narrative-threads.test.ts`. Captures of each screen were inspected
at 1280x720 with software rendering. No human, controller-hardware or
real-GPU acceptance; the controller checks use the Gamepad API fixture.

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

## Presentation polish — November 20, 2026

Seven presentation items, all layered over existing layouts. None of it lives
in `battle-scene.ts` beyond naming four readiness-screen objects; the route
scene gained the same four names and a `cardId` on its reward art.

| Item | Status | What exists |
| --- | --- | --- |
| Reward reveal | Done | `spectacle/life/reward-reveal.ts` (own chunk). Combat and route card rewards are dealt face down from below the screen, turn over left to right (a horizontal-scale flip about each card's centre) and a band of light in the card's rarity colour crosses each face. About 1.2 s at standard Animation Pace; Reduced Motion fades the faces up in order; Lean graphics shows them at once. Any pointer, key or controller button skips to the settled screen. Input is read at the window and never consumed, so the first click on a card still only arms it. Preen picks and Waymark rewards are not revealed. Every pose is applied at draw time: bounds, alpha, scale and hit areas are final from the first frame |
| Tarot presentation | Done | `tarot-rules.ts` (pure) and `world-glyphs.ts`. A cartouche with the suit sigil (plume, basin, quill nib, woven nest; a compass rose for majors and the Aviary arcana) and the roman numeral sits over the top of the art on combat and route reward faces and beside the Codex dossier kicker. Majors carry their number (0 for First Flight), minors their rank, courts XI–XIV (Fledgling, Outrider, Matron, Elder). Snags carry none. Hand faces are untouched (another change owns them) |
| World icons | Done | Procedural signs drawn once per size into 2x canvas textures: claw marks (fight), crew shield (rival), crown (boss), lantern (roost), wrench (nest workshop), stall awning (market), mast (signal), crate (cache). A sign sits on each node medallion's upper right (24px, 28px for the boss) and replaces the painted miniatures in the legend (28px). At 1000×560 they are 19–22 CSS px. Node hit areas are unchanged |
| Shared panel | Partial | `ui-panel.ts`: scrim, frame (shadow, accent rail, corner brackets), eyebrow/title/subtitle header, body rectangle and footer actions built from `quietButton`, with a pure `panelLayout`. Used by the route reward overlay (replacing `renderFieldPanel` there) and the loading card. Other overlays were not migrated |
| Loading screens | Done | `spectacle/life/loading.ts` (own chunk). While a route or battle readiness screen is up, its medallion and copy stay hidden for 250 ms of wall time; after that a panel shows the screen's own title and line, five birds crossing in a V and a progress bar driven by the readiness groups still pending. Fast loads never show it. Scene start for a lazily loaded BattleScene is not covered: that loader belongs to the platform change |
| Bark lines | Done | `data/game/barks.json` and `src/game/barks/` (own chunk, requested when a fight opens). Five Leaders and nine enemy families (corvid, pigeon, raptor, gull, canal, night, vermin, a generic crew and bosses), three to four lines per trigger: opening, heavy hit (20% of maximum Cohesion or enemy health), Cohesion under 30%, a defeat (the enemy's last word or the Leader's quip, by seeded coin) and a boss phase turn. Lines are drawn from per-speaker decks shuffled by the flight seed; a pool is exhausted before any line repeats and a pass never opens on the line the last one closed. Tags hold 1.5 s scaled by Text Pace and are off under Fast. A tag is placed above, beside or below its speaker only where it touches no visible text, panel, control, HUD element or small icon; with no clear spot the line is dropped. Hidden under the inspect reader, drawers, pause and settings |
| UI confirm sound | Done | `quietButton` classifies its current label (`button-cue.ts`): commit words (confirm, select, buy, claim, start, take, fly, skip, save…) or a primary action without a navigation word play `ui.confirm`; back, close, cancel, read, inspect, filters and tabs keep the soft click. Done in the shared helper, so it covers every `quietButton` and `decisionButton` (about 100 call sites) without touching them |

Not covered: keyboard and controller shortcuts that call an action directly
rather than through the button still play the soft click; buttons built
outside `quietButton` (the Codex grid, the title rows) are unchanged.

Chunks (all lazy, budgets added): `reward-reveal` 7.2 KB, `scene-loading`
2.9 KB, `barks` 15.8 KB, `world-glyphs` 6.7 KB, `ui-panel` 2.3 KB.
`scene-life` stays at 28.2 of 30 KB. Boot code 702.8 to 704.0 of 708 KB: the
button cue classifier, the `quietButton` hook and the readiness names.
`debug-state` budget 10 to 10.25 KB for import-rename drift (10.02 KB).

Checks: `tests/presentation-polish.spec.ts` (11 tests) and unit files for
the button cue, tarot rules, reveal timeline, panel layout and bark rules.
No existing assertion was changed. The opening barks wait 0.7 s after the
intro clears: placing a tag at that instant delayed the opening deal and
failed `card-objects` ("dealt ... only once"). `reward-checkpoint` (boss
reward resume, four tests) and `route-decision-polish` (Details, two tests)
fail identically on the base commit `0d58b2ee` without these changes.

Not verified: human play, real GPUs, WebKit and Firefox, physical touch and
controllers, and whether `ui.confirm` on every commit reads well by ear.

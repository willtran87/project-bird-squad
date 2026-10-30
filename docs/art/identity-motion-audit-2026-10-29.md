# Identity and combat motion audit — 2026-10-29

Requested after recent batches introduced inconsistent identities and clutter.
Status: corrections implemented and locally verified on `codex/identity-motion-audit`.
This audit has not been published to GitHub Pages.

## Findings and corrections

| Finding | Evidence | Correction |
| --- | --- | --- |
| Spark-Caller changed species appearance during actions. | Both Living Battles sheets depict a crested blue bird; `leaders.ts`, lore and original portraits specify a Lilac-breasted Roller with turquoise/lilac plumage. | Retire both sheets. Keep the exact original combat texture throughout the action. |
| Caldra was conflated with the rival Captain. | Atlas row 6 and performance metadata called the jackdaw Caldra; the September resident correction establishes Caldra as a peafowl. | Captain keeps canonical jackdaw art/ID. Caldra remains the peafowl patron in the wager/journal. |
| All five leader rows changed silhouette, proportions, wardrobe detail and facing from idle art. | Atlas replacement hid the original and inserted a differently scaled cutout with independently measured cells and a new foot anchor. | Animate one original body in place; no atlas frame swap, scale change, facing change or duplicate body. |
| Multiple presentation systems competed for one action. | Moving card, atlas Leader, two hard-coded supporting Leaders, suit bursts, identity effects and translucent opening reactions had independent lifetimes. | Remove unassigned supporting bodies, atlas bodies, fallback cameos, duplicate suit bursts and portrait echoes. Calls/combinations/reactions share the existing feedback lane. |
| Commitment banner competed with its own card cue. | Three large sigil layers, glow, streak and particles sat behind the moving card; wide travel crossed crowded formations. | One small seal belongs to the card cue and retires with it at impact. Bound travel and use a separate clear pocket for four-enemy layouts. |
| Enemy support glyph overlapped the combatant/intent region. | Additional shield/signal glyph was positioned at the enemy foot/label boundary despite existing intent and support effects. | Retain canonical enemy animation, intent and resolved support effect; remove the extra glyph. |
| Idle and action transforms had multiple owners. | Base breathing, expansion personality tweens, pose tweens and atlas replacement ran independently. | One action owner controls bounded original-pose offsets; remove expansion personality duplicates. Existing parent breathing and enemy action presenter remain. |
| Talon source/export anatomy differed. | Older PNG contained an extra leg; older runtime had a separate alpha cleanup. | Constrained built-in image edit repairs the source to two legs, then the ordinary lossless exporter produces the runtime. Update its foot contact. |

Viewed both complete atlas sheets, the original leader references and runtime
cutouts, Caldra's corrected resident, and before/after combat captures. V1/v2
remain historical files only; no runtime source imports them. Their earlier
"approved" labels in historical release notes are superseded by this audit.

Colored gray/green/purple/red patches seen in the raw image viewer were checked
numerically. They are RGB values under zero alpha, not opaque game artifacts.
The browser renders them transparently. Tidewarden's re-export was byte-identical;
no Tidewarden artwork change is claimed.

## Talon repair provenance

Built-in image-generation edit, with genuine transparency. Input:
`assets/runtime/flock/leaders/talon-combat-back-ne.png` (pre-audit revision).
Selected source:
`assets/concept-art/flock-leaders/talon-combat-back-ne-identity-repair-v4.png`.
Runtime PNG/WebP: `assets/runtime/flock/leaders/talon-combat-back-ne.*`.
The original species, black eye mask, ivory hood, gray layers, turquoise quiver,
long tail and back three-quarter facing remain. Visual review found two legs
and two feet; no opaque repair patch. This is an assistant visual review.

Exact edit prompt:

> Precise local repair of this existing Bird Squad Loggerhead Shrike character cutout. Preserve the exact original identity, head, black shrike eye mask, ivory hood, charcoal-and-white feather pattern, turquoise trim, gray courier jacket, quiver, long tail, right-facing back three-quarter view, proportions, full silhouette, and crisp high-resolution pixel-art rendering. Correct only the accidental extra leg/foot in the lower-center: this bird must have exactly TWO natural bird legs with exactly TWO taloned feet, no third leg or foot. Keep the two anatomically placed legs under its body and remove the additional large foreground center leg/foot cleanly to genuine transparent background. No gray repair patches, purple lines, green matte, ground plane, shadows, background pixels, or opaque fill. Do not redesign or recolor any other part. No new wings, no human anatomy, no new accessories, no text. Full body and tail remain inside transparent margins. This is an identity-preserving anatomy/alpha repair, not a new character design.

Export: `python tools/build-runtime-ui-art.py --leaders talon-combat-back-ne`.
Talon remains below the existing 280 KiB runtime asset limit.

## Verification

Frame sampling now checks each Leader's exact canonical texture, visibility,
bounded movement, fixed scale, absence of duplicate bodies, impact phase and
return to idle during real card resolution. Reduced motion must keep the body
still. Tests reject runtime requests for the retired atlases and compare source
and runtime alpha away from resampling edges. Existing real rival-impact,
Leader-call, support, card-action and opening-reaction tests remain in scope.

Verification used the production build (`index-Cc1X41BE.js`) served on a task-owned
local preview. It covers the two recent Living Battles sheets, the five original
Leader identities, Caldra/Captain separation and the affected combat presenters;
it is not a new audit of every card illustration in the game.

| Check | Result / local evidence |
| --- | --- |
| TypeScript and production build | Passed; `.artifacts/identity-final-build.log`. |
| Runtime assets, world assets and FX contracts | Passed: 963 optimized assets; retired atlas imports are rejected. |
| Documentation, deployment-cache and bundle limits | Passed; boot 707.6 KiB under the unchanged 710 KiB cap. |
| 105-case affected-feature sweep | 103 passed initially. Two tests still required the removed Flyway bursts/personality tweens; updated to require preserved rule feedback/canonical boss portraits and zero duplicate effects. Both replacement cases passed in `.artifacts/identity-flyway-final.log`. Sweep: `.artifacts/identity-final-regression.log`. |
| Sequencing, pause and revised portrait fixture | Seven passed, including six additional timing/pause checks. `.artifacts/identity-sequencing-final.log`. |
| Identity matrix | All seven cases covered in Chromium, Firefox and WebKit. `.artifacts/identity-cross-final.log` plus corrected next-frame cleanup runs in `.artifacts/identity-cleanup-final.log`. |
| Nearest/farthest target geometry | Passed in all three engines. `.artifacts/identity-targets-final.log` and `.artifacts/identity-targets-cross-final.log`. |
| Shared game client | Unmodified client, two iterations, actual card plays, no error report. Final state has full art, no failed asset groups and zero lingering action objects. `.artifacts/identity-client-final/`. |

The initial WebKit cleanup assertion read state before `postupdate`: the manual
clock helper advances timers/tweens, not presentation frames. The corrected test
observes the actual next frame and requires an empty action list and a neutral
pose. It passes in all three engines. The older multi-Leader phase fixture also
now loads each canonical portrait before taking screenshots, avoiding misleading
placeholder captures. Tests retain real resolution and timing assertions.

Assistant visual review inspected original/reference art, before/after action
captures, the five Leaders at gameplay size, the jackdaw Captain, normal/reduced
presentation, support intents and crowded formations. Captures include
2560×1600, 1440×900 and 1000×560. The crowded geometry fixture checks both nearest
and farthest targets, including a boss plus three supports, through the card's
travel and cleanup. It checks combatant/label intersections, HUD clearance and
one attached commitment seal with no independent duplicate.

Review images (local, ignored test evidence):
- `.artifacts/identity-audit-review/spark-before.png`: retired sheet replacing the Roller.
- `.artifacts/identity-audit-review/spark-after.png`: original Roller retained during a real card cast.
- `.artifacts/identity-audit-review/crowded-after.png`: boss and three supports with a clear card-cue pocket.
- `.artifacts/identity-cross-final/`: all five Leaders, canonical alpha and three viewport captures.
- `.artifacts/identity-sequencing-final/`: loaded original portraits, Captain, attack timing and pause.

The initial audit used targeted correction verification. Its corrections were
subsequently published on 2026-10-30 with the
[opening combat release](../game/opening-combat-quality.md), after full PR and
production qualification. Both runs passed 1,123 gameplay cases, 429 browser
cases, 33 unit/policy checks and Pages-base smoke. The published artifact has
no retired atlases; all ten canonical leader images match its public files.

Release qualification additionally corrected Talon's stage clearance. The scene
uniformly fits each visible silhouette between the objective panel and hand,
reserving room for bounded reactions and positioning its floor shadow from the
same placement. Scale remains stable through an action. The complete cast is
checked at high-resolution and compact viewports, including four-enemy layouts.

Human sessions remain unperformed. Future authored pose sequences still require
the identity and transition review in the art bible before replacing these
canonical stills.

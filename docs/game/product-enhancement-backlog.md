# Product enhancement backlog

Accepted scope: the 52-item product enhancement list, requested for implementation
on 2026-09-07. This backlog preserves the complete scope across implementation
passes. A passing build is evidence for that revision, not proof of subjective
quality or completion of every item.

Status: **open** unless explicitly marked otherwise. Each item requires the
player outcome below, proportionate regression coverage, and playable inspection
when presentation changes. Balance changes require observed behavior; simulated
outcomes must not be described as human feedback. Existing user playtest waivers
remain in force and do not constitute passing human evidence.

Earlier continuation (2026-09-13): route reward decision panels now use measured
18–20px summaries, explicit projected-change rows, consistent 58px controls,
and complete 22px paginated context. Scrap, mixed effects, companion-only and
leave outcomes share explicit inspection; non-item keyboard/controller Confirm
now resolves the displayed decision. Card/Supply inspection also carries full
choice consequences and build advice, preserving armed picks. The subsequent
24-area continuation enlarges original event-choice rows, hand rules, enemy
vitals and comparison text, and groups numeric combat bursts. Broader reference
journeys and device qualification remain open. See `progress.md` for evidence.

## Continuation — combat inventory parity and preserved decisions

Codex card-detail follow-up: gameplay now leads the dossier with complete 20px
effect, Preen, Molt and passive-stat text. Ownership is summarized beside the
identity; full collection/acquisition/Folio/flight records and the journal remain
below, with 18px paragraphs and measured 16px headings. Removing redundant
dossier/art-preview ornaments leaves the canonical card artwork unchanged.
Clipped scrolling and existing actions remain; non-card dossiers, browser/footer
density, input/glossary parity and full catalog/device qualification remain open.

Keyword-help follow-up: shared hover definitions now use complete 20px body text
and 22px headings on a quiet opaque surface, replacing 12px text and the ornate
frame dependency. Rendered word bounds supply the anchor, including transformed
containers. Replacement destroys the previous scene's tooltip; word destruction
and canvas exit/shutdown clean up listeners and visible help. Codex/combat text state exposes
the definition. This addresses concrete hover readability/ownership defects;
glossary wording, non-pointer access and broader catalog qualification remain.

Normal reward follow-up: card and Preen effect summaries now use measured 18px
text; Preen choices expose 16px first-change previews for every option rather
than a tiny focused delta plus clipped unfocused fragments. Added/removed clauses
and Molt-only changes share the fallback formatter. Complete comparisons remain
in the 22px reader. Separate Inspect/Select/Confirm controls, tighter frames and
a quiet preview rail preserve the existing theme. Loading and ready controls
share positions; armed Skip visibly disables both actions. These specific
readability and control-state defects are implemented, not the full packages.

Card/Preen follow-up: failed ceremony imports now retain loaded card artwork,
printed energy costs, measured 18px effect excerpts and readable 14px change
previews instead of missing images and 10px labels. Separate Read/Select/Confirm
controls and Skip meet the 58px logical target; full 22px inspection preserves
normal, Preen and Molt rules without committing. This addresses the recorded
fallback presentation defects, not the full R/U/X/T/Q packages or device gates.

Follow-up: failed ceremony loading now retains the same readable Waymark choices,
artifact art and explicit Read/Select controls as normal loading. Full advice stays
in the 22px reader rather than tiny clipped fallback labels. Combat inventory
loading/failure notices now reach narration; Pause takes priority, and closing
returns to the original card's controls. These two recorded failure-path gaps
are implemented, with revision-specific evidence in `progress.md`; broader
fallback, device and actual assistive-technology qualification is not closed.
Loading placeholders also reserve the ready card and Read/Select geometry;
reveal no longer resizes or shifts the Waymark choices. Locked input remains
locked until the choices are ready, without any added artificial delay.

Combat now shares the complete owned-Waymark reader and comparison layout with
the route, replacing tiny hover-only grammar and nested tile frames. Closing it
preserves the selected hand card, target, resources and cancelled-action count;
the previous general Back handler cancelled the card. Shift+Run Kit (default
Shift+X) and controller RT open the reader without a pointer. Help and narration
describe the shortcut; selection, Pin, pages and Close remain read-only.

The shared presentation belongs to combat's root and is destroyed with it.
Reading survives redraws, while Pause/Settings own input. Delayed loading cannot
reopen a dismissed reader. Failed loading remains safely dismissible and describes
reload recovery rather than promising that a browser-cached failed import can
recover merely by reopening. Catalog, lifecycle, actual-card resumption, loading
and cross-browser evidence is recorded in `progress.md`.

This advances C02/I03/I04/X01/T04/Q01. It does not certify all remaining tooltip,
art, balance, sustained-session, physical-device or assistive-technology work.

## Continuation — complete owned-Waymark reading

The route inventory now separates six simple artwork/name tiles from complete
measured rules: 22px single-item text and synchronized 18px comparison pages.
All 58 Waymarks retain ordered effects, triggers, descriptions, full identity,
tags and flavor. No authored effects, economy or artwork changed. Reading pages
survive redraws; keyboard, controller shoulders and pointer paging share the
same state. Wheel gestures over the reader page rules instead of moving inventory
focus. Remapped Roost pins, while C and controller X remain supported.

Pause/Settings block hidden selection, pinning and paging. Narration carries the
current complete page and active Pin binding. This advances C02/I03/I04/X01,
not every remaining item tooltip or physical/assistive-device qualification.
Revision-specific browser, catalog and visual evidence is in `progress.md`.

## Continuation — incoming-hit clarity and effect ownership

Incoming attacks now retain a directional swipe, compact contact, exact damage
label and existing reaction/audio without stacking the duplicate impact flash,
flock burst and broad spark spray over the leader. Heavy hits add one compact
accent (260px at base scale, 220ms full/130ms reduced motion), without its former
additive duplicate or 180ms hold. Cover, Flow, damage and attack timing are retained.

Generated-effect batches now own destruction, timers, tweens and sprite counts.
Removing one image retires its siblings once; card-window cleanup preserves the
count of earlier still-live effects. Both early-removal and partial-window defects
were reproduced before fixes. The legacy encounter test now checks actual compact
hit feedback and pile transfers instead of retired effects, with exact gameplay
outcomes and all independent failures reported. Revision-specific browser and
three-size visual evidence is recorded in `progress.md`.

This advances V04/A04/F02/F03/T02/Q01, not complete long-session or full-product
qualification. Remaining art outliers, balance/build variety, complete journeys,
physical-device and assistive-technology evidence remain open.

## Continuation — modal wheel ownership and release regression coverage

The next September 14 continuation reproduces wheel input changing hidden Deck
Review and combat Waymark positions behind Pause. Scene wheel dispatch now
honors Pause/Settings, with route exit confirmation protected as well. Horizontal-
only gestures no longer act as a backward scroll. Explicit route reward and
Preen/Release card readers own paging; scrolling cannot move the underlying
picker focus or destroy the reader. Armed choices and run resources are retained.

The validation sequencing gate now includes artwork recovery/decoding/district
transitions and modal wheel ownership (75 selected tests, previously 68).
The intentional-card-play test observes durable commitment rather than polling
a short-lived animation flag; separate clock tests retain timing/order checks.
An unused legacy event-cancel renderer was removed only after checking dynamic
module callers. No art, gameplay delay, loading boundary or budget was changed.

These close reproduced input defects and expand Q01 coverage, not the entire
I03/I04/X03/T01/Q01 packages. The broader legacy encounter FX expectations were
subsequently reconciled in the incoming-hit continuation above. Physical Windows/Android/iPad and NVDA/VoiceOver
audits are missing; the existing human-playtest waiver does not waive them.
Current build and browser evidence are recorded in `progress.md`.

## Continuation — unified Market card reading and route cleanup

The next September 14 continuation replaces the split card rules/build-advice
panels with one complete 22px left-side reader. Four aligned card offers remain
visible, with 18px names and explicit Scrap prices, separated from Wingbeat play
costs. All authored rules, Preen/Molt variants, passive bonuses, purchase effects
and build advice remain available through measured pages; unavailable requirements
stay visible. Section headings are enlarged without changing the existing art.
The route view now forwards authored Preened Molt rules. Late-loaded portraits
update in place so the explicit route/Preen/Release reader does not replace its
paging buttons under an active pointer.

Interaction qualification exposed a route redraw defect: DisplayList removal
was mistaken for object destruction, leaving Settings input ownership and old
listeners alive. Route redraw now destroys the prior display objects. Repeated
redraw and Settings-return tests preserve armed choices without purchasing.
This completes the bounded Market card-reader typography/layout and reproduced
cleanup defects. Remaining art, economy/build variety, sustained performance,
physical-device and player-experience qualification are still open.

## Continuation — accessible Market navigation and controls

The September 14 Market continuation keeps every unsold offer reachable with
keyboard, remapped controls and controller, including unaffordable cards,
Waymarks, Supplies, services and Refresh. Reading requirements does not arm or
spend. Capacity/eligibility blockers remain explicit; sold stock stays inert.
Pause/settings guard navigation, category changes and stale offer callbacks,
while preserving the selected rules page behind the system overlay. Section
labels are 18px and the separated 16px command rail follows the current device
and bindings. Existing purchase confirmation semantics and artwork are retained.
This closes a bounded navigation gap, not the broader economy, physical-device
or player-experience qualification. Card-reader typography is addressed above.

## Continuation — original event navigation and complete reading

The September 14 event continuation replaces the clipped hover-only details on
Basin, Nest, Cache, Signal and Rival choices with explicit read-only Details.
Keyboard/remapped controls, Shift+Tab and controller navigation share stable
focus, including unavailable choices. Short decisions share a content-sized
summary; longer text paginates without shrinking or cutting authored content.
Inspection preserves the current choice and run resources. Held confirmation
cannot carry into the reward review; pause/settings block event actions.
The existing dark artwork is retained, with no new art, animation or game waits.
Revision-specific checks and remaining qualification are recorded in `progress.md`.

## Continuation — discard return reading and mechanic-first card art

The September 14 Supply continuation replaces dense Packed Supplies tiles with
a stable four-row inventory browser and complete 22px effect reading. All packed
items remain readable in either phase; explicit Select/Confirm/Cancel and current-
device controls preserve consumption rules. Route HUD dimming and complete
narration are aligned. Reproduced controller Y/target input leaks behind Run Kit
are fixed, and paused Supply actions are blocked. Bounded catalog, capacity and
cross-browser qualification is tracked in `progress.md`; wider areas remain open.

The next gameplay continuation fixes lethal Supplies leaving an empty battle
waiting for another card/Roost. Outcome evaluation now follows all effects,
choices, costs, consumption and Supply-triggered Waymarks. Discard choices gain
readable counts/current-device hints, larger confirmation and card tags, with
the command lane kept clear of card titles. Real pointer capture fixes hints
remaining on keyboard after a card stops Phaser event propagation.

Whole-run coverage now includes all five leaders on two seeds with legal
discard/return choices, earned Supplies and offered Market purchases. Five
recorded paths finish all four districts (Talon seed 2, both Tidewarden and
both Roostkeeper seeds); five end in defeat. This is bounded mechanical
progression evidence, not a win-rate estimate, optimal play or human enjoyment
evidence. Defensive early fights of 9–10 turns warrant actual-play pacing
review; no unsupported balance nerf was applied. Broader build diversity,
remaining art, sustained performance and device qualification remain open.

The subsequent return/card-art continuation resolves the original discard
return picker's pointer reachability defect beyond five cards, hover-induced
list movement and unreadable/truncated rules. It now separates browsing from
commitment, uses 20px names/22px complete paginated rules and 58px controls, and
preserves required return/draw/effect order. Plume Flash has a mechanic-first
imagegen pilot with deterministic frame/title composition and three reviewed
runtime sizes. Scoped export/validation avoids regenerating unrelated art.
These are completed defects/pilot deliverables; broad whole-run balance,
remaining pose/state art, sustained performance and device qualification are
still open. See the next `progress.md` entry for revision-specific evidence.

## Continuation — dense encounters and first-use controls

Areas 1, 3, 4, 6, 14 and 16 advance through larger intent/status/phase/deadline
labels, measured silhouette-to-label clearance, a left-stage trigger lane and
input observation before the first picker opens. Expanded checks cover actual
boss formations in all four districts, one-to-four crowded enemies, long phase
names, objective targets and first-use/remapped device hints. Acceptance evidence
and outstanding limitations are recorded in the matching `progress.md` entry;
these scoped fixes do not establish whole-product completion.

## Continuation — combat reading, device hints and asset cleanup

The continuing visual/design/gameplay reviews consolidate the same product
scope; they do not reset previously accepted work or count repeated requests
as additional systems. This pass advances areas 1, 4, 5, 11, 14, 16, 18 and 24:

- Combat hand names/costs are 18px and rules 20px, with larger reading panels,
  separate action rows and word-safe numeric phrases. Complete rules remain
  available in inspection; bounded excerpts do not change effect order.
- Combat Flow values/status and incoming-health summaries are enlarged. The
  forecast retains uncertainty and full-source metadata, without duplicate
  two-line microtext. Selection and resolution semantics remain unchanged.
- Preen/Release and route reward hints show the current input method and
  actual remapped bindings, without committing or changing the decision.
  Stronger picker dimming separates the active decision from the Market.
- Four obsolete picker decorations are excluded from runtime load queues;
  diagnostic snapshots report them as absent without crashing. Canonical
  assets remain available on disk; this is a transfer, not deployment-size,
  saving. Event observers are bounded and removed at scene shutdown.
- A third Roof Rat anticipation candidate failed the clean-alpha gate and
  was rejected, not integrated. Priority pose work remains open.

See the matching `progress.md` entry for revision-specific evidence. Broader
boss/trigger layouts, whole-run strategic diversity, successful pose/card art
pilots, sustained-load measurements and device/human qualification remain open.
This batch does not establish completion of the entire backlog.

## Latest 32-area visuals/design/imagegen/gameplay review — accepted 2026-09-13

This consolidates the preceding lists; it is not 32 additional systems. The
accepted art direction remains dark, modern urban bird/tarot. These are bounded
outcomes, not permission to keep adding decorative UI or indefinitely expand
the feature set. No new playtest waiver is inferred.

| # | Area | Remaining acceptance / evidence |
| --- | --- | --- |
| 1 | Combat hierarchy | Partial: urgent resources, selected-card forecast and enemy intent are clearer. Qualify dense boss/trigger states without reintroducing duplicate plaques. |
| 2 | Battlefield detail | Partial: Rooftop Blocks has an integrated imagegen revision with quieter actor/card lanes. Apply the proven approach only where other district plates fail playable inspection. |
| 3 | Character grounding | Partial: Roof Rat contact shadow and selection ring use the reviewed paw row rather than tail bounds. Solo actors are staged inward/lower, with vitals, input and effects using the same anchors. Entry/boss and one-to-four formations checked at three sizes. Other species/district combinations still require visual qualification. |
| 4 | Actual-size text | Partial: home/setup text uses at least 20px. Route gain/risk headers and tooltips use 18px, tooltip titles 22px, contract headings/goals 18/16px and save notices 18px. Compact Collection and Preen/Release actions now use 18/16px text; picker names use measured 18px excerpts. Compact utility text/targets checked at 15.5px/44px minimum; wider game surfaces still require equivalent qualification. |
| 5 | Card scanning | Partial: conditional payoffs have their own marked rows; only adjacent stable first-play/previous-suit predicates share headers. Authored order, dynamic gates and complete reading sources remain unchanged. Whole-pool normal/Molt/Preen checks retained; mechanic-first art remains. |
| 6 | Effect hierarchy | Partial: bounded numeric/trigger lanes and shorter contacts retained. Heavy boss/status/healing chains remain. |
| 7 | Connected animation | Partial: card, pile and enemy timing improvements retained. Qualify defeat-to-reward-to-route continuity. |
| 8 | Compact layouts | Partial: three viewport sizes covered; purpose-built reallocation and physical-device qualification remain. |
| 9 | Continue Run context | Implemented: saved leader, actual district and next objective appear in two restrained lines; no new confirmation. Includes free Preen and cleared-district states. Context is hidden in setup and exposed to narration. |
| 10 | Secondary navigation | Implemented: readable utility labels, quiet but visible hit surfaces, existing pointer/keyboard/controller paths and focus ring retained. |
| 11 | Panel consistency | Partial: consequence readers and measured controls retained. Outcome recap and route tooltips use quiet surfaces. Restoration no longer crosses route paths; Collection and save feedback have separate footer positions. Preen/Release now uses the available width for readable choices, without the large animated shell, context plaque or tiny repeated delta/nameplate badges. Finish remaining original Market/event/reward surface qualification. |
| 12 | Consequence-first decisions | Partial: original Basin/Nest/Cache/Signal/Rival options now expose complete read-only context and projected changes, including locked requirements, with stable input focus and explicit Details. Full resource/capacity/conditional outcome qualification remains. |
| 13 | Difference-first comparison | Partial: changed clauses lead. Exact conditional numeric deltas remain qualified, not guessed. |
| 14 | Selection, commitment, Back | Partial: existing protected choices retained; stale menu lazy callbacks reject prior scene generations. Route tooltips clear on canvas exit and remove their listener without changing selection or run state. Preen/Release Confirm is now an actual protected pointer action; stale callbacks, lost affordability and inspection/Back paths are covered, with one current hover-focus ring. Finish wider cross-surface return-state journeys. |
| 15 | Contextual teaching | Partial: Continue context added; collection narration occurs only on Collection. The Roost reminder yields to a selected-card decision, restores on Back and retires after the taught action, including browser reload. First-card and Molt teaching remain available. Broader resume/lesson journeys remain. |
| 16 | Accessibility consistency | Partial: current input/settings/narration tests retained. Complete whole-surface and physical-device qualification remains. |
| 17 | Art reference set | Canonical references and invariants captured in the readability pilot brief. Still needs pose/card pilot comparison before broader generation. |
| 18 | Priority character poses | Open: three Roof Rat anticipation candidates rejected (painted checkerboard, alpha halo, then another RGB checkerboard). Existing runtime art preserved. A clean identity-consistent pilot, normalized anchors, phase integration and reduced-motion behavior are still required. |
| 19 | Enemy role silhouettes | Open: role example using existing species/anatomy/wardrobe; verify identification at combat size. |
| 20 | Gameplay-aware plates | Partial: Rooftop v2 pilot integrated with explicit safe regions, unchanged scene coordinates and canonical allowlist. Other plates remain conditional on inspection. |
| 21 | Mechanic-first card art | Partial: Plume Flash (`wands_ace`) pilot uses a clear bird-originated call/wing action, simplified reflections, exact canonical frame/title and reviewed portrait/thumb/icon exports. Expand only after in-game comparison; other mechanic/state examples remain open. |
| 22 | Restrained state variants | Open: same-identity Molt/boss-phase pilot; no universal glow and no timing-only comprehension. |
| 23 | World/item coherence | Partial: current library complete; compare residents/props/items against approved anchors at actual size, replace only supported outliers. |
| 24 | Art production pipeline | Partial: rooftop and Plume Flash pilots retain references, versioned source/runtime wiring, budgets and review evidence. Single-card export/composite validation is regression-tested; full-set defaults remain strict. Rejected poses are documented; clean character silhouette/registration gates remain. |
| 25 | Forecast edge cases | Partial: 685 ordered enemy-phase cases pass, including healing-triggered Cover/Guard/cleansing, Tidewarden overheal, Perfect Brace, spent triggers, nested Cover-break damage and later boss phase transitions. Forecast and live interruption agree in immediate/animated and normal/reduced-motion paths. Card-only Leader/Waymark hooks and unknown choices remain explicitly estimated. |
| 26 | Whole-action latency | Partial: no new gameplay waits; bounded card/pile/enemy timing retained. Sustained load and between-encounter measurements remain. |
| 27 | Meaningful turns | Open: observed offence/defence/setup/Molt/resource tradeoffs across builds; scripted opening victories alone are insufficient. |
| 28 | Encounter pacing | Partial: Tidewarden opener fix retained. An enemy defeated by counterstrike now stops its remaining effects in both resolution paths; the animated path preserves the impact then skips dead-actor recovery/interlude. Full-run stalls, repetitive openers and broader cleanup remain. |
| 29 | Boss counterplay | Partial: clear phase forecasts retained. Demonstrate multiple viable build answers per boss. |
| 30 | Leader/build viability | Open: full-run development paths and distinct upgrades across leaders, not only opening encounter tests. |
| 31 | Route/economy tradeoffs | Partial: encounter counts now qualify street/rival pressure before commitment. A cache-first mechanical policy clears the rooftop boss and loses at Canal Dock Swarm, contrasting three early Rat Pack losses on the same seed. Offered routes and actual resources are recorded; shop optimization and multiple viable full-run paths remain, with no human balance inference. |
| 32 | Defeat/replay learning | Partial: readable, unframed recap retains factual review, copied seeded flights and keyboard/controller replay. Completed encounters exclude visited noncombat nodes. Three mechanical policies reached early Rat Pack defeats on one seed; no balance verdict or nerf inferred. Qualify turning-point accuracy and concrete follow-up experiments without grind pressure. |

Revision-specific tests and unresolved limitations are in `progress.md`.

## Earlier 25-area visual/design/gameplay review — accepted 2026-09-13

This is the current consolidation of the previous reviews, not 25 additional
systems. A specific defect may be resolved while its broader area remains open.
Automated parity, layout and control checks are not human enjoyment evidence.

| Area | Current status and next acceptance |
| --- | --- |
| 1. Combat HUD hierarchy | Partial: enlarged urgent resources and quieter run totals; complete information reallocation remains. |
| 2. Repeated information | Partial: redundant teaching/result plaques removed; whole-run reminder review remains. |
| 3. Character/background separation | Open: inspect all district/character combinations, then correct actual contrast or grounding failures. |
| 4. Enemy information composition | Partial: one-to-four-enemy clusters reserve art and label space. Cover is no longer mislabelled as next-attack damage: compact intents distinguish Cover/Charge/Heal/Support, with mixed-effect cues and complete condition-qualified tooltips. Tactical-role/all-art review remains. |
| 5. Transient feedback placement | Partial: enemy numeric results occupy one target-anchored lane below vitals; new selection previews retire it and individual history is preserved. Routine enemy contacts/slashes and flock bursts are smaller and shorter, with duplicate contact glow/particles removed. Other status families, heavy boss layers and full-run chains remain. |
| 6. Small-screen composition | Partial: three viewport sizes tested; actual responsive reallocation and physical-device qualification remain. |
| 7. Connected animation | Partial: casts settle before impact; bounded draw/discard/shuffle/return transfers share a short path with no input lock, and no travel under reduced motion. Complete reward/between-battle sequences remain. |
| 8. Deck Review footer and paging hints | Resolved for the reported defect: footer sits inside its panel, clear of comparison controls; paging hints follow pointer/keyboard/controller input. Default and remapped-key regressions pass; selected/pinned/page state remains intact. |
| 9. Faster comparisons | Partial: changed clauses/costs/targets lead; exact numeric deltas across conditional formulas remain. |
| 10. Reward/event/Market consistency | Partial: explicit consequence readers and larger decision controls retained; remaining original choice surfaces need equivalent treatment. |
| 11. Selection versus commitment | Partial: protected armed choices and read-only inspection retained; complete input-state audit remains. |
| 12. Predictable Back | Partial: comparison position and Waymark Back priorities retained; full reward/deck/Preen/route journey remains. |
| 13. Complete rejection feedback | Partial: unaffordable cards, including selected Retain cards, explain missing Wingbeats without mutation. Repeated identical active notices, cues and narration are deduplicated. Direct missing-target actions explain why they cannot resolve; other reasons still need qualification. |
| 14. Routine confirmation friction | Open: measure action counts and remove redundant reversible confirmations without weakening purchase/reward protection. |
| 15. Onboarding and return context | Partial: contextual first-flight guidance retained; complete lesson/resume/recovery journeys remain. |
| 16. Trustworthy forecasts | Partial: shared live/preview hit math and copied ordered enemy-phase simulation cover Winded, multi-hit bonus consumption, evolving conditional moves, support and shared Open Sky protection. All 222 authored moves across 64 runtime enemies pass parity in clear and protected/Winded states (452 scenarios including targeted cases). Counterstrikes, healing trigger chains and unsupported Roost choices are explicitly estimated; next-turn Fouled/Regen excluded. Card-only forecasts still exclude Leader/Waymark triggers. |
| 17. Complete action responsiveness | Partial: no waits added; card/turn/rejection regression coverage retained. Sustained full-run load and between-battle latency remain. |
| 18. Enemy-turn continuity | Partial: ordered impacts and pace/motion checks pass; full-run visual sequences remain. |
| 19. Audio hierarchy | Partial: bounded tactical-first cue scheduling and node cleanup; actual listening/mix qualification remains. |
| 20. Meaningful turn choices | Open: observed tradeoffs across builds/runs; scripted control journeys are not strategy-diversity evidence. |
| 21. Encounter length | Partial: paired Tidewarden opening trials improved after restoring Molt access. Full-run stalls, repetition and decided-fight tails remain. |
| 22. Enemy combination counterplay | Open: demonstrate distinct tactical priorities and viable responses across authored encounters. |
| 23. Boss preparation and phases | Partial: exact phase forecast retained; multiple-build counterplay qualification remains. |
| 24. Leader/card/Preen diversity | Partial: whole-card readability and contextual Waymark advice verified; multiple viable full-run development paths remain. |
| 25. Routes, rewards, economy and replay learning | Partial: existing economy simulation passes; combined full-run tradeoffs, factual defeat turning points and discovery-to-experiment journeys remain. |

The existing release-evidence waiver is unchanged. It neither supplies missing
human feedback nor closes subjective or physical-device acceptance criteria.
Revision-specific verification and owned-resource cleanup are in `progress.md`.

## Earlier 28-area visual/gameplay review — accepted 2026-09-13

This continuation refines the existing roadmap; it does not reset prior work or
declare broad quality areas complete. The current implementation preserves the
dark urban bird/tarot theme. Tidewarden now includes Hot Feathers after paired
opening-encounter trials demonstrated a missing offensive stance transition.
That evidence does not establish full-run balance or human enjoyment.

| Review item | Status / remaining acceptance |
| --- | --- |
| 1. Combat HUD hierarchy | Partial: larger Cohesion/Cover/Wingbeats/Resonance, quieter run totals and readable selected-action forecasts. Complete urgent/supporting information reallocation remains. |
| 2. Repeated information | Partial: duplicate teaching rail and AFTER/lethal plaques removed; exact outcomes remain in the decision forecast and meter overlay. Other repeated reminders remain. |
| 3. Card-rule structure | Resolved for the accepted card-face/reader scope: measured conditional lines, linked actions/quantities, explicit omissions and complete authored inspection. All 110 cards checked in base/Preened and normal/Molt states at three widths, including Firefox/WebKit. |
| 4. Live conditions | Partial: card-only written-order steps now evaluate evolving state, cost, healing, Winded and earlier defeats; interactive choices stop prediction. Complete numeric outcomes are inspectable. Leader/Waymark trigger simulation remains; current readers explicitly qualify this limitation. Incoming-threat estimation also needs status/conditional/multi-hit and shared Open Sky mitigation parity before exact Roost/fully-blocks claims. |
| 5. Card frames | Resolved for the accepted card-pool scope: normal/Molt/selected frames stay within their card bounds; shared name/cost/rules layout preserves art and identity. Whole-pool tests include loaded authored art and all 110 cards. |
| 6. Character/background separation | Open: local contrast and grounding across environments. |
| 7. Enemy information grouping | Partial: Tell, vitals and fixed-14px Cover/Winded rows form bounded clusters, with minimum meter width; one-to-four-enemy/boss fixtures stay clear of the decision forecast. All art renders before labels; four-enemy columns prevent row occlusion, and silhouette fitting reserves HUD space. Tactical-role and all-art/environment review remain. |
| 8. Effects hierarchy | Partial: normal-hit/recovery/trigger consolidation includes Waymark Cover, overhealing and enemy support. Same-source totals remain distinct from other source IDs, including identically named enemies; history preserves individual events. Numeric stacks remain inside the combat safe region. Other status families and dense full-run chains remain. |
| 9. Deck Review composition | Partial: quiet row separators, secondary toolbar and unboxed unpinned controls; selected/pinned states and large hit targets retained. Readable hints now follow pointer/keyboard/controller input with remapped actions; Save no longer repeats mixed-device shortcuts. Comparison/reader paging hints and broader cross-surface consistency remain. |
| 10. Comparison efficiency | Partial: changed normal/Molt clauses, passives, costs and targets lead; complete rules remain. General numeric-delta inference across conditional formulas remains. |
| 11. Reward/event consistency | Partial: Waymark metadata deduplicated; existing readable effects, explicit Read/Select and complete context retained. Original event costs/benefits and remaining surfaces need work. |
| 12. Compact composition | Partial: revised surfaces checked at 2560, 1440 and 1000 widths; responsive reallocation and physical devices remain. |
| 13. Complete action responsiveness | Partial: no new action waits; existing cadence/control journeys exercised. Whole action and between-battle journeys under sustained load remain. |
| 14. Enemy-turn continuity | Partial: ordered impact/counterplay timings retained and measured; complete full-run visual sequence qualification remains. |
| 15. Card-motion continuity | Partial: the late two-leg card projectile is replaced by one lift/fade within the existing impact budget; impact retires lagging cast tweens. Four pace/motion configurations pass. Full draw/discard/reward sequence review remains. |
| 16. Selection versus commitment | Partial: existing separated Waymark reading and protected armed choices retained. Whole input-state review remains. |
| 17. Cancellation and return paths | Partial: existing Waymark Back priority and comparison reading position retained. Complete reward/deck/Preen/route journey remains. |
| 18. Complete rejection feedback | Partial: missing-Wingbeat explanation remains bounded/non-mutating and also works on selected Retain cards; identical active rejection cues are deduplicated. Other rejection reasons remain. |
| 19. Routine confirmation friction | Open: measure routine action counts while retaining irreversible-choice protection. |
| 20. Audio hierarchy | Partial: rapid duplicate SFX coalesce; supporting cue bursts are bounded and briefly yield to tactical cues, with no playback queue or action delay. Completed synth nodes disconnect. Lazy first-input/mute regression passes. Actual listening and voice/music mix qualification remain. |
| 21. Meaningful turns | Open: observed tradeoffs across builds/runs; scripted starter journeys are control checks, not fun or strategy-diversity evidence. |
| 22. Encounter duration | Partial: Tidewarden gains Molt access in place of an overlapping healing/guard card. Two seeds and two policies reduced paired opening victories from 15–21 turns to 2; its live-control journey also completes. All five Leader control journeys pass. Full-run stalling, repetition and decided-fight tails remain. |
| 23. Enemy-combination identity | Open: tactical priority and counterplay evidence. |
| 24. Boss preparation/transitions | Partial: existing exact phase forecast retained; multi-build counterplay remains. |
| 25. Leader/card diversity | Open: contextual contribution and multiple viable development paths. |
| 26. Contextual deckbuilding advice | Resolved for the accepted Waymark-advice scope: owned-version executable rules include Resonance bursts, conditional/Molt qualification, exact matching-card/deck density and printed cost ranges with the Molt discount caveat. Full context is read-only; compact rewards retain one summary and two tags. |
| 27. Route/reward/economy tradeoffs | Open: existing 500-seed economy model passes configured targets; actual combat/run tradeoffs remain unqualified. |
| 28. Learning/defeat/experimentation | Partial: quieter first-flight instruction retained; contextual lessons, factual defeat turning points and discovery-to-Flight-Lab connections remain. |

Revision-specific validation, limitations and cleanup are recorded in `progress.md`.

## Earlier 30-area visual/gameplay review — accepted 2026-09-13

This is a refinement of the existing scope, not 30 new systems. The following
cross-reference preserves every item from the latest accepted review. A partial
implementation is not closure of its broader player outcome.

| Review item | Status / remaining acceptance |
| --- | --- |
| 1. Combat-effect obstruction | Partial: normal-hit, Cover and healing stacks simplified; owned particles stay behind result labels. Other effect families and dense live chains remain. |
| 2. Combat HUD hierarchy | Open: separate urgent combat resources from supporting run information. |
| 3. Redundant threat messaging | Partial: teaching banner explains the rule instead of repeating damage/Cover totals. Broader duplication review remains. |
| 4. Enemy information grouping | Partial: named Tell strips attach directly above their own vitals; phase/objective badges have a separate row. Full tactical-role review remains. |
| 5. Character/background separation | Open: local contrast and consistent grounding across all environments. |
| 6. Card-rule scanning | Partial: actions, quantities and resources stay together; measured excerpts preserve complete inspection. Full card-pool typography remains. |
| 7. Live conditional readiness | Open: evaluate conditions in resolution order, including target-dependent and earlier-effect state, before adding indicators. |
| 8. Card-frame cohesion | Open: complete art/frame/selection treatment. |
| 9. Quiet secondary controls | Partial: History now uses a smaller low-emphasis control, with remapped shortcuts retained in its tooltip. Other supporting controls remain. |
| 10. Secondary-screen consistency | Partial: Deck Review scroll controls match its plain controls; index/page ornaments removed. Other legacy surfaces remain. |
| 11. Event benefits and costs | Open: structured outcomes on original choice rows, preserving complete consequences. |
| 12. Self-contained overlays | Partial: Deck Review uses an opaque curtain; other readers/surfaces remain. |
| 13. Difference-first comparisons | Open: lead with exact changes while preserving normal/Molt/passive/context rules. |
| 14. Compact composition | Partial: three-size browser checks; responsive reallocation and actual device inspection remain. |
| 15. Complete action responsiveness | Partial: no new waits; cadence regression and starter-control journeys. Whole-run latency remains. |
| 16. Connected animation sequences | Partial: fewer redundant effects per normal action. Complete card/enemy/reward sequence review remains. |
| 17. Broader feedback consolidation | Partial: existing numeric/trigger grouping retained, particle ordering/lifecycle fixed. Other statuses remain. |
| 18. Targeting/cancellation feedback | Partial: self-target tutorial no longer asks for an enemy; invalid-action explanations and full input-state review remain. |
| 19. Routine confirmation friction | Open: retain irreversible-choice protection while reducing action counts. |
| 20. Between-screen context | Open: complete reward/deck/Preen/route reference journey. |
| 21. Audio importance | Open: actual dense-sequence listening and cue prioritization. |
| 22. Meaningful turn decisions | Open: observed decision tradeoffs across runs; scripted starter journeys are not balance proof. |
| 23. Encounter pacing | Open: repetition, stalling and decided-fight tails across full runs. |
| 24. Enemy-combination identity | Open: tactical priority/counterplay evidence. |
| 25. Actionable boss transitions | Partial: existing exact phase forecast retained and labels regrouped. Multi-build counterplay evidence remains. |
| 26. Card/Leader diversity | Open: contextual contribution and multiple viable development paths. |
| 27. Contextual deck advice | Open: effective cost, timing, setup and draw-dilution analysis. |
| 28. Route/reward/economy tradeoffs | Open: combined full-run evidence before tuning. |
| 29. Playable vocabulary teaching | Partial: concise contextual combat guidance corrected. Complete lessons remain. |
| 30. Discovery/defeat/experimentation | Open: connect existing Flight Lab with discoveries and factual defeat turning points. |

Verification for this continuation is recorded in `progress.md`.

## Latest 24-area visual/design/gameplay continuation — accepted 2026-09-13

The latest request accepts the following refinement of the existing roadmap.
These are quality areas, not 24 equal-sized tickets. None is closed merely by
editing its presentation; full-run, human, physical-device and assistive-technology
evidence must remain distinct from synthetic browser fixtures.

| Area | Current work / remaining acceptance |
| --- | --- |
| 1. Combat hierarchy | Existing quieter controls retained; complete HUD priority review remains. |
| 2. Compact readability | Hand and comparison text enlarged in this continuation; other labels and real devices remain. |
| 3. Card-rule scanning | Conditional clauses start new lines; full authored rules stay inspectable. Live condition indicators remain. |
| 4. Card-frame cohesion | Rules panel accommodates larger text; whole frame/art treatment remains. |
| 5. Character/background separation | Local contrast and silhouette treatment remain. |
| 6. Enemy information groups | HP/name floors enlarged to 14/15px; phase labels measured with complete tooltip text. Complete role/intent grouping remains. |
| 7. Combat feedback | Explicit same-source numeric damage/heal/Cover bursts grouped; broader status chains remain. |
| 8. Secondary-screen consistency | Content-sized outcome reader and shared 18px/16px event-choice rows improved; overflow hover details and other legacy menus remain. |
| 9. Repeated information | Short comparison effects/passives grouped when measured to fit; broader duplication review remains. |
| 10. Content-sized readers | Short outcome panels size to content, preserving full long-text paging. Other readers remain. |
| 11. Useful comparisons | Larger body, smaller art header, short active/passive overview; deeper contextual advice remains. |
| 12. Consistent interactions | Existing read-only navigation preserved; all-overlay parity review remains. |
| 13. Confirmation friction | Short readers require no extra paging; whole reward/route action-count review remains. |
| 14. Vocabulary | Contextual terminology lessons remain. |
| 15. Between-battle continuity | Full reward/deck/service/route reference journey remains. |
| 16. Onboarding/resume/defeat | Playable lessons and complete recovery journey remain. |
| 17. Action responsiveness | Numeric feedback adds no combat waits; measured complete action journeys remain. |
| 18. Motion/audio cohesion | Grouped numbers are stationary with reduced-motion support; full sequence/mix review remains. |
| 19. Encounter pacing | Requires observed repetitions, stalls and decided-fight tails. |
| 20. Enemy combinations | Requires tactical-role and counterplay evidence. |
| 21. Boss transitions | Requires preview/counterplay evidence across major builds. |
| 22. Strategy diversity | Requires contextual contribution and viable-strategy evidence; no speculative tuning. |
| 23. Rewards/routes/economy | Timing, draw dilution, dependencies and opportunity-cost analysis remain. |
| 24. Discovery/replay | Existing safe Flight Lab retained; discovery-to-experiment journey remains. |

Verification and limitations for each continuation are recorded in `progress.md`.

## Latest 16-area continuation — accepted 2026-09-13

The newest review groups earlier findings into these 16 areas; this does not
reset the existing roadmap. Current implementation is partial, not an all-items
completion or release qualification claim.

| Area | Roadmap | This continuation / remaining acceptance |
| --- | --- | --- |
| 1. Event/menu layouts | D02, U02, R04 | Prior decision-panel work retained; original event choices and remaining menus still need review. |
| 2. Repeated information | D04, C02 | Non-item outcome context consolidated into a measured summary; broader duplication audit remains. |
| 3. Inspection efficiency | C02, I03 | Short non-item outcomes fit on one page; long consequences and companion rules remain complete. Other readers remain sectional. |
| 4. Combat notifications | V04, F03 | Supply/Waymark bursts share one bounded quiet lane. Up to 256 recent events are inspectable in order; floating damage/status callouts still need consolidation. |
| 5. Responsiveness | I01, F01 | Notifications add no combat waits; keyboard auto-repeat cannot close a reader and then play a card. Full measured journey remains. |
| 6. Interaction consistency | I03, I04 | History uses pointer, remapped Shift+Help, L3, shared reading navigation and pause guards; other overlays remain. |
| 7. Whole-run continuity | D03, Q02 | Full reference journey remains; isolated tests do not close it. |
| 8. Contextual deck advice | C04, R02 | Effective costs, draw dilution and conditional downside need further analysis. |
| 9. Encounter pacing | E05, R05 | Repetition, stalling and decided-fight tails need observed combat evidence. |
| 10. Enemy/boss differentiation | E01–E04 | Counterplay and tactical variety remain open. |
| 11. Card/Leader balance | G01–G05 | Viable-strategy and contribution evidence remains; no speculative tuning. |
| 12. Onboarding/resume/defeat | U03, U04, T03 | Contextual lessons and complete recovery journey remain. |
| 13. Collection/replay motivation | U05, P01–P05 | Discovery-to-practice flow remains open. |
| 14. Audio/motion cohesion | F03–F05 | Trigger notice removes bounce/drift, respects Text Pace/reduced motion; full mix and sequence review remains. |
| 15. Performance/reliability | T01–T05 | Trigger timers/tweens clean up on replacement/destruction and history retention is bounded. Preferred startup targets and sustained-device runs remain. |
| 16. Device/accessibility/player feedback | X04, X05, Q03 | Requires actual hardware, assistive technology and authentic players; automated narration is not a substitute. |

Evidence, limits and cleanup are recorded in `progress.md`.

## Earlier 18-area review — accepted 2026-09-13

This is a cross-reference to the existing roadmap, not 18 new feature promises
or a reset of prior completion. A bounded implementation does not close an
entire quality area. No human/device evidence is inferred from automated tests.

| Area | Roadmap | Current disposition |
| --- | --- | --- |
| Event decision panels | D04, R04, X01 | Review/confirmation step improved; original choice panels still need review. |
| Non-item rewards | C02, I03, R04 | Explicit outcome reading and intentional confirmation implemented; revision tests in progress.md. |
| Consistent styling | D01, D02, U02 | Shared decision text/buttons applied to this flow; other legacy surfaces remain. |
| Combat notification clutter | V04, F03 | Supply/Waymark lane and bounded history implemented; damage/status callout consolidation remains. |
| Action responsiveness | I01, F01, F02 | Existing cadence safeguards retained; full measured journey remains. |
| Interaction consistency | I03, I04, I05 | Decision inspection, remapping and held-confirm protection extended; other overlays remain. |
| Complete reference journey | D03, Q02 | Open; isolated surface tests are not end-to-end qualification. |
| Contextual build advice | C04, R02 | Complete existing advice is readable from both pointer and input-driven inspection; deeper analysis remains. |
| Encounter pacing | E05, R05 | Economy simulation is diagnostic only; combat duration/repetition needs play evidence. |
| Enemy/boss variety | E01–E04 | Open; validate tactical differences and counterplay before expanding content. |
| Card/Leader balance | G01–G05 | No speculative balance changes; contribution and viable-strategy evidence still required. |
| Onboarding/vocabulary | U03, C05 | Contextual playable lessons remain. |
| Resume/defeat | U04, T03 | Full checkpoint/recovery and actionable-result journeys remain. |
| Audio/motion cohesion | F03–F05 | Full mix/sequence review remains. |
| Collection/replay motivation | U05, P01–P05 | Discoverability and non-grinding mastery work remains. |
| Real-device/accessibility | X04, X05 | Requires actual physical-device and assistive-technology sessions. |
| Performance/recovery | T01–T05 | Hard bundle/asset/cache checks retained; preferred startup targets and sustained-play qualification remain. |
| Authentic player feedback | Q03, Q04 | Requires real players; existing owner waiver is not passing feedback. |

## Core experience

| ID | Enhancement | Completion evidence |
| --- | --- | --- |
| 1 | Teach the complete loop | **Partial (2026-09-07):** readable six-step How to Play overview connects route, battle, reward/Skip, Preen, deck review, and the next flight; the same explanations are narrated. Contextual/playable Preen and deck lessons remain open. |
| 2 | Playable decision lessons | Optional damage/defense, Flow, and Molt examples explain consequences. |
| 3 | Contextual help | Repeated confusion offers dismissible, relevant help without repeated nagging. |
| 4 | Continue summary | Resume explains current build, threat, and actual recovery point. |
| 5 | Deck-size tradeoffs | **Partial (2026-09-08):** combat reward/Preen and route/Market Release/Preen inspection compare deck size, base hand target, passive gains/changed totals, and persistence. Market card purchases now separate Wingbeats from Scrap, show transaction/base-hand deltas and wrapped build advice, and recover current preview rows after late art redraws. Uses the live draw rule with explicit draw assumptions. Broader route-choice and actual draw-probability comparisons remain open. |
| 6 | Contextual reward advice | Advice considers effective costs, timing, engines, and Waymarks. |
| 7 | Recommendation downsides | **Partial (2026-09-07):** compact reward advice retains the strongest cost/recovery/role warning alongside a benefit, including district-biased rewards. Live rendered and announced warnings pass before commitment. Draw dilution and effect-timing comparisons remain open. |
| 8 | Accurate Flight Lab | **Complete (2026-09-07):** shared combat draw rule, explicit assumptions, affordable-together budget, bounded hand pages. Live parity passes for all five Leaders before/after Preen; large-hand keyboard/controller/pointer and save-preservation checks pass. |
| 9 | Playable practice | **Complete (2026-09-08):** Flight Lab launches real Tier 0 routes/combat with owned legal Folios while keeping the active flight safe. Disposable in-memory persistence, explicit mode/exit/result labels, original-Folio seeded replay, and no permanent records/unlocks. Eighteen checks pass across Chromium/Firefox/WebKit for all launch inputs, card play, rewards/Preen/route return, win/loss, retry, pause exit, refresh, ownership, Leader locks, denied storage, and journal recovery isolation; ordinary-flight regressions pass. |
| 10 | Dominant-strategy audit | Compare wide/thin decks, recovery, Molt, and hybrids; change only demonstrated imbalances. |
| 11 | Stalling audit | Check incentives for safe healing/resource farming and preserve legitimate defensive play. |
| 12 | Defeat explanations | Factual turning points connect to relevant practice without invented counterfactuals. |

## Strategic variety

| ID | Enhancement | Completion evidence |
| --- | --- | --- |
| 13 | Leader development paths | Several usable strategies per Leader, including hybrid paths. |
| 14 | Card usefulness | Evaluate selection, removal, and in-combat contribution with context. |
| 15 | Common-card relevance | Reliable roles survive late-run and rarity comparisons. |
| 16 | Preen decisions | Added mechanics meaningfully change sequencing or strategy. |
| 17 | Pivot opportunities | Recoverable build weaknesses have reasonable route/reward responses. |
| 18 | Reward repetition | Structured drafts retain variety and do not force one repeated build. |
| 19 | Enemy combinations | Existing roles create distinct target and sequencing decisions. |
| 20 | Boss transitions | Boss-specific timing pressures remain previewable and counterable. |
| 21 | Hard-counter audit | Each major archetype has reasonable responses to authored threats. |
| 22 | Route tradeoffs | Safety, upgrades, collection, and economy compare using current flight context. |
| 23 | Market opportunity cost | Services and merchandise compete meaningfully across run states. |
| 24 | Supply usability | Relevant use opportunities and exact effects are understandable. |
| 25 | Event depth | Selected events reflect prior decisions, build, or Leader. |
| 26 | District pacing | Address repeated openings, reward droughts, and already-decided late fights. |

## Presentation and navigation

| ID | Enhancement | Completion evidence |
| --- | --- | --- |
| 27 | Grouped Settings | **Complete (2026-09-07):** four sections, pointer/keyboard/controller navigation, hidden-hit isolation, announced values, stable focus, and single-owner listener cleanup. Menu/route/battle and 2560x1600, 1440x900, 1000x560 checks pass. |
| 28 | Readable text sizes | **Partial (2026-09-08):** Settings labels/values, combat reward effects/advice, and How to Play enlarged. Help bodies use uncapped 16px text with tested containment. Reward cards use measured ellipses; full preview allocates rule space from measured text height. Market advice wraps at 14px; its right-hand dossier now presents complete Now, Preen, and Molt rules in measured 16px pages with a separate current-stat footer, pointer and Inspect/Y navigation, and narrated page content. Broader text scaling and other legacy detail surfaces remain open. |
| 29 | Decision hierarchy | **Partial (2026-09-07):** combat rewards separate effects, Molt badges, focused build advice, Inspect, and Skip. Current choice, consequence, and commitment still need review across other key surfaces. |
| 30 | Vocabulary | Terms are introduced progressively with contextual definitions. |
| 31 | Persistence labels | **Partial (2026-09-07):** reward/Preen inspection explains permanent collection records versus flight-only playable copies/upgrades. Other collection, combat, and temporary changes remain to be reviewed. |
| 32 | Trigger feedback | Dense passive chains are grouped with inspectable exact order. |
| 33 | Input hints | Visible hints follow active input and remapping through transitions. |
| 34 | Confirmation friction | Consequential choices stay protected; routine actions avoid redundant work. |
| 35 | Collection navigation | New card to dossier, comparison, Folio, and practice is easy to follow. |
| 36 | Post-run hierarchy | Result and defining decisions precede optional detailed records. |
| 37 | Audio mix | Overlapping voices, cues, music, and boss effects remain distinguishable. |

## Long-term motivation

| ID | Enhancement | Completion evidence |
| --- | --- | --- |
| 38 | Experiment recognition | Cosmetic/record mastery rewards varied card and build use. |
| 39 | Actionable collection targets | Acquisition guidance connects to routes and explains uncertainty. |
| 40 | Meaningful discoveries | Newly owned cards explain new combinations or Folio opportunities. |
| 41 | Curated challenges | Optional constraints create mastery goals without permanent power. |
| 42 | Persistent challenges | Shared challenges remain accessible without streaks or deadlines. |
| 43 | District storytelling | Existing characters and consequences connect the run's events. |
| 44 | Cosmetic identity | Alternate art preserves immediate mechanical recognition. |

## Reliability and evidence

| ID | Enhancement | Completion evidence |
| --- | --- | --- |
| 45 | Interruption recovery | Refresh, tab closure, suspend, and reward interruption match the advertised checkpoint. |
| 46 | Assistive technology | Record actual NVDA/VoiceOver journeys; distinguish automation from physical use. |
| 47 | Physical devices | Record supported device touch, readability, suspension, and sustained performance. |
| 48 | Loading bottlenecks | Measure startup/memory improvements; keep existing budgets visible. |
| 49 | Current documentation | **Partial:** corrected audio ownership and release-evidence contracts. Historical audit consolidation remains open. |
| 50 | Release evidence policy | **Complete (2026-09-07):** version-scoped owner waiver, consistent runbooks, explicit WAIVED output, strict-human override, four policy tests. Missing device/assistive evidence still fails the gate. |
| 51 | Optional player sessions | Use authentic feedback for subjective decisions without revoking the existing waiver. |
| 52 | Outcome-based verification | Relevant checks accompany changes; launched resources are cleaned up. |

## Current implementation order

1. Complete readable decision surfaces: reward/deck-size advice, removal, route/market comparisons, and scalable text.
2. Connect onboarding, collection, defeat explanations, and safe playable practice.
3. Use measured play evidence for balance, encounter variety, pacing, and economy revisions.
4. Qualify recovery, physical devices, assistive technology, and performance.
5. Deepen collection goals, mastery challenges, and district storytelling.

The subsequent 48-point consolidated roadmap reorganizes this accepted scope;
it does not reset completed items or imply 48 newly missing features. Preserve
Flight Lab accuracy, grouped Settings, and explicit release-waiver reporting.
The owner's quality direction is polished, readable, satisfying, replayable
play. Pursue meaningful choices and experimentation, not compulsory grinding,
streak pressure, artificial scarcity, or permanent-power chores. Automated
checks cannot establish subjective fun or replace authentic player feedback.

No item is complete merely because its feature name exists in the source.

## Professional-quality roadmap — accepted 2026-09-12

The latest 70-point review expands and reorganizes the requirements above.
The work packages below are a normalized implementation index, not a claim
that existing systems are absent or that a prior completed item reopened.
Keep the original 52-item evidence and cross-reference it when closing work.
**All packages remain open; `partial` means bounded implementation/evidence,
not overall completion.** Do not count a design document as a shipped feature.

### Reference-flow acceptance contract

Preserve the dark urban bird/tarot identity and current artwork. Use quiet
surfaces, restrained teal/gold accents, and one unmistakable primary action.
Art supplies character; borders, glow and labels must serve decisions.
Essential rules stay complete in an explicit reading view; compact summaries
may use a marked ellipsis, never silently alter authored effects. Full rules
must paginate rather than shrink below their readable design size. Selection,
inspection, targeting and commitment are distinct states; closing help must
not change the selected card, target, resources, or turn.

Reference journey: title → leader/flight → route → ordinary battle → card
reward/Skip → Preen → route → boss → result → replay/resume. Before calling
this journey polished, verify every transition with pointer and keyboard,
controller event coverage, no pending-choice loss, exact previews, and no
browser errors. Inspect actual built screenshots at 2560×1600, 1440×900 and
1000×560, plus long-text, high-hand-count, low-health and reduced-motion states.
Controller event simulation does not replace physical-controller testing.

P0 = reference-flow clarity/correctness; P1 = systemic depth and consistency;
P2 = expansion after the foundation is proven.

| Package | Priority | Outcome / remaining acceptance |
| --- | --- | --- |
| D01 | P0 | One visual direction. Contract above established; apply consistently across every decision surface. **Partial.** |
| D02 | P0 | Shared surface/type/spacing tokens. `DECISION_UI` begins with combat details; migrate and inspect remaining menus. **Partial.** |
| D03 | P0 | Complete reference journey meets the contract above, not just isolated screenshots. |
| D04 | P0 | Remove competing focal points and duplicate information in each scene/state. Combat selection no longer requires a large automatic dossier. Codex cards, Supplies, Waymarks and enemies use quieter detail surfaces; item rules are complete and readable, enemy kits precede lore, and hidden boss tactics use one counted message. Leader dossiers and browser density remain. **Partial.** |
| D05 | P1 | Review the complete product against the same quality criteria before expanding content. |
| V01 | P0 | Combatant silhouettes, targets, intents and health remain readable against every district. Prior stage passes cover entry/boss; broader encounter matrix remains. **Partial.** |
| V02 | P0 | Persistent HUD has a clear survival/resource/action hierarchy, including crowded modifier states. **Partial.** |
| V03 | P0 | Separate selection, outcome forecast and confirmation; selection must not cover the leader. Explicit details implemented; full journey evidence remains. **Partial.** |
| V04 | P0 | Consolidate transient damage/status/passive notifications without losing inspectable causal order. |
| V05 | P0 | Reserve safe regions for hand, intents and actions during every animation and overlay. **Partial.** |
| A01 | P1 | Audit character/enemy/card art for consistent finish, lighting and scale; replace only demonstrated outliers. |
| A02 | P1 | Align combatant staging, shadows and contact points across all enemy formations. **Partial.** |
| A03 | P1 | Establish district-specific environment contrast without reducing essential readability. **Partial.** |
| A04 | P1 | Give effects consistent direction, origin, layer and semantic colors/shapes. |
| A05 | P1 | Review complete art at delivery resolution; eliminate placeholders, visual seams and inconsistent asset tiers. |
| C01 | P0 | Card face prioritizes name, cost and active effect; full authored rules are reachable without commitment. **Partial.** |
| C02 | P0 | Fixed-size, measured full-rule pagination for Now/Molt and long text. Hand and combat deck/draw/discard/cleared inspection share the 22px reader. Route comparisons use synchronized 18px pages. Explicit combat/route rewards and Preen/Release inspection share 22px measured pages for active/alternate rules, passive bonuses and full identity. Combat rewards also expose upgraded Molt rules and show printed costs/normal rules independent of the finished battle's stance. Route single-card Deck Review uses 22px measured pages for Now, Preen, Molt, upgraded Molt, passive bonuses and full identity. Market Waymarks, Supplies and services now use a stable 22px paged reader for effects, rules, build advice, purchase consequences and full identity. Market rules now use complete readable effect text; trigger frequencies match combat behavior, including the repeat-Supply exception. Non-Market item tooltips and remaining technical wording elsewhere remain; evidence is in progress.md. **Partial.** |
| C03 | P0 | Distinguish active effects, passive contribution, temporary changes and flight/collection persistence. Combat separates active/passive pages. **Partial.** |
| C04 | P1 | Compare exact add/remove/Preen/Market consequences with deck-size and draw assumptions. Existing comparison work remains partial (5, 7, 28, 31). |
| C05 | P1 | Complete glossary/vocabulary and icon consistency, with contextual definitions that preserve the decision. |
| I01 | P0 | Input acknowledges selection immediately and never loses a valid action silently. |
| I02 | P0 | Predictable select → target → commit → resolve; protect against double play and stale targets. **Partial.** |
| I03 | P0 | Inspect/Back restores exact selection and focus. Hand and combat pile reading preserve the pending card, target and pile focus; pile Back no longer counts as cancelling the card. Route comparisons retain pages through redraws and separate Pin/selection/Save/Close. Combat/route reward and Preen/Release readers preserve armed choices and pages through redraws and guard pause/settings. Market non-card readers preserve pages and purchase state, and hovering a different offer cannot replace an armed purchase's preview. Route readers share controller confirmation latches; combat rewards reject repeated keyboard Confirm so holding a key cannot close and then commit. Verify remaining overlays. **Partial.** |
| I04 | P0 | Pointer, remapped keyboard and controller navigation expose equivalent actions and accurate hints. **Partial.** |
| I05 | P0 | Remove redundant routine confirmations while preserving purchases, skips and irreversible decisions. **Partial.** |
| F01 | P0 | Measure input-to-feedback and effect-to-result timing; remove unexplained dead beats. Existing cadence regressions retained. **Partial.** |
| F02 | P0 | Telegraph → action → impact is readable; use overlap only when causal order stays clear. **Partial.** |
| F03 | P1 | Draw/play/discard/return and resource transitions share cohesive motion and appropriate emphasis. |
| F04 | P1 | Mix voices, impacts and music so simultaneous events do not mask essential feedback. |
| F05 | P0 | Pace, Hustle, reduced motion, pause and resume retain identical gameplay results. **Partial.** |
| G01 | P1 | Demonstrate several viable plans per Leader, not merely available card tags. |
| G02 | P1 | Evaluate card usefulness and common-card relevance across run stages and archetypes. |
| G03 | P1 | Audit infinites, excessive stalling and dominant wide/thin-deck strategies with reproducible evidence. |
| G04 | P1 | Preens change meaningful decisions and preserve viable alternatives. Runtime contracts exist; play evidence remains. **Partial.** |
| G05 | P1 | Tune fair randomness, pivot tools and difficulty using observed decision outcomes, not speculative nerfs. |
| E01 | P1 | Every enemy role creates a recognizable tactical question and understandable counterplay. |
| E02 | P1 | Enemy combinations vary sequencing and target priorities without unreadable status stacks. |
| E03 | P0 | Intent, phase threshold and exact result agree across status/interrupt edge cases. **Partial.** |
| E04 | P1 | Bosses test flexible preparation and adaptation rather than hidden rules or one required counter. |
| E05 | P1 | Tune ordinary/elite/boss duration, repetition and already-decided fight tails against play evidence. |
| R01 | P1 | Route tradeoffs reflect current health, build, resources and risk without prescribing one path. |
| R02 | P1 | Reward advice includes meaningful downside and does not equate rarity with usefulness. **Partial.** |
| R03 | P1 | Market purchase/save/Release/Preen/heal choices compete across actual run states. |
| R04 | P1 | Events and Supplies communicate known costs, uncertainty and lasting consequences before commitment. **Partial.** |
| R05 | P1 | Validate route generation, reward droughts and late-run pacing across seeds and Leaders. |
| U01 | P0 | Title exposes one obvious start/continue path; secondary tools stay secondary. Prior title cleanup retained; journey review remains. **Partial.** |
| U02 | P0 | Settings/help/rewards/results follow consistent hierarchy, navigation and Back behavior. **Partial.** |
| U03 | P1 | Playable, optional lessons teach damage/defense, Flow and Molt in context. |
| U04 | P1 | Continue and defeat explain current recovery point and actionable next steps. |
| U05 | P1 | Collection → comparison → Folio → practice is discoverable without a menu maze. |
| P01 | P2 | Collection unlocks expand strategies, not mandatory power or grinding. |
| P02 | P2 | Discoveries explain practical new combinations and acquisition paths. |
| P03 | P2 | Mastery records and cosmetics reward experimentation without confusing card identity. |
| P04 | P2 | Persistent optional challenges deepen replay without streak pressure or deadlines. |
| P05 | P2 | District events and character consequences produce memorable, coherent run stories. |
| X01 | P0 | Readable detail text and hit areas at supported sizes. Combat details, route single-card Deck Review, explicit route reward/Preen/Release and Market non-card readers use 22px logical body text and 58px paging controls; route comparison rules/index names use 18px at 2x resolution, with 58px paging/Pin/Close controls. Three-size built geometry evidence exists; Waymark/Supply shelves now separate 18px names and explicit Scrap prices from distinct 112px item art, with measured title excerpts and full names in inspection. Market services now use 20px names/explicit Scrap prices and separated 58–76px rows for early/later districts; unavailable Refresh exposes its exact shortfall without purchasing. Legacy catalog labels, remaining item tooltips and physical-device qualification remain. **Partial.** |
| X02 | P0 | Color, shape and wording communicate state redundantly; contrast remains valid in all options. |
| X03 | P0 | Complete remapping, input focus, reduced motion/flash and independent audio journeys. **Partial.** |
| X04 | P1 | Actual NVDA/VoiceOver journeys with recorded issues and fixes; automated narration checks are insufficient. |
| X05 | P1 | Physical touch/controller/device readability, suspension and sustained-play qualification. |
| T01 | P0 | Enforce boot/module/asset budgets and verify real transition stalls, not just averages. **Partial.** |
| T02 | P1 | Bound long-session allocations, texture ownership and listener/timer lifetimes. |
| T03 | P0 | Interruption recovery preserves advertised checkpoint, choices and collection without duplication. |
| T04 | P1 | Consolidate shared presentation/decision logic with regression coverage, not a speculative scene rewrite. **Partial.** |
| T05 | P0 | Validate deployment cache/chunks and retain rollback/recovery paths for updates. |
| Q01 | P0 | Repeatable automated rule/sequence/preview parity coverage, including combinations and stress states. **Partial.** |
| Q02 | P0 | Built visual and interaction evidence at all three sizes, including full-art gameplay. **Partial.** |
| Q03 | P1 | Authentic new/experienced-player sessions establish comprehension, pacing and enjoyment; retain the explicit owner waiver. |
| Q04 | P0 | Tie release claims to current revision, evidence, open defects and explicit waivers. Existing policy retained. **Partial.** |
| Q05 | P0 | Track remaining scope honestly; clean launched test resources and leave only the requested preview. **Partial.** |

Delivery order: D/V/C/I/X reference foundation → F/U/R end-to-end polish →
G/E balance and variety → P progression/story → T/Q release qualification.
Automated checks can prove geometry and state integrity; they cannot establish
that the game is beautiful, intuitive, or fun for real players. Those judgments
remain explicitly unverified until authentic feedback is available.

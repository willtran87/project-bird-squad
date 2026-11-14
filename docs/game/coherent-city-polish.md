# Coherent City polish — November 14, 2026

Accepted scope: the 48 recommendations in the conversation. Work extends the
published tactical-payoffs release; existing implemented features are not
counted as new additions. Canonical art, real rules, input ownership, saved
flights and delivery budgets remain constraints. No new character pose sheets.

Baseline: `6cd75264`. User edits in `AGENTS.md` are outside this change.

## Acceptance ledger

“Audited” retains an existing system after the bounded review below; it does
not claim a newly built feature or human acceptance. Full release qualification
passed for `0f06630b8a483e8ff1c53102339dfa279b70ae7e` (initial runtime
`7619e9a8`). Human observations cannot be supplied by automation. This branch
has not been merged or published; cold-start stalls and human acceptance remain open.

| IDs | Player outcome | Work / evidence | Status |
| --- | --- | --- | --- |
| 1–2 | Recurring characters retain species, anatomy, wardrobe and proportions across surfaces | Canonical gallery and `identity-continuity` checks; direction-sheet review | Audited; original assets retained |
| 3 | District lighting, materials, weather and accents form one visual world | `district-framing.ts`, corrected High Roost time, district direction sheets | Implemented and reviewed |
| 4–5 | Actors separate from scenery and remain grounded at all formations | Existing canonical portraits/contact shadows; `identity-continuity` crowded-layout checks | Audited and verified |
| 6 | Card art remains readable at hand size | All 110 portraits at small/full sizes; separate hand labels and Full rules retained | Audited; small-art limits documented |
| 7–12 | One actor, one clear result, clean transitions, restrained spectacle | Effect ownership matrix; outer weather priority; full/reduced action checks; canonical-body tests | Implemented, reviewed and verified |
| 13–15 | Selection, forecast uncertainty and resolved results are distinct | `render-hud.ts` estimate reasons, `coherent-city.spec.ts` live forecast/action checks | Implemented and verified |
| 16–18 | Relevant statuses and enemy relationships are discoverable; history explains causes | Existing Tell/rules readers; causal damage history checked against actual loss/blocked totals | Implemented and audited |
| 19 | Shared typography, spacing, controls and vocabulary across screens | Direction-sheet surface matrix; three-size briefing/arrival/resume/retry captures | Implemented and reviewed |
| 20–21 | District and encounter introductions explain place, threat and next action | Shared arrival framing and summit heading; real contract input tests | Implemented and verified |
| 22–24 | Inspection preserves context; commitment and decoration remain consistent | Existing context/input ownership retained; source review and release journey checks | Audited and verified |
| 25–28 | Lessons explain the goal, next action, outcome and retry | Five illustrated briefings, immediate retries, adaptive-guide audit; practice/backlog tests | Implemented and verified |
| 29–30 | Resume restores purpose; waiting serves reading instead of hiding latency | Saved plan on Continue; measured cold/warm entry; readable timing retained | Implemented; cold stalls remain open |
| 31–32 | Ordinary encounters present understandable tactical alternatives | Existing guard/Open Perch/Quiet Beat audit; six real strategy practices | Audited and made repeatable |
| 33–34 | Developing builds receive useful choices; Tempo diagnosis uses earned evidence | Qualified acquisition evidence below; new Relay practice; no unsupported balance buff | Bounded audit complete; human balance questions open |
| 35–36 | District encounters prepare for bosses with tension and recovery | Existing versioned route rhythm and preparation encounters; full campaign checks | Audited and verified |
| 37–40 | City, residents and rivals acknowledge saved actions consistently | Saved-event resident acknowledgements, existing restoration/rival chapters, signature practices | Implemented and audited |
| 41–42 | Outcomes suggest meaningful next flights and optional mastery | Existing highlights/next-flight advice; three added practice encounters and rematches | Implemented and audited |
| 43–44 | Sound explains actions and reinforces the current district | Four district ambience cues, Ambience volume routing and decisive-cue priority tests | Implemented and verified |
| 45 | Cold entry is measured separately and stalls investigated | Eight final native cold/warm samples plus earlier CPU trace; performance notes | Investigation complete; stalls unresolved |
| 46–47 | Full/reduced modes convey the same rules; complete journeys remain readable | Three-size local checks and full release/browser journeys pass | Automated and visual verification complete |
| 48 | Five real players demonstrate comprehension and report continuation intent | Existing human handoff; sessions unavailable | Awaiting human sessions |

## Completion rules

- Report actual code changes separately from audited existing behavior.
- Do not infer balance defects from scripted win rates alone.
- Retain failed measurements and unresolved outliers.
- Inspect native screenshots and transitional frames, not only assertions.
- Human, physical-device and assistive-technology acceptance remains explicit.

## Implemented changes

- Five practice lessons share an illustrated goal / first action / Start / Back
  briefing. Back preserves the selected lesson. Failures repeat the concrete
  first action and focus an immediate Retry action; practice remains isolated
  from the saved flight. Completed lessons also offer a repeat.
- District contracts now introduce place, premise and a tactical question.
  High Roost has its own encounter heading and pre-dawn weather description.
- The forecast notice explains the source of an estimate; critical choice and
  phase warnings retain priority. Damage history records the move, actual Cover
  absorbed and actual Cohesion lost. Combination coaching correctly says “this
  turn”, since Roost resets its sequence.
- Weather opacity yields during actions while its own movement remains on an
  inner container. Four restrained ambience cues follow the current district,
  obey Ambience volume and yield to decisive sounds.
- Continue includes the saved strategy. Residents acknowledge completed ferry,
  relay and summit aid without changing rewards or trust.
- Three optional signature-fight practices join the existing three strategy
  practices. All use actual encounters, supplied decks and isolated storage.
  Both conservative and pressure policies finish each of the six practices;
  this is mechanical verification, not an enjoyment or balance verdict.
- The reproducible source-art gallery and district / effect / screen direction
  sheets make the approved identities and presentation rules reviewable.

## Bounded gameplay audit

Existing ordinary encounters already expose tactical alternatives: alternating
Canal guards offer Cover/retained recovery attacks or focus fire; Open Perch
offers removing support or preparing for stored force; Quiet Beat offers hitting
Gather Force or preparing Cover. The existing Tell projections and signature
victory rules remain authoritative. The new mastery practices make these later
choices repeatable without risking a saved flight.

Existing build readers separate potential fit from observed contribution, and
the early earned Preen already offers complementary branches. The prior
qualified eighteen-run acquisition audit records Shelter / Tempo / Molt at
5/6, 2/6 and 5/6 wins, with 79 / 20 / 94 affordable branch hands and
42.36 / 12.82 / 26.51 blocked damage per fight. Tempo's sample has both fewer
survived fights and less defensive contribution. These totals cannot isolate
whether card availability, ranking policy or human decisions cause the gap.
They do not justify an arbitrary damage or reward buff. Preserve the earned-run
tests and the human handoff's Tempo questions. The new Relay practice provides
a concrete place to explore its timing and protection tradeoff.

Existing versioned route rhythm, preparation encounters, resident consequences,
rival chapters and flight highlights are retained. This pass does not count
them as newly implemented systems. Full qualification rechecked their integration.

## Failures retained during development

- The first focused run exposed a test that still skipped the new briefing;
  corrected it to use Start and verify storage before proceeding.
- Briefing geometry initially compared controls with the wrong text indices;
  the screenshot and corrected bounds confirm the real separation.
- New practice entries initially fell through the old encounter allowlist;
  extended the guarded practice-only allowlist and corrected Watch's district.
  All six practice/rematch tests then passed against the live rules.
- Initial module-size checks rejected the additions. Duplicate practice decks,
  repeated audio gain multiplications and HUD text styles were consolidated.
  District framing is an explicit lazy module with its own 2 KiB cap. Existing
  hard ceilings are unchanged; the final measured totals pass.
- Native screenshots caught route text behind the new arrival heading. An
  opaque header surface now separates the arrival text from the underlying HUD.
- Once failed lessons correctly focused Retry, a legacy test's Enter no longer
  exited practice. The test now uses Escape for Back. Deck practice state is
  checked through its shared registry rather than the battle-only snapshot.
- Initial full CI found the older Clear Choices assertion still requiring
  “unused in the fight” after the advice was corrected to “unused this turn”.
  Firefox passed its other 193 cases. Source `startPlayerTurn` and all 17 Flyway
  rule tests confirm the per-turn reset. Commit `fe9435a6` corrects only the test
  title/assertion; its two focused advice tests pass. The first workflow remains
  retained as failed evidence, and a fresh full run qualifies the correction.
- The initial full regression also found two exact history-string assertions
  that omitted the new causal suffix. Commit `496bd3c0` updates them and adds an
  explicit actual-loss check for overkill. The combat encounter, defeat review
  and lethal-phase tests pass locally. The queued intermediate run
  `43641927840` was cancelled before starting; it provides no qualification.
- All three initial browser runs finished with the same single stale advice
  assertion and 193 passing cases each. The core failure logs were limited to
  that assertion and the two history assertions. Build/Pages qualification was
  skipped by the dependency gate; it passed in the final corrected workflow.
- The second workflow exposed a pre-existing journal-test race: immediately
  after forcing defeat, the launcher can remain visible until its next position
  update while a lazy outcome panel owns input. Its `j` keypress was correctly
  rejected. Commit `34e59bc8` holds the outcome download deliberately, asserts
  the shortcut is blocked, releases the download, and waits for panel readiness
  before checking journal/archive keyboard navigation. Two repetitions in each
  of Chromium, Firefox and WebKit passed (six total). The first local fault
  injection used the wrong route-cleanup order; that harness failure is retained
  in `.artifacts/coherent-journal-boundary.log`. No game rule or timeout changed.
- Workflow `43645099978` passed all 1,187 core and 582 browser cases with zero
  failed, flaky, skipped or retried cases, then caught a Pages-base-path delivery
  overrun: optional menu UI exceeded its 6 KiB cap. Commit `0f06630b` consolidates
  repeated settings callbacks and tooltip styles without changing behavior.
  The corrected Pages build measures that chunk at 6,131 bytes / 6,144 and passes
  all bundle/cache checks and the actual Pages title/lazy-scene/combat/reload test.
  The failed build is retained; the final full workflow also passes these gates.

## Verification evidence

- Initial runtime: `7619e9a8366a12a65c087534cc1e132e16d93182`; final candidate
  with corrected tests and Pages menu consolidation: `0f06630b`.
  [Full qualification](https://github.com/willtran87/project-bird-squad/actions/runs/43649956534)
  passed all 30 verification jobs; deployment was skipped on this feature branch.
  [Initial failed run](https://github.com/willtran87/project-bird-squad/actions/runs/43640332553)
  and [journal-race run](https://github.com/willtran87/project-bird-squad/actions/runs/43642388459)
  are retained. No publication is implied by a feature-branch workflow.
- Exact final totals: 1,187 unique core cases across 26 regression/campaign/journey
  reports, and 582 browser cases (194 each in Chromium, Firefox and WebKit).
  Zero failed, flaky, skipped or retried cases; zero report-level errors.
  All 33 unit/policy checks and the actual Pages subdirectory smoke test passed.
  Reports: `.artifacts/coherent-release-ci`; aggregate:
  `.artifacts/coherent-release-ci-summary.json`; build identity:
  `.artifacts/coherent-release-verification/.artifacts/build-evidence.json`.
  Documentation-only completion commits do not replace this qualified code revision.
- Final focused `npm test` invocation passed all 17 coherent-city, backlog and
  audio cases with one worker and no retries. Earlier focused checks also passed
  the six actual practice/rematch scenarios and five canonical Leader actions.
  The final menu consolidation additionally passed three focused tests covering
  four volume channels, keyboard/gamepad settings and Leader tooltip presentation.
- Actual native captures reviewed: illustrated lessons, three-size arrival
  layouts, corrected High Roost header at 2560×1600, Continue at 1000×560,
  combat retry at 1000×560, deck retry at 1440×900, selection and action frames,
  all five canonical Leader commit captures at 2560×1600,
  four-enemy and boss-plus-three-support cue layouts at 2560×1600, and the
  natural-defeat live-keyboard journey at 1000×560. Initial CI runtime captures
  remain applicable to these surfaces; subsequent code changes only consolidate
  settings callbacks and tooltip styling, separately verified above.
  The source gallery
  review covers all 110 cards, five Leader pairs, five residents and four
  district pairs; its limits are documented in the direction sheet.
- The unmodified shared game client completed title → route → battle → selected
  card on runtime `7619e9a8`. Its native capture shows the canonical actor,
  intentional confirm control and named estimate reason. Artifact directory:
  `.artifacts/coherent-client-final`; no client error file was emitted.
- Final cold/warm measurements and the earlier CPU trace are retained in
  [performance notes](../project/performance-notes.md). Cold stalls are open.
- Build, content, asset, delivery-budget and deployment-cache checks passed.
  Root-path combined boot is 698.3 KiB / 700; the qualified Pages build is
  699.4 KiB / 700. Existing module ceilings are unchanged.
  Full local `npm run validate` passed its content/delivery checks and all 75
  sequencing cases with no retries (13 minutes). Full CI integration passed.
- Release-evidence policy passes with its existing explicit waivers; zero human
  sessions and zero manual-device evidence are not passing human acceptance.

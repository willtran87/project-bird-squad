# Coherent City polish — November 14, 2026

Accepted scope: the 48 recommendations in the conversation. Work extends the
published tactical-payoffs release; existing implemented features are not
counted as new additions. Canonical art, real rules, input ownership, saved
flights and delivery budgets remain constraints. No new character pose sheets.

Baseline: `6cd75264`. User edits in `AGENTS.md` are outside this change.

## Acceptance ledger

Status starts pending. Every completed row must point to implementation or
bounded audit evidence. Human observations cannot be supplied by automation.

| IDs | Player outcome | Work / evidence | Status |
| --- | --- | --- | --- |
| 1–2 | Recurring characters retain species, anatomy, wardrobe and proportions across surfaces | Canonical reference catalog and cross-surface identity review | Pending |
| 3 | District lighting, materials, weather and accents form one visual world | District direction sheets and shared framing | Pending |
| 4–5 | Actors separate from scenery and remain grounded at all formations | Battlefield separation / contact-shadow review | Pending |
| 6 | Card art remains readable at hand size | Complete playable-art gallery, small/full comparison | Pending |
| 7–12 | One actor, one clear result, clean transitions, restrained spectacle | Effect ownership, semantic cues, frame samples, reduced effects | Pending |
| 13–15 | Selection, forecast uncertainty and resolved results are distinct | Decision framing and uncertainty explanation | Pending |
| 16–18 | Relevant statuses and enemy relationships are discoverable; history explains causes | Tactical reading and causal history | Pending |
| 19 | Shared typography, spacing, controls and vocabulary across screens | Screen consistency matrix | Pending |
| 20–21 | District and encounter introductions explain place, threat and next action | Shared arrival / encounter framing | Pending |
| 22–24 | Inspection preserves context; commitment and decoration remain consistent | Input/overlay journeys and visual review | Pending |
| 25–28 | Lessons explain the goal, next action, outcome and retry | Guided practice improvements and saved-flight checks | Pending |
| 29–30 | Resume restores purpose; waiting serves reading instead of hiding latency | Resume context and timing review | Pending |
| 31–32 | Ordinary encounters present understandable tactical alternatives | Encounter teaching/alternative audit | Pending |
| 33–34 | Developing builds receive useful choices; Tempo diagnosis uses earned evidence | Acquisition/activation evidence and targeted guidance | Pending |
| 35–36 | District encounters prepare for bosses with tension and recovery | Route-pacing and boss-preparation audit | Pending |
| 37–40 | City, residents and rivals acknowledge saved actions consistently | Restoration, resident continuity and signature framing | Pending |
| 41–42 | Outcomes suggest meaningful next flights and optional mastery | Highlight/next-step advice and practice challenges | Pending |
| 43–44 | Sound explains actions and reinforces the current district | Cue priority and district ambience | Pending |
| 45 | Cold entry is measured separately and stalls investigated | Native cold/warm performance evidence | Pending |
| 46–47 | Full/reduced modes convey the same rules; complete journeys remain readable | Three-size production visual and browser checks | Pending |
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
them as newly implemented systems. Verification must recheck their integration.

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
  hard ceilings are unchanged; final measured totals must still pass.
- Native screenshots caught route text behind the new arrival heading. An
  opaque header surface now separates the arrival text from the underlying HUD.

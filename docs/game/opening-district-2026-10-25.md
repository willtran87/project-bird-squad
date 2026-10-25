# Opening district experience — October 25, 2026

User request: “make it happen” after the opening-district improvement proposal.

## Acceptance

- [x] Three optional, saved strategies with explicit drafting costs and benefits.
- [x] Cover → combination → Molt coaching tied to live legal opportunities.
- [x] Encounter introductions communicate the rooftop threat and Crow dilemma.
- [x] Authored anticipation, response and recovery; distinct Leader reactions.
- [x] Rewards explain their connection to the chosen strategy.
- [x] Saved neighborhood help produces visible, persistent world feedback.
- [x] Route artwork completion is coalesced and route pacing follows Settings.
- [x] Build, content, save, gameplay, lifecycle and visual verification (limits below).

The milestone deepens existing mechanics. Draft weighting applies only to
Rooftops battle card rewards, never saved offers, shops or later districts.
Human enjoyment and physical hardware performance require observed sessions;
automated gameplay and software-renderer measurements do not establish them.

## Implementation and verification

The Route journal presents Hold & Answer, Chorus Engine and Storm Window with
owned-card examples, upgrade advice and explicit tradeoffs. Selection is
reversible before a fight, survives checkpoints and does not grant free cards.
Contextual coaching is optional and respects the existing first-flight guide.
Five Leaders have short reactions to blocks, close escapes, combinations,
boss disruption and victory. Reduced motion retains the caption; missing
portrait art does not prevent it. Saved help for Sella lights the route.

Strategy presentation downloads after leaving the title. Existing download
recovery lets the player keep playing if it fails. Twelve artwork completion
notifications in one frame produce one route redraw; notifications received
while the journal pauses the route flush after resuming.

Focused verification: 12 cases passed across Chromium/Firefox in
`.artifacts/opening-cross-verified.json`. All six earlier WebKit cases passed in isolated
processes (`opening-webkit-{strategy.choices,plan.drafting,real.combinations}.json`
and `opening-webkit-verified-{saved.shelter,Crow.purpose,strategy.presentation}.json`).
Eleven rules/draw-comparison unit cases pass. The shared gameplay client ran
real card inputs; screenshots and state are retained under
`.artifacts/opening-client-final` and `.artifacts/opening-client-verified`.

Visual review covers 2560×1600, 1440×900 and the supported 1000×560 minimum. Initial
tests exposed and led to fixes for nested portrait lookup, paused artwork
refresh and encounter text/plaque overlap. Test corrections covered seeded
sampling distribution, queued scene transitions and the pre-existing download
recovery dialog. Windows WebKit cleanup stalls are retained as failed/incomplete
attempts; they are not counted as passing checks.

Native-clock before/after evidence and bundle measurements are recorded in
[performance notes](../project/performance-notes.md). Redraw coalescing is
verified, but the host measurements show no overall frame-rate gain.

`npm run validate` passed all static gates and 75 sequencing cases. The full
`npm test` run completed all 991 cases: 986 passed and five failed. The report
is retained at `.artifacts/opening-full-test.log`; it is not a clean full-suite
pass. All 17 campaign progression cases, all 15 strategy audits (45 encounters),
and the pointer/controller outcome-and-replay journeys passed. Scripted wins
or losses are valid terminal outcomes, not human balance evidence.

The failures exposed the wider strategy button intercepting checkpoint retry,
two tooltip readers being dismissed by deferred artwork repaint, a reward
preview without an effects list, and one missed keyboard-journey card commit.
The first three causes have source fixes and targeted regression coverage.
All 17 repaired-build checks passed in `.artifacts/opening-repair-results.json`.
The keyboard journey also passed independently without tracing after its test
waited for selected-card controls to finish rendering before commitment
(`.artifacts/opening-keyboard-native.json`). This was a test synchronization
repair, not evidence of a changed combat rule. No original failure has been
removed from the retained evidence. Three final reward-advice checks passed
in `.artifacts/opening-reward-verified.json`, including the added case proving
that a selected plan retains a visible and announced cost caution. Its
2560×1600 and 1000×560 screenshots were inspected.

Final WebKit reload and redraw reruns stalled on this Windows host after their
browser processes exited, leaving network helper processes and no completed
report. Those attempts were stopped. The older six-case WebKit pass does not
establish a clean final WebKit pass. This host limitation was subsequently
resolved by Linux CI: all 36 browser qualification cases passed (12 per engine)
in [PR verification](https://github.com/willtran87/project-bird-squad/actions/runs/40214567523).
Chromium/Firefox and targeted repaired-build evidence are complete. The initial
local run did not establish a clean 992-case pass after the added reward case.

## Five-player follow-up

The owner confirmed there are no sessions yet and requested a prepared handoff.
The [session kit](opening-district-playtest-handoff.md) is ready, with anonymous
P01–P05 tracking, observer prompts and instructions for returning real evidence.
The current-version waivers remain explicit; no human session is marked passed.

Use the existing [playtest runbook](playtest-runbook.md) and
[observer sheet](playtest-observer-template.md), with separate fresh profiles
and anonymous tester codes P01–P05. The observer should not choose a strategy or
explain the rules for the player. Capture these moments alongside the existing
local run export:

1. First meaningful Cover decision: what threat did the player think it solved?
2. First combination: did they notice it, and can they deliberately repeat it?
3. First Molt: can they explain the changed hand and exposed enemy phase?
4. First reward after choosing a plan: why add, Preen or skip?
5. Crow encounter: which target did they prioritize and why?
6. End of session: which bird or moment do they remember, and do they choose
   another run without prompting?

Record hesitation and misconceptions before offering help. Review patterns
across all five sessions before changing card numbers or adding more systems.
These sessions have **not** been performed; neither automated campaigns nor
generated player opinions count as this evidence.

## Release completion

- [x] Prepare the five-player handoff; retain unverified evidence honestly.
- [x] Correct the stale runbook statement about existing manual waivers.
- [x] Add pull-request regression and Linux browser gates before publication.
- [x] Obtain a clean full 992-case regression on the final implementation.
- [x] Complete final Chromium, Firefox and WebKit qualification (36 Linux cases).
- [x] Verify the Pages build, content, delivery budgets and checkpoint reload.

PR verification run **40214567523** passed **992/992** regression cases and
**36/36** browser checks, without skips or failures. The 29 completed job logs
were reconciled against the test catalog: 971 general cases, 17 campaigns and
four live-control journeys, with no duplicate cases. Compact local evidence:
`.artifacts/opening-pr-ci-summary.json`. The Pages build passed its static
validators, unit tests, existing waiver policy and production-subdirectory
smoke. The policy reports zero human sessions and manual audits; these are
waived, not passing evidence.

Publication, live artifact identity and branch cleanup are tracked in the final
checklist on [PR #11](https://github.com/willtran87/project-bird-squad/pull/11).
Main runs the same release gates before publishing. Documentation-only updates
do not alter the verified game implementation.

The new CI browser gate covers the opening-district cases, release smoke, and
reward-cost regressions in all three engines. Pull requests run verification
without Pages write permissions or deployment; only a passing main build
publishes. Original local failures and incomplete WebKit attempts remain in
the earlier evidence record.

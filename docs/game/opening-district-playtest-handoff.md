# Opening district playtest handoff

Status: **ready to schedule; no human sessions performed**. The owner requested
this handoff because no sessions are available yet. Existing release evidence
waivers remain explicit; preparation does not count as passing human, device or
assistive-technology evidence.

## Current session kit

- Game: <https://willtran87.github.io/project-bird-squad/?playtest=1>.
- Published revision: `cf44e250d96a9ca07bb1eee1a952d61df8716861`.
- Current scope and release evidence: [opening combat quality](opening-combat-quality.md).
- Instructions: [first-run runbook](playtest-runbook.md).
- One blank copy per tester: [observer sheet](playtest-observer-template.md).
- Manual hardware/accessibility checks: [release evidence runbook](release-evidence-runbook.md).

This protocol supersedes earlier batch-specific prompts about arbitrary
supporting Leader bodies and Living Battles atlas poses. Those presenters have
been retired. Identify the actual played bird, its target and its observed result.
Historical upgrade ledgers retain the earlier design and release records.

Arrange five fresh players. Each uses a separate empty browser profile with the
guide enabled. Let them choose their own Leader and strategy, including no
strategy. Observe silently through a complete run or voluntary abandonment;
do not prescribe a win or teach the intended sequence. If intervention is
necessary, record the confusion before helping. Do not teach combinations before
the player encounters a relevant opportunity.

After the first fight, ask:

1. Which bird acted, who was affected, and what changed?
2. What will the enemy do when you Roost, and what would Cover change?
3. Would you choose another fight now? Record the answer and reason verbatim.

After a signature encounter, ask what two approaches the player could take.
Record whether the ferry crossing, relay interception or rooftop escape is
understood, including its defeat-all alternative. For the relay, distinguish
stored force that remains from force already spent or removed with its recipient.

Record time to the first intentional play, target-selection errors, requests
for help, whether the player can explain the outcome, and voluntary continuation.
The desired milestone is at least four of five players making an intentional
first play and explaining the first fight without coaching. This is a proposed
acceptance target, not a measured result. Enjoyment and replay intent remain
player-reported.

| Anonymous code | Session status | Notes filename | Export filename and run ID |
| --- | --- | --- | --- |
| P01 | Not scheduled | P01.md | Pending |
| P02 | Not scheduled | P02.md | Pending |
| P03 | Not scheduled | P03.md | Pending |
| P04 | Not scheduled | P04.md | Pending |
| P05 | Not scheduled | P05.md | Pending |

## Optional later-run observations

After the opening observations, let players discover Calls, combinations and
Molt without coaching. Ask them to explain a chosen specialization or reward's
benefit and tradeoff. Observe the earned Canal gift and optional isolated demo.
After defeat, let them try Practice This Fight and explain the comparison.
Record whether resident favors and ending scenes reflect choices they remember.
Use questions after the relevant decision, never to teach its intended answer.

Players may mark Confusing, Satisfying or Slow through Journal → Practice &
feedback and export that local JSON voluntarily. Practice markers live only in
the practice session; export them before leaving. Record decision, animation,
reward-reading and final-enemy cleanup time separately. Optional local
`JSON.parse(render_game_to_text()).flyway.pacing` counters estimate these
categories during battle; journal/background time is excluded and cleanup is a
subset of decision time. Preserve actual observer notes; scripted timings do not
represent human comprehension or enjoyment.

## Return the evidence

After each completed run, use **Rate This Run**, record Fun, Fairness, Clarity
and Replay, then **Export N Runs**. Save the untouched JSON next to its observer
sheet in `.artifacts/playtest-sessions/`. Each sheet must name the exact
`Exported run ID: ...` and filename; never invent ratings for an abandoned run.
Keep tester identities out of the files. Exports stay local until deliberately
shared with the project owner.

Generate a dashboard using real exports only:

```powershell
node tools/playtest-stats.mjs .artifacts/playtest-sessions
node tools/validate-release-evidence.mjs --strict-human
```

The strict human check must remain failing until five valid rated exports and
matching notes exist. It does not validate comprehension by itself. Review the
notes for four-of-five comprehension, repeated hesitation, ratings of 1–2,
and voluntary replay. Record each repeated issue with its reproduction, impact
and follow-up; retain the original observations after fixes. Physical-device
and NVDA/VoiceOver evidence remains separate and unverified until those actual
sessions occur; `--strict-manual` additionally requires them.

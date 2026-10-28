# Opening district playtest handoff

Status: **ready to schedule; no human sessions performed**. The owner requested
this handoff because no sessions are available yet. The current 0.1.0 release
retains its explicit evidence waivers; preparation does not count as passing
human, device or assistive-technology evidence.

## Session kit

Flock in Motion follow-up: use the deployed revision recorded in the
[current upgrade ledger](flock-in-motion-faster-flights.md). Ask players to point
to incoming damage and remaining Wingbeats, identify the card that just acted,
and explain one resolved payoff. Observe whether familiar enemy actions remain
readable and whether opening Full rules during a cast feels predictable. At the
reward screen, ask them to use observed contributions to explain a choice;
check that they distinguish Cover gained from damage prevented. Record confusion
and preference verbatim. No sessions for this upgrade have been performed.

Signal Spires follow-up: once this upgrade is published, record its actual
deployed revision from [the release ledger](signal-spires-clarity-upgrade.md).
After the opening observations, ask returning players to explain one relay Tell,
their chosen Spires signature's tradeoff, and why they chose a Molt window.
Observe whether the shorter card face leads naturally to Full rules, whether
the Wingbeat forecast predicts their next action, and whether Ivo/Oren's High
Roost contribution is noticed. Record confusion before providing assistance.
No Signal Spires sessions have been performed.

- Game: <https://willtran87.github.io/project-bird-squad/?playtest=1>.
  The opening-district release is published and live-verified at revision
  `f699a3bb1c099f1d928859683eb59d6e7adc765f`. Record this revision alongside the
  URL; check the [release report](opening-district-2026-10-25.md#published-release)
  for later updates before starting a session.
- Instructions: [first-run runbook](playtest-runbook.md).
- One blank copy per tester: [observer sheet](playtest-observer-template.md).
- Focus: [six opening-district moments](opening-district-2026-10-25.md#five-player-follow-up).
- Manual hardware/accessibility checks: [release evidence runbook](release-evidence-runbook.md).

Arrange five fresh players. Each uses a separate empty browser profile with the
guide enabled. Let them choose their own Leader and strategy, including no
strategy. Observe silently through a complete run or voluntary abandonment;
do not prescribe a win or teach the intended sequence. If intervention is
necessary, record the confusion before helping. Ask comprehension questions
after the first fight and collect ratings only from the player.

| Anonymous code | Session status | Notes filename | Export filename and run ID |
| --- | --- | --- | --- |
| P01 | Not scheduled | P01.md | Pending |
| P02 | Not scheduled | P02.md | Pending |
| P03 | Not scheduled | P03.md | Pending |
| P04 | Not scheduled | P04.md | Pending |
| P05 | Not scheduled | P05.md | Pending |

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

## High Roost + The Living City follow-up

Use the release revision recorded in `high-roost-living-city-upgrade.md`. No
sessions have been supplied for this milestone. Ask each participant to explain
the shield and signal perches before choosing a target, then compare the next
Tell after disabling one. Record whether stored force remaining after a Falcon
defeat surprises them. Observe one defensive and one aggressive approach without
coaching. Note repeated cleanup turns and whether the recovery fork feels useful.

Ask which earlier choice opened each resident favor and whether the three ending
scenes match their own flight. Let them discover Skip and Replay themselves.
Record which specific replay invitation they remember, any unreadable Tells or
hidden card details, and whether they voluntarily begin another flight. These
observations supplement the existing five-player protocol; automated scripts
are mechanics evidence only.

## Flock Identity + Rival Stories follow-up

Use the deployed revision recorded in `flock-identity-rival-stories-upgrade.md`.
No sessions have been supplied. Observe whether the player notices a ready Call
and discovers a combination without opening the full journal. Ask them to explain
the specialization they chose and what it gives up. On a rival rematch, record
which support bird they target and whether Caldra's next formation feels fair.
After an ending, ask which story they would voluntarily try next.

Record active decision, animation, reward-reading and final-enemy cleanup time
separately. Optional local `JSON.parse(render_game_to_text()).flyway.pacing` counters estimate
these categories during battle; journal/background time is excluded, and cleanup
is a subset of decision time. Preserve the observer's actual notes and timing;
scripted fixture timings do not represent human comprehension or enjoyment.

# Opening district playtest handoff

Status: **ready to schedule; no human sessions performed**. The owner requested
this handoff because no sessions are available yet. The current 0.1.0 release
retains its explicit evidence waivers; preparation does not count as passing
human, device or assistive-technology evidence.

## Session kit

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

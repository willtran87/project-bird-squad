# First-Run Playtest Runbook

Bird Squad's release gate requires five observed first-run sessions. Automated
and seeded runs prove the telemetry pipeline, but they do not count as human
evidence.

## Prepare Each Tester

1. Give each tester a separate browser profile, private window, or device so
   account, guide, and run history begin empty.
2. Open the production game with `?playtest=1` appended to its URL.
3. Do not explain route confirmation, targeting, Roost, Tells, Cover, Flow, or
   reward skipping unless the tester becomes completely stuck.
4. Observe the questions in the Measurement Plan of
   `docs/game/game-experience-audit.md` and record concise notes separately.

The query flag changes no gameplay and uploads nothing. It only adds a local
export command to the Flock Record.

## Export A Session

After a win or loss, choose **Rate This Run** on the outcome screen. This opens
the local Save Data panel with the completed run focused. Rate it from 1–5 for
**Fun**, **Fair**, **Clear**, and **Replay**; each choice saves immediately to
that local run. Then choose **Export N Runs**. The button downloads
`bird-squad-runs-YYYY-MM-DD.json`; its subtitle explicitly states that ratings
and exports stay local and perform no network upload. The longer Flock Record
→ Save Data route remains available if the tester closes the outcome first.

Ratings do not replace observer notes. They add a consistent subjective signal
that can be compared with the recorded route, combat, input-friction, and
completion evidence.

Keep each tester's download as a separate file. The run ID prevents accidental
duplicates when the dashboard merges files.

## Build The Dashboard

Place the downloads in `.artifacts/playtest-sessions/`, then run:

```powershell
npm run stats:playtest -- .artifacts/playtest-sessions
```

The command accepts one JSON file, several file arguments, or a directory of
JSON exports. It merges and deduplicates run IDs, then writes
`.artifacts/playtest-dashboard.md`.

Do not use `--seeded` or `--seeded-if-empty` for release evidence. Those modes
are pipeline checks only.

## Release Evidence

The five-session gate is satisfied only when:

- all five testers are genuinely fresh players;
- observed notes cover route confirmation, targeting, Roost, Tells, Cover, and
  reward selection;
- all five exported runs contain complete Fun, Fairness, Clarity, and Replay
  ratings from the tester who played that run;
- at least four of five can explain Cohesion, Cover, Wingbeats, and enemy Tells
  after the first fight;
- the exported dashboard source names the human session files rather than the
  seeded pipeline harness;
- repeated confusion is either corrected or recorded as an open release issue.
- repeated low ratings (1–2) in any experience dimension are investigated or
  recorded as an open release issue.

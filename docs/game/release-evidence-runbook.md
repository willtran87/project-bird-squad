# Final Release Evidence

`npm run release:verify` is the final-release gate. It combines the normal
static/sequencing validation, the Chromium/Firefox/WebKit smoke matrix, and
manual evidence that automation cannot manufacture.

## Fresh-player evidence

The project-owner waiver dated 2026-07-30 applies to the current `0.1.0`
release's five-session gate only. The version-scoped record is
`docs/game/release-evidence-policy.json`; the validator prints **WAIVED**, not
passing human evidence. A missing, invalid, or different-version policy fails
closed. New releases require an explicit policy decision; do not carry a waiver
forward automatically. The September 26 reconciliation also records the
owner's explicitly skipped device and assistive-technology sessions as waived;
see `release-waiver-reconciliation.md`. These remain unverified, not passed.

For optional human evidence, follow `docs/game/playtest-runbook.md`. Place at least five separate JSON
exports and their matching observation sheets in
`.artifacts/playtest-sessions/`. Each run must be non-seeded, have a unique run
ID, and include 1–5 ratings for Fun, Fairness, Clarity, and Replay. Each copied
observer sheet must contain `Exported run ID: <id>` for its matching run.

## Physical-device and assistive-technology evidence

Create `.artifacts/release-evidence/manual-audits.json` after performing the
audits. Never pre-populate passing rows. When manual qualification is required,
the environments are:

- low-end Windows hardware;
- Android tablet;
- iPad;
- NVDA on a supported desktop browser;
- VoiceOver on a supported Apple browser.

Each completed row uses this shape:

```json
{
  "kind": "physical-device",
  "environment": "low-end Windows 11 laptop",
  "revision": "full git revision",
  "passed": true,
  "notes": "Cold-cache load, first fight, reward, settings, suspend/resume, and input observations."
}
```

Use `"kind": "assistive-tech"` for NVDA and VoiceOver rows. Notes must name
the browser, input method, journey exercised, and any accepted issue. A passing
row means the production revision was actually exercised; seeded automation,
emulation, or an empty checklist does not count.

## Development versus release gates

`npm run validate` remains deterministic and suitable for normal development.
It does not claim that subjective experience or physical assistive technology
was tested. `npm run release:verify` must pass every automated gate and prints
the explicit current-version waivers. Policy satisfaction with waivers does
not establish human experience, physical-device or assistive-technology quality.

Run `node tools/validate-release-evidence.mjs --strict-human --strict-manual`
to require authentic player and manual evidence without modifying policy. Supplied
session files must remain valid and rated human runs still require matching
observer notes even when the minimum session count is waived.

A supplied manual audit with `passed: false` still fails validation. Waivers
allow missing owner-skipped evidence; they never conceal a recorded failure.

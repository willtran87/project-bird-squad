# Publication verification — 2026-10-23

The 2026-10-22 qualification is the retained local baseline for candidate
`index-Cl7N8-97.js`. It does not establish a successful GitHub Actions run or
publication of the subsequent release.

## First publication attempt

- Release commit `95710716` was merged by PR #1 as `e23b1306`.
- GitHub Actions run `39918444492` reached the existing 180-minute job limit
  during production regression. Deployment was skipped.
- The retained log records 35 failed cases before cancellation; most are test
  timeouts. The unfinished suite is not a passing release gate.
- The full log and downloaded evidence are retained under
  `D:/codex-bird-squad-closure24-20261021/evidence/` as `github-timeout.log`,
  `github-timeout-errors.json`, and `github-timeout-artifact/`.

## Corrections for the next attempt

- Run the entire regression selection as eight disjoint Playwright shards, with
  one browser worker per runner to avoid competition for software rendering.
  Live-control journeys remain serial in a separate job. Every shard and every
  journey must pass before the Pages build and deployment can run.
- Preserve the regression's 90-second default test limit and existing explicit
  per-case limits. No assertion, test family, or release gate is skipped.
- Separate the three viewport checks for each pending clipboard operation into
  individual cases. Each still tests duplicate input, pending/error/retry
  behavior, exact bounds, and saved-data preservation. The real stalled-copy
  timeout cases remain intact. This expands regression discovery from 903 to 909.
- A discovery comparison confirms all 909 cases appear exactly once across the
  eight shards (114/114/114/114/114/113/113/113), with no missing or duplicate IDs.
- Move the Codex card title upward by four game pixels to reserve a clear lane
  above the ownership/cost labels with Linux font metrics. Anchor Market prices
  by their bottom edge so the same eight-pixel footer clearance holds across fonts.
- Wait for save restoration's actual navigation before reading restored storage;
  use the existing deterministic game clock for the Text Pace banner check and
  inspect route travel effects without yielding to an unrelated render frame.
- Exercise ten repeated card-art redraws in one browser call, preserving the
  request-count and armed-decision assertions while avoiding network round-trip
  delays that accidentally turn the pending-load test into an XHR-timeout test.

## Local verification of these corrections

- Production build/TypeScript and 29 focused checks pass with zero retries.
- Market and the affected Codex card inspected at 2560×1600, 1440×900, and
  1000×560. Labels remain separate and artwork stays unobscured.
- The unmodified shared web-game client plays First Flight in combat, with the
  screenshot matching the text state and no error artifact.
- Documentation, workflow parsing/dependency checks, shard coverage, whitespace,
  and hard bundle caps pass. Preferred bundle targets remain warnings.
- Evidence: `release-fixes.json`, `release-fixes.log`, `release-shard-coverage.json`,
  `release-fix-captures/`, `release-codex-*.png`, and `release-fix-client/` in the
  same retained evidence directory. These are focused checks, not a new local
  full-suite qualification.

The next GitHub run and its retained per-job reports determine publication status.
The local baseline's human/player/device/assistive-technology waivers and measured
software-rendering limitations remain unchanged.

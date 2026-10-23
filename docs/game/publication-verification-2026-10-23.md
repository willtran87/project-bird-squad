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

## Runner image correction

Run `39941933620` stopped during browser installation: `ubuntu-latest` selected
Ubuntu 26.04, which pinned Playwright 1.60.0 does not support. Pin the workflow's
runner image to supported Ubuntu 24.04 so platform rollouts cannot change the
test environment implicitly. This setup failure ran no regression cases and
published no Pages artifact.

## Linux timing follow-up

The Ubuntu 24.04 run `39942128032` reached the tests. Its completed shards found
two live-region assertions sampling old district-contract speech after only
120 ms. The runtime polls every 300 ms and deliberately holds direct announcements
for 1.8 seconds. Both tests now wait up to five seconds for the selected route
risk or boss name before retaining the same content and geometry assertions.

The integrated Market input test reached its two-minute total limit halfway
through its 760-line purchase/cancellation/section/unavailable-inventory flow.
Its per-case limit is now five minutes for software-rendered CI; interaction
conditions, input modes, screenshots, and assertions are unchanged. The global
90-second default remains unchanged. These follow-up changes affect tests only.

All three corrected cases passed locally without retries in 1.9 minutes
(`release-timing.json` / `release-timing.log` in the retained evidence directory).

The next release uses 16 single-worker regression shards. The first eight-shard
Linux run showed uneven completion times (20 minutes for shard 2, 35 minutes for
shard 8), so smaller groups reduce the longest regression job while retaining
the same cases and the separate serial journey prerequisite.

Shard 1 also exceeded a two-minute total limit while capturing boss preparation
across four districts and three viewports. Each district is now a separate case,
retaining the three-size resize sequence, all three reader sections, narration,
geometry, state preservation, and screenshots. The per-case limit stays two
minutes. This adds three independently scheduled cases (912 regressions total).
All four district cases pass locally without retries in 2.0 minutes
(`release-boss-timing.json` / `release-boss-timing.log`).
Fresh discovery confirms all 912 cases appear exactly once across the 16 shards
(57 each), with zero missing or duplicate IDs (`release16-shard-coverage.json`).

Shard 3 reached the final controller checks of the default event-navigation
audit before its three-minute limit. Its 38-signal / 152-choice content audit
reported zero failures; the remapped variant passed in 2.9 minutes. Both variants
now have a five-minute total budget for the full multi-event, multi-viewport,
long-text and input-ownership lifecycle. Their assertions remain unchanged.
Both pass locally without retries in 3.1 minutes (`release-event-timing.json` /
`release-event-timing.log`). Nine focused cases now pass across this follow-up.

The completed Linux run recorded 901/909 passing regressions, eight failures,
and 4/4 passing live journeys. Its final three failures were equipped full-run
simulations (Talon, Tidewarden, Roostkeeper; seed 2) reaching their four-minute
total limit while still progressing. Seed-1 Tidewarden/Roostkeeper passed in
3.9/3.8 minutes. The full-campaign family now has an eight-minute total budget;
the 240-transition limit, legal-action policy, terminal outcome, run identity,
finite HP, and error assertions remain unchanged. These scenarios passed in
the earlier complete local qualification; the new remote run will verify the
larger budget on Linux. No failing test or release prerequisite is omitted.

## Asynchronous snapshot follow-up

Run `39950281821` confirmed the repaired boss-preparation announcement case, but
found two more asynchronous test reads: the district reward summary still held
its loading announcement, and the title-control test read audio counters from
RouteScene's minimal startup snapshot before its debug module was ready.

The reward assertions now wait on the live DOM text. An audit found four more
snapshot-only speech assertions (route gain, singleton Snag, saved-Folio usage,
and card acquisition); these now use the same awaited DOM assertions. The title
test waits for audio counters before checking the exact eleven-cue difference.
All expected text, counters, state, and geometry checks are preserved; production
code is unchanged. Six focused cases pass locally without retries, recorded in
`release-announcements.json` and `release-title-readiness.json` in the evidence
directory. The full remote verification remains required before publication.
The audit also converted the equivalent live-text checks in discard recovery,
reward skipping, combat reward commitment and route reward commitment. Those
four cases pass locally (`release-choice-announcements.json`), bringing this
follow-up to ten passing focused cases without retries. Historical narration
snapshots and checks that already wait for speech retain their existing logic.

The serial journey job passed natural defeat, keyboard flight (9.5 minutes),
and pointer flight (12.7 minutes), then reached the controller flight's old
20-minute limit while still advancing at decision 260. Full live flights now
have 30-minute total budgets. Their 20-second action deadlines, 320-decision
bounds, no-progress guards, input-purity checks, terminal outcomes and replay
assertions are unchanged; the short defeat case keeps its existing limit.

Each of the four journeys now runs alone with one browser worker on an isolated
runner, avoiding a 43.5-minute serial queue. Build still depends on the entire
journey matrix plus all regression shards. YAML parsing and test discovery
confirm exactly one match per journey, all four covered once, and unchanged
build/deploy dependencies (`release-journey-matrix.json`).

The completed run passed 910/912 regressions and 3/4 live journeys. All three
previously timed-out full-campaign simulations passed in 4.1 minutes each, but
their combined regression shard took 47.1 minutes. The next workflow therefore
places all 14 seeded campaign cases in six separate single-worker shards. The
remaining 898 regressions stay in 16 shards, and all four live journeys have
isolated shards. Generic family filters and Playwright sharding include future
cases without maintaining a hand-picked list of test names. Build depends on
all three matrices before Pages verification and deployment can run.
Fresh CLI discovery plus YAML validation proves all 916 cases occur exactly
once across the three matrices (898 + 14 + 4), with no missing or duplicate IDs
and all release dependencies intact (`release-family-coverage.json`).

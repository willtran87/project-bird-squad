# Opening mastery — 2026-11-01

Accepted scope: a focused opening polish pass, followed by full release
qualification and publication. Human sessions remain a prepared handoff.

## Changes

- Guided opening: existing owned copies of First Flight, Quill Point, Nest
  Fledgling, Basin Fledgling and Locked Nest are brought forward when present.
  Cards are never injected or removed. Costs, hand size and choices remain real.
  The existing Skip guide option bypasses this order. Later shuffles are unchanged.
- Hand faces: each action precedes its complete condition, preserving written
  effect order. Full rules, target and spending semantics remain available.
  The renderer measures all clauses that fit instead of imposing a two-effect
  ceiling. Overflow explicitly directs the player to Inspect.
- Tactical reading: full/partial blocks report actual damage prevented and
  Cohesion lost in the existing feedback line. Actual card payoff detail includes
  earned signature victory and objective consequences where applicable.
- Strategy showcases: Journal → Practice & feedback offers Hold & Answer against
  Alternating Watch, Chorus Engine against Open Perch, and Storm Window against
  Quiet Beat. Each supplies six real cards, explains the opportunity, alternative
  and drawback, and supports Practice This Fight. These reuse the authored
  encounter rules; no broad balance improvement is claimed without player data.
  Practice runs entirely in memory, grants no progression, and leaves the saved
  flight available through Main Menu → Continue.
- Presentation: anticipation, commitment and settling align with the actual card
  travel. The card cue retires at resolution. Combination feedback no longer
  duplicates the resolved effect's contact sound. Canonical identities, still
  alternatives and existing combat timings remain intact.

## Verification

The first clean local sweep passed 21 checks, including the complete card pool,
guided/unguided hands, real full blocks, all three practice challenges, save
preservation and existing identity/action feedback. Captures were inspected at
2560×1600, 1440×900 and 1000×560. The unmodified shared client reached combat
and played cards with full art and no recorded errors.

Development checks caught and corrected an absent-feedback guard and the
Journal's intentionally paused scene being rejected by the challenge launcher.
The initial three module budget failures were resolved through lazy practice
loading and shared text formatting; these failed attempts are not release passes.

The actual Pages build passes at 709.7 KiB of boot code under 710 KiB. Combined
hand/reward presentation is 20.2 KiB under 24 KiB. The final expanded lifecycle,
alternate-policy and identity sweep passed 24 checks. Another 24 opening-mastery
checks passed across Chromium, Firefox and WebKit, along with three focused
presentation and actual-impact audio checks. Evidence is under `.artifacts/mastery-*`.
The first full CI attempt exposed an obsolete assertion requiring a duplicate
combination-caption sound. It was corrected to require sound for Calls and no
extra sound for bare combination notices; actual card and rival audio remains
covered separately. That diagnostic run does not qualify the release.
The next diagnostic run exposed a Firefox test-harness race around queued Phaser
scene restarts. The new tests now require a fresh battle initialization before
reading the opening hand or driving a rematch, rather than accepting the outgoing
scene's ready state. All three browser engines are checked before resubmission.
The third run passed all 1,131 core and 453 browser cases without retries or
skips, but Chromium reached the old 30-minute job deadline at completion and the
workflow skipped its build. Browser job allowance is now 45 minutes for the
expanded 151-case suite, setup and evidence retention; per-test limits and all
checks remain unchanged. The canceled workflow is not release qualification.
Existing hard delivery limits remain unchanged; extracted card-rule formatting
counts toward the original combined 24 KiB hand/reward allowance.

## Published release

[PR #21](https://github.com/willtran87/project-bird-squad/pull/21) merged as
`39f7e522295bfb3b59258f59cc130181a6a5df82`; its complete tree matches qualified
head `496e44821a4884f018942f3ef260e79b615ea2e0`.

- [PR qualification](https://github.com/willtran87/project-bird-squad/actions/runs/41387759139)
  and [production qualification/publication](https://github.com/willtran87/project-bird-squad/actions/runs/41390784166)
  both passed 1,131 core and 453 browser cases with no retries, skips or failures,
  plus 33 unit/policy checks, content/assets, budgets and the actual Pages-path smoke test.
- Both artifacts came from clean checkouts. All 2,666 source files, application
  chunks, entry and HTML hashes match; source SHA-256 is
  `dbbd57c4e40a10f375f7aab0e1893f9d5622b447dac85cff2b0250377c0323c7`.
- All 101 checked public files match the published artifact byte-for-byte,
  including ten canonical leader images. No retired Living Battles atlas is included.
- All 25 live-site checks passed, including identity continuity, crowded layouts,
  guide bypass/reload, real blocks, three challenge retries and save preservation,
  full/reduced motion and Pages checkpoint reload. Published high-resolution and
  compact captures were inspected. The unmodified shared client played two cards
  with full art, no recorded browser errors and zero lingering action objects.
- Local and remote feature branches were removed after tree verification; only
  `main` remains. The task-owned port 5419 preview was stopped. A documentation-only
  closure follows publication without replacing the qualified runtime revision.

Retained local evidence: `.artifacts/mastery-pr-release`,
`.artifacts/mastery-main-final`, `.artifacts/mastery-build-comparison.json`,
`.artifacts/mastery-live-files.json`, `.artifacts/mastery-public.log`,
`.artifacts/mastery-public-verified` and `.artifacts/mastery-public-client`.
The three diagnostic CI runs above remain separate from passing release evidence.

## Human acceptance

No sessions have occurred. Use the [five-player handoff](opening-district-playtest-handoff.md)
and record observed first-fight comprehension, alternative tactics and voluntary
continuation. Four of five unaided explanations is a proposed target, not a result.
Human/device/native-assistive-technology evidence remains unverified.

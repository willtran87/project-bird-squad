# Opening combat quality — 2026-10-29

Scope accepted after the identity audit: release the cleanup, make each action
readable, represent the actual flock, clarify tactical alternatives, introduce
complexity progressively and prepare five real-player sessions.

## Implementation

- The identity audit's canonical portraits and clear presentation are the baseline.
- Played cards own the spotlight: their exact card artwork, name, species,
  instance and target identify the bird acting. The Leader stays quiet during
  another bird's card action; Leader Calls and reactions remain distinct.
- One anticipation/commit/settle sequence fits inside the existing resolution
  time. Contact/recovery follow real resolution; reduced motion uses still cues.
  No new animation atlas or arbitrary supporting character is introduced.
- The existing feedback line identifies the actor and target during the cast,
  then reports its observed result. Full accessible detail includes all tracked
  contributions and the actual pair of cards that triggered a combination.
  That pairing is consumed once and cannot leak into a later play.
- The ferry, relay and rooftop fights show contextual tactical alternatives in
  the same line when idle. Their authored victory rules, forecasts and balance
  remain intact; no unobserved balance claim is made.
- The first-turn guide focuses on selection, target, cost and enemy damage.
  Combination suggestions wait until the basic guide is complete and require
  an affordable matching card in the current hand. No future draws are exposed.
- The five-player handoff now tests actor/target/result comprehension, enemy
  intent, tactical choice and voluntary continuation. Human sessions remain zero.

## Verification and release

Local implementation checks passed: production build, runtime/data/assets,
documentation, cache and unchanged delivery budgets. The final Pages build
measures 709.0 KiB of boot code under its 710 KiB cap.
All eight new feature cases passed in Chromium after correcting a paused-clock
label expiry and waiting for the defense fixture's actual card art to load.
The existing timing, five-style and feedback-layout checks also passed.
Visual captures were inspected at 2560×1600, 1440×900 and 1000×560; the shared
game client reached combat, played cards and left no lingering action objects.
Evidence: `.artifacts/opening-quality-verified/`, `opening-quality-final/`,
`opening-quality-client/` and the corresponding logs.

Final review also found stale relay guidance after stored force was consumed
or its recipient defeated. Both the tactical line and relay phase caption now
check the living enemies' actual bonus; boundary and rendered-line regressions
cover those transitions. The first PR workflow was canceled for this correction
and is not release evidence.

Full regression then caught Talon's repaired tail extending into the hand area.
Leader placement now uses the cached visible silhouette to reserve clearance
for bounded Call/recoil movement; portrait proportions and the matching contact
shadow are preserved. The full-cast grounding test retains its strict stage
and panel clearance checks and now includes exact bounds in failure diagnostics.

The next full run passed all 1,123 gameplay and 429 browser cases, then caught
the foreground renderer exceeding its unchanged 8 KiB delivery budget. Portrait
placement now follows enemy placement: the scene prepares geometry and the lazy
renderer draws that view. The actual Pages build passes both the renderer and
710 KiB boot budgets. Superseded runs are diagnostic evidence, not release passes.

A later run exposed an existing reward-warning fixture that searched 32 random
drafts for an expensive shelter card. That setup could fail before exercising
the UI. It now supplies a fixed random stream to the real reward factory; all
cost-warning, spoken-feedback, viewport and no-commitment assertions remain.
Reward gameplay and selection weights are unchanged.

All 16 local Firefox/WebKit feature assertions passed, but the Windows WebKit
worker subsequently timed out during shutdown. That run is not a clean suite
pass; final release qualification requires the full CI workflow to exit cleanly.

Automated success does not establish enjoyment or replace the human milestone.
Existing owner waivers remain explicit; no human, physical-device or native-AT
evidence was added.

## Published release — 2026-10-30

Published through [PR #20](https://github.com/willtran87/project-bird-squad/pull/20)
at `cf44e250d96a9ca07bb1eee1a952d61df8716861`.
Play [Bird Squad](https://willtran87.github.io/project-bird-squad/).

| Gate | PR qualification | Production qualification |
| --- | --- | --- |
| Workflow | [41015640816](https://github.com/willtran87/project-bird-squad/actions/runs/41015640816) | [41019724232](https://github.com/willtran87/project-bird-squad/actions/runs/41019724232) |
| Gameplay cases | 1,123 passed | 1,123 passed |
| Chromium / Firefox / WebKit cases | 429 passed | 429 passed |
| Unit and release-policy cases | 33 passed | 33 passed |
| Content, assets, bundles, cache and Pages base | Passed | Passed |
| Failed / flaky / skipped / retried cases | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |

The PR and production builds are clean and have identical source, application
chunk and HTML hashes. Source SHA-256:
`a138020daa2fa5f5d43e7d12c75bb3d3ee85eef298a3b60ab2ea155c2f283dbe`.
All 99 checked public files match the deployed artifact by SHA-256 and byte
length. These include all HTML/JS/CSS, all ten canonical leader portraits and
related leader assets. Neither retired Living Battles atlas is in the artifact.
Pages boot is 709.0 KiB under the unchanged 710 KiB cap; the foreground renderer
is 8,093 bytes under its unchanged 8 KiB cap. No general FPS gain is claimed.

All 17 post-deployment checks passed without retries: full-cast grounding,
seven identity-continuity checks, eight opening-quality checks and the Pages
load/checkpoint smoke. The unmodified shared game client played three cards
with full art, no recorded console errors, no failed asset groups and no
lingering action objects. Public screenshots were reviewed at compact and
high-resolution sizes, including crowded Talon placement and a real attack cue.

The merged feature branch was deleted locally and remotely; only `main`
remains. The task-owned preview was stopped and the user's existing preview
preserved. Final release-record and handoff edits are documentation only;
the qualified and published runtime remains `cf44e250`.

Evidence: `.artifacts/opening-quality-pr-clean`, `opening-quality-main-clean`,
`opening-quality-build-comparison.json`, `opening-quality-pages-manifest.json`,
`opening-quality-live-files.json`, `opening-quality-public-verified` and
`opening-quality-public-client`. Full CI reports are attached to the workflows.

Human sessions remain zero. The current [five-player handoff](opening-district-playtest-handoff.md)
and [observer sheet](playtest-observer-template.md) are ready; comprehension,
balance and enjoyment still require real-player observations.

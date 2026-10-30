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
documentation, cache and unchanged 710 KiB boot budget (707.6 KiB measured).
All eight new feature cases passed in Chromium after correcting a paused-clock
label expiry and waiting for the defense fixture's actual card art to load.
The existing timing, five-style and feedback-layout checks also passed.
Visual captures were inspected at 2560×1600, 1440×900 and 1000×560; the shared
game client reached combat, played cards and left no lingering action objects.
Evidence: `.artifacts/opening-quality-verified/`, `opening-quality-final/`,
`opening-quality-client/` and the corresponding logs.

Full PR/production qualification and publication are pending. Automated success
does not establish enjoyment or replace the human milestone. Existing owner
waivers remain explicit; no human, physical-device or native-AT evidence was added.

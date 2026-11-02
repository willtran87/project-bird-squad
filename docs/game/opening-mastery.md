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
hand/reward presentation is 20.2 KiB under 24 KiB. A final expanded lifecycle,
alternate-policy and identity sweep, full CI qualification and public artifact
verification are pending. Evidence is under `.artifacts/mastery-*`.
The first full CI attempt exposed an obsolete assertion requiring a duplicate
combination-caption sound. It was corrected to require sound for Calls and no
extra sound for bare combination notices; actual card and rival audio remains
covered separately. That diagnostic run does not qualify the release.
Existing hard delivery limits remain unchanged; extracted card-rule formatting
counts toward the original combined 24 KiB hand/reward allowance.

## Human acceptance

No sessions have occurred. Use the [five-player handoff](opening-district-playtest-handoff.md)
and record observed first-fight comprehension, alternative tactics and voluntary
continuation. Four of five unaided explanations is a proposed target, not a result.
Human/device/native-assistive-technology evidence remains unverified.

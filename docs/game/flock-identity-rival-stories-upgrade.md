# Flock Identity + Rival Stories

User request: implement the full upgrade, verify the complete release, commit,
push, merge, publish Pages and clean up branches.

## Acceptance

- [x] Direct combat Call inspection/confirmation and live combination sequence.
- [x] Two mutually exclusive Call specializations for each of five Leaders,
  available after the first district boss; visible tradeoffs and durable saves.
- [x] Caldra introduction, tactical rematch and showdown: formations, disclosed
  weaknesses, dialogue, and a durable ending reflecting prior meetings.
- [x] Five Call signatures and three combination movements/sounds, bounded and
  readable with reduced-motion alternatives.
- [x] Spark-Caller and Talon permanent Flight Stories with exact objectives,
  narrative endings, cosmetic seals and unlock/save/reload protection.
- [x] Measured pacing observations and targeted improvements, with scripted
  measurements clearly separated from human decision/reading time.
- [ ] Focused mechanical, input, save, browser and three-size visual checks.
- [ ] Complete release suite, merged PR, verified public artifact and cleanup.

## Human follow-up

The existing five-player handoff will cover the new choices. No sessions have
been supplied. Human enjoyment, physical-device and native assistive-technology
evidence remain explicitly waived/unverified under the existing release policy.

## Implementation and candidate verification

- Calls have a separate inspection/confirmation surface (F9 or controller View),
  with a live suit-sequence strip. All ten specializations retain normal formation
  modifiers and once-per-fight limits; failed saves roll back the choice.
- Caldra's first three victories introduce the Watch and Courier, disclose their
  support/recovery windows and preserve a journal ending. Later rival crossings
  use the original district encounters so this arc does not erase existing crews.
- Signature presentation reuses canonical portraits and existing synthesized
  cues, has at most two active groups and expires after 850 ms. Reduced motion
  preserves static captions/portraits. The lazy module has a 14 KiB hard cap;
  existing entry/combined boot caps are unchanged.
- Every Roof Answers and A Path Through the Watch have fixed seeds, live
  Resonance/Winded-hit objectives, unique endings and cosmetic seals. Spark-Caller
  is already unlocked at startup; Talon retains the existing unlock gate.
- Candidate local run: 21/21 focused cases, including all 18 new cases and three
  existing animation/Hustle checks. Also passed 26 unit/policy checks and static
  release validators with the existing three explicit manual-evidence waivers.
  The prior 41-case run passed all 24 existing Flyway cases; its one new-case
  failure was an incorrect assumption that Spark-Caller starts locked, corrected
  without weakening Talon's unlock or active-flight protection assertions.
- At the scripted familiar-recovery fixture's actual timing scale, windup/release
  dropped from 432/132 ms to 72/0 ms; impact/recovery remained 156/58 ms. Native
  elapsed resolution was 896 ms including scheduler holds. First-read staging and
  cinematic timing are unchanged. These are synthetic timing observations, not
  human reading-time or enjoyment claims.
- Inspected 2560x1600, 1440x900 and 1000x560 captures for Call controls,
  specializations, rivals and story endings. Corrected compact Call-button spacing,
  overlong enemy names and post-choice scroll position. The unmodified shared
  web-game client played a real card on the production preview; inspected its
  image/state and found no browser-error artifact.
- Full CI, publication identity and branch cleanup remain pending below.
- The final first-three-chapters scope passes all 18 upgrade cases. A rebuilt
  timing follow-up also verifies positive cleanup/reward counters and freezes
  reward timing while the journal is open (1/1). The complete upgrade/catalog
  run passed 22/22, including every canonical district formation at three sizes.
- First PR CI run 40432038210 found four Firefox failures in existing Canal/Spires
  presentation checks: a detail-free combination cue reached the new listener.
  The optional signature listener now ignores a combination cue without details
  and resolves the current Call name when its cue omits one. Regression coverage
  retains the old district emissions and explicitly tests both optional payloads.
  The failed run was cancelled after preserving diagnostics; a clean full rerun
  is required before merge. The rebuilt repair passed all ten targeted checks
  across Chromium and Firefox (four affected district cases and the expanded
  signature/pacing case per browser), with no retries or skipped cases.

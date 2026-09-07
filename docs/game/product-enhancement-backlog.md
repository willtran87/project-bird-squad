# Product enhancement backlog

Accepted scope: the 52-item product enhancement list, requested for implementation
on 2026-09-07. This backlog preserves the complete scope across implementation
passes. A passing build is evidence for that revision, not proof of subjective
quality or completion of every item.

Status: **open** unless explicitly marked otherwise. Each item requires the
player outcome below, proportionate regression coverage, and playable inspection
when presentation changes. Balance changes require observed behavior; simulated
outcomes must not be described as human feedback. Existing user playtest waivers
remain in force and do not constitute passing human evidence.

## Core experience

| ID | Enhancement | Completion evidence |
| --- | --- | --- |
| 1 | Teach the complete loop | Guide links battle, reward, Preen, and deck decisions without blocking alternatives. |
| 2 | Playable decision lessons | Optional damage/defense, Flow, and Molt examples explain consequences. |
| 3 | Contextual help | Repeated confusion offers dismissible, relevant help without repeated nagging. |
| 4 | Continue summary | Resume explains current build, threat, and actual recovery point. |
| 5 | Deck-size tradeoffs | Add/remove comparison explains passive gains and draw dilution accurately. |
| 6 | Contextual reward advice | Advice considers effective costs, timing, engines, and Waymarks. |
| 7 | Recommendation downsides | **Partial (2026-09-07):** compact reward advice retains the strongest cost/recovery/role warning alongside a benefit, including district-biased rewards. Live rendered and announced warnings pass before commitment. Draw dilution and effect-timing comparisons remain open. |
| 8 | Accurate Flight Lab | **Complete (2026-09-07):** shared combat draw rule, explicit assumptions, affordable-together budget, bounded hand pages. Live parity passes for all five Leaders before/after Preen; large-hand keyboard/controller/pointer and save-preservation checks pass. |
| 9 | Playable practice | Owned decks can exercise representative combat without changing saves or progression. |
| 10 | Dominant-strategy audit | Compare wide/thin decks, recovery, Molt, and hybrids; change only demonstrated imbalances. |
| 11 | Stalling audit | Check incentives for safe healing/resource farming and preserve legitimate defensive play. |
| 12 | Defeat explanations | Factual turning points connect to relevant practice without invented counterfactuals. |

## Strategic variety

| ID | Enhancement | Completion evidence |
| --- | --- | --- |
| 13 | Leader development paths | Several usable strategies per Leader, including hybrid paths. |
| 14 | Card usefulness | Evaluate selection, removal, and in-combat contribution with context. |
| 15 | Common-card relevance | Reliable roles survive late-run and rarity comparisons. |
| 16 | Preen decisions | Added mechanics meaningfully change sequencing or strategy. |
| 17 | Pivot opportunities | Recoverable build weaknesses have reasonable route/reward responses. |
| 18 | Reward repetition | Structured drafts retain variety and do not force one repeated build. |
| 19 | Enemy combinations | Existing roles create distinct target and sequencing decisions. |
| 20 | Boss transitions | Boss-specific timing pressures remain previewable and counterable. |
| 21 | Hard-counter audit | Each major archetype has reasonable responses to authored threats. |
| 22 | Route tradeoffs | Safety, upgrades, collection, and economy compare using current flight context. |
| 23 | Market opportunity cost | Services and merchandise compete meaningfully across run states. |
| 24 | Supply usability | Relevant use opportunities and exact effects are understandable. |
| 25 | Event depth | Selected events reflect prior decisions, build, or Leader. |
| 26 | District pacing | Address repeated openings, reward droughts, and already-decided late fights. |

## Presentation and navigation

| ID | Enhancement | Completion evidence |
| --- | --- | --- |
| 27 | Grouped Settings | **Complete (2026-09-07):** four sections, pointer/keyboard/controller navigation, hidden-hit isolation, announced values, stable focus, and single-owner listener cleanup. Menu/route/battle and 2560x1600, 1440x900, 1000x560 checks pass. |
| 28 | Readable text sizes | **Partial (2026-09-07):** Settings labels/values enlarged and inspected at all three validation sizes. Broader game text-size controls and card/advice readability remain open. |
| 29 | Decision hierarchy | Current choice, consequence, and commitment stand out across key surfaces. |
| 30 | Vocabulary | Terms are introduced progressively with contextual definitions. |
| 31 | Persistence labels | Collection, flight, combat, and temporary changes are unmistakable. |
| 32 | Trigger feedback | Dense passive chains are grouped with inspectable exact order. |
| 33 | Input hints | Visible hints follow active input and remapping through transitions. |
| 34 | Confirmation friction | Consequential choices stay protected; routine actions avoid redundant work. |
| 35 | Collection navigation | New card to dossier, comparison, Folio, and practice is easy to follow. |
| 36 | Post-run hierarchy | Result and defining decisions precede optional detailed records. |
| 37 | Audio mix | Overlapping voices, cues, music, and boss effects remain distinguishable. |

## Long-term motivation

| ID | Enhancement | Completion evidence |
| --- | --- | --- |
| 38 | Experiment recognition | Cosmetic/record mastery rewards varied card and build use. |
| 39 | Actionable collection targets | Acquisition guidance connects to routes and explains uncertainty. |
| 40 | Meaningful discoveries | Newly owned cards explain new combinations or Folio opportunities. |
| 41 | Curated challenges | Optional constraints create mastery goals without permanent power. |
| 42 | Persistent challenges | Shared challenges remain accessible without streaks or deadlines. |
| 43 | District storytelling | Existing characters and consequences connect the run's events. |
| 44 | Cosmetic identity | Alternate art preserves immediate mechanical recognition. |

## Reliability and evidence

| ID | Enhancement | Completion evidence |
| --- | --- | --- |
| 45 | Interruption recovery | Refresh, tab closure, suspend, and reward interruption match the advertised checkpoint. |
| 46 | Assistive technology | Record actual NVDA/VoiceOver journeys; distinguish automation from physical use. |
| 47 | Physical devices | Record supported device touch, readability, suspension, and sustained performance. |
| 48 | Loading bottlenecks | Measure startup/memory improvements; keep existing budgets visible. |
| 49 | Current documentation | **Partial:** corrected audio ownership and release-evidence contracts. Historical audit consolidation remains open. |
| 50 | Release evidence policy | **Complete (2026-09-07):** version-scoped owner waiver, consistent runbooks, explicit WAIVED output, strict-human override, four policy tests. Missing device/assistive evidence still fails the gate. |
| 51 | Optional player sessions | Use authentic feedback for subjective decisions without revoking the existing waiver. |
| 52 | Outcome-based verification | Relevant checks accompany changes; launched resources are cleaned up. |

## Current implementation order

1. Correct Flight Lab's decision information and verify it against live combat.
2. Improve reward/deck-size advice using the corrected analysis.
3. Group Settings and establish readable text-size layout constraints.
4. Connect onboarding, collection, and safe playable practice.
5. Use measured play evidence for balance, pacing, and content revisions.

No item is complete merely because its feature name exists in the source.

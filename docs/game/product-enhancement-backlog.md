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
| 1 | Teach the complete loop | **Partial (2026-09-07):** readable six-step How to Play overview connects route, battle, reward/Skip, Preen, deck review, and the next flight; the same explanations are narrated. Contextual/playable Preen and deck lessons remain open. |
| 2 | Playable decision lessons | Optional damage/defense, Flow, and Molt examples explain consequences. |
| 3 | Contextual help | Repeated confusion offers dismissible, relevant help without repeated nagging. |
| 4 | Continue summary | Resume explains current build, threat, and actual recovery point. |
| 5 | Deck-size tradeoffs | **Partial (2026-09-08):** combat reward/Preen and route/Market Release/Preen inspection compare deck size, base hand target, passive gains/changed totals, and persistence. Market card purchases now separate Wingbeats from Scrap, show transaction/base-hand deltas and wrapped build advice, and recover current preview rows after late art redraws. Uses the live draw rule with explicit draw assumptions. Broader route-choice and actual draw-probability comparisons remain open. |
| 6 | Contextual reward advice | Advice considers effective costs, timing, engines, and Waymarks. |
| 7 | Recommendation downsides | **Partial (2026-09-07):** compact reward advice retains the strongest cost/recovery/role warning alongside a benefit, including district-biased rewards. Live rendered and announced warnings pass before commitment. Draw dilution and effect-timing comparisons remain open. |
| 8 | Accurate Flight Lab | **Complete (2026-09-07):** shared combat draw rule, explicit assumptions, affordable-together budget, bounded hand pages. Live parity passes for all five Leaders before/after Preen; large-hand keyboard/controller/pointer and save-preservation checks pass. |
| 9 | Playable practice | **Complete (2026-09-08):** Flight Lab launches real Tier 0 routes/combat with owned legal Folios while keeping the active flight safe. Disposable in-memory persistence, explicit mode/exit/result labels, original-Folio seeded replay, and no permanent records/unlocks. Eighteen checks pass across Chromium/Firefox/WebKit for all launch inputs, card play, rewards/Preen/route return, win/loss, retry, pause exit, refresh, ownership, Leader locks, denied storage, and journal recovery isolation; ordinary-flight regressions pass. |
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
| 28 | Readable text sizes | **Partial (2026-09-08):** Settings labels/values, combat reward effects/advice, and How to Play enlarged. Help bodies use uncapped 16px text with tested containment. Reward cards use measured ellipses; full preview allocates rule space from measured text height. Market advice wraps at 14px; its right-hand dossier now presents complete Now, Preen, and Molt rules in measured 16px pages with a separate current-stat footer, pointer and Inspect/Y navigation, and narrated page content. Broader text scaling and other legacy detail surfaces remain open. |
| 29 | Decision hierarchy | **Partial (2026-09-07):** combat rewards separate effects, Molt badges, focused build advice, Inspect, and Skip. Current choice, consequence, and commitment still need review across other key surfaces. |
| 30 | Vocabulary | Terms are introduced progressively with contextual definitions. |
| 31 | Persistence labels | **Partial (2026-09-07):** reward/Preen inspection explains permanent collection records versus flight-only playable copies/upgrades. Other collection, combat, and temporary changes remain to be reviewed. |
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

1. Complete readable decision surfaces: reward/deck-size advice, removal, route/market comparisons, and scalable text.
2. Connect onboarding, collection, defeat explanations, and safe playable practice.
3. Use measured play evidence for balance, encounter variety, pacing, and economy revisions.
4. Qualify recovery, physical devices, assistive technology, and performance.
5. Deepen collection goals, mastery challenges, and district storytelling.

The subsequent 48-point consolidated roadmap reorganizes this accepted scope;
it does not reset completed items or imply 48 newly missing features. Preserve
Flight Lab accuracy, grouped Settings, and explicit release-waiver reporting.
The owner's quality direction is polished, readable, satisfying, replayable
play. Pursue meaningful choices and experimentation, not compulsory grinding,
streak pressure, artificial scarcity, or permanent-power chores. Automated
checks cannot establish subjective fun or replace authentic player feedback.

No item is complete merely because its feature name exists in the source.

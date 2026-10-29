# Signature Fights + Faster Decisions

Accepted scope: implement all five packages, qualify the complete release,
commit, push, merge, publish GitHub Pages and clean up the feature branch.

## Implementation

1. Reward cards show an owned sequence, its limitation, deck delta and passive
   stat changes before inspection. Combat rewards and their offline fallback
   share one layout. Route rewards show the same concise comparison above the
   offer. Long text is explicitly abbreviated; full rules and observed-versus-
   potential evidence remain in the reader. Choosing still requires confirmation.
2. Three authored encounters enter the existing district encounter pools:
   **The Last Ferry**, **Before the Bell**, and **Two Moving Rooftops**. Route
   inspection and battle introduction disclose their complete timing. A live
   phase strip explains the crossing, charge deadline or change of positions.
   Scripted enemy moves drive both forecasts and resolution. Defeating both
   enemies remains the victory condition; optional objectives cannot cause loss.
3. Restoring Canal Markets earns one exclusive strategy capstone for the flight:
   **Answerkeeper Knot** rewards a one/two-card Roost with retention and next-turn
   energy; **Answering Bell** rewards a third card with Resonance and draw;
   **Storm Anchor** prepares Guard and next-turn energy on entering Molt.
   Each triggers once per fight. The Journal explains each limitation, requires
   an explicit inspect/commit choice, saves transactionally and marks the gift
   available on its route launcher. Old saves default to no capstone.
4. The v2 pose sheet uses taller silhouettes, a long-legged heron, canonical
   streetwear and shaded feathers. Shield, signal and recovery glyphs distinguish
   enemy support actions; still cues replace their animation in reduced/lean
   modes. Decisive bird calls suppress supporting/ambient bursts without queuing
   audio or delaying an attack. Existing volume controls still own each bus.
5. **Practice This Fight** appears on defeat and rematch completion. It restarts
   the original battle checkpoint and deterministic combat seed, restoring the
   same deck/Preens, draw order, health, supplies, conditions and enemies.
   Practice uses the existing memory-only storage session, displays its badge,
   and stops at the battle outcome without reward choices. Returning to the menu
   restores the real result and storage session. Refresh cannot resume practice.

## Art provenance

Built-in imagegen, not the API fallback. The existing v1 atlas was the edit
target; canonical Fledgling and Tidewarden portraits supplied proportion,
streetwear and shading references. The prompt requested the same six birds and
five poses, upright avian proportions, small heads, visible legs, grounded
utility clothing, transparent gutters and no text, fantasy armor or glow.
A second edit preserved all designs while separating the five-by-six grid.

- Source: `assets/concept-art/flock-leaders/living-battles-atlas-v2.png`.
- Runtime: `assets/runtime/flock/performances/living-battles-atlas-v2.webp`.
- Packaging: `tools/prepare-signature-atlas.py`, dimensions 1145×1374, RGBA,
  quality 80; 530,130 bytes, below the unchanged 575 KiB asset limit.
- Measured frame boundaries are in `living-performances.ts`; packaging preserves
  source dimensions and alpha geometry. v1 remains available as historical art.

## Acceptance evidence

Release qualification is pending. Do not interpret implementation or targeted
test results as a published release. The final ledger will record exact commits,
CI runs, full core/browser counts, Pages artifact identity and live-site checks.

Dedicated coverage includes all ten early/looping enemy beats with and without
support, capstone unlock/save/exclusivity/once limits, card and enemy forecast
parity, exact rematch opening and disk isolation, support lifecycle, and reward
geometry. Visual targets: 2560×1600, 1440×900, 1000×560.

Human evidence remains unchanged: zero sessions. The five-player handoff remains
ready in `opening-district-playtest-handoff.md`; automation does not establish
whether these changes improve comprehension, balance or enjoyment.

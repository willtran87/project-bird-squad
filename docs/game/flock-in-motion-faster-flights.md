# Flock in Motion + Faster Flights

Accepted October 28, 2026: implement the six proposed improvements, verify and
publish through the existing release workflow. Human sessions remain a prepared
handoff under the existing explicit waivers, not automated acceptance evidence.

## Acceptance

- [x] Combat hierarchy emphasizes incoming damage, Wingbeats and the selected
  result, with fixed hand/control positions and readable secondary inventory.
- [x] Five bounded card-action styles: swoop, shove, shelter, rally and retreat;
  canonical bird identity, sound, reduced motion and lifecycle cleanup.
- [x] Brief payoff feedback uses resolved effects, preserves authoritative
  forecasts, and does not multiply competing banners or effects.
- [x] Repeated enemy actions are faster, first-read/cinematic and damage holds
  remain readable, and safe presentation windows permit read-only inspection.
- [x] Card contributions use observed effects and survive checkpoints/reloads;
  reward inspection and flight reports explain those contributions honestly.
- [x] Pages boot code below the existing 710 KiB preferred target; native-clock
  card/transition measurements and no new eager art/dependency load.
- [ ] Focused mechanics, input, persistence, lifecycle and three-size visual
  checks, shared-client play, complete release suite and browser qualification.
- [ ] Commit, push, merge, publish verified Pages artifact and clean branches.

## Baseline and evidence

Baseline source: `c07471d3`; deployed game: `7e6c4b85`. Existing Pages boot is
722.5 KiB; the main chunk is 680.5 KiB. A fresh local baseline build and timings
will be retained before implementing changes. No balance or enjoyment conclusion
will be inferred from simulated runs.

## Implementation and local verification

- Combat now uses a fixed five-column hand grid on small hands and final pages.
  Wingbeats have stronger type hierarchy; secondary inventory and HUD rules are
  quieter. Existing selection math and controls retain their lanes.
- Swoop, shove, shelter, rally and retreat use the actual card illustration and
  its existing suit voice. One actor lives only until impact, with no additional
  gameplay wait. Reduced motion/lean effects use stationary shape cues; missing
  art uses the card name. There is no new art download or generated character.
- Resolved numeric effects briefly reuse the combination lane. Selecting another
  card takes priority. Full observed totals appear in reward/Market inspection
  and flight report decisions, with explicit trigger/overkill/overheal scope.
- Contributions include actual HP damage, Cover, healing, draws, Wingbeats,
  Resonance gain/spend and Flow built. They survive reward checkpoints and old
  saves without synthesizing historical observations.
- Familiar attacks/support reduce preparation and release by 30% relative to
  their existing repeat timing. First-read, cinematic, damage and recovery holds
  retain their prior rules. Read-only card inspection works during player casts;
  forecasts opened before settlement explicitly require reopening afterward.
- Fifty-seven existing combat FX presenters moved into the battle-loaded module.
  Combined boot is below 710 KiB; the former preferred target is now the hard
  ceiling. No existing delivery allowance was increased.
- The shared client reached combat, selected and played cards with no console
  errors. Initial focused tests passed contributions, checkpoint/reload,
  inspection and timing; two fixture failures (art readiness and an ID argument)
  were corrected without removing assertions. The narrow in-app browser showed
  the expected landscape gate; actual gameplay captures use the required sizes.
- Local tests and release qualification are still in progress. Publication has
  not yet been performed for this upgrade.

## Local qualification — October 28

- All 18 new cases passed in Chromium, Firefox and WebKit, without retries.
  The final case set covers resolved/capped effects, checkpoint/reload without
  duplicate attribution, five canonical motion styles and their suit cues,
  reduced motion and cleanup, read-only inspection, fixed-grid geometry,
  selection priority, and familiar/cinematic timing.
- Three new pure-data tests passed; the existing 19 flyway/draw checks and
  seven release-policy checks passed. Content/art, bundle and deployment-cache
  validators pass. Full CI, merged release and public artifact verification
  remain required below.
- Reviewed captures at 2560x1600, 1440x900 and 1000x560. The action portrait was
  moved clear of the commitment effect and placed above it. Payoff copy reuses
  one lane and never displaces a selected card's forecast. The reader does not
  claim an up-to-date forecast while the preceding action is still resolving.
- Final browser fixtures use deterministic stepping only for frozen animation
  lifecycle captures; native latency is measured separately. WebKit wraps the
  forecast into more pages, so assertions inspect the complete outcome section.
  Both earlier failed attempts remain recorded in local logs.
- Core inventory: 1,026 regression + 37 campaign + 4 reference journeys = 1,067
  unique cases. Browser qualification now includes the six new cases per browser.
- Root boot: 692.7 KiB / 193.6 KiB gzip; entry: 650.6 / 177.1 KiB. Native nine-card
  median 335.5→339.3 ms and three-entry median 1897→1947.6 ms are mixed/small-sample
  evidence, not an overall speed claim. See [performance notes](../project/performance-notes.md).
- Human follow-up is prepared in [the handoff](opening-district-playtest-handoff.md).
  No human session, physical-device result or native AT result is claimed.

Commands: `npm run build`, `npm run validate:bundle-size`,
`npm run validate:deployment-cache`, `npm run validate:runtime-assets`,
`npm run validate:docs`, `npm run validate:release-evidence`,
`node --test tools/tests/card-contributions.test.mjs`, and the full three-browser
`tests/flock-motion.spec.ts` run. Screenshots: `.artifacts/motion-final-results/`;
logs: `.artifacts/motion-browser-final.log`; shared-client output:
`.artifacts/motion-client-final/`. Final full-release status follows here.

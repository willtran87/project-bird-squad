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
- [x] Focused mechanics, input, persistence, lifecycle and three-size visual
  checks, shared-client play, complete release suite and browser qualification.
- [x] Commit, push, merge, publish verified Pages artifact and clean branches.

## Baseline and evidence

Baseline source: `c07471d3`; deployed game: `7e6c4b85`. Existing Pages boot is
722.5 KiB; the main chunk is 680.5 KiB. A fresh local baseline build and timings
were retained before implementation. No balance or enjoyment conclusion is
inferred from simulated runs.

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
- Root boot: 692.7 KiB / 193.6 KiB gzip; main: 650.7 / 177.1 KiB. Native nine-card
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

The initial PR run (40651657521) was superseded after discovering that the
browser command's explicit file list omitted `flock-motion.spec.ts`, despite
including its grep prefix. The corrected run must report 87 cases per browser;
the earlier run is not counted as complete release evidence.

The superseded run also exposed a Wingbeat value/label overlap; the value now
uses 23px (still above Cover at 22px and inventory at 19px), and the geometry
checks also assert clearance above Flow. Existing exact-size and reduced-motion
expectations were updated for the accepted hierarchy and stationary cue, while
retaining impact cleanup and adding stationary/no-tween assertions. Final reader
captures exposed a Flyway shortcut over the report; the report now owns that
input window. Run 40653075512 was canceled before qualification for these fixes.
Run 40653671519 was also superseded when the newly added Flow-clearance assertion
caught one remaining pixel. The final 23px layout is requalified at all three
sizes. Local build attempts 8 failed while Windows held preview files; stopping
the owned preview allowed builds 9 and 10 to complete. These attempts remain in
the evidence logs and are not counted as passing runs.

Run 40654835681 passed all 261 browser cases but found Linux font-height
clearance failures and two old timing assumptions. The Wingbeat label/value
row is translated upward together, preserving the 19px label floor; the timing
tests now expect the accepted shorter repeat and sample Hustle's acceleration
window instead of skipping past it. Impact protection remains asserted. A local
18px-label experiment failed the compact type floor and was discarded.

## Clean PR qualification

[Run 40658365185](https://github.com/willtran87/project-bird-squad/actions/runs/40658365185)
passed 1,067 core cases (1,026 regression, 37 campaign, four reference journeys),
261 browser cases (87 each in Chromium, Firefox and WebKit), 29 unit/policy
checks, Pages-path smoke, content/art validation and delivery gates. There were
no failed, flaky or skipped test cases. Both previously failing regression
shards passed in this run. Earlier failed/superseded runs remain recorded above.

The final local HUD/pacing pass has 21/21 across all browsers; the motion and
impact-lifecycle pass has 30/30. Screenshots are in
`.artifacts/motion-platform-final-results/`, `.artifacts/motion-final-feature-results/`
and `.artifacts/motion-reader-captures/`. The final shared client completed real
card input with no console errors (`.artifacts/motion-client-final3/`). Report
captures confirm the journal shortcut stays clear of Flight Details.

[PR #16](https://github.com/willtran87/project-bird-squad/pull/16) merged as
`06eaa0d59383dadcb2123aa0726152983c0dd789`.

## Published release and cleanup

[Production run 40662622603](https://github.com/willtran87/project-bird-squad/actions/runs/40662622603)
passed the same complete 1,067 core / 261 browser / 29 unit-policy / one Pages
smoke qualification on the merged source, with no failed/flaky/skipped cases.
Content, art, budget and cache gates passed, and GitHub Pages deployment succeeded.

The [public game](https://willtran87.github.io/project-bird-squad/) serves the
tested `06eaa0d5` artifact. Public HTML and both bootstrap/main bundles match the
identity record; an additional comparison of all 73 HTML/JavaScript/CSS files
in the deployed artifact also matched SHA-256 and byte counts. Evidence:
`.artifacts/motion-live-identity.json`, `.artifacts/motion-live-all-bundles.json`,
`.artifacts/motion-main-clean-evidence.json` and the downloaded CI identity record
under `.artifacts/motion-release/`.

Eleven public-site feature, HUD and pacing tests passed without retries or console
errors. Inspected public compact HUD and action captures in
`.artifacts/motion-live-results/`; test log: `.artifacts/motion-live-tests.log`.
The Pages build is 693.8 KiB / 193.7 KiB gzip combined boot, 651.7 / 177.2 KiB
main application code and 59.9 / 14.4 KiB combat FX. The 710 KiB cap passes without
increasing any existing allowance. Native timings remain the limited evidence
reported above, not an overall frame-rate claim.

The merged feature branch was deleted locally and remotely; only `main` remains.
Owned previews are stopped. Final ledger edits are documentation only, so the
published application remains the tested merge revision. Human sessions, physical
device checks and native assistive-technology evidence remain the prepared handoff
under the existing explicit waivers; none is represented as completed here.

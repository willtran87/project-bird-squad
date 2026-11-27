# Bird Squad

Bird Squad is a Phaser/Vite foundation build for a rooftop card battler about a
streetwise bird crew, singleton deckbuilding, and risky Molt turns.

## Supported Displays

The playable build supports desktop browsers and landscape tablets with a
viewport of at least 1000x560 CSS pixels. Portrait and compact phone displays
show a branded platform gate and pause the Phaser loop without discarding the
current run. Rotating or returning to a supported display resumes the same game
state.

## Safe Practice

Open **Flock Record → Flight Folios → Flight Lab**, then choose **Practice**
(U on keyboard, Select on controller). An owned, legal Folio with an unlocked
Leader can play the real Tier 0 route, battles, rewards, and Preens even while
another flight is saved. Replay uses the original Folio and seed.

Practice never writes browser storage: the active flight, collection, records,
unlocks, and backup journals stay untouched. Main Menu or browser reload ends
practice. Settings changed during practice are also not written to storage;
reload discards those temporary preferences. **Fly This Folio** remains the
separate, progression-saving action and cannot overwrite an active flight.

## Source Of Truth

Start with `docs/README.md`. It owns the documentation map, canonical source
rules, reading paths, and guidance for where new decisions should live.

The short version:

- product direction: `docs/game/game-design.md`
- combat/cards/Molt: `docs/game/core-gameplay-spec.md`
- route/run systems: `docs/game/run-design-spec.md`
- first playable slice: `docs/game/alpha-run-spec.md`
- runtime architecture: `docs/project/runtime-architecture.md`
- visual identity: `docs/art/art-bible.md`
- runtime data: `data/game/`
- card identity data: `data/cards/`
- progress and handoff notes: `docs/project/progress.md`

## Project Map

| Path | Ownership |
| --- | --- |
| `src/` | Runtime TypeScript and CSS for the playable build. |
| `assets/splash/` | Splash and promotional images used by the menu or presentation. |
| `assets/fonts/ui/` | Runtime UI faces (Barlow, Fraunces; SIL OFL), rebuilt by `tools/build-ui-fonts.py`. |
| `.generated/` | Ignored generated/source masters for imagegen, concept art, screenshots, and raw art pipeline outputs. |
| `assets/runtime/` | Runtime asset manifests and optimized derived card, enemy, and backdrop targets. |
| `assets/concept-art/backdrops/`, `assets/concept-art/route-events/`, `assets/concept-art/route-event-centerpieces/` | Current editable world-demo source art; exact allowed generations are defined by `docs/art/world-asset-contract.md`. |
| `data/cards/arcana/` | Production data for Legend and Crew card identities. |
| `data/cards/reversals/` | Molt/reversal data layered over the card set. |
| `data/game/` | Runtime-ready cards, enemies, encounters, route maps, items, economy, and district content. |
| `docs/game/` | Playable design, core gameplay, run rules, and Alpha scope. |
| `docs/art/` | Art bible, prompt rules, species/style/suit direction. |
| `docs/project/` | Runtime architecture, progress log, performance notes, and repo stewardship notes. |
| `docs/README.md` | Documentation index and ownership guide. |
| `tools/` | Local validation scripts, reference material, and future project tooling. Not runtime code. |
| `tests/` | Playwright smoke tests driven by the text-state harness. |
| `.artifacts/test/` | Ignored generated browser-test captures and action payloads. |
| `.artifacts/build/` | Ignored production build output. |

## Commands

```bash
npm run dev
npm run build
npm run validate
npm run validate:docs
npm run validate:runtime
npm run test:e2e
npm run preview
```

### Browser test tiers

| Command | Tests | Time at 3 workers | Use |
| --- | --- | --- | --- |
| `npm run test:e2e:gate` | about 220 | about 15 min | Every change: ordered-sequence smoke set, feature, save/resume and typography specs |
| `npm run test:e2e:standard` | about 1,220 | about 1.8 h | Before merging large work: everything except the long specs |
| `npm run test:e2e:long` | 57 | about 50 min | Nightly: full start-to-finish flights and catalog sweeps |
| `npm run test:e2e` | all 1,277 | about 2.5 h | Before a release |

Each run builds first. Set `BIRD_SQUAD_REUSE_BUILD=1` to serve the existing
`.artifacts/build` when it already matches the source, and
`BIRD_SQUAD_WORKERS=<n>` to change the default of 3 workers. Files are split
across workers, so tests must not depend on each other's state.

In CI the game is built once per run and every test job serves that build,
with two workers per job:

| When | What runs |
| --- | --- |
| Pull request | The gate (4 shards), including the release smoke set in Chromium, and the Pages build check: about 10-12 min |
| Push to `main` | The full Chromium regression (8 shards), campaign journeys (3), and the release smoke set in Firefox and WebKit; GitHub Pages deploys only when all of it passes |
| Nightly, manual runs, PRs labelled `full-ci` | Everything above plus the long live-control reference flights |

The release smoke set lives in `tools/browser-smoke-set.mjs`;
`npm run test:cross-browser` runs it locally in every browser.

## Boundary Rules

- Put gameplay implementation in `src/`.
- Put durable design decisions in `docs/game/` or `docs/art/`.
- Put project progress and handoff notes in `docs/project/`.
- Put card/source data in `data/cards/` and runtime-ready game data in
  `data/game/`, not in docs.
- Keep card definitions canonical in one place. Docs may summarize card data,
  but should not carry forked prototype deck lists or duplicate card maps.
- Run `npm run validate` after changing card data, runtime game data, art maps,
  or mechanics docs.
- Put generated screenshots, Playwright states, and scratch outputs in
  `.artifacts/test/`.
- Keep `.artifacts/`, `output/`, `dist/`, and accidental root test output out of
  source control.

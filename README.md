# Bird Squad

Bird Squad is a Phaser/Vite foundation build for a rooftop card battler about a
streetwise bird crew, singleton deckbuilding, and risky Molt turns.

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
| `.generated/` | Ignored generated/source masters for imagegen, concept art, screenshots, and raw art pipeline outputs. |
| `assets/runtime/` | Runtime asset manifests and optimized derived card, enemy, and backdrop targets. |
| `assets/battlefields/` | Battlefield exploration and arena concepts. |
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

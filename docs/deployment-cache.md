# Deployment Cache Notes

Status: operational checklist for hosting `.artifacts/build`.

Bird Squad builds with hashed asset filenames. The deploy target should cache
hashed files aggressively while keeping `index.html` fresh, because the HTML
owns the current chunk names.

## Required Headers

| Path | Cache-Control |
| --- | --- |
| `/index.html` | `no-cache` or `max-age=0, must-revalidate` |
| `/assets/*` | `public, max-age=31536000, immutable` |
| Runtime image assets under `/assets/runtime/*` | `public, max-age=31536000, immutable` |

## Required Security Headers

The production build includes `_headers` for static hosts that consume that
manifest. Hosts with a different configuration format must translate the same
rules; do not publish the file while silently omitting the headers.

| Header | Required value or policy |
| --- | --- |
| `Content-Security-Policy` | Self-hosted scripts only; no `unsafe-inline` or `unsafe-eval` for scripts; deny objects, forms, base-URI changes, and framing. |
| `Referrer-Policy` | `no-referrer` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Permissions-Policy` | Deny camera, microphone, geolocation, payment, and USB; allow fullscreen only to self. |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` |

`style-src 'unsafe-inline'` remains narrowly allowed because Phaser sets canvas
layout styles at runtime. Script execution remains strict. Images may use
same-origin, `data:`, and `blob:` sources for the existing runtime/download
surfaces; network connections remain same-origin.

## Compression

Enable Brotli and gzip for text assets:

- `.html`
- `.js`
- `.css`
- `.json`
- `.svg`

Do not recompress already-compressed image assets such as `.webp` and `.png`.

## Build Contract

Run the following before publishing:

```powershell
npm run build
npm run validate:bundle-size
npm run validate:runtime-assets
npm run validate:deployment-cache
```

The production build emits a lightweight HTML boot shell, Phaser vendor,
runtime-data, game-core, and interaction-rules boot chunks, the app entry chunk, a lazy Codex data
chunk, and lazy combat-preview, battle-FX-presenter, battle-backdrop-renderer,
battle-foreground-renderer, battle-reward-renderer,
the battle HUD renderer, the battle hand renderer, the battle inspect renderer,
Profile, system-overlay, and adaptive-music
chunks. `index.html` may preload the four boot dependencies; Codex data,
combat preview logic, the reusable battle FX presentation foundation,
battle-only district/mood/atmosphere rendering, and combatant/intent rendering,
combat piles, Roost/log controls, beat timing, objectives, and forecasts,
hand cards, selection pulses, Flow hints, late art refresh, and hover dossiers,
combat deck/draw/discard indexes, scrolling, card art, and rules dossiers,
post-combat card, Preen, and Waymark ceremony rendering,
route-map presentation, saved Flight Folios, Profile presentation, and pause/settings/guide presentation are fetched only
when their surfaces need them. The adaptive procedural score and suit-specific
card-voice synthesizer are fetched only after the first audio interaction, when
the browser permits sound playback. The synthesized UI and combat cue recipes
likewise remain in a separate `audio-sfx` chunk until the first requested cue;
the request is queued across that initial fetch so the first audible action is
not discarded.

The platform-size gate is an external TypeScript entry rather than inline HTML.
Vite may fold it into the app entry, but the emitted `index.html` must contain no
inline executable script so `script-src 'self'` remains enforceable.

`validate:deployment-cache` checks the local build artifact contract that supports
these headers: hashed JS/CSS asset names, a single app entry chunk, a single
Phaser vendor chunk, single runtime-data, game-core, and interaction-rules boot chunks, a single lazy
Codex chunk, and no modulepreload for non-boot chunks.
It also requires the emitted `_headers` manifest, rejects inline executable
scripts, validates the strict CSP directives and browser-hardening headers, and
rejects weakened cache rules.
For each canonical runtime FX PNG source, the production artifact must contain
exactly one hashed WebP and no emitted PNG. PNGs remain art-pipeline inputs;
Phaser loads the same texture keys from the optimized delivery tier.
For each canonical runtime UI PNG source, the production artifact must contain
exactly one hashed WebP and no emitted PNG. This keeps the workshop source tier
out of deploys while retaining stable Phaser texture keys.
The validator also requires exactly one combat-preview chunk and rejects a
modulepreload for it. It likewise requires exactly one `profile-scene` and one
`system-overlays` chunk and rejects preloading either optional surface.
It requires exactly one `fx-presenter` chunk and keeps it out of modulepreload
so menu and route boot do not parse combat-only sprite and particle lifecycles.
It likewise requires exactly one `render-backdrop` chunk and rejects preloading
district, encounter-mood, and atmosphere rendering before BattleScene opens.
It requires exactly one `render-foreground` chunk and rejects preloading enemy,
leader, targeting, vitals, and intent composition before BattleScene opens.
It requires exactly one `render-hud` chunk and rejects preloading battle piles,
commands, beat timing, objective, guidance, and forecast presentation.
It requires exactly one `render-hand` chunk and rejects preloading battle hand
composition, selection motion, Flow hints, and hover dossiers.
It requires one `discard-choice` and one `return-choice` chunk and rejects
preloading either combat decision workflow before BattleScene opens.
It requires exactly one `render-inspect` chunk and rejects preloading card/pile
review composition until the player opens a combat deck, draw, or discard index.
It requires exactly one `render-reward` chunk and rejects preloading reward
ceremony composition until a post-combat card, Preen, or Waymark choice opens.
It requires exactly one `route-map-renderer` chunk and rejects preloading route
edges, node hierarchy, and route commitment controls before RouteScene opens.
It requires exactly one `saved-decks` chunk and rejects preloading persisted
Flight Folio sanitation and record creation before RouteScene opens.
It also requires one `adaptive-music` chunk, which owns adaptive score and card
voice synthesis, and rejects preloading it.
It requires exactly one `audio-sfx` chunk as well and rejects preloading its UI
and combat cue recipes before the first requested sound.

## Rollback Rule

If users report stale chunks after a deployment, clear the CDN cache for
`/index.html` first. Hashed assets can stay cached unless the same hashed file
was overwritten, which should not happen in normal Vite builds.

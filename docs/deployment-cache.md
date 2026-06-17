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
```

The production build emits a lightweight HTML boot shell, a Phaser vendor chunk,
the app entry chunk, and a lazy Codex data chunk. `index.html` should preload the
Phaser vendor chunk only; the Codex data chunk is intentionally fetched when the
Codex scene is opened.

## Rollback Rule

If users report stale chunks after a deployment, clear the CDN cache for
`/index.html` first. Hashed assets can stay cached unless the same hashed file
was overwritten, which should not happen in normal Vite builds.

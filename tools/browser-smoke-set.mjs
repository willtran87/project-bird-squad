// The release smoke and district-upgrade specs that must pass in every
// browser. CI runs them in Firefox and WebKit (tools/run-cross-browser-smoke.mjs);
// the Chromium pass is part of the PR gate (playwright.gate.config.ts) and of
// the full regression on main.
export const browserSmokeFiles = [
  'coherent-city', 'tactical-payoffs', 'large-hand-polish', 'clear-choices', 'decisions-rhythm', 'opening-district',
  'canal-markets', 'signal-spires', 'high-roost', 'flock-identity', 'flock-motion', 'distinct-builds',
  'signature-fights', 'meaningful-victories', 'identity-continuity', 'opening-quality', 'opening-mastery',
  'audio-cue-budget',
];

// Smoke topic files carry three of the checked titles.
export const browserSmokeGlobs = [...browserSmokeFiles.map((name) => `**/${name}.spec.ts`), '**/smoke-*.spec.ts'];

export const browserSmokeGrep = [
  'Coherent City ', 'Tactical payoffs ', 'large hands remain readable', 'Clear choices ', 'Decisions rhythm ',
  'Opening mastery ', 'Opening quality ', 'Identity continuity ', 'Meaningful Victories ', 'Signature Fights ',
  'Distinct Builds ', 'Flock Motion ', 'Flock Identity ', 'High Roost ', 'Spires ', 'Canal ', 'strategy choices',
  'plan drafting', 'real combinations', 'saved shelter', 'Crow purpose', 'strategy presentation',
  'title boot paints generated controls once', 'sold-out Market stock remains in the spoken unavailable inventory',
  'opt-in screen reader announcements follow', 'reward advice preserves costs', 'reward cost cautions remain visible',
].join('|');

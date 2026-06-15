#!/usr/bin/env node
// tools/audit-content.mjs
//
// Source-vs-data BALANCE audit. Asserts the authored design numbers from the
// specs against the runtime data, and FAILS on drift. This is distinct from
// tools/validate-runtime-data.mjs (which checks STRUCTURE / schema): this tool
// checks that VALUES still match design intent, so a balance number changed in
// data but not in the spec (or vice-versa) is caught.
//
// The authored targets below are transcribed from the specs WITH citations and
// are the machine-readable shadow of the prose. Data files not yet authored
// (the Phase-3 backbone) are reported as PENDING, not failures, and their checks
// activate automatically once the files exist.
//
// This is the Phase-4 "content-vs-spec audit" tool from
// docs/game/next-level-data-contracts.md §13. Dependency-free.

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const problems = [];
const passes = [];
const pending = [];
const fail = (m) => problems.push(m);
const pass = (m) => passes.push(m);

const readJson = (rel) => {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { fail(`${rel}: parse error: ${e.message}`); return undefined; }
};

const scrapEq = (a, b) =>
  Array.isArray(a) && Array.isArray(b) ? a[0] === b[0] && a[1] === b[1] : a === b;
const fmtScrap = (s) => (Array.isArray(s) ? `${s[0]}-${s[1]}` : String(s));

// ───────────────────────── Authored targets (the spec is the source of truth) ──
// docs/game/alpha-run-spec.md §Alpha Enemies + §Alpha Boss
const ENEMY_TARGETS = {
  roof_rat:         { type: 'normal', health: 20, band: 'street', damage: { strike_6_a: 6, strike_6_b: 6 } },
  signal_gull:      { type: 'normal', health: 24, band: 'street', damage: { peck_5: 5 } },
  wire_hawk:        { type: 'normal', health: 28, band: 'street', damage: { heavy_strike_11: 11, strike_7: 7 } },
  tarline_crew:     { type: 'rival',  health: 34, band: 'rival',  damage: { harass_6: 6, heavy_strike_12: 12 } },
  tar_crowned_crow: { type: 'boss',   health: 46, band: 'boss',   fightLength: [6, 8], damage: { crowbar_tap: 8, tar_toss: 5, heavy_strike: 13 } },
};
// §Alpha Enemies rewards / §Alpha Boss rewards (also next-level-data-contracts §3)
const REWARD_BANDS = { street: { scrap: [25, 40] }, rival: { scrap: [70, 90] }, boss: { scrap: 120 } };
// §Starter Deck / §Alpha Reward Pool — the full arcana deck is now playable, so
// the reward pool is every non-starter playable card (84 non-snag minus 10 starter).
const DECK_TARGETS = { starter: 10, rewardPool: 74 };
// next-level-data-contracts §5.5 status registry ids
const STATUS_IDS = ['winded', 'openSky', 'openSkyGuard', 'molt'];
// next-level-data-contracts §3 reward-profile ids -> band
const PROFILE_BANDS = { street_standard: 'street', rival_standard: 'rival', boss_alpha: 'boss' };

const damageOf = (intent) => {
  for (const e of intent?.effects ?? []) {
    const m = /damage\(flock,\s*(\d+)\)/.exec(e);
    if (m) return Number(m[1]);
  }
  return null;
};

// ───────────────────────────────────────── Enemies (alpha-enemies.json) ────────
const enemies = readJson('data/game/alpha-enemies.json');
if (enemies === null) {
  pending.push('alpha-enemies.json absent — enemy health/damage/reward checks skipped');
} else if (enemies) {
  const all = [...(enemies.normalEncounters ?? []), ...(enemies.rivalEncounters ?? []), ...(enemies.bosses ?? [])];
  const byId = new Map(all.map((e) => [e.id, e]));
  for (const [id, t] of Object.entries(ENEMY_TARGETS)) {
    const e = byId.get(id);
    if (!e) { fail(`enemy "${id}": authored in alpha-run-spec but missing from data`); continue; }
    if (e.type !== t.type) fail(`enemy "${id}".type: data=${e.type} but spec=${t.type}`);
    if (e.health !== t.health) fail(`enemy "${id}".health: data=${e.health} but alpha-run-spec=${t.health}`);
    else pass(`enemy "${id}" health ${t.health}`);
    if (t.fightLength) {
      if (!scrapEq(e.fightLengthTarget, t.fightLength)) fail(`enemy "${id}".fightLengthTarget: data=${JSON.stringify(e.fightLengthTarget)} but spec=${JSON.stringify(t.fightLength)}`);
      else pass(`enemy "${id}" fight length ${t.fightLength.join('-')}`);
    }
    // per-move authored damage
    const movesById = new Map((e.moves ?? []).map((m) => [m.id, m]));
    for (const [moveId, want] of Object.entries(t.damage)) {
      const got = damageOf(movesById.get(moveId));
      if (got === null) fail(`enemy "${id}" move "${moveId}": no damage(flock,N) found, spec expects ${want}`);
      else if (got !== want) fail(`enemy "${id}" move "${moveId}" damage: data=${got} but spec=${want}`);
      else pass(`enemy "${id}" move "${moveId}" damage ${want}`);
    }
    // reward scrap band
    const wantScrap = REWARD_BANDS[t.band].scrap;
    const gotScrap = e.rewards?.scrap;
    if (!scrapEq(gotScrap, wantScrap)) fail(`enemy "${id}" reward scrap: data=${fmtScrap(gotScrap)} but spec ${t.band} band=${fmtScrap(wantScrap)}`);
    else pass(`enemy "${id}" reward scrap ${fmtScrap(wantScrap)}`);
  }
}

// ───────────────────────────────────────── Deck sizes (alpha-cards.json) ───────
const cards = readJson('data/game/alpha-cards.json');
if (cards === null) {
  pending.push('alpha-cards.json absent — deck-size checks skipped');
} else if (cards) {
  if ((cards.starterDeck ?? []).length !== DECK_TARGETS.starter) fail(`starterDeck size: data=${(cards.starterDeck ?? []).length} but alpha-run-spec=${DECK_TARGETS.starter}`);
  else pass(`starter deck size ${DECK_TARGETS.starter}`);
  if ((cards.rewardPool ?? []).length !== DECK_TARGETS.rewardPool) fail(`rewardPool size: data=${(cards.rewardPool ?? []).length} but alpha-run-spec=${DECK_TARGETS.rewardPool}`);
  else pass(`reward pool size ${DECK_TARGETS.rewardPool}`);
}

// ──────────────────── Phase-3 files: check when present, else PENDING ───────────
const rewardProfiles = readJson('data/game/alpha-reward-profiles.json');
if (rewardProfiles === null) {
  pending.push('alpha-reward-profiles.json not authored — profile scrap bands will be checked here (next-level-data-contracts §3)');
} else if (rewardProfiles) {
  const byId = new Map((Array.isArray(rewardProfiles) ? rewardProfiles : rewardProfiles.profiles ?? []).map((p) => [p.id, p]));
  for (const [pid, band] of Object.entries(PROFILE_BANDS)) {
    const prof = byId.get(pid);
    if (!prof) { fail(`reward profile "${pid}": missing`); continue; }
    if (!scrapEq(prof.scrap, REWARD_BANDS[band].scrap)) fail(`reward profile "${pid}".scrap: data=${fmtScrap(prof.scrap)} but spec ${band} band=${fmtScrap(REWARD_BANDS[band].scrap)}`);
    else pass(`reward profile "${pid}" scrap ${fmtScrap(REWARD_BANDS[band].scrap)}`);
  }
}

const statuses = readJson('data/game/alpha-statuses.json');
if (statuses === null) {
  pending.push(`alpha-statuses.json not authored — registry must hold exactly {${STATUS_IDS.join(', ')}} (next-level-data-contracts §5.5)`);
} else if (statuses) {
  const ids = new Set((Array.isArray(statuses) ? statuses : statuses.statuses ?? []).map((s) => s.id));
  for (const want of STATUS_IDS) {
    if (!ids.has(want)) fail(`status registry: missing "${want}"`);
    else pass(`status "${want}" registered`);
  }
  for (const got of ids) if (!STATUS_IDS.includes(got)) fail(`status registry: unexpected "${got}" (registry must hold only shipped statuses)`);
}

const supplies = readJson('data/game/alpha-supplies.json');
if (supplies === null) pending.push('alpha-supplies.json not authored — expect 5 supplies (alpha-run-spec §Supplies)');
else if (supplies) {
  const n = (Array.isArray(supplies) ? supplies : supplies.supplies ?? []).length;
  if (n !== 5) fail(`supplies count: data=${n} but alpha-run-spec authors 5`);
  else pass('supply count 5');
}

for (const f of ['alpha-encounters.json', 'alpha-market.json', 'alpha-signals.json', 'alpha-basins.json', 'alpha-nests.json', 'alpha-cache.json']) {
  if (readJson(`data/game/${f}`) === null) pending.push(`${f} not authored yet (Phase-3 backbone)`);
}

// ─────────────────────────────────────────────────────────── report ───────────
console.log(`content audit: ${passes.length} checks passed, ${problems.length} drift, ${pending.length} pending\n`);
if (pending.length) {
  console.log('PENDING (not yet authored — checks will activate when the file lands):');
  for (const p of pending) console.log(`  · ${p}`);
  console.log('');
}
if (problems.length) {
  console.log('DRIFT (data does not match the authored spec):');
  for (const p of problems) console.log(`  ✗ ${p}`);
  console.log('');
  process.exit(1);
}
console.log('No source-vs-data drift. All authored balance targets match.');

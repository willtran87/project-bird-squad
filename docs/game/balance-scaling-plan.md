# Bird Squad Balance Scaling Plan

This pass turns run progression into a measured model instead of a loose bundle of random rewards. The goal is not to remove variety; it is to give every generated route a predictable progression spine, then let choices vary inside bounded economy and recovery ranges.

## Run Model

Balance is tracked per district in `data/game/balance-config.json`.

- `expectedFlockPower` is the target player strength entering the district.
- `routeGeneration.minimumCounts` guarantees the node mix before weighted fill is applied.
- `routeGeneration.requiredOpeningTypes` controls the first generated column after the fixed opener.
- `routeGeneration.preBossTypes` guarantees a recovery or deck-improvement branch before the boss.
- `economy` defines Scrap targets for street, rival, boss, cache, and skipped card rewards.
- `targets` defines expected fight length, Cohesion loss, boss-entry deck size, and boss-entry Waymark count.

## Flock Power Index

Use the audit script's Flock Power Index as the first-pass quantitative measure:

```text
FPI =
  damage * 1.3
  + cover
  + regen * 1.2
  + draw * 2
  + resonance * 0.8
  + openSkyGuard
  + moltPower * 1.1
  + cohesion / 6
  + suitKeystones * 3
  + preenedCards * 1.5
```

This is intentionally simple. It is a comparison tool for run pacing, not a perfect combat simulator. If a district feels too lethal, compare enemy pressure against expected FPI before changing individual cards.

## Route Scaling

Generated routes should obey these constraints:

- The fixed entry node and the first generated column are combat nodes, so every run teaches combat before offering softer choices.
- Each district guarantees minimum counts for safety, economy, signals, rivals, and caches.
- The final generated column before the boss alternates between Basin and Nest nodes, preventing a seed from forcing a dry boss approach.
- Districts grow mostly through rewards, pressure, and target expectations rather than route length, keeping run time stable.

## Economy Targets

Scrap rewards scale by district:

| District | Street | Rival | Boss | Cache | Skip |
| --- | ---: | ---: | ---: | ---: | ---: |
| Rooftop Blocks | 18-30 | 55-75 | 90 | 30 | 12 |
| Canal Markets | 25-35 | 72-88 | 120 | 35 | 14 |
| Signal Spires | 31-41 | 86-104 | 120 | 40 | 16 |
| High Roost | 36-48 | 98-122 | 150 | 45 | 18 |

Boss payouts now scale through High Roost because Waymarks and late-run preening make the final district a capstone economy check, not just a conversion point. If a fifth district is added, set the next expected FPI band first, then extend the street/rival/boss bands from that target.

## Economy Simulation

Run:

```powershell
npm run audit:economy
```

The simulator samples seeded routes across all four districts and reports:

- average Scrap gained per district
- average boss-entry deck size
- average boss-entry Waymark count
- average preen/release/service opportunities
- route node mix and safety counts
- drift against `balance-config.json` targets

The simulator is not a combat AI. It uses transparent route/economy assumptions: combats pay their authored reward profile, normal combat Waymark odds use `routeMarkChance`, caches use the configured expected cache value, nests assume one Preen opportunity, and markets buy one card or Waymark only when the sampled run can afford it. Use it to catch economy drift and pacing outliers before running manual playtests.

## Audit Loop

Run:

```powershell
node tools\balance-audit.mjs
npm run audit:economy
```

Look for:

- Leader starting FPI within a narrow band.
- Encounter HP and max-hit stacks rising with expected FPI.
- No generated route path with zero safety before a boss.
- Economy EV high enough to afford one meaningful market/service action per district without guaranteeing every purchase.
- Simulated boss-entry deck size and Waymark count close to the district `targets` band.

When adjusting balance, change `balance-config.json` first, then use card/enemy edits only when the audit shows a specific outlier.

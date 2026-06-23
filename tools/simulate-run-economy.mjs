#!/usr/bin/env node
// Simulate authored route/economy outcomes across many deterministic seeds.
//
// This is a pacing analyzer, not a combat bot. It samples route choices and
// economy payouts from runtime data, then compares boss-entry deck/Waymark
// counts against data/game/balance-config.json targets.

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
  return [key, value];
}));
const samples = Math.max(1, Number(args.get('seeds') ?? 500));
const jsonOutput = args.has('json');

const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const round1 = (value) => Math.round(value * 10) / 10;
const rangeStatus = (value, range, tolerance = 0.5) => {
  if (value < range[0] - tolerance) return 'low';
  if (value > range[1] + tolerance) return 'high';
  return 'ok';
};
const fmtRange = (range) => `${range[0]}-${range[1]}`;

const hashString = (text) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const mulberry32 = (seed) => () => {
  let t = seed += 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const pick = (rng, items) => items[Math.floor(rng() * items.length)];
const rollRange = (rng, value) => {
  if (!Array.isArray(value)) return value ?? 0;
  const [min, max] = value;
  return min + Math.floor(rng() * (max - min + 1));
};

const parseEffect = (effect) => {
  const match = /^([a-zA-Z][a-zA-Z0-9]*)\((.*)\)$/.exec(effect);
  if (!match) return undefined;
  return {
    name: match[1],
    args: match[2].split(',').map((arg) => arg.trim()).filter(Boolean),
  };
};

const effectValue = (effect, verb) => {
  const parsed = parseEffect(effect);
  return parsed?.name === verb ? Number(parsed.args[0]) || 0 : 0;
};

const rewardProfiles = readJson('data/game/alpha-reward-profiles.json').profiles;
const rewardById = new Map(rewardProfiles.map((profile) => [profile.id, profile]));
const routeMarks = readJson('data/game/alpha-route-marks.json').routeMarks;
const cacheOptions = readJson('data/game/alpha-cache.json').options;
const basinOptions = readJson('data/game/alpha-basins.json').options;
const nestOptions = readJson('data/game/alpha-nests.json').options;
const balance = readJson('data/game/balance-config.json');
const market = readJson('data/game/alpha-market.json').markets[0];

const mapSources = [
  {
    map: readJson('data/game/alpha-route-map.json'),
    encounters: readJson('data/game/alpha-encounters.json').encounters,
  },
  ...['map02-content.json', 'map03-content.json', 'map04-content.json'].map((file) => {
    const content = readJson(`data/game/${file}`);
    return { map: content.routeMap, encounters: content.encounters };
  }),
];

const encounterById = new Map(mapSources.flatMap((source) => source.encounters.map((encounter) => [encounter.id, encounter])));
const balanceByMap = new Map(balance.maps.map((profile) => [profile.mapId, profile]));
const markById = new Map(routeMarks.map((mark) => [mark.id, mark]));
const WAYMARK_ACTIVE_CAP = 6;

function outgoingFor(routeMap) {
  const outgoing = new Map();
  for (const edge of routeMap.edges) {
    if (edge.locked) continue;
    if (!outgoing.has(edge.from)) outgoing.set(edge.from, []);
    outgoing.get(edge.from).push(edge.to);
  }
  return outgoing;
}

function samplePath(routeMap, rng) {
  const byId = new Map(routeMap.nodes.map((node) => [node.id, node]));
  const outgoing = outgoingFor(routeMap);
  const pathIds = [];
  let current = routeMap.entryNodeId;
  const guard = routeMap.nodes.length + 5;
  for (let i = 0; i < guard && current; i += 1) {
    pathIds.push(current);
    if (current === routeMap.bossNodeId) break;
    const nextIds = outgoing.get(current) ?? [];
    if (nextIds.length === 0) break;
    current = pick(rng, nextIds);
  }
  return pathIds.map((id) => byId.get(id)).filter(Boolean);
}

function firstUnownedMark(run, rng, source) {
  const pool = routeMarks.filter((mark) => !run.routeMarks.includes(mark.id) && (!source || mark.source === source));
  const fallback = routeMarks.filter((mark) => !run.routeMarks.includes(mark.id));
  return pick(rng, pool.length ? pool : fallback);
}

function addRouteMark(run, rng, source) {
  const mark = firstUnownedMark(run, rng, source);
  return addSpecificRouteMark(run, mark);
}

function addSpecificRouteMark(run, mark) {
  if (mark) {
    const capExempt = mark.source === 'boss' || mark.rarity === 'boss';
    if (!capExempt) {
      const nonBossCount = run.routeMarks.filter((id) => {
        const owned = markById.get(id);
        return owned?.source !== 'boss' && owned?.rarity !== 'boss';
      }).length;
      if (nonBossCount >= WAYMARK_ACTIVE_CAP) {
        const replaceIndex = run.routeMarks.findIndex((id) => {
          const owned = markById.get(id);
          return owned?.source !== 'boss' && owned?.rarity !== 'boss';
        });
        if (replaceIndex >= 0) run.routeMarks.splice(replaceIndex, 1);
      }
    }
    run.routeMarks.push(mark.id);
  }
  return mark?.id;
}

function markValue(run, trigger, verb) {
  return run.routeMarks.reduce((total, id) => {
    const mark = markById.get(id);
    if (!mark || mark.trigger !== trigger) return total;
    const effects = Array.isArray(mark.effects) && mark.effects.length > 0 ? mark.effects : [mark.effect].filter(Boolean);
    return total + effects.reduce((sum, effect) => sum + effectValue(effect, verb), 0);
  }, 0);
}

function applyRouteEffect(run, rng, effect) {
  const parsed = parseEffect(effect);
  if (!parsed) return;
  const n = Number(parsed.args[0]) || 0;
  switch (parsed.name) {
    case 'gainScrap':
      run.scrap += n;
      run.scrapGained += n;
      break;
    case 'payScrap':
      run.scrap = Math.max(0, run.scrap - n);
      break;
    case 'gainRouteMark':
      if (parsed.args[0]?.startsWith('random')) {
        addRouteMark(run, rng);
      } else if (markById.has(parsed.args[0]) && !run.routeMarks.includes(parsed.args[0])) {
        addSpecificRouteMark(run, markById.get(parsed.args[0]));
      }
      break;
    case 'addCard':
      run.deckSize += 1;
      break;
    case 'preenCard':
      run.preens += n || 1;
      break;
    case 'releaseCard':
      run.deckSize = Math.max(1, run.deckSize - (n || 1));
      break;
    case 'gainCacheReward': {
      const choices = cacheOptions.slice(0, 5 + markValue(run, 'cacheChoice', 'extraCacheChoice'));
      const chosen = choices.length ? pick(rng, choices) : undefined;
      chosen?.effects?.forEach((inner) => applyRouteEffect(run, rng, inner));
      break;
    }
    default:
      break;
  }
}

function affordableMarketAction(run, rng) {
  const cardPrice = market.cardSlots[0]?.price?.base ?? 75;
  const waymarkPrice = market.routeMarkSlots[0]?.price?.base ?? 135;
  const preenPrice = Math.max(
    35,
    (market.services.find((service) => service.id === 'preen')?.basePrice ?? 95)
      - markValue(run, 'passive', 'reducePreenPrice')
  );
  const choices = [];
  const bossGuardPrice = 120 + run.mapIndex * 35;
  const routeScoutPrice = 80 + run.mapIndex * 25;
  if (run.mapIndex >= 1 && run.scrap >= bossGuardPrice) choices.push('boss_guard');
  if (run.mapIndex >= 1 && run.scrap >= routeScoutPrice) choices.push('route_scout');
  if (run.scrap >= waymarkPrice) choices.push('waymark');
  if (run.scrap >= cardPrice) choices.push('card');
  if (run.scrap >= preenPrice) choices.push('preen');
  const choice = choices.length ? pick(rng, choices) : undefined;
  if (choice === 'boss_guard') {
    run.scrap -= bossGuardPrice;
    run.marketBuys += 1;
  } else if (choice === 'route_scout') {
    run.scrap -= routeScoutPrice;
    run.marketBuys += 1;
  } else if (choice === 'waymark') {
    run.scrap -= waymarkPrice;
    run.marketBuys += 1;
    addRouteMark(run, rng, 'market');
  } else if (choice === 'card') {
    run.scrap -= cardPrice;
    run.marketBuys += 1;
    run.deckSize += 1;
  } else if (choice === 'preen') {
    run.scrap -= preenPrice;
    run.preens += 1;
  }
}

function optionCost(option) {
  return Number(option.cost ?? option.effects?.map((effect) => effectValue(effect, 'payScrap')).find((value) => value > 0) ?? 0);
}

function applyChoiceOptions(run, rng, options) {
  const affordable = options.filter((option) => optionCost(option) <= run.scrap);
  const chosen = affordable.length ? pick(rng, affordable) : undefined;
  chosen?.effects?.forEach((effect) => applyRouteEffect(run, rng, effect));
}

function applyCombatReward(run, node, rng) {
  const encounter = encounterById.get(node.payloadId);
  const profile = rewardById.get(encounter?.rewardProfileId);
  if (!profile) return;
  const scrap = rollRange(rng, profile.scrap);
  run.scrap += scrap;
  run.scrapGained += scrap;
  if (node.type === 'street') {
    const bonus = markValue(run, 'afterStreetEncounter', 'gainScrap');
    run.scrap += bonus;
    run.scrapGained += bonus;
  }
  if (profile.cardReward) run.deckSize += 1;
  if (profile.preenGuaranteed || (profile.preenChance && rng() < profile.preenChance)) run.preens += 1;
  if (profile.routeMarkGuaranteed || node.type === 'rival' || node.type === 'boss') {
    addRouteMark(run, rng, node.type === 'boss' ? 'boss' : undefined);
  } else if (profile.routeMarkChance && rng() < profile.routeMarkChance) {
    addRouteMark(run, rng);
  }
}

function applyRouteNode(run, node, rng, economy) {
  run.nodeCounts[node.type] = (run.nodeCounts[node.type] ?? 0) + 1;
  if (node.type === 'street' || node.type === 'rival' || node.type === 'boss') {
    applyCombatReward(run, node, rng);
    return;
  }
  if (node.type === 'cache') {
    const choices = cacheOptions.slice(0, 5 + markValue(run, 'cacheChoice', 'extraCacheChoice'));
    const chosen = choices.length ? pick(rng, choices) : undefined;
    chosen?.effects?.forEach((effect) => applyRouteEffect(run, rng, effect));
    return;
  }
  if (node.type === 'signal') {
    const signalScrap = markValue(run, 'signalResolved', 'gainScrap');
    run.scrap += signalScrap;
    run.scrapGained += signalScrap;
    if (rng() < 0.2) run.deckSize += 1;
    return;
  }
  if (node.type === 'nest') {
    applyChoiceOptions(run, rng, nestOptions);
    return;
  }
  if (node.type === 'basin') {
    applyChoiceOptions(run, rng, basinOptions);
    return;
  }
  if (node.type === 'market') affordableMarketAction(run, rng);
}

function simulate(seedIndex) {
  const rng = mulberry32(hashString(`bird-squad-economy:${seedIndex}`));
  const run = {
    scrap: 40,
    scrapGained: 0,
    mapIndex: 0,
    deckSize: 10,
    routeMarks: [],
    preens: 0,
    marketBuys: 0,
    nodeCounts: {},
  };
  const maps = [];
  for (let mapIndex = 0; mapIndex < mapSources.length; mapIndex += 1) {
    const source = mapSources[mapIndex];
    run.mapIndex = mapIndex;
    const profile = balanceByMap.get(source.map.id);
    const path = samplePath(source.map, rng);
    const before = {
      scrap: run.scrap,
      scrapGained: run.scrapGained,
      deckSize: run.deckSize,
      routeMarks: run.routeMarks.length,
      preens: run.preens,
      marketBuys: run.marketBuys,
    };
    const localCounts = {};
    for (const node of path) {
      localCounts[node.type] = (localCounts[node.type] ?? 0) + 1;
      if (node.id === source.map.bossNodeId) {
        maps.push({
          mapId: source.map.id,
          bossEntryScrap: run.scrap,
          bossEntryDeckSize: run.deckSize,
          bossEntryRouteMarks: run.routeMarks.length,
          bossEntryPreens: run.preens,
          pathLength: path.length,
          safetyNodes: (localCounts.basin ?? 0) + (localCounts.nest ?? 0),
          nodeCounts: { ...localCounts },
          targetDeck: profile.targets.bossEntryDeckSize,
          targetMarks: profile.targets.bossEntryRouteMarks,
        });
      }
      applyRouteNode(run, node, rng, profile.economy);
    }
    const latest = maps[maps.length - 1];
    latest.scrapGained = run.scrapGained - before.scrapGained;
    latest.deckDelta = run.deckSize - before.deckSize;
    latest.routeMarkDelta = run.routeMarks.length - before.routeMarks;
    latest.preenDelta = run.preens - before.preens;
    latest.marketBuyDelta = run.marketBuys - before.marketBuys;
  }
  return maps;
}

const allSamples = Array.from({ length: samples }, (_, i) => simulate(i));
const byMap = new Map(mapSources.map((source) => [source.map.id, []]));
for (const run of allSamples) {
  for (const mapResult of run) byMap.get(mapResult.mapId)?.push(mapResult);
}

const rows = [...byMap.entries()].map(([mapId, results]) => {
  const first = results[0];
  const avgCounts = {};
  for (const type of ['street', 'rival', 'boss', 'basin', 'nest', 'market', 'signal', 'cache']) {
    avgCounts[type] = round1(average(results.map((result) => result.nodeCounts[type] ?? 0)));
  }
  const deck = round1(average(results.map((result) => result.bossEntryDeckSize)));
  const marks = round1(average(results.map((result) => result.bossEntryRouteMarks)));
  return {
    mapId,
    samples: results.length,
    scrapGained: round1(average(results.map((result) => result.scrapGained))),
    bossEntryScrap: round1(average(results.map((result) => result.bossEntryScrap))),
    bossEntryDeckSize: deck,
    targetDeck: fmtRange(first.targetDeck),
    deckStatus: rangeStatus(deck, first.targetDeck),
    bossEntryRouteMarks: marks,
    targetMarks: fmtRange(first.targetMarks),
    markStatus: rangeStatus(marks, first.targetMarks),
    preens: round1(average(results.map((result) => result.bossEntryPreens))),
    pathLength: round1(average(results.map((result) => result.pathLength))),
    safetyNodes: round1(average(results.map((result) => result.safetyNodes))),
    nodeCounts: avgCounts,
  };
});

if (jsonOutput) {
  console.log(JSON.stringify({ samples, rows }, null, 2));
  process.exit(0);
}

console.log(`Bird Squad economy simulation (${samples} seeded full-run samples)`);
console.log('');
console.log('Assumptions: route choices are sampled uniformly from legal exits; combat rewards use authored profiles;');
console.log('caches/nests/basins sample live choice tables; markets buy one affordable card/Preen/Waymark/prep service.');
console.log('');
const headers = ['Map', 'Scrap+', 'Boss Scrap', 'Deck', 'Deck Target', 'Waymarks', 'WM Target', 'Preens', 'Safety', 'Status'];
const table = rows.map((row) => [
  row.mapId,
  row.scrapGained,
  row.bossEntryScrap,
  row.bossEntryDeckSize,
  row.targetDeck,
  row.bossEntryRouteMarks,
  row.targetMarks,
  row.preens,
  row.safetyNodes,
  `${row.deckStatus}/${row.markStatus}`,
]);
const widths = headers.map((header, index) => Math.max(header.length, ...table.map((row) => String(row[index]).length)));
const printRow = (row) => console.log(row.map((cell, index) => String(cell).padEnd(widths[index])).join('  '));
printRow(headers);
printRow(headers.map((header, index) => '-'.repeat(widths[index])));
for (const row of table) printRow(row);

console.log('');
console.log('Average sampled node counts:');
for (const row of rows) {
  console.log(`- ${row.mapId}: ${Object.entries(row.nodeCounts).map(([type, count]) => `${type} ${count}`).join(', ')}`);
}

const drifts = rows.filter((row) => row.deckStatus !== 'ok' || row.markStatus !== 'ok');
if (drifts.length) {
  console.log('');
  console.log('Tuning watchlist:');
  for (const row of drifts) {
    const notes = [];
    if (row.deckStatus !== 'ok') notes.push(`deck ${row.deckStatus} vs ${row.targetDeck}`);
    if (row.markStatus !== 'ok') notes.push(`Waymarks ${row.markStatus} vs ${row.targetMarks}`);
    console.log(`- ${row.mapId}: ${notes.join('; ')}`);
  }
}

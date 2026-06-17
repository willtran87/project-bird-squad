#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const avg = (items) => items.length ? items.reduce((sum, value) => sum + value, 0) / items.length : 0;
const sum = (items) => items.reduce((total, value) => total + value, 0);
const fmt = (value) => Math.round(value * 10) / 10;

const balance = readJson('data/game/balance-config.json');
const alphaCards = readJson('data/game/alpha-cards.json');
const alphaEnemies = readJson('data/game/alpha-enemies.json');
const alphaEncounters = readJson('data/game/alpha-encounters.json');
const alphaRouteMap = readJson('data/game/alpha-route-map.json');
const mapContents = [
  readJson('data/game/map02-content.json'),
  readJson('data/game/map03-content.json'),
  readJson('data/game/map04-content.json'),
];

const maps = [
  {
    id: alphaRouteMap.id,
    routeMap: alphaRouteMap,
    enemies: [...alphaEnemies.normalEncounters, ...alphaEnemies.rivalEncounters, ...alphaEnemies.bosses],
    encounters: alphaEncounters.encounters,
  },
  ...mapContents.map((content) => ({
    id: content.routeMap.id,
    routeMap: content.routeMap,
    enemies: content.enemies,
    encounters: content.encounters,
  })),
];

const cardById = new Map(alphaCards.cards.map((card) => [card.id, card]));
const enemyById = new Map(maps.flatMap((map) => map.enemies).map((enemy) => [enemy.id, enemy]));
const balanceByMap = new Map(balance.maps.map((profile) => [profile.mapId, profile]));

function damageFromMove(move) {
  return sum((move.effects ?? []).map((effect) => {
    let total = 0;
    const re = /damage\(flock, (\d+)\)/g;
    let match;
    while ((match = re.exec(effect))) total += Number(match[1]);
    return total;
  }));
}

function routeStats(routeMap) {
  const nodeById = new Map(routeMap.nodes.map((node) => [node.id, node]));
  const outgoing = new Map();
  for (const edge of routeMap.edges) {
    if (!outgoing.has(edge.from)) outgoing.set(edge.from, []);
    outgoing.get(edge.from).push(edge.to);
  }
  const paths = [];
  const walk = (nodeId, pathSoFar = []) => {
    const path = [...pathSoFar, nodeId];
    if (nodeId === routeMap.bossNodeId) {
      paths.push(path);
      return;
    }
    for (const next of outgoing.get(nodeId) ?? []) walk(next, path);
  };
  walk(routeMap.entryNodeId);
  const pathCounts = paths.map((path) => {
    const counts = {};
    for (const nodeId of path) {
      const type = nodeById.get(nodeId)?.type;
      if (type) counts[type] = (counts[type] ?? 0) + 1;
    }
    return counts;
  });
  const nodeCounts = {};
  for (const node of routeMap.nodes) nodeCounts[node.type] = (nodeCounts[node.type] ?? 0) + 1;
  const pathAvg = (type) => fmt(avg(pathCounts.map((counts) => counts[type] ?? 0)));
  return {
    nodes: routeMap.nodes.length,
    paths: paths.length,
    nodeCounts,
    avgPath: {
      street: pathAvg('street'),
      rival: pathAvg('rival'),
      basin: pathAvg('basin'),
      nest: pathAvg('nest'),
      market: pathAvg('market'),
      signal: pathAvg('signal'),
      cache: pathAvg('cache'),
    },
    minSafety: Math.min(...pathCounts.map((counts) => (counts.basin ?? 0) + (counts.nest ?? 0))),
    maxStreet: Math.max(...pathCounts.map((counts) => counts.street ?? 0)),
  };
}

function parseLeaderDecks() {
  const source = fs.readFileSync(path.join(root, 'src/game/leaders.ts'), 'utf8');
  return [...source.matchAll(/id: '([^']+)'[\s\S]*?startingDeckIds: \[([^\]]+)\]/g)]
    .map((match) => ({
      id: match[1],
      cards: [...match[2].matchAll(/'([^']+)'/g)].map((cardMatch) => cardMatch[1]),
    }));
}

function aggregateStats(cardIds) {
  const stats = {};
  for (const id of cardIds) {
    const card = cardById.get(id);
    for (const [key, value] of Object.entries(card?.flockStats ?? {})) {
      stats[key] = (stats[key] ?? 0) + value;
    }
  }
  return stats;
}

function flockPowerIndex(stats, suitCounts, preenedCards = 0) {
  const keystones = Object.values(suitCounts).filter((count) => count >= 5).length;
  return fmt(
    (stats.damage ?? 0) * 1.3 +
    (stats.cover ?? 0) +
    (stats.regen ?? 0) * 1.2 +
    (stats.draw ?? 0) * 2 +
    (stats.resonance ?? 0) * 0.8 +
    (stats.openSkyGuard ?? 0) +
    (stats.moltPower ?? 0) * 1.1 +
    (stats.cohesion ?? 0) / 6 +
    keystones * 3 +
    preenedCards * 1.5
  );
}

console.log('Bird Squad balance audit');
console.log('');

console.log('Leader starts:');
for (const leader of parseLeaderDecks()) {
  const stats = aggregateStats(leader.cards);
  const suitCounts = {};
  for (const id of leader.cards) {
    const suit = cardById.get(id)?.suit ?? cardById.get(id)?.kind ?? 'unknown';
    suitCounts[suit] = (suitCounts[suit] ?? 0) + 1;
  }
  console.log(`- ${leader.id}: FPI ${flockPowerIndex(stats, suitCounts)} | stats ${JSON.stringify(stats)} | suits ${JSON.stringify(suitCounts)}`);
}

console.log('');
console.log('District encounter pressure:');
for (const map of maps) {
  const profile = balanceByMap.get(map.id);
  const encounterRows = map.encounters.map((encounter) => {
    const enemies = encounter.enemies.map((id) => enemyById.get(id)).filter(Boolean);
    const supportCount = enemies.filter((enemy) => enemy.roles?.includes('support')).length;
    const poisonCount = enemies.filter((enemy) => enemy.roles?.includes('poison')).length;
    return {
      id: encounter.id,
      band: encounter.band,
      n: enemies.length,
      supportCount,
      poisonCount,
      hp: sum(enemies.map((enemy) => enemy.health)),
      maxHit: sum(enemies.map((enemy) => Math.max(...enemy.moves.map(damageFromMove)))),
    };
  });
  const route = routeStats(map.routeMap);
  const multiRows = encounterRows.filter((row) => row.n > 1);
  const soloRows = encounterRows.filter((row) => row.n === 1 && row.band !== 'boss');
  const supportMultiRows = multiRows.filter((row) => row.supportCount > 0);
  const poisonRows = encounterRows.filter((row) => row.poisonCount > 0);
  console.log(`- ${map.id}: expected FPI ${profile?.expectedFlockPower ?? 'n/a'}`);
  console.log(`  route authored paths ${route.paths}, avg path ${JSON.stringify(route.avgPath)}, min safety ${route.minSafety}, max street ${route.maxStreet}`);
  console.log(`  enemies HP avg ${fmt(avg(map.enemies.map((enemy) => enemy.health)))}, max hit ${Math.max(...map.enemies.flatMap((enemy) => enemy.moves.map(damageFromMove)))}`);
  console.log(`  composition: ${soloRows.length} solo tuned fights, ${supportMultiRows.length}/${multiRows.length} multi fights include support, ${poisonRows.length} poison-status fights`);
  for (const row of encounterRows.sort((a, b) => b.hp - a.hp).slice(0, 3)) {
    console.log(`  top pressure: ${row.id} [${row.band}] ${row.n} enemy, ${row.hp} HP, ${row.maxHit} max-hit stack`);
  }
}

console.log('');
console.log('Economy targets:');
for (const profile of balance.maps) {
  console.log(`- ${profile.mapId}: street ${profile.economy.streetScrap.join('-')}, rival ${profile.economy.rivalScrap.join('-')}, boss ${profile.economy.bossScrap}, cache ${profile.economy.cacheScrap}, skip ${profile.economy.skipScrap}`);
}

import type { RouteEdge, RouteNode, RouteNodeType, RouteRisk, RuntimeRouteMap } from './types';
import { getMapBalanceProfile, weightedPick, type RouteGenNodeType } from './balance';

// Procedural route generation. Each run builds a larger, branching, randomized
// district graph from the map's content pools — deterministic given a seed, so a
// run is reproducible (and survives save/resume) without storing the whole graph.

// The content a map is generated from (derived from the authored route map +
// encounter/signal libraries in runtime-data).
export interface RouteBlueprint {
  id: string;
  name: string;
  index: number;
  entryEncounterId: string; // fixed opening fight
  bossEncounterId: string;
  streetEncounterIds: string[];
  rivalEncounterIds: string[];
  signalIds: string[];
  basinPayloadId: string;
  nestPayloadId: string;
  marketPayloadId: string;
  cachePayloadId: string;
}

// Small deterministic PRNG (mulberry32).
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Stable string -> 32-bit seed (so a run's text seed + map index is reproducible).
export function hashSeed(text: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const LABELS: Record<RouteNodeType, string> = {
  street: 'Street Encounter',
  rival: 'Rival Crew',
  boss: 'Boss',
  basin: 'Basin',
  nest: 'Nest',
  market: 'Market',
  signal: 'Signal',
  cache: 'Rooftop Cache',
};

export function generateRouteMap(bp: RouteBlueprint, seed: number): RuntimeRouteMap {
  const rand = mulberry32(seed);
  const ri = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  const pick = <T,>(arr: T[]): T | undefined => (arr.length ? arr[Math.floor(rand() * arr.length)] : undefined);
  const shuffle = <T,>(items: T[]): T[] => {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  };

  const balance = getMapBalanceProfile(bp.id, bp.index).routeGeneration;
  const middleCols = ri(balance.middleColumns[0], balance.middleColumns[1]);
  const totalCols = middleCols + 2;
  const columns: string[][] = [];
  const nodes: RouteNode[] = [];
  const byId = new Map<string, RouteNode>();

  const payloadFor = (type: RouteNodeType): string => {
    switch (type) {
      case 'street': return pick(bp.streetEncounterIds) ?? bp.entryEncounterId;
      case 'rival': return pick(bp.rivalEncounterIds) ?? pick(bp.streetEncounterIds) ?? bp.entryEncounterId;
      case 'signal': return pick(bp.signalIds) ?? bp.basinPayloadId;
      case 'basin': return bp.basinPayloadId;
      case 'nest': return bp.nestPayloadId;
      case 'market': return bp.marketPayloadId;
      case 'cache': return bp.cachePayloadId;
      default: return bp.entryEncounterId;
    }
  };
  const riskFor = (type: RouteNodeType): RouteRisk => {
    if (type === 'boss') return 'boss';
    if (type === 'rival') return 'high';
    if (type === 'street') return rand() < 0.5 ? 'low' : 'medium';
    return 'low';
  };
  const make = (id: string, column: number, lane: number, type: RouteNodeType, payloadId: string): RouteNode => {
    const node: RouteNode = { id, column, lane, type, label: LABELS[type], payloadId, risk: riskFor(type), revealed: true, completed: false };
    nodes.push(node);
    byId.set(id, node);
    return node;
  };
  const setType = (node: RouteNode, type: RouteNodeType) => {
    node.type = type;
    node.label = LABELS[type];
    node.payloadId = payloadFor(type);
    node.risk = riskFor(type);
  };

  // Column 0: the fixed opening street fight.
  const entryId = `m${bp.index}_entry`;
  columns[0] = [entryId];
  make(entryId, 0, 0, 'street', bp.entryEncounterId);

  // Middle columns: lanes and node quotas come from the district balance profile.
  for (let c = 1; c <= middleCols; c += 1) {
    const lanes = ri(balance.lanes[0], balance.lanes[1]);
    const ids: string[] = [];
    for (let l = 0; l < lanes; l += 1) {
      const id = `m${bp.index}_c${c}_l${l}`;
      ids.push(id);
      make(id, c, l, 'street', payloadFor('street'));
    }
    columns[c] = ids;
  }

  // Boss column.
  const bossId = `m${bp.index}_boss`;
  columns[totalCols - 1] = [bossId];
  make(bossId, totalCols - 1, 0, 'boss', bp.bossEncounterId);

  // Assign middle node types from district quotas, then weighted fill. This keeps
  // routes varied without letting a seed accidentally starve safety/economy nodes.
  const middle = nodes.filter((n) => n.column >= 1 && n.column <= middleCols);
  const quotaBag: RouteGenNodeType[] = [];
  for (const [type, count] of Object.entries(balance.minimumCounts) as Array<[RouteGenNodeType, number]>) {
    for (let i = 0; i < count; i += 1) quotaBag.push(type);
  }
  while (quotaBag.length < middle.length) quotaBag.push(weightedPick(balance.fillWeights, rand));
  shuffle(quotaBag);
  middle.forEach((n, index) => setType(n, quotaBag[index] ?? 'street'));

  const applyOpeningColumn = () => {
    // Every route should start with a second real fight after the entry node, so
    // early pathing teaches combat before the first recovery/economy fork.
    const openingTypes: RouteGenNodeType[] = balance.requiredOpeningTypes.length ? balance.requiredOpeningTypes : ['street'];
    for (const [index, nodeId] of (columns[1] ?? []).entries()) {
      const node = byId.get(nodeId);
      if (node) setType(node, openingTypes[index % openingTypes.length]);
    }
  };
  const applyPreBossColumn = () => {
    // Every boss approach gets an explicit stabilizer choice. Earlier columns may
    // still be greedy, but no seed can route the player to a boss with no
    // Basin/Nest-style safety valve available on the final branch.
    const preBossTypes: RouteGenNodeType[] = balance.preBossTypes.length ? balance.preBossTypes : ['basin', 'nest'];
    for (const [index, nodeId] of (columns[middleCols] ?? []).entries()) {
      const node = byId.get(nodeId);
      if (node) setType(node, preBossTypes[index % preBossTypes.length]);
    }
  };
  applyOpeningColumn();
  applyPreBossColumn();

  // Guarantee each non-street type appears at least once (variety + node-type coverage).
  const ensure = (type: RouteNodeType, available: boolean) => {
    if (!available || middle.some((n) => n.type === type)) return;
    const unprotected = middle.filter((n) => n.column !== 1 && n.column !== middleCols);
    const target = pick(unprotected.filter((n) => n.type === 'street')) ?? pick(unprotected) ?? pick(middle);
    if (target) setType(target, type);
  };
  ensure('rival', bp.rivalEncounterIds.length > 0);
  ensure('signal', bp.signalIds.length > 0);
  ensure('market', true);
  ensure('basin', true);
  ensure('nest', true);
  ensure('cache', true);
  applyOpeningColumn();
  applyPreBossColumn();

  // Edges: connect every column fully to the next (so every node has an outgoing
  // and an incoming) plus extra branching, guaranteeing entry->boss reachability.
  const edges: RouteEdge[] = [];
  const seen = new Set<string>();
  const addEdge = (from: string, to: string) => {
    const key = `${from}->${to}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ from, to, locked: false, preview: 'known' });
  };
  for (let c = 0; c < totalCols - 1; c += 1) {
    const from = columns[c];
    const to = columns[c + 1];
    const hasIncoming = new Set<number>();
    from.forEach((fid, i) => {
      const base = to.length === 1 ? 0 : Math.round((i * (to.length - 1)) / Math.max(1, from.length - 1));
      addEdge(fid, to[base]);
      hasIncoming.add(base);
      if (to.length > 1 && rand() < 0.5) {
        const branch = Math.min(to.length - 1, Math.max(0, base + (rand() < 0.5 ? -1 : 1)));
        addEdge(fid, to[branch]);
        hasIncoming.add(branch);
      }
    });
    to.forEach((tid, t) => {
      if (hasIncoming.has(t)) return;
      const src = from[Math.min(from.length - 1, Math.round((t * (from.length - 1)) / Math.max(1, to.length - 1)))];
      addEdge(src, tid);
    });
  }

  return {
    version: '0.1',
    project: 'Bird Squad',
    basedOn: ['procedural'],
    id: bp.id,
    name: bp.name,
    index: bp.index,
    seed: String(seed),
    entryNodeId: entryId,
    bossNodeId: bossId,
    columns,
    nodes,
    edges,
  };
}

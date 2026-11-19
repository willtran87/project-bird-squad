import { describe, expect, it } from 'vitest';
import { getMapBalanceProfile } from './balance';
import { generateRouteMap, hashSeed } from './route-gen';
import { routeBlueprints } from './runtime-data';

const seeds = ['alpha', 'story-after-storm-v1', 'x1', 'seed-42', 'zz-top'];

describe('hashSeed', () => {
  it('is a stable unsigned 32-bit hash that depends on text and salt', () => {
    expect(hashSeed('alpha', 0)).toBe(hashSeed('alpha', 0));
    expect(hashSeed('alpha', 0)).not.toBe(hashSeed('alpha', 1));
    expect(hashSeed('alpha', 0)).not.toBe(hashSeed('alphb', 0));
    for (const seed of seeds) {
      const value = hashSeed(seed, 7);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(2 ** 32);
    }
  });
});

describe('generateRouteMap', () => {
  it('has blueprints for every authored map', () => {
    expect(routeBlueprints.length).toBeGreaterThan(0);
  });

  for (const rhythm of [false, true]) {
    it(`is deterministic for a seed (rhythm=${rhythm})`, () => {
      for (const blueprint of routeBlueprints) for (const seed of seeds) {
        const numeric = hashSeed(seed, blueprint.index);
        expect(generateRouteMap(blueprint, numeric, rhythm)).toEqual(generateRouteMap(blueprint, numeric, rhythm));
      }
    });

    it(`produces a well-formed, fully reachable graph (rhythm=${rhythm})`, () => {
      for (const blueprint of routeBlueprints) for (const seed of seeds) {
        const map = generateRouteMap(blueprint, hashSeed(seed, blueprint.index), rhythm);
        const balance = getMapBalanceProfile(blueprint.id, blueprint.index).routeGeneration;
        const ids = new Set(map.nodes.map((node) => node.id));
        expect(ids.size, `${blueprint.id}/${seed}: unique ids`).toBe(map.nodes.length);
        expect(map.columns.flat().sort()).toEqual([...ids].sort());
        const middle = map.columns.length - 2;
        expect(middle).toBeGreaterThanOrEqual(balance.middleColumns[0]);
        expect(middle).toBeLessThanOrEqual(balance.middleColumns[1]);
        expect(map.columns[0]).toEqual([map.entryNodeId]);
        expect(map.columns.at(-1)).toEqual([map.bossNodeId]);
        expect(map.nodes.find((node) => node.id === map.bossNodeId)?.type).toBe('boss');
        expect(map.nodes.filter((node) => node.type === 'boss')).toHaveLength(1);
        for (const edge of map.edges) {
          expect(ids.has(edge.from) && ids.has(edge.to), `${edge.from}->${edge.to}`).toBe(true);
        }
        // Every node is reachable from the entry and can reach the boss.
        const forward = new Map<string, string[]>();
        const backward = new Map<string, string[]>();
        for (const edge of map.edges) {
          forward.set(edge.from, [...(forward.get(edge.from) ?? []), edge.to]);
          backward.set(edge.to, [...(backward.get(edge.to) ?? []), edge.from]);
        }
        const walk = (start: string, graph: Map<string, string[]>) => {
          const seen = new Set([start]);
          const queue = [start];
          while (queue.length) for (const next of graph.get(queue.shift()!) ?? []) if (!seen.has(next)) { seen.add(next); queue.push(next); }
          return seen;
        };
        expect(walk(map.entryNodeId, forward).size, `${blueprint.id}/${seed}: reachable`).toBe(ids.size);
        expect(walk(map.bossNodeId, backward).size, `${blueprint.id}/${seed}: reaches boss`).toBe(ids.size);
      }
    });
  }

  it('different seeds produce different layouts', () => {
    const blueprint = routeBlueprints[0];
    const layouts = new Set(seeds.map((seed) => JSON.stringify(generateRouteMap(blueprint, hashSeed(seed, 0)).nodes.map((node) => node.type))));
    expect(layouts.size).toBeGreaterThan(1);
  });
});

import { test, expect } from '@playwright/test';
import { boot } from './helpers/smoke';

// Split from the former tests/smoke.spec.ts (combat-presentation topics). Tests drive
// scenes through the deterministic text-state harness on window.

test('combat end turn control renders generated roost command frame', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const battle: any = g.scene.getScene('BattleScene');
    const countTexture = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-combat-roost-command-frame' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTexture(child.list) : 0;
      return sum + self + nested;
    }, 0);
    for (let i = 0; i < 40; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (state.combatRoostCommandFrame?.loaded && battle.root.getByName('combat-roost-hit')?.input?.enabled) break;
      await wait(50);
    }
    const state = JSON.parse(window.render_game_to_text!());
    return {
      combatRoostCommandFrame: state.combatRoostCommandFrame,
      frameObjects: countTexture(battle.root?.list ?? battle.children.list),
      commandHeight: battle.root.getByName('combat-roost-hit')?.height,
    };
  });

  expect(result.combatRoostCommandFrame).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.frameObjects).toBe(0);
  expect(result.commandHeight).toBeGreaterThanOrEqual(58);
});

test('combat floating text uses generated callout backplate', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const battle: any = g.scene.getScene('BattleScene');
    const countTexture = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'combat-floating-callout' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTexture(child.list) : 0;
      return sum + self + nested;
    }, 0);
    const objectsFor = (items: any[]): Array<{ name: string; width: number; height: number; alpha: number }> => items
      .flatMap((child: any) => {
        const nested = Array.isArray(child.list) ? objectsFor(child.list) : [];
        const self = child.texture?.key === 'combat-floating-callout'
          ? [{
              name: child.name,
              width: Math.round(child.displayWidth),
              height: Math.round(child.displayHeight),
              alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
            }]
          : [];
        return [...self, ...nested];
      });
    for (let i = 0; i < 40; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (state.combatFloatingCallout?.loaded) break;
      await wait(50);
    }
    const target = battle.enemies.find((enemy: any) => enemy.hp > 1) ?? battle.enemies[0];
    battle.damageEnemy(target.id, 1, 'Smoke');
    await wait(80);
    const state = JSON.parse(window.render_game_to_text!());
    const trees = [battle.root, battle.fxLayer].filter(Boolean);
    const calloutObjects = objectsFor(trees);
    return {
      combatFloatingCallout: state.combatFloatingCallout,
      count: countTexture(trees),
      calloutObjects,
      results: battle.fxLayer.list.filter((o: any) => o.name === 'combat-number-feedback').map((o: any) => ({
        kind: o.getData('kind'), target: o.getData('target'), width: o.getBounds().width,
      })),
    };
  });

  expect(result.combatFloatingCallout).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.count).toBe(0);
  expect(result.calloutObjects).toEqual([]);
  expect(result.results.length).toBeGreaterThan(0);
  expect(result.results.some((r: any) => r.kind === 'damage')).toBe(true);
  expect(result.results.every((r: any) => r.width <= 168)).toBe(true);
});

test('combat event log keeps the latest message without decorative frames', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const battle: any = g.scene.getScene('BattleScene');
    const countTexture = (items: any[], key = 'ui-icon-combat-log-frame'): number => items.reduce((sum, child) => {
      const self = child.texture?.key === key ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTexture(child.list, key) : 0;
      return sum + self + nested;
    }, 0);
    for (let i = 0; i < 40; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (state.combatLogFrame?.loaded && state.combatLogEventBead?.loaded) break;
      await wait(50);
    }
    battle.logEvent('Smoke test event log polish entry.');
    battle.renderAll();
    await wait(40);
    const state = JSON.parse(window.render_game_to_text!());
    const frameObjects = (battle.root?.list ?? battle.children.list)
      .filter((child: any) => child.texture?.key === 'ui-icon-combat-log-frame')
      .map((child: any) => ({
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
        name: child.name,
      }));
    const beadObjects = (battle.root?.list ?? battle.children.list)
      .filter((child: any) => child.texture?.key === 'ui-icon-combat-log-event-bead')
      .map((child: any) => ({
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
        name: child.name,
      }));
    return {
      combatLogFrame: state.combatLogFrame,
      combatLogEventBead: state.combatLogEventBead,
      frameObjects,
      frameCount: countTexture(battle.root?.list ?? battle.children.list),
      beadObjects,
      beadCount: countTexture(battle.root?.list ?? battle.children.list, 'ui-icon-combat-log-event-bead'),
      latest: battle.root.getByName('combat-log-latest')?.text,
      log: state.log,
    };
  });

  expect(result.combatLogFrame).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.combatLogEventBead).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.frameCount).toBe(0);
  expect(result.beadCount).toBe(0);
  expect(result.frameObjects).toEqual([]);
  expect(result.beadObjects).toEqual([]);
  expect(result.latest).toBe('Combat history');
  expect(result.log).toContain('Smoke test event log polish entry.');
});

test('combat hover tooltip keeps a content-sized quiet frame', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const battle: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 40; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (state.combatTooltipFrame?.loaded) break;
      await wait(50);
    }
    const tooltip = battle.buildTooltip('End Turn', 'Roost and let enemies act.', 1192, 470);
    await wait(40);
    const state = JSON.parse(window.render_game_to_text!());
    const countTexture = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-combat-tooltip-frame' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTexture(child.list) : 0;
      return sum + self + nested;
    }, 0);
    const frameObjects = (tooltip?.list ?? [])
      .filter((child: any) => child.name === 'combat-tooltip-frame' && child.type === 'Rectangle')
      .map((child: any) => ({
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
        name: child.name,
      }));
    return {
      combatTooltipFrame: state.combatTooltipFrame,
      frameCount: countTexture(battle.root?.list ?? battle.children.list),
      frameObjects,
    };
  });

  expect(result.combatTooltipFrame).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.frameCount).toBe(0);
  expect(result.frameObjects).toEqual([
    expect.objectContaining({ name: 'combat-tooltip-frame', width: 360, alpha: 1 })
  ]);
});

test('combat hand stays readable without a decorative support rail', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const battle: any = g.scene.getScene('BattleScene');
    const countTexture = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-combat-hand-rail' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTexture(child.list) : 0;
      return sum + self + nested;
    }, 0);
    for (let i = 0; i < 40; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (state.combatHandRail?.loaded) break;
      await wait(50);
    }
    const state = JSON.parse(window.render_game_to_text!());
    return {
      combatHandRail: state.combatHandRail,
      handSize: state.hand.length,
      railObjects: countTexture(battle.handLayer?.list ?? battle.children.list),
    };
  });

  expect(result.handSize).toBeGreaterThan(0);
  expect(result.combatHandRail).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.railObjects).toBe(0);
});

test('combat hand selection stays distinct without decorative playable frames', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const battle: any = g.scene.getScene('BattleScene');
    const countTexture = (items: any[], key = 'ui-icon-combat-hand-card-frame'): number => items.reduce((sum, child) => {
      const self = child.texture?.key === key ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTexture(child.list, key) : 0;
      return sum + self + nested;
    }, 0);
    for (let i = 0; i < 40; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (state.combatHandCardFrame?.loaded) break;
      await wait(50);
    }
    const candidate = battle.hand.find((card: any) =>
      battle.activeCardContract(card).target === 'enemy' && battle.effectiveCost(card) <= battle.energy
    ) ?? battle.hand[0];
    const beforeFrame = battle.handCardFrames.get(candidate.instanceId);
    const before = beforeFrame ? { width: beforeFrame.displayWidth, height: beforeFrame.displayHeight, alpha: beforeFrame.alpha } : undefined;
    const beforePulse = battle.handCardSelectionPulses.get(candidate.instanceId);
    const beforePulseState = beforePulse ? { width: beforePulse.displayWidth, height: beforePulse.displayHeight, alpha: beforePulse.alpha } : undefined;
    battle.onCardClicked(candidate.instanceId);
    await wait(40);
    const afterFrame = battle.handCardFrames.get(candidate.instanceId);
    const after = afterFrame ? { width: afterFrame.displayWidth, height: afterFrame.displayHeight, alpha: afterFrame.alpha } : undefined;
    const afterPulse = battle.handCardSelectionPulses.get(candidate.instanceId);
    const afterPulseState = afterPulse ? { width: afterPulse.displayWidth, height: afterPulse.displayHeight, alpha: afterPulse.alpha } : undefined;
    const state = JSON.parse(window.render_game_to_text!());
    const pulseObjects = (battle.handLayer?.list ?? battle.children.list)
      .filter((child: any) => child.texture?.key === 'ui-icon-combat-hand-selected-pulse')
      .map((child: any) => ({
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
        name: child.name,
      }));
    return {
      combatHandCardFrame: state.combatHandCardFrame,
      combatHandSelectedPulse: state.combatHandSelectedPulse,
      handSize: state.hand.length,
      selectedCard: state.selectedCard,
      candidateId: candidate.instanceId,
      frameObjects: countTexture(battle.handLayer?.list ?? battle.children.list),
      pulseObjects: countTexture(battle.handLayer?.list ?? battle.children.list, 'ui-icon-combat-hand-selected-pulse'),
      visiblePulses: pulseObjects.filter((pulse: { alpha: number }) => pulse.alpha > 0),
      before,
      after,
      beforePulse: beforePulseState,
      afterPulse: afterPulseState,
      outline: battle.handCardRects.get(candidate.instanceId)?.lineWidth,
      outlineColor: battle.handCardRects.get(candidate.instanceId)?.strokeColor,
    };
  });

  expect(result.handSize).toBeGreaterThan(0);
  expect(result.combatHandCardFrame).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.combatHandSelectedPulse).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.frameObjects).toBe(0);
  expect(result.pulseObjects).toBe(0);
  expect(result.selectedCard).toBe(result.candidateId);
  expect(result.before).toBeUndefined();
  expect(result.after).toBeUndefined();
  expect(result.beforePulse).toBeUndefined();
  expect(result.afterPulse).toBeUndefined();
  expect(result.visiblePulses).toEqual([]);
  expect(result.outline).toBe(3);
  expect(result.outlineColor).toBe(0x24d0d6);
});

test('combat enemies retain HP labels without decorative vitals frames', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const battle: any = g.scene.getScene('BattleScene');
    const countTexture = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-combat-enemy-vitals-frame' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTexture(child.list) : 0;
      return sum + self + nested;
    }, 0);
    for (let i = 0; i < 40; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (state.combatEnemyVitalsFrame?.loaded) break;
      await wait(50);
    }
    const state = JSON.parse(window.render_game_to_text!());
    return {
      combatEnemyVitalsFrame: state.combatEnemyVitalsFrame,
      hpLabels: battle.enemies.filter((enemy: any) => enemy.hp > 0).every((enemy: any) =>
        battle.root.list.some((child: any) => child.name === 'combat-enemy-hp-value' && child.getData('enemyId') === enemy.id && child.text === `${enemy.hp}/${enemy.maxHp}`)
        && battle.root.list.some((child: any) => child.name === 'combat-enemy-name' && child.getData('enemyId') === enemy.id && child.getData('fullName') === enemy.name)),
      livingEnemies: state.enemies.filter((enemy: { hp: number }) => enemy.hp > 0).length,
      frameObjects: countTexture(battle.root?.list ?? battle.children.list),
    };
  });

  expect(result.livingEnemies).toBeGreaterThan(0);
  expect(result.combatEnemyVitalsFrame).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.frameObjects).toBe(0);
  expect(result.hpLabels).toBe(true);
});

test('combat enemy status text uses a readable vitals row without decorative frames', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const battle: any = g.scene.getScene('BattleScene');
    const enemy = battle.enemies.find((candidate: any) => candidate.hp > 0);
    enemy.block = 7;
    enemy.weak = 2;
    battle.renderAll();
    const countTexture = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-combat-enemy-status-chip-frame' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTexture(child.list) : 0;
      return sum + self + nested;
    }, 0);
    for (let i = 0; i < 40; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (battle.root.getByName('combat-enemy-status')) break;
      await wait(50);
    }
    const state = JSON.parse(window.render_game_to_text!());
    const stateEnemy = state.enemies.find((candidate: { id: string }) => candidate.id === enemy.id);
    return {
      combatEnemyStatusChipFrame: state.combatEnemyStatusChipFrame,
      enemyBlock: stateEnemy?.block,
      enemyWeak: stateEnemy?.weak,
      statusText: battle.root.getByName('combat-enemy-status')?.getData('fullText'),
      frameObjects: countTexture(battle.root?.list ?? battle.children.list),
    };
  });

  expect(result.enemyBlock).toBe(7);
  expect(result.enemyWeak).toBe(2);
  expect(result.combatEnemyStatusChipFrame.rendered).toBe(false);
  expect(result.frameObjects).toBe(0);
  expect(result.statusText).toBe('7 Cover / 2 Winded');
});

test('combat intro renders generated encounter plaque behind caption', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    g.scene.stop('MenuScene');
    g.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
    const battle: any = g.scene.getScene('BattleScene');
    const countTexture = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-combat-encounter-plaque' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTexture(child.list) : 0;
      return sum + self + nested;
    }, 0);
    for (let i = 0; i < 120; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (state.combatEncounterPlaque?.loaded && state.combatEncounterPlaque?.rendered) break;
      await wait(50);
    }
    const state = JSON.parse(window.render_game_to_text!());
    // The lazy BattleScene stand-in may have been swapped for the real scene since start.
    const live: any = g.scene.getScene('BattleScene');
    const plaqueObjects = countTexture([
      ...(live.root?.list ?? []),
      ...(live.fxLayer?.list ?? []),
    ]);
    return {
      combatEncounterPlaque: state.combatEncounterPlaque,
      combatEncounterIntro: state.combatEncounterIntro,
      plaqueObjects,
    };
  });

  expect(result.combatEncounterIntro.loaded).toBe(true);
  expect(result.combatEncounterPlaque).toEqual({ loaded: true, rendered: true, count: result.plaqueObjects });
  expect(result.plaqueObjects).toBeGreaterThanOrEqual(1);
});

test('combat supply feedback uses the shared quiet lane and retains its use cue', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const battle: any = g.scene.getScene('BattleScene');
    const countTexture = (items: any[], textureKey: string): number => items.reduce((sum, child) => {
      const self = child.texture?.key === textureKey ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTexture(child.list, textureKey) : 0;
      return sum + self + nested;
    }, 0);
    for (let i = 0; i < 60 && !(battle.enemies?.length && battle.hand?.length); i += 1) await wait(50);
    battle.runSupplies = ['seed_packet'];
    battle.runSuppliesUsed = [];
    battle.combatSupplyUseBurstBursts = 0;
    const supplyUseCueBefore = window.__birdSquadState!().audio?.cueRequests?.supplyUse ?? 0;
    battle.useSupply(0);
    for (let i = 0; i < 20; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (
        state.combatSupplyFeedbackFrame?.loaded
        && battle.fxLayer.getByName('combat-trigger-feedback')
        && state.combatSupplyUseBurst?.loaded
        && state.combatSupplyUseBurst?.rendered
      ) break;
      await wait(25);
    }
    const state = JSON.parse(window.render_game_to_text!());
    const visibleObjects = [
      ...(battle.root?.list ?? []),
      ...(battle.fxLayer?.list ?? []),
    ];
    const frameObjects = countTexture(visibleObjects, 'ui-icon-combat-supply-feedback-frame');
    const burstObjects = countTexture(visibleObjects, 'combat-supply-use-burst');
    return {
      combatSupplyFeedbackFrame: state.combatSupplyFeedbackFrame,
      combatSupplyUseBurst: state.combatSupplyUseBurst,
      feedback: state.supplyFeedback?.[0],
      frameObjects,
      notices: battle.fxLayer.list.filter((o: any) => o.name === 'combat-trigger-feedback').length,
      burstObjects,
      supplyUseCueBefore,
      supplyUseCueAfter: state.audio?.cueRequests?.supplyUse ?? 0,
    };
  });

  expect(result.feedback?.id).toBe('seed_packet');
  expect(result.combatSupplyFeedbackFrame).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.frameObjects).toBe(0);
  expect(result.notices).toBe(1);
  expect(result.combatSupplyUseBurst.loaded).toBe(true);
  expect(result.combatSupplyUseBurst.rendered).toBe(true);
  expect(result.combatSupplyUseBurst.count).toBe(result.burstObjects);
  expect(result.combatSupplyUseBurst.count).toBeGreaterThanOrEqual(1);
  expect(result.combatSupplyUseBurst.bursts).toBeGreaterThanOrEqual(1);
  expect(result.supplyUseCueAfter).toBeGreaterThan(result.supplyUseCueBefore);
});

test('combat waymark feedback uses the shared quiet lane', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const battle: any = g.scene.getScene('BattleScene');
    const countTexture = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-combat-waymark-feedback-frame' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTexture(child.list) : 0;
      return sum + self + nested;
    }, 0);
    for (let i = 0; i < 60 && !(battle.enemies?.length && battle.hand?.length); i += 1) await wait(50);
    battle.routeMarks = ['broken_cover_chime'];
    battle.markFiredThisTurn = new Set();
    battle.spark = 0;
    battle.checkEnemyCoverBrokenMarks();
    for (let i = 0; i < 20; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (state.combatWaymarkFeedbackFrame?.loaded && battle.fxLayer.getByName('combat-trigger-feedback')) break;
      await wait(25);
    }
    const state = JSON.parse(window.render_game_to_text!());
    const frameObjects = countTexture([
      ...(battle.root?.list ?? []),
      ...(battle.fxLayer?.list ?? []),
    ]);
    return {
      combatWaymarkFeedbackFrame: state.combatWaymarkFeedbackFrame,
      feedback: state.waymarkFeedback?.[0],
      frameObjects,
      notices: battle.fxLayer.list.filter((o: any) => o.name === 'combat-trigger-feedback').length,
    };
  });

  expect(result.feedback?.id).toBe('broken_cover_chime');
  expect(result.combatWaymarkFeedbackFrame).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.frameObjects).toBe(0);
  expect(result.notices).toBe(1);
});

test('keyword hover tooltip uses a readable surface without a generated frame', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const countTexture = (items: any[], key: string): number => items.reduce((sum, child) => {
      const self = child.texture?.key === key ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTexture(child.list, key) : 0;
      return sum + self + nested;
    }, 0);
    const collectObjects = (items: any[]): any[] => {
      const out: any[] = [];
      const visit = (node: any) => {
        if (!node) return;
        out.push(node);
        if (Array.isArray(node.list)) node.list.forEach(visit);
      };
      items.forEach(visit);
      return out;
    };
    const g = window.__birdSquadGame;
    const account = JSON.parse(window.localStorage.getItem('birdsquad.account') || '{}');
    account.discoveredCards = Array.from(new Set([...(account.discoveredCards ?? []), 'pentacles_04']));
    window.localStorage.setItem('birdsquad.account', JSON.stringify(account));
    await window.__birdSquadStartScene!('CodexScene');
    g.scene.stop('MenuScene');
    const codex: any = g.scene.getScene('CodexScene');
    codex.detailId = 'pentacles_04';
    codex.detailScroll = 0;
    codex.renderAll();
    await wait(500);
    const keyword = collectObjects(codex.root?.list ?? [])
      .filter((child: any) => child.type === 'Text' && child.input)
      .find((child: any) => /^(Cover|Cohesion|Energy|Draw|Wingbeat|Keystone)$/i.test(child.text ?? '')
        && (child.listenerCount?.('pointerover') ?? 0) > 0);
    const hookResult = window.__birdSquadShowKeywordTooltip!('CodexScene', 'Cover', 760, 304);
    const tooltip = { state: JSON.parse(window.render_game_to_text!()).keywordTooltip,
      size: codex.children.getByName('keyword-tooltip').getByName('keyword-tooltip-body').style.fontSize };
    const frameObjects = collectObjects(codex.children.list)
      .filter((child: any) => child.texture?.key === 'ui-icon-keyword-tooltip-frame')
      .map((child: any) => ({
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(3) ?? child.alpha),
        name: child.name,
        visible: child.visible,
      }));
    const texts = collectObjects(codex.children.list)
      .filter((child: any) => child.type === 'Text')
      .map((child: any) => child.text);
    return {
      hasKeyword: !!keyword,
      tooltip,
      hookResult,
      frameCount: countTexture(codex.children.list, 'ui-icon-keyword-tooltip-frame'),
      frameObjects,
      hasDefinitionText: texts.some((text: string) => /Temporary shielding|flock's health|resource/i.test(text)),
    };
  });

  expect(result.hasKeyword).toBe(true);
  expect(result.hookResult).toBe(true);
  expect(result.frameObjects).toEqual([]);
  expect(result.hookResult.frame).toBeUndefined();
  expect(result.hasDefinitionText).toBe(true);
  const tooltip = result.tooltip;
  expect(tooltip.size).toBe('20px');
  expect(tooltip.state.keyword).toBe('Cover');
  expect(tooltip.state.definition).toContain('Temporary shielding');
  expect(tooltip.state.icon).toBe('cover-shield');
});

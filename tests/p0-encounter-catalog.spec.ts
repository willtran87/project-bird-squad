import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { settleCanvas } from './helpers/settled-canvas';

const encounters = ['alpha-encounters', 'map02-content', 'map03-content', 'map04-content']
  .flatMap(name => JSON.parse(readFileSync(`data/game/${name}.json`, 'utf8')).encounters);

for (let mapIndex = 0; mapIndex < 4; mapIndex++) test(`authored encounter catalog stays readable in district ${mapIndex + 1}`, async ({ page }, info) => {
  test.setTimeout(480000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./?flight=p0-encounter-catalog');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);
  const runState = await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').runState);
  await page.evaluate(({ runState, mapIndex }) => {
    const g = (window as any).__birdSquadGame;
    g.scene.getScene('RouteScene').scene.restart({ runState: { ...runState, mapIndex } });
  }, { runState, mapIndex });
  await page.waitForFunction(index => (window as any).__birdSquadCurrentMap().id.startsWith(`map_0${index + 1}_`), mapIndex);
  const catalog = encounters.filter((e: any) => e.mapId.startsWith(`map_0${mapIndex + 1}_`));
  expect(catalog.length).toBeGreaterThan(0);
  for (const encounter of catalog) {
    await page.evaluate(({ runState, mapIndex, encounter }) => {
      const w = window as any, game = w.__birdSquadGame, map = w.__birdSquadCurrentMap();
      const node = map.nodes.find((n: any) => n.id === `m${mapIndex + 1}_entry`);
      node.payloadId = encounter.id; node.type = encounter.nodeType; node.label = encounter.name;
      for (const scene of game.scene.getScenes(true)) game.scene.stop(scene.scene.key);
      game.scene.start('BattleScene', { runState: { ...runState, mapIndex }, routeNodeId: node.id });
    }, { runState, mapIndex, encounter });
    await page.waitForFunction(() => {
      const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
      return b.fxLayer?.active && !b.combatAnimationPending && !b.combatIntroActive && !b.battleRenderQueued
        && JSON.parse(w.render_game_to_text()).assetReadiness?.fullArt;
    }, undefined, { timeout: 20000 });
    for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
      await page.setViewportSize({ width, height }); await settleCanvas(page);
      const result = await page.evaluate(() => {
        const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
        // Catalog fixtures exercise authored sprites/moves with crowded statuses;
        // live-control run and mechanical parity evidence live in separate tests.
        b.enemies.forEach((e: any) => { e.block = 7; e.weak = 2; });
        b.selectedInstanceId = b.hand[0]?.instanceId; b.renderAll();
        const panels = b.root.list.filter((o: any) => o.type !== 'Text' && [
          'combat-enemy-vitals', 'combat-enemy-intent-badge', 'combat-enemy-status-panel',
          'combat-boss-phase-badge', 'combat-objective-target', 'combat-elite-badge',
        ].includes(o.name));
        const clear = (a: any, z: any) => a.right <= z.left || a.left >= z.right || a.bottom <= z.top || a.top >= z.bottom;
        const contains = (a: any, z: any) => z.left >= a.left && z.right <= a.right && z.top >= a.top && z.bottom <= a.bottom;
        const frame = b.selectionOutcomePreview?.getByName('combat-outcome-preview')?.getBounds();
        const visible = b.root.list.filter((o: any) => o.name === 'combat-enemy-art');
        const goal = b.root.list.find((o: any) => o.name === 'encounter-objective' && o.type === 'Rectangle');
        const art = visible.map((group: any) => {
          const portrait = group.list[0].getByName('combat-enemy-portrait');
          const r = portrait.getBounds(), v = b.enemyTextureVisibleBounds(portrait.texture.key);
          return { left: r.left + r.width * v.left, right: r.left + r.width * v.right,
            top: r.top + r.height * v.top, bottom: r.top + r.height * v.bottom };
        });
        return {
          enemies: b.enemies.map((e: any) => e.runtime.id),
          art: visible.map((g: any) => g.list[0].getByName('combat-enemy-portrait').texture.key),
          fits: panels.every((p: any) => { const r = p.getBounds(); return r.left >= 0 && r.right <= 1280 && r.top >= 100 && r.bottom < 435; }),
          separated: panels.every((p: any, i: number) => panels.slice(i + 1).every((z: any) => {
            // Intent belongs inside its own unified vitals, never another enemy's.
            if (p.getData('enemyId') === z.getData('enemyId') && p.name === 'combat-enemy-vitals' && z.name === 'combat-enemy-intent-badge') {
              return contains(p.getBounds(), z.getBounds());
            }
            return clear(p.getBounds(), z.getBounds());
          })),
          artClear: art.every((r: any) => r.left >= 0 && r.right <= 1280 && r.top >= 106 && panels.every((p: any) => clear(p.getBounds(), r))),
          goalClear: !goal || art.every((r: any) => clear(goal.getBounds(), r))
            && panels.every((p: any) => clear(goal.getBounds(), p.getBounds())),
          previewClear: !frame || panels.every((p: any) => clear(p.getBounds(), frame)),
          targetsInteractive: visible.every((g: any) => g.list[0].getByName('combat-enemy-portrait').input?.enabled),
          eliteLabels: b.enemies.filter((e: any) => e.runtime.type === 'elite').every((e: any) => {
            const label = b.root.list.find((o: any) => o.name === 'combat-elite-label' && o.getData('enemyId') === e.id);
            const panel = panels.find((o: any) => o.name === 'combat-elite-badge' && o.getData('enemyId') === e.id);
            return label && panel && contains(panel.getBounds(), label.getBounds())
              && parseFloat(label.style.fontSize) * b.game.canvas.getBoundingClientRect().width / 1280 >= 14;
          }),
        };
      });
      expect(result.enemies, encounter.id).toEqual(encounter.enemies);
      expect(result.art, encounter.id).toHaveLength(encounter.enemies.length);
      expect(result.art.every((k: string) => k.startsWith('enemy-')), encounter.id).toBe(true);
      expect(result.targetsInteractive, encounter.id).toBe(true);
      expect(result.eliteLabels, encounter.id).toBe(true);
      expect(result.fits, encounter.id).toBe(true); expect(result.separated, encounter.id).toBe(true);
      expect(result.artClear, encounter.id).toBe(true); expect(result.previewClear, encounter.id).toBe(true);
      expect(result.goalClear, encounter.id).toBe(true);
      await settleCanvas(page);
      await page.screenshot({ path: info.outputPath(`${encounter.id}-${width}.png`) });
    }
  }
  expect(errors).toEqual([]);
});

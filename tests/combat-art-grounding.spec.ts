import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { COMBAT_ART_CONTACTS } from '../src/game/battle/art-grounding';
import { settleCanvas } from './helpers/settled-canvas';

const ids: string[] = JSON.parse(readFileSync('assets/runtime/enemies/enemy-art-manifest.json', 'utf8')).enemies
  .filter((e: any) => e.status === 'approved').map((e: any) => e.enemyId);
const leaders = ['fledgling', 'roostkeeper', 'spark_caller', 'talon', 'tidewarden'];

test('entire combat cast retains proportional art and stage-owned contact shadows', async ({ page }, info) => {
  test.setTimeout(240000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('BattleScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.hand.length && b.battleForegroundRendererModule && !b.combatIntroActive && !b.combatAnimationPending;
  });
  await page.evaluate(({ ids, leaders, contacts }) => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    w.contactReview = Object.fromEntries(Object.entries(contacts).map(([key, [x, y, width]]) =>
      [key.startsWith('flock-') ? key : `enemy-${key}`, { x, y, width }]));
    b.battleHudGuidanceView = () => undefined;
    b.battleHudObjectiveView = () => ({ accent: 0xe2b24a,
      text: 'Weather The Heights / Damage blocked 12/12 / +18', detail: 'Block twelve damage.' });
    b.groundingFixture = structuredClone(b.enemies[0]);
    const previous = b.enemies, leaderId = b.runLeaderId;
    b.enemies = ids.map(id => ({ ...b.groundingFixture, id, runtime: { ...b.groundingFixture.runtime, id } }));
    const assets = b.battleArtAssets();
    for (const id of leaders) { b.runLeaderId = id; assets.push(b.currentFlockLeaderArtAsset()); }
    b.enemies = previous; b.runLeaderId = leaderId;
    b.queueImageAssets(assets, 'Full cast grounding review');
  }, { ids, leaders, contacts: COMBAT_ART_CONTACTS });
  await page.waitForFunction(ids => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return ids.every(id => b.textures.exists(`enemy-${id}`)) && !b.load.isLoading();
  }, ids);
  for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
    await page.setViewportSize({ width, height }); await settleCanvas(page);
    // Actual renderer, four slots at a time: every shipped enemy, not substitutes.
    for (let start = 0; start < ids.length; start += 4) {
      const result = await page.evaluate(({ ids, start, leaders }) => {
        const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
        b.runLeaderId = leaders[(start / 4) % leaders.length];
        b.encounterObjective = undefined;
        b.enemies = ids.map(id => ({ ...b.groundingFixture, id, name: id.replaceAll('_', ' '),
          runtime: { ...b.groundingFixture.runtime, id, type: 'normal' } }));
        b.selectedEnemyId = ids[0]; b.renderAll();
        const clear = (a: any, z: any) => a.right <= z.left || a.left >= z.right || a.bottom <= z.top || a.top >= z.bottom;
        const panels = b.root.list.filter((o: any) => o.name === 'combat-enemy-vitals'
          || (o.name === 'encounter-objective' && o.type === 'Rectangle'));
        const groups = b.root.list.filter((o: any) => ['combat-enemy-art', 'combat-leader-art'].includes(o.name));
        return groups.map((group: any) => {
          const enemy = group.name === 'combat-enemy-art';
          const art = group.list[0].getByName(enemy ? 'combat-enemy-portrait' : 'combat-leader-portrait');
          const key = art.texture.key, c = w.contactReview[key], v = b.enemyTextureVisibleBounds(key);
          const shadow = b.root.list.find((o: any) => o.name === (enemy ? 'combat-enemy-contact-shadow' : 'combat-leader-contact-shadow')
            && (!enemy || o.getData('enemyId') === group.getData('enemyId')));
          const r = art.getBounds(), foot = { x: r.left + r.width * (c?.x ?? (v.left + v.right) / 2),
            y: r.top + r.height * (c?.y ?? v.bottom) };
          const silhouette = { left: r.left + r.width * v.left, right: r.left + r.width * v.right,
            top: r.top + r.height * v.top, bottom: r.top + r.height * v.bottom };
          const before = shadow.getBounds();
          // A committed/breathing pose must never lift or squash the floor shadow.
          group.setPosition(group.x + 12, group.y - 8).setScale(0.98, 1.03);
          const after = shadow.getBounds(); group.setPosition(group.x - 12, group.y + 8).setScale(1);
          return { key, contactX: Math.abs(shadow.x - foot.x), contactY: Math.abs(shadow.y - foot.y),
            proportional: art.scaleX === art.scaleY, stageOwned: shadow.parentContainer === b.root,
            stationary: JSON.stringify(before) === JSON.stringify(after),
            clear: panels.every((p: any) => clear(p.getBounds(), silhouette) && clear(p.getBounds(), before)),
            overlaps: panels.filter((p: any) => !clear(p.getBounds(), silhouette) || !clear(p.getBounds(), before))
              .map((p: any) => ({ name: p.name, bounds: p.getBounds() })),
            visible: silhouette.top >= 106 && silhouette.bottom < 440,
            silhouette,
            size: { width: silhouette.right - silhouette.left, height: silhouette.bottom - silhouette.top } };
        });
      }, { ids: ids.slice(start, start + 4), start, leaders });
      expect(result).toHaveLength(Math.min(4, ids.length - start) + 1);
      for (const r of result) {
        expect(r.proportional && r.stageOwned && r.stationary, r.key).toBe(true);
        expect(r.contactX, r.key).toBeLessThanOrEqual(1);
        expect(r.contactY, r.key).toBeLessThanOrEqual(3);
        expect(r.clear && r.visible, `${r.key}: ${JSON.stringify(r)}`).toBe(true);
        expect(r.size.height, r.key).toBeGreaterThan(40);
      }
      await settleCanvas(page);
      await page.screenshot({ path: info.outputPath(`cast-${start}-${width}.png`) });
    }
  }
  expect(errors).toEqual([]);
});

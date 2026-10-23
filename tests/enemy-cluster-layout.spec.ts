import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';
import {targetGeometry,checkTargetGeometry} from './helpers/target-geometry';

test('one to four enemy clusters keep statuses, vitals and forecasts separate', async ({ page }, info) => {
  // Thirty-six full-resolution scene captures share this whole-test budget.
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
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
    return b.hand.length && b.root?.getByName('combat-enemy-vitals') && !b.combatIntroActive && !b.combatAnimationPending && !b.battleRenderQueued;
  });
  for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
    await page.setViewportSize({ width, height }); await settleCanvas(page);
    for (const rank of ['normal', 'elite', 'boss']) for (const count of [1, 2, 3, 4]) {
      const boss = rank === 'boss', elite = rank === 'elite';
      const result = await page.evaluate(({ boss, elite, count }) => {
        const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
        b.clusterFixtureEnemy ??= structuredClone(b.enemies[0]);
        b.enemies = Array.from({ length: count }, (_, i) => ({ ...b.clusterFixtureEnemy, id: `cluster-${i}`,
          name: i === 0 ? 'The Featherwright Emergency Relay Station' : `Lookout ${i}`, hp: 99, maxHp: 100,
          block: 7, weak: 2, phase: 2, runtime: { ...b.clusterFixtureEnemy.runtime,
            phaseTwoName: 'Emergency Rooftop Reinforcement Pattern', type: i === 0 ? boss ? 'boss' : elite ? 'elite' : 'normal' : 'normal' } }));
        b.encounterObjective = boss ? undefined : ({ type: 'priority', targetEnemyId: b.enemies[0].id,
          title: 'Stop the lookout', description: 'Defeat the marked target', bonusScrap: 8, deadlineTurn: 3 });
        b.selectedEnemyId = b.enemies[0].id; b.selectedInstanceId = b.hand[0].instanceId; b.renderAll();
        const forecast = b.selectionOutcomePreview.getByName('combat-outcome-preview').getBounds();
        const names = ['combat-enemy-vitals', 'combat-enemy-intent-badge', 'combat-enemy-status-panel', 'combat-boss-phase-badge', 'combat-objective-target', 'combat-elite-badge'];
        const panels = b.root.list.filter((o: any) => o.type !== 'Text' && names.includes(o.name));
        const artIndices = b.root.list.flatMap((o: any, i: number) => o.name === 'combat-enemy-art' ? [i] : []);
        const clear = (a: any, z: any) => a.right <= z.left || a.left >= z.right || a.bottom <= z.top || a.top >= z.bottom;
        const contains = (a: any, z: any) => z.left >= a.left && z.right <= a.right && z.top >= a.top && z.bottom <= a.bottom;
        return {
          artCount: artIndices.length,
          duplicateObjective: Boolean(b.root.getByName('encounter-objective')),
          labelsAboveArt: panels.every((o: any) => b.root.list.indexOf(o) > Math.max(...artIndices)),
          insideStage: panels.every((o: any) => { const r = o.getBounds(); return r.left >= 0 && r.right <= 1280; }),
          separated: panels.every((o: any, i: number) => panels.slice(i + 1).every((other: any) => {
            // The intent is intentionally nested inside its own unified vitals.
            const sameEnemy = o.getData('enemyId') === other.getData('enemyId');
            if (sameEnemy && o.name === 'combat-enemy-vitals' && other.name === 'combat-enemy-intent-badge') return contains(o.getBounds(), other.getBounds());
            return clear(o.getBounds(), other.getBounds());
          })),
          forecastClear: panels.every((o: any) => clear(o.getBounds(), forecast)),
          artClear: b.enemies.every((e: any) => {
            const group = b.root.list.find((o: any) => o.name === 'combat-enemy-art' && o.getData('enemyId') === e.id);
            const portrait = group.list[0].getByName('combat-enemy-portrait');
            const r = portrait.getBounds(), v = b.enemyTextureVisibleBounds(portrait.texture.key);
            const visible = { left: r.left + r.width * v.left, right: r.left + r.width * v.right,
              top: r.top + r.height * v.top, bottom: r.top + r.height * v.bottom };
            const shadow = b.root.list.find((o: any) => o.name === 'combat-enemy-contact-shadow' && o.getData('enemyId') === group.getData('enemyId'));
            const contact = b.enemyView(b.enemies.find((e: any) => e.id === group.getData('enemyId'))).y
              + portrait.y + portrait.displayHeight * (416 / 512 - 0.5);
            return visible.top >= 106 && panels.every((p: any) => clear(p.getBounds(), visible)) && Math.abs(shadow.y - contact) <= 3;
          }),
          artDiagnostics: b.enemies.map((e: any) => {
            const portrait = b.root.list.find((o: any) => o.name === 'combat-enemy-art' && o.getData('enemyId') === e.id).list[0].getByName('combat-enemy-portrait');
            const r = portrait.getBounds(), v = b.enemyTextureVisibleBounds(portrait.texture.key);
            const visible = { left: r.left + r.width * v.left, right: r.left + r.width * v.right,
              top: r.top + r.height * v.top, bottom: r.top + r.height * v.bottom };
            return { id: e.id, visible, conflicts: panels.filter((p: any) => !clear(p.getBounds(), visible)).map((p: any) => ({ name: p.name, enemyId: p.getData('enemyId'), bounds: p.getBounds() })) };
          }),
          readable: b.root.list.filter((o: any) => o.type === 'Text' && ['combat-enemy-intent-value', 'combat-boss-phase-badge', 'combat-objective-target', 'combat-elite-label'].includes(o.name))
            .map((o: any) => ({ fits: panels.some((p: any) => contains(p.getBounds(), o.getBounds())), size: Number.parseFloat(o.style.fontSize), text: o.text })),
          statuses: b.enemies.map((e: any) => {
            const label = b.root.list.find((o: any) => o.name === 'combat-enemy-status' && o.getData('enemyId') === e.id);
            const panel = panels.find((o: any) => o.name === 'combat-enemy-status-panel' && o.getData('enemyId') === e.id);
            return { fits: contains(panel.getBounds(), label.getBounds()), source: label.getData('fullText'), size: label.style.fontSize,
              complete: !label.getData('truncated') };
          }),
        };
      }, { boss, elite, count });
      expect(result.separated, `${width}: boss=${boss}, count=${count}`).toBe(true);
      expect(result.artCount).toBe(count);
      expect(result.duplicateObjective).toBe(false);
      expect(result.labelsAboveArt, `${width}: boss=${boss}, count=${count}`).toBe(true);
      expect(result.insideStage, `${width}: boss=${boss}, count=${count}`).toBe(true);
      expect(result.forecastClear, `${width}: boss=${boss}, count=${count}`).toBe(true);
      expect(result.artClear, `${width}: boss=${boss}, count=${count}: ${JSON.stringify(result.artDiagnostics)}`).toBe(true);
      expect(result.readable.every(label => label.fits && label.size >= 16), JSON.stringify(result.readable)).toBe(true);
      expect(result.statuses).toEqual(Array(count).fill({ fits: true, source: '7 Cover / 2 Winded', size: '19px', complete: true }));
      await settleCanvas(page);
      checkTargetGeometry(await targetGeometry(page,'BattleScene'),`enemy cluster ${rank}/${count}/${width}`);
      await page.screenshot({ path: info.outputPath(`clusters-${width}-${rank}-${count}.png`) });
    }
  }
  expect(errors).toEqual([]);
});

import { test, expect } from '@playwright/test';

for (const encounter of ['m1_entry', 'm1_boss', 'm2_boss', 'm3_boss', 'm4_boss']) test(`trigger lane stays below the HUD and above decisions in ${encounter}`, async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('birdsquad.motionPreference', 'reduced'));
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async encounter => {
    const w = window as any;
    await w.__birdSquadEnsureScene('BattleScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    const mapIndex = Number(encounter[1]) - 1;
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: encounter, runState: {
      deck: [{ id: 'major_00' }], leaderId: 'fledgling', difficulty: 0, seed: 'boss-backdrop-variant-test',
      currentHp: 36, scrap: 40, routeMarks: [], supplies: [], mapIndex, completedRouteNodeIds: [],
      routeLog: [], signalChoices: [], rewardEvents: [],
    } });
  }, encounter);
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.battleFxPresenterModule && b.root?.getByName('combat-enemy-vitals') && b.hand.length
      && !b.combatAnimationPending && !b.combatIntroActive && !b.battleRenderQueued;
  });
  for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(viewport);
    await page.waitForFunction(() => { const r = document.querySelector('canvas')!.getBoundingClientRect(); return r.width <= innerWidth + 1 && r.height <= innerHeight + 1; });
    const geometry = await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      b.showSupplyFeedback({ id: 'seed_packet', name: 'Emergency Rooftop Aid Kit with Extra Long Equipment Name', timing: 'manual', effects: ['heal(2)', 'gainCover(4)', 'draw(1)', 'gainWingbeat(1)'] });
      const card = b.fxLayer.getByName('combat-trigger-feedback'), r = card.getBounds();
      const labels = card.list.filter((o: any) => o.type === 'Text');
      const critical = b.root.list.filter((o: any) => /combat-flow-rail|combat-enemy-vitals|combat-enemy-intent-badge|combat-first-target-guide/.test(o.name));
      const intersects = (a: any, z: any) => a.left < z.right && a.right > z.left && a.top < z.bottom && a.bottom > z.top;
      const artOverlap: string[] = [];
      for (const { group, enemy } of b.enemyPoseGroups.values()) {
        for (const art of group.list.filter((o: any) => o.type === 'Image')) {
          const bounds = art.getBounds(), visible = b.enemyTextureVisibleBounds(art.texture.key);
          if (intersects(r, { left: bounds.left + bounds.width * visible.left, right: bounds.left + bounds.width * visible.right,
            top: bounds.top + bounds.height * visible.top, bottom: bounds.top + bounds.height * visible.bottom })) artOverlap.push(enemy.name);
        }
      }
      return { top: r.top, bottom: r.bottom, overlap: critical.some((o: any) => intersects(r, o.getBounds())),
        artOverlap,
        fit: labels.every((o: any) => { const t = o.getBounds(); return t.left >= r.left && t.right <= r.right && t.top >= r.top && t.bottom <= r.bottom; }),
        excerpt: card.getByName('combat-trigger-title').text, frame: b.game.loop.frame };
    });
    await page.waitForFunction(f => (window as any).__birdSquadGame.loop.frame >= f + 2, geometry.frame);
    await page.screenshot({ path: info.outputPath(`trigger-${viewport.width}.png`) });
    expect(geometry.top).toBeGreaterThanOrEqual(100); expect(geometry.bottom).toBeLessThan(180);
    expect(geometry.overlap).toBe(false); expect(geometry.fit).toBe(true); expect(geometry.excerpt).toContain('…');
    expect(geometry.artOverlap).toEqual([]);
    await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').fxLayer.getByName('combat-trigger-feedback')?.destroy(true));
  }
  expect(errors).toEqual([]);
});

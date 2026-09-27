import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';
import { downloadFailureServer } from './helpers/download-failure-server';

test('failed lazy download offers cancellable recovery without replacing the live flight', async ({ page, baseURL }, info) => {
  test.setTimeout(90000);
  const server = await downloadFailureServer(baseURL!);
  try {
    await page.goto(`${server.url}/?flight=update-recovery&length=quick`);
    await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => {
      const g = (window as any).__birdSquadGame;
      return g.scene.isActive('RouteScene') && g.scene.getScene('RouteScene').routeEssentialAssetsReady;
    });
    const saved = await page.evaluate(() => localStorage.getItem('birdsquad.run.active'));
    await page.evaluate(() => (window as any).__birdSquadEnsureScene('CodexScene').catch(() => {}));
    await expect(page.getByRole('region', { name: 'Download recovery' })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('birdsquad.run.active'))).toBe(saved);
    const url = page.url();
    await page.getByRole('button', { name: 'Reload options', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Reload returns' })).toBeVisible();
    expect(page.url()).toBe(url);
    for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
      await page.setViewportSize({ width, height }); await settleCanvas(page);
      const geometry = await page.locator('#update-recovery').evaluate(element => {
        const r = element.getBoundingClientRect();
        return { fits: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight,
          buttons: [...element.querySelectorAll('button')].every(b => b.getBoundingClientRect().height >= 44) };
      });
      expect(geometry).toEqual({ fits: true, buttons: true });
      await page.screenshot({ path: info.outputPath(`update-recovery-${width}.png`) });
    }
    await page.getByRole('button', { name: 'Cancel reload' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#update-recovery')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('birdsquad.run.active'))).toBe(saved);
    expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.isActive('RouteScene'))).toBe(true);
    server.restore();
    // Reopen the explicit recovery flow. A confirmed whole-page reload must
    // recover the HTTP failure in every engine without changing the saved flight.
    await page.evaluate(() => dispatchEvent(new Event('vite:preloadError')));
    await page.getByRole('button', { name: 'Reload options', exact: true }).click();
    await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Reload saved checkpoint', exact: true }).click()]);
    await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
    await page.evaluate(() => (window as any).__birdSquadEnsureScene('CodexScene'));
    await expect(page.locator('#update-recovery')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('birdsquad.run.active'))).toBe(saved);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => (window as any).__birdSquadGame.scene.isActive('RouteScene'));
  } finally {
    await server.close();
  }
});

test('remaining item details use complete fixed-size pages and preserve their decision', async ({ page }, info) => {
  test.setTimeout(90000);
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return r.scene.isActive() && r.routeEssentialAssetsReady && r.cardHoverDetailModule;
  });
  for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
    await page.setViewportSize({ width, height }); await settleCanvas(page);
    const result = await page.evaluate(() => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
      const before = JSON.stringify(r.runState);
      const body = 'Restore Cohesion, then gain Cover for the next fight. '.repeat(12);
      r.showRewardSupplyDetail({ name: 'Emergency Rooftop Recovery Kit', rarity: 'rare', category: 'tool', timing: 'route',
        description: body, effects: ['heal(8)', 'gainCover(4)'] }, 320, 450);
      const panel = r.marketItemHover, frame = panel.getByName('market-item-reader-frame').getBounds();
      const pages = [], failures = [];
      for (let i = 0; i < panel.getData('reading').total; i++) {
        const state = panel.getData('reading'); pages.push(state);
        const text = panel.getByName('market-item-reader-body'), b = text.getBounds();
        if (text.style.fontSize !== '22px' || b.left < frame.left + 16 || b.right > frame.right - 16 || b.bottom > frame.bottom - 100) failures.push(state.page);
        panel.getData('turnRulesPage')(1);
      }
      return { pages, failures, body, stable: before === JSON.stringify(r.runState), fits: frame.left >= 8 && frame.right <= 1272 && frame.top >= 8 && frame.bottom <= 712,
        oldFrame: panel.list.some((o: any) => o.texture?.key === 'ui-icon-market-detail-dossier-frame') };
    });
    expect(result.failures).toEqual([]); expect(result.stable).toBe(true); expect(result.fits).toBe(true); expect(result.oldFrame).toBe(false);
    expect(result.pages.filter((p: any) => p.title === 'EFFECT').map((p: any) => p.text).join(' ').replace(/\s+/g, ' ').trim()).toBe(result.body.trim());
    const rules = result.pages.filter((p: any) => p.title === 'RULES').map((p: any) => p.text).join(' ');
    expect(rules).not.toContain('heal('); expect(rules).toContain('8');
    await page.screenshot({ path: info.outputPath(`item-reader-${width}.png`) });
  }
});

test('mixed status and resource chains share bounded result lanes and preserve event history', async ({ page }, info) => {
  test.setTimeout(90000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').scene.start('BattleScene', { routeNodeId: 'm1_entry' }));
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.battleFxPresenterModule && b.hand.length && !b.combatIntroActive && !b.combatAnimationPending;
  });
  for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
    await page.setViewportSize({ width, height }); await settleCanvas(page);
    const result = await page.evaluate(() => {
      const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
      b.fxLayer.removeAll(true); const start = b.combatHistory.length;
      b.presentFlockStatus('Molt!', '#ff9d4d', 'molt'); b.presentFlockStatus('Molt!', '#ff9d4d', 'molt');
      b.flowGainFx(2); b.bankNextTurnFx(2, '+2 next Wingbeat'); b.cleanseFx(3);
      b.gainResonance(1); b.gainResonance(1);
      b.cardEffectContext().applyFlockWinded('Card fixture', 2);
      b.cardEffectContext().loseFlockCover('Card fixture', 0);
      b.presentEnemyStatus(b.enemies[0], 'An exceptionally long status label for boundary verification', '#c98bff');
      w.advanceTime(20); b.time.paused = true; b.tweens.pauseAll();
      const labels = b.fxLayer.list.filter((o: any) => o.name === 'combat-number-feedback');
      const rects = labels.map((o: any) => o.getBounds());
      return { flock: labels.filter((o: any) => o.getData('target') === 'flock').length,
        enemy: labels.find((o: any) => o.getData('target') !== 'flock').getByName('combat-number-label').getData('fullText'),
        bounded: rects.every((r: any) => r.left >= 8 && r.right <= 1272 && r.top >= 200 && r.bottom < 440),
        overlaps: rects.some((a: any, i: number) => rects.slice(i + 1).some((z: any) => a.left < z.right && a.right > z.left && a.top < z.bottom && a.bottom > z.top)),
        history: b.combatHistory.slice(start) };
    });
    expect(result.flock).toBeLessThanOrEqual(3); expect(result.bounded).toBe(true); expect(result.overlaps).toBe(false);
    expect(result.enemy).toContain('exceptionally long');
    expect(result.history).toEqual(expect.arrayContaining([
      expect.stringContaining('Card fixture leaves the flock Winded.'),
      expect.stringContaining('Card fixture shakes loose 0 Cover.'),
    ]));
    await page.screenshot({ path: info.outputPath(`feedback-${width}.png`) });
    await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); b.time.paused = false; b.tweens.resumeAll(); b.fxLayer.removeAll(true);
    });
  }
  expect(errors).toEqual([]);
});

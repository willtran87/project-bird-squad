import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

test('combat decision hierarchy preserves HUD targets and readable forecasts', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('birdsquad.firstFlightGuide', JSON.stringify({ enabled: true, routeCommits: 1 })));
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
    return b.hand.length && b.battleHudRendererModule && !b.combatIntroActive && !b.combatAnimationPending && !b.cameras.main.fadeEffect.isRunning;
  });
  for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(viewport); await settleCanvas(page);
    const hud = await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      b.battleInputActive = true; b.renderAll();
      const bounds = b.root.getByName('run-hud-surface').getBounds();
      const contains = (r: any) => r.left >= bounds.left - 1 && r.right <= bounds.right + 1 && r.top >= bounds.top - 1 && r.bottom <= bounds.bottom + 1;
      return {
        primary: ['Cover', 'Wingbeats'].map(key => b.root.getByName(`hud-value-${key}`).style.fontSize),
        secondary: ['Scrap', 'Deck', 'Supplies', 'Waymarks'].map(key => b.root.getByName(`hud-value-${key}`).style.fontSize),
        hitTargets: ['hud-deck-chip', 'hud-supplies-chip', 'hud-waymarks-chip'].every(key => {
          const hit = b.root.getByName(key); return hit.input.enabled && hit.height >= 58 && contains(hit.getBounds());
        }),
        labelsSeparate: ['Cover', 'Wingbeats'].every(key => b.root.getByName(`hud-label-${key}`).getBounds().bottom <= b.root.getByName(`hud-value-${key}`).getBounds().top),
        guided: b.isGuidedFirstCombat(), hint: Boolean(b.root.getByName('combat-input-hint')),
      };
    });
    expect(hud.primary).toEqual(['22px', '22px']);
    expect(hud.secondary).toEqual(['14px', '14px', '14px', '14px']);
    expect(hud.hitTargets).toBe(true); expect(hud.labelsSeparate).toBe(true); expect(hud.guided).toBe(true); expect(hud.hint).toBe(false);
    await page.screenshot({ path: info.outputPath(`ready-${viewport.width}.png`) });
    const selection = await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      b.onCardClicked(b.hand[0].instanceId);
      const p = b.root.getByName('combat-selection-preview'), panel = p.getByName('combat-outcome-preview').getBounds();
      const body = p.getByName('combat-selection-summary');
      const bounds = body.getBounds();
      return { size: body.style.fontSize, fits: bounds.left >= panel.left && bounds.right <= panel.right && bounds.bottom <= panel.bottom,
        lines: body.getWrappedText().length, handTop: b.handCardRects.get(b.hand[0].instanceId).getBounds().top, bottom: panel.bottom };
    });
    expect(selection.size).toBe('15px'); expect(selection.fits).toBe(true); expect(selection.lines).toBeLessThanOrEqual(2);
    expect(selection.bottom).toBeLessThan(selection.handTop);
    await settleCanvas(page); await page.screenshot({ path: info.outputPath(`selected-${viewport.width}.png`) });
    await page.keyboard.press('Escape'); await settleCanvas(page);
  }
  expect(errors).toEqual([]);
});

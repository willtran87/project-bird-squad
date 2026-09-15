import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

test('estimated incoming damage stays in its own HUD lane at large values', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('BattleScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.root?.getByName('combat-incoming-forecast-label') && b.hand.length && !b.combatIntroActive && !b.combatAnimationPending && !b.battleRenderQueued;
  });
  for (const [width, height] of [[2560,1600], [1440,900], [1000,560]]) {
    await page.setViewportSize({ width, height });
    for (const values of [{ hpLoss: 8, afterHp: 30 }, { hpLoss: 123, afterHp: 456 }]) {
      const result = await page.evaluate(values => {
        const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
        b.incomingFlockDamagePreview = () => ({ ...values, uncertainty: ['Card-only trigger'] });
        b.renderAll();
        const text = b.root.getByName('combat-incoming-forecast-label');
        const r = text.getBounds(), lane = b.root.getByName('combat-incoming-forecast-frame-fallback').getBounds();
        return { fits: r.left >= lane.left && r.right <= lane.right && r.top >= lane.top && r.bottom <= lane.bottom,
          text: text.text, size: text.style.fontSize, full: text.getData('fullText') };
      }, values);
      await settleCanvas(page);
      await page.screenshot({ path: info.outputPath(`forecast-${width}-${values.hpLoss}.png`) });
      expect.soft(result.fits, JSON.stringify(result)).toBe(true);
      expect(result.size).toBe('18px');
      expect(result.text).toContain('Est.');
      expect(result.text).toContain(String(values.hpLoss));
      expect(result.full).toContain(`${values.afterHp} Cohesion left`);
    }
  }
  expect(errors).toEqual([]);
});

import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

for (const failure of ['outbox', 'account', 'history', 'checkpoint-removal']) {
  test(`finished flight survives ${failure} failure and retry without duplicate records`, async ({ page }, info) => {
    test.setTimeout(90000);
    await page.goto('./?flight=finished-recovery&length=quick');
    await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      return b.fxLayer?.active && !b.combatIntroActive && !b.combatAnimationPending;
    });
    const before = await page.evaluate(() => localStorage.getItem('birdsquad.run.active'));
    await page.evaluate(failure => {
      const set = Storage.prototype.setItem, remove = Storage.prototype.removeItem;
      (window as any).__restoreOutcomeStorage = () => { Storage.prototype.setItem = set; Storage.prototype.removeItem = remove; };
      const key = failure === 'outbox' ? 'birdsquad.run.finished' : failure === 'account' ? 'birdsquad.account' : 'birdsquad.runs';
      Storage.prototype.setItem = function (name, value) {
        if (failure !== 'checkpoint-removal' && (name === key || name === `${key}.backup`)) throw new DOMException('Test write failure', 'QuotaExceededError');
        return set.call(this, name, value);
      };
      Storage.prototype.removeItem = function (name) {
        if (failure === 'checkpoint-removal' && name.startsWith('birdsquad.run.active')) throw new DOMException('Test removal failure', 'SecurityError');
        return remove.call(this, name);
      };
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      b.turn = 7; b.flock.hp = 0; b.checkOutcome(); b.renderAll();
    }, failure);
    const dialog = page.getByRole('dialog', { name: 'Flight save recovery' });
    await expect(dialog).toBeVisible();
    await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      b.input.gamepad.emit('down', {}, { index: 9 }); // Start cannot open a second modal behind this one.
    });
    expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').pauseOverlayOpen)).toBe(false);
    expect(await page.evaluate(() => localStorage.getItem('birdsquad.run.active'))).toBe(before);
    await page.getByRole('button', { name: 'Retry saving', exact: true }).click();
    await expect(dialog).toContainText('Saving is still unavailable');
    for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
      await page.setViewportSize({ width, height }); await settleCanvas(page);
      expect(await dialog.evaluate(element => {
        const b = element.getBoundingClientRect();
        const buttons=[...element.querySelectorAll('button')].map(button=>button.getBoundingClientRect());
        return b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight
          && buttons.every(button => button.height >= 48 && button.width >= 44)
          && buttons.every((a,i)=>buttons.slice(i+1).every(z=>Math.max(a.left-z.right,z.left-a.right,a.top-z.bottom,z.top-a.bottom)>=8));
      })).toBe(true);
      await page.screenshot({ path: info.outputPath(`${failure}-${width}.png`) });
    }
    await page.evaluate(() => (window as any).__restoreOutcomeStorage());
    if (failure === 'account' || failure === 'history') {
      // Resume the durable outbox in a fresh document, not the original scene.
      await page.reload();
      await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
    } else {
      await page.getByRole('button', { name: 'Retry saving', exact: true }).focus();
      if (failure === 'checkpoint-removal') await page.evaluate(() => {
        (window as any).__birdSquadGame.scene.getScene('BattleScene').input.gamepad.emit('down', {}, { index: 0 });
      });
      else await page.keyboard.press('Enter');
      await expect(dialog).toHaveCount(0);
      // The same result can be delivered twice without another award.
      await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').emitRunSummary('loss'));
    }
    const result = await page.evaluate(() => ({
      active: localStorage.getItem('birdsquad.run.active'), backup: localStorage.getItem('birdsquad.run.active.backup'),
      pending: localStorage.getItem('birdsquad.run.finished'),
      account: JSON.parse(localStorage.getItem('birdsquad.account')!),
      history: JSON.parse(localStorage.getItem('birdsquad.runs')!),
    }));
    expect(result.active).toBeNull(); expect(result.backup).toBeNull(); expect(result.pending).toBeNull();
    expect(result.account.runs).toBe(1); expect(result.account.losses).toBe(1);
    expect(result.history).toHaveLength(1); expect(result.history[0].turnsTaken).toBe(7);
  });
}

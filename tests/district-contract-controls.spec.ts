import { test, expect } from '@playwright/test';
import { screenReaderSummary } from '../src/game/screen-reader-summary';
import { settleCanvas } from './helpers/settled-canvas';
import { installVirtualController, pressController, controllerButton } from './helpers/virtual-controller';

for (const input of ['keyboard', 'remapped', 'controller', 'pointer'] as const) {
  test(`district contracts expose every choice with readable focus: ${input}`, async ({ page }, info) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    if (input === 'controller') await installVirtualController(page);
    if (input === 'remapped') await page.addInitScript(() => localStorage.setItem('birdsquad.controlBindings',
      JSON.stringify({ previous: 'KeyJ', next: 'KeyL', confirm: 'KeyK' })));
    await page.setViewportSize({ width: 2560, height: 1600 });
    await page.goto('./');
    await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
    await page.evaluate(async () => {
      const w = window as any;
      await w.__birdSquadEnsureScene('RouteScene');
      w.__birdSquadGame.scene.stop('MenuScene');
      w.__birdSquadGame.scene.start('RouteScene');
    });
    await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);
    await page.evaluate(() => {
      const w = window as any;
      const r = w.__birdSquadGame.scene.getScene('RouteScene');
      r.runState.combatResults = [{ encounterId: 'opening', nodeId: 'm1_entry', nodeType: 'street',
        enemyIds: [], turnsTaken: 1, damageDealt: 1, cohesionLost: 0, decisionStats: {} }];
      r.renderAll();
    });
    await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).districtContractChoice?.open);
    const state = () => page.evaluate(() => JSON.parse((window as any).render_game_to_text()).districtContractChoice);
    const before = await page.evaluate(() => JSON.stringify((window as any).__birdSquadGame.scene.getScene('RouteScene').runState));
    await settleCanvas(page);
    for (const index of [1, 2, 0, 2]) {
      const current = (await state()).focusIndex;
      if (input === 'pointer') {
        const p = await page.evaluate(index => {
          const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
          const o = r.children.list.filter((c: any) => c.name === 'district-contract-option')[index];
          const c = r.game.canvas.getBoundingClientRect();
          return { x: c.left + o.x * c.width / 1280, y: c.top + o.y * c.height / 720 };
        }, index);
        await page.mouse.move(p.x, p.y);
      } else {
        const forward = index === (current + 1) % 3;
        if (input === 'controller') await pressController(page, forward ? 15 : 14);
        else await page.keyboard.press(input === 'remapped' ? forward ? 'l' : 'j' : forward ? 'ArrowRight' : 'ArrowLeft');
      }
      await expect.poll(async () => (await state()).focusIndex).toBe(index);
      expect(await page.evaluate(() => JSON.stringify((window as any).__birdSquadGame.scene.getScene('RouteScene').runState))).toBe(before);
    }
    const choice = (await state()).options[2];
    const summary = screenReaderSummary({ scene: 'RouteScene', districtContractChoice: await state() });
    expect(summary).toContain(choice.name);
    expect(summary).toContain('On completion');
    for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
      await page.setViewportSize({ width, height }); await settleCanvas(page);
      const layout = await page.evaluate(() => {
        const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
        const hits = r.children.list.filter((o: any) => o.name === 'district-contract-option');
        return {
          focus: hits.map((o: any) => o.getData('focused')),
          fits: ['name', 'goal', 'reward'].every(kind => r.children.list.filter((o: any) => o.name === `district-contract-option-${kind}`)
            .every((o: any, i: number) => {
              const b = o.getBounds(), h = hits[i].getBounds();
              return b.left >= h.left + 8 && b.right <= h.right - 8 && b.top >= h.top + 8 && b.bottom <= h.bottom - 8
                && Number.parseFloat(o.style.fontSize) >= 20;
            })),
        };
      });
      expect(layout).toEqual({ focus: [false, false, true], fits: true });
      await page.screenshot({ path: info.outputPath(`contract-${width}.png`) });
    }
    if (input === 'controller') {
      await controllerButton(page, 0, true);
      await settleCanvas(page); await settleCanvas(page);
      expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').routeCommitPending)).toBe(false);
      await controllerButton(page, 0, false);
    } else if (input === 'pointer') {
      const p = await page.evaluate(() => {
        const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), c = r.game.canvas.getBoundingClientRect();
        return { x: c.left + 970 * c.width / 1280, y: c.top + 388 * c.height / 720 };
      });
      await page.mouse.click(p.x, p.y);
    } else await page.keyboard.press(input === 'remapped' ? 'k' : 'Enter');
    await expect.poll(async () => (await state()).open).toBe(false);
    expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').activeDistrictContract().id)).toBe(choice.id);
    expect(errors).toEqual([]);
  });
}

import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

for (const remapped of [false, true]) test(`failed ceremony keeps card art, readable Preens and intentional choices, remapped=${remapped}`, async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/assets/render-reward-*.js', route => route.abort('failed'));
  await page.addInitScript(remapped => {
    localStorage.setItem('birdsquad.screenReader', 'on');
    if (remapped) localStorage.setItem('birdsquad.controlBindings', JSON.stringify({ version: 1, bindings: { roost: 'KeyJ', back: 'KeyB', next: 'KeyE' } }));
  }, remapped);
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
    return b.battleHandRendererModule && b.hand.length && !b.combatIntroActive && !b.combatAnimationPending && !b.cameras.main.fadeEffect.isRunning;
  });
  const press = async (key: string) => { await page.keyboard.press(key); await settleCanvas(page); };
  const stable = () => page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return JSON.stringify({ mode: b.mode, deck: b.allDeckCards(), scrap: b.scrap, events: b.runRewardEvents, armed: b.rewardChoiceArmedId, focus: b.controllerChoiceIndex });
  });
  const reading = () => page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').getTextState().rewardInspection?.reading ?? null);
  const click = async (name: string) => {
    const p = await page.evaluate(name => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'), o = b.root.getByName(name), r = o.getBounds(), c = b.game.canvas.getBoundingClientRect();
      return { x: c.left + r.centerX * c.width / 1280, y: c.top + r.centerY * c.height / 720 };
    }, name);
    await page.mouse.click(p.x, p.y); await settleCanvas(page);
  };
  for (const mode of ['cardReward', 'upgradeReward']) {
    if (mode === 'upgradeReward') {
      await page.evaluate(() => {
        const w = window as any;
        for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
        w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
      });
      await page.waitForFunction(() => {
        const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
        return b.battleHandRendererModule && b.hand.length && !b.combatIntroActive && !b.cameras.main.fadeEffect.isRunning;
      });
    }
    await page.evaluate(mode => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      const cards = mode === 'cardReward' ? b.createRewardChoices() : b.allDeckCards().filter((c: any) => !c.upgraded && c.cost > 0).slice(0, 3);
      b.mode = mode; b.rewardChoices = cards; b.upgradeChoices = cards;
      b.flock.molt = true; b.rewardChoiceArmedId = undefined; b.rewardSkipArmed = false;
      b.controllerChoiceIndex = 0; b.battleInputActive = true; b.renderAll();
    }, mode);
    await page.waitForFunction(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      return b.battleRewardRendererFailed && b.rewardChoices.every((c: any, i: number) => b.rewardCardView(c, i).artKey);
    });
    for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
      await page.setViewportSize(viewport); await settleCanvas(page);
      await page.screenshot({ path: info.outputPath(`${mode}-${viewport.width}.png`) });
      const geometry = await page.evaluate(() => {
        const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'), objects = b.root.list;
        const rows = (name: string) => objects.filter((o: any) => o.name === name);
        return {
          art: rows('reward-fallback-card-art').map((o: any) => o.texture.key),
          expectedArt: b.rewardChoices.map((c: any, i: number) => b.rewardCardView(c, i).artKey),
          cost: rows('reward-fallback-card-cost').map((o: any) => o.text),
          expectedCost: b.rewardChoices.map((c: any, i: number) => { const cost = b.rewardCardView(c, i).cost; return `${cost} Wingbeat${cost === 1 ? '' : 's'}`; }),
          effects: rows('reward-fallback-effect').map((o: any) => ({ size: o.style.fontSize, bottom: o.getBounds().bottom, full: Boolean(o.getData('fullText')) })),
          context: rows('reward-fallback-decision-context').map((o: any) => ({ size: o.style.fontSize, bottom: o.getBounds().bottom, full: Boolean(o.getData('fullText')) })),
          controls: [...rows('reward-card-inspect-hit'), ...rows('reward-card-take-hit'), ...rows('reward-skip-hit')].map((o: any) => o.height),
        };
      });
      expect(geometry.art).toHaveLength(3); expect(geometry.art).toEqual(geometry.expectedArt);
      expect(geometry.cost).toEqual(geometry.expectedCost);
      expect(geometry.effects).toHaveLength(3);
      geometry.effects.forEach((o: any) => { expect(o.size).toBe('18px'); expect(o.bottom).toBeLessThan(502); expect(o.full).toBe(true); });
      geometry.context.forEach((o: any) => { expect(o.size).toBe('14px'); expect(o.bottom).toBeLessThan(550); expect(o.full).toBe(true); });
      expect(geometry.controls).toHaveLength(mode === 'cardReward' ? 7 : 6);
      expect(geometry.controls.every((height: number) => height >= 58)).toBe(true);
    }
    await click('reward-card-take-hit'); const before = await stable();
    await click('reward-card-inspect-hit'); expect(await reading()).not.toBeNull(); expect(await stable()).toBe(before);
    await click('reward-card-take-hit'); expect(await stable()).toBe(before);
    await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').setBattlePaused(true));
    await press('Enter'); expect(await reading()).not.toBeNull();
    await press(remapped ? 'b' : 'Escape'); expect(await reading()).not.toBeNull();
    await press(remapped ? 'b' : 'Escape'); expect(await reading()).toBeNull(); expect(await stable()).toBe(before);
    await press(remapped ? 'j' : 'r'); expect(await reading()).not.toBeNull();
    await press(remapped ? 'e' : 'ArrowRight');
    await page.screenshot({ path: info.outputPath(`${mode}-reading-1000.png`) });
    await press('Enter'); expect(await reading()).toBeNull(); expect(await stable()).toBe(before);
    await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').input.gamepad.emit('down', {}, { index: 3 }));
    await expect.poll(reading).not.toBeNull();
    await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').input.gamepad.emit('down', {}, { index: 1 }));
    await expect.poll(reading).toBeNull(); expect(await stable()).toBe(before);
    if (mode === 'cardReward') {
      await click('reward-skip-hit');
      const skipState = await stable();
      await click('reward-card-inspect-hit'); expect(await reading()).toBeNull(); expect(await stable()).toBe(skipState);
      await click('reward-card-take-hit'); expect(await stable()).toBe(skipState);
      await press(remapped ? 'b' : 'Escape');
      await click('reward-card-take-hit');
    }
    const picked = await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); return b.rewardChoiceArmedId;
    });
    await click('reward-card-take-hit');
    await page.waitForFunction(mode => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      return (mode === 'cardReward' ? b.rewardChoices : b.upgradeChoices).length === 0;
    }, mode);
    expect(await page.evaluate(({ mode, picked }) => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      return mode === 'cardReward' ? b.runRewardEvents.some((e: any) => e.picked === picked) : b.allDeckCards().some((c: any) => c.id === picked && c.upgraded);
    }, { mode, picked })).toBe(true);
  }
  expect(errors).toEqual([]);
});

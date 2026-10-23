import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';
import waymarks from '../data/game/alpha-route-marks.json' with { type: 'json' };

async function boot(page: Page) {
  await page.setViewportSize({ width: 2560, height: 1600 }); await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('BattleScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.battleHandRendererModule && b.hand.length && !b.combatIntroActive && !b.combatAnimationPending;
  });
}

for (const mode of ['cardReward', 'upgradeReward', 'waymarkReward']) test(`ceremony readability and intentional decisions: ${mode}`, async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await boot(page);
  await page.evaluate(({ mode, ids }) => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.rewardChoices = b.createRewardChoices(); b.upgradeChoices = b.allDeckCards().slice(0, 3);
    b.waymarkChoices = b.selectWaymarkRewardChoices(ids, ids, 3, 'polish-waymarks', false); b.mode = mode;
    b.controllerChoiceIndex = 0; b.battleInputActive = true; b.renderAll();
  }, { mode, ids: waymarks.routeMarks.map(m => m.id) });
  await page.waitForFunction(mode => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.battleRewardRendererModule && !b.load.isLoading() && b.root.list.some((o: any) => o.name === (mode === 'waymarkReward' ? 'reward-waymark-hit' : 'reward-card-take-hit'));
  }, mode);
  const check = async () => {
    const issues = await page.evaluate(mode => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'), scale = b.game.canvas.getBoundingClientRect().height / 720;
      const collect = (items: any[]): any[] => items.flatMap(o => [o, ...collect(o.list ?? [])]);
      const all = collect(b.root.list), issues: any[] = [];
      for (const o of all.filter(o => o.type === 'Text' && o.text && o.visible)) {
        const primary = /reward-(card-(name|cost|effect|inspect-label|take-label)|waymark-(title|effect|command)|skip-title)$/.test(o.name);
        const bounds = o.getBounds(), font = parseFloat(o.style.fontSize) * scale;
        if (font < (primary ? 16 : 14) || bounds.left < 0 || bounds.right > 1280 || bounds.top < 0 || bounds.bottom > 720)
          issues.push({ name: o.name, text: o.text, font, bounds });
      }
      const controls = all.filter(o => /reward-(card-(inspect|take)-|waymark-(inspect-)?|skip-)hit$/.test(o.name));
      const expected = mode === 'cardReward' ? 7 : 6;
      if (controls.length !== expected) issues.push({ controls: controls.length, expected });
      for (const o of controls) {
        if (o.width * scale < 44 || o.height * scale < 44) issues.push({ target: o.name });
        if (!['primary', 'secondary'].includes(o.getData('controlKind'))) issues.push({ role: o.name });
        if (/inspect|skip/.test(o.name) && o.getData('controlKind') !== 'secondary') issues.push({ secondaryRole: o.name });
        const caption = o.getData('labelObject');
        if (!caption || caption.alpha !== 1 || o.alpha !== 1) issues.push({ opaqueControl: o.name });
        for (const p of controls.slice(controls.indexOf(o) + 1)) {
          const a = o.getBounds(), z = p.getBounds();
          if (a.left < z.right && z.left < a.right && a.top < z.bottom && z.top < a.bottom) issues.push({ overlap: [o.name, p.name] });
        }
      }
      if (!controls.some(o => o.getData('controlKind') === 'primary')) issues.push({ missingPrimary: mode });
      const slots = all.filter(o => o.name === 'reward-card-art-slot');
      if (mode !== 'waymarkReward' && slots.length !== 3) issues.push({ slots: slots.length });
      for (const slot of slots) {
        const art = slot.list.find((o: any) => o.type === 'Image'), a = slot.getBounds();
        if (!art || slot.getData('artState') !== 'ready' || Math.abs(art.scaleX - art.scaleY) > .00001) issues.push({ art: slot.name });
        const z = art?.getBounds();
        if (z && (z.left < a.left || z.right > a.right || z.top < a.top || z.bottom > a.bottom)) issues.push({ stretched: true });
        const id = slot.getData('cardId');
        const label = (name: string) => all.find(o => o.name === name && o.getData('cardId') === id)?.getBounds();
        const title = label('reward-card-name'), cost = label('reward-card-cost');
        const family = label('reward-card-family'), effect = label('reward-card-effect');
        if (!title || !cost || !family || !effect || title.bottom > cost.top - 4 || cost.bottom > family.top - 4
          || a.bottom > family.top || family.bottom > effect.top - 4 || effect.bottom > 499)
          issues.push({ hierarchy: id, title, cost, family, effect, art: a });
      }
      return issues;
    }, mode);
    expect(issues).toEqual([]);
  };
  for (const [width, height] of [[2560,1600],[1440,900],[1000,560]]) {
    await page.setViewportSize({ width, height }); await settleCanvas(page); await check();
    await page.screenshot({ path: info.outputPath(`${mode}-${width}.png`) });
  }
  if (mode !== 'waymarkReward') {
    const point = await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'), c = b.game.canvas.getBoundingClientRect();
      return { x: c.left + 336 * c.width / 1280, y: c.top + 396 * c.height / 720 };
    });
    await page.mouse.move(point.x, point.y); await settleCanvas(page);
    expect(await page.evaluate(() => Boolean((window as any).__birdSquadGame.scene.getScene('BattleScene').cardPreview?.active))).toBe(false);
  }
  const before = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return JSON.stringify({ deck: b.allDeckCards(), scrap: b.scrap, marks: b.routeMarks });
  });
  // Inspection, cancellation and focus never claim the highlighted choice.
  await page.keyboard.press('r'); await settleCanvas(page);
  await page.screenshot({ path: info.outputPath('inspection-1000.png') });
  await page.keyboard.press('Escape'); await settleCanvas(page);
  await page.keyboard.press('ArrowRight'); await settleCanvas(page);
  expect(await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return JSON.stringify({ deck: b.allDeckCards(), scrap: b.scrap, marks: b.routeMarks });
  })).toBe(before);
  // Keyboard navigation selects; only the separate confirmation commits.
  await page.keyboard.press('Enter'); await settleCanvas(page);
  expect(await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return JSON.stringify({ deck: b.allDeckCards(), scrap: b.scrap, marks: b.routeMarks });
  })).not.toBe(before);
  expect(errors).toEqual([]);
});

for (const fallback of [false, true]) test(`reward art retry preserves an armed choice without repaint loops, fallback=${fallback}`, async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  if (fallback) await page.route('**/render-reward-*.js', route => route.abort('failed'));
  await boot(page);
  const key = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.rewardChoices = b.createRewardChoices();
    const card = b.rewardChoices.find((c: any) => !b.textures.exists(b.rewardCardView(c, 0).artKey));
    if (!card) throw new Error('Expected an uncached reward illustration');
    return { key: b.rewardCardView(card, 0).artKey, id: card.id };
  });
  let requests = 0;
  await page.route('**/*.webp', async route => {
    if (route.request().url().includes(`${key.id}-`)) { requests++; await route.abort('failed'); }
    else await route.continue();
  });
  await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.mode = 'cardReward'; b.controllerChoiceIndex = 0; b.battleInputActive = true; b.renderAll();
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.root.list.some((o: any) => o.name === 'reward-card-art-slot' && o.getData('artState') === 'unavailable');
  });
  const after = requests;
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').renderAll());
  await page.waitForTimeout(800); expect(requests).toBe(after); expect(requests).toBeGreaterThan(0); expect(requests).toBeLessThanOrEqual(3);
  if (fallback) await page.getByRole('button', { name: 'Keep playing', exact: true }).click();
  await page.screenshot({ path: info.outputPath('failed-art-2560.png') });
  await page.setViewportSize({ width: 1000, height: 560 }); await settleCanvas(page);
  await page.screenshot({ path: info.outputPath('failed-art-1000.png') });
  await page.unrouteAll({ behavior: 'wait' });
  const saved = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    b.rewardChoiceArmedId = b.rewardChoices[0].id;
    w.rewardArtSlots = b.root.list.filter((o: any) => o.name === 'reward-card-art-slot');
    return JSON.stringify({ deck: b.allDeckCards(), armed: b.rewardChoiceArmedId, focus: b.controllerChoiceIndex });
  });
  const retry = await page.evaluate(id => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'), c = b.game.canvas.getBoundingClientRect();
    const slot = b.root.list.find((o: any) => o.name === 'reward-card-art-slot' && o.getData('cardId') === id);
    const r = slot.getByName('reward-art-retry').getBounds();
    return { x: c.left + r.centerX * c.width / 1280, y: c.top + r.centerY * c.height / 720,
      width: r.width * c.width / 1280, height: r.height * c.height / 720 };
  }, key.id);
  expect(retry.width).toBeGreaterThanOrEqual(44); expect(retry.height).toBeGreaterThanOrEqual(44);
  await page.mouse.click(retry.x, retry.y);
  await page.waitForFunction(key => (window as any).__birdSquadGame.textures.exists(key), key.key);
  await settleCanvas(page);
  await expect.poll(() => page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    return { same: w.rewardArtSlots.every((o: any) => o.active && b.root.list.includes(o) && o.getData('artState') === 'ready'),
      state: JSON.stringify({ deck: b.allDeckCards(), armed: b.rewardChoiceArmedId, focus: b.controllerChoiceIndex }) };
  })).toEqual({ same: true, state: saved });
  expect(errors).toEqual([]);
});

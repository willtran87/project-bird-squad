import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { settleCanvas } from './helpers/settled-canvas';

test('Plume Flash uses the approved pilot in the hand and focused preview', async ({ page }, info) => {
  const errors: string[] = [];
  const artLoads: Promise<Buffer>[] = [];
  page.on('response', r => { if (/\/wands_ace-[^/]+\.webp$/.test(r.url())) artLoads.push(r.body()); });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
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
    const card = b.hand.find((c: any) => c.id === 'wands_ace');
    return card && b.handCardRects?.has(card.instanceId) && !b.combatIntroActive && !b.combatAnimationPending && !b.battleRenderQueued;
  });
  const hit = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const card = b.hand.find((c: any) => c.id === 'wands_ace');
    const r = b.handCardRects.get(card.instanceId).getBounds(), canvas = b.game.canvas.getBoundingClientRect();
    return { id: card.instanceId, x: canvas.left + r.centerX * canvas.width / 1280, y: canvas.top + r.centerY * canvas.height / 720 };
  });
  await page.mouse.click(hit.x, hit.y);
  await page.waitForFunction(id => (window as any).__birdSquadGame.scene.getScene('BattleScene').selectedInstanceId === id, hit.id);
  // Combat intentionally streams compact art, not full portraits.
  await page.waitForFunction(() => (window as any).__birdSquadGame.textures.exists('card-thumb-wands_ace'));
  const art = await page.evaluate(() => {
    const image = (window as any).__birdSquadGame.textures.get('card-thumb-wands_ace').getSourceImage();
    return { src: image.src, width: image.width, height: image.height };
  });
  expect(art.width).toBe(184); expect(art.height).toBe(276);
  const expectedArt = await readFile('assets/runtime/cards/thumb/wands_ace.webp');
  expect((await Promise.all(artLoads)).some(bytes => bytes.equals(expectedArt))).toBe(true);
  for (const [width, height] of [[2560,1600], [1440,900], [1000,560]]) {
    await page.setViewportSize({ width, height }); await settleCanvas(page);
    await page.screenshot({ path: info.outputPath(`plume-selected-${width}.png`) });
  }
  const before = await page.evaluate(() => JSON.parse((window as any).render_game_to_text()));
  await page.keyboard.press('h');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').combatCardDetail?.active);
  await settleCanvas(page);
  await page.screenshot({ path: info.outputPath('plume-full-reader-1000.png') });
  await page.keyboard.press('Escape');
  const after = await page.evaluate(() => JSON.parse((window as any).render_game_to_text()));
  expect(after.turn).toBe(before.turn);
  expect(after.enemies).toEqual(before.enemies);
  expect(errors).toEqual([]);
});

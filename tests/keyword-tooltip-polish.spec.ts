import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';
import { KEYWORDS, keywordIconId } from '../src/game/keyword-definitions';

async function bootCodex(page: import('@playwright/test').Page) {
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('CodexScene');
    const account = JSON.parse(localStorage.getItem('birdsquad.account') || '{}');
    account.discoveredCards = [...new Set([...(account.discoveredCards ?? []), 'pentacles_04'])];
    localStorage.setItem('birdsquad.account', JSON.stringify(account));
    for (const scene of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(scene.scene.key);
    w.__birdSquadGame.scene.start('CodexScene');
  });
  const keywordIcons = [...new Set(Object.keys(KEYWORDS).map(keywordIconId))];
  await page.waitForFunction((icons) => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    return Boolean(c.root) && icons.every((icon: string) => c.textures.exists(`ui-icon-${icon}`));
  }, keywordIcons);
  await page.evaluate(() => { const c = (window as any).__birdSquadGame.scene.getScene('CodexScene'); c.detailId = 'pentacles_04'; c.renderAll(); });
  await settleCanvas(page);
}

test('keyword definitions keep canonical icons readable and bounded', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 2560, height: 1600 }); await bootCodex(page);
  const savedBefore = await page.evaluate(() => JSON.stringify(localStorage));
  const keywords = ['Cohesion', 'Cover', 'Resonance', 'Resonance Burst', 'Winded', 'Fouled', 'Winded Burst', 'Molt', 'Open Sky', 'Open Sky Guard', 'Flow', 'Surge', 'Scatter', 'Hold', 'Wingbeat', 'Regen', 'Energy', 'Draw', 'Discard', 'Retain', 'Keystone'];
  const keywordIcons = Object.fromEntries(keywords.map(keyword => [keyword, keywordIconId(keyword)]));
  for (const size of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(size); await settleCanvas(page);
    await page.evaluate(() => (window as any).__birdSquadShowKeywordTooltip('CodexScene', 'Molt', 1000, 320));
    await page.screenshot({ path: info.outputPath(`keyword-${size.width}.png`) });
    const failures = await page.evaluate(({ keywords, keywordIcons }) => {
      const w = window as any, c = w.__birdSquadGame.scene.getScene('CodexScene'); const failures: string[] = [];
      for (const keyword of keywords) for (const [x, y] of [[8, 8], [1272, 8], [8, 712], [1272, 712], [640, 360]]) {
        w.__birdSquadShowKeywordTooltip('CodexScene', keyword, x, y);
        const tip = c.children.list.find((o: any) => o.name === 'keyword-tooltip');
        if (!tip) { failures.push(`${keyword}: missing readable surface`); continue; }
        const frame = tip.getByName('keyword-tooltip-panel').getBounds();
        if (frame.left < 8 || frame.right > 1272 || frame.top < 8 || frame.bottom > 712) failures.push(`${keyword}: stage overflow`);
        const icon = tip.getByName('keyword-tooltip-icon'), iconBounds = icon?.getBounds();
        if (!icon || icon.texture?.key !== `ui-icon-${keywordIcons[keyword]}` || !iconBounds
          || iconBounds.left < frame.left + 12 || iconBounds.top < frame.top + 8 || iconBounds.bottom > frame.bottom - 8) failures.push(`${keyword}: icon`);
        for (const name of ['keyword-tooltip-title', 'keyword-tooltip-body']) {
          const t = tip.getByName(name), r = t.getBounds();
          if (parseInt(t.style.fontSize) < 20 || t.style.resolution !== 2 || r.left < frame.left + 16 || r.right > frame.right - 16
            || r.bottom > frame.bottom - 16 || t.text !== t.getData('fullText')) failures.push(`${keyword}: ${name}`);
        }
      }
      return failures;
    }, { keywords, keywordIcons });
    expect(failures).toEqual([]);
  }
  const fallback = await page.evaluate(() => {
    const w = window as any, c = w.__birdSquadGame.scene.getScene('CodexScene');
    c.textures.remove('ui-icon-keyword-tooltip-frame');
    w.__birdSquadShowKeywordTooltip('CodexScene', 'Molt', 1000, 320);
    const tip = c.children.getByName('keyword-tooltip');
    const icon = tip.getByName('keyword-tooltip-icon');
    return { body: tip.getByName('keyword-tooltip-body').text, art: tip.list.filter((o: any) => o.type === 'Image').length,
      icon: icon?.getData('icon'), texture: icon?.texture?.key };
  });
  expect(fallback.body).toContain('whole-turn'); expect(fallback.art).toBe(1);
  expect(fallback).toMatchObject({ icon: 'codex-molt-medallion', texture: 'ui-icon-codex-molt-medallion' });
  await page.screenshot({ path: info.outputPath('keyword-without-frame.png') });
  expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(savedBefore);
  expect(errors).toEqual([]);
});

test('keyword help follows transformed words and cleans up on replacement and scene shutdown', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 }); await bootCodex(page);
  await page.evaluate(() => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    const flatten = (items: any[]): any[] => items.flatMap(o => [o, ...(o.list ? flatten(o.list) : [])]);
    const word = flatten(c.root.list).find((o: any) => o.type === 'Text' && /^Cover[.,]?$/.test(o.text) && o.listenerCount('pointerover'));
    if (!word) throw new Error('Missing real interactive keyword');
    const fixture = c.add.container(760, 470).setScale(1.2).setDepth(90000);
    fixture.add(word); word.setPosition(0, 0); c.__keywordFixture = fixture; c.__keywordWord = word;
  });
  await settleCanvas(page);
  const point = await page.evaluate(() => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene'), word = c.__keywordWord;
    const r = word.getBounds(), canvas = c.game.canvas.getBoundingClientRect();
    return { x: canvas.left + r.centerX * canvas.width / 1280, y: canvas.top + r.centerY * canvas.height / 720 };
  });
  await page.mouse.move(point.x, point.y); await settleCanvas(page);
  await expect.poll(() => page.evaluate(() => Boolean(
    (window as any).__birdSquadGame.scene.getScene('CodexScene').children.getByName('keyword-tooltip'),
  ))).toBe(true);
  const shown = await page.evaluate(() => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene'), tip = c.children.getByName('keyword-tooltip');
    const r = tip.getBounds(), word = c.__keywordWord.getBounds();
    return { near: Math.abs(r.centerX - word.centerX) < 1 && r.bottom < word.top && word.top - r.bottom <= 16, text: tip.getByName('keyword-tooltip-title').text };
  });
  expect(shown).toEqual({ near: true, text: 'COVER' });
  await page.screenshot({ path: info.outputPath('keyword-transformed-owner.png') });
  await page.mouse.move(point.x + 160, point.y); await settleCanvas(page);
  expect(await page.evaluate(() => Boolean((window as any).__birdSquadGame.scene.getScene('CodexScene').children.getByName('keyword-tooltip')))).toBe(false);
  await page.mouse.move(point.x, point.y); await settleCanvas(page);
  await page.mouse.move(4, 4); await settleCanvas(page);
  expect(await page.evaluate(() => Boolean((window as any).__birdSquadGame.scene.getScene('CodexScene').children.getByName('keyword-tooltip')))).toBe(false);
  await page.mouse.move(point.x, point.y); await settleCanvas(page);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').__keywordFixture.destroy(true));
  expect(await page.evaluate(() => Boolean((window as any).__birdSquadGame.scene.getScene('CodexScene').children.getByName('keyword-tooltip')))).toBe(false);
  const lifecycle = await page.evaluate(() => {
    const w = window as any, g = w.__birdSquadGame, c = g.scene.getScene('CodexScene'), menu = g.scene.getScene('MenuScene');
    const before = c.events.listenerCount('shutdown');
    const inputBefore = c.input.listenerCount('gameout');
    for (let i = 0; i < 30; i++) w.__birdSquadShowKeywordTooltip('CodexScene', 'Retain', 600, 300);
    const during = c.events.listenerCount('shutdown');
    const inputDuring = c.input.listenerCount('gameout');
    const previous = c.children.getByName('keyword-tooltip');
    w.__birdSquadShowKeywordTooltip('MenuScene', 'Molt', 600, 300);
    const replacement = !previous.active && !c.children.getByName('keyword-tooltip');
    const after = c.events.listenerCount('shutdown');
    const inputAfter = c.input.listenerCount('gameout');
    menu.children.getByName('keyword-tooltip').destroy(true);
    w.__birdSquadShowKeywordTooltip('CodexScene', 'Retain', 600, 300);
    const final = c.children.getByName('keyword-tooltip'); g.scene.stop('CodexScene');
    return { before, during, after, inputBefore, inputDuring, inputAfter, replacement, stopped: !final.active, remaining: Boolean(c.children.getByName('keyword-tooltip')) };
  });
  expect(lifecycle.during).toBe(lifecycle.before + 1); expect(lifecycle.after).toBe(lifecycle.before);
  expect(lifecycle.inputDuring).toBe(lifecycle.inputBefore + 1); expect(lifecycle.inputAfter).toBe(lifecycle.inputBefore);
  expect(lifecycle.replacement).toBe(true); expect(lifecycle.stopped).toBe(true); expect(lifecycle.remaining).toBe(false);
  expect(errors).toEqual([]);
});

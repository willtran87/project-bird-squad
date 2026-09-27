import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';
import { writeFile } from 'node:fs/promises';

const state = (page: Page) => page.evaluate(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}'));
const disk = (page: Page) => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])));
async function play(page: Page, id: string) {
  const choice = await page.evaluate(id => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return { index: b.hand.findIndex((c: any) => c.id === id), played: b.statCardsPlayed };
  }, id);
  expect(choice.index, id).toBeGreaterThanOrEqual(0);
  await page.keyboard.press(String(choice.index + 1));
  await page.keyboard.press('Enter');
  await page.waitForFunction(played => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.statCardsPlayed > played && !b.combatAnimationPending;
  }, choice.played);
}

for (const [index, id] of ['cover', 'flow', 'molt'].entries()) {
  test(`guided ${id} lesson uses live rules and preserves the saved flight`, async ({ page }, info) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.setViewportSize({ width: 2560, height: 1600 });
    await page.goto('./');
    await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').routeAssetsReady);
    await page.reload();
    await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
    const before = await disk(page);
    expect(before['birdsquad.run.active']).toBeTruthy();
    await page.keyboard.press('h');
    await expect.poll(async () => (await state(page)).helpFocus?.label).toBe('Practice lessons');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await state(page)).helpTopic).toContain('Practice lessons.');
    for (let i = 0; i < index; i++) {
      await page.keyboard.press('ArrowDown');
      await expect.poll(async () => (await state(page)).helpFocus?.index).toBe(i + 1);
    }
    await page.keyboard.press('Enter');
    await page.waitForFunction(id => JSON.parse((window as any).render_game_to_text?.() ?? '{}').practiceLesson?.id === id, id);
    await page.waitForFunction(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      return !b.combatIntroActive && !b.combatAnimationPending && b.battleHandRendererModule
        && b.hand.every((c: any) => b.textures.exists(b.battleHandCardView(c).artKey));
    });
    for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
      await page.setViewportSize(viewport); await settleCanvas(page);
      expect(await page.evaluate(() => {
        const g = (window as any).__birdSquadGame;
        const lesson = g.scene.getScene('GuidedPracticeScene');
        const panel = lesson.children.list.flatMap((o: any) => o.list ?? []).find((o: any) => o.name === 'practice-lesson-panel').getBounds();
        const text = lesson.children.list.flatMap((o: any) => o.list ?? []).find((o: any) => o.name === 'practice-lesson-instruction').getBounds();
        return text.left >= panel.left + 10 && text.right <= panel.right - 10 && text.top >= panel.top + 8
          && text.bottom <= panel.bottom - 8 && panel.bottom < 200;
      })).toBe(true);
      await page.screenshot({ path: info.outputPath(`lesson-${viewport.width}.png`) });
    }
    if (id === 'cover') {
      await play(page, 'pentacles_04');
      await expect.poll(async () => (await state(page)).practiceLesson.step).toBe(2);
      await page.keyboard.press('r');
    } else if (id === 'flow') {
      await play(page, 'pentacles_fledgling');
      await play(page, 'wands_ace');
      await play(page, 'swords_ace');
    } else {
      await play(page, 'aviary_25');
      await expect.poll(async () => (await state(page)).practiceLesson.step).toBe(2);
      await play(page, 'wands_ace');
      await expect.poll(async () => (await state(page)).practiceLesson.step).toBe(3);
      await page.keyboard.press('r');
    }
    await expect.poll(async () => (await state(page)).practiceLesson?.complete, { timeout: 15000 }).toBe(true);
    expect(await disk(page)).toEqual(before);
    for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
      await page.setViewportSize(viewport); await settleCanvas(page);
      await page.screenshot({ path: info.outputPath(`complete-${viewport.width}.png`) });
    }
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await state(page)).helpFocus?.label).toBe('Practice lessons');
    expect(await disk(page)).toEqual(before);
    expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.isActive('GuidedPracticeScene'))).toBe(false);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').routeAssetsReady);
    const restored = await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').runState);
    expect(restored.seed).toBe(JSON.parse(before['birdsquad.run.active']!).seed);
    expect(errors).toEqual([]);
  });
}

test('help and lessons support controller focus, remapped confirmation, Back and repeated openings', async ({ page }, info) => {
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  const listeners = await page.evaluate(() => {
    const m = (window as any).__birdSquadGame.scene.getScene('MenuScene');
    return { keyboard: Object.fromEntries(m.input.keyboard.eventNames().map((name: string) => [name, m.input.keyboard.listenerCount(name)])), pad: m.input.gamepad.listenerCount('down') };
  });
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('h');
    await expect.poll(async () => (await state(page)).helpFocus?.label).toBe('Practice lessons');
    await page.evaluate(() => {
      const m = (window as any).__birdSquadGame.scene.getScene('MenuScene');
      m.input.gamepad.emit('down', null, { index: 0 });
    });
    await expect.poll(async () => (await state(page)).helpTopic).toContain('Practice lessons.');
    await page.evaluate(() => {
      const m = (window as any).__birdSquadGame.scene.getScene('MenuScene');
      m.input.gamepad.emit('down', null, { index: 13 });
    });
    expect((await state(page)).helpFocus.label).toBe('Find your Flow');
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await state(page)).helpFocus?.label).toBe('Practice lessons');
    await page.keyboard.press('Escape');
  }
  expect(await page.evaluate(() => {
    const m = (window as any).__birdSquadGame.scene.getScene('MenuScene');
    return { keyboard: Object.fromEntries(m.input.keyboard.eventNames().map((name: string) => [name, m.input.keyboard.listenerCount(name)])), pad: m.input.gamepad.listenerCount('down') };
  })).toEqual(listeners);
  await page.evaluate(() => localStorage.setItem('birdsquad.controlBindings', JSON.stringify({ confirm: 'KeyJ', back: 'KeyK' })));
  await page.reload();
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.keyboard.press('h');
  await expect.poll(async () => (await state(page)).helpFocus?.label).toBe('Practice lessons');
  await page.keyboard.press('j');
  await expect.poll(async () => (await state(page)).helpTopic).toContain('Practice lessons.');
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').menuFocusRing?.visible)).toBe(false);
  for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(viewport); await settleCanvas(page);
    await page.screenshot({ path: info.outputPath(`picker-${viewport.width}.png`) });
  }
  await page.keyboard.press('k');
  await expect.poll(async () => (await state(page)).helpFocus?.label).toBe('Practice lessons');
});

test('failed lesson download exposes recovery without trapping the menu', async ({ page }) => {
  await page.route(/\/assets\/practice-lessons-[^/]+\.js$/, route => route.abort('failed'));
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.keyboard.press('h');
  await expect.poll(async () => (await state(page)).helpFocus?.label).toBe('Practice lessons');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const overlay = (window as any).__birdSquadGame.scene.getScene('MenuScene').helpOverlay;
    return overlay?.getData('practiceFailed') && overlay.list.some((child: any) => child.text === 'Reload lessons');
  });
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await state(page)).helpFocus).toBeUndefined();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.isActive('RouteScene'));
});

test('modal navigation consumes a keyboard event once without delaying distinct presses', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.keyboard.press('h');
  await expect.poll(async () => (await state(page)).helpFocus?.label).toBe('Practice lessons');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await state(page)).helpTopic).toContain('Practice lessons.');
  await page.evaluate(() => {
    const keys = (window as any).__birdSquadGame.scene.getScene('MenuScene').input.keyboard;
    const event = new KeyboardEvent('keydown', { code: 'ArrowDown' });
    keys.emit('keydown', event); keys.emit('keydown', event);
  });
  expect((await state(page)).helpFocus.index).toBe(1);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').input.keyboard
    .emit('keydown', new KeyboardEvent('keydown', { code: 'ArrowDown' })));
  expect((await state(page)).helpFocus.index).toBe(2);
});

test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus) return;
  const snapshot = await state(page).catch(() => ({ error: 'Page unavailable' }));
  await writeFile(info.outputPath('failure-state.json'), JSON.stringify(snapshot, null, 2));
  await page.screenshot({ path: info.outputPath('failure.png') }).catch(() => {});
});

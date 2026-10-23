import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';
import {targetGeometry,checkTargetGeometry} from './helpers/target-geometry';

test('Settings explains every focused option and preserves readable geometry', async ({ page }, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.keyboard.press('s');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).settingsFocus);
  for (const size of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(size); await settleCanvas(page);
    // Walk all rows without changing a preference; focus is preserved between sizes.
    const explanations = new Set<string>();
    for (let index = 0; index < 16; index++) {
      const layout = await page.evaluate(() => {
        const s = (window as any).__birdSquadGame.scene.getScene('MenuScene');
        const objects = s.settingsOverlay.list.filter((o: any) => o.visible && o.active);
        const scale = s.game.canvas.getBoundingClientRect().width / 1280;
        const labels = objects.filter((o: any) => o.name === 'system-settings-row-label');
        const values = objects.filter((o: any) => o.name === 'system-settings-row-value' || o.name === 'system-settings-audio-value');
        const detail = objects.find((o: any) => o.name === 'system-settings-section-description');
        const b = detail.getBounds();
        return {
          explanation: detail.text,
          detailFits: b.left >= 148 && b.right <= 520 && b.bottom <= 598,
          readable: objects.filter((o: any) => o.type === 'Text' && o.text.trim()).every((o: any) =>
            parseFloat(o.style.fontSize) * scale >= (o.getData('settingsRow') !== undefined ? 16 : 14)),
          rowClear: labels.every((label: any) => values.filter((v: any) => v.getData('settingsRow') === label.getData('settingsRow'))
            .every((value: any) => label.getBounds().right + 12 <= value.getBounds().left)),
          targetSizes: objects.filter((o: any) => /^system-settings-row-\d+-hit$/.test(o.name)).every((o: any) =>
            o.getBounds().width * scale >= 44 && o.getBounds().height * scale >= 44),
          stageFits: objects.filter((o: any) => o.type === 'Text' && o.text.trim()).every((o: any) => {
            const r = o.getBounds(); return r.left >= 60 && r.right <= 1220 && r.top >= 30 && r.bottom <= 690;
          }),
          focus: JSON.parse((window as any).render_game_to_text()).settingsFocus,
        };
      });
      expect(layout, JSON.stringify(layout)).toMatchObject({ detailFits: true, readable: true, rowClear: true, targetSizes: true, stageFits: true });
      checkTargetGeometry(await targetGeometry(page,'MenuScene'),'Settings options');
      explanations.add(layout.explanation);
      if (layout.focus.position === 1) await page.screenshot({ path: info.outputPath(`${layout.focus.section}-${size.width}.png`) });
      await page.keyboard.press('ArrowDown'); await settleCanvas(page);
    }
    expect(explanations.size).toBe(16);
  }
  expect(errors).toEqual([]);
});

test('Settings reports session-only changes and recovers persistence for every preference', async ({ page }, info) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(() => {
    const w = window as any, proto = Storage.prototype;
    w.restoreSettingsStorage = () => { proto.setItem = w.settingsSet; proto.removeItem = w.settingsRemove; };
    w.settingsSet = proto.setItem; w.settingsRemove = proto.removeItem;
    proto.setItem = () => { throw new DOMException('Test quota', 'QuotaExceededError'); };
    proto.removeItem = () => { throw new DOMException('Test blocked', 'SecurityError'); };
  });
  await page.keyboard.press('s');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).settingsFocus);
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').settingsOverlay?.list
    .some((o: any) => o.name === 'system-settings-apply-hint'));
  const inspect = () => page.evaluate(() => {
    const s = (window as any).__birdSquadGame.scene.getScene('MenuScene');
    const list = s.settingsOverlay.list;
    const hint = list.find((o: any) => o.name === 'system-settings-apply-hint');
    const detail = list.find((o: any) => o.name === 'system-settings-section-description');
    return { failed: hint.getData('saveFailed'), detail: detail.text, bottom: detail.getBounds().bottom,
      focus: JSON.parse((window as any).render_game_to_text()).settingsFocus };
  });
  for (const blocked of [true, false]) {
    if (!blocked) await page.evaluate(() => (window as any).restoreSettingsStorage());
    for (let index = 0; index < 16; index++) {
      const before = await inspect();
      if (before.focus.label === 'Controls') {
        await page.keyboard.press('Enter'); await settleCanvas(page);
        await page.keyboard.press('Enter');
        await page.keyboard.press(blocked ? 'c' : 'Enter');
        await settleCanvas(page);
        const controls = await page.evaluate(() => {
          const s = (window as any).__birdSquadGame.scene.getScene('MenuScene');
          const panel = s.settingsOverlay.list.find((o: any) => o.name === 'system-controls-panel');
          return panel.list.filter((o: any) => o.type === 'Text').map((o: any) => o.text).join('\n');
        });
        expect(controls.includes('Could not save.')).toBe(blocked);
        await page.screenshot({ path: info.outputPath(`bindings-${blocked ? 'blocked' : 'saved'}.png`) });
        await page.keyboard.press('Escape');
      } else await page.keyboard.press('ArrowRight');
      await settleCanvas(page);
      const after = await inspect();
      expect(after.focus.label).toBe(before.focus.label);
      expect(after.detail.includes('Session-only.')).toBe(blocked);
      expect(after.bottom).toBeLessThan(600);
      if (blocked) expect(after.failed).toBe(true);
      if (before.focus.label === 'Flashes') await page.screenshot({ path: info.outputPath(`motion-${blocked ? 'blocked' : 'saved'}.png`) });
      await page.keyboard.press('ArrowDown'); await settleCanvas(page);
    }
  }
  expect((await inspect()).failed).toBe(false);
  const preferences = () => page.evaluate(() => {
    const state = JSON.parse((window as any).render_game_to_text());
    return { settings: Object.fromEntries(['motion', 'visualContrast', 'colorCues', 'screenShake', 'flashEffects',
      'screenReader', 'graphics', 'combatPacing', 'animationPacing', 'textPacing'].map(key => [key, state[key]?.preference])),
      audio: Object.fromEntries(['muted', 'musicVolume', 'sfxVolume', 'voiceVolume', 'ambienceVolume'].map(key => [key, state.audio[key]])),
      bindings: state.controls.bindings };
  });
  const saved = await preferences();
  await page.reload();
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  expect(await preferences()).toEqual(saved);
});

test('Settings respects reduced-motion overrides and keeps binding text readable', async ({ page }, info) => {
  await page.addInitScript(() => {
    localStorage.setItem('birdsquad.motionPreference', 'reduced');
    localStorage.setItem('birdsquad.screenShake', 'on');
    localStorage.setItem('birdsquad.flashEffects', 'full');
    localStorage.setItem('birdsquad.screenReader', 'on');
  });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.keyboard.press('s');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').settingsOverlay?.list
    .some((o: any) => o.name === 'system-settings-apply-hint'));
  await page.keyboard.press('PageDown'); await page.keyboard.press('PageDown');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
  const state = () => page.evaluate(() => {
    const s = (window as any).__birdSquadGame.scene.getScene('MenuScene');
    const objects = s.settingsOverlay.list;
    return { text: objects.filter((o: any) => o.visible && o.type === 'Text').map((o: any) => o.text).join('\n'),
      state: JSON.parse((window as any).render_game_to_text()) };
  });
  expect((await state()).text).toContain('Reduced Motion keeps shake off.');
  await expect.poll(() => page.locator('#game-status').textContent()).toContain('Reduced Motion keeps shake off.');
  expect((await state()).text).toContain('Off (Motion)');
  await page.keyboard.press('ArrowRight'); await settleCanvas(page);
  expect((await state()).state.screenShake).toMatchObject({ preference: 'off', enabled: false });
  await page.keyboard.press('ArrowRight'); await settleCanvas(page);
  expect((await state()).text).toContain('Off (Motion)');
  expect((await state()).state.screenShake).toMatchObject({ preference: 'on', enabled: false });
  await page.keyboard.press('ArrowDown'); await settleCanvas(page);
  expect((await state()).text).toContain('Reduced Motion limits flashes.');
  expect((await state()).text).toContain('Reduced (Motion)');
  await page.keyboard.press('PageDown'); await page.keyboard.press('Enter'); await settleCanvas(page);
  for (const size of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(size); await settleCanvas(page);
    for (const section of ['play', 'utility']) {
      // Both arrows cycle tabs; resizing retains the previously selected tab.
      const currentPage = (await state()).state.controls.page;
      if (currentPage !== section) await page.keyboard.press('ArrowRight');
      await settleCanvas(page);
      expect((await state()).state.controls.page).toBe(section);
      await expect.poll(() => page.locator('#game-status').textContent()).toContain(`Controls. ${section}.`);
      const layout = await page.evaluate(() => {
        const s = (window as any).__birdSquadGame.scene.getScene('MenuScene');
        const panel = s.settingsOverlay.list.find((o: any) => o.name === 'system-controls-panel');
        const scale = s.game.canvas.getBoundingClientRect().width / 1280;
        const text = panel.list.filter((o: any) => o.type === 'Text' && o.text.trim());
        return { readable: text.every((o: any) => parseFloat(o.style.fontSize) * scale >= 14),
          fits: text.every((o: any) => { const r = o.getBounds(); return r.left >= 260 && r.right <= 1020 && r.top >= 30 && r.bottom <= 690; }),
          noOverlap: text.every((a: any, i: number) => text.slice(i + 1).every((b: any) => {
            const x = a.getBounds(), y = b.getBounds();
            return x.right <= y.left || y.right <= x.left || x.bottom <= y.top || y.bottom <= x.top;
          })) };
      });
      expect(layout).toEqual({ readable: true, fits: true, noOverlap: true });
      await page.screenshot({ path: info.outputPath(`bindings-${section}-${size.width}.png`) });
    }
  }
});

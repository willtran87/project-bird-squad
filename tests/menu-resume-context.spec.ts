import { test, expect } from '@playwright/test';
import { flockLeaders } from '../src/game/leaders';
import { screenReaderSummary } from '../src/game/screen-reader-summary';
import { settleCanvas } from './helpers/settled-canvas';

test('menu narration reads context only at its relevant action', () => {
  const base = { scene: 'MenuScene', resumeContext: 'The Talon\nRooftop Blocks · Reach the boss',
    collectionGoal: { owned: 10, total: 110 } };
  const primary = screenReaderSummary({ ...base, titleFocus: { current: 'primaryRun', label: 'Continue Run' } });
  expect(primary).toContain('The Talon. Rooftop Blocks');
  expect(primary).not.toContain('Collection path');
  const settings = screenReaderSummary({ ...base, titleFocus: { current: 'settings', label: 'Settings' } });
  expect(settings).not.toContain('The Talon');
  expect(settings).not.toContain('Collection path');
  expect(screenReaderSummary({ ...base, titleFocus: { current: 'codex', label: 'Collection' } })).toContain('Collection path');
});

test('saved-flight context and secondary actions remain readable without changing the save', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleFocus?.current === 'primaryRun');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.isActive('RouteScene'));
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').routeAssetsReady);
  const run = await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').runState);
  for (const leader of flockLeaders) for (let mapIndex = 0; mapIndex < 4; mapIndex++) {
    await page.evaluate(({ run, leaderId, mapIndex }) => {
      const w = window as any;
      localStorage.setItem('birdsquad.run.active', JSON.stringify({ ...run, leaderId, mapIndex }));
      for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
      w.__birdSquadGame.scene.start('MenuScene');
    }, { run, leaderId: leader.id, mapIndex });
    await page.waitForFunction(name => (window as any).__birdSquadGame.scene.getScene('MenuScene')
      .children.getByName('title-resume-context')?.text.startsWith(name), leader.name);
    const layout = await page.evaluate(() => {
      const m = (window as any).__birdSquadGame.scene.getScene('MenuScene');
      const context = m.children.getByName('title-resume-context');
      const bounds = context.getBounds(), logo = m.children.getByName('title-logo').getBounds();
      const primary = m.menuFocusTargets.get('primaryRun').getBounds();
      return { lines: context.getWrappedText().length, left: bounds.left, right: bounds.right,
        logoGap: bounds.top - logo.bottom, buttonGap: primary.top - bounds.bottom };
    });
    expect(layout.lines).toBe(2);
    expect(layout.left).toBeGreaterThan(45);
    expect(layout.right).toBeLessThan(475);
    expect(layout.logoGap).toBeGreaterThan(12);
    expect(layout.buttonGap).toBeGreaterThan(20);
  }
  for (const state of [
    { pendingDistrictPreens: 1, completedRouteNodeIds: [], label: 'Free Preen ready' },
    { pendingDistrictPreens: 0, completedRouteNodeIds: ['m4_boss'], label: 'District cleared' },
  ]) {
    await page.evaluate(state => {
      const saved = JSON.parse(localStorage.getItem('birdsquad.run.active')!);
      localStorage.setItem('birdsquad.run.active', JSON.stringify({ ...saved, ...state }));
      (window as any).__birdSquadGame.scene.getScene('MenuScene').scene.restart();
    }, state);
    await page.waitForFunction(label => (window as any).__birdSquadGame.scene.getScene('MenuScene')
      .children.getByName('title-resume-context')?.text.includes(label), state.label);
  }
  for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(viewport); await settleCanvas(page);
    await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('MenuScene').cameras.main.fadeEffect.isRunning);
    const utility = await page.evaluate(() => {
      const w = window as any, m = w.__birdSquadGame.scene.getScene('MenuScene');
      const scale = w.__birdSquadGame.canvas.getBoundingClientRect().width / 1280;
      return m.children.list.filter((o: any) => o.name === 'title-utility-hit').map((o: any) => {
        const label = o.getData('labelObject'), b = o.getBounds(), t = label.getBounds();
        return { font: parseFloat(label.style.fontSize) * scale, hit: b.height * scale,
          inside: t.left >= b.left + 8 && t.right <= b.right - 8, onStage: b.left >= 0 && b.right <= 1280 && b.bottom <= 720 };
      });
    });
    for (const item of utility) {
      expect(item.font).toBeGreaterThanOrEqual(15.5);
      expect(item.hit).toBeGreaterThanOrEqual(44);
      expect(item.inside).toBe(true); expect(item.onStage).toBe(true);
    }
    await page.screenshot({ path: info.outputPath(`resume-${viewport.width}.png`) });
  }
  const savedBefore = await page.evaluate(() => localStorage.getItem('birdsquad.run.active'));
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').setupOpen)).toBe(true);
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').children.getByName('title-resume-context').visible)).toBe(false);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.run.active'))).toBe(savedBefore);
  expect(errors).toEqual([]);
});

test('flight setup gives every leader and difficulty a readable, non-overlapping explanation', async ({ page }, info) => {
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleFocus?.current === 'primaryRun');
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('MenuScene').cameras.main.fadeEffect.isRunning);
  for (const leader of flockLeaders) {
    await page.evaluate(id => {
      const m = (window as any).__birdSquadGame.scene.getScene('MenuScene');
      m.showLeaderTooltip(id, 640);
    }, leader.id);
    await page.waitForFunction(name => (window as any).__birdSquadGame.scene.getScene('MenuScene').leaderTooltip
      ?.getByName('title-leader-description-title')?.text.startsWith(name), leader.name);
    const bounds = await page.evaluate(() => {
      const m = (window as any).__birdSquadGame.scene.getScene('MenuScene');
      const title = m.leaderTooltip.getByName('title-leader-description-title').getBounds();
      const body = m.leaderTooltip.getByName('title-leader-description-body').getBounds();
      return { title: { top: title.top, bottom: title.bottom }, body: { top: body.top, bottom: body.bottom, left: body.left, right: body.right },
        choices: m.leaderPanels.map((p: any) => {
          const find = (name: string) => m.children.list.find((o: any) => o.name === name && o.getData('leaderId') === p.id).getBounds();
          const name = find('title-leader-name'), detail = find('title-leader-detail'), box = p.rect.getBounds();
          return { nameFits: name.left >= box.left && name.right <= box.right && name.top >= box.top,
            gap: detail.top - name.bottom, detailFits: detail.left >= box.left && detail.right <= box.right && detail.bottom <= box.bottom };
        }) };
    });
    expect(bounds.title.top).toBeGreaterThanOrEqual(312);
    expect(bounds.body.top - bounds.title.bottom).toBeGreaterThanOrEqual(8);
    expect(bounds.body.bottom).toBeLessThan(406);
    expect(bounds.body.left).toBeGreaterThanOrEqual(90); expect(bounds.body.right).toBeLessThanOrEqual(1190);
    for (const choice of bounds.choices) {
      expect(choice.nameFits).toBe(true); expect(choice.detailFits).toBe(true); expect(choice.gap).toBeGreaterThanOrEqual(6);
    }
    await page.screenshot({ path: info.outputPath(`leader-${leader.id}-2560.png`) });
  }
  // Qualify full descriptions as well as the initially locked requirements.
  for (const leader of flockLeaders) {
    await page.evaluate(id => {
      const m = (window as any).__birdSquadGame.scene.getScene('MenuScene');
      if (!m.menuAccount.unlockedLeaders.includes(id)) m.menuAccount.unlockedLeaders.push(id);
      m.showLeaderTooltip(id, 640);
    }, leader.id);
    await page.waitForFunction(signature => (window as any).__birdSquadGame.scene.getScene('MenuScene').leaderTooltip
      ?.getByName('title-leader-description-body')?.text.includes(signature), leader.signatureText);
    expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').leaderTooltip
      .getByName('title-leader-description-body').getBounds().bottom)).toBeLessThan(406);
  }
  await page.evaluate(() => {
    localStorage.setItem('birdsquad.maxTier', '6');
    const m = (window as any).__birdSquadGame.scene.getScene('MenuScene'); m.hideLeaderTooltip(); m.stepDifficulty(6);
  });
  for (const size of [{ width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(size); await settleCanvas(page);
    expect(await page.evaluate(() => {
      const m = (window as any).__birdSquadGame.scene.getScene('MenuScene');
      return [...m.runModeViews.values()].every((v: any) => {
        const b = v.hit.getBounds(), d = v.detail.getBounds(), l = v.label.getBounds();
        return d.left >= b.left + 8 && d.right <= b.right - 8 && d.bottom <= b.bottom - 8 && d.top >= l.bottom + 8;
      });
    })).toBe(true);
    await page.screenshot({ path: info.outputPath(`setup-${size.width}.png`) });
  }
});

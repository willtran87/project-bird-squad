import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { settleCanvas } from './helpers/settled-canvas';

test.use({ hasTouch: true });

const signalGroups: string[][] = ['alpha-signals', 'map02-content', 'map03-content', 'map04-content']
  .map(file => JSON.parse(readFileSync(new URL(`../data/game/${file}.json`, import.meta.url), 'utf8')).signals.map((s: any) => s.id));

async function boot(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any, [maps, generate, hash] = w.__routeAudit;
    const seed = Array.from({ length: 100 }, (_, i) => `event-clarity-${i}`).find(seed =>
      ['basin', 'nest', 'cache', 'signal', 'rival'].every(type => generate(maps[0], hash(seed, 0)).nodes.some((n: any) => n.type === type)));
    await w.__birdSquadEnsureScene('RouteScene');
    w.__birdSquadGame.scene.start('RouteScene', { runState: { seed, leaderId: 'fledgling',
      deck: [{ id: 'major_00' }, { id: 'wands_ace' }, { id: 'pentacles_04' }], currentHp: 20, scrap: 999,
      completedRouteNodeIds: [], routeLog: [], supplies: [], routeMarks: [] } });
    w.__birdSquadGame.scene.stop('MenuScene');
  });
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).assetReadiness?.fullArt);
}

async function tap(page: Page, name: string) {
  const point = await page.evaluate(name => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const b = r.children.getByName(name).getBounds(), c = r.game.canvas.getBoundingClientRect();
    return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720 };
  }, name);
  await page.touchscreen.tap(point.x, point.y); await settleCanvas(page);
}

test('event choices beneath native recovery remain untouched by mouse, touch and keyboard', async ({ page }) => {
  await boot(page); await page.setViewportSize({ width: 1000, height: 560 });
  await page.evaluate(() => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
    r.openNodeChoices(w.__birdSquadCurrentMap().nodes.find((n: any) => n.type === 'basin'));
  });
  const before = await page.evaluate(() => JSON.stringify((window as any).__birdSquadGame.scene.getScene('RouteScene').runState));
  for (const input of ['mouse', 'touch', 'keyboard']) {
    await page.evaluate(() => dispatchEvent(new Event('vite:preloadError')));
    const activate = async (name: string) => {
      const button = page.getByRole('button', { name, exact: true });
      if (input === 'mouse') await button.click();
      else if (input === 'touch') await button.tap();
      else { await button.focus(); await page.keyboard.press('Enter'); }
      await settleCanvas(page);
      expect(await page.evaluate(() => JSON.stringify((window as any).__birdSquadGame.scene.getScene('RouteScene').runState))).toBe(before);
    };
    await activate('Reload options');
    await activate('Cancel reload');
    await expect(page.locator('#update-recovery')).toHaveCount(0);
  }
  await tap(page, 'route-event-details-hit');
  expect(await page.evaluate(() => !!(window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('route-event-reader'))).toBe(true);
});

for (let group = 0; group < signalGroups.length; group++) test(`event outcome catalog group ${group + 1} preserves projections, cancellation and repeat guards`, async ({ page }, info) => {
  await boot(page);
  const report = await page.evaluate(({ ids, includeServices }) => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene'), nodes = w.__birdSquadCurrentMap().nodes;
    const clone = (v: any) => structuredClone(v);
    const baseline = clone(r.runState), render = r.renderAll, restart = r.scene.restart;
    // Keep the actual transaction implementation; isolate rendering/scene scheduling
    // for the exhaustive state matrix. Separate tests exercise real browser lifecycles.
    r.renderAll = () => {}; r.scene.restart = () => {};
    const digest = (s: any) => JSON.stringify({ hp: s.currentHp, scrap: s.scrap,
      deck: s.deck.map((c: any) => ({ id: c.id, upgraded: !!c.upgraded })), supplies: s.supplies,
      marks: s.routeMarks, next: s.nextCombat ?? {}, signals: s.signalChoices ?? [] });
    const failures: string[] = [], seen: string[] = [], available = new Set<string>(), authored = new Set<string>();
    let locked = 0, committed = 0, cancelled = 0, pickerRollbacks = 0;
    const signal = nodes.find((n: any) => n.type === 'signal'), payload = signal.payloadId;
    const fixtures = [...ids.map(id => ({ node: signal, payload: id })), ...(includeServices
      ? ['basin', 'nest', 'cache'].map(type => ({ node: nodes.find((n: any) => n.type === type), payload: undefined })) : [])];
    const reset = (state: string) => {
      r.runState = clone(baseline); r.runState.scrap = state === 'poor' ? 0 : 999;
      r.runState.currentHp = state === 'poor' ? 1 : state === 'full' ? 38 : 20;
      r.runState.supplies = state === 'full' ? ['feather_splint', 'signal_flare'] : [];
      r.runState.routeMarks = state === 'full' ? ['cache_divining_hook', 'wire_map', 'blue_cup_token'] : state === 'funded' ? ['quiet_landing'] : [];
      r.pendingRouteReward = undefined; r.cardPickerMode = undefined; r.cardPickerContext = undefined;
      r.routeCardPickerRestoreState = undefined; r.routeCardRewardChoices = []; r.routeSupplyRewardChoices = [];
      r.routeRewardArmedCardId = undefined; r.routeSupplyRewardArmedId = undefined;
    };
    try {
      for (const fixture of fixtures) for (const state of ['funded', 'poor', 'full']) {
        if (fixture.payload) fixture.node.payloadId = fixture.payload;
        reset(state);
        const keys = r.nodeChoiceList(fixture.node).map((c: any) => c.key);
        for (const key of keys) {
          const label = `${fixture.payload ?? fixture.node.type}/${key}/${state}`;
          const identity = `${fixture.payload ?? fixture.node.type}/${key}`; authored.add(identity);
          reset(state); r.openNodeChoices(fixture.node);
          const before = clone(r.runState), choice = r.nodeChoiceList(fixture.node).find((c: any) => c.key === key);
          r.chooseNodeOption(key); seen.push(label);
          if (choice.locked) {
            locked++;
            if (digest(r.runState) !== digest(before) || r.pendingRouteReward) failures.push(`${label}: locked mutation`);
            continue;
          }
          available.add(identity);
          if (!choice.effects.length) {
            if (!r.runState.completedRouteNodeIds.includes(fixture.node.id)) failures.push(`${label}: decline not completed`);
            if (digest(r.runState) !== digest(before)) failures.push(`${label}: decline changed resources`);
            const completed = JSON.stringify(r.runState);
            r.chooseNodeOption(key); r.claimRouteReward();
            if (JSON.stringify(r.runState) !== completed) failures.push(`${label}: repeated decline changed state`);
            continue;
          }
          if (digest(r.runState) !== digest(before)) failures.push(`${label}: preview spent resources`);
          const first = clone(r.pendingRouteReward);
          if (!first) { failures.push(`${label}: missing preview`); continue; }
          r.chooseNodeOption(key);
          if (JSON.stringify(r.pendingRouteReward) !== JSON.stringify(first)) failures.push(`${label}: repeated choice changed preview`);
          r.cancelRouteCardReward(); cancelled++;
          if (digest(r.runState) !== digest(before) || !r.nodeChoiceOpen) failures.push(`${label}: cancel mismatch`);
          r.chooseNodeOption(key);
          if (JSON.stringify(r.pendingRouteReward.projectedState) !== JSON.stringify(first.projectedState)) failures.push(`${label}: cancel rerolled outcome`);
          const expected = clone(r.pendingRouteReward.projectedState);
          const commit = (updateExpected = true) => {
            if (r.routeCardRewardChoices.length) {
              const id = r.routeCardRewardChoices[0].id;
              if (updateExpected) expected.deck.push({ id });
              r.chooseRouteRewardCard(id);
            } else if (r.routeSupplyRewardChoices.length > 1) r.chooseRouteSupplyReward(r.routeSupplyRewardChoices[0]);
            else r.claimRouteReward();
          };
          commit();
          if (digest(r.runState) !== digest(expected)) failures.push(`${label}: commit differs from preview`);
          if (r.cardPickerMode) {
            const mode = r.cardPickerMode, count = r.cardPickerRemainingPicks;
            r.cancelRouteCardPicker(); pickerRollbacks++;
            if (digest(r.runState) !== digest(before)) failures.push(`${label}: picker rollback mismatch`);
            r.chooseNodeOption(key); commit(false);
            for (let pick = 0; pick < count && r.cardPickerMode; pick++) {
              const entry = r.pickerEligibleCards(mode, 'route')[0];
              if (!entry) break;
              if (mode === 'preen') expected.deck[entry.index].upgraded = true;
              else expected.deck.splice(entry.index, 1);
              r.applyCardPick(entry.index);
            }
          }
          committed++;
          if (digest(r.runState) !== digest(expected)) failures.push(`${label}: final selected outcome mismatch`);
          if (!r.runState.completedRouteNodeIds.includes(fixture.node.id)) failures.push(`${label}: completion missing`);
          const after = digest(r.runState);
          r.claimRouteReward(); r.chooseNodeOption(key); r.chooseRouteRewardCard('major_00');
          if (digest(r.runState) !== after) failures.push(`${label}: repeated commit mutated state`);
        }
      }
    } finally { signal.payloadId = payload; r.renderAll = render; r.scene.restart = restart; r.runState = baseline; }
    for (const id of authored) if (!available.has(id)) failures.push(`${id}: no available outcome exercised`);
    return { seen, authored: authored.size, locked, committed, cancelled, pickerRollbacks, failures };
  }, { ids: signalGroups[group], includeServices: group === 0 });
  await info.attach('outcome-catalog', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
  expect(report.failures).toEqual([]); expect(report.committed).toBeGreaterThan(0); expect(report.cancelled).toBe(report.committed);
});

for (const failed of [false, true]) test(`event reward ${failed ? 'failed' : 'delayed'} module has readable touch cancellation and checkpoint recovery`, async ({ page }, info) => {
  let release!: () => void; const gate = new Promise<void>(resolve => release = resolve);
  await page.route('**/route-reward-overlay-*.js', async route => { if (failed) await route.abort('failed'); else { await gate; await route.continue(); } });
  try {
    await boot(page);
    const before = await page.evaluate(() => {
      const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
      r.openNodeChoices(w.__birdSquadCurrentMap().nodes.find((n: any) => n.type === 'basin'));
      const before = JSON.stringify(r.runState); r.chooseNodeOption('refill_supplies'); return before;
    });
    if (failed) {
      await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').routeRewardOverlayFailed);
      await expect(page.getByRole('dialog', { name: 'Download recovery' })).toBeVisible();
      // The native modal correctly blocks the canvas; retire it before testing
      // the decision's own cancellation, then reopen recovery through its control.
      await page.getByRole('button', { name: 'Keep playing', exact: true }).tap();
      await settleCanvas(page);
    }
    for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
      await page.setViewportSize({ width, height }); await settleCanvas(page);
      const geometry = await page.evaluate(() => {
        const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), scale = r.game.canvas.getBoundingClientRect().width / 1280;
        const title = r.children.getByName('route-reward-module-title'), hint = r.children.getByName('route-reward-module-hint'), close = r.children.getByName('route-reward-module-close');
        return { primary: parseFloat(title.style.fontSize) * scale, secondary: parseFloat(hint.style.fontSize) * scale,
          width: close.width * scale, height: close.height * scale,
          gap: hint.getBounds().top - title.getBounds().bottom, closeGap: close.getBounds().top - hint.getBounds().bottom };
      });
      expect(geometry.primary).toBeGreaterThanOrEqual(16); expect(geometry.secondary).toBeGreaterThanOrEqual(14);
      expect(geometry.width).toBeGreaterThanOrEqual(44); expect(geometry.height).toBeGreaterThanOrEqual(44);
      expect(geometry.gap).toBeGreaterThanOrEqual(8); expect(geometry.closeGap).toBeGreaterThanOrEqual(8);
      await page.screenshot({ path: info.outputPath(`reward-module-${width}.png`) });
    }
    await tap(page, 'route-reward-module-close');
    expect(await page.evaluate(() => JSON.stringify((window as any).__birdSquadGame.scene.getScene('RouteScene').runState))).toBe(before);
    release(); await page.unrouteAll({ behavior: 'wait' });
    if (!failed) await page.waitForFunction(() => !!(window as any).__birdSquadGame.scene.getScene('RouteScene').routeRewardOverlayModule);
    await settleCanvas(page);
    expect(await page.evaluate(() => !!(window as any).__birdSquadGame.scene.getScene('RouteScene').pendingRouteReward)).toBe(false);
    if (failed) {
      const checkpoint = await page.evaluate(() => localStorage.getItem('birdsquad.run.active'));
      expect(checkpoint).not.toBeNull();
      await page.evaluate(() => {
        const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
        r.openNodeChoices(w.__birdSquadCurrentMap().nodes.find((n: any) => n.type === 'basin'));
        r.chooseNodeOption('refill_supplies');
      });
      // Reopening retries the failed import and presents its native recovery
      // owner again. Close that owner before navigating the canvas action rail.
      await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').routeRewardOverlayFailed);
      await expect(page.getByRole('dialog', { name: 'Download recovery' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: 'Download recovery' })).toHaveCount(0);
      await settleCanvas(page);
      await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
      try {
        await expect(page.getByRole('button', { name: 'Keep playing', exact: true })).toBeFocused();
      } catch (error) {
        await info.attach('recovery-focus', { contentType: 'application/json', body: JSON.stringify(await page.evaluate(() => ({
          active: document.activeElement?.outerHTML, dialog: document.querySelector('#update-recovery')?.outerHTML,
          owner: (window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('route-reward-module-owner')?.getData('actionFocus'),
        }))) });
        throw error;
      }
      await page.keyboard.press('Escape');
      expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene')
        .children.getByName('route-reward-module-owner').getData('actionFocus').label)).toBe('Recovery options');
      await page.keyboard.press('Enter');
      await page.getByRole('button', { name: 'Reload options', exact: true }).click();
      await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Reload saved checkpoint', exact: true }).click()]);
      await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
      expect(await page.evaluate(() => localStorage.getItem('birdsquad.run.active'))).toBe(checkpoint);
      await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').continueRun());
      await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).assetReadiness?.fullArt);
      await page.evaluate(() => {
        const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
        r.openNodeChoices(w.__birdSquadCurrentMap().nodes.find((n: any) => n.type === 'basin'));
        r.chooseNodeOption('refill_supplies');
      });
      await page.waitForFunction(() => !!(window as any).__birdSquadGame.scene.getScene('RouteScene').routeRewardOverlayModule);
    }
  } finally { release(); await page.unrouteAll({ behavior: 'wait' }); }
});

for (const family of ['basin', 'cache', 'nest', 'signal']) test(`event ${family} commits once through real controls and survives reload`, async ({ page }, info) => {
  await boot(page); await page.setViewportSize({ width: 1000, height: 560 });
  const expected = await page.evaluate(family => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
    const node = w.__birdSquadCurrentMap().nodes.find((n: any) => n.type === family);
    if (family === 'signal') node.payloadId = 'faded_chalk_line';
    r.openNodeChoices(node);
    const keys: Record<string, string> = { basin: 'recover', cache: 'cache_scrap', nest: 'preen', signal: 'repaint' };
    r.chooseNodeOption(keys[family]);
    return { nodeId: node.id, run: structuredClone(r.pendingRouteReward.projectedState) };
  }, family);
  await page.waitForFunction(() => !!(window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('route-reward-claim-hit'));
  await settleCanvas(page);
  // Pause/Settings and the outcome reader must own a retained confirmation hit.
  const guarded = await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), hit = r.children.getByName('route-reward-claim-hit');
    const before = JSON.stringify(r.runState);
    for (const flag of ['pauseOverlayOpen', 'settingsOverlayOpen']) { r[flag] = true; hit.emit('pointerdown'); r[flag] = false; }
    return JSON.stringify(r.runState) === before && !!r.pendingRouteReward;
  });
  expect(guarded).toBe(true);
  await page.screenshot({ path: info.outputPath(`${family}-review-1000.png`) });
  await tap(page, 'route-reward-claim-hit');
  if (family === 'nest') {
    await page.waitForFunction(() => !!(window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('card-picker-card-hit'));
    await tap(page, 'card-picker-card-hit');
    expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').runState.deck.some((c: any) => c.upgraded))).toBe(false);
    await tap(page, 'card-picker-card-hit');
    await expect(page.getByRole('dialog', { name: 'Choose this bird’s Preen' })).toBeVisible();
    await page.getByRole('button', { name: 'Choose Shelter', exact: true }).tap();
    expected.run.deck[0].upgraded = true;
    expected.run.deck[0].preenBranch = 'shelter';
  }
  await page.waitForFunction(id => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return r.runState.completedRouteNodeIds.includes(id) && !r.pendingRouteReward && !r.cardPickerMode && r.routeEssentialAssetsReady;
  }, expected.nodeId);
  const digest = (r: any) => ({ hp: r.currentHp, scrap: r.scrap, deck: r.deck.map((c: any) => ({ id: c.id, upgraded: !!c.upgraded, preenBranch: c.preenBranch })),
    supplies: r.supplies, marks: r.routeMarks, next: r.nextCombat ?? {}, signals: r.signalChoices });
  const actual = await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').runState);
  expect(digest(actual)).toEqual(digest(expected.run));
  await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); r.claimRouteReward(); r.claimRouteReward();
  });
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').runState)).toEqual(actual);
  await expect.poll(() => page.evaluate(id => JSON.parse(localStorage.getItem('birdsquad.run.active') ?? '{}').completedRouteNodeIds?.includes(id), expected.nodeId)).toBe(true);
  await page.reload();
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').continueRun());
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).scene === 'RouteScene'
    && JSON.parse((window as any).render_game_to_text()).assetReadiness?.fullArt);
  const restored = await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').runState);
  expect(digest(restored)).toEqual(digest(actual));
  expect(restored.completedRouteNodeIds.filter((id: string) => id === expected.nodeId)).toHaveLength(1);
});

test('event rival decline and challenge handoffs happen only once', async ({ page }) => {
  await boot(page);
  const declined = await page.evaluate(() => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene'), n = w.__birdSquadCurrentMap().nodes.find((n: any) => n.type === 'rival');
    r.openNodeChoices(n); r.chooseNodeOption('decline'); r.chooseNodeOption('decline'); return n.id;
  });
  await page.waitForFunction(id => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return r.scene.isActive() && r.runState.completedRouteNodeIds.includes(id) && r.routeEssentialAssetsReady;
  }, declined);
  const result = await page.evaluate(async () => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
    await w.__birdSquadEnsureScene('BattleScene');
    const n = w.__birdSquadCurrentMap().nodes.find((n: any) => n.type === 'rival');
    // Exercise the alternate branch from the same deterministic encounter fixture.
    r.runState.completedRouteNodeIds = r.runState.completedRouteNodeIds.filter((id: string) => id !== n.id);
    r.openNodeChoices(n); const before = { hp: r.runState.currentHp, scrap: r.runState.scrap };
    r.chooseNodeOption('challenge_rival'); r.chooseNodeOption('challenge_rival');
    return { before, after: { hp: r.runState.currentHp, scrap: r.runState.scrap },
      wagers: r.runState.routeLog.filter((s: string) => s.includes("Take Caldra's wager")).length };
  });
  expect(result.after).toEqual(result.before); expect(result.wagers).toBe(1);
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.isActive('BattleScene'));
});

import { test, expect, type Page } from '@playwright/test';

const state = (page: Page) => page.evaluate(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}'));
async function start(page: Page, key: string, data?: unknown) {
  await page.evaluate(async ({ key, data }) => {
    const w = window as any;
    await w.__birdSquadEnsureScene(key);
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start(key, data);
  }, { key, data });
  await page.waitForFunction(key => {
    const s = (window as any).__birdSquadGame.scene.getScene(key);
    return s.scene.isActive() && (key !== 'RouteScene' || s.routeEssentialAssetsReady)
      && (key !== 'BattleScene' || s.fxLayer?.active && s.hand?.length && !s.combatAnimationPending);
  }, key);
}
async function hit(page: Page, key: string, name: string) {
  const p = await page.evaluate(({key, name}) => {
    const s = (window as any).__birdSquadGame.scene.getScene(key);
    const all = (items: any[]): any[] => items.flatMap(o => [o, ...all(o.list ?? [])]);
    const o = all(s.children.list).find(o => o.name === name && o.input?.enabled);
    if (!o) throw Error(`Missing ${name}`);
    const b = o.getBounds(); return { x: b.centerX, y: b.centerY };
  }, { key, name });
  const b = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(b.x + p.x * b.width / 1280, b.y + p.y * b.height / 720, { delay: 50 });
}
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('/');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').scene === 'MenuScene');
});

test('polish: readable combat, safe preselection, pause and end turn', async ({page}, info) => {
  test.setTimeout(120_000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await start(page, 'RouteScene');
  for (const v of [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}]) {
    await page.setViewportSize(v);
    await page.screenshot({path:info.outputPath(`route-${v.width}.png`)});
  }
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await state(page)).pauseOverlayOpen).toBe(true);
  expect((await state(page)).confirmExitOpen).not.toBe(true);
  await page.screenshot({path:info.outputPath('pause.png')});
  await hit(page, 'RouteScene', 'pause-abandon-hit');
  await expect.poll(async () => (await state(page)).confirmExitOpen).toBe(true);
  expect((await state(page)).scene).toBe('RouteScene');
  await page.keyboard.press('Escape'); // cancel abandonment without leaving the run
  await page.keyboard.press('Escape'); // return to pause
  await page.keyboard.press('Escape');
  const data = await page.evaluate(() => ({
    runState: (window as any).__birdSquadGame.scene.getScene('RouteScene').runState,
    routeNodeId: (window as any).__birdSquadCurrentMap().nodes.find((n: any) => n.type === 'street').id,
  }));
  await start(page, 'BattleScene', data);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.cardPreview?.active;
  })).toBe(true);
  for (const v of [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}]) {
    await page.setViewportSize(v);
    await page.screenshot({path:info.outputPath(`combat-${v.width}.png`)});
    expect(await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      const all = (items: any[]): any[] => items.flatMap(o => [o, ...all(o.list ?? [])]);
      return all(b.handLayer.list).filter(o => o.name === 'combat-card-readable-summary').every(o => parseInt(o.style.fontSize) >= 16);
    })).toBe(true);
  }
  const result = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const before = b.statCardsPlayed;
    b.playCardAnimated(b.hand[0], b.enemies[0].id);
    const next = b.hand[0];
    b.onCardClicked(next.instanceId);
    b.onCardClicked(next.instanceId);
    return { before, after: b.statCardsPlayed, selected: b.selectedInstanceId, next: next.instanceId, locked: b.combatAnimationPending };
  });
  expect(result.after).toBe(result.before + 1);
  expect(result.selected).toBe(result.next);
  expect(result.locked).toBe(true);
  await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('BattleScene').combatAnimationPending);
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').statCardsPlayed)).toBe(result.after);
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').selectedInstanceId)).toBe(result.next);
  await page.keyboard.press('Escape'); // cancel selection
  await page.keyboard.press('Escape'); // pause
  await expect.poll(async () => (await state(page)).paused).toBe(true);
  await page.keyboard.press('Escape');
  const turn = (await state(page)).turn;
  await hit(page, 'BattleScene', 'combat-roost-hit');
  await expect.poll(async () => (await state(page)).combatAnimationPending).toBe(true);
  await page.waitForFunction(turn => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.turn > turn && !b.combatAnimationPending;
  }, turn);
  expect(errors).toEqual([]);
});

test('polish: every focused card stays above the hand', async ({ page }, info) => {
  await start(page, 'CodexScene');
  await start(page, 'BattleScene', { routeNodeId: 'm1_entry' });
  const bounds = await page.evaluate(() => {
    const g = (window as any).__birdSquadGame;
    const b = g.scene.getScene('BattleScene');
    return g.scene.getScene('CodexScene').allCards().flatMap((card: any) => [false, true].flatMap(upgraded =>
      [false, true].map(molt => {
        b.flock.molt = molt;
        b.showCardPreview({ ...card, upgraded });
        const r = b.cardPreview.getBounds();
        return { id: card.id, upgraded, molt, top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      })));
  });
  expect(bounds.length).toBeGreaterThanOrEqual(440);
  for (const r of bounds) {
    expect(r.top, r.id).toBeGreaterThanOrEqual(100);
    expect(r.bottom, r.id).toBeLessThanOrEqual(440);
    expect(r.left, r.id).toBeGreaterThanOrEqual(0);
    expect(r.right, r.id).toBeLessThanOrEqual(480);
  }
  await page.screenshot({ path: info.outputPath('focused-card-bounds.png') });
  const hud = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.flock.molt = false;
    b.hideCardPreview();
    b.flockSuitCounts = () => ({ plumes: 5, quills: 5, basins: 5, nests: 5 });
    b.renderAll();
    const all = (items: any[]): any[] => items.flatMap(o => [o, ...all(o.list ?? [])]);
    const objects = all(b.children.list);
    const flow = objects.find(o => o.name === 'combat-flow-rail').getBounds();
    return objects.filter(o => o.name === 'combat-suit-keystone-chip-frame' || o.name === 'combat-suit-keystone-chip-frame-fallback')
      .map(o => ({ left: o.getBounds().left, flowRight: flow.right }));
  });
  expect(hud).toHaveLength(4);
  expect(hud.every(r => r.left > r.flowRight)).toBe(true);
  await page.screenshot({ path: info.outputPath('hud-keystones.png') });
});

test('polish: explicit reward commitment and useful outcome review', async ({page}, info) => {
  test.setTimeout(90_000);
  await start(page, 'RouteScene');
  const data = await page.evaluate(() => ({runState:(window as any).__birdSquadGame.scene.getScene('RouteScene').runState,
    routeNodeId:(window as any).__birdSquadCurrentMap().nodes.find((n:any)=>n.type==='street').id}));
  await start(page, 'BattleScene', data);
  await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.enemies.forEach((e:any)=>e.hp=0); b.checkOutcome();
    if (b.mode === 'waymarkReward') b.chooseWaymarkReward(b.waymarkChoices[0].id);
  });
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').rewardPresentationReady());
  await hit(page, 'BattleScene', 'reward-card-take-hit');
  expect((await state(page)).mode).toBe('cardReward');
  for (const v of [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}]) {
    await page.setViewportSize(v); await page.screenshot({path:info.outputPath(`reward-${v.width}.png`)});
  }
  await hit(page, 'BattleScene', 'reward-card-take-hit');
  await expect.poll(async () => (await state(page)).mode).not.toBe('cardReward');
  await start(page, 'BattleScene', data);
  await page.evaluate(() => { const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'); b.flock.hp=0;b.checkOutcome();b.renderAll(); });
  await page.waitForFunction(() => !!(window as any).__birdSquadGame.scene.getScene('BattleScene').bossDossierModule);
  for (const v of [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}]) {
    await page.setViewportSize(v); await page.screenshot({path:info.outputPath(`outcome-${v.width}.png`)});
  }
});

test('polish: Flight Lab hides tools without losing them', async ({page}, info) => {
  test.setTimeout(90_000);
  await page.evaluate(() => {
    const cards=['major_00','wands_ace','wands_fledgling','swords_ace','swords_fledgling','cups_ace','cups_fledgling','pentacles_04','pentacles_fledgling','aviary_25'];
    const account={runs:1,unlockedLeaders:['fledgling'],cardCollection:Object.fromEntries(cards.map(id=>[id,{timesClaimed:1,firstAcquiredAt:1780000000000,firstSource:'combat_reward'}])),decks:[{id:'polish',lineageId:'polish',revision:1,name:'Rooftop Study',leaderId:'fledgling',cards:cards.map(id=>({id,upgraded:false})),createdAt:1780000000000,updatedAt:1780000000000,favorite:false,archived:false,runMode:'quick'}]};
    Object.assign(account, { discoveredCards: cards });
    localStorage.setItem('birdsquad.account',JSON.stringify(account));localStorage.setItem('birdsquad.account.backup',JSON.stringify(account));
  });
  await page.reload();
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').scene === 'MenuScene');
  await start(page,'ProfileScene');
  await hit(page,'ProfileScene','profile-folios-tab-hit');
  await hit(page,'ProfileScene','profile-folio-lab-hit');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('ProfileScene')
    .children.list.filter((o: any) => o.name === 'profile-flight-lab-card-art').length === 5);
  for (const v of [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}]) {
    await page.setViewportSize(v);await page.screenshot({path:info.outputPath(`lab-${v.width}.png`)});
  }
  await hit(page,'ProfileScene','profile-flight-lab-tools-hit');
  await page.screenshot({path:info.outputPath('lab-tools.png')});
  await hit(page,'ProfileScene','profile-flight-lab-collection-signals-hit');
  await page.keyboard.press('Escape');
  await hit(page,'ProfileScene','profile-flight-lab-practice-hit');
  await expect.poll(async () => (await state(page)).practice).toBe(true);
});

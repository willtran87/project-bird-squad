import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';
import { installVirtualController, pressController, controllerButton } from './helpers/virtual-controller';

const sizes = [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }];
async function boot(page: Page, key: string) {
  await page.setViewportSize(sizes[0]);
  await installVirtualController(page);
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async key => {
    const w = window as any;
    await w.__birdSquadEnsureScene(key);
    w.__birdSquadGame.scene.stop('MenuScene');
    w.__birdSquadGame.scene.start(key, key === 'BattleScene' ? { routeNodeId: 'm1_entry' } : undefined);
  }, key);
  await page.waitForFunction(key => {
    const s = (window as any).__birdSquadGame.scene.getScene(key);
    return key === 'RouteScene' ? s.routeEssentialAssetsReady : s.hand.length && s.battleHudRendererModule && !s.combatIntroActive && !s.combatAnimationPending;
  }, key);
  await settleCanvas(page);
}
async function focus(page: Page, key: string, name = 'pause-actions') {
  return page.evaluate(({key, name}) => {
    const s = (window as any).__birdSquadGame.scene.getScene(key);
    const walk = (list: any[]): any[] => list.flatMap(o => [o, ...(o.list ? walk(o.list) : [])]);
    return walk(s.children.list).find(o => o.name === name && o.active)?.getData('actionFocus')?.label;
  }, {key, name});
}
async function snapshot(page: Page, key: string) {
  return page.evaluate(key => {
    const s = (window as any).__birdSquadGame.scene.getScene(key);
    return JSON.stringify({run:s.runState, turn:s.turn, energy:s.energy, hand:s.hand?.map((c:any)=>c.instanceId),
      target:s.selectedEnemyIndex, choice:s.controllerChoiceIndex, selected:s.selectedNodeId, contract:s.districtContractFocusIndex});
  }, key);
}

for (const key of ['RouteScene', 'BattleScene']) test(`${key}: pause owns keyboard/controller input and restores Settings focus`, async ({ page }, info) => {
  test.setTimeout(120000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await boot(page, key);
  for (const size of sizes) {
    await page.setViewportSize(size);
    const before = await snapshot(page, key);
    await page.keyboard.press('p');
    await expect.poll(() => focus(page,key)).toBe('Resume');
    const corner = await page.locator('canvas').boundingBox();
    await page.mouse.click(corner!.x + corner!.width * .89, corner!.y + corner!.height * .92);
    expect(await snapshot(page,key)).toBe(before);
    await page.keyboard.press('Tab');
    await expect.poll(() => focus(page,key)).toBe('Settings');
    await page.keyboard.press('Enter');
    await page.waitForFunction(key => (window as any).__birdSquadGame.scene.getScene(key).settingsOverlayOpen, key);
    await settleCanvas(page);
    await page.keyboard.press('Escape');
    await expect.poll(() => focus(page,key)).toBe('Settings');
    await page.screenshot({ path: info.outputPath(`${key}-restored-${size.width}.png`) });
    await page.keyboard.press('Shift+Tab');
    await expect.poll(() => focus(page,key)).toBe('Resume');
    // Background hotkeys, shoulder buttons and stick clicks must not mutate play.
    for (const button of [2,3,4,5,7,10,11]) await pressController(page,button);
    for (const code of ['r','x','ArrowUp','ArrowDown']) await page.keyboard.press(code);
    expect(await snapshot(page,key)).toBe(before);
    // Resume while holding A. The route's polling loop must not also commit a node.
    await controllerButton(page,0,true);
    await expect.poll(() => focus(page,key)).toBeUndefined();
    await settleCanvas(page);
    expect(await snapshot(page,key)).toBe(before);
    await controllerButton(page,0,false);
    expect(await page.evaluate(key => (window as any).__birdSquadGame.scene.getScene(key).scene.isActive(), key)).toBe(true);
  }
  // Start toggles exactly once per physical press; reopening has only one listener.
  await pressController(page,9);
  await expect.poll(() => focus(page,key)).toBe('Resume');
  await pressController(page,13);
  await expect.poll(() => focus(page,key)).toBe('Settings');
  await pressController(page,1);
  await expect.poll(() => focus(page,key)).toBeUndefined();
  expect(errors).toEqual([]);
});

test('delayed lesson loading stays readable, rejects repeats and cannot resurrect a closed guide', async ({ page }, info) => {
  let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  let requests = 0;
  await page.route('**/practice-lessons-*.js', async route => {
    requests++;
    await barrier;
    await route.continue();
  });
  try {
    await page.setViewportSize(sizes[0]);
    await installVirtualController(page);
    await page.goto('./');
    await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
    await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').openHelpOverlay());
    await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').helpOverlay?.list.some((o:any)=>o.getData?.('label')==='Practice lessons'));
    await page.keyboard.press('Enter');
    await expect.poll(() => requests).toBe(1);
    for (const size of sizes) {
      await page.setViewportSize(size); await settleCanvas(page);
      expect(await page.evaluate(() => {
        const root=(window as any).__birdSquadGame.scene.getScene('MenuScene').helpOverlay;
        const hit=root.list.find((o:any)=>o.getData?.('label')==='Practice lessons');
        return {status:hit.getData('status'),input:!!hit.input?.enabled,label:hit.getData('caption').text};
      })).toEqual({status:'loading',input:false,label:'Opening lessons…'});
      await page.screenshot({path:info.outputPath(`lesson-pending-${size.width}.png`)});
      await page.keyboard.press('Enter'); await pressController(page,0);
      expect(requests).toBe(1);
    }
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('MenuScene').helpOverlay);
    const response = page.waitForResponse('**/practice-lessons-*.js');
    release(); await response; await settleCanvas(page);
    expect(await page.evaluate(() => {
      const s=(window as any).__birdSquadGame.scene.getScene('MenuScene');
      return {active:s.scene.isActive(),overlay:!!s.helpOverlay};
    })).toEqual({active:true,overlay:false});
  } finally { release(); }
});

test('exclusive pause honors remapped confirm/back and retires its owner on scene shutdown', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('birdsquad.controlBindings', JSON.stringify({version:1,bindings:{confirm:'KeyJ',back:'KeyK'}})));
  await boot(page,'RouteScene');
  await page.keyboard.press('p');
  await expect.poll(() => focus(page,'RouteScene')).toBe('Resume');
  await page.keyboard.press('Tab'); await page.keyboard.press('j');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').settingsOverlayOpen);
  await settleCanvas(page); await page.keyboard.press('k');
  await expect.poll(() => focus(page,'RouteScene')).toBe('Settings');
  await page.keyboard.press('k');
  await expect.poll(() => focus(page,'RouteScene')).toBeUndefined();
  await page.keyboard.press('p');
  await expect.poll(() => focus(page,'RouteScene')).toBe('Resume');
  await page.evaluate(() => {
    const g=(window as any).__birdSquadGame;
    g.scene.stop('RouteScene'); g.scene.start('RouteScene');
  });
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);
  await page.keyboard.press('p');
  await expect.poll(() => focus(page,'RouteScene')).toBe('Resume');
  await page.keyboard.press('Tab');
  await expect.poll(() => focus(page,'RouteScene')).toBe('Settings');
  await page.keyboard.press('k');
  await expect.poll(() => focus(page,'RouteScene')).toBeUndefined();
});

test('pause preserves an underlying deck reader selection, sort and filter on all navigation inputs', async ({ page }) => {
  await boot(page,'RouteScene');
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').openDeckOverlay());
  await settleCanvas(page);
  const deck = () => page.evaluate(() => {
    const s=(window as any).__birdSquadGame.scene.getScene('RouteScene');
    return {card:s.inspectedCardId,sort:s.deckReviewSort,filter:s.deckReviewFilter,scroll:s.cardReviewScroll};
  });
  const before=await deck();
  await page.keyboard.press('p');
  await expect.poll(() => focus(page,'RouteScene')).toBe('Resume');
  for (const key of ['Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','PageDown','c','v']) await page.keyboard.press(key);
  for (const button of [12,13,14,15,2,3,4,5]) await pressController(page,button);
  expect(await deck()).toEqual(before);
  await pressController(page,1);
  await expect.poll(() => focus(page,'RouteScene')).toBeUndefined();
  expect(await deck()).toEqual(before);
  await page.keyboard.press('ArrowDown'); await settleCanvas(page);
  expect((await deck()).card).not.toBe(before.card);
});

test('run-exit confirmation defaults to safety and blocks route polling until the controller is released', async ({ page }, info) => {
  await boot(page,'RouteScene');
  const before = await snapshot(page,'RouteScene');
  for (const size of sizes) {
    await page.setViewportSize(size);
    await page.keyboard.press('p');
    await expect.poll(() => focus(page,'RouteScene')).toBe('Resume');
    await page.keyboard.press('Shift+Tab');
    await expect.poll(() => focus(page,'RouteScene')).toBe('Abandon Flight…');
    await page.keyboard.press('Enter');
    await expect.poll(() => focus(page,'RouteScene','confirm-exit-actions')).toBe('Keep Playing');
    await page.screenshot({ path: info.outputPath(`safe-confirmation-${size.width}.png`) });
    await pressController(page,15);
    await expect.poll(() => focus(page,'RouteScene','confirm-exit-actions')).toBe('Abandon Run');
    await pressController(page,14);
    await controllerButton(page,0,true);
    await expect.poll(() => focus(page,'RouteScene','confirm-exit-actions')).toBeUndefined();
    expect(await snapshot(page,'RouteScene')).toBe(before);
    await controllerButton(page,0,false);
  }
});

test('shared status controls distinguish loading/error/armed and reject hidden-container activation', async ({ page }, info) => {
  await page.setViewportSize(sizes[0]);
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').openHelpOverlay());
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').helpOverlay?.list.some((o:any)=>o.getData?.('label')==='Practice lessons'));
  for (const size of sizes) {
    await page.setViewportSize(size);
    for (const status of ['loading','error','armed','idle']) {
      const state = await page.evaluate(status => {
        const s = (window as any).__birdSquadGame.scene.getScene('MenuScene');
        const hit = s.helpOverlay.list.find((o:any)=>o.getData?.('label')==='Practice lessons');
        hit.setData('statusLabel', status==='loading'?'Opening lessons…':status==='error'?'Reload lessons':'Confirm lesson');
        hit.setData('status',status);
        const label = hit.getData('caption'), b=hit.getBounds(), t=label.getBounds();
        return { enabled:!!hit.input?.enabled, status:hit.getData('status'), text:label.text,
          fits:t.left>=b.left+4&&t.right<=b.right-4&&t.top>=b.top+4&&t.bottom<=b.bottom-4 };
      },status);
      expect(state).toMatchObject({enabled:status!=='loading',status,fits:true});
      expect(state.text).toBe(status==='loading'?'Opening lessons…':status==='error'?'Reload lessons':status==='armed'?'Confirm lesson':'Practice lessons');
      await settleCanvas(page);
      await page.screenshot({path:info.outputPath(`status-${status}-${size.width}.png`)});
    }
  }
  await page.evaluate(() => {
    const s=(window as any).__birdSquadGame.scene.getScene('MenuScene');
    s.helpOverlay.setVisible(false);
    s.helpOverlay.list.find((o:any)=>o.getData?.('label')==='Practice lessons').emit('pointerdown');
  });
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => !!(window as any).__birdSquadGame.scene.getScene('MenuScene').helpOverlay.getData('practiceLoading'))).toBe(false);
});

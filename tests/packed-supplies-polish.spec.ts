import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { settleCanvas } from './helpers/settled-canvas';
const supplies = JSON.parse(readFileSync(new URL('../data/game/alpha-supplies.json', import.meta.url), 'utf8')).supplies;

async function click(page: Page, scene: string, name: string) {
  const p = await page.evaluate(({ scene, name }) => {
    const s = (window as any).__birdSquadGame.scene.getScene(scene);
    const o = (s.root ?? s.children).getByName(name), b = o.getBounds(), c = s.game.canvas.getBoundingClientRect();
    return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720 };
  }, { scene, name });
  await page.mouse.move(p.x, p.y); await settleCanvas(page);
  await page.mouse.click(p.x, p.y, { delay: 40 }); await settleCanvas(page);
}

for (const scene of ['RouteScene', 'BattleScene']) for (const remapped of [false, true]) {
  test(`Packed Supplies are readable and deliberate in ${scene}, remapped=${remapped}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
    if (remapped) await page.addInitScript(() => localStorage.setItem('birdsquad.controlBindings', JSON.stringify({ version: 1, bindings: { confirm: 'KeyK', back: 'KeyB', previous: 'KeyQ', next: 'KeyE' } })));
    const key = remapped ? { confirm: 'k', back: 'b', next: 'e', previous: 'q' } : { confirm: 'Enter', back: 'Escape', next: 'ArrowRight', previous: 'ArrowLeft' };
    await page.setViewportSize({ width: 2560, height: 1600 });
    await page.goto('./');
    await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
    await page.evaluate(async scene => {
      const w = window as any; await w.__birdSquadEnsureScene(scene);
      for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
      w.__birdSquadGame.scene.start(scene, scene === 'BattleScene' ? { routeNodeId: 'm1_entry' } : {});
    }, scene);
    await page.waitForFunction(scene => {
      const s = (window as any).__birdSquadGame.scene.getScene(scene);
      return scene === 'BattleScene' ? s.discardChoiceModule && s.returnChoiceModule && s.hand.length && !s.combatIntroActive && !s.combatAnimationPending : s.routeEssentialAssetsReady;
    }, scene);
    const packed = ['thermos_lid', 'feather_splint', scene === 'BattleScene' ? 'market_iou' : 'bottlecap_popper', 'seed_packet', 'rain_cape', 'spare_pocket', 'storm_lantern', 'return_ticket', 'spare_harness'];
    await page.evaluate(({ scene, packed }) => {
      const s = (window as any).__birdSquadGame.scene.getScene(scene);
      if (scene === 'BattleScene') { s.runSupplies = packed; s.runSupplyCapacity = 10; s.flock.hp = 20; }
      else { s.runState.supplies = packed; s.runState.supplySlots = 10; s.runState.currentHp = 20; }
      s.renderAll();
    }, { scene, packed });
    await settleCanvas(page);
    await page.keyboard.press('x');
    await page.waitForFunction(scene => { const s = (window as any).__birdSquadGame.scene.getScene(scene); return (s.root ?? s.children).getByName('supply-drawer-frame'); }, scene);
    const read = () => page.evaluate(scene => {
      const w = window as any, s = w.__birdSquadGame.scene.getScene(scene), root = s.root ?? s.children;
      return { focus: s.supplyDrawerFocusIndex, armed: s.supplyDrawerArmedIndex ?? null, open: s.supplyDrawerOpen,
        inventory: [...(scene === 'BattleScene' ? s.runSupplies : s.runState.supplies)],
        hint: root.getByName('supply-drawer-command-copy')?.text,
        title: root.getByName('supply-drawer-title')?.text,
        rules: root.getByName('supply-drawer-rules')?.text,
        rows: root.list.filter((o: any) => /^supply-drawer-item-\d+$/.test(o.name)).map((o: any) => o.name),
        use: !!root.getByName('supply-drawer-use'), state: JSON.parse(w.render_game_to_text()).supplyDrawer,
      };
    }, scene);
    const press = async (key: string) => { await page.keyboard.press(key); await settleCanvas(page); };
    expect((await read()).inventory).toEqual(packed);
    expect((await read()).state.entries[0].rules).toBe((await read()).rules);
    if (scene === 'BattleScene') {
      const stayed = await page.evaluate(() => {
        const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
        b.enemies.push({ ...b.enemies[0], id: 'drawer-target-fixture' });
        const before = { ends: b.statTurnEnds, target: b.selectedEnemyId, hand: b.hand.map((c: any) => c.instanceId) };
        b.input.gamepad.emit('down', {}, { index: 3 }); // Y must not Roost behind the drawer.
        b.input.gamepad.emit('down', {}, { index: 5 }); // R1 must not retarget a hidden enemy.
        const after = { ends: b.statTurnEnds, target: b.selectedEnemyId, hand: b.hand.map((c: any) => c.instanceId) };
        b.enemies.pop();
        return { before, after };
      });
      expect(stayed.after).toEqual(stayed.before);
    }
    if (!remapped) for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
      await page.setViewportSize({ width, height }); await settleCanvas(page);
      const geometry = await page.evaluate(scene => {
        const s = (window as any).__birdSquadGame.scene.getScene(scene), root = s.root ?? s.children;
        return { rules: root.getByName('supply-drawer-rules').style.fontSize,
          title: root.getByName('supply-drawer-title').style.fontSize,
          hits: root.list.filter((o: any) => /^supply-drawer-(previous|next|use|close|item-\d+)$/.test(o.name)).map((o: any) => o.height * s.game.canvas.getBoundingClientRect().height / 720) };
      }, scene);
      expect(geometry.rules).toBe('22px'); expect(geometry.title).toBe('26px');
      geometry.hits.forEach((height: number) => expect(height).toBeGreaterThanOrEqual(44));
      await page.screenshot({ path: info.outputPath(`packed-${scene}-${width}.png`) });
    }
    await press(key.next); expect((await read()).focus).toBe(1);
    // A stationary pointer over an old row must not pull keyboard focus back.
    await page.mouse.move(240, 220); await settleCanvas(page);
    expect((await read()).focus).toBe(1);
    await press(key.next); expect((await read()).focus).toBe(2);
    expect((await read()).use).toBe(false);
    expect((await read()).hint).toContain('Keep packed');
    await press(key.confirm); expect((await read()).armed).toBeNull();
    expect((await read()).inventory).toEqual(packed);
    await press(key.next); await press(key.next);
    expect((await read()).focus).toBe(4);
    expect((await read()).rows).toEqual(['supply-drawer-item-4', 'supply-drawer-item-5', 'supply-drawer-item-6', 'supply-drawer-item-7']);
    await click(page, scene, 'supply-drawer-next'); expect((await read()).focus).toBe(5);
    await click(page, scene, 'supply-drawer-previous'); expect((await read()).focus).toBe(4);
    for (let i = 0; i < 5; i++) await press(key.next);
    expect((await read()).focus).toBe(0);
    const controller = await page.evaluate(scene => {
      const s = (window as any).__birdSquadGame.scene.getScene(scene), gamepad = s.input.gamepad;
      if (scene === 'BattleScene') {
        gamepad.emit('down', {}, { index: 15 }); const next = s.supplyDrawerFocusIndex;
        gamepad.emit('down', {}, { index: 14 });
        return { next, previous: s.supplyDrawerFocusIndex };
      }
      const original = gamepad._pad1;
      try {
        gamepad._pad1 = { connected: true, right: true };
        s.update(); s.update(); s.update();
        const next = s.supplyDrawerFocusIndex;
        gamepad._pad1 = { connected: true, left: true };
        s.update(); s.update(); s.update();
        return { next, previous: s.supplyDrawerFocusIndex };
      } finally { gamepad._pad1 = original; s.controllerButtonsDown.clear(); }
    }, scene);
    expect(controller).toEqual({ next: 1, previous: 0 });
    await settleCanvas(page);
    // Clicking once selects, never consumes; hover must not change an armed item.
    await click(page, scene, 'supply-drawer-item-0');
    expect((await read()).armed).toBe(0); expect((await read()).inventory).toEqual(packed);
    await page.mouse.move(1, 1); await settleCanvas(page);
    await page.screenshot({ path: info.outputPath(`packed-${scene}-armed.png`) });
    await press(key.back); expect((await read()).armed).toBeNull(); expect((await read()).open).toBe(true);
    await press(key.confirm); expect((await read()).armed).toBe(0);
    expect((await read()).hint).toContain(remapped ? 'K: use' : 'Enter: use');
    const paused = await page.evaluate(scene => {
      const s = (window as any).__birdSquadGame.scene.getScene(scene);
      const snapshot = () => JSON.stringify({ inventory: scene === 'BattleScene' ? s.runSupplies : s.runState.supplies, armed: s.supplyDrawerArmedIndex, focus: s.supplyDrawerFocusIndex });
      const before = snapshot();
      for (const flag of ['pauseOverlayOpen', 'settingsOverlayOpen']) {
        s[flag] = true;
        if (scene === 'BattleScene') { s.moveBattleSupplyFocus(1); s.requestBattleSupplyUse(0); }
        else { s.moveRouteSupplyFocus(1); s.requestRouteSupplyUse(0); }
        s[flag] = false;
      }
      return { before, after: snapshot() };
    }, scene);
    expect(paused.after).toBe(paused.before);
    await page.evaluate(scene => (window as any).__birdSquadGame.scene.getScene(scene).input.gamepad.emit('down', {}, { index: 7 }), scene);
    expect((await read()).hint).toContain('A: use');
    expect((await read()).inventory).toEqual(packed);
    await click(page, scene, 'supply-drawer-close');
    expect((await read()).armed).toBeNull(); expect((await read()).inventory).toEqual(packed);
    await click(page, scene, 'supply-drawer-use'); expect((await read()).armed).toBe(0);
    await click(page, scene, 'supply-drawer-use'); expect((await read()).inventory).toEqual(packed.slice(1));
    // Every authored item, including unavailable phases, exposes complete rules.
    if (!remapped) {
      const measured = await page.evaluate(({ scene, supplies }) => {
        const s = (window as any).__birdSquadGame.scene.getScene(scene), out: any[] = [];
        for (const supply of supplies) {
          if (scene === 'BattleScene') s.runSupplies = [supply.id]; else s.runState.supplies = [supply.id];
          s.supplyDrawerOpen = true; s.supplyDrawerFocusIndex = 0; s.supplyDrawerArmedIndex = undefined; s.renderAll();
          const root = s.root ?? s.children, body = root.getByName('supply-drawer-rules'), title = root.getByName('supply-drawer-title');
          out.push({ id: supply.id, text: body.text, bottom: body.getBounds().bottom, right: body.getBounds().right,
            title: title.text, titleBottom: title.getBounds().bottom,
            nameBottom: root.getByName('supply-drawer-item-name').getBounds().bottom });
        }
        return out;
      }, { scene, supplies });
      expect(measured).toHaveLength(supplies.length);
      for (const item of measured) {
        expect(item.text, item.id).not.toMatch(/…|\w+\(/); expect(item.text.length).toBeGreaterThan(5);
        expect(item.bottom, item.id).toBeLessThanOrEqual(497); expect(item.right, item.id).toBeLessThanOrEqual(1138);
        expect(item.title, item.id).toBe(supplies.find((s: any) => s.id === item.id).name);
        expect(item.titleBottom, item.id).toBeLessThanOrEqual(239); expect(item.nameBottom, item.id).toBeLessThanOrEqual(235);
      }
      await page.evaluate(scene => {
        const s = (window as any).__birdSquadGame.scene.getScene(scene);
        if (scene === 'BattleScene') s.runSupplies = []; else s.runState.supplies = [];
        s.supplyDrawerFocusIndex = 0; s.renderAll();
      }, scene);
      await settleCanvas(page); expect((await read()).use).toBe(false); expect((await read()).rows).toEqual([]);
      const empty = await page.evaluate(scene => {
        const s = (window as any).__birdSquadGame.scene.getScene(scene), root = s.root ?? s.children;
        return { height: root.getByName('supply-drawer-frame').height, close: root.getByName('supply-drawer-close').height * s.game.canvas.getBoundingClientRect().height / 720 };
      }, scene);
      expect(empty.height).toBe(340); expect(empty.close).toBeGreaterThanOrEqual(44);
      await page.screenshot({ path: info.outputPath(`packed-${scene}-empty.png`) });
      await click(page, scene, 'supply-drawer-close'); expect((await read()).open).toBe(false);
    }
    expect(errors).toEqual([]);
  });
}

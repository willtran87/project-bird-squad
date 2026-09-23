import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { settleCanvas } from './helpers/settled-canvas';

const ids: string[] = JSON.parse(readFileSync(new URL('../data/game/alpha-route-marks.json', import.meta.url), 'utf8')).routeMarks.map((m: any) => m.id);
test.use({ hasTouch: true });

async function tap(page: Page, key: string, name: string) {
  const p = await page.evaluate(({ key, name }) => {
    const s = (window as any).__birdSquadGame.scene.getScene(key);
    const b = (s.root ?? s.children).getByName(name).getBounds(), c = s.game.canvas.getBoundingClientRect();
    return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720 };
  }, { key, name });
  await page.touchscreen.tap(p.x, p.y); await settleCanvas(page);
}

for (const key of ['RouteScene', 'BattleScene']) for (const remapped of [false, true]) {
  test(`${key} Waymark shelf reaches every artifact without losing reading, remapped=${remapped}`, async ({ page }, info) => {
    test.setTimeout(120_000); // Full shelf traversal and three-viewport qualification.
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(remapped => {
      if (remapped) localStorage.setItem('birdsquad.controlBindings', JSON.stringify({ version: 1,
        bindings: { previous: 'KeyJ', next: 'KeyL', roost: 'KeyG', back: 'KeyB' } }));
    }, remapped);
    await page.setViewportSize({ width: 2560, height: 1600 }); await page.goto('./');
    await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
    await page.evaluate(async key => {
      const w = window as any; await w.__birdSquadEnsureScene(key);
      for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
      w.__birdSquadGame.scene.start(key, key === 'BattleScene' ? { routeNodeId: 'm1_entry' } : {});
    }, key);
    await page.waitForFunction(key => {
      const s = (window as any).__birdSquadGame.scene.getScene(key);
      return key === 'RouteScene' ? s.routeEssentialAssetsReady : s.battleHandRendererModule && !s.combatInteractionLocked();
    }, key);
    await page.evaluate(({ key, ids }) => {
      const s = (window as any).__birdSquadGame.scene.getScene(key);
      if (key === 'RouteScene') { s.runState.routeMarks = ids; s.openWaymarkDrawer(); }
      else { s.routeMarks = ids; s.onCardClicked(s.hand[0].instanceId); s.toggleBattleWaymarks(); }
    }, { key, ids });
    await page.waitForFunction(key => {
      const s = (window as any).__birdSquadGame.scene.getScene(key);
      return (s.root ?? s.children).getByName('route-waymark-shelf-next');
    }, key);
    await page.waitForFunction(({ key, ids }) => ids.every(id =>
      (window as any).__birdSquadGame.scene.getScene(key).textures.exists(`waymark-thumb-${id}`)), { key, ids });
    const stable = () => page.evaluate(key => {
      const s = (window as any).__birdSquadGame.scene.getScene(key);
      return JSON.stringify({ run: s.runState, card: s.selectedInstanceId, target: s.selectedEnemyId,
        turn: s.turn, energy: s.energy, hand: s.hand, draw: s.drawPile, enemies: s.enemies, flock: s.flock });
    }, key);
    const read = () => page.evaluate(key => {
      const s = (window as any).__birdSquadGame.scene.getScene(key), owner = s.root ?? s.children;
      const state = JSON.parse((window as any).render_game_to_text()).waymarkReview;
      return { selected: state.selected.id, pinned: state.pinned?.id, page: state.reading.page,
        position: owner.getByName('route-waymark-shelf-position')?.text,
        visible: owner.list.filter((o: any) => o.name.startsWith('route-waymark-tile-') && o.input).map((o: any) => o.name.slice('route-waymark-tile-'.length)),
        next: !!owner.getByName('route-waymark-shelf-next')?.input?.enabled,
        previous: !!owner.getByName('route-waymark-shelf-previous')?.input?.enabled,
        hint: owner.getByName('route-waymark-reader-hints').text };
    }, key);
    const before = await stable();
    const initial = await read(); expect(initial.previous).toBe(false); expect(initial.visible).toHaveLength(6);
    await tap(page, key, 'route-waymark-pin-hit');
    await tap(page, key, `route-waymark-tile-${initial.visible[1]}`);
    await tap(page, key, 'route-waymark-reader-next');
    const reading = await read(); expect(reading.page).toBe(2); expect(reading.pinned).toBe(initial.selected);
    for (const size of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
      await page.setViewportSize(size); await settleCanvas(page);
      const geometry = await page.evaluate(key => {
        const s = (window as any).__birdSquadGame.scene.getScene(key), owner = s.root ?? s.children;
        const panel = owner.getByName('route-waymark-drawer-panel'), bounds = panel.getBounds();
        const list = owner.list.slice(owner.list.indexOf(panel));
        const labels = list.filter((o: any) => o.type === 'Text');
        const overlap = labels.flatMap((a: any, i: number) => labels.slice(i + 1).filter((b: any) => {
          const x = a.getBounds(), y = b.getBounds(); return x.left < y.right && x.right > y.left && x.top < y.bottom && x.bottom > y.top;
        }).map((b: any) => [a.text, b.text]));
        const scale = s.game.canvas.getBoundingClientRect().height / 720;
        return { overlap, contained: labels.every((o: any) => { const b = o.getBounds(); return b.left >= bounds.left && b.right <= bounds.right && b.top >= bounds.top && b.bottom <= bounds.bottom; }),
          targets: list.filter((o: any) => o.input?.enabled).every((o: any) => o.width * scale >= 44 && o.height * scale >= 44),
          railClear: owner.getByName('route-waymark-scroll-rail-frame').getBounds().top > owner.getByName('route-waymark-close-hit').getBounds().bottom,
          hudBelow: key !== 'RouteScene' || owner.list.indexOf(owner.getByName('hud-waymarks-chip')) < owner.list.indexOf(panel) };
      }, key);
      expect(geometry).toEqual({ overlap: [], contained: true, targets: true, railClear: true, hudBelow: true });
      if (!remapped) await page.screenshot({ path: info.outputPath(`comparison-${size.width}.png`) });
      await tap(page, key, 'route-waymark-shelf-next'); await tap(page, key, 'route-waymark-shelf-previous');
      expect(await read()).toEqual(reading); expect(await stable()).toBe(before);
    }
    const seen = new Set(initial.visible);
    for (let row = 0; row < Math.ceil(ids.length / 3) && (await read()).next; row++) {
      await tap(page, key, 'route-waymark-shelf-next');
      const state = await read(); state.visible.forEach((id: string) => seen.add(id));
      expect([state.selected, state.pinned, state.page]).toEqual([reading.selected, reading.pinned, reading.page]);
    }
    expect((await read()).next).toBe(false);
    expect([...seen].sort()).toEqual([...ids].sort());
    expect((await read()).position).toContain(`/ ${ids.length}`);
    await tap(page, key, `route-waymark-tile-${ids.at(-1)}`);
    expect((await read()).selected).toBe(ids.at(-1)); expect((await read()).page).toBe(1);
    await page.keyboard.press(remapped ? 'j' : 'ArrowLeft'); await settleCanvas(page);
    expect((await read()).hint).toContain(remapped ? 'J / L: choose · G: pin' : 'Left / Right: choose');
    await page.evaluate(key => (window as any).__birdSquadGame.scene.getScene(key).input.gamepad.emit('down', {}, { index: 5 }), key);
    await settleCanvas(page); expect((await read()).hint).toContain('LB / RB: rules');
    expect(await stable()).toBe(before);
    await tap(page, key, 'route-waymark-close-hit');
    expect(await page.evaluate(key => (window as any).__birdSquadGame.scene.getScene(key).waymarkDrawerOpen, key)).toBe(false);
    expect(await stable()).toBe(before); expect(errors).toEqual([]);
    // Empty and single-shelf inventories must not expose misleading navigation.
    for (const count of [6, 0]) {
      await page.evaluate(({ key, ids }) => {
        const s = (window as any).__birdSquadGame.scene.getScene(key);
        if (key === 'RouteScene') { s.runState.routeMarks = ids; s.openWaymarkDrawer(); }
        else { s.routeMarks = ids; s.toggleBattleWaymarks(); }
      }, { key, ids: ids.slice(0, count) });
      await settleCanvas(page);
      const small = await page.evaluate(key => {
        const s = (window as any).__birdSquadGame.scene.getScene(key), owner = s.root ?? s.children;
        return { shelf: !!owner.getByName('route-waymark-shelf-next'),
          tiles: owner.list.filter((o: any) => o.name.startsWith('route-waymark-tile-') && o.input).length,
          empty: owner.list.some((o: any) => o.text?.startsWith('No Waymarks found yet.')) };
      }, key);
      expect(small).toEqual({ shelf: false, tiles: count, empty: count === 0 });
      await tap(page, key, 'route-waymark-close-hit');
    }
    expect(errors).toEqual([]);
  });
}

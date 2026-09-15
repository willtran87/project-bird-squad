import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

for (const remapped of [false, true]) test(`choice hints follow real bindings and device without committing, remapped=${remapped}`, async ({ page }, info) => {
  const errors: string[] = [];
  const obsoleteRequests: string[] = [];
  page.on('request', request => {
    if (/\/card-picker-(?:frame|cost-badge|nameplate-frame|context-plaque)-[^/]+\.webp/.test(request.url())) obsoleteRequests.push(request.url());
  });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const listeners = new Set<EventListenerOrEventListenerObject>();
    const pointerListeners = new Set<EventListenerOrEventListenerObject>();
    const add = document.addEventListener.bind(document);
    const remove = document.removeEventListener.bind(document);
    const captures = (options: boolean | AddEventListenerOptions | undefined) => options === true
      || (typeof options === 'object' && options.capture === true);
    document.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
      if (type === 'keydown' && captures(options)) listeners.add(listener);
      add(type, listener, options);
    }) as typeof document.addEventListener;
    document.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) => {
      if (type === 'keydown' && captures(options)) listeners.delete(listener);
      remove(type, listener, options);
    }) as typeof document.removeEventListener;
    const canvasAdd = HTMLCanvasElement.prototype.addEventListener;
    const canvasRemove = HTMLCanvasElement.prototype.removeEventListener;
    HTMLCanvasElement.prototype.addEventListener = function (type: string, listener: any, options?: any) {
      if (type === 'pointerdown' && captures(options)) pointerListeners.add(listener);
      canvasAdd.call(this, type, listener, options);
    };
    HTMLCanvasElement.prototype.removeEventListener = function (type: string, listener: any, options?: any) {
      if (type === 'pointerdown' && captures(options)) pointerListeners.delete(listener);
      canvasRemove.call(this, type, listener, options);
    };
    (window as any).__choiceCaptureListenerCount = () => listeners.size;
    (window as any).__choicePointerListenerCount = () => pointerListeners.size;
  });
  if (remapped) await page.addInitScript(() => localStorage.setItem('birdsquad.controlBindings', JSON.stringify({
    confirm: 'KeyK', back: 'KeyQ', previous: 'KeyA', next: 'KeyD', roost: 'Backspace',
  })));
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('RouteScene');
    for (const scene of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(scene.scene.key);
    w.__birdSquadGame.scene.start('RouteScene');
  });
  await page.waitForFunction(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return r.routeEssentialAssetsReady && r.cardHoverDetailModule;
  });
  await page.evaluate(() => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
    r.runState.scrap = 999;
    r.openMarketNode({ ...w.__birdSquadCurrentMap().nodes.find((n: any) => n.type !== 'boss'), type: 'market' });
    r.openMarketCardPicker(r.marketUtilityShelf.findIndex((o: any) => o.id === 'preen'), 'preen');
  });
  const snapshot = () => page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return JSON.stringify({ run: r.runState, focus: r.cardPickerFocusIndex, armed: r.cardPickerArmedIndex });
  });
  const initial = await snapshot();
  const hint = () => page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const label = r.children.getByName('card-picker-input-hint');
    const inspect = r.children.getByName('card-picker-card-inspect-binding');
    const b = inspect.getBounds(), h = r.children.getByName('card-picker-card-inspect-hit').getBounds();
    return { text: label.text, mode: label.getData('inputMode'), inspect: inspect.text,
      fits: label.getBounds().right <= 1132 && b.left >= h.left + 8 && b.right <= h.right - 8 };
  });
  expect((await hint()).mode).toBe('pointer');
  for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
    await page.setViewportSize({ width, height }); await settleCanvas(page);
    await page.keyboard.press('Shift');
    const keyboard = await hint();
    expect(keyboard.mode).toBe('keyboard');
    expect(keyboard.text).toContain(remapped ? 'A/D: choose · K: select / confirm' : 'Left/Right: choose · Enter: select / confirm');
    expect(keyboard.text).toContain(remapped ? 'Q: back' : 'Esc: back');
    expect(keyboard.inspect).toBe(remapped ? 'Backspace: full card' : 'R: full card');
    expect(keyboard.fits).toBe(true);
    await page.screenshot({ path: info.outputPath(`picker-${width}-keyboard.png`) });
    // Unassigned pad button signals a device change without selecting anything.
    await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').input.gamepad.emit('down', {}, { index: 10 }));
    expect((await hint()).mode).toBe('controller');
    expect((await hint()).text).toContain('D-pad: choose · A: select / confirm');
    expect((await hint()).inspect).toBe('Y: full card');
    await page.screenshot({ path: info.outputPath(`picker-${width}-controller.png`) });
    const canvas = await page.locator('canvas').boundingBox();
    await page.mouse.click(canvas!.x + 5, canvas!.y + canvas!.height / 2);
    expect((await hint()).mode).toBe('pointer');
    expect(await snapshot()).toBe(initial);
  }
  await page.keyboard.press(remapped ? 'Backspace' : 'r');
  await expect.poll(() => page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').cardPickerInspectionOpen)).toBe(true);
  await page.keyboard.press(remapped ? 'q' : 'Escape');
  expect(await snapshot()).toBe(initial);
  await page.keyboard.press(remapped ? 'k' : 'Enter');
  expect((await hint()).text).toContain(remapped ? 'Q: clear pick' : 'Esc: clear pick');
  await page.keyboard.press(remapped ? 'q' : 'Escape');
  const lifetime = await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const counts = () => [r.input.listenerCount('pointerdown'), r.input.keyboard.listenerCount('keydown'), r.input.gamepad.listenerCount('down')];
    const before = counts(); for (let i = 0; i < 15; i++) r.renderAll();
    return { before, after: counts() };
  });
  expect(lifetime.after).toEqual(lifetime.before);
  const retired = await page.evaluate(() => {
    const state = JSON.parse((window as any).render_game_to_text());
    return ['cardPickerFrame', 'cardPickerCostBadge', 'cardPickerNameplateFrame', 'cardPickerContextPlaque']
      .map(key => ({ loaded: state[key].loaded, rendered: state[key].rendered, count: state[key].count }));
  });
  expect(retired).toEqual(Array.from({ length: 4 }, () => ({ loaded: false, rendered: false, count: 0 })));
  expect(await page.evaluate(() => (window as any).__choiceCaptureListenerCount())).toBe(1);
  expect(await page.evaluate(() => (window as any).__choicePointerListenerCount())).toBe(1);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.stop('RouteScene'));
  await expect.poll(() => page.evaluate(() => (window as any).__choiceCaptureListenerCount())).toBe(0);
  expect(await page.evaluate(() => (window as any).__choicePointerListenerCount())).toBe(0);
  expect(obsoleteRequests).toEqual([]);
  expect(errors).toEqual([]);
});

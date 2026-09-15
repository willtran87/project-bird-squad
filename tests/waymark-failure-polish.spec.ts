import { test, expect } from '@playwright/test';
import marks from '../data/game/alpha-route-marks.json' with { type: 'json' };
import { settleCanvas } from './helpers/settled-canvas';

for (const remapped of [false, true]) test(`failed reward art module retains readable Waymark choices and safe inspection, remapped=${remapped}`, async ({ page }, info) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/assets/render-reward-*.js', route => route.abort('failed'));
  await page.addInitScript(remapped => {
    localStorage.setItem('birdsquad.screenReader', 'on');
    if (remapped) localStorage.setItem('birdsquad.controlBindings', JSON.stringify({ version: 1, bindings: { roost: 'KeyJ', back: 'KeyB', next: 'KeyE' } }));
  }, remapped);
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('BattleScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_boss' });
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.battleHandRendererModule && b.hand.length && !b.combatIntroActive && !b.combatAnimationPending && !b.cameras.main.fadeEffect.isRunning;
  });
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').beginPostCombatRewards());
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.mode === 'waymarkReward' && b.battleRewardRendererFailed;
  });
  const press = async (key: string) => { await page.keyboard.press(key); await settleCanvas(page); };
  const stable = () => page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return JSON.stringify({ mode: b.mode, deck: b.allDeckCards(), marks: b.routeMarks, scrap: b.scrap, armed: b.rewardChoiceArmedId, focus: b.controllerChoiceIndex });
  });
  const reading = () => page.evaluate(() => Boolean((window as any).__birdSquadGame.scene.getScene('BattleScene').combatCardDetail?.active));
  const click = async (name: string) => {
    const p = await page.evaluate(name => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'), o = b.root.getByName(name), r = o.getBounds(), c = b.game.canvas.getBoundingClientRect();
      return { x: c.left + r.centerX * c.width / 1280, y: c.top + r.centerY * c.height / 720 };
    }, name);
    await page.mouse.click(p.x, p.y); await settleCanvas(page);
  };
  for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(viewport); await settleCanvas(page);
    await page.screenshot({ path: info.outputPath(`fallback-${viewport.width}.png`) });
    const geometry = await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      return { descriptions: b.root.list.filter((o: any) => o.name === 'reward-waymark-effect').map((o: any) => ({ size: o.style.fontSize, full: o.text === o.getData('fullText'), bottom: o.getBounds().bottom })),
        read: b.root.list.filter((o: any) => o.name === 'reward-waymark-inspect-hit').map((o: any) => o.height) };
    });
    expect(geometry.descriptions).toHaveLength(3);
    geometry.descriptions.forEach((g: any) => { expect(g.size).toBe('18px'); expect(g.full).toBe(true); expect(g.bottom).toBeLessThan(510); });
    expect(geometry.read).toEqual([58, 58, 58]);
  }
  // Authored descriptions remain complete even without the ceremony chunk.
  const missing = await page.evaluate(marks => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'), original = b.waymarkChoices;
    const failures: string[] = [];
    for (const mark of marks) {
      b.waymarkChoices = [{ ...original[0], name: mark.name, description: mark.description }]; b.renderAll();
      const text = b.root.getByName('reward-waymark-effect');
      if (text.text !== mark.description || text.getBounds().bottom >= 510) failures.push(mark.id);
    }
    b.waymarkChoices = original; b.renderAll(); return failures;
  }, marks.routeMarks);
  expect(missing).toEqual([]);
  await click('reward-waymark-hit'); const before = await stable();
  await click('reward-waymark-inspect-hit'); expect(await reading()).toBe(true); expect(await stable()).toBe(before);
  const notes = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return { text: b.combatCardDetail.getData('pages').map((p: any) => p.body).join(' ').replace(/\s+/g, ' '), notes: b.waymarkRewardBuildObservations[b.waymarkChoices[0].id] };
  });
  for (const note of notes.notes) expect(notes.text).toContain(note.replace(/\s+/g, ' '));
  await click('reward-waymark-hit'); expect(await stable()).toBe(before);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').setBattlePaused(true));
  await press('Enter'); expect(await reading()).toBe(true);
  await press(remapped ? 'b' : 'Escape'); expect(await reading()).toBe(true);
  await press(remapped ? 'b' : 'Escape'); expect(await reading()).toBe(false); expect(await stable()).toBe(before);
  await press(remapped ? 'j' : 'r'); expect(await reading()).toBe(true);
  await press(remapped ? 'e' : 'ArrowRight');
  await page.screenshot({ path: info.outputPath('fallback-reading-1000.png') });
  await press('Enter'); expect(await reading()).toBe(false); expect(await stable()).toBe(before);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').input.gamepad.emit('down', {}, { index: 3 }));
  expect(await reading()).toBe(true);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').input.gamepad.emit('down', {}, { index: 1 }));
  expect(await reading()).toBe(false); expect(await stable()).toBe(before);
  await click('reward-waymark-hit');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').mode !== 'waymarkReward');
  expect(errors).toEqual([]);
});

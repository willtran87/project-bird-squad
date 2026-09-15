import { test, expect } from '@playwright/test';
import marks from '../data/game/alpha-route-marks.json' with { type: 'json' };
import { waymarkBuildRead } from '../src/game/waymark-build-read';
import { settleCanvas } from './helpers/settled-canvas';

test('Waymark advice reads owned executable effects and distinguishes Basin stops', () => {
  const cards = [{ text: 'Friendly prose.', upgraded: false, runtime: {
    effects: ['heal(2)'], moltEffects: [], upgrade: { effects: ['heal(4)', 'spendResonance(1)'] },
  } }];
  const advice = (trigger: string) => waymarkBuildRead({ trigger, familyLabel: 'Safety' }, cards, 0, 0).notes[0];
  expect(advice('onHealFlock')).toContain('1 recovery card');
  expect(advice('onResonanceSpent')).toContain('0 Resonance spenders');
  cards[0].upgraded = true;
  expect(advice('onResonanceSpent')).toContain('1 Resonance spender');
  expect(advice('basinHeal')).toContain('Basin stops');
});

for (const remapped of [false, true]) test(`Waymark decisions are readable and inspection cannot claim, remapped=${remapped}`, async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(remapped => {
    localStorage.setItem('birdsquad.screenReader', 'on');
    if (remapped) localStorage.setItem('birdsquad.controlBindings', JSON.stringify({ version: 1, bindings: { roost: 'KeyJ', back: 'KeyB', next: 'KeyE' } }));
  }, remapped);
  await page.emulateMedia({ reducedMotion: remapped ? 'reduce' : 'no-preference' });
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('BattleScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_boss' });
  });
  await page.waitForFunction(() => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); return b.battleHandRendererModule && b.hand.length && !b.combatIntroActive && !b.combatAnimationPending && !b.cameras.main.fadeEffect.isRunning; });
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').beginPostCombatRewards());
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').root.getByName('reward-waymark-effect'));
  const press = async (key: string) => { await page.keyboard.press(key); await settleCanvas(page); };
  const stable = () => page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return JSON.stringify({ mode: b.mode, deck: b.allDeckCards(), marks: b.routeMarks, scrap: b.scrap, armed: b.rewardChoiceArmedId, focus: b.controllerChoiceIndex });
  });
  const reader = () => page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').combatCardDetail?.getData('kind') ?? null);
  const click = async (name: string) => {
    const p = await page.evaluate(name => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      const o = b.root.getByName(name), r = o.getBounds(), c = b.game.canvas.getBoundingClientRect();
      return { x: c.left + r.centerX * c.width / 1280, y: c.top + r.centerY * c.height / 720 };
    }, name);
    await page.mouse.click(p.x, p.y); await settleCanvas(page);
  };
  for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(viewport); await settleCanvas(page);
    const geometry = await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      return b.root.list.filter((o: any) => o.name === 'reward-waymark-effect').map((o: any) => ({
        size: o.style.fontSize, bottom: o.getBounds().bottom, full: o.text === o.getData('fullText'),
      }));
    });
    expect(geometry).toHaveLength(3);
    geometry.forEach((g: any) => { expect(g.size).toBe('18px'); expect(g.bottom).toBeLessThan(510); expect(g.full).toBe(true); });
    await page.screenshot({ path: info.outputPath(`choices-${viewport.width}.png`) });
  }
  await click('reward-waymark-hit');
  const before = await stable();
  await click('reward-waymark-inspect-hit');
  expect(await reader()).toBe('waymark'); expect(await stable()).toBe(before);
  await click('reward-waymark-hit'); // covered by the modal's pointer shield
  await press(remapped ? 'e' : 'ArrowRight');
  await page.evaluate(() => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); b.requestRewardChoice(b.waymarkChoices[0].id); });
  expect(await stable()).toBe(before);
  await page.screenshot({ path: info.outputPath('read-context-1000.png') });
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').setBattlePaused(true));
  await press('Enter'); expect(await reader()).toBe('waymark');
  await press(remapped ? 'b' : 'Escape'); expect(await reader()).toBe('waymark');
  await press(remapped ? 'b' : 'Escape'); expect(await reader()).toBeNull(); expect(await stable()).toBe(before);
  await press(remapped ? 'j' : 'r'); expect(await reader()).toBe('waymark');
  await press('Enter'); expect(await reader()).toBeNull(); expect(await stable()).toBe(before);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').input.gamepad.emit('down', {}, { index: 3 }));
  expect(await reader()).toBe('waymark');
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').input.gamepad.emit('down', {}, { index: 1 }));
  expect(await reader()).toBeNull();
  // Measure every authored description, without changing real card/Waymark data.
  const clipped = await page.evaluate(marks => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const originals = b.waymarkChoices;
    const failures: string[] = [];
    for (const mark of marks) {
      b.waymarkChoices = [{ ...originals[0], name: mark.name, description: mark.description }];
      b.renderAll();
      const o = b.root.getByName('reward-waymark-effect');
      if (o.text !== mark.description || o.getBounds().bottom >= 510) failures.push(mark.id);
    }
    b.waymarkChoices = originals; b.renderAll(); return failures;
  }, marks.routeMarks);
  expect(clipped).toEqual([]);
  const full = 'Gain 2 Cover, then gain 1 Resonance. '.repeat(40) + 'W'.repeat(90);
  await page.evaluate(full => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.waymarkChoices[0].description = full; b.renderAll();
  }, full);
  await settleCanvas(page); await click('reward-waymark-inspect-hit');
  const pages = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'), r = b.combatCardDetail;
    return r.getData('pages').filter((p: any) => p.heading === 'EFFECT').map((p: any) => p.body).join('');
  });
  expect(pages.replace(/\s/g, '')).toBe(full.replace(/\s/g, ''));
  await press(remapped ? 'b' : 'Escape');
  await click('reward-waymark-hit');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').mode !== 'waymarkReward');
  expect(errors).toEqual([]);
});

import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

async function enterBattle(page: Page, reduced: boolean) {
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.addInitScript(reduced => {
    localStorage.setItem('birdsquad.motionPreference', reduced ? 'reduced' : 'full');
  }, reduced);
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('BattleScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.battleFxPresenterModule && b.hand.length && !b.combatAnimationPending && !b.combatIntroActive;
  });
}

for (const reduced of [false, true]) {
  test(`incoming hits keep one readable result and bounded accents, reduced=${reduced}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await enterBattle(page, reduced);
    for (const amount of [5, 12, 0]) {
      const state = await page.evaluate(amount => {
        const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
        b.time.paused = false; b.tweens.resumeAll(); w.advanceTime(1200);
        b.fxLayer.removeAll(true);
        b.flock.hp = b.flock.maxHp; b.flock.block = amount === 0 ? 20 : 0;
        b.flock.flow = 2; b.flock.exposed = false; b.runDifficulty = 0;
        const enemy = b.enemies[0];
        enemy.damageBonus = 0; enemy.weak = 0; enemy.nextAttackBonus = 0;
        b.damageFlock(enemy, amount || 5, 'Readability check'); b.renderAll(); w.advanceTime(20);
        b.time.paused = true; b.tweens.pauseAll();
        const names = ['combat-enemy-swipe', 'combat-enemy-impact-contact', 'combat-enemy-heavy-contact'];
        return {
          hpLost: b.flock.maxHp - b.flock.hp, block: b.flock.block, flow: b.flock.flow,
          pending: b.combatAnimationPending,
          contacts: b.fxLayer.list.filter((o: any) => names.includes(o.name)).map((o: any) => ({ name: o.name, width: o.displayWidth, alpha: o.alpha })),
          duplicateFlashes: b.fxLayer.list.filter((o: any) => ['combat-impact-flash', 'combat-flock-impact-burst'].includes(o.name)).length,
          numbers: b.fxLayer.list.filter((o: any) => o.name === 'combat-number-feedback').map((o: any) => o.getData('amount')),
        };
      }, amount);
      for (const width of amount === 12 ? [2560, 1440, 1000] : [2560]) {
        await page.setViewportSize({ width, height: width === 2560 ? 1600 : width === 1440 ? 900 : 560 });
        await settleCanvas(page);
        await page.screenshot({ path: info.outputPath(`hit-${amount}-${width}.png`) });
      }
      expect.soft(state.hpLost).toBe(amount);
      expect.soft(state.block).toBe(amount === 0 ? 15 : 0);
      expect.soft(state.flow).toBe(amount === 0 ? 2 : 0);
      expect.soft(state.pending).toBe(false);
      expect.soft(state.contacts).toHaveLength(amount === 0 ? 0 : amount >= 8 ? 3 : 2);
      expect.soft(state.contacts.every(c => c.width <= 285 && c.alpha <= 0.58)).toBe(true);
      expect.soft(state.duplicateFlashes).toBe(0);
      expect.soft(state.numbers).toEqual(amount ? [amount] : []);
      const remaining = await page.evaluate(() => {
        const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
        b.time.paused = false; b.tweens.resumeAll(); w.advanceTime(500);
        return b.fxLayer.list.filter((o: any) => ['combat-enemy-swipe', 'combat-enemy-impact-contact', 'combat-enemy-heavy-contact'].includes(o.name)).length;
      });
      expect.soft(remaining).toBe(0);
    }
    expect(errors).toEqual([]);
  });

  test(`generated effects retire their entire owned batch exactly once, reduced=${reduced}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await enterBattle(page, reduced);
    const result = await page.evaluate(() => {
      const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
      w.advanceTime(1500); b.fxLayer.removeAll(true);
      // Use the actual loaded generated-contact texture, with a glow to exercise batch ownership.
      b.combatEnemyHeavyContact(400, 300, 700);
      const texture = b.fxLayer.getByName('combat-enemy-heavy-contact').texture.key;
      w.advanceTime(1500);
      const emit = (name: string) => b.combatGeneratedFx(texture, name, 400, 300, 200, 70,
        { alpha: 0.58, glowAlpha: 0.18, lifeMs: 400, reducedLifeMs: 200, delayMs: 0 });
      emit('owned-a'); emit('owned-b');
      const a = b.fxLayer.list.filter((o: any) => o.name === 'owned-a');
      const other = b.fxLayer.list.filter((o: any) => o.name === 'owned-b').length;
      a[0].destroy();
      const partial = { live: a.filter((o: any) => o.active).length, count: b.activeGeneratedFxSprites, other };
      b.fxLayer.removeAll(true);
      const immediate = b.activeGeneratedFxSprites;
      const tweens = a.reduce((n: number, o: any) => n + b.tweens.getTweensOf(o).length, 0);
      for (let i = 0; i < 30; i++) { emit('repeat'); b.fxLayer.removeAll(true); }
      const repeated = b.activeGeneratedFxSprites;
      emit('fresh');
      const fresh = b.fxLayer.list.filter((o: any) => o.name === 'fresh');
      const freshAlpha = Math.max(...fresh.map((o: any) => o.alpha));
      w.advanceTime(1000);
      const final = b.activeGeneratedFxSprites;
      emit('baseline');
      const baseline = b.activeGeneratedFxSprites;
      b.playerCardFxBaseline = new Set(b.fxLayer.list);
      emit('card-transient'); b.retirePlayerCardFxWindow(true);
      const preserved = b.activeGeneratedFxSprites;
      b.fxLayer.removeAll(true); w.advanceTime(1000);
      return { partial, immediate, tweens, repeated, freshAlpha, final: b.activeGeneratedFxSprites,
        natural: final, baseline, preserved, active: fresh.filter((o: any) => o.active).length };
    });
    expect.soft(result.partial.live).toBe(0);
    expect.soft(result.partial.count).toBe(result.partial.other);
    expect.soft(result.immediate).toBe(0);
    expect.soft(result.tweens).toBe(0);
    expect.soft(result.repeated).toBe(0);
    expect.soft(result.freshAlpha).toBeCloseTo(0.58);
    expect.soft(result.final).toBe(0);
    expect.soft(result.natural).toBe(0);
    expect.soft(result.preserved).toBe(result.baseline);
    expect.soft(result.active).toBe(0);
    expect(errors).toEqual([]);
  });
}

import { test, expect } from '@playwright/test';

for (const reduced of [false, true]) {
  for (const width of [2560, 1440, 1000]) {
    test(`enemy cadence keeps ordered impacts readable at ${width}, reduced ${reduced}`, async ({ page }, info) => {
      const errors: string[] = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      await page.setViewportSize({ width, height: width === 2560 ? 1600 : width === 1440 ? 900 : 560 });
      await page.addInitScript(reduced => {
        localStorage.setItem('birdsquad.combatPace', 'standard');
        localStorage.setItem('birdsquad.motionPreference', reduced ? 'reduced' : 'full');
      }, reduced);
      await page.goto('./');
      await page.waitForFunction(() => (window as any).__birdSquadEnsureScene);
      await page.evaluate(async () => {
        const w = window as any;
        await w.__birdSquadEnsureScene('BattleScene');
        for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
        w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
      });
      await page.waitForFunction(() => {
        const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
        return b.scene.isActive() && b.fxLayer?.active && b.hand?.length && !b.combatAnimationPending;
      });
      await page.evaluate(() => {
        const w = window as any;
        const b = w.__birdSquadGame.scene.getScene('BattleScene');
        b.hand = []; b.flock.hp = b.flock.maxHp; b.flock.block = 0;
        const first = b.enemies[0];
        first.damageBonus = 0; first.weak = 0; first.nextAttackBonus = 0;
        const second = { ...first, id: `${first.id}-cadence`, runtime: { ...first.runtime } };
        const moves = [
          { id: 'cadence-strike', label: 'Quick Strike', effects: ['damage(4)'] },
          { id: 'cadence-support', label: 'Take Cover', effects: ['gainCover(6)'] },
        ];
        for (const [i, enemy] of [first, second].entries()) {
          enemy.runtime = { ...enemy.runtime, moves: [moves[i]], attackPattern: { type: 'cycle', moveIds: [moves[i].id] } };
          enemy.intentIndex = 0;
        }
        b.enemies = [first, second]; b.renderAll();
        b.endTurnAnimated(); b.time.paused = true; b.tweens.pauseAll();
      });
      for (const beat of ['windup', 'release', 'impact']) {
        const state = await page.evaluate(beat => {
          const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
          b.time.paused = false; b.tweens.resumeAll();
          for (let i = 0; i < 400 && b.combatEnemyTurnBeat !== beat; i++) w.advanceTime(10);
          // Render the phase without letting screenshot latency consume it.
          b.renderAll();
          b.time.paused = true; b.tweens.pauseAll();
          return { beat: b.combatEnemyTurnBeat, hp: b.flock.hp, maxHp: b.flock.maxHp,
            staleForecast: Boolean(b.root.getByName('combat-incoming-forecast-label')),
            contacts: b.fxLayer.list.filter((o: any) => o.name === 'combat-enemy-impact-contact').map((o: any) => ({ width: o.displayWidth, alpha: o.alpha })),
            swipes: b.fxLayer.list.filter((o: any) => o.name === 'combat-enemy-swipe').map((o: any) => ({ width: o.displayWidth, alpha: o.alpha })),
            names: b.fxLayer.list.map((o: any) => o.name) };
        }, beat);
        expect(state.beat).toBe(beat);
        expect(state.staleForecast).toBe(false);
        if (beat === 'impact') {
          expect(state.contacts).toHaveLength(1);
          expect(state.contacts[0].width).toBeLessThanOrEqual(180);
          expect(state.contacts[0].alpha).toBeLessThanOrEqual(0.58);
          expect(state.swipes).toHaveLength(1);
          expect(state.swipes[0].width).toBeLessThanOrEqual(179);
          expect(state.swipes[0].alpha).toBeLessThanOrEqual(0.46);
        }
        expect(state.hp).toBe(beat === 'impact' ? state.maxHp - 4 : state.maxHp);
        if (beat === 'windup') expect(state.names).toContain('combat-enemy-attack-tell');
        else expect(state.names).not.toContain('combat-enemy-attack-tell');
        await page.screenshot({ path: info.outputPath(`${beat}.png`) });
      }
      const result = await page.evaluate(() => {
        const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
        b.time.paused = false; b.tweens.resumeAll();
        for (let i = 0; i < 500 && b.combatAnimationPending; i++) w.advanceTime(10);
        const firstDone = { pending: b.combatAnimationPending, hp: b.flock.hp, cover: b.enemies[1].block };
        const started = b.time.now, turn = b.turn, hp = b.flock.hp;
        b.hand = []; b.endTurnAnimated();
        const order: string[] = [];
        let last = '', earlyDamage = false;
        for (let i = 0; i < 500 && b.combatAnimationPending; i++) {
          const beat = `${b.combatEnemyTurnMove}:${b.combatEnemyTurnBeat}`;
          if (beat !== last) { order.push(beat); last = beat; }
          if (b.combatEnemyTurnMove === 'Quick Strike' && ['windup', 'release'].includes(b.combatEnemyTurnBeat)) earlyDamage ||= b.flock.hp !== hp;
          w.advanceTime(10);
        }
        const elapsed = b.time.now - started;
        const impactNames = ['combat-enemy-impact-contact', 'combat-enemy-swipe', 'combat-flock-impact-burst'];
        const lingeringImpacts = b.fxLayer.list.filter((o: any) => impactNames.includes(o.name)).length;
        b.combatEnemyImpactContact(450, 300, 600); b.combatEnemySwipe(700, 300, 450, 300); b.combatFlockImpactBurst(450, 300);
        const owned = b.fxLayer.list.filter((o: any) => impactNames.includes(o.name));
        b.fxLayer.removeAll(true); w.advanceTime(500);
        const impactCleanup = owned.length === 3 && owned.every((o: any) => !o.active && b.tweens.getTweensOf(o).length === 0);
        return { firstDone, elapsed, turnDelta: b.turn - turn,
          hpLoss: hp - b.flock.hp, cover: b.enemies[1].block, order, earlyDamage,
          lingeringImpacts, impactCleanup,
          pending: b.combatAnimationPending, hand: b.hand.length };
      });
      expect(result.firstDone.pending).toBe(false);
      expect(result.firstDone.cover).toBe(6);
      expect(result.pending).toBe(false);
      expect(result.turnDelta).toBe(1);
      expect(result.hand).toBeGreaterThan(0);
      expect(result.hpLoss).toBe(4);
      expect(result.cover).toBe(6);
      expect(result.earlyDamage).toBe(false);
      expect(result.lingeringImpacts).toBe(0); expect(result.impactCleanup).toBe(true);
      expect(result.order.indexOf('Quick Strike:impact')).toBeLessThan(result.order.indexOf('Take Cover:windup'));
      expect(result.elapsed).toBeLessThan(reduced ? 1750 : 2250);
      console.log(`${width} reduced=${reduced}: repeated two-enemy turn ${Math.round(result.elapsed)}ms`);
      expect(errors).toEqual([]);
      await page.screenshot({ path: info.outputPath('player-ready.png') });
    });
  }
}

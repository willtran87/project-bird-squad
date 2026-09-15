import { test, expect } from '@playwright/test';

for (const animated of [false, true]) for (const reduced of [false, true]) {
  test(`counterstrike defeat interrupts remaining effects, animated=${animated}, reduced=${reduced}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(reduced => localStorage.setItem('birdsquad.motionPreference', reduced ? 'reduced' : 'full'), reduced);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('./');
    await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
    await page.evaluate(async () => {
      const w = window as any;
      await w.__birdSquadEnsureScene('BattleScene');
      for (const scene of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(scene.scene.key);
      w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
    });
    await page.waitForFunction(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      return b.fxLayer?.active && b.combatFxModule && b.combatPreviewModule
        && !b.combatIntroActive && !b.combatAnimationPending && !b.battleRenderQueued;
    });
    const result = await page.evaluate(animated => {
      const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
      const source = b.enemies[0];
      b.enemies = [
        { ...source, id: 'interrupted', name: 'Interrupted attacker', hp: 3, maxHp: 20 },
        { ...source, id: 'survivor', name: 'Surviving attacker', hp: 20, maxHp: 20 },
      ].map((enemy: any, i: number) => ({ ...enemy, block: 0, weak: 0, damageBonus: 0, nextAttackBonus: 0, intentIndex: 0,
        runtime: { ...enemy.runtime, moves: [{ id: `move-${i}`, label: i ? 'Survivor hit' : 'Interrupted combo',
          effects: i ? ['damage(flock, 2)'] : ['damage(flock, 4)', 'heal(10)', 'damage(flock, 20)'] }],
          attackPattern: { type: 'cycle', moveIds: [`move-${i}`] } } }));
      b.runLeaderId = 'roostkeeper'; b.leaderSignatureUsed = new Set(); b.routeMarks = []; b.runDifficulty = 0;
      b.flock = { ...b.flock, hp: 50, maxHp: 50, block: 4, flow: 0, weak: 0, exposed: false, molt: false };
      b.statTaken = 0; b.statBlocked = 0; b.statDefeated = 0; b.log = [];
      b.firstAttackThisTurn = false; b.hand = []; b.renderAll();
      const before = JSON.stringify({ flock: b.flock, enemies: b.enemies, used: [...b.leaderSignatureUsed], log: b.log });
      const forecast = b.enemyDamageProjection(b.enemies, b.flock, false);
      const unchanged = before === JSON.stringify({ flock: b.flock, enemies: b.enemies, used: [...b.leaderSignatureUsed], log: b.log });
      let done = !animated;
      if (animated) {
        b.combatAnimationPending = true;
        b.resolveEnemyTurnAnimated(() => { done = true; b.combatAnimationPending = false; });
        for (let i = 0; i < 2000 && !done; i++) w.advanceTime(10);
      } else b.resolveEnemyTurn();
      b.renderAll();
      return { done, forecast, unchanged, hp: b.flock.hp, taken: b.statTaken, blocked: b.statBlocked,
        enemies: b.enemies.map((e: any) => ({ id: e.id, hp: e.hp })), log: b.log, defeated: b.statDefeated };
    }, animated);
    expect(result.done).toBe(true);
    expect(result.unchanged).toBe(true);
    expect(result.forecast).toMatchObject({ afterHp: result.hp, hpLoss: result.taken, blocked: result.blocked, uncertainty: [] });
    expect(result.enemies).toEqual([{ id: 'interrupted', hp: 0 }, { id: 'survivor', hp: 17 }]);
    expect(result).toMatchObject({ hp: 48, taken: 2, blocked: 4, defeated: 1 });
    expect(result.log.some((line: string) => line.includes('scavenges'))).toBe(false);
    await info.attach('interruption', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
    await page.screenshot({ path: info.outputPath('counterstrike-resolved.png') });
    expect(errors).toEqual([]);
  });
}

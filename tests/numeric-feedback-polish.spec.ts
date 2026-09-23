import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

test('blocked attacks share bounded result lanes and retain each event in history', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('BattleScene');
    for (const scene of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(scene.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_boss' });
  });
  await page.waitForFunction(() => {
    const battle = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return battle.battleFxPresenterModule && battle.hand.length && !battle.combatAnimationPending && !battle.combatIntroActive;
  });
  const result = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.fxLayer.removeAll(true);
    const enemy = b.enemies[0];
    enemy.block = 100; b.flock.block = 100;
    const beforeHp = [enemy.hp, b.flock.hp], historyStart = b.combatHistory.length;
    b.damageEnemy(enemy.id, 1, 'blocked-fixture');
    b.damageEnemy(enemy.id, 1, 'blocked-fixture');
    b.damageFlock(enemy, 1, 'blocked-swipe');
    b.damageFlock(enemy, 1, 'blocked-swipe');
    b.renderAll(); (window as any).advanceTime(20);
    b.time.paused = true; b.tweens.pauseAll();
    const labels = b.fxLayer.list.filter((o: any) => o.name === 'combat-number-feedback');
    return {
      hp: [enemy.hp, b.flock.hp], beforeHp,
      history: b.combatHistory.slice(historyStart),
      labels: labels.map((o: any) => ({ target: o.getData('target'), kind: o.getData('kind'),
        count: o.getData('count'), text: o.getByName('combat-number-label')?.text,
        placement: o.getData('placement') })),
    };
  });
  expect(result.hp).toEqual(result.beforeHp);
  expect(result.history).toHaveLength(4);
  expect(result.history.slice(0, 2).every((entry: string) => entry.includes('blocked-fixture'))).toBe(true);
  expect(result.history.slice(2).every((entry: string) => entry.includes('hit is blocked'))).toBe(true);
  expect(result.labels).toEqual([
    { target: expect.any(String), kind: 'blocked', count: 2, text: 'Blocked ×2', placement: 'target-lane' },
    { target: 'flock', kind: 'blocked', count: 2, text: 'Blocked ×2', placement: 'flock-stack' },
  ]);
  for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(viewport);
    await settleCanvas(page);
    const clear = await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      const labels = b.fxLayer.list.filter((o: any) => o.name === 'combat-number-feedback');
      const safe = labels.every((o: any) => { const r = o.getBounds(); return r.left >= 0 && r.right <= 1280 && r.top > 100 && r.bottom < 460; });
      const a = labels[0].getBounds(), z = labels[1].getBounds();
      return safe && labels[1].x >= 360
        && (a.right <= z.left || a.left >= z.right || a.bottom <= z.top || a.top >= z.bottom);
    });
    expect(clear).toBe(true);
    await page.screenshot({ path: info.outputPath(`blocked-${viewport.width}.png`) });
  }
  await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.time.paused = false; b.tweens.resumeAll(); b.fxLayer.removeAll(true);
  });
  expect(errors).toEqual([]);
});

for (const reduced of [false, true]) test(`enemy debuffs use one bounded flock status stack, reduced=${reduced}`, async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(value => localStorage.setItem('birdsquad.motionPreference', value ? 'reduced' : 'full'), reduced);
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('BattleScene');
    for (const scene of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(scene.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_boss' });
  });
  await page.waitForFunction(() => {
    const battle = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return battle.battleFxPresenterModule && battle.hand.length && !battle.combatAnimationPending && !battle.combatIntroActive;
  });
  const result = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.fxLayer.removeAll(true);
    const enemy = b.enemies[0], start = b.combatHistory.length;
    b.resolveEnemyEffect(enemy, 'applyWinded(1)');
    b.resolveEnemyEffect(enemy, 'applyWinded(1)');
    b.resolveEnemyEffect(enemy, 'applyFrail(1)');
    b.resolveEnemyEffect(enemy, 'applyPoison(2)');
    b.renderAll(); (window as any).advanceTime(20);
    b.time.paused = true; b.tweens.pauseAll();
    return {
      statuses: [b.flock.weak, b.flock.frail, b.flock.fouled],
      history: b.combatHistory.slice(start),
      accents: b.fxLayer.list.filter((o: any) => [
        'combat-winded-gust', 'combat-ruffled-break', 'combat-fouled-pressure',
      ].includes(o.name)).map((o: any) => o.name),
      additiveAccents: b.fxLayer.list.filter((o: any) => [
        'combat-winded-gust', 'combat-ruffled-break', 'combat-fouled-pressure',
      ].includes(o.name) && o.blendMode !== 0).length,
      particles: b.fxLayer.list.filter((o: any) => o.type === 'ParticleEmitter').length,
      labels: b.fxLayer.list.filter((o: any) => o.name === 'combat-number-feedback').map((o: any) => ({
        kind: o.getData('kind'), count: o.getData('count'), text: o.getByName('combat-number-label')?.text,
        target: o.getData('target'), source: o.getData('source'), x: o.x, y: o.y,
      })),
    };
  });
  expect(result.statuses).toEqual([2, 1, 2]);
  expect(result.accents).toEqual(['combat-winded-gust', 'combat-ruffled-break', 'combat-fouled-pressure']);
  expect(result.additiveAccents).toBe(0);
  expect(result.particles).toBe(0);
  expect(result.history).toHaveLength(4);
  expect(result.history.map((entry: string) => /Winded|ruffles|fouls/.exec(entry)?.[0])).toEqual([
    'Winded', 'Winded', 'ruffles', 'fouls',
  ]);
  expect(result.labels).toEqual([
    { kind: 'status:Winded', count: 2, text: 'Winded ×2', target: 'flock', source: expect.any(String), x: 380, y: 332 },
    { kind: 'status:Ruffled', count: 1, text: 'Ruffled', target: 'flock', source: expect.any(String), x: 380, y: 292 },
    { kind: 'status:Fouled 2', count: 1, text: 'Fouled 2', target: 'flock', source: expect.any(String), x: 380, y: 252 },
  ]);
  for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(viewport);
    await settleCanvas(page);
    const clear = await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      const labels = b.fxLayer.list.filter((o: any) => o.name === 'combat-number-feedback');
      const separate = (a: any, z: any) => a.right <= z.left || a.left >= z.right || a.bottom <= z.top || a.top >= z.bottom;
      return labels.length === 3 && labels.every((o: any, i: number) => {
        const r = o.getBounds();
        return r.left >= 0 && r.right <= 1280 && r.top > 100 && r.bottom < 460
          && labels.slice(i + 1).every((other: any) => separate(r, other.getBounds()));
      });
    });
    expect(clear).toBe(true);
    await page.screenshot({ path: info.outputPath(`debuffs-${viewport.width}.png`) });
  }
  const retired = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.time.paused = false; b.tweens.resumeAll(); (window as any).advanceTime(700);
    const before = b.combatWindedGustBursts;
    b.resolveEnemyEffect(b.enemies[0], 'applyWinded(1)');
    const result = { newCue: b.combatWindedGustBursts - before,
      activeCues: b.fxLayer.list.filter((o: any) => o.name === 'combat-winded-gust').length,
      weak: b.flock.weak };
    b.fxLayer.removeAll(true);
    return result;
  });
  expect(retired).toEqual({ newCue: 1, activeCues: 1, weak: 3 });
  expect(errors).toEqual([]);
});

for (const reduced of [false, true]) test(`Open Sky exposure keeps one clear cue and ordered causes, reduced=${reduced}`, async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(value => localStorage.setItem('birdsquad.motionPreference', value ? 'reduced' : 'full'), reduced);
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('BattleScene');
    for (const scene of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(scene.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_boss' });
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.battleFxPresenterModule && b.hand.length && !b.combatAnimationPending && !b.combatIntroActive
      && b.textures.exists('combat-open-sky-exposure');
  });
  const result = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.fxLayer.removeAll(true); b.flock.exposed = false; b.flock.exposedTurns = 0;
    const start = b.combatHistory.length, before = b.combatOpenSkyExposureBursts;
    b.enterOpenSky(2, 'fixture exposure');
    b.enterOpenSky(1, 'fixture exposure');
    b.enterOpenSky(1, 'fixture overextension', 'Overextended!');
    b.renderAll(); (window as any).advanceTime(20);
    b.time.paused = true; b.tweens.pauseAll();
    return {
      exposed: b.flock.exposed, turns: b.flock.exposedTurns,
      history: b.combatHistory.slice(start), newCues: b.combatOpenSkyExposureBursts - before,
      art: b.fxLayer.list.filter((o: any) => o.name === 'combat-open-sky-exposure').map((o: any) => ({
        blendMode: o.blendMode, width: o.displayWidth,
      })),
      labels: b.fxLayer.list.filter((o: any) => o.name === 'combat-number-feedback').map((o: any) => ({
        text: o.getByName('combat-number-label')?.text, kind: o.getData('kind'), target: o.getData('target'),
        count: o.getData('count'), x: o.x, y: o.y,
      })),
    };
  });
  expect(result.exposed).toBe(true);
  expect(result.turns).toBe(2);
  expect(result.history.map((entry: string) => entry.replace(/^Beat \d+ · /, ''))).toEqual([
    'fixture exposure', 'fixture exposure', 'fixture overextension',
  ]);
  expect(result.newCues).toBe(1);
  expect(result.art).toEqual([{ blendMode: 0, width: expect.any(Number) }]);
  expect(result.art[0].width).toBeLessThan(270);
  expect(result.labels).toEqual([
    { text: 'Open Sky! ×2', kind: 'status:Open Sky!', target: 'flock', count: 2, x: 380, y: 332 },
    { text: 'Overextended!', kind: 'status:Overextended!', target: 'flock', count: 1, x: 380, y: 292 },
  ]);
  for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(viewport);
    await settleCanvas(page);
    const safe = await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      return b.fxLayer.list.filter((o: any) => o.name === 'combat-number-feedback').every((o: any) => {
        const r = o.getBounds(); return r.left > 0 && r.right < 550 && r.top > 100 && r.bottom < 420;
      });
    });
    expect(safe).toBe(true);
    await page.screenshot({ path: info.outputPath(`open-sky-${viewport.width}.png`) });
  }
  const fresh = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.time.paused = false; b.tweens.resumeAll(); (window as any).advanceTime(700);
    const before = b.combatOpenSkyExposureBursts;
    b.enterOpenSky(1, 'fixture later exposure');
    const result = { newCue: b.combatOpenSkyExposureBursts - before,
      activeCues: b.fxLayer.list.filter((o: any) => o.name === 'combat-open-sky-exposure').length };
    b.fxLayer.removeAll(true); return result;
  });
  expect(fresh).toEqual({ newCue: 1, activeCues: 1 });
  expect(errors).toEqual([]);
});

for (const reduced of [false, true]) test(`numeric feedback groups explicit sources without delaying combat, reduced=${reduced}`, async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('BattleScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_boss' });
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.battleFxPresenterModule && b.hand.length && !b.combatAnimationPending && !b.combatIntroActive;
  });
  const result = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.fxLayer.removeAll(true);
    b.flock.hp = 10;
    const enemy = b.enemies[0], before = enemy.hp;
    b.damageEnemy(enemy.id, 2, 'test-double-hit');
    b.damageEnemy(enemy.id, 3, 'test-double-hit');
    b.gainBlock(2, 'test-cover'); b.gainBlock(3, 'test-cover');
    b.healFlock(2, 'test-heal'); b.healFlock(3, 'test-heal');
    b.renderAll();
    (window as any).advanceTime(20);
    b.time.paused = true; b.tweens.pauseAll();
    return { before, after: enemy.hp, pending: b.combatAnimationPending, history: b.combatHistory.slice(-6),
      groups: b.fxLayer.list.filter((o: any) => o.name === 'combat-number-feedback').map((o: any) => ({
        target: o.getData('target'), kind: o.getData('kind'), count: o.getData('count'), amount: o.getData('amount'), y: o.y,
      })) };
  });
  expect(result.pending).toBe(false);
  expect(result.groups).toHaveLength(3);
  expect(result.groups.every((g: any) => g.count === 2)).toBe(true);
  expect(result.groups.find((g: any) => g.kind === 'damage').amount).toBe(result.before - result.after);
  expect(result.groups.find((g: any) => g.kind === 'heal').amount).toBe(5);
  const effects = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const labels = b.fxLayer.list.filter((o: any) => o.name === 'combat-number-feedback');
    const particles = b.fxLayer.list.filter((o: any) => o.type === 'ParticleEmitter');
    return {
      sceneParticles: b.children.list.filter((o: any) => o.type === 'ParticleEmitter').length,
      belowResults: particles.every((p: any) => labels.every((l: any) => b.fxLayer.getIndex(p) < b.fxLayer.getIndex(l))),
      compactHits: b.fxLayer.list.filter((o: any) => o.name === 'combat-player-hit-confirm').every((o: any) => o.displayWidth < 165),
      noDuplicateFlash: !b.fxLayer.getByName('combat-impact-flash'),
    };
  });
  expect(effects).toEqual({ sceneParticles: 0, belowResults: true, compactHits: true, noDuplicateFlash: true });
  expect(result.history.filter((e: string) => e.includes('test-double-hit'))).toHaveLength(2);
  const flock = result.groups.filter((g: any) => g.target === 'flock');
  expect(Math.abs(flock[0].y - flock[1].y)).toBe(40);
  for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(viewport);
    await settleCanvas(page);
    const f = await page.evaluate(() => (window as any).__birdSquadGame.loop.frame);
    await page.waitForFunction(f => (window as any).__birdSquadGame.loop.frame >= f + 2, f);
    const bounds = await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      return b.fxLayer.list.filter((o: any) => o.name === 'combat-number-feedback').map((o: any) => {
        const r = o.getBounds(), label = o.getByName('combat-number-label').getBounds();
        return r.left >= 0 && r.right <= 1280 && r.top > 100 && r.bottom < 460 && label.left > r.left && label.right < r.right;
      });
    });
    expect(bounds.every(Boolean)).toBe(true);
    await page.screenshot({ path: info.outputPath(`numbers-${viewport.width}.png`) });
  }
  await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.time.paused = false; b.tweens.resumeAll();
  });
  await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('BattleScene').fxLayer.getByName('combat-number-feedback'));
  // Replacement and explicit layer cleanup must retire timers/tweens too.
  const cleanup = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    b.gainBlock(1, 'replace'); w.advanceTime(150); b.gainBlock(2, 'replace'); b.gainBlock(3, 'replace');
    const group = b.fxLayer.list.find((o: any) => o.name === 'combat-number-feedback' && o.getData('source') === 'replace');
    const count = group.getData('count');
    b.fxLayer.removeAll(true); w.advanceTime(2000);
    return { count, live: b.fxLayer.list.filter((o: any) => o.name === 'combat-number-feedback').length, tweens: b.tweens.getTweensOf(group).length, particles: b.activeFxParticleBursts };
  });
  expect(cleanup).toEqual({ count: 2, live: 0, tweens: 0, particles: 0 });
  const isolation = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const emit = (source: string, target = 'flock') => b.presentNumberFeedback(640, 300, '#ffffff', {
      target, source, kind: 'cover', amount: 1, suffix: ' Cover', reducedMotion: true,
    });
    emit('one'); emit('two'); emit('three'); emit('four'); emit('four', 'enemy');
    const groups = b.fxLayer.list.filter((o: any) => o.name === 'combat-number-feedback');
    const state = groups.map((o: any) => ({ target: o.getData('target'), source: o.getData('source'), count: o.getData('count') }));
    b.fxLayer.removeAll(true);
    // The existing lazy-presenter failure fallback must still show the result.
    const presenter = b.battleFxPresenterModule;
    b.battleFxPresenterModule = undefined; emit('fallback'); b.battleFxPresenterModule = presenter;
    const fallback = b.fxLayer.list.some((o: any) => o.list?.some((t: any) => t.text === '1 Cover'));
    b.fxLayer.removeAll(true);
    return { state, fallback };
  });
  expect(isolation.state).toEqual([
    { target: 'flock', source: 'two', count: 1 },
    { target: 'flock', source: 'three', count: 1 },
    { target: 'flock', source: 'four', count: 1 },
    { target: 'enemy', source: 'four', count: 1 },
  ]);
  expect(isolation.fallback).toBe(true);
  const triggers = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.fxLayer.removeAll(true); b.flock.hp = b.flock.maxHp; b.routeMarks = ['fixture-a', 'fixture-b'];
    const before = b.flock.block;
    b.resolveMarkEffect('gainCover(2)', 'A'); b.resolveMarkEffect('gainCoverPerWaymark(3)', 'A');
    b.resolveMarkEffect('gainCover(4)', 'B');
    b.healFlock(3, 'overheal card', true);
    const groups = b.fxLayer.list.filter((o: any) => o.name === 'combat-number-feedback').map((o: any) => ({
      source: o.getData('source'), amount: o.getData('amount'), count: o.getData('count'),
    }));
    b.fxLayer.removeAll(true);
    return { delta: b.flock.block - before, groups };
  });
  expect(triggers).toEqual({ delta: 15, groups: [
    { source: 'Waymark: A', amount: 8, count: 2 },
    { source: 'Waymark: B', amount: 4, count: 1 },
    { source: 'overheal card', amount: 3, count: 1 },
  ] });
  const support = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const target = b.enemies[0]; target.hp = 10; target.maxHp = 100; target.block = 0;
    const history = b.combatHistory.length;
    b.giveEnemyCover(target, 2, 'Lookout', 'screens', 'lookout-a');
    b.giveEnemyCover(target, 3, 'Lookout', 'screens', 'lookout-a');
    b.giveEnemyCover(target, 4, 'Lookout', 'screens', 'lookout-b');
    b.healEnemy(target, 2, 'Lookout', 'patches', 'lookout-a');
    b.healEnemy(target, 3, 'Lookout', 'patches', 'lookout-a');
    const groups = b.fxLayer.list.filter((o: any) => o.name === 'combat-number-feedback').map((o: any) => ({
      source: o.getData('source'), kind: o.getData('kind'), amount: o.getData('amount'), count: o.getData('count'),
      safe: o.getBounds().top > 100 && o.getBounds().bottom < 460,
    }));
    const cues = b.fxLayer.list.filter((o: any) => ['combat-enemy-cover', 'combat-enemy-mend'].includes(o.name));
    const labels = b.fxLayer.list.filter((o: any) => o.name === 'combat-number-feedback');
    const panels = b.root.list.filter((o: any) => ['combat-enemy-vitals', 'combat-enemy-intent-badge', 'combat-boss-phase-badge'].includes(o.name));
    const separate = (a: any, z: any) => a.right <= z.left || a.left >= z.right || a.bottom <= z.top || a.top >= z.bottom;
    const compactSupport = cues.length === 2 && cues.every((o: any) => o.displayWidth <= 154 && o.alpha <= 0.58
      && labels.every((l: any) => b.fxLayer.getIndex(o) < b.fxLayer.getIndex(l))
      && panels.every((p: any) => separate(o.getBounds(), p.getBounds())));
    const result = { hp: target.hp, cover: target.block, history: b.combatHistory.length - history, groups, compactSupport };
    b.renderAll(); (window as any).advanceTime(20); b.time.paused = true; b.tweens.pauseAll();
    return result;
  });
  expect(support).toEqual({ hp: 15, cover: 9, history: 5, compactSupport: true, groups: [
    { source: 'lookout-a', kind: 'heal', amount: 5, count: 2, safe: true },
  ] });
  for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
    await page.setViewportSize({ width, height }); await settleCanvas(page);
    const clear = await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      const protectedObjects = b.root.list.filter((o: any) => /^(combat-enemy-(art|vitals|intent-badge|status-panel)|combat-boss-phase-badge)$/.test(o.name));
      const separate = (a: any, z: any) => a.right <= z.left || a.left >= z.right || a.bottom <= z.top || a.top >= z.bottom;
      return b.fxLayer.list.filter((o: any) => o.name === 'combat-number-feedback').map((o: any) => ({
        visible: o.visible, placement: o.getData('placement'), bounds: o.getBounds(),
        overlaps: protectedObjects.filter((p: any) => !separate(o.getBounds(), p.getBounds())).map((p: any) => ({ name: p.name, bounds: p.getBounds() })),
      }));
    });
    await page.screenshot({ path: info.outputPath(`enemy-support-${width}.png`) });
    expect(clear.every(o => o.visible && o.placement === 'target-lane' && o.overlaps.length === 0), JSON.stringify(clear)).toBe(true);
  }
  const supportRetired = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const cues = b.fxLayer.list.filter((o: any) => ['combat-enemy-cover', 'combat-enemy-mend'].includes(o.name));
    b.fxLayer.removeAll(true); b.time.paused = false; b.tweens.resumeAll();
    (window as any).advanceTime(500);
    return cues.length === 2 && cues.every((o: any) => !o.active && b.tweens.getTweensOf(o).length === 0);
  });
  expect(supportRetired).toBe(true);
  const formation = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const original = b.enemies[0];
    b.enemies = Array.from({ length: 4 }, (_, i) => ({ ...original, id: `result-${i}`, name: `Lookout ${i + 1}`,
      hp: 500, maxHp: 500, block: 0, runtime: { ...original.runtime, type: 'normal' } }));
    b.selectedInstanceId = undefined; b.renderAll();
    for (const enemy of b.enemies) { b.damageEnemy(enemy.id, 50, 'formation-hit'); b.damageEnemy(enemy.id, 50, 'formation-hit'); }
    b.renderAll();
    const labels = b.fxLayer.list.filter((o: any) => o.name === 'combat-number-feedback');
    const separate = (a: any, z: any) => a.right <= z.left || a.left >= z.right || a.bottom <= z.top || a.top >= z.bottom;
    const clear = labels.every((o: any, i: number) => labels.slice(i + 1).every((other: any) => separate(o.getBounds(), other.getBounds())));
    b.time.paused = true; b.tweens.pauseAll();
    return { count: labels.length, clear, bounds: labels.map((o: any) => o.getBounds()) };
  });
  await page.screenshot({ path: info.outputPath('four-enemy-results-1000.png') });
  expect(formation.count).toBe(4); expect(formation.clear, JSON.stringify(formation.bounds)).toBe(true);
  const replaced = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.selectedInstanceId = b.hand[0].instanceId; b.selectedEnemyId = b.enemies[0].id; b.renderAll();
    return { preview: Boolean(b.selectionOutcomePreview?.active), stale: b.fxLayer.list.some((o: any) => o.getData('placement') === 'target-lane') };
  });
  expect(replaced).toEqual({ preview: true, stale: false });
  expect(errors).toEqual([]);
});

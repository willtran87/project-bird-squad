import { test, expect } from '@playwright/test';
import { KEYWORDS, buildKeywordTokens, cardKeywordSections } from '../src/game/keyword-definitions';
import { settleCanvas } from './helpers/settled-canvas';
import { incomingHit, projectEnemyPhase } from '../src/game/enemy-damage';
test.use({ hasTouch: true });

test('documented Guard charges and Winded reduction match shared combat arithmetic', () => {
  const flock = { hp: 100, maxHp: 100, block: 0, exposed: true, openSkyGuard: 2, openSkyReduction: 0, weak: 0, frail: 0, fouled: 0 };
  const enemy = { id: 'test', hp: 30, maxHp: 30, block: 0, weak: 0, nextAttackBonus: 0, damageBonus: 0 };
  const mods = { enemyDamageBonus: 0, openSkyBonus: 3 };
  const phase = projectEnemyPhase({ flock, enemies: [enemy], mods, firstSkyReduction: 0, firstSkyEffects: [],
    move: () => ({ effects: ['damage(flock, 8)', 'damage(flock, 8)', 'damage(flock, 8)'] }), condition: () => true });
  expect(phase.total).toBe(27); // Two full base hits, then one base + exposure hit.
  expect(flock.openSkyGuard).toBe(2); // Forecasts do not consume live resources.
  for (const weak of [1, 5]) expect(incomingHit(9, { ...enemy, weak }, { ...flock, exposed: false }, mods, 0).damage).toBe(6);
});

test('keyword references share definitions and preserve longest phrases and written tokens', () => {
  const text = '(Open Sky Guard), Open Sky! Winded Burst; Resonance Burst. 2 Wingbeats [Cover] COVER keystones. Uncovered drawing';
  const tokens = buildKeywordTokens(text);
  expect(tokens.map(t => t.text).join(' ')).toBe(text);
  expect(tokens.flatMap(t => t.kw ? [t.kw] : [])).toEqual(['Open Sky Guard', 'Open Sky', 'Winded Burst', 'Resonance Burst', 'Wingbeat', 'Cover', 'Cover', 'Keystone']);
  expect(cardKeywordSections(text).length).toBe(7);
  expect(cardKeywordSections('No special terms here.')).toEqual([]);
  expect(KEYWORDS.Wingbeat.def).toContain('immediately');
  expect(KEYWORDS.Cover.def).toContain('start of your next turn');
  expect(KEYWORDS.Winded.def).toContain('affected enemy or flock');
  expect(KEYWORDS['Open Sky Guard'].def).toContain('each incoming hit consumes 1 Guard');
});

test('contextual terms are readable without hover and preserve the pending combat decision', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('BattleScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.battleHandRendererModule && b.handLayer?.getByName('combat-card-title')
      && !JSON.parse((window as any).render_game_to_text()).combatIntro?.active;
  });
  const before = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.onCardClicked(b.hand[0].instanceId);
    const original = b.battleHandCardView.bind(b);
    b.battleHandCardView = (card: any) => {
      const view = original(card); return { ...view, preview: { ...view.preview,
        currentText: 'Gain 2 Wingbeats. Gain 4 Cover. Apply 2 Winded. Gain 1 Open Sky Guard.',
        alternateText: 'Winded Burst. Resonance Burst.', stats: 'Cohesion +2. Cover +1.' } };
    };
    b.openCombatCardDetail(b.hand[0]);
    return JSON.stringify({ hand: b.hand, flock: b.flock, enemies: b.enemies, energy: b.energy, selected: b.selectedInstanceId, target: b.selectedEnemyId, turn: b.turn });
  });
  const sections = await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').combatCardDetail.getData('pages'));
  for (const term of ['Wingbeat', 'Cover', 'Winded', 'Open Sky Guard', 'Winded Burst', 'Resonance Burst', 'Cohesion', 'Molt']) {
    const body = sections.filter((p: any) => p.heading === `TERM · ${term.toUpperCase()}`).map((p: any) => p.body).join(' ');
    expect(body.replace(/\s+/g, ' ')).toBe(KEYWORDS[term].def);
  }
  expect(sections.some((p: any) => p.heading === 'TERM · OPEN SKY')).toBe(false);
  const termIndex = sections.findIndex((p: any) => p.heading === 'TERM · OPEN SKY GUARD');
  for (let i = 0; i < termIndex; i++) await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await page.locator('#game-status').textContent())?.replace(/\s+/g, ' ')).toContain(KEYWORDS['Open Sky Guard'].def);
  for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(viewport); await settleCanvas(page);
    const fit = await page.evaluate(() => {
      const layer = (window as any).__birdSquadGame.scene.getScene('BattleScene').combatCardDetail;
      const panel = layer.getByName('combat-card-detail-panel').getBounds();
      return layer.list.filter((o: any) => o.type === 'Text').every((o: any) => {
        const r = o.getBounds(); return r.left >= panel.left && r.right <= panel.right && r.top >= panel.top && r.bottom <= panel.bottom;
      }) && layer.getByName('combat-card-detail-body').style.fontSize === '22px';
    });
    expect(fit).toBe(true);
    await page.screenshot({ path: info.outputPath(`keyword-${viewport.width}.png`) });
  }
  const nextPoint = await page.evaluate(() => {
    const layer = (window as any).__birdSquadGame.scene.getScene('BattleScene').combatCardDetail;
    const r = layer.getByName('combat-card-detail-next').getBounds(), canvas = document.querySelector('canvas')!.getBoundingClientRect();
    return { x: canvas.x + r.centerX * canvas.width / 1280, y: canvas.y + r.centerY * canvas.height / 720, height: r.height * canvas.height / 720 };
  });
  expect(nextPoint.height).toBeGreaterThanOrEqual(44);
  await page.touchscreen.tap(nextPoint.x, nextPoint.y);
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').combatCardDetail.getData('page'))).toBe(termIndex + 1);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').input.gamepad.emit('down', {}, { index: 14 }));
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').combatCardDetail.getData('page'))).toBe(termIndex);
  await page.keyboard.press('Escape');
  const after = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return JSON.stringify({ hand: b.hand, flock: b.flock, enemies: b.enemies, energy: b.energy, selected: b.selectedInstanceId, target: b.selectedEnemyId, turn: b.turn });
  });
  expect(after).toBe(before);
  const energy = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const card = b.hand[0], original = card.runtime;
    card.runtime = { ...original, effects: ['gainWingbeat(2)'] }; b.flock.molt = false;
    const before = b.energy, banked = b.nextTurnEnergyBonus;
    b.resolveCardEffects(card, b.enemies[0].id); card.runtime = original;
    return { gain: b.energy - before, futureChange: b.nextTurnEnergyBonus - banked };
  });
  expect(energy).toEqual({ gain: 2, futureChange: 0 });
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('CodexScene');
    w.__birdSquadGame.scene.stop('BattleScene'); w.__birdSquadGame.scene.start('CodexScene');
  });
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').codexData);
  const glossary = await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').glossaryTerms);
  for (const entry of glossary) if (KEYWORDS[entry.term]) expect(entry.detail).toBe(KEYWORDS[entry.term].def);
  expect(errors).toEqual([]);
});

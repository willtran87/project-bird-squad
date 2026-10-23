import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

test('Collection dossier commands share roles, readable disabled states and exact focus', async ({ page }, info) => {
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.addInitScript(() => {
    const ids = ['major_00', 'major_01', 'wands_ace', 'wands_02'];
    const raw = JSON.stringify({ discoveredCards: ids, cardCollection: Object.fromEntries(ids.map(id => [id,
      { timesClaimed: 1, firstAcquiredAt: 10, firstSource: 'starter_flock' }])) });
    localStorage.setItem('birdsquad.account', raw); localStorage.setItem('birdsquad.account.backup', raw);
  });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('CodexScene');
    w.__birdSquadGame.scene.stop('MenuScene'); w.__birdSquadGame.scene.start('CodexScene');
  });
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').codexData);
  await page.evaluate(() => {
    const s = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    s.newlyAcquiredCards.clear(); s.cardShowcase = ['major_01', 'wands_ace', 'wands_02']; s.openCodexDetail('major_00');
  });
  for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
    await page.setViewportSize({ width, height }); await settleCanvas(page);
    const checks = await page.evaluate(() => {
      const s = (window as any).__birdSquadGame.scene.getScene('CodexScene');
      const scale = s.game.canvas.getBoundingClientRect().height / 720;
      return ['codex-back-hit', 'codex-detail-close-hit', 'codex-card-favorite-hit', 'codex-card-protect-hit', 'codex-card-tag-hit', 'codex-card-showcase-hit'].map(name => {
        const hit = s.root.getByName(name), label = hit.getData('labelObject'), a = hit.getBounds();
        hit.emit('pointerover'); hit.emit('pointerout'); const b = hit.getBounds();
        return { name, role: hit.getData('controlKind'), alpha: hit.alpha, labelAlpha: label.alpha,
          fixed: a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height,
          type: parseFloat(label.style.fontSize) * scale, width: b.width * scale, height: b.height * scale,
          enabled: Boolean(hit.input?.enabled), color: label.style.color };
      });
    });
    for (const c of checks) {
      expect(c).toMatchObject({ role: 'secondary', alpha: 1, labelAlpha: 1, fixed: true });
      expect(c.type).toBeGreaterThanOrEqual(16); expect(c.width).toBeGreaterThanOrEqual(44); expect(c.height).toBeGreaterThanOrEqual(44);
    }
    expect(checks.at(-1)).toMatchObject({ enabled: false, color: '#a2b1ba' });
    await page.screenshot({ path: info.outputPath(`dossier-${width}.png`) });
  }
  await page.evaluate(() => {
    const s = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    s.overlayAction = 'codex-card-showcase-hit'; s.renderAll();
    s.root.getByName('codex-card-showcase-hit').emit('pointerdown');
  });
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').cardShowcase)).toEqual(['major_01', 'wands_ace', 'wands_02']);
  await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Enter');
  expect(await page.evaluate(() => {
    const s = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    const hit = s.root.getByName('codex-card-tag-hit'); hit.emit('pointerover'); hit.emit('pointerout');
    return { role: hit.getData('controlKind'), focused: hit.getData('focused'), selected: hit.getData('selected'), outline: hit.lineWidth };
  })).toEqual({ role: 'secondary', focused: true, selected: true, outline: 3 });
});

test('combat confirmation roles retain opaque disabled states and never discard prematurely', async ({ page }, info) => {
  await page.setViewportSize({ width: 2560, height: 1600 }); await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('BattleScene');
    w.__birdSquadGame.scene.stop('MenuScene'); w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => {
    const s = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return s.hand.length && s.battleHudRendererModule && s.discardChoiceModule && !s.combatIntroActive && !s.combatAnimationPending;
  });
  expect(await page.evaluate(() => {
    const s = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return s.root.getByName('combat-roost-hit').getData('controlKind');
  })).toBe('primary');
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').beginDiscardChoice('Role contract', 1, false, () => {}));
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').root.getByName('combat-discard-confirm'));
  for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
    await page.setViewportSize({ width, height }); await settleCanvas(page);
    expect(await page.evaluate(() => {
      const s = (window as any).__birdSquadGame.scene.getScene('BattleScene'), hit = s.root.getByName('combat-discard-confirm');
      const before = s.hand.map((c: any) => c.instanceId).join(','); hit.emit('pointerdown');
      return { role: hit.getData('controlKind'), enabled: Boolean(hit.input?.enabled), color: hit.getData('labelObject').style.color,
        alpha: hit.alpha, unchanged: before === s.hand.map((c: any) => c.instanceId).join(','), pending: Boolean(s.discardChoice) };
    })).toEqual({ role: 'primary', enabled: false, color: '#a2b1ba', alpha: 1, unchanged: true, pending: true });
    await page.screenshot({ path: info.outputPath(`discard-${width}.png`) });
  }
});

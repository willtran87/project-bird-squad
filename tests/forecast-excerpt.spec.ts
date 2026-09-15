import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

test('long forecasts signal omissions and preserve complete outcomes in details', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('BattleScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.hand.length && b.battleHudRendererModule && b.combatPreviewModule && b.fxLayer?.active
      && !b.combatIntroActive && !b.combatAnimationPending && !b.battleRenderQueued;
  });
  const result = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const card = b.hand[0];
    b.flock.hp -= 3; b.spark = 0; b.selectedInstanceId = card.instanceId;
    card.runtime = { ...card.runtime, effects: ['gainCover(3)', 'heal(2)', 'gainResonance(2)', 'nextTurnDraw(1)', 'gainEnergyNextTurn(1)'] };
    b.renderAll();
    const preview = b.selectedCardOutcomePreview();
    b.openCombatCardDetail(card);
    const text = b.combatCardDetail.getData('pages').filter((p: any) => p.heading === 'PLAY NOW · OUTCOME').map((p: any) => p.body).join(' ');
    b.closeCombatCardDetail();
    b.selectionOutcomePreview?.destroy(true);
    b.selectionOutcomePreview = b.battleHudRendererModule.renderBattleSelectionPreview({
      scene: b, root: b.root, gameWidth: 1280, fontFamily: 'Arial', boldFontStyle: 'bold', cyan: 0x24d0d6, gold: 0xffdd88,
    }, { card: 'Featherwright Emergency Relay Station with an exceptionally long card name',
      target: 'A very long enemy name', summary: Array(10).fill('Cohesion 100 -> 90 / Cover 100 -> 90').join(' / ') });
    const title = b.selectionOutcomePreview.getByName('combat-selection-card-target');
    const summary = b.selectionOutcomePreview.getByName('combat-selection-summary');
    return { full: text, compact: preview.summary, title: title.text, summary: summary.text,
      titleLines: title.getWrappedText().length, summaryLines: summary.getWrappedText().length,
      fullTitle: title.getData('fullText'), fullSummary: summary.getData('fullText') };
  });
  expect(result.compact).toContain('…');
  for (const value of ['Cover', 'Cohesion', 'Wingbeats', 'Resonance', 'Next draw', 'Next Wingbeats', 'Card-only forecast']) expect(result.full).toContain(value);
  expect(result.title).toMatch(/…$/); expect(result.summary).toMatch(/…$/);
  expect(result.titleLines).toBe(1); expect(result.summaryLines).toBeLessThanOrEqual(2);
  expect(result.fullTitle.length).toBeGreaterThan(result.title.length);
  expect(result.fullSummary.length).toBeGreaterThan(result.summary.length);
  for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
    await page.setViewportSize({ width, height }); await settleCanvas(page);
    await page.screenshot({ path: info.outputPath(`forecast-${width}.png`) });
  }
  expect(errors).toEqual([]);
});

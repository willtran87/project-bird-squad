import { test, expect } from '@playwright/test';
import cards from '../data/game/alpha-cards.json' with { type: 'json' };
import { settleCanvas } from './helpers/settled-canvas';

test('complete card pool preserves measured rules and bounded frames in every stance', async ({ page }, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('RouteScene');
    const menu = w.__birdSquadGame.scene.getScene('MenuScene'); menu.startRun();
  });
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.isActive('RouteScene'));
  await page.evaluate(async ids => {
    const w = window as any;
    const runState = structuredClone(w.__birdSquadGame.scene.getScene('RouteScene').runState);
    // Layout fixture only: instantiate authored cards through the real deck loader.
    runState.deck = ids.map(id => ({ id, upgraded: false }));
    await w.__birdSquadEnsureScene('BattleScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry', runState });
  }, cards.cards.map(c => c.id));
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.hand.length && b.battleHandRendererModule && b.handLayer?.active && b.fxLayer?.active
      && !b.combatIntroActive && !b.combatAnimationPending && !b.battleRenderQueued;
  });
  const ids = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.layoutFixtureCards = b.allDeckCards().sort((a: any, z: any) => a.id.localeCompare(z.id));
    b.queueCardArtLoad(b.layoutFixtureCards);
    b.energy = 3; b.pendingRetainHand = 0;
    return b.layoutFixtureCards.map((c: any) => c.id);
  });
  expect(ids).toEqual(cards.cards.map(c => c.id).sort());
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.layoutFixtureCards.every((card: any) => {
      const key = b.battleHandCardView(card).artKey;
      return key && b.textures.exists(key);
    });
  });
  let checked = 0;
  for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
    await page.setViewportSize({ width, height }); await settleCanvas(page);
    for (const upgraded of [false, true]) for (const molt of [false, true]) {
      const result = await page.evaluate(({ upgraded, molt }) => {
        const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
        const failures: any[] = []; let checked = 0;
        const contains = (outer: any, inner: any) => inner.left >= outer.left - 0.1 && inner.right <= outer.right + 0.1
          && inner.top >= outer.top - 0.1 && inner.bottom <= outer.bottom + 0.1;
        for (let start = 0; start < b.layoutFixtureCards.length; start += 5) {
          b.hand = b.layoutFixtureCards.slice(start, start + 5);
          b.hand.forEach((c: any) => c.upgraded = upgraded); b.flock.molt = molt;
          b.selectedInstanceId = b.hand[0].instanceId; b.handRenderKey = ''; b.renderHand();
          const named = (name: string) => b.handLayer.list.filter((c: any) => c.name === name);
          b.hand.forEach((card: any, i: number) => {
            const title = named('combat-card-title')[i], rules = named('combat-card-readable-summary')[i];
            const frame = b.handCardFrames.get(card.instanceId), rect = b.handCardRects.get(card.instanceId);
            const checks = {
              title: contains(named('combat-card-title-panel')[i].getBounds(), title.getBounds()),
              rules: contains(named('combat-card-rules-panel')[i].getBounds(), rules.getBounds()),
              source: rules.getData('fullText') === b.activeCardContract(card).text.replace(/\s+/g, ' ').trim(),
              omission: !rules.getData('truncated') || rules.text.endsWith('…'),
              frame: !frame || contains(rect.getBounds(), frame.getBounds()),
            };
            if (Object.values(checks).some(ok => !ok)) failures.push({ id: card.id, upgraded, molt, checks });
            checked++;
          });
        }
        return { checked, failures };
      }, { upgraded, molt });
      checked += result.checked;
      expect(result.failures).toEqual([]);
      await settleCanvas(page);
      await page.screenshot({ path: info.outputPath(`pool-${width}-${upgraded ? 'preened' : 'base'}-${molt ? 'molt' : 'normal'}.png`) });
    }
  }
  expect(checked).toBe(cards.cards.length * 12);
  expect(errors).toEqual([]);
});

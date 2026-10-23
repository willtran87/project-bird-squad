import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { settleCanvas } from './helpers/settled-canvas';

// First qualify a small, authored vertical slice before a wider rollout.
const catalog = JSON.parse(readFileSync('data/game/alpha-encounters.json', 'utf8')).encounters;
const pilot = ['enc_roof_rat', 'enc_gutter_baron', 'enc_tar_crowned_crow'];

for (const id of pilot) test(`Rooftop pilot: ${id}`, async ({ page }, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./?flight=rooftop-polish-pilot');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);
  await page.evaluate(async encounter => {
    const w = window as any;
    await w.__birdSquadEnsureScene('BattleScene');
    const node = w.__birdSquadCurrentMap().nodes.find((n: any) => n.id === 'm1_entry');
    Object.assign(node, { payloadId: encounter.id, type: encounter.nodeType, label: encounter.name });
    for (const scene of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(scene.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: node.id,
      runState: w.__birdSquadGame.scene.getScene('RouteScene').runState });
  }, catalog.find((e: any) => e.id === id));
  await page.waitForFunction(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    return b.battleHandRendererModule && b.discardChoiceModule && b.hand.length
      && !b.combatIntroActive && !b.combatAnimationPending && !b.battleRenderQueued
      && JSON.parse(w.render_game_to_text()).assetReadiness?.fullArt;
  });
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').enemies.map((e: any) => e.runtime.id)))
    .toEqual(catalog.find((e: any) => e.id === id).enemies);

  for (const [width, height] of [[2560,1600], [1440,900], [1000,560]]) {
    await page.setViewportSize({ width, height }); await settleCanvas(page);
    await page.screenshot({ path: info.outputPath(`authored-${width}.png`) });
    for (const state of ['retain', 'discard', 'guide']) {
      const metrics = await page.evaluate(state => {
        const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
        b.pilotView ??= b.battleHandCardView.bind(b);
        b.pilotContext ??= b.battleHandRenderContext.bind(b);
        b.battleHandRenderContext = () => ({ ...b.pilotContext(), reinforcedColorCues: true });
        // Visual stress only: real art and rules, worst-case simultaneous flags.
        // No authored balance, card contract or combat state is changed.
        b.battleHandCardView = (card: any) => ({ ...b.pilotView(card),
          usesMolt: state !== 'guide', guideMolt: state === 'guide', guideCard: false,
          retainOrder: 10, discardSelectable: state === 'discard', discardSelected: state === 'discard', discardOrder: 10,
          buildsFlow: true, flowVisible: true, surgeNext: true });
        b.handRenderKey = ''; b.renderHand();
        const scale = b.game.canvas.getBoundingClientRect().width / 1280;
        const contains = (a: any, z: any) => z.left >= a.left - .1 && z.right <= a.right + .1 && z.top >= a.top - .1 && z.bottom <= a.bottom + .1;
        const clear = (a: any, z: any) => a.right + 2 <= z.left || z.right + 2 <= a.left || a.bottom + 2 <= z.top || z.bottom + 2 <= a.top;
        return [...b.handCardRects.entries()].map(([cardId, rect]: any) => {
          const objects = rect.getData('presentation');
          const title = objects.find((o: any) => o.name === 'combat-card-title-panel');
          const rules = objects.find((o: any) => o.name === 'combat-card-rules-panel');
          const badges = objects.filter((o: any) => [
            'combat-card-molt-badge', 'combat-molt-guide-tag', 'combat-retain-priority-tag',
            'combat-discard-choice-tag', 'combat-color-cue-badge',
          ].includes(o.name) && o.type !== 'Text');
          const flow = b.handCardFlowIndicators.get(cardId);
          badges.push(flow.background);
          const texts = objects.filter((o: any) => o.type === 'Text');
          texts.push(flow.label);
          const art = b.handCardArtLayers.get(cardId)?.getByName('combat-hand-illustration');
          return { cardId, readable: texts.every((o: any) => parseFloat(o.style.fontSize) * scale >= 14),
            contained: badges.every((o: any) => contains(rect.getBounds(), o.getBounds())),
            separate: badges.every((o: any, i: number) => [title, rules, ...badges.slice(i + 1)].every((z: any) => clear(o.getBounds(), z.getBounds()))),
            labelsContained: texts.filter((o: any) => !['combat-card-title', 'combat-card-readable-summary'].includes(o.name) && o.text !== String(b.pilotView(b.hand.find((c: any) => c.instanceId === cardId)).cost))
              .every((o: any) => badges.some((z: any) => contains(z.getBounds(), o.getBounds()))),
            artUniform: Boolean(art) && Math.abs(art.scaleX - art.scaleY) < .00001,
            artContained: Boolean(art) && contains(rect.getBounds(), art.getBounds()),
            flow: flow.label.text,
            labelBounds: texts.map((o: any) => ({ text: o.text, width: o.width, height: o.height })) };
        });
      }, state);
      for (const m of metrics) expect(m, `${id} ${width} ${state}: ${JSON.stringify(m)}`).toMatchObject({ readable: true, contained: true, separate: true,
        labelsContained: true, artUniform: true, artContained: true, flow: '+1 Flow · Surge' });
      await settleCanvas(page);
      if (state === 'retain' || width === 1000) await page.screenshot({ path: info.outputPath(`${state}-${width}.png`) });
      await page.evaluate(() => {
        const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
        b.battleHandCardView = b.pilotView; b.battleHandRenderContext = b.pilotContext;
        b.handRenderKey = ''; b.renderHand();
      });
    }
  }
  // Real keyboard input: selection is reversible, and Roost resolves into a
  // fresh playable turn. Stress rendering above must not change game rules.
  const before = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return { turn: b.turn, energy: b.energy, hand: b.hand.map((c: any) => c.instanceId) };
  });
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Escape');
  expect(await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return { turn: b.turn, energy: b.energy, hand: b.hand.map((c: any) => c.instanceId) };
  })).toEqual(before);
  await page.keyboard.press('r');
  await page.waitForFunction(turn => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.turn === turn + 1 && !b.combatAnimationPending && b.battleInputActive;
  }, before.turn);
  await settleCanvas(page);
  await page.screenshot({ path: info.outputPath('next-turn-1000.png') });
  expect(errors).toEqual([]);
});

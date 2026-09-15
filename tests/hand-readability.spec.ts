import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

test('hand typography preserves authored rules, bounds and turn readiness', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => (window as any).__birdSquadEnsureScene);
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('BattleScene');
    for (const scene of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(scene.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', {routeNodeId:'m1_entry'});
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.hand?.length && b.handLayer?.list.some((c: any) => c.name === 'combat-card-title');
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.fxLayer?.active && !b.combatIntroActive && !b.combatAnimationPending && !b.battleRenderQueued;
  });
  for (const viewport of [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}]) {
    await page.setViewportSize(viewport);
    await settleCanvas(page);
    const result = await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      const named = (name: string) => b.handLayer.list.filter((c: any) => c.name === name);
      return named('combat-card-title').map((title: any, i: number) => {
        const header = named('combat-card-title-panel')[i].getBounds();
        const summary = named('combat-card-readable-summary')[i];
        const panel = named('combat-card-rules-panel')[i].getBounds();
        const contains = (outer: any, inner: any) => inner.left >= outer.left && inner.right <= outer.right && inner.top >= outer.top && inner.bottom <= outer.bottom;
        return { titleFits: contains(header, title.getBounds()), rulesFit: contains(panel, summary.getBounds()),
          authored: summary.getData('fullText') === b.activeCardContract(b.hand[i]).text.replace(/\s+/g,' ').trim(),
          omissionMarked: !summary.getData('truncated') || summary.text.endsWith('…'),
          linkedQuantities: summary.getWrappedText().every((line: string) => !/^(?:›|\d+[.!]?|Cover[.!]?|Resonance[.!]?)$/.test(line.trim())) };
      });
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((r: any) => r.titleFits && r.rulesFit && r.authored && r.omissionMarked && r.linkedQuantities)).toBe(true);
    await page.screenshot({path:info.outputPath(`hand-${viewport.width}.png`)});
  }
  await page.setViewportSize({width:2560,height:1600});
  await settleCanvas(page);
  const focus = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.onCardClicked(b.hand[0].instanceId);
    const control = b.cardPreview?.getByName('combat-card-inspect-hit');
    return { right: control?.getBounds().right, selected: b.selectedInstanceId, modal: Boolean(b.combatCardDetail?.active) };
  });
  expect(focus.selected).toBeTruthy();
  expect(focus.right).toBeLessThanOrEqual(154);
  expect(focus.modal).toBe(false);
  await page.screenshot({path:info.outputPath('selected-2560.png')});
  const turn = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    b.handleBattleBack(); b.hand = []; b.endTurnAnimated();
    b.time.paused = true; b.tweens.pauseAll();
    return { label: b.root.getByName('combat-roost-label')?.text,
      handlers: b.root.getByName('combat-roost-hit')?.listenerCount('pointerdown') };
  });
  expect(turn).toEqual({label:'Enemy turn',handlers:0});
  await page.screenshot({path:info.outputPath('enemy-turn-2560.png')});
  const ready = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    b.time.paused = false; b.tweens.resumeAll();
    for (let i=0;i<1600 && b.combatAnimationPending;i++) w.advanceTime(10);
    return {pending:b.combatAnimationPending, label:b.root.getByName('combat-roost-label')?.text,
      handlers:b.root.getByName('combat-roost-hit')?.listenerCount('pointerdown')};
  });
  expect(ready.pending).toBe(false);
  expect(ready.label).toContain('Roost');
  expect(ready.handlers).toBe(1);
  // Stress the renderer independently of game balance: long title/rules, Molt,
  // unaffordable cards, Retain and reinforced color cues together.
  const stress = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const original = b.battleHandCardView.bind(b);
    const originalContext = b.battleHandRenderContext.bind(b);
    b.battleHandRenderContext = () => ({...originalContext(), reinforcedColorCues:true});
    b.battleHandCardView = (card: any) => {
      const view = original(card);
      return {...view,name:'Featherwright Emergency Relay Station',canPay:false,usesMolt:true,guideCard:false,guideMolt:false,retainOrder:1,
        preview:{...view.preview,currentText:'If this is your first card this turn, draw a card. Gain 4 Cover. If the target is Winded, deal 8 damage. Retain 1 card.'}};
    };
    b.handRenderKey = ''; b.renderHand();
    const items = b.handLayer.list;
    const name = items.find((c: any) => c.name === 'combat-card-title');
    const badge = items.find((c: any) => c.name === 'combat-card-molt-badge');
    const summary = items.find((c: any) => c.name === 'combat-card-readable-summary');
    return { separated:name.getBounds().bottom < badge.getBounds().top,
      titleOmission:name.text.endsWith('…'), rulesOmission:summary.text.endsWith('…'),
      fullRules:summary.getData('fullText').endsWith('Retain 1 card.'),
      containedFrames: [...b.handCardFrames.entries()].every(([id, frame]: any) => {
        const outer = b.handCardRects.get(id).getBounds(), inner = frame.getBounds();
        return inner.left >= outer.left && inner.right <= outer.right && inner.top >= outer.top && inner.bottom <= outer.bottom;
      }) };
  });
  expect(stress).toEqual({separated:true,titleOmission:true,rulesOmission:true,fullRules:true,containedFrames:true});
  await page.setViewportSize({width:1000,height:560});
  await settleCanvas(page);
  await page.screenshot({path:info.outputPath('long-molt-1000.png')});
  expect(errors).toEqual([]);
});

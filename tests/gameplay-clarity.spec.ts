import { test, expect, type Page } from '@playwright/test';

async function start(page: Page, key: string) {
  await page.evaluate(async key => {
    const w = window as any;
    await w.__birdSquadEnsureScene(key);
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start(key, key === 'BattleScene' ? {routeNodeId:'m1_entry'} : {});
  }, key);
  await page.waitForFunction(key => {
    const s = (window as any).__birdSquadGame.scene.getScene(key);
    return s.scene.isActive() && (key === 'BattleScene' ? s.hand?.length && !s.combatAnimationPending : s.routeEssentialAssetsReady);
  }, key);
}

test('gameplay clarity: combat and all event choices remain readable and actionable', async ({page}, info) => {
  test.setTimeout(120_000);
  const errors: string[]=[];
  page.on('pageerror', e=>errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setViewportSize({width:2560,height:1600});
  await page.goto('./');
  await page.waitForFunction(()=>(window as any).__birdSquadEnsureScene);
  await start(page,'BattleScene');
  await page.waitForTimeout(1000);
  const combat = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const card = b.hand.find((c: any) => b.activeCardContract(c).target === 'enemy' && b.effectiveCost(c) <= b.energy);
    b.onCardClicked(card.instanceId);
    const rect = b.handCardRects.get(card.instanceId);
    return { selected: b.selectedInstanceId === card.instanceId, outline: rect.lineWidth,
      pulseCount: b.handCardSelectionPulses.size,
      piles: b.root.list.filter((c: any) => c.name === 'combat-pile-hit').map((c: any) => ({ width: c.width, height: c.height, enabled: c.input.enabled })) };
  });
  expect(combat.selected).toBe(true);
  expect(combat.outline).toBe(3);
  expect(combat.pulseCount).toBe(0);
  expect(combat.piles).toHaveLength(2);
  expect(combat.piles.every(p => p.enabled && p.width >= 48 && p.height >= 48)).toBe(true);
  for (const viewport of [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}]) {
    await page.setViewportSize(viewport);
    await page.screenshot({path:info.outputPath(`battle-${viewport.width}.png`)});
  }
  await page.setViewportSize({width:2560,height:1600});
  await start(page,'RouteScene');
  for (const type of ['basin','cache','signal','nest','rival']) {
    const found = await page.evaluate(type=>{
      const w=window as any, r=w.__birdSquadGame.scene.getScene('RouteScene');
      const node=w.__birdSquadCurrentMap().nodes.find((n:any)=>n.type===type);
      if (!node) return false;
      r.nodeChoiceNodeId=node.id; r.nodeChoiceOpen=true; r.renderAll();
      return true;
    },type);
    // Rival encounters are optional in a generated district; the other four
    // event families are guaranteed on this map.
    if (!found && type === 'rival') continue;
    expect(found,`map includes ${type}`).toBe(true);
    await page.waitForTimeout(1500);
    for (const viewport of [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}]) {
      await page.setViewportSize(viewport);
      const layout = await page.evaluate(() => {
        const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
        const rows = r.children.list.filter((c: any) => c.name === 'route-choice-option-frame');
        const titles = r.children.list.filter((c: any) => c.name === 'route-choice-title');
        const summaries = r.children.list.filter((c: any) => c.name === 'route-choice-summary');
        const node = (window as any).__birdSquadCurrentMap().nodes.find((n: any) => n.id === r.nodeChoiceNodeId);
        const choices = r.nodeChoiceList(node);
        return {
          count: rows.length, expected: choices.length,
          panels: r.children.list.filter((c: any) => c.name === 'route-choice-decision-frame').map((c: any) => c.fillAlpha),
          rows: rows.map((row: any, i: number) => {
            const b = row.getBounds(), title = titles[i], summary = summaries[i];
            const tb = title.getBounds(), sb = summary.getBounds();
            const choice = choices.find((c: any) => c.key === row.getData('choiceKey'));
            const before = JSON.stringify(b);
            row.emit('pointerover'); row.emit('pointerout');
            return {
              inBounds: b.left >= 0 && b.right <= 1280 && b.top >= 90 && b.bottom <= 720,
              touchHeight: b.height,
              textFits: tb.left >= b.left && tb.right <= b.right && tb.top >= b.top && tb.bottom <= sb.top && sb.bottom <= b.bottom,
              overflowAccessible: (title.getWrappedText().length <= 1 && summary.getWrappedText().length <= summary.style.maxLines) || !!row.getData('hasOverflowDetail'),
              stable: before === JSON.stringify(row.getBounds()),
              actionable: choice.locked ? row.listenerCount('pointerdown') === 0 : row.listenerCount('pointerdown') === 1,
            };
          }),
        };
      });
      expect(layout.count, `${type} choices`).toBe(layout.expected);
      expect(layout.panels).toHaveLength(1);
      expect(layout.panels[0]).toBeGreaterThanOrEqual(0.95);
      for (const row of layout.rows) {
        expect(row, `${type} at ${viewport.width}`).toMatchObject({ inBounds: true, textFits: true, overflowAccessible: true, stable: true, actionable: true });
        expect(row.touchHeight).toBeGreaterThanOrEqual(56);
      }
      await page.screenshot({path:info.outputPath(`${type}-${viewport.width}.png`)});
    }
    await page.setViewportSize({width:2560,height:1600});
  }
  // Use the actual canvas input path for the non-destructive rival exit choice.
  const exit = await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const rows = r.children.list.filter((c: any) => c.name === 'route-choice-option-frame');
    const row = rows[rows.length - 1], b = row.getBounds();
    return { x: b.centerX, y: b.centerY };
  });
  const canvas = await page.locator('canvas').first().boundingBox();
  await page.mouse.click(canvas!.x + exit.x * canvas!.width / 1280, canvas!.y + exit.y * canvas!.height / 720);
  await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('RouteScene').nodeChoiceOpen);
  expect(errors).toEqual([]);
});

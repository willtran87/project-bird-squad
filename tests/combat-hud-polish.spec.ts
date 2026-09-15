import { test, expect } from '@playwright/test';

test('combat HUD contains forecast and flow; pile counts stay legible and interactive', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => (window as any).__birdSquadEnsureScene);
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('BattleScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    return b.root?.getByName('combat-pile-count') && !JSON.parse(w.render_game_to_text()).combatIntro?.active;
  });
  for (const viewport of [{ width:2560,height:1600 }, { width:1440,height:900 }, { width:1000,height:560 }]) {
    await page.setViewportSize(viewport);
    const result = await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      const hud = b.root.getByName('run-hud-surface').getBounds();
      const contains = (outer: any, inner: any) => inner.left >= outer.left && inner.right <= outer.right && inner.top >= outer.top && inner.bottom <= outer.bottom;
      const forecast = b.root.getByName('combat-incoming-forecast-label');
      const rail = b.root.getByName('combat-flow-rail');
      const hits = b.root.list.filter((c: any) => c.name === 'combat-pile-hit');
      const counts = b.root.list.filter((c: any) => c.name === 'combat-pile-count');
      return { forecastFits: contains(hud,forecast.getBounds()), flowFits: contains(hud,rail.getBounds()),
        forecastCrisp: forecast.style.resolution === 2 && forecast.style.strokeThickness === 0,
        counts: counts.map((c: any) => c.text), expected: [`${b.drawPile.length}`,`${b.discardPile.length}`],
        pilesFit: counts.every((c: any,i: number) => contains(hits[i].getBounds(),c.getBounds())),
        touch: hits.every((h: any) => h.input.enabled && h.width >= 56 && h.height >= 56) };
    });
    expect(result.forecastFits && result.flowFits && result.forecastCrisp && result.pilesFit && result.touch).toBe(true);
    expect(result.counts).toEqual(result.expected);
    await page.screenshot({ path:info.outputPath(`hud-${viewport.width}.png`) });
  }
  const target = await page.evaluate(() => {
    const w=window as any, b=w.__birdSquadGame.scene.getScene('BattleScene');
    const hit=b.root.list.find((c: any)=>c.name==='combat-pile-hit').getBounds(), canvas=w.__birdSquadGame.canvas.getBoundingClientRect();
    return {x:canvas.left+hit.centerX/w.__birdSquadGame.scale.width*canvas.width,y:canvas.top+hit.centerY/w.__birdSquadGame.scale.height*canvas.height};
  });
  await page.mouse.move(target.x,target.y);
  await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').root.getByName('combat-pile-hit').fillAlpha)).toBe(0.92);
  await page.screenshot({path:info.outputPath('pile-hover-1000.png')});
  await page.mouse.click(target.x,target.y);
  await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').inspectOverlay)).toBe('draw');
  await page.keyboard.press('Escape');
  await expect.poll(()=>page.evaluate(()=>Boolean((window as any).__birdSquadGame.scene.getScene('BattleScene').inspectOverlay))).toBe(false);
  const stress = await page.evaluate(() => {
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');
    const context=b.battleHudRenderContext.bind(b);
    b.battleHudRenderContext=(...args: any[])=>{const value=context(...args); return {...value,piles:value.piles.map((p: any)=>({...p,count:999}))};};
    b.renderAll();
    const hits=b.root.list.filter((c: any)=>c.name==='combat-pile-hit');
    return b.root.list.filter((c: any)=>c.name==='combat-pile-count').every((c: any,i: number)=>c.getBounds().right<=hits[i].getBounds().right && c.getBounds().left>=hits[i].getBounds().left);
  });
  expect(stress).toBe(true);
  await page.screenshot({path:info.outputPath('three-digit-counts-1000.png')});
  expect(errors).toEqual([]);
});

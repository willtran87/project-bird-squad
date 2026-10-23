import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

test.use({ hasTouch: true });

for (const kind of ['plain', 'mixed', 'card', 'supply', 'waymark', 'leave']) test(`reward review readable hierarchy and complete stress copy: ${kind}`, async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('RouteScene');
    w.__birdSquadGame.scene.stop('MenuScene'); w.__birdSquadGame.scene.start('RouteScene');
  });
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).assetReadiness?.fullArt);
  await page.evaluate(kind => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
    r.runState.districtContracts.forEach((c: any) => c.confirmed = true);
    r.runState.scrap = 999; r.runState.currentHp = 20;
    const node = w.__birdSquadCurrentMap().nodes.find((n: any) => n.type === (kind === 'supply' ? 'basin' : 'cache'));
    r.openNodeChoices(node);
    if (kind === 'supply') r.chooseNodeOption('refill_supplies');
    else if (kind === 'card') r.chooseNodeOption('cache_card');
    else if (kind === 'waymark') r.chooseNodeOption('cache_mark');
    else r.openRouteRewardMenu(node, { key: 'readability', text: 'Review the rooftop cache.', effects: kind === 'leave' ? [] : kind === 'plain' ? ['gainScrap(35)'] :
      ['gainScrap(25)', 'healMissingPct(50, 10)', 'reduceNextOpenSky(1)', 'bossDamageShield(16)', 'gainOpenSkyGuard(1)', 'addSnagToDiscard(bad_directions)'] }, structuredClone(r.runState));
  }, kind);
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('route-decision-title'));
  const check = async () => {
    const metrics = await page.evaluate(() => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), scale = r.game.canvas.getBoundingClientRect().height / 720;
      const primary = /route-decision-(title|choice|summary|row)$|route-reward-(claim-label|card-name|card-inspect-label)|route-reward-build-card-name|route-supply-(reward-title|inspect-label)|route-outcome-item-name/;
      const secondary = /route-decision-(subtitle|section|more)$|route-reward-build-(read-title|observation)|route-(supply-)?reward-input-hint|route-supply-reward-state/;
      const text = r.children.list.filter((o: any) => o.type === 'Text' && (primary.test(o.name) || secondary.test(o.name))).map((o: any) => ({
        name: o.name, value: o.text, font: parseFloat(o.style.fontSize) * scale, floor: primary.test(o.name) ? 16 : 14,
        left: o.getBounds().left, right: o.getBounds().right, top: o.getBounds().top, bottom: o.getBounds().bottom,
      }));
      const left = text.filter((o: any) => /^route-decision-(choice|summary|section|row|more)$|route-reward-build/.test(o.name)).sort((a: any, b: any) => a.top - b.top);
      const hits = r.children.list.filter((o: any) => /^route-(event-cancel|outcome-inspect|decision-inspect|reward-claim|reward-card-inspect|supply-inspect)-hit$/.test(o.name))
        .map((o: any) => ({ width: o.width * scale, height: o.height * scale, left: o.getBounds().left, right: o.getBounds().right, top: o.getBounds().top, bottom: o.getBounds().bottom }));
      return { text, leftGaps: left.slice(1).map((o: any, i: number) => ({ a: left[i].name, b: o.name, gap: o.top - left[i].bottom })), hits };
    });
    expect(metrics.text.length).toBeGreaterThan(6);
    for (const t of metrics.text) {
      expect(t.font, `${t.name}: ${t.value}`).toBeGreaterThanOrEqual(t.floor);
      expect(t.left, t.name).toBeGreaterThanOrEqual(190); expect(t.right, t.name).toBeLessThanOrEqual(1090);
      expect(t.top, t.name).toBeGreaterThanOrEqual(110); expect(t.bottom, t.name).toBeLessThanOrEqual(630);
    }
    for (const pair of metrics.leftGaps) expect(pair.gap, `${pair.a} / ${pair.b}`).toBeGreaterThanOrEqual(0);
    for (const h of metrics.hits) { expect(h.width).toBeGreaterThanOrEqual(44); expect(h.height).toBeGreaterThanOrEqual(44); }
    for (let i = 0; i < metrics.hits.length; i++) for (const b of metrics.hits.slice(i + 1)) {
      const a = metrics.hits[i];
      expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top).toBe(true);
    }
  };
  for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
    await page.setViewportSize({ width, height }); await settleCanvas(page); await check();
    await page.screenshot({ path: info.outputPath(`${kind}-${width}.png`) });
  }
  const stress = await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), p = r.pendingRouteReward;
    p.choiceText = 'A deliberately long bird-led decision with complete consequences. '.repeat(8);
    p.effectText = 'Gain Scrap and prepare for the next encounter without losing the complete explanation. '.repeat(12);
    p.decisionPreview = Array.from({ length: 8 }, (_, i) => `Projected change ${i + 1}: ` + 'Complete details remain available. '.repeat(3));
    r.renderAll(); return { choice: p.choiceText, effect: p.effectText, rows: p.decisionPreview };
  });
  await settleCanvas(page); await check();
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('route-decision-choice').text)).toMatch(/…$/);
  await page.screenshot({ path: info.outputPath(`${kind}-stress-1000.png`) });
  const before = await page.evaluate(() => JSON.stringify((window as any).__birdSquadGame.scene.getScene('RouteScene').runState));
  const point = await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), c = r.game.canvas.getBoundingClientRect();
    const hit = r.children.getByName('route-decision-inspect-hit') ?? r.children.getByName('route-outcome-inspect-hit'), b = hit.getBounds();
    return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720 };
  });
  await page.touchscreen.tap(point.x, point.y); await settleCanvas(page);
  const reading = await page.evaluate(() => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene'), all: string[] = [], issues: string[] = [];
    const p = r.children.getByName('route-supply-reader'), scale = r.game.canvas.getBoundingClientRect().height / 720;
    for (let i = 0; i < 200; i++) {
      const debug = JSON.parse(w.render_game_to_text()).routeReward, state = debug.itemInspection ?? debug.supplyInspection;
      all.push(state.reading.text);
      for (const t of p.list.filter((o: any) => o.type === 'Text')) {
        if (parseFloat(t.style.fontSize) * scale < 14 || t.getBounds().left < 404 || t.getBounds().right > 876 || t.getBounds().bottom > 660) issues.push(t.text);
      }
      if (state.reading.page === state.reading.total) break;
      p.getData('turnRulesPage')(1);
    }
    return { all, issues };
  });
  expect(reading.issues).toEqual([]);
  const normalize = (s: string) => s.replace(/\s/g, '');
  const full = normalize(reading.all.join(''));
  for (const value of [stress.choice, stress.effect, ...stress.rows]) expect(full).toContain(normalize(value));
  expect(await page.evaluate(() => JSON.stringify((window as any).__birdSquadGame.scene.getScene('RouteScene').runState))).toBe(before);
  expect(errors).toEqual([]);
});

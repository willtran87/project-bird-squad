// Measure the same real title -> route -> card -> enemy-turn journey before and
// after optimizations. Native clocks only; isolated contexts, no rule overrides.
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import assert from 'node:assert/strict';

const url = process.env.PERF_URL ?? 'http://127.0.0.1:5501/';
const output = process.env.PERF_OUTPUT ?? '.artifacts/runtime-performance.json';
const widths = (process.env.PERF_WIDTHS ?? '2560,1440,1000').split(',').map(Number);
const report = {
  measuredAt: new Date().toISOString(), url,
  method: 'Sequential fresh Chromium contexts; native requestAnimationFrame and Long Tasks; real inputs; no advanceTime or throttling. Automation host, not physical-device certification.',
  host: { platform: os.platform(), cpu: os.cpus()[0].model, logicalCpus: os.cpus().length }, cases: [],
};
const browser = await chromium.launch({ headless: true });
report.browser = browser.version();
try {
  for (const width of widths) for (const reduced of [false, true]) {
    const context = await browser.newContext({ viewport: { width, height: width === 2560 ? 1600 : width === 1440 ? 900 : 560 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    try {
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      if (process.env.PERF_MSAA === '0') await page.addInitScript(() => {
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, options) {
          return getContext.call(this, type, /webgl/.test(type) ? { ...options, antialias: false } : options);
        };
      });
      await page.addInitScript(() => {
        const metrics = window.__wallMetrics = { frames: [], longTasks: [], last: 0 };
        new PerformanceObserver(list => metrics.longTasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration })))).observe({ type: 'longtask', buffered: true });
        const frame = time => { if (metrics.last) metrics.frames.push({ time, delta: time - metrics.last }); metrics.last = time; requestAnimationFrame(frame); };
        requestAnimationFrame(frame);
      });
      await page.goto(`${url}?flight=all-a-performance&length=quick`);
      await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').titleBoot?.ready);
      const start = await page.evaluate(() => {
        const game = window.__birdSquadGame, gl = game.renderer.gl, extension = gl?.getExtension('WEBGL_debug_renderer_info');
        return { titleReadyMs: performance.now(), renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER), canvas: { width: game.canvas.width, height: game.canvas.height } };
      });
      const sample = async (label, duration, action) => {
        const begin = await page.evaluate(() => performance.now());
        if (action) await action();
        await page.waitForTimeout(duration);
        return page.evaluate(({ label, begin }) => {
          const end = performance.now(), metrics = window.__wallMetrics;
          const frames = metrics.frames.filter(f => f.time >= begin && f.time <= end).map(f => f.delta).sort((a, b) => a - b);
          const tasks = metrics.longTasks.filter(t => t.start >= begin && t.start < end);
          const quantile = p => frames[Math.min(frames.length - 1, Math.floor(frames.length * p))];
          return { label, durationMs: end - begin, frames: frames.length, meanIntervalMs: frames.reduce((a, b) => a + b, 0) / frames.length, p50Ms: quantile(.5), p95Ms: quantile(.95), maxMs: frames.at(-1), longTaskCount: tasks.length, longTaskMs: tasks.reduce((a, b) => a + b.duration, 0) };
        }, { label, begin });
      };
      const samples = [await sample('title-idle', 3000)];
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => { const g = window.__birdSquadGame; return g.scene.isActive('RouteScene') && g.scene.getScene('RouteScene').routeEssentialAssetsReady; });
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => !window.__birdSquadGame.scene.getScene('RouteScene').shouldChooseDistrictContract());
      samples.push(await sample('route-entry', 3000));
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => { const s = JSON.parse(window.render_game_to_text?.() ?? '{}'); return s.scene === 'BattleScene' && s.assetReadiness?.fullArt && !s.combatIntro?.active && !s.combatAnimationPending; });
      const baseline = await page.evaluate(() => { const b = window.__birdSquadGame.scene.getScene('BattleScene'); return { played: b.statCardsPlayed, turn: b.turn, card: b.hand[0].name, instance: b.hand[0].instanceId }; });
      const cdp = process.env.PERF_PROFILE === '1' ? await context.newCDPSession(page) : undefined;
      if (cdp) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.start'); }
      samples.push(await sample('battle-idle', 5000));
      samples.push(await sample('card-and-enemy-turn', 10000, async () => {
        await page.keyboard.press('1');
        const selection = await page.evaluate(() => { const b = window.__birdSquadGame.scene.getScene('BattleScene'); return { played: b.statCardsPlayed, selected: b.selectedInstanceId }; });
        if (selection.played === baseline.played) { assert.equal(selection.selected, baseline.instance); await page.keyboard.press('Enter'); }
        else assert.equal(selection.played, baseline.played + 1);
        await page.waitForFunction(played => { const b = window.__birdSquadGame.scene.getScene('BattleScene'); return b.statCardsPlayed === played + 1 && !b.combatAnimationPending; }, baseline.played);
        await page.keyboard.press('r');
      }));
      if (cdp) { const { profile } = await cdp.send('Profiler.stop'); fs.writeFileSync(`${output}.${width}-${reduced}.cpuprofile`, JSON.stringify(profile)); await cdp.detach(); }
      const after = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
      assert.equal(after.scene, 'BattleScene'); assert.equal(after.combatAnimationPending, false); assert.equal(after.combatEnemyTurnBeat, 'idle');
      assert.ok(after.log.some(line => line.includes(baseline.card)), 'Real selected card resolved'); assert.ok(after.turn > baseline.turn, 'Real enemy turn completed'); assert.deepEqual(errors, []);
      const delivery = await page.evaluate(() => {
        const entries = performance.getEntriesByType('resource');
        return { js: entries.filter(e => /\.js(?:\?|$)/.test(e.name)).map(e => ({ name: e.name.split('/').at(-1), bytes: e.decodedBodySize })), resources: entries.length, decodedBytes: entries.reduce((sum, e) => sum + e.decodedBodySize, 0) };
      });
      await page.screenshot({ path: `${output}.${width}-${reduced}.png` });
      report.cases.push({ width, reduced, ...start, playedCard: baseline.card, samples, delivery, combatRender: after.combatRender, errors });
      fs.writeFileSync(output, JSON.stringify(report, null, 2));
      console.log(JSON.stringify({ width, reduced, samples }));
    } finally { await context.close(); }
  }
} finally { await browser.close(); }

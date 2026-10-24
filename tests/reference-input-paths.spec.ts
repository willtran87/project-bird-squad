import { test, expect, type Page } from '@playwright/test';
import { installVirtualController, pressController } from './helpers/virtual-controller';
import { writeFile } from 'node:fs/promises';
import { settleCanvas } from './helpers/settled-canvas';

// No scene jumps, resource grants, damage overrides or mechanical fast-forward.
// This is a reproducible scripted player, not authentic player/balance evidence.
const referenceJourneys = new WeakMap<Page, any[]>();
for (const input of ['pointer', 'controller'] as const) test(`${input}-only reference flight reaches outcome and replay`, async ({ page }, info) => {
  // Linux controller input can still be progressing at decision 260 after
  // twenty minutes. Preserve action/decision bounds while allowing completion.
  test.setTimeout(1800000);
  if (input === 'controller') await installVirtualController(page);
  await page.addInitScript(() => { (window as any).__testKeyboardEvents = 0; addEventListener('keydown', () => (window as any).__testKeyboardEvents++); });
  const press = (key: string, decision?: any) => inputAction(page, input, key, decision);
  page.setDefaultTimeout(20000);
  const errors: string[] = [], journey: any[] = [];
  referenceJourneys.set(page, journey);
  const captured = new Set<string>();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./?flight=all-a-reference&length=quick');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await press('Enter', { kind: 'start' });
  let terminal = '';
  let lastDecision = '', repeated = 0;
  for (let step = 0; step < 320 && !terminal; step++) {
    await page.waitForFunction(() => {
      if (document.querySelector('#flyway-book h1')?.textContent === 'Choose this bird’s Preen') return true;
      const g = (window as any).__birdSquadGame;
      if (g.scene.isActive('RouteScene')) {
        const r = g.scene.getScene('RouteScene');
        return r.routeEssentialAssetsReady && !r.routeCommitPending;
      }
      if (!g.scene.isActive('BattleScene')) return false;
      const b = g.scene.getScene('BattleScene');
      return b.fxLayer?.active && b.combatPreviewModule && !b.combatIntroActive && !b.combatAnimationPending
        && !b.battleRenderQueued && (b.mode === 'battle' || b.rewardPresentationReady());
    });
    const decision = await page.evaluate(() => {
      if (document.querySelector('#flyway-book h1')?.textContent === 'Choose this bird’s Preen') {
        return { kind: 'preen-branch', key: document.activeElement?.textContent === 'Choose Shelter' ? 'Enter' : 'ArrowRight' };
      }
      const g = (window as any).__birdSquadGame;
      if (g.scene.isActive('RouteScene')) {
        const r = g.scene.getScene('RouteScene');
        if (r.shouldChooseDistrictContract()) return { kind: 'contract', key: 'Enter' };
        if (r.cardPickerMode) return { kind: 'preen', key: 'Enter' };
        if (r.pendingRouteReward) return { kind: 'route-reward', key: 'Enter' };
        if (r.marketOpen) return { kind: 'market-exit', key: 'Escape' };
        if (r.nodeChoiceOpen) {
          const choices = r.eventChoices();
          const wanted = choices.findIndex((c: any) => !c.locked && /recover|cache_scrap|decline/.test(c.key));
          const index = wanted >= 0 ? wanted : choices.findIndex((c: any) => !c.locked);
          const focus = JSON.parse((window as any).render_game_to_text()).nodeChoice.focus.index;
          return { kind: 'event', key: focus === index ? 'Enter' : 'ArrowRight', index, choiceKey: choices[index].key };
        }
        const nodes = r.getSelectableNodes();
        const rank = (n: any) => n.type === 'basin' && r.runState.currentHp < r.runMaxHp() * 0.8 ? 0
          : n.type === 'boss' ? 1 : n.type === 'cache' ? 2 : n.type === 'street' ? 3 : 4;
        nodes.sort((a: any, b: any) => rank(a) - rank(b) || a.id.localeCompare(b.id));
        const target = nodes[0];
        return { kind: 'route', key: r.selectedNodeId === target?.id ? 'Enter' : 'ArrowRight', node: target?.id };
      }
      const b = g.scene.getScene('BattleScene');
      if (['defeat', 'runComplete'].includes(b.mode)) return { kind: b.mode };
      if (b.mode !== 'battle') return { kind: b.mode, key: 'Enter' };
      if (b.returnChoice || b.discardChoice) return { kind: 'choice', key: 'Enter' };
      const incoming = b.incomingFlockDamagePreview().hpLoss;
      const candidates: any[] = [];
      for (const [index, card] of b.hand.entries()) {
        const contract = b.activeCardContract(card);
        if (b.effectiveCost(card) > b.energy || contract.target === 'choice'
          || contract.effects.some((e: string) => /returnFromDiscard|discard\(/.test(e))) continue;
        for (const enemy of b.enemies.filter((e: any) => e.hp > 0)) {
          const outcome = b.simulateCardOutcome(card, enemy.id);
          const score = outcome.enemyDamage + Math.min(incoming, outcome.coverGain) * 0.85
            + outcome.cohesionDelta * 0.8 + outcome.flowGain * 0.15;
          if (score > 0 && !outcome.requiresChoice) candidates.push({ index, card, enemy, target: contract.target, score });
        }
      }
      candidates.sort((a, z) => z.score - a.score);
      const pick = candidates[0];
      if (!pick) return { kind: 'roost', key: 'r', turn: b.turn };
      const canvas = b.game.canvas.getBoundingClientRect();
      const hp = b.enemyHpBar(pick.enemy);
      return { kind: 'play', key: String(pick.index + 1), id: pick.card.id, target: pick.target,
        played: b.statCardsPlayed, instance: pick.card.instanceId, enemyId: pick.enemy.id,
        point: { x: canvas.left + hp.x * canvas.width / 1280, y: canvas.top + (hp.y - 19) * canvas.height / 720 } };
    });
    journey.push(decision);
    if (step % 20 === 0) console.log(`${input} flight: decision ${step}, ${decision.kind}`);
    const fingerprint = JSON.stringify(decision);
    repeated = fingerprint === lastDecision ? repeated + 1 : 0;
    lastDecision = fingerprint;
    expect(repeated, `No live-control progress: ${fingerprint}`).toBeLessThan(12);
    if (!captured.has(decision.kind)) {
      captured.add(decision.kind);
      await settleCanvas(page);
      await page.screenshot({ path: info.outputPath(`${decision.kind}-1440.png`) });
    }
    if (['defeat', 'runComplete'].includes(decision.kind)) { terminal = decision.kind; break; }
    await press(decision.key!, decision);
    if (decision.kind === 'play') {
      await page.waitForFunction(id => (window as any).__birdSquadGame.scene.getScene('BattleScene').selectedInstanceId === id, decision.instance);
      if (!captured.has('inspected-card')) {
        const stable = () => page.evaluate(() => {
          const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
          return JSON.stringify({ selected: b.selectedInstanceId, target: b.selectedEnemyId, energy: b.energy, turn: b.turn });
        });
        const before = await stable();
        await press('h', { kind: 'inspect' });
        await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').combatCardDetail?.active);
        await press('Escape', { kind: 'inspect-close' });
        expect(await stable()).toBe(before); captured.add('inspected-card');
      }
      if (input === 'pointer' && decision.target === 'enemy') await page.mouse.click(decision.point!.x, decision.point!.y);
      else {
        if (input === 'controller' && decision.target === 'enemy') {
          for (let attempts = 0; attempts < 5; attempts++) {
            if (await page.evaluate(id => (window as any).__birdSquadGame.scene.getScene('BattleScene').selectedEnemyId === id, decision.enemyId)) break;
            await pressController(page, 13);
          }
          expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').selectedEnemyId)).toBe(decision.enemyId);
        }
        await press('Enter', { ...decision, kind: 'commit-card' });
      }
      await page.waitForFunction(played => {
        const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
        return b.statCardsPlayed > played! || b.mode !== 'battle';
      }, decision.played);
    } else if (decision.kind === 'roost') {
      await page.waitForFunction(turn => {
        const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
        return b.turn > turn! || b.mode !== 'battle';
      }, decision.turn);
    } else if (decision.kind === 'route' && decision.key === 'Enter') {
      // Wait through the route scene's handoff, not just its travel tween.
      // The scene can briefly be running with pending=false before shutdown.
      await page.waitForFunction(() => {
        const g = (window as any).__birdSquadGame;
        if (!g.scene.isActive('RouteScene')) return true;
        const r = g.scene.getScene('RouteScene');
        return r.nodeChoiceOpen || r.pendingRouteReward || r.marketOpen || r.cardPickerMode;
      });
    }
    await settleCanvas(page);
  }
  const report = await page.evaluate(() => (window as any).__birdSquadLastRun);
  const reportPath = info.outputPath('live-control-journey.json');
  await writeFile(reportPath, JSON.stringify({ terminal, journey, report }, null, 2));
  await info.attach('live-control-journey', { path: reportPath, contentType: 'application/json' });
  expect(terminal).toBe('runComplete');
  expect(await page.evaluate(() => (window as any).__testKeyboardEvents)).toBe(0);
  for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
    await page.setViewportSize({ width, height }); await settleCanvas(page);
    await page.screenshot({ path: info.outputPath(`outcome-${width}.png`) });
  }
  expect(captured.has('play')).toBe(true);
  expect(captured.has('cardReward')).toBe(true);
  expect(report.seed).toBe('all-a-reference');
  expect(errors).toEqual([]);
  // Outcome's primary action must remain reachable without a scene API call.
  await press('Enter', { kind: 'replay' });
  await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.isActive('BattleScene')
    || !['defeat', 'runComplete'].includes((window as any).__birdSquadGame.scene.getScene('BattleScene').mode));
});

test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus) return;
  await info.attach('partial-live-control-journey', {
    body: JSON.stringify(referenceJourneys.get(page) ?? [], null, 2), contentType: 'application/json',
  });
  const state = await page.evaluate(() => (window as any).render_game_to_text?.() ?? '{}').catch(() => 'unavailable');
  await writeFile(info.outputPath('failed-state.json'), state);
  await page.screenshot({ path: info.outputPath('failed-screen.png') }).catch(() => {});
  await info.attach('failed-live-state', { body: state, contentType: 'application/json' });
});


async function inputAction(page: Page, input: 'pointer' | 'controller', key: string, decision: any) {
  if (input === 'pointer' && decision.kind === 'preen-branch') {
    await page.getByRole('button', { name: 'Choose Shelter', exact: true }).click();
    return;
  }
  if (input === 'controller') {
    if (decision.kind === 'play') {
      const index = Number(key) - 1;
      for (let i = 0; i < 12; i++) {
        const cursor = await page.evaluate(() => {
          const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
          return { index: b.controllerChoiceIndex, count: b.hand.length };
        });
        if (cursor.index === index) break;
        // Use the shorter live D-pad path instead of circling the whole hand
        // when the next chosen card sits immediately to the left.
        const right = (index - cursor.index + cursor.count) % cursor.count;
        const left = (cursor.index - index + cursor.count) % cursor.count;
        await pressController(page, cursor.index >= 0 && left < right ? 14 : 15);
      }
      expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').controllerChoiceIndex)).toBe(index);
      if (!await page.evaluate(id => (window as any).__birdSquadGame.scene.getScene('BattleScene').selectedInstanceId === id, decision.instance)) await pressController(page, 0);
      return;
    }
    const button = ({ Enter: 0, ArrowRight: 15, Escape: 1, r: 3, h: 11 } as Record<string, number>)[key];
    if (button === undefined) throw new Error('Unmapped controller action: ' + key);
    await pressController(page, button);
    return;
  }
  await settleCanvas(page);
  if (decision.kind === 'play') {
    // A legal hand can span pages. Reach the chosen card through the visible
    // pager before looking up its hit area, just as a pointer player must.
    for (let attempts = 0; attempts < 20; attempts++) {
      const pager = await page.evaluate(instance => {
        const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
        const index = b.hand.findIndex((card: any) => card.instanceId === instance);
        if (index < 0) throw new Error('Chosen card left the hand before selection');
        const target = Math.floor(index / 5);
        if (target === b.handPage) return null;
        const name = target > b.handPage ? 'combat-hand-next' : 'combat-hand-previous';
        const collect = (list: any[]): any[] => list.flatMap(o => [o, ...collect(o.list ?? [])]);
        const hit = collect(b.children.list).find(o => o.name === name && o.input?.enabled);
        if (!hit) throw new Error('Missing visible hand pager: ' + name);
        const r = hit.getBounds(), c = b.game.canvas.getBoundingClientRect();
        return { page: b.handPage, x: c.left + r.centerX * c.width / 1280, y: c.top + r.centerY * c.height / 720 };
      }, decision.instance);
      if (!pager) break;
      await page.mouse.click(pager.x, pager.y);
      await page.waitForFunction(previous => (window as any).__birdSquadGame.scene.getScene('BattleScene').handPage !== previous, pager.page);
      await settleCanvas(page);
    }
  }
  const point = await page.evaluate(({ key, decision }) => {
    const g = (window as any).__birdSquadGame;
    const sceneKey = ['BattleScene', 'RouteScene', 'MenuScene'].find(key => g.scene.isActive(key));
    if (!sceneKey) throw new Error('No active input scene for ' + JSON.stringify(decision) + ': ' + (window as any).render_game_to_text());
    const scene = g.scene.getScene(sceneKey);
    const collect = (items: any[]): any[] => items.filter(o => o.active && o.visible).flatMap(o => [o, ...collect(o.list ?? [])]);
    const all = collect(scene.children.list);
    const named = (name: string) => all.find(o => o.name === name && o.input?.enabled);
    let hit: any;
    switch (decision.kind) {
      case 'start': hit = scene.menuFocusTargets.get('primaryRun'); break;
      case 'contract': hit = named('district-contract-option'); break;
      case 'preen': hit = named('card-picker-confirmation-command-frame') ?? named('card-picker-card-hit'); break;
      case 'market-exit': hit = all.find(o => o.name === 'market-enamel-button-hit' && ['Close', 'Clear'].includes(o.getData('label'))); break;
      case 'event': hit = all.find(o => o.name === 'route-choice-option-frame' && o.getData('choiceKey') === decision.choiceKey); break;
      case 'route':
        hit = scene.selectedNodeId === decision.node ? named('route-commit-hit')
          : all.find(o => o.name === 'route-node-icon' && o.getData('routeNodeId') === decision.node);
        break;
      case 'route-reward': hit = named('route-reward-card-hit') ?? named('route-supply-reward-hit') ?? named('route-reward-claim-hit'); break;
      case 'play': case 'commit-card': hit = scene.handCardRects.get(decision.instance); break;
      case 'inspect': hit = named('combat-card-inspect-hit'); break;
      case 'inspect-close': hit = named('combat-card-detail-close'); break;
      case 'roost': hit = named('combat-roost-hit'); break;
      case 'cardReward': case 'upgradeReward': hit = named('reward-card-take-hit') ?? named('reward-choice-card-hit'); break;
      case 'waymarkReward': hit = named('reward-waymark-hit') ?? named('reward-fallback-choice-hit'); break;
      case 'replay': hit = named('run-outcome-command-hit'); break;
    }
    if (!hit) throw new Error('Missing pointer action ' + JSON.stringify(decision) + '; available: ' + all.filter(o => o.input?.enabled).map(o => o.name).join(','));
    const r = hit.getBounds(), c = g.canvas.getBoundingClientRect();
    return { x: c.left + r.centerX * c.width / 1280, y: c.top + r.centerY * c.height / 720 };
  }, { key, decision });
  await page.mouse.click(point.x, point.y);
}

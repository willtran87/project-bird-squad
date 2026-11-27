import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';
import { boot } from './helpers/smoke';

// Split from the former tests/smoke.spec.ts (onboarding topics). Tests drive
// scenes through the deterministic text-state harness on window.

test('first-flight guidance exposes route tradeoffs and Flow outcome previews', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const route: any = g.scene.getScene('RouteScene');
    const routeState = JSON.parse(window.render_game_to_text!());
    const reachable = routeState.nodes.find((node: any) => node.selectable);
    route.selectRouteNode(reachable.id);
    const selectedRouteState = JSON.parse(window.render_game_to_text!());
    const routeGuidanceText = route.children.list
      .filter((child: any) => child.name === 'first-route-guidance' && typeof child.text === 'string')
      .map((child: any) => child.text)
      .join(' ');
    const routeCommitLabel = route.children.list.some((child: any) => child.name === 'route-commit-label');

    route.commitRouteNode(reachable.id);
    const battle: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 120 && (!battle.scene.isActive() || battle.combatAnimationPending); i += 1) await new Promise((resolve) => setTimeout(resolve, 50));
    battle.flock.flow = Math.min(2, battle.flock.flowMax - 1);
    battle.flock.block = 0;
    battle.renderAll();
    const flowBreakState = JSON.parse(window.render_game_to_text!());
    const incoming = battle.incomingFlockDamagePreview();
    if (incoming.total <= 0) throw new Error('Expected the opening Tell to threaten the Flow rail');
    battle.flock.block = incoming.total;
    battle.renderAll();
    const flowHoldState = JSON.parse(window.render_game_to_text!());
    battle.flock.block = 0;
    battle.flock.flow = Math.max(0, battle.flock.flowMax - 1);
    battle.renderAll();
    await new Promise((resolve) => setTimeout(resolve, 80));
    const guideState = JSON.parse(window.render_game_to_text!());
    const guideAnnouncement = document.getElementById('game-status')?.textContent ?? '';
    const guidePulseRendered = battle.handLayer.list.some((child: any) => child.name === 'combat-first-card-guide-pulse');
    const guideCardTagRendered = battle.handLayer.list.some((child: any) => child.name === 'combat-first-card-guide-tag');
    const guideTargetRendered = battle.root.list.some((child: any) => child.name === 'combat-first-target-guide');
    const otherPlayableCards = guideState.hand.filter((candidate: any) =>
      candidate.name !== guideState.firstCombatGuidance.cardName
      && candidate.cost <= guideState.energy
      && battle.handCardRects.get(candidate.instanceId)?.input?.enabled
    ).length;
    const card = battle.hand.find((candidate: any) => {
      const contract = battle.activeCardContract(candidate);
      return contract.target === 'enemy' && battle.cardBuildsFlow(candidate) && battle.effectiveCost(candidate) <= battle.energy;
    });
    if (!card) throw new Error('Expected a targeted Flow-building card in the opening hand');
    battle.onCardClicked(card.instanceId);
    const battleState = JSON.parse(window.render_game_to_text!());
    const visibleFlowHints = [...battle.handCardFlowIndicators.values()]
      .filter((indicator: any) => indicator.container.visible).length;
    const flowRailRect = battle.root.list.find((child: any) => child.name === 'combat-flow-rail')?.getBounds();
    const guidePanel = battle.root.list.find((child: any) => child.name === 'first-combat-guidance' && child.geom);
    const guideLabel = battle.root.list.find((child: any) => child.name === 'first-combat-guidance' && typeof child.text === 'string');
    const guideRect = guidePanel?.getBounds();
    const guideLabelRect = guideLabel?.getBounds();
    const flowRailBounds = flowRailRect && {
      width: flowRailRect.width,
      bottom: flowRailRect.y + flowRailRect.height,
    };
    const guideBounds = guideRect && { top: guideRect.y };

    return {
      routeGuidance: routeState.firstRouteGuidance,
      selectedRouteGuidance: selectedRouteState.firstRouteGuidance,
      routeGuidanceText,
      routeCommitLabel,
      routeDecision: reachable?.decision,
      flowRail: battleState.flowRail,
      flowPreview: battleState.flowPreview,
      flowBreakRail: flowBreakState.flowRail,
      flowHoldRail: flowHoldState.flowRail,
      flowRailBounds,
      guideBounds,
      guideVisual: {
        text: guideLabel?.text,
        fontSize: Number.parseFloat(guideLabel?.style?.fontSize ?? '0'),
        panelSize: guidePanel ? [guidePanel.displayWidth, guidePanel.displayHeight] : [],
        leftInset: guideRect && guideLabelRect ? guideLabelRect.left - guideRect.left : -1,
        rightInset: guideRect && guideLabelRect ? guideRect.right - guideLabelRect.right : -1,
      },
      combatGuidance: battleState.firstCombatGuidance,
      guideRecommendation: guideState.firstCombatGuidance,
      guideEnergy: guideState.energy,
      guideAnnouncement,
      guidePulseRendered,
      guideCardTagRendered,
      guideTargetRendered,
      visibleFlowHints,
      otherPlayableCards,
      outcome: battleState.selectedCardOutcome
    };
  });
  await page.screenshot({ path: '.artifacts/test-results/flow-centered-hud/selected-surge-next-1280x720.png' });
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(150);
  await page.screenshot({ path: '.artifacts/test-results/flow-centered-hud/selected-surge-next-1024x768.png' });
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.waitForTimeout(150);
  await page.screenshot({ path: '.artifacts/test-results/flow-centered-hud/first-combat-numbered-guidance-1000x560.png' });

  expect(result.routeGuidance).toEqual({ active: true, rendered: true });
  expect(result.selectedRouteGuidance).toEqual({ active: true, rendered: true });
  expect(result.routeGuidanceText).toContain('GAIN');
  expect(result.routeGuidanceText).toContain('RISK');
  expect(result.routeCommitLabel).toBe(true);
  expect(result.routeDecision.benefit.length).toBeGreaterThan(0);
  expect(result.routeDecision.risk.length).toBeGreaterThan(0);
  expect(result.flowRail.rendered).toBe(true);
  expect(result.flowRail.previewPips).toBe(1);
  expect(result.flowRail.status).toBe('SURGE / BREAK');
  expect(result.flowPreview).toBe(1);
  expect(result.flowBreakRail.status).toBe('FLOW BREAKS');
  expect(result.flowBreakRail.breakPreview).toBe(true);
  expect(result.flowHoldRail.status).toBe('FLOW HOLDS');
  expect(result.flowHoldRail.holdPreview).toBe(true);
  expect(result.flowRailBounds.width).toBeGreaterThanOrEqual(190);
  expect(result.flowRailBounds.bottom).toBeLessThan(result.guideBounds.top);
  expect(result.combatGuidance).toMatchObject({ active: true, rendered: true });
  expect(result.guideRecommendation).toMatchObject({
    active: true,
    rendered: true,
    cardName: expect.any(String),
    cost: expect.any(Number),
    target: expect.any(String),
  });
  expect(result.guideRecommendation.cost).toBeLessThanOrEqual(result.guideEnergy);
  expect(result.guideVisual.text).toMatch(/^Select .+; target .+\. \d+ Wingbeats?( \(energy\))?\.$/);
  expect(result.guideVisual.fontSize).toBe(21);
  expect(result.guideVisual.panelSize).toEqual([600, 58]);
  expect(result.guideVisual.leftInset).toBeGreaterThanOrEqual(14);
  expect(result.guideVisual.rightInset).toBeGreaterThanOrEqual(14);
  expect(result.guidePulseRendered).toBe(false);
  expect(result.guideCardTagRendered).toBe(true);
  expect(result.guideTargetRendered).toBe(true);
  expect(result.visibleFlowHints).toBe(1);
  expect(result.otherPlayableCards).toBeGreaterThan(0);
  expect(result.guideAnnouncement).toContain(`Start with ${result.guideRecommendation.cardName}`);
  expect(result.guideAnnouncement).toContain(`targeting ${result.guideRecommendation.target}`);
  expect(result.outcome.result.flow.before).toBe(result.outcome.result.flow.max - 1);
  expect(result.outcome.result.flow.after).toBe(result.outcome.result.flow.max);
  expect(result.outcome.summary).toContain(`Flow ${result.outcome.result.flow.before} -> Surge`);
  expect(result.outcome.target.length).toBeGreaterThan(0);
});

test('first-flight guide persists, can be skipped or replayed, and completes through live decisions', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    const helpActions = (menu: any) => menu.helpOverlay?.list
      .filter((child: any) => typeof child.text === 'string')
      .map((child: any) => child.text) ?? [];
    const waitForHelpAction = async (menu: any, expected: string) => {
      for (let i = 0; i < 80; i += 1) {
        const actions = helpActions(menu);
        if (actions.includes(expected)) return actions;
        await wait(50);
      }
      throw new Error(`How to Play did not render ${expected}`);
    };
    const activateHelpAction = (menu: any, label: string) => {
      const hit = menu.helpOverlay?.list.find((child: any) => (
        child.input?.enabled && child.getData?.('label') === label
      ));
      if (!hit) throw new Error(`How to Play action ${label} is not interactive`);
      hit.emit('pointerdown');
    };
    window.localStorage.removeItem('birdsquad.firstFlightGuide');

    await window.__birdSquadStartScene!('MenuScene');
    const menu: any = g.scene.getScene('MenuScene');
    menu.openHelpOverlay();
    const initialActions = await waitForHelpAction(menu, 'Skip Guide');
    const initialGuide = JSON.parse(window.render_game_to_text!()).firstFlightGuide;
    activateHelpAction(menu, 'Skip Guide');
    const skippedActions = await waitForHelpAction(menu, 'Replay Guide');
    const skippedGuide = JSON.parse(window.render_game_to_text!()).firstFlightGuide;
    activateHelpAction(menu, 'Replay Guide');
    await waitForHelpAction(menu, 'Skip Guide');
    const replayedGuide = JSON.parse(window.render_game_to_text!()).firstFlightGuide;
    menu.closeHelpOverlay();

    const route: any = await window.__birdSquadStartScene!('RouteScene', {});
    const routeState = JSON.parse(window.render_game_to_text!());
    const reachable = route.getSelectableNodes()[0];
    route.commitRouteNode(reachable.id);
    await wait(100);
    const battle: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 120 && (!battle.scene.isActive() || battle.combatAnimationPending); i += 1) await wait(50);
    const cardStageState = JSON.parse(window.render_game_to_text!());
    const cardStage = cardStageState.firstFlightGuide;
    const cardStageGuidance = cardStageState.firstCombatGuidance;
    battle.endTurn({ enemyPacing: false });
    await wait(50);
    const prematureRoostStage = JSON.parse(window.render_game_to_text!()).firstFlightGuide;
    const card = battle.hand.find((candidate: any) => battle.effectiveCost(candidate) <= battle.energy && battle.activeCardContract(candidate).target !== 'enemy')
      ?? battle.hand.find((candidate: any) => battle.effectiveCost(candidate) <= battle.energy);
    const target = battle.enemies.find((enemy: any) => enemy.hp > 0)?.id;
    battle.playCard(card, target);
    await wait(50);
    const roostStageState = JSON.parse(window.render_game_to_text!());
    const roostStage = roostStageState.firstFlightGuide;
    const roostStageGuidance = roostStageState.firstCombatGuidance;
    const firstCardGuideRetired = !battle.handLayer.list.some((child: any) =>
      child.name === 'combat-first-card-guide-pulse' || child.name === 'combat-first-card-guide-tag'
    ) && !battle.root.list.some((child: any) => child.name === 'combat-first-target-guide');
    battle.endTurn({ enemyPacing: false });
    await wait(50);
    const rewardStage = JSON.parse(window.render_game_to_text!()).firstFlightGuide;
    battle.rewardChoices = battle.createRewardChoices();
    battle.mode = 'cardReward';
    battle.renderAll();
    const rewardCard = battle.rewardChoices[0];
    battle.chooseRewardCard(rewardCard.id);
    await wait(30);
    const completedGuide = JSON.parse(window.localStorage.getItem('birdsquad.firstFlightGuide') ?? '{}');

    return {
      initialGuide,
      initialActions,
      skippedGuide,
      skippedActions,
      replayedGuide,
      routeGuide: routeState.firstFlightGuide,
      cardStage,
      cardStageGuidance,
      prematureRoostStage,
      roostStage,
      roostStageGuidance,
      firstCardGuideRetired,
      rewardStage,
      completedGuide
    };
  });

  expect(result.initialGuide.step).toBe('route');
  expect(result.initialActions).toContain('Skip Guide');
  expect(result.skippedGuide.step).toBe('off');
  expect(result.skippedGuide.skipped).toBe(1);
  expect(result.skippedActions).toContain('Replay Guide');
  expect(result.replayedGuide.step).toBe('route');
  expect(result.replayedGuide.replays).toBe(1);
  expect(result.routeGuide.seen).toContain('route');
  expect(result.cardStage.step).toBe('card');
  expect(result.cardStageGuidance).toMatchObject({
    cardName: expect.any(String),
    target: expect.any(String),
  });
  expect(result.prematureRoostStage).toMatchObject({ step: 'card', cardsPlayed: 0, roosts: 0 });
  expect(result.roostStage.step).toBe('roost');
  expect(result.roostStageGuidance.cardName).toBeUndefined();
  expect(result.firstCardGuideRetired).toBe(true);
  expect(result.rewardStage.step).toBe('reward');
  expect(result.completedGuide.completed).toBe(true);
  expect(result.completedGuide.enabled).toBe(false);
  expect(result.completedGuide.seen).toEqual(expect.arrayContaining(['route', 'card', 'roost', 'reward']));
});

test('contextual Molt lesson waits for a Molt card, respects skip, and retires after play', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const guideKey = 'birdsquad.firstFlightGuide';
    const baseGuide = {
      enabled: false,
      completed: false,
      routeCommits: 0,
      cardsPlayed: 0,
      roosts: 0,
      rewardsResolved: 0,
      seen: [],
      skipped: 1,
      replays: 0,
      moltLessonSeen: 0,
      moltLessonCompleted: false,
    };
    window.localStorage.setItem(guideKey, JSON.stringify(baseGuide));
    const scene: any = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    for (let i = 0; i < 120 && (!scene.scene.isActive() || scene.combatAnimationPending); i += 1) await wait(50);
    const moltCard = scene.allDeckCards().find((card: any) => card.runtime?.kind === 'molt');
    if (!moltCard) throw new Error('Starter flight did not contain a Molt card.');
    scene.hand = scene.hand.filter((card: any) => card.instanceId !== moltCard.instanceId);
    scene.drawPile = scene.drawPile.filter((card: any) => card.instanceId !== moltCard.instanceId);
    scene.discardPile = scene.discardPile.filter((card: any) => card.instanceId !== moltCard.instanceId);
    scene.hand.unshift(moltCard);
    scene.energy = 99;
    scene.combatAnimationPending = false;
    scene.mode = 'battle';
    scene.renderAll();
    await wait(120);
    const skipped = JSON.parse(window.render_game_to_text!());

    window.localStorage.setItem(guideKey, JSON.stringify({
      ...baseGuide,
      completed: true,
      routeCommits: 1,
      cardsPlayed: 1,
      roosts: 1,
      rewardsResolved: 1,
      skipped: 0,
      seen: ['route', 'card', 'roost', 'reward'],
    }));
    scene.renderAll();
    for (let i = 0; i < 80; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (state.firstMoltGuide?.rendered) break;
      await wait(50);
      scene.renderAll();
    }
    const active = JSON.parse(window.render_game_to_text!());
    const activeObjects = scene.handLayer.list.filter((child: any) => child.name?.startsWith('combat-molt-guide'));
    const guideText = scene.root.list
      .filter((child: any) => child.name === 'first-combat-guidance' && typeof child.text === 'string')
      .map((child: any) => child.text);
    const storedSeen = JSON.parse(window.localStorage.getItem(guideKey) ?? '{}');

    scene.playCard(moltCard, scene.enemies.find((enemy: any) => enemy.hp > 0)?.id, { resolveDelayMs: 0 });
    await wait(100);
    const completed = JSON.parse(window.render_game_to_text!());
    const storedCompleted = JSON.parse(window.localStorage.getItem(guideKey) ?? '{}');
    const remainingGuideObjects = scene.handLayer.list.filter((child: any) => child.name?.startsWith('combat-molt-guide')).length;

    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    await wait(100);
    const restarted = JSON.parse(window.render_game_to_text!());
    return {
      cardName: active.firstMoltGuide.cardName,
      skipped: skipped.firstMoltGuide,
      active: active.firstMoltGuide,
      activeObjectNames: activeObjects.map((child: any) => child.name),
      guideText,
      storedSeen,
      completed: completed.firstMoltGuide,
      storedCompleted,
      remainingGuideObjects,
      restarted: restarted.firstMoltGuide,
    };
  });

  expect(result.skipped).toMatchObject({ eligible: false, active: false, seen: 0, completed: false, rendered: false });
  expect(result.active).toMatchObject({ eligible: true, active: true, seen: 1, completed: false, rendered: true });
  expect(result.cardName).toBe('Hot Feathers');
  expect(result.activeObjectNames).not.toContain('combat-molt-guide-pulse');
  expect(result.activeObjectNames).toContain('combat-molt-guide-tag');
  expect(result.guideText).toEqual([
    `Play ${result.cardName} for less this beat. Roost to open the sky.`,
  ]);
  expect(result.storedSeen.moltLessonSeen).toBe(1);
  expect(result.completed).toMatchObject({ eligible: false, active: false, seen: 1, completed: true, rendered: false });
  expect(result.storedCompleted.moltLessonCompleted).toBe(true);
  expect(result.remainingGuideObjects).toBe(0);
  expect(result.restarted).toMatchObject({ eligible: false, active: false, completed: true, rendered: false });
});

test('How to Play teaches the full loop with readable unclipped text and matching narration', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await boot(page);
  await page.keyboard.press('h');
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text!());
    const menu = window.__birdSquadGame.scene.getScene('MenuScene');
    // The quiet guide renders without requesting retired decorative frames.
    return state.helpOpen
      && menu.helpOverlay?.list.filter((o: any) => o.name === 'how-to-play-topic-rule').length === 6;
  });
  for (const size of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(size);
    await page.waitForFunction(() => {
      const canvas = document.querySelector('canvas')!.getBoundingClientRect();
      return canvas.left >= 0 && canvas.top >= 0 && canvas.right <= innerWidth + 1 && canvas.bottom <= innerHeight + 1;
    });
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const layout = await page.evaluate(() => {
      const menu = window.__birdSquadGame.scene.getScene('MenuScene');
      const children = menu.helpOverlay.list;
      const panels = children.filter((o: any) => o.name === 'how-to-play-topic-rule');
      const texts = children.filter((o: any) => o.name === 'how-to-play-readable');
      const icons = children.filter((o: any) => o.name === 'how-to-play-topic-icon');
      return {
        state: JSON.parse(window.render_game_to_text!()).helpContent,
        narratedTexts: children.filter((o: any) => ['guide-download-status', 'how-to-play-readable', 'how-to-play-tip-label', 'how-to-play-tip-value'].includes(o.name)).map((o: any) => o.text),
        texts: texts.map((o: any) => o.text),
        panels: panels.length,
        icons: icons.length,
        iconOverlap: icons.some((icon: any, i: number) => icon.getBounds().right + 6 > texts[i * 2].getBounds().left),
        overflow: panels.some((panel: any, i: number) => {
          const box = panel.getBounds();
          return texts.slice(i * 2, 2 + i * 2).some((text: any) => {
            const b = text.getBounds();
            return b.left < box.left - 12 || b.right > box.right + 12 || b.top < box.bottom + 8 || b.bottom > box.bottom + 148;
          });
        }),
        minFont: Math.min(...texts.map((o: any) => parseInt(o.style.fontSize))),
        clipping: texts.some((o: any) => o.style.maxLines > 0 || o.style.fixedHeight > 0),
      };
    });
    expect(layout.panels).toBe(6);
    expect(layout.icons).toBe(0);
    expect(layout.iconOverlap).toBe(false);
    expect(layout.overflow).toBe(false);
    expect(layout.minFont).toBeGreaterThanOrEqual(19);
    expect(layout.clipping).toBe(false);
    expect(layout.state).toEqual(layout.narratedTexts);
    expect(layout.state.join(' ')).toContain('Shift+X or RT');
    expect(layout.texts.join(' ')).toContain('Skip keeps the deck and grants Scrap');
    expect(layout.texts.join(' ')).toContain('without adding a copy');
    await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent)).toContain('6 / Learn and Fly Again');
    await page.screenshot({ path: `.artifacts/test-results/full-loop-help/help-${size.width}x${size.height}.png` });
  }
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !JSON.parse(window.render_game_to_text!()).helpOpen);
  expect(errors).toEqual([]);
});

test('title How to Play overlay opens with quiet controls and stable guide actions', async ({ page }) => {
  await boot(page);
  await page.keyboard.press('h');
  await page.waitForFunction(() => {
    const m = window.__birdSquadGame.scene.getScene('MenuScene');
    return m.helpOverlay?.list.filter((o: any) => o.name === 'how-to-play-topic-rule').length === 6;
  });
  await settleCanvas(page);
  const inspect = () => page.evaluate(() => {
    const m = window.__birdSquadGame.scene.getScene('MenuScene');
    const state = JSON.parse(window.render_game_to_text!());
    return { open: state.helpOpen, settings: state.settingsOpen,
      decorations: m.helpOverlay.list.filter((o: any) => o.type === 'Image').length,
      controls: m.helpOverlay.list.filter((o: any) => o.input?.enabled && o.type === 'Rectangle' && o.getData('labelObject'))
        .map((o: any) => ({ label: o.getData('labelObject').text, width: o.displayWidth, height: o.displayHeight })),
      topics: m.helpOverlay.list.filter((o: any) => o.name === 'how-to-play-topic-rule').length,
    };
  });
  const first = await inspect();
  expect(first).toMatchObject({ open: true, settings: false, decorations: 0, topics: 6 });
  expect(first.controls).toEqual([
    { label: 'Close', width: 104, height: 58 },
    { label: 'Key terms', width: 180, height: 58 },
    { label: expect.stringMatching(/^(Skip|Replay) Guide$/), width: 190, height: 58 },
    { label: 'Practice lessons', width: 230, height: 58 },
  ]);
  await page.keyboard.press('h');
  await settleCanvas(page);
  expect(await inspect()).toEqual(first);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => JSON.parse(window.render_game_to_text!()).helpOpen)).toBe(false);
});

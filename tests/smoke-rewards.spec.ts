import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';
import { UI_CONTROL } from '../src/game/ui-tokens';
import { branchCards } from '../src/game/flyway-rules';
import { boot, clickNamedGameObject } from './helpers/smoke';

// Split from the former tests/smoke.spec.ts (rewards topics). Tests drive
// scenes through the deterministic text-state harness on window.

test('mixed route card-choice rewards preserve the card choice before opening Preen', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const collectObjects = (root: any): any[] => {
      const out: any[] = [];
      const visit = (node: any) => {
        if (!node) return;
        out.push(node);
        const children = node.list ?? node.children?.list;
        if (Array.isArray(children)) children.forEach(visit);
      };
      visit(root);
      return out;
    };
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const route: any = g.scene.getScene('RouteScene');
    route.runState.deck = [
      { id: 'major_00' },
      { id: 'major_01' },
      { id: 'major_02' }
    ];
    const node = { id: 'audit_tangled_antenna', type: 'signal', label: 'Tangled Antenna', payloadId: 'rooftop_tangled_antenna' };
    const choice = {
      key: 'untangle',
      text: 'Untangle carefully.',
      effects: ['addCard(chooseOneOfTwoUncommonOrRare)', 'preenCard(1)'],
      locked: false
    };
    route.openRouteRewardMenu(node, choice, structuredClone(route.runState));
    for (let i = 0; i < 40 && !route.textures.exists('ui-icon-reward-reveal-halo'); i += 1) await wait(50);
    route.renderAll();
    for (let i = 0; i < 40; i += 1) {
      if (collectObjects(route.children).some((child: any) => child.texture?.key === 'ui-icon-reward-reveal-halo')) break;
      await wait(50);
    }
    const offered = route.routeCardRewardChoices.map((card: any) => card.id);
    const rewardRevealHaloLoaded = route.textures.exists('ui-icon-reward-reveal-halo');
    const rewardRevealHaloRendered = collectObjects(route.children).some((child: any) => child.texture?.key === 'ui-icon-reward-reveal-halo');
    route.chooseRouteRewardCard(offered[0]);
    const collectionRecord = JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}').cardCollection?.[offered[0]];
    return {
      offered,
      rewardRevealHaloLoaded,
      rewardRevealHaloRendered,
      deckIds: route.runState.deck.map((card: any) => card.id),
      cardPickerMode: route.cardPickerMode,
      remainingPicks: route.cardPickerRemainingPicks,
      pendingCleared: !route.pendingRouteReward,
      choicesCleared: route.routeCardRewardChoices.length,
      collectionRecord
    };
  });

  expect(result.offered).toHaveLength(2);
  expect(result.rewardRevealHaloLoaded).toBe(true);
  expect(result.rewardRevealHaloRendered).toBe(false); // No decorative halo competes with the choices.
  expect(result.deckIds).toContain(result.offered[0]);
  expect(result.deckIds).not.toContain(result.offered[1]);
  expect(result.cardPickerMode).toBe('preen');
  expect(result.remainingPicks).toBe(1);
  expect(result.pendingCleared).toBe(true);
  expect(result.choicesCleared).toBe(0);
  expect(result.collectionRecord).toMatchObject({ timesClaimed: 1, firstSource: 'route_reward' });
});

test('card reward can be skipped for a Scrap fallback, recorded for stats', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.rewardChoices = [{ id: 'wands_02' }, { id: 'cups_02' }];
    scene.mode = 'cardReward';
    scene.combatEconomyAwarded = true; // Fixture the post-combat reward, not unpaid fight earnings.
    scene.shouldOfferUpgradeReward = () => true;
    const scrapBefore = scene.scrap;
    scene.skipCardReward();
    return { scrapDelta: scene.scrap - scrapBefore, rewardEvents: scene.runRewardEvents, mode: scene.mode };
  });
  expect(result.scrapDelta).toBe(12);
  expect(result.mode).toBe('upgradeReward');
  expect(result.rewardEvents[0].skipped).toBe(true);
  expect(result.rewardEvents[0].offered).toContain('wands_02');
});

test('card reward skip requires intentional confirmation across pointer keyboard and controller', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await boot(page);

  await page.evaluate(async () => {
    const scene: any = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    scene.combatEconomyAwarded = true;
    scene.shouldOfferUpgradeReward = () => true;
    scene.rewardChoices = scene.createRewardChoices().slice(0, 3);
    scene.rewardDecisionStartedAtMs = Date.now();
    scene.mode = 'cardReward';
    scene.rewardChoiceArmedId = undefined;
    scene.rewardSkipArmed = false;
    scene.controllerChoiceIndex = 0;
    scene.battleInputActive = false;
    scene.renderAll();
  });
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const scene: any = window.__birdSquadGame?.scene?.getScene('BattleScene');
    return state.mode === 'cardReward'
      && state.battleRewardRenderer?.ready
      && scene?.root?.list?.some((child: any) => child.name === 'reward-skip-hit' && child.input?.enabled);
  });

  const snapshot = () => page.evaluate(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
    const skipTexts = scene.root.list
      .filter((child: any) => child.type === 'Text' && (
        child.text?.includes('Skip') || child.text?.includes('BACK CANCELS')
      ))
      .map((child: any) => child.text);
    return {
      state,
      scrap: scene.scrap,
      rewardEvents: scene.runRewardEvents.length,
      skipTexts,
      skipTitles: scene.root.list
        .filter((child: any) => child.name === 'reward-skip-title')
        .map((child: any) => child.text),
      skipSummaries: scene.root.list
        .filter((child: any) => child.name === 'reward-skip-summary')
        .map((child: any) => child.text),
      skipRings: scene.root.list
        .filter((child: any) => child.name === 'reward-skip-focus-ring')
        .map((child: any) => ({ width: child.lineWidth, color: child.strokeColor })),
      choiceRings: scene.root.list
        .filter((child: any) => child.name === 'reward-input-focus-ring')
        .map((child: any) => ({ width: child.lineWidth, color: child.strokeColor })),
      choiceRingXs: scene.root.list
        .filter((child: any) => child.name === 'reward-input-focus-ring')
        .map((child: any) => child.x),
      inputHints: scene.root.list
        .filter((child: any) => child.name === 'combat-input-hint' && child.type === 'Text')
        .map((child: any) => child.text),
      liveText: document.getElementById('game-status')?.textContent ?? '',
    };
  });
  const clickSkip = async () => {
    const center = await page.evaluate(() => {
      const scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
      const hit = scene.root.list.find((child: any) => child.name === 'reward-skip-hit' && child.input?.enabled);
      if (!hit) throw new Error('Missing reward skip command');
      return { x: hit.x, y: hit.y };
    });
    const canvas = await page.locator('canvas').boundingBox();
    if (!canvas) throw new Error('Missing game canvas');
    await page.mouse.click(
      canvas.x + canvas.width * (center.x / 1280),
      canvas.y + canvas.height * (center.y / 720),
    );
  };
  const resetReward = () => page.evaluate(() => {
    const scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
    scene.mode = 'cardReward';
    scene.rewardChoices = scene.createRewardChoices().slice(0, 3);
    scene.upgradeChoices = [];
    scene.rewardChoiceArmedId = undefined;
    scene.rewardSkipArmed = false;
    scene.controllerChoiceIndex = 0;
    scene.battleInputActive = false;
    scene.rewardDecisionStartedAtMs = Date.now();
    scene.renderAll();
  });
  const gamepadDown = (index: number) => page.evaluate((buttonIndex) => {
    const scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
    scene.input.gamepad.emit('down', scene.input.gamepad.pad1, { index: buttonIndex }, 1);
  }, index);

  const initial = await snapshot();
  expect(initial.state.rewardSkip).toMatchObject({
    available: true,
    armed: false,
    commitBlockedUntilConfirmed: true,
    input: { keyboard: 'X', controller: 'X', pointer: 'Activate Skip twice', cancel: 'Esc / B' },
  });
  expect(initial.skipTitles).toEqual([`Skip +${initial.state.rewardSkip.scrap} Scrap`]);
  expect(initial.skipSummaries).toEqual([`Deck ${initial.state.rewardSkip.deckSize} unchanged / ${initial.state.rewardSkip.scrapAfter} Scrap`]);
  expect(initial.skipRings).toEqual([]);
  expect(initial.choiceRings).toEqual([]);
  expect(initial.state.combatInputFocus).toMatchObject({ active: false, index: 0, visibleFocus: false });

  await clickSkip();
  await expect.poll(async () => (await snapshot()).state.rewardSkip.armed).toBe(true);
  const pointerArmed = await snapshot();
  expect(pointerArmed.scrap).toBe(initial.scrap);
  expect(pointerArmed.rewardEvents).toBe(initial.rewardEvents);
  expect(pointerArmed.skipTitles).toEqual([`Confirm skip +${initial.state.rewardSkip.scrap} Scrap`]);
  expect(pointerArmed.skipSummaries).toEqual(initial.skipSummaries);
  expect(pointerArmed.skipTexts.join(' ')).not.toContain('Confirm Skip');
  expect(pointerArmed.skipTexts.join(' ')).not.toContain('BACK CANCELS');
  expect(pointerArmed.skipRings).toEqual([{ width: 3, color: 0xd8a840 }]);
  expect(pointerArmed.choiceRings).toEqual([]);
  expect(pointerArmed.inputHints).toEqual([
    'Click Skip again to confirm · Back cancels',
  ]);
  await expect(page.locator('#game-status')).toContainText('Skip confirmation');
  await page.screenshot({ path: '.artifacts/test-results/reward-skip-confirmation-1000x560.png' });

  await page.keyboard.press('Escape');
  await expect.poll(async () => (await snapshot()).state.rewardSkip.armed).toBe(false);
  const pointerCancelled = await snapshot();
  expect(pointerCancelled.scrap).toBe(initial.scrap);
  expect(pointerCancelled.rewardEvents).toBe(initial.rewardEvents);
  expect(pointerCancelled.state.mode).toBe('cardReward');
  expect(pointerCancelled.skipTitles).toEqual(initial.skipTitles);
  expect(pointerCancelled.skipSummaries).toEqual(initial.skipSummaries);
  expect(pointerCancelled.skipRings).toEqual([]);
  expect(pointerCancelled.choiceRings).toEqual([]);
  expect(pointerCancelled.state.combatInputFocus).toMatchObject({ active: false, index: 0, visibleFocus: false });
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/reward-skip-pointer-cancel-neutral-1000x560.png' });

  await clickSkip();
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await snapshot()).state.rewardSkip.armed).toBe(true);
  expect((await snapshot()).state.rewardChoiceConfirmation?.armed).toBe(false);
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await snapshot()).state.rewardChoiceConfirmation?.armed).toBe(true);
  const enteredFirstCard = await snapshot();
  expect(enteredFirstCard.state.rewardSkip.armed).toBe(false);
  expect(enteredFirstCard.state.combatInputFocus).toMatchObject({ active: true, index: 0, visibleFocus: true });
  expect(enteredFirstCard.choiceRings).toEqual([{ width: 3, color: 0xd8a840 }]);
  expect(enteredFirstCard.choiceRingXs).toEqual([336]);
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/reward-skip-to-first-card-1000x560.png' });
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await snapshot()).state.rewardChoiceConfirmation?.armed).toBe(false);

  await resetReward();
  await clickSkip();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await snapshot()).state.rewardChoiceConfirmation?.armed).toBe(true);
  const enteredLastCard = await snapshot();
  expect(enteredLastCard.state.rewardSkip.armed).toBe(false);
  expect(enteredLastCard.state.combatInputFocus).toMatchObject({ active: true, index: 2, visibleFocus: true });
  expect(enteredLastCard.choiceRings).toEqual([{ width: 3, color: 0xd8a840 }]);
  expect(enteredLastCard.choiceRingXs).toEqual([944]);
  await page.keyboard.press('Escape');

  await resetReward();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await snapshot()).state.rewardChoiceConfirmation?.armed).toBe(true);
  await page.keyboard.press('Escape');
  await page.keyboard.press('x');
  await expect.poll(async () => (await snapshot()).state.rewardSkip.armed).toBe(true);
  await page.keyboard.press('Escape');
  const restoredPriorFocus = await snapshot();
  expect(restoredPriorFocus.state.combatInputFocus).toMatchObject({ active: true, index: 1, visibleFocus: true });
  expect(restoredPriorFocus.choiceRings).toEqual([{ width: 3, color: 0x8df4ff }]);
  expect(restoredPriorFocus.choiceRingXs).toEqual([640]);

  await resetReward();
  await clickSkip();
  await clickSkip();
  await expect.poll(async () => (await snapshot()).state.mode).toBe('upgradeReward');
  const pointerCommitted = await snapshot();
  expect(pointerCommitted.scrap - initial.scrap).toBe(initial.state.rewardSkip.scrap);
  expect(pointerCommitted.rewardEvents).toBe(initial.rewardEvents + 1);

  await resetReward();
  const keyboardBefore = await snapshot();
  await page.keyboard.press('x');
  await expect.poll(async () => (await snapshot()).state.rewardSkip.armed).toBe(true);
  expect((await snapshot()).scrap).toBe(keyboardBefore.scrap);
  await page.keyboard.press('x');
  await expect.poll(async () => (await snapshot()).state.mode).toBe('upgradeReward');
  expect((await snapshot()).rewardEvents).toBe(keyboardBefore.rewardEvents + 1);

  await resetReward();
  const controllerBefore = await snapshot();
  await gamepadDown(2);
  await expect.poll(async () => (await snapshot()).state.rewardSkip.armed).toBe(true);
  expect((await snapshot()).scrap).toBe(controllerBefore.scrap);
  await gamepadDown(1);
  await expect.poll(async () => (await snapshot()).state.rewardSkip.armed).toBe(false);
  expect((await snapshot()).state.mode).toBe('cardReward');
  expect((await snapshot()).scrap).toBe(controllerBefore.scrap);
  expect((await snapshot()).choiceRings).toEqual([]);
  await gamepadDown(2);
  await gamepadDown(2);
  await expect.poll(async () => (await snapshot()).state.mode).toBe('upgradeReward');
  const controllerCommitted = await snapshot();
  expect(controllerCommitted.rewardEvents).toBe(controllerBefore.rewardEvents + 1);
  expect(controllerCommitted.scrap - controllerBefore.scrap).toBe(controllerBefore.state.rewardSkip.scrap);
});

test('reward choices require intentional commitment across pointer keyboard and controller', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await boot(page);

  const snapshot = () => page.evaluate(() => {
    const scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const hintPanel = scene.root?.list.find((child: any) => child.name === 'combat-input-hint' && child.type === 'Rectangle');
    const hintLabel = scene.root?.list.find((child: any) => child.name === 'combat-input-hint' && child.type === 'Text');
    const hintPanelBounds = hintLabel?.getBounds();
    const hintLabelBounds = hintLabel?.getBounds();
    const deckNeedBounds = scene.root?.list
      .filter((child: any) => String(child.name).startsWith('reward-deck-need-chip-frame'))
      .map((child: any) => child.getBounds());
    const decisionBounds = scene.root?.list
      .filter((child: any) => child.name === 'reward-choice-card-hit')
      .map((child: any) => child.getBounds());
    const cardHits = scene.root?.list.filter((child: any) => child.name === 'reward-choice-card-hit') ?? [];
    const waymarkHits = scene.root?.list.filter((child: any) => child.name === 'reward-waymark-hit') ?? [];
    const focusRings = scene.root?.list.filter((child: any) => child.name === 'reward-input-focus-ring') ?? [];
    const focusRingBounds = focusRings.map((child: any) => child.getBounds());
    const hoverRings = scene.root?.list.filter((child: any) => child.name === 'reward-choice-hover-ring') ?? [];
    const inspectHits = scene.root?.list.filter((child: any) => child.name === 'reward-card-inspect-hit') ?? [];
    const inspectLabels = scene.root?.list.filter((child: any) => child.name === 'reward-card-inspect-label') ?? [];
    return {
      state,
      deckSize: scene.allDeckCards().length,
      upgraded: scene.allDeckCards().filter((card: any) => card.upgraded).length,
      rewardEvents: scene.runRewardEvents.length,
      routeMarks: scene.routeMarks.map((mark: any) => typeof mark === 'string' ? mark : mark.id),
      confirmLabels: scene.root?.list
        ?.filter((child: any) => child.type === 'Text' && child.name === 'combat-input-hint')
        .map((child: any) => child.text) ?? [],
      focusChrome: {
        cardBorders: cardHits.map((child: any) => ({ width: child.lineWidth, color: child.strokeColor })),
        waymarkBorders: waymarkHits.map((child: any) => ({ width: child.lineWidth, color: child.strokeColor })),
        rings: focusRings.map((child: any) => ({ width: child.lineWidth, color: child.strokeColor })),
      },
      inspectChrome: {
        labels: inspectLabels.map((child: any) => ({ text: child.text, color: child.style?.color })),
        buttons: inspectHits.map((child: any) => ({
          enabled: Boolean(child.input?.enabled),
          disabled: child.getData('disabled'),
          fillAlpha: child.fillAlpha,
          fillColor: child.fillColor,
          strokeColor: child.strokeColor,
        })),
      },
      rewardHint: {
        text: hintLabel?.text,
        fontSize: Number.parseFloat(hintLabel?.style?.fontSize ?? '0'),
        textColor: hintLabel?.style?.color,
        strokeColor: hintPanel?.strokeColor,
        panelSize: hintPanel ? [hintPanel.displayWidth, hintPanel.displayHeight] : [],
        panelY: hintPanel?.y,
        leftInset: hintLabelBounds?.left ?? -1,
        rightInset: hintLabelBounds ? 1280 - hintLabelBounds.right : -1,
        deckGap: hintPanelBounds && deckNeedBounds?.length
          ? hintPanelBounds.top - Math.max(...deckNeedBounds.map((bounds: any) => bounds.bottom))
          : -1,
        choiceGap: hintPanelBounds && decisionBounds?.length
          ? Math.min(...decisionBounds.map((bounds: any) => bounds.top)) - hintPanelBounds.bottom
          : -1,
        focusGap: hintPanelBounds && focusRingBounds.length
          ? Math.min(...focusRingBounds.map((bounds: any) => bounds.top)) - hintPanelBounds.bottom
          : -1,
      },
      liveText: document.getElementById('game-status')?.textContent ?? '',
      inspectionFooter: scene.rewardInspectionLayer?.list
        ?.filter((child: any) => child.type === 'Text' && child.text?.includes('RETURN TO'))
        .map((child: any) => child.text) ?? [],
      hoverChrome: {
        visibleRings: hoverRings.filter((child: any) => child.visible !== false && child.alpha > 0.01).length,
        previewOpen: Boolean(scene.cardPreview?.active),
        previewBounds: (() => {
          const bounds = scene.cardPreview?.getBounds?.();
          return bounds ? {
            left: Math.round(bounds.left),
            top: Math.round(bounds.top),
            right: Math.round(bounds.right),
            bottom: Math.round(bounds.bottom),
          } : undefined;
        })(),
      },
    };
  });
  const waitForReward = async (mode: string) => {
    await expect.poll(async () => {
      const result = await snapshot();
      return result.state.mode === mode
        && result.state.battleRewardRenderer?.ready
        && result.state.rewardChoiceConfirmation?.available;
    }, { timeout: 30_000 }).toBe(true);
  };
  const startCardReward = async () => {
    await page.evaluate(async () => {
      const scene: any = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
      scene.combatEconomyAwarded = true;
      scene.shouldOfferUpgradeReward = () => true;
      scene.rewardChoices = scene.createRewardChoices().slice(0, 3);
      scene.rewardDecisionStartedAtMs = Date.now();
      scene.rewardChoiceArmedId = undefined;
      scene.rewardSkipArmed = false;
      scene.controllerChoiceIndex = 0;
      scene.battleInputActive = false;
      scene.mode = 'cardReward';
      scene.renderAll();
    });
    await waitForReward('cardReward');
  };
  const clickReward = async (index: number) => {
    const center = await page.evaluate((choiceIndex) => {
      const scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
      const hits = scene.root.list.filter((child: any) => child.name === 'reward-choice-card-hit' && child.input?.enabled);
      const hit = hits[choiceIndex];
      if (!hit) throw new Error(`Missing reward choice ${choiceIndex}`);
      return { x: hit.x, y: hit.y };
    }, index);
    const canvas = await page.locator('canvas').boundingBox();
    if (!canvas) throw new Error('Missing game canvas');
    await page.mouse.click(
      canvas.x + canvas.width * (center.x / 1280),
      canvas.y + canvas.height * (center.y / 720),
    );
  };
  const moveToReward = async (index: number) => {
    const center = await page.evaluate((choiceIndex) => {
      const scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
      const hits = scene.root.list.filter((child: any) => child.name === 'reward-choice-card-hit' && child.input?.enabled);
      const hit = hits[choiceIndex];
      if (!hit) throw new Error(`Missing reward choice ${choiceIndex}`);
      return { x: hit.x, y: hit.y };
    }, index);
    const canvas = await page.locator('canvas').boundingBox();
    if (!canvas) throw new Error('Missing game canvas');
    await page.mouse.move(
      canvas.x + canvas.width * (center.x / 1280),
      canvas.y + canvas.height * (center.y / 720),
    );
  };
  const moveAwayFromRewards = async () => {
    const canvas = await page.locator('canvas').boundingBox();
    if (!canvas) throw new Error('Missing game canvas');
    await page.mouse.move(canvas.x + 8, canvas.y + 8);
  };
  const clickSkip = async () => {
    const center = await page.evaluate(() => {
      const scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
      const hit = scene.root.list.find((child: any) => child.name === 'reward-skip-hit' && child.input?.enabled);
      if (!hit) throw new Error('Missing reward skip command');
      return { x: hit.x, y: hit.y };
    });
    const canvas = await page.locator('canvas').boundingBox();
    if (!canvas) throw new Error('Missing game canvas');
    await page.mouse.click(
      canvas.x + canvas.width * (center.x / 1280),
      canvas.y + canvas.height * (center.y / 720),
    );
  };
  const clickInspect = async (index: number) => {
    const center = await page.evaluate((choiceIndex) => {
      const scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
      const hits = scene.root.list.filter((child: any) => child.name === 'reward-card-inspect-hit');
      const hit = hits[choiceIndex];
      if (!hit) throw new Error(`Missing reward Inspect ${choiceIndex}`);
      return { x: hit.x, y: hit.y };
    }, index);
    const canvas = await page.locator('canvas').boundingBox();
    if (!canvas) throw new Error('Missing game canvas');
    await page.mouse.click(
      canvas.x + canvas.width * (center.x / 1280),
      canvas.y + canvas.height * (center.y / 720),
    );
  };
  const gamepadDown = (index: number) => page.evaluate((buttonIndex) => {
    const scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
    scene.input.gamepad.emit('down', scene.input.gamepad.pad1, { index: buttonIndex }, 1);
  }, index);

  await startCardReward();
  const initial = await snapshot();
  expect(initial.state.rewardChoiceConfirmation).toMatchObject({
    available: true,
    armed: false,
    mode: 'cardReward',
    commitBlockedUntilSelected: true,
    input: { keyboard: 'Enter', controller: 'A', pointer: 'Activate choice twice', cancel: 'Esc / B' },
  });
  expect(initial.focusChrome.cardBorders).toHaveLength(3);
  expect(initial.focusChrome.cardBorders.every((border: any) => border.width === 2 && border.color !== 0x8df4ff)).toBe(true);
  expect(initial.focusChrome.rings).toEqual([]);
  expect(initial.inspectChrome.labels).toEqual([
    { text: 'Read', color: UI_CONTROL.text },
    { text: 'Read', color: UI_CONTROL.text },
    { text: 'Read', color: UI_CONTROL.text },
  ]);
  expect(initial.inspectChrome.buttons.every((button: any) => (
    button.enabled
    && button.disabled === false
    && button.fillAlpha >= 0.8
    && button.strokeColor !== 0x8df4ff
  ))).toBe(true);
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/reward-choice-neutral-1000x560.png' });

  await moveToReward(0);
  await expect.poll(async () => {
    const hover = (await snapshot()).hoverChrome;
    return hover.visibleRings === 1 && !hover.previewOpen;
  }).toBeTruthy();
  const browsingHover = (await snapshot()).hoverChrome;
  expect(browsingHover.previewBounds).toBeUndefined();
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/reward-hover-browse-1000x560.png' });
  await moveAwayFromRewards();
  await expect.poll(async () => (await snapshot()).hoverChrome).toMatchObject({ visibleRings: 0, previewOpen: false });

  await clickReward(1);
  await expect.poll(async () => (await snapshot()).state.rewardChoiceConfirmation?.armed).toBe(true);
  const pointerArmed = await snapshot();
  expect(pointerArmed.state.mode).toBe('cardReward');
  expect(pointerArmed.deckSize).toBe(initial.deckSize);
  expect(pointerArmed.rewardEvents).toBe(initial.rewardEvents);
  expect(pointerArmed.focusChrome.rings).toEqual([{ width: 3, color: 0xd8a840 }]);
  expect(pointerArmed.inspectChrome).toEqual(initial.inspectChrome);
  expect(pointerArmed.confirmLabels).toEqual([
    'Click Confirm to claim · Read inspects without claiming',
  ]);
  // New-collection identity occupies the compact context row. Exact deck
  // changes remain in the read-only deck-impact panel verified below.
  expect(pointerArmed.state.rewardChoices.every((c: any) => c.collection.firstClaim)).toBe(true);
  expect(pointerArmed.rewardHint).toMatchObject({
    text: pointerArmed.confirmLabels[0],
    fontSize: 19,
    textColor: '#ffe1a3',
    panelSize: [],
  });
  expect(pointerArmed.rewardHint.leftInset).toBeGreaterThanOrEqual(8);
  expect(pointerArmed.rewardHint.rightInset).toBeGreaterThanOrEqual(8);
  expect(pointerArmed.rewardHint.deckGap).toBeGreaterThanOrEqual(2);
  expect(pointerArmed.rewardHint.choiceGap).toBeGreaterThanOrEqual(2);
  expect(pointerArmed.rewardHint.focusGap).toBeGreaterThanOrEqual(4);
  await expect(page.locator('#game-status')).toContainText('is selected. Activate Confirm');
  const armedChoiceId = pointerArmed.state.rewardChoiceConfirmation.choiceId;
  const armedChoiceName = pointerArmed.state.rewardChoiceConfirmation.choiceName;
  await clickInspect(2);
  await expect.poll(async () => (await snapshot()).state.rewardInspection).toMatchObject({
    open: true,
    returnArmed: true,
    returnChoiceId: armedChoiceId,
    returnChoiceName: armedChoiceName,
    returnIndex: 1,
  });
  const inspectingArmedChoice = await snapshot();
  expect(inspectingArmedChoice.state.rewardInspection.cardId).not.toBe(armedChoiceId);
  expect(inspectingArmedChoice.state.rewardChoiceConfirmation).toMatchObject({
    armed: true,
    choiceId: armedChoiceId,
  });
  await expect(page.locator('#game-status')).toContainText(`${armedChoiceName} remains selected`);
  expect(inspectingArmedChoice.inspectionFooter).toEqual([
    'Esc / B / TAP OUTSIDE  RETURN TO CONFIRM PICK',
  ]);
  expect(inspectingArmedChoice.deckSize).toBe(initial.deckSize);
  expect(inspectingArmedChoice.rewardEvents).toBe(initial.rewardEvents);
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/reward-card-inspection-armed-1000x560.png' });
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await snapshot()).state.rewardInspection?.open).toBe(false);
  const returnedToArmedChoice = await snapshot();
  expect(returnedToArmedChoice.state.rewardChoiceConfirmation).toMatchObject({
    armed: true,
    choiceId: armedChoiceId,
  });
  expect(returnedToArmedChoice.state.combatInputFocus).toMatchObject({ active: true, index: 1 });
  expect(returnedToArmedChoice.focusChrome.rings).toEqual([{ width: 3, color: 0xd8a840 }]);
  expect(returnedToArmedChoice.confirmLabels[0]).toContain('Enter: confirm');
  expect(returnedToArmedChoice.deckSize).toBe(initial.deckSize);
  expect(returnedToArmedChoice.rewardEvents).toBe(initial.rewardEvents);
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/reward-card-inspection-return-armed-1000x560.png' });
  await moveToReward(2);
  await expect.poll(async () => (await snapshot()).hoverChrome).toMatchObject({ visibleRings: 0, previewOpen: false });
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/reward-hover-locked-card-confirmation-1000x560.png' });
  await moveAwayFromRewards();
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/reward-choice-confirmation-1000x560.png' });

  await page.keyboard.press('Escape');
  await expect.poll(async () => (await snapshot()).state.rewardChoiceConfirmation?.armed).toBe(false);
  const cancelled = await snapshot();
  expect(cancelled.state.mode).toBe('cardReward');
  expect(cancelled.deckSize).toBe(initial.deckSize);
  expect(cancelled.rewardEvents).toBe(initial.rewardEvents);

  await clickSkip();
  await expect.poll(async () => (await snapshot()).state.rewardSkip?.armed).toBe(true);
  const skipArmed = await snapshot();
  const disabledSelect = await page.evaluate(() => {
    const objects = (window.__birdSquadGame.scene.getScene('BattleScene') as any).root.list;
    return { buttons: objects.filter((o: any) => o.name === 'reward-card-take-hit').map((o: any) => ({ enabled: Boolean(o.input?.enabled), disabled: o.getData('disabled'), alpha: o.fillAlpha })),
      labels: objects.filter((o: any) => o.name === 'reward-card-take-label').map((o: any) => o.style.color) };
  });
  expect(disabledSelect.buttons).toEqual(Array.from({ length: 3 }, () => ({ enabled: false, disabled: true, alpha: 1 })));
  expect(disabledSelect.labels).toEqual(Array(3).fill(UI_CONTROL.disabledText));
  expect(skipArmed.inspectChrome.labels).toEqual([
    { text: 'Read', color: UI_CONTROL.disabledText },
    { text: 'Read', color: UI_CONTROL.disabledText },
    { text: 'Read', color: UI_CONTROL.disabledText },
  ]);
  expect(skipArmed.inspectChrome.buttons).toEqual([
    { enabled: false, disabled: true, fillAlpha: 1, fillColor: UI_CONTROL.disabled, strokeColor: UI_CONTROL.border },
    { enabled: false, disabled: true, fillAlpha: 1, fillColor: UI_CONTROL.disabled, strokeColor: UI_CONTROL.border },
    { enabled: false, disabled: true, fillAlpha: 1, fillColor: UI_CONTROL.disabled, strokeColor: UI_CONTROL.border },
  ]);
  await clickInspect(0);
  await gamepadDown(3);
  expect((await snapshot()).state).toMatchObject({
    mode: 'cardReward',
    rewardSkip: { armed: true },
    rewardInspection: { open: false },
  });
  await moveToReward(2);
  await expect.poll(async () => (await snapshot()).hoverChrome).toMatchObject({ visibleRings: 0, previewOpen: false });
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/reward-hover-locked-skip-confirmation-1000x560.png' });
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/reward-skip-inspect-locked-1000x560.png' });
  await moveAwayFromRewards();
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await snapshot()).state.rewardSkip?.armed).toBe(false);
  await clickInspect(0);
  await expect.poll(async () => (await snapshot()).state.rewardInspection?.open).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await snapshot()).state.rewardInspection?.open).toBe(false);

  await clickReward(1);
  await clickReward(1);
  await waitForReward('upgradeReward');
  const cardCommitted = await snapshot();
  expect(cardCommitted.deckSize).toBe(initial.deckSize + 1);
  expect(cardCommitted.rewardEvents).toBe(initial.rewardEvents + 1);

  const beforeKeyboard = await snapshot();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await snapshot()).state.rewardChoiceConfirmation).toMatchObject({
    armed: true,
    mode: 'upgradeReward',
  });
  const keyboardSelected = await snapshot();
  expect(keyboardSelected.upgraded).toBe(beforeKeyboard.upgraded);
  expect(keyboardSelected.state.combatInputFocus).toMatchObject({
    active: true,
    kind: 'upgradeReward',
    index: (beforeKeyboard.state.combatInputFocus.index + 1) % beforeKeyboard.state.combatInputFocus.count,
  });
  expect(keyboardSelected.confirmLabels).toHaveLength(1);
  expect(keyboardSelected.confirmLabels[0]).toContain('Enter: confirm');
  expect(keyboardSelected.confirmLabels[0]).toContain('R: read');
  expect(keyboardSelected.state.rewardDecisionDeltas).toHaveLength(keyboardSelected.state.combatInputFocus.count);
  expect(keyboardSelected.state.rewardDecisionDeltas.every((label: string) => !label.includes('CONFIRM') && !label.includes('BACK CANCELS'))).toBe(true);
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/upgrade-reward-choice-confirmation-1000x560.png' });
  const preenCardId = await page.evaluate(() => window.__birdSquadGame.scene.getScene('BattleScene').rewardChoiceArmedId);
  await page.keyboard.press('Enter');
  if (branchCards.includes(preenCardId)) {
    await expect(page.getByRole('heading', { name: 'Choose this bird’s Preen', exact: true })).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Choose Shelter', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
  }
  await expect.poll(async () => (await snapshot()).state.mode).not.toBe('upgradeReward');
  expect((await snapshot()).upgraded).toBe(beforeKeyboard.upgraded + 1);

  await page.evaluate(async () => {
    const scene: any = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_boss' });
    scene.combatEconomyAwarded = true;
    scene.waymarkChoices = scene.createWaymarkRewardChoices().slice(0, 3);
    scene.rewardChoiceArmedId = undefined;
    scene.controllerChoiceIndex = 0;
    scene.battleInputActive = false;
    scene.mode = 'waymarkReward';
    scene.renderAll();
  });
  await waitForReward('waymarkReward');
  const beforeController = await snapshot();
  await gamepadDown(15);
  await expect.poll(async () => (await snapshot()).state.rewardChoiceConfirmation).toMatchObject({
    armed: true,
    mode: 'waymarkReward',
  });
  const controllerSelected = await snapshot();
  expect(controllerSelected.routeMarks).toEqual(beforeController.routeMarks);
  expect(controllerSelected.focusChrome.waymarkBorders).toHaveLength(3);
  // The readable Waymark layout uses quiet 1px command borders and one 2px
  // panel focus ring, not the former ornamental card frame.
  expect(controllerSelected.focusChrome.waymarkBorders.every((border: any) => border.width === 1 && border.color !== 0x8df4ff)).toBe(true);
  expect(controllerSelected.focusChrome.rings).toEqual([{ width: 2, color: 0xd8a840 }]);
  expect(controllerSelected.confirmLabels).toEqual([
    'D-pad: choose · A: confirm · Y: read · B: cancel',
  ]);
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/waymark-reward-choice-confirmation-1000x560.png' });
  const selectedMarkId = controllerSelected.state.rewardChoiceConfirmation.choiceId;
  await gamepadDown(1);
  await expect.poll(async () => (await snapshot()).state.rewardChoiceConfirmation?.armed).toBe(false);
  expect((await snapshot()).routeMarks).toEqual(beforeController.routeMarks);
  await gamepadDown(15);
  const committedMarkId = (await snapshot()).state.rewardChoiceConfirmation.choiceId;
  await gamepadDown(0);
  await expect.poll(async () => (await snapshot()).state.mode).toBe('cardReward');
  expect((await snapshot()).routeMarks).toContain(committedMarkId);
  expect(committedMarkId).not.toBe(selectedMarkId);
});

test('reward renderer loading skeleton preserves ceremony anchors until choices unlock', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await boot(page);

  await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const game = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_boss' });
    game.scene.stop('MenuScene');
    const battle: any = game.scene.getScene('BattleScene');
    for (let index = 0; index < 60 && !(battle.hand?.length && battle.battleHandRendererModule); index += 1) {
      await wait(50);
    }
    for (let index = 0; index < 60 && !battle.getTextState().screenReader?.observerActive; index += 1) {
      await wait(50);
    }
    const region = document.getElementById('game-status');
    (window as any).__rewardTransitionAnnouncements = [];
    new MutationObserver(() => {
      const announcement = region?.textContent?.trim();
      if (announcement) (window as any).__rewardTransitionAnnouncements.push(announcement);
    }).observe(region!, { childList: true, characterData: true, subtree: true });
    battle.rewardChoices = battle.hand.slice(0, 3);
    battle.controllerChoiceIndex = 0;
    battle.battleInputActive = true;
    battle.rewardChoiceArmedId = undefined;
    battle.rewardSkipArmed = false;
    battle.mode = 'cardReward';
    battle.battleRewardRendererModule = undefined;
    battle.battleRewardRendererLoading = true;
    battle.battleRewardRendererFailed = false;
    battle.renderAll();
  });

  const snapshot = () => page.evaluate(() => {
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    const objects = battle.root.list;
    const geometry = (object: any) => ({
      x: object.x,
      y: object.y,
      width: object.displayWidth,
      height: object.displayHeight,
    });
    return {
      state: battle.getTextState(),
      titles: objects
        .filter((object: any) => object.name === 'reward-loading-title')
        .map((object: any) => ({ text: object.text, ...geometry(object) })),
      loadingLabels: objects
        .filter((object: any) => object.name === 'reward-renderer-loading')
        .map((object: any) => object.text),
      slots: objects
        .filter((object: any) => object.name === 'reward-loading-choice-slot')
        .map(geometry),
      inspectSlots: objects
        .filter((object: any) => object.name === 'reward-loading-inspect-slot')
        .map(geometry),
      selectSlots: objects
        .filter((object: any) => object.name === 'reward-loading-select-slot')
        .map(geometry),
      readyInspect: objects
        .filter((object: any) => object.name === 'reward-card-inspect-hit')
        .map(geometry),
      readySelect: objects
        .filter((object: any) => object.name === 'reward-card-take-hit')
        .map(geometry),
      skipSlots: objects
        .filter((object: any) => object.name === 'reward-loading-skip-slot')
        .map(geometry),
      choiceHits: objects
        .filter((object: any) => object.name === 'reward-choice-card-hit' || object.name === 'reward-waymark-hit' || object.name === 'reward-fallback-choice-hit')
        .map(geometry),
      inputHints: objects
        .filter((object: any) => object.name === 'combat-input-hint' && object.type === 'Text')
        .map((object: any) => object.text),
      inputRails: objects
        .filter((object: any) => object.name === 'combat-input-hint' && object.type === 'Rectangle')
        .map(geometry),
      hintLabels: objects
        .filter((object: any) => object.name === 'combat-input-hint' && object.type === 'Text')
        .map((object: any) => ({ ...geometry(object), fontSize: Number.parseFloat(object.style.fontSize) })),
      liveText: document.getElementById('game-status')?.textContent?.trim() ?? '',
      announcements: [...((window as any).__rewardTransitionAnnouncements ?? [])],
    };
  });

  await expect.poll(async () => (await snapshot()).liveText).toBe('Reward choices are loading. Input is locked until every option is visible.');
  const loadingCard = await snapshot();
  expect(loadingCard.state.battleRewardRenderer).toMatchObject({ requested: true, ready: false, loaded: false, failed: false });
  expect(loadingCard.titles).toEqual([{ text: 'Add to the Flock', x: 640, y: 91, width: 1060, height: 52 }]);
  expect(loadingCard.loadingLabels).toEqual(['Preparing choices · Input unlocks when every option is visible.']);
  expect(loadingCard.slots).toEqual([336, 640, 944].map((x) => ({ x, y: 396, width: 264, height: 306 })));
  expect(loadingCard.inspectSlots).toEqual([336, 640, 944].map((x) => ({ x: x - 76, y: 586, width: 104, height: 58 })));
  expect(loadingCard.selectSlots).toEqual([336, 640, 944].map((x) => ({ x: x + 56, y: 586, width: 144, height: 58 })));
  expect(loadingCard.skipSlots).toEqual([{ x: 982, y: 652, width: 324, height: 58 }]);
  expect(loadingCard.choiceHits).toEqual([]);
  expect(loadingCard.inputHints).toEqual(['Preparing choices · Input locked']);
  expect(loadingCard.inputRails).toEqual([]);
  expect(loadingCard.hintLabels).toEqual([expect.objectContaining({ x: 640, y: 213, fontSize: 19 })]);
  expect(loadingCard.hintLabels[0].width).toBeLessThanOrEqual(1040);
  expect(loadingCard.hintLabels[0].height).toBeLessThanOrEqual(32);
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/reward-loading-card-1000x560.png' });

  await page.evaluate(async () => {
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    battle.renderAll();
    battle.renderAll();
    battle.renderAll();
    await new Promise((resolve) => setTimeout(resolve, 700));
  });
  const repeatedLoading = await snapshot();
  expect(repeatedLoading.announcements.filter((message: string) => message === loadingCard.liveText)).toHaveLength(1);

  await page.evaluate(() => {
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    battle.battleRewardRendererLoading = false;
    battle.renderAll();
  });
  await expect.poll(async () => (await snapshot()).state.battleRewardRenderer).toMatchObject({ ready: true, loaded: true, failed: false });
  await expect.poll(async () => (await snapshot()).liveText).toMatch(/^Reward choices ready\./);
  const readyCard = await snapshot();
  expect(readyCard.choiceHits).toEqual(loadingCard.slots);
  expect(readyCard.readyInspect).toEqual(loadingCard.inspectSlots);
  expect(readyCard.readySelect).toEqual(loadingCard.selectSlots);
  expect(readyCard.inputRails).toEqual(loadingCard.inputRails);
  expect(readyCard.inputHints.every((label: string) => !/input locked/i.test(label))).toBe(true);
  expect(readyCard.liveText).toContain('Options:');
  expect(readyCard.announcements.filter((message: string) => message.startsWith('Reward choices ready.'))).toHaveLength(1);
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/reward-loading-transition-ready-1000x560.png' });

  await page.evaluate(async () => {
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    battle.renderAll();
    battle.renderAll();
    await new Promise((resolve) => setTimeout(resolve, 700));
  });
  const repeatedReady = await snapshot();
  expect(repeatedReady.announcements.filter((message: string) => message.startsWith('Reward choices ready.'))).toHaveLength(1);

  await page.evaluate(() => {
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    battle.waymarkChoices = battle.createWaymarkRewardChoices().slice(0, 3);
    battle.mode = 'waymarkReward';
    battle.__rewardRendererBeforeFixture = battle.battleRewardRendererModule;
    battle.battleRewardRendererModule = undefined;
    battle.battleRewardRendererLoading = true;
    battle.battleRewardRendererFailed = false;
    battle.renderAll();
  });
  const loadingWaymark = await snapshot();
  expect(loadingWaymark.titles).toEqual([{ text: 'Claim a Waymark', x: 640, y: 91, width: 1060, height: 52 }]);
  expect(loadingWaymark.slots).toEqual([336, 640, 944].map((x) => ({ x, y: 440, width: 284, height: 392 })));
  expect(loadingWaymark.inspectSlots).toEqual([336, 640, 944].map((x) => ({ x: x - 70, y: 595, width: 116, height: 58 })));
  expect(loadingWaymark.skipSlots).toEqual([]);
  expect(loadingWaymark.choiceHits).toEqual([]);
  expect(loadingWaymark.inputHints).toEqual(['Preparing choices · Input locked']);
  expect(loadingWaymark.inputRails).toEqual([]);
  expect(loadingWaymark.hintLabels).toEqual(loadingCard.hintLabels);
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/reward-loading-waymark-1000x560.png' });
  for (const width of [1000]) {
    await page.setViewportSize({ width, height: width === 2560 ? 1600 : width === 1440 ? 900 : 560 });
    await page.waitForFunction(() => { const r = document.querySelector('canvas')!.getBoundingClientRect(); return r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; });
    await page.screenshot({ path: `.artifacts/test-results/reward-loading-waymark-${width}.png` });
  }
  const unchanged = await page.evaluate(() => {
    const b: any = window.__birdSquadGame.scene.getScene('BattleScene');
    return JSON.stringify({ choices: b.waymarkChoices, owned: b.routeMarks, armed: b.rewardChoiceArmedId });
  });
  await page.keyboard.press('Enter');
  await page.evaluate(() => (window.__birdSquadGame.scene.getScene('BattleScene') as any).input.gamepad.emit('down', {}, { index: 0 }));
  expect(await page.evaluate(() => {
    const b: any = window.__birdSquadGame.scene.getScene('BattleScene');
    return JSON.stringify({ choices: b.waymarkChoices, owned: b.routeMarks, armed: b.rewardChoiceArmedId });
  })).toBe(unchanged);
  const revealed = await page.evaluate(() => {
    const b: any = window.__birdSquadGame.scene.getScene('BattleScene');
    b.battleRewardRendererModule = b.__rewardRendererBeforeFixture;
    delete b.__rewardRendererBeforeFixture;
    b.battleRewardRendererLoading = false; b.renderAll();
    const geometry = (o: any) => ({ x: o.x, y: o.y, width: o.displayWidth, height: o.displayHeight });
    return { cards: b.root.list.filter((o: any) => o.name === 'reward-waymark-panel').map(geometry),
      read: b.root.list.filter((o: any) => o.name === 'reward-waymark-inspect-hit').map(geometry) };
  });
  expect(revealed.cards).toEqual(loadingWaymark.slots);
  expect(revealed.read).toEqual(loadingWaymark.inspectSlots);
});

test('reward renderer fallback keeps card identity and one stable focus ring', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1000, height: 560 });
  await boot(page);

  await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const game = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_boss' });
    game.scene.stop('MenuScene');
    const battle: any = game.scene.getScene('BattleScene');
    for (let index = 0; index < 60 && !(battle.hand?.length && battle.battleHandRendererModule); index += 1) {
      await wait(50);
    }
    battle.rewardChoices = battle.hand.slice(0, 3);
    battle.rewardDecisionStartedAtMs = Date.now();
    battle.controllerChoiceIndex = 1;
    battle.battleInputActive = true;
    battle.rewardChoiceArmedId = undefined;
    battle.rewardSkipArmed = false;
    battle.mode = 'cardReward';
    battle.battleRewardRendererModule = undefined;
    battle.battleRewardRendererLoading = false;
    battle.battleRewardRendererFailed = true;
    battle.renderAll();
  });

  const snapshot = () => page.evaluate(() => {
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    const objects = battle.root.list;
    return {
      state: battle.getTextState(),
      deckSize: battle.allDeckCards().length,
      names: objects
        .filter((object: any) => object.name === 'reward-fallback-choice-name')
        .map((object: any) => object.text),
      borders: objects
        .filter((object: any) => object.name === 'reward-fallback-choice-hit')
        .map((object: any) => ({ width: object.lineWidth, color: object.strokeColor })),
      rings: objects
        .filter((object: any) => object.name === 'reward-input-focus-ring')
        .map((object: any) => ({ width: object.lineWidth, color: object.strokeColor })),
      contexts: objects
        .filter((object: any) => object.name === 'reward-fallback-decision-context')
        .map((object: any) => ({ text: object.text, width: object.displayWidth, maxLines: object.style.maxLines })),
      preenChanges: objects
        .filter((object: any) => object.name === 'reward-preen-change')
        .map((object: any) => object.text),
      contextChips: objects
        .filter((object: any) => object.name === 'reward-fallback-context-chip')
        .map((object: any) => ({ width: object.displayWidth, height: object.displayHeight, borderWidth: object.lineWidth })),
      hints: objects
        .filter((object: any) => object.name === 'combat-input-hint' && object.type === 'Text')
        .map((object: any) => object.text),
      scrap: battle.scrap,
      rewardEvents: battle.runRewardEvents.length,
      skipTitles: objects
        .filter((object: any) => object.name === 'reward-skip-title')
        .map((object: any) => object.text),
      skipSummaries: objects
        .filter((object: any) => object.name === 'reward-skip-summary')
        .map((object: any) => object.text),
      skipBorders: objects
        .filter((object: any) => object.name === 'reward-skip-hit')
        .map((object: any) => ({ width: object.lineWidth, color: object.strokeColor })),
      skipRings: objects
        .filter((object: any) => object.name === 'reward-skip-focus-ring')
        .map((object: any) => ({ width: object.lineWidth, color: object.strokeColor })),
      inspectButtons: objects
        .filter((object: any) => object.name === 'reward-card-inspect-hit')
        .map((object: any) => ({
          enabled: Boolean(object.input?.enabled),
          disabled: object.getData('disabled'),
          fillAlpha: object.fillAlpha,
          fillColor: object.fillColor,
          strokeColor: object.strokeColor,
        })),
      inspectLabels: objects
        .filter((object: any) => object.name === 'reward-card-inspect-label')
        .map((object: any) => ({ text: object.text, color: object.style?.color })),
    };
  });

  const initial = await snapshot();
  expect(initial.state.battleRewardRenderer).toMatchObject({ ready: true, loaded: false, failed: true });
  expect(initial.names).toHaveLength(3);
  expect(initial.names.every((name: string) => !name.includes('CONFIRM'))).toBe(true);
  expect(initial.borders).toHaveLength(3);
  expect(initial.borders.every((border: any) => border.width === 2)).toBe(true);
  expect(initial.rings).toEqual([{ width: 3, color: 0x8df4ff }]);
  expect(initial.contexts).toHaveLength(3);
  for (const context of initial.contexts) {
    expect(context.text).toBe(`Deck ${initial.deckSize} → ${initial.deckSize + 1} cards`);
    expect(context.width).toBeLessThanOrEqual(232);
  }
  expect(initial.contextChips).toEqual([]);
  expect(initial.skipTitles).toEqual([`Skip +${initial.state.rewardSkip.scrap} Scrap`]);
  expect(initial.skipSummaries).toEqual([`Deck ${initial.deckSize} unchanged / ${initial.state.rewardSkip.scrapAfter} Scrap`]);
  expect(initial.skipBorders).toEqual([{ width: 1, color: UI_CONTROL.border }]);
  expect(initial.skipRings).toEqual([]);
  expect(initial.inspectButtons.every((button: any) => button.enabled && button.disabled === false)).toBe(true);
  expect(initial.inspectLabels.every((label: any) => label.text === 'Read' && label.color === UI_CONTROL.text)).toBe(true);

  await page.evaluate(() => {
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    battle.requestRewardChoice(battle.rewardChoices[1].id);
  });
  await expect.poll(async () => (await snapshot()).state.rewardChoiceConfirmation?.armed).toBe(true);
  const armed = await snapshot();
  expect(armed.deckSize).toBe(initial.deckSize);
  expect(armed.names).toEqual(initial.names);
  expect(armed.rings).toEqual([{ width: 3, color: 0xd8a840 }]);
  expect(armed.contexts).toEqual(initial.contexts);
  expect(armed.hints).toEqual([
    'Click Confirm to claim · Read inspects without claiming',
  ]);
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/reward-fallback-confirmation-1000x560.png' });

  await page.keyboard.press('Escape');
  await expect.poll(async () => (await snapshot()).state.rewardChoiceConfirmation?.armed).toBe(false);
  const cancelled = await snapshot();
  expect(cancelled.deckSize).toBe(initial.deckSize);
  expect(cancelled.names).toEqual(initial.names);
  expect(cancelled.rings).toEqual([{ width: 3, color: 0x8df4ff }]);

  await page.evaluate(() => {
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    battle.requestSkipCardReward();
  });
  await expect.poll(async () => (await snapshot()).state.rewardSkip?.armed).toBe(true);
  const skipArmed = await snapshot();
  expect(skipArmed.deckSize).toBe(initial.deckSize);
  expect(skipArmed.scrap).toBe(initial.scrap);
  expect(skipArmed.rewardEvents).toBe(initial.rewardEvents);
  expect(skipArmed.skipTitles).toEqual([`Confirm skip +${initial.state.rewardSkip.scrap} Scrap`]);
  expect(skipArmed.skipSummaries).toEqual(initial.skipSummaries);
  expect(skipArmed.skipBorders).toEqual([{ width: 1, color: UI_CONTROL.primary }]);
  expect(skipArmed.skipRings).toEqual([{ width: 3, color: 0xd8a840 }]);
  expect(skipArmed.rings).toEqual([]);
  expect(skipArmed.inspectButtons).toEqual([
    { enabled: false, disabled: true, fillAlpha: 1, fillColor: UI_CONTROL.disabled, strokeColor: UI_CONTROL.border },
    { enabled: false, disabled: true, fillAlpha: 1, fillColor: UI_CONTROL.disabled, strokeColor: UI_CONTROL.border },
    { enabled: false, disabled: true, fillAlpha: 1, fillColor: UI_CONTROL.disabled, strokeColor: UI_CONTROL.border },
  ]);
  expect(skipArmed.inspectLabels).toEqual([
    { text: 'Read', color: UI_CONTROL.disabledText },
    { text: 'Read', color: UI_CONTROL.disabledText },
    { text: 'Read', color: UI_CONTROL.disabledText },
  ]);
  expect(skipArmed.hints).toEqual([
    'X: confirm Skip · Esc: cancel · Left/Right: choose card',
  ]);
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/reward-fallback-skip-confirmation-1000x560.png' });

  await page.keyboard.press('Escape');
  await expect.poll(async () => (await snapshot()).state.rewardSkip?.armed).toBe(false);
  const skipCancelled = await snapshot();
  expect(skipCancelled.deckSize).toBe(initial.deckSize);
  expect(skipCancelled.scrap).toBe(initial.scrap);
  expect(skipCancelled.rewardEvents).toBe(initial.rewardEvents);
  expect(skipCancelled.skipTitles).toEqual(initial.skipTitles);
  expect(skipCancelled.skipSummaries).toEqual(initial.skipSummaries);
  expect(skipCancelled.skipRings).toEqual([]);
  expect(skipCancelled.rings).toEqual([{ width: 3, color: 0x8df4ff }]);

  await page.evaluate(() => {
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    battle.upgradeChoices = battle.rewardChoices;
    battle.controllerChoiceIndex = 0;
    battle.rewardChoiceArmedId = undefined;
    battle.mode = 'upgradeReward';
    battle.renderAll();
  });
  const preen = await snapshot();
  expect(preen.contexts).toHaveLength(preen.names.length);
  expect(preen.contexts.every((context: any) => context.width <= 232)).toBe(true);
  expect(preen.contexts[0].text).toContain(' → ');
  expect(preen.contexts[0].text).not.toContain('CONFIRM');
  expect(preen.preenChanges).toEqual([]);
  expect(preen.contextChips).toEqual([]);
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/reward-fallback-preen-1000x560.png' });

  const waymarkMeta = await page.evaluate(() => {
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    battle.waymarkChoices = battle.createWaymarkRewardChoices().slice(0, 3);
    battle.controllerChoiceIndex = 0;
    battle.rewardChoiceArmedId = undefined;
    battle.mode = 'waymarkReward';
    battle.renderAll();
    return battle.waymarkChoices.map((choice: any, index: number) => {
      const view = battle.rewardWaymarkView(choice, index);
      const rarity = view.rarity.toUpperCase();
      const family = view.familyLabel.toUpperCase();
      return [...new Set([rarity, family])].join(' · ');
    });
  });
  const waymarks = await snapshot();
  expect(waymarks.contexts).toEqual([]);
  expect(waymarks.contextChips).toEqual([]);
  const waymarkLabels = await page.evaluate(() => (window.__birdSquadGame.scene.getScene('BattleScene') as any).root.list
    .filter((object: any) => object.name === 'reward-waymark-meta').map((object: any) => ({ text: object.text, width: object.displayWidth, size: object.style.fontSize })));
  expect(waymarkLabels.map((label: any) => label.text)).toEqual(waymarkMeta);
  expect(waymarkLabels.every((label: any) => label.width <= 248 && label.size === '19px')).toBe(true);
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/reward-fallback-waymarks-1000x560.png' });
});

test('route card rewards pair a scarce-role synergy card with a genuine pivot', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const game = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    game.scene.stop('MenuScene');
    const route: any = game.scene.getScene('RouteScene');
    const anchor = route.createRouteCardRewardChoices('chooseOneOfTwoCommon', 'anchor')[0];
    if (!anchor?.runtime.suit) throw new Error('Expected a suited route-reward fixture');
    route.runState.deck = Array.from({ length: 5 }, () => ({ id: anchor.id }));
    const drafts = Array.from({ length: 32 }, (_value, index) => (
      route.createRouteCardRewardChoices('chooseOneOfTwoUncommonOrRare', `sample-${index}`).map((card: any) => ({
        id: card.id,
        rarity: card.runtime.rarity,
        role: card.role,
        suit: card.runtime.suit,
      }))
    ));
    const frozenA = route.staticRouteCardRewardChoices('draft_cache', 'review', 'chooseOneOfTwoCommon');
    const frozenB = route.staticRouteCardRewardChoices('draft_cache', 'review', 'chooseOneOfTwoCommon');
    const rareDraft = route.createRouteCardRewardChoices('chooseOneOfTwoRare', 'rare-proof');
    return {
      anchorId: anchor.id,
      dominantSuit: anchor.runtime.suit,
      drafts,
      frozenA: frozenA.map((card: any) => card.id),
      frozenB: frozenB.map((card: any) => card.id),
      commonRarities: frozenA.map((card: any) => card.runtime.rarity),
      rareRarities: rareDraft.map((card: any) => card.runtime.rarity),
    };
  });

  expect(result.drafts).toHaveLength(32);
  for (const draft of result.drafts) {
    expect(draft).toHaveLength(2);
    expect(new Set(draft.map((card: any) => card.id)).size).toBe(2);
    expect(draft.every((card: any) => card.id !== result.anchorId)).toBe(true);
    expect(draft.every((card: any) => ['uncommon', 'rare'].includes(card.rarity))).toBe(true);
    expect(draft[0].suit).toBe(result.dominantSuit);
    expect(draft[1].suit).not.toBe(result.dominantSuit);
    expect(draft[1].role).not.toBe(draft[0].role);
  }
  expect(new Set(result.drafts.map((draft: any) => draft.map((card: any) => card.id).join('|'))).size).toBeGreaterThan(1);
  expect(result.frozenA).toHaveLength(2);
  expect(result.frozenB).toEqual(result.frozenA);
  expect(result.commonRarities).toEqual(['common', 'common']);
  expect(result.rareRarities).toEqual(['rare', 'rare']);
});

test('same-seed route rewards reproduce across replay resume and hostile ambient randomness', async ({ page }) => {
  test.setTimeout(60_000);
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const game = window.__birdSquadGame;
    const runStateFor = (seed: string) => ({
      deck: [{ id: 'major_00' }, { id: 'wands_ace' }, { id: 'pentacles_04' }],
      leaderId: 'fledgling', difficulty: 0, seed, runMode: 'full',
      currentHp: 29, scrap: 73, routeMarks: ['chalk_wingmark'], supplies: ['feather_splint'], supplySlots: 2,
      mapIndex: 1, completedRouteNodeIds: ['m1_entry'], currentRouteNodeId: 'm1_entry',
      routeLog: ['Saved route state.'], nextCombat: undefined, signalChoices: [], rewardEvents: [],
      routeDecisions: [], suppliesUsed: [], combatResults: [], districtContracts: [],
    });
    const sample = async (seed: string, hostileRandom: number) => {
      const route: any = await window.__birdSquadStartScene!('RouteScene', { runState: runStateFor(seed) });
      game.scene.stop('MenuScene');
      for (let attempt = 0; attempt < 40 && route.runState?.seed !== seed; attempt += 1) await wait(25);
      const originalRandom = Math.random;
      Math.random = () => hostileRandom;
      try {
        const snapshot = {
          cacheEffects: route.resolvedRouteRewardEffects('replay-cache', 'open', ['gainCacheReward()']),
          cardPair: route.createRouteCardRewardChoices('chooseOneOfTwoUncommonOrRare', 'replay-card-pair').map((card: any) => card.id),
          card: route.selectCardRewardId('randomCommon', 'replay-card'),
          waymark: route.selectRouteMarkRewardId('randomRare', 'replay-waymark'),
          supply: route.selectSupplyRewardId('random', 'replay-supply'),
        };
        route.resolveRouteEffect('gainCacheReward()');
        return {
          ...snapshot,
          resolvedState: {
            deck: route.runState.deck,
            currentHp: route.runState.currentHp,
            scrap: route.runState.scrap,
            routeMarks: route.runState.routeMarks,
            supplies: route.runState.supplies,
            nextCombat: route.runState.nextCombat,
          },
        };
      } finally {
        Math.random = originalRandom;
      }
    };
    const first = await sample('route-replay-proof', 0.000001);
    const replay = await sample('route-replay-proof', 0.999999);
    const resumed = await sample('route-replay-proof', 0.414213);
    const variants = [];
    for (let index = 0; index < 8; index += 1) variants.push(await sample(`route-variety-${index}`, 0.5));
    return { first, replay, resumed, variants };
  });

  expect(result.replay).toEqual(result.first);
  expect(result.resumed).toEqual(result.first);
  const signatures = result.variants.map((variant: any) => JSON.stringify({
    cacheEffects: variant.cacheEffects,
    cardPair: variant.cardPair,
    card: variant.card,
    waymark: variant.waymark,
    supply: variant.supply,
  }));
  expect(new Set(signatures).size).toBeGreaterThanOrEqual(4);
});

test('route card rewards require intentional commitment across pointer keyboard and controller', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await boot(page);

  const snapshot = () => page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const hintPanel = route.children.list.find((child: any) => child.type === 'Rectangle' && child.displayWidth === 500 && child.displayHeight === 56);
    const hintLabel = route.children.list.find((child: any) => child.name === 'route-reward-input-hint');
    const divider = route.children.list.find((child: any) => child.type === 'Rectangle' && child.displayWidth === 2 && child.displayHeight === 396);
    const focusRing = route.children.list.find((child: any) => child.name === 'route-reward-input-focus-ring');
    const inspectHits = route.children.list.filter((child: any) => child.name === 'route-reward-card-inspect-hit');
    const inspectLabels = route.children.list.filter((child: any) => child.name === 'route-reward-card-inspect-label');
    const buildRows = route.children.list.filter((child: any) => child.name === 'route-reward-build-read-row');
    const cancelHit = route.children.list.find((child: any) => child.name === 'route-event-cancel-hit' && child.input?.enabled);
    const edges = (child: any) => {
      const bounds = child?.getBounds();
      return bounds ? { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom } : undefined;
    };
    const panelEdges = edges(hintPanel);
    const labelEdges = edges(hintLabel);
    const dividerEdges = edges(divider);
    const focusEdges = edges(focusRing);
    return {
      state,
      deckIds: route.runState.deck.map((card: any) => card.id),
      pending: Boolean(route.pendingRouteReward),
      choices: route.routeCardRewardChoices.map((card: any) => card.id),
      guidance: route.routeCardRewardChoices.map((card: any) => ({
        name: card.name,
        observations: route.routeRewardCardObservations(card),
      })),
      armedCardId: route.routeRewardArmedCardId,
      cancelLabels: route.children.list
        .filter((child: any) => child.name === 'route-event-cancel-hit' && child.input?.enabled)
        .map((child: any) => child.getData('label')),
      cardCommandLabels: route.children.list
        .filter((child: any) => child.type === 'Text' && (String(child.text).includes('CONFIRM PICK') || String(child.text).includes('BACK CANCELS')))
        .map((child: any) => child.text),
      inputHints: route.children.list
        .filter((child: any) => child.name === 'route-reward-input-hint')
        .map((child: any) => child.text),
      inspectChrome: {
        labels: inspectLabels.map((child: any) => child.text),
        buttons: inspectHits.map((child: any) => ({ fillAlpha: child.fillAlpha, strokeColor: child.strokeColor, role: child.getData('controlKind') })),
      },
      buildRead: {
        titles: route.children.list.filter((child: any) => child.name === 'route-reward-build-read-title').map((child: any) => child.text),
        names: route.children.list.filter((child: any) => child.name === 'route-reward-build-card-name').map((child: any) => child.text),
        observations: route.children.list.filter((child: any) => child.name === 'route-reward-build-observation').map((child: any) => child.text),
        rows: buildRows.map(edges),
        divider: edges(divider),
        cancel: edges(cancelHit),
      },
      inputHintVisual: {
        text: hintLabel?.text,
        fontSize: Number.parseFloat(hintLabel?.style?.fontSize ?? '0'),
        panelSize: hintPanel ? [hintPanel.displayWidth, hintPanel.displayHeight] : [],
        panelY: hintPanel?.y,
        leftInset: panelEdges && labelEdges ? labelEdges.left - panelEdges.left : -1,
        rightInset: panelEdges && labelEdges ? panelEdges.right - labelEdges.right : -1,
        dividerGap: panelEdges && dividerEdges ? panelEdges.left - dividerEdges.right : -1,
        choiceGap: panelEdges && focusEdges ? focusEdges.top - panelEdges.bottom : -1,
      },
      liveText: document.getElementById('game-status')?.textContent ?? '',
      hoverDetail: (() => {
        const bounds = route.hoverCardDetail?.getBounds?.();
        return {
          open: Boolean(route.hoverCardDetail?.active),
          bounds: bounds ? {
            left: Math.round(bounds.left),
            top: Math.round(bounds.top),
            right: Math.round(bounds.right),
            bottom: Math.round(bounds.bottom),
          } : undefined,
        };
      })(),
      inspectionFooter: route.children.list
        .filter((child: any) => child.type === 'Text' && child.text?.includes('RETURN TO'))
        .map((child: any) => child.text),
    };
  });
  const openReward = async (suffix: string) => {
    await page.evaluate(async (rewardSuffix) => {
      const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      const game = window.__birdSquadGame;
      await window.__birdSquadStartScene!('RouteScene', {});
      game.scene.stop('MenuScene');
      const route: any = game.scene.getScene('RouteScene');
      const node = {
        id: `intentional_cache_${rewardSuffix}`,
        type: 'cache',
        label: 'Intentional Cache',
        payloadId: `intentional_cache_${rewardSuffix}`,
      };
      const choice = {
        key: 'choose_reward',
        text: 'Review the drawer.',
        effects: ['addCard(chooseOneOfTwoUncommonOrRare)'],
        locked: false,
      };
      route.openRouteRewardMenu(node, choice, structuredClone(route.runState));
      for (
        let index = 0;
        index < 120 && (!route.routeRewardOverlayModule || !route.routeEssentialAssetsReady);
        index += 1
      ) await wait(50);
      route.renderAll();
    }, suffix);
    await expect.poll(async () => {
      const state = await snapshot();
      return state.pending && state.choices.length >= 2 && state.state.routeReward?.renderer?.loaded;
    }, { timeout: 30_000 }).toBe(true);
  };
  const clickReward = async (index: number) => {
    const center = await page.evaluate((choiceIndex) => {
      const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
      const hits = route.children.list.filter(
        (child: any) => child.name === 'route-reward-card-hit' && child.input?.enabled,
      );
      const hit = hits[choiceIndex];
      if (!hit) throw new Error(`Missing route reward choice ${choiceIndex}`);
      return { x: hit.x, y: hit.y };
    }, index);
    const canvas = await page.locator('canvas').boundingBox();
    if (!canvas) throw new Error('Missing game canvas');
    await page.mouse.click(
      canvas.x + canvas.width * (center.x / 1280),
      canvas.y + canvas.height * (center.y / 720),
    );
  };
  const moveToReward = async (index: number) => {
    const center = await page.evaluate((choiceIndex) => {
      const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
      const hits = route.children.list.filter(
        (child: any) => child.name === 'route-reward-card-hit' && child.input?.enabled,
      );
      const hit = hits[choiceIndex];
      if (!hit) throw new Error(`Missing route reward choice ${choiceIndex}`);
      return { x: hit.x, y: hit.y };
    }, index);
    const canvas = await page.locator('canvas').boundingBox();
    if (!canvas) throw new Error('Missing game canvas');
    await page.mouse.move(
      canvas.x + canvas.width * (center.x / 1280),
      canvas.y + canvas.height * (center.y / 720),
    );
  };
  const moveAwayFromRewards = async () => {
    const canvas = await page.locator('canvas').boundingBox();
    if (!canvas) throw new Error('Missing game canvas');
    await page.mouse.move(canvas.x + 8, canvas.y + 8);
  };
  const clickInspect = async (index: number) => {
    const center = await page.evaluate((choiceIndex) => {
      const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
      const hits = route.children.list.filter(
        (child: any) => child.name === 'route-reward-card-inspect-hit' && child.input?.enabled,
      );
      const hit = hits[choiceIndex];
      if (!hit) throw new Error(`Missing route reward Inspect ${choiceIndex}`);
      return { x: hit.x, y: hit.y };
    }, index);
    const canvas = await page.locator('canvas').boundingBox();
    if (!canvas) throw new Error('Missing game canvas');
    await page.mouse.click(
      canvas.x + canvas.width * (center.x / 1280),
      canvas.y + canvas.height * (center.y / 720),
    );
  };
  const clickCancel = async () => {
    const center = await page.evaluate(() => {
      const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
      const hit = route.children.list.find(
        (child: any) => child.name === 'route-event-cancel-hit' && child.input?.enabled,
      );
      if (!hit) throw new Error('Missing route reward Cancel control');
      return { x: hit.x, y: hit.y };
    });
    const canvas = await page.locator('canvas').boundingBox();
    if (!canvas) throw new Error('Missing game canvas');
    await page.mouse.click(
      canvas.x + canvas.width * (center.x / 1280),
      canvas.y + canvas.height * (center.y / 720),
    );
  };
  const pressRoutePad = (partial: Record<string, boolean>) => page.evaluate((pressed) => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    route.cardHoverDetailModule.updateRouteRewardGamepad(route, {
      left: false,
      right: false,
      up: false,
      down: false,
      A: false,
      ...pressed,
    }, route.controllerButtonsDown);
  }, partial);

  await openReward('pointer');
  const pointerInitial = await snapshot();
  expect(pointerInitial.state.routeReward.inputFocus).toMatchObject({
    armed: false,
    commitBlockedUntilSelected: true,
    controls: { claim: 'Confirm / A selects' },
  });
  expect(pointerInitial.cancelLabels).toEqual(['Cancel']);
  expect(pointerInitial.inspectChrome.labels).toEqual(['Inspect', 'Inspect']);
  expect(pointerInitial.inspectChrome.buttons).toEqual(Array(2).fill({fillAlpha:1,strokeColor:UI_CONTROL.border,role:'secondary'}));
  expect(pointerInitial.guidance).toHaveLength(2);
  expect(pointerInitial.guidance.every((choice: any) => (
    choice.name && choice.observations.length > 0 && choice.observations.length <= 2
  ))).toBe(true);
  expect(pointerInitial.buildRead.titles).toEqual(['BUILD READ']);
  expect(pointerInitial.buildRead.names).toEqual(
    pointerInitial.guidance.map((choice: any) => choice.name),
  );
  // Quiet summaries may be explicitly abbreviated; complete advice remains in inspection and narration.
  for (const [index, summary] of pointerInitial.buildRead.observations.entries()) {
    const authored = pointerInitial.guidance[index].observations.join(' / ');
    expect(authored).toContain(String(summary).replace(/…$/, '').trim());
    if (summary !== authored) expect(summary).toMatch(/…$/);
  }
  expect(pointerInitial.buildRead.rows).toHaveLength(2);
  expect(pointerInitial.buildRead.rows.every((row: any) => row.right < pointerInitial.buildRead.divider.left)).toBe(true);
  expect(pointerInitial.buildRead.rows.at(-1).bottom).toBeLessThan(pointerInitial.buildRead.cancel.top);
  expect(pointerInitial.state.routeReward.inputFocus.observations).toEqual(pointerInitial.guidance[0].observations);
  await expect(page.locator('#game-status')).toContainText(pointerInitial.guidance[0].name);
  for (const observation of pointerInitial.guidance[0].observations) {
    await expect(page.locator('#game-status')).toContainText(observation);
  }

  await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    for (let index = 0; index < 60 && !route.cardHoverDetailModule; index += 1) await wait(50);
    if (!route.cardHoverDetailModule) throw new Error('Route card-detail renderer did not load');
  });
  await moveToReward(0);
  await expect.poll(async () => (await snapshot()).hoverDetail.open).toBe(true);
  const neutralHover = await snapshot();
  expect(neutralHover.state.routeReward.inputFocus).toMatchObject({
    index: 0,
    cardId: pointerInitial.choices[0],
    armed: false,
  });
  expect(neutralHover.hoverDetail.bounds.top).toBeGreaterThanOrEqual(0);
  expect(neutralHover.hoverDetail.bounds.right).toBeLessThanOrEqual(1280);
  await page.locator('canvas').screenshot({
    path: '.artifacts/test-results/route-reward-hover-browse-1000x560.png',
  });
  await moveAwayFromRewards();
  await expect.poll(async () => (await snapshot()).hoverDetail.open).toBe(false);

  await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    route.cardHoverDetailModule = undefined;
    route.cardHoverDetailLoading = true;
  });
  await clickReward(1);
  await expect.poll(async () => (await snapshot()).state.routeReward?.inputFocus?.armed).toBe(true);
  const pointerArmed = await snapshot();
  expect(pointerArmed.deckIds).toEqual(pointerInitial.deckIds);
  expect(pointerArmed.pending).toBe(true);
  expect(pointerArmed.choices).toEqual(pointerInitial.choices);
  expect(pointerArmed.armedCardId).toBe(pointerInitial.choices[1]);
  expect(pointerArmed.inspectChrome).toEqual(pointerInitial.inspectChrome);
  expect(pointerArmed.cancelLabels).toEqual(['Clear pick']);
  expect(pointerArmed.cardCommandLabels).toEqual([]);
  expect(pointerArmed.inputHints).toHaveLength(1);
  expect(pointerArmed.inputHints[0]).toBe('Click the selected choice again to confirm\nInspect reads without committing');
  expect(pointerArmed.inputHintVisual).toMatchObject({
    text: pointerArmed.inputHints[0],
    fontSize: 19,
    panelSize: [500, 56],
    panelY: 205,
  });
  expect(pointerArmed.inputHintVisual.leftInset).toBeGreaterThanOrEqual(12);
  expect(pointerArmed.inputHintVisual.rightInset).toBeGreaterThanOrEqual(12);
  expect(pointerArmed.inputHintVisual.dividerGap).toBeGreaterThanOrEqual(12);
  // The larger, readable two-line hint preserves a clear 20px card gap.
  expect(pointerArmed.inputHintVisual.choiceGap).toBeGreaterThanOrEqual(20);
  await expect(page.locator('#game-status')).toContainText('is selected. Confirm');
  await moveToReward(0);
  await expect.poll(async () => (await snapshot()).hoverDetail.open).toBe(false);
  const armedAfterHover = await snapshot();
  expect(armedAfterHover.armedCardId).toBe(pointerInitial.choices[1]);
  expect(armedAfterHover.state.routeReward.inputFocus).toMatchObject({
    index: 1,
    armed: true,
    armedCardId: pointerInitial.choices[1],
    visible: true,
  });
  expect(armedAfterHover.inputHints).toEqual(pointerArmed.inputHints);
  expect(armedAfterHover.deckIds).toEqual(pointerInitial.deckIds);
  await page.locator('canvas').screenshot({
    path: '.artifacts/test-results/route-reward-hover-locked-confirmation-1000x560.png',
  });
  await moveAwayFromRewards();
  await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    route.cardHoverDetailLoading = false;
    route.preloadCardHoverDetail();
    for (let index = 0; index < 60 && !route.cardHoverDetailModule; index += 1) await wait(50);
    if (!route.cardHoverDetailModule) throw new Error('Route card-detail renderer did not load');
    route.renderAll();
  });
  await clickInspect(0);
  await expect.poll(async () => (await snapshot()).state.routeReward?.inspection).toMatchObject({
    open: true,
    cardId: pointerInitial.choices[0],
    returnArmed: true,
    returnChoiceId: pointerInitial.choices[1],
    returnIndex: 1,
  });
  const inspectingArmedRouteChoice = await snapshot();
  expect(inspectingArmedRouteChoice.state.routeReward.inputFocus).toMatchObject({
    index: 1,
    armed: true,
    armedCardId: pointerInitial.choices[1],
  });
  await expect(page.locator('#game-status')).toContainText('remains selected');
  expect(inspectingArmedRouteChoice.inspectionFooter).toEqual([
    'Esc / B / TAP OUTSIDE  RETURN TO CONFIRM PICK',
  ]);
  expect(inspectingArmedRouteChoice.deckIds).toEqual(pointerInitial.deckIds);
  expect(inspectingArmedRouteChoice.pending).toBe(true);
  await page.locator('canvas').screenshot({
    path: '.artifacts/test-results/route-reward-inspection-armed-1000x560.png',
  });
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await snapshot()).state.routeReward?.inspection?.open).toBe(false);
  const returnedToArmedRouteChoice = await snapshot();
  expect(returnedToArmedRouteChoice.state.routeReward.inputFocus).toMatchObject({
    index: 1,
    armed: true,
    armedCardId: pointerInitial.choices[1],
    visible: true,
  });
  expect(returnedToArmedRouteChoice.armedCardId).toBe(pointerInitial.choices[1]);
  expect(returnedToArmedRouteChoice.inputHints).toEqual(['Left/Right: choose · Enter: select / confirm\nR: inspect · Esc: clear pick']);
  expect(returnedToArmedRouteChoice.deckIds).toEqual(pointerInitial.deckIds);
  await page.locator('canvas').screenshot({
    path: '.artifacts/test-results/route-reward-inspection-return-armed-1000x560.png',
  });
  await page.locator('canvas').screenshot({
    path: '.artifacts/test-results/route-reward-choice-confirmation-1000x560.png',
  });

  await clickCancel();
  await expect.poll(async () => (await snapshot()).state.routeReward?.inputFocus?.armed).toBe(false);
  const pointerCancelled = await snapshot();
  expect(pointerCancelled.deckIds).toEqual(pointerInitial.deckIds);
  expect(pointerCancelled.pending).toBe(true);
  expect(pointerCancelled.choices).toEqual(pointerInitial.choices);
  expect(pointerCancelled.cancelLabels).toEqual(['Cancel']);
  await page.locator('canvas').screenshot({
    path: '.artifacts/test-results/route-reward-pointer-cancel-pick-1000x560.png',
  });

  await clickCancel();
  await expect.poll(async () => (await snapshot()).pending).toBe(false);
  const pointerAbandoned = await snapshot();
  expect(pointerAbandoned.deckIds).toEqual(pointerInitial.deckIds);

  await openReward('pointer-commit');
  const pointerCommitInitial = await snapshot();
  await clickReward(1);
  await clickReward(1);
  await expect.poll(async () => (await snapshot()).pending).toBe(false);
  const pointerCommitted = await snapshot();
  expect(pointerCommitted.deckIds).toHaveLength(pointerCommitInitial.deckIds.length + 1);
  expect(pointerCommitted.deckIds).toContain(pointerCommitInitial.choices[1]);

  await openReward('keyboard');
  const keyboardInitial = await snapshot();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await snapshot()).state.routeReward?.inputFocus).toMatchObject({
    index: 1,
    armed: true,
  });
  const keyboardArmed = await snapshot();
  expect(keyboardArmed.deckIds).toEqual(keyboardInitial.deckIds);
  expect(keyboardArmed.armedCardId).toBe(keyboardInitial.choices[1]);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await snapshot()).pending).toBe(false);
  expect((await snapshot()).deckIds).toContain(keyboardInitial.choices[1]);

  await openReward('controller');
  const controllerInitial = await snapshot();
  await pressRoutePad({ right: true });
  await pressRoutePad({});
  await expect.poll(async () => (await snapshot()).state.routeReward?.inputFocus).toMatchObject({
    index: 1,
    armed: true,
  });
  const firstControllerSelection = (await snapshot()).armedCardId;
  await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    route.input.gamepad.emit('down', route.input.gamepad.pad1, { index: 1 }, 1);
  });
  await expect.poll(async () => (await snapshot()).state.routeReward?.inputFocus?.armed).toBe(false);
  expect((await snapshot()).deckIds).toEqual(controllerInitial.deckIds);
  await pressRoutePad({ right: true });
  await pressRoutePad({});
  const secondControllerSelection = (await snapshot()).armedCardId;
  expect(secondControllerSelection).not.toBe(firstControllerSelection);
  await pressRoutePad({ A: true });
  await pressRoutePad({});
  await expect.poll(async () => (await snapshot()).pending).toBe(false);
  expect((await snapshot()).deckIds).toContain(secondControllerSelection);
});

test('card reward skip Scrap follows the active map economy profile', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', {
      routeNodeId: 'm4_c0_street_opening',
      runState: {
        deck: [{ id: 'major_00' }],
        leaderId: 'fledgling',
        difficulty: 0,
        seed: 'skip-scrap-map4',
        currentHp: 36,
        scrap: 0,
        routeMarks: [],
        supplies: [],
        mapIndex: 3,
        completedRouteNodeIds: [],
        currentRouteNodeId: undefined,
        routeLog: [],
        nextCombat: undefined,
        signalChoices: [],
        rewardEvents: [],
      }
    });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.rewardChoices = [{ id: 'wands_02' }, { id: 'cups_02' }];
    scene.mode = 'cardReward';
    scene.combatEconomyAwarded = true;
    scene.shouldOfferUpgradeReward = () => false;
    const before = scene.scrap;
    scene.skipCardReward();
    return scene.scrap - before;
  });
  expect(result).toBe(18);
});

test('card rewards distinguish discovery from permanent collection claims and celebrate the first claim', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await boot(page);
  const firstStage = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    localStorage.removeItem('birdsquad.account');
    localStorage.removeItem('birdsquad.account.backup');
    const runState = {
      deck: [{ id: 'major_00' }],
      leaderId: 'fledgling',
      difficulty: 0,
      seed: 'collection-first-claim',
      currentHp: 32,
      scrap: 0,
      routeMarks: [],
      supplies: [],
      supplySlots: 2,
      mapIndex: 0,
      completedRouteNodeIds: [],
      currentRouteNodeId: undefined,
      routeLog: [],
      nextCombat: undefined,
      signalChoices: [],
      rewardEvents: [],
      suppliesUsed: [],
      combatResults: [],
      freePreenNextDistrict: 0,
    };
    const scene: any = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry', runState });
    const choices = scene.createRewardChoices();
    scene.rewardChoices = choices;
    scene.mode = 'cardReward';
    scene.combatEconomyAwarded = true;
    scene.shouldOfferUpgradeReward = () => false;
    scene.battleInputActive = true;
    scene.controllerChoiceIndex = 0;
    scene.renderAll();
    for (let i = 0; i < 100; i += 1) {
      const state = scene.getTextState();
      const status = scene.root?.list?.filter((entry: any) => entry.name === 'reward-collection-status') ?? [];
      if (state.battleRewardRenderer?.ready && status.length >= choices.length) break;
      await wait(40);
      scene.renderAll();
    }
    const account = JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}');
    const state = scene.getTextState();
    const statusObjects = scene.root?.list?.filter((entry: any) => entry.name === 'reward-collection-status') ?? [];
    return {
      runState,
      firstId: choices[0].id,
      firstCard: choices[0],
      offeredIds: choices.map((card: any) => card.id),
      discovered: account.discoveredCards ?? [],
      collectionBefore: account.cardCollection ?? {},
      rewardState: state.rewardChoices,
      collectionStatusTexts: statusObjects.filter((entry: any) => entry.type === 'Text').map((entry: any) => entry.text),
      audioBefore: window.__birdSquadAudio?.(),
    };
  });

  expect(firstStage.offeredIds.length).toBeGreaterThanOrEqual(2);
  expect(firstStage.discovered).toEqual(expect.arrayContaining(firstStage.offeredIds));
  expect(firstStage.collectionBefore).toEqual({});
  expect(firstStage.rewardState.every((choice: any) => (
    choice.collection.firstClaim === true
    && choice.collection.timesClaimed === 0
    && choice.collection.runCopyTemporary === true
  ))).toBe(true);
  expect(firstStage.collectionStatusTexts).toHaveLength(firstStage.offeredIds.length);
  expect(firstStage.collectionStatusTexts.every((label: string) => label === 'NEW TO COLLECTION')).toBe(true);
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('first permanent collection record');
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/reward-new-collection-card.png' });

  const claims = await page.evaluate(async ({ firstId, firstCard, runState }) => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    let scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
    scene.chooseRewardCard(firstId);
    const afterFirst = JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}');
    const firstLog = scene.log.find((entry: string) => entry.includes('First collection claim!'));
    const firstAudio = window.__birdSquadAudio?.();

    for (let i = 0; i < 100 && !window.__birdSquadGame.scene.isActive('RouteScene'); i++) await wait(40);
    scene = await window.__birdSquadStartScene!('BattleScene', {
      routeNodeId: 'm1_entry', runState: { ...runState, startedAtMs: Date.now() + 1 },
    });
    scene.rewardChoices = [firstCard];
    scene.mode = 'cardReward';
    scene.combatEconomyAwarded = true;
    scene.shouldOfferUpgradeReward = () => false;
    scene.battleInputActive = true;
    scene.controllerChoiceIndex = 0;
    scene.renderAll();
    for (let i = 0; i < 100 && !scene.getTextState().battleRewardRenderer?.ready; i += 1) {
      await wait(40);
      scene.renderAll();
    }
    const repeatedPreview = scene.getTextState().rewardChoices[0].collection;
    const repeatedLabels = scene.root.list
      .filter((entry: any) => entry.name === 'reward-collection-status' && entry.type === 'Text')
      .map((entry: any) => entry.text);
    scene.chooseRewardCard(firstId);
    const afterSecond = JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}');
    return {
      afterFirst: afterFirst.cardCollection[firstId],
      newAfterFirst: afterFirst.cardCollection[firstId]?.isNew,
      firstLog,
      firstAudio,
      repeatedPreview,
      repeatedLabels,
      afterSecond: afterSecond.cardCollection[firstId],
      newAfterSecond: afterSecond.cardCollection[firstId]?.isNew,
      secondLog: scene.log.find((entry: string) => entry.includes('Collection history updated.')),
      secondAudio: window.__birdSquadAudio?.(),
    };
  }, { firstId: firstStage.firstId, firstCard: firstStage.firstCard, runState: firstStage.runState });

  expect(claims.afterFirst).toMatchObject({
    timesClaimed: 1,
    firstSource: 'combat_reward',
  });
  expect(claims.afterFirst.firstAcquiredAt).toBeGreaterThan(0);
  expect(claims.newAfterFirst).toBe(true);
  expect(claims.firstLog).toContain('First collection claim!');
  expect(claims.firstAudio.cueRequests.objectiveComplete).toBeGreaterThan(firstStage.audioBefore.cueRequests.objectiveComplete ?? 0);
  expect(claims.repeatedPreview).toEqual({ firstClaim: false, timesClaimed: 1, targeted: false, runCopyTemporary: true });
  expect(claims.repeatedLabels).toEqual([]); // Ordinary repeats do not add another visual badge.
  expect(claims.afterSecond).toMatchObject({
    timesClaimed: 2,
    firstSource: 'combat_reward',
    firstAcquiredAt: claims.afterFirst.firstAcquiredAt,
  });
  expect(claims.newAfterSecond).toBe(true);
  expect(claims.secondLog).toContain('Collection history updated.');
  expect(claims.secondAudio.cueRequests.reward).toBeGreaterThan(claims.firstAudio.cueRequests.reward ?? 0);
});

test('claiming a Hunt List reward completes an atomic non-power collection milestone', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    const account = {
      discoveredCards: [],
      hunt: [],
    };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.screenReader', 'on');
  });
  await boot(page);
  const preview = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const runState = {
      deck: [{ id: 'major_00' }],
      leaderId: 'fledgling',
      difficulty: 0,
      seed: 'hunt-target-completion',
      currentHp: 32,
      scrap: 0,
      routeMarks: [],
      supplies: [],
      supplySlots: 2,
      mapIndex: 0,
      completedRouteNodeIds: [],
      currentRouteNodeId: undefined,
      routeLog: [],
      nextCombat: undefined,
      signalChoices: [],
      rewardEvents: [],
      suppliesUsed: [],
      combatResults: [],
      freePreenNextDistrict: 0,
    };
    const scene: any = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry', runState });
    const targetCard = scene.createRewardChoices()[0];
    const account = JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}');
    account.discoveredCards = [targetCard.id];
    account.hunt = [targetCard.id];
    localStorage.setItem('birdsquad.account', JSON.stringify(account));
    scene.rewardChoices = [targetCard];
    scene.mode = 'cardReward';
    scene.combatEconomyAwarded = true;
    scene.shouldOfferUpgradeReward = () => false;
    scene.battleInputActive = true;
    scene.controllerChoiceIndex = 0;
    scene.renderAll();
    for (let i = 0; i < 100; i += 1) {
      const labels = scene.root?.list?.filter((entry: any) => (
        entry.name === 'reward-collection-status' && entry.type === 'Text'
      )) ?? [];
      if (scene.getTextState().battleRewardRenderer?.ready && labels.length > 0) break;
      await wait(40);
      scene.renderAll();
    }
    const preview = scene.getTextState().rewardChoices[0].collection;
    const labels = scene.root.list
      .filter((entry: any) => entry.name === 'reward-collection-status' && entry.type === 'Text')
      .map((entry: any) => entry.text);
    for (let i = 0; i < 50 && !(document.getElementById('game-status')?.textContent ?? '').includes('Hunt target'); i += 1) {
      await wait(40);
    }
    const screenReaderBefore = document.getElementById('game-status')?.textContent ?? '';
    const audioBefore = window.__birdSquadAudio?.();
    return {
      targetId: targetCard.id,
      collection: preview,
      labels,
      screenReaderBefore,
      audioBefore,
    };
  });

  expect(preview.collection).toEqual({
    firstClaim: true,
    timesClaimed: 0,
    targeted: true,
    runCopyTemporary: true,
  });
  expect(preview.labels).toEqual(['HUNT TARGET']);
  expect(preview.screenReaderBefore).toContain('Hunt target');
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/reward-hunt-target.png' });

  const result = await page.evaluate((targetId) => {
    const scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
    scene.chooseRewardCard(targetId);
    return {
      account: JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}'),
      log: scene.log.find((entry: string) => entry.includes('Hunt complete!')),
      audioAfter: window.__birdSquadAudio?.(),
    };
  }, preview.targetId);
  expect(result.account.hunt).toEqual([]);
  expect(result.account.cardCollection[preview.targetId]).toMatchObject({
    timesClaimed: 1,
    firstSource: 'combat_reward',
    targetSource: 'combat_reward',
    isNew: true,
  });
  expect(result.account.cardCollection[preview.targetId].firstAcquiredAt).toBeGreaterThan(0);
  expect(result.account.cardCollection[preview.targetId].targetCompletedAt)
    .toBe(result.account.cardCollection[preview.targetId].firstAcquiredAt);
  expect(result.log).toContain('Permanent milestone recorded.');
  expect(result.audioAfter.cueRequests.objectiveComplete)
    .toBeGreaterThan(preview.audioBefore.cueRequests.objectiveComplete ?? 0);

  await page.evaluate(async ({ targetId }) => {
    const cs: any = await window.__birdSquadStartScene!('CodexScene');
    cs.activeSection = 'cards';
    cs.activeTab = 0;
    cs.detailId = targetId;
    cs.detailScroll = 0;
    cs.detailScrollTarget = 0;
    cs.renderAll();
  }, { targetId: preview.targetId });
  const milestone = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const walk = (entry: any): any[] => [entry, ...(Array.isArray(entry?.list) ? entry.list.flatMap(walk) : [])];
    return {
      state: JSON.parse(window.render_game_to_text?.() ?? '{}'),
      texts: walk(cs.root).filter((entry: any) => entry.type === 'Text').map((entry: any) => entry.text),
    };
  });
  expect(milestone.state.collectionHunt).toMatchObject({
    count: 0,
    completed: 1,
    detailTargeted: false,
    changesRewardOdds: false,
  });
  expect(milestone.texts.some((text: string) => text.startsWith('HUNT COMPLETED / FIGHT REWARD /'))).toBe(true);
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('completed a Hunt List milestone');
});

test('post-combat reward screens render generated choice ceremony art', async ({ page }) => {
  test.setTimeout(60_000);
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const collectObjects = (root: any): any[] => {
      const out: any[] = [];
      const visit = (node: any) => {
        if (!node) return;
        out.push(node);
        const children = node.list ?? node.children?.list;
        if (Array.isArray(children)) children.forEach(visit);
      };
      visit(root);
      return out;
    };
    const spotlightCount = (scene: any) => collectObjects(scene.children)
      .filter((child: any) => child.texture?.key === 'ui-icon-reward-choice-spotlight').length;
    const backdropCount = (scene: any) => collectObjects(scene.children)
      .filter((child: any) => child.texture?.key === 'ui-icon-reward-ceremony-backdrop').length;
    const choiceFrameCount = (scene: any) => collectObjects(scene.children)
      .filter((child: any) => child.texture?.key === 'ui-icon-reward-choice-card-frame').length;
    const choiceGlowBurstCount = (scene: any) => collectObjects(scene.children)
      .filter((child: any) => child.texture?.key === 'ui-icon-reward-choice-glow-burst').length;
    const headerPlaqueCount = (scene: any) => collectObjects(scene.children)
      .filter((child: any) => child.texture?.key === 'ui-icon-reward-header-plaque').length;
    const deckNeedChipFrameCount = (scene: any) => collectObjects(scene.children)
      .filter((child: any) => child.texture?.key === 'ui-icon-reward-deck-need-chip-frame').length;
    const skipFrameCount = (scene: any) => collectObjects(scene.children)
      .filter((child: any) => child.texture?.key === 'ui-icon-reward-skip-command-frame').length;
    const g = window.__birdSquadGame;
    const rewardTextureKeys = [
      'ui-icon-reward-choice-spotlight',
      'ui-icon-reward-choice-glow-burst',
      'ui-icon-reward-ceremony-backdrop',
      'ui-icon-reward-choice-card-frame',
      'ui-icon-reward-header-plaque',
      'ui-icon-reward-deck-need-chip-frame',
      'ui-icon-reward-skip-command-frame'
    ];
    const waitForRewardUi = async (scene: any) => {
      for (
        let i = 0;
        i < 80 && (
          !rewardTextureKeys.every((key) => scene.textures.exists(key))
          || !scene.getTextState().battleRewardRenderer?.ready
        );
        i += 1
      ) {
        await wait(50);
      }
      scene.renderAll();
      await wait(0);
    };
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    let scene: any = g.scene.getScene('BattleScene');
    scene.rewardChoices = scene.hand.slice(0, 3);
    scene.mode = 'cardReward';
    scene.renderAll();
    await waitForRewardUi(scene);
    const cardRewardSpotlights = spotlightCount(scene);
    const cardRewardBackdrop = backdropCount(scene);
    const cardRewardFrames = choiceFrameCount(scene);
    const cardRewardGlowBursts = choiceGlowBurstCount(scene);
    const cardRewardHeaderPlaque = headerPlaqueCount(scene);
    const cardRewardDeckNeedChipFrame = deckNeedChipFrameCount(scene);
    const cardRewardSkipFrame = skipFrameCount(scene);
    const cardRewardObservationTexts = collectObjects(scene.children)
      .filter((child: any) => child.name === 'reward-build-observation')
      .map((child: any) => child.text);
    const cardRewardBattleChrome = collectObjects(scene.children)
      .filter((child: any) => ['ui-icon-combat-pile-dock', 'ui-icon-combat-roost-command-frame', 'ui-icon-combat-hand-rail'].includes(child.texture?.key))
      .length;
    const cardRewardState = scene.getTextState();
    const cardRewardTelemetry = cardRewardState.rewardCeremonyBackdrop;
    const cardRewardFrameTelemetry = cardRewardState.rewardChoiceCardFrame;
    const cardRewardGlowTelemetry = cardRewardState.rewardChoiceGlowBurst;
    const cardRewardHeaderTelemetry = cardRewardState.rewardHeaderPlaque;
    const cardRewardDeckNeedTelemetry = cardRewardState.rewardDeckNeedChipFrame;
    const cardRewardSkipTelemetry = cardRewardState.rewardSkipCommandFrame;
    const cardRewardGuidance = cardRewardState.rewardChoices;
    scene.showChoiceCardDetail(scene.rewardChoices[0], 336, 402);
    const cardRewardPreviewCenter = scene.cardPreview?.list?.[0]?.x;
    scene.hideCardPreview();

    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_boss' });
    scene = g.scene.getScene('BattleScene');
    scene.waymarkChoices = scene.createWaymarkRewardChoices().slice(0, 3);
    scene.mode = 'waymarkReward';
    scene.renderAll();
    await waitForRewardUi(scene);
    const waymarkRewardSpotlights = spotlightCount(scene);
    const waymarkRewardBackdrop = backdropCount(scene);
    const waymarkRewardFrames = choiceFrameCount(scene);
    const waymarkRewardGlowBursts = choiceGlowBurstCount(scene);
    const waymarkRewardHeaderPlaque = headerPlaqueCount(scene);
    const waymarkRewardDeckNeedChipFrame = deckNeedChipFrameCount(scene);
    const waymarkRewardState = scene.getTextState();
    const waymarkRewardTelemetry = waymarkRewardState.rewardCeremonyBackdrop;
    const waymarkRewardFrameTelemetry = waymarkRewardState.rewardChoiceCardFrame;
    const waymarkRewardGlowTelemetry = waymarkRewardState.rewardChoiceGlowBurst;
    const waymarkRewardHeaderTelemetry = waymarkRewardState.rewardHeaderPlaque;
    const waymarkRewardDeckNeedTelemetry = waymarkRewardState.rewardDeckNeedChipFrame;

    scene.upgradeChoices = scene.allDeckCards().slice(0, 3);
    scene.mode = 'upgradeReward';
    scene.renderAll();
    await waitForRewardUi(scene);
    const upgradeRewardSpotlights = spotlightCount(scene);
    const upgradeRewardBackdrop = backdropCount(scene);
    const upgradeRewardFrames = choiceFrameCount(scene);
    const upgradeRewardGlowBursts = choiceGlowBurstCount(scene);
    const upgradeRewardHeaderPlaque = headerPlaqueCount(scene);
    const upgradeRewardDeckNeedChipFrame = deckNeedChipFrameCount(scene);
    const upgradeRewardState = scene.getTextState();
    const upgradeRewardTelemetry = upgradeRewardState.rewardCeremonyBackdrop;
    const upgradeRewardFrameTelemetry = upgradeRewardState.rewardChoiceCardFrame;
    const upgradeRewardGlowTelemetry = upgradeRewardState.rewardChoiceGlowBurst;
    const upgradeRewardHeaderTelemetry = upgradeRewardState.rewardHeaderPlaque;
    const upgradeRewardDeckNeedTelemetry = upgradeRewardState.rewardDeckNeedChipFrame;

    return {
      loaded: scene.textures.exists('ui-icon-reward-choice-spotlight'),
      glowBurstLoaded: scene.textures.exists('ui-icon-reward-choice-glow-burst'),
      backdropLoaded: scene.textures.exists('ui-icon-reward-ceremony-backdrop'),
      frameLoaded: scene.textures.exists('ui-icon-reward-choice-card-frame'),
      headerPlaqueLoaded: scene.textures.exists('ui-icon-reward-header-plaque'),
      deckNeedChipFrameLoaded: scene.textures.exists('ui-icon-reward-deck-need-chip-frame'),
      skipFrameLoaded: scene.textures.exists('ui-icon-reward-skip-command-frame'),
      cardRewardSpotlights,
      waymarkRewardSpotlights,
      upgradeRewardSpotlights,
      cardRewardBackdrop,
      waymarkRewardBackdrop,
      upgradeRewardBackdrop,
      cardRewardFrames,
      cardRewardGlowBursts,
      cardRewardHeaderPlaque,
      cardRewardDeckNeedChipFrame,
      cardRewardSkipFrame,
      cardRewardObservationTexts,
      cardRewardGuidance,
      cardRewardPreviewCenter,
      cardRewardBattleChrome,
      waymarkRewardFrames,
      waymarkRewardGlowBursts,
      waymarkRewardHeaderPlaque,
      waymarkRewardDeckNeedChipFrame,
      upgradeRewardFrames,
      upgradeRewardGlowBursts,
      upgradeRewardHeaderPlaque,
      upgradeRewardDeckNeedChipFrame,
      cardRewardTelemetry,
      waymarkRewardTelemetry,
      upgradeRewardTelemetry,
      cardRewardFrameTelemetry,
      cardRewardGlowTelemetry,
      cardRewardHeaderTelemetry,
      cardRewardDeckNeedTelemetry,
      cardRewardSkipTelemetry,
      waymarkRewardFrameTelemetry,
      waymarkRewardGlowTelemetry,
      waymarkRewardHeaderTelemetry,
      waymarkRewardDeckNeedTelemetry,
      upgradeRewardFrameTelemetry,
      upgradeRewardGlowTelemetry,
      upgradeRewardHeaderTelemetry,
      upgradeRewardDeckNeedTelemetry,
      rewardRenderer: upgradeRewardState.battleRewardRenderer
    };
  });

  expect(result.loaded).toBe(true);
  expect(result.glowBurstLoaded).toBe(true);
  expect(result.backdropLoaded).toBe(true);
  expect(result.frameLoaded).toBe(true);
  expect(result.headerPlaqueLoaded).toBe(true);
  expect(result.deckNeedChipFrameLoaded).toBe(true);
  expect(result.skipFrameLoaded).toBe(true);
  expect(result.cardRewardSpotlights).toBeGreaterThanOrEqual(3);
  expect(result.waymarkRewardSpotlights).toBe(0);
  expect(result.upgradeRewardSpotlights).toBeGreaterThanOrEqual(3);
  expect(result.cardRewardBackdrop).toBeGreaterThanOrEqual(1);
  expect(result.waymarkRewardBackdrop).toBe(0);
  expect(result.upgradeRewardBackdrop).toBeGreaterThanOrEqual(1);
  expect(result.cardRewardFrames).toBe(0);
  expect(result.cardRewardGlowBursts).toBeGreaterThanOrEqual(3);
  expect(result.cardRewardHeaderPlaque).toBe(0);
  expect(result.cardRewardDeckNeedChipFrame).toBe(0);
  expect(result.cardRewardSkipFrame).toBe(0);
  expect(result.cardRewardObservationTexts.length).toBeGreaterThanOrEqual(1);
  expect(result.cardRewardObservationTexts.length).toBeLessThanOrEqual(2);
  expect(result.cardRewardObservationTexts.every((text: string) => !text.includes(' / '))).toBe(true);
  expect(result.cardRewardGuidance.every((choice: { observations: string[] }) => choice.observations.length > 0 && choice.observations.length <= 2)).toBe(true);
  expect(result.cardRewardPreviewCenter).toBeGreaterThan(720);
  expect(result.cardRewardBattleChrome).toBe(0);
  expect(result.waymarkRewardFrames).toBe(0);
  expect(result.waymarkRewardGlowBursts).toBe(0);
  expect(result.waymarkRewardHeaderPlaque).toBe(0);
  expect(result.waymarkRewardDeckNeedChipFrame).toBe(0);
  expect(result.upgradeRewardFrames).toBe(0);
  expect(result.upgradeRewardGlowBursts).toBeGreaterThanOrEqual(3);
  expect(result.upgradeRewardHeaderPlaque).toBe(0);
  expect(result.upgradeRewardDeckNeedChipFrame).toBe(0);
  expect(result.cardRewardTelemetry).toEqual(expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }));
  expect(result.waymarkRewardTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.upgradeRewardTelemetry).toEqual(expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }));
  expect(result.cardRewardFrameTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.cardRewardGlowTelemetry).toEqual(expect.objectContaining({ loaded: true, rendered: true, count: result.cardRewardGlowBursts }));
  expect(result.cardRewardHeaderTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.cardRewardDeckNeedTelemetry).toEqual({ loaded: true, rendered: false, count: result.cardRewardDeckNeedChipFrame });
  expect(result.cardRewardSkipTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.waymarkRewardFrameTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.waymarkRewardGlowTelemetry).toEqual({ loaded: true, rendered: false, count: 0, bursts: 0 });
  expect(result.waymarkRewardHeaderTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.waymarkRewardDeckNeedTelemetry).toEqual({ loaded: true, rendered: false, count: result.waymarkRewardDeckNeedChipFrame });
  expect(result.upgradeRewardFrameTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.upgradeRewardGlowTelemetry).toEqual(expect.objectContaining({ loaded: true, rendered: true, count: result.upgradeRewardGlowBursts }));
  expect(result.upgradeRewardHeaderTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.upgradeRewardDeckNeedTelemetry).toEqual({ loaded: true, rendered: false, count: result.upgradeRewardDeckNeedChipFrame });
  expect(result.rewardRenderer).toEqual({ requested: true, ready: true, loaded: true, failed: false });
});

test('Waymark rewards explain live trigger fit before an intentional claim', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await boot(page);
  const initial = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const scene: any = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_boss' });
    for (let attempt = 0; attempt < 160 && !scene.battleRewardRendererModule; attempt += 1) {
      scene.ensureBattleRewardRenderer();
      await wait(25);
    }
    scene.runSupplies = ['signal_flare'];
    scene.routeMarks = [];
    scene.waymarkChoices = scene.selectWaymarkRewardChoices(
      ['supply_bell', 'double_packed_buckle', 'plumes_busker_patch'],
      ['supply_bell', 'double_packed_buckle', 'plumes_busker_patch'],
      3,
      'waymark-build-read-fixture',
      false,
    );
    scene.mode = 'waymarkReward';
    scene.controllerChoiceIndex = 0;
    scene.rewardChoiceArmedId = undefined;
    scene.battleInputActive = true;
    scene.renderAll();
    await wait(80);
    const state = scene.getTextState();
    const collect = (objects: any[]): any[] => objects.flatMap((child: any) => [child, ...(child.list ? collect(child.list) : [])]);
    const objects = collect(scene.children.list);
    return {
      deckSize: scene.allDeckCards().length,
      choices: state.waymarkChoices,
      titles: objects.filter((child: any) => child.name === 'reward-waymark-build-read-title').map((child: any) => child.text),
      observations: objects.filter((child: any) => child.name === 'reward-waymark-build-observation').map((child: any) => ({
        text: child.text,
        width: child.displayWidth,
        maxLines: child.style?.maxLines,
      })),
      chips: objects.filter((child: any) => child.name === 'reward-waymark-build-chip').map((child: any) => ({
        width: child.displayWidth,
        height: child.displayHeight,
      })),
      descriptions: objects.filter((child: any) => state.waymarkChoices.some((choice: any) => choice.description === child.text)).length,
      mode: state.mode,
      focus: state.combatInputFocus,
    };
  });

  expect(initial.mode).toBe('waymarkReward');
  expect(initial.choices).toHaveLength(3);
  expect(initial.choices.every((choice: any) => choice.observations.length >= 2)).toBe(true);
  expect(initial.choices.find((choice: any) => choice.id === 'supply_bell').observations[0]).toBe('+ 1 packed Supply triggers it');
  expect(initial.choices.find((choice: any) => choice.id === 'double_packed_buckle').observations[0]).toBe('+ 1 packed Supply triggers it');
  expect(initial.choices.find((choice: any) => choice.id === 'plumes_busker_patch').observations[0]).toMatch(/^\+ \d+ plumes cards? triggers? it$/);
  expect(initial.titles).toEqual([]);
  expect(initial.observations.map((entry: any) => entry.text)).toEqual(initial.choices.map((choice: any) => choice.observations[0].replace(/^[+!]\s*/, '')));
  expect(initial.observations.every((entry: any) => entry.width <= 248)).toBe(true);
  expect(initial.chips).toHaveLength(0);
  expect(initial.descriptions).toBe(3);

  const focused = initial.choices[initial.focus.index];
  for (const observation of focused.observations) {
    await expect.poll(() => page.locator('#game-status').textContent()).toContain(observation);
  }
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => JSON.parse(window.render_game_to_text!()).rewardChoiceConfirmation?.armed)).toBe(true);
  const armed = await page.evaluate(() => {
    const scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
    const state = scene.getTextState();
    return { mode: state.mode, choices: state.waymarkChoices.length, deckSize: scene.allDeckCards().length };
  });
  expect(armed).toEqual({ mode: 'waymarkReward', choices: 3, deckSize: initial.deckSize });
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => JSON.parse(window.render_game_to_text!()).rewardChoiceConfirmation?.armed)).toBe(false);
  // Complete advice moved from tiny repeated chips to explicit reading pages.
  await page.keyboard.press('r');
  await page.waitForFunction(() => (window.__birdSquadGame.scene.getScene('BattleScene') as any).combatCardDetail?.active);
  const context = await page.evaluate(() => (window.__birdSquadGame.scene.getScene('BattleScene') as any).combatCardDetail.getData('pages').map((entry: any) => entry.body).join(' ').replace(/\s+/g, ' '));
  for (const observation of focused.observations) expect(context).toContain(observation.replace(/\s+/g, ' '));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !(window.__birdSquadGame.scene.getScene('BattleScene') as any).combatCardDetail);
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/waymark-reward-build-read-1000x560.png' });

  const fallback = await page.evaluate(() => {
    const scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
    scene.battleRewardRendererModule = undefined;
    scene.battleRewardRendererFailed = true;
    scene.renderAll();
    const observations = scene.root.list
      .filter((child: any) => child.name === 'reward-waymark-build-observation')
      .map((child: any) => child.text);
    return { observations, state: scene.getTextState().waymarkChoices };
  });
  expect(fallback.observations).toHaveLength(3);
  expect(fallback.state.map((choice: any) => choice.observations[0].replace(/^[+!]\s*/, ''))).toEqual(fallback.observations);
});

test('reward decision previews expose the exact add and Preen outcomes before commitment', async ({ page }) => {
  test.setTimeout(60_000);
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const start = async () => {
      const scene: any = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
      for (let i = 0; i < 100 && (!scene.scene.isActive() || scene.combatAnimationPending); i += 1) await wait(50);
      return scene;
    };
    const waitForDeltas = async (scene: any, count: number) => {
      for (let i = 0; i < 100; i += 1) {
        scene.renderAll();
        await wait(40);
        const state = scene.getTextState();
        if (state.rewardDecisionDeltas?.length === count) return state.rewardDecisionDeltas;
      }
      const state = scene.getTextState();
      throw new Error(`Reward decision deltas did not settle at ${count}: ${JSON.stringify({
        mode: state.mode,
        rewardChoices: state.rewardChoices?.length,
        upgradeChoices: state.upgradeChoices?.length,
        rewardDecisionDeltas: state.rewardDecisionDeltas,
        battleRewardRenderer: state.battleRewardRenderer,
        sceneActive: scene.scene.isActive(),
        rootNames: scene.root?.list?.map((child: any) => child.name).filter(Boolean),
      })}`);
    };

    const scene = await start();
    const addCard = scene.createRewardChoices()[0];
    scene.rewardChoices = [addCard];
    scene.mode = 'cardReward';
    scene.battleInputActive = true;
    scene.controllerChoiceIndex = 0;
    const addPreview = scene.rewardCardView(addCard).decisionPreview;
    scene.renderAll();
    for (let i = 0; i < 100 && !scene.rewardPresentationReady(); i++) await wait(40);
    scene.renderAll();
    // First claims occupy the face's collection-status row. The complete
    // before/after decision remains available through Read for every card.
    scene.openRewardCardInspection(addCard.id);
    for (let i = 0; i < 100 && !scene.rewardInspectionLayer; i++) await wait(40);
    const addImpact = scene.getTextState().rewardInspection.deckImpact;
    const addDeltas = scene.rewardInspectionLayer.getByName('reward-deck-impact').list
      .filter((child: any) => child.name === 'reward-deck-impact-text').map((child: any) => child.text);
    scene.closeRewardCardInspection();
    const deckBefore = scene.allDeckCards().length;
    // Continue through the real card -> Preen path. Restarting Battle here
    // races the asynchronous route transition started by a reward without Preen.
    scene.shouldOfferUpgradeReward = () => true;
    scene.chooseRewardCard(addCard.id);
    const deckAfter = scene.allDeckCards().length;

    if (scene.mode !== 'upgradeReward') throw new Error('Card reward did not advance to Preen.');
    const preenCards = scene.allDeckCards()
      .filter((card: any) => !card.upgraded && card.text !== card.upgradedText)
      .filter((card: any, index: number, cards: any[]) => cards.findIndex((entry) => entry.id === card.id) === index)
      .slice(0, 3);
    const preenCard = preenCards[0];
    if (!preenCard) throw new Error('No Preen candidate was available.');
    scene.upgradeChoices = preenCards;
    scene.mode = 'upgradeReward';
    scene.battleInputActive = true;
    scene.controllerChoiceIndex = 0;
    const preenPreview = scene.rewardCardView(preenCard).decisionPreview;
    const preenDeltas = await waitForDeltas(scene, preenCards.length);
    const preenChangeTexts = scene.root.list
      .filter((child: any) => child.name === 'reward-preen-change')
      .map((child: any) => child.text);
    const preenBuildObservations = scene.root.list
      .filter((child: any) => child.name === 'reward-build-observation')
      .map((child: any) => child.text);
    scene.chooseUpgradeCard(preenCard.id);
    const preenActual = preenCard.upgraded ? preenCard.upgradedText : preenCard.text;

    return {
      addPreview,
      addDeltas,
      addImpact,
      deckBefore,
      deckAfter,
      preenPreview,
      preenDeltas,
      preenChoiceCount: preenCards.length,
      preenChangeTexts,
      preenBuildObservations,
      preenUpgraded: preenCard.upgraded,
      preenActual,
    };
  });

  expect(result.addPreview).toEqual({ kind: 'add', deckBefore: result.deckBefore, before: expect.any(String), after: expect.any(String), moltBefore: expect.any(String), moltAfter: expect.any(String), statChanges: expect.any(Array) });
  expect(result.addDeltas).toContain(`Deck: ${result.deckBefore} > ${result.deckBefore + 1} cards`);
  expect(result.addImpact).toMatchObject({ deckBefore: result.deckBefore, deckAfter: result.deckBefore + 1 });
  expect(result.deckAfter).toBe(result.deckBefore + 1);
  expect(result.preenPreview.kind).toBe('preen');
  expect(result.preenDeltas[0]).toContain(' → ');
  expect(result.preenChoiceCount).toBe(3);
  expect(result.preenChangeTexts).toHaveLength(result.preenChoiceCount);
  expect(result.preenChangeTexts).toEqual(result.preenDeltas);
  expect(result.preenChangeTexts.every((text: string) => text.includes(' → '))).toBe(true);
  expect(result.preenBuildObservations).toEqual([]);
  expect(result.preenUpgraded).toBe(true);
  expect(result.preenActual).toBe(result.preenPreview.after);
});

test('boss Waymark reward choices mix boss items with rare-and-above items', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_boss' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && !scene.root; i += 1) await wait(50);
    scene.createRewardChoices = () => [];
    scene.shouldOfferUpgradeReward = () => false;
    scene.enemies.forEach((enemy: any) => { enemy.hp = 0; });
    scene.checkOutcome();
    const rewardState = window.__birdSquadState!();
    const choices = rewardState.waymarkChoices.map((choice: any) => choice.id);
    const choiceTags = Object.fromEntries(rewardState.waymarkChoices.map((choice: any) => [choice.id, choice.tags]));
    const choiceMeta = rewardState.waymarkChoices.map((choice: any) => ({
      id: choice.id,
      rarity: choice.rarity,
      source: choice.source
    }));
    const picked = rewardState.waymarkChoices.find((choice: any) => choice.source === 'boss')?.id ?? choices[0];
    scene.chooseWaymarkReward(picked);
    let route: any = g.scene.getScene('RouteScene');
    let routeState: any = {};
    for (let i = 0; i < 40; i += 1) {
      route = g.scene.getScene('RouteScene');
      routeState = JSON.parse(window.render_game_to_text!());
      if (route?.root && routeState.map) break;
      await wait(50);
    }
    return {
      rewardMode: rewardState.mode,
      choices,
      choiceTags,
      choiceMeta,
      picked,
      mapIndex: routeState.map?.index ?? -1,
      routeMarks: routeState.run?.routeMarks ?? [],
      supplies: route?.runState?.supplies ?? [],
      freePreen: route?.runState?.freePreenNextDistrict ?? 0,
      upgradedCards: route?.runState?.deck?.filter((card: any) => card.upgraded).length ?? 0,
      log: route?.runState?.routeLog ?? []
    };
  });
  expect(result.rewardMode).toBe('waymarkReward');
  expect(result.choices).toHaveLength(3);
  expect(result.choiceMeta.some((choice: any) => choice.source === 'boss')).toBe(true);
  expect(result.choiceMeta.every((choice: any) => choice.rarity === 'rare' || choice.rarity === 'boss')).toBe(true);
  const pickedTags = result.choiceTags[result.picked] ?? [];
  if (result.picked === 'reopened_roofline') {
    expect(pickedTags).toEqual(expect.arrayContaining(['Boss', 'Next District', 'Preen']));
  }
  if (result.picked === 'crowbar_debt') {
    expect(pickedTags).toEqual(expect.arrayContaining(['Anti-Cover', 'Pressure']));
  }
  expect(result.mapIndex).toBe(2);
  expect(result.routeMarks).toContain(result.picked);
});

test('free Preen waits for the next district and asks which exact card to improve', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await boot(page);
  const initial = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const game = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    game.scene.stop('MenuScene');
    let route: any = game.scene.getScene('RouteScene');
    const pendingRun = structuredClone(route.runState);
    pendingRun.freePreenNextDistrict = 2;
    pendingRun.districtAdvanceNotice = undefined;

    await window.__birdSquadStartScene!('RouteScene', { runState: pendingRun });
    route = game.scene.getScene('RouteScene');
    const beforeTransition = {
      context: route.cardPickerContext,
      remaining: route.cardPickerRemainingPicks,
      credit: route.runState.freePreenNextDistrict,
      pending: route.runState.pendingDistrictPreens ?? 0,
      upgraded: route.runState.deck.filter((card: any) => card.upgraded).map((card: any) => card.id),
    };

    const transitionRun = structuredClone(route.runState);
    transitionRun.districtAdvanceNotice = {
      fromMapName: 'Rooftop Blocks',
      toMapName: 'Canal Market',
      toMapIndex: 2,
    };
    await window.__birdSquadStartScene!('RouteScene', { runState: transitionRun });
    route = game.scene.getScene('RouteScene');
    await wait(900);
    route.renderAll();
    const eligible = route.pickerEligibleCards('preen', 'districtPreen');
    const chosen = eligible[1] ?? eligible[0];
    const initialDistrictState = JSON.parse(window.render_game_to_text!());
    const initialDistrictRemaining = route.cardPickerRemainingPicks;
    const labels = route.children.list
      .filter((child: any) => typeof child.text === 'string')
      .map((child: any) => child.text);
    const upgradedBeforeChoice = route.runState.deck
      .filter((card: any) => card.upgraded)
      .map((card: any) => card.id);
    const interruptedRun = structuredClone(route.runState);
    await window.__birdSquadStartScene!('RouteScene', { runState: interruptedRun });
    route = game.scene.getScene('RouteScene');
    route.renderAll();
    const resumed = {
      mode: route.cardPickerMode,
      context: route.cardPickerContext,
      remaining: route.cardPickerRemainingPicks,
      pending: route.runState.pendingDistrictPreens,
      upgraded: route.runState.deck.filter((card: any) => card.upgraded).map((card: any) => card.id),
    };
    return {
      chosenIndex: chosen.index,
      chosenId: chosen.card.id,
      beforeTransition,
      initialDistrict: {
        mode: initialDistrictState.cardPickerInput?.mode,
        context: initialDistrictState.cardPickerInput?.context,
        remaining: initialDistrictRemaining,
        credit: transitionRun.freePreenNextDistrict,
        upgradedBeforeChoice,
        labels,
        costBadges: initialDistrictState.cardPickerCostBadge?.count ?? 0,
      },
      resumed,
    };
  });
  await page.screenshot({ path: '.artifacts/test-results/district-preen-choice-1600x900.png' });
  const completed = await page.evaluate(async ({ chosenIndex, chosenId }) => {
    const game = window.__birdSquadGame;
    let route: any = game.scene.getScene('RouteScene');
    route.applyCardPick(chosenIndex);
    const upgradedAfterChoice = route.runState.deck
      .filter((card: any) => card.upgraded)
      .map((card: any) => card.id);
    const afterChoice = {
      context: route.cardPickerContext,
      remaining: route.cardPickerRemainingPicks,
      chosenId,
      upgraded: upgradedAfterChoice,
    };
    route.cancelRouteCardPicker();
    const afterSkip = {
      context: route.cardPickerContext,
      mode: route.cardPickerMode,
      credit: route.runState.freePreenNextDistrict,
      pending: route.runState.pendingDistrictPreens,
      upgraded: route.runState.deck.filter((card: any) => card.upgraded).map((card: any) => card.id),
      log: [...route.runState.routeLog],
    };
    const restartRun = structuredClone(route.runState);
    await window.__birdSquadStartScene!('RouteScene', { runState: restartRun });
    route = game.scene.getScene('RouteScene');
    return {
      afterChoice,
      afterSkip,
      afterRestart: {
        context: route.cardPickerContext,
        mode: route.cardPickerMode,
        credit: route.runState.freePreenNextDistrict,
        pending: route.runState.pendingDistrictPreens,
        upgraded: route.runState.deck.filter((card: any) => card.upgraded).map((card: any) => card.id),
      },
    };
  }, { chosenIndex: initial.chosenIndex, chosenId: initial.chosenId });
  const result = { ...initial, ...completed };

  expect(result.beforeTransition).toMatchObject({
    context: undefined,
    remaining: 0,
    credit: 2,
    pending: 0,
    upgraded: [],
  });
  expect(result.initialDistrict).toMatchObject({
    mode: 'preen',
    context: 'districtPreen',
    credit: 2,
    upgradedBeforeChoice: [],
    costBadges: 0,
  });
  expect(result.initialDistrict.labels).toEqual(expect.arrayContaining([
    'Preen 2 Cards · Free',
    'Choose exactly which card improves before this district. Skipping changes nothing.',
    'Skip Remaining',
  ]));
  expect(result.resumed).toMatchObject({
    mode: 'preen',
    context: 'districtPreen',
    remaining: 2,
    pending: 2,
    upgraded: [],
  });
  expect(result.afterChoice.context).toBe('districtPreen');
  expect(result.afterChoice.remaining).toBe(1);
  expect(result.afterChoice.upgraded).toEqual([result.afterChoice.chosenId]);
  expect(result.afterSkip).toMatchObject({ context: undefined, mode: undefined, credit: 0, pending: 0 });
  expect(result.afterSkip.upgraded).toEqual([result.afterChoice.chosenId]);
  expect(result.afterSkip.log).toContain('District prep ended with 1 free Preen skipped.');
  expect(result.afterRestart).toMatchObject({ context: undefined, mode: undefined, credit: 0, pending: 0 });
  expect(result.afterRestart.upgraded).toEqual([result.afterChoice.chosenId]);
});

test('card choice surfaces expose complete details through their reading controls', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const collectText = (container: any): string[] => (container?.list ?? []).flatMap((child: any) => (
      typeof child.text === 'string' ? [child.text] : collectText(child)
    ));
    const collectObjects = (root: any): any[] => {
      const out: any[] = [];
      const visit = (node: any) => {
        if (!node) return;
        out.push(node);
        const children = node.list ?? node.children?.list;
        if (Array.isArray(children)) children.forEach(visit);
      };
      visit(root);
      return out;
    };
    const countTexture = (container: any, textureKey: string): number => (container?.list ?? []).reduce((sum: number, child: any) => {
      const self = child?.texture?.key === textureKey ? 1 : 0;
      const nested = child?.list ? countTexture(child, textureKey) : 0;
      return sum + self + nested;
    }, 0);
    const countVisibleTexture = (container: any, textureKey: string): number => collectObjects(container)
      .filter((child: any) => (
        child?.texture?.key === textureKey
        && child.visible !== false
        && (child.alpha ?? 1) > 0.01
      )).length;

    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    await wait(80);
    const battle: any = g.scene.getScene('BattleScene');
    const rewardCard = battle.hand[0] ?? battle.drawPile[0];
    battle.showCardPreview(rewardCard);
    const handFrameCount = countTexture(battle.cardPreview, 'ui-icon-card-hover-dossier-frame');
    const handStatFrameCount = countTexture(battle.cardPreview, 'ui-icon-card-hover-stat-chip-frame');
    // Exercise the reward surface in reward mode, not the battle-only inspector.
    battle.mode = 'cardReward';
    battle.showChoiceCardDetail(rewardCard, 392, 360);
    const rewardTexts = collectText(battle.cardPreview);
    const rewardView = battle.battleHandCardView(rewardCard).preview;
    const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim();
    const rewardCopy = normalizeText(rewardTexts.join(' '));
    const rewardFrameCount = countTexture(battle.cardPreview, 'ui-icon-card-hover-dossier-frame');
    const rewardStatFrameCount = countTexture(battle.cardPreview, 'ui-icon-card-hover-stat-chip-frame');
    const battleFrameTelemetry = JSON.parse(window.render_game_to_text()).cardHoverDossierFrame;
    const battleStatFrameTelemetry = JSON.parse(window.render_game_to_text()).cardHoverStatChipFrame;
    battle.rewardChoices = battle.hand.slice(0, 3);
    battle.mode = 'cardReward';
    battle.renderAll();
    const rewardUiKeys = [
      'ui-icon-reward-choice-hover-ring',
      'ui-icon-reward-choice-spotlight',
      'ui-icon-reward-choice-glow-burst',
      'ui-icon-reward-choice-card-frame',
      'ui-icon-reward-ceremony-backdrop'
    ];
    for (let i = 0; i < 80 && !rewardUiKeys.every((key) => battle.textures.exists(key)); i += 1) await wait(50);
    battle.renderAll();
    for (let i = 0; i < 80 && battle.getTextState().rewardChoiceHoverRing?.count !== 3; i += 1) await wait(50);
    const rewardChoiceHit = collectObjects(battle.children)
      .find((child: any) => (
        child.name === 'reward-choice-card-hit'
        && Math.abs((child.x ?? 0) - 336) < 2
      ));
    const rewardHoverRingBefore = countVisibleTexture(battle.children, 'ui-icon-reward-choice-hover-ring');
    rewardChoiceHit?.emit('pointerover');
    const rewardHoverRingDuring = countVisibleTexture(battle.children, 'ui-icon-reward-choice-hover-ring');
    const rewardHoverRingTelemetry = JSON.parse(window.render_game_to_text()).rewardChoiceHoverRing;
    rewardChoiceHit?.emit('pointerout');
    await wait(40);
    const rewardHoverRingAfter = countVisibleTexture(battle.children, 'ui-icon-reward-choice-hover-ring');

    await window.__birdSquadStartScene!('RouteScene', {});
    await wait(80);
    const route: any = g.scene.getScene('RouteScene');
    const market = window.__birdSquadCurrentMap!().nodes.find((n: any) => n.type === 'market')
      ?? window.__birdSquadCurrentMap!().nodes.find((n: any) => n.type !== 'boss');
    market.type = 'market';
    route.openMarketNode(market);
    route.runState.scrap = 999;
    const marketOffer = route.marketCardOffer();
    route.renderAll();
    for (let i = 0; i < 200 && !route.routeSecondaryPresentationModule; i++) await wait(25);
    const marketHit = route.children.list.find((child: any) => child.getData?.('marketFocusId') === 'card:0');
    marketHit?.emit('pointerover');
    const fixedInspector = collectObjects(route.hoverCardDetail)
      .find((child: any) => child.name === 'market-fixed-card-inspector');
    const fixedInspectorBounds = fixedInspector?.getBounds?.();
    route.showHoverCardDetail(marketOffer, 'Market offer', 55, 250, 372);
    const marketTexts: string[] = [];
    const marketReader = collectObjects(route.hoverCardDetail).find((child: any) => child.name === 'market-fixed-card-inspector');
    for (let i = 0; i < marketReader.getData('reading').total; i++) {
      marketTexts.push(...collectText(route.hoverCardDetail)); marketReader.getData('turnRulesPage')(1);
    }
    const marketFrameCount = countTexture(route.hoverCardDetail, 'ui-icon-card-hover-dossier-frame');
    const marketStatFrameCount = countTexture(route.hoverCardDetail, 'ui-icon-card-hover-stat-chip-frame');

    const preenEntry = route.pickerEligibleCards('preen')[0];
    route.marketOpen = false;
    route.hideHoverCardDetail();
    route.cardPickerMode = 'preen';
    route.cardPickerContext = 'route';
    route.cardPickerRemainingPicks = 1;
    route.cardPickerFocusIndex = 0;
    route.renderAll();
    route.children.list.find((child: any) => child.name === 'card-picker-card-hit')?.emit('pointerover');
    const pickerHoverDetailOpen = Boolean(route.hoverCardDetail?.active);
    route.children.getByName('card-picker-card-inspect-hit').emit('pointerdown');
    const preenReader = route.hoverCardDetail.getByName('route-inspection-reader');
    const preenTexts: string[] = [];
    for (let i = 0; i < preenReader.getData('reading').total; i++) {
      preenTexts.push(...collectText(route.hoverCardDetail)); preenReader.getData('turnRulesPage')(1);
    }
    const preenFrameCount = countTexture(route.hoverCardDetail, 'ui-icon-card-hover-dossier-frame');
    const preenStatFrameCount = countTexture(route.hoverCardDetail, 'ui-icon-card-hover-stat-chip-frame');
    const routeFrameTelemetry = JSON.parse(window.render_game_to_text()).cardHoverDossierFrame;
    const routeStatFrameTelemetry = JSON.parse(window.render_game_to_text()).cardHoverStatChipFrame;

    return {
      reward: [rewardView.currentText, rewardView.alternateText, rewardView.stats]
        .filter(Boolean).every(text => rewardCopy.includes(normalizeText(text))),
      market: marketTexts.includes('NOW') && marketTexts.includes('PASSIVE FLOCK BONUSES'),
      preen: preenTexts.includes('NOW') && preenTexts.includes('PREEN') && preenTexts.includes('PASSIVE FLOCK BONUSES'),
      rewardTitle: rewardTexts.includes(rewardCard.name),
      marketTitle: marketTexts.includes(marketOffer.name),
      preenTitle: preenTexts.includes(preenEntry.card.name),
      handFrameCount,
      handStatFrameCount,
      rewardFrameCount,
      rewardStatFrameCount,
      marketFrameCount,
      marketStatFrameCount,
      preenFrameCount,
      preenStatFrameCount,
      battleFrameTelemetry,
      battleStatFrameTelemetry,
      routeStatFrameTelemetry,
      routeFrameTelemetry,
      rewardHoverRingLoaded: battle.textures.exists('ui-icon-reward-choice-hover-ring'),
      rewardHoverRingBefore,
      rewardHoverRingDuring,
      rewardHoverRingAfter,
      rewardHoverRingTelemetry,
      fixedInspectorBounds: fixedInspectorBounds ? {
        left: Math.round(fixedInspectorBounds.left),
        right: Math.round(fixedInspectorBounds.right),
      } : undefined,
      pickerHoverDetailOpen,
    };
  });
  expect(result.reward).toBe(true);
  expect(result.market).toBe(true);
  expect(result.preen).toBe(true);
  expect(result.rewardTitle).toBe(true);
  expect(result.marketTitle).toBe(true);
  expect(result.preenTitle).toBe(true);
  expect(result.fixedInspectorBounds).toEqual(expect.objectContaining({ left: expect.any(Number), right: expect.any(Number) }));
  expect(result.fixedInspectorBounds.left).toBe(84);
  expect(result.fixedInspectorBounds.right).toBe(444);
  expect(result.pickerHoverDetailOpen).toBe(false);
  // Compact inspectors retain authored rules without the legacy frame stack.
  expect(result.handFrameCount).toBe(0);
  expect(result.handStatFrameCount).toBe(0);
  expect(result.rewardFrameCount).toBe(0);
  expect(result.rewardStatFrameCount).toBe(0);
  expect(result.marketFrameCount).toBe(0);
  // The Market now reads complete stats in the shared paginated surface.
  expect(result.marketStatFrameCount).toBe(0);
  expect(result.preenFrameCount).toBe(0);
  expect(result.preenStatFrameCount).toBe(0);
  expect(result.battleFrameTelemetry).toMatchObject({ rendered: false });
  expect(result.battleStatFrameTelemetry).toMatchObject({ rendered: false });
  expect(result.routeFrameTelemetry).toMatchObject({ rendered: false });
  expect(result.routeStatFrameTelemetry).toMatchObject({ rendered: false });
  expect(result.rewardHoverRingLoaded).toBe(true);
  expect(result.rewardHoverRingBefore).toBe(0);
  expect(result.rewardHoverRingDuring).toBe(1);
  expect(result.rewardHoverRingAfter).toBe(0);
  expect(result.rewardHoverRingTelemetry).toMatchObject({ loaded: true, rendered: true, count: 3, visible: 1 });
});

test('route preen picker keeps large decks inside a two-row viewport', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    const collectObjects = (root: any): any[] => {
      const out: any[] = [];
      const visit = (node: any) => {
        if (!node) return;
        out.push(node);
        const children = node.list ?? node.children?.list;
        if (Array.isArray(children)) children.forEach(visit);
      };
      visit(root);
      return out;
    };
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    await wait(80);
    const route: any = g.scene.getScene('RouteScene');
    const nest = window.__birdSquadCurrentMap!().nodes.find((node: any) => node.type === 'nest')
      ?? window.__birdSquadCurrentMap!().nodes.find((node: any) => node.type !== 'boss');
    route.runState.deck = Array.from({ length: 18 }, (_, index) => ({
      id: ['major_00', 'wands_ace', 'cups_ace', 'swords_ace', 'pentacles_04', 'major_07'][index % 6],
      upgraded: false
    }));
    route.cardPickerMode = 'preen';
    route.cardPickerContext = 'route';
    route.nodeChoiceNodeId = nest.id;
    route.renderAll();

    const visibleCardArtCount = () => route.children.list
      .filter((child: any) => typeof child.texture?.key === 'string')
      .filter((child: any) => child.texture.key.startsWith('card-thumb-') || child.texture.key.startsWith('card-'))
      .length;
    for (let i = 0; i < 60 && visibleCardArtCount() < 10; i += 1) await wait(50);
    for (let i = 0; i < 40; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (
        route.children.list.filter((o: any) => o.name === 'card-picker-card-name').length === 10
        && state.cardPickerCostBadge?.count === 0
      ) break;
      await wait(50);
    }
    const firstState = JSON.parse(window.render_game_to_text!());
    const pickerFrameState = firstState.cardPickerFrame;
    const pickerCostBadgeState = firstState.cardPickerCostBadge;
    const pickerNameplateFrameState = firstState.cardPickerNameplateFrame;
    const pickerContextPlaqueState = firstState.cardPickerContextPlaque;

    const pickerHitAreas = () => route.children.list
      .filter((child: any) => child.type === 'Rectangle' && Math.abs((child.fillAlpha ?? 0) - 0.01) < 0.001)
      .map((child: any) => {
        const bounds = child.getBounds();
        return { bottom: bounds.bottom, height: bounds.height };
      })
      .filter((bounds: any) => bounds.height > 180);
    const rangeTexts = () => route.children.list
      .filter((child: any) => typeof child.text === 'string')
      .map((child: any) => child.text);
    const pageRange = () => route.children.list
      .filter((child: any) => typeof child.text === 'string' && child.text.includes('OF 18'))
      .map((child: any) => {
        const bounds = child.getBounds();
        return {
          text: child.text,
          fontSize: Number.parseFloat(child.style?.fontSize ?? '0'),
          width: Math.round(child.displayWidth),
          bounds: { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom }
        };
      })[0];
    const scrollButtonFrames = () => route.children.list
      .filter((child: any) => /^card-picker-scroll-(up|down)-hit$/.test(child.name))
      .map((child: any) => ({
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
        name: child.name,
        visible: child.visible
      }));
    const pageIndicatorFrames = () => route.children.list
      .filter((child: any) => child.name === 'card-picker-page-indicator-frame' && child.type === 'Rectangle')
      .map((child: any) => {
        const bounds = child.getBounds();
        return {
          width: Math.round(child.displayWidth),
          height: Math.round(child.displayHeight),
          alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
          name: child.name,
          visible: child.visible,
          bounds: { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom }
        };
      });
    const decisionDeltaBounds = () => route.children.list
      .filter((child: any) => child.name === 'card-picker-decision-delta')
      .map((child: any) => child.getBounds())
      .sort((a: any, b: any) => a.left - b.left);
    const nameplateFrames = () => route.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-card-picker-nameplate-frame')
      .map((child: any) => ({
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
        name: child.name,
        visible: child.visible
      }));
    const contextPlaques = () => route.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-card-picker-context-plaque')
      .map((child: any) => ({
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
        name: child.name,
        visible: child.visible
      }));
    const cancelCommandFrames = () => route.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-route-event-cancel-command-frame')
      .map((child: any) => ({
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
        name: child.name,
        visible: child.visible
      }));

    const firstPageHitAreas = pickerHitAreas();
    const firstPageScrollButtonFrames = scrollButtonFrames();
    const firstPagePageIndicatorFrames = pageIndicatorFrames();
    const firstPageRange = pageRange();
    const lastDecisionDeltaBounds = decisionDeltaBounds().at(-1);
    const firstPageNameplateFrames = nameplateFrames();
    const firstPageContextPlaques = contextPlaques();
    const firstPageCancelCommandFrames = cancelCommandFrames();
    const hasCancelLabel = rangeTexts().includes('Cancel');
    const hasContextLabel = rangeTexts().includes(nest.label ?? 'Workshop stop');
    route.scrollCardPicker(1);
    const secondPageRange = pageRange();
    const updatedState = JSON.parse(window.render_game_to_text!());
    const pickerScrollButtonFrameState = updatedState.cardPickerScrollButtonFrame;
    const pickerPageIndicatorFrameState = updatedState.cardPickerPageIndicatorFrame;
    const routeEventCancelCommandFrameState = updatedState.routeEventCancelCommandFrame;

    return {
      firstPageCount: firstPageHitAreas.length,
      maxHitBottom: Math.max(...firstPageHitAreas.map((bounds: any) => bounds.bottom)),
      firstPageRange,
      secondPageRange,
      firstPageArtCount: visibleCardArtCount(),
      firstPageScrollButtonFrames,
      firstPagePageIndicatorFrames,
      pageRangeInsideIndicator: firstPagePageIndicatorFrames.some((frame: any) => (
        firstPageRange
        && firstPageRange.bounds.left >= frame.bounds.left
        && firstPageRange.bounds.right <= frame.bounds.right
        && firstPageRange.bounds.top >= frame.bounds.top
        && firstPageRange.bounds.bottom <= frame.bounds.bottom
      )),
      pageIndicatorOverlapsLastDelta: firstPagePageIndicatorFrames.some((frame: any) => (
        lastDecisionDeltaBounds
        && frame.bounds.left < lastDecisionDeltaBounds.right
        && frame.bounds.right > lastDecisionDeltaBounds.left
        && frame.bounds.top < lastDecisionDeltaBounds.bottom
        && frame.bounds.bottom > lastDecisionDeltaBounds.top
      )),
      firstPageNameplateFrames,
      firstPageContextPlaques,
      firstPageCancelCommandFrames,
      hasCancelLabel,
      hasContextLabel,
      scroll: route.cardPickerScroll,
      pickerFrameState,
      pickerCostBadgeState,
      pickerNameplateFrameState,
      pickerContextPlaqueState,
      pickerScrollButtonFrameState,
      pickerPageIndicatorFrameState,
      routeEventCancelCommandFrameState
    };
  });

  expect(result.firstPageCount).toBe(10);
  expect(result.firstPageArtCount).toBeGreaterThanOrEqual(10);
  expect(result.maxHitBottom).toBeLessThan(650);
  expect(result.firstPageRange).toEqual(expect.objectContaining({ text: '1-10 OF 18', fontSize: 13, width: 82 }));
  expect(result.secondPageRange).toEqual(expect.objectContaining({ text: '6-15 OF 18', fontSize: 13, width: 82 }));
  expect(result.scroll).toBe(1);
  expect(result.pickerFrameState).toEqual(expect.objectContaining({
    loaded: false,
    rendered: false,
    count: 0,
    mode: 'preen',
    context: 'route'
  }));
  expect(result.pickerCostBadgeState).toEqual({
    loaded: false,
    rendered: false,
    count: 0
  });
  expect(result.pickerNameplateFrameState).toEqual({
    loaded: false,
    rendered: false,
    count: 0
  });
  expect(result.pickerContextPlaqueState).toEqual({
    loaded: false,
    rendered: false,
    count: 0
  });
  expect(result.firstPageContextPlaques).toHaveLength(0);
  expect(result.firstPageNameplateFrames).toHaveLength(0);
  expect(result.pickerScrollButtonFrameState).toEqual({
    loaded: true,
    rendered: false,
    count: 0
  });
  expect(result.pickerPageIndicatorFrameState).toEqual({
    loaded: true,
    rendered: false,
    count: 0
  });
  expect(result.firstPagePageIndicatorFrames).toHaveLength(1);
  expect(result.firstPagePageIndicatorFrames[0]).toEqual(expect.objectContaining({
    name: 'card-picker-page-indicator-frame',
    width: 88,
    height: 34,
    visible: true
  }));
  expect(result.pageRangeInsideIndicator).toBe(true);
  expect(result.pageIndicatorOverlapsLastDelta).toBe(false);
  expect(result.firstPageScrollButtonFrames).toHaveLength(2);
  expect(result.firstPageScrollButtonFrames.every((frame: { name: string; width: number; height: number; visible: boolean }) => (
    /^card-picker-scroll-(up|down)-hit$/.test(frame.name)
    && frame.width === 72
    && frame.height === 58
    && frame.visible
  ))).toBe(true);
  expect(result.routeEventCancelCommandFrameState).toEqual({
    loaded: true,
    rendered: false,
    count: 0
  });
  expect(result.firstPageCancelCommandFrames).toHaveLength(0);
  expect(result.hasCancelLabel).toBe(true);
  expect(result.hasContextLabel).toBe(false);
});

test('post-combat Preen is gated by encounter reward profile', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const seedBattle: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && !(seedBattle.hand && seedBattle.hand.length); i += 1) await wait(50);
    const deck = [...seedBattle.drawPile, ...seedBattle.hand, ...seedBattle.discardPile]
      .map((card: any) => ({ id: card.id, upgraded: !!card.upgraded }));
    const runState = {
      deck, leaderId: seedBattle.runLeaderId, difficulty: 0, seed: 'preen-profile-test', currentHp: 36,
      scrap: 0, routeMarks: [], supplies: [], mapIndex: 0, completedRouteNodeIds: [],
      currentRouteNodeId: undefined, routeLog: [], nextCombat: undefined, signalChoices: [], rewardEvents: [],
    };
    seedBattle.init({ runState });
    const map = (window as any).__birdSquadCurrentMap();
    const streets = map.nodes.filter((node: any) => node.type === 'street');
    const rival = map.nodes.find((node: any) => node.type === 'rival');
    const streetPreenWindows: boolean[] = [];
    for (const node of streets) {
      await window.__birdSquadStartScene!('BattleScene', { runState, routeNodeId: node.id });
      g.scene.stop('MenuScene');
      await wait(60);
      const battle: any = g.scene.getScene('BattleScene');
      streetPreenWindows.push(battle.shouldOfferUpgradeReward());
    }
    await window.__birdSquadStartScene!('BattleScene', { runState, routeNodeId: rival.id });
    await wait(60);
    const rivalBattle: any = g.scene.getScene('BattleScene');
    return {
      streetPreenWindows,
      hasRoutineNoPreen: streetPreenWindows.includes(false),
      rivalPreen: rivalBattle.shouldOfferUpgradeReward()
    };
  });
  expect(result.streetPreenWindows.length).toBeGreaterThan(0);
  expect(result.hasRoutineNoPreen).toBe(true);
  expect(result.rivalPreen).toBe(true);
});

test('nest remove opens a card picker and removes the chosen card', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('RouteScene');
    const nest = window.__birdSquadCurrentMap!().nodes.find((n: any) => n.type === 'nest');
    scene.openNodeChoices(nest);
    const deckBefore = scene.runState.deck.length;
    scene.chooseNodeOption('release');
    scene.claimRouteReward();
    const pickerMode = scene.cardPickerMode;
    const firstIndex = scene.pickerEligibleCards('release')[0].index;
    scene.applyCardPick(firstIndex);
    return { pickerMode, deckBefore, deckAfter: scene.runState.deck.length };
  });
  expect(result.pickerMode).toBe('release');
  expect(result.deckAfter).toBe(result.deckBefore - 1);
});

test('nest boss ready up allows two chosen preens before completing', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('RouteScene');
    const nest = window.__birdSquadCurrentMap!().nodes.find((n: any) => n.type === 'nest');
    scene.runState.scrap = 999;
    scene.runState.currentHp = 38;
    scene.runState.deck = [
      { id: 'major_00' },
      { id: 'wands_ace' },
      { id: 'cups_ace' },
      { id: 'swords_ace' }
    ];
    scene.openNodeChoices(nest);
    scene.chooseNodeOption('boss_ready_tune');
    const pendingKey = scene.pendingRouteReward?.choiceKey;
    scene.claimRouteReward();
    for (let i = 0; i < 200 && !scene.routeSecondaryPresentationModule; i++) await new Promise(resolve => setTimeout(resolve, 25));
    const titleBeforePick = scene.children.list
      .filter((child: any) => typeof child.text === 'string')
      .map((child: any) => child.text)
      .find((text: string) => text.includes('Preen'));
    const firstIndex = scene.pickerEligibleCards('preen')[0].index;
    scene.applyCardPick(firstIndex);
    const afterFirst = {
      remaining: scene.cardPickerRemainingPicks,
      pickerMode: scene.cardPickerMode,
      upgraded: scene.runState.deck.filter((card: any) => card.upgraded).length,
      completed: scene.runState.completedRouteNodeIds.includes(nest.id)
    };
    const secondIndex = scene.pickerEligibleCards('preen')[0].index;
    scene.applyCardPick(secondIndex);
    return {
      pendingKey,
      titleBeforePick,
      afterFirst,
      afterSecond: {
        pickerMode: scene.cardPickerMode,
        upgraded: scene.runState.deck.filter((card: any) => card.upgraded).length,
        completed: scene.runState.completedRouteNodeIds.includes(nest.id),
        nextCombat: scene.runState.nextCombat,
        scrap: scene.runState.scrap,
        currentHp: scene.runState.currentHp
      }
    };
  });

  expect(result.pendingKey).toBe('boss_ready_tune');
  expect(result.titleBeforePick).toBe('Preen 2 Cards');
  expect(result.afterFirst).toMatchObject({
    remaining: 1,
    pickerMode: 'preen',
    upgraded: 1,
    completed: false
  });
  expect(result.afterSecond.pickerMode).toBeUndefined();
  expect(result.afterSecond.upgraded).toBe(2);
  expect(result.afterSecond.completed).toBe(true);
  expect(result.afterSecond.nextCombat).toMatchObject({ bossDamageShield: 18, openSkyGuard: 2 });
  expect(result.afterSecond.scrap).toBe(869);
  expect(result.afterSecond.currentHp).toBe(35);
});

test('reward readability separates effects badges and build advice at every supported size', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await boot(page);
  await page.evaluate(async () => {
    const battle: any = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    const candidates = new Map<string, any>();
    for (let i = 0; i < 64; i++) battle.createRewardChoices().forEach((card: any) => candidates.set(card.id, card));
    battle.rewardChoices = [...candidates.values()].sort((a, b) => b.text.length - a.text.length).slice(0, 3);
    battle.mode = 'cardReward';
    battle.controllerChoiceIndex = 0;
    battle.battleInputActive = true;
    battle.renderAll();
  });
  await page.waitForFunction(() => window.__birdSquadGame.scene.getScene('BattleScene').root.list.some((child: any) => child.name === 'reward-build-read-panel'));
  const redrawInput = await page.evaluate(async () => {
    const battle = window.__birdSquadGame.scene.getScene('BattleScene');
    const oldHit = battle.root.list.find((o: any) => o.name === 'reward-card-inspect-hit');
    battle.requestBattleRender();
    await new Promise<void>((resolve) => battle.events.once('postupdate', resolve));
    const hits = battle.root.list.filter((o: any) => o.input?.enabled);
    return {
      replaced: !battle.root.list.includes(oldHit),
      count: hits.length,
      allRegistered: hits.every((o: any) => battle.input._list.includes(o) && !battle.input._pendingInsertion.includes(o)),
    };
  });
  expect(redrawInput.replaced).toBe(true);
  expect(redrawInput.count).toBeGreaterThanOrEqual(7);
  expect(redrawInput.allRegistered).toBe(true);
  for (const size of [{ width: 1000, height: 560 }]) {
    await page.setViewportSize(size);
    const geometry = await page.evaluate(() => {
      const battle = window.__birdSquadGame.scene.getScene('BattleScene');
      const objects = battle.root.list;
      const rect = (o: any) => { const b = o.getBounds(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom }; };
      const named = (name: string) => objects.filter((o: any) => o.name === name);
      return {
        effects: named('reward-card-effect').map((o: any) => ({ ...rect(o), font: parseInt(o.style.fontSize), lines: o.getWrappedText().length })),
        panels: named('reward-card-effect-panel').map(rect),
        badges: named('reward-card-molt-label').map(rect),
        advice: named('reward-build-observation').map((o: any) => ({ ...rect(o), font: parseInt(o.style.fontSize) })),
        dock: rect(named('reward-build-read-panel')[0]),
        skip: rect(named('reward-skip-hit')[0]),
      };
    });
    expect(geometry.effects).toHaveLength(3);
    geometry.effects.forEach((effect: any, index: number) => {
      expect(effect.font).toBeGreaterThanOrEqual(18);
      // Every rule is on the face; the longest offers wrap to seven lines at 18px,
      // the most the rules area holds at that size (font floor and panel bounds below).
      expect(effect.lines).toBeLessThanOrEqual(7);
      expect(effect.left).toBeGreaterThanOrEqual(geometry.panels[index].left + 4);
      expect(effect.right).toBeLessThanOrEqual(geometry.panels[index].right - 4);
      expect(effect.bottom).toBeLessThanOrEqual(geometry.panels[index].bottom);
      geometry.badges.forEach((badge: any) => expect(badge.bottom).toBeLessThan(effect.top));
    });
    expect(geometry.advice.length).toBeGreaterThan(0);
    geometry.advice.forEach((advice: any) => {
      expect(advice.font).toBeGreaterThanOrEqual(16);
      expect(advice.bottom).toBeLessThanOrEqual(geometry.dock.bottom - 4);
      expect(advice.right).toBeLessThanOrEqual(geometry.dock.right - 4);
    });
    expect(geometry.skip.left - geometry.dock.right).toBeGreaterThanOrEqual(20);
    await page.screenshot({ path: `.artifacts/test-results/reward-readability/cards-${size.width}x${size.height}.png` });
    await clickNamedGameObject(page, 'BattleScene', 'reward-card-inspect-hit');
    await page.waitForFunction(() => window.__birdSquadState!().rewardInspection?.open);
    await page.waitForFunction(() => window.__birdSquadGame.scene.getScene('BattleScene').rewardInspectionLayer?.list.some((o: any) => o.name === 'reward-deck-impact'));
    const inspection = await page.evaluate(() => {
      const battle = window.__birdSquadGame.scene.getScene('BattleScene');
      const panel = battle.rewardInspectionLayer.list.find((o: any) => o.name === 'reward-deck-impact');
      const box = panel.list[0].getBounds();
      return {
        impact: battle.getTextState().rewardInspection.deckImpact,
        overflow: panel.list.filter((o: any) => o.type === 'Text').some((o: any) => {
          const b = o.getBounds();
          return b.left < box.left || b.right > box.right || b.bottom > box.bottom;
        }),
        panelLeft: box.left,
        previewRight: battle.cardPreview.getBounds().right,
        readerFont: battle.cardPreview.list.find((o: any) => o.name === 'route-inspection-reader-body').style.fontSize,
      };
    });
    expect(inspection.overflow).toBe(false);
    expect(inspection.previewRight).toBeLessThan(inspection.panelLeft);
    expect(inspection.readerFont).toBe('22px');
    expect(inspection.impact.deckAfter).toBe(inspection.impact.deckBefore + 1);
    await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? '')).toContain('Base hand target');
    await page.screenshot({ path: `.artifacts/test-results/reward-readability/inspect-${size.width}x${size.height}.png` });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !window.__birdSquadState!().rewardInspection?.open);
  }
  const truncation = await page.evaluate(async () => {
    const battle = window.__birdSquadGame.scene.getScene('BattleScene');
    const card = battle.rewardChoices[0];
    const original = card.text;
    card.text = `${original} ${'An intentionally long conditional explanation for layout verification. '.repeat(8)}`;
    battle.renderAll();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const effect = battle.root.list.find((o: any) => o.name === 'reward-card-effect');
    const view = battle.rewardCardView(card, 0);
    const result = { visible: effect.text, primary: view.quickRead.primary, full: view.summary, lines: effect.getWrappedText().length };
    card.text = original;
    battle.renderAll();
    return result;
  });
  // Every rule stays on the face: long rules are never cut to a summary or an ellipsis.
  expect(truncation.visible.endsWith('...')).toBe(false);
  expect(truncation.visible).toContain('intentionally long conditional explanation');
  await clickNamedGameObject(page, 'BattleScene', 'reward-skip-hit');
  await page.waitForFunction(() => window.__birdSquadGame.scene.getScene('BattleScene').root.list.some((o: any) => o.name === 'reward-skip-tradeoff'));
  await page.screenshot({ path: '.artifacts/test-results/reward-readability/skip-1000x560.png' });
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('reward deck impact matches live draw targets for every Leader and Preen without modifying saves', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const battle: any = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    const candidates = new Map<string, any>();
    for (let i = 0; i < 96; i++) battle.createRewardChoices().forEach((card: any) => candidates.set(card.id, card));
    // Map 1 drafts lean on the district suit and common rarity, so few distinct
    // Plumes are offered there; the starter deck's Plumes fill the set.
    battle.allDeckCards().forEach((card: any) => { if (!candidates.has(card.id)) candidates.set(card.id, card); });
    const plumes = [...candidates.values()].filter((card) => card.runtime.suit === 'plumes').slice(0, 5);
    if (plumes.length < 5) throw new Error('Missing five distinct Plumes for keystone boundary');
    battle.hand = []; battle.discardPile = []; battle.clearedPile = [];
    battle.nextTurnDrawBonus = 0;
    const results: any[] = [];
    for (const leader of ['fledgling', 'spark_caller', 'talon', 'tidewarden', 'roostkeeper']) {
      battle.runLeaderId = leader;
      battle.mode = 'cardReward';
      battle.drawPile = plumes.slice(0, 4);
      const before = battle.handTargetSize();
      const savedBeforeAdd = JSON.stringify(localStorage);
      const add = battle.battleHandRendererModule.rewardDeckImpact(battle, plumes[4]);
      const addSaveUnchanged = savedBeforeAdd === JSON.stringify(localStorage);
      const unchanged = battle.drawPile.length === 4 && !plumes[4].upgraded;
      battle.drawPile = plumes;
      const after = battle.handTargetSize();
      battle.mode = 'upgradeReward';
      const savedBeforePreen = JSON.stringify(localStorage);
      const preen = battle.battleHandRendererModule.rewardDeckImpact(battle, plumes[0]);
      const preenSaveUnchanged = savedBeforePreen === JSON.stringify(localStorage);
      const beforePreen = battle.handTargetSize();
      battle.drawPile = plumes.map((card, index) => index === 0 ? { ...card, upgraded: true } : card);
      results.push({ leader, before, after, add, preen, beforePreen, afterPreen: battle.handTargetSize(), unchanged, addSaveUnchanged, preenSaveUnchanged });
    }
    return { results, savesUnchanged: results.every((row) => row.addSaveUnchanged && row.preenSaveUnchanged) };
  });
  expect(result.savesUnchanged).toBe(true);
  for (const row of result.results) {
    expect(row.unchanged).toBe(true);
    expect(row.add).toMatchObject({ deckBefore: 4, deckAfter: 5, handBefore: row.before, handAfter: row.after });
    expect(row.preen).toMatchObject({ deckBefore: 5, deckAfter: 5, handBefore: row.beforePreen, handAfter: row.afterPreen });
    expect(row.add.drawScope).toContain('Opening protection');
  }
});

test('reward advice preserves costs alongside competing synergy and district benefits', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const battle: any = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_c0_street_opening' });
    const card = { role: 'attack', type: 'card', cost: 2, runtime: { tags: ['attack'], suit: 'plumes', rarity: 'common' } };
    battle.hand = []; battle.discardPile = []; battle.clearedPile = [];
    battle.routeMarks = ['stage_pin'];
    const observe = (candidate: any, owned: any[]) => {
      battle.drawPile = owned;
      return battle.cardNeedTags(candidate);
    };
    const owned = Array.from({ length: 4 }, () => ({ ...card }));
    const observations = observe(card, owned);
    const district = battle.rewardObservations(card);
    battle.flyway.rooftopPlan = 'shelter';
    const planned = battle.rewardObservations({ ...card, runtime: { ...card.runtime, effects: ['gainCover(4)'] } });
    delete battle.flyway.rooftopPlan;
    const recovery = { ...card, role: 'skill', cost: 1, runtime: { ...card.runtime, tags: ['heal'] } };
    return {
      observations, district, planned,
      recovery: observe(recovery, Array.from({ length: 4 }, () => recovery)),
      first: observe(card, []),
      twentyOne: observe(card, Array.from({ length: 20 }, () => card)),
      preserved: owned.length === 4 && card.cost === 2,
    };
  });
  expect(result.observations).toEqual(['+ Feeds Stage Pin', '! 5 cards cost 2+']);
  expect(result.district).toEqual(['+ District lean: direct damage', '! 5 cards cost 2+']);
  expect(result.planned).toEqual(['Hold & Answer · Cover / Retain setup', '! 5 cards cost 2+', '+ District lean: direct damage']);
  expect(result.recovery).toEqual(['+ Feeds Stage Pin', '! Recovery already strong']);
  expect(result.first).toEqual(['+ Feeds Stage Pin', '+ First damage source']);
  expect(result.twentyOne[1]).toBe('! 21 cards cost 2+');
  expect(result.preserved).toBe(true);
});

for (const planned of [false, true]) test(`reward cost cautions remain visible and announced before commitment, planned=${planned}`, async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await boot(page);
  const expected = await page.evaluate(async (planned) => {
    const battle: any = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    // This checks presentation, not random draft coverage. Keep the real reward
    // factory, but use a fixed stream so the expensive shelter fixture is stable.
    let rewardSeed = 1;
    battle.combatRandom = () => {
      rewardSeed = (Math.imul(rewardSeed, 1_664_525) + 1_013_904_223) >>> 0;
      return rewardSeed / 0x1_0000_0000;
    };
    let choices: any[] = [];
    let index = -1;
    for (let attempt = 0; attempt < 32 && index < 0; attempt++) {
      choices = battle.createRewardChoices();
      index = choices.findIndex((card: any) => card.cost >= 2 && (!planned || /gainCover|fullyBlocksNextAttack|retainHand/.test(card.runtime.effects.join(' '))));
    }
    if (index < 0) throw new Error('Expected a real 2+ cost reward candidate');
    const card = choices[index];
    if (planned) battle.flyway.rooftopPlan = 'shelter';
    battle.hand = [];
    battle.discardPile = [];
    battle.clearedPile = [];
    battle.drawPile = Array.from({ length: 4 }, (_, copy) => ({ ...card, instanceId: `cost-advice-${copy}` }));
    battle.rewardChoices = choices;
    battle.controllerChoiceIndex = index;
    battle.rewardChoiceArmedId = undefined;
    battle.rewardSkipArmed = false;
    battle.mode = 'cardReward';
    battle.battleInputActive = true;
    battle.renderAll();
    return { observations: battle.rewardObservations(card), count: battle.allDeckCards().length };
  }, planned);
  expect(expected.observations).toContain('! 5 cards cost 2+');
  if (planned) expect(expected.observations[0]).toContain('Hold & Answer');
  await page.waitForFunction(() => {
    const battle = window.__birdSquadGame.scene.getScene('BattleScene');
    return battle.getTextState().battleRewardRenderer?.ready
      && battle.root.list.some((child: any) => child.name === 'reward-build-observation' && child.text === '! 5 cards cost 2+');
  });
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? '')).toContain('5 cards cost 2+');
  for (const size of [{ width: 1000, height: 560 }]) {
    await page.setViewportSize(size);
    await page.screenshot({ path: `.artifacts/test-results/reward-tradeoffs/reward-${planned ? 'planned' : 'open'}-${size.width}x${size.height}.png` });
  }
  expect(await page.evaluate(() => window.__birdSquadGame.scene.getScene('BattleScene').allDeckCards().length)).toBe(expected.count);
  expect(await page.evaluate(() => window.__birdSquadGame.scene.getScene('BattleScene').rewardChoiceArmedId)).toBeUndefined();
});

test('combat rewards deliberately mix deck need, suit synergy, and wildcard slots', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const battle: any = g.scene.getScene('BattleScene');
    const anchor = battle.allDeckCards().find((card: any) => card.runtime.suit);
    if (!anchor) throw new Error('Expected a suited starter card');
    battle.drawPile = Array.from({ length: 4 }, (_value, index) => ({
      ...anchor,
      instanceId: `dominant-${index}`,
      runtime: { ...anchor.runtime }
    }));
    battle.discardPile = [];
    battle.hand = [];
    const waymarkBySuit: Record<string, string> = {
      plumes: 'stage_pin', basins: 'feather_tape', quills: 'quill_notch', nests: 'workshop_stamp'
    };
    battle.routeMarks = [waymarkBySuit[anchor.runtime.suit]];
    let firstChoices: any[] = [];
    const drafts = Array.from({ length: 32 }, (_value, seed) => {
      let state = seed + 1;
      battle.combatRandom = () => {
        state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
        return state / 0x1_0000_0000;
      };
      const choices = battle.createRewardChoices();
      if (seed === 0) firstChoices = choices;
      return choices.map((card: any) => ({ id: card.id, suit: card.runtime.suit, role: card.role }));
    });
    const choices = firstChoices;
    return {
      dominantSuit: anchor.runtime.suit,
      choiceSuits: choices.map((card: any) => card.runtime.suit),
      choiceRoles: choices.map((card: any) => card.role),
      firstNeedTags: battle.cardNeedTags(choices[0]),
      synergyTags: battle.cardNeedTags(choices[1]),
      allTagCounts: choices.map((card: any) => battle.cardNeedTags(card).length),
      ids: choices.map((card: any) => card.id),
      drafts,
    };
  });

  expect(result.ids).toHaveLength(3);
  expect(new Set(result.ids).size).toBe(3);
  expect(result.firstNeedTags.some((tag: string) => tag.includes('First ') || tag.includes('Fills ') || tag.includes('KEYSTONE'))).toBe(true);
  expect(result.choiceSuits[1]).toBe(result.dominantSuit);
  expect(result.choiceSuits[2]).not.toBe(result.dominantSuit);
  expect(result.choiceRoles.slice(0, 2)).not.toContain(result.choiceRoles[2]);
  expect(result.synergyTags.some((tag: string) => tag.includes('Feeds '))).toBe(true);
  expect(result.synergyTags.some((tag: string) => tag.includes('KEYSTONE') || tag.startsWith('!'))).toBe(true);
  expect(result.allTagCounts.every((count: number) => count > 0 && count <= 2)).toBe(true);
  expect(result.drafts).toHaveLength(32);
  for (const draft of result.drafts) {
    expect(draft).toHaveLength(3);
    expect(new Set(draft.map((card: any) => card.id)).size).toBe(3);
    expect(draft[1].suit).toBe(result.dominantSuit);
    expect(draft[2].suit).not.toBe(result.dominantSuit);
    expect(draft.slice(0, 2).map((card: any) => card.role)).not.toContain(draft[2].role);
  }
});

test('district reward leans shape and explain the pivot without replacing deck-aware choices', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const configs = [
      { routeNodeId: 'm1_c0_street_opening', mapIndex: 0, expected: ['Cover', 'direct damage'] },
      { routeNodeId: 'm2_c0_street_dock', mapIndex: 1, expected: ['healing'] },
      { routeNodeId: 'm3_c0_street_relay', mapIndex: 2, expected: ['tempo', 'Open Sky Guard'] },
      { routeNodeId: 'm4_c0_street_opening', mapIndex: 3, expected: ['rare cards', 'Open Sky Guard', 'boss prep'] },
    ];
    const profiles: any[] = [];
    let finalBattle: any;
    let finalChoices: any[] = [];
    let finalFocusIndex = 0;
    for (const config of configs) {
      const battle: any = await window.__birdSquadStartScene!('BattleScene', {
        routeNodeId: config.routeNodeId,
        runState: {
          deck: [{ id: 'major_00' }, { id: 'wands_ace' }],
          leaderId: 'fledgling',
          difficulty: 0,
          seed: `district-reward-${config.mapIndex}`,
          currentHp: 38,
          scrap: 40,
          routeMarks: [],
          supplies: [],
          mapIndex: config.mapIndex,
          completedRouteNodeIds: [],
          currentRouteNodeId: undefined,
          routeLog: [],
          nextCombat: undefined,
          signalChoices: [],
          rewardEvents: [],
        },
      });
      window.__birdSquadGame.scene.stop('MenuScene');
      const anchor = battle.allDeckCards().find((card: any) => card.runtime.suit);
      if (!anchor) throw new Error(`Missing suited anchor for ${config.routeNodeId}`);
      battle.drawPile = Array.from({ length: 4 }, (_value, index) => ({
        ...anchor,
        instanceId: `${config.routeNodeId}-dominant-${index}`,
        runtime: { ...anchor.runtime, tags: [...anchor.runtime.tags] },
      }));
      battle.discardPile = [];
      battle.hand = [];
      battle.clearedPile = [];
      const drafts: any[] = [];
      for (let seed = 0; seed < 16; seed += 1) {
        let state = seed + 1;
        battle.combatRandom = () => {
          state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
          return state / 0x1_0000_0000;
        };
        const choices = battle.createRewardChoices();
        drafts.push({
          ids: choices.map((card: any) => card.id),
          suits: choices.map((card: any) => card.runtime.suit),
          roles: choices.map((card: any) => card.role),
          observations: choices.map((card: any) => battle.rewardObservations(card)),
        });
        if (seed === 0) {
          finalChoices = choices;
          finalFocusIndex = Math.max(0, choices.findIndex((card: any) => (
            battle.rewardObservations(card)[0]?.startsWith('+ District lean:')
          )));
        }
      }
      profiles.push({
        routeNodeId: config.routeNodeId,
        expected: config.expected,
        lean: battle.districtLeans(),
        dominantSuit: anchor.runtime.suit,
        drafts,
      });
      finalBattle = battle;
    }
    finalBattle.rewardChoices = finalChoices;
    finalBattle.rewardDecisionStartedAtMs = Date.now();
    finalBattle.rewardChoiceArmedId = undefined;
    finalBattle.rewardSkipArmed = false;
    finalBattle.controllerChoiceIndex = finalFocusIndex;
    finalBattle.battleInputActive = true;
    finalBattle.mode = 'cardReward';
    finalBattle.renderAll();
    for (let index = 0; index < 100 && !finalBattle.getTextState().battleRewardRenderer?.ready; index += 1) {
      await wait(50);
      finalBattle.renderAll();
    }
    await wait(100);
    const textState = finalBattle.getTextState();
    return {
      profiles,
      final: {
        stateLean: textState.rewardDistrictLean,
        focusIndex: finalFocusIndex,
        focusedObservations: textState.rewardChoices?.[finalFocusIndex]?.observations,
        leanCopy: finalBattle.root.list
          .filter((child: any) => child.type === 'Text' && child.text?.includes('District lean:'))
          .map((child: any) => child.text),
        renderedObservations: finalBattle.root.list
          .filter((child: any) => child.name === 'reward-build-observation')
          .map((child: any) => child.text),
        live: document.getElementById('game-status')?.textContent ?? '',
      },
    };
  });

  expect(result.profiles).toHaveLength(4);
  for (const profile of result.profiles) {
    expect(profile.lean).toEqual(profile.expected);
    expect(profile.drafts).toHaveLength(16);
    for (const draft of profile.drafts) {
      expect(draft.ids).toHaveLength(3);
      expect(new Set(draft.ids).size).toBe(3);
      expect(draft.suits[1]).toBe(profile.dominantSuit);
      expect(draft.suits[2]).not.toBe(profile.dominantSuit);
      expect(draft.roles.slice(0, 2)).not.toContain(draft.roles[2]);
      expect(
        draft.observations.some((observations: string[]) => observations[0]?.startsWith('+ District lean:')),
        `${profile.routeNodeId}: ${JSON.stringify(draft)}`,
      ).toBe(true);
    }
  }
  expect(result.final.stateLean).toEqual(['rare cards', 'Open Sky Guard', 'boss prep']);
  expect(result.final.focusedObservations).toHaveLength(2);
  expect(result.final.focusedObservations[0]).toMatch(/^\+ District lean: /);
  expect(result.final.leanCopy).toContain('Pick a card or take Scrap. District lean: rare cards / Open Sky Guard / boss prep.');
  expect(result.final.renderedObservations).toEqual(result.final.focusedObservations);
  await expect(page.locator('#game-status')).toContainText('District lean: rare cards, Open Sky Guard, boss prep.');
  await expect(page.locator('#game-status')).toContainText(`Build observations: ${result.final.focusedObservations.join('; ')}.`);
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/district-reward-lean-1000x560.png' });
});

test('Preen offers and automatic upgrades exclude no-op Snags and duplicate copies', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const battle: any = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    const candidate = battle.allDeckCards().find((card: any) => (
      card.runtime.kind !== 'snag' && card.text !== card.upgradedText
    ));
    const enemy = battle.enemies[0];
    if (!candidate || !enemy) throw new Error('Missing Preen fixture cards');
    battle.resolveEnemyEffect(enemy, 'addSnagToDiscard(tangled_line)', 'Preen eligibility test');
    const snag = battle.discardPile.pop();
    if (!snag) throw new Error('Missing generated Snag');
    const duplicate = { ...candidate, instanceId: `${candidate.instanceId}-duplicate`, upgraded: false };
    candidate.upgraded = false;
    battle.drawPile = [candidate, duplicate, snag];
    battle.hand = [];
    battle.discardPile = [];
    battle.clearedPile = [];
    battle.combatRandom = () => 0.5;
    const offers = battle.createUpgradeChoices();
    candidate.upgraded = true;
    duplicate.upgraded = true;
    snag.upgraded = false;
    const snagOnlyOffers = battle.createUpgradeChoices();
    const canOfferSnagOnlyPreen = battle.shouldOfferUpgradeReward();
    battle.upgradeChoices = offers;
    battle.chooseUpgradeCard(snag.id);
    const unofferedSnagUpgraded = snag.upgraded === true;

    const route: any = await window.__birdSquadStartScene!('RouteScene', {});
    route.runState.deck = [
      { id: 'tangled_line', upgraded: false },
      { id: 'major_00', upgraded: false },
    ];
    const pickerIds = route.pickerEligibleCards('preen').map((entry: any) => entry.card.id);
    const marketCandidateId = route.marketPreenCandidate()?.id;
    const automaticallyPreened = route.preenFirstAvailableCard();
    return {
      candidateId: candidate.id,
      offerIds: offers.map((card: any) => card.id),
      offerKinds: offers.map((card: any) => card.runtime.kind),
      snagOnlyOfferIds: snagOnlyOffers.map((card: any) => card.id),
      canOfferSnagOnlyPreen,
      unofferedSnagUpgraded,
      pickerIds,
      marketCandidateId,
      automaticallyPreenedId: automaticallyPreened?.id,
      routeDeck: route.runState.deck,
    };
  });

  expect(result.offerIds).toEqual([result.candidateId]);
  expect(result.offerKinds).not.toContain('snag');
  expect(result.snagOnlyOfferIds).toEqual([]);
  expect(result.canOfferSnagOnlyPreen).toBe(false);
  expect(result.unofferedSnagUpgraded).toBe(false);
  expect(result.pickerIds).toEqual(['major_00']);
  expect(result.marketCandidateId).toBe('major_00');
  expect(result.automaticallyPreenedId).toBe('major_00');
  expect(result.routeDeck).toEqual([
    { id: 'tangled_line', upgraded: false },
    { id: 'major_00', upgraded: true },
  ]);
});

test('reward card inspection preserves combat and route choices across pointer keyboard and controller paths', async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page);
  const combatOpen = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const collectObjects = (root: any): any[] => {
      const found: any[] = [];
      const visit = (node: any) => {
        if (!node) return;
        found.push(node);
        const children = node.list ?? node.children?.list;
        if (Array.isArray(children)) children.forEach(visit);
      };
      visit(root);
      return found;
    };
    const game = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    game.scene.stop('MenuScene');
    const battle: any = game.scene.getScene('BattleScene');
    for (let index = 0; index < 60 && !(battle.hand?.length && battle.battleRewardRendererModule); index += 1) {
      await wait(50);
    }
    battle.rewardChoices = battle.hand.slice(0, 3);
    battle.mode = 'cardReward';
    battle.controllerChoiceIndex = 1;
    battle.battleInputActive = true;
    battle.renderAll();
    for (let index = 0; index < 60 && !battle.getTextState().battleRewardRenderer?.ready; index += 1) {
      await wait(50);
    }
    battle.renderAll();
    const rewardIds = battle.rewardChoices.map((card: any) => card.id);
    const deckBefore = battle.allDeckCards().map((card: any) => card.instanceId);
    battle.openRewardCardInspection(rewardIds[1]);
    await wait(50);
    battle.renderAll();
    const state = battle.getTextState();
    const objects = collectObjects(battle.children);
    return {
      state,
      rewardIds,
      deckBefore,
      inspectHits: objects
        .filter((object: any) => object.name === 'reward-card-inspect-hit')
        .map((object: any) => ({ width: object.displayWidth, height: object.displayHeight })),
      modalRendered: objects.some((object: any) => object.name === 'reward-card-inspection'),
      previewRendered: Boolean(battle.cardPreview?.active),
    };
  });

  expect(combatOpen.state.rewardInspection).toMatchObject({
    open: true,
    cardId: combatOpen.rewardIds[1],
    returnIndex: 1,
    selectActionPreserved: true,
  });
  expect(combatOpen.state.rewardChoices.map((card: any) => card.id)).toEqual(combatOpen.rewardIds);
  expect(combatOpen.inspectHits).toHaveLength(combatOpen.rewardIds.length);
  expect(combatOpen.inspectHits.every((hit: any) => hit.width >= 44 && hit.height >= 44)).toBe(true);
  expect(combatOpen.modalRendered).toBe(true);
  expect(combatOpen.previewRendered).toBe(true);
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/reward-card-inspection-combat.png' });

  const combatClosed = await page.evaluate(() => {
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    battle.handleBattleBack();
    battle.renderAll();
    return {
      state: battle.getTextState(),
      rewardIds: battle.rewardChoices.map((card: any) => card.id),
      deck: battle.allDeckCards().map((card: any) => card.instanceId),
    };
  });
  expect(combatClosed.state.rewardInspection).toMatchObject({ open: false, returnIndex: 1 });
  expect(combatClosed.rewardIds).toEqual(combatOpen.rewardIds);
  expect(combatClosed.deck).toEqual(combatOpen.deckBefore);

  const routeOpen = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const game = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    game.scene.stop('MenuScene');
    const route: any = game.scene.getScene('RouteScene');
    const node = { id: 'inspection_cache', type: 'cache', label: 'Inspection Cache', payloadId: 'inspection_cache' };
    const choice = {
      key: 'inspect_reward',
      text: 'Review the drawer.',
      effects: ['addCard(chooseOneOfTwoUncommonOrRare)'],
      locked: false,
    };
    route.openRouteRewardMenu(node, choice, structuredClone(route.runState));
    for (let index = 0; index < 60 && !route.routeRewardOverlayModule; index += 1) await wait(50);
    route.renderAll();
    route.cycleRouteRewardChoice(1);
    const focused = route.focusedRouteRewardCard();
    const rewardIds = route.routeCardRewardChoices.map((card: any) => card.id);
    const deckBefore = route.runState.deck.map((card: any) => ({ ...card }));
    route.openRouteRewardInspection(focused.id);
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const inspectHits = route.children.list
      .filter((object: any) => object.name === 'route-reward-card-inspect-hit')
      .map((object: any) => ({ width: object.displayWidth, height: object.displayHeight }));
    return {
      state,
      rewardIds,
      deckBefore,
      inspectHits,
      modalRendered: route.children.list.some((object: any) => object.name === 'route-reward-inspection-scrim'),
      focusRendered: route.children.list.some((object: any) => object.name === 'route-reward-input-focus-ring'),
    };
  });

  expect(routeOpen.state.routeReward.inputFocus).toMatchObject({
    index: 1,
    cardId: routeOpen.rewardIds[1],
    visible: true,
  });
  expect(routeOpen.state.routeReward.inspection).toMatchObject({
    open: true,
    cardId: routeOpen.rewardIds[1],
    returnIndex: 1,
    returnArmed: true,
    returnChoiceId: routeOpen.rewardIds[1],
    selectActionPreserved: true,
  });
  expect(routeOpen.inspectHits).toHaveLength(routeOpen.rewardIds.length);
  expect(routeOpen.inspectHits.every((hit: any) => hit.width >= 44 && hit.height >= 44)).toBe(true);
  expect(routeOpen.modalRendered).toBe(true);
  expect(routeOpen.focusRendered).toBe(true);
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/reward-card-inspection-route.png' });

  const routeClosed = await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    route.closeRouteRewardInspection();
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return {
      state,
      rewardIds: route.routeCardRewardChoices.map((card: any) => card.id),
      deck: route.runState.deck.map((card: any) => ({ ...card })),
    };
  });
  expect(routeClosed.state.routeReward.inspection).toMatchObject({ open: false, returnIndex: 1 });
  expect(routeClosed.state.routeReward.inputFocus).toMatchObject({
    index: 1,
    cardId: routeOpen.rewardIds[1],
    armed: true,
    armedCardId: routeOpen.rewardIds[1],
  });
  expect(routeClosed.rewardIds).toEqual(routeOpen.rewardIds);
  expect(routeClosed.deck).toEqual(routeOpen.deckBefore);
});

test('card picker deck impact stays readable and keeps service prices separate from card costs', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await boot(page);
  await page.evaluate(async () => window.__birdSquadStartScene!('RouteScene', {}));
  await page.waitForFunction(() => !!window.__birdSquadGame.scene.getScene('RouteScene').cardHoverDetailModule);
  for (const mode of ['release', 'preen']) {
    const original = await page.evaluate(mode => {
      const route = window.__birdSquadGame.scene.getScene('RouteScene');
      route.cardPickerMode = mode;
      route.cardPickerContext = mode === 'release' ? 'market' : 'route';
      route.marketOpen = mode === 'release';
      route.runState.scrap = 0;
      route.cardPickerFocusIndex = 0;
      route.cardPickerRemainingPicks = 1;
      route.cardPickerArmedIndex = undefined;
      route.cardPickerInspectionOpen = false;
      route.renderAll();
      return JSON.stringify(route.runState);
    }, mode);
    await page.waitForFunction(() => window.__birdSquadGame.scene.getScene('RouteScene').children.getByName('card-picker-card-inspect-hit'));
    await settleCanvas(page);
    await page.keyboard.press('r');
    await page.waitForFunction(() => window.__birdSquadGame.scene.getScene('RouteScene').children.list.some((o: any) => o.name === 'card-picker-deck-impact'));
    for (const size of [{ width: 1000, height: 560 }]) {
      await page.setViewportSize(size);
      await page.waitForFunction(() => { const b = document.querySelector('canvas')!.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1; });
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      const view = await page.evaluate(() => {
        const route = window.__birdSquadGame.scene.getScene('RouteScene');
        const panel = route.children.list.find((o: any) => o.name === 'card-picker-deck-impact');
        const box = panel.list[0].getBounds();
        const labels = panel.list.filter((o: any) => o.type === 'Text');
        const fullState = JSON.parse(window.render_game_to_text!());
        const state = fullState.cardPickerInput;
        const reader = route.hoverCardDetail.getByName('route-inspection-reader');
        const impactPages: string[] = [];
        const total = reader.getData('reading').total;
        reader.getData('turnRulesPage')(-total);
        for (let i = 0; i < total; i++) {
          const reading = reader.getData('reading');
          if (reading.title === 'FULL FLIGHT IMPACT') impactPages.push(reading.text);
          reader.getData('turnRulesPage')(1);
        }
        reader.getData('turnRulesPage')(-total);
        return {
          state, text: labels.map((o: any) => o.text), impactText: impactPages.join('\n'),
          iconStates: ['cardPickerFrame', 'cardPickerScrollButtonFrame', 'cardPickerCostBadge', 'cardPickerPageIndicatorFrame']
            .map(key => fullState[key]),
          overflow: labels.some((o: any) => { const b = o.getBounds(); return b.right > box.right - 12 || b.bottom > box.bottom - 12; }),
          gap: box.left - route.hoverCardDetail.getBounds().right,
          badgeCost: route.cardHoverDetailRequest.cost,
          cardCost: route.pickerEligibleCards(route.cardPickerMode)[route.cardPickerFocusIndex].card.cost,
          run: JSON.stringify(route.runState),
        };
      });
      expect(view.overflow).toBe(false);
      for (const icon of view.iconStates) {
        expect(typeof icon.loaded).toBe('boolean');
        expect(icon.rendered).toBe(icon.count > 0);
      }
      expect(view.gap).toBeGreaterThan(24);
      expect(view.text.slice(0, 4)).toEqual([...view.state.deckImpact.lines.slice(0, 3), view.state.deckImpact.lines[5]]);
      expect(view.impactText.replace(/\s/g, '')).toBe(view.state.deckImpact.lines.join('\n').replace(/\s/g, ''));
      expect(view.badgeCost).toBe(view.cardCost);
      expect(view.run).toBe(original);
      expect(view.state.deckImpact.deckAfter).toBe(view.state.deckImpact.deckBefore - (mode === 'release' ? 1 : 0));
      if (mode === 'release') expect(view.text.join(' ')).toContain('more.');
      await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? '')).toContain('Base hand target');
      await page.screenshot({ path: `.artifacts/test-results/picker-deck-impact/${mode}-${size.width}x${size.height}.png` });
    }
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !JSON.parse(window.render_game_to_text!()).cardPickerInput.inspectionOpen);
    expect(await page.evaluate(() => JSON.stringify(window.__birdSquadGame.scene.getScene('RouteScene').runState))).toBe(original);
  }
  expect(errors).toEqual([]);
});

test('card picker projections match combat for every Leader across the suit threshold', async ({ page }) => {
  await boot(page);
  const cases = await page.evaluate(async () => {
    const route = await window.__birdSquadStartScene!('RouteScene', {});
    route.runState.deck = ['wands_02', 'wands_03', 'wands_04', 'wands_05', 'wands_06']
      .map((id, i) => ({ id, upgraded: i === 2 }));
    route.cardPickerContext = 'route';
    const battle = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    battle.hand = []; battle.discardPile = []; battle.clearedPile = []; battle.nextTurnDrawBonus = 0;
    const results = [];
    for (const leader of ['fledgling', 'spark_caller', 'talon', 'tidewarden', 'roostkeeper']) {
      for (const mode of ['release', 'preen']) {
        route.runState.leaderId = leader;
        route.cardPickerMode = mode;
        const snapshot = JSON.stringify({ run: route.runState, storage: { ...localStorage } });
        const selected = mode === 'release' ? 2 : 1;
        const projected = battle.battleHandRendererModule.cardPickerDeckImpact(route, selected);
        const unchanged = snapshot === JSON.stringify({ run: route.runState, storage: { ...localStorage } });
        const cards = route.pickerEligibleCards('release').map((e: any) => e.card);
        battle.runLeaderId = leader; battle.drawPile = cards;
        const before = battle.handTargetSize();
        battle.drawPile = mode === 'release' ? cards.filter((_: any, i: number) => i !== selected)
          : cards.map((c: any, i: number) => i === selected ? { ...c, upgraded: true } : c);
        results.push({ projected, before, after: battle.handTargetSize(), unchanged, copies: battle.drawPile.length });
      }
    }
    return results;
  });
  expect(cases).toHaveLength(10);
  for (const result of cases) {
    expect(result.projected.handBefore).toBe(result.before);
    expect(result.projected.handAfter).toBe(result.after);
    expect(result.projected.deckAfter).toBe(result.copies);
    expect(result.unchanged).toBe(true);
  }
});

test('card picker inspection preserves Preen and Release decisions across pointer keyboard and controller paths', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await boot(page);

  const preenStart = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const game = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    game.scene.stop('MenuScene');
    const route: any = game.scene.getScene('RouteScene');
    for (let index = 0; index < 60 && !route.cardHoverDetailModule; index += 1) await wait(50);
    const starter = structuredClone(route.runState.deck);
    route.runState.deck = [
      ...starter,
      ...structuredClone(starter),
      ...structuredClone(starter),
    ];
    const node = window.__birdSquadCurrentMap!().nodes.find((candidate: any) => candidate.type === 'nest')
      ?? window.__birdSquadCurrentMap!().nodes.find((candidate: any) => candidate.type !== 'boss');
    route.nodeChoiceNodeId = node.id;
    route.nodeChoiceOpen = false;
    route.routeCardPickerRestoreState = structuredClone(route.runState);
    route.cardPickerMode = 'preen';
    route.cardPickerContext = 'route';
    route.cardPickerRemainingPicks = 3;
    route.cardPickerFocusIndex = 0;
    route.cardPickerArmedIndex = undefined;
    route.cardPickerScroll = 0;
    route.renderAll();
    for (let index = 0; index < 60; index += 1) {
      const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
      if (state.cardPickerInput?.inspectTargets === 1) break;
      await wait(50);
    }
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return {
      state,
      deck: structuredClone(route.runState.deck),
      upgraded: route.runState.deck.filter((card: any) => card.upgraded).length,
      inspectHits: route.children.list
        .filter((object: any) => object.name === 'card-picker-card-inspect-hit')
        .map((object: any) => ({ width: object.displayWidth, height: object.displayHeight })),
      pickerRequestModules: {
        cardHover: typeof route.cardHoverDetailModule?.requestCardPick,
        routeReward: typeof route.routeRewardOverlayModule?.requestCardPick,
      },
    };
  });

  expect(preenStart.state.cardPickerInput).toMatchObject({
    mode: 'preen',
    context: 'route',
    focusIndex: 0,
    focusVisible: true,
    inspectTargets: 1,
    inspectionOpen: false,
    decisionPreserved: true,
  });
  expect(preenStart.state.cardPickerInput.count).toBeGreaterThan(10);
  expect(preenStart.inspectHits).toHaveLength(1);
  expect(preenStart.inspectHits.every((hit: any) => hit.width >= 44 && hit.height >= 44)).toBe(true);
  expect(preenStart.pickerRequestModules.cardHover).toBe('function');
  await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    route.cardHoverDetailModule = undefined;
    route.routeRewardOverlayModule = undefined;
    route.cardHoverDetailLoading = true;
    const first = route.pickerEligibleCards(route.cardPickerMode)[0];
    route.requestCardPick(first.index);
  });
  await expect.poll(async () => (
    JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).cardPickerInput?.armed
  )).toBe(true);
  expect(await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return route.runState.deck.filter((card: any) => card.upgraded).length;
  })).toBe(preenStart.upgraded);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (
    JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).cardPickerInput?.armed
  )).toBe(false);

  const clickPickerCard = async (visibleIndex: number) => {
    const center = await page.evaluate((index) => {
      const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
      const hits = route.children.list.filter(
        (object: any) => object.name === 'card-picker-card-hit' && object.input?.enabled,
      );
      const hit = hits[index];
      if (!hit) throw new Error(`Missing card picker hit ${index}`);
      return { x: hit.x, y: hit.y };
    }, visibleIndex);
    const canvas = await page.locator('canvas').boundingBox();
    if (!canvas) throw new Error('Missing game canvas');
    const x = canvas.x + canvas.width * (center.x / 1280);
    const y = canvas.y + canvas.height * (center.y / 720);
    await page.mouse.move(x, y);
    await page.waitForTimeout(50);
    await page.mouse.down();
    await page.mouse.up();
  };

  await clickPickerCard(0);
  await expect.poll(async () => (
    JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).cardPickerInput?.armed
  )).toBe(true);
  const pointerArmed = await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    const rail = route.children.list.find((object: any) => object.name === 'card-picker-confirmation-rail');
    const namedText = (name: string) => route.children.list.find((object: any) => object.name === name)?.text;
    return {
      state: JSON.parse(window.render_game_to_text?.() ?? '{}').cardPickerInput,
      upgraded: route.runState.deck.filter((card: any) => card.upgraded).length,
      remaining: route.cardPickerRemainingPicks,
      presentation: {
        railSize: rail ? [rail.displayWidth, rail.displayHeight] : [],
        title: namedText('card-picker-confirmation-title'),
        summary: namedText('card-picker-confirmation-summary'),
        command: namedText('card-picker-confirmation-command'),
        cardDeltas: route.children.list
          .filter((object: any) => object.name === 'card-picker-decision-delta')
          .map((object: any) => object.text),
      },
    };
  });
  expect(pointerArmed.upgraded).toBe(preenStart.upgraded);
  expect(pointerArmed.remaining).toBe(3);
  expect(pointerArmed.state).toMatchObject({
    armed: true,
    commitBlockedUntilSelected: false,
    controls: { apply: 'Confirm / A / second pointer activation commits' },
  });
  expect(pointerArmed.presentation).toMatchObject({
    railSize: [560, 58],
    command: 'CONFIRM',
  });
  expect(pointerArmed.presentation.title).toMatch(/^PREEN  /);
  expect(pointerArmed.presentation.summary.length).toBeGreaterThan(0);
  expect(pointerArmed.presentation.cardDeltas.every((text: string) => !text.includes('CONFIRM') && !text.includes('BACK CANCELS'))).toBe(true);
  expect(await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    const hint = route.children.list.find((object: any) => object.name === 'card-picker-input-hint');
    return hint ? {
      text: hint.text,
      fontSize: Number.parseFloat(hint.style?.fontSize ?? '0'),
    } : undefined;
  })).toEqual({
    text: 'Click the selected choice again to confirm   ·   Inspect reads without committing',
    fontSize: 19,
  });
  await page.locator('canvas').screenshot({
    path: '.artifacts/test-results/card-picker-confirmation-preen-1000x560.png',
  });
  await page.keyboard.press('Escape');
  await expect.poll(async () => (
    JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).cardPickerInput?.armed
  )).toBe(false);
  expect(await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return route.runState.deck.filter((card: any) => card.upgraded).length;
  })).toBe(preenStart.upgraded);
  await clickPickerCard(0);
  await clickPickerCard(0);
  await expect(page.getByRole('dialog', { name: 'Choose this bird’s Preen' })).toBeVisible();
  await page.getByRole('button', { name: 'Choose Shelter', exact: true }).click();
  await expect.poll(async () => page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return route.cardPickerRemainingPicks;
  })).toBe(2);
  expect(await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return route.runState.deck.filter((card: any) => card.upgraded).length;
  })).toBe(preenStart.upgraded + 1);

  for (let index = 0; index < 10; index += 1) await page.keyboard.press('ArrowRight');
  const preenFocused = await page.evaluate(() => (
    JSON.parse(window.render_game_to_text?.() ?? '{}').cardPickerInput
  ));
  expect(preenFocused).toMatchObject({ focusIndex: 10, scrollRow: 1, focusVisible: true, armed: true });
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/card-picker-input-preen.png' });

  const preenInspected = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    const before = structuredClone(route.runState.deck);
    const stateBefore = JSON.parse(window.render_game_to_text?.() ?? '{}').cardPickerInput;
    const inspectHits = route.children.list.filter((object: any) => object.name === 'card-picker-card-inspect-hit');
    inspectHits[0].emit(
      'pointerdown',
      {},
      0,
      0,
      { stopPropagation() {} },
    );
    await wait(80);
    return {
      state: JSON.parse(window.render_game_to_text?.() ?? '{}'),
      before,
      after: structuredClone(route.runState.deck),
      modal: route.children.list.some((object: any) => object.name === 'card-picker-inspection-scrim'),
      detail: route.children.list.some((object: any) => object.name === 'card-picker-inspection-title'),
      screenReader: document.getElementById('game-status')?.textContent ?? '',
    };
  });
  expect(preenInspected.state.cardPickerInput).toMatchObject({
    inspectionOpen: true,
    focusIndex: 10,
    returnIndex: 10,
    decisionPreserved: true,
  });
  expect(preenInspected.after).toEqual(preenInspected.before);
  expect(preenInspected.modal).toBe(true);
  expect(preenInspected.detail).toBe(true);
  await expect(page.locator('#game-status')).toContainText('No card has been changed');
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/card-picker-inspection-preen.png' });

  await page.keyboard.press('Enter');
  const preenReturned = await page.evaluate(() => (
    JSON.parse(window.render_game_to_text?.() ?? '{}').cardPickerInput
  ));
  expect(preenReturned).toMatchObject({ inspectionOpen: false, focusIndex: 10, armed: true });

  // Inspection restores the already armed choice; it does not require reselecting.
  const preenArmed = await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return {
      state: JSON.parse(window.render_game_to_text?.() ?? '{}').cardPickerInput,
      upgraded: route.runState.deck.filter((card: any) => card.upgraded).length,
      remaining: route.cardPickerRemainingPicks,
    };
  });
  expect(preenArmed.upgraded).toBe(preenStart.upgraded + 1);
  expect(preenArmed.remaining).toBe(2);
  expect(preenArmed.state).toMatchObject({ inspectionOpen: false, armed: true });

  const armedPreenId = await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return route.runState.deck[route.cardPickerArmedIndex]?.id;
  });
  await page.keyboard.press('Enter');
  if (branchCards.includes(armedPreenId)) {
    await expect(page.getByRole('dialog', { name: 'Choose this bird’s Preen' })).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Choose Shelter', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
  }
  const preenApplied = await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return {
      state: JSON.parse(window.render_game_to_text?.() ?? '{}').cardPickerInput,
      upgraded: route.runState.deck.filter((card: any) => card.upgraded).length,
      remaining: route.cardPickerRemainingPicks,
    };
  });
  expect(preenApplied.upgraded).toBe(preenStart.upgraded + 2);
  expect(preenApplied.remaining).toBe(1);
  expect(preenApplied.state.inspectionOpen).toBe(false);

  await page.keyboard.press('Escape');
  const preenCancelled = await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return {
      pickerMode: route.cardPickerMode,
      nodeChoiceOpen: route.nodeChoiceOpen,
      deck: structuredClone(route.runState.deck),
    };
  });
  expect(preenCancelled.pickerMode).toBeUndefined();
  expect(preenCancelled.nodeChoiceOpen).toBe(true);
  expect(preenCancelled.deck).toEqual(preenStart.deck);

  const releaseOpen = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const game = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    game.scene.stop('MenuScene');
    const route: any = game.scene.getScene('RouteScene');
    route.runState.scrap = 999;
    const market = window.__birdSquadCurrentMap!().nodes.find((candidate: any) => candidate.type === 'market')
      ?? window.__birdSquadCurrentMap!().nodes.find((candidate: any) => candidate.type !== 'boss');
    market.type = 'market';
    route.openMarketNode(market);
    const releaseIndex = route.marketUtilityShelf.findIndex((offer: any) => offer.id === 'release');
    if (releaseIndex < 0) return { missing: true };
    route.openMarketCardPicker(releaseIndex, 'release');
    for (let index = 0; index < 60; index += 1) {
      const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
      if (route.cardHoverDetailModule && state.cardPickerInput?.inspectTargets > 0) break;
      await wait(50);
    }
    const press = (partial: Record<string, boolean>) => {
      const pad = { left: false, right: false, up: false, down: false, A: false, ...partial };
      route.cardHoverDetailModule.updateRouteRewardGamepad(route, pad, route.controllerButtonsDown);
    };
    press({ right: true });
    press({});
    press({ right: true });
    press({});
    const before = {
      deck: structuredClone(route.runState.deck),
      scrap: route.runState.scrap,
      sold: route.marketUtilityShelf[releaseIndex].sold,
    };
    route.input.gamepad.emit('down', route.input.gamepad.pad1, { index: 3 }, 1);
    await wait(80);
    return {
      missing: false,
      releaseIndex,
      before,
      state: JSON.parse(window.render_game_to_text?.() ?? '{}'),
      modal: route.children.list.some((object: any) => object.name === 'card-picker-inspection-scrim'),
      screenReader: document.getElementById('game-status')?.textContent ?? '',
    };
  });
  expect(releaseOpen.missing).toBe(false);
  expect(releaseOpen.state.cardPickerInput).toMatchObject({
    mode: 'release',
    context: 'market',
    focusIndex: 2,
    inspectionOpen: true,
    returnIndex: 2,
  });
  expect(releaseOpen.modal).toBe(true);
  await expect(page.locator('#game-status')).toContainText('no Scrap has been spent');
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/card-picker-inspection-release.png' });

  const releaseClosed = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    route.input.gamepad.emit('down', route.input.gamepad.pad1, { index: 1 }, 1);
    await wait(50);
    return {
      state: JSON.parse(window.render_game_to_text?.() ?? '{}').cardPickerInput,
      deck: structuredClone(route.runState.deck),
      scrap: route.runState.scrap,
    };
  });
  expect(releaseClosed.state).toMatchObject({ inspectionOpen: false, focusIndex: 2, armed: true });
  expect(releaseClosed.deck).toEqual(releaseOpen.before.deck);
  expect(releaseClosed.scrap).toBe(releaseOpen.before.scrap);
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/card-picker-input-release.png' });

  const releaseArmed = await page.evaluate((releaseIndex) => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    const focused = route.cardHoverDetailModule.focusedCardPickerEntry(route);
    // The original controller selection and its confirmation rail remain armed.
    const rail = route.children.list.find((object: any) => object.name === 'card-picker-confirmation-rail');
    const backFrame = route.children.getByName('route-event-cancel-hit');
    const namedText = (name: string) => route.children.list.find((object: any) => object.name === name)?.text;
    const railBounds = rail?.getBounds();
    const backBounds = backFrame?.getBounds();
    return {
      focusedCost: focused.cost,
      state: JSON.parse(window.render_game_to_text?.() ?? '{}').cardPickerInput,
      deck: structuredClone(route.runState.deck),
      scrap: route.runState.scrap,
      sold: route.marketUtilityShelf[releaseIndex]?.sold,
      pickerMode: route.cardPickerMode,
      presentation: {
        railSize: rail ? [rail.displayWidth, rail.displayHeight] : [],
        title: namedText('card-picker-confirmation-title'),
        summary: namedText('card-picker-confirmation-summary'),
        command: namedText('card-picker-confirmation-command'),
        backGap: railBounds && backBounds ? railBounds.left - backBounds.right : -1,
        cardDeltas: route.children.list
          .filter((object: any) => object.name === 'card-picker-decision-delta')
          .map((object: any) => object.text),
      },
    };
  }, releaseOpen.releaseIndex);
  expect(releaseArmed.state).toMatchObject({ armed: true, commitBlockedUntilSelected: false });
  expect(releaseArmed.deck).toEqual(releaseOpen.before.deck);
  expect(releaseArmed.scrap).toBe(releaseOpen.before.scrap);
  expect(releaseArmed.sold).toBe(releaseOpen.before.sold);
  expect(releaseArmed.pickerMode).toBe('release');
  expect(releaseArmed.presentation).toMatchObject({
    railSize: [560, 58],
    command: 'CONFIRM',
  });
  expect(releaseArmed.presentation.title).toMatch(/^RELEASE  /);
  expect(releaseArmed.presentation.summary).toContain(`${releaseArmed.focusedCost} SCRAP`);
  expect(releaseArmed.presentation.backGap).toBeGreaterThanOrEqual(20);
  expect(releaseArmed.presentation.cardDeltas.every((text: string) => !text.includes('CONFIRM') && !text.includes('BACK CANCELS'))).toBe(true);
  await page.locator('canvas').screenshot({
    path: '.artifacts/test-results/card-picker-confirmation-release-1000x560.png',
  });

  await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    route.input.gamepad.emit('down', route.input.gamepad.pad1, { index: 1 }, 1);
  });
  await expect.poll(async () => (
    JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).cardPickerInput?.armed
  )).toBe(false);
  expect(await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return {
      deck: structuredClone(route.runState.deck),
      scrap: route.runState.scrap,
    };
  })).toEqual({ deck: releaseOpen.before.deck, scrap: releaseOpen.before.scrap });

  const releaseApplied = await page.evaluate((releaseIndex) => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    const press = (partial: Record<string, boolean>) => {
      const pad = { left: false, right: false, up: false, down: false, A: false, ...partial };
      route.cardHoverDetailModule.updateRouteRewardGamepad(route, pad, route.controllerButtonsDown);
    };
    press({ A: true });
    press({});
    press({ A: true });
    press({});
    return {
      deck: structuredClone(route.runState.deck),
      scrap: route.runState.scrap,
      sold: route.marketUtilityShelf[releaseIndex]?.sold,
      pickerMode: route.cardPickerMode,
    };
  }, releaseOpen.releaseIndex);
  expect(releaseApplied.deck).toHaveLength(releaseOpen.before.deck.length - 1);
  expect(releaseApplied.scrap).toBe(releaseOpen.before.scrap - releaseArmed.focusedCost);
  expect(releaseApplied.sold).toBe(true);
  expect(releaseApplied.pickerMode).toBeUndefined();
});

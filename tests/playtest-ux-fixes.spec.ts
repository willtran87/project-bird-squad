import { test, expect, type Page } from '@playwright/test';
import manifest from '../assets/runtime/cards/card-art-manifest.json' with { type: 'json' };
import { flockLeaders } from '../src/game/leaders';
import { settleCanvas } from './helpers/settled-canvas';

// Live-playtest regressions (1280x720): card confirmation targets, hidden card
// effects, Start Run leader choice, Cache numbering and contract defaults.

async function titleReady(page: Page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
}

async function battle(page: Page, deck?: string[]) {
  await titleReady(page);
  await page.evaluate(async deck => {
    const w = window as any;
    await w.__birdSquadEnsureScene('RouteScene');
    w.__birdSquadGame.scene.getScene('MenuScene').startRun();
  }, deck);
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.isActive('RouteScene'));
  await page.evaluate(async deck => {
    const w = window as any;
    const runState = { ...structuredClone(w.__birdSquadGame.scene.getScene('RouteScene').runState), seed: 'playtest-ux' };
    if (deck) runState.deck = deck.map(id => ({ id, upgraded: false }));
    await w.__birdSquadEnsureScene('BattleScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry', runState });
  }, deck);
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.hand?.length && b.battleHandRendererModule && b.battleHudRendererModule && b.combatPreviewModule
      && !b.combatAnimationPending && !b.combatIntroActive && !b.battleRenderQueued;
  });
  await settleCanvas(page);
}

const canvasPoint = (page: Page, x: number, y: number) => page.evaluate(([x, y]) => {
  const c = (window as any).__birdSquadGame.canvas.getBoundingClientRect();
  return { x: c.left + x * c.width / 1280, y: c.top + y * c.height / 720 };
}, [x, y] as const);

const selfCard = (page: Page) => page.evaluate(() => {
  const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
  const card = b.hand.find((c: any) => !['enemy', 'choice'].includes(b.activeCardContract(c).target) && b.effectiveCost(c) <= b.energy);
  const r = b.handCardRects.get(card.instanceId).getBounds();
  return { id: card.instanceId, x: r.centerX, art: r.top + 80, rules: r.bottom - 50, played: b.statCardsPlayed };
});

const played = (page: Page) => page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').statCardsPlayed);

test('a selected self-target card confirms from any part of its face', async ({ page }) => {
  for (const half of ['rules', 'art'] as const) {
    await battle(page);
    const card = await selfCard(page);
    const first = await canvasPoint(page, card.x, card.art);
    await page.mouse.click(first.x, first.y);
    await page.waitForFunction(id => (window as any).__birdSquadGame.scene.getScene('BattleScene').selectedInstanceId === id, card.id);
    await settleCanvas(page);
    const second = await canvasPoint(page, card.x, card[half]);
    await page.mouse.click(second.x, second.y);
    await expect.poll(() => played(page)).toBe(card.played + 1);
  }
});

test('CONFIRM TO PLAY is a real control that plays the selection', async ({ page }) => {
  await battle(page);
  const card = await selfCard(page);
  const p = await canvasPoint(page, card.x, card.art);
  await page.mouse.click(p.x, p.y);
  await page.waitForFunction(id => (window as any).__birdSquadGame.scene.getScene('BattleScene').selectedInstanceId === id, card.id);
  await settleCanvas(page);
  const control = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const frame = b.selectionOutcomePreview.getByName('combat-selection-command-frame');
    const label = b.selectionOutcomePreview.getByName('combat-selection-command');
    const r = frame.getBounds();
    return { x: r.centerX, y: r.centerY, interactive: Boolean(frame.input?.enabled), cursor: frame.input?.cursor,
      kind: frame.getData('controlKind'), label: label.text, accessible: frame.getData('accessibleLabel'),
      hitHeight: frame.input?.hitArea?.height };
  });
  expect(control).toMatchObject({ interactive: true, kind: 'primary', label: 'CONFIRM TO PLAY' });
  expect(control.accessible).toContain('Confirm to play');
  expect(control.hitHeight).toBeGreaterThanOrEqual(44);
  // Click the label's lower edge: the touch target is larger than the frame.
  const q = await canvasPoint(page, control.x, control.y + 12);
  await page.mouse.click(q.x, q.y);
  await expect.poll(() => played(page)).toBe(card.played + 1);

  // The keyboard path is unchanged: Tab selects, Enter plays.
  await battle(page);
  const before = await played(page);
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => Boolean((window as any).__birdSquadGame.scene.getScene('BattleScene').selectedInstanceId));
  const target = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.activeCardContract(b.getSelectedCard()).target;
  });
  if (target !== 'choice') {
    await page.keyboard.press('Enter');
    await expect.poll(() => played(page)).toBe(before + 1);
  }
});

test('targeted attack cards still play by selecting then clicking the enemy', async ({ page }) => {
  await battle(page);
  const card = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const card = b.hand.find((c: any) => b.activeCardContract(c).target === 'enemy' && b.effectiveCost(c) <= b.energy);
    const r = b.handCardRects.get(card.instanceId).getBounds();
    const enemy = b.enemyHpBar(b.enemies.find((e: any) => e.hp > 0));
    return { id: card.instanceId, x: r.centerX, y: r.centerY, ex: enemy.x, ey: enemy.y - 19, played: b.statCardsPlayed };
  });
  const p = await canvasPoint(page, card.x, card.y);
  await page.mouse.click(p.x, p.y);
  await page.waitForFunction(id => (window as any).__birdSquadGame.scene.getScene('BattleScene').selectedInstanceId === id, card.id);
  await settleCanvas(page);
  const e = await canvasPoint(page, card.ex, card.ey);
  await page.mouse.click(e.x, e.y);
  await expect.poll(() => played(page)).toBe(card.played + 1);
});

test('starter and reward-pool hand cards show every effect on the face', async ({ page }, info) => {
  test.setTimeout(120000);
  const starter = flockLeaders.flatMap(leader => leader.startingDeckIds);
  const pool = manifest.cards.filter(c => c.status === 'approved').map(c => c.cardId);
  await battle(page, [...new Set([...starter, ...pool])]);
  const failures = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const cards = b.uxFixtureCards = b.allDeckCards();
    const issues: any[] = [];
    for (const upgraded of [false, true]) for (let start = 0; start < cards.length; start += 5) {
      b.hand = cards.slice(start, start + 5); b.hand.forEach((c: any) => c.upgraded = upgraded);
      b.selectedInstanceId = undefined; b.handRenderKey = ''; b.renderHand();
      const named = (name: string) => b.handLayer.list.filter((o: any) => o.name === name);
      b.hand.forEach((card: any, i: number) => {
        const rules = named('combat-card-readable-summary')[i];
        const panel = named('combat-card-rules-panel')[i].getBounds(), r = rules.getBounds();
        const clauses = rules.getData('readableRules').split('\n').length;
        if (rules.getData('truncated') || /more · Inspect|Inspect full rules/.test(rules.text)
          || r.bottom > panel.bottom + 0.5 || r.top < panel.top - 0.5 || parseFloat(rules.style.fontSize) < 15
          || clauses !== b.activeCardContract(card).effects.length) issues.push({ id: card.id, upgraded, text: rules.text });
      });
    }
    return issues;
  });
  expect(failures).toEqual([]);
  // Locked Nest: every clause, including the deferred draw, is on the face.
  await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const all = b.uxFixtureCards;
    b.hand = ['pentacles_04', 'aviary_35', 'swords_08', 'major_21', 'wands_fledgling'].map(id => all.find((c: any) => c.id === id));
    b.handPage = 0;
    b.hand.forEach((c: any) => c.upgraded = false); b.handRenderKey = ''; b.renderHand();
  });
  const nest = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const i = b.hand.findIndex((c: any) => c.id === 'pentacles_04');
    return b.handLayer.list.filter((o: any) => o.name === 'combat-card-readable-summary')[i].text;
  });
  expect(nest.replace(/\s+/g, ' ')).toMatch(/Gain 6 Cover\. Retain 1 card\. Draw 1 next turn/);
  await settleCanvas(page);
  await page.screenshot({ path: info.outputPath('dense-hand-1280.png') });
});

test('reward choices show every rule on the face with a larger portrait', async ({ page }, info) => {
  await battle(page, [...flockLeaders[0].startingDeckIds, 'pentacles_04', 'aviary_35', 'swords_08']);
  await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.mode = 'cardReward';
    const all = b.allDeckCards();
    b.rewardChoices = ['pentacles_04', 'aviary_35', 'swords_08'].map(id => all.find((c: any) => c.id === id));
    b.controllerChoiceIndex = 0; b.rewardChoiceArmedId = undefined; b.rewardSkipArmed = false; b.battleInputActive = true;
    b.renderAll();
  });
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').rewardPresentationReady());
  const faces = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.rewardChoices.map((card: any) => {
      const get = (name: string) => b.root.list.find((o: any) => o.name === name && o.getData('cardId') === card.id);
      const effect = get('reward-card-effect'), slot = get('reward-card-art-slot'), take = get('reward-card-take-hit');
      const trade = get('reward-main-tradeoff');
      return { id: card.id, text: effect.text, readable: effect.getData('readableRules'),
        sentences: card.text.split(/(?<=[.!])\s+(?=[A-Z+])/).length, lines: effect.text.split('\n').length,
        clipped: /\.\.\.$|…$|Inspect/.test(effect.text), font: parseFloat(effect.style.fontSize),
        art: { w: slot.width, h: slot.height }, clear: trade.getBounds().bottom <= take.getBounds().top + 1 };
    });
  });
  for (const face of faces) {
    expect(face.clipped, face.id).toBe(false);
    expect(face.readable.split('\n').length, face.id).toBe(face.sentences);
    expect(face.lines, face.id).toBeGreaterThan(0);
    expect(face.font, face.id).toBeGreaterThanOrEqual(15);
    expect(face.art.w * face.art.h).toBeGreaterThan(60 * 90);
    expect(face.clear, face.id).toBe(true);
  }
  expect(faces[0].text.replace(/\s+/g, ' ')).toMatch(/Retain 1 card\. Draw 1 next turn/);
  await settleCanvas(page);
  await page.screenshot({ path: info.outputPath('reward-faces-1280.png') });
});

test('Start Run presents the leader choice first, and a second confirm flies', async ({ page }, info) => {
  await titleReady(page);
  await settleCanvas(page);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').setupOpen === true);
  const menu = await page.evaluate(() => {
    const m = (window as any).__birdSquadGame.scene.getScene('MenuScene');
    return { focus: m.menuFocus, route: (window as any).__birdSquadGame.scene.isActive('RouteScene'),
      leaders: m.children.list.filter((o: any) => o.name === 'title-leader-choice-backplate' && o.visible).length };
  });
  expect(menu).toEqual({ focus: 'primaryRun', route: false, leaders: flockLeaders.length });
  await page.screenshot({ path: info.outputPath('start-run-leader-choice.png') });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.isActive('RouteScene'));
});

test('a returning player with one unlocked leader launches directly', async ({ page }) => {
  await titleReady(page);
  await page.evaluate(() => {
    const m = (window as any).__birdSquadGame.scene.getScene('MenuScene');
    m.menuAccount = { ...m.menuAccount, runs: 3, unlockedLeaders: ['fledgling'] };
  });
  await settleCanvas(page);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.isActive('RouteScene'));
});

test('Cache confirm names the drawer number the player picked', async ({ page }) => {
  await titleReady(page);
  const seed = await page.evaluate(async deckIds => {
    const w = window as any;
    const [blueprints, generate, hash] = w.__routeAudit;
    for (let i = 0; i < 100; i++) {
      const seed = `cache-number-${i}`;
      if (!generate(blueprints[0], hash(seed, 0)).nodes.some((n: any) => n.type === 'cache')) continue;
      await w.__birdSquadEnsureScene('RouteScene');
      for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
      w.__birdSquadGame.scene.start('RouteScene', { runState: { seed, deck: deckIds.map((id: string) => ({ id })),
        leaderId: 'fledgling', currentHp: 38, scrap: 40, completedRouteNodeIds: [], routeLog: [] } });
      return seed;
    }
    throw new Error('No cache fixture');
  }, flockLeaders[0].startingDeckIds);
  await page.waitForFunction(seed => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return r.runState.seed === seed && r.routeEssentialAssetsReady;
  }, seed);
  const picked = await page.evaluate(() => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
    r.openNodeChoices(w.__birdSquadCurrentMap().nodes.find((n: any) => n.type === 'cache'));
    const choices = r.eventChoices();
    const index = choices.findIndex((c: any) => c.key === 'cache_supply');
    return { index, key: choices[index].key };
  });
  expect(picked.index).toBe(1);
  await settleCanvas(page);
  const point = await page.evaluate(key => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const tile = r.children.list.find((o: any) => o.name === 'route-choice-option-frame' && o.getData('choiceKey') === key);
    const b = tile.getBounds(), c = r.game.canvas.getBoundingClientRect();
    return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720 };
  }, picked.key);
  await page.mouse.click(point.x, point.y, { delay: 40 });
  await page.waitForFunction(() => Boolean((window as any).__birdSquadGame.scene.getScene('RouteScene').pendingRouteReward));
  const text = await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return { pending: r.pendingRouteReward.choiceText, shown: r.children.getByName('route-decision-choice')?.getData('fullText') ?? r.children.getByName('route-decision-choice')?.text };
  });
  expect(text.pending).toMatch(/^Claim Drawer 02\b/);
  expect(text.shown).toMatch(/Drawer 02\b/);
});

test('district contract does not pre-select Lean Route right after a claimed card reward', async ({ page }) => {
  await titleReady(page);
  const seed = await page.evaluate(async () => {
    const w = window as any, hash = w.__routeAudit[2];
    for (let i = 0; i < 400; i++) {
      const seed = `lean-default-${i}`;
      if (hash(`${seed}:0:contract-offer`, 0) % 4 === 3) return seed;
    }
    throw new Error('No Lean Route-first seed');
  });
  for (const skipped of [false, true]) {
    await page.evaluate(async ({ seed, skipped, deckIds }) => {
      const w = window as any;
      await w.__birdSquadEnsureScene('RouteScene');
      for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
      w.__birdSquadGame.scene.start('RouteScene', { runState: { seed, deck: deckIds.map((id: string) => ({ id })),
        leaderId: 'fledgling', currentHp: 38, scrap: 40, completedRouteNodeIds: ['m1_entry'], routeLog: [],
        combatResults: [{ encounterId: 'opening', nodeId: 'm1_entry', nodeType: 'street', enemyIds: [], turnsTaken: 1,
          damageDealt: 1, cohesionLost: 0, decisionStats: {} }],
        rewardEvents: [{ offered: ['pentacles_04', 'swords_08', 'wands_ace'], picked: skipped ? undefined : 'pentacles_04', skipped }] } });
    }, { seed, skipped, deckIds: flockLeaders[0].startingDeckIds });
    await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).districtContractChoice?.open);
    const choice = await page.evaluate(() => JSON.parse((window as any).render_game_to_text()).districtContractChoice);
    expect(choice.options[0].id).toBe('lean_route');
    if (skipped) expect(choice.focusIndex).toBe(0);
    else expect(choice.options[choice.focusIndex].id).not.toBe('lean_route');
  }
});

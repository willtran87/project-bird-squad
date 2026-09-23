import { test, expect } from '@playwright/test';
import { KEYWORDS, decisionCardKeywordSections, itemKeywordSections } from '../src/game/keyword-definitions';
import { settleCanvas } from './helpers/settled-canvas';

test.use({ hasTouch: true });

test('decision terms include displayed variants and costs, exclude identity and advice, and deduplicate', () => {
  const sections = decisionCardKeywordSections([
    { title: 'NOW', text: 'Gain 2 Open Sky Guard. Gain 4 Cover. Cover.' },
    { title: 'PREEN', text: 'Apply 2 Winded.' },
    { title: 'PREENED RULES', text: 'Gain Cover.' },
    { title: 'MOLT · PREEN', text: 'Winded Burst. Gain 2 Wingbeats.' },
    { title: 'PASSIVE FLOCK BONUSES', text: 'Regen +1' },
    { title: 'CARD DETAILS', text: 'Hold / Scatter / Energy' },
    { title: 'BUILD READ', text: 'Resonance Burst may be useful.' },
    { title: 'COMPLETE OUTCOME', text: 'Draw 2.' },
  ]);
  expect(sections.map(s => s.title)).toEqual(['OPEN SKY GUARD', 'COVER', 'WINDED', 'WINDED BURST', 'WINGBEAT', 'REGEN', 'MOLT'].map(s => `TERM · ${s}`));
  expect(sections[0].text).toBe(KEYWORDS['Open Sky Guard'].def);
  expect(decisionCardKeywordSections([{ title: 'PREENED RULES', text: 'Apply Winded.' }])[0].title).toBe('TERM · WINDED');
  expect(decisionCardKeywordSections([{ title: 'NOW', text: 'No special terms.' }])).toEqual([{ title: 'TERM · WINGBEAT', text: KEYWORDS.Wingbeat.def }]);
});

test('item terms use only authored effect, trigger, use, and rules copy', () => {
  const sections = itemKeywordSections([
    { title: 'EFFECT', text: 'Gain 3 Cover and 1 Open Sky Guard.' },
    { title: 'TRIGGER', text: 'After spending Wingbeat.' },
    { title: 'RULES', text: 'Draw 1, then Retain 1.' },
    { title: 'ITEM DETAILS', text: 'Molt / Winded' },
    { title: 'BUILD READ', text: 'Resonance.' },
  ]);
  expect(sections.map(section => section.title)).toEqual([
    'TERM · COVER', 'TERM · OPEN SKY GUARD', 'TERM · WINGBEAT', 'TERM · DRAW', 'TERM · RETAIN',
  ]);
  expect(sections.map(section => section.text)).toEqual([
    KEYWORDS.Cover.def, KEYWORDS['Open Sky Guard'].def, KEYWORDS.Wingbeat.def, KEYWORDS.Draw.def, KEYWORDS.Retain.def,
  ]);
});

type Mode = 'deck' | 'market' | 'preen' | 'release' | 'reward' | 'combatReward' | 'combatPreen';
for (const mode of ['deck', 'market', 'preen', 'release', 'reward', 'combatReward', 'combatPreen'] as Mode[]) {
  test(`${mode} explains card terms in place without committing the decision`, async ({ page }, info) => {
    const combat = mode.startsWith('combat'), key = combat ? 'BattleScene' : 'RouteScene';
    const remapped = mode === 'preen' || mode === 'combatPreen';
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(remapped => {
      localStorage.setItem('birdsquad.screenReader', 'on');
      if (remapped) localStorage.setItem('birdsquad.controlBindings', JSON.stringify({ version: 1,
        bindings: { previous: 'KeyJ', next: 'KeyL', roost: 'KeyG', back: 'KeyB' } }));
    }, remapped);
    await page.setViewportSize({ width: 2560, height: 1600 }); await page.goto('./');
    await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
    await page.evaluate(async key => {
      const w = window as any; await w.__birdSquadEnsureScene(key);
      for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
      w.__birdSquadGame.scene.start(key, key === 'BattleScene' ? { routeNodeId: 'm1_entry' } : {});
    }, key);
    await page.waitForFunction(key => {
      const s = (window as any).__birdSquadGame.scene.getScene(key);
      return key === 'RouteScene' ? s.routeEssentialAssetsReady && s.cardHoverDetailModule : s.battleHandRendererModule && !s.combatInteractionLocked();
    }, key);
    await page.evaluate(({ key, mode }) => {
      const w = window as any, s = w.__birdSquadGame.scene.getScene(key);
      if (mode === 'deck') s.openDeckOverlay();
      else if (mode === 'reward') {
        s.openRouteRewardMenu({ id: 'terms-cache', type: 'cache', label: 'Cache', payloadId: 'terms-cache' },
          { key: 'terms', text: 'Review the cards.', effects: ['addCard(chooseOneOfTwoUncommonOrRare)'], locked: false }, structuredClone(s.runState));
        s.cycleRouteRewardChoice(1);
      } else if (mode.startsWith('combat')) {
        const cards = s.allDeckCards().filter((c: any) => !c.upgraded && c.cost > 0).slice(0, 3);
        s.mode = mode === 'combatPreen' ? 'upgradeReward' : 'cardReward';
        s.rewardChoices = cards; s.upgradeChoices = cards; s.controllerChoiceIndex = 1;
        s.rewardChoiceArmedId = cards[1].id; s.battleInputActive = true; s.renderAll();
      } else {
        const node = w.__birdSquadCurrentMap().nodes.find((n: any) => n.type !== 'boss');
        s.runState.scrap = 999; s.openMarketNode({ ...node, type: 'market' });
        if (mode !== 'market') {
          s.cardPickerMode = mode; s.cardPickerContext = 'market'; s.cardPickerFocusIndex = 1;
          s.cardPickerArmedIndex = s.pickerEligibleCards(mode)[1].index; s.renderAll();
        }
      }
    }, { key, mode });
    if (combat) await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').rewardPresentationReady());
    if (mode === 'reward') await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').routeRewardOverlayModule);
    if (!['deck', 'market'].includes(mode)) await page.keyboard.press(remapped ? 'g' : 'r');
    await page.waitForFunction(({ key, mode }) => {
      const s = (window as any).__birdSquadGame.scene.getScene(key);
      return mode === 'deck' ? s.children.getByName('deck-review-detail-panel') : mode.startsWith('combat') ? s.cardPreview?.getData('reading')
        : s.hoverCardDetail?.getByName(mode === 'market' ? 'market-fixed-card-inspector' : 'route-inspection-reader');
    }, { key, mode });
    // Persist selectors in the test page only; application state is untouched.
    await page.evaluate(({ key, mode }) => {
      const w = window as any;
      w.__termPanel = () => {
        const s = w.__birdSquadGame.scene.getScene(key);
        return mode === 'deck' ? s.children.getByName('deck-review-detail-panel') : mode.startsWith('combat') ? s.cardPreview
          : s.hoverCardDetail.getByName(mode === 'market' ? 'market-fixed-card-inspector' : 'route-inspection-reader');
      };
      w.__turnTerm = (delta: number) => w.__termPanel().getData(mode === 'deck' ? 'changePage' : 'turnRulesPage')(delta);
    }, { key, mode });
    const stable = () => page.evaluate(key => {
      const s = (window as any).__birdSquadGame.scene.getScene(key);
      return JSON.stringify({ run: s.runState, deck: s.deck, draw: s.drawPile, discard: s.discardPile,
        hand: s.hand, flock: s.flock, enemies: s.enemies, energy: s.energy, turn: s.turn,
        picker: s.cardPickerArmedIndex, pickerFocus: s.cardPickerFocusIndex, selected: s.inspectedCardId,
        reward: s.routeRewardArmedCardId ?? s.rewardChoiceArmedId, rewardIndex: s.routeRewardChoiceIndex ?? s.controllerChoiceIndex,
        purchase: s.marketFocusArmedId, shelf: s.marketCardShelf, scrap: s.scrap });
    }, key);
    const before = await stable();
    const pages = await page.evaluate(() => {
      const w = window as any, result: any[] = [], total = w.__termPanel().getData('reading').total;
      w.__turnTerm(-(w.__termPanel().getData('reading').page - 1));
      for (let i = 0; i < total; i++) { result.push({ ...w.__termPanel().getData('reading') }); if (i < total - 1) w.__turnTerm(1); }
      w.__turnTerm(-(total - 1)); return result;
    });
    const terms = [...new Set<string>(pages.filter(p => p.title.startsWith('TERM · ')).map(p => p.title))];
    expect(terms).toContain('TERM · WINGBEAT');
    for (const term of terms) {
      const definition = Object.entries(KEYWORDS).find(([key]) => term === `TERM · ${key.toUpperCase()}`)![1].def;
      expect(pages.filter(p => p.title === term).map(p => p.text).join(' ').replace(/\s+/g, ' ')).toBe(definition);
    }
    const firstTerm = pages.findIndex(p => p.title === 'TERM · WINGBEAT');
    const nextKey = mode === 'deck' ? 'PageDown' : mode === 'market' ? 'r' : remapped ? 'l' : 'ArrowRight';
    for (let i = 0; i < firstTerm; i++) await page.keyboard.press(nextKey);
    await settleCanvas(page);
    const reading = () => page.evaluate(() => (window as any).__termPanel().getData('reading'));
    expect((await reading()).title).toBe('TERM · WINGBEAT');
    await expect.poll(() => page.locator('#game-status').textContent()).toContain('TERM · WINGBEAT');
    for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
      await page.setViewportSize(viewport); await settleCanvas(page);
      const geometry = await page.evaluate(({ key, mode }) => {
        const s = (window as any).__birdSquadGame.scene.getScene(key), panel = (window as any).__termPanel();
        const owner = mode === 'deck' ? s.children : panel;
        const prefix = mode === 'deck' ? 'deck-review-detail' : mode === 'market' ? 'market-rules' : 'route-inspection-reader';
        const body = owner.getByName(`${prefix}-body`), next = owner.getByName(`${prefix}-next`);
        const bottom = mode === 'deck' ? 528 : mode === 'market' ? 530 : 518;
        const scale = s.game.canvas.getBoundingClientRect().height / 720;
        return { font: body.style.fontSize, resolution: body.style.resolution, contained: body.getBounds().bottom <= bottom,
          touch: next.width * scale >= 44 && next.height * scale >= 44 };
      }, { key, mode });
      expect(geometry).toEqual({ font: '22px', resolution: 2, contained: true, touch: true });
      await page.screenshot({ path: info.outputPath(`terms-${viewport.width}.png`) });
    }
    const current = await reading();
    const prefix = mode === 'deck' ? 'deck-review-detail' : mode === 'market' ? 'market-rules' : 'route-inspection-reader';
    const point = await page.evaluate(({ key, mode, prefix }) => {
      const s = (window as any).__birdSquadGame.scene.getScene(key), owner = mode === 'deck' ? s.children : (window as any).__termPanel();
      const b = owner.getByName(`${prefix}-previous`).getBounds(), c = s.game.canvas.getBoundingClientRect();
      return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720 };
    }, { key, mode, prefix });
    await page.touchscreen.tap(point.x, point.y); await settleCanvas(page);
    expect((await reading()).page).toBe(current.page - 1);
    await page.keyboard.press(nextKey); await settleCanvas(page); expect(await reading()).toEqual(current);
    await page.evaluate(key => (window as any).__birdSquadGame.scene.getScene(key).renderAll(), key);
    await settleCanvas(page); expect(await reading()).toEqual(current); expect(await stable()).toBe(before);
    await page.keyboard.press(remapped ? 'b' : 'Escape'); await settleCanvas(page);
    if (mode === 'market') {
      // This reader is part of the Market, not a dismissible overlay. Back
      // legitimately settles the visit, but must not purchase its focused card.
      const initial = JSON.parse(before), after = JSON.parse(await stable());
      expect(after).toEqual({ ...initial, shelf: [], run: { ...initial.run,
        completedRouteNodeIds: [...initial.run.completedRouteNodeIds, initial.run.currentRouteNodeId],
        routeLog: [...initial.run.routeLog, expect.stringMatching(/market business settled\.$/)],
      } });
    } else expect(await stable()).toBe(before);
    expect(errors).toEqual([]);
  });
}

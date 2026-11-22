import { test, expect, type Page } from '@playwright/test';

// Presentation polish: the card reward reveal, tarot marks, world icons on
// the route, the delayed loading card, combat barks and the confirm sound.
// Everything here is layered presentation: logical layout, hit areas and the
// intentional-selection rules must read the same with or without it.

type Storage = Record<string, string>;
test.describe.configure({ timeout: 300_000 });

async function frames(page: Page, count = 3) {
  const start = await page.evaluate(() => (window as any).__birdSquadGame.loop.frame);
  await page.waitForFunction(({ start, count }) => (window as any).__birdSquadGame.loop.frame >= start + count, { start, count });
}

async function openTitle(page: Page, storage: Storage = {}) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript((values) => {
    if (sessionStorage.getItem('presentation-seeded')) return;
    sessionStorage.setItem('presentation-seeded', '1');
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value as string);
  }, storage);
  await page.goto('./?flight=presentation-polish');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready, null, { timeout: 120_000 });
  await page.waitForFunction(() => typeof (window as any).__birdSquadLife === 'function', null, { timeout: 60_000 });
  return errors;
}

async function openBattle(page: Page, storage: Storage = {}, routeNodeId = 'm1_entry') {
  const errors = await openTitle(page, storage);
  await page.evaluate(async (routeNodeId) => {
    const w = window as any; await w.__birdSquadEnsureScene('BattleScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId });
  }, routeNodeId);
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.battleHandRendererModule && b.hand.length && !b.combatIntroActive && !b.combatAnimationPending;
  }, null, { timeout: 120_000 });
  return errors;
}

async function openCardReward(page: Page) {
  await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.rewardChoices = b.createRewardChoices(); b.mode = 'cardReward'; b.controllerChoiceIndex = 0; b.battleInputActive = true; b.renderAll();
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.battleRewardRendererModule && b.root.list.some((o: any) => o.name === 'reward-card-take-hit');
  }, null, { timeout: 60_000 });
  await frames(page);
}

const rewardLayout = (page: Page) => page.evaluate(() => {
  const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
  const named = (name: string) => b.root.list.filter((o: any) => o.name === name).map((o: any) => {
    const r = o.getBounds();
    return { bounds: [r.x, r.y, r.width, r.height].map(Math.round), alpha: o.alpha, visible: o.visible, input: Boolean(o.input?.enabled), scaleX: o.scaleX };
  });
  return { cards: named('reward-choice-card-hit'), takes: named('reward-card-take-hit'), names: named('reward-card-name') };
});

const reveal = (page: Page, scene = 'BattleScene') => page.evaluate(key => (window as any).__birdSquadLife(key).rewardReveal, scene);

test('combat card rewards are dealt face down and turn over in order without moving the layout', async ({ page }) => {
  const errors = await openBattle(page);
  await openCardReward(page);
  const during = await rewardLayout(page);
  const start = await reveal(page);
  expect(start).toMatchObject({ mode: 'full', cards: 3, skipped: false, live: true, backs: 3 });
  // The last card is still face down a few frames in (it turns ~0.8 s after the deal).
  expect(start.faces[2]).toBe('down');
  // Turned in sequence: the first card is open before the last.
  let mid: any;
  for (let step = 0; step < 40; step += 1) {
    await page.evaluate(() => (window as any).advanceTime(40));
    mid = await reveal(page);
    if (mid.faces[0] === 'shown' && mid.faces[2] === 'down') break;
  }
  expect(mid.faces[0]).toBe('shown');
  expect(mid.faces[2]).toBe('down');
  await page.evaluate(() => (window as any).advanceTime(2000));
  await frames(page);
  const after = await reveal(page);
  expect(after).toMatchObject({ live: false });
  expect(after.faces).toEqual(['shown', 'shown', 'shown']);
  // Presentation only: bounds, alpha, scale and input are final from the first frame.
  expect(await rewardLayout(page)).toEqual(during);
  const backs = await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').root.list
    .filter((o: any) => o.name === 'reward-reveal-back' && o.active).length);
  expect(backs).toBe(0);
  expect(errors).toEqual([]);
});

test('any input skips the reveal and a first click still only arms the reward', async ({ page }) => {
  await openBattle(page);
  await openCardReward(page);
  const center = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const card = b.root.list.find((o: any) => o.name === 'reward-choice-card-hit');
    const canvas = b.game.canvas.getBoundingClientRect();
    return { x: canvas.left + card.x * canvas.width / 1280, y: canvas.top + card.y * canvas.height / 720, deck: b.allDeckCards().length };
  });
  expect((await reveal(page)).live).toBe(true);
  await page.mouse.click(center.x, center.y);
  await frames(page);
  const state = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return { mode: b.mode, armed: b.rewardChoiceArmedId, deck: b.allDeckCards().length };
  });
  const skipped = await reveal(page);
  expect(skipped).toMatchObject({ skipped: true, live: false, backs: 0 });
  expect(skipped.faces).toEqual(['shown', 'shown', 'shown']);
  // The click armed the choice (intentional selection), it did not claim it.
  expect(state.mode).toBe('cardReward');
  expect(state.armed).toBeTruthy();
  expect(state.deck).toBe(center.deck);
});

test('reward faces carry the tarot numeral and suit sigil', async ({ page }) => {
  await openBattle(page);
  await openCardReward(page);
  const marks = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const ids = b.rewardChoices.map((c: any) => c.id);
    return { ids, marks: b.root.list.filter((o: any) => o.name === 'reward-card-tarot-mark').map((o: any) => {
      const r = o.getBounds(); const art = b.root.list.find((a: any) => a.name === 'reward-card-art-slot' && a.getData('cardId') === o.getData('cardId'))?.getBounds();
      return { cardId: o.getData('cardId'), numeral: o.getData('numeral'), suit: o.getData('suit'), h: r.height,
        insideArt: Boolean(art && r.left >= art.left - 1 && r.right <= art.right + 1 && r.top >= art.top - 1 && r.bottom <= art.bottom + 1) };
    }) };
  });
  const tarotIds = marks.ids.filter((id: string) => /^(major|aviary|wands|cups|swords|pentacles)_/.test(id));
  expect(marks.marks.map((m: any) => m.cardId).sort()).toEqual([...tarotIds].sort());
  for (const mark of marks.marks) {
    expect(mark.numeral).toMatch(/^(0|[IVXL]+)$/);
    expect(['plumes', 'basins', 'quills', 'nests', 'major']).toContain(mark.suit);
    expect(mark.insideArt).toBe(true);
  }
});

test('Reduced Motion fades the rewards in; Lean graphics shows them at once', async ({ page }) => {
  await openBattle(page, { 'birdsquad.motionPreference': 'reduced' });
  await openCardReward(page);
  const reduced = await reveal(page);
  expect(reduced).toMatchObject({ mode: 'reduced', backs: 0 });
  await page.evaluate(() => (window as any).advanceTime(800));
  expect((await reveal(page)).live).toBe(false);

  const lean = await page.context().newPage();
  await openBattle(lean, { 'birdsquad.graphicsQuality': 'lean' });
  await openCardReward(lean);
  expect(await reveal(lean)).toBeUndefined();
  await lean.close();
});

async function openRoute(page: Page, storage: Storage = {}) {
  const errors = await openTitle(page, storage);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene')?.routeEssentialAssetsReady, null, { timeout: 120_000 });
  await page.evaluate(() => {
    const w = window as any, route = w.__birdSquadGame.scene.getScene('RouteScene');
    route.scene.restart({ runState: { ...route.runState, mapIndex: 0, seed: 'alpha', completedRouteNodeIds: [], currentRouteNodeId: undefined } });
  });
  await frames(page, 4);
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene')?.routeEssentialAssetsReady, null, { timeout: 60_000 });
  await page.evaluate(() => {
    const w = window as any, route = w.__birdSquadGame.scene.getScene('RouteScene');
    const entry = w.__birdSquadCurrentMap().entryNodeId;
    route.scene.restart({ runState: { ...route.runState, completedRouteNodeIds: [entry], currentRouteNodeId: entry } });
  });
  await frames(page, 4);
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene')?.routeEssentialAssetsReady, null, { timeout: 60_000 });
  await page.evaluate(() => { const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); r.events.emit('spectacle-skip-arrival'); (window as any).advanceTime(400); });
  await frames(page);
  return errors;
}

test('route nodes and the legend carry world icons readable at 1000x560', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 560 });
  const errors = await openRoute(page);
  const read = await page.evaluate(() => {
    const w = window as any, route = w.__birdSquadGame.scene.getScene('RouteScene');
    const scale = route.game.canvas.getBoundingClientRect().width / 1280;
    const named = (name: string) => route.children.list.filter((c: any) => c.name === name);
    const nodes = w.__birdSquadCurrentMap().nodes;
    return {
      scale, nodes: nodes.length, types: [...new Set(nodes.map((n: any) => n.type))].sort(),
      glyphs: named('route-node-glyph').map((g: any) => ({ id: g.getData('routeNodeId'), type: g.getData('routeNodeType'), size: g.displayWidth, key: g.texture.key })),
      legend: named('route-legend-icon').map((g: any) => ({ type: g.getData('routeNodeType'), size: g.displayWidth, key: g.texture?.key })),
      hits: named('route-node-hit').map((h: any) => ({ id: h.getData('routeNodeId'), x: h.x, y: h.y, r: h.input.hitArea.radius })),
    };
  });
  expect(read.glyphs).toHaveLength(read.nodes);
  for (const glyph of read.glyphs) {
    expect(glyph.key).toBe(`world-glyph-${glyph.type}-${glyph.size}`);
    // At least 18 CSS pixels across at the smallest supported window.
    expect(glyph.size * read.scale).toBeGreaterThanOrEqual(18);
  }
  expect(read.legend.map((l: any) => l.type).sort()).toEqual(read.types);
  for (const icon of read.legend) {
    expect(icon.key).toMatch(/^world-glyph-/);
    expect(icon.size * read.scale).toBeGreaterThanOrEqual(20);
  }
  // Every node keeps its own circular hit area; the sign adds no input.
  expect(read.hits).toHaveLength(read.nodes);
  expect(errors).toEqual([]);
});

test('route card rewards reveal, carry tarot marks and still need a deliberate confirm', async ({ page }) => {
  await openRoute(page);
  await page.evaluate(async () => {
    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const route = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const node = { id: 'presentation_cache', type: 'cache', label: 'Presentation Cache', payloadId: 'presentation_cache' };
    const choice = { key: 'choose_reward', text: 'Review the drawer.', effects: ['addCard(chooseOneOfTwoUncommonOrRare)'], locked: false };
    route.openRouteRewardMenu(node, choice, structuredClone(route.runState));
    for (let i = 0; i < 120 && !route.routeRewardOverlayModule; i += 1) await wait(50);
    route.renderAll();
  });
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.list.some((c: any) => c.name === 'route-reward-card-hit'));
  await frames(page);
  const state = await reveal(page, 'RouteScene');
  expect(state).toMatchObject({ mode: 'full', cards: 2, live: true });
  const read = await page.evaluate(() => {
    const route = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return {
      marks: route.children.list.filter((c: any) => c.name === 'route-reward-tarot-mark').map((c: any) => c.getData('numeral')),
      choices: route.routeCardRewardChoices.map((c: any) => c.id),
      panel: Boolean(route.children.getByName('route-reward-panel-frame')),
    };
  });
  expect(read.panel).toBe(true);
  expect(read.marks.length).toBe(read.choices.filter((id: string) => !/^(tangled|wet|bad|loose|static|bent|glass|jammed)/.test(id)).length);
  // A key skips the reveal; the first Enter arms, it does not claim.
  const deck = await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').runState.deck.length);
  await page.keyboard.press('Enter');
  await frames(page);
  const after = await page.evaluate(() => {
    const route = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return { armed: route.routeRewardArmedCardId, pending: Boolean(route.pendingRouteReward), deck: route.runState.deck.length };
  });
  expect((await reveal(page, 'RouteScene')).skipped).toBe(true);
  expect(after.pending).toBe(true);
  expect(after.deck).toBe(deck);
});

test('the Codex dossier shows the tarot mark beside its kicker', async ({ page }) => {
  await openTitle(page);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene?.('CodexScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('CodexScene');
  });
  await page.waitForFunction(() => typeof (window as any).__birdSquadGame.scene.getScene('CodexScene')?.openCodexDetail === 'function'
    && (window as any).__birdSquadGame.scene.getScene('CodexScene').sys.isActive(), null, { timeout: 60_000 });
  await frames(page, 6);
  const marks = await page.evaluate(() => {
    const codex = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    return ['major_13', 'pentacles_elder', 'wands_ace', 'aviary_43'].map((id) => {
      codex.openCodexDetail(id);
      const mark = codex.root.list.find((o: any) => o.name === 'codex-card-detail-tarot-mark');
      const label = codex.root.list.find((o: any) => o.name === 'codex-card-detail-dossier')?.getBounds();
      const kicker = codex.root.list.find((o: any) => o.name === 'codex-card-detail-kicker')?.getBounds();
      const b = mark?.getBounds();
      return { id, numeral: mark?.getData('numeral'), suit: mark?.getData('suit'),
        clear: Boolean(b && label && kicker && b.left >= label.right && b.right < kicker.left) };
    });
  });
  expect(marks).toEqual([
    { id: 'major_13', numeral: 'XIII', suit: 'major', clear: true },
    { id: 'pentacles_elder', numeral: 'XIV', suit: 'nests', clear: true },
    { id: 'wands_ace', numeral: 'I', suit: 'plumes', clear: true },
    { id: 'aviary_43', numeral: 'XLIII', suit: 'major', clear: true },
  ]);
});

test('a slow district load shows the flock loading card only after 250 ms', async ({ page }) => {
  await openRoute(page);
  await page.evaluate(() => {
    const route = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    route.routeEssentialAssetsReady = false; route.renderAll();
  });
  await frames(page, 2);
  const early = await page.evaluate(() => ({
    life: (window as any).__birdSquadLife('RouteScene').loading,
    texts: (window as any).__birdSquadGame.scene.getScene('RouteScene').children.list.map((c: any) => c.text).filter(Boolean),
  }));
  // The readiness screen is still there logically, but no loading card yet.
  expect(early.texts).toContain('Charting the route...');
  if (early.life.elapsed < 250) expect(early.life.shown).toBe(false);
  await page.waitForTimeout(450);
  await frames(page, 2);
  const late = await page.evaluate(() => {
    const route = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const card = route.children.getByName('scene-loading');
    const title = card?.list.find((o: any) => o.name === 'scene-loading-title');
    return { life: (window as any).__birdSquadLife('RouteScene').loading, title: title?.text, birds: card?.list.filter((o: any) => o.type === 'Image').length };
  });
  expect(late.life).toMatchObject({ shown: true, birds: 5 });
  expect(late.title).toBe('Charting the route...');
  await page.evaluate(() => {
    const route = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    route.routeEssentialAssetsReady = true; route.renderAll();
  });
  await frames(page, 2);
  expect(await page.evaluate(() => (window as any).__birdSquadLife('RouteScene').loading)).toBeUndefined();
  expect(await page.evaluate(() => Boolean((window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('scene-loading')))).toBe(false);
});

const barks = (page: Page) => page.evaluate(() => (window as any).__birdSquadBarks('BattleScene'));

/** HUD and enemy panels a bark must never cover, read from their own names. */
const furniture = (page: Page) => page.evaluate(() => {
  const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
  const out: any[] = [];
  const visit = (o: any, depth: number) => {
    if (o.name === 'combat-bark') return;
    if (o.list && depth < 5) o.list.forEach((c: any) => visit(c, depth + 1));
    if (!o.visible || !o.getBounds || o.list) return;
    if (/^(hud-|combat-enemy-(move|phase|outcome|beat|acceleration)|combat-selection|combat-roost|combat-pile|encounter-objective)/.test(o.name ?? '')
      || (o.type === 'Text' && o.text && o.alpha > 0.05)) {
      const r = o.getBounds(); out.push({ name: o.name, x: r.x, y: r.y, w: r.width, h: r.height });
    }
  };
  b.children.list.forEach((c: any) => visit(c, 0));
  return out;
});

test('combat barks speak at the opening, on a heavy hit and at low Cohesion, clear of every panel', async ({ page }) => {
  const errors = await openBattle(page);
  await expect.poll(async () => (await barks(page))?.log.length ?? 0, { timeout: 30_000 }).toBeGreaterThanOrEqual(1);
  const check = async () => {
    const state = await barks(page);
    const blockers = await furniture(page);
    for (const bark of state.shown) {
      expect(bark.text.split(/\s+/).length).toBeLessThanOrEqual(6);
      const r = bark.rect;
      expect(r.x).toBeGreaterThanOrEqual(0); expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(1280); expect(r.y + r.height).toBeLessThanOrEqual(720);
      for (const o of blockers) {
        const overlap = r.x < o.x + o.w && o.x < r.x + r.width && r.y < o.y + o.h && o.y < r.y + r.height;
        expect(overlap, `${bark.text} over ${o.name}`).toBe(false);
      }
    }
    return state;
  };
  const opening = await check();
  expect(opening.log[0]).toMatchObject({ trigger: 'start' });
  // Tags hold ~1.5 s, then the quiet gap between unrelated barks runs out.
  await expect.poll(async () => { const s = await barks(page); return s.shown.length === 0 && s.queued === 0 && s.quietFor === 0; },
    { timeout: 30_000 }).toBe(true);
  expect(opening.log.length).toBeGreaterThanOrEqual(1);
  // A heavy hit that also drops the flock under 30%.
  const before = (await barks(page)).log.length;
  await page.evaluate(() => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); b.flock.hp = Math.round(b.flock.maxHp * 0.25); });
  await expect.poll(async () => (await barks(page)).log.length, { timeout: 10_000 }).toBeGreaterThan(before);
  const hit = await check();
  expect(hit.log.slice(before).map((entry: any) => entry.trigger)).toContain('bigHit');
  expect(hit.log.slice(before).every((entry: any) => entry.speaker.startsWith('leader:') || entry.speaker.startsWith('enemy:'))).toBe(true);
  expect(errors).toEqual([]);
});

test('barks stay off under the Fast text pace', async ({ page }) => {
  await openBattle(page, { 'birdsquad.textPace': 'fast' });
  await page.evaluate(() => (window as any).advanceTime(1500));
  await frames(page, 4);
  const state = await barks(page);
  expect(state.enabled).toBe(false);
  expect(state.log).toEqual([]);
  expect(state.shown).toEqual([]);
});

test('committing buttons answer with ui.confirm, navigation keeps the soft click', async ({ page }) => {
  await openBattle(page);
  await openCardReward(page);
  const requests = () => page.evaluate(() => {
    const audio = (window as any).__birdSquadAudio();
    return { confirm: audio.events.requests['ui.confirm'] ?? 0, click: audio.cueRequests.confirm ?? 0 };
  });
  const press = (name: string) => page.evaluate((name) => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const hit = b.root.list.find((o: any) => o.name === name && o.input?.enabled);
    hit.emit('pointerdown', { x: hit.x, y: hit.y }, 0, 0, { stopPropagation() {} });
    return hit.getData('fullLabel');
  }, name);
  const before = await requests();
  const label = await press('reward-card-take-hit');
  expect(label).toBe('Select');
  const afterSelect = await requests();
  // Arming a reward is a committed choice: the click is played as ui.confirm.
  expect(afterSelect.click - before.click).toBe(1);
  expect(afterSelect.confirm - before.confirm).toBe(1);
  await frames(page);
  const readBefore = await requests();
  expect(await press('reward-card-inspect-hit')).toBe('Read');
  const readAfter = await requests();
  expect(readAfter.confirm).toBe(readBefore.confirm);
});

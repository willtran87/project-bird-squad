import { test, expect } from '@playwright/test';
import { sanitizeCardClaims } from '../src/game/card-claim-checkpoint';

test('card-claim journal rejects malformed transactions instead of silently dropping ownership', () => {
  expect(sanitizeCardClaims([{ id: 'known', source: 'market', receipt: 'once' }], id => id === 'known')).toHaveLength(1);
  for (const input of [[null], [{ id: 'missing', source: 'market', receipt: 'once' }], [{ id: 'known', source: 'unknown', receipt: 'once' }]]) {
    expect(sanitizeCardClaims(input, id => id === 'known')).toBeUndefined();
  }
});

for (const mode of ['route', 'market']) test(`${mode} collection claims survive failed account writes and do not duplicate after checkpoint replay`, async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('./?flight=claim-recovery&length=quick');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.keyboard.press('Enter');
  const routeReady = () => page.waitForFunction(() => {
    const g = (window as any).__birdSquadGame;
    return g.scene.isActive('RouteScene') && g.scene.getScene('RouteScene').routeEssentialAssetsReady;
  });
  await routeReady();
  const transaction = await page.evaluate(mode => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
    const before = JSON.parse(JSON.stringify(r.runState));
    const set = Storage.prototype.setItem;
    w.__restoreClaims = () => { Storage.prototype.setItem = set; };
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('birdsquad.account')) throw new DOMException('Test account failure', 'QuotaExceededError');
      return set.call(this, key, value);
    };
    const id = 'wands_10';
    if (mode === 'route') r.grantSpecificCard(id);
    else {
      r.runState.scrap = 100; r.marketCardShelf = [{ id, price: 35 }]; r.buyMarketCard(0);
    }
    r.checkpointRouteIfChanged(true);
    return { before, id, run: JSON.parse(localStorage.getItem('birdsquad.run.active')!), failed: r.routeCheckpointState.outcome };
  }, mode);
  expect(transaction.failed).toBe('failed');
  expect(transaction.run.pendingCardClaims).toHaveLength(1);
  expect(transaction.run.deck.some((card: any) => card.id === transaction.id)).toBe(true);
  await page.evaluate(() => (window as any).__restoreClaims());
  await page.reload();
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.keyboard.press('Enter'); await routeReady();
  await expect.poll(() => page.evaluate(id => JSON.parse(localStorage.getItem('birdsquad.account')!).cardCollection[id]?.timesClaimed, transaction.id)).toBe(1);
  const after = await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').runState);
  const normalizedDeck = (deck: Array<{ id: string; upgraded?: boolean }>) => deck.map(card => ({ id: card.id, upgraded: !!card.upgraded }));
  expect(normalizedDeck(after.deck)).toEqual(normalizedDeck(transaction.run.deck));
  expect(after.scrap).toBe(transaction.run.scrap);
  // Model the advertised earlier checkpoint after an interrupted in-stop choice.
  // Permanent ownership remains, but replaying that same claim is idempotent.
  await page.evaluate(({ before, id, mode }) => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); r.runState = before;
    if (mode === 'route') r.grantSpecificCard(id);
    else { r.runState.scrap = 100; r.marketCardShelf = [{ id, price: 35 }]; r.buyMarketCard(0); }
    r.checkpointRouteIfChanged(true);
  }, { before: transaction.before, id: transaction.id, mode });
  expect(await page.evaluate(id => JSON.parse(localStorage.getItem('birdsquad.account')!).cardCollection[id].timesClaimed, transaction.id)).toBe(1);
});

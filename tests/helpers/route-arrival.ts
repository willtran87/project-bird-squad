import type { Page } from '@playwright/test';

/**
 * The district arrival card covers the route the first time a flight enters a
 * district, and the confirm press that first dismisses it does only that (it
 * may not commit a choice the player cannot see). Specs that drive the route
 * with confirm call this first, so their Enter reaches the route as intended.
 *
 * The card is claimed on the first route frame after the essential art is
 * ready; wait for that frame, then skip the card if it is showing.
 */
export async function dismissArrivalCard(page: Page) {
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene')?.routeEssentialAssetsReady);
  // The card's owner may load a little after the art on a slow machine; wait
  // until this district's card has been claimed (shown now or seen earlier),
  // falling back to a few frames when no claim can be recorded.
  const start = await page.evaluate(() => (window as any).__birdSquadGame.loop.frame);
  await page.waitForFunction((from) => {
    const game = (window as any).__birdSquadGame, route = game.scene.getScene('RouteScene');
    if (route?.children.getByName('district-arrival-card')?.active) return true;
    try {
      const seen = JSON.parse(localStorage.getItem('birdsquad.arrivalCards') ?? '');
      if (seen.run === (route?.runState?.startedAtMs ?? 0) && seen.districts.includes(route?.runState?.mapIndex ?? 0)) return true;
    } catch { /* nothing claimed yet */ }
    return game.loop.frame >= from + 600;
  }, start);
  const showing = () => page.evaluate(() =>
    Boolean((window as any).__birdSquadGame.scene.getScene('RouteScene')?.children.getByName('district-arrival-card')?.active));
  if (!(await showing())) return false;
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').events.emit('spectacle-skip-arrival'));
  await page.waitForFunction(() =>
    !(window as any).__birdSquadGame.scene.getScene('RouteScene')?.children.getByName('district-arrival-card')?.active);
  return true;
}

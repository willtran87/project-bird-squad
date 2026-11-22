import type { Page } from '@playwright/test';

/**
 * Unlocks earned by a finished flight are revealed on the next title visit,
 * and that ceremony is modal: the next key press belongs to it. Specs that
 * finish a flight and then drive the title skip the reveals with Back first.
 *
 * The reveals launch once the title's lazy engagement chunk has installed, on
 * the following game step; wait for both before deciding nothing is showing.
 */
export async function skipTitleReveals(page: Page) {
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.waitForFunction(() => typeof (window as any).__birdSquadEngagement === 'function');
  const start = await page.evaluate(() => (window as any).__birdSquadGame.loop.frame);
  await page.waitForFunction((from) => (window as any).__birdSquadGame.loop.frame >= from + 3, start);
  if (!(await page.evaluate(() => (window as any).__birdSquadGame.scene.isActive('CeremonyScene')))) return false;
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.isActive('CeremonyScene'));
  return true;
}

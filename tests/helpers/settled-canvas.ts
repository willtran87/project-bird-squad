import type { Page } from '@playwright/test';

/** Wait for Phaser's display sizing as well as the browser viewport change. */
export async function settleCanvas(page: Page) {
  await page.waitForFunction(() => {
    const b = document.querySelector('canvas')?.getBoundingClientRect();
    return b && b.width > 0 && b.height > 0 && b.left >= -1 && b.top >= -1
      && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1;
  });
  const frame = await page.evaluate(() => (window as any).__birdSquadGame.loop.frame);
  await page.waitForFunction(frame => (window as any).__birdSquadGame.loop.frame >= frame + 2, frame);
}

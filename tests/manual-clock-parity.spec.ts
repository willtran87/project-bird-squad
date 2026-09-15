import { test, expect } from '@playwright/test';

test('manual clock advances tweens and timers together and respects pause', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  const result = await page.evaluate(() => {
    const w = window as any, scene = w.__birdSquadGame.scene.getScene('MenuScene');
    const target = { x: 0 }, events: string[] = [];
    const timer = scene.time.delayedCall(200, () => events.push('timer'));
    const tween = scene.tweens.add({ targets: target, x: 100, duration: 200, ease: 'Linear', onComplete: () => events.push('tween') });
    const getDelta = scene.tweens.getDelta;
    w.advanceTime(100);
    const halfway = { x: target.x, elapsed: timer.elapsed, events: [...events] };
    scene.time.paused = true; scene.tweens.pauseAll();
    w.advanceTime(1000);
    const paused = { x: target.x, elapsed: timer.elapsed, events: [...events] };
    scene.time.paused = false; scene.tweens.resumeAll();
    w.advanceTime(150);
    return { halfway, paused, x: target.x, events, restored: getDelta === scene.tweens.getDelta,
      retired: !scene.tweens.getTweensOf(target).includes(tween) };
  });
  // Phaser initializes a newly added tween on its first frame.
  expect(result.halfway.x).toBeGreaterThan(30);
  expect(result.halfway.x).toBeLessThanOrEqual(50.1);
  expect(result.halfway.elapsed).toBeCloseTo(100);
  expect(result.halfway.events).toEqual([]);
  expect(result.paused).toEqual(result.halfway);
  expect(result.x).toBe(100);
  expect(result.events).toEqual(['timer', 'tween']);
  expect(result.restored).toBe(true); expect(result.retired).toBe(true);
  expect(errors).toEqual([]);
});

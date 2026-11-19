import { test, expect } from '@playwright/test';

// A flight checkpoint written by a newer build must survive this build untouched:
// the menu explains why it cannot continue instead of quarantining the save.
test('future-version flight checkpoint is kept and explained on the menu', async ({ page }) => {
  const raw = JSON.stringify({ saveVersion: 99, seed: 'future', deck: [{ id: 'major_00' }], mapIndex: 0 });
  await page.addInitScript((value) => {
    if (!sessionStorage.getItem('future-seeded')) {
      localStorage.setItem('birdsquad.run.active', value);
      sessionStorage.setItem('future-seeded', '1');
    }
  }, raw);
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').children.getByName('storage-recovery-notice'));
  const state = await page.evaluate(() => {
    const s = (window as any).__birdSquadGame.scene.getScene('MenuScene');
    const text = s.children.list.find((o: any) => o.name === 'storage-recovery-notice' && o.type === 'Text')?.text;
    return {
      text,
      menuHasSavedRun: s.menuHasSavedRun,
      stored: localStorage.getItem('birdsquad.run.active'),
      corrupt: localStorage.getItem('birdsquad.run.active.corrupt'),
    };
  });
  expect(state.text).toContain('newer version of Bird Squad (save version 99)');
  expect(state.menuHasSavedRun).toBe(false);
  expect(state.stored).toBe(raw);
  expect(state.corrupt).toBeNull();
});

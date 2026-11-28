import { test, expect } from '@playwright/test';
import {
  bootForSurfaces, openSurface, surfaceIssues, MENU_SURFACES, PROFILE_SURFACES, CODEX_SURFACES, ROUTE_SURFACES,
  COMBAT_SURFACES, type Surface,
} from './helpers/screen-surfaces';

// One sweep over every main screen and state, checking only general rules:
// - text floors (14 CSS px secondary, 16 CSS px primary; dense card faces 11.5),
// - 44 CSS px touch targets and 8 game-unit separation between commands,
// - no command hidden under another command,
// - no text or command straddling the stage edge,
// - no text spilling out of the quiet panel drawn behind it.
// Screen-specific specs keep the behaviour (decisions, input ownership,
// saves); they no longer pin positions, widths or row counts.
//
// 1000x560 is the smallest supported desktop window and the strictest for the
// CSS floors; 1280x720 is the authored size. 2560x1600 runs the cheap groups
// to cover high-density scaling. Each group boots once and restarts its scene
// per surface (menu surfaces reload the title), so one test reports every
// failing surface together.
const groups: Record<string, readonly Surface[]> = {
  menu: MENU_SURFACES,
  'profile and codex': [...PROFILE_SURFACES, ...CODEX_SURFACES],
  route: ROUTE_SURFACES,
  combat: COMBAT_SURFACES,
};
const viewports = [
  { width: 1000, height: 560, groups: Object.keys(groups) },
  { width: 1280, height: 720, groups: Object.keys(groups) },
  { width: 2560, height: 1600, groups: ['menu', 'combat'] },
];

// Known violations found when the sweep was introduced, listed so the sweep
// guards everything else meanwhile. Remove an entry once the product fixes it.
const KNOWN: Record<string, RegExp[]> = {
};

for (const viewport of viewports) {
  for (const group of viewport.groups) {
    test(`screen geometry sweep: ${group} at ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
      test.setTimeout(300_000);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await bootForSurfaces(page);
      const failures: Record<string, string[]> = {};
      for (const surface of groups[group]) {
        await test.step(surface, async () => {
          const scene = await openSurface(page, surface);
          const found = await surfaceIssues(page, scene);
          const { texts, targets } = found;
          const issues = found.issues.filter((issue) => !(KNOWN[surface] ?? []).some((known) => known.test(issue)));
          if (issues.length) {
            failures[surface] = issues;
            await info.attach(`${surface}-inventory`, { body: JSON.stringify({ texts, targets }, null, 2), contentType: 'application/json' });
            await page.screenshot({ path: info.outputPath(`${surface}-${viewport.width}.png`) });
          }
        });
      }
      expect(failures, `${group} at ${viewport.width}x${viewport.height}`).toEqual({});
      expect(errors).toEqual([]);
    });
  }
}

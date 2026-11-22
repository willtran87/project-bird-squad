import type { Page } from '@playwright/test';

/** Fixtures for the engagement specs: Daily Flight, run recap, Collection
 * ceremony and narrative threads. */

export const textState = (page: Page) => page.evaluate(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}'));

export async function frames(page: Page, count = 3) {
  const start = await page.evaluate(() => (window as any).__birdSquadGame.loop.frame);
  await page.waitForFunction(({ start, count }) => (window as any).__birdSquadGame.loop.frame >= start + count, { start, count });
}

/** Local `YYYYMMDD`, `offsetDays` from today, as the page's clock sees it. */
export const pageDate = (page: Page, offsetDays = 0) => page.evaluate((offset) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const two = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${two(date.getMonth() + 1)}${two(date.getDate())}`;
}, offsetDays);

/** A stored flight-log entry. `order` keeps ids unique and in log order. */
export function flightSummary(order: number, over: Record<string, unknown> = {}) {
  const seed = (over.seed as string | undefined) ?? `recap-${order}`;
  return {
    id: `run-${1_795_000_000_000 + order * 86_400_000}-flight-${seed}`, seed, result: 'win', leaderId: 'talon', difficulty: 0, runMode: 'full',
    mapId: 'map_04_high_roost', finalNodeId: 'm4_boss', turnsTaken: 62, durationMs: 1_543_000, currentCohesion: 31, maxCohesion: 52,
    scrapEarned: 300, scrapSpent: 200, finalScrap: 100, path: [], routeMarks: ['chalk_wingmark', 'rooftop_shortcut', 'patched_harness'],
    deck: ['swords_ace', 'swords_02', 'swords_03', 'swords_04', 'swords_fledgling', 'swords_08', 'major_18', 'aviary_29', 'pentacles_04', 'cups_03',
      'wands_ace', 'wands_02', 'cups_ace', 'major_04'].map((id) => ({ id })),
    suppliesUsed: [], signals: [], routeDecisions: [], districtContracts: [], seenEnemyMoves: [],
    cardRewards: ['wands_ace', 'wands_02', 'cups_ace'].map((picked) => ({ offered: [picked], picked, skipped: false })),
    combatResults: Array.from({ length: 11 }, (_, index) => ({
      encounterId: `e${index}`, nodeId: `n${index}`, nodeType: 'street', enemyIds: [], turnsTaken: 5,
      damageDealt: 40 + index * 9, cohesionLost: (index % 3) * 4,
      cardContributions: [{ cardId: 'swords_03', plays: 3, damage: 21 + index, cover: 0, flow: 0, healing: 0, drawn: 0, wingbeats: 0, resonance: 0, spent: 0 }],
    })),
    ...over,
  };
}

/** Open the title with `storage` seeded once (reloads keep what the game wrote). */
export async function openTitle(page: Page, storage: Record<string, string> = {}, url = './') {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript((values) => {
    if (sessionStorage.getItem('engagement-seeded')) return;
    sessionStorage.setItem('engagement-seeded', '1');
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value as string);
  }, storage);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(url);
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.waitForFunction(() => typeof (window as any).__birdSquadEngagement === 'function');
  return errors;
}

/** Move title focus with Tab until it rests on `focus`. */
export async function tabTo(page: Page, focus: string) {
  for (let presses = 0; presses < 12; presses += 1) {
    if ((await textState(page)).titleFocus?.current === focus) return presses;
    await page.keyboard.press('Tab');
    await frames(page, 2);
  }
  throw new Error(`Title focus never reached ${focus}`);
}

/** Bounds of every visible text in a scene, for overlap and edge checks. */
export const sceneTexts = (page: Page, sceneKey: string) => page.evaluate((key) => {
  const scene = (window as any).__birdSquadGame.scene.getScene(key);
  const out: Array<{ name: string; text: string; x: number; y: number; right: number; bottom: number; size: number }> = [];
  const visit = (object: any, shown: boolean) => {
    const visible = shown && object.visible !== false && object.alpha !== 0;
    if (object.list) { object.list.forEach((child: any) => visit(child, visible)); return; }
    if (object.type !== 'Text' || !visible || !object.text) return;
    const b = object.getBounds();
    out.push({ name: object.name, text: object.text, x: b.x, y: b.y, right: b.right, bottom: b.bottom, size: parseFloat(object.style.fontSize) });
  };
  scene.children.list.forEach((child: any) => visit(child, true));
  return out;
}, sceneKey);

export function overlapping(texts: Awaited<ReturnType<typeof sceneTexts>>) {
  const pairs: string[] = [];
  for (let a = 0; a < texts.length; a += 1) for (let b = a + 1; b < texts.length; b += 1) {
    const one = texts[a], two = texts[b];
    const x = Math.min(one.right, two.right) - Math.max(one.x, two.x), y = Math.min(one.bottom, two.bottom) - Math.max(one.y, two.y);
    // Line boxes carry a few pixels of leading; only real collisions count.
    if (x > 2 && y > 4) pairs.push(`"${one.text.slice(0, 40)}" x "${two.text.slice(0, 40)}"`);
  }
  return pairs;
}

import { expect, type Page } from '@playwright/test';
import type { SavedDeckRecord } from '../../src/game/saved-decks';
import { settleCanvas } from './settled-canvas';

// Shared boot and click helpers for the smoke-*.spec.ts topic files (split
// from the former tests/smoke.spec.ts).

// The game exposes a deterministic text-state harness on window; the smoke
// tests drive scenes through it rather than clicking the canvas.
declare global {
  interface Window {
    __birdSquadGame?: any;
    __birdSquadState?: () => any;
    __birdSquadLastRun?: any;
    __birdSquadStartScene?: (key: string, data?: any) => Promise<any>;
    __birdSquadEnsureScene?: (key: string) => Promise<boolean>;
    __routeAudit?: any;
    __birdSquadAudio?: () => any;
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
    __birdSquadShowKeywordTooltip?: (sceneKey: string, keyword: string, x: number, y: number) => boolean;
  }
}

export async function boot(page: Page, path = './') {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await page.goto(path);
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(250 + attempt * 250);
    }
  }
  if (lastError) throw lastError;
  await page.waitForFunction(() => !!window.__birdSquadGame, undefined, { timeout: 15_000 });
  await page.waitForFunction(() => {
    try {
      return JSON.parse(window.render_game_to_text?.() ?? '{}').scene === 'MenuScene';
    } catch {
      return false;
    }
  }, undefined, { timeout: 15_000 });
  await page.evaluate(async () => {
    if (window.__birdSquadStartScene) return;
    window.__birdSquadStartScene = async (key: string, data?: any) => {
      const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
      const g = window.__birdSquadGame;
      await window.__birdSquadEnsureScene?.(key);
      for (const sceneKey of ['MenuScene', 'ProfileScene', 'CodexScene', 'RouteScene', 'BattleScene']) {
        if (sceneKey !== key && g.scene.isActive(sceneKey)) g.scene.stop(sceneKey);
      }
      if (g.scene.isActive(key)) {
        g.scene.stop(key);
        await wait(0);
      }
      g.scene.start(key, data);
      for (let i = 0; i < 120; i += 1) {
        const scene = g.scene.getScene(key);
        const active = Boolean(scene?.scene?.isActive?.());
        const hasRequestedRouteSeed = key !== 'RouteScene'
          || !data?.runState?.seed
          || scene?.runState?.seed === data.runState.seed;
        const battleReady = key !== 'BattleScene'
          || (Boolean(scene?.fxLayer?.active) && Boolean(scene?.root?.active) && !scene?.combatAnimationPending);
        const routeReady = key !== 'RouteScene' || scene?.routeEssentialAssetsReady === true;
        if (active && hasRequestedRouteSeed && battleReady && routeReady) return scene;
        await wait(50);
      }
      return g.scene.getScene(key);
    };
  });
}

export async function clickNamedGameObject(page: Page, sceneKey: string, name: string) {
  await page.waitForFunction(({ sceneKey: key, name: objectName }) => {
    const scene = window.__birdSquadGame?.scene?.getScene(key);
    const collect = (items: any[]): any[] => items.flatMap((child: any) => [child, ...(Array.isArray(child.list) ? collect(child.list) : [])]);
    return collect(scene?.children?.list ?? []).some((child: any) => child.name === objectName && child.input?.enabled);
  }, { sceneKey, name });
  await settleCanvas(page);
  const center = await page.evaluate(({ sceneKey: key, name: objectName }) => {
    const scene = window.__birdSquadGame.scene.getScene(key);
    const collect = (items: any[]): any[] => items.flatMap((child: any) => [child, ...(Array.isArray(child.list) ? collect(child.list) : [])]);
    const hit = collect(scene.children.list).find((child: any) => child.name === objectName && child.input?.enabled);
    if (!hit) throw new Error(`Missing enabled ${objectName} command`);
    const bounds = hit.getBounds();
    return { x: bounds.centerX, y: bounds.centerY };
  }, { sceneKey, name });
  const canvas = await page.locator('canvas').boundingBox();
  if (!canvas) throw new Error('Missing game canvas');
  await page.mouse.click(
    canvas.x + canvas.width * (center.x / 1280),
    canvas.y + canvas.height * (center.y / 720),
    { delay: 50 },
  );
}

export async function clickFlightLabTool(page: Page, name: string) {
  // A newly drawn Phaser control is input-enabled before the next frame
  // registers it for hit testing. Wait for that frame before real clicks.
  await settleCanvas(page);
  const open = await page.evaluate(() => Boolean(window.__birdSquadGame.scene.getScene('ProfileScene')
    .children.getByName('profile-flight-lab-tools-panel')));
  if (!open) await clickNamedGameObject(page, 'ProfileScene', 'profile-flight-lab-tools-hit');
  await settleCanvas(page);
  await clickNamedGameObject(page, 'ProfileScene', name);
}

export async function focusFolioControl(page: Page, action: string) {
  const current = () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').folioFocus?.action);
  for (let index = 0; index < 24 && await current() !== action; index++) await page.keyboard.press('Tab');
  expect(await current()).toBe(action);
}

export async function openLabFixture(page: Page, deck: SavedDeckRecord) {
  await page.evaluate(async (fixture) => {
    const raw = JSON.stringify({ decks: [fixture] });
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    await window.__birdSquadStartScene!('ProfileScene');
  }, deck);
  await clickNamedGameObject(page, 'ProfileScene', 'profile-folios-tab-hit');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-folio-lab-hit');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text!()).savedFlightFolios?.flightLab?.open);
  return page.evaluate(() => JSON.parse(window.render_game_to_text!()).savedFlightFolios.flightLab);
}

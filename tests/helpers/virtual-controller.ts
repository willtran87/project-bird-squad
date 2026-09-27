import type { Page } from '@playwright/test';
import { settleCanvas } from './settled-canvas';

/** Browser Gamepad API fixture: Phaser still performs polling, edge detection,
 * event dispatch and route update handling. This is not physical-device evidence. */
export async function installVirtualController(page: Page) {
  await page.addInitScript(() => {
    const pad = { id: 'Bird Squad test controller', index: 0, connected: true,
      mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
    (window as any).__testController = pad;
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
  });
}

export async function controllerButton(page: Page, index: number, pressed: boolean) {
  await page.evaluate(({ index, pressed }) => {
    const pad = (window as any).__testController;
    pad.buttons[index] = { pressed, touched: pressed, value: pressed ? 1 : 0 };
    pad.timestamp = performance.now();
  }, { index, pressed });
  await settleCanvas(page);
}

export async function pressController(page: Page, index: number) {
  await controllerButton(page, index, true);
  await controllerButton(page, index, false);
}

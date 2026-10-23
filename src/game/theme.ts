import Phaser from 'phaser';
import { BORDER_SUBTLE, PANEL, UI_SHAPE } from './ui-tokens';
export * from './ui-tokens';

/**
 * Builds a layered panel as a fresh container at (0, 0). The caller adds it to
 * their own root container. x,y is the panel CENTER (Phaser rectangle convention).
 */
export function drawPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  opts?: { accent?: number; radius?: number; fill?: number },
): Phaser.GameObjects.Container {
  const accent = opts?.accent ?? BORDER_SUBTLE;
  const radius = opts?.radius ?? UI_SHAPE.panelRadius;
  const fill = opts?.fill ?? PANEL;
  const left = x - width / 2;
  const top = y - height / 2;

  const container = scene.add.container(0, 0);

  const shadow = scene.add.graphics();
  shadow.fillStyle(0x000000, 0.35);
  shadow.fillRoundedRect(left + 4, top + 5, width + 2, height + 2, radius);

  const panel = scene.add.graphics();
  panel.fillStyle(fill, 1);
  panel.fillRoundedRect(left, top, width, height, radius);

  const highlight = scene.add.graphics();
  highlight.lineStyle(1, 0xffffff, 0.06);
  highlight.strokeRoundedRect(left + 1, top + 1, width - 2, height - 2, radius);

  const border = scene.add.graphics();
  border.lineStyle(UI_SHAPE.panelBorder, accent, 1);
  border.strokeRoundedRect(left, top, width, height, radius);

  container.add([shadow, panel, highlight, border]);
  return container;
}

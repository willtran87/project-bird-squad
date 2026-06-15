import Phaser from 'phaser';

// Color numbers (Phaser uses 0xRRGGBB).
export const PAGE = 0x0a1118;
export const PANEL = 0x132028;
export const PANEL_HOVER = 0x1a2b35;
export const BORDER_SUBTLE = 0x1e3040;
export const BORDER_ACCENT = 0x2a4555;
export const GOLD = 0xe8b830;
export const GOLD_LIGHT = 0xfbd91e;
export const RED = 0xc41e3a;
export const TEAL = 0x45cfd8;

// Text colors (CSS hex strings).
export const TEXT = '#e0ddd8';
export const TEXT_DIM = '#8a9298';
export const TEXT_MUTE = '#506570';
export const CARD_CREAM = '#fff6e2';

export const SUIT_COLORS: Record<'plumes' | 'basins' | 'quills' | 'nests', number> = {
  plumes: 0xff9d4d,
  basins: 0x7ab8d6,
  quills: 0xd8e0ea,
  nests: 0x8fd6a0,
};

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
  const radius = opts?.radius ?? 10;
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
  border.lineStyle(2, accent, 1);
  border.strokeRoundedRect(left, top, width, height, radius);

  container.add([shadow, panel, highlight, border]);
  return container;
}

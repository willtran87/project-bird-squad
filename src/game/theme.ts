import Phaser from 'phaser';

// Shared dark urban/tarot palette. Menus deliberately use the quieter variant;
// combat reserves the brighter accents for resources and immediate decisions.
export const UI_FONT = 'Arial';
export const UI_BOLD = 'bold';
export const UI_GOLD = '#ffe1a3';
export const UI_BODY = '#cdd9e6';
export const UI_MUTED = '#8fa3b6';
export const UI_SOFT = '#b9c7d6';
export const UI_CYAN = '#8df4ff';
export const UI_FIELD = {
  ink: 0x070b12, panel: 0x0b111b, panelWarm: 0x17120c, rail: 0x111923,
  paper: 0x1c2022, gold: 0xd8a840, brass: 0xf0c36f, cyan: 0x7ab8d6,
  green: 0x8fd6a0, danger: 0xff6b57, violet: 0xc9a6ff,
  text: '#e7eef7', muted: '#91a6b8', warm: UI_GOLD, cyanText: UI_CYAN,
};
export const MENU_UI = {
  gold: '#dfc18b', cyan: '#adc9d2', soft: '#a4b6c2',
  field: {
    ink: 0x0b1723, gold: 0x86b1be, brass: 0x86b1be, cyan: 0x86b1be,
    green: 0x86b1be, danger: 0xe05b4f,
    muted: '#9cabb4', warm: '#eee8d8', text: '#eee8d8',
  },
};
export const READER_UI = { soft: '#bdc9d4', muted: UI_FIELD.muted };

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

// The smallest supported 1000x560 viewport scales the 1280x720 game surface
// to roughly 0.778x. A 58 px game-space hit region therefore remains above the
// 44 CSS px touch-target floor at that boundary.
export const MIN_SUPPORTED_TOUCH_TARGET = 58;

// Decision surfaces share a quiet shell and fixed readable text sizes. Long
// content is paged, never scaled down to fit. Adopt these tokens incrementally.
export const DECISION_UI = {
  surface: 0x0b151f,
  raised: 0x152b36,
  border: 0x496471,
  text: '#edf2f5',
  secondary: '#b6c8d2',
  accent: 0x77d9df,
  titleSize: 26,
  bodySize: 22,
  labelSize: 16,
  resolution: 2,
  inset: 28,
} as const;

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

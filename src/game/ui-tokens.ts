// Shared dark urban/tarot palette. Menus deliberately use the quieter variant;
// combat reserves the brighter accents for resources and immediate decisions.
export const UI_FONT = 'Arial';
export const UI_DISPLAY_FONT = 'Georgia, serif';
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

// Authored game-space sizes retain 16px primary / 14px secondary CSS text at
// the supported 1000x560 FIT boundary (560 / 720), without scaling text to fit.
export const UI_TYPE = { primary: 21, secondary: 19, title: 26, body: 22, resolution: 2 } as const;
export const UI_SHAPE = { panelRadius: 10, panelBorder: 2, hairline: 1 } as const;
export const UI_CONTRAST = { text: 4.5, indicator: 3 } as const;
export const UI_SPACE = { controlInset: 12, controlGap: 8, sectionGap: 24 } as const;
// Filled controls use one opaque palette so contrast does not depend on art
// behind them. Quiet utility controls belong on an opaque panel, never raw art.
// Square corners match the card-city panels; no raster border is
// stretched to fit a label. Focus has a stronger outline than pointer hover.
export const UI_CONTROL = {
  surface: 0x0b151f, hover: 0x17313e, selected: 0x203b48,
  primary: 0xd6b66f, primaryHover: 0xefd293,
  danger: 0x45262b, dangerHover: 0x5a3035, dangerBorder: 0xe9958c,
  disabled: 0x18232c, border: 0x718b98, focus: 0x77d9df,
  text: '#edf2f5', onPrimary: '#0b151f', disabledText: '#a2b1ba',
  dangerText: '#ffdbd5', borderWidth: 1, hoverWidth: 2, focusWidth: 3,
} as const;
// Route readers reserve a full 8px gap between 58px targets; combat piles
// retain their independent pagination contract.
export const ROUTE_DECK_VISIBLE_ROWS = 6;

// Decision surfaces share a quiet shell and fixed readable text sizes. Long
// content is paged, never scaled down to fit. Adopt these tokens incrementally.
export const DECISION_UI = {
  surface: UI_CONTROL.surface,
  raised: 0x152b36,
  border: 0x496471,
  text: UI_CONTROL.text,
  secondary: '#b6c8d2',
  accent: UI_CONTROL.focus,
  titleSize: UI_TYPE.title,
  bodySize: UI_TYPE.body,
  labelSize: UI_TYPE.secondary,
  resolution: UI_TYPE.resolution,
  inset: 28,
} as const;

// Text colors (CSS hex strings).
export const TEXT = '#e0ddd8';
export const TEXT_DIM = '#8a9298';
export const TEXT_MUTE = UI_MUTED;
export const CARD_CREAM = '#fff6e2';

export const SUIT_COLORS: Record<'plumes' | 'basins' | 'quills' | 'nests', number> = {
  plumes: 0xff9d4d,
  basins: 0x7ab8d6,
  quills: 0xd8e0ea,
  nests: 0x8fd6a0,
};

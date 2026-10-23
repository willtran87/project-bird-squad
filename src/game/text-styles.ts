import type Phaser from 'phaser';
import { UI_FONT, UI_DISPLAY_FONT, UI_TYPE, UI_BOLD, UI_BODY, UI_SOFT, CARD_CREAM } from './ui-tokens';

type TextStyle = Phaser.Types.GameObjects.Text.TextStyle;

export const FONT_UI = UI_FONT;
export const FONT_DISPLAY = UI_DISPLAY_FONT;

export function titleStyle(over?: Partial<TextStyle>): TextStyle {
  return { fontFamily: FONT_UI, fontSize: UI_TYPE.title, fontStyle: UI_BOLD, color: CARD_CREAM, resolution: UI_TYPE.resolution, ...over };
}

export function headingStyle(over?: Partial<TextStyle>): TextStyle {
  return { fontFamily: FONT_UI, fontSize: UI_TYPE.primary, fontStyle: UI_BOLD, color: UI_BODY, resolution: UI_TYPE.resolution, ...over };
}

export function bodyStyle(over?: Partial<TextStyle>): TextStyle {
  return { fontFamily: FONT_UI, fontSize: UI_TYPE.primary, color: UI_BODY, resolution: UI_TYPE.resolution, ...over };
}

export function labelStyle(over?: Partial<TextStyle>): TextStyle {
  return { fontFamily: FONT_UI, fontSize: UI_TYPE.secondary, fontStyle: UI_BOLD, color: UI_SOFT, resolution: UI_TYPE.resolution, ...over };
}

export function mutedStyle(over?: Partial<TextStyle>): TextStyle {
  return { fontFamily: FONT_UI, fontSize: UI_TYPE.secondary, color: UI_SOFT, resolution: UI_TYPE.resolution, ...over };
}

export function cardNameStyle(over?: Partial<TextStyle>): TextStyle {
  return { fontFamily: FONT_DISPLAY, fontSize: UI_TYPE.primary, fontStyle: UI_BOLD, color: CARD_CREAM, resolution: UI_TYPE.resolution, ...over };
}

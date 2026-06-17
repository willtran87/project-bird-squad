import Phaser from 'phaser';
import { TEXT, TEXT_DIM, TEXT_MUTE, CARD_CREAM } from './theme';

type TextStyle = Phaser.Types.GameObjects.Text.TextStyle;

export const FONT_UI = 'Arial';
export const FONT_DISPLAY = 'Georgia, serif';

export function titleStyle(over?: Partial<TextStyle>): TextStyle {
  return { fontFamily: FONT_UI, fontSize: '30px', fontStyle: 'bold', color: CARD_CREAM, ...over };
}

export function headingStyle(over?: Partial<TextStyle>): TextStyle {
  return { fontFamily: FONT_UI, fontSize: '18px', fontStyle: 'bold', color: TEXT, ...over };
}

export function bodyStyle(over?: Partial<TextStyle>): TextStyle {
  return { fontFamily: FONT_UI, fontSize: '14px', color: TEXT, ...over };
}

export function labelStyle(over?: Partial<TextStyle>): TextStyle {
  return { fontFamily: FONT_UI, fontSize: '11px', fontStyle: 'bold', color: TEXT_DIM, ...over };
}

export function mutedStyle(over?: Partial<TextStyle>): TextStyle {
  return { fontFamily: FONT_UI, fontSize: '12px', color: TEXT_MUTE, ...over };
}

export function cardNameStyle(over?: Partial<TextStyle>): TextStyle {
  return { fontFamily: FONT_DISPLAY, fontSize: '16px', fontStyle: 'bold', color: CARD_CREAM, ...over };
}

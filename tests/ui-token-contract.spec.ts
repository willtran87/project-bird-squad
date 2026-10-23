import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { UI_CONTROL, UI_CONTRAST, UI_TYPE, UI_SPACE, UI_SHAPE, MIN_SUPPORTED_TOUCH_TARGET,
  UI_FONT, UI_DISPLAY_FONT, UI_FIELD, MENU_UI, READER_UI, DECISION_UI, UI_BODY, UI_SOFT, UI_MUTED,
  TEXT, TEXT_DIM, TEXT_MUTE, PANEL } from '../src/game/ui-tokens';
import { titleStyle, headingStyle, bodyStyle, labelStyle, mutedStyle, cardNameStyle } from '../src/game/text-styles';

function luminance(color: number | string) {
  const value = typeof color === 'number' ? color : parseInt(color.replace('#', ''), 16);
  return [16, 8, 0].map(shift => ((value >> shift) & 255) / 255)
    .map(n => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
}
function contrast(a: number | string, b: number | string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}
test('shared control palettes meet text and focus contrast in every interactive state', () => {
  const c = UI_CONTROL;
  const textPairs = [
    [c.text, c.surface], [c.text,c.hover], [c.text,c.selected], [c.disabledText,c.disabled],
    [c.onPrimary,c.primary], [c.onPrimary,c.primaryHover], [c.dangerText,c.danger], [c.dangerText,c.dangerHover],
  ];
  for (const [text, surface] of textPairs) expect(contrast(text,surface), `${text}/${surface}`).toBeGreaterThanOrEqual(UI_CONTRAST.text);
  for (const surface of [c.surface,c.hover,c.selected,c.disabled,c.danger,c.dangerHover]) {
    expect(contrast(c.focus,surface)).toBeGreaterThanOrEqual(UI_CONTRAST.indicator);
  }
  for (const surface of [c.primary,c.primaryHover]) expect(contrast(c.surface,surface)).toBeGreaterThanOrEqual(UI_CONTRAST.indicator);
  expect(c.focusWidth).toBeGreaterThan(c.hoverWidth);
  expect(c.hoverWidth).toBeGreaterThan(c.borderWidth);
});

test('shared type, spacing and surfaces retain compact readability without divergent legacy defaults', () => {
  const compact = 560 / 720;
  expect(UI_TYPE.primary * compact).toBeGreaterThanOrEqual(16);
  expect(UI_TYPE.secondary * compact).toBeGreaterThanOrEqual(14);
  expect(MIN_SUPPORTED_TOUCH_TARGET * compact).toBeGreaterThanOrEqual(44);
  expect(UI_SPACE.controlGap).toBeGreaterThanOrEqual(8);
  expect(UI_SHAPE.panelBorder).toBeGreaterThanOrEqual(1);
  const styles = [titleStyle(), headingStyle(), bodyStyle(), labelStyle(), mutedStyle(), cardNameStyle()];
  for (const style of styles) {
    expect(Number(style.fontSize) * compact).toBeGreaterThanOrEqual(14);
    expect([UI_FONT,UI_DISPLAY_FONT]).toContain(style.fontFamily);
    expect(style.resolution).toBe(UI_TYPE.resolution);
  }
  for (const color of [UI_BODY,UI_SOFT,UI_MUTED,UI_FIELD.text,UI_FIELD.muted,READER_UI.soft,READER_UI.muted]) {
    expect(contrast(color,UI_FIELD.panel), color).toBeGreaterThanOrEqual(UI_CONTRAST.text);
  }
  for (const color of [MENU_UI.gold,MENU_UI.cyan,MENU_UI.soft,MENU_UI.field.text,MENU_UI.field.muted]) {
    expect(contrast(color,MENU_UI.field.ink), color).toBeGreaterThanOrEqual(UI_CONTRAST.text);
  }
  for (const color of [TEXT,TEXT_DIM,TEXT_MUTE]) expect(contrast(color,PANEL),color).toBeGreaterThanOrEqual(UI_CONTRAST.text);
  for (const color of [DECISION_UI.text,DECISION_UI.secondary]) expect(contrast(color,DECISION_UI.surface)).toBeGreaterThanOrEqual(UI_CONTRAST.text);
});

test('font families have one source of truth and shared control adapters cannot reintroduce raster frames', () => {
  const root = new URL('../src/', import.meta.url);
  const walk = (path: string): string[] => readdirSync(path, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(join(path, entry.name)) : entry.name.endsWith('.ts') ? [join(path, entry.name)] : []);
  const files = walk(fileURLToPath(root));
  for (const file of files.filter(file => !file.endsWith('ui-tokens.ts'))) {
    expect(readFileSync(file,'utf8').match(/['"](?:Arial|Georgia(?:, serif)?)['"]/g),file).toBeNull();
  }
  for (const name of ['quiet-ui','decision-surface']) {
    const source=readFileSync(new URL(`../src/game/${name}.ts`,import.meta.url),'utf8');
    expect(source).not.toMatch(/add\.image|setDisplaySize/);
  }
  for (const name of ['fx', 'battle/encounter-intro']) {
    const source = readFileSync(new URL(`../src/game/${name}.ts`, import.meta.url), 'utf8');
    expect(source).not.toMatch(/from ['"].*(?:ui-tokens|theme)['"]/);
  }
});

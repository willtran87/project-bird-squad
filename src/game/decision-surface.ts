import Phaser from 'phaser';
import { UI_FONT } from '../main';
import { DECISION_UI, MIN_SUPPORTED_TOUCH_TARGET } from './theme';

export function decisionText(scene: Phaser.Scene, x: number, y: number, value: string, width: number, size: number = DECISION_UI.bodySize, color: string = DECISION_UI.text) {
  return scene.add.text(x, y, value, { fontFamily: UI_FONT, fontSize: `${size}px`, color,
    resolution: DECISION_UI.resolution, wordWrap: { width, useAdvancedWrap: true }, lineSpacing: 2 });
}

// Summaries are explicitly abbreviated. Complete authored text belongs in the reader.
export function decisionExcerpt(text: Phaser.GameObjects.Text, height: number) {
  const lines = text.getWrappedText();
  let count = lines.length;
  while (text.height > height && count > 1) text.setText(`${lines.slice(0, --count).join('\n')}…`);
  let value = text.text;
  while (text.height > height && value.length > 1) { value = value.slice(0, -1).trimEnd(); text.setText(`${value}…`); }
  return text;
}

export function decisionButton(scene: Phaser.Scene, x: number, y: number, width: number, label: string, name: string, action: () => void) {
  const hit = scene.add.rectangle(x, y, width, MIN_SUPPORTED_TOUCH_TARGET, DECISION_UI.raised, 1)
    .setStrokeStyle(1, DECISION_UI.border, 1).setInteractive({ useHandCursor: true }).setName(name);
  hit.on('pointerdown', action);
  hit.on('pointerover', () => hit.setStrokeStyle(2, DECISION_UI.accent, 1));
  hit.on('pointerout', () => hit.setStrokeStyle(1, DECISION_UI.border, 1));
  return [hit, decisionText(scene, x, y, label, width - 16, 18).setOrigin(0.5)] as const;
}

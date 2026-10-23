import Phaser from 'phaser';
import { UI_FONT, DECISION_UI } from './theme';
import { quietButton } from './quiet-ui';

export function decisionText(scene: Phaser.Scene, x: number, y: number, value: string, width: number, size: number = DECISION_UI.bodySize, color: string = DECISION_UI.text) {
  return scene.add.text(x, y, value, { fontFamily: UI_FONT, fontSize: `${size}px`, color,
    resolution: DECISION_UI.resolution, wordWrap: { width, useAdvancedWrap: true }, lineSpacing: 2 });
}

/** Preserve every wrapped line while fitting pages to the reader's real bounds. */
export function measuredReadingPages(text: Phaser.GameObjects.Text, sections: Array<{heading:string;body:string}>, bottom: number) {
  const pages: Array<{title:string;text:string}> = [];
  for (const section of sections) {
    let lines: string[] = [];
    for (const line of text.getWrappedText(section.body)) {
      text.setText([...lines, line].join('\n'));
      if (text.getBounds().bottom > bottom && lines.length) {
        pages.push({title:section.heading,text:lines.join('\n')}); lines=[];
      }
      lines.push(line);
    }
    if (lines.length) pages.push({title:section.heading,text:lines.join('\n')});
  }
  return pages;
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
  const hit = quietButton(scene, { x, y, width, label, name, onActivate: action });
  return [hit, hit.getData('labelObject') as Phaser.GameObjects.Text] as const;
}

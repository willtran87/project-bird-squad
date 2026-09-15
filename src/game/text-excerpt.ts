import type Phaser from 'phaser';

/** Measured excerpts preserve their source and explicitly mark every omission. */
export function fitTextExcerpt(
  label: Phaser.GameObjects.Text,
  source: string,
  maxLines: number,
  format: (value: string) => string = value => value,
) {
  const full = source.replace(/\s+/g, ' ').trim();
  const words = full.split(' ');
  let visible = full;
  while (label.getWrappedText(format(visible)).length > maxLines && words.length > 1) {
    words.pop();
    visible = `${words.join(' ')}…`;
  }
  // A single unusually long name/token must obey the same limit.
  const letters = Array.from(visible.replace(/…$/, ''));
  while (label.getWrappedText(format(visible)).length > maxLines && letters.length > 1) {
    letters.pop();
    visible = `${letters.join('')}…`;
  }
  label.setText(format(visible)).setData('fullText', full).setData('truncated', visible !== full);
  return label;
}

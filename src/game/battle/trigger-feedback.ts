import Phaser from 'phaser';

// One shared, non-blocking lane. A burst replaces the previous notice instead of
// stacking cards over the flock. Exact events remain in the combat history.
const notices = new WeakMap<Phaser.GameObjects.Container, { card: Phaser.GameObjects.Container; count: number; turn: number; action?: boolean }>();

export function presentTriggerFeedback(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, options: {
  name: string; summary: string; accent: number; turn: number;
  fontFamily: string; reducedMotion: boolean; holdScale: number;
  action?: boolean;
}) {
  if (!layer.active) return;
  const previous = notices.get(layer);
  const count = !options.action && previous?.card.active && !previous.action && previous.turn === options.turn ? previous.count + 1 : 1;
  previous?.card.destroy(true);
  // Use the left stage lane, clear of solo enemies and boss reinforcements.
  const card = scene.add.container(282, 138).setName('combat-trigger-feedback');
  layer.add(card);
  notices.set(layer, { card, count, turn: options.turn, action: options.action });
  if (options.action) card.setName('combat-action-rejection');
  card.setData('count', count).setData('source', options.name).setData('summary', options.summary);
  card.add(scene.add.rectangle(0, 0, 500, 64, 0x07101c, 0.98).setStrokeStyle(1, options.accent, 0.65));
  card.add(scene.add.rectangle(-247, 0, 3, 56, options.accent, 0.85));
  const text = (y: number, value: string, size: number, color: string, width = 468) => {
    const label = scene.add.text(-234, y, value, {
      fontFamily: options.fontFamily, fontSize: `${size}px`, color, resolution: 2,
      wordWrap: { width, useAdvancedWrap: true }, lineSpacing: 1,
    });
    card.add(label); return label;
  };
  text(-24, options.action ? 'Cannot play' : count > 1 ? `${count} triggers` : 'Triggered', 14, '#abc4d4', 110).setX(234).setOrigin(1, 0);
  const title = text(-24, options.name, 18, '#ffe7b0', 342).setName('combat-trigger-title');
  const summary = text(3, options.summary, 17, '#e7eef7').setName('combat-trigger-summary');
  for (const [label, maxLines] of [[title, 1], [summary, 1]] as const) {
    const lines = label.getWrappedText();
    if (lines.length > maxLines) {
      let excerpt = lines.slice(0, maxLines).join('\n');
      label.setText(`${excerpt}…`);
      while (label.getWrappedText().length > maxLines && excerpt.length) {
        excerpt = excerpt.slice(0, -1).trimEnd(); label.setText(`${excerpt}…`);
      }
    }
  }
  // No movement/scale pulse and no time added to combat resolution.
  const timer = scene.time.delayedCall(1200 * options.holdScale, () => {
    if (options.reducedMotion) card.destroy(true);
    else scene.tweens.add({ targets: card, alpha: 0, duration: 140, onComplete: () => card.destroy(true) });
  });
  card.once(Phaser.GameObjects.Events.DESTROY, () => {
    timer.remove(false);
    scene.tweens.killTweensOf(card);
    if (notices.get(layer)?.card === card) notices.delete(layer);
  });
}

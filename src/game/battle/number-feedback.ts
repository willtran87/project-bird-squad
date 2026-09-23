import Phaser from 'phaser';

export type NumberFeedback = { target: string; kind: string; source: string; amount: number; suffix: string; reducedMotion: boolean; label?: string };
type NumberBurst = { group: Phaser.GameObjects.Container; label: Phaser.GameObjects.Text; plate: Phaser.GameObjects.Rectangle;
  created: number; amount: number; count: number; target: string; slot: number };
const numberBursts = new WeakMap<Phaser.GameObjects.Container, Map<string, NumberBurst>>();


/** Aggregate only explicitly identified, same-source results in a short
 * resolution burst. Never infer targets or mechanics from display text. */
export function presentNumberFeedback(scene: Phaser.Scene, layer: Phaser.GameObjects.Container,
  x: number, y: number, color: string, value: NumberFeedback, holdScale: number) {
  if (!layer.active) return;
  // Keep the flock's result stack beside its silhouette and impact art, so a
  // simultaneous block/heal/damage remains readable without obscuring the hit.
  const laneX = value.target === 'flock' ? x + 150 : x;
  // The caller supplies the mechanical target. Avoid traversing every scene
  // child for each hit in a multi-target or chained-effect resolution.
  const enemy = value.target !== 'flock';
  let entries = numberBursts.get(layer);
  if (!entries) { entries = new Map(); numberBursts.set(layer, entries); }
  const key = JSON.stringify([value.target, value.kind, value.source]);
  const old = entries.get(key);
  const update = (entry: NumberBurst) => {
    entry.label.setText(value.label
      ? `${value.label}${entry.count > 1 ? ` ×${entry.count}` : ''}`
      : `${entry.amount}${value.suffix}${entry.count > 1 ? ' total' : ''}`);
    entry.plate.setSize(Math.max(120, entry.label.width + 24), 34);
    entry.group.x = Phaser.Math.Clamp(laneX, entry.plate.width / 2 + 8, scene.scale.width - entry.plate.width / 2 - 8);
    entry.group.setData('amount', entry.amount).setData('count', entry.count);
  };
  if (old?.group.active && scene.time.now - old.created <= 120) {
    old.amount += value.amount; old.count += 1; update(old); return;
  }
  old?.group.destroy(true);
  // Enemy results replace in their own lane below status. Never move a result
  // under a different enemy or cover a portrait; history retains every source.
  let peers = [...entries.values()].filter(entry => entry.target === value.target);
  if (peers.length >= (enemy ? 1 : 3)) {
    peers.sort((a, b) => a.created - b.created)[0].group.destroy(true);
    peers = [...entries.values()].filter(entry => entry.target === value.target);
  }
  const slot = [0, 1, 2].find(index => !peers.some(entry => entry.slot === index)) ?? 0;
  const group = scene.add.container(laneX, enemy ? 405 : Phaser.Math.Clamp(y, 220, 420) - slot * 40).setName('combat-number-feedback');
  const plate = scene.add.rectangle(0, 0, 120, 34, 0x07101c, 0.96).setStrokeStyle(1, 0x718793, 0.45);
  const label = scene.add.text(0, 0, '', { fontFamily: 'Arial', fontSize: '20px', fontStyle: 'bold',
    color, resolution: 2 }).setOrigin(0.5).setName('combat-number-label');
  group.add([plate, label]); layer.add(group);
  const entry: NumberBurst = { group, label, plate, created: scene.time.now, amount: value.amount, count: 1, target: value.target, slot };
  numberBursts.set(layer, entries);
  entries.set(key, entry);
  group.setData('target', value.target).setData('kind', value.kind).setData('source', value.source).setData('placement', enemy ? 'target-lane' : 'flock-stack');
  update(entry);
  // Impact sprites are created after their numeric result. Promote the result
  // once the synchronous effect chain has finished, not on every render frame.
  const promote = scene.time.delayedCall(0, () => {
    if (group.active) layer.bringToTop(group);
  });
  const timer = scene.time.delayedCall(700 * holdScale, () => {
    if (value.reducedMotion) group.destroy(true);
    else scene.tweens.add({ targets: group, alpha: 0, duration: 120, onComplete: () => group.destroy(true) });
  });
  group.once(Phaser.GameObjects.Events.DESTROY, () => {
    timer.remove(false); promote.remove(false); scene.tweens.killTweensOf(group);
    if (entries?.get(key) === entry) entries.delete(key);
    if (!entries?.size) numberBursts.delete(layer);
  });
}

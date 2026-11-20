import Phaser from 'phaser';
import { currentPose, motion, renderPose, wallNow } from './kit';

/**
 * Depth for the shared quiet button: a bevel, a hover glow and a press that
 * sinks. One Graphics object per button is drawn directly above the hit
 * rectangle; the rectangle itself (the input bounds, fill and stroke that the
 * control contract tests read) and the label text are never modified. The
 * press travels at draw time only.
 */

type Hit = Phaser.GameObjects.Rectangle;
interface Dressed { hit: Hit; bevel: Phaser.GameObjects.Graphics; signature: string; pressedUntil: number }

const PRESS_MS = 120;
const GLOW: Record<string, number> = { primary: 0xffd98a, destructive: 0xff8f84 };
const dressed = new WeakMap<Phaser.Scene, { pending: Hit[]; live: Dressed[] }>();

function draw(entry: Dressed, pressed: boolean) {
  const { hit, bevel } = entry;
  const enabled = hit.getData('enabled') !== false;
  const hovered = Boolean(hit.getData('hovered')), focused = Boolean(hit.getData('focused'));
  // A resting utility control is deliberately invisible: no surface, no bevel.
  const flat = hit.fillAlpha < 0.5 || !enabled;
  const kind = String(hit.getData('controlKind'));
  const signature = [flat, hovered, focused, pressed, kind, hit.width, hit.height].join();
  if (signature === entry.signature) return;
  entry.signature = signature;
  bevel.clear();
  if (flat) return;
  const w = hit.width, h = hit.height, left = -w / 2, top = -h / 2;
  const radius = Math.min(8, h / 3);
  if (pressed) {
    // Sunk: the lip is gone and the top edge falls into shadow.
    bevel.fillStyle(0x000000, 0.26);
    bevel.fillRoundedRect(left + 1, top + 1, w - 2, 7, { tl: radius, tr: radius, bl: 0, br: 0 });
    bevel.fillStyle(0x000000, 0.1);
    bevel.fillRoundedRect(left + 1, top + 1, w - 2, h - 2, radius);
    return;
  }
  if ((hovered || focused) && motion() !== 'lean') {
    const glow = GLOW[kind] ?? 0x77d9df;
    [[3, 0.2], [6, 0.11], [10, 0.05]].forEach(([spread, alpha]) => {
      bevel.lineStyle(3, glow, alpha);
      bevel.strokeRoundedRect(left - spread, top - spread, w + spread * 2, h + spread * 2, radius + spread);
    });
  }
  // A lip below the face gives the control thickness.
  bevel.fillStyle(0x000000, 0.42);
  bevel.fillRoundedRect(left + 2, top + h - 3, w - 4, 6, { tl: 0, tr: 0, bl: radius, br: radius });
  // Light from above: a soft sheen over the top half and a bright top edge.
  bevel.fillStyle(0xffffff, kind === 'primary' ? 0.1 : 0.05);
  bevel.fillRoundedRect(left + 2, top + 2, w - 4, h * 0.46, { tl: radius - 1, tr: radius - 1, bl: 0, br: 0 });
  bevel.lineStyle(1, 0xffffff, kind === 'primary' ? 0.5 : 0.22);
  bevel.lineBetween(left + radius, top + 1.5, left + w - radius, top + 1.5);
  bevel.lineStyle(1, 0x000000, 0.4);
  bevel.lineBetween(left + radius, top + h - 1.5, left + w - radius, top + h - 1.5);
}

function adopt(scene: Phaser.Scene, hit: Hit, live: Dressed[]) {
  if (!hit.active || hit.getData('bevel')) return;
  const bevel = scene.add.graphics().setName('quiet-button-bevel');
  const parent = hit.parentContainer;
  if (parent) parent.addAt(bevel, parent.getIndex(hit) + 1);
  else scene.children.moveTo(bevel, scene.children.getIndex(hit) + 1);
  const entry: Dressed = { hit, bevel, signature: '', pressedUntil: 0 };
  hit.setData('bevel', bevel);
  const label = hit.getData('labelObject') as Phaser.GameObjects.Text | undefined;
  const sink = () => (entry.pressedUntil > wallNow() ? 2 : 0);
  // The bevel follows whatever entrance its button is making.
  renderPose(bevel, () => currentPose(hit) ?? {});
  hit.on('pointerdown', () => {
    if (!hit.input?.enabled || hit.getData('enabled') === false || motion() === 'lean') return;
    entry.pressedUntil = wallNow() + PRESS_MS;
    for (const object of [hit, label]) {
      if (object?.active) renderPose(object, () => (sink() ? { dy: sink() } : undefined), 'press');
    }
  });
  hit.once('destroy', () => {
    bevel.destroy();
    const index = live.indexOf(entry);
    if (index >= 0) live.splice(index, 1);
  });
  live.push(entry);
}

/** Dress every quiet button a scene creates from now on. */
export function dressButtons(scene: Phaser.Scene) {
  if (dressed.has(scene)) return;
  const state = { pending: [] as Hit[], live: [] as Dressed[] };
  dressed.set(scene, state);
  const queue = (hit: Hit) => state.pending.push(hit);
  const sync = () => {
    // Adopt at render time: by then the caller has parented the new button.
    if (state.pending.length) state.pending.splice(0).forEach(hit => adopt(scene, hit, state.live));
    const now = wallNow();
    for (const entry of state.live) {
      const { hit, bevel } = entry;
      if (bevel.x !== hit.x || bevel.y !== hit.y) bevel.setPosition(hit.x, hit.y);
      if (bevel.visible !== hit.visible) bevel.setVisible(hit.visible);
      if (bevel.depth !== hit.depth) bevel.setDepth(hit.depth);
      if (bevel.scrollFactorX !== hit.scrollFactorX) bevel.setScrollFactor(hit.scrollFactorX, hit.scrollFactorY);
      draw(entry, entry.pressedUntil > now);
    }
  };
  scene.events.on('quiet-button', queue);
  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, sync);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off('quiet-button', queue);
    scene.events.off(Phaser.Scenes.Events.PRE_RENDER, sync);
    dressed.delete(scene);
  });
}

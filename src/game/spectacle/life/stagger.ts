import Phaser from 'phaser';
import { clamp01, easeOut, motion, paced, renderPose, sceneNow } from './kit';

/**
 * Staggered entrances for lists: menu rows, route options, reward choices.
 * A list is recognised by the name its row frames already carry; everything
 * drawn inside a frame travels with it. Rows are posed at draw time only, so
 * their bounds, alpha and hit areas are final from the first frame.
 */

export interface StaggerSpec {
  /** Name shared by the row frames of one list. */
  name: string;
  /** Row order: reading order down the screen, or across it. */
  axis?: 'y' | 'x';
  /** The frame is a hit area drawn after its contents, not before them. */
  drawnLast?: boolean;
}

interface Session { start: number; live: boolean }
const STEP = 55, RISE = 240, MAX_ROWS = 10;
type Framed = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.GetBounds & { x: number; y: number };

function framesOf(scene: Phaser.Scene, name: string) {
  const found: Framed[] = [];
  const visit = (object: Phaser.GameObjects.GameObject, depth: number) => {
    if (object.name === name && 'getBounds' in object) found.push(object as Framed);
    else if (depth < 2 && object instanceof Phaser.GameObjects.Container) object.list.forEach(child => visit(child, depth + 1));
  };
  scene.children.list.forEach(child => visit(child, 0));
  return found;
}

/** Returns a scanner to call whenever the scene has redrawn. */
export function staggerLists(scene: Phaser.Scene, specs: readonly StaggerSpec[]) {
  const sessions = new Map<string, Session>();
  return () => {
    const mode = motion();
    const now = sceneNow(scene);
    for (const spec of specs) {
      const frames = framesOf(scene, spec.name);
      if (!frames.length) { sessions.delete(spec.name); continue; }
      let session = sessions.get(spec.name);
      if (!session) {
        // A list first drawn under a paused clock would never finish arriving.
        session = { start: now, live: mode !== 'lean' && !scene.time.paused };
        sessions.set(spec.name, session);
      }
      if (!session.live) continue;
      const start = session.start;
      const step = paced(STEP), rise = paced(mode === 'reduced' ? 140 : RISE);
      const rows = Math.min(frames.length, MAX_ROWS);
      if (now - start >= step * (rows - 1) + rise) { session.live = false; continue; }
      const axis = spec.axis ?? 'y';
      const ordered = [...frames].sort((a, b) => (axis === 'y' ? a.y - b.y || a.x - b.x : a.x - b.x || a.y - b.y));
      ordered.forEach((frame, index) => {
        const delay = mode === 'reduced' ? 0 : Math.min(index, MAX_ROWS - 1) * step;
        const pose = () => {
          const t = (sceneNow(scene) - start - delay) / rise;
          if (t >= 1) return undefined;
          const eased = easeOut(clamp01(t));
          return mode === 'reduced' ? { alpha: eased }
            : axis === 'y' ? { alpha: eased, dy: (1 - eased) * 16 } : { alpha: eased, dx: (1 - eased) * 22 };
        };
        const bounds = frame.getBounds();
        const siblings = frame.parentContainer?.list ?? scene.children.list;
        const from = siblings.indexOf(frame);
        renderPose(frame, pose);
        for (let at = spec.drawnLast ? 0 : from + 1; at < siblings.length; at += 1) {
          const member = siblings[at] as Framed;
          if (member === frame || member.name === spec.name || !('getBounds' in member) || member.name === 'quiet-button-bevel') continue;
          const box = member.getBounds();
          if (box.width <= bounds.width + 4 && box.height <= bounds.height + 4 && bounds.contains(box.centerX, box.centerY)) renderPose(member, pose);
        }
      });
    }
  };
}

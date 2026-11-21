import Phaser from 'phaser';
import { cardLibrary } from '../../shared/run-session';
import { birdTexture, eachFrame, motion, paced, redrawWatch, renderPose, sceneNow, type Pose } from './kit';
import { reducedRevealAlpha, revealDuration, revealDurationReduced, revealFrame } from './reveal-timeline';

/**
 * Card rewards arrive as a reveal: the choices are dealt face down and turn
 * over in sequence, each with a glint in its rarity's colour. Presentation
 * only, layered over the existing layout: every card, hit area and button is
 * at its final place from the first frame (poses are applied at draw time),
 * and any input skips straight to the settled screen without being consumed.
 */

interface Spec {
  /** Name of the per-card hit rectangle that frames one choice. */
  frame: string;
  /** The card's drawn face inside the frame, for the back. */
  card: (bounds: Phaser.Geom.Rectangle) => { cx: number; cy: number; w: number; h: number };
  /** A frame that also carries one of these is not a card reward (a Preen pick). */
  exclude?: string;
}

const SPECS: Record<string, Spec> = {
  BattleScene: { frame: 'reward-choice-card-hit', exclude: 'reward-preen-change',
    card: b => ({ cx: b.centerX, cy: b.centerY, w: b.width, h: b.height }) },
  RouteScene: { frame: 'route-reward-card-hit',
    card: b => ({ cx: b.centerX, cy: b.centerY - 28, w: 112, h: 164 }) },
};

const RARITY_GLINT: Record<string, number> = { common: 0xcfdbe6, uncommon: 0x7fe8cf, rare: 0xffcf5a, legendary: 0xff9fd8 };
const BELOW = 60;

interface Session { start: number; mode: 'full' | 'reduced'; count: number; skipped: boolean; key: string }
interface State { session?: Session; seen: Set<string>; extras: Phaser.GameObjects.GameObject[]; glints: Array<{ g: Phaser.GameObjects.Graphics; index: number; rect: Phaser.Geom.Rectangle; color: number }> }
const states = new WeakMap<Phaser.Scene, State>();

type Framed = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.GetBounds & { x: number; y: number };

function framesOf(scene: Phaser.Scene, name: string) {
  const found: Framed[] = [];
  const visit = (object: Phaser.GameObjects.GameObject, depth: number) => {
    if (object.name === name && 'getBounds' in object && object.active) found.push(object as Framed);
    else if (depth < 2 && object instanceof Phaser.GameObjects.Container) object.list.forEach(child => visit(child, depth + 1));
  };
  scene.children.list.forEach(child => visit(child, 0));
  return found.sort((a, b) => a.x - b.x);
}

/** Objects that belong to one choice: inside its frame, or in the action row below it. */
function membersOf(frame: Framed, all: Framed[]) {
  const bounds = frame.getBounds();
  const siblings = (frame.parentContainer?.list ?? frame.scene.children.list) as Framed[];
  const face: Framed[] = [], below: Framed[] = [];
  for (const member of siblings) {
    if (member === frame || !('getBounds' in member) || all.includes(member) || member.name?.startsWith('reward-reveal')) continue;
    const box = member.getBounds();
    if (box.width > bounds.width + 16 || box.height > bounds.height + 16) continue;
    if (bounds.contains(box.centerX, box.centerY)) face.push(member);
    else if (box.centerX > bounds.left && box.centerX < bounds.right && box.centerY > bounds.bottom && box.centerY < bounds.bottom + BELOW) below.push(member);
  }
  return { bounds, face, below };
}

function cardIdOf(members: Framed[]) {
  for (const member of members) {
    const id = member.getData?.('cardId');
    if (typeof id === 'string') return id;
  }
  return undefined;
}

function rarityColor(members: Framed[]) {
  for (const member of members) {
    const rarity = member.getData?.('rarity');
    if (typeof rarity === 'string' && RARITY_GLINT[rarity]) return RARITY_GLINT[rarity];
  }
  const id = cardIdOf(members);
  return RARITY_GLINT[String(id && cardLibrary[id]?.runtime.rarity)] ?? RARITY_GLINT.common;
}

/** The face-down card: field-kit navy with a gold double rule and the flock's mark. */
function drawBack(g: Phaser.GameObjects.Graphics, w: number, h: number) {
  const r = Math.min(10, w / 12), left = -w / 2, top = -h / 2;
  g.fillStyle(0x020409, 0.5).fillRoundedRect(left + 6, top + 8, w, h, r);
  g.fillStyle(0x0b1824, 1).fillRoundedRect(left, top, w, h, r);
  g.lineStyle(2, 0xd8a840, 0.9).strokeRoundedRect(left + 5, top + 5, w - 10, h - 10, r - 2);
  g.lineStyle(1, 0xd8a840, 0.45).strokeRoundedRect(left + 11, top + 11, w - 22, h - 22, Math.max(2, r - 5));
  // A lattice of fine diagonals, like the wired glass of a stairwell door.
  g.lineStyle(1, 0x2b4658, 0.55);
  const l = left + 14, rr = -left - 14, t = top + 14, b = -top - 14;
  for (let d = l - b; d < rr - t; d += 14) {
    const x0 = Math.max(l, t + d), x1 = Math.min(rr, b + d);
    if (x1 > x0) { g.lineBetween(x0, x0 - d, x1, x1 - d); g.lineBetween(-x0, x0 - d, -x1, x1 - d); }
  }
  const s = Math.min(w, h) * 0.2;
  g.fillStyle(0x0b1824, 1).fillCircle(0, 0, s * 1.25);
  g.lineStyle(2, 0xd8a840, 0.95).strokeCircle(0, 0, s * 1.25);
  return s;
}

/** The back with the flock's mark: three birds in a loose V. */
function buildBack(scene: Phaser.Scene, x: number, y: number, w: number, h: number) {
  const back = scene.add.container(x, y).setName('reward-reveal-back');
  const g = scene.add.graphics();
  const s = drawBack(g, w, h);
  back.add(g);
  const bird = birdTexture(scene);
  for (const [bx, by, k] of [[0, -0.3, 1], [-0.62, 0.34, 0.72], [0.62, 0.34, 0.72]] as const) {
    back.add(scene.add.image(bx * s, by * s, bird).setScale((s * 1.1 * k) / 40).setTint(0xffe1a3));
  }
  return back;
}

type Pt = { x: number; y: number };
/** Clip a convex polygon to a rectangle (Sutherland-Hodgman). */
function clipToRect(points: Pt[], rect: Phaser.Geom.Rectangle) {
  const edges: Array<[(p: Pt) => boolean, (a: Pt, b: Pt) => Pt]> = [
    [p => p.x >= rect.left, (a, b) => ({ x: rect.left, y: a.y + (b.y - a.y) * (rect.left - a.x) / (b.x - a.x) })],
    [p => p.x <= rect.right, (a, b) => ({ x: rect.right, y: a.y + (b.y - a.y) * (rect.right - a.x) / (b.x - a.x) })],
    [p => p.y >= rect.top, (a, b) => ({ x: a.x + (b.x - a.x) * (rect.top - a.y) / (b.y - a.y), y: rect.top })],
    [p => p.y <= rect.bottom, (a, b) => ({ x: a.x + (b.x - a.x) * (rect.bottom - a.y) / (b.y - a.y), y: rect.bottom })],
  ];
  let out = points;
  for (const [inside, cross] of edges) {
    const input = out;
    out = [];
    input.forEach((current, index) => {
      const previous = input[(index + input.length - 1) % input.length];
      if (inside(current)) { if (!inside(previous)) out.push(cross(previous, current)); out.push(current); }
      else if (inside(previous)) out.push(cross(previous, current));
    });
    if (!out.length) break;
  }
  return out;
}

/** A slanted band of light crossing the card, clipped to its face. */
function drawGlint(g: Phaser.GameObjects.Graphics, rect: Phaser.Geom.Rectangle, t: number, color: number) {
  g.clear();
  const band = rect.width * 0.34, slant = rect.height * 0.42;
  const lead = rect.left - band + (rect.width + band + slant) * t;
  const fade = Math.sin(Math.PI * t);
  for (const [from, to, alpha] of [[0, 1, 0.16], [0.32, 0.68, 0.26]] as const) {
    const a = lead + band * from, b = lead + band * to;
    const shape = clipToRect([{ x: a, y: rect.top }, { x: b, y: rect.top }, { x: b - slant, y: rect.bottom }, { x: a - slant, y: rect.bottom }], rect);
    if (shape.length > 2) g.fillStyle(color, alpha * fade).fillPoints(shape as Phaser.Math.Vector2[], true);
  }
  g.lineStyle(2, color, 0.7 * fade).strokeRoundedRect(rect.left, rect.top, rect.width, rect.height, 8);
}

function stateFor(scene: Phaser.Scene) {
  let state = states.get(scene);
  if (!state) { state = { seen: new Set(), extras: [], glints: [] }; states.set(scene, state); }
  return state;
}

function clearExtras(state: State) {
  state.extras.forEach(object => object.active && object.destroy());
  state.extras = [];
  state.glints = [];
}

function skip(scene: Phaser.Scene) {
  const state = states.get(scene);
  if (!state?.session || state.session.skipped) return;
  state.session.skipped = true;
  clearExtras(state);
}

function elapsed(scene: Phaser.Scene, session: Session) {
  if (session.skipped) return Number.POSITIVE_INFINITY;
  return (sceneNow(scene) - session.start) * (1 / paced(1));
}

function live(scene: Phaser.Scene, session: Session) {
  const ms = elapsed(scene, session);
  return ms < (session.mode === 'full' ? revealDuration(session.count) : revealDurationReduced(session.count));
}

function dress(scene: Phaser.Scene, spec: Spec, state: State, frames: Framed[]) {
  const all = frames.map(frame => ({ frame, ...membersOf(frame, frames) }));
  if (spec.exclude && all.some(({ face, below }) => [...face, ...below].some(member => member.name === spec.exclude))) return;
  const key = all.map(({ face }) => cardIdOf(face) ?? face.map(m => (m as unknown as { text?: string }).text ?? '').join('|')).join('/');
  let session = state.session;
  if (!session || session.key !== key) {
    if (state.seen.has(key)) return;
    const mode = motion();
    // A list first drawn under a paused clock would never finish arriving.
    if (mode === 'lean' || scene.time.paused) { state.seen.add(key); return; }
    session = { start: sceneNow(scene), mode, count: frames.length, skipped: false, key };
    state.session = session;
    state.seen.add(key);
  }
  const current = session;
  if (!live(scene, current)) return;
  clearExtras(state);
  const { width: W, height: H } = scene.scale.gameSize;
  all.forEach(({ frame, bounds, face, below }, index) => {
    const parent = frame.parentContainer;
    const card = spec.card(bounds);
    // Local coordinates: the frame and its card share a parent.
    const offsetX = frame.x - bounds.centerX, offsetY = frame.y - bounds.centerY;
    const local = { x: card.cx + offsetX, y: card.cy + offsetY };
    const at = (ms: number) => revealFrame(ms, index);
    const posed = (sampler: () => Pose | undefined) => (member: Framed) => renderPose(member, sampler, 'reveal');
    if (current.mode === 'reduced') {
      const fade = () => { const ms = elapsed(scene, current); const alpha = reducedRevealAlpha(ms, index); return alpha >= 1 ? undefined : { alpha }; };
      [frame, ...face, ...below].forEach(posed(fade));
      return;
    }
    [frame, ...face].forEach(member => posed(() => {
      const ms = elapsed(scene, current);
      if (!Number.isFinite(ms)) return undefined;
      const { face: f } = at(ms);
      if (!f.shown) return { alpha: 0 };
      if (f.sx >= 1) return undefined;
      return { sx: f.sx, dx: (member.x - local.x) * (f.sx - 1) };
    })(member));
    below.forEach(posed(() => {
      const ms = elapsed(scene, current);
      if (!Number.isFinite(ms)) return undefined;
      const settle = (ms - (revealDuration(current.count) - 260 - (current.count - 1 - index) * 160)) / 200;
      return settle >= 1 ? undefined : { alpha: Math.max(0, Math.min(1, settle)) };
    }));
    const back = buildBack(scene, local.x, local.y, card.w, card.h);
    if (parent) parent.add(back); else scene.children.bringToTop(back);
    const from = { x: W / 2 - local.x + offsetX, y: H + card.h * 0.6 - local.y + offsetY };
    renderPose(back, () => {
      const ms = elapsed(scene, current);
      if (!Number.isFinite(ms)) return { alpha: 0 };
      const frameAt = at(ms);
      if (!frameAt.back) return { alpha: 0 };
      const travel = 1 - frameAt.back.deal;
      return { dx: from.x * travel, dy: from.y * travel, sx: Math.max(0.02, frameAt.back.sx), alpha: Math.min(1, frameAt.back.deal * 3) };
    }, 'reveal');
    const glint = scene.add.graphics().setName('reward-reveal-glint').setBlendMode(Phaser.BlendModes.ADD);
    if (parent) parent.add(glint); else scene.children.bringToTop(glint);
    const rect = new Phaser.Geom.Rectangle(local.x - card.w / 2, local.y - card.h / 2, card.w, card.h);
    state.glints.push({ g: glint, index, rect, color: rarityColor(face) });
    state.extras.push(back, glint);
  });
}

/** Watch one scene for card rewards. */
export function dressRewardReveal(scene: Phaser.Scene) {
  const spec = SPECS[scene.scene.key];
  if (!spec || states.has(scene)) return;
  const state = stateFor(scene);
  const redrawn = redrawWatch(scene);
  const skipNow = () => skip(scene);
  window.addEventListener('pointerdown', skipNow, true);
  // Input is read at the window: a control that consumes its press (or Enter)
  // stops Phaser's scene-wide events, and the reveal must still give way.
  window.addEventListener('keydown', skipNow, true);
  scene.input?.gamepad?.on('down', skipNow);
  eachFrame(scene, () => {
    if (redrawn()) {
      const frames = framesOf(scene, spec.frame);
      if (!frames.length) { clearExtras(state); state.session = undefined; }
      else if (!frames[0].getData('reward-reveal')) {
        frames.forEach(frame => frame.setData('reward-reveal', true));
        dress(scene, spec, state, frames);
      }
    }
    const session = state.session;
    if (!session || !state.glints.length) return;
    const ms = elapsed(scene, session);
    if (!live(scene, session)) { clearExtras(state); return; }
    for (const { g, index, rect, color } of state.glints) {
      if (!g.active) continue;
      const t = revealFrame(ms, index).glint;
      if (t === undefined) g.clear(); else drawGlint(g, rect, t, color);
    }
  }, () => {
    window.removeEventListener('pointerdown', skipNow, true);
    window.removeEventListener('keydown', skipNow, true);
    scene.input?.gamepad?.off('down', skipNow);
    states.delete(scene);
  });
}

/** Read-only view for tests and debugging. */
export function rewardRevealState(scene: Phaser.Scene) {
  const state = states.get(scene), session = state?.session;
  if (!session) return undefined;
  const ms = elapsed(scene, session);
  return {
    mode: session.mode, cards: session.count, skipped: session.skipped, live: live(scene, session),
    elapsed: Number.isFinite(ms) ? Math.round(ms) : -1,
    backs: state!.extras.filter(object => object.active && object.name === 'reward-reveal-back').length,
    faces: Array.from({ length: session.count }, (_, index) => {
      if (session.skipped) return 'shown';
      if (session.mode === 'reduced') return reducedRevealAlpha(ms, index) >= 1 ? 'shown' : 'fading';
      const f = revealFrame(ms, index).face;
      return !f.shown ? 'down' : f.sx < 1 ? 'turning' : 'shown';
    }),
  };
}

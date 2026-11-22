import Phaser from 'phaser';
import { panel } from '../../ui-panel';
import { birdTexture, eachFrame, motion, renderPose, wallNow } from './kit';

/**
 * A themed loading state for scenes waiting on district art or lazy chunks.
 * The scenes already draw a plain readiness screen (`scene-readiness-*`);
 * this layer keeps it dark for the first 250 ms, so a fast load never shows
 * a loading card at all, then raises a small panel with the flock circling
 * and a progress bar while the readiness groups settle.
 */

export const LOADING_DELAY_MS = 250;

interface Tracker { snapshot(): { pendingGroups: string[] } }
interface Session { start: number; most: number; root?: Phaser.GameObjects.Container; bar?: Phaser.GameObjects.Rectangle; birds: Phaser.GameObjects.Image[]; progress: number; shown: boolean }
const sessions = new WeakMap<Phaser.Scene, Session>();
const dressed = new WeakSet<Phaser.Scene>();

const TRACKER: Record<string, string> = { RouteScene: 'routeAssetReadiness', BattleScene: 'battleAssetReadiness' };

function readinessObjects(scene: Phaser.Scene) {
  const found: Phaser.GameObjects.GameObject[] = [];
  const visit = (object: Phaser.GameObjects.GameObject, depth: number) => {
    if (object.name?.startsWith('scene-readiness-') && object.active) found.push(object);
    else if (depth < 1 && object instanceof Phaser.GameObjects.Container) object.list.forEach(child => visit(child, depth + 1));
  };
  scene.children.list.forEach(child => visit(child, 0));
  return found;
}

function text(scene: Phaser.Scene, objects: Phaser.GameObjects.GameObject[], name: string) {
  const found = objects.find(object => object.name === name) as Phaser.GameObjects.Text | undefined;
  return found?.text;
}

function build(scene: Phaser.Scene, session: Session, objects: Phaser.GameObjects.GameObject[]) {
  const { width: W, height: H } = scene.scale.gameSize;
  const root = scene.add.container(0, 0).setDepth(10_000).setName('scene-loading');
  const frame = panel(scene, {
    name: 'scene-loading', x: W / 2, y: H / 2, width: 640, height: 236, accent: 0x77d9df, fillAlpha: 0.94,
    eyebrow: scene.scene.key === 'BattleScene' ? 'Into the fight' : 'Across the city',
    title: text(scene, objects, 'scene-readiness-title') ?? 'Loading…',
    subtitle: text(scene, objects, 'scene-readiness-detail'),
  }, object => root.add(object));
  const { body } = frame;
  const bird = birdTexture(scene);
  session.birds = [0, 1, 2, 3, 4].map(index => {
    const scale = index ? 0.6 : 0.8;
    const image = scene.add.image(body.cx, body.top + 22, bird).setTint(index ? 0xbfe8f4 : 0xffe1a3).setScale(scale)
      .setData('home', { x: body.cx, y: body.top + 22, scale });
    root.add(image);
    return image;
  });
  const track = scene.add.rectangle(body.left + 6, body.bottom - 10, body.width - 12, 6, 0x10222b, 1).setOrigin(0, 0.5).setName('scene-loading-track');
  const bar = scene.add.rectangle(body.left + 6, body.bottom - 10, 1, 6, 0x77d9df, 1).setOrigin(0, 0.5).setName('scene-loading-bar');
  root.add([track, bar]);
  session.root = root;
  session.bar = bar;
}

function animate(session: Session, now: number) {
  const still = motion() !== 'full';
  const t = still ? 0 : (now - session.start) / 1000;
  session.birds.forEach((image, index) => {
    // The flock drifts in a loose V across the panel, wings beating.
    const side = index === 0 ? 0 : index % 2 ? -1 : 1, rank = Math.ceil(index / 2);
    const home = image.getData('home') as { x: number; y: number; scale: number };
    image.setPosition(home.x + Math.sin(t * 1.4) * 64 + side * rank * 34, home.y + rank * 10 + Math.sin(t * 3 + index) * 3);
    image.scaleY = home.scale * (still ? 1 : 1 + 0.3 * Math.sin(t * 14 + index));
  });
}

/** Watch a scene's readiness screen and dress it once a load runs long. */
export function dressLoading(scene: Phaser.Scene) {
  const field = TRACKER[scene.scene.key];
  if (!field || dressed.has(scene)) return;
  dressed.add(scene);
  eachFrame(scene, () => {
    const objects = readinessObjects(scene);
    let session = sessions.get(scene);
    if (!objects.length) {
      if (session) { session.root?.destroy(true); sessions.delete(scene); }
      return;
    }
    if (!session) {
      session = { start: wallNow(), most: 0, birds: [], progress: 0, shown: false };
      sessions.set(scene, session);
    }
    const current = session;
    const elapsed = wallNow() - current.start;
    // Keep the plain readiness card dark until the load has actually taken a while.
    for (const object of objects) {
      if (object.getData('loading-posed')) continue;
      object.setData('loading-posed', true);
      renderPose(object, () => ({ alpha: 0 }), 'loading');
    }
    const tracker = (scene as unknown as Record<string, Tracker | undefined>)[field];
    const pending = tracker?.snapshot().pendingGroups.length ?? 0;
    current.most = Math.max(current.most, pending);
    current.progress = current.most ? 1 - pending / current.most : 0;
    if (elapsed < LOADING_DELAY_MS) return;
    if (!current.root?.active) build(scene, current, objects);
    current.shown = true;
    const track = current.root!.getByName('scene-loading-track') as Phaser.GameObjects.Rectangle;
    current.bar!.width = Math.max(2, track.width * Math.max(0.04, current.progress));
    animate(current, wallNow());
  }, () => { sessions.delete(scene); dressed.delete(scene); });
}

export function loadingState(scene: Phaser.Scene) {
  const session = sessions.get(scene);
  return session ? { shown: session.shown && Boolean(session.root?.active), progress: Math.round(session.progress * 100) / 100,
    elapsed: Math.round(wallNow() - session.start), birds: session.birds.length } : undefined;
}

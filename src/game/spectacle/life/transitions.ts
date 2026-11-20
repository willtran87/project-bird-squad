import Phaser from 'phaser';
import { clamp01, eachFrame, motion, paced, sceneNow } from './kit';

/**
 * Scene exit transitions: a wing sweeps across and carries the old scene away.
 *
 * Scene changes stay instantaneous. When a scene asks for the next one, the
 * frame it was showing is drawn once into a texture; the new scene starts at
 * once, fully live, and that picture is laid over it and wiped off behind the
 * wing. Nothing waits on the animation and no scene is kept alive for it.
 */

const SNAPSHOT = 'life-exit-snapshot';
const WING = 'life-wing';
const DEPTH = 30000;

interface Style { direction: 1 | -1; tint: number; ms: number }
const GOLD = 0xffd98a, CYAN = 0x8df4ff;
const STYLES: Record<string, Style> = {
  'MenuScene>RouteScene': { direction: 1, tint: GOLD, ms: 560 },
  'MenuScene>BattleScene': { direction: 1, tint: GOLD, ms: 560 },
  'RouteScene>BattleScene': { direction: 1, tint: CYAN, ms: 480 },
  'BattleScene>RouteScene': { direction: -1, tint: CYAN, ms: 480 },
  'RouteScene>MenuScene': { direction: -1, tint: GOLD, ms: 480 },
  'BattleScene>MenuScene': { direction: -1, tint: GOLD, ms: 480 },
};
/** Entering a new district: slower, gold, and it hands over to the arrival card. */
const DISTRICT: Style = { direction: 1, tint: GOLD, ms: 760 };

let pending: { pair: string; to: string; frame: number; snapshot: boolean } | undefined;
/** True from the start of a game step until its frame has been drawn. */
let stepping = false;
let last: { pair: string; style: string; snapshot: boolean } | undefined;

function wingTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(WING)) return WING;
  const canvas = scene.textures.createCanvas(WING, 520, 1000);
  const context = canvas?.getContext();
  if (!canvas || !context) return WING;
  // Flight feathers trail back (left) from a leading edge on the right.
  const spine = 400;
  for (let index = 0; index < 13; index += 1) {
    const y = 20 + index * 80;
    const reach = 250 + 90 * Math.sin((index / 12) * Math.PI);
    context.save();
    context.translate(spine, y);
    context.rotate(-0.16);
    context.beginPath();
    context.moveTo(0, -58);
    context.quadraticCurveTo(-reach * 0.6, -66, -reach, 0);
    context.quadraticCurveTo(-reach * 0.6, 66, 0, 58);
    context.closePath();
    context.fillStyle = index % 2 ? '#0a1420' : '#070f19';
    context.fill();
    context.strokeStyle = 'rgba(120,170,200,0.28)';
    context.lineWidth = 2;
    context.stroke();
    context.strokeStyle = 'rgba(120,170,200,0.16)';
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(-reach + 14, 0);
    context.stroke();
    context.restore();
  }
  const edge = context.createLinearGradient(spine - 70, 0, spine + 110, 0);
  edge.addColorStop(0, '#070f19');
  edge.addColorStop(0.62, '#0c1826');
  edge.addColorStop(0.9, 'rgba(255,255,255,0.95)');
  edge.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = edge;
  context.fillRect(spine - 70, 0, 180, 1000);
  canvas.refresh();
  return WING;
}

/** Draw the outgoing scene's current frame into a texture. */
function capture(scene: Phaser.Scene) {
  const { textures, renderer } = scene.game;
  // Drawing between frames (a DOM handler, a test calling `scene.start`
  // directly) leaves the WebGL batch in a state the next frame trips over.
  // Those changes get the wing without the outgoing picture.
  if (renderer.type !== Phaser.WEBGL || !stepping) return false;
  try {
    if (textures.exists(SNAPSHOT)) textures.remove(SNAPSHOT);
    const { width, height } = scene.scale.gameSize;
    const texture = textures.addDynamicTexture(SNAPSHOT, width, height);
    if (!texture) return false;
    texture.fill(0x08101d);
    texture.draw(scene.children.list.filter(child => (child as unknown as { visible?: boolean }).visible !== false));
    texture.render();
    return true;
  } catch {
    if (textures.exists(SNAPSHOT)) textures.remove(SNAPSHOT);
    return false;
  }
}

/** Note every scene change as it is requested. Call once per game. */
export function installTransitions(game: Phaser.Game) {
  game.events.on(Phaser.Core.Events.PRE_STEP, () => { stepping = true; });
  game.events.on(Phaser.Core.Events.POST_RENDER, () => { stepping = false; });
  const plugin = Phaser.Scenes.ScenePlugin.prototype as unknown as {
    start: (this: Phaser.Scenes.ScenePlugin, key?: string | Phaser.Scene, data?: object) => Phaser.Scenes.ScenePlugin;
  };
  const start = plugin.start;
  plugin.start = function (key, data) {
    try {
      const from = this.scene, to = typeof key === 'string' ? key : key?.scene?.key ?? '';
      const pair = `${from.scene.key}>${to}`;
      pending = undefined;
      if (STYLES[pair] && motion() !== 'lean' && from.sys.isActive()) {
        pending = { pair, to, frame: from.game.loop.frame, snapshot: capture(from) };
      }
    } catch { pending = undefined; }
    return start.call(this, key, data);
  };
}

/** Play the transition into `scene`, if one was noted. Returns true when a
 * full wing wipe is playing, so the arrival light sweep can stand down. */
export function dressTransition(scene: Phaser.Scene) {
  const noted = pending;
  if (!noted || noted.to !== scene.scene.key || scene.game.loop.frame - noted.frame > 4) return false;
  pending = undefined;
  const mode = motion();
  const route = scene as unknown as { districtAdvanceNotice?: unknown };
  const district = noted.pair === 'BattleScene>RouteScene' && Boolean(route.districtAdvanceNotice);
  const style = district ? DISTRICT : STYLES[noted.pair];
  const snapshot = noted.snapshot && scene.textures.exists(SNAPSHOT);
  if (mode === 'lean' || (mode === 'reduced' && !snapshot)) return false;
  last = { pair: noted.pair, style: district ? 'district' : 'wing', snapshot };
  const { width, height } = scene.scale.gameSize;
  const duration = paced(mode === 'reduced' ? 180 : style.ms);
  const start = sceneNow(scene);
  // The scenes' own 200 ms fade from black would dim the outgoing picture.
  scene.cameras.main.fadeEffect?.reset();
  let layer: Phaser.GameObjects.Container | undefined;
  let picture: Phaser.GameObjects.Image | undefined;
  let wing: Phaser.GameObjects.Image | undefined;
  let rim: Phaser.GameObjects.Image | undefined;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    layer?.destroy();
    if (scene.textures.exists(SNAPSHOT)) scene.textures.remove(SNAPSHOT);
  };
  const build = () => {
    layer = scene.add.container(0, 0).setDepth(DEPTH).setName('spectacle-exit-transition').setData('pair', noted.pair);
    if (snapshot) layer.add(picture = scene.add.image(0, 0, SNAPSHOT).setOrigin(0).setDisplaySize(width, height));
    if (mode !== 'full') return;
    // Flipping mirrors the quad around its centre, so the leading edge swaps sides.
    wing = scene.add.image(0, height / 2, wingTexture(scene)).setOrigin(style.direction > 0 ? 400 / 520 : 120 / 520, 0.5)
      .setDisplaySize(520 * (height * 1.35) / 1000, height * 1.35).setAngle(8 * style.direction).setFlipX(style.direction < 0)
      .setTint(style.tint);
    rim = scene.add.image(0, height / 2, WING).setOrigin(wing.originX, 0.5).setDisplaySize(wing.displayWidth, wing.displayHeight)
      .setAngle(wing.angle).setFlipX(wing.flipX).setTint(style.tint).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5);
    layer.add([wing, rim]);
  };
  eachFrame(scene, () => {
    if (done) return;
    const t = (sceneNow(scene) - start) / duration;
    if (t >= 1) { finish(); return; }
    if (!layer?.active) build();
    if (mode !== 'full') { picture?.setAlpha(1 - clamp01(t)); return; }
    const eased = Phaser.Math.Easing.Sine.InOut(clamp01(t));
    // The leading edge travels from just off one side to just off the other.
    const reach = width * 0.36;
    const travelled = -reach + (width + reach * 2) * eased;
    const edge = style.direction > 0 ? travelled : width - travelled;
    wing?.setX(edge);
    rim?.setX(edge);
    if (!picture) return;
    // The outgoing picture survives only ahead of the wing.
    const seam = Phaser.Math.Clamp(edge - style.direction * 150, 0, width);
    if (style.direction > 0) picture.setCrop(seam, 0, width - seam, height);
    else picture.setCrop(0, 0, seam, height);
  }, finish);
  return mode === 'full';
}

export const lastTransition = () => last;

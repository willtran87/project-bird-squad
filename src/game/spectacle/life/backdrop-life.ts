import Phaser from 'phaser';
import { fullGraphicsTier } from '../../graphics-quality';
import { currentMap } from '../../shared/run-session';
import { birdTexture, eachFrame, hash01, motion, renderPose, sceneNow, type Pose } from './kit';

/**
 * Living backdrops for the title and the route map.
 *
 *  - Depth: the painting, the birds above it and the weather in front drift
 *    by different amounts as the pointer moves.
 *  - Life: birds cross the sky, windows light up, vents steam, each to suit
 *    the district.
 *  - Light: the painting is graded by how far the run has come: dusk over the
 *    Rooftop Blocks, night through the Canal Markets and Signal Spires, dawn
 *    at High Roost.
 *
 * The painting is never moved or recoloured as far as the scene can tell:
 * drift and grade are applied only while it is drawn. Everything else lives
 * in its own layer and is a function of the scene clock, so the route's
 * destroy-and-redraw rendering resumes it mid-flight. Reduced Motion keeps
 * the grade and the lit windows and drops all movement; Lean removes it all.
 * The trimmed automatic tier drops the two large additive fills (horizon glow
 * and steam) and keeps the birds and windows.
 */

const GLOW = 'spectacle-glow';
const DISTRICTS = ['rooftop-blocks', 'canal-markets', 'signal-spires', 'high-roost'] as const;

interface LifePlan {
  /** Flocks crossing: [height 0..1 of the sky band, seconds between passes, birds]. */
  flocks: ReadonlyArray<readonly [y: number, every: number, birds: number]>;
  /** Steam vents, in painting pixels. */
  vents: ReadonlyArray<readonly [x: number, y: number]>;
  /** How many of the painting's lit windows take part. */
  windows: number;
  /** Left edge of the sky the birds may use (the title keeps its menu clear). */
  left?: number;
}

const PLANS: Record<string, LifePlan> = {
  // Rooftop Blocks: pigeons over the roofs, rooftop HVAC venting, windows coming on at dusk.
  'rooftop-blocks': { flocks: [[0.16, 15, 4], [0.3, 23, 3]], vents: [[248, 232], [1010, 196], [1196, 318]], windows: 12 },
  // Canal Markets: gulls low over the water, steam from the stalls, lantern windows.
  'canal-markets': { flocks: [[0.34, 17, 3], [0.2, 29, 5]], vents: [[212, 412], [560, 300], [1080, 436]], windows: 14 },
  // Signal Spires: thin air and hard light; few birds, no steam, panels flickering on.
  'signal-spires': { flocks: [[0.12, 31, 3]], vents: [], windows: 10 },
  // High Roost: clear dawn air full of birds; the windows go dark as the light comes up.
  'high-roost': { flocks: [[0.1, 11, 5], [0.22, 16, 4], [0.32, 21, 3], [0.16, 27, 5]], vents: [[980, 250]], windows: 12 },
  splash: { flocks: [[0.12, 19, 4], [0.24, 31, 3]], vents: [], windows: 8, left: 560 },
};

const districtOf = (key: string) => DISTRICTS.findIndex(name => key.includes(name));

type Rgb = readonly [number, number, number];
// Run progress 0..4 (district plus the share of it flown) to sky and ground grade.
const LIGHT: ReadonlyArray<readonly [at: number, top: Rgb, bottom: Rgb]> = [
  [0, [255, 196, 150], [222, 200, 214]],   // dusk: amber sky over cooling streets
  [1, [150, 170, 236], [186, 196, 226]],   // nightfall
  [2, [120, 142, 222], [166, 178, 218]],   // deep night
  [2.7, [128, 146, 222], [172, 182, 220]], // still night at the top of the Spires
  [3, [226, 176, 196], [214, 200, 226]],   // first light as High Roost comes into view
  [4, [255, 236, 204], [255, 246, 232]],   // full dawn
];

/** Sky and ground multiply tints for a point in the run, plus how dark it is. */
export function runLight(progress: number) {
  const at = Phaser.Math.Clamp(progress, 0, 4);
  let index = 0;
  while (index < LIGHT.length - 2 && LIGHT[index + 1][0] <= at) index += 1;
  const [from, to] = [LIGHT[index], LIGHT[index + 1]];
  const mix = (to[0] - from[0]) > 0 ? (at - from[0]) / (to[0] - from[0]) : 0;
  const blend = (a: Rgb, b: Rgb) => a.map((channel, i) => Math.round(channel + (b[i] - channel) * mix));
  const pack = ([r, g, b]: number[]) => (r << 16) | (g << 8) | b;
  const top = blend(from[1], to[1]), bottom = blend(from[2], to[2]);
  // Darkest in deep night; lamps and windows matter most then.
  const night = Phaser.Math.Clamp(1 - Math.abs(at - 2) / 2.2, 0, 1);
  return { top: pack(top), bottom: pack(bottom), night, name: at < 1 ? 'dusk' : at < 3 ? 'night' : 'dawn' };
}

type RunRead = { runState?: { mapIndex?: number; completedRouteNodeIds?: unknown[] } };

/** Run progress for a scene showing `district` (0..3): 0 at the first step
 * into the Rooftop Blocks, 4 with High Roost cleared. */
export function runProgress(scene: Phaser.Scene, district: number) {
  const run = (scene as unknown as RunRead).runState;
  let within = 0;
  try {
    const columns = Math.max(1, currentMap().columns.length);
    within = Phaser.Math.Clamp((run?.completedRouteNodeIds?.length ?? 0) / columns, 0, 1);
  } catch { /* no active map: treat as the district's first step */ }
  return Math.max(0, district) + within * 0.96;
}

export function lightPose(scene: Phaser.Scene, key: string): Pose | undefined {
  const district = districtOf(key);
  if (district < 0) return undefined;
  const { top, bottom } = runLight(runProgress(scene, district));
  return { tint: [top, top, bottom, bottom] };
}

const windowCache = new Map<string, Array<[x: number, y: number]>>();

/** Find the painting's own lit windows and lamps: warm, bright local peaks.
 * Coordinates are 0..1 across the painting. */
function litWindows(scene: Phaser.Scene, key: string, limit: number) {
  const cached = windowCache.get(key);
  if (cached) return cached.slice(0, limit);
  const found: Array<[number, number, number]> = [];
  try {
    const source = scene.textures.get(key).getSourceImage() as CanvasImageSource;
    const columns = 128, rows = 72;
    const canvas = document.createElement('canvas');
    canvas.width = columns;
    canvas.height = rows;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('no 2d context');
    context.drawImage(source, 0, 0, columns, rows);
    const { data } = context.getImageData(0, 0, columns, rows);
    const warmth = (x: number, y: number) => {
      const i = (y * columns + x) * 4;
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      return r > 140 && r - b > 40 && g > 70 ? r + g - b : 0;
    };
    for (let y = 2; y < rows - 2; y += 1) {
      for (let x = 2; x < columns - 2; x += 1) {
        const score = warmth(x, y);
        if (!score) continue;
        let peak = true;
        for (let dy = -2; dy <= 2 && peak; dy += 1) for (let dx = -2; dx <= 2; dx += 1) {
          if (warmth(x + dx, y + dy) > score) { peak = false; break; }
        }
        if (peak && !found.some(([fx, fy]) => Math.hypot(fx - x, fy - y) < 6)) found.push([x, y, score]);
      }
    }
    found.sort((a, b) => b[2] - a[2]);
  } catch { /* an unreadable texture simply has no windows */ }
  const points = found.slice(0, 16).map(([x, y]) => [(x + 0.5) / 128, (y + 0.5) / 72] as [number, number]);
  windowCache.set(key, points);
  return points.slice(0, limit);
}

function findPainting(scene: Phaser.Scene, match: (image: Phaser.GameObjects.Image) => boolean) {
  let found: Phaser.GameObjects.Image | undefined;
  const visit = (object: Phaser.GameObjects.GameObject, depth: number) => {
    if (found) return;
    if (object instanceof Phaser.GameObjects.Image && match(object)) found = object;
    else if (depth < 2 && object instanceof Phaser.GameObjects.Container) object.list.forEach(child => visit(child, depth + 1));
  };
  scene.children.list.forEach(child => visit(child, 0));
  return found;
}

interface Life {
  layer: Phaser.GameObjects.Container;
  birds: Array<{ image: Phaser.GameObjects.Image; flock: number; member: number }>;
  puffs: Array<{ image: Phaser.GameObjects.Image; vent: number; order: number }>;
  windows: Phaser.GameObjects.Image[];
  horizon?: Phaser.GameObjects.Image;
}

/** Dress the title (`splash`) or the route map's district painting. */
export function dressBackdropLife(scene: Phaser.Scene) {
  const isBackdrop = (image: Phaser.GameObjects.Image) => image.displayWidth >= 1200 && image.displayHeight >= 650
    && (image.texture.key === 'splash' || image.name === 'route-map-backdrop');
  let painting: Phaser.GameObjects.Image | undefined;
  let life: Life | undefined;
  let signature = '';
  // Smoothed pointer offset, -1..1 on each axis.
  const drift = { x: 0, y: 0 };
  const depthPose = (amount: number) => (): Pose | undefined =>
    (motion() === 'full' ? { dx: -drift.x * amount, dy: -drift.y * amount * 0.6 } : undefined);

  const clear = () => { life?.layer.destroy(); life = undefined; };
  const build = (image: Phaser.GameObjects.Image, plan: LifePlan, mode: 'full' | 'reduced') => {
    const layer = scene.add.container(0, 0).setName('spectacle-life');
    const parent = image.parentContainer;
    if (parent) parent.addAt(layer, parent.getIndex(image) + 1);
    else { layer.setDepth(image.depth); scene.children.moveTo(layer, scene.children.getIndex(image) + 1); }
    const made: Life = { layer, birds: [], puffs: [], windows: [] };
    if (!scene.textures.exists(GLOW)) return made;
    const { width, height } = scene.scale.gameSize;
    const full = fullGraphicsTier();
    if (full) {
      made.horizon = scene.add.image(width * 0.5, height * 0.06, GLOW).setBlendMode(Phaser.BlendModes.ADD)
        .setDisplaySize(width * 1.1, height * 0.55).setAlpha(0).setName('spectacle-horizon');
      layer.add(made.horizon);
    }
    litWindows(scene, image.texture.key, plan.windows).forEach(([x, y]) => {
      const glow = scene.add.image(x * width, y * height, GLOW).setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xffc983).setDisplaySize(46, 46).setAlpha(0).setName('spectacle-window');
      made.windows.push(glow);
      layer.add(glow);
    });
    if (mode !== 'full') return made;
    if (full) plan.vents.forEach((_vent, vent) => {
      for (let order = 0; order < 3; order += 1) {
        const image = scene.add.image(0, 0, GLOW).setBlendMode(Phaser.BlendModes.ADD).setTint(0xcfd8e6).setAlpha(0).setName('spectacle-steam');
        made.puffs.push({ image, vent, order });
        layer.add(image);
      }
    });
    const bird = birdTexture(scene);
    // Birds sit one step nearer than the painting, so they slide against it.
    const sky = scene.add.container(0, 0).setName('spectacle-birds');
    renderPose(sky, depthPose(9));
    layer.add(sky);
    plan.flocks.forEach(([, , count], flock) => {
      for (let member = 0; member < count; member += 1) {
        const image = scene.add.image(0, 0, bird).setAlpha(0);
        made.birds.push({ image, flock, member });
        sky.add(image);
      }
    });
    return made;
  };

  const animate = (made: Life, plan: LifePlan, key: string, mode: 'full' | 'reduced') => {
    const now = sceneNow(scene);
    const { width, height } = scene.scale.gameSize;
    const district = districtOf(key);
    const light = runLight(district < 0 ? 2 : runProgress(scene, district));
    const dawn = light.name === 'dawn';
    // A low warm glow where the sun has just gone, or is about to come.
    made.horizon?.setTint(dawn ? 0xffd9a8 : 0xff9a5c).setAlpha(district < 0 ? 0 : (1 - light.night) * (dawn ? 0.34 : 0.24));
    made.windows.forEach((glow, index) => {
      // Windows come on one by one through the evening; at dawn they go out.
      const at = 1200 + hash01(index * 7 + 3) * 22000;
      const lit = mode === 'reduced' ? 1 : Phaser.Math.Clamp((now - at) / 700, 0, 1);
      const flicker = mode === 'full' ? 0.9 + 0.1 * Math.sin(now / (700 + index * 90) + index) : 1;
      glow.setAlpha((dawn ? 1 - lit : lit) * (0.22 + 0.3 * light.night) * flicker);
    });
    if (mode !== 'full') return;
    made.puffs.forEach(({ image, vent, order }) => {
      const [x, y] = plan.vents[vent];
      const phase = (now / 4200 + order / 3 + vent * 0.17) % 1;
      image.setPosition(x + 16 * phase + Math.sin(phase * 6 + vent) * 7, y - 74 * phase)
        .setDisplaySize(40 + 90 * phase, 40 + 90 * phase).setAlpha(Math.sin(Math.PI * phase) * 0.16);
    });
    const left = plan.left ?? 0;
    made.birds.forEach(({ image, flock, member }) => {
      const [band, every] = plan.flocks[flock];
      const period = every * 1000, crossing = 9000 + flock * 1700;
      const phase = (now + hash01(flock + 11) * period) % period;
      if (phase > crossing) { image.setAlpha(0); return; }
      const t = phase / crossing;
      const heading = flock % 2 ? -1 : 1;
      const span = width - left + 160;
      const lead = heading > 0 ? left - 80 + span * t : width + 80 - span * t;
      // A loose V behind the lead bird.
      const rank = Math.ceil(member / 2), side = member % 2 ? 1 : -1;
      const size = 0.42 + 0.22 * hash01(flock * 5 + member) + (1 - band) * 0.18;
      image.setPosition(lead - heading * rank * 26, height * band + Math.sin(t * Math.PI) * -22 + side * rank * 13 + Math.sin(now / 900 + member) * 3)
        .setScale(size, size * (0.7 + 0.5 * Math.sin(now / 115 + member * 1.7)))
        .setTint(light.night > 0.55 ? 0x9fb4d8 : 0x1c1622)
        .setAlpha((light.night > 0.55 ? 0.5 : 0.82) * Math.min(1, t * 8, (1 - t) * 8));
    });
  };

  eachFrame(scene, () => {
    const mode = motion();
    if (!painting?.active) painting = findPainting(scene, isBackdrop);
    const key = painting?.texture.key ?? '';
    const planKey = key === 'splash' ? 'splash' : DISTRICTS[districtOf(key)];
    const plan = planKey ? PLANS[planKey] : undefined;
    const next = painting && plan && mode !== 'lean' ? `${key}|${mode}|${fullGraphicsTier()}` : '';
    if (next !== signature || (next && !life?.layer.active)) {
      signature = next;
      clear();
      if (next && painting && plan) life = build(painting, plan, mode as 'full' | 'reduced');
    }
    if (!next || !painting || !plan || !life) return;
    if (!painting.getData('life-posed')) {
      painting.setData('life-posed', true);
      const image = painting;
      // Overscan by 2% so drifting never shows the painting's edge.
      renderPose(image, () => {
        const current = motion();
        if (current === 'lean') return {};
        if (current !== 'full') return lightPose(scene, image.texture.key) ?? {};
        // Growing about an off-centre origin would slide the picture sideways.
        const grown = 0.02;
        return { ...lightPose(scene, image.texture.key), scale: 1 + grown,
          dx: -drift.x * 6 - (0.5 - image.originX) * image.displayWidth * grown,
          dy: -drift.y * 4 - (0.5 - image.originY) * image.displayHeight * grown };
      }, 'life');
    }
    if (mode === 'full') {
      const pointer = scene.input.activePointer;
      const { width, height } = scene.scale.gameSize;
      // An untouched pointer rests at 0,0; treat that as the centre.
      const idle = pointer.x === 0 && pointer.y === 0;
      const sway = Math.sin(performance.now() / 4200) * 0.18;
      const tx = idle ? sway : Phaser.Math.Clamp((pointer.x / width - 0.5) * 2, -1, 1) + sway;
      const ty = idle ? 0 : Phaser.Math.Clamp((pointer.y / height - 0.5) * 2, -1, 1);
      drift.x += (tx - drift.x) * 0.06;
      drift.y += (ty - drift.y) * 0.06;
      // Lamps stay pinned to the painting; weather hangs well in front of it.
      for (const [name, amount] of [['spectacle-life', 6], ['spectacle-ambient', 6], ['spectacle-weather', 22]] as const) {
        const layer = (painting.parentContainer ?? scene.children).getByName(name) as Phaser.GameObjects.Container | null;
        if (layer && !layer.getData('life-posed')) {
          layer.setData('life-posed', true);
          renderPose(layer, depthPose(amount), 'life');
        }
      }
    }
    animate(life, plan, key, mode as 'full' | 'reduced');
  }, () => { clear(); painting = undefined; signature = ''; });
}

export function backdropLifeState(scene: Phaser.Scene) {
  const layer = scene.children.getByName('spectacle-life') as Phaser.GameObjects.Container | null;
  const count = (name: string) => layer?.list.filter(child => child.name === name).length ?? 0;
  const sky = layer?.getByName('spectacle-birds') as Phaser.GameObjects.Container | null;
  return { present: Boolean(layer?.active), windows: count('spectacle-window'), steam: count('spectacle-steam'), birds: sky?.list.length ?? 0 };
}

import Phaser from 'phaser';
import { prefersReducedMotion } from '../../main';
import { prefersLeanEffects } from '../graphics-quality';
import { flashEffectsState } from '../visual-accessibility';

/**
 * Living-stage dressing: light, weather and bloom layered over the authored
 * scenes. Everything here is additive presentation. It owns its own display
 * objects, never touches game state, and disappears entirely under Lean
 * graphics; Reduced Motion keeps the still lighting and drops all movement.
 */

const GLOW = 'spectacle-glow';
const STREAK = 'spectacle-streak';
const RING = 'spectacle-ring';
const FEATHER = 'spectacle-feather';
const AMBIENT_DEPTH = -19;

const WARM = 0xffb25a;
const BEACON = 0xff3b30;
const PANEL = 0x49d6ff;

type Light = readonly [x: number, y: number, color: number, radius: number];

interface StagePlan {
  lights: readonly Light[];
  /** Rain density, 0..1. */
  rain: number;
  /** Rising warm motes (lanterns, embers), 0..1. */
  motes: number;
  fog: number;
  /** Wind lean of the rain, degrees clockwise from vertical. */
  wind: number;
  /** Left edge of the weather, for scenes whose painting shares the screen with a menu. */
  left?: number;
}

// Light positions are authored against each 1280x720 district painting.
const STAGES: Record<string, StagePlan> = {
  'battlefield-rooftop-blocks': {
    rain: 0.8, motes: 0, fog: 0x3b5fa8, wind: 11,
    lights: [[60, 250, WARM, 78], [446, 100, WARM, 40], [850, 100, WARM, 40], [1024, 159, WARM, 44], [1163, 293, WARM, 70], [360, 136, WARM, 26]],
  },
  'battlefield-canal-markets': {
    rain: 0.45, motes: 0.8, fog: 0x8a5a2e, wind: 7,
    lights: [[230, 144, WARM, 60], [100, 207, WARM, 72], [455, 162, WARM, 52], [760, 162, WARM, 52], [1036, 155, WARM, 56], [1148, 247, WARM, 70], [360, 63, WARM, 30]],
  },
  'battlefield-signal-spires': {
    rain: 1, motes: 0, fog: 0x2a3f8f, wind: 16,
    lights: [
      [17, 288, BEACON, 46], [34, 528, BEACON, 54], [1084, 580, BEACON, 54], [384, 33, BEACON, 30], [558, 31, BEACON, 26],
      [906, 52, BEACON, 30], [1021, 43, BEACON, 28], [1221, 67, BEACON, 30], [227, 26, BEACON, 24], [939, 9, BEACON, 24],
      [272, 115, PANEL, 34], [310, 115, PANEL, 34], [234, 151, PANEL, 40], [926, 121, PANEL, 36], [47, 335, PANEL, 40],
      [1171, 264, PANEL, 44], [1238, 547, PANEL, 48],
    ],
  },
  'battlefield-high-roost': {
    rain: 0.6, motes: 0, fog: 0x4a5fa0, wind: 20,
    lights: [
      [605, 140, WARM, 40], [671, 140, WARM, 40], [754, 140, WARM, 40], [829, 140, WARM, 40], [315, 164, WARM, 30],
      [345, 189, WARM, 30], [414, 165, WARM, 30], [278, 210, WARM, 32], [193, 257, WARM, 34], [972, 171, WARM, 30],
      [1036, 206, WARM, 32], [1134, 268, WARM, 34], [1263, 337, WARM, 36],
      [472, 15, BEACON, 22], [418, 64, BEACON, 22], [530, 64, BEACON, 22], [701, 60, BEACON, 22], [899, 11, BEACON, 22],
      [975, 103, BEACON, 24], [1197, 188, BEACON, 28], [40, 475, BEACON, 44], [1223, 511, BEACON, 44],
    ],
  },
};
// Boss variants and unknown paintings still get weather, never misplaced lamps.
const FALLBACK_STAGE: StagePlan = { rain: 0.7, motes: 0, fog: 0x3b5fa8, wind: 12, lights: [] };

let softwareRenderer: boolean | undefined;

/** Filters are full-screen shader passes. Skip them where they would be drawn
 * on the CPU (software GL), unless explicitly requested with `?fx=full`. */
export function spectacleFiltersEnabled(scene: Phaser.Scene) {
  if (scene.game.renderer.type !== Phaser.WEBGL || prefersLeanEffects()) return false;
  const requested = new URLSearchParams(location.search).get('fx');
  if (requested === 'full') return true;
  if (requested === 'off') return false;
  if (softwareRenderer === undefined) {
    const gl = (scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer).gl;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    softwareRenderer = /swiftshader|llvmpipe|software|basic render/i.test(name);
  }
  return !softwareRenderer;
}

export function ensureSpectacleTextures(scene: Phaser.Scene) {
  const textures = scene.textures;
  if (!textures.exists(GLOW)) {
    const canvas = textures.createCanvas(GLOW, 128, 128);
    const context = canvas?.getContext();
    if (canvas && context) {
      const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.22, 'rgba(255,255,255,0.55)');
      gradient.addColorStop(0.55, 'rgba(255,255,255,0.14)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 128, 128);
      canvas.refresh();
    }
  }
  if (!textures.exists(STREAK)) {
    const canvas = textures.createCanvas(STREAK, 4, 40);
    const context = canvas?.getContext();
    if (canvas && context) {
      const gradient = context.createLinearGradient(0, 0, 0, 40);
      gradient.addColorStop(0, 'rgba(255,255,255,0)');
      gradient.addColorStop(0.7, 'rgba(255,255,255,0.9)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = gradient;
      context.fillRect(1, 0, 2, 40);
      canvas.refresh();
    }
  }
  if (!textures.exists(RING)) {
    const canvas = textures.createCanvas(RING, 64, 64);
    const context = canvas?.getContext();
    if (canvas && context) {
      context.strokeStyle = 'rgba(255,255,255,0.9)';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(32, 32, 28, 0, Math.PI * 2);
      context.stroke();
      canvas.refresh();
    }
  }
  if (!textures.exists(FEATHER)) {
    const canvas = textures.createCanvas(FEATHER, 30, 12);
    const context = canvas?.getContext();
    if (canvas && context) {
      // A vane tapering to the tip, with a darker shaft down the middle.
      context.fillStyle = 'rgba(255,255,255,0.95)';
      context.beginPath();
      context.moveTo(1, 6);
      context.quadraticCurveTo(10, -2, 29, 6);
      context.quadraticCurveTo(10, 14, 1, 6);
      context.fill();
      context.strokeStyle = 'rgba(70,70,80,0.75)';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, 6);
      context.lineTo(29, 6);
      context.stroke();
      canvas.refresh();
    }
  }
  return { glow: GLOW, streak: STREAK, ring: RING, feather: FEATHER };
}

function addLights(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, lights: readonly Light[], animate: boolean) {
  lights.forEach(([x, y, color, radius], index) => {
    const halo = scene.add.image(x, y, GLOW).setTint(color).setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(radius * 4, radius * 4).setAlpha(0.3);
    const core = scene.add.image(x, y, GLOW).setTint(color).setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(radius * 1.3, radius * 1.3).setAlpha(0.6);
    layer.add([halo, core]);
    if (!animate) return;
    if (color === BEACON) {
      // Aviation beacons: a slow, staggered blink.
      halo.setAlpha(0.08);
      core.setAlpha(0.15);
      scene.tweens.add({
        targets: [halo, core], alpha: { from: 0.1, to: 0.85 }, duration: 240, hold: 160, yoyo: true,
        repeat: -1, repeatDelay: 1100 + (index % 5) * 170, delay: (index * 370) % 1700, ease: 'Sine.easeInOut',
      });
      return;
    }
    // Lamps and panels breathe gently and out of phase.
    scene.tweens.add({
      targets: halo, alpha: { from: 0.2, to: 0.36 }, duration: 900 + (index * 230) % 800,
      yoyo: true, repeat: -1, delay: (index * 310) % 900, ease: 'Sine.easeInOut',
    });
  });
}

function addWeather(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, plan: StagePlan) {
  const { width, height } = scene.scale.gameSize;
  if (plan.fog) {
    [0.34, 0.62].forEach((band, index) => {
      const fog = scene.add.image(width * (0.3 + index * 0.4), height * band, GLOW).setTint(plan.fog)
        .setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(width * 1.5, height * 0.5).setAlpha(0.1);
      layer.add(fog);
      scene.tweens.add({
        targets: fog, x: fog.x + (index ? -150 : 150), alpha: 0.16, duration: 9000 + index * 2600,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    });
  }
  if (plan.rain > 0) {
    const lean = Math.tan(Phaser.Math.DegToRad(plan.wind));
    layer.add(scene.add.particles(0, 0, STREAK, {
      x: { min: (plan.left ?? 0) - 40, max: width + height * lean + 40 }, y: -50,
      lifespan: 640,
      speedY: { min: 1080, max: 1320 }, speedX: { min: -1320 * lean, max: -1080 * lean },
      scaleX: 0.6, scaleY: { min: 0.6, max: 1.25 }, rotate: plan.wind,
      alpha: { min: 0.1, max: 0.3 }, tint: 0xbcd4ff,
      frequency: 18, quantity: Math.max(1, Math.round(3 * plan.rain)),
      blendMode: Phaser.BlendModes.ADD,
    }));
    // Splash rings where the rain lands on the open floor.
    layer.add(scene.add.particles(0, 0, RING, {
      x: { min: (plan.left ?? 0) + 150, max: width - 150 }, y: { min: height * (plan.left ? 0.6 : 0.3), max: height * (plan.left ? 0.92 : 0.74) },
      lifespan: 560,
      scaleX: { start: 0.06, end: 0.5 }, scaleY: { start: 0.02, end: 0.17 },
      alpha: { start: 0.34, end: 0 }, tint: 0xa9c8ff,
      frequency: Math.round(110 / plan.rain), quantity: 1,
      blendMode: Phaser.BlendModes.ADD,
    }));
  }
  if (plan.motes > 0) {
    layer.add(scene.add.particles(0, 0, GLOW, {
      x: { min: 40, max: width - 40 }, y: { min: height * 0.25, max: height * 0.7 },
      lifespan: { min: 2600, max: 4200 },
      speedY: { min: -26, max: -10 }, speedX: { min: -14, max: 14 },
      scale: { start: 0.1, end: 0.02 }, alpha: { start: 0.75, end: 0 }, tint: WARM,
      frequency: Math.round(260 / plan.motes), quantity: 1,
      blendMode: Phaser.BlendModes.ADD,
    }));
  }
}

function gradeBackdrop(scene: Phaser.Scene, backdrop: Phaser.GameObjects.Container) {
  if (!spectacleFiltersEnabled(scene) || backdrop.getData('spectacle-graded')) return;
  backdrop.setData('spectacle-graded', true);
  backdrop.enableFilters();
  backdrop.filtersFocusContext = true;
  const filters = backdrop.filters?.internal;
  if (!filters) return;
  // Bloom: lift only the lit parts of the painting (lamps, windows, wet
  // reflections) and let them bleed softly into the night around them.
  const bloom = filters.addParallelFilters();
  bloom.top.addThreshold(0.42, 0.9);
  bloom.top.addBlur(1, 2, 2, 1.6);
  bloom.blend.blendMode = Phaser.BlendModes.ADD;
  bloom.blend.amount = 0.85;
  const grade = filters.addColorMatrix();
  grade.colorMatrix.saturate(0.18);
  grade.colorMatrix.contrast(0.08, true);
}

/** Boss fights are fought under a storm: irregular double-flashes of sheet
 * lightning. Follows the Flash Effects preference. */
function addLightning(scene: Phaser.Scene, layer: Phaser.GameObjects.Container) {
  const { width, height } = scene.scale.gameSize;
  const sheet = scene.add.rectangle(width / 2, height / 2, width, height, 0xbcd4ff, 1)
    .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setName('spectacle-lightning');
  layer.add(sheet);
  const strike = () => {
    if (!sheet.active) return;
    if (!flashEffectsState(prefersReducedMotion()).reduced) {
      scene.tweens.add({ targets: sheet, alpha: { from: 0.2, to: 0 }, duration: 130, repeat: 1, repeatDelay: 70, ease: 'Quad.easeOut' });
    }
    scene.time.delayedCall(Phaser.Math.Between(7000, 15000), strike);
  };
  scene.time.delayedCall(Phaser.Math.Between(2500, 6000), strike);
}

function dressBattle(scene: Phaser.Scene) {
  let signature = '';
  let layer: Phaser.GameObjects.Container | undefined;
  const clear = () => {
    if (!layer) return;
    scene.tweens.killTweensOf(layer.list);
    layer.destroy();
    layer = undefined;
  };
  const sync = () => {
    const backdrop = (scene as unknown as { backdropLayer?: Phaser.GameObjects.Container }).backdropLayer;
    const painting = backdrop?.active ? backdrop.list[0] as Phaser.GameObjects.Image | undefined : undefined;
    const key = painting?.texture?.key ?? '';
    const lean = prefersLeanEffects(), reduced = prefersReducedMotion();
    const next = key && !lean ? `${key}|${reduced}` : '';
    if (next === signature && (!next || layer?.active)) return;
    signature = next;
    clear();
    if (!next || !backdrop) return;
    ensureSpectacleTextures(scene);
    const plan = STAGES[key] ?? FALLBACK_STAGE;
    layer = scene.add.container(0, 0).setDepth(AMBIENT_DEPTH).setName('spectacle-ambient');
    addLights(scene, layer, plan.lights, !reduced);
    if (!reduced) addWeather(scene, layer, plan);
    gradeBackdrop(scene, backdrop);
    if (!reduced && /boss/.test(key)) addLightning(scene, layer);
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, sync);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, sync);
    clear();
  });
}

type BattleRead = {
  mode?: string; selectedInstanceId?: string; selectedEnemyId?: string;
  hand?: Array<{ instanceId: string }>; enemies?: Array<{ id: string; hp: number }>;
  handCardRects?: Map<string, Phaser.GameObjects.Rectangle>;
  handLayer?: Phaser.GameObjects.Container;
  activeCardContract?: (card: unknown) => { effects: string[] };
  enemyView?: (enemy: unknown) => { x: number; y: number };
};

/** A travelling dotted arc from the chosen card to its target. Read-only: it
 * mirrors the selection the scene already holds and draws nothing otherwise. */
function dressTargeting(scene: Phaser.Scene) {
  const battle = scene as unknown as BattleRead;
  const arc = scene.add.graphics().setDepth(31).setName('spectacle-target-arc');
  const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(), new Phaser.Math.Vector2(), new Phaser.Math.Vector2());
  const point = new Phaser.Math.Vector2();
  const draw = (time: number) => {
    arc.clear();
    if (prefersLeanEffects() || battle.mode !== 'battle' || !battle.handLayer?.visible) return;
    const card = battle.hand?.find(candidate => candidate.instanceId === battle.selectedInstanceId);
    const rect = card && battle.handCardRects?.get(card.instanceId);
    const enemy = battle.enemies?.find(candidate => candidate.id === battle.selectedEnemyId && candidate.hp > 0);
    if (!card || !rect?.active || !enemy || !battle.activeCardContract || !battle.enemyView) return;
    if (!battle.activeCardContract(card).effects.some(effect => /damage|winded|expos|pin|strip/i.test(effect))) return;
    const to = battle.enemyView(enemy);
    const fromY = rect.y - rect.height / 2 - 4;
    curve.p0.set(rect.x, fromY);
    curve.p2.set(to.x, to.y + 6);
    curve.p1.set((rect.x + to.x) / 2, Math.min(fromY, to.y) - 90);
    const phase = prefersReducedMotion() ? 0 : (time / 900) % 1;
    const dots = 18;
    for (let index = 0; index < dots; index += 1) {
      const t = (index + phase) / dots;
      curve.getPoint(t, point);
      arc.fillStyle(0x8df4ff, 0.25 + t * 0.6);
      arc.fillCircle(point.x, point.y, 2 + t * 2.4);
    }
    arc.lineStyle(2, 0x8df4ff, 0.9);
    arc.strokeCircle(to.x, to.y + 6, 9 + Math.sin(time / 180) * (prefersReducedMotion() ? 0 : 1.5));
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, draw);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, draw);
    arc.destroy();
  });
}

/** Drain the colour from a lost fight; warm a won one. */
function dressOutcomeGrade(scene: Phaser.Scene) {
  if (!spectacleFiltersEnabled(scene)) return;
  const battle = scene as unknown as BattleRead;
  let graded = '';
  let filter: Phaser.Filters.ColorMatrix | undefined;
  const sync = () => {
    const mode = battle.mode === 'defeat' || battle.mode === 'runComplete' ? battle.mode : '';
    if (mode === graded) return;
    graded = mode;
    filter?.destroy();
    filter = undefined;
    if (!mode) return;
    filter = scene.cameras.main.filters.internal.addColorMatrix();
    if (mode === 'defeat') filter.colorMatrix.saturate(-0.65);
    else filter.colorMatrix.saturate(0.2);
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, sync);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, sync);
    filter?.destroy();
  });
}

function findImage(scene: Phaser.Scene, match: (image: Phaser.GameObjects.Image) => boolean) {
  let found: Phaser.GameObjects.Image | undefined;
  const visit = (object: Phaser.GameObjects.GameObject, depth: number) => {
    if (found) return;
    if (object instanceof Phaser.GameObjects.Image && match(object)) found = object;
    else if (depth < 2 && object instanceof Phaser.GameObjects.Container) object.list.forEach(child => visit(child, depth + 1));
  };
  scene.children.list.forEach(child => visit(child, 0));
  return found;
}

function bloom(scene: Phaser.Scene, object: Phaser.GameObjects.Image, amount: number) {
  if (!spectacleFiltersEnabled(scene) || object.getData('spectacle-graded')) return;
  object.setData('spectacle-graded', true);
  object.enableFilters();
  const filters = object.filters?.internal;
  if (!filters) return;
  const glow = filters.addParallelFilters();
  glow.top.addThreshold(0.5, 0.92);
  glow.top.addBlur(1, 2, 2, 1.5);
  glow.blend.blendMode = Phaser.BlendModes.ADD;
  glow.blend.amount = amount;
}

/** Place a layer directly above one object, wherever that object lives. */
function layerAbove(scene: Phaser.Scene, object: Phaser.GameObjects.GameObject) {
  const layer = scene.add.container(0, 0).setName('spectacle-ambient');
  const parent = object.parentContainer;
  if (parent) parent.addAt(layer, parent.getIndex(object) + 1);
  else {
    layer.setDepth((object as unknown as Phaser.GameObjects.Components.Depth).depth);
    scene.children.moveAbove(layer as Phaser.GameObjects.GameObject, object);
  }
  return layer;
}

const NEON = 0xff4fa3;
// Authored against the title splash: the signal lamp, the neon signs, the
// horizon and the two puddles the birds stand in.
const TITLE_PLAN: StagePlan = {
  rain: 0.5, motes: 0, fog: 0, wind: 9, left: 520,
  lights: [[1158, 222, PANEL, 46], [1252, 236, NEON, 60], [1222, 394, NEON, 40], [797, 468, PANEL, 54],
    [1043, 592, PANEL, 60], [700, 372, WARM, 90]],
};

function dressBackdropScene(scene: Phaser.Scene, match: (image: Phaser.GameObjects.Image) => boolean, plan: StagePlan, bloomAmount: number) {
  let painting: Phaser.GameObjects.Image | undefined;
  let layer: Phaser.GameObjects.Container | undefined;
  let signature = '';
  const clear = () => {
    if (layer) { scene.tweens.killTweensOf(layer.list); layer.destroy(); }
    layer = undefined;
  };
  const sync = () => {
    if (!painting?.active) painting = findImage(scene, match);
    const lean = prefersLeanEffects(), reduced = prefersReducedMotion();
    const next = painting && !lean ? `${painting.texture.key}|${reduced}` : '';
    if (next === signature && (!next || layer?.active)) return;
    signature = next;
    clear();
    if (!next || !painting) return;
    ensureSpectacleTextures(scene);
    layer = layerAbove(scene, painting);
    addLights(scene, layer, plan.lights, !reduced);
    if (!reduced) addWeather(scene, layer, plan);
    bloom(scene, painting, bloomAmount);
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, sync);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, sync);
    clear();
    painting = undefined;
    signature = '';
  });
}

const GRAIN = 'spectacle-grain';

/** A fine, shifting film grain over the whole frame binds painted art and
 * vector panels into one image. Still under Reduced Motion; absent when Lean. */
function filmGrain(scene: Phaser.Scene) {
  if (prefersLeanEffects()) return;
  if (!scene.textures.exists(GRAIN)) {
    const canvas = scene.textures.createCanvas(GRAIN, 128, 128);
    const context = canvas?.getContext();
    if (!canvas || !context) return;
    const pixels = context.createImageData(128, 128);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const value = Math.random() < 0.5 ? 0 : 255;
      pixels.data[index] = pixels.data[index + 1] = pixels.data[index + 2] = value;
      pixels.data[index + 3] = Math.floor(Math.random() * 255);
    }
    context.putImageData(pixels, 0, 0);
    canvas.refresh();
  }
  const { width, height } = scene.scale.gameSize;
  const grain = scene.add.tileSprite(width / 2, height / 2, width, height, GRAIN)
    .setAlpha(0.045).setDepth(9500).setName('spectacle-grain');
  if (prefersReducedMotion()) return;
  scene.time.addEvent({
    delay: 90, loop: true,
    callback: () => { if (grain.active) grain.setTilePosition(Math.random() * 128, Math.random() * 128); },
  });
}

/** A soft band of light crossing the screen as a scene arrives. */
function arrivalSweep(scene: Phaser.Scene) {
  if (prefersLeanEffects() || prefersReducedMotion()) return;
  ensureSpectacleTextures(scene);
  const { width, height } = scene.scale.gameSize;
  const band = scene.add.image(-width * 0.3, height / 2, GLOW).setBlendMode(Phaser.BlendModes.ADD)
    .setDisplaySize(width * 0.6, height * 2.6).setAngle(18).setTint(0xffe1a3).setAlpha(0.13)
    .setDepth(9000).setName('spectacle-arrival-sweep');
  scene.tweens.add({
    targets: band, x: width * 1.3, alpha: 0.02, duration: 520, ease: 'Quad.easeOut',
    onComplete: () => band.destroy(),
  });
}

const isBackdrop = (image: Phaser.GameObjects.Image) => image.displayWidth >= 1200 && image.displayHeight >= 650;

const DRESSERS: Record<string, (scene: Phaser.Scene) => void> = {
  BattleScene: (scene) => { dressBattle(scene); dressTargeting(scene); dressOutcomeGrade(scene); },
  MenuScene: (scene) => dressBackdropScene(scene, image => image.texture.key === 'splash' && isBackdrop(image), TITLE_PLAN, 0.6),
  RouteScene: (scene) => dressBackdropScene(scene, isBackdrop, { ...FALLBACK_STAGE, rain: 0.35 }, 0.7),
};

const PANEL_RADIUS = 8;

/** Soften every authored panel and control in one place. Hairlines, meters
 * and full-screen shades stay square; an explicit `setRounded` still wins. */
function roundPanels() {
  const factory = Phaser.GameObjects.GameObjectFactory.prototype;
  const rectangle = factory.rectangle;
  factory.rectangle = function (this: Phaser.GameObjects.GameObjectFactory, x?: number, y?: number,
    width?: number, height?: number, fillColor?: number, fillAlpha?: number) {
    const shape = rectangle.call(this, x, y, width, height, fillColor, fillAlpha);
    const { width: stageWidth, height: stageHeight } = this.scene.scale.gameSize;
    const w = width ?? 0, h = height ?? 0;
    if (w >= 40 && h >= 24 && w < stageWidth - 8 && h < stageHeight - 8) {
      shape.setRounded(Math.min(PANEL_RADIUS, h / 3));
    }
    return shape;
  };
}

/** Phaser sizes each line by scanning rendered glyphs, so a new typeface
 * shifts line heights by a pixel either way. Authored layouts were measured
 * against the system fallback; keep those line metrics and draw with the new
 * glyphs. Advance widths still come from the face actually drawn. */
function keepAuthoredLineMetrics() {
  type Metrics = Phaser.Types.GameObjects.Text.TextMetrics;
  type Style = {
    fontFamily: string; fontStyle: string; fontSize: string; _font: string; metrics: Metrics;
    parent: Phaser.GameObjects.Text;
    setStyle: (source: unknown, updateText?: boolean, setDefaults?: boolean) => unknown;
    update: (recalculate: boolean) => unknown;
  };
  const style = Phaser.GameObjects.TextStyle.prototype as unknown as Style;
  const cache = new Map<string, Metrics>();
  const authored = (target: Style) => {
    const family = String(target.fontFamily);
    const cut = /^BirdSquad(?:UI|Display), /.exec(family);
    if (!cut) return false;
    const font = [target.fontStyle, target.fontSize, family.slice(cut[0].length)].join(' ').trim();
    let metrics = cache.get(font);
    if (!metrics) {
      const probe = Object.create(target) as Style;
      probe._font = font;
      metrics = Phaser.GameObjects.MeasureText(probe as unknown as Phaser.GameObjects.TextStyle);
      cache.set(font, metrics);
    }
    target.metrics = { ...metrics };
    return true;
  };
  const { setStyle, update } = style;
  style.setStyle = function (this: Style, source: unknown, updateText?: boolean, setDefaults?: boolean) {
    const result = setStyle.call(this, source, updateText, setDefaults);
    if (authored(this) && (updateText ?? true)) this.parent.updateText();
    return result;
  };
  style.update = function (this: Style, recalculate: boolean) {
    const result = update.call(this, recalculate);
    if (recalculate && authored(this)) this.parent.updateText();
    return result;
  };
}

/** Adopt every scene, including ones registered later, and dress it each time
 * it is created. Safe to call once per game. */
export function installSpectacle(game: Phaser.Game) {
  roundPanels();
  keepAuthoredLineMetrics();
  const adopted = new WeakSet<Phaser.Scene>();
  const adopt = (scene: Phaser.Scene) => {
    if (adopted.has(scene)) return;
    adopted.add(scene);
    const dress = (arriving: boolean) => {
      DRESSERS[scene.scene.key]?.(scene);
      if (arriving && scene.scene.key !== 'BootScene') arrivalSweep(scene);
      if (scene.scene.key !== 'BootScene') filmGrain(scene);
    };
    scene.events.on(Phaser.Scenes.Events.CREATE, () => dress(true));
    if (scene.sys.isActive()) dress(false);
  };
  const scan = () => game.scene.scenes.forEach(adopt);
  scan();
  game.events.on(Phaser.Core.Events.STEP, scan);
}

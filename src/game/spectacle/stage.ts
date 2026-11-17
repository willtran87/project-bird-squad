import Phaser from 'phaser';
import { prefersReducedMotion } from '../../main';
import { prefersLeanEffects } from '../graphics-quality';

/**
 * Living-stage dressing: light, weather and bloom layered over the authored
 * scenes. Everything here is additive presentation. It owns its own display
 * objects, never touches game state, and disappears entirely under Lean
 * graphics; Reduced Motion keeps the still lighting and drops all movement.
 */

const GLOW = 'spectacle-glow';
const STREAK = 'spectacle-streak';
const RING = 'spectacle-ring';
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
  return { glow: GLOW, streak: STREAK, ring: RING };
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
      x: { min: -40, max: width + height * lean + 40 }, y: -50,
      lifespan: 640,
      speedY: { min: 1080, max: 1320 }, speedX: { min: -1320 * lean, max: -1080 * lean },
      scaleX: 0.6, scaleY: { min: 0.6, max: 1.25 }, rotate: plan.wind,
      alpha: { min: 0.1, max: 0.3 }, tint: 0xbcd4ff,
      frequency: 18, quantity: Math.max(1, Math.round(3 * plan.rain)),
      blendMode: Phaser.BlendModes.ADD,
    }));
    // Splash rings where the rain lands on the open floor.
    layer.add(scene.add.particles(0, 0, RING, {
      x: { min: 150, max: width - 150 }, y: { min: height * 0.3, max: height * 0.74 },
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
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, sync);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, sync);
    clear();
  });
}

const DRESSERS: Record<string, (scene: Phaser.Scene) => void> = {
  BattleScene: dressBattle,
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

/** Adopt every scene, including ones registered later, and dress it each time
 * it is created. Safe to call once per game. */
export function installSpectacle(game: Phaser.Game) {
  roundPanels();
  const adopted = new WeakSet<Phaser.Scene>();
  const adopt = (scene: Phaser.Scene) => {
    if (adopted.has(scene)) return;
    adopted.add(scene);
    const dress = DRESSERS[scene.scene.key];
    if (!dress) return;
    scene.events.on(Phaser.Scenes.Events.CREATE, () => dress(scene));
    if (scene.sys.isActive()) dress(scene);
  };
  const scan = () => game.scene.scenes.forEach(adopt);
  scan();
  game.events.on(Phaser.Core.Events.STEP, scan);
}

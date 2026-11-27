import Phaser from 'phaser';
import { graphicsQualityState } from './graphics-quality';
import { renderRatioFor } from './frame-rules';

export { MAX_RENDER_RATIO } from './frame-rules';

/**
 * Device-pixel-ratio rendering for Phaser 4.1's WebGL renderer.
 *
 * Phaser 4.1 has no renderer resolution: the canvas backing store is always
 * the game size (1280x720) and FIT scales it with CSS, so a DPR 2 display
 * shows every edge stretched 2x. This raises only the backing store. Game
 * space is untouched: `scale.gameSize`, `pointer.x/y` (Phaser maps pointers
 * through the CSS box, not the backing store), cameras, object positions and
 * `getBounds` keep their 1280x720 values.
 *
 * How (Phaser 4.1 source, `renderer/webgl`):
 *  - Every draw to the canvas goes through a `DrawingContext` with
 *    `useCanvas: true` (the renderer's `baseDrawingContext` and its per-camera
 *    clones). Its `width`/`height` feed the projection matrix and stay in game
 *    units; only its GL `viewport` and `scissor` box are scaled to device
 *    pixels. Framebuffer contexts (filters, render textures) are unchanged.
 *  - `snapshot*` reads the drawing buffer, so canvas captures scale their area.
 *
 * The ratio follows the canvas's displayed size: device pixels per game pixel,
 * in steps of 0.25, between 1 and `maxRatio` (2) and the quality tier's cap
 * (1 under Lean or the trimmed automatic tier).
 */

type CanvasContext = {
  useCanvas: boolean;
  width: number;
  height: number;
  renderer: unknown;
  state: { viewport: number[]; scissor: { box: number[] } };
  resize: (width: number, height: number) => void;
  setScissorBox: (x: number, y: number, width: number, height: number) => void;
};

type SnapshotState = {
  callback: unknown; isFramebuffer?: boolean;
  x: number; y: number; width: number; height: number;
};

type Renderer = Phaser.Renderer.WebGL.WebGLRenderer & {
  baseDrawingContext: CanvasContext;
  snapshotState: SnapshotState;
};

let installed: { renderer: Renderer; ratio: () => number } | undefined;

export function renderResolutionState() {
  const renderer = installed?.renderer;
  const canvas = renderer?.canvas;
  return {
    ratio: installed?.ratio() ?? 1,
    backingWidth: canvas?.width ?? 0,
    backingHeight: canvas?.height ?? 0,
    gameWidth: renderer?.width ?? 0,
    gameHeight: renderer?.height ?? 0,
  };
}

/** Install once, after the game has booted. Canvas renderers are left alone. */
export function installRenderResolution(game: Phaser.Game) {
  if (installed || game.renderer.type !== Phaser.WEBGL) return;
  const renderer = game.renderer as Renderer;
  let ratio = 1;
  installed = { renderer, ratio: () => ratio };

  const scaled = (value: number) => Math.round(value * ratio);
  const proto = Object.getPrototypeOf(renderer.baseDrawingContext) as CanvasContext;
  const { resize, setScissorBox } = proto;
  proto.resize = function (this: CanvasContext, width: number, height: number) {
    resize.call(this, width, height);
    if (this.useCanvas && this.renderer === renderer && ratio !== 1) {
      this.state.viewport = [0, 0, scaled(this.width), scaled(this.height)];
      this.state.scissor.box = [0, 0, scaled(this.width), scaled(this.height)];
    }
  };
  proto.setScissorBox = function (this: CanvasContext, x: number, y: number, width: number, height: number) {
    if (!this.useCanvas || this.renderer !== renderer || ratio === 1) {
      setScissorBox.call(this, x, y, width, height);
      return;
    }
    // Same flip as Phaser (GL's origin is bottom-left), in device pixels.
    const left = scaled(x), right = scaled(x + width);
    const bottom = scaled(this.height - y - height), top = scaled(this.height - y);
    this.state.scissor.box = [left, bottom, right - left, top - bottom];
  };
  // The renderer bound the base context's original `resize` to its RESIZE
  // event at boot; route that event through the patched method instead.
  const base = renderer.baseDrawingContext;
  renderer.off(Phaser.Renderer.Events.RESIZE, resize, base);
  renderer.on(Phaser.Renderer.Events.RESIZE, (width: number, height: number) => base.resize(width, height));

  // Captures: area arguments are in game pixels; the drawing buffer is not.
  const snapshotArea = renderer.snapshotArea;
  renderer.snapshotArea = function (this: Renderer, ...args: Parameters<Renderer['snapshotArea']>) {
    const result = snapshotArea.apply(this, args);
    this.snapshotState.isFramebuffer = false;
    return result;
  };
  renderer.snapshot = function (this: Renderer, callback, type, encoderOptions) {
    return this.snapshotArea(0, 0, this.width, this.height, callback, type, encoderOptions);
  };
  const postRender = renderer.postRender;
  renderer.postRender = function (this: Renderer) {
    const state = this.snapshotState;
    if ((state.callback as unknown) && !state.isFramebuffer && ratio !== 1) {
      state.x = scaled(state.x);
      state.y = scaled(state.y);
      state.width = scaled(state.width);
      state.height = scaled(state.height);
    }
    return postRender.call(this);
  };

  // Automated browsers render with software GL, where a larger backing store
  // is pure fill cost (4x the pixels in a 2560-wide window). They stay at 1x
  // unless a test opts in with ?highDpi=on, like the frame governor.
  const requested = new URLSearchParams(window.location.search).get('highDpi');
  const automationCap = requested === 'on' ? Infinity : requested === 'off' || navigator.webdriver ? 1 : Infinity;
  const apply = () => {
    const quality = graphicsQualityState();
    const cap = Math.min(quality.renderRatioCap, automationCap);
    const shown = game.scale.displaySize.width || game.canvas.getBoundingClientRect().width;
    const next = renderRatioFor(window.devicePixelRatio || 1, shown, game.scale.baseSize.width, cap);
    const width = Math.round(game.scale.baseSize.width * next), height = Math.round(game.scale.baseSize.height * next);
    if (next === ratio && game.canvas.width === width && game.canvas.height === height) return;
    ratio = next;
    // Resizing the canvas clears it; the next frame redraws everything.
    game.canvas.width = width;
    game.canvas.height = height;
    renderer.resize(renderer.width, renderer.height);
  };
  (window as unknown as Record<string, unknown>).__birdSquadRenderResolution = renderResolutionState;
  game.scale.on(Phaser.Scale.Events.RESIZE, apply);
  // Settings, the automatic quality step and monitor changes can all move the
  // ratio; checking costs a few comparisons per frame.
  game.events.on(Phaser.Core.Events.PRE_STEP, apply);
  apply();
}

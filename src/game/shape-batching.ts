import Phaser from 'phaser';

/**
 * Draw flat shapes (Rectangle, rounded panels, Graphics, strokes) in the same
 * batch as images and text.
 *
 * Phaser 4.1 sends shape triangles to `BatchHandlerTriFlat` and textured quads
 * to `BatchHandlerQuad`: two shader programs. Our screens interleave them
 * (panel, label, panel, label...), so every change flushed a batch: about 90
 * draw calls and as many program switches per idle frame.
 *
 * Here each flat triangle is written into the quad batch as a degenerate quad
 * (its third corner repeated) sampling the renderer's 4x4 white texture with
 * the FILL tint mode. Phaser's quad shader then outputs
 * `vec4(tint.bgr * tint.a, tint.a)`, exactly what the flat shader outputs for
 * the same packed tint, so the pixels are unchanged; the batches just stop
 * breaking. Lit shapes (`lighting`) keep the original path.
 *
 * Hardware GL only. A software rasteriser (SwiftShader, llvmpipe: headless
 * test browsers) shades every fragment on the CPU and evaluates the batch's
 * whole sampler chain per pixel, so long multi-texture batches cost far more
 * there than the draw calls they save; measured, the idle combat frame went
 * from about 90 to about 165 ms. `?shapeBatch=on` forces it on anywhere and
 * `?shapeBatch=off` turns it off anywhere, for comparison.
 *
 * Longer batches exposed a Phaser 4.1 shader fault, fixed here for every
 * multi-texture batch: the quad shader picks its sampler with
 * `outTexDatum == float(INDEX)`, an exact comparison on an interpolated
 * varying. Software GL (SwiftShader) interpolates the constant to values such
 * as 4.9999995 in some triangles, so the lookup falls through to transparent
 * and patches of text vanish. The same lookup now compares against the
 * half-way points, which is exact for any interpolation error under 0.5.
 */

const TINT_FILL = 1;

type FlatBatch = (context: unknown, indexes: number[], vertices: number[], colors: number[], lighting?: unknown) => void;
type QuadBatch = (context: unknown, texture: unknown,
  x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number,
  u: number, v: number, uw: number, vh: number, tintMode: number,
  tintTL: number, tintBL: number, tintTR: number, tintBR: number, options: unknown) => void;

let installed = false;
let shapesBatched = false;

/** Whether flat shapes share the image batch in this session. */
export function shapeBatchingActive() {
  return shapesBatched;
}

function softwareRenderer(gl: WebGLRenderingContext) {
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const name = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  return /swiftshader|llvmpipe|software|basic render/i.test(name);
}

type Addition = { name: string; tags?: string[]; additions?: Record<string, string> };

/** Rewrite a `GetTexture<N>` shader addition to choose its sampler by range. */
export function robustTextureLookup(addition: Addition): Addition {
  const header = addition.additions?.fragmentHeader;
  if (!addition.tags?.includes('TEXTURE') || !header || !/^GetTexture\d+$/.test(addition.name)) return addition;
  return {
    ...addition,
    // A new name: compiled programs are cached by addition names.
    name: `${addition.name}Ranged`,
    additions: {
      ...addition.additions,
      fragmentHeader: header
        .replace('if (outTexDatum == 0.0)', 'if (outTexDatum < 0.5)')
        .replace('else if (outTexDatum == float(INDEX))', 'else if (outTexDatum < float(INDEX) + 0.5)'),
    },
  };
}

function installRobustTextureLookup(nodes: unknown[]) {
  type Manager = {
    replaceAddition: (name: string, addition: Addition) => void;
    currentConfig: { additions: Addition[] };
    getAdditionsByTag: (tag: string) => Addition[];
  };
  const managers = nodes.map(node => (node as { programManager?: Manager } | undefined)?.programManager).filter(Boolean) as Manager[];
  if (!managers.length) return;
  const proto = Object.getPrototypeOf(managers[0]) as Manager;
  const replaceAddition = proto.replaceAddition;
  proto.replaceAddition = function (this: Manager, name: string, addition: Addition) {
    replaceAddition.call(this, name, robustTextureLookup(addition));
  };
  // Additions installed before this patch.
  for (const manager of managers) {
    manager.currentConfig.additions = manager.currentConfig.additions.map(robustTextureLookup);
  }
}

export function installShapeBatching(game: Phaser.Game) {
  if (installed || game.renderer.type !== Phaser.WEBGL) return;
  const renderer = game.renderer as Phaser.Renderer.WebGL.WebGLRenderer & {
    renderNodes: { getNode: (name: string) => unknown };
    whiteTexture: unknown;
  };
  const flat = renderer.renderNodes.getNode('BatchHandlerTriFlat') as unknown as { batch: FlatBatch } | undefined;
  const quad = renderer.renderNodes.getNode('BatchHandlerQuad') as unknown as { batch: QuadBatch } | undefined;
  if (!flat || !quad || !renderer.whiteTexture) return;
  installed = true;
  (window as unknown as Record<string, unknown>).__birdSquadShapeBatching = shapeBatchingActive;
  installRobustTextureLookup([quad, renderer.renderNodes.getNode('BatchHandlerTileSprite'), renderer.renderNodes.getNode('BatchHandlerQuadSingle')]);
  const requested = new URLSearchParams(window.location.search).get('shapeBatch');
  if (requested === 'off' || (requested !== 'on' && softwareRenderer(renderer.gl))) return;
  shapesBatched = true;
  const white = renderer.whiteTexture;
  // The options every plain image submits, so no shader variant changes.
  const options = { multiTexturing: true, lighting: null, smoothPixelArt: game.config.smoothPixelArt ?? null };
  const original = flat.batch;
  flat.batch = function (this: unknown, context, indexes, vertices, colors, lighting) {
    if (lighting) { original.call(this, context, indexes, vertices, colors, lighting); return; }
    for (let i = 0; i + 2 < indexes.length; i += 3) {
      const a = indexes[i], b = indexes[i + 1], c = indexes[i + 2];
      const ca = colors[a], cb = colors[b], cc = colors[c];
      // Corners in Phaser's order: top-left, bottom-left, top-right, bottom-right.
      // The strip draws (bottom-left, top-left, bottom-right) = (a, b, c), and
      // a zero-area second triangle.
      quad.batch(context, white,
        vertices[b * 2], vertices[b * 2 + 1],
        vertices[a * 2], vertices[a * 2 + 1],
        vertices[c * 2], vertices[c * 2 + 1],
        vertices[c * 2], vertices[c * 2 + 1],
        0.5, 0.5, 0, 0, TINT_FILL,
        cb, ca, cc, cc, options);
    }
  };
}

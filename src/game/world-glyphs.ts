import type Phaser from 'phaser';
import { tarotMark, type TarotSuit } from './tarot-rules';
import { SUIT_COLORS, UI_DISPLAY_FONT } from './theme';

/**
 * Procedural icons drawn from the world rather than from a UI kit: suit sigils
 * (a plume, a basin, a quill nib, a woven nest, and a compass rose for the
 * majors) and route node signs (claw marks, a lantern, a crate...). Each is
 * drawn once per size into a canvas texture at 2x, so it stays crisp at
 * 1000x560. No image files. Lazy: never part of boot.
 */

type Ctx = CanvasRenderingContext2D;
const S = 2;

export const TAROT_COLORS: Record<TarotSuit, number> = { ...SUIT_COLORS, major: 0xf0c36f };

export const ROUTE_GLYPH_COLORS: Record<string, number> = {
  street: 0xff9a7a, rival: 0xff6b8a, boss: 0xffd36b, basin: 0x8fd6ff,
  nest: 0xc9a6ff, market: 0x8fd6a0, signal: 0x8df4ff, cache: 0xe0b98a,
};

const css = (color: number, alpha = 1) => `rgba(${(color >> 16) & 255},${(color >> 8) & 255},${color & 255},${alpha})`;

/** Draw a suit sigil centred on (0, 0) inside a box of size `s`. */
export function drawSuitSigil(ctx: Ctx, suit: TarotSuit, s: number, color: number) {
  const u = s / 2;
  ctx.save();
  ctx.strokeStyle = css(color); ctx.fillStyle = css(color); ctx.lineWidth = Math.max(1.2, s * 0.09);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  switch (suit) {
    case 'plumes': {
      // A feather on the slant: vane, shaft and two barb notches.
      ctx.rotate(-0.6);
      ctx.beginPath(); ctx.moveTo(0, -u * 0.95);
      ctx.quadraticCurveTo(u * 0.55, -u * 0.3, u * 0.12, u * 0.55);
      ctx.lineTo(-u * 0.12, u * 0.55);
      ctx.quadraticCurveTo(-u * 0.55, -u * 0.3, 0, -u * 0.95); ctx.fill();
      ctx.strokeStyle = 'rgba(7,16,26,0.9)'; ctx.lineWidth = Math.max(1, s * 0.06);
      ctx.beginPath(); ctx.moveTo(0, -u * 0.7); ctx.lineTo(0, u * 0.5);
      ctx.moveTo(0, -u * 0.1); ctx.lineTo(u * 0.3, -u * 0.32); ctx.moveTo(0, u * 0.15); ctx.lineTo(-u * 0.28, -u * 0.05); ctx.stroke();
      ctx.strokeStyle = css(color); ctx.lineWidth = Math.max(1.2, s * 0.09);
      ctx.beginPath(); ctx.moveTo(0, u * 0.5); ctx.lineTo(0, u * 0.95); ctx.stroke();
      break;
    }
    case 'basins': {
      // A shallow basin with a falling drop above it.
      ctx.beginPath(); ctx.moveTo(-u * 0.85, -u * 0.05); ctx.lineTo(u * 0.85, -u * 0.05);
      ctx.quadraticCurveTo(u * 0.75, u * 0.75, 0, u * 0.75); ctx.quadraticCurveTo(-u * 0.75, u * 0.75, -u * 0.85, -u * 0.05); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -u * 0.95); ctx.quadraticCurveTo(u * 0.28, -u * 0.5, 0, -u * 0.35);
      ctx.quadraticCurveTo(-u * 0.28, -u * 0.5, 0, -u * 0.95); ctx.fill();
      break;
    }
    case 'quills': {
      // A pen nib, point down: the Quills cut.
      ctx.beginPath(); ctx.moveTo(-u * 0.5, -u * 0.9); ctx.lineTo(u * 0.5, -u * 0.9); ctx.lineTo(u * 0.55, -u * 0.15);
      ctx.lineTo(0, u * 0.95); ctx.lineTo(-u * 0.55, -u * 0.15); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(7,16,26,0.95)'; ctx.lineWidth = Math.max(1, s * 0.07);
      ctx.beginPath(); ctx.moveTo(0, -u * 0.1); ctx.lineTo(0, u * 0.7); ctx.stroke();
      ctx.fillStyle = 'rgba(7,16,26,0.95)'; ctx.beginPath(); ctx.arc(0, -u * 0.2, s * 0.08, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'nests': {
      // A woven ring of twigs.
      ctx.beginPath(); ctx.ellipse(0, u * 0.1, u * 0.85, u * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = Math.max(1, s * 0.07);
      for (const k of [-0.5, 0, 0.5]) {
        ctx.beginPath(); ctx.moveTo(-u * 0.85, u * (0.1 + k * 0.6)); ctx.quadraticCurveTo(0, u * (0.1 - k * 0.9), u * 0.85, u * (0.1 + k * 0.6)); ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(0, u * 0.05, u * 0.2, 0, Math.PI * 2); ctx.fill();
      break;
    }
    default: {
      // Majors: an eight-point compass rose, the wayfinder's mark.
      for (let i = 0; i < 8; i += 1) {
        const a = (Math.PI / 4) * i, r = i % 2 ? u * 0.55 : u * 0.98, w = u * 0.2;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.lineTo(Math.cos(a + Math.PI / 2) * w, Math.sin(a + Math.PI / 2) * w);
        ctx.lineTo(Math.cos(a - Math.PI / 2) * w, Math.sin(a - Math.PI / 2) * w); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = 'rgba(7,16,26,0.95)'; ctx.beginPath(); ctx.arc(0, 0, u * 0.14, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

/** Draw a route node sign centred on (0, 0) inside a box of size `s`. */
export function drawRouteGlyph(ctx: Ctx, type: string, s: number, color: number) {
  const u = s / 2;
  ctx.save();
  ctx.strokeStyle = css(color); ctx.fillStyle = css(color); ctx.lineWidth = Math.max(1.4, s * 0.1);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const line = (...points: number[]) => {
    ctx.beginPath(); ctx.moveTo(points[0] * u, points[1] * u);
    for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i] * u, points[i + 1] * u);
    ctx.stroke();
  };
  switch (type) {
    case 'street': // Fight: three claw marks.
      for (const k of [-0.42, 0, 0.42]) line(-0.55 + k, -0.75, 0.25 + k, 0.8);
      break;
    case 'rival': // Elite: a crew shield with a chevron.
      ctx.beginPath(); ctx.moveTo(-u * 0.75, -u * 0.8); ctx.lineTo(u * 0.75, -u * 0.8); ctx.lineTo(u * 0.75, 0);
      ctx.quadraticCurveTo(u * 0.7, u * 0.7, 0, u * 0.95); ctx.quadraticCurveTo(-u * 0.7, u * 0.7, -u * 0.75, 0); ctx.closePath(); ctx.stroke();
      line(-0.45, -0.2, 0, 0.25, 0.45, -0.2);
      break;
    case 'boss': // Boss: a heavy three-point crown over a bar.
      ctx.beginPath(); ctx.moveTo(-u * 0.85, u * 0.45); ctx.lineTo(-u * 0.85, -u * 0.55); ctx.lineTo(-u * 0.42, -u * 0.05);
      ctx.lineTo(0, -u * 0.85); ctx.lineTo(u * 0.42, -u * 0.05); ctx.lineTo(u * 0.85, -u * 0.55); ctx.lineTo(u * 0.85, u * 0.45); ctx.closePath(); ctx.fill();
      ctx.fillRect(-u * 0.85, u * 0.6, u * 1.7, u * 0.25);
      break;
    case 'basin': // Rest: a lantern on its hook.
      line(0, -0.95, 0, -0.75);
      ctx.beginPath(); ctx.moveTo(-u * 0.45, -u * 0.5); ctx.quadraticCurveTo(0, -u * 0.85, u * 0.45, -u * 0.5);
      ctx.lineTo(u * 0.5, u * 0.65); ctx.lineTo(-u * 0.5, u * 0.65); ctx.closePath(); ctx.stroke();
      line(-0.6, 0.85, 0.6, 0.85);
      ctx.beginPath(); ctx.moveTo(0, -u * 0.25); ctx.quadraticCurveTo(u * 0.25, u * 0.1, 0, u * 0.35); ctx.quadraticCurveTo(-u * 0.25, u * 0.1, 0, -u * 0.25); ctx.fill();
      break;
    case 'nest': // Event / workshop: an open-end wrench.
      ctx.save(); ctx.rotate(-Math.PI / 4);
      ctx.fillRect(-u * 0.14, -u * 0.35, u * 0.28, u * 1.25);
      ctx.beginPath(); ctx.arc(0, -u * 0.55, u * 0.38, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillRect(-u * 0.14, -u * 1.0, u * 0.28, u * 0.5);
      ctx.restore();
      break;
    case 'market': // Market: a scalloped stall awning over a counter.
      ctx.beginPath(); ctx.moveTo(-u * 0.9, -u * 0.25); ctx.lineTo(-u * 0.7, -u * 0.85); ctx.lineTo(u * 0.7, -u * 0.85); ctx.lineTo(u * 0.9, -u * 0.25);
      for (let i = 0; i < 4; i += 1) { const x0 = u * (0.9 - i * 0.45); ctx.quadraticCurveTo(x0 - u * 0.225, u * 0.15, x0 - u * 0.45, -u * 0.25); }
      ctx.closePath(); ctx.fill();
      line(-0.7, 0.85, 0.7, 0.85); line(-0.6, 0.1, -0.6, 0.85); line(0.6, 0.1, 0.6, 0.85);
      break;
    case 'signal': // Signal: a mast broadcasting both ways.
      line(0, -0.35, -0.35, 0.9); line(0, -0.35, 0.35, 0.9); line(-0.2, 0.35, 0.2, 0.35);
      ctx.beginPath(); ctx.arc(0, -u * 0.4, u * 0.14, 0, Math.PI * 2); ctx.fill();
      for (const r of [0.45, 0.75]) {
        ctx.beginPath(); ctx.arc(0, -u * 0.4, u * r, -Math.PI * 0.28, Math.PI * 0.28); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, -u * 0.4, u * r, Math.PI * 0.72, Math.PI * 1.28); ctx.stroke();
      }
      break;
    case 'cache': // Supply: a strapped crate.
      ctx.strokeRect(-u * 0.8, -u * 0.55, u * 1.6, u * 1.3);
      line(-0.8, -0.55, 0.8, 0.75); line(-0.8, -0.2, 0.8, -0.2);
      ctx.fillRect(-u * 0.12, -u * 0.85, u * 0.24, u * 0.35);
      break;
    default:
      ctx.beginPath(); ctx.arc(0, 0, u * 0.5, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

function canvasTexture(scene: Phaser.Scene, key: string, w: number, h: number, paint: (ctx: Ctx) => void) {
  if (scene.textures.exists(key)) return key;
  const texture = scene.textures.createCanvas(key, Math.ceil(w * S), Math.ceil(h * S));
  if (!texture) return undefined;
  const ctx = texture.context;
  ctx.scale(S, S);
  paint(ctx);
  texture.refresh();
  return key;
}

/** A route node sign on a small dark disc, `size` px across. */
export function routeGlyphTexture(scene: Phaser.Scene, type: string, size: number) {
  const color = ROUTE_GLYPH_COLORS[type] ?? 0xd8bd78;
  return canvasTexture(scene, `world-glyph-${type}-${size}`, size, size, (ctx) => {
    const r = size / 2;
    ctx.translate(r, r);
    ctx.fillStyle = 'rgba(6,17,26,0.94)'; ctx.beginPath(); ctx.arc(0, 0, r - 1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = css(color, 0.85); ctx.lineWidth = Math.max(1.2, size * 0.06); ctx.stroke();
    drawRouteGlyph(ctx, type, size * 0.56, color);
  });
}

export function addRouteGlyph(scene: Phaser.Scene, type: string, x: number, y: number, size: number) {
  const key = routeGlyphTexture(scene, type, size);
  return key ? scene.add.image(x, y, key).setDisplaySize(size, size).setData('routeNodeType', type) : undefined;
}

/**
 * The card's tarot mark as a small cartouche: suit sigil and numeral, `height`
 * px tall, no wider than `maxWidth` (the numeral alone when space is short).
 * Returns undefined for cards that carry no mark (Snags).
 */
export function addTarotMark(scene: Phaser.Scene, cardId: string, x: number, y: number, height: number, maxWidth = 200) {
  const mark = tarotMark(cardId);
  if (!mark) return undefined;
  const color = TAROT_COLORS[mark.suit];
  const font = `bold ${Math.round(height * 0.62)}px ${UI_DISPLAY_FONT}`;
  const probe = document.createElement('canvas').getContext('2d');
  if (!probe) return undefined;
  probe.font = font;
  const textW = Math.ceil(probe.measureText(mark.numeral).width);
  const pad = height * 0.32, sigil = height * 0.72, gap = height * 0.18;
  const withSigil = pad * 2 + sigil + gap + textW <= maxWidth;
  const width = Math.min(maxWidth, Math.ceil(withSigil ? pad * 2 + sigil + gap + textW : pad * 2 + textW));
  const key = canvasTexture(scene, `tarot-mark-${mark.suit}-${mark.numeral}-${height}-${width}`, width, height, (ctx) => {
    const r = Math.min(height / 2, 7);
    ctx.fillStyle = 'rgba(7,14,22,0.92)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(0.5, 0.5, width - 1, height - 1, r); else ctx.rect(0.5, 0.5, width - 1, height - 1);
    ctx.fill();
    ctx.strokeStyle = css(color, 0.9); ctx.lineWidth = 1; ctx.stroke();
    let cursor = pad;
    if (withSigil) {
      ctx.save(); ctx.translate(cursor + sigil / 2, height / 2); drawSuitSigil(ctx, mark.suit, sigil, color); ctx.restore();
      cursor += sigil + gap;
    }
    ctx.font = font; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffeec8';
    ctx.fillText(mark.numeral, withSigil ? cursor : (width - textW) / 2, height / 2 + 1);
  });
  return key ? scene.add.image(x, y, key).setDisplaySize(width, height)
    .setName('tarot-mark').setData({ cardId, numeral: mark.numeral, suit: mark.suit, rank: mark.rank }) : undefined;
}

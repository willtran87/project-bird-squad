import type Phaser from 'phaser';
import { quietButton } from './quiet-ui';
import type { ButtonCue } from './button-cue';
import { UI_CYAN, UI_DISPLAY_FONT, UI_FIELD, UI_FONT, UI_GOLD, UI_SOFT, UI_TYPE } from './theme';

/**
 * One panel for overlays: scrim, frame, header, body and footer actions in the
 * field-kit language every authored panel already speaks (drop shadow, accent
 * rail, corner brackets). Callers place their own content inside `body`.
 * Lazy: never imported by boot code.
 */

export interface PanelAction {
  label: string; name: string; onActivate: () => void;
  kind?: 'primary' | 'secondary' | 'utility' | 'destructive'; width?: number; cue?: ButtonCue; enabled?: boolean;
}

export interface PanelSpec {
  name: string;
  /** Centre of the frame. */
  x: number; y: number; width: number; height: number;
  accent?: number; fill?: number; fillAlpha?: number;
  /** Full-screen scrim alpha under the frame; omitted or false draws none. */
  scrim?: number | false;
  /** The scrim swallows pointer input meant for the scene below. */
  modal?: boolean;
  eyebrow?: string; title?: string; subtitle?: string;
  /** Corner brackets and rails; off for small tags such as a legend. */
  ornate?: boolean;
  actions?: PanelAction[];
}

export interface PanelRect { left: number; top: number; right: number; bottom: number; width: number; height: number; cx: number; cy: number }

export interface Panel {
  frame: PanelRect;
  /** The free area between the header and the footer. */
  body: PanelRect;
  objects: Phaser.GameObjects.GameObject[];
  actions: Phaser.GameObjects.Rectangle[];
}

const HEADER = { eyebrow: 22, title: 34, subtitle: 26, gap: 14 } as const;
const FOOTER = 72, PAD = 28;

const rect = (left: number, top: number, width: number, height: number): PanelRect =>
  ({ left, top, width, height, right: left + width, bottom: top + height, cx: left + width / 2, cy: top + height / 2 });

/** Where header, body and footer fall for a frame; pure, so layouts can be checked without a scene. */
export function panelLayout(spec: Pick<PanelSpec, 'x' | 'y' | 'width' | 'height' | 'eyebrow' | 'title' | 'subtitle' | 'actions'>) {
  const frame = rect(spec.x - spec.width / 2, spec.y - spec.height / 2, spec.width, spec.height);
  let y = frame.top + PAD;
  const header: Array<{ part: 'eyebrow' | 'title' | 'subtitle'; y: number }> = [];
  for (const part of ['eyebrow', 'title', 'subtitle'] as const) {
    if (!spec[part]) continue;
    header.push({ part, y });
    y += HEADER[part];
  }
  if (header.length) y += HEADER.gap;
  const bottom = spec.actions?.length ? frame.bottom - FOOTER : frame.bottom - PAD;
  return { frame, header, body: rect(frame.left + PAD, y, frame.width - PAD * 2, Math.max(0, bottom - y)), footerY: frame.bottom - FOOTER / 2 - 4 };
}

export function panel(scene: Phaser.Scene, spec: PanelSpec, addTo?: (object: Phaser.GameObjects.GameObject) => void): Panel {
  const objects: Phaser.GameObjects.GameObject[] = [];
  const add = <T extends Phaser.GameObjects.GameObject>(object: T) => { objects.push(object); addTo?.(object); return object; };
  const accent = spec.accent ?? UI_FIELD.gold;
  const layout = panelLayout(spec);
  const { frame } = layout;
  const { width: W, height: H } = scene.scale.gameSize;
  if (spec.scrim !== undefined && spec.scrim !== false) {
    const scrim = add(scene.add.rectangle(W / 2, H / 2, W, H, 0x0a121c, spec.scrim).setName(`${spec.name}-scrim`));
    if (spec.modal) scrim.setInteractive();
  }
  add(scene.add.rectangle(frame.cx + 8, frame.cy + 10, frame.width, frame.height, 0x020409, 0.42).setName(`${spec.name}-shadow`));
  add(scene.add.rectangle(frame.cx, frame.cy, frame.width, frame.height, spec.fill ?? UI_FIELD.panel, spec.fillAlpha ?? 0.985)
    .setStrokeStyle(1, accent, 0.42).setName(`${spec.name}-frame`));
  if (spec.ornate !== false) {
    const ink = add(scene.add.graphics().setName(`${spec.name}-ornament`));
    ink.fillStyle(accent, 0.72).fillRect(frame.left + 17, frame.top + 13, frame.width - 34, 2);
    ink.fillStyle(0xffffff, 0.08).fillRect(frame.left + 17, frame.bottom - 14, frame.width - 34, 1);
    const c = 28, i = 15;
    for (const [x, y, sx, sy] of [[frame.left + i, frame.top + i, 1, 1], [frame.right - i, frame.top + i, -1, 1],
      [frame.left + i, frame.bottom - i, 1, -1], [frame.right - i, frame.bottom - i, -1, -1]] as const) {
      ink.fillStyle(accent, 0.72);
      ink.fillRect(sx > 0 ? x : x - c, sy > 0 ? y : y - 2, c, 2);
      ink.fillRect(sx > 0 ? x : x - 2, sy > 0 ? y : y - c, 2, c);
    }
  }
  const textWidth = frame.width - PAD * 2 - 12;
  for (const { part, y } of layout.header) {
    const style = part === 'title'
      ? { fontFamily: UI_DISPLAY_FONT, fontSize: '28px', color: UI_GOLD, fontStyle: 'bold' }
      : part === 'eyebrow' ? { fontFamily: UI_FONT, fontSize: `${UI_TYPE.secondary - 2}px`, color: UI_CYAN, fontStyle: 'bold' }
        : { fontFamily: UI_FONT, fontSize: `${UI_TYPE.secondary}px`, color: UI_SOFT };
    add(scene.add.text(frame.left + PAD + 6, y, part === 'eyebrow' ? spec[part]!.toUpperCase() : spec[part]!, {
      ...style, resolution: 2, wordWrap: { width: textWidth, useAdvancedWrap: true }, maxLines: 1,
    }).setName(`${spec.name}-${part}`));
  }
  const actions: Phaser.GameObjects.Rectangle[] = [];
  const list = spec.actions ?? [];
  let x = frame.right - PAD - 6;
  for (const action of [...list].reverse()) {
    const width = action.width ?? 168;
    const hit = quietButton(scene, { x: x - width / 2, y: layout.footerY, width, label: action.label, name: action.name,
      kind: action.kind, enabled: action.enabled, cue: action.cue, onActivate: action.onActivate });
    add(hit); add(hit.getData('labelObject'));
    actions.unshift(hit);
    x -= width + 12;
  }
  return { frame, body: layout.body, objects, actions };
}

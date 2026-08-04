import Phaser from 'phaser';
import {
  addRouteWaymarkScrollRailFrame,
  addRunKitDrawerFlourish,
  addUiIconImage,
  HUD_MENU_PANEL,
  renderCloseControl,
  renderCompactItemTile,
  renderFieldPanel,
  UI_FIELD,
  UI_MUTED as SHARED_UI_MUTED,
} from '../main';

const UI_FONT = 'Arial';
const UI_BOLD = 'bold';
const UI_GOLD = '#ffe1a3';
const UI_BODY = '#dce8f2';
const UI_MUTED = '#91a6b8';
const UI_CYAN = '#8df4ff';

export interface SceneWaymarkReviewEntry {
  id: string;
  name: string;
  meta: string;
  trigger: string;
  description: string;
  effects: string[];
  tags: string[];
  accent: number;
  artKey?: string;
  flavorText: string;
  glyph: string;
  tileMeta: string;
  summary: string;
}

export interface SceneWaymarkReviewView {
  selected: SceneWaymarkReviewEntry;
  pinned?: SceneWaymarkReviewEntry;
  onPin: () => void;
}

export interface SceneWaymarkDrawerView {
  entries: SceneWaymarkReviewEntry[];
  selected?: SceneWaymarkReviewEntry;
  pinned?: SceneWaymarkReviewEntry;
  scrollRow: number;
  onClose: () => void;
  onSelect: (id: string) => void;
  onPin: () => void;
}

function addText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: string,
  size: string,
  color: string,
  width: number,
  options: { bold?: boolean; lines?: number; align?: 'left' | 'center' } = {},
) {
  return scene.add.text(x, y, value, {
    fontFamily: UI_FONT,
    fontSize: size,
    fontStyle: options.bold ? UI_BOLD : 'normal',
    color,
    fixedWidth: width,
    align: options.align ?? 'left',
    wordWrap: { width },
    maxLines: options.lines,
    lineSpacing: 1,
  }).setResolution(2);
}

function renderArt(scene: Phaser.Scene, entry: SceneWaymarkReviewEntry, x: number, y: number, size: number) {
  scene.add.rectangle(x, y, size, size, 0x06101a, 0.96)
    .setStrokeStyle(2, entry.accent, 0.86);
  if (entry.artKey && scene.textures.exists(entry.artKey)) {
    scene.textures.get(entry.artKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    scene.add.image(x, y, entry.artKey)
      .setDisplaySize(size - 10, size - 10)
      .setName('route-waymark-review-art');
  } else {
    addText(scene, x - size / 2 + 8, y - 8, 'WAYMARK', '9px', UI_MUTED, size - 16, {
      bold: true,
      align: 'center',
    });
  }
}

function renderPinControl(scene: Phaser.Scene, view: SceneWaymarkReviewView) {
  const selectedPinned = view.pinned?.id === view.selected.id;
  const hit = scene.add.rectangle(1076, 414, 112, 58, 0x09131f, 0.96)
    .setStrokeStyle(1.5, selectedPinned ? 0xff9de8 : 0x8df4ff, 0.9)
    .setInteractive({ useHandCursor: true })
    .setName('route-waymark-pin-hit');
  addText(scene, 1020, 405, selectedPinned ? 'UNPIN  C' : 'PIN  C', '11px', selectedPinned ? '#ffc9f5' : UI_CYAN, 112, {
    bold: true,
    align: 'center',
  });
  hit.on('pointerdown', view.onPin);
}

function renderEffectRows(
  scene: Phaser.Scene,
  entry: SceneWaymarkReviewEntry,
  x: number,
  y: number,
  width: number,
  maxRows = 4,
) {
  entry.effects.slice(0, maxRows).forEach((effect, index) => {
    const rowY = y + index * 24;
    scene.add.circle(x + 11, rowY + 9, 9, entry.accent, 0.22)
      .setStrokeStyle(1, entry.accent, 0.72);
    addText(scene, x + 3, rowY + 3, `${index + 1}`, '9px', '#f7fbff', 16, {
      bold: true,
      align: 'center',
    }).setName('route-waymark-effect-order');
    addText(scene, x + 27, rowY + 1, effect, '11px', UI_BODY, width - 27, {
      lines: 2,
    });
  });
}

function renderTagLine(scene: Phaser.Scene, entry: SceneWaymarkReviewEntry, x: number, y: number, width: number) {
  addText(scene, x, y, entry.tags.length ? entry.tags.map((tag) => tag.toUpperCase()).join('  /  ') : 'GENERAL', '9px', UI_CYAN, width, {
    bold: true,
    lines: 1,
  });
}

function renderSingle(scene: Phaser.Scene, entry: SceneWaymarkReviewEntry, pinned: boolean) {
  renderArt(scene, entry, 194, 502, 112);
  addText(scene, 268, 401, entry.name, '21px', UI_GOLD, 500, { bold: true, lines: 1 });
  addText(scene, 268, 430, entry.meta, '10px', UI_CYAN, 500, { bold: true, lines: 1 });
  addText(scene, 268, 453, entry.description, '12px', UI_BODY, 430, { lines: 4 });
  addText(scene, 268, 548, entry.flavorText, '10px', '#a8b7c8', 430, { lines: 2 });
  addText(scene, 724, 407, 'TRIGGER', '9px', UI_MUTED, 294, { bold: true });
  addText(scene, 724, 425, entry.trigger, '12px', '#fff0cf', 294, { bold: true, lines: 2 });
  addText(scene, 724, 470, 'EFFECT ORDER', '9px', UI_MUTED, 294, { bold: true });
  renderEffectRows(scene, entry, 724, 488, 322);
  renderTagLine(scene, entry, 724, 588, 322);
  addText(scene, 268, 588, pinned ? 'PINNED — choose another Waymark to compare.' : 'Select a Waymark above. Pin it to compare.', '10px', pinned ? '#ffc9f5' : UI_MUTED, 430, {
    bold: pinned,
    lines: 1,
  });
}

function renderComparisonColumn(
  scene: Phaser.Scene,
  entry: SceneWaymarkReviewEntry,
  left: number,
  heading: string,
  headingColor: string,
) {
  const width = 422;
  addText(scene, left, 397, heading, '9px', headingColor, width, {
    bold: true,
    align: 'center',
  });
  renderArt(scene, entry, left + 38, 445, 64);
  addText(scene, left + 80, 414, entry.name, '16px', UI_GOLD, width - 86, { bold: true, lines: 1 });
  addText(scene, left + 80, 438, entry.meta, '9px', UI_CYAN, width - 86, { bold: true, lines: 1 });
  addText(scene, left, 482, 'TRIGGER', '9px', UI_MUTED, width, { bold: true });
  addText(scene, left, 498, entry.trigger, '11px', '#fff0cf', width, { bold: true, lines: 2 });
  addText(scene, left, 532, 'EFFECT ORDER', '9px', UI_MUTED, width, { bold: true });
  renderEffectRows(scene, entry, left, 548, width, 3);
  renderTagLine(scene, entry, left, 616, width);
}

export function renderSceneWaymarkReview(scene: Phaser.Scene, view: SceneWaymarkReviewView) {
  const comparing = Boolean(view.pinned && view.pinned.id !== view.selected.id);
  scene.add.rectangle(640, 504, 958, 224, 0x050a12, 0.92)
    .setStrokeStyle(1, 0xc9a6ff, 0.36)
    .setName('route-waymark-review-panel');
  renderPinControl(scene, view);

  if (comparing && view.pinned) {
    scene.add.rectangle(640, 516, 1, 188, 0x8df4ff, 0.22);
    renderComparisonColumn(scene, view.pinned, 164, 'PINNED', '#ffc9f5');
    renderComparisonColumn(scene, view.selected, 654, 'SELECTED', UI_CYAN);
    return;
  }

  renderSingle(scene, view.selected, view.pinned?.id === view.selected.id);
}

export function renderSceneWaymarkDrawer(scene: Phaser.Scene, view: SceneWaymarkDrawerView) {
  scene.add.rectangle(640, 360, 1280, 720, 0x020409, 0.66)
    .setInteractive({ useHandCursor: false });

  const frame = renderFieldPanel(scene, () => {}, HUD_MENU_PANEL.cx, HUD_MENU_PANEL.cy, HUD_MENU_PANEL.w, HUD_MENU_PANEL.h, {
    eyebrow: 'Route Kit',
    title: 'Found Waymarks',
    subtitle: `${view.entries.length} artifact item${view.entries.length === 1 ? '' : 's'} carried this run`,
    accent: UI_FIELD.violet,
  });
  addRunKitDrawerFlourish(scene, () => {}, frame, { alpha: 0.11, tint: 0xe7d8ff, yOffset: 8 });
  addUiIconImage(scene, 'waymark-compass', frame.left + HUD_MENU_PANEL.headerIconX, frame.top + HUD_MENU_PANEL.headerIconY, 28)?.setAlpha(0.92);
  renderCloseControl(scene, () => {}, frame.right - HUD_MENU_PANEL.closeX, frame.top + HUD_MENU_PANEL.closeY, view.onClose);

  if (view.entries.length === 0) {
    addUiIconImage(scene, 'waymark-compass', frame.left + 88, frame.top + 160, 34)?.setAlpha(0.32);
    scene.add.text(frame.left + 126, frame.top + 150, '0 found', {
      fontFamily: UI_FONT,
      fontSize: '14px',
      fontStyle: UI_BOLD,
      color: SHARED_UI_MUTED,
      wordWrap: { width: HUD_MENU_PANEL.w - 108 },
    });
    return;
  }

  const columns = 3;
  const visibleRows = 2;
  const tileW = 252;
  const tileH = 80;
  const startX = frame.left + 64;
  const startY = frame.top + 128;
  const totalRows = Math.ceil(view.entries.length / columns);
  const maxScrollRows = Math.max(0, totalRows - visibleRows);
  const scrollRow = Phaser.Math.Clamp(Math.round(view.scrollRow), 0, maxScrollRows);
  const visible = view.entries.slice(scrollRow * columns, (scrollRow + visibleRows) * columns);
  visible.forEach((entry, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = startX + col * 272;
    const y = startY + row * 88;
    const bg = renderCompactItemTile(scene, () => {}, x, y, tileW, tileH, {
      kind: 'waymark',
      id: entry.id,
      glyph: entry.glyph,
      accent: entry.accent,
      name: entry.name,
      meta: entry.tileMeta,
      summary: entry.summary,
      actionLabel: view.pinned?.id === entry.id ? 'PINNED' : undefined,
    });
    bg.setName(`route-waymark-tile-${entry.id}`)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => view.onSelect(entry.id));
    if (view.selected?.id === entry.id) {
      scene.add.rectangle(x + tileW / 2, y + tileH / 2, tileW + 7, tileH + 7)
        .setStrokeStyle(3, entry.accent, 0.96)
        .setName('route-waymark-selected-outline');
    }
  });

  if (maxScrollRows > 0) {
    const trackH = visibleRows * 88 - 8;
    const trackX = frame.right - 38;
    const trackY = startY + trackH / 2;
    const thumbH = Math.max(34, trackH * (visibleRows / totalRows));
    const thumbTravel = trackH - thumbH;
    const thumbY = trackY - trackH / 2 + thumbH / 2 + (scrollRow / maxScrollRows) * thumbTravel;
    addRouteWaymarkScrollRailFrame(scene, () => {}, trackX, trackY, trackH, thumbY, thumbH);
  }

  if (view.selected) {
    renderSceneWaymarkReview(scene, {
      selected: view.selected,
      pinned: view.pinned,
      onPin: view.onPin,
    });
  }
}

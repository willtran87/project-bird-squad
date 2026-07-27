import Phaser from 'phaser';
import {
  addRunKitDrawerFlourish,
  addUiIconImage,
  HUD_MENU_PANEL,
  renderCloseControl,
  renderCompactItemTile,
  renderEmptySupplySlotTile,
  renderFieldPanel,
  UI_FIELD,
  UI_FONT,
  UI_MUTED,
} from '../main';

const UI_BOLD = 'bold';

export interface RouteSupplyDrawerEntry {
  id?: string;
  glyph?: string;
  accent?: number;
  name?: string;
  summary?: string;
  usable?: boolean;
}

export interface RouteSupplyDrawerView {
  entries: RouteSupplyDrawerEntry[];
  filled: number;
  capacity: number;
  onClose: () => void;
  onUse: (index: number) => void;
}

export function renderRouteSupplyDrawer(scene: Phaser.Scene, view: RouteSupplyDrawerView) {
  scene.add.rectangle(640, 360, 1280, 720, 0x020409, 0.66)
    .setInteractive({ useHandCursor: false });
  const frame = renderFieldPanel(scene, () => {}, HUD_MENU_PANEL.cx, HUD_MENU_PANEL.cy, HUD_MENU_PANEL.w, HUD_MENU_PANEL.h, {
    eyebrow: 'Run Kit',
    title: 'Packed Supplies',
    subtitle: `${view.filled}/${view.capacity} supply slot${view.capacity === 1 ? '' : 's'} filled`,
    accent: 0xffb86b,
  });
  addRunKitDrawerFlourish(scene, () => {}, frame, { alpha: 0.1, tint: 0xffe1a3, yOffset: 8 });
  addUiIconImage(scene, 'supply-pouch', frame.left + HUD_MENU_PANEL.headerIconX, frame.top + HUD_MENU_PANEL.headerIconY, 28)?.setAlpha(0.92);
  renderCloseControl(scene, () => {}, frame.right - HUD_MENU_PANEL.closeX, frame.top + HUD_MENU_PANEL.closeY, view.onClose);

  if (view.capacity === 0) {
    addUiIconImage(scene, 'supply-pouch', frame.left + 88, frame.top + 160, 34)?.setAlpha(0.32);
    scene.add.text(frame.left + 126, frame.top + 150, '0 slots', {
      fontFamily: UI_FONT,
      fontSize: '14px',
      fontStyle: UI_BOLD,
      color: UI_MUTED,
      wordWrap: { width: frame.w - 108 },
    });
    return;
  }

  const tileW = 252;
  const tileH = 104;
  const startX = frame.left + 64;
  const startY = frame.top + 128;
  view.entries.forEach((entry, index) => {
    const x = startX + (index % 3) * 272;
    const y = startY + Math.floor(index / 3) * 112;
    if (!entry.id) {
      renderEmptySupplySlotTile(scene, () => {}, x, y, tileW, tileH);
      return;
    }
    const bg = renderCompactItemTile(scene, () => {}, x, y, tileW, tileH, {
      kind: 'supply',
      id: entry.id,
      glyph: entry.glyph ?? '?',
      accent: entry.accent ?? UI_FIELD.gold,
      name: entry.name ?? entry.id,
      summary: entry.summary ?? '',
      enabled: entry.usable,
      actionLabel: entry.usable ? 'USE' : 'COMBAT',
    });
    if (entry.usable) {
      bg.setInteractive({ useHandCursor: true })
        .on('pointerdown', () => view.onUse(index));
    }
  });
}

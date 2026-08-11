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
  focusIndex: number;
  inputActive: boolean;
  armedIndex?: number;
  confirmLabel: string;
  backLabel: string;
  addTo?: (object: Phaser.GameObjects.GameObject) => void;
  onClose: () => void;
  onFocus: (index: number) => void;
  onActivate: (index: number) => void;
}

export function renderRouteSupplyDrawer(scene: Phaser.Scene, view: RouteSupplyDrawerView) {
  const addTo = view.addTo ?? (() => {});
  addTo(scene.add.rectangle(640, 360, 1280, 720, 0x020409, 0.66)
    .setInteractive({ useHandCursor: false }));
  const frame = renderFieldPanel(scene, addTo, HUD_MENU_PANEL.cx, HUD_MENU_PANEL.cy, HUD_MENU_PANEL.w, HUD_MENU_PANEL.h, {
    eyebrow: 'Run Kit',
    title: 'Packed Supplies',
    subtitle: `${view.filled}/${view.capacity} supply slot${view.capacity === 1 ? '' : 's'} filled`,
    accent: 0xffb86b,
  });
  addRunKitDrawerFlourish(scene, addTo, frame, { alpha: 0.1, tint: 0xffe1a3, yOffset: 8 });
  const pouch = addUiIconImage(scene, 'supply-pouch', frame.left + HUD_MENU_PANEL.headerIconX, frame.top + HUD_MENU_PANEL.headerIconY, 28)?.setAlpha(0.92);
  if (pouch) addTo(pouch);
  renderCloseControl(scene, addTo, frame.right - HUD_MENU_PANEL.closeX, frame.top + HUD_MENU_PANEL.closeY, view.onClose);

  if (view.capacity === 0) {
    const emptyPouch = addUiIconImage(scene, 'supply-pouch', frame.left + 88, frame.top + 160, 34)?.setAlpha(0.32);
    if (emptyPouch) addTo(emptyPouch);
    addTo(scene.add.text(frame.left + 126, frame.top + 150, '0 slots', {
      fontFamily: UI_FONT,
      fontSize: '14px',
      fontStyle: UI_BOLD,
      color: UI_MUTED,
      wordWrap: { width: frame.w - 108 },
    }));
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
      renderEmptySupplySlotTile(scene, addTo, x, y, tileW, tileH);
      return;
    }
    const focused = view.inputActive && view.focusIndex === index;
    const armed = view.armedIndex === index;
    if (focused || armed) {
      addTo(scene.add.rectangle(x + tileW / 2, y + tileH / 2, tileW + 10, tileH + 10, 0x07131b, 0.06)
        .setStrokeStyle(armed ? 4 : 3, armed ? UI_FIELD.gold : UI_FIELD.cyan, 0.98)
        .setName(armed ? 'supply-drawer-armed-ring' : 'supply-drawer-focus-ring'));
    }
    const bg = renderCompactItemTile(scene, addTo, x, y, tileW, tileH, {
      kind: 'supply',
      id: entry.id,
      glyph: entry.glyph ?? '?',
      accent: entry.accent ?? UI_FIELD.gold,
      name: entry.name ?? entry.id,
      summary: entry.summary ?? '',
      enabled: entry.usable,
      actionLabel: entry.usable ? armed ? 'CONFIRM' : 'SELECT' : 'OTHER PHASE',
    }).setName(`supply-drawer-item-${index}`);
    if (entry.usable) {
      bg.setInteractive({ useHandCursor: true })
        .on('pointerover', () => view.onFocus(index))
        .on('pointerdown', () => view.onActivate(index));
    }
  });

  const focused = view.entries[view.focusIndex];
  const command = view.armedIndex === undefined
    ? `${view.confirmLabel} / A / TAP  SELECT  |  PREVIOUS / NEXT / D-PAD  BROWSE  |  ${view.backLabel} / B  CLOSE`
    : `${view.confirmLabel} / A / SECOND TAP  USE ${focused?.name?.toUpperCase() ?? 'SUPPLY'}  |  ${view.backLabel} / B  CANCEL`;
  addTo(scene.add.rectangle(frame.cx, frame.bottom - 48, 744, 38, 0x07131b, 0.92)
    .setStrokeStyle(1.5, view.armedIndex === undefined ? UI_FIELD.cyan : UI_FIELD.gold, 0.78)
    .setName('supply-drawer-command-rail'));
  addTo(scene.add.text(frame.cx, frame.bottom - 48, command, {
    fontFamily: UI_FONT,
    fontSize: '11px',
    fontStyle: UI_BOLD,
    color: view.armedIndex === undefined ? '#bfe8f4' : '#ffe08a',
    fixedWidth: 714,
    align: 'center',
    maxLines: 1,
  }).setOrigin(0.5).setName('supply-drawer-command-copy'));
}

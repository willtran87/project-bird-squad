import type Phaser from 'phaser';
import { controlBindingLabel } from './input-bindings';
import { bindChoiceHint } from './choice-input-hints';

export interface FlockStatRow { label: string; base: number; bonus: number; total: number }
// Keep scene adapters stable; this reader no longer needs ornate frames.
export interface RouteFlockStatsContext {
  scene: Phaser.Scene;
  rows: FlockStatRow[];
  renderFieldPanel: unknown;
  renderCloseControl: unknown;
  onClose: () => void;
  reducedMotion: boolean;
}
export interface BattleFlockStatsContext extends RouteFlockStatsContext {
  root: Phaser.GameObjects.Container;
  battleRows: Array<[string, string]>;
}

function renderStats(context: RouteFlockStatsContext, battleRows?: Array<[string, string]>) {
  const { scene, rows, onClose } = context;
  const combat = !!battleRows;
  const panel = scene.add.container(0, 0).setName('flock-stats-reader');
  if ('root' in context) (context as BattleFlockStatsContext).root.add(panel);
  const left = combat ? 110 : 220, width = combat ? 1060 : 840;
  const text = (x: number, y: number, value: string, wrap: number, size = 22, color = '#dbe8f2') => {
    const label = scene.add.text(x, y, value, { fontFamily: 'Arial', fontSize: size + 'px', color,
      resolution: 2, wordWrap: { width: wrap, useAdvancedWrap: true }, lineSpacing: 2 });
    panel.add(label); return label;
  };
  panel.add(scene.add.rectangle(640, 360, 1280, 720, 0x020409, 0.88).setInteractive());
  panel.add(scene.add.rectangle(640, 360, width, 640, 0x070d15, 1)
    .setStrokeStyle(1, 0x536574, 0.8).setName('flock-stats-panel'));
  text(left + 32, 72, 'CREW DOSSIER', width - 64, 16, '#abc4d4');
  text(left + 32, 98, 'Flock Stats', width - 64, 32, '#ffe1a3');
  text(left + 32, 146, combat ? 'Deck bonuses and current combat values.' : 'Passive bonuses from your whole deck.', width - 64, 20, '#abc4d4');
  const tableLeft = left + 32, tableWidth = combat ? 546 : 776;
  const rowName = (label: string) => combat && label === 'Cohesion' ? 'Max Cohesion' : combat && label === 'Wingbeats' ? 'Next Wingbeats' : label;
  panel.setData('summary', 'Flock Stats. Reading only. ' + rows.map(row =>
    rowName(row.label) + ': base ' + row.base + ', bonus ' + row.bonus + ', total ' + row.total + '.').join(' ') +
    (battleRows ? ' This combat: ' + battleRows.map(row => row.join(' ')).join(', ') + '. Open Sky Guard total is remaining charges.' : '') +
    ' Back or controller B closes this view without changing your decision.');
  const columns = [tableLeft, tableLeft + tableWidth - 218, tableLeft + tableWidth - 110, tableLeft + tableWidth];
  ['Stat', 'Base', 'Bonus', 'Total'].forEach((value, i) =>
    text(columns[i], 194, value, i ? 96 : 240, 18, '#abc4d4').setOrigin(i ? 1 : 0, 0));
  panel.add(scene.add.rectangle(tableLeft + tableWidth / 2, 220, tableWidth, 1, 0x536574, 0.7));
  rows.forEach((row, index) => {
    const y = 230 + index * 36;
    if (index % 2 === 0) panel.add(scene.add.rectangle(tableLeft + tableWidth / 2, y + 12, tableWidth, 34, 0x14232e, 0.42));
    const name = rowName(row.label);
    const values = [name, String(row.base), row.bonus > 0 ? '+' + row.bonus : String(row.bonus), String(row.total)];
    values.forEach((value, i) => text(columns[i], y, value, i ? 100 : tableWidth - 330, 22,
      i === 3 ? '#ffe1a3' : i === 2 && row.bonus > 0 ? '#8df4ff' : '#dbe8f2')
      .setOrigin(i ? 1 : 0, 0).setName('flock-stats-cell-' + index + '-' + i));
  });
  if (battleRows) {
    panel.add(scene.add.rectangle(726, 385, 1, 382, 0x536574, 0.5));
    text(758, 194, 'THIS COMBAT', 380, 18, '#abc4d4');
    battleRows.forEach(([label, value], index) => {
      const y = 230 + index * 42;
      text(758, y, label, 260, 22).setName('flock-stats-combat-label-' + index);
      text(1138, y, value, 110, 22, '#ffe1a3').setOrigin(1, 0).setName('flock-stats-combat-value-' + index);
    });
    text(758, 504, 'Next Wingbeats: starting energy next turn.\nOpen Sky Guard: remaining charges.', 380, 18, '#abc4d4');
  }
  text(left + 32, 602, 'Card bonuses change when cards join,\nleave or are Preened.', width - 400, 18, '#abc4d4');
  const closeX = left + width - 172;
  const close = scene.add.rectangle(closeX, 628, 280, 58, 0x14232e, 1)
    .setStrokeStyle(1, 0x536574, 1).setInteractive({ useHandCursor: true }).setName('flock-stats-close');
  close.on('pointerdown', onClose);
  close.on('pointerover', () => close.setStrokeStyle(2, 0x7ab8d6, 1));
  close.on('pointerout', () => close.setStrokeStyle(1, 0x536574, 1));
  panel.add(close);
  bindChoiceHint(scene, text(closeX, 628, '', 256, 20).setOrigin(0.5), mode =>
    mode === 'pointer' ? 'Back' : 'Back · ' + (mode === 'controller' ? 'B' : controlBindingLabel('back')));
  return panel;
}

export function renderRouteFlockStats(context: RouteFlockStatsContext) { return renderStats(context); }
export function renderBattleFlockStats(context: BattleFlockStatsContext) { return renderStats(context, context.battleRows); }

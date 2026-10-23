import { UI_FONT as TOKEN_FONT } from './ui-tokens';
import type Phaser from 'phaser';
import { bindControlActions, controlBindingLabel } from './input-bindings';
import { bindChoiceHint } from './choice-input-hints';
import { UI_TYPE, UI_FIELD, UI_FONT, UI_SOFT } from './theme';
import { quietButton } from './quiet-ui';

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
    const label = scene.add.text(x, y, value, { fontFamily: TOKEN_FONT, fontSize: size + 'px', color,
      resolution: 2, wordWrap: { width: wrap, useAdvancedWrap: true }, lineSpacing: 2 });
    panel.add(label); return label;
  };
  panel.add(scene.add.rectangle(640, 360, 1280, 720, 0x020409, 0.88).setInteractive());
  panel.add(scene.add.rectangle(640, 360, width, 640, 0x070d15, 1)
    .setStrokeStyle(1, 0x536574, 0.8).setName('flock-stats-panel'));
  text(left + 32, 88, 'Flock Stats', width - 64, 32, '#ffe1a3');
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
  const close = quietButton(scene, { x: closeX, y: 628, width: 280, label: 'Back',
    name: 'flock-stats-close', onActivate: onClose });
  panel.add([close, close.getData('labelObject')]);
  bindChoiceHint(scene, close.getData('labelObject'), mode =>
    mode === 'pointer' ? 'Back' : 'Back · ' + (mode === 'controller' ? 'B' : controlBindingLabel('back')));
  return panel;
}

export function renderRouteFlockStats(context: RouteFlockStatsContext) { return renderStats(context); }
export function renderBattleFlockStats(context: BattleFlockStatsContext) { return renderStats(context, context.battleRows); }

interface BossPrep {
  bossName: string; pressure: string; thesis?: string; phaseHint?: string;
  primaryTests: string[]; strategyHints: string[]; needs: string[]; usefulNodes: string[];
  readiness: { cover: string; damage: string; recovery: string; moltSafety: string; supplies: number };
}

/** Reuses the route dossier's modal ownership; never arms or commits travel. */
export function renderBossPrep(context: {
  scene: Phaser.Scene; prep: BossPrep; page: number; onPage: (page: number) => void;
  onClose: () => void; ownsInput: () => boolean;
}) {
  const { scene, prep, ownsInput } = context;
  const root = scene.add.container(0, 0).setName('flock-stats-reader');
  root.setData('bossPrep', true);
  root.add(scene.add.rectangle(640, 360, 1280, 720, 0x020409, 0.94).setInteractive());
  root.add(scene.add.rectangle(640, 360, 1040, 640, UI_FIELD.panel, 1)
    .setStrokeStyle(1, UI_FIELD.cyan, 0.55).setName('boss-prep-reader-panel'));
  const text = (parent: Phaser.GameObjects.Container, x: number, y: number, value: string,
    width = 920, size: number = UI_TYPE.primary, color = UI_FIELD.text) => {
    const label = scene.add.text(x, y, value, { fontFamily: UI_FONT, fontSize: size,
      color, resolution: UI_TYPE.resolution, wordWrap: { width, useAdvancedWrap: true }, lineSpacing: 5 });
    label.setData('primary', size >= UI_TYPE.primary);
    parent.add(label); return label;
  };
  text(root, 156, 62, 'BOSS PREPARATION · READ ONLY', 780, UI_TYPE.secondary, UI_SOFT);
  text(root, 156, 92, prep.bossName, 780, 32, UI_FIELD.warm);
  const button = (x: number, y: number, width: number, label: string, name: string, action: () => void) => {
    const hit = quietButton(scene, { x, y, width, label, name,
      onActivate: () => { if (ownsInput()) action(); } });
    root.add([hit, hit.getData('labelObject')]);
    return hit;
  };
  button(1060, 94, 140, 'Back', 'boss-prep-close', context.onClose);
  let page = Math.max(0, Math.min(2, context.page));
  const body = scene.add.container(0, 0).setName('boss-prep-reader-body');
  root.add(body);
  const names = ['Threat', 'Strategy', 'Readiness'];
  const tabs = names.map((name, index) => button(340 + index * 300, 172, 280, name,
    'boss-prep-tab-' + index, () => show(index)));
  const navigation = text(root, 156, 634, '', 940, UI_TYPE.secondary, UI_SOFT);
  bindChoiceHint(scene, navigation, mode => mode === 'controller'
    ? 'D-pad / LB / RB: section · B: back · Reading does not start the fight.'
    : `${controlBindingLabel('previous')} / ${controlBindingLabel('next')}: section · ${controlBindingLabel('back')}: back · Reading does not start the fight.`);
  const show = (index: number) => {
    page = (index + names.length) % names.length;
    context.onPage(page);
    root.setData('page', page);
    body.removeAll(true);
    tabs.forEach((tab, i) => tab.setData('selected', i === page));
    const lines: string[] = [];
    let y = 226;
    const paragraph = (label: string, value: string) => {
      const heading = text(body, 156, y, label, 920, UI_TYPE.secondary, UI_SOFT);
      y += heading.height + 8;
      const content = text(body, 156, y, value);
      y += content.height + 24;
      lines.push(label + ': ' + value);
    };
    if (page === 0) {
      paragraph('District challenge', prep.thesis ?? 'Prepare your deck before the final crossing.');
      paragraph('Tests your', prep.primaryTests.join(' · ') || 'Flock build');
      const pressureNames: Record<string, string> = { cover: 'Cover', heavy: 'Heavy strikes',
        snag: 'Snags', openSky: 'Open Sky', multi: 'Multi-hit', tempo: 'Tempo', winded: 'Winded' };
      paragraph('Pressure', prep.pressure.split(',').map(tag => pressureNames[tag.trim()] ?? tag.trim()).join(' · '));
      paragraph('Phase change', prep.phaseHint ?? 'No additional phase information.');
    } else if (page === 1) {
      prep.strategyHints.forEach((hint, index) => paragraph('Plan ' + (index + 1), hint));
      if (!prep.strategyHints.length) paragraph('Plan', 'Inspect enemy intents and keep a defensive option ready.');
    } else {
      const values: Array<[string, string]> = [
        ['Cover', prep.readiness.cover], ['Damage', prep.readiness.damage],
        ['Recovery', prep.readiness.recovery], ['Molt / Open Sky', prep.readiness.moltSafety],
        ['Packed supplies', String(prep.readiness.supplies)],
      ];
      values.forEach(([label, value]) => {
        text(body, 156, y, label, 520);
        text(body, 700, y, value, 380, UI_TYPE.primary, value === 'low' ? '#ffd0bf' : UI_FIELD.warm);
        lines.push(label + ': ' + value); y += 40;
      });
      y += 12;
      paragraph('Route for', prep.needs.join(' · ') || 'No low categories');
      paragraph('Useful stops', prep.usefulNodes.join(' · ') || 'Final crossing');
      const note = 'Coverage: low 0–1 · steady 2–3 · strong 4+ relevant cards.';
      text(body, 156, 596, note, 920, UI_TYPE.secondary, UI_SOFT);
      lines.push(note);
    }
    root.setData('summary', `Boss preparation. ${prep.bossName}. ${names[page]}. ${lines.join('. ')}. ${navigation.text}`);
  };
  const turn = (direction: number, event?: KeyboardEvent) => {
    if (root.active && ownsInput() && !event?.repeat) show(page + direction);
  };
  const unbind = bindControlActions(scene, {
    previous: event => turn(-1, event), next: event => turn(1, event),
  });
  const pad = (_pad: unknown, button: { index?: number }) => {
    if (!root.active || !ownsInput()) return;
    if ([4, 14].includes(button.index ?? -1)) show(page - 1);
    if ([5, 15].includes(button.index ?? -1)) show(page + 1);
  };
  scene.input.gamepad?.on('down', pad);
  root.once('destroy', () => {
    unbind();
    scene.input.gamepad?.off('down', pad);
  });
  show(page);
  return root;
}

import Phaser from 'phaser';
import { MIN_SUPPORTED_TOUCH_TARGET } from '../theme';
import { fitTextExcerpt } from '../text-excerpt';

export type BattleHudTooltipTarget = Phaser.GameObjects.Rectangle | Phaser.GameObjects.Arc | Phaser.GameObjects.Text;

export interface BattleHudAssetKeys {
  beatProgressFrame: string;
  cardBack: string;
  discardIcon: string;
  drawIcon: string;
  logEventBead: string;
  logFrame: string;
  pileDock: string;
  roostCommandFrame: string;
  roostIcon: string;
}

export interface BattleHudPileView {
  x: number;
  y: number;
  count: number;
  label: 'DRAW' | 'DISCARD';
  accent: number;
  onInspect: () => void;
}

export interface BattleHudBeatView {
  active: boolean;
  turn: number;
  phase: string;
  move: string;
  progress: {
    label: string;
    progress: number;
    elapsedMs: number;
    durationMs: number;
  };
  acceleration?: {
    available: boolean;
    active: boolean;
    multiplier: number;
  };
}

export interface BattleHudGuidanceView {
  text: string;
  accent: number;
}

export interface BattleHudObjectiveView {
  text: string;
  accent: number;
  detail: string;
}

export interface BattleHudRenderContext {
  scene: Phaser.Scene;
  root: Phaser.GameObjects.Container;
  gameWidth: number;
  fontFamily: string;
  boldFontStyle: string;
  assets: BattleHudAssetKeys;
  piles: [BattleHudPileView, BattleHudPileView];
  log: {
    latest: string;
    tooltip: string;
    historyLabel: string;
    onHistory: () => void;
  };
  beat: BattleHudBeatView;
  guidance?: BattleHudGuidanceView;
  objective?: BattleHudObjectiveView;
  onRoost: () => void;
  roostLabel?: string;
  roostPreview?: string;
  roostDetail?: string;
  attachTooltip: (target: BattleHudTooltipTarget, title: string, body: string) => void;
}

export interface BattleHudRenderResult {
  beatUi: Phaser.GameObjects.Container;
}

export interface BattleSelectionPreviewView {
  card: string;
  target: string;
  summary: string;
  targetHp?: {
    x: number;
    y: number;
    width: number;
    height: number;
    beforeFraction: number;
    afterFraction: number;
    after: number;
    defeated: boolean;
  };
}

export interface BattleSelectionPreviewContext {
  scene: Phaser.Scene;
  root: Phaser.GameObjects.Container;
  gameWidth: number;
  fontFamily: string;
  boldFontStyle: string;
  cyan: number;
  gold: number;
}

interface SelectionOutcome {
  contract: { target: string; effects: string[] };
  target?: { name: string };
  enemyStates: Array<{
    id: string;
    hpBefore: number;
    hpAfter: number;
    maxHp: number;
    blockBefore: number;
    blockAfter: number;
    defeated: boolean;
  }>;
  flockBefore: { hp: number; block: number; flow: number; energy: number; resonance: number };
  flockAfter: { hp: number; maxHp: number; block: number; flow: number; flowMax: number; energy: number; resonance: number };
  enemyDamage: number;
  coverGain: number;
  cohesionDelta: number;
  flowGain: number;
  energyDelta: number;
  resonanceDelta: number;
  nextTurnDrawDelta: number;
  nextTurnEnergyDelta: number;
  moltPowerApplied: number;
  requiresChoice?: boolean;
  bossPhaseBreak?: { enemyId: string; name: string; nextIntent?: string };
}

export function formatBattleSelectionOutcome(
  card: string,
  enemyId: string,
  fallbackSummary: string,
  moltPowerTotal: number,
  outcome: SelectionOutcome,
) {
  const targetState = outcome.enemyStates.find((enemy) => enemy.id === enemyId);
  const phaseBreak = outcome.bossPhaseBreak;
  const parts: string[] = [];
  if (outcome.contract.target !== 'allEnemies' && targetState && targetState.hpAfter !== targetState.hpBefore) {
    parts.push(targetState.defeated
      ? `Enemy Cohesion ${targetState.hpBefore} -> DEFEATED`
      : `Enemy Cohesion ${targetState.hpBefore} -> ${targetState.hpAfter}`);
  } else if (outcome.enemyDamage > 0) {
    const defeated = outcome.enemyStates.filter((enemy) => enemy.hpBefore > 0 && enemy.defeated).length;
    parts.push(`${outcome.enemyDamage} total damage${defeated > 0 ? ` / ${defeated} defeated` : ''}`);
  }
  if (phaseBreak) parts.push(`Phase II: ${phaseBreak.name}${phaseBreak.nextIntent ? ` / next ${phaseBreak.nextIntent}` : ''}`);
  if (targetState && targetState.blockAfter !== targetState.blockBefore) {
    parts.push(`Enemy Cover ${targetState.blockBefore} -> ${targetState.blockAfter}`);
  }
  if (outcome.moltPowerApplied > 0) parts.push(`Molt Power +${outcome.moltPowerApplied}`);
  if (outcome.coverGain !== 0) parts.push(`Cover ${outcome.flockBefore.block} -> ${outcome.flockAfter.block}`);
  if (outcome.cohesionDelta !== 0) parts.push(`Flock ${outcome.flockBefore.hp} -> ${outcome.flockAfter.hp} Cohesion`);
  if (outcome.flowGain > 0) parts.push(outcome.flockAfter.flow >= outcome.flockAfter.flowMax
    ? `Flow ${outcome.flockBefore.flow} -> Surge`
    : `Flow ${outcome.flockBefore.flow} -> ${outcome.flockAfter.flow}`);
  if (outcome.energyDelta !== 0) parts.push(`Wingbeats ${outcome.flockBefore.energy} -> ${outcome.flockAfter.energy}`);
  if (outcome.resonanceDelta !== 0) parts.push(`Resonance ${outcome.flockBefore.resonance} -> ${outcome.flockAfter.resonance}`);
  if (outcome.nextTurnDrawDelta !== 0) parts.push(`Next draw ${outcome.nextTurnDrawDelta > 0 ? '+' : ''}${outcome.nextTurnDrawDelta}`);
  if (outcome.nextTurnEnergyDelta !== 0) parts.push(`Next Wingbeats ${outcome.nextTurnEnergyDelta > 0 ? '+' : ''}${outcome.nextTurnEnergyDelta}`);
  return {
    card,
    target: outcome.contract.target === 'enemy'
      ? outcome.target?.name ?? 'Choose target'
      : outcome.contract.target === 'allEnemies' ? 'All enemies' : 'Flock',
    summary: outcome.requiresChoice
      ? [...parts.slice(0, 2), 'Choose cards; later effects depend on your choice.'].join('  /  ')
      : parts.length > 0 ? [...parts.slice(0, 3), ...(parts.length > 3 ? ['…'] : [])].join('  /  ') : fallbackSummary,
    details: [...(parts.length ? parts : [fallbackSummary]),
      ...(outcome.requiresChoice ? ['Choose cards; later effects depend on your choice.'] : [])].join('\n\n'),
    moltPower: outcome.moltPowerApplied > 0
      ? { total: moltPowerTotal, applied: outcome.moltPowerApplied }
      : undefined,
    result: {
      bossPhaseBreak: phaseBreak,
      targetHp: targetState ? {
        enemyId: targetState.id,
        before: targetState.hpBefore,
        after: targetState.hpAfter,
        max: targetState.maxHp,
        defeated: targetState.defeated
      } : undefined,
      targetCover: targetState ? { before: targetState.blockBefore, after: targetState.blockAfter } : undefined,
      flockCohesion: { before: outcome.flockBefore.hp, after: outcome.flockAfter.hp, max: outcome.flockAfter.maxHp },
      flockCover: { before: outcome.flockBefore.block, after: outcome.flockAfter.block },
      flow: { before: outcome.flockBefore.flow, after: outcome.flockAfter.flow, max: outcome.flockAfter.flowMax }
    }
  };
}

function textureReady(scene: Phaser.Scene, key: string) {
  if (!key || !scene.textures.exists(key)) return false;
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  return true;
}

function renderPile(context: BattleHudRenderContext, pile: BattleHudPileView) {
  const { scene, root, assets, fontFamily, boldFontStyle } = context;
  const { x, y, count, label, onInspect } = pile;
  const hit = scene.add.rectangle(x, y, 104, 112, 0x08121b, 0.36)
    .setStrokeStyle(1, 0x83979e, 0.22)
    .setName('combat-pile-hit').setInteractive({ useHandCursor: true });
  hit.on('pointerdown', onInspect);
  hit.on('pointerover', () => hit.setFillStyle(0x162b36, 0.92).setStrokeStyle(1, 0x8bd0d6, 0.8));
  hit.on('pointerout', () => hit.setFillStyle(0x08121b, 0.36).setStrokeStyle(1, 0x83979e, 0.22));
  context.attachTooltip(hit, label === 'DRAW' ? 'Draw Pile' : 'Discard Pile',
    label === 'DRAW' ? 'Cards left to draw. Click to inspect them.' : 'Cards already discarded. Click to inspect them.');
  root.add(hit);
  if (textureReady(scene, assets.cardBack)) root.add(scene.add.image(x - 21, y - 9, assets.cardBack)
    .setDisplaySize(30, 42).setAlpha(count ? 0.88 : 0.35).setName('combat-card-back'));
  root.add(scene.add.text(x + 21, y - 9, `${count}`, {
    fontFamily, fontSize: '25px', fontStyle: boldFontStyle, color: count ? '#e4eff2' : '#889ba5', resolution: 2
  }).setOrigin(0.5).setName('combat-pile-count').setData('pile', label));
  root.add(scene.add.text(x, y + 30, label, {
    fontFamily, fontSize: '12px', fontStyle: boldFontStyle, color: '#bdcbd2', resolution: 2
  }).setOrigin(0.5).setName('combat-pile-label'));
}

function renderCombatLog(context: BattleHudRenderContext) {
  const { scene, root, fontFamily } = context;
  const x = 650, y = 440;
  const hit = scene.add.rectangle(x, y, 160, MIN_SUPPORTED_TOUCH_TARGET, 0x08121b, 0.22)
    .setInteractive({ useHandCursor: true }).setName('combat-log-hit');
  context.attachTooltip(hit, 'Combat history', `${context.log.tooltip}\n${context.log.historyLabel}. Review up to 256 recent events without changing your selection.`);
  hit.on('pointerdown', context.log.onHistory);
  hit.on('pointerover', () => hit.setFillStyle(0x162b36, 0.95));
  hit.on('pointerout', () => hit.setFillStyle(0x08121b, 0.22));
  root.add(hit);
  root.add(scene.add.text(x, y, 'Combat history', {
    fontFamily, fontSize: '15px', color: '#b7c8d0', resolution: 2,
    wordWrap: { width: 148 }, maxLines: 2, align: 'center'
  }).setOrigin(0.5).setName('combat-log-latest'));
}

export function renderBattleBeatBadge(context: BattleHudRenderContext) {
  const { scene, root, beat, fontFamily, boldFontStyle } = context;
  const beatUi = scene.add.container(0, 0).setName('combat-beat-progress-ui');
  root.add(beatUi);
  const beatX = beat.active ? 1146 : 1190;
  const beatY = 104;
  const frameW = beat.active ? 250 : 148;
  const frameH = beat.active ? 48 : 37;
  beatUi.add(scene.add.rectangle(beatX, beatY, frameW - 30, frameH - 14, 0x07101c, beat.active ? 0.97 : 0.94));

  if (!beat.active) {
    beatUi.add(scene.add.text(1252, beatY, `Beat ${beat.turn}`, {
      fontFamily,
      fontSize: '15px',
      fontStyle: boldFontStyle,
      color: '#fff0b8',
      stroke: '#05070c',
      strokeThickness: 2,
    }).setOrigin(1, 0.5));
    return beatUi;
  }

  const fillColor = beat.phase === 'impact'
    ? 0xff5247
    : beat.phase === 'recovery'
      ? 0x8fd6a0
      : beat.phase === 'release'
        ? 0xff9d4d
        : 0xffcf7a;
  const railX = beatX - 92;
  const railY = beatY + 13;
  const railW = 184;
  beatUi.add(scene.add.rectangle(railX + railW / 2, railY, railW, 6, 0x020409, 0.84)
    .setStrokeStyle(1, 0xffcf7a, 0.28)
    .setName('combat-enemy-beat-progress-rail'));
  const fill = scene.add.rectangle(railX, railY, railW, 6, fillColor, 0.9)
    .setOrigin(0, 0.5)
    .setScale(Math.max(0.025, beat.progress.progress), 1)
    .setName('combat-enemy-beat-progress-fill');
  beatUi.add(fill);
  const remaining = Math.max(0, beat.progress.durationMs - beat.progress.elapsedMs)
    / (beat.acceleration?.active ? beat.acceleration.multiplier : 1);
  if (remaining > 80) {
    scene.tweens.add({ targets: fill, scaleX: 1, duration: remaining, ease: 'Linear' });
  }
  beatUi.add(scene.add.text(beatX - 100, beatY - 11, beat.progress.label.toUpperCase(), {
    fontFamily,
    fontSize: '11px',
    fontStyle: boldFontStyle,
    color: '#ffcf7a',
  }).setOrigin(0, 0.5));
  if (beat.acceleration?.available) {
    beatUi.add(scene.add.text(
      beatX + 100,
      beatY - 11,
      beat.acceleration.active ? `HUSTLE ${beat.acceleration.multiplier}X` : 'HOLD: HUSTLE',
      {
        fontFamily,
        fontSize: '9px',
        fontStyle: boldFontStyle,
        color: beat.acceleration.active ? '#76e6dc' : '#a8b8bf',
      },
    ).setOrigin(1, 0.5).setName('combat-enemy-acceleration-label'));
  }
  beatUi.add(scene.add.text(beatX - 100, beatY + 2, beat.move, {
    fontFamily,
    fontSize: '13px',
    fontStyle: boldFontStyle,
    color: '#f6e6bd',
    stroke: '#05070c',
    strokeThickness: 2,
  }).setOrigin(0, 0.5));
  return beatUi;
}

function renderCommandStrip(context: BattleHudRenderContext) {
  const { scene, root } = context;
  renderCombatLog(context);
  const x = 1192;
  const y = 470;
  const busy = context.beat.active;
  const hit = scene.add.rectangle(x, y, 164, 74, busy ? 0x0c1d25 : 0x12333b, 0.98)
    .setStrokeStyle(1, busy ? 0x526c76 : 0x8df4ff, busy ? 0.5 : 0.72)
    .setName('combat-roost-hit').setInteractive({ useHandCursor: !busy });
  if (!busy) hit.on('pointerdown', context.onRoost);
  context.attachTooltip(hit, busy ? 'Enemy turn' : 'End Turn', busy
    ? 'Enemies are resolving their moves. Your hand returns when they finish.'
    : context.roostDetail ?? 'Roost and let enemies act.');

  root.add(hit);
  if (!busy) {
    hit.on('pointerover', () => hit.setFillStyle(0x20515a, 1));
    hit.on('pointerout', () => hit.setFillStyle(0x12333b, 0.98));
  }
  root.add(scene.add.text(x, y - 17, busy ? 'Enemy turn' : context.roostLabel ?? 'Roost · End Turn', {
      fontFamily: context.fontFamily,
      fontSize: '16px',
      fontStyle: context.boldFontStyle,
      color: busy ? '#aabcc8' : '#fff0b8', resolution: 2,
    }).setOrigin(0.5).setName('combat-roost-label'));
  root.add(scene.add.text(x, y + 14, busy ? 'Your hand returns next' : context.roostPreview ?? 'Enemies act next', {
    fontFamily: context.fontFamily, fontSize: '14px', color: '#dffbff', resolution: 2,
    wordWrap: { width: 152 }, align: 'center',
  }).setOrigin(0.5).setName('combat-roost-preview'));
  return renderBattleBeatBadge(context);
}

function renderGuidance(context: BattleHudRenderContext) {
  if (!context.guidance) return;
  const { scene, root, gameWidth, fontFamily, boldFontStyle, guidance } = context;
  root.add(scene.add.rectangle(gameWidth / 2, 112, 600, 32, 0x06111a, 0.94)
    .setStrokeStyle(2, guidance.accent, 0.8)
    .setName('first-combat-guidance').setData('deferToCard', guidance.text.startsWith('ROOST WHEN')));
  root.add(scene.add.text(gameWidth / 2, 112, guidance.text, {
    fontFamily,
    fontSize: '12px',
    fontStyle: boldFontStyle,
    color: '#f1f8ff',
    fixedWidth: 572,
    align: 'center',
    maxLines: 1,
  }).setOrigin(0.5).setName('first-combat-guidance').setData('deferToCard', guidance.text.startsWith('ROOST WHEN')));
}

function renderObjective(context: BattleHudRenderContext) {
  if (!context.objective) return;
  const { scene, root, fontFamily, boldFontStyle, objective } = context;
  const x = 1068;
  const y = 154;
  const panel = scene.add.rectangle(x, y, 354, 36, 0x07101a, 0.86)
    .setStrokeStyle(1, objective.accent, 0.76)
    .setName('encounter-objective');
  root.add(panel);
  context.attachTooltip(panel, objective.text.split('  /  ')[0] ?? 'Encounter Goal', objective.detail);
  root.add(scene.add.text(x, y, objective.text, {
    fontFamily,
    fontSize: '10px',
    fontStyle: boldFontStyle,
    color: '#e8f1f7',
    fixedWidth: 330,
    align: 'center',
    maxLines: 1,
  }).setOrigin(0.5).setName('encounter-objective'));
}

export function renderBattleSelectionPreview(
  context: BattleSelectionPreviewContext,
  preview: BattleSelectionPreviewView,
) {
  const { scene, root, gameWidth, fontFamily, boldFontStyle } = context;
  // A new decision takes precedence over the previous hit's decoration.
  for (const layer of scene.children.list) {
    if (!(layer instanceof Phaser.GameObjects.Container)) continue;
    for (const object of [...layer.list]) {
      if (object.name === 'combat-number-feedback' && object.getData('placement') === 'target-lane') object.destroy();
    }
  }
  const targetHp = preview.targetHp;
  if (targetHp) {
    const lostWidth = Math.max(2, targetHp.width * (targetHp.beforeFraction - targetHp.afterFraction));
    const left = targetHp.x - targetHp.width / 2;
    const afterX = left + targetHp.width * targetHp.afterFraction;
    const accent = targetHp.defeated ? context.gold : context.cyan;
    root.add(scene.add.rectangle(afterX + lostWidth / 2, targetHp.y, lostWidth, targetHp.height - 6, accent, 0.62)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setName('combat-enemy-outcome-preview'));
    root.add(scene.add.rectangle(afterX, targetHp.y, 2, targetHp.height, accent, 0.96)
      .setName('combat-enemy-outcome-preview'));
    // Exact remaining Cohesion/lethal text lives in the decision forecast.
    // Keep the meter overlay; reserve the row below vitals for enemy statuses.
  }

  const y = 424;
  const container = scene.add.container(0, 0).setName('combat-selection-preview');
  // History and the current decision share one quiet lane above the hand.
  // A card decision temporarily takes precedence over history and the Roost
  // lesson. First-card/Molt teaching remains; cancellation restores the lesson.
  const logObjects = root.list.filter(child => child.name === 'combat-log-hit' || child.name === 'combat-log-latest' || child.getData('deferToCard')) as (Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text)[];
  logObjects.forEach(child => child.setVisible(false));
  container.once(Phaser.GameObjects.Events.DESTROY, () => {
    logObjects.forEach(child => { if (child.active) child.setVisible(true); });
  });
  container.add(scene.add.rectangle(gameWidth / 2, y, 600, 74, 0x07101a, 0.97)
    .setStrokeStyle(1, context.cyan, 0.72)
    .setName('combat-outcome-preview'));
  const title = scene.add.text(gameWidth / 2 - 284, y - 22, '', {
    fontFamily,
    fontSize: '15px',
    fontStyle: boldFontStyle,
    color: '#ffe7a8',
    fixedWidth: 402,
    wordWrap: { width: 402, useAdvancedWrap: true },
    resolution: 2,
    align: 'left',
    maxLines: 1,
  }).setOrigin(0, 0.5).setName('combat-selection-card-target');
  container.add(fitTextExcerpt(title, `${preview.card} → ${preview.target}`, 1));
  container.add(scene.add.rectangle(gameWidth / 2 + 208, y - 22, 144, 22, 0x102534, 0.98)
    .setStrokeStyle(1, context.gold, 0.72)
    .setName('combat-selection-command-frame'));
  container.add(scene.add.text(gameWidth / 2 + 208, y - 22, 'CONFIRM TO PLAY', {
    fontFamily,
    fontSize: '12px',
    resolution: 2,
    fontStyle: boldFontStyle,
    color: '#dffbff',
  }).setOrigin(0.5).setName('combat-selection-command'));
  const summary = scene.add.text(gameWidth / 2, y + 10, '', {
    fontFamily,
    fontSize: '15px',
    resolution: 2,
    fontStyle: boldFontStyle,
    color: '#dffbff',
    fixedWidth: 570,
    wordWrap: { width: 570, useAdvancedWrap: true },
    align: 'center',
    maxLines: 2,
  }).setOrigin(0.5).setName('combat-selection-summary');
  container.add(fitTextExcerpt(summary, preview.summary, 2));
  root.add(container);
  return container;
}

export function renderBattleHud(context: BattleHudRenderContext): BattleHudRenderResult {
  renderBattleHudPiles(context);
  return renderBattleHudOverlay(context);
}

export function renderBattleHudPiles(context: BattleHudRenderContext) {
  context.piles.forEach((pile) => renderPile(context, pile));
}

export function renderBattleHudOverlay(context: BattleHudRenderContext): BattleHudRenderResult {
  const beatUi = renderCommandStrip(context);
  renderGuidance(context);
  renderObjective(context);
  return { beatUi };
}

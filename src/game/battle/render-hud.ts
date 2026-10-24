import Phaser from 'phaser';
import { MIN_SUPPORTED_TOUCH_TARGET, UI_TYPE } from '../theme';
import { fitTextExcerpt } from '../text-excerpt';
import { quietButton } from '../quiet-ui';

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
  bossDisruptions?: string[];
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
  const parts: string[] = outcome.bossDisruptions?.length ? ['Boss attack disrupted'] : [];
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
  const hit = scene.add.rectangle(x, y - 3, 104, 106, 0x08121b, 0.36)
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
    fontFamily, fontSize: '18px', fontStyle: boldFontStyle, color: '#bdcbd2', resolution: 2
  }).setOrigin(0.5).setName('combat-pile-label'));
}

function renderCombatLog(context: BattleHudRenderContext) {
  const { scene, root, fontFamily } = context;
  const x = 1204, y = 687;
  const hit = scene.add.rectangle(x, y, 120, MIN_SUPPORTED_TOUCH_TARGET, 0x08121b, 0.22)
    .setInteractive({ useHandCursor: true }).setName('combat-log-hit');
  context.attachTooltip(hit, 'Combat history', `${context.log.tooltip}\n${context.log.historyLabel}. Review up to 256 recent events without changing your selection.`);
  hit.on('pointerdown', context.log.onHistory);
  hit.on('pointerover', () => hit.setFillStyle(0x162b36, 0.95));
  hit.on('pointerout', () => hit.setFillStyle(0x08121b, 0.22));
  root.add(hit);
  root.add(scene.add.text(x, y, 'Combat history', {
    fontFamily, fontSize: UI_TYPE.secondary, color: '#b7c8d0', resolution: 2,
    wordWrap: { width: 108 }, maxLines: 2, align: 'center'
  }).setOrigin(0.5).setName('combat-log-latest'));
}

export function renderBattleBeatBadge(context: BattleHudRenderContext) {
  const { scene, root, beat, fontFamily, boldFontStyle } = context;
  const beatUi = scene.add.container(0, 0).setName('combat-beat-progress-ui');
  root.add(beatUi);
  const beatX = 1107;
  const beatY = 127;
  if (beat.active) beatUi.add(scene.add.rectangle(beatX, beatY, 306, 58, 0x07101c, 0.97));

  if (!beat.active) {
    beatUi.add(scene.add.text(1252, 111, `Beat ${beat.turn}`, {
      fontFamily,
      fontSize: UI_TYPE.secondary,
      fontStyle: boldFontStyle,
      color: '#fff0b8',
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
  const railX = beatX - 141;
  const railY = beatY + 25;
  const railW = 282;
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
  beatUi.add(scene.add.text(beatX - 141, beatY - 16, beat.progress.label, {
    fontFamily,
    fontSize: UI_TYPE.secondary,
    fontStyle: boldFontStyle,
    color: '#ffcf7a',
    resolution: 2,
  }).setOrigin(0, 0.5).setName('combat-enemy-phase-label'));
  if (beat.acceleration?.available) {
    beatUi.add(scene.add.text(
      beatX + 141,
      beatY - 16,
      beat.acceleration.active ? `Hustle ${beat.acceleration.multiplier}×` : 'Hold: Hustle',
      {
        fontFamily,
        fontSize: UI_TYPE.secondary,
        fontStyle: boldFontStyle,
        color: beat.acceleration.active ? '#76e6dc' : '#a8b8bf', resolution: 2,
      },
    ).setOrigin(1, 0.5).setName('combat-enemy-acceleration-label'));
  }
  const move = scene.add.text(beatX - 141, beatY + 7, '', {
    fontFamily,
    fontSize: UI_TYPE.secondary,
    fontStyle: boldFontStyle,
    color: '#f6e6bd',
    resolution: 2, wordWrap: { width: 282 }, maxLines: 1,
  }).setOrigin(0, 0.5).setName('combat-enemy-move-label');
  beatUi.add(fitTextExcerpt(move, beat.move, 1));
  return beatUi;
}

function renderCommandStrip(context: BattleHudRenderContext) {
  const { scene, root } = context;
  renderCombatLog(context);
  const x = 1196;
  const y = 470;
  const busy = context.beat.active;
  const hit = quietButton(scene, { x, y, width: 164, label: busy ? 'Enemy turn' : context.roostLabel ?? 'Roost',
    name: 'combat-roost-hit', kind: 'primary', enabled: !busy, onActivate: context.onRoost });
  hit.setDisplaySize(164, 92);
  // The busy explanation is visible below; attaching a pointer tooltip would
  // re-register a deliberately disabled control with the input manager.
  if (!busy) context.attachTooltip(hit, 'End Turn', context.roostDetail ?? 'Roost and let enemies act.');

  root.add([hit, hit.getData('labelObject').setY(y - 27).setName('combat-roost-label')]);
  root.add(scene.add.text(x, y + 12, busy ? 'Enemies act\nHand returns' : context.roostPreview ?? 'Enemies act next', {
    fontFamily: context.fontFamily, fontSize: UI_TYPE.secondary, color: busy ? '#a2b1ba' : '#0b151f', resolution: 2,
    wordWrap: { width: 152 }, align: 'center',
  }).setOrigin(0.5).setName('combat-roost-preview'));
  return renderBattleBeatBadge(context);
}

function renderGuidance(context: BattleHudRenderContext) {
  if (!context.guidance) return;
  const { scene, root, gameWidth, fontFamily, boldFontStyle, guidance } = context;
  root.add(scene.add.rectangle(gameWidth / 2 - 220, 126, 600, 58, 0x06111a, 0.94)
    .setStrokeStyle(1, guidance.accent, 0.5)
    .setName('first-combat-guidance').setData('deferToCard', guidance.text.startsWith('Roost when')));
  root.add(scene.add.text(gameWidth / 2 - 220, 126, guidance.text, {
    fontFamily,
    fontSize: UI_TYPE.primary,
    fontStyle: boldFontStyle,
    color: '#f1f8ff',
    wordWrap: { width: 572 }, resolution: 2,
    align: 'center',
  }).setOrigin(0.5).setName('first-combat-guidance').setData('deferToCard', guidance.text.startsWith('Roost when')));
}

function renderObjective(context: BattleHudRenderContext) {
  // The immediate enemy action takes priority while input is locked. Restore
  // the optional goal when the player can act on it again.
  if (!context.objective || context.beat.active || context.guidance) return;
  const { scene, root, fontFamily, boldFontStyle, objective } = context;
  // Reserve the quiet upper-left stage lane: the upper-right belongs to
  // enemy silhouettes. First-flight guidance temporarily owns this lane.
  const x = 280;
  const y = 138;
  const panel = scene.add.rectangle(x, y, 306, 76, 0x07101a, 0.94)
    .setStrokeStyle(1, objective.accent, 0.76)
    .setName('encounter-objective');
  root.add(panel);
  context.attachTooltip(panel, objective.text.split('  /  ')[0] ?? 'Encounter Goal', objective.detail);
  root.add(scene.add.text(x, y, objective.text, {
    fontFamily,
    fontSize: UI_TYPE.secondary,
    fontStyle: boldFontStyle,
    color: '#e8f1f7',
    wordWrap: { width: 282 }, resolution: 2,
    align: 'center',
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

  const y = 412;
  const container = scene.add.container(0, 0).setName('combat-selection-preview');
  // History and the current decision share one quiet lane above the hand.
  // A card decision temporarily takes precedence over history and the Roost
  // lesson. First-card/Molt teaching remains; cancellation restores the lesson.
  const logObjects = root.list.filter(child => child.name === 'combat-log-hit' || child.name === 'combat-log-latest' || child.getData('deferToCard')) as (Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text)[];
  logObjects.forEach(child => child.setVisible(false));
  container.once(Phaser.GameObjects.Events.DESTROY, () => {
    logObjects.forEach(child => { if (child.active) child.setVisible(true); });
  });
  container.add(scene.add.rectangle(gameWidth / 2, y, 600, 52, 0x07101a, 0.97)
    .setStrokeStyle(1, context.cyan, 0.72)
    .setName('combat-outcome-preview'));
  const title = scene.add.text(gameWidth / 2 - 284, y - 13, '', {
    fontFamily,
    fontSize: '19px',
    fontStyle: boldFontStyle,
    color: '#ffe7a8',
    fixedWidth: 368,
    wordWrap: { width: 368, useAdvancedWrap: true },
    resolution: 2,
    align: 'left',
    maxLines: 1,
  }).setOrigin(0, 0.5).setName('combat-selection-card-target');
  container.add(fitTextExcerpt(title, `${preview.card} → ${preview.target}`, 1));
  container.add(scene.add.rectangle(gameWidth / 2 + 190, y - 13, 188, 24, 0x102534, 0.98)
    .setStrokeStyle(1, context.gold, 0.72)
    .setName('combat-selection-command-frame'));
  container.add(scene.add.text(gameWidth / 2 + 190, y - 13, 'CONFIRM TO PLAY', {
    fontFamily,
    fontSize: '19px',
    resolution: 2,
    fontStyle: boldFontStyle,
    color: '#dffbff',
  }).setOrigin(0.5).setName('combat-selection-command'));
  const summary = scene.add.text(gameWidth / 2, y + 13, '', {
    fontFamily,
    fontSize: '19px',
    resolution: 2,
    fontStyle: boldFontStyle,
    color: '#dffbff',
    fixedWidth: 570,
    wordWrap: { width: 570, useAdvancedWrap: true },
    align: 'center',
    maxLines: 1,
  }).setOrigin(0.5).setName('combat-selection-summary');
  container.add(fitTextExcerpt(summary, preview.summary, 1));
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

import Phaser from 'phaser';
import { MIN_SUPPORTED_TOUCH_TARGET } from '../theme';

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
  };
  beat: BattleHudBeatView;
  guidance?: BattleHudGuidanceView;
  objective?: BattleHudObjectiveView;
  onRoost: () => void;
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
  if (targetState && targetState.hpAfter !== targetState.hpBefore) {
    parts.push(targetState.defeated
      ? `Cohesion ${targetState.hpBefore} -> DEFEATED`
      : `Cohesion ${targetState.hpBefore} -> ${targetState.hpAfter}`);
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
    summary: parts.length > 0 ? parts.slice(0, 3).join('  /  ') : fallbackSummary,
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
  const { x, y, count, label, accent, onInspect } = pile;
  const hasCards = count > 0;
  const hit = scene.add.rectangle(x, y, 104, 132, 0x000000, 0.001)
    .setInteractive({ useHandCursor: true });
  hit.on('pointerdown', onInspect);
  context.attachTooltip(
    hit,
    label === 'DRAW' ? 'Draw Pile' : 'Discard Pile',
    label === 'DRAW' ? 'Cards left to draw. Click to inspect them.' : 'Cards already discarded. Click to inspect them.',
  );
  root.add(hit);

  if (textureReady(scene, assets.pileDock)) {
    root.add(scene.add.image(x, y - 10, assets.pileDock)
      .setDisplaySize(164, 122)
      .setAlpha(hasCards ? 0.72 : 0.46)
      .setName('combat-pile-dock'));
  }

  if (textureReady(scene, assets.cardBack)) {
    root.add(scene.add.image(x, y - 10, assets.cardBack)
      .setDisplaySize(78, 104)
      .setAlpha(hasCards ? 0.96 : 0.42)
      .setAngle(label === 'DRAW' ? -5 : 5)
      .setName('combat-card-back'));
  } else {
    root.add(scene.add.rectangle(x, y - 10, 78, 104, 0x16243c, hasCards ? 0.96 : 0.42)
      .setStrokeStyle(2, 0x7ab8d6, 1)
      .setAngle(label === 'DRAW' ? -5 : 5)
      .setName('combat-card-back-fallback'));
  }

  const iconKey = label === 'DRAW' ? assets.drawIcon : assets.discardIcon;
  if (textureReady(scene, iconKey)) {
    root.add(scene.add.image(x, y - 18, iconKey)
      .setDisplaySize(70, 70)
      .setAlpha(hasCards ? 0.86 : 0.34));
  }

  const countY = y + 64;
  root.add(scene.add.circle(x, countY, 18, 0x07101c, 1).setStrokeStyle(2, accent, 1));
  root.add(scene.add.text(x, countY, `${count}`, {
    fontFamily,
    fontSize: '18px',
    fontStyle: boldFontStyle,
    color: '#ffffff',
  }).setOrigin(0.5));
}

function renderCombatLog(context: BattleHudRenderContext) {
  const { scene, root, assets, fontFamily } = context;
  const x = 650;
  const y = 404;
  const w = 326;
  const h = 38;
  const hit = scene.add.rectangle(x, y, w, Math.max(h, MIN_SUPPORTED_TOUCH_TARGET), 0x000000, 0.001)
    .setInteractive({ useHandCursor: true })
    .setName('combat-log-hit');
  context.attachTooltip(hit, 'Combat Log', context.log.tooltip);

  root.add(scene.add.rectangle(x, y, w - 36, h - 14, 0x07111a, 0.42)
    .setStrokeStyle(1, 0x101b27, 0.52)
    .setName('combat-log-frame-backplate'));
  if (textureReady(scene, assets.logFrame)) {
    root.add(scene.add.image(x, y, assets.logFrame)
      .setDisplaySize(w, h)
      .setAlpha(0.26)
      .setName('combat-log-frame'));
  } else {
    root.add(scene.add.rectangle(x, y, w - 20, h - 18, 0x07111a, 0.78)
      .setStrokeStyle(2, 0xd8a840, 0.7)
      .setName('combat-log-frame-fallback'));
  }
  root.add(hit);

  const beadX = x - 135;
  if (textureReady(scene, assets.logEventBead)) {
    root.add(scene.add.image(beadX, y, assets.logEventBead)
      .setDisplaySize(18, 18)
      .setAlpha(0.7)
      .setName('combat-log-event-bead'));
  }
  root.add(scene.add.text(x - 119, y, context.log.latest, {
    fontFamily,
    fontSize: '12px',
    color: '#d9e4ee',
    fixedWidth: 246,
    maxLines: 1,
  }).setOrigin(0, 0.5));
}

export function renderBattleBeatBadge(context: BattleHudRenderContext) {
  const { scene, root, assets, beat, fontFamily, boldFontStyle } = context;
  const beatUi = scene.add.container(0, 0).setName('combat-beat-progress-ui');
  root.add(beatUi);
  const beatX = beat.active ? 1146 : 1190;
  const beatY = 104;
  const frameW = beat.active ? 250 : 148;
  const frameH = beat.active ? 48 : 37;
  beatUi.add(scene.add.rectangle(beatX, beatY, frameW - 30, frameH - 14, 0x07101c, beat.active ? 0.97 : 0.94));
  if (textureReady(scene, assets.beatProgressFrame)) {
    beatUi.add(scene.add.image(beatX, beatY, assets.beatProgressFrame)
      .setDisplaySize(frameW, frameH)
      .setAlpha(1)
      .setName('combat-beat-progress-frame'));
  } else {
    beatUi.add(scene.add.rectangle(beatX, beatY, frameW - 10, frameH - 6, 0x10202c, 0.72)
      .setStrokeStyle(1, 0xd8a840, 0.62)
      .setName('combat-beat-progress-frame-fallback'));
  }

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
  const { scene, root, assets } = context;
  renderCombatLog(context);
  const x = 1192;
  const y = 470;
  const hit = scene.add.rectangle(x, y, 104, 104, 0x000000, 0.001)
    .setInteractive({ useHandCursor: true });
  hit.on('pointerdown', context.onRoost);
  context.attachTooltip(hit, 'End Turn', 'Roost and let enemies act.');

  if (textureReady(scene, assets.roostCommandFrame)) {
    const frame = scene.add.image(x, y, assets.roostCommandFrame)
      .setDisplaySize(116, 116)
      .setAlpha(0.82)
      .setName('combat-roost-command-frame');
    hit.on('pointerover', () => frame.setAlpha(0.96));
    hit.on('pointerout', () => frame.setAlpha(0.82));
    root.add(frame);
  }
  root.add(hit);
  if (textureReady(scene, assets.roostIcon)) {
    const icon = scene.add.image(x, y, assets.roostIcon).setDisplaySize(74, 74).setAlpha(0.95);
    hit.on('pointerover', () => icon.setDisplaySize(74, 74).setAlpha(1));
    hit.on('pointerout', () => icon.setDisplaySize(74, 74).setAlpha(0.95));
    root.add(icon);
  } else {
    root.add(scene.add.text(x, y, 'ROOST', {
      fontFamily: context.fontFamily,
      fontSize: '14px',
      fontStyle: context.boldFontStyle,
      color: '#fff0b8',
    }).setOrigin(0.5));
  }
  return renderBattleBeatBadge(context);
}

function renderGuidance(context: BattleHudRenderContext) {
  if (!context.guidance) return;
  const { scene, root, gameWidth, fontFamily, boldFontStyle, guidance } = context;
  root.add(scene.add.rectangle(gameWidth / 2, 112, 600, 32, 0x06111a, 0.94)
    .setStrokeStyle(2, guidance.accent, 0.8)
    .setName('first-combat-guidance'));
  root.add(scene.add.text(gameWidth / 2, 112, guidance.text, {
    fontFamily,
    fontSize: '12px',
    fontStyle: boldFontStyle,
    color: '#f1f8ff',
    fixedWidth: 572,
    align: 'center',
    maxLines: 1,
  }).setOrigin(0.5).setName('first-combat-guidance'));
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
  const targetHp = preview.targetHp;
  if (targetHp) {
    const lostWidth = Math.max(2, targetHp.width * (targetHp.beforeFraction - targetHp.afterFraction));
    const left = targetHp.x - targetHp.width / 2;
    const afterX = left + targetHp.width * targetHp.afterFraction;
    const accent = targetHp.defeated ? context.gold : context.cyan;
    root.add(scene.add.rectangle(afterX + lostWidth / 2, targetHp.y, lostWidth, targetHp.height - 6, accent, 0.62)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setName('combat-enemy-outcome-preview'));
    root.add(scene.add.rectangle(afterX, targetHp.y, 2, targetHp.height + 10, accent, 0.96)
      .setName('combat-enemy-outcome-preview'));
    const labelY = targetHp.y + 27;
    root.add(scene.add.rectangle(targetHp.x, labelY, targetHp.defeated ? 104 : 88, 19, 0x06111a, 0.96)
      .setStrokeStyle(1, accent, 0.82)
      .setName('combat-enemy-outcome-preview'));
    root.add(scene.add.text(targetHp.x, labelY, targetHp.defeated ? 'LETHAL' : `AFTER ${targetHp.after}`, {
      fontFamily,
      fontSize: '10px',
      fontStyle: boldFontStyle,
      color: targetHp.defeated ? '#ffe7a8' : '#dffbff',
      stroke: '#02060b',
      strokeThickness: 2,
    }).setOrigin(0.5).setName('combat-enemy-outcome-preview'));
  }

  const y = 440;
  const container = scene.add.container(0, 0).setName('combat-selection-preview');
  container.add(scene.add.rectangle(gameWidth / 2, y, 600, 42, 0x07101a, 0.97)
    .setStrokeStyle(2, context.cyan, 0.88)
    .setName('combat-outcome-preview'));
  container.add(scene.add.text(gameWidth / 2 - 284, y - 9, `${preview.card}  →  ${preview.target}`, {
    fontFamily,
    fontSize: '11px',
    fontStyle: boldFontStyle,
    color: '#ffe7a8',
    fixedWidth: 402,
    align: 'left',
    maxLines: 1,
  }).setOrigin(0, 0.5).setName('combat-selection-card-target'));
  container.add(scene.add.rectangle(gameWidth / 2 + 208, y - 9, 144, 18, 0x102534, 0.98)
    .setStrokeStyle(1, context.gold, 0.72)
    .setName('combat-selection-command-frame'));
  container.add(scene.add.text(gameWidth / 2 + 208, y - 9, 'CONFIRM TO PLAY', {
    fontFamily,
    fontSize: '10px',
    fontStyle: boldFontStyle,
    color: '#dffbff',
  }).setOrigin(0.5).setName('combat-selection-command'));
  container.add(scene.add.text(gameWidth / 2, y + 9, preview.summary, {
    fontFamily,
    fontSize: '11px',
    fontStyle: boldFontStyle,
    color: '#dffbff',
    fixedWidth: 570,
    align: 'center',
    maxLines: 1,
  }).setOrigin(0.5).setName('combat-selection-summary'));
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

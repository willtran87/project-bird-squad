import Phaser from 'phaser';
import { MIN_SUPPORTED_TOUCH_TARGET } from './theme';

export interface BossDossierEnemy {
  id: string;
  name: string;
  type: string;
  moves: Array<{ id: string }>;
}

export interface BossDossierUpdate {
  id: string;
  name: string;
  kind: 'dossier';
  description: string;
}

type OutcomeHighlightKind = 'leader' | 'achievement' | 'contract' | 'dossier' | 'record';
export interface OutcomeHighlight {
  id: string;
  name: string;
  kind: OutcomeHighlightKind;
  description: string;
}

interface OutcomeRewards {
  newLeaders: string[];
  newAchievements: string[];
  newContractBadges: string[];
  newEnemyMoves: string[];
  newPersonalRecords: Array<{
    leaderId: string;
    mode: 'full' | 'quick';
    tier: number;
    turns: number;
    firstClear: boolean;
    newAscensionClear: boolean;
  }>;
  account: { observedEnemyMoves: string[] };
}

interface OutcomeLookups {
  leader: (id: string) => { name: string; description: string };
  achievement: (id: string) => { name: string; description: string };
  contract: (id: string) => { name: string; description: string };
  enemy: EnemyLookup;
}

type EnemyLookup = (id: string) => BossDossierEnemy | undefined;

export interface CodexBossMove {
  id?: string;
  text: string;
}

export interface DiscoveryCard {
  id: string;
  suit?: string | null;
  kind?: string;
  runtime?: { suit?: string | null; kind?: string };
}

export interface CardDiscoveryProgress {
  id: string;
  name: string;
  found: number;
  total: number;
  stage: string;
  complete: boolean;
  nextMilestone: string;
  nextTarget: number;
}

const discoverySetNames: Record<string, string> = {
  major: 'Major Arcana',
  aviary: 'Aviary',
  plumes: 'Plumes',
  quills: 'Quills',
  basins: 'Basins',
  nests: 'Nests',
  snags: 'Snags'
};

function discoverySetId(card: DiscoveryCard) {
  if (card.id.startsWith('major_')) return 'major';
  if (card.id.startsWith('aviary_')) return 'aviary';
  const kind = card.runtime?.kind ?? card.kind;
  const suit = card.runtime?.suit ?? card.suit;
  if (kind === 'snag') return 'snags';
  return suit && discoverySetNames[suit] ? suit : undefined;
}

export function cardDiscoverySets(cards: DiscoveryCard[], discoveredCardIds: Iterable<string>): CardDiscoveryProgress[] {
  const discovered = new Set(discoveredCardIds);
  return Object.entries(discoverySetNames).map(([id, name]) => {
    const setCards = cards.filter((card) => discoverySetId(card) === id);
    const found = setCards.filter((card) => discovered.has(card.id)).length;
    const quarter = Math.ceil(setCards.length * 0.25);
    const half = Math.ceil(setCards.length * 0.5);
    const nextTarget = found < quarter ? quarter : found < half ? half : setCards.length;
    const complete = found >= setCards.length;
    return {
      id,
      name,
      found,
      total: setCards.length,
      stage: complete ? 'Set Sealed' : found >= half ? 'Field Notes' : found >= quarter ? 'Trail Open' : 'Uncharted',
      complete,
      nextMilestone: complete ? 'Complete' : nextTarget === setCards.length ? 'Set Seal' : nextTarget === half ? 'Field Notes' : 'Trail Mark',
      nextTarget
    };
  });
}

export function nextCardDiscoveryGoal(cards: DiscoveryCard[], discoveredCardIds: string[]) {
  const sets = cardDiscoverySets(cards, discoveredCardIds)
    .filter((set) => set.found > 0 && !set.complete)
    .sort((a, b) => (a.nextTarget - a.found) - (b.nextTarget - b.found) || (b.found / b.total) - (a.found / a.total));
  const set = sets[0];
  if (!set) return undefined;
  const remaining = set.nextTarget - set.found;
  return {
    name: set.name,
    milestone: set.nextMilestone,
    remaining,
    label: `${set.name.toUpperCase()} ${set.nextMilestone.toUpperCase()}  /  Discover ${remaining} more card${remaining === 1 ? '' : 's'}`
  };
}

export function renderCardCollectionRail(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  progress: CardDiscoveryProgress,
  options: { x: number; y: number; width: number; accent: number; fontFamily: string; boldStyle: string }
) {
  const left = options.x - options.width / 2;
  const barX = left + 12;
  const barW = options.width - 24;
  const fillW = progress.total > 0 ? barW * progress.found / progress.total : 0;
  root.add(scene.add.rectangle(options.x, options.y, options.width, 42, 0x06101a, 0.94)
    .setStrokeStyle(1, options.accent, progress.complete ? 0.9 : 0.48)
    .setName('codex-card-collection-rail'));
  root.add(scene.add.text(left + 12, options.y - 15, `${progress.name.toUpperCase()} COLLECTION`, {
    fontFamily: options.fontFamily, fontSize: '10px', fontStyle: options.boldStyle, color: '#dffbff'
  }));
  root.add(scene.add.text(left + options.width - 12, options.y - 15, `${progress.stage.toUpperCase()}  ${progress.found}/${progress.total}`, {
    fontFamily: options.fontFamily, fontSize: '10px', fontStyle: options.boldStyle, color: progress.complete ? '#ffe1a3' : '#a8bac9'
  }).setOrigin(1, 0));
  root.add(scene.add.rectangle(barX, options.y + 10, barW, 5, 0x172534, 0.95).setOrigin(0, 0.5));
  if (fillW > 0) root.add(scene.add.rectangle(barX, options.y + 10, fillW, 5, options.accent, 0.92).setOrigin(0, 0.5));
  [0.25, 0.5, 1].forEach((mark) => {
    const reached = progress.found / Math.max(1, progress.total) >= mark;
    root.add(scene.add.circle(barX + barW * mark, options.y + 10, mark === 1 ? 4 : 3, reached ? options.accent : 0x344657, reached ? 1 : 0.9)
      .setStrokeStyle(1, reached ? 0xffe1a3 : 0x617487, reached ? 0.7 : 0.42));
  });
}

export function codexBossDossier(
  enemyId: string,
  moves: CodexBossMove[],
  observedMoveKeys: ReadonlySet<string>,
  concealMoves: boolean
) {
  const rows = moves.map((move) => {
    const revealed = !concealMoves || !move.id || observedMoveKeys.has(`${enemyId}:${move.id}`);
    return {
      text: revealed ? `- ${move.text}` : '- Undocumented tactic - face this boss to reveal',
      revealed
    };
  });
  return { observed: rows.filter((row) => row.revealed).length, total: rows.length, rows };
}

export function bossDossierUpdates(
  newMoveKeys: string[],
  observedMoveKeys: string[],
  enemyById: EnemyLookup
): BossDossierUpdate[] {
  const observed = new Set(observedMoveKeys);
  const enemyIds = [...new Set(newMoveKeys.map((key) => key.split(':')[0]))];
  return enemyIds.flatMap((enemyId) => {
    const enemy = enemyById(enemyId);
    if (enemy?.type !== 'boss') return [];
    const count = enemy.moves.filter((move) => observed.has(`${enemy.id}:${move.id}`)).length;
    return [{
      id: `dossier:${enemy.id}`,
      name: `${enemy.name} Dossier`,
      kind: 'dossier' as const,
      description: `${count} / ${enemy.moves.length} tactics observed in combat.`
    }];
  });
}

export function outcomeProgressionHighlights(rewards: OutcomeRewards, lookups: OutcomeLookups): OutcomeHighlight[] {
  const records = rewards.newPersonalRecords.map((record) => {
    const leader = lookups.leader(record.leaderId);
    const modeLabel = record.mode === 'quick' ? 'Quick' : 'Full';
    return {
      id: `record:${record.leaderId}:${record.mode}:${record.tier}:${record.firstClear ? 'clear' : 'speed'}`,
      kind: 'record' as const,
      name: record.newAscensionClear
        ? `${leader.name} Ascension ${record.tier} Clear`
        : `${leader.name} ${modeLabel} A${record.tier} ${record.firstClear ? 'Clear' : 'Record'}`,
      description: record.firstClear
        ? `First ${modeLabel.toLowerCase()} clear at Ascension ${record.tier}: ${record.turns} beats.`
        : `New ${modeLabel.toLowerCase()} Ascension ${record.tier} record: ${record.turns} beats.`,
    };
  });
  const leaders = rewards.newLeaders.map((id) => ({ id, kind: 'leader' as const, ...lookups.leader(id) }));
  const achievements = rewards.newAchievements.map((id) => ({ id, kind: 'achievement' as const, ...lookups.achievement(id) }));
  const contracts = rewards.newContractBadges.map((badge) => ({
    id: badge,
    kind: 'contract' as const,
    ...lookups.contract(badge.split(':').slice(1).join(':'))
  }));
  return [
    ...records,
    ...leaders,
    ...achievements,
    ...contracts,
    ...bossDossierUpdates(rewards.newEnemyMoves, rewards.account.observedEnemyMoves, lookups.enemy)
  ];
}

export function nextBossDossierGoal(
  encounteredEnemyIds: string[],
  observedMoveKeys: string[],
  enemyById: EnemyLookup
): { name: string; remaining: number } | undefined {
  const boss = encounteredEnemyIds.map(enemyById).reverse().find((enemy) => enemy?.type === 'boss');
  if (!boss) return undefined;
  const observed = new Set(observedMoveKeys);
  const remaining = boss.moves.filter((move) => !observed.has(`${boss.id}:${move.id}`)).length;
  return remaining > 0 ? { name: boss.name, remaining } : undefined;
}

export function renderOutcomeUnlockStrip(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  highlights: OutcomeHighlight[],
  x: number,
  y: number,
  w: number,
  win: boolean,
  options: {
    flourishKey: string;
    reducedMotion: boolean;
    fontFamily: string;
    boldStyle: string;
    brass: number;
    cyan: number;
    addIcon: (x: number, y: number) => Phaser.GameObjects.Image | undefined;
  }
) {
  const h = 54;
  const iconX = x + 34;
  const accent = win ? options.brass : 0xff9d6b;
  if (scene.textures.exists(options.flourishKey)) {
    scene.textures.get(options.flourishKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    const flourish = scene.add.image(x + w / 2, y - 8, options.flourishKey)
      .setDisplaySize(w + 24, 82)
      .setAlpha(win ? 0.08 : 0.06);
    if (!win) flourish.setTint(0xffa47c);
    root.add(flourish);
    if (!options.reducedMotion) {
      scene.tweens.add({
        targets: flourish,
        alpha: win ? 0.052 : 0.038,
        scaleX: flourish.scaleX * 1.018,
        scaleY: flourish.scaleY * 1.018,
        duration: 1280,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
  }
  root.add(scene.add.rectangle(x + w / 2, y, w, h, 0x06101a, 0.94)
    .setStrokeStyle(2, accent, 0.72));
  root.add(scene.add.rectangle(x + w / 2, y - h / 2 + 5, w - 18, 3, win ? options.cyan : 0xff9d6b, 0.62));
  const icon = options.addIcon(iconX, y);
  if (icon) root.add(icon.setAlpha(win ? 0.98 : 0.86));
  else root.add(scene.add.circle(iconX, y, 18, accent, 0.42).setStrokeStyle(2, accent, 0.8));

  const leaderCount = highlights.filter((item) => item.kind === 'leader').length;
  const dossierCount = highlights.filter((item) => item.kind === 'dossier').length;
  const recordCount = highlights.filter((item) => item.kind === 'record').length;
  const badgeCount = highlights.length - leaderCount - dossierCount - recordCount;
  const labelParts = [
    recordCount ? `${recordCount} record${recordCount === 1 ? '' : 's'}` : '',
    leaderCount ? `${leaderCount} leader${leaderCount === 1 ? '' : 's'}` : '',
    badgeCount ? `${badgeCount} badge${badgeCount === 1 ? '' : 's'}` : '',
    dossierCount ? `${dossierCount} dossier update${dossierCount === 1 ? '' : 's'}` : ''
  ].filter(Boolean);
  const names = highlights.map((item) => item.name);
  const visibleNames = names.slice(0, 3).join(' / ');
  const overflow = names.length > 3 ? ` / +${names.length - 3} more` : '';
  root.add(scene.add.text(x + 68, y - 15, `${recordCount ? 'NEW PROGRESS' : 'NEW UNLOCKS'}: ${labelParts.join(' + ')}`, {
    fontFamily: options.fontFamily,
    fontSize: '12px',
    fontStyle: options.boldStyle,
    color: win ? '#ffe1a3' : '#ffcfaa',
    fixedWidth: w - 90
  }));
  root.add(scene.add.text(x + 68, y + 7, `${visibleNames}${overflow}`, {
    fontFamily: options.fontFamily,
    fontSize: '14px',
    fontStyle: options.boldStyle,
    color: '#eaf6ff',
    fixedWidth: w - 92,
    maxLines: 1
  }));
}

export function renderOutcomeStats(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  stats: Array<[string, string]>,
  options: {
    labelX: number;
    valueX: number;
    hasUnlocks: boolean;
    reportFrameLoaded: boolean;
    softAccent: number;
    win: boolean;
    rowFrameKey: string;
    fontFamily: string;
    boldStyle: string;
    mutedColor: string;
  }
) {
  const startY = options.hasUnlocks ? 312 : 266;
  const gap = options.hasUnlocks ? 22 : 28;
  const rowH = options.hasUnlocks ? 20 : 25;
  const fontSize = options.hasUnlocks ? '13px' : '15px';
  const centerX = (options.labelX + options.valueX) / 2;
  const frameLoaded = scene.textures.exists(options.rowFrameKey);
  if (frameLoaded) scene.textures.get(options.rowFrameKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
  if (options.reportFrameLoaded) {
    const matY = startY + ((stats.length - 1) * gap) / 2;
    root.add(scene.add.rectangle(centerX, matY, 500, options.hasUnlocks ? 246 : 316, 0x03070d, 0.98)
      .setStrokeStyle(1, options.softAccent, 0.16));
  }
  stats.forEach((row, index) => {
    const y = startY + index * gap;
    root.add(scene.add.rectangle(centerX, y, 448, rowH, 0x050a12, index % 2 === 0 ? 0.72 : 0.58));
    if (frameLoaded) {
      const frame = scene.add.image(centerX, y, options.rowFrameKey)
        .setDisplaySize(466, options.hasUnlocks ? 26 : 31)
        .setAlpha(options.win ? 0.54 : 0.44)
        .setName('run-outcome-stat-row-frame');
      if (!options.win) frame.setTint(0xffb195);
      root.add(frame);
    }
    root.add(scene.add.text(options.labelX, y, row[0], {
      fontFamily: options.fontFamily, fontSize, color: options.mutedColor
    }).setOrigin(0, 0.5));
    root.add(scene.add.text(options.valueX, y, row[1], {
      fontFamily: options.fontFamily, fontSize, fontStyle: options.boldStyle, color: '#eaf1f8'
    }).setOrigin(1, 0.5));
  });
}

export function playOutcomeRevealFx(options: {
  win: boolean;
  color: number;
  hasUnlocks: boolean;
  reducedMotion: boolean;
  pulseRing: (x: number, y: number, color: number, radius: number, duration: number) => void;
  moteBurst: (x: number, y: number, color: number, config: Record<string, unknown>) => void;
  playAnimation: (key: string, x: number, y: number, config: Record<string, unknown>) => void;
}) {
  if (options.reducedMotion) return;
  const x = 640;
  const y = 156;
  options.pulseRing(x, y, options.color, options.win ? 58 : 50, 500);
  options.moteBurst(x, y + 12, options.color, {
    count: options.win ? 10 : 8,
    speed: options.win ? 92 : 78,
    lifespan: options.win ? 460 : 380,
    angle: options.win ? { min: 205, max: 335 } : { min: 20, max: 160 },
    scale: options.win ? 0.42 : 0.36,
    gravityY: options.win ? 12 : 28,
    spreadX: 28,
    spreadY: 5
  });
  options.playAnimation(options.win ? 'fx-open-sky' : 'fx-hostile', x, y + 2, {
    scale: options.win ? 0.5 : 0.46,
    alpha: 0.18,
    tint: options.win ? undefined : 0xff7a6e,
    additive: true
  });
  if (!options.hasUnlocks) return;
  options.pulseRing(x + 140, 270, 0xe8b830, 74, 720);
  options.moteBurst(x + 140, 270, 0xe8b830, {
    count: 18,
    speed: 120,
    lifespan: 640,
    angle: { min: 190, max: 350 },
    scale: 0.62,
    gravityY: 24,
    spreadX: 42,
    spreadY: 6
  });
}

export function renderOutcomeCommand(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  options: {
    x: number;
    textX: number;
    label: string;
    labelColor: string;
    iconId: string;
    iconX: number;
    baseFill: number;
    hoverFill: number;
    stroke: number;
    frameTint?: number;
    frameKey: string;
    fontFamily: string;
    boldStyle: string;
    onActivate: () => void;
    addIcon: (id: string, x: number, y: number) => Phaser.GameObjects.Image | undefined;
  }
) {
  const frameLoaded = scene.textures.exists(options.frameKey);
  if (frameLoaded) scene.textures.get(options.frameKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
  const visual = scene.add.rectangle(options.x, 582, 256, 52, options.baseFill, frameLoaded ? 0.18 : 0.98)
    .setStrokeStyle(2, options.stroke, frameLoaded ? 0.28 : 1);
  root.add(visual);
  let frame: Phaser.GameObjects.Image | undefined;
  if (frameLoaded) {
    frame = scene.add.image(options.x, 582, options.frameKey)
      .setDisplaySize(278, 74)
      .setAlpha(0.86)
      .setName('run-outcome-command-frame');
    if (options.frameTint) frame.setTint(options.frameTint);
    root.add(frame);
  }
  const hit = scene.add.rectangle(options.x, 582, 256, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
    .setInteractive({ useHandCursor: true })
    .setName('run-outcome-command-hit')
    .setData('label', options.label);
  root.add(hit);
  hit.on('pointerover', () => {
    visual.setFillStyle(options.hoverFill, frameLoaded ? 0.28 : 1);
    frame?.setAlpha(0.94);
  });
  hit.on('pointerout', () => {
    visual.setFillStyle(options.baseFill, frameLoaded ? 0.18 : 0.98);
    frame?.setAlpha(0.86);
  });
  hit.on('pointerdown', options.onActivate);
  const icon = options.addIcon(options.iconId, options.iconX, 582);
  if (icon) root.add(icon.setAlpha(0.9));
  root.add(scene.add.text(options.textX, 582, options.label, {
    fontFamily: options.fontFamily,
    fontSize: '20px',
    fontStyle: options.boldStyle,
    color: options.labelColor
  }).setOrigin(0.5));
}

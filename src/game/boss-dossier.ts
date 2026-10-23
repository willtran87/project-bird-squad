import { UI_DISPLAY_FONT as TOKEN_DISPLAY_FONT } from './ui-tokens';
import Phaser from 'phaser';
import { quietButton } from './quiet-ui';
import { startOwnedCopy } from './owned-copy';
import { fitTextExcerpt } from './text-excerpt';
import { measuredReadingPages } from './decision-surface';
import { copySharedRouteLink, type SharedRouteMode } from './run-challenge';
import { MIN_SUPPORTED_TOUCH_TARGET } from './theme';
import { controlPanelOwnsInput } from './input-bindings';
import { announceScreenReader } from './screen-reader-accessibility';
import type { RouteNodeType, RuntimeRouteMap } from './types';

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

interface DefeatReviewDamage {
  enemyId: string;
  moveId: string;
  moveLabel: string;
  damageTaken: number;
  blockedDamage: number;
  hitCount: number;
}

interface DefeatReviewRunSummary {
  killedBy?: string;
  combatResults: Array<{
    killedByMove?: string;
    damageTakenByMove?: DefeatReviewDamage[];
  }>;
  decisionStats?: {
    overextensions?: number;
    lowCardTurns?: number;
    unspentWingbeatAtRoost?: number;
  };
}

export interface DefeatReview {
  fatalMove: string;
  signal: 'OPEN SKY' | 'UNSPENT WINGBEATS' | 'UNCOVERED TELL' | 'LOW TEMPO' | 'SEEDED RETRY';
  headline: string;
  evidence: string;
  tip: string;
  replayNote: string;
  topPressure?: DefeatReviewDamage;
}

export interface OutcomeFlightDetails {
  deck: string[];
  path: string[];
  waymarks: string[];
  supplies: string[];
  decisions: string[];
  results: string[];
}

interface OutcomeFlightSummary extends DefeatReviewRunSummary {
  seed: string;
  result: 'win' | 'loss';
  difficulty?: number;
  runMode: string;
  finalNodeId: string;
  turnsTaken: number;
  durationMs: number;
  currentCohesion: number;
  maxCohesion: number;
  scrapEarned: number;
  scrapSpent: number;
  finalScrap: number;
  path: string[];
  deck: Array<{ id: string; upgraded?: boolean }>;
  routeMarks: string[];
  suppliesUsed: string[];
  signals: Array<{ signalId: string; choiceKey: string }>;
  cardRewards: Array<{ picked?: string; skipped: boolean }>;
  routeDecisions: Array<{ decisionMs: number }>;
  combatResults: Array<DefeatReviewRunSummary['combatResults'][number] & {
    damageDealt: number;
    cohesionLost: number;
    objective?: { status: 'complete' | 'failed' | 'active' };
  }>;
  decisionStats?: {
    cardsPlayed: number;
    overextensions: number;
    unspentWingbeatAtRoost: number;
    blockedDamage: number;
  };
}

interface OutcomeFlightDetailsLookups {
  maps: Array<{ map: RuntimeRouteMap; mapIndex: number }>;
  cardName: (id: string) => string;
  routeNodeTypeLabel: (type: RouteNodeType) => string;
  waymarkName: (id: string) => string;
  supplyName: (id: string) => string;
  signalChoice: (signalId: string, choiceKey: string) => string;
  difficultyLabel: (tier: number) => string;
}

export function buildOutcomeFlightDetails(
  summary: OutcomeFlightSummary,
  lookups: OutcomeFlightDetailsLookups,
): OutcomeFlightDetails {
  const deck = summary.deck.map((saved, index) => (
    `${String(index + 1).padStart(2, '0')} · ${lookups.cardName(saved.id)}${saved.upgraded ? '+' : ''}`
  ));
  const pathIds = [...summary.path];
  if (summary.finalNodeId && !pathIds.includes(summary.finalNodeId)) pathIds.push(summary.finalNodeId);
  const path = pathIds.map((id, index) => {
    const located = lookups.maps.map(({ map, mapIndex }) => ({
      mapIndex,
      node: map.nodes.find((candidate) => candidate.id === id),
    })).find((entry) => entry.node);
    const district = located ? located.mapIndex + 1 : '?';
    return `${String(index + 1).padStart(2, '0')} · D${district} ${located?.node ? lookups.routeNodeTypeLabel(located.node.type).toUpperCase() : 'STOP'} · ${located?.node?.label ?? id}`;
  });
  const pickedRewards = summary.cardRewards
    .filter((reward) => reward.picked)
    .map((reward) => lookups.cardName(reward.picked!));
  const skippedRewards = summary.cardRewards.filter((reward) => reward.skipped).length;
  const routeDecisionMs = summary.routeDecisions.reduce((sum, decision) => sum + decision.decisionMs, 0);
  const averageRouteSeconds = summary.routeDecisions.length > 0
    ? Math.round(routeDecisionMs / summary.routeDecisions.length / 100) / 10
    : 0;
  const completedObjectives = summary.combatResults.filter((combat) => combat.objective?.status === 'complete').length;
  const failedObjectives = summary.combatResults.filter((combat) => combat.objective?.status === 'failed').length;
  const stats = summary.decisionStats;
  const decisions = [
    `${summary.routeDecisions.length} route choice${summary.routeDecisions.length === 1 ? '' : 's'} · ${averageRouteSeconds}s average`,
    `${pickedRewards.length} card recruit${pickedRewards.length === 1 ? '' : 's'} · ${skippedRewards} skipped`,
    ...(pickedRewards.length > 0 ? [`Recruited · ${pickedRewards.join(' / ')}`] : []),
    ...summary.signals.map((event) => `Signal · ${lookups.signalChoice(event.signalId, event.choiceKey)}`),
    `Objectives · ${completedObjectives} complete / ${failedObjectives} missed`,
    `Cards played · ${stats?.cardsPlayed ?? 0} · Overextensions ${stats?.overextensions ?? 0}`,
    `Cover blocked · ${stats?.blockedDamage ?? 0} · Unspent Wingbeats ${stats?.unspentWingbeatAtRoost ?? 0}`,
  ];
  const totalDealt = summary.combatResults.reduce((sum, combat) => sum + combat.damageDealt, 0);
  const totalTaken = summary.combatResults.reduce((sum, combat) => sum + combat.cohesionLost, 0);
  const totalSeconds = Math.max(0, Math.round(summary.durationMs / 1000));
  const duration = `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
  const review = summary.result === 'loss' ? buildDefeatReview(summary) : undefined;
  return {
    deck,
    path,
    waymarks: summary.routeMarks.map(lookups.waymarkName),
    supplies: summary.suppliesUsed.map(lookups.supplyName),
    decisions,
    results: [
      `${summary.result.toUpperCase()} · ${lookups.difficultyLabel(summary.difficulty ?? 0)} · ${duration}`,
      `Cohesion ${summary.currentCohesion}/${summary.maxCohesion} · ${summary.turnsTaken} beats`,
      `Damage ${totalDealt} dealt / ${totalTaken} taken`,
      `Scrap ${summary.finalScrap} · +${summary.scrapEarned} earned / ${summary.scrapSpent} spent`,
      ...(review ? [review.headline, review.evidence, review.tip, review.replayNote] : []),
    ],
  };
}

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

export function buildDefeatReview(summary: DefeatReviewRunSummary | undefined): DefeatReview | undefined {
  if (!summary) return undefined;
  const pressureByMove = new Map<string, DefeatReviewDamage>();
  summary.combatResults.forEach((combat) => {
    combat.damageTakenByMove?.forEach((pressure) => {
      const key = `${pressure.enemyId}:${pressure.moveId}:${pressure.moveLabel}`;
      const current = pressureByMove.get(key);
      if (current) {
        current.damageTaken += Math.max(0, pressure.damageTaken);
        current.blockedDamage += Math.max(0, pressure.blockedDamage);
        current.hitCount += Math.max(0, pressure.hitCount);
        return;
      }
      pressureByMove.set(key, {
        enemyId: pressure.enemyId,
        moveId: pressure.moveId,
        moveLabel: pressure.moveLabel,
        damageTaken: Math.max(0, pressure.damageTaken),
        blockedDamage: Math.max(0, pressure.blockedDamage),
        hitCount: Math.max(0, pressure.hitCount),
      });
    });
  });
  const topPressure = [...pressureByMove.values()].sort((a, b) => (
    b.damageTaken - a.damageTaken
    || b.blockedDamage - a.blockedDamage
    || b.hitCount - a.hitCount
    || a.moveLabel.localeCompare(b.moveLabel)
  ))[0];
  const finalCombat = summary.combatResults.at(-1);
  const fatalMove = summary.killedBy || finalCombat?.killedByMove || topPressure?.moveLabel || 'Final impact';
  const evidence = topPressure
    ? `Pressure · ${topPressure.moveLabel} · ${topPressure.damageTaken} hit / ${topPressure.blockedDamage} Cover`
    : 'Pressure · No incoming-damage record available';
  const overextensions = Math.max(0, summary.decisionStats?.overextensions ?? 0);
  const unspentWingbeats = Math.max(0, summary.decisionStats?.unspentWingbeatAtRoost ?? 0);
  const lowCardTurns = Math.max(0, summary.decisionStats?.lowCardTurns ?? 0);
  let signal: DefeatReview['signal'] = 'SEEDED RETRY';
  let tip = 'Replay keeps this seed. Change the route or card sequence against the same Tells.';
  if (overextensions > 0) {
    signal = 'OPEN SKY';
    tip = `${overextensions} overextension${overextensions === 1 ? '' : 's'} opened the flock. Stop before the warning unless the extra card beats Open Sky.`;
  } else if (unspentWingbeats > 0) {
    signal = 'UNSPENT WINGBEATS';
    tip = `${unspentWingbeats} Wingbeat${unspentWingbeats === 1 ? ' was' : 's were'} left at Roost. Check Cover, draw, or setup plays before ending the beat.`;
  } else if (topPressure && topPressure.damageTaken > 0 && topPressure.blockedDamage === 0) {
    signal = 'UNCOVERED TELL';
    tip = `No Cover absorbed ${topPressure.moveLabel}. Reserve Cover for its next shown Tell.`;
  } else if (lowCardTurns > 0) {
    signal = 'LOW TEMPO';
    tip = `${lowCardTurns} low-tempo turn${lowCardTurns === 1 ? '' : 's'} used one card or fewer. Use draw or cycle tools earlier.`;
  }
  return {
    fatalMove,
    signal,
    headline: `Last hit · ${fatalMove}`,
    evidence,
    tip,
    replayNote: 'Replay preserves the flight seed, route layout, and draw order.',
    topPressure,
  };
}

export function renderDefeatReview(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  review: DefeatReview,
  options: {
    x: number;
    y: number;
    width: number;
    fontFamily: string;
    boldStyle: string;
  }
) {
  const height = 156;
  const left = options.x - options.width / 2 + 12;
  root.add(scene.add.rectangle(options.x, options.y, options.width, height, 0x03070d, 0.94)
    .setStrokeStyle(1, 0xff9d6b, 0.34)
    .setName('run-defeat-review'));
  root.add(scene.add.text(left, options.y - 68, `FLIGHT REVIEW · ${review.signal}`, {
    fontFamily: options.fontFamily,
    fontSize: '18px',
    fontStyle: options.boldStyle,
    color: '#ffcfaa',
    fixedWidth: options.width - 24,
    maxLines: 1,
  }).setResolution(2).setName('run-defeat-review-signal'));
  root.add(fitTextExcerpt(scene.add.text(left, options.y - 42, '', {
    fontFamily: options.fontFamily,
    fontSize: '21px',
    fontStyle: options.boldStyle,
    color: '#fff0e8',
    wordWrap: { width: options.width - 24, useAdvancedWrap: true },
  }).setResolution(2).setName('run-defeat-review-headline'), review.headline, 1));
  root.add(fitTextExcerpt(scene.add.text(left, options.y - 12, '', {
    fontFamily: options.fontFamily,
    fontSize: '18px',
    color: '#d7e3ec',
    wordWrap: { width: options.width - 24, useAdvancedWrap: true },
  }).setResolution(2).setName('run-defeat-review-evidence'), review.evidence, 1));
  root.add(fitTextExcerpt(scene.add.text(left, options.y + 12, '', {
    fontFamily: options.fontFamily,
    fontSize: '18px',
    color: '#b9cad7',
    fixedWidth: options.width - 24,
    wordWrap: { width: options.width - 24, useAdvancedWrap: true },
    lineSpacing: -1,
  }).setResolution(2).setName('run-defeat-review-tip'), review.tip, 3));
}

export function renderOutcomeFlightSummary(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  options: {
    x: number;
    win: boolean;
    review?: DefeatReview;
    seed: string;
    runMode: SharedRouteMode;
    reportFrameLoaded: boolean;
    softAccent: number;
    fontFamily: string;
    boldStyle: string;
    softColor: string;
    focused?: boolean;
  }
) {
  if (!options.win && options.review) {
    renderDefeatReview(scene, root, options.review, {
      x: 762,
      y: 470,
      width: 452,
      fontFamily: options.fontFamily,
      boldStyle: options.boldStyle,
    });
  } else if (!options.win) {
    root.add(scene.add.rectangle(762, 470, 452, 140, 0x03070d, 0.94)
      .setStrokeStyle(1, options.softAccent, 0.22)
      .setName('run-defeat-review-loading'));
    root.add(scene.add.text(762, 470, 'REVIEWING THE LAST FLIGHT…', {
      fontFamily: options.fontFamily,
      fontSize: '18px',
      fontStyle: options.boldStyle,
      color: '#ffcfaa',
    }).setOrigin(0.5));
  }
  const seedLabel = scene.add.text(options.x, 462, '', {
    fontFamily: options.fontFamily, fontSize: '18px', color: options.softColor, align: 'center',
    wordWrap: { width: 232, useAdvancedWrap: true },
  }).setOrigin(0.5).setResolution(2).setName('run-outcome-flight-seed');
  root.add(fitTextExcerpt(seedLabel, `FLIGHT ${options.seed}`, 2));
  const labelY = 514;
  let pendingCopy: ReturnType<typeof startOwnedCopy> | undefined;
  const hit = quietButton(scene, { x: options.x, y: labelY, width: 244, label: 'COPY SEEDED FLIGHT',
    name: 'run-outcome-flight-link-hit', kind: 'secondary', focused: options.focused, onActivate: () => {
      if (pendingCopy) return;
      hit.setData({statusLabel: 'Copying…', status: 'loading'});
      pendingCopy = startOwnedCopy(scene, {
        isCurrent: () => hit.active && root.active,
        write: () => copySharedRouteLink(options.seed, options.runMode),
        complete: copied => {
          pendingCopy = undefined;
          if (copied) hit.setData({fullLabel: 'LINK COPIED', status: 'idle'});
          else hit.setData({statusLabel: 'Copy failed · Retry', status: 'error'});
        },
        canceled: () => { pendingCopy = undefined; },
      });
    } }).setData('label', 'Copy route link');
  hit.once('destroy', () => pendingCopy?.cancel());
  if (options.focused) root.add(scene.add.rectangle(options.x, labelY, 254, 64, 0x06151b, 0.03)
    .setStrokeStyle(3, 0x8df4ff, 0.98).setName('run-outcome-input-focus-ring')
    .setData('label', 'Copy seeded flight'));
  root.add([hit, hit.getData('labelObject').setName('run-outcome-flight-link-label')]);
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
  root.add(scene.add.rectangle(x + w / 2, y, w, h, 0x142331, 0.7)
    .setName('run-outcome-unlock-surface'));
  const icon = options.addIcon(iconX, y);
  if (icon) root.add(icon.setDisplaySize(36, 36).setAlpha(win ? 0.98 : 0.86).setName('run-outcome-unlock-icon'));
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
  const heading = `${recordCount ? 'NEW PROGRESS' : 'NEW UNLOCKS'}: ${labelParts.join(' + ')}`;
  root.add(fitTextExcerpt(scene.add.text(x + 62, y - 22, '', {
    fontFamily: options.fontFamily,
    fontSize: '18px',
    fontStyle: options.boldStyle,
    color: win ? '#ffe1a3' : '#ffcfaa',
    wordWrap: { width: w - 76, useAdvancedWrap: true },
  }).setResolution(2).setName('run-outcome-unlock-heading'), heading, 1));
  root.add(fitTextExcerpt(scene.add.text(x + 62, y + 3, '', {
    fontFamily: options.fontFamily,
    fontSize: '19px',
    fontStyle: options.boldStyle,
    color: '#eaf6ff',
    wordWrap: { width: w - 76, useAdvancedWrap: true },
  }).setResolution(2).setName('run-outcome-unlock-names'), `${visibleNames}${overflow}`, 1));
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
  const gap = 36;
  const fontSize = '21px';
  const centerX = (options.labelX + options.valueX) / 2;
  stats.forEach((row, index) => {
    const y = startY + index * gap;
    root.add(scene.add.rectangle(centerX, y + 17, 418, 1, 0xffffff, 0.08));
    root.add(scene.add.text(options.labelX, y, row[0], {
      fontFamily: options.fontFamily, fontSize, color: options.mutedColor
    }).setOrigin(0, 0.5).setResolution(2).setName('run-outcome-stat-label'));
    root.add(scene.add.text(options.valueX, y, row[1], {
      fontFamily: options.fontFamily, fontSize, fontStyle: options.boldStyle, color: '#eaf1f8'
    }).setOrigin(1, 0.5).setResolution(2).setName('run-outcome-stat-value'));
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
    width?: number;
    fontSize?: number;
    focused?: boolean;
    onActivate: () => void;
    addIcon: (id: string, x: number, y: number) => Phaser.GameObjects.Image | undefined;
  }
) {
  const width = options.width ?? 256;
  const hit = quietButton(scene, { x: options.x, y: 582, width, label: options.label,
    name: 'run-outcome-command-hit', kind: options.iconId === 'route-pin' ? 'primary' : 'secondary',
    focused: options.focused, onActivate: options.onActivate }).setData('label', options.label);
  root.add(hit);
  if (options.focused) {
    root.add(scene.add.rectangle(options.x, 582, width + 10, 64, 0x06151b, 0.03)
      .setStrokeStyle(3, 0x8df4ff, 0.98)
      .setName('run-outcome-input-focus-ring')
      .setData('label', options.label));
  }
  root.add(hit.getData('labelObject').setName('run-outcome-command-label'));
}

export function renderOutcomeNextGoal(scene: Phaser.Scene, root: Phaser.GameObjects.Container, goal: string, fontFamily: string) {
  const label = scene.add.text(640, 642, '', {
    fontFamily, fontSize: '19px', color: '#b8cbd8', align: 'center',
    wordWrap: { width: 680, useAdvancedWrap: true },
  }).setOrigin(0.5).setResolution(2).setName('leader-mastery-next-goal');
  root.add(fitTextExcerpt(label, `NEXT FLIGHT  /  ${goal}`, 2));
}

const flightReadingPages = new WeakMap<object, number>();

export function renderOutcomeFlightDetails(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  details: OutcomeFlightDetails,
  options: {
    title: string;
    identity?: object;
    subtitle: string;
    fontFamily: string;
    boldStyle: string;
    focused: boolean;
    focusedAction?: 'copy' | 'close';
    copyStatus?: 'idle' | 'copying' | 'copied' | 'failed';
    onCopy?: () => void;
    onClose: () => void;
  }
) {
  root.add(scene.add.rectangle(640, 360, 1280, 720, 0x020409, 0.94)
    .setInteractive()
    .setName('run-flight-details-blocker'));
  root.add(scene.add.rectangle(640, 360, 1120, 620, 0x08111c, 0.99)
    .setStrokeStyle(3, 0x8df4ff, 0.72)
    .setName('run-flight-details-panel'));
  root.add(scene.add.rectangle(640, 89, 1060, 84, 0x0d1a29, 0.98)
    .setStrokeStyle(1, 0xe8b830, 0.58));
  root.add(scene.add.text(118, 61, options.title, {
    fontFamily: TOKEN_DISPLAY_FONT,
    fontSize: '32px',
    fontStyle: options.boldStyle,
    color: '#ffe1a3',
    stroke: '#020409',
    strokeThickness: 4,
  }).setName('run-flight-details-title'));
  const subtitle = fitTextExcerpt(scene.add.text(120, 101, '', {
    fontFamily: options.fontFamily,
    fontSize: '19px',
    fontStyle: options.boldStyle,
    color: '#b9d9e9',
    wordWrap: {width:1040,useAdvancedWrap:true},
  }).setName('run-flight-details-subtitle'), options.subtitle, 1);
  root.add(subtitle);

  // One readable section at a time. Measure every wrapped line instead of
  // dropping report entries at fixed column limits. The identity survives
  // parent redraws (for example Copy status or action-focus changes).
  const identity = options.identity ?? details;
  const heading = scene.add.text(120, 148, '', { fontFamily: options.fontFamily,
    fontSize: '21px', fontStyle: options.boldStyle, color: '#ffe1a3' })
    .setName('run-flight-details-section-title');
  const body = scene.add.text(120, 190, '', { fontFamily: options.fontFamily,
    fontSize: '22px', color: '#d7e3ec', wordWrap: { width: 1040, useAdvancedWrap: true }, lineSpacing: 4 })
    .setName('run-flight-details-section-body');
  root.add([heading, body]);
  const sections = [
    { title: `FINAL DECK · ${details.deck.length}`, lines: details.deck },
    { title: `ROUTE PATH · ${details.path.length} STOPS`, lines: details.path },
    { title: 'KIT AT LANDING', lines: [`Waymarks · ${details.waymarks.join(' / ') || 'None'}`,
      `Supplies used · ${details.supplies.join(' / ') || 'None'}`] },
    { title: 'DECISIONS', lines: details.decisions },
    { title: 'RESULTS', lines: details.results },
    ...(subtitle.getData('truncated') ? [{title:'FLIGHT IDENTITY',lines:[options.subtitle]}] : []),
  ];
  const pages = measuredReadingPages(body, sections.map(section => ({heading: section.title,
    body: section.lines.join('\n') || 'None recorded.'})), 506);
  const pageLabel = scene.add.text(650, 556, '', { fontFamily: options.fontFamily,
    fontSize: '19px', color: '#b9d9e9' }).setOrigin(0, 0.5).setName('run-flight-details-page');
  root.add(pageLabel);
  const show = (delta: number) => {
    if (!body.active || (delta && (controlPanelOwnsInput(scene) || (scene as any).pauseOverlayOpen))) return;
    const index = ((flightReadingPages.get(identity) ?? 0) + delta + pages.length) % pages.length;
    flightReadingPages.set(identity, index);
    const page = pages[index];
    heading.setText(page.title); body.setText(page.text).setData('section', page.title);
    body.setData('reading', { ...page, page: index + 1, total: pages.length });
    pageLabel.setText(`Page ${index + 1} of ${pages.length}`);
    if (delta) announceScreenReader(`${page.title}. Page ${index + 1} of ${pages.length}. ${page.text}`);
  };
  for (const [x, delta, label, name] of [[240, -1, '← Previous page', 'previous'], [482, 1, 'Next page →', 'next']] as const) {
    const hit = quietButton(scene, { x, y: 556, width: 220, label,
      name: `run-flight-details-${name}`, onActivate: () => show(delta) });
    root.add([hit, hit.getData('labelObject')]);
  }
  const previous = (event: KeyboardEvent) => { if (!event.repeat) show(-1); };
  const next = (event: KeyboardEvent) => { if (!event.repeat) show(1); };
  const onPad = (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
    if (button.index === 4 || button.index === 5) show(button.index === 4 ? -1 : 1);
  };
  scene.input.keyboard?.on('keydown-PAGE_UP', previous);
  scene.input.keyboard?.on('keydown-PAGE_DOWN', next);
  scene.input.gamepad?.on('down', onPad);
  const retire = () => {
    scene.input.keyboard?.off('keydown-PAGE_UP', previous);
    scene.input.keyboard?.off('keydown-PAGE_DOWN', next);
    scene.input.gamepad?.off('down', onPad);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, retire);
  };
  body.once(Phaser.GameObjects.Events.DESTROY, retire);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, retire);
  show(0);

  const hasCopy = Boolean(options.onCopy);
  root.add(scene.add.text(
    112,
    608,
    hasCopy
      ? 'PgUp / PgDn · LB / RB: pages\nLeft / Right: actions · Confirm: select · Back: return'
      : 'PgUp / PgDn · LB / RB: pages\nConfirm or Back: close this report',
    {
    fontFamily: options.fontFamily,
    fontSize: '18px',
    fontStyle: options.boldStyle,
    color: '#9fb5c5',
    wordWrap: { width: hasCopy ? 590 : 760, useAdvancedWrap: true },
  }).setName('run-flight-details-input-hint'));
  if (options.onCopy) {
    const copyX = 834;
    const copyY = 640;
    const copyWidth = 238;
    const copyLabel = options.copyStatus === 'copied'
      ? 'Flight Link Copied'
      : options.copyStatus === 'failed'
        ? 'Copy Failed'
        : 'Copy Flight Link';
    const copyHit = quietButton(scene, { x: copyX, y: copyY, width: copyWidth, label: copyLabel,
      name: 'run-flight-details-copy-hit', onActivate: options.onCopy }).setData('label', 'Copy Flight Link');
    if (options.copyStatus === 'failed') copyHit.setData('statusLabel', 'Copy failed · Retry').setData('status', 'error');
    if (options.copyStatus === 'copying') copyHit.setData({statusLabel: 'Copying…', status: 'loading'});
    root.add(copyHit);
    if (options.focused && options.focusedAction === 'copy') {
      root.add(scene.add.rectangle(copyX, copyY, copyWidth + 10, 64, 0x06151b, 0.03)
        .setStrokeStyle(3, 0x8df4ff, 0.98)
        .setName('run-flight-details-input-focus-ring')
        .setData('action', 'copy'));
    }
    root.add(copyHit.getData('labelObject').setName('run-flight-details-copy-label'));
  }
  const closeX = 1082;
  const closeY = 640;
  const closeWidth = 190;
  const closeHit = quietButton(scene, { x: closeX, y: closeY, width: closeWidth, label: 'Close Review',
    name: 'run-flight-details-close-hit', onActivate: options.onClose }).setData('label', 'Close Flight Details');
  root.add(closeHit);
  if (options.focused && (!hasCopy || options.focusedAction !== 'copy')) {
    root.add(scene.add.rectangle(closeX, closeY, closeWidth + 10, 64, 0x06151b, 0.03)
      .setStrokeStyle(3, 0x8df4ff, 0.98)
      .setName('run-flight-details-input-focus-ring')
      .setData('action', 'close'));
  }
  root.add(closeHit.getData('labelObject').setName('run-flight-details-close-label'));
}

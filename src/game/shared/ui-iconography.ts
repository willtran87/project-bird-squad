import type Phaser from 'phaser';
import { KEYWORDS, keywordIconId } from '../keyword-definitions';
import { loadAccount } from '../meta';
import { collectionMilestoneProgress } from '../collection-milestone-progress';
import type { ActiveCardContract, Card, NodeChoiceOption, TargetType } from './runtime-types';
import type { UiIconId } from '../../art-assets';
import { addUiIconImage } from './asset-loading';
import { cardLibrary } from './run-session';
import { playUiSound } from './ui-helpers';
import { routeEffectSummary } from './route-text';

type CacheDrawerProfile = {
  drawer: string;
  title: string;
  seal: string;
  note: string;
  tell: string;
  icon: UiIconId;
  accent: number;
};


const CACHE_DRAWER_PROFILES: Record<string, CacheDrawerProfile> = {
  cache_scrap: {
    drawer: '12',
    title: 'Dry Scrap Bundle',
    seal: 'Clean seal',
    note: 'Marn: Counted twice. Dry enough to spend.',
    tell: 'No catch',
    icon: 'scrap-gear',
    accent: 0xd8a840
  },
  cache_supply: {
    drawer: '03',
    title: 'Snack Tin With Warm Latch',
    seal: 'Warm latch',
    note: 'Marn: Useful, but it opens loud.',
    tell: 'Supply + Scrap',
    icon: 'supply-pouch',
    accent: 0xffb86b
  },
  cache_mark: {
    drawer: '19',
    title: 'Rare Chalk Route Tag',
    seal: 'Bad handwriting',
    note: 'Marn: The mark is real. The note bites.',
    tell: 'Rare Waymark + Snag',
    icon: 'waymark-compass',
    accent: 0xc9a6ff
  },
  cache_card: {
    drawer: '27',
    title: 'Rare Nest Note Packet',
    seal: 'Thin paper seal',
    note: 'Marn: Leads to a card. Mind the staple.',
    tell: 'Rare card choice',
    icon: 'deck-stack',
    accent: 0x7ab8d6
  },
  cache_heal: {
    drawer: '08',
    title: 'Billboard Shelter Key',
    seal: 'Quiet seal',
    note: 'Marn: No prize. Just a safe ledge.',
    tell: 'Recover + Sky safety',
    icon: 'flock-heart',
    accent: 0x8fd6a0
  },
  cache_boss_line: {
    drawer: '44',
    title: 'Boss-Safe Pulley Line',
    seal: 'Fresh wire',
    note: 'Marn: Archive says it holds under pressure.',
    tell: '+16 Boss-fight Cover',
    icon: 'cover-shield',
    accent: 0x7ab8d6
  },
  decline: {
    drawer: '00',
    title: 'Leave the Ledger Closed',
    seal: 'No claim filed',
    note: 'Marn: Untouched drawers stay honest.',
    tell: 'Move on',
    icon: 'route-neutral-medallion',
    accent: 0x49606d
  }
};


export function cacheDrawerProfile(choice: NodeChoiceOption, index = 0): CacheDrawerProfile {
  return CACHE_DRAWER_PROFILES[choice.key] ?? {
    drawer: `${index + 1}`.padStart(2, '0'),
    title: choice.text,
    seal: 'Unfiled seal',
    note: 'Marn: Useful things still need a record.',
    tell: routeEffectSummary(choice.effects),
    icon: !choice.effects.length ? 'route-neutral-medallion' : 'route-pin',
    accent: 0xd8a840
  };
}



const COLLECTION_MILESTONE_NAMES: Record<string, string> = {
  collection_first_shelf: 'First Shelf',
  collection_suit_sampler: 'Four Winds',
  collection_curator: "Curator's Eye",
  collection_wayfinder: 'Marked Routes',
  collection_many_roads: 'Many Roads Home',
  collection_citywide: 'Citywide Binder',
};


export function collectionGoalSummary(account = loadAccount()) {
  const milestones = collectionMilestoneProgress(account);
  const next = milestones.find((milestone) => !milestone.complete);
  return {
    owned: Object.keys(account.cardCollection).length,
    total: Object.keys(cardLibrary).length,
    completed: milestones.filter((milestone) => milestone.complete).length,
    milestoneTotal: milestones.length,
    next: next ? {
      ...next,
      name: COLLECTION_MILESTONE_NAMES[next.id] ?? 'Collection Goal',
    } : null,
    allComplete: !next,
    optional: true,
    affectsPower: false,
    timeLimited: false,
    destination: 'Collection Atlas',
  };
}


type CollectionGoalStripModule = typeof import('../collection-goal-strip');

let collectionGoalStripModulePromise: Promise<CollectionGoalStripModule> | undefined;


function loadCollectionGoalStripModule() {
  collectionGoalStripModulePromise ??= import('../collection-goal-strip');
  return collectionGoalStripModulePromise;
}


export function renderCollectionGoalStrip(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  name: string,
  onOpen: (cardId?: string) => void,
) {
  const goal = collectionGoalSummary();
  void loadCollectionGoalStripModule().then((module) => {
    if (!scene.sys.settings.active || scene.children.list.some((child) => child.name === name)) return;
    module.renderCollectionGoalStrip(scene, x, y, width, name, goal, onOpen, {
      addIcon: (target, iconX, iconY) => addUiIconImage(target, 'codex-medallion', iconX, iconY, 13),
      playConfirm: () => playUiSound('confirm'),
    });
    (scene as any).updateMenuTextState?.();
    (scene as any).updateTextState?.();
  });
}


export function buttonIconForLabel(label: string): UiIconId | undefined {
  const normalized = label.toLowerCase();
  if (normalized === 'up') return 'scroll-up-chevron';
  if (normalized === 'down') return 'scroll-down-chevron';
  if (normalized.includes('back')) return 'back-chevron';
  if (normalized.includes('take this route')) return 'route-commit-medallion';
  if (normalized.includes('refresh') || normalized.includes('new stock')) return 'refresh-ring';
  if (normalized.includes('preen')) return 'preen-kit';
  if (normalized.includes('remove') || normalized.includes('release')) return 'release-card';
  if (normalized.includes('buy') || normalized.includes('market')) return 'market-basket';
  if (normalized.includes('settings')) return 'settings-medallion';
  if (normalized.includes('codex') || normalized.includes('collection')) return 'codex-medallion';
  if (normalized.includes('how to play') || normalized.includes('help')) return 'help-medallion';
  if (normalized.includes('flock record') || normalized.includes('record')) return 'record-medallion';
  if (normalized === 'start run' || normalized === 'start new run' || normalized === 'continue run') return 'start-run-medallion';
  return undefined;
}


export function zoneIconForLabel(zone: string): UiIconId {
  if (zone === 'Discard') return 'discard-basket';
  if (zone === 'Cleared') return 'release-card';
  if (zone === 'Hand') return 'deck-stack';
  return 'draw-stack';
}


export function roleIconForCard(card: Card | ActiveCardContract): UiIconId {
  if (card.role === 'attack') return 'release-card';
  if (card.role === 'skill') return 'cover-shield';
  return 'deck-stack';
}


export function targetIconForTarget(target: TargetType): UiIconId {
  if (target === 'self') return 'flock-heart';
  if (target === 'none') return 'deck-stack';
  if (target === 'allEnemies') return 'release-card';
  if (target === 'choice') return 'route-pin';
  return 'release-card';
}


export function statIconForKey(key: string): UiIconId | undefined {
  const term = key === 'openSkyGuard' ? 'Open Sky Guard'
    : key === 'wingbeats' ? 'Wingbeat'
      : `${key[0]?.toUpperCase()}${key.slice(1)}`;
  if (KEYWORDS[term]) return keywordIconId(term);
  if (key === 'damage') return 'release-card';
  if (key === 'moltPower') return 'preen-kit';
  return undefined;
}


export function marketIconForKicker(kicker: string): UiIconId | undefined {
  const normalized = kicker.toLowerCase();
  if (normalized.includes('waymark')) return 'waymark-compass';
  if (normalized.includes('supply')) return 'supply-pouch';
  if (normalized.includes('preen')) return 'preen-kit';
  if (normalized.includes('remove') || normalized.includes('release')) return 'release-card';
  if (normalized.includes('refresh')) return 'refresh-ring';
  return undefined;
}

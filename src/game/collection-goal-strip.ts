import type Phaser from 'phaser';
import { MIN_SUPPORTED_TOUCH_TARGET } from './theme';
import { safeStorageGet } from './safe-storage';

export interface CollectionGoalStripSummary {
  owned: number;
  total: number;
  completed: number;
  milestoneTotal: number;
  next: { name: string; current: number; target: number } | null;
}

export interface CollectionGoalStripDependencies {
  addIcon: (scene: Phaser.Scene, x: number, y: number) => { setAlpha: (alpha: number) => unknown } | undefined;
  playConfirm: () => void;
}

export function newestUnreviewedCardId() {
  try {
    const account = JSON.parse(safeStorageGet('birdsquad.account') ?? '{}') as {
      cardCollection?: Record<string, { isNew?: boolean; firstAcquiredAt?: number }>;
    };
    return Object.entries(account.cardCollection ?? {})
      .filter(([, record]) => record?.isNew === true)
      .sort(([, left], [, right]) => (right.firstAcquiredAt ?? 0) - (left.firstAcquiredAt ?? 0))[0]?.[0];
  } catch {
    return undefined;
  }
}

export function renderCollectionGoalStrip(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  name: string,
  goal: CollectionGoalStripSummary,
  onOpen: (cardId?: string) => void,
  dependencies: CollectionGoalStripDependencies,
) {
  const newCardId = newestUnreviewedCardId();
  const compact = width < 350;
  const plateHeight = compact ? 44 : MIN_SUPPORTED_TOUCH_TARGET;
  const plate = scene.add.rectangle(x, y, width, plateHeight, 0x07131f, compact ? 0.88 : 0.94)
    .setStrokeStyle(compact ? 1.5 : 2, 0xc9a6ff, compact ? 0.56 : 0.68)
    .setName(`${name}-plate`);
  const hit = scene.add.rectangle(x, y, width, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
    .setInteractive({ useHandCursor: true })
    .setName(name)
    .setData('collectionGoal', goal)
    .setData('newCardId', newCardId ?? '')
    .setData('destination', newCardId ? 'Newest card dossier' : 'Collection Atlas');
  dependencies.addIcon(scene, x - width / 2 + 25, y)?.setAlpha(0.9);
  const textLeft = x - width / 2 + 48;
  scene.add.text(textLeft, y - 13, compact
    ? `COLLECTION  /  ${goal.owned}/${goal.total}  /  ${goal.completed}/${goal.milestoneTotal} BADGES`
    : `COLLECTION PATH  /  ${goal.owned}/${goal.total} CARDS  /  ${goal.completed}/${goal.milestoneTotal} BADGES`, {
    fontFamily: 'Arial',
    fontSize: '9px',
    fontStyle: 'bold',
    color: '#8df4ff',
  }).setResolution(2).setOrigin(0, 0.5).setName(`${name}-kicker`);
  scene.add.text(textLeft, y + 10, newCardId
    ? `NEW CARD READY  /  VIEW DOSSIER${width >= 350 ? '' : '  /  G / R3'}`
    : goal.next
      ? `NEXT: ${goal.next.name.toUpperCase()}  ${goal.next.current}/${goal.next.target}${width >= 350 ? '  /  OPEN ATLAS' : '  /  G / R3'}`
      : `ALL COLLECTION BADGES EARNED${width >= 350 ? '  /  OPEN ATLAS' : ''}`, {
    fontFamily: 'Arial',
    fontSize: compact ? '10px' : '11px',
    fontStyle: 'bold',
    color: '#ffe1a3',
    fixedWidth: width - 58,
    maxLines: 1,
  }).setResolution(2).setOrigin(0, 0.5).setName(`${name}-label`);
  hit.on('pointerover', () => plate.setFillStyle(0x10263a, compact ? 0.98 : 1).setStrokeStyle(2, 0x7ab8d6, 0.96));
  hit.on('pointerout', () => plate
    .setFillStyle(0x07131f, compact ? 0.88 : 0.94)
    .setStrokeStyle(compact ? 1.5 : 2, 0xc9a6ff, compact ? 0.56 : 0.68));
  hit.on('pointerdown', () => {
    dependencies.playConfirm();
    onOpen(newCardId);
  });
  return hit;
}

import type Phaser from 'phaser';
import { MIN_SUPPORTED_TOUCH_TARGET } from './theme';

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

export function renderCollectionGoalStrip(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  name: string,
  goal: CollectionGoalStripSummary,
  onOpen: () => void,
  dependencies: CollectionGoalStripDependencies,
) {
  const hit = scene.add.rectangle(x, y, width, MIN_SUPPORTED_TOUCH_TARGET, 0x07131f, 0.94)
    .setStrokeStyle(2, 0xc9a6ff, 0.68)
    .setInteractive({ useHandCursor: true })
    .setName(name)
    .setData('collectionGoal', goal);
  dependencies.addIcon(scene, x - width / 2 + 25, y)?.setAlpha(0.9);
  const textLeft = x - width / 2 + 48;
  scene.add.text(textLeft, y - 13, width < 350
    ? `COLLECTION  /  ${goal.owned}/${goal.total}  /  ${goal.completed}/${goal.milestoneTotal} BADGES`
    : `COLLECTION PATH  /  ${goal.owned}/${goal.total} CARDS  /  ${goal.completed}/${goal.milestoneTotal} BADGES`, {
    fontFamily: 'Arial',
    fontSize: '9px',
    fontStyle: 'bold',
    color: '#8df4ff',
  }).setResolution(2).setOrigin(0, 0.5).setName(`${name}-kicker`);
  scene.add.text(textLeft, y + 10, goal.next
    ? `NEXT: ${goal.next.name.toUpperCase()}  ${goal.next.current}/${goal.next.target}${width >= 350 ? '  /  OPEN ATLAS' : '  /  G / R3'}`
    : `ALL COLLECTION BADGES EARNED${width >= 350 ? '  /  OPEN ATLAS' : ''}`, {
    fontFamily: 'Arial',
    fontSize: width >= 350 ? '11px' : '10px',
    fontStyle: 'bold',
    color: '#ffe1a3',
    fixedWidth: width - 58,
    maxLines: 1,
  }).setResolution(2).setOrigin(0, 0.5).setName(`${name}-label`);
  hit.on('pointerover', () => hit.setFillStyle(0x10263a, 1).setStrokeStyle(2, 0x7ab8d6, 0.96));
  hit.on('pointerout', () => hit.setFillStyle(0x07131f, 0.94).setStrokeStyle(2, 0xc9a6ff, 0.68));
  hit.on('pointerdown', () => {
    dependencies.playConfirm();
    onOpen();
  });
  return hit;
}

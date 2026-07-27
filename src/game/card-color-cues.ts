import Phaser from 'phaser';

export type CardColorCueShape = 'triangle' | 'waves' | 'diamond' | 'square' | 'star' | 'ring' | 'chevron' | 'cross';

export interface CardColorCueDescriptor {
  label: string;
  shape: CardColorCueShape;
}

const CARD_COLOR_CUES: Record<string, CardColorCueShape> = {
  PLUMES: 'triangle',
  BASINS: 'waves',
  QUILLS: 'diamond',
  NESTS: 'square',
  LEGEND: 'star',
  MOLT: 'ring',
  AVIARY: 'chevron',
  SNAG: 'cross',
  CREW: 'ring',
};

export function cardColorCueDescriptor(label: string): CardColorCueDescriptor {
  const normalized = label.trim().toUpperCase() || 'CREW';
  return {
    label: normalized,
    shape: CARD_COLOR_CUES[normalized] ?? 'ring',
  };
}

function renderCueShape(
  scene: Phaser.Scene,
  shape: CardColorCueShape,
  x: number,
  accent: number,
) {
  const pale = 0xf4f8fb;
  if (shape === 'triangle') {
    return scene.add.triangle(x, 0, 0, 8, 8, -7, -8, -7, 0x06111a, 1).setStrokeStyle(2, pale, 1);
  }
  if (shape === 'waves') {
    return scene.add.text(x, -1, '≈', {
      fontFamily: 'Arial',
      fontSize: '19px',
      fontStyle: 'bold',
      color: '#f4f8fb',
      stroke: '#06111a',
      strokeThickness: 2,
    }).setOrigin(0.5);
  }
  if (shape === 'diamond') {
    return scene.add.rectangle(x, 0, 12, 12, 0x06111a, 1).setStrokeStyle(2, pale, 1).setAngle(45);
  }
  if (shape === 'square') {
    return scene.add.rectangle(x, 0, 14, 14, 0x06111a, 1).setStrokeStyle(2, pale, 1);
  }
  if (shape === 'star') {
    return scene.add.star(x, 0, 5, 4, 9, 0x06111a, 1).setStrokeStyle(2, pale, 1);
  }
  if (shape === 'chevron') {
    return scene.add.text(x, 0, '»', {
      fontFamily: 'Arial',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#f4f8fb',
      stroke: '#06111a',
      strokeThickness: 2,
    }).setOrigin(0.5);
  }
  if (shape === 'cross') {
    return scene.add.text(x, 0, '×', {
      fontFamily: 'Arial',
      fontSize: '19px',
      fontStyle: 'bold',
      color: '#f4f8fb',
      stroke: '#06111a',
      strokeThickness: 2,
    }).setOrigin(0.5);
  }
  return scene.add.circle(x, 0, 7, 0x06111a, 1).setStrokeStyle(shape === 'ring' ? 3 : 2, accent, 1);
}

export function renderCardColorCue(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Container,
  x: number,
  y: number,
  label: string,
  accent: number,
  options: { name: string; width?: number; height?: number } = { name: 'card-color-cue-badge' },
) {
  const descriptor = cardColorCueDescriptor(label);
  const width = options.width ?? Math.max(76, descriptor.label.length * 7 + 34);
  const height = options.height ?? 24;
  const cue = scene.add.container(x, y)
    .setName(options.name)
    .setData('label', descriptor.label)
    .setData('shape', descriptor.shape);
  cue.add(scene.add.rectangle(0, 0, width, height, 0x06111a, 0.94)
    .setStrokeStyle(2, accent, 0.98));
  cue.add(renderCueShape(scene, descriptor.shape, -width / 2 + 14, accent));
  cue.add(scene.add.text(-width / 2 + 27, 0, descriptor.label, {
    fontFamily: 'Arial',
    fontSize: '9px',
    fontStyle: 'bold',
    color: '#f4f8fb',
  }).setOrigin(0, 0.5));
  target.add(cue);
  return cue;
}

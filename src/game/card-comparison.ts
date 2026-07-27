import Phaser from 'phaser';

const UI_FONT = 'Arial';
const UI_BOLD = 'bold';
const UI_GOLD = '#ffe1a3';
const UI_CYAN = '#8df4ff';

export interface SceneCardComparisonCardView {
  name: string;
  bird: string;
  label: string;
  zone: string;
  cost: number;
  accent: number;
  artKey?: string;
  snagBorderKey?: string;
  target: string;
  role: string;
  currentText: string;
  alternateText: string;
  currentLabel?: string;
  alternateLabel?: string;
  usesMolt: boolean;
  stats: string[];
}

export interface SceneCardComparisonView {
  pinned: SceneCardComparisonCardView;
  selected: SceneCardComparisonCardView;
  summary: string;
  title?: string;
  leftHeading?: string;
  rightHeading?: string;
  detailFrameKey?: string;
  dossierFrameKey?: string;
  costBadgeKey?: string;
}

function renderComparisonCardArt(
  scene: Phaser.Scene,
  view: SceneCardComparisonCardView,
  x: number,
  y: number,
  dossierFrameKey?: string,
) {
  const width = 112;
  const height = 168;
  if (view.artKey && scene.textures.exists(view.artKey)) {
    scene.add.image(x, y, view.artKey).setDisplaySize(width, height).setAlpha(0.92);
  } else if (view.snagBorderKey && scene.textures.exists(view.snagBorderKey)) {
    scene.add.rectangle(x, y, width, height, 0x07090d, 0.94);
    scene.add.image(x, y, view.snagBorderKey).setDisplaySize(width, height).setAlpha(0.92);
  } else {
    scene.add.rectangle(x, y, width, height, 0x141f2f, 0.95)
      .setStrokeStyle(1, view.accent, 0.56);
    scene.add.text(x, y, view.label, {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: '#7ab8d6',
      wordWrap: { width: width - 18 },
      align: 'center',
    }).setOrigin(0.5);
  }
  if (dossierFrameKey && scene.textures.exists(dossierFrameKey)) {
    scene.textures.get(dossierFrameKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    scene.add.image(x, y, dossierFrameKey)
      .setDisplaySize(width + 18, height + 26)
      .setAlpha(0.9);
  }
}

function renderComparisonColumn(
  scene: Phaser.Scene,
  view: SceneCardComparisonCardView,
  centerX: number,
  heading: string,
  dossierFrameKey?: string,
  costBadgeKey?: string,
) {
  const left = centerX - 137;
  const textX = centerX - 14;
  const textWidth = 132;
  scene.add.text(centerX, 208, heading, {
    fontFamily: UI_FONT,
    fontSize: '10px',
    fontStyle: UI_BOLD,
    color: heading === 'PINNED' || heading === 'BASE' ? '#ffc9f5' : UI_CYAN,
    align: 'center',
    fixedWidth: 250,
  }).setOrigin(0.5);
  if (costBadgeKey && scene.textures.exists(costBadgeKey)) {
    scene.textures.get(costBadgeKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    const badge = scene.add.image(left + 22, 247, costBadgeKey)
      .setDisplaySize(42, 42)
      .setAlpha(0.96)
      .setName('deck-review-comparison-cost-badge');
    if (view.cost === 0) badge.setTint(0xd9fdff);
  } else {
    scene.add.circle(left + 22, 247, 21, 0x141b22, 1)
      .setStrokeStyle(2, view.cost === 0 ? 0x24d0d6 : 0xd8a840, 1);
  }
  scene.add.text(left + 22, 247, `${view.cost}`, {
    fontFamily: UI_FONT,
    fontSize: '16px',
    fontStyle: UI_BOLD,
    color: '#f6f2df',
    stroke: '#020409',
    strokeThickness: 2,
  }).setOrigin(0.5);
  scene.add.text(left + 50, 230, view.name, {
    fontFamily: UI_FONT,
    fontSize: '18px',
    fontStyle: UI_BOLD,
    color: UI_GOLD,
    wordWrap: { width: 208 },
    maxLines: 2,
  });
  scene.add.text(centerX, 277, `${view.bird} / ${view.label} / ${view.zone}`, {
    fontFamily: UI_FONT,
    fontSize: '10px',
    fontStyle: UI_BOLD,
    color: '#7ab8d6',
    wordWrap: { width: 258 },
    align: 'center',
    maxLines: 2,
  }).setOrigin(0.5, 0);
  renderComparisonCardArt(scene, view, centerX - 76, 402, dossierFrameKey);
  scene.add.text(textX, 316, `${view.target} / ${view.role.toUpperCase()}`, {
    fontFamily: UI_FONT,
    fontSize: '10px',
    fontStyle: UI_BOLD,
    color: view.usesMolt ? '#ffc78f' : '#b9c7d6',
    wordWrap: { width: textWidth },
    maxLines: 2,
  });
  scene.add.text(textX, 346, view.currentLabel ?? (view.usesMolt ? 'NOW (MOLT)' : 'NOW'), {
    fontFamily: UI_FONT,
    fontSize: '10px',
    fontStyle: UI_BOLD,
    color: UI_GOLD,
  });
  scene.add.text(textX, 362, view.currentText, {
    fontFamily: UI_FONT,
    fontSize: '11px',
    color: '#dce8f2',
    lineSpacing: 1,
    wordWrap: { width: textWidth },
    maxLines: 5,
  });
  scene.add.text(textX, 442, view.alternateLabel ?? (view.usesMolt ? 'BASE' : 'PREEN'), {
    fontFamily: UI_FONT,
    fontSize: '10px',
    fontStyle: UI_BOLD,
    color: UI_GOLD,
  });
  scene.add.text(textX, 458, view.alternateText, {
    fontFamily: UI_FONT,
    fontSize: '11px',
    color: '#cfe0ef',
    lineSpacing: 1,
    wordWrap: { width: textWidth },
    maxLines: 4,
  });
  scene.add.text(left + 6, 526, `FLOCK  ${view.stats.length > 0 ? view.stats.join('  ') : 'None'}`, {
    fontFamily: UI_FONT,
    fontSize: '10px',
    fontStyle: UI_BOLD,
    color: view.stats.length > 0 ? UI_CYAN : '#91a6b8',
    wordWrap: { width: 262 },
    maxLines: 2,
  });
}

export function renderSceneCardComparison(scene: Phaser.Scene, view: SceneCardComparisonView) {
  const panelCx = 826;
  const panelCy = 379;
  const panelW = 620;
  const panelH = 430;
  const accent = 0x8df4ff;
  scene.add.rectangle(panelCx + 8, panelCy + 10, panelW, panelH, 0x020409, 0.42);
  scene.add.rectangle(panelCx, panelCy, panelW, panelH, 0x070b12, 0.99)
    .setStrokeStyle(1.5, accent, 0.52)
    .setName('deck-review-comparison-panel');
  if (view.detailFrameKey && scene.textures.exists(view.detailFrameKey)) {
    scene.textures.get(view.detailFrameKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    scene.add.image(panelCx, panelCy, view.detailFrameKey)
      .setDisplaySize(642, 444)
      .setAlpha(0.42)
      .setName('deck-review-detail-frame');
  }
  scene.add.text(panelCx, 178, view.title ?? 'CARD COMPARISON', {
    fontFamily: UI_FONT,
    fontSize: '16px',
    fontStyle: UI_BOLD,
    color: UI_GOLD,
    align: 'center',
    fixedWidth: 300,
    stroke: '#020409',
    strokeThickness: 3,
  }).setOrigin(0.5);
  scene.add.rectangle(panelCx, 385, 1, 328, 0x8df4ff, 0.24);
  renderComparisonColumn(scene, view.pinned, 671, view.leftHeading ?? 'PINNED', view.dossierFrameKey, view.costBadgeKey);
  renderComparisonColumn(scene, view.selected, 981, view.rightHeading ?? 'SELECTED', view.dossierFrameKey, view.costBadgeKey);
  scene.add.rectangle(panelCx, 571, 550, 24, 0x07151f, 0.94)
    .setStrokeStyle(1, 0x8df4ff, 0.42);
  scene.add.text(panelCx, 571, view.summary, {
    fontFamily: UI_FONT,
    fontSize: '10px',
    fontStyle: UI_BOLD,
    color: '#dffbff',
    align: 'center',
    fixedWidth: 530,
    maxLines: 1,
  }).setOrigin(0.5);
}

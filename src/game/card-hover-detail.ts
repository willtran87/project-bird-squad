import Phaser from 'phaser';
export {
  activateMarketFocus,
  bindMarketInputs,
  cardPickerDecisionDelta,
  closeCardPickerInspection,
  closeRouteRewardInspection,
  cycleCardPickerFocus,
  cycleMarketCategory,
  cycleMarketFocus,
  cycleRouteRewardChoice,
  focusedCardPickerEntry,
  focusedRouteRewardCard,
  handleRouteRewardAction,
  openCardPickerInspection,
  openRouteRewardInspection,
  requestRouteRewardCard,
  renderCardPickerInput,
  renderCardPickerInspection,
  renderMarketCategoryTabs,
  renderMarketInputHelp,
  renderMarketSectionHeader,
  requestCardPick,
  resetMarketFocus,
  setRouteRewardChoice,
  updateRouteRewardGamepad,
} from './reward-card-inspection';

const UI_FONT = 'Arial';
const UI_BOLD = 'bold';
const UI_GOLD = '#ffe1a3';
const UI_CYAN = '#8df4ff';

export interface CardHoverDetailView {
  name: string;
  bird: string;
  label: string;
  zone: string;
  cost: number;
  anchorX: number;
  anchorY: number;
  accent: number;
  artKey?: string;
  snagBorderKey?: string;
  target: string;
  role: string;
  currentText: string;
  upgradedText: string;
  baseText: string;
  moltText?: string;
  usesMolt: boolean;
  stats: string[];
  reducedMotion: boolean;
  dossierFrameKey?: string;
  statChipFrameKey?: string;
}

export interface SceneCardDetailView {
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
  usesMolt: boolean;
  stats: string[];
  reducedMotion: boolean;
  dossierFrameKey?: string;
  detailFrameKey?: string;
  costBadgeKey?: string;
}

export interface MarketItemDetailView {
  title: string;
  kicker: string;
  body: string;
  meta: string;
  price?: number;
  afterPurchase: string;
  decisionPreview: string[];
  accent: number;
  anchorX: number;
  anchorY: number;
  enabled: boolean;
  dossierFrameKey?: string;
  scrapIconKey?: string;
}

export function renderCardHoverDetail(scene: Phaser.Scene, view: CardHoverDetailView) {
  const marketInspector = view.zone.startsWith('Market /');
  const w = marketInspector ? 270 : 300;
  const h = marketInspector ? 430 : 450;
  const margin = 18;
  const cx = marketInspector
    ? 1116
    : view.anchorX < 640
      ? Math.min(1280 - w / 2 - margin, view.anchorX + 232)
      : Math.max(w / 2 + margin, view.anchorX - 232);
  const cy = marketInspector
    ? 394
    : Math.max(h / 2 + margin, Math.min(720 - h / 2 - margin, view.anchorY));
  const left = cx - w / 2;
  const top = cy - h / 2;
  const bottom = cy + h / 2;
  const container = scene.add.container(0, 0)
    .setName(marketInspector ? 'market-fixed-card-inspector' : 'card-hover-detail');
  const add = <T extends Phaser.GameObjects.GameObject>(child: T) => {
    container.add(child);
    return child;
  };

  add(scene.add.rectangle(cx, cy, w + 8, h + 8, 0x06090f, 0.99).setStrokeStyle(3, view.accent, 1));
  if (view.artKey && scene.textures.exists(view.artKey)) {
    add(scene.add.image(cx, cy, view.artKey).setDisplaySize(w, h).setAlpha(0.98));
  } else if (view.snagBorderKey && scene.textures.exists(view.snagBorderKey)) {
    add(scene.add.rectangle(cx, cy, w, h, 0x07090d, 0.98));
    add(scene.add.image(cx, cy, view.snagBorderKey).setDisplaySize(w, h));
    add(scene.add.rectangle(cx, cy, w, h, 0x05101a, 0.12));
  } else {
    add(scene.add.rectangle(cx, cy, w, h, 0x141d2b, 0.95));
    add(scene.add.text(cx, cy - 42, view.label, {
      fontFamily: UI_FONT,
      fontSize: '18px',
      fontStyle: UI_BOLD,
      color: '#7ab8d6',
      wordWrap: { width: w - 50 },
      align: 'center',
    }).setOrigin(0.5));
  }

  if (view.dossierFrameKey && scene.textures.exists(view.dossierFrameKey)) {
    scene.textures.get(view.dossierFrameKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    const alpha = view.reducedMotion ? 0.88 : 0.94;
    const frame = add(scene.add.image(cx, cy, view.dossierFrameKey)
      .setDisplaySize(w + 26, h + 38)
      .setAlpha(alpha));
    if (!view.reducedMotion) {
      scene.tweens.add({
        targets: frame,
        alpha: alpha * 0.92,
        scaleX: frame.scaleX * 1.004,
        scaleY: frame.scaleY * 1.004,
        duration: 1800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  add(scene.add.rectangle(cx, top + 24, w - 4, 44, 0x05080e, 0.76));
  add(scene.add.text(left + 52, top + 9, view.name, {
    fontFamily: UI_FONT,
    fontSize: '20px',
    fontStyle: UI_BOLD,
    color: '#ffe7b0',
    wordWrap: { width: w - 72 },
  }));
  add(scene.add.circle(left + 26, top + 24, 20, view.cost === 0 ? 0x24d0d6 : 0xe8b830, 1)
    .setStrokeStyle(2, 0x05080e, 0.9));
  add(scene.add.text(left + 26, top + 24, `${view.cost}`, {
    fontFamily: UI_FONT,
    fontSize: '23px',
    fontStyle: UI_BOLD,
    color: '#06101c',
  }).setOrigin(0.5));

  add(scene.add.rectangle(cx, top + 60, w - 4, 24, 0x05080e, 0.68));
  const detailMeta = view.zone.startsWith('Market /')
    ? view.zone
    : `${view.bird} / ${view.label} / ${view.zone}`;
  add(scene.add.text(cx, top + 54, detailMeta, {
    fontFamily: UI_FONT,
    fontSize: '11px',
    fontStyle: UI_BOLD,
    color: UI_CYAN,
    align: 'center',
    wordWrap: { width: w - 16 },
  }).setOrigin(0.5, 0));

  const panelH = view.moltText || view.usesMolt ? 202 : 170;
  add(scene.add.rectangle(cx, bottom - panelH / 2 - 4, w - 4, panelH, 0x05080e, 0.93));
  add(scene.add.rectangle(cx, bottom - panelH - 4, w - 4, 2, view.accent, 0.85));
  let yy = bottom - panelH + 8;
  const tx = left + 16;
  const wrap = w - 32;
  if (view.usesMolt) {
    add(scene.add.rectangle(left + 50, yy + 8, 84, 20, 0x2a1208, 0.92)
      .setStrokeStyle(1, 0xff9d4d, 0.72));
    add(scene.add.text(left + 50, yy + 2, 'MOLT', {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: '#ffc78f',
      align: 'center',
      fixedWidth: 74,
    }).setOrigin(0.5, 0));
    yy += 27;
  }
  add(scene.add.text(tx, yy, `${view.target} / ${view.role.toUpperCase()}`, {
    fontFamily: UI_FONT,
    fontSize: '10px',
    fontStyle: UI_BOLD,
    color: view.usesMolt ? '#ffc78f' : '#91a6b8',
  }));
  yy += 15;
  const current = add(scene.add.text(tx, yy, view.currentText, {
    fontFamily: UI_FONT,
    fontSize: '12px',
    color: '#dce8f2',
    lineSpacing: 1,
    wordWrap: { width: wrap },
    maxLines: 3,
  }));
  yy += current.height + 8;
  add(scene.add.text(tx, yy, view.usesMolt ? 'Base' : 'Preen', {
    fontFamily: UI_FONT,
    fontSize: '11px',
    fontStyle: UI_BOLD,
    color: UI_GOLD,
  }));
  yy += 15;
  const upgraded = add(scene.add.text(tx, yy, view.usesMolt ? view.baseText : view.upgradedText, {
    fontFamily: UI_FONT,
    fontSize: '12px',
    color: '#cfe0ef',
    lineSpacing: 1,
    wordWrap: { width: wrap },
    maxLines: 2,
  }));
  yy += upgraded.height + 8;
  if (!view.usesMolt && view.moltText && yy < bottom - 40) {
    add(scene.add.text(tx, yy, 'Molt', {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: UI_BOLD,
      color: '#ffc78f',
    }));
    yy += 15;
    const molt = add(scene.add.text(tx, yy, view.moltText, {
      fontFamily: UI_FONT,
      fontSize: '11px',
      color: '#ffc78f',
      fontStyle: UI_BOLD,
      lineSpacing: 1,
      wordWrap: { width: wrap },
      maxLines: 3,
    }));
    yy += molt.height + 7;
  }
  add(scene.add.text(tx, Math.min(yy, bottom - 28), 'Flock Stats', {
    fontFamily: UI_FONT,
    fontSize: '11px',
    fontStyle: UI_BOLD,
    color: UI_GOLD,
  }));

  if (view.statChipFrameKey && scene.textures.exists(view.statChipFrameKey)) {
    scene.textures.get(view.statChipFrameKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    add(scene.add.image(cx, bottom - 17, view.statChipFrameKey)
      .setDisplaySize(w - 38, 34)
      .setAlpha(0.8)
      .setName('card-hover-stat-chip-frame'));
  }
  add(scene.add.text(tx, bottom - 16, view.stats.length > 0 ? view.stats.join('   ') : 'None', {
    fontFamily: UI_FONT,
    fontSize: '11px',
    fontStyle: UI_BOLD,
    color: view.stats.length > 0 ? '#8df4ff' : '#91a6b8',
    align: 'center',
    wordWrap: { width: wrap },
  }).setOrigin(0, 1));
  return container;
}

export function renderSceneCardDetail(scene: Phaser.Scene, view: SceneCardDetailView) {
  const layout = {
    panelCx: 826, panelCy: 379, panelW: 620, panelH: 430,
    artX: 664, artY: 402, artW: 236, artH: 354,
    costX: 550, costY: 200,
    textX: 826, textW: 282,
    titleY: 184, metaY: 234, targetY: 262, statusY: 292,
    currentHeaderY: 322, currentBodyY: 346,
    alternateHeaderY: 430, alternateBodyY: 454,
    statsHeaderY: 512, statsY: 536,
  };
  const left = layout.panelCx - layout.panelW / 2;
  const right = layout.panelCx + layout.panelW / 2;
  const top = layout.panelCy - layout.panelH / 2;
  const bottom = layout.panelCy + layout.panelH / 2;
  scene.add.rectangle(layout.panelCx + 8, layout.panelCy + 10, layout.panelW, layout.panelH, 0x020409, 0.42);
  scene.add.rectangle(layout.panelCx, layout.panelCy, layout.panelW, layout.panelH, 0x070b12, 0.985)
    .setStrokeStyle(1, view.accent, 0.42);
  scene.add.rectangle(layout.panelCx, top + 14, layout.panelW - 34, 2, view.accent, 0.72);
  scene.add.rectangle(layout.panelCx, bottom - 14, layout.panelW - 34, 1, 0xffffff, 0.08);
  const corner = 28;
  [
    [left + 15, top + 15, corner, 2], [left + 15, top + 15, 2, corner],
    [right - 15 - corner, top + 15, corner, 2], [right - 15, top + 15, 2, corner],
    [left + 15, bottom - 15, corner, 2], [left + 15, bottom - 15 - corner, 2, corner],
    [right - 15 - corner, bottom - 15, corner, 2], [right - 15, bottom - 15 - corner, 2, corner],
  ].forEach(([x, y, width, height]) => {
    scene.add.rectangle(x, y, width, height, view.accent, 0.72).setOrigin(0, 0);
  });

  if (view.detailFrameKey && scene.textures.exists(view.detailFrameKey)) {
    scene.textures.get(view.detailFrameKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    scene.add.image(layout.panelCx, layout.panelCy, view.detailFrameKey)
      .setDisplaySize(642, 444)
      .setAlpha(0.62)
      .setName('deck-review-detail-frame');
  }
  if (view.artKey && scene.textures.exists(view.artKey)) {
    scene.add.image(layout.artX, layout.artY, view.artKey)
      .setDisplaySize(layout.artW, layout.artH)
      .setAlpha(0.92);
  } else if (view.snagBorderKey && scene.textures.exists(view.snagBorderKey)) {
    scene.add.rectangle(layout.artX, layout.artY, layout.artW, layout.artH, 0x07090d, 0.92);
    scene.add.image(layout.artX, layout.artY, view.snagBorderKey)
      .setDisplaySize(layout.artW, layout.artH)
      .setAlpha(0.92);
    scene.add.rectangle(layout.artX, layout.artY, layout.artW, layout.artH, 0x05101a, 0.12);
  } else {
    scene.add.rectangle(layout.artX, layout.artY, layout.artW, layout.artH, 0x141f2f, 0.95)
      .setStrokeStyle(1, 0x49606d, 0.8);
    scene.add.text(layout.artX, layout.artY, view.label, {
      fontFamily: UI_FONT,
      fontSize: '18px',
      fontStyle: UI_BOLD,
      color: '#7ab8d6',
      wordWrap: { width: 190 },
      align: 'center',
    }).setOrigin(0.5);
  }
  if (view.dossierFrameKey && scene.textures.exists(view.dossierFrameKey)) {
    scene.textures.get(view.dossierFrameKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    const alpha = view.reducedMotion ? 0.88 : 0.92;
    const frame = scene.add.image(layout.artX, layout.artY, view.dossierFrameKey)
      .setDisplaySize(layout.artW + 28, layout.artH + 42)
      .setAlpha(alpha);
    if (!view.reducedMotion) {
      scene.tweens.add({
        targets: frame,
        alpha: alpha * 0.92,
        scaleX: frame.scaleX * 1.004,
        scaleY: frame.scaleY * 1.004,
        duration: 1800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }
  if (view.costBadgeKey && scene.textures.exists(view.costBadgeKey)) {
    scene.textures.get(view.costBadgeKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    const badge = scene.add.image(layout.costX, layout.costY, view.costBadgeKey)
      .setDisplaySize(46, 46)
      .setAlpha(0.98)
      .setName('deck-review-cost-badge');
    if (view.cost === 0) badge.setTint(0xd9fdff);
  } else {
    scene.add.circle(layout.costX, layout.costY, 23, 0x141b22, 1)
      .setStrokeStyle(2, view.cost === 0 ? 0x24d0d6 : 0xd8a840, 1)
      .setName('deck-review-cost-badge-fallback');
  }

  scene.add.text(layout.costX, layout.costY, `${view.cost}`, {
    fontFamily: UI_FONT,
    fontSize: '17px',
    fontStyle: UI_BOLD,
    color: '#f6f2df',
    stroke: '#020409',
    strokeThickness: 2,
  }).setOrigin(0.5);
  scene.add.text(layout.textX, layout.titleY, view.name, {
    fontFamily: UI_FONT,
    fontSize: '26px',
    fontStyle: UI_BOLD,
    color: UI_GOLD,
    wordWrap: { width: layout.textW },
  });
  scene.add.text(layout.textX, layout.metaY, `${view.bird} / ${view.label} / ${view.zone}`, {
    fontFamily: UI_FONT,
    fontSize: '15px',
    fontStyle: UI_BOLD,
    color: '#7ab8d6',
    wordWrap: { width: layout.textW },
  });
  scene.add.text(layout.textX, layout.targetY, `${view.target} / ${view.role.toUpperCase()}`, {
    fontFamily: UI_FONT,
    fontSize: '14px',
    color: view.usesMolt ? '#ffc78f' : '#b9c7d6',
  });
  if (view.usesMolt) {
    scene.add.rectangle(layout.textX + 40, layout.statusY + 9, 80, 22, 0x2a1208, 0.96)
      .setStrokeStyle(1, 0xff9d4d, 0.82);
    scene.add.text(layout.textX + 40, layout.statusY, 'MOLT', {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: '#ffc78f',
      align: 'center',
      fixedWidth: 72,
    }).setOrigin(0.5, 0);
  }
  const headerStyle: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: UI_FONT, fontSize: '15px', fontStyle: UI_BOLD, color: UI_GOLD,
  };
  const bodyStyle: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: UI_FONT,
    fontSize: '14px',
    color: '#dce8f2',
    lineSpacing: 3,
    wordWrap: { width: layout.textW },
  };
  scene.add.text(layout.textX, layout.currentHeaderY, view.usesMolt ? 'Now (Molt)' : 'Now', headerStyle);
  scene.add.text(layout.textX, layout.currentBodyY, view.currentText, { ...bodyStyle, maxLines: 3 });
  scene.add.text(layout.textX, layout.alternateHeaderY, view.usesMolt ? 'Base' : 'Preen', headerStyle);
  scene.add.text(layout.textX, layout.alternateBodyY, view.alternateText, { ...bodyStyle, maxLines: 2 });
  scene.add.text(layout.textX, layout.statsHeaderY, 'Flock Stats', headerStyle);
  scene.add.text(layout.textX, layout.statsY, view.stats.length > 0 ? view.stats.join('   ') : 'None', {
    fontFamily: UI_FONT,
    fontSize: '14px',
    fontStyle: UI_BOLD,
    color: view.stats.length > 0 ? '#8df4ff' : '#91a6b8',
    wordWrap: { width: layout.textW },
  });
}

export function renderMarketItemDetail(scene: Phaser.Scene, view: MarketItemDetailView) {
  const w = 306;
  const body = scene.add.text(16, 74, view.body, {
    fontFamily: UI_FONT,
    fontSize: '13px',
    color: '#dbe6f2',
    lineSpacing: 3,
    wordWrap: { width: w - 32 },
    maxLines: 4,
  });
  const decisionText = view.decisionPreview.length > 0
    ? `\nDECISION\n${view.decisionPreview.join('\n')}`
    : '';
  const meta = scene.add.text(16, 86 + body.height, `${view.meta}${view.afterPurchase}${decisionText}`, {
    fontFamily: UI_FONT,
    fontSize: '11px',
    fontStyle: UI_BOLD,
    color: UI_CYAN,
    lineSpacing: 2,
    wordWrap: { width: w - 32 },
    maxLines: 9,
  });
  const h = Math.max(150, 104 + body.height + meta.height);
  const bg = scene.add.rectangle(0, 0, w, h, 0x07101a, 1)
    .setOrigin(0, 0)
    .setStrokeStyle(2, view.accent, 1);
  const frameArt: Phaser.GameObjects.GameObject[] = [];
  if (view.dossierFrameKey && scene.textures.exists(view.dossierFrameKey)) {
    scene.textures.get(view.dossierFrameKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    const frame = scene.add.image(w / 2, h / 2, view.dossierFrameKey)
      .setDisplaySize(w + 52, h + 56)
      .setAlpha(view.enabled ? 0.86 : 0.54)
      .setName('market-detail-dossier-frame');
    const glint = scene.add.image(w / 2, h / 2, view.dossierFrameKey)
      .setDisplaySize(w + 60, h + 64)
      .setAlpha(view.enabled ? 0.18 : 0.08)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setName('market-detail-dossier-frame');
    if (!view.enabled) {
      frame.setTint(0x8fa4bd);
      glint.setTint(0x8fa4bd);
    }
    frameArt.push(frame, glint);
  }
  const rail = scene.add.rectangle(0, 0, w, 4, view.accent, 1).setOrigin(0, 0);
  const title = scene.add.text(16, 13, view.title, {
    fontFamily: UI_FONT,
    fontSize: '17px',
    fontStyle: UI_BOLD,
    color: UI_GOLD,
    wordWrap: { width: view.price === undefined ? w - 32 : w - 118 },
    maxLines: 2,
  });
  const price = view.price === undefined
    ? undefined
    : scene.add.text(w - 16, 16, `${view.price}`, {
      fontFamily: UI_FONT,
      fontSize: '17px',
      fontStyle: UI_BOLD,
      color: '#f0c36f',
    }).setOrigin(1, 0);
  const scrapIcon = view.price !== undefined && view.scrapIconKey && scene.textures.exists(view.scrapIconKey)
    ? scene.add.image(w - 72, 27, view.scrapIconKey).setDisplaySize(22, 22).setAlpha(0.94)
    : undefined;
  const kicker = scene.add.text(16, 52, view.kicker.toUpperCase(), {
    fontFamily: UI_FONT,
    fontSize: '10px',
    fontStyle: UI_BOLD,
    color: '#91a6b8',
    wordWrap: { width: w - 32 },
    maxLines: 1,
  });
  const panel = scene.add.container(0, 0, [
    bg,
    ...frameArt,
    rail,
    title,
    ...(price ? [price] : []),
    ...(scrapIcon ? [scrapIcon] : []),
    kicker,
    body,
    meta,
  ]).setDepth(23040);
  const px = Math.max(12, Math.min(1280 - w - 12, view.anchorX - w / 2));
  const above = view.anchorY - h - 22;
  const py = above > 10 ? above : Math.min(720 - h - 12, view.anchorY + 48);
  return panel.setPosition(px, py);
}

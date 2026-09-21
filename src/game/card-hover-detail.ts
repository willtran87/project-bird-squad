import Phaser from 'phaser';
import { decisionCardKeywordSections } from './keyword-definitions';
import { renderMarketCardDossier, renderRouteInspectionReader } from './reward-card-inspection';
export {
  renderMarketServices,
  renderMarketCatalogLabel,
  renderMarketMerchandise,
  renderMarketItemDetail,
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
  marketPreview,
  marketUnavailableOffers,
  marketUtilityBuildObservations as marketItemNotes,
  marketWaymarkBuildObservations as marketMarkNotes,
  openCardPickerInspection,
  openRouteRewardInspection,
  requestRouteRewardCard,
  renderCardPickerInput,
  renderCardPickerInspection,
  renderCardPickerConfirmationRail,
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
  marketCardId?: string;
  marketRules?: { page: number; total: number; title: string; text: string };
  inspectionRules?: { page: number; total: number; title: string; text: string };
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
  upgradedMoltText?: string;
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
  moltText?: string;
  upgradedMoltText?: string;
  usesMolt: boolean;
  stats: string[];
}

export interface MarketItemDetailView {
  title: string;
  kicker: string;
  body: string;
  meta: string;
  price?: number;
  afterPurchase: string;
  build: string[];
  decisionPreview: string[];
  accent: number;
  anchorX: number;
  anchorY: number;
  enabled: boolean;
  dossierFrameKey?: string;
  scrapIconKey?: string;
}

export function renderCardHoverDetail(scene: Phaser.Scene, view: CardHoverDetailView) {
  if (['Route reward inspection', 'Preen candidate', 'Release candidate'].includes(view.zone)) return renderRouteInspectionReader(scene, view);
  if (view.zone.startsWith('Market /')) return renderMarketCardDossier(scene, view);
  const w = 300;
  const h = 450;
  const margin = 18;
  const cx = view.anchorX < 640
      ? Math.min(1280 - w / 2 - margin, view.anchorX + 232)
      : Math.max(w / 2 + margin, view.anchorX - 232);
  const cy = Math.max(h / 2 + margin, Math.min(720 - h / 2 - margin, view.anchorY));
  const left = cx - w / 2;
  const top = cy - h / 2;
  const bottom = cy + h / 2;
  const container = scene.add.container(0, 0)
    .setName('card-hover-detail');
  const add = <T extends Phaser.GameObjects.GameObject>(child: T) => {
    container.add(child);
    return child;
  };

  add(scene.add.rectangle(cx, cy, w + 8, h + 8, 0x06090f, 0.99).setStrokeStyle(3, view.accent, 1));
  if (view.artKey && scene.textures.exists(view.artKey)) {
    add(scene.add.image(cx, cy, view.artKey).setDisplaySize(w, h));
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
  const detailMeta = `${view.bird} / ${view.label} / ${view.zone}`;
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

// Preserve the page through portrait arrival; reset when the selected card changes.
const detailReading = new WeakMap<Phaser.Scene, { key: string; page: number }>();

export function changeSceneCardDetailPage(scene: Phaser.Scene, delta: number) {
  scene.children.getByName('deck-review-detail-panel')?.getData('changePage')?.(delta);
}

export function renderSceneCardDetail(scene: Phaser.Scene, view: SceneCardDetailView) {
  const text = (x: number, y: number, value: string, size = 22, width = 376) => scene.add.text(x, y, value, {
    fontFamily: UI_FONT, fontSize: `${size}px`, color: '#dce8f2', resolution: 2,
    wordWrap: { width, useAdvancedWrap: true }, lineSpacing: 3,
  });
  const panel = scene.add.rectangle(826, 394, 620, 460, 0x070b12, 0.99)
    .setStrokeStyle(1, view.accent, 0.5).setInteractive({ useHandCursor: false })
    .setName('deck-review-detail-panel');
  const title = text(536, 183, view.name, 26, 576).setColor(UI_GOLD).setFontStyle(UI_BOLD)
    .setName('deck-review-detail-title');
  const titleLines = title.getWrappedText();
  let excerpt = titleLines.slice(0, 2).join('\n');
  title.setText(excerpt + (titleLines.length > 2 ? '…' : ''));
  while (title.height > 64 && excerpt.length) {
    excerpt = excerpt.slice(0, -1).trimEnd();
    title.setText(`${excerpt}…`);
  }
  scene.add.circle(558, 265, 20, 0x141b22, 1).setStrokeStyle(1, view.accent, 0.8);
  text(558, 265, String(view.cost), 18, 40).setOrigin(0.5).setFontStyle(UI_BOLD);
  text(586, 255, 'Wingbeats', 16, 126).setColor('#a9c6d5');
  const art = view.artKey && scene.textures.exists(view.artKey) ? view.artKey
    : view.snagBorderKey && scene.textures.exists(view.snagBorderKey) ? view.snagBorderKey : undefined;
  scene.add.rectangle(626, 410, 162, 243, 0x141f2f, 1).setStrokeStyle(1, view.accent, 0.5);
  if (art) scene.add.image(626, 410, art).setDisplaySize(162, 243);
  else text(626, 410, 'Card art', 18, 150).setOrigin(0.5).setColor('#a9c6d5');
  const heading = text(734, 285, '', 16).setColor(UI_GOLD).setFontStyle(UI_BOLD);
  const body = text(734, 318, '').setName('deck-review-detail-body');
  const sections = [
    { title: view.usesMolt ? 'NOW · MOLT' : 'NOW', text: view.currentText },
    { title: view.usesMolt ? 'BASE' : 'PREEN', text: view.alternateText },
    ...(view.moltText ? [{ title: 'MOLT', text: view.moltText }] : []),
    ...(view.upgradedMoltText ? [{ title: 'MOLT · PREEN', text: view.upgradedMoltText }] : []),
    { title: 'PASSIVE FLOCK BONUSES', text: view.stats.length ? view.stats.join('\n') : 'No passive contribution.' },
    { title: 'CARD DETAILS', text: `${view.name}\n${view.bird} / ${view.label} / ${view.zone}\n${view.target} / ${view.role}` },
  ];
  sections.push(...decisionCardKeywordSections(sections));
  const pages: Array<{ title: string; text: string }> = [];
  for (const section of sections) {
    let lines: string[] = [];
    for (const line of body.getWrappedText(section.text || 'None.')) {
      body.setText([...lines, line].join('\n'));
      if (body.getBounds().bottom > 528 && lines.length) {
        pages.push({ title: section.title, text: lines.join('\n') }); lines = [];
      }
      lines.push(line);
    }
    if (lines.length) pages.push({ title: section.title, text: lines.join('\n') });
  }
  const key = JSON.stringify(sections);
  const state = detailReading.get(scene)?.key === key ? detailReading.get(scene)! : { key, page: 0 };
  detailReading.set(scene, state);
  const pageLabel = text(826, 568, '', 16, 150).setOrigin(0.5);
  text(826, 606, 'Read only · PgUp / PgDn · LB / RB', 14, 570).setOrigin(0.5).setColor('#a9c6d5');
  const buttons: Phaser.GameObjects.Rectangle[] = [];
  const labels: Phaser.GameObjects.Text[] = [];
  const show = (delta: number) => {
    const host = scene as Phaser.Scene & { pauseOverlayOpen?: boolean; settingsOverlayOpen?: boolean; deckReviewSearchActive?: boolean };
    if (delta && (host.pauseOverlayOpen || host.settingsOverlayOpen || host.deckReviewSearchActive)) return;
    state.page = Phaser.Math.Clamp(state.page + delta, 0, pages.length - 1);
    const current = pages[state.page];
    heading.setText(current.title); body.setText(current.text);
    pageLabel.setText(`${state.page + 1} / ${pages.length}`);
    panel.setData('reading', { ...current, page: state.page + 1, total: pages.length });
    buttons.forEach((button, i) => {
      const enabled = i ? state.page < pages.length - 1 : state.page > 0;
      button.setData('enabled', enabled).setAlpha(enabled ? 1 : 0.4);
      labels[i].setAlpha(enabled ? 1 : 0.4);
    });
  };
  [-1, 1].forEach((delta, i) => {
    const x = i ? 1042 : 610;
    const hit = scene.add.rectangle(x, 568, 140, 58, 0x152432, 1).setStrokeStyle(1, 0x8df4ff, 0.4)
      .setInteractive({ useHandCursor: true }).setName(`deck-review-detail-${i ? 'next' : 'previous'}`);
    hit.on('pointerdown', () => { if (hit.getData('enabled')) show(delta); });
    hit.on('pointerover', () => { if (hit.getData('enabled')) hit.setStrokeStyle(2, 0x8df4ff, 1); });
    hit.on('pointerout', () => hit.setStrokeStyle(1, 0x8df4ff, 0.4));
    buttons.push(hit);
    labels.push(text(x, 568, i ? 'Next →' : '← Previous', 16, 132).setOrigin(0.5));
  });
  panel.setData('changePage', show);
  show(0);
}

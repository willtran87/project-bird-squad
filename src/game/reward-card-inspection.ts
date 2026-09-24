import Phaser from 'phaser';
import { aggregateFlockStats, cardsFromSave, cardStatRows, flockStatLabel, KEYSTONE_AT, type Card } from '../main';
import { flockHandTarget } from './hand-size';
import { bindChoiceHint, choiceInputHint, inspectInputHint } from './choice-input-hints';
import { decisionCardKeywordSections, itemKeywordSections } from './keyword-definitions';

import {
  addRewardRevealHaloFx,
  addSupplyArtImage,
  addUiIconImage,
  compactEffectSummary,
  controlBindingLabel,
  displayName,
  cardLabel,
  loadedCardArtKey,
  GAME_HEIGHT,
  GAME_WIDTH,
  routeEffectTokens,
  routeMarkFamilyLabel,
  routeNodeTypeLabel,
  supplyAccent,
  supplyCategoryLabel,
  supplyCompactArtAssets,
  suitAccentColor,
  UI_BOLD,
  UI_CYAN,
  UI_FIELD,
  UI_FONT,
  UI_GOLD,
  UI_SOFT,
} from '../main';
import { alphaSupplyLibrary } from './runtime-data';
import { DECISION_UI, MIN_SUPPORTED_TOUCH_TARGET } from './theme';
import { decisionExcerpt, decisionText } from './decision-surface';
import { waymarkBuildRead } from './waymark-build-read';
import { handleSupplyInspection, openOutcomeInspection, openSupplyInspection, routeDecisionSections, supplyInspectionState } from './route-supply-reader';
import { uiIconAsset } from './ui-icon-assets';
import type { RewardCeremonyRenderContext, RewardDecisionPreview, RewardWaymarkView } from './battle/render-reward';
import type { CardHoverDetailView, MarketItemDetailView } from './card-hover-detail';

const marketItemReading = new WeakMap<Phaser.Scene, { key: string; page: number }>();

export function renderMarketServices(scene: any) {
  const rows = scene.marketUtilityShelf.flatMap((listing: any, index: number) => listing.id === 'supply' ? [] : [{
    title: scene.marketUtilityLabel(listing), price: listing.price, sold: listing.sold,
    enabled: !listing.sold && scene.marketUtilityEnabled(listing),
    icon: scene.marketUtilityServiceIcon(listing), focusId: `utility:${index}`,
    accent: listing.id === 'release' ? UI_FIELD.danger : UI_FIELD.cyan,
    inspect: () => scene.showMarketUtilityDetail(listing, 830, 420),
  }]);
  const price = scene.marketRefreshCost();
  rows.push({ title: 'Refresh stock', price, sold: false, enabled: scene.runState.scrap >= price,
    icon: 'market-refresh-service', focusId: 'refresh', accent: UI_FIELD.cyan,
    inspect: () => scene.showMarketRefreshDetail(price, 830, 420),
  });
  // Later districts add Boss Rigging and Route Plan: reserve all five rows.
  const step = Math.min(92, 264 / Math.max(1, rows.length - 1));
  const height = Math.max(MIN_SUPPORTED_TOUCH_TARGET, Math.min(76, step - 8));
  rows.forEach((row: any, index: number) => {
    const y = 328 + index * step;
    const trayKey = uiIconAsset('market-offer-tray').key;
    const hasTray = scene.textures.exists(trayKey);
    scene.add.rectangle(830, y, 540, height, 0x080f18, 0.98)
      .setStrokeStyle(1, row.accent, hasTray ? 0 : row.enabled ? 0.55 : 0.25)
      .setName('market-service-row');
    if (hasTray) {
      // Preserve the end fittings: scaling this wide tray as an ordinary image
      // would stretch the metalwork and turn its circular details into ovals.
      const scale = height / 192;
      scene.add.nineslice(830, y, trayKey, undefined, 540 / scale, 192, 105, 105, 0, 0)
        .setScale(scale).setAlpha(row.enabled ? 0.72 : 0.38).setName('market-service-tray');
    }
    addUiIconImage(scene, row.icon, 590, y, 36)?.setDisplaySize(36, 36).setName('market-service-icon');
    const label = scene.add.text(624, y, row.title, {
      fontFamily: UI_FONT, fontSize: '20px', color: '#e6eef6', resolution: 2,
      wordWrap: { width: 286, useAdvancedWrap: true }, lineSpacing: 2,
    }).setOrigin(0, 0.5).setName('market-service-label').setData('fullTitle', row.title);
    const lines = label.getWrappedText();
    let excerpt = lines.slice(0, 2).join('\n');
    label.setText(excerpt + (lines.length > 2 ? '…' : ''));
    while (label.height > height - 12 && excerpt.length) { excerpt = excerpt.slice(0, -1).trimEnd(); label.setText(`${excerpt}…`); }
    scene.add.text(1052, y, row.sold ? 'Sold' : `${row.price} Scrap`, {
      fontFamily: UI_FONT, fontSize: '20px', color: row.sold ? '#abc4d4' : row.enabled ? UI_CYAN : '#ffc7a4', resolution: 2,
    }).setOrigin(1, 0.5).setName('market-service-cost-value');
    if (!row.sold) scene.add.rectangle(830, y, 540, height, 0x000000, 0.001)
      .setInteractive({ useHandCursor: row.enabled }).setName(row.focusId === 'refresh' ? 'market-refresh-hit' : 'market-service-hit')
      .setData('marketFocusId', row.focusId).setData('marketAvailable', row.enabled).setData('label', row.title)
      .on('pointerover', row.inspect);
  });
}

export function renderMarketCatalogLabel(scene: any, x: number, y: number, w: number, h: number,
  kicker: string, title: string, price: number, enabled: boolean, accent: number) {
    const fill = enabled ? 0x0d1420 : 0x0a0e15;
    const stroke = enabled ? accent : 0x3f4c58;
    const labelFrame = scene.renderMarketItemLabelFrame(x, y, w, h, enabled);
    scene.renderMarketOfferTray(x, y, w, h, enabled, labelFrame ? 0.14 : 0.42);
    scene.add.rectangle(x, y, w, h, fill, enabled ? 0.96 : 0.88)
      .setAlpha(labelFrame ? enabled ? 0.18 : 0.26 : enabled ? 0.96 : 0.88)
      .setStrokeStyle(1.5, stroke, labelFrame ? 0.16 : enabled ? 0.9 : 0.58);
    const iconId = kicker === 'WAYMARKER' ? 'waymark-compass' : 'supply-pouch';
    const icon = iconId ? addUiIconImage(scene, iconId, x - w / 2 + 18, y, 28) : undefined;
    if (icon) icon.setAlpha(enabled ? 0.94 : 0.42);
    const textLeft = x - w / 2 + (icon ? 54 : 8);
    const textWrapWidth = Math.max(38, w - (icon ? 98 : 58));
    // Catalog callers are exclusively WAYMARKER/SUPPLY; neither uses a kicker row.
    scene.add.text(textLeft, y - h / 2 + 14, title, {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: enabled ? '#8df4ff' : '#596a78',
      wordWrap: { width: textWrapWidth },
      maxLines: 2,
      lineSpacing: -1
    });
    scene.renderMarketPriceChipFrame(x + w / 2 - 28, y - h / 2 + 20, 70, 32, enabled, labelFrame ? 0.28 : 0.5);
    scene.add.text(x + w / 2 - 9, y - h / 2 + 9, `${price}`, {
      fontFamily: UI_FONT,
      fontSize: '13px',
      fontStyle: UI_BOLD,
      color: enabled ? '#f0c36f' : '#91a6b8',
      align: 'right'
    }).setOrigin(1, 0);
    addUiIconImage(scene, 'scrap-gear', x + w / 2 - 42, y - h / 2 + 18, 20)
      ?.setAlpha(enabled ? 0.94 : 0.46);
  }

export function renderMarketMerchandise(scene: Phaser.Scene, view: {
  index: number; title: string; price: number; enabled: boolean; sold?: boolean;
  accent: number; artKey?: string; kind: 'waymark' | 'supply'; focusId: string; onInspect: () => void;
}) {
  const x = 636 + view.index * 194;
  scene.add.rectangle(x, 480, 184, 256, 0x080f18, 0.98)
    .setStrokeStyle(1, view.accent, view.enabled ? 0.55 : 0.25).setName('market-merchandise-frame');
  const backplateKey = uiIconAsset('market-object-backplate-frame').key;
  const hasBackplate = scene.textures.exists(backplateKey);
  if (hasBackplate) scene.add.image(x, 416, backplateKey)
    .setDisplaySize(152, 114).setAlpha(view.enabled ? 0.8 : 0.42)
    .setName('market-merchandise-backplate');
  const key = view.artKey && scene.textures.exists(view.artKey) ? view.artKey : undefined;
  const artSize = hasBackplate ? 84 : 112;
  if (key) scene.add.image(x, 416, key).setDisplaySize(artSize, artSize).setName('market-merchandise-art');
  else addUiIconImage(scene, view.kind === 'waymark' ? 'market-waymark-badge' : 'market-supply-crate', x, 416, hasBackplate ? 58 : 64);
  const title = scene.add.text(x - 76, 492, view.title, {
    fontFamily: UI_FONT, fontSize: '18px', color: '#e6eef6', resolution: 2,
    wordWrap: { width: 152, useAdvancedWrap: true }, lineSpacing: 3,
  }).setName('market-merchandise-title').setData('fullTitle', view.title);
  const lines = title.getWrappedText();
  let excerpt = lines.slice(0, 3).join('\n');
  title.setText(excerpt + (lines.length > 3 ? '…' : ''));
  while (title.height > 70 && excerpt.length) { excerpt = excerpt.slice(0, -1).trimEnd(); title.setText(`${excerpt}…`); }
  scene.add.text(x - 76, 578, view.sold ? 'Sold' : `${view.price} Scrap`, {
    fontFamily: UI_FONT, fontSize: '18px', color: view.sold ? '#abc4d4' : view.enabled ? UI_CYAN : '#ffc7a4', resolution: 2,
  }).setName('market-merchandise-price');
  if (!view.sold) scene.add.rectangle(x, 480, 184, 256, 0x000000, 0.001)
    .setInteractive({ useHandCursor: view.enabled }).setName('market-merchandise-hit')
    .setData('marketFocusId', view.focusId).setData('marketAvailable', view.enabled).setData('label', view.title)
    .on('pointerover', view.onInspect);
}

export function renderMarketItemDetail(scene: Phaser.Scene, view: MarketItemDetailView, options?: {
  sections: Array<{ title: string; text: string }>;
  resourceLabel: string;
  contextLabel: string;
  onPage: (page: { title: string; text: string; page: number; total: number }) => void;
}) {
  const owner = scene as any;
  if (!owner.marketOpen || owner.marketCategory === 'catalog') return renderLegacyMarketItemDetail(scene, view);
  const panel = scene.add.container(0, 0).setDepth(23040).setName('market-item-reader');
  const add = <T extends Phaser.GameObjects.GameObject>(o: T) => { panel.add(o); return o; };
  const text = (x: number, y: number, value: string, size = 22, width = 324) => add(scene.add.text(x, y, value, {
    fontFamily: UI_FONT, fontSize: `${size}px`, color: '#e6eef6', resolution: 2,
    wordWrap: { width, useAdvancedWrap: true }, lineSpacing: 3,
  }));
  add(scene.add.rectangle(264, 428, 360, 436, 0x070d15, 0.97).setStrokeStyle(1, view.accent, 0.58)
    .setInteractive({ useHandCursor: false }).setName('market-item-reader-frame'));
  const title = text(102, 228, view.title, 24).setColor(UI_GOLD).setFontStyle(UI_BOLD).setName('market-item-reader-title');
  const wrapped = title.getWrappedText();
  let excerpt = wrapped.slice(0, 2).join('\n');
  title.setText(excerpt + (wrapped.length > 2 ? '…' : ''));
  while (title.height > 64 && excerpt.length) { excerpt = excerpt.slice(0, -1).trimEnd(); title.setText(`${excerpt}…`); }
  // These exact blocking rows come from marketPreview/marketRefreshDecisionPreview.
  // Keep them visible on every page, not only inside Purchase Preview.
  const blocker = view.decisionPreview.find(row => /^(NEED \d+ MORE SCRAP|SUPPLY POUCH FULL|NO ELIGIBLE CARD)$/.test(row));
  text(102, 307, view.price === undefined ? 'Item details' : `Cost ${view.price} Scrap`, 18)
    .setColor(view.enabled && !blocker ? UI_CYAN : '#ffc7a4').setName('market-item-reader-cost');
  if (options) text(426, 307, options.resourceLabel, 18, 140).setOrigin(1, 0).setColor('#abc4d4').setName('market-card-wingbeats');
  if (blocker) text(102, 334, blocker, 18).setColor('#ffc7a4').setName('market-item-reader-blocker');
  else if (options) text(102, 334, options.contextLabel, 16).setColor('#abc4d4').setName('market-card-context');
  const heading = text(102, blocker || options ? 364 : 346, '', 16).setColor(UI_GOLD).setFontStyle(UI_BOLD);
  const body = text(102, blocker || options ? 394 : 376, '').setName('market-item-reader-body');
  const sections = options?.sections ?? [
    { title: 'EFFECT', text: view.body },
    { title: 'RULES', text: view.meta },
    ...(view.build.length ? [{ title: 'BUILD READ', text: view.build.join('\n') }] : []),
    ...(view.decisionPreview.length || view.afterPurchase ? [{ title: 'PURCHASE PREVIEW', text: [...view.decisionPreview, view.afterPurchase].filter(Boolean).join('\n') }] : []),
    { title: 'ITEM DETAILS', text: `${view.title}\n${view.kicker}` },
  ];
  if (!options) sections.push(...itemKeywordSections(sections));
  const pages: Array<{ title: string; text: string }> = [];
  for (const section of sections) {
    let lines: string[] = [];
    for (const line of body.getWrappedText(section.text || 'No additional rules.')) {
      body.setText([...lines, line].join('\n'));
      if (body.getBounds().bottom > 530 && lines.length) { pages.push({ title: section.title, text: lines.join('\n') }); lines = []; }
      lines.push(line);
    }
    if (lines.length) pages.push({ title: section.title, text: lines.join('\n') });
  }
  const key = JSON.stringify([view.price, view.enabled, sections]);
  const state = marketItemReading.get(scene)?.key === key ? marketItemReading.get(scene)! : { key, page: 0 };
  marketItemReading.set(scene, state);
  const pageLabel = text(264, 551, '', 16, 160).setOrigin(0.5);
  bindChoiceHint(scene, text(264, 626, '', 15, 324).setOrigin(0.5).setColor('#abc4d4'), mode =>
    mode === 'pointer' ? 'Read only · Pages never purchase' : `${mode === 'controller' ? 'Y' : controlBindingLabel('roost')}: next page · Read only`);
  const show = (delta: number) => {
    if (delta && (owner.pauseOverlayOpen || owner.settingsOverlayOpen)) return;
    // Wrap to match the existing Market card Inspect/Y convention.
    state.page = (state.page + delta + pages.length) % pages.length;
    const current = pages[state.page];
    heading.setText(current.title); body.setText(current.text);
    pageLabel.setText(`${state.page + 1} / ${pages.length}`);
    panel.setData('reading', { ...current, page: state.page + 1, total: pages.length });
    options?.onPage(panel.getData('reading'));
    if (delta) owner.updateTextState();
  };
  [-1, 1].forEach((delta, i) => {
    const x = i ? 357 : 171;
    const button = add(scene.add.rectangle(x, 591, 140, 58, 0x142734, 1).setStrokeStyle(1, 0x7195aa, 0.8)
      .setInteractive({ useHandCursor: true }).setName(`market-item-reader-${i ? 'next' : 'previous'}`));
    button.on('pointerdown', () => show(delta));
    button.on('pointerover', () => button.setStrokeStyle(2, 0x8df4ff, 1));
    button.on('pointerout', () => button.setStrokeStyle(1, 0x7195aa, 0.8));
    text(x, 591, i ? 'Next →' : '← Previous', 16, 136).setOrigin(0.5);
  });
  panel.setData('turnRulesPage', show); show(0); return panel;
}

function renderLegacyMarketItemDetail(scene: Phaser.Scene, view: MarketItemDetailView) {
  const w = 306;
  const body = scene.add.text(16, 74, view.body, {
    fontFamily: UI_FONT,
    fontSize: '13px',
    color: '#dbe6f2',
    lineSpacing: 3,
    wordWrap: { width: w - 32 },
    maxLines: 4,
  });
  const buildText = view.build.length > 0
    ? `\nBUILD READ\n${view.build.join('\n')}`
    : '';
  const decisionText = view.decisionPreview.length > 0
    ? `\nDECISION\n${view.decisionPreview.join('\n')}`
    : '';
  const meta = scene.add.text(16, 86 + body.height, `${view.meta}${view.afterPurchase}${buildText}${decisionText}`, {
    fontFamily: UI_FONT,
    fontSize: '11px',
    fontStyle: UI_BOLD,
    color: UI_CYAN,
    lineSpacing: 2,
    wordWrap: { width: w - 32 },
    maxLines: 12,
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

const inspectionReading = new WeakMap<Phaser.Scene, { key: string; page: number }>();

/** Shared explicit reward / Preen / Release reading, never a commitment action. */
export function renderRouteInspectionReader(scene: Phaser.Scene, view: CardHoverDetailView) {
  const cx = view.zone === 'Route reward inspection' ? 640 : 404;
  const left = cx - 220;
  const panel = scene.add.container(0, 0).setName('route-inspection-reader');
  const add = <T extends Phaser.GameObjects.GameObject>(child: T) => { panel.add(child); return child; };
  const text = (x: number, y: number, value: string, size = 22, width = 396) => add(scene.add.text(x, y, value, {
    fontFamily: UI_FONT, fontSize: `${size}px`, resolution: 2, color: '#edf3f6',
    wordWrap: { width, useAdvancedWrap: true }, lineSpacing: 3,
  }));
  // Clicking the reader itself must not activate the dismissible outside scrim.
  add(scene.add.rectangle(cx, 365, 440, 570, 0x0a131e, 1).setStrokeStyle(1, view.accent, 0.65)
    .setInteractive().setName('route-inspection-reader-frame'));
  const art = view.artKey && scene.textures.exists(view.artKey) ? view.artKey
    : view.snagBorderKey && scene.textures.exists(view.snagBorderKey) ? view.snagBorderKey : undefined;
  let portrait: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle = art
    ? add(scene.add.image(left + 70, 178, art).setDisplaySize(96, 144))
    : add(scene.add.rectangle(left + 70, 178, 96, 144, 0x19313c, 1).setStrokeStyle(1, view.accent, 0.6));
  portrait.setName('route-inspection-reader-art');
  // Late portrait loading must not replace a paging button under the pointer.
  panel.setData('updateArt', (key?: string) => {
    if (!panel.active || !key || !scene.textures.exists(key)) return;
    if (portrait instanceof Phaser.GameObjects.Image) portrait.setTexture(key).setDisplaySize(96, 144);
    else {
      const replacement = scene.add.image(portrait.x, portrait.y, key).setDisplaySize(96, 144)
        .setDepth(portrait.depth).setName('route-inspection-reader-art');
      panel.addAt(replacement, panel.getIndex(portrait)); portrait.destroy(); portrait = replacement;
    }
  });
  const name = text(left + 136, 106, view.name, 24, 282).setColor(UI_GOLD).setFontStyle(UI_BOLD)
    .setName('route-inspection-reader-name');
  let excerpt = name.getWrappedText().slice(0, 2).join('\n');
  const shortened = name.getWrappedText().length > 2;
  name.setText(excerpt + (shortened ? '…' : ''));
  while (name.height > 62 && excerpt.length) { excerpt = excerpt.slice(0, -1).trimEnd(); name.setText(`${excerpt}…`); }
  text(left + 136, 188, `${view.cost} Wingbeat${view.cost === 1 ? '' : 's'}`, 18, 282).setColor(UI_CYAN);
  text(left + 136, 220, 'READING ONLY', 15, 282).setColor('#abc0cd');
  add(scene.add.rectangle(cx, 267, 396, 1, 0x597584, 0.5));
  const heading = text(left + 22, 282, '', 16).setColor(UI_GOLD).setFontStyle(UI_BOLD);
  const body = text(left + 22, 312, '').setName('route-inspection-reader-body');
  const sections = [
    { title: view.usesMolt ? 'NOW · MOLT' : 'NOW', text: view.currentText },
    { title: view.usesMolt ? 'BASE' : 'PREEN', text: view.usesMolt ? view.baseText : view.upgradedText },
    ...(!view.usesMolt && view.moltText ? [{ title: 'MOLT', text: view.moltText }] : []),
    ...(view.upgradedMoltText ? [{ title: 'MOLT · PREEN', text: view.upgradedMoltText }] : []),
    { title: 'PASSIVE FLOCK BONUSES', text: view.stats.length ? view.stats.join('\n') : 'No passive contribution.' },
    { title: 'CARD DETAILS', text: `${view.name}\n${view.bird} / ${view.label}\n${view.target} / ${view.role}\n${view.zone}` },
    ...(view.zone === 'Route reward inspection' ? routeDecisionSections(scene) : []),
  ];
  sections.push(...decisionCardKeywordSections(sections));
  const pages: Array<{ title: string; text: string }> = [];
  for (const section of sections) {
    let lines: string[] = [];
    for (const line of body.getWrappedText(section.text || 'None.')) {
      body.setText([...lines, line].join('\n'));
      if (body.y + body.height > 518 && lines.length) { pages.push({ title: section.title, text: lines.join('\n') }); lines = []; }
      lines.push(line);
    }
    if (lines.length) pages.push({ title: section.title, text: lines.join('\n') });
  }
  const key = JSON.stringify(sections);
  const state = inspectionReading.get(scene)?.key === key ? inspectionReading.get(scene)! : { key, page: 0 };
  inspectionReading.set(scene, state);
  const pageLabel = text(cx, 540, '', 16, 180).setOrigin(0.5);
  text(cx, 624, `${controlBindingLabel('previous')} / ${controlBindingLabel('next')} · D-pad · Pages`, 15).setOrigin(0.5).setColor('#abc0cd');
  const buttons: Phaser.GameObjects.Rectangle[] = [];
  const labels: Phaser.GameObjects.Text[] = [];
  const refresh = () => {
    const current = pages[state.page];
    heading.setText(current.title); body.setText(current.text); pageLabel.setText(`${state.page + 1} / ${pages.length}`);
    view.inspectionRules = { page: state.page + 1, total: pages.length, ...current };
    panel.setData('reading', view.inspectionRules);
    buttons.forEach((button, i) => {
      const enabled = i ? state.page < pages.length - 1 : state.page > 0;
      button.setData('enabled', enabled).setAlpha(enabled ? 1 : 0.4); labels[i].setAlpha(enabled ? 1 : 0.4);
    });
  };
  const turn = (delta: number) => {
    if ((scene as any).pauseOverlayOpen || (scene as any).settingsOverlayOpen) return;
    state.page = Phaser.Math.Clamp(state.page + delta, 0, pages.length - 1);
    refresh(); (scene as any).updateTextState?.();
  };
  [-1, 1].forEach((delta, i) => {
    const x = cx + (i ? 106 : -106);
    const button = add(scene.add.rectangle(x, 582, 190, MIN_SUPPORTED_TOUCH_TARGET, 0x19313c, 1)
      .setStrokeStyle(1, 0x71b8c6, 0.65).setInteractive({ useHandCursor: true })
      .setName(`route-inspection-reader-${i ? 'next' : 'previous'}`));
    button.on('pointerdown', () => { if (button.getData('enabled')) turn(delta); });
    button.on('pointerover', () => { if (button.getData('enabled')) button.setStrokeStyle(2, 0x8df4ff, 1); });
    button.on('pointerout', () => button.setStrokeStyle(1, 0x71b8c6, 0.65));
    buttons.push(button); labels.push(text(x, 582, i ? 'Next →' : '← Previous', 18, 180).setOrigin(0.5));
  });
  panel.setData('turnRulesPage', turn); refresh(); return panel;
}

function turnRouteInspectionPage(scene: any, delta: number) {
  scene.hoverCardDetail?.getByName('route-inspection-reader')?.getData('turnRulesPage')?.(delta);
}

export function cardPickerDeckImpact(scene: any, index: number) {
  const before = cardsFromSave(scene.runState.deck);
  if (!before[index] || !scene.cardPickerMode) return undefined;
  const release = scene.cardPickerMode === 'release';
  const after = release ? before.filter((_, i) => i !== index)
    : before.map((card, i) => i === index ? { ...card, upgraded: true } : card);
  const beforeStats = aggregateFlockStats(before);
  const afterStats = aggregateFlockStats(after);
  const hand = (cards: Card[], stats: Record<string, number>) => flockHandTarget(
    stats.draw ?? 0, cards.filter(card => card.runtime.suit === 'plumes').length >= KEYSTONE_AT, scene.runState.leaderId,
  );
  const changes = [...new Set([...Object.keys(beforeStats), ...Object.keys(afterStats)])]
    .filter(key => (beforeStats[key] ?? 0) !== (afterStats[key] ?? 0))
    .map(key => `${flockStatLabel(key)}: ${beforeStats[key] ?? 0} > ${afterStats[key] ?? 0}`);
  const cost = scene.cardPickerContext === 'market' ? scene.marketCardPickerPrice(scene.cardPickerMode, before[index]) : 0;
  const handBefore = hand(before, beforeStats), handAfter = hand(after, afterStats);
  return {
    deckBefore: before.length, deckAfter: after.length, handBefore, handAfter, changes, cost,
    lines: [
      `${release ? 'RELEASE' : 'PREEN'} / YOUR FLIGHT`,
      `Deck: ${before.length} > ${after.length} cards`,
      `Base hand target: ${handBefore} > ${handAfter}`,
      changes.length ? `Flock Stats totals\n${changes.join(' / ')}` : 'Flock Stats unchanged.',
      release ? 'A smaller draw pool, but this card and its passive stats leave the flight.' : 'Same draw pool size. Only this copy receives the upgrade.',
      scene.cardPickerContext === 'market'
        ? cost > scene.runState.scrap ? `Service: ${cost} Scrap. Need ${cost - scene.runState.scrap} more.` : `Service: ${cost} Scrap. Remaining: ${scene.runState.scrap - cost}.`
        : 'No Scrap charged for this choice.',
      'Flight only. Your permanent collection is unchanged.',
      'Base target includes Leader and suit threshold. Waymarks, opening protection and card effects can change actual draws; purchase triggers are not included.',
    ],
  };
}

export function rewardDeckImpact(scene: any, card: Card) {
  const before: Card[] = scene.allDeckCards();
  const preen = scene.mode === 'upgradeReward';
  const after = preen
    ? before.map((owned) => owned.id === card.id ? { ...owned, upgraded: true } : owned)
    : [...before, card];
  const handTarget = (cards: Card[]) => flockHandTarget(
    aggregateFlockStats(cards).draw ?? 0,
    cards.filter((owned) => owned.runtime.suit === 'plumes').length >= KEYSTONE_AT,
    scene.runLeaderId,
  );
  return {
    deckBefore: before.length, deckAfter: after.length,
    handBefore: handTarget(before), handAfter: handTarget(after),
    stats: preen
      ? cardStatRows({ ...card, upgraded: true }).filter((row) => !cardStatRows(card).includes(row))
      : cardStatRows(card),
    scope: preen ? 'Preen changes this flight only; collection ownership is unchanged.'
      : 'Collection record is permanent; this playable copy joins this flight.',
    drawScope: 'Base target includes Flock Stats and Leader. Opening protection, retained cards, Waymarks and card effects can change actual draws.',
  };
}

// Market rules get their own reading surface; art remains on the offer shelf.
// Pagination uses rendered height, so conditional rules are never silently lost.
export function renderMarketCardDossier(scene: Phaser.Scene, view: CardHoverDetailView) {
  const owner = scene as any;
  const listing = owner.marketCardShelf?.find((offer: any) => offer.id === view.marketCardId);
  const preview: string[] = owner.marketDecisionPreview ?? [];
  const build: string[] = owner.marketBuildObservations ?? [];
  const sections = [
    { title: view.usesMolt ? 'NOW / MOLT' : 'NOW', text: view.currentText },
    { title: view.usesMolt ? 'BASE' : 'PREEN', text: view.usesMolt ? view.baseText : view.upgradedText },
    ...(!view.usesMolt && view.moltText ? [{ title: 'MOLT', text: view.moltText }] : []),
    ...(view.upgradedMoltText ? [{ title: 'MOLT / PREEN', text: view.upgradedMoltText }] : []),
    { title: 'PASSIVE FLOCK BONUSES', text: view.stats.length ? view.stats.join('\n') : 'No passive contribution.' },
    { title: 'PURCHASE PREVIEW', text: [...preview, 'Buying adds this card to your flight. Permanent collection ownership is kept.'].join('\n') },
    ...(build.length ? [{ title: 'BUILD READ', text: build.join('\n') }] : []),
    { title: 'DRAW ASSUMPTIONS', text: 'Base hand includes Leader and suit threshold. Waymarks, temporary effects and opening protection can change actual draws.' },
    { title: 'CARD DETAILS', text: `${view.name}\n${view.bird} / ${view.label}\n${view.target} / ${view.role}\n${view.cost} Wingbeats to play\n${view.zone}` },
  ];
  sections.push(...decisionCardKeywordSections(sections));
  const panel = renderMarketItemDetail(scene, {
    title: view.name, kicker: view.label, body: view.currentText, meta: '', price: listing?.price,
    afterPurchase: '', build, decisionPreview: preview, accent: view.accent,
    anchorX: view.anchorX, anchorY: view.anchorY,
    enabled: Boolean(listing && !listing.sold && owner.runState.scrap >= listing.price),
  }, { sections, resourceLabel: `${view.cost} Wingbeat${view.cost === 1 ? '' : 's'}`,
    contextLabel: `${view.target} / ${view.role}`,
    onPage: page => { view.marketRules = page; },
  }).setName('market-fixed-card-inspector');
  for (const [from, to] of [
    ['market-item-reader-frame', 'market-rules-frame'], ['market-item-reader-body', 'market-rules-body'],
    ['market-item-reader-next', 'market-rules-next'], ['market-item-reader-previous', 'market-rules-previous'],
  ]) panel.getByName(from)?.setName(to);
  return panel;
}

// Truncate at a measured line boundary, never silently clip a partial rule.
// Inspect retains the complete effect and all conditional/alternate text.
export function boundedRewardText(text: Phaser.GameObjects.Text, maxLines: number) {
  const lines = text.getWrappedText();
  if (lines.length <= maxLines) return text;
  const visible = lines.slice(0, maxLines);
  let last = visible[maxLines - 1];
  const width = text.style.wordWrapWidth ?? text.width;
  while (last.length && text.context.measureText(`${last}...`).width > width) last = last.slice(0, -1);
  visible[maxLines - 1] = `${last.trimEnd()}...`;
  return text.setText(visible.join('\n'));
}

export function renderFocusedBuildRead(context: Pick<RewardCeremonyRenderContext, 'kind' | 'cards' | 'scene' | 'target' | 'fontFamily' | 'boldFontStyle' | 'width' | 'skip'>) {
  if (context.kind !== 'card') return;
  const card = context.cards?.find((choice) => choice.armed || choice.focused) ?? context.cards?.[0];
  if (!card) return;
  const { scene, target, fontFamily, boldFontStyle } = context;
  const left = context.width / 2 - 438;
  target.add(scene.add.rectangle(left, 618, 584, 78, 0x050c14, 0.98)
    .setOrigin(0).setStrokeStyle(1, card.accent, 0.6).setName('reward-build-read-panel'));
  target.add(scene.add.text(left + 14, 624, context.skip?.armed ? 'SKIP / KEEP YOUR CURRENT DECK' : `BUILD READ / ${card.name}`, {
    fontFamily, fontSize: '13px', fontStyle: boldFontStyle, color: '#bfe8f4',
    fixedWidth: 556, maxLines: 1,
  }).setName('reward-build-read-title'));
  const rows = context.skip?.armed
    ? ['No new card or passive Flock Stats.', 'Keep the same draw pool; take Scrap instead.']
    : card.footerRows.slice(0, 2);
  rows.forEach((text, index) => target.add(scene.add.text(left + 14, 646 + index * 22, text, {
    fontFamily, fontSize: '16px', color: text.startsWith('!') ? '#ffbc92' : '#f4f8fb',
    fixedWidth: 556, maxLines: 1,
  }).setName(context.skip?.armed ? 'reward-skip-tradeoff' : card.footerUsesObservations ? 'reward-build-observation' : 'reward-card-stat')));
}

export function renderRouteSupplyRewardChoices(scene: any, x: number, y: number) {
  const choices = scene.routeSupplyRewardChoices.flatMap((id: string) => {
    const supply = alphaSupplyLibrary.get(id);
    return supply ? [supply] : [];
  });
  choices.forEach((supply: any, index: number) => {
    const cx = x + (index - (choices.length - 1) / 2) * 224;
    const focused = index === scene.routeSupplyRewardChoiceIndex;
    const armed = scene.routeSupplyRewardArmedId === supply.id;
    const accent = supplyAccent(supply);
    const key = supplyCompactArtAssets[supply.id]?.key;
    scene.add.rectangle(cx + 5, y + 7, 206, 276, 0x020409, 0.64);
    scene.add.rectangle(cx, y, 206, 276, 0x06101a, 0.96)
      .setStrokeStyle(focused ? 3 : 1.5, armed ? UI_FIELD.gold : focused ? UI_FIELD.cyan : accent, focused ? 1 : 0.7)
      .setName(focused ? 'route-supply-reward-focus-ring' : 'route-supply-reward-card');
    scene.add.rectangle(cx, y - 58, 118, 118, 0x020409, 0.62).setStrokeStyle(1, accent, 0.62);
    if (key && scene.textures.exists(key)) {
      addSupplyArtImage(scene, cx, y - 58, key).setDisplaySize(106, 106);
    } else {
      scene.add.text(cx, y - 75, scene.supplyGlyph(supply), {
        fontFamily: UI_FONT,
        fontSize: '32px',
        fontStyle: UI_BOLD,
        color: '#ffe7c9',
        stroke: '#020409',
        strokeThickness: 2,
      }).setOrigin(0.5, 0);
    }
    const title = scene.add.text(cx, y + 10, supply.name, {
      fontFamily: UI_FONT,
      fontSize: '18px',
      fontStyle: UI_BOLD,
      color: UI_GOLD,
      align: 'center',
      wordWrap: { width: 182, useAdvancedWrap: true }, resolution: 2,
    }).setOrigin(0.5, 0).setName('route-supply-reward-title');
    const lines = title.getWrappedText();
    let excerpt = lines.slice(0, 2).join('\n');
    title.setText(excerpt + (lines.length > 2 ? '…' : ''));
    while (title.height > 52 && excerpt.length) { excerpt = excerpt.slice(0, -1).trimEnd(); title.setText(`${excerpt}…`); }
    scene.add.text(cx, y + 91, armed ? 'Confirm to pack' : focused ? 'Select this Supply' : 'Choose', {
      fontFamily: UI_FONT,
      fontSize: '16px', resolution: 2,
      fontStyle: UI_BOLD,
      color: armed ? UI_GOLD : focused ? '#dffbff' : '#a9bbc8',
      align: 'center',
      fixedWidth: 188,
      maxLines: 1,
    }).setOrigin(0.5, 0).setName('route-supply-reward-state');
    const hit = scene.add.rectangle(cx, y, 214, 284, 0x000000, 0.01)
      .setInteractive({ useHandCursor: true })
      .setName('route-supply-reward-hit')
      .setData('supplyId', supply.id);
    hit.on('pointerover', () => {
      if (supplyInspectionState(scene) || scene.pauseOverlayOpen || scene.settingsOverlayOpen || scene.routeSupplyRewardArmedId || scene.routeSupplyRewardChoiceIndex === index) return;
      scene.routeSupplyRewardChoiceIndex = index;
      scene.renderAll();
    });
    hit.on('pointerdown', () => {
      if (!supplyInspectionState(scene) && !scene.pauseOverlayOpen && !scene.settingsOverlayOpen) scene.requestRouteSupplyReward(supply.id);
    });
    scene.add.rectangle(cx, y + 180, 206, 58, 0x142734, 1).setStrokeStyle(1, 0x7195aa, 0.8)
      .setInteractive({ useHandCursor: true }).setName('route-supply-inspect-hit').setData('supplyId', supply.id)
      .on('pointerdown', () => openSupplyInspection(scene, supply.id));
    scene.add.text(cx, y + 180, 'Inspect', { fontFamily: UI_FONT, fontSize: '18px', color: '#e6eef6', resolution: 2 }).setOrigin(0.5);
  });
}

export function routeRewardChoiceDebugState(scene: any) {
  const supplyChoices = scene.routeSupplyRewardChoices.map((id: string) => {
    const supply = alphaSupplyLibrary.get(id);
    return supply ? {
      id,
      name: supply.name,
      rarity: supply.rarity,
      category: supply.category,
      timing: supply.timing,
      description: supply.description,
    } : { id };
  });
  const card = scene.pendingRouteReward ? scene.focusedRouteRewardCard() : undefined;
  const cardChoices = scene.routeCardRewardChoices.map((choice: any) => choice.id);
  if (cardChoices.length) {
    return {
      cardChoices,
      supplyChoices,
      itemInspection: supplyInspectionState(scene),
      inputFocus: {
        index: scene.routeRewardChoiceIndex,
        cardId: card?.id,
        cardName: card?.name,
        observations: scene.routeRewardCardObservations(card),
        armed: Boolean(scene.routeRewardArmedCardId),
        armedCardId: scene.routeRewardArmedCardId,
        commitBlockedUntilSelected: !scene.routeRewardArmedCardId,
        visible: scene.children.list.some((child: any) => child.name === 'route-reward-input-focus-ring'),
        controls: {
          choose: 'Arrow keys / D-pad',
          claim: scene.routeRewardArmedCardId ? 'Confirm / A commits' : 'Confirm / A selects',
          inspect: 'Roost / Y',
          back: 'Back / B',
        },
      },
    };
  }
  if (supplyChoices.length < 2) return { cardChoices, supplyChoices, itemInspection: supplyInspectionState(scene), outcomeSummary: scene.pendingRouteReward?.effectText, inputFocus: undefined };
  const supply = scene.focusedRouteSupplyReward();
  return {
    cardChoices,
    supplyChoices,
    supplyInspection: supplyInspectionState(scene),
    inputFocus: {
      kind: 'supply',
      index: scene.routeSupplyRewardChoiceIndex,
      supplyId: supply?.id,
      supplyName: supply?.name,
      description: supply?.description,
      timing: supply?.timing,
      armed: Boolean(scene.routeSupplyRewardArmedId),
      armedSupplyId: scene.routeSupplyRewardArmedId,
      commitBlockedUntilSelected: !scene.routeSupplyRewardArmedId,
      visible: scene.children.list.some((child: any) => child.name === 'route-supply-reward-focus-ring'),
      controls: {
        choose: 'Arrow keys / D-pad',
        claim: scene.routeSupplyRewardArmedId ? 'Confirm / A commits' : 'Confirm / A selects',
        inspect: 'Roost / Y',
        back: 'Back / B',
      },
    },
  };
}

export function renderRouteRewardInspection(scene: any) {
  if (!scene.routeRewardInspectionCardId) return;
  const card = scene.routeCardRewardChoices.find((candidate: any) => candidate.id === scene.routeRewardInspectionCardId);
  if (!card) {
    scene.routeRewardInspectionCardId = undefined;
    return;
  }
  const scrim = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.86)
    .setInteractive({ useHandCursor: true })
    .setDepth(23010)
    .setName('route-reward-inspection-scrim');
  scrim.on('pointerdown', () => scene.closeRouteRewardInspection());
  scene.add.text(GAME_WIDTH / 2, 38, 'FULL CARD INSPECTION', {
    fontFamily: UI_FONT,
    fontSize: '13px',
    fontStyle: UI_BOLD,
    color: '#ffe08a',
    letterSpacing: 1.4,
  }).setOrigin(0.5).setDepth(23030);
  const returnLabel = scene.routeRewardArmedCardId ? 'RETURN TO CONFIRM PICK' : 'RETURN TO THIS CHOICE';
  scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 34, `${controlBindingLabel('back')} / B / TAP OUTSIDE  ${returnLabel}`, {
    fontFamily: UI_FONT,
    fontSize: '12px',
    fontStyle: UI_BOLD,
    color: '#dffbff',
  }).setOrigin(0.5).setDepth(23030);
  scene.showHoverCardDetail(card, 'Route reward inspection', card.cost, GAME_WIDTH / 2, GAME_HEIGHT / 2);
}

export function renderRouteRewardBuildRead(scene: any, frame: any) {
  if (!scene.routeCardRewardChoices.length) return;
  decisionText(scene, frame.left + 54, frame.bottom - 218, 'BUILD READ', 326, 16, DECISION_UI.secondary).setName('route-reward-build-read-title');
  scene.routeCardRewardChoices.slice(0, 2).forEach((card: any, index: number) => {
    const observations = scene.routeRewardCardObservations(card).slice(0, 2);
    const rowY = frame.bottom - 171 + index * 56;
    scene.add.rectangle(frame.left + 217, rowY, 326, 56, DECISION_UI.surface, 1).setName('route-reward-build-read-row');
    decisionExcerpt(decisionText(scene, frame.left + 54, rowY - 24, displayName(card), 326, 18, UI_GOLD), 24).setName('route-reward-build-card-name');
    decisionExcerpt(decisionText(scene, frame.left + 54, rowY, observations.join(' / '), 326, 16, observations.some((row: string) => row.startsWith('!')) ? '#ffd0b3' : DECISION_UI.secondary), 23).setName('route-reward-build-observation');
  });
}


export function renderRouteRewardEffectShowcase(scene: any, pending: any, x: number, y: number, w: number, h: number) {
  scene.add.rectangle(x, y, w, h + 16, DECISION_UI.surface, 1)
    .setStrokeStyle(1, DECISION_UI.border, 0.8).setName('route-reward-effect-showcase');
  const cards = (pending.previewCards ?? []).slice(0, 2);
  if (cards.length) {
    cards.forEach((card: any, index: number) => {
      const cx = cards.length > 1 ? x - 104 + index * 208 : x;
      decisionText(scene, cx, y - 110, card.runtime.kind === 'snag' ? 'SNAG CARD' : 'CARD', 182, 16, DECISION_UI.secondary).setOrigin(0.5, 0);
      scene.renderRouteRewardCardOption(card, cx, y - 24, 80, 120, card.runtime.kind === 'snag' ? UI_FIELD.danger : UI_FIELD.gold);
      decisionExcerpt(decisionText(scene, cx, y + 55, displayName(card), 182, 20, UI_GOLD).setOrigin(0.5, 0), 52);
    });
    return;
  }
  const tokens = pending.effects.length ? routeEffectTokens(pending.effects) : [];
  const risks = tokens.filter(token => token.color === UI_FIELD.danger);
  const benefits = tokens.filter(token => token.color !== UI_FIELD.danger);
  const visible = tokens.length <= 3 ? tokens : [...benefits.slice(0, Math.max(1, 3 - Math.min(2, risks.length))), ...risks.slice(0, 2)].slice(0, 3);
  decisionText(scene, x, y - 110, pending.effects.length ? 'OUTCOME AT A GLANCE' : 'LEAVE WITHOUT REWARD', w - 40, 16, DECISION_UI.secondary).setOrigin(0.5, 0);
  visible.forEach((token, index) => {
    const cy = y + (index - (visible.length - 1) / 2) * 58;
    scene.add.rectangle(x, cy, 332, 56, DECISION_UI.raised, 0.55).setName('route-reward-effect-token-frame').setData('index', index).setData('count', visible.length);
    const label = token.scrap ? `${token.label} Scrap` : token.cohesion ? `${token.label} Cohesion` : token.icon === 'route-cover-medallion' ? `${token.label} Cover` : token.label;
    decisionExcerpt(decisionText(scene, x - 148, cy - 13, label, 296, 22, token.textColor), 30).setName('route-reward-effect-token-label');
  });
  if (!visible.length) decisionExcerpt(decisionText(scene, x, y - 35, pending.effects.length ? pending.effectText : 'Your resources stay unchanged.', w - 64, 22).setOrigin(0.5, 0), 114);
  if (tokens.length > visible.length) decisionText(scene, x, y + 102, 'Full consequences in Inspect outcome', w - 28, 16, DECISION_UI.secondary).setOrigin(0.5, 0);
}

function cardPickerEntries(scene: any) {
  return scene.cardPickerMode ? scene.pickerEligibleCards(scene.cardPickerMode) : [];
}

export function requestCardPick(scene: any, index: number, playConfirm: () => void) {
  const mode = scene.cardPickerMode;
  if (!mode || scene.cardPickerInspectionOpen) return;
  const entries = cardPickerEntries(scene);
  const focusIndex = entries.findIndex((entry: any) => entry.index === index);
  const entry = entries[focusIndex];
  if (!entry || (scene.cardPickerContext === 'market' && scene.runState.scrap < entry.cost)) return;
  scene.cardPickerFocusIndex = focusIndex;
  if (scene.cardPickerArmedIndex !== index) {
    scene.cardPickerArmedIndex = index;
    scene.hideHoverCardDetail();
    playConfirm();
    scene.renderAll();
    return;
  }
  scene.cardPickerArmedIndex = undefined;
  playConfirm();
  scene.applyCardPick(index);
}

function compactCardPickerDeltaPart(text: string, max = 16) {
  const value = text.replace(/\s+/g, ' ').replace(/[.]$/, '').trim();
  return value.length <= max ? value : `${value.slice(0, max - 3).trimEnd()}...`;
}

export function renderCardPickerConfirmationRail(
  scene: any,
  frame: { left: number; bottom: number },
  view: { mode: 'preen' | 'release'; name: string; cost: number; delta: string; isMarketPicker: boolean },
) {
  const railX = frame.left + 720;
  const railY = frame.bottom - 37;
  scene.add.rectangle(railX, railY, 560, 58, 0x06111a, 0.97)
    .setStrokeStyle(1, UI_FIELD.gold, 0.88)
    .setName('card-picker-confirmation-rail');
  const title = `${view.mode === 'preen' ? 'PREEN' : 'RELEASE'}  ${view.name}`;
  const summary = `${view.isMarketPicker ? `${view.cost} SCRAP  •  ` : ''}${view.delta.replace(/\s*\n\s*/g, ' ')}`;
  decisionExcerpt(decisionText(scene, railX - 258, railY - 24, title, 370, 18, UI_GOLD), 25)
    .setData('fullText', title).setName('card-picker-confirmation-title');
  decisionExcerpt(decisionText(scene, railX - 258, railY + 2, summary, 370, 16, '#c7d4df'), 23)
    .setData('fullText', summary).setName('card-picker-confirmation-summary');
  const armedIndex = scene.cardPickerArmedIndex;
  const context = scene.cardPickerContext;
  const confirm = scene.add.rectangle(railX + 205, railY, 126, MIN_SUPPORTED_TOUCH_TARGET, 0x102534, 0.98)
    .setStrokeStyle(1, UI_FIELD.gold, 0.76)
    .setInteractive({ useHandCursor: true })
    .setName('card-picker-confirmation-command-frame');
  confirm.on('pointerover', () => confirm.setFillStyle(0x173a50, 1));
  confirm.on('pointerout', () => confirm.setFillStyle(0x102534, 0.98));
  confirm.on('pointerdown', () => {
    if (!confirm.active || armedIndex === undefined || scene.cardPickerArmedIndex !== armedIndex
      || scene.cardPickerMode !== view.mode || scene.cardPickerContext !== context
      || scene.cardPickerInspectionOpen || scene.pauseOverlayOpen || scene.settingsOverlayOpen) return;
    scene.requestCardPick(armedIndex);
  });
  scene.add.text(railX + 205, railY, 'CONFIRM', {
    fontFamily: UI_FONT,
    fontSize: '18px',
    fontStyle: UI_BOLD,
    color: '#dffbff',
  }).setResolution(2).setOrigin(0.5).setName('card-picker-confirmation-command');
}

function compactCardPickerDeltaPair(before: string, after: string): [string, string] {
  if (!before) return ['NEW EFFECT', compactCardPickerDeltaPart(after)];
  if (!after) return [compactCardPickerDeltaPart(before), 'REMOVED'];
  const beforeWords = before.split(/\s+/);
  const afterWords = after.split(/\s+/);
  let prefix = 0;
  while (prefix < beforeWords.length && prefix < afterWords.length && beforeWords[prefix] === afterWords[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < beforeWords.length - prefix
    && suffix < afterWords.length - prefix
    && beforeWords[beforeWords.length - 1 - suffix] === afterWords[afterWords.length - 1 - suffix]
  ) suffix += 1;
  const beforeChanged = beforeWords.slice(prefix, beforeWords.length - suffix);
  const afterChanged = afterWords.slice(prefix, afterWords.length - suffix);
  if (beforeChanged.length > 0 && afterChanged.length > 0) {
    const context = prefix > 0 ? beforeWords[prefix - 1].replace(/[,:]$/, '') : '';
    const tail = suffix > 0 ? beforeWords[beforeWords.length - suffix].replace(/[.,:]$/, '') : '';
    return [
      compactCardPickerDeltaPart([context, ...beforeChanged, tail].filter(Boolean).join(' ')),
      compactCardPickerDeltaPart([context, ...afterChanged, tail].filter(Boolean).join(' ')),
    ];
  }
  return [compactCardPickerDeltaPart(before), compactCardPickerDeltaPart(after)];
}

export function cardPickerDecisionDelta(
  deckLength: number,
  mode: string,
  card: any,
  statEntries: (card: any) => Array<{ key: string; value: number }>,
  statLabel: (key: string) => string,
) {
  if (mode === 'release') return `DECK ${deckLength} > ${Math.max(0, deckLength - 1)}`;
  const split = (text: string) => text.split(/[.;]\s+/).map((part) => part.replace(/[.;]$/, '').trim()).filter(Boolean);
  const align = (before: string[], after: string[]) => Array.from(
    { length: Math.max(before.length, after.length) },
    (_, index) => [before[index] ?? '', after[index] ?? ''] as [string, string]
  );
  const pairs = [
    ...align(split(card.text), split(card.upgradedText)),
    ...align(split(card.moltText), split(card.moltTextUpgraded)),
  ];
  const changed = pairs.find(([before, after]) => after && before !== after);
  if (changed) {
    const [before, after] = compactCardPickerDeltaPair(changed[0], changed[1]);
    return `${before}\n> ${after}`;
  }
  const totals = (upgraded: boolean) => statEntries({ ...card, upgraded }).reduce<Record<string, number>>((result, entry) => {
    result[entry.key] = (result[entry.key] ?? 0) + entry.value;
    return result;
  }, {});
  const beforeStats = totals(false);
  const afterStats = totals(true);
  const statKey = Object.keys(afterStats).find((key) => (afterStats[key] ?? 0) !== (beforeStats[key] ?? 0));
  return statKey
    ? `${statLabel(statKey)} ${beforeStats[statKey] ?? 0}\n> ${afterStats[statKey] ?? 0}`
    : 'ABILITY\n> IMPROVED';
}

function marketInputTargets(scene: any) {
  return scene.children.list.filter((child: any) => (
    child.input?.enabled
    && typeof child.getData?.('marketFocusId') === 'string'
  ));
}

export function marketWaymarkBuildObservations(scene: any, mark: any) {
  const deck = scene.allMapDeckCards().map(({ card }: any) => card);
  const familyCount = scene.runState.routeMarks.filter((id: string) => scene.marketWaymark(id)?.family === mark.family).length;
  return waymarkBuildRead(
    { trigger: mark.trigger, familyLabel: routeMarkFamilyLabel(mark.family) },
    deck,
    scene.runState.supplies.length,
    familyCount,
  ).notes;
}

export function marketUtilityBuildObservations(scene: any, listing: any) {
  const supply = scene.marketSupply(listing.supplyId);
  if (supply) {
    const observations: string[] = [];
    const supplyMarks = scene.runState.routeMarks.filter((id: string) => scene.marketWaymark(id)?.trigger === 'onSupplyUsed').length;
    if (supplyMarks > 0) observations.push(`+ Triggers ${supplyMarks} carried Supply Waymark${supplyMarks === 1 ? '' : 's'}`);
    const effects = supply.effects.join(' ');
    const healing = effects.match(/healCohesion\((\d+)\)/);
    if (healing) {
      const missing = Math.max(0, scene.runMaxHp() - scene.runState.currentHp);
      observations.push(missing > 0
        ? `+ Restores up to ${Math.min(missing, Number(healing[1]))} missing Cohesion`
        : '! Healing value is low at full Cohesion');
    } else if (/removeCover|damagePierce/.test(effects)) {
      observations.push('+ Adds a one-use anti-Cover answer');
    } else if (supply.timing === 'route') {
      observations.push('+ Adds a route-time planning option');
    } else if (/retainHand|draw\(|gainWingbeat/.test(effects)) {
      observations.push('+ Supports card setup and sequencing');
    } else if (/gainCover|gainOpenSkyGuard|reduceNextOpenSky/.test(effects)) {
      observations.push('+ Adds emergency formation safety');
    } else {
      observations.push('+ Adds a one-use tactical answer');
    }
    return observations.slice(0, 2);
  }
  if (listing.id === 'preen') {
    const count = scene.pickerEligibleCards('preen', 'market').length;
    return [`+ ${count} card${count === 1 ? '' : 's'} offer meaningful upgrades`, '+ Exact change shown before purchase'];
  }
  if (listing.id === 'release') {
    return [`+ Can trim the ${scene.runState.deck.length}-card deck`, '+ Exact card and final cost chosen next'];
  }
  if (listing.id === 'boss_guard') {
    return ['+ Adds boss-burst protection', '+ Stacks with existing next-fight prep'];
  }
  return ['+ Reduces next-fight Open Sky risk', '+ Makes the next route step safer'];
}

export function marketFocusBuildObservations(scene: any) {
  const [kind, rawIndex] = String(scene.marketFocusId ?? '').split(':');
  const index = Number(rawIndex);
  if (kind === 'card') {
    const offer = scene.marketCardOffers()[index];
    return offer && !offer.sold ? scene.routeRewardCardObservations(offer.card).slice(0, 2) : [];
  }
  if (kind === 'waymark') {
    const listing = scene.marketWaymarkShelf[index];
    const mark = listing && !listing.sold ? scene.marketWaymark(listing.id) : undefined;
    return mark ? marketWaymarkBuildObservations(scene, mark) : [];
  }
  if (kind === 'utility') {
    const listing = scene.marketUtilityShelf[index];
    return listing && !listing.sold ? marketUtilityBuildObservations(scene, listing) : [];
  }
  return kind === 'refresh'
    ? ['+ Rerolls every unbought offer', `! Costs rise after refresh ${scene.marketRefreshCount + 1}`]
    : [];
}

export function marketPreview(scene: any, listing: any, preview?: string[]) {
  if (scene.runState.scrap < listing.price) {
    return [`NEED ${listing.price - scene.runState.scrap} MORE SCRAP`];
  }
  if (preview) return preview;
  if (scene.marketUtilityEnabled(listing)) return scene.marketUtilityDecisionPreview(listing);
  return [listing.supplyId ? 'SUPPLY POUCH FULL' : 'NO ELIGIBLE CARD'];
}

export function marketUnavailableOffers(scene: any) {
  if (scene.marketCategory === 'cards') {
    return scene.marketCardOffers()
      .filter((offer: any) => offer.sold || scene.runState.scrap < offer.price)
      .map((offer: any) => ({
        label: displayName(offer.card),
        reason: offer.sold ? 'SOLD OUT' : marketPreview(scene, offer)[0],
      }));
  }
  if (scene.marketCategory === 'waymarks') {
    return scene.marketRouteMarkOffers()
      .filter((offer: any) => offer.sold || scene.runState.scrap < offer.price)
      .map((offer: any) => ({
        label: offer.name,
        reason: offer.sold ? 'SOLD OUT' : marketPreview(scene, offer)[0],
      }));
  }
  const offers = scene.marketUtilityShelf
    .filter((offer: any) => scene.marketCategory === 'supplies' ? offer.id === 'supply' : offer.id !== 'supply')
    .filter((offer: any) => offer.sold || !scene.marketUtilityEnabled(offer))
    .map((offer: any) => ({
      label: scene.marketUtilityLabel(offer),
      reason: offer.sold ? 'SOLD OUT' : marketPreview(scene, offer)[0],
    }));
  if (scene.marketCategory === 'services' && scene.runState.scrap < scene.marketRefreshCost()) {
    offers.push({
      label: 'Refresh stock',
      reason: `NEED ${scene.marketRefreshCost() - scene.runState.scrap} MORE SCRAP`,
    });
  }
  return offers;
}

function activateMarketTarget(scene: any, target: any) {
  if (!scene.marketOpen || scene.pauseOverlayOpen || scene.settingsOverlayOpen || scene.cardPickerMode) return false;
  if (target?.getData('marketAvailable') === false) {
    target.emit('pointerover');
    scene.updateTextState();
    return true;
  }
  const [kind, rawIndex] = String(target?.getData('marketFocusId') ?? '').split(':');
  const index = Number(rawIndex);
  if (kind === 'card') scene.buyMarketCard(index);
  else if (kind === 'waymark') scene.buyMarketRouteMark(index);
  else if (kind === 'utility') scene.buyMarketUtility(index);
  else if (kind === 'refresh') scene.refreshMarket();
  else return false;
  return true;
}

export function resetMarketFocus(scene: any) {
  scene.marketFocusId = undefined;
  scene.marketFocusArmedId = undefined;
  scene.marketBuildObservations = [];
}

export function bindMarketInputs(scene: any) {
  const targets = marketInputTargets(scene);
  if (!targets.some((target: any) => target.getData('marketFocusId') === scene.marketFocusId)) {
    scene.marketFocusId = targets[0]?.getData('marketFocusId');
    scene.marketFocusArmedId = undefined;
  }
  scene.marketBuildObservations = marketFocusBuildObservations(scene);
  targets.forEach((target: any) => {
    const id = target.getData('marketFocusId');
    const previews = target.listeners('pointerover');
    target.removeAllListeners('pointerover');
    // Rendering the selected reader is not input: keep its page behind Pause.
    // Actual pointer and keyboard/controller actions are guarded separately.
    target.on('marketInspect', () => previews.forEach((preview: () => void) => preview.call(target)));
    target.on('pointerover', () => {
      if (scene.pauseOverlayOpen || scene.settingsOverlayOpen || scene.cardPickerMode) return;
      if (scene.marketFocusArmedId && scene.marketFocusId !== id) return;
      previews.forEach((preview: () => void) => preview.call(target));
      if (scene.marketFocusId === id) return;
      scene.marketFocusId = id;
      scene.marketBuildObservations = marketFocusBuildObservations(scene);
      scene.children.list.find((child: any) => child.name === 'market-input-focus-ring')
        ?.setPosition(target.x, target.y)
        .setDisplaySize(target.displayWidth + 8, target.displayHeight + 8)
        .setStrokeStyle(3, 0x8df4ff, 1);
      scene.updateTextState();
      scene.children.list.find((child: any) => child.name === 'market-input-help-text')?.emit('refreshHint');
    });
    target.on('pointerdown', (
      _pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event?: Phaser.Types.Input.EventData,
    ) => {
      event?.stopPropagation();
      if (scene.pauseOverlayOpen || scene.settingsOverlayOpen || scene.cardPickerMode) return;
      if (target.getData('marketAvailable') === false) {
        scene.marketFocusId = id;
        scene.marketFocusArmedId = undefined;
        scene.renderAll();
        marketInputTargets(scene).find((candidate: any) => candidate.getData('marketFocusId') === id)?.emit('pointerover');
        return;
      }
      if (scene.marketFocusArmedId === id) {
        resetMarketFocus(scene);
        activateMarketTarget(scene, target);
        return;
      }
      scene.marketFocusId = id;
      scene.marketFocusArmedId = id;
      scene.renderAll();
    });
    if (scene.marketFocusId === id) {
      scene.add.rectangle(target.x, target.y, target.displayWidth + 8, target.displayHeight + 8, 0x000000, 0)
        .setStrokeStyle(3, scene.marketFocusArmedId === id ? 0xffcf70 : 0x8df4ff, 1)
        .setName('market-input-focus-ring');
    }
  });
  targets.find((target: any) => target.getData('marketFocusId') === scene.marketFocusId)?.emit('marketInspect');
}

export function cycleMarketFocus(scene: any, direction: -1 | 1) {
  if (!scene.marketOpen || scene.pauseOverlayOpen || scene.settingsOverlayOpen || scene.cardPickerMode) return false;
  const targets = marketInputTargets(scene);
  if (targets.length === 0) return false;
  const current = targets.findIndex((target: any) => target.getData('marketFocusId') === scene.marketFocusId);
  const next = current < 0 ? 0 : (current + direction + targets.length) % targets.length;
  scene.marketFocusId = targets[next].getData('marketFocusId');
  scene.marketFocusArmedId = undefined;
  scene.renderAll();
  marketInputTargets(scene).find((target: any) => target.getData('marketFocusId') === scene.marketFocusId)?.emit('pointerover');
  return true;
}

export function activateMarketFocus(scene: any) {
  if (!scene.marketOpen || scene.pauseOverlayOpen || scene.settingsOverlayOpen || scene.cardPickerMode) return false;
  const target = marketInputTargets(scene)
    .find((candidate: any) => candidate.getData('marketFocusId') === scene.marketFocusId);
  if (!target) return false;
  if (target.getData('marketAvailable') === false) return activateMarketTarget(scene, target);
  resetMarketFocus(scene);
  return activateMarketTarget(scene, target);
}

export function cycleMarketCategory(scene: any, direction: -1 | 1) {
  if (!scene.marketOpen || scene.pauseOverlayOpen || scene.settingsOverlayOpen || scene.cardPickerMode) return;
  const categories = ['cards', 'waymarks', 'supplies', 'services'];
  const current = Math.max(0, categories.indexOf(scene.marketCategory));
  scene.setMarketCategory(categories[(current + direction + categories.length) % categories.length]);
}

export function renderMarketInputHelp(scene: Phaser.Scene, x: number, y: number) {
  const owner = scene as any;
  const armed = !!owner.marketFocusArmedId;
  scene.add.rectangle(x, y, 880, 56, 0x020409, 0.96)
    .setStrokeStyle(1, armed ? 0xffcf70 : 0x49606d, armed ? 0.9 : 0.5)
    .setDepth(23050)
    .setName('market-input-help');
  const hint = scene.add.text(x, y, '', {
      fontFamily: UI_FONT,
      fontSize: '16px',
      resolution: 2,
      color: armed ? '#ffe1a3' : '#dffbff',
      align: 'center',
      fixedWidth: 856, lineSpacing: 4,
    }).setOrigin(0.5).setDepth(23051).setName('market-input-help-text');
  const format = (mode: 'pointer' | 'keyboard' | 'controller') => {
    const target = marketInputTargets(owner).find((candidate: any) => candidate.getData('marketFocusId') === owner.marketFocusId);
    const unavailable = target?.getData('marketAvailable') === false;
    if (mode === 'pointer') return unavailable
      ? 'This offer is unavailable · Read its requirements in the details\nChoose a section above to browse more offers'
      : armed ? 'Click the selected offer again to buy\nClear cancels the selection'
        : 'Click an offer to select · Click it again to buy\nBrowse the sections above · Details never spend Scrap';
    const pad = mode === 'controller';
    const move = pad ? 'D-pad' : `${controlBindingLabel('previous')}/${controlBindingLabel('next')}`;
    const confirm = pad ? 'A' : controlBindingLabel('confirm');
    const inspect = pad ? 'Y' : controlBindingLabel('roost');
    const back = pad ? 'B' : controlBindingLabel('back');
    return `${move}: offer · ${confirm}: ${unavailable ? 'requirements' : 'buy'} · ${inspect}: rules\n${pad ? 'LB/RB' : '1–4'}: section · ${back}: ${armed ? 'clear selection' : 'close Market'}`;
  };
  bindChoiceHint(scene, hint, format);
  hint.on('refreshHint', () => hint.setText(format(hint.getData('inputMode'))));
}

export function renderMarketCategoryTabs(
  scene: any,
  top: number,
  touchTarget: number,
  accents: number[],
) {
  const tabs = [
    ['cards', 'Crew Cards'],
    ['waymarks', 'Waymarks'],
    ['supplies', 'Supplies'],
    ['services', 'Services'],
  ];
  tabs.forEach(([id, label], index) => {
    const x = 450 + index * 156;
    const selected = scene.marketCategory === id;
    const accent = accents[index];
    const visual = scene.add.rectangle(x, top + 86, 140, 34, selected ? 0x152637 : 0x07101a, 0.94)
      .setStrokeStyle(1, selected ? accent : 0x49606d, selected ? 0.94 : 0.42)
      .setName('market-category-tab');
    scene.add.text(x, top + 86, label, {
      fontFamily: 'Arial',
      fontSize: '18px',
      resolution: 2,
      fontStyle: 'bold',
      color: selected ? '#fff0c7' : '#b7cbd9',
    }).setOrigin(0.5).setName('market-category-tab');
    const hit = scene.add.rectangle(x, top + 86, 140, touchTarget, 0x020409, 0.001)
      .setInteractive({ useHandCursor: true })
      .setName('market-category-tab-hit')
      .setData('label', label);
    hit.on('pointerover', () => visual.setFillStyle(selected ? 0x1d3349 : 0x10202c, 0.98));
    hit.on('pointerout', () => visual.setFillStyle(selected ? 0x152637 : 0x07101a, 0.94));
    hit.on('pointerdown', () => scene.setMarketCategory(id));
  });
}

export function renderMarketSectionHeader(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  title: string,
  subtitle: string,
  accent: number,
  frameKey: string,
) {
  const hasFrame = scene.textures.exists(frameKey);
  const focusedSection = (scene as any).marketCategory !== 'catalog';
  if (hasFrame) {
    scene.textures.get(frameKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    scene.add.image(x, y + 20, frameKey)
      .setDisplaySize(width + 42, 60)
      .setAlpha(0.88)
      .setName('market-section-header-frame');
    scene.add.rectangle(x, y + 20, Math.max(96, width - 52), 31, 0x020409, 0.18);
  } else {
    scene.add.rectangle(x, y, width, 1, accent, 0.72);
  }
  scene.add.rectangle(x - width / 2 + 18, y + 20, 4, 28, accent, hasFrame ? 0.86 : 0.78);
  // Authored end-caps occupy more than the texture's geometric border.
  // Keep readable copy inside the quiet center, not over the gold/teal caps.
  scene.add.text(x - width / 2 + (focusedSection ? 80 : 30), y + (focusedSection ? 9 : 8), title.toUpperCase(), {
    fontFamily: 'Arial',
    fontSize: focusedSection ? '18px' : '10px',
    fontStyle: 'bold',
    color: '#ffe1a3',
  }).setResolution(2).setName('market-section-heading');
  scene.add.text(focusedSection ? x + width / 2 - 80 : x - width / 2 + 30, y + (focusedSection ? 11 : 23), subtitle, {
    fontFamily: 'Arial',
    fontSize: focusedSection ? '16px' : '9px',
    fontStyle: 'bold',
    color: '#b5c8d8',
  }).setOrigin(focusedSection ? 1 : 0, 0).setResolution(2).setName('market-section-description');
}

export function focusedCardPickerEntry(scene: any) {
  const entries = cardPickerEntries(scene);
  if (entries.length === 0) return undefined;
  scene.cardPickerFocusIndex = Phaser.Math.Clamp(
    Math.round(scene.cardPickerFocusIndex ?? 0),
    0,
    entries.length - 1,
  );
  return entries[scene.cardPickerFocusIndex];
}

export function cycleCardPickerFocus(scene: any, delta: number) {
  const entries = cardPickerEntries(scene);
  if (scene.cardPickerInspectionOpen || entries.length === 0) return false;
  scene.cardPickerFocusIndex = (
    (scene.cardPickerFocusIndex ?? 0) + delta + entries.length
  ) % entries.length;
  const columns = 5;
  const visibleCount = 10;
  const firstVisible = scene.cardPickerScroll * columns;
  if (scene.cardPickerFocusIndex < firstVisible) {
    scene.cardPickerScroll = Math.floor(scene.cardPickerFocusIndex / columns);
  } else if (scene.cardPickerFocusIndex >= firstVisible + visibleCount) {
    scene.cardPickerScroll = Math.max(0, Math.floor(scene.cardPickerFocusIndex / columns) - 1);
  }
  scene.cardPickerArmedIndex = entries[scene.cardPickerFocusIndex]?.index;
  scene.renderAll();
  return true;
}

export function openCardPickerInspection(scene: any, focusIndex = scene.cardPickerFocusIndex) {
  const entries = cardPickerEntries(scene);
  if (entries.length === 0) return undefined;
  scene.cardPickerFocusIndex = Phaser.Math.Clamp(Math.round(focusIndex ?? 0), 0, entries.length - 1);
  scene.cardPickerInspectionOpen = true;
  inspectionReading.delete(scene);
  scene.hideHoverCardDetail();
  scene.renderAll();
  return entries[scene.cardPickerFocusIndex];
}

export function closeCardPickerInspection(scene: any) {
  if (!scene.cardPickerInspectionOpen) return false;
  scene.cardPickerInspectionOpen = false;
  inspectionReading.delete(scene);
  scene.hideHoverCardDetail();
  scene.renderAll();
  return true;
}

export function renderCardPickerInput(
  scene: Phaser.Scene,
  selection: Phaser.GameObjects.Rectangle,
  entry: any,
  x: number,
  y: number,
  cardWidth: number,
  cardHeight: number,
  accent: number,
  focusIndex: number,
) {
  const owner = scene as any;
  const focused = (owner.cardPickerFocusIndex ?? 0) === focusIndex;
  const armed = owner.cardPickerArmedIndex === entry.index;
  const showFocus = () => {
    scene.children.getByName('card-picker-input-focus-ring')?.destroy();
    const bounds = selection.getBounds();
    scene.add.rectangle(bounds.centerX, bounds.centerY, bounds.width, bounds.height, 0x000000, 0)
      .setStrokeStyle(2, armed ? 0xffcf70 : 0x8df4ff, 1)
      .setName('card-picker-input-focus-ring');
  };
  selection.on('pointerover', () => {
    owner.cardPickerFocusIndex = focusIndex;
    owner.hideHoverCardDetail();
    showFocus();
    owner.updateTextState();
  });
  if (focused) showFocus();
  if (focusIndex === owner.cardPickerScroll * 5) {
    renderCardPickerInspectControl(scene, 440, 610, 200, accent);
  }
}

export function renderCardPickerInspectControl(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  accent: number,
) {
  const owner = scene as any;
  const inspect = scene.add.rectangle(x, y, width, 64, 0x102534, 0.98)
    .setStrokeStyle(2, accent, 0.9)
    .setInteractive({ useHandCursor: true })
    .setName('card-picker-card-inspect-hit');
  inspect.setData('label', 'Inspect focused card');
  inspect.on('pointerover', () => inspect.setFillStyle(0x173a50, 1).setStrokeStyle(2, 0x8df4ff, 1));
  inspect.on('pointerout', () => inspect.setFillStyle(0x102534, 0.98).setStrokeStyle(2, accent, 0.9));
  inspect.on('pointerdown', (
    _pointer: Phaser.Input.Pointer,
    _localX: number,
    _localY: number,
    event?: Phaser.Types.Input.EventData,
  ) => {
    event?.stopPropagation();
    openCardPickerInspection(owner, owner.cardPickerFocusIndex);
  });
  scene.add.text(x, y - 9, 'INSPECT FOCUSED', {
    fontFamily: 'Arial',
    fontSize: '18px',
    fontStyle: 'bold',
    color: '#dffbff',
  }).setResolution(2).setOrigin(0.5).setName('card-picker-card-inspect-label');
  bindChoiceHint(scene, scene.add.text(x, y + 12, '', {
    fontFamily: 'Arial',
    fontSize: '16px',
    fontStyle: 'bold',
    color: '#91b9c8',
  }).setResolution(2).setOrigin(0.5).setName('card-picker-card-inspect-binding'), inspectInputHint);
}

export function renderCardPickerInspection(
  scene: any,
  width: number,
  height: number,
  backLabel: string,
) {
  const hint = scene.children.getByName('card-picker-input-hint');
  if (hint) bindChoiceHint(scene, hint, mode => choiceInputHint(mode, scene.cardPickerArmedIndex !== undefined));
  if (!scene.cardPickerInspectionOpen) return;
  const entry = focusedCardPickerEntry(scene);
  if (!entry) {
    scene.cardPickerInspectionOpen = false;
    return;
  }
  const scrim = scene.add.rectangle(
    width / 2,
    height / 2,
    width,
    height,
    0x020409,
    0.88,
  )
    .setDepth(23010)
    .setInteractive({ useHandCursor: true })
    .setName('card-picker-inspection-scrim');
  scrim.on('pointerdown', () => closeCardPickerInspection(scene));
  scene.add.text(74, 38, `FULL CARD INSPECTION · ${scene.cardPickerMode === 'preen' ? 'PREEN' : 'RELEASE'}`, {
    fontFamily: 'Arial',
    fontSize: '13px',
    fontStyle: 'bold',
    color: '#ffe08a',
    letterSpacing: 1.2,
  }).setOrigin(0, 0.5).setDepth(23012).setName('card-picker-inspection-title');
  scene.add.text(
    width / 2,
    height - 34,
    `${backLabel} / B / CONFIRM / A / TAP OUTSIDE  RETURN WITHOUT APPLYING`,
    {
      fontFamily: 'Arial',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#dffbff',
    },
  ).setOrigin(0.5).setDepth(23012).setName('card-picker-inspection-return');
  scene.showHoverCardDetail(
    entry.card,
    scene.cardPickerMode === 'preen' ? 'Preen candidate' : 'Release candidate',
    entry.card.cost,
    width / 2,
    height / 2,
  );
  const impact = cardPickerDeckImpact(scene, entry.index);
  if (impact) {
    const panel = scene.add.container(650, 120).setDepth(23012).setName('card-picker-deck-impact');
    panel.add(scene.add.rectangle(0, 0, 430, 480, 0x071522, 0.99).setOrigin(0)
      .setStrokeStyle(1, UI_FIELD.cyan, 0.7).setInteractive());
    let y = 20;
    impact.lines.forEach((line: string, index: number) => {
      const label = scene.add.text(20, y, line, {
        fontFamily: UI_FONT, fontSize: `${[14, 20, 18, 16, 16, 16, 14, 13][index]}px`,
        color: index === 0 ? UI_CYAN : index < 3 ? UI_GOLD : '#e6eef5',
        wordWrap: { width: 390 }, lineSpacing: 3,
      }).setName('card-picker-impact-line');
      panel.add(label);
      y += label.height + 14;
    });
  }
}

export function focusedRouteRewardCard(scene: any) {
  if (scene.routeCardRewardChoices.length === 0) return undefined;
  scene.routeRewardChoiceIndex = Phaser.Math.Clamp(
    Math.round(scene.routeRewardChoiceIndex),
    0,
    scene.routeCardRewardChoices.length - 1,
  );
  return scene.routeCardRewardChoices[scene.routeRewardChoiceIndex];
}

export function cycleRouteRewardChoice(scene: any, direction: -1 | 1) {
  if (scene.routeRewardInspectionCardId || scene.routeCardRewardChoices.length === 0) return false;
  scene.routeRewardChoiceIndex = (
    scene.routeRewardChoiceIndex + direction + scene.routeCardRewardChoices.length
  ) % scene.routeCardRewardChoices.length;
  scene.routeRewardArmedCardId = scene.routeCardRewardChoices[scene.routeRewardChoiceIndex]?.id;
  scene.renderAll();
  return true;
}

export function setRouteRewardChoice(scene: any, cardId: string) {
  const index = scene.routeCardRewardChoices.findIndex((card: any) => card.id === cardId);
  if (index >= 0 && !scene.routeRewardArmedCardId) scene.routeRewardChoiceIndex = index;
}

export function requestRouteRewardCard(scene: any, cardId: string, onArm: () => void) {
  const index = scene.routeCardRewardChoices.findIndex((card: any) => card.id === cardId);
  if (index < 0) return;
  scene.routeRewardChoiceIndex = index;
  if (scene.routeRewardArmedCardId !== cardId) {
    scene.routeRewardArmedCardId = cardId;
    scene.hideHoverCardDetail();
    onArm();
    scene.renderAll();
    return;
  }
  scene.routeRewardArmedCardId = undefined;
  scene.chooseRouteRewardCard(cardId);
}

export function openRouteRewardInspection(scene: any, cardId: string) {
  const index = scene.routeCardRewardChoices.findIndex((card: any) => card.id === cardId);
  if (index < 0) return undefined;
  const armedReturnIndex = scene.routeRewardArmedCardId
    ? scene.routeCardRewardChoices.findIndex((card: any) => card.id === scene.routeRewardArmedCardId)
    : -1;
  scene.routeRewardChoiceIndex = armedReturnIndex >= 0 ? armedReturnIndex : index;
  scene.routeRewardInspectionCardId = cardId;
  inspectionReading.delete(scene);
  scene.renderAll();
  return scene.routeCardRewardChoices[index];
}

export function closeRouteRewardInspection(scene: any) {
  if (!scene.routeRewardInspectionCardId) return false;
  scene.routeRewardInspectionCardId = undefined;
  inspectionReading.delete(scene);
  scene.hideHoverCardDetail();
  scene.renderAll();
  return true;
}

function activeCombatRewards(scene: any): any[] {
  if (scene.mode === 'waymarkReward') return scene.waymarkChoices;
  if (scene.mode === 'cardReward') return scene.rewardChoices;
  if (scene.mode === 'upgradeReward') return scene.upgradeChoices;
  return [];
}

export function armCombatRewardAt(scene: any, index: number) {
  const reward = activeCombatRewards(scene)[index];
  if (reward) scene.rewardChoiceArmedId = reward.id;
}

export function requestCombatReward(scene: any, choiceId: string, onArm: () => void) {
  const choices = activeCombatRewards(scene);
  const index = choices.findIndex((choice: any) => choice.id === choiceId);
  if (index < 0) return false;
  scene.rewardSkipArmed = false;
  scene.battleInputActive = true;
  scene.controllerChoiceIndex = index;
  if (scene.rewardChoiceArmedId !== choiceId) {
    scene.rewardChoiceArmedId = choiceId;
    scene.hideCardPreview();
    onArm();
    scene.requestBattleRender();
    return true;
  }
  scene.rewardChoiceArmedId = undefined;
  if (scene.mode === 'waymarkReward') scene.chooseWaymarkReward(choiceId);
  else if (scene.mode === 'cardReward') scene.chooseRewardCard(choiceId);
  else scene.chooseUpgradeCard(choiceId);
  return true;
}

export function requestCombatRewardAt(scene: any, index: number, onArm: () => void) {
  const reward = activeCombatRewards(scene)[index];
  return reward ? requestCombatReward(scene, reward.id, onArm) : false;
}

export function renderCombatRewardLoading(scene: any) {
  const target = scene.root as Phaser.GameObjects.Container;
  const waymark = scene.mode === 'waymarkReward';
  const cardReward = scene.mode === 'cardReward';
  const title = cardReward ? 'Add to the Flock' : scene.mode === 'upgradeReward' ? 'Preen a Card' : 'Claim a Waymark';
  const choiceY = waymark ? 440 : 396;
  const choiceWidth = waymark ? 284 : 264;
  const choiceHeight = waymark ? 392 : 300;
  target.add(scene.add.rectangle(640, 360, 1280, 720, 0x020409, 0.9).setName('reward-loading-backdrop'));
  target.add(scene.add.rectangle(640, 98, 612, 114, 0x07101c, 0.82)
    .setStrokeStyle(2, 0xd8a840, 0.46)
    .setName('reward-loading-header'));
  target.add(scene.add.text(640, 64, 'ROOFTOP LANDMARK', {
    fontFamily: UI_FONT, fontSize: '12px', fontStyle: UI_BOLD, color: UI_CYAN
  }).setOrigin(0.5));
  target.add(scene.add.text(640, 91, title, {
    fontFamily: UI_FONT, fontSize: '34px', fontStyle: UI_BOLD, color: UI_GOLD,
    align: 'center', fixedWidth: 1060, fixedHeight: 52, maxLines: 1
  }).setOrigin(0.5).setName('reward-loading-title'));
  target.add(scene.add.text(640, 128, 'Preparing choices · Input unlocks when every option is visible.', {
    fontFamily: UI_FONT, fontSize: '15px', color: UI_SOFT,
    align: 'center', fixedWidth: 1020, fixedHeight: 28, maxLines: 1
  }).setOrigin(0.5).setName('reward-renderer-loading'));
  [336, 640, 944].forEach((x) => {
    target.add(scene.add.rectangle(x, choiceY, choiceWidth, choiceHeight, 0x07101c, 0.86)
      .setStrokeStyle(2, 0x49606d, 0.66)
      .setName('reward-loading-choice-slot'));
    target.add(scene.add.rectangle(x, choiceY - 82, choiceWidth - 34, 118, 0x10202d, 0.72));
    target.add(scene.add.rectangle(x, choiceY + 22, choiceWidth - 58, 12, 0x263847, 0.72));
    target.add(scene.add.rectangle(x, choiceY + 48, choiceWidth - 86, 8, 0x263847, 0.54));
    target.add(scene.add.rectangle(waymark ? x - 70 : x - 76, waymark ? 595 : 586, waymark ? 116 : 104, MIN_SUPPORTED_TOUCH_TARGET, 0x102534, 0.58)
      .setStrokeStyle(2, 0x49606d, 0.54)
      .setName('reward-loading-inspect-slot'));
    target.add(scene.add.rectangle(waymark ? x + 63 : x + 54, waymark ? 595 : 586, waymark ? 132 : 144, MIN_SUPPORTED_TOUCH_TARGET, 0x19424c, 0.58)
      .setStrokeStyle(1, 0x49606d, 0.54).setName('reward-loading-select-slot'));
  });
  if (cardReward) target.add(scene.add.rectangle(982, 652, 324, MIN_SUPPORTED_TOUCH_TARGET, 0x2a2320, 0.58)
    .setStrokeStyle(2, 0xd8a840, 0.46)
    .setName('reward-loading-skip-slot'));
}

export function renderRewardSkipFallback(scene: any) {
  const target = scene.root as Phaser.GameObjects.Container;
  const scrap = scene.currentSkipScrapReward();
  const deckSize = scene.allDeckCards().length;
  const armed = Boolean(scene.rewardSkipArmed);
  const hit = scene.add.rectangle(982, 652, 324, MIN_SUPPORTED_TOUCH_TARGET, 0x2a2320, 0.96)
    .setStrokeStyle(2, 0xd8a840, 0.9)
    .setInteractive({ useHandCursor: true })
    .setName('reward-skip-hit');
  hit.on('pointerdown', () => scene.requestSkipCardReward());
  target.add(hit);
  if (armed) target.add(scene.add.rectangle(982, 652, 344, 68, 0x000000, 0)
    .setStrokeStyle(3, 0xd8a840, 1)
    .setName('reward-skip-focus-ring'));
  target.add(scene.add.text(982, 640, `Skip  +${scrap} Scrap`, {
    fontFamily: UI_FONT, fontSize: '18px', fontStyle: UI_BOLD, color: UI_GOLD,
  }).setOrigin(0.5).setName('reward-skip-title'));
  target.add(scene.add.text(982, 664, `Deck ${deckSize} unchanged / ${scene.scrap + scrap} Scrap`, {
    fontFamily: UI_FONT, fontSize: '13px', color: UI_SOFT,
  }).setOrigin(0.5).setName('reward-skip-summary'));
}

export function rewardDecisionPreviewLabel(preview: RewardDecisionPreview) {
  if (preview.kind === 'add') return `Deck ${preview.deckBefore} → ${preview.deckBefore + 1} cards`;
  const parts = (text: string) => text.split(/[.;]\s+/).map(part => part.replace(/[.]$/, '').trim());
  for (const [beforeText, afterText, prefix] of [
    [preview.before, preview.after, ''], [preview.moltBefore, preview.moltAfter, 'Molt: '],
  ]) {
    const before = parts(beforeText), after = parts(afterText);
    for (let index = 0; index < Math.max(before.length, after.length); index++) {
      const from = before[index] ?? '', to = after[index] ?? '';
      if (from === to) continue;
      return prefix + (from && to ? `${from} → ${to}` : to ? `Adds: ${to}` : `Removes: ${from}`);
    }
  }
  return preview.statChanges[0] ?? 'Rules unchanged';
}

export function renderWaymarkRewardChoice(context: Pick<RewardCeremonyRenderContext,
  'scene' | 'target' | 'fontFamily' | 'boldFontStyle' | 'goldColor' | 'waymarkBuildCards' | 'waymarkSupplyCount'
  | 'onWaymarkBuildRead' | 'onWaymarkInspect' | 'onWaymarkSelect'>, waymark: RewardWaymarkView, x: number) {
  const { scene, target, fontFamily, boldFontStyle, goldColor } = context;
  const build = waymarkBuildRead(waymark, context.waymarkBuildCards ?? [], context.waymarkSupplyCount ?? 0, waymark.familyCount);
  context.onWaymarkBuildRead(waymark.id, build.notes);
  target.add(scene.add.rectangle(x, 440, 284, 392, 0x091520, 0.98)
    .setStrokeStyle(1, waymark.accent, 0.55).setName('reward-waymark-panel'));
  if (waymark.focused) {
    target.add(scene.add.rectangle(x, 440, 292, 400, 0x000000, 0)
      .setStrokeStyle(2, waymark.armed ? 0xd8a840 : 0x8df4ff, 1)
      .setName('reward-input-focus-ring'));
  }
  if (waymark.artKey && scene.textures.exists(waymark.artKey)) {
    scene.textures.get(waymark.artKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
    target.add(scene.add.image(x - 96, 280, waymark.artKey).setDisplaySize(64, 64));
  } else {
    target.add(scene.add.text(x - 96, 280, waymark.glyph, {
      fontFamily: 'Georgia, serif', fontSize: '32px', fontStyle: boldFontStyle, color: '#fff1c7'
    }).setOrigin(0.5));
  }
  const label = (left: number, y: number, value: string, size: number, width: number, color: string, lines: number, name: string) => {
    const text = boundedRewardText(scene.add.text(left, y, value, {
      fontFamily, fontSize: `${size}px`, color, resolution: 2,
      fontStyle: name === 'reward-waymark-title' ? boldFontStyle : 'normal',
      wordWrap: { width, useAdvancedWrap: true }, lineSpacing: 2,
    }), lines).setName(name).setData('fullText', value).setData('waymarkId', waymark.id);
    target.add(text); return text;
  };
  label(x - 52, 256, waymark.name, 20, 180, goldColor, 3, 'reward-waymark-title');
  label(x - 124, 324, [...new Set([waymark.rarity, waymark.familyLabel].map(value => value.toUpperCase()))].join(' · '), 13, 248, '#9eb6c6', 1, 'reward-waymark-meta');
  label(x - 124, 354, waymark.description, 18, 248, '#e7eef7', 7, 'reward-waymark-effect');
  label(x - 124, 516, build.notes[0].replace(/^[+!]\s*/, ''), 14, 248, '#a9c6d5', 2, 'reward-waymark-build-observation');
  for (const inspect of [true, false]) {
    const cx = x + (inspect ? -70 : 63);
    const button = scene.add.rectangle(cx, 595, inspect ? 116 : 132, 58, inspect ? 0x10202d : 0x19424c, 1)
      .setStrokeStyle(1, waymark.armed && !inspect ? 0xd8a840 : 0x49606d, 0.8)
      .setInteractive({ useHandCursor: true }).setData('waymarkId', waymark.id)
      .setName(inspect ? 'reward-waymark-inspect-hit' : 'reward-waymark-hit');
    button.on('pointerdown', () => inspect ? context.onWaymarkInspect(waymark.id) : context.onWaymarkSelect(waymark.id));
    target.add(button);
    label(cx, 595, inspect ? 'Read' : waymark.armed ? 'Confirm' : 'Select', 17, 110, inspect ? '#dce8f2' : goldColor, 1,
      'reward-waymark-command').setOrigin(0.5);
  }
  return 0;
}

export function renderCombatRewardFallback(scene: any) {
  const waymark = scene.mode === 'waymarkReward';
  const choiceY = 396;
  const choices = waymark ? scene.waymarkChoices : scene.mode === 'cardReward' ? scene.rewardChoices : scene.upgradeChoices;
  const target = scene.root as Phaser.GameObjects.Container;
  target.add(scene.add.rectangle(640, 360, 1280, 720, 0x020409, 0.9));
  target.add(scene.add.text(640, 90, waymark ? 'Claim a Waymark' : scene.mode === 'upgradeReward' ? 'Preen a Card' : 'Add to the Flock', {
    fontFamily: 'Arial', fontSize: '34px', fontStyle: 'bold', color: '#ffe08a'
  }).setOrigin(0.5));
  choices.forEach((choice: any, index: number) => {
    const x = 336 + index * 304;
    if (waymark) {
      renderWaymarkRewardChoice({
        scene, target, fontFamily: UI_FONT, boldFontStyle: UI_BOLD, goldColor: UI_GOLD,
        waymarkBuildCards: scene.allDeckCards(), waymarkSupplyCount: scene.runSupplies.length,
        onWaymarkBuildRead: (id, notes) => { scene.waymarkRewardBuildObservations[id] = notes; },
        onWaymarkInspect: id => scene.openWaymarkRewardDetail(id),
        onWaymarkSelect: id => scene.requestRewardChoice(id),
      }, scene.rewardWaymarkView(choice, index), x);
      return;
    }
    const view = scene.rewardCardView(choice, index);
    const enabled = !(scene.mode === 'cardReward' && scene.rewardSkipArmed);
    const hit = scene.add.rectangle(x, choiceY, 264, 300, 0x07101c, 0.98)
      .setStrokeStyle(2, view.accent, 0.9)
      .setInteractive({ useHandCursor: true })
      .setName('reward-fallback-choice-hit');
    hit.on('pointerdown', () => scene.requestRewardChoice(view.id));
    target.add(hit);
    if (view.focused) target.add(scene.add.rectangle(x, choiceY, 278, 308, 0x000000, 0)
      .setStrokeStyle(3, view.armed ? 0xd8a840 : 0x8df4ff, 1).setName('reward-input-focus-ring'));
    const label = (left: number, y: number, value: string, size: number, width: number, color: string, lines: number, name: string) => {
      const text = boundedRewardText(scene.add.text(left, y, value, {
        fontFamily: UI_FONT, fontSize: `${size}px`, color, resolution: 2,
        fontStyle: name === 'reward-fallback-choice-name' ? UI_BOLD : 'normal',
        wordWrap: { width, useAdvancedWrap: true }, lineSpacing: 2,
      }), lines).setName(name).setData('fullText', value).setData('cardId', view.id);
      target.add(text); return text;
    };
    // Keep identity/art independent of the optional ceremony chunk. Never use a
    // missing texture key: the reader and printed rules still work without art.
    if (view.artKey && scene.textures.exists(view.artKey)) {
      target.add(scene.add.image(x - 78, 314, view.artKey).setDisplaySize(72, 108)
        .setName('reward-fallback-card-art').setData('cardId', view.id));
    } else {
      target.add(scene.add.rectangle(x - 78, 314, 72, 108, 0x10202d, 1));
      label(x - 108, 279, view.bird, 14, 60, UI_SOFT, 4, 'reward-fallback-art-identity');
    }
    label(x - 26, 258, view.name, 20, 142, UI_GOLD, 3, 'reward-fallback-choice-name');
    label(x - 26, 340, `${view.cost} Wingbeat${view.cost === 1 ? '' : 's'}`, 16, 142, '#bfe8f4', 1, 'reward-fallback-card-cost');
    label(x - 116, 382, view.summary, 18, 232, '#e7eef7', 5, 'reward-fallback-effect');
    if (view.focused || view.armed || scene.mode === 'upgradeReward') {
      label(x - 116, 506, rewardDecisionPreviewLabel(view.decisionPreview), 14, 232, '#a9c6d5', 2, 'reward-fallback-decision-context');
    }
    renderRewardInspectButton({
      scene,
      target,
      x: x - 72,
      y: 586,
      width: 112,
      label: 'Read',
      fontSize: 17,
      accent: view.accent,
      fontFamily: 'Arial',
      boldFontStyle: 'bold',
      enabled,
      onInspect: () => scene.openRewardCardInspection(view.id),
    });
    const take = scene.add.rectangle(x + 62, 586, 132, MIN_SUPPORTED_TOUCH_TARGET,
      enabled ? 0x19424c : 0x0a141c, enabled ? 1 : 0.48)
      .setStrokeStyle(1, enabled && view.armed ? 0xd8a840 : 0x49606d, 0.8)
      .setName('reward-card-take-hit').setData('cardId', view.id).setData('disabled', !enabled);
    if (enabled) take.setInteractive({ useHandCursor: true }).on('pointerdown', () => scene.requestRewardChoice(view.id));
    target.add(take);
    label(x + 62, 586, view.armed ? 'Confirm' : 'Select', 17, 116, enabled ? UI_GOLD : '#667b89', 1,
      'reward-card-take-label').setOrigin(0.5);
  });
  if (scene.mode === 'cardReward') renderFocusedBuildRead({
    scene, target, width: GAME_WIDTH, kind: 'card', fontFamily: UI_FONT, boldFontStyle: UI_BOLD,
    cards: choices.map((card: any, index: number) => scene.rewardCardView(card, index)),
    skip: { armed: scene.rewardSkipArmed, scrap: scene.currentSkipScrapReward(), deckSize: scene.allDeckCards().length, scrapAfter: scene.scrap + scene.currentSkipScrapReward() },
  });
}

export function updateRouteRewardGamepad(
  scene: any,
  pad: Phaser.Input.Gamepad.Gamepad,
  buttonsDown: Set<string>,
) {
  if (scene.cardPickerInspectionOpen || scene.routeRewardInspectionCardId || supplyInspectionState(scene)) {
    const picker = Boolean(scene.cardPickerInspectionOpen);
    for (const [id, pressed, action] of [
      [picker ? 'picker-left' : 'reward-previous', pad.left, 'previous'],
      [picker ? 'picker-right' : 'reward-next', pad.right, 'next'],
      [picker ? 'picker-confirm' : 'reward-confirm', pad.A, 'confirm'],
    ] as const) {
      if (pressed && !buttonsDown.has(id)) handleRouteRewardAction(scene, action);
      if (pressed) buttonsDown.add(id); else buttonsDown.delete(id);
    }
    return true;
  }
  if (scene.cardPickerMode) {
    const controls: Array<[string, boolean, () => void]> = [
      ['picker-left', pad.left, () => cycleCardPickerFocus(scene, -1)],
      ['picker-right', pad.right, () => cycleCardPickerFocus(scene, 1)],
      ['picker-up', pad.up, () => cycleCardPickerFocus(scene, -5)],
      ['picker-down', pad.down, () => cycleCardPickerFocus(scene, 5)],
      ['picker-confirm', pad.A, () => handleRouteRewardAction(scene, 'confirm')],
    ];
    controls.forEach(([id, pressed, action]) => {
      if (pressed && !buttonsDown.has(id)) action();
      if (pressed) buttonsDown.add(id);
      else buttonsDown.delete(id);
    });
    return true;
  }
  if (scene.marketOpen) {
    const controls: Array<[string, boolean, () => void]> = [
      ['market-previous', pad.left || pad.up, () => cycleMarketFocus(scene, -1)],
      ['market-next', pad.right || pad.down, () => cycleMarketFocus(scene, 1)],
      ['market-confirm', pad.A, () => activateMarketFocus(scene)],
    ];
    controls.forEach(([id, pressed, action]) => {
      if (pressed && !buttonsDown.has(id)) action();
      if (pressed) buttonsDown.add(id);
      else buttonsDown.delete(id);
    });
    return true;
  }
  if (!scene.pendingRouteReward) return false;
  const controls: Array<[string, boolean, () => void]> = [
    ['reward-previous', pad.left || pad.up, () => scene.routeSupplyRewardChoices.length > 1 ? scene.cycleRouteSupplyRewardChoice(-1) : scene.cycleRouteRewardChoice(-1)],
    ['reward-next', pad.right || pad.down, () => scene.routeSupplyRewardChoices.length > 1 ? scene.cycleRouteSupplyRewardChoice(1) : scene.cycleRouteRewardChoice(1)],
    ['reward-confirm', pad.A, () => {
      if (scene.pendingRouteReward && scene.routeCardRewardChoices.length === 0 && scene.routeSupplyRewardChoices.length < 2) {
        handleRouteRewardAction(scene, 'confirm');
        return;
      }
      if (scene.routeRewardInspectionCardId) {
        scene.closeRouteRewardInspection();
        return;
      }
      if (scene.routeSupplyRewardChoices.length > 1) {
        const supply = scene.focusedRouteSupplyReward();
        if (supply) scene.requestRouteSupplyReward(supply.id);
        return;
      }
      const card = scene.focusedRouteRewardCard();
      if (card) scene.requestRouteRewardCard(card.id);
    }],
  ];
  controls.forEach(([id, pressed, action]) => {
    if (pressed && !buttonsDown.has(id)) action();
    if (pressed) buttonsDown.add(id);
    else buttonsDown.delete(id);
  });
  return true;
}

export function handleRouteRewardAction(
  scene: any,
  action: 'confirm' | 'previous' | 'next' | 'inspect' | 'back',
) {
  if (scene.pauseOverlayOpen || scene.settingsOverlayOpen) return false;
  if (handleSupplyInspection(scene, action)) return true;
  if (scene.cardPickerMode) {
    if (action === 'back') {
      if (scene.cardPickerInspectionOpen) closeCardPickerInspection(scene);
      else if (scene.cardPickerArmedIndex !== undefined) {
        scene.cardPickerArmedIndex = undefined;
        scene.renderAll();
      }
      else if (scene.cardPickerContext === 'market') scene.cancelMarketCardPicker();
      else scene.cancelRouteCardPicker();
      return true;
    }
    if (scene.cardPickerInspectionOpen) {
      if (action === 'previous' || action === 'next') turnRouteInspectionPage(scene, action === 'previous' ? -1 : 1);
      if (action === 'confirm' || action === 'inspect') closeCardPickerInspection(scene);
      return true;
    }
    if (action === 'previous' || action === 'next') {
      cycleCardPickerFocus(scene, action === 'previous' ? -1 : 1);
    } else if (action === 'inspect') {
      openCardPickerInspection(scene);
    } else {
      const entry = focusedCardPickerEntry(scene);
      if (entry && (scene.cardPickerContext !== 'market' || scene.runState.scrap >= entry.cost)) {
        scene.requestCardPick(entry.index);
      }
    }
    return true;
  }
  if (scene.marketOpen) {
    if (action === 'inspect' && scene.marketCategory !== 'cards') {
      scene.marketItemHover?.getData('turnRulesPage')?.(1);
      return true;
    }
    if (action === 'inspect' && scene.marketCategory === 'cards') {
      const dossier = scene.hoverCardDetail?.list.find((child: any) => child.name === 'market-fixed-card-inspector');
      if (!dossier) {
        marketInputTargets(scene).find((target: any) => target.getData('marketFocusId') === scene.marketFocusId)?.emit('pointerover');
      } else dossier.getData('turnRulesPage')?.(1);
      scene.updateTextState();
      return true;
    }
    if (action === 'previous' || action === 'next') {
      cycleMarketFocus(scene, action === 'previous' ? -1 : 1);
      return true;
    }
    if (action === 'confirm') return activateMarketFocus(scene);
    if (action === 'back' && scene.marketFocusArmedId) {
      scene.marketFocusArmedId = undefined;
      scene.renderAll();
      return true;
    }
    return false;
  }
  if (action === 'back') {
    if (scene.routeRewardInspectionCardId) scene.closeRouteRewardInspection();
    else if (scene.routeRewardArmedCardId) {
      scene.routeRewardArmedCardId = undefined;
      scene.renderAll();
    } else if (scene.routeSupplyRewardArmedId) {
      scene.routeSupplyRewardArmedId = undefined;
      scene.renderAll();
    } else if (scene.pendingRouteReward) scene.cancelRouteCardReward();
    else return false;
    return true;
  }
  if (!scene.pendingRouteReward) return false;
  if (scene.routeSupplyRewardChoices.length > 1) {
    if (action === 'inspect') {
      const supply = scene.focusedRouteSupplyReward();
      if (supply) openSupplyInspection(scene, supply.id);
    } else if (action === 'previous' || action === 'next') {
      scene.cycleRouteSupplyRewardChoice(action === 'previous' ? -1 : 1);
    } else if (action === 'confirm') {
      const supply = scene.focusedRouteSupplyReward();
      if (supply) scene.requestRouteSupplyReward(supply.id);
    }
    return true;
  }
  if (scene.routeCardRewardChoices.length === 0) {
    if (action === 'inspect') openOutcomeInspection(scene);
    else if (action === 'confirm') scene.claimRouteReward();
    return true;
  }
  if (scene.routeRewardInspectionCardId) {
    if (action === 'previous' || action === 'next') turnRouteInspectionPage(scene, action === 'previous' ? -1 : 1);
    if (action === 'confirm' || action === 'inspect') scene.closeRouteRewardInspection();
    return true;
  }
  if (action === 'previous' || action === 'next') {
    scene.cycleRouteRewardChoice(action === 'previous' ? -1 : 1);
  } else if (action === 'inspect') {
    scene.toggleFocusedRouteRewardInspection();
  } else {
    const card = scene.focusedRouteRewardCard();
    if (card) scene.requestRouteRewardCard(card.id);
  }
  return true;
}

export function focusedRewardCard(scene: any) {
  const cards = scene.mode === 'cardReward'
    ? scene.rewardChoices
    : scene.mode === 'upgradeReward'
      ? scene.upgradeChoices
      : [];
  return cards[scene.normalizeCombatChoiceIndex()];
}

export function openRewardCardInspection(scene: any, cardId: string) {
  const cards = scene.mode === 'cardReward' ? scene.rewardChoices : scene.upgradeChoices;
  const index = cards.findIndex((card: any) => card.id === cardId);
  if (index < 0) return undefined;
  scene.controllerChoiceIndex = index;
  scene.battleInputActive = true;
  scene.rewardInspectionCardId = cardId;
  inspectionReading.delete(scene);
  scene.requestBattleRender();
  return cards[index];
}

export function closeRewardCardInspection(scene: any) {
  if (!scene.rewardInspectionCardId) return false;
  if (scene.pauseOverlayOpen || scene.settingsOverlayOpen) return false;
  scene.rewardInspectionCardId = undefined;
  inspectionReading.delete(scene);
  scene.rewardInspectionLayer?.destroy(true);
  scene.rewardInspectionLayer = undefined;
  scene.hideCardPreview();
  scene.requestBattleRender();
  return true;
}

export function renderRewardInspectButton(context: {
  scene: Phaser.Scene;
  target: Phaser.GameObjects.Container;
  x: number;
  y: number;
  accent: number;
  fontFamily: string;
  boldFontStyle: string;
  enabled?: boolean;
  width?: number;
  label?: string;
  fontSize?: number;
  onInspect: () => void;
}) {
  const { scene, target, x, y } = context;
  const enabled = context.enabled !== false;
  const hit = scene.add.rectangle(
    x,
    y,
    context.width ?? 132,
    MIN_SUPPORTED_TOUCH_TARGET,
    enabled ? 0x102534 : 0x0a141c,
    enabled ? 0.88 : 0.48,
  )
    .setStrokeStyle(2, enabled ? context.accent : 0x49606d, enabled ? 0.9 : 0.42)
    .setData('disabled', !enabled)
    .setName('reward-card-inspect-hit');
  if (enabled) {
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerdown', (
      _pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event?: Phaser.Types.Input.EventData,
    ) => {
      event?.stopPropagation();
      context.onInspect();
    });
    hit.on('pointerover', () => hit.setFillStyle(0x18384b, 1));
    hit.on('pointerout', () => hit.setFillStyle(0x102534, 0.88));
  }
  target.add(hit);
  target.add(scene.add.text(x, y, context.label ?? 'INSPECT', {
    fontFamily: context.fontFamily,
    fontSize: `${context.fontSize ?? 11}px`,
    fontStyle: context.boldFontStyle,
    color: enabled ? '#dffbff' : '#667b89',
  }).setOrigin(0.5).setName('reward-card-inspect-label'));
}

export function renderRewardInspectionChrome(context: {
  scene: Phaser.Scene;
  target: Phaser.GameObjects.Container;
  width: number;
  height: number;
  fontFamily: string;
  boldFontStyle: string;
  backLabel: string;
  returnLabel: string;
  onClose: () => void;
}) {
  const { scene, target, width, height, fontFamily, boldFontStyle } = context;
  const layer = scene.add.container(0, 0).setDepth(900).setName('reward-card-inspection');
  const scrim = scene.add.rectangle(width / 2, height / 2, width, height, 0x020409, 0.86)
    .setInteractive({ useHandCursor: true })
    .setName('reward-card-inspection-scrim');
  scrim.on('pointerdown', context.onClose);
  layer.add(scrim);
  layer.add(scene.add.text(74, 38, 'FULL CARD INSPECTION', {
    fontFamily,
    fontSize: '13px',
    fontStyle: boldFontStyle,
    color: '#ffe08a',
    letterSpacing: 1.4,
  }).setOrigin(0, 0.5));
  layer.add(scene.add.text(width / 2, height - 34, `${context.backLabel} / B / TAP OUTSIDE  ${context.returnLabel}`, {
    fontFamily,
    fontSize: '12px',
    fontStyle: boldFontStyle,
    color: '#dffbff',
  }).setOrigin(0.5));
  target.add(layer);
  return layer;
}

export function syncRewardCardInspection(scene: any, chrome: {
  target: Phaser.GameObjects.Container;
  width: number;
  height: number;
  fontFamily: string;
  boldFontStyle: string;
  backLabel: string;
  returnLabel: string;
  onClose: () => void;
}) {
  scene.rewardInspectionLayer?.destroy(true);
  scene.rewardInspectionLayer = undefined;
  if (!scene.rewardInspectionCardId) return;
  const cards = scene.mode === 'cardReward' ? scene.rewardChoices : scene.upgradeChoices;
  const card = cards.find((candidate: any) => candidate.id === scene.rewardInspectionCardId);
  if (!card) {
    scene.rewardInspectionCardId = undefined;
    scene.hideCardPreview();
    return;
  }
  scene.hideCardPreview();
  scene.rewardInspectionLayer = renderRewardInspectionChrome({ scene, ...chrome });
  const impact = rewardDeckImpact(scene, card);
  const panel = scene.add.container(650, 120).setName('reward-deck-impact');
  panel.add(scene.add.rectangle(0, 0, 430, 480, 0x071522, 1).setOrigin(0)
    .setStrokeStyle(1, UI_FIELD.cyan, 0.6).setInteractive());
  const row = (y: number, text: string, size: number, color: string) => panel.add(scene.add.text(18, y, text, {
    fontFamily: UI_FONT, fontSize: `${size}px`, resolution: 2, color, wordWrap: { width: 394 }, lineSpacing: 3,
  }).setName('reward-deck-impact-text'));
  row(18, 'YOUR FLIGHT / BEFORE > AFTER', 14, UI_CYAN);
  row(48, `Deck: ${impact.deckBefore} > ${impact.deckAfter} cards`, 20, UI_GOLD);
  row(80, `Base hand target: ${impact.handBefore} > ${impact.handAfter}`, 18, '#f4f8fb');
  row(120, impact.deckAfter > impact.deckBefore
    ? 'More cards share the draw pool. Passive gains apply even before this card is drawn.'
    : 'Same draw pool size. Preen changes this card without adding another copy.', 18, '#dce8f2');
  row(208, impact.stats.length ? `${scene.mode === 'upgradeReward' ? 'Changed stats after Preen' : 'Flock Stats gained'}: ${impact.stats.join(' / ')}` : 'Flock Stats unchanged.', 18, UI_GOLD);
  row(308, impact.scope, 16, '#dce8f2');
  row(384, impact.drawScope, 14, '#b9cbd9');
  scene.rewardInspectionLayer.add(panel);
  // A reward describes the next flight decision, not the finished turn's Molt
  // stance or temporary energy discount. Never borrow effective combat costs.
  const view: CardHoverDetailView = {
    name: displayName(card), bird: card.bird, label: cardLabel(card),
    zone: scene.mode === 'upgradeReward' ? 'Combat Preen inspection' : 'Combat reward inspection',
    cost: card.cost, anchorX: 404, anchorY: 365, accent: suitAccentColor(card),
    artKey: loadedCardArtKey(scene, card), target: card.target, role: card.role,
    currentText: card.upgraded ? card.upgradedText : card.text,
    baseText: card.upgraded ? card.upgradedText : card.text,
    upgradedText: card.upgraded ? 'Already preened.' : card.upgradedText,
    moltText: card.upgraded ? card.moltTextUpgraded || card.moltText : card.moltText,
    upgradedMoltText: !card.upgraded ? card.moltTextUpgraded : undefined,
    usesMolt: false, stats: cardStatRows(card), reducedMotion: true,
  };
  scene.cardPreview = renderRouteInspectionReader(scene, view);
  scene.rewardInspectionLayer.add(scene.cardPreview);
}

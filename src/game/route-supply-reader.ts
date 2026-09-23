import Phaser from 'phaser';
import { controlBindingLabel, displayName, formatEffects, formatWaymarkTrigger, isSnagCard, routeMarkEffectText, supplyAccent, supplyCompactArtAssets, waymarkCompactArtAssets, UI_FONT, UI_GOLD } from '../main';
import { alphaRouteMarkLibrary, alphaSupplyLibrary } from './runtime-data';
import { decisionButton, decisionText } from './decision-surface';
import { itemKeywordSections } from './keyword-definitions';
import { DECISION_UI } from './theme';

type Reading = { title: string; text: string; page: number; total: number };
type Inspection = { pending: object; id: string; kind: 'supply' | 'waymark' | 'outcome'; outcome: boolean; page: number; reading?: Reading };
const inspections = new WeakMap<Phaser.Scene, Inspection>();

function current(scene: any) {
  const state = inspections.get(scene);
  if (state && state.pending === scene.pendingRouteReward && (state.outcome
    ? state.kind === 'outcome' || (scene.pendingRouteReward?.previewItem?.id === state.id && scene.pendingRouteReward.previewItem.kind === state.kind)
    : scene.routeSupplyRewardChoices.includes(state.id))) return state;
  inspections.delete(scene);
  return undefined;
}

export function supplyInspectionState(scene: any) {
  const state = current(scene);
  return state ? { open: true, supplyId: state.kind === 'supply' ? state.id : undefined, itemId: state.id, kind: state.kind, outcome: state.outcome,
    name: state.kind === 'outcome' ? 'Your decision' : (state.kind === 'supply' ? alphaSupplyLibrary : alphaRouteMarkLibrary).get(state.id)?.name, reading: state.reading } : undefined;
}

export function openOutcomeInspection(scene: any, summaryOnly = false) {
  const pending = scene.pendingRouteReward;
  if (!pending || scene.pauseOverlayOpen || scene.settingsOverlayOpen) return;
  const item = (!summaryOnly && pending.previewItem) || { id: pending.choiceKey, kind: 'outcome' };
  inspections.set(scene, { pending: scene.pendingRouteReward, ...item, outcome: true, page: 0 });
  scene.hideMarketItemDetail(); scene.hideHoverCardDetail(); scene.renderAll();
}

/** The same complete consequences are available from pointer Details and input-driven readers. */
export function routeDecisionSections(scene: any) {
  const pending = scene.pendingRouteReward;
  if (!pending) return [];
  return [
    { title: 'YOUR CHOICE', text: pending.choiceText },
    { title: 'COMPLETE OUTCOME', text: pending.effectText || formatEffects(pending.effects) },
    { title: 'PROJECTED CHANGES', text: (pending.decisionPreview?.length ? pending.decisionPreview : ['No state change.']).join('\n').replace(/ > /g, ' → ') },
    ...scene.routeCardRewardChoices.map((card: any) => ({ title: 'BUILD ADVICE', text: `${displayName(card)}\n${scene.routeRewardCardObservations(card).join('\n')}` })),
  ];
}

export function renderOutcomeShowcase(scene: any, x: number, y: number) {
  const pending = scene.pendingRouteReward, item = pending?.previewItem;
  const supply = item?.kind === 'supply' ? alphaSupplyLibrary.get(item.id) : undefined;
  const mark = item?.kind === 'waymark' ? alphaRouteMarkLibrary.get(item.id) : undefined;
  const found = supply ?? mark;
  if (!found) return false;
  const companion = pending.previewCards?.[0];
  const accent = supply ? supplyAccent(supply) : 0xd5b775;
  const cx = companion ? x - 106 : x;
  const label = (cx: number, cy: number, value: string, width: number, size: number, color: string) => scene.add.text(cx, cy, value, {
    fontFamily: UI_FONT, fontSize: `${size}px`, color, resolution: 2, align: 'center', wordWrap: { width, useAdvancedWrap: true }, lineSpacing: 2,
  }).setOrigin(0.5, 0);
  const name = (cx: number, value: string, width: number, color: string) => {
    const title = label(cx, y + 55, value, width, 20, color).setName('route-outcome-item-name');
    const lines = title.getWrappedText();
    let excerpt = lines.slice(0, 2).join('\n');
    title.setText(excerpt + (lines.length > 2 ? '…' : ''));
    while (title.height > 52 && excerpt.length) { excerpt = excerpt.slice(0, -1).trimEnd(); title.setText(`${excerpt}…`); }
  };
  scene.add.rectangle(x, y, 410, 254, 0x07101a, 0.96).setStrokeStyle(1, accent, 0.55);
  label(cx, y - 110, supply ? 'SUPPLY' : 'WAYMARK', 180, 16, '#abc4d4');
  const key = supply ? supplyCompactArtAssets[found.id]?.key : waymarkCompactArtAssets[found.id]?.key;
  if (key && scene.textures.exists(key)) scene.add.image(cx, y - 24, key).setDisplaySize(116, 116);
  name(cx, found.name, companion ? 182 : 370, UI_GOLD);
  if (companion) {
    scene.add.rectangle(x, y, 1, 224, accent, 0.25);
    label(x + 106, y - 110, isSnagCard(companion) ? 'SNAG CARD' : 'COMPANION CARD', 188, 16, '#ffd5cc');
    scene.renderRouteRewardCardOption(companion, x + 106, y - 24, 80, 120, 0xe38a7b);
    name(x + 106, displayName(companion), 182, '#ffd5cc');
  }
  return true;
}

export function renderOutcomeInspectButton(scene: any, x: number, y: number) {
  decisionButton(scene, x - 102, y + 184, 194, 'Inspect outcome', 'route-outcome-inspect-hit', () => openOutcomeInspection(scene));
  const action = scene.pendingRouteReward.effects.length === 0 ? 'Leave' : scene.pendingRouteReward.nodeType === 'cache' ? 'Claim' : 'Confirm';
  decisionText(scene, x, y - 184, `${controlBindingLabel('roost')} / Y  Inspect · ${controlBindingLabel('confirm')} / A  ${action}`, 430, 16, DECISION_UI.secondary).setOrigin(0.5, 0);
}

export function openSupplyInspection(scene: any, id: string) {
  if (scene.pauseOverlayOpen || scene.settingsOverlayOpen || !scene.pendingRouteReward || !scene.routeSupplyRewardChoices.includes(id)) return;
  // Inspection never changes the focus or the armed transaction.
  inspections.set(scene, { pending: scene.pendingRouteReward, id, kind: 'supply', outcome: false, page: 0 });
  scene.hideMarketItemDetail();
  scene.renderAll();
}

export function handleSupplyInspection(scene: any, action: 'confirm' | 'previous' | 'next' | 'inspect' | 'back') {
  if (!current(scene)) return false;
  if (scene.pauseOverlayOpen || scene.settingsOverlayOpen) return true;
  if (action === 'previous' || action === 'next') {
    scene.children.getByName('route-supply-reader')?.getData('turnRulesPage')?.(action === 'previous' ? -1 : 1);
  } else {
    inspections.delete(scene);
    scene.renderAll();
  }
  return true;
}

export function renderSupplyInspection(scene: any) {
  const state = current(scene);
  const supply = state?.kind === 'supply' ? alphaSupplyLibrary.get(state.id) : undefined;
  const mark = state?.kind === 'waymark' ? alphaRouteMarkLibrary.get(state.id) : undefined;
  const item = supply ?? mark ?? (state?.kind === 'outcome' ? { id: state.id, name: 'Your decision' } : undefined);
  if (!state || !item) return;
  const accent = supply ? supplyAccent(supply) : 0xd5b775;
  const panel = scene.add.container(0, 0).setDepth(23040).setName('route-supply-reader');
  const add = <T extends Phaser.GameObjects.GameObject>(child: T): T => { panel.add(child); return child; };
  const text = (x: number, y: number, value: string, size = 22, width = 464) => add(decisionText(scene, x, y, value, width, size).setLineSpacing(3));
  add(scene.add.rectangle(640, 360, 1280, 720, 0x020409, 0.88).setInteractive().setName('route-supply-reader-scrim'))
    .on('pointerdown', () => handleSupplyInspection(scene, 'back'));
  const frame = add(scene.add.rectangle(640, 360, 512, 604, 0x070d15, 1).setStrokeStyle(1, accent, 0.8)
    .setInteractive().setName('route-supply-reader-frame'));
  const key = supply ? supplyCompactArtAssets[item.id]?.key : waymarkCompactArtAssets[item.id]?.key;
  if (key && scene.textures.exists(key)) add(scene.add.image(466, 148, key).setDisplaySize(96, 96));
  const headingX = state.kind === 'outcome' ? 408 : 534;
  const headingWidth = state.kind === 'outcome' ? 464 : 332;
  text(headingX, 85, `${supply ? 'SUPPLY' : mark ? 'WAYMARK' : 'OUTCOME'} / INSPECTION`, 16, headingWidth).setColor('#abc4d4');
  const title = text(headingX, 116, item.name, 26, headingWidth).setColor(UI_GOLD).setName('route-supply-reader-title');
  const lines = title.getWrappedText();
  let excerpt = lines.slice(0, 2).join('\n');
  title.setText(excerpt + (lines.length > 2 ? '…' : ''));
  while (title.height > 70 && excerpt.length) { excerpt = excerpt.slice(0, -1).trimEnd(); title.setText(`${excerpt}…`); }
  const outcomeOnly = state.kind === 'outcome';
  text(408, outcomeOnly ? 167 : 212, 'Read only · Your choice is unchanged', 18).setColor('#abc4d4');
  add(scene.add.rectangle(640, outcomeOnly ? 205 : 252, 464, 1, accent, 0.35));
  const heading = text(408, outcomeOnly ? 225 : 272, '', 16).setColor(UI_GOLD);
  const body = text(408, outcomeOnly ? 258 : 305, '').setName('route-supply-reader-body');
  const decision = routeDecisionSections(scene);
  const sections = supply ? [
    { title: 'EFFECT', text: supply.description },
    { title: 'RULES', text: formatEffects(supply.effects) },
    { title: 'SUPPLY DETAILS', text: `${supply.name}\n${supply.rarity} / ${supply.category}\nTiming: ${supply.timing}` },
  ] : mark ? [
    { title: 'EFFECT', text: mark!.description },
    { title: 'TRIGGER', text: formatWaymarkTrigger(mark!.trigger, mark!.effects ?? (mark!.effect ? [mark!.effect] : [])) },
    { title: 'RULES', text: routeMarkEffectText(mark!) },
    { title: 'WAYMARK DETAILS', text: `${mark!.name}\n${mark!.rarity} / ${mark!.family}` },
  ] : [{ title: 'DECISION SUMMARY', text: decision.slice(0, 3).map((section, index) =>
    `${index === 2 ? 'After confirming:\n' : ''}${section.text}`).join('\n\n') }];
  sections.push(...itemKeywordSections(sections));
  if (state.outcome) {
    for (const card of scene.pendingRouteReward.previewCards ?? []) sections.push({ title: 'COMPANION CARD',
      text: `${displayName(card)}\n${isSnagCard(card) ? 'Snag · Unplayable' : `Card · Cost: ${card.cost}`}\n${card.upgraded ? card.upgradedText ?? card.text : card.text}` });
  }
  sections.push(...decision.filter(section => state.kind !== 'outcome' || section.title === 'BUILD ADVICE'));
  const pages: Array<{ title: string; text: string }> = [];
  for (const section of sections) {
    let lines: string[] = [];
    for (const line of body.getWrappedText(section.text || 'No additional rules.')) {
      body.setText([...lines, line].join('\n'));
      if (body.getBounds().bottom > 498 && lines.length) { pages.push({ title: section.title, text: lines.join('\n') }); lines = []; }
      lines.push(line);
    }
    if (lines.length) pages.push({ title: section.title, text: lines.join('\n') });
  }
  const compact = pages.length === 1;
  body.setText(pages[0].text);
  const footerY = compact ? Math.max(400, body.getBounds().bottom + 28) : 521;
  const pageLabel = text(640, footerY, '', 16, 220).setOrigin(0.5);
  const show = (delta: number) => {
    if (delta && (scene.pauseOverlayOpen || scene.settingsOverlayOpen)) return;
    state.page = (state.page + delta + pages.length) % pages.length;
    const page = pages[state.page];
    heading.setText(page.title); body.setText(page.text);
    pageLabel.setText(pages.length === 1 ? 'Complete outcome' : `${state.page + 1} / ${pages.length}`);
    state.reading = { ...page, page: state.page + 1, total: pages.length };
    if (delta) scene.updateTextState();
  };
  const button = (x: number, y: number, width: number, label: string, name: string, action: () => void) => {
    decisionButton(scene, x, y, width, label, `route-supply-reader-${name}`, action).forEach(add);
  };
  if (pages.length > 1) {
    button(522, 565, 220, '← Previous', 'previous', () => show(-1));
    button(758, 565, 220, 'Next →', 'next', () => show(1));
  }
  const returnY = compact ? footerY + 44 : 629;
  if (compact) frame.setSize(512, returnY + 37 - 58).setY((58 + returnY + 37) / 2);
  button(640, returnY, 456, `Return · ${controlBindingLabel('back')} / B`, 'return', () => handleSupplyInspection(scene, 'back'));
  panel.setData('turnRulesPage', show);
  show(0);
}

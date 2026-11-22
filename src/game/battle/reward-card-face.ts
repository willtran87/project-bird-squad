import type Phaser from 'phaser';
import type { RewardCardView, RewardDecisionPreview } from './render-reward';
import { addTarotMark } from '../world-glyphs';
import { actionFirstHandRules, compactHandRules, readableHandRules, wrapHandRules } from './hand-rule-summary';

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


/** Shared choice face: identical geometry in the ceremony and its offline fallback. */
export function renderRewardCardFace(context: { scene: Phaser.Scene; target: Phaser.GameObjects.Container;
  fontFamily: string; boldFontStyle: string; goldColor: string; softColor: string;
  reinforcedColorCues?: boolean;
  failedArtKeys?: ReadonlySet<string>; onCardArtRetry?: (cardId: string) => void;
  typography: { primary: number; secondary: number; resolution: number } }, card: RewardCardView, x: number, fallback = false) {
  const { scene, target, fontFamily, boldFontStyle, goldColor, softColor, typography } = context;
  const prefix = fallback ? 'reward-fallback' : 'reward-card';
  const label = (left: number, y: number, value: string, size: number, width: number, lines: number, name: string, color = '#e7eef7') => {
    const text = boundedRewardText(scene.add.text(left, y, value, {
      fontFamily, fontSize: size, color, resolution: typography.resolution,
      fontStyle: name.endsWith('name') ? boldFontStyle : 'normal',
      wordWrap: { width, useAdvancedWrap: true }, lineSpacing: 2,
    }), lines).setName(name).setData('fullText', value).setData('cardId', card.id);
    target.add(text); return text;
  };
  // A larger portrait than the old 60x90 thumbnail; the card still reads
  // top-down: identity beside the art, every rule below it, then advice.
  const artW = REWARD_ART_W, artH = REWARD_ART_H;
  const slot = scene.add.container(x - 132 + 6 + artW / 2, 246 + artH / 2).setSize(artW, artH)
    .setName('reward-card-art-slot').setData('cardId', card.id);
  target.add(slot);
  const paint = (failed = Boolean(card.artKey && context.failedArtKeys?.has(card.artKey))) => {
    if (!slot.active) return;
    slot.removeAll(true);
    const key = card.artKey && scene.textures.exists(card.artKey) ? card.artKey : undefined;
    slot.setData('artState', key ? 'ready' : failed || !card.artKey ? 'unavailable' : 'loading');
    const backing = scene.add.rectangle(0, 0, artW, artH, 0x10202d, 1).setStrokeStyle(1, card.accent, 0.45);
    slot.add(backing);
    if (!key && failed && context.onCardArtRetry) backing.setName('reward-art-retry')
      .setInteractive({ useHandCursor: true }).on('pointerdown', (_p: unknown, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event?.stopPropagation(); context.onCardArtRetry?.(card.id); paint(false);
      });
    if (key) {
      const art = scene.add.image(0, 0, key).setName(fallback ? 'reward-fallback-card-art' : 'reward-card-art').setData('cardId', card.id);
      art.setScale(Math.min(artW / art.width, artH / art.height)); slot.add(art);
    } else slot.add(scene.add.text(0, 0, failed && context.onCardArtRetry ? 'Art failed\nRetry' : failed || !card.artKey ? 'Art\nunavailable' : 'Loading\nart', {
      fontFamily: fontFamily, fontSize: typography.secondary, color: softColor, resolution: 2,
      wordWrap: { width: 68, useAdvancedWrap: true }, align: 'center',
    }).setOrigin(0.5).setName('reward-art-status'));
  };
  slot.setData('rewardArtRefresh', (failedKeys: string[]) => paint(Boolean(card.artKey && (failedKeys.includes(card.artKey) || context.failedArtKeys?.has(card.artKey)))));
  paint();
  // The tarot numeral and suit sigil, crisp over the art's own small cartouche.
  const tarot = addTarotMark(scene, card.id, slot.x, 258, 20, artW - 2);
  if (tarot) target.add(tarot.setName(`${prefix}-tarot-mark`));
  const textLeft = x - 132 + 6 + artW + 10, textWidth = 160;
  label(textLeft, 248, card.name, typography.primary, textWidth, 2, fallback ? 'reward-fallback-choice-name' : 'reward-card-name', goldColor);
  label(textLeft, 306, `${card.cost} Wingbeat${card.cost === 1 ? '' : 's'}`, typography.primary, textWidth, 1,
    fallback ? 'reward-fallback-card-cost' : 'reward-card-cost', '#bfe8f4');
  // Passive stats sit beside the art so the rules below can use the room.
  label(textLeft, 333, card.passiveDelta ?? 'No passive stat change', typography.secondary, textWidth, 1, 'reward-passive-delta', '#bfe8f4');
  const inset = context.reinforcedColorCues ? 32 : 0;
  const familyY = 246 + artH + 4;
  label(x - 116 + inset, familyY, card.label, typography.secondary, (card.molt ? 160 : 232) - inset, 1, 'reward-card-family', card.accentText);
  if (card.molt) label(x + 58, familyY, 'MOLT', typography.secondary, 60, 1, 'reward-card-molt-label', '#ffc78f');
  const collection = !fallback && card.collectionStatus;
  const status = collection && (collection.firstClaim || collection.targeted);
  const preenContext = !fallback && card.decisionPreview.kind === 'preen';
  if (status) label(x - 116, 216, collection.targeted ? 'HUNT TARGET' : 'NEW TO COLLECTION', typography.secondary, 232, 1, 'reward-collection-status', goldColor);
  // Every rule is on the face; advice yields room before any rule does.
  const rulesTop = familyY + 28;
  const advice = card.quickRead ? 2 : 0;
  const rowH = 23;
  const floor = REWARD_FACE_BOTTOM - rowH * (1 + (card.quickRead ? 1 : 0));
  const rules = scene.add.text(x - 118, rulesTop + 3, '', {
    fontFamily, fontSize: typography.primary, color: '#e7eef7', resolution: typography.resolution, lineSpacing: 1,
    wordWrap: { width: 236, callback: (text: string, object: Phaser.GameObjects.Text) =>
      wrapHandRules(text, value => object.context.measureText(value).width, 236) },
  }).setName(`${prefix}-effect`).setData('cardId', card.id);
  const readable = rewardFaceRules(card.summary);
  // Last resort before type drops below 18px: every advice row yields.
  const fitted = fitRewardRules(rules, readable, [floor - rowH * advice, floor - rowH, floor, REWARD_FACE_BOTTOM].map(bottom => bottom - rulesTop - 6));
  rules.setData('fullText', card.summary).setData('readableRules', readable).setData('faceTier', fitted.tier)
    .setData('truncated', false).setData('omittedEffects', 0);
  const panelH = Math.ceil(rules.height) + 6;
  target.add(scene.add.rectangle(x, rulesTop + panelH / 2, 248, panelH, 0x050c14, 1).setName('reward-card-effect-panel'));
  target.add(rules);
  let y = rulesTop + panelH + 4;
  // Rows below the rules appear only while they still fit on the face.
  const fits = () => y + rowH <= REWARD_FACE_BOTTOM + 4;
  if (fits()) label(x - 116, y, preenContext ? 'Same deck size · Preen' : rewardDecisionPreviewLabel(card.decisionPreview), typography.secondary, 232, 1,
    fallback ? 'reward-fallback-decision-context'
      : preenContext ? 'reward-card-preen-context' : 'reward-decision-delta', status ? goldColor : '#a9c6d5');
  y += rowH;
  if (card.quickRead && fits()) {
    const pairingLines = Math.max(0, Math.min(2, Math.floor((REWARD_FACE_BOTTOM - rowH - y) / rowH)));
    const pairing = label(x - 116, y, card.quickRead.pairing, typography.secondary, 232, Math.max(1, pairingLines), 'reward-owned-pairing');
    pairing.setVisible(pairingLines > 0);
    y += pairingLines * rowH;
    if (fits()) label(x - 116, y, card.quickRead.tradeoff, typography.secondary, 232, 1, 'reward-main-tradeoff', '#ffcfaa');
  }
}

const REWARD_ART_W = 72;
const REWARD_ART_H = 108;
/** Last text row ends above the card frame (y 549). */
const REWARD_FACE_BOTTOM = 545;

/** Authored effect sentences, one clause per line, in readable hand wording. */
export function rewardFaceRules(summary: string) {
  return readableHandRules(summary.split(/(?<=[.!])\s+(?=[A-Z+])/).map(part => part.trim()).filter(Boolean));
}

/** Full wording first, then the compact dialect at smaller sizes; heights
 * grow as advice rows yield. Rules are never clipped. */
function fitRewardRules(label: Phaser.GameObjects.Text, readable: string, heights: number[]) {
  const full = actionFirstHandRules(readable), compact = compactHandRules(readable);
  // Advice yields before type drops below the 18px readable floor.
  const steps: Array<[string, number, string]> = [[full, 21, 'full-21'], [full, 19, 'full-19'], [compact, 19, 'compact-19'], [compact, 18, 'compact-18']];
  for (const sizes of [steps, [[compact, 17, 'compact-17'], [compact, 16, 'compact-16']] as typeof steps])
    for (const height of heights) for (const [text, size, tier] of sizes) {
      label.setFontSize(size).setText(text);
      if (label.height <= height) return { tier: `${tier}@${height}` };
    }
  label.setFontSize(15).setText(compact);
  return { tier: 'overflow' };
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

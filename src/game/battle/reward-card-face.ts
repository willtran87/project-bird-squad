import type Phaser from 'phaser';
import type { RewardCardView, RewardDecisionPreview } from './render-reward';

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
  const slot = scene.add.container(x - 78, 296).setSize(60, 90)
    .setName('reward-card-art-slot').setData('cardId', card.id);
  target.add(slot);
  const paint = (failed = Boolean(card.artKey && context.failedArtKeys?.has(card.artKey))) => {
    if (!slot.active) return;
    slot.removeAll(true);
    const key = card.artKey && scene.textures.exists(card.artKey) ? card.artKey : undefined;
    slot.setData('artState', key ? 'ready' : failed || !card.artKey ? 'unavailable' : 'loading');
    const backing = scene.add.rectangle(0, 0, 60, 90, 0x10202d, 1).setStrokeStyle(1, card.accent, 0.45);
    slot.add(backing);
    if (!key && failed && context.onCardArtRetry) backing.setName('reward-art-retry')
      .setInteractive({ useHandCursor: true }).on('pointerdown', (_p: unknown, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event?.stopPropagation(); context.onCardArtRetry?.(card.id); paint(false);
      });
    if (key) {
      const art = scene.add.image(0, 0, key).setName(fallback ? 'reward-fallback-card-art' : 'reward-card-art').setData('cardId', card.id);
      art.setScale(Math.min(60 / art.width, 90 / art.height)); slot.add(art);
    } else slot.add(scene.add.text(0, 0, failed && context.onCardArtRetry ? 'Art failed\nRetry' : failed || !card.artKey ? 'Art\nunavailable' : 'Loading\nart', {
      fontFamily: fontFamily, fontSize: typography.secondary, color: softColor, resolution: 2,
      wordWrap: { width: 68, useAdvancedWrap: true }, align: 'center',
    }).setOrigin(0.5).setName('reward-art-status'));
  };
  slot.setData('rewardArtRefresh', (failedKeys: string[]) => paint(Boolean(card.artKey && (failedKeys.includes(card.artKey) || context.failedArtKeys?.has(card.artKey)))));
  paint();
  label(x - 26, 258, card.name, typography.primary, 142, 2, fallback ? 'reward-fallback-choice-name' : 'reward-card-name', goldColor);
  label(x - 26, 314, `${card.cost} Wingbeat${card.cost === 1 ? '' : 's'}`, typography.primary, 142, 1,
    fallback ? 'reward-fallback-card-cost' : 'reward-card-cost', '#bfe8f4');
  const inset = context.reinforcedColorCues ? 32 : 0;
  label(x - 116 + inset, 348, card.label, typography.secondary, (card.molt ? 160 : 232) - inset, 1, 'reward-card-family', card.accentText);
  if (card.molt) label(x + 58, 348, 'MOLT', typography.secondary, 60, 1, 'reward-card-molt-label', '#ffc78f');
  target.add(scene.add.rectangle(x, 400, 248, 54, 0x050c14, 1).setName('reward-card-effect-panel'));
  label(x - 116, 376, card.summary, typography.primary, 232, 2, `${prefix}-effect`);
  const collection = !fallback && card.collectionStatus;
  const status = collection && (collection.firstClaim || collection.targeted);
  const preenContext = !fallback && card.decisionPreview.kind === 'preen';
  if (status) label(x - 116, 216, collection.targeted ? 'HUNT TARGET' : 'NEW TO COLLECTION', typography.secondary, 232, 1, 'reward-collection-status', goldColor);
  label(x - 116, 432, preenContext ? 'Same deck size · Preen' : rewardDecisionPreviewLabel(card.decisionPreview), typography.secondary, 232, 1,
    fallback ? 'reward-fallback-decision-context'
      : preenContext ? 'reward-card-preen-context' : 'reward-decision-delta', status ? goldColor : '#a9c6d5');
  label(x - 116, 456, card.passiveDelta ?? 'No passive stat change', typography.secondary, 232, 1, 'reward-passive-delta', '#bfe8f4');
  if (card.quickRead) {
    label(x - 116, 480, card.quickRead.pairing, typography.secondary, 232, 2, 'reward-owned-pairing');
    label(x - 116, 526, card.quickRead.tradeoff, typography.secondary, 232, 1, 'reward-main-tradeoff', '#ffcfaa');
  }
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

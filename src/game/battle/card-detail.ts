import Phaser from 'phaser';
import type { BattleHandCardPreviewView } from './render-hand';

export interface CardDetailContext {
  scene: Phaser.Scene;
  fontFamily: string;
  boldFontStyle: string;
  previousLabel: string;
  nextLabel: string;
  backLabel: string;
  onClose: () => void;
  announce: (text: string) => void;
  ui: typeof import('../theme').DECISION_UI;
  minTouchTarget: number;
}

/** Read-only, explicitly opened card help. It never mutates a combat decision. */
export function renderCombatCardDetail(context: CardDetailContext, card: BattleHandCardPreviewView) {
  return renderCombatReader(context, {
    name: card.name, kind: 'card', badge: `${card.cost} Wingbeat${card.cost === 1 ? '' : 's'}`,
    sections: [
      { heading: card.usesMolt ? 'ACTIVE · MOLT' : 'ACTIVE · NOW', body: card.currentText },
      ...(card.outcome ? [{ heading: 'PLAY NOW · OUTCOME', body: card.outcome }] : []),
      ...(card.sequence ? [{ heading: 'PLAY NOW · EFFECT ORDER', body: card.sequence }] : []),
      ...(card.alternateText ? [{ heading: card.alternateLabel ?? 'ALTERNATE', body: card.alternateText }] : []),
      { heading: 'PASSIVE FLOCK CONTRIBUTION', body: `${card.upgraded ? 'Preened. ' : ''}${card.stats || 'No passive contribution.'}\n\nThese are this card’s contributions, not an additional effect each time it is played. The combat outcome preview includes current modifiers.` },
    ],
  });
}

export function renderCombatHistory(context: CardDetailContext, entries: string[]) {
  return renderCombatReader(context, {
    name: 'Combat history', kind: 'history', badge: `${entries.length} events`,
    sections: [{ heading: 'RECENT EVENTS · OLDEST TO NEWEST', body: entries.map((entry, index) => `${index + 1}. ${entry}`).join('\n\n') || 'No events yet.' }],
  });
}

export function renderCombatReader(context: CardDetailContext, content: {
  name: string; kind: 'card' | 'history' | 'waymark'; badge: string; sections: Array<{ heading: string; body: string }>;
}) {
  const { scene, fontFamily, boldFontStyle, ui: UI } = context;
  const layer = scene.add.container(0, 0).setDepth(900).setName('combat-card-detail');
  const add = <T extends Phaser.GameObjects.GameObject>(object: T) => { layer.add(object); return object; };
  const text = (x: number, y: number, value: string, size = UI.bodySize as number, width = 664) =>
    add(scene.add.text(x, y, value, {
      fontFamily, fontSize: `${size}px`, color: UI.text, resolution: UI.resolution,
      wordWrap: { width, useAdvancedWrap: true }, lineSpacing: 4,
    }));
  // A full-stage hit surface prevents pointer-through, including outside the panel.
  add(scene.add.rectangle(640, 360, 1280, 720, 0x02070d, 0.78).setInteractive()
    .setName('combat-card-detail-shield'));
  add(scene.add.rectangle(640, 360, 760, 568, UI.surface, 1)
    .setStrokeStyle(1, UI.border, 1).setName('combat-card-detail-panel'));
  layer.setData('kind', content.kind);
  text(288, 100, `${content.kind === 'history' ? 'COMBAT HISTORY' : content.kind === 'waymark' ? 'WAYMARK DETAILS' : 'CARD DETAILS'} · READING ONLY`, UI.labelSize).setColor(UI.secondary);
  const title = text(288, 136, content.name, UI.titleSize, 550).setFontStyle(boldFontStyle)
    .setName('combat-card-detail-title');
  // Names have their own measured header, outside the rules viewport.
  const titleLines = title.getWrappedText();
  title.setText(titleLines.slice(0, 3).join('\n') + (titleLines.length > 3 ? '…' : ''));
  text(991, 140, content.badge, UI.labelSize, 135)
    .setOrigin(1, 0).setColor(UI.secondary);
  const headingY = Math.max(224, title.y + title.height + 20);
  add(scene.add.rectangle(640, headingY - 16, 704, 1, UI.border, 0.7));
  const heading = text(288, headingY, '', UI.labelSize).setColor('#ffe7b0').setFontStyle(boldFontStyle)
    .setName('combat-card-detail-heading');
  const body = text(288, headingY + 30, '').setName('combat-card-detail-body');
  const bodyBottom = 502;
  const pages: Array<{ heading: string; body: string }> = [];
  const sections = [...content.sections];
  // Preserve a very long title in full on its own page instead of silently losing it.
  if (titleLines.length > 3) sections.unshift({ heading: 'FULL NAME', body: content.name });
  for (const section of sections) {
    const lines = body.getWrappedText(section.body);
    let chunk: string[] = [];
    for (const line of lines) {
      body.setText([...chunk, line].join('\n'));
      if (body.y + body.height > bodyBottom && chunk.length) {
        pages.push({ heading: section.heading, body: chunk.join('\n') });
        chunk = [];
      }
      chunk.push(line);
    }
    if (chunk.length) pages.push({ heading: section.heading, body: chunk.join('\n') });
  }
  const pageLabel = text(640, 526, '', UI.labelSize, 200).setOrigin(0.5, 0).setColor(UI.secondary)
    .setName('combat-card-detail-page');
  let page = 0;
  const buttons: Phaser.GameObjects.Rectangle[] = [];
  const labels: Phaser.GameObjects.Text[] = [];
  const showPage = (index: number) => {
    page = Phaser.Math.Clamp(index, 0, pages.length - 1);
    heading.setText(pages[page].heading);
    body.setText(pages[page].body);
    pageLabel.setText(`${page + 1} / ${pages.length}`);
    layer.setData('page', page).setData('pageCount', pages.length).setData('pages', pages);
    layer.setData('heading', pages[page].heading).setData('body', pages[page].body);
    buttons.forEach((button, i) => {
      const enabled = i === 2 || (i === 0 ? page > 0 : page < pages.length - 1);
      button.setData('enabled', enabled).setAlpha(enabled ? 1 : 0.4);
      labels[i].setAlpha(enabled ? 1 : 0.4);
    });
    context.announce(`${content.name}. ${pages[page].heading}. Page ${page + 1} of ${pages.length}. ${pages[page].body}`);
  };
  const button = (x: number, label: string, name: string, action: () => void) => {
    const hit = add(scene.add.rectangle(x, 588, 210, context.minTouchTarget, UI.raised, 1)
      .setStrokeStyle(1, UI.border, 1).setInteractive({ useHandCursor: true }).setName(name));
    const caption = text(x, 588, label, UI.labelSize, 202).setOrigin(0.5).setFontStyle(boldFontStyle);
    hit.on('pointerover', () => { if (hit.getData('enabled')) hit.setStrokeStyle(2, UI.accent, 1); });
    hit.on('pointerout', () => hit.setStrokeStyle(1, UI.border, 1));
    hit.on('pointerdown', () => { if (hit.getData('enabled')) action(); });
    buttons.push(hit); labels.push(caption);
  };
  button(397, `Previous · ${context.previousLabel}`, 'combat-card-detail-previous', () => showPage(page - 1));
  button(640, `Next · ${context.nextLabel}`, 'combat-card-detail-next', () => showPage(page + 1));
  button(883, `Back · ${context.backLabel}`, 'combat-card-detail-close', context.onClose);
  layer.setData('updateBindings', (previous: string, next: string, back: string) => {
    labels[0].setText(`Previous · ${previous}`);
    labels[1].setText(`Next · ${next}`);
    labels[2].setText(`Back · ${back}`);
  });
  layer.setData('changePage', (delta: number) => showPage(page + delta));
  layer.setData('cardName', content.name);
  showPage(content.kind === 'history' ? pages.length - 1 : 0);
  return layer;
}

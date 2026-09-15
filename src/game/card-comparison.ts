import Phaser from 'phaser';
import { comparisonPagingHint } from './deck-review-hints';

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
  moltText?: string;
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

// Keep reading position across art arrival/redraw, but reset for a different pair.
const reading = new WeakMap<Phaser.Scene, { key: string; page: number }>();

// Multiset subtraction preserves repeated effects and their written conditions.
// Do not collapse conditional clauses into unconditional numeric promises.
function changedRules(before: string[], after: string[]) {
  const remaining = [...after];
  return before.filter(rule => {
    const index = remaining.indexOf(rule);
    if (index < 0) return true;
    remaining.splice(index, 1); return false;
  });
}

export function changeComparisonPage(scene: Phaser.Scene, delta: number) {
  scene.children.getByName('deck-review-comparison-panel')?.getData('changePage')?.(delta);
}

export function renderSceneCardComparison(scene: Phaser.Scene, view: SceneCardComparisonView) {
  const text = (x: number, y: number, value: string, size = 20, width = 270) => scene.add.text(x, y, value, {
    fontFamily: 'Arial', fontSize: `${size}px`, color: '#dce8f2', resolution: 2,
    wordWrap: { width, useAdvancedWrap: true }, lineSpacing: 3,
  });
  const panel = scene.add.rectangle(826, 377, 620, 426, 0x070b12, 0.99)
    .setStrokeStyle(1, 0x8df4ff, 0.42).setName('deck-review-comparison-panel');
  text(826, 183, view.title ?? 'CARD COMPARISON', 16, 570).setOrigin(0.5).setColor('#ffe1a3').setFontStyle('bold');
  scene.add.rectangle(826, 374, 1, 302, 0x8df4ff, 0.2);
  const cards = [view.pinned, view.selected];
  const headings = [view.leftHeading ?? 'PINNED', view.rightHeading ?? 'SELECTED'];
  const columns = cards.map((card, i) => {
    const x = 536 + i * 310;
    text(x, 210, headings[i], 15).setColor(i ? '#8df4ff' : '#ffc9f5').setFontStyle('bold');
    const art = card.artKey && scene.textures.exists(card.artKey) ? card.artKey
      : card.snagBorderKey && scene.textures.exists(card.snagBorderKey) ? card.snagBorderKey : undefined;
    scene.add.rectangle(x + 24, 268, 48, 72, 0x141f2f, 1).setStrokeStyle(1, card.accent, 0.5);
    if (art) scene.add.image(x + 24, 268, art).setDisplaySize(48, 72);
    const name = text(x + 62, 232, card.name, 20, 208).setColor('#ffe1a3').setFontStyle('bold');
    const lines = name.getWrappedText();
    let excerpt = lines.slice(0, 2).join('\n');
    name.setText(excerpt + (lines.length > 2 ? '…' : ''));
    while (name.height > 54 && excerpt.length) {
      excerpt = excerpt.slice(0, -1).trimEnd();
      name.setText(`${excerpt}…`);
    }
    if (view.costBadgeKey && scene.textures.exists(view.costBadgeKey)) {
      scene.add.image(x + 76, 296, view.costBadgeKey).setDisplaySize(30, 30)
        .setName('deck-review-comparison-cost-badge');
    }
    text(x + 76, 296, String(card.cost), 18, 30).setOrigin(0.5).setFontStyle('bold');
    text(x + 98, 286, 'Wingbeats', 16, 140).setColor('#b9c7d6');
    return {
      heading: text(x, 321, '', 15).setColor('#ffe1a3').setFontStyle('bold'),
      body: text(x, 347, '').setName(`deck-review-comparison-body-${i}`),
    };
  });
  const pages: Array<{ headings: string[]; bodies: string[] }> = [];
  const sections = cards.map(card => [
    { heading: card.currentLabel ?? (card.usesMolt ? 'NOW · MOLT' : 'NOW'), body: card.currentText },
    { heading: card.alternateLabel ?? (card.usesMolt ? 'BASE' : 'PREEN'), body: card.alternateText },
    ...(cards.some(entry => entry.moltText) ? [{ heading: 'MOLT RULES', body: card.moltText || 'No Molt ability.' }] : []),
    { heading: 'PASSIVE FLOCK BONUSES', body: card.stats.length ? card.stats.join('\n') : 'No passive contribution.' },
    { heading: 'CARD DETAILS', body: `${card.name}\n${card.bird} / ${card.label} / ${card.zone}\n${card.target} / ${card.role}` },
  ]);
  // Measure actual rendered height. Never shrink or silently cap authored rules.
  const paginate = (body: Phaser.GameObjects.Text, value: string) => {
    const chunks: string[] = [];
    let lines: string[] = [];
    for (const line of body.getWrappedText(value || 'None.')) {
      body.setText([...lines, line].join('\n'));
      if (body.getBounds().bottom > 502 && lines.length) { chunks.push(lines.join('\n')); lines = []; }
      lines.push(line);
    }
    if (lines.length) chunks.push(lines.join('\n'));
    return chunks;
  };
  const rules = cards.map(card => [
    ...card.currentText.split(/(?<=[.;])\s+/).filter(Boolean),
    ...card.stats.map(stat => `Passive: ${stat}`),
    ...(card.cost !== cards[0].cost || cards[0].cost !== cards[1].cost ? [`Cost: ${card.cost} Wingbeats`] : []),
    ...(cards[0].target !== cards[1].target ? [`Target: ${card.target}`] : []),
  ]);
  const changes = columns.map((column, i) => paginate(column.body,
    changedRules(rules[i], rules[1 - i]).join('\n') || 'No unique rules on this side.'));
  for (let i = 0; i < Math.max(...changes.map(side => side.length)); i++) {
    pages.push({ headings: ['REMOVED / REPLACED', 'ADDED / REPLACEMENT'],
      bodies: changes.map(side => side[i] ?? 'End of changes.') });
  }
  const moltRules = cards.map(card => (card.moltText ?? (/MOLT/.test(card.alternateLabel ?? '') ? card.alternateText : '')).split(/(?<=[.;])\s+/).filter(Boolean));
  if (moltRules[0].join(' ') !== moltRules[1].join(' ')) {
    const changes = columns.map((column, i) => paginate(column.body,
      changedRules(moltRules[i], moltRules[1 - i]).join('\n') || 'No unique Molt rules on this side.'));
    for (let i = 0; i < Math.max(...changes.map(side => side.length)); i++) {
      pages.push({ headings: ['MOLT · REMOVED / REPLACED', 'MOLT · ADDED / REPLACEMENT'], bodies: changes.map(side => side[i] ?? 'End of Molt changes.') });
    }
  }
  // Keep short active rules and passive contributions together. If either side
  // needs more room, retain the complete sectioned reader for both columns.
  const overview = cards.map(card => `${card.currentText}\n\nPassive: ${card.stats.length ? card.stats.join(' · ') : 'None.'}`);
  const compactOverview = columns.every((column, i) => paginate(column.body, overview[i]).length === 1);
  if (compactOverview) pages.push({ headings: sections.map(side => side[0].heading), bodies: overview });
  for (let section = 0; section < sections[0].length; section++) {
    if (compactOverview && (section === 0 || sections[0][section].heading === 'PASSIVE FLOCK BONUSES')) continue;
    const chunks = columns.map((column, i) => paginate(column.body, sections[i][section].body));
    for (let page = 0; page < Math.max(...chunks.map(chunk => chunk.length)); page++) {
      pages.push({ headings: sections.map(side => side[section].heading),
        bodies: chunks.map(chunk => chunk[page] ?? 'End of this section.') });
    }
  }
  const summaries = paginate(columns[0].body, view.summary);
  for (const body of summaries) pages.push({ headings: ['COMPARISON SUMMARY', 'READING ONLY'],
    bodies: [body, 'Pin the selected card to preview Base and Preened rules. No upgrade is applied here.'] });
  const key = JSON.stringify({ sections, costs: cards.map(card => card.cost), targets: cards.map(card => card.target) }) + view.summary;
  const state = reading.get(scene)?.key === key ? reading.get(scene)! : { key, page: 0 };
  reading.set(scene, state);
  const pageLabel = text(826, 539, '', 16, 150).setOrigin(0.5).setName('deck-review-comparison-page');
  const inputMode = scene.children.getByName('deck-review-control-guide')?.getData('inputMode') ?? 'pointer';
  text(826, 567, comparisonPagingHint(inputMode), 16, 260).setOrigin(0.5).setColor('#a9c6d5')
    .setName('deck-review-comparison-hint');
  const buttons: Phaser.GameObjects.Rectangle[] = [];
  const labels: Phaser.GameObjects.Text[] = [];
  const show = (delta: number) => {
    state.page = Phaser.Math.Clamp(state.page + delta, 0, pages.length - 1);
    const current = pages[state.page];
    columns.forEach((column, i) => { column.heading.setText(current.headings[i]); column.body.setText(current.bodies[i]); });
    pageLabel.setText(`${state.page + 1} / ${pages.length}`);
    panel.setData('reading', { page: state.page + 1, total: pages.length, headings: current.headings, bodies: current.bodies });
    buttons.forEach((button, i) => {
      const enabled = i ? state.page < pages.length - 1 : state.page > 0;
      button.setData('enabled', enabled).setAlpha(enabled ? 1 : 0.4);
      labels[i].setAlpha(enabled ? 1 : 0.4);
    });
  };
  [-1, 1].forEach((delta, i) => {
    const x = i ? 1042 : 610;
    const hit = scene.add.rectangle(x, 547, 140, 58, 0x152432, 1).setStrokeStyle(1, 0x8df4ff, 0.4)
      .setInteractive({ useHandCursor: true }).setName(`deck-review-comparison-${i ? 'next' : 'previous'}`);
    hit.on('pointerdown', () => { if (hit.getData('enabled')) show(delta); });
    hit.on('pointerover', () => { if (hit.getData('enabled')) hit.setStrokeStyle(2, 0x8df4ff, 1); });
    hit.on('pointerout', () => hit.setStrokeStyle(1, 0x8df4ff, 0.4));
    buttons.push(hit);
    labels.push(text(x, 547, i ? 'Next →' : '← Previous', 16, 132).setOrigin(0.5));
  });
  panel.setData('changePage', show);
  show(0);
}

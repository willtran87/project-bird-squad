import Phaser from 'phaser';
import { addRouteWaymarkScrollRailFrame, controlBindingLabel, playUiSound } from '../main';
import { decisionButton, decisionExcerpt, decisionText } from './decision-surface';
import { bindChoiceHint } from './choice-input-hints';
import { itemKeywordSections } from './keyword-definitions';

export interface SceneWaymarkReviewEntry {
  id: string; name: string; meta: string; trigger: string; description: string;
  effects: string[]; tags: string[]; accent: number; artKey?: string;
  flavorText: string; glyph: string; tileMeta: string; summary: string;
  family?: string; rarity?: string; source?: string; grammar?: string[];
}
export interface SceneWaymarkReviewView {
  selected: SceneWaymarkReviewEntry; pinned?: SceneWaymarkReviewEntry; onPin: () => void;
}
export interface SceneWaymarkDrawerView extends Omit<SceneWaymarkReviewView, 'selected'> {
  entries: SceneWaymarkReviewEntry[]; selected?: SceneWaymarkReviewEntry; scrollRow: number;
  onClose: () => void; onSelect: (id: string) => void; onScroll: (rows: number) => void;
}

type Reading = { page: number; total: number; headings: string[]; bodies: string[] };
const positions = new WeakMap<Phaser.Scene, { key: string; page: number }>();
const blocked = (scene: any) => !scene.waymarkDrawerOpen || scene.pauseOverlayOpen || scene.settingsOverlayOpen;
const readerPanel = (scene: any) => scene.root?.getByName('route-waymark-review-panel')
  ?? scene.children.getByName('route-waymark-review-panel');
const text = (scene: Phaser.Scene, x: number, y: number, value: string, width: number, size = 18, color = '#dce8f2') =>
  decisionText(scene, x, y, value, width, size, color);

function art(scene: Phaser.Scene, entry: SceneWaymarkReviewEntry, x: number, y: number, size: number) {
  if (entry.artKey && scene.textures.exists(entry.artKey)) {
    scene.textures.get(entry.artKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    scene.add.image(x, y, entry.artKey).setDisplaySize(size, size).setName('route-waymark-review-art');
  } else text(scene, x, y, entry.glyph, size, 22, '#ffe1a3').setOrigin(0.5);
}

export function changeWaymarkPage(scene: Phaser.Scene, delta: number) {
  if (blocked(scene)) return;
  readerPanel(scene)?.getData('turnRulesPage')?.(delta);
}

export function handleWaymarkWheel(scene: Phaser.Scene, pointer: Phaser.Input.Pointer, delta: number) {
  const panel = readerPanel(scene) as Phaser.GameObjects.Rectangle | null;
  if (!panel?.getBounds().contains(pointer.x, pointer.y)) return false;
  changeWaymarkPage(scene, delta > 0 ? 1 : -1);
  return true;
}

export function renderSceneWaymarkReview(scene: Phaser.Scene, view: SceneWaymarkReviewView) {
  const comparing = Boolean(view.pinned && view.pinned.id !== view.selected.id);
  const entries = comparing ? [view.pinned!, view.selected] : [view.selected];
  const panel = scene.add.rectangle(640, 511, 1008, 256, 0x070d15, 0.98)
    .setStrokeStyle(1, 0xc9a6ff, 0.4).setName('route-waymark-review-panel');
  const key = entries.map(e => e.id).join('|');
  let position = positions.get(scene);
  if (!position || position.key !== key) { position = { key, page: 0 }; positions.set(scene, position); }
  const bodies: Phaser.GameObjects.Text[] = [], headings: Phaser.GameObjects.Text[] = [];
  const entrySections = entries.map(entry => {
    const sections = [
      { title: 'EFFECT ORDER', text: entry.effects.map((effect, i) => `${i + 1}. ${effect}`).join('\n') || 'No additional effects.' },
      { title: 'TRIGGER', text: entry.trigger },
      { title: 'DESCRIPTION', text: entry.description },
      { title: 'DETAILS', text: `${entry.name}\n${entry.meta}\n${entry.tags.join(' / ') || 'General'}` },
      { title: 'FLAVOR', text: entry.flavorText },
    ];
    sections.push(...itemKeywordSections([
      { title: 'EFFECT', text: entry.description },
      { title: 'RULES', text: entry.summary },
    ]));
    return sections;
  });
  const sectionNames = [...new Set(entrySections.flatMap(sections => sections.map(section => section.title)))];
  const columns: string[][][] = [];
  entries.forEach((entry, index) => {
    const left = comparing ? 156 + index * 490 : 268;
    const width = comparing ? 444 : 844;
    art(scene, entry, comparing ? left + 25 : 198, comparing ? 419 : 510, comparing ? 50 : 100);
    const nameX = comparing ? left + 62 : left;
    decisionExcerpt(text(scene, nameX, comparing ? 414 : 402, entry.name,
      comparing ? width - 62 : width, comparing ? 20 : 24, '#ffe1a3').setFontStyle('bold'), 30);
    if (comparing) text(scene, nameX, 391, index === 0 ? 'PINNED' : 'SELECTED', width - 62, 16, index === 0 ? '#ffc9f5' : '#8df4ff');
    headings.push(text(scene, left, 449, '', width, 16, '#abc4d4'));
    const body = text(scene, left, 477, '', width, comparing ? 18 : 22).setName('route-waymark-reader-body');
    bodies.push(body);
    const sections = new Map(entrySections[index].map(section => [section.title, section.text]));
    columns.push(sectionNames.map(heading => {
      const value = sections.get(heading) ?? 'Not used by this Waymark.';
      const pages: string[] = []; let lines: string[] = [];
      for (const line of body.getWrappedText(value)) {
        body.setText([...lines, line].join('\n'));
        if (body.getBounds().bottom > 566 && lines.length) { pages.push(lines.join('\n')); lines = []; }
        lines.push(line);
      }
      if (lines.length && lines.join('').length) pages.push(lines.join('\n'));
      return pages;
    }));
  });
  // Align comparison sections even when one item needs more pages.
  const pages: Array<{ heading: string; bodies: string[] }> = [];
  sectionNames.forEach((heading, section) => {
    const count = Math.max(...columns.map(column => column[section].length));
    for (let page = 0; page < count; page++) pages.push({ heading,
      bodies: columns.map(column => column[section][page] ?? 'Section complete.') });
  });
  const label = text(scene, 640, 601, '', 190, 18, '#abc4d4').setOrigin(0.5);
  const show = (delta: number) => {
    if (delta && (blocked(scene) || !panel.active)) return;
    position!.page = (position!.page + delta + pages.length) % pages.length;
    const page = pages[position!.page];
    headings.forEach(heading => heading.setText(page.heading));
    bodies.forEach((body, i) => body.setText(page.bodies[i]));
    label.setText(`${position!.page + 1} / ${pages.length}`);
    panel.setData('reading', { page: position!.page + 1, total: pages.length,
      headings: entries.map(e => `${e.name} · ${page.heading}`), bodies: page.bodies } satisfies Reading);
    if (delta) (scene as any).updateTextState?.();
  };
  decisionButton(scene, 392, 601, 230, '← Previous', 'route-waymark-reader-previous', () => show(-1));
  decisionButton(scene, 880, 601, 230, 'Next →', 'route-waymark-reader-next', () => show(1));
  panel.setData('turnRulesPage', show); show(0);
}

export function renderSceneWaymarkDrawer(scene: Phaser.Scene, view: SceneWaymarkDrawerView, target?: Phaser.GameObjects.Container) {
  const previous = target ? new Set(scene.children.list) : undefined;
  renderDrawer(scene, view);
  // Combat owns all drawer objects through its root; route owns its display list.
  if (target) target.add(scene.children.list.filter(object => !previous!.has(object)));
}

function renderDrawer(scene: Phaser.Scene, view: SceneWaymarkDrawerView) {
  scene.add.rectangle(640, 360, 1280, 720, 0x020409, 0.88).setInteractive();
  scene.add.rectangle(640, 384, 1060, 618, 0x0b121d, 1)
    .setStrokeStyle(1, 0x8874a9, 0.7).setName('route-waymark-drawer-panel');
  const frame = { left: 110, top: 75, right: 1170 };
  text(scene, 148, 110, 'Found Waymarks', 650, 30, '#ffe1a3').setFontStyle('bold');
  text(scene, 148, 156, `${view.entries.length} artifacts carried this run`, 650, 18, '#abc4d4');
  const [, back] = decisionButton(scene, 1068, 159, 152, 'Back', 'route-waymark-close-hit',
    () => { if (!blocked(scene)) view.onClose(); });
  bindChoiceHint(scene, back, mode => mode === 'pointer' ? 'Back'
    : `Back · ${mode === 'controller' ? 'B' : controlBindingLabel('back')}`);
  if (!view.entries.length) { text(scene, 200, 260, 'No Waymarks found yet. Discover artifacts along your route.', 820, 22); return; }
  const columns = 3, visibleRows = 2, tileW = 252, tileH = 80;
  const startX = frame.left + 64, startY = frame.top + 128;
  const totalRows = Math.ceil(view.entries.length / columns), maxScrollRows = Math.max(0, totalRows - visibleRows);
  const scrollRow = Phaser.Math.Clamp(Math.round(view.scrollRow), 0, maxScrollRows);
  view.entries.slice(scrollRow * columns, (scrollRow + visibleRows) * columns).forEach((entry, index) => {
    const x = startX + index % columns * 272, y = startY + Math.floor(index / columns) * 88;
    const selected = view.selected?.id === entry.id;
    scene.add.rectangle(x + tileW / 2, y + tileH / 2, tileW, tileH, selected ? 0x18303b : 0x0b1520, 1)
      .setStrokeStyle(selected ? 3 : 1, selected ? entry.accent : 0x38505e, 1)
      .setName(`route-waymark-tile-${entry.id}`).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { if (!blocked(scene)) view.onSelect(entry.id); });
    art(scene, entry, x + 35, y + 40, 56);
    decisionExcerpt(text(scene, x + 72, y + 14, entry.name, tileW - 84, 18, '#ffe1a3').setFontStyle('bold')
      .setName('route-waymark-tile-name'), 50);
    if (view.pinned?.id === entry.id) text(scene, x + 10, y + 2, '●', 24, 16, '#ffc9f5');
  });
  if (maxScrollRows > 0) {
    for (const [delta, y, label] of [[-1, 232, '↑ Earlier'], [1, 342, 'Later ↓']] as const) {
      const enabled = delta < 0 ? scrollRow > 0 : scrollRow < maxScrollRows;
      const [hit, caption] = decisionButton(scene, 1052, y, 128, label,
        `route-waymark-shelf-${delta < 0 ? 'previous' : 'next'}`, () => {
          if (enabled && !blocked(scene)) view.onScroll(delta);
        });
      if (!enabled) { hit.disableInteractive().setAlpha(0.45); caption.setAlpha(0.5); }
    }
    text(scene, 1052, 287, `${scrollRow * columns + 1}–${Math.min(view.entries.length, (scrollRow + visibleRows) * columns)} / ${view.entries.length}`,
      144, 18, '#abc4d4').setOrigin(0.5).setName('route-waymark-shelf-position');
    // The generated frame adds 58px of end caps; keep those inside the shelf.
    const shelfH = visibleRows * 88 - 8, trackH = shelfH - 58;
    const trackX = frame.right - 38, trackY = startY + shelfH / 2;
    const thumbH = Math.max(34, trackH * (visibleRows / totalRows));
    const thumbY = trackY - trackH / 2 + thumbH / 2 + scrollRow / maxScrollRows * (trackH - thumbH);
    addRouteWaymarkScrollRailFrame(scene, () => {}, trackX, trackY, trackH, thumbY, thumbH);
  }
  const pin = view.pinned?.id === view.selected?.id;
  decisionButton(scene, 926, 159, 112, pin ? 'Unpin' : 'Pin', 'route-waymark-pin-hit', () => { if (!blocked(scene)) view.onPin(); });
  if (view.selected) renderSceneWaymarkReview(scene, { selected: view.selected, pinned: view.pinned, onPin: view.onPin });
  bindChoiceHint(scene, text(scene, 148, 650, '', 1020, 18, '#abc4d4').setName('route-waymark-reader-hints'),
    mode => mode === 'pointer' ? 'Choose an artifact to read · Pin one to compare'
      : mode === 'controller' ? 'D-pad: choose · X: pin · LB / RB: rules · B: back'
        : `${controlBindingLabel('previous')} / ${controlBindingLabel('next')}: choose · ${controlBindingLabel('roost')}: pin · PgUp / PgDn: rules · ${controlBindingLabel('back')}: back`);
}

type BattleReading = { entries: SceneWaymarkReviewEntry[]; selected?: string; pinned?: string };
const battles = new WeakMap<Phaser.Scene, BattleReading>();

export function resetBattleWaymarks(scene: Phaser.Scene) { battles.delete(scene); positions.delete(scene); }

export function battleWaymarkAction(scene: any, action: 'choose' | 'pin' | 'page', delta = 1) {
  if (blocked(scene)) return;
  if (action === 'page') { changeWaymarkPage(scene, delta); return; }
  const state = battles.get(scene);
  if (!state?.entries.length) return;
  if (action === 'pin') state.pinned = state.pinned === state.selected ? undefined : state.selected;
  else {
    const index = Math.max(0, state.entries.findIndex(entry => entry.id === state.selected));
    state.selected = state.entries[(index + delta % state.entries.length + state.entries.length) % state.entries.length].id;
    const row = Math.floor(state.entries.findIndex(entry => entry.id === state.selected) / 3);
    scene.waymarkDrawerScroll = Phaser.Math.Clamp(scene.waymarkDrawerScroll, Math.max(0, row - 1), row);
  }
  playUiSound('confirm'); scene.requestBattleRender();
}

export function battleWaymarkReading(scene: any) {
  const state = battles.get(scene);
  if (!scene.waymarkDrawerOpen || !state) return undefined;
  const entry = (id?: string) => {
    const item = state.entries.find(entry => entry.id === id);
    return item && { id: item.id, name: item.name, trigger: item.trigger,
      family: item.family ?? '', rarity: item.rarity ?? '', source: item.source ?? '',
      description: item.description, tags: item.tags,
      effects: item.effects.map((text, index) => ({ order: index + 1, text, grammar: item.grammar?.[index] ?? '' })) };
  };
  return { open: true, count: state.entries.length,
    scrollRow: scene.waymarkDrawerScroll,
    selectedIndex: Math.max(0, state.entries.findIndex(entry => entry.id === state.selected)),
    selected: entry(state.selected), pinned: entry(state.pinned),
    comparing: Boolean(state.pinned && state.pinned !== state.selected),
    reading: readerPanel(scene)?.getData('reading'), renderer: { requested: true, loaded: true, failed: false },
    controls: { select: 'Arrow keys / Tab / pointer', pin: controlBindingLabel('roost'), pinController: 'X', close: controlBindingLabel('back') } };
}

export function renderBattleWaymarks(scene: any, entries: SceneWaymarkReviewEntry[], onClose: () => void) {
  let state = battles.get(scene);
  if (!state) { state = { entries }; battles.set(scene, state); }
  state.entries = entries;
  if (!entries.some(entry => entry.id === state!.selected)) state.selected = entries[0]?.id;
  if (!entries.some(entry => entry.id === state!.pinned)) state.pinned = undefined;
  renderSceneWaymarkDrawer(scene, { entries,
    selected: entries.find(entry => entry.id === state!.selected),
    pinned: entries.find(entry => entry.id === state!.pinned), scrollRow: scene.waymarkDrawerScroll,
    onClose, onPin: () => battleWaymarkAction(scene, 'pin'),
    onScroll: rows => scene.scrollWaymarkDrawer(rows),
    onSelect: id => {
      if (blocked(scene) || state!.selected === id) return;
      state!.selected = id; playUiSound('confirm'); scene.requestBattleRender();
    },
  }, scene.root);
}

import type Phaser from 'phaser';
import { supplyCompactArtAssets, UI_FIELD } from '../main';
import { bindChoiceHint } from './choice-input-hints';
import { controlBindingLabel } from './input-bindings';
import { decisionButton, decisionExcerpt, decisionText } from './decision-surface';
import { cardKeywordSections } from './keyword-definitions';

type Reading = { page: number; total: number; title: string; text: string };
const readings = new WeakMap<Phaser.Scene, { key: string; page: number; reading?: Reading; turn?: (delta: number) => void }>();
export function supplyDrawerReading(scene: Phaser.Scene) { return readings.get(scene)?.reading; }
export function turnSupplyDrawerPage(scene: Phaser.Scene, delta = 1) { readings.get(scene)?.turn?.(delta); }

export interface RouteSupplyDrawerEntry {
  id?: string;
  glyph?: string;
  accent?: number;
  name?: string;
  summary?: string;
  timing?: 'route' | 'combat' | 'either';
  usable?: boolean;
}

export interface RouteSupplyDrawerView {
  entries: RouteSupplyDrawerEntry[];
  filled: number;
  capacity: number;
  focusIndex: number;
  inputActive: boolean;
  armedIndex?: number;
  confirmLabel: string;
  backLabel: string;
  addTo?: (object: Phaser.GameObjects.GameObject) => void;
  onClose: () => void;
  onActivate: (index: number) => void;
  onBrowse: (direction: -1 | 1) => void;
}

export function renderRouteSupplyDrawer(scene: Phaser.Scene, view: RouteSupplyDrawerView) {
  const add = <T extends Phaser.GameObjects.GameObject>(object: T): T => { view.addTo?.(object); return object; };
  const text = (x: number, y: number, value: string, width: number, size = 20, color = '#dbe8f2') =>
    add(decisionText(scene, x, y, value, width, size, color));
  const button = (x: number, width: number, label: string, name: string, action: () => void, y = 608) =>
    decisionButton(scene, x, y, width, label, `supply-drawer-${name}`, action).map(add);
  const timing = (entry: RouteSupplyDrawerEntry) => entry.timing === 'either' ? 'Route or combat' : entry.timing === 'route' ? 'Route only' : 'Combat only';
  add(scene.add.rectangle(640, 360, 1280, 720, 0x020409, 0.88).setInteractive());
  if (!view.entries.some(entry => entry.id)) {
    add(scene.add.rectangle(640, 360, 720, 340, 0x070d15, 1).setStrokeStyle(1, 0x536574, 0.8).setName('supply-drawer-frame'));
    text(312, 218, 'RUN KIT', 656, 16, '#abc4d4');
    text(312, 244, 'Packed Supplies', 656, 32, '#ffe1a3');
    text(312, 310, 'No Supplies packed', 656, 22);
    text(312, 354, 'Find tools at Caches, Basins and Markets.', 656, 20, '#abc4d4');
    button(640, 300, 'Close', 'close', view.onClose, 474);
    return;
  }
  add(scene.add.rectangle(640, 360, 1060, 600, 0x070d15, 1).setStrokeStyle(1, 0x536574, 0.8).setName('supply-drawer-frame'));
  text(142, 88, 'RUN KIT', 350, 16, '#abc4d4');
  text(142, 114, 'Packed Supplies', 670, 32, '#ffe1a3');
  text(1138, 127, `${view.filled} / ${view.capacity} packed`, 250, 20, '#abc4d4').setOrigin(1, 0.5);
  add(scene.add.rectangle(640, 168, 996, 1, 0x536574, 0.5));
  const entries = view.entries.map((entry, index) => ({ ...entry, index })).filter(entry => entry.id);
  const focus = entries.find(entry => entry.index === view.focusIndex) ?? entries[0];
  const start = Math.floor(Math.max(0, entries.findIndex(entry => entry.index === focus?.index)) / 4) * 4;
  entries.slice(start, start + 4).forEach((entry, rowIndex) => {
    const y = 230 + rowIndex * 84;
    const selected = focus?.index === entry.index;
    const armed = view.armedIndex === entry.index;
    const row = add(scene.add.rectangle(322, y, 360, 76, selected ? 0x14232e : 0x0b151f, 1)
      .setStrokeStyle(selected ? 2 : 1, armed ? UI_FIELD.gold : selected ? UI_FIELD.cyan : 0x344653, selected ? 0.9 : 0.5)
      .setInteractive({ useHandCursor: true }).setName(`supply-drawer-item-${entry.index}`));
    row.on('pointerdown', () => view.onActivate(entry.index));
    row.setData({ selected, armed });
    decisionExcerpt(text(158, y - 25, entry.name ?? entry.id!, 328, 20, selected ? '#ffe1a3' : '#dbe8f2'), 28).setName('supply-drawer-item-name');
    text(158, y + 5, armed ? 'Selected · Confirm to use' : timing(entry), 328, 16, armed ? '#ffe1a3' : '#abc4d4');
  });
  if (entries.length) {
    text(142, 542, entries.length > 4 ? `${start + 1}–${Math.min(start + 4, entries.length)} of ${entries.length} packed` : `${Math.max(0, view.capacity - view.filled)} open slot${view.capacity - view.filled === 1 ? '' : 's'}`, 360, 16, '#abc4d4');
    button(228, 172, '← Previous', 'previous', () => view.onBrowse(-1));
    button(416, 172, 'Next →', 'next', () => view.onBrowse(1));
  }
  add(scene.add.rectangle(526, 376, 1, 368, 0x536574, 0.35));
  if (focus) {
    const key = supplyCompactArtAssets[focus.id!]?.key;
    if (key && scene.textures.exists(key)) add(scene.add.image(594, 234, key).setDisplaySize(80, 80));
    else text(594, 234, focus.glyph ?? '◇', 80, 32, '#ffe1a3').setOrigin(0.5);
    const fullName = focus.name ?? focus.id!;
    const title = decisionExcerpt(text(654, 194, fullName, 484, 26, '#ffe1a3'), 70).setName('supply-drawer-title');
    text(654, 270, `${timing(focus)} · Single use`, 484, 18, '#abc4d4');
    const heading = text(554, 306, '', 584, 16, '#abc4d4').setName('supply-drawer-heading');
    const body = text(554, 332, '', 584, 22).setName('supply-drawer-rules');
    const sections = [{ heading: 'EFFECT', body: focus.summary || 'No additional rules.' },
      ...cardKeywordSections(focus.summary ?? ''),
      ...(title.text !== fullName ? [{ heading: 'FULL NAME', body: fullName }] : [])];
    const pages: Array<{ title: string; text: string }> = [];
    for (const section of sections) {
      let lines: string[] = [];
      for (const line of body.getWrappedText(section.body)) {
        body.setText([...lines, line].join('\n'));
        if (body.getBounds().bottom > 444 && lines.length) {
          pages.push({ title: section.heading, text: lines.join('\n') }); lines = [];
        }
        lines.push(line);
      }
      if (lines.length) pages.push({ title: section.heading, text: lines.join('\n') });
    }
    const readingKey = JSON.stringify([focus.index, focus.id, sections]);
    const state = readings.get(scene)?.key === readingKey ? readings.get(scene)! : { key: readingKey, page: 0 };
    readings.set(scene, state);
    const pageLabel = text(846, 480, '', 176, 16, '#abc4d4').setOrigin(0.5);
    const owner = scene as Phaser.Scene & { pauseOverlayOpen?: boolean; settingsOverlayOpen?: boolean; updateTextState?: () => void };
    const turn = (delta: number) => {
      if (delta && (owner.pauseOverlayOpen || owner.settingsOverlayOpen)) return;
      state.page = (state.page + delta + pages.length) % pages.length;
      state.reading = { ...pages[state.page], page: state.page + 1, total: pages.length };
      heading.setText(state.reading.title); body.setText(state.reading.text);
      pageLabel.setText(pages.length > 1 ? `${state.page + 1} / ${pages.length}` : '');
      if (delta) owner.updateTextState?.();
    };
    state.turn = turn;
    body.once('destroy', () => { if (state.turn === turn) { state.turn = undefined; state.reading = undefined; } });
    if (pages.length > 1) {
      button(644, 180, '← Read back', 'read-previous', () => turn(-1), 480);
      button(1048, 180, 'Read more →', 'read-next', () => turn(1), 480);
    }
    turn(0);
    const armed = view.armedIndex === focus.index;
    const hint = text(554, 526, '', 584, 18, armed ? '#ffe1a3' : '#abc4d4').setName('supply-drawer-command-copy');
    bindChoiceHint(scene, hint, mode => {
      const read = pages.length > 1 && mode !== 'pointer' ? `\n${mode === 'controller' ? 'Y' : controlBindingLabel('roost')}: read more` : '';
      if (!focus.usable) return `Keep packed · Use ${focus.timing === 'route' ? 'on the route' : 'in combat'}.${read}`;
      if (mode === 'pointer') return armed ? 'Confirm use, or cancel to keep it packed.' : 'Select an item, then confirm to use it.';
      const confirm = mode === 'controller' ? 'A' : view.confirmLabel;
      const back = mode === 'controller' ? 'B' : view.backLabel;
      const move = mode === 'controller' ? 'D-pad' : `${controlBindingLabel('previous')}/${controlBindingLabel('next')}`;
      return `${move}: browse · ${confirm}: ${armed ? 'use' : 'select'} · ${back}: ${armed ? 'cancel' : 'close'}${read}`;
    });
    if (focus.usable) button(705, 302, armed ? 'Confirm use' : 'Select Supply', 'use', () => view.onActivate(focus.index));
  }
  button(1007, 262, view.armedIndex === undefined ? 'Close' : 'Cancel selection', 'close', view.onClose);
}

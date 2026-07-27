import Phaser from 'phaser';

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
const UI_FONT = 'Arial';
const UI_BOLD = 'bold';
const UI_GOLD = '#ffe1a3';
const UI_SOFT = '#b9c7d6';
const UI_FIELD = {
  gold: 0xd8a840,
  cyan: 0x7ab8d6,
  warm: '#ffe1a3',
};

type AddTo = (object: Phaser.GameObjects.GameObject) => void;
type FieldFrame = {
  cx: number;
  cy: number;
  w: number;
  h: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
};
type RenderFieldPanel = (
  scene: Phaser.Scene,
  addTo: AddTo,
  cx: number,
  cy: number,
  w: number,
  h: number,
  options?: { title?: string; subtitle?: string; accent?: number; fill?: number; eyebrow?: string },
) => FieldFrame;
type RenderCloseControl = (
  scene: Phaser.Scene,
  addTo: AddTo,
  x: number,
  y: number,
  onClick: () => void,
) => unknown;

export interface FlockStatRow {
  label: string;
  base: number;
  bonus: number;
  total: number;
}

export interface RouteFlockStatsContext {
  scene: Phaser.Scene;
  rows: FlockStatRow[];
  renderFieldPanel: RenderFieldPanel;
  renderCloseControl: RenderCloseControl;
  onClose: () => void;
  reducedMotion: boolean;
}

export interface BattleFlockStatsContext {
  scene: Phaser.Scene;
  root: Phaser.GameObjects.Container;
  rows: FlockStatRow[];
  battleRows: Array<[string, string]>;
  renderFieldPanel: RenderFieldPanel;
  renderCloseControl: RenderCloseControl;
  onClose: () => void;
  reducedMotion: boolean;
}

function textureKey(id: string) {
  return `ui-icon-${id}`;
}

function tableHeaderStyle(): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: UI_FONT, fontSize: '14px', fontStyle: UI_BOLD, color: '#91a6b8' };
}

function tableCellStyle(color: string): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: UI_FONT, fontSize: '16px', fontStyle: UI_BOLD, color };
}

function addFrame(
  scene: Phaser.Scene,
  addTo: AddTo,
  id: string,
  cx: number,
  cy: number,
  width: number,
  height: number,
  alpha: number,
) {
  const key = textureKey(id);
  if (!scene.textures.exists(key)) return undefined;
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  const frame = scene.add.image(cx, cy, key)
    .setDisplaySize(width, height)
    .setAlpha(alpha)
    .setName(id);
  addTo(frame);
  return frame;
}

function addFlourish(
  scene: Phaser.Scene,
  addTo: AddTo,
  frame: Pick<FieldFrame, 'cx' | 'cy' | 'w' | 'h'>,
  alpha: number,
  yOffset: number,
  reducedMotion: boolean,
) {
  const key = textureKey('flock-stats-flourish');
  if (!scene.textures.exists(key)) return;
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  const flourish = scene.add.image(frame.cx, frame.cy + yOffset, key)
    .setDisplaySize(Math.min(frame.w - 46, 1040), Math.min(frame.h - 34, 560))
    .setAlpha(reducedMotion ? Math.min(alpha, 0.09) : alpha)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setName('flock-stats-flourish');
  addTo(flourish);
  if (!reducedMotion) {
    scene.tweens.add({
      targets: flourish,
      alpha: alpha * 0.68,
      scaleX: flourish.scaleX * 1.008,
      scaleY: flourish.scaleY * 1.008,
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}

function renderFlockStatTable(
  scene: Phaser.Scene,
  addTo: AddTo,
  rows: FlockStatRow[],
  leftX: number,
  topY: number,
) {
  const headerFrameKey = textureKey('flock-stats-header-frame');
  if (scene.textures.exists(headerFrameKey)) {
    scene.textures.get(headerFrameKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    addTo(scene.add.image(leftX + 270, topY + 20, headerFrameKey)
      .setDisplaySize(566, 30)
      .setAlpha(0.42)
      .setName('flock-stats-header-frame'));
  } else {
    addTo(scene.add.rectangle(leftX + 270, topY + 14, 540, 28, 0x07101c, 0.18)
      .setStrokeStyle(1, UI_FIELD.gold, 0.18)
      .setName('flock-stats-header-frame-fallback'));
  }
  addTo(scene.add.text(leftX, topY, 'Stat', tableHeaderStyle()));
  addTo(scene.add.text(leftX + 232, topY, 'Base', tableHeaderStyle()));
  addTo(scene.add.text(leftX + 330, topY, 'Flock', tableHeaderStyle()));
  addTo(scene.add.text(leftX + 446, topY, 'Now', tableHeaderStyle()));
  addTo(scene.add.rectangle(leftX + 270, topY + 25, 540, 1, UI_FIELD.gold, 0.28));
  const rowFrameKey = textureKey('flock-stats-row-frame');
  const hasRowFrame = scene.textures.exists(rowFrameKey);
  if (hasRowFrame) scene.textures.get(rowFrameKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
  rows.forEach((row, index) => {
    const y = topY + 37 + index * 33;
    if (hasRowFrame) {
      const frame = scene.add.image(leftX + 270, y + 10, rowFrameKey)
        .setDisplaySize(566, 34)
        .setAlpha(row.bonus > 0 ? 0.56 : 0.42)
        .setName('flock-stats-row-frame');
      if (row.bonus > 0) frame.setTint(0xdffbff);
      addTo(frame);
    } else {
      addTo(scene.add.rectangle(leftX + 270, y + 11, 540, 26, 0x07101c, row.bonus > 0 ? 0.38 : 0.24)
        .setStrokeStyle(1, row.bonus > 0 ? UI_FIELD.cyan : 0xffffff, row.bonus > 0 ? 0.32 : 0.08)
        .setName('flock-stats-row-frame-fallback'));
    }
    addTo(scene.add.rectangle(leftX + 270, y + 25, 540, 1, 0xffffff, index % 2 === 0 ? 0.08 : 0.04));
    if (row.bonus > 0) addTo(scene.add.rectangle(leftX - 8, y + 9, 3, 18, UI_FIELD.cyan, 0.82));
    addTo(scene.add.text(leftX, y, row.label, tableCellStyle('#ffe1a3')));
    addTo(scene.add.text(leftX + 240, y, `${row.base}`, tableCellStyle('#dce8f2')));
    addTo(scene.add.text(leftX + 338, y, row.bonus > 0 ? `+${row.bonus}` : `${row.bonus}`, tableCellStyle(row.bonus > 0 ? '#8df4ff' : '#91a6b8')));
    addTo(scene.add.text(leftX + 454, y, `${row.total}`, tableCellStyle('#ffffff')));
  });
}

export function renderRouteFlockStats(context: RouteFlockStatsContext) {
  const { scene, rows, onClose } = context;
  const addTo: AddTo = () => {};
  scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.78)
    .setInteractive({ useHandCursor: false });
  const panelW = 820;
  const panelH = 540;
  const panelX = GAME_WIDTH / 2;
  const panelY = GAME_HEIGHT / 2;
  const frame = context.renderFieldPanel(scene, addTo, panelX, panelY, panelW, panelH, {
    eyebrow: 'Crew Dossier',
    accent: UI_FIELD.cyan,
  });
  addFlourish(scene, addTo, frame, 0.11, 8, context.reducedMotion);
  const titleCx = frame.left + 330;
  const titleCy = frame.top + 56;
  addFrame(scene, addTo, 'flock-stats-title-plaque', titleCx, titleCy, 560, 86, 0.58);
  scene.add.text(titleCx, titleCy - 6, 'Flock Stats', {
    fontFamily: UI_FONT,
    fontSize: '28px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.warm,
    stroke: '#020409',
    strokeThickness: 3,
  }).setOrigin(0.5);
  addFrame(scene, addTo, 'flock-stats-caption-frame', titleCx, titleCy + 60, 520, 34, 0.4);
  scene.add.text(titleCx, titleCy + 60, 'Passive bonuses from owned cards. Build them up across the run.', {
    fontFamily: UI_FONT,
    fontSize: '14px',
    color: UI_SOFT,
    align: 'center',
    wordWrap: { width: 460 },
  }).setOrigin(0.5);
  renderFlockStatTable(scene, addTo, rows, 390, frame.top + 124);
  context.renderCloseControl(scene, addTo, frame.right - 72, frame.top + 54, onClose);
}

export function renderBattleFlockStats(context: BattleFlockStatsContext) {
  const { scene, root, rows, battleRows, onClose, reducedMotion } = context;
  const addTo: AddTo = (object) => root.add(object);
  addTo(scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.76)
    .setInteractive({ useHandCursor: false }));
  const frame = context.renderFieldPanel(scene, addTo, 640, 360, 1060, 570, {
    accent: UI_FIELD.cyan,
  });
  addFlourish(scene, addTo, frame, 0.1, 10, reducedMotion);
  context.renderCloseControl(scene, addTo, frame.right - 76, frame.top + 56, onClose);

  const headerCx = 390;
  const headerCy = 100;
  addFrame(scene, addTo, 'flock-stats-title-plaque', headerCx, headerCy, 560, 86, 0.5);
  addTo(scene.add.text(headerCx, headerCy - 7, 'Flock Stats', {
    fontFamily: UI_FONT, fontSize: '32px', fontStyle: UI_BOLD, color: UI_GOLD,
  }).setOrigin(0.5));
  addFrame(scene, addTo, 'flock-stats-caption-frame', headerCx, headerCy + 53, 520, 34, 0.38);
  addTo(scene.add.text(headerCx, headerCy + 53, 'Base values plus passive stats from owned cards.', {
    fontFamily: UI_FONT, fontSize: '16px', color: UI_SOFT, align: 'center', wordWrap: { width: 460 },
  }).setOrigin(0.5));
  renderFlockStatTable(scene, addTo, rows, 140, 168);
  addFrame(scene, addTo, 'flock-stats-footer-frame', 405, 566, 540, 36, 0.36);
  addTo(scene.add.text(140, 558, 'Flock Stats update when cards join, leave, or are preened.', {
    fontFamily: UI_FONT, fontSize: '15px', color: '#91a6b8',
  }));

  const rx = 720;
  const tallyFrameKey = textureKey('combat-stats-tally-frame');
  const tallyFrameX = rx + 254;
  const tallyFrameY = 310;
  const tallyFrameW = 286;
  const tallyFrameH = 338;
  if (scene.textures.exists(tallyFrameKey)) {
    scene.textures.get(tallyFrameKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    addTo(scene.add.image(tallyFrameX, tallyFrameY, tallyFrameKey)
      .setDisplaySize(tallyFrameW, tallyFrameH)
      .setAlpha(0.56)
      .setName('combat-stats-tally-frame'));
    if (!reducedMotion) {
      const glint = scene.add.image(tallyFrameX, tallyFrameY, tallyFrameKey)
        .setDisplaySize(tallyFrameW, tallyFrameH)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.035)
        .setName('combat-stats-tally-frame');
      addTo(glint);
      scene.tweens.add({
        targets: glint,
        alpha: 0.02,
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  } else {
    addTo(scene.add.rectangle(tallyFrameX, tallyFrameY + 8, tallyFrameW - 22, 286, 0x07101c, 0.56)
      .setStrokeStyle(1, UI_FIELD.cyan, 0.42)
      .setName('combat-stats-tally-frame-fallback'));
  }
  const tallyTitlePlaqueKey = textureKey('combat-stats-tally-title-plaque');
  if (scene.textures.exists(tallyTitlePlaqueKey)) {
    scene.textures.get(tallyTitlePlaqueKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    addTo(scene.add.image(rx + 132, 178, tallyTitlePlaqueKey)
      .setDisplaySize(318, 54)
      .setAlpha(0.38)
      .setName('combat-stats-tally-title-plaque'));
  } else {
    addTo(scene.add.rectangle(rx + 132, 181, 300, 30, 0x07101c, 0.2)
      .setStrokeStyle(1, UI_FIELD.cyan, 0.12)
      .setName('combat-stats-tally-title-plaque-fallback'));
  }
  addTo(scene.add.text(rx, 168, 'This Combat', tableHeaderStyle()));
  const tallyRowFrameKey = textureKey('combat-stats-tally-row-frame');
  const hasTallyRowFrame = scene.textures.exists(tallyRowFrameKey);
  if (hasTallyRowFrame) scene.textures.get(tallyRowFrameKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
  battleRows.forEach((row, index) => {
    const y = 215 + index * 36;
    if (hasTallyRowFrame) {
      addTo(scene.add.image(rx + 132, y + 12, tallyRowFrameKey)
        .setDisplaySize(314, 30)
        .setAlpha(index % 2 === 0 ? 0.34 : 0.28)
        .setName('combat-stats-tally-row-frame'));
    } else {
      addTo(scene.add.rectangle(rx + 132, y + 13, 300, 24, 0x07101c, 0.18)
        .setStrokeStyle(1, 0xffffff, 0.06)
        .setName('combat-stats-tally-row-frame-fallback'));
    }
    addTo(scene.add.rectangle(rx + 132, y + 29, 300, 1, 0xffffff, index % 2 === 0 ? 0.08 : 0.04));
    addTo(scene.add.text(rx, y, row[0], tableCellStyle('#cdd9e6')));
    addTo(scene.add.text(rx + 260, y, row[1], { ...tableCellStyle('#ffffff'), align: 'right' }).setOrigin(1, 0));
  });
}

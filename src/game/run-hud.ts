import Phaser from 'phaser';
import { addUi, addUiIconImage, flowHudPresentation, FLOCK_HP_BAR, FLOW_HUD_X_OFFSET, FLOW_HUD_Y_OFFSET, FLOW_HUD_WIDTH, FLOW_HUD_HEIGHT, FLOW_HUD_PIP_OFFSET, FLOW_HUD_PIP_GAP, GAME_WIDTH, KEYSTONE_AT, prefersReducedMotion, uiIconAssets, type UnifiedRunHudData, type UiAdd, type UiIconId } from '../main';
import { UI_FIELD, UI_FONT, UI_BOLD, UI_GOLD, UI_DISPLAY_FONT as TOKEN_DISPLAY_FONT, MIN_SUPPORTED_TOUCH_TARGET } from './theme';
import { KEYWORDS, keywordIconId } from './keyword-definitions';
import { renderPracticeBadge, practiceHudOffset } from './practice-session';

export function renderRouteDistrictBanner(scene: Phaser.Scene, title: string) {
  scene.add.rectangle(382, 158, 650, 42, 0x07101a, 0.96)
    .setStrokeStyle(1, UI_FIELD.brass, 0.58).setName('route-district-banner');
  scene.add.text(382, 158, title, {
    fontFamily: TOKEN_DISPLAY_FONT, fontSize: '21px', fontStyle: UI_BOLD,
    color: UI_GOLD, align: 'center', fixedWidth: 626, maxLines: 1,
  }).setOrigin(0.5);
}

export function renderRouteMapFrame(scene: Phaser.Scene, { cx, cy, w, h }: { cx: number; cy: number; w: number; h: number }) {
  const accent = 0x49606d;
  const key = uiIconAssets['route-map-frame'].key;
  if (scene.textures.exists(key)) {
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    scene.add.nineslice(cx, cy, key, undefined, w, h, 64, 64, 42, 42).setAlpha(0.14).setName('route-map-frame');
    return;
  }
  const left = cx - w / 2, right = cx + w / 2, top = cy - h / 2, bottom = cy + h / 2, corner = 28;
  scene.add.rectangle(cx, top + 14, w - 34, 2, accent, 0.72);
  scene.add.rectangle(cx, bottom - 14, w - 34, 1, 0xffffff, 0.08);
  [
    [left + 15, top + 15, corner, 2], [left + 15, top + 15, 2, corner],
    [right - 15, top + 15, corner, 2], [right - 15, top + 15, 2, corner],
    [left + 15, bottom - 15, corner, 2], [left + 15, bottom - 15, 2, corner],
    [right - 15, bottom - 15, corner, 2], [right - 15, bottom - 15, 2, corner],
  ].forEach(([x, y, cw, ch], index) => {
    const ox = index === 2 || index === 6 ? -corner : 0;
    const oy = index === 5 || index === 7 ? -corner : 0;
    scene.add.rectangle(x + ox, y + oy, cw, ch, accent, 0.72).setOrigin(0, 0);
  });
}

export function renderRouteGuidance(context: {
  scene: Phaser.Scene;
  text: string;
  name: string;
  selected: boolean;
  fontFamily: string;
  boldFontStyle: string;
  goldColor: number;
  cyanColor: number;
}) {
  context.scene.add.rectangle(382, 104, 650, 48, 0x06111a, 0.96)
    .setStrokeStyle(1, context.selected ? context.goldColor : context.cyanColor, 0.65)
    .setName(context.name);
  context.scene.add.text(382, 104, context.text, {
    fontFamily: context.fontFamily,
    fontSize: '18px',
    fontStyle: context.boldFontStyle,
    color: '#e7fbff',
    fixedWidth: 620,
    align: 'left',
    wordWrap: { width: 620, useAdvancedWrap: true },
  }).setOrigin(0.5).setResolution(2).setName(context.name);
}

// Shared Route/Battle presentation. Imported only by their existing lazy renderers.
function hudIconForLabel(label: string): UiIconId | undefined {
  const term = label === 'Wingbeats' ? 'Wingbeat' : label;
  if (KEYWORDS[term]) return keywordIconId(term);
  switch (label) {
    case 'Scrap': return 'scrap-gear';
    case 'Deck': return 'deck-stack';
    case 'Waymarks': return 'waymark-compass';
    case 'Supplies': return 'supply-pouch';
    default: return undefined;
  }
}

export function renderUnifiedRunHud(
  scene: Phaser.Scene,
  addTo: UiAdd,
  data: UnifiedRunHudData
) {
  renderPracticeBadge(scene);
  const offset = data.context === 'battle' ? practiceHudOffset() : 0;
  if (offset) {
    const attach = addTo;
    addTo = (obj) => {
      const positioned = obj as Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform;
      positioned.y += offset;
      attach(obj);
    };
  }
  const accent = data.statusColor ? Phaser.Display.Color.HexStringToColor(data.statusColor).color : UI_FIELD.gold;
  const highlight = data.statusLabel && !['ROUTE', 'HOLDING'].includes(data.statusLabel);
  if (data.context !== 'battle' && data.railIcon && scene.textures.exists(uiIconAssets[data.railIcon].key)) {
    scene.textures.get(uiIconAssets[data.railIcon].key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    const rail = scene.add.image(GAME_WIDTH / 2, 47, uiIconAssets[data.railIcon].key)
      .setDisplaySize(1284, 118)
      .setAlpha(prefersReducedMotion() ? 0.42 : 0.54);
    addUi(addTo, rail);
    if (!prefersReducedMotion()) {
      scene.tweens.add({
        targets: rail,
        alpha: 0.42,
        scaleX: rail.scaleX * 1.004,
        scaleY: rail.scaleY * 1.006,
        duration: 2100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
  }
  const battleHud = data.context === 'battle';
  addUi(addTo, scene.add.rectangle(GAME_WIDTH / 2, battleHud ? 56 : 47, GAME_WIDTH - 28, battleHud ? 80 : 62, 0x070b12, battleHud ? 0.94 : 0.78)
    .setStrokeStyle(1, accent, battleHud ? 0.10 : highlight ? 0.78 : 0.26)
    .setName('run-hud-surface'));
  addUi(addTo, scene.add.rectangle(GAME_WIDTH / 2, 16, GAME_WIDTH - 62, 2, accent, battleHud ? 0.12 : highlight ? 0.82 : 0.32));
  addUi(addTo, scene.add.rectangle(GAME_WIDTH / 2, battleHud ? 96 : 76, GAME_WIDTH - 62, 1, 0xffffff, 0.08));

  const [hp, maxHp] = parseHudRatio(data.cohesion);
  const hpFrac = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  const hpLeft = FLOCK_HP_BAR.x - FLOCK_HP_BAR.w / 2;
  addUi(addTo, scene.add.rectangle(FLOCK_HP_BAR.x, FLOCK_HP_BAR.y, FLOCK_HP_BAR.w, FLOCK_HP_BAR.h, 0x0e1a12, 0.95)
    .setStrokeStyle(1, 0x000000, 0.5));
  addUi(addTo, scene.add.rectangle(
    hpLeft + (FLOCK_HP_BAR.w * hpFrac) / 2,
    FLOCK_HP_BAR.y,
    Math.max(2, FLOCK_HP_BAR.w * hpFrac),
    FLOCK_HP_BAR.h - 6,
    hpFrac > 0.34 ? 0x4fa777 : 0xe2b24a,
    0.95
  ));
  if (data.context !== 'battle') addUi(addTo, scene.add.rectangle(FLOCK_HP_BAR.x, FLOCK_HP_BAR.y,
    FLOCK_HP_BAR.w, FLOCK_HP_BAR.h, 0, 0).setStrokeStyle(1, 0x49606d, 0.8)
    .setName('combat-cohesion-gauge-frame'));
  const incoming = data.incoming;
  if (incoming && incoming.hpLoss > 0 && maxHp > 0) {
    const afterFrac = Math.max(0, Math.min(1, incoming.afterHp / maxHp));
    const currentX = hpLeft + FLOCK_HP_BAR.w * hpFrac;
    const afterX = hpLeft + FLOCK_HP_BAR.w * afterFrac;
    const riskW = Math.max(2, currentX - afterX);
    addUi(addTo, scene.add.rectangle(afterX + riskW / 2, FLOCK_HP_BAR.y, riskW, FLOCK_HP_BAR.h - 6, 0x913f3e, 0.8)
      .setName('combat-incoming-forecast-risk'));
    const riskHatch = scene.add.graphics().setName('combat-incoming-forecast-hatch');
    riskHatch.lineStyle(1, 0xffc6ae, 0.42);
    for (let hatchX = afterX + 3; hatchX < currentX - 3; hatchX += 8) {
      riskHatch.lineBetween(hatchX, FLOCK_HP_BAR.y + 10, Math.min(hatchX + 6, currentX - 2), FLOCK_HP_BAR.y - 10);
    }
    addUi(addTo, riskHatch);
    addUi(addTo, scene.add.rectangle(afterX, FLOCK_HP_BAR.y, 2, FLOCK_HP_BAR.h + 4, 0xffd0c9, 0.78)
      .setName('combat-incoming-forecast-marker'));
    const forecastKey = uiIconAssets['combat-incoming-forecast-frame'].key;
    const fx = FLOCK_HP_BAR.x;
    const fy = FLOCK_HP_BAR.y + 33;
    if (data.context !== 'battle' && scene.textures.exists(forecastKey)) {
      scene.textures.get(forecastKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
      addUi(addTo, scene.add.image(fx, fy, forecastKey)
        .setDisplaySize(188, 38)
        .setAlpha(0.9)
        .setName('combat-incoming-forecast-frame'));
    } else {
      addUi(addTo, scene.add.rectangle(fx, fy, 188, 30, battleHud ? 0x070b12 : 0x180807, battleHud ? 0 : 0.82)
        .setStrokeStyle(battleHud ? 0 : 1, 0xff6f6f, 0.7)
        .setName('combat-incoming-forecast-frame-fallback'));
    }
    const forecastMath = `${incoming.uncertainty?.length ? 'Est. ' : ''}${incoming.hpLoss} Cohesion at risk`;
    const forecastLabel = scene.add.text(fx, fy, battleHud
      ? `${incoming.uncertainty?.length ? 'Est. ' : ''}−${incoming.hpLoss} HP · ${incoming.afterHp} left`
      : `${forecastMath}\n${incoming.afterHp} Cohesion left`, {
      fontFamily: UI_FONT,
      fontSize: battleHud ? '19px' : '13px',
      fontStyle: UI_BOLD,
      color: '#ffe5dd',
      stroke: '#180807',
      strokeThickness: battleHud ? 0 : 3,
      resolution: 2,
      align: 'center',
      lineSpacing: 0,
      maxLines: 2
    }).setOrigin(0.5).setName('combat-incoming-forecast-label')
      .setData('fullText', `${forecastMath}; ${incoming.afterHp} Cohesion left`);
    // Keep the actionable loss legible in its lane. The complete remaining-HP
    // projection is also available in the Roost detail tooltip.
    if (battleHud && forecastLabel.width > 188) {
      forecastLabel.setText(`${incoming.uncertainty?.length ? 'Est. ' : ''}−${incoming.hpLoss} HP`);
    }
    addUi(addTo, forecastLabel);
  }
  const flockIcon = addUiIconImage(scene, 'flock-heart', hpLeft, FLOCK_HP_BAR.y + 1, 28);
  if (flockIcon) addUi(addTo, flockIcon);
  addUi(addTo, scene.add.text(FLOCK_HP_BAR.x, FLOCK_HP_BAR.y, `${data.cohesion}`, {
    fontFamily: UI_FONT,
    fontSize: '21px',
    fontStyle: UI_BOLD,
    color: '#eaf6ee',
    stroke: '#0a1410',
    strokeThickness: 3
  }).setOrigin(0.5).setName('hud-value-Cohesion'));
  if (data.onFlock) {
    const cohesionHit = addUi(addTo, scene.add.rectangle(
      FLOCK_HP_BAR.x,
      FLOCK_HP_BAR.y,
      Math.max(FLOCK_HP_BAR.w, MIN_SUPPORTED_TOUCH_TARGET),
      MIN_SUPPORTED_TOUCH_TARGET,
      0x020409,
      0.001,
    ).setInteractive({ useHandCursor: true })
      .setName('hud-cohesion-hit'));
    cohesionHit.on('pointerdown', data.onFlock);
  }

  const cover = data.cover ?? 0;
  const contextualMetrics = data.context === 'route'
    ? []
    : [
        { label: 'Cover', value: `${cover}`, width: 108, color: 0x7ab8d6, text: '#dffbff', icon: 'cover-shield' as UiIconId },
        { label: 'Wingbeats', value: `${data.wingbeats ?? '0/3'}`, width: 118, color: 0xf5d38a, text: '#ffe7a8', icon: 'wingbeats' as UiIconId },
        ...(`${data.resonance ?? '0/5'}` !== '0/5' ? [{ label: 'Resonance', value: `${data.resonance}`, width: 118, color: 0x8df4ff, text: '#dffbff', icon: 'resonance-battery' as UiIconId }] : [])
      ];
  let contextualX = hpLeft + FLOCK_HP_BAR.w + 10;
  contextualMetrics.forEach((metric) => {
    renderHudMetricChip(scene, addTo, contextualX + metric.width / 2, FLOCK_HP_BAR.y + 1, metric.width, metric.label, metric.value, metric.color, {
      height: 38,
      valueColor: metric.text,
      alpha: 0.76,
      icon: metric.icon,
      quiet: true,
      emphasis: battleHud ? 'primary' : undefined,
    });
    contextualX += metric.width + 8;
  });

  if ((data.flowMax ?? 0) > 0) {
    const flow = data.flow ?? 0;
    const flowMax = data.flowMax ?? 0;
    const flowPreview = Math.min(flowMax, flow + (data.flowPreview ?? 0));
    const [flowStatus, flowAccent, flowStatusColor, flowFill] = flowHudPresentation(flow, flowMax, flowPreview, data.statusLabel, data.incoming);
    const flowY = FLOCK_HP_BAR.y + FLOW_HUD_Y_OFFSET;
    const flowX = hpLeft + FLOCK_HP_BAR.w + FLOW_HUD_X_OFFSET;
    addUi(addTo, scene.add.rectangle(flowX, flowY, FLOW_HUD_WIDTH, FLOW_HUD_HEIGHT, flowFill, 0.96)
      .setStrokeStyle(1, flowAccent, battleHud ? 0.3 : 0.88)
      .setName('combat-flow-rail'));
    addUi(addTo, scene.add.text(flowX - 178, flowY, `Flow ${flow}/${flowMax}`, {
      fontFamily: UI_FONT, fontSize: '19px', fontStyle: UI_BOLD, color: '#dffbff', resolution: 2
    }).setOrigin(0, 0.5).setName('combat-flow-value'));
    const pipStart = flowX + FLOW_HUD_PIP_OFFSET;
    for (let i = 0; i < flowMax; i += 1) {
      const filled = i < flow;
      const preview = !filled && i < flowPreview;
      addUi(addTo, scene.add.circle(pipStart + i * FLOW_HUD_PIP_GAP, flowY, filled ? 5.5 : preview ? 5 : 4.5, filled ? UI_FIELD.cyan : preview ? UI_FIELD.gold : 0x253845, filled ? 1 : preview ? 0.94 : 0.68)
        .setStrokeStyle(1, filled ? 0xdffbff : preview ? 0xffe7a8 : 0x07101a, 0.8)
        .setName(preview ? 'combat-flow-preview-pip' : 'combat-flow-pip'));
    }
    addUi(addTo, scene.add.text(flowX + 178, flowY, flowStatus, {
      fontFamily: UI_FONT,
      fontSize: '19px',
      fontStyle: UI_BOLD,
      color: flowStatusColor,
      resolution: 2,
      fixedWidth: 150,
      align: 'right',
      maxLines: 1
    }).setOrigin(1, 0.5).setName('combat-flow-status'));
  }

  addUi(addTo, scene.add.rectangle(650, FLOCK_HP_BAR.y + 1, 1, 38, 0x49606d, 0.55));

  const chips: Array<{ label: string; value: string | number; width: number; color: number; text?: string; icon?: UiIconId }> = [
    { label: 'Scrap', value: data.scrap, width: battleHud ? 100 : 116, color: 0x8df4ff, text: '#dffbff', icon: 'scrap-gear' },
    { label: 'Deck', value: data.deckSize, width: battleHud ? 100 : 108, color: UI_FIELD.gold, text: UI_FIELD.warm, icon: 'deck-stack' },
    { label: 'Supplies', value: data.supplies, width: battleHud ? 122 : 130, color: 0xffb86b, text: '#ffe1a3', icon: 'supply-pouch' },
    { label: 'Waymarks', value: data.waymarks, width: battleHud ? 108 : 116, color: UI_FIELD.violet, text: '#e6d8ff', icon: 'waymark-compass' }
  ];
  let x = data.context === 'route' ? hpLeft + FLOCK_HP_BAR.w + 18 : 674;
  chips.forEach((chip) => {
    const cx = x + chip.width / 2;
    renderHudMetricChip(scene, addTo, cx, FLOCK_HP_BAR.y + 1, chip.width, chip.label, `${chip.value}`, chip.color, {
      height: 38,
      valueColor: chip.text,
      alpha: 0.82,
      icon: chip.icon,
      quiet: true,
      emphasis: battleHud ? 'secondary' : undefined,
    });
    if (chip.label === 'Deck' && data.onDeck) {
      const hit = addUi(addTo, scene.add.rectangle(cx, FLOCK_HP_BAR.y + 1, chip.width, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
        .setName('hud-deck-chip')
        .setInteractive({ useHandCursor: true }));
      hit.on('pointerdown', data.onDeck);
    }
    if (chip.label === 'Waymarks' && data.onWaymarks) {
      const hit = addUi(addTo, scene.add.rectangle(cx, FLOCK_HP_BAR.y + 1, chip.width, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
        .setName('hud-waymarks-chip')
        .setInteractive({ useHandCursor: true }));
      hit.on('pointerdown', data.onWaymarks);
    }
    if (chip.label === 'Supplies' && data.onSupplies) {
      const hit = addUi(addTo, scene.add.rectangle(cx, FLOCK_HP_BAR.y + 1, chip.width, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
        .setName('hud-supplies-chip')
        .setInteractive({ useHandCursor: true }));
      hit.on('pointerdown', data.onSupplies);
    }
    x += chip.width + 10;
  });

  if (data.suitCounts) {
    const suitMeta: Array<[string, string, string]> = [
      ['plumes', 'Plumes', '#ffcf6b'],
      ['quills', 'Quills', '#c9a6ff'],
      ['basins', 'Basins', '#6fd0e6'],
      ['nests', 'Nests', '#8fd6a0']
    ];
    const frameKey = uiIconAssets['combat-suit-keystone-chip-frame'].key;
    const hasFrame = !battleHud && scene.textures.exists(frameKey);
    if (hasFrame) scene.textures.get(frameKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    const chipW = battleHud ? 116 : 84;
    const chipH = 24;
    const chipY = FLOCK_HP_BAR.y + 38;
    let chipCx = battleHud ? 732 : 716;
    suitMeta.filter(([suit]) => (data.suitCounts?.[suit] ?? 0) >= KEYSTONE_AT).forEach(([suit, label, hex]) => {
      const n = data.suitCounts?.[suit] ?? 0;
      const on = n >= KEYSTONE_AT;
      const accentColor = Phaser.Display.Color.HexStringToColor(hex).color;
      addUi(addTo, scene.add.rectangle(chipCx, chipY, chipW - 14, chipH - 8, 0x07101c, on ? 0.78 : 0.7));
      if (hasFrame) {
        addUi(addTo, scene.add.image(chipCx, chipY, frameKey)
          .setDisplaySize(chipW, chipH)
          .setAlpha(on ? 0.98 : 0.86)
          .setName('combat-suit-keystone-chip-frame'));
      } else {
        addUi(addTo, scene.add.rectangle(chipCx, chipY, chipW, chipH, 0x10202c, on ? 0.82 : 0.62)
          .setStrokeStyle(1, accentColor, on ? 0.72 : 0.48)
          .setName('combat-suit-keystone-chip-frame-fallback'));
      }
      addUi(addTo, scene.add.text(chipCx, chipY, `${on ? '* ' : ''}${label} ${n}`, {
        fontFamily: UI_FONT,
        fontSize: battleHud ? '19px' : '10px',
        fontStyle: on ? UI_BOLD : 'normal',
        color: on ? hex : '#d9e9f2',
        stroke: '#081018',
        strokeThickness: battleHud ? 0 : on ? 3 : 2,
        fixedWidth: chipW - 10,
        align: 'center'
      }).setOrigin(0.5));
      chipCx += chipW + 5;
    });
  }

}

function parseHudRatio(value: string): [number, number] {
  const match = value.match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) return [0, 0];
  return [Number(match[1]), Number(match[2])];
}

function renderHudMetricChip(
  scene: Phaser.Scene,
  addTo: UiAdd,
  cx: number,
  cy: number,
  width: number,
  label: string,
  value: string,
  accent: number,
  opts: { valueColor?: string; height?: number; alpha?: number; icon?: UiIconId; quiet?: boolean; emphasis?: 'primary' | 'secondary' } = {}
) {
  const height = opts.height ?? 38;
  const compact = height <= 34;
  const topRailY = cy - height / 2 + 2;
  const frameKey = uiIconAssets['combat-hud-metric-chip-frame'].key;
  const hasFrame = !opts.quiet && scene.textures.exists(frameKey);
  const fillAlpha = opts.alpha ?? 0.78;
  if (!opts.quiet) addUi(addTo, scene.add.rectangle(cx, cy, width - 14, height - 8, 0x0b1017, hasFrame ? fillAlpha * 0.82 : fillAlpha)
    .setStrokeStyle(hasFrame ? 0 : 1, accent, hasFrame ? 0 : 0.42));
  if (hasFrame) {
    scene.textures.get(frameKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    addUi(addTo, scene.add.image(cx, cy, frameKey)
      .setDisplaySize(width + 16, height + 8)
      .setAlpha(0.94));
  } else if (!opts.quiet) {
    addUi(addTo, scene.add.rectangle(cx, topRailY, width - 18, 2, accent, 0.72));
  }
  const iconId = opts.quiet ? undefined : opts.icon ?? hudIconForLabel(label);
  const hasIcon = Boolean(iconId && scene.textures.exists(uiIconAssets[iconId].key));
  if (iconId) {
    const icon = addUiIconImage(scene, iconId, cx - width / 2 + 24, cy + 1, Math.min(28, height - 8));
    if (icon) addUi(addTo, icon);
  }
  const textLeft = cx - width / 2 + (hasIcon ? 58 : 10);
  if (!hasIcon) {
    addUi(addTo, scene.add.text(textLeft, opts.emphasis || opts.quiet ? cy - 28 : cy - height / 2 + 6, opts.emphasis || opts.quiet ? label : label.toUpperCase(), {
      fontFamily: UI_FONT,
      fontSize: opts.emphasis || opts.quiet ? '19px' : compact ? '7px' : '8px',
      fontStyle: opts.emphasis === 'secondary' ? 'normal' : UI_BOLD,
      color: opts.emphasis === 'secondary' ? '#96acba' : '#aabcc8', resolution: 2
    }).setName(`hud-label-${label}`));
  }
  addUi(addTo, scene.add.text(hasIcon ? cx + 16 : textLeft, hasIcon ? cy + 1 : cy + (compact ? 7 : 8), value, {
    fontFamily: UI_FONT,
    fontSize: label === 'Wingbeats' && opts.emphasis === 'primary' ? '23px' : opts.emphasis === 'primary' ? '22px' : opts.emphasis === 'secondary' ? '19px' : opts.quiet ? '21px' : hasIcon ? '17px' : compact ? '13px' : '16px',
    fontStyle: UI_BOLD,
    color: opts.emphasis === 'secondary' ? '#b7c7d4' : opts.valueColor ?? '#e7eef7', resolution: 2
  }).setOrigin(hasIcon ? 0.5 : 0, 0.5).setName(`hud-value-${label}`)
    .setData('textRole', opts.emphasis === 'secondary' ? 'secondary' : 'primary'));
  const rect = addUi(addTo, scene.add.rectangle(cx, cy, width, height, 0x0b1017, hasFrame ? 0.001 : 0)
    .setStrokeStyle(0, accent, 0));
  return rect;
}


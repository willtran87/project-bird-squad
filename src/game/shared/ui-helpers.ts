import { setTextureFilter } from '../texture-filter';
import Phaser from 'phaser';
import { KEYWORDS, keywordIconId, buildKeywordTokens, canonicalKeyword, keywordTitle } from '../keyword-definitions';
import { alphaRouteMarkLibrary } from '../runtime-data';
import { UI_FONT, UI_BOLD, UI_FIELD, UI_GOLD, UI_SOFT, MIN_SUPPORTED_TOUCH_TARGET } from '../theme';
import { quietButton } from '../quiet-ui';
import { pendingOverlay } from '../pending-overlay';
import { countTextureInGameObjects, countVisibleTextureInGameObjects } from '../scene-runtime';
import { graphicsQualityState } from '../graphics-quality';
import { colorCueState, visualContrastState } from '../visual-accessibility';
import { screenReaderState } from '../screen-reader-accessibility';
import { lazyModule } from '../lazy-module';
import { SURGE_STAT_BONUS } from '../combat-rules';
import { WAYMARK_ACTIVE_CAP } from './gameplay-constants';
import { animationPacePreference, combatPacePreference, currentFlashEffectsState, currentScreenShakeState, motionState, prefersReducedMotion, textPacePreference } from './preferences';
import { GAME_HEIGHT, GAME_WIDTH } from './layout-constants';
import { UI_ICON_PREVIEW_SCALE, uiIconAssets, type UiIconId } from '../../art-assets';
import { addUiIconImage } from './asset-loading';
import { birdAudio } from './bird-audio-director';

// ---------------------------------------------------------------------------
// Keyword glossary: the game's mechanical terms, each with a highlight color
// and a player-facing definition. Used to color keywords inside card effect
// text and to pop an explanatory tooltip on hover (see renderRichText).
// ---------------------------------------------------------------------------

let activeKwTooltip: { scene: Phaser.Scene; container: Phaser.GameObjects.Container; owner?: Phaser.GameObjects.GameObject; keyword: string } | undefined;

export function keywordTooltipState(scene: Phaser.Scene) {
  return activeKwTooltip?.scene === scene && activeKwTooltip.container.active
    ? {
      keyword: activeKwTooltip.keyword,
      definition: KEYWORDS[activeKwTooltip.keyword].def,
      icon: keywordIconId(activeKwTooltip.keyword),
    }
    : undefined;
}

export function hideKwTooltip(scene?: Phaser.Scene) {
  if (!activeKwTooltip || (scene && activeKwTooltip.scene !== scene)) return;
  activeKwTooltip.container.destroy(true);
}

export function showKwTooltip(scene: Phaser.Scene, term: string, atX: number, atY: number, owner?: Phaser.GameObjects.GameObject) {
  hideKwTooltip();
  // Aliases (Energy) open the one merged entry (Wingbeat).
  const kw = canonicalKeyword(term) ?? term;
  const def = KEYWORDS[kw];
  if (!def) return;
  const iconId = keywordIconId(kw);
  const textW = 360, padding = 20;
  const icon = addUiIconImage(scene, iconId, padding + 15, padding + 15, 14)
    ?.setName('keyword-tooltip-icon').setData('keyword', kw).setData('icon', iconId);
  const titleX = icon ? padding + 42 : padding;
  const heading = keywordTitle(kw).toUpperCase();
  const title = scene.add.text(titleX, padding, heading, {
    fontFamily: UI_FONT, fontSize: '22px', fontStyle: UI_BOLD, color: def.c, resolution: 2,
    wordWrap: { width: textW - (titleX - padding), useAdvancedWrap: true },
  }).setName('keyword-tooltip-title').setData('fullText', heading);
  const body = scene.add.text(padding, padding + title.height + 8, def.def, {
    fontFamily: UI_FONT, fontSize: '20px', color: '#dbe6f2', resolution: 2, lineSpacing: 3,
    wordWrap: { width: textW, useAdvancedWrap: true },
  }).setName('keyword-tooltip-body').setData('fullText', def.def);
  const w = textW + padding * 2, h = body.y + body.height + padding;
  const stroke = Phaser.Display.Color.HexStringToColor(def.c).color;
  const bg = scene.add.rectangle(0, 0, w, h, 0x091520, 1).setOrigin(0, 0)
    .setStrokeStyle(1, stroke, 0.9).setName('keyword-tooltip-panel');
  const c = scene.add.container(0, 0, [bg, ...(icon ? [icon] : []), title, body]).setDepth(99999).setName('keyword-tooltip');
  const px = Phaser.Math.Clamp(atX - w / 2, 8, GAME_WIDTH - w - 8);
  const above = atY - h - 12;
  const py = Phaser.Math.Clamp(above >= 8 ? above : atY + 24, 8, GAME_HEIGHT - h - 8);
  c.setPosition(px, py);
  activeKwTooltip = { scene, container: c, owner, keyword: kw };
  const dismiss = () => { if (activeKwTooltip?.container === c) hideKwTooltip(scene); };
  scene.input.once(Phaser.Input.Events.GAME_OUT, dismiss);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, dismiss);
  owner?.once(Phaser.GameObjects.Events.DESTROY, dismiss);
  c.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.input.off(Phaser.Input.Events.GAME_OUT, dismiss);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, dismiss);
    owner?.off(Phaser.GameObjects.Events.DESTROY, dismiss);
    if (activeKwTooltip?.container === c) activeKwTooltip = undefined;
  });
}


// Lay out effect text with mechanical keywords highlighted in their color
// (and bold). When tooltips=true, each keyword is interactive and pops its
// definition on hover. Returns the total rendered height. Manual token layout
// is required because a Phaser Text object is a single color.
interface RichTextOpts {
  wrap: number; fontSize?: number; baseColor?: string; lineSpacing?: number;
  bold?: boolean; align?: 'left' | 'center'; tooltips?: boolean; resolution?: number;
}

export function renderRichText(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number, y: number, text: string, opts: RichTextOpts,
): number {
  const { wrap, fontSize = 14, baseColor = '#dbe6f2', lineSpacing = 3, bold = false, align = 'left', tooltips = false } = opts;
  const base = { fontFamily: UI_FONT, fontSize: `${fontSize}px`, resolution: opts.resolution ?? 0 };
  const m1 = scene.add.text(0, 0, 'a a', base); const m2 = scene.add.text(0, 0, 'aa', base);
  const spaceW = Math.max(3, m1.width - m2.width); m1.destroy(); m2.destroy();
  const tokens = buildKeywordTokens(text).map((t) => {
    const style = { ...base, fontStyle: (t.kw || bold) ? 'bold' : 'normal' };
    const tmp = scene.add.text(0, 0, t.text, style); const w = tmp.width; tmp.destroy();
    return { ...t, w };
  });
  const lines: Array<Array<typeof tokens[number]>> = [];
  let cur: Array<typeof tokens[number]> = []; let curW = 0;
  for (const t of tokens) {
    const add = (cur.length ? spaceW : 0) + t.w;
    if (cur.length && curW + add > wrap) { lines.push(cur); cur = [t]; curW = t.w; }
    else { cur.push(t); curW += add; }
  }
  if (cur.length) lines.push(cur);
  const lineH = Math.ceil(fontSize * 1.2) + lineSpacing;
  let yy = y;
  for (const line of lines) {
    const lineW = line.reduce((s, t, i) => s + t.w + (i ? spaceW : 0), 0);
    let sx = align === 'center' ? x - lineW / 2 : x;
    for (const t of line) {
      const color = t.kw ? KEYWORDS[t.kw].c : baseColor;
      const fontStyle = (t.kw || bold) ? 'bold' : 'normal';
      const txt = scene.add.text(sx, yy, t.text, { ...base, color, fontStyle });
      parent.add(txt);
      if (t.kw && tooltips) {
        const kw = t.kw;
        txt.setInteractive({ useHandCursor: true });
        txt.on('pointerover', () => {
          const bounds = txt.getBounds();
          showKwTooltip(scene, kw, bounds.centerX, bounds.top, txt);
        });
        txt.on('pointerout', () => { if (activeKwTooltip?.owner === txt) hideKwTooltip(scene); });
      }
      sx += t.w + spaceW;
    }
    yy += lineH;
  }
  return yy - y;
}


export function zoneRank(zone: string) {
  if (zone === 'Hand') return 0;
  if (zone === 'Draw' || zone === 'Deck') return 1;
  if (zone === 'Discard') return 2;
  if (zone === 'Cleared') return 3;
  return 4;
}



export type UiAdd = (obj: Phaser.GameObjects.GameObject) => void;


export function addUi<T extends Phaser.GameObjects.GameObject>(addTo: UiAdd, obj: T): T {
  addTo(obj);
  return obj;
}


export function audioToggleWaveBurstState(scene: Phaser.Scene, children: any[]) {
  const key = uiIconAssets['audio-toggle-wave-burst'].key;
  const count = countTextureInGameObjects(children, key);
  const visible = countVisibleTextureInGameObjects(children, key);
  return {
    loaded: scene.textures.exists(key),
    rendered: visible > 0,
    count,
    visible
  };
}


export type UnifiedRunHudData = {
  context?: 'route' | 'battle';
  title: string;
  subtitle: string;
  cohesion: string;
  scrap: string | number;
  deckSize: string | number;
  waymarks: string | number;
  supplies: string | number;
  statusLabel?: string;
  statusColor?: string;
  flow?: number;
  flowMax?: number;
  flowPreview?: number;
  cover?: number;
  incoming?: {
    total: number;
    blocked: number;
    hpLoss: number;
    afterHp: number;
    attackers: number;
    uncertainty?: string[];
  };
  suitCounts?: Record<string, number>;
  wingbeats?: string | number;
  resonance?: string | number;
  railIcon?: UiIconId;
  onFlock?: () => void;
  onDeck?: () => void;
  onWaymarks?: () => void;
  onSupplies?: () => void;
};


type FlowHudPresentation = readonly [
  status: string,
  accent: number,
  statusColor: string,
  fill: number,
  breakPreview: boolean,
  holdPreview: boolean,
];


export function flowHudPresentation(
  flow: number,
  flowMax: number,
  previewFlow: number,
  statusLabel?: string,
  incoming?: UnifiedRunHudData['incoming'],
): FlowHudPresentation {
  const breakPreview = flow > 0 && (incoming?.hpLoss ?? 0) > 0;
  const holdPreview = flow > 0 && (incoming?.total ?? 0) > 0 && (incoming?.hpLoss ?? 0) === 0;
  const reachesSurge = previewFlow > flow && previewFlow >= flowMax;
  let status = `${Math.max(0, flowMax - previewFlow)} TO SURGE`;
  let accent = UI_FIELD.cyan;
  let statusColor = '#bff8ff';
  let fill = 0x06131d;
  if (statusLabel === 'SCATTERED') {
    status = 'SCATTER -25%'; accent = 0xff7a6e; statusColor = '#ffb09f'; fill = 0x1b0d0d;
  } else if (reachesSurge) {
    status = breakPreview ? 'SURGE / BREAK' : holdPreview ? 'SURGE / HOLDS' : 'SURGE NEXT';
    accent = UI_FIELD.gold; statusColor = breakPreview ? '#ffd0c9' : '#ffe7a8'; fill = 0x172111;
  } else if (breakPreview) {
    status = 'FLOW BREAKS'; accent = 0xff6f6f; statusColor = '#ffd0c9'; fill = 0x1b0b0d;
  } else if (flow >= flowMax) {
    status = `SURGE +${SURGE_STAT_BONUS}`; accent = UI_FIELD.gold; statusColor = '#ffe7a8'; fill = 0x10252b;
  } else if (holdPreview) {
    status = 'FLOW HOLDS'; accent = 0x8fd6a0; statusColor = '#c9f4d3'; fill = 0x0a211a;
  }
  return [status, accent, statusColor, fill, breakPreview, holdPreview];
}


export function addWaymarkWithCapacity(current: string[], markId: string) {
  if (current.includes(markId)) return { routeMarks: [...current], added: false };
  const mark = alphaRouteMarkLibrary.get(markId);
  if (!mark) return { routeMarks: [...current], added: false };
  const next = [...current];
  let replaced: string | undefined;
  const capExempt = mark.source === 'boss' || mark.rarity === 'boss';
  if (!capExempt) {
    const nonBossCount = next.filter((id) => {
      const owned = alphaRouteMarkLibrary.get(id);
      return owned?.source !== 'boss' && owned?.rarity !== 'boss';
    }).length;
    if (nonBossCount >= WAYMARK_ACTIVE_CAP) {
      const replaceIndex = next.findIndex((id) => {
        const owned = alphaRouteMarkLibrary.get(id);
        return owned?.source !== 'boss' && owned?.rarity !== 'boss';
      });
      if (replaceIndex >= 0) {
        [replaced] = next.splice(replaceIndex, 1);
      }
    }
  }
  next.push(markId);
  return { routeMarks: next, added: true, replaced };
}


export function renderUnifiedRunHud(scene: Phaser.Scene, addTo: UiAdd, data: UnifiedRunHudData) {
  const owner = scene as any;
  const renderer = owner.routeMapRendererModule ?? owner.battleHudRendererModule;
  if (renderer) return renderer.renderUnifiedRunHud(scene, addTo, data);
  // Keep vital context visible while the existing presentation download settles.
  const fields: [string, string | number, (() => void) | undefined][] = [
    ['Cohesion', data.cohesion, data.onFlock], ['Scrap', data.scrap, undefined],
    ['Deck', data.deckSize, data.onDeck], ['Supplies', data.supplies, data.onSupplies],
    ['Waymarks', data.waymarks, data.onWaymarks],
  ];
  fields.forEach(([label, value, open], index) => {
    const field = addUi(addTo, scene.add.text(24 + index * 208, 20, `${label} ${value}`, {
      fontFamily: UI_FONT, fontSize: '21px', color: UI_GOLD, resolution: 2, padding: { top: 10, bottom: 10 },
    }).setName(`run-hud-loading-${label}`));
    if (open) field.setInteractive({ useHandCursor: true }).on('pointerdown', open);
  });
}




export function renderFieldPanel(
  scene: Phaser.Scene,
  addTo: UiAdd,
  cx: number,
  cy: number,
  w: number,
  h: number,
  opts: { title?: string; subtitle?: string; accent?: number; fill?: number; fillAlpha?: number; showRails?: boolean; eyebrow?: string } = {}
) {
  const accent = opts.accent ?? UI_FIELD.gold;
  const fill = opts.fill ?? UI_FIELD.panel;
  addUi(addTo, scene.add.rectangle(cx + 8, cy + 10, w, h, 0x020409, 0.42));
  addUi(addTo, scene.add.rectangle(cx, cy, w, h, fill, opts.fillAlpha ?? 0.985).setStrokeStyle(1, accent, 0.42));
  if (opts.showRails !== false) {
    addUi(addTo, scene.add.rectangle(cx, cy - h / 2 + 14, w - 34, 2, accent, 0.72));
    addUi(addTo, scene.add.rectangle(cx, cy + h / 2 - 14, w - 34, 1, 0xffffff, 0.08));
  }
  const left = cx - w / 2;
  const right = cx + w / 2;
  const top = cy - h / 2;
  const bottom = cy + h / 2;
  const corner = 28;
  [
    [left + 15, top + 15, corner, 2], [left + 15, top + 15, 2, corner],
    [right - 15, top + 15, corner, 2], [right - 15, top + 15, 2, corner],
    [left + 15, bottom - 15, corner, 2], [left + 15, bottom - 15, 2, corner],
    [right - 15, bottom - 15, corner, 2], [right - 15, bottom - 15, 2, corner]
  ].forEach(([x, y, cw, ch], index) => {
    if (opts.showRails === false) return;
    const ox = index === 2 || index === 6 ? -corner : 0;
    const oy = index === 5 || index === 7 ? -corner : 0;
    addUi(addTo, scene.add.rectangle(x + ox, y + oy, cw, ch, accent, 0.72).setOrigin(0, 0));
  });
  if (opts.eyebrow) {
    addUi(addTo, scene.add.text(left + 36, top + 30, opts.eyebrow.toUpperCase(), {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: UI_FIELD.muted
    }));
  }
  if (opts.title) {
    addUi(addTo, scene.add.text(left + 36, top + (opts.eyebrow ? 46 : 30), opts.title, {
      fontFamily: UI_FONT,
      fontSize: '28px',
      fontStyle: UI_BOLD,
      color: UI_FIELD.warm,
      stroke: '#020409',
      strokeThickness: 3
    }));
  }
  if (opts.subtitle) {
    addUi(addTo, scene.add.text(left + 36, top + (opts.title ? 76 : 44), opts.subtitle, {
      fontFamily: UI_FONT,
      fontSize: '14px',
      color: UI_SOFT,
      wordWrap: { width: w - 220 }
    }));
  }
  return { left, right, top, bottom, cx, cy, w, h };
}




function addSystemFieldCommandFrame(
  scene: Phaser.Scene,
  addTo: UiAdd,
  cx: number,
  cy: number,
  width: number,
  height: number,
  opts: { alpha?: number; tint?: number } = {}
) {
  const key = uiIconAssets['system-field-command-frame'].key;
  if (!scene.textures.exists(key)) return undefined;
  setTextureFilter(scene.textures.get(key), Phaser.Textures.FilterMode.LINEAR);
  const frame = scene.add.image(cx, cy, key)
    .setDisplaySize(width, height)
    .setAlpha(prefersReducedMotion() ? Math.min(opts.alpha ?? 0.78, 0.66) : (opts.alpha ?? 0.78))
    .setName('system-field-command-frame');
  if (opts.tint !== undefined) frame.setTint(opts.tint);
  addUi(addTo, frame);
  return frame;
}






function addDeckReviewDetailFrame(
  scene: Phaser.Scene,
  addTo: UiAdd,
  cx: number,
  cy: number,
  width: number,
  height: number,
  opts: { alpha?: number; glint?: boolean } = {}
) {
  const key = uiIconAssets['deck-review-detail-frame'].key;
  if (!scene.textures.exists(key)) return undefined;
  setTextureFilter(scene.textures.get(key), Phaser.Textures.FilterMode.LINEAR);
  const frame = scene.add.image(cx, cy, key)
    .setDisplaySize(width, height)
    .setAlpha(opts.alpha ?? 0.68)
    .setName('deck-review-detail-frame');
  addUi(addTo, frame);
  if (opts.glint) {
    const glint = scene.add.image(cx, cy, key)
      .setDisplaySize(width, height)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(prefersReducedMotion() ? 0.02 : 0.04)
      .setName('deck-review-detail-frame');
    addUi(addTo, glint);
    if (!prefersReducedMotion()) {
      scene.tweens.add({
        targets: glint,
        alpha: 0.022,
        duration: 1700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }
  return frame;
}






export function addRouteWaymarkScrollRailFrame(
  scene: Phaser.Scene,
  addTo: UiAdd,
  x: number,
  trackY: number,
  trackH: number,
  thumbY: number,
  thumbH: number
) {
  const key = uiIconAssets['route-waymark-scroll-rail-frame'].key;
  if (!scene.textures.exists(key)) {
    addUi(addTo, scene.add.rectangle(x, trackY, 5, trackH, 0x1a2435, 0.9));
    addUi(addTo, scene.add.rectangle(x, thumbY, 8, thumbH, UI_FIELD.violet, 0.95));
    return false;
  }

  setTextureFilter(scene.textures.get(key), Phaser.Textures.FilterMode.LINEAR);
  const railScale = 52 / 256;
  addUi(addTo, scene.add.nineslice(x, trackY, key, undefined, 256, (trackH + 58) / railScale, 1, 1, 300, 165)
    .setScale(railScale)
    .setAlpha(0.92)
    .setName('route-waymark-scroll-rail-frame'));
  addUi(addTo, scene.add.rectangle(x, trackY, 8, Math.max(24, trackH - 22), 0x02070d, 0.32));
  addUi(addTo, scene.add.rectangle(x, thumbY, 9, thumbH, UI_FIELD.violet, 0.84)
    .setStrokeStyle(1, UI_FIELD.cyan, 0.4));
  return true;
}


export function renderCloseControl(scene: Phaser.Scene, addTo: UiAdd, x: number, y: number, onClick: () => void) {
  const hit = quietButton(scene, { x, y, width: 104, label: 'Close', name: 'overlay-close-hit',
    onActivate: () => { playUiSound('close'); onClick(); } });
  addUi(addTo, hit); addUi(addTo, hit.getData('labelObject'));
  return hit;
}


function runPauseIndependentUiFeedback(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Image,
  duration: number,
  onProgress: (progress: number) => void,
  onComplete?: () => void,
) {
  const priorCleanup = target.getData('pauseIndependentFeedbackCleanup') as (() => void) | undefined;
  priorCleanup?.();
  let animationFrame = 0;
  let startedAt: number | undefined;
  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (animationFrame) cancelAnimationFrame(animationFrame);
    target.off(Phaser.GameObjects.Events.DESTROY, cleanup);
    if (target.active && target.getData('pauseIndependentFeedbackCleanup') === cleanup) {
      target.setData('pauseIndependentFeedbackCleanup', undefined);
    }
  };
  const onFrame = (time: number) => {
    if (!target.active || !scene.sys.settings.active) {
      cleanup();
      return;
    }
    startedAt ??= time;
    const progress = Phaser.Math.Clamp((time - startedAt) / duration, 0, 1);
    onProgress(Phaser.Math.Easing.Sine.Out(progress));
    if (progress < 1) {
      animationFrame = requestAnimationFrame(onFrame);
      return;
    }
    cleanup();
    onComplete?.();
  };
  target.setData('pauseIndependentFeedbackCleanup', cleanup);
  target.once(Phaser.GameObjects.Events.DESTROY, cleanup);
  animationFrame = requestAnimationFrame(onFrame);
}


export function renderAudioToggleControl(scene: Phaser.Scene, addTo: UiAdd, x: number, y: number, onToggle?: () => void) {
  const hit = addUi(addTo, scene.add.rectangle(x, y, MIN_SUPPORTED_TOUCH_TARGET, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.08)
    .setInteractive({ useHandCursor: true })
    .setName('audio-toggle-control-hit')
    .setData('feedbackBursts', 0));
  const pulse = addUiIconImage(scene, 'audio-toggle-pulse-ring', x, y, 26);
  if (pulse) addUi(addTo, pulse.setAlpha(birdAudio.isMuted() ? 0.14 : 0.24).setName('audio-toggle-pulse-ring'));
  const burst = addUiIconImage(scene, 'audio-toggle-wave-burst', x, y, 34);
  if (burst) addUi(addTo, burst.setAlpha(0).setVisible(false).setName('audio-toggle-wave-burst'));
  const icon = addUiIconImage(scene, 'audio-toggle-medallion', x, y, 19);
  if (icon) addUi(addTo, icon.setAlpha(birdAudio.isMuted() ? 0.46 : 0.94));
  const slash = addUi(addTo, scene.add.line(0, 0, x - 16, y + 14, x + 16, y - 14, 0xff7a6e, birdAudio.isMuted() ? 0.94 : 0)
    .setLineWidth(4, 2));
  const basePulseScaleX = pulse?.scaleX ?? 1;
  const basePulseScaleY = pulse?.scaleY ?? 1;
  const baseBurstScaleX = burst?.scaleX ?? 1;
  const baseBurstScaleY = burst?.scaleY ?? 1;
  const refresh = () => {
    pulse?.setAlpha(birdAudio.isMuted() ? 0.14 : 0.24);
    icon?.setAlpha(birdAudio.isMuted() ? 0.46 : 0.94);
    slash.setAlpha(birdAudio.isMuted() ? 0.94 : 0);
    hit.setData('label', birdAudio.isMuted() ? 'Unmute' : 'Mute');
  };
  hit.on('pointerover', () => {
    pulse?.setAlpha(birdAudio.isMuted() ? 0.22 : 0.36);
    icon?.setScale(icon.scaleX * 1.04, icon.scaleY * 1.04);
  });
  hit.on('pointerout', () => {
    pulse?.setAlpha(birdAudio.isMuted() ? 0.14 : 0.24);
    icon?.setScale((19 * UI_ICON_PREVIEW_SCALE) / icon.width, (19 * UI_ICON_PREVIEW_SCALE) / icon.height);
  });
  hit.on('audio-state-change', refresh);
  hit.on('pointerdown', () => {
    birdAudio.toggleMute();
    hit.setData('feedbackBursts', Number(hit.getData('feedbackBursts') ?? 0) + 1);
    refreshRenderedAudioToggleControls(scene);
    if (pulse) {
      scene.tweens.killTweensOf(pulse);
      const pulseStartAlpha = birdAudio.isMuted() ? 0.58 : 0.74;
      const pulseEndAlpha = birdAudio.isMuted() ? 0.14 : 0.24;
      pulse.setScale(basePulseScaleX * 1.18, basePulseScaleY * 1.18).setAlpha(birdAudio.isMuted() ? 0.58 : 0.74);
      runPauseIndependentUiFeedback(scene, pulse, 260, (progress) => {
        pulse.setScale(
          Phaser.Math.Linear(basePulseScaleX * 1.18, basePulseScaleX, progress),
          Phaser.Math.Linear(basePulseScaleY * 1.18, basePulseScaleY, progress),
        );
        pulse.setAlpha(Phaser.Math.Linear(pulseStartAlpha, pulseEndAlpha, progress));
      });
    }
    if (burst) {
      scene.tweens.killTweensOf(burst);
      const burstEndScaleX = prefersReducedMotion() ? baseBurstScaleX : baseBurstScaleX * 1.34;
      const burstEndScaleY = prefersReducedMotion() ? baseBurstScaleY : baseBurstScaleY * 1.34;
      const burstStartAlpha = birdAudio.isMuted() ? 0.42 : 0.68;
      burst
        .setVisible(true)
        .setScale(baseBurstScaleX * 0.82, baseBurstScaleY * 0.82)
        .setAlpha(burstStartAlpha);
      runPauseIndependentUiFeedback(scene, burst, prefersReducedMotion() ? 140 : 420, (progress) => {
        burst.setScale(
          Phaser.Math.Linear(baseBurstScaleX * 0.82, burstEndScaleX, progress),
          Phaser.Math.Linear(baseBurstScaleY * 0.82, burstEndScaleY, progress),
        );
        burst.setAlpha(Phaser.Math.Linear(burstStartAlpha, 0, progress));
      }, () => {
        if (burst.active) {
          burst.setVisible(false).setScale(baseBurstScaleX, baseBurstScaleY);
        }
      });
    }
    onToggle?.();
  });
  refresh();
  return hit;
}


function findRenderedAudioToggleControl(children: any[]): Phaser.GameObjects.Rectangle | undefined {
  let match: Phaser.GameObjects.Rectangle | undefined;
  for (const child of children ?? []) {
    if (!child || child.active === false || child.visible === false) continue;
    if (child.name === 'audio-toggle-control-hit' && child.input?.enabled) {
      match = child as Phaser.GameObjects.Rectangle;
    }
    if (Array.isArray(child.list)) {
      const nested = findRenderedAudioToggleControl(child.list);
      if (nested) match = nested;
    }
  }
  return match;
}


function refreshRenderedAudioToggleControls(scene: Phaser.Scene) {
  const visit = (children: any[]) => {
    for (const child of children ?? []) {
      if (!child || child.active === false) continue;
      if (child.name === 'audio-toggle-control-hit') child.emit('audio-state-change');
      if (Array.isArray(child.list)) visit(child.list);
    }
  };
  visit(scene.children.list);
}


export function activateRenderedAudioToggleControl(scene: Phaser.Scene) {
  const hit = findRenderedAudioToggleControl(scene.children.list);
  if (!hit) return false;
  hit.emit('pointerdown');
  return true;
}


export function renderPauseToggleControl(scene: Phaser.Scene, addTo: UiAdd, x: number, y: number, onToggle: () => void) {
  const hit = addUi(addTo, scene.add.rectangle(x, y, MIN_SUPPORTED_TOUCH_TARGET, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.08)
    .setInteractive({ useHandCursor: true }).setName('pause-toggle-control-hit'));
  const icon = addUiIconImage(scene, 'pause-medallion', x, y, 19);
  if (icon) addUi(addTo, icon.setAlpha(0.94));
  hit.on('pointerover', () => icon?.setScale(icon.scaleX * 1.04, icon.scaleY * 1.04));
  hit.on('pointerout', () => icon?.setScale((19 * UI_ICON_PREVIEW_SCALE) / icon.width, (19 * UI_ICON_PREVIEW_SCALE) / icon.height));
  hit.on('pointerdown', () => onToggle());
  return hit;
}


export function renderPauseMenuOverlay(
  scene: Phaser.Scene,
  addTo: UiAdd,
  options: import('../system-overlays').PauseOverlayOptions,
) {
  renderLazySystemOverlay(scene, addTo, options.onResume, (module) => {
    module.renderPauseMenuOverlay(scene, addTo, options, systemOverlayDependencies);
  });
}


export function renderConfirmRunExitOverlay(
  scene: Phaser.Scene,
  addTo: UiAdd,
  options: import('../system-overlays').ConfirmRunExitOverlayOptions,
) {
  renderLazySystemOverlay(scene, addTo, options.onKeepPlaying, (module) => {
    module.renderConfirmRunExitOverlay(scene, addTo, options, systemOverlayDependencies);
  });
}


type SystemOverlaysModule = typeof import('../system-overlays');

const loadSystemOverlaysModule = lazyModule(() => import('../system-overlays'));


const systemOverlayDependencies: import('../system-overlays').SystemOverlayDependencies = {
  audio: birdAudio,
  combatPacePreference,
  animationPacePreference,
  textPacePreference,
  graphicsQualityState,
  motionState,
  colorCueState,
  screenShakeState: currentScreenShakeState,
  flashEffectsState: currentFlashEffectsState,
  screenReaderState,
  visualContrastState,
  playUiSound,
  prefersReducedMotion,
  activateAudioToggleControl: activateRenderedAudioToggleControl,
  renderAudioToggleControl,
};


function renderLazySystemOverlay(
  scene: Phaser.Scene,
  addTo: UiAdd,
  onClose: () => void,
  render: (module: SystemOverlaysModule) => void,
) {
  pendingOverlay(scene, addTo, loadSystemOverlaysModule, render, onClose);
}


export function renderSettingsMenuOverlay(
  scene: Phaser.Scene,
  addTo: UiAdd,
  options: import('../system-overlays').SettingsOverlayOptions,
) {
  renderLazySystemOverlay(scene, addTo, options.onClose, (module) => {
    module.renderSettingsMenuOverlay(scene, addTo, options, systemOverlayDependencies);
  });
}


export function renderHowToPlayOverlay(
  scene: Phaser.Scene,
  addTo: UiAdd,
  options: import('../system-overlays').HowToPlayOverlayOptions,
) {
  renderLazySystemOverlay(scene, addTo, options.onClose, (module) => {
    module.renderHowToPlayOverlay(scene, addTo, options, systemOverlayDependencies);
  });
}

export function playUiSound(kind: 'confirm' | 'close' | 'locked' = 'confirm') {
  birdAudio.play(kind);
}


export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

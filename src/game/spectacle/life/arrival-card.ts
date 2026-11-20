import Phaser from 'phaser';
import { districtFraming } from '../../district-framing';
import { safeStorageGet, safeStorageSet } from '../../safe-storage';
import { runDistrictOrdinal, runMapIndices } from '../../shared/gameplay-constants';
import { UI_DISPLAY_FONT, UI_FONT } from '../../ui-tokens';
import { clamp01, eachFrame, easeOut, motion, paced, sceneNow } from './kit';

/**
 * District arrival card: a full-screen title moment the first time a run
 * enters each district, over that district's painting.
 *
 * It is a picture, not a modal. The route beneath is interactive from its
 * first frame and the card never takes input ownership; any key or click
 * dismisses it and still reaches the screen underneath. That keeps every
 * route flow, and every test that drives one, exactly as it was.
 */

const STORAGE_KEY = 'birdsquad.arrivalCards';
const DEPTH = 29000;
const HOLD_MS = 2600, ENTER_MS = 460, EXIT_MS = 360, SKIP_EXIT_MS = 170;

type RouteRead = Phaser.Scene & {
  runState?: { mapIndex?: number; startedAtMs?: number; runMode?: 'full' | 'quick' };
  routeEssentialAssetsReady?: boolean;
  routeMapBackdrop?: { key: string };
};
interface Seen { run: number; districts: number[] }

function readSeen(): Seen {
  try {
    const parsed = JSON.parse(safeStorageGet(STORAGE_KEY) ?? '') as Seen;
    if (typeof parsed.run === 'number' && Array.isArray(parsed.districts)) return parsed;
  } catch { /* first card, or unreadable storage */ }
  return { run: 0, districts: [] };
}

/** True the first time this run reaches `district`; remembers that it has. */
function claim(run: number, district: number) {
  const seen = readSeen();
  if (seen.run === run && seen.districts.includes(district)) return false;
  safeStorageSet(STORAGE_KEY, JSON.stringify({ run, districts: seen.run === run ? [...seen.districts, district] : [district] }));
  return true;
}

function build(scene: RouteRead, index: number) {
  const { width, height } = scene.scale.gameSize;
  const district = districtFraming[index] ?? districtFraming[0];
  const accent = Phaser.Display.Color.HexStringToColor(district.accent).color;
  const mode = scene.runState?.runMode;
  const key = scene.routeMapBackdrop && scene.textures.exists(scene.routeMapBackdrop.key) ? scene.routeMapBackdrop.key : 'splash';
  const card = scene.add.container(0, 0).setDepth(DEPTH).setName('district-arrival-card').setData('district', index);
  const art = scene.add.image(width / 2, height / 2, key).setDisplaySize(width, height).setName('district-arrival-art');
  const text = (y: number, value: string, family: string, size: number, color: string, style = 'normal') =>
    scene.add.text(width / 2, y, value, { fontFamily: family, fontSize: `${size}px`, fontStyle: style, color, align: 'center', resolution: 2 })
      .setOrigin(0.5);
  const kicker = text(288, `DISTRICT ${runDistrictOrdinal(mode, index)} OF ${runMapIndices(mode).length}`, UI_FONT, 22, district.accent, 'bold')
    .setLetterSpacing(5).setName('district-arrival-card-kicker');
  const name = text(360, district.place, UI_DISPLAY_FONT, 84, '#fff6e0').setShadow(0, 4, '#000000', 14, false, true)
    .setName('district-arrival-card-name');
  const premise = text(440, district.premise, UI_FONT, 26, '#e8f1f7').setName('district-arrival-card-premise');
  const rule = scene.add.rectangle(width / 2, 406, 360, 2, accent, 0.9);
  const bars = [scene.add.rectangle(width / 2, 42, width, 84, 0x020409, 0.94), scene.add.rectangle(width / 2, height - 42, width, 84, 0x020409, 0.94)];
  card.add([
    scene.add.rectangle(width / 2, height / 2, width, height, 0x05070c, 1), art,
    scene.add.rectangle(width / 2, height / 2, width, height, 0x05070c, 0.3),
    scene.add.rectangle(width / 2, 366, width, 250, 0x05090f, 0.66),
    ...bars, rule, kicker, name, premise,
    text(height - 42, 'Any key or click to continue', UI_FONT, 19, '#9fb2bd').setName('district-arrival-card-hint'),
  ]);
  return { card, art, bars, rule, lines: [kicker, name, premise] };
}

/** Show the card once per district per run. Safe to call on every route start. */
export function dressArrivalCard(route: Phaser.Scene) {
  const scene = route as RouteRead;
  const index = scene.runState?.mapIndex ?? 0;
  let start: number | undefined;
  let skipAt: number | undefined;
  let done = false;
  let parts: ReturnType<typeof build> | undefined;
  const skip = (event?: { repeat?: boolean }) => {
    if (event?.repeat) return;
    skipAt ??= sceneNow(scene);
    if (scene.time.paused) finish();
  };
  const finish = () => {
    if (done) return;
    done = true;
    scene.input.keyboard?.off('keydown', skip);
    scene.input.off('pointerdown', skip);
    scene.events.off('spectacle-skip-arrival', skip);
    parts?.card.destroy();
    scene.registry.set('district-arrival-card', undefined);
  };
  eachFrame(scene, () => {
    if (done || !scene.routeEssentialAssetsReady) return;
    const now = sceneNow(scene);
    if (start === undefined) {
      if (!claim(scene.runState?.startedAtMs ?? 0, index)) { done = true; return; }
      start = now;
      scene.registry.set('district-arrival-card', index);
      scene.input.keyboard?.on('keydown', skip);
      scene.input.on('pointerdown', skip);
      scene.events.on('spectacle-skip-arrival', skip);
    }
    // A paused clock would freeze the card over the pause panel.
    if (scene.time.paused) { finish(); return; }
    const mode = motion();
    const hold = paced(HOLD_MS), exit = paced(EXIT_MS);
    const out = skipAt !== undefined ? (now - skipAt) / paced(SKIP_EXIT_MS) : (now - start - hold + exit) / exit;
    if (out >= 1) { finish(); return; }
    if (!parts?.card.active) parts = build(scene, index);
    const { width } = scene.scale.gameSize;
    const enter = mode === 'full' ? easeOut(clamp01((now - start) / paced(ENTER_MS))) : 1;
    parts.card.setAlpha(1 - clamp01(out));
    if (mode !== 'full') return;
    // A slow push-in on the painting; bars close in; lines rise in turn.
    const push = 1.07 - 0.05 * clamp01((now - start) / hold);
    parts.art.setDisplaySize(width * push, scene.scale.gameSize.height * push);
    parts.bars[0].y = 42 - 84 * (1 - enter);
    parts.bars[1].y = scene.scale.gameSize.height - 42 + 84 * (1 - enter);
    parts.rule.setScale(enter, 1);
    parts.lines.forEach((line, order) => {
      const rise = easeOut(clamp01((now - start! - paced(90 + order * 110)) / paced(ENTER_MS)));
      line.setAlpha(rise).setY([288, 360, 440][order] + (1 - rise) * 18);
    });
  }, finish);
}

export function arrivalCardState(scene: Phaser.Scene) {
  const card = scene.children.getByName('district-arrival-card') as Phaser.GameObjects.Container | null;
  return card?.active ? { district: card.getData('district') as number, alpha: card.alpha, depth: card.depth,
    name: (card.getByName('district-arrival-card-name') as Phaser.GameObjects.Text | null)?.text } : undefined;
}

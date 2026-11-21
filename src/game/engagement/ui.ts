import Phaser from 'phaser';
import { BATTLEFIELD_ASSETS, cardArtAssets } from '../../art-assets';
import { CEREMONY_KEY } from '../ceremony-queue';
import { getLeader } from '../leaders';
import { codexLeaderArtAssets } from '../leader-portrait-assets';
import { loadAccount } from '../meta';
import { queueRuntimeImageAssets, type RuntimeImageAsset } from '../runtime-images';
import { safeStorageGet, safeStorageRemove, safeStorageSet } from '../safe-storage';
import { alphaMaps } from '../runtime-data';
import { runMapIndices } from '../shared/gameplay-constants';
import { GAME_HEIGHT, GAME_WIDTH } from '../shared/layout-constants';
import { cardLibrary } from '../shared/run-session';
import { loadRunHistory } from '../shared/run-state';
import type { RunSummary } from '../shared/runtime-types';
import { clamp01, easeOut, motion, paced, renderPose, sceneNow } from '../spectacle/life/kit';
import { SUIT_COLORS, UI_DISPLAY_FONT, UI_FONT } from '../theme';
import { parseQueue, serializeQueue } from './ceremony-reveals';
import { dailyDateFromSeed, syncDailyStore, type DailyResult, type DailyStore } from './daily-flight';
import { flightScore, runFacts, type RunFacts } from './run-facts';

/** Shared drawing and lookups for the engagement scenes (all lazy). */

export const W = GAME_WIDTH, H = GAME_HEIGHT;
export const INK = 0x07101a, PLATE = 0x0b151f, LINE = 0x496471;
export const C = { text: '#edf2f5', soft: '#bfcbd0', muted: '#9fb2bd', gold: '#ffe1a3', loss: '#ffb2a4', cyan: '#8df4ff' } as const;

export function label(scene: Phaser.Scene, x: number, y: number, value: string, size = 21, color: string = C.text,
  style: 'normal' | 'bold' | 'italic' = 'normal', family = UI_FONT) {
  return scene.add.text(x, y, value, { fontFamily: family, fontSize: `${size}px`, fontStyle: style, color, resolution: 2 });
}

export const display = (scene: Phaser.Scene, x: number, y: number, value: string, size: number, color: string = C.text) =>
  label(scene, x, y, value, size, color, 'normal', UI_DISPLAY_FONT);

/** Full-screen painting under a reading scrim. Falls back to the title art. */
export function backdrop(scene: Phaser.Scene, key: string, scrim = 0.84) {
  const art = scene.add.image(W / 2, H / 2, scene.textures.exists(key) ? key : 'splash').setDisplaySize(W, H).setName('engagement-backdrop');
  const veil = scene.add.rectangle(W / 2, H / 2, W, H, 0x05090f, scrim).setName('engagement-scrim');
  return { art, veil };
}

export function whenLoaded(scene: Phaser.Scene, assets: Array<RuntimeImageAsset | undefined>, name: string, ready: () => void) {
  const wanted = assets.filter((asset): asset is RuntimeImageAsset => Boolean(asset));
  if (wanted.every((asset) => scene.textures.exists(asset.key))) { ready(); return; }
  queueRuntimeImageAssets(scene, wanted, name, () => { if (scene.scene.isActive()) ready(); });
}

/** Fit an image inside a box without distorting it. */
export function fit(image: Phaser.GameObjects.Image, width: number, height: number) {
  return image.setScale(Math.min(width / image.width, height / image.height));
}

const LEADER_SUIT: Record<string, keyof typeof SUIT_COLORS> = { Plumes: 'plumes', Quills: 'quills', Basins: 'basins', Nests: 'nests' };
export function leaderAccent(leaderId: string | undefined) {
  return SUIT_COLORS[LEADER_SUIT[getLeader(leaderId).suit]] ?? 0xf0c36f;
}
export const leaderPortrait = (leaderId: string | undefined) => codexLeaderArtAssets[getLeader(leaderId).id];
export const cardArt = (cardId: string) => cardArtAssets[cardId];
export const cardName = (cardId: string) => cardLibrary[cardId]?.name ?? cardId;

export function districtIdsFor(mode: RunSummary['runMode']) {
  return runMapIndices(mode).map((index) => alphaMaps[index].id);
}
export const districtName = (mapId: string) => alphaMaps.find((map) => map.id === mapId)?.name ?? 'the city';
export const districtPainting = (mapId: string) => BATTLEFIELD_ASSETS[mapId];

export function factsFor(summary: RunSummary): RunFacts {
  return runFacts(summary, {
    districtIds: districtIdsFor(summary.runMode),
    starterIds: getLeader(summary.leaderId).startingDeckIds,
    isSnag: (id) => cardLibrary[id]?.runtime.kind === 'snag',
  });
}

/** Fold the flight log into the Daily Flight bests; safe on every visit. */
export function syncDaily(history: RunSummary[] = loadRunHistory()): DailyStore {
  const results: DailyResult[] = history.filter((run) => dailyDateFromSeed(run.seed)).map((run) => {
    const facts = factsFor(run);
    return { runId: run.id, seed: run.seed, score: flightScore(facts).total, districts: facts.districtsCleared,
      districtTotal: facts.districtTotal, result: run.result, leaderId: getLeader(run.leaderId).id };
  });
  return syncDailyStore(results);
}

/** Entrance: each object rises and fades in on the scene clock, without
 * changing its real position or alpha. Reduced Motion fades only; lean
 * graphics shows everything settled at once. */
export function enter(scene: Phaser.Scene, objects: Phaser.GameObjects.GameObject[], delayMs = 0, rise = 18) {
  const mode = motion();
  if (mode === 'lean') return;
  const start = sceneNow(scene) + paced(delayMs);
  const duration = paced(mode === 'reduced' ? 120 : 340);
  for (const object of objects) renderPose(object, () => {
    const t = (sceneNow(scene) - start) / duration;
    if (t >= 1) return undefined;
    const eased = easeOut(clamp01(t));
    return mode === 'reduced' ? { alpha: eased } : { alpha: eased, dy: (1 - eased) * rise };
  }, 'engagement-enter');
}

/** Objects added to the scene while `build` runs, in order. */
export function collect(scene: Phaser.Scene, build: () => void): Phaser.GameObjects.GameObject[] {
  const before = scene.children.list.length;
  build();
  return scene.children.list.slice(before);
}

export const readCeremonyQueue = () => parseQueue(safeStorageGet(CEREMONY_KEY));
export function writeCeremonyQueue(queue: readonly string[]) {
  if (queue.length) safeStorageSet(CEREMONY_KEY, serializeQueue(queue));
  else safeStorageRemove(CEREMONY_KEY);
}

export const thousands = (value: number) => Math.round(value).toLocaleString('en-US');
export const leaderUnlocked = (leaderId: string) => loadAccount().unlockedLeaders.includes(leaderId);

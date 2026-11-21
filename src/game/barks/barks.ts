import Phaser from 'phaser';
import content from '../../../data/game/barks.json';
import { getLeader } from '../leaders';
import { prefersLeanEffects } from '../graphics-quality';
import { prefersReducedMotion, textPacePreference, textPaceScale } from '../shared/preferences';
import { SUIT_COLORS, UI_FONT } from '../theme';
import {
  BARK_GAP_MS, BARK_HOLD_MS, BarkDeck, barkMoments, enemyFamily, placeTag,
  type BarkContent, type BarkMoment, type BarkTrigger, type CombatSnapshot, type Rect,
} from './bark-rules';

/**
 * Combat barks: a Leader or an enemy says one short line at a notable moment,
 * shown as a speech tag beside the speaker for about a second and a half.
 * Watches the battle scene from outside (lazy, loaded by the life layer) and
 * never changes game state. A tag is only drawn where it touches no panel,
 * HUD element, card or text; with no clear spot the line is dropped.
 */

const BARKS = content as unknown as BarkContent;
const TAG_HEIGHT = 34, TAG_FONT = 18, DEPTH = 940;
const LEADER_SUIT: Record<string, keyof typeof SUIT_COLORS> = { Plumes: 'plumes', Quills: 'quills', Basins: 'basins', Nests: 'nests' };

type Host = Phaser.Scene & {
  mode?: string; combatIntroActive?: boolean; combatAnimationPending?: boolean;
  flock?: { hp: number; maxHp: number }; enemies?: Array<{ id: string; hp: number; maxHp: number; phase: number; runtime?: { type?: string; id?: string } }>;
  runState?: { seed?: string; leaderId?: string }; runLeaderId?: string;
  battleActors?: { visualPoint(id: string): { x: number; y: number } | undefined; actors: Map<string, { scale: number }> };
  inspectOverlay?: unknown; waymarkDrawerOpen?: boolean; supplyDrawerOpen?: boolean; pauseOverlayOpen?: boolean; settingsOverlayOpen?: boolean;
};

interface Line { speaker: 'leader' | 'enemy'; who: string; enemyId?: string; trigger: BarkTrigger; text: string; due: number }
interface Shown { tag: Phaser.GameObjects.Container; line: Line; until: number; born: number; rect: Rect }
interface State { last?: CombatSnapshot; started: boolean; queue: Line[]; shown: Shown[]; quietUntil: number; log: Array<{ trigger: BarkTrigger; speaker: string; text: string; placed: boolean }> }

const decks = new Map<string, BarkDeck>();
const states = new WeakMap<Phaser.Scene, State>();

const now = (scene: Phaser.Scene) => scene.time.now;
const enabled = () => textPacePreference() !== 'fast';

function deckFor(seed: string) {
  let deck = decks.get(seed);
  if (!deck) { deck = new BarkDeck(BARKS, seed); decks.set(seed, deck); if (decks.size > 8) decks.delete(decks.keys().next().value!); }
  return deck;
}

function snapshot(scene: Host): CombatSnapshot {
  return {
    mode: String(scene.mode), ready: !scene.combatIntroActive && !scene.combatAnimationPending,
    flock: { hp: scene.flock?.hp ?? 0, maxHp: scene.flock?.maxHp ?? 1 },
    enemies: (scene.enemies ?? []).map(enemy => ({ id: enemy.id, hp: enemy.hp, maxHp: enemy.maxHp, phase: enemy.phase, type: enemy.runtime?.type })),
  };
}

const leaderId = (scene: Host) => getLeader(scene.runLeaderId ?? scene.runState?.leaderId).id;

function lines(scene: Host, deck: BarkDeck, moment: BarkMoment, at: number): Line[] {
  const leader = leaderId(scene), living = (scene.enemies ?? []).filter(enemy => enemy.hp > 0);
  const enemyLine = (enemyId: string | undefined, trigger: BarkTrigger, due = at): Line | undefined => {
    const enemy = (scene.enemies ?? []).find(candidate => candidate.id === enemyId);
    if (!enemy) return undefined;
    const family = enemyFamily(BARKS, enemy.runtime?.id ?? enemy.id, enemy.runtime?.type);
    const text = deck.line('enemy', family, trigger);
    return text ? { speaker: 'enemy', who: family, enemyId, trigger, text, due } : undefined;
  };
  const leaderLine = (trigger: BarkTrigger, due = at): Line | undefined => {
    const text = deck.line('leader', leader, trigger);
    return text ? { speaker: 'leader', who: leader, trigger, text, due } : undefined;
  };
  const key = `${moment.trigger}:${'enemyId' in moment ? moment.enemyId : ''}:${at}`;
  let out: Array<Line | undefined> = [];
  switch (moment.trigger) {
    case 'start': out = [enemyLine(living[0]?.id, 'start'), leaderLine('start', at + 900)]; break;
    case 'bigHit': out = [moment.target === 'flock' ? leaderLine('bigHit') : enemyLine(moment.enemyId, 'bigHit')]; break;
    case 'lowCohesion': out = [deck.coin(key) && living.length ? enemyLine(living[0].id, 'lowCohesion') : leaderLine('lowCohesion')]; break;
    case 'defeated': out = [deck.coin(key) ? enemyLine(moment.enemyId, 'defeated') : leaderLine('defeated')]; break;
    case 'phase': out = [enemyLine(moment.enemyId, 'phase'), leaderLine('phase', at + 900)]; break;
  }
  return out.filter((line): line is Line => Boolean(line));
}

/** Everything a tag must stay clear of: visible panels, text, cards and controls. */
function obstacles(scene: Phaser.Scene, mine: Set<Phaser.GameObjects.GameObject>) {
  const { width: W, height: H } = scene.scale.gameSize;
  const found: Rect[] = [];
  const visit = (object: Phaser.GameObjects.GameObject, depth: number) => {
    const shown = object as Phaser.GameObjects.GameObject & { visible?: boolean; alpha?: number };
    if (mine.has(object) || shown.visible === false || (shown.alpha ?? 1) < 0.05) return;
    if (object instanceof Phaser.GameObjects.Container) {
      if (depth < 5) object.list.forEach(child => visit(child, depth + 1));
      return;
    }
    const icon = object instanceof Phaser.GameObjects.Image && !(object instanceof Phaser.GameObjects.TileSprite);
    const solid = icon || object instanceof Phaser.GameObjects.Text
      || object instanceof Phaser.GameObjects.NineSlice
      || (object instanceof Phaser.GameObjects.Rectangle && (object.fillAlpha >= 0.2 || object.isStroked));
    if (!solid || !('getBounds' in object)) return;
    const bounds = (object as unknown as Phaser.GameObjects.Components.GetBounds).getBounds();
    // Images count when they are icons and badges; bodies and paintings are the stage.
    if (icon && (bounds.width > 72 || bounds.height > 72)) return;
    // Backdrops and full-screen shades are the stage, not furniture.
    if (bounds.width * bounds.height > W * H * 0.35 || bounds.width <= 2 || bounds.height <= 2) return;
    found.push({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height });
  };
  scene.children.list.forEach(child => visit(child, 0));
  return found;
}

function anchorFor(scene: Host, line: Line) {
  if (line.speaker === 'enemy' && line.enemyId) {
    const id = `enemy:${line.enemyId}`, point = scene.battleActors?.visualPoint(id), scale = scene.battleActors?.actors.get(id)?.scale ?? 1;
    // The body's head, not its feet: tags sit above the silhouette.
    return point ? { x: point.x, y: point.y - 60 * scale, reach: 84 * scale, ownBody: undefined } : undefined;
  }
  const portrait = findNamed(scene, 'combat-leader-portrait');
  if (portrait) {
    const b = portrait.getBounds();
    return { x: b.centerX, y: b.centerY, reach: Math.max(b.width, b.height) / 2 + 6, ownBody: b };
  }
  const point = scene.battleActors?.visualPoint('flock');
  return point ? { x: point.x, y: point.y - 50, reach: 70, ownBody: undefined } : undefined;
}

function findNamed(scene: Phaser.Scene, name: string) {
  let found: (Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.GetBounds) | undefined;
  const visit = (object: Phaser.GameObjects.GameObject, depth: number) => {
    if (found) return;
    if (object.name === name && 'getBounds' in object && (object as unknown as { visible: boolean }).visible) found = object as never;
    else if (depth < 4 && object instanceof Phaser.GameObjects.Container) object.list.forEach(child => visit(child, depth + 1));
  };
  scene.children.list.forEach(child => visit(child, 0));
  return found;
}

function accentFor(scene: Host, line: Line) {
  if (line.speaker === 'enemy') return line.who === 'boss' ? 0xffc46b : 0xff9a7a;
  return SUIT_COLORS[LEADER_SUIT[getLeader(leaderId(scene)).suit]] ?? 0xf0c36f;
}

function show(scene: Host, state: State, line: Line) {
  const mine = new Set<Phaser.GameObjects.GameObject>();
  state.shown.forEach(({ tag }) => { mine.add(tag); });
  const anchor = anchorFor(scene, line);
  const accent = accentFor(scene, line);
  const label = scene.add.text(0, 0, line.text, { fontFamily: UI_FONT, fontSize: `${TAG_FONT}px`, fontStyle: 'bold', color: '#f6f1e4', resolution: 2 })
    .setOrigin(0.5).setName('combat-bark-text');
  const width = Math.ceil(label.width) + 26;
  const { width: W, height: H } = scene.scale.gameSize;
  const blockers = obstacles(scene, new Set([...mine, label]));
  // Tags already up are obstacles too.
  state.shown.forEach(({ rect }) => blockers.push(rect));
  const rect = anchor && placeTag(anchor, width, TAG_HEIGHT, blockers, { x: 8, y: 8, width: W - 16, height: H - 16 });
  state.log.push({ trigger: line.trigger, speaker: `${line.speaker}:${line.who}`, text: line.text, placed: Boolean(rect) });
  if (state.log.length > 24) state.log.shift();
  if (!rect || !anchor) { label.destroy(); return; }
  const tag = scene.add.container(rect.x + width / 2, rect.y + TAG_HEIGHT / 2).setDepth(DEPTH).setName('combat-bark')
    .setData({ trigger: line.trigger, speaker: line.speaker, who: line.who, text: line.text, rect });
  const frame = scene.add.graphics();
  frame.fillStyle(0x020409, 0.45).fillRoundedRect(-width / 2 + 3, -TAG_HEIGHT / 2 + 4, width, TAG_HEIGHT, 9);
  frame.fillStyle(0x07101a, 0.95).fillRoundedRect(-width / 2, -TAG_HEIGHT / 2, width, TAG_HEIGHT, 9);
  frame.lineStyle(2, accent, 0.95).strokeRoundedRect(-width / 2, -TAG_HEIGHT / 2, width, TAG_HEIGHT, 9);
  // A short tail toward the speaker, inside the tag's own clearance.
  const toward = Phaser.Math.Clamp(anchor.x - (rect.x + width / 2), -width / 2 + 14, width / 2 - 14);
  const below = anchor.y > rect.y + TAG_HEIGHT;
  const edge = below ? TAG_HEIGHT / 2 : -TAG_HEIGHT / 2, tip = below ? 6 : -6;
  frame.fillStyle(0x07101a, 0.95).fillTriangle(toward - 7, edge - Math.sign(tip), toward + 7, edge - Math.sign(tip), toward, edge + tip - Math.sign(tip));
  frame.lineStyle(2, accent, 0.95).lineBetween(toward - 7, edge, toward, edge + tip).lineBetween(toward, edge + tip, toward + 7, edge);
  tag.add([frame, label]);
  const at = now(scene);
  state.shown.push({ tag, line, born: at, until: at + BARK_HOLD_MS * textPaceScale(), rect });
}

function tick(scene: Host, state: State) {
  const at = now(scene);
  const snap = snapshot(scene);
  const seed = `${scene.runState?.seed ?? 'flight'}`;
  if (enabled()) {
    const moments = barkMoments(state.last, snap, state.started);
    if (moments.some(moment => moment.trigger === 'start')) state.started = true;
    for (const moment of moments) {
      // Starts and phase turns always speak; other moments respect the gap.
      if (moment.trigger !== 'start' && moment.trigger !== 'phase' && at < state.quietUntil) continue;
      const next = lines(scene, deckFor(seed), moment, at);
      if (!next.length) continue;
      state.queue.push(...next);
      state.quietUntil = Math.max(...next.map(line => line.due)) + BARK_GAP_MS;
    }
  }
  state.last = snap;
  const modal = Boolean(scene.inspectOverlay || scene.waymarkDrawerOpen || scene.supplyDrawerOpen || scene.pauseOverlayOpen || scene.settingsOverlayOpen);
  if (snap.mode !== 'battle') state.queue = [];
  for (const line of [...state.queue]) {
    if (line.due > at) continue;
    state.queue.splice(state.queue.indexOf(line), 1);
    if (!modal && enabled()) show(scene, state, line);
  }
  const still = prefersReducedMotion() || prefersLeanEffects();
  for (const entry of [...state.shown]) {
    if (!entry.tag.active || at >= entry.until || snap.mode !== 'battle') {
      entry.tag.destroy(true);
      state.shown.splice(state.shown.indexOf(entry), 1);
      continue;
    }
    entry.tag.setVisible(!modal);
    if (still) { entry.tag.setAlpha(1).setScale(1); continue; }
    const age = at - entry.born, left = entry.until - at;
    entry.tag.setScale(age < 140 ? 0.86 + 0.14 * (age / 140) : 1).setAlpha(left < 220 ? left / 220 : 1);
  }
}

/** Watch one battle scene for bark moments until it shuts down. */
export function dressBarks(scene: Phaser.Scene) {
  if (states.has(scene)) return;
  const state: State = { started: false, queue: [], shown: [], quietUntil: 0, log: [] };
  states.set(scene, state);
  const run = () => tick(scene as Host, state);
  scene.events.on('postupdate', run);
  scene.events.on('clock-advanced', run);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off('postupdate', run);
    scene.events.off('clock-advanced', run);
    state.shown.forEach(({ tag }) => tag.destroy(true));
    states.delete(scene);
  });
}

export function barkState(scene: Phaser.Scene) {
  const state = states.get(scene);
  return state ? {
    enabled: enabled(), queued: state.queue.length, log: [...state.log], quietFor: Math.max(0, Math.round(state.quietUntil - now(scene))),
    shown: state.shown.filter(entry => entry.tag.active).map(entry => ({ ...entry.line, rect: entry.rect, visible: entry.tag.visible })),
  } : undefined;
}

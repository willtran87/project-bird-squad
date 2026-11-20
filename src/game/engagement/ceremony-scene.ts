import Phaser from 'phaser';
import { matchesControlAction } from '../input-bindings';
import { flockLeaders, getLeader } from '../leaders';
import { achievements, leaderUnlockHints, loadAccount } from '../meta';
import { announceScreenReader } from '../screen-reader-accessibility';
import { birdAudio } from '../shared/bird-audio-director';
import { syncSceneAnimationPace } from '../shared/preferences';
import { cardLibrary } from '../shared/run-session';
import { clamp01, eachFrame, easeOut, motion, paced, sceneNow } from '../spectacle/life/kit';
import { buildReveals, retire, staleEntries, type Reveal } from './ceremony-reveals';
import { C, H, LINE, W, cardArt, display, enter, fit, label, leaderAccent, leaderPortrait, readCeremonyQueue, whenLoaded, writeCeremonyQueue } from './ui';

const CARD_X = W / 2, CARD_Y = 292, CARD_W = 280, CARD_H = 400;
const FLIP_MS = 460;

/** The reveals waiting right now. Drops queue entries that can never be shown. */
export function pendingReveals(): Reveal[] {
  const queue = readCeremonyQueue();
  if (!queue.length) return [];
  const collection = loadAccount().cardCollection;
  const reveals = buildReveals(queue, {
    leader: (id) => flockLeaders.some((leader) => leader.id === id)
      ? { name: getLeader(id).name, unlock: leaderUnlockHints[id]?.replace(/^Unlocks after /, 'Unlocked: ') } : undefined,
    achievement: (id) => achievements.find((entry) => entry.id === id),
    card: (id) => cardLibrary[id] ? { name: cardLibrary[id].name, source: collection[id]?.firstSource } : undefined,
  });
  const stale = staleEntries(queue, reveals);
  if (stale.length) writeCeremonyQueue(retire(queue, stale));
  return reveals;
}

interface HostInput { enabled: boolean; keyboard?: { enabled: boolean } | null; gamepad?: { enabled: boolean } | null }

/**
 * Collection ceremony: one short reveal per new card, Leader or achievement.
 *
 * Properly modal. It runs as its own scene above the title or Collection and
 * switches that scene's input off while it is up, so the key, click or button
 * that dismisses a reveal can never also act on the screen underneath. Any
 * key, click or controller button moves on; Back (Escape, B) skips the rest.
 */
export class CeremonyScene extends Phaser.Scene {
  private reveals: Reveal[] = [];
  private index = 0;
  private flipped = false;
  private hostKey = '';
  private parts: Phaser.GameObjects.GameObject[] = [];
  private shownAt = 0;
  private back?: Phaser.GameObjects.Container;
  private face?: Phaser.GameObjects.Container;
  private glow?: Phaser.GameObjects.Rectangle;

  constructor() {
    super('CeremonyScene');
  }

  state() {
    const reveal = this.reveals[this.index];
    return { active: this.sys.isActive(), host: this.hostKey, index: this.index, total: this.reveals.length, flipped: this.flipped,
      reveal: reveal && { kind: reveal.kind, id: reveal.id, kicker: reveal.kicker, title: reveal.title, why: reveal.why } };
  }

  create(data: { hostKey?: string } = {}) {
    syncSceneAnimationPace(this);
    this.reveals = pendingReveals();
    this.index = 0;
    this.parts = [];
    this.hostKey = data.hostKey ?? '';
    if (!this.reveals.length) { this.scene.stop(); return; }
    this.scene.bringToTop();

    // Take input away from the scene underneath for as long as this one is up.
    const host = this.hostKey ? this.scene.get(this.hostKey) : undefined;
    const input = host?.input as unknown as HostInput | undefined;
    const lend = (enabled: boolean) => {
      if (!input) return;
      input.enabled = enabled;
      if (input.keyboard) input.keyboard.enabled = enabled;
      if (input.gamepad) input.gamepad.enabled = enabled;
    };
    lend(false);
    // Nothing else in the game switches these off, so handing back is always "on";
    // restoring a remembered value could strand a scene that restarted mid-reveal.
    // If a new reveal has already started above the same scene, it owns the hand-back.
    const restore = () => { if (!this.sys.isActive()) lend(true); };
    const hostGone = () => this.scene.stop();
    host?.events.once(Phaser.Scenes.Events.SHUTDOWN, hostGone);

    const scrim = this.add.rectangle(W / 2, H / 2, W, H, 0x020409, 0.94).setInteractive().setName('ceremony-scrim');
    enter(this, [scrim], 0, 0);

    const next = () => {
      if (this.index + 1 >= this.reveals.length) { this.scene.stop(); return; }
      this.index += 1;
      this.show();
    };
    const skipAll = () => {
      writeCeremonyQueue(retire(readCeremonyQueue(), this.reveals.flatMap((reveal) => reveal.consumes)));
      birdAudio.play('ui.cancel');
      this.scene.stop();
    };
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault?.();
      if (event.repeat) return;
      if (matchesControlAction(event, 'back')) skipAll();
      else next();
    };
    const onPad = (_pad: unknown, button: { index: number }) => (button.index === 1 ? skipAll() : next());
    this.input.keyboard?.on('keydown', onKey);
    this.input.gamepad?.on('down', onPad);
    scrim.on('pointerdown', next);

    eachFrame(this, () => this.pose());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown', onKey);
      this.input.gamepad?.off('down', onPad);
      host?.events.off(Phaser.Scenes.Events.SHUTDOWN, hostGone);
      // Hand input back after this step, once the key that closed the reveal
      // has left the keyboard queue.
      this.game.events.once(Phaser.Core.Events.POST_STEP, restore);
    });
    birdAudio.play('stinger.play', { id: 'reward' });
    this.show();
  }

  private show() {
    this.parts.forEach((part) => part.destroy());
    const reveal = this.reveals[this.index];
    // Shown once: retire it now, so closing the tab mid-reveal never repeats it.
    writeCeremonyQueue(retire(readCeremonyQueue(), reveal.consumes));
    const accent = reveal.kind === 'leader' ? leaderAccent(reveal.id) : reveal.kind === 'achievement' ? 0xe8b830 : 0x8df4ff;
    const last = this.index === this.reveals.length - 1;

    const kicker = label(this, W / 2, 44, reveal.kicker, 21, C.gold, 'bold').setOrigin(0.5, 0).setLetterSpacing(5).setName('ceremony-kicker');
    this.glow = this.add.rectangle(CARD_X, CARD_Y, CARD_W + 36, CARD_H + 36, accent, 0).setBlendMode(Phaser.BlendModes.ADD);
    this.back = this.add.container(CARD_X, CARD_Y, [
      this.add.rectangle(0, 0, CARD_W, CARD_H, 0x101c28).setStrokeStyle(2, 0xd6b66f, 0.7),
      this.add.rectangle(0, 0, CARD_W - 32, CARD_H - 32, 0x0b151f).setStrokeStyle(1, LINE),
      ...(this.textures.exists('title-bird') ? [fit(this.add.image(0, 0, 'title-bird'), 170, 90).setAlpha(0.55)] : []),
    ]).setName('ceremony-card-back');
    this.face = this.add.container(CARD_X, CARD_Y).setName('ceremony-card-face').setData('kind', reveal.kind).setData('id', reveal.id);
    this.buildFace(this.face, reveal, accent);
    const title = display(this, W / 2, 522, reveal.title, 40).setOrigin(0.5, 0).setName('ceremony-title');
    const why = label(this, W / 2, 582, reveal.why, 21, C.soft).setOrigin(0.5, 0).setAlign('center')
      .setWordWrapWidth(1040, true).setLineSpacing(4).setName('ceremony-why');
    const hint = label(this, W / 2, 676, `${this.index + 1} of ${this.reveals.length}   ·   Any key or click: ${last ? 'done' : 'next'}`
      + `${last ? '' : '   ·   Esc: skip all'}`, 20, C.muted).setOrigin(0.5).setName('ceremony-hint');
    this.parts = [kicker, this.glow, this.back, this.face, title, why, hint];

    announceScreenReader(`${reveal.kicker}: ${reveal.title}. ${reveal.why} ${this.index + 1} of ${this.reveals.length}. Any key continues.`);
    this.shownAt = sceneNow(this);
    this.flipped = motion() !== 'full';
    enter(this, [kicker], 0, 8);
    enter(this, [title, why], motion() === 'full' ? FLIP_MS * 0.6 : 0, 14);
    this.pose();
    birdAudio.play('material.tap', { material: 'paper', intensity: 0.8 });
    if (reveal.kind === 'leader') birdAudio.play('voice.leader', { leader: reveal.id });
  }

  private buildFace(face: Phaser.GameObjects.Container, reveal: Reveal, accent: number) {
    face.add(this.add.rectangle(0, 0, CARD_W, CARD_H, 0x0b151f).setStrokeStyle(2, accent, 0.85));
    if (reveal.kind === 'achievement') {
      face.add([
        this.add.rectangle(0, 0, CARD_W - 28, CARD_H - 28, accent, 0.08).setStrokeStyle(1, accent, 0.4),
        this.add.circle(0, -36, 94, 0x101c28).setStrokeStyle(3, accent, 0.9),
        this.add.star(0, -36, 5, 30, 68, accent, 0.95),
        label(this, 0, 104, 'Earned', 20, C.gold, 'bold').setOrigin(0.5).setLetterSpacing(3),
      ]);
      return;
    }
    const asset = reveal.kind === 'leader' ? leaderPortrait(reveal.id) : cardArt(reveal.id);
    if (reveal.kind === 'leader') {
      face.add([
        this.add.rectangle(0, -20, CARD_W - 28, CARD_H - 76, accent, 0.14).setStrokeStyle(1, accent, 0.45),
        label(this, 0, 172, getLeader(reveal.id).bird, 19, C.soft).setOrigin(0.5),
      ]);
    }
    // The name stands in until the picture arrives, and stays if it never does.
    const stand = label(this, 0, reveal.kind === 'leader' ? -20 : 0, reveal.title, 22, C.text).setOrigin(0.5).setAlign('center')
      .setWordWrapWidth(CARD_W - 56, true);
    face.add(stand);
    whenLoaded(this, [asset], 'Collection ceremony', () => {
      if (!asset || !this.textures.exists(asset.key) || !face.active) return;
      stand.setVisible(false);
      face.add(reveal.kind === 'leader'
        ? fit(this.add.image(0, -20, asset.key), CARD_W - 40, CARD_H - 92)
        : fit(this.add.image(0, 0, asset.key), CARD_W - 8, CARD_H - 8));
    });
  }

  /** The flip, as a pure function of the scene clock. */
  private pose() {
    if (!this.back?.active || !this.face?.active) return;
    const t = motion() === 'full' ? clamp01((sceneNow(this) - this.shownAt) / paced(FLIP_MS)) : 1;
    const turn = easeOut(t);
    this.flipped = turn >= 0.5;
    this.back.setVisible(turn < 0.5).setScale(Math.max(0.02, 1 - turn * 2), 1);
    // A small lift as the face lands.
    const lift = 1 + 0.06 * Math.sin(Math.PI * clamp01((turn - 0.5) * 2));
    this.face.setVisible(turn >= 0.5).setScale(Math.max(0.02, turn * 2 - 1) * lift, lift);
    this.glow?.setAlpha(motion() === 'full' ? 0.22 * Math.sin(Math.PI * clamp01((sceneNow(this) - this.shownAt) / paced(FLIP_MS * 2.2))) : 0);
  }
}

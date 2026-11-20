import Phaser from 'phaser';
import { bindActionFocus } from '../action-focus';
import { bindControlActions } from '../input-bindings';
import { difficultyLabel } from '../difficulty';
import { getLeader } from '../leaders';
import { closingLine } from '../narrative-threads';
import { quietButton } from '../quiet-ui';
import { safeStorageSet } from '../safe-storage';
import { advanceGameTime } from '../scene-runtime';
import { announceScreenReader } from '../screen-reader-accessibility';
import { birdAudio } from '../shared/bird-audio-director';
import { syncSceneAnimationPace } from '../shared/preferences';
import { loadRunHistory } from '../shared/run-state';
import type { RunSummary } from '../shared/runtime-types';
import { playUiSound } from '../shared/ui-helpers';
import { clamp01, eachFrame, easeOut, motion, paced, sceneNow } from '../spectacle/life/kit';
import { dailyDateFromSeed } from './daily-flight';
import { flightScore, formatDuration, type RunFacts } from './run-facts';
import { C, H, LINE, PLATE, W, backdrop, cardName, display, districtName, districtPainting, enter, factsFor, fit, label, leaderAccent, leaderPortrait, thousands, whenLoaded } from './ui';

export const RECAP_SEEN_KEY = 'birdsquad.recapSeen';

export interface RecapSceneData {
  /** A flight from the flight log; defaults to the most recent one. */
  runId?: string;
  /** Scene to return to. Defaults to the title. */
  returnTo?: string;
}

const CARD_W = 1000, CARD_H = 500;
const RECAP_POSE = { x: W / 2, y: 322, scale: 1 }, PHOTO_POSE = { x: W / 2, y: H / 2, scale: 1.12 };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `run-<startedAtMs>-flight-<seed>`: the id carries the day the flight began. */
export function flightDateLabel(runId: string): string {
  const started = Number(/^run-(\d+)-/.exec(runId)?.[1]);
  if (!Number.isFinite(started) || started <= 0) return '';
  const date = new Date(started);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export const recapFilename = (seed: string) => `bird-squad-flight-${seed.replace(/[^a-z0-9_-]/gi, '').slice(0, 32) || 'recap'}.png`;

function downloadPng(dataUrl: string, filename: string) {
  const encoded = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const bytes = new Uint8Array(encoded.length);
  for (let index = 0; index < encoded.length; index += 1) bytes[index] = encoded.charCodeAt(index);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return bytes.length;
}

/**
 * Run recap: one finished flight as a card, read from the flight log the
 * Flock Record already keeps. Photo view hides every control so the card can
 * be shared; Save PNG snapshots that view and downloads it.
 */
export class RecapScene extends Phaser.Scene {
  private view: 'recap' | 'photo' = 'recap';
  private chrome: Array<Phaser.GameObjects.GameObject & { setVisible(value: boolean): unknown }> = [];
  private card?: Phaser.GameObjects.Container;
  private veil?: Phaser.GameObjects.Rectangle;
  private status?: Phaser.GameObjects.Text;
  private photoHint?: Phaser.GameObjects.Text;
  private viewFrame = -1;
  private saving = false;
  private photosSaved = 0;
  private lastPhoto?: { filename: string; bytes: number; width: number; height: number };

  constructor() {
    super('RecapScene');
  }

  create(data: RecapSceneData = {}) {
    syncSceneAnimationPace(this);
    birdAudio.setMood('menu');
    this.view = 'recap';
    this.chrome = [];
    this.card = undefined;
    this.saving = false;
    this.photosSaved = 0;
    this.lastPhoto = undefined;
    const runs = loadRunHistory();
    const found = runs.findIndex((run) => run.id === data.runId);
    const index = found >= 0 ? found : runs.length - 1;
    const summary = runs[index];
    const returnTo = data.returnTo ?? 'MenuScene';
    const back = () => { playUiSound('close'); this.scene.start(returnTo); };
    window.advanceTime = (ms: number) => advanceGameTime(this.game, ms);

    const painting = summary ? districtPainting(summary.mapId) : undefined;
    const { art, veil } = backdrop(this, painting?.key ?? 'splash', 0.74);
    this.veil = veil;
    if (painting) whenLoaded(this, [painting], 'Flight recap', () => { if (this.textures.exists(painting.key)) art.setTexture(painting.key).setDisplaySize(W, H); });

    const title = display(this, 80, 18, 'Flight Recap', 28, C.gold).setName('recap-title');
    this.chrome.push(title);
    const owner = this.add.zone(0, 0, 1, 1).setName('recap-actions');
    this.chrome.push(owner);

    if (!summary) {
      this.chrome.push(label(this, W / 2, 320, 'No finished flights yet. Finish a run to see its recap here.', 22, C.soft).setOrigin(0.5).setName('recap-empty'));
      const hit = quietButton(this, { x: W / 2, y: 420, width: 200, label: 'Back', name: 'recap-back', kind: 'primary', onActivate: back });
      bindActionFocus(this, owner, [{ hit, label: 'Back', run: back }], back);
      window.render_game_to_text = () => JSON.stringify({ mode: 'runRecap', scene: 'RecapScene', total: 0 });
      return;
    }

    safeStorageSet(RECAP_SEEN_KEY, runs[runs.length - 1].id);
    const facts = factsFor(summary);
    const score = flightScore(facts);
    const win = summary.result === 'win';
    const place = districtName(summary.mapId);
    const headline = win ? 'Every district cleared' : `Scattered at ${place}`;
    const closing = closingLine(summary.seed, summary.leaderId, summary.result, place);
    const counters = this.buildCard(summary, facts, score.total, headline, closing);
    announceScreenReader(`Flight recap. ${getLeader(summary.leaderId).name}. ${headline}. ${closing} `
      + `${facts.districtsCleared} of ${facts.districtTotal} districts cleared, ${facts.fightsWon} fights won, score ${thousands(score.total)}.`);

    this.chrome.push(label(this, 1200, 28, `${index + 1} of ${runs.length} in the flight log`, 19, C.muted).setOrigin(1, 0).setName('recap-position'));
    this.status = label(this, W / 2, 604, 'Photo view hides these controls. Save PNG downloads the card as a picture.', 20, C.soft)
      .setOrigin(0.5).setName('recap-status');
    this.chrome.push(this.status);
    this.photoHint = label(this, W / 2, H - 22, '', 19, C.muted).setOrigin(0.5).setVisible(false);

    const go = (to: number) => () => { playUiSound('confirm'); this.scene.restart({ runId: runs[to].id, returnTo }); };
    const specs: Array<{ id: string; text: string; width: number; run: () => void; enabled?: boolean; primary?: boolean }> = [
      { id: 'older', text: '‹ Older', width: 140, run: go(index - 1), enabled: index > 0 },
      { id: 'newer', text: 'Newer ›', width: 140, run: go(index + 1), enabled: index < runs.length - 1 },
      { id: 'photo', text: 'Photo view', width: 180, run: () => { playUiSound('confirm'); this.setView('photo'); }, primary: true },
      { id: 'save', text: 'Save PNG', width: 180, run: () => this.savePhoto(recapFilename(summary.seed)) },
      { id: 'back', text: 'Back', width: 140, run: back },
    ];
    const gap = 16;
    let x = (W - specs.reduce((sum, spec) => sum + spec.width, 0) - gap * (specs.length - 1)) / 2;
    const actions = specs.map((spec) => {
      const hit = quietButton(this, { x: x + spec.width / 2, y: 660, width: spec.width, label: spec.text, name: `recap-${spec.id}`,
        kind: spec.primary ? 'primary' : 'secondary', enabled: spec.enabled !== false, onActivate: spec.run });
      x += spec.width + gap;
      this.chrome.push(hit, hit.getData('labelObject'));
      return { hit, label: spec.text, run: spec.run };
    });
    bindActionFocus(this, owner, actions, back, { initialIndex: 2 });

    // Registered after the action focus, so a key that enters or leaves photo
    // view is never also read by the control it uncovers.
    const leavePhoto = (event?: { repeat?: boolean }) => {
      if (this.view !== 'photo' || this.saving || event?.repeat || this.game.loop.frame === this.viewFrame) return;
      this.setView('recap');
    };
    // Bound action keys never reach the generic key event, so listen for both.
    bindControlActions(this, { confirm: leavePhoto, back: leavePhoto, previous: leavePhoto, next: leavePhoto });
    this.input.keyboard?.on('keydown', leavePhoto);
    this.input.on('pointerdown', leavePhoto);
    this.input.gamepad?.on('down', leavePhoto);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown', leavePhoto);
      this.input.off('pointerdown', leavePhoto);
      this.input.gamepad?.off('down', leavePhoto);
    });

    // Entrance: the card rises in, then its numbers count up. Reduced Motion
    // fades the card and shows the final numbers at once.
    enter(this, [this.card!], 0, 26);
    enter(this, this.chrome.filter((object) => object !== owner), 200, 8);
    const counting = motion() === 'full';
    const start = sceneNow(this) + paced(260), duration = paced(760);
    let settled = !counting;
    const paint = (progress: number) => counters.forEach(({ text, value, format }, order) => {
      const local = clamp01(progress * 1.35 - order * 0.035);
      text.setText(format(Math.round(value * easeOut(local))));
    });
    paint(counting ? 0 : 1);
    if (counting) {
      birdAudio.play('material.tap', { material: 'paper', intensity: 0.6 });
      eachFrame(this, () => {
        if (settled) return;
        const progress = clamp01((sceneNow(this) - start) / duration);
        paint(progress);
        if (progress >= 1) { settled = true; paint(1); }
      });
    }

    window.render_game_to_text = () => JSON.stringify({
      mode: 'runRecap', scene: 'RecapScene', runId: summary.id, seed: summary.seed, index, total: runs.length,
      view: this.view, result: summary.result, leader: getLeader(summary.leaderId).name, headline, closing,
      daily: Boolean(dailyDateFromSeed(summary.seed)), facts, score: score.total, scoreLines: score.lines,
      settled, chromeVisible: this.chrome.filter((object) => object !== owner).every((object) => (object as unknown as { visible: boolean }).visible),
      photosSaved: this.photosSaved, lastPhoto: this.lastPhoto, saving: this.saving,
      status: this.status?.text, focus: owner.getData('actionFocus'),
    });
  }

  private buildCard(summary: RunSummary, facts: RunFacts, score: number, headline: string, closing: string) {
    const win = summary.result === 'win';
    const leader = getLeader(summary.leaderId);
    const accent = win ? 0xe8b830 : 0xff8f7a, accentText = win ? C.gold : C.loss;
    const card = this.add.container(RECAP_POSE.x, RECAP_POSE.y).setName('recap-card');
    this.card = card;
    const left = -CARD_W / 2, top = -CARD_H / 2, colX = -190;
    const counters: Array<{ text: Phaser.GameObjects.Text; value: number; format: (value: number) => string }> = [];
    const daily = dailyDateFromSeed(summary.seed);
    const when = [flightDateLabel(summary.id), daily ? 'Daily Flight' : ''].filter(Boolean).join(' · ');

    card.add([
      this.add.rectangle(4, 6, CARD_W, CARD_H, 0x000000, 0.4),
      this.add.rectangle(0, 0, CARD_W, CARD_H, PLATE, 0.96).setStrokeStyle(2, accent, 0.75).setName('recap-card-plate'),
      this.add.rectangle(0, top + 6, CARD_W - 24, 6, accent, 0.9),
      this.add.rectangle(-350, -44, 244, 316, leaderAccent(leader.id), 0.14).setStrokeStyle(1, leaderAccent(leader.id), 0.5),
      display(this, -350, 126, leader.name, 26, C.gold).setOrigin(0.5, 0).setName('recap-leader'),
      label(this, -350, 164, leader.bird, 19, C.soft).setOrigin(0.5, 0),
      label(this, -350, 192, `${difficultyLabel(summary.difficulty ?? 0)} · ${summary.runMode === 'quick' ? 'Quick flight' : 'Full flight'}`, 19, C.muted).setOrigin(0.5, 0),
      label(this, colX, top + 26, win ? 'FLIGHT COMPLETE' : 'FLOCK SCATTERED', 20, accentText, 'bold').setLetterSpacing(3).setName('recap-kicker'),
      label(this, 470, top + 27, when, 19, C.muted).setOrigin(1, 0).setName('recap-when'),
      display(this, colX, top + 54, headline, 38).setName('recap-headline'),
      label(this, colX, top + 108, closing, 20, C.soft, 'italic').setWordWrapWidth(650, true).setLineSpacing(4).setMaxLines(2).setName('recap-closing'),
      this.add.rectangle(140, top + 172, 660, 1, LINE),
      this.add.rectangle(140, 152, 660, 1, LINE),
    ]);

    const plain = (suffix = '') => (value: number) => `${thousands(value)}${suffix}`;
    const cells: Array<[string, number, (value: number) => string]> = [
      ['Districts cleared', facts.districtsCleared, (value) => `${value} / ${facts.districtTotal}`],
      ['Fights won', facts.fightsWon, plain()],
      ['Time', facts.durationMs, formatDuration],
      ['Damage dealt', facts.damageDealt, plain()],
      ['Damage taken', facts.damageTaken, plain()],
      ['Biggest fight', facts.bestFightDamage, plain(' dmg')],
      ['Deck', facts.deckSize, plain(' cards')],
      ['Cards added', facts.cardsAdded, plain()],
      ['Waymarks', facts.waymarks, plain()],
    ];
    cells.forEach(([name, value, format], order) => {
      const x = colX + (order % 3) * 222, y = top + 186 + Math.floor(order / 3) * 70;
      const text = display(this, x, y + 24, format(value), 30).setName('recap-stat-value').setData('stat', name);
      card.add([label(this, x, y, name, 19, C.muted).setName('recap-stat-label'), text]);
      counters.push({ text, value, format });
    });

    if (facts.topCard) {
      card.add(label(this, colX, 164, `Top card: ${cardName(facts.topCard.cardId)} · ${thousands(facts.topCard.damage)} damage`, 20, C.soft)
        .setName('recap-top-card'));
    }
    const scoreText = display(this, colX + 86, 196, thousands(score), 36, C.gold).setName('recap-score');
    card.add([label(this, colX, 210, 'SCORE', 19, C.muted, 'bold').setLetterSpacing(2), scoreText]);
    counters.push({ text: scoreText, value: score, format: thousands });

    // The wordmark makes the saved picture stand on its own.
    if (this.textures.exists('title-bird') && this.textures.exists('title-squad')) {
      card.add([fit(this.add.image(352, 214, 'title-bird'), 96, 44), fit(this.add.image(436, 216, 'title-squad'), 96, 40)]);
    } else {
      card.add(label(this, 470, 204, 'BIRD SQUAD', 20, C.gold, 'bold').setOrigin(1, 0).setLetterSpacing(3));
    }

    const portrait = leaderPortrait(leader.id);
    whenLoaded(this, [portrait], 'Flight recap', () => {
      if (!portrait || !this.textures.exists(portrait.key) || !card.active) return;
      card.add(fit(this.add.image(-350, -44, portrait.key), 232, 304).setName('recap-portrait'));
    });
    return counters;
  }

  private setView(view: 'recap' | 'photo') {
    this.view = view;
    this.viewFrame = this.game.loop.frame;
    const photo = view === 'photo';
    this.chrome.forEach((object) => object.setVisible(!photo));
    const pose = photo ? PHOTO_POSE : RECAP_POSE;
    this.card?.setPosition(pose.x, pose.y).setScale(pose.scale);
    this.veil?.setFillStyle(0x05090f, photo ? 0.36 : 0.74);
    // The way back is said once, then gets out of the picture.
    this.photoHint?.setText('Any key or click returns').setVisible(photo && !this.saving).setAlpha(1);
    if (photo && !this.saving) {
      const shown = sceneNow(this);
      const fade = () => {
        if (this.view !== 'photo') { this.events.off(Phaser.Scenes.Events.PRE_RENDER, fade); return; }
        this.photoHint?.setAlpha(1 - clamp01((sceneNow(this) - shown - 1600) / 500));
      };
      this.events.on(Phaser.Scenes.Events.PRE_RENDER, fade);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.PRE_RENDER, fade));
    }
  }

  /** Snapshot the photo view (no controls, no hint) and download it. */
  private savePhoto(filename: string) {
    if (this.saving) return;
    this.saving = true;
    playUiSound('confirm');
    this.setView('photo');
    this.game.renderer.snapshot((snapshot) => {
      this.saving = false;
      let bytes = 0;
      const image = snapshot as HTMLImageElement;
      try { bytes = downloadPng(image.src, filename); } catch { bytes = 0; }
      if (!this.sys.isActive()) return;
      this.setView('recap');
      if (bytes) {
        this.photosSaved += 1;
        this.lastPhoto = { filename, bytes, width: image.width, height: image.height };
      }
      this.status?.setText(bytes ? `Saved ${filename}` : 'The picture could not be saved. Try Photo view and a screenshot instead.');
    }, 'image/png');
  }
}

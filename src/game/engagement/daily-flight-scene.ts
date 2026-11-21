import Phaser from 'phaser';
import { bindActionFocus } from '../action-focus';
import { flockLeaders, getLeader } from '../leaders';
import { quietButton } from '../quiet-ui';
import { advanceGameTime } from '../scene-runtime';
import { announceScreenReader } from '../screen-reader-accessibility';
import { birdAudio } from '../shared/bird-audio-director';
import { syncSceneAnimationPace } from '../shared/preferences';
import { createInitialRunState, loadActiveRun, recoverFinishedRun } from '../shared/run-state';
import { playUiSound } from '../shared/ui-helpers';
import { dailyBestFor, dailyDateKey, dailyDateLabel, dailyHistory, dailyLeaderId, dailySeed, type DailyBest } from './daily-flight';
import { SCORE_RULES } from './run-facts';
import { C, LINE, PLATE, backdrop, collect, display, enter, fit, label, leaderAccent, leaderPortrait, leaderUnlocked, syncDaily, thousands, whenLoaded } from './ui';

/**
 * Daily Flight: today's seed, today's Leader, and this browser's bests.
 * A whole scene of its own, so it owns its input like the Collection does.
 */
export class DailyFlightScene extends Phaser.Scene {
  constructor() {
    super('DailyFlightScene');
  }

  create() {
    syncSceneAnimationPace(this);
    birdAudio.setMood('menu');
    const date = dailyDateKey();
    const seed = dailySeed(date);
    const leader = getLeader(dailyLeaderId(seed, flockLeaders.map((entry) => entry.id)));
    const store = syncDaily();
    const best = dailyBestFor(store, date);
    const history = dailyHistory(store, date, 4);
    const saved = loadActiveRun();
    const resumes = saved?.seed === seed;
    const replaces = Boolean(saved) && !resumes;

    backdrop(this, 'splash', 0.88);
    const header = collect(this, () => {
      label(this, 80, 46, 'DAILY FLIGHT', 21, C.gold, 'bold').setLetterSpacing(4).setName('daily-kicker');
      display(this, 80, 74, dailyDateLabel(date), 50).setName('daily-date');
      label(this, 80, 144, 'One route for everyone today. Standard difficulty, full flight.', 21, C.soft);
      label(this, 1200, 54, `Flight ${seed}`, 19, C.muted).setOrigin(1, 0).setName('daily-seed');
      if (!leaderUnlocked(leader.id)) {
        label(this, 1200, 84, 'Not in your roster yet: on loan for today.', 19, C.cyan).setOrigin(1, 0).setName('daily-leader-loan');
      }
      this.add.rectangle(640, 188, 1120, 1, LINE);
    });

    const leaderPanel = collect(this, () => {
      this.add.rectangle(350, 372, 540, 330, PLATE, 0.94).setStrokeStyle(1, LINE).setName('daily-leader-panel');
      label(this, 104, 224, "TODAY'S LEADER", 19, C.muted, 'bold').setLetterSpacing(2);
      this.add.rectangle(190, 384, 164, 228, leaderAccent(leader.id), 0.14).setStrokeStyle(1, leaderAccent(leader.id), 0.5);
      display(this, 296, 256, leader.name, 30, C.gold).setName('daily-leader-name');
      label(this, 296, 300, `${leader.bird} · ${leader.suit}`, 20, C.soft);
      label(this, 296, 336, leader.blurb, 20, C.text).setWordWrapWidth(300, true).setLineSpacing(4).setMaxLines(3);
      label(this, 296, 424, leader.signatureName, 19, C.gold, 'bold').setName('daily-leader-signature');
      label(this, 296, 450, leader.signatureText, 19, C.soft).setWordWrapWidth(300, true).setLineSpacing(3).setMaxLines(3);
    });
    whenLoaded(this, [leaderPortrait(leader.id)], 'Daily Flight', () => {
      const asset = leaderPortrait(leader.id);
      if (!asset || !this.textures.exists(asset.key)) return;
      enter(this, [fit(this.add.image(190, 384, asset.key), 156, 216).setName('daily-leader-portrait')], 0, 0);
    });

    const bestPanel = collect(this, () => {
      this.add.rectangle(930, 372, 540, 330, PLATE, 0.94).setStrokeStyle(1, LINE).setName('daily-best-panel');
      label(this, 684, 224, 'YOUR BEST TODAY', 19, C.muted, 'bold').setLetterSpacing(2);
      if (best) {
        display(this, 684, 246, thousands(best.score), 54, C.gold).setName('daily-best-score');
        label(this, 684, 318, bestDetail(best), 20, C.soft).setName('daily-best-detail');
      } else {
        display(this, 684, 256, 'Not flown yet', 34, C.soft).setName('daily-best-score');
        label(this, 684, 318, 'Your best score for today is kept on this device.', 20, C.soft).setName('daily-best-detail');
      }
      this.add.rectangle(930, 358, 492, 1, LINE);
      label(this, 684, 372, 'EARLIER DAYS', 19, C.muted, 'bold').setLetterSpacing(2);
      if (!history.length) label(this, 684, 408, 'Fly on other days to build a history here.', 20, C.soft).setName('daily-history-empty');
      history.forEach((entry, index) => {
        const y = 404 + index * 32;
        label(this, 684, y, dailyDateLabel(entry.date), 20, C.text).setName('daily-history-date');
        label(this, 826, y, getLeader(entry.leaderId).name.replace(/^The /, ''), 20, C.soft);
        label(this, 1056, y, `${entry.districts}/${entry.districtTotal}`, 20, C.soft).setOrigin(1, 0);
        label(this, 1176, y, thousands(entry.score), 20, entry.result === 'win' ? C.gold : C.text, 'bold').setOrigin(1, 0).setName('daily-history-score');
      });
    });

    const footer = collect(this, () => {
      label(this, 80, 554, `Score: ${thousands(SCORE_RULES.district)} per district cleared and ${SCORE_RULES.fight} per fight won. `
        + `Completing the flight adds ${thousands(SCORE_RULES.finish)}, ${SCORE_RULES.cohesion} per Cohesion kept, and a pace bonus `
        + `(${SCORE_RULES.paceBudget} minus ${SCORE_RULES.beat} per beat).`, 19, C.muted).setWordWrapWidth(1120, true).setLineSpacing(3).setName('daily-score-rule');
      if (replaces) label(this, 640, 618, 'Starting today\'s route replaces your saved flight.', 20, C.loss).setOrigin(0.5).setName('daily-replace-warning');
    });

    const flyLabel = resumes ? "Continue today's flight" : best ? 'Fly it again' : "Fly today's route";
    const back = () => { playUiSound('close'); this.scene.start('MenuScene'); };
    const fly = () => {
      // The title owns failed-save recovery; never start over an unsaved result.
      if (!recoverFinishedRun()) { this.scene.start('MenuScene'); return; }
      const runState = resumes && saved ? saved : createInitialRunState(leader.id, 0, 'full', seed);
      birdAudio.play('route', 0.76);
      this.scene.start(runState.pendingCombatReward ? 'BattleScene' : 'RouteScene', { runState, routeNodeId: runState.pendingCombatReward?.nodeId });
    };
    const flyHit = quietButton(this, { x: 520, y: 668, width: 330, label: flyLabel, name: 'daily-fly', kind: 'primary', onActivate: fly });
    const backHit = quietButton(this, { x: 826, y: 668, width: 200, label: 'Back', name: 'daily-back', onActivate: back });
    const owner = this.add.zone(0, 0, 1, 1).setName('daily-actions');
    bindActionFocus(this, owner, [{ hit: flyHit, label: flyLabel, run: fly }, { hit: backHit, label: 'Back', run: back }], back);

    enter(this, header);
    enter(this, leaderPanel, 80);
    enter(this, bestPanel, 160);
    enter(this, [...footer, flyHit, flyHit.getData('labelObject'), backHit, backHit.getData('labelObject')], 240, 10);

    announceScreenReader(`Daily Flight, ${dailyDateLabel(date)}. Today's Leader: ${leader.name}. `
      + `${best ? `Your best today: ${thousands(best.score)}, ${bestDetail(best)}.` : 'Not flown yet today.'} ${flyLabel} is focused.`);
    window.advanceTime = (ms: number) => advanceGameTime(this.game, ms);
    window.render_game_to_text = () => JSON.stringify({
      mode: 'dailyFlight', scene: 'DailyFlightScene', date, seed, leaderId: leader.id, leaderName: leader.name,
      leaderUnlocked: leaderUnlocked(leader.id), best: best ?? null, history, resumes, replaces, flyLabel,
      focus: owner.getData('actionFocus'),
    });
  }
}

function bestDetail(best: DailyBest) {
  const outcome = best.result === 'win' ? 'Flight completed' : 'Flock scattered';
  return `${best.districts} / ${best.districtTotal} districts · ${outcome} · ${best.attempts} attempt${best.attempts === 1 ? '' : 's'}`;
}

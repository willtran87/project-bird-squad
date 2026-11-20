import type { SynthAudioCue } from './audio-sfx';
import type { BirdAudioEvent } from './audio-events';

export type BudgetedCue = SynthAudioCue | BirdAudioEvent;

const supporting = new Set<BudgetedCue>(['draw', 'discard', 'shuffle', 'flow', 'cover', 'heal', 'bank', 'spend', 'moltPower', 'rooftopAir', 'canalAir', 'spireAir', 'roostAir',
  'card.draw', 'card.discard', 'ui.click', 'material.tap', 'voice.suit', 'count.tick']);
const essential = new Set<BudgetedCue>(['attack', 'heavyAttack', 'hitConfirm', 'coverBreak', 'threat', 'enemyCommitment',
  'locked', 'victory', 'victoryFanfare', 'defeat', 'roostHandoff', 'playerTurnRally',
  'hit.impact', 'cover.break', 'stinger.play', 'voice.leader', 'battle.enter']);
/** Cues that are meant to repeat quickly keep a shorter same-cue gap. */
const repeatGapMs: Partial<Record<BudgetedCue, number>> = { 'count.tick': 30 };

/** Coalesce bursts without queuing stale sounds or delaying tactical feedback. */
export class AudioCueBudget {
  private last = new Map<BudgetedCue, number>();
  private supportTimes: number[] = [];
  private quietUntil = -Infinity;

  accepts(cue: BudgetedCue, nowMs: number) {
    const important = essential.has(cue) || /^flock[A-Z]/.test(cue);
    if (nowMs - (this.last.get(cue) ?? -Infinity) < (repeatGapMs[cue] ?? (important ? 40 : 80))) return false;
    this.supportTimes = this.supportTimes.filter(time => nowMs - time < 100);
    if (supporting.has(cue)) {
      if (nowMs < this.quietUntil || this.supportTimes.length >= 3) return false;
      this.supportTimes.push(nowMs);
    }
    if (important) this.quietUntil = nowMs + 100;
    this.last.set(cue, nowMs);
    return true;
  }
}

const budgets = new WeakMap<object, AudioCueBudget>();

/** One budget per AudioContext, shared by legacy cues and typed events. */
export function budgetFor(ctx: object) {
  let budget = budgets.get(ctx);
  if (!budget) budgets.set(ctx, budget = new AudioCueBudget());
  return budget;
}

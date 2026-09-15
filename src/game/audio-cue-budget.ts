import type { SynthAudioCue } from './audio-sfx';

const supporting = new Set<SynthAudioCue>(['draw', 'discard', 'shuffle', 'flow', 'cover', 'heal', 'bank', 'spend', 'moltPower']);
const essential = new Set<SynthAudioCue>(['attack', 'heavyAttack', 'hitConfirm', 'coverBreak', 'threat', 'enemyCommitment',
  'locked', 'victory', 'victoryFanfare', 'defeat', 'roostHandoff', 'playerTurnRally']);

/** Coalesce bursts without queuing stale sounds or delaying tactical feedback. */
export class AudioCueBudget {
  private last = new Map<SynthAudioCue, number>();
  private supportTimes: number[] = [];
  private quietUntil = -Infinity;

  accepts(cue: SynthAudioCue, nowMs: number) {
    const important = essential.has(cue);
    if (nowMs - (this.last.get(cue) ?? -Infinity) < (important ? 40 : 80)) return false;
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

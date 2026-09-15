import { AudioCueBudget } from './audio-cue-budget';

const cueBudgets = new WeakMap<AudioContext, AudioCueBudget>();

export type SynthAudioCue =
  | 'confirm'
  | 'close'
  | 'locked'
  | 'route'
  | 'routeChoice'
  | 'districtAdvance'
  | 'profileRecord'
  | 'objectiveComplete'
  | 'objectiveMissed'
  | 'marketPurchase'
  | 'encounter'
  | 'supplyUse'
  | 'spend'
  | 'attack'
  | 'heavyAttack'
  | 'hitConfirm'
  | 'playerCommitment'
  | 'coverBlock'
  | 'block'
  | 'cover'
  | 'heal'
  | 'enemyHeal'
  | 'enemyCover'
  | 'coverBreak'
  | 'draw'
  | 'discard'
  | 'shuffle'
  | 'drain'
  | 'flow'
  | 'moltPower'
  | 'cleanse'
  | 'bank'
  | 'threat'
  | 'enemyCommitment'
  | 'formation'
  | 'turn'
  | 'roostHandoff'
  | 'playerTurnRally'
  | 'reward'
  | 'victory'
  | 'victoryFanfare'
  | 'defeat';

type SynthContext = {
  ctx: AudioContext;
  master: GainNode;
  sfxVolume: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function tone(
  audio: SynthContext,
  startFreq: number,
  endFreq: number,
  duration: number,
  type: OscillatorType,
  volume: number,
  pan = 0,
) {
  const { ctx, master, sfxVolume } = audio;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const panner = 'StereoPannerNode' in window ? ctx.createStereoPanner() : undefined;
  const now = ctx.currentTime;
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(1, startFreq), now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * sfxVolume), now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  if (panner) {
    panner.pan.setValueAtTime(clamp(pan, -1, 1), now);
    osc.connect(gain);
    gain.connect(panner);
    panner.connect(master);
  } else {
    osc.connect(gain);
    gain.connect(master);
  }
  osc.start(now);
  osc.stop(now + duration + 0.02);
  osc.onended = () => { osc.disconnect(); gain.disconnect(); panner?.disconnect(); };
}

function chord(
  audio: SynthContext,
  freqs: number[],
  duration: number,
  type: OscillatorType,
  volume: number,
) {
  freqs.forEach((freq, index) => {
    window.setTimeout(
      () => tone(audio, freq, freq * 1.08, duration, type, volume / Math.sqrt(freqs.length), (index - 1) * 0.16),
      index * 22,
    );
  });
}

function noise(audio: SynthContext, duration: number, filterFreq: number, volume: number) {
  const { ctx, master, sfxVolume } = audio;
  const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < sampleCount; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(filterFreq, ctx.currentTime);
  filter.Q.setValueAtTime(1.8, ctx.currentTime);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(Math.max(0.0001, volume * sfxVolume), ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start();
  source.stop(ctx.currentTime + duration + 0.02);
  source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
}

export function playAudioCue(
  ctx: AudioContext,
  master: GainNode,
  sfxVolume: number,
  cue: SynthAudioCue,
  intensity = 1,
) {
  const budget = cueBudgets.get(ctx) ?? new AudioCueBudget();
  cueBudgets.set(ctx, budget);
  if (!budget.accepts(cue, ctx.currentTime * 1000)) return false;
  const audio = { ctx, master, sfxVolume };
  const loudness = clamp(intensity, 0.45, 1.8);
  switch (cue) {
    case 'confirm':
      tone(audio, 420, 610, 0.09, 'sine', 0.036 * loudness);
      break;
    case 'close':
      tone(audio, 280, 190, 0.1, 'triangle', 0.03 * loudness);
      break;
    case 'locked':
      tone(audio, 145, 118, 0.13, 'triangle', 0.026 * loudness);
      break;
    case 'route':
      chord(audio, [220, 330, 440], 0.16, 'triangle', 0.018 * loudness);
      break;
    case 'routeChoice':
      noise(audio, 0.035, 1460, 0.008 * loudness);
      tone(audio, 330, 520, 0.1, 'triangle', 0.012 * loudness, -0.08);
      tone(audio, 660, 820, 0.12, 'sine', 0.012 * loudness, 0.12);
      break;
    case 'districtAdvance':
      noise(audio, 0.06, 1720, 0.012 * loudness);
      tone(audio, 220, 340, 0.14, 'triangle', 0.014 * loudness, -0.12);
      tone(audio, 440, 760, 0.16, 'sine', 0.016 * loudness, 0.04);
      break;
    case 'profileRecord':
      noise(audio, 0.035, 1280, 0.008 * loudness);
      tone(audio, 250, 360, 0.12, 'triangle', 0.012 * loudness, -0.1);
      tone(audio, 500, 760, 0.15, 'sine', 0.014 * loudness, 0.08);
      break;
    case 'objectiveComplete':
      noise(audio, 0.04, 1760, 0.009 * loudness);
      tone(audio, 330, 520, 0.11, 'triangle', 0.013 * loudness, -0.12);
      tone(audio, 660, 990, 0.14, 'sine', 0.015 * loudness, 0.08);
      break;
    case 'objectiveMissed':
      noise(audio, 0.035, 620, 0.007 * loudness);
      tone(audio, 360, 250, 0.13, 'triangle', 0.012 * loudness, -0.1);
      tone(audio, 240, 165, 0.16, 'sine', 0.009 * loudness, 0.12);
      break;
    case 'marketPurchase':
      noise(audio, 0.045, 1680, 0.012 * loudness);
      tone(audio, 360, 620, 0.11, 'triangle', 0.018 * loudness, -0.12);
      tone(audio, 720, 980, 0.1, 'sine', 0.014 * loudness, 0.1);
      break;
    case 'encounter':
      noise(audio, 0.055, 1320, 0.013 * loudness);
      tone(audio, 164, 246, 0.16, 'sawtooth', 0.014 * loudness, -0.14);
      tone(audio, 328, 492, 0.14, 'triangle', 0.011 * loudness, 0.1);
      tone(audio, 720, 540, 0.1, 'sine', 0.007 * loudness, 0.18);
      break;
    case 'supplyUse':
      noise(audio, 0.055, 1860, 0.014 * loudness);
      tone(audio, 260, 390, 0.1, 'triangle', 0.012 * loudness, -0.14);
      tone(audio, 520, 880, 0.12, 'sine', 0.017 * loudness, 0.08);
      tone(audio, 1180, 760, 0.08, 'triangle', 0.01 * loudness, 0.16);
      break;
    case 'spend':
      noise(audio, 0.045, 1560, 0.01 * loudness);
      tone(audio, 720, 460, 0.09, 'triangle', 0.016 * loudness, -0.1);
      tone(audio, 1040, 760, 0.07, 'sine', 0.01 * loudness, 0.14);
      break;
    case 'attack':
      noise(audio, 0.08, 680, 0.035 * loudness);
      tone(audio, 150, 82, 0.1, 'sawtooth', 0.024 * loudness);
      break;
    case 'heavyAttack':
      noise(audio, 0.12, 520, 0.045 * loudness);
      tone(audio, 110, 48, 0.16, 'sawtooth', 0.034 * loudness);
      break;
    case 'hitConfirm':
      noise(audio, 0.055, 1780, 0.018 * loudness);
      tone(audio, 610, 940, 0.08, 'triangle', 0.016 * loudness, -0.08);
      tone(audio, 1220, 680, 0.07, 'sine', 0.01 * loudness, 0.14);
      break;
    case 'playerCommitment':
      noise(audio, 0.052, 1620, 0.013 * loudness);
      tone(audio, 360, 620, 0.14, 'triangle', 0.017 * loudness, -0.12);
      tone(audio, 720, 1180, 0.12, 'sine', 0.014 * loudness, 0.08);
      tone(audio, 1080, 760, 0.08, 'triangle', 0.008 * loudness, 0.16);
      break;
    case 'coverBlock':
      noise(audio, 0.07, 1260, 0.022 * loudness);
      tone(audio, 340, 210, 0.09, 'square', 0.014 * loudness, -0.1);
      tone(audio, 760, 520, 0.06, 'triangle', 0.008 * loudness, 0.12);
      break;
    case 'block':
      noise(audio, 0.08, 1150, 0.026 * loudness);
      tone(audio, 310, 250, 0.07, 'square', 0.016 * loudness);
      break;
    case 'cover':
      chord(audio, [196, 247, 330], 0.12, 'triangle', 0.014 * loudness);
      break;
    case 'heal':
      chord(audio, [330, 495, 660], 0.18, 'sine', 0.014 * loudness);
      break;
    case 'enemyHeal':
      noise(audio, 0.07, 980, 0.014 * loudness);
      tone(audio, 260, 390, 0.15, 'triangle', 0.014 * loudness, -0.1);
      tone(audio, 620, 460, 0.1, 'sawtooth', 0.009 * loudness, 0.12);
      break;
    case 'enemyCover':
      noise(audio, 0.08, 740, 0.018 * loudness);
      tone(audio, 190, 150, 0.13, 'square', 0.014 * loudness, -0.08);
      tone(audio, 410, 290, 0.09, 'triangle', 0.01 * loudness, 0.12);
      break;
    case 'coverBreak':
      noise(audio, 0.09, 1450, 0.024 * loudness);
      tone(audio, 520, 260, 0.1, 'square', 0.016 * loudness, -0.12);
      tone(audio, 980, 620, 0.08, 'triangle', 0.011 * loudness, 0.14);
      break;
    case 'draw':
      noise(audio, 0.045, 1800, 0.01 * loudness);
      tone(audio, 420, 780, 0.1, 'sine', 0.017 * loudness, -0.14);
      tone(audio, 760, 1120, 0.09, 'triangle', 0.012 * loudness, 0.1);
      break;
    case 'discard':
      noise(audio, 0.06, 1220, 0.014 * loudness);
      tone(audio, 520, 310, 0.1, 'triangle', 0.014 * loudness, -0.12);
      tone(audio, 760, 420, 0.08, 'sine', 0.009 * loudness, 0.12);
      break;
    case 'shuffle':
      noise(audio, 0.085, 1720, 0.015 * loudness);
      tone(audio, 320, 620, 0.13, 'triangle', 0.016 * loudness, -0.12);
      tone(audio, 690, 1040, 0.12, 'sine', 0.012 * loudness, 0.1);
      tone(audio, 1040, 760, 0.08, 'triangle', 0.008 * loudness, 0.18);
      break;
    case 'drain':
      noise(audio, 0.1, 760, 0.024 * loudness);
      tone(audio, 420, 148, 0.16, 'triangle', 0.026 * loudness, -0.08);
      tone(audio, 760, 210, 0.08, 'sine', 0.012 * loudness, 0.14);
      break;
    case 'flow':
      tone(audio, 380, 620, 0.12, 'sine', 0.02 * loudness, -0.08);
      tone(audio, 760, 1040, 0.1, 'triangle', 0.012 * loudness, 0.12);
      noise(audio, 0.05, 1450, 0.01 * loudness);
      break;
    case 'moltPower':
      noise(audio, 0.055, 2140, 0.009 * loudness);
      tone(audio, 310, 540, 0.11, 'triangle', 0.014 * loudness, -0.12);
      tone(audio, 620, 930, 0.13, 'sine', 0.013 * loudness, 0.1);
      tone(audio, 1240, 880, 0.07, 'triangle', 0.007 * loudness, 0.18);
      break;
    case 'cleanse':
      noise(audio, 0.06, 1900, 0.012 * loudness);
      tone(audio, 520, 860, 0.14, 'sine', 0.018 * loudness, -0.08);
      tone(audio, 1040, 720, 0.09, 'triangle', 0.011 * loudness, 0.14);
      break;
    case 'bank':
      tone(audio, 260, 420, 0.13, 'triangle', 0.016 * loudness, -0.12);
      tone(audio, 520, 780, 0.11, 'sine', 0.014 * loudness, 0.08);
      noise(audio, 0.045, 1320, 0.008 * loudness);
      break;
    case 'threat':
      noise(audio, 0.08, 620, 0.02 * loudness);
      tone(audio, 180, 120, 0.15, 'sawtooth', 0.018 * loudness, -0.12);
      tone(audio, 420, 250, 0.1, 'triangle', 0.012 * loudness, 0.14);
      break;
    case 'enemyCommitment':
      noise(audio, 0.07, 920, 0.018 * loudness);
      tone(audio, 210, 96, 0.18, 'sawtooth', 0.02 * loudness, -0.14);
      tone(audio, 520, 270, 0.12, 'triangle', 0.012 * loudness, 0.12);
      tone(audio, 880, 410, 0.08, 'sine', 0.007 * loudness, 0.18);
      break;
    case 'formation':
      noise(audio, 0.055, 1560, 0.012 * loudness);
      tone(audio, 260, 420, 0.13, 'triangle', 0.015 * loudness, -0.12);
      tone(audio, 520, 880, 0.16, 'sine', 0.014 * loudness, 0.1);
      tone(audio, 1040, 760, 0.11, 'triangle', 0.008 * loudness, 0.16);
      break;
    case 'turn':
      tone(audio, 250, 390, 0.11, 'triangle', 0.022 * loudness);
      break;
    case 'roostHandoff':
      noise(audio, 0.08, 1180, 0.016 * loudness);
      tone(audio, 196, 330, 0.16, 'triangle', 0.018 * loudness, -0.12);
      tone(audio, 392, 620, 0.12, 'sine', 0.014 * loudness, 0.08);
      tone(audio, 784, 520, 0.1, 'triangle', 0.009 * loudness, 0.16);
      break;
    case 'playerTurnRally':
      noise(audio, 0.045, 1840, 0.01 * loudness);
      tone(audio, 330, 520, 0.14, 'triangle', 0.016 * loudness, -0.12);
      tone(audio, 660, 1040, 0.16, 'sine', 0.015 * loudness, 0.08);
      tone(audio, 990, 780, 0.1, 'triangle', 0.009 * loudness, 0.16);
      break;
    case 'reward':
      chord(audio, [392, 494, 659], 0.22, 'sine', 0.017 * loudness);
      break;
    case 'victory':
      chord(audio, [330, 415, 554, 659], 0.52, 'sine', 0.02 * loudness);
      break;
    case 'victoryFanfare':
      noise(audio, 0.12, 1900, 0.012 * loudness);
      tone(audio, 196, 294, 0.18, 'triangle', 0.018 * loudness, -0.18);
      window.setTimeout(() => tone(audio, 330, 494, 0.2, 'sine', 0.018 * loudness, 0.12), 95);
      window.setTimeout(() => chord(audio, [392, 494, 659, 784], 0.46, 'sine', 0.022 * loudness), 190);
      window.setTimeout(() => noise(audio, 0.08, 2600, 0.008 * loudness), 280);
      break;
    case 'defeat':
      tone(audio, 196, 82, 0.62, 'triangle', 0.038 * loudness);
      noise(audio, 0.28, 360, 0.016 * loudness);
      break;
    default: {
      const exhaustiveCue: never = cue;
      return exhaustiveCue;
    }
  }
  return true;
}

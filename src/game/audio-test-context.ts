/**
 * Test-only stand-in for AudioContext. It records every node, connection and
 * parameter change so unit tests can check structure (which nodes exist, how
 * long they run, how loud their envelopes peak). It makes no sound and proves
 * nothing about how a cue sounds: that still needs a person listening.
 */

export interface FakeParamEvent {
  kind: 'set' | 'exp' | 'linear';
  value: number;
  time: number;
}

export class FakeParam {
  events: FakeParamEvent[] = [];
  /** Nodes modulating this parameter (an oscillator through a gain, for example). */
  inputs: FakeNode[] = [];
  constructor(public value: number) {}
  setValueAtTime(value: number, time: number) { this.events.push({ kind: 'set', value, time }); this.value = value; return this; }
  exponentialRampToValueAtTime(value: number, time: number) { this.events.push({ kind: 'exp', value, time }); this.value = value; return this; }
  linearRampToValueAtTime(value: number, time: number) { this.events.push({ kind: 'linear', value, time }); this.value = value; return this; }
  cancelScheduledValues() { return this; }
  peak() { return this.events.length ? Math.max(...this.events.map((event) => event.value)) : this.value; }
  last() { return this.events[this.events.length - 1]; }
}

export type FakeNodeKind = 'oscillator' | 'gain' | 'panner' | 'filter' | 'buffer' | 'destination';

export class FakeNode {
  frequency = new FakeParam(440);
  detune = new FakeParam(0);
  gain = new FakeParam(1);
  Q = new FakeParam(1);
  pan = new FakeParam(0);
  type = '';
  loop = false;
  buffer?: { length: number; sampleRate: number };
  outputs: Array<FakeNode | FakeParam> = [];
  startedAt?: number;
  stoppedAt?: number;
  disconnected = false;
  onended?: () => void;
  constructor(public kind: FakeNodeKind) {}
  connect(target: FakeNode | FakeParam) {
    this.outputs.push(target);
    if (target instanceof FakeParam) target.inputs.push(this);
    return target;
  }
  disconnect() { this.outputs = []; this.disconnected = true; }
  start(when = 0) { this.startedAt = when; }
  stop(when = 0) { this.stoppedAt = when; }
}

export function createFakeAudioContext(sampleRate = 8000) {
  const nodes: FakeNode[] = [];
  const make = (kind: FakeNodeKind) => {
    const node = new FakeNode(kind);
    nodes.push(node);
    return node;
  };
  const destination = new FakeNode('destination');
  const context = {
    currentTime: 0,
    sampleRate,
    state: 'running',
    destination,
    createOscillator: () => make('oscillator'),
    createGain: () => make('gain'),
    createStereoPanner: () => make('panner'),
    createBiquadFilter: () => make('filter'),
    createBufferSource: () => make('buffer'),
    createBuffer: (_channels: number, length: number, rate: number) => {
      const data = new Float32Array(length);
      return { length, sampleRate: rate, getChannelData: () => data };
    },
  };
  const master = make('gain');
  const sources = () => nodes.filter((node) => node.startedAt !== undefined);
  return {
    ctx: context as unknown as AudioContext,
    master: master as unknown as GainNode,
    raw: context,
    masterNode: master,
    nodes,
    sources,
    oscillators: () => nodes.filter((node) => node.kind === 'oscillator'),
    /** Envelope gains only: the master and any gain that never had a value scheduled are left out. */
    envelopes: () => nodes.filter((node) => node.kind === 'gain' && node !== master && node.gain.events.length > 0),
    /** Seconds from the first scheduled start to the last scheduled stop. */
    span: () => {
      const started = sources();
      if (started.length === 0) return 0;
      return Math.max(...started.map((node) => node.stoppedAt ?? node.startedAt ?? 0))
        - Math.min(...started.map((node) => node.startedAt ?? 0));
    },
    finish: () => sources().forEach((node) => node.onended?.()),
    reset: () => { nodes.length = 0; nodes.push(master); },
  };
}

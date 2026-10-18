// Procedural WebAudio voices behind the Synth interface. Low level only: no event logic, no game state.
// Tuning numbers come from AUDIO (src/data/audio.ts); the constants below are structural only.

import { AUDIO } from '../data/audio';
import { chirpSweeps, chordFrequencies } from './audioMath';
import type { ChirpSweep } from './audioMath';

const ENVELOPE_FLOOR = 0.0001; // exponential ramps cannot target 0
const STOP_PAD_S = 0.05; // oscillator/source stop time after its envelope ends
const NOISE_SECONDS = 2; // length of the shared white-noise buffer
const PARAM_TIME_CONSTANT_S = 0.1; // setTargetAtTime constant for hum and wind
const HUM_FILTER_RATIO = 2; // hum lowpass sits at 2x the hum frequency
const MAX_TICKS_PER_CALL = 8; // scheduling cap per scheduleGearTicks call
const PURCHASE_DROP_RATIO = 1.5; // purchase thunk starts at hz * this and drops to hz
const STING_RING_RATIO = 2; // sting notes ring for this many noteMs
const DENY_HOLD_RATIO = 0.8; // deny pulse holds full level for this fraction of its length
const MAINS_FILTER_RATIO = 3; // mains lowpass sits at 3x the mains frequency
const MAX_ARCS_PER_CALL = 8; // scheduling cap per scheduleArcs call
const RELAY_CLICKS = 2; // relay purchase plays this many clicks
const SWELL_STOP_RAMP_S = 0.005; // reversed swell drops to silence over this long at its hard stop

/** Volume buses under the master: one-shots go to `sfx`, persistent loops and scheduled series to `ambient`. */
export type AudioBus = 'sfx' | 'ambient';

/** Where a call is routed: the master itself or one of the buses. */
type AudioRoute = 'master' | AudioBus;

export interface Synth {
  setMaster(target: number, rampSeconds: number): void;
  setBusGain(bus: AudioBus, gain: number, rampSeconds: number): void; // bus level, ramped toward gain (0..1) over rampSeconds
  playCrank(): void; // AUDIO.crank ratchet: `ticks` short bursts, `tickGapMs` apart
  playPurchase(): void; // AUDIO.purchase light thunk
  playClunk(): void; // AUDIO.clunk sine thump + noise burst (part landed)
  playDeny(): void; // AUDIO.deny low buzz, `count` pulses
  playSting(): void; // AUDIO.sting 3 notes
  setHum(hz: number, gain: number): void; // one persistent oscillator, ramped; gain 0 = silent
  scheduleGearTicks(ticksPerSecond: number): void; // lookahead scheduling; 0 clears/resets the schedule
  setWind(on: boolean): void; // looped noise -> lowpass -> gain, slow gust LFO on the gain
  setMains(gain: number): void; // AUDIO.mains 50 Hz + 100 Hz pair through a lowpass; gain 0 = silent
  scheduleArcs(perSecond: number): void; // AUDIO.arc crackle bursts; 0 clears/resets the schedule; capped at arc.maxRate
  playRelay(): void; // AUDIO.relay two square clicks (Era II purchase)
  setBoiler(gain: number): void; // AUDIO.boiler looped noise -> lowpass -> gain; gain 0 = silent
  playHiss(): void; // AUDIO.hiss one highpassed noise burst (Era III purchase)
  playWhistle(delaySeconds?: number): void; // AUDIO.whistle two sines with attack and decay (milestone)
  setPad(gain: number): void; // AUDIO.pad harmonic sines with a slow LFO on the gain (RS/s); gain 0 = silent
  playForkPing(): void; // AUDIO.forkPing two decaying sines (manual click with echoCrank, Era IV purchase)
  setServo(gain: number, hz: number): void; // AUDIO.servo looped sawtooth -> lowpass -> gain; gain 0 = silent
  playChord(delaySeconds?: number): void; // AUDIO.chord three sines with attack and decay (milestone, after the sting)
  setDrone(gain: number): void; // AUDIO.drone two sines with a slow LFO on the gain (XF/s); gain 0 = silent
  playSwell(): void; // AUDIO.swell reversed swell: rising filtered noise and sawtooth, then a hard stop (Era V purchase)
  playBeadTicks(delaySeconds?: number): void; // AUDIO.beadTick soft sine ticks (finalAlignment milestone, after the sting)
  playResolveChord(): void; // AUDIO.resolveChord major triad plus octave, slow attack, long decay (finale S5)
  playChirps(): void; // AUDIO.chirp FM-ish sine sweeps, `count` of them (finale flock)
  suspend(): void; // context.suspend().catch(noop)
  resume(): void; // context.resume().catch(noop)
  isRunning(): boolean; // context.state === 'running'; false once closed or if the state cannot be read
  close(): void; // stop nodes, context.close().catch(noop); further calls are no-ops
}

interface VoiceSpec {
  wave: OscillatorType;
  hz: number;
  startAt: number; // seconds on the context clock
  decay: number; // seconds from startAt until the envelope reaches the floor
  peak: number;
  hold?: number; // seconds at full peak before the decay starts (must be < decay)
  dropFromHz?: number; // optional pitch drop from this frequency down to hz
}

interface HumNodes {
  osc: OscillatorNode;
  filter: BiquadFilterNode;
  gain: GainNode;
}

interface WindNodes {
  source: AudioBufferSourceNode;
  gain: GainNode;
  depth: GainNode;
  lfo: OscillatorNode;
}

interface MainsNodes {
  fundamental: OscillatorNode;
  harmonic: OscillatorNode;
  gain: GainNode;
}

interface BoilerNodes {
  source: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode;
}

interface PadNodes {
  oscs: OscillatorNode[];
  gain: GainNode;
  lfo: OscillatorNode;
  depth: GainNode;
}

interface ServoNodes {
  osc: OscillatorNode;
  filter: BiquadFilterNode;
  gain: GainNode;
}

interface DroneNodes {
  fundamental: OscillatorNode;
  partial: OscillatorNode;
  partialLevel: GainNode;
  gain: GainNode;
  lfo: OscillatorNode;
  depth: GainNode;
}

/** Sines sounding together through one envelope: linear attack, exponential decay to the floor. Released when all have ended. */
interface ClusterSpec {
  hzs: readonly number[];
  gain: number;
  attackMs: number;
  ms: number;
}

/** The output graph: master (gain 0 until unlocked) and the two buses (unity) feeding it. */
interface Graph {
  master: GainNode;
  sfx: GainNode;
  ambient: GainNode;
}

/** Creates the master bus at gain 0 wired to the destination, with the sfx and ambient buses under it. Returns null if WebAudio refuses. */
function openGraph(context: AudioContext): Graph | null {
  try {
    const master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);
    const sfx = context.createGain();
    sfx.gain.value = 1;
    sfx.connect(master);
    const ambient = context.createGain();
    ambient.gain.value = 1;
    ambient.connect(master);
    return { master, sfx, ambient };
  } catch (err) {
    console.warn('[synth] audio graph unavailable; sound disabled', err);
    return null;
  }
}

/** One-shot oscillator voice with an exponential envelope. Nodes are released when it ends. */
function playVoice(context: AudioContext, out: AudioNode, v: VoiceSpec): void {
  const osc = context.createOscillator();
  const env = context.createGain();
  const end = v.startAt + v.decay;
  osc.type = v.wave;
  if (v.dropFromHz !== undefined) {
    osc.frequency.setValueAtTime(v.dropFromHz, v.startAt);
    osc.frequency.exponentialRampToValueAtTime(v.hz, v.startAt + v.decay * 0.5);
  } else {
    osc.frequency.setValueAtTime(v.hz, v.startAt);
  }
  env.gain.setValueAtTime(v.peak, v.startAt);
  if (v.hold !== undefined && v.hold > 0) {
    env.gain.setValueAtTime(v.peak, v.startAt + v.hold);
  }
  env.gain.exponentialRampToValueAtTime(ENVELOPE_FLOOR, end);
  osc.connect(env);
  env.connect(out);
  osc.onended = () => {
    osc.disconnect();
    env.disconnect();
  };
  osc.start(v.startAt);
  osc.stop(end + STOP_PAD_S);
}

/** One-shot noise burst from the shared noise buffer, starting at a random offset, with an exponential envelope. */
function playNoise(
  context: AudioContext,
  out: AudioNode,
  noise: AudioBuffer,
  startAt: number,
  decay: number,
  peak: number,
): void {
  const src = context.createBufferSource();
  const env = context.createGain();
  src.buffer = noise;
  env.gain.setValueAtTime(peak, startAt);
  env.gain.exponentialRampToValueAtTime(ENVELOPE_FLOOR, startAt + decay);
  src.connect(env);
  env.connect(out);
  src.onended = () => {
    src.disconnect();
    env.disconnect();
  };
  const offset = Math.random() * Math.max(0, noise.duration - decay);
  src.start(startAt, offset);
  src.stop(startAt + decay + STOP_PAD_S);
}

/** Shared white-noise buffer, NOISE_SECONDS long. */
function makeNoise(context: AudioContext): AudioBuffer {
  const length = Math.max(1, Math.floor(context.sampleRate * NOISE_SECONDS));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function ensureHum(context: AudioContext, out: AudioNode, hz: number, cache: HumNodes | null): HumNodes {
  if (cache) return cache;
  const osc = context.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = hz;
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = hz * HUM_FILTER_RATIO;
  const gain = context.createGain();
  gain.gain.value = 0;
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  osc.start();
  return { osc, filter, gain };
}

function ensureWind(context: AudioContext, out: AudioNode, cache: WindNodes | null, noise: AudioBuffer): WindNodes {
  if (cache) return cache;
  const source = context.createBufferSource();
  source.buffer = noise;
  source.loop = true;
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = AUDIO.wind.lowpassHz;
  const gain = context.createGain();
  gain.gain.value = 0;
  const lfo = context.createOscillator();
  lfo.frequency.value = 1 / AUDIO.wind.gustPeriodS;
  const depth = context.createGain();
  depth.gain.value = 0;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  lfo.connect(depth);
  depth.connect(gain.gain);
  source.start();
  lfo.start();
  return { source, gain, depth, lfo };
}

/** Mains pair: sawtooth fundamental plus a sine harmonic at harmonicGain, lowpassed, then the level gain. */
function ensureMains(context: AudioContext, out: AudioNode, cache: MainsNodes | null): MainsNodes {
  if (cache) return cache;
  const m = AUDIO.mains;
  const fundamental = context.createOscillator();
  fundamental.type = 'sawtooth';
  fundamental.frequency.value = m.hz;
  const harmonic = context.createOscillator();
  harmonic.type = 'sine';
  harmonic.frequency.value = m.harmonicHz;
  const harmonicLevel = context.createGain();
  harmonicLevel.gain.value = m.harmonicGain;
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = m.hz * MAINS_FILTER_RATIO;
  const gain = context.createGain();
  gain.gain.value = 0;
  fundamental.connect(filter);
  harmonic.connect(harmonicLevel);
  harmonicLevel.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  fundamental.start();
  harmonic.start();
  return { fundamental, harmonic, gain };
}

/** One arc crackle: a short noise burst through a throwaway high-pass. Nodes are released when it ends. */
function playArc(context: AudioContext, out: AudioNode, noise: AudioBuffer, startAt: number): void {
  const a = AUDIO.arc;
  const decay = a.ms / 1000;
  const src = context.createBufferSource();
  const env = context.createGain();
  const hp = context.createBiquadFilter();
  src.buffer = noise;
  hp.type = 'highpass';
  hp.frequency.value = a.highpassHz;
  env.gain.setValueAtTime(a.gain, startAt);
  env.gain.exponentialRampToValueAtTime(ENVELOPE_FLOOR, startAt + decay);
  src.connect(env);
  env.connect(hp);
  hp.connect(out);
  src.onended = () => {
    src.disconnect();
    env.disconnect();
    hp.disconnect();
  };
  const offset = Math.random() * Math.max(0, noise.duration - decay);
  src.start(startAt, offset);
  src.stop(startAt + decay + STOP_PAD_S);
}

/** Boiler roar: one persistent looped noise source through a lowpass, then the level gain. */
function ensureBoiler(context: AudioContext, out: AudioNode, cache: BoilerNodes | null, noise: AudioBuffer): BoilerNodes {
  if (cache) return cache;
  const source = context.createBufferSource();
  source.buffer = noise;
  source.loop = true;
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = AUDIO.boiler.lowpassHz;
  const gain = context.createGain();
  gain.gain.value = 0;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  source.start();
  return { source, filter, gain };
}

/** One steam hiss: a short noise burst through a throwaway high-pass. Nodes are released when it ends. */
function playHissBurst(context: AudioContext, out: AudioNode, noise: AudioBuffer, startAt: number): void {
  const h = AUDIO.hiss;
  const decay = h.ms / 1000;
  const src = context.createBufferSource();
  const env = context.createGain();
  const hp = context.createBiquadFilter();
  src.buffer = noise;
  hp.type = 'highpass';
  hp.frequency.value = h.highpassHz;
  env.gain.setValueAtTime(h.gain, startAt);
  env.gain.exponentialRampToValueAtTime(ENVELOPE_FLOOR, startAt + decay);
  src.connect(env);
  env.connect(hp);
  hp.connect(out);
  src.onended = () => {
    src.disconnect();
    env.disconnect();
    hp.disconnect();
  };
  const offset = Math.random() * Math.max(0, noise.duration - decay);
  src.start(startAt, offset);
  src.stop(startAt + decay + STOP_PAD_S);
}

/** Sines sounding together through one envelope (linear attack, exponential decay); the envelope is released after the last oscillator ends. */
function playSineCluster(context: AudioContext, out: AudioNode, startAt: number, c: ClusterSpec): void {
  const decay = c.ms / 1000;
  const attack = c.attackMs / 1000;
  const env = context.createGain();
  env.gain.setValueAtTime(ENVELOPE_FLOOR, startAt);
  env.gain.linearRampToValueAtTime(c.gain, startAt + attack);
  env.gain.exponentialRampToValueAtTime(ENVELOPE_FLOOR, startAt + decay);
  env.connect(out);
  let live = c.hzs.length;
  for (const hz of c.hzs) {
    const osc = context.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = hz;
    osc.connect(env);
    osc.onended = () => {
      osc.disconnect();
      live -= 1;
      if (live === 0) env.disconnect();
    };
    osc.start(startAt);
    osc.stop(startAt + decay + STOP_PAD_S);
  }
}

/** Milestone whistle: two sines sounding together through one envelope (linear attack, exponential decay). */
function playWhistleTone(context: AudioContext, out: AudioNode, startAt: number): void {
  const w = AUDIO.whistle;
  playSineCluster(context, out, startAt, { hzs: [w.hzA, w.hzB], gain: w.gain, attackMs: w.attackMs, ms: w.ms });
}

/** Resonance pad: one sine per partial through its partial gain into a shared pad gain; a slow sine LFO drives that gain through a depth gain. */
function ensurePad(context: AudioContext, out: AudioNode, cache: PadNodes | null): PadNodes {
  if (cache) return cache;
  const p = AUDIO.pad;
  const gain = context.createGain();
  gain.gain.value = 0;
  gain.connect(out);
  const oscs: OscillatorNode[] = [];
  p.partials.forEach((partial, i) => {
    const osc = context.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = p.baseHz * partial;
    const level = context.createGain();
    level.gain.value = p.partialGains[i] ?? 0;
    osc.connect(level);
    level.connect(gain);
    osc.start();
    oscs.push(osc);
  });
  const lfo = context.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = p.lfoHz;
  const depth = context.createGain();
  depth.gain.value = 0;
  lfo.connect(depth);
  depth.connect(gain.gain);
  lfo.start();
  return { oscs, gain, lfo, depth };
}

/** Servo whirr: one persistent sawtooth through a lowpass, then the level gain. */
function ensureServo(context: AudioContext, out: AudioNode, hz: number, cache: ServoNodes | null): ServoNodes {
  if (cache) return cache;
  const osc = context.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = hz;
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = AUDIO.servo.lowpassHz;
  const gain = context.createGain();
  gain.gain.value = 0;
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  osc.start();
  return { osc, filter, gain };
}

/** Sub-bass drone: a sine at hz and one at hz * partialRatio (through partialGain) into a shared drone gain; a slow sine LFO drives that gain through a depth gain. */
function ensureDrone(context: AudioContext, out: AudioNode, cache: DroneNodes | null): DroneNodes {
  if (cache) return cache;
  const d = AUDIO.drone;
  const gain = context.createGain();
  gain.gain.value = 0;
  gain.connect(out);
  const fundamental = context.createOscillator();
  fundamental.type = 'sine';
  fundamental.frequency.value = d.hz;
  fundamental.connect(gain);
  const partial = context.createOscillator();
  partial.type = 'sine';
  partial.frequency.value = d.hz * d.partialRatio;
  const partialLevel = context.createGain();
  partialLevel.gain.value = d.partialGain;
  partial.connect(partialLevel);
  partialLevel.connect(gain);
  const lfo = context.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = d.lfoHz;
  const depth = context.createGain();
  depth.gain.value = 0;
  lfo.connect(depth);
  depth.connect(gain.gain);
  fundamental.start();
  partial.start();
  lfo.start();
  return { fundamental, partial, partialLevel, gain, lfo, depth };
}

/**
 * Reversed swell: filtered noise (lowpass rising exponentially) and a sawtooth, one gain that rises exponentially
 * over the swell time, then stops hard. Sources and nodes are released when the last source ends.
 */
function playSwellVoice(context: AudioContext, out: AudioNode, noise: AudioBuffer, startAt: number): void {
  const w = AUDIO.swell;
  const decay = w.ms / 1000;
  const endAt = startAt + decay;
  const stopAt = endAt + SWELL_STOP_RAMP_S;
  const env = context.createGain();
  env.gain.setValueAtTime(ENVELOPE_FLOOR, startAt);
  env.gain.exponentialRampToValueAtTime(w.gain, endAt);
  env.gain.linearRampToValueAtTime(0, stopAt);
  env.connect(out);
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(w.noiseLowpassFromHz, startAt);
  filter.frequency.exponentialRampToValueAtTime(w.noiseLowpassToHz, endAt);
  const noiseLevel = context.createGain();
  noiseLevel.gain.value = w.noiseGain;
  const src = context.createBufferSource();
  src.buffer = noise;
  src.connect(filter);
  filter.connect(noiseLevel);
  noiseLevel.connect(env);
  const saw = context.createOscillator();
  saw.type = 'sawtooth';
  saw.frequency.value = w.sawHz;
  const sawLevel = context.createGain();
  sawLevel.gain.value = w.sawGain;
  saw.connect(sawLevel);
  sawLevel.connect(env);
  let live = 2;
  const release = (): void => {
    live -= 1;
    if (live > 0) return;
    src.disconnect();
    filter.disconnect();
    noiseLevel.disconnect();
    saw.disconnect();
    sawLevel.disconnect();
    env.disconnect();
  };
  src.onended = release;
  saw.onended = release;
  const offset = Math.random() * Math.max(0, noise.duration - decay);
  src.start(startAt, offset);
  src.stop(stopAt + STOP_PAD_S);
  saw.start(startAt);
  saw.stop(stopAt + STOP_PAD_S);
}

/**
 * One FM-ish flock chirp: a sine sweeping exponentially from fromHz to toHz, its pitch wobbled by a sine modulator
 * (AUDIO.chirp modHz / modDepth), through one exponential envelope. Nodes are released when both sources end.
 */
function playChirpSweep(context: AudioContext, out: AudioNode, startAt: number, sweep: ChirpSweep): void {
  const c = AUDIO.chirp;
  const endAt = startAt + sweep.durationS;
  const env = context.createGain();
  env.gain.setValueAtTime(c.gain, startAt);
  env.gain.exponentialRampToValueAtTime(ENVELOPE_FLOOR, endAt);
  env.connect(out);
  const osc = context.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(sweep.fromHz, startAt);
  osc.frequency.exponentialRampToValueAtTime(sweep.toHz, endAt);
  const mod = context.createOscillator();
  mod.type = 'sine';
  mod.frequency.value = c.modHz;
  const modDepth = context.createGain();
  modDepth.gain.value = c.modDepth;
  mod.connect(modDepth);
  modDepth.connect(osc.frequency);
  osc.connect(env);
  let live = 2;
  const release = (): void => {
    live -= 1;
    if (live > 0) return;
    osc.disconnect();
    mod.disconnect();
    modDepth.disconnect();
    env.disconnect();
  };
  osc.onended = release;
  mod.onended = release;
  osc.start(startAt);
  osc.stop(endAt + STOP_PAD_S);
  mod.start(startAt);
  mod.stop(endAt + STOP_PAD_S);
}

export function createSynth(context: AudioContext): Synth {
  const graph = openGraph(context);
  let closed = false;
  let nextTickTime = 0;
  let nextArcTime = 0;
  let noise: AudioBuffer | null = null;
  let hum: HumNodes | null = null;
  let wind: WindNodes | null = null;
  let mains: MainsNodes | null = null;
  let boiler: BoilerNodes | null = null;
  let pad: PadNodes | null = null;
  let servo: ServoNodes | null = null;
  let drone: DroneNodes | null = null;
  const warned = new Set<string>();

  function warnOnce(name: string, err: unknown): void {
    if (warned.has(name)) return;
    warned.add(name);
    console.warn(`[synth] ${name} failed`, err);
  }

  /** Runs one public method body on its route (master or bus): no-op when closed or without a graph, errors never escape. */
  function run(name: string, route: AudioRoute, fn: (out: GainNode) => void): void {
    if (closed || graph === null) return;
    try {
      fn(graph[route]);
    } catch (err) {
      warnOnce(name, err);
    }
  }

  function getNoise(): AudioBuffer {
    if (noise === null) noise = makeNoise(context);
    return noise;
  }

  return {
    setMaster(target: number, rampSeconds: number): void {
      run('setMaster', 'master', (out) => {
        const now = context.currentTime;
        const to = Number.isFinite(target) && target > 0 ? target : 0;
        const ramp = Number.isFinite(rampSeconds) && rampSeconds > 0 ? rampSeconds : 0;
        out.gain.cancelScheduledValues(now);
        out.gain.setValueAtTime(out.gain.value, now);
        out.gain.linearRampToValueAtTime(to, now + ramp);
      });
    },

    setBusGain(bus: AudioBus, gain: number, rampSeconds: number): void {
      run('setBusGain', bus, (out) => {
        const now = context.currentTime;
        const to = Number.isFinite(gain) && gain > 0 ? gain : 0;
        const ramp = Number.isFinite(rampSeconds) && rampSeconds > 0 ? rampSeconds : 0;
        out.gain.cancelScheduledValues(now);
        out.gain.setValueAtTime(out.gain.value, now);
        out.gain.setTargetAtTime(to, now, ramp);
      });
    },

    playCrank(): void {
      run('playCrank', 'sfx', (out) => {
        const c = AUDIO.crank;
        const t0 = context.currentTime;
        for (let i = 0; i < c.ticks; i++) {
          playVoice(context, out, {
            wave: 'square',
            hz: c.hz,
            startAt: t0 + (i * c.tickGapMs) / 1000,
            decay: c.decayMs / 1000,
            peak: c.gain,
          });
        }
      });
    },

    playPurchase(): void {
      run('playPurchase', 'sfx', (out) => {
        const p = AUDIO.purchase;
        playVoice(context, out, {
          wave: 'sine',
          hz: p.hz,
          dropFromHz: p.hz * PURCHASE_DROP_RATIO,
          startAt: context.currentTime,
          decay: p.decayMs / 1000,
          peak: p.gain,
        });
      });
    },

    playClunk(): void {
      run('playClunk', 'sfx', (out) => {
        const k = AUDIO.clunk;
        const t0 = context.currentTime;
        const decay = k.decayMs / 1000;
        playVoice(context, out, { wave: 'sine', hz: k.hz, startAt: t0, decay, peak: k.gain });
        playNoise(context, out, getNoise(), t0, decay, k.noiseGain);
      });
    },

    playDeny(): void {
      run('playDeny', 'sfx', (out) => {
        const d = AUDIO.deny;
        const t0 = context.currentTime;
        const pulse = d.ms / 1000;
        for (let i = 0; i < d.count; i++) {
          playVoice(context, out, {
            wave: 'sawtooth',
            hz: d.hz,
            startAt: t0 + (i * (d.ms + d.gapMs)) / 1000,
            decay: pulse,
            hold: pulse * DENY_HOLD_RATIO,
            peak: d.gain,
          });
        }
      });
    },

    playSting(): void {
      run('playSting', 'sfx', (out) => {
        const s = AUDIO.sting;
        const t0 = context.currentTime;
        const step = s.noteMs / 1000;
        s.notesHz.forEach((hz, i) => {
          playVoice(context, out, {
            wave: 'triangle',
            hz,
            startAt: t0 + i * step,
            decay: step * STING_RING_RATIO,
            peak: s.gain,
          });
        });
      });
    },

    setHum(hz: number, gain: number): void {
      run('setHum', 'ambient', (out) => {
        const freq = Number.isFinite(hz) && hz >= 1 ? hz : 1;
        const amp = Number.isFinite(gain) && gain > 0 ? gain : 0;
        hum = ensureHum(context, out, freq, hum);
        const now = context.currentTime;
        hum.osc.frequency.setTargetAtTime(freq, now, PARAM_TIME_CONSTANT_S);
        hum.filter.frequency.setTargetAtTime(freq * HUM_FILTER_RATIO, now, PARAM_TIME_CONSTANT_S);
        hum.gain.gain.setTargetAtTime(amp, now, PARAM_TIME_CONSTANT_S);
      });
    },

    scheduleGearTicks(ticksPerSecond: number): void {
      run('scheduleGearTicks', 'ambient', (out) => {
        if (!Number.isFinite(ticksPerSecond) || ticksPerSecond <= 0) {
          nextTickTime = 0;
          return;
        }
        const now = context.currentTime;
        if (nextTickTime < now) nextTickTime = now;
        const interval = 1 / ticksPerSecond;
        const g = AUDIO.gearTick;
        let count = 0;
        while (nextTickTime < now + AUDIO.lookaheadSeconds && count < MAX_TICKS_PER_CALL) {
          playVoice(context, out, {
            wave: 'triangle',
            hz: g.hz,
            startAt: nextTickTime,
            decay: g.decayMs / 1000,
            peak: g.gain,
          });
          nextTickTime += interval;
          count++;
        }
      });
    },

    setWind(on: boolean): void {
      run('setWind', 'ambient', (out) => {
        const w = AUDIO.wind;
        wind = ensureWind(context, out, wind, getNoise());
        const now = context.currentTime;
        wind.gain.gain.setTargetAtTime(on ? w.gain : 0, now, PARAM_TIME_CONSTANT_S);
        // The LFO must stop too, or it would push the gain below zero while "off".
        wind.depth.gain.setTargetAtTime(on ? w.gain * w.gustDepth : 0, now, PARAM_TIME_CONSTANT_S);
      });
    },

    setMains(gain: number): void {
      run('setMains', 'ambient', (out) => {
        const amp = Number.isFinite(gain) && gain > 0 ? gain : 0;
        if (mains === null && amp === 0) return; // silent and never started: no nodes needed
        mains = ensureMains(context, out, mains);
        mains.gain.gain.setTargetAtTime(amp, context.currentTime, PARAM_TIME_CONSTANT_S);
      });
    },

    scheduleArcs(perSecond: number): void {
      run('scheduleArcs', 'ambient', (out) => {
        if (!Number.isFinite(perSecond) || perSecond <= 0) {
          nextArcTime = 0;
          return;
        }
        const now = context.currentTime;
        if (nextArcTime < now) nextArcTime = now;
        const interval = 1 / Math.min(perSecond, AUDIO.arc.maxRate);
        const n = getNoise();
        let count = 0;
        while (nextArcTime < now + AUDIO.lookaheadSeconds && count < MAX_ARCS_PER_CALL) {
          playArc(context, out, n, nextArcTime);
          nextArcTime += interval;
          count++;
        }
      });
    },

    playRelay(): void {
      run('playRelay', 'sfx', (out) => {
        const r = AUDIO.relay;
        const t0 = context.currentTime;
        for (let i = 0; i < RELAY_CLICKS; i++) {
          playVoice(context, out, {
            wave: 'square',
            hz: r.hz,
            startAt: t0 + (i * (r.ms + r.gapMs)) / 1000,
            decay: r.ms / 1000,
            peak: r.gain,
          });
        }
      });
    },

    setBoiler(gain: number): void {
      run('setBoiler', 'ambient', (out) => {
        const amp = Number.isFinite(gain) && gain > 0 ? gain : 0;
        if (boiler === null && amp === 0) return; // silent and never started: no nodes needed
        boiler = ensureBoiler(context, out, boiler, getNoise());
        boiler.gain.gain.setTargetAtTime(amp, context.currentTime, PARAM_TIME_CONSTANT_S);
      });
    },

    playHiss(): void {
      run('playHiss', 'sfx', (out) => {
        playHissBurst(context, out, getNoise(), context.currentTime);
      });
    },

    playWhistle(delaySeconds = 0): void {
      run('playWhistle', 'sfx', (out) => {
        const delay = Number.isFinite(delaySeconds) && delaySeconds > 0 ? delaySeconds : 0;
        playWhistleTone(context, out, context.currentTime + delay);
      });
    },

    setPad(gain: number): void {
      run('setPad', 'ambient', (out) => {
        const amp = Number.isFinite(gain) && gain > 0 ? gain : 0;
        if (pad === null && amp === 0) return; // silent and never started: no nodes needed
        pad = ensurePad(context, out, pad);
        const now = context.currentTime;
        pad.gain.gain.setTargetAtTime(amp, now, PARAM_TIME_CONSTANT_S);
        // The LFO depth follows the level, so a silent pad does not swing below zero.
        pad.depth.gain.setTargetAtTime(amp * AUDIO.pad.lfoDepth, now, PARAM_TIME_CONSTANT_S);
      });
    },

    playForkPing(): void {
      run('playForkPing', 'sfx', (out) => {
        const f = AUDIO.forkPing;
        const t0 = context.currentTime;
        const decay = f.ms / 1000;
        playVoice(context, out, { wave: 'sine', hz: f.hz, startAt: t0, decay, peak: f.gain });
        playVoice(context, out, {
          wave: 'sine',
          hz: f.hz * f.partialRatio,
          startAt: t0,
          decay,
          peak: f.gain * f.partialGain,
        });
      });
    },

    setServo(gain: number, hz: number): void {
      run('setServo', 'ambient', (out) => {
        const amp = Number.isFinite(gain) && gain > 0 ? gain : 0;
        if (servo === null && amp === 0) return; // silent and never started: no nodes needed
        const freq = Number.isFinite(hz) && hz >= 1 ? hz : 1;
        servo = ensureServo(context, out, freq, servo);
        const now = context.currentTime;
        servo.osc.frequency.setTargetAtTime(freq, now, PARAM_TIME_CONSTANT_S);
        servo.gain.gain.setTargetAtTime(amp, now, PARAM_TIME_CONSTANT_S);
      });
    },

    playChord(delaySeconds = 0): void {
      run('playChord', 'sfx', (out) => {
        const c = AUDIO.chord;
        const delay = Number.isFinite(delaySeconds) && delaySeconds > 0 ? delaySeconds : 0;
        playSineCluster(context, out, context.currentTime + delay, {
          hzs: c.ratios.map((ratio) => c.baseHz * ratio),
          gain: c.gain,
          attackMs: c.attackMs,
          ms: c.ms,
        });
      });
    },

    setDrone(gain: number): void {
      run('setDrone', 'ambient', (out) => {
        const amp = Number.isFinite(gain) && gain > 0 ? gain : 0;
        if (drone === null && amp === 0) return; // silent and never started: no nodes needed
        drone = ensureDrone(context, out, drone);
        const now = context.currentTime;
        drone.gain.gain.setTargetAtTime(amp, now, PARAM_TIME_CONSTANT_S);
        // The LFO depth follows the level, so a silent drone does not swing below zero.
        drone.depth.gain.setTargetAtTime(amp * AUDIO.drone.lfoDepth, now, PARAM_TIME_CONSTANT_S);
      });
    },

    playSwell(): void {
      run('playSwell', 'sfx', (out) => {
        playSwellVoice(context, out, getNoise(), context.currentTime);
      });
    },

    playBeadTicks(delaySeconds = 0): void {
      run('playBeadTicks', 'sfx', (out) => {
        const b = AUDIO.beadTick;
        const delay = Number.isFinite(delaySeconds) && delaySeconds > 0 ? delaySeconds : 0;
        const t0 = context.currentTime + delay;
        for (let i = 0; i < b.count; i++) {
          playVoice(context, out, {
            wave: 'sine',
            hz: b.hz,
            startAt: t0 + (i * b.gapMs) / 1000,
            decay: b.ms / 1000,
            peak: b.gain,
          });
        }
      });
    },

    playResolveChord(): void {
      run('playResolveChord', 'sfx', (out) => {
        const c = AUDIO.resolveChord;
        playSineCluster(context, out, context.currentTime, {
          hzs: chordFrequencies(c.baseHz, c.ratios),
          gain: c.gain,
          attackMs: c.attackMs,
          ms: c.ms,
        });
      });
    },

    playChirps(): void {
      run('playChirps', 'sfx', (out) => {
        const t0 = context.currentTime;
        for (const sweep of chirpSweeps()) {
          playChirpSweep(context, out, t0 + sweep.startS, sweep);
        }
      });
    },

    suspend(): void {
      run('suspend', 'master', () => {
        context.suspend().catch(() => undefined);
      });
    },

    resume(): void {
      run('resume', 'master', () => {
        context.resume().catch(() => undefined);
      });
    },

    isRunning(): boolean {
      if (closed) return false;
      try {
        return context.state === 'running';
      } catch (err) {
        warnOnce('isRunning', err);
        return false;
      }
    },

    close(): void {
      if (closed) return;
      closed = true;
      try {
        hum?.osc.stop();
        wind?.source.stop();
        wind?.lfo.stop();
        mains?.fundamental.stop();
        mains?.harmonic.stop();
        boiler?.source.stop();
        boiler?.source.disconnect();
        boiler?.filter.disconnect();
        boiler?.gain.disconnect();
        for (const o of pad?.oscs ?? []) o.stop();
        pad?.lfo.stop();
        pad?.gain.disconnect();
        pad?.depth.disconnect();
        servo?.osc.stop();
        servo?.filter.disconnect();
        servo?.gain.disconnect();
        drone?.fundamental.stop();
        drone?.partial.stop();
        drone?.lfo.stop();
        drone?.partialLevel.disconnect();
        drone?.gain.disconnect();
        drone?.depth.disconnect();
      } catch (err) {
        warnOnce('close', err);
      }
      try {
        context.close().catch(() => undefined);
      } catch (err) {
        warnOnce('close', err);
      }
    },
  };
}

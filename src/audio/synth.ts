// Procedural WebAudio voices behind the Synth interface. Low level only: no event logic, no game state.
// Tuning numbers come from AUDIO (src/data/audio.ts); the constants below are structural only.

import { AUDIO } from '../data/audio';

const ENVELOPE_FLOOR = 0.0001; // exponential ramps cannot target 0
const STOP_PAD_S = 0.05; // oscillator/source stop time after its envelope ends
const NOISE_SECONDS = 2; // length of the shared white-noise buffer
const PARAM_TIME_CONSTANT_S = 0.1; // setTargetAtTime constant for hum and wind
const HUM_FILTER_RATIO = 2; // hum lowpass sits at 2x the hum frequency
const MAX_TICKS_PER_CALL = 8; // scheduling cap per scheduleGearTicks call
const PURCHASE_DROP_RATIO = 1.5; // purchase thunk starts at hz * this and drops to hz
const STING_RING_RATIO = 2; // sting notes ring for this many noteMs
const DENY_HOLD_RATIO = 0.8; // deny pulse holds full level for this fraction of its length

export interface Synth {
  setMaster(target: number, rampSeconds: number): void;
  playCrank(): void; // AUDIO.crank ratchet: `ticks` short bursts, `tickGapMs` apart
  playPurchase(): void; // AUDIO.purchase light thunk
  playClunk(): void; // AUDIO.clunk sine thump + noise burst (part landed)
  playDeny(): void; // AUDIO.deny low buzz, `count` pulses
  playSting(): void; // AUDIO.sting 3 notes
  setHum(hz: number, gain: number): void; // one persistent oscillator, ramped; gain 0 = silent
  scheduleGearTicks(ticksPerSecond: number): void; // lookahead scheduling; 0 clears/resets the schedule
  setWind(on: boolean): void; // looped noise -> lowpass -> gain, slow gust LFO on the gain
  suspend(): void; // context.suspend().catch(noop)
  resume(): void; // context.resume().catch(noop)
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

/** Creates the master bus at gain 0 wired to the destination. Returns null if WebAudio refuses. */
function openMaster(context: AudioContext): GainNode | null {
  try {
    const master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);
    return master;
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

export function createSynth(context: AudioContext): Synth {
  const master = openMaster(context);
  let closed = false;
  let nextTickTime = 0;
  let noise: AudioBuffer | null = null;
  let hum: HumNodes | null = null;
  let wind: WindNodes | null = null;
  const warned = new Set<string>();

  function warnOnce(name: string, err: unknown): void {
    if (warned.has(name)) return;
    warned.add(name);
    console.warn(`[synth] ${name} failed`, err);
  }

  /** Runs one public method body: no-op when closed or without a graph, errors never escape. */
  function run(name: string, fn: (out: GainNode) => void): void {
    if (closed || master === null) return;
    try {
      fn(master);
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
      run('setMaster', (out) => {
        const now = context.currentTime;
        const to = Number.isFinite(target) && target > 0 ? target : 0;
        const ramp = Number.isFinite(rampSeconds) && rampSeconds > 0 ? rampSeconds : 0;
        out.gain.cancelScheduledValues(now);
        out.gain.setValueAtTime(out.gain.value, now);
        out.gain.linearRampToValueAtTime(to, now + ramp);
      });
    },

    playCrank(): void {
      run('playCrank', (out) => {
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
      run('playPurchase', (out) => {
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
      run('playClunk', (out) => {
        const k = AUDIO.clunk;
        const t0 = context.currentTime;
        const decay = k.decayMs / 1000;
        playVoice(context, out, { wave: 'sine', hz: k.hz, startAt: t0, decay, peak: k.gain });
        playNoise(context, out, getNoise(), t0, decay, k.noiseGain);
      });
    },

    playDeny(): void {
      run('playDeny', (out) => {
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
      run('playSting', (out) => {
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
      run('setHum', (out) => {
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
      run('scheduleGearTicks', (out) => {
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
      run('setWind', (out) => {
        const w = AUDIO.wind;
        wind = ensureWind(context, out, wind, getNoise());
        const now = context.currentTime;
        wind.gain.gain.setTargetAtTime(on ? w.gain : 0, now, PARAM_TIME_CONSTANT_S);
        // The LFO must stop too, or it would push the gain below zero while "off".
        wind.depth.gain.setTargetAtTime(on ? w.gain * w.gustDepth : 0, now, PARAM_TIME_CONSTANT_S);
      });
    },

    suspend(): void {
      run('suspend', () => {
        context.suspend().catch(() => undefined);
      });
    },

    resume(): void {
      run('resume', () => {
        context.resume().catch(() => undefined);
      });
    },

    close(): void {
      if (closed) return;
      closed = true;
      try {
        hum?.osc.stop();
        wind?.source.stop();
        wind?.lfo.stop();
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

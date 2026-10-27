// Procedural WebAudio voices behind the Synth interface. Low level only: no event logic, no game state.
// Tuning numbers come from AUDIO (src/data/audio.ts); the constants below are structural only.

import { AUDIO } from '../data/audio';
import { MUSIC } from '../data/music';
import type { MusicNoteEvent, MusicTheme, MusicThemeId, MusicVoice } from '../data/music';
import { chirpSweeps, chordFrequencies, stampPartials } from './audioMath';
import type { ChirpSweep, StampPartial } from './audioMath';

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
const MUSIC_ATTACK_FLOOR_S = 0.002; // exponential music ramps need a nonzero span
const MUSIC_RELEASE_FLOOR_S = 0.005; // music release shorter than this is clamped to it
const MUSIC_STOP_FADE_S = 0.01; // time constant of a stopped music note fading to silence
const BELL_PARTIAL_RATIO = 2.76; // bell voice partner: inharmonic fork-like partial
const OCTAVE_RATIO = 2; // warm voice partner: sine an octave up
const ANALYSER_FFT_SIZE = 2048; // samples read for the stats peak
const PEAK_FLOOR_DB = -120; // stats peakDb reports silence as this
const BLIP_ATTACK_S = 0.003; // world blip: anti-click attack at the start of each blip (decay is still AUDIO.world.blip.ms)
const RING_EDGE_S = 0.005; // payphone ring burst fades in and out over this long

/** Volume buses under the master: one-shots go to `sfx`, persistent loops and scheduled series to `ambient`, music to `music`. */
export type AudioBus = 'sfx' | 'ambient' | 'music';

/** Where a call is routed: the master itself or one of the buses. */
type AudioRoute = 'master' | AudioBus;

/** Speakers with a blip voice (the keys of AUDIO.world.blip). */
export type WorldBlipVoice = 'inspector' | 'dog' | 'crow' | 'girl' | 'payphone';

/** Live counters for the debug readout. peakDb is null until the analyser has been armed by a first stats() call. */
export interface SynthStats {
  liveVoices: number; // one-shots + music notes still sounding
  musicVoices: number; // music notes still sounding
  dropped: number; // music notes refused at the maxVoices cap
  peakDb: number | null; // loudest sample of the master output in the last analyser window, dBFS
}

export interface Synth {
  setMaster(target: number, rampSeconds: number): void;
  setBusGain(bus: AudioBus, gain: number, rampSeconds: number): void; // bus level, ramped toward gain (0..1) over rampSeconds
  playCrank(): void; // AUDIO.crank ratchet: `ticks` short bursts, `tickGapMs` apart
  playPurchase(): void; // AUDIO.purchase light thunk
  playClunk(): void; // AUDIO.clunk sine thump + noise burst (part landed)
  playRefit(): void; // AUDIO.refit ratchet ticks then FM bell (tier-up beat); one refit at a time
  playTorqueTick(step: number): void; // AUDIO.torqueTick one noise tick, pitch climbs with step
  playDeny(): void; // AUDIO.deny low buzz, `count` pulses
  playSting(): void; // AUDIO.sting 3 notes
  setHum(hz: number, gain: number): void; // one persistent oscillator, ramped; gain 0 = silent
  scheduleGearTicks(ticksPerSecond: number, gain?: number): void; // lookahead scheduling; 0 clears/resets the schedule; gain (0..) scales AUDIO.gearTick.gain, default 1
  setWind(on: boolean): void; // looped noise -> lowpass -> gain, slow gust LFO on the gain; equals setWindLevel(on ? AUDIO.wind.gain : 0, on)
  setWindLevel(gain: number, lfo: boolean): void; // wind bed gain (ramped) and gust LFO depth on / off (WP26); gain 0 = silent
  setRain(gain: number, hz: number): void; // AUDIO.rain: looped noise -> bandpass(hz, AUDIO.rain.q) -> gain; nodes are built on the first gain > 0; gain 0 = silent
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
  playStamp(): void; // AUDIO.stamp low thump, lowpassed rattle and metallic click, under 300 ms (new cycle)
  playBlip(voice: WorldBlipVoice, count: number, reversed: boolean): void; // AUDIO.world.blip: count (1..8) blips gapMs apart; reversed = ramp up then cut
  playRing(): void; // AUDIO.world.ring payphone ring: bursts of two sines, gapMs apart
  setDialTone(on: boolean): void; // AUDIO.world.dialTone two sines faded in and out; stops by itself after maxMs, never loops; on while sounding is a no-op
  playMusicNote(slot: 0 | 1, theme: MusicThemeId, ev: MusicNoteEvent): void; // one note on a music slot; ev.startS is an absolute context time
  setMusicSlotGain(slot: 0 | 1, gain: number, rampS: number): void; // slot level (crossfade), ramped linearly over rampS; 0 = silent
  setMusicDuck(level: number, rampS: number): void; // ducks both slots together (0..1), ramped linearly over rampS
  stopMusic(slot?: 0 | 1): void; // fades and stops sounding music notes (one slot, or all when omitted); slot levels are kept
  stats(): SynthStats; // live counters and master peak (see SynthStats)
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

interface RainNodes {
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

/** The output graph: master (gain 0 until unlocked) -> limiter -> destination, and the three buses (unity) feeding master. */
interface Graph {
  master: GainNode;
  sfx: GainNode;
  ambient: GainNode;
  music: GainNode;
  limiter: DynamicsCompressorNode;
}

/**
 * Creates the master bus at gain 0 with the master limiter (AUDIO.limiter) between it and the destination, and the
 * sfx, ambient and music buses under it. Returns null if WebAudio refuses.
 */
function openGraph(context: AudioContext): Graph | null {
  try {
    const master = context.createGain();
    master.gain.value = 0;
    const limiter = context.createDynamicsCompressor();
    const l = AUDIO.limiter;
    limiter.threshold.value = l.threshold;
    limiter.knee.value = l.knee;
    limiter.ratio.value = l.ratio;
    limiter.attack.value = l.attack;
    limiter.release.value = l.release;
    master.connect(limiter);
    limiter.connect(context.destination);
    const sfx = context.createGain();
    sfx.gain.value = 1;
    sfx.connect(master);
    const ambient = context.createGain();
    ambient.gain.value = 1;
    ambient.connect(master);
    const music = context.createGain();
    music.gain.value = 1;
    music.connect(master);
    return { master, sfx, ambient, music, limiter };
  } catch (err) {
    console.warn('[synth] audio graph unavailable; sound disabled', err);
    return null;
  }
}

/** Count of one-shot voices still sounding: +1 when a voice starts, -1 when its nodes are released. */
interface VoiceTally {
  live: number;
}

/** One-shot oscillator voice with an exponential envelope. Nodes are released when it ends. */
function playVoice(context: AudioContext, out: AudioNode, v: VoiceSpec, tally: VoiceTally): void {
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
  tally.live += 1;
  osc.onended = () => {
    tally.live -= 1;
    osc.disconnect();
    env.disconnect();
  };
  osc.start(v.startAt);
  osc.stop(end + STOP_PAD_S);
}

/**
 * FM bell: a sine carrier at hz, pitch-modulated by a sine at hz x ratio. The modulation depth starts at hz x ratio x index
 * (peak frequency deviation of index x modulator Hz) and falls to 1 % over decay, so the strike is bright and the tail settles
 * to a pure sine. Two voices in tally; the shared nodes are released when both oscillators have ended.
 */
function playFmBell(
  context: AudioContext,
  out: AudioNode,
  tally: VoiceTally,
  b: { hz: number; ratio: number; index: number; startAt: number; decay: number; peak: number },
): void {
  const carrier = context.createOscillator();
  const modulator = context.createOscillator();
  const modGain = context.createGain();
  const env = context.createGain();
  const end = b.startAt + b.decay;
  const depth = b.hz * b.ratio * b.index;
  const depthFloor = Math.max(depth * 0.01, ENVELOPE_FLOOR); // modulation depth falls to 1 % of its strike value
  carrier.type = 'sine';
  carrier.frequency.setValueAtTime(b.hz, b.startAt);
  modulator.type = 'sine';
  modulator.frequency.setValueAtTime(b.hz * b.ratio, b.startAt);
  modGain.gain.setValueAtTime(depth, b.startAt);
  modGain.gain.exponentialRampToValueAtTime(depthFloor, end);
  env.gain.setValueAtTime(b.peak, b.startAt);
  env.gain.exponentialRampToValueAtTime(ENVELOPE_FLOOR, end);
  modulator.connect(modGain);
  modGain.connect(carrier.frequency);
  carrier.connect(env);
  env.connect(out);
  tally.live += 2;
  let open = 2; // oscillators still sounding; the shared nodes go with the last one
  const release = (): void => {
    tally.live -= 1;
    open -= 1;
    if (open > 0) return;
    carrier.disconnect();
    modulator.disconnect();
    modGain.disconnect();
    env.disconnect();
  };
  carrier.onended = release;
  modulator.onended = release;
  carrier.start(b.startAt);
  modulator.start(b.startAt);
  carrier.stop(end + STOP_PAD_S);
  modulator.stop(end + STOP_PAD_S);
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

/**
 * Rain bed (WP26): one persistent looped noise source through a bandpass at hz, then the level gain. The loop starts at a
 * random offset so the rain does not mirror the wind, which uses the same noise buffer.
 */
function ensureRain(context: AudioContext, out: AudioNode, cache: RainNodes | null, noise: AudioBuffer): RainNodes {
  if (cache) return cache;
  const source = context.createBufferSource();
  source.buffer = noise;
  source.loop = true;
  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = AUDIO.rain.hzMin;
  filter.Q.value = AUDIO.rain.q;
  const gain = context.createGain();
  gain.gain.value = 0;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  source.start(0, Math.random() * noise.duration);
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

/** Stamp rattle: a short noise burst through a lowpass (dull, low), one exponential envelope. Nodes are released when it ends. */
function playStampRattle(
  context: AudioContext,
  out: AudioNode,
  noise: AudioBuffer,
  startAt: number,
  decay: number,
  peak: number,
  lowpassHz: number,
): void {
  const src = context.createBufferSource();
  const env = context.createGain();
  const lp = context.createBiquadFilter();
  src.buffer = noise;
  lp.type = 'lowpass';
  lp.frequency.value = lowpassHz;
  env.gain.setValueAtTime(peak, startAt);
  env.gain.exponentialRampToValueAtTime(ENVELOPE_FLOOR, startAt + decay);
  src.connect(lp);
  lp.connect(env);
  env.connect(out);
  src.onended = () => {
    src.disconnect();
    lp.disconnect();
    env.disconnect();
  };
  const offset = Math.random() * Math.max(0, noise.duration - decay);
  src.start(startAt, offset);
  src.stop(startAt + decay + STOP_PAD_S);
}

/** Per-speaker blip tuning as the synth reads AUDIO.world.blip. The optional keys are set only on the voices that use them. */
interface BlipSpec {
  wave: OscillatorType;
  hz: number;
  ms: number;
  gapMs: number;
  gain: number;
  wobbleHz?: number; // dog: pitch wobble LFO rate
  wobbleCents?: number; // dog: pitch wobble depth in cents
  fmHz?: number; // crow: FM modulator rate
  fmDepth?: number; // crow: FM depth in Hz
  bandpassHz?: number; // payphone: bandpass centre
}

/**
 * World blip sequence on one oscillator: `count` envelope steps gapMs apart. Forward: a short attack, then an exponential
 * decay over ms. Reversed: an exponential ramp up over ms, then a hard cut. The dog's wobble (LFO on detune) and the crow's
 * FM (modulator on frequency) run on the same oscillator; the payphone bandpass sits after the envelope. The nodes are
 * released when every source has ended.
 */
function playBlipSequence(
  context: AudioContext,
  out: AudioNode,
  startAt: number,
  count: number,
  b: BlipSpec,
  reversed: boolean,
  tally: VoiceTally,
): void {
  const gap = b.gapMs / 1000;
  const decay = b.ms / 1000;
  const endAt = startAt + (count - 1) * gap + decay;
  const env = context.createGain();
  for (let i = 0; i < count; i++) {
    const t = startAt + i * gap;
    env.gain.setValueAtTime(ENVELOPE_FLOOR, t);
    if (reversed) {
      env.gain.exponentialRampToValueAtTime(b.gain, t + decay);
      env.gain.setValueAtTime(ENVELOPE_FLOOR, t + decay);
    } else {
      env.gain.linearRampToValueAtTime(b.gain, t + Math.min(BLIP_ATTACK_S, decay / 2));
      env.gain.exponentialRampToValueAtTime(ENVELOPE_FLOOR, t + decay);
    }
  }
  const osc = context.createOscillator();
  osc.type = b.wave;
  osc.frequency.value = b.hz;
  osc.connect(env);
  const oscs: OscillatorNode[] = [osc];
  const nodes: AudioNode[] = [env];
  if (b.wobbleHz !== undefined && b.wobbleCents !== undefined) {
    const lfo = context.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = b.wobbleHz;
    const depth = context.createGain();
    depth.gain.value = b.wobbleCents;
    lfo.connect(depth);
    depth.connect(osc.detune);
    oscs.push(lfo);
    nodes.push(depth);
  }
  if (b.fmHz !== undefined && b.fmDepth !== undefined) {
    const mod = context.createOscillator();
    mod.type = 'sine';
    mod.frequency.value = b.fmHz;
    const depth = context.createGain();
    depth.gain.value = b.fmDepth;
    mod.connect(depth);
    depth.connect(osc.frequency);
    oscs.push(mod);
    nodes.push(depth);
  }
  if (b.bandpassHz !== undefined) {
    const bp = context.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = b.bandpassHz;
    env.connect(bp);
    bp.connect(out);
    nodes.push(bp);
  } else {
    env.connect(out);
  }
  let live = oscs.length;
  tally.live += 1;
  for (const o of oscs) {
    o.onended = () => {
      o.disconnect();
      live -= 1;
      if (live > 0) return;
      for (const n of nodes) n.disconnect();
      tally.live -= 1;
    };
    o.start(startAt);
    o.stop(endAt + STOP_PAD_S);
  }
}

/** One payphone ring burst: two sines through one envelope, a short fade in and out around a flat hold. Released when both have ended. */
function playRingBurst(
  context: AudioContext,
  out: AudioNode,
  startAt: number,
  decay: number,
  gain: number,
  hzs: readonly number[],
  tally: VoiceTally,
): void {
  const endAt = startAt + decay;
  const edge = Math.min(RING_EDGE_S, decay / 2);
  const env = context.createGain();
  env.gain.setValueAtTime(ENVELOPE_FLOOR, startAt);
  env.gain.linearRampToValueAtTime(gain, startAt + edge);
  env.gain.setValueAtTime(gain, endAt - edge);
  env.gain.linearRampToValueAtTime(0, endAt);
  env.connect(out);
  let live = hzs.length;
  tally.live += 1;
  for (const hz of hzs) {
    const osc = context.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = hz;
    osc.connect(env);
    osc.onended = () => {
      osc.disconnect();
      live -= 1;
      if (live > 0) return;
      env.disconnect();
      tally.live -= 1;
    };
    osc.start(startAt);
    osc.stop(endAt + STOP_PAD_S);
  }
}

/** A dial tone that is sounding (or was): its envelope, its two oscillators and the context time it stops by itself. */
interface DialTone {
  env: GainNode;
  oscs: OscillatorNode[];
  endAt: number;
}

/** Starts the dial tone now (AUDIO.world.dialTone): fade in over fadeMs, hold, fade out over the last fadeMs, stop at maxMs. */
function startDialTone(context: AudioContext, out: AudioNode, tally: VoiceTally): DialTone {
  const d = AUDIO.world.dialTone;
  const hzs = [d.hzA, d.hzB];
  const t0 = context.currentTime;
  const fade = d.fadeMs / 1000;
  const endAt = t0 + d.maxMs / 1000;
  const env = context.createGain();
  env.gain.setValueAtTime(ENVELOPE_FLOOR, t0);
  env.gain.linearRampToValueAtTime(d.gain, t0 + fade);
  env.gain.setValueAtTime(d.gain, Math.max(t0 + fade, endAt - fade));
  env.gain.linearRampToValueAtTime(0, endAt);
  env.connect(out);
  let live = hzs.length;
  tally.live += 1;
  const oscs: OscillatorNode[] = [];
  for (const hz of hzs) {
    const osc = context.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = hz;
    osc.connect(env);
    osc.onended = () => {
      osc.disconnect();
      live -= 1;
      if (live > 0) return;
      env.disconnect();
      tally.live -= 1;
    };
    osc.start(t0);
    osc.stop(endAt + STOP_PAD_S);
    oscs.push(osc);
  }
  return { env, oscs, endAt };
}

/** Fades a sounding dial tone to silence over fadeMs from its current level, then stops its oscillators early. */
function fadeOutDialTone(context: AudioContext, tone: DialTone): void {
  const now = context.currentTime;
  const fade = AUDIO.world.dialTone.fadeMs / 1000;
  const param = tone.env.gain;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(0, now + fade);
  for (const osc of tone.oscs) osc.stop(now + fade + STOP_PAD_S);
}

/** One music slot: note -> lowpass -> slotGain (crossfade level) -> duckGain (finale ducks) -> music bus and echo send. */
interface MusicSlot {
  lowpass: BiquadFilterNode;
  slotGain: GainNode;
  duckGain: GainNode;
}

/** Lazily built music graph: two slots plus one shared echo (delay, feedback, lowpass, send) fed from both duck gains. */
interface MusicGraph {
  slots: [MusicSlot, MusicSlot];
  echoSend: GainNode;
  echo: DelayNode;
  echoLowpass: BiquadFilterNode;
  echoFeedback: GainNode;
}

/** One sounding music note: its oscillators, its own envelope gain, its slot and its scheduled start (for stopMusic). */
interface MusicNote {
  oscs: OscillatorNode[];
  env: GainNode;
  slot: 0 | 1;
  startS: number;
}

/** Oscillator layout per music voice. `detuned` plays a pair at -/+ theme.detuneCents; `partner` adds a second oscillator. */
interface MusicVoiceShape {
  wave: OscillatorType;
  detuned: boolean;
  partner: { wave: OscillatorType; ratio: number } | null;
}

const MUSIC_VOICE_SHAPES: Record<MusicVoice, MusicVoiceShape> = {
  pluck: { wave: 'triangle', detuned: false, partner: null },
  pulse: { wave: 'square', detuned: true, partner: null },
  swell: { wave: 'sawtooth', detuned: true, partner: null },
  bell: { wave: 'sine', detuned: false, partner: { wave: 'sine', ratio: BELL_PARTIAL_RATIO } },
  reverse: { wave: 'sine', detuned: true, partner: null },
  warm: { wave: 'triangle', detuned: false, partner: { wave: 'sine', ratio: OCTAVE_RATIO } },
};

/** Music counters: notes still sounding (released on the last oscillator's onended) and notes refused at the voice cap. */
interface MusicTally {
  live: number;
  dropped: number;
}

/** Builds the two slots and the shared echo under the music bus. Slot levels start silent, duck levels at unity. */
function openMusic(context: AudioContext, bus: GainNode): MusicGraph {
  const m = MUSIC.space;
  const echo = context.createDelay(m.delayS);
  echo.delayTime.value = m.delayS;
  const echoLowpass = context.createBiquadFilter();
  echoLowpass.type = 'lowpass';
  echoLowpass.frequency.value = m.lowpassHz;
  const echoFeedback = context.createGain();
  echoFeedback.gain.value = m.feedback;
  const echoSend = context.createGain();
  echoSend.gain.value = m.wet;
  echoSend.connect(echo);
  echo.connect(echoLowpass);
  echoLowpass.connect(echoFeedback);
  echoFeedback.connect(echo);
  echoLowpass.connect(bus);
  const makeSlot = (): MusicSlot => {
    const lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = m.lowpassHz;
    const slotGain = context.createGain();
    slotGain.gain.value = 0;
    const duckGain = context.createGain();
    duckGain.gain.value = 1;
    lowpass.connect(slotGain);
    slotGain.connect(duckGain);
    duckGain.connect(bus);
    duckGain.connect(echoSend);
    return { lowpass, slotGain, duckGain };
  };
  return { slots: [makeSlot(), makeSlot()], echoSend, echo, echoLowpass, echoFeedback };
}

/** Attack to the note gain, hold for the note length, release to the floor. Returns the time the envelope ends. */
function scheduleMusicEnvelope(env: GainNode, ev: MusicNoteEvent, theme: MusicTheme): number {
  const peak = Math.max(ENVELOPE_FLOOR, ev.gain);
  const attack = Math.max(MUSIC_ATTACK_FLOOR_S, theme.attackS);
  const holdEnd = ev.startS + Math.max(attack, ev.durS);
  const end = holdEnd + Math.max(MUSIC_RELEASE_FLOOR_S, theme.releaseS);
  env.gain.setValueAtTime(ENVELOPE_FLOOR, ev.startS);
  env.gain.exponentialRampToValueAtTime(peak, ev.startS + attack);
  env.gain.setValueAtTime(peak, holdEnd);
  env.gain.exponentialRampToValueAtTime(ENVELOPE_FLOOR, end);
  return end;
}

/**
 * One music note: one or two oscillators into one envelope gain, feeding the slot lowpass. `onEnd` runs once, when the
 * last oscillator has ended, and the nodes are disconnected then. At most three nodes per note.
 */
function startMusicNote(
  context: AudioContext,
  slot: MusicSlot,
  slotIndex: 0 | 1,
  theme: MusicTheme,
  ev: MusicNoteEvent,
  onEnd: () => void,
): MusicNote {
  const shape = MUSIC_VOICE_SHAPES[ev.voice];
  const env = context.createGain();
  const end = scheduleMusicEnvelope(env, ev, theme);
  env.connect(slot.lowpass);
  const parts: { wave: OscillatorType; ratio: number; cents: number }[] = [];
  if (shape.detuned) {
    parts.push({ wave: shape.wave, ratio: 1, cents: -theme.detuneCents });
    parts.push({ wave: shape.wave, ratio: 1, cents: theme.detuneCents });
  } else {
    parts.push({ wave: shape.wave, ratio: 1, cents: 0 });
    if (shape.partner !== null) parts.push({ wave: shape.partner.wave, ratio: shape.partner.ratio, cents: 0 });
  }
  let live = parts.length;
  const oscs: OscillatorNode[] = [];
  for (const p of parts) {
    const osc = context.createOscillator();
    osc.type = p.wave;
    osc.frequency.value = ev.hz * p.ratio;
    osc.detune.value = p.cents;
    osc.connect(env);
    osc.onended = () => {
      osc.disconnect();
      live -= 1;
      if (live > 0) return;
      env.disconnect();
      onEnd();
    };
    osc.start(ev.startS);
    osc.stop(end + STOP_PAD_S);
    oscs.push(osc);
  }
  return { oscs, env, slot: slotIndex, startS: ev.startS };
}

/** Ramps an AudioParam linearly to `to` over rampS seconds from its current value (negative or non-finite ramps are instant). */
function rampParam(context: AudioContext, param: AudioParam, to: number, rampS: number): void {
  const now = context.currentTime;
  const ramp = Number.isFinite(rampS) && rampS > 0 ? rampS : 0;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(to, now + ramp);
}

/** Clamps a level to 0..1; anything non-finite is silence. */
function clampLevel(level: number): number {
  return Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0;
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
  let rain: RainNodes | null = null;
  let pad: PadNodes | null = null;
  let servo: ServoNodes | null = null;
  let drone: DroneNodes | null = null;
  let dialTone: DialTone | null = null;
  let musicGraph: MusicGraph | null = null;
  let analyser: { node: AnalyserNode; buf: Float32Array<ArrayBuffer> } | null = null;
  const oneShots: VoiceTally = { live: 0 };
  let refitBusyUntil = 0; // context time the tier-up refit is busy until: one refit at a time
  let torqueLive = 0; // torque ticks still sounding, capped at AUDIO.torqueTick.maxConcurrent
  const musicTally: MusicTally = { live: 0, dropped: 0 };
  const activeNotes = new Set<MusicNote>();
  const warned = new Set<string>();

  function warnOnce(name: string, err: unknown): void {
    if (warned.has(name)) return;
    warned.add(name);
    console.warn(`[synth] ${name} failed`, err);
  }

  /** One-shot voice on `out`, counted in oneShots. */
  function voice(out: AudioNode, v: VoiceSpec): void {
    playVoice(context, out, v, oneShots);
  }

  /** The music graph, built on first use under the music bus `bus`. */
  function getMusic(bus: GainNode): MusicGraph {
    if (musicGraph === null) musicGraph = openMusic(context, bus);
    return musicGraph;
  }

  /**
   * Fades the sounding music notes (one slot, or all) to silence within a few milliseconds and stops their oscillators; the
   * counters drop as they end. A note not yet started is stopped before its start, so it never sounds. A sounding note holds
   * its current level first, so a future note's envelope is never wiped (cancelScheduledValues alone would reset it to gain 1).
   */
  function stopMusicNotes(slot?: 0 | 1): void {
    const now = context.currentTime;
    for (const note of activeNotes) {
      if (slot !== undefined && note.slot !== slot) continue;
      if (note.startS > now) {
        for (const osc of note.oscs) osc.stop(now);
        continue;
      }
      const param = note.env.gain;
      if (typeof param.cancelAndHoldAtTime === 'function') {
        param.cancelAndHoldAtTime(now);
      } else {
        param.cancelScheduledValues(now);
        param.setValueAtTime(param.value, now);
      }
      param.setTargetAtTime(ENVELOPE_FLOOR, now, MUSIC_STOP_FADE_S);
      for (const osc of note.oscs) osc.stop(now + STOP_PAD_S);
    }
  }

  /** Master peak in dBFS over the last analyser window; the first call only arms the analyser and returns null. */
  function readPeakDb(): number | null {
    if (closed || graph === null) return null;
    try {
      if (analyser === null) {
        const node = context.createAnalyser();
        node.fftSize = ANALYSER_FFT_SIZE;
        graph.limiter.connect(node);
        analyser = { node, buf: new Float32Array(node.fftSize) };
        return null;
      }
      analyser.node.getFloatTimeDomainData(analyser.buf);
      let peak = 0;
      for (let i = 0; i < analyser.buf.length; i++) {
        const a = Math.abs(analyser.buf[i] ?? 0);
        if (a > peak) peak = a;
      }
      return peak > 0 ? Math.max(PEAK_FLOOR_DB, 20 * Math.log10(peak)) : PEAK_FLOOR_DB;
    } catch (err) {
      warnOnce('stats', err);
      return null;
    }
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

  /**
   * Wind bed on `out`: gain ramped to amp, and the gust LFO depth on (amp x gustDepth) or off. The LFO stops with the
   * wind, or it would push the gain below zero while "off".
   */
  function applyWind(out: AudioNode, amp: number, lfo: boolean): void {
    wind = ensureWind(context, out, wind, getNoise());
    const now = context.currentTime;
    wind.gain.gain.setTargetAtTime(amp, now, PARAM_TIME_CONSTANT_S);
    wind.depth.gain.setTargetAtTime(lfo ? amp * AUDIO.wind.gustDepth : 0, now, PARAM_TIME_CONSTANT_S);
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
          voice(out,{
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
        voice(out,{
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
        voice(out,{ wave: 'sine', hz: k.hz, startAt: t0, decay, peak: k.gain });
        playNoise(context, out, getNoise(), t0, decay, k.noiseGain);
      });
    },

    playRefit(): void {
      run('playRefit', 'sfx', (out) => {
        const r = AUDIO.refit;
        const t0 = context.currentTime;
        if (t0 < refitBusyUntil) return; // a refit is still sounding: this beat is dropped
        const noise = getNoise();
        const bellAt = t0 + r.bellAtMs / 1000;
        refitBusyUntil = bellAt + r.bellMs / 1000;
        const tickDecay = r.tickMs / 1000;
        for (let i = 0; i < r.ticks; i++) {
          const hz = r.tickHz[i];
          if (hz === undefined) continue;
          const startAt = t0 + (i * r.tickGapMs) / 1000;
          const src = context.createBufferSource();
          const band = context.createBiquadFilter();
          const env = context.createGain();
          src.buffer = noise;
          band.type = 'bandpass';
          band.frequency.value = hz;
          band.Q.value = r.tickQ;
          env.gain.setValueAtTime(r.tickGain, startAt);
          env.gain.exponentialRampToValueAtTime(ENVELOPE_FLOOR, startAt + tickDecay);
          src.connect(band);
          band.connect(env);
          env.connect(out);
          src.onended = () => {
            src.disconnect();
            band.disconnect();
            env.disconnect();
          };
          const offset = Math.random() * Math.max(0, noise.duration - tickDecay);
          src.start(startAt, offset);
          src.stop(startAt + tickDecay + STOP_PAD_S);
        }
        const bellDecay = r.bellMs / 1000;
        playFmBell(context, out, oneShots, {
          hz: r.bellHz,
          ratio: r.bellPartialRatio,
          index: r.bellIndex,
          startAt: bellAt,
          decay: bellDecay,
          peak: r.bellGain,
        });
      });
    },

    playTorqueTick(step: number): void {
      run('playTorqueTick', 'sfx', (out) => {
        const q = AUDIO.torqueTick;
        if (torqueLive >= q.maxConcurrent) return; // at the cap: this tick is dropped
        const clamped = Number.isFinite(step) ? Math.min(Math.max(step, 0), q.maxStep) : 0;
        const t0 = context.currentTime;
        const decay = q.ms / 1000;
        const noise = getNoise();
        const src = context.createBufferSource();
        const band = context.createBiquadFilter();
        const env = context.createGain();
        src.buffer = noise;
        band.type = 'bandpass';
        band.frequency.value = q.hz * 2 ** (clamped / 12);
        band.Q.value = q.q;
        env.gain.setValueAtTime(q.gain, t0);
        env.gain.exponentialRampToValueAtTime(ENVELOPE_FLOOR, t0 + decay);
        src.connect(band);
        band.connect(env);
        env.connect(out);
        src.onended = () => {
          torqueLive -= 1;
          src.disconnect();
          band.disconnect();
          env.disconnect();
        };
        const offset = Math.random() * Math.max(0, noise.duration - decay);
        src.start(t0, offset);
        src.stop(t0 + decay + STOP_PAD_S);
        torqueLive += 1;
      });
    },

    playDeny(): void {
      run('playDeny', 'sfx', (out) => {
        const d = AUDIO.deny;
        const t0 = context.currentTime;
        const pulse = d.ms / 1000;
        for (let i = 0; i < d.count; i++) {
          voice(out,{
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
          voice(out,{
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

    scheduleGearTicks(ticksPerSecond: number, gain = 1): void {
      run('scheduleGearTicks', 'ambient', (out) => {
        if (!Number.isFinite(ticksPerSecond) || ticksPerSecond <= 0) {
          nextTickTime = 0;
          return;
        }
        const now = context.currentTime;
        if (nextTickTime < now) nextTickTime = now;
        const interval = 1 / ticksPerSecond;
        const g = AUDIO.gearTick;
        const level = Number.isFinite(gain) && gain > 0 ? gain : 0;
        let count = 0;
        while (nextTickTime < now + AUDIO.lookaheadSeconds && count < MAX_TICKS_PER_CALL) {
          if (level > 0) {
            voice(out,{
              wave: 'triangle',
              hz: g.hz,
              startAt: nextTickTime,
              decay: g.decayMs / 1000,
              peak: g.gain * level,
            });
          }
          nextTickTime += interval;
          count++;
        }
      });
    },

    setWind(on: boolean): void {
      run('setWind', 'ambient', (out) => applyWind(out, on ? AUDIO.wind.gain : 0, on));
    },

    setWindLevel(gain: number, lfo: boolean): void {
      run('setWindLevel', 'ambient', (out) => {
        const amp = Number.isFinite(gain) && gain > 0 ? gain : 0;
        applyWind(out, amp, lfo);
      });
    },

    setRain(gain: number, hz: number): void {
      run('setRain', 'ambient', (out) => {
        const amp = Number.isFinite(gain) && gain > 0 ? gain : 0;
        if (rain === null && amp === 0) return; // silent and never started: no nodes needed
        rain = ensureRain(context, out, rain, getNoise());
        const now = context.currentTime;
        const hzNow = Number.isFinite(hz) && hz >= 20 ? hz : AUDIO.rain.hzMin;
        rain.filter.frequency.setTargetAtTime(hzNow, now, AUDIO.rain.smoothS);
        rain.gain.gain.setTargetAtTime(amp, now, AUDIO.rain.smoothS);
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
          voice(out,{
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
        voice(out,{ wave: 'sine', hz: f.hz, startAt: t0, decay, peak: f.gain });
        voice(out,{
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
          voice(out,{
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

    playStamp(): void {
      run('playStamp', 'sfx', (out) => {
        const t0 = context.currentTime;
        const s = AUDIO.stamp;
        for (const p of stampPartials()) {
          const startAt = t0 + p.startS;
          switch (p.kind) {
            case 'thump':
              voice(out,{
                wave: 'sine',
                hz: p.hz,
                dropFromHz: s.thumpDropHz,
                startAt,
                decay: p.durationS,
                peak: p.gain,
              });
              break;
            case 'rattle':
              playStampRattle(context, out, getNoise(), startAt, p.durationS, p.gain, p.hz);
              break;
            case 'click':
              playSineCluster(context, out, startAt, {
                hzs: [p.hz, p.hz * s.clickPartialRatio],
                gain: p.gain,
                attackMs: s.clickAttackMs,
                ms: p.durationS * 1000,
              });
              break;
          }
        }
      });
    },

    playBlip(voice: WorldBlipVoice, count: number, reversed: boolean): void {
      run('playBlip', 'sfx', (out) => {
        // The sequence is clamped to 1..AUDIO.world.maxBlips (one blip for a non-finite count).
        const n = Number.isFinite(count) ? Math.min(AUDIO.world.maxBlips, Math.max(1, Math.floor(count))) : 1;
        playBlipSequence(context, out, context.currentTime, n, AUDIO.world.blip[voice], reversed, oneShots);
      });
    },

    playRing(): void {
      run('playRing', 'sfx', (out) => {
        const r = AUDIO.world.ring;
        const t0 = context.currentTime;
        for (let i = 0; i < r.bursts; i++) {
          playRingBurst(context, out, t0 + (i * (r.burstMs + r.gapMs)) / 1000, r.burstMs / 1000, r.gain, [r.hzA, r.hzB], oneShots);
        }
      });
    },

    setDialTone(on: boolean): void {
      run('setDialTone', 'sfx', (out) => {
        // A tone still sounding is left alone: an "on" never restarts it, and it stops by itself at maxMs.
        const sounding = dialTone !== null && context.currentTime < dialTone.endAt;
        if (on) {
          if (!sounding) dialTone = startDialTone(context, out, oneShots);
          return;
        }
        if (sounding && dialTone !== null) fadeOutDialTone(context, dialTone);
        dialTone = null;
      });
    },

    playMusicNote(slot: 0 | 1, theme: MusicThemeId, ev: MusicNoteEvent): void {
      run('playMusicNote', 'music', (out) => {
        if (!Number.isFinite(ev.startS) || !Number.isFinite(ev.durS) || !Number.isFinite(ev.hz) || ev.hz <= 0) return;
        if (musicTally.live >= MUSIC.maxVoices) {
          musicTally.dropped += 1;
          return;
        }
        const t = MUSIC.themes[theme];
        const g = getMusic(out);
        const s = g.slots[slot];
        s.lowpass.frequency.value = t.lowpassHz;
        const note = startMusicNote(context, s, slot, t, { ...ev, durS: Math.max(0, ev.durS) }, () => {
          musicTally.live -= 1;
          activeNotes.delete(note);
        });
        activeNotes.add(note);
        musicTally.live += 1;
      });
    },

    setMusicSlotGain(slot: 0 | 1, gain: number, rampS: number): void {
      run('setMusicSlotGain', 'music', (out) => {
        const to = clampLevel(gain);
        if (musicGraph === null && to === 0) return; // silent and never started: no nodes needed
        const g = getMusic(out);
        rampParam(context, g.slots[slot].slotGain.gain, to, rampS);
      });
    },

    setMusicDuck(level: number, rampS: number): void {
      run('setMusicDuck', 'music', (out) => {
        const to = clampLevel(level);
        if (musicGraph === null && to === 1) return; // unducked and never started: no nodes needed
        const g = getMusic(out);
        for (const s of g.slots) rampParam(context, s.duckGain.gain, to, rampS);
      });
    },

    stopMusic(slot?: 0 | 1): void {
      run('stopMusic', 'music', () => {
        stopMusicNotes(slot);
      });
    },

    stats(): SynthStats {
      return {
        liveVoices: oneShots.live + musicTally.live,
        musicVoices: musicTally.live,
        dropped: musicTally.dropped,
        peakDb: readPeakDb(),
      };
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
        rain?.source.stop();
        rain?.source.disconnect();
        rain?.filter.disconnect();
        rain?.gain.disconnect();
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
        for (const o of dialTone?.oscs ?? []) o.stop();
        stopMusicNotes();
        if (musicGraph !== null) {
          for (const s of musicGraph.slots) {
            s.lowpass.disconnect();
            s.slotGain.disconnect();
            s.duckGain.disconnect();
          }
          musicGraph.echoSend.disconnect();
          musicGraph.echo.disconnect();
          musicGraph.echoLowpass.disconnect();
          musicGraph.echoFeedback.disconnect();
        }
        analyser?.node.disconnect();
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

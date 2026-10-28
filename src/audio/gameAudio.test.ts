import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUDIO } from '../data/audio';
import { FAULTS } from '../data/faults';
import { MUSIC } from '../data/music';
import type { FinaleBeat } from '../data/finale';
import type { MachineComponentId } from '../data/machineComponents';
import { RESOURCE_IDS } from '../data/types';
import type { GameState, PurchaseFailure, ResourceMap, TechId } from '../data/types';
import type { GameFeedback, PartEvolvedEvent, PartTorquedEvent, WorldSound } from '../game/context';
import { GameSession } from '../simulation';
import { createInitialState } from '../simulation/state';
import { emptyResourceMap } from '../simulation/resources';
import { createSignal } from '../utils/signal';
import { ambientMix, boilerGain, humGain } from './audioMath';
import { createGameAudio } from './gameAudio';
import type { GameAudio } from './gameAudio';
import type { Synth, SynthStats } from './synth';

// createSynth hands back the fake below, so no AudioContext is ever created. The controller is driven by
// the fake window (gestures and the update interval) and by session calls, and the tests read the synth mocks.
const h = vi.hoisted(() => ({ synth: null as unknown as Synth }));
vi.mock('./synth', () => ({ createSynth: () => h.synth }));

const FUNDS = 1e15;

/** Every Synth method as a vi.fn. isRunning is true and the counters are zero. */
function createFakeSynth() {
  return {
    setMaster: vi.fn(),
    setBusGain: vi.fn(),
    playCrank: vi.fn(),
    playPurchase: vi.fn(),
    playClunk: vi.fn(),
    playRefit: vi.fn(),
    playTorqueTick: vi.fn(),
    playDeny: vi.fn(),
    playSting: vi.fn(),
    setHum: vi.fn(),
    scheduleGearTicks: vi.fn(),
    setWind: vi.fn(),
    setWindLevel: vi.fn(),
    setRain: vi.fn(),
    setMains: vi.fn(),
    scheduleArcs: vi.fn(),
    playRelay: vi.fn(),
    setBoiler: vi.fn(),
    playHiss: vi.fn(),
    playWhistle: vi.fn(),
    setPad: vi.fn(),
    playForkPing: vi.fn(),
    setServo: vi.fn(),
    playChord: vi.fn(),
    setDrone: vi.fn(),
    playSwell: vi.fn(),
    playBeadTicks: vi.fn(),
    playResolveChord: vi.fn(),
    playChirps: vi.fn(),
    playStamp: vi.fn(),
    playFaultSpawn: vi.fn(),
    playFaultClear: vi.fn(),
    playBlip: vi.fn(),
    playRing: vi.fn(),
    setDialTone: vi.fn(),
    playMusicNote: vi.fn(),
    setMusicSlotGain: vi.fn(),
    setMusicDuck: vi.fn(),
    stopMusic: vi.fn(),
    stats: vi.fn((): SynthStats => ({ liveVoices: 0, musicVoices: 0, dropped: 0, peakDb: null })),
    suspend: vi.fn(),
    resume: vi.fn(),
    isRunning: vi.fn((): boolean => true),
    close: vi.fn(),
  };
}

type FakeSynth = ReturnType<typeof createFakeSynth>;

/** Stand-in for the WebAudio context: the controller reads its clock and state and adds listeners. */
class FakeAudioContext {
  /** Most recently built context: advanceClock moves its clock. */
  static last: FakeAudioContext | null = null;
  currentTime = 0;
  state = 'running';
  addEventListener = vi.fn();
  removeEventListener = vi.fn();

  constructor() {
    FakeAudioContext.last = this;
  }
}

interface FakeWindow {
  readonly win: Window;
  /** Calls every pointerdown listener, as a first click would. */
  unlock(): void;
  /** Runs the update interval once. */
  tick(): void;
  /** Moves the wall clock (performance.now) forward. */
  advanceWall(seconds: number): void;
}

/** Window stand-in: records listeners, captures the update interval and provides the AudioContext constructor. */
function createFakeWindow(): FakeWindow {
  const listeners = new Map<string, Array<() => void>>();
  let interval: (() => void) | null = null;
  let wallMs = 0;
  const win = {
    AudioContext: FakeAudioContext,
    performance: { now: (): number => wallMs },
    document: { visibilityState: 'visible', addEventListener: vi.fn(), removeEventListener: vi.fn() },
    addEventListener(type: string, fn: () => void): void {
      listeners.set(type, [...(listeners.get(type) ?? []), fn]);
    },
    removeEventListener(type: string, fn: () => void): void {
      listeners.set(type, (listeners.get(type) ?? []).filter((listener) => listener !== fn));
    },
    setInterval(fn: () => void): number {
      interval = fn;
      return 1;
    },
    clearInterval: vi.fn(),
  };
  return {
    win: win as unknown as Window,
    unlock(): void {
      for (const fn of [...(listeners.get('pointerdown') ?? [])]) fn();
    },
    tick(): void {
      const fn = interval;
      if (fn === null) throw new Error('update interval was never armed');
      fn();
    },
    advanceWall(seconds: number): void {
      wallMs += seconds * 1000;
    },
  };
}

/** Start state with every resource funded and the given tech levels set on top of the initial ones. */
function fundedState(techLevels: Partial<Record<TechId, number>>): GameState {
  const base = createInitialState(0);
  const funds: ResourceMap = emptyResourceMap();
  for (const id of RESOURCE_IDS) funds[id] = FUNDS;
  return { ...base, res: funds, techLevels: { ...base.techLevels, ...techLevels } };
}

function createFeedback(): GameFeedback {
  return {
    purchaseDenied: createSignal<PurchaseFailure>(),
    partLanded: createSignal<MachineComponentId>(),
    finaleBeat: createSignal<FinaleBeat>(),
    partEvolved: createSignal<PartEvolvedEvent>(),
    partTorqued: createSignal<PartTorquedEvent>(),
    worldSound: createSignal<WorldSound>(),
    worldWeather: { live: false, wind: 0, virgaAlpha: 0, virgaSpeed: 0 },
  };
}

interface Rig {
  session: GameSession;
  audio: GameAudio;
  feedback: GameFeedback;
  tick(): void;
  advanceWall(seconds: number): void;
}

let current: GameAudio | null = null;
let fake: FakeSynth;
let warnSpy: { readonly mock: { readonly calls: unknown[][] }; mockRestore(): void };

/** Session, feedback and controller on a fake window. Unlocks the controller unless told not to. */
function buildRig(techLevels: Partial<Record<TechId, number>> = {}, unlock = true): Rig {
  const session = new GameSession({ state: fundedState(techLevels), now: () => 0 });
  const fakeWindow = createFakeWindow();
  const feedback = createFeedback();
  const audio = createGameAudio(session, feedback, fakeWindow.win);
  current = audio;
  if (unlock) fakeWindow.unlock();
  return { session, audio, feedback, tick: fakeWindow.tick, advanceWall: fakeWindow.advanceWall };
}

/** Structural view of a vi.fn: the calls it recorded. */
interface CallLog {
  readonly mock: { readonly calls: ReadonlyArray<ReadonlyArray<unknown>> };
}

/** Arguments of the last call (of the calls whose first argument is `key`, when given), or undefined. */
function lastArgs(log: CallLog, key?: unknown): ReadonlyArray<unknown> | undefined {
  const calls = key === undefined ? log.mock.calls : log.mock.calls.filter((args) => args[0] === key);
  return calls[calls.length - 1];
}

/** Numeric argument `index` of the last matching call. Throws when it is missing or not a number. */
function lastNumber(log: CallLog, index: number, key?: unknown): number {
  const value = lastArgs(log, key)?.[index];
  if (typeof value !== 'number') throw new Error(`expected a number at argument ${index}`);
  return value;
}

/** Clears the recorded calls of every synth mock. */
function clearSynthCalls(): void {
  for (const mock of Object.values(fake)) mock.mockClear();
}

/** Moves the fake AudioContext clock forward. Throws when no context exists yet (buildRig unlocks it). */
function advanceClock(seconds: number): void {
  const ctx = FakeAudioContext.last;
  if (ctx === null) throw new Error('no audio context yet');
  ctx.currentTime += seconds;
}

beforeEach(() => {
  fake = createFakeSynth();
  h.synth = fake;
  FakeAudioContext.last = null;
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  current?.dispose();
  current = null;
  const warnings = warnSpy.mock.calls.length;
  warnSpy.mockRestore();
  expect(warnings).toBe(0);
});

describe('gameAudio purchase cue', () => {
  it('plays the cue of the era of the paying resource, not the era of the tech', () => {
    const { session } = buildRig({ boiler: 1, resonatorSpire: 1, nullChamber: 1 });
    clearSynthCalls();
    const results = [
      session.purchase('bellowsDrive'), // pays ME (era I) -> purchase
      session.purchase('gridExciter'), // pays EE (era II) -> relay
      session.purchase('mainsBackfeed'), // pays EE (era II) -> relay
      session.purchase('steamLance'), // pays PR (era III) -> hiss
    ];
    for (const result of results) expect(result.ok).toBe(true);
    expect(fake.playPurchase).toHaveBeenCalledTimes(1);
    expect(fake.playRelay).toHaveBeenCalledTimes(2);
    expect(fake.playHiss).toHaveBeenCalledTimes(1);
    expect(fake.playSwell).not.toHaveBeenCalled();
    expect(fake.playForkPing).not.toHaveBeenCalled();
  });
});

describe('gameAudio muted', () => {
  it('a purchase plays no cue and the hum gain is 0 after a tick, the ambient readout stays', () => {
    const { session, audio, tick } = buildRig({ boiler: 1, resonatorSpire: 1, nullChamber: 1 });
    session.updateSettings({ muted: true });
    clearSynthCalls();
    expect(session.purchase('steamLance').ok).toBe(true);
    expect(fake.playPurchase).not.toHaveBeenCalled();
    expect(fake.playRelay).not.toHaveBeenCalled();
    expect(fake.playHiss).not.toHaveBeenCalled();
    expect(fake.playForkPing).not.toHaveBeenCalled();
    expect(fake.playSwell).not.toHaveBeenCalled();
    tick();
    expect(lastNumber(fake.setHum, 1)).toBe(0);
    expect(audio.stats().ambient).not.toBeNull();
    expect(audio.stats().ambient?.humGain).toBe(0);
  });
});

describe('gameAudio music volume', () => {
  it('music volume 0 zeroes the music bus; 50 sets it to half the music bus gain', () => {
    const { session, audio } = buildRig();
    session.updateSettings({ musicVolume: 0 });
    expect(lastNumber(fake.setBusGain, 1, 'music')).toBe(0);
    expect(audio.stats().levels?.musicBus).toBe(0);
    session.updateSettings({ musicVolume: 50 });
    expect(lastNumber(fake.setBusGain, 1, 'music')).toBeCloseTo(0.5 * MUSIC.busGain, 12);
    expect(audio.stats().levels?.musicBus).toBeCloseTo(0.5 * MUSIC.busGain, 12);
  });

  it('music volume 0 stops the notes; the clock moving then schedules none, while music on does', () => {
    const { session, audio, tick } = buildRig();
    // Control: the clock moves, so music ON at the default volume must schedule notes within 10 ticks.
    for (let i = 0; i < 10 && fake.playMusicNote.mock.calls.length === 0; i++) {
      advanceClock(1);
      tick();
    }
    expect(fake.playMusicNote.mock.calls.length).toBeGreaterThan(0);
    expect(audio.stats().theme).toBe('mech');
    session.updateSettings({ musicVolume: 0 });
    fake.stopMusic.mockClear();
    fake.playMusicNote.mockClear();
    advanceClock(1);
    tick();
    expect(fake.stopMusic).toHaveBeenCalled();
    fake.playMusicNote.mockClear();
    for (let i = 0; i < 6; i++) {
      advanceClock(1);
      tick();
    }
    expect(fake.playMusicNote).not.toHaveBeenCalled();
    // Not a dead scheduler: music back on schedules notes again.
    session.updateSettings({ musicVolume: 70 });
    for (let i = 0; i < 10 && fake.playMusicNote.mock.calls.length === 0; i++) {
      advanceClock(1);
      tick();
    }
    expect(fake.playMusicNote.mock.calls.length).toBeGreaterThan(0);
  });
});

describe('gameAudio ambient beds', () => {
  it('era III: beds carry their era trims and the readout equals ambientMix', () => {
    const { session, audio, tick } = buildRig({ wornMotor: 1, generator: 1, boiler: 1 });
    const { perSecond } = session.rates;
    expect(perSecond.me).toBeGreaterThan(0);
    tick();
    const hum = lastNumber(fake.setHum, 1);
    expect(hum).toBeGreaterThan(0);
    expect(hum).toBeCloseTo(humGain(perSecond.me) * AUDIO.bedTrim.hum[2], 12);
    expect(lastNumber(fake.setBoiler, 0)).toBeCloseTo(boilerGain(perSecond.pr, true) * AUDIO.bedTrim.boiler[2], 12);
    expect(audio.stats().ambient).toEqual(ambientMix({ perSecond, techLevels: session.state.techLevels, muted: false }));
    expect(audio.stats().theme).toBe('therm');
    expect(audio.stats().ambient?.era).toBe(3);
  });

  it('era V: nullChamber gives era 5 and the exotic theme', () => {
    const { audio, tick } = buildRig({ nullChamber: 1 });
    tick();
    expect(audio.stats().ambient?.era).toBe(5);
    expect(audio.stats().theme).toBe('exotic');
  });
});

describe('gameAudio readout', () => {
  it('before the first gesture: unlocked is false, levels and ambient are null', () => {
    const { audio } = buildRig({}, false);
    expect(audio.stats().unlocked).toBe(false);
    expect(audio.stats().levels).toBeNull();
    expect(audio.stats().ambient).toBeNull();
  });

  it('dispose clears the levels and the ambient readout', () => {
    const { audio, tick } = buildRig();
    tick();
    expect(audio.stats().levels).not.toBeNull();
    expect(audio.stats().ambient).not.toBeNull();
    audio.dispose();
    expect(audio.stats().levels).toBeNull();
    expect(audio.stats().ambient).toBeNull();
  });
});

describe('gameAudio tier audio (WP22)', () => {
  it('a part evolution plays the refit once', () => {
    const { feedback } = buildRig();
    clearSynthCalls();
    feedback.partEvolved.emit({ techId: 'motorTuning', fromTier: 1, toTier: 2, topTier: 5, hosts: ['wornMotor'] });
    expect(fake.playRefit).toHaveBeenCalledTimes(1);
  });

  it('a torque step plays one tick at that step', () => {
    const { feedback } = buildRig();
    clearSynthCalls();
    feedback.partTorqued.emit({ techId: 'motorTuning', host: 'wornMotor', step: 4 });
    expect(fake.playTorqueTick).toHaveBeenCalledTimes(1);
    expect(fake.playTorqueTick).toHaveBeenCalledWith(4);
  });

  it('muted: neither the refit nor the torque tick plays', () => {
    const { session, feedback } = buildRig();
    session.updateSettings({ muted: true });
    clearSynthCalls();
    feedback.partEvolved.emit({ techId: 'motorTuning', fromTier: 1, toTier: 2, topTier: 5, hosts: ['wornMotor'] });
    feedback.partTorqued.emit({ techId: 'motorTuning', host: 'wornMotor', step: 4 });
    expect(fake.playRefit).not.toHaveBeenCalled();
    expect(fake.playTorqueTick).not.toHaveBeenCalled();
  });

  it('before the first gesture: nothing plays and nothing throws', () => {
    const { feedback } = buildRig({}, false);
    expect(() => {
      feedback.partEvolved.emit({ techId: 'motorTuning', fromTier: 1, toTier: 2, topTier: 5, hosts: ['wornMotor'] });
      feedback.partTorqued.emit({ techId: 'motorTuning', host: 'wornMotor', step: 4 });
    }).not.toThrow();
    expect(fake.playRefit).not.toHaveBeenCalled();
    expect(fake.playTorqueTick).not.toHaveBeenCalled();
  });
});

describe('gameAudio world sounds', () => {
  it('a blip is forwarded with its arguments and counted', () => {
    const { feedback, audio } = buildRig();
    clearSynthCalls();
    feedback.worldSound.emit({ kind: 'blip', speaker: 'dog', count: 2, reversed: true });
    expect(fake.playBlip).toHaveBeenCalledTimes(1);
    expect(lastArgs(fake.playBlip)).toEqual(['dog', 2, true]);
    expect(audio.stats().worldBlips).toBe(1);
  });

  it('refuses a third concurrent blip sequence until one ends', () => {
    const { feedback, audio, advanceWall } = buildRig();
    clearSynthCalls();
    // Wall clock: inspector x2 ends at 2 * 70 + 55 = 195 ms, girl x1 at 80 + 70 = 150 ms.
    feedback.worldSound.emit({ kind: 'blip', speaker: 'inspector', count: 2, reversed: false });
    feedback.worldSound.emit({ kind: 'blip', speaker: 'girl', count: 1, reversed: false });
    feedback.worldSound.emit({ kind: 'blip', speaker: 'crow', count: 1, reversed: false });
    expect(fake.playBlip).toHaveBeenCalledTimes(2);
    expect(audio.stats().worldBlips).toBe(2);
    advanceWall(0.16); // girl has ended, inspector still sounds
    feedback.worldSound.emit({ kind: 'blip', speaker: 'crow', count: 1, reversed: false });
    expect(fake.playBlip).toHaveBeenCalledTimes(3);
    expect(lastArgs(fake.playBlip)).toEqual(['crow', 1, false]);
    expect(audio.stats().worldBlips).toBe(3);
    feedback.worldSound.emit({ kind: 'blip', speaker: 'payphone', count: 1, reversed: false });
    expect(fake.playBlip).toHaveBeenCalledTimes(3);
    expect(audio.stats().worldBlips).toBe(3);
  });

  it('muted: no world sound reaches the synth and no blip is counted', () => {
    const { session, feedback, audio } = buildRig();
    session.updateSettings({ muted: true });
    clearSynthCalls();
    feedback.worldSound.emit({ kind: 'blip', speaker: 'inspector', count: 1, reversed: false });
    feedback.worldSound.emit({ kind: 'ring' });
    feedback.worldSound.emit({ kind: 'dialTone', on: true });
    feedback.worldSound.emit({ kind: 'dialTone', on: false });
    expect(fake.playBlip).not.toHaveBeenCalled();
    expect(fake.playRing).not.toHaveBeenCalled();
    expect(fake.setDialTone).not.toHaveBeenCalled();
    expect(audio.stats().worldBlips).toBe(0);
  });

  it('ring and dial tone are forwarded; blips are not', () => {
    const { feedback } = buildRig();
    clearSynthCalls();
    feedback.worldSound.emit({ kind: 'ring' });
    expect(fake.playRing).toHaveBeenCalledTimes(1);
    feedback.worldSound.emit({ kind: 'dialTone', on: true });
    feedback.worldSound.emit({ kind: 'dialTone', on: false });
    expect(fake.setDialTone).toHaveBeenCalledTimes(2);
    expect(lastArgs(fake.setDialTone)).toEqual([false]);
    expect(fake.playBlip).not.toHaveBeenCalled();
  });

  it('before unlock nothing plays and the readout is 0', () => {
    const { feedback, audio } = buildRig({}, false);
    feedback.worldSound.emit({ kind: 'blip', speaker: 'girl', count: 1, reversed: false });
    feedback.worldSound.emit({ kind: 'ring' });
    feedback.worldSound.emit({ kind: 'dialTone', on: true });
    expect(fake.playBlip).not.toHaveBeenCalled();
    expect(fake.playRing).not.toHaveBeenCalled();
    expect(fake.setDialTone).not.toHaveBeenCalled();
    expect(audio.stats().worldBlips).toBe(0);
  });

  it('dispose unsubscribes the world sounds and resets the readout', () => {
    const { feedback, audio } = buildRig();
    feedback.worldSound.emit({ kind: 'blip', speaker: 'payphone', count: 1, reversed: false });
    expect(audio.stats().worldBlips).toBe(1);
    audio.dispose();
    expect(audio.stats().worldBlips).toBe(0);
    clearSynthCalls();
    feedback.worldSound.emit({ kind: 'ring' });
    expect(fake.playRing).not.toHaveBeenCalled();
  });
});

describe('gameAudio fault cues (WP27)', () => {
  /** Spawns one fault now: the debug hook, then one eligible step (the same route the GameSession fault tests use). */
  function spawnNow(session: GameSession): void {
    expect(session.debugForceFault()).toBe(true);
    session.stepFaults(FAULTS.maxStepS, true);
  }

  it('a spawn plays one spawn cue in the era of the session and counts it', () => {
    const { session, audio } = buildRig({ faultLamp: 1, boiler: 1 });
    clearSynthCalls();
    spawnNow(session);
    expect(fake.playFaultSpawn).toHaveBeenCalledTimes(1);
    expect(lastArgs(fake.playFaultSpawn)).toEqual([3]);
    expect(fake.playFaultClear).not.toHaveBeenCalled();
    expect(audio.stats().faultSpawnCues).toBe(1);
    expect(audio.stats().faultClearCues).toBe(0);
  });

  it('era I with only the Fault Lamp: the spawn cue is the era I one', () => {
    const { session } = buildRig({ faultLamp: 1 });
    clearSynthCalls();
    spawnNow(session);
    expect(lastArgs(fake.playFaultSpawn)).toEqual([1]);
  });

  it('era V with the null chamber: the spawn cue is the era V one', () => {
    const { session } = buildRig({ faultLamp: 1, nullChamber: 1 });
    clearSynthCalls();
    spawnNow(session);
    expect(lastArgs(fake.playFaultSpawn)).toEqual([5]);
  });

  it('a clear plays one clear cue and counts it; without Overdrive the tick does not rise', () => {
    const { session, audio } = buildRig({ faultLamp: 1 });
    spawnNow(session);
    clearSynthCalls();
    expect(session.clearFault()).not.toBeNull();
    expect(fake.playFaultClear).toHaveBeenCalledTimes(1);
    expect(lastArgs(fake.playFaultClear)).toEqual([false]);
    expect(fake.playFaultSpawn).not.toHaveBeenCalled();
    expect(audio.stats().faultClearCues).toBe(1);
    expect(audio.stats().faultSpawnCues).toBe(1);
  });

  it('a clear under Overdrive passes overdrive true (overrunClutch grants it)', () => {
    const { session } = buildRig({ faultLamp: 1, overrunClutch: 1 });
    spawnNow(session);
    clearSynthCalls();
    expect(session.clearFault()).not.toBeNull();
    expect(fake.playFaultClear).toHaveBeenCalledTimes(1);
    expect(lastArgs(fake.playFaultClear)).toEqual([true]);
  });

  it('an expire plays no cue and counts nothing', () => {
    const { session, audio } = buildRig({ faultLamp: 1 });
    const kinds: string[] = [];
    session.on('fault', (p) => kinds.push(p.kind));
    spawnNow(session);
    clearSynthCalls();
    for (let i = 0; i < 80 && !kinds.includes('expire'); i++) session.stepFaults(FAULTS.maxStepS, true);
    expect(kinds).toContain('expire');
    expect(fake.playFaultSpawn).not.toHaveBeenCalled();
    expect(fake.playFaultClear).not.toHaveBeenCalled();
    expect(audio.stats().faultSpawnCues).toBe(1);
    expect(audio.stats().faultClearCues).toBe(0);
  });

  it('muted: a spawn and a clear play nothing and count nothing', () => {
    const { session, audio } = buildRig({ faultLamp: 1, overrunClutch: 1 });
    session.updateSettings({ muted: true });
    clearSynthCalls();
    spawnNow(session);
    session.clearFault();
    expect(fake.playFaultSpawn).not.toHaveBeenCalled();
    expect(fake.playFaultClear).not.toHaveBeenCalled();
    expect(audio.stats().faultSpawnCues).toBe(0);
    expect(audio.stats().faultClearCues).toBe(0);
  });

  it('before the first gesture nothing plays and the counters read 0', () => {
    const { session, audio } = buildRig({ faultLamp: 1 }, false);
    spawnNow(session);
    expect(fake.playFaultSpawn).not.toHaveBeenCalled();
    expect(audio.stats().faultSpawnCues).toBe(0);
  });

  it('the sfx bus carries the SFX volume the fault cues play through', () => {
    const { session } = buildRig({ faultLamp: 1 });
    session.updateSettings({ sfxVolume: 50 });
    expect(lastNumber(fake.setBusGain, 1, 'sfx')).toBeCloseTo(0.5, 12);
    spawnNow(session);
    expect(fake.playFaultSpawn).toHaveBeenCalledTimes(1);
  });

  it('dispose unsubscribes the fault cues and resets the counters', () => {
    const { session, audio } = buildRig({ faultLamp: 1 });
    spawnNow(session);
    expect(audio.stats().faultSpawnCues).toBe(1);
    audio.dispose();
    expect(audio.stats().faultSpawnCues).toBe(0);
    expect(audio.stats().faultClearCues).toBe(0);
    clearSynthCalls();
    session.clearFault();
    expect(fake.playFaultClear).not.toHaveBeenCalled();
  });
});

describe('gameAudio weather (WP26)', () => {
  it('no live readout: the v0.10.0 wind (full gain, gust LFO) and no rain', () => {
    const { tick } = buildRig();
    tick();
    expect(lastNumber(fake.setWindLevel, 0)).toBeCloseTo(AUDIO.wind.gain, 12);
    expect(lastArgs(fake.setWindLevel)?.[1]).toBe(true);
    expect(fake.setRain.mock.calls.every((args) => args[0] === 0)).toBe(true);
  });

  it('live, still air: the wind keeps the floor and loses the LFO', () => {
    const { feedback, tick } = buildRig();
    Object.assign(feedback.worldWeather, { live: true, wind: 0, virgaAlpha: 0, virgaSpeed: 0 });
    tick();
    expect(lastNumber(fake.setWindLevel, 0)).toBeCloseTo(AUDIO.wind.gain * AUDIO.wind.floor, 12);
    expect(lastArgs(fake.setWindLevel)?.[1]).toBe(false);
  });

  it('live, reference wind: the wind plays at full gain without the LFO', () => {
    const { feedback, tick } = buildRig();
    Object.assign(feedback.worldWeather, { live: true, wind: AUDIO.wind.refWind, virgaAlpha: 0, virgaSpeed: 0 });
    tick();
    expect(lastNumber(fake.setWindLevel, 0)).toBeCloseTo(AUDIO.wind.gain, 12);
    expect(lastArgs(fake.setWindLevel)?.[1]).toBe(false);
  });

  it('the wind follows the readout by more than one step; a change under one step and an unchanged readout push nothing', () => {
    const { feedback, tick } = buildRig();
    Object.assign(feedback.worldWeather, { live: true, wind: 0, virgaAlpha: 0, virgaSpeed: 0 });
    tick();
    const before = fake.setWindLevel.mock.calls.length;
    feedback.worldWeather.wind = AUDIO.wind.refWind;
    tick();
    expect(fake.setWindLevel.mock.calls.length).toBe(before + 1);
    expect(lastNumber(fake.setWindLevel, 0)).toBeCloseTo(AUDIO.wind.gain, 12);
    const windCalls = fake.setWindLevel.mock.calls.length;
    const rainCalls = fake.setRain.mock.calls.length;
    tick();
    expect(fake.setWindLevel.mock.calls.length).toBe(windCalls);
    expect(fake.setRain.mock.calls.length).toBe(rainCalls);
    feedback.worldWeather.wind = 0.999; // 0.05 x 0.9993: still the same weatherStep.gain bucket
    tick();
    expect(fake.setWindLevel.mock.calls.length).toBe(windCalls);
  });

  it('era III: the rain follows the virga and its pitch rises with the speed; a sub-step change pushes nothing', () => {
    const { feedback, tick } = buildRig({ boiler: 1 });
    Object.assign(feedback.worldWeather, { live: true, wind: 1, virgaAlpha: 0.7, virgaSpeed: 1 });
    tick();
    expect(lastNumber(fake.setRain, 0)).toBeCloseTo(AUDIO.rain.gain * AUDIO.bedTrim.rain[2], 12);
    expect(lastNumber(fake.setRain, 1)).toBeCloseTo(AUDIO.rain.hzMax, 9);
    const rainCalls = fake.setRain.mock.calls.length;
    feedback.worldWeather.virgaAlpha = 0.699; // 0.03 x 0.9986: same rain step, same pitch step
    tick();
    expect(fake.setRain.mock.calls.length).toBe(rainCalls);
    feedback.worldWeather.virgaSpeed = 0;
    tick();
    expect(lastNumber(fake.setRain, 0)).toBe(0);
  });

  it('era IV: no rain even with full inputs (the bed is trimmed to 0)', () => {
    const { feedback, audio, tick } = buildRig({ resonatorSpire: 1 });
    Object.assign(feedback.worldWeather, { live: true, wind: 1, virgaAlpha: 0.7, virgaSpeed: 1 });
    tick();
    expect(lastNumber(fake.setRain, 0)).toBe(0);
    expect(audio.stats().ambient?.era).toBe(4);
    expect(audio.stats().ambient?.rainGain).toBe(0);
  });

  it('mute: wind and rain go silent at once and the readout reads 0; unmute pushes the live levels at once', () => {
    const { session, feedback, audio, tick } = buildRig({ boiler: 1 });
    Object.assign(feedback.worldWeather, { live: true, wind: 0, virgaAlpha: 0.7, virgaSpeed: 1 });
    tick();
    session.updateSettings({ muted: true });
    expect(lastArgs(fake.setWind)).toEqual([false]);
    expect(lastNumber(fake.setRain, 0)).toBe(0);
    tick();
    expect(audio.stats().ambient?.windGain).toBe(0);
    expect(audio.stats().ambient?.rainGain).toBe(0);
    clearSynthCalls();
    session.updateSettings({ muted: false });
    expect(lastArgs(fake.setWind)).toEqual([true]);
    expect(lastNumber(fake.setWindLevel, 0)).toBeCloseTo(AUDIO.wind.gain * AUDIO.wind.floor, 12);
    expect(lastArgs(fake.setWindLevel)?.[1]).toBe(false);
    expect(lastNumber(fake.setRain, 0)).toBeCloseTo(AUDIO.rain.gain * AUDIO.bedTrim.rain[2], 12);
  });

  it('windStop: wind and rain go silent and later ticks push neither', () => {
    const { session, feedback, audio, tick } = buildRig({ finalAlignment: 1 });
    expect(session.purchase('primaryFunction').ok).toBe(true);
    expect(session.state.ending.phase).toBe('sequence');
    Object.assign(feedback.worldWeather, { live: true, wind: 1, virgaAlpha: 0.7, virgaSpeed: 1 });
    tick();
    clearSynthCalls();
    feedback.finaleBeat.emit('windStop');
    expect(lastArgs(fake.setWind)).toEqual([false]);
    expect(lastNumber(fake.setRain, 0)).toBe(0);
    clearSynthCalls();
    tick();
    tick();
    expect(fake.setWindLevel).not.toHaveBeenCalled();
    expect(fake.setRain).not.toHaveBeenCalled();
    expect(audio.stats().ambient?.windGain).toBe(0);
    expect(audio.stats().ambient?.rainGain).toBe(0);
  });

  it('choice and postgame: the gate is closed like windStop, so the wind and rain stay silent', () => {
    const { session, feedback, audio, tick } = buildRig({ finalAlignment: 1 });
    expect(session.purchase('primaryFunction').ok).toBe(true);
    Object.assign(feedback.worldWeather, { live: true, wind: 1, virgaAlpha: 0.7, virgaSpeed: 1 });
    expect(session.finishEndingSequence()).toBe(true);
    clearSynthCalls();
    tick();
    expect(lastArgs(fake.setWind)).toEqual([false]);
    expect(lastNumber(fake.setRain, 0)).toBe(0);
    expect(audio.stats().ambient?.windGain).toBe(0);
    clearSynthCalls();
    expect(session.keepRunning()).toBe(true);
    tick();
    expect(fake.setWindLevel).not.toHaveBeenCalled();
    expect(fake.setRain).not.toHaveBeenCalled();
    expect(audio.stats().ambient?.windGain).toBe(0);
  });

  it('the readout carries the five weather fields', () => {
    const { feedback, audio, tick } = buildRig({ boiler: 1 });
    Object.assign(feedback.worldWeather, { live: true, wind: 1, virgaAlpha: 0.7, virgaSpeed: 1 });
    tick();
    expect(audio.stats().ambient).toMatchObject({ live: true, windLfo: false, rainHz: AUDIO.rain.hzMax });
    expect(audio.stats().ambient?.windGain).toBeCloseTo(AUDIO.wind.gain, 12);
    expect(audio.stats().ambient?.rainGain).toBeCloseTo(AUDIO.rain.gain * AUDIO.bedTrim.rain[2], 12);
  });

  it('dispose: no wind or rain call after it', () => {
    const { audio, feedback, tick } = buildRig({ boiler: 1 });
    Object.assign(feedback.worldWeather, { live: true, wind: 1, virgaAlpha: 0.7, virgaSpeed: 1 });
    tick();
    audio.dispose();
    clearSynthCalls();
    tick();
    expect(fake.setWind).not.toHaveBeenCalled();
    expect(fake.setWindLevel).not.toHaveBeenCalled();
    expect(fake.setRain).not.toHaveBeenCalled();
  });
});

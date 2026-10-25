import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUDIO } from '../data/audio';
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

import { describe, it, expect } from 'vitest';
import { FAULTS } from '../data/faults';
import type { GameState, TechId } from '../data/types';
import type { SessionEvents } from './events';
import { GameSession } from './GameSession';
import { createInitialState } from './state';

// WP27 C5 / A7: the session wiring of the wind-up (production/windup.ts) and the Machine Faults clock (faults.ts).
// Both are transient by design: nothing here is saved. Tests inject `now` and `faultSeed` (27 = the audit harness seed).
// Every session step of the clock is FAULTS.maxStepS (0.25 s): the session clamps longer frames to that.

type Levels = Partial<Record<TechId, number>>;

const withLevels = (levels: Levels, extra: Partial<GameState> = {}): GameState => {
  const s = createInitialState(0);
  return { ...s, ...extra, techLevels: { ...s.techLevels, ...levels } };
};

// A session at time 0 past its offline pass, so update(t) calls within the offline threshold are normal steps.
const session = (levels: Levels, options: { maxEra?: number } = {}): GameSession => {
  const s = new GameSession({
    state: withLevels(levels, { lastSimTime: 0 }),
    now: () => 0,
    faultSeed: 27,
    maxEra: options.maxEra ?? null,
  });
  s.applyOffline(0);
  return s;
};

// Runs the fault clock for `seconds` of eligible time, in clamped steps.
const runFaults = (s: GameSession, seconds: number): void => {
  const steps = Math.round(seconds / FAULTS.maxStepS);
  for (let i = 0; i < steps; i++) s.stepFaults(FAULTS.maxStepS, true);
};

// Spawns one fault at once: the debug hook, then one eligible step.
const spawnNow = (s: GameSession): void => {
  expect(s.debugForceFault()).toBe(true);
  s.stepFaults(FAULTS.maxStepS, true);
};

// Records the fault events of a session as compact strings, in emission order.
const recordFaults = (s: GameSession): string[] => {
  const log: string[] = [];
  s.on('fault', (p) => log.push(`${p.kind}:${p.serial}`));
  return log;
};

describe('GameSession wind-up (WP27 C5)', () => {
  it('a click releases the wind-up once and reports the released seconds', () => {
    const s = session({ wornMotor: 1, reinforcedCrank: 1 });
    s.update(5000); // refill 0.035 s per s for 5 s, below the 0.35 s cap
    const stored = s.windup.stored;
    expect(stored).toBeCloseTo(0.175, 9);
    const { perClick, perSecond } = s.rates;
    const payloads: SessionEvents['click'][] = [];
    s.on('click', (p) => payloads.push(p));

    const gained = s.click();
    expect(payloads).toHaveLength(1);
    expect(payloads[0]?.released).toBeCloseTo(stored, 9);
    expect(payloads[0]?.gained).toBe(gained);
    expect(payloads[0]?.gainedAll.me).toBe(gained);
    // Plain click, then the release: ME = one click + stored seconds of ME/s.
    expect(gained).toBeCloseTo(perClick.me + stored * perSecond.me, 9);
    expect(s.windup.stored).toBe(0);
    expect(s.state.totalClicks).toBe(1);
    expect(s.stats.clicks).toBe(1);

    // The store is empty: the next click releases nothing and reports only its plain gain.
    const again = s.click();
    expect(payloads[1]?.released ?? 0).toBe(0);
    expect(again).toBeCloseTo(perClick.me, 9);
    expect(payloads[1]?.gainedAll.me).toBeCloseTo(perClick.me, 9);
  });

  it('a servo auto-crank never releases the wind-up: update only refills it', () => {
    const s = session({ handCrank: 1, wornMotor: 1, reinforcedCrank: 1, crankServo: 1 });
    const clicks: SessionEvents['click'][] = [];
    s.on('click', (p) => clicks.push(p));
    s.update(5000);
    const stored = s.windup.stored;
    expect(stored).toBeCloseTo(0.175, 9);
    s.update(7000); // 2 more seconds of servo clicks: the store only refills
    expect(s.windup.stored).toBeCloseTo(stored + 0.035 * 2, 9);
    expect(clicks).toEqual([]);
    expect(s.state.totalClicks).toBe(0);
    // No release means lifetime ME is exactly 7 s of the servo-inclusive rate.
    expect(s.state.lifetime.me).toBeCloseTo(s.rates.perSecond.me * 7, 9);
  });

  it('update refills the wind-up by refill x dt, up to the cap', () => {
    const s = session({ wornMotor: 1, reinforcedCrank: 1 });
    expect(s.windup).toEqual({ stored: 0, cap: 0.35, refill: 0.035 });
    s.update(5000);
    expect(s.windup.stored).toBeCloseTo(0.175, 9);
    s.update(55_000); // +50 s: the store reaches the cap and stops there
    expect(s.windup.stored).toBeCloseTo(0.35, 9);
  });

  it('update adds Overdrive extra seconds to the step and counts the Overdrive down', () => {
    const s = session({ handCrank: 1, wornMotor: 1, faultLamp: 1, overrunClutch: 1 });
    const events: SessionEvents['fault'][] = [];
    s.on('fault', (p) => events.push(p));
    spawnNow(s);
    expect(s.clearFault()).not.toBeNull();
    expect(events.at(-1)).toMatchObject({ kind: 'clear', serial: 0, overdriveSeconds: 6 });
    expect(s.faults.overdriveLeft).toBe(6);
    expect(s.faults.overdriveFactor).toBe(2);

    const perSecond = s.rates.perSecond.me;
    const me0 = s.state.res.me;
    s.update(2000); // 2 s inside Overdrive: 2 s of output plus (2 - 1) x 2 s extra
    expect(s.faults.overdriveLeft).toBeCloseTo(4, 9);
    expect(s.state.res.me - me0).toBeCloseTo(perSecond * 4, 9);
    s.update(12_000); // 10 s with 4 s of Overdrive left: 10 s plus 4 s extra
    expect(s.faults.overdriveLeft).toBe(0);
    expect(s.state.res.me - me0).toBeCloseTo(perSecond * 18, 9);
    s.update(14_000); // Overdrive spent: plain output again
    expect(s.state.res.me - me0).toBeCloseTo(perSecond * 20, 9);
  });

  it('applyOffline refills the wind-up by the capped span and never moves the fault clock', () => {
    const s = session({ wornMotor: 1, reinforcedCrank: 1, faultLamp: 1 });
    runFaults(s, 10);
    const before = s.faults;
    expect(before.nextIn).not.toBeNull();
    const report = s.applyOffline(5000);
    expect(report.cappedSeconds).toBe(5);
    expect(s.windup.stored).toBeCloseTo(0.175, 9);
    expect(s.faults).toEqual(before);
  });
});

describe('GameSession Machine Faults (WP27 C5)', () => {
  it('a new session from the same state waits at least 180 eligible seconds before its first fault', () => {
    const state = withLevels({ faultLamp: 1, wornMotor: 1 }, { lastSimTime: 0 });
    const reload = new GameSession({ state, now: () => 0, faultSeed: 27 });
    reload.applyOffline(0);
    let seconds = 0;
    while (reload.faults.spawned === 0 && seconds < 400) {
      reload.stepFaults(FAULTS.maxStepS, true);
      seconds += FAULTS.maxStepS;
    }
    expect(reload.faults.spawned).toBe(1);
    expect(seconds).toBeGreaterThanOrEqual(FAULTS.firstAfterS);
  });

  it('stepFaults with eligible false changes nothing: no event, no revision bump', () => {
    const s = session({ faultLamp: 1, wornMotor: 1 });
    const log = recordFaults(s);
    const revision = s.revision;
    const before = s.faults;
    for (let i = 0; i < 2000; i++) s.stepFaults(FAULTS.maxStepS, false);
    expect(s.faults).toEqual(before);
    expect(s.revision).toBe(revision);
    expect(log).toEqual([]);

    // Arming is silent too: no event and no revision bump.
    s.stepFaults(FAULTS.maxStepS, true);
    expect(s.faults.nextIn).not.toBeNull();
    expect(s.revision).toBe(revision);
    expect(log).toEqual([]);

    // The spawn (after the 180 s wait) emits an event and bumps the revision.
    runFaults(s, 180);
    expect(s.faults.spawned).toBe(1);
    expect(log).toEqual(['spawn:0']);
    expect(s.revision).toBeGreaterThan(revision);
  });

  it('stepFaults clamps dt to FAULTS.maxStepS: one 30 s call ages an alive fault by 0.25 s', () => {
    const s = session({ faultLamp: 1, wornMotor: 1 });
    spawnNow(s);
    expect(s.faults.alive).toEqual({ age: 0, window: FAULTS.windowS, serial: 0 });
    s.stepFaults(30, true);
    expect(s.faults.alive?.age).toBeCloseTo(FAULTS.maxStepS, 9);
    expect(s.faults.missed).toBe(0);
  });

  it('stepFaults clamps dt to FAULTS.maxStepS for the countdown too', () => {
    const s = session({ faultLamp: 1, wornMotor: 1 });
    s.stepFaults(FAULTS.maxStepS, true); // arms the clock
    const armed = s.faults.nextIn;
    expect(armed).not.toBeNull();
    s.stepFaults(30, true);
    expect(s.faults.nextIn).toBeCloseTo((armed ?? 0) - FAULTS.maxStepS, 9);
  });

  it('debugForceFault is false while the Fault Lamp is not owned', () => {
    const s = session({ wornMotor: 1 });
    expect(s.debugForceFault()).toBe(false);
    expect(s.faults.nextIn).toBeNull();
    s.stepFaults(FAULTS.maxStepS, true);
    expect(s.faults.spawned).toBe(0);
  });

  it('debugForceFault is true when unlocked and none is alive: the next eligible step spawns', () => {
    const s = session({ faultLamp: 1, wornMotor: 1 });
    const log = recordFaults(s);
    s.stepFaults(FAULTS.maxStepS, true); // armed: the first fault would wait 180 s
    expect(s.faults.spawned).toBe(0);
    expect(s.debugForceFault()).toBe(true);
    s.stepFaults(FAULTS.maxStepS, false); // not eligible: no spawn yet
    expect(s.faults.spawned).toBe(0);
    s.stepFaults(FAULTS.maxStepS, true);
    expect(s.faults.spawned).toBe(1);
    expect(log).toEqual(['spawn:0']);
    expect(s.debugForceFault()).toBe(false); // one alive at a time
  });
});

describe('GameSession clearFault (WP27 C5)', () => {
  it('with no fault alive returns null and emits nothing', () => {
    const s = session({ faultLamp: 1, wornMotor: 1 });
    const log = recordFaults(s);
    const revision = s.revision;
    const me = s.state.res.me;
    expect(s.clearFault()).toBeNull();
    expect(log).toEqual([]);
    expect(s.revision).toBe(revision);
    expect(s.state.res.me).toBe(me);
    expect(s.faults.caught).toBe(0);
  });

  it('pays payoutSeconds x perSecond on every energy with a rate, emits clear, and bumps the revision', () => {
    // Fault Lamp pays 15 s. Worn Motor gives ME and Generator gives EE, so EE has a rate; PR has none and pays nothing.
    const s = session({ faultLamp: 1, wornMotor: 1, generator: 1 });
    spawnNow(s);
    const { perSecond } = s.rates;
    expect(perSecond.ee).toBeGreaterThan(0);
    expect(perSecond.pr).toBe(0);
    const events: SessionEvents['fault'][] = [];
    s.on('fault', (p) => events.push(p));
    const revision = s.revision;
    const me = s.state.res.me;
    const ee = s.state.res.ee;

    const payout = s.clearFault();
    expect(payout).not.toBeNull();
    expect(payout?.me).toBeCloseTo(15 * perSecond.me, 9);
    expect(payout?.ee).toBeCloseTo(15 * perSecond.ee, 9);
    expect(payout?.pr).toBe(0);
    expect(s.state.res.me).toBeCloseTo(me + 15 * perSecond.me, 9);
    expect(s.state.res.ee).toBeCloseTo(ee + 15 * perSecond.ee, 9);
    expect(s.state.lifetime.me).toBeCloseTo(15 * perSecond.me, 9);
    expect(events).toEqual([{ kind: 'clear', serial: 0, payout, overdriveSeconds: 0 }]);
    expect(s.revision).toBeGreaterThan(revision);
    expect(s.faults.caught).toBe(1);
    expect(s.faults.alive).toBeNull();
  });
});

describe('GameSession wind-up and clock reset (WP27 C5)', () => {
  it('reset empties the wind-up and restarts the fault clock', () => {
    const s = session({ faultLamp: 1, wornMotor: 1, reinforcedCrank: 1 });
    runFaults(s, 200); // one fault spawns at 180 s and expires at 188 s
    expect(s.faults.spawned).toBe(1);
    s.update(5000);
    expect(s.windup.stored).toBeGreaterThan(0);
    s.reset(5000);
    expect(s.windup.stored).toBe(0);
    expect(s.windup.cap).toBe(0);
    expect(s.faults).toMatchObject({ unlocked: false, alive: null, nextIn: null, spawned: 0, caught: 0, missed: 0 });
  });

  it('beginNewCycle empties the wind-up and restarts the fault clock', () => {
    const state = withLevels(
      { faultLamp: 1, wornMotor: 1, reinforcedCrank: 1 },
      { createdAt: 0, lastSimTime: 0, ending: { phase: 'choice', engagedAt: 600_000 } },
    );
    const s = new GameSession({ state, now: () => 0, faultSeed: 27 });
    s.applyOffline(0);
    runFaults(s, 200);
    expect(s.faults.spawned).toBe(1);
    s.update(5000);
    expect(s.windup.stored).toBeGreaterThan(0);
    expect(s.beginNewCycle(700_000)).toBe(true);
    expect(s.windup.stored).toBe(0);
    expect(s.faults).toMatchObject({ alive: null, nextIn: null, spawned: 0, caught: 0, missed: 0 });
  });
});

describe('GameSession wind-up and faults under the demo cap (WP27 C5)', () => {
  it('keeps era I wind-up and fault techs and drops era V ones at construction', () => {
    // maxEra 2 clamps Overrun Clutch (era V) away; Reinforced Crank and Fault Lamp (era I) stay.
    const s = session({ faultLamp: 1, wornMotor: 1, reinforcedCrank: 1, overrunClutch: 1 }, { maxEra: 2 });
    expect(s.state.techLevels.overrunClutch).toBe(0);
    expect(s.faults.unlocked).toBe(true);
    expect(s.faults.overdriveFactor).toBe(1);
    expect(s.windup.cap).toBeCloseTo(0.35, 9);
    spawnNow(s);
    expect(s.clearFault()?.me).toBeCloseTo(15 * s.rates.perSecond.me, 9);
  });
});

describe('GameSession faultAlive (WP27 per-frame view)', () => {
  it('is null before a spawn, then the live fault: the same object on every read until the next step', () => {
    const s = session({ faultLamp: 1, wornMotor: 1 });
    expect(s.faultAlive).toBeNull();
    spawnNow(s);
    const first = s.faultAlive;
    expect(first).toEqual({ age: 0, window: FAULTS.windowS, serial: 0 });
    expect(s.faultAlive).toBe(first);
    expect(s.faultAlive).toBe(first);
  });

  it('a step replaces the object and never mutates the one read before it', () => {
    const s = session({ faultLamp: 1, wornMotor: 1 });
    spawnNow(s);
    const before = s.faultAlive;
    s.stepFaults(FAULTS.maxStepS, true);
    expect(before).toEqual({ age: 0, window: FAULTS.windowS, serial: 0 });
    expect(s.faultAlive?.age).toBeCloseTo(FAULTS.maxStepS, 9);
    expect(s.faultAlive).not.toBe(before);
  });
});

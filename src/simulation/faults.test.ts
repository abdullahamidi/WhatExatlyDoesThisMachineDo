import { describe, it, expect } from 'vitest';
import { TECHNOLOGIES } from '../data/technologies';
import type { ResourceMap, TechDefinition, TechId } from '../data/types';
import { createInitialState } from './state';
import {
  createFaultClock, nextUnit, faultParams, stepFaultClock, clearFault, consumeOverdrive,
} from './faults';
import type { FaultClock, FaultParams } from './faults';

// WP27 C4 / A5. The exact numbers are the audit harness's (seed 27, 1 s eligible steps): the clock must reproduce them.

const LOCKED: FaultParams = { unlocked: false, payoutSeconds: 15, intervalFactor: 1, windowSeconds: 8, overdriveSeconds: 0, overdriveFactor: 1 };
const OPEN: FaultParams = { ...LOCKED, unlocked: true };
const PER_SECOND: ResourceMap = { me: 10, ee: 0, pr: 5, rs: 0, xf: 0 };

// Steps the clock one eligible second at a time until a fault is alive.
function stepUntilAlive(c: FaultClock, p: FaultParams): FaultClock {
  let clock = c;
  for (let k = 0; k < 1000 && clock.alive === null; k++) clock = stepFaultClock(clock, p, 1, true).clock;
  expect(clock.alive).not.toBeNull();
  return clock;
}

// Clears the live fault and returns the result; fails the test when no fault is alive.
function clearOrFail(c: FaultClock, p: FaultParams): { clock: FaultClock; payout: ResourceMap } {
  const cleared = clearFault(c, p, PER_SECOND);
  expect(cleared).not.toBeNull();
  if (cleared === null) throw new Error('no fault alive');
  return cleared;
}

describe('nextUnit (mulberry32, audit harness parity)', () => {
  it('gives the five harness values from seed 27', () => {
    const expected = [0.403266395908, 0.026339064818, 0.021178487455, 0.169121588580, 0.831162245944];
    let rng = 27;
    for (const want of expected) {
      const n = nextUnit(rng);
      expect(Math.abs(n.u - want)).toBeLessThan(1e-12);
      rng = n.rng;
    }
  });

  it('maps the first five draws to 126.293976, 92.370516, 91.906064, 105.220943, 164.804602 s at factor 1', () => {
    const expected = [126.293976, 92.370516, 91.906064, 105.220943, 164.804602];
    let rng = 27;
    for (const want of expected) {
      const n = nextUnit(rng);
      rng = n.rng;
      expect(90 + 90 * n.u).toBeCloseTo(want, 5);
    }
  });
});

describe('createFaultClock', () => {
  it('starts unarmed with no fault and zero counters', () => {
    expect(createFaultClock(27)).toEqual({
      rng: 27, nextIn: null, alive: null, overdriveLeft: 0, eligibleSeconds: 0, spawned: 0, caught: 0, missed: 0,
    });
  });

  it('a locked eligible clock counts time and never arms or spawns', () => {
    let c = createFaultClock(27);
    for (let k = 0; k < 421; k++) {
      const r = stepFaultClock(c, LOCKED, 1, true);
      expect(r.event).toBeNull();
      c = r.clock;
    }
    expect(c.nextIn).toBeNull();
    expect(c.spawned).toBe(0);
    expect(c.eligibleSeconds).toBe(421);
  });
});

describe('h27 case A: Fault Lamp bought at step 421', () => {
  it('arms at 422 with 126.293976, spawns 549, expires 557, spawns 650, expires 658', () => {
    let c = createFaultClock(27);
    for (let k = 1; k <= 421; k++) c = stepFaultClock(c, LOCKED, 1, true).clock;
    const arm = stepFaultClock(c, OPEN, 1, true);
    c = arm.clock;
    expect(arm.event).toBeNull();
    expect(c.nextIn).toBeCloseTo(126.293976, 5);
    const events: Array<[number, string]> = [];
    for (let k = 423; k <= 700; k++) {
      const r = stepFaultClock(c, OPEN, 1, true);
      c = r.clock;
      if (r.event !== null) events.push([k, r.event]);
    }
    expect(events.slice(0, 4)).toEqual([[549, 'spawn'], [557, 'expire'], [650, 'spawn'], [658, 'expire']]);
  });
});

describe('unlocked from step 1', () => {
  it('arms with 179 s (180 - 1 beats the draw), spawns 180, expires 188, spawns 281, expires 289', () => {
    let c = createFaultClock(27);
    const arm = stepFaultClock(c, OPEN, 1, true);
    c = arm.clock;
    expect(c.nextIn).toBe(179);
    const events: Array<[number, string]> = [];
    for (let k = 2; k <= 300; k++) {
      const r = stepFaultClock(c, OPEN, 1, true);
      c = r.clock;
      if (r.event !== null) events.push([k, r.event]);
    }
    expect(events.slice(0, 4)).toEqual([[180, 'spawn'], [188, 'expire'], [281, 'spawn'], [289, 'expire']]);
  });
});

describe('frozen steps', () => {
  it('not eligible, or dt not a finite number above 0: the same object comes back and nothing moves', () => {
    let c = createFaultClock(27);
    for (let k = 0; k < 100; k++) c = stepFaultClock(c, OPEN, 1, true).clock;
    expect(c.nextIn).toBe(80);
    const cases: Array<[number, boolean]> = [[1, false], [0, true], [-1, true], [Number.NaN, true], [Number.POSITIVE_INFINITY, true]];
    for (const [dt, eligible] of cases) {
      const r = stepFaultClock(c, OPEN, dt, eligible);
      expect(r.clock).toBe(c);
      expect(r.event).toBeNull();
    }
    expect(c.eligibleSeconds).toBe(100);
    expect(c.nextIn).toBe(80);
  });

  it('an alive fault does not age while frozen', () => {
    const alive = stepUntilAlive(createFaultClock(27), OPEN);
    expect(alive.alive?.age).toBe(0);
    const r = stepFaultClock(alive, OPEN, 5, false);
    expect(r.clock).toBe(alive);
    expect(r.clock.alive?.age).toBe(0);
  });
});

describe('never two faults alive', () => {
  it('5000 unlocked steps without a clear: alive is null or one fault, and spawned - missed - alive = caught', () => {
    let c = createFaultClock(27);
    let violations = 0;
    for (let k = 0; k < 5000; k++) {
      c = stepFaultClock(c, OPEN, 1, true).clock;
      if (c.spawned - c.missed - (c.alive === null ? 0 : 1) !== c.caught) violations += 1;
    }
    expect(violations).toBe(0);
    expect(c.spawned).toBeGreaterThan(20);
    expect(c.caught).toBe(0);
  });
});

describe('the pure step never clamps', () => {
  it('one 30 s eligible step expires an alive fault with a window of 8 s', () => {
    const alive = stepUntilAlive(createFaultClock(27), OPEN);
    const r = stepFaultClock(alive, OPEN, 30, true);
    expect(r.event).toBe('expire');
    expect(r.clock.alive).toBeNull();
    expect(r.clock.missed).toBe(1);
  });
});

describe('clearFault', () => {
  it('gives null when no fault is alive', () => {
    expect(clearFault(createFaultClock(27), OPEN, PER_SECOND)).toBeNull();
  });

  it('pays payoutSeconds x perSecond only where perSecond > 0, counts a catch, draws the next interval, and does not mutate', () => {
    const alive = stepUntilAlive(createFaultClock(27), OPEN);
    const snapshot = structuredClone(alive);
    const { clock, payout } = clearOrFail(alive, OPEN);
    expect(payout).toEqual({ me: 150, ee: 0, pr: 75, rs: 0, xf: 0 });
    expect(clock.caught).toBe(1);
    expect(clock.alive).toBeNull();
    expect(clock.nextIn).toBeCloseTo(92.370516, 5);
    expect(alive).toEqual(snapshot);
    expect(alive.caught).toBe(0);
  });
});

describe('Overdrive', () => {
  const OD: FaultParams = { ...OPEN, overdriveSeconds: 6, overdriveFactor: 2 };

  it('a clear sets 6 s, a second clear with 4 s left gives 6 s (refresh, not 10)', () => {
    const first = clearOrFail(stepUntilAlive(createFaultClock(27), OD), OD);
    expect(first.clock.overdriveLeft).toBe(6);
    const burned = consumeOverdrive(first.clock, OD, 2);
    expect(burned.clock.overdriveLeft).toBe(4);
    const second = clearOrFail(stepUntilAlive(burned.clock, OD), OD);
    expect(second.clock.overdriveLeft).toBe(6);
  });

  it('a clear with no Overdrive in the params leaves the time left unchanged', () => {
    const alive = { ...stepUntilAlive(createFaultClock(27), OPEN), overdriveLeft: 3 };
    expect(clearOrFail(alive, OPEN).clock.overdriveLeft).toBe(3);
  });

  it('consumeOverdrive: 1 s at factor 2 gives 1 s extra and 1 s less; 1 s with 0.5 left gives 0.5 and 0', () => {
    const od = { ...createFaultClock(27), overdriveLeft: 6 };
    const full = consumeOverdrive(od, OD, 1);
    expect(full.extraSeconds).toBe(1);
    expect(full.clock.overdriveLeft).toBe(5);
    expect(od.overdriveLeft).toBe(6);
    const short = consumeOverdrive({ ...od, overdriveLeft: 0.5 }, OD, 1);
    expect(short.extraSeconds).toBe(0.5);
    expect(short.clock.overdriveLeft).toBe(0);
  });

  it('returns the same object when none is left or dt is not a finite number above 0', () => {
    const none = createFaultClock(27);
    const noneRes = consumeOverdrive(none, OD, 1);
    expect(noneRes.clock).toBe(none);
    expect(noneRes.extraSeconds).toBe(0);
    const od = { ...createFaultClock(27), overdriveLeft: 6 };
    for (const dt of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = consumeOverdrive(od, OD, dt);
      expect(r.clock).toBe(od);
      expect(r.extraSeconds).toBe(0);
    }
  });
});

describe('interval bounds', () => {
  it('every draw lies in [90, 180] x intervalFactor, for factors 0.9 and 1', () => {
    for (const factor of [0.9, 1]) {
      const p: FaultParams = { ...OPEN, intervalFactor: factor };
      let c = stepUntilAlive(createFaultClock(27), p);
      const draws: number[] = [];
      for (let k = 0; k < 200; k++) {
        c = clearOrFail(c, p).clock;
        if (c.nextIn !== null) draws.push(c.nextIn);
        c = stepUntilAlive(c, p);
      }
      expect(draws).toHaveLength(200);
      for (const d of draws) {
        expect(d).toBeGreaterThanOrEqual(90 * factor);
        expect(d).toBeLessThanOrEqual(180 * factor);
      }
      expect(Math.max(...draws) - Math.min(...draws)).toBeGreaterThan(20);
    }
  });
});

describe('determinism', () => {
  // Same seed, same inputs, same clock: the run is a pure function of its inputs.
  function simulate(seed: number): FaultClock {
    let c = createFaultClock(seed);
    for (let k = 0; k < 3000; k++) {
      c = stepFaultClock(c, OPEN, 1, true).clock;
      if (k % 50 === 0 && c.alive !== null) {
        const cleared = clearFault(c, OPEN, PER_SECOND);
        if (cleared !== null) c = cleared.clock;
      }
    }
    return c;
  }

  it('the same inputs give deep-equal clocks, and another seed gives a different run', () => {
    expect(simulate(27)).toEqual(simulate(27));
    expect(simulate(27)).not.toEqual(simulate(28));
  });
});

describe('faultParams', () => {
  const base: Record<TechId, number> = createInitialState(0).techLevels;
  const withTechs = (...ids: TechId[]): Record<TechId, number> => {
    const levels = { ...base };
    for (const id of ids) levels[id] = 1;
    return levels;
  };

  it('is locked with no fault techs', () => {
    expect(faultParams(base)).toEqual({
      unlocked: false, payoutSeconds: 0, intervalFactor: 1, windowSeconds: 8, overdriveSeconds: 0, overdriveFactor: 1,
    });
  });

  it('Fault Lamp unlocks faults and pays 15 s', () => {
    expect(faultParams(withTechs('faultLamp'))).toEqual({
      unlocked: true, payoutSeconds: 15, intervalFactor: 1, windowSeconds: 8, overdriveSeconds: 0, overdriveFactor: 1,
    });
  });

  it('Discharge Lever adds 3 s of pay: 18 s', () => {
    expect(faultParams(withTechs('faultLamp', 'dischargeLever')).payoutSeconds).toBe(18);
  });

  it('Damping Fork adds 4 s of pay and 4 s of window: 22 s and 12 s', () => {
    const p = faultParams(withTechs('faultLamp', 'dischargeLever', 'dampingFork'));
    expect(p.payoutSeconds).toBe(22);
    expect(p.windowSeconds).toBe(12);
  });

  it('Leak Whistle makes the interval x0.9', () => {
    expect(faultParams(withTechs('faultLamp', 'dischargeLever', 'dampingFork', 'leakWhistle')).intervalFactor).toBeCloseTo(0.9, 12);
  });

  it('Overrun Clutch gives 6 s of x2 Overdrive', () => {
    const p = faultParams(withTechs('faultLamp', 'dischargeLever', 'dampingFork', 'leakWhistle', 'overrunClutch'));
    expect(p.overdriveSeconds).toBe(6);
    expect(p.overdriveFactor).toBe(2);
  });

  it('scales the seconds by the level and reads the techs table it is given', () => {
    const techs: Record<TechId, TechDefinition> = {
      ...TECHNOLOGIES,
      faultLamp: { ...TECHNOLOGIES.faultLamp, effects: [{ type: 'faultUnlock', seconds: 10 }] },
    };
    const levels = { ...base, faultLamp: 2 };
    expect(faultParams(levels, techs).payoutSeconds).toBe(20);
  });
});

import { describe, it, expect } from 'vitest';
import { TECHNOLOGIES } from '../data/technologies';
import type { ResourceMap, TechDefinition, TechId } from '../data/types';
import { createInitialState } from './state';
import { nextUnit } from './faults';
import {
  createFindClock, collectFind, findParams, isRelicSerial, stepFindClock,
} from './finds';
import type { FindClock, FindParams } from './finds';

// WP28 C5 / A5. The exact numbers are the audit harness's (seed 28, 1 s eligible steps): the clock must reproduce them.
// The payout spread (Q6) has its own stream, so the parity cases hold with it on.

const LOCKED: FindParams = { unlocked: false, payoutSeconds: 6, intervalFactor: 1, windowSeconds: 25 };
const OPEN: FindParams = { ...LOCKED, unlocked: true };
const PER_SECOND: ResourceMap = { me: 10, ee: 0, pr: 5, rs: 0, xf: 0 };

// Steps one eligible second at a time until a Find is alive.
function stepUntilAlive(c: FindClock, p: FindParams): FindClock {
  let clock = c;
  for (let k = 0; k < 2000 && clock.alive === null; k++) clock = stepFindClock(clock, p, 1, true).clock;
  expect(clock.alive).not.toBeNull();
  return clock;
}

// Steps one eligible second at a time until the live Find expires; returns the clock after the expiry.
function stepUntilExpire(c: FindClock, p: FindParams): FindClock {
  let clock = c;
  for (let k = 0; k < 200; k++) {
    const r = stepFindClock(clock, p, 1, true);
    clock = r.clock;
    if (r.event === 'expire') return clock;
  }
  throw new Error('no expire within 200 steps');
}

// Steps until a Find is alive, then collects it. Returns the clock after the collect and what the Find carried.
function catchNext(c: FindClock, p: FindParams): {
  clock: FindClock; serial: number; spreadS: number; relic: boolean; seconds: number; payout: ResourceMap;
} {
  const clock = stepUntilAlive(c, p);
  const alive = clock.alive;
  if (alive === null) throw new Error('no Find alive');
  const got = collectFind(clock, p, PER_SECOND);
  if (got === null) throw new Error('collect returned null');
  return { clock: got.clock, serial: alive.serial, spreadS: alive.spreadS, relic: got.relic, seconds: got.seconds, payout: got.payout };
}

// The clock after 18 locked steps and the step that arms it (step 19).
function armedAt19(): FindClock {
  let c = createFindClock(28);
  for (let k = 1; k <= 18; k++) c = stepFindClock(c, LOCKED, 1, true).clock;
  return stepFindClock(c, OPEN, 1, true).clock;
}

// Runs the clock for `steps` eligible seconds at 1 s each, collecting every Find on the step after its spawn.
// Returns the events, nextIn after every step and the spread of every Find (the spread stream must not move the events or nextIn).
function schedule(start: FindClock, steps: number): { events: string[]; nextIns: Array<number | null>; spreads: number[] } {
  let c = start;
  const events: string[] = [];
  const nextIns: Array<number | null> = [];
  const spreads: number[] = [];
  for (let k = 1; k <= steps; k++) {
    if (c.alive !== null) {
      spreads.push(c.alive.spreadS);
      const got = collectFind(c, OPEN, PER_SECOND);
      if (got === null) throw new Error('collect returned null');
      c = got.clock;
      events.push(`${k}:collect`);
    }
    const r = stepFindClock(c, OPEN, 1, true);
    c = r.clock;
    if (r.event !== null) events.push(`${k}:${r.event}`);
    nextIns.push(c.nextIn);
  }
  return { events, nextIns, spreads };
}

describe('nextUnit (mulberry32, audit harness parity)', () => {
  it('gives the five harness values from seed 28', () => {
    const expected = [0.428501221584, 0.706383219222, 0.737441588426, 0.747168408241, 0.275174875977];
    let rng = 28;
    for (const want of expected) {
      const n = nextUnit(rng);
      expect(Math.abs(n.u - want)).toBeLessThan(1e-12);
      rng = n.rng;
    }
  });

  it('gives the three catch-seed values from 221745 (28 x 7919 + 13)', () => {
    const expected = [0.041963006370, 0.771382711362, 0.095777055249];
    let rng = 28 * 7919 + 13;
    expect(rng).toBe(221745);
    for (const want of expected) {
      const n = nextUnit(rng);
      expect(Math.abs(n.u - want)).toBeLessThan(1e-12);
      rng = n.rng;
    }
  });
});

describe('createFindClock', () => {
  it('starts unarmed with no Find, zero counters, and a pay stream of seed ^ 0x5bd1e995', () => {
    expect(createFindClock(28)).toEqual({
      rng: 28, payRng: 1540483465, nextIn: null, alive: null, eligibleSeconds: 0, spawned: 0, caught: 0, missed: 0, relics: 0,
    });
  });
});

describe('C5 parity: createFindClock(28), 1 s eligible steps', () => {
  it('locked for steps 1-18, armed at step 19 with draw 77.137592 and nextIn 101', () => {
    let c = createFindClock(28);
    for (let k = 1; k <= 18; k++) {
      const r = stepFindClock(c, LOCKED, 1, true);
      expect(r.event).toBeNull();
      c = r.clock;
    }
    expect(c.nextIn).toBeNull();
    expect(c.eligibleSeconds).toBe(18);
    const arm = stepFindClock(c, OPEN, 1, true);
    expect(arm.event).toBeNull();
    expect(arm.clock.eligibleSeconds).toBe(19);
    expect(arm.clock.nextIn).toBe(101);
    const first = nextUnit(28);
    expect((45 + 75 * first.u).toFixed(6)).toBe('77.137592');
    expect(arm.clock.rng).toBe(first.rng);
  });

  it('spawns at 120, expires at 145 (draw 97.978741), spawns at 243, expires at 268 (draw 100.308119), spawns at 369', () => {
    let c = armedAt19();
    const events: Array<[number, string]> = [];
    const expireDraws: string[] = [];
    const spreads: number[] = [];
    for (let k = 20; k <= 369; k++) {
      const r = stepFindClock(c, OPEN, 1, true);
      c = r.clock;
      if (r.event !== null) events.push([k, r.event]);
      if (r.event === 'expire' && c.nextIn !== null) expireDraws.push(c.nextIn.toFixed(6));
      if (r.event === 'spawn' && c.alive !== null) spreads.push(c.alive.spreadS);
    }
    expect(events).toEqual([[120, 'spawn'], [145, 'expire'], [243, 'spawn'], [268, 'expire'], [369, 'spawn']]);
    expect(expireDraws).toEqual(['97.978741', '100.308119']);
    // Spawns 0, 1, 2 draw the first three pay values of seed 28 ^ 0x5bd1e995: 0.00369, 0.81596, 0.50072 (see the spread tests).
    expect(spreads).toEqual([-2, 2, 0]);
  });

  it('unlocked from step 1: armed with nextIn 119, first spawn at step 120, expiry at 145', () => {
    let c = createFindClock(28);
    const arm = stepFindClock(c, OPEN, 1, true);
    expect(arm.event).toBeNull();
    expect(arm.clock.nextIn).toBe(119);
    c = arm.clock;
    const events: Array<[number, string]> = [];
    for (let k = 2; k <= 145; k++) {
      const r = stepFindClock(c, OPEN, 1, true);
      c = r.clock;
      if (r.event !== null) events.push([k, r.event]);
    }
    expect(events).toEqual([[120, 'spawn'], [145, 'expire']]);
  });

  it('the first Find comes at or after 120 eligible seconds, for every seed tried', () => {
    for (const seed of [1, 2, 3, 7, 28, 99, 12345]) {
      let c = createFindClock(seed);
      let first = -1;
      for (let k = 1; k <= 400 && first < 0; k++) {
        const r = stepFindClock(c, OPEN, 1, true);
        c = r.clock;
        if (r.event === 'spawn') first = c.eligibleSeconds;
      }
      expect(first).toBeGreaterThanOrEqual(120);
    }
  });
});

describe('locked and frozen steps', () => {
  it('a locked clock counts eligible time and never arms or spawns', () => {
    let c = createFindClock(28);
    let events = 0;
    for (let k = 0; k < 5000; k++) {
      const r = stepFindClock(c, LOCKED, 1, true);
      if (r.event !== null) events += 1;
      c = r.clock;
    }
    expect(events).toBe(0);
    expect(c.nextIn).toBeNull();
    expect(c.alive).toBeNull();
    expect(c.spawned).toBe(0);
    expect(c.eligibleSeconds).toBe(5000);
  });

  it('not eligible, or dt not a finite number above 0: the same object comes back and nothing moves', () => {
    let c = createFindClock(28);
    for (let k = 0; k < 50; k++) c = stepFindClock(c, OPEN, 1, true).clock;
    const cases: Array<[number, boolean]> = [[1, false], [0, true], [-1, true], [Number.NaN, true], [Number.POSITIVE_INFINITY, true]];
    for (const [dt, eligible] of cases) {
      const r = stepFindClock(c, OPEN, dt, eligible);
      expect(r.clock).toBe(c);
      expect(r.event).toBeNull();
    }
    expect(c.eligibleSeconds).toBe(50);
    expect(c.nextIn).not.toBeNull();
  });

  it('a locked clock is frozen the same way, and an alive Find does not age while frozen', () => {
    const locked = createFindClock(28);
    expect(stepFindClock(locked, LOCKED, 0, true).clock).toBe(locked);
    const alive = stepUntilAlive(createFindClock(28), OPEN);
    expect(alive.alive?.age).toBe(0);
    const r = stepFindClock(alive, OPEN, 5, false);
    expect(r.clock).toBe(alive);
    expect(r.clock.alive?.age).toBe(0);
  });

  it('never mutates the clock it is given', () => {
    let c = createFindClock(28);
    for (let k = 0; k < 130; k++) c = stepFindClock(c, OPEN, 1, true).clock;
    expect(c.alive).not.toBeNull();
    const snapshot = structuredClone(c);
    stepFindClock(c, OPEN, 1, true);
    stepFindClock(c, OPEN, 30, true);
    collectFind(c, OPEN, PER_SECOND);
    expect(c).toEqual(snapshot);
  });
});

describe('the pure step never clamps', () => {
  it('one 30 s eligible step ages an alive Find by 30 s when its window is 100 s', () => {
    const wide: FindParams = { ...OPEN, windowSeconds: 100 };
    const alive = stepUntilAlive(createFindClock(28), wide);
    const r = stepFindClock(alive, wide, 30, true);
    expect(r.event).toBeNull();
    expect(r.clock.alive?.age).toBe(30);
    expect(r.clock.eligibleSeconds).toBe(alive.eligibleSeconds + 30);
  });

  it('the same 30 s step expires a Find with the 25 s window at once', () => {
    const alive = stepUntilAlive(createFindClock(28), OPEN);
    const r = stepFindClock(alive, OPEN, 30, true);
    expect(r.event).toBe('expire');
    expect(r.clock.alive).toBeNull();
    expect(r.clock.missed).toBe(1);
  });
});

describe('never two Finds alive', () => {
  it('5000 unlocked steps with a collect every 50 steps: spawned - caught - missed is 0 or 1, and matches alive', () => {
    let c = createFindClock(28);
    let violations = 0;
    let spawnsWhileAlive = 0;
    for (let k = 0; k < 5000; k++) {
      if (k % 50 === 0 && c.alive !== null) {
        const got = collectFind(c, OPEN, PER_SECOND);
        if (got !== null) c = got.clock;
      }
      const r = stepFindClock(c, OPEN, 1, true);
      if (r.event === 'spawn' && c.alive !== null) spawnsWhileAlive += 1;
      c = r.clock;
      if (c.spawned - c.caught - c.missed !== (c.alive === null ? 0 : 1)) violations += 1;
    }
    expect(violations).toBe(0);
    expect(spawnsWhileAlive).toBe(0);
    expect(c.spawned).toBeGreaterThan(20);
    expect(c.caught).toBeGreaterThan(0);
  });
});

describe('collectFind', () => {
  it('gives null when no Find is alive', () => {
    expect(collectFind(createFindClock(28), OPEN, PER_SECOND)).toBeNull();
  });

  it('pays (payoutSeconds + spread) x perSecond only where perSecond > 0, counts a catch, draws the next interval, and does not mutate', () => {
    const alive = stepUntilAlive(createFindClock(28), OPEN);
    const snapshot = structuredClone(alive);
    const got = collectFind(alive, OPEN, PER_SECOND);
    expect(got).not.toBeNull();
    if (got === null) throw new Error('no Find alive');
    // Spawn 0 draws spread -2: 4 s of output.
    expect(got.seconds).toBe(4);
    expect(got.relic).toBe(false);
    expect(got.payout).toEqual({ me: 40, ee: 0, pr: 20, rs: 0, xf: 0 });
    expect(got.clock.caught).toBe(1);
    expect(got.clock.relics).toBe(0);
    expect(got.clock.alive).toBeNull();
    expect((got.clock.nextIn ?? 0).toFixed(6)).toBe('97.978741');
    expect(alive).toEqual(snapshot);
    expect(alive.caught).toBe(0);
  });

  it('a spread that would make the pay negative pays nothing', () => {
    const alive = stepUntilAlive(createFindClock(28), { ...OPEN, payoutSeconds: 1 });
    const got = collectFind(alive, { ...OPEN, payoutSeconds: 1 }, PER_SECOND);
    expect(got?.seconds).toBe(0);
    expect(got?.payout).toEqual({ me: 0, ee: 0, pr: 0, rs: 0, xf: 0 });
  });
});

describe('the payout spread (Q6: each Find pays 4, 6 or 8 s)', () => {
  it('the first six Finds of seed 28 carry the spreads -2, +2, 0, +2, 0, -2 (pay draws 0.00369, 0.81596, 0.50072, 0.90171, 0.66544, 0.28722)', () => {
    let c = createFindClock(28);
    const serials: number[] = [];
    const spreads: number[] = [];
    const seconds: number[] = [];
    const relics: boolean[] = [];
    for (let i = 0; i < 6; i++) {
      const r = catchNext(c, OPEN);
      c = r.clock;
      serials.push(r.serial);
      spreads.push(r.spreadS);
      seconds.push(r.seconds);
      relics.push(r.relic);
    }
    expect(serials).toEqual([0, 1, 2, 3, 4, 5]);
    expect(spreads).toEqual([-2, 2, 0, 2, 0, -2]);
    // Serial 4 is a relic: its spread is drawn but it pays nothing.
    expect(seconds).toEqual([4, 8, 6, 8, 0, 4]);
    expect(relics).toEqual([false, false, false, false, true, false]);
  });

  it('over 3000 spawns each of -2, 0, 2 is between 30 % and 37 %, and the mean spread is within 0.1 of 0', () => {
    let c = createFindClock(28);
    let low = 0;
    let mid = 0;
    let high = 0;
    for (let i = 0; i < 3000; i++) {
      const r = catchNext(c, OPEN);
      c = r.clock;
      if (r.spreadS === -2) low += 1;
      else if (r.spreadS === 0) mid += 1;
      else if (r.spreadS === 2) high += 1;
      else throw new Error(`spread ${r.spreadS} outside FINDS.payoutSpreadS`);
    }
    expect(low + mid + high).toBe(3000);
    for (const n of [low, mid, high]) {
      expect(n / 3000).toBeGreaterThanOrEqual(0.30);
      expect(n / 3000).toBeLessThanOrEqual(0.37);
    }
    expect(Math.abs((2 * high - 2 * low) / 3000)).toBeLessThan(0.1);
  });

  it('the spread stream never moves a spawn, an expiry or a draw of the interval stream', () => {
    const a = schedule(createFindClock(28), 2000);
    const b = schedule({ ...createFindClock(28), payRng: 12345 }, 2000);
    expect(a.events.length).toBeGreaterThan(20);
    expect(b.events).toEqual(a.events);
    expect(b.nextIns).toEqual(a.nextIns);
    expect(b.spreads).not.toEqual(a.spreads);
  });
});

describe('relics', () => {
  it('isRelicSerial: serials 4, 9, 14 are relics; the others are not', () => {
    for (let s = 0; s < 20; s++) expect(isRelicSerial(s)).toBe(s % 5 === 4);
    expect([4, 9, 14].every((s) => isRelicSerial(s))).toBe(true);
  });

  it('relic serials 4, 9, 14 pay nothing and count as relics; every catch counts', () => {
    let c = createFindClock(28);
    const relicSerials: number[] = [];
    for (let i = 0; i < 15; i++) {
      const r = catchNext(c, OPEN);
      c = r.clock;
      if (!r.relic) continue;
      relicSerials.push(r.serial);
      expect(r.seconds).toBe(0);
      expect(r.payout).toEqual({ me: 0, ee: 0, pr: 0, rs: 0, xf: 0 });
    }
    expect(relicSerials).toEqual([4, 9, 14]);
    expect(c.relics).toBe(3);
    expect(c.caught).toBe(15);
    expect(c.missed).toBe(0);
  });
});

describe('interval bounds', () => {
  it('every interval draw lies in [45, 120] x intervalFactor, for factors 0.9 and 1, from collects and from expiries', () => {
    for (const factor of [0.9, 1]) {
      const p: FindParams = { ...OPEN, intervalFactor: factor };
      let c = stepUntilAlive(createFindClock(28), p);
      const draws: number[] = [];
      for (let k = 0; k < 200; k++) {
        if (k % 2 === 0) {
          const got = collectFind(c, p, PER_SECOND);
          if (got === null) throw new Error('no Find alive');
          c = got.clock;
        } else {
          c = stepUntilExpire(c, p);
        }
        if (c.nextIn !== null) draws.push(c.nextIn);
        c = stepUntilAlive(c, p);
      }
      expect(draws).toHaveLength(200);
      for (const d of draws) {
        expect(d).toBeGreaterThanOrEqual(45 * factor - 1e-9);
        expect(d).toBeLessThanOrEqual(120 * factor + 1e-9);
      }
      expect(Math.max(...draws) - Math.min(...draws)).toBeGreaterThan(20);
    }
  });
});

describe('determinism', () => {
  // Same seed, same inputs, same clock: the run is a pure function of its inputs.
  function simulate(seed: number): FindClock {
    let c = createFindClock(seed);
    for (let k = 0; k < 3000; k++) {
      c = stepFindClock(c, OPEN, 1, true).clock;
      if (k % 50 === 0 && c.alive !== null) {
        const got = collectFind(c, OPEN, PER_SECOND);
        if (got !== null) c = got.clock;
      }
    }
    return c;
  }

  it('the same seed gives deep-equal clocks, and another seed gives a different run', () => {
    expect(simulate(28)).toEqual(simulate(28));
    expect(simulate(28)).not.toEqual(simulate(29));
  });
});

describe('findParams', () => {
  const base: Record<TechId, number> = createInitialState(0).techLevels;
  const withTechs = (...ids: TechId[]): Record<TechId, number> => {
    const levels = { ...base };
    for (const id of ids) levels[id] = 1;
    return levels;
  };

  it('is locked with no Find techs: 6 s, factor 1, window 25', () => {
    expect(findParams(base)).toEqual({ unlocked: false, payoutSeconds: 6, intervalFactor: 1, windowSeconds: 25 });
  });

  it('Worn Motor unlocks the Finds and pays the flat 6 s', () => {
    expect(findParams(withTechs('wornMotor'))).toEqual({ unlocked: true, payoutSeconds: 6, intervalFactor: 1, windowSeconds: 25 });
  });

  it('Barrel Organ adds 1 s (7 s); Kite adds 1 s more (8 s)', () => {
    expect(findParams(withTechs('wornMotor', 'spliceOrgan')).payoutSeconds).toBe(7);
    expect(findParams(withTechs('wornMotor', 'spliceOrgan', 'spliceKite')).payoutSeconds).toBe(8);
  });

  it('Factory Whistle makes the interval x0.85, and the factor compounds per level', () => {
    expect(findParams(withTechs('wornMotor', 'spliceWhistle')).intervalFactor).toBeCloseTo(0.85, 12);
    expect(findParams({ ...base, wornMotor: 1, spliceWhistle: 2 }).intervalFactor).toBeCloseTo(0.85 * 0.85, 12);
  });

  it('scales the seconds by the level and reads the techs table it is given', () => {
    const techs: Record<TechId, TechDefinition> = {
      ...TECHNOLOGIES,
      spliceOrgan: { ...TECHNOLOGIES.spliceOrgan, effects: [{ type: 'findSeconds', seconds: 3 }] },
    };
    const levels = { ...base, wornMotor: 1, spliceOrgan: 2 };
    expect(findParams(levels, techs).payoutSeconds).toBe(12);
  });
});

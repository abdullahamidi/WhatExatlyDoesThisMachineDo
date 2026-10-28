import { FAULTS } from '../data/faults';
import { TECHNOLOGIES } from '../data/technologies';
import { RESOURCE_IDS, TECH_IDS } from '../data/types';
import type { ResourceMap, TechDefinition, TechId } from '../data/types';
import { emptyResourceMap } from './resources';

// Machine Faults clock (WP27). Pure: every function returns new objects and never mutates its inputs.
// One clock per run. It moves only through stepFaultClock, which the session calls per frame, never offline.
// Every interval draw takes one mulberry32 step of the clock rng, and arming, clear and expire each draw once
// in that order: this is the audit harness's order, so the greedy sims reproduce it exactly.
// The pure step never clamps dt; the session clamps it to FAULTS.maxStepS before it steps the clock.

/** Fault numbers summed over the owned fault techs (faultParams). */
export interface FaultParams {
  unlocked: boolean;         // Fault Lamp owned: the clock may arm and spawn
  payoutSeconds: number;     // seconds of output a clear pays, times each energy's per-second rate
  intervalFactor: number;    // multiplies every interval draw (Leak Whistle: factor ^ level)
  windowSeconds: number;     // seconds a fault stays before it expires
  overdriveSeconds: number;  // seconds of Overdrive a clear grants (0 = none)
  overdriveFactor: number;   // output multiplier while Overdrive runs (1 = none)
}

/** Sum the fault effects of the owned techs. Levels scale the seconds; the rate factor compounds per level. */
export function faultParams(
  levels: Readonly<Record<TechId, number>>,
  techs: Record<TechId, TechDefinition> = TECHNOLOGIES,
): FaultParams {
  const p: FaultParams = {
    unlocked: false, payoutSeconds: 0, intervalFactor: 1, windowSeconds: FAULTS.windowS, overdriveSeconds: 0, overdriveFactor: 1,
  };
  for (const id of TECH_IDS) {
    const level = levels[id];
    if (level <= 0) continue;
    for (const effect of techs[id].effects) {
      switch (effect.type) {
        case 'faultUnlock':
          p.unlocked = true;
          p.payoutSeconds += effect.seconds * level;
          break;
        case 'faultSeconds':
          p.payoutSeconds += effect.seconds * level;
          break;
        case 'faultRate':
          p.intervalFactor *= Math.pow(effect.factor, level);
          break;
        case 'faultWindow':
          p.windowSeconds += effect.seconds * level;
          break;
        case 'overdrive':
          // Overdrive does not stack across techs: the strongest factor wins, the seconds add up per level.
          p.overdriveSeconds += effect.seconds * level;
          p.overdriveFactor = Math.max(p.overdriveFactor, effect.factor);
          break;
        default:
          break;
      }
    }
  }
  return p;
}

/** The fault on screen. age and window in seconds; serial counts the faults of this clock from 0. */
export interface FaultAlive { age: number; window: number; serial: number }

export interface FaultClock {
  rng: number;                   // mulberry32 state of the interval draws
  nextIn: number | null;         // seconds until the next spawn; null until the clock is armed
  alive: FaultAlive | null;      // at most one fault at a time
  overdriveLeft: number;         // seconds of Overdrive left (counted down by consumeOverdrive)
  eligibleSeconds: number;       // eligible time since creation, locked or not: the first fault waits on it
  spawned: number;
  caught: number;                // cleared by the player
  missed: number;                // expired unseen
}

export function createFaultClock(seed: number): FaultClock {
  return { rng: seed | 0, nextIn: null, alive: null, overdriveLeft: 0, eligibleSeconds: 0, spawned: 0, caught: 0, missed: 0 };
}

/** One mulberry32 step: a uniform value in [0, 1) and the new state. Bit-identical to the audit harness. */
export function nextUnit(rng: number): { u: number; rng: number } {
  let a = rng | 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { u: ((t ^ (t >>> 14)) >>> 0) / 4294967296, rng: a };
}

/** The next interval in seconds, from one clock draw. */
function drawInterval(rng: number, p: FaultParams): { seconds: number; rng: number } {
  const next = nextUnit(rng);
  return { seconds: (FAULTS.intervalS[0] + (FAULTS.intervalS[1] - FAULTS.intervalS[0]) * next.u) * p.intervalFactor, rng: next.rng };
}

/**
 * Advance the clock by dt eligible seconds. Frozen (same object back, no event) when not eligible or when dt is not a
 * finite number above 0. Locked clocks only count eligible time. Otherwise: an alive fault ages and expires at its
 * window; an unarmed clock arms (the arming step never spawns); a waiting clock counts down and spawns at zero.
 */
export function stepFaultClock(
  c: FaultClock,
  p: FaultParams,
  dt: number,
  eligible: boolean,
): { clock: FaultClock; event: 'spawn' | 'expire' | null } {
  if (!eligible || !(dt > 0) || !Number.isFinite(dt)) return { clock: c, event: null };
  const eligibleSeconds = c.eligibleSeconds + dt;
  if (!p.unlocked) return { clock: { ...c, eligibleSeconds }, event: null };
  if (c.alive !== null) {
    const age = c.alive.age + dt;
    if (age >= c.alive.window) {
      const d = drawInterval(c.rng, p);
      return {
        clock: { ...c, eligibleSeconds, rng: d.rng, alive: null, missed: c.missed + 1, nextIn: d.seconds },
        event: 'expire',
      };
    }
    return { clock: { ...c, eligibleSeconds, alive: { ...c.alive, age } }, event: null };
  }
  if (c.nextIn === null) {
    // The first fault never comes before FAULTS.firstAfterS eligible seconds, however short the draw.
    const d = drawInterval(c.rng, p);
    return {
      clock: { ...c, eligibleSeconds, rng: d.rng, nextIn: Math.max(d.seconds, FAULTS.firstAfterS - eligibleSeconds) },
      event: null,
    };
  }
  const nextIn = c.nextIn - dt;
  if (nextIn <= 0) {
    return {
      clock: { ...c, eligibleSeconds, alive: { age: 0, window: p.windowSeconds, serial: c.spawned }, spawned: c.spawned + 1, nextIn: 0 },
      event: 'spawn',
    };
  }
  return { clock: { ...c, eligibleSeconds, nextIn }, event: null };
}

/**
 * Clear the live fault. Pays payoutSeconds of each energy that has a rate (perSecond > 0), starts the next interval,
 * and refreshes Overdrive (never stacks it). null when no fault is alive.
 */
export function clearFault(
  c: FaultClock,
  p: FaultParams,
  perSecond: Readonly<ResourceMap>,
): { clock: FaultClock; payout: ResourceMap } | null {
  if (c.alive === null) return null;
  const payout = emptyResourceMap();
  for (const r of RESOURCE_IDS) {
    payout[r] = perSecond[r] > 0 ? p.payoutSeconds * perSecond[r] : 0;
  }
  const d = drawInterval(c.rng, p);
  return {
    clock: {
      ...c,
      rng: d.rng,
      alive: null,
      caught: c.caught + 1,
      overdriveLeft: p.overdriveSeconds > 0 ? p.overdriveSeconds : c.overdriveLeft,
      nextIn: d.seconds,
    },
    payout,
  };
}

/** Spend up to dt seconds of Overdrive. extraSeconds is the bonus output time on top of dt. */
export function consumeOverdrive(
  c: FaultClock,
  p: FaultParams,
  dt: number,
): { clock: FaultClock; extraSeconds: number } {
  if (!(dt > 0) || !Number.isFinite(dt) || c.overdriveLeft <= 0) return { clock: c, extraSeconds: 0 };
  const used = Math.min(dt, c.overdriveLeft);
  return {
    clock: { ...c, overdriveLeft: c.overdriveLeft - used },
    extraSeconds: (p.overdriveFactor - 1) * used,
  };
}

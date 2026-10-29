import { FINDS } from '../data/finds';
import { TECHNOLOGIES } from '../data/technologies';
import { RESOURCE_IDS, TECH_IDS } from '../data/types';
import type { ResourceMap, TechDefinition, TechId } from '../data/types';
import { nextUnit } from './faults';
import { emptyResourceMap } from './resources';

// Find clock (WP28 C5). Pure: every function returns new objects and never mutates its inputs.
// One clock per run. It moves only through stepFindClock, which the session calls per frame, never offline.
// Same contract as the fault clock: every interval draw takes one mulberry32 step of the interval rng, and arming,
// expire and collect each draw once in that order, so the greedy sims reproduce it exactly. The payout spread (Q6)
// has its own stream, one step per spawn, so it never moves a spawn or an expiry.
// The pure step never clamps dt; the session clamps it to FINDS.maxStepS before it steps the clock.

/** Find numbers summed over the owned Find techs (findParams). */
export interface FindParams {
  unlocked: boolean;         // Worn Motor owned: the clock may arm and spawn
  payoutSeconds: number;     // seconds a collect pays before the spread: FINDS.payoutS plus the findSeconds effects
  intervalFactor: number;    // multiplies every interval draw (findRate effects: factor ^ level)
  windowSeconds: number;     // seconds a Find stays before it expires
}

/** Sum the Find effects of the owned techs. Levels scale the seconds; the rate factor compounds per level. */
export function findParams(
  levels: Readonly<Record<TechId, number>>,
  techs: Record<TechId, TechDefinition> = TECHNOLOGIES,
): FindParams {
  const p: FindParams = {
    unlocked: levels[FINDS.unlockTech] >= 1, payoutSeconds: FINDS.payoutS, intervalFactor: 1, windowSeconds: FINDS.windowS,
  };
  for (const id of TECH_IDS) {
    const level = levels[id];
    if (level <= 0) continue;
    for (const effect of techs[id].effects) {
      switch (effect.type) {
        case 'findSeconds':
          p.payoutSeconds += effect.seconds * level;
          break;
        case 'findRate':
          p.intervalFactor *= Math.pow(effect.factor, level);
          break;
        default:
          break;
      }
    }
  }
  return p;
}

/** The Find on screen. age, window in seconds; serial counts the Finds of this clock from 0. */
export interface FindAlive {
  age: number;        // seconds since the spawn
  window: number;     // seconds it stays before it expires
  serial: number;
  relic: boolean;     // every relicEvery-th Find: a field note, no payout
  spreadS: number;    // seconds added to payoutSeconds on collect (drawn at the spawn)
}

export interface FindClock {
  rng: number;                 // mulberry32 state of the interval draws
  payRng: number;              // mulberry32 state of the payout spread draws (one step per spawn)
  nextIn: number | null;       // seconds until the next spawn; null until the clock is armed
  alive: FindAlive | null;     // at most one Find at a time
  eligibleSeconds: number;     // eligible time since creation, locked or not: the first Find waits on it
  spawned: number;
  caught: number;              // collected by the player (relics included)
  missed: number;              // expired unseen
  relics: number;              // relics collected (they pay nothing)
}

export function createFindClock(seed: number): FindClock {
  return {
    rng: seed | 0, payRng: (seed ^ FINDS.paySeedXor) | 0, nextIn: null, alive: null, eligibleSeconds: 0,
    spawned: 0, caught: 0, missed: 0, relics: 0,
  };
}

/** Every relicEvery-th Find is a relic: serials 4, 9, 14, ... */
export function isRelicSerial(serial: number): boolean {
  return FINDS.relicEvery > 0 && serial % FINDS.relicEvery === FINDS.relicEvery - 1;
}

/** The next interval in seconds, from one interval draw. */
function drawInterval(rng: number, p: FindParams): { seconds: number; rng: number } {
  const next = nextUnit(rng);
  return { seconds: (FINDS.intervalS[0] + (FINDS.intervalS[1] - FINDS.intervalS[0]) * next.u) * p.intervalFactor, rng: next.rng };
}

/** One spread value from a uniform draw u in [0, 1): equal weight over FINDS.payoutSpreadS. */
function spreadFor(u: number): number {
  const spread = FINDS.payoutSpreadS;
  return spread[Math.min(spread.length - 1, Math.floor(u * spread.length))] ?? 0;
}

/**
 * Advance the clock by dt eligible seconds. Frozen (same object back, no event) when not eligible or when dt is not a
 * finite number above 0. Locked clocks only count eligible time. Otherwise: an alive Find ages and expires at its
 * window; an unarmed clock arms (the arming step never spawns); a waiting clock counts down and spawns at zero.
 */
export function stepFindClock(
  c: FindClock,
  p: FindParams,
  dt: number,
  eligible: boolean,
): { clock: FindClock; event: 'spawn' | 'expire' | null } {
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
    // The first Find never comes before FINDS.firstAfterS eligible seconds, however short the draw.
    const d = drawInterval(c.rng, p);
    return {
      clock: { ...c, eligibleSeconds, rng: d.rng, nextIn: Math.max(d.seconds, FINDS.firstAfterS - eligibleSeconds) },
      event: null,
    };
  }
  const nextIn = c.nextIn - dt;
  if (nextIn <= 0) {
    const serial = c.spawned;
    const pay = nextUnit(c.payRng);
    return {
      clock: {
        ...c,
        eligibleSeconds,
        payRng: pay.rng,
        alive: { age: 0, window: p.windowSeconds, serial, relic: isRelicSerial(serial), spreadS: spreadFor(pay.u) },
        spawned: c.spawned + 1,
        nextIn: 0,
      },
      event: 'spawn',
    };
  }
  return { clock: { ...c, eligibleSeconds, nextIn }, event: null };
}

/**
 * Collect the live Find. A relic pays nothing (seconds 0) and counts as a relic. Any other Find pays
 * max(0, payoutSeconds + spreadS) seconds of each energy that has a rate (perSecond > 0). Either way it counts a catch,
 * clears the Find and draws the next interval. null when no Find is alive.
 */
export function collectFind(
  c: FindClock,
  p: FindParams,
  perSecond: Readonly<ResourceMap>,
): { clock: FindClock; payout: ResourceMap; relic: boolean; seconds: number } | null {
  const alive = c.alive;
  if (alive === null) return null;
  const payout = emptyResourceMap();
  const seconds = alive.relic ? 0 : Math.max(0, p.payoutSeconds + alive.spreadS);
  if (!alive.relic) {
    for (const r of RESOURCE_IDS) {
      payout[r] = perSecond[r] > 0 ? seconds * perSecond[r] : 0;
    }
  }
  const d = drawInterval(c.rng, p);
  return {
    clock: {
      ...c,
      rng: d.rng,
      alive: null,
      caught: c.caught + 1,
      relics: alive.relic ? c.relics + 1 : c.relics,
      nextIn: d.seconds,
    },
    payout,
    relic: alive.relic,
    seconds,
  };
}

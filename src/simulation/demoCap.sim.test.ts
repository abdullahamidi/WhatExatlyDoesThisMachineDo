import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DESIGN_MAX_VALUE } from '../data/balance';
import { EDITIONS } from '../data/edition';
import { RESOURCES } from '../data/resources';
import { TECHNOLOGIES } from '../data/technologies';
import { RESOURCE_IDS, TECH_IDS } from '../data/types';
import type { GameState, TechId } from '../data/types';
import { applyOffline } from './production/tick';
import { evaluateMilestones } from './progression/milestones';
import { runGreedy } from './sim/greedy';
import type { GreedyFaults, GreedyOptions, GreedyResult } from './sim/greedy';

// WP21 demo cap timing guard. Greedy players must reach the demo cap tech inside fixed windows, the
// era gate must not move that time, and nothing above the cap may leak in, also after a long offline
// credit. Windows: A and B are the WP21 sign-off values; N and C are re-set for WP25 (user playtest 2026-10-25
// supersedes the WP21 N / C values, passive-first seed); P1d is the WP25 passive-first player. A failing window is
// a balance finding, so do not widen them.
// WP27 (playtest 2026-10-27): A, B, N and C also run the Machine Faults process (`faults`); P1d runs none.
// One run per profile in beforeAll; the tests only assert. Re-run: npx vitest run src/simulation/demoCap.sim.test.ts

const MINUTE = 60;
const HOUR = 3600;
const STEP_SECONDS = 1;
const LONG_SECONDS = 4 * HOUR; // active play for the cap-leak check, no stopAt
const OFFLINE_MS = 8 * HOUR * 1000; // offline credit after the long run, epoch ms
// Greedy runs stop at the cap tech, so this only bounds the setup of all runs together.
const SETUP_TIMEOUT_MS = 60000;

// Cap and era come from the edition, never retyped here. Null would mean the edition is not the demo.
function demoValue<T>(value: T | null, what: string): T {
  if (value === null) throw new Error(`demo edition has no ${what}`);
  return value;
}
const CAP_TECH: TechId = demoValue(EDITIONS.demo.capTech, 'capTech');
const MAX_ERA: number = demoValue(EDITIONS.demo.maxEra, 'maxEra');

const ABOVE_CAP_TECHS = TECH_IDS.filter((id) => TECHNOLOGIES[id].era > MAX_ERA);
const ABOVE_CAP_RESOURCES = RESOURCE_IDS.filter((id) => RESOURCES[id].era > MAX_ERA);

type ProfileId = 'A' | 'B' | 'N' | 'C' | 'P1d';

interface Profile {
  readonly id: ProfileId;
  readonly name: string;
  readonly clicksPerSecond: number;
  readonly buyIntervalSeconds: number;
  readonly seconds: number; // active budget; the run stops at the cap tech before it
  readonly lo: number; // window for reaching the cap tech, active seconds
  readonly hi: number;
  // WP25: clicks per second read from the state each step; replaces clicksPerSecond when set.
  readonly clickRate?: (state: Readonly<GameState>) => number;
  // WP27: Machine Faults process (catch chance, reaction seconds). Absent = no fault process (P1d).
  readonly faults?: GreedyFaults;
}

const PROFILE_A: Profile = { id: 'A', name: 'A (4 clicks/s, buys every 1 s)', clicksPerSecond: 4, buyIntervalSeconds: 1, seconds: 17400, lo: 55 * MINUTE, hi: 66 * MINUTE, faults: { catchProb: 1, reactionSeconds: 2 } };
const PROFILE_B: Profile = { id: 'B', name: 'B (4 clicks/s, buys every 30 s)', clicksPerSecond: 4, buyIntervalSeconds: 30, seconds: 18000, lo: 66 * MINUTE, hi: 80 * MINUTE, faults: { catchProb: 1, reactionSeconds: 3 } };
// New player: slower clicks and buys than B, so it lands after B and before the 1 cps player.
const PROFILE_N: Profile = { id: 'N', name: 'N new player (2 clicks/s, buys every 10 s)', clicksPerSecond: 2, buyIntervalSeconds: 10, seconds: 18000, lo: 66 * MINUTE, hi: 90 * MINUTE, faults: { catchProb: 1, reactionSeconds: 3 } };
const PROFILE_C: Profile = { id: 'C', name: 'C (1 click/s, buys every 30 s)', clicksPerSecond: 1, buyIntervalSeconds: 30, seconds: 28800, lo: 80 * MINUTE, hi: 120 * MINUTE, faults: { catchProb: 0.5, reactionSeconds: 4 } };
// WP25 passive-first player: 4 clicks/s until the Generator is owned, then 0.5. clicksPerSecond is unused (the type needs it).
const PROFILE_P1D: Profile = {
  id: 'P1d',
  name: 'P1d (4 clicks/s until Generator, then 0.5; buys every 10 s)',
  clicksPerSecond: 4,
  buyIntervalSeconds: 10,
  seconds: 18000,
  lo: 62 * MINUTE,
  hi: 85 * MINUTE,
  clickRate: (state) => (state.techLevels.generator >= 1 ? 0.5 : 4),
};
const PROFILES: readonly Profile[] = [PROFILE_A, PROFILE_B, PROFILE_N, PROFILE_C, PROFILE_P1D];

function greedyOptions(p: Profile, gated: boolean): GreedyOptions {
  return {
    seconds: p.seconds,
    clicksPerSecond: p.clicksPerSecond,
    stepSeconds: STEP_SECONDS,
    buyIntervalSeconds: p.buyIntervalSeconds,
    stopAt: CAP_TECH,
    ...(gated ? { maxEra: MAX_ERA } : {}),
    ...(p.clickRate !== undefined ? { clickRate: p.clickRate } : {}),
    ...(p.faults !== undefined ? { faults: p.faults } : {}),
  };
}

/** Active seconds to first own the cap tech; a missing run counts as never (Infinity). */
function firstAtCap(runs: ReadonlyMap<ProfileId, GreedyResult>, id: ProfileId): number {
  return runs.get(id)?.firstAt[CAP_TECH] ?? Infinity;
}

function formatMmSs(seconds: number): string {
  if (!Number.isFinite(seconds)) return 'never';
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(Math.floor(seconds % 60)).padStart(2, '0');
  return `${mm}:${ss}`;
}

const gated = new Map<ProfileId, GreedyResult>();
const ungated = new Map<ProfileId, GreedyResult>();
let longRun: GreedyResult;
let offlineCredited: GameState;

beforeAll(() => {
  for (const p of PROFILES) gated.set(p.id, runGreedy(greedyOptions(p, true)));
  // Same options without the era gate: the cap timing must not depend on it.
  for (const p of [PROFILE_A, PROFILE_C]) ungated.set(p.id, runGreedy(greedyOptions(p, false)));

  longRun = runGreedy({
    seconds: LONG_SECONDS,
    clicksPerSecond: PROFILE_A.clicksPerSecond,
    stepSeconds: STEP_SECONDS,
    buyIntervalSeconds: PROFILE_A.buyIntervalSeconds,
    faults: PROFILE_A.faults,
    maxEra: MAX_ERA,
  });
  const credited = applyOffline(longRun.final, longRun.final.lastSimTime + OFFLINE_MS, TECHNOLOGIES);
  offlineCredited = evaluateMilestones(credited.state, TECHNOLOGIES, MAX_ERA).state;
}, SETUP_TIMEOUT_MS);

afterAll(() => {
  const rows = PROFILES.map((p) => {
    const t = firstAtCap(gated, p.id);
    const pass = t >= p.lo && t <= p.hi ? 'PASS' : 'FAIL';
    return `| ${p.name} | ${formatMmSs(t)} | ${formatMmSs(p.lo)}-${formatMmSs(p.hi)} | ${pass} |`;
  });
  console.info(
    [
      `### Demo cap reach time (${CAP_TECH}, active play)`,
      '',
      '| profile | mm:ss | window | PASS/FAIL |',
      '| --- | --- | --- | --- |',
      ...rows,
      '',
    ].join('\n'),
  );
});

describe('demo cap timing (WP21)', () => {
  for (const p of PROFILES) {
    it(`${p.name}: reaches ${CAP_TECH} inside its window`, () => {
      const t = firstAtCap(gated, p.id);
      expect(Number.isFinite(t)).toBe(true);
      expect(t).toBeGreaterThanOrEqual(p.lo);
      expect(t).toBeLessThanOrEqual(p.hi);
    });
  }

  for (const p of [PROFILE_A, PROFILE_C]) {
    it(`${p.id}: gated and ungated reach ${CAP_TECH} at the same second`, () => {
      expect(Number.isFinite(firstAtCap(ungated, p.id))).toBe(true);
      expect(firstAtCap(ungated, p.id)).toBe(firstAtCap(gated, p.id));
    });
  }

  it('P1d is at most 1.40 x A', () => {
    expect(firstAtCap(gated, 'P1d')).toBeLessThanOrEqual(1.4 * firstAtCap(gated, 'A'));
  });

  it('order: A < B < N < C and A < P1d', () => {
    const t = (id: ProfileId): number => firstAtCap(gated, id);
    expect(t('A')).toBeLessThan(t('B'));
    expect(t('B')).toBeLessThan(t('N'));
    expect(t('N')).toBeLessThan(t('C'));
    expect(t('A')).toBeLessThan(t('P1d'));
  });

  describe('after the cap: era gate holds in the 4 h run and after 8 h offline', () => {
    const checked = (): Array<[string, GameState]> => [
      ['4 h run', longRun.final],
      ['+8 h offline', offlineCredited],
    ];

    it('owns no tech above the era cap', () => {
      expect(ABOVE_CAP_TECHS.length).toBeGreaterThan(0);
      for (const [label, state] of checked()) {
        for (const id of ABOVE_CAP_TECHS) expect(state.techLevels[id], `${label}: ${id}`).toBeLessThanOrEqual(0);
      }
    });

    it('pr, rs, xf stock and lifetime are exactly 0', () => {
      expect(ABOVE_CAP_RESOURCES).toEqual(['pr', 'rs', 'xf']);
      for (const [label, state] of checked()) {
        for (const id of ABOVE_CAP_RESOURCES) {
          expect(state.res[id], `${label}: res ${id}`).toBe(0);
          expect(state.lifetime[id], `${label}: lifetime ${id}`).toBe(0);
        }
      }
    });

    it('every res and lifetime value is finite and below DESIGN_MAX_VALUE', () => {
      for (const [label, state] of checked()) {
        for (const id of RESOURCE_IDS) {
          for (const v of [state.res[id], state.lifetime[id]]) {
            expect(Number.isFinite(v), `${label}: ${id}`).toBe(true);
            expect(v, `${label}: ${id}`).toBeLessThan(DESIGN_MAX_VALUE);
          }
        }
      }
    });

    it('result.maxValue is finite and below DESIGN_MAX_VALUE', () => {
      expect(Number.isFinite(longRun.maxValue)).toBe(true);
      expect(longRun.maxValue).toBeLessThan(DESIGN_MAX_VALUE);
    });
  });
});

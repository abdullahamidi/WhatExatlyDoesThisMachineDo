import { beforeAll, describe, it, expect } from 'vitest';
import { TECH_IDS } from '../data/types';
import type { TechId } from '../data/types';
import { DESIGN_MAX_VALUE } from '../data/balance';
import { TECHNOLOGIES } from '../data/technologies';
import { createInitialState } from './state';
import { runGreedy, maxPurchaseGap } from './sim/greedy';
import type { GreedyResult } from './sim/greedy';

// Deterministic greedy-player simulation. Proves the pacing targets of the retuned tech table
// (docs/plan/WP5.md), that era I is unchanged by the multi-resource economy (WP7), that the
// era II (Electrical) pacing targets hold (WP8) and that the era III (Thermal) targets hold (WP9).
// No clock, no randomness, no rendering.
// Re-run: npx vitest run src/simulation/balance.sim.test.ts

const MAIN_SECONDS = 10800;
const CLICKS_PER_SECOND = 4;

function eraOneOptions(buyIntervalSeconds: number) {
  return { seconds: MAIN_SECONDS, clicksPerSecond: CLICKS_PER_SECOND, stepSeconds: 1, buyIntervalSeconds };
}

// Profiles. A = main greedy run; B = slow buyer; C = casual clicker (no offline progress).
const PROFILE_A = eraOneOptions(1);
const PROFILE_B = { seconds: 12600, clicksPerSecond: CLICKS_PER_SECOND, stepSeconds: 1, buyIntervalSeconds: 30 };
const PROFILE_C = { seconds: 21600, clicksPerSecond: 1, stepSeconds: 1, buyIntervalSeconds: 30 };

const ERA_TWO_IDS = TECH_IDS.filter((id) => TECHNOLOGIES[id].era === 2);
const ERA_THREE_IDS = TECH_IDS.filter((id) => TECHNOLOGIES[id].era === 3);

function formatMmSs(seconds: number): string {
  if (!Number.isFinite(seconds)) return 'never';
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

// Each profile is computed once per file. `aAgain` is the single extra determinism run.
let a: GreedyResult;
let aAgain: GreedyResult;
let aMs = 0;
let b: GreedyResult;
let c: GreedyResult;

beforeAll(() => {
  const start = Date.now();
  a = runGreedy(PROFILE_A);
  aMs = Date.now() - start;
  b = runGreedy(PROFILE_B);
  c = runGreedy(PROFILE_C);
  aAgain = runGreedy(PROFILE_A);
  console.table(
    TECH_IDS.map((id) => ({
      tech: id,
      'A mm:ss': formatMmSs(a.firstAt[id]),
      'B mm:ss': formatMmSs(b.firstAt[id]),
      'C mm:ss': formatMmSs(c.firstAt[id]),
    })),
  );
});

describe('greedy balance simulation (WP5 pacing targets)', () => {
  it('wornMotor is reached in under 60 s', () => {
    expect(a.firstAt.wornMotor).toBeLessThan(60);
  });

  it('reinforcedCrank is reached at 180-300 s', () => {
    expect(a.firstAt.reinforcedCrank).toBeGreaterThanOrEqual(180);
    expect(a.firstAt.reinforcedCrank).toBeLessThanOrEqual(300);
  });

  it('pistonArray is reached at 600-900 s', () => {
    expect(a.firstAt.pistonArray).toBeGreaterThanOrEqual(600);
    expect(a.firstAt.pistonArray).toBeLessThanOrEqual(900);
  });

  it('generatorBlueprint is reached at 1200-1800 s', () => {
    expect(a.firstAt.generatorBlueprint).toBeGreaterThanOrEqual(1200);
    expect(a.firstAt.generatorBlueprint).toBeLessThanOrEqual(1800);
  });

  it('era I exact first-purchase times (EXACT: era I must not drift)', () => {
    expect(a.firstAt.handCrank).toBe(0);
    expect(a.firstAt.gearRatio).toBe(4);
    expect(a.firstAt.wornMotor).toBe(13);
    expect(a.firstAt.motorTuning).toBe(20);
    expect(a.firstAt.reinforcedCrank).toBe(196);
    expect(a.firstAt.flywheel).toBe(289);
    expect(a.firstAt.pistonArray).toBe(722);
    expect(a.firstAt.improvedPistons).toBe(758);
    expect(a.firstAt.generatorBlueprint).toBe(1326);
  });

  it('maxValue is finite and below the design ceiling', () => {
    expect(Number.isFinite(a.maxValue)).toBe(true);
    expect(a.maxValue).toBeLessThan(DESIGN_MAX_VALUE);
  });

  it('is deterministic: two runs give identical firstAt', () => {
    expect(aAgain.firstAt).toEqual(a.firstAt);
  });

  it('a 30 s buy interval never reaches a tech earlier than the 1 s interval', () => {
    for (const id of TECH_IDS) {
      expect(b.firstAt[id]).toBeGreaterThanOrEqual(a.firstAt[id]);
    }
  });

  it('honours an initial state (wornMotor already owned -> first at 0 s)', () => {
    const base = createInitialState(0);
    const initial = { ...base, techLevels: { ...base.techLevels, wornMotor: 1 } };
    const owned = runGreedy({ ...eraOneOptions(1), seconds: 10, initial });
    expect(owned.firstAt.wornMotor).toBe(0);
  });

  it('a 10 s run performs exactly 40 clicks at 4 clicks/s', () => {
    const short = runGreedy({ ...eraOneOptions(1), seconds: 10 });
    expect(short.final.totalClicks).toBe(40);
  });

  it('the full era I simulation runs in under 10 s', () => {
    expect(aMs).toBeLessThan(10000);
  });
});

describe('era II pacing targets (WP8 Electrical)', () => {
  it('A: generator reached at 1500-2100 s', () => {
    expect(a.firstAt.generator).toBeGreaterThanOrEqual(1500);
    expect(a.firstAt.generator).toBeLessThanOrEqual(2100);
  });

  it('A: substationBlueprint reached at 3300-4500 s', () => {
    expect(a.firstAt.substationBlueprint).toBeGreaterThanOrEqual(3300);
    expect(a.firstAt.substationBlueprint).toBeLessThanOrEqual(4500);
  });

  it('B: substationBlueprint reached by 5400 s', () => {
    expect(b.firstAt.substationBlueprint).toBeLessThanOrEqual(5400);
  });

  it('C: substationBlueprint reached by 10800 s', () => {
    expect(c.firstAt.substationBlueprint).toBeLessThanOrEqual(10800);
  });

  it('no purchase gap longer than 1200 s between generatorBlueprint and substationBlueprint (A, B, C)', () => {
    for (const run of [a, b, c]) {
      const gap = maxPurchaseGap(
        run.purchases,
        run.firstAt.generatorBlueprint,
        run.firstAt.substationBlueprint,
      );
      expect(gap).toBeLessThanOrEqual(1200);
    }
  });

  it('A: every era-II tech is reached', () => {
    for (const id of ERA_TWO_IDS) {
      expect(Number.isFinite(a.firstAt[id])).toBe(true);
    }
  });

  it('maxValue is finite and below the design ceiling for A, B and C', () => {
    for (const run of [a, b, c]) {
      expect(Number.isFinite(run.maxValue)).toBe(true);
      expect(run.maxValue).toBeLessThan(DESIGN_MAX_VALUE);
    }
  });

  it('A is deterministic: firstAt and purchases repeat exactly', () => {
    expect(aAgain.firstAt).toEqual(a.firstAt);
    expect(aAgain.purchases).toEqual(a.purchases);
  });
});

describe('era III pacing targets (WP9 Thermal)', () => {
  it('A: boiler reached at 3900-4500 s', () => {
    expect(a.firstAt.boiler).toBeGreaterThanOrEqual(3900);
    expect(a.firstAt.boiler).toBeLessThanOrEqual(4500);
  });

  it('A: pressureVesselBlueprint reached at 6300-8100 s', () => {
    expect(a.firstAt.pressureVesselBlueprint).toBeGreaterThanOrEqual(6300);
    expect(a.firstAt.pressureVesselBlueprint).toBeLessThanOrEqual(8100);
  });

  it('A: every era-III tech is reached', () => {
    for (const id of ERA_THREE_IDS) {
      expect(Number.isFinite(a.firstAt[id])).toBe(true);
    }
  });

  it('B: pressureVesselBlueprint reached by 9000 s', () => {
    expect(b.firstAt.pressureVesselBlueprint).toBeLessThanOrEqual(9000);
  });

  it('C: pressureVesselBlueprint reached by 18000 s', () => {
    expect(c.firstAt.pressureVesselBlueprint).toBeLessThanOrEqual(18000);
  });

  it('no purchase gap longer than 1200 s between substationBlueprint and pressureVesselBlueprint (A, B, C)', () => {
    for (const run of [a, b, c]) {
      const gap = maxPurchaseGap(
        run.purchases,
        run.firstAt.substationBlueprint,
        run.firstAt.pressureVesselBlueprint,
      );
      expect(gap).toBeLessThanOrEqual(1200);
    }
  });
});

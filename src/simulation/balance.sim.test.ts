import { beforeAll, describe, it, expect } from 'vitest';
import { TECH_IDS } from '../data/types';
import type { TechId } from '../data/types';
import { DESIGN_MAX_VALUE } from '../data/balance';
import { TECHNOLOGIES } from '../data/technologies';
import { createInitialState } from './state';
import { runGreedy, maxPurchaseGap } from './sim/greedy';
import type { GreedyResult } from './sim/greedy';

// Deterministic greedy-player simulation. Proves the pacing targets of the retuned tech table
// (docs/plan/WP5.md), that era I is unchanged by the multi-resource economy (WP7) and that the
// era II (Electrical) pacing targets hold (WP8). No clock, no randomness, no rendering.
// Re-run: npx vitest run src/simulation/balance.sim.test.ts

const MAIN_SECONDS = 7200;
const CLICKS_PER_SECOND = 4;

function eraOneOptions(buyIntervalSeconds: number) {
  return { seconds: MAIN_SECONDS, clicksPerSecond: CLICKS_PER_SECOND, stepSeconds: 1, buyIntervalSeconds };
}

// Era II profiles. A = main greedy run; B = slow buyer; C = casual clicker (no offline progress).
const PROFILE_A = eraOneOptions(1);
const PROFILE_B = eraOneOptions(30);
const PROFILE_C = { seconds: 14400, clicksPerSecond: 1, stepSeconds: 1, buyIntervalSeconds: 30 };

const ERA_TWO_IDS = TECH_IDS.filter((id) => TECHNOLOGIES[id].era === 2);

function formatMmSs(seconds: number): string {
  if (!Number.isFinite(seconds)) return 'never';
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

describe('greedy balance simulation (WP5 pacing targets)', () => {
  let result: GreedyResult;
  let firstAt: Record<TechId, number>;
  let slow: GreedyResult;
  let casual: GreedyResult;

  beforeAll(() => {
    result = runGreedy(PROFILE_A);
    firstAt = result.firstAt;
    slow = runGreedy(PROFILE_B);
    casual = runGreedy(PROFILE_C);
    console.table(
      TECH_IDS.map((id) => ({
        tech: id,
        'A mm:ss': formatMmSs(firstAt[id]),
        'B mm:ss': formatMmSs(slow.firstAt[id]),
        'C mm:ss': formatMmSs(casual.firstAt[id]),
      })),
    );
  });

  it('wornMotor is reached in under 60 s', () => {
    expect(firstAt.wornMotor).toBeLessThan(60);
  });

  it('reinforcedCrank is reached at 180-300 s', () => {
    expect(firstAt.reinforcedCrank).toBeGreaterThanOrEqual(180);
    expect(firstAt.reinforcedCrank).toBeLessThanOrEqual(300);
  });

  it('pistonArray is reached at 600-900 s', () => {
    expect(firstAt.pistonArray).toBeGreaterThanOrEqual(600);
    expect(firstAt.pistonArray).toBeLessThanOrEqual(900);
  });

  it('generatorBlueprint is reached at 1200-1800 s', () => {
    expect(firstAt.generatorBlueprint).toBeGreaterThanOrEqual(1200);
    expect(firstAt.generatorBlueprint).toBeLessThanOrEqual(1800);
  });

  it('era I exact first-purchase times (EXACT: era I must not drift)', () => {
    expect(firstAt.handCrank).toBe(0);
    expect(firstAt.gearRatio).toBe(4);
    expect(firstAt.wornMotor).toBe(13);
    expect(firstAt.motorTuning).toBe(20);
    expect(firstAt.reinforcedCrank).toBe(196);
    expect(firstAt.flywheel).toBe(289);
    expect(firstAt.pistonArray).toBe(722);
    expect(firstAt.improvedPistons).toBe(758);
    expect(firstAt.generatorBlueprint).toBe(1326);
  });

  it('maxValue is finite and below the design ceiling', () => {
    expect(Number.isFinite(result.maxValue)).toBe(true);
    expect(result.maxValue).toBeLessThan(DESIGN_MAX_VALUE);
  });

  it('is deterministic: two runs give identical firstAt', () => {
    const again = runGreedy(PROFILE_A);
    expect(again.firstAt).toEqual(firstAt);
  });

  it('a 30 s buy interval never reaches a tech earlier than the 1 s interval', () => {
    for (const id of TECH_IDS) {
      expect(slow.firstAt[id]).toBeGreaterThanOrEqual(firstAt[id]);
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
    const start = Date.now();
    runGreedy(PROFILE_A);
    expect(Date.now() - start).toBeLessThan(10000);
  });
});

describe('era II pacing targets (WP8 Electrical)', () => {
  let a: GreedyResult;
  let b: GreedyResult;
  let c: GreedyResult;

  beforeAll(() => {
    a = runGreedy(PROFILE_A);
    b = runGreedy(PROFILE_B);
    c = runGreedy(PROFILE_C);
  });

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
    const again = runGreedy(PROFILE_A);
    expect(again.firstAt).toEqual(a.firstAt);
    expect(again.purchases).toEqual(a.purchases);
  });
});

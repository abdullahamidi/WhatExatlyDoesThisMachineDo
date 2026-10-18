import { beforeAll, describe, it, expect } from 'vitest';
import { TECH_IDS } from '../data/types';
import type { TechId } from '../data/types';
import { DESIGN_MAX_VALUE } from '../data/balance';
import { createInitialState } from './state';
import { runGreedy } from './sim/greedy';
import type { GreedyResult } from './sim/greedy';

// Deterministic greedy-player simulation. Proves the pacing targets of the retuned tech table
// (docs/plan/WP5.md) and that era I is unchanged by the multi-resource economy (WP7).
// No clock, no randomness, no rendering. Re-run: npx vitest run src/simulation/balance.sim.test.ts

const SIM_SECONDS = 3600;
const CLICKS_PER_SECOND = 4;

function eraOneOptions(buyIntervalSeconds: number) {
  return { seconds: SIM_SECONDS, clicksPerSecond: CLICKS_PER_SECOND, stepSeconds: 1, buyIntervalSeconds };
}

function formatMmSs(seconds: number): string {
  if (!Number.isFinite(seconds)) return 'never';
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

describe('greedy balance simulation (WP5 pacing targets)', () => {
  let result: GreedyResult;
  let firstAt: Record<TechId, number>;

  beforeAll(() => {
    result = runGreedy(eraOneOptions(1));
    firstAt = result.firstAt;
    console.table(TECH_IDS.map((id) => ({ tech: id, 'mm:ss': formatMmSs(firstAt[id]) })));
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
    const again = runGreedy(eraOneOptions(1));
    expect(again.firstAt).toEqual(firstAt);
  });

  it('a 30 s buy interval never reaches a tech earlier than the 1 s interval', () => {
    const slow = runGreedy(eraOneOptions(30));
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
    runGreedy(eraOneOptions(1));
    expect(Date.now() - start).toBeLessThan(10000);
  });
});

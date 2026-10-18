import { beforeAll, describe, it, expect } from 'vitest';
import { DESIGN_MAX_VALUE } from '../data/balance';
import { PERK_IDS } from '../data/prestige';
import type { PerkId } from '../data/prestige';
import { TECHNOLOGIES } from '../data/technologies';
import type { PrestigeState } from '../data/types';
import { cycleTechs, echoesForCycle, newCycleState } from './prestige';
import { runGreedy, maxPurchaseGap } from './sim/greedy';
import type { GreedyResult } from './sim/greedy';

// Cycle-2 and cycle-3 pacing (WP14 T5). Deterministic greedy players replay each new cycle up to
// primaryFunction with the Memory perks applied through the pure derived tech table (cycleTechs).
// Every ratio is measured against the cycle-1 primaryFunction of the same profile. No clock, no
// randomness, no rendering. Runs stop at primaryFunction (stopAt) to keep this file fast.
// Re-run: npx vitest run src/simulation/prestige.sim.test.ts

const MAX_SECONDS = 30000;
const CASUAL_MAX_SECONDS = 40000;

// Profile A = main player (4 clicks/s, buys every second). Profile C = casual (1 click/s, buys every 30 s).
const PROFILE_A = { clicksPerSecond: 4, stepSeconds: 1, buyIntervalSeconds: 1 };
const PROFILE_C = { clicksPerSecond: 1, stepSeconds: 1, buyIntervalSeconds: 30 };

interface Spend {
  name: string;
  perks: readonly PerkId[];
}

// Cycle-2 spends with 3 Echoes (each spend fits the budget: muscle 1, residual 2, servo 3, ledger 3).
const CYCLE_TWO_SPENDS: readonly Spend[] = [
  { name: 'none', perks: [] },
  { name: 'muscleMemory', perks: ['muscleMemory'] },
  { name: 'residualCharge', perks: ['residualCharge'] },
  { name: 'servoRecall', perks: ['servoRecall'] },
  { name: 'ledger', perks: ['ledger'] },
  { name: 'muscle+residual', perks: ['muscleMemory', 'residualCharge'] },
];

// Cycle-3 spend with 6 Echoes (muscle 1 + residual 2 + servo 3).
const CYCLE_THREE_PERKS: readonly PerkId[] = ['muscleMemory', 'residualCharge', 'servoRecall'];

interface Probe {
  name: string;
  pf: number;
  ratio: number;
  run: GreedyResult;
}

/** Keeps PERK_IDS order, the same order `buyPerk` produces. */
function prestige(cycle: number, echoesEarned: number, perks: readonly PerkId[]): PrestigeState {
  return { cycle, echoesEarned, perks: PERK_IDS.filter((id) => perks.includes(id)) };
}

function cycleRun(
  p: PrestigeState,
  profile: { clicksPerSecond: number; stepSeconds: number; buyIntervalSeconds: number },
  seconds: number,
): GreedyResult {
  return runGreedy({
    seconds,
    ...profile,
    initial: newCycleState(0, p),
    techs: cycleTechs(TECHNOLOGIES, p),
    stopAt: 'primaryFunction',
  });
}

function probe(name: string, run: GreedyResult, base: number): Probe {
  const pf = run.firstAt.primaryFunction;
  return { name, pf, ratio: pf / base, run };
}

let cycleOne: GreedyResult;
let cycleTwo: Probe[] = [];
let cycleThree: Probe;
let maxMeta: Probe;
let casualCycleOne: GreedyResult;
let casualCycleTwo: Probe;
let casualBase: number;

beforeAll(() => {
  cycleOne = cycleRun(prestige(1, 0, []), PROFILE_A, MAX_SECONDS);
  const base = cycleOne.firstAt.primaryFunction;
  cycleTwo = CYCLE_TWO_SPENDS.map((spend) =>
    probe(spend.name, cycleRun(prestige(2, 3, spend.perks), PROFILE_A, MAX_SECONDS), base),
  );
  cycleThree = probe('cycle 3, 6 Echoes, muscle+residual+servo', cycleRun(prestige(3, 6, CYCLE_THREE_PERKS), PROFILE_A, MAX_SECONDS), base);
  maxMeta = probe('cycle 6, 40 Echoes, all perks', cycleRun(prestige(6, 40, PERK_IDS), PROFILE_A, MAX_SECONDS), base);

  casualCycleOne = cycleRun(prestige(1, 0, []), PROFILE_C, CASUAL_MAX_SECONDS);
  casualBase = casualCycleOne.firstAt.primaryFunction;
  casualCycleTwo = probe('casual cycle 2, 3 Echoes none', cycleRun(prestige(2, 3, []), PROFILE_C, CASUAL_MAX_SECONDS), casualBase);

  console.table(
    [
      { run: 'cycle 1 (A)', pf: cycleOne.firstAt.primaryFunction, 'pf / c1': 1 },
      ...cycleTwo.map((p) => ({ run: `cycle 2, 3 Echoes ${p.name} (A)`, pf: p.pf, 'pf / c1': p.ratio })),
      { run: `${cycleThree.name} (A)`, pf: cycleThree.pf, 'pf / c1': cycleThree.ratio },
      { run: `${maxMeta.name} (A)`, pf: maxMeta.pf, 'pf / c1': maxMeta.ratio },
      { run: 'casual cycle 1 (C)', pf: casualBase, 'pf / c1': 1 },
      { run: `${casualCycleTwo.name} (C)`, pf: casualCycleTwo.pf, 'pf / c1': casualCycleTwo.ratio },
    ],
  );
}, 60000);

describe('prestige balance (WP14 T5, cycle 2 and 3)', () => {
  it('cycle 1 finished run grants 3 Echoes', () => {
    expect(echoesForCycle(cycleOne.final.lifetime.xf)).toBe(3);
  });

  it('cycle 2 with 3 Echoes is 50-65 % of cycle 1 for every spend', () => {
    for (const p of cycleTwo) {
      expect(Number.isFinite(p.pf), p.name).toBe(true);
      expect(p.ratio, p.name).toBeGreaterThanOrEqual(0.5);
      expect(p.ratio, p.name).toBeLessThanOrEqual(0.65);
    }
  });

  it('cycle 3 with 6 Echoes (muscle + residual + servo) is 35-55 % of cycle 1 and below cycle 2 with no spend', () => {
    expect(cycleThree.ratio).toBeGreaterThanOrEqual(0.35);
    expect(cycleThree.ratio).toBeLessThanOrEqual(0.55);
    const noSpend = cycleTwo.find((p) => p.name === 'none');
    expect(noSpend).toBeDefined();
    expect(cycleThree.ratio).toBeLessThan(noSpend?.ratio ?? 0);
  });

  it('max meta (30 counted Echoes, all perks) keeps at least 12 % of cycle 1 time', () => {
    expect(maxMeta.ratio).toBeGreaterThanOrEqual(0.12);
  });

  it('every run has a finite max value below the design ceiling', () => {
    const runs = [cycleOne, cycleThree.run, maxMeta.run, casualCycleOne, casualCycleTwo.run, ...cycleTwo.map((p) => p.run)];
    for (const run of runs) {
      expect(Number.isFinite(run.maxValue)).toBe(true);
      expect(run.maxValue).toBeLessThan(DESIGN_MAX_VALUE);
    }
  });

  it('casual cycle 2 (3 Echoes) is at most 65 % of casual cycle 1', () => {
    expect(casualCycleTwo.ratio).toBeLessThanOrEqual(0.65);
  });

  it('no purchase gap over 1200 s between generatorBlueprint and primaryFunction in cycle-2 runs', () => {
    for (const p of cycleTwo) {
      const gap = maxPurchaseGap(p.run.purchases, p.run.firstAt.generatorBlueprint, p.run.firstAt.primaryFunction);
      expect(gap, p.name).toBeLessThanOrEqual(1200);
    }
  });
});

import { beforeAll, describe, it, expect } from 'vitest';
import { TECH_IDS } from '../data/types';
import type { GameState, TechId, TechView } from '../data/types';
import {
  advance,
  applyClick,
  createInitialState,
  evaluateMilestones,
  getAllTechViews,
  purchase,
} from './index';

// Deterministic greedy-player simulation. Proves the pacing targets of the retuned tech table
// (docs/plan/WP5.md). No clock, no randomness, no rendering. Re-run: npx vitest run src/simulation/balance.sim.test.ts

const SIM_SECONDS = 3600;
const CLICKS_PER_SECOND = 4;

/** Pick the cheapest purchasable-next tech (ties: TECH_IDS order); null when none. */
function pickCheapest(state: GameState): TechView | null {
  let pick: TechView | null = null;
  for (const view of getAllTechViews(state)) {
    if (view.status !== 'available' || view.nextCost === null || view.def.kind === 'milestone') continue;
    if (pick === null || pick.nextCost === null || view.nextCost < pick.nextCost) pick = view;
  }
  return pick;
}

/** Simulates the greedy policy and returns the first simulated second each tech reached level 1. */
function runGreedy(): Record<TechId, number> {
  let state: GameState = createInitialState(0);
  const firstAt = {} as Record<TechId, number>;
  for (const id of TECH_IDS) firstAt[id] = Infinity;

  const record = (t: number): void => {
    for (const id of TECH_IDS) {
      if (firstAt[id] === Infinity && state.techLevels[id] >= 1) firstAt[id] = t;
    }
  };
  record(0);

  for (let t = 1; t <= SIM_SECONDS; t++) {
    for (let i = 0; i < CLICKS_PER_SECOND; i++) state = applyClick(state).state;
    state = advance(state, 1);
    state = evaluateMilestones(state).state;

    const pick = pickCheapest(state);
    if (pick !== null && pick.affordable) {
      const result = purchase(state, pick.id);
      if (result.ok) state = result.state;
    }
    record(t);
  }
  return firstAt;
}

function formatMmSs(seconds: number): string {
  if (!Number.isFinite(seconds)) return 'never';
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

describe('greedy balance simulation (WP5 pacing targets)', () => {
  let firstAt: Record<TechId, number>;

  beforeAll(() => {
    firstAt = runGreedy();
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
});

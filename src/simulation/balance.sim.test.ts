import { beforeAll, describe, it, expect } from 'vitest';
import { TECH_IDS } from '../data/types';
import type { GameState, ResourceId, TechId } from '../data/types';
import { DESIGN_MAX_VALUE } from '../data/balance';
import { TECHNOLOGIES } from '../data/technologies';
import { createInitialState } from './state';
import { runGreedy, maxPurchaseGap, purchaseLedger, deadMinutes, spendShare } from './sim/greedy';
import type { GreedyResult, LedgerEntry } from './sim/greedy';

// Deterministic greedy-player simulation. Proves the pacing targets of the retuned tech table
// (docs/plan/WP5.md), that era I is unchanged by the multi-resource economy (WP7), that the
// era II (Electrical) pacing targets hold (WP8), that the era III (Thermal) targets hold (WP9),
// that the era IV (Resonance) targets hold (WP10) and that the era V (Unknown Flux) targets hold
// (WP11). No clock, no randomness, no rendering.
// Re-run: npx vitest run src/simulation/balance.sim.test.ts

const MAIN_SECONDS = 17400;
const CLICKS_PER_SECOND = 4;

function eraOneOptions(buyIntervalSeconds: number) {
  return { seconds: MAIN_SECONDS, clicksPerSecond: CLICKS_PER_SECOND, stepSeconds: 1, buyIntervalSeconds };
}

// Profiles. A = main greedy run; B = slow buyer; C = casual clicker (no offline progress).
const PROFILE_A = eraOneOptions(1);
const PROFILE_B = { seconds: 18000, clicksPerSecond: CLICKS_PER_SECOND, stepSeconds: 1, buyIntervalSeconds: 30 };
const PROFILE_C = { seconds: 28800, clicksPerSecond: 1, stepSeconds: 1, buyIntervalSeconds: 30 };

// States recorded at the first ownership of the era IV convergence and the era V finale (WP17 D1).
const SNAPSHOT_IDS: readonly TechId[] = ['harmonicConvergence', 'primaryFunction'];

// The four older energies that the Legacy Feeds must keep useful until the end (WP17).
type ContinuityRes = Extract<ResourceId, 'me' | 'ee' | 'pr' | 'rs'>;
const CONTINUITY_RES: readonly ContinuityRes[] = ['me', 'ee', 'pr', 'rs'];

const ERA_TWO_IDS = TECH_IDS.filter((id) => TECHNOLOGIES[id].era === 2);
const ERA_THREE_IDS = TECH_IDS.filter((id) => TECHNOLOGIES[id].era === 3);
const ERA_FOUR_IDS = TECH_IDS.filter((id) => TECHNOLOGIES[id].era === 4);
const ERA_FIVE_IDS = TECH_IDS.filter((id) => TECHNOLOGIES[id].era === 5);

// Prefix of run A used by the determinism checks (a 3600 s run must match A's first hour exactly).
const PREFIX_SECONDS = 3600;

function formatMmSs(seconds: number): string {
  if (!Number.isFinite(seconds)) return 'never';
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/** Time of the first buy of `id` in the ledger; Infinity when it is never bought. */
function firstBuyAt(ledger: readonly LedgerEntry[], id: TechId): number {
  return ledger.find((entry) => entry.id === id)?.t ?? Infinity;
}

interface Continuity {
  share: Record<ContinuityRes, number>;
  dead: Record<ContinuityRes, number>;
}

/** Spend share over (harmonicConvergence, primaryFunction] and dead minutes up to primaryFunction; null without both snapshots. */
function continuityOrNull(run: GreedyResult): Continuity | null {
  const from = run.snapshots?.harmonicConvergence;
  const to = run.snapshots?.primaryFunction;
  if (from === undefined || to === undefined) return null;
  const ledger = purchaseLedger(run.purchases);
  const share = {} as Record<ContinuityRes, number>;
  const dead = {} as Record<ContinuityRes, number>;
  for (const r of CONTINUITY_RES) {
    share[r] = spendShare(
      ledger,
      r,
      run.firstAt.harmonicConvergence,
      run.firstAt.primaryFunction,
      from.lifetime[r],
      to.lifetime[r],
    );
    dead[r] = deadMinutes(ledger, r, run.firstAt.primaryFunction);
  }
  return { share, dead };
}

/** Continuity metrics of a run that must have both snapshots; a missing one is a setup error. */
function continuityOf(run: GreedyResult): Continuity {
  const metrics = continuityOrNull(run);
  if (metrics === null) {
    throw new Error('energy continuity: snapshot of harmonicConvergence or primaryFunction is missing');
  }
  return metrics;
}

/** One report row per profile; continuity cells read 'n/a' when a snapshot is missing. */
function reportRow(profile: string, run: GreedyResult): Record<string, string> {
  const m = continuityOrNull(run);
  const dead = (r: ContinuityRes): string => (m === null ? 'n/a' : m.dead[r].toFixed(1));
  const share = (r: ContinuityRes): string => (m === null ? 'n/a' : (m.share[r] * 100).toFixed(1));
  return {
    profile,
    blueprint: formatMmSs(run.firstAt.generatorBlueprint),
    substation: formatMmSs(run.firstAt.substationBlueprint),
    vessel: formatMmSs(run.firstAt.pressureVesselBlueprint),
    convergence: formatMmSs(run.firstAt.harmonicConvergence),
    PF: formatMmSs(run.firstAt.primaryFunction),
    'dead me': dead('me'),
    'dead ee': dead('ee'),
    'dead pr': dead('pr'),
    'dead rs': dead('rs'),
    'share me %': share('me'),
    'share ee %': share('ee'),
    'share pr %': share('pr'),
    'share rs %': share('rs'),
  };
}

// Each profile is computed once per file. `aPrefix` is the single extra determinism run (first hour of A).
let a: GreedyResult;
let aPrefix: GreedyResult;
let aMs = 0;
let b: GreedyResult;
let c: GreedyResult;

/** A prefix run must reproduce exactly the first `PREFIX_SECONDS` of the full run. */
function expectPrefixOfFullRun(prefix: GreedyResult, full: GreedyResult): void {
  for (const id of TECH_IDS) {
    const expected = full.firstAt[id] <= PREFIX_SECONDS ? full.firstAt[id] : Infinity;
    expect(prefix.firstAt[id]).toBe(expected);
  }
  expect(prefix.purchases).toEqual(full.purchases.filter((p) => p.t <= PREFIX_SECONDS));
}

beforeAll(() => {
  const start = Date.now();
  a = runGreedy({ ...PROFILE_A, snapshotAt: SNAPSHOT_IDS });
  aMs = Date.now() - start;
  b = runGreedy({ ...PROFILE_B, snapshotAt: SNAPSHOT_IDS });
  c = runGreedy({ ...PROFILE_C, snapshotAt: SNAPSHOT_IDS });
  aPrefix = runGreedy({ ...PROFILE_A, seconds: PREFIX_SECONDS });
  console.table(
    TECH_IDS.map((id) => ({
      tech: id,
      'A mm:ss': formatMmSs(a.firstAt[id]),
      'B mm:ss': formatMmSs(b.firstAt[id]),
      'C mm:ss': formatMmSs(c.firstAt[id]),
    })),
  );
  console.table([reportRow('A', a), reportRow('B', b), reportRow('C', c)]);
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

  // re-pinned once for WP25 (wornMotor on: passive-first retune)
  it('era I exact first-purchase times (EXACT: era I must not drift)', () => {
    expect(a.firstAt.handCrank).toBe(0);
    expect(a.firstAt.gearRatio).toBe(4);
    expect(a.firstAt.wornMotor).toBe(18);
    expect(a.firstAt.motorTuning).toBe(23);
    expect(a.firstAt.reinforcedCrank).toBe(205);
    expect(a.firstAt.flywheel).toBe(297);
    expect(a.firstAt.pistonArray).toBe(730);
    expect(a.firstAt.improvedPistons).toBe(761);
    expect(a.firstAt.generatorBlueprint).toBe(1327);
  });

  it('maxValue is finite and below the design ceiling', () => {
    expect(Number.isFinite(a.maxValue)).toBe(true);
    expect(a.maxValue).toBeLessThan(DESIGN_MAX_VALUE);
  });

  it('is deterministic: the first hour of a run equals the same hour of the full run', () => {
    expectPrefixOfFullRun(aPrefix, a);
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

  it('A is deterministic: firstAt and purchases repeat exactly over the first hour', () => {
    expectPrefixOfFullRun(aPrefix, a);
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

describe('era IV pacing targets (WP10 Resonance)', () => {
  it('A: resonatorSpire reached at 7050-7800 s', () => {
    expect(a.firstAt.resonatorSpire).toBeGreaterThanOrEqual(7050);
    expect(a.firstAt.resonatorSpire).toBeLessThanOrEqual(7800);
  });

  it('A: harmonicConvergence reached at 9900-12300 s', () => {
    expect(a.firstAt.harmonicConvergence).toBeGreaterThanOrEqual(9900);
    expect(a.firstAt.harmonicConvergence).toBeLessThanOrEqual(12300);
  });

  it('A: every era-IV tech is reached', () => {
    for (const id of ERA_FOUR_IDS) {
      expect(Number.isFinite(a.firstAt[id])).toBe(true);
    }
  });

  it('B: harmonicConvergence reached by 12900 s', () => {
    expect(b.firstAt.harmonicConvergence).toBeLessThanOrEqual(12900);
  });

  it('C: harmonicConvergence reached by 22800 s', () => {
    expect(c.firstAt.harmonicConvergence).toBeLessThanOrEqual(22800);
  });

  it('C: crankServo reaches level 5 or more by the end of the run', () => {
    expect(c.final.techLevels.crankServo).toBeGreaterThanOrEqual(5);
  });

  it('no purchase gap longer than 1200 s between pressureVesselBlueprint and harmonicConvergence (A, B, C)', () => {
    for (const run of [a, b, c]) {
      const gap = maxPurchaseGap(
        run.purchases,
        run.firstAt.pressureVesselBlueprint,
        run.firstAt.harmonicConvergence,
      );
      expect(gap).toBeLessThanOrEqual(1200);
    }
  });

  it('maxValue is finite and below the design ceiling for A, B and C (era IV)', () => {
    for (const run of [a, b, c]) {
      expect(Number.isFinite(run.maxValue)).toBe(true);
      expect(run.maxValue).toBeLessThan(DESIGN_MAX_VALUE);
    }
  });
});

describe('era V pacing targets (WP11 Unknown Flux)', () => {
  it('A: nullChamber reached within 900 s of harmonicConvergence', () => {
    expect(a.firstAt.nullChamber).toBeLessThanOrEqual(a.firstAt.harmonicConvergence + 900);
  });

  it('A: primaryFunction reached at 230-290 min (13800-17400 s)', () => {
    expect(a.firstAt.primaryFunction).toBeGreaterThanOrEqual(13800);
    expect(a.firstAt.primaryFunction).toBeLessThanOrEqual(17400);
  });

  it('A: primaryFunction comes 3600-6600 s after harmonicConvergence', () => {
    const span = a.firstAt.primaryFunction - a.firstAt.harmonicConvergence;
    expect(span).toBeGreaterThanOrEqual(3600);
    expect(span).toBeLessThanOrEqual(6600);
  });

  it('A: finalAlignment is reached before primaryFunction', () => {
    expect(a.firstAt.finalAlignment).toBeLessThan(a.firstAt.primaryFunction);
  });

  it('A: every era-V tech is reached', () => {
    for (const id of ERA_FIVE_IDS) {
      expect(Number.isFinite(a.firstAt[id])).toBe(true);
    }
  });

  it('B: primaryFunction reached by 18000 s', () => {
    expect(b.firstAt.primaryFunction).toBeLessThanOrEqual(18000);
  });

  it('C: primaryFunction reached by 28800 s (8 h casual budget, no offline)', () => {
    expect(c.firstAt.primaryFunction).toBeLessThanOrEqual(28800);
  });

  it('no purchase gap longer than 1200 s between harmonicConvergence and primaryFunction (A, B, C)', () => {
    for (const run of [a, b, c]) {
      const gap = maxPurchaseGap(
        run.purchases,
        run.firstAt.harmonicConvergence,
        run.firstAt.primaryFunction,
      );
      expect(gap).toBeLessThanOrEqual(1200);
    }
  });

  it('maxValue is finite and below the design ceiling for A, B and C (era V)', () => {
    for (const run of [a, b, c]) {
      expect(Number.isFinite(run.maxValue)).toBe(true);
      expect(run.maxValue).toBeLessThan(DESIGN_MAX_VALUE);
    }
  });
});

describe('energy continuity (WP17 D1, profile A)', () => {
  for (const r of CONTINUITY_RES) {
    it(`${r}: spend share >= 75% of produced energy over (harmonicConvergence, primaryFunction]`, () => {
      expect(continuityOf(a).share[r]).toBeGreaterThanOrEqual(0.75);
    });

    it(`${r}: no dead time longer than 5 min up to primaryFunction`, () => {
      expect(continuityOf(a).dead[r]).toBeLessThanOrEqual(5);
    });
  }

  it('bellowsDrive is first bought in [boiler, pressureVesselBlueprint)', () => {
    const t = firstBuyAt(purchaseLedger(a.purchases), 'bellowsDrive');
    expect(t).toBeGreaterThanOrEqual(a.firstAt.boiler);
    expect(t).toBeLessThan(a.firstAt.pressureVesselBlueprint);
  });

  it('gridExciter is first bought in [resonatorSpire, harmonicConvergence)', () => {
    const t = firstBuyAt(purchaseLedger(a.purchases), 'gridExciter');
    expect(t).toBeGreaterThanOrEqual(a.firstAt.resonatorSpire);
    expect(t).toBeLessThan(a.firstAt.harmonicConvergence);
  });

  it('mainsBackfeed and steamLance are first bought in [nullChamber, skyAperture)', () => {
    const ledger = purchaseLedger(a.purchases);
    for (const id of ['mainsBackfeed', 'steamLance'] as const) {
      const t = firstBuyAt(ledger, id);
      expect(t).toBeGreaterThanOrEqual(a.firstAt.nullChamber);
      expect(t).toBeLessThan(a.firstAt.skyAperture);
    }
  });

  it('ee and pr are still bought after primaryFunction (run A continues to 17400 s)', () => {
    const ledger = purchaseLedger(a.purchases);
    for (const res of ['ee', 'pr'] as const) {
      expect(ledger.some((entry) => entry.res === res && entry.t > a.firstAt.primaryFunction)).toBe(true);
    }
  });
});

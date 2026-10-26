import { beforeAll, describe, expect, it } from 'vitest';
import { DESIGN_MAX_VALUE } from '../data/balance';
import { EDITIONS } from '../data/edition';
import type { EraNumber } from '../data/eras';
import { TECHNOLOGIES } from '../data/technologies';
import type { GameState, ResourceId, TechId } from '../data/types';
import { computeRates } from './production/rates';
import { currentEra, eraResource } from './progression/era';
import { deadMinutes, manualShare, maxPurchaseGap, purchaseLedger, runGreedy, spendShare } from './sim/greedy';
import type { GreedyOptions, GreedyResult, IncomeSplit } from './sim/greedy';

// WP25 passive-first economy. Deterministic greedy players whose clicks fade out (P1, P0, P2, Q, P1e) or stay
// at a higher rate (R15), asserted against the WP25 "Balance targets": era gates against profile A, manual click
// share per era, the machine's own output per click, servo pacing, purchase gaps, energy continuity and values.
// Profiles are literals (no import from other test files). One run per profile in beforeAll; the tests only
// assert, and the tables are printed (console.info). No randomness, no rendering. The file clock is the only
// clock use. Re-run: npx vitest run src/simulation/passiveFirst.sim.test.ts

const MINUTE = 60; // seconds per minute (the windows are written in minutes)
// The sim runs are heavy: 45 s is the budget for the whole file at --maxWorkers=1 (signoff uses 30 s for less work).
const FILE_BUDGET_MS = 45000;
const SIM_TIMEOUT_MS = 120000;
// Every run stops early through stopAt, so this only bounds a run that never owns its stop tech.
const RUN_SECONDS = 36000;
// Profile A click rate: the reference for the frontier share check (manual <= 40 % means perSecond >= 1.5 x 4 x perClick).
const REF_CPS = 4;
const FRONTIER_FACTOR = 1.5;
// Servo pacing: A owns crankServo level 10 no earlier than 40:00 (the 10th crankServo purchase).
const SERVO_TENTH_NOT_BEFORE = 40 * MINUTE;
const SERVO_SUBSTATION_MIN_LEVEL = 4;

// A's snapshots, in the order they are owned. The ME check runs on all of them (pistonArray is first); the frontier
// check runs from the substation snapshot on (era II onwards).
const A_SNAPSHOTS: readonly TechId[] = [
  'pistonArray',
  'generatorBlueprint',
  'crankServo',
  'substationBlueprint',
  'pressureVesselBlueprint',
  'harmonicConvergence',
  'finalAlignment',
  'primaryFunction',
];
const FRONTIER_SNAPSHOTS: readonly TechId[] = A_SNAPSHOTS.slice(A_SNAPSHOTS.indexOf('substationBlueprint'));

const ERAS: readonly EraNumber[] = [1, 2, 3, 4, 5];
const MANUAL_SHARE_ERAS: readonly EraNumber[] = [2, 3, 4, 5]; // era I is report only
const CONTINUITY_RES: readonly ResourceId[] = ['me', 'ee', 'pr', 'rs'];
const VALUE_NAMES = ['A', 'P1', 'P2', 'P0', 'Q'] as const;

// Era gates for P1 and P0 against A (ratio = run.firstAt[tech] / A.firstAt[tech], limits from the plan).
interface GateRow {
  readonly id: TechId;
  readonly label: string;
  readonly p1Max: number;
  readonly p0Max: number;
}
const GATE_ROWS: readonly GateRow[] = [
  { id: 'substationBlueprint', label: 'substation (era II)', p1Max: 1.3, p0Max: 1.5 },
  { id: 'pressureVesselBlueprint', label: 'vessel (era III)', p1Max: 1.3, p0Max: 1.45 },
  { id: 'harmonicConvergence', label: 'convergence (era IV)', p1Max: 1.3, p0Max: 1.4 },
  { id: 'primaryFunction', label: 'primaryFunction (era V)', p1Max: 1.25, p0Max: 1.35 },
];

// Click rules: clicks per second for the step ending at t, read from the state before that step's clicks.
// clicksPerSecond is required by GreedyOptions but unused when clickRate is set (kept at 4 for readability).
/** P1: 4 cps until the Generator is owned, then 0.5 cps (a player who stops clicking after era I). */
const clicksP1 = (s: Readonly<GameState>): number => (s.techLevels.generator >= 1 ? 0.5 : 4);
/** P0: 4 cps until the Generator is owned, then no clicks at all. */
const clicksP0 = (s: Readonly<GameState>): number => (s.techLevels.generator >= 1 ? 0 : 4);
/** P1e: 4 cps until Motor Tuning 5 is owned, then 0.5 cps (the era-I passive target). */
const clicksP1e = (s: Readonly<GameState>): number => (s.techLevels.motorTuning >= 5 ? 0.5 : 4);

// Profiles (WP25 "Balance targets"). A = 4 cps, buy every 1 s. B = 4 cps, buy every 30 s. C = 1 cps, buy every 30 s.
// P1 = 4 cps until the Generator, then 0.5 cps, buy 1 s. P2 = P1 with buys every 30 s. P0 = 4 cps until the Generator,
// then 0. Q = 0.5 cps for the whole run, buy 1 s. R15 = 15 cps (report only). P1e = 4 cps until Motor Tuning 5, then
// 0.5 cps, buy 1 s, stops at the Generator Blueprint. The demo variants of P1e and Q add the edition era cap.
const A_OPTIONS: GreedyOptions = {
  seconds: RUN_SECONDS,
  clicksPerSecond: 4,
  stepSeconds: 1,
  buyIntervalSeconds: 1,
  stopAt: 'primaryFunction',
  trackIncome: true,
  snapshotAt: A_SNAPSHOTS,
};
const P1_OPTIONS: GreedyOptions = {
  seconds: RUN_SECONDS,
  clicksPerSecond: 4,
  clickRate: clicksP1,
  stepSeconds: 1,
  buyIntervalSeconds: 1,
  stopAt: 'primaryFunction',
  trackIncome: true,
  snapshotAt: ['harmonicConvergence', 'primaryFunction'],
};
const P2_OPTIONS: GreedyOptions = {
  seconds: RUN_SECONDS,
  clicksPerSecond: 4,
  clickRate: clicksP1,
  stepSeconds: 1,
  buyIntervalSeconds: 30,
  stopAt: 'primaryFunction',
};
const P0_OPTIONS: GreedyOptions = {
  seconds: RUN_SECONDS,
  clicksPerSecond: 4,
  clickRate: clicksP0,
  stepSeconds: 1,
  buyIntervalSeconds: 1,
  stopAt: 'primaryFunction',
};
const Q_OPTIONS: GreedyOptions = {
  seconds: RUN_SECONDS,
  clicksPerSecond: 0.5,
  stepSeconds: 1,
  buyIntervalSeconds: 1,
  stopAt: 'primaryFunction',
};
const R15_OPTIONS: GreedyOptions = {
  seconds: RUN_SECONDS,
  clicksPerSecond: 15,
  stepSeconds: 1,
  buyIntervalSeconds: 1,
  stopAt: 'primaryFunction',
};
const P1E_OPTIONS: GreedyOptions = {
  seconds: RUN_SECONDS,
  clicksPerSecond: 4,
  clickRate: clicksP1e,
  stepSeconds: 1,
  buyIntervalSeconds: 1,
  stopAt: 'generatorBlueprint',
};
const B_OPTIONS: GreedyOptions = {
  seconds: RUN_SECONDS,
  clicksPerSecond: 4,
  stepSeconds: 1,
  buyIntervalSeconds: 30,
  stopAt: 'substationBlueprint',
  snapshotAt: ['substationBlueprint'],
};
const C_OPTIONS: GreedyOptions = {
  seconds: RUN_SECONDS,
  clicksPerSecond: 1,
  stepSeconds: 1,
  buyIntervalSeconds: 30,
  stopAt: 'substationBlueprint',
  snapshotAt: ['substationBlueprint'],
};

/** Demo era cap from the edition data (never retyped here). A null cap would mean the edition is not the demo. */
function demoMaxEra(): number {
  const maxEra = EDITIONS.demo.maxEra;
  if (maxEra === null) throw new Error('demo edition has no maxEra');
  return maxEra;
}
const DEMO_MAX_ERA = demoMaxEra();

function formatMmSs(seconds: number): string {
  if (!Number.isFinite(seconds)) return 'never';
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(Math.floor(seconds % 60)).padStart(2, '0');
  return `${mm}:${ss}`;
}

function mdTable(title: string, headers: readonly string[], rows: ReadonlyArray<readonly string[]>): string {
  const head = `| ${headers.join(' | ')} |`;
  const rule = `| ${headers.map(() => '---').join(' | ')} |`;
  return [`### ${title}`, '', head, rule, ...rows.map((r) => `| ${r.join(' | ')} |`), ''].join('\n');
}

const pass = (ok: boolean): string => (ok ? 'PASS' : 'FAIL');
const ratio3 = (r: number): string => (Number.isFinite(r) ? r.toFixed(3) : 'n/a');
const percent = (share: number): string => (Number.isFinite(share) ? `${(share * 100).toFixed(1)} %` : 'n/a');

/** run.firstAt[id] / base.firstAt[id]; NaN when either time is not finite (so the finite check fails). */
function ratioOf(run: GreedyResult, base: GreedyResult, id: TechId): number {
  const t = run.firstAt[id];
  const ref = base.firstAt[id];
  if (!Number.isFinite(t) || !Number.isFinite(ref)) return NaN;
  return t / ref;
}

/** Time of the n-th (1-based) purchase of `id`; Infinity when the run bought fewer than n. */
function nthBuyAt(run: GreedyResult, id: TechId, n: number): number {
  const entries = run.purchases.filter((p) => p.id === id);
  return entries[n - 1]?.t ?? Infinity;
}

/** Snapshot of `id` from a run that recorded it; a missing one is a setup error (the test fails). */
function snapshotOf(run: GreedyResult, id: TechId): GameState {
  const state = run.snapshots?.[id];
  if (state === undefined) throw new Error(`snapshot of ${id} is missing (the run never owned it)`);
  return state;
}

/** Income split of a run that tracked income; a missing one is a setup error (the test fails). */
function incomeOf(run: GreedyResult): Record<EraNumber, IncomeSplit> {
  if (run.income === undefined) throw new Error('manual share: the run did not track income');
  return run.income;
}

/** P1 continuity of one energy over (harmonicConvergence, primaryFunction]: spend share and dead minutes up to PF. */
function continuityOrNull(run: GreedyResult, res: ResourceId): { share: number; dead: number } | null {
  const from = run.snapshots?.harmonicConvergence;
  const to = run.snapshots?.primaryFunction;
  if (from === undefined || to === undefined) return null;
  const ledger = purchaseLedger(run.purchases);
  return {
    share: spendShare(
      ledger,
      res,
      run.firstAt.harmonicConvergence,
      run.firstAt.primaryFunction,
      from.lifetime[res],
      to.lifetime[res],
    ),
    dead: deadMinutes(ledger, res, run.firstAt.primaryFunction),
  };
}

function continuityOf(run: GreedyResult, res: ResourceId): { share: number; dead: number } {
  const metrics = continuityOrNull(run, res);
  if (metrics === null) throw new Error('P1 continuity: harmonicConvergence or primaryFunction snapshot is missing');
  return metrics;
}

let a: GreedyResult;
let p1: GreedyResult;
let p2: GreedyResult;
let p0: GreedyResult;
let q: GreedyResult;
let r15: GreedyResult;
let p1eFull: GreedyResult;
let p1eDemo: GreedyResult;
let qDemo: GreedyResult;
let b: GreedyResult;
let c: GreedyResult;
let fileMs = 0;

beforeAll(() => {
  const start = Date.now();
  a = runGreedy(A_OPTIONS);
  p1 = runGreedy(P1_OPTIONS);
  p2 = runGreedy(P2_OPTIONS);
  p0 = runGreedy(P0_OPTIONS);
  q = runGreedy(Q_OPTIONS);
  r15 = runGreedy(R15_OPTIONS);
  p1eFull = runGreedy(P1E_OPTIONS);
  p1eDemo = runGreedy({ ...P1E_OPTIONS, maxEra: DEMO_MAX_ERA });
  qDemo = runGreedy({ ...Q_OPTIONS, stopAt: 'generatorBlueprint', maxEra: DEMO_MAX_ERA });
  b = runGreedy(B_OPTIONS);
  c = runGreedy(C_OPTIONS);
  fileMs = Date.now() - start;

  const pfA = a.firstAt.primaryFunction;

  console.info(
    mdTable(
      'P1 and P0 era gates (active seconds; ratio = run / A)',
      ['gate', 'A (mm:ss)', 'P1 (mm:ss)', 'P1 / A', 'P1 limit', 'P0 (mm:ss)', 'P0 / A', 'P0 limit', 'check'],
      GATE_ROWS.map((row) => {
        const r1 = ratioOf(p1, a, row.id);
        const r0 = ratioOf(p0, a, row.id);
        return [
          row.label,
          formatMmSs(a.firstAt[row.id]),
          formatMmSs(p1.firstAt[row.id]),
          ratio3(r1),
          `<= ${row.p1Max.toFixed(2)}`,
          formatMmSs(p0.firstAt[row.id]),
          ratio3(r0),
          `<= ${row.p0Max.toFixed(2)}`,
          pass(r1 <= row.p1Max && r0 <= row.p0Max),
        ];
      }),
    ),
  );
  console.info(
    mdTable(
      'P2, P0 and Q against A (primaryFunction, active seconds)',
      ['run', 'primaryFunction (mm:ss)', 'ratio to A', 'asserted', 'check'],
      [
        ['A (reference)', formatMmSs(pfA), ratio3(1), 'reference', 'PASS'],
        [
          'P2 (P1, buy 30 s)',
          formatMmSs(p2.firstAt.primaryFunction),
          ratio3(ratioOf(p2, a, 'primaryFunction')),
          '<= 1.35',
          pass(ratioOf(p2, a, 'primaryFunction') <= 1.35),
        ],
        [
          'Q (0.5 cps, buy 1 s)',
          formatMmSs(q.firstAt.primaryFunction),
          ratio3(ratioOf(q, a, 'primaryFunction')),
          '<= 1.50',
          pass(ratioOf(q, a, 'primaryFunction') <= 1.5),
        ],
        [
          'P0 (4 cps then 0)',
          formatMmSs(p0.firstAt.primaryFunction),
          ratio3(ratioOf(p0, a, 'primaryFunction')),
          '>= 1.05',
          pass(ratioOf(p0, a, 'primaryFunction') >= 1.05),
        ],
      ],
    ),
  );
  console.info(
    mdTable(
      'Q per-gate ratios (Q / A, active seconds)',
      ['gate', 'A (mm:ss)', 'Q (mm:ss)', 'Q / A', 'asserted', 'check'],
      [
        ['blueprint (era I)', formatMmSs(a.firstAt.generatorBlueprint), formatMmSs(q.firstAt.generatorBlueprint), ratio3(ratioOf(q, a, 'generatorBlueprint')), '<= 2.00', pass(ratioOf(q, a, 'generatorBlueprint') <= 2)],
        ...GATE_ROWS.map((row) => [
          row.label,
          formatMmSs(a.firstAt[row.id]),
          formatMmSs(q.firstAt[row.id]),
          ratio3(ratioOf(q, a, row.id)),
          row.id === 'primaryFunction' ? '<= 1.50' : 'report',
          row.id === 'primaryFunction' ? pass(ratioOf(q, a, row.id) <= 1.5) : 'report',
        ]),
      ],
    ),
  );
  console.info(
    mdTable(
      'crankServo level times, profile A (level n = the n-th purchase of crankServo)',
      ['level', 'A (mm:ss)', 'asserted', 'check'],
      [1, 4, 7, 10].map((level) => {
        const t = nthBuyAt(a, 'crankServo', level);
        const check = level === 10 ? pass(Number.isFinite(t) && t >= SERVO_TENTH_NOT_BEFORE) : 'report';
        return [`${level}`, formatMmSs(t), level === 10 ? '>= 40:00' : 'report', check];
      }),
    ),
  );
  console.info(
    mdTable(
      'crankServo owned at substationBlueprint',
      ['run', 'level', 'asserted', 'check'],
      [
        ['A', `${a.snapshots?.substationBlueprint?.techLevels.crankServo ?? 'n/a'}`, `>= ${SERVO_SUBSTATION_MIN_LEVEL}`, pass((a.snapshots?.substationBlueprint?.techLevels.crankServo ?? 0) >= SERVO_SUBSTATION_MIN_LEVEL)],
        ['B', `${b.snapshots?.substationBlueprint?.techLevels.crankServo ?? 'n/a'}`, `>= ${SERVO_SUBSTATION_MIN_LEVEL}`, pass((b.snapshots?.substationBlueprint?.techLevels.crankServo ?? 0) >= SERVO_SUBSTATION_MIN_LEVEL)],
        ['C', `${c.snapshots?.substationBlueprint?.techLevels.crankServo ?? 'n/a'}`, `>= ${SERVO_SUBSTATION_MIN_LEVEL}`, pass((c.snapshots?.substationBlueprint?.techLevels.crankServo ?? 0) >= SERVO_SUBSTATION_MIN_LEVEL)],
      ],
    ),
  );
  console.info(
    mdTable(
      'Manual share of A income by era (manual / (manual + passive), frontier energy)',
      ['era', 'frontier', 'manual share', 'asserted', 'check'],
      ERAS.map((era) => {
        const res = eraResource(era);
        const share = manualShare(incomeOf(a), era, res);
        const asserted = MANUAL_SHARE_ERAS.includes(era);
        return [
          `${era}`,
          res,
          percent(share),
          asserted ? '10-40 %' : 'report',
          asserted ? pass(share >= 0.1 && share <= 0.4) : 'report',
        ];
      }),
    ),
  );
  console.info(
    mdTable(
      'R15 (15 cps keyboard player, report only)',
      ['run', 'primaryFunction (mm:ss)', 'ratio to A', 'asserted', 'check'],
      [
        ['A (reference)', formatMmSs(pfA), ratio3(1), 'reference', 'PASS'],
        ['R15 (15 cps, buy 1 s)', formatMmSs(r15.firstAt.primaryFunction), ratio3(ratioOf(r15, a, 'primaryFunction')), 'report', 'report'],
      ],
    ),
  );
  console.info(
    mdTable(
      'Era I blueprint, P1e and Q (full and demo; ratio to A)',
      ['run', 'generatorBlueprint (mm:ss)', 'ratio to A', 'asserted', 'check'],
      [
        ['A (reference)', formatMmSs(a.firstAt.generatorBlueprint), ratio3(1), 'reference', 'PASS'],
        [
          'P1e full (4 cps to motorTuning 5, then 0.5)',
          formatMmSs(p1eFull.firstAt.generatorBlueprint),
          ratio3(ratioOf(p1eFull, a, 'generatorBlueprint')),
          '<= 1.35',
          pass(ratioOf(p1eFull, a, 'generatorBlueprint') <= 1.35),
        ],
        [
          'P1e demo (maxEra 2)',
          formatMmSs(p1eDemo.firstAt.generatorBlueprint),
          ratio3(ratioOf(p1eDemo, a, 'generatorBlueprint')),
          '<= 1.35, = full',
          pass(ratioOf(p1eDemo, a, 'generatorBlueprint') <= 1.35 && p1eDemo.firstAt.generatorBlueprint === p1eFull.firstAt.generatorBlueprint),
        ],
        [
          'Q full (0.5 cps)',
          formatMmSs(q.firstAt.generatorBlueprint),
          ratio3(ratioOf(q, a, 'generatorBlueprint')),
          '<= 2.00',
          pass(ratioOf(q, a, 'generatorBlueprint') <= 2),
        ],
        [
          'Q demo (maxEra 2, 0.5 cps)',
          formatMmSs(qDemo.firstAt.generatorBlueprint),
          ratio3(ratioOf(qDemo, a, 'generatorBlueprint')),
          '= Q full',
          pass(qDemo.firstAt.generatorBlueprint === q.firstAt.generatorBlueprint),
        ],
      ],
    ),
  );
  console.info(
    mdTable(
      'P1 continuity (harmonicConvergence to primaryFunction)',
      ['energy', 'spend share', 'dead min', 'asserted', 'check'],
      CONTINUITY_RES.map((res) => {
        const m = continuityOrNull(p1, res);
        const ok = m !== null && m.share >= 0.6 && m.dead <= 8;
        return [
          res,
          m === null ? 'n/a' : percent(m.share),
          m === null ? 'n/a' : m.dead.toFixed(1),
          '>= 60 % / <= 8 min',
          pass(ok),
        ];
      }),
    ),
  );
  console.info(
    mdTable(
      'Purchase gaps and values',
      ['run', 'max gap blueprint -> PF (s)', 'asserted', 'maxValue', 'finite', 'below DESIGN_MAX_VALUE'],
      [
        ['A', String(maxPurchaseGap(a.purchases, a.firstAt.generatorBlueprint, a.firstAt.primaryFunction)), 'report', a.maxValue.toExponential(3), pass(Number.isFinite(a.maxValue)), pass(a.maxValue < DESIGN_MAX_VALUE)],
        ['P1', String(maxPurchaseGap(p1.purchases, p1.firstAt.generatorBlueprint, p1.firstAt.primaryFunction)), '<= 1200', p1.maxValue.toExponential(3), pass(Number.isFinite(p1.maxValue)), pass(p1.maxValue < DESIGN_MAX_VALUE)],
        ['P2', String(maxPurchaseGap(p2.purchases, p2.firstAt.generatorBlueprint, p2.firstAt.primaryFunction)), 'report', p2.maxValue.toExponential(3), pass(Number.isFinite(p2.maxValue)), pass(p2.maxValue < DESIGN_MAX_VALUE)],
        ['P0', String(maxPurchaseGap(p0.purchases, p0.firstAt.generatorBlueprint, p0.firstAt.primaryFunction)), 'report', p0.maxValue.toExponential(3), pass(Number.isFinite(p0.maxValue)), pass(p0.maxValue < DESIGN_MAX_VALUE)],
        ['Q', String(maxPurchaseGap(q.purchases, q.firstAt.generatorBlueprint, q.firstAt.primaryFunction)), 'report', q.maxValue.toExponential(3), pass(Number.isFinite(q.maxValue)), pass(q.maxValue < DESIGN_MAX_VALUE)],
      ],
    ),
  );
  console.info(
    mdTable(
      'File run time (greedy runs, beforeAll)',
      ['measured (ms)', 'budget (ms)', 'check'],
      [[String(fileMs), String(FILE_BUDGET_MS), pass(fileMs < FILE_BUDGET_MS)]],
    ),
  );
}, SIM_TIMEOUT_MS);

describe('passive-first: era gates, P1 and P0 vs A', () => {
  for (const row of GATE_ROWS) {
    it(`P1 ${row.label} <= ${row.p1Max} x A`, () => {
      const r = ratioOf(p1, a, row.id);
      expect(Number.isFinite(r)).toBe(true);
      expect(r).toBeLessThanOrEqual(row.p1Max);
    });
    it(`P0 ${row.label} <= ${row.p0Max} x A`, () => {
      const r = ratioOf(p0, a, row.id);
      expect(Number.isFinite(r)).toBe(true);
      expect(r).toBeLessThanOrEqual(row.p0Max);
    });
  }
});

describe('passive-first: P2, Q and clicks never worthless', () => {
  it('P2 (P1 with buys every 30 s) primaryFunction <= 1.35 x A', () => {
    const r = ratioOf(p2, a, 'primaryFunction');
    expect(Number.isFinite(r)).toBe(true);
    expect(r).toBeLessThanOrEqual(1.35);
  });

  it('Q (0.5 cps for the whole run) primaryFunction <= 1.50 x A', () => {
    const r = ratioOf(q, a, 'primaryFunction');
    expect(Number.isFinite(r)).toBe(true);
    expect(r).toBeLessThanOrEqual(1.5);
  });

  it('P0 (no clicks after the Generator) primaryFunction >= 1.05 x A', () => {
    const r = ratioOf(p0, a, 'primaryFunction');
    expect(Number.isFinite(r)).toBe(true);
    expect(r).toBeGreaterThanOrEqual(1.05);
  });
});

describe('passive-first: era I passive target (P1e and Q at generatorBlueprint)', () => {
  it('P1e (4 cps until motorTuning 5, then 0.5) blueprint <= 1.35 x A', () => {
    const r = ratioOf(p1eFull, a, 'generatorBlueprint');
    expect(Number.isFinite(r)).toBe(true);
    expect(r).toBeLessThanOrEqual(1.35);
  });

  it('Q (0.5 cps) blueprint <= 2.00 x A', () => {
    const r = ratioOf(q, a, 'generatorBlueprint');
    expect(Number.isFinite(r)).toBe(true);
    expect(r).toBeLessThanOrEqual(2);
  });

  it('P1e full and demo reach the Generator Blueprint at the same second', () => {
    expect(Number.isFinite(p1eFull.firstAt.generatorBlueprint)).toBe(true);
    expect(p1eDemo.firstAt.generatorBlueprint).toBe(p1eFull.firstAt.generatorBlueprint);
  });

  it('Q full and Q demo reach the Generator Blueprint at the same second', () => {
    expect(Number.isFinite(q.firstAt.generatorBlueprint)).toBe(true);
    expect(qDemo.firstAt.generatorBlueprint).toBe(q.firstAt.generatorBlueprint);
  });
});

describe('passive-first: manual share of A (eras II to V)', () => {
  for (const era of MANUAL_SHARE_ERAS) {
    it(`era ${era} (${eraResource(era)}): manual share between 10 % and 40 %`, () => {
      const share = manualShare(incomeOf(a), era, eraResource(era));
      expect(Number.isFinite(share)).toBe(true);
      expect(share).toBeGreaterThanOrEqual(0.1);
      expect(share).toBeLessThanOrEqual(0.4);
    });
  }
});

describe('passive-first: machine output per click (A snapshots)', () => {
  for (const id of A_SNAPSHOTS) {
    it(`at ${id}: ME passive >= 4 x perClick.me`, () => {
      const rates = computeRates(snapshotOf(a, id), TECHNOLOGIES);
      expect(rates.perSecond.me).toBeGreaterThanOrEqual(REF_CPS * rates.perClick.me);
    });
  }

  for (const id of FRONTIER_SNAPSHOTS) {
    it(`at ${id}: frontier perSecond >= 1.5 x 4 x perClick (manual <= 40 %)`, () => {
      const state = snapshotOf(a, id);
      const rates = computeRates(state, TECHNOLOGIES);
      const frontier = eraResource(currentEra(state.techLevels));
      expect(rates.perSecond[frontier]).toBeGreaterThanOrEqual(FRONTIER_FACTOR * REF_CPS * rates.perClick[frontier]);
    });
  }
});

describe('passive-first: servo pacing', () => {
  it('A: the 10th crankServo purchase is at or after 40:00', () => {
    const t = nthBuyAt(a, 'crankServo', 10);
    expect(Number.isFinite(t)).toBe(true);
    expect(t).toBeGreaterThanOrEqual(SERVO_TENTH_NOT_BEFORE);
  });

  // WHY: the run is looked up inside each test (describe bodies run before beforeAll fills a, b and c).
  for (const name of ['A', 'B', 'C'] as const) {
    it(`${name}: crankServo level >= 4 at substationBlueprint`, () => {
      const run = name === 'A' ? a : name === 'B' ? b : c;
      expect(snapshotOf(run, 'substationBlueprint').techLevels.crankServo).toBeGreaterThanOrEqual(SERVO_SUBSTATION_MIN_LEVEL);
    });
  }
});

describe('passive-first: purchase gaps and energy continuity (P1)', () => {
  it('P1: no purchase gap over 1200 s between generatorBlueprint and primaryFunction', () => {
    const gap = maxPurchaseGap(p1.purchases, p1.firstAt.generatorBlueprint, p1.firstAt.primaryFunction);
    expect(gap).toBeLessThanOrEqual(1200);
  });

  for (const res of CONTINUITY_RES) {
    it(`P1 ${res}: spend share >= 60 % and dead time <= 8 min (harmonicConvergence to primaryFunction)`, () => {
      const m = continuityOf(p1, res);
      expect(m.share).toBeGreaterThanOrEqual(0.6);
      expect(m.dead).toBeLessThanOrEqual(8);
    });
  }
});

describe('passive-first: values and file budget', () => {
  it('every run has finite values below DESIGN_MAX_VALUE (A, P1, P2, P0, Q)', () => {
    const runs: Record<(typeof VALUE_NAMES)[number], GreedyResult> = { A: a, P1: p1, P2: p2, P0: p0, Q: q };
    for (const name of VALUE_NAMES) {
      expect(Number.isFinite(runs[name].maxValue), name).toBe(true);
      expect(runs[name].maxValue, name).toBeLessThan(DESIGN_MAX_VALUE);
    }
  });

  it('the passive-first file runs within its 45 s budget', () => {
    expect(fileMs).toBeLessThan(FILE_BUDGET_MS);
  });
});

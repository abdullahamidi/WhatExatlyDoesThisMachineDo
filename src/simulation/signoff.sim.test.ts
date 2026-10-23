import { beforeAll, describe, it, expect } from 'vitest';
import { DESIGN_MAX_VALUE } from '../data/balance';
import { PERK_IDS } from '../data/prestige';
import type { PerkId } from '../data/prestige';
import { TECHNOLOGIES } from '../data/technologies';
import type { PrestigeState, TechId } from '../data/types';
import { cycleTechs, newCycleState } from './prestige';
import { runGreedy, maxPurchaseGap } from './sim/greedy';
import type { GreedyOptions, GreedyResult } from './sim/greedy';

// WP16 T3 balance sign-off. Deterministic greedy players (profiles A, B, C, D) and the cycle-2 / cycle-3 /
// casual Memory checks, asserted against the roadmap §1 windows and the WP16 sign-off table. Every run stops
// at primaryFunction (stopAt) to keep this file fast. One markdown table per block is printed via console.info.
// No randomness, no rendering. The wall-time check is the only clock use.
// Re-run: npx vitest run src/simulation/signoff.sim.test.ts

const MINUTE = 60; // unit conversion for the window table (seconds per minute)
const HOUR = 3600; // unit conversion for the nightly schedule (seconds per hour)
// 30 s: ~4 s alone, but 10 s failed while parallel builds/smokes loaded the CPU (Director, WP19 merge).
const FILE_BUDGET_MS = 30000;
const SIGNOFF_TIMEOUT_MS = 60000;

// A = 4 clicks/s, buys every second. B = 4 clicks/s, buys every 30 s. C = 1 click/s, buys every 30 s, no offline.
// D = C with a 2 h active / 8 h offline schedule. `seconds` is the ACTIVE budget for every profile.
const PROFILE_A = { seconds: 17400, clicksPerSecond: 4, stepSeconds: 1, buyIntervalSeconds: 1 };
const PROFILE_B = { seconds: 18000, clicksPerSecond: 4, stepSeconds: 1, buyIntervalSeconds: 30 };
const PROFILE_C = { seconds: 28800, clicksPerSecond: 1, stepSeconds: 1, buyIntervalSeconds: 30 };
const PROFILE_D = { ...PROFILE_C, schedule: { activeSeconds: 2 * HOUR, offlineSeconds: 8 * HOUR } };

type Profile = Pick<GreedyOptions, 'seconds' | 'clicksPerSecond' | 'stepSeconds' | 'buyIntervalSeconds' | 'schedule'>;

// Roadmap §1 era-end windows for profile A, in seconds.
const ERA_END_WINDOWS: ReadonlyArray<{ id: TechId; label: string; lo: number; hi: number }> = [
  { id: 'generatorBlueprint', label: 'blueprint', lo: 20 * MINUTE, hi: 30 * MINUTE },
  { id: 'substationBlueprint', label: 'substation', lo: 55 * MINUTE, hi: 75 * MINUTE },
  { id: 'pressureVesselBlueprint', label: 'vessel', lo: 105 * MINUTE, hi: 135 * MINUTE },
  { id: 'harmonicConvergence', label: 'convergence', lo: 165 * MINUTE, hi: 205 * MINUTE },
  { id: 'primaryFunction', label: 'primaryFunction', lo: 230 * MINUTE, hi: 290 * MINUTE },
];

const CYCLE_TWO_SINGLES: ReadonlyArray<{ name: string; perks: readonly PerkId[] }> = [
  { name: 'muscleMemory', perks: ['muscleMemory'] },
  { name: 'residualCharge', perks: ['residualCharge'] },
  { name: 'servoRecall', perks: ['servoRecall'] },
  { name: 'ledger', perks: ['ledger'] },
];
const CYCLE_TWO_NONE: readonly PerkId[] = [];
// Cycle 3 with 6 Echoes: muscle 1 + residual 2 + servo 3.
const CYCLE_THREE_PERKS: readonly PerkId[] = ['muscleMemory', 'residualCharge', 'servoRecall'];

/** Keeps PERK_IDS order, the same order `buyPerk` produces. */
function prestige(cycle: number, echoesEarned: number, perks: readonly PerkId[]): PrestigeState {
  return { cycle, echoesEarned, perks: PERK_IDS.filter((id) => perks.includes(id)) };
}

/** Runs one profile to primaryFunction. With `p`, starts the matching cycle with its Memory table. */
function play(profile: Profile, p?: PrestigeState): GreedyResult {
  if (p === undefined) return runGreedy({ ...profile, stopAt: 'primaryFunction' });
  return runGreedy({
    ...profile,
    initial: newCycleState(0, p),
    techs: cycleTechs(TECHNOLOGIES, p),
    stopAt: 'primaryFunction',
  });
}

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

let a: GreedyResult;
let b: GreedyResult;
let c: GreedyResult;
let d: GreedyResult;
let cycleOne: GreedyResult;
let cycleTwoNone: GreedyResult;
let cycleTwo: Array<{ name: string; run: GreedyResult }> = [];
let cycleThree: GreedyResult;
let casualOne: GreedyResult;
let casualTwo: GreedyResult;
let fileMs = 0;

beforeAll(() => {
  const start = Date.now();
  a = play(PROFILE_A);
  b = play(PROFILE_B);
  c = play(PROFILE_C);
  d = play(PROFILE_D);
  cycleOne = a;
  cycleTwoNone = play(PROFILE_A, prestige(2, 3, CYCLE_TWO_NONE));
  cycleTwo = CYCLE_TWO_SINGLES.map((spend) => ({ name: spend.name, run: play(PROFILE_A, prestige(2, 3, spend.perks)) }));
  cycleThree = play(PROFILE_A, prestige(3, 6, CYCLE_THREE_PERKS));
  casualOne = c;
  casualTwo = play(PROFILE_C, prestige(2, 3, CYCLE_TWO_NONE));
  fileMs = Date.now() - start;

  const pfA = a.firstAt.primaryFunction;
  const pfC = c.firstAt.primaryFunction;
  const profiles: Array<{ name: string; run: GreedyResult }> = [
    { name: 'A (4 cps, 1 s buys)', run: a },
    { name: 'B (4 cps, 30 s buys)', run: b },
    { name: 'C (1 cps, 30 s buys)', run: c },
    { name: 'D (C + 2 h / 8 h schedule)', run: d },
  ];

  console.info(
    mdTable(
      'Era-end windows, profile A',
      ['milestone', 'tech', 'window (mm:ss)', 'A (mm:ss)', 'check'],
      ERA_END_WINDOWS.map((w) => {
        const t = a.firstAt[w.id];
        return [w.label, w.id, `${formatMmSs(w.lo)}-${formatMmSs(w.hi)}`, formatMmSs(t), pass(t >= w.lo && t <= w.hi)];
      }),
    ),
  );
  console.info(
    mdTable(
      'Profile primaryFunction (active seconds; wall = active + offline)',
      ['run', 'primaryFunction active (mm:ss)', 'wall (mm:ss)', 'asserted', 'check'],
      [
        [
          'A',
          formatMmSs(a.firstAt.primaryFunction),
          formatMmSs(a.wallSeconds ?? a.firstAt.primaryFunction),
          '230-290 min',
          pass(a.firstAt.primaryFunction >= 230 * MINUTE && a.firstAt.primaryFunction <= 290 * MINUTE),
        ],
        ['B', formatMmSs(b.firstAt.primaryFunction), formatMmSs(b.firstAt.primaryFunction), '<= 300 min', pass(b.firstAt.primaryFunction <= 300 * MINUTE)],
        ['C', formatMmSs(pfC), formatMmSs(pfC), '<= 480 min', pass(pfC <= 480 * MINUTE)],
        [
          'D',
          formatMmSs(d.firstAt.primaryFunction),
          formatMmSs(d.wallSeconds ?? Infinity),
          '<= C active and <= 480 min',
          pass(d.firstAt.primaryFunction <= pfC && d.firstAt.primaryFunction <= 480 * MINUTE),
        ],
      ],
    ),
  );
  console.info(
    mdTable(
      'Max purchase gap generatorBlueprint -> primaryFunction (active seconds)',
      ['run', 'gap (s)', 'limit (s)', 'check'],
      profiles.map(({ name, run }) => {
        const gap = maxPurchaseGap(run.purchases, run.firstAt.generatorBlueprint, run.firstAt.primaryFunction);
        return [name, String(gap), '1200', pass(gap <= 1200)];
      }),
    ),
  );
  const casualBase = casualOne.firstAt.primaryFunction;
  const cycleTwoRows = cycleTwo.map((s) => [
    `cycle 2, 3 Echoes, ${s.name} (A)`,
    formatMmSs(s.run.firstAt.primaryFunction),
    (s.run.firstAt.primaryFunction / pfA).toFixed(3),
    '<= 0.65',
    pass(s.run.firstAt.primaryFunction / pfA <= 0.65),
  ]);
  console.info(
    mdTable(
      'Memory cycles (ratio = primaryFunction / cycle 1 of the same profile)',
      ['run', 'primaryFunction (mm:ss)', 'ratio', 'asserted', 'check'],
      [
        ['cycle 1 (A)', formatMmSs(pfA), '1.000', 'reference', 'PASS'],
        ...cycleTwoRows,
        [
          'cycle 2, 3 Echoes, none (A)',
          formatMmSs(cycleTwoNone.firstAt.primaryFunction),
          (cycleTwoNone.firstAt.primaryFunction / pfA).toFixed(3),
          'reference for cycle 3',
          'PASS',
        ],
        [
          'cycle 3, 6 Echoes, muscle+residual+servo (A)',
          formatMmSs(cycleThree.firstAt.primaryFunction),
          (cycleThree.firstAt.primaryFunction / pfA).toFixed(3),
          '< cycle 2 none',
          pass(cycleThree.firstAt.primaryFunction < cycleTwoNone.firstAt.primaryFunction),
        ],
        ['casual cycle 1 (C)', formatMmSs(casualBase), '1.000', 'reference', 'PASS'],
        [
          'casual cycle 2, 3 Echoes, none (C)',
          formatMmSs(casualTwo.firstAt.primaryFunction),
          (casualTwo.firstAt.primaryFunction / casualBase).toFixed(3),
          '<= 0.65',
          pass(casualTwo.firstAt.primaryFunction / casualBase <= 0.65),
        ],
      ],
    ),
  );
  const valueRuns: Array<{ name: string; run: GreedyResult }> = [
    ...profiles,
    { name: 'cycle 2, 3 Echoes, none (A)', run: cycleTwoNone },
    { name: 'cycle 3, 6 Echoes (A)', run: cycleThree },
    { name: 'casual cycle 2 (C)', run: casualTwo },
    ...cycleTwo.map((s) => ({ name: `cycle 2, 3 Echoes, ${s.name} (A)`, run: s.run })),
  ];
  console.info(
    mdTable(
      'Values (every run)',
      ['run', 'maxValue', 'finite', 'below DESIGN_MAX_VALUE'],
      valueRuns.map(({ name, run }) => [
        name,
        run.maxValue.toExponential(3),
        pass(Number.isFinite(run.maxValue)),
        pass(run.maxValue < DESIGN_MAX_VALUE),
      ]),
    ),
  );
}, SIGNOFF_TIMEOUT_MS);

describe('signoff: era-end windows (profile A, roadmap §1)', () => {
  for (const w of ERA_END_WINDOWS) {
    it(`${w.label} (${w.id}) lands inside its window`, () => {
      expect(a.firstAt[w.id]).toBeGreaterThanOrEqual(w.lo);
      expect(a.firstAt[w.id]).toBeLessThanOrEqual(w.hi);
    });
  }
});

describe('signoff: profile primaryFunction', () => {
  it('A: primaryFunction at 230-290 min', () => {
    expect(a.firstAt.primaryFunction).toBeGreaterThanOrEqual(230 * MINUTE);
    expect(a.firstAt.primaryFunction).toBeLessThanOrEqual(290 * MINUTE);
  });

  it('B: primaryFunction at or before 300 min', () => {
    expect(b.firstAt.primaryFunction).toBeLessThanOrEqual(300 * MINUTE);
  });

  it('C: primaryFunction at or before 480 min (no offline)', () => {
    expect(c.firstAt.primaryFunction).toBeLessThanOrEqual(480 * MINUTE);
  });

  it('D: active primaryFunction at or before C active and at or before 480 min; wall time reported', () => {
    expect(d.firstAt.primaryFunction).toBeLessThanOrEqual(c.firstAt.primaryFunction);
    expect(d.firstAt.primaryFunction).toBeLessThanOrEqual(480 * MINUTE);
    expect(d.wallSeconds).toBeDefined();
    expect(d.wallSeconds ?? 0).toBeGreaterThanOrEqual(d.firstAt.primaryFunction);
  });
});

describe('signoff: purchase gaps (generatorBlueprint -> primaryFunction)', () => {
  it('A, B, C, D: no gap over 1200 s (D in active seconds)', () => {
    for (const run of [a, b, c, d]) {
      const gap = maxPurchaseGap(run.purchases, run.firstAt.generatorBlueprint, run.firstAt.primaryFunction);
      expect(gap).toBeLessThanOrEqual(1200);
    }
  });
});

describe('signoff: Memory cycles', () => {
  it('cycle 2 with 3 Echoes, each single perk, is at most 65 % of cycle 1 (A)', () => {
    for (const s of cycleTwo) {
      expect(s.run.firstAt.primaryFunction / cycleOne.firstAt.primaryFunction, s.name).toBeLessThanOrEqual(0.65);
    }
  });

  it('cycle 3 with 6 Echoes (A) is faster than cycle 2 with no perk', () => {
    expect(cycleThree.firstAt.primaryFunction).toBeLessThan(cycleTwoNone.firstAt.primaryFunction);
  });

  it('casual cycle 2 (3 Echoes) is at most 65 % of casual cycle 1 (C)', () => {
    expect(casualTwo.firstAt.primaryFunction / casualOne.firstAt.primaryFunction).toBeLessThanOrEqual(0.65);
  });
});

describe('signoff: values and file budget', () => {
  it('every run has finite values below DESIGN_MAX_VALUE', () => {
    const runs = [a, b, c, d, cycleOne, cycleTwoNone, cycleThree, casualOne, casualTwo, ...cycleTwo.map((s) => s.run)];
    for (const run of runs) {
      expect(Number.isFinite(run.maxValue)).toBe(true);
      expect(run.maxValue).toBeLessThan(DESIGN_MAX_VALUE);
    }
  });

  it('the signoff file runs within its 30 s budget', () => {
    expect(fileMs).toBeLessThan(FILE_BUDGET_MS);
  });
});

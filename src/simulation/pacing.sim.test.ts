import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EDITIONS } from '../data/edition';
import { TECHNOLOGIES } from '../data/technologies';
import { TECH_IDS } from '../data/types';
import type { TechId } from '../data/types';
import { runGreedy } from './sim/greedy';
import type { GreedyFaults, GreedyFinds, GreedyInterval, GreedyOptions, GreedyResult } from './sim/greedy';
import { eventGaps, gapStats, purchaseGaps } from './sim/pacing';
import type { Gap, GapStats } from './sim/pacing';

// WP28 pacing set REC (PC1-PC13 of docs/plan/WP28.md, 'Balance targets'). Greedy players with the multi-buy policy
// (the greedy default), the Machine Faults and Finds processes on screen, and the Splices. Profiles:
// A = 4 clicks/s, buys every 1 s, catches faults (1 / 2 s) and Finds (0.85 / 4 s), run to primaryFunction;
// W5 = 4 clicks/s for 5 min, then 0.5, buys every 1 s, faults and Finds spawn and are never caught, run to primaryFunction;
// demo A and demo W5 = the same two with the demo era cap, run to the demo cap tech (substationBlueprint).
// Gap statistics come from sim/pacing.ts (the audit harness maths). One run per profile in beforeAll; the tests only
// assert, and the tables are printed after the run. A failing bound is a balance finding: never widen it here.
// Re-run: npx vitest run src/simulation/pacing.sim.test.ts --maxWorkers=1

const STEP_SECONDS = 1;
const RUN_SECONDS = 36000;
const CLICKS_PER_SECOND = 4;
// W5: 4 clicks/s until this active second, then the late rate.
const W5_CLICK_END_S = 300;
const W5_LATE_CLICKS_PER_SECOND = 0.5;
// Reference times the ratios are taken against: A primaryFunction 250:09, demo A substationBlueprint 60:50 (v0.11.0 runs).
const REF_A_PF_S = 15009;
const REF_DEMO_A_SUBSTATION_S = 3650;
// Greedy runs stop at their tech; this only bounds the setup of all four runs together.
const SETUP_TIMEOUT_MS = 60000;
// The Splice count of the plan (16) and of the era I-II Splices (6).
const SPLICE_COUNT = 16;
const ERA_I_II_SPLICE_COUNT = 6;

// Cap and era come from the edition, never retyped here. Null would mean the edition is not the demo.
function demoValue<T>(value: T | null, what: string): T {
  if (value === null) throw new Error(`demo edition has no ${what}`);
  return value;
}
const DEMO_MAX_ERA: number = demoValue(EDITIONS.demo.maxEra, 'maxEra');
const DEMO_CAP_TECH: TechId = demoValue(EDITIONS.demo.capTech, 'capTech');

const A_FAULTS: GreedyFaults = { catchProb: 1, reactionSeconds: 2 };
const A_FINDS: GreedyFinds = { catchProb: 0.85, reactionSeconds: 4 };
// W5 spawns faults and Finds that are never caught (catch 0): no payout, the same economy as no process.
const W5_FAULTS: GreedyFaults = { catchProb: 0, reactionSeconds: 2 };
const W5_FINDS: GreedyFinds = { catchProb: 0, reactionSeconds: 4 };

const A_OPTIONS: GreedyOptions = {
  seconds: RUN_SECONDS,
  clicksPerSecond: CLICKS_PER_SECOND,
  stepSeconds: STEP_SECONDS,
  buyIntervalSeconds: 1,
  stopAt: 'primaryFunction',
  faults: A_FAULTS,
  finds: A_FINDS,
  trackEvents: true,
  trackAvailable: true,
};
const W5_OPTIONS: GreedyOptions = {
  seconds: RUN_SECONDS,
  clicksPerSecond: CLICKS_PER_SECOND,
  clickRate: (_state, t) => (t <= W5_CLICK_END_S ? CLICKS_PER_SECOND : W5_LATE_CLICKS_PER_SECOND),
  stepSeconds: STEP_SECONDS,
  buyIntervalSeconds: 1,
  stopAt: 'primaryFunction',
  faults: W5_FAULTS,
  finds: W5_FINDS,
  trackEvents: true,
  trackAvailable: true,
};
const DEMO_A_OPTIONS: GreedyOptions = { ...A_OPTIONS, stopAt: DEMO_CAP_TECH, maxEra: DEMO_MAX_ERA };
const DEMO_W5_OPTIONS: GreedyOptions = { ...W5_OPTIONS, stopAt: DEMO_CAP_TECH, maxEra: DEMO_MAX_ERA };

const SPLICE_IDS: readonly TechId[] = TECH_IDS.filter((id) => TECHNOLOGIES[id].branch === 'splice');
const ERA_I_II_SPLICE_IDS: readonly TechId[] = SPLICE_IDS.filter((id) => TECHNOLOGIES[id].era <= 2);

const PRINT_ERAS = [1, 2, 3, 4, 5] as const;

let a: GreedyResult;
let w5: GreedyResult;
let demoA: GreedyResult;
let demoW5: GreedyResult;
let ready = false;

beforeAll(() => {
  a = runGreedy(A_OPTIONS);
  w5 = runGreedy(W5_OPTIONS);
  demoA = runGreedy(DEMO_A_OPTIONS);
  demoW5 = runGreedy(DEMO_W5_OPTIONS);
  ready = true;
}, SETUP_TIMEOUT_MS);

function formatMmSs(seconds: number): string {
  if (!Number.isFinite(seconds)) return 'never';
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(Math.floor(seconds % 60)).padStart(2, '0');
  return `${mm}:${ss}`;
}

function intervalsOf(run: GreedyResult): GreedyInterval[] {
  const events = run.events;
  if (events === undefined) throw new Error('pacing sim: run was not made with trackEvents');
  return [...events.faults, ...events.finds];
}

/** Purchase gaps from t = 0 to endT, with the era of each gap's start. */
function purchaseGapsTo(run: GreedyResult, endT: number): Gap[] {
  return purchaseGaps(run.purchases, endT, run.firstAt);
}

/** Event gaps to endT: no purchase and no fault or Find on screen. */
function eventGapsTo(run: GreedyResult, endT: number): Gap[] {
  return eventGaps(run.purchases, intervalsOf(run), endT, run.firstAt);
}

function firstBuyAt(run: GreedyResult, id: TechId): number {
  return run.purchases.find((p) => p.id === id)?.t ?? Infinity;
}

function statCells(gaps: readonly Gap[]): string[] {
  const s: GapStats = gapStats(gaps);
  const sum = gaps.reduce((acc, g) => acc + g.len, 0);
  return [String(s.n), formatMmSs(s.median), formatMmSs(s.p75), formatMmSs(s.p90), formatMmSs(s.max), formatMmSs(sum)];
}

/** Rows of one era table: era I-V and all, with gap count, median, p75, p90, max and sum. */
function eraRows(gaps: readonly Gap[]): string[][] {
  const rows = PRINT_ERAS.map((e) => [`${e}`, ...statCells(gaps.filter((g) => g.era === e))]);
  return [...rows, ['all', ...statCells(gaps)]];
}

function printTable(title: string, headers: readonly string[], rows: readonly (readonly string[])[]): void {
  console.info(
    [
      `### ${title}`,
      '',
      `| ${headers.join(' | ')} |`,
      `| ${headers.map(() => '---').join(' | ')} |`,
      ...rows.map((r) => `| ${r.join(' | ')} |`),
      '',
    ].join('\n'),
  );
}

afterAll(() => {
  if (!ready) return;
  const pfA = a.firstAt.primaryFunction;
  const pfW5 = w5.firstAt.primaryFunction;
  const subDemoA = demoA.firstAt[DEMO_CAP_TECH];
  const subDemoW5 = demoW5.firstAt[DEMO_CAP_TECH];
  const gapsA = purchaseGapsTo(a, pfA);
  const gapsW5 = purchaseGapsTo(w5, pfW5);
  const gapsDemoA = purchaseGapsTo(demoA, subDemoA);
  const gapsDemoW5 = purchaseGapsTo(demoW5, subDemoW5);
  const headline = (label: string, end: number, gaps: readonly Gap[], run: GreedyResult): string[] => {
    const s = gapStats(gaps);
    const finds = run.finds;
    return [
      label,
      formatMmSs(end),
      String(gaps.length),
      formatMmSs(s.median),
      formatMmSs(s.p90),
      formatMmSs(s.max),
      formatMmSs(eventGapsTo(run, end).reduce((m, g) => Math.max(m, g.len), 0)),
      String(gaps.filter((g) => g.len > 120).length),
      finds === undefined ? 'n/a' : `${finds.spawned} / ${finds.caught}`,
      String(run.purchases.filter((p) => p.t <= end).length),
    ];
  };
  printTable(
    'WP28 pacing headline (REC, multi-buy)',
    ['profile', 'to', 'gaps', 'median', 'p90', 'max', 'event max', 'gaps > 120 s', 'finds spawned / caught', 'buys'],
    [
      headline('A', pfA, gapsA, a),
      headline('W5 (B)', pfW5, gapsW5, w5),
      headline('demo A', subDemoA, gapsDemoA, demoA),
      headline('demo W5 (B)', subDemoW5, gapsDemoW5, demoW5),
    ],
  );
  const eraHeaders = ['era', 'gaps', 'median', 'p75', 'p90', 'max', 'sum'];
  printTable('A: purchase gaps per era (to primaryFunction)', eraHeaders, eraRows(gapsA));
  printTable('W5 (B): purchase gaps per era (to primaryFunction)', eraHeaders, eraRows(gapsW5));
  printTable('demo A: purchase gaps per era (to substationBlueprint)', eraHeaders, eraRows(gapsDemoA));
  printTable('demo W5 (B): purchase gaps per era (to substationBlueprint)', eraHeaders, eraRows(gapsDemoW5));
  const fa = w5.firstAt.finalAlignment;
  const w5Before = gapsW5.filter((g) => g.from < fa);
  const w5After = gapsW5.filter((g) => g.from >= fa);
  printTable(
    'W5 (B): max gap before and after finalAlignment (PC3), event gap with catch 0 (PC12)',
    ['finalAlignment', 'max gap starting before', 'max gap starting at or after', 'W5 event max (catch 0)'],
    [[formatMmSs(fa), formatMmSs(gapStats(w5Before).max), formatMmSs(gapStats(w5After).max), formatMmSs(eventGapsTo(w5, pfW5).reduce((m, g) => Math.max(m, g.len), 0))]],
  );
  const spliceRows = SPLICE_IDS.map((id) => {
    const avail = a.availableAt?.[id];
    const bought = firstBuyAt(a, id);
    return [id, `${TECHNOLOGIES[id].era}`, formatMmSs(avail ?? Infinity), formatMmSs(bought), formatMmSs(demoA.firstAt[id]), formatMmSs(bought - (avail ?? Infinity))];
  });
  printTable('Splices (A: available, bought, gap; demo A: bought)', ['id', 'era', 'A availableAt', 'A bought', 'demo A bought', 'A gap'], spliceRows);
  const f = a.finds;
  if (f !== undefined) {
    printTable(
      'A Finds (catch 0.85, 4 s): PC11',
      ['spawned', 'caught', 'caught / spawned', 'relics', 'first spawn'],
      [[String(f.spawned), String(f.caught), (f.caught / f.spawned).toFixed(2), String(f.relics), formatMmSs(f.firstSpawnAt ?? Infinity)]],
    );
  }
});

describe('pacing set REC (WP28): purchase gaps and event gaps', () => {
  const gapsA = (): Gap[] => purchaseGapsTo(a, a.firstAt.primaryFunction);
  const gapsW5 = (): Gap[] => purchaseGapsTo(w5, w5.firstAt.primaryFunction);
  const gapsDemoW5 = (): Gap[] => purchaseGapsTo(demoW5, demoW5.firstAt[DEMO_CAP_TECH]);

  it('PC1: A purchase gaps to primaryFunction: p90 <= 0:55 and max <= 2:15', () => {
    const s = gapStats(gapsA());
    expect(s.p90).toBeLessThanOrEqual(55);
    expect(s.max).toBeLessThanOrEqual(135);
  });

  it('PC2: W5 (B) p90 gap to primaryFunction <= 1:09 (at least 40 % below v0.11.0 1:56)', () => {
    expect(gapStats(gapsW5()).p90).toBeLessThanOrEqual(69);
  });

  it('PC3: W5 max gap starting before finalAlignment <= 3:15 (the gap after is reported above)', () => {
    const fa = w5.firstAt.finalAlignment;
    const before = gapsW5().filter((g) => g.from < fa);
    expect(gapStats(before).max).toBeLessThanOrEqual(195);
  });

  it('PC4: A event gap (purchases, faults and Finds on screen) <= 1:45', () => {
    const longest = eventGapsTo(a, a.firstAt.primaryFunction).reduce((m, g) => Math.max(m, g.len), 0);
    expect(longest).toBeLessThanOrEqual(105);
  });

  it('PC5: demo A p90 gap to substationBlueprint <= 0:50 (the max is reported above)', () => {
    expect(gapStats(purchaseGapsTo(demoA, demoA.firstAt[DEMO_CAP_TECH])).p90).toBeLessThanOrEqual(50);
  });

  it('PC6: W5 (B) primaryFunction / A primaryFunction in [1.20, 1.60]', () => {
    const ratio = w5.firstAt.primaryFunction / a.firstAt.primaryFunction;
    expect(ratio).toBeGreaterThanOrEqual(1.2);
    expect(ratio).toBeLessThanOrEqual(1.6);
  });

  it('PC7: A primaryFunction / 250:09 in [0.90, 1.10]', () => {
    const ratio = a.firstAt.primaryFunction / REF_A_PF_S;
    expect(ratio).toBeGreaterThanOrEqual(0.9);
    expect(ratio).toBeLessThanOrEqual(1.1);
  });

  it('PC8: demo A substationBlueprint / 60:50 in [0.85, 1.15]', () => {
    const ratio = demoA.firstAt[DEMO_CAP_TECH] / REF_DEMO_A_SUBSTATION_S;
    expect(ratio).toBeGreaterThanOrEqual(0.85);
    expect(ratio).toBeLessThanOrEqual(1.15);
  });

  it(`PC9: A buys each of the ${SPLICE_COUNT} Splices within 180 s of its availableAt`, () => {
    expect(SPLICE_IDS).toHaveLength(SPLICE_COUNT);
    const late = SPLICE_IDS.filter((id) => {
      const avail = a.availableAt?.[id];
      return avail === undefined || !(firstBuyAt(a, id) - avail <= 180);
    });
    expect(late).toEqual([]);
  });

  it(`PC10: demo A owns the ${ERA_I_II_SPLICE_COUNT} era I-II Splices at the substation (${ERA_I_II_SPLICE_COUNT} / ${ERA_I_II_SPLICE_COUNT})`, () => {
    expect(ERA_I_II_SPLICE_IDS).toHaveLength(ERA_I_II_SPLICE_COUNT);
    const sub = demoA.firstAt[DEMO_CAP_TECH];
    const owned = ERA_I_II_SPLICE_IDS.filter((id) => demoA.firstAt[id] <= sub);
    expect(owned).toHaveLength(ERA_I_II_SPLICE_COUNT);
  });

  it('PC11: A Finds: spawned >= 150, caught / spawned >= 0.75, first spawn >= 120 s', () => {
    const f = a.finds;
    if (f === undefined) throw new Error('pacing sim: A ran without finds');
    expect(f.spawned).toBeGreaterThanOrEqual(150);
    expect(f.caught / f.spawned).toBeGreaterThanOrEqual(0.75);
    expect(f.firstSpawnAt ?? 0).toBeGreaterThanOrEqual(120);
  });

  it('PC13: demo W5 (B) p90 gap to substationBlueprint <= 1:10 and max <= 2:45', () => {
    const s = gapStats(gapsDemoW5());
    expect(s.p90).toBeLessThanOrEqual(70);
    expect(s.max).toBeLessThanOrEqual(165);
  });
});

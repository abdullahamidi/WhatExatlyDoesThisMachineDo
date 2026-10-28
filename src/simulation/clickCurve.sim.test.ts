import { beforeAll, describe, expect, it } from 'vitest';
import { EDITIONS } from '../data/edition';
import type { EraNumber } from '../data/eras';
import { TECHNOLOGIES } from '../data/technologies';
import { RESOURCE_IDS } from '../data/types';
import type { GameState, ResourceId, TechId } from '../data/types';
import { computeRates } from './production/rates';
import { windupParams } from './production/windup';
import { eraResource } from './progression/era';
import { activeShare, manualShare, runGreedy } from './sim/greedy';
import type { GreedyFaults, GreedyOptions, GreedyResult, GreedySample, IncomeSplit } from './sim/greedy';

// WP27 click curve (playtest 2026-10-27). Deterministic greedy players on the repo harness, asserted against the WP27
// "Balance targets" K1-K12: the hand phase (K1-K3), hand + machine (K4-K5), the machine eras (K6), the whole run (K7-K9),
// ME click parity (K10, D2), the wind-up (K11, D4) and Machine Faults (K12, D3). K13 and the A0 / A2 / A1 / R15 runs are
// report only. Profiles are literals (no import from other test files). One run per profile in beforeAll; the tests only
// assert, and the tables are printed (console.info). No randomness, no rendering. The file clock is the only clock use.
// Re-run: npx vitest run src/simulation/clickCurve.sim.test.ts --maxWorkers=1

const MINUTE = 60; // seconds per minute (the plan writes its gate times as mm:ss)
/** mm:ss as seconds. */
const mmss = (mm: number, ss: number): number => mm * MINUTE + ss;
// The whole file (all runs, measures and tables) gets 40 s at --maxWorkers=1.
const FILE_BUDGET_MS = 40000;
const SIM_TIMEOUT_MS = 120000;
// Every run stops early through stopAt, so this only bounds a run that never owns its stop tech.
const RUN_SECONDS = 36000;
const SAMPLE_EVERY_S = 10;
// Profile A clicks at 4 cps: the reference rate of the K2 share formula.
const A_CPS = 4;
// Machine Faults of profile A: every spawn is caught, 2 s after it appears.
const A_FAULTS: GreedyFaults = { catchProb: 1, reactionSeconds: 2 };
// W5 clicks for 5 minutes, then 0.5 cps, and never catches a fault.
const W5_CLICK_END_S = 300;
const W5_LATE_CPS = 0.5;
// The machine eras (K6): their frontier energies are read from the era table, not typed here.
const MACHINE_ERAS = [3, 4, 5] as const;
const ERAS: readonly EraNumber[] = [1, 2, 3, 4, 5];
// The energies the ME parity check compares against (K10, D2). ME itself is the numerator.
const PARITY_RES: readonly ResourceId[] = ['ee', 'pr', 'rs', 'xf'];
// A's snapshots: the wind-up cap and the rested worth are read at the wornMotor buy (K1) and at primaryFunction (K11).
const SNAPSHOTS: readonly TechId[] = ['wornMotor', 'primaryFunction'];

/** Demo era cap from the edition data (never retyped here). A null cap would mean the edition is not the demo. */
function demoMaxEra(): number {
  const maxEra = EDITIONS.demo.maxEra;
  if (maxEra === null) throw new Error('demo edition has no maxEra');
  return maxEra;
}
const DEMO_MAX_ERA = demoMaxEra();

// Profiles (WP27 "Balance targets"). Every run samples every 10 s and tracks income (bookkeeping only: the run is unchanged).
const A_OPTIONS: GreedyOptions = {
  seconds: RUN_SECONDS,
  clicksPerSecond: 4,
  stepSeconds: 1,
  buyIntervalSeconds: 1,
  stopAt: 'primaryFunction',
  trackIncome: true,
  sampleEverySeconds: SAMPLE_EVERY_S,
  snapshotAt: SNAPSHOTS,
  faults: A_FAULTS,
};
const W5_OPTIONS: GreedyOptions = {
  seconds: RUN_SECONDS,
  clicksPerSecond: 4, // required by GreedyOptions; unused while clickRate is set
  clickRate: (_state, t) => (t <= W5_CLICK_END_S ? A_CPS : W5_LATE_CPS),
  stepSeconds: 1,
  buyIntervalSeconds: 1,
  stopAt: 'primaryFunction',
  trackIncome: true,
  sampleEverySeconds: SAMPLE_EVERY_S,
};
const DEMO_A_OPTIONS: GreedyOptions = {
  seconds: RUN_SECONDS,
  clicksPerSecond: 4,
  stepSeconds: 1,
  buyIntervalSeconds: 1,
  stopAt: 'substationBlueprint',
  trackIncome: true,
  sampleEverySeconds: SAMPLE_EVERY_S,
  snapshotAt: SNAPSHOTS,
  faults: A_FAULTS,
  maxEra: DEMO_MAX_ERA,
};
// Report only (no assertion): A without faults, A at 2 cps and 1 cps with faults, and a 15 cps keyboard player with faults.
const A0_OPTIONS: GreedyOptions = {
  seconds: RUN_SECONDS,
  clicksPerSecond: 4,
  stepSeconds: 1,
  buyIntervalSeconds: 1,
  stopAt: 'primaryFunction',
};
const A2_OPTIONS: GreedyOptions = {
  seconds: RUN_SECONDS,
  clicksPerSecond: 2,
  stepSeconds: 1,
  buyIntervalSeconds: 1,
  stopAt: 'primaryFunction',
  faults: A_FAULTS,
};
const A1_OPTIONS: GreedyOptions = {
  seconds: RUN_SECONDS,
  clicksPerSecond: 1,
  stepSeconds: 1,
  buyIntervalSeconds: 1,
  stopAt: 'primaryFunction',
  faults: A_FAULTS,
};
const R15_OPTIONS: GreedyOptions = {
  seconds: RUN_SECONDS,
  clicksPerSecond: 15,
  stepSeconds: 1,
  buyIntervalSeconds: 1,
  stopAt: 'primaryFunction',
  faults: A_FAULTS,
};

type KGroup = 'hand' | 'handMachine' | 'machine' | 'whole' | 'parity' | 'windup' | 'faults';
/** num = 3 decimals, time = seconds with mm:ss, count = whole number. */
type KUnit = 'num' | 'time' | 'count';
/** One asserted K row. lo / hi are the test targets (limits, not game balance); target is the printed text. */
interface KDef {
  id: string;
  group: KGroup;
  label: string;
  unit: KUnit;
  lo: number;
  hi: number;
  target: string;
}
/** One report-only row (no assertion). */
interface KReport {
  id: string;
  label: string;
  target: string;
}
interface GateToday {
  id: TechId;
  label: string;
  /** The v0.10.1 gate time in seconds (plan: 22:07, 61:03, 110:41, 167:16, 250:11). */
  today: number;
}
interface Shares {
  total: number;
  plain: number;
  windup: number;
  passive: number;
  fault: number;
  active: number;
}
interface ParityCheck {
  comparisons: number;
  failures: number;
}
/** Anything with per-click and per-second rates (a sample or a computeRates result). */
type Rates = Pick<GreedySample, 'perClick' | 'perSecond'>;

const GATE_TODAY: readonly GateToday[] = [
  { id: 'generatorBlueprint', label: 'blueprint (era I)', today: mmss(22, 7) },
  { id: 'substationBlueprint', label: 'substation (era II)', today: mmss(61, 3) },
  { id: 'pressureVesselBlueprint', label: 'vessel (era III)', today: mmss(110, 41) },
  { id: 'harmonicConvergence', label: 'convergence (era IV)', today: mmss(167, 16) },
  { id: 'primaryFunction', label: 'primaryFunction (era V)', today: mmss(250, 11) },
];

// Plan values (printed in the target column only; the test limits come from the bounds above).
const PLAN_K6: Record<(typeof MACHINE_ERAS)[number], { plain: string; active: string }> = {
  3: { plain: '0.21', active: '0.38' },
  4: { plain: '0.20', active: '0.40' },
  5: { plain: '0.19', active: '0.44' },
};

const K_DEFS: readonly KDef[] = [
  { id: 'K1', group: 'hand', label: 'Worn Motor worth at its buy (s of output per click)', unit: 'num', lo: 0.5, hi: 1, target: '0.5-1.0 (plan 0.67)' },
  { id: 'K2a', group: 'hand', label: 'ME click share, min over samples t <= 120 s', unit: 'num', lo: 0.75, hi: 1, target: '>= 0.75 (plan 0.765)' },
  { id: 'K2b', group: 'hand', label: 'ME click share, min over samples t <= 240 s', unit: 'num', lo: 0.5, hi: 1, target: '>= 0.50 (plan 0.73)' },
  { id: 'K3', group: 'hand', label: 'crossover: ME passive >= 4 x ME per click', unit: 'time', lo: 240, hi: 480, target: '240-480 s (plan 410 s)' },
  { id: 'K4a', group: 'handMachine', label: 'ME click share, K3 to end of era I', unit: 'num', lo: 0.3, hi: 0.5, target: '0.30-0.50 (plan 0.41)' },
  { id: 'K4b', group: 'handMachine', label: 'EE click share, all of era II', unit: 'num', lo: 0.3, hi: 0.5, target: '0.30-0.50 (plan 0.32)' },
  { id: 'K5', group: 'handMachine', label: 'rested worth, min from K3 to the boiler buy (s)', unit: 'num', lo: 0.5, hi: Infinity, target: '>= 0.5 (plan 0.59)' },
  ...MACHINE_ERAS.flatMap((era): KDef[] => {
    const res = eraResource(era);
    return [
      { id: `K6p${era}`, group: 'machine', label: `era ${era} (${res}): plain click share`, unit: 'num', lo: 0.1, hi: 0.25, target: `0.10-0.25 (plan ${PLAN_K6[era].plain})` },
      { id: `K6a${era}`, group: 'machine', label: `era ${era} (${res}): active share (clicks + faults)`, unit: 'num', lo: 0.35, hi: 1, target: `>= 0.35 (plan ${PLAN_K6[era].active})` },
    ];
  }),
  { id: 'K7', group: 'whole', label: 'W5 primaryFunction / A primaryFunction', unit: 'num', lo: 1.2, hi: 1.6, target: '1.20-1.60 (plan 1.451)' },
  ...GATE_TODAY.map((g): KDef => ({
    id: `K8.${g.id}`,
    group: 'whole',
    label: `${g.label}: A / today`,
    unit: 'num',
    lo: 0.9,
    hi: 1.1,
    target: '0.90-1.10 (plan ~1.00)',
  })),
  { id: 'K9', group: 'whole', label: 'demo A substationBlueprint (maxEra of the demo edition)', unit: 'time', lo: mmss(51, 53), hi: mmss(70, 12), target: '51:53-70:12 (plan 60:50)' },
  { id: 'K10a', group: 'parity', label: 'ME parity failures from the first Gear Ratio on', unit: 'count', lo: 0, hi: 0, target: '0 failures' },
  { id: 'K10b', group: 'parity', label: 'ME parity comparisons made (not vacuous)', unit: 'count', lo: 1000, hi: Infinity, target: '>= 1000' },
  { id: 'K11a', group: 'windup', label: 'wind-up cap at primaryFunction (s)', unit: 'num', lo: 2, hi: Infinity, target: '>= 2.0 (plan 2.08)' },
  { id: 'K11b', group: 'windup', label: 'rested worth at primaryFunction, min over energies with passive (s)', unit: 'num', lo: 2, hi: Infinity, target: '>= 2.0 (plan 2.08)' },
  { id: 'K12a', group: 'faults', label: 'faults spawned minus caught', unit: 'count', lo: 0, hi: 0, target: '0 (spawned = caught)' },
  { id: 'K12b', group: 'faults', label: 'faults spawned', unit: 'count', lo: 100, hi: Infinity, target: '>= 100 (plan 119)' },
  { id: 'K12c', group: 'faults', label: 'first spawn (active t)', unit: 'time', lo: 180, hi: Infinity, target: '>= 180 s (plan 549 s)' },
  { id: 'K12d', group: 'faults', label: 'first spawn minus the first faultLamp buy', unit: 'time', lo: 91, hi: 181, target: '91-181 s (plan 128 s: buy 421, spawn 549)' },
];

const K13_DEFS: readonly KReport[] = [
  { id: 'K13a', label: 'A without faults: primaryFunction / A primaryFunction', target: 'plan 1.111' },
  { id: 'K13b', label: 'A at 2 cps with faults: primaryFunction / A primaryFunction', target: 'plan 1.148' },
  { id: 'K13c', label: 'A at 1 cps with faults: primaryFunction / A primaryFunction', target: 'plan 1.250' },
  { id: 'K13d', label: 'R15 (15 cps) with faults: primaryFunction / A primaryFunction', target: 'plan 0.607' },
];

const GROUPS: readonly { group: KGroup; title: string }[] = [
  { group: 'hand', title: 'click curve: hand phase (K1-K3)' },
  { group: 'handMachine', title: 'click curve: hand + machine (K4-K5)' },
  { group: 'machine', title: 'click curve: machine eras III-V (K6)' },
  { group: 'whole', title: 'click curve: whole run (K7-K9)' },
  { group: 'parity', title: 'click curve: ME click parity (K10, D2)' },
  { group: 'windup', title: 'click curve: wind-up (K11, D4)' },
  { group: 'faults', title: 'click curve: Machine Faults (K12, D3)' },
];

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

function pass(ok: boolean): string {
  return ok ? 'PASS' : 'FAIL';
}
function ratio3(r: number): string {
  return Number.isFinite(r) ? r.toFixed(3) : 'n/a';
}
function percent(share: number): string {
  return Number.isFinite(share) ? `${(share * 100).toFixed(1)} %` : 'n/a';
}
function fmtValue(v: number, unit: KUnit): string {
  if (Number.isNaN(v)) return 'n/a';
  if (!Number.isFinite(v)) return 'never';
  if (unit === 'num') return v.toFixed(3);
  if (unit === 'time') return `${v.toFixed(0)} s (${formatMmSs(v)})`;
  return String(v);
}

/** a / b for two finite times or values with b > 0; NaN otherwise (so the bound check fails). */
function ratioOf(a: number, b: number): number {
  return Number.isFinite(a) && Number.isFinite(b) && b > 0 ? a / b : NaN;
}

/** Minimum of a list; an empty list or any NaN gives NaN (so the bound check fails). */
function minOf(values: readonly number[]): number {
  if (values.length === 0 || values.some((v) => Number.isNaN(v))) return NaN;
  return Math.min(...values);
}

/** Instantaneous ME click share of one sample at A's click rate (K2): A_CPS x perClick / (A_CPS x perClick + perSecond). */
function instantMeShare(s: GreedySample): number {
  const clicks = A_CPS * s.perClick.me;
  const total = clicks + s.perSecond.me;
  return total > 0 ? clicks / total : NaN;
}

/**
 * Rested worth (K5, K11): seconds of output one click is worth with the wind-up store full,
 * (perClick + cap x perSecond) / perSecond. NaN when the energy has no passive income.
 */
function restedWorth(rates: Rates, cap: number, res: ResourceId): number {
  const ps = rates.perSecond[res];
  return ps > 0 ? (rates.perClick[res] + cap * ps) / ps : NaN;
}

/** K4a: manual share of `res` between two cumulative income copies (the later one minus the earlier one). */
function windowManualShare(later: IncomeSplit, earlier: IncomeSplit, res: ResourceId): number {
  const manual = later.manual[res] - earlier.manual[res];
  const total = manual + (later.passive[res] - earlier.passive[res]) + (later.fault[res] - earlier.fault[res]);
  return Number.isFinite(total) && total > 0 ? manual / total : NaN;
}

/**
 * Shares of one energy's lifetime income in one era (manual + passive + fault = total). Plain clicks are manual minus
 * the wind-up release; the wind-up release is its own share; active is clicks plus faults (K6).
 */
function sharesOf(split: IncomeSplit, res: ResourceId): Shares {
  const manual = split.manual[res];
  const total = manual + split.passive[res] + split.fault[res];
  const share = (x: number): number => (Number.isFinite(total) && total > 0 ? x / total : NaN);
  return {
    total,
    plain: share(manual - split.release[res]),
    windup: share(split.release[res]),
    passive: share(split.passive[res]),
    fault: share(split.fault[res]),
    active: share(manual + split.fault[res]),
  };
}

/**
 * K10 (D2): from the first Gear Ratio on, every sample has ME worth (perClick / perSecond) at least the worth of each
 * PARITY_RES energy with passive income, with a 1e-9 tolerance. A NaN ratio counts as a failure (the negated form).
 */
function parityCheck(run: GreedyResult): ParityCheck {
  const from = run.firstAt.gearRatio;
  let comparisons = 0;
  let failures = 0;
  for (const s of samplesOf(run)) {
    if (s.t < from || !(s.perClick.me > 0 && s.perSecond.me > 0)) continue;
    const meWorth = s.perClick.me / s.perSecond.me;
    for (const res of PARITY_RES) {
      if (!(s.perClick[res] > 0 && s.perSecond[res] > 0)) continue;
      comparisons += 1;
      if (!(meWorth >= (s.perClick[res] / s.perSecond[res]) * (1 - 1e-9))) failures += 1;
    }
  }
  return { comparisons, failures };
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
  if (run.income === undefined) throw new Error('the run did not track income');
  return run.income;
}

/** Samples of a run that sampled; a missing list is a setup error (the test fails). */
function samplesOf(run: GreedyResult): GreedySample[] {
  if (run.samples === undefined) throw new Error('the run did not take samples');
  return run.samples;
}

function inBounds(v: number, def: KDef): boolean {
  return !Number.isNaN(v) && v >= def.lo && v <= def.hi;
}

// K values, keyed by the K id. Filled once in beforeAll; the tests and the table read them through kOf.
const kValues = new Map<string, number>();
function setK(id: string, value: number): void {
  kValues.set(id, value);
}
function kOf(id: string): number {
  const v = kValues.get(id);
  if (v === undefined) throw new Error(`K ${id} was not measured`);
  return v;
}
function verdictOf(id: string): string {
  const def = K_DEFS.find((d) => d.id === id);
  if (def === undefined) return 'report';
  return pass(inBounds(kOf(id), def));
}

let a: GreedyResult;
let w5: GreedyResult;
let demoA: GreedyResult;
let a0: GreedyResult;
let a2: GreedyResult;
let a1: GreedyResult;
let r15: GreedyResult;
let fileMs = 0;

function measureK(): void {
  const samples = samplesOf(a);
  const income = incomeOf(a);

  // K1: Worn Motor worth at its buy, from the rates of the wornMotor snapshot.
  const worn = computeRates(snapshotOf(a, 'wornMotor'), TECHNOLOGIES);
  setK('K1', ratioOf(worn.perSecond.me, worn.perClick.me));

  // K2: the instantaneous ME click share, minimum over the samples up to 120 s and up to 240 s.
  const shareUpTo = (limitS: number): number[] => samples.filter((s) => s.t <= limitS).map(instantMeShare);
  setK('K2a', minOf(shareUpTo(120)));
  setK('K2b', minOf(shareUpTo(240)));

  // K3: the crossover, the first sample from 20 s on where ME per second reaches A_CPS x ME per click.
  const cross = samples.find((s) => s.t >= 20 && s.perSecond.me >= A_CPS * s.perClick.me);
  setK('K3', cross === undefined ? Infinity : cross.t);

  // K4a: ME click share from the crossover sample to the end of era I (cumulative income, difference of the two).
  // K4b: EE click share over all of era II.
  const atCross = cross?.income?.[1];
  setK('K4a', atCross === undefined ? NaN : windowManualShare(income[1], atCross, 'me'));
  setK('K4b', manualShare(income, 2, 'ee'));

  // K5: rested worth from the crossover to the first boiler buy (end of era II), min over energies with passive income.
  const restedFrom = cross?.t ?? Infinity;
  const restedTo = a.firstAt.boiler;
  const rested: number[] = [];
  for (const s of samples) {
    if (s.t < restedFrom || s.t > restedTo) continue;
    for (const res of RESOURCE_IDS) {
      if (s.perSecond[res] > 0) rested.push(restedWorth(s, s.windupCap, res));
    }
  }
  setK('K5', minOf(rested));

  // K6: the machine eras (III-V): plain click share and active share of the frontier energy of each era.
  for (const era of MACHINE_ERAS) {
    const res = eraResource(era);
    setK(`K6p${era}`, sharesOf(income[era], res).plain);
    setK(`K6a${era}`, activeShare(income, era, res));
  }

  // K7: W5 against A at primaryFunction.
  setK('K7', ratioOf(w5.firstAt.primaryFunction, a.firstAt.primaryFunction));

  // K8: A's gate times against today's (the ratio is A / today).
  for (const g of GATE_TODAY) {
    setK(`K8.${g.id}`, ratioOf(a.firstAt[g.id], g.today));
  }

  // K9: the demo edition's substation buy time under profile A.
  setK('K9', demoA.firstAt.substationBlueprint);

  // K10 (D2): ME click parity over the whole A run from the first Gear Ratio on.
  const parity = parityCheck(a);
  setK('K10a', parity.failures);
  setK('K10b', parity.comparisons);

  // K11 (D4): wind-up cap and rested worth at the primaryFunction snapshot.
  const pfState = snapshotOf(a, 'primaryFunction');
  const pfRates = computeRates(pfState, TECHNOLOGIES);
  const pfCap = windupParams(pfState.techLevels, TECHNOLOGIES).cap;
  setK('K11a', pfCap);
  setK('K11b', minOf(RESOURCE_IDS.filter((res) => pfRates.perSecond[res] > 0).map((res) => restedWorth(pfRates, pfCap, res))));

  // K12 (D3): Machine Faults of profile A. The first faultLamp buy is the arming reference.
  const faults = a.faults;
  if (faults === undefined) throw new Error('profile A did not run the fault process');
  const faultLampBuy = nthBuyAt(a, 'faultLamp', 1);
  setK('K12a', faults.spawned - faults.caught);
  setK('K12b', faults.spawned);
  setK('K12c', faults.firstSpawnAt ?? NaN);
  setK('K12d', faults.firstSpawnAt === null ? NaN : faults.firstSpawnAt - faultLampBuy);

  // K13 (report only): primaryFunction against A's, for the no-fault, 2 cps, 1 cps and 15 cps players.
  const pfA = a.firstAt.primaryFunction;
  setK('K13a', ratioOf(a0.firstAt.primaryFunction, pfA));
  setK('K13b', ratioOf(a2.firstAt.primaryFunction, pfA));
  setK('K13c', ratioOf(a1.firstAt.primaryFunction, pfA));
  setK('K13d', ratioOf(r15.firstAt.primaryFunction, pfA));
}

function printTables(): void {
  console.info(
    mdTable(
      'K table (WP27 click curve: value, target, verdict; K13 is report only)',
      ['id', 'check', 'value', 'target', 'verdict'],
      [
        ...K_DEFS.map((d) => [d.id, d.label, fmtValue(kOf(d.id), d.unit), d.target, verdictOf(d.id)]),
        ...K13_DEFS.map((d) => [d.id, d.label, ratio3(kOf(d.id)), d.target, 'report']),
      ],
    ),
  );
  console.info(
    mdTable(
      'Era gates, profile A and W5 (active seconds; ratio = A / today)',
      ['gate', 'A (mm:ss)', 'W5 (mm:ss)', 'today (mm:ss)', 'A / today', 'check'],
      GATE_TODAY.map((g) => [
        g.label,
        formatMmSs(a.firstAt[g.id]),
        formatMmSs(w5.firstAt[g.id]),
        formatMmSs(g.today),
        ratio3(kOf(`K8.${g.id}`)),
        verdictOf(`K8.${g.id}`),
      ]),
    ),
  );
  const incomeA = incomeOf(a);
  console.info(
    mdTable(
      'Income shares per era, profile A (share of the frontier energy income in that era; passive includes the auto-cranks, the harness has no servo-free split)',
      ['era', 'energy', 'plain clicks', 'wind-up', 'passive', 'fault', 'active (clicks + fault)', 'total gained'],
      ERAS.map((era) => {
        const res = eraResource(era);
        const s = sharesOf(incomeA[era], res);
        return [`${era}`, res, percent(s.plain), percent(s.windup), percent(s.passive), percent(s.fault), percent(s.active), s.total.toExponential(2)];
      }),
    ),
  );
  console.info(
    mdTable(
      'Machine Faults of profile A (counts; the first faultLamp buy is the arming reference)',
      ['spawned', 'caught', 'missed', 'first spawn (mm:ss)', 'first faultLamp buy (mm:ss)'],
      [
        [
          `${a.faults?.spawned ?? 'n/a'}`,
          `${a.faults?.caught ?? 'n/a'}`,
          `${a.faults?.missed ?? 'n/a'}`,
          formatMmSs(a.faults?.firstSpawnAt ?? NaN),
          formatMmSs(nthBuyAt(a, 'faultLamp', 1)),
        ],
      ],
    ),
  );
  console.info(
    mdTable(
      'File run time (greedy runs and tables, beforeAll)',
      ['measured (ms)', 'budget (ms)', 'check'],
      [[String(fileMs), String(FILE_BUDGET_MS), pass(fileMs < FILE_BUDGET_MS)]],
    ),
  );
}

beforeAll(() => {
  const start = Date.now();
  a = runGreedy(A_OPTIONS);
  w5 = runGreedy(W5_OPTIONS);
  demoA = runGreedy(DEMO_A_OPTIONS);
  a0 = runGreedy(A0_OPTIONS);
  a2 = runGreedy(A2_OPTIONS);
  a1 = runGreedy(A1_OPTIONS);
  r15 = runGreedy(R15_OPTIONS);
  measureK();
  fileMs = Date.now() - start;
  printTables();
}, SIM_TIMEOUT_MS);

for (const { group, title } of GROUPS) {
  describe(title, () => {
    for (const def of K_DEFS.filter((d) => d.group === group)) {
      it(`${def.id}: ${def.label} within [${def.lo}, ${def.hi}]`, () => {
        const v = kOf(def.id);
        expect(Number.isNaN(v)).toBe(false);
        expect(v).toBeGreaterThanOrEqual(def.lo);
        expect(v).toBeLessThanOrEqual(def.hi);
      });
    }
  });
}

describe('click curve: file budget', () => {
  it('the click curve file runs within its 40 s budget', () => {
    expect(fileMs).toBeLessThan(FILE_BUDGET_MS);
  });
});

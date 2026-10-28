import { beforeAll, describe, expect, it } from 'vitest';
import { EDITIONS } from '../data/edition';
import { PART_TIERS } from '../data/machineTiers';
import type { PartTierTrack } from '../data/machineTiers';
import { TECHNOLOGIES } from '../data/technologies';
import type { TechId } from '../data/types';
import { runGreedy } from './sim/greedy';
import type { GreedyOptions, GreedyResult } from './sim/greedy';

// WP22 A2 tier reach guard. Deterministic greedy players must reach the top tier of every part track (PART_TIERS)
// before primaryFunction: profiles A, B, C (full game). The demo edition (era cap read from EDITIONS.demo) must reach
// MK III on every era I-II track and MK V on motorTuning. gearRatio reaches MK II within 6 minutes (A, B, C).
// Profiles are copied from signoff.sim.test.ts, faults included (WP27). A failing claim is a balance finding: do not edit thresholds here.
// One markdown table is printed via console.info. The wall-time check is the only clock use.
// Re-run: npx vitest run src/simulation/machineTiers.sim.test.ts

// 30 s: the signoff file budget. Setup runs seven greedy games; 60 s is the generous setup timeout.
const FILE_BUDGET_MS = 30000;
const SETUP_TIMEOUT_MS = 60000;

// A = 4 clicks/s, buys every second. B = 4 clicks/s, buys every 30 s. C = 1 click/s, buys every 30 s, no offline.
// `faults` = the Machine Faults catch model of each player (WP27), as signoff.sim.test.ts: the tier numbers were measured with it.
type Profile = Pick<GreedyOptions, 'seconds' | 'clicksPerSecond' | 'stepSeconds' | 'buyIntervalSeconds' | 'faults'>;
const PROFILE_A: Profile = { seconds: 17400, clicksPerSecond: 4, stepSeconds: 1, buyIntervalSeconds: 1, faults: { catchProb: 1, reactionSeconds: 2 } };
const PROFILE_B: Profile = { seconds: 18000, clicksPerSecond: 4, stepSeconds: 1, buyIntervalSeconds: 30, faults: { catchProb: 1, reactionSeconds: 3 } };
const PROFILE_C: Profile = { seconds: 28800, clicksPerSecond: 1, stepSeconds: 1, buyIntervalSeconds: 30, faults: { catchProb: 0.5, reactionSeconds: 4 } };

const DEMO_A_SECONDS = 5500;
const DEMO_B_SECONDS = 6200;
const EARLY_SECONDS = 360; // six minutes of active play

// The demo era cap comes from the edition, never retyped here (as demoCap.sim.test.ts does).
function demoValue<T>(value: T | null, what: string): T {
  if (value === null) throw new Error(`demo edition has no ${what}`);
  return value;
}
const DEMO_MAX_ERA: number = demoValue(EDITIONS.demo.maxEra, 'maxEra');

/** The era I-II tracks: the demo edition can buy them all. */
const DEMO_TRACKS = PART_TIERS.filter((t) => TECHNOLOGIES[t.techId].era <= DEMO_MAX_ERA);

/** Level at which tier `tier` (1-based, MK I = 1) starts. Throws when the track has no such tier. */
function tierStart(track: PartTierTrack, tier: number): number {
  const level = track.levels[tier - 1];
  if (level === undefined) throw new Error(`${track.techId} has no tier ${tier}`);
  return level;
}

function trackOf(techId: TechId): PartTierTrack {
  const track = PART_TIERS.find((t) => t.techId === techId);
  if (track === undefined) throw new Error(`no part track for ${techId}`);
  return track;
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

let fullA: GreedyResult;
let fullB: GreedyResult;
let fullC: GreedyResult;
let demoA: GreedyResult;
let demoB: GreedyResult;
let earlyA: GreedyResult;
let earlyB: GreedyResult;
let earlyC: GreedyResult;
let fileMs = 0;

beforeAll(() => {
  const start = Date.now();
  fullA = runGreedy({ ...PROFILE_A, stopAt: 'primaryFunction' });
  fullB = runGreedy({ ...PROFILE_B, stopAt: 'primaryFunction' });
  fullC = runGreedy({ ...PROFILE_C, stopAt: 'primaryFunction' });
  demoA = runGreedy({ ...PROFILE_A, seconds: DEMO_A_SECONDS, maxEra: DEMO_MAX_ERA });
  demoB = runGreedy({ ...PROFILE_B, seconds: DEMO_B_SECONDS, maxEra: DEMO_MAX_ERA });
  earlyA = runGreedy({ ...PROFILE_A, seconds: EARLY_SECONDS });
  earlyB = runGreedy({ ...PROFILE_B, seconds: EARLY_SECONDS });
  earlyC = runGreedy({ ...PROFILE_C, seconds: EARLY_SECONDS });
  fileMs = Date.now() - start;

  const rows = PART_TIERS.map((track) => {
    const id = track.techId;
    return [
      id,
      track.levels.join('/'),
      `${fullA.final.techLevels[id]} / ${fullB.final.techLevels[id]} / ${fullC.final.techLevels[id]}`,
      `${demoA.final.techLevels[id]} / ${demoB.final.techLevels[id]}`,
    ];
  });
  const pf = `primaryFunction A ${formatMmSs(fullA.firstAt.primaryFunction)}, B ${formatMmSs(fullB.firstAt.primaryFunction)}, C ${formatMmSs(fullC.firstAt.primaryFunction)}`;
  console.info(
    mdTable(
      `Part tier reach (${pf}; demo A ${DEMO_A_SECONDS} s, demo B ${DEMO_B_SECONDS} s)`,
      ['track', 'levels', 'final level A / B / C', 'demo A / B'],
      rows,
    ),
  );
}, SETUP_TIMEOUT_MS);

const FULL_RUNS: ReadonlyArray<readonly [string, () => GreedyResult]> = [
  ['A', () => fullA],
  ['B', () => fullB],
  ['C', () => fullC],
];
const DEMO_RUNS: ReadonlyArray<readonly [string, () => GreedyResult]> = [
  ['A', () => demoA],
  ['B', () => demoB],
];
const EARLY_RUNS: ReadonlyArray<readonly [string, () => GreedyResult]> = [
  ['A', () => earlyA],
  ['B', () => earlyB],
  ['C', () => earlyC],
];

describe('A2 full game: every part track reaches its top tier before primaryFunction', () => {
  for (const [name, run] of FULL_RUNS) {
    describe(`profile ${name}`, () => {
      it('reaches primaryFunction (the tier check ends there)', () => {
        expect(Number.isFinite(run().firstAt.primaryFunction)).toBe(true);
      });

      for (const track of PART_TIERS) {
        const top = tierStart(track, track.levels.length);
        it(`${track.techId} reaches its top tier (level ${top})`, () => {
          expect(run().final.techLevels[track.techId]).toBeGreaterThanOrEqual(top);
        });
      }
    });
  }
});

describe('A2 demo edition: MK III on every era I-II track, MK V on motor tuning', () => {
  it('the demo edition has era I-II tracks to check', () => {
    expect(DEMO_TRACKS.length).toBeGreaterThan(0);
  });

  for (const [name, run] of DEMO_RUNS) {
    describe(`demo ${name}`, () => {
      for (const track of DEMO_TRACKS) {
        const mk3 = tierStart(track, 3);
        it(`${track.techId} reaches MK III (level ${mk3})`, () => {
          expect(run().final.techLevels[track.techId]).toBeGreaterThanOrEqual(mk3);
        });
      }

      const motor = trackOf('motorTuning');
      const mk5 = tierStart(motor, 5);
      it(`motorTuning reaches MK V (level ${mk5})`, () => {
        expect(run().final.techLevels.motorTuning).toBeGreaterThanOrEqual(mk5);
      });
    });
  }
});

describe('A2 gearRatio: MK II within 6 minutes (A, B, C)', () => {
  const gear = trackOf('gearRatio');
  const mk2 = tierStart(gear, 2);
  for (const [name, run] of EARLY_RUNS) {
    it(`profile ${name}: gearRatio reaches MK II (level ${mk2}) by ${EARLY_SECONDS} s`, () => {
      expect(run().final.techLevels.gearRatio).toBeGreaterThanOrEqual(mk2);
    });
  }
});

describe('A2 file budget', () => {
  it('the whole file runs within its 30 s budget', () => {
    expect(fileMs).toBeLessThanOrEqual(FILE_BUDGET_MS);
  });
});

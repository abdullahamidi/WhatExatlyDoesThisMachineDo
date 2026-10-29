import { describe, it, expect, beforeAll } from 'vitest';
import { EDITIONS } from '../data/edition';
import type { EraCap } from './progression/edition';
import { SYSTEM_LOGS, SYSTEM_LOG_CONFIG } from '../data/systemLogs';
import type { SystemLogEntry, SystemLogTrigger } from '../data/systemLogs';
import type { GameState, ResourceId, ResourceMap, TechId } from '../data/types';
import { TECHNOLOGIES } from '../data/technologies';
import { runGreedy } from './sim/greedy';
import type { GreedyFinds } from './sim/greedy';

// WP23b optional machine logs schedule guard (bible §5.4): a vitest port of the logsim replay.
// Greedy samples (5 s chunks in profile A, 30 s in B and C) come from runGreedy in the full edition and in the demo (era cap
// and cap tech read from EDITIONS.demo). The SYS LOG scheduler (table order, one log per poll, the minGapMs gap) is replayed
// over each sample set, with and without the two new entries. Pure simulation test (no Phaser).
// Re-run: npx vitest run src/simulation/worldLogs.sim.test.ts --maxWorkers=2

// Six simulated runs and their replays: generous for a loaded machine.
const TIMEOUT_MS = 120000;
// Samples keep running this long after the stop tech, so the playtime logs can still fire.
const TAIL_SECONDS = 600;
const GAP_SECONDS = SYSTEM_LOG_CONFIG.minGapMs / 1000;
const NEW_IDS: readonly string[] = ['perimeter-umbrella', 'perimeter-phase'];
// WP25 entry (D11). Kept out of the WP23b sets so the existing tests keep their meaning; WITH_ALL holds it too.
const MANUAL_OPTIONAL = 'manual-optional';
const WP25_IDS: readonly string[] = [MANUAL_OPTIONAL];
const WITH_NEW: readonly SystemLogEntry[] = SYSTEM_LOGS.filter((log) => !WP25_IDS.includes(log.id));
const WITHOUT_NEW: readonly SystemLogEntry[] = SYSTEM_LOGS.filter((log) => !NEW_IDS.includes(log.id) && !WP25_IDS.includes(log.id));
const WITH_ALL: readonly SystemLogEntry[] = SYSTEM_LOGS;
const EXISTING_IDS: readonly string[] = WITHOUT_NEW.map((log) => log.id);
// Key logs held to 0 s delay (bible §5.4, corrected in r2-Q-A). The other existing logs share the 120 s start gap with the early
// logs, so they can wait a gap behind an earlier log with or without the new entries; only these eight are pinned to 0 s.
const LOGSIM_KEY_IDS: readonly string[] = ['copper-memory', 'steam-rain', 'sync-success', 'signal-below', 'observer-one', 'units-unknown', 'cycle-0041', 'operator-located'];
// Milestones the key-log order is checked against (bible §5.4 order table). WP25 adds the Crank Servo and the
// substation blueprint: the manual-optional window runs from the first crank to the substation.
const MILESTONES: readonly TechId[] = ['harmonicConvergence', 'finalAlignment', 'crankServo', 'substationBlueprint'];

type Mode = 'full' | 'demo';

interface Profile {
  readonly name: string;
  readonly clicksPerSecond: number;
  readonly buyIntervalSeconds: number;
  readonly chunkSeconds: number;
  readonly maxSeconds: number;
  // WP28: Finds catch model (absent = no Finds). The chunked runs below restart the Find clock per chunk; a Find needs 120 s of
  // clock time, so no Find spawns in a chunk of 30 s or less and the samples are the same as without the option.
  readonly finds?: GreedyFinds;
}

const PROFILES: readonly Profile[] = [
  { name: 'A', clicksPerSecond: 4, buyIntervalSeconds: 1, chunkSeconds: 5, maxSeconds: 17400, finds: { catchProb: 0.85, reactionSeconds: 4 } },
  { name: 'B', clicksPerSecond: 4, buyIntervalSeconds: 30, chunkSeconds: 30, maxSeconds: 18000, finds: { catchProb: 0.85, reactionSeconds: 5 } },
  { name: 'C', clicksPerSecond: 1, buyIntervalSeconds: 30, chunkSeconds: 30, maxSeconds: 28800, finds: { catchProb: 0.4, reactionSeconds: 6 } },
];

// Demo cap and era come from the edition, never retyped here. Null would mean the edition is not the demo.
function demoValue<T>(value: T | null, what: string): T {
  if (value === null) throw new Error(`demo edition has no ${what}`);
  return value;
}
const DEMO_MAX_ERA: number = demoValue(EDITIONS.demo.maxEra, 'maxEra');
const DEMO_CAP: TechId = demoValue(EDITIONS.demo.capTech, 'capTech');

interface Sample {
  t: number;
  life: ResourceMap;
}

interface Run {
  samples: Sample[];
  milestone: Partial<Record<TechId, number>>;
}

// One greedy run: chunked runGreedy calls, one sample per chunk end, then the tail after the stop tech.
function simulate(p: Profile, mode: Mode): Run {
  const maxEra: EraCap = mode === 'demo' ? DEMO_MAX_ERA : null;
  const stop: TechId = mode === 'demo' ? DEMO_CAP : 'primaryFunction';
  const samples: Sample[] = [];
  const milestone: Partial<Record<TechId, number>> = {};
  let state: GameState | undefined;
  let t = 0;
  while (t < p.maxSeconds) {
    const r = runGreedy({
      seconds: p.chunkSeconds,
      clicksPerSecond: p.clicksPerSecond,
      stepSeconds: 1,
      buyIntervalSeconds: p.buyIntervalSeconds,
      initial: state,
      maxEra,
      ...(p.finds !== undefined ? { finds: p.finds } : {}),
    });
    state = r.final;
    t += p.chunkSeconds;
    samples.push({ t, life: { ...state.lifetime } });
    for (const id of MILESTONES) {
      if (milestone[id] === undefined && state.techLevels[id] >= 1) milestone[id] = t;
    }
    if (state.techLevels[stop] >= 1) {
      const life = { ...state.lifetime };
      for (let k = 0; k < TAIL_SECONDS / p.chunkSeconds; k++) {
        t += p.chunkSeconds;
        samples.push({ t, life });
      }
      break;
    }
  }
  return { samples, milestone };
}

function triggerMet(trigger: SystemLogTrigger, s: Sample): boolean {
  return trigger.kind === 'playSeconds' ? s.t >= trigger.atLeast : s.life[trigger.res] >= trigger.atLeast;
}

interface Fire {
  t: number;
  delay: number;
}

interface Replay {
  fire: Partial<Record<string, Fire>>;
  eligibleAt: Partial<Record<string, number>>;
}

// The SYS LOG scheduler over one sample set. A log is eligible at the first sample where its trigger holds. At each sample
// outside the gap, the first eligible, unshown entry in table order fires (one log per poll, as nextSystemLog does).
function replay(samples: readonly Sample[], logs: readonly SystemLogEntry[]): Replay {
  const fire: Partial<Record<string, Fire>> = {};
  const eligibleAt: Partial<Record<string, number>> = {};
  let last: number | null = null;
  for (const s of samples) {
    for (const log of logs) {
      if (eligibleAt[log.id] === undefined && triggerMet(log.trigger, s)) eligibleAt[log.id] = s.t;
    }
    if (last !== null && s.t - last < GAP_SECONDS) continue;
    for (const log of logs) {
      const since = eligibleAt[log.id];
      if (since === undefined || fire[log.id] !== undefined) continue;
      fire[log.id] = { t: s.t, delay: s.t - since };
      last = s.t;
      break;
    }
  }
  return { fire, eligibleAt };
}

interface Outcome {
  run: Run;
  without: Replay;
  with: Replay;
  all: Replay; // WITH_ALL: the WP23b table plus manual-optional
}

const outcomes = new Map<string, Outcome>();

function outcomeOf(mode: Mode, name: string): Outcome {
  const o = outcomes.get(`${mode}/${name}`);
  if (o === undefined) throw new Error(`no run for ${mode}/${name}`);
  return o;
}

// Existing ids that do not fire with 0 s delay (never fired counts as late).
function lateIds(r: Replay): string[] {
  return EXISTING_IDS.filter((id) => r.fire[id]?.delay !== 0);
}

// Existing ids whose fire second or delay differs between the table without and with the two new entries.
function movedIds(o: Outcome): string[] {
  return EXISTING_IDS.filter((id) => {
    const without = o.without.fire[id];
    const withNew = o.with.fire[id];
    return without?.t !== withNew?.t || without?.delay !== withNew?.delay;
  });
}

beforeAll(() => {
  for (const mode of ['full', 'demo'] as const) {
    for (const p of PROFILES) {
      const run = simulate(p, mode);
      outcomes.set(`${mode}/${p.name}`, {
        run,
        without: replay(run.samples, WITHOUT_NEW),
        with: replay(run.samples, WITH_NEW),
        all: replay(run.samples, WITH_ALL),
      });
    }
  }
}, TIMEOUT_MS);

describe('WP23b machine logs: full edition (bible §5.4)', () => {
  it('has the 20 existing logs plus the two new entries', () => {
    expect(WITH_NEW).toHaveLength(WITHOUT_NEW.length + NEW_IDS.length);
    expect(EXISTING_IDS).toHaveLength(20);
  }, TIMEOUT_MS);

  for (const p of PROFILES) {
    it(`profile ${p.name}: every key log fires with 0 s delay, with and without the new logs`, () => {
      const o = outcomeOf('full', p.name);
      expect(lateIds(o.without).filter((id) => LOGSIM_KEY_IDS.includes(id))).toEqual([]);
      expect(lateIds(o.with).filter((id) => LOGSIM_KEY_IDS.includes(id))).toEqual([]);
    }, TIMEOUT_MS);

    it(`profile ${p.name}: the two new logs move no existing log (same second and delay)`, () => {
      expect(movedIds(outcomeOf('full', p.name))).toEqual([]);
    }, TIMEOUT_MS);

    it(`profile ${p.name}: observer-one fires before harmonicConvergence and operator-located before finalAlignment`, () => {
      const o = outcomeOf('full', p.name);
      const converge = o.run.milestone.harmonicConvergence;
      const align = o.run.milestone.finalAlignment;
      expect(converge).toBeDefined();
      expect(align).toBeDefined();
      for (const r of [o.without, o.with]) {
        expect(r.fire['observer-one']?.t).toBeLessThan(converge ?? -Infinity);
        expect(r.fire['operator-located']?.t).toBeLessThan(align ?? -Infinity);
      }
    }, TIMEOUT_MS);

    it(`profile ${p.name}: both new logs fire in the full edition`, () => {
      const o = outcomeOf('full', p.name);
      for (const id of NEW_IDS) expect(o.with.fire[id]).toBeDefined();
    }, TIMEOUT_MS);
  }
});

describe('WP23b machine logs: demo edition (bible §5.4)', () => {
  for (const p of PROFILES) {
    it(`profile ${p.name}: neither new log is reachable`, () => {
      const o = outcomeOf('demo', p.name);
      for (const id of NEW_IDS) {
        expect(o.with.eligibleAt[id]).toBeUndefined();
        expect(o.with.fire[id]).toBeUndefined();
      }
    }, TIMEOUT_MS);

    it(`profile ${p.name}: the two new logs move no existing log (copper-memory included)`, () => {
      expect(movedIds(outcomeOf('demo', p.name))).toEqual([]);
    }, TIMEOUT_MS);

    it(`profile ${p.name}: copper-memory fires at the same second with and without the new logs`, () => {
      const o = outcomeOf('demo', p.name);
      expect(o.without.fire['copper-memory']).toBeDefined();
      expect(o.with.fire['copper-memory']).toEqual(o.without.fire['copper-memory']);
    }, TIMEOUT_MS);
  }
});

// WP25 helpers. The substation's lifetime-EE requirement is read from the tech table, never retyped here.
function lifetimeRequirement(id: TechId, res: ResourceId): number {
  const req = TECHNOLOGIES[id].requires.find((r) => r.type === 'lifetime' && r.res === res);
  if (req === undefined || req.type !== 'lifetime') throw new Error(`${id} has no lifetime ${res} requirement`);
  return req.amount;
}

function entryOf(id: string): SystemLogEntry {
  const entry = SYSTEM_LOGS.find((log) => log.id === id);
  if (entry === undefined) throw new Error(`no SYS LOG entry ${id}`);
  return entry;
}

describe('WP25 manual-optional log (bible section 5.4, D11)', () => {
  it('the table has 23 entries: 20 existing, 2 WP23b, 1 WP25', () => {
    expect(EXISTING_IDS).toHaveLength(20);
    expect(WITH_ALL).toHaveLength(EXISTING_IDS.length + NEW_IDS.length + WP25_IDS.length);
    expect(WITH_ALL).toHaveLength(23);
  });

  it('manual-optional is a lifetime EE trigger below the substationBlueprint EE requirement', () => {
    const trigger = entryOf(MANUAL_OPTIONAL).trigger;
    expect(trigger).toMatchObject({ kind: 'lifetime', res: 'ee' });
    const atLeast = trigger.kind === 'lifetime' ? trigger.atLeast : Infinity;
    expect(atLeast).toBeLessThan(lifetimeRequirement('substationBlueprint', 'ee'));
  });

  for (const mode of ['full', 'demo'] as const) {
    for (const p of PROFILES) {
      it(`${mode} profile ${p.name}: manual-optional is eligible and fires`, () => {
        const o = outcomeOf(mode, p.name);
        expect(o.all.eligibleAt[MANUAL_OPTIONAL]).toBeDefined();
        expect(o.all.fire[MANUAL_OPTIONAL]).toBeDefined();
      }, TIMEOUT_MS);

      it(`${mode} profile ${p.name}: manual-optional is eligible only after the first crankServo and fires before substationBlueprint`, () => {
        const o = outcomeOf(mode, p.name);
        const crank = o.run.milestone.crankServo;
        const substation = o.run.milestone.substationBlueprint;
        expect(crank).toBeDefined();
        expect(substation).toBeDefined();
        expect(o.all.eligibleAt[MANUAL_OPTIONAL] ?? -Infinity).toBeGreaterThanOrEqual(crank ?? Infinity);
        expect(o.all.fire[MANUAL_OPTIONAL]?.t ?? Infinity).toBeLessThan(substation ?? -Infinity);
      }, TIMEOUT_MS);
    }
  }

  for (const p of PROFILES) {
    it(`full profile ${p.name}: every key log keeps 0 s delay and no key log moves with manual-optional`, () => {
      const o = outcomeOf('full', p.name);
      for (const id of LOGSIM_KEY_IDS) {
        expect(o.all.fire[id]?.delay, `${id} delay`).toBe(0);
        expect(o.all.fire[id], `${id} moved`).toEqual(o.with.fire[id]);
      }
    }, TIMEOUT_MS);

    it(`demo profile ${p.name}: copper-memory fires at the same second with and without manual-optional`, () => {
      const o = outcomeOf('demo', p.name);
      expect(o.with.fire['copper-memory']).toBeDefined();
      expect(o.all.fire['copper-memory']).toEqual(o.with.fire['copper-memory']);
    }, TIMEOUT_MS);
  }
});

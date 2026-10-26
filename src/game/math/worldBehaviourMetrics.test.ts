// Tests for the behaviour metrics (WP24 T3d, plan A2): the era states are the smoke stage lists through the real maths; over every state,
// 60 simulated minutes at seeds 1-5 and steps 16.7 and 100 ms, the runners meet the variety (V1 table), loop (V2), hold (V3), change (V4),
// lockstep (V5), teleport (V6), rate (V7) and walk (V8) targets, the stare keeps every rest frame camera-facing, and the parity with the
// hand simulation (plan C2) holds. The production seeds (behaviourSeed(1, actor) at k0 0 and behaviourK0(54000)) meet the V1 table on
// their first 10 minutes. Targets are the plan's numbers and live here; the tuned numbers live in src/data/worldBehaviour.ts.
// Prints every table (console.log) so a run reads like the plan's Revision 2 hand simulation.
import { describe, expect, it } from 'vitest';
import {
  ERA_SPECS, STAGE_LISTS, actorBandOk, downbeatShare, eraStateOf, laneRunner, lockstep, loopStats, maxWalkShare, naturalEntries, simulate, wakeIdsOf,
  startsOf, windowCounts,
} from './worldBehaviourMetrics';
import type { EraState, LaneRun, SimRun } from './worldBehaviourMetrics';
import { behaviourK0 } from './worldBehaviour';
import type { BehaviourActor } from '../../data/worldBehaviour';
import { TIER_HEARTBEAT } from '../../data/machineTiers';

// The plan's windows and rounding (A2): 10 min windows stepped by 1 min; V2 holds rounded to 1 s (era IV: beats); a repeat recurs within 15 min.
const MS_PER_SECOND = 1000;
const MIN_MS = 60000;
const SIM_MINUTES = 60;
const WINDOW_MS = 10 * MIN_MS;
const STEP_MS = MIN_MS;
const UNIT_MS = 1000;
const REPEAT_MS = 15 * MIN_MS;
const BEAT_MS: number = TIER_HEARTBEAT.periodMs;
const LOCK_MS = 125;
const WALK_WINDOW_BINS = 10;
const SEEDS = [1, 2, 3, 4, 5];
// The step lengths: 16.7 ms (60 fps) and 100 ms (the coarsest step the smokes use for a 60 min sample).
const DTS = [16.7, 100];
const K0_PLAYED = behaviourK0(54000);
const PLAY_CYCLE = 1;
const TIMEOUT_MS = 120000;
// The activities a cue can end (the sleep wakes on a ring): their short holds are interruptions, not holds.
const WAKE_IDS: ReadonlySet<string> = wakeIdsOf();

// The plan's targets (A2 V1-V8, A3). Every limit is in ms, percent or a count; the beat limits use the 2.4 s heartbeat.
const T = {
  v2Repeats: 4,              // per simulated hour
  v2Period: 16,
  v2Top4Pct: 15,
  v2ForcedPct: 30,
  v2MinFree: 4,
  v3HoldMs: 45000,
  v3CrowIFrozenMs: 55000,
  v3WalkMs: 6000,
  v3StaticEarlyMs: 18000,
  v3StaticVMs: 25000,
  v3UnisonBeats: 8,
  v3StareBeats: 7,
  v4DenizenMs: 20000,
  v4EraVMs: 30000,
  v4CrowIMs: 60000,
  v5AnyPct: 12,
  v5PairPct: 8,
  v5DownbeatPct: 90,
  v6WalkDx: 8,
  v6RestDx: 4,
  v7HoldRate: 2,
  v7ActRate: 6,
  v7SampleSlack: 1,          // one change may fall in a window because each change is sampled to one step (16.7 or 100 ms)
  v7BurstMs: 4000,
  v7Toggles: 3,
  v8WalkShare: 0.3,
};

// The V1 table (A2): the looks minimum per 10 min window, per state and actor (the first number of each cell; the bracketed ids are not
// the target). Absent: the actor is off-stage, or the girl is parked at the window (her V4 only).
const V1_TARGET: Record<string, Partial<Record<BehaviourActor, number>>> = {
  S7: { inspector: 6, dog: 5, crow: 2 },
  S8: { inspector: 5, dog: 5, crow: 3, girl: 2 },
  S9: { inspector: 6, dog: 5, crow: 3, girl: 2 },
  S9lb: { inspector: 6, dog: 7, crow: 3, girl: 2 },
  S10: { inspector: 4, dog: 5, girl: 2 },
  S11: { inspector: 7, dog: 6, crow: 3, girl: 2 },
  S11c3: { inspector: 7, dog: 6, crow: 3, girl: 4 },
  S13pre: { inspector: 5, dog: 5, crow: 5, girl: 5 },
  S13post: { inspector: 4, dog: 4, crow: 4, girl: 4 },
  S15: { inspector: 3, dog: 3, crow: 2, girl: 3 },
};

// The hand simulation of plan C2 ("Pick-rule check", Revision 2, 60 min x 10 runs): V1 looks (min), forced share % (max), longest id-only
// period (max) and V4 longest gap s (max) per state and actor. Parity: V1 within 1, forced within 5 points (report the rest).
const C2_PARITY: Record<string, Partial<Record<BehaviourActor, { looks: number; forced: number; period: number; gapS: number }>>> = {
  S7: { inspector: { looks: 7, forced: 1.8, period: 4, gapS: 12.0 }, dog: { looks: 6, forced: 3.6, period: 5, gapS: 18.0 },
    crow: { looks: 2, forced: 75, period: 159, gapS: 56.0 } },
  S8: { inspector: { looks: 6, forced: 3.0, period: 6, gapS: 12.0 }, dog: { looks: 6, forced: 3.6, period: 5, gapS: 18.0 },
    crow: { looks: 3, forced: 4.5, period: 9, gapS: 15.3 }, girl: { looks: 2, forced: 99, period: 143, gapS: 0 } },
  S9: { inspector: { looks: 7, forced: 1.8, period: 5, gapS: 12.0 }, dog: { looks: 6, forced: 3.6, period: 5, gapS: 18.0 },
    crow: { looks: 3, forced: 4.5, period: 9, gapS: 15.3 }, girl: { looks: 2, forced: 99, period: 143, gapS: 0 } },
  S9lb: { inspector: { looks: 7, forced: 1.8, period: 5, gapS: 12.0 }, dog: { looks: 8, forced: 1.0, period: 6, gapS: 18.0 },
    crow: { looks: 3, forced: 4.5, period: 9, gapS: 15.3 }, girl: { looks: 2, forced: 99, period: 143, gapS: 0 } },
  S10: { inspector: { looks: 5, forced: 7.8, period: 6, gapS: 10.0 }, dog: { looks: 6, forced: 3.6, period: 5, gapS: 18.0 },
    girl: { looks: 2, forced: 99, period: 143, gapS: 0 } },
  S11: { inspector: { looks: 8, forced: 1.5, period: 6, gapS: 15.8 }, dog: { looks: 7, forced: 6.1, period: 5, gapS: 18.0 },
    crow: { looks: 4, forced: 22.8, period: 7, gapS: 2.5 }, girl: { looks: 3, forced: 90, period: 16, gapS: 0 } },
  S11c3: { inspector: { looks: 8, forced: 1.5, period: 6, gapS: 15.8 }, dog: { looks: 7, forced: 6.1, period: 5, gapS: 18.0 },
    crow: { looks: 4, forced: 22.8, period: 7, gapS: 2.5 }, girl: { looks: 5, forced: 6.7, period: 7, gapS: 19.2 } },
  S13pre: { inspector: { looks: 6, forced: 0, period: 5, gapS: 12.0 }, dog: { looks: 6, forced: 0, period: 5, gapS: 12.0 },
    crow: { looks: 6, forced: 0, period: 5, gapS: 12.0 }, girl: { looks: 6, forced: 0, period: 5, gapS: 12.0 } },
  S13post: { inspector: { looks: 4, forced: 0, period: 7, gapS: 19.2 }, dog: { looks: 4, forced: 0, period: 7, gapS: 19.2 },
    crow: { looks: 4, forced: 0, period: 7, gapS: 19.2 }, girl: { looks: 5, forced: 0, period: 7, gapS: 12.0 } },
  S15: { inspector: { looks: 4, forced: 13.4, period: 9, gapS: 28.9 }, dog: { looks: 4, forced: 16.0, period: 12, gapS: 25.6 },
    crow: { looks: 3, forced: 12.9, period: 14, gapS: 25.7 }, girl: { looks: 4, forced: 6.3, period: 8, gapS: 26.2 } },
};

// Per-state, per-actor V4 limit (denizens 20 s; era V 30 s; the era I crow 60 s) and static cap (eras I-IV 18 s, era V 25 s; the crow's
// frozen 55 s).
function gapLimitMs(state: EraState, actor: BehaviourActor): number {
  if (state.era === 5) return T.v4EraVMs;
  if (state.era === 1 && actor === 'crow') return T.v4CrowIMs;
  return T.v4DenizenMs;
}
function staticCapMs(state: EraState, actor: BehaviourActor): number {
  if (state.era === 1 && actor === 'crow') return T.v3CrowIFrozenMs;
  return state.era === 5 ? T.v3StaticVMs : T.v3StaticEarlyMs;
}

// One lane over all runs of a state: the worst case of each measure (the plan's min for V1, max for the caps and shares).
interface LaneAgg {
  actor: BehaviourActor; free: number; looksMin: number; idsMin: number; aa: number; repeatsMax: number; periodMax: number; top4Max: number;
  forcedMax: number | null; holdMaxMs: number; walkedMaxMs: number; naturalMinMs: number; staticMaxMs: number; walkRunMaxMs: number;
  gapMaxMs: number; dxWalkMax: number; dxRestMax: number; holdIvMinMs: number; actRateMax: number; burstMaxMs: number; toggleMax: number;
  walkShareMax: number; stareRest: number; unisonMaxMs: number; stareMaxMs: number; downbeatMin: number | null;
}

// The state's runs: every seed at every step length (60 min each), with the lane aggregates and the lockstep worst case over the runs.
interface StateAgg { state: EraState; lanes: Partial<Record<BehaviourActor, LaneAgg>>; lockAnyMax: number; lockPairMax: number; runs: SimRun[] }

function aggregate(state: EraState, runs: SimRun[]): StateAgg {
  const lanes: Partial<Record<BehaviourActor, LaneAgg>> = {};
  let lockAnyMax = 0;
  let lockPairMax = 0;
  const minutes = SIM_MINUTES;
  for (const run of runs) {
    const dt = run.opts.dtMs;
    if (state.era !== 4) {
      const ls = lockstep(run.lanes.map((l) => startsOf(l.log)), LOCK_MS);
      lockAnyMax = Math.max(lockAnyMax, ls.anyPct);
      lockPairMax = Math.max(lockPairMax, ls.pairPct);
    }
    for (const l of run.lanes) {
      const agg = lanes[l.actor] ?? newLaneAgg(l);
      lanes[l.actor] = agg;
      foldLane(agg, state, l, minutes, dt);
    }
  }
  return { state, lanes, lockAnyMax, lockPairMax, runs };
}

function newLaneAgg(l: LaneRun): LaneAgg {
  return {
    actor: l.actor, free: l.free, looksMin: Infinity, idsMin: Infinity, aa: 0, repeatsMax: 0, periodMax: 0, top4Max: 0, forcedMax: null,
    holdMaxMs: 0, walkedMaxMs: 0, naturalMinMs: Infinity, staticMaxMs: 0, walkRunMaxMs: 0, gapMaxMs: 0, dxWalkMax: 0, dxRestMax: 0,
    holdIvMinMs: Infinity, actRateMax: 0, burstMaxMs: 0, toggleMax: 0, walkShareMax: 0, stareRest: 0, unisonMaxMs: 0, stareMaxMs: 0,
    downbeatMin: null,
  };
}

function foldLane(agg: LaneAgg, state: EraState, l: LaneRun, minutes: number, dt: number): void {
  const unit = state.era === 4 ? BEAT_MS : UNIT_MS;
  const w = windowCounts(l.log, minutes * MIN_MS, WINDOW_MS, STEP_MS);
  agg.looksMin = Math.min(agg.looksMin, ...w.looks);
  agg.idsMin = Math.min(agg.idsMin, ...w.ids);
  const lp = loopStats(l.log, unit, REPEAT_MS);
  agg.aa += lp.aa;
  agg.repeatsMax = Math.max(agg.repeatsMax, lp.repeats);
  agg.periodMax = Math.max(agg.periodMax, lp.period);
  agg.top4Max = Math.max(agg.top4Max, lp.top4Pct);
  if (state.era !== 4 && l.free >= T.v2MinFree && l.picks > 0) {
    agg.forcedMax = Math.max(agg.forcedMax ?? 0, (100 * l.forced) / l.picks);
  }
  for (const e of l.log) {
    if (e.walked) agg.walkedMaxMs = Math.max(agg.walkedMaxMs, e.durMs);
    else agg.holdMaxMs = Math.max(agg.holdMaxMs, e.durMs);
    if (state.era === 4) {
      agg.unisonMaxMs = Math.max(agg.unisonMaxMs, e.durMs);
      if (e.activity === 'stare') agg.stareMaxMs = Math.max(agg.stareMaxMs, e.durMs);
    }
  }
  for (const e of naturalEntries(l.log, WAKE_IDS)) agg.naturalMinMs = Math.min(agg.naturalMinMs, e.durMs);
  const t = l.track;
  agg.staticMaxMs = Math.max(agg.staticMaxMs, t.maxStaticMs);
  agg.walkRunMaxMs = Math.max(agg.walkRunMaxMs, t.maxWalkRunMs);
  agg.gapMaxMs = Math.max(agg.gapMaxMs, t.maxGapMs);
  agg.dxWalkMax = Math.max(agg.dxWalkMax, t.maxWalkDx);
  agg.dxRestMax = Math.max(agg.dxRestMax, t.maxRestDx);
  agg.holdIvMinMs = Math.min(agg.holdIvMinMs, t.minHoldIvMs);
  agg.actRateMax = Math.max(agg.actRateMax, t.maxActRate);
  agg.burstMaxMs = Math.max(agg.burstMaxMs, t.maxBurstMs);
  agg.toggleMax = Math.max(agg.toggleMax, t.maxDownToggles);
  agg.walkShareMax = Math.max(agg.walkShareMax, maxWalkShare(t.walkMs, WALK_WINDOW_BINS, WALK_WINDOW_BINS * MIN_MS));
  agg.stareRest += t.stareRest;
  if (state.era === 4) {
    const d = downbeatShare(startsOf(l.log), BEAT_MS, dt + 1);
    agg.downbeatMin = agg.downbeatMin === null ? d : Math.min(agg.downbeatMin, d);
  }
}

// The runs of one state: 5 seeds (the cycles 1-5 of behaviourSeed) x 2 steps, each 60 simulated minutes from draw index 0.
function runsOf(state: EraState): SimRun[] {
  const out: SimRun[] = [];
  for (const seed of SEEDS) for (const dt of DTS) out.push(simulate(state, { cycle: seed, k0: 0, dtMs: dt, minutes: SIM_MINUTES }));
  return out;
}

// Prints a state's table: one row per actor (the plan's columns: V1 looks / ids, forced %, longest period, top 4-gram, V4 gap; V3 holds).
function printTable(agg: StateAgg): void {
  const f = (v: number | null, d = 1): string => (v === null ? '-' : v.toFixed(d));
  const rows: string[] = [];
  rows.push(`${agg.state.id} era ${agg.state.era} ${agg.state.mode} framing ${agg.state.framing} lock any ${f(agg.lockAnyMax)} pair ${f(agg.lockPairMax)}`);
  rows.push('  actor      free looks ids  aa rep4 period top4% forced% hold_s static_s walk% gap_s dxW dxR hIvMs actR burst_s tog stare');
  for (const actor of ['inspector', 'dog', 'crow', 'girl'] as const) {
    const a = agg.lanes[actor];
    if (a === undefined) continue;
    rows.push(`  ${actor.padEnd(10)} ${String(a.free).padStart(4)} ${String(a.looksMin).padStart(5)} ${String(a.idsMin).padStart(3)} ` +
      `${String(a.aa).padStart(3)} ${String(a.repeatsMax).padStart(4)} ${String(a.periodMax).padStart(6)} ${f(a.top4Max).padStart(5)} ` +
      `${f(a.forcedMax).padStart(7)} ${f(a.holdMaxMs / 1000).padStart(6)} ${f(a.staticMaxMs / 1000).padStart(8)} ` +
      `${f(100 * a.walkShareMax).padStart(5)} ${f(a.gapMaxMs / 1000).padStart(6)} ${String(a.dxWalkMax).padStart(3)} ${String(a.dxRestMax).padStart(3)} ` +
      `${f(a.holdIvMinMs, 0).padStart(5)} ${f(a.actRateMax, 0).padStart(4)} ${f(a.burstMaxMs / 1000, 2).padStart(7)} ${String(a.toggleMax).padStart(3)} ` +
      `${String(a.stareRest).padStart(5)}`);
  }
  console.log(rows.join('\n'));
}

// ---- The era states ----

describe('the era states are the smoke stage lists through the real maths', () => {
  it('every state carries the stage its plan row names (era, playback mode, the girl, the stare, the vents, the sensor and scraps)', () => {
    const byId = Object.fromEntries(ERA_SPECS.map((s) => [s.id, eraStateOf(s)]));
    expect(byId.S7).toMatchObject({ era: 1, mode: 'fps4', framing: 'e1', girlStage: 'window', sensor: true, scraps: true, stare: false });
    expect(byId.S8).toMatchObject({ era: 2, mode: 'fps8', framing: 's8', girlStage: 'mini', sensor: false, stare: false });
    expect(byId.S9).toMatchObject({ era: 2, mode: 'fps8', framing: 's9', girlStage: 'mini', sensor: true, holeDig: false });
    expect(byId.S9lb).toMatchObject({ era: 2, holeDig: true });
    expect(byId.S10).toMatchObject({ era: 3, framing: 's10', girlStage: 'mini', sensor: false, scraps: false, vents: false });
    expect(byId.S10?.cast.crow).toBeNull();
    expect(byId.S11).toMatchObject({ era: 3, vents: true, girlStage: 'mini', gusts: true });
    expect(byId.S11c3).toMatchObject({ era: 3, girlStage: 'ground', cycle: 3 });
    expect(byId.S13pre).toMatchObject({ era: 4, framing: 's11', girlStage: 'ground', stare: false });
    expect(byId.S13post).toMatchObject({ era: 4, stare: true });
    expect(byId.S15).toMatchObject({ era: 5, stare: true, reverse: true, gusts: false });
    expect(STAGE_LISTS.S13.length).toBeGreaterThan(STAGE_LISTS.S11.length);
  });

  it('every spot of every state lies inside its actor band (the spots rule of WP24 T1)', () => {
    for (const spec of ERA_SPECS) {
      const state = eraStateOf(spec);
      for (const actor of ['inspector', 'dog'] as const) {
        const place = state.cast[actor];
        if (place === null) continue;
        for (const s of place.spots) expect(actorBandOk(state, actor, s.x), `${spec.id} ${actor} ${s.id}`).toBe(true);
      }
    }
  });
});

// ---- The unit metrics over the real era states (60 min x 5 seeds x 2 steps) ----

describe.each(ERA_SPECS)('living world metrics over $id (60 min x seeds 1-5 x 16.7 and 100 ms)', (spec) => {
  const state = eraStateOf(spec);
  let agg: StateAgg | null = null;
  const getAgg = (): StateAgg => {
    if (agg === null) {
      agg = aggregate(state, runsOf(state));
      printTable(agg);
    }
    return agg;
  };

  it('V1: the looks of every 10 min window meet the plan table', () => {
    const a = getAgg();
    const want = V1_TARGET[spec.id] ?? {};
    for (const actor of Object.keys(want) as BehaviourActor[]) {
      const lane = a.lanes[actor];
      expect(lane, `${spec.id} ${actor} runs`).toBeDefined();
      expect(lane?.looksMin ?? 0, `${spec.id} ${actor} looks per window`).toBeGreaterThanOrEqual(want[actor] ?? 0);
    }
  }, TIMEOUT_MS);

  it('V2: no A to A, exact 4-run repeats within 15 min at most 4 an hour, period runs and the 4-gram share stay bounded', () => {
    const a = getAgg();
    for (const lane of Object.values(a.lanes)) {
      if (lane === undefined) continue;
      expect(lane.aa, `${spec.id} ${lane.actor} A to A`).toBe(0);
      expect(lane.repeatsMax, `${spec.id} ${lane.actor} 4-run repeats`).toBeLessThanOrEqual(T.v2Repeats);
      if (lane.free >= T.v2MinFree) {
        expect(lane.periodMax, `${spec.id} ${lane.actor} id period run`).toBeLessThanOrEqual(T.v2Period);
        expect(lane.top4Max, `${spec.id} ${lane.actor} top 4-gram %`).toBeLessThanOrEqual(T.v2Top4Pct);
        if (lane.forcedMax !== null) {
          expect(lane.forcedMax, `${spec.id} ${lane.actor} forced picks %`).toBeLessThanOrEqual(T.v2ForcedPct);
        }
      }
    }
  }, TIMEOUT_MS);

  it('V3: holds 1-45 s (the crow I frozen 55 s), travel walks <= 6 s, static runs within their caps, unison and stare within their beats', () => {
    const a = getAgg();
    for (const lane of Object.values(a.lanes)) {
      if (lane === undefined) continue;
      const holdCap = state.era === 1 && lane.actor === 'crow' ? T.v3CrowIFrozenMs : T.v3HoldMs;
      expect(lane.holdMaxMs, `${spec.id} ${lane.actor} longest hold`).toBeLessThanOrEqual(holdCap);
      expect(lane.walkedMaxMs, `${spec.id} ${lane.actor} longest travel`).toBeLessThanOrEqual(T.v3HoldMs + T.v3WalkMs);
      expect(lane.naturalMinMs, `${spec.id} ${lane.actor} shortest natural hold`).toBeGreaterThanOrEqual(UNIT_MS);
      expect(lane.walkRunMaxMs, `${spec.id} ${lane.actor} longest walk`).toBeLessThanOrEqual(T.v3WalkMs + 2 * dtMax());
      expect(lane.staticMaxMs, `${spec.id} ${lane.actor} static run`).toBeLessThanOrEqual(staticCapMs(state, lane.actor));
      if (spec.id.startsWith('S13') || spec.id === 'S15') {
        expect(lane.unisonMaxMs, `${spec.id} ${lane.actor} unison action`).toBeLessThanOrEqual(T.v3UnisonBeats * BEAT_MS + dtMax());
      }
      if (spec.id === 'S13post') {
        expect(lane.stareMaxMs, `${spec.id} ${lane.actor} stare`).toBeLessThanOrEqual(T.v3StareBeats * BEAT_MS);
      }
    }
  }, TIMEOUT_MS);

  it('V4: something changes at least every 20 s (era V 30 s, the era I crow 60 s)', () => {
    const a = getAgg();
    for (const lane of Object.values(a.lanes)) {
      if (lane === undefined || lane.gapMaxMs === 0) continue;
      expect(lane.gapMaxMs, `${spec.id} ${lane.actor} longest visible gap`).toBeLessThanOrEqual(gapLimitMs(state, lane.actor));
    }
  }, TIMEOUT_MS);

  it('V5: outside era IV the starts do not lock (12 % any, 8 % a pair); in era IV the switches fall on the downbeat (90 %)', () => {
    const a = getAgg();
    if (state.era === 4) {
      for (const lane of Object.values(a.lanes)) {
        if (lane === undefined) continue;
        expect(lane.downbeatMin ?? 100, `${spec.id} ${lane.actor} switches on the downbeat`).toBeGreaterThanOrEqual(T.v5DownbeatPct);
      }
    } else {
      expect(a.lockAnyMax, `${spec.id} starts within 125 ms of another denizen`).toBeLessThanOrEqual(T.v5AnyPct);
      expect(a.lockPairMax, `${spec.id} worst pair`).toBeLessThanOrEqual(T.v5PairPct);
    }
  }, TIMEOUT_MS);

  it('V6: a walk steps at most 8 px and a rest frame at most 4 px (the crow stutter) per step', () => {
    const a = getAgg();
    for (const lane of Object.values(a.lanes)) {
      if (lane === undefined) continue;
      expect(lane.dxWalkMax, `${spec.id} ${lane.actor} walk step`).toBeLessThanOrEqual(T.v6WalkDx);
      expect(lane.dxRestMax, `${spec.id} ${lane.actor} rest step`).toBeLessThanOrEqual(T.v6RestDx);
    }
  }, TIMEOUT_MS);

  it('V7: holds at most 2 changes a second, actions at most 6, bursts at most 4 s, at most 3 luminance toggles a second', () => {
    const a = getAgg();
    for (const lane of Object.values(a.lanes)) {
      if (lane === undefined) continue;
      expect(lane.holdIvMinMs, `${spec.id} ${lane.actor} shortest hold change interval`).toBeGreaterThanOrEqual(MS_PER_SECOND / T.v7HoldRate - 2 * dtMax());
      expect(lane.actRateMax, `${spec.id} ${lane.actor} action changes per s`).toBeLessThanOrEqual(T.v7ActRate + T.v7SampleSlack);
      expect(lane.burstMaxMs, `${spec.id} ${lane.actor} burst`).toBeLessThanOrEqual(T.v7BurstMs + dtMax());
      expect(lane.toggleMax, `${spec.id} ${lane.actor} luminance toggles`).toBeLessThanOrEqual(T.v7Toggles);
    }
  }, TIMEOUT_MS);

  it('V8: the Inspector and the dog walk at most 30 % of any 10 min window', () => {
    const a = getAgg();
    for (const actor of ['inspector', 'dog'] as const) {
      const lane = a.lanes[actor];
      if (lane === undefined) continue;
      expect(lane.walkShareMax, `${spec.id} ${actor} walk share`).toBeLessThanOrEqual(T.v8WalkShare);
    }
  }, TIMEOUT_MS);

  it('A3 stare: under the stare every rest frame drawn is camera-facing (WORLD_STARE_SAFE), walks aside', () => {
    if (!state.stare) return;
    const a = getAgg();
    for (const lane of Object.values(a.lanes)) {
      if (lane === undefined) continue;
      expect(lane.stareRest, `${spec.id} ${lane.actor} rest frames outside the stare set`).toBe(0);
    }
  }, TIMEOUT_MS);
});

// ---- Parity with the hand simulation (plan C2) ----

describe('parity with the Revision 2 hand simulation (plan C2)', () => {
  it.each(Object.keys(C2_PARITY))('%s: V1 looks within 1 and forced share within 5 points (report the rest)', (id) => {
    const spec = ERA_SPECS.find((s) => s.id === id);
    expect(spec).toBeDefined();
    if (spec === undefined) return;
    const state = eraStateOf(spec);
    const agg = aggregate(state, runsOf(state));
    const rows: string[] = [`parity ${id} (ours vs C2): looks / forced % / period / gap s`];
    for (const actor of Object.keys(C2_PARITY[id] ?? {}) as BehaviourActor[]) {
      const want = C2_PARITY[id]?.[actor];
      const lane = agg.lanes[actor];
      if (want === undefined || lane === undefined) continue;
      rows.push(`  ${actor}: looks ${lane.looksMin} vs ${want.looks} | forced ${lane.forcedMax === null ? '-' : lane.forcedMax.toFixed(1)} vs ${want.forced} | ` +
        `period ${lane.periodMax} vs ${want.period} | gap ${(lane.gapMaxMs / 1000).toFixed(1)} vs ${want.gapS}`);
      expect(Math.abs(lane.looksMin - want.looks), `${id} ${actor} V1 looks parity`).toBeLessThanOrEqual(1);
      if (lane.forcedMax !== null && want.forced > 0) {
        expect(Math.abs(lane.forcedMax - want.forced), `${id} ${actor} forced parity`).toBeLessThanOrEqual(5);
      }
    }
    console.log(rows.join('\n'));
  }, TIMEOUT_MS);
});

// ---- The production seeds: behaviourSeed(1, actor) at draw index 0 (a fresh context) and at behaviourK0(54000) (a played save) ----

describe.each(ERA_SPECS)('production seeds over $id (first 10 min window, 16.7 and 100 ms)', (spec) => {
  const state = eraStateOf(spec);
  it('the first 10 min window meets the V1 table and the V4 gap at both draw indices and both steps', () => {
    const lines: string[] = [`production ${spec.id} era ${state.era}: looks/ids/gap s per denizen (k0 0, then k0 ${K0_PLAYED})`];
    for (const k0 of [0, K0_PLAYED]) {
      for (const dt of DTS) {
        const run = simulate(state, { cycle: PLAY_CYCLE, k0, dtMs: dt, minutes: 10 });
        const cells: string[] = [];
        for (const lane of run.lanes) {
          const w = windowCounts(lane.log, 10 * MIN_MS, 10 * MIN_MS, STEP_MS);
          const looks = w.looks[0] ?? 0;
          const ids = w.ids[0] ?? 0;
          cells.push(`${lane.actor} ${looks}/${ids}/${(lane.track.maxGapMs / 1000).toFixed(1)}`);
          const want = V1_TARGET[spec.id]?.[lane.actor];
          if (want !== undefined) {
            expect(looks, `${spec.id} ${lane.actor} k0 ${k0} dt ${dt} first window looks`).toBeGreaterThanOrEqual(want);
          }
          expect(lane.track.maxGapMs, `${spec.id} ${lane.actor} k0 ${k0} dt ${dt} first window gap`)
            .toBeLessThanOrEqual(gapLimitMs(state, lane.actor));
        }
        lines.push(`  k0 ${k0} dt ${dt}: ${cells.join(', ')}`);
      }
    }
    console.log(lines.join('\n'));
  }, TIMEOUT_MS);
});

// ---- V6 across a pause: the presented x holds while paused and the resumed walk does not jump ----

describe('pause and resume (V6)', () => {
  it('a pause in the middle of a walk holds x, and the resumed walk steps at most one walk step', () => {
    const spec = ERA_SPECS.find((s) => s.id === 'S7');
    expect(spec).toBeDefined();
    if (spec === undefined) return;
    const made = laneRunner(eraStateOf(spec), 'inspector', { cycle: PLAY_CYCLE, k0: 0, dtMs: 100, minutes: 1 });
    expect(made).not.toBeNull();
    if (made === null) return;
    const { runner, ctx, beat } = made;
    const dt = 100;
    const PAUSE_STEPS = 30;
    let now = 0;
    let beatIndex = -1;
    let walkSeen = false;
    let pauseLeft = 0;
    let resumed = false;
    let pausedX = 0;
    let pauseMaxDx = 0;
    let resumeDx = -1;
    for (let i = 0; i < 1200 && resumeDx < 0; i++) {
      now += dt;
      const bi = Math.floor(now / BEAT_MS);
      beat.downbeat = bi !== beatIndex;
      beat.index = bi;
      beatIndex = bi;
      if (pauseLeft > 0) {
        ctx.paused = true;
        const f = runner.step(dt, ctx);
        pauseMaxDx = Math.max(pauseMaxDx, Math.abs(f.x - pausedX));
        pauseLeft -= 1;
        if (pauseLeft === 0) {
          ctx.paused = false;
          resumed = true;
        }
        continue;
      }
      const f = runner.step(dt, ctx);
      if (resumed) {
        resumeDx = Math.abs(f.x - pausedX);
        resumed = false;
      } else if (!walkSeen && f.walking) {
        walkSeen = true;
        pauseLeft = PAUSE_STEPS;
        pausedX = f.x;
      }
    }
    expect(walkSeen).toBe(true);
    expect(pauseMaxDx).toBe(0);
    expect(resumeDx).toBeGreaterThanOrEqual(0);
    expect(resumeDx).toBeLessThanOrEqual(T.v6WalkDx);
  });
});

// The largest step length of the unit runs: the measurement slack of one step (the sampled changes and the quantised walk ticks).
function dtMax(): number {
  return Math.max(...DTS);
}

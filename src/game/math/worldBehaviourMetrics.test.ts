// Tests for the behaviour metrics (WP24 T3d, plan A2): the era states are the smoke stage lists through the real maths; over every state,
// 60 simulated minutes at seeds 1-5 and steps 16.7 and 100 ms, the runners meet the variety (V1 table), loop (V2), hold (V3), change (V4),
// lockstep (V5), teleport (V6), rate (V7) and walk (V8) targets, the stare keeps every rest frame camera-facing, and the parity with the
// hand simulation (plan C2) holds. The production seeds (behaviourSeed(1, actor) at k0 0 and behaviourK0(54000)) meet the V1 table on
// their first 10 minutes. Targets are the plan's numbers and live here; the tuned numbers live in src/data/worldBehaviour.ts.
// Prints every table (console.log) so a run reads like the plan's Revision 2 hand simulation.
// WP28b (B-T1c1): the roamers are measured by the action gap, walk share, coverage and stagger of B1 (the B1 table prints per state). The B1
// bounds are the plan's; a row that misses them is a Director decision (WP28b report), never a looser bound here.
// WP28b (r2-FX4T): T1 (the visible gap, 10.5 s), T2 (the 90 s range, 70 %, 30 s bins) and the R1 walk share floors (B1_WALK_FLOOR, Director ruling
// 2026-10-30 R1); the parity pins follow the measured values (C2_PARITY).
import { describe, expect, it } from 'vitest';
import {
  ERA_SPECS, STAGE_LISTS, X_BIN_MS, actorBandOk, downbeatShare, eraStateOf, extentCoverages, laneRunner, lockstep, loopStats, maxWalkShare, naturalEntries,
  simulate, spotRangeOf, visibleGapMs, walkShares, walkStaggerPairs, wakeIdsOf, startsOf, windowCounts,
} from './worldBehaviourMetrics';
import type { ActionExempt, EraState, LaneRun, SimRun } from './worldBehaviourMetrics';
import { behaviourK0 } from './worldBehaviour';
import { WORLD_BEHAVIOUR } from '../../data/worldBehaviour';
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
// The activities a cue can end (the sleep wakes on a ring) and the crow's tip try (a brief glitch of 0.8-1.8 s by design, WP27 D5): their
// short holds are interruptions or glitches, not holds, so the shortest natural hold skips them.
// WP28b: the crow's hop (the free hop and the poke hop, 0.6 s by design, C3) is a flight, not a hold, so it is short too.
const SHORT_IDS: ReadonlySet<string> = new Set([...wakeIdsOf(), 'tipTry', 'hopFree', 'hop']);

// The plan's targets (A2 V1-V8, A3). Every limit is in ms, percent or a count; the beat limits use the 2.4 s heartbeat.
const T = {
  v2Repeats: 4,              // per simulated hour
  v2Period: 16,
  v2Top4Pct: 15,
  v2ForcedPct: 30,
  v2MinFree: 4,
  v3HoldMs: 45000,
  v3WalkMs: 6000,
  v3StaticEarlyMs: 18000,
  v3StaticVMs: 25000,
  v3UnisonBeats: 8,
  v3StareBeats: 7,
  v4DenizenMs: 20000,
  v4EraVMs: 30000,
  v4CrowIMs: 20000,
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
  // V8 keeps the WP24 ceiling (30 % of a run's 10 min window); the WP28b ceiling (20 % of each 5 min window, aggregated over seeds) is B1's.
  v8WalkShare: 0.3,
  // B1 (WP28b, Q9): walk share per 5 min window (eras I-III and V, the walkers), coverage of the spot range per 5 min window (seeds 1-4,
  // the first 20 simulated minutes of the 100 ms runs; a longer run's prefix is the same run, the simulation is causal).
  b1WalkMinPct: 12,
  b1WalkMaxPct: 20,
  b1WindowMin: 5,
  b1CoverPct: 75,
  b1CoverMin: 20,
  // WP28b (r2-FX4T, T1): a visible action (a look change, a walk or a reaction) starts at least every 10.5 s (eras I-III and V).
  t1VisibleMs: 10500,
  // WP28b (r2-FX4T, T2): every 90 s window covers at least 70 % of the walker's non-visit spot range (seeds 1-5 at 100 ms, 60 min).
  t2WindowMs: 90000,
  t2CoverPct: 70,
};
// The bins of the presented x extent (30 s, X_BIN_MS) in a span of ms.
const bins = (ms: number): number => Math.round(ms / X_BIN_MS);
// B1 (WP28b): the roamers whose action gap, walk share and coverage the gate checks. The crow never walks (perch and the free hop), so its
// share and coverage are not measured; the girl never moves (V4 stays). The action gap of the walkers and the crow counts every id except the
// canon hold listed here: era IV's `hold` (the V4 exemption that stands since WP24). The era IV `stare` is no longer exempt (WP28b F34 / F40:
// the post stare is capped at 4 beats, 9.6 s, so the gap counts it). Era V has no exemption: its longest action gap is measured without one.
const ROAMERS: readonly BehaviourActor[] = ['inspector', 'dog', 'crow'];
const WALKERS: readonly BehaviourActor[] = ['inspector', 'dog'];
const ACTION_EXEMPT: ActionExempt = { 4: ['hold'] };
// WP28b (r2-FX4T, T4): the walk share floor of each (state, actor) row. Director ruling 2026-10-30 R1: the 12-20 % walk share holds where the measured
// spot path allows it. The rows that still cannot reach 12 % after tuning (the AD3 yard limits, the Splice objects and the wing leave the dog 44-52 px
// of spot path at s8, s9, s10 and s15, and the Inspector 16-60 px at s8; fps8 walks cover twice the px/s of fps4) get the measured lowest 5 min window
// rounded down to 0.5 %, never below 2 %, pinned per state. The 20 % ceiling, coverage >= 75 %, T1-T3 and every other B1 bound stay.
const B1_WALK_FLOOR: Partial<Record<string, number>> = {
  'S8 inspector': 7.5, 'S8 dog': 6.5, 'S9 inspector': 8.5, 'S9 dog': 6, 'S9lb inspector': 8.5, 'S9lb dog': 5, 'S10 inspector': 10.5, 'S10 dog': 2.5,
  'S15 inspector': 8, 'S15 dog': 3,
};
function walkFloorOf(stateId: string, actor: BehaviourActor): number {
  return B1_WALK_FLOOR[`${stateId} ${actor}`] ?? T.b1WalkMinPct;
}
// WP28b (r3-FIX-B, T2): Director ruling T2, WP28b round 3: the 90 s coverage bound is the unit proxy of roam.mjs B_range (SPOT_COVER 0.6, the plan bound).
// A (state, walker) row whose lowest 90 s window stays below 70 % after tuning is pinned at its measured lowest value rounded down to 0.5 %, never below 60 %.
// S7 inspector is the only row under 70 % (era I walks 2-4 fps with a walk share capped at 20 %; seed 1 reads 93.8 %, seeds 2-5 61.5 %).
const T2_COVER_FLOOR: Partial<Record<string, number>> = {
  'S7 inspector': 61.5,
};
function t2FloorOf(stateId: string, actor: BehaviourActor): number {
  return T2_COVER_FLOOR[`${stateId} ${actor}`] ?? T.t2CoverPct;
}

// The V1 table (A2): the looks minimum per 10 min window, per state and actor (the first number of each cell; the bracketed ids are not
// the target). Absent: the actor is off-stage, or the girl is parked at the window (her V4 only).
const V1_TARGET: Record<string, Partial<Record<BehaviourActor, number>>> = {
  S7: { inspector: 6, dog: 5, crow: 4 },
  S8: { inspector: 5, dog: 5, crow: 4, girl: 2 },
  S9: { inspector: 6, dog: 5, crow: 4, girl: 2 },
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
// WP27 re-pin (T8a): the crow rows (D5 perched crow), the S8 / S9lb / S10 Inspector and dog rows (the Sensor 7 cues and the T5 sensor-side
// spot) are the values this harness measures now; the other rows keep the hand simulation.
// WP28b re-pin (B-T1c1): the roamers' travel weights and cooldowns (the B1 walk share and coverage), the crow's cooldowns (the forced picks of
// the perch loop) and era V's mouth cooldown moved the forced share and the looks of the Inspector and dog rows (S7-S11, S15) and the girl's
// forced share (S11c3, S15, the hold caps restored to 45 s); the new values are the measured ones. The period and gap columns are the hand
// simulation and are not asserted (the roamers' gap is the B1 action gap now). The second round (the reaction guard and the roamers' weights)
// re-pinned the forced share of the Inspector and dog rows of S7-S9lb.
// WP28b re-pin (B-T1c1, the calmer crow and the era III and V walks): S11 and S11c3 crow looks 4 -> 6 (the crow's holds are 4-9 s now, so it
// shows fewer looks per 10 min window than the hand simulation's crow) and its forced share 22.8 -> 0.3 (the look is a free id now); S15 inspector
// forced 13.4 -> 7.7 (the era V backstep is the walk); S10 inspector forced 13.7 -> 8.5 (the Inspector's strolls and rests of era III).
// WP28b r2-FX1 (D, the girl's static cap 16 s in GIRL_GROUND): the girl's forced share is back inside the 5-point parity of the v0.11.0 pins,
// so the pins are restored: S11c3 girl 14.9 -> 6.7 (measured 6.3), S15 girl 12.8 -> 6.3 (measured 8.3).
// WP28b re-pin (r2-FX4T, T1-T4: the visible gap, the 90 s range, the walk and rest holds and weights of eras I-III and V, the era V cawStutter and
// listen ids): the looks and forced shares of the Inspector, dog and crow rows moved; the pins are the measured values (the parity bound is V1 within 1 and
// forced within 5 points, a row with no forced share skips it). The period and gap columns stay the hand simulation (not asserted).
const C2_PARITY: Record<string, Partial<Record<BehaviourActor, { looks: number; forced: number; period: number; gapS: number }>>> = {
  S7: { inspector: { looks: 9, forced: 5.6, period: 4, gapS: 12.0 }, dog: { looks: 7, forced: 5.3, period: 5, gapS: 16.0 },
    crow: { looks: 7, forced: 0.1, period: 5, gapS: 5.7 } },
  S8: { inspector: { looks: 9, forced: 6.5, period: 4, gapS: 12.0 }, dog: { looks: 7, forced: 5.6, period: 4, gapS: 16.0 },
    crow: { looks: 8, forced: 0, period: 6, gapS: 4.9 }, girl: { looks: 2, forced: 99, period: 143, gapS: 0 } },
  S9: { inspector: { looks: 8, forced: 7.2, period: 5, gapS: 12.0 }, dog: { looks: 7, forced: 5.6, period: 6, gapS: 16.0 },
    crow: { looks: 8, forced: 0, period: 6, gapS: 4.8 }, girl: { looks: 2, forced: 99, period: 143, gapS: 0 } },
  S9lb: { inspector: { looks: 8, forced: 8.3, period: 5, gapS: 12.0 }, dog: { looks: 9, forced: 2.9, period: 4, gapS: 16.0 },
    crow: { looks: 8, forced: 0, period: 6, gapS: 4.8 }, girl: { looks: 2, forced: 99, period: 143, gapS: 0 } },
  S10: { inspector: { looks: 7, forced: 6.5, period: 6, gapS: 10.0 }, dog: { looks: 7, forced: 4.5, period: 6, gapS: 16.0 },
    girl: { looks: 2, forced: 99, period: 143, gapS: 0 } },
  S11: { inspector: { looks: 9, forced: 6.9, period: 6, gapS: 15.8 }, dog: { looks: 8, forced: 3.6, period: 5, gapS: 18.0 },
    crow: { looks: 6, forced: 0.3, period: 7, gapS: 2.5 }, girl: { looks: 3, forced: 90, period: 16, gapS: 0 } },
  S11c3: { inspector: { looks: 9, forced: 4.7, period: 6, gapS: 15.8 }, dog: { looks: 8, forced: 4.1, period: 5, gapS: 18.0 },
    crow: { looks: 6, forced: 0.3, period: 7, gapS: 2.5 }, girl: { looks: 5, forced: 7.8, period: 7, gapS: 19.2 } },
  S13pre: { inspector: { looks: 6, forced: 0, period: 5, gapS: 12.0 }, dog: { looks: 6, forced: 0, period: 5, gapS: 12.0 },
    crow: { looks: 6, forced: 0, period: 5, gapS: 12.0 }, girl: { looks: 6, forced: 0, period: 5, gapS: 12.0 } },
  S13post: { inspector: { looks: 4, forced: 0, period: 7, gapS: 19.2 }, dog: { looks: 4, forced: 0, period: 7, gapS: 19.2 },
    crow: { looks: 4, forced: 0, period: 7, gapS: 19.2 }, girl: { looks: 5, forced: 0, period: 7, gapS: 12.0 } },
  S15: { inspector: { looks: 4, forced: 4.3, period: 9, gapS: 28.9 }, dog: { looks: 5, forced: 0, period: 12, gapS: 25.6 },
    crow: { looks: 4, forced: 0, period: 14, gapS: 25.7 }, girl: { looks: 4, forced: 8.3, period: 8, gapS: 26.2 } },
};

// Per-state, per-actor V4 limit (denizens 20 s; era V 30 s; the era I crow 20 s, WP27 D5) and static cap (eras I-IV 18 s, era V 25 s; the
// era I crow has no frozen hold any more and is held to the hold cap).
function gapLimitMs(state: EraState, actor: BehaviourActor): number {
  if (state.era === 5) return T.v4EraVMs;
  if (state.era === 1 && actor === 'crow') return T.v4CrowIMs;
  return T.v4DenizenMs;
}
function staticCapMs(state: EraState, actor: BehaviourActor): number {
  if (state.era === 1 && actor === 'crow') return T.v3HoldMs;
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
  for (const e of naturalEntries(l.log, SHORT_IDS)) agg.naturalMinMs = Math.min(agg.naturalMinMs, e.durMs);
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
  for (const seed of SEEDS) for (const dt of DTS) out.push(simulate(state, { cycle: seed, k0: 0, dtMs: dt, minutes: SIM_MINUTES }, ACTION_EXEMPT));
  return out;
}

// The B1 numbers of a state (WP28b): per roamer the longest action gap (every run; era IV the 100 ms runs, the conductor's switches), the
// walk share of the walkers (per 5 min window, the seeds 1-5 at 100 ms summed), the coverage of the walkers (per 5 min window, seeds 1-4 at 100
// ms, the first 20 min), the adjacent equal ids and the walk starts within 1 s of another walker (every run, the drawn starts).
interface B1Row { actor: BehaviourActor; gapMs: number; shareMinPct: number | null; shareMaxPct: number | null; coverMinPct: number | null;
  aa: number; stagger: number }
function b1Rows(agg: StateAgg): B1Row[] {
  const rows: B1Row[] = [];
  const runs100 = agg.runs.filter((r) => r.opts.dtMs === 100);
  const stagger = agg.runs.reduce((s, r) => s + walkStaggerPairs(r.walkStarts, WORLD_BEHAVIOUR.walkStaggerMs), 0);
  for (const actor of ROAMERS) {
    const lane = agg.lanes[actor];
    if (lane === undefined) continue;
    let gapMs = 0;
    for (const run of agg.runs) {
      if (agg.state.era === 4 && run.opts.dtMs !== 100) continue;
      const l = run.lanes.find((x) => x.actor === actor);
      if (l !== undefined) gapMs = Math.max(gapMs, l.track.maxActGapMs);
    }
    let shareMinPct: number | null = null;
    let shareMaxPct: number | null = null;
    let coverMinPct: number | null = null;
    if (WALKERS.includes(actor) && agg.state.era !== 4) {
      const sums = new Float64Array(SIM_MINUTES);
      for (const run of runs100) {
        const l = run.lanes.find((x) => x.actor === actor);
        if (l !== undefined) for (let m = 0; m < SIM_MINUTES; m++) sums[m] = (sums[m] ?? 0) + (l.track.walkMs[m] ?? 0);
      }
      const shares = walkShares(sums, T.b1WindowMin, T.b1WindowMin * MIN_MS * runs100.length).map((s) => 100 * s);
      shareMinPct = Math.min(...shares);
      shareMaxPct = Math.max(...shares);
      const range = spotRangeOf(agg.state, actor);
      if (range !== null) {
        for (const run of runs100.filter((r) => r.opts.cycle <= 4)) {
          const l = run.lanes.find((x) => x.actor === actor);
          if (l === undefined) continue;
          const c = extentCoverages(l.track.xLo, l.track.xHi, bins(T.b1WindowMin * MIN_MS), bins(T.b1CoverMin * MIN_MS), range).map((v) => 100 * v);
          coverMinPct = Math.min(coverMinPct ?? Infinity, ...c);
        }
      }
    }
    rows.push({ actor, gapMs, shareMinPct, shareMaxPct, coverMinPct, aa: lane.aa, stagger });
  }
  return rows;
}

// Prints the B1 table of a state (one row per roamer; the shares and the coverage read n/a where the rule does not apply).
function printB1(agg: StateAgg): void {
  const f = (v: number | null, d = 1): string => (v === null || !Number.isFinite(v) ? 'n/a' : v.toFixed(d));
  const lines: string[] = [`B1 ${agg.state.id} era ${agg.state.era} (gap s / walk share % min-max / coverage % min / idTwice / stagger pairs)`];
  for (const r of b1Rows(agg)) {
    lines.push(`  ${r.actor.padEnd(10)} gap ${f(r.gapMs / 1000, 2).padStart(6)}  walk ${f(r.shareMinPct).padStart(5)}-${f(r.shareMaxPct).padStart(5)}  ` +
      `cover ${f(r.coverMinPct, 0).padStart(4)}  idTwice ${r.aa}  stagger ${r.stagger}`);
  }
  console.log(lines.join('\n'));
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
    expect(byId.S8).toMatchObject({ era: 2, mode: 'fps8', framing: 's8', girlStage: 'mini', sensor: true, stare: false });
    expect(byId.S9).toMatchObject({ era: 2, mode: 'fps8', framing: 's9', girlStage: 'mini', sensor: true, holeDig: false });
    expect(byId.S9lb).toMatchObject({ era: 2, holeDig: true });
    expect(byId.S10).toMatchObject({ era: 3, framing: 's10', girlStage: 'mini', sensor: true, scraps: false, vents: false });
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
      printB1(agg);
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

  it('V3: holds 1-45 s, travel walks <= 6 s, static runs within their caps, unison and stare within their beats', () => {
    const a = getAgg();
    for (const lane of Object.values(a.lanes)) {
      if (lane === undefined) continue;
      expect(lane.holdMaxMs, `${spec.id} ${lane.actor} longest hold`).toBeLessThanOrEqual(T.v3HoldMs);
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

  // WP28b: the roamers are measured by the action gap (B1 below); V4 stays for the girl, who never moves.
  it('V4 (the girl): something changes at least every 20 s (era V 30 s)', () => {
    const a = getAgg();
    const lane = a.lanes.girl;
    if (lane === undefined || lane.gapMaxMs === 0) return;
    expect(lane.gapMaxMs, `${spec.id} girl longest visible gap`).toBeLessThanOrEqual(gapLimitMs(state, 'girl'));
  }, TIMEOUT_MS);

  it('B1 action gap: no roamer goes 12 s without an action (era IV: every conductor switch of the 100 ms runs; the exempt canon holds are not counted)', () => {
    const a = getAgg();
    for (const actor of ROAMERS) {
      for (const run of a.runs) {
        if (state.era === 4 && run.opts.dtMs !== 100) continue;
        const l = run.lanes.find((x) => x.actor === actor);
        if (l === undefined) continue;
        expect(l.track.maxActGapMs, `${spec.id} ${actor} seed ${run.opts.cycle} dt ${run.opts.dtMs} action gap`)
          .toBeLessThanOrEqual(WORLD_BEHAVIOUR.actionGapMs);
      }
    }
  }, TIMEOUT_MS);

  it('B1 walk share: the Inspector and the dog walk 12-20 % of every 5 min window (R1 floors per row; eras I-III and V; the seeds 1-5 at 100 ms summed)', () => {
    if (state.era === 4) return;
    const a = getAgg();
    for (const row of b1Rows(a)) {
      if (!WALKERS.includes(row.actor)) continue;
      expect(row.shareMinPct ?? 0, `${spec.id} ${row.actor} lowest 5 min walk share %`).toBeGreaterThanOrEqual(walkFloorOf(spec.id, row.actor));
      expect(row.shareMaxPct ?? 100, `${spec.id} ${row.actor} highest 5 min walk share %`).toBeLessThanOrEqual(T.b1WalkMaxPct);
    }
  }, TIMEOUT_MS);

  it('B1 coverage: each walker covers at least 75 % of its spot range in every 5 min window (eras I-III and V; seeds 1-4, the first 20 min)', () => {
    if (state.era === 4) return;
    const a = getAgg();
    for (const row of b1Rows(a)) {
      if (!WALKERS.includes(row.actor) || spotRangeOf(state, row.actor) === null) continue;
      expect(row.coverMinPct ?? 0, `${spec.id} ${row.actor} lowest 5 min spot coverage %`).toBeGreaterThanOrEqual(T.b1CoverPct);
    }
  }, TIMEOUT_MS);

  // WP28b (r2-FX4T, T1): a visible action (a look change, a walk or a reaction) starts at least every 10.5 s, every seed and step. Era IV keeps
  // the conductor switch gap of the B1 action gap test (its exempt hold is not counted there either).
  it('T1 visible gap: the Inspector, the dog and the crow start a visible action at least every 10.5 s (eras I-III and V; seeds 1-5, 16.7 and 100 ms)', () => {
    if (state.era === 4) return;
    const a = getAgg();
    for (const actor of ROAMERS) {
      for (const run of a.runs) {
        const l = run.lanes.find((x) => x.actor === actor);
        if (l === undefined) continue;
        expect(visibleGapMs(l.log, new Set<string>()), `${spec.id} ${actor} seed ${run.opts.cycle} dt ${run.opts.dtMs} visible gap ms`)
          .toBeLessThanOrEqual(T.t1VisibleMs);
      }
    }
  }, TIMEOUT_MS);

  // WP28b (r2-FX4T, T2): every 90 s window (30 s bins) covers at least 70 % of the walker's non-visit spot range (seeds 1-5 at 100 ms, 60 min).
  // The 5 min coverage (B1) is the 75 % bound above; this is the 90 s proxy of the in-game range check (roam.mjs B_range).
  it('T2 range: every 90 s window covers at least 70 % of the spot range of the Inspector and the dog (T2 floors per row; eras I-III and V; seeds 1-5 at 100 ms)', () => {
    if (state.era === 4) return;
    const a = getAgg();
    for (const actor of WALKERS) {
      const range = spotRangeOf(state, actor);
      if (range === null) continue;
      for (const run of a.runs) {
        if (run.opts.dtMs !== 100) continue;
        const l = run.lanes.find((x) => x.actor === actor);
        if (l === undefined) continue;
        const cov = extentCoverages(l.track.xLo, l.track.xHi, bins(T.t2WindowMs), bins(SIM_MINUTES * MIN_MS), range).map((v) => 100 * v);
        expect(Math.min(...cov), `${spec.id} ${actor} seed ${run.opts.cycle} lowest 90 s spot coverage %`).toBeGreaterThanOrEqual(t2FloorOf(spec.id, actor));
      }
    }
  }, TIMEOUT_MS);

  it('B1 ids and walks: no activity id twice in a row, and no two walkers start a walk within 1 s (the drawn starts)', () => {
    const a = getAgg();
    for (const row of b1Rows(a)) {
      expect(row.aa, `${spec.id} ${row.actor} adjacent equal ids`).toBe(0);
      expect(row.stagger, `${spec.id} walk starts within ${WORLD_BEHAVIOUR.walkStaggerMs} ms of another walker`).toBe(0);
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
        const run = simulate(state, { cycle: PLAY_CYCLE, k0, dtMs: dt, minutes: 10 }, ACTION_EXEMPT);
        const cells: string[] = [];
        for (const lane of run.lanes) {
          const w = windowCounts(lane.log, 10 * MIN_MS, 10 * MIN_MS, STEP_MS);
          const looks = w.looks[0] ?? 0;
          const ids = w.ids[0] ?? 0;
          // WP28b: the roamers in the first window by the action gap (B1), the girl by V4.
          const roamer = ROAMERS.includes(lane.actor);
          const gap = roamer ? lane.track.maxActGapMs : lane.track.maxGapMs;
          cells.push(`${lane.actor} ${looks}/${ids}/${(gap / 1000).toFixed(1)}`);
          const want = V1_TARGET[spec.id]?.[lane.actor];
          if (want !== undefined) {
            expect(looks, `${spec.id} ${lane.actor} k0 ${k0} dt ${dt} first window looks`).toBeGreaterThanOrEqual(want);
          }
          const limit = roamer ? WORLD_BEHAVIOUR.actionGapMs : gapLimitMs(state, lane.actor);
          // Era IV's switches fall on the 2.4 s beats: at 16.7 ms steps a switch is drawn up to one step late, so the gate reads the 100 ms runs.
          if (!(roamer && state.era === 4 && dt !== 100)) {
            expect(gap, `${spec.id} ${lane.actor} k0 ${k0} dt ${dt} first window ${roamer ? 'action gap' : 'gap'}`).toBeLessThanOrEqual(limit);
          }
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

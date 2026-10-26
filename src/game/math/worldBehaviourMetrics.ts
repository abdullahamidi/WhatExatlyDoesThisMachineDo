// Living world behaviour metrics (WP24 T3d, plan A2): the era states the game derives, the simulation driver over the real runners, and
// the measures V1-V8 read on what the runners draw. Why: the scheduler's acceptance is a set of numbers over simulated time, so they are
// measured with the real maths (deriveWorldState, placeCast, framingKey), the real runners (createBehaviourRunner, one conductor) and the
// cue schedules the director runs (ventPuffAt, gustAt, the ring gap). This module measures only; the targets live in the test.
// Imported by tests only. Pure: no Phaser, no DOM. Numbers come from src/data; the literals here are structural (indices, 0, 1, 2, the
// era numbers, the 4-gram) or unit conversions (ms per second and minute) or the plan's measurement definitions (named below).
import type { FramingKey, WorldPlacement } from '../../data/livingWorld';
import { WORLD_HOLE } from '../../data/livingWorld';
import type { TechId } from '../../data/types';
import { TIER_HEARTBEAT } from '../../data/machineTiers';
import { WORLD_BEHAVIOUR, WORLD_REPERTOIRE, WORLD_SPOTS, WORLD_STARE_SAFE, WORLD_UNISON } from '../../data/worldBehaviour';
import type { Activity, BehaviourActor, CueId, SpotId, UnisonClip, UnisonId } from '../../data/worldBehaviour';
import {
  PICK_STATS, activityLook, behaviourSeed, createBehaviourRunner, createUnisonConductor, cycleSeedOf, eligible, hash01,
} from './worldBehaviour';
import type { BehaviourCtx, BehaviourFrame, BehaviourLogEntry, BehaviourRunner } from './worldBehaviour';
import { gustAt, ventPuffAt, weatherOf } from './worldDay';
import { actorBand, framingKey, placeCast } from './worldPlacement';
import { deriveWorldState } from './worldState';
import type { WorldEra } from './worldState';
import type { PlaybackMode } from './worldPlayback';

// Unit conversions and structural identities.
const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const BEAT_MS: number = TIER_HEARTBEAT.periodMs;
const ACTORS: readonly BehaviourActor[] = ['inspector', 'dog', 'crow', 'girl'];
const ERA_II: WorldEra = 2;
const ERA_III: WorldEra = 3;
const ERA_IV: WorldEra = 4;
// Recent cues handed to the runners: a runner takes each cue once (its index above the last one it saw).
const CUE_KEEP = 8;
// The 4-activity runs of V2 and the 4-gram share.
const GRAM = 4;
// Plan A2 definitions (the measures, not the targets): a visible change moves the frame, the presented x or rise by 1 world px, or the
// alpha by 0.02; a lit lamp is alpha 0.5 and above (luminance toggles count its downward crossings).
const VISIBLE_PX = 1;
const VISIBLE_ALPHA = 0.02;
const LUMA_ON = 0.5;
// Clip classes (V7): a clip above HOLD_FPS, a burst, a fast irregular hold or a cue-driven action is an action; the rest are holds.
const HOLD_FPS = 2;
// The unison hold action (canon hold, V4 exempt in era IV) and the parked frame (the girl at the window, nothing drawn).
const UNISON_HOLD = 'hold';
const PARKED = 'parked';
// Downward alpha crossings kept for the toggle count.
const TOGGLE_KEEP = 8;

// The smoke stage buy lists, copied as literals: scripts/smoke/lib/common.mjs:9-16 (S7, S9, S11, S13, S15) and scripts/smoke/world.mjs:38-39
// (S8, S10). A buy is a tech id (one level per entry) or '@tech' / '@tech:n' (n levels; '@blueprint' is generatorBlueprint).
const rep = (id: string, n: number): string[] => Array.from({ length: n }, () => id);
const S7: readonly string[] = ['wornMotor', ...rep('gearRatio', 3), 'reinforcedCrank', ...rep('motorTuning', 5), 'flywheel', 'pistonArray',
  'improvedPistons'];
const S8: readonly string[] = [...S7, '@blueprint', 'generator'];
const S9: readonly string[] = [...S7, '@blueprint', 'generator', ...rep('motorRetrofit', 5), ...rep('copperWinding', 20), 'dynamoCrank',
  'capacitorBank', 'sparkGap', ...rep('transformer', 3), 'powerLines'];
const S10: readonly string[] = [...S9, '@substationBlueprint', 'boiler'];
const S11: readonly string[] = [...S10, ...rep('inductionHeater', 3), ...rep('firebox', 20), 'steamHammer', 'superheater',
  ...rep('condenser', 5), 'turbine', 'reliefValves', ...rep('bellowsDrive', 3), '@pressureVesselBlueprint'];
const S13: readonly string[] = [...S11, 'resonatorSpire', ...rep('crankServo', 3), ...rep('harmonicCoil', 25), ...rep('pressureResonator', 3),
  'echoCrank', 'phaseLock', ...rep('standingWave', 3), 'crystalLattice', ...rep('gridExciter', 5), '@harmonicConvergence'];
const S15: readonly string[] = [...S13, 'nullChamber', ...rep('containmentRing', 25), '@resonantSiphon:20', '@graviticAnchor:10',
  'inversionCrank', 'lensArray', ...rep('horizonField', 20), 'skyAperture', ...rep('mainsBackfeed', 5), ...rep('steamLance', 5),
  '@finalAlignment'];
export const STAGE_LISTS = { S7, S8, S9, S10, S11, S13, S15 } as const;

// One era state to simulate: a stage buy list, the lifetime EE (load-beneath), the observer flag (the stare) and the cycle (the girl's trace).
export interface EraSpec { id: string; buys: readonly string[]; lifetimeEe?: number; observerOne?: boolean; cycle?: number }
// The states of plan A2 (the unit states; S9 + load-beneath and S11 cycle 3+ are unit only, as the plan says). The load-beneath EE is
// WORLD_HOLE.loadBeneathEe.
export const ERA_SPECS: readonly EraSpec[] = [
  { id: 'S7', buys: S7 },
  { id: 'S8', buys: S8 },
  { id: 'S9', buys: S9 },
  { id: 'S9lb', buys: S9, lifetimeEe: WORLD_HOLE.loadBeneathEe },
  { id: 'S10', buys: S10 },
  { id: 'S11', buys: S11 },
  { id: 'S11c3', buys: S11, cycle: 3 },
  { id: 'S13pre', buys: S13 },
  { id: 'S13post', buys: S13, observerOne: true },
  { id: 'S15', buys: S15, observerOne: true },
];

// The placed cast of a state: where each runner stands (home x) and its spots (world x, from WORLD_SPOTS and the placement). A null entry
// is off-stage (no runner). The girl's home is her ground placement (0 on the mini stage, where she has none).
export interface ActorPlace { homeX: number; spots: readonly { id: SpotId; x: number }[] }
export interface EraState {
  id: string; era: WorldEra; framing: FramingKey; mode: PlaybackMode; levels: Record<string, number>; stare: boolean; reverse: boolean;
  vents: boolean; holeDig: boolean; sensor: boolean; scraps: boolean; girlStage: 'window' | 'mini' | 'ground'; gusts: boolean; cycle: number;
  cast: Record<BehaviourActor, ActorPlace | null>;
}

// Tech levels of a buy list: a plain id adds one level; '@blueprint' is generatorBlueprint; '@tech' is 1 and '@tech:n' is n.
function levelsOf(buys: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const raw of buys) {
    if (raw.startsWith('@')) {
      const [name = '', n] = raw.slice(1).split(':');
      out[name === 'blueprint' ? 'generatorBlueprint' : name] = n === undefined ? 1 : Number(n);
    } else {
      out[raw] = (out[raw] ?? 0) + 1;
    }
  }
  return out;
}

// The era state of a spec: deriveWorldState (tiers absent, the motor retrofit at the minimum hole tier), placeCast at the framing pose,
// and the runners' spots from WORLD_SPOTS[framing] at the placement x. The director resolves these the same way (T10).
export function eraStateOf(spec: EraSpec): EraState {
  const levels = levelsOf(spec.buys);
  const cycle = spec.cycle ?? 1;
  const world = deriveWorldState({
    levels: levels as Record<TechId, number>, lifetimeEe: spec.lifetimeEe ?? 0, cycle, edition: 'full', dogLies: false,
    motorRetrofitTier: 1, phase: 'none', observerOne: spec.observerOne ?? false,
  });
  const framing = framingKey(levels as Record<TechId, number>);
  const place = placeCast(levels as Record<TechId, number>, framing, undefined, cycle);
  const spotsOf = (actor: 'inspector' | 'dog', p: WorldPlacement): { id: SpotId; x: number }[] =>
    (WORLD_SPOTS[framing]?.[actor] ?? []).map((s) => ({ id: s.id, x: p.x + s.dx }));
  const ins = place.inspector;
  const dog = place.dog;
  const crow = place.crow;
  const girl = place.girl;
  const girlStage = world.girl.stageName === 'ground' ? 'ground' : world.girl.stageName === 'window' ? 'window' : 'mini';
  return {
    id: spec.id, era: world.era, framing, mode: world.mode, levels, stare: world.stare, reverse: world.reverse, vents: world.vents,
    holeDig: world.props.holeStage > 0, sensor: place.sensor7 !== null, scraps: place.scraps !== null && world.props.scraps > 0,
    girlStage, gusts: weatherOf(world.era, 0, 'none', world.vents).gusts, cycle,
    cast: {
      inspector: ins === null ? null : { homeX: ins.x, spots: spotsOf('inspector', ins) },
      dog: dog === null ? null : { homeX: dog.x, spots: spotsOf('dog', dog) },
      crow: crow === null ? null : { homeX: crow.x, spots: [] },
      girl: { homeX: girl?.x ?? 0, spots: [] },
    },
  };
}

// The seed of the cycle's shared streams (vent puffs, gusts, the unison conductor): cycleSeedOf, the seed the director gives the clocks and
// the conductor, so a production-seed run reads the same streams as the game (plan A2).
export function worldSeedOf(cycle: number): number {
  return cycleSeedOf(cycle);
}
// The gap to ring cue k (WORLD_BEHAVIOUR.ringEveryMs, drawn by hash). A model of the game's ring schedule from era II: the director rings
// at gaps of at least WORLD_VOICE_CONFIG.ringGapMs (300 s, ringIfDue); ringEveryMs (300-480 s) is the metrics' draw of that gap.
export function ringGapMs(k: number, world: number): number {
  const [lo, hi] = WORLD_BEHAVIOUR.ringEveryMs;
  return lo + (hi - lo) * hash01(world + WORLD_BEHAVIOUR.salts.ring, k);
}

// The simulation options: the cycle whose seeds the runners use (behaviourSeed(cycle, actor)), the first draw index (behaviourK0 of the
// played minutes), the step and the simulated minutes.
export interface SimOptions { cycle: number; k0: number; dtMs: number; minutes: number }

// What the metrics read of one runner over the run (online, per step; no per-step allocation).
export interface TrackStats {
  maxGapMs: number;          // V4: the longest gap between visible changes (canon holds paused)
  maxStaticMs: number;       // V3: the longest static run (time since the last visible change while the look is static)
  maxWalkRunMs: number;      // V3 / V8: the longest contiguous walk
  maxWalkDx: number;         // V6: the largest |dx| step on a walk frame
  maxRestDx: number;         // V6: the largest |dx| step on a rest frame (the crow's stutter and shift)
  walkMs: Float64Array;      // V8: walking time per simulated minute
  minHoldIvMs: number;       // V7: the shortest interval between two visible changes of one hold clip (sampled: one step of slack)
  maxActRate: number;        // V7: the most visible changes in any 1 s window of an action clip (per second)
  maxBurstMs: number;        // V7: the longest animated burst (the dig: from its first to its last animated change)
  maxDownToggles: number;    // V7: the most downward luminance crossings in any toggle window
  stareRest: number;         // A3: rest frames drawn outside WORLD_STARE_SAFE (counted under the stare only)
}

// One runner's run: its activity log (real lengths, empty durations removed), its pick counts, the free activities of its pool and the
// online stats.
export interface LaneRun { actor: BehaviourActor; log: BehaviourLogEntry[]; picks: number; forced: number; free: number; track: TrackStats }
export interface SimRun { state: EraState; opts: SimOptions; lanes: LaneRun[] }

// Visual class of an activity: static (derived from its look, under the state's stare), action or hold, and for a burst clip its
// gap (two frame periods: a longer rest ends the burst) and its rest frame (a change to it is not part of the burst).
interface Cls { isStatic: boolean; action: boolean; burst: boolean; burstGapMs: number; restFrame: string }
const NO_CLS: Cls = { isStatic: false, action: false, burst: false, burstGapMs: 0, restFrame: '' };

// A repertoire activity is an action when it moves faster than the hold rate, bursts, sets a fast irregular hold, or emits or is a cue.
function activityCls(actor: BehaviourActor, a: Activity, stare: boolean): Cls {
  const c = a.clip;
  const action = c.fps > HOLD_FPS || c.burst !== undefined || (c.frameHoldMs?.[0] ?? Infinity) < MS_PER_SECOND / HOLD_FPS
    || a.emits !== undefined || a.reaction !== undefined;
  const burst = c.burst !== undefined;
  return {
    isStatic: activityLook(actor, c, stare).static, action, burst, burstGapMs: burst ? (2 * MS_PER_SECOND) / c.fps : 0,
    restFrame: c.burst?.restFrame ?? '',
  };
}
// A unison action is an action when it runs above the hold rate or is an accent or a pulse (the beat-driven flashes).
function unisonCls(actor: BehaviourActor, clip: UnisonClip, stare: boolean): Cls {
  const action = clip.fps > HOLD_FPS || clip.accent !== undefined || clip.pulse === true;
  return { isStatic: activityLook(actor, clip, stare).static, action, burst: false, burstGapMs: 0, restFrame: '' };
}
// Visible changes kept per activity for the rate of V7 (the rate window is one second; the most a plan rate allows is six).
const CHG_KEEP = 8;
// The class of every activity an actor can run in an era (era IV: its unison set for the stare state).
function classMap(actor: BehaviourActor, era: WorldEra, stare: boolean): Map<string, Cls> {
  const out = new Map<string, Cls>();
  if (era === ERA_IV) {
    const set = stare ? WORLD_UNISON.map.post[actor] : WORLD_UNISON.map.pre[actor];
    for (const id of Object.keys(set) as UnisonId[]) {
      const clip = set[id];
      if (clip !== undefined) out.set(id, unisonCls(actor, clip, stare));
    }
    return out;
  }
  for (const a of WORLD_REPERTOIRE[actor][era] ?? []) out.set(a.id, activityCls(actor, a, stare));
  return out;
}

// The per-step tracker of one runner: visible changes (V4), static runs (V3), walks (V6, V8), intervals (V7), the stare (A3).
// Holds only numbers and the last frame; observe() allocates nothing.
class Track {
  private readonly actor: BehaviourActor;
  private readonly era: WorldEra;
  private readonly stare: boolean;
  private readonly dt: number;
  private readonly cls: Map<string, Cls>;
  private frame = '';
  private x = 0;
  private rise = 0;
  private alpha = 1;
  private act = '';
  private curCls: Cls = NO_CLS;
  private steps = 0;
  private changeAt = 0;
  private gapAcc = 0;
  private maxGap = 0;
  private maxStatic = 0;
  private walkRun = 0;
  private maxWalkRun = 0;
  private maxWalkDx = 0;
  private maxRestDx = 0;
  private readonly chgAt: Float64Array = new Float64Array(CHG_KEEP);
  private chgN = 0;
  private chgI = 0;
  private minHoldIv = Infinity;
  private maxActRate = 0;
  private burstStart = -1;
  private burstLast = -1;
  private maxBurst = 0;
  private lumaOn = true;
  private downs: number[] = [];
  private maxToggles = 0;
  private stareRest = 0;
  private readonly walkMs: Float64Array;
  private readonly toggleWindowMs: number;

  constructor(actor: BehaviourActor, era: WorldEra, stare: boolean, dt: number, minutes: number, cls: Map<string, Cls>,
    toggleWindowMs: number) {
    this.actor = actor;
    this.era = era;
    this.stare = stare;
    this.dt = dt;
    this.cls = cls;
    this.walkMs = new Float64Array(minutes);
    this.toggleWindowMs = toggleWindowMs;
  }

  observe(now: number, f: BehaviourFrame): void {
    const dt = this.dt;
    this.steps += 1;
    if (f.activity !== this.act) {
      this.act = f.activity;
      this.curCls = this.cls.get(f.activity) ?? NO_CLS;
      this.chgN = 0;
      this.chgI = 0;
      this.burstStart = -1;
      this.burstLast = -1;
    }
    const parked = f.activity === PARKED;
    const exempt = this.era === ERA_IV && f.activity === UNISON_HOLD;
    const walking = f.walking;
    const dxAbs = Math.abs(f.x - this.x);
    // The first step only sets the presented state (there is no earlier frame to change from).
    const changed = this.steps > 1 && (f.frame !== this.frame || dxAbs >= VISIBLE_PX || Math.abs(f.risePx - this.rise) >= VISIBLE_PX
      || Math.abs(f.alpha - this.alpha) >= VISIBLE_ALPHA);
    // V6: the step of the presented x (the first step has no previous x).
    if (this.steps > 1 && !parked) {
      if (walking) {
        if (dxAbs > this.maxWalkDx) this.maxWalkDx = dxAbs;
      } else if (dxAbs > this.maxRestDx) {
        this.maxRestDx = dxAbs;
      }
    }
    // V8 and the walk runs (V3).
    if (walking) {
      this.walkRun += dt;
      const minute = Math.min(this.walkMs.length - 1, Math.floor(now / MS_PER_MINUTE));
      this.walkMs[minute] = (this.walkMs[minute] ?? 0) + dt;
    } else {
      if (this.walkRun > this.maxWalkRun) this.maxWalkRun = this.walkRun;
      this.walkRun = 0;
    }
    // V4: the clock of the gap between visible changes; canon holds do not run it.
    if (!parked && !exempt) this.gapAcc += dt;
    if (changed && !parked) {
      if (this.gapAcc > this.maxGap) this.maxGap = this.gapAcc;
      this.gapAcc = 0;
      this.changeAt = now;
    }
    // V3: the static run counts from the last visible change while the look is static (walks are not static).
    if (!parked && !walking && this.curCls.isStatic) {
      const run = now - this.changeAt;
      if (run > this.maxStatic) this.maxStatic = run;
    }
    // V7: the visible changes per second of one activity (walks excluded: V6 owns them), the animated bursts (a change to the rest frame
    // is not animation) and the luminance toggles.
    if (changed && !parked && !walking) {
      this.chgAt[this.chgI] = now;
      this.chgI = (this.chgI + 1) % CHG_KEEP;
      if (this.chgN < CHG_KEEP) this.chgN += 1;
      if (this.curCls.action) {
        let inSecond = 0;
        for (let k = 0; k < this.chgN; k++) if ((this.chgAt[k] ?? 0) > now - MS_PER_SECOND) inSecond += 1;
        if (inSecond > this.maxActRate) this.maxActRate = inSecond;
      } else if (this.chgN >= 2) {
        const prev = this.chgAt[(this.chgI + CHG_KEEP - 2) % CHG_KEEP] ?? now;
        if (now - prev < this.minHoldIv) this.minHoldIv = now - prev;
      }
      if (this.curCls.burst && f.frame !== this.curCls.restFrame) {
        if (this.burstLast < 0 || now - this.burstLast > this.curCls.burstGapMs) this.burstStart = now;
        this.burstLast = now;
        if (now - this.burstStart > this.maxBurst) this.maxBurst = now - this.burstStart;
      }
    }
    const lumaOn = f.alpha >= LUMA_ON;
    if (this.steps > 1 && this.lumaOn && !lumaOn) {
      this.downs.push(now);
      if (this.downs.length > TOGGLE_KEEP) this.downs.shift();
      let count = 0;
      for (const t of this.downs) if (t > now - this.toggleWindowMs) count += 1;
      if (count > this.maxToggles) this.maxToggles = count;
    }
    this.lumaOn = lumaOn;
    // A3: under the stare a rest frame must be a camera-facing one (the runner draws raw frames; the renderer applies stareFrame).
    if (this.stare && !parked && !walking && !WORLD_STARE_SAFE[this.actor].includes(f.frame)) this.stareRest += 1;
    this.frame = f.frame;
    this.x = f.x;
    this.rise = f.risePx;
    this.alpha = f.alpha;
  }

  finish(): TrackStats {
    if (this.gapAcc > this.maxGap) this.maxGap = this.gapAcc;
    if (this.walkRun > this.maxWalkRun) this.maxWalkRun = this.walkRun;
    return {
      maxGapMs: this.maxGap, maxStaticMs: this.maxStatic, maxWalkRunMs: this.maxWalkRun, maxWalkDx: this.maxWalkDx,
      maxRestDx: this.maxRestDx, walkMs: this.walkMs, minHoldIvMs: this.minHoldIv, maxActRate: this.maxActRate, maxBurstMs: this.maxBurst,
      maxDownToggles: this.maxToggles, stareRest: this.stareRest,
    };
  }
}

// Free activities of a runner's pool (weight above 0). Era IV has no pool: its unison set plays (the conductor picks, not pickNext).
function freeCount(actor: BehaviourActor, era: WorldEra, stare: boolean, ctx: BehaviourCtx): number {
  if (era === ERA_IV) return (stare ? WORLD_UNISON.post : WORLD_UNISON.pre).length;
  return eligible(actor, era, ctx).filter((a) => a.weight > 0).length;
}

interface Lane {
  actor: BehaviourActor; runner: BehaviourRunner; ctx: BehaviourCtx; log: BehaviourLogEntry[]; track: Track; picks: number; forced: number;
  free: number;
}
// The context of one runner of a state: the state flags, the actor's home and spots, the shared beat and cue lists.
function ctxOf(state: EraState, actor: BehaviourActor, beat: BehaviourCtx['beat'], cues: BehaviourCtx['cues']): BehaviourCtx | null {
  const place = state.cast[actor];
  if (place === null) return null;
  return {
    era: state.era, mode: state.mode, crankSteps: 0, reduced: false, stare: state.stare, reverse: state.reverse, vents: state.vents,
    holeDig: state.holeDig, sensor: state.sensor, scraps: state.scraps, demoHold: false, paused: false, homeX: place.homeX,
    girlStage: state.girlStage, spots: place.spots, cues, beat,
  };
}

// Plays one state for opts.minutes of simulated time in steps of opts.dtMs: the real runners of the cast (one conductor), the cue
// schedules (vent puffs in era III with the vents, the ring gap from era II, gust events while the era's weather gusts, and the emitted
// cues of the runners), the 2.4 s beats. Every runner reads the same recent-cue list; the metrics are taken online.
export function simulate(state: EraState, opts: SimOptions): SimRun {
  const steps = Math.round((opts.minutes * MS_PER_MINUTE) / opts.dtMs);
  const world = worldSeedOf(opts.cycle);
  const conductor = createUnisonConductor(world);
  const beat = { downbeat: false, index: -1 };
  const cues: { id: CueId; index: number }[] = [];
  let cueCount = 0;
  const pushCue = (id: CueId): void => {
    cueCount += 1;
    cues.push({ id, index: cueCount });
    if (cues.length > CUE_KEEP) cues.shift();
  };
  const lanes: Lane[] = [];
  const actors = ACTORS.filter((a) => state.cast[a] !== null);
  for (const actor of actors) {
    const ctx = ctxOf(state, actor, beat, cues);
    const place = state.cast[actor];
    if (ctx === null || place === null) continue;
    const seed = behaviourSeed(opts.cycle, actor);
    const log: BehaviourLogEntry[] = [];
    const runner = createBehaviourRunner(actor, seed, conductor, (e) => { log.push(e); });
    runner.reset(seed, opts.k0, place.homeX);
    lanes.push({
      actor, runner, ctx, log, picks: 0, forced: 0, free: freeCount(actor, state.era, state.stare, ctx),
      track: new Track(actor, state.era, state.stare, opts.dtMs, opts.minutes, classMap(actor, state.era, state.stare),
        MS_PER_SECOND),
    });
  }
  // Timed cue chains: vent puffs (era III with the vents), rings (from era II), gusts (while the weather gusts).
  const ventOn = state.era === ERA_III && state.vents;
  let ventAt = ventOn ? ventPuffAt(0, world) : Infinity;
  let ventK = 0;
  let ringAt = state.era >= ERA_II ? ringGapMs(0, world) : Infinity;
  let ringK = 0;
  let gustStart = Infinity;
  let gustLen = 0;
  let gustK = 0;
  if (state.gusts) {
    const g = gustAt(0, world);
    gustStart = g.afterMs;
    gustLen = g.lengthMs;
  }
  for (let i = 0; i < steps; i++) {
    const now = (i + 1) * opts.dtMs;
    const index = Math.floor(now / BEAT_MS);
    beat.downbeat = index !== beat.index;
    beat.index = index;
    while (ventAt <= now) {
      pushCue('ventPuff');
      ventK += 1;
      ventAt += ventPuffAt(ventK, world);
    }
    while (ringAt <= now) {
      pushCue('ring');
      ringK += 1;
      ringAt += ringGapMs(ringK, world);
    }
    while (gustStart <= now) {
      pushCue('gust');
      const endMs = gustStart + gustLen;
      gustK += 1;
      const g = gustAt(gustK, world);
      gustStart = endMs + g.afterMs;
      gustLen = g.lengthMs;
    }
    for (const lane of lanes) {
      const picks0 = PICK_STATS.picks;
      const forced0 = PICK_STATS.forced;
      const frame = lane.runner.step(opts.dtMs, lane.ctx);
      lane.picks += PICK_STATS.picks - picks0;
      lane.forced += PICK_STATS.forced - forced0;
      if (frame.emitted !== null) pushCue(frame.emitted);
      lane.track.observe(now, frame);
    }
  }
  return {
    state, opts,
    lanes: lanes.map((l) => ({
      actor: l.actor, log: l.log.filter((e) => e.durMs > 0), picks: l.picks, forced: l.forced, free: l.free, track: l.track.finish(),
    })),
  };
}

// ---- Measures over a run ----

// The end of a log entry (its start plus its length).
function endOf(e: BehaviourLogEntry): number {
  return e.atMs + e.durMs;
}

// V1: the distinct looks (and ids) of the activities that overlap each window of widthMs, stepped by stepMs, over totalMs.
export function windowCounts(log: readonly BehaviourLogEntry[], totalMs: number, widthMs: number, stepMs: number):
  { looks: number[]; ids: number[] } {
  const looks: number[] = [];
  const ids: number[] = [];
  let lo = 0;
  for (let w0 = 0; w0 + widthMs <= totalMs; w0 += stepMs) {
    while (lo < log.length) {
      const e = log[lo];
      if (e === undefined || endOf(e) > w0) break;
      lo += 1;
    }
    const sl = new Set<string>();
    const si = new Set<string>();
    for (let i = lo; i < log.length; i++) {
      const e = log[i];
      if (e === undefined || e.atMs >= w0 + widthMs) break;
      sl.add(e.look);
      si.add(e.activity);
    }
    looks.push(sl.size);
    ids.push(si.size);
  }
  return { looks, ids };
}

// V2: A to A count, the exact 4-activity runs (ids and holds in units of unitMs) that recur within repeatWindowMs, the longest id-only
// period-2, 3 or 4 run (picks) and the top id 4-gram share (%).
export interface LoopStats { aa: number; repeats: number; period: number; top4Pct: number }
export function loopStats(log: readonly BehaviourLogEntry[], unitMs: number, repeatWindowMs: number): LoopStats {
  const n = log.length;
  const ids = log.map((e) => e.activity);
  const starts = log.map((e) => e.atMs);
  let aa = 0;
  for (let i = 1; i < n; i++) if (ids[i] === ids[i - 1]) aa += 1;
  const keyNum = new Map<string, number>();
  const keys: number[] = [];
  for (let i = 0; i + GRAM <= n; i++) {
    const parts: string[] = [];
    for (let j = 0; j < GRAM; j++) {
      const e = log[i + j];
      parts.push(`${e?.activity ?? ''}:${Math.round((e?.durMs ?? 0) / unitMs)}`);
    }
    const s = parts.join('>');
    let id = keyNum.get(s);
    if (id === undefined) {
      id = keyNum.size;
      keyNum.set(s, id);
    }
    keys.push(id);
  }
  let repeats = 0;
  for (let i = 0; i < keys.length; i++) {
    const si = starts[i] ?? 0;
    for (let j = i + 1; j < keys.length; j++) {
      if ((starts[j] ?? 0) - si > repeatWindowMs) break;
      if (keys[j] === keys[i]) repeats += 1;
    }
  }
  let period = 0;
  for (let p = 2; p <= GRAM; p++) {
    let run = 0;
    for (let i = p; i < n; i++) {
      if (ids[i] === ids[i - p]) {
        run += 1;
        if (run > period) period = run;
      } else {
        run = 0;
      }
    }
  }
  const grams = new Map<string, number>();
  for (let i = 0; i + GRAM <= n; i++) {
    const g = ids.slice(i, i + GRAM).join('>');
    grams.set(g, (grams.get(g) ?? 0) + 1);
  }
  let top = 0;
  for (const c of grams.values()) if (c > top) top = c;
  const total = Math.max(1, n - GRAM + 1);
  return { aa, repeats, period, top4Pct: (100 * top) / total };
}

// V5: the share of starts that lie within windowMs of another denizen's start (over all denizens; and the worst ordered pair). The starts
// of each denizen are ascending.
export function lockstep(starts: readonly (readonly number[])[], windowMs: number): { anyPct: number; pairPct: number } {
  let total = 0;
  let matchedAny = 0;
  let worstPair = 0;
  starts.forEach((si, i) => {
    total += si.length;
    const any = new Uint8Array(si.length);
    starts.forEach((sj, j) => {
      if (i === j || si.length === 0) return;
      let p = 0;
      let matched = 0;
      si.forEach((s, k) => {
        while (p < sj.length && (sj[p] ?? Infinity) < s - windowMs) p += 1;
        if (p < sj.length && (sj[p] ?? Infinity) <= s + windowMs) {
          matched += 1;
          any[k] = 1;
        }
      });
      const pct = (100 * matched) / si.length;
      if (pct > worstPair) worstPair = pct;
    });
    for (const a of any) matchedAny += a;
  });
  return { anyPct: total === 0 ? 0 : (100 * matchedAny) / total, pairPct: worstPair };
}

// V5 (era IV): the share of switch times (action starts) on a downbeat: within toleranceMs after a beat boundary (or before the next one).
export function downbeatShare(starts: readonly number[], beatMs: number, toleranceMs: number): number {
  if (starts.length === 0) return 100;
  let on = 0;
  for (const s of starts) {
    const r = s - Math.floor(s / beatMs) * beatMs;
    if (r <= toleranceMs || beatMs - r <= toleranceMs) on += 1;
  }
  return (100 * on) / starts.length;
}

// V8: the largest walking share of any window of windowBins minutes (the bins are minutes; the window is windowMs long).
export function maxWalkShare(walkMs: Float64Array, windowBins: number, windowMs: number): number {
  let max = 0;
  for (let w = 0; w + windowBins <= walkMs.length; w++) {
    let sum = 0;
    for (let k = 0; k < windowBins; k++) sum += walkMs[w + k] ?? 0;
    if (sum / windowMs > max) max = sum / windowMs;
  }
  return max;
}

// The starts of a log (ascending) that begin after time zero: reactions and actions alike.
export function startsOf(log: readonly BehaviourLogEntry[]): number[] {
  return log.filter((e) => e.atMs > 0).map((e) => e.atMs);
}

// The entries that ended on their own: not cut short by a reaction (the next entry is a reaction that starts at its end), and not an
// activity that wakes on a cue (wakeIds: its end is the cue, the sleep).
export function naturalEntries(log: readonly BehaviourLogEntry[], wakeIds: ReadonlySet<string>): BehaviourLogEntry[] {
  return log.filter((e, i) => {
    if (wakeIds.has(e.activity)) return false;
    const next = log[i + 1];
    return !(next !== undefined && next.reaction && Math.abs(next.atMs - endOf(e)) < 1e-6);
  });
}

// The ids of the activities that a cue can end (wakeOn) in the repertoire of every actor and era.
export function wakeIdsOf(): Set<string> {
  const out = new Set<string>();
  for (const actor of ACTORS) {
    for (const list of Object.values(WORLD_REPERTOIRE[actor])) {
      for (const a of list ?? []) if (a.wakeOn !== undefined) out.add(a.id);
    }
  }
  return out;
}

// Whether a world x lies inside the actor band of the state's framing (worldPlacement.actorBand, the same usable-wing rule as placeOne).
export function actorBandOk(state: EraState, actor: 'inspector' | 'dog', x: number): boolean {
  const band = actorBand(state.framing, undefined, state.levels as Record<TechId, number>, actor);
  return band !== null && x >= band.min && x <= band.max;
}

// One runner of a state built for a single-actor check: its runner and context (the test drives the steps itself).
export function laneRunner(state: EraState, actor: BehaviourActor, opts: SimOptions):
  { runner: BehaviourRunner; ctx: BehaviourCtx; beat: BehaviourCtx['beat']; cues: BehaviourCtx['cues'] } | null {
  const beat = { downbeat: false, index: -1 };
  const cues: { id: CueId; index: number }[] = [];
  const ctx = ctxOf(state, actor, beat, cues);
  const place = state.cast[actor];
  if (ctx === null || place === null) return null;
  const seed = behaviourSeed(opts.cycle, actor);
  const runner = createBehaviourRunner(actor, seed, createUnisonConductor(worldSeedOf(opts.cycle)));
  runner.reset(seed, opts.k0, place.homeX);
  return { runner, ctx, beat, cues };
}

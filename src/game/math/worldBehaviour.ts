// Living world behaviour scheduler (WP24 T3a): the pick rule that decides what each denizen does next (WP24 C2, Revision 2 rules 1-5).
// At every activity end pickNext filters the free activities (cooldown, no walk right after a walk, reachable travel, a static activity
// needs room in its static run), weighs them (weight, the follow multiplier of the current id, the recency damp for the id two picks
// back), chooses by hash (choice 2k+1, hold 2k+2), and falls back. The girl merges a repeatable id or extends a hold clip past its cap;
// the roamers never start their current id again (WP28b) and fall back to a micro activity, the least recently used id, or a restart.
// Travel picks a spot by id and gives the walk its time: ceil(d / 8) drawn frames, d the Euclidean walk length (WP28b: the lane counts).
// The walker's position is a point (x, lane): a spot, or a point cut short by halt (mem.at, WP28b); plain travel never walks to a v spot.
// Why: the cast looks alive without loops, and the same seed and inputs replay the same sequence (boundaries are analytic, so the
// clock step does not change it). activityLook is the rendered view of the same clips, so the variety metrics read what is drawn.
// Pure: no Phaser, no DOM. Every number lives in src/data/worldBehaviour.ts; the only literals here are structural.
// The runner (T3b timed path, T3c cues, crank, era change, era IV) and the unison conductor (T3c) are at the end of this file.
// Exports for the runner: Look, Seg, Memory, PickEnv, StartOpts, newMemory, eligible, condHolds, pickNext, startSeg, visibleChangeMs,
//   capOf, holdClip, hash01, restFlip, cycleSeedOf, walkFrameOf, frameHoldIndex (the reference of the cached HoldWalk), newHoldWalk,
//   frameHoldWalk. WP28b: findSidesOf (the Find sides of an actor), findOuterOf (its outer test, no allocation) and visitFor (the stand of a
//   woken Splice) for the Director.
// startSeg(mem, def, env, nowMs, { react, holdMs, look }) starts any activity outside a pick (a reaction, a unison action with its own
// clip look and a fixed hold, the debug pin) and consumes one draw index, exactly as a pick does. The caller passes the segment it
// ends as `cur` to pickNext; startSeg closes the last started segment itself (cooldown and last use at nowMs).
// Memory.run is the static run of the last started segment (a static continuation keeps the run); Memory.hist keeps the last two ids.
import { playbackFps } from './worldPlayback';
import type { PlaybackMode } from './worldPlayback';
import type { WorldEra } from './worldState';
import { MACHINE_ANCHOR } from '../../data/world';
import { WORLD_PLAYBACK } from '../../data/livingWorld';
import type { FramingKey } from '../../data/livingWorld';
import type { EraNumber } from '../../data/eras';
import type { TechId } from '../../data/types';
import { TIER_HEARTBEAT } from '../../data/machineTiers';
import { WORLD_ERA_ENV } from '../../data/worldEras';
import {
  WORLD_BEHAVIOUR, WORLD_REACT, WORLD_REPERTOIRE, WORLD_STARE_SAFE, WORLD_UNISON, WORLD_VISITS, WORLD_WALK,
} from '../../data/worldBehaviour';
import type {
  Activity, BehaviourActor, BehaviourCond, Clip, CueId, SpotId, UnisonAction, UnisonClip, UnisonId,
} from '../../data/worldBehaviour';

// Contracts of the runner and the unison conductor (WP24 C2).
// A spot as the scheduler reads it: its id, its feet x and its lane (feet y = GROUND_Y + lane; WP28b: lane is optional, 0 when absent).
export interface SpotLike { id: SpotId; x: number; lane?: number }
export interface BehaviourCtx {
  era: WorldEra; mode: PlaybackMode; crankSteps: number; reduced: boolean; stare: boolean; reverse: boolean;
  vents: boolean; holeDig: boolean; sensor: boolean; scraps: boolean; demoHold: boolean; paused: boolean; homeX: number;
  girlStage: 'window' | 'mini' | 'ground'; spots: readonly SpotLike[];
  // delayMs (WP28b) gives a cue's reaction delay per actor (else the cue's band draws it).
  cues: readonly { id: CueId; index: number; delayMs?: Partial<Record<BehaviourActor, number>> }[];
  beat: { downbeat: boolean; index: number }; settle?: boolean;
  // WP28b: the walk gate says another walker started a walk within walkStaggerMs; travel activities are dropped while it is set.
  walkBlocked: boolean;
  // WP28b: hopOk lets the crow start its free hop (the Director, never in era IV). findOuter / findInner: a Find lies on this actor's outer or
  // inner side of MACHINE_ANCHOR.x; findX is its world x (null: none). visitSpot is the id of the woken Splice this actor visits (null: none).
  hopOk: boolean; findOuter: boolean; findInner: boolean; findX: number | null; visitSpot: SpotId | null;
  // WP28b (r2-FX4G): the cast's start gate (createStartGate); absent: no pick is held for another denizen's start.
  startGate?: StartGate;
  // WP28b (r2-FX4G, V5 fix): added to this runner's own clock to give a time on the cast's shared clock (only the start gate reads it). Absent: 0.
  clockOffsetMs?: number;
}
export interface BehaviourFrame {
  activity: string; step: number; frame: string; flip: boolean; x: number; walking: boolean;
  poseSet: 'base' | 'umbrella'; risePx: number; alpha: number; emitted: CueId | null;
  // WP28b: the feet lane of the drawn frame (the spot's lane at rest; interpolated along a walk).
  lane: number;
}
export interface BehaviourLogEntry { activity: string; atMs: number; durMs: number; walked: boolean; reaction: boolean; look: string }
export interface BehaviourRunner {
  step(dtMs: number, ctx: BehaviourCtx): BehaviourFrame; rehome(homeX: number): void;
  reset(seed: number, k0: number, homeX: number): void; next(activity: string): boolean;
  // WP28a T15a: after delayMs of runner time a walk in progress first arrives, then the current segment ends and `activity` starts as a
  // reaction. False when the id is not eligible for the actor in this era, or the runner is joined to the unison conductor (era IV).
  interrupt(activity: string, delayMs: number): boolean;
  // WP28b: cuts a walk in progress with more than haltMinLeftMs left at the point of its last drawn tick; the hold starts there. True when it
  // cut. No effect in era IV or while joined to the conductor. Callers: the Director's poke answer.
  halt(): boolean;
  snapshot(): { activity: string; sinceMs: number; k: number; x: number; walking: boolean; look: string; clockMs: number };
  // WP28b (r2-FX4G, V5 fix): the runner's clock alone (snapshot builds an object; the Director reads this every step).
  clockMs(): number;
}
export interface UnisonConductor {
  step(beat: { downbeat: boolean; index: number }, post: boolean): void;
  current(): { id: UnisonId; post: boolean; startBeat: number; endBeat: number }; next(id: UnisonId): boolean; reset(seed: number): void;
}

// What an activity draws after the stare map. key = the sorted shown frames plus the tags (+dx, +rise, +pulse, +a<alpha>, +fa);
// first / last = the first and last frame of the clip; static = one shown frame and no tag (its static run counts from the last change).
export interface Look { key: string; first: string; last: string; static: boolean }
// One scheduled segment: an optional walk from (fromX, fromLane) to (toX, toLane) (toSpot), then the hold. endMs = startMs + walkMs + holdMs.
// runStartMs = the start of the static run it belongs to (the hold start after a walk, or the earlier run it continues).
export interface Seg {
  id: string; def: Activity; startMs: number; walkMs: number; holdMs: number; endMs: number; react: boolean; look: Look;
  runStartMs: number; fromX: number; toX: number; toSpot: number; fromLane: number; toLane: number;
}
// A point of the stage (feet x and lane). WP28b: the walker stands on a spot, or on a point a halt cut its walk at (Memory.at).
export interface StagePoint { x: number; lane: number }
// The scheduler memory of one runner: the seed, the next draw index k, the spot index and the one before it, the last end and last
// use time of each id (cooldowns, least recently used), the last two started ids (the recency damp), the static run of the last
// started segment (run: null before the first start) and the point the walker stands on when that is not a spot (at: null = the spot).
export interface Memory {
  seed: number; k: number; spot: number; prevSpot: number; lastEndMs: Map<string, number>; lastUseMs: Map<string, number>;
  hist: string[]; run: { static: boolean; last: string; runStartMs: number } | null; at: StagePoint | null;
  // WP28b (r2-FX4T): the time the walker last reached each spot id (absent: never). A travel picks the spot reached longest ago.
  seen: Map<string, number>;
}
// What a pick needs from its runner: the actor (looks), the era (caps), the stare (looks), the spots (world x, lane) and the fps of the walk.
// WP28b: visitSpot and findX are the runner's ctx values (the visit and find travel kinds read them).
export interface PickEnv {
  actor: BehaviourActor; era: WorldEra; stare: boolean; spots: readonly SpotLike[]; fps: number; visitSpot: SpotId | null; findX: number | null;
}
// Optional fixed hold (a reaction or a unison action), a pre-built look (a unison clip), and whether the start is a reaction.
export interface StartOpts { react?: boolean; holdMs?: number; look?: Look }

// Pick counters (WP24 T3d, the V2 forced share): pickNext counts every call; a pick with at most one candidate (the forced picks, the
// fallback included) counts as forced. Module state: the metrics read deltas around one runner step. No player path reads it.
export const PICK_STATS = { picks: 0, forced: 0 };

// The era V caps (static runs are longer there: WORLD_BEHAVIOUR.capMs.staticV). Structural: the era number, not a tuning value.
const ERA_V: WorldEra = 5;
// Ids kept in Memory.hist: the recency damp needs the id two picks back, which is the second-to-last start at a pick.
const RECENT_IDS = 2;

// Sine hash of two numbers in [0, 1): deterministic, no random source (as worldPlayback.ts and finale.ts).
export function hash01(a: number, b: number): number {
  const f = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return f - Math.floor(f);
}

// Seed of one runner in one cycle (D14): seed + cycleSalt x cycle + actorSalt[actor].
export function behaviourSeed(cycle: number, actor: BehaviourActor): number {
  return WORLD_BEHAVIOUR.seed + WORLD_BEHAVIOUR.cycleSalt * cycle + WORLD_BEHAVIOUR.actorSalt[actor];
}

// Seed of the cycle's shared streams (the unison conductor and the day clock; WP24 D14): seed + cycleSalt x cycle + salts.conductor.
export function cycleSeedOf(cycle: number): number {
  return WORLD_BEHAVIOUR.seed + WORLD_BEHAVIOUR.cycleSalt * cycle + WORLD_BEHAVIOUR.salts.conductor;
}

// Draw index a session starts at (D14): whole active minutes x k0Stride. Read at boot and at a cycle start; no save field.
export function behaviourK0(activeSeconds: number): number {
  const minutes = Number.isFinite(activeSeconds) ? Math.floor(Math.max(0, activeSeconds) / 60) : 0;
  return minutes * WORLD_BEHAVIOUR.k0Stride;
}

// The frame an actor shows under the stare (WP24 D2): camera-facing frames stay, a walk stays (the walker turns in its own frames), any
// other frame becomes the actor's front (the first WORLD_STARE_SAFE entry). With the stare off nothing changes.
export function stareFrame(actor: BehaviourActor, frame: string, walking: boolean, stare: boolean): string {
  const safe = WORLD_STARE_SAFE[actor];
  if (!stare || walking || safe.includes(frame)) return frame;
  return safe[0] ?? frame;
}

// The look of a clip: the shown frames (the frames, the dig rest frame and the unison accent) after the stare map, as a sorted set,
// with the tags of what moves besides the frames. Static is derived here, never a data flag.
export function activityLook(actor: BehaviourActor, clip: Clip & { risePx?: number; pulse?: true; accent?: string }, stare: boolean): Look {
  const shown = clip.frames.map((f) => stareFrame(actor, f, false, stare));
  const extra: string[] = [];
  if (clip.burst !== undefined) extra.push(stareFrame(actor, clip.burst.restFrame, false, stare));
  if (clip.accent !== undefined) extra.push(stareFrame(actor, clip.accent, false, stare));
  const frames = [...new Set([...shown, ...extra])].sort();
  const tags: string[] = [];
  if (clip.dxPx?.some((d) => d !== 0)) tags.push('+dx');
  if ((clip.risePx ?? 0) > 0) tags.push('+rise');
  if (clip.pulse === true) tags.push('+pulse');
  if (clip.alpha !== undefined) tags.push(`+a${clip.alpha}`);
  if (clip.frameAlpha !== undefined) tags.push('+fa');
  return {
    key: frames.join('/') + tags.join(''), first: shown[0] ?? '', last: shown[shown.length - 1] ?? '',
    static: frames.length === 1 && tags.length === 0,
  };
}

// The shortest gap between two visible frame changes: the first frame hold when frames hold by hash, else one frame of the fps.
// A one-frame clip never changes (Infinity).
export function visibleChangeMs(clip: Clip): number {
  if (clip.frames.length <= 1) return Infinity;
  if (clip.frameHoldMs !== undefined) return clip.frameHoldMs[0];
  return 1000 / clip.fps;
}

// Hold cap of an activity: its capMs (the crow's frozen), else the static run cap for a static look (era V has the longer one), else the
// hold cap.
export function capOf(def: Activity, look: Look, era: WorldEra): number {
  if (def.capMs !== undefined) return def.capMs;
  if (look.static) return era === ERA_V ? WORLD_BEHAVIOUR.capMs.staticV : WORLD_BEHAVIOUR.capMs.staticEarly;
  return WORLD_BEHAVIOUR.capMs.hold;
}

// A hold clip may be extended below its cap (rule 4): repeatable, static, or changing no faster than the minimum hold, never a burst.
// The threshold is WORLD_BEHAVIOUR.minHoldMs (500 ms, the same figure): T3d moves it to its own data key.
export function holdClip(def: Activity, look: Look): boolean {
  if (def.repeatable === true || look.static) return true;
  return visibleChangeMs(def.clip) >= WORLD_BEHAVIOUR.minHoldMs && def.clip.burst === undefined;
}

// Whether a 'when' condition holds in this context.
export function condHolds(cond: BehaviourCond, ctx: BehaviourCtx): boolean {
  switch (cond) {
    case 'vents': return ctx.vents;
    case 'holeDig': return ctx.holeDig;
    case 'sensor': return ctx.sensor;
    case 'scraps': return ctx.scraps;
    case 'girlMini': return ctx.girlStage === 'mini';
    case 'girlGround': return ctx.girlStage === 'ground';
    case 'stareOn': return ctx.stare;
    case 'stareOff': return !ctx.stare;
    case 'notReduced': return !ctx.reduced;
    case 'notDemoHold': return !ctx.demoHold;
    case 'hopOk': return ctx.hopOk;
    case 'findOuter': return ctx.findOuter;
    case 'findInner': return ctx.findInner;
    case 'visits': return ctx.visitSpot !== null;
  }
}

// Whether every 'when' condition of an activity holds in this context (no conditions: always).
function whenHolds(def: Activity, ctx: BehaviourCtx): boolean {
  const when = def.when;
  if (when === undefined) return true;
  for (const cond of when) {
    if (!condHolds(cond, ctx)) return false;
  }
  return true;
}

// The activities an actor may start now: its era list with every 'when' holding (weight-0 reactions included: the pick skips them).
// The girl in the window stage has none: she parks (no picks, no frame). A glitch is never eligible in crank playback (WP27 F5.1b): the
// crank moves only on the player's clicks, so a glitch would hold for as long as the player stopped cranking.
export function eligible(actor: BehaviourActor, era: WorldEra, ctx: BehaviourCtx): readonly Activity[] {
  if (actor === 'girl' && ctx.girlStage === 'window') return [];
  const list: readonly Activity[] = WORLD_REPERTOIRE[actor][era] ?? [];
  return list.filter((a) => whenHolds(a, ctx) && !(a.glitch === true && ctx.mode === 'crank'));
}

// A fresh memory: draw index k0, the home spot index (the runner's spot before the first pick), no history.
export function newMemory(seed: number, k0: number, homeSpot = 0): Memory {
  return {
    seed, k: k0, spot: homeSpot, prevSpot: -1, lastEndMs: new Map(), lastUseMs: new Map(), hist: [], run: null, at: null, seen: new Map(),
  };
}

// A hold drawn inside [lo, hi] by the hash r in [0, 1).
function lerpHold(r: number, [lo, hi]: readonly [number, number]): number {
  return lo + r * (hi - lo);
}

// A weighted item of a choice.
interface Weighted<T> { item: T; w: number }
// The item the hash u01 lands on (cumulative weights, the last item takes the rest); undefined only for an empty list.
function pickWeighted<T>(entries: readonly Weighted<T>[], u01: number): T | undefined {
  const total = entries.reduce((s, e) => s + e.w, 0);
  let u = u01 * total;
  let i = 0;
  for (const e of entries) {
    if (i === entries.length - 1 || u < e.w) return e.item;
    u -= e.w;
    i++;
  }
  return undefined;
}

// WP28b: a visit spot (v<n>) is for the Director's visits only: plain travel, the leave and the walk-first never walk to one.
function isVisitSpot(id: SpotId): boolean {
  return id.startsWith('v');
}
// The feet lane of a spot (0 when it has none).
function laneOf(s: { lane?: number }): number {
  return s.lane ?? 0;
}
// Euclidean length of a walk over (dx, dLane) world px; a level walk keeps its exact |dx|.
function distOf(dx: number, dLane: number): number {
  return dLane === 0 ? Math.abs(dx) : Math.hypot(dx, dLane);
}
// The point the walker stands on: the point a halt cut its walk at (mem.at), else its spot; undefined when the spot is missing.
function posOf(mem: Memory, env: PickEnv): StagePoint | undefined {
  if (mem.at !== null) return mem.at;
  const s = env.spots[mem.spot];
  return s === undefined ? undefined : { x: s.x, lane: laneOf(s) };
}

// The spot indices another spot at least minTravelPx away from `from` (Euclidean, lane included), not the current spot or a visit spot.
function awayFrom(mem: Memory, env: PickEnv, from: StagePoint): number[] {
  const out: number[] = [];
  env.spots.forEach((s, i) => {
    if (i !== mem.spot && !isVisitSpot(s.id) && distOf(s.x - from.x, laneOf(s) - from.lane) >= WORLD_WALK.minTravelPx) out.push(i);
  });
  return out;
}

// The outer spot of a poke leave (WP28a T15a, A13 [R1]): among the spots other than the current one, on the actor's own side of the machine
// anchor (left when the actor stands left of MACHINE_ANCHOR.x), the one farthest from the anchor (the first one on a tie). It is listed only
// when it is farther from the anchor than the actor's current x, so a walk never goes toward the machine; empty otherwise (the leave then
// starts in place). The distances stay in x (WP28b): the yard lanes never make a spot outer.
function outerFrom(mem: Memory, env: PickEnv, from: StagePoint): number[] {
  const anchor = MACHINE_ANCHOR.x;
  const left = from.x < anchor;
  let best = -1;
  let bestDist = Math.abs(from.x - anchor);
  env.spots.forEach((s, i) => {
    if (i === mem.spot || isVisitSpot(s.id) || (s.x < anchor) !== left) return;
    const d = Math.abs(s.x - anchor);
    if (d > bestDist) {
      best = i;
      bestDist = d;
    }
  });
  return best < 0 ? [] : [best];
}

// WP28b 'inner' (the era front and head): the spot on the walker's side nearest the anchor, other than the current spot and the visit spots;
// listed only when it is nearer the anchor than the walker, so a walk never goes toward the machine past a spot. None: the reaction starts in place.
function innerFrom(mem: Memory, env: PickEnv, from: StagePoint): number[] {
  const anchor = MACHINE_ANCHOR.x;
  const left = from.x < anchor;
  let best = -1;
  let bestDist = Infinity;
  env.spots.forEach((s, i) => {
    if (i === mem.spot || isVisitSpot(s.id) || (s.x < anchor) !== left) return;
    const d = Math.abs(s.x - anchor);
    if (d < bestDist) {
      best = i;
      bestDist = d;
    }
  });
  return best >= 0 && bestDist < Math.abs(from.x - anchor) ? [best] : [];
}
// WP28b 'visit' (a woken Splice, C-c): the spot the Director named (ctx.visitSpot), unless it is absent or the walker stands on it.
function visitFrom(mem: Memory, env: PickEnv): number[] {
  if (env.visitSpot === null) return [];
  const i = env.spots.findIndex((s) => s.id === env.visitSpot);
  return i < 0 || i === mem.spot ? [] : [i];
}
// WP28b 'find' (a Find on the actor's outer side, C1): the spot on the walker's side farther from the anchor than the walker, nearest the Find's
// x, whose walk fits WORLD_WALK.maxWalkMs at the mode's fps. None (no Find, no such spot): the reaction starts in place.
function findFrom(mem: Memory, env: PickEnv, from: StagePoint): number[] {
  const findX = env.findX;
  if (findX === null) return [];
  const anchor = MACHINE_ANCHOR.x;
  const left = from.x < anchor;
  const here = Math.abs(from.x - anchor);
  let best = -1;
  let bestDist = Infinity;
  env.spots.forEach((s, i) => {
    if (i === mem.spot || isVisitSpot(s.id) || (s.x < anchor) !== left || Math.abs(s.x - anchor) <= here) return;
    if ((walkTicksOf(s.x - from.x, laneOf(s) - from.lane) * 1000) / env.fps > WORLD_WALK.maxWalkMs) return;
    const d = Math.abs(s.x - findX);
    if (d < bestDist) {
      best = i;
      bestDist = d;
    }
  });
  return best < 0 ? [] : [best];
}

// The spot indices a travel can end on from the walker's point (empty: unreachable). A travel to the spot it stands on is listed (no walk).
function targetsOf(mem: Memory, travel: NonNullable<Activity['travel']>, env: PickEnv): number[] {
  const spots = env.spots;
  const here = posOf(mem, env);
  if (here === undefined) return [];
  const byId = (id: SpotId): number[] => {
    const i = spots.findIndex((s) => s.id === id);
    return i < 0 ? [] : [i];
  };
  switch (travel) {
    case 'spot': return awayFrom(mem, env, here);
    case 'notStake': return awayFrom(mem, env, here).filter((i) => spots[i]?.id !== 'stake');
    case 'outer': return outerFrom(mem, env, here);
    case 'inner': return innerFrom(mem, env, here);
    case 'visit': return visitFrom(mem, env);
    case 'find': return findFrom(mem, env, here);
    case 'stake': return mem.at === null && spots[mem.spot]?.id === 'stake' ? [] : byId('stake');
    case 'sensor':
    case 'scrap':
    case 'home': return byId(travel);
  }
}

// Rule 5 filters: a travel with no target is unreachable; reachable travel and plain activities pass.
function reachable(mem: Memory, a: Activity, env: PickEnv): boolean {
  return a.travel === undefined || targetsOf(mem, a.travel, env).length > 0;
}
// A travel that would actually walk (a target other than the current spot).
function walksTo(mem: Memory, a: Activity, env: PickEnv): boolean {
  return a.travel !== undefined && targetsOf(mem, a.travel, env).some((i) => i !== mem.spot);
}
// Off cooldown: never ended, or ended at least cooldownMs ago.
function offCooldown(mem: Memory, a: Activity, nowMs: number): boolean {
  const last = mem.lastEndMs.get(a.id);
  return last === undefined || nowMs - last >= a.cooldownMs;
}
// The static run time the current segment had before its hold started (0 when it is not static).
function runOffsetOf(cur: Seg): number {
  return cur.look.static ? cur.startMs + cur.walkMs - cur.runStartMs : 0;
}
// The static run length at the end of the current segment (its static run so far).
function runAtEnd(cur: Seg): number {
  return cur.endMs - cur.runStartMs;
}
// The look of an activity under this runner's stare.
function lookOf(a: Activity, env: PickEnv): Look {
  return activityLook(env.actor, a.clip, env.stare);
}

// Rule 1 (filters, once a current segment exists): no walk right after a walk; a static activity that would start on the current shown
// frame without a walk needs room (its cap minus the static run) of at least its minimum hold. Reachability always applies.
function passes(mem: Memory, a: Activity, cur: Seg | null, env: PickEnv, filters: boolean): boolean {
  if (!reachable(mem, a, env)) return false;
  if (!filters || cur === null) return true;
  if (cur.walkMs > 0 && walksTo(mem, a, env)) return false;
  const look = lookOf(a, env);
  if (cur.look.static && look.static && !walksTo(mem, a, env) && look.first === cur.look.last) {
    const room = capOf(a, look, env.era) - runAtEnd(cur);
    if (room < a.holdMs[0]) return false;
  }
  return true;
}

// The least recently used activity of the list (never used first; ties keep the list order).
function leastRecentlyUsed(mem: Memory, list: readonly Activity[]): Activity | undefined {
  let best: Activity | undefined;
  let bestAt = Infinity;
  for (const a of list) {
    const at = mem.lastUseMs.get(a.id) ?? -Infinity;
    if (best === undefined || at < bestAt) {
      best = a;
      bestAt = at;
    }
  }
  return best;
}

// Extends a segment's hold by a drawn hold of the activity. Past the cap the extension is scaled into the room left by the merge
// jitter, so a merged hold never sits exactly on its cap.
function extendSeg(mem: Memory, seg: Seg, def: Activity, k: number, capMs: number): Seg {
  const drawn = lerpHold(hash01(mem.seed, 2 * k + 2), def.holdMs);
  const [lo, hi] = WORLD_BEHAVIOUR.mergeJitter;
  const ext = seg.holdMs + drawn <= capMs
    ? drawn
    : (capMs - seg.holdMs) * (lo + (hi - lo) * hash01(mem.seed + WORLD_BEHAVIOUR.salts.merge, k));
  return { ...seg, holdMs: seg.holdMs + ext, endMs: seg.endMs + ext };
}

// Rule 4: nothing is a candidate. The girl extends the current hold when it is a hold clip below its cap. A roamer (WP28b) starts a micro
// activity of the pool that passes rule 1 (the hash draws one), so a rest pose never runs on. Then the least recently used free id that
// passes rule 1; else the least recently used reachable free id; else restart the current activity (a pool that cannot extend).
function fallback(mem: Memory, cur: Seg | null, free: readonly Activity[], micro: readonly Activity[], env: PickEnv, nowMs: number,
  k: number): Seg {
  if (env.actor === 'girl' && cur !== null && !cur.react && holdClip(cur.def, cur.look)) {
    const capMs = capOf(cur.def, cur.look, env.era) - runOffsetOf(cur);
    if (cur.holdMs + cur.def.holdMs[0] <= capMs) return extendSeg(mem, cur, cur.def, k, capMs);
  }
  const others = free.filter((a) => cur === null || a.id !== cur.id);
  if (env.actor !== 'girl') {
    const micros = micro.filter((a) => (cur === null || a.id !== cur.id) && offCooldown(mem, a, nowMs) && passes(mem, a, cur, env, true));
    if (micros.length > 0) {
      const pick = micros[Math.floor(hash01(mem.seed + WORLD_BEHAVIOUR.salts.merge + 1, k) * micros.length)];
      if (pick !== undefined) return startWith(mem, pick, env, nowMs, k, {});
    }
  }
  const next = leastRecentlyUsed(mem, others.filter((a) => passes(mem, a, cur, env, true)))
    ?? leastRecentlyUsed(mem, others.filter((a) => passes(mem, a, cur, env, false)));
  if (next !== undefined) return startWith(mem, next, env, nowMs, k, {});
  if (cur === null) throw new Error('pickNext: no reachable free activity');
  return startWith(mem, cur.def, env, nowMs, k, {});
}

// WP28b (r2-FX4T, B1 coverage): among the candidate spots of a travel, the one reached longest ago (a spot never reached first). The previous
// spot damping and the hash break the ties, so a walker that stands at one end of its range crosses it within a few walks (a 90 s window covers it).
function leastSeenPick(mem: Memory, env: PickEnv, moving: readonly number[], k: number): number | undefined {
  const seenAt = (i: number): number => mem.seen.get(env.spots[i]?.id ?? '') ?? -Infinity;
  let oldest = Infinity;
  for (const i of moving) oldest = Math.min(oldest, seenAt(i));
  const tied = moving.filter((i) => seenAt(i) === oldest);
  return pickWeighted(tied.map((i) => ({ item: i, w: i === mem.prevSpot ? WORLD_WALK.prevSpotWeight : 1 })),
    hash01(mem.seed + WORLD_BEHAVIOUR.salts.spot, k));
}

// Starts def at nowMs with draw index k. Closes the last started segment (its cooldown and last use end at nowMs), picks a travel spot
// (leastSeenPick, WP28b: the spot reached longest ago; the previous spot damped and the hash break ties), draws the hold (rule 3) with a static
// continuation clipped to the run's room, and records the static run in the memory.
function startWith(mem: Memory, def: Activity, env: PickEnv, nowMs: number, k: number, opts: StartOpts): Seg {
  const prevId = mem.hist[mem.hist.length - 1];
  if (prevId !== undefined) {
    mem.lastEndMs.set(prevId, nowMs);
    mem.lastUseMs.set(prevId, nowMs);
  }
  const look = opts.look ?? activityLook(env.actor, def.clip, env.stare);
  const from = posOf(mem, env);
  const fromX = from?.x ?? 0;
  const fromLane = from?.lane ?? 0;
  let toX = fromX;
  let toLane = fromLane;
  let toSpot = mem.spot;
  let walkMs = 0;
  if (def.travel !== undefined && env.spots.length > 1) {
    // The spot the walker stands on counts as reached now when it was never reached (the home at the first travel).
    const here = env.spots[mem.spot];
    if (here !== undefined && !mem.seen.has(here.id)) mem.seen.set(here.id, nowMs);
    const moving = targetsOf(mem, def.travel, env).filter((i) => i !== mem.spot);
    const to = moving.length > 0 ? leastSeenPick(mem, env, moving, k) : undefined;
    if (to !== undefined) {
      const sp = env.spots[to];
      toSpot = to;
      toX = sp?.x ?? fromX;
      toLane = sp === undefined ? fromLane : laneOf(sp);
      walkMs = (walkTicksOf(toX - fromX, toLane - fromLane) * 1000) / env.fps;
      mem.prevSpot = mem.spot;
      mem.spot = to;
      mem.at = null;
      if (sp !== undefined) mem.seen.set(sp.id, nowMs + walkMs);
    }
  }
  const cap = capOf(def, look, env.era);
  const prev = mem.run;
  const continues = prev !== null && opts.holdMs === undefined && walkMs === 0 && prev.static && look.static && look.first === prev.last;
  let holdMs = opts.holdMs ?? lerpHold(hash01(mem.seed, 2 * k + 2), def.holdMs);
  if (prev !== null && continues) {
    const room = cap - (nowMs - prev.runStartMs);
    if (holdMs > room) {
      const [lo, hi] = WORLD_BEHAVIOUR.mergeJitter;
      holdMs = Math.max(WORLD_BEHAVIOUR.minHoldMs, room * (lo + (hi - lo) * hash01(mem.seed + WORLD_BEHAVIOUR.salts.merge, k)));
    }
  } else if (opts.holdMs === undefined) {
    holdMs = Math.min(holdMs, cap);
  }
  const runStartMs = prev !== null && continues ? prev.runStartMs : nowMs + walkMs;
  mem.run = { static: look.static, last: look.last, runStartMs };
  mem.hist.push(def.id);
  if (mem.hist.length > RECENT_IDS) mem.hist.splice(0, mem.hist.length - RECENT_IDS);
  return {
    id: def.id, def, startMs: nowMs, walkMs, holdMs, endMs: nowMs + walkMs + holdMs, react: opts.react === true, look, runStartMs,
    fromX, toX, toSpot, fromLane, toLane,
  };
}

// WP28b (B1): a reaction that would cut the current segment before one frame of it was drawn (drawnMs, one clip tick), and start the id the
// actor showed before it, shows that id twice in a row: the cut segment never reaches a frame (a 10 ms blip between two lookUp holds read as
// one 12.7 s hold). Such a reaction is dropped; the next cue answers. A segment that was drawn (a 200 ms scratch) still shows and does not count.
// Pure: the memory's last two started ids are the current segment and the one before it.
export function reactionRepeatsShown(mem: Memory, def: Activity, cur: Seg | null, atMs: number, drawnMs: number): boolean {
  if (cur === null || atMs - cur.startMs >= drawnMs) return false;
  const before = mem.hist[mem.hist.length - 2];
  return before !== undefined && before === def.id;
}

// Starts an activity outside a pick (a reaction, a unison action, the debug pin). Consumes one draw index, as a pick does.
export function startSeg(mem: Memory, def: Activity, env: PickEnv, nowMs: number, opts: StartOpts = {}): Seg {
  const k = mem.k;
  mem.k += 1;
  return startWith(mem, def, env, nowMs, k, opts);
}

// The next segment at nowMs, when cur (the last started segment) ends. Returns a new segment, or cur extended on a merge or hold
// extension (same startMs). pool is the eligible list of the actor (weight-0 reactions are skipped here). One draw index per call.
export function pickNext(mem: Memory, cur: Seg | null, pool: readonly Activity[], env: PickEnv, nowMs: number): Seg {
  const k = mem.k;
  mem.k += 1;
  const positive = pool.filter((a) => a.weight > 0);
  if (positive.length === 0) throw new Error('pickNext: no free activity');
  // WP27 F5.1b: a fresh runner's first pick (no current segment) never starts a glitch; the unfiltered list is used only when the
  // glitch-free one is empty.
  const calm = cur === null ? positive.filter((a) => a.glitch !== true) : positive;
  const free = calm.length > 0 ? calm : positive;
  PICK_STATS.picks += 1;
  // WP28b: the micro activities (weight 0) are never picked by weight; the fallback starts one when nothing else may start.
  const micro = pool.filter((a) => a.micro === true);
  // Rule 1: candidates. The current id only for the girl, when repeatable and its merged hold (and static run) still fits the cap. A roamer
  // never starts its current id again (WP28b: no activity id twice in a row).
  const cands = free.filter((a) => {
    if (cur !== null && a.id === cur.id) {
      return env.actor === 'girl' && a.repeatable === true && !cur.react
        && cur.holdMs + a.holdMs[0] <= capOf(a, cur.look, env.era) - runOffsetOf(cur);
    }
    return offCooldown(mem, a, nowMs) && passes(mem, a, cur, env, true);
  });
  if (cands.length <= 1) PICK_STATS.forced += 1;
  // Rule 2: weights. The current activity's follow multiplier, then the recency damp for the id two picks back.
  const back2 = mem.hist.length >= RECENT_IDS ? mem.hist[mem.hist.length - RECENT_IDS] : undefined;
  const weighted: Weighted<Activity>[] = cands.map((a) => {
    let w = a.weight;
    const follow = cur?.def.follow?.[a.id];
    if (follow !== undefined) w *= follow;
    if (a.id === back2) w *= WORLD_BEHAVIOUR.recency2Back;
    return { item: a, w };
  });
  // Rule 3: choice by hash; picking the current id merges into it.
  const chosen = weighted.length > 0 ? pickWeighted(weighted, hash01(mem.seed, 2 * k + 1)) : undefined;
  if (chosen === undefined) return fallback(mem, cur, free, micro, env, nowMs, k);
  if (cur !== null && chosen.id === cur.id) {
    return extendSeg(mem, cur, chosen, k, capOf(chosen, cur.look, env.era) - runOffsetOf(cur));
  }
  return startWith(mem, chosen, env, nowMs, k, {});
}

// ---- The runner: one denizen's clock (the timed playback modes, crank mode, era IV) ----
// The clock is tMs (the step's dt, unless paused; crank mode adds one hold step per click). Boundaries are analytic (the next start is
// the previous end), so the sequence does not depend on the step size. The drawn frame is computed in one place (fill): a walk by its
// tick from the walk start, a hold by the clip time from the hold start, quantized to the mode fps (crank: one clip frame per click).
type SpotList = BehaviourCtx['spots'];
// Frames of one walk cycle (walk0..walk3, the sheet's walk frames); reversed walks play them backwards.
const WALK_CYCLE = 4;
// One crank click is one hold step (WORLD_BEHAVIOUR.crankHoldMsPerClick): the crank draws at that rate (one walk tick, one clip frame).
const CRANK_MS = WORLD_BEHAVIOUR.crankHoldMsPerClick;
const CRANK_FPS = 1000 / CRANK_MS;
// Eras whose looped clips use the dropped-frame seam (WORLD_PLAYBACK.seamEras).
const SEAM_ERAS: readonly number[] = WORLD_PLAYBACK.seamEras;

// Whether a pool holds an activity that can be picked (weight above 0).
function hasFree(list: readonly Activity[]): boolean {
  return list.some((a) => a.weight > 0);
}
// The fps the timed clock draws at for a mode.
function fpsOf(mode: PlaybackMode): number {
  return playbackFps(mode) || CRANK_FPS;
}
// Whole drawn ticks since a start at fps: floor(ms x fps / 1000), never negative.
function ticksSince(ms: number, fps: number): number {
  return Math.max(0, Math.floor((ms * fps) / 1000));
}
// Index of the spot nearest x (the first one on a tie). WP28b F25: a visit spot is never a home (the walker's rest row).
function nearestSpot(spots: readonly SpotLike[], x: number): number {
  let best = 0;
  let bestDist = Infinity;
  spots.forEach((s, i) => {
    if (isVisitSpot(s.id)) return;
    const d = Math.abs(s.x - x);
    if (d < bestDist) {
      best = i;
      bestDist = d;
    }
  });
  return best;
}
// Index of the spot nearest the point (x, lane), Euclidean (the first one on a tie); WP28b: the spot a halted walk ends by (never a visit spot).
function nearestSpotAt(spots: readonly SpotLike[], p: StagePoint): number {
  let best = 0;
  let bestDist = Infinity;
  spots.forEach((s, i) => {
    if (isVisitSpot(s.id)) return;
    const d = distOf(s.x - p.x, laneOf(s) - p.lane);
    if (d < bestDist) {
      best = i;
      bestDist = d;
    }
  });
  return best;
}
// Cache key of the eligible list: the era, the girl stage and the flags the 'when' conditions read, plus the crank mode (128: eligible
// drops the glitches in crank playback, so the cached list follows the mode). WP28b: the hop, Find and visit flags (256-2048).
function eligibleKey(c: BehaviourCtx): number {
  const flags = (c.vents ? 1 : 0) | (c.holeDig ? 2 : 0) | (c.sensor ? 4 : 0) | (c.scraps ? 8 : 0) | (c.stare ? 16 : 0)
    | (c.reduced ? 32 : 0) | (c.demoHold ? 64 : 0) | (c.mode === 'crank' ? 128 : 0)
    | (c.hopOk ? 256 : 0) | (c.findOuter ? 512 : 0) | (c.findInner ? 1024 : 0) | (c.visitSpot !== null ? 2048 : 0);
  const stage = c.girlStage === 'window' ? 0 : c.girlStage === 'mini' ? 1 : 2;
  return (c.era * 3 + stage) * 4096 + flags;
}
// Drawn walk ticks of a walk over (dx, dLane) world px: one per pxPerFrame of the Euclidean length (the last one may be short).
function walkTicksOf(dx: number, dLane = 0): number {
  return Math.ceil(distOf(dx, dLane) / WORLD_WALK.pxPerFrame);
}
// The cut of a walk at its last drawn tick at or after atMs (WP28b halt; F30 cuts at a due machine-event reaction): the walk time it ends at
// and the point the walker stands on. The tick is the one the frame at atMs draws (never past the arrival), so the cut is analytic (step-free).
interface WalkCut { walkMs: number; x: number; lane: number }
function walkCutOf(seg: Seg, atMs: number, fps: number): WalkCut {
  const dx = seg.toX - seg.fromX;
  const dl = seg.toLane - seg.fromLane;
  const dist = distOf(dx, dl);
  const tick = Math.min(walkTicksOf(dx, dl), Math.max(0, Math.ceil(((atMs - seg.startMs) * fps) / 1000)));
  const along = Math.min(tick * WORLD_WALK.pxPerFrame, dist);
  return {
    walkMs: (tick * 1000) / fps,
    x: dist === 0 ? seg.fromX : seg.fromX + (dx * along) / dist,
    lane: dist === 0 ? seg.fromLane : seg.fromLane + (dl * along) / dist,
  };
}
// The walk frames of one cycle, forward (walk0..walk3) and reversed (walk3..walk0), built once: a tick picks one by its index.
const WALK_FORWARD: readonly string[] = Object.freeze(Array.from({ length: WALK_CYCLE }, (_, i) => `walk${i}`));
const WALK_REVERSED: readonly string[] = Object.freeze([...WALK_FORWARD].reverse());
// The walk frame of a tick: walk0..walk3 in turn, walk3..walk0 when reversed.
export function walkFrameOf(tick: number, reversed: boolean): string {
  const cycle = reversed ? WALK_REVERSED : WALK_FORWARD;
  return cycle[tick % WALK_CYCLE] ?? '';
}
// Facing at rest (WP24 C2): a profile frame of the Inspector or the dog faces away from the machine (a left-wing actor faces left).
// A camera-facing frame (after the stare map) never flips, and the crow and the girl never flip.
export function restFlip(actor: BehaviourActor, frame: string, stare: boolean, homeX: number): boolean {
  if (actor === 'crow' || actor === 'girl') return false;
  if (WORLD_STARE_SAFE[actor].includes(stareFrame(actor, frame, false, stare))) return false;
  return homeX < MACHINE_ANCHOR.x;
}

// WP28b F29: the side of the machine a Find lies on, for an actor at actorX. outer: on the actor's side and farther from the anchor than the
// actor (point, sniffFind). inner: any other Find, the nearer side, the far wing and an equal distance too (lookFind, sniffHere). No Find: neither.
// The Director sets ctx.findOuter / findInner from it (the runner's when flags read them).
export function findSidesOf(actorX: number, findX: number | null, anchorX: number): { outer: boolean; inner: boolean } {
  if (findX === null) return { outer: false, inner: false };
  const outer = findOuterOf(actorX, findX, anchorX);
  return { outer, inner: !outer };
}
// WP28b (r2-FX1): the outer test of findSidesOf alone, without the object: the Director calls it per frame and must not allocate.
export function findOuterOf(actorX: number, findX: number, anchorX: number): boolean {
  return (findX < anchorX) === (actorX < anchorX) && Math.abs(findX - anchorX) > Math.abs(actorX - anchorX);
}

// WP28b F25: the visit stand of a woken Splice in a framing (WORLD_VISITS): the actor that walks there and the visit spot id. Null when the
// object has no stand here (an exempt object), the era is outside the stand's range, or the stand is clean only from some spots and the walker
// stands on none of them (`from`). The Director sets ctx.visitSpot from it and pushes the splice cue.
export function visitFor(framing: FramingKey, object: TechId, era: EraNumber, currentSpot: SpotId | null):
  { actor: 'inspector' | 'dog'; spot: SpotId } | null {
  const stand = WORLD_VISITS[framing]?.find((v) => v.object === object && (v.minEra ?? 1) <= era && era <= (v.maxEra ?? ERA_V));
  if (stand === undefined) return null;
  if (stand.from !== undefined && (currentSpot === null || !stand.from.includes(currentSpot))) return null;
  return { actor: stand.actor, spot: stand.spot };
}

// The walk gate (WP28b, B1: no two walkers start a walk within walkStaggerMs). The caller keeps one gate per cast, notes every runner's
// walking flag each frame (a rising edge is a walk start) and passes walkBlockedFor as ctx.walkBlocked. Pure: the state is the gate's own.
const WALK_ACTORS: readonly BehaviourActor[] = ['inspector', 'dog', 'crow', 'girl'];
export interface WalkGate { readonly startedAt: Record<BehaviourActor, number>; readonly walking: Record<BehaviourActor, boolean> }
export function createWalkGate(): WalkGate {
  return {
    startedAt: { inspector: -Infinity, dog: -Infinity, crow: -Infinity, girl: -Infinity },
    walking: { inspector: false, dog: false, crow: false, girl: false },
  };
}
// True when another actor started a walk less than walkStaggerMs before nowMs. An actor's own start never blocks itself.
export function walkBlockedFor(gate: WalkGate, actor: BehaviourActor, nowMs: number): boolean {
  for (const other of WALK_ACTORS) {
    if (other !== actor && nowMs - gate.startedAt[other] < WORLD_BEHAVIOUR.walkStaggerMs) return true;
  }
  return false;
}
// Notes one actor's walking flag at nowMs: the rising edge (not walking, now walking) records the start time.
export function noteWalkFrame(gate: WalkGate, actor: BehaviourActor, walking: boolean, nowMs: number): void {
  if (walking && !gate.walking[actor]) gate.startedAt[actor] = nowMs;
  gate.walking[actor] = walking;
}

// The start gate (WP28b r2-FX4G, V5: plan A2). A boundary pick that would start within startGuardMs of another denizen's latest start is moved
// on by the runner (see guardHold). The caller keeps one gate per cast and passes it as ctx.startGate; the runner writes each of its segment
// starts into it (startedAt, the shared clock: its clock plus clockOffsetMs, the latest start of the actor). Pure: one number per denizen;
// nothing allocates per frame.
export interface StartGate { readonly startedAt: Record<BehaviourActor, number> }
export function createStartGate(): StartGate {
  return { startedAt: { inspector: -Infinity, dog: -Infinity, crow: -Infinity, girl: -Infinity } };
}
// The time a boundary at atMs moves to so that it lies at least startGuardMs from every other actor's latest start: the latest (start +
// startGuardMs) among the starts within startGuardMs of atMs, either side (atMs itself when none is near). An actor's own start never counts.
export function startGuardTarget(gate: StartGate, actor: BehaviourActor, atMs: number): number {
  const guard = WORLD_BEHAVIOUR.startGuardMs;
  let target = atMs;
  for (const other of WALK_ACTORS) {
    const s = gate.startedAt[other];
    if (other !== actor && Math.abs(atMs - s) < guard && s + guard > target) target = s + guard;
  }
  return target;
}

// The shown clip frame: its index in clip.frames, or -1 for a burst's rest frame.
interface Shown { frame: string; index: number }
function showIndex(clip: Clip, i: number, out: Shown): void {
  out.frame = clip.frames[i] ?? '';
  out.index = i;
}
// The frame of a frameHoldMs clip e ms into its hold: frame j holds a hash-drawn span of range (stream seed + k, counter j), frames cycle.
export function frameHoldIndex(range: readonly [number, number], n: number, e: number, seed: number, k: number): number {
  let at = 0;
  for (let j = 0; ; j++) {
    const hold = lerpHold(hash01(seed + k, j), range);
    // A span that is not above zero ends the walk of frames (no data has one).
    if (e < at + hold || !(hold > 0)) return j % n;
    at += hold;
  }
}
// The cached walk of frameHoldIndex (WP24 r3-F1, one per runner): the same spans, resumed from the frame it last reached. The walk keeps
// its stream (seed + k), its range, the last e and the running start of frame j; a query resumes from j while the stream and range hold
// and e has not gone back, else it starts over. Same result as frameHoldIndex for every input.
export interface HoldWalk { stream: number; range: readonly [number, number] | null; e: number; at: number; j: number }
export function newHoldWalk(): HoldWalk {
  return { stream: NaN, range: null, e: -Infinity, at: 0, j: 0 };
}
export function frameHoldWalk(walk: HoldWalk, range: readonly [number, number], n: number, e: number, seed: number, k: number): number {
  const stream = seed + k;
  if (walk.range !== range || walk.stream !== stream || !(e >= walk.e)) {
    walk.range = range;
    walk.stream = stream;
    walk.at = 0;
    walk.j = 0;
  }
  walk.e = e;
  for (;; walk.j++) {
    const hold = lerpHold(hash01(stream, walk.j), range);
    if (e < walk.at + hold || !(hold > 0)) return walk.j % n;
    walk.at += hold;
  }
}
// The frame of an edgeMs clip (the umbrella): the first frame for edgeMs, the last frame for the final edgeMs, the middle frames between.
function edgeIndex(clip: Clip, e: number, holdMs: number): number {
  const edge = clip.edgeMs ?? 0;
  const n = clip.frames.length;
  if (e < edge) return 0;
  if (e >= holdMs - edge) return n - 1;
  const middle = n - 2;
  if (middle <= 0) return 0;
  const t = Math.floor(((e - edge) * clip.fps) / 1000);
  return 1 + (clip.loop ? t % middle : Math.min(t, middle - 1));
}
// The frame of a burst clip (the dig) e ms into its hold: animated bursts (onMs, the frames at clip.fps) alternate with the still rest
// frame (restMs). Each phase length is hash-drawn (stream seed + k, phase counter).
function burstShown(clip: Clip, burst: NonNullable<Clip['burst']>, e: number, seed: number, k: number, out: Shown): void {
  const n = clip.frames.length;
  let at = 0;
  for (let p = 0; ; p++) {
    const on = lerpHold(hash01(seed + k, 2 * p), burst.onMs);
    if (e < at + on) {
      showIndex(clip, Math.floor(((e - at) * clip.fps) / 1000) % n, out);
      return;
    }
    at += on;
    const rest = lerpHold(hash01(seed + k, 2 * p + 1), burst.restMs);
    if (e < at + rest || !(on + rest > 0)) {
      out.frame = burst.restFrame;
      out.index = -1;
      return;
    }
    at += rest;
  }
}
// The shown frame of a hold clip e ms into the hold. Burst, edge and frame-hold clips have their own timing; a plain clip steps once per
// clip frame at clip.fps, and a looped clip in eras I-II drops one frame at each wrap (the seam, the index rule of loopFrameAt).
function chooseFrame(clip: Clip, holdMs: number, e: number, seam: boolean, seed: number, k: number, out: Shown, walk: HoldWalk): void {
  const n = clip.frames.length;
  if (clip.burst !== undefined) {
    burstShown(clip, clip.burst, e, seed, k, out);
  } else if (clip.edgeMs !== undefined) {
    showIndex(clip, edgeIndex(clip, e, holdMs), out);
  } else if (clip.frameHoldMs !== undefined) {
    showIndex(clip, frameHoldWalk(walk, clip.frameHoldMs, n, e, seed, k), out);
  } else {
    const t = Math.floor((e * clip.fps) / 1000);
    if (!clip.loop) showIndex(clip, Math.min(t, n - 1), out);
    else if (seam) showIndex(clip, (t + Math.floor(t / n)) % n, out);
    else showIndex(clip, t % n, out);
  }
}

// Era IV (the unison conductor's era), the one actor that walks in it (the Inspector's walkFirst actions), the beat of the shared clock
// (TIER_HEARTBEAT: one downbeat per beat), and the era of a runner before its first step.
const ERA_IV: WorldEra = 4;
const WALKER: BehaviourActor = 'inspector';
const BEAT_MS = TIER_HEARTBEAT.periodMs;
const NO_ERA = -1;

// The hold clip of an actor in the unison set of the stare (era IV): the waiting frame before the join and the settled frame.
function holdClipOf(actor: BehaviourActor, stare: boolean): UnisonClip | undefined {
  return WORLD_UNISON.map[stare ? 'post' : 'pre'][actor].hold;
}

// Crank clicks since a start: a click is one crank hold step, so the first click after the start is click 1.
function clicksSince(ms: number): number {
  return Math.max(0, Math.ceil(ms / CRANK_MS));
}
// The clip frame after n crank clicks: one clip frame per click (looped, or clamped when not looped).
function crankShown(clip: Clip, clicks: number, out: Shown): void {
  const n = clip.frames.length;
  showIndex(clip, clip.loop ? clicks % n : Math.min(clicks, n - 1), out);
}
// A non-negative index into n frames (the beat count since a unison action start, modulo the frames).
function wrapIndex(i: number, n: number): number {
  return ((i % n) + n) % n;
}

// The cues of WP28b that use the actor's stagger band (WORLD_REACT.staggerMs) instead of the latency band. A find's reaction of the Inspector
// uses findDelayMs (he points 2-4 s after the spawn), not the stagger. They are the machine-event cues: reactGate lets them pre-empt an
// interruptible reaction (WP28b AD4 F41a).
const STAGGERED_CUES: readonly CueId[] = ['fault', 'faultClear', 'find', 'bigBuy', 'era', 'splice'];
function reactBand(actor: BehaviourActor, id: CueId): readonly [number, number] {
  if (id === 'find' && actor === 'inspector') return WORLD_REACT.findDelayMs;
  return STAGGERED_CUES.includes(id) ? WORLD_REACT.staggerMs[actor] : WORLD_REACT.latencyMs[actor];
}

// A due event of the runner: a reaction (kind react, the activity to start) or a wake (kind end: the current activity ends at the cue). A poke
// (kind poke, WP28a T15a) starts its activity like a reaction, with no cue and index -1 (cue indices are never below 0).
interface Pending { kind: 'react' | 'end' | 'poke'; cue: CueId | null; index: number; due: number; def: Activity | null }
// The conductor's current action as the runner reads it.
type UnisonAct = ReturnType<UnisonConductor['current']>;

// One actor's runner (T3b, T3c). step() advances the clock and returns the one preallocated frame; the state is the scheduler memory,
// the current segment, the clock, the position and the spot the actor stands on, the due cue responses and (era IV) the joined unison
// action. conductor is the shared era IV conductor: every runner steps it, and it acts once per beat index. onEnd receives every closed
// segment and unison action (its log entry, its real length).
export function createBehaviourRunner(
  actor: BehaviourActor, seed: number, conductor: UnisonConductor, onEnd?: (e: BehaviourLogEntry) => void,
): BehaviourRunner {
  let seedNow = seed;
  let mem: Memory = newMemory(seed, 0, 0);
  let cur: Seg | null = null;
  let tMs = 0;
  let started = false;
  let x = 0;
  let walking = false;
  let segK = 0;
  let segFps: number = CRANK_FPS;
  let startEmitDone = false;
  let pin: string | null = null;
  let homeSeen = 0;
  let lastWalkEndMs = -Infinity;
  // WP28b (r2-FX4G): the start-gate extension taken at the current boundary (at most startGuardExtMax x startGuardMs; a boundary pick resets it).
  let startExtMs = 0;
  let spotIdNow: SpotId | null = null;
  let spotXNow = 0;
  let spotLaneNow = 0;
  // WP28b: the point the walker rests on: its spot, or the point a halt cut its walk at (equal to the spot in every flow but a halt).
  let restX = 0;
  let restLane = 0;
  let spotsNow: SpotList = [];
  let lastCtx: BehaviourCtx | null = null;
  let poolKey = -1;
  let pool: readonly Activity[] = [];
  const home: { id: SpotId; x: number; lane: number } = { id: 'home', x: 0, lane: 0 };
  const homeSpots: SpotList = [home];
  const shown: Shown = { frame: '', index: -1 };
  const frame: BehaviourFrame = {
    activity: 'parked', step: 0, frame: '', flip: false, x: 0, walking: false, poseSet: 'base', risePx: 0, alpha: 1, emitted: null, lane: 0,
  };
  // Cues: the last cue index seen, the due responses, and the last reaction time per cue (the pair cooldown of this actor).
  let lastSeen = -1;
  let pending: Pending[] = [];
  const pairAt = new Map<CueId, number>();
  // Era change and era IV: the era of the last step, the time of the last downbeat, the era IV entry (its beat, the downbeats since),
  // whether the runner has joined the conductor, and the joined action (its id, set, start, end, walk and clip).
  let lastEra = NO_ERA;
  let lastDownbeatMs = -Infinity;
  let ivOn = false;
  let ivLastBeat = 0;
  let ivDown = 0;
  let joined = false;
  let uId: UnisonId = 'still';
  let uPost = false;
  let uStartBeat = 0;
  let uStartMs = 0;
  let uEndMs = 0;
  let uWalkMs = 0;
  let uFromX = 0;
  let uToX = 0;
  let uFromLane = 0;
  let uToLane = 0;
  let uWalked = false;
  let uFps: number = CRANK_FPS;
  let uK = 0;
  let uClip: UnisonClip | null = null;
  let uLook: Look | null = null;
  // The draw memo of fill (WP24 r3-F1): the segment and the draw key of the last fill. A Seg is never mutated (every change builds a new
  // object), so its identity is the key. memoSeg null: nothing to reuse (every writer of the shared frame or of the position clears it).
  let memoSeg: Seg | null = null;
  let memoWalk = false;
  let memoTick = -1;
  let memoMode: PlaybackMode | null = null;
  let memoEra: WorldEra = 1;
  let memoStare = false;
  let memoReduced = false;
  let memoHomeX = 0;
  // The cached hold walk of the frameHoldMs clips (one per runner; the walk checks its own stream and range).
  let holdWalk = newHoldWalk();
  // The spot list the runner last synced to: the ids and xs of its spots, copied in place (syncSpots compares them each step).
  const slotIds: string[] = [];
  const slotXs: number[] = [];
  const slotLanes: number[] = [];
  let slotCount = 0;

  // The spots of a context: its framing list, or the home spot alone (the runner stands at homeX).
  const spotsOf = (ctx: BehaviourCtx): SpotList => {
    if (ctx.spots.length > 0) return ctx.spots;
    home.x = ctx.homeX;
    return homeSpots;
  };
  const envAt = (ctx: BehaviourCtx): PickEnv => ({
    actor, era: ctx.era, stare: ctx.stare, spots: spotsOf(ctx), fps: fpsOf(ctx.mode), visitSpot: ctx.visitSpot, findX: ctx.findX,
  });
  // The eligible activities of the context (cached while the key holds).
  const poolOf = (ctx: BehaviourCtx): readonly Activity[] => {
    const key = eligibleKey(ctx);
    if (key !== poolKey) {
      poolKey = key;
      pool = eligible(actor, ctx.era, ctx);
    }
    return pool;
  };
  // The pool of a pick at nowMs. Reduced motion: no travel within reducedWalkGapMs of the last walk's arrival. WP28b: no travel while the walk
  // gate is set (another walker started a walk within walkStaggerMs). The calm ones stay when they are all there is to pick from, so the pool
  // never empties.
  const poolAt = (ctx: BehaviourCtx, nowMs: number): readonly Activity[] => {
    const all = poolOf(ctx);
    const noWalk = ctx.walkBlocked || (ctx.reduced && nowMs - lastWalkEndMs < WORLD_WALK.reducedWalkGapMs);
    if (!noWalk) return all;
    const calm = all.filter((a) => a.travel === undefined);
    return hasFree(calm) ? calm : all;
  };
  // Closes a segment: the log entry (its real length).
  const close = (seg: Seg): void => {
    if (onEnd !== undefined) {
      const walked = seg.walkMs > 0;
      onEnd({
        activity: seg.id, atMs: seg.startMs, durMs: seg.endMs - seg.startMs, walked, reaction: seg.react,
        look: seg.look.key + (walked ? '+walk' : ''),
      });
    }
    const emits = seg.def.emits;
    if (emits !== undefined && (seg.def.emitsAt ?? 'end') === 'end') frame.emitted ??= emits;
  };
  // Makes seg the current segment (k: its draw index). Records the fps of its walk, the arrival and the spot it stands on.
  const began = (seg: Seg, ctx: BehaviourCtx, k: number): void => {
    memoSeg = null;
    cur = seg;
    segK = k;
    startExtMs = 0;
    if (ctx.startGate !== undefined) ctx.startGate.startedAt[actor] = seg.startMs + (ctx.clockOffsetMs ?? 0);
    segFps = fpsOf(ctx.mode);
    startEmitDone = false;
    if (seg.walkMs > 0) lastWalkEndMs = seg.startMs + seg.walkMs;
    const sp = spotsNow[seg.toSpot];
    if (sp !== undefined) {
      spotIdNow = sp.id;
      spotXNow = sp.x;
      spotLaneNow = laneOf(sp);
    }
    restX = seg.toX;
    restLane = seg.toLane;
  };
  // Picks the first segment of an idle runner at tMs. shift starts the first segment out of phase (salts.start x its span).
  const freshPick = (ctx: BehaviourCtx, shift: boolean): void => {
    const list = poolAt(ctx, tMs);
    if (!hasFree(list)) return;
    const k = mem.k;
    let seg = pickNext(mem, null, list, envAt(ctx), tMs);
    if (shift) {
      const off = hash01(seedNow + WORLD_BEHAVIOUR.salts.start, 0) * (seg.walkMs + seg.holdMs);
      seg = { ...seg, startMs: seg.startMs - off, endMs: seg.endMs - off, runStartMs: seg.runStartMs - off };
      if (mem.run !== null) mem.run.runStartMs -= off;
    }
    began(seg, ctx, k);
    if (shift && seg.startMs + seg.walkMs <= tMs) startEmitDone = true;
  };
  // Parks the frame: no frame drawn, the position at homeX.
  const park = (homeX: number): void => {
    memoSeg = null;
    walking = false;
    x = homeX;
    frame.activity = 'parked';
    frame.frame = '';
    frame.flip = false;
    frame.x = homeX;
    frame.walking = false;
    frame.poseSet = 'base';
    frame.risePx = 0;
    frame.alpha = 1;
  };
  // The one place that draws the frame. A walk: its tick (at the walk's fps, from its start), the arrival clamped, facing by direction.
  // A hold: the clip frame of the mode (crank: one per click; timed: the clip time from the hold start, quantized to the mode fps), the
  // dx, the alpha and the facing at rest. The draw is memoized (WP24 r3-F1): a fill with the same segment, draw tick, walk or hold, mode,
  // era, stare, reduced and home as the last one only refreshes the activity, the step and the pose set (the frame is unchanged).
  const fill = (ctx: BehaviourCtx): void => {
    const seg = cur;
    if (seg === null) {
      park(ctx.homeX);
      return;
    }
    const fps = fpsOf(ctx.mode);
    const holdAt = seg.startMs + seg.walkMs;
    const walkPhase = tMs < holdAt;
    // The draw tick: a walk's tick (one per walk frame from its start, never past the arrival), else a hold's (one per click in crank mode,
    // one per fps tick in timed modes). The drawn frame is a function of it.
    const tick = walkPhase
      ? Math.min(walkTicksOf(seg.toX - seg.fromX, seg.toLane - seg.fromLane), Math.max(0, Math.ceil(((tMs - seg.startMs) * segFps) / 1000)))
      : ctx.mode === 'crank' ? clicksSince(tMs - holdAt) : ticksSince(tMs - holdAt, fps);
    frame.activity = seg.id;
    frame.step = ticksSince(tMs, fps);
    frame.poseSet = seg.def.poseSet ?? 'base';
    frame.risePx = 0;
    if (memoSeg === seg && memoWalk === walkPhase && memoTick === tick && memoMode === ctx.mode && memoEra === ctx.era
      && memoStare === ctx.stare && memoReduced === ctx.reduced && memoHomeX === ctx.homeX) return;
    if (walkPhase) {
      const dx = seg.toX - seg.fromX;
      const dl = seg.toLane - seg.fromLane;
      const dist = distOf(dx, dl);
      // The tick's point: the Euclidean share of the walk drawn so far (the arrival clamps). A level walk keeps its exact x.
      const along = Math.min(tick * WORLD_WALK.pxPerFrame, dist);
      const reversed = seg.def.reversed === true;
      walking = true;
      x = dist === 0 ? seg.fromX : seg.fromX + (dx * along) / dist;
      frame.lane = dist === 0 ? seg.fromLane : seg.fromLane + (dl * along) / dist;
      frame.frame = walkFrameOf(tick, reversed);
      // Facing follows the sign of dx; a walk with no horizontal part keeps the facing it had.
      if (dx !== 0) frame.flip = reversed ? dx > 0 : dx < 0;
      frame.alpha = seg.def.clip.alpha ?? 1;
    } else {
      const clip = seg.def.clip;
      walking = false;
      if (ctx.mode === 'crank') {
        crankShown(clip, tick, shown);
      } else {
        const e = (tick * 1000) / fps;
        const seam = clip.loop && SEAM_ERAS.includes(ctx.era);
        chooseFrame(clip, seg.holdMs, e, seam, seedNow, segK, shown, holdWalk);
      }
      const i = shown.index;
      // Reduced motion: the crow's stutter, skip and shift hold one pose (no dx offset).
      x = seg.toX + (ctx.reduced ? 0 : (clip.dxPx?.[i] ?? 0));
      frame.lane = seg.toLane;
      frame.frame = shown.frame;
      frame.flip = restFlip(actor, shown.frame, ctx.stare, ctx.homeX);
      frame.alpha = (clip.alpha ?? 1) * (clip.frameAlpha?.[i] ?? 1);
    }
    frame.x = x;
    frame.walking = walking;
    memoSeg = seg;
    memoWalk = walkPhase;
    memoTick = tick;
    memoMode = ctx.mode;
    memoEra = ctx.era;
    memoStare = ctx.stare;
    memoReduced = ctx.reduced;
    memoHomeX = ctx.homeX;
  };
  // Redraws the frame from the current state (a rehome can happen while the clock is paused). A unison action draws its own frame; the
  // runner waiting to join redraws at its next step (its waiting frame). A settled context keeps the settled frame.
  const refresh = (): void => {
    memoSeg = null;
    if (lastCtx === null || lastCtx.settle === true) return;
    if (joined) fillUnison(lastCtx);
    else if (cur !== null) fill(lastCtx);
    else if (!ivOn) park(homeSeen);
  };
  // Moves onto the nearest spot of the current list (the new home). A walk in progress is cancelled: the hold starts here.
  const rehomeTo = (homeX: number): void => {
    memoSeg = null;
    homeSeen = homeX;
    home.x = homeX;
    const idx = nearestSpot(spotsNow, homeX);
    const sp = spotsNow[idx];
    if (sp === undefined) {
      x = homeX;
      return;
    }
    mem.spot = idx;
    mem.prevSpot = -1;
    mem.at = null;
    spotIdNow = sp.id;
    spotXNow = sp.x;
    spotLaneNow = laneOf(sp);
    restX = sp.x;
    restLane = laneOf(sp);
    x = sp.x;
    if (cur !== null) {
      if (tMs < cur.startMs + cur.walkMs) {
        cur = {
          ...cur, startMs: tMs, walkMs: 0, endMs: tMs + cur.holdMs, fromX: sp.x, toX: sp.x, toSpot: idx, fromLane: restLane,
          toLane: restLane,
        };
      } else {
        cur = { ...cur, fromX: sp.x, toX: sp.x, toSpot: idx, fromLane: restLane, toLane: restLane };
      }
    } else if (joined) {
      uWalkMs = Math.min(uWalkMs, Math.max(0, tMs - uStartMs));
      uFromX = sp.x;
      uToX = sp.x;
      uFromLane = restLane;
      uToLane = restLane;
    }
  };
  // Copies a spot list into the slots (the ids, xs and lanes syncSpots compares next step).
  const cacheSpots = (list: SpotList): void => {
    slotCount = list.length;
    for (let i = 0; i < slotCount; i++) {
      const s = list[i];
      slotIds[i] = s?.id ?? '';
      slotXs[i] = s?.x ?? NaN;
      slotLanes[i] = s === undefined ? NaN : laneOf(s);
    }
  };
  // Whether a spot list is the one the slots hold (the same count, ids, xs and lanes).
  const sameSpots = (list: SpotList): boolean => {
    if (list.length !== slotCount) return false;
    for (let i = 0; i < slotCount; i++) {
      const s = list[i];
      if (s === undefined || s.id !== slotIds[i] || s.x !== slotXs[i] || laneOf(s) !== slotLanes[i]) return false;
    }
    return true;
  };
  // Keeps the runner on its spot of the context's list: a changed home, a vanished spot or a moved spot re-homes it.
  const syncSpots = (ctx: BehaviourCtx): void => {
    spotsNow = spotsOf(ctx);
    // Nothing moved (the same home and the same list of ids and xs): the runner stands on its spot as it did, so there is nothing to do.
    if (ctx.homeX === homeSeen && sameSpots(spotsNow)) return;
    let idx = -1;
    for (let i = 0; i < spotsNow.length; i++) {
      if (spotsNow[i]?.id === spotIdNow) {
        idx = i;
        break;
      }
    }
    const here = spotsNow[idx];
    if (ctx.homeX !== homeSeen || here === undefined || here.x !== spotXNow || laneOf(here) !== spotLaneNow) {
      rehomeTo(ctx.homeX);
      refresh();
    } else if (idx !== mem.spot) {
      mem.spot = idx;
      mem.prevSpot = -1;
    }
    cacheSpots(spotsNow);
  };
  // WP28b (r2-FX4G, V5): the start gate of a boundary pick. A boundary within startGuardMs of another denizen's latest start moves to the first
  // time that is startGuardMs from it (startGuardTarget): the current hold grows by that much, inside the hold cap and the static run cap, and the
  // extensions of one boundary stay within startGuardExtMax x startGuardMs. The pick then comes at the new boundary. Only a clip that changes no
  // faster than minHoldMs is stretched (a burst's frames change at its fps too): a hop or a peck keeps its length, since a longer flight shows more
  // changes in a second (V7). The clip decides, not the look: under the stare a flight looks static. Era IV and a joined runner are never gated.
  // Wakes, reactions and pokes start without a boundary pick, so they never reach it.
  const guardHold = (seg: Seg, ctx: BehaviourCtx): boolean => {
    const gate = ctx.startGate;
    if (gate === undefined || joined || ctx.era === ERA_IV) return false;
    if (visibleChangeMs(seg.def.clip) < WORLD_BEHAVIOUR.minHoldMs) return false;
    // The gate works on the shared clock. A boundary no start is near keeps its exact time: no round trip through the offset (a float
    // residue would read as an extension).
    const off = ctx.clockOffsetMs ?? 0;
    const shared = startGuardTarget(gate, actor, seg.endMs + off);
    const target = shared === seg.endMs + off ? seg.endMs : shared - off;
    const ext = target - seg.endMs;
    if (!(ext > 0) || startExtMs + ext > WORLD_BEHAVIOUR.startGuardExtMax * WORLD_BEHAVIOUR.startGuardMs) return false;
    // Strictly inside the cap: a hold that reaches its cap exactly would round past it (V3 reads the float ends).
    const room = capOf(seg.def, seg.look, ctx.era) - runOffsetOf(seg) - seg.holdMs;
    if (!(ext < room)) return false;
    startExtMs += ext;
    cur = { ...seg, holdMs: target - (seg.startMs + seg.walkMs), endMs: target };
    return true;
  };
  // Ends the current segment at its boundary and picks the next one from the pool of the context (the next start is the end: analytic).
  // With no free activity left the segment closes and the runner parks (era IV: the pool is empty, so the runner waits to join).
  // gated: false for a wake (its pick is the cue's, not a boundary's).
  const advanceOnce = (ctx: BehaviourCtx, gated = true): void => {
    const from = cur;
    if (from === null) return;
    const list = poolAt(ctx, from.endMs);
    if (!hasFree(list)) {
      close(from);
      cur = null;
      return;
    }
    if (gated && guardHold(from, ctx)) return;
    startExtMs = 0;
    const k = mem.k;
    const next = pickNext(mem, from, list, envAt(ctx), from.endMs);
    if (next.startMs === from.startMs && next.id === from.id) {
      cur = next;
      return;
    }
    close(from);
    began(next, ctx, k);
  };
  // The current segment cut at `at` (a reaction or a wake ends it there; the walk, if any, is complete by then).
  const cutSeg = (seg: Seg, at: number): Seg => ({ ...seg, endMs: at, holdMs: at - (seg.startMs + seg.walkMs) });
  // Ends the current segment at once when a 'when' condition of its activity no longer holds (the girl's mini frames never reach the
  // ground stage; the log keeps the real length). A walk in progress is finished first: a walker never stops mid-air (V6).
  const endStale = (ctx: BehaviourCtx): void => {
    const seg = cur;
    if (seg === null || whenHolds(seg.def, ctx)) return;
    if (tMs < seg.startMs + seg.walkMs) return;
    close(cutSeg(seg, tMs));
    cur = null;
  };
  // WP28b F41b: the activity a due reaction of cue starts: def while its 'when' holds, else the first other reaction of the cue in the era
  // list whose 'when' holds (the walker crossed a Find's x: point and lookFind, sniffFind and sniffHere, trade places). undefined: none holds.
  const dueReaction = (def: Activity, cue: CueId | null, ctx: BehaviourCtx): Activity | undefined => {
    if (whenHolds(def, ctx)) return def;
    const list = WORLD_REPERTOIRE[actor][ctx.era];
    if (list !== undefined && cue !== null) {
      for (const a of list) {
        if (a !== def && a.reaction?.includes(cue) === true && whenHolds(a, ctx)) return a;
      }
    }
    return undefined;
  };
  // WP28b: the gate of a due reaction at `at`, read by applyPending and by the F30 cut. 'drop': it may not start (its activity no longer
  // holds, the id would show twice, or the current segment is a reaction, the same id or not interruptible). 'wait': it walks while the walk
  // gate is set (it tries again after reactWaitMs). 'start': it starts now.
  const reactGate = (def: Activity, ctx: BehaviourCtx, at: number, cue: CueId | null): 'drop' | 'wait' | 'start' => {
    if (!whenHolds(def, ctx)) return 'drop';
    if (reactionRepeatsShown(mem, def, cur, at, 1000 / fpsOf(ctx.mode))) return 'drop';
    // A cue reaction yields to a reaction, to the same activity and to a non-interruptible one. WP28b F41a: a machine-event cue pre-empts an
    // interruptible reaction or visit instead (the runner ends it as an interrupt does).
    const machine = cue !== null && STAGGERED_CUES.includes(cue);
    if (cur !== null && (cur.def.interruptible === false || cur.id === def.id || (cur.react && !machine))) return 'drop';
    // A reaction that walks obeys the walk gate like a pick (the gate frees within walkStaggerMs, since no walk starts while it is set).
    return def.travel !== undefined && ctx.walkBlocked ? 'wait' : 'start';
  };
  // Cuts the walk of seg at its last drawn tick at or after atMs (the halt cut): the segment ends there and its hold starts there. The walker
  // rests on that point (mem.at), so the next walk or hold starts from it (WP28b halt; F30 uses the same cut at a due reaction).
  const cutWalk = (seg: Seg, atMs: number): void => {
    const c = walkCutOf(seg, atMs, segFps);
    const toSpot = nearestSpotAt(spotsNow, { x: c.x, lane: c.lane });
    const sp = spotsNow[toSpot];
    const runStartMs = seg.startMs + c.walkMs;
    if (mem.run !== null && mem.run.runStartMs === seg.runStartMs) mem.run.runStartMs = runStartMs;
    cur = { ...seg, toX: c.x, toLane: c.lane, toSpot, walkMs: c.walkMs, endMs: runStartMs + seg.holdMs, runStartMs };
    memoSeg = null;
    mem.at = { x: c.x, lane: c.lane };
    mem.spot = toSpot;
    if (c.walkMs > 0) lastWalkEndMs = runStartMs;
    restX = c.x;
    restLane = c.lane;
    if (sp !== undefined) {
      spotIdNow = sp.id;
      spotXNow = sp.x;
      spotLaneNow = laneOf(sp);
    }
  };
  // WP28b F30: the end time of the walk a due machine-event reaction cuts, or null. A cue of haltCues finds the walker mid-walk with more than
  // haltMinLeftMs left at its due time: the walk is cut at its next drawn tick and the reaction starts there, within one tick of the due time.
  // Otherwise (or when the reaction may not start now) nothing is cut: the reaction starts at the walk's arrival, at most reactHaltMinLeftMs later.
  const haltEnd = (p: Pending, ctx: BehaviourCtx): number | null => {
    const seg = cur;
    if (p.kind !== 'react' || p.cue === null || p.def === null || !WORLD_REACT.haltCues.includes(p.cue)) return null;
    if (seg === null || joined || ctx.era === ERA_IV || seg.walkMs <= 0) return null;
    const walkEnd = seg.startMs + seg.walkMs;
    if (p.due >= walkEnd || walkEnd - p.due <= WORLD_BEHAVIOUR.reactHaltMinLeftMs) return null;
    const end = seg.startMs + walkCutOf(seg, p.due, segFps).walkMs;
    const def = dueReaction(p.def, p.cue, ctx);
    return def !== undefined && reactGate(def, ctx, end, p.cue) === 'start' ? end : null;
  };
  // Applies one due event at its effective time `at`. A reaction replaces the current activity unless the gate drops it (reactGate). A wake
  // ends the current activity when it wakes on the cue, and the normal pick follows.
  const applyPending = (p: Pending, at: number, ctx: BehaviourCtx): void => {
    pending = pending.filter((q) => q !== p);
    if (p.kind === 'end') {
      if (cur === null || p.cue === null || cur.def.wakeOn?.includes(p.cue) !== true) return;
      cur = cutSeg(cur, at);
      advanceOnce(ctx, false);
      return;
    }
    const picked = p.def;
    if (picked === null) return;
    // WP28b F41b: a due reaction starts its picked activity, or the cue's sibling when the picked one's 'when' no longer holds.
    const def = p.kind === 'react' ? dueReaction(picked, p.cue, ctx) : picked;
    if (def === undefined) return;
    if (p.kind === 'react') {
      const gate = reactGate(def, ctx, at, p.cue);
      if (gate === 'drop') return;
      // WP28b: a reaction that walks waits reactWaitMs and tries again while the walk gate is set.
      if (gate === 'wait') {
        pending.push({ ...p, due: tMs + WORLD_BEHAVIOUR.reactWaitMs, def });
        return;
      }
    } else if (!whenHolds(def, ctx)) {
      // A poke (the player's act) always starts, when its activity holds in this context.
      return;
    }
    if (cur !== null) close(cutSeg(cur, at));
    cur = null;
    const k = mem.k;
    began(startSeg(mem, def, envAt(ctx), at, { react: true }), ctx, k);
  };
  // The first pending event (the earliest due; ties keep the list order).
  const earliestPending = (): Pending | undefined => {
    let best: Pending | undefined;
    for (const p of pending) {
      if (best === undefined || p.due < best.due) best = p;
    }
    return best;
  };
  // Runs every event up to the clock in time order: a pending event at its effective time (a walk in progress is waited out first), and
  // each segment boundary at its end. The result does not depend on the step size.
  const runEvents = (ctx: BehaviourCtx): void => {
    for (;;) {
      const p = earliestPending();
      const segEnd = cur !== null ? cur.endMs : Infinity;
      // WP28b F30: a machine-event reaction due in a walk takes the walk's cut point as its time (haltEnd); the others wait for the arrival.
      const cutEnd = p === undefined ? null : haltEnd(p, ctx);
      const at = p === undefined ? Infinity : (cutEnd ?? (cur !== null ? Math.max(p.due, cur.startMs + cur.walkMs) : p.due));
      if (p !== undefined && at <= tMs && at < segEnd) {
        if (cutEnd !== null && cur !== null) cutWalk(cur, p.due);
        applyPending(p, at, ctx);
      } else if (cur !== null && segEnd <= tMs) {
        advanceOnce(ctx);
      } else {
        return;
      }
    }
  };
  // Records each new cue as seen (an index above the last seen), even when paused, and schedules its response: a wake when the current
  // activity wakes on it (no chance gate), else a reaction (the activities whose reaction holds the cue, off cooldown, the pair cooldown
  // free, the chance gate, one picked by hash). The due time is the clock now plus the cue's delay: the caller's delayMs for this actor, else
  // a draw in the cue's band (reactBand).
  const seeCues = (ctx: BehaviourCtx): void => {
    const before = lastSeen;
    for (const c of ctx.cues) {
      if (c.index <= before) continue;
      lastSeen = Math.max(lastSeen, c.index);
      if (pending.some((p) => p.index === c.index)) continue;
      const delay = c.delayMs?.[actor] ?? lerpHold(hash01(seedNow + WORLD_BEHAVIOUR.salts.latency, c.index), reactBand(actor, c.id));
      if (cur !== null && cur.def.wakeOn?.includes(c.id) === true) {
        pending.push({ kind: 'end', cue: c.id, index: c.index, due: tMs + delay, def: null });
        continue;
      }
      const last = pairAt.get(c.id);
      if (last !== undefined && tMs - last < WORLD_REACT.pairCooldownMs) continue;
      const cands = eligible(actor, ctx.era, ctx).filter((a) => a.reaction?.includes(c.id) === true && offCooldown(mem, a, tMs));
      if (cands.length === 0) continue;
      if (!(hash01(seedNow + WORLD_BEHAVIOUR.salts.react, c.index) < (WORLD_REACT.chanceByCue[c.id] ?? WORLD_REACT.chance))) continue;
      const def = cands[Math.floor(hash01(seedNow + WORLD_BEHAVIOUR.salts.react + 1, c.index) * cands.length)];
      if (def === undefined) continue;
      pairAt.set(c.id, tMs);
      pending.push({ kind: 'react', cue: c.id, index: c.index, due: tMs + delay, def });
    }
  };
  // Moves the clock: a timed step adds dt (unless paused, which the caller checks); crank mode adds one hold step per click and ignores dt.
  // Events run at each tick. The last downbeat's time is recorded (the accent window of era IV).
  const advanceClock = (dtMs: number, ctx: BehaviourCtx): void => {
    if (ctx.mode === 'crank') {
      const clicks = Number.isFinite(ctx.crankSteps) ? Math.max(0, Math.floor(ctx.crankSteps)) : 0;
      for (let i = 0; i < clicks; i++) {
        tMs += CRANK_MS;
        runEvents(ctx);
      }
    } else {
      tMs += Math.max(0, dtMs);
      runEvents(ctx);
    }
    if (ctx.beat.downbeat) lastDownbeatMs = tMs;
  };
  // The debug pin (next): once any walk in progress has arrived, the current segment ends and the pinned activity starts.
  const applyPin = (ctx: BehaviourCtx): void => {
    const id = pin;
    if (id === null) return;
    if (cur !== null && tMs < cur.startMs + cur.walkMs) return;
    pin = null;
    const def = eligible(actor, ctx.era, ctx).find((a) => a.id === id);
    if (def === undefined) return;
    if (cur !== null) close({ ...cur, endMs: tMs, holdMs: tMs - (cur.startMs + cur.walkMs) });
    const k = mem.k;
    began(startSeg(mem, def, envAt(ctx), tMs), ctx, k);
  };
  // The start emit of a hold (emitsAt 'start'): once, on the first step of the hold (after the walk).
  const emitStart = (): void => {
    const seg = cur;
    if (seg === null) return;
    const emits = seg.def.emits;
    if (emits !== undefined && seg.def.emitsAt === 'start' && !startEmitDone && tMs >= seg.startMs + seg.walkMs) {
      frame.emitted ??= emits;
      startEmitDone = true;
    }
  };
  // The tail of a normal step once the clock has moved: parked when nothing runs, else the start emit and the drawn frame.
  const finish = (ctx: BehaviourCtx): BehaviourFrame => {
    if (cur === null) {
      park(ctx.homeX);
      return frame;
    }
    emitStart();
    fill(ctx);
    return frame;
  };
  // The first call after reset: the spot nearest home, the first pick (out of phase), then the frame.
  const begin = (ctx: BehaviourCtx): void => {
    memoSeg = null;
    started = true;
    homeSeen = ctx.homeX;
    spotsNow = spotsOf(ctx);
    cacheSpots(spotsNow);
    const idx = nearestSpot(spotsNow, ctx.homeX);
    const sp = spotsNow[idx];
    mem.spot = idx;
    mem.prevSpot = -1;
    spotIdNow = sp?.id ?? null;
    spotXNow = sp?.x ?? ctx.homeX;
    spotLaneNow = sp === undefined ? 0 : laneOf(sp);
    restX = spotXNow;
    restLane = spotLaneNow;
    x = spotXNow;
    freshPick(ctx, true);
    fill(ctx);
  };

  // Joins the conductor's action: the action starts now (its walk, when it has one and the action starts on this downbeat, runs first).
  const startUnison = (c: UnisonAct, ctx: BehaviourCtx): void => {
    joined = true;
    uId = c.id;
    uPost = c.post;
    uStartBeat = c.startBeat;
    uStartMs = tMs;
    uEndMs = tMs + Math.max(0, c.endBeat - ctx.beat.index) * BEAT_MS;
    uClip = WORLD_UNISON.map[c.post ? 'post' : 'pre'][actor][c.id] ?? null;
    uLook = uClip !== null ? activityLook(actor, uClip, ctx.stare) : null;
    uFps = fpsOf(ctx.mode);
    uK += 1;
    uWalkMs = 0;
    uWalked = false;
    uFromX = x;
    uToX = x;
    uFromLane = restLane;
    uToLane = restLane;
    // The walker (the Inspector's walkFirst actions) walks to another spot on the action's first downbeat, a spot minTravelPx away, unless
    // reduced motion allows no walk yet (one per reducedWalkGapMs).
    const walkOk = !ctx.reduced || tMs - lastWalkEndMs >= WORLD_WALK.reducedWalkGapMs;
    if (uClip?.walkFirst === true && actor === WALKER && c.startBeat === ctx.beat.index && walkOk) {
      const cands: number[] = [];
      spotsNow.forEach((s, i) => {
        if (i !== mem.spot && !isVisitSpot(s.id) && distOf(s.x - restX, laneOf(s) - restLane) >= WORLD_WALK.minTravelPx) cands.push(i);
      });
      const j = cands[Math.floor(hash01(seedNow + WORLD_BEHAVIOUR.salts.spot, uK) * cands.length)];
      const sp = j !== undefined ? spotsNow[j] : undefined;
      if (j !== undefined && sp !== undefined) {
        uToX = sp.x;
        uToLane = laneOf(sp);
        uWalkMs = (walkTicksOf(sp.x - restX, uToLane - restLane) * 1000) / uFps;
        uWalked = true;
        lastWalkEndMs = tMs + uWalkMs;
        mem.prevSpot = mem.spot;
        mem.spot = j;
        mem.at = null;
        spotIdNow = sp.id;
        spotXNow = sp.x;
        spotLaneNow = uToLane;
        restX = sp.x;
        restLane = uToLane;
      }
    }
  };
  // Draws the unison frame: a walk (its tick at the action's fps, from its start), then the clip. perBeat frames by the beat count since the
  // action start; an accent frame inside the accent window after a downbeat, else the clip by time. risePx: the pulse lift inside the window,
  // else the clip's constant rise. The runner stands on its spot (the walker's only walk is its walkFirst).
  const fillUnison = (ctx: BehaviourCtx): void => {
    memoSeg = null;
    const clip = uClip;
    if (clip === null) {
      park(ctx.homeX);
      return;
    }
    const fps = fpsOf(ctx.mode);
    const holdAt = uStartMs + uWalkMs;
    const accentOn = tMs < lastDownbeatMs + WORLD_ERA_ENV.accentMs;
    frame.activity = uId;
    frame.step = ticksSince(tMs - uStartMs, fps);
    frame.poseSet = 'base';
    frame.alpha = clip.alpha ?? 1;
    if (tMs < holdAt) {
      const dx = uToX - uFromX;
      const dl = uToLane - uFromLane;
      const dist = distOf(dx, dl);
      const tick = Math.min(walkTicksOf(dx, dl), Math.max(0, Math.ceil(((tMs - uStartMs) * uFps) / 1000)));
      const along = Math.min(tick * WORLD_WALK.pxPerFrame, dist);
      walking = true;
      x = dist === 0 ? uFromX : uFromX + (dx * along) / dist;
      frame.lane = dist === 0 ? uFromLane : uFromLane + (dl * along) / dist;
      frame.frame = walkFrameOf(tick, false);
      if (dx !== 0) frame.flip = dx < 0;
      frame.risePx = 0;
    } else {
      walking = false;
      x = restX;
      frame.lane = restLane;
      if (clip.perBeat === true) {
        frame.frame = clip.frames[wrapIndex(ctx.beat.index - uStartBeat, clip.frames.length)] ?? '';
      } else if (accentOn && clip.accent !== undefined) {
        frame.frame = clip.accent;
      } else {
        chooseFrame(clip, uEndMs - uStartMs, (ticksSince(tMs - holdAt, fps) * 1000) / fps, false, seedNow, uK, shown, holdWalk);
        frame.frame = shown.frame;
      }
      frame.flip = restFlip(actor, frame.frame, ctx.stare, ctx.homeX);
      frame.risePx = clip.pulse === true ? (accentOn ? WORLD_ERA_ENV.riseWorldPx : 0) : (clip.risePx ?? 0);
    }
    frame.x = x;
    frame.walking = walking;
  };
  // Ends the joined action at atMs: its log entry (its real length, reaction false).
  const closeUnison = (atMs: number): void => {
    if (!joined) return;
    joined = false;
    if (onEnd !== undefined) {
      const walked = uWalked;
      onEnd({
        activity: uId, atMs: uStartMs, durMs: atMs - uStartMs, walked, reaction: false,
        look: (uLook?.key ?? '') + (walked ? '+walk' : ''),
      });
    }
  };
  // Era IV before the join with no segment in progress: the actor's hold frame of the stare set, at the x it is drawn at (no walk, no
  // jump; the join then starts from this x). A waiting frame is never the last frame of a stale segment.
  const fillWaiting = (ctx: BehaviourCtx): void => {
    memoSeg = null;
    const clip = holdClipOf(actor, ctx.stare);
    const rest = clip?.frames[0] ?? '';
    walking = false;
    frame.activity = 'waiting';
    frame.step = 0;
    frame.frame = stareFrame(actor, rest, false, ctx.stare);
    frame.flip = restFlip(actor, rest, ctx.stare, ctx.homeX);
    frame.x = x;
    frame.lane = restLane;
    frame.walking = false;
    frame.poseSet = 'base';
    frame.risePx = 0;
    frame.alpha = clip?.alpha ?? 1;
  };
  // The clip of the settled frame (C7 worldSettle): era IV's hold frame of the stare set; else the first free activity of the context that
  // holds in place (no travel: the rest pose; undefined: no rest frame, the girl in the window stage). WP28b: the roamers' rest poses are no
  // longer repeatable, so the first in-place activity stands for them.
  const restClipOf = (ctx: BehaviourCtx): Clip | undefined => {
    if (ctx.era === ERA_IV) return holdClipOf(actor, ctx.stare);
    for (const a of poolOf(ctx)) {
      if (a.weight > 0 && a.travel === undefined) return a.clip;
    }
    return undefined;
  };
  // The settled frame: no clock, no pick, no cue; the canonical rest frame at the home x, the runner's state untouched (cur, tMs, memory),
  // so settle off resumes the same activity. No rest frame: the parked frame.
  const settleFrame = (ctx: BehaviourCtx): BehaviourFrame => {
    memoSeg = null;
    const clip = restClipOf(ctx);
    if (clip === undefined) {
      park(ctx.homeX);
      return frame;
    }
    const rest = clip.frames[0] ?? '';
    walking = false;
    x = ctx.homeX;
    // The home row: the lane of the spot nearest home (the dog's front row, the Inspector's back row).
    const list = spotsOf(ctx);
    const homeSp = list[nearestSpot(list, ctx.homeX)];
    frame.lane = homeSp === undefined ? 0 : laneOf(homeSp);
    frame.activity = 'settled';
    frame.step = 0;
    frame.frame = stareFrame(actor, rest, false, ctx.stare);
    frame.flip = restFlip(actor, rest, ctx.stare, ctx.homeX);
    frame.x = x;
    frame.walking = false;
    frame.poseSet = 'base';
    frame.risePx = 0;
    frame.alpha = clip.alpha ?? 1;
    return frame;
  };
  // Era IV: the runner follows the shared conductor. Before it joins, its current segment runs out (its end, or the cap: the
  // unisonJoinBeats-th downbeat after the era change, once no walk is in progress). It joins on a downbeat. Joined: the conductor's action
  // is the runner's action; a switch closes the last one (logged with its real length) and starts the next.
  const stepUnison = (dtMs: number, ctx: BehaviourCtx): BehaviourFrame => {
    if (!ivOn) {
      ivOn = true;
      ivLastBeat = ctx.beat.index;
      ivDown = 0;
    }
    if (ctx.beat.downbeat && ctx.beat.index !== ivLastBeat) {
      ivLastBeat = ctx.beat.index;
      ivDown += 1;
    }
    advanceClock(dtMs, ctx);
    seeCues(ctx);
    if (!joined && ctx.beat.downbeat) {
      if (cur === null) {
        startUnison(conductor.current(), ctx);
      } else if (ivDown >= WORLD_BEHAVIOUR.unisonJoinBeats && tMs >= cur.startMs + cur.walkMs) {
        close(cutSeg(cur, tMs));
        cur = null;
        startUnison(conductor.current(), ctx);
      }
    }
    if (joined) {
      const c = conductor.current();
      if (c.id !== uId || c.post !== uPost || c.startBeat !== uStartBeat) {
        // WP28b (V6): a switch that lands inside a walk (a walkFirst walk can outlast a short action) stops the walker where it stands. Its
        // rest point becomes the point it has reached, so the next action starts there and the walker does not jump to the walk's end.
        if (walking) {
          mem.at = { x, lane: frame.lane };
          restX = x;
          restLane = frame.lane;
        }
        closeUnison(tMs);
        startUnison(c, ctx);
      }
      fillUnison(ctx);
    } else if (cur !== null) {
      // Before the join the segment keeps running on screen (its walk, its hold): nothing freezes between the era change and the join.
      emitStart();
      fill(ctx);
    } else {
      fillWaiting(ctx);
    }
    return frame;
  };
  // Leaving era IV (the game only moves on from it): the joined action plays out to its own end, with no conductor switch, and then the
  // normal path picks again.
  const stepLeaving = (dtMs: number, ctx: BehaviourCtx): BehaviourFrame => {
    advanceClock(dtMs, ctx);
    seeCues(ctx);
    if (tMs < uEndMs) {
      fillUnison(ctx);
      return frame;
    }
    closeUnison(uEndMs);
    if (cur === null) freshPick(ctx, false);
    return finish(ctx);
  };

  const step = (dtMs: number, ctx: BehaviourCtx): BehaviourFrame => {
    frame.emitted = null;
    lastCtx = ctx;
    if (ctx.settle === true) return settleFrame(ctx);
    if (!started) begin(ctx);
    else syncSpots(ctx);
    if (ctx.era === ERA_IV) conductor.step(ctx.beat, ctx.stare);
    if (ctx.era !== lastEra) {
      if (lastEra !== NO_ERA) pending = [];
      lastEra = ctx.era;
    }
    if (ctx.paused) {
      if (ctx.beat.downbeat) lastDownbeatMs = tMs;
      seeCues(ctx);
      return frame;
    }
    if (ctx.demoHold) {
      seeCues(ctx);
      park(ctx.homeX);
      return frame;
    }
    endStale(ctx);
    if (ctx.era === ERA_IV) return stepUnison(dtMs, ctx);
    ivOn = false;
    if (joined) return stepLeaving(dtMs, ctx);
    if (cur === null && !hasFree(poolOf(ctx))) {
      seeCues(ctx);
      park(ctx.homeX);
      return frame;
    }
    applyPin(ctx);
    if (cur === null) freshPick(ctx, false);
    if (cur === null) {
      seeCues(ctx);
      park(ctx.homeX);
      return frame;
    }
    advanceClock(dtMs, ctx);
    seeCues(ctx);
    return finish(ctx);
  };

  return {
    step,
    rehome(homeX: number): void {
      if (!started) {
        memoSeg = null;
        homeSeen = homeX;
        x = homeX;
        frame.x = homeX;
        return;
      }
      rehomeTo(homeX);
      refresh();
    },
    reset(s: number, k0: number, homeX: number): void {
      seedNow = s;
      mem = newMemory(s, k0, 0);
      memoSeg = null;
      holdWalk = newHoldWalk();
      cur = null;
      tMs = 0;
      started = false;
      x = homeX;
      walking = false;
      segK = 0;
      segFps = CRANK_FPS;
      startEmitDone = false;
      pin = null;
      homeSeen = homeX;
      lastWalkEndMs = -Infinity;
      spotIdNow = null;
      spotXNow = 0;
      spotLaneNow = 0;
      restX = homeX;
      restLane = 0;
      spotsNow = [];
      slotCount = 0;
      lastCtx = null;
      lastSeen = -1;
      pending = [];
      pairAt.clear();
      lastEra = NO_ERA;
      lastDownbeatMs = -Infinity;
      ivOn = false;
      ivLastBeat = 0;
      ivDown = 0;
      joined = false;
      uK = 0;
      uClip = null;
      uLook = null;
      uWalkMs = 0;
      uWalked = false;
      uFromX = homeX;
      uToX = homeX;
      uFromLane = 0;
      uToLane = 0;
      uStartMs = 0;
      uEndMs = 0;
      uStartBeat = 0;
      frame.activity = 'parked';
      frame.step = 0;
      frame.frame = '';
      frame.flip = false;
      frame.x = homeX;
      frame.lane = 0;
      frame.walking = false;
      frame.poseSet = 'base';
      frame.risePx = 0;
      frame.alpha = 1;
      frame.emitted = null;
    },
    next(activity: string): boolean {
      if (lastCtx === null || !eligible(actor, lastCtx.era, lastCtx).some((a) => a.id === activity)) return false;
      pin = activity;
      return true;
    },
    // WP28a T15a: a poke's leave. Refused in era IV, while joined to the conductor, and for an id outside the era's repertoire. The event is due
    // after delayMs of runner time; runEvents then waits out a walk in progress and starts the activity as a reaction.
    interrupt(activity: string, delayMs: number): boolean {
      if (lastCtx === null || lastCtx.era === ERA_IV || joined) return false;
      const def = eligible(actor, lastCtx.era, lastCtx).find((a) => a.id === activity);
      if (def === undefined) return false;
      const wait = Number.isFinite(delayMs) ? Math.max(0, delayMs) : 0;
      pending.push({ kind: 'poke', cue: null, index: -1, due: tMs + wait, def });
      return true;
    },
    // WP28b: a walk with more than haltMinLeftMs left is cut at the point of its last drawn tick. The walk ends on that tick (walkMs), the
    // point becomes the segment's end (toX / toLane, toSpot the nearest spot) and the hold starts there. The walker stands on that point
    // (mem.at), so the next walk or hold starts from it: nothing jumps. Era IV and a joined runner never cut.
    halt(): boolean {
      const seg = cur;
      if (seg === null || joined || lastCtx === null || lastCtx.era === ERA_IV || spotsNow.length === 0) return false;
      const walkEnd = seg.startMs + seg.walkMs;
      if (seg.walkMs <= 0 || tMs >= walkEnd || walkEnd - tMs <= WORLD_BEHAVIOUR.haltMinLeftMs) return false;
      cutWalk(seg, tMs);
      return true;
    },
    clockMs(): number {
      return tMs;
    },
    snapshot() {
      if (joined) {
        return { activity: uId, sinceMs: tMs - uStartMs, k: mem.k, x, walking, look: uLook?.key ?? '', clockMs: tMs };
      }
      return {
        activity: cur?.id ?? 'parked', sinceMs: cur !== null ? tMs - cur.startMs : 0, k: mem.k, x, walking,
        look: cur?.look.key ?? '', clockMs: tMs,
      };
    },
  };
}

// The unison conductor (era IV, WP24 C2): one shared action at a time. It switches only on a downbeat once the current action has run its
// beats (or at once when the set flips with the stare, or when a pin is set). Rules: never the same id twice in a row, never a static id
// right after a static one, the id two picks back weighted by recency2Back. The choice is by hash (seed + conductor salt, 2k + 1) on the
// cumulative weights, the beats by hash (2k + 2) inside the action's range; k counts picks. Idempotent per beat index.
export function createUnisonConductor(seed: number): UnisonConductor {
  let sd = seed;
  let k = 0;
  let lastIdx: number | null = null;
  let cur: UnisonAct | null = null;
  let hist: UnisonId[] = [];
  let pin: UnisonId | null = null;
  let activePost = false;
  const setOf = (post: boolean): readonly UnisonAction[] => (post ? WORLD_UNISON.post : WORLD_UNISON.pre);
  const isStatic = (id: UnisonId): boolean => WORLD_UNISON.staticIds.includes(id);
  // Picks the next action of the set at beat beatIndex (a pin, when set, is taken as it is).
  const pick = (beatIndex: number, post: boolean): void => {
    const list = setOf(post);
    const prev = cur;
    let chosen: UnisonAction | undefined = pin !== null ? list.find((a) => a.id === pin) : undefined;
    pin = null;
    if (chosen === undefined) {
      const staticPrev = prev !== null && isStatic(prev.id);
      const open = list.filter((a) => (prev === null || a.id !== prev.id) && !(staticPrev && isStatic(a.id)));
      const cands = open.length > 0 ? open : list.filter((a) => prev === null || a.id !== prev.id);
      const pool = cands.length > 0 ? cands : list;
      const back2 = hist.length >= RECENT_IDS ? hist[hist.length - RECENT_IDS] : undefined;
      const weighted = pool.map((a) => ({ item: a, w: a.id === back2 ? a.weight * WORLD_BEHAVIOUR.recency2Back : a.weight }));
      chosen = pickWeighted(weighted, hash01(sd + WORLD_BEHAVIOUR.salts.conductor, 2 * k + 1));
    }
    if (chosen === undefined) return;
    const beats = Math.round(lerpHold(hash01(sd + WORLD_BEHAVIOUR.salts.conductor, 2 * k + 2), chosen.beats));
    k += 1;
    cur = { id: chosen.id, post, startBeat: beatIndex, endBeat: beatIndex + beats };
    hist = [...hist, chosen.id].slice(-RECENT_IDS);
  };
  return {
    step(beat: { downbeat: boolean; index: number }, post: boolean): void {
      activePost = post; // the set the stare shows now (next() validates against it), even inside a beat window
      if (lastIdx === beat.index) return;
      lastIdx = beat.index;
      if (!beat.downbeat) return;
      if (pin === null && cur !== null && beat.index < cur.endBeat && cur.post === post) return;
      pick(beat.index, post);
    },
    current() {
      if (cur === null) return { id: WORLD_UNISON.pre[0]?.id ?? 'still', post: false, startBeat: -1, endBeat: -1 };
      return { id: cur.id, post: cur.post, startBeat: cur.startBeat, endBeat: cur.endBeat };
    },
    next(id: UnisonId): boolean {
      if (!setOf(activePost).some((a) => a.id === id)) return false;
      pin = id;
      return true;
    },
    reset(s: number): void {
      sd = s;
      k = 0;
      lastIdx = null;
      cur = null;
      hist = [];
      pin = null;
      activePost = false;
    },
  };
}

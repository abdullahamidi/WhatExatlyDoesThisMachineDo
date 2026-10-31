// Living world behaviour data (WP24 T1): the cast's activities per era (repertoires), the era IV unison actions, the spots the
// Inspector and the dog walk between, the walk and reaction rules, and the behaviour constants (seed, salts, caps, log size).
// Why: the scheduler (src/game/math/worldBehaviour.ts) and the renderers read one copy of every frame name, cue and number.
// Pure data: no Phaser. Hold, weight and cooldown values are tuned here (the Art Director, T3d); code never repeats them.
// Structure and canon (frames exist in their sheets, the stare-safe and pre-finale rules) are pinned in worldBehaviour.test.ts.
import type { FramingKey } from './livingWorld';
import type { EraNumber } from './eras';
import type { TechId } from './types';
import { WORLD_ERA_ENV } from './worldEras';

export type BehaviourActor = 'inspector' | 'dog' | 'crow' | 'girl';
// b = an extra back-row spot, y = a yard spot, v = a visit stand (WP28b F25, WORLD_VISITS; plain travel never walks to a v spot).
export type SpotId = 'sensor' | 'mid' | 'scrap' | 'stake' | 'home' | 'out' | `b${number}` | `y${number}` | `v${number}`;
// One spot (WP28b, Spots v2): the absolute feet x and the lane. Feet y = GROUND_Y + lane: 0 the back row, 32 the dog's front row, more a yard.
export interface WorldSpot { id: SpotId; x: number; lane: number }
// WP28b cues: fault / faultClear (the fault appears / clears), find (a Find spawns), bigBuy (an unlock, milestone, tier-up or Splice), era (a
// card closes), splice (a Splice wakes). They are emitted by the Director (WORLD_REACT.producers).
export type CueId = 'atSensor' | 'digBout' | 'crowMove' | 'ring' | 'ventPuff' | 'rapid' | 'crankClick' | 'gust' | 'fault' | 'faultClear' | 'find'
  | 'bigBuy' | 'era' | 'splice';
export type BehaviourCond = 'vents' | 'stareOff' | 'stareOn' | 'holeDig' | 'sensor' | 'scraps' | 'girlMini' | 'girlGround' | 'notReduced'
  | 'notDemoHold' | 'hopOk' | 'findOuter' | 'findInner' | 'visits';
export type UnisonId = 'still' | 'stare' | 'sway' | 'beat' | 'look' | 'mouth' | 'hold' | 'rise';

// One frame sequence. dxPx[i] offsets frame i in world px; frameHoldMs draws each frame's hold by hash; edgeMs holds the first and last
// frame (the umbrella); burst alternates animated bursts with a still rest frame (the dig); frameAlpha[i] and alpha draw the lantern gutter.
export interface Clip {
  frames: readonly string[];
  fps: number;
  loop: boolean;
  dxPx?: readonly number[];
  frameHoldMs?: readonly [number, number];
  alpha?: number;
  frameAlpha?: readonly number[];
  edgeMs?: number;
  burst?: { onMs: readonly [number, number]; restFrame: string; restMs: readonly [number, number] };
}

// One free activity (weight > 0) or one reaction-only activity (weight 0, interruptible false, started by a cue in `reaction`).
// emitsAt defaults to 'end'; wakeOn ends the current activity at the cue (the sleep); static is derived by the rules, never a flag.
export interface Activity {
  id: string;
  clip: Clip;
  holdMs: readonly [number, number];
  weight: number;
  cooldownMs: number;
  // 'outer' walks to the outer spot: the spot farthest from the machine anchor on the actor's own side, other than the current spot, when it is
  // farther from the anchor than the actor (none: the activity starts in place). The poke leaves (WP28a T15a, A13 [R1]).
  // WP28b: 'inner' walks to the spot nearest the anchor on the actor's side (only when nearer than the actor); 'visit' walks to the Director's
  // visit spot (ctx.visitSpot); 'find' walks outward to the spot nearest the Find (ctx.findX) within the walk limit.
  travel?: 'spot' | 'sensor' | 'scrap' | 'home' | 'stake' | 'notStake' | 'outer' | 'inner' | 'visit' | 'find';
  reversed?: true;
  when?: readonly BehaviourCond[];
  reaction?: readonly CueId[];
  wakeOn?: readonly CueId[];
  emits?: CueId;
  emitsAt?: 'start' | 'end';
  interruptible: boolean;
  repeatable?: true;
  capMs?: number;
  micro?: true;
  poseSet?: 'umbrella';
  // A brief glitch: never in crank playback, never the first pick of a fresh runner.
  glitch?: true;
  follow?: Partial<Record<string, number>>;
  // A poke-only activity (WP28a T15a): weight 0, no reaction cue, never picked; BehaviourRunner.interrupt starts it (a level-3 poke).
  poke?: true;
}

// A unison clip (era IV): perBeat advances one frame per downbeat, accent is the frame on each downbeat of a still action, walkFirst walks
// on the first downbeat, risePx lifts the walker, pulse is the crow / girl beat.
export interface UnisonClip extends Clip {
  perBeat?: true;
  accent?: string;
  walkFirst?: true;
  risePx?: number;
  pulse?: true;
}
export interface UnisonAction { id: UnisonId; beats: readonly [number, number]; weight: number }

// Camera-facing frames (DENIZEN_ART §2.1-§2.4). The first entry is the actor's front, the fallback of the stare map.
export const WORLD_STARE_SAFE: Readonly<Record<BehaviourActor, readonly string[]>> = {
  inspector: ['front', 'talk'], dog: ['head', 'talk'], crow: ['head', 'talk'], girl: ['stand0', 'stand1', 'talk', 'lanternUp', 'tilt'],
};

// Payoff frames of the finale (D7): no pre-finale activity or unison clip of the actor may show them. The crow's fly frames are not banned
// before the finale since WP28a (C3): only the poke-only hop (one wing, a short perch-to-perch flight) draws them; the finale flight keeps its
// own staging.
export const WORLD_PREFINALE_BANNED: Readonly<Record<BehaviourActor, readonly string[]>> = {
  inspector: ['pat0', 'pat1', 'wave', 'shield'], dog: ['flat', 'lie', 'chase0', 'chase1'], crow: [],
  girl: ['shield', 'run0', 'run1', 'run2', 'run3', 'lanternDrop'],
};

// Walks between spots: 8 world px per drawn walk frame, a walk is at least minTravelPx and at most maxWalkMs; reduced motion walks rarely.
export const WORLD_WALK = {
  pxPerFrame: 8, minTravelPx: 24, maxWalkMs: 6000, maxWalkShare: 0.3, reducedWalkGapMs: 60000, prevSpotWeight: 0.5,
} as const;

// Reactions: a cue starts a reaction with `chance`, at most once per pairCooldownMs per actor and cue; latency is the actor's band.
// routes name the consumers of each cue (the reaction activities and the renderer effects); producers say who emits the cue.
// WP28b: the six new cues (fault, faultClear, find, bigBuy, era, splice) start after the actor's staggerMs band (the Inspector's find after
// findDelayMs, he points 2-4 s after the spawn) instead of latencyMs; chanceByCue overrides the chance of a cue (1 for the new ones).
// AD4 F47: rapid is at 1 too (a crank burst always ruffles the crow; the pair cooldown still holds).
// WP28b F25: spliceDelayMs is the delay of the splice cue after a wake (the Director pushes it; the visit then walks to its stand). visitHoldMs
// is how long a named visit stand stays valid. WP28b F30: haltCues are the machine-event cues whose reaction cuts a walk in progress at its next
// drawn tick (the runner's halt, then the reaction at once), so a reaction starts within a tick of its due time, not at the walk's arrival.
// WP28b reaction gaps: faultDimMs is the girl's lantern dim on a fault (1 s; the poke dim is 2 s); hopChanceByCue is the chance the Director
// rolls for the crow's free hop with a cue (a bigBuy hop 30 %; the hop itself is the crow's hopFree activity).
export const WORLD_REACT: {
  chance: number;
  pairCooldownMs: number;
  latencyMs: Record<BehaviourActor, readonly [number, number]>;
  staggerMs: Record<BehaviourActor, readonly [number, number]>;
  findDelayMs: readonly [number, number];
  spliceDelayMs: readonly [number, number];
  visitHoldMs: number;
  haltCues: readonly CueId[];
  faultDimMs: number;
  chanceByCue: Partial<Record<CueId, number>>;
  hopChanceByCue: Partial<Record<CueId, number>>;
  routes: Record<CueId, readonly string[]>;
  producers: Record<CueId, 'activity' | 'director' | 'world'>;
} = {
  chance: 0.5,
  pairCooldownMs: 30000,
  latencyMs: { inspector: [200, 500], dog: [650, 950], girl: [1100, 1400], crow: [1550, 1850] },
  staggerMs: { inspector: [200, 400], dog: [400, 600], crow: [600, 900], girl: [0, 0] },
  findDelayMs: [2000, 4000],
  spliceDelayMs: [3000, 8000],
  visitHoldMs: 20000,
  haltCues: ['fault', 'faultClear', 'find', 'bigBuy', 'era'],
  faultDimMs: 1000,
  chanceByCue: { fault: 1, faultClear: 1, find: 1, bigBuy: 1, era: 1, splice: 1, rapid: 1 },
  hopChanceByCue: { bigBuy: 0.3 },
  routes: {
    atSensor: ['sensor.doubleBlink'], digBout: ['props.holeStep'], crowMove: ['dog.lookUp'], ring: ['dog.wake', 'dog.lookUp', 'dog.wag'],
    ventPuff: ['inspector.umbrella', 'dog.shake', 'girl.palm', 'props.fogBuild', 'props.puddleRing'], rapid: ['dog.wake', 'crow.ruffleReact'],
    crankClick: ['crow.tipTry'], gust: ['crow.tipTry'],
    fault: ['inspector.startle', 'dog.bark', 'crow.ruffleReact'], faultClear: ['inspector.writeTick', 'dog.wag', 'crow.settle'],
    find: ['inspector.point', 'inspector.lookFind', 'dog.sniffFind', 'dog.sniffHere', 'crow.glanceDown'],
    bigBuy: ['inspector.startle', 'dog.lookBig', 'dog.lookBigV', 'crow.ruffleReact'], era: ['inspector.eraFront', 'dog.eraHead', 'crow.eraPerchHead'],
    splice: ['inspector.visitWrite', 'dog.visitSniff'],
  },
  producers: {
    atSensor: 'activity', digBout: 'activity', crowMove: 'activity', ring: 'director', ventPuff: 'world', rapid: 'director',
    crankClick: 'director', gust: 'world', fault: 'director', faultClear: 'director', find: 'director', bigBuy: 'director', era: 'director',
    splice: 'director',
  },
};

// Scheduler constants. seed + cycleSalt x cycle + actorSalt[actor] seeds each runner; k0Stride offsets a session's activity count by
// active minutes; recency2Back is the weight of an activity used two picks ago; capMs are the hold caps (static runs are shorter).
// minHoldMs, crankHoldMsPerClick, advanceStepMs and logSize are the runner clock and log ring; salts keep the hash streams apart.
// ringEveryMs is the gap between two ring cues (the dog's sleep and lookUp answer them), drawn by hash from era II on (salts.ring).
// cadenceMaxStepMs caps the dt one heavy frame steps the clocks and runners by (the excess is dropped). It stays below the walk tick
// period (WORLD_PLAYBACK fps8, 125 ms), so a walk draws at most one 8 px frame per step (V6) even at 15 fps.
// WP28b: the caps are short so no rest pose statues (the cast read 38-45 s holds). restHoldMs is the range of a roaming rest hold (9 s is
// the guard bound); actionGapMs is the B1 gate (an action at least every 12 s); actionMinTravelPx is the travel that counts as an action.
// WP28b deviation: plan D5 9.5 s micro rule not built; the 12 s action gap holds through the hold caps (measured by worldBehaviourMetrics).
// WP28b: walkStaggerMs is the walk gate (no two walkers start a walk within it, so the cast never moves as one); haltMinLeftMs is the least
// walk left for a poke to cut a walk short (a cut that close to the arrival would read as a stop, not a turn). reactWaitMs is the retry of a
// reaction that would walk while the walk gate is set (a reaction walk obeys the gate like a pick).
// WP28b B3: reactHaltMinLeftMs is the least walk left for a machine-event cue to cut its walker's walk (250 ms, a quarter of haltMinLeftMs).
// A cut starts the reaction at the next walk tick after its due time; with less left the reaction waits for the arrival, so it starts within
// stagger + 250 ms + one walk tick of the cause. The poke halt keeps haltMinLeftMs.
// WP28b (r2-FX4G, V5): startGuardMs is the start gate: a segment boundary within it of another denizen's latest start moves on to startGuardMs
// from that start, and one boundary moves at most startGuardExtMax x startGuardMs (plan A2). 150 ms, above the 125 ms lock window that V5 reads.
export const WORLD_BEHAVIOUR = {
  seed: 24101, cycleSalt: 7919, actorSalt: { inspector: 11, dog: 23, crow: 37, girl: 53 },
  k0Stride: 97, recency2Back: 0.4, mergeJitter: [0.5, 1], capMs: { hold: 10000, staticEarly: 8000, staticV: 10000 },
  restHoldMs: [3000, 9000], actionGapMs: 12000, actionMinTravelPx: 8, walkStaggerMs: 1000, startGuardMs: 150, startGuardExtMax: 3,
  haltMinLeftMs: 1000,
  reactWaitMs: 250, reactHaltMinLeftMs: 250,
  minHoldMs: 500, crankHoldMsPerClick: 500, advanceStepMs: 250, logSize: 1024, unisonJoinBeats: 3, ringEveryMs: [300000, 480000],
  cadenceMaxStepMs: 120,
  salts: { merge: 97, spot: 31, react: 211, latency: 223, conductor: 7, start: 999, ring: 409 },
} as const;

// Spots v2 (WP28b): absolute feet x and lane per framing (WorldSpot). A bare x is the actor's home row (Inspector lane 0, dog lane 32).
// Ids: the Inspector's 'sensor' is the back-row spot nearest Sensor 7 (his one spot at s8, s8w, s10), 'mid' the spot at his placement x,
// b1, b2... the other back-row spots by x; the dog's 'home' is the spot at his placement x, 'stake' the front-row spot left of home nearest
// home - 24 (e1, s15), b1... the other front-row spots; y1, y2... the yard spots in table order. The table is the AD3-CELLS set; the
// worldBehaviour and worldPlacement tests pin its rules. Spots lie in actorBand (the wing, the crank circle + 24 px, the gain spawn).
const sp = (id: SpotId, x: number, lane = 0): WorldSpot => ({ id, x, lane });
// WP28b C-b (the AD3 spot check, 34 rows): every spot clears the actor bands, the Splice objects, Sensor 7, the girls and the UI 150 buttons.
// WP28b F25: the visit stands v<n> (AD3 hand-off C-c) are appended per framing and actor, in table order; the stand of each woken Splice is
// in WORLD_VISITS. Plain travel never walks to a v spot (the runner's isVisitSpot). A stand is the object's feet x shifted 24-48 px toward the
// machine (the walker faces the object), on the object's lane or a yard lane (WP28b r2-FX1 A14: the guard is x-only, so a stand that its neighbour's
// box meets on x moves down the yard instead).
export const WORLD_SPOTS: Partial<Record<FramingKey, Partial<Record<'inspector' | 'dog', readonly WorldSpot[]>>>> = {
  e1: {
    inspector: [sp('sensor', 1440), sp('mid', 1472), sp('b1', 1512), sp('y1', 1390, 110), sp('y2', 1520, 72), sp('v1', 1390, 64)],
    dog: [sp('stake', 2340, 32), sp('home', 2364, 32), sp('y1', 2410, 64), sp('y2', 2448, 60), sp('y3', 2520, 48), sp('v1', 2440, 96),
      sp('v2', 2484, 32)],
  },
  s8: {
    inspector: [sp('sensor', 1536), sp('y1', 1552, 56)],
    dog: [sp('home', 2604, 32), sp('b1', 2656, 32), sp('v1', 2576, 32), sp('v2', 2648, 32)],
  },
  s8w: {
    inspector: [sp('sensor', 1552), sp('y1', 1548, 24), sp('v1', 1548, 56)],
    dog: [sp('home', 2694, 32), sp('b1', 2720, 32)],
  },
  s9: {
    inspector: [sp('sensor', 1424), sp('b1', 1448), sp('mid', 1472), sp('b2', 1512), sp('y1', 1448, 64), sp('y2', 1492, 96), sp('v1', 1430, 80)],
    dog: [sp('home', 2856, 32), sp('y1', 2900, 24), sp('v1', 2900, 32), sp('v2', 2906, 32), sp('v3', 2868, 32)],
  },
  s10: {
    inspector: [sp('sensor', 1276), sp('y1', 1248, 80)],
    dog: [sp('home', 2858, 32), sp('b1', 2882, 32)],
  },
  s11: {
    // WP28b r2-FX1 (A14, B): the radio's stand (932@96) and the gramophone's (992@150) are dropped: the far girl mini blocks every x the radio's
    // 24-48 px offset allows, and era IV has no visit. The cairn's stand moves to 910 (30 px off the cairn, clear of the mini) and renumbers to v2.
    inspector: [sp('sensor', 790), sp('mid', 816), sp('b1', 846), sp('y1', 740, 170), sp('y2', 836, 88), sp('v1', 750, 72), sp('v2', 910, 170)],
    dog: [sp('home', 2856, 32), sp('y1', 2900, 56), sp('y2', 2990, 48), sp('y3', 3140, 40), sp('v1', 2912, 130), sp('v2', 3012, 76),
      // WP28b r2-FX1 (A14): the chimes and kite stand moves to yard lane 128; on the back row the sign's box and the vane's band meet the walker.
      sp('v3', 3110, 120), sp('v4', 3018, 32), sp('v5', 3072, 128), sp('v6', 2938, 32), sp('v7', 2858, 32)],
  },
  s15: {
    inspector: [sp('sensor', 752), sp('mid', 784), sp('b1', 820), sp('y1', 800, 64), sp('y2', 816, 120), sp('v1', 756, 56), sp('v2', 722, 128),
      sp('v3', 792, 112)],
    dog: [sp('home', 2856, 32), sp('b1', 2880, 32), sp('stake', 2832, 32), sp('v1', 2858, 32)],
  },
};
// The yard of a framing (WP28b, world.md section 5): a spot with lane > 0 inside the UI 150 HUD-button x-range [hudMinX, hudMaxX] must have
// lane <= maxLane, so a yard foot never sits under a HUD button.
export const WORLD_YARD: Partial<Record<FramingKey, { maxLane: number; hudMinX: number; hudMaxX: number }>> = {
  e1: { maxLane: 119, hudMinX: 1988, hudMaxX: 2543 },
  s8: { maxLane: -9, hudMinX: 2132, hudMaxX: 2687 },
  s8w: { maxLane: -9, hudMinX: 2170, hudMaxX: 2735 },
  s9: { maxLane: 25, hudMinX: 2269, hudMaxX: 3023 },
  s10: { maxLane: -12, hudMinX: 2146, hudMaxX: 2886 },
  s11: { maxLane: 158, hudMinX: 2037, hudMaxX: 3168 },
  s15: { maxLane: 10, hudMinX: 2035, hudMaxX: 3166 },
};

// WP28b F25: the stand of each woken Splice in a framing (AD3 hand-off C-c). The Inspector visits left-wing objects, the dog right-wing ones.
// from: the spots the walk to the stand is clean from (a visit from any other spot would cross the object's base; none = every spot).
// minEra / maxEra: the eras the stand is used in (the era III-V objects count from their era on). Era IV plays no visit (Director ruling
// 2026-10-30 R3: no machine-event reaction in era IV), so a stand only era IV would use is dropped (the s11 gramophone, WP28b r2-FX1 G).
// No stand: the object is exempt in that framing (C-c 'No visit'; the s8 organ and the s11 radio, WP28b r2-FX1 (A14, B): the far girl mini blocks them).
export interface VisitStand {
  object: TechId; actor: 'inspector' | 'dog'; spot: SpotId; from?: readonly SpotId[]; minEra?: EraNumber; maxEra?: EraNumber;
}
// WP28b FX6: a stand by position (object, actor, spot, from / minEra / maxEra in extra); the rows name no keys.
const standAt = (object: TechId, actor: 'inspector' | 'dog', spot: SpotId, extra: Partial<VisitStand> = {}): VisitStand => ({ object, actor, spot, ...extra });
export const WORLD_VISITS: Partial<Record<FramingKey, readonly VisitStand[]>> = {
  e1: [
    standAt('spliceOrgan', 'inspector', 'v1', { from: ['sensor', 'mid', 'b1', 'y1', 'y2'] }),
    standAt('spliceBicycle', 'dog', 'v1', { from: ['stake', 'home', 'y1', 'y2', 'y3'] }),
    standAt('spliceClock', 'dog', 'v2'),
  ],
  s8: [
    standAt('splicePayphone', 'dog', 'v1', { from: ['home', 'b1'] }),
    standAt('spliceClock', 'dog', 'v2'),
  ],
  s8w: [
    standAt('spliceOrgan', 'inspector', 'v1', { from: ['sensor', 'y1'] }),
  ],
  s9: [
    standAt('spliceOrgan', 'inspector', 'v1'),
    standAt('splicePayphone', 'dog', 'v1', { from: ['home', 'y1'] }),
    standAt('spliceSign', 'dog', 'v2', { from: ['home', 'y1'] }),
    standAt('spliceClock', 'dog', 'v3'),
  ],
  s11: [
    standAt('spliceOrgan', 'inspector', 'v1'),
    standAt('spliceCairn', 'inspector', 'v2', { from: ['sensor', 'y1', 'y2'], minEra: 5 }),
    standAt('spliceBicycle', 'dog', 'v1', { from: ['home', 'y1', 'y2'] }),
    standAt('spliceSign', 'dog', 'v2', { from: ['home', 'y1', 'y2', 'y3'] }),
    standAt('spliceBell', 'dog', 'v3', { from: ['y1', 'y3'], minEra: 4 }),
    standAt('splicePayphone', 'dog', 'v4'),
    standAt('spliceVane', 'dog', 'v4', { minEra: 5 }),
    standAt('spliceCoinReturn', 'dog', 'v4', { minEra: 5 }),
    standAt('spliceChimes', 'dog', 'v5', { minEra: 4 }),
    standAt('spliceKite', 'dog', 'v5', { minEra: 5 }),
    standAt('spliceWhistle', 'dog', 'v6', { minEra: 3 }),
    standAt('spliceClock', 'dog', 'v7'),
  ],
  s15: [
    standAt('spliceOrgan', 'inspector', 'v1'),
    // WP28b r2-FX1 (A14): the stand sits on yard lane 128 right of the organ's box; from y2 the walk stays in front of the gramophone's base (lane 112).
    standAt('spliceRadio', 'inspector', 'v2', { from: ['y2'] }),
    standAt('spliceGramophone', 'inspector', 'v3'),
    standAt('spliceClock', 'dog', 'v1'),
  ],
};

// Clip helpers: c for a looped clip with extras, one for a single still frame.
// WP28b FX6: the frames of a clip are one space-separated string (the pokes' framed() idiom), split once here.
const c = (frames: string, fps: number, extra: Partial<Clip> = {}): Clip => ({ frames: frames.split(' '), fps, loop: true, ...extra });
const one = (f: string): Clip => c(f, 1);
// WP28b FX6: a free activity by position (id, clip, hold, weight, cooldown, extra). The rows name no keys, which keeps the lazy chunk small; a row
// a poke or a cue cannot cut passes interruptible: false in extra (the default is the common row).
const act = (id: string, clip: Clip, holdMs: readonly [number, number], weight: number, cooldownMs: number, extra: Partial<Activity> = {}): Activity =>
  ({ id, clip, holdMs, weight, cooldownMs, interruptible: true, ...extra });

// Micro activities (WP28b): weight 0, never picked by weight. The scheduler's fallback starts one (a glance, a scratch, a peck, a talk) when
// no other id may start, so a rest pose never runs on alone. They hold 1.2-2.2 s and never repeat back to back (the scheduler's rules).
const MICRO_HOLD: readonly [number, number] = [1200, 2200];
const micro = (id: string, clip: Clip): Activity => act(id, clip, MICRO_HOLD, 0, 0, { micro: true });
const INS_MICRO_GLANCE: Activity = micro('microGlance', one('glance'));
const INS_MICRO_TALK: Activity = micro('microTalk', c('talk front', 1));
const DOG_MICRO_SCRATCH: Activity = micro('microScratch', c('scratch0 scratch1', 6));
const DOG_MICRO_TALK: Activity = micro('microTalk', c('talk head', 1));
const CROW_MICRO_PECK: Activity = micro('microPeck', c('peck0 peck1', 3));
const CROW_MICRO_CAW: Activity = micro('microCaw', c('talk head', 1));

// The Inspector's rounds (eras I-III). Frames: idle and write are the walk-free poses; reading walks to the sensor and emits atSensor.
// WP28b: the rest poses of the roamers hold 3-9 s (WORLD_BEHAVIOUR.restHoldMs), so no rest pose statues past the 9 s guard bound.
const INS_ROUNDS: readonly Activity[] = [
  act('stand', c('idleA idleB', 2), [3000, 6000], 3, 0),
  act('stroll', c('idleA idleB', 2), [1000, 6000], 12, 2000, { travel: 'spot' }),
  act('strollWrite', c('write0 write1', 2), [2000, 8000], 3, 3000, { travel: 'spot' }),
  act('write', c('write0 write1', 2), [3000, 9000], 3, 15000),
  // WP28b (r2-FX4T, T1): reading looks up now and then, so its look differs from write's (two write rests in a row read as one run).
  act('reading', c('write0 write1 lookUp', 1, { frameHoldMs: [1500, 3000] }), [3000, 6000], 2, 60000,
    { travel: 'sensor', when: ['sensor'], emits: 'atSensor', emitsAt: 'start' }),
  act('watch', one('watch'), [2000, 4000], 1, 45000, { follow: { write: 1.5 } }),
  act('lookUp', one('lookUp'), [3000, 6000], 2, 30000),
  act('crouch', one('crouch'), [3000, 6000], 1.5, 45000, { travel: 'sensor', when: ['scraps'] }),
];
// The umbrella (era III, vents): a reaction to ventPuff. The clip holds the first and last frame for edgeMs; poseSet switches the base pose.
const INS_UMBRELLA: readonly Activity[] = [
  act('umbrella', c('umbrellaHalf umbrellaOpen umbrellaHalf', 2, { loop: false, edgeMs: 500 }), [6000, 9000], 0, 45000,
    { reaction: ['ventPuff'], when: ['vents'], poseSet: 'umbrella', interruptible: false }),
];
// WP28b B-T1c1: the walk weights per era. Era I walks take twice as long (fps 4), so its walks are rarer and shorter-held: the walk share stays
// under 20 %, and a walk plus its hold stays inside the 10.5 s visible-gap bound (WP28b r2-FX4T, T1, T4). Era III has the long yard walks.
const INS_ROUNDS_I: readonly Activity[] = INS_ROUNDS.map((a) => {
  if (a.id === 'stroll') return { ...a, holdMs: [1000, 3000], weight: 3.4 };
  if (a.id === 'strollWrite') return { ...a, holdMs: [1000, 3000], weight: 0.5 };
  if (a.id === 'stand' || a.id === 'write') return { ...a, holdMs: [3000, 9000] };
  if (a.id === 'lookUp') return { ...a, holdMs: [4000, 6000], weight: 1 };
  return a;
});
const INS_ROUNDS_III: readonly Activity[] = INS_ROUNDS.map((a) => {
  if (a.id === 'stroll') return { ...a, holdMs: [1000, 6000], weight: 12 };
  if (a.id === 'strollWrite') return { ...a, holdMs: [2000, 5000], weight: 5 };
  if (a.id === 'stand') return { ...a, holdMs: [3000, 9000] };
  if (a.id === 'write') return { ...a, holdMs: [3000, 6000] };
  if (a.id === 'lookUp') return { ...a, holdMs: [3000, 6000] };
  return a;
});
// The Inspector in era V (the stare): the front pose only, a reversed backstep and a sensor walk. Every frame is stare-safe.
const INS_V: readonly Activity[] = [
  act('stand', one('front'), [3000, 9000], 3, 0),
  act('backstep', one('front'), [2000, 6000], 4, 4000, { travel: 'spot', reversed: true }),
  act('backstepTalk', c('talk front', 1), [2000, 6000], 4, 4000, { travel: 'spot', reversed: true }),
  act('mouth', one('talk'), [4000, 9000], 3, 0),
  act('withSensor', c('front talk', 1, { frameHoldMs: [1500, 2800] }), [3000, 6000], 2, 10000,
    { travel: 'sensor', reversed: true, when: ['sensor'], emits: 'atSensor', emitsAt: 'start' }),
];

// The dog's rounds (eras I-III). Sniff and pace are the walks of the dog; sleep holds until a ring or a rapid click wakes it.
const DOG_ROUNDS: readonly Activity[] = [
  act('sit', c('sit0 sit1', 1), [3000, 6000], 3, 0),
  act('sniff', c('sniff0 sniff1', 2), [3000, 6000], 2, 10000),
  act('pace', c('sit0 sit1', 1), [2000, 6000], 8, 4000, { travel: 'spot' }),
  act('trot', c('sniff0 sniff1', 2), [2000, 8000], 5, 4000, { travel: 'spot' }),
  act('scratch', c('scratch0 scratch1', 6), [1500, 3000], 1, 45000),
  act('lookUp', one('lookUp'), [3000, 6000], 1, 30000, { reaction: ['crowMove', 'ring'] }),
  act('sleep', one('sleep'), [4000, 9000], 1, 120000, { wakeOn: ['ring', 'rapid'] }),
];
// WP28b r2-FX4T (T1, T4): the dog's walk weights and holds per era. Era I walks take twice as long (fps 4): shorter pace holds keep a walk and its
// hold inside the 10.5 s visible-gap bound, and the rests stay at 3-9 s. Era III: more walks on the long yard, the rests of the 2-spot cast.
const DOG_ROUNDS_I: readonly Activity[] = DOG_ROUNDS.map((a) => {
  if (a.id === 'sit' || a.id === 'sniff') return { ...a, holdMs: [3000, 9000] };
  if (a.id === 'pace') return { ...a, holdMs: [1000, 2000], weight: 3.5 };
  if (a.id === 'trot') return { ...a, holdMs: [1000, 4000], weight: 1 };
  return a;
});
const DOG_ROUNDS_III: readonly Activity[] = DOG_ROUNDS.map((a) => {
  if (a.id === 'sit' || a.id === 'sniff') return { ...a, holdMs: [3000, 9000] };
  if (a.id === 'pace') return { ...a, holdMs: [2000, 5000], weight: 7 };
  if (a.id === 'trot') return { ...a, holdMs: [2000, 5000], weight: 3 };
  return a;
});
// The dig (era II, after the load-beneath log): walks home, then animated bursts between still sniff listens; each bout emits digBout.
const DOG_DIG: Activity = act('dig', c('dig0 dig1', 4, { burst: { onMs: [1500, 4000], restFrame: 'sniff0', restMs: [1000, 2000] } }),
  [6000, 9000], 4, 20000, { travel: 'home', when: ['holeDig'], emits: 'digBout', emitsAt: 'end' });
// The wag (eras I-III): a reaction to ring and faultClear (faults run in era I too), weight 0.
const DOG_WAG: Activity = act('wag', c('sit0 wag', 2), [2000, 4000], 0, 60000, { reaction: ['ring', 'faultClear'], interruptible: false });
// The shake (era III, vents): a reaction to ventPuff, weight 0.
const DOG_SHAKE: Activity = act('shake', c('shake0 shake1', 6), [1000, 2000], 0, 20000, { reaction: ['ventPuff'], when: ['vents'], interruptible: false });
// The dog in era V (the stare): head frames and talk, reversed walks that keep the dog between its stake and the rest of the yard.
const DOG_V: readonly Activity[] = [
  act('sit', one('head'), [4000, 9000], 2, 0),
  act('wander', one('head'), [3000, 9000], 3, 6000, { travel: 'notStake', reversed: true }),
  act('backToStake', c('head talk', 1), [3000, 9000], 5, 6000, { travel: 'stake', reversed: true }),
  act('mouth', one('talk'), [3000, 6000], 1, 0),
  // WP28b r2-FX4T (T3): the head and talk pose at rest; its look (head and talk, no walk) differs from every other dog look.
  act('listen', c('head talk', 1), [2000, 9000], 1.5, 0),
];

// The crow in eras I-II (WP27 D5): perched, wings folded; the spread-wing freeze is a rare glitch of at most 1.8 s (tipTry, the old story beat).
// WP28b B-T1c1: the crow is calmer (its rest poses 3-9 s, the other poses 4-8 s): its starts are a large part of the V5 lock, and the longer
// holds keep the 4-run repeats (V2) down. Every rest pose stays inside the rest range.
const crowPerched = (bob: readonly [number, number]): readonly Activity[] => [
  act('perch', c('perch0 perch1', 1, { frameHoldMs: bob }), [3000, 9000], 3, 0),
  act('look', c('perchTurn perch0', 1, { frameHoldMs: [800, 2000] }), [4000, 8000], 2, 10000),
  act('peck', c('peck0 peck1', 3), [4000, 8000], 1.5, 15000, { emits: 'crowMove', emitsAt: 'start' }),
  act('ruffle', one('ruffle'), [4000, 8000], 1, 12000, { emits: 'crowMove', emitsAt: 'start' }),
];
const CROW_GLITCH: Activity = act('tipTry', c('frozenTip frozen', 2, { frameHoldMs: [300, 700] }), [800, 1800], 0.3, 60000,
  { reaction: ['crankClick', 'gust'], glitch: true });
const CROW_I: readonly Activity[] = [
  ...crowPerched([1200, 3500]),
  act('shift', c('perch0 perch0 perch0 perch0', 1, { dxPx: [0, 2, 0, -2], frameHoldMs: [1000, 2500] }), [4000, 8000], 1, 12000),
  CROW_GLITCH,
];
const CROW_II: readonly Activity[] = [
  ...crowPerched([800, 3000]),
  act('stutter', c('perch0 perch0', 1, { dxPx: [0, 4], frameHoldMs: [500, 2500] }), [4000, 8000], 1.5, 10000),
  act('skip', c('perch0 perch1', 1, { dxPx: [0, 4], frameHoldMs: [150, 350] }), [4000, 8000], 0.7, 12000),
  { ...CROW_GLITCH, weight: 0.4, clip: c('frozenTip frozen', 2, { frameHoldMs: [250, 600] }) },
];
// The crow in era III: perch, the ruffle and the peck (each emits crowMove at its start), and a 2 px shift on the perch.
const CROW_III: readonly Activity[] = [
  act('perch', c('perch0 perch1', 1), [3000, 9000], 3, 0),
  act('look', c('perchTurn perch0', 1, { frameHoldMs: [800, 2000] }), [4000, 8000], 2, 10000),
  act('ruffle', one('ruffle'), [4000, 8000], 1.5, 10000, { emits: 'crowMove', emitsAt: 'start' }),
  act('peck', c('peck0 peck1', 3), [4000, 8000], 1, 15000, { emits: 'crowMove', emitsAt: 'start' }),
  act('shift', c('perch0 perch0 perch0 perch0', 1, { dxPx: [0, 2, 0, -2], frameHoldMs: [1000, 2500] }), [4000, 8000], 1, 12000),
];
// The crow in era V (the stare): the 4 px stutter on the head frame, a still head and a caw (talk, then head; no sound). WP28b B-T1c1: the rest
// poses reach 3 s and the caw 2-5 s (more distinct holds, so fewer 4-run repeats).
const CROW_V: readonly Activity[] = [
  act('stutterV', c('head head', 1, { dxPx: [0, 4], frameHoldMs: [500, 2500] }), [3000, 9000], 2, 0),
  act('stillV', one('head'), [3000, 9000], 2, 0),
  act('caw', c('talk head', 1), [2000, 5000], 1.5, 10000),
  // WP28b r2-FX4T (T3): a caw with a 4 px stutter; its look (head and talk with the shift) is none of the other crow looks, so the 4-runs spread.
  act('cawStutter', c('head talk', 1, { dxPx: [0, 4], frameHoldMs: [1000, 2500] }), [3000, 9000], 2, 0),
];

// Poke-only activities (WP28a T15a): weight 0, never picked, never cued; BehaviourRunner.interrupt starts them as a reaction after a level-3
// poke. The Inspector and the dog walk to the outer spot (the leave) and stay there, facing away. Era V has no walking leave: its level 3 plays
// in place (the poke tables leave null), so no era V leave row exists. The crow hops to another perch: the three fly frames, one wing, the arc
// drawn by LivingWorld (C3). Era IV has none (the conductor plays the cast).
const POKE_LEAVE_INS: Activity = act('leaveWrite', c('write0 write1', 2), [6000, 9000], 0, 0, { travel: 'outer', poke: true, interruptible: false });
const POKE_LEAVE_DOG: Activity = act('leaveSit', one('sit0'), [8000, 9000], 0, 0, { travel: 'outer', poke: true, interruptible: false });
const POKE_HOP: Activity = act('hop', c('fly0 fly1 fly2', 12), [600, 600], 0, 0, { poke: true, interruptible: false });
// The era V hop plays its frames in reverse (WP28 Pokes: era V reverses the hop).
const POKE_HOP_V: Activity = { ...POKE_HOP, reversed: true };

// The girl on the ground (eras I-III from cycle 3, the era IV conductor and era V). She never travels and never moves on screen.
// WP28b: sway keeps the pre-WP28b hold cap (45 s, capMs) like the girl's mini holds; the roaming cap (10 s) is for the roamers.
// WP28b: the roaming static caps fell to 8 s (staticEarly), which cut her static holds of 6-16 s to one length (four-run repeats at S11c3).
// Her static rest poses keep the v0.11.0 cap of 16 s (capMs), so the holds merge as before.
const GIRL_GROUND: readonly Activity[] = [
  act('stand', one('stand0'), [6000, 16000], 3, 0, { capMs: 16000, repeatable: true, when: ['girlGround'] }),
  act('sway', c('stand0 stand1', 1000 / WORLD_ERA_ENV.girlSwayMs), [6000, 18000], 2, 0, { capMs: 45000, when: ['girlGround'] }),
  act('lanternUp', one('lanternUp'), [4000, 10000], 1.5, 30000, { capMs: 16000, when: ['girlGround'] }),
  act('tilt', one('tilt'), [3000, 8000], 1, 30000, { capMs: 16000, when: ['girlGround'] }),
];
// The palm on the ground (era III, vents): a reaction to ventPuff, weight 0.
const GIRL_PALM: Activity = act('palm', one('palm'), [6000, 15000], 0, 45000, { reaction: ['ventPuff'], when: ['girlGround', 'vents'], interruptible: false });
// The girl as a mini (eras II-III): the lantern gutters cold (never the warm frame), and dims at its alpha. The palm reacts to ventPuff.
// WP28b: the girl keeps the pre-WP28b hold cap (45 s, capMs); the roaming cap (10 s) would cut her merged holds to one length (V2 repeats).
const GIRL_MINI: readonly Activity[] = [
  act('flicker', c('cold cold', 1, { frameHoldMs: [1000, 2000], frameAlpha: [1, 0.8] }), [10000, 30000], 2, 0,
    { capMs: 45000, repeatable: true, when: ['girlMini'] }),
  act('dim', c('cold', 1, { alpha: 0.55 }), [5000, 15000], 1, 40000, { capMs: 45000, when: ['girlMini'] }),
];
const GIRL_MINI_PALM: Activity = act('palmMini', one('palm'), [6000, 15000], 0, 45000, { reaction: ['ventPuff'], when: ['girlMini', 'vents'], interruptible: false });

// WP28b reactions and gathering. A reaction names its cue in `reaction` and starts after the cue's band (WORLD_REACT.staggerMs): weight 0,
// not interruptible, no cooldown. A visit is a free activity (weight 2, 40 s cooldown) that also answers the splice cue, and walks to the
// Director's visit spot. The eras I-III frames are the profile cells (restFlip mirrors them); era V keeps the same ids with stare-safe frames.
// The travel kinds: inner (the innermost spot on the actor's side), visit (ctx.visitSpot), find (outward toward the Find). Era IV has none.
const reactAct = (id: string, clip: Clip, holdMs: readonly [number, number], reaction: readonly CueId[],
  extra: Partial<Activity> = {}): Activity => ({ id, clip, holdMs, weight: 0, cooldownMs: 0, reaction, interruptible: false, ...extra });
const visitAct = (id: string, clip: Clip, holdMs: readonly [number, number]): Activity => ({
  id, clip, holdMs, weight: 2, cooldownMs: 40000, reaction: ['splice'], travel: 'visit', when: ['visits'], interruptible: true,
});
// The Inspector: startle (fault, bigBuy), the write tick (faultClear), point (a Find on his outer side), lookFind (one on the inner side),
// the era front walk to the inner spot, and the visit (the Splice).
const INS_REACT: readonly Activity[] = [
  // AD4 F42: the startle holds 1.8-2.0 s, since its 2-frame clip at 1 fps wraps above 2 s; capMs 2000 keeps the start gate (guardHold) from stretching it past that.
  reactAct('startle', c('startle lookUp', 1), [1800, 2000], ['fault', 'bigBuy'], { capMs: 2000 }),
  reactAct('writeTick', c('write0 write1', 2), [1500, 2000], ['faultClear']),
  reactAct('point', one('point'), [2000, 4000], ['find'], { when: ['findOuter'] }),
  reactAct('lookFind', one('lookUp'), [1500, 2500], ['find'], { when: ['findInner'] }),
  reactAct('eraFront', one('front'), [4000, 6000], ['era'], { travel: 'inner' }),
  visitAct('visitWrite', c('write0 write1', 2), [4000, 8000]),
];
const INS_REACT_V: readonly Activity[] = [
  reactAct('startle', c('front talk', 1), [1800, 2000], ['fault', 'bigBuy'], { capMs: 2000 }),
  reactAct('writeTick', c('talk front', 2), [1500, 2000], ['faultClear']),
  reactAct('point', one('front'), [2000, 4000], ['find'], { when: ['findOuter'] }),
  reactAct('lookFind', one('front'), [1500, 2500], ['find'], { when: ['findInner'] }),
  reactAct('eraFront', one('front'), [4000, 6000], ['era'], { travel: 'inner' }),
  visitAct('visitWrite', c('front talk', 1), [4000, 8000]),
];
// The dog: bark (fault), sniffFind (walks outward toward a Find on its outer side), sniffHere (one on the inner side), eraHead (walks to the
// inner spot), visitSniff (the Splice), lookBig (bigBuy; era V answers it with lookBigV). WP28b AD4 F31: lookUp no longer answers bigBuy.
const DOG_REACT: readonly Activity[] = [
  reactAct('bark', c('bark0 bark1', 6), [1500, 1500], ['fault']),
  reactAct('sniffFind', c('sniff0 sniff1', 3), [2500, 3500], ['find'], { travel: 'find', when: ['findOuter'] }),
  reactAct('sniffHere', c('sniff0 sniff1', 3), [2500, 3500], ['find'], { when: ['findInner'] }),
  reactAct('eraHead', one('head'), [4000, 6000], ['era'], { travel: 'inner' }),
  reactAct('lookBig', one('lookUp'), [1500, 2500], ['bigBuy']),
  visitAct('visitSniff', c('sniff0 sniff1', 2), [3000, 6000]),
];
// WP28b reaction gaps: the era V wag is the stare-safe copy of the wag (head and talk frames only, the stare set of the dog).
const DOG_REACT_V: readonly Activity[] = [
  reactAct('bark', c('talk head', 4), [1500, 1500], ['fault']),
  reactAct('sniffFind', c('head talk', 1), [2500, 3500], ['find'], { travel: 'find', when: ['findOuter'] }),
  reactAct('sniffHere', c('head talk', 1), [2500, 3500], ['find'], { when: ['findInner'] }),
  reactAct('eraHead', one('head'), [4000, 6000], ['era'], { travel: 'inner' }),
  reactAct('lookBigV', one('head'), [1500, 2500], ['bigBuy']),
  reactAct('wag', c('head talk', 2), [2000, 4000], ['faultClear']),
  visitAct('visitSniff', c('head talk', 1), [3000, 6000]),
];
// The crow's free hop (C3, WP28b): weight 1.2, 20 s cooldown, only while the Director raises hopOk (never in era IV). The Director runs the
// arc on its rising edge. The era V copy plays its frames in reverse, like the poke hop.
const CROW_HOP_FREE: Activity = act('hopFree', c('fly0 fly1 fly2', 12), [600, 600], 1.2, 20000, { when: ['hopOk'] });
// The crow: ruffleReact (fault, bigBuy, rapid), glanceDown (a Find), eraPerchHead (the era card, on the lamp top).
// WP28b reaction gaps: settle (faultClear) sits back on the perch with the folded-wing frame; era V settles on the stare-safe head frame.
const CROW_REACT: readonly Activity[] = [
  reactAct('ruffleReact', one('ruffle'), [1200, 2000], ['fault', 'bigBuy', 'rapid']),
  reactAct('glanceDown', c('perchTurn perch0', 1), [1500, 2500], ['find']),
  reactAct('eraPerchHead', one('perchHead'), [3000, 5000], ['era']),
  reactAct('settle', one('perch0'), [1500, 2500], ['faultClear']),
  CROW_HOP_FREE,
];
const CROW_REACT_V: readonly Activity[] = [
  reactAct('ruffleReact', c('head talk', 2), [1200, 2000], ['fault', 'bigBuy', 'rapid']),
  reactAct('glanceDown', one('head'), [1500, 2500], ['find']),
  reactAct('eraPerchHead', one('head'), [3000, 5000], ['era']),
  reactAct('settle', one('head'), [1500, 2500], ['faultClear']),
  { ...CROW_HOP_FREE, reversed: true },
];

// Activities per actor and era. Era IV has no entry: the conductor (WORLD_UNISON) runs the cast.
export const WORLD_REPERTOIRE: Record<BehaviourActor, Partial<Record<1 | 2 | 3 | 4 | 5, readonly Activity[]>>> = {
  inspector: {
    1: [...INS_ROUNDS_I, INS_MICRO_GLANCE, POKE_LEAVE_INS, ...INS_REACT], 2: [...INS_ROUNDS, INS_MICRO_GLANCE, POKE_LEAVE_INS, ...INS_REACT],
    3: [...INS_ROUNDS_III, ...INS_UMBRELLA, INS_MICRO_GLANCE, POKE_LEAVE_INS, ...INS_REACT],
    5: [...INS_V, INS_MICRO_TALK, ...INS_REACT_V],
  },
  dog: {
    1: [...DOG_ROUNDS_I, DOG_WAG, DOG_MICRO_SCRATCH, POKE_LEAVE_DOG, ...DOG_REACT],
    2: [...DOG_ROUNDS, DOG_DIG, DOG_WAG, DOG_MICRO_SCRATCH, POKE_LEAVE_DOG, ...DOG_REACT],
    3: [...DOG_ROUNDS_III, DOG_WAG, DOG_SHAKE, DOG_MICRO_SCRATCH, POKE_LEAVE_DOG, ...DOG_REACT],
    5: [...DOG_V, DOG_MICRO_TALK, ...DOG_REACT_V],
  },
  crow: {
    1: [...CROW_I, CROW_MICRO_PECK, POKE_HOP, ...CROW_REACT], 2: [...CROW_II, CROW_MICRO_PECK, POKE_HOP, ...CROW_REACT],
    3: [...CROW_III, CROW_MICRO_PECK, POKE_HOP, ...CROW_REACT],
    5: [...CROW_V, CROW_MICRO_CAW, POKE_HOP_V, ...CROW_REACT_V],
  },
  girl: { 1: [...GIRL_MINI, ...GIRL_GROUND], 2: [...GIRL_MINI, ...GIRL_GROUND], 3: [...GIRL_MINI, GIRL_MINI_PALM, ...GIRL_GROUND, GIRL_PALM], 5: GIRL_GROUND },
};

// Era IV unison (one shared conductor, switches on downbeats only). pre runs before the stare (era IV), post after the observer.
// WP28b B-T1c1: beats 1-4 (2.4 s each). No switch lasts more than 4 beats (9.6 s), which keeps the B1 action gap; the spread of beats keeps
// the 4-run repeats (V2) down. The POST stare is 2-4 beats and counts in the gap (the era IV hold stays exempt, as it has since WP24).
const PRE_ACTIONS: readonly UnisonAction[] = [
  { id: 'still', beats: [1, 4], weight: 3 }, { id: 'sway', beats: [3, 4], weight: 2 }, { id: 'look', beats: [1, 4], weight: 1.5 },
  { id: 'mouth', beats: [1, 4], weight: 1.5 }, { id: 'hold', beats: [1, 4], weight: 1 }, { id: 'rise', beats: [1, 4], weight: 1.5 },
];
const POST_ACTIONS: readonly UnisonAction[] = [
  { id: 'stare', beats: [2, 4], weight: 3 }, { id: 'beat', beats: [1, 4], weight: 2 }, { id: 'mouth', beats: [1, 4], weight: 1.5 },
  { id: 'hold', beats: [1, 4], weight: 1 }, { id: 'rise', beats: [1, 4], weight: 1.5 },
];
const U = (frames: string, fps: number, extra: Partial<UnisonClip> = {}): UnisonClip => ({ frames: frames.split(' '), fps, loop: true, ...extra });
const U1 = (f: string, extra: Partial<UnisonClip> = {}): UnisonClip => U(f, 1, extra);
const RISE = WORLD_ERA_ENV.riseWorldPx;

export const WORLD_UNISON: {
  pre: readonly UnisonAction[];
  post: readonly UnisonAction[];
  map: { pre: Record<BehaviourActor, Partial<Record<UnisonId, UnisonClip>>>; post: Record<BehaviourActor, Partial<Record<UnisonId, UnisonClip>>> };
  staticIds: readonly UnisonId[];
} = {
  pre: PRE_ACTIONS,
  post: POST_ACTIONS,
  map: {
    pre: {
      inspector: {
        still: U('idleA idleB', 2, { accent: 'write0' }), sway: U('idleA idleB', 1, { perBeat: true, walkFirst: true }), look: U1('lookUp'),
        mouth: U1('idleA', { accent: 'talk' }), hold: U1('idleA'), rise: U('idleA idleB', 2, { risePx: RISE }),
      },
      dog: {
        still: U1('sit0', { accent: 'wag' }), sway: U('sit0 sit1', 1, { perBeat: true }), look: U1('lookUp'),
        mouth: U1('sit0', { accent: 'talk' }), hold: U1('sit0'), rise: U('sit0 sit1', 1, { risePx: RISE }),
      },
      // Before the observer the crow turns its head with folded wings (AD2 round 2 F9); the spread-wing head / talk frames stay for the stare (post).
      crow: {
        still: U1('perch0', { pulse: true }), sway: U('perch0 perch1', 1, { perBeat: true }), look: U1('perchHead'),
        mouth: U1('perch0', { accent: 'perchTalk' }), hold: U1('perch0'), rise: U1('perch0', { risePx: RISE }),
      },
      girl: {
        still: U('stand0 stand1', 1, { perBeat: true }), sway: U('stand0 tilt', 1, { perBeat: true }), look: U1('lanternUp'),
        mouth: U1('stand0', { accent: 'talk' }), hold: U1('stand0'), rise: U1('stand0', { risePx: RISE }),
      },
    },
    post: {
      inspector: {
        stare: U1('front'), beat: U1('front', { pulse: true, walkFirst: true }), mouth: U1('front', { accent: 'talk' }), hold: U1('front'),
        rise: U1('front', { risePx: RISE }),
      },
      dog: {
        stare: U1('head'), beat: U1('head', { pulse: true }), mouth: U1('head', { accent: 'talk' }), hold: U1('head'), rise: U1('head', { risePx: RISE }),
      },
      crow: {
        stare: U1('head'), beat: U1('head', { pulse: true }), mouth: U1('head', { accent: 'talk' }), hold: U1('head'), rise: U1('head', { risePx: RISE }),
      },
      girl: {
        stare: U('stand0 stand1', 1, { perBeat: true }), beat: U1('stand0', { pulse: true }), mouth: U1('stand0', { accent: 'talk' }),
        hold: U1('stand0'), rise: U1('stand0', { risePx: RISE }),
      },
    },
  },
  staticIds: ['look', 'hold', 'stare'],
};

// Living world behaviour data (WP24 T1): the cast's activities per era (repertoires), the era IV unison actions, the spots the
// Inspector and the dog walk between, the walk and reaction rules, and the behaviour constants (seed, salts, caps, log size).
// Why: the scheduler (src/game/math/worldBehaviour.ts) and the renderers read one copy of every frame name, cue and number.
// Pure data: no Phaser. Hold, weight and cooldown values are tuned here (the Art Director, T3d); code never repeats them.
// Structure and canon (frames exist in their sheets, the stare-safe and pre-finale rules) are pinned in worldBehaviour.test.ts.
import type { FramingKey } from './livingWorld';
import { WORLD_ERA_ENV } from './worldEras';

export type BehaviourActor = 'inspector' | 'dog' | 'crow' | 'girl';
export type SpotId = 'sensor' | 'mid' | 'scrap' | 'stake' | 'home' | 'out';
export type CueId = 'atSensor' | 'digBout' | 'crowMove' | 'ring' | 'ventPuff' | 'rapid' | 'crankClick' | 'gust';
export type BehaviourCond = 'vents' | 'stareOff' | 'stareOn' | 'holeDig' | 'sensor' | 'scraps' | 'girlMini' | 'girlGround' | 'notReduced'
  | 'notDemoHold';
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
  travel?: 'spot' | 'sensor' | 'scrap' | 'home' | 'stake' | 'notStake' | 'outer';
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
export const WORLD_REACT: {
  chance: number;
  pairCooldownMs: number;
  latencyMs: Record<BehaviourActor, readonly [number, number]>;
  routes: Record<CueId, readonly string[]>;
  producers: Record<CueId, 'activity' | 'director' | 'world'>;
} = {
  chance: 0.5,
  pairCooldownMs: 30000,
  latencyMs: { inspector: [200, 500], dog: [650, 950], girl: [1100, 1400], crow: [1550, 1850] },
  routes: {
    atSensor: ['sensor.doubleBlink'], digBout: ['props.holeStep'], crowMove: ['dog.lookUp'], ring: ['dog.wake', 'dog.lookUp', 'dog.wag'],
    ventPuff: ['inspector.umbrella', 'dog.shake', 'girl.palm', 'props.fogBuild', 'props.puddleRing'], rapid: ['dog.wake'],
    crankClick: ['crow.tipTry'], gust: ['crow.tipTry'],
  },
  producers: {
    atSensor: 'activity', digBout: 'activity', crowMove: 'activity', ring: 'director', ventPuff: 'world', rapid: 'director',
    crankClick: 'director', gust: 'world',
  },
};

// Scheduler constants. seed + cycleSalt x cycle + actorSalt[actor] seeds each runner; k0Stride offsets a session's activity count by
// active minutes; recency2Back is the weight of an activity used two picks ago; capMs are the hold caps (static runs are shorter).
// minHoldMs, crankHoldMsPerClick, advanceStepMs and logSize are the runner clock and log ring; salts keep the hash streams apart.
// ringEveryMs is the gap between two ring cues (the dog's sleep and lookUp answer them), drawn by hash from era II on (salts.ring).
// cadenceMaxStepMs caps the dt one heavy frame steps the clocks and runners by (the excess is dropped). It stays below the walk tick
// period (WORLD_PLAYBACK fps8, 125 ms), so a walk draws at most one 8 px frame per step (V6) even at 15 fps.
export const WORLD_BEHAVIOUR = {
  seed: 24101, cycleSalt: 7919, actorSalt: { inspector: 11, dog: 23, crow: 37, girl: 53 },
  k0Stride: 97, recency2Back: 0.4, mergeJitter: [0.5, 1], capMs: { hold: 45000, staticEarly: 16000, staticV: 22000 },
  minHoldMs: 500, crankHoldMsPerClick: 500, advanceStepMs: 250, logSize: 1024, unisonJoinBeats: 3, ringEveryMs: [300000, 480000],
  cadenceMaxStepMs: 120,
  salts: { merge: 97, spot: 31, react: 211, latency: 223, conductor: 7, start: 999, ring: 409 },
} as const;

// Spots (dx from the actor's placement x, per framing). The Inspector list of a framing is trimmed to the spots actorBand accepts.
const INS_SPOTS: readonly { id: SpotId; dx: number }[] = [{ id: 'sensor', dx: -24 }, { id: 'mid', dx: 0 }, { id: 'scrap', dx: 24 }];
const DOG_SPOTS: readonly { id: SpotId; dx: number }[] = [{ id: 'stake', dx: -24 }, { id: 'home', dx: 0 }, { id: 'out', dx: 24 }];
// WP27 F6.2: one Inspector spot (dx 0) where Sensor 7 stands beside him (s8, s8w, s10). The outer spots would walk him into the
// tripod or the far-plane mini, so he keeps his placement: reading and crouch run in place and still emit atSensor.
const INS_SENSOR_SPOT: readonly { id: SpotId; dx: number }[] = [{ id: 'sensor', dx: 0 }];
export const WORLD_SPOTS: Partial<Record<FramingKey, Partial<Record<'inspector' | 'dog', readonly { id: SpotId; dx: number }[]>>>> = {
  e1: { inspector: INS_SPOTS, dog: DOG_SPOTS },
  s8: { inspector: INS_SENSOR_SPOT, dog: DOG_SPOTS },
  s8w: { inspector: INS_SENSOR_SPOT, dog: DOG_SPOTS },
  s9: { inspector: INS_SPOTS, dog: DOG_SPOTS },
  s10: { inspector: INS_SENSOR_SPOT, dog: DOG_SPOTS },
  s11: { inspector: INS_SPOTS, dog: DOG_SPOTS },
  s15: { inspector: INS_SPOTS, dog: DOG_SPOTS },
};

// Clip helpers: c for a looped clip with extras, one for a single still frame.
const c = (frames: readonly string[], fps: number, extra: Partial<Clip> = {}): Clip => ({ frames, fps, loop: true, ...extra });
const one = (f: string): Clip => c([f], 1);

// The Inspector's rounds (eras I-III). Frames: idle and write are the walk-free poses; reading walks to the sensor and emits atSensor.
const INS_ROUNDS: readonly Activity[] = [
  { id: 'stand', clip: c(['idleA', 'idleB'], 2), holdMs: [4000, 12000], weight: 3, cooldownMs: 0, repeatable: true, interruptible: true },
  { id: 'stroll', clip: c(['idleA', 'idleB'], 2), holdMs: [2000, 6000], weight: 2, cooldownMs: 20000, travel: 'spot', interruptible: true },
  { id: 'write', clip: c(['write0', 'write1'], 2), holdMs: [6000, 18000], weight: 3, cooldownMs: 15000, interruptible: true },
  { id: 'reading', clip: c(['write0', 'write1'], 2), holdMs: [8000, 16000], weight: 2, cooldownMs: 60000, travel: 'sensor', when: ['sensor'],
    emits: 'atSensor', emitsAt: 'start', interruptible: true },
  { id: 'watch', clip: one('watch'), holdMs: [2000, 4000], weight: 1, cooldownMs: 45000, follow: { write: 1.5 }, interruptible: true },
  { id: 'lookUp', clip: one('lookUp'), holdMs: [4000, 10000], weight: 2, cooldownMs: 30000, interruptible: true },
  { id: 'crouch', clip: one('crouch'), holdMs: [5000, 12000], weight: 1.5, cooldownMs: 45000, travel: 'sensor', when: ['scraps'], interruptible: true },
];
// The umbrella (era III, vents): a reaction to ventPuff. The clip holds the first and last frame for edgeMs; poseSet switches the base pose.
const INS_UMBRELLA: readonly Activity[] = [
  { id: 'umbrella', clip: c(['umbrellaHalf', 'umbrellaOpen', 'umbrellaHalf'], 2, { loop: false, edgeMs: 500 }), holdMs: [9000, 17000], weight: 0,
    cooldownMs: 45000, reaction: ['ventPuff'], when: ['vents'], poseSet: 'umbrella', interruptible: false },
];
// The Inspector in era V (the stare): the front pose only, a reversed backstep and a sensor walk. Every frame is stare-safe.
const INS_V: readonly Activity[] = [
  { id: 'stand', clip: one('front'), holdMs: [6000, 18000], weight: 3, cooldownMs: 0, repeatable: true, interruptible: true },
  { id: 'backstep', clip: one('front'), holdMs: [3000, 8000], weight: 2, cooldownMs: 12000, travel: 'spot', reversed: true, interruptible: true },
  { id: 'mouth', clip: c(['talk', 'front'], 1), holdMs: [3000, 6000], weight: 1.5, cooldownMs: 15000, interruptible: true },
  { id: 'withSensor', clip: c(['front', 'talk'], 1, { frameHoldMs: [1500, 2800] }), holdMs: [8000, 16000], weight: 1.5, cooldownMs: 30000,
    travel: 'sensor', reversed: true, when: ['sensor'], emits: 'atSensor', emitsAt: 'start', interruptible: true },
];

// The dog's rounds (eras I-III). Sniff and pace are the walks of the dog; sleep holds until a ring or a rapid click wakes it.
const DOG_ROUNDS: readonly Activity[] = [
  { id: 'sit', clip: c(['sit0', 'sit1'], 1), holdMs: [6000, 20000], weight: 3, cooldownMs: 0, repeatable: true, interruptible: true },
  { id: 'sniff', clip: c(['sniff0', 'sniff1'], 2), holdMs: [3000, 8000], weight: 2, cooldownMs: 10000, interruptible: true },
  { id: 'pace', clip: c(['sit0', 'sit1'], 1), holdMs: [2000, 6000], weight: 1.5, cooldownMs: 25000, travel: 'spot', interruptible: true },
  { id: 'scratch', clip: c(['scratch0', 'scratch1'], 6), holdMs: [1500, 3000], weight: 1, cooldownMs: 45000, interruptible: true },
  { id: 'lookUp', clip: one('lookUp'), holdMs: [3000, 8000], weight: 1, cooldownMs: 30000, reaction: ['crowMove', 'ring'], interruptible: true },
  { id: 'sleep', clip: one('sleep'), holdMs: [10000, 18000], weight: 1, cooldownMs: 120000, wakeOn: ['ring', 'rapid'], interruptible: true },
];
// The dig (era II, after the load-beneath log): walks home, then animated bursts between still sniff listens; each bout emits digBout.
const DOG_DIG: Activity = {
  id: 'dig', clip: c(['dig0', 'dig1'], 4, { burst: { onMs: [1500, 4000], restFrame: 'sniff0', restMs: [1000, 2000] } }), holdMs: [6000, 15000],
  weight: 4, cooldownMs: 20000, travel: 'home', when: ['holeDig'], emits: 'digBout', emitsAt: 'end', interruptible: true,
};
// The wag (eras II-III): a reaction to ring, weight 0.
const DOG_WAG: Activity = { id: 'wag', clip: c(['sit0', 'wag'], 2), holdMs: [2000, 4000], weight: 0, cooldownMs: 60000, reaction: ['ring'], interruptible: false };
// The shake (era III, vents): a reaction to ventPuff, weight 0.
const DOG_SHAKE: Activity = {
  id: 'shake', clip: c(['shake0', 'shake1'], 6), holdMs: [1000, 2000], weight: 0, cooldownMs: 20000, reaction: ['ventPuff'], when: ['vents'],
  interruptible: false,
};
// The dog in era V (the stare): head frames and talk, reversed walks that keep the dog between its stake and the rest of the yard.
const DOG_V: readonly Activity[] = [
  { id: 'sit', clip: one('head'), holdMs: [8000, 20000], weight: 2, cooldownMs: 0, repeatable: true, interruptible: true },
  { id: 'wander', clip: one('head'), holdMs: [3000, 8000], weight: 1.5, cooldownMs: 15000, travel: 'notStake', reversed: true, interruptible: true },
  { id: 'backToStake', clip: c(['head', 'talk'], 1), holdMs: [3000, 8000], weight: 2, cooldownMs: 15000, travel: 'stake', reversed: true,
    interruptible: true },
  { id: 'mouth', clip: c(['talk', 'head'], 1), holdMs: [2000, 4000], weight: 1.5, cooldownMs: 15000, interruptible: true },
];

// The crow in eras I-II (WP27 D5): perched, wings folded; the spread-wing freeze is a rare glitch of at most 1.8 s (tipTry, the old story beat).
const crowPerched = (bob: readonly [number, number]): readonly Activity[] => [
  { id: 'perch', clip: c(['perch0', 'perch1'], 1, { frameHoldMs: bob }), holdMs: [6000, 16000], weight: 3, cooldownMs: 0, repeatable: true, interruptible: true },
  { id: 'look', clip: c(['perchTurn', 'perch0'], 1, { frameHoldMs: [800, 2000] }), holdMs: [2000, 5000], weight: 2, cooldownMs: 15000, interruptible: true },
  { id: 'peck', clip: c(['peck0', 'peck1'], 3), holdMs: [1500, 3500], weight: 1.5, cooldownMs: 25000, emits: 'crowMove', emitsAt: 'start', interruptible: true },
  { id: 'ruffle', clip: one('ruffle'), holdMs: [1200, 2200], weight: 1, cooldownMs: 30000, emits: 'crowMove', emitsAt: 'start', interruptible: true },
];
const CROW_GLITCH: Activity = { id: 'tipTry', clip: c(['frozenTip', 'frozen'], 2, { frameHoldMs: [300, 700] }), holdMs: [800, 1800], weight: 0.3,
  cooldownMs: 60000, reaction: ['crankClick', 'gust'], interruptible: true, glitch: true };
const CROW_I: readonly Activity[] = [
  ...crowPerched([1200, 3500]),
  { id: 'shift', clip: c(['perch0', 'perch0', 'perch0', 'perch0'], 1, { dxPx: [0, 2, 0, -2], frameHoldMs: [1000, 2500] }), holdMs: [2000, 5000],
    weight: 1, cooldownMs: 30000, interruptible: true },
  CROW_GLITCH,
];
const CROW_II: readonly Activity[] = [
  ...crowPerched([800, 3000]),
  { id: 'stutter', clip: c(['perch0', 'perch0'], 1, { dxPx: [0, 4], frameHoldMs: [500, 2500] }), holdMs: [3000, 8000], weight: 1.5, cooldownMs: 20000, interruptible: true },
  { id: 'skip', clip: c(['perch0', 'perch1'], 1, { dxPx: [0, 4], frameHoldMs: [150, 350] }), holdMs: [1000, 2500], weight: 0.7, cooldownMs: 30000, interruptible: true },
  { ...CROW_GLITCH, weight: 0.4, clip: c(['frozenTip', 'frozen'], 2, { frameHoldMs: [250, 600] }) },
];
// The crow in era III: perch, the ruffle and the peck (each emits crowMove at its start), and a 2 px shift on the perch.
const CROW_III: readonly Activity[] = [
  { id: 'perch', clip: c(['perch0', 'perch1'], 1), holdMs: [6000, 20000], weight: 3, cooldownMs: 0, repeatable: true, interruptible: true },
  { id: 'ruffle', clip: one('ruffle'), holdMs: [1500, 2500], weight: 1.5, cooldownMs: 30000, emits: 'crowMove', emitsAt: 'start', interruptible: true },
  { id: 'peck', clip: c(['peck0', 'peck1'], 3), holdMs: [2000, 4000], weight: 1, cooldownMs: 45000, emits: 'crowMove', emitsAt: 'start', interruptible: true },
  { id: 'shift', clip: c(['perch0', 'perch0', 'perch0', 'perch0'], 1, { dxPx: [0, 2, 0, -2], frameHoldMs: [1000, 2500] }), holdMs: [2000, 5000],
    weight: 1, cooldownMs: 30000, interruptible: true },
];
// The crow in era V (the stare): the 4 px stutter on the head frame, a still head and a caw (talk, then head; no sound).
const CROW_V: readonly Activity[] = [
  { id: 'stutterV', clip: c(['head', 'head'], 1, { dxPx: [0, 4], frameHoldMs: [500, 2500] }), holdMs: [8000, 20000], weight: 2, cooldownMs: 0,
    repeatable: true, interruptible: true },
  { id: 'stillV', clip: one('head'), holdMs: [10000, 22000], weight: 2, cooldownMs: 0, interruptible: true },
  { id: 'caw', clip: c(['talk', 'head'], 1), holdMs: [2000, 3000], weight: 1, cooldownMs: 30000, interruptible: true },
];

// Poke-only activities (WP28a T15a): weight 0, never picked, never cued; BehaviourRunner.interrupt starts them as a reaction after a level-3
// poke. The Inspector and the dog walk to the outer spot (the leave) and stay there, facing away. Era V has no walking leave: its level 3 plays
// in place (the poke tables leave null), so no era V leave row exists. The crow hops to another perch: the three fly frames, one wing, the arc
// drawn by LivingWorld (C3). Era IV has none (the conductor plays the cast).
const POKE_LEAVE_INS: Activity = {
  id: 'leaveWrite', clip: c(['write0', 'write1'], 2), holdMs: [6000, 9000], weight: 0, cooldownMs: 0, travel: 'outer', poke: true,
  interruptible: false,
};
const POKE_LEAVE_DOG: Activity = {
  id: 'leaveSit', clip: one('sit0'), holdMs: [8000, 12000], weight: 0, cooldownMs: 0, travel: 'outer', poke: true, interruptible: false,
};
const POKE_HOP: Activity = {
  id: 'hop', clip: c(['fly0', 'fly1', 'fly2'], 12), holdMs: [600, 600], weight: 0, cooldownMs: 0, poke: true, interruptible: false,
};
// The era V hop plays its frames in reverse (WP28 Pokes: era V reverses the hop).
const POKE_HOP_V: Activity = { ...POKE_HOP, reversed: true };

// The girl on the ground (eras I-III from cycle 3, the era IV conductor and era V). She never travels and never moves on screen.
const GIRL_GROUND: readonly Activity[] = [
  { id: 'stand', clip: one('stand0'), holdMs: [6000, 16000], weight: 3, cooldownMs: 0, repeatable: true, when: ['girlGround'], interruptible: true },
  { id: 'sway', clip: c(['stand0', 'stand1'], 1000 / WORLD_ERA_ENV.girlSwayMs), holdMs: [6000, 18000], weight: 2, cooldownMs: 0,
    when: ['girlGround'], interruptible: true },
  { id: 'lanternUp', clip: one('lanternUp'), holdMs: [4000, 10000], weight: 1.5, cooldownMs: 30000, when: ['girlGround'], interruptible: true },
  { id: 'tilt', clip: one('tilt'), holdMs: [3000, 8000], weight: 1, cooldownMs: 30000, when: ['girlGround'], interruptible: true },
];
// The palm on the ground (era III, vents): a reaction to ventPuff, weight 0.
const GIRL_PALM: Activity = {
  id: 'palm', clip: one('palm'), holdMs: [6000, 15000], weight: 0, cooldownMs: 45000, reaction: ['ventPuff'], when: ['girlGround', 'vents'],
  interruptible: false,
};
// The girl as a mini (eras II-III): the lantern gutters cold (never the warm frame), and dims at its alpha. The palm reacts to ventPuff.
const GIRL_MINI: readonly Activity[] = [
  { id: 'flicker', clip: c(['cold', 'cold'], 1, { frameHoldMs: [1000, 2000], frameAlpha: [1, 0.8] }), holdMs: [10000, 30000], weight: 2, cooldownMs: 0,
    repeatable: true, when: ['girlMini'], interruptible: true },
  { id: 'dim', clip: c(['cold'], 1, { alpha: 0.55 }), holdMs: [5000, 15000], weight: 1, cooldownMs: 40000, when: ['girlMini'], interruptible: true },
];
const GIRL_MINI_PALM: Activity = {
  id: 'palmMini', clip: one('palm'), holdMs: [6000, 15000], weight: 0, cooldownMs: 45000, reaction: ['ventPuff'], when: ['girlMini', 'vents'],
  interruptible: false,
};

// Activities per actor and era. Era IV has no entry: the conductor (WORLD_UNISON) runs the cast.
export const WORLD_REPERTOIRE: Record<BehaviourActor, Partial<Record<1 | 2 | 3 | 4 | 5, readonly Activity[]>>> = {
  inspector: {
    1: [...INS_ROUNDS, POKE_LEAVE_INS], 2: [...INS_ROUNDS, POKE_LEAVE_INS], 3: [...INS_ROUNDS, ...INS_UMBRELLA, POKE_LEAVE_INS],
    5: [...INS_V],
  },
  dog: {
    1: [...DOG_ROUNDS, POKE_LEAVE_DOG], 2: [...DOG_ROUNDS, DOG_DIG, DOG_WAG, POKE_LEAVE_DOG], 3: [...DOG_ROUNDS, DOG_WAG, DOG_SHAKE, POKE_LEAVE_DOG],
    5: [...DOG_V],
  },
  crow: { 1: [...CROW_I, POKE_HOP], 2: [...CROW_II, POKE_HOP], 3: [...CROW_III, POKE_HOP], 5: [...CROW_V, POKE_HOP_V] },
  girl: { 1: [...GIRL_MINI, ...GIRL_GROUND], 2: [...GIRL_MINI, ...GIRL_GROUND], 3: [...GIRL_MINI, GIRL_MINI_PALM, ...GIRL_GROUND, GIRL_PALM], 5: GIRL_GROUND },
};

// Era IV unison (one shared conductor, switches on downbeats only). pre runs before the stare (era IV), post after the observer.
const PRE_ACTIONS: readonly UnisonAction[] = [
  { id: 'still', beats: [3, 8], weight: 3 }, { id: 'sway', beats: [3, 6], weight: 2 }, { id: 'look', beats: [3, 5], weight: 1.5 },
  { id: 'mouth', beats: [2, 4], weight: 1.5 }, { id: 'hold', beats: [2, 3], weight: 1 }, { id: 'rise', beats: [3, 5], weight: 1.5 },
];
const POST_ACTIONS: readonly UnisonAction[] = [
  { id: 'stare', beats: [3, 6], weight: 3 }, { id: 'beat', beats: [3, 6], weight: 2 }, { id: 'mouth', beats: [2, 4], weight: 1.5 },
  { id: 'hold', beats: [2, 3], weight: 1 }, { id: 'rise', beats: [3, 5], weight: 1.5 },
];
const U = (frames: readonly string[], fps: number, extra: Partial<UnisonClip> = {}): UnisonClip => ({ frames, fps, loop: true, ...extra });
const U1 = (f: string, extra: Partial<UnisonClip> = {}): UnisonClip => U([f], 1, extra);
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
        still: U(['idleA', 'idleB'], 2, { accent: 'write0' }), sway: U(['idleA', 'idleB'], 1, { perBeat: true, walkFirst: true }), look: U1('lookUp'),
        mouth: U1('idleA', { accent: 'talk' }), hold: U1('idleA'), rise: U(['idleA', 'idleB'], 2, { risePx: RISE }),
      },
      dog: {
        still: U1('sit0', { accent: 'wag' }), sway: U(['sit0', 'sit1'], 1, { perBeat: true }), look: U1('lookUp'),
        mouth: U1('sit0', { accent: 'talk' }), hold: U1('sit0'), rise: U(['sit0', 'sit1'], 1, { risePx: RISE }),
      },
      // Before the observer the crow turns its head with folded wings (AD2 round 2 F9); the spread-wing head / talk frames stay for the stare (post).
      crow: {
        still: U1('perch0', { pulse: true }), sway: U(['perch0', 'perch1'], 1, { perBeat: true }), look: U1('perchHead'),
        mouth: U1('perch0', { accent: 'perchTalk' }), hold: U1('perch0'), rise: U1('perch0', { risePx: RISE }),
      },
      girl: {
        still: U(['stand0', 'stand1'], 1, { perBeat: true }), sway: U(['stand0', 'tilt'], 1, { perBeat: true }), look: U1('lanternUp'),
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
        stare: U(['stand0', 'stand1'], 1, { perBeat: true }), beat: U1('stand0', { pulse: true }), mouth: U1('stand0', { accent: 'talk' }),
        hold: U1('stand0'), rise: U1('stand0', { risePx: RISE }),
      },
    },
  },
  staticIds: ['look', 'hold', 'stare'],
};

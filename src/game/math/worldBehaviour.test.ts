// Tests for the behaviour scheduler (WP24 T3a): the hash and seed helpers, the draw index start (k0), the stare map, looks (key, first,
// last, static), visible change gaps, caps, hold clips, the 'when' conditions and the eligible lists, the pick rule over the real
// repertoire (no A to A except a merge, no walk after a walk, cooldowns, travel filters, hold and static run caps, the crow's frozen
// cap), the fallback chain with small pools, the spot travel (walk time, previous spot damp), startSeg, the follow and recency odds,
// and determinism. Pure maths, fixed seeds. Structure and canon only: the numbers come from the data and are never pinned here. The timed runner (T3b): dt invariance, A to A, the per-step walk and facing rules, pause, rehome, pins, parking, clip frame timing, emits, the seam and reduced motion. T3c: cues and reactions (bands, chance, pair cooldown, walks, wakes), crank mode, the era change, the unison conductor, and the era IV runner path (join, accents, rises, perBeat, downbeats, the stare, walks, leaving).
import { describe, it, expect } from 'vitest';
import {
  activityLook, behaviourK0, behaviourSeed, capOf, condHolds, createBehaviourRunner, createUnisonConductor, eligible, frameHoldIndex,
  frameHoldWalk, hash01, holdClip, cycleSeedOf, newHoldWalk, newMemory, pickNext, restFlip, startSeg, stareFrame, visibleChangeMs,
  walkFrameOf,
} from './worldBehaviour';
import type {
  BehaviourCtx, BehaviourFrame, BehaviourLogEntry, BehaviourRunner, Look, PickEnv, Seg, UnisonConductor,
} from './worldBehaviour';
import type { WorldEra } from './worldState';
import type { PlaybackMode } from './worldPlayback';
import { MACHINE_ANCHOR } from '../../data/world';
import { WORLD_FRAMES, WORLD_PLAYBACK } from '../../data/livingWorld';
import { TIER_HEARTBEAT } from '../../data/machineTiers';
import { WORLD_ERA_ENV } from '../../data/worldEras';
import {
  WORLD_BEHAVIOUR, WORLD_REACT, WORLD_REPERTOIRE, WORLD_STARE_SAFE, WORLD_UNISON, WORLD_WALK,
} from '../../data/worldBehaviour';
import type { Activity, BehaviourActor, BehaviourCond, Clip, CueId, UnisonId } from '../../data/worldBehaviour';

const ACTORS: readonly BehaviourActor[] = ['inspector', 'dog', 'crow', 'girl'];
const MS_PER_MIN = 60000;

// The spot lists of the framings (world x): the Inspector's sensor, mid and scrap 24 px apart; the dog's stake, home and out.
const INS3: PickEnv['spots'] = [{ id: 'sensor', x: 76 }, { id: 'mid', x: 100 }, { id: 'scrap', x: 124 }];
const DOG3: PickEnv['spots'] = [{ id: 'stake', x: 76 }, { id: 'home', x: 100 }, { id: 'out', x: 124 }];
const ONE: PickEnv['spots'] = [{ id: 'home', x: 100 }];

function ctxOf(over: Partial<BehaviourCtx> = {}): BehaviourCtx {
  return {
    era: 1, mode: 'fps4', crankSteps: 0, reduced: false, stare: false, reverse: false, vents: false, holeDig: false, sensor: true,
    scraps: true, demoHold: false, paused: false, homeX: 100, girlStage: 'window', spots: INS3, cues: [],
    beat: { downbeat: false, index: 0 }, ...over,
  };
}

// Synthetic activities: a two-frame clip changing every second (a dynamic hold clip), a one-frame static clip, a burst clip.
const clipOf = (frames: string[], fps: number, extra: Partial<Clip> = {}): Clip => ({ frames, fps, loop: true, ...extra });
function act(id: string, over: Partial<Activity> = {}): Activity {
  return { id, clip: clipOf(['a', 'b'], 1), holdMs: [1000, 2000], weight: 1, cooldownMs: 0, interruptible: true, ...over };
}
function staticAct(id: string, over: Partial<Activity> = {}): Activity {
  return act(id, { clip: clipOf(['s'], 1), ...over });
}
function burstAct(id: string, over: Partial<Activity> = {}): Activity {
  return act(id, { clip: clipOf(['a', 'b'], 4, { burst: { onMs: [1000, 2000], restFrame: 'r', restMs: [500, 800] } }), ...over });
}

// An env for the Inspector in era 1 (fps 4, the S7 mode) and helpers around it.
function envOf(actor: BehaviourActor, era: WorldEra, over: Partial<PickEnv> = {}): PickEnv {
  const spots = actor === 'inspector' ? INS3 : actor === 'dog' ? DOG3 : ONE;
  return { actor, era, stare: false, spots, fps: 4, ...over };
}
const INS_ENV: PickEnv = envOf('inspector', 1);

// One pick: the returned segment, and whether it merged into (extended) the current one.
interface Pick { seg: Seg; merged: boolean }
// Plays picks from a fresh memory until `count` picks or `minutes` of play. Each pick starts at the previous segment's end.
function playPicks(pool: readonly Activity[], env: PickEnv, seed: number,
  opts: { count?: number; minutes?: number; homeSpot?: number; k0?: number }): Pick[] {
  const mem = newMemory(seed, opts.k0 ?? 0, opts.homeSpot ?? 0);
  const out: Pick[] = [];
  let cur: Seg | null = null;
  let at = 0;
  for (;;) {
    if (opts.count !== undefined && out.length >= opts.count) break;
    if (opts.minutes !== undefined && at >= opts.minutes * MS_PER_MIN) break;
    const seg = pickNext(mem, cur, pool, env, at);
    out.push({ seg, merged: cur !== null && seg.startMs === cur.startMs });
    cur = seg;
    at = seg.endMs;
  }
  return out;
}

// The rules every pick obeys over the real repertoire: caps (hold, static run), walks, weights, no A to A except a merge, contiguity.
function expectRules(picks: readonly Pick[], env: PickEnv): void {
  const staticCap = env.era === 5 ? WORLD_BEHAVIOUR.capMs.staticV : WORLD_BEHAVIOUR.capMs.staticEarly;
  let prev: Seg | null = null;
  for (const { seg, merged } of picks) {
    expect(seg.def.weight).toBeGreaterThan(0);
    expect(seg.holdMs).toBeGreaterThan(0);
    expect(seg.holdMs).toBeLessThanOrEqual(capOf(seg.def, seg.look, env.era));
    if (seg.def.capMs === undefined && !seg.look.static) expect(seg.holdMs).toBeLessThanOrEqual(WORLD_BEHAVIOUR.capMs.hold);
    if (seg.look.static && seg.def.capMs === undefined) expect(seg.endMs - seg.runStartMs).toBeLessThanOrEqual(staticCap);
    expect(seg.walkMs).toBeLessThanOrEqual(WORLD_WALK.maxWalkMs);
    if (seg.def.travel === 'spot' && seg.walkMs > 0) {
      expect(Math.abs(seg.toX - seg.fromX)).toBeGreaterThanOrEqual(WORLD_WALK.minTravelPx);
    }
    if (merged) {
      expect(seg.def.repeatable === true || holdClip(seg.def, seg.look)).toBe(true);
    } else if (prev !== null) {
      expect(seg.id).not.toBe(prev.id);
      if (prev.walkMs > 0) expect(seg.walkMs).toBe(0);
      expect(seg.startMs).toBe(prev.endMs);
    }
    prev = seg;
  }
}

describe('hash01 and the seeds', () => {
  it('stays in [0, 1) and is deterministic', () => {
    for (let a = 0; a < 50; a++) {
      for (let b = 0; b < 50; b++) {
        const h = hash01(a, b);
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThan(1);
        expect(hash01(a, b)).toBe(h);
      }
    }
  });
  it('is the sine hash (fractional part of sin(a x 12.9898 + b x 78.233) x 43758.5453)', () => {
    const f = Math.sin(3 * 12.9898 + 4 * 78.233) * 43758.5453;
    expect(hash01(3, 4)).toBeCloseTo(f - Math.floor(f), 12);
  });
  it('spreads consecutive draws (no repeats in 40 draws)', () => {
    const seen = new Set<number>();
    for (let k = 0; k < 40; k++) seen.add(hash01(12345, 2 * k + 1));
    expect(seen.size).toBe(40);
  });
  it('seeds each actor and cycle with the salts of WORLD_BEHAVIOUR', () => {
    for (const actor of ACTORS) {
      for (const cycle of [1, 2, 3]) {
        expect(behaviourSeed(cycle, actor)).toBe(WORLD_BEHAVIOUR.seed + WORLD_BEHAVIOUR.cycleSalt * cycle + WORLD_BEHAVIOUR.actorSalt[actor]);
      }
    }
    const seeds = new Set<number>();
    for (const actor of ACTORS) for (const cycle of [1, 2, 3]) seeds.add(behaviourSeed(cycle, actor));
    expect(seeds.size).toBe(ACTORS.length * 3);
  });
  it('starts the draw index at whole active minutes times the stride', () => {
    const stride = WORLD_BEHAVIOUR.k0Stride;
    expect(behaviourK0(0)).toBe(0);
    expect(behaviourK0(59)).toBe(0);
    expect(behaviourK0(60)).toBe(stride);
    expect(behaviourK0(54000)).toBe(900 * stride);
    expect(behaviourK0(-5)).toBe(0);
    expect(behaviourK0(Number.NaN)).toBe(0);
  });
});

describe('stareFrame', () => {
  it('keeps the frame when the stare is off', () => {
    expect(stareFrame('inspector', 'idleA', false, false)).toBe('idleA');
    expect(stareFrame('dog', 'sit0', false, false)).toBe('sit0');
  });
  it('keeps the frame while walking (the walker turns in its own frames)', () => {
    expect(stareFrame('inspector', 'walk0', true, true)).toBe('walk0');
  });
  it('keeps every camera-facing frame of each actor under the stare', () => {
    for (const actor of ACTORS) {
      for (const f of WORLD_STARE_SAFE[actor]) expect(stareFrame(actor, f, false, true)).toBe(f);
    }
  });
  it('maps any other frame to the actor front (the first stare-safe entry)', () => {
    expect(stareFrame('inspector', 'idleA', false, true)).toBe('front');
    expect(stareFrame('dog', 'sit0', false, true)).toBe('head');
    expect(stareFrame('crow', 'frozen', false, true)).toBe('head');
    expect(stareFrame('girl', 'cold', false, true)).toBe('stand0');
  });
});

describe('activityLook', () => {
  it('keys a two-frame clip by its sorted frames, with first and last', () => {
    const look = activityLook('inspector', clipOf(['idleB', 'idleA'], 2), false);
    expect(look).toEqual({ key: 'idleA/idleB', first: 'idleB', last: 'idleA', static: false });
  });
  it('is static for one shown frame and no tag', () => {
    expect(activityLook('inspector', clipOf(['idleA'], 1), false).static).toBe(true);
  });
  it('draws one front under the stare for a two-frame idle (static on screen)', () => {
    const look = activityLook('inspector', clipOf(['idleA', 'idleB'], 2), true);
    expect(look).toEqual({ key: 'front', first: 'front', last: 'front', static: true });
  });
  it('keeps a camera-facing pair under the stare (talk then front)', () => {
    const look = activityLook('inspector', clipOf(['talk', 'front'], 1), true);
    expect(look).toEqual({ key: 'front/talk', first: 'talk', last: 'front', static: false });
  });
  it('tags a dx stutter (non-zero offset) and is never static', () => {
    const look = activityLook('crow', clipOf(['frozen', 'frozen'], 1, { dxPx: [0, 4] }), false);
    expect(look.key).toBe('frozen+dx');
    expect(look.static).toBe(false);
    expect(activityLook('crow', clipOf(['frozen', 'frozen'], 1, { dxPx: [0, 4] }), true).key).toBe('head+dx');
  });
  it('does not tag an all-zero dx', () => {
    const look = activityLook('crow', clipOf(['frozen'], 1, { dxPx: [0, 0] }), false);
    expect(look).toEqual({ key: 'frozen', first: 'frozen', last: 'frozen', static: true });
  });
  it('tags an alpha and a frame alpha', () => {
    expect(activityLook('girl', clipOf(['cold'], 1, { alpha: 0.55 }), false)).toEqual({
      key: 'cold+a0.55', first: 'cold', last: 'cold', static: false,
    });
    expect(activityLook('girl', clipOf(['cold', 'cold'], 1, { frameAlpha: [1, 0.8] }), false).key).toBe('cold+fa');
  });
  it('shows the burst rest frame with the bursts (the dig)', () => {
    const dig = clipOf(['dig0', 'dig1'], 4, { burst: { onMs: [1500, 4000], restFrame: 'sniff0', restMs: [1000, 2000] } });
    expect(activityLook('dog', dig, false)).toEqual({ key: 'dig0/dig1/sniff0', first: 'dig0', last: 'dig1', static: false });
    expect(activityLook('dog', dig, true)).toEqual({ key: 'head', first: 'head', last: 'head', static: true });
  });
  it('shows the unison accent frame and maps it under the stare', () => {
    const still = { ...clipOf(['idleA', 'idleB'], 2), accent: 'write0' };
    expect(activityLook('inspector', still, false).key).toBe('idleA/idleB/write0');
    expect(activityLook('inspector', still, true)).toEqual({ key: 'front', first: 'front', last: 'front', static: true });
  });
  it('tags a rise (positive risePx only) and a pulse', () => {
    expect(activityLook('dog', { ...clipOf(['sit0', 'sit1'], 1), risePx: 140 }, false).key).toBe('sit0/sit1+rise');
    expect(activityLook('dog', { ...clipOf(['sit0', 'sit1'], 1), risePx: 0 }, false).key).toBe('sit0/sit1');
    const pulse = activityLook('crow', { ...clipOf(['perch0'], 1), pulse: true }, false);
    expect(pulse).toEqual({ key: 'perch0+pulse', first: 'perch0', last: 'perch0', static: false });
  });
});

describe('visibleChangeMs, capOf and holdClip', () => {
  it('is Infinity for a one-frame clip and the first frame hold when frames hold by hash', () => {
    expect(visibleChangeMs(clipOf(['a'], 1))).toBe(Infinity);
    expect(visibleChangeMs(clipOf(['a', 'b'], 1, { frameHoldMs: [400, 1200] }))).toBe(400);
  });
  it('is one frame of the fps otherwise', () => {
    expect(visibleChangeMs(clipOf(['a', 'b'], 2))).toBe(500);
    expect(visibleChangeMs(clipOf(['a', 'b'], 1))).toBe(1000);
  });
  it('takes the activity cap first, then the static cap by era, then the hold cap', () => {
    const cap = act('c', { capMs: 55000 });
    expect(capOf(cap, activityLook('crow', cap.clip, false), 1)).toBe(55000);
    const st = staticAct('s');
    const stLook = activityLook('inspector', st.clip, false);
    expect(capOf(st, stLook, 2)).toBe(WORLD_BEHAVIOUR.capMs.staticEarly);
    expect(capOf(st, stLook, 5)).toBe(WORLD_BEHAVIOUR.capMs.staticV);
    const dyn = act('d');
    expect(capOf(dyn, activityLook('inspector', dyn.clip, false), 3)).toBe(WORLD_BEHAVIOUR.capMs.hold);
  });
  it('holds a clip that may be extended: repeatable, static, or changing no faster than the minimum hold', () => {
    const dyn = act('d');
    const dynLook = activityLook('inspector', dyn.clip, false);
    expect(holdClip(act('r', { repeatable: true }), dynLook)).toBe(true);
    expect(holdClip(dyn, dynLook)).toBe(true);
    expect(holdClip(staticAct('s'), activityLook('inspector', clipOf(['s'], 1), false))).toBe(true);
    const fast = act('f', { clip: clipOf(['a', 'b'], 6) });
    expect(holdClip(fast, activityLook('inspector', fast.clip, false))).toBe(false);
  });
  it('does not hold a burst (an action) unless it is repeatable', () => {
    const burst = burstAct('b');
    expect(holdClip(burst, activityLook('dog', burst.clip, false))).toBe(false);
    expect(holdClip(burstAct('rb', { repeatable: true }), activityLook('dog', burst.clip, false))).toBe(true);
  });
});

describe('conditions and eligible lists', () => {
  it('checks each condition against the context', () => {
    const on = ctxOf({ vents: true, holeDig: true, sensor: true, scraps: true, stare: true, reduced: false, demoHold: false, girlStage: 'mini' });
    const pairs: [BehaviourCond, boolean][] = [
      ['vents', true], ['holeDig', true], ['sensor', true], ['scraps', true], ['girlMini', true], ['girlGround', false],
      ['stareOn', true], ['stareOff', false], ['notReduced', true], ['notDemoHold', true],
    ];
    for (const [cond, want] of pairs) expect(condHolds(cond, on)).toBe(want);
    const off = ctxOf({ girlStage: 'ground', reduced: true, demoHold: true });
    expect(condHolds('girlGround', off)).toBe(true);
    expect(condHolds('notReduced', off)).toBe(false);
    expect(condHolds('notDemoHold', off)).toBe(false);
    expect(condHolds('stareOff', off)).toBe(true);
  });
  it('drops the Inspector readings that need the sensor or scraps when they are missing', () => {
    const ids = (ctx: BehaviourCtx): string[] => eligible('inspector', 1, ctx).map((a) => a.id);
    const bare = ids(ctxOf({ sensor: false, scraps: false }));
    expect(bare).not.toContain('reading');
    expect(bare).not.toContain('crouch');
    expect(bare).toContain('stand');
    const full = ids(ctxOf({ sensor: true, scraps: true }));
    expect(full).toContain('reading');
    expect(full).toContain('crouch');
  });
  it('adds the umbrella only in era III with vents', () => {
    expect(eligible('inspector', 3, ctxOf({ era: 3, vents: false })).map((a) => a.id)).not.toContain('umbrella');
    expect(eligible('inspector', 3, ctxOf({ era: 3, vents: true })).map((a) => a.id)).toContain('umbrella');
  });
  it('gives the girl nothing in the window stage, her mini frames in the mini stage and her ground frames on the ground', () => {
    for (const era of [1, 2, 3, 5] as const) expect(eligible('girl', era, ctxOf({ era, girlStage: 'window' }))).toEqual([]);
    const mini = eligible('girl', 2, ctxOf({ era: 2, girlStage: 'mini' }));
    expect(mini.map((a) => a.id)).toEqual(expect.arrayContaining(['flicker', 'dim']));
    expect(mini.every((a) => a.when?.includes('girlMini') === true)).toBe(true);
    const ground = eligible('girl', 5, ctxOf({ era: 5, girlStage: 'ground' }));
    expect(ground.length).toBeGreaterThan(0);
    expect(ground.every((a) => a.when?.includes('girlGround') === true)).toBe(true);
  });
  it('has no repertoire in era IV (the unison conductor runs the cast there)', () => {
    for (const actor of ACTORS) expect(eligible(actor, 4, ctxOf({ era: 4, girlStage: 'ground' }))).toEqual([]);
  });
});

describe('pickNext over the real repertoire', () => {
  // Scenarios of the hand simulation (S7, S9 dig, S11 vents, S11 ground girl, S15 stare), mapped to the scheduler's context.
  const SCENARIOS: { name: string; era: WorldEra; fps: number; stare: boolean; ctx: Partial<BehaviourCtx> }[] = [
    { name: 'S7', era: 1, fps: 4, stare: false, ctx: { sensor: true, scraps: true, girlStage: 'window' } },
    { name: 'S9dig', era: 2, fps: 8, stare: false, ctx: { sensor: true, scraps: true, holeDig: true, girlStage: 'mini' } },
    { name: 'S11', era: 3, fps: 8, stare: false, ctx: { sensor: true, scraps: true, vents: true, girlStage: 'mini' } },
    { name: 'S11g', era: 3, fps: 8, stare: false, ctx: { sensor: true, scraps: true, vents: true, girlStage: 'ground' } },
    { name: 'S15', era: 5, fps: 8, stare: true, ctx: { sensor: true, girlStage: 'ground' } },
  ];
  for (const sc of SCENARIOS) {
    for (const actor of ACTORS) {
      const ctx = ctxOf({ ...sc.ctx, era: sc.era, stare: sc.stare });
      const pool = eligible(actor, sc.era, ctx);
      if (pool.length === 0) continue;
      const env = envOf(actor, sc.era, { stare: sc.stare, fps: sc.fps, spots: actor === 'inspector' ? INS3 : actor === 'dog' ? DOG3 : ONE });
      const homeSpot = actor === 'inspector' || actor === 'dog' ? 1 : 0;
      it(`${sc.name} ${actor}: every pick obeys the caps, walk and merge rules over 60 min`, () => {
        for (const seed of [1, 2, 3]) {
          const picks = playPicks(pool, env, behaviourSeed(1, actor) + seed * 1000, { minutes: 60, homeSpot });
          expect(picks.length).toBeGreaterThan(10);
          expectRules(picks, env);
          for (const p of picks) expect(pool.some((a) => a.id === p.seg.id && a.weight > 0)).toBe(true);
        }
      });
    }
  }

  it('never starts a weight-0 reaction as a pick (the umbrella stays a reaction)', () => {
    const pool = eligible('inspector', 3, ctxOf({ era: 3, vents: true }));
    const env = envOf('inspector', 3, { fps: 8 });
    for (const seed of [1, 2]) {
      const picks = playPicks(pool, env, seed, { minutes: 60, homeSpot: 1 });
      expect(picks.some((p) => p.seg.id === 'umbrella')).toBe(false);
    }
  });

  it('keeps the crow I frozen hold and its static run within 55 s', () => {
    const pool = eligible('crow', 1, ctxOf({ era: 1 }));
    const env = envOf('crow', 1, { fps: 4 });
    let frozen = 0;
    for (const seed of [1, 2, 3, 4]) {
      const picks = playPicks(pool, env, seed, { minutes: 60 });
      expectRules(picks, env);
      for (const p of picks) {
        if (p.seg.id !== 'frozen') continue;
        frozen++;
        expect(p.seg.holdMs).toBeLessThanOrEqual(55000);
        expect(p.seg.endMs - p.seg.runStartMs).toBeLessThanOrEqual(55000);
      }
    }
    expect(frozen).toBeGreaterThan(0);
  });

  it('merges a repeatable activity into the same segment (same start, longer hold)', () => {
    const picks = playPicks(eligible('inspector', 1, ctxOf()), INS_ENV, 11, { minutes: 60, homeSpot: 1 });
    const merges = picks.filter((p) => p.merged);
    expect(merges.length).toBeGreaterThan(0);
    for (const m of merges) expect(m.seg.def.repeatable === true || holdClip(m.seg.def, m.seg.look)).toBe(true);
  });
});

describe('travel', () => {
  it('drops a travel whose spot is missing from the framing', () => {
    const env = envOf('inspector', 1, { spots: [{ id: 'sensor', x: 76 }, { id: 'mid', x: 100 }] });
    const pool = eligible('inspector', 1, ctxOf({ sensor: true, scraps: true }));
    for (const seed of [1, 2]) {
      const picks = playPicks(pool, env, seed, { minutes: 60, homeSpot: 1 });
      expect(picks.some((p) => p.seg.id === 'crouch')).toBe(false);
      expect(picks.length).toBeGreaterThan(0);
    }
  });

  it('never sends the dog back to the stake from the stake, and never walks a notStake travel onto it', () => {
    const pool = eligible('dog', 5, ctxOf({ era: 5, stare: true, girlStage: 'window' }));
    const env = envOf('dog', 5, { stare: true, fps: 8, spots: DOG3 });
    const stakeIdx = DOG3.findIndex((s) => s.id === 'stake');
    let backs = 0;
    for (const seed of [1, 2, 3]) {
      const picks = playPicks(pool, env, seed, { minutes: 60, homeSpot: stakeIdx });
      let before = stakeIdx;
      for (const { seg, merged } of picks) {
        if (!merged && seg.id === 'backToStake') {
          backs++;
          expect(before).not.toBe(stakeIdx);
        }
        if (!merged && seg.id === 'wander') expect(DOG3[seg.toSpot]?.id).not.toBe('stake');
        if (!merged) before = seg.toSpot;
      }
    }
    expect(backs).toBeGreaterThan(0);
  });

  it('never gives the spot travel a target closer than the minimum travel', () => {
    const close: PickEnv['spots'] = [{ id: 'sensor', x: 0 }, { id: 'mid', x: 10 }, { id: 'scrap', x: 20 }];
    const env = envOf('inspector', 5, { stare: true, fps: 8, spots: close });
    const pool = eligible('inspector', 5, ctxOf({ era: 5, stare: true }));
    for (const seed of [1, 2]) {
      const picks = playPicks(pool, env, seed, { minutes: 30, homeSpot: 1 });
      expect(picks.some((p) => p.seg.id === 'backstep')).toBe(false);
      expect(picks.some((p) => p.seg.id === 'withSensor')).toBe(true);
    }
  });

  it('gives a walk ceil(|dx| / 8) drawn frames at the mode fps, and moves the spot', () => {
    const scrap = act('toScrap', { travel: 'scrap' });
    const mem = newMemory(3, 0, 0);
    const seg = startSeg(mem, scrap, INS_ENV, 0);
    expect(seg.fromX).toBe(76);
    expect(seg.toX).toBe(124);
    expect(seg.toSpot).toBe(2);
    expect(seg.walkMs).toBe(6 * (1000 / INS_ENV.fps));
    expect(mem.spot).toBe(2);
    expect(mem.prevSpot).toBe(0);
    const crank = startSeg(newMemory(3, 0, 1), act('toSensor', { travel: 'sensor' }), { ...INS_ENV, fps: 2 }, 0);
    expect(crank.walkMs).toBe(3 * (1000 / 2));
  });

  it('damps the previous spot by prevSpotWeight (the weight of the spot it came from)', () => {
    const stroll = act('stroll', { travel: 'spot' });
    let toScrap = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) {
      const mem = newMemory(7000 + i, i, 1);
      mem.prevSpot = 0;
      if (startSeg(mem, stroll, INS_ENV, 0).toSpot === 2) toScrap++;
    }
    // Weights 1 (scrap) against prevSpotWeight (sensor): the scrap share is 1 / (1 + 0.5).
    const share = toScrap / n;
    expect(share).toBeGreaterThan(0.6);
    expect(share).toBeLessThan(0.73);
  });
});

describe('cooldowns, walks and the fallback chain', () => {
  it('respects a cooldown while other candidates stay free', () => {
    const cooled = act('B', { cooldownMs: 20000 });
    const picks = playPicks([cooled, act('C'), act('D')], INS_ENV, 77, { minutes: 60, homeSpot: 1 });
    let lastEnd: number | null = null;
    let count = 0;
    for (const { seg } of picks) {
      if (seg.id !== 'B') continue;
      count++;
      if (lastEnd !== null) expect(seg.startMs - lastEnd).toBeGreaterThanOrEqual(20000);
      lastEnd = seg.endMs;
    }
    expect(count).toBeGreaterThan(1);
  });

  it('alternates two activities once the second is off cooldown', () => {
    const picks = playPicks([act('A', { cooldownMs: 1e9 }), burstAct('B')], INS_ENV, 5, { count: 40, homeSpot: 1 });
    const ids = picks.map((p) => p.seg.id);
    for (let i = 1; i < ids.length; i++) expect(ids[i]).not.toBe(ids[i - 1]);
    expect(new Set(ids).size).toBe(2);
  });

  it('falls back to the least recently used reachable id when every walk is blocked after a walk', () => {
    const w1 = burstAct('w1', { travel: 'spot' });
    const w2 = burstAct('w2', { travel: 'spot' });
    const env = envOf('inspector', 1, { spots: [{ id: 'sensor', x: 76 }, { id: 'mid', x: 124 }] });
    const picks = playPicks([w1, w2], env, 21, { count: 12, homeSpot: 0 });
    expect(picks.slice(1).every((p) => p.seg.walkMs > 0)).toBe(true);
    const ids = picks.map((p) => p.seg.id);
    for (let i = 1; i < ids.length; i++) expect(ids[i]).not.toBe(ids[i - 1]);
  });

  it('keeps one repeatable static activity going to its run cap and restarts it after (one-activity pool)', () => {
    const stand = staticAct('stand', { repeatable: true, holdMs: [4000, 6000] });
    const picks = playPicks([stand], INS_ENV, 31, { count: 30, homeSpot: 1 });
    expect(picks.every((p) => p.seg.id === 'stand')).toBe(true);
    expect(picks.some((p) => p.merged)).toBe(true);
    for (const p of picks) expect(p.seg.holdMs).toBeGreaterThanOrEqual(WORLD_BEHAVIOUR.minHoldMs);
    let prev: Seg | null = null;
    for (const p of picks) {
      if (prev !== null && !p.merged) expect(p.seg.startMs).toBe(prev.endMs);
      prev = p.seg;
    }
  });

  it('extends a one-activity hold clip below its cap, then restarts it', () => {
    const slow = act('slow', { capMs: 10000, holdMs: [4000, 6000] });
    const picks = playPicks([slow], INS_ENV, 41, { count: 20, homeSpot: 1 });
    expect(picks.every((p) => p.seg.id === 'slow')).toBe(true);
    expect(picks.some((p) => p.merged)).toBe(true);
    for (const p of picks) expect(p.seg.holdMs).toBeLessThanOrEqual(10000);
  });

  it('restarts a one-activity burst (it cannot merge, extend or hand over)', () => {
    const solo = burstAct('solo');
    const picks = playPicks([solo], INS_ENV, 51, { count: 20, homeSpot: 1 });
    expect(picks.every((p) => p.seg.id === 'solo' && !p.merged)).toBe(true);
    let prev: Seg | null = null;
    for (const p of picks) {
      if (prev !== null) expect(p.seg.startMs).toBe(prev.endMs);
      expect(p.seg.holdMs).toBeGreaterThanOrEqual(1000);
      expect(p.seg.holdMs).toBeLessThanOrEqual(2000);
      prev = p.seg;
    }
  });

  it('throws when nothing is free or nothing is reachable (the runner parks first)', () => {
    expect(() => pickNext(newMemory(1, 0), null, [], INS_ENV, 0)).toThrow('no free activity');
    expect(() => pickNext(newMemory(1, 0), null, [act('z', { weight: 0 })], INS_ENV, 0)).toThrow('no free activity');
    const env: PickEnv = { ...INS_ENV, spots: [{ id: 'mid', x: 100 }, { id: 'scrap', x: 124 }] };
    expect(() => pickNext(newMemory(1, 0), null, [act('lost', { travel: 'sensor' })], env, 0)).toThrow('no reachable');
  });
});

describe('startSeg and the memory', () => {
  it('starts a segment outside a pick, uses a fixed hold and a reaction flag, and closes the last segment', () => {
    const mem = newMemory(5, 10);
    const seg = startSeg(mem, act('X', { holdMs: [2000, 2000] }), INS_ENV, 5000);
    expect(mem.k).toBe(11);
    expect(seg.startMs).toBe(5000);
    expect(seg.walkMs).toBe(0);
    expect(seg.holdMs).toBe(2000);
    expect(seg.endMs).toBe(7000);
    expect(seg.react).toBe(false);
    const reaction = startSeg(mem, act('Y'), INS_ENV, 7000, { react: true, holdMs: 1500 });
    expect(reaction.react).toBe(true);
    expect(reaction.holdMs).toBe(1500);
    expect(mem.lastEndMs.get('X')).toBe(7000);
    expect(mem.lastUseMs.get('X')).toBe(7000);
  });

  it('uses a pre-built look when given one', () => {
    const look: Look = { key: 'front', first: 'front', last: 'front', static: true };
    const seg = startSeg(newMemory(2, 0), act('U'), INS_ENV, 0, { look, holdMs: 900 });
    expect(seg.look).toBe(look);
    expect(seg.holdMs).toBe(900);
  });

  it('keeps the last two started ids (the recency damp needs no more)', () => {
    const mem = newMemory(9, 0);
    for (const id of ['a', 'b', 'c', 'd', 'e']) startSeg(mem, act(id), INS_ENV, 0);
    expect(mem.hist).toEqual(['d', 'e']);
  });
});

describe('follow and recency shift the odds', () => {
  const ENV = INS_ENV;
  const trials = 2000;
  // The share of Q among the picks from the current P (P never repeats: it is not repeatable).
  function shareOfQ(curDef: Activity, histPrefix: string[]): number {
    const cur = startSeg(newMemory(1, 0), curDef, ENV, 0);
    const pool = [curDef, act('Q'), act('R')];
    let q = 0;
    for (let i = 0; i < trials; i++) {
      const mem = newMemory(9000 + i, i);
      mem.hist.push(...histPrefix);
      if (pickNext(mem, cur, pool, ENV, cur.endMs).id === 'Q') q++;
    }
    return q / trials;
  }

  it('multiplies the weight by the follow entry of the current activity', () => {
    const withFollow = shareOfQ(act('P', { follow: { Q: 3 } }), ['z', 'P']);
    const without = shareOfQ(act('P'), ['z', 'P']);
    expect(withFollow).toBeGreaterThan(0.7);
    expect(without).toBeGreaterThan(0.44);
    expect(without).toBeLessThan(0.56);
  });

  it('damps the id two picks back by recency2Back', () => {
    const damped = shareOfQ(act('P'), ['Q', 'P']);
    const plain = shareOfQ(act('P'), ['z', 'P']);
    expect(damped).toBeGreaterThan(0.24);
    expect(damped).toBeLessThan(0.33);
    expect(plain).toBeGreaterThan(0.44);
    expect(plain).toBeLessThan(0.56);
  });
});

// ---- The timed runner (T3b): the clock, frames, walks, facing, pause, rehome, pins, parking, clip timing and emits. ----
const MIN = MS_PER_MIN;
const TOTAL = 20 * MIN;
// Homes: a left-wing actor (x below MACHINE_ANCHOR.x) and a right-wing one (the dog's placements are all right of the machine).
const HOME_L = 1800;
const HOME_R = 2400;
// The conductor is a stub here: era IV (the unison) is T3c.
const STUB_CONDUCTOR: UnisonConductor = {
  step: () => undefined,
  current: () => ({ id: 'still', post: false, startBeat: 0, endBeat: 0 }),
  next: () => false,
  reset: () => undefined,
};
// The spots of an actor around its home x: the Inspector's sensor, mid and scrap (24 px apart); the dog's stake, home and out.
function spotsFor(actor: BehaviourActor, homeX: number): PickEnv['spots'] {
  if (actor === 'inspector') return [{ id: 'sensor', x: homeX - 24 }, { id: 'mid', x: homeX }, { id: 'scrap', x: homeX + 24 }];
  if (actor === 'dog') return [{ id: 'stake', x: homeX - 24 }, { id: 'home', x: homeX }, { id: 'out', x: homeX + 24 }];
  return [];
}
// The context of a runner: the era's flags (vents in era III, the stare in era V), the actor's spots and the overrides.
function ctxFor(actor: BehaviourActor, era: WorldEra, mode: PlaybackMode, homeX: number, over: Partial<BehaviourCtx> = {}): BehaviourCtx {
  return {
    era, mode, crankSteps: 0, reduced: false, stare: era === 5, reverse: false, vents: era === 3, holeDig: false, sensor: true,
    scraps: true, demoHold: false, paused: false, homeX, girlStage: era === 5 ? 'ground' : 'mini', spots: spotsFor(actor, homeX),
    cues: [], beat: { downbeat: false, index: 0 }, ...over,
  };
}
interface PlayOpts { k0?: number; visit?: (f: BehaviourFrame, r: BehaviourRunner) => void; afterFirst?: (r: BehaviourRunner) => void }
// Plays one runner from reset (draw index k0) for totalMs in steps of dtMs. visit sees the live frame after each step. Returns the
// closed segments in order.
function playRunner(actor: BehaviourActor, seed: number, ctx: BehaviourCtx, dtMs: number, totalMs: number, opts: PlayOpts = {}):
  BehaviourLogEntry[] {
  const log: BehaviourLogEntry[] = [];
  const r = createBehaviourRunner(actor, seed, STUB_CONDUCTOR, (e) => log.push(e));
  r.reset(seed, opts.k0 ?? 0, ctx.homeX);
  const steps = Math.round(totalMs / dtMs);
  for (let i = 0; i < steps; i++) {
    const f = r.step(dtMs, ctx);
    if (i === 0) opts.afterFirst?.(r);
    opts.visit?.(f, r);
  }
  return log;
}
// The activities an actor may pick in an era (the repertoire, before the 'when' filter).
function repertoire(actor: BehaviourActor, era: WorldEra): readonly Activity[] {
  return WORLD_REPERTOIRE[actor][era] ?? [];
}
function activityOf(actor: BehaviourActor, era: WorldEra, id: string): Activity | undefined {
  return repertoire(actor, era).find((a) => a.id === id);
}
// The index of a walk frame name (walk0..walk3).
function walkIndex(name: string): number {
  return Number(name.slice('walk'.length));
}
const FPS_OF: Partial<Record<PlaybackMode, number>> = { fps2: WORLD_PLAYBACK.fps.fps2, fps4: WORLD_PLAYBACK.fps.fps4, fps8: WORLD_PLAYBACK.fps.fps8 };
const SAFE_END = TOTAL - 1000;

describe('the timed runner: clock and dt invariance', () => {
  const CASES: { name: string; actor: BehaviourActor; era: WorldEra; mode: PlaybackMode }[] = [
    { name: 'S7 inspector', actor: 'inspector', era: 1, mode: 'fps4' },
    { name: 'S7 dog', actor: 'dog', era: 1, mode: 'fps4' },
    { name: 'S7 crow', actor: 'crow', era: 1, mode: 'fps4' },
    { name: 'S11 inspector', actor: 'inspector', era: 3, mode: 'fps8' },
    { name: 'S11 dog', actor: 'dog', era: 3, mode: 'fps8' },
    { name: 'S15 inspector', actor: 'inspector', era: 5, mode: 'fps8' },
    { name: 'S15 dog', actor: 'dog', era: 5, mode: 'fps8' },
  ];
  for (const c of CASES) {
    it(`${c.name}: the same activities at the same boundaries for dt 16.7 / 33.3 / 100 / 250 ms over 20 min`, () => {
      const seed = behaviourSeed(1, c.actor);
      const ctx = ctxFor(c.actor, c.era, c.mode, HOME_L);
      const dts = [16.7, 33.3, 100, 250];
      const logs = dts.map((dt) => playRunner(c.actor, seed, ctx, dt, TOTAL).filter((e) => e.atMs + e.durMs <= SAFE_END));
      const ref = logs[0] ?? [];
      expect(ref.length).toBeGreaterThan(3);
      dts.forEach((dt, i) => {
        const log = logs[i] ?? [];
        expect(log.map((e) => e.activity)).toEqual(ref.map((e) => e.activity));
        log.forEach((e, j) => {
          expect(Math.abs(e.atMs - (ref[j]?.atMs ?? Infinity))).toBeLessThanOrEqual(dt + (dts[0] ?? 0));
        });
      });
    });
    it(`${c.name}: never repeats an activity back to back (a repeatable merge is not logged)`, () => {
      const log = playRunner(c.actor, behaviourSeed(1, c.actor), ctxFor(c.actor, c.era, c.mode, HOME_L), 100, TOTAL);
      const repeatable = new Set(repertoire(c.actor, c.era).filter((a) => a.repeatable === true).map((a) => a.id));
      for (let i = 1; i < log.length; i++) {
        const cur = log[i];
        const prev = log[i - 1];
        if (cur === undefined || prev === undefined) continue;
        if (cur.activity === prev.activity) expect(repeatable.has(cur.activity), cur.activity).toBe(true);
      }
      for (const e of log) {
        expect(e.reaction).toBe(false);
        expect(e.durMs).toBeGreaterThan(0);
      }
    });
  }
});

describe('the timed runner: walking and facing', () => {
  it('moves at most one walk frame (8 world px) per step while walking, and never otherwise', () => {
    const scen: [BehaviourActor, WorldEra, PlaybackMode][] = [
      ['inspector', 1, 'fps4'], ['dog', 1, 'fps4'], ['inspector', 2, 'fps8'], ['dog', 3, 'fps8'], ['inspector', 5, 'fps8'], ['dog', 5, 'fps8'],
    ];
    for (const [actor, era, mode] of scen) {
      for (const dt of [16.7, 100]) {
        let prev: { x: number; walking: boolean } | null = null;
        let walks = 0;
        playRunner(actor, behaviourSeed(1, actor), ctxFor(actor, era, mode, HOME_L), dt, 10 * MIN, {
          visit: (f) => {
            if (prev !== null) {
              const d = Math.abs(f.x - prev.x);
              if (f.walking) {
                expect(d).toBeLessThanOrEqual(WORLD_WALK.pxPerFrame);
                if (!prev.walking) walks++;
              } else {
                expect(d).toBe(0);
              }
            }
            prev = { x: f.x, walking: f.walking };
          },
        });
        expect(walks).toBeGreaterThan(0);
      }
    }
  });

  it('keeps the Inspector and the dog walking at most maxWalkShare of the time (S7 and S11)', () => {
    const scen: [BehaviourActor, WorldEra, PlaybackMode][] = [
      ['inspector', 1, 'fps4'], ['dog', 1, 'fps4'], ['inspector', 3, 'fps8'], ['dog', 3, 'fps8'],
    ];
    for (const [actor, era, mode] of scen) {
      let walking = 0;
      let steps = 0;
      playRunner(actor, behaviourSeed(1, actor), ctxFor(actor, era, mode, HOME_L), 16.7, 10 * MIN, {
        visit: (f) => {
          steps++;
          if (f.walking) walking++;
        },
      });
      expect(walking / steps).toBeLessThanOrEqual(WORLD_WALK.maxWalkShare);
    }
  });

  it('faces a profile rest frame away from the machine: the left-wing Inspector flips, the right-wing dog and the crow and girl do not', () => {
    let restSeen = 0;
    playRunner('inspector', behaviourSeed(1, 'inspector'), ctxFor('inspector', 1, 'fps4', HOME_L), 16.7, 3 * MIN, {
      visit: (f) => {
        if (f.walking || f.frame === '') return;
        restSeen++;
        expect(f.flip).toBe(true);
      },
    });
    expect(restSeen).toBeGreaterThan(0);
    expect(HOME_L).toBeLessThan(MACHINE_ANCHOR.x);
    const noFlip: [BehaviourActor, WorldEra, PlaybackMode, number][] = [
      ['inspector', 1, 'fps4', HOME_R], ['dog', 1, 'fps4', HOME_R], ['dog', 2, 'fps8', HOME_R], ['crow', 1, 'fps4', HOME_L], ['crow', 2, 'fps8', HOME_L],
      ['girl', 2, 'fps8', HOME_L],
    ];
    for (const [actor, era, mode, homeX] of noFlip) {
      const ctx = ctxFor(actor, era, mode, homeX, actor === 'girl' ? { girlStage: 'mini' } : {});
      playRunner(actor, behaviourSeed(1, actor), ctx, 16.7, 3 * MIN, {
        visit: (f) => {
          if (f.walking || f.frame === '') return;
          expect(f.flip, `${actor} ${f.frame}`).toBe(false);
        },
      });
    }
  });

  it('flips a walk by its direction; a reversed walk flips the other way and turns its frames walk3 to walk0', () => {
    const scen: [BehaviourActor, WorldEra][] = [['inspector', 1], ['dog', 1], ['inspector', 5], ['dog', 5]];
    for (const [actor, era] of scen) {
      let checked = 0;
      let reversedChecked = 0;
      let prevX: number | null = null;
      let prevFrame = '';
      let prevActivity = '';
      playRunner(actor, behaviourSeed(1, actor), ctxFor(actor, era, era === 5 ? 'fps8' : 'fps4', HOME_L), 16.7, 10 * MIN, {
        visit: (f) => {
          if (!f.walking) {
            prevFrame = '';
            prevX = f.x;
            return;
          }
          const reversed = activityOf(actor, era, f.activity)?.reversed === true;
          if (prevX !== null && f.x !== prevX) {
            expect(f.flip).toBe(reversed ? f.x > prevX : f.x < prevX);
            checked++;
            if (reversed) reversedChecked++;
          }
          if (f.frame !== prevFrame && prevActivity === f.activity && prevFrame !== '') {
            // The walk cycle advances one frame per tick (walk0..walk3), backwards when reversed.
            expect((walkIndex(f.frame) - walkIndex(prevFrame) + 4) % 4).toBe(reversed ? 3 : 1);
          }
          prevFrame = f.frame;
          prevActivity = f.activity;
          prevX = f.x;
        },
      });
      expect(checked).toBeGreaterThan(0);
      if (era === 5) expect(reversedChecked).toBeGreaterThan(0);
    }
  });

  it('never flips a camera-facing frame: under the stare every rest frame is stare-safe and does not flip', () => {
    for (const actor of ['inspector', 'dog'] as const) {
      let rests = 0;
      playRunner(actor, behaviourSeed(1, actor), ctxFor(actor, 5, 'fps8', HOME_L), 16.7, 5 * MIN, {
        visit: (f) => {
          if (f.walking || f.frame === '') return;
          rests++;
          expect(WORLD_STARE_SAFE[actor]).toContain(f.frame);
          expect(f.flip).toBe(false);
        },
      });
      expect(rests).toBeGreaterThan(0);
    }
  });
});

describe('the timed runner: pause, rehome, pins, parking and the frame', () => {
  it('returns the same preallocated frame object from every step, paused or not', () => {
    const seed = behaviourSeed(1, 'inspector');
    const ctx = ctxFor('inspector', 1, 'fps4', HOME_L);
    const r = createBehaviourRunner('inspector', seed, STUB_CONDUCTOR);
    r.reset(seed, 0, HOME_L);
    const a = r.step(50, ctx);
    expect(r.step(50, ctx)).toBe(a);
    expect(r.step(50, { ...ctx, paused: true })).toBe(a);
    expect(r.step(50, { ...ctx, demoHold: true })).toBe(a);
  });

  it('holds the frame, the clock and x while paused, and resumes the same activity', () => {
    const seed = behaviourSeed(1, 'inspector');
    const ctx = ctxFor('inspector', 1, 'fps8', HOME_L);
    const r = createBehaviourRunner('inspector', seed, STUB_CONDUCTOR);
    r.reset(seed, 0, HOME_L);
    let walking = false;
    for (let i = 0; i < 4000 && !walking; i++) walking = r.step(50, ctx).walking;
    expect(walking).toBe(true);
    const held = { ...r.step(50, ctx) };
    const before = r.snapshot();
    for (let i = 0; i < 100; i++) {
      const f = r.step(250, { ...ctx, paused: true });
      expect(f.x).toBe(held.x);
      expect(f.frame).toBe(held.frame);
      expect(f.walking).toBe(held.walking);
    }
    expect(r.snapshot()).toEqual(before);
    const resumed = { ...r.step(50, ctx) };
    expect(resumed.activity).toBe(held.activity);
    expect(Math.abs(resumed.x - held.x)).toBeLessThanOrEqual(WORLD_WALK.pxPerFrame);
  });

  it('rehome keeps the activity and puts the runner on the nearest new home spot', () => {
    const seed = behaviourSeed(1, 'inspector');
    const r = createBehaviourRunner('inspector', seed, STUB_CONDUCTOR);
    r.reset(seed, 0, HOME_L);
    for (let i = 0; i < 200; i++) r.step(50, ctxFor('inspector', 1, 'fps8', HOME_L));
    const before = r.snapshot().activity;
    r.rehome(HOME_L + 24);
    const moved = r.snapshot();
    expect(moved.activity).toBe(before);
    expect(moved.x).toBe(HOME_L + 24);
    expect(moved.walking).toBe(false);
    const after = r.step(1, ctxFor('inspector', 1, 'fps8', HOME_L + 24));
    expect(after.x).toBe(HOME_L + 24);
    expect(r.snapshot().activity).toBe(before);
  });

  it('next() pins the activity for the next step, and refuses an id outside the eligible list', () => {
    const seed = behaviourSeed(1, 'inspector');
    const r = createBehaviourRunner('inspector', seed, STUB_CONDUCTOR);
    r.reset(seed, 0, HOME_L);
    expect(r.next('umbrella')).toBe(false);
    r.step(50, ctxFor('inspector', 3, 'fps8', HOME_L));
    expect(r.next('umbrella')).toBe(true);
    expect(r.next('nope')).toBe(false);
    r.step(50, ctxFor('inspector', 3, 'fps8', HOME_L));
    expect(r.snapshot().activity).toBe('umbrella');
    r.step(50, ctxFor('inspector', 5, 'fps8', HOME_L));
    expect(r.next('write')).toBe(false);
    expect(r.next('stand')).toBe(true);
  });

  it('parks the girl in the window stage: a parked frame with no picks', () => {
    const seed = behaviourSeed(1, 'girl');
    const ctx = ctxFor('girl', 1, 'fps4', HOME_L, { girlStage: 'window' });
    const r = createBehaviourRunner('girl', seed, STUB_CONDUCTOR);
    r.reset(seed, 0, HOME_L);
    for (let i = 0; i < 200; i++) {
      const f = r.step(100, ctx);
      expect(f.activity).toBe('parked');
      expect(f.frame).toBe('');
      expect(f.x).toBe(HOME_L);
      expect(f.alpha).toBe(1);
      expect(f.walking).toBe(false);
    }
    expect(r.snapshot().k).toBe(0);
  });

  it('waits in era IV until the conductor path (T3c): a waiting frame, no pick (WP24 r1 a2)', () => {
    for (const actor of ACTORS) {
      const r = createBehaviourRunner(actor, behaviourSeed(1, actor), STUB_CONDUCTOR);
      r.reset(1, 0, HOME_L);
      expect(r.step(100, ctxFor(actor, 4, 'fps8', HOME_L)).activity).toBe('waiting');
    }
  });

  it('suspends at demoHold with the clock stopped, and resumes the same activity', () => {
    const seed = behaviourSeed(1, 'dog');
    const ctx = ctxFor('dog', 2, 'fps8', HOME_L);
    const r = createBehaviourRunner('dog', seed, STUB_CONDUCTOR);
    r.reset(seed, 0, HOME_L);
    for (let i = 0; i < 300; i++) r.step(50, ctx);
    const held = r.snapshot();
    for (let i = 0; i < 50; i++) {
      const f = r.step(50, { ...ctx, demoHold: true });
      expect(f.activity).toBe('parked');
      expect(f.frame).toBe('');
      expect(r.snapshot().sinceMs).toBe(held.sinceMs);
    }
    r.step(50, ctx);
    expect(r.snapshot().activity).toBe(held.activity);
  });

  it('replays the same frames for the same seed and inputs, and not for another seed', () => {
    const grab = (seed: number): string[] => {
      const out: string[] = [];
      playRunner('dog', seed, ctxFor('dog', 3, 'fps8', HOME_L), 100, 3 * MIN, {
        visit: (f) => out.push(`${f.activity}|${f.frame}|${f.x}|${f.flip}|${f.walking}|${f.step}`),
      });
      return out;
    };
    const a = grab(behaviourSeed(1, 'dog'));
    expect(grab(behaviourSeed(1, 'dog'))).toEqual(a);
    expect(grab(behaviourSeed(2, 'dog'))).not.toEqual(a);
  });

  it('starts a later session at another point of the sequence (k0 from the active minutes)', () => {
    const seed = behaviourSeed(1, 'inspector');
    const ctx = ctxFor('inspector', 1, 'fps4', HOME_L);
    const first = playRunner('inspector', seed, ctx, 100, 10 * MIN).map((e) => e.activity);
    const later = playRunner('inspector', seed, ctx, 100, 10 * MIN, { k0: behaviourK0(54000) }).map((e) => e.activity);
    expect(later).not.toEqual(first);
  });

  it('starts the runners out of phase: their first offsets differ', () => {
    const offsets = (['inspector', 'dog', 'crow'] as const).map((actor) => {
      const r = createBehaviourRunner(actor, behaviourSeed(1, actor), STUB_CONDUCTOR);
      r.reset(behaviourSeed(1, actor), 0, HOME_L);
      r.step(1, ctxFor(actor, 1, 'fps4', HOME_L));
      return r.snapshot().sinceMs;
    });
    expect(new Set(offsets).size).toBeGreaterThan(1);
  });
});

describe('the timed runner: clip frames, emits, seam and reduced motion', () => {
  it('shows the umbrella halves only in the first and last edgeMs of the hold, and the open frame between', () => {
    const clip = activityOf('inspector', 3, 'umbrella')?.clip;
    const edge = clip?.edgeMs ?? Infinity;
    const tau = 1000 / WORLD_PLAYBACK.fps.fps8;
    const records: { since: number; frame: string; pose: string }[] = [];
    const log = playRunner('inspector', behaviourSeed(1, 'inspector'), ctxFor('inspector', 3, 'fps8', HOME_L), 16.7, 40000, {
      afterFirst: (r) => r.next('umbrella'),
      visit: (f, r) => {
        if (f.activity === 'umbrella') records.push({ since: r.snapshot().sinceMs, frame: f.frame, pose: f.poseSet });
      },
    });
    const hold = log.find((e) => e.activity === 'umbrella')?.durMs ?? -1;
    expect(hold).toBeGreaterThan(0);
    expect(records.length).toBeGreaterThan(0);
    for (const rec of records) {
      expect(rec.pose).toBe('umbrella');
      if (rec.since < edge) expect(rec.frame).toBe('umbrellaHalf');
      else if (rec.since >= edge + tau && rec.since < hold - edge) expect(rec.frame).toBe('umbrellaOpen');
      else if (rec.since >= hold - edge + tau) expect(rec.frame).toBe('umbrellaHalf');
    }
  });

  it('holds each frameHoldMs frame at least its lower bound (one drawn tick of slack)', () => {
    const tip = activityOf('crow', 2, 'tipTry')?.clip;
    const lo = tip?.frameHoldMs?.[0] ?? 0;
    const tick = 1000 / WORLD_PLAYBACK.fps.fps8;
    const dt = 16.7;
    const bySeg = new Map<number, { since: number; frame: string }[]>();
    playRunner('crow', behaviourSeed(1, 'crow'), ctxFor('crow', 2, 'fps8', HOME_L), dt, 40000, {
      afterFirst: (r) => r.next('tipTry'),
      visit: (f, r) => {
        if (f.activity !== 'tipTry' || f.walking) return;
        const k = r.snapshot().k;
        const list = bySeg.get(k) ?? [];
        list.push({ since: r.snapshot().sinceMs, frame: f.frame });
        bySeg.set(k, list);
      },
    });
    let runs = 0;
    for (const samples of bySeg.values()) {
      const changes: number[] = [];
      samples.forEach((s, i) => {
        const prev = samples[i - 1];
        if (prev !== undefined && prev.frame !== s.frame) changes.push(s.since);
      });
      for (let i = 1; i < changes.length; i++) {
        runs++;
        expect((changes[i] ?? 0) - (changes[i - 1] ?? 0)).toBeGreaterThanOrEqual(lo - tick - dt);
      }
    }
    expect(runs).toBeGreaterThan(0);
  });

  it('digs: animated bursts of dig frames alternate with still sniff0 listens', () => {
    const rest = activityOf('dog', 2, 'dig')?.clip.burst?.restMs[0] ?? 0;
    const dt = 16.7;
    const runsOut: { frame: string; ms: number }[] = [];
    playRunner('dog', behaviourSeed(1, 'dog'), ctxFor('dog', 2, 'fps8', HOME_L, { holeDig: true }), dt, 20 * MIN, {
      afterFirst: (r) => r.next('dig'),
      visit: (f) => {
        if (f.activity !== 'dig' || f.walking) return;
        const last = runsOut[runsOut.length - 1];
        if (last !== undefined && last.frame === f.frame) last.ms += dt;
        else runsOut.push({ frame: f.frame, ms: dt });
      },
    });
    const names = new Set(runsOut.map((r) => r.frame));
    expect(names.has('dig0') && names.has('dig1') && names.has('sniff0')).toBe(true);
    const sniff = runsOut.filter((r) => r.frame === 'sniff0');
    expect(sniff.length).toBeGreaterThan(0);
    expect(Math.max(...sniff.map((r) => r.ms))).toBeGreaterThanOrEqual(rest - 2 * dt);
    const pairs = runsOut.filter((r, i) => r.frame.startsWith('dig') && runsOut[i + 1]?.frame === 'sniff0');
    expect(pairs.length).toBeGreaterThan(0);
  });

  it('emits atSensor at the start of a reading (after its walk, never while walking)', () => {
    let emitted = 0;
    let bad = 0;
    const log = playRunner('inspector', behaviourSeed(1, 'inspector'), ctxFor('inspector', 1, 'fps4', HOME_L), 16.7, TOTAL, {
      visit: (f) => {
        if (f.emitted === null) return;
        emitted++;
        if (f.emitted !== 'atSensor' || f.activity !== 'reading' || f.walking) bad++;
      },
    });
    const readings = log.filter((e) => e.activity === 'reading').length;
    expect(bad).toBe(0);
    expect(emitted).toBeGreaterThanOrEqual(readings - 1);
    expect(emitted).toBeLessThanOrEqual(readings + 1);
    expect(emitted).toBeGreaterThan(0);
  });

  it('emits digBout at the end of each dig (the step the next activity starts)', () => {
    let prev = '';
    let ends = 0;
    let bad = 0;
    const log = playRunner('dog', behaviourSeed(1, 'dog'), ctxFor('dog', 2, 'fps8', HOME_L, { holeDig: true }), 16.7, TOTAL, {
      visit: (f) => {
        if (f.emitted !== null) {
          ends++;
          if (f.emitted !== 'digBout' || prev !== 'dig' || f.activity === 'dig') bad++;
        }
        prev = f.activity;
      },
    });
    const digs = log.filter((e) => e.activity === 'dig').length;
    expect(digs).toBeGreaterThan(0);
    expect(bad).toBe(0);
    expect(ends).toBe(digs);
  });

  it('drops one frame at each wrap of a looped clip in eras I-II (the seam), and not in era III', () => {
    const write = ['write0', 'write1'];
    const scen: [WorldEra, PlaybackMode][] = [[1, 'fps4'], [3, 'fps8']];
    for (const [era, mode] of scen) {
      const fps = FPS_OF[mode] ?? 0;
      const seam = era <= 2;
      let checked = 0;
      playRunner('inspector', behaviourSeed(1, 'inspector'), ctxFor('inspector', era, mode, HOME_L), 16.7, 30000, {
        afterFirst: (r) => r.next('write'),
        visit: (f, r) => {
          if (f.activity !== 'write' || f.walking) return;
          const e = (Math.floor((r.snapshot().sinceMs * fps) / 1000) * 1000) / fps;
          const t = Math.floor((e * 2) / 1000);
          const idx = seam ? (t + Math.floor(t / 2)) % 2 : t % 2;
          expect(f.frame).toBe(write[idx]);
          checked++;
        },
      });
      expect(checked).toBeGreaterThan(0);
    }
  });
});

describe('the timed runner: walk share and reduced motion', () => {
  it('walks at most once per reducedWalkGapMs under reduced motion, and walks more without it', () => {
    for (const actor of ['inspector', 'dog'] as const) {
      const seed = behaviourSeed(1, actor);
      const walks = playRunner(actor, seed, ctxFor(actor, 1, 'fps4', HOME_L, { reduced: true }), 100, 10 * MIN)
        .filter((e) => e.walked).map((e) => e.atMs);
      for (let i = 1; i < walks.length; i++) {
        expect((walks[i] ?? 0) - (walks[i - 1] ?? 0)).toBeGreaterThanOrEqual(WORLD_WALK.reducedWalkGapMs);
      }
      const free = playRunner(actor, seed, ctxFor(actor, 1, 'fps4', HOME_L), 100, 10 * MIN).filter((e) => e.walked).length;
      expect(free).toBeGreaterThan(walks.length);
    }
  });
});

describe('determinism', () => {
  it('replays the same 500 picks for the same seed and inputs, and a new seed changes them', () => {
    const pool = eligible('inspector', 1, ctxOf());
    const sig = (ps: Pick[]): unknown[] => ps.map((p) => [p.seg.id, p.seg.startMs, p.seg.holdMs, p.seg.walkMs, p.seg.toSpot, p.merged]);
    const a = playPicks(pool, INS_ENV, 42, { count: 500, homeSpot: 1 });
    const b = playPicks(pool, INS_ENV, 42, { count: 500, homeSpot: 1 });
    expect(sig(b)).toEqual(sig(a));
    const c = playPicks(pool, INS_ENV, 43, { count: 500, homeSpot: 1 });
    expect(sig(c)).not.toEqual(sig(a));
  });

  it('starts a later session at another point of the sequence (k0)', () => {
    const pool = eligible('inspector', 1, ctxOf());
    const first = playPicks(pool, INS_ENV, 42, { count: 60, homeSpot: 1, k0: 0 }).map((p) => p.seg.id);
    const later = playPicks(pool, INS_ENV, 42, { count: 60, homeSpot: 1, k0: behaviourK0(54000) }).map((p) => p.seg.id);
    expect(later).not.toEqual(first);
  });
});


// ---- WP24 T3c: cues and reactions, the wake, crank mode, the era change, the unison conductor and the era IV runner path. ----
const STEP = 100;
const CUE_EVERY_MS = 60000;
const BEAT = TIER_HEARTBEAT.periodMs;
const DOG_LAT = WORLD_REACT.latencyMs.dog;
const CRANK_MS = WORLD_BEHAVIOUR.crankHoldMsPerClick;
type UnisonAct = ReturnType<UnisonConductor['current']>;
const IV_HOME: Record<BehaviourActor, number> = { inspector: HOME_L, dog: HOME_R, crow: HOME_R, girl: HOME_R };

// A cue presented to a runner at a step: the runner sees it on its clock after that step, which reads (step + 1) x dt.
interface CueAt { step: number; id: CueId; index: number }
// The step at which the clock reads ms (after step i the clock is (i + 1) x dt).
const stepAt = (ms: number, dtMs: number): number => Math.round(ms / dtMs) - 1;
// Plays one runner with a fixed context for totalMs in dtMs steps. The cues are presented at their steps; visit sees each live frame.
function playCued(actor: BehaviourActor, seed: number, ctx: BehaviourCtx, dtMs: number, totalMs: number, cues: readonly CueAt[] = [],
  visit?: (f: BehaviourFrame, i: number) => void): BehaviourLogEntry[] {
  const log: BehaviourLogEntry[] = [];
  const r = createBehaviourRunner(actor, seed, STUB_CONDUCTOR, (e) => log.push(e));
  r.reset(seed, 0, ctx.homeX);
  const byStep = new Map<number, { id: CueId; index: number }[]>();
  for (const c of cues) byStep.set(c.step, [...(byStep.get(c.step) ?? []), { id: c.id, index: c.index }]);
  const steps = Math.round(totalMs / dtMs);
  for (let i = 0; i < steps; i++) {
    const f = r.step(dtMs, { ...ctx, cues: byStep.get(i) ?? [] });
    visit?.(f, i);
  }
  return log;
}
// Plays one runner through a context sequence: ctxAt(i) is the context of step i.
function playWith(actor: BehaviourActor, seed: number, dtMs: number, totalMs: number, ctxAt: (i: number) => BehaviourCtx): BehaviourLogEntry[] {
  const log: BehaviourLogEntry[] = [];
  const r = createBehaviourRunner(actor, seed, STUB_CONDUCTOR, (e) => log.push(e));
  r.reset(seed, 0, ctxAt(0).homeX);
  const steps = Math.round(totalMs / dtMs);
  for (let i = 0; i < steps; i++) r.step(dtMs, ctxAt(i));
  return log;
}
// The dog in era II with no travel (one spot): ring and rapid reach it without a walk.
const dogNoWalk = (): BehaviourCtx => ctxFor('dog', 2, 'fps8', HOME_R, { spots: [] });
// The index of the first cue index from 1 whose chance gate passes for the seed.
function passingIndex(seed: number): number {
  for (let j = 1; ; j++) {
    if (hash01(seed + WORLD_BEHAVIOUR.salts.react, j) < WORLD_REACT.chance) return j;
  }
}

describe('cues and reactions (T3c)', () => {
  it('starts a reaction inside the actor band after its cue, and only for a cue whose chance gate passes', () => {
    const seed = behaviourSeed(1, 'dog');
    const cues: CueAt[] = [];
    for (let k = 1; k <= 20; k++) cues.push({ step: stepAt(k * CUE_EVERY_MS, STEP), id: 'ring', index: k });
    const log = playCued('dog', seed, dogNoWalk(), STEP, 20 * CUE_EVERY_MS + CUE_EVERY_MS, cues);
    const reactions = log.filter((e) => e.reaction);
    expect(reactions.length).toBeGreaterThan(0);
    for (const e of reactions) {
      const k = Math.floor(e.atMs / CUE_EVERY_MS);
      const lag = e.atMs - k * CUE_EVERY_MS;
      expect(lag).toBeGreaterThanOrEqual(DOG_LAT[0]);
      expect(lag).toBeLessThanOrEqual(DOG_LAT[1]);
      expect(hash01(seed + WORLD_BEHAVIOUR.salts.react, k)).toBeLessThan(WORLD_REACT.chance);
      expect(['wag', 'lookUp']).toContain(e.activity);
    }
  });

  it('keeps a pair cooldown per actor and cue: the reactions to a cue stream at least the cooldown apart', () => {
    const seed = behaviourSeed(1, 'dog');
    const every = 3000;
    const cues: CueAt[] = [];
    for (let k = 1; k <= 60; k++) cues.push({ step: stepAt(k * every, STEP), id: 'ring', index: k });
    const log = playCued('dog', seed, dogNoWalk(), STEP, 60 * every + CUE_EVERY_MS, cues);
    const starts = log.filter((e) => e.reaction).map((e) => e.atMs);
    expect(starts.length).toBeGreaterThan(1);
    const band = DOG_LAT[1] - DOG_LAT[0];
    for (let i = 1; i < starts.length; i++) {
      expect((starts[i] ?? 0) - (starts[i - 1] ?? 0)).toBeGreaterThanOrEqual(WORLD_REACT.pairCooldownMs - band);
    }
  });

  it('keeps the four actor bands at least 125 ms apart, so no two actors react to one cue within 125 ms', () => {
    const gap = (a: readonly [number, number], b: readonly [number, number]): number => Math.max(b[0] - a[1], a[0] - b[1]);
    for (const a of ACTORS) {
      for (const b of ACTORS) {
        if (a === b) continue;
        expect(gap(WORLD_REACT.latencyMs[a], WORLD_REACT.latencyMs[b])).toBeGreaterThanOrEqual(125);
      }
    }
  });

  it('three actors answer one vent puff at least 125 ms apart (the inspector, the dog and the girl)', () => {
    const cues: CueAt[] = [];
    for (let k = 1; k <= 30; k++) cues.push({ step: stepAt(k * CUE_EVERY_MS, STEP), id: 'ventPuff', index: k });
    const byCue = new Map<number, number[]>();
    for (const a of ['inspector', 'dog', 'girl'] as const) {
      const ctx = ctxFor(a, 3, 'fps8', IV_HOME[a], { spots: [] });
      const log = playCued(a, behaviourSeed(1, a), ctx, STEP, 30 * CUE_EVERY_MS + CUE_EVERY_MS, cues);
      const reactions = log.filter((e) => e.reaction);
      expect(reactions.length).toBeGreaterThan(0);
      for (const e of reactions) {
        const k = Math.floor(e.atMs / CUE_EVERY_MS);
        byCue.set(k, [...(byCue.get(k) ?? []), e.atMs]);
      }
    }
    let pairs = 0;
    for (const starts of byCue.values()) {
      for (let i = 0; i < starts.length; i++) {
        for (let j = i + 1; j < starts.length; j++) {
          pairs++;
          expect(Math.abs((starts[i] ?? 0) - (starts[j] ?? 0))).toBeGreaterThanOrEqual(125);
        }
      }
    }
    expect(pairs).toBeGreaterThan(0);
  });

  it('a reaction replaces the current activity: the replaced one ends at the reaction, and the log segments run on end to end', () => {
    const seed = behaviourSeed(1, 'dog');
    const cues: CueAt[] = [];
    for (let k = 1; k <= 20; k++) cues.push({ step: stepAt(k * CUE_EVERY_MS, STEP), id: 'ring', index: k });
    const frames: { t: number; activity: string }[] = [];
    const log = playCued('dog', seed, dogNoWalk(), STEP, 20 * CUE_EVERY_MS + CUE_EVERY_MS, cues, (f, i) => {
      frames.push({ t: (i + 1) * STEP, activity: f.activity });
    });
    expect(log.some((e) => e.reaction)).toBe(true);
    for (let i = 1; i < log.length; i++) {
      expect(log[i]?.atMs).toBe((log[i - 1]?.atMs ?? 0) + (log[i - 1]?.durMs ?? 0));
    }
    for (const e of log.filter((x) => x.reaction)) {
      const fr = frames.find((f) => f.t >= e.atMs);
      expect(fr?.activity).toBe(e.activity);
      expect((fr?.t ?? 0) - e.atMs).toBeLessThan(STEP);
    }
  });

  it('a walk delays a reaction until the walk arrives', () => {
    // The dog in era I on its three spots at fps2: a 24 px walk takes 1.5 s, longer than the dog's latency band.
    const seed = behaviourSeed(1, 'dog');
    const ctx = ctxFor('dog', 1, 'fps2', HOME_R);
    // The walk starts (the first walking frame after 5 s, clear of the begin offset) are the cue steps to try.
    const starts: number[] = [];
    let wasWalking = false;
    playCued('dog', seed, ctx, STEP, 20 * MIN, [], (f, i) => {
      if (f.walking && !wasWalking && (i + 1) * STEP > 5000) starts.push(i);
      wasWalking = f.walking;
    });
    expect(starts.length).toBeGreaterThan(0);
    const j = passingIndex(seed);
    let hit: { walkStep: number; log: BehaviourLogEntry[]; frames: { t: number; walking: boolean; activity: string }[] } | undefined;
    for (const s of starts.slice(0, 12)) {
      const frames: { t: number; walking: boolean; activity: string }[] = [];
      const log = playCued('dog', seed, ctx, STEP, 20 * MIN, [{ step: s, id: 'ring', index: j }], (f, i) => {
        frames.push({ t: (i + 1) * STEP, walking: f.walking, activity: f.activity });
      });
      // The reaction needs its lookUp off cooldown: the first walk that gets one is the case.
      if (log.some((e) => e.reaction)) {
        hit = { walkStep: s, log, frames };
        break;
      }
    }
    expect(hit).toBeDefined();
    if (hit === undefined) return;
    const reaction = hit.log.find((e) => e.reaction);
    expect(reaction).toBeDefined();
    if (reaction === undefined) return;
    const tCue = (hit.walkStep + 1) * STEP;
    expect(reaction.atMs - tCue).toBeGreaterThanOrEqual(DOG_LAT[0]);
    // The frames from the cue to the reaction are the walk: the reaction waits for the arrival.
    const during = hit.frames.filter((f) => f.t >= tCue && f.t < reaction.atMs);
    expect(during.length).toBeGreaterThan(0);
    expect(during.every((f) => f.walking && f.activity === 'pace')).toBe(true);
  });

  it('a sleeping dog wakes on ring or rapid after the dog latency band, with no chance gate, and no reaction answers the cue', () => {
    for (const cueId of ['ring', 'rapid'] as const) {
      const seed = behaviourSeed(1, 'dog');
      const ctx = ctxFor('dog', 1, 'fps8', HOME_R, { spots: [] });
      let sleepStep = -1;
      playCued('dog', seed, ctx, STEP, 30 * MIN, [], (f, i) => {
        if (sleepStep < 0 && f.activity === 'sleep' && !f.walking) sleepStep = i;
      });
      expect(sleepStep).toBeGreaterThanOrEqual(0);
      const index = 1;
      const log = playCued('dog', seed, ctx, STEP, 30 * MIN, [{ step: sleepStep, id: cueId, index }, { step: sleepStep + 5, id: cueId, index }]);
      const sleep = log.find((e) => e.activity === 'sleep' && e.atMs <= (sleepStep + 1) * STEP);
      expect(sleep).toBeDefined();
      if (sleep === undefined) continue;
      const due = (sleepStep + 1) * STEP + DOG_LAT[0] + hash01(seed + WORLD_BEHAVIOUR.salts.latency, index) * (DOG_LAT[1] - DOG_LAT[0]);
      expect(sleep.atMs + sleep.durMs).toBeCloseTo(due, 6);
      expect(log.some((e) => e.reaction)).toBe(false);
    }
  });
});

describe('crank mode (T3c)', () => {
  const crankCtx = (over: Partial<BehaviourCtx> = {}): BehaviourCtx => ctxFor('inspector', 1, 'crank', HOME_L, { spots: [], ...over });

  it('changes nothing without clicks: the frame and the snapshot hold over 10 s of steps', () => {
    const seed = behaviourSeed(1, 'inspector');
    const r = createBehaviourRunner('inspector', seed, STUB_CONDUCTOR);
    r.reset(seed, 0, HOME_L);
    const first = { ...r.step(0, crankCtx()) };
    const snap = r.snapshot();
    for (let i = 0; i < 100; i++) {
      const f = r.step(100, crankCtx({ crankSteps: 0 }));
      expect({ ...f }).toEqual(first);
      expect(r.snapshot()).toEqual(snap);
    }
  });

  it('draws exactly one clip frame and takes exactly one hold step per click', () => {
    const seed = behaviourSeed(1, 'inspector');
    const r = createBehaviourRunner('inspector', seed, STUB_CONDUCTOR);
    r.reset(seed, 0, HOME_L);
    r.step(0, crankCtx());
    expect(r.next('write')).toBe(true);
    r.step(0, crankCtx());
    expect(r.snapshot().activity).toBe('write');
    let prevStep = 0;
    let prevSince = r.snapshot().sinceMs;
    for (let c = 1; c <= 10; c++) {
      const f = r.step(100, crankCtx({ crankSteps: 1 }));
      expect(f.activity).toBe('write');
      expect(f.frame).toBe(c % 2 === 0 ? 'write0' : 'write1');
      expect(f.step - prevStep).toBe(1);
      expect(r.snapshot().sinceMs - prevSince).toBe(CRANK_MS);
      prevStep = f.step;
      prevSince = r.snapshot().sinceMs;
    }
  });

  it('advances a walk 8 px per click and arrives within the walk ticks', () => {
    const seed = behaviourSeed(1, 'inspector');
    const timed = ctxFor('inspector', 1, 'fps8', HOME_L);
    const walkCtx = (over: Partial<BehaviourCtx> = {}): BehaviourCtx => ctxFor('inspector', 1, 'crank', HOME_L, over);
    const r = createBehaviourRunner('inspector', seed, STUB_CONDUCTOR);
    r.reset(seed, 0, HOME_L);
    // Settle on the timed clock at a moment that is not a walk (the pin waits for an arrival).
    let settled = false;
    for (let i = 0; i < 4000 && !settled; i++) {
      r.step(100, timed);
      settled = !r.snapshot().walking;
    }
    expect(settled).toBe(true);
    expect(r.next('stroll')).toBe(true);
    const pinned = r.step(0, walkCtx());
    expect(pinned.walking).toBe(true);
    let prevX = pinned.x;
    const deltas: number[] = [];
    for (let c = 0; c < 12; c++) {
      const f = r.step(100, walkCtx({ crankSteps: 1 }));
      deltas.push(Math.abs(f.x - prevX));
      prevX = f.x;
      if (!f.walking) break;
    }
    expect(deltas.length).toBeGreaterThan(0);
    expect(deltas.every((d) => d <= WORLD_WALK.pxPerFrame)).toBe(true);
    expect(deltas.slice(0, -1).every((d) => d === WORLD_WALK.pxPerFrame)).toBe(true);
  });

  it('leaving crank mode runs the timed clock on from the same time', () => {
    const seed = behaviourSeed(1, 'inspector');
    const r = createBehaviourRunner('inspector', seed, STUB_CONDUCTOR);
    r.reset(seed, 0, HOME_L);
    r.step(0, crankCtx());
    r.next('write');
    r.step(0, crankCtx());
    for (let c = 0; c < 5; c++) r.step(100, crankCtx({ crankSteps: 1 }));
    const before = r.snapshot().sinceMs;
    r.step(100, ctxFor('inspector', 1, 'fps4', HOME_L, { spots: [] }));
    expect(r.snapshot().sinceMs - before).toBe(100);
    expect(r.snapshot().activity).toBe('write');
  });
});

describe('the era change (T3c)', () => {
  it('a change to an era with the same free pool keeps the activity sequence (the segment in progress runs out)', () => {
    const seed = behaviourSeed(1, 'inspector');
    const plain = ctxFor('inspector', 1, 'fps4', HOME_L);
    const vented = ctxFor('inspector', 3, 'fps4', HOME_L);
    const logA = playWith('inspector', seed, STEP, 20 * MIN, () => plain);
    const logB = playWith('inspector', seed, STEP, 20 * MIN, (i) => ((i + 1) * STEP < 5 * MIN ? plain : vented));
    expect(logB).toEqual(logA);
  });

  it('after an era change the next picks come from the new era list', () => {
    const seed = behaviourSeed(1, 'dog');
    const era1 = ctxFor('dog', 1, 'fps8', HOME_R);
    const era2 = ctxFor('dog', 2, 'fps8', HOME_R, { holeDig: true });
    const changeAt = 3 * MIN;
    const log = playWith('dog', seed, STEP, 20 * MIN, (i) => ((i + 1) * STEP < changeAt ? era1 : era2));
    expect(log.filter((e) => e.activity === 'dig' && e.atMs < changeAt).length).toBe(0);
    expect(log.filter((e) => e.activity === 'dig' && e.atMs >= changeAt).length).toBeGreaterThan(0);
  });
});

// The conductor's picks over beats 0..n-1: the beat, the id, the set and the end beat of each pick.
interface ConductorPick { beat: number; id: UnisonId; post: boolean; endBeat: number }
function conductorPicks(seed: number, beats: number, stareAt: (i: number) => boolean = () => false,
  downbeatAt: (i: number) => boolean = () => true): ConductorPick[] {
  const c = createUnisonConductor(seed);
  const picks: ConductorPick[] = [];
  for (let i = 0; i < beats; i++) {
    c.step({ downbeat: downbeatAt(i), index: i }, stareAt(i));
    const cur = c.current();
    if (cur.startBeat === i) picks.push({ beat: i, id: cur.id, post: cur.post, endBeat: cur.endBeat });
  }
  return picks;
}
// The item the hash u lands on by cumulative weight (the last takes the rest), as pickWeighted does.
function weightedChoice<T extends { id: string }>(list: readonly T[], u: number, weight: (t: T) => number): T | undefined {
  const total = list.reduce((s, t) => s + weight(t), 0);
  let x = u * total;
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (item === undefined) return undefined;
    if (i === list.length - 1 || x < weight(item)) return item;
    x -= weight(item);
  }
  return undefined;
}

describe('the unison conductor (T3c)', () => {
  it('never repeats an action back to back, never a static one after a static one, and draws the beats in range', () => {
    for (const post of [false, true]) {
      for (const seed of [1, 2, 3, 4, 5]) {
        const picks = conductorPicks(seed, 3000, () => post);
        expect(picks.length).toBeGreaterThan(300);
        const set = post ? WORLD_UNISON.post : WORLD_UNISON.pre;
        picks.forEach((p, i) => {
          const a = set.find((s) => s.id === p.id);
          expect(a).toBeDefined();
          const n = p.endBeat - p.beat;
          expect(n).toBeGreaterThanOrEqual(a?.beats[0] ?? Infinity);
          expect(n).toBeLessThanOrEqual(a?.beats[1] ?? -Infinity);
          const prev = picks[i - 1];
          if (prev === undefined) return;
          expect(p.id).not.toBe(prev.id);
          if (WORLD_UNISON.staticIds.includes(prev.id)) expect(WORLD_UNISON.staticIds.includes(p.id)).toBe(false);
        });
      }
    }
  });

  it('weights the id two picks back by recency2Back (the rule replayed by hand, and the damp changes some picks)', () => {
    let differsWithoutDamp = 0;
    for (const post of [false, true]) {
      for (const seed of [11, 12, 13]) {
        const picks = conductorPicks(seed, 3000, () => post);
        const set = post ? WORLD_UNISON.post : WORLD_UNISON.pre;
        picks.forEach((p, k) => {
          const prev = picks[k - 1];
          if (prev === undefined) return;
          const back2 = k >= 2 ? picks[k - 2]?.id : undefined;
          const prevStatic = WORLD_UNISON.staticIds.includes(prev.id);
          const open = set.filter((a) => a.id !== prev.id && !(prevStatic && WORLD_UNISON.staticIds.includes(a.id)));
          const u = hash01(seed + WORLD_BEHAVIOUR.salts.conductor, 2 * k + 1);
          const damped = weightedChoice(open, u, (a) => a.weight * (a.id === back2 ? WORLD_BEHAVIOUR.recency2Back : 1));
          const plain = weightedChoice(open, u, (a) => a.weight);
          expect(p.id).toBe(damped?.id);
          if (plain?.id !== p.id) differsWithoutDamp++;
        });
      }
    }
    expect(differsWithoutDamp).toBeGreaterThan(0);
  });

  it('switches only on downbeats, and acts once per beat index', () => {
    const picks = conductorPicks(7, 800, () => false, (i) => i % 2 === 0);
    expect(picks.length).toBeGreaterThan(50);
    for (const p of picks) expect(p.beat % 2).toBe(0);
    const c = createUnisonConductor(7);
    c.step({ downbeat: true, index: 0 }, false);
    const before = c.current();
    c.step({ downbeat: true, index: 0 }, true);
    c.step({ downbeat: true, index: 0 }, false);
    expect(c.current()).toEqual(before);
  });

  it('replays the same actions for the same seed, and other actions for another seed', () => {
    const sig = (seed: number): string[] => conductorPicks(seed, 500).map((p) => `${p.beat}:${p.id}:${p.endBeat}`);
    const a = sig(21);
    expect(sig(21)).toEqual(a);
    expect(sig(22)).not.toEqual(a);
  });

  it('uses the pre set until the stare, and switches at once on the next downbeat when the set flips', () => {
    const c = createUnisonConductor(5);
    c.step({ downbeat: true, index: 0 }, false);
    expect(WORLD_UNISON.pre.some((a) => a.id === c.current().id)).toBe(true);
    expect(c.current().post).toBe(false);
    c.step({ downbeat: false, index: 1 }, true);
    expect(c.current().startBeat).toBe(0);
    c.step({ downbeat: true, index: 2 }, true);
    expect(c.current().startBeat).toBe(2);
    expect(c.current().post).toBe(true);
    expect(WORLD_UNISON.post.some((a) => a.id === c.current().id)).toBe(true);
  });

  it('next() pins the action at the next downbeat, and refuses an id outside the active set', () => {
    const c = createUnisonConductor(9);
    c.step({ downbeat: true, index: 0 }, false);
    expect(c.next('stare')).toBe(false);
    expect(c.next('look')).toBe(true);
    c.step({ downbeat: false, index: 1 }, false);
    expect(c.current().startBeat).toBe(0);
    c.step({ downbeat: true, index: 2 }, false);
    expect(c.current().id).toBe('look');
    expect(c.current().startBeat).toBe(2);
    c.step({ downbeat: true, index: 3 }, true);
    expect(c.next('stare')).toBe(true);
    expect(c.next('look')).toBe(false);
    c.step({ downbeat: true, index: 4 }, true);
    expect(c.current().id).toBe('stare');
    expect(c.current().startBeat).toBe(4);
  });

  // The first id of list a that list b does not have (an id of a's own), read from the data.
  const ownId = (a: readonly { id: UnisonId }[], b: readonly { id: UnisonId }[]): UnisonId => {
    const id = a.find((x) => !b.some((y) => y.id === x.id))?.id;
    if (id === undefined) throw new Error('the set has no id of its own');
    return id;
  };
  const postOnly = ownId(WORLD_UNISON.post, WORLD_UNISON.pre);
  const preOnly = ownId(WORLD_UNISON.pre, WORLD_UNISON.post);

  it('validates next() against the set the stare shows now, inside one beat window (pre to post)', () => {
    const c = createUnisonConductor(41);
    c.step({ downbeat: true, index: 10 }, false);
    c.step({ downbeat: false, index: 10 }, true);
    expect(c.next(preOnly)).toBe(false);
    expect(c.next(postOnly)).toBe(true);
  });

  it('takes a pin made after a flip inside one beat window at the next downbeat, with the new set', () => {
    const c = createUnisonConductor(41);
    c.step({ downbeat: true, index: 10 }, false);
    c.step({ downbeat: false, index: 10 }, true);
    expect(c.next(postOnly)).toBe(true);
    expect(c.current().startBeat).toBe(10);
    expect(c.current().post).toBe(false);
    c.step({ downbeat: true, index: 11 }, true);
    expect(c.current().id).toBe(postOnly);
    expect(c.current().post).toBe(true);
    expect(c.current().startBeat).toBe(11);
  });

  it('flips the other way too: a post-to-pre flip inside one beat window validates against the pre set', () => {
    const c = createUnisonConductor(42);
    c.step({ downbeat: true, index: 10 }, true);
    c.step({ downbeat: false, index: 10 }, false);
    expect(c.next(postOnly)).toBe(false);
    expect(c.next(preOnly)).toBe(true);
    c.step({ downbeat: true, index: 11 }, false);
    expect(c.current().id).toBe(preOnly);
    expect(c.current().post).toBe(false);
    expect(c.current().startBeat).toBe(11);
  });

  it('is idempotent per beat index: a repeated step with the same index and set takes no pick', () => {
    const seed = 31;
    const plain = conductorPicks(seed, 400, () => false);
    expect(plain.length).toBeGreaterThan(50);
    const c = createUnisonConductor(seed);
    const twice: ConductorPick[] = [];
    for (let i = 0; i < 400; i++) {
      c.step({ downbeat: true, index: i }, false);
      const before = c.current();
      c.step({ downbeat: true, index: i }, false);
      expect(c.current()).toEqual(before);
      if (before.startBeat === i) twice.push({ beat: i, id: before.id, post: before.post, endBeat: before.endBeat });
    }
    expect(twice).toEqual(plain);
    c.reset(seed);
    const replay: ConductorPick[] = [];
    for (let i = 0; i < 400; i++) {
      c.step({ downbeat: true, index: i }, false);
      const cur = c.current();
      if (cur.startBeat === i) replay.push({ beat: i, id: cur.id, post: cur.post, endBeat: cur.endBeat });
    }
    expect(replay).toEqual(plain);
  });

  it('refuses an id that is in neither set, before and after a flip', () => {
    const c = createUnisonConductor(43);
    const ghost: string = 'nope';
    c.step({ downbeat: true, index: 0 }, false);
    expect(c.next(ghost as UnisonId)).toBe(false);
    c.step({ downbeat: false, index: 0 }, true);
    expect(c.next(ghost as UnisonId)).toBe(false);
  });
});

// ---- Era IV through the runners: one shared conductor, the TIER_HEARTBEAT beats (one downbeat per beat). ----
interface IvSnap { activity: string; frame: string; x: number; walking: boolean; risePx: number; flip: boolean; alpha: number; step: number }
interface IvStep { t: number; index: number; downbeat: boolean; cond: UnisonAct; snaps: Record<BehaviourActor, IvSnap> }
interface IvOpts {
  dtMs: number; totalMs: number; eraAt?: number; endAt?: number; postAt?: number; reduced?: boolean; seed?: number; noSpots?: boolean;
  logs?: Record<BehaviourActor, BehaviourLogEntry[]>; visit?: (s: IvStep) => void;
}
// Plays the four runners with one conductor. Era IV from the start, or era III before eraAt, or era V from endAt. The stare from postAt.
function playIv(o: IvOpts): void {
  const conductor = createUnisonConductor(o.seed ?? 1);
  const runners = ACTORS.map((a) => {
    const log = o.logs?.[a];
    const r = createBehaviourRunner(a, behaviourSeed(1, a), conductor, log !== undefined ? (e) => log.push(e) : undefined);
    r.reset(behaviourSeed(1, a), 0, IV_HOME[a]);
    return r;
  });
  const steps = Math.round(o.totalMs / o.dtMs);
  let prevIndex = -1;
  for (let i = 0; i < steps; i++) {
    const t = (i + 1) * o.dtMs;
    const index = Math.floor(t / BEAT);
    const downbeat = index !== prevIndex;
    prevIndex = index;
    const beat = { downbeat, index };
    const era: WorldEra = o.eraAt !== undefined && t < o.eraAt ? 3 : o.endAt !== undefined && t >= o.endAt ? 5 : 4;
    const stare = o.postAt !== undefined && t >= o.postAt;
    const snaps = {} as Record<BehaviourActor, IvSnap>;
    ACTORS.forEach((a, j) => {
      const r = runners[j];
      if (r === undefined) return;
      const over: Partial<BehaviourCtx> = { beat, stare, reduced: o.reduced === true, girlStage: 'ground', cues: [] };
      if (o.noSpots === true) over.spots = [];
      const f = r.step(o.dtMs, ctxFor(a, era, 'fps8', IV_HOME[a], over));
      snaps[a] = { activity: f.activity, frame: f.frame, x: f.x, walking: f.walking, risePx: f.risePx, flip: f.flip, alpha: f.alpha, step: f.step };
    });
    o.visit?.({ t, index, downbeat, cond: conductor.current(), snaps });
  }
}

describe('era IV: the runners follow the conductor (T3c)', () => {
  it('all four runners show the conductor action on the same downbeat, with its mapped frames', () => {
    const allowed = (a: BehaviourActor, post: boolean, id: UnisonId): Set<string> => {
      const clip = WORLD_UNISON.map[post ? 'post' : 'pre'][a][id];
      const out = new Set<string>(clip?.frames ?? []);
      if (clip?.accent !== undefined) out.add(clip.accent);
      if (clip?.walkFirst === true) ['walk0', 'walk1', 'walk2', 'walk3'].forEach((w) => out.add(w));
      return out;
    };
    let steps = 0;
    playIv({
      dtMs: STEP, totalMs: MIN, visit: (s) => {
        steps++;
        for (const a of ACTORS) {
          const sn = s.snaps[a];
          expect(sn.activity).toBe(s.cond.id);
          if (!sn.walking) expect(allowed(a, s.cond.post, s.cond.id).has(sn.frame)).toBe(true);
        }
      },
    });
    expect(steps).toBeGreaterThan(0);
  });

  it('joins within three beats of the era change (an in-progress walk finishes first)', () => {
    const T0 = 40000;
    const join = new Map<BehaviourActor, number>();
    const walkingAtChange = new Map<BehaviourActor, boolean>();
    playIv({
      dtMs: STEP, totalMs: 60000, eraAt: T0, visit: (s) => {
        for (const a of ACTORS) {
          if (s.t === T0 - STEP) walkingAtChange.set(a, s.snaps[a].walking);
          if (s.t >= T0 && !join.has(a) && s.snaps[a].activity === s.cond.id) join.set(a, s.t);
        }
      },
    });
    for (const a of ACTORS) {
      const at = join.get(a);
      expect(at).toBeDefined();
      const slack = walkingAtChange.get(a) === true ? BEAT : 0;
      expect((at ?? Infinity) - T0).toBeLessThanOrEqual(3 * BEAT + slack);
    }
  });

  it('shows the accent frame only inside the accent window after a downbeat (the Inspector still)', () => {
    const accentMs = WORLD_ERA_ENV.accentMs;
    let lastDown = -Infinity;
    let checked = 0;
    playIv({
      dtMs: STEP, totalMs: 3 * MIN, visit: (s) => {
        if (s.downbeat) lastDown = s.t;
        const sn = s.snaps.inspector;
        if (sn.activity !== 'still') return;
        expect(sn.frame === 'write0').toBe(s.t - lastDown < accentMs);
        checked++;
      },
    });
    expect(checked).toBeGreaterThan(0);
  });

  it('lifts the crow in the accent window (still, pulse), keeps the rise constant, and lifts nobody else', () => {
    const rise = WORLD_ERA_ENV.riseWorldPx;
    const accentMs = WORLD_ERA_ENV.accentMs;
    let lastDown = -Infinity;
    let pulses = 0;
    let rises = 0;
    playIv({
      dtMs: STEP, totalMs: 3 * MIN, visit: (s) => {
        if (s.downbeat) lastDown = s.t;
        const crow = s.snaps.crow;
        if (crow.activity === 'still') {
          expect(crow.risePx).toBe(s.t - lastDown < accentMs ? rise : 0);
          pulses++;
        }
        for (const a of ACTORS) {
          const sn = s.snaps[a];
          if (sn.activity === 'rise' && !sn.walking) {
            expect(sn.risePx).toBe(rise);
            rises++;
          } else if (sn.activity !== 'still') {
            expect(sn.risePx).toBe(0);
          }
        }
      },
    });
    expect(pulses).toBeGreaterThan(0);
    expect(rises).toBeGreaterThan(0);
  });

  it('steps the perBeat frames once per downbeat, by the beat count since the action start', () => {
    let checked = 0;
    playIv({
      dtMs: STEP, totalMs: 3 * MIN, visit: (s) => {
        if (!s.downbeat) return;
        for (const a of ACTORS) {
          const sn = s.snaps[a];
          const clip = WORLD_UNISON.map[s.cond.post ? 'post' : 'pre'][a][s.cond.id];
          if (clip?.perBeat !== true || sn.walking || sn.activity !== s.cond.id) continue;
          const n = clip.frames.length;
          expect(sn.frame).toBe(clip.frames[(((s.index - s.cond.startBeat) % n) + n) % n]);
          checked++;
        }
      },
    });
    expect(checked).toBeGreaterThan(0);
  });

  it('switches every action on a downbeat, over 60 min of 2.4 s beats', () => {
    const logs = { inspector: [], dog: [], crow: [], girl: [] } as Record<BehaviourActor, BehaviourLogEntry[]>;
    let switches = 0;
    let offBeat = 0;
    let lastStart = -1;
    playIv({
      dtMs: STEP, totalMs: 60 * MIN, logs, visit: (s) => {
        if (s.cond.startBeat === lastStart) return;
        lastStart = s.cond.startBeat;
        switches++;
        if (!s.downbeat) offBeat++;
      },
    });
    expect(switches).toBeGreaterThan(200);
    expect(offBeat).toBe(0);
    for (const a of ACTORS) {
      expect(logs[a].length).toBeGreaterThan(100);
      for (const e of logs[a]) {
        expect(e.reaction).toBe(false);
        expect(e.atMs === STEP || e.atMs % BEAT === 0).toBe(true);
      }
    }
  });

  it('keeps every rest frame of the post-observer actions in WORLD_STARE_SAFE (the stare)', () => {
    let checked = 0;
    playIv({
      dtMs: STEP, totalMs: 10 * MIN, postAt: 0, visit: (s) => {
        if (!s.cond.post) return;
        for (const a of ACTORS) {
          const sn = s.snaps[a];
          if (sn.walking || sn.activity !== s.cond.id) continue;
          expect(WORLD_STARE_SAFE[a]).toContain(sn.frame);
          checked++;
        }
      },
    });
    expect(checked).toBeGreaterThan(0);
  });

  it('lets only the Inspector walk, on the first downbeat of sway or beat, and never a dog, crow or girl', () => {
    let walks = 0;
    const was: Record<BehaviourActor, boolean> = { inspector: false, dog: false, crow: false, girl: false };
    playIv({
      dtMs: STEP, totalMs: 20 * MIN, visit: (s) => {
        for (const a of ACTORS) {
          const sn = s.snaps[a];
          if (a !== 'inspector') expect(sn.walking).toBe(false);
          if (sn.walking && !was[a]) {
            walks++;
            expect(s.downbeat).toBe(true);
            expect(s.cond.startBeat).toBe(s.index);
            expect(['sway', 'beat']).toContain(s.cond.id);
          }
          was[a] = sn.walking;
        }
      },
    });
    expect(walks).toBeGreaterThan(0);
  });

  it('keeps the accents under reduced motion, and walks at most once per reducedWalkGapMs', () => {
    const walkStarts: number[] = [];
    let accents = 0;
    let prev = false;
    playIv({
      dtMs: STEP, totalMs: 6 * MIN, reduced: true, visit: (s) => {
        const sn = s.snaps.inspector;
        if (sn.walking && !prev) walkStarts.push(s.t);
        prev = sn.walking;
        if (sn.frame === 'write0') accents++;
      },
    });
    expect(accents).toBeGreaterThan(0);
    for (let i = 1; i < walkStarts.length; i++) {
      expect((walkStarts[i] ?? 0) - (walkStarts[i - 1] ?? 0)).toBeGreaterThanOrEqual(WORLD_WALK.reducedWalkGapMs);
    }
  });

  it('leaving era IV plays the joined action out, then the normal path resumes in era V', () => {
    const bad: string[] = [];
    playIv({
      dtMs: STEP, totalMs: 60000, endAt: 20000, visit: (s) => {
        if (s.t < 20000 + MIN / 3) return;
        for (const a of ACTORS) {
          const ids = WORLD_REPERTOIRE[a][5]?.map((x) => x.id) ?? [];
          const act = s.snaps[a].activity;
          if (!ids.includes(act)) bad.push(`${a}:${act}@${s.t}`);
        }
      },
    });
    expect(bad).toEqual([]);
  });
});

// ---- WP24 r1 (review round 0): the era IV entry, the stale segments, reduced motion, the settle, the clock and the exports. ----
// The beat of each step from the clock: step i reads (i + 1) x dt, and the downbeat is the first step of each beat index. Call in order.
interface BeatStep { downbeat: boolean; index: number }
function beatsOf(dtMs: number): (i: number) => BeatStep {
  let prev = -1;
  return (i: number): BeatStep => {
    const index = Math.floor(((i + 1) * dtMs) / BEAT);
    const downbeat = index !== prev;
    prev = index;
    return { downbeat, index };
  };
}
// The sheet a frame of an actor must come from: the girl's mini stage draws from the mini sheet, everything else from the actor's own.
function sheetOf(actor: BehaviourActor, girlStage: BehaviourCtx['girlStage']): readonly string[] {
  return actor === 'girl' && girlStage === 'mini' ? WORLD_FRAMES.girlMini : WORLD_FRAMES[actor];
}

// The girl from era 3 (the mini stage, the vents on) to era 4 (the ground stage) at switchMs, for totalMs. Returns each step's stage and frame.
function playGirlSwitch(switchMs: number, dtMs: number, totalMs: number): { ground: boolean; frame: string }[] {
  const seed = behaviourSeed(1, 'girl');
  const r = createBehaviourRunner('girl', seed, createUnisonConductor(seed));
  r.reset(seed, 0, HOME_R);
  const beats = beatsOf(dtMs);
  const out: { ground: boolean; frame: string }[] = [];
  const steps = Math.round(totalMs / dtMs);
  for (let i = 0; i < steps; i++) {
    const ground = (i + 1) * dtMs >= switchMs;
    const ctx = ctxFor('girl', ground ? 4 : 3, 'fps8', HOME_R, { girlStage: ground ? 'ground' : 'mini', beat: beats(i) });
    const f = r.step(dtMs, ctx);
    out.push({ ground, frame: f.frame });
  }
  return out;
}

describe('era IV entry for the girl (WP24 r1 A): no stale mini frame on the ground sheet', () => {
  it('draws only mini frames in the mini stage and only ground frames after the era IV switch, at 40 switch times', () => {
    const bad: string[] = [];
    let minis = 0;
    let grounds = 0;
    for (let s = 0; s < 40; s++) {
      const switchMs = 90000 + s * 250;
      const frames = playGirlSwitch(switchMs, 100, switchMs + 120000);
      for (const { ground, frame } of frames) {
        const sheet = sheetOf('girl', ground ? 'ground' : 'mini');
        if (frame !== '' && !sheet.includes(frame)) bad.push(`switch ${s}: ${frame} (ground ${ground})`);
        if (!ground && frame !== '') minis += 1;
        if (ground && frame !== '') grounds += 1;
      }
    }
    expect(bad).toEqual([]);
    expect(minis).toBeGreaterThan(0);
    expect(grounds).toBeGreaterThan(0);
  });
});

describe('the frames of every actor and era come from its own sheet (WP24 r1 A)', () => {
  it('draws only sheet frames for 10 min, stare on and off, in eras 1-5 (the girl in both of her stages before era IV)', () => {
    const bad: string[] = [];
    for (const actor of ACTORS) {
      for (const era of [1, 2, 3, 4, 5] as const) {
        const stages: BehaviourCtx['girlStage'][] = actor === 'girl' && era < 4 ? ['mini', 'ground'] : ['ground'];
        for (const stage of stages) {
          for (const stare of [false, true]) {
            const seed = behaviourSeed(1, actor);
            const r = createBehaviourRunner(actor, seed, createUnisonConductor(seed));
            r.reset(seed, 0, IV_HOME[actor]);
            const beats = beatsOf(STEP);
            const sheet = sheetOf(actor, stage);
            const steps = Math.round((10 * MIN) / STEP);
            for (let i = 0; i < steps; i++) {
              const f = r.step(STEP, ctxFor(actor, era, 'fps8', IV_HOME[actor], { girlStage: stage, stare, beat: beats(i) }));
              if (f.frame !== '' && !sheet.includes(f.frame)) bad.push(`${actor} era ${era} ${stage} stare ${stare}: ${f.frame}`);
            }
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

// One Inspector: era 3 (fps4) with a walk in progress at the switch (a pinned stroll, then `extra` more walking steps), then era 4 for
// afterMs. Returns the drawn x of every step from the last era 3 step on, whether the walk was in progress at the switch, and the
// activity at the end.
function walkAcrossSwitch(dtMs: number, extra: number, afterMs: number): { xs: number[]; walking: boolean; activity: string } {
  const seed = behaviourSeed(1, 'inspector');
  const r = createBehaviourRunner('inspector', seed, createUnisonConductor(seed));
  r.reset(seed, 0, HOME_L);
  const beats = beatsOf(dtMs);
  let i = 0;
  const stepEra3 = (): BehaviourFrame => {
    const f = r.step(dtMs, ctxFor('inspector', 3, 'fps4', HOME_L, { beat: beats(i) }));
    i += 1;
    return f;
  };
  stepEra3();
  r.next('stroll');
  let last = stepEra3();
  for (let guard = 0; !r.snapshot().walking && guard < 400; guard++) last = stepEra3();
  for (let k = 0; k < extra; k++) last = stepEra3();
  const walking = r.snapshot().walking;
  const xs = [last.x];
  const steps = Math.round(afterMs / dtMs);
  for (let k = 0; k < steps; k++) {
    const f = r.step(dtMs, ctxFor('inspector', 4, 'fps4', HOME_L, { beat: beats(i) }));
    i += 1;
    xs.push(f.x);
  }
  return { xs, walking, activity: r.snapshot().activity };
}

describe('the era IV entry for the Inspector (WP24 r1 B): the walk goes on and the join does not jump', () => {
  it('keeps every step within one walk tick (2 ticks at 250 ms) across the switch, the join and 30 s after, at each switch offset', () => {
    for (const dt of [16.7, 100, 250]) {
      const maxStep = WORLD_WALK.pxPerFrame * (dt === 250 ? 2 : 1);
      // The offsets inside the walk: about 45 steps at 16.7 ms, 7 at 100 ms, 2 at 250 ms.
      const span = dt === 16.7 ? 40 : dt === 100 ? 6 : 2;
      for (let trial = 0; trial < 40; trial++) {
        const { xs, walking, activity } = walkAcrossSwitch(dt, trial % span, 30000 + 4 * BEAT);
        expect(walking, `dt ${dt} trial ${trial}: the walk is in progress at the switch`).toBe(true);
        expect(activity, `dt ${dt} trial ${trial}: joined`).not.toBe('parked');
        const bad: string[] = [];
        for (let j = 1; j < xs.length; j++) {
          const step = Math.abs((xs[j] ?? 0) - (xs[j - 1] ?? 0));
          if (step > maxStep) bad.push(`step ${j}: ${step} px`);
        }
        expect(bad, `dt ${dt} trial ${trial}`).toEqual([]);
      }
    }
  });
});

describe('reduced motion holds the crow in one pose (WP24 r1 C)', () => {
  it('draws the crow at its home x under reduced motion in eras 2, 3 and 5, and keeps its offsets without it', () => {
    for (const era of [2, 3, 5] as const) {
      const seed = behaviourSeed(1, 'crow');
      const reducedX: number[] = [];
      const plainX = new Set<number>();
      playRunner('crow', seed, ctxFor('crow', era, 'fps8', HOME_R, { reduced: true }), 100, 10 * MIN, { visit: (f) => reducedX.push(f.x) });
      playRunner('crow', seed, ctxFor('crow', era, 'fps8', HOME_R), 100, 10 * MIN, { visit: (f) => plainX.add(f.x) });
      expect(reducedX.length).toBeGreaterThan(0);
      expect(reducedX.every((x) => x === HOME_R), `era ${era} reduced`).toBe(true);
      expect([...plainX].some((x) => x !== HOME_R), `era ${era} plain offsets`).toBe(true);
    }
  });
});

describe('settle (WP24 r1 D, C7 worldSettle): every runner parks on its rest frame at home', () => {
  it('returns the same rest frame, step 0 and x at home for 30 s, for every actor in eras 1-5 (stare off and on), then resumes', () => {
    for (const actor of ACTORS) {
      for (const era of [1, 2, 3, 4, 5] as const) {
        for (const stare of [false, true]) {
          const seed = behaviourSeed(1, actor);
          const r = createBehaviourRunner(actor, seed, createUnisonConductor(seed));
          r.reset(seed, 0, IV_HOME[actor]);
          const beats = beatsOf(250);
          const settled: BehaviourFrame[] = [];
          for (let i = 0; i < 120; i++) {
            beats(i);
            const f = r.step(250, ctxFor(actor, era, 'fps8', IV_HOME[actor], { settle: true, stare }));
            settled.push({ ...f });
          }
          const rest = settled[0];
          expect(rest?.activity, `${actor} era ${era} stare ${stare}`).toBe('settled');
          const restFrame = rest?.frame ?? '';
          expect(sheetOf(actor, 'ground').includes(restFrame) || sheetOf(actor, 'mini').includes(restFrame)).toBe(true);
          for (const f of settled) {
            expect(f).toEqual(rest);
            expect(f.step).toBe(0);
            expect(f.x).toBe(IV_HOME[actor]);
            expect(f.walking).toBe(false);
          }
          // Settle off: the same runner resumes its activity (the frames change again).
          const after: BehaviourFrame[] = [];
          for (let i = 120; i < 360; i++) {
            const f = r.step(250, ctxFor(actor, era, 'fps8', IV_HOME[actor], { stare, beat: beats(i) }));
            after.push({ ...f });
          }
          expect(after.some((f) => f.activity !== 'settled'), `${actor} era ${era} resume`).toBe(true);
          expect(new Set(after.map((f) => `${f.activity}|${f.frame}|${f.x}|${f.risePx}`)).size, `${actor} era ${era} changes`).toBeGreaterThan(1);
        }
      }
    }
  });

  it('parks the girl in the window stage as before (no rest frame, no picks)', () => {
    const seed = behaviourSeed(1, 'girl');
    const r = createBehaviourRunner('girl', seed, STUB_CONDUCTOR);
    r.reset(seed, 0, HOME_R);
    const f = r.step(250, ctxFor('girl', 1, 'fps8', HOME_R, { settle: true, girlStage: 'window' }));
    expect(f.activity).toBe('parked');
    expect(f.frame).toBe('');
    expect(f.x).toBe(HOME_R);
    expect(r.snapshot().clockMs).toBe(0);
  });
});

describe('the runner clock in the snapshot (WP24 r1)', () => {
  it('advances by dt on unpaused steps and holds while paused, settled or on demo hold', () => {
    const seed = behaviourSeed(1, 'inspector');
    const r = createBehaviourRunner('inspector', seed, STUB_CONDUCTOR);
    r.reset(seed, 0, HOME_L);
    const ctx = ctxFor('inspector', 1, 'fps4', HOME_L);
    for (let i = 1; i <= 10; i++) {
      r.step(100, ctx);
      expect(r.snapshot().clockMs).toBe(i * 100);
    }
    const at = r.snapshot().clockMs;
    r.step(100, { ...ctx, paused: true });
    expect(r.snapshot().clockMs).toBe(at);
    r.step(100, { ...ctx, settle: true });
    expect(r.snapshot().clockMs).toBe(at);
    r.step(100, { ...ctx, demoHold: true });
    expect(r.snapshot().clockMs).toBe(at);
    r.step(100, ctx);
    expect(r.snapshot().clockMs).toBe(at + 100);
  });

  it('holds at zero for a parked girl (the window stage: no picks, no clock)', () => {
    const seed = behaviourSeed(1, 'girl');
    const r = createBehaviourRunner('girl', seed, STUB_CONDUCTOR);
    r.reset(seed, 0, HOME_R);
    for (let i = 0; i < 10; i++) r.step(100, ctxFor('girl', 1, 'fps4', HOME_R, { girlStage: 'window' }));
    expect(r.snapshot().clockMs).toBe(0);
  });
});

describe('exports for the director and the metrics (WP24 r1)', () => {
  it('restFlip faces a profile rest frame of a left-wing actor away from the machine, and never flips a camera-facing, crow or girl frame', () => {
    expect(restFlip('inspector', 'idleA', false, MACHINE_ANCHOR.x - 100)).toBe(true);
    expect(restFlip('inspector', 'idleA', false, MACHINE_ANCHOR.x + 100)).toBe(false);
    expect(restFlip('dog', 'sit0', false, HOME_R)).toBe(false);
    expect(restFlip('inspector', 'front', true, MACHINE_ANCHOR.x - 100)).toBe(false);
    expect(restFlip('crow', 'perch0', false, MACHINE_ANCHOR.x - 100)).toBe(false);
    expect(restFlip('girl', 'stand0', false, MACHINE_ANCHOR.x - 100)).toBe(false);
  });

  it('cycleSeedOf is the seed plus the cycle salt times the cycle plus the conductor salt', () => {
    expect(cycleSeedOf(0)).toBe(WORLD_BEHAVIOUR.seed + WORLD_BEHAVIOUR.salts.conductor);
    expect(cycleSeedOf(3)).toBe(WORLD_BEHAVIOUR.seed + 3 * WORLD_BEHAVIOUR.cycleSalt + WORLD_BEHAVIOUR.salts.conductor);
    expect(cycleSeedOf(2) - cycleSeedOf(1)).toBe(WORLD_BEHAVIOUR.cycleSalt);
  });
});

// ---- The draw memo, the cached hold walk and the spot sync (WP24 r3-F1): the walk frames, the hold walk against its reference, the frames
// for any step size, and a re-home that clears the memo. ----
describe('walk frames and the cached hold walk (WP24 r3-F1)', () => {
  it('plays walk0..walk3 forward and walk3..walk0 reversed, cycling by the drawn tick', () => {
    const ticks = [0, 1, 2, 3, 4, 5, 6, 7];
    expect(ticks.map((t) => walkFrameOf(t, false))).toEqual(['walk0', 'walk1', 'walk2', 'walk3', 'walk0', 'walk1', 'walk2', 'walk3']);
    expect(ticks.map((t) => walkFrameOf(t, true))).toEqual(['walk3', 'walk2', 'walk1', 'walk0', 'walk3', 'walk2', 'walk1', 'walk0']);
  });

  // The reference: the loop of frameHoldIndex as it was before the cached walk (a copy kept here, not imported).
  const oldHoldIndex = (range: readonly [number, number], n: number, e: number, seed: number, k: number): number => {
    let at = 0;
    for (let j = 0; ; j++) {
      const hold = range[0] + hash01(seed + k, j) * (range[1] - range[0]);
      if (e < at + hold || !(hold > 0)) return j % n;
      at += hold;
    }
  };
  // The frameHoldMs range of an activity in the data (the first era that has it).
  const holdRangeOf = (actor: BehaviourActor, id: string): readonly [number, number] => {
    for (const era of [1, 2, 3, 4, 5] as const) {
      const range = activityOf(actor, era, id)?.clip.frameHoldMs;
      if (range !== undefined) return range;
    }
    throw new Error(`${actor} ${id} has no frameHoldMs`);
  };

  it('matches the loop of frameHoldIndex and the cached walk for random e, streams and ranges, moving on and back', () => {
    const ranges = [holdRangeOf('crow', 'stutter'), holdRangeOf('girl', 'flicker'), holdRangeOf('crow', 'tipTry')];
    let checked = 0;
    ranges.forEach((range, ri) => {
      for (let s = 0; s < 12; s++) {
        const seed = behaviourSeed(s + 1, 'crow');
        const n = 2 + (s % 3);
        const walk = newHoldWalk();
        let e = 0;
        for (let i = 0; i < 600; i++) {
          const r = hash01(seed + ri, i);
          // Mostly forward (the clip time), now and then back (a seek starts the walk over).
          e = r < 0.05 ? e * r : e + r * 120;
          const k = s * 7 + Math.floor(i / 150);
          const got = frameHoldWalk(walk, range, n, e, seed, k);
          expect(got, `e ${e} stream ${seed + k}`).toBe(oldHoldIndex(range, n, e, seed, k));
          expect(frameHoldIndex(range, n, e, seed, k)).toBe(got);
          checked += 1;
        }
      }
    });
    expect(checked).toBe(ranges.length * 12 * 600);
  });
});

describe('the draw memo: the same frames for any step size (WP24 r3-F1)', () => {
  // The schedule of one actor: 240 one-second blocks. fps2, then fps4, then fps8; the stare from block 60 to 150; a re-home to the right of
  // the machine at block 90; a crank stretch with clicks from block 120 to 150; the timed clock again; era III with the vents from block 180.
  interface Block { ctx: BehaviourCtx; rehome: number | undefined }
  const BLOCKS = 240;
  function scheduleOf(actor: BehaviourActor): Block[] {
    const out: Block[] = [];
    let homeX = HOME_L;
    for (let m = 0; m < BLOCKS; m++) {
      const crank = m >= 120 && m < 150;
      const era: WorldEra = m >= 180 ? 3 : 2;
      const mode: PlaybackMode = crank ? 'crank' : m < 30 ? 'fps2' : m < 60 ? 'fps4' : 'fps8';
      const rehome = m === 90 ? HOME_R : undefined;
      if (rehome !== undefined) homeX = rehome;
      const crankSteps = crank ? 1 + (m % 3) : 0;
      out.push({ ctx: ctxFor(actor, era, mode, homeX, { stare: m >= 60 && m < 150, crankSteps }), rehome });
    }
    return out;
  }
  // One sample per block: the activity, the frame name and x at the block end. A timed block steps by dtMs (the last step lands on the
  // block end); a crank block is one step (the crank ignores dt; its clicks are in the context).
  interface Sample { activity: string; frame: string; x: number }
  function samplesOf(actor: BehaviourActor, seed: number, dtMs: number): Sample[] {
    const r = createBehaviourRunner(actor, seed, STUB_CONDUCTOR);
    r.reset(seed, 0, HOME_L);
    const out: Sample[] = [];
    for (const block of scheduleOf(actor)) {
      if (block.rehome !== undefined) r.rehome(block.rehome);
      let f: BehaviourFrame | undefined;
      if (block.ctx.mode === 'crank') {
        f = r.step(dtMs, block.ctx);
      } else {
        let left = 1000;
        while (left > 1e-9) {
          const dt = Math.min(dtMs, left);
          f = r.step(dt, block.ctx);
          left -= dt;
        }
      }
      if (f === undefined) throw new Error('a block without a step');
      out.push({ activity: f.activity, frame: f.frame, x: f.x });
    }
    return out;
  }

  for (const actor of ACTORS) {
    it(`${actor}: the same frame and x at every block end for dt 16.7 and dt 100 (walks, holds, crank, re-home, era change)`, () => {
      const seed = behaviourSeed(2, actor);
      const fine = samplesOf(actor, seed, 16.7);
      const coarse = samplesOf(actor, seed, 100);
      expect(fine.length).toBe(BLOCKS);
      fine.forEach((s, i) => expect(s, `block ${i}`).toEqual(coarse[i]));
      expect(new Set(fine.map((s) => s.activity)).size).toBeGreaterThan(1);
    });
  }
});

describe('a re-home after the memo (WP24 r3-F1)', () => {
  it('after rehome(newX) the next frame stands on the new spot, mid-hold and mid-walk alike', () => {
    for (const midWalk of [false, true]) {
      const seed = behaviourSeed(1, 'dog');
      const r = createBehaviourRunner('dog', seed, STUB_CONDUCTOR);
      r.reset(seed, 0, HOME_L);
      const near = ctxFor('dog', 1, 'fps8', HOME_L, { reduced: true });
      let f = r.step(50, near);
      for (let i = 0; i < 8000 && f.walking !== midWalk; i++) f = r.step(50, near);
      expect(f.walking, `mid-walk ${midWalk}`).toBe(midWalk);
      r.rehome(HOME_R);
      const after = r.step(1, ctxFor('dog', 1, 'fps8', HOME_R, { reduced: true }));
      expect(after.x).toBe(HOME_R);
      expect(after.walking).toBe(false);
    }
  });
});

// Tests for the behaviour scheduler (WP24 T3a): the hash and seed helpers, the draw index start (k0), the stare map, looks (key, first,
// last, static), visible change gaps, caps, hold clips, the 'when' conditions and the eligible lists, the pick rule over the real
// repertoire (no A to A except a merge, no walk after a walk, cooldowns, travel filters, hold and static run caps, the crow's glitch
// share and run, WP27 D5), the fallback chain with small pools and the micro fallback (WP28b: no id twice in a row), the spot travel (walk
// time, previous spot damp), startSeg, the follow and recency odds, and determinism. Pure maths, fixed seeds. Structure and canon only: the numbers come from the data and are never pinned here. The timed runner (T3b): dt invariance, A to A, the per-step walk and facing rules, pause, rehome, pins, parking, clip frame timing, emits, the seam and reduced motion. T3c: cues and reactions (bands, chance, pair cooldown, walks, wakes), crank mode, the era change, the unison conductor, and the era IV runner path (join, accents, rises, perBeat, downbeats, the stare, walks, leaving).
import { describe, it, expect } from 'vitest';
import {
  activityLook, behaviourK0, behaviourSeed, capOf, condHolds, createBehaviourRunner, createUnisonConductor, createWalkGate, eligible,
  findOuterOf, findSidesOf, frameHoldIndex, frameHoldWalk, hash01, holdClip, cycleSeedOf, newHoldWalk, newMemory, noteWalkFrame, pickNext,
  createStartGate, reactionRepeatsShown, restFlip, startGuardTarget, startSeg, stareFrame, visibleChangeMs, visitFor,
  walkBlockedFor, walkFrameOf,
} from './worldBehaviour';
import type {
  BehaviourCtx, BehaviourFrame, BehaviourLogEntry, BehaviourRunner, Look, PickEnv, Seg, SpotLike, StartGate, UnisonConductor,
} from './worldBehaviour';
import type { WorldEra } from './worldState';
import type { PlaybackMode } from './worldPlayback';
import { MACHINE_ANCHOR } from '../../data/world';
import { WORLD_FRAMES, WORLD_PLAYBACK } from '../../data/livingWorld';
import { TIER_HEARTBEAT } from '../../data/machineTiers';
import { WORLD_ERA_ENV } from '../../data/worldEras';
import {
  WORLD_BEHAVIOUR, WORLD_REACT, WORLD_REPERTOIRE, WORLD_SPOTS, WORLD_STARE_SAFE, WORLD_UNISON, WORLD_WALK,
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
    beat: { downbeat: false, index: 0 }, walkBlocked: false, hopOk: false, findOuter: false, findInner: false, findX: null, visitSpot: null,
    ...over,
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
  return { actor, era, stare: false, spots, fps: 4, visitSpot: null, findX: null, ...over };
}
const INS_ENV: PickEnv = envOf('inspector', 1);
// The girl on the ground (one spot, home only): the one actor whose current id may merge (WP28b keeps her merge).
const GIRL_ENV: PickEnv = envOf('girl', 1);

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
    // A micro activity (weight 0) is a fallback pick (WP28b); every other pick has weight above 0.
    expect(seg.def.weight > 0 || seg.def.micro === true, seg.id).toBe(true);
    expect(seg.holdMs).toBeGreaterThan(0);
    expect(seg.holdMs).toBeLessThanOrEqual(capOf(seg.def, seg.look, env.era));
    if (seg.def.capMs === undefined && !seg.look.static) expect(seg.holdMs).toBeLessThanOrEqual(WORLD_BEHAVIOUR.capMs.hold);
    // The timestamps are absolute: a run that ends exactly on its cap (the girl's 8 s stand) can read one float ulp above it.
    if (seg.look.static && seg.def.capMs === undefined) expect(seg.endMs - seg.runStartMs).toBeLessThanOrEqual(staticCap + 1e-6);
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
          for (const p of picks) expect(pool.some((a) => a.id === p.seg.id && (a.weight > 0 || a.micro === true))).toBe(true);
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

  it('keeps the crow perched in eras I and II: the spread-wing glitch is at most 5 % of the time and never a run over 2 s (WP27 D5)', () => {
    // A segment shows the spread wing when its look draws frozen or frozenTip (the tip try only, by the data guard).
    const spreadWing = (key: string): boolean => key.split('/').some((f) => f === 'frozen' || f === 'frozenTip');
    for (const era of [1, 2] as const) {
      const pool = eligible('crow', era, ctxOf({ era }));
      const env = envOf('crow', era, { fps: 4 });
      let spreadMs = 0;
      let totalMs = 0;
      let spreadPicks = 0;
      for (const seed of [1, 2, 3, 4]) {
        const picks = playPicks(pool, env, seed, { minutes: 60 });
        expectRules(picks, env);
        let run = 0;
        let prevSpread = false;
        for (const { seg } of picks) {
          const spread = spreadWing(seg.look.key);
          if (spread) {
            spreadPicks += 1;
            spreadMs += seg.endMs - seg.startMs;
            run = prevSpread ? run + (seg.endMs - seg.startMs) : seg.endMs - seg.startMs;
            expect(run, `era ${era} seed ${seed} spread-wing run`).toBeLessThanOrEqual(2000);
          }
          prevSpread = spread;
        }
        totalMs += picks[picks.length - 1]?.seg.endMs ?? 0;
      }
      expect(spreadPicks, `era ${era} glitch picks`).toBeGreaterThan(0);
      expect(spreadMs / totalMs, `era ${era} spread-wing share`).toBeLessThanOrEqual(0.05);
    }
  });

  it('the girl on the ground: her stand merges under her own 16 s static cap (WP28b D), never past it; every merge obeys the rule', () => {
    // WP28b D: her static rest poses keep the v0.11.0 cap (16 s, capMs), so a stand run merges again (the 8 s roaming cap cut it to one length).
    // The run (the stand chain from its first start) ends by the cap; the synthetic merge is checked below and in the cooldown tests.
    const picks = playPicks(eligible('girl', 1, ctxOf({ girlStage: 'ground' })), GIRL_ENV, 11, { minutes: 60 });
    const merges = picks.filter((p) => p.merged);
    for (const m of merges) expect(m.seg.def.repeatable === true || holdClip(m.seg.def, m.seg.look)).toBe(true);
    const stands = merges.filter((m) => m.seg.id === 'stand');
    expect(stands.length).toBeGreaterThan(0);
    for (const m of stands) expect(m.seg.endMs - m.seg.runStartMs, 'a stand run ends by its cap').toBeLessThanOrEqual(16000);
  });
});

describe('travel', () => {
  it('drops a travel whose spot is missing from the framing', () => {
    const env = envOf('inspector', 1, { spots: [{ id: 'mid', x: 100 }, { id: 'scrap', x: 124 }] });
    const pool = eligible('inspector', 1, ctxOf({ sensor: true, scraps: true }));
    for (const seed of [1, 2]) {
      const picks = playPicks(pool, env, seed, { minutes: 60, homeSpot: 0 });
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

  it('keeps one repeatable static activity going to its run cap and restarts it after (one-activity pool, the girl)', () => {
    // Holds of 1-2 s: a merge (its own minimum hold on top) fits the 8 s static cap (WP28b re-pin: 4-6 s holds never merge under it).
    const stand = staticAct('stand', { repeatable: true, holdMs: [1000, 2000] });
    const picks = playPicks([stand], GIRL_ENV, 31, { count: 30, homeSpot: 0 });
    expect(picks.every((p) => p.seg.id === 'stand')).toBe(true);
    expect(picks.some((p) => p.merged)).toBe(true);
    for (const p of picks) expect(p.seg.holdMs).toBeGreaterThanOrEqual(WORLD_BEHAVIOUR.minHoldMs);
    let prev: Seg | null = null;
    for (const p of picks) {
      if (prev !== null && !p.merged) expect(p.seg.startMs).toBe(prev.endMs);
      prev = p.seg;
    }
  });

  it('extends a one-activity hold clip below its cap, then restarts it (the girl; a roamer restarts instead)', () => {
    const slow = act('slow', { capMs: 10000, holdMs: [4000, 6000] });
    const picks = playPicks([slow], GIRL_ENV, 41, { count: 20, homeSpot: 0 });
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

// The roaming rules (WP28b, B-T1a) over the real repertoire: a roamer never starts its current id again, a roamer never extends its hold,
// and a roamer with nothing else to start takes its micro activity. The girl keeps her merge. Eras I-III and V (the era IV conductor runs
// the cast), seeds 1-5 (behaviourSeed), 3000 picks each.
describe('roaming rules: no id twice in a row, the micro fallback (WP28b, B-T1a)', () => {
  const ROAMERS: readonly BehaviourActor[] = ['inspector', 'dog', 'crow'];
  const ROAM_ERAS: readonly WorldEra[] = [1, 2, 3, 5];
  const ROAM_SEEDS = [1, 2, 3, 4, 5];
  const ROAM_PICKS = 3000;

  for (const actor of ROAMERS) {
    for (const era of ROAM_ERAS) {
      it(`${actor} era ${era}: ${ROAM_PICKS} picks per seed never start the id they were given as the current one`, () => {
        const pool = eligible(actor, era, ctxOf({ era, stare: era === 5, vents: era === 3, holeDig: era === 2 }));
        const env = envOf(actor, era, { stare: era === 5, fps: era === 1 ? 4 : 8 });
        const homeSpot = actor === 'crow' ? 0 : 1;
        let picked = 0;
        let repeats = 0;
        for (const seed of ROAM_SEEDS) {
          let prev: Seg | null = null;
          for (const { seg } of playPicks(pool, env, behaviourSeed(seed, actor), { count: ROAM_PICKS, homeSpot })) {
            picked += 1;
            if (prev !== null && seg.id === prev.id) repeats += 1;
            prev = seg;
          }
        }
        expect(picked).toBe(ROAM_PICKS * ROAM_SEEDS.length);
        expect(repeats).toBe(0);
      });
    }
  }

  it('the fallback starts a micro activity when only the current id would pass', () => {
    const env = envOf('inspector', 1);
    const mem = newMemory(7, 0, 1);
    const cur = startSeg(mem, act('stand'), env, 0);
    const glance = act('glance', { weight: 0, micro: true, holdMs: [1200, 2200] });
    const next = pickNext(mem, cur, [act('stand'), glance], env, cur.endMs);
    expect(next.id).toBe('glance');
    expect(next.def.micro).toBe(true);
    expect(next.startMs).toBe(cur.endMs);
    expect(next.walkMs).toBe(0);
  });

  it('a micro activity in cooldown is not started: with nothing else to start, the current id restarts', () => {
    const env = envOf('inspector', 1);
    const mem = newMemory(7, 0, 1);
    const stand = act('stand');
    const cur = startSeg(mem, stand, env, 0);
    const glance = act('glance', { weight: 0, micro: true, holdMs: [1200, 2200], cooldownMs: 1e9 });
    mem.lastEndMs.set('glance', 0);
    const next = pickNext(mem, cur, [stand, glance], env, cur.endMs);
    expect(next.id).toBe('stand');
    expect(next.startMs).toBe(cur.endMs);
  });

  it('a roamer never extends its hold: a one-activity hold clip below its cap restarts (no merge)', () => {
    const slow = act('slow', { capMs: 10000, holdMs: [4000, 6000] });
    const picks = playPicks([slow], INS_ENV, 41, { count: 20, homeSpot: 1 });
    expect(picks.every((p) => p.seg.id === 'slow' && !p.merged)).toBe(true);
    let prev: Seg | null = null;
    for (const p of picks) {
      if (prev !== null) expect(p.seg.startMs).toBe(prev.endMs);
      expect(p.seg.holdMs).toBeLessThanOrEqual(10000);
      prev = p.seg;
    }
  });

  it('the girl keeps her merge: her repeatable current id is the candidate that extends the hold (same start, longer hold)', () => {
    const stand = staticAct('stand', { repeatable: true, holdMs: [1000, 1500] });
    const mem = newMemory(3, 0);
    const cur = startSeg(mem, stand, GIRL_ENV, 0);
    const next = pickNext(mem, cur, [stand], GIRL_ENV, cur.endMs);
    expect(next.id).toBe('stand');
    expect(next.startMs).toBe(cur.startMs);
    expect(next.holdMs).toBeGreaterThan(cur.holdMs);
  });

  it('replays the same 500 picks for each roamer over the real repertoire, and a new seed changes them', () => {
    const sig = (ps: Pick[]): unknown[] => ps.map((p) => [p.seg.id, p.seg.startMs, p.seg.holdMs, p.seg.walkMs, p.seg.toSpot, p.merged]);
    for (const actor of ROAMERS) {
      const pool = eligible(actor, 3, ctxOf({ era: 3, vents: true }));
      const env = envOf(actor, 3, { fps: 8 });
      const homeSpot = actor === 'crow' ? 0 : 1;
      const a = playPicks(pool, env, behaviourSeed(1, actor), { count: 500, homeSpot });
      const b = playPicks(pool, env, behaviourSeed(1, actor), { count: 500, homeSpot });
      expect(sig(b), actor).toEqual(sig(a));
      const c = playPicks(pool, env, behaviourSeed(2, actor), { count: 500, homeSpot });
      expect(sig(c), actor).not.toEqual(sig(a));
    }
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
    cues: [], beat: { downbeat: false, index: 0 }, walkBlocked: false, hopOk: false, findOuter: false, findInner: false, findX: null,
    visitSpot: null, ...over,
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
    // Six clicks (3 s) stay inside the write hold (4-9 s since WP28b): a longer run would end the write on its own.
    for (let c = 1; c <= 6; c++) {
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

// ---- WP27 F5.1b: the crow's glitch (tipTry) never shows in crank playback and never as a fresh runner's first pick. ----
describe('the crow glitch in crank playback and as a first pick (WP27 F5.1b)', () => {
  // The frames the crow perches on in eras I-II (WP27 D5): all the crank may show without the glitch.
  const PERCHED: readonly string[] = ['perch0', 'perch1', 'perchTurn', 'peck0', 'peck1', 'ruffle'];
  // One crank burst of clicks: each click posts the crankClick cue (a fresh index per burst).
  const burstCues = (index: number): BehaviourCtx['cues'] => [{ id: 'crankClick', index }];

  it('the pool holds the glitch in timed playback and never in crank playback', () => {
    expect(eligible('crow', 1, ctxFor('crow', 1, 'fps4', HOME_R)).some((a) => a.id === 'tipTry')).toBe(true);
    expect(eligible('crow', 1, ctxFor('crow', 1, 'crank', HOME_R)).some((a) => a.id === 'tipTry')).toBe(false);
    expect(eligible('crow', 2, ctxFor('crow', 2, 'crank', HOME_R)).some((a) => a.id === 'tipTry')).toBe(false);
  });

  it('a crow in crank playback: 200 bursts of 1-12 clicks per seed (seeds 1-4), each followed by 5-30 s of steps, never shows the glitch', () => {
    for (const seed of [1, 2, 3, 4]) {
      const ctx = ctxFor('crow', 1, 'crank', HOME_R);
      const log: BehaviourLogEntry[] = [];
      const r = createBehaviourRunner('crow', seed, STUB_CONDUCTOR, (e) => log.push(e));
      r.reset(seed, 0, HOME_R);
      const frames = new Set<string>();
      const activities = new Set<string>();
      r.step(0, ctx);
      for (let burst = 0; burst < 200; burst++) {
        const clicks = 1 + Math.floor(hash01(seed + 5, 2 * burst) * 12);
        const f = r.step(0, { ...ctx, crankSteps: clicks, cues: burstCues(burst + 1) });
        frames.add(f.frame);
        activities.add(f.activity);
        // 5-30 s of 100 ms steps with no click: the crank does not move, so the frame must hold on the perched set.
        const waitSteps = 50 + Math.floor(hash01(seed + 9, burst) * 251);
        for (let s = 0; s < waitSteps; s++) {
          const w = r.step(100, { ...ctx, crankSteps: 0 });
          frames.add(w.frame);
          activities.add(w.activity);
        }
      }
      expect([...frames].filter((fr) => !PERCHED.includes(fr)), `seed ${seed} frames`).toEqual([]);
      expect(activities.has('tipTry'), `seed ${seed} glitch on screen`).toBe(false);
      expect(log.some((e) => e.activity === 'tipTry'), `seed ${seed} glitch in log`).toBe(false);
      expect(log.length, `seed ${seed} closed segments`).toBeGreaterThan(20);
    }
  });

  it('the crank pool follows the mode: a runner that played timed first drops the glitch once it cranks (seeds 1-4)', () => {
    for (const seed of [1, 2, 3, 4]) {
      const timed = ctxFor('crow', 1, 'fps4', HOME_R);
      const crank = ctxFor('crow', 1, 'crank', HOME_R);
      const log: BehaviourLogEntry[] = [];
      const r = createBehaviourRunner('crow', seed, STUB_CONDUCTOR, (e) => log.push(e));
      r.reset(seed, 0, HOME_R);
      for (let i = 0; i < 1200; i++) r.step(100, timed);
      // Switch to crank when the timed clock is not on the glitch (the cache, not an in-progress glitch, is what this checks).
      for (let i = 0; i < 1200 && r.snapshot().activity === 'tipTry'; i++) r.step(100, timed);
      log.length = 0;
      const frames = new Set<string>();
      const activities = new Set<string>();
      r.step(0, crank);
      for (let burst = 0; burst < 100; burst++) {
        const clicks = 1 + Math.floor(hash01(seed + 5, 2 * burst) * 12);
        const f = r.step(0, { ...crank, crankSteps: clicks, cues: burstCues(burst + 1) });
        frames.add(f.frame);
        activities.add(f.activity);
      }
      expect([...frames].filter((fr) => !PERCHED.includes(fr)), `seed ${seed} frames`).toEqual([]);
      expect(activities.has('tipTry'), `seed ${seed} glitch on screen`).toBe(false);
      expect(log.some((e) => e.activity === 'tipTry'), `seed ${seed} glitch in log`).toBe(false);
    }
  });

  it('a fresh runner never starts with the glitch, in crank or fps2 playback, in eras I and II (seeds 1-200)', () => {
    for (const mode of ['crank', 'fps2'] as const) {
      for (const era of [1, 2] as const) {
        const ctx = ctxFor('crow', era, mode, HOME_R);
        const pool = eligible('crow', era, ctx);
        for (let seed = 1; seed <= 200; seed++) {
          // The first pick of a fresh memory (no current segment) and the first frame of a fresh runner (no time passes: the first segment).
          const first = pickNext(newMemory(seed, 0, 0), null, pool, envOf('crow', era), 0);
          expect(first.id, `${mode} era ${era} seed ${seed} first pick`).not.toBe('tipTry');
          const r = createBehaviourRunner('crow', seed, STUB_CONDUCTOR);
          r.reset(seed, 0, HOME_R);
          const f = r.step(0, ctx);
          expect(f.activity, `${mode} era ${era} seed ${seed} first frame`).not.toBe('tipTry');
        }
      }
    }
  });

  it('in fps2 a crankClick cue can still start the glitch as a reaction (the pick rule does not reach reactions)', () => {
    let found = 0;
    for (let seed = 1; seed <= 20; seed++) {
      // The cue index whose chance gate passes for this seed, so the reaction is due; the crow's current segment is interruptible.
      const log = playCued('crow', seed, ctxFor('crow', 1, 'fps2', HOME_R), STEP, 2 * MIN, [{ step: 30, id: 'crankClick', index: passingIndex(seed) }]);
      if (log.some((e) => e.reaction && e.activity === 'tipTry')) found += 1;
    }
    expect(found).toBeGreaterThan(0);
  });
});

describe('the era change (T3c)', () => {
  // WP28b (B-T1c1): eras I and III have different stroll weights, so their free pools differ; the same-pool change is the vents flag of era III
  // (the umbrella is a weight-0 reaction, not a free id). The era path itself is the next test.
  it('a change of the context flags with the same free pool keeps the activity sequence (the segment in progress runs out)', () => {
    const seed = behaviourSeed(1, 'inspector');
    const plain = ctxFor('inspector', 3, 'fps4', HOME_L, { vents: false });
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

// ---- The poke interrupt (WP28a T15a, C11): interrupt starts a poke-only leave after its delay, after a walk in progress; era IV and an
// unknown id refuse; the outer travel walks to the outer spot (the one farthest from the machine anchor on the actor's side). ----
describe('interrupt and the outer travel (WP28a T15a, C11, A13 [R1])', () => {
  const SEED = behaviourSeed(1, 'inspector');
  const DT = 100;
  const insCtx = (): BehaviourCtx => ctxFor('inspector', 1, 'fps8', HOME_L);

  // Steps the Inspector until it walks (at most 60 000 steps); true when a walk was in progress at the last step.
  function stepUntilWalking(r: BehaviourRunner, ctx: BehaviourCtx): boolean {
    for (let i = 0; i < 60000; i++) {
      r.step(DT, ctx);
      if (r.snapshot().walking) return true;
    }
    return false;
  }

  it('a walk in progress finishes first: the leave starts at the arrival, as a reaction, right after the walk entry', () => {
    const log: BehaviourLogEntry[] = [];
    const ctx = insCtx();
    const r = createBehaviourRunner('inspector', SEED, STUB_CONDUCTOR, (e) => log.push(e));
    r.reset(SEED, 0, ctx.homeX);
    expect(stepUntilWalking(r, ctx)).toBe(true);
    expect(r.interrupt('leaveWrite', 0)).toBe(true);
    for (let i = 0; i < 2000; i++) r.step(DT, ctx);
    const idx = log.findIndex((e) => e.activity === 'leaveWrite');
    expect(idx).toBeGreaterThan(0);
    const leave = log[idx];
    const walk = log[idx - 1];
    expect(leave?.reaction).toBe(true);
    expect(walk?.walked).toBe(true);
    expect(leave?.atMs).toBe((walk?.atMs ?? NaN) + (walk?.durMs ?? NaN));
  });

  it('the leave waits out its delay of runner time before it starts', () => {
    const log: BehaviourLogEntry[] = [];
    const ctx = insCtx();
    const r = createBehaviourRunner('inspector', SEED, STUB_CONDUCTOR, (e) => log.push(e));
    r.reset(SEED, 0, ctx.homeX);
    for (let i = 0; i < 20; i++) r.step(DT, ctx);
    const t0 = r.snapshot().clockMs;
    expect(r.interrupt('leaveWrite', 3000)).toBe(true);
    for (let i = 0; i < 1500; i++) r.step(DT, ctx);
    const leave = log.find((e) => e.activity === 'leaveWrite');
    expect(leave).toBeDefined();
    expect(leave?.atMs ?? -1).toBeGreaterThanOrEqual(t0 + 3000);
  });

  it('refuses a runner not stepped yet, an id outside the era repertoire, and era IV (joined to the conductor)', () => {
    const ctx = insCtx();
    const r = createBehaviourRunner('inspector', SEED, STUB_CONDUCTOR, () => undefined);
    r.reset(SEED, 0, ctx.homeX);
    expect(r.interrupt('leaveWrite', 0)).toBe(false);
    r.step(DT, ctx);
    expect(r.interrupt('nope', 0)).toBe(false);
    expect(r.interrupt('leaveSit', 0)).toBe(false);
    expect(r.interrupt('leaveWrite', 0)).toBe(true);

    const ctx4 = ctxFor('inspector', 4, 'fps8', HOME_L);
    const r4 = createBehaviourRunner('inspector', SEED, createUnisonConductor(cycleSeedOf(1)), () => undefined);
    r4.reset(SEED, 0, ctx4.homeX);
    for (let i = 0; i < 50; i++) r4.step(DT, ctx4);
    expect(r4.interrupt('leaveWrite', 0)).toBe(false);
  });

  it('is deterministic: the same inputs give the same frames and log', () => {
    const run = (): { frames: string[]; log: string[] } => {
      const ctx = insCtx();
      const log: string[] = [];
      const r = createBehaviourRunner('inspector', SEED, STUB_CONDUCTOR, (e) => log.push(`${e.activity}@${e.atMs}+${e.durMs}${e.reaction ? 'R' : ''}`));
      r.reset(SEED, 0, ctx.homeX);
      const frames: string[] = [];
      for (let i = 0; i < 1500; i++) {
        if (i === 40) r.interrupt('leaveWrite', 1200);
        const f = r.step(DT, ctx);
        frames.push(`${f.activity}:${f.frame}:${f.x}`);
      }
      return { frames, log };
    };
    const first = run();
    expect(first.frames.some((f) => f.startsWith('leaveWrite:'))).toBe(true);
    expect(run()).toEqual(first);
  });

  it('the outer travel walks to the outer spot (the one farthest from the machine anchor), never to the current spot', () => {
    const leave = activityOf('inspector', 1, 'leaveWrite');
    expect(leave?.travel).toBe('outer');
    if (leave === undefined) return;
    // The spots of INS_ENV are all left of MACHINE_ANCHOR.x: the sensor spot (x 76) is the outer one.
    const fromScrap = startSeg(newMemory(SEED, 0, 2), leave, INS_ENV, 0);
    expect(fromScrap.toSpot).toBe(0);
    expect(fromScrap.toX).toBe(76);
    expect(fromScrap.walkMs).toBeGreaterThan(0);
    const fromMid = startSeg(newMemory(SEED, 0, 1), leave, INS_ENV, 0);
    expect(fromMid.toSpot).toBe(0);
    expect(fromMid.toX).toBe(76);
  });

  it('a left-wing Inspector on the outer spot stays; on an inner spot it walks left', () => {
    const leave = activityOf('inspector', 1, 'leaveWrite');
    if (leave === undefined) throw new Error('no inspector leave');
    const onOuter = startSeg(newMemory(SEED, 0, 0), leave, INS_ENV, 0);
    expect(onOuter.toSpot).toBe(0);
    expect(onOuter.walkMs).toBe(0);
    expect(onOuter.fromX).toBe(76);
    expect(onOuter.toX).toBe(76);
  });

  it('a right-wing dog walks right to its outer spot; on the outer spot it stays', () => {
    const leave = activityOf('dog', 1, 'leaveSit');
    if (leave === undefined) throw new Error('no dog leave');
    // The e1 dog spots (stake 2340, home 2364, out 2388) are right of MACHINE_ANCHOR.x: the out spot is the outer one.
    const dogE1: PickEnv['spots'] = [{ id: 'stake', x: 2340 }, { id: 'home', x: 2364 }, { id: 'out', x: 2388 }];
    const env: PickEnv = { ...envOf('dog', 1), spots: dogE1 };
    const fromStake = startSeg(newMemory(SEED, 0, 0), leave, env, 0);
    expect(fromStake.toSpot).toBe(2);
    expect(fromStake.toX).toBe(2388);
    expect(fromStake.walkMs).toBeGreaterThan(0);
    const fromHome = startSeg(newMemory(SEED, 0, 1), leave, env, 0);
    expect(fromHome.toSpot).toBe(2);
    const onOuter = startSeg(newMemory(SEED, 0, 2), leave, env, 0);
    expect(onOuter.toSpot).toBe(2);
    expect(onOuter.walkMs).toBe(0);
  });

  it('a poke leave from the outer spot starts in place: every frame of the leave stands at the outer x and the log has no walk', () => {
    const log: BehaviourLogEntry[] = [];
    const ctx = insCtx();
    const r = createBehaviourRunner('inspector', SEED, STUB_CONDUCTOR, (e) => log.push(e));
    r.reset(SEED, 0, ctx.homeX);
    // The outer spot of the left-wing Inspector at HOME_L is the sensor spot (HOME_L - 24); the runner walks there and rests.
    const outerX = HOME_L - 24;
    let atOuter = false;
    for (let i = 0; i < 60000 && !atOuter; i++) {
      const f = r.step(DT, ctx);
      atOuter = f.x === outerX && !f.walking;
    }
    expect(atOuter).toBe(true);
    expect(r.interrupt('leaveWrite', 0)).toBe(true);
    const leaveFrames: BehaviourFrame[] = [];
    for (let i = 0; i < 400; i++) {
      const f = r.step(DT, ctx);
      // A copy: step returns the runner's one live frame, which the later steps overwrite (WP28b re-pin: the next pick now walks).
      if (f.activity === 'leaveWrite') leaveFrames.push({ ...f });
    }
    expect(leaveFrames.length).toBeGreaterThan(0);
    expect(leaveFrames.every((f) => f.x === outerX && !f.walking)).toBe(true);
    expect(log.find((e) => e.activity === 'leaveWrite')?.walked).toBe(false);
  });

  it('never toward the machine: every outer walk ends farther from the anchor on the same side; the same inputs give the same walk', () => {
    const leave = activityOf('inspector', 1, 'leaveWrite');
    if (leave === undefined) throw new Error('no inspector leave');
    const anchor = MACHINE_ANCHOR.x;
    const layouts: PickEnv['spots'][] = [
      INS_ENV.spots,
      [1500, 1800, 1900, 1920, 2000, 2300].map((x) => ({ id: 'mid' as const, x })),
      [2300, 2000, 1920, 1800, 1500].map((x) => ({ id: 'home' as const, x })),
    ];
    for (const spots of layouts) {
      const env: PickEnv = { ...INS_ENV, spots };
      spots.forEach((_, i) => {
        const seg = startSeg(newMemory(SEED, 0, i), leave, env, 0);
        const again = startSeg(newMemory(SEED, 0, i), leave, env, 0);
        expect(again.toSpot).toBe(seg.toSpot);
        if (seg.toSpot === i) {
          expect(seg.walkMs).toBe(0);
          return;
        }
        expect(seg.toX < anchor).toBe(seg.fromX < anchor);
        expect(Math.abs(seg.toX - anchor)).toBeGreaterThan(Math.abs(seg.fromX - anchor));
      });
    }
  });
});

// WP28b B-T1b: lanes (Spots v2), the Euclidean walk, the walk gate, the walkBlocked pool, halt and the visit spots. The spots are small and
// explicit so the walk geometry is known; the data numbers (walkStaggerMs, haltMinLeftMs, minTravelPx) are read, never pinned.
describe('spots with lanes: the Euclidean walk and the lane of a frame (WP28b, B-T1b)', () => {
  const YARD_SPOTS: PickEnv['spots'] = [{ id: 'sensor', x: 100, lane: 0 }, { id: 'mid', x: 220, lane: 0 }, { id: 'y1', x: 160, lane: 64 }];

  it('a walk is Euclidean: ceil(hypot(dx, dLane) / 8) drawn frames and the lane goes to the target lane', () => {
    const env = envOf('inspector', 1, { spots: [{ id: 'sensor', x: 100, lane: 0 }, { id: 'y1', x: 160, lane: 64 }], fps: 4 });
    const seg = startSeg(newMemory(3, 0, 0), act('toYard', { travel: 'spot' }), env, 0);
    expect(seg.toSpot).toBe(1);
    expect(seg.fromLane).toBe(0);
    expect(seg.toLane).toBe(64);
    // hypot(60, 64) = 87.7 world px: 11 drawn frames at 4 fps.
    expect(seg.walkMs).toBe(Math.ceil(Math.hypot(60, 64) / WORLD_WALK.pxPerFrame) * (1000 / 4));
    expect(seg.walkMs).toBe(11 * 250);
    // A walk with no horizontal part is still a walk: one spot straight below the other.
    const below = envOf('inspector', 1, { spots: [{ id: 'sensor', x: 100, lane: 0 }, { id: 'y1', x: 100, lane: 32 }], fps: 4 });
    const down = startSeg(newMemory(3, 0, 0), act('down', { travel: 'spot' }), below, 0);
    expect(down.toSpot).toBe(1);
    expect(down.walkMs).toBe(Math.ceil(32 / WORLD_WALK.pxPerFrame) * 250);
  });

  it('plain spot travel counts the Euclidean distance: a spot 14 px away diagonally is no target, one 30 px below is', () => {
    const near = envOf('inspector', 1, { spots: [{ id: 'sensor', x: 100, lane: 0 }, { id: 'y1', x: 110, lane: 10 }], fps: 4 });
    expect(startSeg(newMemory(1, 0, 0), act('stroll', { travel: 'spot' }), near, 0).walkMs).toBe(0);
    const far = envOf('inspector', 1, { spots: [{ id: 'sensor', x: 100, lane: 0 }, { id: 'y1', x: 100, lane: 30 }], fps: 4 });
    expect(startSeg(newMemory(1, 0, 0), act('stroll', { travel: 'spot' }), far, 0).toSpot).toBe(1);
  });

  it('a diagonal walk leaves its point, every walk frame lies on the segment to its target, and a rest frame stands on its spot lane', () => {
    const ctx = ctxFor('inspector', 1, 'fps8', 100, { spots: YARD_SPOTS });
    let diagonals = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const r = createBehaviourRunner('inspector', behaviourSeed(seed, 'inspector'), STUB_CONDUCTOR, () => undefined);
      r.reset(seed, 0, ctx.homeX);
      const frames: { walking: boolean; x: number; lane: number }[] = [];
      for (let i = 0; i < 4000; i++) {
        const f = r.step(100, ctx);
        frames.push({ walking: f.walking, x: f.x, lane: f.lane });
        // A rest frame stands on its spot: the lane 64 spot at x 160, the others on lane 0.
        if (!f.walking) expect(f.lane, `seed ${seed} rest lane at x ${f.x}`).toBe(f.x === 160 ? 64 : 0);
      }
      for (let i = 1; i < frames.length; i++) {
        const before = frames[i - 1];
        const first = frames[i];
        if (before === undefined || first === undefined || before.walking || !first.walking) continue;
        let j = i;
        while (j < frames.length && frames[j]?.walking === true) j++;
        const target = frames[j];
        if (target === undefined) break;
        const dx = target.x - before.x;
        const dl = target.lane - before.lane;
        if (dx === 0 || dl === 0) continue;
        diagonals++;
        const walk = frames.slice(i, j);
        // The first walk frame is one frame step (8 px) from the point it leaves, the last one within one step of the target.
        const head = walk[0];
        const tail = walk[walk.length - 1];
        if (head === undefined || tail === undefined) continue;
        expect(Math.hypot(head.x - before.x, head.lane - before.lane)).toBeLessThanOrEqual(WORLD_WALK.pxPerFrame + 1e-9);
        expect(Math.hypot(target.x - tail.x, target.lane - tail.lane)).toBeLessThanOrEqual(WORLD_WALK.pxPerFrame + 1e-9);
        for (const p of walk) {
          // Collinear with the segment and between its ends (x and lane move together).
          expect(Math.abs((p.x - before.x) * dl - (p.lane - before.lane) * dx)).toBeLessThan(1e-6);
          expect(p.x >= Math.min(before.x, target.x) - 1e-9 && p.x <= Math.max(before.x, target.x) + 1e-9).toBe(true);
          expect(p.lane >= Math.min(before.lane, target.lane) - 1e-9 && p.lane <= Math.max(before.lane, target.lane) + 1e-9).toBe(true);
        }
      }
    }
    expect(diagonals).toBeGreaterThan(0);
  });

  it('no plain spot travel ends on a visit spot (v), from either side; only the Director walks to one', () => {
    const spots: PickEnv['spots'] = [{ id: 'sensor', x: 100 }, { id: 'mid', x: 160 }, { id: 'v1', x: 220 }];
    const env = envOf('inspector', 1, { spots, fps: 4 });
    const stroll = act('stroll', { travel: 'spot' });
    for (let seed = 1; seed <= 20; seed++) {
      expect(startSeg(newMemory(seed, 0, 0), stroll, env, 0).toSpot).toBe(1);
      expect(startSeg(newMemory(seed, 0, 1), stroll, env, 0).toSpot).toBe(0);
    }
  });
});

describe('the walk gate (WP28b, B1)', () => {
  it('blocks another actor for walkStaggerMs after a walk starts, never its own walk, and frees the others after', () => {
    const gate = createWalkGate();
    expect(walkBlockedFor(gate, 'dog', 0)).toBe(false);
    noteWalkFrame(gate, 'inspector', true, 5000);
    expect(walkBlockedFor(gate, 'dog', 5000)).toBe(true);
    expect(walkBlockedFor(gate, 'dog', 5000 + WORLD_BEHAVIOUR.walkStaggerMs - 1)).toBe(true);
    expect(walkBlockedFor(gate, 'dog', 5000 + WORLD_BEHAVIOUR.walkStaggerMs)).toBe(false);
    expect(walkBlockedFor(gate, 'inspector', 5000)).toBe(false);
    // Walking on is not a new start; a new rising edge is.
    noteWalkFrame(gate, 'inspector', true, 5100);
    expect(gate.startedAt.inspector).toBe(5000);
    noteWalkFrame(gate, 'inspector', false, 5200);
    noteWalkFrame(gate, 'inspector', true, 6000);
    expect(gate.startedAt.inspector).toBe(6000);
    expect(walkBlockedFor(gate, 'dog', 6000)).toBe(true);
  });

  it('a set walkBlocked drops every travel from the pool: no walk starts while the gate is set', () => {
    const cases: [BehaviourActor, WorldEra][] = [['inspector', 1], ['dog', 2], ['inspector', 3], ['dog', 5]];
    for (const [actor, era] of cases) {
      const ctx = ctxFor(actor, era, 'fps8', HOME_L, { walkBlocked: true });
      let walks = 0;
      playRunner(actor, behaviourSeed(2, actor), ctx, 100, 6 * MIN, { visit: (f) => { if (f.walking) walks++; } });
      expect(walks, `${actor} era ${era}`).toBe(0);
    }
  });
});

// WP28b (r2-FX4G): the test's stand-in for another denizen's latest start (the gate is the caller's; the runner writes its own starts into it).
function setStart(gate: StartGate, actor: BehaviourActor, atMs: number): void {
  gate.startedAt[actor] = atMs;
}
// WP28b (r2-FX4G, V5): one runner played with the gate in its ctx (the runner writes its own segment starts into the gate). onStep runs before
// each step with the clock of the step (the test sets the other denizens' starts there).
function playGated(actor: BehaviourActor, seed: number, ctx: BehaviourCtx, dtMs: number, totalMs: number, gate?: StartGate,
  onStep?: (t: number) => void): BehaviourLogEntry[] {
  const log: BehaviourLogEntry[] = [];
  const r = createBehaviourRunner(actor, seed, STUB_CONDUCTOR, (e) => log.push(e));
  r.reset(seed, 0, ctx.homeX);
  const c: BehaviourCtx = gate === undefined ? ctx : { ...ctx, startGate: gate };
  const steps = Math.round(totalMs / dtMs);
  for (let i = 0; i < steps; i++) {
    onStep?.((i + 1) * dtMs);
    r.step(dtMs, c);
  }
  return log;
}
// WP28b (r2-FX4G): the Inspector in a framing's era with the unison beat of the shared clock (era IV: the conductor plays the cast). Every step
// the dog's start is noted at the clock, so every boundary of the runner lies near another denizen's start.
function playBeat(era: WorldEra, gate: StartGate | undefined, dtMs: number, totalMs: number): BehaviourLogEntry[] {
  const seed = behaviourSeed(1, 'inspector');
  const log: BehaviourLogEntry[] = [];
  const r = createBehaviourRunner('inspector', seed, createUnisonConductor(cycleSeedOf(1)), (e) => log.push(e));
  r.reset(seed, 0, HOME_L);
  const beat = { downbeat: false, index: -1 };
  const base = ctxFor('inspector', era, 'fps8', HOME_L, { beat });
  const ctx: BehaviourCtx = gate === undefined ? base : { ...base, startGate: gate };
  const steps = Math.round(totalMs / dtMs);
  for (let i = 0; i < steps; i++) {
    const t = (i + 1) * dtMs;
    const index = Math.floor(t / BEAT);
    beat.downbeat = index !== beat.index;
    beat.index = index;
    if (gate !== undefined) setStart(gate, 'dog', t);
    r.step(dtMs, ctx);
  }
  return log;
}

describe('the start gate (WP28b, r2-FX4G, V5): a boundary near another denizen\'s start moves to startGuardMs from it', () => {
  const G = WORLD_BEHAVIOUR.startGuardMs;
  // WP28b (r2-FX4T): cycle 2 (was 1): the first pick of cycle 1 is a fast scratch, a clip the gate never stretches (V7), so its boundary cannot move.
  const DOG_SEED = behaviourSeed(2, 'dog');
  const DOG_CTX = (): BehaviourCtx => ctxFor('dog', 2, 'fps8', HOME_R);

  it('startGuardTarget: the latest start + startGuardMs among the other denizens\' starts within startGuardMs; none near: the boundary stays', () => {
    const gate = createStartGate();
    expect(startGuardTarget(gate, 'dog', 1000)).toBe(1000);
    setStart(gate, 'dog', 1000);
    expect(startGuardTarget(gate, 'dog', 1000)).toBe(1000);
    setStart(gate, 'inspector', 1040);
    expect(startGuardTarget(gate, 'dog', 1000)).toBe(1040 + G);
    setStart(gate, 'crow', 1000 - 40);
    expect(startGuardTarget(gate, 'dog', 1000)).toBe(1040 + G);
    expect(startGuardTarget(gate, 'dog', 1040 + G)).toBe(1040 + G);
    expect(startGuardTarget(gate, 'girl', 1000 + 2 * G)).toBe(1000 + 2 * G);
  });

  it('two runners whose boundaries are 40 ms apart end up at least startGuardMs apart (either order)', () => {
    const base = playGated('dog', DOG_SEED, DOG_CTX(), 100, 2 * MIN);
    const b1 = (base[0]?.atMs ?? 0) + (base[0]?.durMs ?? 0);
    for (const other of [b1 - 40, b1 + 40]) {
      const gate = createStartGate();
      setStart(gate, 'inspector', other);
      const gated = playGated('dog', DOG_SEED, DOG_CTX(), 100, 2 * MIN, gate);
      const second = gated[1]?.atMs ?? NaN;
      expect(Math.abs(second - other), `other start ${other}`).toBeGreaterThanOrEqual(G);
      expect(second - b1, `other start ${other}`).toBeLessThanOrEqual(WORLD_BEHAVIOUR.startGuardExtMax * G);
    }
  });

  it('the extension of one boundary is bounded (startGuardExtMax x startGuardMs), and the gated start never moves back', () => {
    const base = playGated('dog', DOG_SEED, DOG_CTX(), 100, 2 * MIN);
    const b1 = (base[0]?.atMs ?? 0) + (base[0]?.durMs ?? 0);
    for (let d = -3 * G; d <= 3 * G; d += 10) {
      const gate = createStartGate();
      setStart(gate, 'inspector', b1 + d);
      const second = playGated('dog', DOG_SEED, DOG_CTX(), 100, 2 * MIN, gate)[1]?.atMs ?? NaN;
      expect(second, `offset ${d}`).toBeGreaterThanOrEqual(b1);
      expect(second - b1, `offset ${d}`).toBeLessThanOrEqual(WORLD_BEHAVIOUR.startGuardExtMax * G);
      expect(Math.abs(second - (b1 + d)), `offset ${d}`).toBeGreaterThanOrEqual(G);
    }
  });

  it('a runner far from every other start is unchanged: its log is the ungated log', () => {
    const base = playGated('dog', DOG_SEED, DOG_CTX(), 100, 4 * MIN);
    const b1 = (base[0]?.atMs ?? 0) + (base[0]?.durMs ?? 0);
    const gate = createStartGate();
    setStart(gate, 'inspector', b1 - 10 * G);
    expect(playGated('dog', DOG_SEED, DOG_CTX(), 100, 4 * MIN, gate)).toEqual(base);
  });

  it('era IV takes no gate (the conductor plays the cast), while era III with the same stimulus is held', () => {
    const iv = playBeat(4, undefined, 100, 4 * MIN);
    expect(iv.length).toBeGreaterThan(0);
    expect(playBeat(4, createStartGate(), 100, 4 * MIN)).toEqual(iv);
    const iii = playBeat(3, undefined, 100, 4 * MIN);
    expect(playBeat(3, createStartGate(), 100, 4 * MIN)).not.toEqual(iii);
  });

  it('a hop (a fast clip) keeps its length under the gate: a stretched flight would show more changes a second (V7)', () => {
    const seed = behaviourSeed(1, 'crow');
    const gate = createStartGate();
    const ctx = ctxFor('crow', 1, 'fps8', HOME_R, { hopOk: true });
    const log = playGated('crow', seed, ctx, 100, 20 * MIN, gate, (t) => setStart(gate, 'inspector', t));
    const hops = log.filter((e) => e.activity === 'hopFree');
    expect(hops.length).toBeGreaterThan(0);
    for (const e of hops) expect(e.durMs).toBeCloseTo(600, 6);
  });

  it('the deterministic gate: the same seed and step give the same gated log', () => {
    const run = (): BehaviourLogEntry[] => {
      const gate = createStartGate();
      return playGated('dog', DOG_SEED, DOG_CTX(), 100, 6 * MIN, gate, (t) => { if (t % 1000 === 0) setStart(gate, 'inspector', t - 40); });
    };
    expect(run()).toEqual(run());
  });

  it('the runner writes its segment starts into the gate it reads: the gate holds the open segment\'s start, on the runner clock', () => {
    const gate = createStartGate();
    const log = playGated('dog', DOG_SEED, DOG_CTX(), 100, 6 * MIN, gate);
    expect(log.length).toBeGreaterThan(0);
    expect(gate.startedAt.dog).toBeGreaterThan(log[log.length - 1]?.atMs ?? Infinity);
    expect(gate.startedAt.inspector).toBe(-Infinity);
  });
});

// WP28b (r2-FX4G, V5 fix): the Director's stepping on one clock. The runners share one gate and step on the same dt; after each step the shared
// clock (the step's end) minus the runner's clock is its clockOffsetMs, unless withOffset is false. paused holds one actor for the shared
// times (from, to]. Returns the starts the gate records per actor (read after each step), on the shared clock.
interface SharedOpts { withOffset: boolean; paused?: { actor: BehaviourActor; from: number; to: number } }
function playShared(actors: readonly BehaviourActor[], dtMs: number, totalMs: number, opts: SharedOpts): Record<BehaviourActor, number[]> {
  const gate = createStartGate();
  const starts: Record<BehaviourActor, number[]> = { inspector: [], dog: [], crow: [], girl: [] };
  const seen: Record<BehaviourActor, number> = { inspector: -Infinity, dog: -Infinity, crow: -Infinity, girl: -Infinity };
  const pause = opts.paused;
  const runs = actors.map((actor) => {
    const seed = behaviourSeed(1, actor);
    const r = createBehaviourRunner(actor, seed, STUB_CONDUCTOR);
    r.reset(seed, 0, IV_HOME[actor]);
    return { actor, r, ctx: ctxFor(actor, 1, 'fps8', IV_HOME[actor], { startGate: gate }) };
  });
  const steps = Math.round(totalMs / dtMs);
  for (let i = 0; i < steps; i++) {
    const shared = (i + 1) * dtMs;
    for (const { actor, r, ctx } of runs) {
      ctx.paused = pause !== undefined && pause.actor === actor && shared > pause.from && shared <= pause.to;
      if (opts.withOffset) ctx.clockOffsetMs = shared - (r.clockMs() + dtMs);
      r.step(dtMs, ctx);
    }
    for (const actor of actors) {
      const at = gate.startedAt[actor];
      if (at !== seen[actor]) {
        starts[actor].push(at);
        seen[actor] = at;
      }
    }
  }
  return starts;
}
// The gaps of the pairs of starts of different actors closer than startGuardMs (the gate's own times, on the shared clock).
function closeGaps(starts: Record<BehaviourActor, number[]>): number[] {
  const gaps: number[] = [];
  for (const a of ACTORS) {
    for (const b of ACTORS) {
      if (a >= b) continue;
      for (const s of starts[a]) {
        for (const t of starts[b]) {
          if (Math.abs(s - t) < WORLD_BEHAVIOUR.startGuardMs - 1e-6) gaps.push(Math.abs(s - t));
        }
      }
    }
  }
  return gaps;
}

describe('the start gate on one clock (WP28b, r2-FX4G, V5 fix): a runner\'s clockOffsetMs maps its clock onto the shared clock', () => {
  const ACTORS3: readonly BehaviourActor[] = ['inspector', 'dog', 'crow'];
  const DT = 100;
  const TOTAL = 3 * MIN;
  // The dog is held for 1.5 s mid-run: its clock stops, the shared clock and the others run on.
  const PAUSE: NonNullable<SharedOpts['paused']> = { actor: 'dog', from: 40000, to: 41500 };

  it('a runner paused for 1.5 s: no two starts of different runners lie closer than startGuardMs on the shared clock', () => {
    const starts = playShared(ACTORS3, DT, TOTAL, { withOffset: true, paused: PAUSE });
    expect(starts.inspector.length + starts.dog.length).toBeGreaterThan(10);
    expect(closeGaps(starts)).toEqual([]);
  });

  it('the same scenario without clockOffsetMs (the old clocks: the paused runner lags) lets starts fall closer than startGuardMs', () => {
    const starts = playShared(ACTORS3, DT, TOTAL, { withOffset: false, paused: PAUSE });
    expect(closeGaps(starts).length).toBeGreaterThan(0);
  });

  it('the gate holds each start on the shared clock: with an offset O the starts are the offset-free starts plus O', () => {
    const O = 5000;
    const run = (offset: number | undefined): number[] => {
      const seed = behaviourSeed(2, 'dog');
      const gate = createStartGate();
      const r = createBehaviourRunner('dog', seed, STUB_CONDUCTOR);
      r.reset(seed, 0, HOME_R);
      const ctx = ctxFor('dog', 2, 'fps8', HOME_R, { startGate: gate });
      if (offset !== undefined) ctx.clockOffsetMs = offset;
      const out: number[] = [];
      let last = -Infinity;
      for (let i = 0; i < TOTAL / DT; i++) {
        r.step(DT, ctx);
        if (gate.startedAt.dog !== last) {
          last = gate.startedAt.dog;
          out.push(last);
        }
      }
      return out;
    };
    const plain = run(undefined);
    expect(plain.length).toBeGreaterThan(3);
    expect(run(O)).toEqual(plain.map((t) => t + O));
  });
});

describe('halt (WP28b, C11): a walk is cut at its last drawn tick when more than haltMinLeftMs is left', () => {
  const SPOTS: PickEnv['spots'] = [{ id: 'sensor', x: 100, lane: 0 }, { id: 'mid', x: 220, lane: 0 }, { id: 'y1', x: 160, lane: 64 }];
  const SHORT: PickEnv['spots'] = [{ id: 'sensor', x: 100, lane: 0 }, { id: 'mid', x: 124, lane: 0 }];

  it('cuts at the point of the last drawn tick: the hold starts there, and every frame until then stands on that point', () => {
    const ctx = ctxFor('inspector', 1, 'fps8', 100, { spots: SPOTS });
    let cuts = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const r = createBehaviourRunner('inspector', behaviourSeed(seed, 'inspector'), STUB_CONDUCTOR, () => undefined);
      r.reset(seed, 0, ctx.homeX);
      for (let i = 0; i < 20000; i++) {
        const f = r.step(100, ctx);
        if (!f.walking) continue;
        const at = { x: f.x, lane: f.lane, activity: f.activity };
        if (!r.halt()) continue;
        cuts++;
        // The walk now ends on the cut point: its frames and the hold that follows stand on it, on the same activity.
        let held = false;
        for (let k = 0; k < 4000 && !held; k++) {
          const g = r.step(100, ctx);
          if (g.activity !== at.activity) break;
          expect(g.x).toBeCloseTo(at.x, 6);
          expect(g.lane).toBeCloseTo(at.lane, 6);
          held = !g.walking;
        }
        expect(held, `seed ${seed}`).toBe(true);
        break;
      }
    }
    expect(cuts).toBeGreaterThan(0);
  });

  it('never cuts with haltMinLeftMs or less left: a walk of at most three frames at 8 fps is never cut', () => {
    const ctx = ctxFor('inspector', 1, 'fps8', 100, { spots: SHORT });
    let walking = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const r = createBehaviourRunner('inspector', behaviourSeed(seed, 'inspector'), STUB_CONDUCTOR, () => undefined);
      r.reset(seed, 0, ctx.homeX);
      for (let i = 0; i < 6000; i++) {
        const f = r.step(100, ctx);
        if (f.walking) {
          walking++;
          expect(r.halt(), `seed ${seed} step ${i}`).toBe(false);
        }
      }
    }
    expect(walking).toBeGreaterThan(0);
  });

  it('is deterministic, and the walker goes on from the cut point: a walk after the cut starts one frame step from the held point', () => {
    const run = (): { frames: string[]; cut: boolean; walksAfter: number } => {
      const ctx = ctxFor('inspector', 1, 'fps8', 100, { spots: SPOTS });
      const r = createBehaviourRunner('inspector', behaviourSeed(4, 'inspector'), STUB_CONDUCTOR, () => undefined);
      r.reset(4, 0, ctx.homeX);
      const frames: string[] = [];
      let cut = false;
      let walksAfter = 0;
      let prev: { x: number; lane: number; walking: boolean } | null = null;
      for (let i = 0; i < 20000 && walksAfter < 2; i++) {
        const f = r.step(100, ctx);
        if (!cut && f.walking && r.halt()) cut = true;
        frames.push(`${f.activity}:${f.frame}:${f.x}:${f.lane}`);
        if (cut && prev !== null && !prev.walking && f.walking) {
          walksAfter++;
          expect(Math.hypot(f.x - prev.x, f.lane - prev.lane)).toBeLessThanOrEqual(WORLD_WALK.pxPerFrame + 1e-9);
        }
        prev = { x: f.x, lane: f.lane, walking: f.walking };
      }
      return { frames, cut, walksAfter };
    };
    const first = run();
    expect(first.cut).toBe(true);
    expect(first.walksAfter).toBeGreaterThan(0);
    expect(run()).toEqual(first);
  });

  it('refuses in era IV (joined to the conductor) and before the first step', () => {
    const r0 = createBehaviourRunner('inspector', behaviourSeed(1, 'inspector'), STUB_CONDUCTOR, () => undefined);
    expect(r0.halt()).toBe(false);
    const ctx4 = ctxFor('inspector', 4, 'fps8', HOME_L, { spots: SPOTS });
    const r4 = createBehaviourRunner('inspector', behaviourSeed(1, 'inspector'), createUnisonConductor(cycleSeedOf(1)), () => undefined);
    r4.reset(1, 0, ctx4.homeX);
    for (let i = 0; i < 3000; i++) {
      r4.step(100, ctx4);
      expect(r4.halt()).toBe(false);
    }
  });
});

// WP28b B-T3a: the machine-event reactions (cue bands, per-actor delays, the Find sides, the pair cooldown), the gathering at woken objects
// (visit walks), the free hop (hopOk), the travel kinds inner, visit and find, the walk gate for reaction walks, and era IV (no reactions).
describe('reactions, visits, the free hop and the travel kinds (WP28b, B-T3a)', () => {
  const NEW_CUE_STEP = 50;
  const CUE_GAP_MS = 60000;
  // One cue per actor and era with the activity that answers it and the flags it needs (a Find on one side, a woken Splice to visit).
  interface Case { actor: BehaviourActor; era: WorldEra; cue: CueId; id: string; over: Partial<BehaviourCtx> }
  const BAND_CASES: Case[] = [
    { actor: 'inspector', era: 1, cue: 'fault', id: 'startle', over: {} },
    { actor: 'dog', era: 1, cue: 'fault', id: 'bark', over: {} },
    { actor: 'crow', era: 1, cue: 'fault', id: 'ruffleReact', over: {} },
    { actor: 'inspector', era: 1, cue: 'faultClear', id: 'writeTick', over: {} },
    { actor: 'dog', era: 2, cue: 'faultClear', id: 'wag', over: {} },
    { actor: 'inspector', era: 1, cue: 'bigBuy', id: 'startle', over: {} },
    { actor: 'dog', era: 1, cue: 'bigBuy', id: 'lookBig', over: {} },
    { actor: 'crow', era: 1, cue: 'bigBuy', id: 'ruffleReact', over: {} },
    { actor: 'inspector', era: 1, cue: 'era', id: 'eraFront', over: {} },
    { actor: 'dog', era: 1, cue: 'era', id: 'eraHead', over: {} },
    { actor: 'crow', era: 1, cue: 'era', id: 'eraPerchHead', over: {} },
    { actor: 'inspector', era: 1, cue: 'find', id: 'point', over: { findOuter: true, findX: 1500 } },
    { actor: 'dog', era: 1, cue: 'find', id: 'sniffHere', over: { findInner: true, findX: 1500 } },
    { actor: 'crow', era: 1, cue: 'find', id: 'glanceDown', over: { findOuter: true, findX: 1500 } },
    { actor: 'inspector', era: 1, cue: 'splice', id: 'visitWrite', over: { visitSpot: 'v1' } },
    { actor: 'dog', era: 1, cue: 'splice', id: 'visitSniff', over: { visitSpot: 'v1' } },
  ];
  // The band of a cue for an actor: the Inspector's find waits findDelayMs, the other new cues the actor's stagger.
  const bandOf = (actor: BehaviourActor, cue: CueId): readonly [number, number] =>
    cue === 'find' && actor === 'inspector' ? WORLD_REACT.findDelayMs : WORLD_REACT.staggerMs[actor];

  it('each new cue starts its reaction inside the actor band (Inspector 200-400 ms, dog 400-600, crow 600-900; the find 2-4 s), within one step', () => {
    for (const c of BAND_CASES) {
      const seed = behaviourSeed(1, c.actor);
      const ctx = ctxFor(c.actor, c.era, 'fps8', c.actor === 'inspector' ? HOME_L : HOME_R, { spots: [], ...c.over });
      // A reaction to the id the actor already shows is dropped, so a few cue steps are tried (the first that reacts is measured).
      let found: BehaviourLogEntry | undefined;
      let cueMs = 0;
      for (const cueStep of [4, 24, 44, 64, 84]) {
        cueMs = (cueStep + 1) * NEW_CUE_STEP;
        found = playCued(c.actor, seed, ctx, NEW_CUE_STEP, 30000, [{ step: cueStep, id: c.cue, index: 1 }]).find((x) => x.reaction && x.atMs >= cueMs);
        if (found !== undefined) break;
      }
      expect(found?.activity, `${c.actor} ${c.cue}`).toBe(c.id);
      const [lo, hi] = bandOf(c.actor, c.cue);
      const lag = (found?.atMs ?? NaN) - cueMs;
      expect(lag, `${c.actor} ${c.cue} lag`).toBeGreaterThanOrEqual(lo - NEW_CUE_STEP);
      expect(lag, `${c.actor} ${c.cue} lag`).toBeLessThanOrEqual(hi + NEW_CUE_STEP);
    }
  });

  it('a per-actor delayMs of a cue replaces the band: the reaction starts exactly that long after the cue', () => {
    const seed = behaviourSeed(1, 'inspector');
    const ctx = ctxFor('inspector', 1, 'fps8', HOME_L, { spots: [] });
    const log: BehaviourLogEntry[] = [];
    const r = createBehaviourRunner('inspector', seed, STUB_CONDUCTOR, (e) => log.push(e));
    r.reset(seed, 0, HOME_L);
    const cueStep = 4;
    for (let i = 0; i < 200; i++) {
      const cues = i === cueStep ? [{ id: 'fault' as CueId, index: 1, delayMs: { inspector: 1234 } }] : [];
      r.step(NEW_CUE_STEP, { ...ctx, cues });
    }
    const reaction = log.find((e) => e.reaction);
    expect(reaction?.activity).toBe('startle');
    expect(reaction?.atMs).toBe((cueStep + 1) * NEW_CUE_STEP + 1234);
  });

  it('each actor and cue reacts at most once per pairCooldownMs (a Find cue every 2 s: reactions at least the cooldown minus the band apart)', () => {
    const seed = behaviourSeed(1, 'inspector');
    const ctx = ctxFor('inspector', 1, 'fps8', HOME_L, { spots: [], findOuter: true, findX: 1500 });
    const cues: CueAt[] = [];
    for (let k = 1; k <= 60; k++) cues.push({ step: stepAt(k * 2000, STEP), id: 'find', index: k });
    const starts = playCued('inspector', seed, ctx, STEP, 120000 + CUE_GAP_MS, cues).filter((e) => e.reaction).map((e) => e.atMs);
    expect(starts.length).toBeGreaterThan(1);
    const band = WORLD_REACT.findDelayMs[1] - WORLD_REACT.findDelayMs[0];
    for (let i = 1; i < starts.length; i++) {
      expect((starts[i] ?? 0) - (starts[i - 1] ?? 0)).toBeGreaterThanOrEqual(WORLD_REACT.pairCooldownMs - band);
    }
  });

  it('point answers a Find only on the outer side and lookFind only on the inner side (both ways); a Find on neither side gets no reaction', () => {
    const cueStream = (): CueAt[] => Array.from({ length: 6 }, (_, k) => ({ step: stepAt((k + 1) * CUE_GAP_MS, STEP), id: 'find' as CueId, index: k + 1 }));
    const namesOf = (actor: BehaviourActor, home: number, over: Partial<BehaviourCtx>): string[] => playCued(actor, behaviourSeed(1, actor),
      ctxFor(actor, 1, 'fps8', home, { spots: [], ...over }), STEP, 7 * CUE_GAP_MS, cueStream())
      .filter((e) => e.reaction).map((e) => e.activity);
    expect(namesOf('inspector', HOME_L, { findOuter: true, findX: 1500 })).toEqual(Array(6).fill('point'));
    expect(namesOf('inspector', HOME_L, { findInner: true, findX: 1500 })).toEqual(Array(6).fill('lookFind'));
    expect(namesOf('inspector', HOME_L, {})).toEqual([]);
    expect(namesOf('dog', HOME_R, { findInner: true, findX: 1500 })).toEqual(Array(6).fill('sniffHere'));
    expect(namesOf('dog', HOME_R, { findOuter: true, findX: 1500 })).toEqual(Array(6).fill('sniffFind'));
  });

  it('sniffFind walks only outward toward the Find; sniffHere stays in place; a dog on its outermost spot sniffs in place', () => {
    const def = activityOf('dog', 1, 'sniffFind');
    if (def === undefined) throw new Error('no dog sniffFind');
    // The dog's right-wing spots (x above MACHINE_ANCHOR.x): the outermost is the last one.
    const spots: PickEnv['spots'] = [{ id: 'home', x: 2400 }, { id: 'out', x: 2424 }, { id: 'b9', x: 2460 }];
    const env: PickEnv = { ...envOf('dog', 1), spots, fps: 8, findX: 2600 };
    const fromHome = startSeg(newMemory(1, 0, 0), def, env, 0, { react: true });
    expect(fromHome.toSpot).toBe(2);
    expect(fromHome.toX).toBeGreaterThan(fromHome.fromX);
    const fromFar = startSeg(newMemory(1, 0, 2), def, env, 0, { react: true });
    expect(fromFar.toSpot).toBe(2);
    expect(fromFar.walkMs).toBe(0);
    const here = activityOf('dog', 1, 'sniffHere');
    if (here === undefined) throw new Error('no dog sniffHere');
    const stays = startSeg(newMemory(1, 0, 0), here, env, 0, { react: true });
    expect(stays.walkMs).toBe(0);
    expect(stays.toSpot).toBe(0);
  });

  it('a find walk needs a Find and stays within the walk limit (a spot too far to walk at the mode fps is no target)', () => {
    const def = activityOf('dog', 1, 'sniffFind');
    if (def === undefined) throw new Error('no dog sniffFind');
    // At 2 fps a walk of 8 px per tick covers 16 px a second: the far spot (maxWalkMs x 16 px) is just beyond the limit.
    const farX = 2400 + (WORLD_WALK.maxWalkMs / 1000) * 2 * WORLD_WALK.pxPerFrame + 8;
    const spots: PickEnv['spots'] = [{ id: 'home', x: 2400 }, { id: 'b9', x: farX }];
    const env: PickEnv = { ...envOf('dog', 1), spots, fps: 2, findX: 9000 };
    expect(startSeg(newMemory(1, 0, 0), def, env, 0, { react: true }).walkMs, 'too far to walk').toBe(0);
    const near: PickEnv['spots'] = [{ id: 'home', x: 2400 }, { id: 'out', x: 2424 }];
    expect(startSeg(newMemory(1, 0, 0), def, { ...envOf('dog', 1), spots: near, fps: 2, findX: null }, 0, { react: true }).walkMs,
      'no Find, no walk').toBe(0);
  });

  it('inner walks to the spot nearest the anchor on the actor side, never past the walker; from the innermost spot it stays', () => {
    const def = activityOf('inspector', 1, 'eraFront');
    if (def === undefined) throw new Error('no inspector eraFront');
    // Left wing: sensor 76 (outermost), mid 100, scrap 124 (innermost).
    const env = envOf('inspector', 1);
    expect(startSeg(newMemory(1, 0, 0), def, env, 0, { react: true }).toX).toBe(124);
    expect(startSeg(newMemory(1, 0, 1), def, env, 0, { react: true }).toX).toBe(124);
    const innermost = startSeg(newMemory(1, 0, 2), def, env, 0, { react: true });
    expect(innermost.walkMs).toBe(0);
    expect(innermost.toX).toBe(124);
    // The dog's right wing: the innermost spot is the one nearest the anchor (the smallest x).
    const head = activityOf('dog', 1, 'eraHead');
    if (head === undefined) throw new Error('no dog eraHead');
    const right: PickEnv['spots'] = [{ id: 'stake', x: 2376 }, { id: 'home', x: 2400 }, { id: 'out', x: 2424 }];
    expect(startSeg(newMemory(1, 0, 2), head, { ...envOf('dog', 1), spots: right }, 0, { react: true }).toX).toBe(2376);
  });

  it('an era reaction ends on the innermost spot of the actor side: the runner walks there and holds', () => {
    const seed = behaviourSeed(1, 'inspector');
    const ctx = ctxFor('inspector', 1, 'fps8', 100, { spots: INS3 });
    const xs: number[] = [];
    playCued('inspector', seed, ctx, NEW_CUE_STEP, 30000, [{ step: 10, id: 'era', index: 1 }], (f) => {
      if (f.activity === 'eraFront' && !f.walking) xs.push(f.x);
    });
    expect(xs.length).toBeGreaterThan(0);
    expect(new Set(xs)).toEqual(new Set([124]));
  });

  it('a visit walks to the Director visit spot, and the walker holds on it for the visit', () => {
    const seed = behaviourSeed(1, 'inspector');
    const spots: SpotLike[] = [...INS3, { id: 'v1', x: 60 }];
    const ctx = ctxFor('inspector', 1, 'fps8', 100, { spots, visitSpot: 'v1' });
    const xs: number[] = [];
    playCued('inspector', seed, ctx, NEW_CUE_STEP, 30000, [{ step: 10, id: 'splice', index: 1 }], (f) => {
      if (f.activity === 'visitWrite' && !f.walking) xs.push(f.x);
    });
    expect(xs.length).toBeGreaterThan(0);
    expect(new Set(xs)).toEqual(new Set([60]));
  });

  it('visits: a missing visit spot or the one the walker stands on gives no walk; a plain spot pick never ends on a visit spot', () => {
    const def = activityOf('inspector', 1, 'visitWrite');
    if (def === undefined) throw new Error('no inspector visitWrite');
    const spots: SpotLike[] = [...INS3, { id: 'v1', x: 60 }];
    const env = envOf('inspector', 1, { spots, visitSpot: 'v8' });
    expect(startSeg(newMemory(1, 0, 1), def, env, 0).walkMs).toBe(0);
    const here = startSeg(newMemory(1, 0, 3), def, { ...env, visitSpot: 'v1' }, 0);
    expect(here.toSpot, 'the walker stands on the visit spot').toBe(3);
    expect(here.walkMs).toBe(0);
    const stroll = act('stroll', { travel: 'spot' });
    for (let seed = 1; seed <= 20; seed++) expect(startSeg(newMemory(seed, 0, 0), stroll, { ...env, spots }, 0).toSpot).not.toBe(3);
  });

  it('the free hop is never picked with hopOk off, and is picked over a long sim with it on (eras I-III and V)', () => {
    for (const era of [1, 2, 3, 5] as const) {
      const seed = behaviourSeed(1, 'crow');
      const off = playRunner('crow', seed, ctxFor('crow', era, 'fps8', HOME_R), 100, 20 * MIN);
      expect(off.some((e) => e.activity === 'hopFree'), `era ${era} off`).toBe(false);
      const on = playRunner('crow', seed, ctxFor('crow', era, 'fps8', HOME_R, { hopOk: true }), 100, 20 * MIN);
      expect(on.some((e) => e.activity === 'hopFree'), `era ${era} on`).toBe(true);
    }
  });

  it('the eligible pool follows hopOk, the Find sides and the visit flag: a runner whose hopOk turns on hops only after it turns on', () => {
    const seed = behaviourSeed(1, 'crow');
    const switchMs = 10 * MIN;
    const log = playWith('crow', seed, 100, 20 * MIN, (i) => ctxFor('crow', 2, 'fps8', HOME_R, { hopOk: (i + 1) * 100 > switchMs }));
    const hops = log.filter((e) => e.activity === 'hopFree');
    expect(hops.length).toBeGreaterThan(0);
    expect(hops.every((e) => e.atMs >= switchMs - 100)).toBe(true);
    const ids = (actor: BehaviourActor, era: WorldEra, over: Partial<BehaviourCtx>): string[] => eligible(actor, era, ctxOf(over)).map((a) => a.id);
    expect(ids('crow', 2, { hopOk: true })).toContain('hopFree');
    expect(ids('crow', 2, { hopOk: false })).not.toContain('hopFree');
    expect(ids('inspector', 1, { findOuter: true })).toContain('point');
    expect(ids('inspector', 1, { findOuter: false })).not.toContain('point');
    expect(ids('inspector', 1, { visitSpot: 'v1' })).toContain('visitWrite');
    expect(ids('inspector', 1, { visitSpot: null })).not.toContain('visitWrite');
  });

  it('every non-walk frame of the new activities faces restFlip: profile frames away from the machine, camera-facing frames never flip', () => {
    const ids: CueId[] = ['fault', 'faultClear', 'find', 'bigBuy', 'era', 'splice', 'rapid'];
    for (const actor of ['inspector', 'dog', 'crow'] as const) {
      for (const era of [1, 2, 3, 5] as const) {
        const home = actor === 'inspector' ? HOME_L : HOME_R;
        const cues: CueAt[] = [];
        for (let k = 1; k <= 40; k++) cues.push({ step: stepAt(k * 30000, STEP), id: ids[k % ids.length] ?? 'fault', index: k });
        const v = actor === 'inspector' ? 1700 : 2600;
        const ctx = ctxFor(actor, era, 'fps8', home, {
          hopOk: actor === 'crow', findOuter: true, findX: v, visitSpot: 'v1', spots: [...spotsFor(actor, home), { id: 'v1', x: v }],
        });
        playCued(actor, behaviourSeed(1, actor), ctx, STEP, 20 * MIN, cues, (f) => {
          if (f.walking) return;
          expect(f.flip, `${actor} era ${era} ${f.activity} ${f.frame}`).toBe(restFlip(actor, f.frame, ctx.stare, ctx.homeX));
        });
      }
    }
  });

  it('era IV ignores every new cue: no reaction, no free hop and no visit, with the conductor running the cast', () => {
    for (const actor of ACTORS) {
      const log: BehaviourLogEntry[] = [];
      const conductor = createUnisonConductor(cycleSeedOf(1));
      const r = createBehaviourRunner(actor, behaviourSeed(1, actor), conductor, (e) => log.push(e));
      r.reset(behaviourSeed(1, actor), 0, IV_HOME[actor]);
      const beat = beatsOf(STEP);
      const ids: CueId[] = ['fault', 'faultClear', 'find', 'bigBuy', 'era', 'splice'];
      for (let i = 0; i < (20 * MIN) / STEP; i++) {
        const cues = i % 30 === 0 && i > 0 ? [{ id: ids[(i / 30) % ids.length] ?? 'fault', index: i }] : [];
        r.step(STEP, { ...ctxFor(actor, 4, 'fps8', IV_HOME[actor], { hopOk: true, visitSpot: 'v1', findOuter: true, cues }), beat: beat(i) });
      }
      expect(log.some((e) => e.reaction), actor).toBe(false);
      expect(log.some((e) => e.activity === 'hopFree' || e.activity === 'visitWrite' || e.activity === 'visitSniff'), actor).toBe(false);
    }
  });

  it('a reaction walk obeys the walk gate: no walk starts while walkBlocked, and the reaction walks once the gate frees', () => {
    const seed = behaviourSeed(1, 'inspector');
    const cueStep = 4;
    const gateMs = 3000;
    const log: BehaviourLogEntry[] = [];
    const r = createBehaviourRunner('inspector', seed, STUB_CONDUCTOR, (e) => log.push(e));
    r.reset(seed, 0, 100);
    const walkStarts: number[] = [];
    let wasWalking = false;
    for (let i = 0; i < 600; i++) {
      const t = (i + 1) * NEW_CUE_STEP;
      const cues = i === cueStep ? [{ id: 'era' as CueId, index: 1 }] : [];
      const f = r.step(NEW_CUE_STEP, ctxFor('inspector', 1, 'fps8', 100, { spots: INS3, walkBlocked: t < gateMs, cues }));
      if (f.walking && !wasWalking) walkStarts.push(t);
      wasWalking = f.walking;
    }
    const era = log.find((e) => e.reaction);
    expect(era?.activity).toBe('eraFront');
    expect(era?.walked, 'the reaction walked').toBe(true);
    expect(walkStarts.length).toBeGreaterThan(0);
    expect(walkStarts.every((t) => t >= gateMs), 'no walk while the gate is set').toBe(true);
  });
});

// WP28b (B1): a reaction that would cut a segment before one frame of it was drawn, and start the id shown before it, shows that id twice in a row.
describe('reactionRepeatsShown (WP28b, B1): a reaction never restarts the id on screen across a cut segment that was never drawn', () => {
  // The dog's activity of an id in its era I repertoire (the rounds and the dig's neighbours).
  const dogAct = (id: string): Activity => {
    const a = WORLD_REPERTOIRE.dog[1]?.find((x) => x.id === id);
    if (a === undefined) throw new Error(`no dog activity ${id}`);
    return a;
  };
  const segOf = (def: Activity, startMs: number): Seg => ({
    id: def.id, def, startMs, walkMs: 0, holdMs: 4000, endMs: startMs + 4000, react: false,
    look: { key: def.id, first: '', last: '', static: false }, runStartMs: startMs, fromX: 0, toX: 0, toSpot: 0, fromLane: 0, toLane: 0,
  });
  it('is true only for a young segment whose previous started id is the reaction id', () => {
    const lookUp = dogAct('lookUp');
    const sniff = dogAct('sniff');
    const mem = newMemory(1, 0, 0);
    mem.hist.push('lookUp', 'sniff');
    const cur = segOf(sniff, 1000);
    const drawn = 125;
    expect(reactionRepeatsShown(mem, lookUp, cur, 1010, drawn), 'a 10 ms cut of sniff before lookUp').toBe(true);
    expect(reactionRepeatsShown(mem, lookUp, cur, 1000 + drawn, drawn), 'sniff has been drawn for one tick').toBe(false);
    expect(reactionRepeatsShown(mem, sniff, cur, 1010, drawn), 'the reaction id is the current id').toBe(false);
    expect(reactionRepeatsShown(mem, dogAct('scratch'), cur, 1010, drawn), 'a different id').toBe(false);
    expect(reactionRepeatsShown(mem, lookUp, null, 1010, drawn), 'nothing running').toBe(false);
  });
});

// ---- WP28b AD4 F25, F29, F30: the visit stands, the Find sides, and the machine-event cut of a walk (the runner side) ----
// One walk tick at the 8 fps of an era I-III timed walk (125 ms): the cut of a due reaction lands within one tick of its due time.
const TICK_125 = 1000 / WORLD_PLAYBACK.fps.fps8;
// Two spots 320 px apart on each actor's side (41 drawn ticks at 8 fps, about 5 s): a walk long enough to cut half way.
const FAR_SPOTS: Record<'inspector' | 'dog', readonly SpotLike[]> = {
  inspector: [{ id: 'sensor', x: 1500 }, { id: 'y1', x: 1180, lane: 64 }],
  dog: [{ id: 'home', x: 2400, lane: 32 }, { id: 'out', x: 2720, lane: 32 }],
};
// A copy of one drawn frame (the runner reuses its frame object, so a test keeps the fields it reads).
interface Frm { atMs: number; activity: string; x: number; lane: number; walking: boolean; frame: string; flip: boolean }
interface Presented { log: BehaviourLogEntry[]; cueMs: number; frames: Frm[] }
// Plays one runner for totalMs and presents one cue on the step after a free activity starts a walk (walking true: the walk's first frame, a
// rising edge after step 0, so the walk has its full length ahead; the start shift of the first segment is skipped) or draws a rest frame
// (false), plus afterMs. cueMs is the clock when the runner sees the cue. Null: no such frame within totalMs.
function presentCue(actor: BehaviourActor, era: WorldEra, ctx: BehaviourCtx, cue: CueId, delayMs: number, walking: boolean, dtMs: number,
  totalMs: number, afterMs = 0): Presented | null {
  const seed = behaviourSeed(1, actor);
  const log: BehaviourLogEntry[] = [];
  const r = createBehaviourRunner(actor, seed, STUB_CONDUCTOR, (e) => log.push(e));
  r.reset(seed, 0, ctx.homeX);
  const free = new Set(repertoire(actor, era).filter((a) => a.weight > 0).map((a) => a.id));
  const delay: Partial<Record<BehaviourActor, number>> = {};
  delay[actor] = delayMs;
  const frames: Frm[] = [];
  let cueStep = -1;
  let prevWalking = false;
  const steps = Math.round(totalMs / dtMs);
  for (let i = 0; i < steps; i++) {
    const cues = i === cueStep ? [{ id: cue, index: 1, delayMs: delay }] : [];
    const f = r.step(dtMs, { ...ctx, cues });
    frames.push({ atMs: (i + 1) * dtMs, activity: f.activity, x: f.x, lane: f.lane, walking: f.walking, frame: f.frame, flip: f.flip });
    const edge = walking ? f.walking && !prevWalking : !f.walking;
    if (cueStep < 0 && i > 0 && edge && free.has(f.activity)) cueStep = i + 1 + Math.round(afterMs / dtMs);
    prevWalking = f.walking;
  }
  return cueStep < 0 || cueStep >= steps ? null : { log, cueMs: (cueStep + 1) * dtMs, frames };
}
// The first reaction of an activity that starts at or after the cue.
function reactionOf(p: Presented | null, id: string): BehaviourLogEntry | undefined {
  return p?.log.find((e) => e.reaction && e.activity === id && e.atMs >= p.cueMs);
}

// WP28b F30 (AD4): a machine-event reaction due in a walk cuts the walk at its next drawn tick and starts there; the cut walker rests on the
// cut point and the next walk starts from it. Steps of 16.7 and 100 ms: the cut is analytic, so both steps cut at the same point.
describe('machine-event reactions cut a walk in progress (WP28b F30)', () => {
  const DTS: readonly number[] = [1000 / 60, 100];
  const TOTAL_MS = 40000;
  interface Case { actor: 'inspector' | 'dog'; cue: CueId; id: string; delayMs: number; over: Partial<BehaviourCtx> }
  const CASES: readonly Case[] = [
    { actor: 'inspector', cue: 'fault', id: 'startle', delayMs: 300, over: {} },
    { actor: 'dog', cue: 'fault', id: 'bark', delayMs: 500, over: {} },
    { actor: 'inspector', cue: 'bigBuy', id: 'startle', delayMs: 800, over: {} },
    { actor: 'dog', cue: 'bigBuy', id: 'lookBig', delayMs: 1500, over: {} },
    { actor: 'inspector', cue: 'find', id: 'point', delayMs: 2500, over: { findOuter: true, findX: 1000 } },
    { actor: 'dog', cue: 'find', id: 'sniffFind', delayMs: 1200, over: { findOuter: true, findX: 2900 } },
    { actor: 'inspector', cue: 'era', id: 'eraFront', delayMs: 400, over: {} },
    { actor: 'dog', cue: 'era', id: 'eraHead', delayMs: 600, over: {} },
  ];
  for (const c of CASES) {
    for (const dt of DTS) {
      it(`${c.actor} ${c.cue} (${c.id}) mid-walk at ${dt.toFixed(1)} ms: starts within one tick of its due time, cuts the walk, no frame jumps`, () => {
        const homeX = c.actor === 'inspector' ? 1500 : 2400;
        const ctx = ctxFor(c.actor, 1, 'fps8', homeX, { spots: FAR_SPOTS[c.actor], ...c.over });
        const run = presentCue(c.actor, 1, ctx, c.cue, c.delayMs, true, dt, TOTAL_MS);
        expect(run, 'a free walk in progress to cut').not.toBeNull();
        if (run === null) return;
        const { log, cueMs, frames } = run;
        const due = cueMs + c.delayMs;
        const reaction = reactionOf(run, c.id);
        expect(reaction, `${c.id} reacts`).toBeDefined();
        if (reaction === undefined) return;
        expect(reaction.atMs, 'not before its due time').toBeGreaterThanOrEqual(due - 1e-6);
        expect(reaction.atMs - due, 'within one walk tick of its due time (the cut)').toBeLessThanOrEqual(TICK_125 + 1e-6);
        expect(reaction.atMs, 'within delay + 1.0 s of the cause').toBeLessThanOrEqual(cueMs + c.delayMs + 1000);
        // The walk the cue cut ends where the reaction starts, and is shorter than its full length (about 5 s).
        const cut = log.find((e) => e.walked && !e.reaction && Math.abs(e.atMs + e.durMs - reaction.atMs) < 1e-6);
        expect(cut, 'the walk the cue cut ends where the reaction starts').toBeDefined();
        expect(cut?.durMs ?? Infinity, 'the cut walk is shorter than the full walk').toBeLessThan(4000);
        // No jump: consecutive frames from just before the cue to the end of the reaction's hold move at most one walk tick.
        const window = frames.filter((fr) => fr.atMs >= cueMs - 2 * dt && fr.atMs <= reaction.atMs + 2000);
        for (let k = 1; k < window.length; k++) {
          const a = window[k - 1];
          const b = window[k];
          if (a === undefined || b === undefined) continue;
          expect(Math.hypot(b.x - a.x, b.lane - a.lane), `${c.id} jump at ${b.atMs}`).toBeLessThanOrEqual(WORLD_WALK.pxPerFrame + 1e-6);
        }
        // The reaction's rest frames face away from the machine (the profile-away rule holds through the cut).
        for (const fr of frames) {
          if (fr.activity === c.id && !fr.walking) {
            expect(fr.flip, `${c.id} ${fr.frame} at ${fr.atMs}`).toBe(restFlip(c.actor, fr.frame, false, homeX));
          }
        }
        // The walker goes on from the point it rests on: the first walk after the reaction's last rest frame starts within one tick of it.
        const last = [...frames].reverse().find((fr) => fr.activity === c.id && !fr.walking);
        const next = frames.find((fr) => last !== undefined && fr.atMs > last.atMs && fr.walking);
        if (last !== undefined && next !== undefined) {
          expect(Math.hypot(next.x - last.x, next.lane - last.lane), `${c.id} next walk`).toBeLessThanOrEqual(WORLD_WALK.pxPerFrame + 1e-6);
        }
      });
    }
  }

  // WP28b B3 (r2-FX1): a machine-event cue cuts a walk with more than reactHaltMinLeftMs (250 ms) left at its due time. The walk here is about
  // 5.1 s (41 drawn ticks at 8 fps); a cue lands 4.2 s in, so 0.6 s is left at the due time (0.3 s delay): the walk is cut.
  it('a cue with 600 ms of walk left at its due time cuts the walk: the reaction starts within one walk tick of its due time', () => {
    for (const dt of DTS) {
      const ctx = ctxFor('inspector', 1, 'fps8', 1500, { spots: FAR_SPOTS.inspector });
      const run = presentCue('inspector', 1, ctx, 'fault', 300, true, dt, TOTAL_MS, 4200);
      expect(run, 'a walk in progress at the cue').not.toBeNull();
      if (run === null) continue;
      const due = run.cueMs + 300;
      const reaction = reactionOf(run, 'startle');
      expect(reaction, 'startle reacts').toBeDefined();
      if (reaction === undefined) continue;
      expect(reaction.atMs - due, 'not before its due time').toBeGreaterThanOrEqual(-1e-6);
      expect(reaction.atMs - due, 'within one walk tick of its due time (the cut)').toBeLessThanOrEqual(TICK_125 + 1e-6);
      const cut = run.log.find((e) => e.walked && !e.reaction && Math.abs(e.atMs + e.durMs - reaction.atMs) < 1e-6);
      expect(cut, 'the walk the cue cut ends where the reaction starts').toBeDefined();
      expect(cut?.durMs ?? Infinity, 'the cut walk is shorter than the full walk (41 drawn ticks)').toBeLessThan(41 * TICK_125);
    }
  });

  // The same walk with 4.6 s to its cue: 250 ms or less is left at the due time (dt 16.7 and 100 ms), so the walk is not cut.
  it('a cue with 250 ms or less of walk left at its due time is not cut: the reaction starts at the arrival, the walk runs its full length', () => {
    for (const dt of DTS) {
      const ctx = ctxFor('inspector', 1, 'fps8', 1500, { spots: FAR_SPOTS.inspector });
      const run = presentCue('inspector', 1, ctx, 'fault', 300, true, dt, TOTAL_MS, 4600);
      expect(run, 'a walk in progress at the cue').not.toBeNull();
      if (run === null) continue;
      const walk = run.log.find((e) => e.walked && !e.reaction && e.atMs <= run.cueMs && e.atMs + e.durMs > run.cueMs);
      const reaction = reactionOf(run, 'startle');
      expect(walk, 'the walk in progress at the cue').toBeDefined();
      expect(reaction, 'startle reacts').toBeDefined();
      if (walk === undefined || reaction === undefined) continue;
      expect(walk.durMs, 'the walk is not cut').toBeGreaterThan(4000);
      expect(Math.abs(reaction.atMs - (walk.atMs + walk.durMs)), 'the reaction waits for the arrival').toBeLessThan(1e-6);
      expect(reaction.atMs - (run.cueMs + 300), 'the arrival is at most 250 ms after the due time').toBeLessThanOrEqual(250 + 1e-6);
    }
  });

  // WP28b B3 at fps2 (the 500 ms tick): a cue due with more than reactHaltMinLeftMs of walk left cuts the walk at its next drawn tick, so the
  // reaction starts within one tick of its due time. The walk is about 20 s here (41 drawn ticks); the cue lands 4.2 s in.
  it('at fps2 a cue with 600 ms of walk left cuts the walk at its next drawn tick: the reaction starts within one 500 ms tick of its due time', () => {
    const TICK_500 = 1000 / WORLD_PLAYBACK.fps.fps2;
    for (const dt of DTS) {
      const ctx = ctxFor('inspector', 1, 'fps2', 1500, { spots: FAR_SPOTS.inspector });
      const run = presentCue('inspector', 1, ctx, 'fault', 300, true, dt, 2 * TOTAL_MS, 4200);
      expect(run, 'a walk in progress at the cue').not.toBeNull();
      if (run === null) continue;
      const due = run.cueMs + 300;
      const reaction = reactionOf(run, 'startle');
      expect(reaction, 'startle reacts').toBeDefined();
      if (reaction === undefined) continue;
      expect(reaction.atMs - due, 'not before its due time').toBeGreaterThanOrEqual(-1e-6);
      expect(reaction.atMs - due, 'within one 500 ms tick of its due time (the cut)').toBeLessThanOrEqual(TICK_500 + 1e-6);
      const cut = run.log.find((e) => e.walked && !e.reaction && Math.abs(e.atMs + e.durMs - reaction.atMs) < 1e-6);
      expect(cut, 'the walk the cue cut ends where the reaction starts').toBeDefined();
      if (cut === undefined) continue;
      const ticks = (reaction.atMs - cut.atMs) / TICK_500;
      expect(Math.abs(ticks - Math.round(ticks)), 'the cut lands on a drawn tick of the walk').toBeLessThan(1e-6);
      expect(cut.durMs, 'the cut walk is shorter than the full walk (41 drawn ticks)').toBeLessThan(41 * TICK_500);
    }
  });

  // The bound a machine-event reaction keeps: the stagger band's top plus the larger of the 250 ms cut threshold and one drawn tick (a cut lands
  // on the next tick; a cue that is not cut starts at the arrival, at most 250 ms later). Looped over the playback fps (WP28b B3, r2-FX1). The
  // Inspector's find uses findDelayMs (he points 2-4 s after the spawn), so it is exempt. Walkers: the Inspector and the dog (the crow and the
  // girl never walk).
  it('the cut bound (stagger max + max(250 ms, one drawn tick)) is within 1.0 s for each walker and each halt cue, the Inspector find excepted', () => {
    for (const mode of ['fps2', 'fps4', 'fps8'] as const) {
      const tick = 1000 / WORLD_PLAYBACK.fps[mode];
      for (const actor of ['inspector', 'dog'] as const) {
        for (const cue of WORLD_REACT.haltCues) {
          if (actor === 'inspector' && cue === 'find') continue;
          const bound = WORLD_REACT.staggerMs[actor][1] + Math.max(WORLD_BEHAVIOUR.reactHaltMinLeftMs, tick);
          // A documented exception (CHANGELOG 0.12.0 deviations): at fps2 the dog's 500 ms tick puts its bound at 1.1 s, not 1.0 s.
          if (mode === 'fps2' && actor === 'dog') expect(bound, `${mode} ${actor} ${cue}`).toBe(1100);
          else expect(bound, `${mode} ${actor} ${cue}`).toBeLessThanOrEqual(1000);
        }
      }
    }
  });
});

describe('findSidesOf and visitFor (WP28b F25, F29)', () => {
  const A = MACHINE_ANCHOR.x;
  it('a Find on the actor side and farther from the anchor is outer, never inner', () => {
    expect(findSidesOf(HOME_L, 1000, A)).toEqual({ outer: true, inner: false });
    expect(findSidesOf(HOME_R, 3000, A)).toEqual({ outer: true, inner: false });
  });
  it('a Find on the actor side and nearer the anchor is inner, not outer', () => {
    expect(findSidesOf(1000, 1500, A)).toEqual({ outer: false, inner: true });
    expect(findSidesOf(3000, 2400, A)).toEqual({ outer: false, inner: true });
  });
  it('a Find on the far wing is inner, not outer: the Inspector looks, the dog sniffs in place', () => {
    expect(findSidesOf(HOME_L, 2600, A)).toEqual({ outer: false, inner: true });
    expect(findSidesOf(HOME_R, 1000, A)).toEqual({ outer: false, inner: true });
  });
  it('no Find: neither side', () => {
    expect(findSidesOf(HOME_L, null, A)).toEqual({ outer: false, inner: false });
  });
  it('findOuterOf is the outer test of findSidesOf on its own (WP28b r2-FX1: the Director calls it per frame)', () => {
    for (let actorX = 600; actorX <= 3200; actorX += 80) {
      for (let findX = 600; findX <= 3200; findX += 110) {
        expect(findOuterOf(actorX, findX, A), `actor ${actorX} find ${findX}`).toBe(findSidesOf(actorX, findX, A).outer);
      }
    }
    expect(findOuterOf(HOME_L, 1000, A)).toBe(true);
    expect(findOuterOf(HOME_L, 2600, A), 'the far wing is never outer').toBe(false);
    expect(findOuterOf(1800, 1800, A), 'an equal distance is not farther').toBe(false);
    expect(findOuterOf(1800, 2040, A), 'an equal distance on the far wing is not farther').toBe(false);
  });
  it('a Find at the actor distance from the anchor is inner (equal is not farther), on his side or on the far wing', () => {
    expect(findSidesOf(1800, 1800, A)).toEqual({ outer: false, inner: true });
    expect(findSidesOf(1800, 2040, A)).toEqual({ outer: false, inner: true });
  });
  it('a Find on the far wing reaches the Inspector as lookFind and the dog as sniffHere, never as point or sniffFind', () => {
    const cueStream = (): CueAt[] => Array.from({ length: 6 }, (_, k) => ({ step: stepAt((k + 1) * CUE_EVERY_MS, STEP), id: 'find' as CueId, index: k + 1 }));
    const namesOf = (actor: BehaviourActor, home: number, findX: number): string[] => {
      const sides = findSidesOf(home, findX, A);
      return playCued(actor, behaviourSeed(1, actor), ctxFor(actor, 1, 'fps8', home, { spots: [], findX, findOuter: sides.outer, findInner: sides.inner }),
        STEP, 7 * CUE_EVERY_MS, cueStream()).filter((e) => e.reaction).map((e) => e.activity);
    };
    expect(namesOf('inspector', HOME_L, 2600)).toEqual(Array(6).fill('lookFind'));
    expect(namesOf('dog', HOME_R, 1000)).toEqual(Array(6).fill('sniffHere'));
  });
  it('a woken Splice has its stand: the Inspector on left-wing objects, the dog on right-wing ones, from the listed spots', () => {
    expect(visitFor('e1', 'spliceOrgan', 1, 'mid')).toEqual({ actor: 'inspector', spot: 'v1' });
    expect(visitFor('e1', 'spliceBicycle', 1, 'home')).toEqual({ actor: 'dog', spot: 'v1' });
    expect(visitFor('e1', 'spliceClock', 1, 'stake')).toEqual({ actor: 'dog', spot: 'v2' });
    expect(visitFor('s15', 'spliceRadio', 5, 'y2')).toEqual({ actor: 'inspector', spot: 'v2' });
    expect(visitFor('s15', 'spliceRadio', 5, 'y1'), 'the walk from y1 would cross the gramophone base (WP28b A14)').toBeNull();
  });
  it('the s11 radio has no stand: the far girl mini blocks every x its 24-48 px offset allows (WP28b B)', () => {
    expect(visitFor('s11', 'spliceRadio', 3, 'mid')).toBeNull();
  });
  it('no stand from a spot the walk is not clean from (a visit would cross the object base), and none without a walker spot', () => {
    expect(visitFor('e1', 'spliceBicycle', 1, 'sensor')).toBeNull();
    expect(visitFor('e1', 'spliceBicycle', 1, null)).toBeNull();
    expect(visitFor('s8', 'splicePayphone', 2, 'y1')).toBeNull();
  });
  it('no stand for an exempt object, and none outside the stand era range (the s11 gramophone has none: era IV plays no visit; the cairn is era V)', () => {
    expect(visitFor('s9', 'spliceBicycle', 2, 'home')).toBeNull();
    expect(visitFor('s15', 'spliceChimes', 5, 'home')).toBeNull();
    expect(visitFor('s11', 'spliceGramophone', 4, 'y1')).toBeNull();
    expect(visitFor('s11', 'spliceGramophone', 5, 'y1')).toBeNull();
    expect(visitFor('s15', 'spliceGramophone', 5, 'y1')).toEqual({ actor: 'inspector', spot: 'v3' });
    expect(visitFor('s11', 'spliceCairn', 4, 'y1')).toBeNull();
    expect(visitFor('s11', 'spliceCairn', 5, 'y1')).toEqual({ actor: 'inspector', spot: 'v2' });
  });
  it('with the visit spot named (e1, both actors) the walker walks to v1 and runs its visit within 15 s', () => {
    for (const actor of ['inspector', 'dog'] as const) {
      const spots: readonly SpotLike[] = WORLD_SPOTS.e1?.[actor] ?? [];
      const v1 = spots.find((s) => s.id === 'v1');
      expect(v1, `${actor} v1`).toBeDefined();
      if (v1 === undefined) continue;
      const home = actor === 'inspector' ? 1440 : 2364;
      const visit = actor === 'inspector' ? 'visitWrite' : 'visitSniff';
      const seed = behaviourSeed(1, actor);
      const ctx = ctxFor(actor, 1, 'fps8', home, { spots, visitSpot: 'v1' });
      const r = createBehaviourRunner(actor, seed, STUB_CONDUCTOR, () => undefined);
      r.reset(seed, 0, home);
      let arrivedMs = -1;
      for (let i = 0; i < 150; i++) {
        const delay: Partial<Record<BehaviourActor, number>> = {};
        delay[actor] = 3000;
        const cues = i === 4 ? [{ id: 'splice' as CueId, index: 1, delayMs: delay }] : [];
        const f = r.step(100, { ...ctx, cues });
        if (arrivedMs < 0 && f.activity === visit && !f.walking && f.x === v1.x && f.lane === (v1.lane ?? 0)) arrivedMs = (i + 1) * 100;
      }
      expect(arrivedMs, `${actor} visits v1 within 15 s`).toBeGreaterThan(0);
      expect(arrivedMs, `${actor} visit time`).toBeLessThanOrEqual(15000);
    }
  });
  it('plain travel never rests on a visit spot: 20 min of both walkers with no visit named', () => {
    for (const actor of ['inspector', 'dog'] as const) {
      const spots: readonly SpotLike[] = WORLD_SPOTS.e1?.[actor] ?? [];
      const visitAt = new Set(spots.filter((s) => s.id.startsWith('v')).map((s) => `${s.x}@${s.lane ?? 0}`));
      const home = actor === 'inspector' ? 1440 : 2364;
      const seen: string[] = [];
      playRunner(actor, behaviourSeed(1, actor), ctxFor(actor, 1, 'fps8', home, { spots }), 100, 20 * MIN, {
        visit: (f) => {
          if (!f.walking && visitAt.has(`${f.x}@${f.lane}`)) seen.push(`${f.activity} ${f.x}@${f.lane}`);
        },
      });
      expect(seen, actor).toEqual([]);
    }
  });
});

// WP28b AD4 C_wave and C_era: a bigBuy, an era card and a fault reach the cast at their delays (from rest and from a walk), each cue at most
// once per pairCooldownMs per actor. Steps of 16.7 and 100 ms.
describe('the cues reach the cast at their delays (WP28b AD4 C_wave, C_era)', () => {
  const DTS: readonly number[] = [1000 / 60, 100];
  const TOTAL_MS = 40000;
  // The dog's right-wing spots of the inner test (stake, home, out) and the Inspector's left-wing ones (sensor, mid, scrap).
  const DOG_RIGHT: readonly SpotLike[] = [{ id: 'stake', x: 2376 }, { id: 'home', x: 2400 }, { id: 'out', x: 2424 }];
  const INS_LEFT: readonly SpotLike[] = [{ id: 'sensor', x: 76 }, { id: 'mid', x: 100 }, { id: 'scrap', x: 124 }];
  for (const dt of DTS) {
    it(`bigBuy at ${dt.toFixed(1)} ms: the Inspector startles at 800 ms and the dog looks big at 1500 ms, from rest and from a walk; the crow ruffles`, () => {
      const rest: { p: Presented | null; id: string; delay: number }[] = [
        { p: presentCue('inspector', 1, ctxFor('inspector', 1, 'fps8', HOME_L, { spots: [] }), 'bigBuy', 800, false, dt, TOTAL_MS), id: 'startle', delay: 800 },
        { p: presentCue('dog', 1, ctxFor('dog', 1, 'fps8', HOME_R, { spots: [] }), 'bigBuy', 1500, false, dt, TOTAL_MS), id: 'lookBig', delay: 1500 },
        { p: presentCue('crow', 1, ctxFor('crow', 1, 'fps8', HOME_R, { spots: [] }), 'bigBuy', 900, false, dt, TOTAL_MS), id: 'ruffleReact', delay: 900 },
      ];
      const walk: { p: Presented | null; id: string; delay: number }[] = [
        { p: presentCue('inspector', 1, ctxFor('inspector', 1, 'fps8', 1500, { spots: FAR_SPOTS.inspector }), 'bigBuy', 800, true, dt, TOTAL_MS), id: 'startle', delay: 800 },
        { p: presentCue('dog', 1, ctxFor('dog', 1, 'fps8', 2400, { spots: FAR_SPOTS.dog }), 'bigBuy', 1500, true, dt, TOTAL_MS), id: 'lookBig', delay: 1500 },
      ];
      for (const { p, id, delay } of [...rest, ...walk]) {
        const e = reactionOf(p, id);
        expect(e, `${id} reacts`).toBeDefined();
        if (p === null || e === undefined) continue;
        expect(e.atMs - p.cueMs, `${id} at its delay`).toBeGreaterThanOrEqual(delay - 1e-6);
        expect(e.atMs - p.cueMs, `${id} within delay + 1.0 s`).toBeLessThanOrEqual(delay + 1000);
      }
      // At rest the reaction starts at its delay, or one walk tick later when a walk is cut at the due time.
      for (const { p, id, delay } of rest) {
        const e = reactionOf(p, id);
        if (p !== null && e !== undefined) expect(e.atMs - p.cueMs, `${id} at rest`).toBeLessThanOrEqual(delay + TICK_125 + 1e-6);
      }
    });
  }

  it('an era card at rest: the Inspector walks to his inner-most spot and holds front-on; the dog walks to its inner-most spot and holds head-on', () => {
    for (const dt of DTS) {
      const ins = presentCue('inspector', 1, ctxFor('inspector', 1, 'fps8', 100, { spots: INS_LEFT }), 'era', 400, false, dt, TOTAL_MS);
      const dog = presentCue('dog', 1, ctxFor('dog', 1, 'fps8', 2400, { spots: DOG_RIGHT }), 'era', 600, false, dt, TOTAL_MS);
      const cases: { p: Presented | null; actor: 'inspector' | 'dog'; id: string; frame: string; inner: number; home: number }[] = [
        { p: ins, actor: 'inspector', id: 'eraFront', frame: 'front', inner: 124, home: 100 },
        { p: dog, actor: 'dog', id: 'eraHead', frame: 'head', inner: 2376, home: 2400 },
      ];
      for (const { p, actor, id, frame, inner, home } of cases) {
        expect(p, `${actor} era`).not.toBeNull();
        if (p === null) continue;
        expect(reactionOf(p, id), `${actor} ${id}`).toBeDefined();
        const holds = p.frames.filter((fr) => fr.activity === id && !fr.walking);
        expect(holds.length, `${actor} holds`).toBeGreaterThan(0);
        expect(new Set(holds.map((fr) => fr.x)), `${actor} inner-most spot`).toEqual(new Set([inner]));
        expect(new Set(holds.map((fr) => fr.frame)), `${actor} front-on frame`).toEqual(new Set([frame]));
        expect(holds.every((fr) => fr.flip === restFlip(actor, frame, false, home)), `${actor} faces away`).toBe(true);
      }
    }
  });

  it('a fault at rest: the Inspector startles at 300 ms, the dog barks at 500 ms and the crow ruffles at 900 ms', () => {
    for (const dt of DTS) {
      const ins = presentCue('inspector', 1, ctxFor('inspector', 1, 'fps8', HOME_L, { spots: [] }), 'fault', 300, false, dt, TOTAL_MS);
      const dog = presentCue('dog', 1, ctxFor('dog', 1, 'fps8', HOME_R, { spots: [] }), 'fault', 500, false, dt, TOTAL_MS);
      const crow = presentCue('crow', 1, ctxFor('crow', 1, 'fps8', HOME_R, { spots: [] }), 'fault', 900, false, dt, TOTAL_MS);
      const lag = (p: Presented | null, id: string): number => (reactionOf(p, id)?.atMs ?? NaN) - (p?.cueMs ?? NaN);
      expect(lag(ins, 'startle'), 'startle at its delay').toBeGreaterThanOrEqual(300 - 1e-6);
      expect(lag(ins, 'startle'), 'startle within a tick').toBeLessThanOrEqual(300 + TICK_125 + 1e-6);
      expect(lag(dog, 'bark'), 'bark at its delay').toBeGreaterThanOrEqual(500 - 1e-6);
      expect(lag(dog, 'bark'), 'bark within a tick').toBeLessThanOrEqual(500 + TICK_125 + 1e-6);
      expect(lag(crow, 'ruffleReact'), 'ruffle at its delay').toBeGreaterThanOrEqual(900 - 1e-6);
      expect(lag(crow, 'ruffleReact'), 'ruffle within a tick').toBeLessThanOrEqual(900 + TICK_125 + 1e-6);
    }
  });

  it('each cue reacts at most once per pairCooldownMs per actor: a cue every 2 s for 60 s gives at most two reactions, 30 s apart', () => {
    const COMBOS: readonly { actor: BehaviourActor; cue: CueId; id: string }[] = [
      { actor: 'inspector', cue: 'fault', id: 'startle' }, { actor: 'dog', cue: 'fault', id: 'bark' },
      { actor: 'crow', cue: 'fault', id: 'ruffleReact' }, { actor: 'inspector', cue: 'bigBuy', id: 'startle' },
      { actor: 'dog', cue: 'bigBuy', id: 'lookBig' }, { actor: 'crow', cue: 'bigBuy', id: 'ruffleReact' },
      { actor: 'inspector', cue: 'era', id: 'eraFront' }, { actor: 'dog', cue: 'era', id: 'eraHead' },
    ];
    for (const c of COMBOS) {
      const ctx = ctxFor(c.actor, 1, 'fps8', c.actor === 'inspector' ? HOME_L : HOME_R, { spots: [] });
      const cues: CueAt[] = [];
      for (let k = 1; k <= 30; k++) cues.push({ step: stepAt(k * 2000, STEP), id: c.cue, index: k });
      const starts = playCued(c.actor, behaviourSeed(1, c.actor), ctx, STEP, 62000, cues)
        .filter((e) => e.reaction && e.activity === c.id).map((e) => e.atMs);
      const band = WORLD_REACT.staggerMs[c.actor][1] - WORLD_REACT.staggerMs[c.actor][0];
      expect(starts.length, `${c.actor} ${c.cue} starts`).toBeGreaterThan(0);
      expect(starts.length, `${c.actor} ${c.cue} at most two`).toBeLessThanOrEqual(2);
      for (let i = 1; i < starts.length; i++) {
        expect((starts[i] ?? 0) - (starts[i - 1] ?? 0), `${c.actor} ${c.cue} gap`).toBeGreaterThanOrEqual(WORLD_REACT.pairCooldownMs - band);
      }
    }
  });
});

// ---- WP28b AD4 F41, F47: a machine-event cue pre-empts an interruptible reaction or visit (F41a), a due reaction whose 'when' fails re-picks
// its cue's sibling (F41b), a rapid burst always ruffles the crow (F47, chance 1). Era IV is unchanged (R3); a non-machine cue still yields. ----
describe('machine-event cues pre-empt busy actors and re-pick their sibling (WP28b AD4 F41, F47)', () => {
  // A runner with a context per step (ctxAt) and the cues at their steps: the closed segments of the run.
  const runSteps = (actor: BehaviourActor, seed: number, ctxAt: (i: number) => BehaviourCtx, cues: readonly CueAt[], totalMs: number):
    BehaviourLogEntry[] => {
    const log: BehaviourLogEntry[] = [];
    const r = createBehaviourRunner(actor, seed, STUB_CONDUCTOR, (e) => log.push(e));
    r.reset(seed, 0, ctxAt(0).homeX);
    for (let i = 0; i < Math.round(totalMs / STEP); i++) {
      const due = cues.filter((c) => c.step === i).map((c) => ({ id: c.id, index: c.index }));
      r.step(STEP, { ...ctxAt(i), cues: due });
    }
    return log;
  };
  // The first chance-passing cue index from `from` on (the default chance gate).
  const passingFrom = (seed: number, from: number): number => {
    for (let j = from; ; j++) {
      if (hash01(seed + WORLD_BEHAVIOUR.salts.react, j) < WORLD_REACT.chance) return j;
    }
  };
  // The dog in era I on no travel: a crowMove cue at step 4 starts its lookUp reaction (the crowMove answer, an interruptible reaction).
  const dogLookUp = (): { seed: number; ctx: BehaviourCtx; j: number; look: BehaviourLogEntry } | undefined => {
    const seed = behaviourSeed(1, 'dog');
    const ctx = ctxFor('dog', 1, 'fps8', HOME_R, { spots: [] });
    const j = passingIndex(seed);
    const look = playCued('dog', seed, ctx, STEP, 30 * MIN, [{ step: 4, id: 'crowMove', index: j }]).find((e) => e.reaction);
    return look === undefined ? undefined : { seed, ctx, j, look };
  };

  it('a fault during an ambient reaction starts the bark: the dog in its crowMove lookUp is pre-empted (AD4 F41a, the e1 case)', () => {
    const found = dogLookUp();
    expect(found?.look.activity, 'the crowMove reaction is the lookUp').toBe('lookUp');
    if (found === undefined) return;
    const { seed, ctx, j, look } = found;
    const fault: CueAt = { step: stepAt(look.atMs + 1000, STEP), id: 'fault', index: j + 1 };
    const log = playCued('dog', seed, ctx, STEP, 30 * MIN, [{ step: 4, id: 'crowMove', index: j }, fault]);
    const cueMs = (fault.step + 1) * STEP;
    const bark = log.find((e) => e.reaction && e.activity === 'bark');
    expect(bark, 'the bark starts').toBeDefined();
    if (bark === undefined) return;
    const [lo, hi] = WORLD_REACT.staggerMs.dog;
    expect(bark.atMs - cueMs, 'the dog band').toBeGreaterThanOrEqual(lo - 1e-6);
    expect(bark.atMs - cueMs, 'the dog band').toBeLessThanOrEqual(hi + STEP);
    // The lookUp it pre-empts ends where the bark starts, as an interrupt ends it.
    const cut = log.find((e) => e.reaction && e.activity === 'lookUp');
    expect(cut !== undefined && Math.abs(cut.atMs + cut.durMs - bark.atMs) < 1e-6, 'the lookUp ends at the bark').toBe(true);
  });

  it('a non-machine cue still yields to the reaction: a ring during the crowMove lookUp starts nothing (only machine-event cues pre-empt)', () => {
    const found = dogLookUp();
    expect(found?.look.activity, 'the crowMove reaction is the lookUp').toBe('lookUp');
    if (found === undefined) return;
    const { seed, ctx, j, look } = found;
    const ring: CueAt = { step: stepAt(look.atMs + 1000, STEP), id: 'ring', index: passingFrom(seed, j + 1) };
    const log = playCued('dog', seed, ctx, STEP, 30 * MIN, [{ step: 4, id: 'crowMove', index: j }, ring]);
    expect(log.filter((e) => e.reaction).map((e) => e.activity)).toEqual(['lookUp']);
  });

  it('a non-interruptible reaction still blocks a machine-event cue: the era cue during the startle is dropped (AD4 F41a)', () => {
    const seed = behaviourSeed(1, 'inspector');
    const ctx = ctxFor('inspector', 1, 'fps8', HOME_L, { spots: [] });
    const log = playCued('inspector', seed, ctx, STEP, 30000, [{ step: 4, id: 'fault', index: 1 }, { step: 7, id: 'era', index: 2 }]);
    expect(log.some((e) => e.reaction && e.activity === 'startle'), 'the fault starts the startle').toBe(true);
    expect(log.some((e) => e.activity === 'eraFront'), 'the era cue is dropped under the startle').toBe(false);
  });

  it('an era cue during a visit starts eraFront: the Inspector on his Splice visit is pre-empted (AD4 F41a, the s10 case)', () => {
    const seed = behaviourSeed(1, 'inspector');
    const spots: SpotLike[] = [...INS3, { id: 'v1', x: 60 }];
    const ctx = ctxFor('inspector', 1, 'fps8', 100, { spots, visitSpot: 'v1' });
    const splice: CueAt = { step: 10, id: 'splice', index: 1 };
    const visit = playCued('inspector', seed, ctx, STEP, 30000, [splice]).find((e) => e.reaction && e.activity === 'visitWrite');
    expect(visit, 'the splice starts the visit').toBeDefined();
    if (visit === undefined) return;
    // The era card closes 1.5 s into the visit (its walk is done; the hold runs 4-8 s).
    const era: CueAt = { step: stepAt(visit.atMs + 1500, STEP), id: 'era', index: 2 };
    const log = playCued('inspector', seed, ctx, STEP, 30000, [splice, era]);
    const eraMs = (era.step + 1) * STEP;
    const front = log.find((e) => e.reaction && e.activity === 'eraFront' && e.atMs >= eraMs);
    expect(front, 'eraFront starts during the visit').toBeDefined();
    if (front === undefined) return;
    const [lo, hi] = WORLD_REACT.staggerMs.inspector;
    expect(front.atMs - eraMs, 'the inspector band').toBeGreaterThanOrEqual(lo - 1e-6);
    expect(front.atMs - eraMs, 'the inspector band').toBeLessThanOrEqual(hi + STEP);
    const cut = log.find((e) => e.reaction && e.activity === 'visitWrite' && e.atMs === visit.atMs);
    expect(cut !== undefined && Math.abs(cut.atMs + cut.durMs - front.atMs) < 1e-6, 'the visit ends where eraFront starts').toBe(true);
  });

  // A context with a Find on one side of the actor (or on neither side) and the Find's x.
  const sideCtx = (actor: BehaviourActor, home: number, side: 'findOuter' | 'findInner' | null): BehaviourCtx =>
    ctxFor(actor, 1, 'fps8', home, { spots: [], findX: 1500, findOuter: side === 'findOuter', findInner: side === 'findInner' });

  it('a Find the walker crosses before its due time: the sibling answer starts (AD4 F41b: point and lookFind, sniffFind and sniffHere)', () => {
    const cases: readonly { actor: 'inspector' | 'dog'; home: number; was: 'findOuter' | 'findInner'; now: 'findOuter' | 'findInner';
      first: string; second: string }[] = [
      { actor: 'inspector', home: HOME_L, was: 'findOuter', now: 'findInner', first: 'point', second: 'lookFind' },
      { actor: 'inspector', home: HOME_L, was: 'findInner', now: 'findOuter', first: 'lookFind', second: 'point' },
      { actor: 'dog', home: HOME_R, was: 'findOuter', now: 'findInner', first: 'sniffFind', second: 'sniffHere' },
      { actor: 'dog', home: HOME_R, was: 'findInner', now: 'findOuter', first: 'sniffHere', second: 'sniffFind' },
    ];
    for (const c of cases) {
      const before = sideCtx(c.actor, c.home, c.was);
      const after = sideCtx(c.actor, c.home, c.now);
      // The cue lands at 1.1 s on the clock (step 10) and the walker crosses the Find's x at 1.2 s: before the dog's due time (0.4 s after
      // the cue at the earliest) and the Inspector's (2 s after).
      const log = runSteps(c.actor, behaviourSeed(1, c.actor), (i) => (i < 11 ? before : after), [{ step: 10, id: 'find', index: 1 }], 30000);
      const reactions = log.filter((e) => e.reaction);
      expect(reactions.map((e) => e.activity), `${c.actor} ${c.was} then ${c.now} (${c.first} before)`).toEqual([c.second]);
      const [lo, hi] = c.actor === 'inspector' ? WORLD_REACT.findDelayMs : WORLD_REACT.staggerMs.dog;
      const lag = (reactions[0]?.atMs ?? NaN) - 1100;
      expect(lag, `${c.actor} sibling band`).toBeGreaterThanOrEqual(lo - 1e-6);
      expect(lag, `${c.actor} sibling band`).toBeLessThanOrEqual(hi + STEP);
    }
  });

  it('a Find on neither side at its due time is dropped: no sibling passes (AD4 F41b drops only when none passes)', () => {
    const log = runSteps('inspector', behaviourSeed(1, 'inspector'), (i) => (i < 11 ? sideCtx('inspector', HOME_L, 'findOuter')
      : sideCtx('inspector', HOME_L, null)), [{ step: 10, id: 'find', index: 1 }], 30000);
    expect(log.some((e) => e.reaction)).toBe(false);
  });

  it('a rapid burst always ruffles the crow (AD4 F47, chance 1): every burst of five seeds starts ruffleReact in its band', () => {
    for (let s = 1; s <= 5; s++) {
      const log = playCued('crow', behaviourSeed(s, 'crow'), ctxFor('crow', 1, 'fps8', HOME_R, { spots: [] }), STEP, 20000,
        [{ step: 60, id: 'rapid', index: 1 }]);
      const ruffle = log.find((e) => e.reaction && e.activity === 'ruffleReact');
      expect(ruffle, `seed ${s} ruffles`).toBeDefined();
      if (ruffle === undefined) continue;
      const [lo, hi] = WORLD_REACT.latencyMs.crow;
      expect(ruffle.atMs - 6100, `seed ${s} band`).toBeGreaterThanOrEqual(lo - 1e-6);
      expect(ruffle.atMs - 6100, `seed ${s} band`).toBeLessThanOrEqual(hi + STEP);
    }
  });
});

// ---- WP28b AD4 F42: the startle under the start gate. The Inspector's startle is 2 frames at 1 fps (holdMs 1.8-2.0 s), so a hold stretched past
// 2 s wraps the clip. Its capMs 2000 keeps the start gate (guardHold) under 2 s. The scan runs the Inspector with the dog and the crow on one gate
// and one clock, with a fault every 30 s over 12 min. ----
const STARTLE_SEEDS = 50;
const STARTLE_SCAN_MS = 12 * MIN;
const STARTLE_DT = 50;
const STARTLE_FAULT_MS = 30000;
const STARTLE_CAST: readonly { actor: BehaviourActor; home: number }[] = [
  { actor: 'inspector', home: HOME_L }, { actor: 'dog', home: HOME_R }, { actor: 'crow', home: HOME_R },
];
// The Inspector's startles in one era over `seeds` seeds, the three denizens of STARTLE_CAST on one start gate: the count, the longest and the
// count at 2000 ms or more.
function scanStartles(era: WorldEra, seeds: number): { n: number; maxDurMs: number; over: number } {
  let n = 0;
  let maxDurMs = 0;
  let over = 0;
  for (let s = 1; s <= seeds; s++) {
    const gate = createStartGate();
    const inspector: BehaviourLogEntry[] = [];
    const runs = STARTLE_CAST.map(({ actor, home }) => {
      const seed = behaviourSeed(s, actor);
      const onLog = (e: BehaviourLogEntry): void => {
        if (actor === 'inspector') inspector.push(e);
      };
      const r = createBehaviourRunner(actor, seed, STUB_CONDUCTOR, onLog);
      r.reset(seed, 0, home);
      return { r, ctx: ctxFor(actor, era, 'fps8', home, { startGate: gate }) };
    });
    let k = 0;
    for (let i = 0; i < STARTLE_SCAN_MS / STARTLE_DT; i++) {
      // The clock after step i is (i + 1) x dt; a fault lands on every 30 s mark.
      const t = (i + 1) * STARTLE_DT;
      let cues: BehaviourCtx['cues'] = [];
      if (t % STARTLE_FAULT_MS === 0) {
        k++;
        cues = [{ id: 'fault', index: k }];
      }
      for (const { r, ctx } of runs) {
        ctx.cues = cues;
        r.step(STARTLE_DT, ctx);
      }
    }
    for (const e of inspector) {
      if (!e.reaction || e.activity !== 'startle') continue;
      n++;
      maxDurMs = Math.max(maxDurMs, e.durMs);
      if (e.durMs >= 2000) over++;
    }
  }
  return { n, maxDurMs, over };
}

describe('the startle under the start gate (WP28b AD4 F42)', () => {
  it('no fault startle reaches 2000 ms under the shared start gate (eras 1, 3 and 5)', () => {
    for (const era of [1, 3, 5] as const) {
      const { n, maxDurMs, over } = scanStartles(era, STARTLE_SEEDS);
      expect(n, `era ${era} startles`).toBeGreaterThan(100);
      expect(over, `era ${era}: startles at 2000 ms or more`).toBe(0);
      expect(maxDurMs, `era ${era}: longest startle`).toBeLessThan(2000);
    }
  });

  it('without the cap the same scan stretches a startle past 2000 ms (the gate matters)', () => {
    // The startle rows of the eras share one object, so each cap is saved in order and restored in reverse order.
    const saved: { act: Activity; capMs: number | undefined }[] = [];
    for (const era of [1, 2, 3, 5] as const) {
      for (const act of WORLD_REPERTOIRE.inspector[era] ?? []) {
        if (act.id !== 'startle') continue;
        saved.push({ act, capMs: act.capMs });
        delete act.capMs;
      }
    }
    try {
      expect(scanStartles(1, STARTLE_SEEDS).over).toBeGreaterThan(0);
    } finally {
      for (const { act, capMs } of saved.reverse()) {
        if (capMs === undefined) delete act.capMs;
        else act.capMs = capMs;
      }
    }
    expect(WORLD_REPERTOIRE.inspector[1]?.find((a) => a.id === 'startle')?.capMs).toBe(2000);
  });
});

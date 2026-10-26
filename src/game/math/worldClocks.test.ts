// Tests for worldClocks (WP24 T10b): the day minute (never falls within a cycle, the rate cap, the tint keys, the cycle and boot snaps,
// the demo cap, the ending hold, settle, the debug pin), the weather (era IV calm, era V still air with the dust breath, the vent puffs
// and the gust cues), the micro schedules (windows, holds, gaps, gates, reduced motion), the frozen tape and the queue gating. Fake clocks
// throughout: no Date, no Phaser. States come from deriveWorldState on the smoke stage buy lists (copied as literals); the era gates come
// from TECHNOLOGIES, every number from WORLD_DAY, WORLD_WEATHER, WORLD_AMBIENT and WORLD_TRANSITIONS.
import { describe, it, expect } from 'vitest';
import { TECHNOLOGIES } from '../../data/technologies';
import { RESOURCE_IDS } from '../../data/types';
import type { EndingPhase, ResourceId, TechId } from '../../data/types';
import { WORLD_AMBIENT, WORLD_DAY, WORLD_WEATHER } from '../../data/worldDay';
import type { MicroKind } from '../../data/worldDay';
import { WORLD_TRANSITIONS } from '../../data/worldTransitions';
import { eraResource } from '../../simulation/progression/era';
import { dayProgress, dayTargetMin, dayTint, dustDriftAt, lampGain, tintBrightness, weatherOf, windAt } from './worldDay';
import { deriveWorldState } from './worldState';
import type { WorldEra } from './worldState';
import { createWorldClocks } from './worldClocks';
import type { ClocksInput, ClocksOut, WorldClocks } from './worldClocks';

const STEP_MS = 250;
const MICRO_STEP_MS = 50;
const TEN_MIN_MS = 10 * 60 * 1000;
const MICRO_KINDS = Object.keys(WORLD_AMBIENT.micro) as MicroKind[];
const SAMPLED_KINDS = MICRO_KINDS.filter((kind): kind is Exclude<MicroKind, 'pages'> => kind !== 'pages');

// The smoke stage buy lists (scripts/smoke/stages.mjs), copied as literals.
const rep = (id: string, n: number): string[] => Array.from({ length: n }, () => id);
const S7 = ['wornMotor', 'gearRatio', 'gearRatio', 'gearRatio', 'reinforcedCrank', 'motorTuning', 'motorTuning', 'motorTuning',
  'motorTuning', 'motorTuning', 'flywheel', 'pistonArray', 'improvedPistons'];
const S9 = [...S7, '@blueprint', 'generator', ...rep('motorRetrofit', 5), ...rep('copperWinding', 20), 'dynamoCrank',
  'capacitorBank', 'sparkGap', ...rep('transformer', 3), 'powerLines'];
const S10 = [...S9, '@substationBlueprint', 'boiler'];
const S11 = [...S10, ...rep('inductionHeater', 3), ...rep('firebox', 20), 'steamHammer', 'superheater', ...rep('condenser', 5), 'turbine',
  'reliefValves', ...rep('bellowsDrive', 3), '@pressureVesselBlueprint'];
const S12 = [...S11, 'resonatorSpire'];
const S13 = [...S12, ...rep('crankServo', 3), ...rep('harmonicCoil', 25), ...rep('pressureResonator', 3), 'echoCrank', 'phaseLock',
  ...rep('standingWave', 3), 'crystalLattice', ...rep('gridExciter', 5), '@harmonicConvergence'];
const S14 = [...S13, 'nullChamber'];
// One buy list per era: era I to V with the valves (S11 is the era III front with vents).
const ERA_BUYS: Record<WorldEra, readonly string[]> = { 1: S7, 2: S9, 3: S11, 4: S12, 5: S14 };

// Tech levels of a buy list: plain id += 1; '@blueprint' = generatorBlueprint 1; '@tech' = 1; '@tech:n' = n.
function levelsOf(buys: readonly string[]): Record<TechId, number> {
  const out: Record<string, number> = {};
  for (const raw of buys) {
    if (raw.startsWith('@')) {
      const [name = '', n] = raw.slice(1).split(':');
      out[name === 'blueprint' ? 'generatorBlueprint' : name] = n === undefined ? 1 : Number(n);
    } else {
      out[raw] = (out[raw] ?? 0) + 1;
    }
  }
  return out as Record<TechId, number>;
}

// The lifetime amount of an era gate, read from TECHNOLOGIES.
function gateOf(era: WorldEra): number {
  const req = TECHNOLOGIES[WORLD_DAY.gates[era]].requires.find((r) => r.type === 'lifetime');
  if (req?.type !== 'lifetime') throw new Error(`no lifetime gate for era ${era}`);
  return req.amount;
}

function lifetimeOf(res: ResourceId, amount: number): Record<ResourceId, number> {
  const out = {} as Record<ResourceId, number>;
  for (const id of RESOURCE_IDS) out[id] = id === res ? amount : 0;
  return out;
}

interface Setup { phase?: EndingPhase; edition?: 'full' | 'demo'; reduced?: boolean; frozen?: boolean; indexOpen?: boolean }

// The clock input of a buy list at tape position x: the era resource at its gate × 10^x (x -3 is the band start, x 1 the band end).
function clocksIn(buys: readonly string[], x: number, o: Setup = {}): ClocksInput {
  const edition = o.edition ?? 'full';
  const phase = o.phase ?? 'none';
  const levels = levelsOf(buys);
  const state = deriveWorldState({ levels, lifetimeEe: 0, cycle: 0, edition, dogLies: false, motorRetrofitTier: 0, phase });
  return {
    state, levels, lifetime: lifetimeOf(eraResource(state.era), gateOf(state.era) * 10 ** x), edition, phase, cycle: 0,
    reduced: o.reduced ?? false, gates: { indexOpen: o.indexOpen ?? false, eraCardUp: false, modalOpen: false }, digBouts: 0,
    frozen: o.frozen ?? false,
  };
}

// Steps one input for durMs from `from` in stepMs ticks. The sink reads each output (the object is reused). Returns the clock at the end.
function run(c: WorldClocks, i: ClocksInput, from: number, durMs: number, stepMs: number,
  sink?: (o: ClocksOut, t: number) => void): number {
  let t = from;
  const n = Math.round(durMs / stepMs);
  for (let k = 0; k < n; k += 1) {
    t += stepMs;
    const o = c.step(stepMs, t, i);
    sink?.(o, t);
  }
  return t;
}

// A tint key: R >= G >= B (no blue, bible §2.4) and brightness of at least minBrightness (D5).
function expectDayColour(rgb: number): void {
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = rgb & 0xff;
  expect(r).toBeGreaterThanOrEqual(g);
  expect(g).toBeGreaterThanOrEqual(b);
  expect(tintBrightness(rgb)).toBeGreaterThanOrEqual(WORLD_DAY.minBrightness);
}

// Every value a frozen tape must hold, as one string.
function take(o: ClocksOut): string {
  return JSON.stringify({
    min: o.min, target: o.target, tint: o.tint, tintSnap: o.tintSnap, vents: o.ventPuffs, gusts: o.gusts, wind: o.ambient.wind,
    dust: o.ambient.dustDrift, virga: [o.ambient.virgaAlpha, o.ambient.virgaSpeed], lampGain: o.ambient.lampGain,
    shadow: [o.ambient.shadowDx, o.ambient.shadowWidth], tween: o.tween,
  });
}

// The [start, end) index runs of true in a series.
function runsOf(xs: readonly boolean[]): [number, number][] {
  const out: [number, number][] = [];
  let start = -1;
  xs.forEach((x, n) => {
    if (x && start < 0) start = n;
    if (!x && start >= 0) {
      out.push([start, n]);
      start = -1;
    }
  });
  if (start >= 0) out.push([start, xs.length]);
  return out;
}

// Samples every micro flag and the page counter of one state for ten minutes at MICRO_STEP_MS.
function sampleMicro(buys: readonly string[], reduced: boolean): { flags: Record<Exclude<MicroKind, 'pages'>, boolean[]>; pages: number[] } {
  const c = createWorldClocks(1);
  const i = clocksIn(buys, 0, { reduced });
  c.snap(i);
  const flags: Record<Exclude<MicroKind, 'pages'>, boolean[]> = {
    hitch: [], ledBlink: [], ledDim: [], lampDip: [], boothDip: [], girlWindowDim: [], clockTwitch: [],
  };
  const pages: number[] = [];
  run(c, i, 0, TEN_MIN_MS, MICRO_STEP_MS, (o) => {
    for (const kind of SAMPLED_KINDS) flags[kind].push(o.tween.micro[kind]);
    pages.push(o.tween.micro.pageStarts);
  });
  return { flags, pages };
}

describe('worldClocks: the day minute', () => {
  it('never falls within a cycle and moves at most maxRateMinPerS, walking all five bands with tint keys that stay neutral', () => {
    const c = createWorldClocks(1);
    c.snap(clocksIn(ERA_BUYS[1], -3));
    const maxStep = (WORLD_DAY.maxRateMinPerS * STEP_MS) / 1000;
    let prev: number = WORLD_DAY.startMin;
    let now = 0;
    for (const era of [1, 2, 3, 4, 5] as const) {
      c.setTarget(clocksIn(ERA_BUYS[era], -3), now);
      for (let j = 0; j <= 39; j += 1) {
        const i = clocksIn(ERA_BUYS[era], -3 + (4 * j) / 39);
        now = run(c, i, now, 2000, STEP_MS, (o) => {
          expect(o.min).toBeGreaterThanOrEqual(prev);
          expect(o.min - prev).toBeLessThanOrEqual(maxStep + 1e-9);
          expectDayColour(o.tint);
          prev = o.min;
        });
      }
    }
    expect(prev).toBeGreaterThan(WORLD_DAY.startMin);
  });

  it('ending phases hold 16:41 at once with the held tint and no wind; the postgame reads still', () => {
    const c = createWorldClocks(1);
    c.snap(clocksIn(ERA_BUYS[2], 0));
    let now = run(c, clocksIn(ERA_BUYS[2], 0), 0, 30000, STEP_MS);
    const ending = clocksIn(ERA_BUYS[2], 0, { phase: 'sequence' });
    c.setTarget(ending, now);
    const held = dayTint(WORLD_DAY.heldMin, 5, 1);
    now += STEP_MS;
    const first = c.step(STEP_MS, now, ending);
    expect(first.min).toBe(WORLD_DAY.heldMin);
    expect(first.tint).toBe(held);
    now = run(c, ending, now, 120000, STEP_MS, (o) => {
      expect(o.min).toBe(WORLD_DAY.heldMin);
      expect(o.target).toBe(WORLD_DAY.heldMin);
      expect(o.tint).toBe(held);
      expect(o.ambient.wind).toBe(0);
    });
    const postgame = clocksIn(ERA_BUYS[5], 1, { phase: 'postgame' });
    c.setTarget(postgame, now);
    run(c, postgame, now, 60000, STEP_MS, (o) => {
      expect(o.min).toBe(WORLD_DAY.heldMin);
      expect(o.tint).toBe(held);
      expect(o.ambient.wind).toBe(0);
    });
    expect(c.debugDay().weather).toBe('still');
  });

  it('a cycle snap returns the minute to startMin at once, and tintSnap rides the next output only', () => {
    const c = createWorldClocks(1);
    c.snap(clocksIn(ERA_BUYS[5], 1));
    const late = run(c, clocksIn(ERA_BUYS[5], 1), 0, 10000, STEP_MS);
    expect(c.debugDay().min).toBeGreaterThan(WORLD_DAY.startMin);
    c.reset(2);
    const fresh = clocksIn(ERA_BUYS[1], -3);
    c.snap(fresh);
    expect(c.debugDay().min).toBeCloseTo(WORLD_DAY.startMin, 6);
    const first = c.step(STEP_MS, late + STEP_MS, fresh);
    expect(first.min).toBeCloseTo(WORLD_DAY.startMin, 6);
    expect(first.tintSnap).toBe(true);
    expect(first.tint).toBe(dayTint(WORLD_DAY.startMin, 1, 0));
    const second = c.step(STEP_MS, late + 2 * STEP_MS, fresh);
    expect(second.tintSnap).toBe(false);
  });

  it('a boot snap lands the minute on its target at once', () => {
    const c = createWorldClocks(1);
    const i = clocksIn(ERA_BUYS[2], 0.5);
    c.snap(i);
    expect(c.debugDay().min).toBeCloseTo(dayTargetMin(i), 6);
    expect(c.debugDay().target).toBeCloseTo(dayTargetMin(i), 6);
  });

  it('the demo edition never moves the minute past its cap', () => {
    const c = createWorldClocks(1);
    const demo = clocksIn(ERA_BUYS[5], 1, { edition: 'demo' });
    c.snap(demo);
    run(c, demo, 0, 60000, STEP_MS, (o) => {
      expect(o.target).toBeLessThanOrEqual(WORLD_DAY.demoMaxMin);
      expect(o.min).toBeLessThanOrEqual(WORLD_DAY.demoMaxMin);
    });
  });

  it('settle makes the minute equal the target and the wind the era base, with no gusts', () => {
    const c = createWorldClocks(1);
    const i = clocksIn(ERA_BUYS[2], 0.5);
    c.snap(i);
    c.settle(true);
    expect(c.settling()).toBe(true);
    const base = weatherOf(2, dayProgress(i).p, 'none', i.state.vents).baseWind;
    run(c, i, 0, 60000, STEP_MS, (o) => {
      expect(o.min).toBe(o.target);
      expect(o.ambient.wind).toBe(base);
    });
    c.settle(false);
    expect(c.settling()).toBe(false);
  });

  it('holdDay pins the minute and the target and reports held; null releases the pin', () => {
    const c = createWorldClocks(1);
    const i = clocksIn(ERA_BUYS[2], 0);
    c.snap(i);
    c.holdDay(800);
    expect(c.debugDay()).toMatchObject({ min: 800, target: 800, held: true });
    const o = c.step(STEP_MS, STEP_MS, i);
    expect(o.min).toBe(800);
    expect(o.target).toBe(800);
    c.holdDay(null);
    expect(c.debugDay().held).toBe(false);
    run(c, i, STEP_MS, 10000, STEP_MS, (o) => {
      expect(o.min).toBeGreaterThanOrEqual(800);
    });
  });

  it('the tint and the lamp gain land on the next step after a pin, a settle or a snap, and stay within a minute on a ramp', () => {
    const c = createWorldClocks(1);
    const i = clocksIn(ERA_BUYS[2], 0);
    c.snap(i);
    const p = dayProgress(i).p;
    c.holdDay(900);
    const pinned = c.step(STEP_MS, STEP_MS, i);
    expect(pinned.tint).toBe(dayTint(900, 2, p));
    expect(pinned.ambient.lampGain).toBe(lampGain(900));
    c.holdDay(null);
    c.settle(true);
    const settled = c.step(STEP_MS, 2 * STEP_MS, i);
    expect(settled.min).toBe(settled.target);
    expect(settled.tint).toBe(dayTint(settled.min, 2, p));
    expect(settled.ambient.lampGain).toBe(lampGain(settled.min));
    c.settle(false);
    const late = clocksIn(ERA_BUYS[5], 1);
    c.snap(late);
    const snapped = c.step(STEP_MS, 3 * STEP_MS, late);
    expect(snapped.tint).toBe(dayTint(snapped.min, 5, dayProgress(late).p));
    expect(snapped.ambient.lampGain).toBe(lampGain(snapped.min));
    // A ramp from the start of the day to the end: the cached gain is one computed at a minute within 1 of the presented one.
    const ramp = createWorldClocks(1);
    ramp.snap(clocksIn(ERA_BUYS[1], -3));
    const far = clocksIn(ERA_BUYS[5], 1);
    ramp.setTarget(far, 0);
    let peakGain = 1;
    run(ramp, far, 0, 300000, STEP_MS, (o) => {
      expect(o.ambient.lampGain).toBeGreaterThanOrEqual(lampGain(o.min - 1) - 1e-9);
      expect(o.ambient.lampGain).toBeLessThanOrEqual(lampGain(o.min + 1) + 1e-9);
      peakGain = Math.max(peakGain, o.ambient.lampGain);
    });
    expect(peakGain).toBeGreaterThan(1);
  });
});

describe('worldClocks: the weather and the cues', () => {
  it('era IV is dead calm: the wind has eased to 0.05 or less from 60 s after the era IV entry', () => {
    const c = createWorldClocks(1);
    const three = clocksIn(ERA_BUYS[3], 1);
    c.snap(three);
    const now = run(c, three, 0, 30000, STEP_MS);
    const four = clocksIn(ERA_BUYS[4], 0);
    c.setTarget(four, now);
    run(c, four, now, 120000, STEP_MS, (o, t) => {
      if (t - now >= 60000) expect(o.ambient.wind).toBeLessThanOrEqual(0.05);
    });
  });

  it('era V keeps the air still and the dust breathing inside the canon band', () => {
    const c = createWorldClocks(1);
    const five = clocksIn(ERA_BUYS[5], 1);
    c.snap(five);
    let lo = Infinity;
    let hi = -Infinity;
    let windMax = 0;
    run(c, five, 0, 120000, STEP_MS, (o) => {
      lo = Math.min(lo, o.ambient.dustDrift);
      hi = Math.max(hi, o.ambient.dustDrift);
      windMax = Math.max(windMax, o.ambient.wind);
    });
    const amp = WORLD_WEATHER.dustDrift.amp;
    expect(windMax).toBe(0);
    expect(lo).toBeGreaterThanOrEqual(1 - amp - 1e-9);
    expect(hi).toBeLessThanOrEqual(1 + amp + 1e-9);
    expect(hi - lo).toBeGreaterThan(amp);
  });

  it('vent puffs come only in era III with the valves, 25 to 60 s apart', () => {
    const [lo, hi] = WORLD_WEATHER.ventPuff.everyMs;
    const c = createWorldClocks(1);
    const front = clocksIn(ERA_BUYS[3], 0);
    c.snap(front);
    let count = 0;
    let last: number | null = null;
    const gaps: number[] = [];
    run(c, front, 0, TEN_MIN_MS, STEP_MS, (o, t) => {
      if (o.ventPuffs > count) {
        if (last !== null) gaps.push(t - last);
        last = t;
        count = o.ventPuffs;
      }
    });
    expect(count).toBeGreaterThanOrEqual(5);
    for (const g of gaps) {
      expect(g).toBeGreaterThanOrEqual(lo - STEP_MS);
      expect(g).toBeLessThanOrEqual(hi + STEP_MS);
    }
  });

  const elsewhere: [string, readonly string[]][] = [
    ['era II', S9], ['era III without the valves', S10], ['era IV with the valves', S12], ['era V with the valves', S14],
  ];
  for (const [name, buys] of elsewhere) {
    it(`no vent puffs in ${name}`, () => {
      const c = createWorldClocks(1);
      const i = clocksIn(buys, 0);
      c.snap(i);
      run(c, i, 0, TEN_MIN_MS, STEP_MS, (o) => {
        expect(o.ventPuffs).toBe(0);
      });
    });
  }

  it('gust events count while the era weather gusts (era I) and never in the calm or still air', () => {
    const count = (buys: readonly string[]): number => {
      const c = createWorldClocks(1);
      const i = clocksIn(buys, 0);
      c.snap(i);
      let gusts = 0;
      run(c, i, 0, TEN_MIN_MS, STEP_MS, (o) => {
        gusts = o.gusts;
      });
      return gusts;
    };
    expect(count(ERA_BUYS[1])).toBeGreaterThan(0);
    expect(count(ERA_BUYS[4])).toBe(0);
    expect(count(ERA_BUYS[5])).toBe(0);
  });

  it('step reuses one output object and its ambient, whose micro flags are the tween micro flags', () => {
    const c = createWorldClocks(1);
    const i = clocksIn(ERA_BUYS[2], 0);
    c.snap(i);
    const a = c.step(STEP_MS, STEP_MS, i);
    const b = c.step(STEP_MS, 2 * STEP_MS, i);
    expect(b).toBe(a);
    expect(b.ambient).toBe(a.ambient);
    expect(b.ambient.micro).toBe(b.tween.micro);
  });
});

describe('worldClocks: the micro schedules', () => {
  const cases: { name: string; buys: readonly string[]; active: readonly MicroKind[] }[] = [
    { name: 'era I', buys: S7, active: ['ledBlink', 'girlWindowDim'] },
    { name: 'era II', buys: S9, active: ['hitch', 'ledDim', 'lampDip', 'boothDip', 'clockTwitch'] },
    { name: 'era III', buys: S11, active: ['ledDim', 'lampDip', 'boothDip', 'clockTwitch'] },
    { name: 'era IV', buys: S12, active: ['lampDip', 'boothDip', 'clockTwitch', 'pages'] },
    { name: 'era V', buys: S14, active: ['ledDim', 'lampDip', 'boothDip', 'clockTwitch', 'pages'] },
  ];
  for (const cs of cases) {
    it(`${cs.name}: each active kind starts in ten minutes, holds and waits inside its range, never overlaps; the rest stay off`, () => {
      const { flags, pages } = sampleMicro(cs.buys, false);
      for (const kind of MICRO_KINDS) {
        const spec = WORLD_AMBIENT.micro[kind];
        if (kind === 'pages') {
          if (!cs.active.includes(kind)) {
            expect(pages[pages.length - 1]).toBe(0);
            continue;
          }
          const starts: number[] = [];
          pages.forEach((v, n) => {
            if (n > 0 && v > (pages[n - 1] ?? 0)) starts.push(n);
          });
          expect(starts.length).toBeGreaterThanOrEqual(1);
          for (let r = 1; r < starts.length; r += 1) {
            const gap = ((starts[r] ?? 0) - (starts[r - 1] ?? 0)) * MICRO_STEP_MS;
            expect(gap).toBeGreaterThanOrEqual(spec.everyMs[0] - MICRO_STEP_MS);
            expect(gap).toBeLessThanOrEqual(spec.everyMs[1] + MICRO_STEP_MS);
          }
          continue;
        }
        const seq = flags[kind];
        const runs = runsOf(seq);
        if (!cs.active.includes(kind)) {
          expect(runs).toHaveLength(0);
          continue;
        }
        expect(runs.length).toBeGreaterThanOrEqual(1);
        for (const [s, e] of runs.slice(0, -1)) {
          const len = (e - s) * MICRO_STEP_MS;
          expect(len).toBeGreaterThanOrEqual(spec.holdMs[0] - MICRO_STEP_MS);
          expect(len).toBeLessThanOrEqual(spec.holdMs[1] + MICRO_STEP_MS);
        }
        for (let r = 1; r < runs.length; r += 1) {
          const gap = ((runs[r]?.[0] ?? 0) - (runs[r - 1]?.[1] ?? 0)) * MICRO_STEP_MS;
          expect(gap).toBeGreaterThanOrEqual(spec.everyMs[0] - MICRO_STEP_MS);
          expect(gap).toBeLessThanOrEqual(spec.everyMs[1] + MICRO_STEP_MS);
        }
      }
    });
  }

  it('reduced motion: the hitch, the clock twitch and the lamp and booth dips stay off; the LED, the window dim and the pages stay', () => {
    const era2 = sampleMicro(S9, true);
    expect(era2.flags.hitch.some(Boolean)).toBe(false);
    expect(era2.flags.clockTwitch.some(Boolean)).toBe(false);
    expect(era2.flags.lampDip.some(Boolean)).toBe(false);
    expect(era2.flags.boothDip.some(Boolean)).toBe(false);
    expect(era2.flags.ledDim.some(Boolean)).toBe(true);
    const plain2 = sampleMicro(S9, false);
    expect(plain2.flags.lampDip.some(Boolean)).toBe(true);
    expect(plain2.flags.boothDip.some(Boolean)).toBe(true);
    const era1 = sampleMicro(S7, true);
    expect(era1.flags.ledBlink.some(Boolean)).toBe(true);
    expect(era1.flags.girlWindowDim.some(Boolean)).toBe(true);
    const era4 = sampleMicro(S12, true);
    expect(era4.pages[era4.pages.length - 1]).toBeGreaterThan(0);
  });

  it('debugDay reports the micro flags the renderers read, after reduced motion: on in play, off under reduced motion', () => {
    const seen = (reduced: boolean): Record<'hitch' | 'clockTwitch' | 'lampDip' | 'boothDip', boolean> => {
      const c = createWorldClocks(1);
      const i = clocksIn(S9, 0, { reduced });
      c.snap(i);
      const on = { hitch: false, clockTwitch: false, lampDip: false, boothDip: false };
      run(c, i, 0, TEN_MIN_MS, MICRO_STEP_MS, (o) => {
        const d = c.debugDay().micro;
        expect(d).toEqual({
          hitch: o.tween.micro.hitch, clockTwitch: o.tween.micro.clockTwitch, lampDip: o.tween.micro.lampDip,
          boothDip: o.tween.micro.boothDip,
        });
        on.hitch = on.hitch || d.hitch;
        on.clockTwitch = on.clockTwitch || d.clockTwitch;
        on.lampDip = on.lampDip || d.lampDip;
        on.boothDip = on.boothDip || d.boothDip;
      });
      return on;
    };
    expect(seen(false)).toEqual({ hitch: true, clockTwitch: true, lampDip: true, boothDip: true });
    expect(seen(true)).toEqual({ hitch: false, clockTwitch: false, lampDip: false, boothDip: false });
  });
});

describe('worldClocks: the frozen tape and the queue gate', () => {
  it('frozen holds every value: the minute, the wind, the micro flags and the transitions in flight', () => {
    const c = createWorldClocks(1);
    c.snap(clocksIn(ERA_BUYS[1], 0));
    const live = clocksIn(ERA_BUYS[2], 0);
    c.setTarget(live, 0);
    let ref = '';
    let now = run(c, live, 0, 3000, STEP_MS, (o) => {
      ref = take(o);
    });
    const frozen = clocksIn(ERA_BUYS[2], 0, { frozen: true });
    now = run(c, frozen, now, 60000, STEP_MS, (o) => {
      expect(take(o)).toBe(ref);
    });
    let after = '';
    run(c, live, now, 5000, STEP_MS, (o) => {
      after = take(o);
    });
    expect(after).not.toBe(ref);
  });

  it('the queue gate passes through: a gate up keeps transitions pending; the first start is 1000 ms after the drop', () => {
    const c = createWorldClocks(1);
    c.snap(clocksIn(ERA_BUYS[1], 0));
    const gated = clocksIn(ERA_BUYS[2], 0, { indexOpen: true });
    c.setTarget(gated, 0);
    let now = run(c, gated, 0, 5000, STEP_MS, () => undefined);
    expect(c.transitions().length).toBeGreaterThan(0);
    for (const item of c.transitions()) expect(item.startedAtMs).toBeNull();
    const open = clocksIn(ERA_BUYS[2], 0);
    const dropAt = now + STEP_MS;
    let firstStart: number | null = null;
    for (let n = 0; n < 40 && firstStart === null; n += 1) {
      now += STEP_MS;
      c.step(STEP_MS, now, open);
      if (c.transitions().some((item) => item.startedAtMs !== null)) firstStart = now;
    }
    expect(firstStart).not.toBeNull();
    expect((firstStart ?? 0) - dropAt).toBeGreaterThanOrEqual(WORLD_TRANSITIONS.startAfterCloseMs);
  });
});

// ---- WP24 r3-F2: the mains clock (the era II mains flicker holds through the tape freeze, A10) -------------------------------------

describe('worldClocks: the mains clock (WP24 r3-F2)', () => {
  it('ambient.mainsMs grows with each step, holds while the tape is frozen, and restarts from zero on reset', () => {
    const c = createWorldClocks(1);
    const live = clocksIn(ERA_BUYS[2], 0);
    c.snap(live);
    expect(c.step(STEP_MS, STEP_MS, live).ambient.mainsMs).toBe(STEP_MS);
    let mains = 0;
    let t = run(c, live, STEP_MS, 2000, STEP_MS, (o) => {
      mains = o.ambient.mainsMs;
    });
    expect(mains).toBe(STEP_MS + 2000);
    const frozen = clocksIn(ERA_BUYS[2], 0, { frozen: true });
    t = run(c, frozen, t, 5000, STEP_MS, (o) => {
      expect(o.ambient.mainsMs).toBe(STEP_MS + 2000);
    });
    run(c, live, t, 1000, STEP_MS, (o) => {
      mains = o.ambient.mainsMs;
    });
    expect(mains).toBe(STEP_MS + 2000 + 1000);
    c.reset(2);
    expect(c.step(0, STEP_MS, live).ambient.mainsMs).toBe(0);
    expect(c.step(STEP_MS, 2 * STEP_MS, live).ambient.mainsMs).toBe(STEP_MS);
  });
});

// ---- WP24 r4-F1: the wind and dust samples (a frozen tape keeps its sample, a moving clock samples at its own time) ------------------

describe('worldClocks: the wind and dust samples (WP24 r4-F1)', () => {
  it('the wind and the dust drift are windAt and dustDriftAt at the clock: a frozen tape holds them, every moving step samples again', () => {
    for (const [buys, x] of [[ERA_BUYS[1], 0], [ERA_BUYS[5], 1]] as const) {
      const c = createWorldClocks(1);
      const live = clocksIn(buys, x);
      c.snap(live);
      const wx = weatherOf(live.state.era, dayProgress(live).p, live.phase, live.state.vents);
      const frozen = clocksIn(buys, x, { frozen: true });
      const expectAt = (o: ClocksOut, t: number): void => {
        expect(o.ambient.wind).toBe(windAt(t, wx, 1));
        expect(o.ambient.dustDrift).toBe(dustDriftAt(t, wx));
      };
      let clock = 0;
      for (let n = 0; n < 6; n += 1) {
        clock += STEP_MS;
        expectAt(c.step(STEP_MS, clock, live), clock);
      }
      for (let n = 0; n < 3; n += 1) expectAt(c.step(STEP_MS, clock + STEP_MS, frozen), clock);
      clock += STEP_MS;
      expectAt(c.step(STEP_MS, clock, live), clock);
    }
  });

  it('a reset clears the sample: the first step at clock 0 after a reset reads the new seed', () => {
    const c = createWorldClocks(1);
    const live = clocksIn(ERA_BUYS[1], 0);
    c.snap(live);
    const wx = weatherOf(live.state.era, dayProgress(live).p, live.phase, live.state.vents);
    expect(c.step(0, 0, live).ambient.wind).toBe(windAt(0, wx, 1));
    c.reset(2);
    c.snap(live);
    expect(c.step(0, 0, live).ambient.wind).toBe(windAt(0, wx, 2));
  });
});

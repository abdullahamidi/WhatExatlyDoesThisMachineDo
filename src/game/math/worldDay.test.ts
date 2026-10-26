// Tests for worldDay (WP24 T4): the day progress and target (era gates read from TECHNOLOGIES, the tape bands, the ending hold, the demo
// cap), the eased minute that never falls, the light tint (keys, the era III front, the brightness floor, R >= G >= B), the weather per
// era and phase, the wind (sines, hash gust events, the slew to still air, the autocorrelation bound), the dust breath, and the vent, gust
// and micro schedules, the mote orbit (moved from worldPlayback, WP24 r1-FX3), the shadow and the lamp gains. Fake clocks throughout:
// no Date, no Phaser. Numbers come from WORLD_DAY,
// WORLD_WEATHER and WORLD_AMBIENT; the era gates come from TECHNOLOGIES.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ERA_KEYSTONES } from '../../data/eras';
import { TECHNOLOGIES } from '../../data/technologies';
import { RESOURCE_IDS } from '../../data/types';
import type { EndingPhase, ResourceId, TechId } from '../../data/types';
import { WORLD_ENV } from '../../data/livingWorld';
import { WORLD_AMBIENT, WORLD_DAY, WORLD_WEATHER } from '../../data/worldDay';
import type { MicroKind } from '../../data/worldDay';
import { eraResource } from '../../simulation/progression/era';
import type { WorldEra } from './worldState';
import {
  dayProgress, dayTargetMin, dayTint, dustDriftAt, easeBaseWind, gustAt, lampGain, microActive, microAt, moteOrbit, shadowOf, stepDayMin,
  tintBrightness, ventPuffAt, weatherOf, windAt,
} from './worldDay';
import type { DayInput, WeatherState } from './worldDay';

const ERAS: readonly WorldEra[] = [1, 2, 3, 4, 5];
const MICRO_KINDS = Object.keys(WORLD_AMBIENT.micro) as MicroKind[];
const SEEDS = [1, 2, 3];
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const redOf = (rgb: number): number => (rgb >> 16) & 0xff;
const greenOf = (rgb: number): number => (rgb >> 8) & 0xff;
const blueOf = (rgb: number): number => rgb & 0xff;

// n + 1 evenly spaced values from `from` to `to`.
function sweep(from: number, to: number, n: number): number[] {
  return Array.from({ length: n + 1 }, (_, k) => from + ((to - from) * k) / n);
}

// Keystone levels with every keystone up to the era owned (currentEra reads the highest).
function levelsAt(era: WorldEra): Record<TechId, number> {
  const levels = {} as Record<TechId, number>;
  for (const k of ERA_KEYSTONES) levels[k.techId] = k.era <= era ? 1 : 0;
  return levels;
}

function lifetimeOf(res: ResourceId, amount: number): Record<ResourceId, number> {
  const out = {} as Record<ResourceId, number>;
  for (const id of RESOURCE_IDS) out[id] = id === res ? amount : 0;
  return out;
}

// The lifetime amount of an era gate, read from TECHNOLOGIES.
function gateOf(era: WorldEra): number {
  const req = TECHNOLOGIES[WORLD_DAY.gates[era]].requires.find((r) => r.type === 'lifetime');
  if (req?.type !== 'lifetime') throw new Error(`no lifetime gate for era ${era}`);
  return req.amount;
}

// A day input for an era with its resource at gate × 10^x (x in decades of the gate).
function input(era: WorldEra, x: number, phase: EndingPhase = 'none', edition: DayInput['edition'] = 'full'): DayInput {
  return { levels: levelsAt(era), lifetime: lifetimeOf(eraResource(era), gateOf(era) * 10 ** x), phase, edition };
}

function bandOf(era: WorldEra): { era: WorldEra; fromMin: number; toMin: number } {
  const band = WORLD_DAY.bands.find((b) => b.era === era);
  if (band === undefined) throw new Error(`no band for era ${era}`);
  return band;
}

describe('dayProgress', () => {
  it('reads the era from the keystone levels', () => {
    for (const era of ERAS) expect(dayProgress(input(era, 0)).era).toBe(era);
  });

  it('is 0 at the bottom of the tape, 1 - tailShare at the gate, and 1 at the top of the tail', () => {
    for (const era of ERAS) {
      expect(dayProgress(input(era, -WORLD_DAY.decades)).p).toBeCloseTo(0, 6);
      expect(dayProgress(input(era, 0)).p).toBeCloseTo(1 - WORLD_DAY.tailShare, 9);
      expect(dayProgress(input(era, WORLD_DAY.tailDecades)).p).toBeCloseTo(1, 9);
    }
  });

  it('clamps below the bottom to 0 and above the tail to 1, and reads no lifetime as 0', () => {
    for (const era of ERAS) {
      expect(dayProgress(input(era, -WORLD_DAY.decades - 2)).p).toBe(0);
      expect(dayProgress(input(era, WORLD_DAY.tailDecades + 2)).p).toBeCloseTo(1, 9);
      expect(dayProgress(input(era, -Infinity)).p).toBe(0);
    }
  });

  it('stays in [0, 1] over the whole tape', () => {
    for (const era of ERAS) {
      for (const x of sweep(-6, 6, 120)) {
        const p = dayProgress(input(era, x)).p;
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is monotone in lifetime inside every era', () => {
    for (const era of ERAS) {
      let prev = -1;
      for (const x of sweep(-WORLD_DAY.decades - 1, WORLD_DAY.tailDecades + 1, 400)) {
        const p = dayProgress(input(era, x)).p;
        expect(p, `era ${era} x ${x}`).toBeGreaterThanOrEqual(prev);
        prev = p;
      }
    }
  });

  it('is continuous across the gate, where the log tape meets its tail', () => {
    for (const era of ERAS) {
      const below = dayProgress(input(era, -1e-9)).p;
      const above = dayProgress(input(era, 1e-9)).p;
      expect(Math.abs(above - below)).toBeLessThan(1e-6);
    }
  });
});

describe('dayTargetMin', () => {
  it('runs from each band start to its band end as the tape fills', () => {
    for (const era of ERAS) {
      const band = bandOf(era);
      expect(dayTargetMin(input(era, -WORLD_DAY.decades))).toBeCloseTo(band.fromMin, 6);
      expect(dayTargetMin(input(era, WORLD_DAY.tailDecades))).toBeCloseTo(band.toMin, 6);
    }
  });

  it('is monotone in lifetime and stays inside its band', () => {
    for (const era of ERAS) {
      const band = bandOf(era);
      let prev = -Infinity;
      for (const x of sweep(-WORLD_DAY.decades, WORLD_DAY.tailDecades, 300)) {
        const min = dayTargetMin(input(era, x));
        expect(min, `era ${era} x ${x}`).toBeGreaterThanOrEqual(prev);
        expect(min).toBeGreaterThanOrEqual(band.fromMin - 1e-9);
        expect(min).toBeLessThanOrEqual(band.toMin + 1e-9);
        prev = min;
      }
    }
  });

  it('moves continuously across every band (no step larger than the slope bound)', () => {
    const slope = Math.max((1 - WORLD_DAY.tailShare) / WORLD_DAY.decades, WORLD_DAY.tailShare / WORLD_DAY.tailDecades);
    const n = 400;
    const step = (WORLD_DAY.decades + WORLD_DAY.tailDecades) / n;
    for (const era of ERAS) {
      const band = bandOf(era);
      const span = band.toMin - band.fromMin;
      let prev = dayTargetMin(input(era, -WORLD_DAY.decades));
      for (let k = 1; k <= n; k++) {
        const cur = dayTargetMin(input(era, -WORLD_DAY.decades + k * step));
        expect(Math.abs(cur - prev)).toBeLessThanOrEqual(span * slope * step + 1e-9);
        prev = cur;
      }
    }
  });

  it('hands over at the band joins: the top of one era is the bottom of the next', () => {
    for (let i = 0; i + 1 < ERAS.length; i++) {
      const era = ERAS[i];
      const next = ERAS[i + 1];
      if (era === undefined || next === undefined) throw new Error('era list');
      expect(bandOf(era).toMin).toBe(bandOf(next).fromMin);
    }
  });

  it('holds the held minute in every ending phase, whatever the tape', () => {
    for (const phase of ['sequence', 'choice', 'postgame'] as const) {
      for (const era of ERAS) {
        for (const x of [-WORLD_DAY.decades, 0, WORLD_DAY.tailDecades]) {
          expect(dayTargetMin(input(era, x, phase)), `${phase} era ${era} x ${x}`).toBe(WORLD_DAY.heldMin);
        }
      }
    }
  });

  it('the full edition reaches the held minute at the top of era V', () => {
    expect(dayTargetMin(input(5, WORLD_DAY.tailDecades))).toBeCloseTo(WORLD_DAY.heldMin, 6);
  });

  it('the demo never goes past its cap, and reaches it', () => {
    for (const era of ERAS) {
      for (const x of sweep(-WORLD_DAY.decades, WORLD_DAY.tailDecades, 50)) {
        const demo = dayTargetMin(input(era, x, 'none', 'demo'));
        expect(demo).toBeLessThanOrEqual(WORLD_DAY.demoMaxMin);
        expect(demo).toBeCloseTo(Math.min(dayTargetMin(input(era, x)), WORLD_DAY.demoMaxMin), 9);
      }
    }
    expect(dayTargetMin(input(3, WORLD_DAY.tailDecades))).toBeGreaterThan(WORLD_DAY.demoMaxMin);
    expect(dayTargetMin(input(5, WORLD_DAY.tailDecades, 'none', 'demo'))).toBeCloseTo(WORLD_DAY.demoMaxMin, 9);
  });
});

describe('stepDayMin', () => {
  it('never decreases: a target at or below the presented minute holds it', () => {
    expect(stepDayMin(700, 600, 1000)).toBe(700);
    expect(stepDayMin(700, 700, 1000)).toBe(700);
  });

  it('never overshoots the target', () => {
    for (const dt of [16.7, 100, 1000, 60000]) {
      const next = stepDayMin(WORLD_DAY.startMin, WORLD_DAY.startMin + 1, dt);
      expect(next).toBeGreaterThanOrEqual(WORLD_DAY.startMin);
      expect(next).toBeLessThanOrEqual(WORLD_DAY.startMin + 1);
    }
  });

  it('obeys maxRateMinPerS: a long step over a big gap moves exactly the rate limit', () => {
    expect(stepDayMin(WORLD_DAY.startMin, WORLD_DAY.heldMin, 1000) - WORLD_DAY.startMin).toBeCloseTo(WORLD_DAY.maxRateMinPerS, 9);
    for (const dt of [16.7, 33.3, 100]) {
      const moved = stepDayMin(WORLD_DAY.startMin, WORLD_DAY.heldMin, dt) - WORLD_DAY.startMin;
      expect(moved).toBeLessThanOrEqual(WORLD_DAY.maxRateMinPerS * dt / 1000 + 1e-9);
    }
  });

  it('eases with smoothMs over a small gap', () => {
    expect(stepDayMin(0, 1, WORLD_DAY.smoothMs)).toBeCloseTo(1 - Math.exp(-1), 9);
  });

  it('converges on the target over 20 minutes of 100 ms steps', () => {
    let min: number = WORLD_DAY.startMin;
    for (let n = 0; n < 12000; n++) min = stepDayMin(min, WORLD_DAY.heldMin, 100);
    expect(min).toBeCloseTo(WORLD_DAY.heldMin, 2);
  });

  it('never falls while the target wobbles up and down', () => {
    let min: number = WORLD_DAY.startMin;
    for (let n = 0; n < 3000; n++) {
      const target = WORLD_DAY.startMin + (WORLD_DAY.heldMin - WORLD_DAY.startMin) * (0.5 + 0.5 * Math.sin(n / 50));
      const next = stepDayMin(min, target, 100);
      expect(next).toBeGreaterThanOrEqual(min);
      min = next;
    }
  });
});

describe('dayTint', () => {
  const keys = WORLD_DAY.tintKeys;

  it('equals each tint key at its own minute (p 0 leaves every key as it is)', () => {
    for (const key of keys) expect(dayTint(key.min, 1, 0)).toBe(key.rgb);
  });

  it('clamps outside the day to the first and the last key', () => {
    const first = keys[0];
    const last = keys[keys.length - 1];
    if (first === undefined || last === undefined) throw new Error('tint keys');
    expect(dayTint(WORLD_DAY.startMin - 60, 1, 0)).toBe(first.rgb);
    expect(dayTint(WORLD_DAY.heldMin + 60, 5, 0)).toBe(last.rgb);
  });

  it('blends the keys linearly per channel between them', () => {
    const a = keys[0];
    const b = keys[1];
    if (a === undefined || b === undefined) throw new Error('tint keys');
    const mid = dayTint((a.min + b.min) / 2, 1, 0);
    expect(redOf(mid)).toBe(Math.round((redOf(a.rgb) + redOf(b.rgb)) / 2));
    expect(greenOf(mid)).toBe(Math.round((greenOf(a.rgb) + greenOf(b.rgb)) / 2));
    expect(blueOf(mid)).toBe(Math.round((blueOf(a.rgb) + blueOf(b.rgb)) / 2));
  });

  it('era III at p 1 multiplies every channel by frontDarken, and p 0 leaves the era III keys alone', () => {
    const band = bandOf(3);
    const inBand = keys.filter((k) => k.min >= band.fromMin && k.min <= band.toMin);
    expect(inBand.length).toBeGreaterThan(0);
    for (const key of inBand) {
      const dark = dayTint(key.min, 3, 1);
      expect(redOf(dark)).toBe(Math.round(redOf(key.rgb) * WORLD_DAY.frontDarken));
      expect(greenOf(dark)).toBe(Math.round(greenOf(key.rgb) * WORLD_DAY.frontDarken));
      expect(blueOf(dark)).toBe(Math.round(blueOf(key.rgb) * WORLD_DAY.frontDarken));
      expect(dayTint(key.min, 3, 0)).toBe(key.rgb);
    }
  });

  it('keeps R >= G >= B at every minute of every band, at p 0, 0.5 and 1', () => {
    for (const band of WORLD_DAY.bands) {
      for (let min = band.fromMin; min <= band.toMin; min++) {
        for (const p of [0, 0.5, 1]) {
          const rgb = dayTint(min, band.era, p);
          expect(redOf(rgb), `min ${min} era ${band.era} p ${p}`).toBeGreaterThanOrEqual(greenOf(rgb));
          expect(greenOf(rgb), `min ${min} era ${band.era} p ${p}`).toBeGreaterThanOrEqual(blueOf(rgb));
        }
      }
    }
  });

  it('keeps every minute at least minBrightness bright, era III at p 1 included', () => {
    for (const band of WORLD_DAY.bands) {
      for (let min = band.fromMin; min <= band.toMin; min++) {
        for (const p of [0, 1]) {
          expect(tintBrightness(dayTint(min, band.era, p)), `min ${min} era ${band.era} p ${p}`).toBeGreaterThanOrEqual(WORLD_DAY.minBrightness);
        }
      }
    }
  });

  it('returns an integer 0xRRGGBB at every minute', () => {
    for (let min = WORLD_DAY.startMin; min <= WORLD_DAY.heldMin; min++) {
      const rgb = dayTint(min, 3, 1);
      expect(Number.isInteger(rgb)).toBe(true);
      expect(rgb).toBeGreaterThanOrEqual(0);
      expect(rgb).toBeLessThanOrEqual(0xffffff);
    }
  });
});

describe('tintBrightness', () => {
  it('is the brightest channel over full scale', () => {
    expect(tintBrightness(0xffffff)).toBe(1);
    expect(tintBrightness(0x000000)).toBe(0);
    expect(tintBrightness(0x102030)).toBeCloseTo(0x30 / 255, 9);
    expect(tintBrightness(0xff0000)).toBe(1);
  });
});

describe('weatherOf', () => {
  it('takes the base wind of each era from its row at both ends of p', () => {
    for (const era of ERAS) {
      const row = WORLD_WEATHER.eras[era];
      expect(weatherOf(era, 0, 'none', false).baseWind).toBeCloseTo(row.wind[0], 9);
      expect(weatherOf(era, 1, 'none', false).baseWind).toBeCloseTo(row.wind[1], 9);
    }
  });

  it('interpolates the era III front wind by p', () => {
    const [lo, hi] = WORLD_WEATHER.eras[3].wind;
    expect(weatherOf(3, 0.5, 'none', false).baseWind).toBeCloseTo((lo + hi) / 2, 9);
  });

  it('keeps eras IV and V dead calm: no wind and no gusts', () => {
    for (const era of [4, 5] as const) {
      const w = weatherOf(era, 1, 'none', false);
      expect(w.baseWind).toBe(0);
      expect(w.gusts).toBe(false);
    }
  });

  it('stops the wind and the gusts in every ending phase', () => {
    for (const phase of ['sequence', 'choice', 'postgame'] as const) {
      for (const era of ERAS) {
        const w = weatherOf(era, 1, phase, true);
        expect(w.baseWind).toBe(0);
        expect(w.gusts).toBe(false);
      }
    }
  });

  it('labels the era with its word, and reads still in the postgame', () => {
    for (const era of ERAS) {
      expect(weatherOf(era, 0, 'none', false).label).toBe(WORLD_WEATHER.labels[era]);
      expect(weatherOf(era, 0, 'sequence', false).label).toBe(WORLD_WEATHER.labels[era]);
      expect(weatherOf(era, 0, 'postgame', false).label).toBe('still');
    }
  });

  it('lets the dust breathe only in era V with no ending', () => {
    for (const era of ERAS) {
      expect(weatherOf(era, 1, 'none', false).dustDrift).toBe(era === 5);
      expect(weatherOf(era, 1, 'postgame', false).dustDrift).toBe(false);
    }
  });

  it('lerps the virga alpha and speed by p, and echoes the vents flag and the era', () => {
    for (const era of ERAS) {
      const row = WORLD_WEATHER.eras[era];
      expect(weatherOf(era, 0, 'none', false).virgaAlpha).toBeCloseTo(row.virgaAlpha[0], 9);
      expect(weatherOf(era, 1, 'none', false).virgaSpeed).toBeCloseTo(row.virgaSpeed[1], 9);
      expect(weatherOf(era, 0, 'none', true).vents).toBe(true);
      expect(weatherOf(era, 0, 'none', false).vents).toBe(false);
      expect(weatherOf(era, 0, 'none', false).era).toBe(era);
    }
  });
});

describe('easeBaseWind', () => {
  it('slews toward the target at windSlewPerS and never overshoots', () => {
    expect(easeBaseWind(0, 1, 1000)).toBeCloseTo(WORLD_WEATHER.windSlewPerS, 9);
    expect(easeBaseWind(0.9, 0, 1000)).toBeCloseTo(0.9 - WORLD_WEATHER.windSlewPerS, 9);
    expect(easeBaseWind(0.01, 0, 1000)).toBe(0);
    expect(easeBaseWind(0.5, 0.5, 1000)).toBe(0.5);
    expect(easeBaseWind(0.9, 0.9, 0)).toBe(0.9);
  });

  it('from 0.9 reaches 0.05 or less within 60 s and never goes below the target', () => {
    let v = 0.9;
    for (let n = 1; n <= 600; n++) {
      const prev = v;
      v = easeBaseWind(v, 0, 100);
      expect(v).toBeLessThanOrEqual(prev);
      expect(v).toBeGreaterThanOrEqual(0);
    }
    expect(v).toBeLessThanOrEqual(0.05);
  });
});

describe('windAt', () => {
  // One sample per 13 s: a step that does not divide the sine periods.
  const WIND_STEP_MS = 13000;

  it('stays within [0, windMax] for every era, ending, weather and seed over two hours', () => {
    const weathers: WeatherState[] = [weatherOf(1, 0, 'none', false), weatherOf(3, 1, 'none', true), weatherOf(3, 1, 'postgame', false)];
    for (const era of ERAS) weathers.push(weatherOf(era, 0, 'none', false), weatherOf(era, 1, 'none', false));
    for (const w of weathers) {
      for (const seed of SEEDS) {
        for (let t = 0; t <= TWO_HOURS_MS; t += WIND_STEP_MS) {
          const v = windAt(t, w, seed);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(WORLD_WEATHER.windMax);
        }
      }
    }
  });

  it('is deterministic per seed, and another seed gives another wind', () => {
    const w = weatherOf(1, 0, 'none', false);
    let differs = false;
    for (let t = 0; t < 600000; t += 9000) {
      expect(windAt(t, w, 1)).toBe(windAt(t, w, 1));
      if (windAt(t, w, 1) !== windAt(t, w, 2)) differs = true;
    }
    expect(differs).toBe(true);
  });

  it('is zero in eras IV and V at every time', () => {
    for (const era of [4, 5] as const) {
      const w = weatherOf(era, 1, 'none', false);
      for (let t = 0; t <= TWO_HOURS_MS; t += WIND_STEP_MS) expect(windAt(t, w, 1)).toBe(0);
    }
  });

  it('reads the base wind alone when the weather has no gusts', () => {
    const w: WeatherState = { ...weatherOf(1, 0, 'none', false), gusts: false };
    for (let t = 0; t <= 600000; t += 9000) expect(windAt(t, w, 1)).toBe(w.baseWind);
  });

  it('gives the same values whatever order the times are asked in (the gust cache is only a cache)', () => {
    const w = weatherOf(1, 0, 'none', false);
    const times: number[] = [];
    for (let t = 0; t <= 600000; t += 7000) times.push(t);
    // The far end is asked first on this seed (the cache grows to it), then the early times are read back from the cache.
    const lateFirst = [...times].reverse().map((t) => windAt(t, w, 556));
    const inOrder = times.map((t) => windAt(t, w, 556));
    expect(inOrder).toEqual([...lateFirst].reverse());
  });

  it('moves over a minute: the sines and the gusts keep the era I wind changing', () => {
    const w = weatherOf(1, 0, 'none', false);
    const values = new Set<number>();
    for (let t = 0; t < 60000; t += 1000) values.add(windAt(t, w, 1));
    expect(values.size).toBeGreaterThan(30);
  });

  it('has no repeat: the era I wind autocorrelation stays below 0.9 for every lag from 60 to 600 s (2 h, once a second)', () => {
    const w = weatherOf(1, 0, 'none', false);
    for (const seed of SEEDS) {
      const x: number[] = [];
      for (let t = 0; t < TWO_HOURS_MS / 1000; t++) x.push(windAt(t * 1000, w, seed));
      const mean = x.reduce((sum, v) => sum + v, 0) / x.length;
      const d = x.map((v) => v - mean);
      const energy = d.reduce((sum, v) => sum + v * v, 0);
      for (let lag = 60; lag <= 600; lag++) {
        let num = 0;
        for (let t = 0; t + lag < d.length; t++) num += (d[t] ?? 0) * (d[t + lag] ?? 0);
        expect(num / energy, `seed ${seed} lag ${lag}`).toBeLessThan(0.9);
      }
    }
  });
});

describe('dustDriftAt', () => {
  it('breathes ±amp on one sine in still air (era V, no ending)', () => {
    const w = weatherOf(5, 1, 'none', false);
    const { amp, periodMs } = WORLD_WEATHER.dustDrift;
    let lo = Infinity;
    let hi = -Infinity;
    for (let t = 0; t <= 2 * periodMs; t += periodMs / 500) {
      const v = dustDriftAt(t, w);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    expect(hi).toBeLessThanOrEqual(1 + amp + 1e-9);
    expect(lo).toBeGreaterThanOrEqual(1 - amp - 1e-9);
    expect(hi).toBeCloseTo(1 + amp, 3);
    expect(lo).toBeCloseTo(1 - amp, 3);
  });

  it('repeats every dust period', () => {
    const w = weatherOf(5, 1, 'none', false);
    const { periodMs } = WORLD_WEATHER.dustDrift;
    for (let t = 0; t <= periodMs; t += 5000) expect(dustDriftAt(t + periodMs, w)).toBeCloseTo(dustDriftAt(t, w), 9);
  });

  it('is exactly 1 in every other era and in the ending', () => {
    for (const era of [1, 2, 3, 4] as const) expect(dustDriftAt(12345, weatherOf(era, 1, 'none', false))).toBe(1);
    expect(dustDriftAt(12345, weatherOf(5, 1, 'sequence', false))).toBe(1);
  });
});

describe('ventPuffAt', () => {
  const [lo, hi] = WORLD_WEATHER.ventPuff.everyMs;

  it('gives every gap inside the vent range, deterministically per k and seed', () => {
    for (const seed of SEEDS) {
      for (let k = 0; k < 200; k++) {
        const gap = ventPuffAt(k, seed);
        expect(gap).toBeGreaterThanOrEqual(lo);
        expect(gap).toBeLessThanOrEqual(hi);
        expect(ventPuffAt(k, seed)).toBe(gap);
      }
    }
  });

  it('varies from puff to puff', () => {
    const gaps = new Set<number>();
    for (let k = 0; k < 20; k++) gaps.add(ventPuffAt(k, 1));
    expect(gaps.size).toBeGreaterThan(1);
  });
});

describe('gustAt', () => {
  const event = WORLD_WEATHER.gustEvent;

  it('gives every gap and length inside the gust ranges, deterministically per k and seed', () => {
    for (const seed of SEEDS) {
      for (let k = 0; k < 200; k++) {
        const g = gustAt(k, seed);
        expect(g.afterMs).toBeGreaterThanOrEqual(event.everyMs[0]);
        expect(g.afterMs).toBeLessThanOrEqual(event.everyMs[1]);
        expect(g.lengthMs).toBeGreaterThanOrEqual(event.lengthMs[0]);
        expect(g.lengthMs).toBeLessThanOrEqual(event.lengthMs[1]);
        expect(gustAt(k, seed)).toEqual(g);
      }
    }
  });

  it('varies from event to event', () => {
    const gaps = new Set<number>();
    for (let k = 0; k < 20; k++) gaps.add(gustAt(k, 1).afterMs);
    expect(gaps.size).toBeGreaterThan(1);
  });
});

describe('microAt', () => {
  it('fires inside its row ranges in every era the kind runs in', () => {
    for (const kind of MICRO_KINDS) {
      const row = WORLD_AMBIENT.micro[kind];
      const eras: readonly WorldEra[] = row.eras;
      for (const era of eras) {
        for (const seed of SEEDS) {
          for (let k = 0; k < 50; k++) {
            const m = microAt(kind, k, seed, era);
            expect(m.afterMs, kind).toBeGreaterThanOrEqual(row.everyMs[0]);
            expect(m.afterMs, kind).toBeLessThanOrEqual(row.everyMs[1]);
            expect(m.holdMs, kind).toBeGreaterThanOrEqual(row.holdMs[0]);
            expect(m.holdMs, kind).toBeLessThanOrEqual(row.holdMs[1]);
          }
        }
      }
    }
  });

  it('never fires in an era the kind is off in (afterMs Infinity, no hold)', () => {
    for (const kind of MICRO_KINDS) {
      const eras: readonly WorldEra[] = WORLD_AMBIENT.micro[kind].eras;
      for (const era of ERAS) {
        if (eras.includes(era)) continue;
        expect(microAt(kind, 3, 1, era)).toEqual({ afterMs: Infinity, holdMs: 0 });
      }
    }
  });

  it('agrees with microActive for every kind and era', () => {
    for (const kind of MICRO_KINDS) {
      for (const era of ERAS) {
        const on = microAt(kind, 0, 1, era).afterMs !== Infinity;
        expect(on).toBe(microActive(kind, era));
      }
    }
  });

  it('is deterministic per kind, k, seed and era', () => {
    for (const kind of MICRO_KINDS) {
      expect(microAt(kind, 5, 9, 2)).toEqual(microAt(kind, 5, 9, 2));
    }
  });

  it('gives two kinds of one era their own schedules', () => {
    let differs = false;
    for (let k = 0; k < 20; k++) {
      if (microAt('lampDip', k, 1, 1).afterMs !== microAt('boothDip', k, 1, 1).afterMs) differs = true;
    }
    expect(differs).toBe(true);
  });

  it('gives the page flips no hold (a flip, not a hold)', () => {
    for (let k = 0; k < 20; k++) expect(microAt('pages', k, 1, 4).holdMs).toBe(0);
  });
});

describe('shadowOf', () => {
  it('starts with no shift and normal width, and reaches the full shift and widening at the held minute', () => {
    const start = shadowOf(WORLD_DAY.startMin);
    expect(start.dx).toBe(0);
    expect(start.widthScale).toBeCloseTo(1, 9);
    const held = shadowOf(WORLD_DAY.heldMin);
    expect(held.dx).toBeCloseTo(WORLD_DAY.shadow.dxMaxPx, 9);
    expect(held.widthScale).toBeCloseTo(WORLD_DAY.shadow.widthScaleMax, 9);
  });

  it('grows monotonically across the day and holds at the ends', () => {
    let prev = shadowOf(WORLD_DAY.startMin - 100);
    for (let min = WORLD_DAY.startMin; min <= WORLD_DAY.heldMin + 100; min++) {
      const cur = shadowOf(min);
      expect(cur.dx).toBeGreaterThanOrEqual(prev.dx);
      expect(cur.widthScale).toBeGreaterThanOrEqual(prev.widthScale);
      prev = cur;
    }
    expect(shadowOf(WORLD_DAY.heldMin + 100).dx).toBeCloseTo(WORLD_DAY.shadow.dxMaxPx, 9);
  });
});

describe('lampGain', () => {
  const { fromMin, toMin, max } = WORLD_DAY.lampGain;

  it('is 1 up to the ramp start and the max at the ramp end', () => {
    expect(lampGain(fromMin)).toBe(1);
    expect(lampGain(WORLD_DAY.startMin)).toBe(1);
    expect(lampGain(toMin)).toBeCloseTo(max, 9);
    expect(lampGain(toMin + 100)).toBeCloseTo(max, 9);
  });

  it('rises linearly between the ramp ends', () => {
    expect(lampGain((fromMin + toMin) / 2)).toBeCloseTo(1 + (max - 1) / 2, 9);
  });

  it('never decreases over the day', () => {
    let prev = lampGain(WORLD_DAY.startMin);
    for (let min = WORLD_DAY.startMin; min <= WORLD_DAY.heldMin; min++) {
      const cur = lampGain(min);
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
  });
});

describe('moteOrbit', () => {
  const { radiusPx, driftPx } = WORLD_AMBIENT.motes;
  const count = WORLD_ENV.motes.count;
  const path = (i: number, seed = 0): { dx: number; dy: number }[] => {
    const out: { dx: number; dy: number }[] = [];
    for (let t = 0; t <= 20000; t += 250) out.push(moteOrbit(i, t, seed));
    return out;
  };

  it('gives every mote its own orbit: no two motes trace the same path', () => {
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) expect(path(i), `${i} vs ${j}`).not.toEqual(path(j));
    }
  });

  it('moves every mote over time (no mote holds still)', () => {
    for (let i = 0; i < count; i++) {
      const cells = new Set(path(i).map(({ dx, dy }) => `${dx},${dy}`));
      expect(cells.size, `mote ${i}`).toBeGreaterThan(1);
    }
  });

  it('stays inside its radius band plus the drift (dx) and half the radius band (dy)', () => {
    for (let i = 0; i < count; i++) {
      for (const seed of [0, 1, 2]) {
        for (let t = 0; t <= 60000; t += 250) {
          const { dx, dy } = moteOrbit(i, t, seed);
          expect(Math.abs(dx)).toBeLessThanOrEqual(radiusPx[1] + driftPx);
          expect(Math.abs(dy)).toBeLessThanOrEqual(radiusPx[1] / 2);
        }
      }
    }
  });

  it('reaches well out within 20 s (the shortest period completes turns in that time)', () => {
    for (let i = 0; i < count; i++) {
      const reach = Math.max(...path(i).map(({ dx }) => Math.abs(dx)));
      expect(reach, `mote ${i}`).toBeGreaterThan(radiusPx[0] / 2);
    }
  });

  it('gives whole numbers and never -0', () => {
    for (let i = 0; i < count; i++) {
      for (let t = 0; t <= 20000; t += 125) {
        const { dx, dy } = moteOrbit(i, t);
        expect(Number.isInteger(dx)).toBe(true);
        expect(Number.isInteger(dy)).toBe(true);
        expect(Object.is(dx, -0)).toBe(false);
        expect(Object.is(dy, -0)).toBe(false);
      }
    }
  });

  it('is deterministic for the same mote, time and seed, the default seed is 0, and another seed gives other orbits', () => {
    expect(moteOrbit(2, 1234, 7)).toEqual(moteOrbit(2, 1234, 7));
    expect(moteOrbit(2, 1234)).toEqual(moteOrbit(2, 1234, 0));
    expect(path(0, 7)).not.toEqual(path(0, 8));
  });
});

describe('worldDay source', () => {
  it('has no Phaser import (pure maths)', () => {
    const src = readFileSync(new URL('./worldDay.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/from\s+['"][^'"]*phaser/i);
  });
});

// ---- WP24 r3-F2: the per-mote table is bit-equal to the per-call formula ------------------------------------------------------------

// The per-call formula of moteOrbit (every hash drawn on every call): the reference the per-mote table must match bit for bit.
function moteOrbitRef(i: number, tMs: number, seed: number): { dx: number; dy: number } {
  const { radiusPx, periodMs, driftPx, driftPeriods } = WORLD_AMBIENT.motes;
  const h = (a: number, b: number): number => {
    const f = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
    return f - Math.floor(f);
  };
  const rz = (v: number): number => Math.round(v) + 0;
  const radius = radiusPx[0] + (radiusPx[1] - radiusPx[0]) * h(seed, i);
  const period = periodMs[0] + (periodMs[1] - periodMs[0]) * h(seed, i + 10);
  const phase = h(seed, i + 20) * 2 * Math.PI;
  const angle = 2 * Math.PI * (tMs / period) + phase;
  const drift = rz(driftPx * Math.sin(2 * Math.PI * (tMs / (period * driftPeriods)) + phase));
  return { dx: rz(rz(radius * Math.cos(angle)) + drift), dy: rz((radius / 2) * Math.sin(angle)) };
}

// Mulberry32: a seeded stream for the random times.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

describe('moteOrbit: the per-mote table (WP24 r3-F2)', () => {
  const count = WORLD_ENV.motes.count;

  it('equals the per-call formula bit for bit: every mote, three seeds, 2000 random times each', () => {
    const rand = mulberry32(41);
    for (const seed of [0, WORLD_AMBIENT.seeds.motes, 1234]) {
      for (let k = 0; k < 2000; k++) {
        const t = rand() * 600000;
        for (let i = 0; i < count; i++) {
          const got = moteOrbit(i, t, seed);
          const want = moteOrbitRef(i, t, seed);
          expect(got.dx, `mote ${i} seed ${seed} t ${t}`).toBe(want.dx);
          expect(got.dy, `mote ${i} seed ${seed} t ${t}`).toBe(want.dy);
        }
      }
    }
  });

  it('stays bit-equal when the seed and the mote change at random (the table refills on a new seed)', () => {
    const rand = mulberry32(43);
    const seeds = [0, WORLD_AMBIENT.seeds.motes, 1234];
    for (let k = 0; k < 2000; k++) {
      const i = Math.floor(rand() * (count + 1));    // the last index is past the table and takes the direct path
      const seed = seeds[Math.floor(rand() * seeds.length)] ?? 0;
      const t = rand() * 600000;
      const got = moteOrbit(i, t, seed);
      const want = moteOrbitRef(i, t, seed);
      expect(got.dx, `mote ${i} seed ${seed} t ${t}`).toBe(want.dx);
      expect(got.dy, `mote ${i} seed ${seed} t ${t}`).toBe(want.dy);
    }
  });
});

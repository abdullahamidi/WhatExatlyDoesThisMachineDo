// Tests for the reach FX maths (WP28b, D6, B4): reachLevel monotone and clamped on the shipped bounds; the throttles and the flash cap over a
// simulated 10 s of 15 clicks a second; the arc, drift, pylon, dust and debris rules; reduced motion; the ground colours (F38); and the per-era
// reach table (console.table) that AD4 tunes REACH_LEVEL from. The lamp, hum, pebble and puddle rules are in worldFx.test.ts. Pure maths, no Phaser.
import { describe, expect, it } from 'vitest';
import {
  FLASH_GAP_MS, PULSE_GAP_MS, arcRatePerS, debrisBobPx, debrisMoves, debrisRiseArt, driftRatePerS, dustFrequencyMs, flashHz, fxEnabled,
  groundWaveX, pylonDotCount, pylonDotPositions, spawnDue, throttleOk,
} from './worldReach';
import type { FxKind } from './worldReach';
import { waveArrivalMs } from './reachWave';
import { reachLevel } from './reachLevel';
import { ERA_SPECS, eraStateOf } from './worldBehaviourMetrics';
import { REACH_FX } from '../../data/worldReach';
import { WORLD_FX } from '../../data/worldFx';
import { REACH_LEVEL, SPLICE_REACH } from '../../data/worldShared';
import { SPLICE_FX, SPLICE_LINE_STYLE } from '../../data/spliceWorld';
import { RESOURCE_IDS, TECH_IDS } from '../../data/types';
import type { TechId } from '../../data/types';
import type { Vec2 } from '../../data/machineComponents';
import { computeRates } from '../../simulation/production/rates';
import { eraResource } from '../../simulation/progression/era';

const MS_PER_SECOND = 1000;
const SIM_MS = 10 * MS_PER_SECOND;
const CLICKS_PER_S = 15;
const TICKS_PER_S = 60;
const FX_KINDS: readonly FxKind[] = ['groundPulse', 'groundWave', 'baseDust', 'pylonPulse', 'arc', 'drift', 'debris', 'lamp', 'pebbles', 'hum', 'puddle'];
// The era states of the table. S13post is the S13 buys with the observer on; S13pre has the same buys, so the same rates.
const TABLE_STATES = ['S7', 'S9', 'S11', 'S13post', 'S15'];

// Click times of the worst case the crank allows: 15 a second for 10 s.
function clickTimes(): number[] {
  const out: number[] = [];
  for (let k = 0; (k * MS_PER_SECOND) / CLICKS_PER_S < SIM_MS; k++) out.push((k * MS_PER_SECOND) / CLICKS_PER_S);
  return out;
}

// The starts a throttled kind lets through: a request at t starts when throttleOk says the last start was gapMs or more before it.
function throttledStarts(requests: readonly number[], gapMs: number): number[] {
  const out: number[] = [];
  let last = -Infinity;
  for (const t of requests) {
    if (throttleOk(last, t, gapMs)) {
      out.push(t);
      last = t;
    }
  }
  return out;
}

// The smallest gap between neighbours of a sorted list (Infinity for fewer than two).
function minGap(times: readonly number[]): number {
  let best = Infinity;
  for (let i = 1; i < times.length; i++) best = Math.min(best, (times[i] ?? 0) - (times[i - 1] ?? 0));
  return best;
}

// A fixed-seed uniform stream (32-bit LCG), so the spawn tests read the same numbers on every run.
function uniforms(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('reachLevel on the shipped bounds (P17)', () => {
  it('is monotone in rate, inside [0, 1], and clamped at both ends for every energy', () => {
    for (const id of RESOURCE_IDS) {
      const lo = REACH_LEVEL.lo[id];
      const hi = REACH_LEVEL.hi[id];
      let prev = -1;
      for (let r = 0.01; r < 1e12; r *= 1.5) {
        const L = reachLevel(r, lo, hi);
        expect(L).toBeGreaterThanOrEqual(0);
        expect(L).toBeLessThanOrEqual(1);
        expect(L).toBeGreaterThanOrEqual(prev);
        prev = L;
      }
      expect(reachLevel(0, lo, hi)).toBe(0);
      expect(reachLevel(1e12, lo, hi)).toBe(1);
    }
  });
});

describe('throttleOk', () => {
  it('passes once the gap has elapsed; -Infinity always passes; a NaN time or gap never does', () => {
    expect(throttleOk(-Infinity, 0, 250)).toBe(true);
    expect(throttleOk(100, 349, 250)).toBe(false);
    expect(throttleOk(100, 350, 250)).toBe(true);
    expect(throttleOk(100, NaN, 250)).toBe(false);
    expect(throttleOk(100, 500, NaN)).toBe(false);
  });
});

describe('flash caps (B4: every flash rate <= maxFlashHz)', () => {
  it('the shipped numbers hold the rules: 3 Hz, a 250 ms crank gap, a 3 s wave gap, the lamp wobble at or below 3 Hz', () => {
    expect(REACH_FX.maxFlashHz).toBeLessThanOrEqual(3);
    expect(REACH_FX.groundPulse.minGapMs).toBeGreaterThanOrEqual(250);
    expect(REACH_FX.groundWave.minGapMs).toBeGreaterThanOrEqual(3000);
    expect(WORLD_FX.lampWobble.hz).toBeLessThanOrEqual(REACH_FX.maxFlashHz);
    expect(FLASH_GAP_MS).toBeGreaterThanOrEqual(MS_PER_SECOND / REACH_FX.maxFlashHz);
    expect(PULSE_GAP_MS).toBeGreaterThanOrEqual(REACH_FX.groundPulse.minGapMs);
  });

  it('a 10 s run of 15 clicks a second starts at most one crank pulse per 250 ms and at most maxFlashHz in any second', () => {
    const pulses = throttledStarts(clickTimes(), PULSE_GAP_MS);
    expect(pulses.length).toBeGreaterThan(0);
    expect(minGap(pulses)).toBeGreaterThanOrEqual(REACH_FX.groundPulse.minGapMs);
    expect(flashHz(pulses)).toBeLessThanOrEqual(REACH_FX.maxFlashHz);
  });

  it('a big purchase on every click (the worst case) starts at most one ground wave per 3 s', () => {
    const waves = throttledStarts(clickTimes(), REACH_FX.groundWave.minGapMs);
    expect(waves.length).toBeGreaterThan(0);
    expect(minGap(waves)).toBeGreaterThanOrEqual(REACH_FX.groundWave.minGapMs);
    expect(flashHz(waves)).toBeLessThanOrEqual(REACH_FX.maxFlashHz);
  });

  it('arc starts at the top of the arc law, throttled to the flash gap, stay within maxFlashHz', () => {
    const rate = arcRatePerS(1e12);
    const rnd = uniforms(7);
    const dt = MS_PER_SECOND / TICKS_PER_S;
    const requests: number[] = [];
    for (let t = 0; t < SIM_MS; t += dt) if (spawnDue(dt, rate, rnd())) requests.push(t);
    const starts = throttledStarts(requests, FLASH_GAP_MS);
    expect(starts.length).toBeGreaterThan(0);
    expect(flashHz(starts)).toBeLessThanOrEqual(REACH_FX.maxFlashHz);
  });

  it('pylon dot passes at a point stay at or below maxFlashHz on every cable length', () => {
    for (let len = 1; len <= 1000; len += 7) {
      const out: Vec2[] = [];
      const n = pylonDotPositions([{ x: 0, y: 0 }, { x: len, y: 0 }], pylonDotCount(1), 0, out);
      expect(n).toBeLessThanOrEqual(pylonDotCount(1));
      if (n > 0) expect((n * REACH_FX.pylonPulse.pxPerS) / len).toBeLessThanOrEqual(REACH_FX.maxFlashHz + 1e-9);
    }
  });
});

describe('pylon dots', () => {
  // Three points: 400 world px in all (200 across, then 200 down).
  const line: Vec2[] = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }];

  it('pylonDotCount is 1 + floor(3 L) between 1 and 4', () => {
    expect(pylonDotCount(0)).toBe(1);
    expect(pylonDotCount(0.33)).toBe(1);
    expect(pylonDotCount(0.34)).toBe(2);
    expect(pylonDotCount(0.67)).toBe(3);
    expect(pylonDotCount(1)).toBe(4);
    expect(pylonDotCount(2)).toBe(4);
    expect(pylonDotCount(NaN)).toBe(1);
  });

  it('places count dots evenly along the polyline and wraps them at the end', () => {
    const out: Vec2[] = [];
    expect(pylonDotPositions(line, 4, 0, out)).toBe(4);
    expect(out.slice(0, 4)).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }]);
    // 500 ms at 120 px/s moves every dot 60 px along.
    pylonDotPositions(line, 4, 500, out);
    expect(out.slice(0, 4)).toEqual([{ x: 60, y: 0 }, { x: 160, y: 0 }, { x: 200, y: 60 }, { x: 200, y: 160 }]);
    // 10 s at 120 px/s is 1200 px: three full loops of the 400 px line, so the dots are back at their start.
    pylonDotPositions(line, 4, 10000, out);
    expect(out.slice(0, 4)).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }]);
  });

  it('reuses the entries of out and reads 0 for fewer than two points', () => {
    const out: Vec2[] = [];
    pylonDotPositions(line, 4, 0, out);
    const first = out[0];
    pylonDotPositions(line, 4, 500, out);
    expect(out[0]).toBe(first);
    expect(out).toHaveLength(4);
    expect(pylonDotPositions([{ x: 0, y: 0 }], 4, 0, out)).toBe(0);
    expect(pylonDotPositions([], 4, 0, out)).toBe(0);
  });
});

describe('the level laws', () => {
  it('arc and drift rates are clamped laws of their drivers and rise with them', () => {
    expect(arcRatePerS(0)).toBe(0.2);
    expect(arcRatePerS(NaN)).toBe(0.2);
    expect(arcRatePerS(1e12)).toBe(1.5);
    expect(driftRatePerS(0)).toBe(0.1);
    expect(driftRatePerS(1e12)).toBe(0.4);
    let prevArc = 0;
    let prevDrift = 0;
    for (let v = 1; v <= 1e12; v *= 10) {
      const a = arcRatePerS(v);
      const d = driftRatePerS(v);
      expect(a).toBeGreaterThanOrEqual(prevArc);
      expect(d).toBeGreaterThanOrEqual(prevDrift);
      prevArc = a;
      prevDrift = d;
    }
  });

  it('dustFrequencyMs is 250 ms with no output, falls as the output rises, and never goes below 120 ms', () => {
    expect(dustFrequencyMs(0)).toBe(250);
    expect(dustFrequencyMs(NaN)).toBe(250);
    expect(dustFrequencyMs(-5)).toBe(250);
    let prev = Infinity;
    for (let v = 0; v <= 1e12; v = v === 0 ? 1 : v * 10) {
      const ms = dustFrequencyMs(v);
      expect(ms).toBeGreaterThanOrEqual(REACH_FX.dustLaw.floorMs);
      expect(ms).toBeLessThanOrEqual(prev);
      prev = ms;
    }
    expect(dustFrequencyMs(1e12)).toBe(REACH_FX.dustLaw.floorMs);
    expect(dustFrequencyMs(Infinity)).toBe(REACH_FX.dustLaw.floorMs);
  });

  it('spawnDue hits its rate over a long run (about 6000 s at 60 ticks a second)', () => {
    const rate = arcRatePerS(1e12);
    const rnd = uniforms(11);
    const dt = MS_PER_SECOND / TICKS_PER_S;
    const seconds = 6000;
    let spawns = 0;
    for (let k = 0; k < seconds * TICKS_PER_S; k++) if (spawnDue(dt, rate, rnd())) spawns++;
    expect(Math.abs(spawns / seconds - rate) / rate).toBeLessThan(0.05);
    expect(spawnDue(dt, rate, NaN)).toBe(false);
    expect(spawnDue(dt, 0, 0)).toBe(false);
  });
});

describe('debris (era V specks)', () => {
  it('debrisRiseArt never goes down, never goes negative, and hangs at the target', () => {
    for (const rise of [3000, 6000]) {
      for (const target of [8, 32]) {
        let prev = -1;
        for (let age = 0; age <= 10000; age += 13) {
          const v = debrisRiseArt(age, rise, target);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeGreaterThanOrEqual(prev);
          expect(v).toBeLessThanOrEqual(target);
          prev = v;
        }
        expect(debrisRiseArt(rise, rise, target)).toBe(target);
        expect(debrisRiseArt(10 * rise, rise, target)).toBe(target);
      }
    }
    expect(debrisRiseArt(NaN, 3000, 8)).toBe(0);
    expect(debrisRiseArt(100, 0, 8)).toBe(8);
  });

  it('debrisBobPx stays inside +-bobPx', () => {
    let peak = 0;
    for (let t = 0; t < SIM_MS; t += 11) peak = Math.max(peak, Math.abs(debrisBobPx(t, 0.25)));
    expect(peak).toBeLessThanOrEqual(REACH_FX.debris.bobPx + 1e-12);
    expect(peak).toBeGreaterThan(REACH_FX.debris.bobPx * 0.99);
  });
});

describe('ground waves, reduced motion and the flash helper', () => {
  it('groundWaveX moves at the wave speed in the direction given, and a NaN age holds the start', () => {
    expect(groundWaveX(100, 1, 1000)).toBe(400);
    expect(groundWaveX(100, -1, 1000)).toBe(-200);
    expect(groundWaveX(100, 0, 1000)).toBe(100);
    expect(groundWaveX(100, 1, NaN)).toBe(100);
    expect(waveArrivalMs(300)).toBe(1000);
    expect(waveArrivalMs(0)).toBe(0);
    expect(waveArrivalMs(NaN)).toBe(0);
  });

  it('every era has a ground colour (F38), and eras III-IV (the sand) differ from era I', () => {
    expect(Object.keys(REACH_FX.colors.ground).map(Number)).toEqual([1, 2, 3, 4, 5]);
    for (const era of [1, 2, 3, 4, 5] as const) expect(REACH_FX.colors.ground[era]).toBeTypeOf('number');
    expect(REACH_FX.colors.ground[3]).not.toBe(REACH_FX.colors.ground[1]);
    expect(REACH_FX.colors.ground[4]).not.toBe(REACH_FX.colors.ground[1]);
  });

  it('the Splice copies the reach chunk reads (SPLICE_REACH) equal the Splice data they copy', () => {
    expect(SPLICE_REACH.redrawHz).toBe(SPLICE_FX.redrawHz);
    expect(SPLICE_REACH.phoneDropEnd.dx).toBe(SPLICE_LINE_STYLE.drop.endDx);
    expect(SPLICE_REACH.phoneDropEnd.dy).toBe(SPLICE_LINE_STYLE.drop.endDy);
  });

  it('under reduced motion only debris is drawn (static specks) and debris does not move', () => {
    for (const kind of FX_KINDS) expect(fxEnabled(kind, true)).toBe(kind === 'debris');
    for (const kind of FX_KINDS) expect(fxEnabled(kind, false)).toBe(true);
    expect(debrisMoves(true)).toBe(false);
    expect(debrisMoves(false)).toBe(true);
  });

  it('flashHz counts the most events in any 1 s window', () => {
    expect(flashHz([])).toBe(0);
    expect(flashHz([0, 334, 668])).toBe(3);
    expect(flashHz([0, 334, 668, 1002])).toBe(3);
    expect(flashHz([0, 250, 500, 750])).toBe(4);
    expect(flashHz([0, NaN, 10])).toBe(2);
  });
});

describe('per-era reach table (AD4 tunes REACH_LEVEL from it)', () => {
  it('prints each era energy: rate, reach level L, with 0 <= L <= 1 and a rate above 0', () => {
    const specs = ERA_SPECS.filter((s) => TABLE_STATES.includes(s.id));
    expect(specs.map((s) => s.id)).toEqual(TABLE_STATES);
    const rows = specs.map((spec) => {
      const state = eraStateOf(spec);
      const techLevels = {} as Record<TechId, number>;
      for (const id of TECH_IDS) techLevels[id] = state.levels[id] ?? 0;
      const energy = eraResource(state.era);
      const ratePerSecond = computeRates({ techLevels }).perSecond[energy];
      const L = reachLevel(ratePerSecond, REACH_LEVEL.lo[energy], REACH_LEVEL.hi[energy]);
      return { state: spec.id, era: state.era, energy, ratePerSecond, L };
    });
    console.table(rows);
    for (const row of rows) {
      expect(row.ratePerSecond).toBeGreaterThan(0);
      expect(row.L).toBeGreaterThanOrEqual(0);
      expect(row.L).toBeLessThanOrEqual(1);
    }
  });
});

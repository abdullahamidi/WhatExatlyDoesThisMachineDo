// Living world day, weather and ambient data tests (WP24 T2a): the recorded Tuesday bands, the tint keys (R >= G >= B, brightness floor,
// era III front darkening), the era gates read from TECHNOLOGIES, the weather per era, the gust sines, the sway against the windy eras,
// the micro schedules, the hash stream salts (each stream its own seed), the drip colour and the ordering of every range. Structure
// only: the tuned numbers belong to the Art Director.
// Why: the day clock, the sky and the props read these tables, so a gap in the band order or a gate on the wrong resource shows up here.
// Pure data test (node environment, no Phaser).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { TECHNOLOGIES } from './technologies';
import { PALETTE } from './palette';
import { eraResource } from '../simulation/progression/era';
import { WORLD_AMBIENT, WORLD_DAY, WORLD_WEATHER } from './worldDay';
import type { DayEra, MicroKind } from './worldDay';

const SRC = readFileSync(new URL('./worldDay.ts', import.meta.url), 'utf8');
const ERAS: readonly DayEra[] = [1, 2, 3, 4, 5];
const MICRO_KINDS: readonly MicroKind[] = ['hitch', 'ledBlink', 'ledDim', 'lampDip', 'boothDip', 'girlWindowDim', 'clockTwitch', 'pages'];
const redOf = (rgb: number): number => (rgb >> 16) & 0xff;
const greenOf = (rgb: number): number => (rgb >> 8) & 0xff;
const blueOf = (rgb: number): number => rgb & 0xff;
const brightness = (rgb: number): number => Math.max(redOf(rgb), greenOf(rgb), blueOf(rgb)) / 255;

// Every [lo, hi] pair (two numbers) found anywhere in a table, depth first.
function rangesOf(value: unknown, out: Array<[number, number]> = []): Array<[number, number]> {
  if (Array.isArray(value)) {
    const [lo, hi] = value;
    if (value.length === 2 && typeof lo === 'number' && typeof hi === 'number') out.push([lo, hi]);
    for (const item of value) rangesOf(item, out);
  } else if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) rangesOf(item, out);
  }
  return out;
}

describe('worldDay: the recorded Tuesday', () => {
  it('bands run in era order from startMin to heldMin with no gap', () => {
    const { bands, startMin, heldMin } = WORLD_DAY;
    expect(bands.map((b) => b.era)).toEqual(ERAS);
    expect(bands[0]?.fromMin).toBe(startMin);
    expect(bands[bands.length - 1]?.toMin).toBe(heldMin);
    bands.forEach((band, i) => {
      expect(band.fromMin).toBeLessThan(band.toMin);
      if (i > 0) expect(band.fromMin).toBe(bands[i - 1]?.toMin);
    });
  });

  it('tint keys are strictly sorted from startMin to heldMin', () => {
    const keys = WORLD_DAY.tintKeys;
    expect(keys[0]?.min).toBe(WORLD_DAY.startMin);
    expect(keys[keys.length - 1]?.min).toBe(WORLD_DAY.heldMin);
    for (let i = 1; i < keys.length; i++) {
      const prev = keys[i - 1];
      const cur = keys[i];
      if (prev && cur) expect(cur.min).toBeGreaterThan(prev.min);
    }
  });

  it('every tint key is R >= G >= B and at least minBrightness bright', () => {
    for (const key of WORLD_DAY.tintKeys) {
      expect(redOf(key.rgb)).toBeGreaterThanOrEqual(greenOf(key.rgb));
      expect(greenOf(key.rgb)).toBeGreaterThanOrEqual(blueOf(key.rgb));
      expect(brightness(key.rgb)).toBeGreaterThanOrEqual(WORLD_DAY.minBrightness);
    }
  });

  it('the era III keys stay bright and blue-free after the front darkening', () => {
    const eraIII = WORLD_DAY.bands.find((b) => b.era === 3);
    const frontKeys = WORLD_DAY.tintKeys.filter((k) => eraIII !== undefined && k.min >= eraIII.fromMin && k.min <= eraIII.toMin);
    expect(frontKeys.length).toBeGreaterThan(0);
    for (const key of frontKeys) {
      const darkR = redOf(key.rgb) * WORLD_DAY.frontDarken;
      const darkG = greenOf(key.rgb) * WORLD_DAY.frontDarken;
      const darkB = blueOf(key.rgb) * WORLD_DAY.frontDarken;
      expect(darkR).toBeGreaterThanOrEqual(darkG);
      expect(darkG).toBeGreaterThanOrEqual(darkB);
      expect(Math.max(darkR, darkG, darkB) / 255).toBeGreaterThanOrEqual(WORLD_DAY.minBrightness);
    }
  });

  it('every era gate is a TECHNOLOGIES milestone whose lifetime requirement is that era resource', () => {
    for (const era of ERAS) {
      const gate = WORLD_DAY.gates[era];
      expect(TECHNOLOGIES[gate].id).toBe(gate);
      const lifetime = TECHNOLOGIES[gate].requires.find((r) => r.type === 'lifetime');
      expect(lifetime).toMatchObject({ type: 'lifetime', res: eraResource(era) });
    }
  });
});

describe('worldDay: weather', () => {
  it('has a weather row for every era 1-5', () => {
    expect(Object.keys(WORLD_WEATHER.eras).map(Number).sort()).toEqual(ERAS);
    expect(Object.keys(WORLD_WEATHER.labels).map(Number).sort()).toEqual(ERAS);
  });

  it('era V is still air (wind 0, no gusts) and the dust breathes on one 97 s sine', () => {
    expect(WORLD_WEATHER.eras[5].wind).toEqual([0, 0]);
    expect(WORLD_WEATHER.eras[5].gusts).toBe(false);
    expect(WORLD_WEATHER.dustDrift.amp).toBe(0.1);
    expect(WORLD_WEATHER.dustDrift.periodMs).toBe(97000);
  });

  it('gust sines have pairwise different periods, none below 10 s', () => {
    const periods = WORLD_WEATHER.gustSines.map((s) => s.periodMs);
    expect(new Set(periods).size).toBe(periods.length);
    for (const period of periods) expect(period).toBeGreaterThanOrEqual(10000);
  });

  it('every windy era moves each sway offset by at least one whole px at its base wind', () => {
    const { sproutPx, scrapLiftPx, scrapDxPx } = WORLD_AMBIENT.sway;
    for (const era of ERAS) {
      const wind: number = WORLD_WEATHER.eras[era].wind[0];
      if (wind <= 0) continue;
      for (const px of [sproutPx, scrapLiftPx, scrapDxPx]) {
        expect(Math.round(px * wind)).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('gives the scrap lift a finite phase in radians and the mote drift a whole number of mote periods', () => {
    expect(Number.isFinite(WORLD_AMBIENT.sway.scrapLiftPhaseRad)).toBe(true);
    const { driftPeriods } = WORLD_AMBIENT.motes;
    expect(Number.isInteger(driftPeriods)).toBe(true);
    expect(driftPeriods).toBeGreaterThanOrEqual(1);
  });

  it('gives every hash stream its own salt: one micro stream per kind, the gust, the vent and the motes', () => {
    const { seeds } = WORLD_AMBIENT;
    const streams = [...MICRO_KINDS.map((_, i) => seeds.micro + i), seeds.gust, seeds.vent, seeds.motes];
    expect(new Set(streams).size).toBe(streams.length);
  });
});

describe('worldDay: ambient', () => {
  it('has a micro schedule for every kind, with ordered ranges and non-empty eras inside 1-5', () => {
    expect(Object.keys(WORLD_AMBIENT.micro).sort()).toEqual([...MICRO_KINDS].sort());
    for (const kind of MICRO_KINDS) {
      const row = WORLD_AMBIENT.micro[kind];
      expect(row.everyMs[0]).toBeLessThan(row.everyMs[1]);
      if (kind === 'pages') expect(row.holdMs[0]).toBeLessThanOrEqual(row.holdMs[1]);
      else expect(row.holdMs[0]).toBeLessThan(row.holdMs[1]);
      expect(row.eras.length).toBeGreaterThan(0);
      for (const era of row.eras) expect(ERAS).toContain(era);
    }
  });

  it('the ruffle drip falls a positive distance in a palette colour with red >= blue, from era III', () => {
    const { drip } = WORLD_AMBIENT;
    expect(drip.fallPx).toBeGreaterThan(0);
    expect(drip.fromEra).toBe(3);
    const rgb = PALETTE[drip.paletteKey];
    expect(redOf(rgb)).toBeGreaterThanOrEqual(blueOf(rgb));
  });

  it('every [lo, hi] range in the day, weather and ambient tables is ordered', () => {
    const ranges = [...rangesOf(WORLD_DAY), ...rangesOf(WORLD_WEATHER), ...rangesOf(WORLD_AMBIENT)];
    expect(ranges.length).toBeGreaterThan(0);
    for (const [lo, hi] of ranges) expect(lo).toBeLessThanOrEqual(hi);
  });

  it('the source has no Phaser import', () => {
    expect(SRC).not.toMatch(/from\s+['"][^'"]*phaser/i);
  });
});

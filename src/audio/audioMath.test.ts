import { describe, it, expect } from 'vitest';
import { AUDIO } from '../data/audio';
import type { BedId, CuePart, CueParts, FaultFlavour } from '../data/audio';
import { ERA_KEYSTONES } from '../data/eras';
import type { EraNumber } from '../data/eras';
import { MUSIC } from '../data/music';
import { RESOURCES } from '../data/resources';
import { TECHNOLOGIES, TECH_LIST } from '../data/technologies';
import { RESOURCE_IDS, TECH_IDS } from '../data/types';
import type { EndingPhase, ResourceId, TechId } from '../data/types';
import { isSplice } from '../simulation/progression/status';
import type { AmbientMix, LevelSnapshot, WeatherInput, WeatherMix } from './audioMath';
import {
  ambientMix,
  ambientPeakSum,
  activityLevel,
  arcRate,
  bedTrim,
  boilerGain,
  busGain,
  chirpSweeps,
  chordFrequencies,
  droneGain,
  gearTickRate,
  humFrequency,
  humGain,
  levelsChanged,
  mainsGain,
  masterTarget,
  padGain,
  pokePitchScale,
  pokeVariant,
  purchaseCue,
  servoFraction,
  servoGain,
  servoHz,
  stampPartials,
  weatherMix,
  windAllowed,
} from './audioMath';
import { musicContribution } from './musicMath';

const BEDS: BedId[] = ['hum', 'gear', 'mains', 'boiler', 'pad', 'servo', 'drone', 'wind', 'rain'];
const ERAS = [1, 2, 3, 4, 5] as const;

const SAMPLE_INPUTS = [0, -5, NaN, Infinity, 1e12, 0.001, 1];

// Every part of the WP28 cues (Finds, Splice wakes) and every poke variant (twelve ids, two each), as cue parts.
const CUE_PARTS: CuePart[] = [...AUDIO.findSpawn, ...AUDIO.findCollect, ...AUDIO.relicCollect];
for (const wake of AUDIO.spliceWake) CUE_PARTS.push(...wake);
for (const pair of Object.values(AUDIO.poke.variants)) CUE_PARTS.push(...pair);

function numericLeaves(value: unknown, path: string, out: Array<{ path: string; value: number }>): void {
  if (typeof value === 'number') {
    out.push({ path, value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v: unknown, i) => numericLeaves(v, `${path}[${i}]`, out));
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      numericLeaves(child, path ? `${path}.${key}` : key, out);
    }
  }
}

describe('audio math: finite and in range for edge inputs', () => {
  it.each(SAMPLE_INPUTS)('outputs are finite and in range for %s', (ps) => {
    const level = activityLevel(ps, AUDIO.hum.refPerSecond, AUDIO.hum.maxPerSecond);
    expect(Number.isFinite(level)).toBe(true);
    expect(level).toBeGreaterThanOrEqual(0);
    expect(level).toBeLessThanOrEqual(1);

    const freq = humFrequency(ps);
    expect(Number.isFinite(freq)).toBe(true);
    expect(freq).toBeGreaterThanOrEqual(AUDIO.hum.minHz);
    expect(freq).toBeLessThanOrEqual(AUDIO.hum.maxHz);

    const gain = humGain(ps);
    expect(Number.isFinite(gain)).toBe(true);
    expect(gain).toBeGreaterThanOrEqual(0);
    expect(gain).toBeLessThanOrEqual(AUDIO.hum.maxGain);

    const ticks = gearTickRate(ps);
    expect(Number.isFinite(ticks)).toBe(true);
    expect(ticks === 0 || (ticks >= AUDIO.gearTick.minPerSecond && ticks <= AUDIO.gearTick.maxPerSecond)).toBe(true);
  });
});

describe('activityLevel', () => {
  it('is monotonic over an increasing list', () => {
    const list = [0, 0.001, 0.5, 1, 10, 100, 1000, 5000, 1e6, 1e12];
    for (let i = 1; i < list.length; i++) {
      const prev = activityLevel(list[i - 1]!, AUDIO.hum.refPerSecond, AUDIO.hum.maxPerSecond);
      const next = activityLevel(list[i]!, AUDIO.hum.refPerSecond, AUDIO.hum.maxPerSecond);
      expect(next).toBeGreaterThanOrEqual(prev);
    }
  });

  it('is 0 for non-positive and NaN, 1 for Infinity', () => {
    expect(activityLevel(0, 1, 5000)).toBe(0);
    expect(activityLevel(-5, 1, 5000)).toBe(0);
    expect(activityLevel(NaN, 1, 5000)).toBe(0);
    expect(activityLevel(Infinity, 1, 5000)).toBe(1);
  });
});

describe('humFrequency', () => {
  it('equals minHz at 0 ME/s and maxHz at 1e12 ME/s', () => {
    expect(humFrequency(0)).toBeCloseTo(AUDIO.hum.minHz, 9);
    expect(humFrequency(1e12)).toBeCloseTo(AUDIO.hum.maxHz, 9);
  });

  it('is monotonic non-decreasing', () => {
    const list = [0, 0.001, 1, 10, 100, 1000, 5000];
    for (let i = 1; i < list.length; i++) {
      expect(humFrequency(list[i]!)).toBeGreaterThanOrEqual(humFrequency(list[i - 1]!));
    }
  });
});

describe('humGain', () => {
  it('is 0 at 0 ME/s, NaN and negative input', () => {
    expect(humGain(0)).toBe(0);
    expect(humGain(-5)).toBe(0);
    expect(humGain(NaN)).toBe(0);
  });

  it('is positive for a tiny positive rate and at most maxGain', () => {
    expect(humGain(0.001)).toBeGreaterThan(0);
    expect(humGain(1e12)).toBeCloseTo(AUDIO.hum.maxGain, 9);
  });
});

describe('gearTickRate', () => {
  it('is 0 at 0 ME/s', () => {
    expect(gearTickRate(0)).toBe(0);
  });

  it('is at least minPerSecond for a tiny positive rate', () => {
    expect(gearTickRate(0.001)).toBeGreaterThanOrEqual(AUDIO.gearTick.minPerSecond);
  });

  it('reaches maxPerSecond at huge rates and is monotonic', () => {
    expect(gearTickRate(1e12)).toBeCloseTo(AUDIO.gearTick.maxPerSecond, 9);
    const list = [0.001, 1, 10, 100, 1000, 5000, 1e6];
    for (let i = 1; i < list.length; i++) {
      expect(gearTickRate(list[i]!)).toBeGreaterThanOrEqual(gearTickRate(list[i - 1]!));
    }
  });
});

describe('masterTarget', () => {
  it('is 0 when muted or locked', () => {
    expect(masterTarget(true, true)).toBe(0);
    expect(masterTarget(false, false)).toBe(0);
    expect(masterTarget(true, false)).toBe(0);
  });

  it('is the master gain when audible and unlocked', () => {
    expect(masterTarget(false, true)).toBe(AUDIO.masterGain);
  });

  it('honours a custom base', () => {
    expect(masterTarget(false, true, 0.7)).toBeCloseTo(0.7, 9);
    expect(masterTarget(true, true, 0.7)).toBe(0);
  });

  it('scales the base by the master volume', () => {
    expect(masterTarget(false, true, AUDIO.masterGain, 0)).toBe(0);
    expect(masterTarget(false, true, AUDIO.masterGain, 0.5)).toBeCloseTo(AUDIO.masterGain * 0.5, 9);
    expect(masterTarget(false, true, AUDIO.masterGain, 1)).toBeCloseTo(AUDIO.masterGain, 9);
  });

  it('keeps mute and lock at 0 whatever the volume', () => {
    expect(masterTarget(true, true, AUDIO.masterGain, 1)).toBe(0);
    expect(masterTarget(false, false, AUDIO.masterGain, 1)).toBe(0);
  });
});

describe('busGain', () => {
  it('maps percent to a unit gain', () => {
    expect(busGain(0)).toBe(0);
    expect(busGain(50)).toBeCloseTo(0.5, 9);
    expect(busGain(100)).toBe(1);
  });

  it('clamps out-of-range percents', () => {
    expect(busGain(150)).toBe(1);
    expect(busGain(-10)).toBe(0);
  });

  it('treats non-finite input as unity', () => {
    expect(busGain(NaN)).toBe(1);
    expect(busGain(Infinity)).toBe(1);
    expect(busGain(-Infinity)).toBe(1);
  });
});

describe('AUDIO data', () => {
  it('has three sting notes', () => {
    expect(AUDIO.sting.notesHz).toHaveLength(3);
  });

  it('has every numeric leaf finite and >= 0 (dB leaves excepted)', () => {
    const leaves: Array<{ path: string; value: number }> = [];
    numericLeaves(AUDIO, '', leaves);
    expect(leaves.length).toBeGreaterThan(0);
    for (const leaf of leaves) {
      expect(Number.isFinite(leaf.value), leaf.path).toBe(true);
      if (leaf.path === 'limiter.threshold') continue; // compressor threshold is in dBFS (negative by design)
      expect(leaf.value, leaf.path).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('mainsGain', () => {
  it('is 0 for ee 0, negative and NaN', () => {
    expect(mainsGain(0)).toBe(0);
    expect(mainsGain(-5)).toBe(0);
    expect(mainsGain(NaN)).toBe(0);
  });

  it('is positive for ee 1', () => {
    expect(mainsGain(1)).toBeGreaterThan(0);
  });

  it('stays within [minGain, maxGain] for positive ee, including huge values', () => {
    for (const ee of [0.001, 1, 10, 1000, 1e12, Infinity]) {
      const g = mainsGain(ee);
      expect(g).toBeGreaterThanOrEqual(AUDIO.mains.minGain);
      expect(g).toBeLessThanOrEqual(AUDIO.mains.maxGain);
    }
    expect(mainsGain(1e12)).toBeCloseTo(AUDIO.mains.maxGain, 9);
  });

  it('is monotonic non-decreasing', () => {
    const list = [0, 0.001, 1, 10, 100, 1000, 5000, 1e6];
    for (let i = 1; i < list.length; i++) {
      expect(mainsGain(list[i]!)).toBeGreaterThanOrEqual(mainsGain(list[i - 1]!));
    }
  });
});

describe('arcRate', () => {
  it('is 0 when the spark gap is not owned', () => {
    expect(arcRate(1e12, false)).toBe(0);
    expect(arcRate(100, false)).toBe(0);
  });

  it('is 0 for ee <= 0 and NaN, even with the spark gap', () => {
    expect(arcRate(0, true)).toBe(0);
    expect(arcRate(-5, true)).toBe(0);
    expect(arcRate(NaN, true)).toBe(0);
  });

  it('stays within [minRate, maxRate] and never above 3 for positive ee', () => {
    for (const ee of [0.001, 1, 10, 1000, 1e12, Infinity]) {
      const r = arcRate(ee, true);
      expect(r).toBeGreaterThanOrEqual(AUDIO.arc.minRate);
      expect(r).toBeLessThanOrEqual(AUDIO.arc.maxRate);
      expect(r).toBeLessThanOrEqual(3);
    }
    expect(arcRate(1e12, true)).toBeCloseTo(AUDIO.arc.maxRate, 9);
  });

  it('is monotonic non-decreasing', () => {
    const list = [0.001, 1, 10, 100, 1000, 5000, 1e6];
    for (let i = 1; i < list.length; i++) {
      expect(arcRate(list[i]!, true)).toBeGreaterThanOrEqual(arcRate(list[i - 1]!, true));
    }
  });
});

describe('boilerGain', () => {
  it('is 0 when the boiler is not owned, even with huge PR/s', () => {
    expect(boilerGain(1e12, false)).toBe(0);
    expect(boilerGain(Infinity, false)).toBe(0);
  });

  it('is 0 for pr 0, negative and NaN, even when owned', () => {
    expect(boilerGain(0, true)).toBe(0);
    expect(boilerGain(-5, true)).toBe(0);
    expect(boilerGain(NaN, true)).toBe(0);
  });

  it('is positive for pr 1 when owned', () => {
    expect(boilerGain(1, true)).toBeGreaterThan(0);
  });

  it('stays within [minGain, maxGain] for pr > 0, including huge values', () => {
    for (const pr of [0.001, 1, 10, 1000, 1e12, Infinity]) {
      const g = boilerGain(pr, true);
      expect(g).toBeGreaterThanOrEqual(AUDIO.boiler.minGain);
      expect(g).toBeLessThanOrEqual(AUDIO.boiler.maxGain);
    }
    expect(boilerGain(1e12, true)).toBeCloseTo(AUDIO.boiler.maxGain, 9);
  });

  it('is monotonic non-decreasing', () => {
    const list = [0, 0.001, 1, 10, 100, 1000, 5000, 1e6, 1e12];
    for (let i = 1; i < list.length; i++) {
      expect(boilerGain(list[i]!, true)).toBeGreaterThanOrEqual(boilerGain(list[i - 1]!, true));
    }
  });
});

describe('padGain', () => {
  it('is 0 when the spire is not owned, even with huge RS/s', () => {
    expect(padGain(1e9, false)).toBe(0);
    expect(padGain(1e12, false)).toBe(0);
  });

  it('is 0 for rs 0, negative and NaN, even when owned', () => {
    expect(padGain(0, true)).toBe(0);
    expect(padGain(-5, true)).toBe(0);
    expect(padGain(NaN, true)).toBe(0);
  });

  it('is positive for rs 1 when owned', () => {
    expect(padGain(1, true)).toBeGreaterThan(0);
  });

  it('stays within [minGain, maxGain] for rs > 0, including huge values', () => {
    for (const rs of [0.001, 1, 10, 1000, 1e12, Infinity]) {
      const g = padGain(rs, true);
      expect(g).toBeGreaterThanOrEqual(AUDIO.pad.minGain);
      expect(g).toBeLessThanOrEqual(AUDIO.pad.maxGain);
    }
    expect(padGain(1e12, true)).toBeCloseTo(AUDIO.pad.maxGain, 9);
  });

  it('is monotonic non-decreasing over rs', () => {
    const list = [1, 10, 1e3, 1e6];
    for (let i = 1; i < list.length; i++) {
      expect(padGain(list[i]!, true)).toBeGreaterThanOrEqual(padGain(list[i - 1]!, true));
    }
  });
});

describe('droneGain', () => {
  it('is 0 when nullChamber is not owned, even with huge XF/s', () => {
    expect(droneGain(1e12, false)).toBe(0);
    expect(droneGain(Infinity, false)).toBe(0);
  });

  it('is 0 for xf 0, negative and NaN, even when owned', () => {
    expect(droneGain(0, true)).toBe(0);
    expect(droneGain(-5, true)).toBe(0);
    expect(droneGain(NaN, true)).toBe(0);
  });

  it('is positive for xf 1 when owned', () => {
    expect(droneGain(1, true)).toBeGreaterThan(0);
  });

  it('stays within [minGain, maxGain] for huge values', () => {
    for (const xf of [0.001, 1, 10, 1000, 1e15, Infinity]) {
      const g = droneGain(xf, true);
      expect(g).toBeGreaterThanOrEqual(AUDIO.drone.minGain);
      expect(g).toBeLessThanOrEqual(AUDIO.drone.maxGain);
    }
    expect(droneGain(1e15, true)).toBeLessThanOrEqual(AUDIO.drone.maxGain);
  });

  it('is monotonic non-decreasing over xf', () => {
    const list = [1, 10, 1e3, 1e6, 1e9];
    for (let i = 1; i < list.length; i++) {
      expect(droneGain(list[i]!, true)).toBeGreaterThanOrEqual(droneGain(list[i - 1]!, true));
    }
  });

  it('equals maxGain at maxPerSecond', () => {
    expect(droneGain(AUDIO.drone.maxPerSecond, true)).toBeCloseTo(AUDIO.drone.maxGain, 9);
  });
});

describe('servo maths', () => {
  it('servoFraction: level / maxLevel clamped to [0, 1]; invalid input 0', () => {
    expect(servoFraction(0, 10)).toBe(0);
    expect(servoFraction(5, 10)).toBeCloseTo(0.5, 9);
    expect(servoFraction(20, 10)).toBe(1);
    expect(servoFraction(3, 0)).toBe(0);
    expect(servoFraction(NaN, 10)).toBe(0);
    expect(servoFraction(-2, 10)).toBe(0);
  });

  it('servoGain: 0 at level 0 and NaN, maxGain at full level, between the bounds in between', () => {
    expect(servoGain(0, 10)).toBe(0);
    expect(servoGain(NaN, 10)).toBe(0);
    expect(servoGain(10, 10)).toBeCloseTo(AUDIO.servo.maxGain, 9);
    expect(servoGain(1, 10)).toBeGreaterThan(AUDIO.servo.minGain);
    expect(servoGain(1, 10)).toBeLessThan(AUDIO.servo.maxGain);
  });

  it('servoHz: minHz at level 0, maxHz at full level, monotonic', () => {
    expect(servoHz(0, 10)).toBe(AUDIO.servo.minHz);
    expect(servoHz(10, 10)).toBeCloseTo(AUDIO.servo.maxHz, 9);
    const list = [0, 1, 2, 5, 9, 10];
    for (let i = 1; i < list.length; i++) {
      expect(servoHz(list[i]!, 10)).toBeGreaterThanOrEqual(servoHz(list[i - 1]!, 10));
    }
  });
});

describe('levelsChanged', () => {
  const BASE: LevelSnapshot = { master: 0.5, wind: true, sfxBus: 1, ambientBus: 0.5, musicBus: 0.42 };

  it('is true when nothing was applied yet', () => {
    expect(levelsChanged(null, BASE)).toBe(true);
  });

  it('is false for an identical set', () => {
    expect(levelsChanged(BASE, { ...BASE })).toBe(false);
  });

  it('is true when any one field differs', () => {
    expect(levelsChanged(BASE, { ...BASE, master: 0.4 })).toBe(true);
    expect(levelsChanged(BASE, { ...BASE, wind: false })).toBe(true);
    expect(levelsChanged(BASE, { ...BASE, sfxBus: 0.5 })).toBe(true);
    expect(levelsChanged(BASE, { ...BASE, ambientBus: 0 })).toBe(true);
    expect(levelsChanged(BASE, { ...BASE, musicBus: 0 })).toBe(true);
  });

  it('treats NaN as equal to NaN and 0 as different from -0', () => {
    const nan: LevelSnapshot = { ...BASE, master: Number.NaN };
    expect(levelsChanged(nan, { ...nan })).toBe(false);
    expect(levelsChanged({ ...BASE, master: 0 }, { ...BASE, master: -0 })).toBe(true);
  });
});

describe('chordFrequencies', () => {
  it('multiplies the root by each ratio, in order', () => {
    const hz = chordFrequencies(100, [4, 5, 6, 8]);
    expect(hz).toHaveLength(4);
    expect(hz[0]).toBeCloseTo(400, 9);
    expect(hz[1]).toBeCloseTo(500, 9);
    expect(hz[2]).toBeCloseTo(600, 9);
    expect(hz[3]).toBeCloseTo(800, 9);
  });

  it('gives an empty list for a non-positive or non-finite root, and for no ratios', () => {
    for (const root of [0, -5, NaN, Infinity]) {
      expect(chordFrequencies(root, [4, 5, 6, 8])).toEqual([]);
    }
    expect(chordFrequencies(100, [])).toEqual([]);
  });

  it('resolveChord ratios are a major triad plus octave (root, 5/4, 3/2, 2)', () => {
    const [root, third, fifth, octave] = AUDIO.resolveChord.ratios;
    expect(root).toBeGreaterThan(0);
    expect(AUDIO.resolveChord.ratios).toHaveLength(4);
    expect((third ?? 0) / (root ?? 1)).toBeCloseTo(1.25, 9);
    expect((fifth ?? 0) / (root ?? 1)).toBeCloseTo(1.5, 9);
    expect((octave ?? 0) / (root ?? 1)).toBeCloseTo(2, 9);
  });

  it('resolveChord frequencies are ascending and audible', () => {
    const hz = chordFrequencies(AUDIO.resolveChord.baseHz, AUDIO.resolveChord.ratios);
    for (let i = 0; i < hz.length; i++) {
      expect(hz[i]).toBeGreaterThan(20);
      expect(hz[i]).toBeLessThan(20000);
      if (i > 0) expect(hz[i]).toBeGreaterThan(hz[i - 1]!);
    }
  });
});

describe('chirpSweeps', () => {
  it('has AUDIO.chirp.count sweeps (2 to 3 short chirps)', () => {
    const sweeps = chirpSweeps();
    expect(sweeps).toHaveLength(AUDIO.chirp.count);
    expect(sweeps.length).toBeGreaterThanOrEqual(2);
    expect(sweeps.length).toBeLessThanOrEqual(3);
  });

  it('starts at 0 and steps by gapMs; every sweep has sweepMs duration and sweeps upward', () => {
    const sweeps = chirpSweeps();
    sweeps.forEach((sweep, i) => {
      expect(sweep.startS).toBeCloseTo((i * AUDIO.chirp.gapMs) / 1000, 9);
      expect(sweep.durationS).toBeCloseTo(AUDIO.chirp.sweepMs / 1000, 9);
      expect(sweep.fromHz).toBeCloseTo(AUDIO.chirp.fromHz, 9);
      expect(sweep.toHz).toBeCloseTo(AUDIO.chirp.toHz, 9);
      expect(sweep.fromHz).toBeLessThan(sweep.toHz);
      expect(sweep.durationS).toBeGreaterThan(0);
    });
  });

  it('follows the config it is given', () => {
    const cfg = { count: 1, gapMs: 100, sweepMs: 50, fromHz: 1000, toHz: 2000, modHz: 10, modDepth: 5, gain: 0.1 } as const;
    expect(chirpSweeps(cfg)).toEqual([{ startS: 0, durationS: 0.05, fromHz: 1000, toHz: 2000 }]);
    expect(chirpSweeps({ ...cfg, count: 0 })).toEqual([]);
  });
});

describe('stampPartials', () => {
  it('lists thump, rattle, then click in that order', () => {
    expect(stampPartials().map((p) => p.kind)).toEqual(['thump', 'rattle', 'click']);
  });

  it('thump and rattle start at the cue; the click starts after clickDelayMs', () => {
    const [thump, rattle, click] = stampPartials();
    expect(thump?.startS).toBe(0);
    expect(rattle?.startS).toBe(0);
    expect(click?.startS).toBeCloseTo(AUDIO.stamp.clickDelayMs / 1000, 9);
  });

  it('every part has finite positive timing and pitch, a gain in (0, 1], and non-negative start', () => {
    for (const p of stampPartials()) {
      expect(Number.isFinite(p.startS) && p.startS >= 0, p.kind).toBe(true);
      expect(Number.isFinite(p.durationS) && p.durationS > 0, p.kind).toBe(true);
      expect(Number.isFinite(p.hz) && p.hz > 0, p.kind).toBe(true);
      expect(Number.isFinite(p.gain) && p.gain > 0 && p.gain <= 1, p.kind).toBe(true);
    }
  });

  it('the whole cue ends within 300 ms', () => {
    const end = Math.max(...stampPartials().map((p) => p.startS + p.durationS));
    expect(end).toBeLessThanOrEqual(0.3);
    expect(end).toBeGreaterThan(0);
  });

  it('follows the config it is given', () => {
    const cfg = {
      thumpHz: 50,
      thumpMs: 100,
      thumpGain: 0.4,
      noiseMs: 40,
      noiseLowpassHz: 300,
      noiseGain: 0.1,
      clickHz: 2000,
      clickDelayMs: 20,
      clickMs: 30,
      clickGain: 0.2,
    };
    expect(stampPartials(cfg)).toEqual([
      { kind: 'thump', startS: 0, durationS: 0.1, hz: 50, gain: 0.4 },
      { kind: 'rattle', startS: 0, durationS: 0.04, hz: 300, gain: 0.1 },
      { kind: 'click', startS: 0.02, durationS: 0.03, hz: 2000, gain: 0.2 },
    ]);
  });
});

describe('windAllowed', () => {
  const TABLE: ReadonlyArray<[EndingPhase, boolean]> = [
    ['none', true],
    ['sequence', true],
    ['choice', false],
    ['postgame', false],
  ];

  it.each(TABLE)('phase %s -> %s', (phase, allowed) => {
    expect(windAllowed(phase)).toBe(allowed);
  });
});

function levelsOwning(...owned: TechId[]): Record<TechId, number> {
  const levels = {} as Record<TechId, number>;
  for (const id of TECH_IDS) levels[id] = 0;
  for (const id of owned) levels[id] = 1;
  return levels;
}

describe('bedTrim', () => {
  it('returns the AUDIO.bedTrim value for each bed and era', () => {
    for (const bed of BEDS) {
      for (const era of ERAS) {
        expect(bedTrim(bed, era)).toBe(AUDIO.bedTrim[bed][era - 1]);
      }
    }
  });

  it('is in (0, 1] and never grows as eras arrive (older beds recede)', () => {
    for (const bed of BEDS) {
      let prev = Number.POSITIVE_INFINITY;
      for (const era of ERAS) {
        const trim = bedTrim(bed, era);
        // Rain is silent from era IV (trim 0: the virga is frozen in IV, gone in V); every other bed stays audible.
        if (bed === 'rain') expect(trim).toBeGreaterThanOrEqual(0);
        else expect(trim).toBeGreaterThan(0);
        expect(trim).toBeLessThanOrEqual(1);
        expect(trim).toBeLessThanOrEqual(prev);
        prev = trim;
      }
    }
  });

  it('clamps the era to 1..5 and treats bad input as era I', () => {
    expect(bedTrim('hum', 0)).toBe(bedTrim('hum', 1));
    expect(bedTrim('hum', 9)).toBe(bedTrim('hum', 5));
    expect(bedTrim('hum', Number.NaN)).toBe(bedTrim('hum', 1));
    expect(bedTrim('mains', 2.7)).toBe(bedTrim('mains', 2));
  });
});

describe('ambientPeakSum', () => {
  it('WP26 pins: eras I, II, IV, V keep their sums; era III with the rain bed and boiler re-trim is 0.446 (<= 0.45)', () => {
    expect(ambientPeakSum(1)).toBeCloseTo(0.33, 9);
    expect(ambientPeakSum(2)).toBeCloseTo(0.378, 9);
    expect(ambientPeakSum(3)).toBeCloseTo(0.446, 9);
    expect(ambientPeakSum(3)).toBeLessThanOrEqual(0.45);
    expect(ambientPeakSum(4)).toBeCloseTo(0.441, 9);
    expect(ambientPeakSum(5)).toBeCloseTo(0.435, 9);
  });

  it('era III counts the rain bed at its gain and the boiler at its re-trim; rain adds nothing from era IV', () => {
    const era3 =
      AUDIO.hum.maxGain * bedTrim('hum', 3) +
      AUDIO.gearTick.gain * bedTrim('gear', 3) +
      AUDIO.wind.gain +
      AUDIO.mains.maxGain * bedTrim('mains', 3) +
      AUDIO.boiler.maxGain * bedTrim('boiler', 3) +
      AUDIO.rain.gain;
    expect(ambientPeakSum(3)).toBeCloseTo(era3, 9);
    expect(bedTrim('rain', 4)).toBe(0);
  });

  it('era I is hum + gear + wind peaks (no trims applied yet)', () => {
    expect(ambientPeakSum(1)).toBeCloseTo(AUDIO.hum.maxGain + AUDIO.gearTick.gain + AUDIO.wind.gain, 9);
  });

  it('counts a bed only from its arrival era (boiler not before era III)', () => {
    expect(ambientPeakSum(2)).toBeCloseTo(
      AUDIO.hum.maxGain * bedTrim('hum', 2) +
        AUDIO.gearTick.gain * bedTrim('gear', 2) +
        AUDIO.mains.maxGain * bedTrim('mains', 2) +
        AUDIO.wind.gain,
      9,
    );
  });
});

describe('weather audio data (WP26)', () => {
  it('rain gain sits near -30 dB: 0.025-0.032 linear, -32..-28 dB', () => {
    expect(AUDIO.rain.gain).toBeGreaterThanOrEqual(0.025);
    expect(AUDIO.rain.gain).toBeLessThanOrEqual(0.032);
    const db = 20 * Math.log10(AUDIO.rain.gain);
    expect(db).toBeGreaterThanOrEqual(-32);
    expect(db).toBeLessThanOrEqual(-28);
  });

  it('rain band runs upward and the readout references are alphaRef 0.7 and speedRef 1', () => {
    expect(AUDIO.rain.hzMin).toBeLessThan(AUDIO.rain.hzMax);
    expect(AUDIO.rain.alphaRef).toBe(0.7);
    expect(AUDIO.rain.speedRef).toBe(1);
  });

  it('wind references: refWind > 0 and a 0.3 still-air floor', () => {
    expect(AUDIO.wind.refWind).toBeGreaterThan(0);
    expect(AUDIO.wind.floor).toBe(0.3);
  });

  it('weather push quantum is positive in both gain and Hz', () => {
    expect(AUDIO.weatherStep.gain).toBeGreaterThan(0);
    expect(AUDIO.weatherStep.hz).toBeGreaterThan(0);
  });

  it('rain trims are [1, 1, 1, 0, 0]; the boiler re-trims to 0.8 in era III', () => {
    expect(AUDIO.bedTrim.rain).toEqual([1, 1, 1, 0, 0]);
    expect(AUDIO.bedTrim.boiler[2]).toBe(0.8);
  });
});

describe('weatherMix (WP26 wind and rain beds)', () => {
  const live = (wind: number, virgaAlpha: number, virgaSpeed: number): WeatherInput => ({ live: true, wind, virgaAlpha, virgaSpeed });
  const NOT_LIVE: WeatherInput = { live: false, wind: 1, virgaAlpha: 0.7, virgaSpeed: 1 };

  it('no readout or live false: the v0.10.0 wind at full gain with the gust LFO, and no rain', () => {
    for (const input of [null, NOT_LIVE]) {
      expect(weatherMix(input, 1, false)).toEqual({ windGain: 0.05, windLfo: true, rainGain: 0, rainHz: AUDIO.rain.hzMin, live: false });
    }
  });

  it('live wind 0: the bed drops to the floor (0.05 x 0.3), not to silence, and the LFO stops', () => {
    const mix = weatherMix(live(0, 0, 0), 1, false);
    expect(mix.windGain).toBeCloseTo(AUDIO.wind.gain * AUDIO.wind.floor, 12);
    expect(mix.windLfo).toBe(false);
    expect(mix.live).toBe(true);
  });

  it('live wind at or above refWind (1, 1.5, 99): the full wind gain', () => {
    for (const wind of [1, 1.5, 99]) {
      expect(weatherMix(live(wind, 0, 0), 1, false).windGain).toBeCloseTo(AUDIO.wind.gain, 12);
    }
  });

  it('live wind gain is monotone non-decreasing over 0..1.5', () => {
    let prev = Number.NEGATIVE_INFINITY;
    for (let i = 0; i <= 30; i++) {
      const gain = weatherMix(live(i * 0.05, 0, 0), 1, false).windGain;
      expect(gain).toBeGreaterThanOrEqual(prev);
      prev = gain;
    }
  });

  it('NaN, -1 and infinite wind read as still air: the floor', () => {
    for (const wind of [Number.NaN, -1, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(weatherMix(live(wind, 0, 0), 1, false).windGain).toBeCloseTo(AUDIO.wind.gain * AUDIO.wind.floor, 12);
    }
  });

  it('rain needs both virga alpha and speed: zero alpha or zero speed gives no rain', () => {
    expect(weatherMix(live(1, 0, 1), 3, false).rainGain).toBe(0);
    expect(weatherMix(live(1, 0.7, 0), 3, false).rainGain).toBe(0);
  });

  it('full virga in era III plays the rain bed at its gain (about -30 dB)', () => {
    const FULL: ReadonlyArray<{ alpha: number; speed: number }> = [
      { alpha: 0.7, speed: 1 },
      { alpha: 1, speed: 1 },
      { alpha: 5, speed: 5 },
    ];
    for (const { alpha, speed } of FULL) {
      expect(weatherMix(live(1, alpha, speed), 3, false).rainGain).toBeCloseTo(AUDIO.rain.gain, 12);
    }
  });

  it('eras I and II (trim 1) play full rain at the gain when the readout shows virga', () => {
    for (const era of [1, 2]) {
      expect(weatherMix(live(1, 0.7, 1), era, false).rainGain).toBeCloseTo(AUDIO.rain.gain, 12);
    }
  });

  it('eras IV and V (trim 0): no rain even with full virga, the wind bed stays', () => {
    for (const era of [4, 5]) {
      const mix = weatherMix(live(1, 0.7, 1), era, false);
      expect(mix.rainGain).toBe(0);
      expect(mix.windGain).toBeCloseTo(AUDIO.wind.gain, 12);
    }
  });

  it('non-finite alpha or speed gives no rain', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(weatherMix(live(1, bad, 1), 3, false).rainGain).toBe(0);
      expect(weatherMix(live(1, 0.7, bad), 3, false).rainGain).toBe(0);
    }
  });

  it('rain pitch: hzMin at zero (or non-finite) speed or a trim of 0, hzMax at speedRef and above in era III, rising in between', () => {
    expect(weatherMix(live(1, 0.7, 0), 3, false).rainHz).toBeCloseTo(AUDIO.rain.hzMin, 9);
    expect(weatherMix(live(1, 0.7, Number.NaN), 3, false).rainHz).toBe(AUDIO.rain.hzMin);
    expect(weatherMix(live(1, 0.7, AUDIO.rain.speedRef), 3, false).rainHz).toBeCloseTo(AUDIO.rain.hzMax, 9);
    expect(weatherMix(live(1, 0.7, 2), 4, false).rainHz).toBe(AUDIO.rain.hzMin);
    let prev = Number.NEGATIVE_INFINITY;
    for (const speed of [0, 0.25, 0.5, 0.75, 1]) {
      const hz = weatherMix(live(1, 0.7, speed), 3, false).rainHz;
      expect(hz).toBeGreaterThanOrEqual(prev);
      prev = hz;
    }
  });

  it('era IV and V (trim 0): full virga and faster keep the rain at 0 and the pitch at hzMin, so the fade glides the hiss down', () => {
    for (const era of [4, 5]) {
      for (const speed of [1, 2]) {
        const mix = weatherMix(live(1, 0.7, speed), era, false);
        expect(mix.rainGain).toBe(0);
        expect(mix.rainHz).toBe(AUDIO.rain.hzMin);
      }
    }
  });

  it('era III: full virga keeps the pitch at hzMax, zero speed at hzMin, and the era IV step from the same readout lowers it', () => {
    expect(weatherMix(live(1, 0.7, 1), 3, false).rainHz).toBeCloseTo(AUDIO.rain.hzMax, 9);
    expect(weatherMix(live(1, 0.7, 0), 3, false).rainHz).toBe(AUDIO.rain.hzMin);
    expect(weatherMix(live(1, 0.7, 1), 4, false).rainHz).toBeLessThan(weatherMix(live(1, 0.7, 1), 3, false).rainHz);
  });

  it('muted: wind and rain gains are 0 and the LFO is off, whatever the readout; live is reported', () => {
    for (const input of [live(1, 0.7, 1), NOT_LIVE, null]) {
      const mix = weatherMix(input, 3, true);
      expect(mix.windGain).toBe(0);
      expect(mix.windLfo).toBe(false);
      expect(mix.rainGain).toBe(0);
      expect(mix.rainHz).toBe(AUDIO.rain.hzMin);
    }
    expect(weatherMix(live(1, 0.7, 1), 3, true).live).toBe(true);
    expect(weatherMix(null, 3, true).live).toBe(false);
  });

  it('every output is finite and within the bed gains for NaN, infinite, negative, zero and huge inputs', () => {
    const BAD = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -5, 0, 1e12];
    const inputs: Array<WeatherInput | null> = [null];
    for (const wind of BAD) {
      for (const alpha of BAD) {
        for (const speed of BAD) inputs.push(live(wind, alpha, speed));
      }
    }
    for (const input of inputs) {
      for (const era of [0, 1, 3, 5, Number.NaN]) {
        for (const muted of [false, true]) {
          const mix = weatherMix(input, era, muted);
          expect([mix.windGain, mix.rainGain, mix.rainHz].every(Number.isFinite)).toBe(true);
          expect(mix.windGain).toBeLessThanOrEqual(AUDIO.wind.gain);
          expect(mix.rainGain).toBeLessThanOrEqual(AUDIO.rain.gain);
          expect(typeof mix.windLfo).toBe('boolean');
        }
      }
    }
  });
});

describe('mix invariants (WP15 C2)', () => {
  const ONE_SHOT_GAINS: number[] = [
    AUDIO.crank.gain,
    AUDIO.purchase.gain,
    AUDIO.clunk.gain,
    AUDIO.deny.gain,
    AUDIO.sting.gain,
    AUDIO.relay.gain,
    AUDIO.hiss.gain,
    AUDIO.whistle.gain,
    AUDIO.forkPing.gain,
    AUDIO.chord.gain,
    AUDIO.swell.gain,
    AUDIO.resolveChord.gain,
    AUDIO.chirp.gain,
    AUDIO.stamp.thumpGain,
    AUDIO.beadTick.gain,
    AUDIO.arc.gain,
    AUDIO.faultSpawn.gain,
    AUDIO.faultClear.ratchet.gain,
    AUDIO.faultClear.bright.gain,
    AUDIO.faultClear.overdrive.gain,
    // WP28 cues: every part gain of the Find, Splice wake and poke cues (CUE_PARTS; gain is the fifth field).
    ...CUE_PARTS.map((part) => part[4]),
  ];

  it('bed sum x trim <= 0.45 in every era', () => {
    for (const era of ERAS) {
      expect(ambientPeakSum(era), `era ${era}`).toBeLessThanOrEqual(0.45);
    }
  });

  it('ambient + music + loudest one-shot <= 1.0 at the limiter input (after master gain)', () => {
    const music = Math.max(...Object.values(MUSIC.themes).map((t) => musicContribution(t)));
    const loudest = Math.max(...ONE_SHOT_GAINS);
    for (const era of ERAS) {
      const sum = ambientPeakSum(era) + music + loudest;
      expect(AUDIO.masterGain * sum, `era ${era}`).toBeLessThanOrEqual(1);
    }
  });
});

describe('purchaseCue (WP15R D1: cue by the era of the paying resource)', () => {
  // Techs whose paying resource is from another era than the tech itself (era techs included).
  const CROSS_ERA_TECHS: readonly TechId[] = [
    'generator', 'motorRetrofit', 'boiler', 'inductionHeater', 'bellowsDrive', 'resonatorSpire', 'pressureResonator',
    'crankServo', 'gridExciter', 'nullChamber', 'resonantSiphon', 'graviticAnchor', 'mainsBackfeed', 'steamLance',
  ];

  it('maps the paying resource era to its cue: me purchase, ee relay, pr hiss, rs forkPing, xf swell', () => {
    expect(purchaseCue('me')).toBe('purchase');
    expect(purchaseCue('ee')).toBe('relay');
    expect(purchaseCue('pr')).toBe('hiss');
    expect(purchaseCue('rs')).toBe('forkPing');
    expect(purchaseCue('xf')).toBe('swell');
  });

  it('gives each resource its own cue and the table has five distinct entries', () => {
    const cues = RESOURCE_IDS.map((id) => purchaseCue(id));
    expect(new Set(cues).size).toBe(RESOURCE_IDS.length);
    expect(new Set(AUDIO.purchaseCueByEra).size).toBe(5);
  });

  it('legacy techs follow the paying resource: bellowsDrive purchase, gridExciter relay, mainsBackfeed relay, steamLance hiss', () => {
    expect(purchaseCue(TECHNOLOGIES.bellowsDrive.costRes)).toBe('purchase');
    expect(purchaseCue(TECHNOLOGIES.gridExciter.costRes)).toBe('relay');
    expect(purchaseCue(TECHNOLOGIES.mainsBackfeed.costRes)).toBe('relay');
    expect(purchaseCue(TECHNOLOGIES.steamLance.costRes)).toBe('hiss');
  });

  it('every tech in TECH_LIST gets the cue of its paying resource era', () => {
    for (const tech of TECH_LIST) {
      expect(purchaseCue(tech.costRes), tech.id).toBe(AUDIO.purchaseCueByEra[RESOURCES[tech.costRes].era - 1]);
    }
  });

  it('exactly the 14 cross-era techs differ from their own era cue', () => {
    // Splices (WP28) play their own wake cue by era on purchase (gameAudio), not this rule, so they are left out here.
    const differ = TECH_LIST
      .filter((tech) => !isSplice(tech))
      .filter((tech) => purchaseCue(tech.costRes) !== AUDIO.purchaseCueByEra[tech.era - 1])
      .map((tech) => tech.id)
      .sort();
    expect(differ).toEqual([...CROSS_ERA_TECHS].sort());
  });

  it('an unknown resource falls back to the plain purchase thunk', () => {
    expect(purchaseCue('zz' as unknown as ResourceId)).toBe('purchase');
  });
});

describe('fault cues (WP27): bounds of AUDIO.faultSpawn and AUDIO.faultClear', () => {
  it('the spawn cue ends inside 400 ms and its gain is at most 0.25', () => {
    const noises = [AUDIO.faultSpawn.crackle, AUDIO.faultSpawn.hiss, AUDIO.faultSpawn.static];
    const total = Math.max(AUDIO.faultSpawn.ms, ...noises.map((n) => (n.count - 1) * n.gapMs + n.pulseMs));
    expect(total).toBeLessThanOrEqual(400);
    expect(AUDIO.faultSpawn.gain).toBeGreaterThan(0);
    expect(AUDIO.faultSpawn.gain).toBeLessThanOrEqual(0.25);
  });

  it('every spawn flavour peaks at 0.25 or less: noise at gain, ping at gain x (1 + partialGain) for its two sines', () => {
    const { faultSpawn: f } = AUDIO;
    const flavours: FaultFlavour[] = ['crackle', 'hiss', 'ping', 'static'];
    for (const flavour of flavours) {
      const peak = flavour === 'ping' ? f.gain * (1 + f.ping.partialGain) : f.gain;
      expect(peak, flavour).toBeGreaterThan(0);
      expect(peak, flavour).toBeLessThanOrEqual(0.25);
    }
  });

  it('the clear cue, Overdrive tick included, ends inside 300 ms and its gains are at most 0.35', () => {
    const r = AUDIO.faultClear.ratchet;
    const { bright, overdrive } = AUDIO.faultClear;
    const total = Math.max((r.count - 1) * r.gapMs + r.pulseMs, bright.atMs + bright.ms, overdrive.atMs + overdrive.ms);
    expect(total).toBeLessThanOrEqual(300);
    for (const g of [r.gain, bright.gain, overdrive.gain]) expect(g).toBeLessThanOrEqual(0.35);
  });

  it('the era flavours are crackle (I-II), hiss (III), ping (IV) and static (V)', () => {
    expect([...AUDIO.faultSpawn.flavourByEra]).toEqual(['crackle', 'crackle', 'hiss', 'ping', 'static']);
  });
});

/** Cue end (ms from the cue start) and loudest gain of a list of parts. */
function cueEndMs(parts: CueParts): number {
  return Math.max(...parts.map((p) => p[2] + p[3]));
}
function cueMaxGain(parts: CueParts): number {
  return Math.max(...parts.map((p) => p[4]));
}

describe('find, splice and poke cue bounds (WP28)', () => {
  it('the Find chime ends inside 300 ms at gain 0.2 or less; the clink inside 200 ms at 0.3; the relic rustle inside 300 ms at 0.25', () => {
    expect(cueEndMs(AUDIO.findSpawn)).toBeLessThanOrEqual(300);
    expect(cueMaxGain(AUDIO.findSpawn)).toBeLessThanOrEqual(0.2);
    expect(cueEndMs(AUDIO.findCollect)).toBeLessThanOrEqual(200);
    expect(cueMaxGain(AUDIO.findCollect)).toBeLessThanOrEqual(0.3);
    expect(cueEndMs(AUDIO.relicCollect)).toBeLessThanOrEqual(300);
    expect(cueMaxGain(AUDIO.relicCollect)).toBeLessThanOrEqual(0.25);
    for (const parts of [AUDIO.findSpawn, AUDIO.findCollect, AUDIO.relicCollect]) expect(cueMaxGain(parts)).toBeGreaterThan(0);
  });

  it('each Splice wake, by era (I-V), ends inside 600 ms at gain 0.3 or less', () => {
    expect(AUDIO.spliceWake).toHaveLength(5);
    for (const [i, wake] of AUDIO.spliceWake.entries()) {
      expect(cueEndMs(wake), `era ${i + 1} end`).toBeLessThanOrEqual(600);
      expect(cueMaxGain(wake), `era ${i + 1} gain`).toBeLessThanOrEqual(0.3);
      expect(cueMaxGain(wake), `era ${i + 1} gain`).toBeGreaterThan(0);
    }
  });

  it('every poke id has two variants, each one part at atMs 0 ending inside 400 ms at gain 0.3 or less, with a positive pitch', () => {
    expect(Object.keys(AUDIO.poke.variants)).toHaveLength(12);
    for (const [id, pair] of Object.entries(AUDIO.poke.variants)) {
      expect(pair, id).toHaveLength(2);
      const variants: readonly CuePart[] = pair;
      for (const [source, hz, atMs, ms, gain, fromHz] of variants) {
        expect(atMs, id).toBe(0);
        expect(ms, id).toBeGreaterThan(0);
        expect(ms, id).toBeLessThanOrEqual(400);
        expect(gain, id).toBeGreaterThan(0);
        expect(gain, id).toBeLessThanOrEqual(0.3);
        expect(hz, id).toBeGreaterThan(0);
        if (fromHz !== undefined) expect(fromHz, id).toBeGreaterThan(0);
        expect(['sine', 'square', 'triangle', 'sawtooth', 'bandpass', 'highpass'], id).toContain(source);
      }
    }
  });

  it('the pitch spread is 5 %, the variant rule avoids two recent picks, and the noise Q is positive', () => {
    expect(AUDIO.poke.pitchSpread).toBe(0.05);
    expect(AUDIO.poke.avoidRecent).toBe(2);
    expect(AUDIO.cueQ).toBeGreaterThan(0);
  });
});

describe('poke helpers (WP28): variant pick and pitch', () => {
  it('a pick is always an index in 0..count-1, and count 0 gives 0', () => {
    for (let i = 0; i <= 20; i++) {
      const unit = i / 20;
      expect(pokeVariant([], 2, unit)).toBeGreaterThanOrEqual(0);
      expect(pokeVariant([], 2, unit)).toBeLessThanOrEqual(1);
    }
    expect(pokeVariant([], 0, 0.5)).toBe(0);
    expect(pokeVariant([1], 2, Number.NaN)).toBe(0);
  });

  it('avoids the last two picks while another variant is free', () => {
    expect(pokeVariant([0, 0], 2, 0)).toBe(1);
    expect(pokeVariant([1, 1], 2, 0.9)).toBe(0);
    expect(pokeVariant([0, 1], 2, 0.3)).toBe(0); // both recent: any pick, the unit chooses
  });

  it('never returns the same variant three times in a row over 1000 seeded picks', () => {
    let seed = 7;
    let recent: number[] = [];
    for (let i = 0; i < 1000; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const pick = pokeVariant(recent, 2, seed / 4294967296);
      if (recent.length === 2) expect(recent[0] === recent[1] && recent[1] === pick, `pick ${i}`).toBe(false);
      recent = [...recent, pick].slice(-2);
    }
  });

  it('does not change its input list', () => {
    const recent = [0, 1];
    pokeVariant(recent, 2, 0.5);
    expect(recent).toEqual([0, 1]);
  });

  it('the pitch scale is 1 +- 5 % across the unit range, 1 at the middle, and 1 for a non-finite unit', () => {
    expect(pokePitchScale(0)).toBeCloseTo(0.95, 12);
    expect(pokePitchScale(0.5)).toBeCloseTo(1, 12);
    expect(pokePitchScale(1)).toBeCloseTo(1.05, 12);
    expect(pokePitchScale(Number.NaN)).toBe(1);
    expect(pokePitchScale(-3)).toBeCloseTo(0.95, 12);
    expect(pokePitchScale(3)).toBeCloseTo(1.05, 12);
  });
});

describe('ambient bed refit (WP15R D2: maxPerSecond >= 3x post-finale rate)', () => {
  // pf: post-finale rate of the driving resource; unlock: rate at the first unlock; old: the curve the refit replaces (min, max, maxPerSecond).
  // hum and gear: old is the curve before the WP27 P9 refit (40000, the WP15R value), not the pre-WP15R 5000 (the 0.85 guard is per refit).
  const REFIT = [
    { bed: 'hum', cfg: AUDIO.hum, pf: 2.8e5, unlock: 1, old: { min: 0.04, max: 0.16, maxPerSecond: 40000 }, now: () => humGain(1) },
    { bed: 'gear', cfg: AUDIO.hum, pf: 2.8e5, unlock: 1, old: { min: 1.5, max: 14, maxPerSecond: 40000 }, now: () => gearTickRate(1) },
    { bed: 'mains', cfg: AUDIO.mains, pf: 9.6e5, unlock: 4.17, old: { min: 0.02, max: 0.09, maxPerSecond: 5000 }, now: () => mainsGain(4.17) },
    { bed: 'arc', cfg: AUDIO.arc, pf: 9.6e5, unlock: 4.17, old: { min: 0.5, max: 3, maxPerSecond: 5000 }, now: () => arcRate(4.17, true) },
    { bed: 'boiler', cfg: AUDIO.boiler, pf: 1.1e6, unlock: 9.85, old: { min: 0.03, max: 0.14, maxPerSecond: 100000 }, now: () => boilerGain(9.85, true) },
    { bed: 'pad', cfg: AUDIO.pad, pf: 3.8e5, unlock: 8.14, old: { min: 0.02, max: 0.08, maxPerSecond: 100000 }, now: () => padGain(8.14, true) },
    { bed: 'drone', cfg: AUDIO.drone, pf: 2.5e5, unlock: 4.65, old: { min: 0.02, max: 0.09, maxPerSecond: 100000000 }, now: () => droneGain(4.65, true) },
  ];

  it.each(REFIT)('$bed: maxPerSecond is at least 3x the post-finale rate', (row) => {
    expect(row.cfg.maxPerSecond).toBeGreaterThanOrEqual(3 * row.pf);
  });

  it.each(REFIT)('$bed: the post-finale rate stays at or below 0.95 of the curve', (row) => {
    expect(activityLevel(row.pf, row.cfg.refPerSecond, row.cfg.maxPerSecond)).toBeLessThanOrEqual(0.95);
  });

  it.each(REFIT)('$bed: the unlock value keeps at least 0.85 of its pre-refit value', (row) => {
    const before = row.old.min + (row.old.max - row.old.min) * activityLevel(row.unlock, 1, row.old.maxPerSecond);
    expect(row.now()).toBeGreaterThanOrEqual(0.85 * before);
  });

  it('writes the refit leaves and the new tech gates', () => {
    expect(AUDIO.hum.maxPerSecond).toBe(1000000);
    expect(AUDIO.mains.minGain).toBe(0.025);
    expect(AUDIO.mains.maxPerSecond).toBe(3000000);
    expect(AUDIO.arc.minRate).toBe(0.7);
    expect(AUDIO.arc.maxPerSecond).toBe(3000000);
    expect(AUDIO.arc.techId).toBe('sparkGap');
    expect(AUDIO.boiler.maxPerSecond).toBe(3500000);
    expect(AUDIO.boiler.techId).toBe('boiler');
    expect(AUDIO.pad.maxPerSecond).toBe(1200000);
    expect(AUDIO.drone.maxPerSecond).toBe(800000);
  });
});

describe('ambientMix', () => {
  const RATES = { me: 100, ee: 100, pr: 100, rs: 100, xf: 100 };
  const SERVO_LEVEL = 5;

  /** Levels for era e: every keystone up to e, plus wornMotor, sparkGap and the crank servo at SERVO_LEVEL. */
  function eraLevels(era: EraNumber): Record<TechId, number> {
    const eraTechs = ERA_KEYSTONES.filter((k) => k.era <= era).map((k) => k.techId);
    return { ...levelsOwning(...eraTechs, 'wornMotor', 'sparkGap'), crankServo: SERVO_LEVEL };
  }

  function mixOf(owned: TechId[], muted = false) {
    return ambientMix({ perSecond: RATES, techLevels: levelsOwning(...owned), muted });
  }

  it('reads the era from the highest owned keystone; a non-finite keystone level is not owned', () => {
    expect(mixOf([]).era).toBe(1);
    expect(mixOf(['boiler']).era).toBe(3);
    const nullInfinite = levelsOwning();
    nullInfinite.nullChamber = Infinity;
    expect(ambientMix({ perSecond: RATES, techLevels: nullInfinite, muted: false }).era).toBe(1);
  });

  it.each(ERAS)('era %s: each gain is the base curve times its bed trim, ownership read from the levels', (e) => {
    const levels = eraLevels(e);
    const owned = (id: TechId): boolean => levels[id] >= 1;
    const mix = ambientMix({ perSecond: RATES, techLevels: levels, muted: false });
    const servoMax = TECHNOLOGIES.crankServo.maxLevel ?? 1;
    expect(mix.era).toBe(e);
    expect(mix.humHz).toBeCloseTo(humFrequency(100), 12);
    expect(mix.humGain).toBeCloseTo(humGain(100) * bedTrim('hum', e), 12);
    expect(mix.gearRate).toBeCloseTo(gearTickRate(100), 12);
    expect(mix.gearGain).toBeCloseTo(bedTrim('gear', e), 12);
    expect(mix.mainsGain).toBeCloseTo(mainsGain(100) * bedTrim('mains', e), 12);
    expect(mix.arcRate).toBeCloseTo(arcRate(100, owned('sparkGap')), 12);
    expect(mix.boilerGain).toBeCloseTo(boilerGain(100, owned('boiler')) * bedTrim('boiler', e), 12);
    expect(mix.padGain).toBeCloseTo(padGain(100, owned('resonatorSpire')) * bedTrim('pad', e), 12);
    expect(mix.droneGain).toBeCloseTo(droneGain(100, owned('nullChamber')) * bedTrim('drone', e), 12);
    expect(mix.servoGain).toBeCloseTo(servoGain(SERVO_LEVEL, servoMax) * bedTrim('servo', e), 12);
    expect(mix.servoHz).toBeCloseTo(servoHz(SERVO_LEVEL, servoMax), 12);
  });

  it('arc rate needs the spark gap', () => {
    expect(mixOf(['generator']).arcRate).toBe(0);
    expect(mixOf(['sparkGap']).arcRate).toBeGreaterThan(0);
  });

  it('boiler gain needs the boiler', () => {
    expect(mixOf(['generator']).boilerGain).toBe(0);
    expect(mixOf(['boiler']).boilerGain).toBeGreaterThan(0);
  });

  it('pad gain needs the resonance spire', () => {
    expect(mixOf(['boiler']).padGain).toBe(0);
    expect(mixOf(['resonatorSpire']).padGain).toBeGreaterThan(0);
  });

  it('drone gain needs the null chamber', () => {
    expect(mixOf(['resonatorSpire']).droneGain).toBe(0);
    expect(mixOf(['nullChamber']).droneGain).toBeGreaterThan(0);
  });

  it('muted: every gain and rate is 0, gearGain 1, servo pitch at minHz, hum pitch and era kept', () => {
    const mix = ambientMix({ perSecond: RATES, techLevels: eraLevels(5), muted: true });
    expect(mix.humGain).toBe(0);
    expect(mix.gearRate).toBe(0);
    expect(mix.mainsGain).toBe(0);
    expect(mix.arcRate).toBe(0);
    expect(mix.boilerGain).toBe(0);
    expect(mix.padGain).toBe(0);
    expect(mix.droneGain).toBe(0);
    expect(mix.servoGain).toBe(0);
    expect(mix.windGain).toBe(0);
    expect(mix.rainGain).toBe(0);
    expect(mix.gearGain).toBe(1);
    expect(mix.servoHz).toBe(AUDIO.servo.minHz);
    expect(mix.humHz).toBeCloseTo(humFrequency(100), 12);
    expect(mix.era).toBe(5);
  });

  /** The five wind and rain fields of an ambient mix, in the shape weatherMix returns. */
  function weatherFields(mix: AmbientMix): WeatherMix {
    return { windGain: mix.windGain, windLfo: mix.windLfo, rainGain: mix.rainGain, rainHz: mix.rainHz, live: mix.live };
  }

  it('wind and rain fields: with no readout they equal the not-live mix', () => {
    const mix = ambientMix({ perSecond: RATES, techLevels: eraLevels(3), muted: false });
    expect(weatherFields(mix)).toEqual(weatherMix(null, 3, false));
  });

  it.each(ERAS)('era %s: a live readout gives the wind and rain fields weatherMix returns for that era', (e) => {
    const readout: WeatherInput = { live: true, wind: 0.6, virgaAlpha: 0.5, virgaSpeed: 1 };
    const mix = ambientMix({ perSecond: RATES, techLevels: eraLevels(e), muted: false, weather: readout });
    expect(weatherFields(mix)).toEqual(weatherMix(readout, e, false));
  });

  it('muted with a live readout: wind and rain gains are 0, live is still reported', () => {
    const readout: WeatherInput = { live: true, wind: 1.2, virgaAlpha: 0.7, virgaSpeed: 2 };
    const mix = ambientMix({ perSecond: RATES, techLevels: eraLevels(3), muted: true, weather: readout });
    expect(mix.windGain).toBe(0);
    expect(mix.rainGain).toBe(0);
    expect(mix.live).toBe(true);
    expect(weatherFields(mix)).toEqual(weatherMix(readout, 3, true));
  });

  it('NaN, negative and Infinity rates: every output is finite; NaN and negative rates give zero gains', () => {
    for (const bad of [NaN, -5, Infinity]) {
      const rates = { me: bad, ee: bad, pr: bad, rs: bad, xf: bad };
      const mix = ambientMix({ perSecond: rates, techLevels: eraLevels(5), muted: false });
      const values: number[] = Object.values(mix).filter((v): v is number => typeof v === 'number');
      for (const value of values) {
        expect(Number.isFinite(value), `${bad}`).toBe(true);
      }
      if (bad !== Infinity) {
        expect(mix.humGain, `${bad}`).toBe(0);
        expect(mix.gearRate, `${bad}`).toBe(0);
        expect(mix.mainsGain, `${bad}`).toBe(0);
        expect(mix.arcRate, `${bad}`).toBe(0);
        expect(mix.boilerGain, `${bad}`).toBe(0);
        expect(mix.padGain, `${bad}`).toBe(0);
        expect(mix.droneGain, `${bad}`).toBe(0);
      }
    }
  });
});

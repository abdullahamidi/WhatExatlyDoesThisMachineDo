import { describe, it, expect } from 'vitest';
import { AUDIO } from '../data/audio';
import type { EndingPhase } from '../data/types';
import type { LevelSnapshot } from './audioMath';
import {
  activityLevel,
  arcRate,
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
  servoFraction,
  servoGain,
  servoHz,
  stampPartials,
  windAllowed,
} from './audioMath';

const SAMPLE_INPUTS = [0, -5, NaN, Infinity, 1e12, 0.001, 1];

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
  const BASE: LevelSnapshot = { master: 0.5, wind: true, sfxBus: 1, ambientBus: 0.5 };

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

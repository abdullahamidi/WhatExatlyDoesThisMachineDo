import { describe, it, expect } from 'vitest';
import { AUDIO } from '../data/audio';
import {
  activityLevel,
  arcRate,
  boilerGain,
  gearTickRate,
  humFrequency,
  humGain,
  mainsGain,
  masterTarget,
  padGain,
  servoFraction,
  servoGain,
  servoHz,
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
});

describe('AUDIO data', () => {
  it('has three sting notes', () => {
    expect(AUDIO.sting.notesHz).toHaveLength(3);
  });

  it('has every numeric leaf finite and >= 0', () => {
    const leaves: Array<{ path: string; value: number }> = [];
    numericLeaves(AUDIO, '', leaves);
    expect(leaves.length).toBeGreaterThan(0);
    for (const leaf of leaves) {
      expect(Number.isFinite(leaf.value), leaf.path).toBe(true);
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

import { describe, it, expect } from 'vitest';
import { AUDIO } from '../data/audio';
import { activityLevel, gearTickRate, humFrequency, humGain, masterTarget } from './audioMath';

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

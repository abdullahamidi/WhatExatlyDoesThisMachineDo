import { describe, it, expect } from 'vitest';
import { NUMBER_SUFFIXES, formatCost, formatNumber, formatRate, formatDuration } from './format';

describe('NUMBER_SUFFIXES', () => {
  it('has eleven strictly ascending entries', () => {
    expect(NUMBER_SUFFIXES).toHaveLength(11);
    for (let i = 1; i < NUMBER_SUFFIXES.length; i++) {
      expect(NUMBER_SUFFIXES[i]!.value).toBeGreaterThan(NUMBER_SUFFIXES[i - 1]!.value);
    }
  });

  it('names every suffix up to Dc', () => {
    expect(NUMBER_SUFFIXES.map((entry) => entry.suffix)).toEqual([
      'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc',
    ]);
  });
});

describe('formatNumber (floor, default)', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [12.79, '12.7'],
    [0.5, '0.5'],
    [0.05, '0'],
    [999.99, '999.9'],
    [1000, '1K'],
    [1500, '1.5K'],
    [1001, '1K'],
    [12345, '12.3K'],
    [123456, '123K'],
    [999999, '999K'],
    [1e6, '1M'],
    [2.5e6, '2.5M'],
    [1e9, '1B'],
    [1e12, '1T'],
    [1e15, '1Qa'],
    [2.5e16, '25Qa'],
    [1e18, '1Qi'],
    [1e21, '1Sx'],
    [1e24, '1Sp'],
    [1e27, '1Oc'],
    [1e30, '1No'],
    [1e33, '1Dc'],
    [1.5e33, '1.5Dc'],
    [1e36, '1.00e36'],
    [1.234e36, '1.23e36'],
    [1e100, '1.00e100'],
  ])('formats %s as %s', (n, expected) => {
    expect(formatNumber(n)).toBe(expected);
    expect(formatNumber(n, 'floor')).toBe(expected);
    expect(formatNumber(n, 'floor', 'suffix')).toBe(expected);
  });
});

describe('formatNumber (ceil)', () => {
  it.each([
    [1001, '1.01K'],
    [12.79, '12.8'],
    [999999, '1M'],
    [0.01, '0.1'],
    [999999999999999, '1Qa'],
  ])('formats %s as %s', (n, expected) => {
    expect(formatNumber(n, 'ceil')).toBe(expected);
  });
});

describe('formatNumber (round)', () => {
  it.each([
    [12.79, '12.8'],
    [999999, '1M'],
    [999.95, '1K'],
    [999999999999999, '1Qa'],
    [9.999e35, '1.00e36'],
  ])('formats %s as %s', (n, expected) => {
    expect(formatNumber(n, 'round')).toBe(expected);
  });
});

describe('formatNumber negatives', () => {
  it('re-attaches the sign except for zero', () => {
    expect(formatNumber(-12.79)).toBe('-12.7');
    expect(formatNumber(-1500)).toBe('-1.5K');
    expect(formatNumber(-0.01)).toBe('0');
  });

  it('re-attaches the sign for large and notation outputs', () => {
    expect(formatNumber(-2.5e16)).toBe('-25Qa');
    expect(formatNumber(-1e36)).toBe('-1.00e36');
    expect(formatNumber(-1500, 'floor', 'scientific')).toBe('-1.50e3');
    expect(formatNumber(-1500, 'floor', 'engineering')).toBe('-1.5e3');
  });
});

describe('formatNumber invalid input', () => {
  it.each([NaN, Infinity, -Infinity])('formats %s as "0"', (n) => {
    expect(formatNumber(n)).toBe('0');
    expect(formatNumber(n, 'floor', 'scientific')).toBe('0');
    expect(formatNumber(n, 'floor', 'engineering')).toBe('0');
  });
});

describe('formatNumber notations', () => {
  it.each([
    [1500, '1.50e3'],
    [1e6, '1.00e6'],
    [123456, '1.23e5'],
    [999999, '9.99e5'],
    [1e36, '1.00e36'],
  ])('scientific formats %s as %s', (n, expected) => {
    expect(formatNumber(n, 'floor', 'scientific')).toBe(expected);
  });

  it.each([
    [1500, '1.5e3'],
    [123456, '123e3'],
    [1e6, '1e6'],
    [2.5e16, '25e15'],
    [999999, '999e3'],
  ])('engineering formats %s as %s', (n, expected) => {
    expect(formatNumber(n, 'floor', 'engineering')).toBe(expected);
  });

  it('floors exponent-form suffix output at the mantissa', () => {
    expect(formatNumber(9.996e36, 'floor')).toBe('9.99e36');
    expect(formatNumber(1e36, 'floor')).toBe('1.00e36');
  });

  it('rounds the mantissa up and bumps the exponent (carry)', () => {
    expect(formatNumber(999999, 'ceil', 'scientific')).toBe('1.00e6');
    expect(formatNumber(999999, 'round', 'scientific')).toBe('1.00e6');
    expect(formatNumber(999999, 'ceil', 'engineering')).toBe('1e6');
    expect(formatNumber(999999, 'round', 'engineering')).toBe('1e6');
  });

  it('carries a value below 1000 that rounds up to 1000 into the notation', () => {
    expect(formatNumber(999.95, 'round')).toBe('1K');
    expect(formatNumber(999.95, 'round', 'scientific')).toBe('1.00e3');
    expect(formatNumber(999.95, 'round', 'engineering')).toBe('1e3');
  });

  it('keeps suffix output below 1000 identical across notations', () => {
    for (const n of [0, 0.5, 12.7, 999.9]) {
      expect(formatNumber(n, 'floor', 'suffix')).toBe(formatNumber(n));
      expect(formatNumber(n, 'floor', 'scientific')).toBe(formatNumber(n));
      expect(formatNumber(n, 'floor', 'engineering')).toBe(formatNumber(n));
    }
  });

  it('defaults the notation to suffix', () => {
    expect(formatNumber(1500)).toBe(formatNumber(1500, 'floor', 'suffix'));
    expect(formatNumber(1e15)).toBe('1Qa');
  });
});

describe('formatCost', () => {
  it('rounds prices up', () => {
    expect(formatCost(1015)).toBe('1.02K');
    expect(formatCost(10)).toBe('10');
  });

  it('rounds exponent-form prices up (never below the charged price)', () => {
    expect(formatCost(1.2345e40)).toBe('1.24e40');
    expect(formatCost(1e36)).toBe('1.00e36');
  });

  it('passes the notation through', () => {
    expect(formatCost(1500, 'engineering')).toBe('1.5e3');
    expect(formatCost(1500, 'scientific')).toBe('1.50e3');
    expect(formatCost(1500)).toBe('1.5K');
  });
});

describe('formatRate', () => {
  it('appends /s', () => {
    expect(formatRate(12.5)).toBe('12.5/s');
    expect(formatRate(0)).toBe('0/s');
    expect(formatRate(1500)).toBe('1.5K/s');
  });

  it('passes the notation through', () => {
    expect(formatRate(1500, 'scientific')).toBe('1.50e3/s');
    expect(formatRate(1500, 'engineering')).toBe('1.5e3/s');
  });
});

describe('formatDuration', () => {
  it.each([
    [0, '0s'],
    [45, '45s'],
    [59.9, '59s'],
    [60, '1m'],
    [90, '1m 30s'],
    [3599, '59m 59s'],
    [3600, '1h'],
    [3661, '1h 1m'],
    [8040, '2h 14m'],
    [28800, '8h'],
    [-5, '0s'],
    [NaN, '0s'],
  ])('formats %s seconds as %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });
});

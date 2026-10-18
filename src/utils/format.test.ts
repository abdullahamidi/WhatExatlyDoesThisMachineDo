import { describe, it, expect } from 'vitest';
import { NUMBER_SUFFIXES, formatCost, formatNumber, formatRate, formatDuration } from './format';

describe('NUMBER_SUFFIXES', () => {
  it('has four strictly ascending entries', () => {
    expect(NUMBER_SUFFIXES).toHaveLength(4);
    for (let i = 1; i < NUMBER_SUFFIXES.length; i++) {
      expect(NUMBER_SUFFIXES[i]!.value).toBeGreaterThan(NUMBER_SUFFIXES[i - 1]!.value);
    }
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
    [1e15, '1.00e15'],
    [2.5e16, '2.50e16'],
  ])('formats %s as %s', (n, expected) => {
    expect(formatNumber(n)).toBe(expected);
    expect(formatNumber(n, 'floor')).toBe(expected);
  });
});

describe('formatNumber (ceil)', () => {
  it.each([
    [1001, '1.01K'],
    [12.79, '12.8'],
    [999999, '1M'],
    [0.01, '0.1'],
  ])('formats %s as %s', (n, expected) => {
    expect(formatNumber(n, 'ceil')).toBe(expected);
  });
});

describe('formatNumber (round)', () => {
  it.each([
    [12.79, '12.8'],
    [999999, '1M'],
    [999.95, '1K'],
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
});

describe('formatNumber invalid input', () => {
  it.each([NaN, Infinity, -Infinity])('formats %s as "0"', (n) => {
    expect(formatNumber(n)).toBe('0');
  });
});

describe('formatCost', () => {
  it('rounds prices up', () => {
    expect(formatCost(1015)).toBe('1.02K');
    expect(formatCost(10)).toBe('10');
  });
});

describe('formatRate', () => {
  it('appends /s', () => {
    expect(formatRate(12.5)).toBe('12.5/s');
    expect(formatRate(0)).toBe('0/s');
    expect(formatRate(1500)).toBe('1.5K/s');
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

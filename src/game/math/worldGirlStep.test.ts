import { describe, it, expect } from 'vitest';
import { clampGirlStep } from './worldGirlStep';
import type { WorldPlacement } from '../../data/livingWorld';

// WP23b B-A3: one committed change moves the girl at most 12 world px down the front band (WORLD_GIRL.stepMaxWorldPx).
const MAX = 12;
const GIRL: WorldPlacement = { x: 976, row: 'front', inner: true };

describe('clampGirlStep', () => {
  it('returns next when prev is null (girl enters the stage)', () => {
    const next: WorldPlacement = { x: 976, row: 'front', dy: 16 };
    expect(clampGirlStep(null, next, MAX)).toBe(next);
  });

  it('returns null when next is null (girl leaves the stage)', () => {
    expect(clampGirlStep({ x: 976, row: 'front', dy: 8 }, null, MAX)).toBeNull();
    expect(clampGirlStep(null, null, MAX)).toBeNull();
  });

  it('treats a first placement without dy as dy 0', () => {
    const prev: WorldPlacement = { x: 976, row: 'front' };
    const next: WorldPlacement = { x: 976, row: 'front', dy: 16 };
    expect(clampGirlStep(prev, next, MAX)).toEqual({ x: 976, row: 'front', dy: MAX });
  });

  it('caps a 16 px rise at 12 and keeps x, row and inner', () => {
    const prev: WorldPlacement = { ...GIRL, dy: 8 };
    const next: WorldPlacement = { ...GIRL, dy: 24 };
    const out = clampGirlStep(prev, next, MAX);
    expect(out).toEqual({ x: 976, row: 'front', inner: true, dy: 8 + MAX });
    expect(out).not.toBe(next);
  });

  it('keeps the same reference for a rise of exactly maxPx', () => {
    const next: WorldPlacement = { ...GIRL, dy: 12 };
    expect(clampGirlStep({ ...GIRL, dy: 0 }, next, MAX)).toBe(next);
  });

  it('keeps the same reference for a rise under maxPx', () => {
    const next: WorldPlacement = { ...GIRL, dy: 8 };
    expect(clampGirlStep({ ...GIRL, dy: 0 }, next, MAX)).toBe(next);
  });

  it('passes a decrease through unchanged (40 down to 0)', () => {
    const next: WorldPlacement = { ...GIRL, dy: 0 };
    expect(clampGirlStep({ ...GIRL, dy: 40 }, next, MAX)).toBe(next);
  });

  it('passes a change of x through unchanged (another stage)', () => {
    const next: WorldPlacement = { x: 1000, row: 'front', dy: 16 };
    expect(clampGirlStep({ x: 976, row: 'front', dy: 0 }, next, MAX)).toBe(next);
  });

  it('passes a change of row through unchanged (another framing band)', () => {
    const next: WorldPlacement = { x: 976, row: 'back', dy: 16 };
    expect(clampGirlStep({ x: 976, row: 'front', dy: 0 }, next, MAX)).toBe(next);
  });

  it('passes everything through when maxPx is 0, negative or NaN', () => {
    const prev: WorldPlacement = { ...GIRL, dy: 0 };
    const next: WorldPlacement = { ...GIRL, dy: 16 };
    expect(clampGirlStep(prev, next, 0)).toBe(next);
    expect(clampGirlStep(prev, next, -1)).toBe(next);
    expect(clampGirlStep(prev, next, NaN)).toBe(next);
  });

  it('passes everything through when maxPx is not finite', () => {
    const prev: WorldPlacement = { ...GIRL, dy: 0 };
    const next: WorldPlacement = { ...GIRL, dy: 16 };
    expect(clampGirlStep(prev, next, Infinity)).toBe(next);
  });

  it('never mutates the inputs', () => {
    const prev: WorldPlacement = Object.freeze({ ...GIRL, dy: 8 });
    const next: WorldPlacement = Object.freeze({ ...GIRL, dy: 40 });
    const out = clampGirlStep(prev, next, MAX);
    expect(out).toEqual({ x: 976, row: 'front', inner: true, dy: 8 + MAX });
    expect(prev).toEqual({ x: 976, row: 'front', inner: true, dy: 8 });
    expect(next).toEqual({ x: 976, row: 'front', inner: true, dy: 40 });
  });
});

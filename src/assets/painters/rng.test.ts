import { describe, it, expect } from 'vitest';
import { createRng } from './rng';

describe('createRng', () => {
  it('same seed yields the same first 5 values', () => {
    const a = createRng(11);
    const b = createRng(11);
    const seqA = [a(), a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it('different seeds produce different sequences', () => {
    const a = createRng(1);
    const b = createRng(2);
    const seqA = [a(), a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b(), b()];
    expect(seqA).not.toEqual(seqB);
  });

  it('returns 1000 values in [0,1)', () => {
    const rng = createRng(123456);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

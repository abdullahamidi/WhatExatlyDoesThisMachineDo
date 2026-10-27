import { describe, it, expect } from 'vitest';
import { APP_VERSION } from './version';

describe('APP_VERSION', () => {
  it('is a plain x.y.z version string', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('is 0.10.1', () => {
    expect(APP_VERSION).toBe('0.10.1');
  });
});

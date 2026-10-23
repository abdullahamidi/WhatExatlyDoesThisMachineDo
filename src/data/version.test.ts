import { describe, it, expect } from 'vitest';
import { APP_VERSION } from './version';
// JSON import (resolveJsonModule) instead of fs: no @types/node in the project and no new dependencies allowed.
import pkg from '../../package.json';

describe('APP_VERSION', () => {
  it('is 1.0.0', () => {
    expect(APP_VERSION).toBe('1.0.0');
  });

  it('matches package.json version', () => {
    expect(APP_VERSION).toBe(pkg.version);
    expect(pkg.version).toBe('1.0.0');
  });
});

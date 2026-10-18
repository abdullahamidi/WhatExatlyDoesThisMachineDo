import { describe, it, expect, afterEach } from 'vitest';
import { isRevealedLabel, resourceShort, setRevealed } from './revealRules';
import { RESOURCES } from '../data/resources';
import { RESOURCE_IDS } from '../data/types';

describe('revealRules', () => {
  afterEach(() => {
    setRevealed(false);
  });

  it('starts unrevealed', () => {
    expect(isRevealedLabel()).toBe(false);
  });

  it('keeps every resource short label while unrevealed (xf reads ???)', () => {
    for (const id of RESOURCE_IDS) expect(resourceShort(id)).toBe(RESOURCES[id].short);
    expect(resourceShort('xf')).toBe('???');
  });

  it('shows RF for xf once revealed and back to ??? when unset', () => {
    setRevealed(true);
    expect(isRevealedLabel()).toBe(true);
    expect(resourceShort('xf')).toBe('RF');
    setRevealed(false);
    expect(isRevealedLabel()).toBe(false);
    expect(resourceShort('xf')).toBe('???');
  });

  it('leaves non-xf ids unchanged when revealed', () => {
    setRevealed(true);
    expect(resourceShort('me')).toBe('ME');
    expect(resourceShort('ee')).toBe('EE');
    expect(resourceShort('pr')).toBe('PR');
    expect(resourceShort('rs')).toBe('RS');
  });
});

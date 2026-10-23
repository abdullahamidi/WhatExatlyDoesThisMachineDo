import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ERA_CARD } from '../data/ux';
import { eraCardTimingVars } from './eraCardTiming';

const css = readFileSync(fileURLToPath(new URL('./eraCard.css', import.meta.url)), 'utf8');

describe('eraCardTimingVars', () => {
  it('maps ERA_CARD fades to the CSS custom properties', () => {
    expect(eraCardTimingVars()).toEqual({
      '--era-card-in': `${ERA_CARD.fadeInMs}ms`,
      '--era-card-out': `${ERA_CARD.fadeOutMs}ms`,
    });
  });

  it('passes custom durations through', () => {
    expect(eraCardTimingVars({ fadeInMs: 10, fadeOutMs: 20 })).toEqual({
      '--era-card-in': '10ms',
      '--era-card-out': '20ms',
    });
  });
});

describe('eraCard.css timing', () => {
  it('holds no duration literal', () => {
    expect(css).not.toMatch(/\d+\s*ms/);
  });

  it('reads both fades from the custom properties', () => {
    expect(css).toContain('var(--era-card-in');
    expect(css).toContain('var(--era-card-out');
  });
});

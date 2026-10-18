import { describe, it, expect } from 'vitest';
import { buildHudView } from './hudView';
import { createInitialState } from '../simulation';

describe('buildHudView', () => {
  it('formats a zero state', () => {
    expect(buildHudView({ me: 0 }, { perClick: 1, perSecond: 0 })).toEqual({
      me: '0',
      perClick: '1',
      perSecond: '0/s',
    });
  });

  it('formats large me with a suffix', () => {
    expect(buildHudView({ me: 1500 }, { perClick: 1, perSecond: 0 }).me).toBe('1.5K');
  });

  it('formats per-click without a rate suffix', () => {
    expect(buildHudView({ me: 0 }, { perClick: 12, perSecond: 0 }).perClick).toBe('12');
  });

  it('formats per-second as a rate', () => {
    expect(buildHudView({ me: 0 }, { perClick: 1, perSecond: 12.5 }).perSecond).toBe('12.5/s');
    expect(buildHudView({ me: 0 }, { perClick: 1, perSecond: 1500 }).perSecond).toBe('1.5K/s');
  });

  it('accepts a full initial game state', () => {
    const view = buildHudView(createInitialState(0), { perClick: 1, perSecond: 0 });
    expect(view.me).toBe('0');
  });

  it('shows 0 for a non-finite me', () => {
    expect(buildHudView({ me: Number.NaN }, { perClick: 1, perSecond: 0 }).me).toBe('0');
  });
});

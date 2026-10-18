import { describe, it, expect } from 'vitest';
import type { EndingPhase, EndingState, GameState, TechId } from '../../data/types';
import { TECHNOLOGIES } from '../../data/technologies';
import { createInitialState } from '../state';
import {
  DEFAULT_ENDING,
  advanceEnding,
  hasEndingEffect,
  isFinaleLocked,
  isRevealed,
  normalizeEnding,
  startEnding,
} from './ending';

const withState = (levels: Partial<Record<TechId, number>>, ending: EndingState, lastSimTime = 7000): GameState => {
  const s = createInitialState(0);
  return { ...s, lastSimTime, techLevels: { ...s.techLevels, ...levels }, ending };
};

const ownsEnding = { primaryFunction: 1, finalAlignment: 1 } as const;
const PHASES: readonly EndingPhase[] = ['none', 'sequence', 'choice', 'postgame'];

describe('DEFAULT_ENDING', () => {
  it('is phase none with no engagement time', () => {
    expect(DEFAULT_ENDING).toEqual({ phase: 'none', engagedAt: null });
  });
});

describe('hasEndingEffect', () => {
  it('is true only for the ending marker effect (primaryFunction)', () => {
    expect(hasEndingEffect(TECHNOLOGIES.primaryFunction)).toBe(true);
    expect(hasEndingEffect(TECHNOLOGIES.finalAlignment)).toBe(false);
    expect(hasEndingEffect(TECHNOLOGIES.gearRatio)).toBe(false);
  });
});

describe('startEnding', () => {
  it('starts the sequence when an ending tech is owned and the phase is none, engagedAt = lastSimTime', () => {
    const state = withState(ownsEnding, { ...DEFAULT_ENDING }, 7000);
    const next = startEnding(state);
    expect(next).not.toBe(state);
    expect(next.ending).toEqual({ phase: 'sequence', engagedAt: 7000 });
    expect(next.techLevels).toBe(state.techLevels);
  });

  it('does not mutate the input state', () => {
    const state = withState(ownsEnding, { ...DEFAULT_ENDING });
    startEnding(state);
    expect(state.ending).toEqual({ phase: 'none', engagedAt: null });
  });

  it('returns the same object when no ending tech is owned', () => {
    const state = withState({ finalAlignment: 1 }, { ...DEFAULT_ENDING });
    expect(startEnding(state)).toBe(state);
  });

  it('returns the same object for every phase other than none', () => {
    for (const phase of ['sequence', 'choice', 'postgame'] as const) {
      const state = withState(ownsEnding, { phase, engagedAt: 1 });
      expect(startEnding(state)).toBe(state);
    }
  });
});

describe('advanceEnding', () => {
  it('moves sequence -> choice and choice -> postgame, keeping engagedAt', () => {
    const seq = withState(ownsEnding, { phase: 'sequence', engagedAt: 3000 });
    const choice = advanceEnding(seq, 'choice');
    expect(choice).not.toBe(seq);
    expect(choice.ending).toEqual({ phase: 'choice', engagedAt: 3000 });

    const post = advanceEnding(choice, 'postgame');
    expect(post).not.toBe(choice);
    expect(post.ending).toEqual({ phase: 'postgame', engagedAt: 3000 });
  });

  it('is legal only in the table order: every other request returns the same object', () => {
    const targets = ['choice', 'postgame'] as const;
    for (const from of PHASES) {
      for (const to of targets) {
        const state = withState(ownsEnding, { phase: from, engagedAt: null });
        const legal = (from === 'sequence' && to === 'choice') || (from === 'choice' && to === 'postgame');
        const next = advanceEnding(state, to);
        if (legal) {
          expect(next).not.toBe(state);
          expect(next.ending.phase).toBe(to);
        } else {
          expect(next).toBe(state);
        }
      }
    }
  });

  it('does not mutate the input state', () => {
    const state = withState(ownsEnding, { phase: 'sequence', engagedAt: 1 });
    advanceEnding(state, 'choice');
    expect(state.ending).toEqual({ phase: 'sequence', engagedAt: 1 });
  });
});

describe('normalizeEnding', () => {
  const owned = withState(ownsEnding, DEFAULT_ENDING).techLevels;
  const notOwned = withState({}, DEFAULT_ENDING).techLevels;

  it('turns sequence into choice when the ending tech is owned (reload resumes at the choice)', () => {
    expect(normalizeEnding({ phase: 'sequence', engagedAt: 5 }, owned)).toEqual({ phase: 'choice', engagedAt: 5 });
  });

  it('turns none into choice when the ending tech is owned (WP11 saves)', () => {
    expect(normalizeEnding({ phase: 'none', engagedAt: null }, owned)).toEqual({ phase: 'choice', engagedAt: null });
  });

  it('keeps none when the ending tech is not owned (same object)', () => {
    const e: EndingState = { phase: 'none', engagedAt: null };
    expect(normalizeEnding(e, notOwned)).toBe(e);
  });

  it('keeps choice and postgame when the ending tech is owned (same object)', () => {
    const choice: EndingState = { phase: 'choice', engagedAt: 2 };
    const post: EndingState = { phase: 'postgame', engagedAt: 2 };
    expect(normalizeEnding(choice, owned)).toBe(choice);
    expect(normalizeEnding(post, owned)).toBe(post);
  });

  it('resets any non-none phase to DEFAULT when the ending tech is not owned', () => {
    for (const phase of ['sequence', 'choice', 'postgame'] as const) {
      expect(normalizeEnding({ phase, engagedAt: 9 }, notOwned)).toEqual(DEFAULT_ENDING);
    }
  });
});

describe('isRevealed', () => {
  it('is true only in choice and postgame', () => {
    const table: Record<EndingPhase, boolean> = { none: false, sequence: false, choice: true, postgame: true };
    for (const phase of PHASES) expect(isRevealed({ phase, engagedAt: null })).toBe(table[phase]);
  });
});

describe('isFinaleLocked', () => {
  it('is true only in sequence and choice', () => {
    const table: Record<EndingPhase, boolean> = { none: false, sequence: true, choice: true, postgame: false };
    for (const phase of PHASES) expect(isFinaleLocked({ phase, engagedAt: null })).toBe(table[phase]);
  });
});

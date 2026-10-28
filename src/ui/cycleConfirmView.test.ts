import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildCycleConfirm } from './cycleConfirmView';
import type { CycleConfirmModel } from './cycleConfirmView';
import { PRESTIGE_TEXT } from '../data/prestige';
import { DEFAULT_PRESTIGE, cyclePreview } from '../simulation/prestige';
import type { CyclePreview } from '../simulation/prestige';
import { createInitialState } from '../simulation/state';
import { getDefaultNotation, setDefaultNotation } from '../utils/format';

// A revealed run that would gain 3 Echoes (the first Echo bonus threshold is 2B; the next one 8B).
const PREVIEW_8B: CyclePreview = {
  allowed: true,
  nextCycle: 2,
  label: 'CYCLE 0043',
  echoesGained: 3,
  echoesAfter: 3,
  bonusPctAfter: 42,
  nextBonusXf: 8e9,
};

const PREVIEW_NO_THRESHOLD: CyclePreview = { ...PREVIEW_8B, nextBonusXf: null };

let savedNotation: ReturnType<typeof getDefaultNotation>;

beforeEach(() => {
  savedNotation = getDefaultNotation();
  setDefaultNotation('suffix');
});

afterEach(() => {
  setDefaultNotation(savedNotation);
});

describe('buildCycleConfirm texts', () => {
  it('builds the exact dialog lines for the cycle-2 preview', () => {
    const m: CycleConfirmModel = buildCycleConfirm(PREVIEW_8B, 'RF');
    expect(m.title).toBe('BEGIN CYCLE 0043?');
    expect(m.gainLine).toBe('+3 ECHOES -> ECHOES 3 (+42% ALL/S)');
    expect(m.bonusLine).toBe('NEXT CYCLE: +42% ALL/S');
    expect(m.thresholdHint).toBe('+1 ECHO AT 8B RF');
    expect(m.confirmLabel).toBe('BEGIN CYCLE 0043');
    expect(m.cancelLabel).toBe('CANCEL');
  });

  it('takes the xf short label from the caller', () => {
    expect(buildCycleConfirm(PREVIEW_8B, 'XF').thresholdHint).toBe('+1 ECHO AT 8B XF');
    expect(buildCycleConfirm(PREVIEW_8B, '???').thresholdHint).toBe('+1 ECHO AT 8B ???');
  });

  it('thresholdHint is null when no threshold is left', () => {
    expect(buildCycleConfirm(PREVIEW_NO_THRESHOLD, 'RF').thresholdHint).toBeNull();
  });

  it('follows the preview numbers (gain, total, bonus, label)', () => {
    const m = buildCycleConfirm(
      { ...PREVIEW_8B, nextCycle: 3, label: 'CYCLE 0044', echoesGained: 4, echoesAfter: 7, bonusPctAfter: 210 },
      'RF',
    );
    expect(m.title).toBe('BEGIN CYCLE 0044?');
    expect(m.gainLine).toBe('+4 ECHOES -> ECHOES 7 (+210% ALL/S)');
    expect(m.bonusLine).toBe('NEXT CYCLE: +210% ALL/S');
    expect(m.confirmLabel).toBe('BEGIN CYCLE 0044');
  });

  it('kept and reset lists come from the data, as copies', () => {
    const m = buildCycleConfirm(PREVIEW_8B, 'RF');
    expect(m.kept).toEqual([...PRESTIGE_TEXT.kept]);
    expect(m.reset).toEqual([...PRESTIGE_TEXT.reset]);
    expect(m.kept.length).toBeGreaterThan(0);
    expect(m.reset.length).toBeGreaterThan(0);
    m.kept.push('extra');
    m.reset.length = 0;
    expect(PRESTIGE_TEXT.kept).not.toContain('extra');
    expect(PRESTIGE_TEXT.reset.length).toBeGreaterThan(0);
  });

  it('is deterministic for the same input', () => {
    expect(buildCycleConfirm(PREVIEW_8B, 'RF')).toEqual(buildCycleConfirm(PREVIEW_8B, 'RF'));
  });
});

describe('buildCycleConfirm with the real preview', () => {
  function previewAt(xf: number): CyclePreview {
    const base = createInitialState(0);
    const state = {
      ...base,
      lifetime: { ...base.lifetime, xf },
      ending: { phase: 'choice' as const, engagedAt: 0 },
    };
    return cyclePreview(state, DEFAULT_PRESTIGE);
  }

  it('first run at PF xf (5.36e8): 3 Echoes, next threshold 2B', () => {
    const m = buildCycleConfirm(previewAt(5.36e8), 'RF');
    expect(m.gainLine).toBe('+3 ECHOES -> ECHOES 3 (+42% ALL/S)');
    expect(m.thresholdHint).toBe('+1 ECHO AT 2B RF');
  });

  it('above the last threshold (3.2e10) the hint is null', () => {
    const m = buildCycleConfirm(previewAt(3.2e10), 'RF');
    expect(m.thresholdHint).toBeNull();
  });
});

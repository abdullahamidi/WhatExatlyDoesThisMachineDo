import { describe, it, expect } from 'vitest';
import { buildFinaleOverlay } from './finaleView';
import { FINALE_CHOICE, FINALE_REVEAL } from '../data/finale';
import { choiceStartS, finaleEndS } from '../game/math/finale';

const ALL_TEXTS = [...FINALE_REVEAL.lines, FINALE_REVEAL.lastLine];
const REVEAL = FINALE_REVEAL.startS;
const NO_BLOCK: string | null = null;
const BLOCKED: string = FINALE_CHOICE.cycleStubReason;

describe('buildFinaleOverlay phases', () => {
  it('is null for none and postgame', () => {
    expect(buildFinaleOverlay('none', 0, false, NO_BLOCK)).toBeNull();
    expect(buildFinaleOverlay('none', 70, true, BLOCKED)).toBeNull();
    expect(buildFinaleOverlay('postgame', 0, false, NO_BLOCK)).toBeNull();
    expect(buildFinaleOverlay('postgame', 70, false, BLOCKED)).toBeNull();
  });

  it('shows SKIP only in sequence', () => {
    expect(buildFinaleOverlay('sequence', 0, false, NO_BLOCK)?.skipVisible).toBe(true);
    expect(buildFinaleOverlay('sequence', 30, false, NO_BLOCK)?.skipVisible).toBe(true);
    expect(buildFinaleOverlay('choice', 70, false, NO_BLOCK)?.skipVisible).toBe(false);
  });

  it('emits 4 body lines plus lastLine, text exact', () => {
    const m = buildFinaleOverlay('sequence', 0, false, NO_BLOCK);
    expect(m?.lines.map((l) => l.text)).toEqual(ALL_TEXTS);
    expect(m?.lines).toHaveLength(5);
  });

  it('choice shows every line complete with the buttons up, whatever t', () => {
    const m = buildFinaleOverlay('choice', 0, false, NO_BLOCK);
    expect(m).not.toBeNull();
    expect(m?.buttons).toBe(true);
    expect(m?.nameplateAlpha).toBe(1);
    expect(m?.skipVisible).toBe(false);
    expect(m?.lines.map((l) => l.shown)).toEqual(ALL_TEXTS.map((t) => t.length));
  });

  it('choice in reduced motion is identical to choice', () => {
    expect(buildFinaleOverlay('choice', 62, true, NO_BLOCK)).toEqual(buildFinaleOverlay('choice', 62, false, NO_BLOCK));
  });
});

describe('buildFinaleOverlay sequence timing', () => {
  it('nameplate fades in over nameplateFadeMs and stays at 1', () => {
    const fadeS = FINALE_REVEAL.nameplateFadeMs / 1000;
    expect(buildFinaleOverlay('sequence', REVEAL - 1, false, NO_BLOCK)?.nameplateAlpha).toBe(0);
    expect(buildFinaleOverlay('sequence', REVEAL, false, NO_BLOCK)?.nameplateAlpha).toBe(0);
    expect(buildFinaleOverlay('sequence', REVEAL + fadeS / 2, false, NO_BLOCK)?.nameplateAlpha).toBeCloseTo(0.5, 9);
    expect(buildFinaleOverlay('sequence', REVEAL + fadeS + 0.01, false, NO_BLOCK)?.nameplateAlpha).toBe(1);
    expect(buildFinaleOverlay('sequence', REVEAL + 30, false, NO_BLOCK)?.nameplateAlpha).toBeCloseTo(1, 9);
  });

  it('types the first line at cps after holdS, nothing before', () => {
    const fadeS = FINALE_REVEAL.nameplateFadeMs / 1000;
    const start = fadeS + FINALE_REVEAL.holdS;
    const before = buildFinaleOverlay('sequence', REVEAL + start - 0.01, false, NO_BLOCK);
    expect(before?.lines[0]?.shown).toBe(0);
    const mid = buildFinaleOverlay('sequence', REVEAL + start + 0.5, false, NO_BLOCK);
    expect(mid?.lines[0]?.shown).toBe(15); // 0.5 s x 30 cps
    const done = buildFinaleOverlay('sequence', REVEAL + start + 10, false, NO_BLOCK);
    expect(done?.lines[0]?.shown).toBe(FINALE_REVEAL.lines[0]?.length);
  });

  it('a line waits linePauseS after the previous one has finished typing', () => {
    const len0 = FINALE_REVEAL.lines[0]?.length ?? 0;
    const start1 = FINALE_REVEAL.nameplateFadeMs / 1000 + FINALE_REVEAL.holdS + len0 / FINALE_REVEAL.cps + FINALE_REVEAL.linePauseS;
    expect(buildFinaleOverlay('sequence', REVEAL + start1 - 0.01, false, NO_BLOCK)?.lines[1]?.shown).toBe(0);
    expect(buildFinaleOverlay('sequence', REVEAL + start1 + 0.1, false, NO_BLOCK)?.lines[1]?.shown).toBeGreaterThan(0);
  });

  it('before the reveal every line is empty and no buttons', () => {
    const m = buildFinaleOverlay('sequence', 10, false, NO_BLOCK);
    expect(m?.lines.every((l) => l.shown === 0)).toBe(true);
    expect(m?.buttons).toBe(false);
  });

  it('buttons appear only after the last line is complete plus buttonsDelayS', () => {
    const end = finaleEndS();
    expect(buildFinaleOverlay('sequence', end - 0.01, false, NO_BLOCK)?.buttons).toBe(false);
    expect(buildFinaleOverlay('sequence', end + 0.01, false, NO_BLOCK)?.buttons).toBe(true);
    // the last line is not complete before choiceStartS + its typing time
    const lastDone = choiceStartS() + (FINALE_REVEAL.lastLine.length / FINALE_REVEAL.cps);
    const beforeLastDone = buildFinaleOverlay('sequence', lastDone - 0.05, false, NO_BLOCK);
    expect(beforeLastDone?.buttons).toBe(false);
    expect(beforeLastDone?.lines[4]?.shown).toBeLessThan(FINALE_REVEAL.lastLine.length);
  });

  it('sequence after the buttons are up still shows the buttons', () => {
    expect(buildFinaleOverlay('sequence', finaleEndS() + 5, false, NO_BLOCK)?.buttons).toBe(true);
  });
});

describe('buildFinaleOverlay reduced motion', () => {
  it('shows every line whole at its start time', () => {
    const fadeS = FINALE_REVEAL.nameplateFadeMs / 1000;
    const start0 = fadeS + FINALE_REVEAL.holdS;
    const at0 = buildFinaleOverlay('sequence', REVEAL + start0 + 0.01, true, NO_BLOCK);
    expect(at0?.lines[0]?.shown).toBe(FINALE_REVEAL.lines[0]?.length);
    expect(at0?.lines[1]?.shown).toBe(0);
    const len0 = FINALE_REVEAL.lines[0]?.length ?? 0;
    const start1 = start0 + len0 / FINALE_REVEAL.cps + FINALE_REVEAL.linePauseS;
    expect(buildFinaleOverlay('sequence', REVEAL + start1 - 0.01, true, NO_BLOCK)?.lines[1]?.shown).toBe(0);
    expect(buildFinaleOverlay('sequence', REVEAL + start1 + 0.01, true, NO_BLOCK)?.lines[1]?.shown).toBe(FINALE_REVEAL.lines[1]?.length);
  });

  it('buttons after the last line start time plus buttonsDelayS', () => {
    expect(buildFinaleOverlay('sequence', choiceStartS() + FINALE_REVEAL.buttonsDelayS + 0.01, true, NO_BLOCK)?.buttons).toBe(true);
    expect(buildFinaleOverlay('sequence', choiceStartS() + FINALE_REVEAL.buttonsDelayS - 0.05, true, NO_BLOCK)?.buttons).toBe(false);
  });
});

describe('buildFinaleOverlay new-cycle button', () => {
  it('enabled with null reason when nothing blocks it', () => {
    const m = buildFinaleOverlay('choice', 70, false, NO_BLOCK);
    expect(m?.cycleEnabled).toBe(true);
    expect(m?.cycleReason).toBeNull();
  });

  it('disabled with the blocked reason as cycleReason', () => {
    const m = buildFinaleOverlay('choice', 70, false, BLOCKED);
    expect(m?.cycleEnabled).toBe(false);
    expect(m?.cycleReason).toBe(FINALE_CHOICE.cycleStubReason);
  });

  it('is reported in sequence too (the model carries it for every shown phase)', () => {
    const m = buildFinaleOverlay('sequence', 5, false, BLOCKED);
    expect(m?.cycleEnabled).toBe(false);
    expect(m?.cycleReason).toBe(BLOCKED);
    expect(buildFinaleOverlay('sequence', 5, false, NO_BLOCK)?.cycleEnabled).toBe(true);
  });
});

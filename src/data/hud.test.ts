import { describe, it, expect } from 'vitest';
import { HUD_TEXT } from './hud';
import { REVEALED } from './finale';

const TITLES: readonly string[] = [...HUD_TEXT.eraTitles, HUD_TEXT.eraFiveRevealed, HUD_TEXT.restored];

describe('HUD_TEXT.eraTitles', () => {
  it('has five era titles', () => {
    expect(HUD_TEXT.eraTitles).toHaveLength(5);
  });

  it('lists the era titles in order', () => {
    expect(HUD_TEXT.eraTitles).toEqual([
      'ERA I · MECHANICAL',
      'ERA II · ELECTRICAL',
      'ERA III · PRESSURE',
      'ERA IV · RESONANCE',
      'ERA V · ???',
    ]);
  });

  it('uses the U+00B7 middle dot in every era title', () => {
    for (const title of HUD_TEXT.eraTitles) {
      expect(title.split('·')).toHaveLength(2);
    }
  });
});

describe('HUD_TEXT.eraFiveRevealed', () => {
  it('is ERA V with the revealed Unknown Flux name', () => {
    expect(HUD_TEXT.eraFiveRevealed).toBe(`ERA V · ${REVEALED.xf.name.toUpperCase()}`);
    expect(HUD_TEXT.eraFiveRevealed).toBe('ERA V · RESTORATION FLUX');
  });
});

describe('HUD_TEXT titles', () => {
  it('keeps every title (era, revealed, restored) within 26 characters', () => {
    for (const title of TITLES) {
      expect(title.length).toBeLessThanOrEqual(26);
    }
  });

  it('keeps the restored title text', () => {
    expect(HUD_TEXT.restored).toBe('RESTORATION ENGINE');
  });
});

describe('HUD_TEXT row labels', () => {
  it('has the click, auto-crank and feeds labels', () => {
    expect(HUD_TEXT.clickLabel).toBe('CLICK');
    expect(HUD_TEXT.autoCrank).toBe('AUTO-CRANK');
    expect(HUD_TEXT.feedsPrefix).toBe('›');
  });
});

describe('HUD_TEXT view machine button', () => {
  it('has the VIEW MACHINE label and title', () => {
    expect(HUD_TEXT.viewMachine).toBe('VIEW MACHINE');
    expect(HUD_TEXT.viewMachineTitle).toBe('View the whole machine (photo mode)');
  });
});

describe('HUD_TEXT click worth and auto-crank output (WP25 C4)', () => {
  it('has the exact worth separator, worth, worth floor, worth title and auto-crank output strings', () => {
    expect(HUD_TEXT.worthSep).toBe(' · ');
    expect(HUD_TEXT.clickWorth).toBe('{s}s');
    expect(HUD_TEXT.worthFloor).toBe('<0.01');
    expect(HUD_TEXT.clickWorthTitle).toBe('One turn of the crank = {s} s of machine output');
    expect(HUD_TEXT.autoCrankOutput).toBe('+{v} {res}/s');
  });

  it('keeps the {s} placeholder in the worth strings', () => {
    expect(HUD_TEXT.clickWorth).toContain('{s}');
    expect(HUD_TEXT.clickWorthTitle).toContain('{s}');
  });

  it('keeps the {v} and {res} placeholders in the auto-crank output string', () => {
    expect(HUD_TEXT.autoCrankOutput).toContain('{v}');
    expect(HUD_TEXT.autoCrankOutput).toContain('{res}');
  });
});

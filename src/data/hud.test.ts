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

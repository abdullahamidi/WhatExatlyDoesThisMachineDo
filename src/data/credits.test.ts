import { describe, it, expect } from 'vitest';
import { CREDITS, CREDITS_TEXT } from './credits';

const ALL_CREDITS_TEXT = CREDITS.flatMap((section) => [section.heading, ...section.lines]).join('\n');

describe('CREDITS content', () => {
  it.each(['Phaser', 'MIT', 'Electron', 'Chromium', 'PixelLab', 'abdullahamidi', 'THIRD_PARTY_NOTICES.txt'])(
    'names %s',
    (term) => {
      expect(ALL_CREDITS_TEXT).toContain(term);
    },
  );

  it('gives every section a non-empty heading and at least one non-empty line', () => {
    expect(CREDITS.length).toBeGreaterThan(0);
    for (const section of CREDITS) {
      expect(section.heading.trim().length).toBeGreaterThan(0);
      expect(section.lines.length).toBeGreaterThanOrEqual(1);
      for (const line of section.lines) {
        expect(line.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('closes with the ESC hint', () => {
    expect(CREDITS_TEXT.close).toBe('CLOSE [ESC]');
  });
});

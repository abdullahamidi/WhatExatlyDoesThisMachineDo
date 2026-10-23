import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { DEMO_END, DEMO_TEXT } from './demo';
import {
  OFFLINE_REPORT_THRESHOLD_SECONDS,
  SAVE_BACKUP_KEY,
  SAVE_FULLGAME_KEY,
  SAVE_KEY,
  SAVE_PREIMPORT_KEY,
} from './balance';

describe('DEMO_END', () => {
  it('ticks faster than the offline report threshold so the session never looks offline', () => {
    expect(DEMO_END.tickMs).toBeLessThan(OFFLINE_REPORT_THRESHOLD_SECONDS * 1000);
  });

  it('has only positive integer timings', () => {
    const timings: number[] = [];
    for (const value of Object.values(DEMO_END)) {
      if (typeof value === 'number') timings.push(value);
    }
    expect(timings.length).toBeGreaterThan(0);
    for (const value of timings) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
  });
});

describe('DEMO_TEXT', () => {
  it('never mentions restoring a save', () => {
    for (const value of Object.values(DEMO_TEXT)) {
      expect(value.toLowerCase()).not.toContain('restor');
    }
  });
});

describe('SAVE_FULLGAME_KEY', () => {
  it('is distinct from every other save key', () => {
    expect(SAVE_FULLGAME_KEY).not.toBe(SAVE_KEY);
    expect(SAVE_FULLGAME_KEY).not.toBe(SAVE_BACKUP_KEY);
    expect(SAVE_FULLGAME_KEY).not.toBe(SAVE_PREIMPORT_KEY);
  });

  it('passes the desktop save-key rule', () => {
    expect(SAVE_FULLGAME_KEY).toMatch(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/);
  });
});

describe('demo data source', () => {
  it('stays free of Phaser and import.meta', () => {
    for (const file of ['edition.ts', 'demo.ts']) {
      const src = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
      expect(src.toLowerCase()).not.toContain('phaser');
      expect(src).not.toContain('import.meta');
    }
  });
});

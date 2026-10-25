// Living world token expander tests (WP23b, bible §5.3): the cycle label as digits and words, savedWords for cycles 1-99, several tokens
// in one text, unknown braces kept, and non-finite cycle counts read as 1. Why: every cycle variant line depends on these outputs, and
// textSweep checks the expanded texts. Pure data tests (node environment, no Phaser).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { cycleDigitsOf, cycleWordsOf, expandWorldText, savedWordsOf } from './worldText';
import { WORLD_LINES } from './livingWorld';

const SRC = readFileSync(new URL('./worldText.ts', import.meta.url), 'utf8');

// The cycle-variant lines (bible §5.2: CRW-05, CRW-09, GRL-12, PAY-14) are the templates: every line whose text carries a cycle token.
const CYCLE_LINES = WORLD_LINES.filter((l) => /\{(cycle|cycleWords|savedWords)\}/.test(l.text));

describe('cycle label digits', () => {
  it.each<[number, string]>([[1, '0042'], [2, '0043'], [3, '0044'], [9, '0050'], [99, '0140']])('cycle %s reads %s', (cycle, digits) => {
    expect(cycleDigitsOf(cycle)).toBe(digits);
  });
});

describe('cycle label words', () => {
  it.each<[number, string]>([
    [1, 'Zero-zero-four-two'], [2, 'Zero-zero-four-three'], [99, 'Zero-one-four-zero'],
  ])('cycle %s reads as %s', (cycle, words) => {
    expect(cycleWordsOf(cycle)).toBe(words);
  });
});

describe('saved words', () => {
  it.each<[number, string]>([
    [1, 'zero'], [2, 'one'], [3, 'two'], [10, 'nine'], [11, '10'], [12, '11'], [100, '99'],
  ])('cycle %s saves %s', (cycle, saved) => {
    expect(savedWordsOf(cycle)).toBe(saved);
  });
});

describe('expandWorldText', () => {
  it('fills {cycle} with the digits (GRL-12 shape)', () => {
    expect(expandWorldText('Cycle {cycle}. You came back. So did we.', 2)).toBe('Cycle 0043. You came back. So did we.');
  });

  it('fills {cycleWords} with the capitalised words (CRW-05 / CRW-09 shape)', () => {
    expect(expandWorldText('{cycleWords}. {cycleWords}.', 1)).toBe('Zero-zero-four-two. Zero-zero-four-two.');
    expect(expandWorldText('{cycleWords}. Again.', 2)).toBe('Zero-zero-four-three. Again.');
  });

  it('fills {savedWords} from cycle - 1 (PAY-13 says one at cycle 2, PAY-14 shape)', () => {
    expect(expandWorldText('You have {savedWords} saved messages. All from you.', 2)).toBe('You have one saved messages. All from you.');
    expect(expandWorldText('You have {savedWords} saved messages. All from you.', 3)).toBe('You have two saved messages. All from you.');
    expect(expandWorldText('You have {savedWords} saved messages. All from you.', 11)).toBe('You have 10 saved messages. All from you.');
  });

  it('expands several tokens in one text', () => {
    expect(expandWorldText('{cycle} {savedWords} {cycleWords} {cycle}', 2)).toBe('0043 one Zero-zero-four-three 0043');
  });

  it('keeps unknown or malformed braces as written', () => {
    const text = '{x} {cycles} {cycle!} {} {Cycle} {cycle';
    expect(expandWorldText(text, 1)).toBe(text);
  });

  it('leaves a text with no tokens unchanged', () => {
    expect(expandWorldText('Ignored. Ignored. Ignored.', 5)).toBe('Ignored. Ignored. Ignored.');
  });

  it('reads a non-finite or sub-1 cycle as 1 and floors fractions', () => {
    const text = '{cycle} {savedWords} {cycleWords}';
    const expected = '0042 zero Zero-zero-four-two';
    expect(expandWorldText(text, Number.NaN)).toBe(expected);
    expect(expandWorldText(text, Number.POSITIVE_INFINITY)).toBe(expected);
    expect(expandWorldText(text, Number.NEGATIVE_INFINITY)).toBe(expected);
    expect(expandWorldText(text, 0)).toBe(expected);
    expect(expandWorldText(text, -4)).toBe(expected);
    expect(expandWorldText(text, 2.9)).toBe('0043 one Zero-zero-four-three');
  });

  it('finds exactly the four cycle-variant lines (CRW-05, CRW-09, GRL-12, PAY-14)', () => {
    expect(CYCLE_LINES.map((l) => l.id).sort()).toEqual(['CRW-05', 'CRW-09', 'GRL-12', 'PAY-14']);
  });

  it('keeps every cycle-variant line within 52 chars for cycles 1-99, with no token left over', () => {
    const expansions = CYCLE_LINES.flatMap((l) => Array.from({ length: 99 }, (_, i) => expandWorldText(l.text, i + 1)));
    expect(expansions.filter((s) => /[{}]/.test(s))).toEqual([]);
    expect(expansions.reduce((max, s) => Math.max(max, s.length), 0)).toBeLessThanOrEqual(52);
  });
});

describe('worldText: purity', () => {
  it('imports no Phaser', () => {
    expect(SRC).not.toMatch(/from\s+['"]phaser/i);
  });
});

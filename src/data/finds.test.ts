// WP28 Finds data tests: the 15 relic notes (3 per era, the planner's order, the text rules of the living world and the
// US spelling rule), the FIND_TEXT keys, the relic count per era cap, and the balance numbers the clock reads.
// Why: the notes are typed into this file by hand; these tests keep them inside the rules the other world text follows.
// Pure data test (node environment, no Phaser).
import { describe, it, expect } from 'vitest';
import { FINDS, FIND_TEXT, RELIC_NOTES, relicTotal } from './finds';

// App. B text rules. PRE_BAN and YOU are copied verbatim from src/data/livingWorld.test.ts (the bible validator).
const PRE_BAN = /restor|prior|rewind|undo|\bheal|repair|as it was|back the way|record|hold.{0,24}run|while it runs|running|keep it|\becho|memory|\bcycle\b|wishlist|\bsteam\b|full game|trailer|tutorial/i;
const YOU = /\b(you|your|you're|you've|yours)\b/i;
const BRITISH = /programme|colour|grey|metre|centre|catalogue/i;

// Every line of Find text: the notes and the FIND_TEXT values (the key is a marker, not text).
const TEXTS: string[] = [
  ...RELIC_NOTES.map((n) => n.text),
  FIND_TEXT.relicTitle, FIND_TEXT.blankTitle, FIND_TEXT.blankPage, FIND_TEXT.notesTitle,
];

describe('RELIC_NOTES', () => {
  it('has 15 notes, three per era from era 1 to era 5, in the planner order', () => {
    expect(RELIC_NOTES).toHaveLength(15);
    expect(RELIC_NOTES.map((n) => n.era)).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5]);
  });

  it('keeps the first and the last note verbatim', () => {
    expect(RELIC_NOTES[0]?.text).toBe('Bread, lamp oil, string. Ask about the dog.');
    expect(RELIC_NOTES[14]?.text).toBe('If found, leave it by the payphone.');
  });

  it('every note is at most 52 characters, with no exclamation mark and no ellipsis', () => {
    for (const note of RELIC_NOTES) {
      expect(note.text.length).toBeLessThanOrEqual(52);
      expect(note.text).not.toContain('!');
      expect(note.text).not.toContain('...');
    }
  });

  it('no note says "you" (the machine never speaks to the player)', () => {
    for (const t of TEXTS) expect(YOU.test(t)).toBe(false);
  });

  it('no note matches the living-world ban list (PRE_BAN)', () => {
    for (const t of TEXTS) expect(PRE_BAN.test(t)).toBe(false);
  });

  it('uses US spelling', () => {
    for (const t of TEXTS) expect(BRITISH.test(t)).toBe(false);
  });
});

describe('FIND_TEXT', () => {
  it('has the keys the app chunk reads', () => {
    expect(Object.keys(FIND_TEXT).sort()).toEqual(['blankPage', 'blankTitle', 'key', 'notesTitle', 'relicTitle']);
    expect(FIND_TEXT.key).toBe('[G]');
    expect(FIND_TEXT.relicTitle).toBe('FIELD NOTE {n}/{total}');
    expect(FIND_TEXT.blankTitle).toBe('FIELD NOTE');
    expect(FIND_TEXT.blankPage).toBe('A page. Blank on both sides.');
    expect(FIND_TEXT.notesTitle).toBe('FIELD NOTES');
  });
});

describe('relicTotal', () => {
  it('counts the notes up to the era cap, and every note for null', () => {
    expect(relicTotal(1)).toBe(3);
    expect(relicTotal(2)).toBe(6);
    expect(relicTotal(5)).toBe(15);
    expect(relicTotal(null)).toBe(15);
  });

  it('is 0 before era 1', () => {
    expect(relicTotal(0)).toBe(0);
  });
});

describe('FINDS balance numbers (WP28 P8, Q6)', () => {
  it('pins the clock numbers the parity cases use', () => {
    expect(FINDS.unlockTech).toBe('wornMotor');
    expect([...FINDS.intervalS]).toEqual([45, 120]);
    expect(FINDS.windowS).toBe(25);
    expect(FINDS.firstAfterS).toBe(120);
    expect(FINDS.payoutS).toBe(6);
    expect(FINDS.relicEvery).toBe(5);
    expect([...FINDS.payoutSpreadS]).toEqual([-2, 0, 2]);
    expect(FINDS.paySeedXor).toBe(0x5bd1e995);
    expect(FINDS.maxStepS).toBe(0.25);
    expect(FINDS.seed).toBe(28);
    expect(FINDS.catchSeedMul).toBe(7919);
    expect(FINDS.catchSeedAdd).toBe(13);
  });
});

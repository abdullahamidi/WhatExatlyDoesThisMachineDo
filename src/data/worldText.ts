// Living world token expander (WP23b, bible §5.3): fills {cycle}, {cycleWords} and {savedWords} in line texts for a cycle number.
// Why: the cycle label is derived from prestige.cycle, so every cycle variant reads one copy of the label rules (CYCLE_LABEL).
// Pure: no Phaser. A non-finite cycle counts as 1; the cycle is floored and kept >= 1.
import { CYCLE_LABEL } from './prestige';

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'] as const;

// Cycle as the expander reads it: floored, at least 1, and 1 when not finite.
const cycleOf = (cycle: number): number => (Number.isFinite(cycle) ? Math.max(1, Math.floor(cycle)) : 1);

// {cycle}: the 4-digit label (CYCLE_LABEL: base 42 + cycle - 1), zero-padded. Cycle 1 -> '0042'.
export function cycleDigitsOf(cycle: number): string {
  return String(CYCLE_LABEL.base + cycleOf(cycle) - 1).padStart(CYCLE_LABEL.digits, '0');
}

// {cycleWords}: the label digits as words, hyphenated, first word capitalised. Cycle 1 -> 'Zero-zero-four-two'.
export function cycleWordsOf(cycle: number): string {
  const words = cycleDigitsOf(cycle).split('').map((d) => WORDS[Number(d)] ?? d).join('-');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// {savedWords}: cycle - 1 as a lower-case word up to nine, then digits. Cycle 1 -> 'zero', cycle 3 -> 'two', cycle 11 -> '10'.
export function savedWordsOf(cycle: number): string {
  const saved = cycleOf(cycle) - 1;
  return saved <= 9 ? (WORDS[saved] ?? String(saved)) : String(saved);
}

// Replaces every {cycle}, {cycleWords} and {savedWords}; any other brace text is kept as written.
export function expandWorldText(text: string, cycle: number): string {
  return text.replace(/\{(cycle|cycleWords|savedWords)\}/g, (_token: string, name: string) => {
    if (name === 'cycleWords') return cycleWordsOf(cycle);
    if (name === 'savedWords') return savedWordsOf(cycle);
    return cycleDigitsOf(cycle);
  });
}

// Expanded living-world text sweep (WP23b, bible §5.3): every WORLD_LINES text, with {cycle}, {cycleWords} and {savedWords}
// expanded for cycles 1-99. Read by textSweep.test.ts.
// Why: the token outputs change length and wording per cycle (a 4-digit label, one word per digit), so the raw templates do not
// bound what a player reads. Pure data helper: no Phaser; built from livingWorld and worldText.
import { WORLD_LINES } from './livingWorld';
import { expandWorldText } from './worldText';

const TOKEN = /\{(?:cycle|cycleWords|savedWords)\}/;
const FIRST_CYCLE = 1;
const LAST_CYCLE = 99;

// Lines without tokens keep their id as `where`; token lines get one entry per cycle, `where` = id @c<cycle>.
// A text that repeats (DOG-09 and CRW-06 share one) keeps its first entry only.
function expandAll(): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [];
  const seen = new Set<string>();
  const add = (where: string, text: string): void => {
    if (seen.has(text)) return;
    seen.add(text);
    out.push({ where, text });
  };
  for (const line of WORLD_LINES) {
    const where = 'WORLD_LINES.' + line.id;
    if (!TOKEN.test(line.text)) {
      add(where, line.text);
      continue;
    }
    for (let cycle = FIRST_CYCLE; cycle <= LAST_CYCLE; cycle++) {
      add(`${where}@c${cycle}`, expandWorldText(line.text, cycle));
    }
  }
  return out;
}

// Every living-world output the player can read, for the text sweep.
export const WORLD_SWEEP_EXPANDED: readonly { where: string; text: string }[] = expandAll();

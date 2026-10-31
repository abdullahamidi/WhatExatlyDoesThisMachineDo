// WP28 Finds (D3). Pure data: the Find clock's numbers (simulation/finds.ts only does arithmetic with them), the relic
// notes and the few strings the app chunk needs. The marker's art map, layout and player text live in ./findWorld:
// only the lazy WorldReach chunk reads them there.

export const FINDS = {
  unlockTech: 'wornMotor', intervalS: [45, 120], windowS: 25, firstAfterS: 120, payoutS: 6, relicEvery: 5,  // balance (P8)
  payoutSpreadS: [-2, 0, 2], paySeedXor: 0x5bd1e995,   // Q6: each Find pays payoutS + one of these, equal weight; pay stream = seed ^ paySeedXor
  maxStepS: 0.25,                                       // frame clamp for the live clock: GameSession.stepFinds only
  seed: 28, catchSeedMul: 7919, catchSeedAdd: 13,       // greedy sims only: Find rng seed and catch rng seed (audit harness parity)
  // Live play only: the default Find seed is the clock ms XOR seedSalt, so the Find stream never equals the fault stream
  // (both would otherwise start from the same ms and move in lockstep).
  seedSalt: 0x2f6e2b1d,
} as const;

/** One field note: the era it belongs to (a relic found in that era or later) and its text. */
export interface RelicNote {
  era: 1 | 2 | 3 | 4 | 5;
  text: string;
}

// Planner drafts (WP28 Relic notes table), in this order. Each is at most 52 characters.
export const RELIC_NOTES: readonly RelicNote[] = [
  { era: 1, text: 'Bread, lamp oil, string. Ask about the dog.' },
  { era: 1, text: 'Clock on the corner stopped at 4:41 again.' },
  { era: 1, text: 'Wind from the west. Nothing else to report.' },
  { era: 2, text: 'Line four dead since noon. It still rings.' },
  { era: 2, text: 'Do not stand under the wires when they hum.' },
  { era: 2, text: 'Bulbs: six. Fuses: none. Ask at the shop.' },
  { era: 3, text: 'Boil all water. Notice to every household.' },
  { era: 3, text: 'Fog on the coats again. Leave them by the door.' },
  { era: 3, text: 'The pump coughs at the same hour every day.' },
  { era: 4, text: 'We all hummed one note at supper. Nobody began it.' },
  { era: 4, text: 'Glasses rang on the shelf all night. None broke.' },
  { era: 4, text: 'Choir practice, Tuesday. Same hymn as last week.' },
  { era: 5, text: 'The stones on the path were higher this morning.' },
  { era: 5, text: 'Dropped the keys. They did not land.' },
  { era: 5, text: 'If found, leave it by the payphone.' },
];

export const FIND_TEXT = {
  key: '[G]',
  relicTitle: 'FIELD NOTE {n}/{total}',
  blankTitle: 'FIELD NOTE',
  blankPage: 'A page. Blank on both sides.',
  notesTitle: 'FIELD NOTES',
} as const;

/** Relics on the list up to and including maxEra (null: every note). */
export function relicTotal(maxEra: number | null): number {
  if (maxEra === null) return RELIC_NOTES.length;
  return RELIC_NOTES.filter((n) => n.era <= maxEra).length;
}

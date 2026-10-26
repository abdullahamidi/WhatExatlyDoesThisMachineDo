// HUD copy (WP17). Pure data. Titles are shown on the HUD title row and stay within 26 characters.
// The middle dot is U+00B7; the feeds prefix is U+203A.

export const HUD_TEXT = {
  eraTitles: ['ERA I · MECHANICAL', 'ERA II · ELECTRICAL', 'ERA III · PRESSURE', 'ERA IV · RESONANCE', 'ERA V · ???'],
  eraFiveRevealed: 'ERA V · RESTORATION FLUX', restored: 'RESTORATION ENGINE',
  clickLabel: 'CLICK', autoCrank: 'AUTO-CRANK', feedsPrefix: '›',
  viewMachine: 'VIEW MACHINE', viewMachineTitle: 'View the whole machine (photo mode)',
  // WP25 C4: click worth in seconds of machine output, and the auto-crank output suffix.
  worthSep: ' · ', clickWorth: '{s}s', clickWorthTitle: 'One turn of the crank = {s} s of machine output',
  worthFloor: '<0.01',
  autoCrankOutput: '+{v} {res}/s',
} as const;

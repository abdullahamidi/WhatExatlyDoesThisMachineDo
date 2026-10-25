import { describe, it, expect } from 'vitest';
import { TECHNOLOGIES } from './technologies';
import { INSTALL_LINES } from './notifications';
import { SYSTEM_LOGS } from './systemLogs';
import { ACHIEVEMENTS } from './achievements';
import { TIER_SWEEP } from './machineTiers';
import { WORLD_SWEEP_EXPANDED } from './worldSweep';

// WP20 text sweep over the data tables. Player-facing copy uses the typographic
// multiplier (×5, not x5), the ellipsis character (…) and US spelling.

interface SweepEntry {
  where: string;
  text: string;
}

// Every player-facing string the data tables own. `where` names the entry in failures.
function sweepEntries(): SweepEntry[] {
  const entries: SweepEntry[] = [];
  for (const [id, tech] of Object.entries(TECHNOLOGIES)) {
    entries.push({ where: `${id}.description`, text: tech.description });
    if (tech.flavor !== undefined) entries.push({ where: `${id}.flavor`, text: tech.flavor });
  }
  for (const [id, text] of Object.entries(INSTALL_LINES)) entries.push({ where: `INSTALL_LINES.${id}`, text });
  for (const log of SYSTEM_LOGS) entries.push({ where: `SYSTEM_LOGS.${log.id}`, text: log.text });
  for (const [id, def] of Object.entries(ACHIEVEMENTS)) {
    entries.push({ where: `${id}.name`, text: def.name });
    entries.push({ where: `${id}.description`, text: def.description });
  }
  entries.push(...TIER_SWEEP);
  entries.push(...WORLD_SWEEP_EXPANDED);
  return entries;
}

// "where: text" for every entry matching the pattern, so a failing assertion names the string.
function offenders(pattern: RegExp): string[] {
  return sweepEntries()
    .filter((entry) => pattern.test(entry.text))
    .map((entry) => `${entry.where}: ${entry.text}`);
}

describe('player-facing text sweep (WP20)', () => {
  it('covers the full text set', () => {
    expect(sweepEntries().length).toBeGreaterThan(150);
  });

  it('has no typographic x multiplier such as " x5"', () => {
    expect(offenders(/(^|[\s(])x\d/)).toEqual([]);
  });

  it('has no three-dot ellipsis', () => {
    expect(offenders(/\.\.\./)).toEqual([]);
  });

  it('uses US spelling', () => {
    expect(offenders(/recognis|centre|colour|behaviour|favour/i)).toEqual([]);
  });

  it('keeps the servo chorus requirement at level 9 and says so', () => {
    expect(ACHIEVEMENTS.servoChorus.condition).toEqual({ type: 'tech', id: 'crankServo', minLevel: 9 });
    expect(ACHIEVEMENTS.servoChorus.description).toContain('level 9 of 10');
  });

  it('keeps the system log tokens and US spelling', () => {
    expect(SYSTEM_LOGS.find((log) => log.id === 'cycle-0041')?.text).toBe('Cycle {cycle} nearly complete.');
    expect(SYSTEM_LOGS.find((log) => log.id === 'units-unknown')?.text).toBe('Units not recognized. Continuing.');
  });

  // WP20: install lines that repeat a flavor must stay identical to it.
  it('keeps the substation install line identical to its flavor', () => {
    expect(INSTALL_LINES.substationBlueprint).toBe(TECHNOLOGIES.substationBlueprint.flavor);
    expect(INSTALL_LINES.substationBlueprint).toBe('Grid handshake… no response from grid.');
  });

  it('keeps the generator blueprint install line identical to its flavor', () => {
    expect(INSTALL_LINES.generatorBlueprint).toBe(TECHNOLOGIES.generatorBlueprint.flavor);
    expect(INSTALL_LINES.generatorBlueprint).toBe('Primary function: UNKNOWN.');
  });
});

// WP23b (bible §5.3): every living-world output for cycles 1-99, checked on the expanded text the player reads.
describe('living world expanded text (WP23b)', () => {
  // "where: text" for every expanded output matching the predicate, so a failing assertion names the line and cycle.
  const worldOffenders = (failing: (text: string) => boolean): string[] =>
    WORLD_SWEEP_EXPANDED.filter((entry) => failing(entry.text)).map((entry) => `${entry.where}: ${entry.text}`);

  // Longest expanded output of one token line over its cycles.
  const longestOf = (id: string): number =>
    Math.max(...WORLD_SWEEP_EXPANDED.filter((entry) => entry.where.startsWith(`WORLD_LINES.${id}@c`)).map((e) => e.text.length));

  it('expands each token line once per cycle from 1 to 99', () => {
    for (const id of ['CRW-05', 'CRW-09', 'GRL-12', 'PAY-14']) {
      expect(WORLD_SWEEP_EXPANDED.filter((entry) => entry.where.startsWith(`WORLD_LINES.${id}@c`))).toHaveLength(99);
    }
  });

  it('keeps every expanded output at 52 characters or fewer', () => {
    expect(worldOffenders((text) => text.length > 52)).toEqual([]);
  });

  it('ends every expanded output in . ? or an ellipsis', () => {
    expect(worldOffenders((text) => !/[.?…]$/.test(text))).toEqual([]);
  });

  it('has no exclamation mark and no three-dot ellipsis in any expanded output', () => {
    expect(worldOffenders((text) => /!|\.\.\./.test(text))).toEqual([]);
  });

  it('never matches /restor/i before the finale', () => {
    expect(worldOffenders((text) => /restor/i.test(text))).toEqual([]);
  });

  it('keeps the longest token outputs within their bounds (GRL-12, CRW-05, PAY-14)', () => {
    expect(longestOf('GRL-12')).toBeLessThanOrEqual(40);
    expect(longestOf('CRW-05')).toBeLessThanOrEqual(45);
    expect(longestOf('PAY-14')).toBeLessThanOrEqual(46);
  });
});

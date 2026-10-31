import { describe, it, expect } from 'vitest';
import { TECH_IDS } from './types';
import type { Effect, Requirement, ResourceId, TechDefinition, TechId } from './types';
import { SPLICE_TECHS } from './splices';
import type { SpliceId } from './splices';
import { TECHNOLOGIES } from './technologies';
import { INSTALL_LINES } from './notifications';
import { SYSTEM_LOG_CUT } from './systemLogs';
import { ECON_REVISION, SPLIT_PARTS } from './pacing';

// WP28 Splices (D2): the 16 one-time unlocks, their wake lines and their text. The rows below pin the table of
// docs/plan/WP28.md ("Splices" > Table and Text); a change to a Splice must change this file on purpose.

// App. B text rules. PRE_BAN and YOU are copied verbatim from src/data/livingWorld.test.ts (bible validator).
const PRE_BAN = /restor|prior|rewind|undo|\bheal|repair|as it was|back the way|record|hold.{0,24}run|while it runs|running|keep it|\becho|memory|\bcycle\b|wishlist|\bsteam\b|full game|trailer|tutorial/i;
const YOU = /\b(you|your|you're|you've|yours)\b/i;
const BRITISH = /programme|colour|grey|metre|centre|catalogue/i;

type Era = 1 | 2 | 3 | 4 | 5;

// Era keystone and era energy (the builder's rules, pinned here).
const KEYSTONE_OF: Record<Era, TechId> = { 1: 'handCrank', 2: 'generator', 3: 'boiler', 4: 'resonatorSpire', 5: 'nullChamber' };
const ENERGY_OF: Record<Era, ResourceId> = { 1: 'me', 2: 'ee', 3: 'pr', 4: 'rs', 5: 'xf' };

interface Row {
  id: SpliceId;
  name: string;
  era: Era;
  costRes: ResourceId;
  cost: number;
  effects: Effect[];
  lifetime: number;
  description: string;
  wake: string;
  extra?: Requirement[];
}

const ROWS: Row[] = [
  {
    id: 'spliceBicycle', name: 'Bicycle', era: 1, costRes: 'me', cost: 900, effects: [{ type: 'autoPct', percent: 5, res: 'me' }], lifetime: 15000,
    description: 'A line to the bicycle. The back wheel turns backwards. +5% automation.',
    wake: 'Line spliced. Wheel turning. Direction disputed.',
  },
  {
    id: 'spliceOrgan', name: 'Barrel Organ', era: 1, costRes: 'me', cost: 12000, effects: [{ type: 'findSeconds', seconds: 1 }], lifetime: 120000,
    description: 'A line to the barrel organ. It plays three notes short. Finds pay +1s.',
    wake: 'Line spliced. Organ playing. Last bars missing.',
  },
  {
    id: 'spliceClock', name: 'Street Clock', era: 1, costRes: 'me', cost: 10000, effects: [{ type: 'autoPct', percent: 5, res: 'me' }], lifetime: 450000,
    description: 'A line to the street clock. Its hand ticks once. +5% automation.',
    wake: 'Line spliced. Clock face lit. Time unchanged.',
  },
  {
    id: 'spliceRadio', name: 'Radio', era: 2, costRes: 'me', cost: 270000, effects: [{ type: 'autoPct', percent: 5, res: 'ee' }], lifetime: 200000,
    description: 'A line to a valve radio. It finds a station. +5% EE production.',
    wake: 'Line spliced. Carrier found. Program not found.',
  },
  {
    id: 'splicePayphone', name: 'Payphone', era: 2, costRes: 'ee', cost: 130000, effects: [{ type: 'faultWindow', seconds: 2 }], lifetime: 2000000,
    description: 'A line to the payphone. It rings with no one on it. Faults last +2s.',
    wake: 'Line spliced. Line open. Caller not found.',
  },
  {
    id: 'spliceSign', name: 'Bulb Sign', era: 2, costRes: 'me', cost: 2300000, effects: [{ type: 'autoPct', percent: 5, res: 'ee' }], lifetime: 3000000,
    description: 'A line to a bulb sign. Half its bulbs buzz. +5% EE production.',
    wake: 'Line spliced. Bulbs lit: half. Message: none.',
  },
  {
    id: 'splicePump', name: 'Hand Pump', era: 3, costRes: 'ee', cost: 250000, effects: [{ type: 'autoPct', percent: 5, res: 'pr' }], lifetime: 100000,
    description: 'A line to the hand pump. The handle works itself. +5% PR production.',
    wake: 'Line spliced. Pump primed. Output: cough.',
  },
  {
    id: 'spliceWhistle', name: 'Factory Whistle', era: 3, costRes: 'me', cost: 6500000, effects: [{ type: 'findRate', factor: 0.85 }], lifetime: 2500000,
    description: 'The factory whistle blows at the wrong hour. Finds come 15% sooner.',
    wake: 'Line spliced. Shift whistle sounding. Shift not found.',
  },
  {
    id: 'spliceHydrant', name: 'Hydrant', era: 3, costRes: 'ee', cost: 650000, effects: [{ type: 'autoPct', percent: 5, res: 'pr' }], lifetime: 9000000,
    description: 'A line to the hydrant. The cap rattles. +5% PR production.',
    wake: 'Line spliced. Pressure at the cap. Water declined.',
  },
  {
    id: 'spliceBell', name: 'Bell', era: 4, costRes: 'pr', cost: 630000, effects: [{ type: 'autoPct', percent: 5, res: 'rs' }], lifetime: 2000000,
    description: 'A line to the bell. It swings, never all the way. +5% RS production.',
    wake: 'Line spliced. Bell swinging. Peak not reached.',
  },
  {
    id: 'spliceGramophone', name: 'Gramophone', era: 4, costRes: 'me', cost: 12000000, effects: [{ type: 'windup', seconds: 0.1, refill: 0.01 }], lifetime: 12000000,
    description: 'The gramophone needle skips. +0.1s wind-up, +0.01s/s refill.',
    wake: 'Line spliced. Disc turning. Groove skipping.',
  },
  {
    id: 'spliceChimes', name: 'Wind Chimes', era: 4, costRes: 'pr', cost: 1400000, effects: [{ type: 'faultSeconds', seconds: 2 }], lifetime: 32000000,
    description: 'A line to the chimes. They ring with no wind. Cleared faults pay +2s.',
    wake: 'Line spliced. Chimes ringing. Wind: none.',
  },
  {
    id: 'spliceVane', name: 'Weathervane', era: 5, costRes: 'rs', cost: 2100000, effects: [{ type: 'autoPct', percent: 5, res: 'xf' }], lifetime: 1000000,
    description: 'A line to the weathervane. It stops pointing down. +5% ??? production.',
    wake: 'Line spliced. Vane turning. Heading: down.',
  },
  {
    id: 'spliceKite', name: 'Kite', era: 5, costRes: 'me', cost: 15000000, effects: [{ type: 'findSeconds', seconds: 1 }], lifetime: 8000000,
    description: 'A line to the kite on the lamp. It rises with no wind. Finds pay +1s.',
    wake: 'Line spliced. Kite rising. Wind: none.',
  },
  {
    id: 'spliceCairn', name: 'Cairn', era: 5, costRes: 'ee', cost: 9500000, effects: [{ type: 'autoPct', percent: 5, res: 'xf' }], lifetime: 23000000,
    description: 'A line to a cairn. The stones lift, one by one. +5% ??? production.',
    wake: 'Line spliced. Stones lifting. Weight unknown.',
  },
  {
    id: 'spliceCoinReturn', name: 'Coin Return', era: 5, costRes: 'me', cost: 64000000, effects: [{ type: 'autoPct', percent: 5, res: 'xf' }], lifetime: 130000000,
    description: 'A second line to the payphone. The return rattles. +5% ??? production.',
    wake: 'Second line spliced. Coin return active. Coins: none.',
    extra: [{ type: 'tech', id: 'splicePayphone', minLevel: 1 }],
  },
];

const SPLICE_ORDER: readonly SpliceId[] = ROWS.map((r) => r.id);

// The expected definition of one row, built from the rule (keystone, era energy, extra requirements).
const expectedDef = (r: Row): TechDefinition => ({
  id: r.id,
  name: r.name,
  kind: 'unlock',
  branch: 'splice',
  era: r.era,
  costRes: r.costRes,
  baseCost: r.cost,
  growth: null,
  maxLevel: null,
  effects: r.effects,
  requires: [
    { type: 'tech', id: KEYSTONE_OF[r.era], minLevel: 1 },
    { type: 'lifetime', res: ENERGY_OF[r.era], amount: r.lifetime },
    ...(r.extra ?? []),
  ],
  description: r.description,
  tree: { col: 0, row: 0 },
});

// Every player-facing string a Splice owns: name, description, wake line, plus the SYS LOG cut line.
function spliceTexts(): { where: string; text: string }[] {
  const entries = SPLICE_ORDER.flatMap((id) => [
    { where: `${id}.name`, text: SPLICE_TECHS[id].name },
    { where: `${id}.description`, text: SPLICE_TECHS[id].description },
    { where: `INSTALL_LINES.${id}`, text: INSTALL_LINES[id] },
  ]);
  entries.push({ where: 'SYSTEM_LOG_CUT', text: SYSTEM_LOG_CUT.text });
  return entries;
}

// "where: text" for every Splice string matching the pattern, so a failing assertion names the string.
function offenders(pattern: RegExp): string[] {
  return spliceTexts()
    .filter((entry) => pattern.test(entry.text))
    .map((entry) => `${entry.where}: ${entry.text}`);
}

describe('Splice ids and table order (WP28 C1)', () => {
  it('appends the 16 Splices after overrunClutch, in table order, for 71 techs in all', () => {
    expect(TECH_IDS).toHaveLength(71);
    expect(new Set(TECH_IDS).size).toBe(71);
    expect(TECH_IDS[54]).toBe('overrunClutch');
    expect(TECH_IDS.slice(55)).toEqual(SPLICE_ORDER);
  });

  it('keys the Splice table by exactly the 16 ids in order', () => {
    expect(Object.keys(SPLICE_TECHS)).toEqual([...SPLICE_ORDER]);
  });

  it('merges every Splice into TECHNOLOGIES unchanged, and every tech has an install line', () => {
    expect(Object.keys(TECHNOLOGIES)).toHaveLength(71);
    expect(Object.keys(INSTALL_LINES)).toHaveLength(71);
    for (const id of SPLICE_ORDER) expect(TECHNOLOGIES[id]).toBe(SPLICE_TECHS[id]);
  });
});

describe('Splice rows (WP28 Table)', () => {
  it.each(ROWS)('$id has the planned kind, branch, tree, growth, era, cost and requirements', (row) => {
    expect(SPLICE_TECHS[row.id]).toEqual(expectedDef(row));
  });

  it.each(ROWS)('$id has no flavor text and no repeat growth', (row) => {
    const def = SPLICE_TECHS[row.id];
    expect(def.flavor).toBeUndefined();
    expect(def.kind).toBe('unlock');
    expect(def.branch).toBe('splice');
    expect(def.tree).toEqual({ col: 0, row: 0 });
    expect(def.growth).toBeNull();
    expect(def.maxLevel).toBeNull();
  });

  it('gates the Coin Return on the Payphone as well as the era keystone and energy', () => {
    expect(SPLICE_TECHS.spliceCoinReturn.requires).toEqual([
      { type: 'tech', id: 'nullChamber', minLevel: 1 },
      { type: 'lifetime', res: 'xf', amount: 130000000 },
      { type: 'tech', id: 'splicePayphone', minLevel: 1 },
    ]);
  });

  it('gates every other Splice on its keystone and lifetime only', () => {
    for (const id of SPLICE_ORDER.filter((x) => x !== 'spliceCoinReturn')) {
      expect(SPLICE_TECHS[id].requires).toHaveLength(2);
    }
  });
});

describe('Splice wake lines (INSTALL_LINES)', () => {
  it.each(ROWS)('$id shows its planned wake line', (row) => {
    expect(INSTALL_LINES[row.id]).toBe(row.wake);
  });

  it('keeps every wake line unique', () => {
    const lines = SPLICE_ORDER.map((id) => INSTALL_LINES[id]);
    expect(new Set(lines).size).toBe(16);
  });

  it('keeps every wake line at 60 characters or fewer', () => {
    expect(SPLICE_ORDER.filter((id) => INSTALL_LINES[id].length > 60)).toEqual([]);
  });

  it('starts every wake line with the shared prefix; the Coin Return says second line', () => {
    const plain = SPLICE_ORDER.filter((id) => id !== 'spliceCoinReturn');
    for (const id of plain) expect(INSTALL_LINES[id].startsWith('Line spliced. ')).toBe(true);
    expect(INSTALL_LINES.spliceCoinReturn.startsWith('Second line spliced. ')).toBe(true);
  });
});

describe('Splice text lint (WP28 Text; STORY_BIBLE 2.4 bans)', () => {
  it('has no exclamation mark', () => {
    expect(offenders(/!/)).toEqual([]);
  });

  it('has no three-dot ellipsis', () => {
    expect(offenders(/\.\.\./)).toEqual([]);
  });

  it('keeps every Splice description at 70 characters or fewer', () => {
    expect(SPLICE_ORDER.filter((id) => SPLICE_TECHS[id].description.length > 70)).toEqual([]);
  });

  it('never says you', () => {
    expect(offenders(YOU)).toEqual([]);
  });

  it('matches no bible ban (PRE_BAN)', () => {
    expect(offenders(PRE_BAN)).toEqual([]);
  });

  it('uses US spelling', () => {
    expect(offenders(BRITISH)).toEqual([]);
  });
});

describe('pacing data and SYS LOG cut line (WP28 C1, C2)', () => {
  it('holds the econ revision 28', () => {
    expect(ECON_REVISION).toBe(28);
  });

  it('splits 17 tracks into 2 or 3 parts, every id a real tech', () => {
    const parts: Partial<Record<TechId, number>> = SPLIT_PARTS;
    const ids = Object.keys(parts) as TechId[];
    expect(ids).toHaveLength(17);
    for (const id of ids) {
      expect(TECH_IDS).toContain(id);
      expect([2, 3]).toContain(parts[id]);
    }
  });

  it('keeps the SYS LOG cut line in the machine voice with the {n} token', () => {
    expect(SYSTEM_LOG_CUT.id).toBe('splice-cut');
    expect(SYSTEM_LOG_CUT.text).toBe('Lines cut: {n}. Objects dark again.');
  });
});

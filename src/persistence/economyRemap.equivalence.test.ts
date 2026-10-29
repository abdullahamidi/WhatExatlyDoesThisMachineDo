// WP28 save equivalence (Director answer Q4; Pacing set REC, P6). A v0.11.0 save (version 2, no `econ` marker) loads onto the
// same machine: the same visible part tiers, the same per-second output within a tolerance, and a remapped save is never
// remapped twice. The five era snapshots come from the real greedy (profile A, REC data). Each snapshot is turned back into
// v0.11.0 levels (split ids: floor(level / parts); Splices did not exist in v0.11.0 and load at 0), written as a v0.11.0
// envelope and loaded through the real deserialize.
//
// Tolerances: 1 % at the generator snapshot (era I-II), 3 % at the later ones. The 3 % is the REC per-level rounding (the
// per-level effect times parts against the v0.11.0 effect): bellowsDrive and gridExciter autoPct 2.5 vs 8 / 3, inductionHeater
// autoAdd 0.65 vs 1.9 / 3, resonantSiphon autoAdd 0.37 vs 1.1 / 3 and autoPct 1.7 vs 5 / 3, graviticAnchor rateMult 1.05 per level
// (squared, 1.1025) vs 1.1. A bigger drift is a data error: stop and report it.
import { describe, it, expect } from 'vitest';
import { PART_TIERS } from '../data/machineTiers';
import { ECON_REVISION, SPLIT_PARTS } from '../data/pacing';
import { TECHNOLOGIES } from '../data/technologies';
import { RESOURCE_IDS, TECH_IDS } from '../data/types';
import type { Effect, GameState, TechDefinition, TechId } from '../data/types';
import { tierOf } from '../game/math/partTiers';
import { computeRates } from '../simulation/production/rates';
import { runGreedy } from '../simulation/sim/greedy';
import { emptyResourceMap } from '../simulation/resources';
import { createInitialState, DEFAULT_SETTINGS } from '../simulation/state';
import { deserialize, serialize } from './codec';

/** Era snapshots (profile A): the state right after the step each tech is first owned. generator opens era II. */
const SNAPSHOTS = ['generator', 'boiler', 'resonatorSpire', 'nullChamber', 'skyAperture'] as const;

/** Relative tolerance on perSecond per snapshot: 1 % for era I-II (generator), 3 % for the later eras (the REC rounding). */
function toleranceOf(snapshot: string): number {
  return snapshot === 'generator' ? 0.01 : 0.03;
}

// v0.11.0 maxLevel and effects of the 17 split tracks (technologies.ts before WP28). Costs and requirements do not reach computeRates.
const V011: Readonly<Record<string, { maxLevel: number | null; effects: readonly Effect[] }>> = {
  copperWinding: { maxLevel: 25, effects: [{ type: 'convert', amount: 0.068, res: 'ee' }] },
  motorRetrofit: { maxLevel: 20, effects: [{ type: 'autoAdd', amount: 50, res: 'me' }] },
  transformer: { maxLevel: 20, effects: [{ type: 'autoPct', percent: 15, res: 'ee' }] },
  firebox: { maxLevel: 25, effects: [{ type: 'convert', amount: 0.059, res: 'pr' }] },
  inductionHeater: { maxLevel: 20, effects: [{ type: 'autoAdd', amount: 1.9, res: 'pr' }] },
  condenser: { maxLevel: 20, effects: [{ type: 'autoPct', percent: 15, res: 'pr' }] },
  bellowsDrive: { maxLevel: null, effects: [{ type: 'autoPct', percent: 8, res: 'pr' }] },
  harmonicCoil: { maxLevel: 25, effects: [{ type: 'convert', amount: 0.22, res: 'rs' }] },
  pressureResonator: { maxLevel: 20, effects: [{ type: 'autoAdd', amount: 6.9, res: 'rs' }] },
  standingWave: { maxLevel: 20, effects: [{ type: 'autoPct', percent: 15, res: 'rs' }] },
  gridExciter: { maxLevel: null, effects: [{ type: 'autoPct', percent: 8, res: 'rs' }] },
  containmentRing: { maxLevel: 25, effects: [{ type: 'convert', amount: 0.027, res: 'xf' }] },
  resonantSiphon: { maxLevel: 20, effects: [{ type: 'autoAdd', amount: 1.1, res: 'xf' }, { type: 'autoPct', percent: 5, res: 'xf' }] },
  graviticAnchor: { maxLevel: 10, effects: [{ type: 'rateMult', factor: 1.1, res: 'all' }] },
  horizonField: { maxLevel: 20, effects: [{ type: 'autoPct', percent: 15, res: 'xf' }] },
  mainsBackfeed: { maxLevel: null, effects: [{ type: 'autoPct', percent: 6, res: 'xf' }] },
  steamLance: { maxLevel: null, effects: [{ type: 'autoPct', percent: 6, res: 'xf' }] },
};

// v0.11.0 PART_TIERS level lists of the 16 part tracks (horizonField has no track).
const V011_TIERS: Readonly<Record<string, readonly number[]>> = {
  copperWinding: [1, 5, 10, 20, 25],
  motorRetrofit: [1, 4, 8, 13, 18],
  transformer: [1, 4, 8, 13, 20],
  firebox: [1, 5, 10, 20, 25],
  inductionHeater: [1, 4, 8, 13, 20],
  condenser: [1, 4, 8, 13, 20],
  bellowsDrive: [1, 2, 3],
  harmonicCoil: [1, 4, 8, 16, 25],
  pressureResonator: [1, 4, 8, 13, 18],
  standingWave: [1, 4, 8, 13, 20],
  gridExciter: [1, 7, 14],
  containmentRing: [1, 4, 8, 16, 25],
  resonantSiphon: [1, 5, 10],
  graviticAnchor: [1, 2, 3],
  mainsBackfeed: [1, 4, 7],
  steamLance: [1, 7, 12],
};

const SPLIT_IDS: readonly TechId[] = Object.keys(V011) as TechId[];
const SPLICE_IDS: readonly TechId[] = TECH_IDS.filter((id) => TECHNOLOGIES[id].branch === 'splice');

function partsOf(id: TechId): number {
  return (SPLIT_PARTS as Partial<Record<string, number>>)[id] ?? 1;
}

function isSplit(id: TechId): boolean {
  return Object.hasOwn(SPLIT_PARTS, id);
}

/** The v0.11.0 techs: the current data with the 17 split tracks' old maxLevel and effects. */
const OLD_TECHS: Record<TechId, TechDefinition> = structuredClone(TECHNOLOGIES);
for (const id of SPLIT_IDS) {
  const old = V011[id];
  if (old === undefined) throw new Error(`no v0.11.0 data for ${id}`);
  OLD_TECHS[id] = { ...TECHNOLOGIES[id], maxLevel: old.maxLevel, effects: [...old.effects] };
}

/** v0.11.0 levels of a snapshot: split ids floor(level / parts), Splices 0, every other id as it is. */
function oldLevelsOf(levels: Readonly<Record<TechId, number>>): Record<TechId, number> {
  const out = {} as Record<TechId, number>;
  for (const id of TECH_IDS) {
    if (SPLICE_IDS.includes(id)) out[id] = 0;
    else out[id] = isSplit(id) ? Math.floor(levels[id] / partsOf(id)) : levels[id];
  }
  return out;
}

/** A v0.11.0 save text: version 2, no `econ` marker, every resource at 1e12. */
function v011Save(levels: Readonly<Record<TechId, number>>): string {
  const base = createInitialState(0);
  const res = emptyResourceMap();
  const lifetime = emptyResourceMap();
  for (const id of RESOURCE_IDS) {
    res[id] = 1e12;
    lifetime[id] = 1e12;
  }
  const state: GameState = { ...base, res, lifetime, techLevels: { ...levels } };
  return JSON.stringify({ version: 2, savedAt: 0, state, settings: DEFAULT_SETTINGS });
}

let snapshotCache: Map<string, Record<TechId, number>> | null = null;

/** The five era snapshots of the real greedy (profile A, 17400 s, REC data), keyed by tech. Run once per file. */
function eraSnapshots(): Map<string, Record<TechId, number>> {
  if (snapshotCache !== null) return snapshotCache;
  const run = runGreedy({ seconds: 17400, clicksPerSecond: 4, stepSeconds: 1, buyIntervalSeconds: 1, snapshotAt: SNAPSHOTS });
  const out = new Map<string, Record<TechId, number>>();
  for (const id of SNAPSHOTS) {
    const snap = run.snapshots?.[id];
    if (snap === undefined) throw new Error(`no ${id} snapshot within 17400 s`);
    out.set(id, { ...snap.techLevels });
  }
  snapshotCache = out;
  return out;
}

interface Case {
  snapshot: string;
  old: Record<TechId, number>;
  status: string;
  state: GameState;
}

let caseCache: Case[] | null = null;

/** Each snapshot written as a v0.11.0 save and loaded through deserialize. */
function allCases(): Case[] {
  if (caseCache !== null) return caseCache;
  const out: Case[] = [];
  for (const [snapshot, levels] of eraSnapshots()) {
    const old = oldLevelsOf(levels);
    const loaded = deserialize(v011Save(old), 0);
    out.push({ snapshot, old, status: loaded.status, state: loaded.state });
  }
  caseCache = out;
  return out;
}

function clampTo(max: number | null, value: number): number {
  return max === null ? value : Math.min(max, value);
}

function relDiff(was: number, now: number): number {
  if (was === 0) return now === 0 ? 0 : Number.POSITIVE_INFINITY;
  return Math.abs(now - was) / Math.abs(was);
}

describe('v0.11.0 saves load onto the same machine (WP28 Q4, P6)', () => {
  it('the five era snapshots exist and the v0.11.0 table holds the 17 split ids', () => {
    expect(eraSnapshots().size).toBe(SNAPSHOTS.length);
    expect([...SPLIT_IDS].sort()).toEqual(Object.keys(SPLIT_PARTS).sort());
  });

  it('each v0.11.0 save loads as loaded: split levels are old x parts (clamped), every other tech is unchanged', () => {
    for (const c of allCases()) {
      expect(c.status, c.snapshot).toBe('loaded');
      for (const id of TECH_IDS) {
        const expected = isSplit(id) ? clampTo(TECHNOLOGIES[id].maxLevel, c.old[id] * partsOf(id)) : c.old[id];
        expect(c.state.techLevels[id], `${c.snapshot} ${id}`).toBe(expected);
      }
    }
  });

  it('the part tier of every old level is the same after the remap, for all 16 part tracks (exact)', () => {
    const mismatches: string[] = [];
    for (const [id, oldLevels] of Object.entries(V011_TIERS)) {
      const track = PART_TIERS.find((t) => t.techId === id);
      if (track === undefined) {
        mismatches.push(`no track ${id}`);
        continue;
      }
      const cap = Math.min(V011[id]?.maxLevel ?? 60, 60);
      for (let level = 0; level <= cap; level++) {
        const now = tierOf(partsOf(id as TechId) * level, track.levels);
        const then = tierOf(level, oldLevels);
        if (now !== then) mismatches.push(`${id} L${level}: ${now} vs ${then}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('per-second output matches v0.11.0: within 1 % at the generator snapshot (era I-II), 3 % at the later eras', () => {
    const rows: string[] = ['| snapshot | resource | v0.11.0 /s | loaded /s | diff % |', '| --- | --- | --- | --- | --- |'];
    const failures: string[] = [];
    for (const c of allCases()) {
      const was = computeRates({ techLevels: c.old }, OLD_TECHS).perSecond;
      const now = computeRates(c.state, TECHNOLOGIES).perSecond;
      for (const r of RESOURCE_IDS) {
        const diff = relDiff(was[r], now[r]);
        rows.push(`| ${c.snapshot} | ${r} | ${was[r].toPrecision(4)} | ${now[r].toPrecision(4)} | ${(diff * 100).toFixed(2)} |`);
        if (diff > toleranceOf(c.snapshot)) failures.push(`${c.snapshot} ${r}: ${(diff * 100).toFixed(2)} %`);
      }
    }
    console.info(`WP28 save equivalence (v0.11.0 saves on REC data)\n${rows.join('\n')}`);
    expect(failures).toEqual([]);
  });

  it('a remapped save is not remapped twice: serialize, then deserialize, keeps the same levels', () => {
    for (const c of allCases()) {
      const text = serialize(c.state, DEFAULT_SETTINGS, 0);
      const envelope = JSON.parse(text) as { econ?: unknown };
      expect(envelope.econ, c.snapshot).toBe(ECON_REVISION);
      const again = deserialize(text, 0);
      expect(again.status, c.snapshot).toBe('loaded');
      expect(again.state.techLevels, c.snapshot).toEqual(c.state.techLevels);
    }
  });
});

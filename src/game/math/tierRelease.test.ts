import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import type { MachineComponentId } from '../../data/machineComponents';
import { PART_TIER_FX } from '../../data/machineTiers';
import type { TechId } from '../../data/types';
import type { TierChange } from './partTiers';
import { planTierRelease } from './tierRelease';
import type { TierReleaseInput, TierReleasePlan } from './tierRelease';

const SOURCE_URL = new URL('./tierRelease.ts', import.meta.url);

type Levels = Readonly<Partial<Record<TechId, number>>>;

const yes = (): boolean => true;
const no = (): boolean => false;

/** Predicate true for the listed hosts only. */
const listed = (...hosts: readonly MachineComponentId[]): ((host: MachineComponentId) => boolean) => (host) => hosts.includes(host);

/** Predicate false for the listed hosts only (every other host is true). */
const unlisted = (...hosts: readonly MachineComponentId[]): ((host: MachineComponentId) => boolean) => (host) => !hosts.includes(host);

/** A release with every host visible and settled unless overridden. */
function plan(prevLevels: Levels, nextLevels: Levels, over: Partial<Omit<TierReleaseInput, 'prevLevels' | 'nextLevels'>> = {}): TierReleasePlan {
  return planTierRelease({ prevLevels, nextLevels, visible: yes, settled: yes, ...over });
}

/** Motor tuning crossing 1 to 2 (levels 4 to 5): both host swap, rust debris. */
const MOTOR_T2: TierChange = { techId: 'motorTuning', from: 1, to: 2, top: 5, hosts: ['wornMotor', 'motorPlinth'], debris: 'rust', staged: false };

/** Motor tuning crossing 1 to 5 (levels 4 to 25): one change, mote debris. */
const MOTOR_T5: TierChange = { techId: 'motorTuning', from: 1, to: 5, top: 5, hosts: ['wornMotor', 'motorPlinth'], debris: 'mote', staged: false };

/** Six tier-1-to-2 crossings in one release (levels in brackets): gearRatio 5 to 6, flywheel 3 to 4, motorTuning 4 to 5,
 *  improvedPistons 4 to 5, copperWinding 8 to 9, transformer 6 to 7 (the REC part thresholds). */
const BURST_PREV: Levels = { gearRatio: 5, flywheel: 3, motorTuning: 4, improvedPistons: 4, copperWinding: 8, transformer: 6 };
const BURST_NEXT: Levels = { gearRatio: 6, flywheel: 4, motorTuning: 5, improvedPistons: 5, copperWinding: 9, transformer: 7 };

describe('planTierRelease: one crossing', () => {
  it('motorTuning 4 to 5 with everything settled: one beat on wornMotor, nothing else', () => {
    const p = plan({ motorTuning: 4 }, { motorTuning: 5 });
    expect(p.beats).toEqual([{ change: MOTOR_T2, primary: 'wornMotor' }]);
    expect(p.instant).toEqual([]);
    expect(p.staged).toEqual([]);
    expect(p.torques).toEqual([]);
  });

  it('motorTuning 5 to 6 (no tier change): no beat, one torque tick on wornMotor at step 1', () => {
    const p = plan({ motorTuning: 5 }, { motorTuning: 6 });
    expect(p.beats).toEqual([]);
    expect(p.instant).toEqual([]);
    expect(p.staged).toEqual([]);
    expect(p.torques).toEqual([{ techId: 'motorTuning', host: 'wornMotor', step: 1 }]);
  });

  it('a burst motorTuning 3 to 6 is one beat (rust, to tier 2) and no torque', () => {
    const p = plan({ motorTuning: 3 }, { motorTuning: 6 });
    expect(p.beats).toEqual([{ change: MOTOR_T2, primary: 'wornMotor' }]);
    expect(p.torques).toEqual([]);
  });

  it('motorTuning 4 to 25 is one change from tier 1 to 5 with mote debris', () => {
    const p = plan({ motorTuning: 4 }, { motorTuning: 25 });
    expect(p.beats).toEqual([{ change: MOTOR_T5, primary: 'wornMotor' }]);
    expect(p.beats[0]?.change.debris).toBe('mote');
    expect(p.torques).toEqual([]);
  });

  it('a tier change never adds a torque tick on the same track', () => {
    const p = plan({ motorTuning: 4 }, { motorTuning: 7 });
    expect(p.beats).toEqual([{ change: MOTOR_T2, primary: 'wornMotor' }]);
    expect(p.torques).toEqual([]);
  });

  it('a brand-new part (level 0 before) gets no torque: its fly-in owns it', () => {
    expect(plan({}, { motorTuning: 3 }).torques).toEqual([]);
    expect(plan({ motorTuning: 0 }, { motorTuning: 3 }).torques).toEqual([]);
  });

  it('no change and no level rise: empty plan', () => {
    expect(plan({ motorTuning: 5 }, { motorTuning: 5 })).toEqual({ beats: [], instant: [], staged: [], torques: [] });
  });
});

describe('planTierRelease: burst cap and order', () => {
  it('six crossings at once: four beats in track order, two instant swaps that keep their primary', () => {
    const p = plan(BURST_PREV, BURST_NEXT);
    expect(p.beats.map((b) => [b.change.techId, b.primary])).toEqual([
      ['gearRatio', 'gearLarge'],
      ['flywheel', 'flywheelPedestal'],
      ['motorTuning', 'wornMotor'],
      ['improvedPistons', 'pistonArray'],
    ]);
    expect(p.instant.map((i) => [i.change.techId, i.primary])).toEqual([
      ['copperWinding', 'coilStage1'],
      ['transformer', 'transformer'],
    ]);
    expect(p.staged).toEqual([]);
    expect(p.torques).toEqual([]);
  });

  it('the default cap is PART_TIER_FX.maxBeatsPerRelease and max overrides it', () => {
    expect(PART_TIER_FX.maxBeatsPerRelease).toBe(4);
    expect(plan(BURST_PREV, BURST_NEXT).beats).toHaveLength(PART_TIER_FX.maxBeatsPerRelease);
    const two = plan(BURST_PREV, BURST_NEXT, { max: 2 });
    expect(two.beats.map((b) => b.change.techId)).toEqual(['gearRatio', 'flywheel']);
    expect(two.instant.map((i) => i.change.techId)).toEqual(['motorTuning', 'improvedPistons', 'copperWinding', 'transformer']);
    expect(two.instant.every((i) => i.primary !== null)).toBe(true);
  });

  it('a change with no settled host is instant with null primary and takes no cap slot', () => {
    const p = plan(BURST_PREV, BURST_NEXT, { settled: unlisted('wornMotor', 'motorPlinth') });
    expect(p.beats.map((b) => b.change.techId)).toEqual(['gearRatio', 'flywheel', 'improvedPistons', 'copperWinding']);
    expect(p.instant.map((i) => [i.change.techId, i.primary])).toEqual([
      ['motorTuning', null],
      ['transformer', 'transformer'],
    ]);
  });

  it('a host still flying in is never a beat: instant with null primary, no beat', () => {
    const p = plan({ motorTuning: 4 }, { motorTuning: 5 }, { visible: listed('wornMotor', 'motorPlinth'), settled: no });
    expect(p.beats).toEqual([]);
    expect(p.instant).toEqual([{ change: MOTOR_T2, primary: null }]);
    expect(p.staged).toEqual([]);
    expect(p.torques).toEqual([]);
  });

  it('a settled plinth is the primary when the motor still flies in (first settled swap host wins)', () => {
    const p = plan({ motorTuning: 4 }, { motorTuning: 5 }, { settled: listed('motorPlinth') });
    expect(p.beats).toEqual([{ change: MOTOR_T2, primary: 'motorPlinth' }]);
  });
});

describe('planTierRelease: staged changes', () => {
  it('copperWinding 18 to 19 is one staged change: fly-in only, no beat, no torque', () => {
    const p = plan({ copperWinding: 18 }, { copperWinding: 19 });
    expect(p.staged).toEqual([{ techId: 'copperWinding', from: 2, to: 3, top: 5, hosts: ['coilStage2'], debris: 'scale', staged: true }]);
    expect(p.beats).toEqual([]);
    expect(p.instant).toEqual([]);
    expect(p.torques).toEqual([]);
  });

  it('containmentRing 6 to 7 and resonantSiphon 12 to 13 are staged', () => {
    const p = plan({ containmentRing: 6, resonantSiphon: 12 }, { containmentRing: 7, resonantSiphon: 13 });
    expect(p.staged.map((c) => c.techId)).toEqual(['containmentRing', 'resonantSiphon']);
    expect(p.beats).toEqual([]);
    expect(p.instant).toEqual([]);
    expect(p.torques).toEqual([]);
  });

  it('staged changes never use the cap: a burst plus a staged change still plays four beats', () => {
    const p = plan({ ...BURST_PREV, containmentRing: 6 }, { ...BURST_NEXT, containmentRing: 7 });
    expect(p.beats).toHaveLength(PART_TIER_FX.maxBeatsPerRelease);
    expect(p.staged.map((c) => c.techId)).toEqual(['containmentRing']);
    expect(p.instant.map((i) => i.change.techId)).toEqual(['copperWinding', 'transformer']);
  });
});

describe('planTierRelease: torque ticks', () => {
  it('containmentRing 2 to 3 (no swap host, no tier change) ticks on the first visible stage host at step 2', () => {
    const p = plan({ containmentRing: 2 }, { containmentRing: 3 });
    expect(p.torques).toEqual([{ techId: 'containmentRing', host: 'ring1Back', step: 2 }]);
    expect(p.beats).toEqual([]);
    expect(p.staged).toEqual([]);
  });

  it('the torque host falls through to the next visible stage host', () => {
    const p = plan({ containmentRing: 2 }, { containmentRing: 3 }, { visible: listed('ring1Front') });
    expect(p.torques).toEqual([{ techId: 'containmentRing', host: 'ring1Front', step: 2 }]);
  });

  it('no torque when nothing of the track is visible', () => {
    const p = plan({ containmentRing: 2 }, { containmentRing: 3 }, { visible: no });
    expect(p.torques).toEqual([]);
  });

  it('the step counts the levels bought inside the current tier (gearRatio 7 to 9 is step 3)', () => {
    const p = plan({ gearRatio: 7 }, { gearRatio: 9 });
    expect(p.torques).toEqual([{ techId: 'gearRatio', host: 'gearLarge', step: 3 }]);
  });

  it('one torque per track, in track order', () => {
    const p = plan({ gearRatio: 7, motorTuning: 5 }, { gearRatio: 9, motorTuning: 6 });
    expect(p.torques).toEqual([
      { techId: 'gearRatio', host: 'gearLarge', step: 3 },
      { techId: 'motorTuning', host: 'wornMotor', step: 1 },
    ]);
  });
});

describe('planTierRelease: techs filter', () => {
  it('techs limits beats and torques to the listed tracks', () => {
    const prev = { gearRatio: 7, motorTuning: 4 };
    const next = { gearRatio: 9, motorTuning: 5 };
    const limited = plan(prev, next, { techs: ['motorTuning'] });
    expect(limited.beats).toEqual([{ change: MOTOR_T2, primary: 'wornMotor' }]);
    expect(limited.torques).toEqual([]);
    const all = plan(prev, next);
    expect(all.beats).toEqual([{ change: MOTOR_T2, primary: 'wornMotor' }]);
    expect(all.torques).toEqual([{ techId: 'gearRatio', host: 'gearLarge', step: 3 }]);
  });

  it('an empty techs list plans nothing', () => {
    expect(plan(BURST_PREV, BURST_NEXT, { techs: [] })).toEqual({ beats: [], instant: [], staged: [], torques: [] });
  });
});

describe('planTierRelease: purity', () => {
  it('has no phaser import', () => {
    const source = readFileSync(SOURCE_URL, 'utf8');
    expect(source).not.toMatch(/['"]phaser['"]/);
  });
});

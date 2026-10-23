import { describe, it, expect } from 'vitest';
import { MACHINE_COMPONENTS } from '../../data/machineComponents';
import { TECH_IDS } from '../../data/types';
import type { TechId } from '../../data/types';
import { capPlateLevels, plateGateTechs } from './plateCap';
import type { PlateLevels } from './plateCap';
import { teaserLevels } from './teaser';
import type { TeaserEra } from './teaser';

const PLATE_GATES: readonly TechId[] = ['generatorBlueprint', 'substationBlueprint', 'pressureVesselBlueprint', 'harmonicConvergence'];
const LATE_GATES = new Set<TechId>(['pressureVesselBlueprint', 'harmonicConvergence']);
const ERAS: TeaserEra[] = [2, 3, 4, 5];

/** Gates the namePlate stage animation reads as met at these levels (its frame). */
function gatesMet(levels: PlateLevels): number {
  const anim = MACHINE_COMPONENTS.namePlate.animation;
  if (anim.kind !== 'stage') return -1;
  return anim.gates.filter(([techId, level]) => levels[techId] >= level).length;
}

describe('plateGateTechs', () => {
  it('lists the namePlate stage gates in plaque order', () => {
    expect(plateGateTechs()).toEqual(PLATE_GATES);
  });
});

describe('capPlateLevels', () => {
  it('zeroes the plate gates after the cap and keeps every other level', () => {
    const input = teaserLevels(3, false);
    expect(input.pressureVesselBlueprint).toBeGreaterThanOrEqual(1);
    const before = { ...input };
    const out = capPlateLevels(input, 'substationBlueprint');
    expect(out.pressureVesselBlueprint).toBe(0);
    expect(out.harmonicConvergence).toBe(0);
    expect(out.generatorBlueprint).toBe(input.generatorBlueprint);
    expect(out.substationBlueprint).toBe(input.substationBlueprint);
    for (const id of TECH_IDS) {
      if (LATE_GATES.has(id)) continue;
      expect(out[id]).toBe(input[id]);
    }
    expect(input).toEqual(before);
  });

  it('returns a frozen result', () => {
    expect(Object.isFrozen(capPlateLevels(teaserLevels(3, false), 'substationBlueprint'))).toBe(true);
  });

  it('gives the same reference for equal inputs', () => {
    const input = teaserLevels(4, true);
    const first = capPlateLevels(input, 'substationBlueprint');
    expect(capPlateLevels(input, 'substationBlueprint')).toBe(first);
  });

  it('caps the first gate by zeroing the three later gates', () => {
    const out = capPlateLevels(teaserLevels(5, true), 'generatorBlueprint');
    expect(out.generatorBlueprint).toBe(teaserLevels(5, true).generatorBlueprint);
    expect(out.substationBlueprint).toBe(0);
    expect(out.pressureVesselBlueprint).toBe(0);
    expect(out.harmonicConvergence).toBe(0);
  });

  it('returns the same reference for a null cap', () => {
    const input = teaserLevels(5, true);
    expect(capPlateLevels(input, null)).toBe(input);
  });

  it('returns the same reference for a tech that is not a plate gate', () => {
    const input = teaserLevels(5, true);
    expect(capPlateLevels(input, 'handCrank')).toBe(input);
  });

  it('meets exactly two plate gates for every era and aperture state', () => {
    for (const era of ERAS) {
      for (const open of [false, true]) {
        const levels = teaserLevels(era, open);
        expect(gatesMet(capPlateLevels(levels, 'substationBlueprint'))).toBe(2);
      }
    }
  });

  it('uncapped teaser levels meet all four plate gates at era 5', () => {
    expect(gatesMet(teaserLevels(5, true))).toBe(4);
  });
});

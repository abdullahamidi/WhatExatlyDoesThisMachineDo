import { describe, it, expect } from 'vitest';
import { MACHINE_COMPONENTS } from '../../data/machineComponents';
import { TECH_IDS } from '../../data/types';
import type { TechId } from '../../data/types';
import { cappedPlaqueLevels, cappedPlateFrame, capPlateLevels, plateFrameCap, plateGateTechs } from './plateCap';
import type { PlateLevels } from './plateCap';
import { teaserLevels } from './teaser';
import type { TeaserEra } from './teaser';
import { plaqueText } from '../../ui/hudView';

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

/** All techs at level 0 (WP16b-3 tests). */
function zeroLevels(): Record<TechId, number> {
  return Object.fromEntries(TECH_IDS.map((id) => [id, 0])) as Record<TechId, number>;
}

describe('plateFrameCap', () => {
  it.each<[TechId | null, number | null]>([
    [null, null],
    ['handCrank', null],
    ['generatorBlueprint', 1],
    ['substationBlueprint', 2],
    ['pressureVesselBlueprint', 3],
    ['harmonicConvergence', 4],
  ])('plateFrameCap(%s) is %s', (maxTech, want) => {
    expect(plateFrameCap(maxTech)).toBe(want);
  });
});

describe('cappedPlateFrame', () => {
  it.each<[number, TechId | null, number]>([
    [4, 'substationBlueprint', 2],
    [5, 'substationBlueprint', 2],
    [2, 'substationBlueprint', 2],
    [1, 'substationBlueprint', 1],
    [0, 'substationBlueprint', 0],
    [5, null, 5],
    [4, 'handCrank', 4],
  ])('cappedPlateFrame(%i, %s) is %i', (frame, maxTech, want) => {
    expect(cappedPlateFrame(frame, maxTech)).toBe(want);
  });

  it('matches capPlateLevels for every prefix of met gates', () => {
    for (let k = 0; k <= PLATE_GATES.length; k++) {
      const levels = zeroLevels();
      for (const gate of PLATE_GATES.slice(0, k)) levels[gate] = 1;
      for (const cap of PLATE_GATES) {
        expect(cappedPlateFrame(gatesMet(levels), cap)).toBe(gatesMet(capPlateLevels(levels, cap)));
      }
    }
  });

  it('caps the HUD plaque at RES?OR?', () => {
    const levels = zeroLevels();
    for (const gate of PLATE_GATES) levels[gate] = 1;
    expect(plaqueText(levels)).toBe('PRIMARY FUNCTION: RESTORE (TARGET: ?)');
    expect(plaqueText(capPlateLevels(levels, 'substationBlueprint'))).toBe('PRIMARY FUNCTION: RES?OR?');
  });
});

describe('cappedPlaqueLevels', () => {
  it('returns the same levels object for a null cap', () => {
    const levels = zeroLevels();
    expect(cappedPlaqueLevels(levels, null)).toBe(levels);
  });

  it('returns the same levels object for a tech that is not a plate gate', () => {
    const levels = zeroLevels();
    expect(cappedPlaqueLevels(levels, 'handCrank')).toBe(levels);
  });

  it('reads RES?OR? with all four gates and primaryFunction owned under substationBlueprint', () => {
    const levels = zeroLevels();
    for (const gate of PLATE_GATES) levels[gate] = 1;
    levels.primaryFunction = 1;
    expect(plaqueText(cappedPlaqueLevels(levels, 'substationBlueprint'))).toBe('PRIMARY FUNCTION: RES?OR?');
    expect(plaqueText(levels)).not.toBe('PRIMARY FUNCTION: RES?OR?');
  });

  it('does not mutate the input and returns a new object', () => {
    const levels = zeroLevels();
    for (const gate of PLATE_GATES) levels[gate] = 1;
    levels.primaryFunction = 1;
    const result = cappedPlaqueLevels(levels, 'substationBlueprint');
    expect(levels.primaryFunction).toBe(1);
    expect(result).not.toBe(levels);
  });
});

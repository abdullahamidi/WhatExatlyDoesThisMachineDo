import { describe, it, expect } from 'vitest';
import { TECH_IDS } from './types';
import type { TechId, Requirement } from './types';
import { TECHNOLOGIES, TECH_LIST } from './technologies';
import { OFFLINE_CAP_SECONDS, MAX_UPDATE_SECONDS, AUTOSAVE_INTERVAL_MS, SAVE_KEY, SAVE_BACKUP_KEY } from './balance';

describe('technology table', () => {
  it('has unique ids that match TECH_IDS', () => {
    expect(new Set(TECH_IDS).size).toBe(TECH_IDS.length);
    expect(new Set(Object.keys(TECHNOLOGIES))).toEqual(new Set(TECH_IDS));
  });

  it('TECH_LIST follows TECH_IDS order', () => {
    expect(TECH_LIST).toHaveLength(9);
    expect(TECH_LIST.map((t) => t.id)).toEqual([...TECH_IDS]);
  });

  it('each definition id matches its key', () => {
    for (const id of TECH_IDS) {
      expect(TECHNOLOGIES[id].id).toBe(id);
    }
  });

  it('every requires tech id refers to a known tech', () => {
    for (const id of TECH_IDS) {
      for (const req of TECHNOLOGIES[id].requires) {
        if (req.type === 'tech') {
          expect(TECHNOLOGIES).toHaveProperty([req.id]);
        }
      }
    }
  });

  it('prerequisite graph is acyclic', () => {
    const deps = (id: TechId): TechId[] =>
      TECHNOLOGIES[id].requires
        .filter((r): r is Extract<Requirement, { type: 'tech' }> => r.type === 'tech')
        .map((r) => r.id);
    const visiting = new Set<TechId>();
    const done = new Set<TechId>();
    const visit = (id: TechId): void => {
      if (done.has(id)) return;
      expect(visiting.has(id)).toBe(false);
      visiting.add(id);
      for (const dep of deps(id)) visit(dep);
      visiting.delete(id);
      done.add(id);
    };
    for (const id of TECH_IDS) visit(id);
    expect(done.size).toBe(TECH_IDS.length);
  });

  it('repeatables have growth > 1 and maxLevel >= 1', () => {
    for (const id of TECH_IDS) {
      const def = TECHNOLOGIES[id];
      if (def.kind === 'repeatable') {
        expect(def.growth).not.toBeNull();
        expect(def.growth as number).toBeGreaterThan(1);
        expect(def.maxLevel).not.toBeNull();
        expect(def.maxLevel as number).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('non-repeatables have null growth and maxLevel', () => {
    for (const id of TECH_IDS) {
      const def = TECHNOLOGIES[id];
      if (def.kind !== 'repeatable') {
        expect(def.growth).toBeNull();
        expect(def.maxLevel).toBeNull();
      }
    }
  });

  it('tree positions are unique', () => {
    const keys = TECH_IDS.map((id) => {
      const { col, row } = TECHNOLOGIES[id].tree;
      return `${col},${row}`;
    });
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every description is non-empty', () => {
    for (const id of TECH_IDS) {
      expect(TECHNOLOGIES[id].description.trim().length).toBeGreaterThan(0);
    }
  });

  it('matches the spec table for kind, baseCost, growth and maxLevel', () => {
    const expected: Record<TechId, [string, number, number | null, number | null]> = {
      handCrank: ['starting', 0, null, null],
      gearRatio: ['repeatable', 15, 1.3, 15],
      reinforcedCrank: ['unlock', 2000, null, null],
      flywheel: ['repeatable', 4000, 1.35, 10],
      wornMotor: ['unlock', 40, null, null],
      motorTuning: ['repeatable', 60, 1.3, 25],
      pistonArray: ['unlock', 12000, null, null],
      improvedPistons: ['repeatable', 6000, 1.3, 25],
      generatorBlueprint: ['milestone', 0, null, null],
    };
    for (const id of TECH_IDS) {
      const [kind, baseCost, growth, maxLevel] = expected[id];
      const def = TECHNOLOGIES[id];
      expect(def.kind).toBe(kind);
      expect(def.baseCost).toBe(baseCost);
      expect(def.growth).toBe(growth);
      expect(def.maxLevel).toBe(maxLevel);
    }
  });

  it('reinforcedCrank effects and requirements', () => {
    expect(TECHNOLOGIES.reinforcedCrank.effects).toEqual([{ type: 'clickMult', factor: 2 }]);
    expect(TECHNOLOGIES.reinforcedCrank.requires).toEqual([{ type: 'tech', id: 'gearRatio', minLevel: 3 }]);
  });

  it('flywheel effects', () => {
    expect(TECHNOLOGIES.flywheel.effects).toEqual([{ type: 'autoPct', percent: 10 }]);
  });

  it('generatorBlueprint is a zero-cost milestone with the spec requirements', () => {
    const gb = TECHNOLOGIES.generatorBlueprint;
    expect(gb.kind).toBe('milestone');
    expect(gb.baseCost).toBe(0);
    expect(gb.requires).toEqual([
      { type: 'tech', id: 'pistonArray', minLevel: 1 },
      { type: 'tech', id: 'flywheel', minLevel: 1 },
      { type: 'lifetimeMe', amount: 200000 },
    ]);
  });

  it('flavor is optional per definition', () => {
    expect(TECHNOLOGIES.handCrank.flavor).toBe('Manual operation detected.');
    expect(TECHNOLOGIES.gearRatio.flavor).toBeUndefined();
  });
});

describe('balance constants', () => {
  it('has the exact values from the spec', () => {
    expect(OFFLINE_CAP_SECONDS).toBe(28800);
    expect(MAX_UPDATE_SECONDS).toBe(28800);
    expect(AUTOSAVE_INTERVAL_MS).toBe(15000);
    expect(SAVE_KEY).toBe('wedtmd.save');
    expect(SAVE_BACKUP_KEY).toBe('wedtmd.save.corrupt');
  });
});

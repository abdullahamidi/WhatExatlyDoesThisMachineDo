import { describe, it, expect } from 'vitest';
import { RESOURCE_IDS, TECH_IDS } from './types';
import type { TechDefinition, TechId, Requirement } from './types';
import { RESOURCES } from './resources';
import { TECHNOLOGIES, TECH_LIST } from './technologies';
import { PLAQUE_LINES } from './story';
import { INSTALL_LINES } from './notifications';
import { SYSTEM_LOGS } from './systemLogs';
import { OFFLINE_CAP_SECONDS, MAX_UPDATE_SECONDS, AUTOSAVE_INTERVAL_MS, SAVE_KEY, SAVE_BACKUP_KEY } from './balance';

const ERA_ONE_IDS = TECH_IDS.filter((id) => TECHNOLOGIES[id].era === 1);
const ERA_TWO_IDS = TECH_IDS.filter((id) => TECHNOLOGIES[id].era === 2);
const ERA_THREE_IDS = TECH_IDS.filter((id) => TECHNOLOGIES[id].era === 3);
const ERA_FOUR_IDS = TECH_IDS.filter((id) => TECHNOLOGIES[id].era === 4);
const ERA_FIVE_IDS = TECH_IDS.filter((id) => TECHNOLOGIES[id].era === 5);

// Projection of a definition onto the C1 columns.
const project = (def: TechDefinition): unknown => ({
  id: def.id,
  kind: def.kind,
  era: def.era,
  costRes: def.costRes,
  baseCost: def.baseCost,
  growth: def.growth,
  maxLevel: def.maxLevel,
  tree: def.tree,
  branch: def.branch,
  effects: def.effects,
  requires: def.requires,
});

describe('technology table', () => {
  it('has unique ids that match TECH_IDS', () => {
    expect(new Set(TECH_IDS).size).toBe(TECH_IDS.length);
    expect(new Set(Object.keys(TECHNOLOGIES))).toEqual(new Set(TECH_IDS));
  });

  it('TECH_LIST follows TECH_IDS order', () => {
    expect(TECH_LIST).toHaveLength(50);
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

  it('every tech is reachable from handCrank through tech requirements', () => {
    const reachable = new Set<TechId>(['handCrank']);
    let changed = true;
    while (changed) {
      changed = false;
      for (const id of TECH_IDS) {
        if (reachable.has(id)) continue;
        const techReqs = TECHNOLOGIES[id].requires.filter((r) => r.type === 'tech');
        if (techReqs.every((r) => r.type === 'tech' && reachable.has(r.id))) {
          reachable.add(id);
          changed = true;
        }
      }
    }
    expect(reachable.size).toBe(TECH_IDS.length);
  });

  it('repeatables have growth > 1 and maxLevel null or >= 1', () => {
    for (const id of TECH_IDS) {
      const def = TECHNOLOGIES[id];
      if (def.kind === 'repeatable') {
        expect(def.growth).not.toBeNull();
        expect(def.growth as number).toBeGreaterThan(1);
        expect(def.maxLevel === null || def.maxLevel >= 1).toBe(true);
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

  it('uncapped repeatables are exactly bellowsDrive, gridExciter, mainsBackfeed, steamLance', () => {
    const uncapped = TECH_IDS.filter((id) => TECHNOLOGIES[id].kind === 'repeatable' && TECHNOLOGIES[id].maxLevel === null);
    expect([...uncapped].sort()).toEqual(['bellowsDrive', 'gridExciter', 'mainsBackfeed', 'steamLance']);
    for (const id of uncapped) {
      expect(TECHNOLOGIES[id].growth as number).toBeGreaterThanOrEqual(1.4);
    }
  });

  it('every resource has a repeatable tech of its own in each later era up to era 5', () => {
    const missing: string[] = [];
    for (const r of RESOURCE_IDS) {
      for (let era = RESOURCES[r].era + 1; era <= 5; era++) {
        const found = TECH_IDS.some((id) => {
          const def = TECHNOLOGIES[id];
          return def.kind === 'repeatable' && def.era === era && def.costRes === r;
        });
        if (!found) missing.push(`${r}@era${era}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('Legacy Feed names fit the tree node (19 characters or fewer)', () => {
    for (const id of ['bellowsDrive', 'gridExciter', 'mainsBackfeed', 'steamLance'] as const) {
      expect(TECHNOLOGIES[id].name.length).toBeLessThanOrEqual(19);
    }
  });

  it('tree positions are unique per era', () => {
    const keys = TECH_IDS.map((id) => {
      const { era, tree } = TECHNOLOGIES[id];
      return `${era}:${tree.col},${tree.row}`;
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
      generator: ['unlock', 25000, null, null],
      copperWinding: ['repeatable', 60, 1.5, 25],
      motorRetrofit: ['repeatable', 20000, 1.35, 20],
      dynamoCrank: ['unlock', 400, null, null],
      capacitorBank: ['unlock', 2500, null, null],
      sparkGap: ['unlock', 10000, null, null],
      transformer: ['repeatable', 5000, 1.5, 20],
      powerLines: ['unlock', 200000, null, null],
      substationBlueprint: ['milestone', 0, null, null],
      boiler: ['unlock', 1000000, null, null],
      firebox: ['repeatable', 1000, 1.3, 25],
      inductionHeater: ['repeatable', 300000, 1.35, 20],
      steamHammer: ['unlock', 10000, null, null],
      superheater: ['unlock', 40000, null, null],
      condenser: ['repeatable', 60000, 1.3, 20],
      turbine: ['unlock', 300000, null, null],
      reliefValves: ['unlock', 800000, null, null],
      pressureVesselBlueprint: ['milestone', 0, null, null],
      resonatorSpire: ['unlock', 1500000, null, null],
      harmonicCoil: ['repeatable', 200, 1.3, 25],
      pressureResonator: ['repeatable', 1000000, 1.35, 20],
      crankServo: ['repeatable', 300000, 1.5, 10],
      echoCrank: ['unlock', 10000, null, null],
      phaseLock: ['unlock', 50000, null, null],
      standingWave: ['repeatable', 100000, 1.3, 20],
      crystalLattice: ['unlock', 1500000, null, null],
      harmonicConvergence: ['milestone', 0, null, null],
      nullChamber: ['unlock', 8000000, null, null],
      containmentRing: ['repeatable', 300, 1.25, 25],
      resonantSiphon: ['repeatable', 10000000, 1.3, 20],
      graviticAnchor: ['repeatable', 1500000, 1.5, 10],
      inversionCrank: ['unlock', 4000, null, null],
      lensArray: ['unlock', 12000, null, null],
      horizonField: ['repeatable', 40000, 1.3, 20],
      skyAperture: ['unlock', 10000000, null, null],
      finalAlignment: ['milestone', 0, null, null],
      primaryFunction: ['unlock', 500000000, null, null],
      bellowsDrive: ['repeatable', 250000, 2.5, null],
      gridExciter: ['repeatable', 2000000, 1.4, null],
      mainsBackfeed: ['repeatable', 20000000, 1.4, null],
      steamLance: ['repeatable', 5000000, 1.4, null],
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
      { type: 'lifetime', res: 'me', amount: 200000 },
    ]);
  });

  it('all era-I techs are era 1 and cost ME', () => {
    expect(ERA_ONE_IDS).toHaveLength(9);
    for (const id of ERA_ONE_IDS) {
      expect(TECHNOLOGIES[id].era).toBe(1);
      expect(TECHNOLOGIES[id].costRes).toBe('me');
    }
  });

  it('flavor is optional per definition', () => {
    expect(TECHNOLOGIES.handCrank.flavor).toBe('Manual operation detected.');
    expect(TECHNOLOGIES.gearRatio.flavor).toBeUndefined();
  });
});

describe('era II technology table', () => {
  it('matches the C1 table exactly', () => {
    const expected = {
      generator: {
        id: 'generator', kind: 'unlock', era: 2, costRes: 'me', baseCost: 25000, growth: null, maxLevel: null,
        tree: { col: 0, row: 1 }, branch: 'convergence',
        effects: [{ type: 'convert', amount: 0.5, res: 'ee' }],
        requires: [{ type: 'tech', id: 'generatorBlueprint', minLevel: 1 }],
      },
      copperWinding: {
        id: 'copperWinding', kind: 'repeatable', era: 2, costRes: 'ee', baseCost: 60, growth: 1.5, maxLevel: 25,
        tree: { col: 1, row: 0 }, branch: 'mechanical',
        effects: [{ type: 'convert', amount: 0.25, res: 'ee' }],
        requires: [{ type: 'tech', id: 'generator', minLevel: 1 }],
      },
      motorRetrofit: {
        id: 'motorRetrofit', kind: 'repeatable', era: 2, costRes: 'me', baseCost: 20000, growth: 1.35, maxLevel: 20,
        tree: { col: 1, row: 2 }, branch: 'automation',
        effects: [{ type: 'autoAdd', amount: 15 }],
        requires: [{ type: 'tech', id: 'generator', minLevel: 1 }],
      },
      dynamoCrank: {
        id: 'dynamoCrank', kind: 'unlock', era: 2, costRes: 'ee', baseCost: 400, growth: null, maxLevel: null,
        tree: { col: 2, row: 0 }, branch: 'origin',
        effects: [{ type: 'clickEcho', seconds: 1, res: 'ee' }],
        requires: [{ type: 'tech', id: 'copperWinding', minLevel: 3 }],
      },
      capacitorBank: {
        id: 'capacitorBank', kind: 'unlock', era: 2, costRes: 'ee', baseCost: 2500, growth: null, maxLevel: null,
        tree: { col: 2, row: 1 }, branch: 'mechanical',
        effects: [{ type: 'rateMult', factor: 2, res: 'ee' }],
        requires: [{ type: 'tech', id: 'copperWinding', minLevel: 5 }],
      },
      sparkGap: {
        id: 'sparkGap', kind: 'unlock', era: 2, costRes: 'ee', baseCost: 10000, growth: null, maxLevel: null,
        tree: { col: 3, row: 0 }, branch: 'origin',
        effects: [{ type: 'clickMult', factor: 3 }],
        requires: [{ type: 'tech', id: 'dynamoCrank', minLevel: 1 }],
      },
      transformer: {
        id: 'transformer', kind: 'repeatable', era: 2, costRes: 'ee', baseCost: 5000, growth: 1.5, maxLevel: 20,
        tree: { col: 3, row: 1 }, branch: 'mechanical',
        effects: [{ type: 'autoPct', percent: 15, res: 'ee' }],
        requires: [{ type: 'tech', id: 'capacitorBank', minLevel: 1 }],
      },
      powerLines: {
        id: 'powerLines', kind: 'unlock', era: 2, costRes: 'ee', baseCost: 200000, growth: null, maxLevel: null,
        tree: { col: 4, row: 2 }, branch: 'automation',
        effects: [{ type: 'rateMult', factor: 2, res: 'me' }],
        requires: [
          { type: 'tech', id: 'transformer', minLevel: 3 },
          { type: 'tech', id: 'motorRetrofit', minLevel: 5 },
        ],
      },
      substationBlueprint: {
        id: 'substationBlueprint', kind: 'milestone', era: 2, costRes: 'ee', baseCost: 0, growth: null, maxLevel: null,
        tree: { col: 5, row: 1 }, branch: 'convergence',
        effects: [{ type: 'none' }],
        requires: [
          { type: 'tech', id: 'powerLines', minLevel: 1 },
          { type: 'tech', id: 'sparkGap', minLevel: 1 },
          { type: 'lifetime', res: 'ee', amount: 4000000 },
        ],
      },
    };
    expect(ERA_TWO_IDS).toEqual([
      'generator', 'copperWinding', 'motorRetrofit', 'dynamoCrank', 'capacitorBank',
      'sparkGap', 'transformer', 'powerLines', 'substationBlueprint',
    ]);
    for (const id of ERA_TWO_IDS) {
      expect(project(TECHNOLOGIES[id])).toEqual(expected[id as keyof typeof expected]);
    }
  });

  it('era-II texts match the spec', () => {
    expect(TECHNOLOGIES.generator.description).toBe('A coil and a magnet. Converts motion into current.');
    expect(TECHNOLOGIES.generator.flavor).toBe('Current detected. Destination: unlisted.');
    expect(TECHNOLOGIES.copperWinding.description).toBe('Tighter copper turns. More EE from the same motion.');
    expect(TECHNOLOGIES.motorRetrofit.description).toBe('The old motor, rewired. +15 ME/s per level.');
    expect(TECHNOLOGIES.dynamoCrank.description).toBe('The crank now feeds a dynamo. Clicks echo current.');
    expect(TECHNOLOGIES.capacitorBank.description).toBe('Stores a surge and releases it later. Doubles EE production.');
    expect(TECHNOLOGIES.sparkGap.description).toBe('A gap that should not conduct. It does. Triples manual production.');
    expect(TECHNOLOGIES.transformer.description).toBe('Steps voltage. Nobody specified which way. +15% EE production per level.');
    expect(TECHNOLOGIES.powerLines.description).toBe('Lines run toward nothing. Doubles ME production.');
    expect(TECHNOLOGIES.substationBlueprint.description).toBe('The machine has begun to resemble a grid node.');
    expect(TECHNOLOGIES.substationBlueprint.flavor).toBe('Grid handshake… no response from grid.');
  });

  it('era-II techs without a given flavor have none', () => {
    for (const id of ['copperWinding', 'motorRetrofit', 'dynamoCrank', 'capacitorBank', 'sparkGap', 'transformer', 'powerLines'] as const) {
      expect(TECHNOLOGIES[id].flavor).toBeUndefined();
    }
  });

  it('era-II costRes: ee except generator and motorRetrofit (me), era I never ee', () => {
    for (const id of ERA_ONE_IDS) expect(TECHNOLOGIES[id].costRes).not.toBe('ee');
    // generator and motorRetrofit are bought with ME (C1); the rest of era II costs EE.
    const meCost: readonly TechId[] = ['generator', 'motorRetrofit'];
    for (const id of ERA_TWO_IDS) {
      expect(TECHNOLOGIES[id].costRes).toBe(meCost.includes(id) ? 'me' : 'ee');
    }
  });

  it('era is 1 to 4 for every tech', () => {
    for (const id of TECH_IDS) expect([1, 2, 3, 4, 5]).toContain(TECHNOLOGIES[id].era);
  });
});

describe('era III technology table', () => {
  it('matches the C1 table exactly', () => {
    const expected = {
      boiler: {
        id: 'boiler', kind: 'unlock', era: 3, costRes: 'ee', baseCost: 1000000, growth: null, maxLevel: null,
        tree: { col: 0, row: 1 }, branch: 'convergence',
        effects: [{ type: 'convert', amount: 0.3, res: 'pr' }],
        requires: [{ type: 'tech', id: 'substationBlueprint', minLevel: 1 }],
      },
      firebox: {
        id: 'firebox', kind: 'repeatable', era: 3, costRes: 'pr', baseCost: 1000, growth: 1.3, maxLevel: 25,
        tree: { col: 1, row: 0 }, branch: 'mechanical',
        effects: [{ type: 'convert', amount: 0.15, res: 'pr' }],
        requires: [{ type: 'tech', id: 'boiler', minLevel: 1 }],
      },
      inductionHeater: {
        id: 'inductionHeater', kind: 'repeatable', era: 3, costRes: 'ee', baseCost: 300000, growth: 1.35, maxLevel: 20,
        tree: { col: 1, row: 2 }, branch: 'automation',
        effects: [{ type: 'autoAdd', amount: 5, res: 'pr' }],
        requires: [{ type: 'tech', id: 'boiler', minLevel: 1 }],
      },
      steamHammer: {
        id: 'steamHammer', kind: 'unlock', era: 3, costRes: 'pr', baseCost: 10000, growth: null, maxLevel: null,
        tree: { col: 2, row: 0 }, branch: 'origin',
        effects: [{ type: 'clickEcho', seconds: 1, res: 'pr' }],
        requires: [{ type: 'tech', id: 'firebox', minLevel: 3 }],
      },
      superheater: {
        id: 'superheater', kind: 'unlock', era: 3, costRes: 'pr', baseCost: 40000, growth: null, maxLevel: null,
        tree: { col: 2, row: 1 }, branch: 'mechanical',
        effects: [{ type: 'rateMult', factor: 2, res: 'pr' }],
        requires: [{ type: 'tech', id: 'firebox', minLevel: 5 }],
      },
      condenser: {
        id: 'condenser', kind: 'repeatable', era: 3, costRes: 'pr', baseCost: 60000, growth: 1.3, maxLevel: 20,
        tree: { col: 3, row: 1 }, branch: 'mechanical',
        effects: [{ type: 'autoPct', percent: 15, res: 'pr' }],
        requires: [{ type: 'tech', id: 'superheater', minLevel: 1 }],
      },
      turbine: {
        id: 'turbine', kind: 'unlock', era: 3, costRes: 'pr', baseCost: 300000, growth: null, maxLevel: null,
        tree: { col: 4, row: 1 }, branch: 'automation',
        effects: [{ type: 'rateMult', factor: 2, res: 'ee' }],
        requires: [{ type: 'tech', id: 'condenser', minLevel: 3 }],
      },
      reliefValves: {
        id: 'reliefValves', kind: 'unlock', era: 3, costRes: 'pr', baseCost: 800000, growth: null, maxLevel: null,
        tree: { col: 5, row: 0 }, branch: 'automation',
        effects: [{ type: 'offlineHours', hours: 4 }],
        requires: [
          { type: 'tech', id: 'steamHammer', minLevel: 1 },
          { type: 'tech', id: 'turbine', minLevel: 1 },
        ],
      },
      pressureVesselBlueprint: {
        id: 'pressureVesselBlueprint', kind: 'milestone', era: 3, costRes: 'pr', baseCost: 0, growth: null, maxLevel: null,
        tree: { col: 6, row: 1 }, branch: 'convergence',
        effects: [{ type: 'none' }],
        requires: [
          { type: 'tech', id: 'reliefValves', minLevel: 1 },
          { type: 'tech', id: 'condenser', minLevel: 5 },
          { type: 'lifetime', res: 'pr', amount: 6000000 },
        ],
      },
      bellowsDrive: {
        id: 'bellowsDrive', kind: 'repeatable', era: 3, costRes: 'me', baseCost: 250000, growth: 2.5, maxLevel: null,
        tree: { col: 2, row: 2 }, branch: 'automation',
        effects: [{ type: 'autoPct', percent: 8, res: 'pr' }],
        requires: [{ type: 'tech', id: 'boiler', minLevel: 1 }],
      },
    };
    expect(ERA_THREE_IDS).toEqual([
      'boiler', 'firebox', 'inductionHeater', 'steamHammer', 'superheater',
      'condenser', 'turbine', 'reliefValves', 'pressureVesselBlueprint', 'bellowsDrive',
    ]);
    for (const id of ERA_THREE_IDS) {
      expect(project(TECHNOLOGIES[id])).toEqual(expected[id as keyof typeof expected]);
    }
  });

  it('era-III texts match the spec', () => {
    expect(TECHNOLOGIES.boiler.description).toBe('A sealed drum over a flame. Converts EE into pressure.');
    expect(TECHNOLOGIES.boiler.flavor).toBe('Pressure detected. Vessel rating: unlisted.');
    expect(TECHNOLOGIES.firebox.description).toBe('Fuel the fire. More PR from the same current.');
    expect(TECHNOLOGIES.inductionHeater.description).toBe('Current turned to heat. +5 PR/s per level.');
    expect(TECHNOLOGIES.steamHammer.description).toBe('A ram on the main shaft. Clicks echo pressure.');
    expect(TECHNOLOGIES.superheater.description).toBe('Steam heated past its rating. Doubles PR production.');
    expect(TECHNOLOGIES.condenser.description).toBe('Returns the water. +15% PR production per level.');
    expect(TECHNOLOGIES.turbine.description).toBe('Steam spins a wheel. Doubles EE production.');
    expect(TECHNOLOGIES.reliefValves.description).toBe('Vents what the vessel cannot hold. +4h offline buffer.');
    expect(TECHNOLOGIES.pressureVesselBlueprint.description).toBe('The machine now resembles something that holds pressure.');
    expect(TECHNOLOGIES.pressureVesselBlueprint.flavor).toBe('Containment rating exceeded by design.');
    expect(TECHNOLOGIES.bellowsDrive.description).toBe('The old drive train works a bellows into the firebox. +8% PR production per level.');
    expect(TECHNOLOGIES.bellowsDrive.flavor).toBeUndefined();
  });

  it('era-III techs without a given flavor have none', () => {
    for (const id of ['firebox', 'inductionHeater', 'steamHammer', 'superheater', 'condenser', 'turbine', 'reliefValves', 'bellowsDrive'] as const) {
      expect(TECHNOLOGIES[id].flavor).toBeUndefined();
    }
  });

  it('era-III names fit the tree node (19 characters or fewer)', () => {
    for (const id of ERA_THREE_IDS) {
      expect(TECHNOLOGIES[id].name.length).toBeLessThanOrEqual(19);
    }
    expect(TECHNOLOGIES.pressureVesselBlueprint.name).toBe('Vessel Blueprint');
  });

  it('costRes in era III: ee on boiler and inductionHeater, me on bellowsDrive, pr on the rest', () => {
    for (const id of [...ERA_ONE_IDS, ...ERA_TWO_IDS]) expect(TECHNOLOGIES[id].costRes).not.toBe('pr');
    const eeCost: readonly TechId[] = ['boiler', 'inductionHeater'];
    for (const id of ERA_THREE_IDS) {
      const expectedRes = id === 'bellowsDrive' ? 'me' : eeCost.includes(id) ? 'ee' : 'pr';
      expect(TECHNOLOGIES[id].costRes).toBe(expectedRes);
    }
  });

  it('offlineHours appears exactly once, on reliefValves with 4 hours', () => {
    const offline = TECH_IDS.flatMap((id) =>
      TECHNOLOGIES[id].effects.filter((e) => e.type === 'offlineHours').map((e) => ({ id, effect: e })),
    );
    expect(offline).toEqual([{ id: 'reliefValves', effect: { type: 'offlineHours', hours: 4 } }]);
  });

  it('every tech has an install line; flavored techs use their flavor as the line', () => {
    for (const id of TECH_IDS) {
      expect(INSTALL_LINES[id]).toBeDefined();
      expect(INSTALL_LINES[id].length).toBeGreaterThan(0);
      expect(INSTALL_LINES[id].length).toBeLessThanOrEqual(60);
    }
    expect(new Set(TECH_IDS.map((id) => INSTALL_LINES[id])).size).toBe(TECH_IDS.length);
    expect(INSTALL_LINES.boiler).toBe(TECHNOLOGIES.boiler.flavor);
    expect(INSTALL_LINES.pressureVesselBlueprint).toBe(TECHNOLOGIES.pressureVesselBlueprint.flavor);
    expect(INSTALL_LINES.bellowsDrive).toBe('Bellows coupled. The fire breathes with the crank.');
    for (const id of TECH_IDS) {
      const flavor = TECHNOLOGIES[id].flavor;
      if (flavor !== undefined) expect(INSTALL_LINES[id]).toBe(flavor);
    }
  });

  it('appends pressure-rising, perimeter-umbrella and steam-rain before the era IV and era V logs', () => {
    expect(SYSTEM_LOGS.slice(-10, -7)).toEqual([
      { id: 'pressure-rising', text: 'Pressure rising. Safe limit field left blank.', trigger: { kind: 'lifetime', res: 'pr', atLeast: 1000 } },
      { id: 'perimeter-umbrella', text: 'Umbrella detected. Precipitation: none.', trigger: { kind: 'lifetime', res: 'pr', atLeast: 100000 } },
      { id: 'steam-rain', text: 'Steam tastes of rain. Logged as error.', trigger: { kind: 'lifetime', res: 'pr', atLeast: 1000000 } },
    ]);
  });
});

describe('era IV technology table', () => {
  it('matches the C1 table exactly', () => {
    const expected = {
      resonatorSpire: {
        id: 'resonatorSpire', kind: 'unlock', era: 4, costRes: 'pr', baseCost: 1500000, growth: null, maxLevel: null,
        tree: { col: 0, row: 1 }, branch: 'convergence',
        effects: [{ type: 'convert', amount: 0.2, res: 'rs' }],
        requires: [{ type: 'tech', id: 'pressureVesselBlueprint', minLevel: 1 }],
      },
      harmonicCoil: {
        id: 'harmonicCoil', kind: 'repeatable', era: 4, costRes: 'rs', baseCost: 200, growth: 1.3, maxLevel: 25,
        tree: { col: 1, row: 0 }, branch: 'mechanical',
        effects: [{ type: 'convert', amount: 0.1, res: 'rs' }],
        requires: [{ type: 'tech', id: 'resonatorSpire', minLevel: 1 }],
      },
      pressureResonator: {
        id: 'pressureResonator', kind: 'repeatable', era: 4, costRes: 'pr', baseCost: 1000000, growth: 1.35, maxLevel: 20,
        tree: { col: 1, row: 2 }, branch: 'automation',
        effects: [{ type: 'autoAdd', amount: 3, res: 'rs' }],
        requires: [{ type: 'tech', id: 'resonatorSpire', minLevel: 1 }],
      },
      crankServo: {
        id: 'crankServo', kind: 'repeatable', era: 4, costRes: 'me', baseCost: 300000, growth: 1.5, maxLevel: 10,
        tree: { col: 2, row: 2 }, branch: 'origin',
        effects: [{ type: 'autoClick', perSecond: 1 }],
        requires: [{ type: 'tech', id: 'resonatorSpire', minLevel: 1 }],
      },
      echoCrank: {
        id: 'echoCrank', kind: 'unlock', era: 4, costRes: 'rs', baseCost: 10000, growth: null, maxLevel: null,
        tree: { col: 2, row: 0 }, branch: 'origin',
        effects: [
          { type: 'clickEcho', seconds: 2, res: 'rs' },
          { type: 'clickMult', factor: 5 },
        ],
        requires: [{ type: 'tech', id: 'harmonicCoil', minLevel: 3 }],
      },
      phaseLock: {
        id: 'phaseLock', kind: 'unlock', era: 4, costRes: 'rs', baseCost: 50000, growth: null, maxLevel: null,
        tree: { col: 2, row: 1 }, branch: 'mechanical',
        effects: [{ type: 'rateMult', factor: 1.25, res: 'all' }],
        requires: [{ type: 'tech', id: 'harmonicCoil', minLevel: 5 }],
      },
      standingWave: {
        id: 'standingWave', kind: 'repeatable', era: 4, costRes: 'rs', baseCost: 100000, growth: 1.3, maxLevel: 20,
        tree: { col: 3, row: 1 }, branch: 'mechanical',
        effects: [{ type: 'autoPct', percent: 15, res: 'rs' }],
        requires: [{ type: 'tech', id: 'phaseLock', minLevel: 1 }],
      },
      crystalLattice: {
        id: 'crystalLattice', kind: 'unlock', era: 4, costRes: 'rs', baseCost: 1500000, growth: null, maxLevel: null,
        tree: { col: 4, row: 1 }, branch: 'automation',
        effects: [
          { type: 'rateMult', factor: 2, res: 'pr' },
          { type: 'rateMult', factor: 2, res: 'ee' },
        ],
        requires: [{ type: 'tech', id: 'standingWave', minLevel: 3 }],
      },
      harmonicConvergence: {
        id: 'harmonicConvergence', kind: 'milestone', era: 4, costRes: 'rs', baseCost: 0, growth: null, maxLevel: null,
        tree: { col: 5, row: 1 }, branch: 'convergence',
        effects: [{ type: 'none' }],
        requires: [
          { type: 'tech', id: 'crystalLattice', minLevel: 1 },
          { type: 'tech', id: 'echoCrank', minLevel: 1 },
          { type: 'lifetime', res: 'rs', amount: 30000000 },
        ],
      },
      gridExciter: {
        id: 'gridExciter', kind: 'repeatable', era: 4, costRes: 'ee', baseCost: 2000000, growth: 1.4, maxLevel: null,
        tree: { col: 3, row: 2 }, branch: 'automation',
        effects: [{ type: 'autoPct', percent: 8, res: 'rs' }],
        requires: [{ type: 'tech', id: 'resonatorSpire', minLevel: 1 }],
      },
    };
    expect(ERA_FOUR_IDS).toEqual([
      'resonatorSpire', 'harmonicCoil', 'pressureResonator', 'crankServo', 'echoCrank',
      'phaseLock', 'standingWave', 'crystalLattice', 'harmonicConvergence', 'gridExciter',
    ]);
    for (const id of ERA_FOUR_IDS) {
      expect(project(TECHNOLOGIES[id])).toEqual(expected[id as keyof typeof expected]);
    }
  });

  it('era-IV texts match the spec', () => {
    expect(TECHNOLOGIES.resonatorSpire.description).toBe('A lattice tower over a steam oscillator. Converts PR into resonance.');
    expect(TECHNOLOGIES.resonatorSpire.flavor).toBe('Tower raised. It was already humming.');
    expect(TECHNOLOGIES.harmonicCoil.description).toBe('Toroidal winding on the tower. More RS from the same pressure.');
    expect(TECHNOLOGIES.pressureResonator.description).toBe('Steam whistles on the manifold. +3 RS/s per level.');
    expect(TECHNOLOGIES.crankServo.description).toBe('A gearbox turns the crank for you, offline too. Each auto-crank yields a full click of every energy.');
    expect(TECHNOLOGIES.echoCrank.description).toBe('A fork rings with every turn. Clicks echo 2s of RS; ×5 manual ME.');
    expect(TECHNOLOGIES.phaseLock.description).toBe('Twin mirrors broadcast the locked phase. ×1.25 all production.');
    expect(TECHNOLOGIES.standingWave.description).toBe('The rod holds its note. +15% RS production per level.');
    expect(TECHNOLOGIES.crystalLattice.description).toBe('Quartz in the crown. Doubles PR and EE production.');
    expect(TECHNOLOGIES.harmonicConvergence.description).toBe('Every part of the machine now rings at one frequency.');
    expect(TECHNOLOGIES.harmonicConvergence.flavor).toBe('All frequencies agree. Agreement logged.');
    expect(TECHNOLOGIES.gridExciter.description).toBe('Mains current drives the spire exciter. +8% RS production per level.');
    expect(TECHNOLOGIES.gridExciter.flavor).toBeUndefined();
  });

  it('era-IV techs without a given flavor have none', () => {
    for (const id of ['harmonicCoil', 'pressureResonator', 'crankServo', 'echoCrank', 'phaseLock', 'standingWave', 'crystalLattice', 'gridExciter'] as const) {
      expect(TECHNOLOGIES[id].flavor).toBeUndefined();
    }
  });

  it('era-IV names fit the tree node (19 characters or fewer)', () => {
    for (const id of ERA_FOUR_IDS) {
      expect(TECHNOLOGIES[id].name.length).toBeLessThanOrEqual(19);
    }
    expect(TECHNOLOGIES.harmonicConvergence.name).toBe('Convergence');
  });

  it('era-IV tree positions are unique', () => {
    const keys = ERA_FOUR_IDS.map((id) => `${TECHNOLOGIES[id].tree.col},${TECHNOLOGIES[id].tree.row}`);
    expect(new Set(keys).size).toBe(ERA_FOUR_IDS.length);
  });

  it('costRes: me only on crankServo, ee on gridExciter, pr on resonatorSpire and pressureResonator, rs on the rest', () => {
    const prCost: readonly TechId[] = ['resonatorSpire', 'pressureResonator'];
    for (const id of ERA_FOUR_IDS) {
      const expectedRes = id === 'crankServo' ? 'me' : id === 'gridExciter' ? 'ee' : prCost.includes(id) ? 'pr' : 'rs';
      expect(TECHNOLOGIES[id].costRes).toBe(expectedRes);
    }
    expect(ERA_FOUR_IDS.filter((id) => TECHNOLOGIES[id].costRes === 'me')).toEqual(['crankServo']);
  });

  it('autoClick appears exactly once in the table, on crankServo with perSecond 1', () => {
    const auto = TECH_IDS.flatMap((id) =>
      TECHNOLOGIES[id].effects.filter((e) => e.type === 'autoClick').map((e) => ({ id, effect: e })),
    );
    expect(auto).toEqual([{ id: 'crankServo', effect: { type: 'autoClick', perSecond: 1 } }]);
  });

  it('install lines match the WP10 texts, are unique and fit 60 characters', () => {
    expect(INSTALL_LINES.resonatorSpire).toBe('Tower raised. It was already humming.');
    expect(INSTALL_LINES.harmonicCoil).toBe('Coil wound. The tower rang a note lower.');
    expect(INSTALL_LINES.pressureResonator).toBe('Whistles fitted. Nobody pulled the cord.');
    expect(INSTALL_LINES.crankServo).toBe('Operator input automated. Operator retained.');
    expect(INSTALL_LINES.echoCrank).toBe('The fork answers every turn of the crank.');
    expect(INSTALL_LINES.phaseLock).toBe('Phase locked. To what, not specified.');
    expect(INSTALL_LINES.standingWave).toBe('The wave stopped moving. The tower did not.');
    expect(INSTALL_LINES.crystalLattice).toBe('Crystal seated. It was cut for this socket.');
    expect(INSTALL_LINES.harmonicConvergence).toBe('All frequencies agree. Agreement logged.');
    expect(INSTALL_LINES.gridExciter).toBe('Exciter fed from the mains. The spire hums in phase.');
    const lines = ERA_FOUR_IDS.map((id) => INSTALL_LINES[id]);
    expect(new Set(lines).size).toBe(ERA_FOUR_IDS.length);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(60);
    expect(INSTALL_LINES.resonatorSpire).toBe(TECHNOLOGIES.resonatorSpire.flavor);
    expect(INSTALL_LINES.harmonicConvergence).toBe(TECHNOLOGIES.harmonicConvergence.flavor);
  });

  it('appends the sync, signal and perimeter logs before observer-one and the era V logs, with increasing rs thresholds', () => {
    expect(SYSTEM_LOGS.slice(-7, -3)).toEqual([
      { id: 'sync-success', text: 'Synchronization successful.', trigger: { kind: 'lifetime', res: 'rs', atLeast: 1000 } },
      { id: 'signal-below', text: 'Frequency matches a signal from below the ground.', trigger: { kind: 'lifetime', res: 'rs', atLeast: 1000000 } },
      { id: 'perimeter-phase', text: 'Perimeter moving in phase. Not counted.', trigger: { kind: 'lifetime', res: 'rs', atLeast: 5000000 } },
      { id: 'observer-one', text: 'Observer count: 1.', trigger: { kind: 'lifetime', res: 'rs', atLeast: 20000000 } },
    ]);
    const rsThresholds = SYSTEM_LOGS.flatMap((e) => (e.trigger.kind === 'lifetime' && e.trigger.res === 'rs' ? [e.trigger.atLeast] : []));
    expect(rsThresholds).toEqual([1000, 1000000, 5000000, 20000000]);
  });

  it('plaque line for the convergence milestone is the last milestone line (the ending row follows)', () => {
    expect(PLAQUE_LINES.map((line) => line.milestone)).toEqual([
      null, 'generatorBlueprint', 'substationBlueprint', 'pressureVesselBlueprint', 'harmonicConvergence', 'primaryFunction',
    ]);
    expect(PLAQUE_LINES[4]?.text).toBe('PRIMARY FUNCTION: RESTORE (TARGET: ?)');
  });
});

describe('era V technology table', () => {
  it('matches the C1 table exactly', () => {
    const expected = {
      nullChamber: {
        id: 'nullChamber', kind: 'unlock', era: 5, costRes: 'rs', baseCost: 8000000, growth: null, maxLevel: null,
        tree: { col: 0, row: 1 }, branch: 'convergence',
        effects: [{ type: 'convert', amount: 0.1, res: 'xf' }],
        requires: [{ type: 'tech', id: 'harmonicConvergence', minLevel: 1 }],
      },
      containmentRing: {
        id: 'containmentRing', kind: 'repeatable', era: 5, costRes: 'xf', baseCost: 300, growth: 1.25, maxLevel: 25,
        tree: { col: 1, row: 0 }, branch: 'mechanical',
        effects: [{ type: 'convert', amount: 0.05, res: 'xf' }],
        requires: [{ type: 'tech', id: 'nullChamber', minLevel: 1 }],
      },
      resonantSiphon: {
        id: 'resonantSiphon', kind: 'repeatable', era: 5, costRes: 'rs', baseCost: 10000000, growth: 1.3, maxLevel: 20,
        tree: { col: 1, row: 2 }, branch: 'automation',
        effects: [
          { type: 'autoAdd', amount: 2, res: 'xf' },
          { type: 'autoPct', percent: 5, res: 'xf' },
        ],
        requires: [{ type: 'tech', id: 'nullChamber', minLevel: 1 }],
      },
      graviticAnchor: {
        id: 'graviticAnchor', kind: 'repeatable', era: 5, costRes: 'me', baseCost: 1500000, growth: 1.5, maxLevel: 10,
        tree: { col: 2, row: 2 }, branch: 'origin',
        effects: [{ type: 'rateMult', factor: 1.1, res: 'all' }],
        requires: [{ type: 'tech', id: 'nullChamber', minLevel: 1 }],
      },
      inversionCrank: {
        id: 'inversionCrank', kind: 'unlock', era: 5, costRes: 'xf', baseCost: 4000, growth: null, maxLevel: null,
        tree: { col: 2, row: 0 }, branch: 'origin',
        effects: [{ type: 'clickEcho', seconds: 3, res: 'xf' }],
        requires: [{ type: 'tech', id: 'containmentRing', minLevel: 3 }],
      },
      lensArray: {
        id: 'lensArray', kind: 'unlock', era: 5, costRes: 'xf', baseCost: 12000, growth: null, maxLevel: null,
        tree: { col: 2, row: 1 }, branch: 'mechanical',
        effects: [{ type: 'rateMult', factor: 2, res: 'xf' }],
        requires: [{ type: 'tech', id: 'containmentRing', minLevel: 5 }],
      },
      horizonField: {
        id: 'horizonField', kind: 'repeatable', era: 5, costRes: 'xf', baseCost: 40000, growth: 1.3, maxLevel: 20,
        tree: { col: 3, row: 1 }, branch: 'mechanical',
        effects: [{ type: 'autoPct', percent: 15, res: 'xf' }],
        requires: [{ type: 'tech', id: 'lensArray', minLevel: 1 }],
      },
      skyAperture: {
        id: 'skyAperture', kind: 'unlock', era: 5, costRes: 'xf', baseCost: 10000000, growth: null, maxLevel: null,
        tree: { col: 4, row: 1 }, branch: 'automation',
        effects: [{ type: 'rateMult', factor: 3, res: 'all' }],
        requires: [
          { type: 'tech', id: 'horizonField', minLevel: 5 },
          { type: 'tech', id: 'graviticAnchor', minLevel: 3 },
        ],
      },
      finalAlignment: {
        id: 'finalAlignment', kind: 'milestone', era: 5, costRes: 'xf', baseCost: 0, growth: null, maxLevel: null,
        tree: { col: 5, row: 1 }, branch: 'convergence',
        effects: [{ type: 'none' }],
        requires: [
          { type: 'tech', id: 'skyAperture', minLevel: 1 },
          { type: 'tech', id: 'inversionCrank', minLevel: 1 },
          { type: 'lifetime', res: 'xf', amount: 200000000 },
        ],
      },
      primaryFunction: {
        id: 'primaryFunction', kind: 'unlock', era: 5, costRes: 'xf', baseCost: 500000000, growth: null, maxLevel: null,
        tree: { col: 6, row: 1 }, branch: 'convergence',
        effects: [{ type: 'ending' }],
        requires: [{ type: 'tech', id: 'finalAlignment', minLevel: 1 }],
      },
      mainsBackfeed: {
        id: 'mainsBackfeed', kind: 'repeatable', era: 5, costRes: 'ee', baseCost: 20000000, growth: 1.4, maxLevel: null,
        tree: { col: 3, row: 2 }, branch: 'automation',
        effects: [{ type: 'autoPct', percent: 6, res: 'xf' }],
        requires: [{ type: 'tech', id: 'nullChamber', minLevel: 1 }],
      },
      steamLance: {
        id: 'steamLance', kind: 'repeatable', era: 5, costRes: 'pr', baseCost: 5000000, growth: 1.4, maxLevel: null,
        tree: { col: 4, row: 2 }, branch: 'automation',
        effects: [{ type: 'autoPct', percent: 6, res: 'xf' }],
        requires: [{ type: 'tech', id: 'nullChamber', minLevel: 1 }],
      },
    };
    expect(ERA_FIVE_IDS).toEqual([
      'nullChamber', 'containmentRing', 'resonantSiphon', 'graviticAnchor', 'inversionCrank',
      'lensArray', 'horizonField', 'skyAperture', 'finalAlignment', 'primaryFunction',
      'mainsBackfeed', 'steamLance',
    ]);
    for (const id of ERA_FIVE_IDS) {
      expect(project(TECHNOLOGIES[id])).toEqual(expected[id as keyof typeof expected]);
    }
  });

  it('era-V descriptions and flavors match the C1 texts', () => {
    expect(TECHNOLOGIES.nullChamber.description).toBe('A lantern on the spire holds a sphere of nothing. Converts RS into ???.');
    expect(TECHNOLOGIES.nullChamber.flavor).toBe('Chamber sealed around nothing. Nothing is rising.');
    expect(TECHNOLOGIES.containmentRing.description).toBe('Another ring around the core. More ??? from the same resonance.');
    expect(TECHNOLOGIES.resonantSiphon.description).toBe('Glass siphons arc resonance into the core. +2 ???/s and +5% ??? production per level.');
    expect(TECHNOLOGIES.graviticAnchor.description).toBe('Piles at both ends guy the crown to the ground. ×1.1 all production per level.');
    expect(TECHNOLOGIES.inversionCrank.description).toBe('Every turn leaves a turn going the other way. Clicks echo 3s of ???.');
    expect(TECHNOLOGIES.lensArray.description).toBe('Three lenses gather the core into one line. Doubles ??? production.');
    expect(TECHNOLOGIES.horizonField.description).toBe('The horizon glows on every side. +15% ??? production per level.');
    expect(TECHNOLOGIES.skyAperture.description).toBe('The crown opens to the sky. ×3 all production.');
    expect(TECHNOLOGIES.finalAlignment.description).toBe('Every ring, lens and anchor now points the same way.');
    expect(TECHNOLOGIES.finalAlignment.flavor).toBe('Alignment complete. Awaiting operator.');
    expect(TECHNOLOGIES.primaryFunction.description).toBe('Engage the primary function.');
    expect(TECHNOLOGIES.mainsBackfeed.description).toBe('The grid runs backwards into the null gallery. +6% ??? production per level.');
    expect(TECHNOLOGIES.steamLance.description).toBe('A riser carries live steam up the spire into the chamber. +6% ??? production per level.');
  });

  it('era-V techs without a given flavor have none', () => {
    for (const id of ['containmentRing', 'resonantSiphon', 'graviticAnchor', 'inversionCrank', 'lensArray', 'horizonField', 'skyAperture', 'primaryFunction', 'mainsBackfeed', 'steamLance'] as const) {
      expect(TECHNOLOGIES[id].flavor).toBeUndefined();
    }
  });

  it('every era-V tech is reachable from handCrank', () => {
    const reachable = new Set<TechId>(['handCrank']);
    let changed = true;
    while (changed) {
      changed = false;
      for (const id of TECH_IDS) {
        if (reachable.has(id)) continue;
        const techReqs = TECHNOLOGIES[id].requires.filter((r) => r.type === 'tech');
        if (techReqs.every((r) => r.type === 'tech' && reachable.has(r.id))) {
          reachable.add(id);
          changed = true;
        }
      }
    }
    for (const id of ERA_FIVE_IDS) expect(reachable.has(id)).toBe(true);
  });

  it('every era-V prerequisite chain contains harmonicConvergence', () => {
    const deps = (id: TechId): TechId[] =>
      TECHNOLOGIES[id].requires.flatMap((r) => (r.type === 'tech' ? [r.id] : []));
    for (const id of ERA_FIVE_IDS) {
      const seen = new Set<TechId>();
      const stack: TechId[] = [...deps(id)];
      while (stack.length > 0) {
        const next = stack.pop();
        if (next === undefined || seen.has(next)) continue;
        seen.add(next);
        stack.push(...deps(next));
      }
      expect(seen.has('harmonicConvergence')).toBe(true);
    }
  });

  it('tree positions are unique within era 5', () => {
    const keys = ERA_FIVE_IDS.map((id) => `${TECHNOLOGIES[id].tree.col},${TECHNOLOGIES[id].tree.row}`);
    expect(new Set(keys).size).toBe(ERA_FIVE_IDS.length);
  });

  it('costRes: me on graviticAnchor, ee on mainsBackfeed, pr on steamLance, rs on nullChamber and resonantSiphon, xf on the other seven', () => {
    const otherRes: Partial<Record<TechId, string>> = {
      graviticAnchor: 'me', mainsBackfeed: 'ee', steamLance: 'pr', nullChamber: 'rs', resonantSiphon: 'rs',
    };
    for (const id of ERA_FIVE_IDS) {
      expect(TECHNOLOGIES[id].costRes).toBe(otherRes[id] ?? 'xf');
    }
    expect(ERA_FIVE_IDS.filter((id) => TECHNOLOGIES[id].costRes === 'me')).toEqual(['graviticAnchor']);
  });

  it('era-V names fit the tree node (19 characters or fewer)', () => {
    for (const id of ERA_FIVE_IDS) {
      expect(TECHNOLOGIES[id].name.length).toBeLessThanOrEqual(19);
    }
  });

  it('era V adds only the ending plaque row (six entries, WP13)', () => {
    expect(PLAQUE_LINES).toHaveLength(6);
    expect(PLAQUE_LINES[5]?.milestone).toBe('primaryFunction');
  });

  it('ending effect appears exactly once in the table, on primaryFunction as its only effect', () => {
    const ending = TECH_IDS.flatMap((id) =>
      TECHNOLOGIES[id].effects.filter((e) => e.type === 'ending').map(() => id),
    );
    expect(ending).toEqual(['primaryFunction']);
    expect(TECHNOLOGIES.primaryFunction.effects).toEqual([{ type: 'ending' }]);
  });

  it('install lines: exact era-V texts, every tech has one, all unique, at most 60 characters', () => {
    expect(INSTALL_LINES.nullChamber).toBe('Chamber sealed around nothing. Nothing is rising.');
    expect(INSTALL_LINES.containmentRing).toBe('Ring aligned. The core did not touch it.');
    expect(INSTALL_LINES.resonantSiphon).toBe('Siphon primed. It drinks the hum.');
    expect(INSTALL_LINES.graviticAnchor).toBe('Anchor driven. The ground pulled back.');
    expect(INSTALL_LINES.inversionCrank).toBe('The crank turned twice. Once backwards.');
    expect(INSTALL_LINES.lensArray).toBe('Lenses focused. Target: upward.');
    expect(INSTALL_LINES.horizonField).toBe('Horizon brightened. Sun not consulted.');
    expect(INSTALL_LINES.skyAperture).toBe('Aperture open. The sky looked back.');
    expect(INSTALL_LINES.finalAlignment).toBe('Alignment complete. Awaiting operator.');
    expect(INSTALL_LINES.primaryFunction).toBe('Primary function engaged.');
    expect(INSTALL_LINES.mainsBackfeed).toBe('Backfeed live. The grid answers from above.');
    expect(INSTALL_LINES.steamLance).toBe('Lance seated. Steam climbs where steam should not.');
    for (const id of TECH_IDS) {
      expect(INSTALL_LINES[id].length).toBeGreaterThan(0);
      expect(INSTALL_LINES[id].length).toBeLessThanOrEqual(60);
    }
    expect(new Set(TECH_IDS.map((id) => INSTALL_LINES[id])).size).toBe(TECH_IDS.length);
    expect(INSTALL_LINES.nullChamber).toBe(TECHNOLOGIES.nullChamber.flavor);
    expect(INSTALL_LINES.finalAlignment).toBe(TECHNOLOGIES.finalAlignment.flavor);
  });

  it('appends the three xf logs last, with increasing xf thresholds', () => {
    expect(SYSTEM_LOGS.slice(-3)).toEqual([
      { id: 'units-unknown', text: 'Units not recognized. Continuing.', trigger: { kind: 'lifetime', res: 'xf', atLeast: 1000 } },
      { id: 'cycle-0041', text: 'Cycle {cycle} nearly complete.', trigger: { kind: 'lifetime', res: 'xf', atLeast: 1000000 } },
      { id: 'operator-located', text: 'Operator identity: located.', trigger: { kind: 'lifetime', res: 'xf', atLeast: 100000000 } },
    ]);
    const xfThresholds = SYSTEM_LOGS.flatMap((e) =>
      e.trigger.kind === 'lifetime' && e.trigger.res === 'xf' ? [e.trigger.atLeast] : [],
    );
    expect(xfThresholds).toEqual([1000, 1000000, 100000000]);
  });
});

describe('era I rows are unchanged', () => {
  // Copied from the era-I table at HEAD before WP8.
  const ERA_ONE_LITERAL: Record<string, TechDefinition> = {
    handCrank: {
      id: 'handCrank',
      name: 'Hand Crank',
      kind: 'starting',
      branch: 'origin',
      era: 1,
      costRes: 'me',
      baseCost: 0,
      growth: null,
      maxLevel: null,
      effects: [{ type: 'clickAdd', amount: 1 }],
      requires: [],
      description: 'A rusted crank. Turn it to generate Mechanical Energy.',
      flavor: 'Manual operation detected.',
      tree: { col: 0, row: 1 },
    },
    gearRatio: {
      id: 'gearRatio',
      name: 'Gear Ratio',
      kind: 'repeatable',
      branch: 'mechanical',
      era: 1,
      costRes: 'me',
      baseCost: 15,
      growth: 1.3,
      maxLevel: 15,
      effects: [{ type: 'clickAdd', amount: 1 }],
      requires: [{ type: 'tech', id: 'handCrank', minLevel: 1 }],
      description: 'Better-meshed gears. +1 ME per click per level.',
      tree: { col: 1, row: 0 },
    },
    reinforcedCrank: {
      id: 'reinforcedCrank',
      name: 'Reinforced Crank',
      kind: 'unlock',
      branch: 'mechanical',
      era: 1,
      costRes: 'me',
      baseCost: 2000,
      growth: null,
      maxLevel: null,
      effects: [{ type: 'clickMult', factor: 2 }],
      requires: [{ type: 'tech', id: 'gearRatio', minLevel: 3 }],
      description: 'A sturdier crank arm. Doubles manual production.',
      flavor: 'This component was not designed to be replaced.',
      tree: { col: 2, row: 0 },
    },
    flywheel: {
      id: 'flywheel',
      name: 'Flywheel',
      kind: 'repeatable',
      branch: 'mechanical',
      era: 1,
      costRes: 'me',
      baseCost: 4000,
      growth: 1.35,
      maxLevel: 10,
      effects: [{ type: 'autoPct', percent: 10 }],
      requires: [
        { type: 'tech', id: 'reinforcedCrank', minLevel: 1 },
        { type: 'tech', id: 'wornMotor', minLevel: 1 },
      ],
      description: 'A heavy wheel that stores momentum. +10% automation production per level.',
      tree: { col: 3, row: 0 },
    },
    wornMotor: {
      id: 'wornMotor',
      name: 'Worn Motor',
      kind: 'unlock',
      branch: 'automation',
      era: 1,
      costRes: 'me',
      baseCost: 40,
      growth: null,
      maxLevel: null,
      effects: [{ type: 'autoAdd', amount: 1 }],
      requires: [{ type: 'tech', id: 'handCrank', minLevel: 1 }],
      description: 'A salvaged motor that turns by itself. +1 ME/s.',
      flavor: 'Synchronization unsuccessful.',
      tree: { col: 1, row: 2 },
    },
    motorTuning: {
      id: 'motorTuning',
      name: 'Motor Tuning',
      kind: 'repeatable',
      branch: 'automation',
      era: 1,
      costRes: 'me',
      baseCost: 60,
      growth: 1.3,
      maxLevel: 25,
      effects: [{ type: 'autoAdd', amount: 1 }],
      requires: [{ type: 'tech', id: 'wornMotor', minLevel: 1 }],
      description: 'Adjustments to the worn motor. +1 ME/s per level.',
      tree: { col: 2, row: 2 },
    },
    pistonArray: {
      id: 'pistonArray',
      name: 'Piston Array',
      kind: 'unlock',
      branch: 'automation',
      era: 1,
      costRes: 'me',
      baseCost: 12000,
      growth: null,
      maxLevel: null,
      effects: [{ type: 'autoAdd', amount: 5 }],
      requires: [{ type: 'tech', id: 'motorTuning', minLevel: 5 }],
      description: 'Rows of pistons hammering in sequence. +5 ME/s.',
      tree: { col: 3, row: 2 },
    },
    improvedPistons: {
      id: 'improvedPistons',
      name: 'Improved Pistons',
      kind: 'repeatable',
      branch: 'automation',
      era: 1,
      costRes: 'me',
      baseCost: 6000,
      growth: 1.3,
      maxLevel: 25,
      effects: [{ type: 'autoAdd', amount: 2 }],
      requires: [{ type: 'tech', id: 'pistonArray', minLevel: 1 }],
      description: 'Tighter tolerances, harder strokes. +2 ME/s per level.',
      tree: { col: 4, row: 2 },
    },
    generatorBlueprint: {
      id: 'generatorBlueprint',
      name: 'Generator Blueprint',
      kind: 'milestone',
      branch: 'convergence',
      era: 1,
      costRes: 'me',
      baseCost: 0,
      growth: null,
      maxLevel: null,
      effects: [{ type: 'none' }],
      requires: [
        { type: 'tech', id: 'pistonArray', minLevel: 1 },
        { type: 'tech', id: 'flywheel', minLevel: 1 },
        { type: 'lifetime', res: 'me', amount: 200000 },
      ],
      description: 'Something in the machine has begun to resemble a plan.',
      flavor: 'Primary function: UNKNOWN.',
      tree: { col: 4, row: 1 },
    },
  };

  it('every era-I definition deep-equals the HEAD literal', () => {
    expect(Object.keys(ERA_ONE_LITERAL)).toHaveLength(9);
    for (const id of ERA_ONE_IDS) {
      expect(TECHNOLOGIES[id]).toEqual(ERA_ONE_LITERAL[id]);
    }
  });
});

describe('plaque lines', () => {
  it('first line is always owned, then the milestones in order', () => {
    expect(PLAQUE_LINES).toHaveLength(6);
    expect(PLAQUE_LINES[0]?.milestone).toBeNull();
    expect(PLAQUE_LINES[5]?.milestone).toBe('primaryFunction'); // the ending tech (unlock), revealed text
    for (const line of PLAQUE_LINES.slice(1, 5)) {
      expect(line.milestone).not.toBeNull();
      if (line.milestone !== null) {
        expect(TECHNOLOGIES[line.milestone].kind).toBe('milestone');
      }
    }
  });

  it('has the C5 texts in order', () => {
    expect(PLAQUE_LINES).toEqual([
      { milestone: null, text: 'PRIMARY FUNCTION: UNKNOWN' },
      { milestone: 'generatorBlueprint', text: 'PRIMARY FUNCTION: R?S????' },
      { milestone: 'substationBlueprint', text: 'PRIMARY FUNCTION: RES?OR?' },
      { milestone: 'pressureVesselBlueprint', text: 'PRIMARY FUNCTION: REST?RE' },
      { milestone: 'harmonicConvergence', text: 'PRIMARY FUNCTION: RESTORE (TARGET: ?)' },
      { milestone: 'primaryFunction', text: 'PRIMARY FUNCTION: RESTORE' },
    ]);
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

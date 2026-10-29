import { describe, it, expect } from 'vitest';
import { RESOURCE_IDS, TECH_IDS } from './types';
import type { TechDefinition, TechId, Requirement } from './types';
import { RESOURCES } from './resources';
import { TECHNOLOGIES, TECH_LIST } from './technologies';
import { PLAQUE_LINES } from './story';
import { INSTALL_LINES } from './notifications';
import { SYSTEM_LOGS } from './systemLogs';
import { OFFLINE_CAP_SECONDS, MAX_UPDATE_SECONDS, AUTOSAVE_INTERVAL_MS, SAVE_KEY, SAVE_BACKUP_KEY } from './balance';
import { SPLIT_PARTS } from './pacing';

// WP28: the 16 Splices (branch 'splice') sit in no era table; they are pinned by their own guards below.
const ERA_ONE_IDS = TECH_IDS.filter((id) => TECHNOLOGIES[id].era === 1 && TECHNOLOGIES[id].branch !== 'splice');
const ERA_TWO_IDS = TECH_IDS.filter((id) => TECHNOLOGIES[id].era === 2 && TECHNOLOGIES[id].branch !== 'splice');
const ERA_THREE_IDS = TECH_IDS.filter((id) => TECHNOLOGIES[id].era === 3 && TECHNOLOGIES[id].branch !== 'splice');
const ERA_FOUR_IDS = TECH_IDS.filter((id) => TECHNOLOGIES[id].era === 4 && TECHNOLOGIES[id].branch !== 'splice');
const ERA_FIVE_IDS = TECH_IDS.filter((id) => TECHNOLOGIES[id].era === 5 && TECHNOLOGIES[id].branch !== 'splice');
// WP28: the 16 Splices in TECH_IDS tail order (src/data/splices.ts).
const SPLICE_IDS = [
  'spliceBicycle', 'spliceOrgan', 'spliceClock', 'spliceRadio', 'splicePayphone', 'spliceSign', 'splicePump', 'spliceWhistle',
  'spliceHydrant', 'spliceBell', 'spliceGramophone', 'spliceChimes', 'spliceVane', 'spliceKite', 'spliceCairn', 'spliceCoinReturn',
] as const;

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
    expect(TECH_LIST).toHaveLength(71);
    expect(TECH_LIST.map((t) => t.id)).toEqual([...TECH_IDS]);
  });

  it('the 16 Splices are the tail of TECH_IDS in table order, and the five WP27 techs precede them', () => {
    expect(TECH_IDS.slice(-16)).toEqual([...SPLICE_IDS]);
    expect(TECH_IDS.slice(-21, -16)).toEqual(['faultLamp', 'dischargeLever', 'leakWhistle', 'dampingFork', 'overrunClutch']);
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
    // WP28 REC: the uncapped steps are cheaper (growth 1.1187 to 1.1447), pinned exactly.
    expect(TECHNOLOGIES.bellowsDrive.growth).toBe(1.1447);
    expect(TECHNOLOGIES.gridExciter.growth).toBe(1.1187);
    expect(TECHNOLOGIES.mainsBackfeed.growth).toBe(1.1187);
    expect(TECHNOLOGIES.steamLance.growth).toBe(1.1187);
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
    // WHY: era IV has no ME repeatable since crankServo moved to era II (WP25). The ME sink there is bellowsDrive
    // (uncapped, era III, still buyable in era IV). Continuity A (WP25 Balance targets): ME spend 92 %, dead 4.0 min.
    expect(missing).toEqual(['me@era4']);
  });

  it('era IV ME sink: bellowsDrive is an uncapped ME repeatable from era III', () => {
    const def = TECHNOLOGIES.bellowsDrive;
    expect(def.kind).toBe('repeatable');
    expect(def.maxLevel).toBeNull();
    expect(def.costRes).toBe('me');
    expect(def.era).toBe(3);
  });

  it('Legacy Feed names fit the tree node (19 characters or fewer)', () => {
    for (const id of ['bellowsDrive', 'gridExciter', 'mainsBackfeed', 'steamLance'] as const) {
      expect(TECHNOLOGIES[id].name.length).toBeLessThanOrEqual(19);
    }
  });

  it('tree positions are unique per era', () => {
    // WP28: Splices share the placeholder tree {0, 0} (the tree hint is never laid out), so they are not checked here.
    const keys = TECH_IDS.filter((id) => TECHNOLOGIES[id].branch !== 'splice').map((id) => {
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
      reinforcedCrank: ['unlock', 1200, null, null],
      flywheel: ['repeatable', 4000, 1.35, 10],
      wornMotor: ['unlock', 40, null, null],
      motorTuning: ['repeatable', 60, 1.3, 25],
      pistonArray: ['unlock', 3000, null, null],
      improvedPistons: ['repeatable', 3000, 1.3, 25],
      generatorBlueprint: ['milestone', 0, null, null],
      generator: ['unlock', 60000, null, null],
      copperWinding: ['repeatable', 27, 1.2247, 50],
      motorRetrofit: ['repeatable', 9250, 1.1619, 40],
      dynamoCrank: ['unlock', 1200, null, null],
      capacitorBank: ['unlock', 1625, null, null],
      sparkGap: ['unlock', 6500, null, null],
      transformer: ['repeatable', 2250, 1.2247, 40],
      powerLines: ['unlock', 130000, null, null],
      substationBlueprint: ['milestone', 0, null, null],
      boiler: ['unlock', 650000, null, null],
      firebox: ['repeatable', 467, 1.1402, 50],
      inductionHeater: ['repeatable', 90200, 1.1052, 60],
      steamHammer: ['unlock', 6500, null, null],
      superheater: ['unlock', 26000, null, null],
      condenser: ['repeatable', 18300, 1.0914, 60],
      turbine: ['unlock', 195000, null, null],
      reliefValves: ['unlock', 520000, null, null],
      pressureVesselBlueprint: ['milestone', 0, null, null],
      resonatorSpire: ['unlock', 900000, null, null],
      harmonicCoil: ['repeatable', 93, 1.1402, 50],
      pressureResonator: ['repeatable', 463000, 1.1619, 40],
      crankServo: ['repeatable', 30000, 2, 10],
      echoCrank: ['unlock', 6500, null, null],
      phaseLock: ['unlock', 32500, null, null],
      standingWave: ['repeatable', 46700, 1.1402, 40],
      crystalLattice: ['unlock', 975000, null, null],
      harmonicConvergence: ['milestone', 0, null, null],
      nullChamber: ['unlock', 5200000, null, null],
      containmentRing: ['repeatable', 142, 1.118, 50],
      resonantSiphon: ['repeatable', 3080000, 1.0801, 60],
      graviticAnchor: ['repeatable', 621000, 1.4142, 20],
      inversionCrank: ['unlock', 2600, null, null],
      lensArray: ['unlock', 7800, null, null],
      horizonField: ['repeatable', 18700, 1.1402, 40],
      skyAperture: ['unlock', 6500000, null, null],
      finalAlignment: ['milestone', 0, null, null],
      primaryFunction: ['unlock', 500000000, null, null],
      bellowsDrive: ['repeatable', 86800, 1.1447, null],
      gridExciter: ['repeatable', 593000, 1.1187, null],
      mainsBackfeed: ['repeatable', 5930000, 1.1187, null],
      steamLance: ['repeatable', 1480000, 1.1187, null],
      faultLamp: ['unlock', 3000, null, null],
      dischargeLever: ['unlock', 13000, null, null],
      leakWhistle: ['unlock', 65000, null, null],
      dampingFork: ['unlock', 195000, null, null],
      overrunClutch: ['unlock', 32500, null, null],
      spliceBicycle: ['unlock', 900, null, null],
      spliceOrgan: ['unlock', 12000, null, null],
      spliceClock: ['unlock', 10000, null, null],
      spliceRadio: ['unlock', 270000, null, null],
      splicePayphone: ['unlock', 130000, null, null],
      spliceSign: ['unlock', 2300000, null, null],
      splicePump: ['unlock', 250000, null, null],
      spliceWhistle: ['unlock', 6500000, null, null],
      spliceHydrant: ['unlock', 650000, null, null],
      spliceBell: ['unlock', 630000, null, null],
      spliceGramophone: ['unlock', 12000000, null, null],
      spliceChimes: ['unlock', 1400000, null, null],
      spliceVane: ['unlock', 2100000, null, null],
      spliceKite: ['unlock', 15000000, null, null],
      spliceCairn: ['unlock', 9500000, null, null],
      spliceCoinReturn: ['unlock', 64000000, null, null],
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
    expect(TECHNOLOGIES.reinforcedCrank.effects).toEqual([
      { type: 'crankEcho', seconds: 0.15 },
      { type: 'windup', seconds: 0.35, refill: 0.035 },
    ]);
    expect(TECHNOLOGIES.reinforcedCrank.requires).toEqual([{ type: 'tech', id: 'gearRatio', minLevel: 3 }]);
  });

  it('flywheel effects', () => {
    expect(TECHNOLOGIES.flywheel.effects).toEqual([
      { type: 'autoPct', percent: 10 },
      { type: 'windup', seconds: 0.015, refill: 0.0015 },
    ]);
  });

  it('generatorBlueprint is a zero-cost milestone with the spec requirements', () => {
    const gb = TECHNOLOGIES.generatorBlueprint;
    expect(gb.kind).toBe('milestone');
    expect(gb.baseCost).toBe(0);
    expect(gb.requires).toEqual([
      { type: 'tech', id: 'pistonArray', minLevel: 1 },
      { type: 'tech', id: 'flywheel', minLevel: 1 },
      { type: 'lifetime', res: 'me', amount: 400000 },
    ]);
  });

  it('all era-I techs are era 1 and cost ME', () => {
    expect(ERA_ONE_IDS).toHaveLength(10);
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
        id: 'generator', kind: 'unlock', era: 2, costRes: 'me', baseCost: 60000, growth: null, maxLevel: null,
        tree: { col: 0, row: 1 }, branch: 'convergence',
        effects: [{ type: 'convert', amount: 0.14, res: 'ee' }],
        requires: [{ type: 'tech', id: 'generatorBlueprint', minLevel: 1 }],
      },
      copperWinding: {
        id: 'copperWinding', kind: 'repeatable', era: 2, costRes: 'ee', baseCost: 27, growth: 1.2247, maxLevel: 50,
        tree: { col: 1, row: 0 }, branch: 'mechanical',
        effects: [{ type: 'convert', amount: 0.034, res: 'ee' }],
        requires: [{ type: 'tech', id: 'generator', minLevel: 1 }],
      },
      motorRetrofit: {
        id: 'motorRetrofit', kind: 'repeatable', era: 2, costRes: 'me', baseCost: 9250, growth: 1.1619, maxLevel: 40,
        tree: { col: 1, row: 2 }, branch: 'automation',
        effects: [{ type: 'autoAdd', amount: 25 }],
        requires: [{ type: 'tech', id: 'generator', minLevel: 1 }],
      },
      dynamoCrank: {
        id: 'dynamoCrank', kind: 'unlock', era: 2, costRes: 'ee', baseCost: 1200, growth: null, maxLevel: null,
        tree: { col: 2, row: 0 }, branch: 'origin',
        effects: [{ type: 'crankEcho', seconds: 0.3 }],
        requires: [{ type: 'tech', id: 'copperWinding', minLevel: 6 }],
      },
      capacitorBank: {
        id: 'capacitorBank', kind: 'unlock', era: 2, costRes: 'ee', baseCost: 1625, growth: null, maxLevel: null,
        tree: { col: 2, row: 1 }, branch: 'mechanical',
        effects: [{ type: 'rateMult', factor: 2, res: 'ee' }],
        requires: [{ type: 'tech', id: 'copperWinding', minLevel: 10 }],
      },
      sparkGap: {
        id: 'sparkGap', kind: 'unlock', era: 2, costRes: 'ee', baseCost: 6500, growth: null, maxLevel: null,
        tree: { col: 3, row: 0 }, branch: 'origin',
        effects: [{ type: 'clickMult', factor: 1.5 }],
        requires: [{ type: 'tech', id: 'dynamoCrank', minLevel: 1 }],
      },
      transformer: {
        id: 'transformer', kind: 'repeatable', era: 2, costRes: 'ee', baseCost: 2250, growth: 1.2247, maxLevel: 40,
        tree: { col: 3, row: 1 }, branch: 'mechanical',
        effects: [{ type: 'autoPct', percent: 7.5, res: 'ee' }],
        requires: [{ type: 'tech', id: 'capacitorBank', minLevel: 1 }],
      },
      powerLines: {
        id: 'powerLines', kind: 'unlock', era: 2, costRes: 'ee', baseCost: 130000, growth: null, maxLevel: null,
        tree: { col: 4, row: 2 }, branch: 'automation',
        effects: [{ type: 'rateMult', factor: 2, res: 'me' }],
        requires: [
          { type: 'tech', id: 'transformer', minLevel: 6 },
          { type: 'tech', id: 'motorRetrofit', minLevel: 10 },
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
      crankServo: {
        id: 'crankServo', kind: 'repeatable', era: 2, costRes: 'me', baseCost: 30000, growth: 2, maxLevel: 10,
        tree: { col: 2, row: 2 }, branch: 'origin',
        effects: [{ type: 'autoClick', perSecond: 1 }],
        requires: [{ type: 'tech', id: 'motorRetrofit', minLevel: 2 }],
      },
      dischargeLever: {
        id: 'dischargeLever', kind: 'unlock', era: 2, costRes: 'ee', baseCost: 13000, growth: null, maxLevel: null,
        tree: { col: 5, row: 0 }, branch: 'origin',
        effects: [{ type: 'windup', seconds: 0.375, refill: 0.0375 }, { type: 'faultSeconds', seconds: 3 }],
        requires: [{ type: 'tech', id: 'sparkGap', minLevel: 1 }],
      },
    };
    expect(ERA_TWO_IDS).toEqual([
      'generator', 'copperWinding', 'motorRetrofit', 'dynamoCrank', 'capacitorBank',
      'sparkGap', 'transformer', 'powerLines', 'substationBlueprint', 'crankServo', 'dischargeLever',
    ]);
    for (const id of ERA_TWO_IDS) {
      expect(project(TECHNOLOGIES[id])).toEqual(expected[id as keyof typeof expected]);
    }
  });

  it('era-II texts match the spec', () => {
    expect(TECHNOLOGIES.generator.description).toBe('A coil and a magnet. Converts motion into current.');
    expect(TECHNOLOGIES.generator.flavor).toBe('Current detected. Destination: unlisted.');
    expect(TECHNOLOGIES.copperWinding.description).toBe('Tighter copper turns. More EE from the same motion.');
    expect(TECHNOLOGIES.motorRetrofit.description).toBe('The old motor, rewired. +25 ME/s per level.');
    expect(TECHNOLOGIES.dynamoCrank.description).toBe('The crank now feeds a dynamo. Clicks echo 0.3s of all output.');
    expect(TECHNOLOGIES.capacitorBank.description).toBe('Stores a surge and releases it later. Doubles EE production.');
    expect(TECHNOLOGIES.sparkGap.description).toBe('A gap that should not conduct. It does. ×1.5 manual production.');
    expect(TECHNOLOGIES.transformer.description).toBe('Steps voltage. Nobody specified which way. +7.5% EE production per level.');
    expect(TECHNOLOGIES.powerLines.description).toBe('Lines run toward nothing. Doubles ME production.');
    expect(TECHNOLOGIES.substationBlueprint.description).toBe('The machine has begun to resemble a grid node.');
    expect(TECHNOLOGIES.substationBlueprint.flavor).toBe('Grid handshake… no response from grid.');
    expect(TECHNOLOGIES.dischargeLever.description).toBe(
      'A lever trips the stored charge. +0.375s wind-up, +0.0375s/s refill; cleared faults pay +3s.',
    );
  });

  it('era-II techs without a given flavor have none', () => {
    for (const id of ['copperWinding', 'motorRetrofit', 'dynamoCrank', 'capacitorBank', 'sparkGap', 'transformer', 'powerLines', 'crankServo', 'dischargeLever'] as const) {
      expect(TECHNOLOGIES[id].flavor).toBeUndefined();
    }
  });

  it('era-II costRes: ee except generator, motorRetrofit and crankServo (me), era I never ee', () => {
    for (const id of ERA_ONE_IDS) expect(TECHNOLOGIES[id].costRes).not.toBe('ee');
    // generator, motorRetrofit and crankServo are bought with ME (crankServo moved here in WP25); the rest of era II costs EE.
    const meCost: readonly TechId[] = ['generator', 'motorRetrofit', 'crankServo'];
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
        id: 'boiler', kind: 'unlock', era: 3, costRes: 'ee', baseCost: 650000, growth: null, maxLevel: null,
        tree: { col: 0, row: 1 }, branch: 'convergence',
        effects: [{ type: 'convert', amount: 0.11, res: 'pr' }],
        requires: [{ type: 'tech', id: 'substationBlueprint', minLevel: 1 }],
      },
      firebox: {
        id: 'firebox', kind: 'repeatable', era: 3, costRes: 'pr', baseCost: 467, growth: 1.1402, maxLevel: 50,
        tree: { col: 1, row: 0 }, branch: 'mechanical',
        effects: [{ type: 'convert', amount: 0.0295, res: 'pr' }],
        requires: [{ type: 'tech', id: 'boiler', minLevel: 1 }],
      },
      inductionHeater: {
        id: 'inductionHeater', kind: 'repeatable', era: 3, costRes: 'ee', baseCost: 90200, growth: 1.1052, maxLevel: 60,
        tree: { col: 1, row: 2 }, branch: 'automation',
        effects: [{ type: 'autoAdd', amount: 0.65, res: 'pr' }],
        requires: [{ type: 'tech', id: 'boiler', minLevel: 1 }],
      },
      steamHammer: {
        id: 'steamHammer', kind: 'unlock', era: 3, costRes: 'pr', baseCost: 6500, growth: null, maxLevel: null,
        tree: { col: 2, row: 0 }, branch: 'origin',
        effects: [{ type: 'windup', seconds: 0.375, refill: 0.0375 }],
        requires: [{ type: 'tech', id: 'firebox', minLevel: 6 }],
      },
      superheater: {
        id: 'superheater', kind: 'unlock', era: 3, costRes: 'pr', baseCost: 26000, growth: null, maxLevel: null,
        tree: { col: 2, row: 1 }, branch: 'mechanical',
        effects: [{ type: 'rateMult', factor: 2, res: 'pr' }],
        requires: [{ type: 'tech', id: 'firebox', minLevel: 10 }],
      },
      condenser: {
        id: 'condenser', kind: 'repeatable', era: 3, costRes: 'pr', baseCost: 18300, growth: 1.0914, maxLevel: 60,
        tree: { col: 3, row: 1 }, branch: 'mechanical',
        effects: [{ type: 'autoPct', percent: 5, res: 'pr' }],
        requires: [{ type: 'tech', id: 'superheater', minLevel: 1 }],
      },
      turbine: {
        id: 'turbine', kind: 'unlock', era: 3, costRes: 'pr', baseCost: 195000, growth: null, maxLevel: null,
        tree: { col: 4, row: 1 }, branch: 'automation',
        effects: [{ type: 'rateMult', factor: 2, res: 'ee' }],
        requires: [{ type: 'tech', id: 'condenser', minLevel: 9 }],
      },
      reliefValves: {
        id: 'reliefValves', kind: 'unlock', era: 3, costRes: 'pr', baseCost: 520000, growth: null, maxLevel: null,
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
          { type: 'tech', id: 'condenser', minLevel: 15 },
          { type: 'lifetime', res: 'pr', amount: 6000000 },
        ],
      },
      bellowsDrive: {
        id: 'bellowsDrive', kind: 'repeatable', era: 3, costRes: 'me', baseCost: 86800, growth: 1.1447, maxLevel: null,
        tree: { col: 3, row: 2 }, branch: 'automation',
        effects: [{ type: 'autoPct', percent: 2.5, res: 'pr' }],
        requires: [{ type: 'tech', id: 'boiler', minLevel: 1 }],
      },
      leakWhistle: {
        id: 'leakWhistle', kind: 'unlock', era: 3, costRes: 'pr', baseCost: 65000, growth: null, maxLevel: null,
        tree: { col: 4, row: 2 }, branch: 'origin',
        effects: [{ type: 'faultRate', factor: 0.9 }],
        requires: [{ type: 'tech', id: 'bellowsDrive', minLevel: 3 }],
      },
    };
    expect(ERA_THREE_IDS).toEqual([
      'boiler', 'firebox', 'inductionHeater', 'steamHammer', 'superheater',
      'condenser', 'turbine', 'reliefValves', 'pressureVesselBlueprint', 'bellowsDrive', 'leakWhistle',
    ]);
    for (const id of ERA_THREE_IDS) {
      expect(project(TECHNOLOGIES[id])).toEqual(expected[id as keyof typeof expected]);
    }
  });

  it('era-III texts match the spec', () => {
    expect(TECHNOLOGIES.boiler.description).toBe('A sealed drum over a flame. Converts EE into pressure.');
    expect(TECHNOLOGIES.boiler.flavor).toBe('Pressure detected. Vessel rating: unlisted.');
    expect(TECHNOLOGIES.firebox.description).toBe('Fuel the fire. More PR from the same current.');
    expect(TECHNOLOGIES.inductionHeater.description).toBe('Current turned to heat. +0.65 PR/s per level.');
    expect(TECHNOLOGIES.steamHammer.description).toBe(
      'A ram on the main shaft. It cocks between turns: +0.375s wind-up, +0.0375s/s refill.',
    );
    expect(TECHNOLOGIES.leakWhistle.description).toBe('A whistle on every seam the bellows reach. Fault interval ×0.9.');
    expect(TECHNOLOGIES.superheater.description).toBe('Steam heated past its rating. Doubles PR production.');
    expect(TECHNOLOGIES.condenser.description).toBe('Returns the water. +5% PR production per level.');
    expect(TECHNOLOGIES.turbine.description).toBe('Steam spins a wheel. Doubles EE production.');
    expect(TECHNOLOGIES.reliefValves.description).toBe('Vents what the vessel cannot hold. +4h offline buffer.');
    expect(TECHNOLOGIES.pressureVesselBlueprint.description).toBe('The machine now resembles something that holds pressure.');
    expect(TECHNOLOGIES.pressureVesselBlueprint.flavor).toBe('Containment rating exceeded by design.');
    expect(TECHNOLOGIES.bellowsDrive.description).toBe('The old drive train works a bellows into the firebox. +2.5% PR production per level.');
    expect(TECHNOLOGIES.bellowsDrive.flavor).toBeUndefined();
  });

  it('era-III techs without a given flavor have none', () => {
    for (const id of ['firebox', 'inductionHeater', 'steamHammer', 'superheater', 'condenser', 'turbine', 'reliefValves', 'bellowsDrive', 'leakWhistle'] as const) {
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
        id: 'resonatorSpire', kind: 'unlock', era: 4, costRes: 'pr', baseCost: 900000, growth: null, maxLevel: null,
        tree: { col: 0, row: 1 }, branch: 'convergence',
        effects: [{ type: 'convert', amount: 0.45, res: 'rs' }],
        requires: [{ type: 'tech', id: 'pressureVesselBlueprint', minLevel: 1 }],
      },
      harmonicCoil: {
        id: 'harmonicCoil', kind: 'repeatable', era: 4, costRes: 'rs', baseCost: 93, growth: 1.1402, maxLevel: 50,
        tree: { col: 1, row: 0 }, branch: 'mechanical',
        effects: [{ type: 'convert', amount: 0.11, res: 'rs' }],
        requires: [{ type: 'tech', id: 'resonatorSpire', minLevel: 1 }],
      },
      pressureResonator: {
        id: 'pressureResonator', kind: 'repeatable', era: 4, costRes: 'pr', baseCost: 463000, growth: 1.1619, maxLevel: 40,
        tree: { col: 1, row: 2 }, branch: 'automation',
        effects: [{ type: 'autoAdd', amount: 3.45, res: 'rs' }],
        requires: [{ type: 'tech', id: 'resonatorSpire', minLevel: 1 }],
      },
      echoCrank: {
        id: 'echoCrank', kind: 'unlock', era: 4, costRes: 'rs', baseCost: 6500, growth: null, maxLevel: null,
        tree: { col: 4, row: 0 }, branch: 'origin',
        effects: [
          { type: 'crankEcho', seconds: 0.05 },
          { type: 'clickMult', factor: 2 },
        ],
        requires: [{ type: 'tech', id: 'harmonicCoil', minLevel: 6 }],
      },
      phaseLock: {
        id: 'phaseLock', kind: 'unlock', era: 4, costRes: 'rs', baseCost: 32500, growth: null, maxLevel: null,
        tree: { col: 2, row: 1 }, branch: 'mechanical',
        effects: [{ type: 'rateMult', factor: 1.25, res: 'all' }],
        requires: [{ type: 'tech', id: 'harmonicCoil', minLevel: 10 }],
      },
      standingWave: {
        id: 'standingWave', kind: 'repeatable', era: 4, costRes: 'rs', baseCost: 46700, growth: 1.1402, maxLevel: 40,
        tree: { col: 3, row: 1 }, branch: 'mechanical',
        effects: [{ type: 'autoPct', percent: 7.5, res: 'rs' }],
        requires: [{ type: 'tech', id: 'phaseLock', minLevel: 1 }],
      },
      crystalLattice: {
        id: 'crystalLattice', kind: 'unlock', era: 4, costRes: 'rs', baseCost: 975000, growth: null, maxLevel: null,
        tree: { col: 4, row: 1 }, branch: 'automation',
        effects: [
          { type: 'rateMult', factor: 2, res: 'pr' },
          { type: 'rateMult', factor: 2, res: 'ee' },
        ],
        requires: [{ type: 'tech', id: 'standingWave', minLevel: 6 }],
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
        id: 'gridExciter', kind: 'repeatable', era: 4, costRes: 'ee', baseCost: 593000, growth: 1.1187, maxLevel: null,
        tree: { col: 3, row: 2 }, branch: 'automation',
        effects: [{ type: 'autoPct', percent: 2.5, res: 'rs' }],
        requires: [{ type: 'tech', id: 'resonatorSpire', minLevel: 1 }],
      },
      dampingFork: {
        id: 'dampingFork', kind: 'unlock', era: 4, costRes: 'rs', baseCost: 195000, growth: null, maxLevel: null,
        tree: { col: 5, row: 0 }, branch: 'origin',
        effects: [
          { type: 'windup', seconds: 0.375, refill: 0.0375 },
          { type: 'faultWindow', seconds: 4 },
          { type: 'faultSeconds', seconds: 4 },
        ],
        requires: [{ type: 'tech', id: 'echoCrank', minLevel: 1 }],
      },
    };
    expect(ERA_FOUR_IDS).toEqual([
      'resonatorSpire', 'harmonicCoil', 'pressureResonator', 'echoCrank',
      'phaseLock', 'standingWave', 'crystalLattice', 'harmonicConvergence', 'gridExciter', 'dampingFork',
    ]);
    for (const id of ERA_FOUR_IDS) {
      expect(project(TECHNOLOGIES[id])).toEqual(expected[id as keyof typeof expected]);
    }
  });

  it('era-IV texts match the spec', () => {
    expect(TECHNOLOGIES.resonatorSpire.description).toBe('A lattice tower over a steam oscillator. Converts PR into resonance.');
    expect(TECHNOLOGIES.resonatorSpire.flavor).toBe('Tower raised. It was already humming.');
    expect(TECHNOLOGIES.harmonicCoil.description).toBe('Toroidal winding on the tower. More RS from the same pressure.');
    expect(TECHNOLOGIES.pressureResonator.description).toBe('Steam whistles on the manifold. +3.45 RS/s per level.');
    expect(TECHNOLOGIES.crankServo.description).toBe('A gearbox turns the crank for you, offline too. Each auto-crank yields a full click of every energy.');
    expect(TECHNOLOGIES.echoCrank.description).toBe('A fork rings with every turn. Clicks echo 0.05s of all output; ×2 manual ME.');
    expect(TECHNOLOGIES.dampingFork.description).toBe(
      'A second fork rings ahead of each fault. +0.375s wind-up, +0.0375s/s refill; faults last +4s and pay +4s.',
    );
    expect(TECHNOLOGIES.phaseLock.description).toBe('Twin mirrors broadcast the locked phase. ×1.25 all production.');
    expect(TECHNOLOGIES.standingWave.description).toBe('The rod holds its note. +7.5% RS production per level.');
    expect(TECHNOLOGIES.crystalLattice.description).toBe('Quartz in the crown. Doubles PR and EE production.');
    expect(TECHNOLOGIES.harmonicConvergence.description).toBe('Every part of the machine now rings at one frequency.');
    expect(TECHNOLOGIES.harmonicConvergence.flavor).toBe('All frequencies agree. Agreement logged.');
    expect(TECHNOLOGIES.gridExciter.description).toBe('Mains current drives the spire exciter. +2.5% RS production per level.');
    expect(TECHNOLOGIES.gridExciter.flavor).toBeUndefined();
  });

  it('era-IV techs without a given flavor have none', () => {
    for (const id of ['harmonicCoil', 'pressureResonator', 'echoCrank', 'phaseLock', 'standingWave', 'crystalLattice', 'gridExciter', 'dampingFork'] as const) {
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

  it('costRes: no me in era IV, ee on gridExciter, pr on resonatorSpire and pressureResonator, rs on the rest', () => {
    const prCost: readonly TechId[] = ['resonatorSpire', 'pressureResonator'];
    for (const id of ERA_FOUR_IDS) {
      const expectedRes = id === 'gridExciter' ? 'ee' : prCost.includes(id) ? 'pr' : 'rs';
      expect(TECHNOLOGIES[id].costRes).toBe(expectedRes);
    }
    expect(ERA_FOUR_IDS.filter((id) => TECHNOLOGIES[id].costRes === 'me')).toEqual([]);
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
        id: 'nullChamber', kind: 'unlock', era: 5, costRes: 'rs', baseCost: 5200000, growth: null, maxLevel: null,
        tree: { col: 0, row: 1 }, branch: 'convergence',
        effects: [{ type: 'convert', amount: 0.054, res: 'xf' }],
        requires: [{ type: 'tech', id: 'harmonicConvergence', minLevel: 1 }],
      },
      containmentRing: {
        id: 'containmentRing', kind: 'repeatable', era: 5, costRes: 'xf', baseCost: 142, growth: 1.118, maxLevel: 50,
        tree: { col: 1, row: 0 }, branch: 'mechanical',
        effects: [{ type: 'convert', amount: 0.0135, res: 'xf' }],
        requires: [{ type: 'tech', id: 'nullChamber', minLevel: 1 }],
      },
      resonantSiphon: {
        id: 'resonantSiphon', kind: 'repeatable', era: 5, costRes: 'rs', baseCost: 3080000, growth: 1.0801, maxLevel: 60,
        tree: { col: 1, row: 2 }, branch: 'automation',
        effects: [
          { type: 'autoAdd', amount: 0.37, res: 'xf' },
          { type: 'autoPct', percent: 1.7, res: 'xf' },
        ],
        requires: [{ type: 'tech', id: 'nullChamber', minLevel: 1 }],
      },
      graviticAnchor: {
        id: 'graviticAnchor', kind: 'repeatable', era: 5, costRes: 'me', baseCost: 621000, growth: 1.4142, maxLevel: 20,
        tree: { col: 3, row: 2 }, branch: 'origin',
        effects: [{ type: 'rateMult', factor: 1.05, res: 'all' }],
        requires: [{ type: 'tech', id: 'nullChamber', minLevel: 1 }],
      },
      inversionCrank: {
        id: 'inversionCrank', kind: 'unlock', era: 5, costRes: 'xf', baseCost: 2600, growth: null, maxLevel: null,
        tree: { col: 4, row: 0 }, branch: 'origin',
        effects: [{ type: 'crankEcho', seconds: 0.05 }],
        requires: [{ type: 'tech', id: 'containmentRing', minLevel: 6 }],
      },
      lensArray: {
        id: 'lensArray', kind: 'unlock', era: 5, costRes: 'xf', baseCost: 7800, growth: null, maxLevel: null,
        tree: { col: 2, row: 1 }, branch: 'mechanical',
        effects: [{ type: 'rateMult', factor: 2, res: 'xf' }],
        requires: [{ type: 'tech', id: 'containmentRing', minLevel: 10 }],
      },
      horizonField: {
        id: 'horizonField', kind: 'repeatable', era: 5, costRes: 'xf', baseCost: 18700, growth: 1.1402, maxLevel: 40,
        tree: { col: 3, row: 1 }, branch: 'mechanical',
        effects: [{ type: 'autoPct', percent: 7.5, res: 'xf' }],
        requires: [{ type: 'tech', id: 'lensArray', minLevel: 1 }],
      },
      skyAperture: {
        id: 'skyAperture', kind: 'unlock', era: 5, costRes: 'xf', baseCost: 6500000, growth: null, maxLevel: null,
        tree: { col: 4, row: 1 }, branch: 'automation',
        effects: [{ type: 'rateMult', factor: 3, res: 'all' }],
        requires: [
          { type: 'tech', id: 'horizonField', minLevel: 10 },
          { type: 'tech', id: 'graviticAnchor', minLevel: 6 },
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
      overrunClutch: {
        id: 'overrunClutch', kind: 'unlock', era: 5, costRes: 'xf', baseCost: 32500, growth: null, maxLevel: null,
        tree: { col: 5, row: 0 }, branch: 'origin',
        effects: [{ type: 'windup', seconds: 0.375, refill: 0.0375 }, { type: 'overdrive', seconds: 6, factor: 2 }],
        requires: [{ type: 'tech', id: 'inversionCrank', minLevel: 1 }],
      },
      mainsBackfeed: {
        id: 'mainsBackfeed', kind: 'repeatable', era: 5, costRes: 'ee', baseCost: 5930000, growth: 1.1187, maxLevel: null,
        tree: { col: 6, row: 0 }, branch: 'automation',
        effects: [{ type: 'autoPct', percent: 2, res: 'xf' }],
        requires: [{ type: 'tech', id: 'nullChamber', minLevel: 1 }],
      },
      steamLance: {
        id: 'steamLance', kind: 'repeatable', era: 5, costRes: 'pr', baseCost: 1480000, growth: 1.1187, maxLevel: null,
        tree: { col: 6, row: 2 }, branch: 'automation',
        effects: [{ type: 'autoPct', percent: 2, res: 'xf' }],
        requires: [{ type: 'tech', id: 'nullChamber', minLevel: 1 }],
      },
    };
    expect(ERA_FIVE_IDS).toEqual([
      'nullChamber', 'containmentRing', 'resonantSiphon', 'graviticAnchor', 'inversionCrank',
      'lensArray', 'horizonField', 'skyAperture', 'finalAlignment', 'primaryFunction',
      'mainsBackfeed', 'steamLance', 'overrunClutch',
    ]);
    for (const id of ERA_FIVE_IDS) {
      expect(project(TECHNOLOGIES[id])).toEqual(expected[id as keyof typeof expected]);
    }
  });

  it('era-V descriptions and flavors match the C1 texts', () => {
    expect(TECHNOLOGIES.nullChamber.description).toBe('A lantern on the spire holds a sphere of nothing. Converts RS into ???.');
    expect(TECHNOLOGIES.nullChamber.flavor).toBe('Chamber sealed around nothing. Nothing is rising.');
    expect(TECHNOLOGIES.containmentRing.description).toBe('Another ring around the core. More ??? from the same resonance.');
    expect(TECHNOLOGIES.resonantSiphon.description).toBe('Glass siphons arc resonance into the core. +0.37 ???/s and +1.7% ??? production per level.');
    expect(TECHNOLOGIES.graviticAnchor.description).toBe('Piles at both ends guy the crown to the ground. ×1.05 all production per level.');
    expect(TECHNOLOGIES.inversionCrank.description).toBe('Every turn leaves a turn going the other way. Clicks echo 0.05s of all output.');
    expect(TECHNOLOGIES.lensArray.description).toBe('Three lenses gather the core into one line. Doubles ??? production.');
    expect(TECHNOLOGIES.horizonField.description).toBe('The horizon glows on every side. +7.5% ??? production per level.');
    expect(TECHNOLOGIES.skyAperture.description).toBe('The crown opens to the sky. ×3 all production.');
    expect(TECHNOLOGIES.finalAlignment.description).toBe('Every ring, lens and anchor now points the same way.');
    expect(TECHNOLOGIES.finalAlignment.flavor).toBe('Alignment complete. Awaiting operator.');
    expect(TECHNOLOGIES.primaryFunction.description).toBe('Engage the primary function.');
    expect(TECHNOLOGIES.mainsBackfeed.description).toBe('The grid runs backwards into the null gallery. +2% ??? production per level.');
    expect(TECHNOLOGIES.steamLance.description).toBe('A riser carries live steam up the spire into the chamber. +2% ??? production per level.');
    expect(TECHNOLOGIES.overrunClutch.description).toBe(
      'The machine runs past its limit. +0.375s wind-up, +0.0375s/s refill; a cleared fault gives ×2 output for 6s.',
    );
  });

  it('era-V techs without a given flavor have none', () => {
    for (const id of ['containmentRing', 'resonantSiphon', 'graviticAnchor', 'inversionCrank', 'lensArray', 'horizonField', 'skyAperture', 'primaryFunction', 'mainsBackfeed', 'steamLance', 'overrunClutch'] as const) {
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

  it('costRes: me on graviticAnchor, ee on mainsBackfeed, pr on steamLance, rs on nullChamber and resonantSiphon, xf on the other eight', () => {
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

describe('era I rows match the WP25 literal', () => {
  // Copied from the era-I table at HEAD before WP8, re-pinned to the WP25 retune (patch.json) and the WP27 click-curve
  // retune (era I opens hand-led: Worn Motor +2 ME/s, Piston Array 3000 ME). faultLamp is WP27 and has its own block.
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
      effects: [{ type: 'clickAdd', amount: 0.5 }],
      requires: [{ type: 'tech', id: 'handCrank', minLevel: 1 }],
      description: 'Better-meshed gears. +0.5 ME per click per level.',
      tree: { col: 1, row: 0 },
    },
    reinforcedCrank: {
      id: 'reinforcedCrank',
      name: 'Reinforced Crank',
      kind: 'unlock',
      branch: 'mechanical',
      era: 1,
      costRes: 'me',
      baseCost: 1200,
      growth: null,
      maxLevel: null,
      effects: [{ type: 'crankEcho', seconds: 0.15 }, { type: 'windup', seconds: 0.35, refill: 0.035 }],
      requires: [{ type: 'tech', id: 'gearRatio', minLevel: 3 }],
      description: 'A sturdier crank arm. Clicks echo 0.15s of all output; +0.35s wind-up, +0.035s/s refill.',
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
      effects: [{ type: 'autoPct', percent: 10 }, { type: 'windup', seconds: 0.015, refill: 0.0015 }],
      requires: [
        { type: 'tech', id: 'reinforcedCrank', minLevel: 1 },
        { type: 'tech', id: 'wornMotor', minLevel: 1 },
      ],
      description: 'A heavy wheel that stores momentum. +10% automation production and +0.015s wind-up per level.',
      tree: { col: 3, row: 1 },
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
      effects: [{ type: 'autoAdd', amount: 2 }],
      requires: [{ type: 'tech', id: 'handCrank', minLevel: 1 }],
      description: 'A salvaged motor that turns by itself. +2 ME/s.',
      flavor: 'Synchronization unsuccessful.',
      tree: { col: 1, row: 1 },
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
      effects: [{ type: 'autoAdd', amount: 0.9 }],
      requires: [{ type: 'tech', id: 'wornMotor', minLevel: 1 }],
      description: 'Adjustments to the worn motor. +0.9 ME/s per level.',
      tree: { col: 2, row: 2 },
    },
    pistonArray: {
      id: 'pistonArray',
      name: 'Piston Array',
      kind: 'unlock',
      branch: 'automation',
      era: 1,
      costRes: 'me',
      baseCost: 3000,
      growth: null,
      maxLevel: null,
      effects: [{ type: 'autoAdd', amount: 60 }],
      requires: [{ type: 'tech', id: 'motorTuning', minLevel: 5 }],
      description: 'Rows of pistons hammering in sequence. +60 ME/s.',
      tree: { col: 3, row: 2 },
    },
    improvedPistons: {
      id: 'improvedPistons',
      name: 'Improved Pistons',
      kind: 'repeatable',
      branch: 'automation',
      era: 1,
      costRes: 'me',
      baseCost: 3000,
      growth: 1.3,
      maxLevel: 25,
      effects: [{ type: 'autoAdd', amount: 10 }],
      requires: [{ type: 'tech', id: 'pistonArray', minLevel: 1 }],
      description: 'Tighter tolerances, harder strokes. +10 ME/s per level.',
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
        { type: 'lifetime', res: 'me', amount: 400000 },
      ],
      description: 'Something in the machine has begun to resemble a plan.',
      flavor: 'Primary function: UNKNOWN.',
      tree: { col: 4, row: 1 },
    },
  };

  it('every era-I definition deep-equals the WP25 literal', () => {
    expect(Object.keys(ERA_ONE_LITERAL)).toHaveLength(9);
    // The only era-I tech without a WP25 row is faultLamp (WP27); its literal is in the WP27 block below.
    expect(ERA_ONE_IDS.filter((id) => !(id in ERA_ONE_LITERAL))).toEqual(['faultLamp']);
    for (const id of ERA_ONE_IDS) {
      if (id in ERA_ONE_LITERAL) expect(TECHNOLOGIES[id]).toEqual(ERA_ONE_LITERAL[id]);
    }
  });
});

describe('WP27 new techs', () => {
  // The five WP27 techs (faults and wind-up), appended after steamLance. Tree slots are unique per era (checked above).
  const NEW_IDS = ['faultLamp', 'dischargeLever', 'leakWhistle', 'dampingFork', 'overrunClutch'] as const;
  const NEW_TECH_LITERAL: Record<(typeof NEW_IDS)[number], TechDefinition> = {
    faultLamp: {
      id: 'faultLamp', name: 'Fault Lamp', kind: 'unlock', branch: 'origin', era: 1, costRes: 'me', baseCost: 3000,
      growth: null, maxLevel: null,
      effects: [{ type: 'faultUnlock', seconds: 15 }],
      requires: [{ type: 'tech', id: 'improvedPistons', minLevel: 1 }],
      description: 'A lamp for things that slip. Faults now show on the machine; clear one for 15s of all output.',
      tree: { col: 5, row: 2 },
    },
    dischargeLever: {
      id: 'dischargeLever', name: 'Discharge Lever', kind: 'unlock', branch: 'origin', era: 2, costRes: 'ee', baseCost: 13000,
      growth: null, maxLevel: null,
      effects: [{ type: 'windup', seconds: 0.375, refill: 0.0375 }, { type: 'faultSeconds', seconds: 3 }],
      requires: [{ type: 'tech', id: 'sparkGap', minLevel: 1 }],
      description: 'A lever trips the stored charge. +0.375s wind-up, +0.0375s/s refill; cleared faults pay +3s.',
      tree: { col: 5, row: 0 },
    },
    leakWhistle: {
      id: 'leakWhistle', name: 'Leak Whistle', kind: 'unlock', branch: 'origin', era: 3, costRes: 'pr', baseCost: 65000,
      growth: null, maxLevel: null,
      effects: [{ type: 'faultRate', factor: 0.9 }],
      requires: [{ type: 'tech', id: 'bellowsDrive', minLevel: 3 }],
      description: 'A whistle on every seam the bellows reach. Fault interval ×0.9.',
      tree: { col: 4, row: 2 },
    },
    dampingFork: {
      id: 'dampingFork', name: 'Damping Fork', kind: 'unlock', branch: 'origin', era: 4, costRes: 'rs', baseCost: 195000,
      growth: null, maxLevel: null,
      effects: [
        { type: 'windup', seconds: 0.375, refill: 0.0375 },
        { type: 'faultWindow', seconds: 4 },
        { type: 'faultSeconds', seconds: 4 },
      ],
      requires: [{ type: 'tech', id: 'echoCrank', minLevel: 1 }],
      description: 'A second fork rings ahead of each fault. +0.375s wind-up, +0.0375s/s refill; faults last +4s and pay +4s.',
      tree: { col: 5, row: 0 },
    },
    overrunClutch: {
      id: 'overrunClutch', name: 'Overrun Clutch', kind: 'unlock', branch: 'origin', era: 5, costRes: 'xf', baseCost: 32500,
      growth: null, maxLevel: null,
      effects: [{ type: 'windup', seconds: 0.375, refill: 0.0375 }, { type: 'overdrive', seconds: 6, factor: 2 }],
      requires: [{ type: 'tech', id: 'inversionCrank', minLevel: 1 }],
      description: 'The machine runs past its limit. +0.375s wind-up, +0.0375s/s refill; a cleared fault gives ×2 output for 6s.',
      tree: { col: 5, row: 0 },
    },
  };

  it('every new definition deep-equals its WP27 literal', () => {
    for (const id of NEW_IDS) {
      expect(TECHNOLOGIES[id]).toEqual(NEW_TECH_LITERAL[id]);
    }
  });

  it('install lines: exact WP27 texts, unique, at most 60 characters', () => {
    expect(INSTALL_LINES.faultLamp).toBe('Fault reporting enabled. Faults predate the report.');
    expect(INSTALL_LINES.dischargeLever).toBe('Stored charge released by hand. Hand not logged.');
    expect(INSTALL_LINES.leakWhistle).toBe('Leaks now announce themselves. Most of them.');
    expect(INSTALL_LINES.dampingFork).toBe('The second fork hums before anything slips.');
    expect(INSTALL_LINES.overrunClutch).toBe('Clutch engaged ahead of the load. Load not found.');
    for (const id of NEW_IDS) {
      expect(INSTALL_LINES[id].length).toBeLessThanOrEqual(60);
    }
    expect(new Set(TECH_IDS.map((id) => INSTALL_LINES[id])).size).toBe(TECH_IDS.length);
  });

  it('every WP27 tech is an unlock with no flavor', () => {
    for (const id of NEW_IDS) {
      expect(TECHNOLOGIES[id].kind).toBe('unlock');
      expect(TECHNOLOGIES[id].flavor).toBeUndefined();
    }
  });
});

describe('WP28 Splices and REC split tracks', () => {
  const PARTS: Partial<Record<TechId, number>> = SPLIT_PARTS;

  it('the 16 Splices have unique install lines of at most 60 characters', () => {
    for (const id of SPLICE_IDS) {
      expect(TECHNOLOGIES[id].branch).toBe('splice');
      expect(INSTALL_LINES[id].length).toBeGreaterThan(0);
      expect(INSTALL_LINES[id].length).toBeLessThanOrEqual(60);
    }
    expect(new Set(SPLICE_IDS.map((id) => INSTALL_LINES[id])).size).toBe(SPLICE_IDS.length);
  });

  it('SPLIT_PARTS names the 17 split tracks, each a repeatable tech', () => {
    expect(Object.keys(SPLIT_PARTS)).toHaveLength(17);
    for (const id of Object.keys(SPLIT_PARTS) as TechId[]) {
      expect(TECHNOLOGIES[id].kind).toBe('repeatable');
    }
  });

  it('every split track has maxLevel null or a multiple of its parts', () => {
    for (const id of Object.keys(SPLIT_PARTS) as TechId[]) {
      const max = TECHNOLOGIES[id].maxLevel;
      expect(max === null || max % (PARTS[id] ?? 1) === 0).toBe(true);
    }
  });

  it('every requirement on a split track has minLevel % parts === 0 (the 17 REC entries, pinned)', () => {
    const checked: string[] = [];
    for (const id of TECH_IDS) {
      for (const req of TECHNOLOGIES[id].requires) {
        if (req.type !== 'tech') continue;
        const parts = PARTS[req.id];
        if (parts === undefined) continue;
        expect(req.minLevel % parts).toBe(0);
        checked.push(`${id}:${req.id}>=${req.minLevel}`);
      }
    }
    expect(checked).toEqual([
      'dynamoCrank:copperWinding>=6', 'capacitorBank:copperWinding>=10', 'powerLines:transformer>=6',
      'powerLines:motorRetrofit>=10', 'steamHammer:firebox>=6', 'superheater:firebox>=10', 'turbine:condenser>=9',
      'pressureVesselBlueprint:condenser>=15', 'crankServo:motorRetrofit>=2', 'echoCrank:harmonicCoil>=6',
      'phaseLock:harmonicCoil>=10', 'crystalLattice:standingWave>=6', 'inversionCrank:containmentRing>=6',
      'lensArray:containmentRing>=10', 'skyAperture:horizonField>=10', 'skyAperture:graviticAnchor>=6',
      'leakWhistle:bellowsDrive>=3',
    ]);
  });

  it('uses US spelling in every description, flavor and install line', () => {
    const british = /programme|colour|grey|metre|centre|catalogue/i;
    const texts: string[] = [];
    for (const id of TECH_IDS) {
      texts.push(TECHNOLOGIES[id].description, INSTALL_LINES[id]);
      const flavor = TECHNOLOGIES[id].flavor;
      if (flavor !== undefined) texts.push(flavor);
    }
    expect(texts.filter((t) => british.test(t))).toEqual([]);
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

describe('tech descriptions match their effects (WP25)', () => {
  // A4 guard: every number a description states must be the value of an effect of the same tech, so a retune
  // cannot leave stale text behind. The multiplication sign is written as \u00d7 so the source stays ASCII.
  const RATE_RE = /\+(\d+(?:\.\d+)?) (ME|EE|PR|RS|\?\?\?)\/s/g; // "+17 ME/s", "+1.9 ???/s"
  const PERCENT_RE = /\+(\d+(?:\.\d+)?)%/g; // "+15% EE production"
  const FACTOR_RE = /\u00d7(\d+(?:\.\d+)?)/g; // "\u00d71.5 manual production"
  const ECHO_RE = /echo (\d+(?:\.\d+)?)s/g; // "Clicks echo 0.5s of RS"
  const PER_CLICK_RE = /\+(\d+(?:\.\d+)?) ME per click/g; // "+0.5 ME per click per level"
  // WP27 kinds (written with [0-9] and [.] classes): wind-up, refill, fault pay, fault window, clear-one payout, overdrive length.
  const WIND_RE = /[+]([0-9]+(?:[.][0-9]+)?)s wind-up/g; // "+0.375s wind-up"
  const REFILL_RE = /[+]([0-9]+(?:[.][0-9]+)?)s[/]s refill/g; // "+0.0375s/s refill"
  const PAY_RE = /(?<!Finds )pay [+]([0-9]+(?:[.][0-9]+)?)s/g; // "cleared faults pay +3s", "and pay +4s"
  // WP28 Finds: "Finds pay +1s" is a payout claim (findSeconds), "Finds come 15% sooner" a cut (findRate, 1 - factor).
  const FIND_PAY_RE = /Finds pay [+]([0-9]+(?:[.][0-9]+)?)s/g; // "Finds pay +1s"
  const FIND_RATE_RE = /Finds come ([0-9]+)% sooner/g; // "Finds come 15% sooner"
  const LAST_RE = /faults last [+]([0-9]+(?:[.][0-9]+)?)s/g; // "faults last +4s"
  const CLEAR_ONE_RE = /clear one for ([0-9]+(?:[.][0-9]+)?)s/g; // "clear one for 15s of all output"
  const OUTPUT_FOR_RE = /output for ([0-9]+(?:[.][0-9]+)?)s/g; // "gives ×2 output for 6s"

  // Values carried by the effects of one tech.
  const autoAddFor = (id: TechId, label: string): number[] =>
    TECHNOLOGIES[id].effects.flatMap((e) => (e.type === 'autoAdd' && RESOURCES[e.res ?? 'me'].short === label ? [e.amount] : []));
  const autoPcts = (id: TechId): number[] => TECHNOLOGIES[id].effects.flatMap((e) => (e.type === 'autoPct' ? [e.percent] : []));
  const factors = (id: TechId): number[] =>
    TECHNOLOGIES[id].effects.flatMap((e) => (e.type === 'clickMult' || e.type === 'rateMult' || e.type === 'faultRate' || e.type === 'overdrive' ? [e.factor] : []));
  // WP27: the fault-interval factor and the overdrive factor are the only factors a fault effect can carry.
  const faultFactors = (id: TechId): number[] =>
    TECHNOLOGIES[id].effects.flatMap((e) => (e.type === 'faultRate' || e.type === 'overdrive' ? [e.factor] : []));
  const echoSeconds = (id: TechId): number[] =>
    TECHNOLOGIES[id].effects.flatMap((e) => (e.type === 'clickEcho' || e.type === 'crankEcho' ? [e.seconds] : []));
  const clickAdds = (id: TechId): number[] => TECHNOLOGIES[id].effects.flatMap((e) => (e.type === 'clickAdd' ? [e.amount] : []));
  const windupSeconds = (id: TechId): number[] => TECHNOLOGIES[id].effects.flatMap((e) => (e.type === 'windup' ? [e.seconds] : []));
  const windupRefills = (id: TechId): number[] => TECHNOLOGIES[id].effects.flatMap((e) => (e.type === 'windup' ? [e.refill] : []));
  const faultPays = (id: TechId): number[] => TECHNOLOGIES[id].effects.flatMap((e) => (e.type === 'faultSeconds' ? [e.seconds] : []));
  const faultWindows = (id: TechId): number[] => TECHNOLOGIES[id].effects.flatMap((e) => (e.type === 'faultWindow' ? [e.seconds] : []));
  const faultClearSeconds = (id: TechId): number[] => TECHNOLOGIES[id].effects.flatMap((e) => (e.type === 'faultUnlock' ? [e.seconds] : []));
  const overdriveSeconds = (id: TechId): number[] => TECHNOLOGIES[id].effects.flatMap((e) => (e.type === 'overdrive' ? [e.seconds] : []));
  const findSecondsOf = (id: TechId): number[] => TECHNOLOGIES[id].effects.flatMap((e) => (e.type === 'findSeconds' ? [e.seconds] : []));
  // The interval factor is read as the whole percent it cuts: factor 0.85 cuts 15 %.
  const findCuts = (id: TechId): number[] => TECHNOLOGIES[id].effects.flatMap((e) => (e.type === 'findRate' ? [Math.round((1 - e.factor) * 100)] : []));

  // Every claim in the description of `id`; holds is true when one of the tech's effects carries the claimed value.
  // fresh marks the WP27 kinds (wind-up, refill, fault payout, fault window, clear-one, overdrive, fault and overdrive factors).
  interface Claim { text: string; holds: boolean; fresh?: boolean }
  const claimsOf = (id: TechId): Claim[] => {
    const description = TECHNOLOGIES[id].description;
    const claims: Claim[] = [];
    for (const m of description.matchAll(RATE_RE)) claims.push({ text: m[0], holds: autoAddFor(id, String(m[2])).includes(Number(m[1])) });
    for (const m of description.matchAll(PERCENT_RE)) claims.push({ text: m[0], holds: autoPcts(id).includes(Number(m[1])) });
    for (const m of description.matchAll(FACTOR_RE)) {
      claims.push({ text: m[0], holds: factors(id).includes(Number(m[1])), fresh: faultFactors(id).includes(Number(m[1])) });
    }
    for (const m of description.matchAll(ECHO_RE)) claims.push({ text: m[0], holds: echoSeconds(id).includes(Number(m[1])) });
    for (const m of description.matchAll(PER_CLICK_RE)) claims.push({ text: m[0], holds: clickAdds(id).includes(Number(m[1])) });
    for (const m of description.matchAll(WIND_RE)) claims.push({ text: m[0], holds: windupSeconds(id).includes(Number(m[1])), fresh: true });
    for (const m of description.matchAll(REFILL_RE)) claims.push({ text: m[0], holds: windupRefills(id).includes(Number(m[1])), fresh: true });
    for (const m of description.matchAll(PAY_RE)) claims.push({ text: m[0], holds: faultPays(id).includes(Number(m[1])), fresh: true });
    for (const m of description.matchAll(LAST_RE)) claims.push({ text: m[0], holds: faultWindows(id).includes(Number(m[1])), fresh: true });
    for (const m of description.matchAll(CLEAR_ONE_RE)) claims.push({ text: m[0], holds: faultClearSeconds(id).includes(Number(m[1])), fresh: true });
    for (const m of description.matchAll(OUTPUT_FOR_RE)) claims.push({ text: m[0], holds: overdriveSeconds(id).includes(Number(m[1])), fresh: true });
    for (const m of description.matchAll(FIND_PAY_RE)) claims.push({ text: m[0], holds: findSecondsOf(id).includes(Number(m[1])), fresh: true });
    for (const m of description.matchAll(FIND_RATE_RE)) claims.push({ text: m[0], holds: findCuts(id).includes(Number(m[1])), fresh: true });
    if (description.includes('Doubles')) claims.push({ text: 'Doubles', holds: factors(id).includes(2) });
    if (description.includes('Triples')) claims.push({ text: 'Triples', holds: factors(id).includes(3) });
    return claims;
  };
  const numericClaims = (): Claim[] => TECH_IDS.flatMap((id) => claimsOf(id).filter((c) => /\d/.test(c.text)));
  const freshClaims = (): Claim[] => TECH_IDS.flatMap((id) => claimsOf(id).filter((c) => c.fresh === true));

  it('every numeric claim in a description is backed by an effect of the same tech', () => {
    const broken = TECH_IDS.flatMap((id) => claimsOf(id).filter((c) => !c.holds).map((c) => `${id}: ${c.text}`));
    expect(broken).toEqual([]);
  });

  it('the guard is not vacuous: at least 25 numeric claims are checked', () => {
    expect(numericClaims().length).toBeGreaterThanOrEqual(25);
  });

  it('the WP27 claims are checked too: at least 12 wind-up, refill, fault and overdrive claims', () => {
    expect(freshClaims().length).toBeGreaterThanOrEqual(12);
  });

  it('the Finds claims are checked; the Barrel Organ claims only its payout, the word three is no claim', () => {
    expect(claimsOf('spliceOrgan').map((c) => c.text)).toEqual(['Finds pay +1s']);
    expect(claimsOf('spliceWhistle').map((c) => c.text)).toEqual(['Finds come 15% sooner']);
  });
});

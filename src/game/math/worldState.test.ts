// Tests for worldState (WP23a, WP23b): the visual state derived from tech levels, part tiers, lifetime EE and PR, cycle, motor retrofit
// tier, ending phase and observer-one flag. Covers the era I and II stages (s0, s2, s7, s8, s9), the era III to V stages (S10 to S16, the
// smoke buy lists), the era, window, lamp, motes, scrap, puddle, sprout, Chladni, page, virga, fog, trace and shadow rules, the hole
// stage, the dog pose, the girl stage and steps, the maxEra and ending gates, the monotone counts, and that inputs are never mutated.
// Pure maths, no Phaser.
import { describe, it, expect } from 'vitest';
import { deriveWorldState, girlStepsOf, lifetimeGatesOf, ruleMet } from './worldState';
import type { WorldStateInput, WorldVisualState } from './worldState';
import type { TechId } from '../../data/types';
import { WORLD_HOLE } from '../../data/livingWorld';
import { WORLD_ERA_RULES, WORLD_PUDDLE, WORLD_VIRGA } from '../../data/worldEras';

// The smoke stage buy lists (scripts/smoke/stages.mjs:6-19), copied as literals.
const rep = (id: string, n: number): string[] => Array.from({ length: n }, () => id);
const S7 = ['wornMotor', 'gearRatio', 'gearRatio', 'gearRatio', 'reinforcedCrank', 'motorTuning', 'motorTuning', 'motorTuning',
  'motorTuning', 'motorTuning', 'flywheel', 'pistonArray', 'improvedPistons'];
const S9 = [...S7, '@blueprint', 'generator', ...rep('motorRetrofit', 5), ...rep('copperWinding', 20), 'dynamoCrank',
  'capacitorBank', 'sparkGap', ...rep('transformer', 3), 'powerLines'];
const S10 = [...S9, '@substationBlueprint', 'boiler'];
const S11 = [...S10, ...rep('inductionHeater', 3), ...rep('firebox', 20), 'steamHammer', 'superheater', ...rep('condenser', 5), 'turbine',
  'reliefValves', ...rep('bellowsDrive', 3), '@pressureVesselBlueprint'];
const S12 = [...S11, 'resonatorSpire'];
const S13 = [...S12, ...rep('crankServo', 3), ...rep('harmonicCoil', 25), ...rep('pressureResonator', 3), 'echoCrank', 'phaseLock',
  ...rep('standingWave', 3), 'crystalLattice', ...rep('gridExciter', 5), '@harmonicConvergence'];
const S14 = [...S13, 'nullChamber'];
const S15 = [...S14, ...rep('containmentRing', 25), '@resonantSiphon:20', '@graviticAnchor:10', 'inversionCrank', 'lensArray',
  ...rep('horizonField', 20), 'skyAperture', ...rep('mainsBackfeed', 5), ...rep('steamLance', 5), '@finalAlignment'];
const S16 = [...S15, 'primaryFunction'];
const STAGE_BUYS = {
  s0: [] as string[],
  s2: ['wornMotor'],
  s7: S7,
  s8: [...S7, '@blueprint', 'generator'],
  s9: S9,
  s10: S10,
  s11: S11,
  s12: S12,
  s13: S13,
  s14: S14,
  s15: S15,
  s16: S16,
} as const;

// Tech levels of a buy list: plain id += 1; '@blueprint' = generatorBlueprint 1; '@tech' = 1; '@tech:n' = n.
function levelsOf(buys: readonly string[]): Record<TechId, number> {
  const out: Record<string, number> = {};
  for (const raw of buys) {
    if (raw.startsWith('@')) {
      const [name = '', n] = raw.slice(1).split(':');
      out[name === 'blueprint' ? 'generatorBlueprint' : name] = n === undefined ? 1 : Number(n);
    } else {
      out[raw] = (out[raw] ?? 0) + 1;
    }
  }
  return out as Record<TechId, number>;
}

// A full input for a buy list; overrides replace single fields.
function input(buys: readonly string[], over: Partial<WorldStateInput> = {}): WorldStateInput {
  return {
    levels: levelsOf(buys), lifetimeEe: 0, cycle: 0, edition: 'full', dogLies: false, motorRetrofitTier: 0, phase: 'none', ...over,
  };
}

// Props of an era I world with nothing bought beyond the crank and motor line (marks at cycle 0).
const ERA_I_PROPS = {
  girlWindow: 'flicker', girlMini: false, girlMiniNear: false, windows: 'off', windowsLit: 6, windowsBreathe: false, lamp: 'dead',
  lampGlow: false, lampGlowWarm: false, lampPulse: false, boothLit: false, boothFog: false, motes: false, motesMode: 'orbit',
  stakeChain: true, holeStage: 0, scraps: 3, marks: 40, puddle: { size: 0, look: 'grey' }, sprout: 0, chladni: 0,
  chladniViolet: false, pages: false, virga: 'off',
};

describe('deriveWorldState: era I stages', () => {
  it('s0 (crank only): visible era I, crank playback, ghosted cast, dark world, red LED', () => {
    const s = deriveWorldState(input(STAGE_BUYS.s0));
    expect(s.visible).toBe(true);
    expect(s.era).toBe(1);
    expect(s.eraRow).toBe(0);
    expect(s.alpha).toBe(0.75);
    expect(s.shadowScale).toBe(0.5);
    expect(s.mode).toBe('crank');
    expect(s.seam).toBe(true);
    expect(s.dogPose).toBe('loop');
    expect(s.props).toEqual(ERA_I_PROPS);
    expect(s.sensor).toEqual({ led: 'red', readout: 'dash', fog: false, pulse: false });
    expect(s.ending).toBe('none');
    expect(s.shadows).toBe(true);
    expect(s.reverse).toBe(false);
    expect(s.vents).toBe(false);
    expect(s.girl).toEqual({ stage: 0, stageName: 'window', row: 'back', steps: 0 });
    expect(s.traces).toEqual({ redBall: false, crowHigh: false, clipboard: 0 });
  });

  it('s2 (wornMotor): fps2 playback and the .85 cast alpha', () => {
    const s = deriveWorldState(input(STAGE_BUYS.s2));
    expect(s.visible).toBe(true);
    expect(s.era).toBe(1);
    expect(s.alpha).toBe(0.85);
    expect(s.shadowScale).toBe(0.5);
    expect(s.mode).toBe('fps2');
    expect(s.props).toEqual(ERA_I_PROPS);
  });

  it('s7 (full era I): fps4 after pistonArray, still era I and dark', () => {
    const s = deriveWorldState(input(STAGE_BUYS.s7));
    expect(s.visible).toBe(true);
    expect(s.era).toBe(1);
    expect(s.eraRow).toBe(0);
    expect(s.alpha).toBe(0.85);
    expect(s.mode).toBe('fps4');
    expect(s.props).toEqual(ERA_I_PROPS);
    expect(s.sensor.led).toBe('red');
  });
});

describe('deriveWorldState: era II stages', () => {
  it('s8 (generator): era II row, full alpha, fps8, girl window dark, mini girl, motes, amber LED; booth and lamp still dead', () => {
    const s = deriveWorldState(input(STAGE_BUYS.s8));
    expect(s.visible).toBe(true);
    expect(s.era).toBe(2);
    expect(s.eraRow).toBe(1);
    expect(s.alpha).toBe(1);
    expect(s.shadowScale).toBe(1);
    expect(s.mode).toBe('fps8');
    expect(s.props).toEqual({
      girlWindow: 'dark', girlMini: true, girlMiniNear: false, windows: 'dim', windowsLit: 6, windowsBreathe: false, lamp: 'dead',
      lampGlow: false, lampGlowWarm: false, lampPulse: false, boothLit: false, boothFog: false, motes: true, motesMode: 'orbit',
      stakeChain: true, holeStage: 0, scraps: 3, marks: 40, puddle: { size: 0, look: 'grey' }, sprout: 0, chladni: 0,
      chladniViolet: false, pages: false, virga: 'off',
    });
    expect(s.sensor).toEqual({ led: 'amber', readout: 'dash', fog: false, pulse: false });
    expect(s.girl).toEqual({ stage: 1, stageName: 'mini', row: 'back', steps: 0 });
  });

  it('s9 (era II full, powerLines): windows, lamp glow and booth lit, lamp lit', () => {
    const s = deriveWorldState(input(STAGE_BUYS.s9));
    expect(s.visible).toBe(true);
    expect(s.era).toBe(2);
    expect(s.eraRow).toBe(1);
    expect(s.alpha).toBe(1);
    expect(s.mode).toBe('fps8');
    expect(s.props).toEqual({
      girlWindow: 'dark', girlMini: true, girlMiniNear: false, windows: 'lit', windowsLit: 6, windowsBreathe: false, lamp: 'lit',
      lampGlow: true, lampGlowWarm: false, lampPulse: false, boothLit: true, boothFog: false, motes: true, motesMode: 'orbit',
      stakeChain: true, holeStage: 0, scraps: 3, marks: 40, puddle: { size: 0, look: 'grey' }, sprout: 0, chladni: 0,
      chladniViolet: false, pages: false, virga: 'off',
    });
    expect(s.sensor).toEqual({ led: 'amber', readout: 'dash', fog: false, pulse: false });
  });

  it('powerLines alone (no generator) lights the lamp, booth and windows but keeps the girl window flicker', () => {
    const s = deriveWorldState(input(['powerLines']));
    expect(s.props.windows).toBe('lit');
    expect(s.props.lamp).toBe('lit');
    expect(s.props.boothLit).toBe(true);
    expect(s.props.girlWindow).toBe('flicker');
    expect(s.props.girlMini).toBe(false);
    expect(s.props.motes).toBe(false);
    expect(s.sensor.led).toBe('red');
  });
});

describe('deriveWorldState: window state (era II entry)', () => {
  it('era I keeps the windows off; the generator dims them; powerLines lights them', () => {
    expect(deriveWorldState(input(STAGE_BUYS.s0)).props.windows).toBe('off');
    expect(deriveWorldState(input(STAGE_BUYS.s8)).props.windows).toBe('dim');
    expect(deriveWorldState(input(STAGE_BUYS.s9)).props.windows).toBe('lit');
    expect(deriveWorldState(input(['powerLines'])).props.windows).toBe('lit');
  });
});

// WP23b Z3: the girl window is dark once the generator is owned or the girl has left the window (stage > 0); flicker only at stage 0.
describe('deriveWorldState: girl window (WP23b Z3)', () => {
  it('cycle 1 at s0 (girl stage 0, no generator) stays flicker', () => {
    expect(deriveWorldState(input(STAGE_BUYS.s0, { cycle: 1 })).girl.stage).toBe(0);
    expect(deriveWorldState(input(STAGE_BUYS.s0, { cycle: 1 })).props.girlWindow).toBe('flicker');
  });

  it('cycle 2 (girl stage 1) and cycle 3 (stage 3) are dark at s0 and s8', () => {
    for (const buys of [STAGE_BUYS.s0, STAGE_BUYS.s8]) {
      expect(deriveWorldState(input(buys, { cycle: 2 })).props.girlWindow).toBe('dark');
      expect(deriveWorldState(input(buys, { cycle: 3 })).props.girlWindow).toBe('dark');
    }
  });

  it('cycle 1 in era IV without the generator (resonatorSpire alone, stage 3) is dark', () => {
    const s = deriveWorldState(input(['resonatorSpire'], { cycle: 1 }));
    expect(s.era).toBe(4);
    expect(s.girl.stage).toBe(3);
    expect(s.props.girlWindow).toBe('dark');
  });
});

describe('deriveWorldState: era III and the gates', () => {
  it('era III set (S10, boiler) with maxEra 2 (the demo cap): hidden, era III row, steady alpha and fps8', () => {
    const s = deriveWorldState(input(S10, { maxEra: 2 }));
    expect(s.visible).toBe(false);
    expect(s.era).toBe(3);
    expect(s.eraRow).toBe(2);
    expect(s.alpha).toBe(1);
    expect(s.shadowScale).toBe(1);
    expect(s.mode).toBe('fps8');
  });

  it('era V (nullChamber) with maxEra 2 (the demo cap) is hidden too', () => {
    expect(deriveWorldState(input(['nullChamber'], { maxEra: 2 })).visible).toBe(false);
  });

  it('the eras I to V are visible at the default cap (LIVING_WORLD.maxEra 5)', () => {
    for (const buys of [STAGE_BUYS.s0, STAGE_BUYS.s8, S10, S12, STAGE_BUYS.s14]) {
      expect(deriveWorldState(input(buys)).visible).toBe(true);
    }
  });

  it('the ending phases keep the layer visible at every era, and carry the phase (the script draws the film)', () => {
    for (const phase of ['sequence', 'choice', 'postgame'] as const) {
      for (const buys of [STAGE_BUYS.s0, STAGE_BUYS.s9, STAGE_BUYS.s15]) {
        const s = deriveWorldState(input(buys, { phase }));
        expect(s.visible).toBe(true);
        expect(s.ending).toBe(phase);
        expect(s.reverse).toBe(false);
      }
    }
  });

  it('maxEra overrides the data cap: era III visible at maxEra 5, era II hidden at maxEra 1', () => {
    expect(deriveWorldState(input(S10, { maxEra: 5 })).visible).toBe(true);
    expect(deriveWorldState(input(STAGE_BUYS.s9, { maxEra: 1 })).visible).toBe(false);
    expect(deriveWorldState(input(STAGE_BUYS.s9, { maxEra: 2 })).visible).toBe(true);
  });
});

describe('deriveWorldState: hole stage (bible §10, load-beneath at 100K EE)', () => {
  it('EE 99999 gives no hole at any motor retrofit tier', () => {
    for (const tier of [0, 1, 2, 3, 4, 5]) {
      const s = deriveWorldState(input(STAGE_BUYS.s9, { lifetimeEe: 99999, motorRetrofitTier: tier }));
      expect(s.props.holeStage).toBe(0);
      expect(s.dogPose).toBe('loop');
    }
  });

  it('EE 100000 with tiers 1..5 gives stages 1, 1, 2, 3, 4', () => {
    const got = [1, 2, 3, 4, 5].map((tier) =>
      deriveWorldState(input(STAGE_BUYS.s9, { lifetimeEe: 100000, motorRetrofitTier: tier })).props.holeStage);
    expect(got).toEqual([1, 1, 2, 3, 4]);
  });

  it('the stage is clamped to 1..4 (tier 0 and tier 9 at EE 100000)', () => {
    expect(deriveWorldState(input([], { lifetimeEe: 100000, motorRetrofitTier: 0 })).props.holeStage).toBe(1);
    expect(deriveWorldState(input([], { lifetimeEe: 100000, motorRetrofitTier: 9 })).props.holeStage).toBe(4);
  });

  it('a non-finite tier counts as 0 (stage 1); a NaN EE gives no hole', () => {
    expect(deriveWorldState(input([], { lifetimeEe: 100000, motorRetrofitTier: Number.NaN })).props.holeStage).toBe(1);
    expect(deriveWorldState(input([], { lifetimeEe: 100000, motorRetrofitTier: Number.POSITIVE_INFINITY })).props.holeStage).toBe(1);
    expect(deriveWorldState(input([], { lifetimeEe: Number.NaN, motorRetrofitTier: 5 })).props.holeStage).toBe(0);
  });

  it('a dug hole sets the dog pose to dig', () => {
    const s = deriveWorldState(input(STAGE_BUYS.s9, { lifetimeEe: 100000, motorRetrofitTier: 3 }));
    expect(s.props.holeStage).toBe(2);
    expect(s.dogPose).toBe('dig');
  });
});

describe('deriveWorldState: dog pose', () => {
  it('dogLies gives the lie pose at s9 with no hole', () => {
    expect(deriveWorldState(input(STAGE_BUYS.s9, { dogLies: true })).dogPose).toBe('lie');
  });

  it('dogLies wins over a dug hole', () => {
    const s = deriveWorldState(input(STAGE_BUYS.s9, { dogLies: true, lifetimeEe: 100000, motorRetrofitTier: 5 }));
    expect(s.props.holeStage).toBe(4);
    expect(s.dogPose).toBe('lie');
  });

  it('without dogLies the pose is loop, or dig once the hole exists', () => {
    expect(deriveWorldState(input(STAGE_BUYS.s9, { dogLies: false })).dogPose).toBe('loop');
    expect(deriveWorldState(input(STAGE_BUYS.s9, { dogLies: false, lifetimeEe: 100000, motorRetrofitTier: 1 })).dogPose).toBe('dig');
  });
});

describe('deriveWorldState: marks, edition and purity', () => {
  it('tally marks are 40 + cycle: 41 at cycle 1, 43 at cycle 3', () => {
    expect(deriveWorldState(input(STAGE_BUYS.s0, { cycle: 1 })).props.marks).toBe(41);
    expect(deriveWorldState(input(STAGE_BUYS.s0, { cycle: 3 })).props.marks).toBe(43);
    expect(deriveWorldState(input(STAGE_BUYS.s0, { cycle: 0 })).props.marks).toBe(40);
  });

  it('demo and full editions derive the same state in WP23a (the era gate is the only difference, WP23b)', () => {
    for (const buys of [STAGE_BUYS.s0, STAGE_BUYS.s9, S10]) {
      expect(deriveWorldState(input(buys, { edition: 'demo' }))).toEqual(deriveWorldState(input(buys, { edition: 'full' })));
    }
  });

  it('is deterministic: the same input gives the same state', () => {
    const i = input(STAGE_BUYS.s9, { lifetimeEe: 100000, motorRetrofitTier: 4, cycle: 2 });
    expect(deriveWorldState(i)).toEqual(deriveWorldState(i));
  });

  it('never mutates its input (frozen levels and input do not throw; contents unchanged)', () => {
    const levels = Object.freeze(levelsOf(S9));
    const i = Object.freeze({ ...input([]), levels, lifetimeEe: 100000, motorRetrofitTier: 3, cycle: 1, dogLies: true });
    const before = JSON.stringify(i);
    expect(() => deriveWorldState(i)).not.toThrow();
    expect(JSON.stringify(i)).toBe(before);
    expect(i.levels).toEqual(levelsOf(S9));
  });

  it('never mutates frozen part tiers either', () => {
    const tiers = Object.freeze({ condenser: 3, firebox: 4 });
    const i = Object.freeze({ ...input(S11), tiers });
    const before = JSON.stringify(i);
    expect(deriveWorldState(i).props.puddle.size).toBe(2);
    expect(JSON.stringify(i)).toBe(before);
  });
});

describe('ruleMet: level, minimum level and part tier', () => {
  it('a rule needs the tech owned (level 1 by default); an absent tier counts as tier 1', () => {
    expect(ruleMet(levelsOf([]), { techId: 'condenser' })).toBe(false);
    expect(ruleMet(levelsOf(['condenser']), { techId: 'condenser' })).toBe(true);
    expect(ruleMet(levelsOf(['condenser']), { techId: 'condenser', minTier: 1 })).toBe(true);
    expect(ruleMet(levelsOf(['condenser']), { techId: 'condenser', minTier: 3 })).toBe(false);
  });

  it('minLevel 5 (horizonField): 4 misses, 5 meets', () => {
    expect(ruleMet(levelsOf(rep('horizonField', 4)), { techId: 'horizonField', minLevel: 5 })).toBe(false);
    expect(ruleMet(levelsOf(rep('horizonField', 5)), { techId: 'horizonField', minLevel: 5 })).toBe(true);
  });

  it('minTier reads the given tier: 2 misses 3, 3 meets; a NaN tier counts as 0; a NaN level is not owned', () => {
    const lv = levelsOf(['condenser']);
    expect(ruleMet(lv, { techId: 'condenser', minTier: 3 }, { condenser: 2 })).toBe(false);
    expect(ruleMet(lv, { techId: 'condenser', minTier: 3 }, { condenser: 3 })).toBe(true);
    expect(ruleMet(lv, { techId: 'condenser', minTier: 1 }, { condenser: Number.NaN })).toBe(false);
    expect(ruleMet({ ...levelsOf([]), condenser: Number.NaN }, { techId: 'condenser' })).toBe(false);
  });
});

// The derived state at each era II to V smoke stage (default inputs: tiers absent = tier 1, no hole, no PR, cycle 0, observer one off).
describe('deriveWorldState: era II to V smoke stages (S9 to S16)', () => {
  it('S9 (era II, powerLines): era II row, steady playback, girl at the mini pylon, lamp lit, no vents, dog loops', () => {
    expect(deriveWorldState(input(S9))).toMatchObject({
      visible: true, ending: 'none', era: 2, eraRow: 1, alpha: 1, shadows: true, shadowScale: 1, mode: 'fps8', seam: true,
      reverse: false, stare: false, vents: false, dogPose: 'loop',
      girl: { stage: 1, stageName: 'mini', row: 'back', steps: 0 },
      props: {
        girlMini: true, girlMiniNear: false, windows: 'lit', windowsLit: 6, windowsBreathe: false, lamp: 'lit', lampGlow: true,
        boothLit: true, boothFog: false, motes: true, motesMode: 'orbit', scraps: 3, marks: 40, puddle: { size: 0, look: 'grey' },
        sprout: 0, chladni: 0, pages: false, virga: 'off',
      },
      sensor: { led: 'amber', readout: 'dash', fog: false, pulse: false },
    });
  });

  it('S10 (era III, boiler): the warm lamp, the near pylon, windows lit, the dog still, no fog without vents', () => {
    expect(deriveWorldState(input(S10))).toMatchObject({
      era: 3, eraRow: 2, seam: false, alpha: 1, shadows: true, shadowScale: 1, mode: 'fps8', vents: false, dogPose: 'still',
      girl: { stage: 2, stageName: 'miniNear', row: 'back', steps: 0 },
      props: {
        girlMini: false, girlMiniNear: true, windows: 'lit', windowsLit: 6, windowsBreathe: false, lamp: 'warm', lampGlow: true,
        lampGlowWarm: true, lampPulse: false, boothFog: false, motes: true, motesMode: 'orbit', scraps: 3,
        puddle: { size: 0, look: 'grey' }, sprout: 0, chladni: 0, pages: false, virga: 'off',
      },
      sensor: { led: 'amber', readout: 'dash', fog: false, pulse: false },
    });
  });

  it('S11 (era III, reliefValves, condensers, firebox): vents shake the dog and fog the booth and Sensor 7; puddle and sprout start', () => {
    expect(deriveWorldState(input(S11))).toMatchObject({
      era: 3, vents: true, dogPose: 'shake',
      girl: { stage: 2, stageName: 'miniNear', row: 'back', steps: 0 },
      props: { boothFog: true, lamp: 'warm', puddle: { size: 1, look: 'grey' }, sprout: 1, scraps: 3, pages: false, chladni: 0 },
      sensor: { led: 'amber', readout: 'dash', fog: true, pulse: false },
    });
  });

  it('S12 (era IV, resonatorSpire): windows breathe, lamp pulses, girl on the ground, motes freeze, pages begin, no fog', () => {
    expect(deriveWorldState(input(S12))).toMatchObject({
      era: 4, eraRow: 3, seam: false, vents: true, dogPose: 'still',
      girl: { stage: 3, stageName: 'ground', row: 'back', steps: 0 },
      props: {
        girlMini: false, girlMiniNear: false, windows: 'lit', windowsLit: 6, windowsBreathe: true, lamp: 'warm', lampGlowWarm: true,
        lampPulse: true, boothFog: false, motes: true, motesMode: 'freeze', scraps: 3, puddle: { size: 1, look: 'grey' }, sprout: 1,
        chladni: 0, chladniViolet: false, pages: true, virga: 'off',
      },
      sensor: { led: 'amber', readout: 'dash', fog: false, pulse: true },
    });
  });

  it('S13 (era IV, standingWave MK I): Chladni rings intensity 1; the dog still', () => {
    expect(deriveWorldState(input(S13))).toMatchObject({
      era: 4, dogPose: 'still', props: { chladni: 1, chladniViolet: false, windowsBreathe: true, motesMode: 'freeze', pages: true },
    });
  });

  it('S14 (era V, nullChamber): reverse playback, shadows on, girl at the front with one step, 4 windows lit, black puddle, dog roams', () => {
    expect(deriveWorldState(input(S14))).toMatchObject({
      era: 5, eraRow: 4, seam: false, reverse: true, shadows: true, shadowScale: 1, alpha: 1, mode: 'fps8', vents: true, dogPose: 'roam',
      girl: { stage: 3, stageName: 'ground', row: 'front', steps: 1 },
      props: {
        girlMini: false, windows: 'lit', windowsLit: 4, windowsBreathe: false, lamp: 'warm', lampGlow: true, lampGlowWarm: true,
        lampPulse: false, boothFog: false, motes: true, motesMode: 'fall', scraps: 3, puddle: { size: 1, look: 'black' }, sprout: 3,
        chladni: 1, chladniViolet: true, pages: true, virga: 'off',
      },
      sensor: { led: 'amber', readout: 'dash', fog: false, pulse: false },
    });
  });

  it('S15 (era V full): shadows off at horizonField 5, windows dark behind skyAperture, lamp dead, five girl steps, sprout 4', () => {
    expect(deriveWorldState(input(S15))).toMatchObject({
      era: 5, reverse: true, shadows: false, shadowScale: 0, dogPose: 'roam',
      girl: { stage: 3, stageName: 'ground', row: 'front', steps: 5 },
      props: {
        windows: 'off', windowsLit: 0, lamp: 'dead', lampGlow: false, lampGlowWarm: false, lampPulse: false, motes: true,
        motesMode: 'fall', puddle: { size: 1, look: 'black' }, sprout: 4, chladniViolet: true, pages: true,
      },
      sensor: { led: 'amber', readout: 'dash', fog: false, pulse: false },
    });
  });

  it('S16 (postgame: S15 plus primaryFunction) derives the same state as S15', () => {
    expect(deriveWorldState(input(S16))).toEqual(deriveWorldState(input(S15)));
  });
});

describe('deriveWorldState: windows, lamp, motes and steam fog by era', () => {
  it('windows lit count: six through era IV; era V 4 (nullChamber), 2 (lensArray), 1 (horizonField 5), 0 (skyAperture, off)', () => {
    expect(deriveWorldState(input(S13)).props.windowsLit).toBe(6);
    expect(deriveWorldState(input(S14)).props.windowsLit).toBe(4);
    const withLens = [...S14, 'lensArray'];
    expect(deriveWorldState(input(withLens)).props.windowsLit).toBe(2);
    const withHorizon = [...withLens, ...rep('horizonField', 5)];
    expect(deriveWorldState(input(withHorizon)).props.windowsLit).toBe(1);
    const dark = deriveWorldState(input([...withHorizon, 'skyAperture']));
    expect(dark.props.windowsLit).toBe(0);
    expect(dark.props.windows).toBe('off');
  });

  it('the lamp is dead until powerLines, lit in era II, warm from era III, dead once skyAperture is owned', () => {
    expect(deriveWorldState(input(STAGE_BUYS.s8)).props.lamp).toBe('dead');
    expect(deriveWorldState(input(STAGE_BUYS.s9)).props.lamp).toBe('lit');
    expect(deriveWorldState(input(S10)).props.lamp).toBe('warm');
    expect(deriveWorldState(input(S14)).props.lamp).toBe('warm');
    expect(deriveWorldState(input(S15)).props.lamp).toBe('dead');
  });

  it('the warm glow from era III, the lamp pulse in era IV only, no glow with the dead lamp', () => {
    expect(deriveWorldState(input(STAGE_BUYS.s9)).props.lampGlowWarm).toBe(false);
    expect(deriveWorldState(input(S10)).props.lampGlowWarm).toBe(true);
    expect(deriveWorldState(input(S10)).props.lampPulse).toBe(false);
    expect(deriveWorldState(input(S12)).props.lampPulse).toBe(true);
    expect(deriveWorldState(input(S15)).props.lampGlow).toBe(false);
  });

  it('motes: none before the generator; orbit in eras II and III, freeze in IV, fall in V', () => {
    expect(deriveWorldState(input(STAGE_BUYS.s0)).props.motes).toBe(false);
    expect(deriveWorldState(input(STAGE_BUYS.s9)).props.motesMode).toBe('orbit');
    expect(deriveWorldState(input(S10)).props.motesMode).toBe('orbit');
    expect(deriveWorldState(input(S12)).props.motesMode).toBe('freeze');
    expect(deriveWorldState(input(S14)).props.motesMode).toBe('fall');
  });

  it('the booth and Sensor 7 fog show only in era III with reliefValves owned', () => {
    const fog = (buys: readonly string[]): boolean[] => {
      const s = deriveWorldState(input(buys));
      return [s.props.boothFog, s.sensor.fog];
    };
    expect(fog(S10)).toEqual([false, false]);
    expect(fog(S11)).toEqual([true, true]);
    expect(fog(S12)).toEqual([false, false]);
    expect(fog(S14)).toEqual([false, false]);
    expect(fog([...S9, 'reliefValves'])).toEqual([false, false]);
  });

  it('the Sensor 7 pulse is era IV only; the LED turns amber with the generator', () => {
    expect(deriveWorldState(input(S12)).sensor.pulse).toBe(true);
    expect(deriveWorldState(input(S10)).sensor.pulse).toBe(false);
    expect(deriveWorldState(input(STAGE_BUYS.s7)).sensor.led).toBe('red');
    expect(deriveWorldState(input(STAGE_BUYS.s8)).sensor.led).toBe('amber');
  });
});

describe('deriveWorldState: puddle, sprout, scraps, Chladni, pages and virga by tier and era', () => {
  it('puddle size follows the condenser tier 1 / 3 / 5 (1 when the tier is absent) from era III; black in era V only', () => {
    const size = (tiers: Partial<Record<TechId, number>>): number => deriveWorldState(input(S11, { tiers })).props.puddle.size;
    expect(deriveWorldState(input(S11)).props.puddle.size).toBe(1);
    expect(size({ condenser: 1 })).toBe(1);
    expect(size({ condenser: 3 })).toBe(2);
    expect(size({ condenser: 5 })).toBe(3);
    expect(deriveWorldState(input([...S9, ...rep('condenser', 5)], { tiers: { condenser: 5 } })).props.puddle.size).toBe(0);
    expect(deriveWorldState(input(S12)).props.puddle.look).toBe('grey');
    expect(deriveWorldState(input(S14)).props.puddle.look).toBe('black');
  });

  it('sprout stages: condenser (1), condenser tier 3 (2), nullChamber (3), skyAperture (4); none before era III', () => {
    const sprout = (buys: readonly string[], tiers: Partial<Record<TechId, number>> = {}): number =>
      deriveWorldState(input(buys, { tiers })).props.sprout;
    expect(sprout(S10)).toBe(0);
    expect(sprout(S11)).toBe(1);
    expect(sprout(S11, { condenser: 3 })).toBe(2);
    expect(sprout(S12, { condenser: 3 })).toBe(2);
    expect(sprout(S14, { condenser: 3 })).toBe(3);
    expect(sprout(S15)).toBe(4);
  });

  it('scraps: three until era III, then the firebox tier burns them (tier 3: 2, tier 4: 1, tier 5: 0; below 3: 3)', () => {
    const scraps = (tier: number): number => deriveWorldState(input(S11, { tiers: { firebox: tier } })).props.scraps;
    expect([1, 2, 3, 4, 5].map((tier) => scraps(tier))).toEqual([3, 3, 2, 1, 0]);
    expect(deriveWorldState(input(S11)).props.scraps).toBe(3);
    expect(deriveWorldState(input([...S9, 'firebox'], { tiers: { firebox: 5 } })).props.scraps).toBe(3);
  });

  it('Chladni rings by the standingWave tier 1 (1), 3 and 5 (2), from era IV; the violet tint in era V', () => {
    const chladni = (tiers: Partial<Record<TechId, number>>): number => deriveWorldState(input(S13, { tiers })).props.chladni;
    expect(chladni({ standingWave: 0 })).toBe(0);
    expect(chladni({ standingWave: 1 })).toBe(1);
    expect(chladni({ standingWave: 2 })).toBe(1);
    expect(chladni({ standingWave: 3 })).toBe(2);
    expect(chladni({ standingWave: 5 })).toBe(2);
    expect(deriveWorldState(input([...S11, ...rep('standingWave', 3)], { tiers: { standingWave: 5 } })).props.chladni).toBe(0);
    expect(deriveWorldState(input(S13)).props.chladniViolet).toBe(false);
    expect(deriveWorldState(input(S14)).props.chladniViolet).toBe(true);
  });

  it('pages start in era IV', () => {
    expect(deriveWorldState(input(S11)).props.pages).toBe(false);
    expect(deriveWorldState(input(S12)).props.pages).toBe(true);
  });

  it('virga needs lifetime PR >= 1000000 (absent = 0) and era III on: falls, freezes in IV, fades in V', () => {
    const virga = (buys: readonly string[], lifetimePr: number) => deriveWorldState(input(buys, { lifetimePr })).props.virga;
    expect(virga(S9, 1000000)).toBe('off');
    expect(virga(S10, 999999)).toBe('off');
    expect(virga(S10, 1000000)).toBe('fall');
    expect(virga(S12, 1000000)).toBe('frozen');
    expect(virga(S14, 1000000)).toBe('fade');
    expect(virga(S15, 5000000)).toBe('fade');
    expect(deriveWorldState(input(S14)).props.virga).toBe('off');
  });
});

describe('deriveWorldState: dog and girl by era, cycle and steps', () => {
  it('dog pose by era: loop or dig (I-II), shake with vents or still (III), still (IV), roam (V)', () => {
    expect(deriveWorldState(input(S9)).dogPose).toBe('loop');
    expect(deriveWorldState(input(S10)).dogPose).toBe('still');
    expect(deriveWorldState(input(S11)).dogPose).toBe('shake');
    expect(deriveWorldState(input(S12)).dogPose).toBe('still');
    expect(deriveWorldState(input(S14)).dogPose).toBe('roam');
  });

  it('the demo lie wins at every era; a dug hole does not dig after era II', () => {
    expect(deriveWorldState(input(S15, { dogLies: true })).dogPose).toBe('lie');
    expect(deriveWorldState(input(S10, { lifetimeEe: 100000, motorRetrofitTier: 3 })).dogPose).toBe('still');
  });

  it('girl stage per era: window (I), mini (II), miniNear (III), ground (IV, V); the front row only in era V', () => {
    const girl = (buys: readonly string[], cycle = 0): WorldVisualState['girl'] => deriveWorldState(input(buys, { cycle })).girl;
    expect(girl(STAGE_BUYS.s0)).toEqual({ stage: 0, stageName: 'window', row: 'back', steps: 0 });
    expect(girl(STAGE_BUYS.s8)).toEqual({ stage: 1, stageName: 'mini', row: 'back', steps: 0 });
    expect(girl(S10)).toEqual({ stage: 2, stageName: 'miniNear', row: 'back', steps: 0 });
    expect(girl(S12)).toEqual({ stage: 3, stageName: 'ground', row: 'back', steps: 0 });
    expect(girl(S14)).toEqual({ stage: 3, stageName: 'ground', row: 'front', steps: 1 });
  });

  it('the cycle trace stage: cycle 2 is the mini pylon, cycle 3 the ground; the era stage stays when it is further along', () => {
    const girl = (buys: readonly string[], cycle: number): WorldVisualState['girl'] => deriveWorldState(input(buys, { cycle })).girl;
    expect(girl(STAGE_BUYS.s0, 1).stage).toBe(0);
    expect(girl(STAGE_BUYS.s0, 2)).toEqual({ stage: 1, stageName: 'mini', row: 'back', steps: 0 });
    expect(girl(STAGE_BUYS.s0, 3)).toEqual({ stage: 3, stageName: 'ground', row: 'back', steps: 0 });
    expect(girl(STAGE_BUYS.s8, 3).stage).toBe(3);
    expect(girl(S10, 2).stage).toBe(2);
  });

  it('era V steps arrive in order: nullChamber, lensArray, horizonField 5, skyAperture, finalAlignment; steps 0 outside era V', () => {
    const at = (extra: readonly string[]): number => girlStepsOf(levelsOf([...S14, ...extra]));
    expect(girlStepsOf(levelsOf([]))).toBe(0);
    expect(at([])).toBe(1);
    expect(at(['lensArray'])).toBe(2);
    expect(at(['lensArray', ...rep('horizonField', 4)])).toBe(2);
    expect(at(['lensArray', ...rep('horizonField', 5)])).toBe(3);
    expect(at(['lensArray', ...rep('horizonField', 5), 'skyAperture'])).toBe(4);
    expect(at(['lensArray', ...rep('horizonField', 5), 'skyAperture', 'finalAlignment'])).toBe(5);
    expect(deriveWorldState(input([...S13, 'lensArray'])).girl.steps).toBe(0);
    expect(deriveWorldState(input(S15)).girl.steps).toBe(5);
  });
});

describe('deriveWorldState: traces, observer one, shadows, seam and reverse', () => {
  it('traces by cycle: red ball and high crow from cycle 2; clipboard pages min(3, cycle - 1); no cycle counts as 0', () => {
    const traces = (cycle: number): WorldVisualState['traces'] => deriveWorldState(input(STAGE_BUYS.s0, { cycle })).traces;
    expect(traces(0)).toEqual({ redBall: false, crowHigh: false, clipboard: 0 });
    expect(traces(1)).toEqual({ redBall: false, crowHigh: false, clipboard: 0 });
    expect(traces(2)).toEqual({ redBall: true, crowHigh: true, clipboard: 1 });
    expect(traces(3)).toEqual({ redBall: true, crowHigh: true, clipboard: 2 });
    expect(traces(4)).toEqual({ redBall: true, crowHigh: true, clipboard: 3 });
    expect(traces(9)).toEqual({ redBall: true, crowHigh: true, clipboard: 3 });
    expect(traces(Number.NaN)).toEqual({ redBall: false, crowHigh: false, clipboard: 0 });
    expect(deriveWorldState(input(STAGE_BUYS.s0, { cycle: Number.NaN })).props.marks).toBe(40);
  });

  it('the Sensor 7 readout shows one from cycle 2 or after observer one (stare); dash otherwise', () => {
    expect(deriveWorldState(input(STAGE_BUYS.s0)).sensor.readout).toBe('dash');
    expect(deriveWorldState(input(STAGE_BUYS.s0, { cycle: 1 })).sensor.readout).toBe('dash');
    expect(deriveWorldState(input(STAGE_BUYS.s0, { cycle: 2 })).sensor.readout).toBe('one');
    const observed = deriveWorldState(input(STAGE_BUYS.s0, { observerOne: true }));
    expect(observed.stare).toBe(true);
    expect(observed.sensor.readout).toBe('one');
    expect(deriveWorldState(input(STAGE_BUYS.s0)).stare).toBe(false);
  });

  it('shadows go out only in era V with horizonField at 5 or more (scale 0 then)', () => {
    expect(deriveWorldState(input(S14)).shadows).toBe(true);
    expect(deriveWorldState(input([...S14, ...rep('horizonField', 4)])).shadows).toBe(true);
    const off = deriveWorldState(input([...S14, ...rep('horizonField', 5)]));
    expect(off.shadows).toBe(false);
    expect(off.shadowScale).toBe(0);
    expect(deriveWorldState(input([...S13, ...rep('horizonField', 20)])).shadows).toBe(true);
  });

  it('the seam is eras I-II only; reverse is era V with the ending at none', () => {
    expect(deriveWorldState(input(STAGE_BUYS.s9)).seam).toBe(true);
    expect(deriveWorldState(input(S10)).seam).toBe(false);
    expect(deriveWorldState(input(S14)).reverse).toBe(true);
    expect(deriveWorldState(input(S12)).reverse).toBe(false);
  });
});

describe('era thresholds (R0 / Z5): the data keys the state maths reads', () => {
  it('pins the values of WORLD_ERA_RULES, WORLD_PUDDLE.blackEra and WORLD_VIRGA.frozenEra', () => {
    expect(WORLD_ERA_RULES).toEqual({
      dogDigMaxEra: 2, dogStillEra: 4, windowsKeystoneMaxEra: 2, reverseEra: 5, girlStepEra: 5, chladniVioletEra: 5, motesOrbitEra: 1,
    });
    expect(WORLD_PUDDLE.blackEra).toBe(5);
    expect(WORLD_VIRGA.frozenEra).toBe(4);
  });
});

describe('deriveWorldState: nothing un-happens along the growth from S9 to S15', () => {
  // A growing machine: the buy list, the part tiers and the motor retrofit tier it reaches (EE past the load-beneath line).
  const GROWTH: readonly { buys: readonly string[]; tiers: Partial<Record<TechId, number>>; tier: number }[] = [
    { buys: S9, tiers: {}, tier: 1 },
    { buys: S10, tiers: {}, tier: 1 },
    { buys: S11, tiers: { condenser: 3, firebox: 3 }, tier: 2 },
    { buys: S12, tiers: { condenser: 3, firebox: 4 }, tier: 3 },
    { buys: S13, tiers: { condenser: 5, firebox: 5, standingWave: 3 }, tier: 4 },
    { buys: S14, tiers: { condenser: 5, firebox: 5, standingWave: 5 }, tier: 4 },
    { buys: S15, tiers: { condenser: 5, firebox: 5, standingWave: 5 }, tier: 5 },
  ];

  it('hole stage, puddle size, sprout, girl steps, scraps burned and the girl stage never decrease', () => {
    const states = GROWTH.map((g) => deriveWorldState(input(g.buys, { lifetimeEe: 100000, motorRetrofitTier: g.tier, tiers: g.tiers })));
    const nonDecreasing = (xs: readonly number[]): boolean => xs.every((x, k) => k === 0 || x >= (xs[k - 1] ?? x));
    expect(states.map((s) => s.props.holeStage)).toEqual([1, 1, 1, 2, 3, 3, 4]);
    expect(states.map((s) => s.props.puddle.size)).toEqual([0, 0, 2, 2, 3, 3, 3]);
    expect(states.map((s) => s.props.sprout)).toEqual([0, 0, 2, 2, 2, 3, 4]);
    expect(states.map((s) => s.girl.steps)).toEqual([0, 0, 0, 0, 0, 1, 5]);
    expect(states.map((s) => 3 - s.props.scraps)).toEqual([0, 0, 1, 2, 3, 3, 3]);
    expect(states.map((s) => s.girl.stage)).toEqual([1, 2, 2, 3, 3, 3, 3]);
    for (const series of [
      states.map((s) => s.props.holeStage), states.map((s) => s.props.puddle.size), states.map((s) => s.props.sprout),
      states.map((s) => s.girl.steps), states.map((s) => 3 - s.props.scraps), states.map((s) => s.girl.stage),
    ]) {
      expect(nonDecreasing(series)).toBe(true);
    }
  });
});

describe('lifetimeGatesOf: the lifetime thresholds (WP24 F3)', () => {
  it('bit 1 is set at and above WORLD_HOLE.loadBeneathEe, bit 2 at and above WORLD_VIRGA.minLifetimePr, neither below', () => {
    const EE = WORLD_HOLE.loadBeneathEe;
    const PR = WORLD_VIRGA.minLifetimePr;
    expect(lifetimeGatesOf(EE - 1, PR - 1)).toBe(0);
    expect(lifetimeGatesOf(EE, PR - 1)).toBe(1);
    expect(lifetimeGatesOf(EE - 1, PR)).toBe(2);
    expect(lifetimeGatesOf(EE, PR)).toBe(3);
    expect(lifetimeGatesOf(EE * 10, PR * 10)).toBe(3);
  });

  it('NaN passes neither gate', () => {
    expect(lifetimeGatesOf(Number.NaN, Number.NaN)).toBe(0);
    expect(lifetimeGatesOf(Number.NaN, WORLD_VIRGA.minLifetimePr)).toBe(2);
    expect(lifetimeGatesOf(WORLD_HOLE.loadBeneathEe, Number.NaN)).toBe(1);
  });

  it('two EE values on the same side of the load-beneath gate derive the same state', () => {
    const above = deriveWorldState(input(STAGE_BUYS.s9, { lifetimeEe: 100000, motorRetrofitTier: 3 }));
    expect(deriveWorldState(input(STAGE_BUYS.s9, { lifetimeEe: 250000, motorRetrofitTier: 3 }))).toEqual(above);
    const below = deriveWorldState(input(STAGE_BUYS.s9, { lifetimeEe: 0, motorRetrofitTier: 3 }));
    expect(deriveWorldState(input(STAGE_BUYS.s9, { lifetimeEe: 99999, motorRetrofitTier: 3 }))).toEqual(below);
  });

  it('EE on opposite sides of the load-beneath gate changes the hole stage', () => {
    expect(deriveWorldState(input(STAGE_BUYS.s9, { lifetimeEe: 99999, motorRetrofitTier: 3 })).props.holeStage).toBe(0);
    expect(deriveWorldState(input(STAGE_BUYS.s9, { lifetimeEe: 100000, motorRetrofitTier: 3 })).props.holeStage).toBe(2);
  });

  it('two PR values on the same side of the virga gate derive the same state', () => {
    const fall = deriveWorldState(input(S10, { lifetimePr: 1000000 }));
    expect(deriveWorldState(input(S10, { lifetimePr: 5000000 }))).toEqual(fall);
    const off = deriveWorldState(input(S10, { lifetimePr: 0 }));
    expect(deriveWorldState(input(S10, { lifetimePr: 999999 }))).toEqual(off);
  });

  it('PR on opposite sides of the virga gate changes the virga state', () => {
    expect(deriveWorldState(input(S10, { lifetimePr: 999999 })).props.virga).toBe('off');
    expect(deriveWorldState(input(S10, { lifetimePr: 1000000 })).props.virga).toBe('fall');
  });

  it('the derived state depends only on the gate pair: each EE and PR sample equals its canonical gate values', () => {
    const eeSamples = [0, 99999, 100000, 250000, Number.NaN];
    const prSamples = [0, 999999, 1000000, 5000000, Number.NaN];
    for (const buys of [S9, S12, S14]) {
      for (const ee of eeSamples) {
        for (const pr of prSamples) {
          const gates = lifetimeGatesOf(ee, pr);
          const canonical = input(buys, {
            lifetimeEe: (gates & 1) !== 0 ? WORLD_HOLE.loadBeneathEe : 0,
            lifetimePr: (gates & 2) !== 0 ? WORLD_VIRGA.minLifetimePr : 0,
            motorRetrofitTier: 3,
          });
          expect(deriveWorldState(input(buys, { lifetimeEe: ee, lifetimePr: pr, motorRetrofitTier: 3 }))).toEqual(deriveWorldState(canonical));
        }
      }
    }
  });
});

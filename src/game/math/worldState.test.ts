// Tests for worldState (WP23a): the visual state derived from tech levels, lifetime EE, cycle, motor retrofit tier and ending phase.
// Covers the era I and II rules at the smoke stage level sets (s0, s2, s7, s8, s9), an era III set, the phase and era gates, the
// hole stage table, the dog pose, the edition, the tally marks, and that inputs are never mutated. Pure maths, no Phaser.
import { describe, it, expect } from 'vitest';
import { deriveWorldState } from './worldState';
import type { WorldStateInput } from './worldState';
import type { TechId } from '../../data/types';

// The smoke stage buy lists (scripts/smoke/stages.mjs:6-19), copied as literals.
const rep = (id: string, n: number): string[] => Array.from({ length: n }, () => id);
const S7 = ['wornMotor', 'gearRatio', 'gearRatio', 'gearRatio', 'reinforcedCrank', 'motorTuning', 'motorTuning', 'motorTuning',
  'motorTuning', 'motorTuning', 'flywheel', 'pistonArray', 'improvedPistons'];
const S9 = [...S7, '@blueprint', 'generator', ...rep('motorRetrofit', 5), ...rep('copperWinding', 20), 'dynamoCrank',
  'capacitorBank', 'sparkGap', ...rep('transformer', 3), 'powerLines'];
const S10 = [...S9, '@substationBlueprint', 'boiler'];
const STAGE_BUYS = {
  s0: [] as string[],
  s2: ['wornMotor'],
  s7: S7,
  s8: [...S7, '@blueprint', 'generator'],
  s9: S9,
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
  girlWindow: 'flicker', girlMini: false, windows: 'off', lamp: 'dead', lampGlow: false, boothLit: false, motes: false,
  stakeChain: true, holeStage: 0, scraps: 3, marks: 40,
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
    expect(s.sensor).toEqual({ led: 'red', readout: 'dash' });
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
      girlWindow: 'dark', girlMini: true, windows: 'dim', lamp: 'dead', lampGlow: false, boothLit: false, motes: true,
      stakeChain: true, holeStage: 0, scraps: 3, marks: 40,
    });
    expect(s.sensor).toEqual({ led: 'amber', readout: 'dash' });
  });

  it('s9 (era II full, powerLines): windows, lamp glow and booth lit, lamp lit', () => {
    const s = deriveWorldState(input(STAGE_BUYS.s9));
    expect(s.visible).toBe(true);
    expect(s.era).toBe(2);
    expect(s.eraRow).toBe(1);
    expect(s.alpha).toBe(1);
    expect(s.mode).toBe('fps8');
    expect(s.props).toEqual({
      girlWindow: 'dark', girlMini: true, windows: 'lit', lamp: 'lit', lampGlow: true, boothLit: true, motes: true,
      stakeChain: true, holeStage: 0, scraps: 3, marks: 40,
    });
    expect(s.sensor).toEqual({ led: 'amber', readout: 'dash' });
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

describe('deriveWorldState: era III and the gates', () => {
  it('era III set (S10, boiler): hidden, era II rows, steady alpha and fps8', () => {
    const s = deriveWorldState(input(S10));
    expect(s.visible).toBe(false);
    expect(s.era).toBe(2);
    expect(s.eraRow).toBe(1);
    expect(s.alpha).toBe(1);
    expect(s.shadowScale).toBe(1);
    expect(s.mode).toBe('fps8');
  });

  it('era V (nullChamber) is hidden too', () => {
    expect(deriveWorldState(input(['nullChamber'])).visible).toBe(false);
  });

  it('a running ending phase hides the layer at every era (sequence, choice, postgame)', () => {
    for (const phase of ['sequence', 'choice', 'postgame'] as const) {
      expect(deriveWorldState(input(STAGE_BUYS.s9, { phase })).visible).toBe(false);
      expect(deriveWorldState(input(STAGE_BUYS.s0, { phase })).visible).toBe(false);
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
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import type { AssetId } from '../../assets/assetIds';
import { ASSET_MANIFEST } from '../../assets/manifest';
import type { AssetEntry } from '../../assets/manifest';
import { AUDIO } from '../../data/audio';
import { PART_TIERS, PART_TIER_FX } from '../../data/machineTiers';
import type { PartTierTrack } from '../../data/machineTiers';
import { TECHNOLOGIES } from '../../data/technologies';
import type { TechId } from '../../data/types';
import {
  declaredKeys,
  diffTiers,
  heartbeatLow,
  hostTiers,
  partTierMap,
  resolveTextureKey,
  splitRelease,
  tierLevelSuffix,
  tierOf,
  tierToastSuffix,
  topTierOf,
  torqueStep,
  trackOf,
} from './partTiers';
import type { TierChange, TierKeyState } from './partTiers';

const SOURCE_URL = new URL('./partTiers.ts', import.meta.url);

const all = (): boolean => true;
const none = (): boolean => false;

/** A has() that knows exactly the listed keys. */
function loaded(...keys: string[]): (key: string) => boolean {
  const set = new Set(keys);
  return (key: string): boolean => set.has(key);
}

/** Fixture manifest: the real manifest with three entries given their own tier lists (resolver order tests only). */
const FIXTURE: Record<AssetId, AssetEntry> = {
  ...ASSET_MANIFEST,
  // Sparse: no tier 3; tier 4 has a heartbeat frame; tier 5 has none.
  'machine.motor': {
    ...ASSET_MANIFEST['machine.motor'],
    tiers: [
      { from: 2, file: 'fx/m2.png' },
      { from: 4, file: 'fx/m4.png', pulseFile: 'fx/m4b.png' },
      { from: 5, file: 'fx/m5.png' },
    ],
  },
  // Rotation sheet on tier 2 only, static on tier 3, rot + pulse frame on tier 4 (guard-breaking on purpose: rot never pulses).
  'machine.gearLarge': {
    ...ASSET_MANIFEST['machine.gearLarge'],
    tiers: [
      { from: 2, file: 'fx/g2.png', rotationFile: 'fx/g2r.png' },
      { from: 3, file: 'fx/g3.png' },
      { from: 4, file: 'fx/g4.png', rotationFile: 'fx/g4r.png', pulseFile: 'fx/g4b.png' },
    ],
  },
  // Restored part with a tier 2 variant on top (guard-breaking on purpose: restored > tier > base order).
  'machine.nullCore': {
    ...ASSET_MANIFEST['machine.nullCore'],
    tiers: [{ from: 2, file: 'fx/n2.png' }],
  },
};

const REAL_KEYS = declaredKeys();

/** The real track of a tech (the test fails loudly when it is missing). */
function track(id: TechId): PartTierTrack {
  const found = PART_TIERS.find((t) => t.techId === id);
  if (found === undefined) throw new Error(`no part tier track for ${id}`);
  return found;
}

describe('tierOf', () => {
  const gear = [1, 6, 15];

  it('maps gearRatio levels to tiers 1, 2, 3', () => {
    expect(tierOf(0, gear)).toBe(1);
    expect(tierOf(1, gear)).toBe(1);
    expect(tierOf(5, gear)).toBe(1);
    expect(tierOf(6, gear)).toBe(2);
    expect(tierOf(14, gear)).toBe(2);
    expect(tierOf(15, gear)).toBe(3);
    expect(tierOf(99, gear)).toBe(3);
  });

  it('is tier 1 for NaN, infinities and negative levels', () => {
    expect(tierOf(NaN, gear)).toBe(1);
    expect(tierOf(Infinity, gear)).toBe(1);
    expect(tierOf(-Infinity, gear)).toBe(1);
    expect(tierOf(-3, gear)).toBe(1);
  });

  it('never exceeds the track top tier', () => {
    expect(tierOf(1e9, [1, 5, 10, 20, 25])).toBe(5);
  });

  it('topTierOf is the level count of the track', () => {
    expect(topTierOf(track('gearRatio'))).toBe(3);
    expect(topTierOf(track('motorTuning'))).toBe(5);
  });

  it('trackOf finds the 21 repeatable tracks and nothing else', () => {
    expect(PART_TIERS).toHaveLength(21);
    expect(trackOf('motorTuning')?.levels).toEqual([1, 5, 10, 20, 25]);
    expect(trackOf('horizonField')).toBeUndefined();
    expect(trackOf('wornMotor')).toBeUndefined();
  });
});

describe('partTierMap and hostTiers', () => {
  it('has one entry per track and reads missing levels as tier 1', () => {
    const map = partTierMap({});
    expect(Object.keys(map)).toHaveLength(PART_TIERS.length);
    for (const track of PART_TIERS) expect(map[track.techId]).toBe(1);
  });

  it('maps fixture levels to their track tiers', () => {
    const map = partTierMap({ gearRatio: 6, motorTuning: 25 });
    expect(map.gearRatio).toBe(2);
    expect(map.motorTuning).toBe(5);
    expect(map.flywheel).toBe(1);
  });

  it('hostTiers gives mainShaft the gearRatio tier', () => {
    expect(hostTiers({ gearRatio: 6 }).get('mainShaft')).toBe(2);
    expect(hostTiers({ gearRatio: 6 }).get('gearLarge')).toBe(2);
    expect(hostTiers({}).get('mainShaft')).toBe(1);
    expect(hostTiers({ gearRatio: 15, motorTuning: 24 }).get('gearSmall')).toBe(3);
    expect(hostTiers({ motorTuning: 24 }).get('wornMotor')).toBe(4);
  });

  it('hostTiers has one entry per swap host and none for stage hosts', () => {
    const hosts = new Set(PART_TIERS.flatMap((t) => t.swaps));
    expect(hostTiers({}).size).toBe(hosts.size);
    expect(hostTiers({ copperWinding: 25 }).has('coilStage2')).toBe(false);
    expect(hostTiers({ copperWinding: 25 }).has('coilStage1')).toBe(true);
  });
});

describe('resolveTextureKey on the fixture manifest', () => {
  const state = (over: Partial<TierKeyState>): TierKeyState => ({ tier: 1, restored: false, rot: false, pulseLow: false, ...over });

  it('base key at tier 1 and when nothing is loaded', () => {
    expect(resolveTextureKey('machine.motor', state({}), all, FIXTURE)).toBe('machine.motor');
    expect(resolveTextureKey('machine.motor', state({ tier: 5 }), none, FIXTURE)).toBe('machine.motor');
  });

  it('picks the highest declared tier at or below the tier (sparse tiers fall to the lower one)', () => {
    expect(resolveTextureKey('machine.motor', state({ tier: 2 }), all, FIXTURE)).toBe('machine.motor#t2');
    expect(resolveTextureKey('machine.motor', state({ tier: 3 }), all, FIXTURE)).toBe('machine.motor#t2');
    expect(resolveTextureKey('machine.motor', state({ tier: 4 }), all, FIXTURE)).toBe('machine.motor#t4');
    expect(resolveTextureKey('machine.motor', state({ tier: 5 }), all, FIXTURE)).toBe('machine.motor#t5');
  });

  it('a missing key is skipped for the next lower declared tier, then the base', () => {
    const noT5 = loaded('machine.motor#t2', 'machine.motor#t4');
    expect(resolveTextureKey('machine.motor', state({ tier: 5 }), noT5, FIXTURE)).toBe('machine.motor#t4');
    const onlyT2 = loaded('machine.motor#t2');
    expect(resolveTextureKey('machine.motor', state({ tier: 5 }), onlyT2, FIXTURE)).toBe('machine.motor#t2');
    expect(resolveTextureKey('machine.motor', state({ tier: 5 }), none, FIXTURE)).toBe('machine.motor');
  });

  it('pulse only where the tier has a pulseFile and pulseLow is set', () => {
    expect(resolveTextureKey('machine.motor', state({ tier: 4, pulseLow: true }), all, FIXTURE)).toBe('machine.motor#t4b');
    expect(resolveTextureKey('machine.motor', state({ tier: 4, pulseLow: false }), all, FIXTURE)).toBe('machine.motor#t4');
    expect(resolveTextureKey('machine.motor', state({ tier: 5, pulseLow: true }), all, FIXTURE)).toBe('machine.motor#t5');
  });

  it('pulse key not loaded: the plain tier key is used', () => {
    const noPulse = loaded('machine.motor#t4', 'machine.motor#t2');
    expect(resolveTextureKey('machine.motor', state({ tier: 4, pulseLow: true }), noPulse, FIXTURE)).toBe('machine.motor#t4');
  });

  it('rot keeps #rot last, never doubles it, and counts only tiers with a rotation sheet', () => {
    const rot = (tier: number, has: (key: string) => boolean): string => resolveTextureKey('machine.gearLarge', state({ tier, rot: true }), has, FIXTURE);
    expect(rot(2, all)).toBe('machine.gearLarge#t2#rot');
    expect(rot(3, all)).toBe('machine.gearLarge#t2#rot');
    expect(rot(4, all)).toBe('machine.gearLarge#t4#rot');
    expect(rot(1, all)).toBe('machine.gearLarge#rot');
    expect(rot(2, loaded('machine.gearLarge#rot'))).toBe('machine.gearLarge#rot');
    for (const key of [rot(2, all), rot(4, all), rot(3, all)]) {
      expect(key.endsWith('#rot')).toBe(true);
      expect(key).not.toContain('#rot#');
    }
  });

  it('rot never pulses, even when its pulse key is loaded', () => {
    const key = resolveTextureKey('machine.gearLarge', state({ tier: 4, rot: true, pulseLow: true }), all, FIXTURE);
    expect(key).toBe('machine.gearLarge#t4#rot');
    expect(key).not.toContain('#t4b');
  });

  it('precedence: restored over tier over base', () => {
    expect(resolveTextureKey('machine.nullCore', state({ tier: 2, restored: true }), all, FIXTURE)).toBe('machine.nullCore#restored');
    expect(resolveTextureKey('machine.nullCore', state({ tier: 2 }), all, FIXTURE)).toBe('machine.nullCore#t2');
    expect(resolveTextureKey('machine.nullCore', state({ tier: 1 }), all, FIXTURE)).toBe('machine.nullCore');
  });

  it('a restored key that is not loaded falls through to the tier key, then the base', () => {
    const noRestored = (key: string): boolean => !key.includes('#restored');
    expect(resolveTextureKey('machine.nullCore', state({ tier: 2, restored: true }), noRestored, FIXTURE)).toBe('machine.nullCore#t2');
    expect(resolveTextureKey('machine.nullCore', state({ tier: 1, restored: true }), noRestored, FIXTURE)).toBe('machine.nullCore');
  });

  it('restored rot key keeps #rot last', () => {
    expect(resolveTextureKey('machine.nullCore', state({ tier: 1, restored: true, rot: true }), all, FIXTURE)).toBe('machine.nullCore#restored#rot');
  });
});

describe('resolveTextureKey on the real manifest', () => {
  const state = (over: Partial<TierKeyState>): TierKeyState => ({ tier: 1, restored: false, rot: false, pulseLow: false, ...over });
  const key = (id: AssetId, s: Partial<TierKeyState>): string => resolveTextureKey(id, state(s), (k) => REAL_KEYS.has(k));

  it('motor tier 5 is #t5, and #t5b on the heartbeat low phase', () => {
    expect(key('machine.motor', { tier: 5, pulseLow: false })).toBe('machine.motor#t5');
    expect(key('machine.motor', { tier: 5, pulseLow: true })).toBe('machine.motor#t5b');
  });

  it('gearLarge rot tier 2 is #t2#rot', () => {
    expect(key('machine.gearLarge', { tier: 2, rot: true })).toBe('machine.gearLarge#t2#rot');
  });

  it('a rot host with only a tier 3 rotation sheet keeps its base rot key at tier 2', () => {
    expect(key('machine.flywheel', { tier: 2, rot: true })).toBe('machine.flywheel#rot');
    expect(key('machine.flywheel', { tier: 3, rot: true })).toBe('machine.flywheel#t3#rot');
  });

  it('coils3 is base at tier 4 and #t5 at tier 5', () => {
    expect(key('machine.coils3', { tier: 4 })).toBe('machine.coils3');
    expect(key('machine.coils3', { tier: 5 })).toBe('machine.coils3#t5');
  });

  it('a restored part keeps its restored behaviour', () => {
    expect(key('machine.nullCore', { tier: 5, restored: true })).toBe('machine.nullCore#restored');
    expect(key('machine.nullCore', { tier: 5, restored: true, rot: true })).toBe('machine.nullCore#restored#rot');
    expect(key('machine.nullCore', { tier: 5, restored: false })).toBe('machine.nullCore');
  });

  it('uses the real manifest by default', () => {
    expect(resolveTextureKey('machine.motor', state({ tier: 5 }), (k) => REAL_KEYS.has(k))).toBe('machine.motor#t5');
  });
});

describe('declaredKeys', () => {
  it('lists the planned keys and is cached per manifest', () => {
    expect(REAL_KEYS.has('machine.motor#t5b')).toBe(true);
    expect(REAL_KEYS.has('machine.gearLarge#t2#rot')).toBe(true);
    expect(REAL_KEYS.has('machine.nullCore#restored')).toBe(true);
    expect(declaredKeys()).toBe(declaredKeys());
  });
});

describe('diffTiers on the real manifest', () => {
  const change = (c: Partial<TierChange> & Pick<TierChange, 'techId' | 'from' | 'to'>): TierChange => ({
    top: 0, hosts: [], debris: 'rust', staged: false, ...c,
  });

  it('gearRatio 1 to 2: all three gear hosts, rust', () => {
    expect(diffTiers({ gearRatio: 1 }, { gearRatio: 2 })).toEqual([
      change({ techId: 'gearRatio', from: 1, to: 2, top: 3, hosts: ['gearLarge', 'mainShaft', 'gearSmall'], debris: 'rust' }),
    ]);
  });

  it('motorTuning 1 to 2 swaps both hosts with rust; 4 to 5 and 1 to 5 end with mote', () => {
    expect(diffTiers({ motorTuning: 1 }, { motorTuning: 2 })).toEqual([
      change({ techId: 'motorTuning', from: 1, to: 2, top: 5, hosts: ['wornMotor', 'motorPlinth'], debris: 'rust' }),
    ]);
    expect(diffTiers({ motorTuning: 4 }, { motorTuning: 5 })).toEqual([
      change({ techId: 'motorTuning', from: 4, to: 5, top: 5, hosts: ['wornMotor', 'motorPlinth'], debris: 'mote' }),
    ]);
    expect(diffTiers({ motorTuning: 1 }, { motorTuning: 5 })[0]?.debris).toBe('mote');
  });

  it('flywheel 1 to 2 swaps the pedestal only (rot hosts have a tier 3 key only)', () => {
    expect(diffTiers({ flywheel: 1 }, { flywheel: 2 })).toEqual([
      change({ techId: 'flywheel', from: 1, to: 2, top: 3, hosts: ['flywheelPedestal'], debris: 'rust' }),
    ]);
  });

  it('copperWinding: stage swap at 1 to 2, staged fly-ins at 2 to 3 and 3 to 4, swap plus no stage at 4 to 5, all at 1 to 5', () => {
    expect(diffTiers({ copperWinding: 1 }, { copperWinding: 2 })).toEqual([
      change({ techId: 'copperWinding', from: 1, to: 2, top: 5, hosts: ['coilStage1'], staged: false }),
    ]);
    expect(diffTiers({ copperWinding: 2 }, { copperWinding: 3 })).toEqual([
      change({ techId: 'copperWinding', from: 2, to: 3, top: 5, hosts: ['coilStage2'], debris: 'scale', staged: true }),
    ]);
    expect(diffTiers({ copperWinding: 3 }, { copperWinding: 4 })).toEqual([
      change({ techId: 'copperWinding', from: 3, to: 4, top: 5, hosts: ['coilStage3'], debris: 'spark', staged: true }),
    ]);
    expect(diffTiers({ copperWinding: 4 }, { copperWinding: 5 })).toEqual([
      change({ techId: 'copperWinding', from: 4, to: 5, top: 5, hosts: ['coilStage3'], debris: 'mote', staged: false }),
    ]);
    expect(diffTiers({ copperWinding: 1 }, { copperWinding: 5 })).toEqual([
      change({ techId: 'copperWinding', from: 1, to: 5, top: 5, hosts: ['coilStage1', 'coilStage3', 'coilStage2'], debris: 'mote', staged: false }),
    ]);
  });

  it('harmonicCoil: ring 1 swap at 1 to 2, ring 2 staged at 2 to 3', () => {
    expect(diffTiers({ harmonicCoil: 1 }, { harmonicCoil: 2 })).toEqual([
      change({ techId: 'harmonicCoil', from: 1, to: 2, top: 5, hosts: ['coilRing1'], staged: false }),
    ]);
    expect(diffTiers({ harmonicCoil: 2 }, { harmonicCoil: 3 })).toEqual([
      change({ techId: 'harmonicCoil', from: 2, to: 3, top: 5, hosts: ['coilRing2'], debris: 'scale', staged: true }),
    ]);
  });

  it('containmentRing 1 to 2: the new orbit bead, staged', () => {
    expect(diffTiers({ containmentRing: 1 }, { containmentRing: 2 })).toEqual([
      change({ techId: 'containmentRing', from: 1, to: 2, top: 5, hosts: ['ring1Bead2'], staged: true }),
    ]);
  });

  it('resonantSiphon: the tube 2 stage at 1 to 2 (rust), tube 3 stage at 2 to 3 (mote on a 3-tier track)', () => {
    expect(diffTiers({ resonantSiphon: 1 }, { resonantSiphon: 2 })).toEqual([
      change({ techId: 'resonantSiphon', from: 1, to: 2, top: 3, hosts: ['siphonTube2L', 'siphonTube2R', 'siphonArcs2'], debris: 'rust', staged: true }),
    ]);
    expect(diffTiers({ resonantSiphon: 2 }, { resonantSiphon: 3 })).toEqual([
      change({ techId: 'resonantSiphon', from: 2, to: 3, top: 3, hosts: ['siphonTube3L', 'siphonTube3R', 'siphonArcs3'], debris: 'mote', staged: true }),
    ]);
  });

  it('decreases and equal tiers give nothing', () => {
    expect(diffTiers({ gearRatio: 3 }, { gearRatio: 2 })).toEqual([]);
    expect(diffTiers({ gearRatio: 2 }, { gearRatio: 2 })).toEqual([]);
    expect(diffTiers({}, {})).toEqual([]);
  });

  it('reports changes in track order', () => {
    const out = diffTiers({ gearRatio: 1, motorTuning: 1 }, { motorTuning: 2, gearRatio: 2 });
    expect(out.map((c) => c.techId)).toEqual(['gearRatio', 'motorTuning']);
  });

  it('a track without art gives nothing', () => {
    const artless: PartTierTrack[] = [{ techId: 'gearRatio', levels: [1, 6, 15], swaps: ['supportFrame'] }];
    expect(diffTiers({ gearRatio: 1 }, { gearRatio: 3 }, artless)).toEqual([]);
  });
});

describe('splitRelease', () => {
  const change = (techId: TechId, staged: boolean): TierChange => ({ techId, from: 1, to: 2, top: 3, hosts: ['gearLarge'], debris: 'rust', staged });

  it('keeps order, ignores staged changes and caps the beats', () => {
    const changes = [
      change('gearRatio', false), change('flywheel', true), change('motorTuning', false), change('crankServo', false),
      change('standingWave', false), change('gridExciter', false),
    ];
    const out = splitRelease(changes, 4);
    expect(out.beats.map((c) => c.techId)).toEqual(['gearRatio', 'motorTuning', 'crankServo', 'standingWave']);
    expect(out.instant.map((c) => c.techId)).toEqual(['gridExciter']);
  });

  it('defaults the cap to PART_TIER_FX.maxBeatsPerRelease (4)', () => {
    expect(PART_TIER_FX.maxBeatsPerRelease).toBe(4);
    const ids: TechId[] = ['gearRatio', 'flywheel', 'motorTuning', 'crankServo', 'gridExciter'];
    const five = ids.map((t) => change(t, false));
    const out = splitRelease(five);
    expect(out.beats).toHaveLength(4);
    expect(out.instant).toHaveLength(1);
  });

  it('staged changes never count against the cap', () => {
    const out = splitRelease([change('flywheel', true), change('flywheel', true), change('flywheel', true), change('flywheel', true), change('motorTuning', false)]);
    expect(out.beats.map((c) => c.techId)).toEqual(['motorTuning']);
    expect(out.instant).toEqual([]);
  });
});

describe('heartbeatLow', () => {
  it('is high in the second half of each 2400 ms period', () => {
    const phases = [0, 1199, 1200, 2399, 2400, -5, NaN].map((t) => heartbeatLow(t));
    expect(phases).toEqual([false, false, true, true, false, false, false]);
  });

  it('uses the given period', () => {
    expect(heartbeatLow(100, 200)).toBe(true);
    expect(heartbeatLow(99, 200)).toBe(false);
  });
});

describe('torqueStep', () => {
  it('counts the levels bought inside the current tier', () => {
    const gear = [1, 6, 15];
    expect(torqueStep(6, gear)).toBe(0);
    expect(torqueStep(7, gear)).toBe(1);
    expect(torqueStep(14, gear)).toBe(8);
    expect(torqueStep(15, gear)).toBe(0);
    expect(torqueStep(24, [1, 5, 10, 20, 25])).toBe(4);
  });

  it('is 0 at level 0', () => {
    expect(torqueStep(0, [1, 6, 15])).toBe(0);
  });
});

describe('tierLevelSuffix', () => {
  it('shows the next mark below top', () => {
    expect(tierLevelSuffix('motorTuning', 7)).toBe(' · MK II — MK III AT 10');
    expect(tierLevelSuffix('mainsBackfeed', 4)).toBe(' · MK II — MK III AT 7');
    expect(tierLevelSuffix('gearRatio', 6)).toBe(' · MK II — MK III AT 15');
  });

  it('shows the name at top', () => {
    expect(tierLevelSuffix('motorTuning', 25)).toBe(' · MK V AS BUILT');
    expect(tierLevelSuffix('gearRatio', 15)).toBe(' · MK III AS BUILT');
  });

  it('is null without a track or below level 1', () => {
    expect(tierLevelSuffix('horizonField', 5)).toBeNull();
    expect(tierLevelSuffix('wornMotor', 5)).toBeNull();
    expect(tierLevelSuffix('motorTuning', 0)).toBeNull();
  });
});

describe('tier level line width (WP22 A6)', () => {
  it('keeps every LV line within 31 characters, from level 1 to the cap', () => {
    // 31 chars is the longest detail line that fits #tech-level at UI 150 without wrapping; the old 34-char line wrapped in a browser check.
    for (const track of PART_TIERS) {
      const max = TECHNOLOGIES[track.techId].maxLevel;
      for (let n = 1; n <= (max ?? 40); n++) {
        const line = `LV ${n}/${max ?? '∞'}` + (tierLevelSuffix(track.techId, n) ?? '');
        expect(line.length, `${track.techId} ${n}: ${line}`).toBeLessThanOrEqual(31);
      }
    }
  });
});

describe('tierToastSuffix', () => {
  it('appends the mark of the new tier when the purchase crosses a tier', () => {
    expect(tierToastSuffix('motorTuning', 4, 5)).toBe(' · MK II');
    expect(tierToastSuffix('motorTuning', 3, 6)).toBe(' · MK II');
    expect(tierToastSuffix('motorTuning', 24, 25)).toBe(' · MK V');
    expect(tierToastSuffix('gearRatio', 5, 6)).toBe(' · MK II');
  });

  it('is null inside one tier, for untracked techs and for no track', () => {
    expect(tierToastSuffix('motorTuning', 3, 4)).toBeNull();
    expect(tierToastSuffix('wornMotor', 1, 5)).toBeNull();
    expect(tierToastSuffix('horizonField', 1, 20)).toBeNull();
  });
});

describe('beat timing and purity', () => {
  it('the refit bell lands on the settle moment', () => {
    expect(AUDIO.refit.bellAtMs).toBe(PART_TIER_FX.settleMs);
  });

  it('imports no Phaser module', () => {
    const source = readFileSync(SOURCE_URL, 'utf8');
    expect(source).not.toMatch(/['"]phaser['"]/);
  });
});

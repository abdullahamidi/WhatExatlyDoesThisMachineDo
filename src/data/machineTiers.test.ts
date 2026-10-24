import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ASSET_IDS } from '../assets/assetIds';
import type { AssetId } from '../assets/assetIds';
import { ASSET_MANIFEST } from '../assets/manifest';
import { restoredComponentIds } from '../game/math/restoredTextures';
import { resolveAttachment } from '../game/math/machineLayout';
import { diffTiers } from '../game/math/partTiers';
import { MACHINE_BOUNDS, MACHINE_COMPONENTS, MACHINE_COMPONENT_IDS } from './machineComponents';
import { TECHNOLOGIES } from './technologies';
import type { TechId } from './types';
import {
  PART_TIERS,
  PART_TIER_FX,
  TIER_DEBRIS,
  TIER_HEARTBEAT,
  TIER_MARKS,
  TIER_NAMES_3,
  TIER_NAMES_5,
  TIER_SWEEP,
  TIER_TEXT,
} from './machineTiers';
import type { PartTierTrack } from './machineTiers';

// WP22 T2 tier data contract (PART_TIERS §1.2, WP22 D5 option A). The expected tables are copied here, never read from PART_TIERS.

// Track order (PART_TIERS §1.2). horizonField has no track.
const ORDER: readonly TechId[] = [
  'gearRatio', 'flywheel', 'motorTuning', 'improvedPistons', 'copperWinding', 'motorRetrofit', 'transformer',
  'firebox', 'inductionHeater', 'condenser', 'bellowsDrive', 'harmonicCoil', 'pressureResonator', 'crankServo',
  'standingWave', 'gridExciter', 'containmentRing', 'resonantSiphon', 'graviticAnchor', 'mainsBackfeed', 'steamLance',
];

// PART_TIERS §1.2 reach column: the level every profile holds at primaryFunction (minimum over A, B, C).
const REACH: Partial<Record<TechId, number>> = {
  gearRatio: 15, flywheel: 10, motorTuning: 25, improvedPistons: 25, copperWinding: 25, motorRetrofit: 19,
  transformer: 20, firebox: 25, inductionHeater: 20, condenser: 20, bellowsDrive: 4, harmonicCoil: 25,
  pressureResonator: 19, crankServo: 7, standingWave: 20, gridExciter: 15, containmentRing: 25,
  resonantSiphon: 11, graviticAnchor: 3, mainsBackfeed: 8, steamLance: 13,
};

// PART_TIERS §1.2 MK levels: tier k starts at entry k - 1.
const LEVELS: Partial<Record<TechId, readonly number[]>> = {
  gearRatio: [1, 6, 15],
  flywheel: [1, 4, 10],
  motorTuning: [1, 5, 10, 20, 25],
  improvedPistons: [1, 5, 10, 20, 25],
  copperWinding: [1, 5, 10, 20, 25],
  motorRetrofit: [1, 4, 8, 13, 18],
  transformer: [1, 4, 8, 13, 20],
  firebox: [1, 5, 10, 20, 25],
  inductionHeater: [1, 4, 8, 13, 20],
  condenser: [1, 4, 8, 13, 20],
  bellowsDrive: [1, 2, 3],
  harmonicCoil: [1, 4, 8, 16, 25],
  pressureResonator: [1, 4, 8, 13, 18],
  crankServo: [1, 4, 7],
  standingWave: [1, 4, 8, 13, 20],
  gridExciter: [1, 7, 14],
  containmentRing: [1, 4, 8, 16, 25],
  resonantSiphon: [1, 5, 10],
  graviticAnchor: [1, 2, 3],
  mainsBackfeed: [1, 4, 7],
  steamLance: [1, 7, 12],
};

// Tracks with a heartbeat (PART_TIERS §2.3 lamps and pulse frames), track order.
const PULSE_TRACKS: readonly TechId[] = [
  'flywheel', 'motorTuning', 'improvedPistons', 'motorRetrofit', 'transformer', 'inductionHeater', 'condenser',
  'bellowsDrive', 'pressureResonator', 'crankServo', 'gridExciter', 'mainsBackfeed', 'steamLance',
];

// The three decal assets (WP22 D10): one use each.
const DECAL_ASSETS: readonly AssetId[] = ['machine.gearRim', 'machine.flywheelRim2', 'machine.flywheelRim3'];

// The 14 tracks whose primary host declares bolt-down mounts (WP22 F2). The other 7 (flywheel, improvedPistons, crankServo,
// harmonicCoil and the three stage-only tracks) keep the box-corner defaults.
const MOUNT_TRACKS: readonly TechId[] = [
  'gearRatio', 'motorTuning', 'copperWinding', 'motorRetrofit', 'transformer', 'firebox', 'inductionHeater',
  'condenser', 'bellowsDrive', 'pressureResonator', 'standingWave', 'gridExciter', 'mainsBackfeed', 'steamLance',
];

function trackOf(id: TechId): PartTierTrack {
  const found = PART_TIERS.find((t) => t.techId === id);
  if (found === undefined) throw new Error(`no track for ${id}`);
  return found;
}

function topLevel(t: PartTierTrack): number {
  return t.levels[t.levels.length - 1] ?? 0;
}

function topTier(t: PartTierTrack): number {
  return t.levels.length;
}

describe('PART_TIERS track list (WP22 A1)', () => {
  it('has the 21 tracks in PART_TIERS §1.2 order', () => {
    expect(PART_TIERS.map((t) => t.techId)).toEqual(ORDER);
  });

  it('gives every repeatable tech except horizonField exactly one track', () => {
    const repeatables = Object.values(TECHNOLOGIES).filter((t) => t.kind === 'repeatable').map((t) => t.id);
    expect(repeatables).toHaveLength(22);
    expect(repeatables).toContain('horizonField');
    expect(PART_TIERS.some((t) => t.techId === 'horizonField')).toBe(false);
    for (const id of repeatables) {
      const count = PART_TIERS.filter((t) => t.techId === id).length;
      expect(count, id).toBe(id === 'horizonField' ? 0 : 1);
    }
  });
});

describe('tier levels (WP22 A1)', () => {
  it('starts at 1, strictly ascends, has 3 or 5 tiers, and tops out within maxLevel', () => {
    for (const t of PART_TIERS) {
      const max = TECHNOLOGIES[t.techId].maxLevel;
      expect(t.levels[0], t.techId).toBe(1);
      expect([3, 5], t.techId).toContain(t.levels.length);
      expect(t.levels.slice(1).every((v, i) => v > (t.levels[i] ?? Number.POSITIVE_INFINITY)), t.techId).toBe(true);
      if (max !== null) expect(topLevel(t), t.techId).toBeLessThanOrEqual(max);
    }
  });

  it('uses 5 tiers iff cap = min(maxLevel, reach) >= 18, else 3, and tops out within the cap', () => {
    expect(Object.keys(REACH)).toHaveLength(21);
    for (const t of PART_TIERS) {
      const reach = REACH[t.techId];
      expect(reach, t.techId).toBeDefined();
      const max = TECHNOLOGIES[t.techId].maxLevel ?? Number.POSITIVE_INFINITY;
      const cap = Math.min(max, reach ?? 0);
      expect(t.levels.length, t.techId).toBe(cap >= 18 ? 5 : 3);
      expect(topLevel(t), t.techId).toBeLessThanOrEqual(cap);
    }
  });

  it('matches the PART_TIERS §1.2 level table exactly', () => {
    expect(Object.keys(LEVELS)).toHaveLength(21);
    for (const t of PART_TIERS) expect(t.levels, t.techId).toEqual(LEVELS[t.techId]);
  });
});

describe('hosts (WP22 C1)', () => {
  it('names only real component ids for swap and stage hosts', () => {
    for (const t of PART_TIERS) {
      for (const host of [...t.swaps, ...(t.stages ?? [])]) {
        expect(MACHINE_COMPONENT_IDS, `${t.techId}: ${host}`).toContain(host);
      }
    }
  });

  it('keeps restored components out of the swap hosts and gives no host to two tracks', () => {
    const restored = new Set<string>(restoredComponentIds());
    const owner = new Map<string, TechId>();
    for (const t of PART_TIERS) {
      for (const host of t.swaps) {
        expect(restored.has(host), host).toBe(false);
        expect(owner.has(host), `${host} swaps on two tracks`).toBe(false);
        owner.set(host, t.techId);
      }
    }
  });

  it('gives each stage host its track tech and a minLevel that is a tier threshold', () => {
    for (const t of PART_TIERS) {
      for (const host of t.stages ?? []) {
        const def = MACHINE_COMPONENTS[host];
        expect(def.techId, host).toBe(t.techId);
        expect(t.levels, host).toContain(def.minLevel);
      }
    }
  });
});

describe('decals (WP22 C1, D10)', () => {
  it('sit on swap hosts, fit the host size and MACHINE_BOUNDS, and start at tier 2 or later', () => {
    const ids = new Set<string>();
    const used: string[] = [];
    for (const t of PART_TIERS) {
      for (const d of t.decals ?? []) {
        expect(ids.has(d.id), `duplicate decal ${d.id}`).toBe(false);
        ids.add(d.id);
        used.push(d.assetId);
        expect(t.swaps, d.id).toContain(d.host);
        const def = MACHINE_COMPONENTS[d.host];
        expect(def.origin, d.id).toEqual({ x: 0.5, y: 0.5 });
        expect(ASSET_IDS, d.id).toContain(d.assetId);
        const entry = ASSET_MANIFEST[d.assetId];
        expect(entry.width, d.id).toBeLessThanOrEqual(def.size.width);
        expect(entry.height, d.id).toBeLessThanOrEqual(def.size.height);
        const at = resolveAttachment(def);
        expect(at.x - entry.width / 2, d.id).toBeGreaterThanOrEqual(MACHINE_BOUNDS.left);
        expect(at.x + entry.width / 2, d.id).toBeLessThanOrEqual(MACHINE_BOUNDS.right);
        expect(at.y - entry.height / 2, d.id).toBeGreaterThanOrEqual(MACHINE_BOUNDS.top);
        expect(at.y + entry.height / 2, d.id).toBeLessThanOrEqual(MACHINE_BOUNDS.bottom);
        expect(d.fromTier, d.id).toBeGreaterThanOrEqual(2);
        expect(d.fromTier, d.id).toBeLessThanOrEqual(topTier(t));
      }
    }
    for (const id of DECAL_ASSETS) expect(used.filter((a) => a === id), id).toHaveLength(1);
    expect(used).toHaveLength(DECAL_ASSETS.length);
  });
});

describe('vibrate amplitude and pulse (WP22 C1, D10)', () => {
  it('sets vibrateAmplitude on motorTuning only: 5 entries, MK I is the wornMotor base, MK V is half', () => {
    const withAmp = PART_TIERS.filter((t) => t.vibrateAmplitude !== undefined).map((t) => t.techId);
    expect(withAmp).toEqual(['motorTuning']);
    const motor = trackOf('motorTuning');
    const amp = motor.vibrateAmplitude ?? [];
    expect(amp).toHaveLength(5);
    expect(amp).toHaveLength(motor.levels.length);
    const worn = MACHINE_COMPONENTS.wornMotor.animation;
    expect(worn.kind).toBe('vibrate');
    const base = worn.kind === 'vibrate' ? worn.amplitude : Number.NaN;
    const first = amp[0] ?? Number.NaN;
    const last = amp[amp.length - 1] ?? Number.NaN;
    expect(first).toBe(base);
    expect(last).toBe(first * 0.5);
  });

  it('pulses exactly the listed tracks, each from its top tier', () => {
    const pulse = PART_TIERS.filter((t) => t.pulse !== undefined).map((t) => t.techId);
    expect(pulse).toEqual(PULSE_TRACKS);
    for (const t of PART_TIERS) {
      if (t.pulse !== undefined) expect(t.pulse.fromTier, t.techId).toBe(topTier(t));
    }
  });
});

describe('mounts (WP22 C1)', () => {
  it('keep every bolt-down point inside its host box (art px from the host origin)', () => {
    for (const t of PART_TIERS) {
      for (const host of MACHINE_COMPONENT_IDS) {
        const def = MACHINE_COMPONENTS[host];
        for (const p of t.mounts?.[host] ?? []) {
          expect(p.x, `${host} x`).toBeGreaterThanOrEqual(-def.origin.x * def.size.width);
          expect(p.x, `${host} x`).toBeLessThanOrEqual((1 - def.origin.x) * def.size.width);
          expect(p.y, `${host} y`).toBeGreaterThanOrEqual(-def.origin.y * def.size.height);
          expect(p.y, `${host} y`).toBeLessThanOrEqual((1 - def.origin.y) * def.size.height);
        }
      }
    }
  });

  it('declares mounts on exactly the 14 MOUNT_TRACKS (WP22 F2)', () => {
    const withMounts = PART_TIERS.filter((t) => t.mounts !== undefined).map((t) => t.techId);
    expect([...withMounts].sort()).toEqual([...MOUNT_TRACKS].sort());
  });

  it('mount keys are swap hosts with exactly two points', () => {
    for (const t of PART_TIERS) {
      for (const [host, points] of Object.entries(t.mounts ?? {})) {
        expect(t.swaps, `${t.techId} ${host}`).toContain(host);
        expect(points?.length, `${t.techId} ${host}`).toBe(2);
      }
    }
  });

  it('every non-staged tier step of a mounted track has mounts on its beat primary', () => {
    for (const t of PART_TIERS) {
      if (t.mounts === undefined) continue;
      for (let k = 1; k < t.levels.length; k++) {
        const changes = diffTiers({ [t.techId]: k }, { [t.techId]: k + 1 }, [t]);
        for (const change of changes) {
          if (change.staged) continue;
          const primary = t.swaps.find((host) => change.hosts.includes(host));
          expect(primary, `${t.techId} ${k}->${k + 1}`).toBeDefined();
          if (primary === undefined) continue;
          expect(t.mounts[primary], `${t.techId} ${k}->${k + 1}`).toBeDefined();
        }
      }
    }
  });

  it('keeps the beat overlay depth bias above its host and below one depth step (WP22 F1)', () => {
    expect(PART_TIER_FX.overlayDepthBias).toBeGreaterThan(0);
    expect(PART_TIER_FX.overlayDepthBias).toBeLessThan(1);
  });
});

describe('tier text (WP22 D11, textSweep rules)', () => {
  it('has 5 marks and the 5-step and 3-step name ladders', () => {
    expect(TIER_MARKS).toEqual(['MK I', 'MK II', 'MK III', 'MK IV', 'MK V']);
    expect(TIER_NAMES_5).toEqual(['SALVAGED', 'PATCHED', 'REINFORCED', 'TUNED', 'AS BUILT']);
    expect(TIER_NAMES_3).toEqual(['SALVAGED', 'REINFORCED', 'AS BUILT']);
  });

  it('keeps the tier line templates', () => {
    expect(TIER_TEXT.sep).toBe(' · ');
    expect(TIER_TEXT.next).toBe('{mark} — {nextMark} AT {level}');
    expect(TIER_TEXT.top).toBe('{mark} {name}');
  });

  it('sweeps every string and none breaks the text rules', () => {
    const texts = TIER_SWEEP.map((e) => e.text);
    for (const m of TIER_MARKS) expect(texts).toContain(m);
    for (const n of [...TIER_NAMES_5, ...TIER_NAMES_3]) expect(texts).toContain(n);
    for (const s of [TIER_TEXT.sep, TIER_TEXT.next, TIER_TEXT.top]) expect(texts).toContain(s);
    expect(TIER_SWEEP).toHaveLength(16);
    const offenders = (re: RegExp): string[] => TIER_SWEEP.filter((e) => re.test(e.text)).map((e) => `${e.where}: ${e.text}`);
    expect(offenders(/RESTOR/i)).toEqual([]);
    expect(offenders(/\.\.\./)).toEqual([]);
    expect(offenders(/(^|[\s(])x[0-9]/)).toEqual([]);
    expect(offenders(/colour|centre|behaviour|favour|recognis/i)).toEqual([]);
  });
});

describe('beat timings (WP22 A4, D6, D7)', () => {
  it('fits the 900 ms beat with the pool, cap and settle numbers', () => {
    expect(PART_TIER_FX.beatMs).toBe(900);
    expect(PART_TIER_FX.swapAtMs + PART_TIER_FX.ghostMs).toBeLessThanOrEqual(PART_TIER_FX.beatMs);
    for (const at of PART_TIER_FX.boltAtMs) expect(0 < at && at < PART_TIER_FX.beatMs).toBe(true);
    for (const at of PART_TIER_FX.shineMs) expect(0 < at && at < PART_TIER_FX.beatMs).toBe(true);
    expect(PART_TIER_FX.settleMs).toBe(600);
    expect(PART_TIER_FX.maxBeatsPerRelease).toBe(4);
    expect(PART_TIER_FX.pools).toEqual({ particles: 64, ghosts: 4, flashes: 4, shines: 4 });
    expect(PART_TIER_FX.shineCache).toBe(8);
  });

  it('keeps the frame clamp, crown, mount and glint numbers as positive data (WP22 D12)', () => {
    const numbers = ['maxStepMs', 'crownMs', 'crownSpeed', 'mountInsetPx', 'mountLiftPx', 'glintRisePx'] as const;
    for (const key of numbers) {
      const v: number = PART_TIER_FX[key];
      expect(Number.isFinite(v), key).toBe(true);
      expect(v, key).toBeGreaterThan(0);
    }
    expect(PART_TIER_FX.maxStepMs).toBeGreaterThanOrEqual(16);
    expect(PART_TIER_FX.maxStepMs).toBeLessThanOrEqual(PART_TIER_FX.beatMs);
    expect(PART_TIER_FX.crownMs).toBeLessThanOrEqual(PART_TIER_FX.beatMs);
    for (const key of ['mountInsetPx', 'mountLiftPx', 'glintRisePx'] as const) {
      expect(Number.isInteger(PART_TIER_FX[key]), key).toBe(true);
    }
    expect(PART_TIER_FX.mountInsetPx).toBeLessThan(16);
  });

  it('reads no beat number from TierBeatFx.ts: the six old consts are gone (WP22 D12)', () => {
    const src = readFileSync(new URL('../game/entities/TierBeatFx.ts', import.meta.url), 'utf8');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\r\n]*/g, '');
    for (const name of ['MAX_STEP_MS', 'CROWN_LIFE_MS', 'CROWN_SPEED', 'CORNER_INSET_PX', 'BOTTOM_LIFT_PX', 'GLINT_RISE_PX']) {
      expect(code, name).not.toContain(name);
    }
    expect(code).toContain('PART_TIER_FX.maxStepMs');
  });
});

describe('debris and heartbeat (WP22 D4, D10)', () => {
  it('has the 4 debris kinds, each with colours and a positive life', () => {
    expect(Object.keys(TIER_DEBRIS).sort()).toEqual(['mote', 'rust', 'scale', 'spark']);
    for (const kind of ['rust', 'scale', 'spark', 'mote'] as const) {
      const d = TIER_DEBRIS[kind];
      expect(d.colors.length, kind).toBeGreaterThan(0);
      expect(d.lifeMs, kind).toBeGreaterThan(0);
    }
  });

  it('keeps the shared heartbeat at 2400 ms', () => {
    expect(TIER_HEARTBEAT.periodMs).toBe(2400);
  });
});

describe('immutability (WP22 C1)', () => {
  it('freezes PART_TIERS and every track', () => {
    expect(Object.isFrozen(PART_TIERS)).toBe(true);
    for (const t of PART_TIERS) expect(Object.isFrozen(t), t.techId).toBe(true);
  });
});

describe('module shape (WP22 D1)', () => {
  it('uses type imports only and never mentions Phaser', () => {
    const src = readFileSync(new URL('./machineTiers.ts', import.meta.url), 'utf8');
    const runtimeImports = src.split(/\r?\n/).filter((line) => /^\s*import\s/.test(line) && !/^\s*import type\s/.test(line));
    expect(runtimeImports).toEqual([]);
    expect(src).not.toMatch(/phaser/i);
  });
});

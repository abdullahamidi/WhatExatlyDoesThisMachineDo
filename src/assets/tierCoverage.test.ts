import { describe, it, expect } from 'vitest';
import { ASSET_IDS } from './assetIds';
import type { AssetId } from './assetIds';
import { ASSET_MANIFEST } from './manifest';
import { MACHINE_COMPONENTS } from '../data/machineComponents';
import { PART_TIERS } from '../data/machineTiers';

// WP22 tier coverage (T17): the manifest `tiers` and decal entries against the expected variant table (PART_TIERS 2.3),
// the naming, rotation and pulse rules, the disk PNGs and the byte budget of the tier folder.

const NODE_FS = 'node:fs';
const ASSETS_DIR = new URL('../../public/assets/', import.meta.url);
const TIER_DIR = 'machine/tiers/';
/** Summed byte budget of every PNG under machine/tiers (WP22 size gate, 1200 KiB). */
const TIER_BYTE_BUDGET = 1_228_800;
/** Distinct tier, rotation and decal PNGs the manifest references (77 tier files, 11 rotation sheets, 3 decals). */
const TIER_PNG_COUNT = 91;

/**
 * Expected tier variants per asset. A comma list of tier numbers: `2,3,4,5p` = tiers 2..5 with a heartbeat frame
 * (pulseFile) on tier 5; `2r,3r` = tiers 2 and 3 with a rotation sheet (rotationFile) each.
 */
const EXPECTED_SPEC: Partial<Record<AssetId, string>> = {
  'machine.motor': '2,3,4,5p',
  'machine.motorPlinth': '2,3,4,5',
  'machine.gearLarge': '2r,3r',
  'machine.pulleyMain': '2r,3r',
  'machine.gearSmall': '2r,3r',
  'machine.pedestal': '2,3p',
  'machine.flywheel': '3r',
  'machine.pulleyFlywheel': '3r',
  'machine.pulleyCrank': '3r',
  'machine.pistonBlock': '2,3,4,5p',
  'machine.coils1': '2',
  'machine.coils3': '5',
  'machine.motorRetrofit': '2,3,4,5p',
  'machine.transformer': '2,3,4,5p',
  'machine.fireGlow1': '2',
  'machine.fireGlow3': '5',
  'machine.inductionHeater': '2,3,4,5p',
  'machine.condenser': '2,3,4,5p',
  'machine.bellows': '2,3p',
  'machine.coilRing1': '2',
  'machine.calliope': '2,3,4,5p',
  'machine.servoBase': '2,3p',
  'machine.servoArm': '2r,3r',
  'machine.spireWave': '2,3,4,5',
  'machine.exciterFeed': '2,3p',
  'machine.backfeedTerminal': '2,3p',
  'machine.steamLance': '2,3p',
};

/** Static decals over the rotating and static hosts (no `tiers`, one file each). */
const DECALS: ReadonlyArray<{ id: AssetId; file: string }> = [
  { id: 'machine.gearRim', file: 'machine/tiers/decals/gear-rim.png' },
  { id: 'machine.flywheelRim2', file: 'machine/tiers/decals/flywheel-rim-2.png' },
  { id: 'machine.flywheelRim3', file: 'machine/tiers/decals/flywheel-rim-3.png' },
];

interface TierVariant { from: number; rot: boolean; pulse: boolean }

function parseVariants(spec: string): TierVariant[] {
  return spec.split(',').map((token) => {
    const match = /^(\d+)([rp]?)$/.exec(token);
    if (match === null) throw new Error(`bad tier token "${token}"`);
    return { from: Number(match[1]), rot: match[2] === 'r', pulse: match[2] === 'p' };
  });
}

function expectedFor(id: AssetId): TierVariant[] {
  const spec = EXPECTED_SPEC[id];
  return spec === undefined ? [] : parseVariants(spec);
}

function variantsOf(id: AssetId): TierVariant[] {
  return (ASSET_MANIFEST[id].tiers ?? []).map((tier) => ({
    from: tier.from,
    rot: tier.rotationFile !== undefined,
    pulse: tier.pulseFile !== undefined,
  }));
}

/** Base file stem without folder and .png: `machine/worn-motor.png` -> `worn-motor`. */
function stemOf(id: AssetId): string {
  const file = ASSET_MANIFEST[id].file;
  if (file === null) throw new Error(`${id} has no file`);
  return file.slice(file.lastIndexOf('/') + 1).replace(/\.png$/, '');
}

const TIER_IDS: readonly AssetId[] = ASSET_IDS.filter((id) => ASSET_MANIFEST[id].tiers !== undefined);

interface NodeFs {
  readFileSync(path: URL): Uint8Array;
  readdirSync(path: URL): string[];
  statSync(path: URL): { size: number; isDirectory(): boolean };
}

async function nodeFs(): Promise<NodeFs> {
  return (await import(/* @vite-ignore */ NODE_FS)) as NodeFs;
}

/** Paths relative to public/assets/ of every PNG below `prefix`, recursively. */
function pngsUnder(fs: NodeFs, prefix: string): string[] {
  const out: string[] = [];
  for (const name of fs.readdirSync(new URL(prefix, ASSETS_DIR))) {
    const rel = prefix + name;
    if (fs.statSync(new URL(rel, ASSETS_DIR)).isDirectory()) out.push(...pngsUnder(fs, rel + '/'));
    else if (name.endsWith('.png')) out.push(rel);
  }
  return out;
}

/** Pixel size from the IHDR chunk of a PNG under public/assets/ (width at byte 16, height at byte 20, big endian). */
async function pngSize(rel: string): Promise<{ width: number; height: number }> {
  const fs = await nodeFs();
  const buf = fs.readFileSync(new URL(rel, ASSETS_DIR));
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return { width: dv.getUint32(16), height: dv.getUint32(20) };
}

describe('WP22 tier coverage: manifest tiers against the expected variant table', () => {
  it('gives tiers to exactly the 27 expected assets', () => {
    expect(Object.keys(EXPECTED_SPEC).length).toBe(27);
    expect(TIER_IDS.slice().sort()).toEqual(Object.keys(EXPECTED_SPEC).sort());
  });

  it('gives each asset exactly its expected tiers (from, rotationFile, pulseFile)', () => {
    for (const id of ASSET_IDS) {
      expect(variantsOf(id), id).toEqual(expectedFor(id));
    }
  });

  it('names every tier variant by its base stem: the tier file, the rot/ rotation sheet and the b heartbeat frame', () => {
    for (const id of TIER_IDS) {
      const stem = stemOf(id);
      for (const tier of ASSET_MANIFEST[id].tiers ?? []) {
        const where = `${id} t${tier.from}`;
        expect(tier.file, where).toBe(`machine/tiers/${stem}-t${tier.from}.png`);
        if (tier.rotationFile !== undefined) expect(tier.rotationFile, where).toBe(`machine/tiers/rot/${stem}-t${tier.from}-rot.png`);
        if (tier.pulseFile !== undefined) expect(tier.pulseFile, where).toBe(`machine/tiers/${stem}-t${tier.from}b.png`);
      }
    }
  });

  it('gives rotationFile to a tier exactly when the asset has a rotation sheet, and no pulseFile on a rotation asset', () => {
    for (const id of TIER_IDS) {
      const entry = ASSET_MANIFEST[id];
      for (const tier of entry.tiers ?? []) {
        const where = `${id} t${tier.from}`;
        expect(tier.rotationFile !== undefined, where).toBe(entry.rotation !== undefined);
        if (entry.rotation !== undefined) expect(tier.pulseFile, where).toBeUndefined();
      }
    }
  });

  it('has a disk PNG for every tier, rotation and decal file, at the manifest size (rotation sheets at the base sheet size)', async () => {
    const files = Object.keys(import.meta.glob('/public/assets/**/*.png'));
    for (const id of TIER_IDS) {
      const entry = ASSET_MANIFEST[id];
      for (const tier of entry.tiers ?? []) {
        for (const rel of [tier.file, tier.pulseFile]) {
          if (rel === undefined) continue;
          expect(files, rel).toContain(`/public/assets/${rel}`);
          expect(await pngSize(rel), rel).toEqual({ width: entry.width, height: entry.height });
        }
        if (tier.rotationFile !== undefined && entry.rotation !== undefined) {
          expect(files, tier.rotationFile).toContain(`/public/assets/${tier.rotationFile}`);
          expect(await pngSize(tier.rotationFile), tier.rotationFile).toEqual(await pngSize(entry.rotation.file));
        }
      }
    }
    for (const want of DECALS) {
      const entry = ASSET_MANIFEST[want.id];
      expect(entry.file, want.id).toBe(want.file);
      expect(files, want.id).toContain(`/public/assets/${want.file}`);
      expect(await pngSize(want.file), want.id).toEqual({ width: entry.width, height: entry.height });
    }
  });

  it('keeps the summed size of the PNGs under machine/tiers within 1,228,800 bytes', async () => {
    const fs = await nodeFs();
    const total = pngsUnder(fs, TIER_DIR).reduce((sum, rel) => sum + fs.statSync(new URL(rel, ASSETS_DIR)).size, 0);
    expect(total).toBeLessThanOrEqual(TIER_BYTE_BUDGET);
  });

  it('has one PNG on disk per distinct tier, rotation and decal file the manifest references (91, none stray or missing)', async () => {
    const fs = await nodeFs();
    const referenced = new Set<string>();
    for (const id of ASSET_IDS) {
      const entry = ASSET_MANIFEST[id];
      const paths = [entry.file, entry.rotation?.file, ...(entry.tiers ?? []).flatMap((t) => [t.file, t.rotationFile, t.pulseFile])];
      for (const rel of paths) {
        if (rel !== undefined && rel !== null && rel.startsWith(TIER_DIR)) referenced.add(rel);
      }
    }
    expect(referenced.size).toBe(TIER_PNG_COUNT);
    expect(pngsUnder(fs, TIER_DIR).sort()).toEqual([...referenced].sort());
  });

  it('ties every PART_TIERS swap host to its manifest tier art (tier range, heartbeat tier, pulse host)', () => {
    for (const track of PART_TIERS) {
      if (track.swaps.length === 0) continue;
      const hostAssets = track.swaps.map((host) => MACHINE_COMPONENTS[host].assetId);
      expect(
        hostAssets.some((id) => ASSET_MANIFEST[id].tiers !== undefined),
        `${track.techId}: no swap host has tier art`,
      ).toBe(true);
      for (const id of hostAssets) {
        for (const tier of ASSET_MANIFEST[id].tiers ?? []) {
          const where = `${track.techId} ${id} t${tier.from}`;
          expect(tier.from >= 2 && tier.from <= track.levels.length, where).toBe(true);
          if (tier.pulseFile !== undefined) {
            expect(track.pulse, where).toBeDefined();
            expect(tier.from, where).toBe(track.pulse?.fromTier);
          }
        }
      }
      if (track.pulse !== undefined) {
        const pulseTier = track.pulse.fromTier;
        const pulsed = hostAssets.some((id) =>
          (ASSET_MANIFEST[id].tiers ?? []).some((tier) => tier.from === pulseTier && tier.pulseFile !== undefined),
        );
        expect(pulsed, `${track.techId}: no swap host has a pulse frame at t${pulseTier}`).toBe(true);
      }
    }
  });

  it('has no orphan tier art: every tiered asset is the asset of a PART_TIERS swap host', () => {
    const swapAssets = new Set<AssetId>(PART_TIERS.flatMap((track) => track.swaps).map((host) => MACHINE_COMPONENTS[host].assetId));
    const orphans = TIER_IDS.filter((id) => !swapAssets.has(id));
    expect(orphans).toEqual([]);
  });

  it('lists each PART_TIERS decal id exactly once and no other decal id', () => {
    const decalIds = PART_TIERS.flatMap((track) => (track.decals ?? []).map((decal) => decal.assetId));
    for (const want of DECALS) {
      expect(decalIds.filter((id) => id === want.id), want.id).toHaveLength(1);
    }
    expect(decalIds.slice().sort()).toEqual(DECALS.map((decal) => decal.id).sort());
  });
});

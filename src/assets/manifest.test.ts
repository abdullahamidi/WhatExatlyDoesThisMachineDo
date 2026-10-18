import { describe, it, expect } from 'vitest';
import { ASSET_IDS } from './assetIds';
import type { AssetId } from './assetIds';
import { ASSET_MANIFEST, planAssetLoads, resolveAssetUrl, missingTextureIds } from './manifest';
import type { AssetEntry } from './manifest';
import { MACHINE_COMPONENT_IDS, MACHINE_COMPONENTS } from '../data/machineComponents';

describe('ASSET_MANIFEST', () => {
  it('has exactly one entry per asset id, with matching id fields', () => {
    expect(Object.keys(ASSET_MANIFEST).length).toBe(ASSET_IDS.length);
    for (const id of ASSET_IDS) {
      const entry = ASSET_MANIFEST[id];
      expect(entry.id).toBe(id);
    }
  });

  it('has integer positive dimensions, origin within [0,1] and a non-empty description', () => {
    for (const id of ASSET_IDS) {
      const entry = ASSET_MANIFEST[id];
      expect(Number.isInteger(entry.width) && entry.width > 0).toBe(true);
      expect(Number.isInteger(entry.height) && entry.height > 0).toBe(true);
      expect(entry.origin.x).toBeGreaterThanOrEqual(0);
      expect(entry.origin.x).toBeLessThanOrEqual(1);
      expect(entry.origin.y).toBeGreaterThanOrEqual(0);
      expect(entry.origin.y).toBeLessThanOrEqual(1);
      expect(entry.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('uses power-of-two widths for horizontally tileable entries', () => {
    for (const id of ASSET_IDS) {
      const entry = ASSET_MANIFEST[id];
      if (entry.tileable === 'x' || entry.tileable === 'xy') {
        expect((entry.width & (entry.width - 1)) === 0).toBe(true);
      }
    }
  });

  it('has a disk file for every entry with a non-null file (vacuously true while all are procedural)', () => {
    const files = import.meta.glob('/public/assets/**/*.png');
    for (const id of ASSET_IDS) {
      const entry = ASSET_MANIFEST[id];
      if (entry.file !== null) {
        expect(Object.keys(files)).toContain(`/public/assets/${entry.file}`);
      }
    }
  });

  it('gives every machine component the size of its manifest entry', () => {
    for (const id of MACHINE_COMPONENT_IDS) {
      const def = MACHINE_COMPONENTS[id];
      const entry = ASSET_MANIFEST[def.assetId];
      expect(def.size).toEqual({ width: entry.width, height: entry.height });
    }
  });
});

describe('resolveAssetUrl', () => {
  const base: AssetEntry = ASSET_MANIFEST['machine.crank'];

  it('returns null for procedural-only entries', () => {
    expect(resolveAssetUrl({ ...base, file: null })).toBeNull();
  });

  it('prefixes the default baseUrl', () => {
    expect(resolveAssetUrl({ ...base, file: 'machine/x.png' })).toBe('assets/machine/x.png');
  });

  it('respects a custom baseUrl', () => {
    expect(resolveAssetUrl({ ...base, file: 'machine/x.png' }, '/a/')).toBe('/a/machine/x.png');
  });
});

describe('planAssetLoads', () => {
  it('returns no loads for the real manifest (all procedural)', () => {
    expect(planAssetLoads()).toEqual([]);
  });

  it('plans file-backed entries in ASSET_IDS order with the correct kind and frame', () => {
    const custom: Record<AssetId, AssetEntry> = {
      ...ASSET_MANIFEST,
      'machine.crank': { ...ASSET_MANIFEST['machine.crank'], file: 'machine/hand-crank.png' },
      'fx.dust': { ...ASSET_MANIFEST['fx.dust'], file: 'fx/dust.png', frame: { width: 4, height: 4, count: 3 } },
    };
    const loads = planAssetLoads(custom);
    expect(loads).toEqual([
      { key: 'fx.dust', url: 'assets/fx/dust.png', kind: 'spritesheet', frame: { width: 4, height: 4, count: 3 } },
      { key: 'machine.crank', url: 'assets/machine/hand-crank.png', kind: 'image' },
    ]);
    expect('frame' in (loads[1] ?? {})).toBe(false);
  });
});

describe('missingTextureIds', () => {
  it('returns every id, in ASSET_IDS order, when nothing exists', () => {
    expect(missingTextureIds(() => false)).toEqual([...ASSET_IDS]);
  });

  it('returns only the ids that do not exist', () => {
    expect(missingTextureIds((k) => k !== 'fx.steam')).toEqual(['fx.steam']);
  });

  it('returns an empty list when everything exists', () => {
    expect(missingTextureIds(() => true)).toEqual([]);
  });

  it('honours a custom ids argument', () => {
    expect(missingTextureIds(() => false, ['fx.dust', 'bg.sky'])).toEqual(['fx.dust', 'bg.sky']);
    expect(missingTextureIds((k) => k === 'bg.sky', ['fx.dust', 'bg.sky'])).toEqual(['fx.dust']);
  });
});

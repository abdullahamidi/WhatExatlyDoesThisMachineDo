import { describe, it, expect } from 'vitest';
import { ASSET_IDS } from './assetIds';
import type { AssetId } from './assetIds';
import { ASSET_MANIFEST, planAssetLoads, resolveAssetUrl, missingTextureIds, sheetFrameRects } from './manifest';
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

  it('gives every machine component the size of its manifest entry (the frame size for sheets)', () => {
    for (const id of MACHINE_COMPONENT_IDS) {
      const def = MACHINE_COMPONENTS[id];
      const entry = ASSET_MANIFEST[def.assetId];
      const dims = entry.frame !== undefined
        ? { width: entry.frame.width, height: entry.frame.height }
        : { width: entry.width, height: entry.height };
      expect(def.size).toEqual(dims);
    }
  });
});

describe('WP6 machine assets', () => {
  const NEW_MACHINE_ENTRIES: ReadonlyArray<{ id: AssetId; width: number; height: number; origin: { x: number; y: number } }> = [
    { id: 'machine.bearingPlate', width: 16, height: 16, origin: { x: 0.5, y: 0.5 } },
    { id: 'machine.pulleyMotor', width: 12, height: 12, origin: { x: 0.5, y: 0.5 } },
    { id: 'machine.pulleyMain', width: 24, height: 24, origin: { x: 0.5, y: 0.5 } },
    { id: 'machine.pulleyCrank', width: 32, height: 32, origin: { x: 0.5, y: 0.5 } },
    { id: 'machine.pulleyFlywheel', width: 28, height: 28, origin: { x: 0.5, y: 0.5 } },
    { id: 'machine.pedestal', width: 48, height: 64, origin: { x: 0.5, y: 1 } },
    { id: 'machine.motorPlinth', width: 48, height: 10, origin: { x: 0.5, y: 1 } },
    { id: 'machine.pistonBlock', width: 96, height: 58, origin: { x: 0.5, y: 1 } },
    { id: 'machine.pistonYoke', width: 80, height: 16, origin: { x: 0.5, y: 0.75 } },
    { id: 'machine.crankBrace', width: 48, height: 48, origin: { x: 0.5, y: 0.5 } },
  ];

  it('has the contract width, height and origin for each of the 10 new machine ids', () => {
    expect(NEW_MACHINE_ENTRIES.length).toBe(10);
    for (const want of NEW_MACHINE_ENTRIES) {
      const entry = ASSET_MANIFEST[want.id];
      expect(entry.width, want.id).toBe(want.width);
      expect(entry.height, want.id).toBe(want.height);
      expect(entry.origin, want.id).toEqual(want.origin);
      expect(entry.tileable, want.id).toBe('none');
    }
  });

  it('no longer registers the removed piston id', () => {
    expect(ASSET_IDS.some((id) => id.endsWith('piston'))).toBe(false);
    expect(Object.keys(ASSET_MANIFEST).some((id) => id.endsWith('piston'))).toBe(false);
  });

  it('gives every file-backed entry a unique .png path', () => {
    const files = ASSET_IDS.map((id) => ASSET_MANIFEST[id].file).filter((f): f is string => f !== null);
    expect(new Set(files).size).toBe(files.length);
    for (const file of files) {
      expect(file.endsWith('.png')).toBe(true);
    }
  });
});

describe('WP8 era II machine assets', () => {
  const ERA2_ENTRIES: ReadonlyArray<{ id: AssetId; width: number; height: number; origin: { x: number; y: number } }> = [
    { id: 'machine.generatorPlinth', width: 104, height: 10, origin: { x: 0.5, y: 1 } },
    { id: 'machine.generator', width: 96, height: 64, origin: { x: 0.5, y: 0.5 } },
    { id: 'machine.pulleyGenerator', width: 20, height: 20, origin: { x: 0.5, y: 0.5 } },
    { id: 'machine.coils1', width: 64, height: 40, origin: { x: 0.5, y: 0.5 } },
    { id: 'machine.coils2', width: 64, height: 40, origin: { x: 0.5, y: 0.5 } },
    { id: 'machine.coils3', width: 64, height: 40, origin: { x: 0.5, y: 0.5 } },
    { id: 'machine.motorRetrofit', width: 32, height: 16, origin: { x: 0.5, y: 0.5 } },
    { id: 'machine.dynamo', width: 24, height: 24, origin: { x: 0.5, y: 0.5 } },
    { id: 'machine.capacitorRack', width: 48, height: 64, origin: { x: 0.5, y: 1 } },
    { id: 'machine.sparkGap', width: 128, height: 48, origin: { x: 0.5, y: 1 } },
    { id: 'machine.transformer', width: 64, height: 64, origin: { x: 0.5, y: 1 } },
    { id: 'machine.cableMast', width: 16, height: 112, origin: { x: 0.5, y: 1 } },
  ];

  it('has the contract width, height and origin for each of the 12 era II machine ids', () => {
    expect(ERA2_ENTRIES.length).toBe(12);
    for (const want of ERA2_ENTRIES) {
      const entry = ASSET_MANIFEST[want.id];
      expect(entry.width, want.id).toBe(want.width);
      expect(entry.height, want.id).toBe(want.height);
      expect(entry.origin, want.id).toEqual(want.origin);
      expect(entry.tileable, want.id).toBe('none');
      expect(entry.file, want.id).not.toBeNull();
    }
  });

  it('points the era II machine entries at their delivered files under machine/era2/', () => {
    for (const want of ERA2_ENTRIES) {
      expect(ASSET_MANIFEST[want.id].file?.startsWith('machine/era2/'), want.id).toBe(true);
    }
  });

  it('has the spark gap sheet as 4 frames of 32x48 in a 128x48 image', () => {
    const entry = ASSET_MANIFEST['machine.sparkGap'];
    expect(entry.frame).toEqual({ width: 32, height: 48, count: 4 });
    expect(sheetFrameRects(entry)).toEqual([
      { x: 0, y: 0, width: 32, height: 48 },
      { x: 32, y: 0, width: 32, height: 48 },
      { x: 64, y: 0, width: 32, height: 48 },
      { x: 96, y: 0, width: 32, height: 48 },
    ]);
  });

  it('has the lit pylons overlay as a tileable power-of-two image', () => {
    const entry = ASSET_MANIFEST['bg.pylonsLit'];
    expect(entry.file).toBe('bg/pylons-lit.png');
    expect(entry.tileable).toBe('x');
    expect(entry.width & (entry.width - 1)).toBe(0);
    expect(entry.width).toBe(256);
    expect(entry.height).toBe(256);
  });
});

describe('sheetFrameRects', () => {
  it('returns no rects for an entry without a frame', () => {
    expect(sheetFrameRects(ASSET_MANIFEST['machine.crank'])).toEqual([]);
  });

  it('wraps row-major by the number of columns', () => {
    const entry: AssetEntry = { ...ASSET_MANIFEST['machine.crank'], width: 64, height: 64, frame: { width: 32, height: 32, count: 4 } };
    expect(sheetFrameRects(entry)).toEqual([
      { x: 0, y: 0, width: 32, height: 32 },
      { x: 32, y: 0, width: 32, height: 32 },
      { x: 0, y: 32, width: 32, height: 32 },
      { x: 32, y: 32, width: 32, height: 32 },
    ]);
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

/** Copy of an entry without its rotation sheet (custom-manifest fixtures must not pull in #rot loads). */
function withoutRotation(entry: AssetEntry): AssetEntry {
  const { rotation: _rotation, ...rest } = entry;
  return rest;
}

describe('planAssetLoads', () => {
  it('loads exactly the file-backed entries of the real manifest as images (spritesheets excluded)', () => {
    const fileBacked = ASSET_IDS.filter((id) => ASSET_MANIFEST[id].file !== null && ASSET_MANIFEST[id].frame === undefined);
    const images = planAssetLoads().filter((l) => l.kind === 'image');
    expect(images.map((l) => l.key)).toEqual(fileBacked);
  });

  it('plans file-backed entries in ASSET_IDS order with the correct kind and frame', () => {
    const procedural = Object.fromEntries(
      ASSET_IDS.map((id) => [id, { ...withoutRotation(ASSET_MANIFEST[id]), file: null }]),
    ) as Record<AssetId, AssetEntry>;
    const custom: Record<AssetId, AssetEntry> = {
      ...procedural,
      'machine.crank': { ...withoutRotation(ASSET_MANIFEST['machine.crank']), file: 'machine/hand-crank.png' },
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

describe('WP6c rotation sheets and sky', () => {
  const ROTATION_IDS: readonly AssetId[] = [
    'machine.flywheel',
    'machine.gearLarge',
    'machine.gearSmall',
    'machine.crank',
    'machine.crankBrace',
    'machine.pulleyMain',
    'machine.pulleyCrank',
    'machine.pulleyFlywheel',
    'machine.pulleyMotor',
    'machine.pulleyGenerator',
  ];

  it('has a disk file for the sky entry', () => {
    expect(ASSET_MANIFEST['bg.sky'].file).not.toBeNull();
  });

  it('gives exactly the ten machine ids a rotation sheet', () => {
    const withRotation = ASSET_IDS.filter((id) => ASSET_MANIFEST[id].rotation !== undefined);
    expect(withRotation.slice().sort()).toEqual([...ROTATION_IDS].sort());
  });

  it('has an existing png and an integer frame count above 1 for every rotation entry', () => {
    const files = Object.keys(import.meta.glob('/public/assets/**/*.png'));
    for (const id of ROTATION_IDS) {
      const rotation = ASSET_MANIFEST[id].rotation;
      expect(rotation, id).toBeDefined();
      if (rotation === undefined) continue;
      expect(files, id).toContain(`/public/assets/${rotation.file}`);
      expect(Number.isInteger(rotation.frames) && rotation.frames > 1, id).toBe(true);
    }
  });

  it('plans one #rot spritesheet per rotation entry with the entry frame size and frame count', () => {
    const rotLoads = planAssetLoads().filter((l) => l.key.endsWith('#rot'));
    expect(rotLoads.map((l) => l.key).sort()).toEqual(ROTATION_IDS.map((id) => id + '#rot').sort());
    for (const id of ROTATION_IDS) {
      const entry = ASSET_MANIFEST[id];
      const rotation = entry.rotation;
      if (rotation === undefined) continue;
      const load = rotLoads.find((l) => l.key === id + '#rot');
      expect(load, id).toEqual({
        key: id + '#rot',
        url: 'assets/' + rotation.file,
        kind: 'spritesheet',
        frame: { width: entry.width, height: entry.height, count: rotation.frames },
      });
      expect(load?.url.startsWith('assets/machine/rot/') || load?.url.startsWith('assets/machine/era2/rot/'), id).toBe(true);
    }
  });

  it('places each #rot load right after its own entry load', () => {
    const keys = planAssetLoads().map((l) => l.key);
    for (const id of ROTATION_IDS) {
      expect(keys[keys.indexOf(id + '#rot') - 1], id).toBe(id);
    }
  });
});

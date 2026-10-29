import { describe, it, expect } from 'vitest';
import { ASSET_IDS } from './assetIds';
import type { AssetId } from './assetIds';
import { ASSET_MANIFEST, planAssetLoads, resolveAssetUrl, missingTextureIds, sheetFrameRects, restoredTextureKey, tierTextureKey, ROT_SUFFIX, RESTORED_SUFFIX, TIER_SUFFIX } from './manifest';
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

describe('WP9 era III machine and fx assets', () => {
  const ERA3_ENTRIES: ReadonlyArray<{ id: AssetId; file: string; width: number; height: number; origin: { x: number; y: number } }> = [
    { id: 'machine.boiler', file: 'machine/era3/boiler.png', width: 128, height: 96, origin: { x: 0.5, y: 1 } },
    { id: 'machine.chimney', file: 'machine/era3/chimney.png', width: 32, height: 160, origin: { x: 0.5, y: 1 } },
    { id: 'machine.steamManifold', file: 'machine/era3/steam-manifold.png', width: 96, height: 14, origin: { x: 0.5, y: 1 } },
    { id: 'machine.gauge', file: 'machine/era3/gauge.png', width: 24, height: 24, origin: { x: 0.5, y: 1 } },
    { id: 'machine.gaugeNeedle', file: 'machine/era3/gauge-needle.png', width: 600, height: 24, origin: { x: 0.5, y: 1 } },
    { id: 'machine.fireGlow1', file: 'machine/era3/firebox-1.png', width: 96, height: 24, origin: { x: 0.5, y: 0.5 } },
    { id: 'machine.fireGlow2', file: 'machine/era3/firebox-2.png', width: 96, height: 24, origin: { x: 0.5, y: 0.5 } },
    { id: 'machine.fireGlow3', file: 'machine/era3/firebox-3.png', width: 96, height: 24, origin: { x: 0.5, y: 0.5 } },
    { id: 'machine.inductionHeater', file: 'machine/era3/induction-heater.png', width: 56, height: 40, origin: { x: 0.5, y: 1 } },
    { id: 'machine.superheater', file: 'machine/era3/superheater.png', width: 40, height: 32, origin: { x: 0.5, y: 1 } },
    { id: 'machine.reliefValves', file: 'machine/era3/relief-valves.png', width: 16, height: 24, origin: { x: 0.5, y: 1 } },
    { id: 'machine.steamHammer', file: 'machine/era3/steam-hammer.png', width: 48, height: 96, origin: { x: 0.5, y: 1 } },
    { id: 'machine.hammerRam', file: 'machine/era3/hammer-ram.png', width: 12, height: 36, origin: { x: 0.5, y: 1 } },
    { id: 'machine.condenser', file: 'machine/era3/condenser.png', width: 80, height: 24, origin: { x: 0.5, y: 1 } },
    { id: 'machine.turbine', file: 'machine/era3/turbine.png', width: 80, height: 64, origin: { x: 0.5, y: 1 } },
    { id: 'machine.turbineRotor', file: 'machine/era3/turbine-rotor.png', width: 28, height: 28, origin: { x: 0.5, y: 0.5 } },
    { id: 'fx.steamPuff', file: 'fx/steam-puff.png', width: 64, height: 16, origin: { x: 0.5, y: 0.5 } },
    { id: 'fx.smoke', file: 'fx/smoke.png', width: 64, height: 16, origin: { x: 0.5, y: 0.5 } },
  ];

  it('appends the 18 era III ids after machine.cableMast, in contract order', () => {
    expect(ASSET_IDS.slice(ASSET_IDS.indexOf('machine.cableMast') + 1, ASSET_IDS.indexOf('fx.smoke') + 1)).toEqual(ERA3_ENTRIES.map((e) => e.id));
  });

  it('has the contract file, width, height, origin and tileable none for each new id', () => {
    for (const want of ERA3_ENTRIES) {
      const entry = ASSET_MANIFEST[want.id];
      expect(entry.file, want.id).toBe(want.file);
      expect(entry.width, want.id).toBe(want.width);
      expect(entry.height, want.id).toBe(want.height);
      expect(entry.origin, want.id).toEqual(want.origin);
      expect(entry.tileable, want.id).toBe('none');
      expect(entry.description.trim().length, want.id).toBeGreaterThan(0);
    }
  });

  it('has a sheet frame for the gauge needle, the firebox glows and the two steam sheets, and no frame elsewhere', () => {
    expect(ASSET_MANIFEST['machine.gaugeNeedle'].frame).toEqual({ width: 24, height: 24, count: 25 });
    for (const id of ['machine.fireGlow1', 'machine.fireGlow2', 'machine.fireGlow3'] as const) {
      expect(ASSET_MANIFEST[id].frame, id).toEqual({ width: 24, height: 24, count: 4 });
    }
    for (const id of ['fx.steamPuff', 'fx.smoke'] as const) {
      expect(ASSET_MANIFEST[id].frame, id).toEqual({ width: 16, height: 16, count: 4 });
    }
    expect(ASSET_MANIFEST['machine.boiler'].frame).toBeUndefined();
    expect(ASSET_MANIFEST['machine.turbine'].frame).toBeUndefined();
  });

  it('plans the sheet entries as spritesheets with their frame', () => {
    const loads = planAssetLoads();
    for (const id of ['machine.gaugeNeedle', 'machine.fireGlow1', 'machine.fireGlow2', 'machine.fireGlow3', 'fx.steamPuff', 'fx.smoke'] as const) {
      const load = loads.find((l) => l.key === id);
      expect(load?.kind, id).toBe('spritesheet');
      expect(load?.frame, id).toEqual(ASSET_MANIFEST[id].frame);
    }
  });

  it('gaugeNeedle cells run x 0..576 step 24 on row 0', () => {
    const rects = sheetFrameRects(ASSET_MANIFEST['machine.gaugeNeedle']);
    expect(rects.length).toBe(25);
    rects.forEach((r, i) => {
      expect(r).toEqual({ x: i * 24, y: 0, width: 24, height: 24 });
    });
    expect(rects[24]?.x).toBe(576);
  });

  it('steam puff cells are four 16x16 cells at x 0, 16, 32, 48', () => {
    expect(sheetFrameRects(ASSET_MANIFEST['fx.steamPuff'])).toEqual([
      { x: 0, y: 0, width: 16, height: 16 },
      { x: 16, y: 0, width: 16, height: 16 },
      { x: 32, y: 0, width: 16, height: 16 },
      { x: 48, y: 0, width: 16, height: 16 },
    ]);
  });

  it('the turbine rotor is a 224x224 rotation sheet of 64 frames of 28x28 under machine/era3/rot/', () => {
    const entry = ASSET_MANIFEST['machine.turbineRotor'];
    expect(entry.rotation).toEqual({ file: 'machine/era3/rot/turbine-rotor-rot.png', frames: 64 });
    const files = Object.keys(import.meta.glob('/public/assets/**/*.png'));
    expect(files).toContain('/public/assets/machine/era3/rot/turbine-rotor-rot.png');
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
    const images = planAssetLoads().filter((l) => l.kind === 'image' && !l.key.includes('#'));
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
    'machine.turbineRotor',
    'machine.servoArm',
    'machine.nullCore',
    'machine.inversionGhost',
  ];

  it('has a disk file for the sky entry', () => {
    expect(ASSET_MANIFEST['bg.sky'].file).not.toBeNull();
  });

  it('gives exactly the fourteen machine ids (ten WP6 + WP8, the era III turbine rotor, the era IV servo arm, the era V null core and inversion ghost) a rotation sheet', () => {
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
    // Original rotation loads only: `${id}#rot` has one '#'; restored (`#restored#rot`) and tier (`#t<n>#rot`) keys have more.
    const rotLoads = planAssetLoads().filter((l) => l.key.endsWith('#rot') && l.key.split('#').length === 2);
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
      expect(
        load?.url.startsWith('assets/machine/rot/') || load?.url.startsWith('assets/machine/era2/rot/') || load?.url.startsWith('assets/machine/era3/rot/') || load?.url.startsWith('assets/machine/era4/rot/') || load?.url.startsWith('assets/machine/era5/rot/'),
        id,
      ).toBe(true);
    }
  });

  it('places each #rot load right after its own entry load', () => {
    const keys = planAssetLoads().map((l) => l.key);
    for (const id of ROTATION_IDS) {
      expect(keys[keys.indexOf(id + '#rot') - 1], id).toBe(id);
    }
  });
});

/** WP11 era V contract table: id, file, whole-image size, origin, sheet frame (if any), rotation sheet (if any). */
const ERA5_ENTRIES: ReadonlyArray<{
  id: AssetId; file: string; width: number; height: number; origin: { x: number; y: number };
  frame?: { width: number; height: number; count: number }; rotation?: { file: string; frames: number };
}> = [
  { id: 'machine.nullGallery', file: 'machine/era5/null-gallery.png', width: 128, height: 30, origin: { x: 0.5, y: 1 } },
  { id: 'machine.nullChamber', file: 'machine/era5/null-chamber.png', width: 128, height: 116, origin: { x: 0.5, y: 1 } },
  { id: 'machine.nullCore', file: 'machine/era5/null-core.png', width: 64, height: 64, origin: { x: 0.5, y: 0.5 }, rotation: { file: 'machine/era5/rot/null-core-rot.png', frames: 64 } },
  { id: 'machine.nullCoreGlint', file: 'machine/era5/null-core-glint.png', width: 64, height: 64, origin: { x: 0.5, y: 0.5 } },
  { id: 'machine.ring1Back', file: 'machine/era5/ring1-back.png', width: 112, height: 72, origin: { x: 0.5, y: 0.5 } },
  { id: 'machine.ring2Back', file: 'machine/era5/ring2-back.png', width: 112, height: 72, origin: { x: 0.5, y: 0.5 } },
  { id: 'machine.ring3Back', file: 'machine/era5/ring3-back.png', width: 112, height: 72, origin: { x: 0.5, y: 0.5 } },
  { id: 'machine.ring4Back', file: 'machine/era5/ring4-back.png', width: 112, height: 72, origin: { x: 0.5, y: 0.5 } },
  { id: 'machine.ring1Front', file: 'machine/era5/ring1-front.png', width: 112, height: 72, origin: { x: 0.5, y: 0.5 } },
  { id: 'machine.ring2Front', file: 'machine/era5/ring2-front.png', width: 112, height: 72, origin: { x: 0.5, y: 0.5 } },
  { id: 'machine.ring3Front', file: 'machine/era5/ring3-front.png', width: 112, height: 72, origin: { x: 0.5, y: 0.5 } },
  { id: 'machine.ring4Front', file: 'machine/era5/ring4-front.png', width: 112, height: 72, origin: { x: 0.5, y: 0.5 } },
  { id: 'machine.ringBead', file: 'machine/era5/ring-bead.png', width: 5, height: 5, origin: { x: 0.5, y: 0.5 } },
  { id: 'machine.siphonTube', file: 'machine/era5/siphon-tube.png', width: 12, height: 30, origin: { x: 0.5, y: 1 } },
  { id: 'machine.siphonArcs1', file: 'machine/era5/siphon-arcs-1.png', width: 512, height: 64, origin: { x: 0.5, y: 0.5 }, frame: { width: 128, height: 64, count: 4 } },
  { id: 'machine.siphonArcs2', file: 'machine/era5/siphon-arcs-2.png', width: 512, height: 64, origin: { x: 0.5, y: 0.5 }, frame: { width: 128, height: 64, count: 4 } },
  { id: 'machine.siphonArcs3', file: 'machine/era5/siphon-arcs-3.png', width: 512, height: 64, origin: { x: 0.5, y: 0.5 }, frame: { width: 128, height: 64, count: 4 } },
  { id: 'machine.graviticAnchor', file: 'machine/era5/gravitic-anchor.png', width: 32, height: 128, origin: { x: 0.5, y: 1 } },
  { id: 'machine.anchorGlow1', file: 'machine/era5/anchor-glow-1.png', width: 128, height: 128, origin: { x: 0.5, y: 1 }, frame: { width: 32, height: 128, count: 4 } },
  { id: 'machine.anchorGlow2', file: 'machine/era5/anchor-glow-2.png', width: 128, height: 128, origin: { x: 0.5, y: 1 }, frame: { width: 32, height: 128, count: 4 } },
  { id: 'machine.anchorGlow3', file: 'machine/era5/anchor-glow-3.png', width: 128, height: 128, origin: { x: 0.5, y: 1 }, frame: { width: 32, height: 128, count: 4 } },
  { id: 'machine.inversionGhost', file: 'machine/era5/inversion-ghost.png', width: 48, height: 48, origin: { x: 0.5, y: 0.5 }, rotation: { file: 'machine/era5/rot/inversion-ghost-rot.png', frames: 80 } },
  { id: 'machine.lensLight', file: 'machine/era5/lens-light.png', width: 128, height: 48, origin: { x: 0.5, y: 1 }, frame: { width: 32, height: 48, count: 4 } },
  { id: 'machine.lensColumn', file: 'machine/era5/lens-column.png', width: 32, height: 48, origin: { x: 0.5, y: 1 } },
  { id: 'machine.aperture', file: 'machine/era5/aperture.png', width: 384, height: 28, origin: { x: 0.5, y: 1 }, frame: { width: 64, height: 28, count: 6 } },
  { id: 'machine.namePlate', file: 'machine/era5/name-plate.png', width: 240, height: 11, origin: { x: 0.5, y: 1 }, frame: { width: 40, height: 11, count: 6 } },
  { id: 'bg.skyViolet', file: 'finale/sky-violet.png', width: 1280, height: 720, origin: { x: 0.5, y: 0.5 } },
  { id: 'bg.eclipse', file: 'finale/eclipse.png', width: 288, height: 48, origin: { x: 0.5, y: 0.5 }, frame: { width: 48, height: 48, count: 6 } },
  { id: 'bg.horizonGlow', file: 'finale/horizon-glow.png', width: 1280, height: 720, origin: { x: 0.5, y: 0.5 } },
  { id: 'fx.beam', file: 'fx/beam.png', width: 64, height: 32, origin: { x: 0.5, y: 1 }, frame: { width: 16, height: 32, count: 4 } },
];

describe('WP11 era V machine and fx assets', () => {
  it('appends the 30 era V ids after the era IV ids, in contract order (ids 68..97; WP13 ids follow)', () => {
    expect(ASSET_IDS.slice(68, 98)).toEqual(ERA5_ENTRIES.map((e) => e.id));
  });

  it('has the contract file, whole-image width and height, origin and tileable none for each new id', () => {
    for (const want of ERA5_ENTRIES) {
      const entry = ASSET_MANIFEST[want.id];
      expect(entry.file, want.id).toBe(want.file);
      expect(entry.width, want.id).toBe(want.width);
      expect(entry.height, want.id).toBe(want.height);
      expect(entry.origin, want.id).toEqual(want.origin);
      expect(entry.tileable, want.id).toBe('none');
      expect(entry.description.trim().length, want.id).toBeGreaterThan(0);
    }
  });

  it('has exactly the contract frame (or none) for each new id', () => {
    for (const want of ERA5_ENTRIES) {
      expect(ASSET_MANIFEST[want.id].frame, want.id).toEqual(want.frame);
    }
  });

  it('has exactly the contract rotation sheets (null core, inversion ghost) and no others among era V', () => {
    for (const want of ERA5_ENTRIES) {
      expect(ASSET_MANIFEST[want.id].rotation, want.id).toEqual(want.rotation);
    }
    const files = Object.keys(import.meta.glob('/public/assets/**/*.png'));
    expect(files).toContain('/public/assets/machine/era5/rot/null-core-rot.png');
    expect(files).toContain('/public/assets/machine/era5/rot/inversion-ghost-rot.png');
  });

  it('has a disk file for every era V entry and a unique png path per id', () => {
    const files = Object.keys(import.meta.glob('/public/assets/**/*.png'));
    for (const want of ERA5_ENTRIES) {
      expect(files, want.id).toContain(`/public/assets/${want.file}`);
    }
    const paths = ERA5_ENTRIES.map((e) => e.file);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('plans the era V sheet entries as spritesheets with their frame, and each null core / inversion ghost #rot right after its entry', () => {
    const loads = planAssetLoads();
    for (const want of ERA5_ENTRIES) {
      if (want.frame === undefined) continue;
      const load = loads.find((l) => l.key === want.id);
      expect(load?.kind, want.id).toBe('spritesheet');
      expect(load?.frame, want.id).toEqual(want.frame);
    }
    const keys = loads.map((l) => l.key);
    expect(keys[keys.indexOf('machine.nullCore#rot') - 1]).toBe('machine.nullCore');
    expect(keys[keys.indexOf('machine.inversionGhost#rot') - 1]).toBe('machine.inversionGhost');
    expect(loads.find((l) => l.key === 'machine.nullCore#rot')).toEqual({
      key: 'machine.nullCore#rot', url: 'assets/machine/era5/rot/null-core-rot.png', kind: 'spritesheet',
      frame: { width: 64, height: 64, count: 64 },
    });
    expect(loads.find((l) => l.key === 'machine.inversionGhost#rot')).toEqual({
      key: 'machine.inversionGhost#rot', url: 'assets/machine/era5/rot/inversion-ghost-rot.png', kind: 'spritesheet',
      frame: { width: 48, height: 48, count: 80 },
    });
  });

  it('cuts the siphon arcs 2 sheet into 4 cells of 128x64 at x 0, 128, 256, 384', () => {
    expect(sheetFrameRects(ASSET_MANIFEST['machine.siphonArcs2'])).toEqual([
      { x: 0, y: 0, width: 128, height: 64 },
      { x: 128, y: 0, width: 128, height: 64 },
      { x: 256, y: 0, width: 128, height: 64 },
      { x: 384, y: 0, width: 128, height: 64 },
    ]);
  });

  it('cuts the aperture into 6 cells of 64x28 at x 0..320 step 64', () => {
    const rects = sheetFrameRects(ASSET_MANIFEST['machine.aperture']);
    expect(rects.length).toBe(6);
    rects.forEach((r, i) => {
      expect(r).toEqual({ x: i * 64, y: 0, width: 64, height: 28 });
    });
  });

  it('cuts the name plate into 6 cells of 40x11 at x 0..200 step 40', () => {
    const rects = sheetFrameRects(ASSET_MANIFEST['machine.namePlate']);
    expect(rects.length).toBe(6);
    rects.forEach((r, i) => {
      expect(r).toEqual({ x: i * 40, y: 0, width: 40, height: 11 });
    });
  });

  it('cuts the eclipse into 6 cells of 48x48 at x 0..240 step 48', () => {
    const rects = sheetFrameRects(ASSET_MANIFEST['bg.eclipse']);
    expect(rects.length).toBe(6);
    rects.forEach((r, i) => {
      expect(r).toEqual({ x: i * 48, y: 0, width: 48, height: 48 });
    });
  });

  it('cuts the aperture beam into 4 cells of 16x32 at x 0, 16, 32, 48', () => {
    expect(sheetFrameRects(ASSET_MANIFEST['fx.beam'])).toEqual([
      { x: 0, y: 0, width: 16, height: 32 },
      { x: 16, y: 0, width: 16, height: 32 },
      { x: 32, y: 0, width: 16, height: 32 },
      { x: 48, y: 0, width: 16, height: 32 },
    ]);
  });
});

// WP13 restored world, finale fx and UI: file, whole-image size, origin, tiling and frame sheet per ART_ERA5 §11 / WP13 C3.
const WP13_ENTRIES: ReadonlyArray<{ id: AssetId; file: string; width: number; height: number; origin: { x: number; y: number };
  tileable: 'none' | 'x' | 'xy'; frame?: { width: number; height: number; count: number } }> = [
  { id: 'bg.skyRestored', file: 'finale/sky-restored.png', width: 1280, height: 720, origin: { x: 0.5, y: 0.5 }, tileable: 'none' },
  { id: 'bg.mountainsRestored', file: 'finale/mountains-restored.png', width: 512, height: 256, origin: { x: 0, y: 1 }, tileable: 'x' },
  { id: 'bg.skylineRestored', file: 'finale/skyline-restored.png', width: 512, height: 320, origin: { x: 0, y: 1 }, tileable: 'x' },
  { id: 'bg.regrowth1', file: 'finale/regrowth-1.png', width: 512, height: 32, origin: { x: 0, y: 1 }, tileable: 'x' },
  { id: 'bg.regrowth2', file: 'finale/regrowth-2.png', width: 512, height: 32, origin: { x: 0, y: 1 }, tileable: 'x' },
  { id: 'bg.regrowth3', file: 'finale/regrowth-3.png', width: 512, height: 32, origin: { x: 0, y: 1 }, tileable: 'x' },
  { id: 'terrain.groundGreen', file: 'terrain/ground-green.png', width: 256, height: 128, origin: { x: 0, y: 0 }, tileable: 'xy' },
  { id: 'fx.beamWhite', file: 'fx/beam-white.png', width: 64, height: 32, origin: { x: 0.5, y: 1 }, tileable: 'none', frame: { width: 16, height: 32, count: 4 } },
  { id: 'fx.seed', file: 'fx/seed.png', width: 32, height: 8, origin: { x: 0.5, y: 0.5 }, tileable: 'none', frame: { width: 8, height: 8, count: 4 } },
  { id: 'fx.bird', file: 'fx/bird.png', width: 16, height: 5, origin: { x: 0.5, y: 0.5 }, tileable: 'none', frame: { width: 8, height: 5, count: 2 } },
  { id: 'ui.nameplate', file: 'ui/nameplate.png', width: 136, height: 24, origin: { x: 0, y: 0 }, tileable: 'none' },
  { id: 'ui.panel', file: 'ui/panel.png', width: 24, height: 24, origin: { x: 0, y: 0 }, tileable: 'none' },
  { id: 'ui.button', file: 'ui/button.png', width: 72, height: 24, origin: { x: 0, y: 0 }, tileable: 'none', frame: { width: 24, height: 24, count: 3 } },
  { id: 'ui.icons16', file: 'ui/icons16.png', width: 80, height: 16, origin: { x: 0, y: 0 }, tileable: 'none', frame: { width: 16, height: 16, count: 5 } },
];

describe('WP13 restored world, finale fx and UI assets', () => {
  it('appends the 14 WP13 ids after the era V ids, in contract order (ids 98..111; WP17 ids follow)', () => {
    expect(ASSET_IDS.length).toBe(148);
    expect(ASSET_IDS.slice(98, 112)).toEqual(WP13_ENTRIES.map((e) => e.id));
    expect(ASSET_IDS.slice(112, 117)).toEqual(WP17_ENTRIES.map((e) => e.id));
  });

  it('has the contract file, whole-image size, origin and tiling for each new id', () => {
    for (const want of WP13_ENTRIES) {
      const entry = ASSET_MANIFEST[want.id];
      expect(entry.file, want.id).toBe(want.file);
      expect(entry.width, want.id).toBe(want.width);
      expect(entry.height, want.id).toBe(want.height);
      expect(entry.origin, want.id).toEqual(want.origin);
      expect(entry.tileable, want.id).toBe(want.tileable);
      expect(entry.description.trim().length, want.id).toBeGreaterThan(0);
    }
  });

  it('has exactly the contract frame (or none) for each new id', () => {
    for (const want of WP13_ENTRIES) {
      expect(ASSET_MANIFEST[want.id].frame, want.id).toEqual(want.frame);
    }
  });

  it('has a disk file for every WP13 entry and a unique png path per id', () => {
    const files = Object.keys(import.meta.glob('/public/assets/**/*.png'));
    for (const want of WP13_ENTRIES) {
      expect(files, want.id).toContain(`/public/assets/${want.file}`);
    }
    const paths = WP13_ENTRIES.map((e) => e.file);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('cuts every frame sheet into frame.count cells that tile the whole image exactly', () => {
    for (const want of WP13_ENTRIES) {
      const frame = want.frame;
      if (frame === undefined) continue;
      const rects = sheetFrameRects(ASSET_MANIFEST[want.id]);
      expect(rects.length, want.id).toBe(frame.count);
      expect(want.width % frame.width, want.id).toBe(0);
      expect(rects.every((r) => r.width === frame.width && r.height === frame.height), want.id).toBe(true);
    }
    expect(sheetFrameRects(ASSET_MANIFEST['ui.icons16']).map((r) => r.x)).toEqual([0, 16, 32, 48, 64]);
    expect(sheetFrameRects(ASSET_MANIFEST['fx.seed']).map((r) => r.x)).toEqual([0, 8, 16, 24]);
  });

  it('plans the WP13 sheets as spritesheets with their frame, and the others as images', () => {
    const loads = planAssetLoads();
    for (const want of WP13_ENTRIES) {
      const load = loads.find((l) => l.key === want.id);
      expect(load?.kind, want.id).toBe(want.frame === undefined ? 'image' : 'spritesheet');
      expect(load?.frame, want.id).toEqual(want.frame);
    }
  });
});

describe('WP10 era IV machine and fx assets', () => {
  const ERA4_ENTRIES: ReadonlyArray<{ id: AssetId; file: string; width: number; height: number; origin: { x: number; y: number } }> = [
    { id: 'machine.spireTower', file: 'machine/era4/spire-tower.png', width: 80, height: 320, origin: { x: 0.5, y: 1 } },
    { id: 'machine.spireExciter', file: 'machine/era4/spire-exciter.png', width: 24, height: 32, origin: { x: 0.5, y: 1 } },
    { id: 'machine.spireWave', file: 'machine/era4/spire-wave.png', width: 128, height: 270, origin: { x: 0.5, y: 1 } },
    { id: 'machine.coilRing1', file: 'machine/era4/coil-ring-1.png', width: 248, height: 8, origin: { x: 0.5, y: 0.5 } },
    { id: 'machine.coilRing2', file: 'machine/era4/coil-ring-2.png', width: 192, height: 8, origin: { x: 0.5, y: 0.5 } },
    { id: 'machine.coilRing3', file: 'machine/era4/coil-ring-3.png', width: 144, height: 8, origin: { x: 0.5, y: 0.5 } },
    { id: 'machine.coilRing4', file: 'machine/era4/coil-ring-4.png', width: 120, height: 8, origin: { x: 0.5, y: 0.5 } },
    { id: 'machine.calliope', file: 'machine/era4/calliope.png', width: 72, height: 40, origin: { x: 0.5, y: 1 } },
    { id: 'machine.servoBase', file: 'machine/era4/servo-base.png', width: 28, height: 20, origin: { x: 0.5, y: 1 } },
    { id: 'machine.servoArm', file: 'machine/era4/servo-arm.png', width: 48, height: 48, origin: { x: 0.5, y: 0.5 } },
    { id: 'machine.koenigFork', file: 'machine/era4/koenig-fork.png', width: 88, height: 44, origin: { x: 0.5, y: 1 } },
    { id: 'machine.emitterDish', file: 'machine/era4/emitter-dish.png', width: 40, height: 64, origin: { x: 0.5, y: 0.5 } },
    { id: 'machine.dishWaves', file: 'machine/era4/dish-waves.png', width: 240, height: 64, origin: { x: 0.5, y: 0.5 } },
    { id: 'machine.crystal', file: 'machine/era4/crystal.png', width: 128, height: 48, origin: { x: 0.5, y: 1 } },
  ];

  it('appends the 14 era IV ids after fx.smoke, in contract order (era V ids follow them)', () => {
    const start = ASSET_IDS.indexOf('fx.smoke') + 1;
    expect(ASSET_IDS.slice(start, start + 14)).toEqual(ERA4_ENTRIES.map((e) => e.id));
    expect(ASSET_IDS.slice(start + 14, start + 14 + 30)).toEqual(ERA5_ENTRIES.map((e) => e.id));
  });

  it('has the contract file, width, height, origin and tileable none for each new id', () => {
    for (const want of ERA4_ENTRIES) {
      const entry = ASSET_MANIFEST[want.id];
      expect(entry.file, want.id).toBe(want.file);
      expect(entry.width, want.id).toBe(want.width);
      expect(entry.height, want.id).toBe(want.height);
      expect(entry.origin, want.id).toEqual(want.origin);
      expect(entry.tileable, want.id).toBe('none');
      expect(entry.description.trim().length, want.id).toBeGreaterThan(0);
    }
  });

  it('has a frame only for the eight sheet entries, with the contract frame sizes and counts', () => {
    const SHEETS: ReadonlyArray<{ id: AssetId; frame: { width: number; height: number; count: number } }> = [
      { id: 'machine.spireWave', frame: { width: 16, height: 270, count: 8 } },
      { id: 'machine.coilRing1', frame: { width: 62, height: 8, count: 4 } },
      { id: 'machine.coilRing2', frame: { width: 48, height: 8, count: 4 } },
      { id: 'machine.coilRing3', frame: { width: 36, height: 8, count: 4 } },
      { id: 'machine.coilRing4', frame: { width: 30, height: 8, count: 4 } },
      { id: 'machine.koenigFork', frame: { width: 22, height: 44, count: 4 } },
      { id: 'machine.dishWaves', frame: { width: 40, height: 64, count: 6 } },
      { id: 'machine.crystal', frame: { width: 32, height: 48, count: 4 } },
    ];
    for (const want of SHEETS) {
      expect(ASSET_MANIFEST[want.id].frame, want.id).toEqual(want.frame);
    }
    for (const id of ['machine.spireTower', 'machine.spireExciter', 'machine.calliope', 'machine.servoBase', 'machine.servoArm', 'machine.emitterDish'] as const) {
      expect(ASSET_MANIFEST[id].frame, id).toBeUndefined();
    }
  });

  it('gives the servo arm a 432x432 rotation sheet of 80 frames under machine/era4/rot/', () => {
    expect(ASSET_MANIFEST['machine.servoArm'].rotation).toEqual({ file: 'machine/era4/rot/servo-arm-rot.png', frames: 80 });
    const files = Object.keys(import.meta.glob('/public/assets/**/*.png'));
    expect(files).toContain('/public/assets/machine/era4/rot/servo-arm-rot.png');
  });

  it('has a disk file for every era IV entry', () => {
    const files = Object.keys(import.meta.glob('/public/assets/**/*.png'));
    for (const want of ERA4_ENTRIES) {
      expect(files, want.id).toContain(`/public/assets/${want.file}`);
    }
  });

  it('plans the era IV sheet entries as spritesheets with their frame', () => {
    const loads = planAssetLoads();
    for (const id of ['machine.spireWave', 'machine.coilRing1', 'machine.coilRing4', 'machine.koenigFork', 'machine.dishWaves', 'machine.crystal'] as const) {
      const load = loads.find((l) => l.key === id);
      expect(load?.kind, id).toBe('spritesheet');
      expect(load?.frame, id).toEqual(ASSET_MANIFEST[id].frame);
    }
  });

  it('cuts the spire wave into 8 cells of 16x270 at x 0..112 step 16', () => {
    const rects = sheetFrameRects(ASSET_MANIFEST['machine.spireWave']);
    expect(rects.length).toBe(8);
    rects.forEach((r, i) => {
      expect(r).toEqual({ x: i * 16, y: 0, width: 16, height: 270 });
    });
  });

  it('cuts the crystal into 4 cells of 32x48 at x 0, 32, 64, 96', () => {
    expect(sheetFrameRects(ASSET_MANIFEST['machine.crystal'])).toEqual([
      { x: 0, y: 0, width: 32, height: 48 },
      { x: 32, y: 0, width: 32, height: 48 },
      { x: 64, y: 0, width: 32, height: 48 },
      { x: 96, y: 0, width: 32, height: 48 },
    ]);
  });

  it('cuts the first coil ring into 4 cells of 62x8 at x 0, 62, 124, 186', () => {
    expect(sheetFrameRects(ASSET_MANIFEST['machine.coilRing1'])).toEqual([
      { x: 0, y: 0, width: 62, height: 8 },
      { x: 62, y: 0, width: 62, height: 8 },
      { x: 124, y: 0, width: 62, height: 8 },
      { x: 186, y: 0, width: 62, height: 8 },
    ]);
  });
});

// WP17 legacy feed parts: A17 PixelLab-pass art under machine/legacy/ (procedural painters stay as the load-failure fallback).
const WP17_ENTRIES: ReadonlyArray<{ id: AssetId; file: string; width: number; height: number; origin: { x: number; y: number };
  frame?: { width: number; height: number; count: number } }> = [
  { id: 'machine.generatorGlow', file: 'machine/legacy/generator-glow.png', width: 384, height: 64, origin: { x: 0.5, y: 0.5 }, frame: { width: 96, height: 64, count: 4 } },
  { id: 'machine.bellows', file: 'machine/legacy/bellows.png', width: 240, height: 28, origin: { x: 0.5, y: 1 }, frame: { width: 60, height: 28, count: 4 } },
  { id: 'machine.exciterFeed', file: 'machine/legacy/exciter-feed.png', width: 16, height: 28, origin: { x: 0.5, y: 1 } },
  { id: 'machine.backfeedTerminal', file: 'machine/legacy/backfeed-terminal.png', width: 16, height: 28, origin: { x: 0.5, y: 0 } },
  { id: 'machine.steamLance', file: 'machine/legacy/steam-lance.png', width: 16, height: 32, origin: { x: 0.5, y: 0 } },
];

describe('WP17 legacy feed assets', () => {
  it('appends the 5 WP17 ids after the WP13 ids, in contract order (ids 112..116; the WP22 decal ids and the WP23a ids follow)', () => {
    expect(ASSET_IDS.length).toBe(148);
    expect(ASSET_IDS.slice(112, 117)).toEqual(WP17_ENTRIES.map((e) => e.id));
  });

  it('has the A17 file, the contract size and origin, tileable none and a description for each new id', () => {
    const files = Object.keys(import.meta.glob('/public/assets/**/*.png'));
    for (const want of WP17_ENTRIES) {
      const entry = ASSET_MANIFEST[want.id];
      expect(entry.file, want.id).toBe(want.file);
      expect(files, want.id).toContain(`/public/assets/${want.file}`);
      expect(entry.width, want.id).toBe(want.width);
      expect(entry.height, want.id).toBe(want.height);
      expect(entry.origin, want.id).toEqual(want.origin);
      expect(entry.tileable, want.id).toBe('none');
      expect(entry.description.trim().length, want.id).toBeGreaterThan(0);
    }
  });

  it('has exactly the contract frame (or none) for each new id', () => {
    for (const want of WP17_ENTRIES) {
      expect(ASSET_MANIFEST[want.id].frame, want.id).toEqual(want.frame);
    }
  });

  it('cuts the generator glow into 4 cells of 96x64 and the bellows into 4 cells of 60x28', () => {
    expect(sheetFrameRects(ASSET_MANIFEST['machine.generatorGlow'])).toEqual([
      { x: 0, y: 0, width: 96, height: 64 },
      { x: 96, y: 0, width: 96, height: 64 },
      { x: 192, y: 0, width: 96, height: 64 },
      { x: 288, y: 0, width: 96, height: 64 },
    ]);
    expect(sheetFrameRects(ASSET_MANIFEST['machine.bellows'])).toEqual([
      { x: 0, y: 0, width: 60, height: 28 },
      { x: 60, y: 0, width: 60, height: 28 },
      { x: 120, y: 0, width: 60, height: 28 },
      { x: 180, y: 0, width: 60, height: 28 },
    ]);
  });

  it('plans one load per WP17 id: spritesheets with their frame for the glow and the bellows, images for the rest', () => {
    const loads = planAssetLoads();
    for (const want of WP17_ENTRIES) {
      const load = loads.find((l) => l.key === want.id);
      expect(load?.url, want.id).toBe(`assets/${want.file}`);
      expect(load?.kind, want.id).toBe(want.frame ? 'spritesheet' : 'image');
      expect(load?.frame, want.id).toEqual(want.frame);
    }
  });
});

/** WP18b restored variants (A17 art under machine/era5/restored/): id, file, rotation sheet (if any) and the whole-image size, equal to the original's. */
const RESTORED_TABLE: ReadonlyArray<{ id: AssetId; file: string; rotationFile?: string; width: number; height: number }> = [
  { id: 'machine.nullChamber', file: 'machine/era5/restored/null-chamber.png', width: 128, height: 116 },
  { id: 'machine.nullCore', file: 'machine/era5/restored/null-core.png', rotationFile: 'machine/era5/restored/rot/null-core-rot.png', width: 64, height: 64 },
  { id: 'machine.nullCoreGlint', file: 'machine/era5/restored/null-core-glint.png', width: 64, height: 64 },
  { id: 'machine.ring1Back', file: 'machine/era5/restored/ring1-back.png', width: 112, height: 72 },
  { id: 'machine.ring2Back', file: 'machine/era5/restored/ring2-back.png', width: 112, height: 72 },
  { id: 'machine.ring3Back', file: 'machine/era5/restored/ring3-back.png', width: 112, height: 72 },
  { id: 'machine.ring4Back', file: 'machine/era5/restored/ring4-back.png', width: 112, height: 72 },
  { id: 'machine.ring1Front', file: 'machine/era5/restored/ring1-front.png', width: 112, height: 72 },
  { id: 'machine.ring2Front', file: 'machine/era5/restored/ring2-front.png', width: 112, height: 72 },
  { id: 'machine.ring3Front', file: 'machine/era5/restored/ring3-front.png', width: 112, height: 72 },
  { id: 'machine.ring4Front', file: 'machine/era5/restored/ring4-front.png', width: 112, height: 72 },
  { id: 'machine.ringBead', file: 'machine/era5/restored/ring-bead.png', width: 5, height: 5 },
  { id: 'machine.siphonTube', file: 'machine/era5/restored/siphon-tube.png', width: 12, height: 30 },
  { id: 'machine.siphonArcs1', file: 'machine/era5/restored/siphon-arcs-1.png', width: 512, height: 64 },
  { id: 'machine.siphonArcs2', file: 'machine/era5/restored/siphon-arcs-2.png', width: 512, height: 64 },
  { id: 'machine.siphonArcs3', file: 'machine/era5/restored/siphon-arcs-3.png', width: 512, height: 64 },
  { id: 'machine.anchorGlow1', file: 'machine/era5/restored/anchor-glow-1.png', width: 128, height: 128 },
  { id: 'machine.anchorGlow2', file: 'machine/era5/restored/anchor-glow-2.png', width: 128, height: 128 },
  { id: 'machine.anchorGlow3', file: 'machine/era5/restored/anchor-glow-3.png', width: 128, height: 128 },
  { id: 'machine.inversionGhost', file: 'machine/era5/restored/inversion-ghost.png', rotationFile: 'machine/era5/restored/rot/inversion-ghost-rot.png', width: 48, height: 48 },
  { id: 'machine.lensLight', file: 'machine/era5/restored/lens-light.png', width: 128, height: 48 },
  { id: 'machine.aperture', file: 'machine/era5/restored/aperture.png', width: 384, height: 28 },
];

const NODE_FS = 'node:fs';
/** Pixel size read from the IHDR chunk of a PNG under public/assets/ (node:fs is loaded through a variable so no Node types are needed). */
async function pngSize(file: string): Promise<{ width: number; height: number }> {
  const fs = (await import(/* @vite-ignore */ NODE_FS)) as { readFileSync(path: URL): Uint8Array };
  const buf = fs.readFileSync(new URL('../../public/assets/' + file, import.meta.url));
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return { width: dv.getUint32(16), height: dv.getUint32(20) }; // IHDR: width at byte 16, height at byte 20, big endian
}

describe('A17 restored variants (WP18b)', () => {
  it('gives exactly the 22 table ids a restored variant', () => {
    const ids = ASSET_IDS.filter((id) => ASSET_MANIFEST[id].restored !== undefined);
    expect(ids.length).toBe(22);
    expect(ids.slice().sort()).toEqual(RESTORED_TABLE.map((row) => row.id).sort());
  });

  it('names each variant file by the original file rule and gives rotationFile only to rotation entries', () => {
    for (const row of RESTORED_TABLE) {
      const entry = ASSET_MANIFEST[row.id];
      expect(entry.restored?.file, row.id).toBe(row.file);
      expect(entry.file?.replace('machine/era5/', 'machine/era5/restored/'), row.id).toBe(row.file);
      expect(entry.rotation === undefined, row.id).toBe(entry.restored?.rotationFile === undefined);
      expect(row.rotationFile === undefined, row.id).toBe(entry.rotation === undefined);
      if (entry.rotation !== undefined) {
        expect(entry.rotation.file.replace('machine/era5/rot/', 'machine/era5/restored/rot/'), row.id).toBe(entry.restored?.rotationFile);
        expect(row.rotationFile, row.id).toBe(entry.restored?.rotationFile);
      }
    }
  });

  it('has a disk PNG for every restored file and rotationFile (24 distinct)', () => {
    const files = Object.keys(import.meta.glob('/public/assets/**/*.png'));
    const used = new Set<string>();
    for (const row of RESTORED_TABLE) {
      const restored = ASSET_MANIFEST[row.id].restored;
      expect(restored, row.id).toBeDefined();
      if (restored === undefined) continue;
      for (const path of [restored.file, restored.rotationFile]) {
        if (path === undefined) continue;
        expect(files, path).toContain(`/public/assets/${path}`);
        used.add(path);
      }
    }
    expect(used.size).toBe(24);
  });

  it('keeps every restored PNG at the pixel size of its original', async () => {
    for (const row of RESTORED_TABLE) {
      const entry = ASSET_MANIFEST[row.id];
      const restored = entry.restored;
      expect(restored, row.id).toBeDefined();
      expect(entry.file, row.id).not.toBeNull();
      if (restored === undefined || entry.file === null) continue;
      expect(await pngSize(restored.file), row.id).toEqual(await pngSize(entry.file));
      expect(await pngSize(entry.file), row.id).toEqual({ width: row.width, height: row.height });
      expect({ width: entry.width, height: entry.height }, row.id).toEqual({ width: row.width, height: row.height });
      if (entry.rotation !== undefined && restored.rotationFile !== undefined) {
        expect(await pngSize(restored.rotationFile), row.id).toEqual(await pngSize(entry.rotation.file));
      }
    }
  });

  it('plans one #restored load per variant right after the original (or its #rot), with the original kind and frame', () => {
    const loads = planAssetLoads();
    const keys = loads.map((l) => l.key);
    for (const row of RESTORED_TABLE) {
      const entry = ASSET_MANIFEST[row.id];
      const key = restoredTextureKey(row.id, false);
      const load = loads.find((l) => l.key === key);
      expect(load, row.id).toEqual({
        key,
        url: 'assets/' + row.file,
        kind: entry.frame ? 'spritesheet' : 'image',
        frame: entry.frame,
      });
      if (entry.frame === undefined) expect('frame' in (load ?? {}), row.id).toBe(false);
      expect(keys.indexOf(key), row.id).toBe(keys.indexOf(entry.rotation ? row.id + ROT_SUFFIX : row.id) + 1);
    }
    const restoredLoads = loads.filter((l) => l.key.endsWith(RESTORED_SUFFIX));
    expect(restoredLoads.length).toBe(22);
    expect(restoredLoads.filter((l) => l.kind === 'spritesheet').length).toBe(8);
    expect(restoredLoads.filter((l) => l.kind === 'image').length).toBe(14);
  });

  it('plans #restored#rot loads for the null core and the inversion ghost right after their #restored load and 24 restored keys in total', () => {
    const loads = planAssetLoads();
    const keys = loads.map((l) => l.key);
    const cases: Array<{ id: AssetId; key: string; url: string; frame: { width: number; height: number; count: number } }> = [
      { id: 'machine.nullCore', key: 'machine.nullCore#restored#rot', url: 'assets/machine/era5/restored/rot/null-core-rot.png', frame: { width: 64, height: 64, count: 64 } },
      { id: 'machine.inversionGhost', key: 'machine.inversionGhost#restored#rot', url: 'assets/machine/era5/restored/rot/inversion-ghost-rot.png', frame: { width: 48, height: 48, count: 80 } },
    ];
    for (const want of cases) {
      expect(loads.find((l) => l.key === want.key), want.key).toEqual({ key: want.key, url: want.url, kind: 'spritesheet', frame: want.frame });
      expect(keys.indexOf(want.key), want.key).toBe(keys.indexOf(want.id + RESTORED_SUFFIX) + 1);
    }
    expect(keys.filter((k) => k.includes(RESTORED_SUFFIX)).length).toBe(24);
  });

  it('plans no restored load without a file and no #restored#rot without a rotation sheet', () => {
    const procedural = Object.fromEntries(
      ASSET_IDS.map((id) => [id, { ...withoutRotation(ASSET_MANIFEST[id]), file: null }]),
    ) as Record<AssetId, AssetEntry>;
    const custom1: Record<AssetId, AssetEntry> = {
      ...procedural,
      'machine.ringBead': { ...withoutRotation(ASSET_MANIFEST['machine.ringBead']), file: null, restored: { file: 'x/restored.png' } },
    };
    expect(planAssetLoads(custom1)).toEqual([]);
    const custom2: Record<AssetId, AssetEntry> = {
      ...procedural,
      'machine.ringBead': {
        ...withoutRotation(ASSET_MANIFEST['machine.ringBead']),
        file: 'machine/era5/ring-bead.png',
        restored: { file: 'machine/era5/restored/ring-bead.png', rotationFile: 'machine/era5/restored/rot/ring-bead-rot.png' },
      },
    };
    expect(planAssetLoads(custom2)).toEqual([
      { key: 'machine.ringBead', url: 'assets/machine/era5/ring-bead.png', kind: 'image' },
      { key: 'machine.ringBead#restored', url: 'assets/machine/era5/restored/ring-bead.png', kind: 'image' },
    ]);
  });

  it('names restored texture keys', () => {
    expect(restoredTextureKey('machine.nullCore', false)).toBe('machine.nullCore#restored');
    expect(restoredTextureKey('machine.nullCore', true)).toBe('machine.nullCore#restored#rot');
    expect(ROT_SUFFIX).toBe('#rot');
    expect(RESTORED_SUFFIX).toBe('#restored');
  });
});

describe('WP22 decal ids', () => {
  const DECALS: ReadonlyArray<{ id: AssetId; width: number; height: number }> = [
    { id: 'machine.gearRim', width: 64, height: 64 },
    { id: 'machine.flywheelRim2', width: 96, height: 96 },
    { id: 'machine.flywheelRim3', width: 96, height: 96 },
  ];

  it('appends the 3 decal ids at the tail of ASSET_IDS, in contract order (117 -> 120)', () => {
    expect(ASSET_IDS.slice(117, 120)).toEqual(['machine.gearRim', 'machine.flywheelRim2', 'machine.flywheelRim3']);
  });

  it('gives each decal its contract size, origin 0.5 / 0.5, tileable none and a description', () => {
    for (const want of DECALS) {
      const entry = ASSET_MANIFEST[want.id];
      expect(entry.width, want.id).toBe(want.width);
      expect(entry.height, want.id).toBe(want.height);
      expect(entry.origin, want.id).toEqual({ x: 0.5, y: 0.5 });
      expect(entry.tileable, want.id).toBe('none');
      expect(entry.description.trim().length, want.id).toBeGreaterThan(0);
    }
  });

  it('keeps each decal procedural (file null) or under machine/tiers/decals/', () => {
    for (const want of DECALS) {
      const file = ASSET_MANIFEST[want.id].file;
      expect(file === null || file.startsWith('machine/tiers/decals/'), want.id).toBe(true);
    }
  });
});

/** Copy of an entry without its rotation sheet, restored variant or tiers. */
function plainEntry(entry: AssetEntry): AssetEntry {
  const { rotation: _rotation, restored: _restored, tiers: _tiers, ...rest } = entry;
  return rest;
}

/** Every entry procedural and plain, then `overrides`: only the overridden entries plan loads. */
function tierFixture(overrides: Partial<Record<AssetId, AssetEntry>>): Record<AssetId, AssetEntry> {
  const base = Object.fromEntries(ASSET_IDS.map((id) => [id, { ...plainEntry(ASSET_MANIFEST[id]), file: null }])) as Record<AssetId, AssetEntry>;
  return { ...base, ...overrides } as Record<AssetId, AssetEntry>;
}

describe('part evolution tiers (WP22)', () => {
  it('names the three tier texture forms and throws for rot together with pulse', () => {
    expect(TIER_SUFFIX).toBe('#t');
    expect(tierTextureKey('machine.motor', 5)).toBe('machine.motor#t5');
    expect(tierTextureKey('machine.motor', 5, { pulse: true })).toBe('machine.motor#t5b');
    expect(tierTextureKey('machine.gearSmall', 2, { rot: true })).toBe('machine.gearSmall#t2#rot');
    expect(() => tierTextureKey('machine.motor', 5, { rot: true, pulse: true })).toThrow(RangeError);
  });

  it('plans a static entry with sparse tiers as own, #t2, #t5, #t5b, all images without a frame', () => {
    const motor: AssetEntry = {
      ...plainEntry(ASSET_MANIFEST['machine.motor']),
      file: 'machine/worn-motor.png',
      tiers: [
        { from: 2, file: 'machine/tiers/motor-t2.png' },
        { from: 5, file: 'machine/tiers/motor-t5.png', pulseFile: 'machine/tiers/motor-t5b.png' },
      ],
    };
    const loads = planAssetLoads(tierFixture({ 'machine.motor': motor }));
    expect(loads).toEqual([
      { key: 'machine.motor', url: 'assets/machine/worn-motor.png', kind: 'image' },
      { key: 'machine.motor#t2', url: 'assets/machine/tiers/motor-t2.png', kind: 'image' },
      { key: 'machine.motor#t5', url: 'assets/machine/tiers/motor-t5.png', kind: 'image' },
      { key: 'machine.motor#t5b', url: 'assets/machine/tiers/motor-t5b.png', kind: 'image' },
    ]);
    expect(loads.slice(1).every((l) => !('frame' in l))).toBe(true);
  });

  it('keeps the spritesheet kind and the entry frame on the #tN and #tNb loads', () => {
    const bellows: AssetEntry = {
      ...ASSET_MANIFEST['machine.bellows'],
      tiers: [
        { from: 2, file: 'machine/tiers/bellows-t2.png' },
        { from: 5, file: 'machine/tiers/bellows-t5.png', pulseFile: 'machine/tiers/bellows-t5b.png' },
      ],
    };
    const frame = { width: 60, height: 28, count: 4 };
    const loads = planAssetLoads(tierFixture({ 'machine.bellows': bellows }));
    expect(loads).toEqual([
      { key: 'machine.bellows', url: 'assets/machine/legacy/bellows.png', kind: 'spritesheet', frame },
      { key: 'machine.bellows#t2', url: 'assets/machine/tiers/bellows-t2.png', kind: 'spritesheet', frame },
      { key: 'machine.bellows#t5', url: 'assets/machine/tiers/bellows-t5.png', kind: 'spritesheet', frame },
      { key: 'machine.bellows#t5b', url: 'assets/machine/tiers/bellows-t5b.png', kind: 'spritesheet', frame },
    ]);
  });

  it('plans a rotation entry as own, #rot, #t2, #t2#rot, with the entry frame size and the rotation frame count', () => {
    const gear: AssetEntry = {
      ...ASSET_MANIFEST['machine.gearSmall'],
      tiers: [{ from: 2, file: 'machine/tiers/gear-small-t2.png', rotationFile: 'machine/tiers/rot/gear-small-t2-rot.png' }],
    };
    const frame = { width: 40, height: 40, count: 80 };
    expect(planAssetLoads(tierFixture({ 'machine.gearSmall': gear }))).toEqual([
      { key: 'machine.gearSmall', url: 'assets/machine/gear-small.png', kind: 'image' },
      { key: 'machine.gearSmall#rot', url: 'assets/machine/rot/gear-small-rot.png', kind: 'spritesheet', frame },
      { key: 'machine.gearSmall#t2', url: 'assets/machine/tiers/gear-small-t2.png', kind: 'image' },
      { key: 'machine.gearSmall#t2#rot', url: 'assets/machine/tiers/rot/gear-small-t2-rot.png', kind: 'spritesheet', frame },
    ]);
  });

  it('plans no tier loads for a procedural entry, even when it declares tiers', () => {
    const rim: AssetEntry = { ...ASSET_MANIFEST['machine.gearRim'], file: null, tiers: [{ from: 3, file: 'machine/tiers/decals/gear-rim-t3.png' }] };
    expect(planAssetLoads(tierFixture({ 'machine.gearRim': rim }))).toEqual([]);
  });

  it('leaves an entry without tiers unchanged', () => {
    const motor: AssetEntry = { ...plainEntry(ASSET_MANIFEST['machine.motor']), file: 'machine/worn-motor.png' };
    expect(planAssetLoads(tierFixture({ 'machine.motor': motor }))).toEqual([
      { key: 'machine.motor', url: 'assets/machine/worn-motor.png', kind: 'image' },
    ]);
  });

  it('gives no real entry both tiers and restored (vacuous until tier art is wired)', () => {
    const both = ASSET_IDS.filter((id) => ASSET_MANIFEST[id].tiers !== undefined && ASSET_MANIFEST[id].restored !== undefined);
    expect(both).toEqual([]);
  });

  it('keeps every tier from as an integer in 2..5, strictly ascending', () => {
    for (const id of ASSET_IDS) {
      const froms = (ASSET_MANIFEST[id].tiers ?? []).map((t) => t.from);
      for (const from of froms) expect(Number.isInteger(from) && from >= 2 && from <= 5, id).toBe(true);
      expect(froms, id).toEqual([...froms].sort((a, b) => a - b));
      expect(new Set(froms).size, id).toBe(froms.length);
    }
  });

  it('gives rotationFile exactly to the tiers of rotation entries, and no pulseFile on a rotation entry', () => {
    for (const id of ASSET_IDS) {
      const entry = ASSET_MANIFEST[id];
      for (const tier of entry.tiers ?? []) {
        expect(tier.rotationFile !== undefined, id).toBe(entry.rotation !== undefined);
        if (entry.rotation !== undefined) expect(tier.pulseFile, id).toBeUndefined();
      }
    }
  });

  it('names every tier file under machine/tiers/ and has a disk PNG for it', () => {
    const files = Object.keys(import.meta.glob('/public/assets/**/*.png'));
    for (const id of ASSET_IDS) {
      for (const tier of ASSET_MANIFEST[id].tiers ?? []) {
        for (const path of [tier.file, tier.rotationFile, tier.pulseFile]) {
          if (path === undefined) continue;
          expect(path.startsWith('machine/tiers/'), path).toBe(true);
          expect(files, path).toContain(`/public/assets/${path}`);
        }
      }
    }
  });

  it('keeps every tier PNG at the pixel size of its entry (a rotationFile at the size of entry.rotation.file)', async () => {
    for (const id of ASSET_IDS) {
      const entry = ASSET_MANIFEST[id];
      for (const tier of entry.tiers ?? []) {
        const size = { width: entry.width, height: entry.height };
        expect(await pngSize(tier.file), id).toEqual(size);
        if (tier.pulseFile !== undefined) expect(await pngSize(tier.pulseFile), id).toEqual(size);
        if (tier.rotationFile !== undefined && entry.rotation !== undefined) {
          expect(await pngSize(tier.rotationFile), id).toEqual(await pngSize(entry.rotation.file));
        }
      }
    }
  });
});

/** WP23a living-world assets (DENIZEN_ART 5.1): id, size, origin, tileable, frame and era rows. file is null until the Art Director delivers the PNGs. */
const WP23A_ENTRIES: ReadonlyArray<{ id: AssetId; width: number; height: number; origin: { x: number; y: number };
  tileable: 'none' | 'x' | 'xy'; frame?: { width: number; height: number; count: number }; eraRows?: number }> = [
  { id: 'world.inspector', width: 440, height: 240, origin: { x: 0.5, y: 1 }, tileable: 'none', frame: { width: 20, height: 40, count: 132 }, eraRows: 6 },
  { id: 'world.clipboardPages', width: 18, height: 3, origin: { x: 0.5, y: 1 }, tileable: 'none', frame: { width: 6, height: 3, count: 3 } },
  { id: 'world.dog', width: 644, height: 120, origin: { x: 0.5, y: 1 }, tileable: 'none', frame: { width: 28, height: 20, count: 138 }, eraRows: 6 },
  { id: 'world.stakeChain', width: 20, height: 6, origin: { x: 0.5, y: 1 }, tileable: 'none', frame: { width: 10, height: 6, count: 2 } },
  { id: 'world.hole', width: 64, height: 6, origin: { x: 0.5, y: 1 }, tileable: 'none', frame: { width: 16, height: 6, count: 4 } },
  { id: 'world.redBall', width: 3, height: 3, origin: { x: 0.5, y: 1 }, tileable: 'none' },
  { id: 'world.crow', width: 360, height: 108, origin: { x: 0.5, y: 1 }, tileable: 'none', frame: { width: 24, height: 18, count: 90 }, eraRows: 6 },
  { id: 'world.girl', width: 192, height: 168, origin: { x: 0.5, y: 1 }, tileable: 'none', frame: { width: 16, height: 28, count: 72 }, eraRows: 6 },
  { id: 'world.girlMini', width: 24, height: 12, origin: { x: 0.5, y: 1 }, tileable: 'none', frame: { width: 8, height: 12, count: 3 } },
  { id: 'world.girlWindow', width: 16, height: 6, origin: { x: 0, y: 0 }, tileable: 'none', frame: { width: 4, height: 6, count: 4 } },
  { id: 'world.lantern', width: 12, height: 4, origin: { x: 0.5, y: 1 }, tileable: 'none', frame: { width: 6, height: 4, count: 2 } },
  { id: 'world.payphone', width: 168, height: 312, origin: { x: 0.5, y: 1 }, tileable: 'none', frame: { width: 28, height: 52, count: 36 }, eraRows: 6 },
  { id: 'world.receiver', width: 48, height: 72, origin: { x: 0.5, y: 0 }, tileable: 'none', frame: { width: 8, height: 12, count: 36 }, eraRows: 6 },
  { id: 'world.lamp', width: 48, height: 60, origin: { x: 0.5, y: 1 }, tileable: 'none', frame: { width: 12, height: 60, count: 4 } },
  { id: 'world.lampGlow', width: 64, height: 16, origin: { x: 0.5, y: 0.5 }, tileable: 'none', frame: { width: 32, height: 16, count: 2 } },
  { id: 'world.clock', width: 32, height: 44, origin: { x: 0.5, y: 1 }, tileable: 'none', frame: { width: 16, height: 44, count: 2 } },
  { id: 'world.sensor7', width: 160, height: 240, origin: { x: 0.5, y: 1 }, tileable: 'none', frame: { width: 20, height: 40, count: 48 }, eraRows: 6 },
  { id: 'world.puddle', width: 320, height: 5, origin: { x: 0.5, y: 1 }, tileable: 'none', frame: { width: 32, height: 5, count: 10 } },
  { id: 'world.sprout', width: 40, height: 24, origin: { x: 0.5, y: 1 }, tileable: 'none', frame: { width: 8, height: 24, count: 5 } },
  { id: 'world.scraps', width: 24, height: 4, origin: { x: 0.5, y: 1 }, tileable: 'none', frame: { width: 8, height: 4, count: 3 } },
  { id: 'world.mote', width: 4, height: 2, origin: { x: 0.5, y: 0.5 }, tileable: 'none', frame: { width: 2, height: 2, count: 2 } },
  { id: 'world.page', width: 6, height: 4, origin: { x: 0.5, y: 0.5 }, tileable: 'none', frame: { width: 3, height: 4, count: 2 } },
  { id: 'world.shadow', width: 26, height: 3, origin: { x: 0.5, y: 0.5 }, tileable: 'none' },
  { id: 'bg.windowLit', width: 8, height: 6, origin: { x: 0, y: 0 }, tileable: 'none', frame: { width: 4, height: 6, count: 2 } },
  { id: 'bg.virga', width: 512, height: 128, origin: { x: 0, y: 1 }, tileable: 'x', frame: { width: 512, height: 64, count: 2 } },
];

describe('WP23a world assets', () => {
  it('appends the 25 WP23a ids after the WP22 decal ids, in contract order (ids 120..144; the WP27 fx.fault id 145 follows)', () => {
    expect(ASSET_IDS.length).toBe(148);
    expect(ASSET_IDS.slice(120, 145)).toEqual(WP23A_ENTRIES.map((e) => e.id));
  });

  it('has the contract size, origin, tileable, frame and era rows for each id', () => {
    for (const want of WP23A_ENTRIES) {
      const entry = ASSET_MANIFEST[want.id];
      expect(entry.width, want.id).toBe(want.width);
      expect(entry.height, want.id).toBe(want.height);
      expect(entry.origin, want.id).toEqual(want.origin);
      expect(entry.tileable, want.id).toBe(want.tileable);
      expect(entry.frame, want.id).toEqual(want.frame);
      expect(entry.eraRows, want.id).toBe(want.eraRows);
      expect(entry.description.trim().length, want.id).toBeGreaterThan(0);
    }
  });

  it('file is null only for the procedural shadow', () => {
    // WP23b AD3c wired the last four sheets (puddle, sprout, page, virga); world.shadow stays procedural forever.
    const FILE_NULL = new Set<AssetId>(['world.shadow']);
    for (const want of WP23A_ENTRIES) {
      const file = ASSET_MANIFEST[want.id].file;
      if (FILE_NULL.has(want.id)) expect(file, want.id).toBeNull();
      else expect(file, want.id).toMatch(/^(world|bg)\/[a-z0-9-]+\.png$/);
    }
    expect(WP23A_ENTRIES.filter((w) => ASSET_MANIFEST[w.id].file !== null).length).toBe(24);
  });

  it('keeps the era-row arithmetic: height = frame.height * eraRows and frame.count = columns * eraRows', () => {
    for (const want of WP23A_ENTRIES) {
      if (want.eraRows === undefined) continue;
      const entry = ASSET_MANIFEST[want.id];
      const frame = entry.frame;
      expect(frame, want.id).toBeDefined();
      if (frame === undefined) continue;
      expect(entry.height, want.id).toBe(frame.height * want.eraRows);
      expect(frame.count, want.id).toBe((entry.width / frame.width) * want.eraRows);
    }
  });

  it('cuts every WP23a sheet into frame.count cells, all inside the sheet', () => {
    for (const want of WP23A_ENTRIES) {
      const entry = ASSET_MANIFEST[want.id];
      const cells = sheetFrameRects(entry);
      expect(cells.length, want.id).toBe(entry.frame?.count ?? 0);
      for (const cell of cells) {
        expect(cell.x + cell.width, want.id).toBeLessThanOrEqual(entry.width);
        expect(cell.y + cell.height, want.id).toBeLessThanOrEqual(entry.height);
      }
    }
  });
});

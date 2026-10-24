import { describe, it, expect } from 'vitest';
import { ASSET_MANIFEST } from '../../assets/manifest';
import { MACHINE_COMPONENT_IDS, MACHINE_COMPONENTS } from '../../data/machineComponents';
import type { MachineComponentId } from '../../data/machineComponents';
import { frameIndexOfName, isRestoredKey, restoredComponentIds, swapTextureKey } from './restoredTextures';

/** The 34 era V parts with a restored (postgame) variant, in MACHINE_COMPONENT_IDS order. */
const RESTORED_IDS: MachineComponentId[] = [
  'nullChamber', 'nullCore', 'nullCoreGlint', 'ring1Back', 'ring2Back', 'ring3Back', 'ring4Back',
  'ring1Front', 'ring2Front', 'ring3Front', 'ring4Front', 'ring1Bead', 'ring2Bead', 'ring3Bead', 'ring4Bead',
  'siphonTube1L', 'siphonTube1R', 'siphonTube2L', 'siphonTube2R', 'siphonTube3L', 'siphonTube3R',
  'siphonArcs1', 'siphonArcs2', 'siphonArcs3', 'anchorGlow1L', 'anchorGlow1R', 'anchorGlow2L', 'anchorGlow2R',
  'anchorGlow3L', 'anchorGlow3R', 'inversionGhost', 'lensLight', 'aperture', 'ring1Bead2',
];

describe('restoredComponentIds', () => {
  it('is exactly the 34 restored parts in MACHINE_COMPONENT_IDS order', () => {
    expect(restoredComponentIds()).toEqual(RESTORED_IDS);
    expect(restoredComponentIds()).toHaveLength(34);
  });

  it('is frozen and cached (same reference on repeat)', () => {
    expect(Object.isFrozen(restoredComponentIds())).toBe(true);
    expect(restoredComponentIds()).toBe(restoredComponentIds());
  });

  it('matches the manifest: a part has a restored asset exactly when it is in the list', () => {
    const restored = new Set<string>(RESTORED_IDS);
    for (const id of MACHINE_COMPONENT_IDS) {
      const entry = ASSET_MANIFEST[MACHINE_COMPONENTS[id].assetId];
      expect(entry.restored !== undefined, id).toBe(restored.has(id));
    }
  });
});

describe('swapTextureKey', () => {
  const all = (): boolean => true;

  it('rotation sheet: base rot key swaps to the restored rot key and back', () => {
    expect(swapTextureKey('machine.nullCore', 'machine.nullCore#rot', true, all)).toBe('machine.nullCore#restored#rot');
    expect(swapTextureKey('machine.nullCore', 'machine.nullCore#restored#rot', false, all)).toBe('machine.nullCore#rot');
  });

  it('plain key: base swaps to the restored key and back', () => {
    expect(swapTextureKey('machine.nullCore', 'machine.nullCore', true, all)).toBe('machine.nullCore#restored');
    expect(swapTextureKey('machine.ringBead', 'machine.ringBead', true, all)).toBe('machine.ringBead#restored');
    expect(swapTextureKey('machine.ringBead', 'machine.ringBead#restored', false, all)).toBe('machine.ringBead');
  });

  it('is idempotent when the key already matches the requested state', () => {
    expect(swapTextureKey('machine.nullCore', 'machine.nullCore#restored#rot', true, all)).toBe('machine.nullCore#restored#rot');
    expect(swapTextureKey('machine.ringBead', 'machine.ringBead#restored', true, all)).toBe('machine.ringBead#restored');
  });

  it('falls back to the current key when the restored variant is not loaded', () => {
    const noRestored = (key: string): boolean => !key.includes('#restored');
    expect(swapTextureKey('machine.aperture', 'machine.aperture', true, noRestored)).toBe('machine.aperture');
  });

  it('returns the current key for an asset without a restored variant', () => {
    expect(swapTextureKey('machine.crystal', 'machine.crystal', true, all)).toBe('machine.crystal');
  });
});

describe('isRestoredKey', () => {
  it('is true for restored keys, false for base and rot keys', () => {
    expect(isRestoredKey('machine.ringBead#restored')).toBe(true);
    expect(isRestoredKey('machine.nullCore#restored#rot')).toBe(true);
    expect(isRestoredKey('machine.ringBead')).toBe(false);
    expect(isRestoredKey('machine.nullCore#rot')).toBe(false);
    expect(isRestoredKey('')).toBe(false);
  });
});

describe('frameIndexOfName', () => {
  it('returns integer names >= 0 as the frame index', () => {
    expect(frameIndexOfName(0)).toBe(0);
    expect(frameIndexOfName(3)).toBe(3);
    expect(frameIndexOfName('5')).toBe(5);
  });

  it('returns 0 for names that are not an integer >= 0', () => {
    expect(frameIndexOfName('__BASE')).toBe(0);
    expect(frameIndexOfName('-1')).toBe(0);
    expect(frameIndexOfName('1.5')).toBe(0);
    expect(frameIndexOfName('')).toBe(0);
  });
});

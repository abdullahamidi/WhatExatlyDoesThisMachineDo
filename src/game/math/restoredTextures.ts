import type { AssetId } from '../../assets/assetIds';
import { ASSET_MANIFEST, RESTORED_SUFFIX, ROT_SUFFIX, restoredTextureKey } from '../../assets/manifest';
import { MACHINE_COMPONENTS, MACHINE_COMPONENT_IDS } from '../../data/machineComponents';
import type { MachineComponentId } from '../../data/machineComponents';
import { resolveTextureKey } from './partTiers';

// WP18b restored textures: pure key maths for the postgame swap of era V parts to their `#restored` variants (A17 art).
// MachineAnimator picks the texture key with swapTextureKey; the Phaser texture check is passed in as `has`. Pure: no Phaser, no DOM.

let cached: readonly MachineComponentId[] | null = null;

/** Components whose asset has `restored`, MACHINE_COMPONENT_IDS order; computed once, Object.freeze'd, same reference every call. */
export function restoredComponentIds(): readonly MachineComponentId[] {
  if (cached === null) {
    cached = Object.freeze(MACHINE_COMPONENT_IDS.filter((id) => ASSET_MANIFEST[MACHINE_COMPONENTS[id].assetId].restored !== undefined));
  }
  return cached;
}

/** True when the texture key is a restored variant (`${id}#restored` or `${id}#restored#rot`). */
export function isRestoredKey(key: string): boolean {
  return key.includes(RESTORED_SUFFIX);
}

/**
 * Texture key for the requested state. rot = currentKey ends with `#rot`, so the rotation sheet is kept.
 * Target: restored ? `${assetId}#restored[#rot]` : `${assetId}[#rot]`. Returns currentKey when the asset has no
 * `restored` variant or the target key is not loaded (has false), so a missing variant falls back to the base art.
 */
export function swapTextureKey(assetId: AssetId, currentKey: string, restored: boolean, has: (key: string) => boolean): string {
  if (ASSET_MANIFEST[assetId].restored === undefined) return currentKey;
  const rot = currentKey.endsWith(ROT_SUFFIX);
  const target = resolveTextureKey(assetId, { tier: 1, restored, rot, pulseLow: false }, has);
  const requested = restored ? restoredTextureKey(assetId, rot) : target;
  return has(requested) ? target : currentKey;
}

/** Number(name) when it is an integer >= 0, else 0 ('__BASE', '', '-1', '1.5' -> 0). */
export function frameIndexOfName(name: string | number): number {
  const n = typeof name === 'number' ? name : Number(name);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

// Save remap for the WP28 pacing set (C3): split-track levels move to the new scale on load.
// Why: a v0.11.0 track was cut into `parts` smaller steps, so an old level k is the same power and spend as new level k x parts.
// Pure: no Phaser, no persistence imports. Never mutates its input; the envelope marker is `econ` (ECON_REVISION).
import { ECON_REVISION, SPLIT_PARTS } from '../data/pacing';

/**
 * True unless the envelope carries a number `econ` at or above ECON_REVISION. A save without the marker
 * (v0.11.0, or any older save) holds its split-track levels on the old scale.
 */
export function needsEconRemap(envelope: Readonly<Record<string, unknown>>): boolean {
  return !(typeof envelope['econ'] === 'number' && envelope['econ'] >= ECON_REVISION);
}

/**
 * A new object: every SPLIT_PARTS id whose value is a finite number v becomes v x parts. Everything else
 * (other ids, unknown ids, non-number values) is copied as is. A product that overflows to a non-finite
 * number keeps v, so the normal reader clamps it to the track maximum instead of rejecting the save.
 */
export function remapSplitLevels(raw: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };
  for (const [id, parts] of Object.entries(SPLIT_PARTS)) {
    const value = raw[id];
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    const scaled = value * parts;
    if (Number.isFinite(scaled)) out[id] = scaled;
  }
  return out;
}

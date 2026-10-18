import { REVEALED } from '../data/finale';
import { RESOURCES } from '../data/resources';
import type { ResourceId } from '../data/types';

// Reveal flag for the Restoration Flux label (WP13 D4). Pure module state, like setDefaultNotation.
// Off until the ending is reached: every label then reads exactly as before (xf = '???').

let revealed = false;

/** Turns the Restoration Flux label reveal on or off. Bootstrap calls it at boot and on ending/reset events. */
export function setRevealed(b: boolean): void {
  revealed = b;
}

/** True when the xf label reads as `RF`. */
export function isRevealedLabel(): boolean {
  return revealed;
}

/** Short label of a resource: `RF` for xf once revealed, otherwise RESOURCES[id].short. */
export function resourceShort(id: ResourceId): string {
  if (id === 'xf' && revealed) return REVEALED.xf.short;
  return RESOURCES[id].short;
}

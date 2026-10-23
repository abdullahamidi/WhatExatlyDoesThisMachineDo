import type { TechId } from './types';

// Era keystones (WP17). Pure data: the unlock converter that opens each era (era II..V). The current era is the
// highest keystone owned (simulation/progression/era.ts). Keystone era and convert resource must match RESOURCES.

/** Era number, 1..5 (era I = Mechanical, era V = Unknown Flux). */
export type EraNumber = 1 | 2 | 3 | 4 | 5;

/** Keystone tech per era II..V, in era order. */
export const ERA_KEYSTONES: readonly { readonly techId: TechId; readonly era: 2 | 3 | 4 | 5 }[] =
  [{ techId: 'generator', era: 2 }, { techId: 'boiler', era: 3 }, { techId: 'resonatorSpire', era: 4 }, { techId: 'nullChamber', era: 5 }];

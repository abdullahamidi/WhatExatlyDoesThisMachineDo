import { RESOURCE_IDS } from '../../data/types';
import type { ResourceId, TechId } from '../../data/types';
import { RESOURCES } from '../../data/resources';
import { ERA_KEYSTONES } from '../../data/eras';
import type { EraNumber } from '../../data/eras';

// Era progression (WP17). Pure: a function of the owned tech levels and the static keystone and resource tables.

/** A level counts as owned when it is finite and >= 1 (NaN and infinities count as not owned). */
function isOwned(level: number): boolean {
  return Number.isFinite(level) && level >= 1;
}

/** Highest era whose keystone tech is owned; era I when no keystone is owned. */
export function currentEra(techLevels: Readonly<Record<TechId, number>>): EraNumber {
  let era: EraNumber = 1;
  for (const keystone of ERA_KEYSTONES) {
    if (isOwned(techLevels[keystone.techId]) && keystone.era > era) era = keystone.era;
  }
  return era;
}

/** The resource whose era is `era` (me, ee, pr, rs, xf). Every era has exactly one resource, so the fallback never applies. */
export function eraResource(era: EraNumber): ResourceId {
  return RESOURCE_IDS.find((id) => RESOURCES[id].era === era) ?? 'me';
}

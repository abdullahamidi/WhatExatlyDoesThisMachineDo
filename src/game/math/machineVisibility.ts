import { MACHINE_COMPONENT_IDS, MACHINE_COMPONENTS } from '../../data/machineComponents';
import type { MachineComponentId } from '../../data/machineComponents';
import type { TechId } from '../../data/types';
import { isComponentVisible } from './machineLayout';

/** Ids of every machine component whose unlock level is reached: set of { id | techLevels[techId] >= minLevel }. */
export function visibleComponentIds(techLevels: Readonly<Record<TechId, number>>): Set<MachineComponentId> {
  const visible = new Set<MachineComponentId>();
  for (const id of MACHINE_COMPONENT_IDS) {
    if (isComponentVisible(MACHINE_COMPONENTS[id], techLevels)) visible.add(id); // keep canonical order
  }
  return visible;
}

/** Ids present in next but not in prev, in MACHINE_COMPONENT_IDS order: next \ prev. */
export function newlyVisible(prev: ReadonlySet<MachineComponentId>, next: ReadonlySet<MachineComponentId>): MachineComponentId[] {
  return MACHINE_COMPONENT_IDS.filter((id) => next.has(id) && !prev.has(id)); // next AND NOT prev
}

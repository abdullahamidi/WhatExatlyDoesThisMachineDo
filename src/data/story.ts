import type { TechId } from './types';
import { REVEALED } from './finale';

// Machine plaque lines (WP8). Pure data: the last owned line is shown.
// milestone null = always owned. Otherwise the line is owned once that milestone is reached.
export interface PlaqueLine {
  milestone: TechId | null;
  text: string;
}

export const PLAQUE_LINES: readonly PlaqueLine[] = [
  { milestone: null, text: 'PRIMARY FUNCTION: UNKNOWN' },
  { milestone: 'generatorBlueprint', text: 'PRIMARY FUNCTION: R?S????' },
  { milestone: 'substationBlueprint', text: 'PRIMARY FUNCTION: RES?OR?' },
  { milestone: 'pressureVesselBlueprint', text: 'PRIMARY FUNCTION: REST?RE' },
  { milestone: 'harmonicConvergence', text: 'PRIMARY FUNCTION: RESTORE (TARGET: ?)' },
  { milestone: 'primaryFunction', text: REVEALED.plaque },
];

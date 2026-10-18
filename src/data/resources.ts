import { RESOURCE_IDS } from './types';
import type { ResourceDefinition, ResourceId } from './types';

// Resource table (roadmap §1/§3). Pure data. Chain: me <- ee <- pr <- rs <- xf.
// convExp: exponent on the source per-second rate in `convert` effects (me's is unused).

export const RESOURCES: Record<ResourceId, ResourceDefinition> = {
  me: { id: 'me', name: 'Mechanical Energy', short: 'ME', era: 1, source: null, convExp: 1 },
  ee: { id: 'ee', name: 'Electrical Energy', short: 'EE', era: 2, source: 'me', convExp: 0.5 },
  pr: { id: 'pr', name: 'Pressure', short: 'PR', era: 3, source: 'ee', convExp: 0.5 },
  rs: { id: 'rs', name: 'Resonance', short: 'RS', era: 4, source: 'pr', convExp: 0.5 },
  xf: { id: 'xf', name: 'Unknown Flux', short: '???', era: 5, source: 'rs', convExp: 0.5 },
};

export const RESOURCE_LIST: ResourceDefinition[] = RESOURCE_IDS.map((id) => RESOURCES[id]);

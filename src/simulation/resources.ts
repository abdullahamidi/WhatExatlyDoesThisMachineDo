import { RESOURCE_IDS } from '../data/types';
import type { ResourceMap } from '../data/types';

// Pure helpers over per-resource maps. Always return fresh objects; never mutate inputs.

export function emptyResourceMap(): ResourceMap {
  return { me: 0, ee: 0, pr: 0, rs: 0, xf: 0 };
}

export function addMaps(a: Readonly<ResourceMap>, b: Readonly<ResourceMap>): ResourceMap {
  const out = emptyResourceMap();
  for (const id of RESOURCE_IDS) {
    out[id] = a[id] + b[id];
  }
  return out;
}

export function scaleMap(m: Readonly<ResourceMap>, k: number): ResourceMap {
  const out = emptyResourceMap();
  for (const id of RESOURCE_IDS) {
    out[id] = m[id] * k + 0;
  }
  return out;
}

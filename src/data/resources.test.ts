import { describe, it, expect } from 'vitest';
import { RESOURCE_IDS } from './types';
import { RESOURCES, RESOURCE_LIST } from './resources';

describe('resource table', () => {
  it('RESOURCE_IDS is the fixed five-resource order', () => {
    expect(RESOURCE_IDS).toEqual(['me', 'ee', 'pr', 'rs', 'xf']);
  });

  it('RESOURCE_LIST has five entries in RESOURCE_IDS order', () => {
    expect(RESOURCE_LIST).toHaveLength(5);
    expect(RESOURCE_LIST.map((r) => r.id)).toEqual([...RESOURCE_IDS]);
  });

  it('me is the root resource', () => {
    expect(RESOURCES.me.source).toBeNull();
  });

  it('sources form the chain me <- ee <- pr <- rs <- xf', () => {
    RESOURCE_IDS.slice(1).forEach((id, i) => {
      expect(RESOURCES[id].source).toBe(RESOURCE_IDS[i]);
    });
  });

  it('era equals index + 1', () => {
    RESOURCE_IDS.forEach((id, index) => {
      expect(RESOURCES[id].era).toBe(index + 1);
    });
  });

  it('every non-me resource has convExp 0.5', () => {
    for (const id of RESOURCE_IDS) {
      if (id !== 'me') expect(RESOURCES[id].convExp).toBe(0.5);
    }
  });

  it('shorts are unique and xf is ???', () => {
    const shorts = RESOURCE_IDS.map((id) => RESOURCES[id].short);
    expect(new Set(shorts).size).toBe(shorts.length);
    expect(RESOURCES.xf.short).toBe('???');
  });

  it('names and shorts match the table', () => {
    expect(RESOURCES.me).toMatchObject({ name: 'Mechanical Energy', short: 'ME' });
    expect(RESOURCES.ee).toMatchObject({ name: 'Electrical Energy', short: 'EE' });
    expect(RESOURCES.pr).toMatchObject({ name: 'Pressure', short: 'PR' });
    expect(RESOURCES.rs).toMatchObject({ name: 'Resonance', short: 'RS' });
    expect(RESOURCES.xf).toMatchObject({ name: 'Unknown Flux', short: '???' });
  });
});

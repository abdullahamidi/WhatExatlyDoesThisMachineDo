import { describe, it, expect } from 'vitest';
import { buildHudView } from './hudView';
import { createInitialState, emptyResourceMap } from '../simulation';
import type { ProductionRates, ResourceMap } from '../data/types';

function stateWithMe(me: number): { res: ResourceMap; lifetime: ResourceMap } {
  return { res: { ...emptyResourceMap(), me }, lifetime: emptyResourceMap() };
}

function ratesOf(perClick: number, perSecond: Partial<ResourceMap>): ProductionRates {
  return {
    perClick: { ...emptyResourceMap(), me: perClick },
    perSecond: { ...emptyResourceMap(), ...perSecond },
  };
}

describe('buildHudView', () => {
  it('formats a zero state', () => {
    const view = buildHudView(stateWithMe(0), ratesOf(1, { me: 0 }));
    expect({ me: view.me, perClick: view.perClick, perSecond: view.perSecond }).toEqual({
      me: '0',
      perClick: '1',
      perSecond: '0/s',
    });
  });

  it('lists the four extra resource rows in ee, pr, rs, xf order, all hidden at start', () => {
    const view = buildHudView(stateWithMe(0), ratesOf(1, { me: 0 }));
    expect(view.rows.map((r) => r.id)).toEqual(['ee', 'pr', 'rs', 'xf']);
    expect(view.rows.map((r) => r.label)).toEqual(['EE', 'PR', 'RS', '???']);
    expect(view.rows.every((r) => r.visible === false)).toBe(true);
    expect(view.rows.every((r) => r.value === '0')).toBe(true);
    expect(view.rows.every((r) => r.perSecond === '0/s')).toBe(true);
  });

  it('formats large me with a suffix', () => {
    expect(buildHudView(stateWithMe(1500), ratesOf(1, { me: 0 })).me).toBe('1.5K');
  });

  it('formats per-click without a rate suffix', () => {
    expect(buildHudView(stateWithMe(0), ratesOf(12, { me: 0 })).perClick).toBe('12');
  });

  it('formats per-second as a rate', () => {
    expect(buildHudView(stateWithMe(0), ratesOf(1, { me: 12.5 })).perSecond).toBe('12.5/s');
    expect(buildHudView(stateWithMe(0), ratesOf(1, { me: 1500 })).perSecond).toBe('1.5K/s');
  });

  it('shows a row when only its lifetime is positive', () => {
    const state = {
      res: emptyResourceMap(),
      lifetime: { ...emptyResourceMap(), ee: 5 },
    };
    const ee = buildHudView(state, ratesOf(1, { me: 0 })).rows.find((r) => r.id === 'ee');
    expect(ee?.visible).toBe(true);
    expect(ee?.value).toBe('0');
  });

  it('shows a row when only its per-second rate is positive', () => {
    const view = buildHudView(stateWithMe(0), ratesOf(1, { me: 0, pr: 3 }));
    const pr = view.rows.find((r) => r.id === 'pr');
    expect(pr?.visible).toBe(true);
    expect(pr?.perSecond).toBe('3/s');
    expect(view.rows.find((r) => r.id === 'ee')?.visible).toBe(false);
  });

  it('formats extra resource values and rates with suffixes', () => {
    const state = {
      res: { ...emptyResourceMap(), xf: 2500 },
      lifetime: { ...emptyResourceMap(), xf: 2500 },
    };
    const xf = buildHudView(state, ratesOf(1, { me: 0, xf: 1500 })).rows.find((r) => r.id === 'xf');
    expect(xf?.value).toBe('2.5K');
    expect(xf?.perSecond).toBe('1.5K/s');
    expect(xf?.label).toBe('???');
  });

  it('accepts a full initial game state', () => {
    const view = buildHudView(createInitialState(0), ratesOf(1, { me: 0 }));
    expect(view.me).toBe('0');
  });

  it('shows 0 for a non-finite me', () => {
    expect(buildHudView(stateWithMe(Number.NaN), ratesOf(1, { me: 0 })).me).toBe('0');
  });
});

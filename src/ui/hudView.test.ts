import { describe, it, expect, afterEach } from 'vitest';
import { buildHudView, clickGainText, cycleLine, plaqueText } from './hudView';
import { setRevealed } from './revealRules';
import { createInitialState, emptyResourceMap } from '../simulation';
import type { ProductionRates, ResourceMap, TechId } from '../data/types';

function stateWithMe(me: number): ReturnType<typeof createInitialState> {
  return { ...createInitialState(0), res: { ...emptyResourceMap(), me }, lifetime: emptyResourceMap() };
}

function levelsWith(owned: readonly TechId[]): Record<TechId, number> {
  const levels = { ...createInitialState(0).techLevels };
  for (const id of owned) levels[id] = 1;
  return levels;
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
      ...createInitialState(0),
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
      ...createInitialState(0),
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

describe('plaqueText', () => {
  it('shows the unknown function line at the start', () => {
    expect(plaqueText(createInitialState(0).techLevels)).toBe('PRIMARY FUNCTION: UNKNOWN');
  });

  it('shows the first milestone line once generatorBlueprint is owned', () => {
    expect(plaqueText(levelsWith(['generatorBlueprint']))).toBe('PRIMARY FUNCTION: R?S????');
  });

  it('shows the last line once both blueprints are owned', () => {
    expect(plaqueText(levelsWith(['generatorBlueprint', 'substationBlueprint']))).toBe('PRIMARY FUNCTION: RES?OR?');
  });

  it('shows the last owned line even without the earlier milestone', () => {
    expect(plaqueText(levelsWith(['substationBlueprint']))).toBe('PRIMARY FUNCTION: RES?OR?');
  });
});

describe('buildHudView plaque', () => {
  it('follows techLevels and leaves every other field unchanged', () => {
    const base = buildHudView(stateWithMe(1500), ratesOf(12, { me: 12.5, ee: 3 }));
    const withPlaque = buildHudView(
      { ...stateWithMe(1500), techLevels: levelsWith(['generatorBlueprint']) },
      ratesOf(12, { me: 12.5, ee: 3 }),
    );
    expect(base.plaque).toBe('PRIMARY FUNCTION: UNKNOWN');
    expect(withPlaque.plaque).toBe('PRIMARY FUNCTION: R?S????');
    expect(withPlaque.me).toBe(base.me);
    expect(withPlaque.perClick).toBe(base.perClick);
    expect(withPlaque.perSecond).toBe(base.perSecond);
    expect(withPlaque.rows).toEqual(base.rows);
    expect(base.me).toBe('1.5K');
    expect(base.perClick).toBe('12');
    expect(base.perSecond).toBe('12.5/s');
  });
});

describe('clickGainText', () => {
  it('shows ME alone as +N', () => {
    expect(clickGainText({ ...emptyResourceMap(), me: 32 })).toBe('+32');
  });

  it('shows +0 when nothing was gained', () => {
    expect(clickGainText(emptyResourceMap())).toBe('+0');
  });

  it('lists ME and EE with two spaces between parts', () => {
    expect(clickGainText({ ...emptyResourceMap(), me: 32, ee: 1200 })).toBe('+32 ME  +1.2K EE');
  });

  it('lists EE alone when ME is zero', () => {
    expect(clickGainText({ ...emptyResourceMap(), ee: 1200 })).toBe('+1.2K EE');
  });

  it('uses the short label of unknown flux', () => {
    expect(clickGainText({ ...emptyResourceMap(), me: 5, xf: 3 })).toBe('+5 ME  +3 ???');
  });

  it('ignores NaN and negative values', () => {
    expect(clickGainText({ ...emptyResourceMap(), me: Number.NaN })).toBe('+0');
    expect(clickGainText({ ...emptyResourceMap(), me: -4 })).toBe('+0');
    expect(clickGainText({ ...emptyResourceMap(), me: 7, ee: Number.NaN, pr: -2 })).toBe('+7');
  });

  it('orders parts me, ee, pr, rs, xf', () => {
    const text = clickGainText({ me: 1, ee: 2, pr: 3, rs: 4, xf: 5 });
    expect(text).toBe('+1 ME  +2 EE  +3 PR  +4 RS  +5 ???');
  });
});


describe('xf label reveal (WP13 D4)', () => {
  afterEach(() => {
    setRevealed(false);
  });

  it('shows RF on the xf HUD row and in the click gain text once revealed', () => {
    setRevealed(true);
    const state = {
      ...createInitialState(0),
      res: { ...emptyResourceMap(), xf: 2500 },
      lifetime: { ...emptyResourceMap(), xf: 2500 },
    };
    const xf = buildHudView(state, ratesOf(1, { me: 0, xf: 1500 })).rows.find((r) => r.id === 'xf');
    expect(xf?.label).toBe('RF');
    expect(clickGainText({ ...emptyResourceMap(), me: 5, xf: 3 })).toBe('+5 ME  +3 RF');
  });

  it('keeps the other resource labels when revealed', () => {
    setRevealed(true);
    const view = buildHudView(stateWithMe(0), ratesOf(1, { me: 0 }));
    expect(view.rows.map((r) => r.label)).toEqual(['EE', 'PR', 'RS', 'RF']);
  });
});

describe('cycle line (WP14 T8a)', () => {
  it('is null in cycle 1, so the default HUD strings do not change', () => {
    expect(cycleLine(1)).toBeNull();
    expect(buildHudView(stateWithMe(0), ratesOf(1, { me: 0 })).cycle).toBeNull();
    expect(buildHudView(stateWithMe(0), ratesOf(1, { me: 0 }), { cycle: 1 }).cycle).toBeNull();
  });

  it('shows the cycle label from cycle 2', () => {
    expect(cycleLine(2)).toBe('CYCLE 0043');
    expect(cycleLine(3)).toBe('CYCLE 0044');
    expect(buildHudView(stateWithMe(0), ratesOf(1, { me: 0 }), { cycle: 2 }).cycle).toBe('CYCLE 0043');
  });

  it('leaves every other field unchanged', () => {
    const base = buildHudView(stateWithMe(1500), ratesOf(12, { me: 12.5 }));
    const cycled = buildHudView(stateWithMe(1500), ratesOf(12, { me: 12.5 }), { cycle: 2 });
    expect({ ...cycled, cycle: null }).toEqual(base);
  });
});

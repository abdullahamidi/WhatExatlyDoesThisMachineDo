import { describe, it, expect, afterEach } from 'vitest';
import { HUD_ROW_IDS, buildHudView, clickGainLines, cycleLine, formatWorth, hudTitle, plaqueText, releaseLine } from './hudView';
import type { GainLine, HudCrankReadout, HudResourceRow, HudView } from './hudView';
import { setRevealed } from './revealRules';
import { createInitialState, emptyResourceMap } from '../simulation';
import { RESOURCE_IDS } from '../data/types';
import type { EndingPhase, GameState, ProductionRates, ResourceId, ResourceMap, TechDefinition, TechId } from '../data/types';
import { TECHNOLOGIES } from '../data/technologies';
import { HUD_TEXT } from '../data/hud';

type HudState = Pick<GameState, 'res' | 'lifetime' | 'techLevels' | 'ending'>;

afterEach(() => {
  setRevealed(false);
});

/** Initial state with optional stock, lifetime, tech levels and finale phase. */
function hudState(patch: {
  res?: Partial<ResourceMap>;
  lifetime?: Partial<ResourceMap>;
  levels?: Partial<Record<TechId, number>>;
  phase?: EndingPhase;
} = {}): HudState {
  const base = createInitialState(0);
  return {
    res: { ...emptyResourceMap(), ...patch.res },
    lifetime: { ...emptyResourceMap(), ...patch.lifetime },
    techLevels: { ...base.techLevels, ...patch.levels },
    ending: { ...base.ending, phase: patch.phase ?? base.ending.phase },
  };
}

function levelsWith(owned: readonly TechId[]): Record<TechId, number> {
  const levels = { ...createInitialState(0).techLevels };
  for (const id of owned) levels[id] = 1;
  return levels;
}

function ratesOf(perClick: Partial<ResourceMap>, perSecond: Partial<ResourceMap> = {}): ProductionRates {
  return {
    perClick: { ...emptyResourceMap(), ...perClick },
    perSecond: { ...emptyResourceMap(), ...perSecond },
  };
}

function rowOf(view: HudView, id: ResourceId): HudResourceRow {
  const row = view.rows.find((r) => r.id === id);
  if (row === undefined) throw new Error(`no HUD row ${id}`);
  return row;
}

function texts(lines: readonly GainLine[]): string[] {
  return lines.map((line) => line.text);
}

describe('HUD_ROW_IDS', () => {
  it('lists every resource, ME included', () => {
    expect(HUD_ROW_IDS).toEqual(RESOURCE_IDS);
    expect([...HUD_ROW_IDS]).toEqual(['me', 'ee', 'pr', 'rs', 'xf']);
  });
});

describe('buildHudView', () => {
  it('starts in era I with only ME shown', () => {
    const view = buildHudView(hudState(), ratesOf({ me: 1 }));
    expect(view.title).toBe('ERA I · MECHANICAL');
    expect(view.rows.map((r) => r.id)).toEqual(['me', 'ee', 'pr', 'rs', 'xf']);
    expect(rowOf(view, 'me')).toEqual({ id: 'me', label: 'ME', value: '0', rate: '0/s', feeds: null, visible: true, frontier: true });
    expect(view.rows.filter((r) => r.id !== 'me').every((r) => r.visible === false)).toBe(true);
    expect(view.rows.filter((r) => r.frontier)).toHaveLength(1);
    expect(view.click).toEqual({ primary: '+1 ME', secondary: null, title: null });
    expect(view.autoCrank).toBeNull();
  });

  it('accepts a full initial game state', () => {
    const view = buildHudView(createInitialState(0), ratesOf({ me: 1 }));
    expect(rowOf(view, 'me').value).toBe('0');
  });

  it('era II: generator makes EE the frontier and ME feeds EE', () => {
    const view = buildHudView(hudState({ levels: { generator: 1 }, lifetime: { ee: 5 } }), ratesOf({ me: 12, ee: 0 }, { me: 12.5, ee: 3.25 }));
    expect(view.title).toBe('ERA II · ELECTRICAL');
    expect(rowOf(view, 'me').rate).toBe('12/s');
    expect(rowOf(view, 'me').feeds).toBe('›EE');
    const ee = rowOf(view, 'ee');
    expect(ee.frontier).toBe(true);
    expect(ee.rate).toBe('3.2/s');
    expect(view.rows.filter((r) => r.frontier).map((r) => r.id)).toEqual(['ee']);
    expect(view.click).toEqual({ primary: '+12 ME · 0.96s', secondary: null, title: 'One turn of the crank = 0.96 s of machine output' });
  });

  it('click line names the frontier resource when its per-click gain is positive', () => {
    const view = buildHudView(hudState({ levels: { generator: 1 } }), ratesOf({ me: 12, ee: 26900 }, { me: 12.5 }));
    expect(view.click).toEqual({ primary: '+26.9K EE', secondary: '+12 ME', title: null });
  });

  it('click line falls back to ME when the frontier per-click gain is not finite', () => {
    const view = buildHudView(hudState({ levels: { generator: 1 } }), ratesOf({ me: 12, ee: Number.NaN }));
    expect(view.click).toEqual({ primary: '+12 ME', secondary: null, title: null });
  });

  it('feeds name the fed resource only while that row is visible', () => {
    expect(rowOf(buildHudView(hudState(), ratesOf({ me: 1 })), 'me').feeds).toBeNull();
    expect(rowOf(buildHudView(hudState({ lifetime: { ee: 5 } }), ratesOf({ me: 1 })), 'me').feeds).toBe('›EE');
    expect(rowOf(buildHudView(hudState({ levels: { generator: 1 } }), ratesOf({ me: 1 })), 'ee').feeds).toBeNull();
    expect(rowOf(buildHudView(hudState({ levels: { generator: 1 }, lifetime: { pr: 1 } }), ratesOf({ me: 1 })), 'ee').feeds).toBe('›PR');
  });

  it('shows AUTO-CRANK clicks per second from crankServo', () => {
    const view = buildHudView(hudState({ levels: { crankServo: 3 } }), ratesOf({ me: 1 }));
    expect(view.autoCrank).toBe('AUTO-CRANK 3/s · +3 ME/s');
  });

  it('takes the tech table for AUTO-CRANK from the caller', () => {
    const techs: Record<TechId, TechDefinition> = {
      ...TECHNOLOGIES,
      crankServo: { ...TECHNOLOGIES.crankServo, effects: [{ type: 'autoClick', perSecond: 2 }] },
    };
    const view = buildHudView(hudState({ levels: { crankServo: 3 } }), ratesOf({ me: 1 }), undefined, techs);
    expect(view.autoCrank).toBe('AUTO-CRANK 6/s · +6 ME/s');
  });

  it('formats stock as whole units below 1000 and with a suffix from 1000', () => {
    expect(rowOf(buildHudView(hudState({ res: { me: 999.9 } }), ratesOf({ me: 1 })), 'me').value).toBe('999');
    expect(rowOf(buildHudView(hudState({ res: { me: 1500 } }), ratesOf({ me: 1 })), 'me').value).toBe('1.5K');
  });

  it('formats per-second rates compactly', () => {
    expect(rowOf(buildHudView(hudState(), ratesOf({ me: 1 }, { me: 12.5 })), 'me').rate).toBe('12/s');
    expect(rowOf(buildHudView(hudState(), ratesOf({ me: 1 }, { me: 1500 })), 'me').rate).toBe('1.5K/s');
  });

  it('formats extra resource values and rates with suffixes', () => {
    const state = hudState({ res: { xf: 2500 }, lifetime: { xf: 2500 } });
    const xf = rowOf(buildHudView(state, ratesOf({ me: 1 }, { xf: 1500 })), 'xf');
    expect(xf.value).toBe('2.5K');
    expect(xf.rate).toBe('1.5K/s');
    expect(xf.label).toBe('???');
  });

  it('shows a row when only its lifetime is positive', () => {
    const view = buildHudView(hudState({ lifetime: { ee: 5 } }), ratesOf({ me: 1 }));
    const ee = rowOf(view, 'ee');
    expect(ee.visible).toBe(true);
    expect(ee.frontier).toBe(false);
    expect(ee.value).toBe('0');
  });

  it('shows a row when only its per-second rate is positive', () => {
    const view = buildHudView(hudState(), ratesOf({ me: 1 }, { pr: 3 }));
    const pr = rowOf(view, 'pr');
    expect(pr.visible).toBe(true);
    expect(pr.rate).toBe('3/s');
    expect(rowOf(view, 'ee').visible).toBe(false);
  });

  it('shows 0 for a non-finite stock', () => {
    expect(rowOf(buildHudView(hudState({ res: { me: Number.NaN } }), ratesOf({ me: 1 })), 'me').value).toBe('0');
  });
});

describe('hudTitle', () => {
  it('gives each era its title', () => {
    expect(hudTitle(1, 'none', false)).toBe('ERA I · MECHANICAL');
    expect(hudTitle(2, 'none', false)).toBe('ERA II · ELECTRICAL');
    expect(hudTitle(3, 'none', false)).toBe('ERA III · PRESSURE');
    expect(hudTitle(4, 'none', false)).toBe('ERA IV · RESONANCE');
    expect(hudTitle(5, 'none', false)).toBe('ERA V · ???');
  });

  it('shows the revealed title only in era V', () => {
    expect(hudTitle(5, 'none', true)).toBe('ERA V · RESTORATION FLUX');
    expect(hudTitle(4, 'none', true)).toBe('ERA IV · RESONANCE');
  });

  it('shows the restored title in the choice and postgame phases', () => {
    expect(hudTitle(5, 'choice', false)).toBe('RESTORATION ENGINE');
    expect(hudTitle(2, 'postgame', true)).toBe('RESTORATION ENGINE');
  });

  it('keeps the era title during the sequence phase', () => {
    expect(hudTitle(5, 'sequence', false)).toBe('ERA V · ???');
  });
});

describe('era V and the finale title', () => {
  it('shows ??? and the xf frontier with nullChamber owned', () => {
    const view = buildHudView(hudState({ levels: { nullChamber: 1 } }), ratesOf({ me: 1 }));
    expect(view.title).toBe('ERA V · ???');
    expect(rowOf(view, 'xf').frontier).toBe(true);
    expect(rowOf(view, 'xf').label).toBe('???');
  });

  it('shows RESTORATION FLUX and the RF feed once revealed', () => {
    setRevealed(true);
    const view = buildHudView(hudState({ levels: { nullChamber: 1 } }), ratesOf({ me: 1, xf: 3 }));
    expect(view.title).toBe('ERA V · RESTORATION FLUX');
    expect(rowOf(view, 'rs').feeds).toBe('›RF');
    expect(rowOf(view, 'xf').label).toBe('RF');
    expect(view.click).toEqual({ primary: '+3 RF', secondary: '+1 ME', title: null });
  });

  it('shows RESTORATION ENGINE in the choice and postgame phases, in any era', () => {
    setRevealed(true);
    for (const phase of ['choice', 'postgame'] as const) {
      expect(buildHudView(hudState({ phase }), ratesOf({ me: 1 })).title).toBe('RESTORATION ENGINE');
      expect(buildHudView(hudState({ phase, levels: { nullChamber: 1 } }), ratesOf({ me: 1 })).title).toBe('RESTORATION ENGINE');
    }
  });

  it('keeps the unrevealed title in the sequence phase', () => {
    expect(buildHudView(hudState({ phase: 'sequence', levels: { nullChamber: 1 } }), ratesOf({ me: 1 })).title).toBe('ERA V · ???');
  });
});

describe('buildHudView plaque', () => {
  it('follows techLevels and leaves every other field unchanged', () => {
    const rates = ratesOf({ me: 12 }, { me: 12.5, ee: 3 });
    const base = buildHudView(hudState({ res: { me: 1500 } }), rates);
    const withPlaque = buildHudView(hudState({ res: { me: 1500 }, levels: { generatorBlueprint: 1 } }), rates);
    expect(base.plaque).toBe('PRIMARY FUNCTION: UNKNOWN');
    expect(withPlaque.plaque).toBe('PRIMARY FUNCTION: R?S????');
    expect({ ...withPlaque, plaque: base.plaque }).toEqual(base);
    expect(rowOf(base, 'me').value).toBe('1.5K');
    expect(base.click).toEqual({ primary: '+12 ME · 0.96s', secondary: null, title: 'One turn of the crank = 0.96 s of machine output' });
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

describe('clickGainLines', () => {
  it('shows ME alone as one +N line', () => {
    expect(clickGainLines({ ...emptyResourceMap(), me: 32 })).toEqual([{ res: 'me', text: '+32' }]);
  });

  it('shows +0 when nothing was gained', () => {
    expect(texts(clickGainLines(emptyResourceMap()))).toEqual(['+0']);
  });

  it('stacks EE above ME', () => {
    expect(texts(clickGainLines({ ...emptyResourceMap(), me: 32, ee: 1200 }))).toEqual(['+1.2K EE', '+32 ME']);
  });

  it('stacks every gained resource, xf first', () => {
    const lines = clickGainLines({ me: 1, ee: 2, pr: 3, rs: 4, xf: 5 });
    expect(texts(lines)).toEqual(['+5 ???', '+4 RS', '+3 PR', '+2 EE', '+1 ME']);
    expect(lines.map((line) => line.res)).toEqual(['xf', 'rs', 'pr', 'ee', 'me']);
  });

  it('shows fractions with one decimal below 10', () => {
    expect(texts(clickGainLines({ ...emptyResourceMap(), me: 5, ee: 0.5 }))).toEqual(['+0.5 EE', '+5 ME']);
  });

  it('ignores NaN and negative gains', () => {
    expect(texts(clickGainLines({ ...emptyResourceMap(), me: Number.NaN }))).toEqual(['+0']);
    expect(texts(clickGainLines({ ...emptyResourceMap(), me: -4 }))).toEqual(['+0']);
    expect(texts(clickGainLines({ ...emptyResourceMap(), me: 7, ee: Number.NaN, pr: -2 }))).toEqual(['+7']);
  });

  it('uses RF for xf once revealed', () => {
    setRevealed(true);
    expect(texts(clickGainLines({ ...emptyResourceMap(), xf: 3 }))).toEqual(['+3 RF']);
  });
});

describe('xf label reveal (WP13 D4)', () => {
  it('shows RF on the xf HUD row and in the click gain lines once revealed', () => {
    setRevealed(true);
    const state = hudState({ res: { xf: 2500 }, lifetime: { xf: 2500 } });
    const xf = rowOf(buildHudView(state, ratesOf({ me: 1 }, { xf: 1500 })), 'xf');
    expect(xf.label).toBe('RF');
    expect(texts(clickGainLines({ ...emptyResourceMap(), me: 5, xf: 3 }))).toEqual(['+3 RF', '+5 ME']);
  });

  it('keeps the other resource labels when revealed', () => {
    setRevealed(true);
    const view = buildHudView(hudState(), ratesOf({ me: 1 }));
    expect(view.rows.map((r) => r.label)).toEqual(['ME', 'EE', 'PR', 'RS', 'RF']);
  });
});

describe('viewMachine (WP18 T3)', () => {
  it('is false in the none, sequence and choice phases', () => {
    for (const phase of ['none', 'sequence', 'choice'] as const) {
      expect(buildHudView(hudState({ phase }), ratesOf({ me: 1 })).viewMachine).toBe(false);
    }
  });

  it('is true in the postgame phase only', () => {
    expect(buildHudView(hudState({ phase: 'postgame' }), ratesOf({ me: 1 })).viewMachine).toBe(true);
  });

  it('keeps the RESTORATION ENGINE title in postgame', () => {
    expect(buildHudView(hudState({ phase: 'postgame' }), ratesOf({ me: 1 })).title).toBe('RESTORATION ENGINE');
  });
});

describe('cycle line (WP14 T8a)', () => {
  it('is null in cycle 1, so the default HUD strings do not change', () => {
    expect(cycleLine(1)).toBeNull();
    expect(buildHudView(hudState(), ratesOf({ me: 1 })).cycle).toBeNull();
    expect(buildHudView(hudState(), ratesOf({ me: 1 }), { cycle: 1 }).cycle).toBeNull();
  });

  it('shows the cycle label from cycle 2', () => {
    expect(cycleLine(2)).toBe('CYCLE 0043');
    expect(cycleLine(3)).toBe('CYCLE 0044');
    expect(buildHudView(hudState(), ratesOf({ me: 1 }), { cycle: 2 }).cycle).toBe('CYCLE 0043');
  });

  it('leaves every other field unchanged', () => {
    const base = buildHudView(hudState({ res: { me: 1500 } }), ratesOf({ me: 12 }, { me: 12.5 }));
    const cycled = buildHudView(hudState({ res: { me: 1500 } }), ratesOf({ me: 12 }, { me: 12.5 }), { cycle: 2 });
    expect({ ...cycled, cycle: null }).toEqual(base);
  });
});

describe('click worth suffix (WP25 C4)', () => {
  const WORTH_TITLE = (s: string): string => `One turn of the crank = ${s} s of machine output`;

  it('shows no suffix and no title in era I before Worn Motor (perSecond 0)', () => {
    const view = buildHudView(hudState(), ratesOf({ me: 1 }));
    expect(view.click).toEqual({ primary: '+1 ME', secondary: null, title: null });
  });

  it('shows the worth in era I after Worn Motor', () => {
    const view = buildHudView(hudState(), ratesOf({ me: 2 }, { me: 20 }));
    expect(view.click).toEqual({ primary: '+2 ME · 0.1s', secondary: null, title: WORTH_TITLE('0.1') });
  });

  it('shows a fractional click with no worth when perSecond is 0 (R1)', () => {
    expect(buildHudView(hudState(), ratesOf({ me: 1.5 })).click).toEqual({ primary: '+1.5 ME', secondary: null, title: null });
  });

  it('shows a fractional click with its worth when perSecond is positive (R1)', () => {
    expect(buildHudView(hudState(), ratesOf({ me: 1.5 }, { me: 3 })).click).toEqual({
      primary: '+1.5 ME · 0.5s',
      secondary: null,
      title: WORTH_TITLE('0.5'),
    });
  });

  it('shows the frontier worth and the servo auto-crank output in era II', () => {
    const view = buildHudView(hudState({ levels: { generator: 1, crankServo: 4 } }), ratesOf({ me: 10, ee: 100 }, { me: 50, ee: 400 }));
    expect(view.click).toEqual({ primary: '+100 EE · 0.25s', secondary: '+10 ME', title: WORTH_TITLE('0.25') });
    expect(view.autoCrank).toBe('AUTO-CRANK 4/s · +400 EE/s');
  });

  it('shows the small R1 worth of a servo-era click (0.07 s)', () => {
    const view = buildHudView(hudState({ levels: { generator: 1 } }), ratesOf({ me: 10, ee: 0.25 }, { me: 50, ee: 3.5 }));
    expect(view.click.primary).toBe('+0.2 EE · 0.07s');
  });

  it('shows a large worth in whole seconds, with the frontier secondary line kept', () => {
    const view = buildHudView(hudState({ levels: { generator: 1 } }), ratesOf({ me: 12, ee: 26900 }, { ee: 4 }));
    expect(view.click).toEqual({ primary: '+26.9K EE · 6725s', secondary: '+12 ME', title: WORTH_TITLE('6725') });
  });

  it('falls back to ME with its own worth when the frontier per-click gain is NaN', () => {
    const view = buildHudView(hudState({ levels: { generator: 1 } }), ratesOf({ me: 12, ee: Number.NaN }, { me: 24 }));
    expect(view.click).toEqual({ primary: '+12 ME · 0.5s', secondary: null, title: WORTH_TITLE('0.5') });
  });

  it('shows no suffix when perSecond of the click resource is 0', () => {
    expect(buildHudView(hudState(), ratesOf({ me: 2 })).click).toEqual({ primary: '+2 ME', secondary: null, title: null });
  });

  it('shows no suffix when perSecond of the click resource is NaN', () => {
    expect(buildHudView(hudState(), ratesOf({ me: 2 }, { me: Number.NaN })).click).toEqual({ primary: '+2 ME', secondary: null, title: null });
  });

  it('leaves the AUTO-CRANK text plain when its output is not finite', () => {
    expect(buildHudView(hudState({ levels: { crankServo: 3 } }), ratesOf({ me: Number.NaN }, { me: 10 })).autoCrank).toBe('AUTO-CRANK 3/s');
  });

  it('leaves the AUTO-CRANK text plain when its output rounds to 0', () => {
    expect(buildHudView(hudState({ levels: { crankServo: 3 } }), ratesOf({ me: 0.01 })).autoCrank).toBe('AUTO-CRANK 3/s');
  });
});

describe('formatWorth (WP25 C4)', () => {
  it('shows whole seconds from 10', () => {
    expect(formatWorth(12)).toBe('12');
    expect(formatWorth(12.4)).toBe('12');
    expect(formatWorth(10)).toBe('10');
  });

  it('shows one decimal from 1 and trims a zero decimal', () => {
    expect(formatWorth(2.5)).toBe('2.5');
    expect(formatWorth(2)).toBe('2');
    expect(formatWorth(9.96)).toBe('10');
  });

  it('shows two decimals below 1 and trims trailing zeros', () => {
    expect(formatWorth(0.25)).toBe('0.25');
    expect(formatWorth(0.5)).toBe('0.5');
    expect(formatWorth(0.1)).toBe('0.1');
    expect(formatWorth(0.07)).toBe('0.07');
    expect(formatWorth(0.01)).toBe('0.01');
  });

  it('shows <0.01 below 0.01, at 0, for negative and for non-finite values', () => {
    expect(formatWorth(0.004)).toBe('<0.01');
    expect(formatWorth(0.0099)).toBe('<0.01');
    expect(formatWorth(0)).toBe('<0.01');
    expect(formatWorth(-1)).toBe('<0.01');
    expect(formatWorth(Number.NaN)).toBe('<0.01');
    expect(formatWorth(Number.POSITIVE_INFINITY)).toBe('<0.01');
    expect(formatWorth(0.001)).toBe(HUD_TEXT.worthFloor);
  });
});

describe('WIND-UP row (WP27 C8)', () => {
  const WINDUP_TITLE = 'Stored machine output. The next turn of the crank releases it.';
  const crank = (over: Partial<HudCrankReadout> = {}): HudCrankReadout => ({ stored: 0, cap: 0.5, overdriveLeft: 0, overdriveFactor: 2, ...over });
  const windupOf = (readout: HudCrankReadout | undefined): HudView['windup'] =>
    buildHudView(hudState(), ratesOf({ me: 1 }), undefined, undefined, readout).windup;

  it('is null without the crank readout, so the default HUD does not change', () => {
    expect(buildHudView(hudState(), ratesOf({ me: 1 })).windup).toBeNull();
    expect(windupOf(undefined)).toBeNull();
  });

  it('is null at cap 0 (no wind-up owned)', () => {
    expect(windupOf(crank({ cap: 0 }))).toBeNull();
    expect(windupOf(crank({ cap: 0, stored: 0.3 }))).toBeNull();
  });

  it('shows the stored seconds over the cap with one decimal, half up (0.35 -> 0.4)', () => {
    expect(windupOf(crank({ stored: 0.35, cap: 0.5 }))).toEqual({ text: 'WIND-UP 0.4/0.5s', title: WINDUP_TITLE });
  });

  it('trims a zero decimal from the seconds', () => {
    expect(windupOf(crank({ stored: 1.4, cap: 2 }))).toEqual({ text: 'WIND-UP 1.4/2s', title: WINDUP_TITLE });
    expect(windupOf(crank({ stored: 0, cap: 0.5 }))?.text).toBe('WIND-UP 0/0.5s');
  });

  it('shows a non-finite stored value as 0', () => {
    expect(windupOf(crank({ stored: Number.NaN, cap: 0.5 }))?.text).toBe('WIND-UP 0/0.5s');
  });

  it('appends the Overdrive suffix while it runs: factor and seconds left, rounded up', () => {
    expect(windupOf(crank({ stored: 1.4, cap: 2, overdriveLeft: 3.2, overdriveFactor: 2 }))?.text).toBe('WIND-UP 1.4/2s · OVERDRIVE ×2 4s');
  });

  it('shows no Overdrive suffix once it has run out', () => {
    expect(windupOf(crank({ stored: 1.4, cap: 2, overdriveLeft: 0, overdriveFactor: 2 }))?.text).toBe('WIND-UP 1.4/2s');
  });

  it('leaves every other field unchanged', () => {
    const rates = ratesOf({ me: 12 }, { me: 12.5 });
    const base = buildHudView(hudState({ res: { me: 1500 } }), rates);
    const withWindup = buildHudView(hudState({ res: { me: 1500 } }), rates, undefined, undefined, crank({ stored: 0.35, cap: 0.5 }));
    expect({ ...withWindup, windup: null }).toEqual(base);
  });
});

describe('releaseLine (WP27 C8)', () => {
  it('is null below 0.05 s and for a non-finite release', () => {
    expect(releaseLine(0)).toBeNull();
    expect(releaseLine(0.049)).toBeNull();
    expect(releaseLine(Number.NaN)).toBeNull();
    expect(releaseLine(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('shows the released seconds as an ME line', () => {
    expect(releaseLine(1.4)).toEqual({ res: 'me', text: 'RELEASE +1.4s' });
  });

  it('shows from 0.05 s, with one decimal rounded half up and a whole number trimmed', () => {
    expect(releaseLine(0.05)?.text).toBe('RELEASE +0.1s');
    expect(releaseLine(0.35)?.text).toBe('RELEASE +0.4s');
    expect(releaseLine(1.44)?.text).toBe('RELEASE +1.4s');
    expect(releaseLine(1.46)?.text).toBe('RELEASE +1.5s');
    expect(releaseLine(2)?.text).toBe('RELEASE +2s');
    expect(releaseLine(12.34)?.text).toBe('RELEASE +12.3s');
  });
});

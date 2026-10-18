import { describe, it, expect } from 'vitest';
import {
  PERK_IDS, PERKS, PERK_LIST, ECHO_RULES, MEMORY_SOURCE_TECH, CYCLE_LABEL, CYCLE_TRANSITION, PRESTIGE_ART, PRESTIGE_TEXT,
} from './prestige';
import type { PerkEffect, PerkId } from './prestige';
import { TECHNOLOGIES } from './technologies';
import { TECH_IDS } from './types';
import type { TechId } from './types';
import { PALETTE } from './palette';

// Sheet sizes measured from public/assets/ui (PNG IHDR): perks.png 160×32, perk-slot.png 108×36.
const SHEET_SIZE = { perks: { w: 160, h: 32 }, perkSlot: { w: 108, h: 36 } } as const;

const EXPECTED_COSTS: Record<PerkId, number> = {
  muscleMemory: 1, residualCharge: 2, longSilence: 2, servoRecall: 3, ledger: 3,
};

const KEYSTONE_CONVERTERS: TechId[] = ['generator', 'boiler', 'resonatorSpire', 'nullChamber'];

function effectTechIds(effect: PerkEffect): TechId[] {
  if (effect.type === 'startLevels') return Object.keys(effect.levels) as TechId[];
  if (effect.type === 'costMult') return [...effect.techIds];
  return [];
}

describe('perk table', () => {
  it('lists exactly five perks in PERK_IDS order', () => {
    expect(PERK_IDS).toEqual(['muscleMemory', 'residualCharge', 'longSilence', 'servoRecall', 'ledger']);
    expect(new Set(PERK_IDS).size).toBe(PERK_IDS.length);
    expect(PERK_LIST.map((p) => p.id)).toEqual([...PERK_IDS]);
  });

  it('every PERKS entry is keyed by its own id', () => {
    for (const id of PERK_IDS) {
      expect(PERKS[id].id).toBe(id);
    }
  });

  it('costs are 1, 2, 2, 3, 3 in PERK_IDS order', () => {
    expect(PERK_LIST.map((p) => p.cost)).toEqual([1, 2, 2, 3, 3]);
    for (const id of PERK_IDS) {
      expect(PERKS[id].cost).toBe(EXPECTED_COSTS[id]);
    }
  });

  it('icons are 0..4, unique, and match the perks.png frame order', () => {
    const icons = PERK_LIST.map((p) => p.icon);
    expect(icons).toEqual([0, 1, 2, 3, 4]);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it('every name and description is non-empty and descriptions fit a card', () => {
    for (const p of PERK_LIST) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
      expect(p.description.length).toBeLessThanOrEqual(60);
    }
  });

  it('every TechId referenced by an effect exists in the tech table', () => {
    for (const p of PERK_LIST) {
      for (const id of effectTechIds(p.effect)) {
        expect(TECH_IDS).toContain(id);
        expect(TECHNOLOGIES[id].id).toBe(id);
      }
    }
  });

  it('startLevels values are positive integers', () => {
    const start = PERKS.muscleMemory.effect;
    expect(start.type).toBe('startLevels');
    if (start.type !== 'startLevels') return;
    for (const v of Object.values(start.levels)) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThan(0);
    }
  });

  it('costMult targets are the four keystone converters, each with a convert effect', () => {
    const ledger = PERKS.ledger.effect;
    expect(ledger.type).toBe('costMult');
    if (ledger.type !== 'costMult') return;
    expect([...ledger.techIds].sort()).toEqual([...KEYSTONE_CONVERTERS].sort());
    expect(ledger.factor).toBeCloseTo(0.5, 9);
    for (const id of ledger.techIds) {
      expect(TECHNOLOGIES[id].effects.some((e) => e.type === 'convert')).toBe(true);
    }
  });

  it('effect payloads match the spec values', () => {
    expect(PERKS.residualCharge.effect).toEqual({ type: 'convertPct', percent: 50 });
    expect(PERKS.longSilence.effect).toEqual({ type: 'offlineHours', hours: 4 });
    expect(PERKS.servoRecall.effect).toEqual({ type: 'autoClick', perSecond: 1 });
  });
});

describe('echo rules', () => {
  it('base 3, +30 % per Echo, counted up to 30', () => {
    expect(ECHO_RULES.base).toBe(3);
    expect(ECHO_RULES.allPctPerEcho).toBe(30);
    expect(ECHO_RULES.maxCountedEchoes).toBe(30);
  });

  it('thresholds are positive and strictly ascending', () => {
    const t = ECHO_RULES.bonusAtXf;
    expect(t.length).toBeGreaterThan(0);
    for (let i = 0; i < t.length; i++) {
      expect(Number.isFinite(t[i])).toBe(true);
      expect(t[i]).toBeGreaterThan(0);
      if (i > 0) expect(t[i]).toBeGreaterThan(t[i - 1] as number);
    }
  });

  it('the memory source is a starting tech', () => {
    expect(TECH_IDS).toContain(MEMORY_SOURCE_TECH);
    expect(TECHNOLOGIES[MEMORY_SOURCE_TECH].kind).toBe('starting');
  });
});

describe('cycle label and transition', () => {
  it('label digits and base', () => {
    expect(CYCLE_LABEL.prefix).toBe('CYCLE ');
    expect(CYCLE_LABEL.digits).toBe(4);
    expect(CYCLE_LABEL.base).toBe(42);
  });

  it('transition timings are positive and reduced motion is shorter', () => {
    expect(CYCLE_TRANSITION.inMs).toBeGreaterThan(0);
    expect(CYCLE_TRANSITION.outMs).toBeGreaterThan(0);
    expect(CYCLE_TRANSITION.reduced.inMs).toBeGreaterThan(0);
    expect(CYCLE_TRANSITION.reduced.outMs).toBeGreaterThan(0);
    expect(CYCLE_TRANSITION.reduced.inMs).toBeLessThan(CYCLE_TRANSITION.inMs);
    expect(CYCLE_TRANSITION.reduced.outMs).toBeLessThan(CYCLE_TRANSITION.outMs);
  });

  it('reduced transition ends within 1.2 s', () => {
    expect(CYCLE_TRANSITION.reduced.inMs + CYCLE_TRANSITION.reduced.outMs).toBeLessThanOrEqual(1200);
  });

  it('transition colour is the palette steam tone', () => {
    expect(CYCLE_TRANSITION.color).toBe(PALETTE.steam);
  });
});

describe('prestige art frames', () => {
  it('perks sheet: frame count × frame size equals the sheet size', () => {
    expect(PRESTIGE_ART.perkFrame).toBe(32);
    expect(SHEET_SIZE.perks.h).toBe(PRESTIGE_ART.perkFrame);
    expect(SHEET_SIZE.perks.w / PRESTIGE_ART.perkFrame).toBe(PERK_IDS.length);
  });

  it('perk slot sheet: three frames of 36 px', () => {
    const frames = Object.values(PRESTIGE_ART.slot);
    expect(PRESTIGE_ART.slotFrame).toBe(36);
    expect(SHEET_SIZE.perkSlot.h).toBe(PRESTIGE_ART.slotFrame);
    expect(SHEET_SIZE.perkSlot.w / PRESTIGE_ART.slotFrame).toBe(frames.length);
    expect(frames.length).toBe(3);
  });

  it('slot frames are 0..2 and unique (locked, affordable, owned)', () => {
    expect(PRESTIGE_ART.slot).toEqual({ locked: 0, affordable: 1, owned: 2 });
    expect(new Set(Object.values(PRESTIGE_ART.slot)).size).toBe(3);
  });

  it('scale and inset are positive integers', () => {
    expect(Number.isInteger(PRESTIGE_ART.scale)).toBe(true);
    expect(PRESTIGE_ART.scale).toBeGreaterThan(0);
    expect(Number.isInteger(PRESTIGE_ART.slotInset)).toBe(true);
    expect(PRESTIGE_ART.slotInset).toBeGreaterThanOrEqual(0);
  });

  it('every sheet path points at a file under public/assets/ui', () => {
    const files = Object.keys(import.meta.glob('../../public/assets/ui/*.png'));
    for (const path of [PRESTIGE_ART.echo, PRESTIGE_ART.perks, PRESTIGE_ART.perkSlot]) {
      const name = path.replace('assets/ui/', '');
      expect(files.some((f) => f.endsWith(`/public/assets/ui/${name}`))).toBe(true);
    }
  });
});

describe('prestige text', () => {
  it('status words and labels are non-empty', () => {
    for (const s of [PRESTIGE_TEXT.tab, PRESTIGE_TEXT.blocked, PRESTIGE_TEXT.busy, PRESTIGE_TEXT.empty, PRESTIGE_TEXT.owned,
      PRESTIGE_TEXT.buy, PRESTIGE_TEXT.cost, PRESTIGE_TEXT.need, PRESTIGE_TEXT.echoes, PRESTIGE_TEXT.unspent,
      PRESTIGE_TEXT.allPerSecond, PRESTIGE_TEXT.nextCycle, PRESTIGE_TEXT.begin, PRESTIGE_TEXT.cancel,
      PRESTIGE_TEXT.echoAt, PRESTIGE_TEXT.keptTitle, PRESTIGE_TEXT.resetTitle]) {
      expect(s.length).toBeGreaterThan(0);
    }
  });

  it('kept and reset lists are non-empty and free of blank lines', () => {
    for (const list of [PRESTIGE_TEXT.kept, PRESTIGE_TEXT.reset]) {
      expect(list.length).toBeGreaterThan(0);
      for (const line of list) expect(line.trim().length).toBeGreaterThan(0);
    }
  });

  it('status words are upper case as in the HUD', () => {
    expect(PRESTIGE_TEXT.owned).toBe('OWNED');
    expect(PRESTIGE_TEXT.cost).toBe('COST');
    expect(PRESTIGE_TEXT.need).toBe('NEED');
  });
});

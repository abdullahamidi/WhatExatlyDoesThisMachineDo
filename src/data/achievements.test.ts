import { describe, it, expect } from 'vitest';
import { ACHIEVEMENT_IDS, ACHIEVEMENTS, ACHIEVEMENT_LIST, UI_ART } from './achievements';
import type { AchievementCondition } from './achievements';
import { RESOURCE_IDS, TECH_IDS } from './types';
import type { TechId } from './types';
import { TECHNOLOGIES } from './technologies';

// ART_ERA5 §9 badge icon map (icon index -> suggested achievement).
const ART_ICON_MAP: Readonly<Record<string, number>> = {
  firstTurn: 0,
  steadyHand: 1,
  tireless: 2,
  wornMotor: 3,
  blueprint: 4,
  eraElectric: 5,
  eraThermal: 6,
  eraResonance: 7,
  eraExotic: 8,
  restoration: 9,
  newCycle: 10,
  longSilence: 12,
  automation: 13,
  bigNumber: 14,
};

function techIdsOf(c: AchievementCondition): TechId[] {
  return c.type === 'tech' ? [c.id] : [];
}

describe('achievement table', () => {
  it('has 31 ids in the contract order', () => {
    expect(ACHIEVEMENT_IDS).toHaveLength(31);
    expect([...ACHIEVEMENT_IDS]).toEqual([
      'firstTurn', 'steadyHand', 'tireless', 'unrelenting', 'shiftWorker', 'wornMotor', 'fullStroke', 'blueprint',
      'tinkerer', 'engineer', 'fullIndex',
      'eraElectric', 'noGrid', 'kilowatt', 'eraThermal', 'ratingExceeded', 'rollingBoil', 'eraResonance',
      'convergence', 'harmonics', 'eraExotic', 'alignment', 'restoration', 'newCycle',
      'shortNap', 'longSilence', 'automation', 'servoChorus', 'sevenDigits', 'thirteenDigits', 'bigNumber',
    ]);
  });

  it('ids are unique', () => {
    expect(new Set(ACHIEVEMENT_IDS).size).toBe(ACHIEVEMENT_IDS.length);
  });

  it('ACHIEVEMENTS maps every id to a definition carrying the same id', () => {
    for (const id of ACHIEVEMENT_IDS) {
      expect(ACHIEVEMENTS[id].id).toBe(id);
    }
  });

  it('ACHIEVEMENT_LIST follows ACHIEVEMENT_IDS order', () => {
    expect(ACHIEVEMENT_LIST.map((d) => d.id)).toEqual([...ACHIEVEMENT_IDS]);
    expect(ACHIEVEMENT_LIST).toHaveLength(31);
  });

  it('every bold ART §9 id carries its suggested icon', () => {
    for (const [id, icon] of Object.entries(ART_ICON_MAP)) {
      const def = ACHIEVEMENTS[id as keyof typeof ACHIEVEMENTS];
      expect(def.icon, id).toBe(icon);
    }
  });

  it('icons are integers 0..15', () => {
    for (const def of ACHIEVEMENT_LIST) {
      expect(Number.isInteger(def.icon), def.id).toBe(true);
      expect(def.icon >= 0 && def.icon <= 15, def.id).toBe(true);
    }
  });

  it('names are at most 24 chars and descriptions at most 60 chars, both non-empty', () => {
    for (const def of ACHIEVEMENT_LIST) {
      expect(def.name.length, def.id).toBeGreaterThan(0);
      expect(def.name.length, def.id).toBeLessThanOrEqual(24);
      expect(def.description.length, def.id).toBeGreaterThan(0);
      expect(def.description.length, def.id).toBeLessThanOrEqual(60);
    }
  });

  it('exactly the four spec secret rows are secret', () => {
    const secret = ACHIEVEMENT_LIST.filter((d) => d.secret === true).map((d) => d.id).sort();
    expect(secret).toEqual(['alignment', 'eraExotic', 'newCycle', 'restoration']);
  });

  it('every tech referenced by a condition exists', () => {
    for (const def of ACHIEVEMENT_LIST) {
      for (const id of techIdsOf(def.condition)) {
        expect(TECH_IDS).toContain(id);
        expect(TECHNOLOGIES[id], def.id).toBeDefined();
      }
    }
  });

  it('every resource referenced by a condition exists or is any', () => {
    for (const def of ACHIEVEMENT_LIST) {
      const c = def.condition;
      if (c.type === 'lifetime') {
        expect(c.res === 'any' || RESOURCE_IDS.includes(c.res), def.id).toBe(true);
      }
      if (c.type === 'maxRate') {
        expect(RESOURCE_IDS.includes(c.res), def.id).toBe(true);
      }
    }
  });

  it('every threshold is a positive finite number', () => {
    for (const def of ACHIEVEMENT_LIST) {
      const c = def.condition;
      if (c.type === 'tech') {
        expect(c.minLevel, def.id).toBeGreaterThan(0);
      } else {
        expect(Number.isFinite(c.atLeast), def.id).toBe(true);
        expect(c.atLeast, def.id).toBeGreaterThan(0);
      }
    }
  });

  it('the servo chorus tech requirement is level 10', () => {
    const c = ACHIEVEMENTS.servoChorus.condition;
    expect(c).toEqual({ type: 'tech', id: 'crankServo', minLevel: 10 });
  });

  it('UI_ART frame numbers and sheet paths', () => {
    expect(UI_ART.badgeFrame).toBe(24);
    expect(UI_ART.iconFrame).toBe(16);
    expect(UI_ART.icon.lock).toBe(3);
    expect(UI_ART.icon.check).toBe(4);
    expect(UI_ART.nineSliceBorder).toBe(8);
    expect(UI_ART.badges).toBe('assets/ui/badges.png');
    expect(UI_ART.badgesLocked).toBe('assets/ui/badges-locked.png');
    expect(UI_ART.icons16).toBe('assets/ui/icons16.png');
    expect(UI_ART.button).toBe('assets/ui/button.png');
    expect(UI_ART.panel).toBe('assets/ui/panel.png');
  });
});

import { describe, it, expect } from 'vitest';
import { MACHINE_COMPONENT_IDS, MACHINE_COMPONENTS } from '../../data/machineComponents';
import { RESOURCE_IDS, TECH_IDS } from '../../data/types';
import { TECHNOLOGIES } from '../../data/technologies';
import { visibleComponentIds } from './machineVisibility';
import { apertureGate, machineFitPose, portraitPose, visualMaxForEra } from './showcase';
import { teaserFrame, teaserLevels, teaserRates } from './teaser';
import type { TeaserEra } from './teaser';

const ERAS: TeaserEra[] = [2, 3, 4, 5];
const PAIRS: [TeaserEra, boolean][] = ERAS.flatMap((era): [TeaserEra, boolean][] => [[era, false], [era, true]]);

describe('teaserLevels', () => {
  it('era V with the aperture open shows all 104 machine parts', () => {
    expect(visibleComponentIds(teaserLevels(5, true)).size).toBe(MACHINE_COMPONENT_IDS.length);
    expect(MACHINE_COMPONENT_IDS.length).toBe(104);
  });

  it('era II with the aperture closed shows no part gated by era III or later', () => {
    for (const id of visibleComponentIds(teaserLevels(2, false))) {
      expect(TECHNOLOGIES[MACHINE_COMPONENTS[id].techId].era).toBeLessThanOrEqual(2);
    }
    const visible = visibleComponentIds(teaserLevels(2, false));
    for (const id of ['boiler', 'spireTower', 'nullChamber', 'aperture'] as const) expect(visible.has(id)).toBe(false);
  });

  it('holds the aperture gate at 0 while closed and at least its minLevel while open', () => {
    const gate = apertureGate();
    expect(teaserLevels(2, false)[gate.techId]).toBe(0);
    expect(teaserLevels(5, false)[gate.techId]).toBe(0);
    expect(teaserLevels(5, true)[gate.techId]).toBeGreaterThanOrEqual(1);
  });

  it('era V closed raises every visual-max tech except the aperture gate', () => {
    const gate = apertureGate();
    const levels = teaserLevels(5, false);
    const floor = visualMaxForEra(5);
    for (const id of TECH_IDS) {
      const want = floor[id];
      if (want === undefined || id === gate.techId) continue;
      expect(levels[id]).toBeGreaterThanOrEqual(want);
    }
  });

  it('keys follow TECH_IDS order', () => {
    expect(Object.keys(teaserLevels(5, true))).toEqual([...TECH_IDS]);
  });

  it('frozen and the same reference on repeat for all 8 era / aperture pairs', () => {
    for (const [era, open] of PAIRS) {
      const first = teaserLevels(era, open);
      expect(Object.isFrozen(first)).toBe(true);
      expect(teaserLevels(era, open)).toBe(first);
    }
  });
});

describe('teaserRates', () => {
  it('every rate is finite and non-negative for all 8 era / aperture pairs', () => {
    for (const [era, open] of PAIRS) {
      const rates = teaserRates(era, open);
      for (const r of RESOURCE_IDS) {
        expect(Number.isFinite(rates[r])).toBe(true);
        expect(rates[r]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('era V with the aperture open out-produces era II in ??? (xf)', () => {
    expect(teaserRates(5, true).xf).toBeGreaterThan(teaserRates(2, false).xf);
  });

  it('the aperture (x3 all) never lowers a rate', () => {
    const open = teaserRates(5, true);
    const closed = teaserRates(5, false);
    for (const r of RESOURCE_IDS) expect(open[r]).toBeGreaterThanOrEqual(closed[r]);
  });

  it('frozen and the same reference on repeat', () => {
    for (const [era, open] of PAIRS) {
      const first = teaserRates(era, open);
      expect(Object.isFrozen(first)).toBe(true);
      expect(teaserRates(era, open)).toBe(first);
    }
  });
});

describe('teaserFrame timeline', () => {
  it('t = 0 starts at era II, aperture closed, no boost, not done, on the era-II fit pose', () => {
    const frame = teaserFrame(0, false);
    expect(frame.era).toBe(2);
    expect(frame.apertureOpen).toBe(false);
    expect(frame.boost).toBe(0);
    expect(frame.done).toBe(false);
    expect(frame.camera).toEqual(machineFitPose(teaserLevels(2, false)));
  });

  it('era steps at 1.0 (III), 2.5 (IV) and 4.0 (V)', () => {
    expect(teaserFrame(0.99, false).era).toBe(2);
    expect(teaserFrame(1.0, false).era).toBe(3);
    expect(teaserFrame(2.49, false).era).toBe(3);
    expect(teaserFrame(2.5, false).era).toBe(4);
    expect(teaserFrame(3.99, false).era).toBe(4);
    expect(teaserFrame(4.0, false).era).toBe(5);
  });

  it('aperture opens at 7.0', () => {
    expect(teaserFrame(6.99, false).apertureOpen).toBe(false);
    expect(teaserFrame(7.0, false).apertureOpen).toBe(true);
  });

  it('done from 9.5', () => {
    expect(teaserFrame(9.49, false).done).toBe(false);
    expect(teaserFrame(9.5, false).done).toBe(true);
  });

  it('levels are the teaserLevels reference for the frame era and aperture', () => {
    for (let t = 0; t <= 12; t += 0.5) {
      const frame = teaserFrame(t, false);
      expect(frame.levels).toBe(teaserLevels(frame.era, frame.apertureOpen));
    }
  });

  it('NaN and negative t read as t = 0', () => {
    const start = teaserFrame(0, false);
    expect(teaserFrame(Number.NaN, false)).toEqual(start);
    expect(teaserFrame(-5, false)).toEqual(start);
    expect(teaserFrame(-5, false).levels).toBe(start.levels);
  });
});

describe('teaser camera', () => {
  it('is the portrait pose from 5.5 on', () => {
    for (let i = 0; i <= 26; i++) {
      const t = 5.5 + i * 0.25;
      expect(teaserFrame(t, false).camera).toEqual(portraitPose());
    }
  });

  it('moves monotonically from the fit pose to the portrait between 0.5 and 5.5 on each axis', () => {
    const fit = machineFitPose(teaserLevels(2, false));
    const portrait = portraitPose();
    for (const axis of ['centerX', 'centerY', 'zoom'] as const) {
      const span = portrait[axis] - fit[axis];
      expect(Math.abs(span)).toBeGreaterThan(0);
      let prev = -Infinity;
      for (let i = 0; i <= 20; i++) {
        const progress = (teaserFrame(0.5 + i * 0.25, false).camera[axis] - fit[axis]) / span;   // 0 at fit, 1 at portrait
        expect(progress).toBeGreaterThanOrEqual(-1e-9);
        expect(progress).toBeLessThanOrEqual(1 + 1e-9);
        expect(progress).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = progress;
      }
    }
  });

  it('reduced motion: the portrait pose at every t', () => {
    for (let i = 0; i <= 24; i++) {
      expect(teaserFrame(i * 0.5, true).camera).toEqual(portraitPose());
    }
  });
});

describe('teaser boost', () => {
  it('is 0 up to 5.5', () => {
    for (const t of [0, 1, 3, 5.5]) expect(teaserFrame(t, false).boost).toBe(0);
  });

  it('rises without falling from 5.5 to 7.0', () => {
    let prev = -Infinity;
    for (let i = 0; i <= 30; i++) {
      const boost = teaserFrame(5.5 + i * 0.05, false).boost;
      expect(boost).toBeGreaterThanOrEqual(prev);
      prev = boost;
    }
    expect(teaserFrame(6.25, false).boost).toBeGreaterThan(0);
    expect(teaserFrame(6.25, false).boost).toBeLessThan(1);
  });

  it('is 1 from 7.0 on', () => {
    for (const t of [7.0, 7.5, 9.5, 12]) expect(teaserFrame(t, false).boost).toBe(1);
  });

  it('does not depend on reduced motion', () => {
    for (const t of [0, 6.25, 12]) expect(teaserFrame(t, true).boost).toBe(teaserFrame(t, false).boost);
  });
});

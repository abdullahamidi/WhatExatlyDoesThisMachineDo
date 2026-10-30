// Tests for pokeRender (WP28a r1-FixA, moved from worldPlayback): the Sensor 7 pointer head (freshness, range and change gap), the clip clock of
// the poke overlays, the crow hop arc (its duration, apex and box refusal) and the crow's flight and landing frames. Pure maths, no Phaser.
// The moved functions had no tests in worldPlayback.test.ts, so these pin them as they stand.
import { describe, it, expect } from 'vitest';
import { clipIndexAt, crowArcY, crowFlightFrame, crowHopSpec, crowLandFrame, middlePerch, sensorHeadFromPointer } from './pokeRender';
import type { HopPoint, HopSpan } from './pokeRender';
import { WORLD_ENV } from '../../data/livingWorld';
import type { FramingKey } from '../../data/livingWorld';
import { CROW_HOP, CROW_MACHINE_X, CROW_PERCHES, POKE_RENDER } from '../../data/pokes';
import type { CrowPerch } from '../../data/pokes';

describe('sensorHeadFromPointer', () => {
  const tripodX = 1384;
  const now = 10000;
  const fresh = now - 1;
  const range = WORLD_ENV.sensor7.headRangeWorldPx;

  it('shows the camera side while the pointer is off the canvas, not a number, or stale', () => {
    expect(sensorHeadFromPointer(null, fresh, now, tripodX, 'headL', 'headC', Number.NEGATIVE_INFINITY)).toBe('headL');
    expect(sensorHeadFromPointer(Number.NaN, fresh, now, tripodX, 'headR', 'headC', Number.NEGATIVE_INFINITY)).toBe('headR');
    expect(sensorHeadFromPointer(tripodX + range + 1, now - POKE_RENDER.pointerFreshMs, now, tripodX, 'headL', 'headC',
      Number.NEGATIVE_INFINITY)).toBe('headL');
  });

  it('looks right past the range, left past it, and center inside it (edges included)', () => {
    expect(sensorHeadFromPointer(tripodX + range + 1, fresh, now, tripodX, 'headC', 'headC', Number.NEGATIVE_INFINITY)).toBe('headR');
    expect(sensorHeadFromPointer(tripodX - range - 1, fresh, now, tripodX, 'headC', 'headC', Number.NEGATIVE_INFINITY)).toBe('headL');
    expect(sensorHeadFromPointer(tripodX + range, fresh, now, tripodX, 'headR', 'headC', Number.NEGATIVE_INFINITY)).toBe('headC');
    expect(sensorHeadFromPointer(tripodX - range, fresh, now, tripodX, 'headL', 'headC', Number.NEGATIVE_INFINITY)).toBe('headC');
  });

  it('holds the last head for a change inside pointerChangeGapMs, and changes once the gap has passed', () => {
    const justChanged = now - (POKE_RENDER.pointerChangeGapMs - 1);
    const gapPassed = now - POKE_RENDER.pointerChangeGapMs;
    expect(sensorHeadFromPointer(tripodX + range + 1, fresh, now, tripodX, 'headC', 'headC', justChanged)).toBe('headC');
    expect(sensorHeadFromPointer(tripodX + range + 1, fresh, now, tripodX, 'headC', 'headC', gapPassed)).toBe('headR');
  });

  it('never waits on the gap when the head is already the wanted one', () => {
    expect(sensorHeadFromPointer(tripodX, fresh, now, tripodX, 'headC', 'headC', now)).toBe('headC');
  });
});

describe('clipIndexAt', () => {
  it('is -1 for an empty clip', () => {
    expect(clipIndexAt([], 0)).toBe(-1);
  });

  it('shows each frame for its time, and the last frame holds past the end', () => {
    const frameMs = [100, 200, 300];
    expect(clipIndexAt(frameMs, 0)).toBe(0);
    expect(clipIndexAt(frameMs, 99)).toBe(0);
    expect(clipIndexAt(frameMs, 100)).toBe(1);
    expect(clipIndexAt(frameMs, 299)).toBe(1);
    expect(clipIndexAt(frameMs, 300)).toBe(2);
    expect(clipIndexAt(frameMs, 10000)).toBe(2);
  });

  it('a one-frame clip is that frame for any time', () => {
    expect(clipIndexAt([50], 0)).toBe(0);
    expect(clipIndexAt([50], 999)).toBe(0);
  });
});

describe('crowArcY', () => {
  it('starts at the from point and ends at the to point', () => {
    expect(crowArcY(100, 200, 48, 0)).toBe(100);
    expect(crowArcY(100, 200, 48, 1)).toBe(200);
  });

  it('peaks apexPx above the higher end at the middle of a level hop', () => {
    expect(crowArcY(100, 100, 20, 0.5)).toBe(80);
  });

  it('peaks at the higher end when the apex is zero (the middle of a sloping hop)', () => {
    expect(crowArcY(100, 200, 0, 0.5)).toBe(100);
  });
});

describe('crowHopSpec', () => {
  const machine = { left: 1200, right: 1500 };

  it('refuses a zero distance and a distance above CROW_HOP.maxDistPx', () => {
    expect(crowHopSpec(100, 500, 100, 500, machine, null)).toBeNull();
    expect(crowHopSpec(100, 500, 100 + CROW_HOP.maxDistPx + 1, 500, machine, null)).toBeNull();
  });

  it('refuses an arc whose x-range meets the machine span', () => {
    expect(crowHopSpec(1150, 500, 1210, 500, machine, null)).toBeNull();
    expect(crowHopSpec(1210, 500, 1150, 500, machine, null)).toBeNull();
  });

  it('a hop wholly left of the machine is allowed, with the duration and apex of its length', () => {
    const spec = crowHopSpec(100, 500, 200, 500, machine, null);
    expect(spec).not.toBeNull();
    expect(spec?.durMs).toBe(625);
    expect(spec?.apexPx).toBe(Math.min(CROW_HOP.apexMaxPx, CROW_HOP.apexPerDist * 100 + CROW_HOP.apexAddPx));
  });

  it('a short hop takes the minimum duration', () => {
    expect(crowHopSpec(100, 500, 140, 500, machine, null)?.durMs).toBe(CROW_HOP.minMs);
  });

  it('refuses an arc that dips into the box it crosses, and allows one that stays above it', () => {
    const feet = 300;
    expect(crowHopSpec(100, feet, 200, feet, machine, { x0: 0, x1: 500, top: 290 })).toBeNull();
    expect(crowHopSpec(100, feet, 200, feet, machine, { x0: 0, x1: 500, top: 400 })).not.toBeNull();
    expect(crowHopSpec(100, feet, 200, feet, machine, { x0: 600, x1: 700, top: 290 })).not.toBeNull();
  });
});

describe('crowFlightFrame', () => {
  const step = 1000 / CROW_HOP.flyFps;

  it('shows the first flight frame for fly0Ms, forward or reversed', () => {
    expect(crowFlightFrame(0, false)).toBe(CROW_HOP.flyFrames[0]);
    expect(crowFlightFrame(CROW_HOP.fly0Ms - 1, true)).toBe(CROW_HOP.flyFrames[CROW_HOP.flyFrames.length - 1]);
  });

  it('then alternates the other two frames at flyFps, forward', () => {
    expect(crowFlightFrame(CROW_HOP.fly0Ms, false)).toBe(CROW_HOP.flyFrames[1]);
    expect(crowFlightFrame(CROW_HOP.fly0Ms + 1.5 * step, false)).toBe(CROW_HOP.flyFrames[2]);
    expect(crowFlightFrame(CROW_HOP.fly0Ms + 2.5 * step, false)).toBe(CROW_HOP.flyFrames[1]);
  });

  it('plays the flight frames in reverse order in era V', () => {
    const reversed = [...CROW_HOP.flyFrames].reverse();
    expect(crowFlightFrame(CROW_HOP.fly0Ms + 1.5 * step, true)).toBe(reversed[2]);
  });
});

describe('crowLandFrame', () => {
  const [perch, ruffle] = CROW_HOP.landFrames;

  it('lands on perch0, ruffles for landMs, then holds perch0', () => {
    expect(crowLandFrame(0, false)).toBe(perch);
    expect(crowLandFrame(CROW_HOP.landMs, false)).toBe(ruffle);
    expect(crowLandFrame(2 * CROW_HOP.landMs, false)).toBe(perch);
    expect(crowLandFrame(10 * CROW_HOP.landMs, false)).toBe(perch);
  });

  it('ruffles first in era V (reversed), then holds perch0', () => {
    expect(crowLandFrame(0, true)).toBe(ruffle);
    expect(crowLandFrame(CROW_HOP.landMs, true)).toBe(perch);
  });

  it('reads a negative or non-finite time as the first slot', () => {
    expect(crowLandFrame(-5, false)).toBe(perch);
    expect(crowLandFrame(Number.NaN, false)).toBe(perch);
  });
});

// The middle perch of a two-hop landing (R6): the real perch lists and machine spans, and a small synthetic path for the refusals.
describe('middlePerch (R6)', () => {
  const listOf = (f: FramingKey): readonly CrowPerch[] => CROW_PERCHES[f] ?? [];
  const perch = (f: FramingKey, id: string): CrowPerch => {
    const p = listOf(f).find((q) => q.id === id);
    if (p === undefined) throw new Error(`no ${f} perch ${id}`);
    return p;
  };
  const indexOf = (f: FramingKey, id: string): number => listOf(f).findIndex((q) => q.id === id);
  const span = (f: FramingKey): HopSpan => {
    const m = CROW_MACHINE_X[f];
    if (m === undefined) throw new Error(`no ${f} machine span`);
    return m;
  };
  // Both hops of the path from a to m and m to b are at most maxDistPx and clear the span (crowHopSpec with no box).
  const pathOk = (a: HopPoint, m: HopPoint, b: HopPoint, machine: HopSpan): boolean =>
    crowHopSpec(a.x, a.y, m.x, m.y, machine, null) !== null && crowHopSpec(m.x, m.y, b.x, b.y, machine, null) !== null;

  it('the s9 and s11 bicycle seats (229 and 262 px from the lamp top) and the s11 bell frame (182 px) go through the sign top', () => {
    for (const [f, id] of [['s9', 'bicycleSeat'], ['s11', 'bicycleSeat'], ['s11', 'bellFrame']] as const) {
      const mid = middlePerch(listOf(f), perch(f, 'lampTop'), indexOf(f, id), span(f));
      expect(listOf(f)[mid]?.id, `${f} ${id}`).toBe('signTop');
      expect(pathOk(perch(f, 'lampTop'), perch(f, 'signTop'), perch(f, id), span(f)), `${f} ${id} path`).toBe(true);
    }
  });

  it('the s9 groundDog (161 px, one px out of reach) goes through the sign top, the smallest total of the three middles (165 px)', () => {
    expect(listOf('s9')[middlePerch(listOf('s9'), perch('s9', 'lampTop'), indexOf('s9', 'groundDog'), span('s9'))]?.id).toBe('signTop');
  });

  it('the e1 bicycle seat (180 px from the lamp top) goes through the clock top (47 + 159.4 px, R6)', () => {
    const mid = middlePerch(listOf('e1'), perch('e1', 'lampTop'), indexOf('e1', 'bicycleSeat'), span('e1'));
    expect(listOf('e1')[mid]?.id).toBe('clockTop');
    expect(pathOk(perch('e1', 'lampTop'), perch('e1', 'clockTop'), perch('e1', 'bicycleSeat'), span('e1'))).toBe(true);
  });

  it('every Splice top in the real perch lists is one hop or two from the lamp top (R6)', () => {
    for (const f of Object.keys(CROW_PERCHES) as FramingKey[]) {
      const list = listOf(f);
      const lamp = list.find((q) => q.id === 'lampTop');
      if (lamp === undefined) continue;
      list.forEach((p, index) => {
        if (p.spliceTop === undefined) return;
        expect(crowHopSpec(lamp.x, lamp.y, p.x, p.y, span(f), null) !== null || middlePerch(list, lamp, index, span(f)) >= 0, `${f} ${p.id}`).toBe(true);
      });
    }
  });

  it('a target one hop from the crow needs no middle perch: the e1 booth roof and clock top (57 and 47 px) return -1', () => {
    expect(middlePerch(listOf('e1'), perch('e1', 'lampTop'), indexOf('e1', 'boothRoof'), span('e1'))).toBe(-1);
    expect(middlePerch(listOf('e1'), perch('e1', 'lampTop'), indexOf('e1', 'clockTop'), span('e1'))).toBe(-1);
  });

  it('no path gives -1: no perch between the two, or the only one too far from either', () => {
    const machine = { left: 1000, right: 1100 };
    const from = { x: 0, y: 500 };
    expect(middlePerch([from, { x: 300, y: 500 }], from, 1, machine)).toBe(-1);
    expect(middlePerch([from, { x: 150, y: 300 }, { x: 300, y: 500 }], from, 2, machine)).toBe(-1);
  });

  it('never a path whose hop crosses the machine span: a middle perch under the span is refused, and the same perch clear of it is taken', () => {
    const from = { x: 0, y: 500 };
    const list = [from, { x: 150, y: 500 }, { x: 300, y: 500 }];
    expect(middlePerch(list, from, 2, { left: 100, right: 200 })).toBe(-1);
    expect(middlePerch(list, from, 2, { left: 400, right: 500 })).toBe(1);
  });

  it('every middle perch of the real lists is reached by two hops of at most maxDistPx that clear the machine span, and the direct hop is out of reach', () => {
    for (const f of Object.keys(CROW_PERCHES) as FramingKey[]) {
      const perches = listOf(f);
      perches.forEach((from, i) => perches.forEach((to, j) => {
        if (i === j) return;
        const mid = middlePerch(perches, from, j, span(f));
        if (mid < 0) return;
        const m = perches[mid];
        if (m === undefined) throw new Error(`${f} middle ${mid}`);
        expect(pathOk(from, m, to, span(f)), `${f} ${from.x} to ${to.x}`).toBe(true);
        expect(crowHopSpec(from.x, from.y, to.x, to.y, span(f), null), `${f} direct`).toBeNull();
      }));
    }
  });
});

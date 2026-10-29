// Tests for pokeRender (WP28a r1-FixA, moved from worldPlayback): the Sensor 7 pointer head (freshness, range and change gap), the clip clock of
// the poke overlays, the crow hop arc (its duration, apex and box refusal) and the crow's flight and landing frames. Pure maths, no Phaser.
// The moved functions had no tests in worldPlayback.test.ts, so these pin them as they stand.
import { describe, it, expect } from 'vitest';
import { clipIndexAt, crowArcY, crowFlightFrame, crowHopSpec, crowLandFrame, sensorHeadFromPointer } from './pokeRender';
import { WORLD_ENV } from '../../data/livingWorld';
import { CROW_HOP, POKE_RENDER } from '../../data/pokes';

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

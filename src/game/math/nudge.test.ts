import { describe, it, expect } from 'vitest';
import { nudgeCenter } from './nudge';
import { CAMERA_NUDGE } from '../../data/ux';

// WP20 camera nudge: inner box = view / zoom * innerFraction (0.5), step = 0.35 of the offset, capped at 160 world px.
const VIEW = { width: 1280, height: 720 };
const CENTER = { x: 1000, y: 1000 };

describe('nudgeCenter', () => {
  it('returns null when the target sits inside the inner box', () => {
    expect(nudgeCenter(CENTER, 1, { x: 1010, y: 1010 }, VIEW, CAMERA_NUDGE)).toBeNull();
  });

  it('returns null exactly on the inner box edge', () => {
    // half width at zoom 1 is 1280 / 1 * 0.5 / 2 = 320
    expect(nudgeCenter(CENTER, 1, { x: 1320, y: 1000 }, VIEW, CAMERA_NUDGE)).toBeNull();
  });

  it('steps 35% of the offset when the step is under the cap', () => {
    const next = nudgeCenter(CENTER, 1, { x: 1400, y: 1000 }, VIEW, CAMERA_NUDGE);
    expect(next?.x).toBeCloseTo(1140, 5);
    expect(next?.y).toBeCloseTo(1000, 5);
  });

  it('caps the step at maxWorldPx', () => {
    const next = nudgeCenter(CENTER, 1, { x: 1640, y: 1000 }, VIEW, CAMERA_NUDGE);
    expect(next?.x).toBeCloseTo(1160, 5);
    expect(next?.y).toBeCloseTo(1000, 5);
  });

  it('keeps the direction when the diagonal step is capped', () => {
    // offset (800, 600) -> step (280, 210), length 350 -> scaled to 160: (128, 96)
    const next = nudgeCenter(CENTER, 1, { x: 1800, y: 1600 }, VIEW, CAMERA_NUDGE);
    expect(next?.x).toBeCloseTo(1128, 5);
    expect(next?.y).toBeCloseTo(1096, 5);
  });

  it('pans on one axis when only that axis is outside the box', () => {
    // dx 10 is inside; dy 400 -> step (3.5, 140)
    const next = nudgeCenter(CENTER, 1, { x: 1010, y: 1400 }, VIEW, CAMERA_NUDGE);
    expect(next?.x).toBeCloseTo(1003.5, 5);
    expect(next?.y).toBeCloseTo(1140, 5);
  });

  it('zoom 0.5 doubles the inner box', () => {
    // half width at zoom 0.5 is 1280 / 0.5 * 0.5 / 2 = 640
    expect(nudgeCenter(CENTER, 0.5, { x: 1600, y: 1000 }, VIEW, CAMERA_NUDGE)).toBeNull();
    expect(nudgeCenter(CENTER, 1, { x: 1600, y: 1000 }, VIEW, CAMERA_NUDGE)).not.toBeNull();
  });

  it('mirrors negative directions', () => {
    const left = nudgeCenter(CENTER, 1, { x: 600, y: 1000 }, VIEW, CAMERA_NUDGE);
    expect(left?.x).toBeCloseTo(860, 5);
    expect(left?.y).toBeCloseTo(1000, 5);
    const capped = nudgeCenter(CENTER, 1, { x: 360, y: 1000 }, VIEW, CAMERA_NUDGE);
    expect(capped?.x).toBeCloseTo(840, 5);
    const diagonal = nudgeCenter(CENTER, 1, { x: 200, y: 400 }, VIEW, CAMERA_NUDGE);
    expect(diagonal?.x).toBeCloseTo(872, 5);
    expect(diagonal?.y).toBeCloseTo(904, 5);
  });
});

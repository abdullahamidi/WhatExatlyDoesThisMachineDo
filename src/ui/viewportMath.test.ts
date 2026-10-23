import { describe, it, expect } from 'vitest';
import { uiZoom, rootBox, cssPx } from './viewportMath';
import type { Box } from './viewportMath';

describe('uiZoom', () => {
  it.each([
    [720, 100, 1],
    [800, 100, 1.1111],
    [1080, 100, 1.5],
    [1440, 100, 2],
    [2160, 100, 3],
    [720, 125, 1.25],
    [720, 150, 1.5],
    [800, 150, 1.6667],
    [1080, 150, 2.25],
    [1440, 150, 3],
    [2160, 150, 4.5],
    [540, 100, 1],
    [540, 150, 1.5],
    [0, 100, 1],
    [NaN, 125, 1.25],
    [720, NaN, 1],
    [99999, 150, 6],
  ])('canvasH %s, uiScale %s -> %s', (canvasH, uiScale, expected) => {
    expect(uiZoom(canvasH, uiScale)).toBe(expected);
  });

  it('treats a non-positive or non-finite UI scale as 100 percent', () => {
    expect(uiZoom(1440, 0)).toBe(2);
    expect(uiZoom(1440, -50)).toBe(2);
    expect(uiZoom(1440, Infinity)).toBe(2);
  });

  it('never returns more than maxZoom', () => {
    expect(uiZoom(10000, 400)).toBe(6);
  });
});

describe('rootBox', () => {
  it('divides every field by the zoom', () => {
    const rect: Box = { left: 440, top: 0, width: 2560, height: 1440 };
    expect(rootBox(rect, 2)).toEqual({ left: 220, top: 0, width: 1280, height: 720 });
  });

  it.each([0, NaN, -2])('zoom %s counts as 1 and returns the input values', (zoom) => {
    const rect: Box = { left: 440, top: 12, width: 2560, height: 1440 };
    expect(rootBox(rect, zoom)).toEqual({ left: 440, top: 12, width: 2560, height: 1440 });
  });
});

describe('cssPx', () => {
  it('rounds to 3 decimals and appends px', () => {
    expect(cssPx(12.3456)).toBe('12.346px');
    expect(cssPx(0)).toBe('0px');
    expect(cssPx(1280)).toBe('1280px');
  });
});

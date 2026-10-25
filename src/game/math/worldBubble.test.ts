// Tests for worldBubble (WP23a): bubble duration and max width, and the placement ladder on the DENIZEN_ART §4.2 cases, with the
// F21 slid above / below steps. The table numbers are on-screen px at UI 150, so they are divided by 1.5 for the CSS px the maths
// uses. Pure maths, no Phaser.
import { describe, it, expect } from 'vitest';
import { bubbleDurationMs, bubbleMaxWidth, placeBubble, sideY, slideOrder, slideX } from './worldBubble';
import type { Rect } from './worldPlacement';
import type { Vec2 } from '../../data/machineComponents';
import { WORLD_BUBBLE } from '../../data/livingWorld';

const UI150 = 1.5;
const css = (onScreenPx: number): number => onScreenPx / UI150;
const VIEW_150 = { w: 1280 / UI150, h: 720 / UI150 };   // 853.33 x 480 CSS px
const VIEW_100 = { w: 1280, h: 720 };
const BODY = { w: 200, h: 46 };   // 2 lines of 18 px + 5 px padding top and bottom, at the 200 px CSS max width
const ABOVE_OFFSET = 60;          // gap 6 + tail 8 + body 46: the body top sits 60 px above the head top

// Era I HUD panel: x 24-443, bottom 298 on screen (the lowest of the s0-s7 range).
const PANEL_I: Rect = { x: css(24), y: 0, w: css(443) - css(24), h: css(298) };
// Era II s9 HUD panel: x 24-443, bottom 364 on screen.
const PANEL_II: Rect = { x: css(24), y: 0, w: css(443) - css(24), h: css(364) };
// The button row starts at x 712 on screen.
const BUTTONS: Rect = { x: css(712), y: css(600), w: 200, h: 40 };

describe('bubbleDurationMs', () => {
  it('clamps the empty line up to the minimum', () => {
    expect(bubbleDurationMs('')).toBe(3500);
  });

  it('is base + 55 ms per character inside the clamp', () => {
    expect(bubbleDurationMs('a'.repeat(52))).toBe(5460);
    expect(bubbleDurationMs('a'.repeat(30))).toBe(4250);
  });

  it('clamps a long line to the maximum', () => {
    expect(bubbleDurationMs('a'.repeat(200))).toBe(6500);
  });
});

describe('bubbleMaxWidth', () => {
  it('gives the on-screen width per UI scale', () => {
    expect(bubbleMaxWidth(100)).toBe(200);
    expect(bubbleMaxWidth(125)).toBe(250);
    expect(bubbleMaxWidth(150)).toBe(300);
  });
});

describe('placeBubble ladder', () => {
  it('era I: the head is clear above the panel, so the bubble goes above with the tail clamped at its middle', () => {
    // Box top 365 on screen (DENIZEN_ART §4.2 table): the head top sits 60 px below it.
    const head = { x: 600, y: css(365) + ABOVE_OFFSET };
    const feet = { x: 600, y: head.y + 100 };
    expect(placeBubble(head, feet, BODY, [PANEL_I], VIEW_150)).toEqual(
      { x: 500, y: 243, tailX: 100, side: 'above', tailUp: false },
    );
  });

  it('era II s9 Inspector: the above box collides with the panel, so the bubble goes below the feet', () => {
    // Head top 353 on screen, feet at the table's below-feet row (498 on screen = feet + gap).
    const head = { x: 200, y: css(353) };
    const feet = { x: 200, y: css(489) };
    expect(placeBubble(head, feet, BODY, [PANEL_II, BUTTONS], VIEW_150)).toEqual(
      { x: 100, y: 340, tailX: 100, side: 'below', tailUp: true },
    );
  });

  it('tail clamp near the left edge: the body is clamped to the inset and the tail slides, still above', () => {
    const head = { x: 30, y: 300 };
    const feet = { x: 30, y: 400 };
    expect(placeBubble(head, feet, BODY, [PANEL_I], VIEW_150)).toEqual(
      { x: 8, y: 240, tailX: 22, side: 'above', tailUp: false },
    );
  });

  it('head outside the clamp at the left edge: the right wing, tail at its near corner', () => {
    // The tail would land 7 px from the body left (< tailMargin 10), so the centred and slid boxes fail; the left wing is off screen.
    // The side step tries the head-aligned y first (F21): the body top sits on the head line, 246, clear of everything.
    const head = { x: 15, y: 300 };
    const feet = { x: 15, y: 400 };
    expect(placeBubble(head, feet, BODY, [], VIEW_150)).toEqual(
      { x: 29, y: 246, tailX: 10, side: 'side', tailUp: false, sideY: 'head' },
    );
  });

  it('head outside the clamp at the right edge: the left wing, tail at its right corner', () => {
    // Head-aligned y first (F21): 246. The centred y (327) is only the fallback when the head line is blocked.
    const head = { x: 840, y: 300 };
    const feet = { x: 840, y: 400 };
    expect(placeBubble(head, feet, BODY, [], VIEW_150)).toEqual(
      { x: 626, y: 246, tailX: 190, side: 'side', tailUp: false, sideY: 'head' },
    );
  });

  it('below fails at the bottom edge, so the right wing is taken', () => {
    const head = { x: 600, y: 300 };
    const feet = { x: 600, y: 440 };
    const aboveBlock: Rect = { x: 500, y: 200, w: 300, h: 60 };   // covers the above box
    expect(placeBubble(head, feet, BODY, [aboveBlock], VIEW_150)).toEqual(
      { x: 614, y: 347, tailX: 10, side: 'side', tailUp: false, sideY: 'centred' },
    );
  });

  it('a blocked right wing falls to the left wing', () => {
    const head = { x: 600, y: 300 };
    const feet = { x: 600, y: 440 };
    const reserved: Rect[] = [
      { x: 500, y: 200, w: 300, h: 60 },    // covers the above box
      { x: 614, y: 340, w: 220, h: 100 },   // covers the right wing
    ];
    expect(placeBubble(head, feet, BODY, reserved, VIEW_150)).toEqual(
      { x: 386, y: 347, tailX: 190, side: 'side', tailUp: false, sideY: 'centred' },
    );
  });

  it('side step: the head-aligned y is clamped into the viewport near the top', () => {
    // Head-aligned y would be -54 (head.y - h - tailH): clamped to the inset, 8. Head first (F21), so sideY is 'head'.
    const head = { x: 15, y: 0 };
    const feet = { x: 15, y: 10 };
    expect(placeBubble(head, feet, BODY, [], VIEW_150)).toEqual(
      { x: 29, y: 8, tailX: 10, side: 'side', tailUp: false, sideY: 'head' },
    );
  });

  it('everything blocked gives null', () => {
    const head = { x: 600, y: 300 };
    const feet = { x: 600, y: 400 };
    const all: Rect[] = [{ x: 0, y: 0, w: VIEW_150.w, h: VIEW_150.h }];
    expect(placeBubble(head, feet, BODY, all, VIEW_150)).toBeNull();
  });

  it('a body larger than the inset viewport gives null', () => {
    expect(placeBubble({ x: 300, y: 300 }, { x: 300, y: 400 }, { w: 900, h: 46 }, [], VIEW_150)).toBeNull();
  });

  it('the viewport decides the clamp: the same head is above at 1280x720 and a side bubble at 853.33x480', () => {
    const head = { x: 840, y: 300 };
    const feet = { x: 840, y: 400 };
    expect(placeBubble(head, feet, BODY, [], VIEW_100)).toEqual(
      { x: 740, y: 240, tailX: 100, side: 'above', tailUp: false },
    );
    expect(placeBubble(head, feet, BODY, [], VIEW_150)?.side).toBe('side');
  });

  it('1280x720: a head at the right edge clamps the body to the right inset, the tail stays in range', () => {
    expect(placeBubble({ x: 1200, y: 300 }, { x: 1200, y: 400 }, BODY, [], VIEW_100)).toEqual(
      { x: 1072, y: 240, tailX: 128, side: 'above', tailUp: false },
    );
  });

  it('x and y are whole numbers after rounding', () => {
    const p = placeBubble({ x: 600.4, y: 300.6 }, { x: 600.4, y: 400 }, BODY, [], VIEW_100);
    expect(p).not.toBeNull();
    if (p === null) return;
    expect(Number.isInteger(p.x)).toBe(true);
    expect(Number.isInteger(p.y)).toBe(true);
    expect(p.x).toBe(500);
    expect(p.y).toBe(241);
    expect(p.tailX).toBeCloseTo(100.4, 10);
  });
});

describe('side step y candidates (AD2c F18)', () => {
  it('UI 100: the centred above box hits the crow; the box slid left clears the crow and the dog and puts the tail on the head', () => {
    // s9 payphone (the AD2c F18 case). The centred above box (x 1056) hits the crow, the centred below box hits the dog. Slid left
    // (F21): x = ceil(1224 - 206) = 1018, the tail tip at 206 = the head x. Above wins before any side step, so the side y is not reached.
    const head = { x: 1224, y: 459 };
    const feet = { x: 1224, y: 492 };
    const reserved: Rect[] = [{ x: 1234, y: 380, w: 18, h: 24 }, { x: 1129, y: 485, w: 18, h: 24 }];
    expect(placeBubble(head, feet, { w: 216, h: 46 }, reserved, VIEW_100)).toEqual(
      { x: 1018, y: 399, tailX: 206, side: 'above', tailUp: false, slide: 'L' },
    );
  });

  it('UI 150: the head-aligned y fits the left wing when the centred y is blocked', () => {
    const head = { x: 816, y: 306 };
    const feet = { x: 816, y: 328 };
    const reserved: Rect[] = [{ x: 823, y: 253, w: 12, h: 16 }, { x: 753, y: 323, w: 12, h: 16 }];
    expect(placeBubble(head, feet, { w: 216, h: 46 }, reserved, { w: 853, h: 480 })).toEqual(
      { x: 586, y: 252, tailX: 206, side: 'side', tailUp: false, sideY: 'head' },
    );
  });

  it('s8 PAY-01 at UI 150: the centred y hits the reserve under the feet; the head-aligned y is clear', () => {
    const head = { x: 804, y: 355 };
    const feet = { x: 804, y: 384 };
    const reserved: Rect[] = [{ x: 813, y: 280, w: 16, h: 16 }, { x: 779, y: 380, w: 16, h: 16 }];
    expect(placeBubble(head, feet, { w: 216, h: 46 }, reserved, { w: 853, h: 480 })).toEqual(
      { x: 574, y: 301, tailX: 206, side: 'side', tailUp: false, sideY: 'head' },
    );
  });

  it('head y wins when clear: the above and below boxes (centred and slid) are blocked, the head-aligned side box is free', () => {
    // A rect in the band x 1210-1250 blocks the centred and slid above and below boxes (x 1018-1272) and the centred side box is
    // not needed: the head-aligned side box (x 994-1210, y 405-459) is clear, so it wins (F21: head y first).
    const head = { x: 1224, y: 459 };
    const feet = { x: 1224, y: 492 };
    const reserved: Rect[] = [{ x: 1210, y: 380, w: 40, h: 140 }];
    expect(placeBubble(head, feet, { w: 216, h: 46 }, reserved, VIEW_100)).toEqual(
      { x: 994, y: 405, tailX: 206, side: 'side', tailUp: false, sideY: 'head' },
    );
  });

  it('centred y only when the head-aligned y is blocked: a rect on the head line leaves the centred side box free', () => {
    // Same band as above, plus a rect at x 1100-1140, y 400-420: it cuts the head-aligned side box (y 405-459) but not the centred one
    // (y 453-507). The above and below boxes are blocked as before, so the side step runs: head y blocked, centred y free.
    const head = { x: 1224, y: 459 };
    const feet = { x: 1224, y: 492 };
    const reserved: Rect[] = [{ x: 1210, y: 380, w: 40, h: 140 }, { x: 1100, y: 400, w: 40, h: 20 }];
    expect(placeBubble(head, feet, { w: 216, h: 46 }, reserved, VIEW_100)).toEqual(
      { x: 994, y: 453, tailX: 206, side: 'side', tailUp: false, sideY: 'centred' },
    );
  });

  it('with no reserved rects the above step wins for that head, so the side step is not reached', () => {
    expect(placeBubble({ x: 1224, y: 459 }, { x: 1224, y: 492 }, { w: 216, h: 46 }, [], VIEW_100)).toEqual(
      { x: 1056, y: 399, tailX: 168, side: 'above', tailUp: false },
    );
  });

  it('sideY: centred is round(midpoint - h / 2) and head is head.y - h - tailH, both clamped', () => {
    const head = { x: 1224, y: 459 };
    const feet = { x: 1224, y: 492 };
    expect(sideY('centred', head, feet, 46, 720)).toBe(453);   // round(475.5 - 23) = round(452.5)
    expect(sideY('head', head, feet, 46, 720)).toBe(405);      // 459 - 46 - 8
    expect(sideY('centred', { x: 0, y: 0 }, { x: 0, y: 10 }, 46, 480)).toBe(8);     // -18 -> inset
    expect(sideY('head', { x: 0, y: 0 }, { x: 0, y: 10 }, 46, 480)).toBe(8);        // -54 -> inset
    expect(sideY('head', { x: 0, y: 900 }, { x: 0, y: 910 }, 46, 480)).toBe(418);   // floor(480 - 8 - 46 - 8)
  });

  it('both y modes blocked on both wings gives null', () => {
    // The band x 380-840 covers the above, below and both side boxes (centred and head) at every y.
    const head = { x: 600, y: 300 };
    const feet = { x: 600, y: 400 };
    const band: Rect[] = [{ x: 380, y: 0, w: 460, h: 480 }];
    expect(placeBubble(head, feet, { w: 200, h: 46 }, band, { w: 853, h: 480 })).toBeNull();
  });
});

// F21: the above / below boxes slid onto a short head. The centred box is the first try; the slid box keeps the tail on the head
// when the centred box is blocked (DOG-02 at s7 used to fall to a side box with its tail on bare ground).
describe('slid above / below (F21)', () => {
  const DOG02_HEAD = { x: 723.33, y: 344 };
  const DOG02_FEET = { x: 723.33, y: 368.67 };
  const VIEW_DOG02 = { w: 853.33, h: 480 };
  const DOG02_RESERVED: Rect[] = [
    { x: 16, y: 16, w: 270, h: 182.67 },          // HUD panel
    { x: 474.67, y: 426, w: 362.67, h: 38 },      // buttons
    { x: 362.67, y: 208, w: 128, h: 128 },        // crank circle + 24
    { x: 437.33, y: 106.67, w: 133.33, h: 80 },   // gain block
    { x: 769.33, y: 312, w: 16, h: 16 },          // payphone receiver head (the centred above box hits it)
    { x: 789.33, y: 245.33, w: 16, h: 16 },       // crow head
    { x: 88, y: 298.67, w: 48, h: 16 },           // Inspector head
    { x: 61.33, y: 297.33, w: 16, h: 16 },        // Sensor 7 head
  ];

  it('(a) DOG-02 at s7, UI 150: the centred boxes are blocked, the box slid left puts the tail tip on the head', () => {
    // Slid left: x = ceil(723.33 - 206) = 518, tail tip 518 + 205.33 = 723.33. Above wins, so the side step is not reached.
    const p = placeBubble(DOG02_HEAD, DOG02_FEET, { w: 216, h: 46 }, DOG02_RESERVED, VIEW_DOG02);
    expect(p).not.toBeNull();
    if (p === null) return;
    expect(p).toMatchObject({ x: 518, y: 284, side: 'above', tailUp: false, slide: 'L' });
    expect(p.tailX).toBeCloseTo(205.33, 2);
    expect(Math.abs(p.x + p.tailX - DOG02_HEAD.x)).toBeLessThanOrEqual(1);
  });

  it('slideX: L and R are the body lefts that put the tail tip at the far and near ends, clamped to the inset', () => {
    expect(slideX('L', { x: 600, y: 0 }, 200, VIEW_100)).toBe(410);       // ceil(600 - 190)
    expect(slideX('R', { x: 600, y: 0 }, 200, VIEW_100)).toBe(590);       // floor(600 - 10)
    expect(slideX('L', { x: 723.33, y: 0 }, 216, VIEW_150)).toBe(518);    // ceil(723.33 - 206)
    expect(slideX('R', { x: 840, y: 0 }, 200, VIEW_150)).toBe(645);       // floor(830) clamped to 853.33 - 8 - 200
    expect(slideX('L', { x: 15, y: 0 }, 200, VIEW_150)).toBe(8);          // ceil(-175) clamped to the inset
    expect(slideX('R', { x: 15, y: 0 }, 200, VIEW_150)).toBe(8);          // floor(5) clamped to the inset
  });

  it('slideX matches the x placeBubble returns for slide L and slide R (no controller)', () => {
    const left = placeBubble(DOG02_HEAD, DOG02_FEET, { w: 216, h: 46 }, DOG02_RESERVED, VIEW_DOG02);
    expect(left?.slide).toBe('L');
    expect(left?.x).toBe(slideX('L', DOG02_HEAD, 216, VIEW_DOG02));
    // Head (300, 300), 200x46. A rect at 250-270 x 250-270 blocks the centred above box and the L above box; a rect at 250-270
    // x 420-440 blocks the centred below box. The R above box (x 290-490) clears both, and it is tried before any below box.
    const headR = { x: 300, y: 300 };
    const reservedR: Rect[] = [{ x: 250, y: 250, w: 20, h: 20 }, { x: 250, y: 420, w: 20, h: 20 }];
    const right = placeBubble(headR, { x: 300, y: 400 }, { w: 200, h: 46 }, reservedR, VIEW_100);
    expect(right).toEqual({ x: 290, y: 240, tailX: 10, side: 'above', tailUp: false, slide: 'R' });
    expect(right?.x).toBe(slideX('R', headR, 200, VIEW_100));
  });

  it('inward-first order: the right half tries L first, the left half R first (the half line counts as right)', () => {
    // The order is a tie-break that cannot change a placement (see slideOrder), so it is pinned here directly.
    expect(slideOrder({ x: 900, y: 0 }, VIEW_100)).toEqual(['L', 'R']);
    expect(slideOrder({ x: 640, y: 0 }, VIEW_100)).toEqual(['L', 'R']);
    expect(slideOrder({ x: 300, y: 0 }, VIEW_100)).toEqual(['R', 'L']);
  });

  it('a slid box whose tail leaves [tailMargin, w - tailMargin] is dropped: no above box with the tail off its body', () => {
    // Head x 840 in 853.33: the L box clamps to x 645 with its tail at 195 (> 190), so it is dropped. Without the drop the clear box
    // at 645 would win with its tail off the body. The side wing takes over.
    const p = placeBubble({ x: 840, y: 300 }, { x: 840, y: 400 }, BODY, [], VIEW_150);
    expect(p?.side).toBe('side');
    expect(p?.slide).toBeUndefined();
  });

  it('slid below is used when the slid above boxes are blocked', () => {
    // Head x 600 (left half: R first). A band at y 200-260 (x 400-800) blocks the centred and both slid above boxes. A rect at x 500-540,
    // y 420-440 blocks the centred below box and the slid L below box; the slid R below box (x 590-790) clears it.
    const head = { x: 600, y: 300 };
    const feet = { x: 600, y: 400 };
    const reserved: Rect[] = [{ x: 400, y: 200, w: 400, h: 60 }, { x: 500, y: 420, w: 40, h: 20 }];
    expect(placeBubble(head, feet, { w: 200, h: 46 }, reserved, VIEW_100)).toEqual(
      { x: 590, y: 414, tailX: 10, side: 'below', tailUp: true, slide: 'R' },
    );
  });

  it('every above / below result has its tail tip within 1 px of head.x and inside the tail range', () => {
    const cases: { head: Vec2; feet: Vec2; size: { w: number; h: number }; reserved: Rect[]; vp: { w: number; h: number } }[] = [
      { head: { x: 600, y: css(365) + ABOVE_OFFSET }, feet: { x: 600, y: css(365) + ABOVE_OFFSET + 100 }, size: BODY, reserved: [PANEL_I], vp: VIEW_150 },
      { head: { x: 200, y: css(353) }, feet: { x: 200, y: css(489) }, size: BODY, reserved: [PANEL_II, BUTTONS], vp: VIEW_150 },
      { head: { x: 30, y: 300 }, feet: { x: 30, y: 400 }, size: BODY, reserved: [PANEL_I], vp: VIEW_150 },
      { head: DOG02_HEAD, feet: DOG02_FEET, size: { w: 216, h: 46 }, reserved: DOG02_RESERVED, vp: VIEW_DOG02 },
      { head: { x: 1224, y: 459 }, feet: { x: 1224, y: 492 }, size: { w: 216, h: 46 }, vp: VIEW_100,
        reserved: [{ x: 1234, y: 380, w: 18, h: 24 }, { x: 1129, y: 485, w: 18, h: 24 }] },
      { head: { x: 1224, y: 459 }, feet: { x: 1224, y: 492 }, size: { w: 216, h: 46 }, reserved: [], vp: VIEW_100 },
      { head: { x: 840, y: 300 }, feet: { x: 840, y: 400 }, size: BODY, reserved: [], vp: VIEW_100 },
      { head: { x: 1200, y: 300 }, feet: { x: 1200, y: 400 }, size: BODY, reserved: [], vp: VIEW_100 },
      { head: { x: 600, y: 300 }, feet: { x: 600, y: 400 }, size: { w: 200, h: 46 }, vp: VIEW_100,
        reserved: [{ x: 400, y: 200, w: 400, h: 60 }, { x: 500, y: 420, w: 40, h: 20 }] },
      { head: { x: 300, y: 300 }, feet: { x: 300, y: 400 }, size: { w: 200, h: 46 }, vp: VIEW_100,
        reserved: [{ x: 250, y: 250, w: 20, h: 20 }, { x: 250, y: 420, w: 20, h: 20 }] },
      { head: { x: 600.4, y: 300.6 }, feet: { x: 600.4, y: 400 }, size: BODY, reserved: [], vp: VIEW_100 },
    ];
    let vertical = 0;
    for (const c of cases) {
      const p = placeBubble(c.head, c.feet, c.size, c.reserved, c.vp);
      if (p === null || p.side === 'side') continue;
      vertical += 1;
      expect(Math.abs(p.x + p.tailX - c.head.x)).toBeLessThanOrEqual(1);
      expect(p.tailX).toBeGreaterThanOrEqual(WORLD_BUBBLE.tailMargin);
      expect(p.tailX).toBeLessThanOrEqual(c.size.w - WORLD_BUBBLE.tailMargin);
    }
    expect(vertical).toBe(11);   // every listed case is an above / below result, so the loop checks all of them
  });
});

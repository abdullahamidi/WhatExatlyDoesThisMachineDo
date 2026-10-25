// Speech bubble maths (WP23a, DENIZEN_ART §4.2, F21): duration and max width of a living-world line, and the placement ladder
// (centred above, centred below, slid above, slid below, side: head y then centred y). Why: the paper bubble must stay off the HUD,
// toasts, buttons and crank rects while its tail still points at the speaker, and the rules must be unit-tested without the DOM.
// All geometry is in root CSS px (the caller divides client px by the UI zoom). Numbers come from src/data/livingWorld.ts
// (WORLD_BUBBLE, WORLD_VOICE_CONFIG). Pure: no Phaser, no DOM.
import type { Vec2 } from '../../data/machineComponents';
import type { UiScale } from '../../data/types';
import { WORLD_BUBBLE, WORLD_VOICE_CONFIG } from '../../data/livingWorld';
import type { Rect } from './worldPlacement';

export type BubbleSide = 'above' | 'below' | 'side';

/** How a side bubble's y is chosen: centred on the head-feet midpoint, or with its body top on the head line (AD2c F18). */
export type SideYMode = 'centred' | 'head';

/** Slide of an above / below box onto a short head (F21): 'L' = the box extends left of the head, its tail at the right end;
 *  'R' = it extends right, its tail at the left end. Absent = the centred x. */
export type BubbleSlide = 'L' | 'R';

/** x, y = body top-left; tailX = tail tip x measured from the body left; tailUp = tail on the top edge.
 *  sideY is set only when side === 'side': the y mode that was used, so the per-frame follow keeps it.
 *  slide is set only when side is above or below and the box was slid: the per-frame follow keeps it. */
export interface BubblePlacement { x: number; y: number; tailX: number; side: BubbleSide; tailUp: boolean; sideY?: SideYMode; slide?: BubbleSlide }

/** Time a line stays up: base + per character, clamped to bubbleMinMs..bubbleMaxMs (bible §7.1). */
export function bubbleDurationMs(text: string): number {
  const c = WORLD_VOICE_CONFIG;
  return Math.min(c.bubbleMaxMs, Math.max(c.bubbleMinMs, c.bubbleBaseMs + c.bubblePerCharMs * text.length));
}

/** Max bubble width on screen for a UI scale (200 / 250 / 300 px). The CSS max-width is WORLD_BUBBLE.cssMaxWidth. */
export function bubbleMaxWidth(uiScale: UiScale): number {
  return WORLD_BUBBLE.widthByScale[uiScale];
}

// Overlap of two rects; touching edges do not overlap.
function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

// Body left x for a wanted left x: kept inside the viewport inset (the right bound is floored, so the result is an integer).
function clampedX(wantX: number, w: number, viewport: { w: number; h: number }): number {
  const inset = WORLD_BUBBLE.inset;
  const hi = Math.floor(viewport.w - inset - w);
  return Math.round(Math.min(Math.max(wantX, inset), hi));
}

/**
 * Body left x of an above / below box slid onto the head (F21). 'L': the tail tip sits tailMargin in from the box's right end,
 * x = ceil(head.x - (w - tailMargin)). 'R': the tail tip sits tailMargin in from the left end, x = floor(head.x - tailMargin).
 * Clamped to the viewport inset like every body x, so the caller checks the tail range after this (placeBubble and the
 * controller's per-frame follow both call this one formula).
 */
export function slideX(slide: BubbleSlide, head: Vec2, w: number, viewport: { w: number; h: number }): number {
  const { tailMargin } = WORLD_BUBBLE;
  return slide === 'L'
    ? clampedX(Math.ceil(head.x - (w - tailMargin)), w, viewport)
    : clampedX(Math.floor(head.x - tailMargin), w, viewport);
}

/**
 * Order the slides are tried in (F21): the wing toward the centre of the viewport first, so head.x >= w / 2 tries 'L' then 'R',
 * else 'R' then 'L'. A tie-break only: when both slid boxes are clear, the centred box (it lies inside their union) is clear too
 * and was already tried, so the order cannot change a result. Exported so the test can pin it.
 */
export function slideOrder(head: Vec2, viewport: { w: number; h: number }): readonly BubbleSlide[] {
  return head.x >= viewport.w / 2 ? ['L', 'R'] : ['R', 'L'];
}

/**
 * Body top y of a side bubble of height h in a viewport of height viewH. 'centred': the body centre on the head-feet midpoint.
 * 'head': the body top on the head line, so the tail end sits on the head top (AD2c F18: this fits where the centred y
 * collides with another face). Both clamped so the body and its tail stay on screen: the clamp is
 * Math.min(Math.max(v, inset), Math.floor(viewH - inset - h - tailH)), then rounded.
 */
export function sideY(mode: SideYMode, head: Vec2, feet: Vec2, h: number, viewH: number): number {
  const { inset, tailH } = WORLD_BUBBLE;
  const want = mode === 'centred' ? (head.y + feet.y) / 2 - h / 2 : head.y - h - tailH;
  const hi = Math.floor(viewH - inset - h - tailH);
  return Math.round(Math.min(Math.max(want, inset), hi));
}

// Head-aligned first (F21): its tail ends on the head line, which is the case the centred y cannot reach for a short speaker.
const SIDE_Y_MODES: readonly SideYMode[] = ['head', 'centred'];

// Step 5: a wing beside the speaker, the tail at the near corner. x is not clamped: a wing that does not fit is skipped
// (a clamped body would cover the speaker). Per wing that passes the x rule, the y modes are tried in order (head-aligned, then
// centred); the first box clear of every reserved rect wins. y is clamped inside sideY() so the body stays on screen.
function sidePlacement(
  head: Vec2, feet: Vec2, size: { w: number; h: number }, reserved: readonly Rect[], viewport: { w: number; h: number },
): BubblePlacement | null {
  const { inset, tailH, tailMargin, sideOffset } = WORLD_BUBBLE;
  const { w, h } = size;
  // Outward wing first: left when the head is in the left half of the viewport.
  const wings: readonly ('left' | 'right')[] = head.x < viewport.w / 2 ? ['left', 'right'] : ['right', 'left'];
  for (const wing of wings) {
    const x = Math.round(wing === 'left' ? head.x - sideOffset - w : head.x + sideOffset);
    if (x < inset || x + w > viewport.w - inset) continue;
    for (const mode of SIDE_Y_MODES) {
      const y = sideY(mode, head, feet, h, viewport.h);
      const box: Rect = { x, y, w, h: h + tailH };   // the tail hangs below the body, so it counts as occupied
      if (reserved.some((r) => overlaps(box, r))) continue;
      return { x, y, tailX: wing === 'left' ? w - tailMargin : tailMargin, side: 'side', tailUp: false, sideY: mode };
    }
  }
  return null;
}

// The slide key is written only when a slide is set: an absent key keeps the centred shape of the placement.
function slideTag(slide: BubbleSlide | undefined): { slide?: BubbleSlide } {
  return slide === undefined ? {} : { slide };
}

// Above step at body x (tail down): the tail tip inside [tailMargin, w - tailMargin], the body top under the inset, and the box
// (tail included) clear of every reserved rect. Null when any test fails.
function aboveAt(
  head: Vec2, size: { w: number; h: number }, x: number, slide: BubbleSlide | undefined, reserved: readonly Rect[],
): BubblePlacement | null {
  const { gap, tailH, inset, tailMargin } = WORLD_BUBBLE;
  const { w, h } = size;
  const tailX = head.x - x;
  if (tailX < tailMargin || tailX > w - tailMargin) return null;
  const y = Math.round(head.y - gap - tailH - h);
  const box: Rect = { x, y, w, h: h + tailH };
  if (y < inset || reserved.some((r) => overlaps(box, r))) return null;
  return { x, y, tailX, side: 'above', tailUp: false, ...slideTag(slide) };
}

// Below step at body x (tail up): the same tail range and reserved test, with the body bottom inside the viewport inset.
function belowAt(
  head: Vec2, feet: Vec2, size: { w: number; h: number }, x: number, slide: BubbleSlide | undefined, reserved: readonly Rect[],
  viewport: { w: number; h: number },
): BubblePlacement | null {
  const { gap, tailH, inset, tailMargin } = WORLD_BUBBLE;
  const { w, h } = size;
  const tailX = head.x - x;
  if (tailX < tailMargin || tailX > w - tailMargin) return null;
  const y = Math.round(feet.y + gap + tailH);
  const box: Rect = { x, y: y - tailH, w, h: h + tailH };   // the tail sits above the body here
  if (y + h > viewport.h - inset || reserved.some((r) => overlaps(box, r))) return null;
  return { x, y, tailX, side: 'below', tailUp: true, ...slideTag(slide) };
}

/**
 * Placement ladder (DENIZEN_ART §4.2, F21) for a bubble of size w x h at a speaker (head top, feet). Step 1: the centred box above
 * the head, tail down, gap between the tail tip and the head. Step 2: the centred box below the feet, tail up. Step 3: the box
 * above, slid onto the head (slideX): every slide above, inward first (slideOrder), before any below. Step 4: the same below.
 * Every step needs the tail tip inside [tailMargin, w - tailMargin] from the body left, the box (with its tail) clear of every
 * reserved rect, and the body inside the viewport inset. Step 5: the side wings, outward first; each wing tries a head-aligned y,
 * then a centred y (sideY). Null when all five steps fail.
 */
export function placeBubble(
  head: Vec2, feet: Vec2, size: { w: number; h: number }, reserved: readonly Rect[], viewport: { w: number; h: number },
): BubblePlacement | null {
  const { inset, tailH } = WORLD_BUBBLE;
  const { w, h } = size;
  if (w > viewport.w - 2 * inset || h + tailH > viewport.h - 2 * inset) return null;
  const x = clampedX(head.x - w / 2, w, viewport);
  const centred = aboveAt(head, size, x, undefined, reserved) ?? belowAt(head, feet, size, x, undefined, reserved, viewport);
  if (centred !== null) return centred;
  // Slid candidates in slideOrder; a repeated x is skipped. The slid steps run even when the centred tail was out of range.
  const slid: { slide: BubbleSlide; x: number }[] = [];
  for (const slide of slideOrder(head, viewport)) {
    const sx = slideX(slide, head, w, viewport);
    if (!slid.some((c) => c.x === sx)) slid.push({ slide, x: sx });
  }
  for (const c of slid) {
    const p = aboveAt(head, size, c.x, c.slide, reserved);
    if (p !== null) return p;
  }
  for (const c of slid) {
    const p = belowAt(head, feet, size, c.x, c.slide, reserved, viewport);
    if (p !== null) return p;
  }
  return sidePlacement(head, feet, size, reserved, viewport);
}

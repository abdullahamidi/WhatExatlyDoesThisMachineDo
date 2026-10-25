// World speech bubble controller (WP23a, DENIZEN_ART 4.2, WP23 A7 / D6). DOM and pure maths only: no Phaser.
// Places the two pooled bubbles of WorldVoiceView at a speaker's head (game px, 1280x720) with the ladder of worldBubble.ts, keeping
// off the HUD panel, toasts, buttons, hint, era card, the crank circle + 24 and the gain spawn block. Every frame each shown bubble
// follows its live anchor with transform only (view.move). The ladder is re-checked at most every ladderRecheckMs with hysteresis:
// the placement (side, side y mode, slide) stays while it still fits. A slot whose head leaves the inset view (or whose anchor is
// null) fades out and is reported.
// Why: one owner for the bubble geometry, so no renderer or director touches DOM rects or the UI zoom. The canvas, the root and
// the reserved rects are read with getBoundingClientRect only at show() and at the recheck cadence, never per frame.
import type { BubblePlacement, BubbleSide, BubbleSlide, SideYMode } from '../game/math/worldBubble';
import { placeBubble, sideY, slideX } from '../game/math/worldBubble';
import type { Rect, SpeakerAnchor } from '../game/math/worldPlacement';
import { screenOfWorld } from '../game/math/worldPlacement';
import type { CameraPose } from '../game/math/finale';
import { CRANK_FEEDBACK, FLOATING_TEXT, PIXEL_SCALE, VIEW } from '../data/world';
import { WORLD_BUBBLE, WORLD_LAYOUT, WORLD_VOICE_CONFIG } from '../data/livingWorld';
import type { SpeakerId } from '../data/livingWorld';
import type { UiScale } from '../data/types';
import type { Vec2 } from '../data/machineComponents';
import type { WorldVoiceView } from './worldVoice';

export interface BubbleRequest { slot: 0 | 1; text: string; speaker: SpeakerId; anchor: () => SpeakerAnchor | null }

export interface BubbleControllerDeps {
  root: HTMLElement;
  view: WorldVoiceView;
  canvas: () => HTMLCanvasElement | null;
  uiZoom: () => number;
  uiScale: () => UiScale;
  camera: () => CameraPose;
  /** Game px head boxes of every other visible ground denizen (not the speaker). Read at show and at the recheck only. A line
   *  never covers another face (AD2 F2 / F16). Optional: without it only the static rects and the other slot are reserved. */
  reservedHeads?: (exclude: SpeakerId) => readonly Rect[];
}

export interface WorldBubbleController {
  /** Places and shows a line. 'blocked' (nothing shown, a shown line in that slot stays) when the head is off the inset view,
   *  the anchor is null, or no ladder step fits. */
  show(req: BubbleRequest, nowMs: number): 'shown' | 'blocked';
  /** Per frame: follows the live anchors, re-checks the ladder every ladderRecheckMs. Returns the slots whose anchor left the
   *  inset view; those are already faded out, the caller applies the 60 percent rule with visibleMs. */
  update(nowMs: number): number[];
  hide(slot: 0 | 1, instant?: boolean): void;
  hideAll(instant?: boolean): void;
  visible(slot?: 0 | 1): boolean;
  /** Time the slot's line has been up; frozen at the hide (or the off-view fade) once it is down. 0 before any line. */
  visibleMs(slot: 0 | 1, nowMs: number): number;
  /** Last line written to the slot. */
  text(slot: 0 | 1): string;
  side(slot: 0 | 1): BubbleSide | null;
  /** Box in #ui-root CSS px while shown, else null. */
  rect(slot: 0 | 1): Rect | null;
  destroy(): void;
}

interface Size { w: number; h: number }

// Cached layout of one refresh. Game px -> root CSS px: x * kx + ox, y * ky + oy. vw / vh: the root size (the viewport).
interface Geo {
  kx: number; ky: number; ox: number; oy: number;
  vw: number; vh: number;
  reserved: Rect[];   // DOM rects, crank circle and gain block, root CSS px
}

interface SlotState {
  req: BubbleRequest | null;   // set while the slot shows a line
  side: BubbleSide;
  wing: 'left' | 'right';
  sideY: SideYMode;            // y mode of a side line (AD2c F18), kept by the per-frame follow
  slide: BubbleSlide | null;   // slide of an above / below line (F21), kept by the per-frame follow
  x: number; y: number;        // last written body origin, root CSS px
  w: number; h: number;        // measured body size, CSS px
  startMs: number | null;      // visibleMs window
  endMs: number | null;        // set when the slot goes down
}

const SLOT_IDS: readonly (0 | 1)[] = [0, 1];
// Ids of the #ui-root elements the bubble avoids (a missing or empty element reserves nothing).
const RESERVED_DOM_IDS: readonly string[] = ['hud-panel', 'toast-stack', 'hud-buttons', 'hud-hint', 'era-card'];
const { gap, tailH, inset, tailMargin, sideOffset } = WORLD_BUBBLE;

function freshSlot(): SlotState {
  return { req: null, side: 'above', wing: 'right', sideY: 'centred', slide: null, x: 0, y: 0, w: 0, h: 0, startMs: null, endMs: null };
}

function otherOf(slot: 0 | 1): 0 | 1 {
  return slot === 0 ? 1 : 0;
}

// Overlap of two rects; touching edges do not overlap (the rule of worldBubble.ts).
function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

// Box of a bubble with its tail, as the ladder checks it: the tail hangs below the body, or above it when the bubble sits below the feet.
function boxOf(side: BubbleSide, x: number, y: number, size: Size): Rect {
  return side === 'below'
    ? { x, y: y - tailH, w: size.w, h: size.h + tailH }
    : { x, y, w: size.w, h: size.h + tailH };
}

// Body left for a wanted left x, kept inside the viewport inset (the clamp of worldBubble.ts).
function clampedLeft(wantX: number, w: number, vp: Size): number {
  const hi = Math.floor(vp.w - inset - w);
  return Math.round(Math.min(Math.max(wantX, inset), hi));
}

// Geometry of one given side for a live anchor: the same numbers as placeBubble, without the search. The per-frame follow keeps the
// side, a side line's y mode (a head-aligned line stays on the head line, it does not snap to the centred y) and an above / below
// line's slide (a slid line keeps its tail on the head: the same slideX formula, so it does not snap back to the centred x).
function placementOf(
  side: BubbleSide, wing: 'left' | 'right', mode: SideYMode, slide: BubbleSlide | null, head: Vec2, feet: Vec2, size: Size, vp: Size,
): BubblePlacement {
  if (side === 'side') {
    const left = wing === 'left';
    const x = Math.round(left ? head.x - sideOffset - size.w : head.x + sideOffset);
    const y = sideY(mode, head, feet, size.h, vp.h);
    return { x, y, tailX: left ? size.w - tailMargin : tailMargin, side, tailUp: false, sideY: mode };
  }
  const x = slide === null ? clampedLeft(head.x - size.w / 2, size.w, vp) : slideX(slide, head, size.w, vp);
  const tailX = head.x - x;
  const tag: { slide?: BubbleSlide } = slide === null ? {} : { slide };
  if (side === 'above') return { x, y: Math.round(head.y - gap - tailH - size.h), tailX, side, tailUp: false, ...tag };
  return { x, y: Math.round(feet.y + gap + tailH), tailX, side, tailUp: true, ...tag };
}

// Hysteresis test: the current placement is kept while its box (tail included) is inside the viewport inset, its tail still
// lands on the body (above and below), and it clears every reserved rect.
function fits(p: BubblePlacement, size: Size, reserved: readonly Rect[], vp: Size): boolean {
  const box = boxOf(p.side, p.x, p.y, size);
  if (box.x < inset || box.y < inset || box.x + box.w > vp.w - inset || box.y + box.h > vp.h - inset) return false;
  if (p.side !== 'side' && (p.tailX < tailMargin || p.tailX > size.w - tailMargin)) return false;
  return !reserved.some((r) => overlaps(box, r));
}

// Wing of a side placement from its tail: the left wing's tail sits on the right half of the body.
function wingOf(p: BubblePlacement, w: number): 'left' | 'right' {
  return p.tailX > w / 2 ? 'left' : 'right';
}

// Head point inside the view inset (game px): the only on-screen test a line starts with and a live bubble keeps.
function headInView(p: Vec2): boolean {
  const i = WORLD_VOICE_CONFIG.viewInsetPx;
  return p.x >= i && p.x <= VIEW.width - i && p.y >= i && p.y <= VIEW.height - i;
}

function toCss(g: Geo, p: Vec2): Vec2 {
  return { x: p.x * g.kx + g.ox, y: p.y * g.ky + g.oy };
}

function gameRectToCss(g: Geo, x: number, y: number, w: number, h: number): Rect {
  return { x: x * g.kx + g.ox, y: y * g.ky + g.oy, w: w * g.kx, h: h * g.ky };
}

export function createWorldBubbleController(deps: BubbleControllerDeps): WorldBubbleController {
  const state: [SlotState, SlotState] = [freshSlot(), freshSlot()];
  let geo: Geo | null = null;
  let lastRecheckMs = 0;
  let clockMs = 0;
  let destroyed = false;

  // The only layout reads of the controller: canvas, root, the reserved DOM rects, then the crank circle and the gain block from the
  // camera. Called at show() and at most every ladderRecheckMs. Null while the canvas or the root is not laid out.
  function readGeo(): Geo | null {
    const canvas = deps.canvas();
    if (canvas === null) return null;
    const c = canvas.getBoundingClientRect();
    const r = deps.root.getBoundingClientRect();
    const zoom = deps.uiZoom();
    if (!(c.width > 0 && c.height > 0 && r.width > 0 && r.height > 0 && zoom > 0)) return null;
    deps.view.setZoom(zoom);
    const g: Geo = {
      kx: c.width / (VIEW.width * zoom), ky: c.height / (VIEW.height * zoom),
      ox: (c.left - r.left) / zoom, oy: (c.top - r.top) / zoom,
      vw: r.width / zoom, vh: r.height / zoom, reserved: [],
    };
    for (const id of RESERVED_DOM_IDS) {
      const el = document.getElementById(id);
      if (el === null) continue;
      const b = el.getBoundingClientRect();
      if (b.width <= 0 || b.height <= 0) continue;
      g.reserved.push({ x: (b.left - r.left) / zoom, y: (b.top - r.top) / zoom, w: b.width / zoom, h: b.height / zoom });
    }
    const cam = deps.camera();
    const hub = screenOfWorld(WORLD_LAYOUT.crankHub, 1, cam);
    const radius = (CRANK_FEEDBACK.hitRadius * PIXEL_SCALE + WORLD_LAYOUT.crankClearPx) * cam.zoom;
    g.reserved.push(gameRectToCss(g, hub.x - radius, hub.y - radius, 2 * radius, 2 * radius));
    const gx = WORLD_LAYOUT.crankHub.x + FLOATING_TEXT.spawnOffset.x - WORLD_LAYOUT.gainBox.w / 2;
    const gy = WORLD_LAYOUT.crankHub.y + FLOATING_TEXT.spawnOffset.y - WORLD_LAYOUT.gainBox.h;
    const p0 = screenOfWorld({ x: gx, y: gy }, 1, cam);
    const p1 = screenOfWorld({ x: gx + WORLD_LAYOUT.gainBox.w, y: gy + WORLD_LAYOUT.gainBox.h }, 1, cam);
    g.reserved.push(gameRectToCss(g, Math.min(p0.x, p1.x), Math.min(p0.y, p1.y), Math.abs(p1.x - p0.x), Math.abs(p1.y - p0.y)));
    return g;
  }

  // Reserved rects for one slot: the static ones, the other slot's box while it shows (two lines never stack), and the head
  // boxes of the other ground denizens (a line never covers another face). Called at show() and at the recheck, never per frame.
  function reservedFor(slot: 0 | 1, speaker: SpeakerId, g: Geo): readonly Rect[] {
    const other = state[otherOf(slot)];
    const heads = (deps.reservedHeads?.(speaker) ?? []).map((r) => gameRectToCss(g, r.x, r.y, r.w, r.h));
    if (other.req === null) return [...g.reserved, ...heads];
    return [...g.reserved, boxOf(other.side, other.x, other.y, other), ...heads];
  }

  function hideSlot(slot: 0 | 1, instant: boolean): void {
    const s = state[slot];
    if (s.req !== null) {
      s.req = null;
      s.endMs = clockMs;
    }
    deps.view.hide(slot, instant);
  }

  function show(req: BubbleRequest, nowMs: number): 'shown' | 'blocked' {
    if (destroyed) return 'blocked';
    clockMs = nowMs;
    const anchor = req.anchor();
    const fresh = readGeo();
    if (fresh !== null) geo = fresh;
    lastRecheckMs = nowMs;
    const g = geo;
    if (anchor === null || g === null || !headInView(anchor.head)) return 'blocked';
    const head = toCss(g, anchor.head);
    const feet = toCss(g, anchor.feet);
    const size = deps.view.measure(req.text, WORLD_BUBBLE.cssMaxWidth);
    const place = placeBubble(head, feet, size, reservedFor(req.slot, req.speaker, g), { w: g.vw, h: g.vh });
    if (place === null) return 'blocked';
    deps.view.show(req.slot, req.text, place, WORLD_BUBBLE.cssMaxWidth);
    const s = state[req.slot];
    s.req = req;
    s.side = place.side;
    s.sideY = place.sideY ?? 'centred';
    s.slide = place.slide ?? null;
    s.wing = wingOf(place, size.w);
    s.x = place.x;
    s.y = place.y;
    s.w = size.w;
    s.h = size.h;
    s.startMs = nowMs;
    s.endMs = null;
    return 'shown';
  }

  function update(nowMs: number): number[] {
    const off: number[] = [];
    if (destroyed || (state[0].req === null && state[1].req === null)) return off;
    clockMs = nowMs;
    const due = nowMs < lastRecheckMs || nowMs - lastRecheckMs >= WORLD_VOICE_CONFIG.ladderRecheckMs;
    if (due) {
      lastRecheckMs = nowMs;
      const fresh = readGeo();
      if (fresh !== null) geo = fresh;
    }
    for (const slot of SLOT_IDS) {
      const s = state[slot];
      const req = s.req;
      if (req === null) continue;
      const anchor = req.anchor();
      if (anchor === null || !headInView(anchor.head)) {
        hideSlot(slot, false);
        off.push(slot);
        continue;
      }
      const g = geo;
      if (g === null) continue;
      const vp: Size = { w: g.vw, h: g.vh };
      const size: Size = { w: s.w, h: s.h };
      const head = toCss(g, anchor.head);
      const feet = toCss(g, anchor.feet);
      let pos = placementOf(s.side, s.wing, s.sideY, s.slide, head, feet, size, vp);
      if (due) {
        const reserved = reservedFor(slot, req.speaker, g);
        if (!fits(pos, size, reserved, vp)) {
          const next = placeBubble(head, feet, size, reserved, vp);
          if (next !== null) pos = next;   // no step fits: keep the followed position
        }
      }
      s.side = pos.side;
      s.sideY = pos.sideY ?? 'centred';
      s.slide = pos.slide ?? null;
      s.wing = wingOf(pos, size.w);
      s.x = pos.x;
      s.y = pos.y;
      deps.view.move(slot, pos);
    }
    return off;
  }

  return {
    show,
    update,
    hide(slot: 0 | 1, instant = false): void {
      if (destroyed) return;
      hideSlot(slot, instant);
    },
    hideAll(instant = false): void {
      if (destroyed) return;
      hideSlot(0, instant);
      hideSlot(1, instant);
    },
    visible(slot?: 0 | 1): boolean {
      if (slot !== undefined) return state[slot].req !== null;
      return state[0].req !== null || state[1].req !== null;
    },
    visibleMs(slot: 0 | 1, nowMs: number): number {
      const s = state[slot];
      if (s.startMs === null) return 0;
      return Math.max(0, (s.endMs ?? nowMs) - s.startMs);
    },
    text(slot: 0 | 1): string {
      return deps.view.text(slot);
    },
    side(slot: 0 | 1): BubbleSide | null {
      const s = state[slot];
      return s.req === null ? null : s.side;
    },
    rect(slot: 0 | 1): Rect | null {
      return deps.view.rect(slot);
    },
    destroy(): void {
      if (destroyed) return;
      hideSlot(0, true);
      hideSlot(1, true);
      destroyed = true;
    },
  };
}

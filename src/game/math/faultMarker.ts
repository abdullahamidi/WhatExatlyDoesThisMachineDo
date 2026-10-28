import { FAULT_MARKER, FAULT_TEXT } from '../../data/faultMarker';
import type { MachineComponentId } from '../../data/machineComponents';
import type { EraNumber } from '../../data/eras';
import type { EndingPhase } from '../../data/types';

// WP27 Machine Faults, the marker maths (C9). Pure: the eligibility gates, the anchor and code choice, the flicker
// frames, the hit zone size, the timer bar and the fade. The renderer (game/rendering/FaultMarker.ts) only places
// sprites with these numbers, so the rules are testable with plain Vitest. Every number comes from src/data/faults.ts or src/data/faultMarker.ts.

/** Everything that hides the marker or freezes the fault clock. All must be clear for a fault to show and to tick. */
export interface FaultGates {
  tabHidden: boolean; photoActive: boolean; techTreeOpen: boolean; eraCardShown: boolean; modalOpen: boolean;
  cycleBusy: boolean; teaserOn: boolean; demoCardOpen: boolean; endingPhase: EndingPhase; enabled: boolean;
}

/**
 * True only when the player can see and act on the machine: no overlay, no era card, no cycle transition, no
 * ending sequence or choice, and faults switched on. A fault never ticks or shows behind any of them.
 */
export function faultEligible(g: FaultGates): boolean {
  return !g.tabHidden && !g.photoActive && !g.techTreeOpen && !g.eraCardShown && !g.modalOpen && !g.cycleBusy
    && !g.teaserOn && !g.demoCardOpen && g.endingPhase === 'none' && g.enabled;
}

/**
 * The wrapped slot of serial in a list of n entries, 0..n-1, also for negative serials. A non-finite serial counts
 * as 0. The modulo keeps the anchor and the code deterministic, so the choice draws no RNG (the sims stay in step).
 */
function slotOf(serial: number, n: number): number {
  const k = Number.isFinite(serial) ? Math.floor(serial) : 0;
  return ((k % n) + n) % n;
}

/**
 * The anchor part of a fault: the era's anchor at the serial's slot when it is on screen, else the era's other anchor
 * in list order, else FAULT_MARKER.fallbackAnchor. Null when none of them is on screen; the fault then waits (not eligible).
 */
export function pickAnchor(era: EraNumber, serial: number, onScreen: (id: MachineComponentId) => boolean): MachineComponentId | null {
  const list: readonly MachineComponentId[] = FAULT_MARKER.anchors[era];
  const start = slotOf(serial, list.length);
  const preferred = list[start];
  if (preferred !== undefined && onScreen(preferred)) return preferred;
  for (let j = 0; j < list.length; j++) {
    if (j === start) continue;
    const id = list[j];
    if (id !== undefined && onScreen(id)) return id;
  }
  return onScreen(FAULT_MARKER.fallbackAnchor) ? FAULT_MARKER.fallbackAnchor : null;
}

/**
 * The code text of a fault: FAULT_TEXT.codes[era] at the serial's slot. Same serial, same code, every time.
 * The slot is always inside the list; the `?? ''` only satisfies the indexed-access type.
 */
export function faultCode(era: EraNumber, serial: number): string {
  const codes: readonly string[] = FAULT_TEXT.codes[era];
  return codes[slotOf(serial, codes.length)] ?? '';
}

/**
 * The flicker phase, 0 or 1: the fault art alternates every FAULT_MARKER.art.frameMs (340 ms, 2.9 Hz, never above 3 Hz).
 * A negative or non-finite clock reads as 0. Reduced motion holds phase 0, so the marker never flashes.
 */
function framePhase(nowMs: number, reducedMotion: boolean): 0 | 1 {
  if (reducedMotion) return 0;
  const ms = Number.isFinite(nowMs) ? Math.max(0, nowMs) : 0;
  // Two frames alternate (tag[0]/tag[1], fx[era][0]/fx[era][1]): phase 1 on every odd frame slot.
  return Math.floor(ms / FAULT_MARKER.art.frameMs) % 2 === 1 ? 1 : 0;
}

/** The tag sprite frame at nowMs (FAULT_MARKER.art.tag). No allocation: the renderer calls it every frame. */
export function faultTagFrame(nowMs: number, reducedMotion: boolean): number {
  return FAULT_MARKER.art.tag[framePhase(nowMs, reducedMotion)];
}

/** The FX sprite frame of `era` at nowMs (FAULT_MARKER.art.fx). No allocation: the renderer calls it every frame. */
export function faultFxFrame(nowMs: number, era: EraNumber, reducedMotion: boolean): number {
  return FAULT_MARKER.art.fx[era][framePhase(nowMs, reducedMotion)];
}

/** Both frames at once. Allocates an object, so tests and the debug readout only; the renderer uses the two above. */
export function faultFrames(nowMs: number, era: EraNumber, reducedMotion: boolean): { tag: number; fx: number } {
  return { tag: faultTagFrame(nowMs, reducedMotion), fx: faultFxFrame(nowMs, era, reducedMotion) };
}

/**
 * The side of the hit zone in world px: at least minScreenPx on screen whatever the zoom, so a zoomed-out view still
 * gives a finger-sized target. A zoom that is not a positive finite number gives minScreenPx.
 */
export function hitSizeWorld(minScreenPx: number, zoom: number): number {
  return Number.isFinite(zoom) && zoom > 0 ? minScreenPx / zoom : minScreenPx;
}

/**
 * The timer bar width in px: full at age 0, empty at age window, linear and rounded in between, clamped to 0..fullPx.
 * A window that is not positive, or any non-finite input, gives 0, so the bar is never NaN.
 */
export function barWidthPx(age: number, window: number, fullPx: number): number {
  if (!Number.isFinite(age) || !Number.isFinite(window) || !Number.isFinite(fullPx) || window <= 0) return 0;
  return Math.max(0, Math.min(fullPx, Math.round(fullPx * (1 - age / window))));
}

/**
 * The marker alpha (0..1) after it expires: 1 at sinceMs 0, linear down to 0 at fadeMs. A negative sinceMs reads as
 * fully shown; a non-positive or non-finite fadeMs, or a NaN sinceMs, gives 0 (gone at once, no divide by zero).
 */
export function fadeAlpha(sinceMs: number, fadeMs: number): number {
  if (!Number.isFinite(fadeMs) || fadeMs <= 0 || Number.isNaN(sinceMs)) return 0;
  return Math.min(1, Math.max(0, 1 - sinceMs / fadeMs));
}

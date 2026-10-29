// Poke render maths (WP28a r1-FixA, moved from worldPlayback.ts): the Sensor 7 head that follows the pointer, the clip clock of the poke
// overlays, and the crow hop: its arc, its flight frames and its landing frames. Why: the poke numbers (src/data/pokes.ts) stay out of the
// app chunk (G step 4b), so only the Director chunk imports this module. Pure: no Phaser, no DOM. Art px unless a name says world px.
import { WORLD_ENV } from '../../data/livingWorld';
import { CROW_HOP, POKE_RENDER } from '../../data/pokes';
import type { SensorHead } from './worldPlayback';

// The Sensor 7 head while the pointer is on the canvas: a pointer that moved within POKE_RENDER.pointerFreshMs picks L / C / R from its world x
// against the tripod, with the range of sensorHead (WORLD_ENV.sensor7.headRangeWorldPx). Otherwise camHead (the caller's camera side, lagged as
// today) shows. A pointer head change waits until POKE_RENDER.pointerChangeGapMs after lastChangeMs (four changes a second at most); a camera
// change does not wait. Pure: it returns the head to show, and the caller stamps the change time when the head differs from lastHead.
export function sensorHeadFromPointer(pointerWorldX: number | null, movedAtMs: number, nowMs: number, tripodX: number, camHead: SensorHead,
  lastHead: SensorHead, lastChangeMs: number): SensorHead {
  if (pointerWorldX === null || !Number.isFinite(pointerWorldX) || !(nowMs - movedAtMs < POKE_RENDER.pointerFreshMs)) return camHead;
  const range = WORLD_ENV.sensor7.headRangeWorldPx;
  const d = pointerWorldX - tripodX;
  const want: SensorHead = d > range ? 'headR' : d < -range ? 'headL' : 'headC';
  if (want === lastHead || nowMs - lastChangeMs >= POKE_RENDER.pointerChangeGapMs) return want;
  return lastHead;
}

// Index of the frame a timed clip shows at playedMs (frameMs holds each frame's time; the last frame holds past the end). -1 for an empty clip.
export function clipIndexAt(frameMs: readonly number[], playedMs: number): number {
  const last = frameMs.length - 1;
  if (last < 0) return -1;
  let t = playedMs;
  for (let i = 0; i < last; i++) {
    const ms = frameMs[i] ?? 0;
    if (t < ms) return i;
    t -= ms;
  }
  return last;
}

// Height (world px, y down) of a crow hop's arc at p (0..1 along the hop): the straight line from fromY to toY less a parabola that peaks apexPx
// above the higher end at the middle of the hop.
export function crowArcY(fromY: number, toY: number, apexPx: number, p: number): number {
  return fromY + (toY - fromY) * p - 4 * p * (1 - p) * (Math.abs(toY - fromY) / 2 + apexPx);
}

// The machine's visible x-range (the arc may not cross it) and a box the arc may not dip into (the dog's head box: x0..x1, top = its top edge).
export interface HopSpan { readonly left: number; readonly right: number }
export interface HopBox { readonly x0: number; readonly x1: number; readonly top: number }
export interface CrowHopSpec { readonly durMs: number; readonly apexPx: number }
// Samples of the box test along the hop (structural).
const ARC_SAMPLES = 32;

// The duration and apex of a crow hop between two perch feet points (world px, y down), or null when the hop is refused (C3): a distance of zero
// or above CROW_HOP.maxDistPx; an arc whose x-range meets the machine span; an arc that is not above the box where it crosses it. The duration is
// max(minMs, d / pxPerS) and the apex min(apexMaxPx, apexPerDist x d + apexAddPx) above the higher end.
export function crowHopSpec(fromX: number, fromY: number, toX: number, toY: number, machine: HopSpan, box: HopBox | null): CrowHopSpec | null {
  const dx = toX - fromX;
  const d = Math.hypot(dx, toY - fromY);
  if (!(d > 0) || d > CROW_HOP.maxDistPx) return null;
  if (Math.max(fromX, toX) >= machine.left && Math.min(fromX, toX) <= machine.right) return null;
  const apexPx = Math.min(CROW_HOP.apexMaxPx, CROW_HOP.apexPerDist * d + CROW_HOP.apexAddPx);
  if (box !== null) {
    for (let i = 0; i <= ARC_SAMPLES; i++) {
      const p = i / ARC_SAMPLES;
      const x = fromX + dx * p;
      if (x >= box.x0 && x <= box.x1 && crowArcY(fromY, toY, apexPx, p) >= box.top) return null;
    }
  }
  return { durMs: Math.max(CROW_HOP.minMs, (d / CROW_HOP.pxPerS) * 1000), apexPx };
}

const FLY_FORWARD: readonly string[] = CROW_HOP.flyFrames;
const FLY_REVERSED: readonly string[] = [...CROW_HOP.flyFrames].reverse();
// The flight frame tMs into a hop (0 <= tMs < durMs): the first flight frame for fly0Ms, then the other two alternate at flyFps. Era V (reversed)
// plays the flight frames in reverse order.
export function crowFlightFrame(tMs: number, reversed: boolean): string {
  const seq = reversed ? FLY_REVERSED : FLY_FORWARD;
  const first = seq[0] ?? '';
  if (!(tMs >= CROW_HOP.fly0Ms)) return first;
  const k = Math.floor(((tMs - CROW_HOP.fly0Ms) * CROW_HOP.flyFps) / 1000);
  return seq[1 + (k % 2)] ?? first;
}

// The landing frame sinceMs after the flight: perch0 and one ruffle (landMs each; the ruffle second, first in era V), then perch0 holds.
export function crowLandFrame(sinceMs: number, reversed: boolean): string {
  const slot = Number.isFinite(sinceMs) && sinceMs >= 0 ? Math.floor(sinceMs / CROW_HOP.landMs) : 0;
  return slot === (reversed ? 0 : 1) ? CROW_HOP.landFrames[1] : CROW_HOP.landFrames[0];
}

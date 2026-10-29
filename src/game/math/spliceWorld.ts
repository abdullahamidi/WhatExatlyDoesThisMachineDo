// Splice world maths (WP28a): the state of a Splice (locked, available, affordable, woken), its four tooltip lines, the pulse law
// (count and speed by the reach level), the line route per framing and its polyline, the pulse dots along a line, the object boxes,
// and the clock's tick schedule. Why: the renderers and the placement guard (A14) read one copy of each rule. Pure: no Phaser, no DOM.
// Numbers and the machine's words come from src/data (spliceWorld, ux, world, resources) and from the TechView the caller holds.
import type { Vec2 } from '../../data/machineComponents';
import type { FramingKey } from '../../data/livingWorld';
import { RESOURCES } from '../../data/resources';
import { SPLICE_CLOCK, SPLICE_FX, SPLICE_LINE_STYLE } from '../../data/spliceWorld';
import { SPLICE_TEXT } from '../../data/ux';
import type { SpliceLineRoute, SpliceOwnEntry, SplicePlacement, SpliceWorldEntry } from '../../data/spliceWorld';
import { GROUND_Y, PIXEL_SCALE } from '../../data/world';
import type { GameState, TechView } from '../../data/types';
import { formatCost, formatNumber } from '../../utils/format';

export type SpliceState = 'locked' | 'available' | 'affordable' | 'woken';
export type SpliceTooltipLines = readonly [string, string, string, string];
export interface SpliceBoxWorld { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }

// Unit clamp for a normalised level (NaN reads 0).
function unitOf(x: number): number {
  return Number.isNaN(x) ? 0 : Math.min(1, Math.max(0, x));
}

/** A woken Splice is woken once bought. A demo-capped Splice is locked. Otherwise affordable when the view says so, available when
 *  its requirements are met, locked when not. */
export function spliceState(view: Pick<TechView, 'status' | 'level' | 'affordable' | 'demoLocked'>): SpliceState {
  if (view.level >= 1) return 'woken';
  if (view.demoLocked) return 'locked';
  if (view.affordable) return 'affordable';
  return view.status === 'available' ? 'available' : 'locked';
}

// The state line: click, need (the shortfall rounded up), full game, the unmet lifetime (have / need) or the unmet tech.
function stateLine(view: TechView, state: SpliceState, res: Pick<GameState, 'res' | 'lifetime'>): string {
  const def = view.def;
  if (state === 'woken') return SPLICE_TEXT.spliced;
  if (state === 'affordable') return SPLICE_TEXT.click;
  if (state === 'available') {
    const shortfall = Math.ceil(Math.max(0, def.baseCost - res.res[def.costRes]));
    return SPLICE_TEXT.need.replace('{n}', formatCost(shortfall)).replace('{res}', RESOURCES[def.costRes].short);
  }
  if (view.demoLocked) return SPLICE_TEXT.fullGame;
  const unmet = view.requirements.filter((r) => !r.met);
  const lifetime = unmet.find((r) => r.req.type === 'lifetime');
  if (lifetime !== undefined && lifetime.req.type === 'lifetime') {
    const energy = lifetime.req.res;
    return SPLICE_TEXT.locked
      .replace('{have}', formatNumber(res.lifetime[energy]))
      .replace('{need}', formatNumber(lifetime.req.amount))
      .replace('{res}', RESOURCES[energy].short);
  }
  const first = unmet[0];
  return SPLICE_TEXT.needsTech.replace('{name}', (first?.label ?? def.name).toUpperCase());
}

/** The four tooltip lines: title (SPLICE · NAME), cost (e.g. 900 ME), effect, state. res is the state's res and lifetime maps: the
 *  NEED line reads res, the LOCKED line reads lifetime. */
export function spliceTooltip(view: TechView, state: SpliceState, res: Pick<GameState, 'res' | 'lifetime'>): SpliceTooltipLines {
  const def = view.def;
  return [
    SPLICE_TEXT.title + def.name.toUpperCase(),
    `${formatCost(def.baseCost)} ${RESOURCES[def.costRes].short}`,
    view.nextEffectText ?? view.currentEffectText,
    stateLine(view, state, res),
  ];
}

/** Pulses on a woken line: 1 + floor(pulseLevelSteps x L), between 1 and maxPulses. L is the normalised reach level (0..1). */
export function pulseCount(level01: number): number {
  return Math.min(SPLICE_FX.maxPulses, Math.max(1, 1 + Math.floor(SPLICE_FX.pulseLevelSteps * unitOf(level01))));
}

/** Pulse speed in world px per second: pulseSpeedBase + pulseSpeedPerLevel x L. */
export function pulseSpeed(level01: number): number {
  return SPLICE_FX.pulseSpeedBase + SPLICE_FX.pulseSpeedPerLevel * unitOf(level01);
}

/** True for an object with its own sheet art (not an existing prop such as the clock or the payphone). */
export function hasOwnArt(entry: SpliceWorldEntry): entry is SpliceOwnEntry {
  return entry.existing === undefined;
}

/** Feet y of a placement: GROUND_Y for 'back', GROUND_Y + lane in the yard. */
export function placementFeetY(placement: SplicePlacement): number {
  return placement.lane === 'back' ? GROUND_Y : GROUND_Y + placement.lane;
}

/** World box of an object whose feet sit at feet (art px box and pivot from the entry, PIXEL_SCALE world px each). */
export function spliceBoxWorld(entry: SpliceWorldEntry, feet: Vec2): SpliceBoxWorld {
  const { bboxArt, footArt } = entry;
  return {
    left: feet.x + (bboxArt.x - footArt.x) * PIXEL_SCALE,
    right: feet.x + (bboxArt.x + bboxArt.w - footArt.x) * PIXEL_SCALE,
    top: feet.y + (bboxArt.y - footArt.y) * PIXEL_SCALE,
    bottom: feet.y + (bboxArt.y + bboxArt.h - footArt.y) * PIXEL_SCALE,
  };
}

/** The line route at a framing: the overhead drop wire only where the cable mast stands (line.dropOn); elsewhere the ground cable. */
export function lineRouteAt(line: SpliceLineRoute, framing: FramingKey): SpliceLineRoute {
  if (line.drop === undefined || line.dropOn === undefined || line.dropOn.includes(framing)) return line;
  return line.riser === undefined ? { from: line.from } : { from: line.from, riser: line.riser };
}

// The drop wire: a catenary from the mast top to the hood (object feet + endDx, endDy), sag 4 x sagPx x t (1 - t) at mid span.
function dropPath(mast: { readonly x: number; readonly y: number }, objectFoot: Vec2): readonly Vec2[] {
  const style = SPLICE_LINE_STYLE.drop;
  const endX = objectFoot.x + style.endDx;
  const endY = objectFoot.y + style.endDy;
  const out: Vec2[] = [];
  for (let i = 0; i <= style.segments; i++) {
    const t = i / style.segments;
    out.push({ x: mast.x + (endX - mast.x) * t, y: mast.y + (endY - mast.y) * t + 4 * style.sagPx * t * (1 - t) });
  }
  return out;
}

/** The polyline of a line (world px) from the machine's outer base foot to the object's foot. The ground run stays at or below
 *  GROUND_Y - 8 except a riser (up the post) and the drop wire (a catenary from the mast top). route must be the framing's route
 *  (lineRouteAt). A back-row end runs along GROUND_Y + groundRunPx. */
export function linePath(route: SpliceLineRoute, foot: Vec2, objectFoot: Vec2): readonly Vec2[] {
  if (route.drop !== undefined) return dropPath(route.drop, objectFoot);
  const ground = GROUND_Y + SPLICE_LINE_STYLE.groundRunPx;
  if (route.riser !== undefined) {
    return [foot, { x: objectFoot.x, y: ground }, { x: objectFoot.x, y: ground - route.riser }];
  }
  const end = objectFoot.y === GROUND_Y ? { x: objectFoot.x, y: ground } : objectFoot;
  return [foot, end];
}

// Length of a polyline (world px); fewer than two points has no length.
function pathLength(path: readonly Vec2[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (a !== undefined && b !== undefined) total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

// Writes into target the point d world px along the polyline (the last segment takes any overrun).
function placeAt(path: readonly Vec2[], d: number, target: { x: number; y: number }): void {
  let left = d;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (a === undefined || b === undefined) continue;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= len || i === path.length - 1) {
      const t = len > 0 ? Math.min(1, left / len) : 0;
      target.x = a.x + (b.x - a.x) * t;
      target.y = a.y + (b.y - a.y) * t;
      return;
    }
    left -= len;
  }
}

/** Writes count dots evenly spread along path, starting at phase (0..1 of the length), into out. The dots reuse out's objects: the
 *  caller sizes out to maxDots once, so later calls allocate nothing. Returns the dots written (at most maxDots, 0 for a path with no
 *  length). */
export function pulsePositions(path: readonly Vec2[], count: number, phase: number, out: Vec2[]): number {
  const n = Math.min(SPLICE_FX.maxDots, Math.max(0, Math.floor(count)));
  const total = pathLength(path);
  if (n === 0 || !(total > 0)) return 0;
  const f = Number.isFinite(phase) ? phase - Math.floor(phase) : 0;
  for (let k = 0; k < n; k++) {
    let slot = out[k];
    if (slot === undefined) {
      slot = { x: 0, y: 0 };
      out.push(slot);
    }
    placeAt(path, ((f + k / n) % 1) * total, slot);
  }
  return n;
}

// The clock's tick schedule (C6): tick k sits at k x slot + jitter(seed, k), jitter in [0, slot / 2 span). A tick gap is therefore
// 6-10 s and a tick (snapBackMs long) never reaches the next slot.
const TICK_SLOT_MS = (SPLICE_CLOCK.tickEveryMs[0] + SPLICE_CLOCK.tickEveryMs[1]) / 2;
const TICK_JITTER_MS = (SPLICE_CLOCK.tickEveryMs[1] - SPLICE_CLOCK.tickEveryMs[0]) / 2;
const REST_TICK: { readonly displacementDeg: 0 | 6 } = { displacementDeg: 0 };
const STEP_TICK: { readonly displacementDeg: 0 | 6 } = { displacementDeg: SPLICE_CLOCK.stepDeg };

// A 32-bit integer hash of (seed, slot) in [0, 1). Integer only, so the schedule is the same on every engine.
function slotUnit(seed: number, slot: number): number {
  let h = (Math.trunc(seed) ^ Math.imul(slot, 0x9e3779b1)) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** The clock hand's displacement at tMs (ms): stepDeg during the snapBackMs after a tick instant, 0 otherwise. The rest angle
 *  (SPLICE_CLOCK.restDeg) is not part of the result: the renderer draws restDeg + displacementDeg. Returns shared objects. */
export function clockTick(tMs: number, seed: number): { readonly displacementDeg: 0 | 6 } {
  if (!Number.isFinite(tMs) || tMs < 0) return REST_TICK;
  const k = Math.floor(tMs / TICK_SLOT_MS);
  const instant = k * TICK_SLOT_MS + Math.floor(slotUnit(seed, k) * TICK_JITTER_MS);
  const since = tMs - instant;
  return since >= 0 && since < SPLICE_CLOCK.snapBackMs ? STEP_TICK : REST_TICK;
}

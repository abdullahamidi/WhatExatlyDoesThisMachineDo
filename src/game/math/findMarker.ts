import { FIND_ART, FIND_LAYOUT, FIND_PRODUCER } from '../../data/findWorld';
import type { FindSpot } from '../../data/findWorld';
import { GROUND_Y, MACHINE_ANCHOR, PIXEL_SCALE } from '../../data/world';
import type { TechId } from '../../data/types';
import type { Vec2 } from '../../data/machineComponents';
import { faultEligible, hitSizeWorld } from './faultMarker';
import type { FaultGates } from './faultMarker';

// WP28a Finds, the marker maths (WP28 C5 renderer rules). Pure: the eligibility, the spot pick, the item and glint frames,
// the ring alpha, the zone size and the intro, hop and fade curves. The renderer (game/rendering/FindMarker.ts) only places
// sprites with these numbers, so the rules are testable with plain Vitest. Every number comes from src/data/findWorld.ts.
// Inputs are never mutated and no function allocates (the renderer calls them every frame).

/** A spot as the maths sees it: its feet x in world px and its yard lane (feet y = GROUND_Y + lane). */
export interface SpotLike { readonly x: number; readonly lane: number }

/** The camera view rect (the camera's worldView has these four fields). */
export interface ViewRect { readonly x: number; readonly y: number; readonly right: number; readonly bottom: number }

/** A number clamped to 0..1; NaN reads 0. */
function clamp01(x: number): number {
  return Number.isNaN(x) ? 0 : Math.min(1, Math.max(0, x));
}

/** The wrapped slot of serial in n entries, 0..n-1 (negative serials wrap; a non-finite serial counts as 0). */
function slotOf(serial: number, n: number): number {
  const k = Number.isFinite(serial) ? Math.floor(serial) : 0;
  return ((k % n) + n) % n;
}

/** An item cell in world px: the item sprite's box (its feet at the bottom centre, the sprite origin). */
const ITEM_PX = FIND_ART.cellArtPx * PIXEL_SCALE;

/** True when the spot's item box meets the HUD rect (touching counts): a Find under the HUD buttons cannot be clicked. */
function itemBoxMeets(spot: SpotLike, feetY: number, hud: ViewRect): boolean {
  const half = ITEM_PX / 2;
  return spot.x - half <= hud.right && spot.x + half >= hud.x && feetY - ITEM_PX <= hud.bottom && feetY >= hud.y;
}

/**
 * True when the spot's feet lie inside the view, inset by insetPx on every side, and its item box clears the HUD rect (WP28a
 * E3). hud null: no HUD test (the view alone, as before the HUD rule).
 */
export function spotInView(spot: SpotLike, view: ViewRect, insetPx: number, hud: ViewRect | null = null): boolean {
  const y = GROUND_Y + spot.lane;
  const inView = spot.x >= view.x + insetPx && spot.x <= view.right - insetPx && y >= view.y + insetPx && y <= view.bottom - insetPx;
  return inView && (hud === null || !itemBoxMeets(spot, y, hud));
}

/**
 * How many of the spots are on screen (see spotInView for the HUD rect) and pass usable (WP28b: spotUsable; none = all pass). Index loop,
 * no iterator: the marker calls it per recount.
 */
export function countInView<T extends SpotLike>(spots: readonly T[], view: ViewRect, insetPx: number, hud: ViewRect | null = null,
  usable?: (spot: T) => boolean): number {
  let n = 0;
  for (let i = 0; i < spots.length; i += 1) {
    const s = spots[i];
    if (s !== undefined && spotInView(s, view, insetPx, hud) && (usable === undefined || usable(s))) n += 1;
  }
  return n;
}

/**
 * A client (CSS) px coordinate in game px: the game canvas starts at canvasStart and spans canvasSize client px, and the game
 * is gamePx wide (or high). Maps the HUD buttons' box into the game's px before the camera maps it into world px.
 */
export function clientToGamePx(client: number, canvasStart: number, canvasSize: number, gamePx: number): number {
  return canvasSize > 0 ? ((client - canvasStart) * gamePx) / canvasSize : 0;
}

/**
 * The last `size` update() durations (ms), for the debug probe's mean (stats().meanMs). A fixed buffer: the oldest sample is
 * overwritten once it is full, so a sample allocates nothing. Shared by the Find marker and the poke layer.
 */
export class TimingWindow {
  private readonly samples: Float64Array;
  private readonly size: number;
  private count = 0;
  private cursor = 0;

  constructor(size: number) {
    this.size = size;
    this.samples = new Float64Array(size);
  }

  /** Keeps one more duration; the oldest is overwritten once the window is full. */
  record(ms: number): void {
    this.samples[this.cursor] = ms;
    this.cursor = (this.cursor + 1) % this.size;
    if (this.count < this.size) this.count += 1;
  }

  /** The mean of the kept durations (0 while none). */
  mean(): number {
    let sum = 0;
    for (let i = 0; i < this.count; i += 1) sum += this.samples[i] ?? 0;
    return this.count === 0 ? 0 : sum / this.count;
  }
}

/** The n-th spot (0-based) among those for which onScreen holds, or null. */
function nthOnScreen<T extends SpotLike>(spots: readonly T[], onScreen: (spot: T) => boolean, n: number): T | null {
  let seen = 0;
  for (let i = 0; i < spots.length; i += 1) {
    const s = spots[i];
    if (s === undefined || !onScreen(s)) continue;
    if (seen === n) return s;
    seen += 1;
  }
  return null;
}

/** True when no cast feet point lies closer than minDistPx (world px) to the spot's feet. */
function clearOfCast(spot: SpotLike, castFeet: readonly Vec2[], minDistPx: number): boolean {
  const y = GROUND_Y + spot.lane;
  const r2 = minDistPx * minDistPx;
  for (let i = 0; i < castFeet.length; i += 1) {
    const c = castFeet[i];
    if (c === undefined) continue;
    const dx = spot.x - c.x;
    const dy = y - c.y;
    if (dx * dx + dy * dy < r2) return false;
  }
  return true;
}

/**
 * The spot of a Find: the serial's slot among the spots on screen (serial % count), or the next on-screen spot in turn when
 * the chosen one lies closer than minDistPx to a cast member's feet. Null when no spot is on screen. Pure: returns one of the
 * given spot objects, never a copy, and never mutates the inputs.
 */
export function pickSpot<T extends SpotLike>(
  spots: readonly T[], serial: number, onScreen: (spot: T) => boolean, castFeet: readonly Vec2[], minDistPx: number,
): T | null {
  let m = 0;
  for (let i = 0; i < spots.length; i += 1) {
    const s = spots[i];
    if (s !== undefined && onScreen(s)) m += 1;
  }
  if (m === 0) return null;
  const start = slotOf(serial, m);
  const first = nthOnScreen(spots, onScreen, start);
  for (let k = 0; k < m; k += 1) {
    const s = nthOnScreen(spots, onScreen, (start + k) % m);
    if (s !== null && clearOfCast(s, castFeet, minDistPx)) return s;
  }
  return first;
}

/** True only when the fault gates are all clear AND at least one Find spot of the framing is on screen (WP28 Finds eligibility). */
export function findEligible(g: FaultGates, spotsOnScreen: number): boolean {
  return spotsOnScreen > 0 && faultEligible(g);
}

/**
 * The item cell of a Find: serial % 7 over the item cells (0-6), or the folded note (cell 7) for a relic. Same serial, same
 * cell, every time; a negative or non-finite serial wraps like the spot slot.
 */
export function itemCell(serial: number, relic: boolean): number {
  if (relic) return FIND_ART.relic;
  const items: readonly number[] = FIND_ART.items;
  return items[slotOf(serial, items.length)] ?? FIND_ART.items[0];
}

/**
 * The glint sprite frame at nowMs: the four-frame ping-pong (8 9 10 9) at FIND_LAYOUT.glintHz cycles a second, half that
 * rate when slowed (the last seconds of a Find). Reduced motion holds frame 0. Always one of the glint cells.
 */
export function glintFrame(nowMs: number, reduced: boolean, slowed = false): number {
  if (reduced) return FIND_ART.glint[0];
  const play: readonly number[] = FIND_ART.glintPlay;
  const ms = Number.isFinite(nowMs) ? Math.max(0, nowMs) : 0;
  const stepMs = (1000 / (FIND_LAYOUT.glintHz * play.length)) * (slowed ? 2 : 1);
  return play[Math.floor(ms / stepMs) % play.length] ?? FIND_ART.glint[0];
}

/** True in the last FIND_LAYOUT.fadeLastS of a Find: the glint slows down. */
export function glintSlowed(ageS: number, windowS: number): boolean {
  return windowS - ageS <= FIND_LAYOUT.fadeLastS;
}

/**
 * The ground ring's alpha (0..1): full until the last fadeLastS of the window, then linear to 0 at the expiry. Off reduced
 * motion it breathes at ringBreatheHz between 1 and 1 - ringBreatheDepth. A non-finite age or window gives 0.
 */
export function ringAlpha(nowMs: number, ageS: number, windowS: number, reduced: boolean): number {
  const left = windowS - ageS;
  const fade = Number.isFinite(left) ? clamp01(left / FIND_LAYOUT.fadeLastS) : 0;
  if (reduced) return fade;
  const ms = Number.isFinite(nowMs) ? Math.max(0, nowMs) : 0;
  const breath = 0.5 + 0.5 * Math.sin((2 * Math.PI * FIND_LAYOUT.ringBreatheHz * ms) / 1000);
  return fade * (1 - FIND_LAYOUT.ringBreatheDepth * breath);
}

/**
 * The fraction of the drop path (the crow's perch to the spot) travelled after elapsedMs: it falls with an accelerating
 * curve for dropFallFraction of dropBounceMs, then bounces up once and lands. 0 at the start, 1 from the landing on.
 */
export function dropFraction(elapsedMs: number): number {
  const k = clamp01(elapsedMs / FIND_LAYOUT.dropBounceMs);
  const fall = FIND_LAYOUT.dropFallFraction;
  if (k < fall) {
    const f = k / fall;
    return f * f;
  }
  const u = (k - fall) / (1 - fall);
  return 1 - FIND_LAYOUT.dropBounceFraction * 4 * u * (1 - u);
}

/** The collect hop in world px after elapsedMs: up to -hopPx at the middle, back to 0 at hopMs (negative is up). */
export function hopOffsetPx(elapsedMs: number): number {
  const k = clamp01(elapsedMs / FIND_LAYOUT.hopMs);
  return -FIND_LAYOUT.hopPx * 4 * k * (1 - k);
}

/** The ground item's rise in world px (positive is down, out of the dirt): risePx at the start, 0 from riseMs on. */
export function riseOffsetPx(elapsedMs: number): number {
  return FIND_LAYOUT.risePx * (1 - clamp01(elapsedMs / FIND_LAYOUT.riseMs));
}

/** The gust item's horizontal scale through the flip: 1 at the start, 0 edge-on at the half turn, 1 at flipMs. */
export function flipScaleX(elapsedMs: number): number {
  return Math.abs(Math.cos(Math.PI * clamp01(elapsedMs / FIND_LAYOUT.flipMs)));
}

/** The gust item shows from the edge-on half turn on. */
export function flipShown(elapsedMs: number): boolean {
  return elapsedMs >= FIND_LAYOUT.flipMs / 2;
}

/** The dog's dust puff lasts one frame: true while elapsedMs is inside puffMs (the item is hidden then). */
export function dustPuffing(elapsedMs: number): boolean {
  return elapsedMs < FIND_LAYOUT.puffMs;
}

/** The click zone's side in world px: an item cell, or hitMinScreenPx on screen at this zoom, whichever is larger. */
export function zoneSideWorld(zoom: number): number {
  return Math.max(FIND_ART.cellArtPx * PIXEL_SCALE, hitSizeWorld(FIND_LAYOUT.hitMinScreenPx, zoom));
}

/** A lead in ms, clamped to 0..maxLeadMs; a non-finite lead reads 0 (no wait). */
function clampLead(ms: number): number {
  return Number.isFinite(ms) ? Math.min(FIND_PRODUCER.maxLeadMs, Math.max(0, ms)) : 0;
}

/** The wait the marker takes for the lead the Director returned: the lead, clamped to 0..maxLeadMs (the item shows after it). */
export function leadWaitMs(returnedMs: number): number {
  return clampLead(returnedMs);
}

/**
 * Whether a spot can hold a Find now: its Splice is woken (requires), and the producer's era (FIND_PRODUCER.era, when it has one) is the
 * current era. Pure: reads the tech levels, never writes them.
 */
export function spotUsable(spot: FindSpot, levels: Readonly<Partial<Record<TechId, number>>>, era: number): boolean {
  const need = FIND_PRODUCER.era[spot.producer];
  if (need !== undefined && need !== era) return false;
  return spot.requires === undefined || (levels[spot.requires] ?? 0) >= 1;
}

/** The nodal line a Chladni item walks to: the nearest node of the grid of chladniNodePx counted from the machine's x (within half a spacing). */
export function chladniTargetX(x: number): number {
  const n = FIND_PRODUCER.chladniNodePx;
  return MACHINE_ANCHOR.x + Math.round((x - MACHINE_ANCHOR.x) / n) * n;
}

/** The Chladni item's x offset in world px after elapsedMs: a smoothstep over chladniWalkMs from the spot to its node (0 at the start). */
export function chladniOffsetPx(spotX: number, elapsedMs: number): number {
  const k = clamp01(elapsedMs / FIND_PRODUCER.chladniWalkMs);
  return (chladniTargetX(spotX) - spotX) * k * k * (3 - 2 * k);
}

/**
 * The lift's height in world px (positive is up) after ageMs: an ease-out to the serial's height over liftMs, then constant. The five
 * heights step evenly across liftPx, chosen by serial (negative and non-finite serials wrap like the spot slot).
 */
export function liftHeightPx(ageMs: number, serial: number): number {
  const [lo, hi] = FIND_PRODUCER.liftPx;
  const target = lo + ((hi - lo) * slotOf(serial, 5)) / 4;
  const k = clamp01(ageMs / FIND_PRODUCER.liftMs);
  return target * k * (2 - k);
}

/** The lifted item's bob in world px after ageMs: liftBobPx at liftBobHz, ramped in over the lift (zero before the lift starts). */
export function liftBobPx(ageMs: number): number {
  const ms = Number.isFinite(ageMs) ? Math.max(0, ageMs) : 0;
  const ramp = clamp01(ms / FIND_PRODUCER.liftMs);
  return FIND_PRODUCER.liftBobPx * ramp * Math.sin((2 * Math.PI * FIND_PRODUCER.liftBobHz * ms) / 1000);
}

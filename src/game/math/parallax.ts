import type { Vec2 } from '../../data/machineComponents';
import type { TechId } from '../../data/types';
import { CAMERA, PARALLAX_FADE_MS, PATTERN_ORIGIN_X } from '../../data/world';
import type { Size } from './camera';

/** Inputs of parallaxStrip: one tiled layer and the screen/world it is placed in. */
export interface ParallaxStripInput {
  scrollFactor: number;
  bottomY: number;   // layer bottom in world px (as PARALLAX_LAYERS define it)
  artHeight: number; // art px
  scale: number;     // art px -> strip px
  world: Size;
  view: Size;
  focus: Vec2;
  minZoom: number;
  phaseShiftPx?: number; // tile pattern phase (layerPhase); geometry changes only when periodPx is given too
  periodPx?: number;     // strip px one tile repeats over (layerPhase)
}

/** Strip geometry in parallax space, exactly as ParallaxBackground places the tiled sprite. */
export interface ParallaxStrip {
  left: number;   // left edge x
  bottom: number; // bottom edge y (sprite origin is bottom-left)
  width: number;  // tiled width: spans the widest visible rect at minZoom
  height: number; // strip px
}

// True when the layer has no visibleWhen, or the tech level has reached its minLevel.
export function isLayerVisible(
  def: { visibleWhen?: { techId: TechId; minLevel: number } },
  techLevels: Readonly<Record<TechId, number>>,
): boolean {
  if (def.visibleWhen === undefined) return true;
  return (techLevels[def.visibleWhen.techId] ?? 0) >= def.visibleWhen.minLevel;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

// Linear move from current toward target by deltaMs / fadeMs, never overshooting; result in [0,1].
// fadeMs <= 0 jumps to target; a non-finite deltaMs leaves current unchanged.
export function fadeStep(current: number, target: number, deltaMs: number, fadeMs: number): number {
  if (!Number.isFinite(deltaMs)) return current;
  const goal = clamp01(target);
  if (fadeMs <= 0) return goal;
  const diff = goal - current;
  const maxMove = Math.max(0, deltaMs) / fadeMs;
  if (Math.abs(diff) <= maxMove) return goal;
  return clamp01(current + Math.sign(diff) * maxMove);
}

// Fade duration of one layer step: fadeInMs while the layer rises with the slow option on (WP26 Q3: the era V sky builds over
// seconds, not a blink), else def.fadeMs. Falling fades and layers without fadeInMs keep their own duration (default PARALLAX_FADE_MS).
export function layerFadeMs(def: { fadeMs?: number; fadeInMs?: number }, current: number, target: number, slow: boolean): number {
  if (slow && def.fadeInMs !== undefined && target > current) return def.fadeInMs;
  return def.fadeMs ?? PARALLAX_FADE_MS;
}

// position p = worldPos - (1 - sf) * (focus - view / 2) per axis: appears at worldPos when the camera is centred on focus
export function parallaxPosition(worldPos: Vec2, focus: Vec2, viewSize: Size, sf: number): Vec2 {
  return {
    x: worldPos.x - (1 - sf) * (focus.x - viewSize.width / 2),
    y: worldPos.y - (1 - sf) * (focus.y - viewSize.height / 2),
  };
}

// min = (1 - sf) * (viewLen / 2) * (1 - 1 / minZoom); max = sf * worldLen + (1 - sf) * (viewLen / 2) * (1 + 1 / minZoom)
export function parallaxSpan(worldLen: number, viewLen: number, minZoom: number, sf: number): { min: number; max: number } {
  const half = viewLen / 2;
  const inv = 1 / minZoom;
  return {
    min: (1 - sf) * half * (1 - inv),
    max: sf * worldLen + (1 - sf) * half * (1 + inv),
  };
}

// Tiled strip of a parallax layer: x from parallaxSpan, bottom from parallaxPosition, height from the art.
// With both phaseShiftPx and periodPx the strip starts one period early and shifted by the phase, so its tile
// boundaries sit where the pattern is phased to (see patternShift); without them the geometry is unchanged.
export function parallaxStrip(input: ParallaxStripInput): ParallaxStrip {
  const sf = input.scrollFactor;
  const span = parallaxSpan(input.world.width, input.view.width, input.minZoom, sf);
  const pos = parallaxPosition({ x: 0, y: input.bottomY }, input.focus, input.view, sf);
  const { phaseShiftPx, periodPx } = input;
  if (phaseShiftPx === undefined || periodPx === undefined) {
    return {
      left: span.min,
      bottom: pos.y,
      width: span.max - span.min,
      height: input.artHeight * input.scale,
    };
  }
  return {
    left: span.min - periodPx + phaseShiftPx,
    bottom: pos.y,
    width: span.max - span.min + periodPx,
    height: input.artHeight * input.scale,
  };
}

// Pattern phase of a tiled layer: where its tile boundaries sit (in [0, periodPx)) so that they stay put
// when the camera focus moves from PATTERN_ORIGIN_X to CAMERA.focus.x. Exact multiples and bad input give 0.
export function patternShift(scrollFactor: number, focusX: number, originX: number, periodPx: number): number {
  const offset = scrollFactor * (focusX - originX);
  if (!Number.isFinite(offset) || !Number.isFinite(periodPx) || !(periodPx > 0)) return 0;
  const m = ((offset % periodPx) + periodPx) % periodPx;
  return m === 0 ? 0 : m; // also turns -0 into 0
}

// Tile period (art width * scale) and pattern phase of a tiled layer, shared by every renderer so they agree.
export function layerPhase(scrollFactor: number, artWidth: number, scale: number): { periodPx: number; phaseShiftPx: number } {
  const periodPx = artWidth * scale;
  return { periodPx, phaseShiftPx: patternShift(scrollFactor, CAMERA.focus.x, PATTERN_ORIGIN_X, periodPx) };
}

// Opacity of a layer from its stages: the max alpha over the stages whose tech level is met; 0 when none is.
export function stageAlpha(
  stages: readonly { techId: TechId; minLevel: number; alpha: number }[],
  levels: Readonly<Record<TechId, number>>,
): number {
  let out = 0;
  for (const s of stages) {
    if ((levels[s.techId] ?? 0) >= s.minLevel) out = Math.max(out, s.alpha);
  }
  return out;
}

// Frame of a latch-like sprite from its stages: the frame of the LAST met stage in list order; 0 when none is.
export function stageFrame(
  stages: readonly { techId: TechId; minLevel: number; frame: number }[],
  levels: Readonly<Record<TechId, number>>,
): number {
  let out = 0;
  for (const s of stages) {
    if ((levels[s.techId] ?? 0) >= s.minLevel) out = s.frame;
  }
  return out;
}

// Sky-art px -> the screen position it takes when the camera is at scroll factor 0: zoom about the view centre.
export function skyPxToScrollZero(p: Vec2, view: Size, minZoom: number): Vec2 {
  const cx = view.width / 2;
  const cy = view.height / 2;
  return { x: cx + (p.x - cx) / minZoom, y: cy + (p.y - cy) / minZoom };
}

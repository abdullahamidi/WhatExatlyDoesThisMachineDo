import type { Vec2 } from '../../data/machineComponents';
import type { TechId } from '../../data/types';
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
export function parallaxStrip(input: ParallaxStripInput): ParallaxStrip {
  const sf = input.scrollFactor;
  const span = parallaxSpan(input.world.width, input.view.width, input.minZoom, sf);
  const pos = parallaxPosition({ x: 0, y: input.bottomY }, input.focus, input.view, sf);
  return {
    left: span.min,
    bottom: pos.y,
    width: span.max - span.min,
    height: input.artHeight * input.scale,
  };
}

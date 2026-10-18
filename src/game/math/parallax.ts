import type { Vec2 } from '../../data/machineComponents';
import type { TechId } from '../../data/types';
import type { Size } from './camera';

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

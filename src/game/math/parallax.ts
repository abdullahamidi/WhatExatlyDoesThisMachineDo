import type { Vec2 } from '../../data/machineComponents';
import type { Size } from './camera';

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

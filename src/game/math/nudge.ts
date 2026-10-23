import type { Vec2 } from '../../data/machineComponents';

// WP20 camera nudge (D2): pan the view toward a released part that sits outside the inner box. Pure, no Phaser.
// Tuning (innerFraction, fraction, maxWorldPx) comes from CAMERA_NUDGE in src/data/ux.ts.

export interface NudgeConfig { innerFraction: number; fraction: number; maxWorldPx: number }

// Next camera centre toward `target`, or null when the target already sits inside the inner box.
// The inner box is innerFraction of the visible world rect (view / zoom) around the centre. The step is `fraction` of
// the offset, capped at maxWorldPx world px so a far target pans in bounded steps.
export function nudgeCenter(
  center: Vec2,
  zoom: number,
  target: Vec2,
  view: { width: number; height: number },
  cfg: NudgeConfig,
): Vec2 | null {
  const halfW = view.width / zoom * cfg.innerFraction / 2;
  const halfH = view.height / zoom * cfg.innerFraction / 2;
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  if (Math.abs(dx) <= halfW && Math.abs(dy) <= halfH) return null;
  let stepX = dx * cfg.fraction;
  let stepY = dy * cfg.fraction;
  const len = Math.hypot(stepX, stepY);
  if (len > cfg.maxWorldPx) {
    // keep the direction, shorten the step to the cap
    const k = cfg.maxWorldPx / len;
    stepX *= k;
    stepY *= k;
  }
  return { x: center.x + stepX, y: center.y + stepY };
}

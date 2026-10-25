// WP23b girl step clamp (B-A3): one committed change moves the girl at most maxPx world px down the front band. Why: era V
// steps her by steps * stepDyWorldPx, and two steps can land in one commit (the 8 h jumps that buy skyAperture also meet the
// finalAlignment milestone), a 16 px jump. The director calls this in buildPlan with WORLD_GIRL.stepMaxWorldPx so a commit
// moves her at most that far. Only a rise in dy is capped: a decrease, no change, another framing row or x (another stage)
// passes through. Pure: no Phaser, no DOM. Imports the placement type only.
import type { WorldPlacement } from '../../data/livingWorld';

// The girl's placement after one committed change (prev and next null = off-stage). Returns next itself (same reference)
// when no cap applies; otherwise a new object whose dy is prev dy + maxPx. Inputs are never mutated.
export function clampGirlStep(prev: WorldPlacement | null, next: WorldPlacement | null, maxPx: number): WorldPlacement | null {
  if (prev === null || next === null) return next;
  if (!Number.isFinite(maxPx) || maxPx <= 0) return next;
  if (prev.row !== next.row || prev.x !== next.x) return next;
  const p = prev.dy ?? 0;
  const n = next.dy ?? 0;
  if (n - p <= maxPx) return next;
  return { ...next, dy: p + maxPx };
}

import { MACHINE_COMPONENTS } from '../../data/machineComponents';
import type { MachineComponentDefinition, MachineComponentId, Vec2 } from '../../data/machineComponents';
import { MACHINE_ANCHOR, PIXEL_SCALE } from '../../data/world';
import type { TechId } from '../../data/types';
import type { Bounds } from './camera';
import { componentBounds, isComponentVisible } from './machineLayout';

/** Union of the art px boxes of every visible component; nothing visible -> the zero box at (0, 0). */
export function visibleMachineBounds(
  techLevels: Readonly<Record<TechId, number>>,
  components: Readonly<Record<MachineComponentId, MachineComponentDefinition>> = MACHINE_COMPONENTS,
): Bounds {
  let out: Bounds | null = null;
  for (const def of Object.values(components)) {
    if (!isComponentVisible(def, techLevels)) continue;
    const b = componentBounds(def);
    out = out === null
      ? { left: b.left, top: b.top, right: b.right, bottom: b.bottom }
      : {
        left: Math.min(out.left, b.left),
        top: Math.min(out.top, b.top),
        right: Math.max(out.right, b.right),
        bottom: Math.max(out.bottom, b.bottom),
      };
  }
  return out ?? { left: 0, top: 0, right: 0, bottom: 0 };
}

/** Art px box -> world px box: anchor + box * scale per axis. */
export function boundsToWorld(b: Bounds, anchor: Vec2 = MACHINE_ANCHOR, scale: number = PIXEL_SCALE): Bounds {
  return {
    left: anchor.x + b.left * scale,
    top: anchor.y + b.top * scale,
    right: anchor.x + b.right * scale,
    bottom: anchor.y + b.bottom * scale,
  };
}

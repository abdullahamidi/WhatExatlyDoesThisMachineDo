import { MACHINE_LAYER_DEPTH, MACHINE_SOCKETS } from '../../data/machineComponents';
import type { MachineComponentDefinition, SocketId, Vec2 } from '../../data/machineComponents';
import { MACHINE_ANCHOR, PIXEL_SCALE } from '../../data/world';
import type { TechId } from '../../data/types';

/** Machine-local art px position of a component: socket (or origin when null) + attach offset. */
export function resolveAttachment(def: MachineComponentDefinition, sockets: Record<SocketId, Vec2> = MACHINE_SOCKETS): Vec2 {
  const base = def.attach.socket === null ? { x: 0, y: 0 } : (sockets[def.attach.socket] ?? { x: 0, y: 0 });
  return { x: base.x + def.attach.offset.x, y: base.y + def.attach.offset.y }; // base + offset
}

/** World px = anchor + local * scale (per axis). */
export function machineLocalToWorld(p: Vec2, anchor: Vec2 = MACHINE_ANCHOR, scale: number = PIXEL_SCALE): Vec2 {
  return { x: anchor.x + p.x * scale, y: anchor.y + p.y * scale }; // anchor + p * scale
}

/** A component is visible once its tech level reaches minLevel. */
export function isComponentVisible(def: MachineComponentDefinition, techLevels: Readonly<Record<TechId, number>>): boolean {
  return techLevels[def.techId] >= def.minLevel; // level >= minLevel
}

/** Draw depth of a component, from its layer. */
export function componentDepth(def: MachineComponentDefinition): number {
  return MACHINE_LAYER_DEPTH[def.layer]; // layer -> depth table
}

/** Machine-local art px bounding box of a component's sprite. */
export function componentBounds(
  def: MachineComponentDefinition,
  sockets?: Record<SocketId, Vec2>,
): { left: number; right: number; top: number; bottom: number } {
  const p = resolveAttachment(def, sockets); // pivot position
  const left = p.x - def.origin.x * def.size.width; // pivot - origin * size
  const top = p.y - def.origin.y * def.size.height;
  return { left, right: left + def.size.width, top, bottom: top + def.size.height }; // left + width, top + height
}

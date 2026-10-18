import Phaser from 'phaser';
import { MACHINE_COMPONENTS, MACHINE_LINKS, MACHINE_LINK_STYLE } from '../../data/machineComponents';
import type { ConnectionPoint, MachineComponentId, Vec2 } from '../../data/machineComponents';
import { linkSegments } from '../math/machineLinks';

/** Key quantisation: coordinates are compared at 1/KEY_SCALE art px so sub-pixel noise does not redraw. */
const KEY_SCALE = 100;
/** Outline stroke is drawn this many art px wider than the colour stroke. */
const OUTLINE_EXTRA_WIDTH = 2;

interface DrawnLink {
  kind: ConnectionPoint['kind'];
  segments: Array<[Vec2, Vec2]>;
}

/** Pulley radius of a connection point, 0 when the point has none. */
function radiusOf(component: MachineComponentId, pointId: string): number {
  const point = MACHINE_COMPONENTS[component].connections.find((p) => p.id === pointId);
  return point?.radius ?? 0; // missing radius means a plain shaft
}

/** Draws shafts and belts between live connection points, in machine-local art px. */
export class MachineLinks {
  private readonly graphics: Phaser.GameObjects.Graphics;
  /** Quantised geometry of the last draw; equal key means the Graphics is already correct. */
  private lastKey = '';

  constructor(scene: Phaser.Scene, container: Phaser.GameObjects.Container) {
    this.graphics = scene.add.graphics().setDepth(MACHINE_LINK_STYLE.depth);
    container.add(this.graphics);
  }

  /** Redraws the links when any endpoint moved; skips all Graphics work otherwise. */
  draw(pointOf: (component: MachineComponentId, pointId: string) => Vec2 | null): void {
    const drawn: DrawnLink[] = [];
    let key = '';
    for (const link of MACHINE_LINKS) {
      const a = pointOf(link.from.component, link.from.point);
      const b = pointOf(link.to.component, link.to.point);
      if (a === null || b === null) continue;
      const ra = radiusOf(link.from.component, link.from.point);
      const rb = radiusOf(link.to.component, link.to.point);
      const segments = linkSegments(link.kind, a, ra, b, rb);
      drawn.push({ kind: link.kind, segments });
      key += link.kind + ':' + segments
        .map(([p, q]) => [p.x, p.y, q.x, q.y].map((v) => Math.round(v * KEY_SCALE)).join(','))
        .join(';') + '|';
    }
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.graphics.clear();
    if (drawn.length === 0) return;

    // Outlines first so they never cover another link's colour.
    for (const { kind, segments } of drawn) {
      this.graphics.lineStyle(MACHINE_LINK_STYLE.width[kind] + OUTLINE_EXTRA_WIDTH, MACHINE_LINK_STYLE.outline, 1);
      for (const [p, q] of segments) this.graphics.lineBetween(p.x, p.y, q.x, q.y);
    }
    for (const { kind, segments } of drawn) {
      this.graphics.lineStyle(MACHINE_LINK_STYLE.width[kind], MACHINE_LINK_STYLE.color[kind], 1);
      for (const [p, q] of segments) this.graphics.lineBetween(p.x, p.y, q.x, q.y);
    }
  }

  /** Destroys the Graphics object; safe to call twice. */
  destroy(): void {
    if (this.graphics.scene) this.graphics.destroy(); // Phaser clears scene on destroy
    this.lastKey = '';
  }
}

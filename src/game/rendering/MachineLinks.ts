import Phaser from 'phaser';
import { DRIVE_TRAIN, MACHINE_COMPONENTS, MACHINE_COMPONENT_IDS, MACHINE_LINKS, MACHINE_LINK_STYLE } from '../../data/machineComponents';
import type { MachineComponentId, Vec2 } from '../../data/machineComponents';
import { partAngle, sliderCrank } from '../math/driveTrain';
import { resolveAttachment } from '../math/machineLayout';
import { beltTravel, coalesceRuns, pointsAlongBelt, rasterBelt, rasterLine } from '../math/machineLinks';

/** Key quantisation: belt endpoints are compared at 1/KEY_SCALE art px so sub-pixel noise does not redraw. */
const KEY_SCALE = 100;

/** Live view of the machine that the link renderer reads each frame. */
export interface LinkDrawContext {
  pointOf(component: MachineComponentId, pointId: string): Vec2 | null;   // live position (sprite pos + point offset); null while hidden or assembling
  isLive(component: MachineComponentId): boolean;                         // visible AND not assembling
  masterDeg: number;                                                      // unwrapped thetaM
}

/** Belt ready to rasterise: endpoints quantised, dash shift in whole pixels. */
interface BeltPlan { a: Vec2; b: Vec2; ra: number; rb: number; dashShift: number }

/** Rod ready to rasterise: pin and eye in whole pixels. */
interface RodPlan { pin: Vec2; eye: Vec2 }

/** Geometry of one draw, built from integers only; equal key means equal pixels. */
interface LinkPlan { belts: BeltPlan[]; rods: RodPlan[]; caps: Vec2[]; key: string }

/** Pulley radius of a connection point, 0 when the point has none. */
function radiusOf(component: MachineComponentId, pointId: string): number {
  const point = MACHINE_COMPONENTS[component].connections.find((p) => p.id === pointId);
  return point?.radius ?? 0; // missing radius means a plain shaft
}

/** Normalise -0 to 0. */
function noNegativeZero(v: number): number {
  return v === 0 ? 0 : v; // -0 === 0 is true, so this returns +0 for both zeros
}

/** Point rounded to whole art px. */
function roundPoint(p: Vec2): Vec2 {
  return { x: noNegativeZero(Math.round(p.x)), y: noNegativeZero(Math.round(p.y)) }; // whole px
}

/** Point quantised to 1/KEY_SCALE art px. */
function quantisePoint(p: Vec2): Vec2 {
  return {
    x: noNegativeZero(Math.round(p.x * KEY_SCALE) / KEY_SCALE),
    y: noNegativeZero(Math.round(p.y * KEY_SCALE) / KEY_SCALE),
  };
}

/** Key text of a quantised point (integer steps of 1/KEY_SCALE). */
function keyOf(p: Vec2): string {
  return `${Math.round(p.x * KEY_SCALE)},${Math.round(p.y * KEY_SCALE)}`;
}

/** Point p + k * n. */
function offsetBy(p: Vec2, n: Vec2, k: number): Vec2 {
  return { x: noNegativeZero(p.x + k * n.x), y: noNegativeZero(p.y + k * n.y) }; // p + k * n
}

/** Whole-pixel disc of the given radius around a centre (dx*dx + dy*dy <= r*r). */
function discPixels(c: Vec2, radius: number): Vec2[] {
  const out: Vec2[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy <= radius * radius) out.push({ x: c.x + dx, y: c.y + dy });
    }
  }
  return out;
}

/** Builds the belt, rod and cap geometry from live state; raster work is left to draw(). */
function buildPlan(ctx: LinkDrawContext): LinkPlan {
  const belts: BeltPlan[] = [];
  const rods: RodPlan[] = [];
  const keyParts: string[] = [];

  for (const link of MACHINE_LINKS) {
    const fromLive = ctx.isLive(link.from.component);
    const toLive = ctx.isLive(link.to.component);

    if (link.kind === 'belt') {
      const a = ctx.pointOf(link.from.component, link.from.point);
      const b = ctx.pointOf(link.to.component, link.to.point);
      const ra = radiusOf(link.from.component, link.from.point);
      const rb = radiusOf(link.to.component, link.to.point);
      if (!fromLive || !toLive || a === null || b === null || !(ra > 0) || !(rb > 0)) {
        keyParts.push('b-'); // hidden, assembling or pulley-less endpoint: no belt
        continue;
      }
      const qa = quantisePoint(a);
      const qb = quantisePoint(b);
      const fromAnim = MACHINE_COMPONENTS[link.from.component].animation;
      const fromRatio = fromAnim.kind === 'driven' ? fromAnim.ratio : 0;
      const dashShift = Math.floor(beltTravel(ctx.masterDeg, fromRatio, ra));
      belts.push({ a: qa, b: qb, ra, rb, dashShift });
      keyParts.push(`b${keyOf(qa)};${keyOf(qb)};${dashShift}`);
    } else {
      const crankAnim = MACHINE_COMPONENTS[link.from.component].animation;
      const hub = ctx.pointOf(link.from.component, link.from.point);
      const eye = ctx.pointOf(link.to.component, link.to.point);
      if (!fromLive || !toLive || hub === null || eye === null || crankAnim.kind !== 'driven') {
        keyParts.push('r-'); // hidden, assembling or undriven crank: no rod
        continue;
      }
      const angle = partAngle(ctx.masterDeg, crankAnim.ratio, crankAnim.phaseDeg) + DRIVE_TRAIN.rod.pinPhaseDeg;
      const pin = roundPoint(sliderCrank(hub, DRIVE_TRAIN.rod.pinRadius, DRIVE_TRAIN.rod.length, angle).pin);
      const eyeAt = roundPoint(eye);
      rods.push({ pin, eye: eyeAt });
      keyParts.push(`r${pin.x},${pin.y};${eyeAt.x},${eyeAt.y}`);
    }
  }

  // Axle caps: one per driven socket that is live, deduped by whole position.
  const caps: Vec2[] = [];
  const seen = new Set<string>();
  for (const id of MACHINE_COMPONENT_IDS) {
    const def = MACHINE_COMPONENTS[id];
    if (def.animation.kind !== 'driven' || !ctx.isLive(id)) continue;
    const at = roundPoint(resolveAttachment(def));
    const k = `${at.x},${at.y}`;
    if (seen.has(k)) continue;
    seen.add(k);
    caps.push(at);
    keyParts.push(`c${k}`);
  }

  return { belts, rods, caps, key: keyParts.join('|') };
}

/** Draws belts, the conrod and axle caps as 1x1 pixel rectangles on integer art px. */
export class MachineLinks {
  private readonly belts: Phaser.GameObjects.Graphics;
  private readonly rods: Phaser.GameObjects.Graphics;
  private readonly caps: Phaser.GameObjects.Graphics;
  /** Key of the last drawn plan; equal key means the Graphics are already correct. */
  private lastKey = '';

  constructor(scene: Phaser.Scene, parent: Phaser.GameObjects.Container) {
    this.belts = scene.make.graphics({}, false).setDepth(MACHINE_LINK_STYLE.beltDepth);
    this.rods = scene.make.graphics({}, false).setDepth(MACHINE_LINK_STYLE.rodDepth);
    this.caps = scene.make.graphics({}, false).setDepth(MACHINE_LINK_STYLE.capDepth);
    parent.add(this.belts);
    parent.add(this.rods);
    parent.add(this.caps);
  }

  /** Redraws the links when the plan key changed; skips all Graphics work otherwise. */
  draw(ctx: LinkDrawContext): void {
    const plan = buildPlan(ctx);
    if (plan.key === this.lastKey) return;
    this.lastKey = plan.key;
    this.belts.clear();
    this.rods.clear();
    this.caps.clear();
    this.drawBelts(plan.belts);
    this.drawRods(plan.rods);
    this.drawCaps(plan.caps);
  }

  /** Destroys the Graphics objects; safe to call twice. */
  destroy(): void {
    for (const g of [this.belts, this.rods, this.caps]) {
      if (g.scene) g.destroy(); // Phaser clears scene on destroy
    }
    this.lastKey = '';
  }

  /** Belts: outer edge, inner edge, then moving dashes along the inner row. */
  private drawBelts(plans: readonly BeltPlan[]): void {
    const style = MACHINE_LINK_STYLE.belt;
    const rastered: Array<{ inner: Vec2[]; outer: Vec2[]; dashShift: number }> = [];
    for (const plan of plans) {
      const r = rasterBelt(plan.a, plan.ra, plan.b, plan.rb);
      if (r !== null) rastered.push({ inner: r.inner, outer: r.outer, dashShift: plan.dashShift });
    }
    for (const r of rastered) this.plot(this.belts, style.outer, r.outer);
    for (const r of rastered) this.plot(this.belts, style.inner, r.inner);
    for (const r of rastered) {
      for (let j = 0; j < style.dashLength; j++) {
        this.plot(this.belts, style.dash, pointsAlongBelt(r.inner, style.dashSpacing, r.dashShift + j));
      }
    }
  }

  /** Conrod: edge rows, core line, then the two eyes (disc plus centre pixel). */
  private drawRods(plans: readonly RodPlan[]): void {
    const style = MACHINE_LINK_STYLE.rod;
    for (const { pin, eye } of plans) {
      const dx = eye.x - pin.x;
      const dy = eye.y - pin.y;
      const len = Math.hypot(dx, dy);
      if (len > 0) {
        // Unit normal of (eye - pin), rounded to whole px so the edge rows stay on the pixel grid.
        const n: Vec2 = { x: noNegativeZero(Math.round(-dy / len)), y: noNegativeZero(Math.round(dx / len)) };
        this.plot(this.rods, style.edge, rasterLine(offsetBy(pin, n, 1), offsetBy(eye, n, 1)));
        this.plot(this.rods, style.edge, rasterLine(offsetBy(pin, n, -1), offsetBy(eye, n, -1)));
      }
      this.plot(this.rods, style.core, rasterLine(pin, eye));
      for (const p of [pin, eye]) {
        this.plot(this.rods, style.eye, discPixels(p, style.eyeRadius));
        this.plot(this.rods, style.eyeCentre, [p]);
      }
    }
  }

  /** Axle caps: ring, then inner body, then highlight pixel, per cap. */
  private drawCaps(caps: readonly Vec2[]): void {
    const style = MACHINE_LINK_STYLE.cap;
    const half = Math.floor(style.size / 2);
    const last = style.size - 1;
    for (const c of caps) {
      const x0 = c.x - half;
      const y0 = c.y - half;
      const ring: Vec2[] = [];
      const body: Vec2[] = [];
      for (let dy = 0; dy < style.size; dy++) {
        for (let dx = 0; dx < style.size; dx++) {
          const p = { x: x0 + dx, y: y0 + dy };
          if (dx === 0 || dy === 0 || dx === last || dy === last) ring.push(p);
          else body.push(p);
        }
      }
      this.plot(this.caps, style.ring, ring);
      this.plot(this.caps, style.body, body);
      this.plot(this.caps, style.hi, [{ x: x0 + 1, y: y0 + 1 }]);
    }
  }

  /** Fills 1x1 integer pixels in one colour, merged into horizontal runs. */
  private plot(g: Phaser.GameObjects.Graphics, color: number, pixels: readonly Vec2[]): void {
    g.fillStyle(color, 1);
    for (const run of coalesceRuns(pixels)) g.fillRect(run.x, run.y, run.w, run.h);
  }
}

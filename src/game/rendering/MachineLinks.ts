import Phaser from 'phaser';
import { DRIVE_TRAIN, MACHINE_COMPONENTS, MACHINE_COMPONENT_IDS, MACHINE_LINKS, MACHINE_LINK_STYLE } from '../../data/machineComponents';
import type { MachineComponentId, Vec2 } from '../../data/machineComponents';
import { partAngle, sliderCrank } from '../math/driveTrain';
import { resolveAttachment } from '../math/machineLayout';
import { beltTravel, coalesceRuns, pointsAlongBelt, rasterBelt, rasterLine } from '../math/machineLinks';

/** Key quantisation: belt endpoints are compared at 1/KEY_SCALE art px so sub-pixel noise does not redraw. */
const KEY_SCALE = 100;

/** Horizontal run of integer pixels, as produced by coalesceRuns. */
interface Run { x: number; y: number; w: number; h: number }

/** Live view of the machine that the link renderer reads each frame. */
export interface LinkDrawContext {
  pointOf(component: MachineComponentId, pointId: string): Vec2 | null;   // live position (sprite pos + point offset); null while hidden or assembling
  isLive(component: MachineComponentId): boolean;                         // visible AND not assembling
  masterDeg: number;                                                      // unwrapped thetaM
}

/** Belt ready to rasterise: endpoints quantised, dash shift in whole pixels. key identifies the loop geometry only. */
interface BeltPlan { key: string; a: Vec2; b: Vec2; ra: number; rb: number; dashShift: number }

/** Rod ready to rasterise: pin and eye in whole pixels. */
interface RodPlan { pin: Vec2; eye: Vec2 }

/**
 * Geometry of one draw, built from integers only. Each part has its own key: equal key means equal pixels for that part.
 * The belt key excludes the dash shift, so a moving belt only re-plots its dash pass.
 */
interface LinkPlan {
  belts: BeltPlan[];
  rods: RodPlan[];
  caps: Vec2[];
  beltKey: string;
  dashKey: string;
  rodKey: string;
  capKey: string;
}

/** Rastered belt loops with their coalesced runs; inner pixels feed the dash pass. */
interface BeltRaster { inner: Vec2[]; innerRuns: Run[]; outerRuns: Run[] }

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

/** Rasters one belt's inner and outer loops; null for a degenerate belt. */
function rasterOf(plan: BeltPlan): BeltRaster | null {
  const r = rasterBelt(plan.a, plan.ra, plan.b, plan.rb);
  if (r === null) return null;
  return { inner: r.inner, innerRuns: coalesceRuns(r.inner), outerRuns: coalesceRuns(r.outer) };
}

/** Builds the belt, rod and cap geometry from live state; raster work is left to draw(). */
function buildPlan(ctx: LinkDrawContext): LinkPlan {
  const belts: BeltPlan[] = [];
  const rods: RodPlan[] = [];
  const beltKeyParts: string[] = [];
  const dashKeyParts: string[] = [];
  const rodKeyParts: string[] = [];

  for (const link of MACHINE_LINKS) {
    const fromLive = ctx.isLive(link.from.component);
    const toLive = ctx.isLive(link.to.component);

    if (link.kind === 'belt') {
      const a = ctx.pointOf(link.from.component, link.from.point);
      const b = ctx.pointOf(link.to.component, link.to.point);
      const ra = radiusOf(link.from.component, link.from.point);
      const rb = radiusOf(link.to.component, link.to.point);
      if (!fromLive || !toLive || a === null || b === null || !(ra > 0) || !(rb > 0)) {
        beltKeyParts.push('b-'); // hidden, assembling or pulley-less endpoint: no belt
        continue;
      }
      const qa = quantisePoint(a);
      const qb = quantisePoint(b);
      const fromAnim = MACHINE_COMPONENTS[link.from.component].animation;
      const fromRatio = fromAnim.kind === 'driven' ? fromAnim.ratio : 0;
      const dashShift = Math.floor(beltTravel(ctx.masterDeg, fromRatio, ra));
      const key = `${keyOf(qa)};${keyOf(qb)};${ra};${rb}`;
      belts.push({ key, a: qa, b: qb, ra, rb, dashShift });
      beltKeyParts.push(`b${key}`);
      dashKeyParts.push(`${dashShift}`);
    } else {
      const crankAnim = MACHINE_COMPONENTS[link.from.component].animation;
      const hub = ctx.pointOf(link.from.component, link.from.point);
      const eye = ctx.pointOf(link.to.component, link.to.point);
      if (!fromLive || !toLive || hub === null || eye === null || crankAnim.kind !== 'driven') {
        rodKeyParts.push('r-'); // hidden, assembling or undriven crank: no rod
        continue;
      }
      const angle = partAngle(ctx.masterDeg, crankAnim.ratio, crankAnim.phaseDeg) + DRIVE_TRAIN.rod.pinPhaseDeg;
      const pin = roundPoint(sliderCrank(hub, DRIVE_TRAIN.rod.pinRadius, DRIVE_TRAIN.rod.length, angle).pin);
      const eyeAt = roundPoint(eye);
      rods.push({ pin, eye: eyeAt });
      rodKeyParts.push(`r${pin.x},${pin.y};${eyeAt.x},${eyeAt.y}`);
    }
  }

  // Axle caps: one per driven socket that is live, deduped by whole position.
  const caps: Vec2[] = [];
  const capKeyParts: string[] = [];
  const seen = new Set<string>();
  for (const id of MACHINE_COMPONENT_IDS) {
    const def = MACHINE_COMPONENTS[id];
    if (def.animation.kind !== 'driven' || !ctx.isLive(id)) continue;
    const at = roundPoint(resolveAttachment(def));
    const k = `${at.x},${at.y}`;
    if (seen.has(k)) continue;
    seen.add(k);
    caps.push(at);
    capKeyParts.push(`c${k}`);
  }

  return {
    belts,
    rods,
    caps,
    beltKey: beltKeyParts.join('|'),
    dashKey: dashKeyParts.join('|'),
    rodKey: rodKeyParts.join('|'),
    capKey: capKeyParts.join('|'),
  };
}

/** Draws belts, the conrod and axle caps as 1x1 pixel rectangles on integer art px. */
export class MachineLinks {
  private readonly belts: Phaser.GameObjects.Graphics;
  /** Dash pass on its own layer so a moving belt does not clear the belt edges. Added right after belts. */
  private readonly dashes: Phaser.GameObjects.Graphics;
  private readonly rods: Phaser.GameObjects.Graphics;
  private readonly caps: Phaser.GameObjects.Graphics;
  /** Keys of the last drawn parts; null until the first draw. Equal key means that Graphics is already correct. */
  private beltKey: string | null = null;
  private dashKey: string | null = null;
  private rodKey: string | null = null;
  private capKey: string | null = null;
  /** Rastered belt loops by belt key; rebuilt from the current plan each draw so it never grows past the live belts. */
  private rasterCache = new Map<string, BeltRaster>();

  constructor(scene: Phaser.Scene, parent: Phaser.GameObjects.Container) {
    this.belts = scene.make.graphics({}, false).setDepth(MACHINE_LINK_STYLE.beltDepth);
    this.dashes = scene.make.graphics({}, false).setDepth(MACHINE_LINK_STYLE.beltDepth);
    this.rods = scene.make.graphics({}, false).setDepth(MACHINE_LINK_STYLE.rodDepth);
    this.caps = scene.make.graphics({}, false).setDepth(MACHINE_LINK_STYLE.capDepth);
    parent.add(this.belts);
    parent.add(this.dashes);
    parent.add(this.rods);
    parent.add(this.caps);
  }

  /** Redraws each part only when its own key changed; skips all Graphics work otherwise. */
  draw(ctx: LinkDrawContext): void {
    const plan = buildPlan(ctx);
    const rastered = this.rasterBelts(plan.belts);
    const style = MACHINE_LINK_STYLE.belt;

    if (plan.beltKey !== this.beltKey) {
      this.beltKey = plan.beltKey;
      this.dashKey = null; // dashes sit on the inner loop, so a belt change redraws them too
      this.belts.clear();
      for (const { raster } of rastered) this.plotRuns(this.belts, style.outer, raster.outerRuns);
      for (const { raster } of rastered) this.plotRuns(this.belts, style.inner, raster.innerRuns);
    }
    if (plan.dashKey !== this.dashKey) {
      this.dashKey = plan.dashKey;
      this.dashes.clear();
      for (const { raster, dashShift } of rastered) {
        for (let j = 0; j < style.dashLength; j++) {
          this.plot(this.dashes, style.dash, pointsAlongBelt(raster.inner, style.dashSpacing, dashShift + j));
        }
      }
    }
    if (plan.rodKey !== this.rodKey) {
      this.rodKey = plan.rodKey;
      this.rods.clear();
      this.drawRods(plan.rods);
    }
    if (plan.capKey !== this.capKey) {
      this.capKey = plan.capKey;
      this.caps.clear();
      this.drawCaps(plan.caps);
    }
  }

  /** Destroys the Graphics objects; safe to call twice. */
  destroy(): void {
    for (const g of [this.belts, this.dashes, this.rods, this.caps]) {
      if (g.scene) g.destroy(); // Phaser clears scene on destroy
    }
    this.beltKey = null;
    this.dashKey = null;
    this.rodKey = null;
    this.capKey = null;
    this.rasterCache = new Map();
  }

  /**
   * Pairs each belt with its cached raster, rastering only unseen keys. The new cache holds exactly the current belts,
   * so keys from vibrating or moved parts do not accumulate.
   */
  private rasterBelts(plans: readonly BeltPlan[]): Array<{ raster: BeltRaster; dashShift: number }> {
    const next = new Map<string, BeltRaster>();
    const out: Array<{ raster: BeltRaster; dashShift: number }> = [];
    for (const plan of plans) {
      const raster = next.get(plan.key) ?? this.rasterCache.get(plan.key) ?? rasterOf(plan);
      if (raster === null) continue; // degenerate belt: nothing drawn, as before
      next.set(plan.key, raster);
      out.push({ raster, dashShift: plan.dashShift });
    }
    this.rasterCache = next;
    return out;
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
    this.plotRuns(g, color, coalesceRuns(pixels));
  }

  /** Fills precomputed horizontal runs in one colour. */
  private plotRuns(g: Phaser.GameObjects.Graphics, color: number, runs: readonly Run[]): void {
    g.fillStyle(color, 1);
    for (const run of runs) g.fillRect(run.x, run.y, run.w, run.h);
  }
}

import Phaser from 'phaser';
import { DRIVE_TRAIN, MACHINE_COMPONENTS, MACHINE_COMPONENT_IDS, MACHINE_LINKS, MACHINE_LINK_STYLE } from '../../data/machineComponents';
import type { MachineComponentId, MachineLink, Vec2 } from '../../data/machineComponents';
import { partAngle, sliderCrank } from '../math/driveTrain';
import { resolveAttachment } from '../math/machineLayout';
import {
  beltTravel,
  coalesceRuns,
  connectionOffset,
  pinEnd,
  pointsAlongBelt,
  rasterBelt,
  rasterCable,
  rasterLine,
  rasterPipe,
} from '../math/machineLinks';
import type { PipeRect } from '../math/machineLinks';

/** Key quantisation: belt endpoints are compared at 1/KEY_SCALE art px so sub-pixel noise does not redraw. */
const KEY_SCALE = 100;

/** Horizontal run of integer pixels, as produced by coalesceRuns. */
interface Run { x: number; y: number; w: number; h: number }

/** Live view of the machine that the link renderer reads each frame. */
export interface LinkDrawContext {
  pointOf(component: MachineComponentId, pointId: string): Vec2 | null;   // live position (sprite pos + point offset); null while hidden or assembling
  isLive(component: MachineComponentId): boolean;                         // visible AND not assembling
  masterDeg: number;                                                      // unwrapped thetaM
  angleOf(component: MachineComponentId): number | null;                  // displayed angle of a driven part (deg); null for any other part
}

/** Belt ready to rasterise: endpoints quantised, dash shift in whole pixels. key identifies the loop geometry only. */
interface BeltPlan { key: string; a: Vec2; b: Vec2; ra: number; rb: number; dashShift: number }

/** Rod ready to rasterise: pin and eye in whole pixels. */
interface RodPlan { pin: Vec2; eye: Vec2 }

/** Pin-to-pin rod (both ends driven) ready to rasterise: draw depth plus pin and eye in whole pixels. */
interface PinRodPlan { depth: number; pin: Vec2; eye: Vec2 }

/** Cable ready to rasterise: both ends in whole pixels, sag in art px. */
interface CablePlan { a: Vec2; b: Vec2; sag: number }

/**
 * Pipe ready to rasterise: corner points in whole px (both ends rounded, via points rounded), draw depth, look and cache key
 * (link index plus the corner list). The key is the raster cache id.
 */
interface PipePlan { depth: number; points: Vec2[]; style: 'steam' | 'water'; key: string }

/**
 * Geometry of one draw, built from integers only. Each part has its own key: equal key means equal pixels for that part.
 * The belt key excludes the dash shift, so a moving belt only re-plots its dash pass.
 * Pipes are keyed per depth (one Graphics each); pipeKey is all pipe parts in link order.
 * Pin-to-pin rods are keyed per depth too (pinRodKeys); the slider-crank rod keeps its own rodKey.
 */
interface LinkPlan {
  belts: BeltPlan[];
  rods: RodPlan[];
  pinRods: PinRodPlan[];
  caps: Vec2[];
  cables: CablePlan[];
  guyCables: CablePlan[];   // era V guy cables (cableStyle 'guy'), kept apart from the power cables
  pipes: PipePlan[];
  beltKey: string;
  dashKey: string;
  rodKey: string;
  capKey: string;
  cableKey: string;
  guyKey: string;
  pipeKey: string;
  pipeKeys: Map<number, string>;
  pinRodKeys: Map<number, string>;
}

/** Pipe depths in use: one Graphics per distinct depth of the pipe links (MACHINE_LINK_STYLE.pipe.depth unless a link sets its own). */
function pipeDepths(): number[] {
  const depths = MACHINE_LINKS.filter((link) => link.kind === 'pipe').map((link) => link.depth ?? MACHINE_LINK_STYLE.pipe.depth);
  return Array.from(new Set(depths));
}

/** True when a rod link joins two driven parts: a pin-to-pin rod (parallel crank) instead of a slider-crank rod. */
function isPinToPinRod(link: MachineLink): boolean {
  return link.kind === 'rod' && MACHINE_COMPONENTS[link.from.component].animation.kind === 'driven'
    && MACHINE_COMPONENTS[link.to.component].animation.kind === 'driven';
}

/** Pin-to-pin rod depths in use: one Graphics per distinct depth of the pin-to-pin rod links (MACHINE_LINK_STYLE.rodDepth unless a link sets its own). */
function pinRodDepths(): number[] {
  const depths = MACHINE_LINKS.filter(isPinToPinRod).map((link) => link.depth ?? MACHINE_LINK_STYLE.rodDepth);
  return Array.from(new Set(depths));
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
  const pinRods: PinRodPlan[] = [];
  const pinRodKeysByDepth = new Map<number, string[]>();
  const cables: CablePlan[] = [];
  const cableKeyParts: string[] = [];
  const guyCables: CablePlan[] = [];
  const guyKeyParts: string[] = [];
  const pipes: PipePlan[] = [];
  const pipeKeyParts: string[] = [];
  const pipeKeysByDepth = new Map<number, string[]>();

  for (const [index, link] of MACHINE_LINKS.entries()) {
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
    } else if (link.kind === 'rod' && isPinToPinRod(link)) {
      // Pin-to-pin rod: each pin rides its own driven part's displayed angle (parallel crank); a hidden end drops the rod.
      const depth = link.depth ?? MACHINE_LINK_STYLE.rodDepth;
      const depthParts = pinRodKeysByDepth.get(depth) ?? [];
      pinRodKeysByDepth.set(depth, depthParts);
      const fromDef = MACHINE_COMPONENTS[link.from.component];
      const toDef = MACHINE_COMPONENTS[link.to.component];
      const a = ctx.angleOf(link.from.component);
      const b = ctx.angleOf(link.to.component);
      const pinFrom = connectionOffset(fromDef, link.from.point);
      const pinTo = connectionOffset(toDef, link.to.point);
      if (!fromLive || !toLive || a === null || b === null || pinFrom === null || pinTo === null) {
        depthParts.push('q-'); // hidden or assembling end: no pin-to-pin rod
        continue;
      }
      const pin = roundPoint(pinEnd(resolveAttachment(fromDef), pinFrom, a));
      const eye = roundPoint(pinEnd(resolveAttachment(toDef), pinTo, b));
      pinRods.push({ depth, pin, eye });
      depthParts.push(`q${pin.x},${pin.y};${eye.x},${eye.y}`);
    } else if (link.kind === 'rod') {
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
    } else if (link.kind === 'cable') {
      const a = ctx.pointOf(link.from.component, link.from.point);
      const b = ctx.pointOf(link.to.component, link.to.point);
      const guy = link.cableStyle === 'guy'; // era V guy cable: own list and key; power cables keep theirs
      if (!fromLive || !toLive || a === null || b === null) {
        if (guy) guyKeyParts.push('g-'); // hidden or assembling end: no guy cable
        else cableKeyParts.push('c-'); // hidden or assembling end: no cable
        continue;
      }
      const qa = roundPoint(a);
      const qb = roundPoint(b);
      const sag = link.sag ?? MACHINE_LINK_STYLE.cable.sagArtPx;
      if (guy) {
        guyCables.push({ a: qa, b: qb, sag });
        guyKeyParts.push(`g${qa.x},${qa.y};${qb.x},${qb.y};${sag}`);
      } else {
        cables.push({ a: qa, b: qb, sag });
        cableKeyParts.push(`c${qa.x},${qa.y};${qb.x},${qb.y};${sag}`);
      }
    } else if (link.kind === 'pipe') {
      const depth = link.depth ?? MACHINE_LINK_STYLE.pipe.depth;
      const depthParts = pipeKeysByDepth.get(depth) ?? [];
      pipeKeysByDepth.set(depth, depthParts);
      const a = ctx.pointOf(link.from.component, link.from.point);
      const b = ctx.pointOf(link.to.component, link.to.point);
      if (!fromLive || !toLive || a === null || b === null) {
        depthParts.push('p-'); // hidden or assembling endpoint: no pipe
        pipeKeyParts.push('p-');
        continue;
      }
      const points = [roundPoint(a), ...(link.via ?? []).map(roundPoint), roundPoint(b)];
      const key = `p${index}:${points.map((p) => `${p.x},${p.y}`).join(';')}`;
      pipes.push({ depth, points, style: link.pipeStyle ?? 'steam', key });
      depthParts.push(key);
      pipeKeyParts.push(key);
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

  const pipeKeys = new Map<number, string>();
  for (const [depth, parts] of pipeKeysByDepth) pipeKeys.set(depth, parts.join('|'));
  const pinRodKeys = new Map<number, string>();
  for (const [depth, parts] of pinRodKeysByDepth) pinRodKeys.set(depth, parts.join('|'));

  return {
    belts,
    rods,
    pinRods,
    caps,
    cables,
    guyCables,
    pipes,
    beltKey: beltKeyParts.join('|'),
    dashKey: dashKeyParts.join('|'),
    rodKey: rodKeyParts.join('|'),
    capKey: capKeyParts.join('|'),
    cableKey: cableKeyParts.join('|'),
    guyKey: guyKeyParts.join('|'),
    pipeKey: pipeKeyParts.join('|'),
    pipeKeys,
    pinRodKeys,
  };
}

/** Draws belts, the conrod, axle caps, power cables, era V guy cables and steam / water pipes as 1x1 pixel rectangles on integer art px. */
export class MachineLinks {
  private readonly belts: Phaser.GameObjects.Graphics;
  /** Dash pass on its own layer so a moving belt does not clear the belt edges. Added right after belts. */
  private readonly dashes: Phaser.GameObjects.Graphics;
  private readonly rods: Phaser.GameObjects.Graphics;
  private readonly caps: Phaser.GameObjects.Graphics;
  /** Sagging cables (Era II wiring), above the rods. */
  private readonly cables: Phaser.GameObjects.Graphics;
  /** Era V guy cables (dark wire rope), below the anchor sprites at MACHINE_LINK_STYLE.guy.depth. */
  private readonly guyCables: Phaser.GameObjects.Graphics;
  /** Pipes: one Graphics per distinct pipe depth, added after the cables. */
  private readonly pipeGraphics = new Map<number, Phaser.GameObjects.Graphics>();
  /** Pin-to-pin rods: one Graphics per distinct depth of the pin-to-pin rod links in MACHINE_LINKS (static data, so always created; empty while no such rod is live, e.g. Era I-III). */
  private readonly pinRodGraphics = new Map<number, Phaser.GameObjects.Graphics>();
  /** Keys of the last drawn parts; null until the first draw. Equal key means that Graphics is already correct. */
  private beltKey: string | null = null;
  private dashKey: string | null = null;
  private rodKey: string | null = null;
  private capKey: string | null = null;
  private cableKey: string | null = null;
  private guyKey: string | null = null;
  private pipeKey: string | null = null;
  /** Last drawn key per pipe depth; a depth is redrawn only when its own key changed. */
  private pipeKeys = new Map<number, string>();
  /** Last drawn key per pin-to-pin rod depth; a depth is redrawn only when its own key changed. */
  private pinRodKeys = new Map<number, string>();
  /** Rastered belt loops by belt key; rebuilt from the current plan each draw so it never grows past the live belts. */
  private rasterCache = new Map<string, BeltRaster>();
  /** Rastered pipes by pipe key; rebuilt from the live pipes each time the pipe key changes. */
  private pipeRasterCache = new Map<string, PipeRect[]>();

  constructor(scene: Phaser.Scene, parent: Phaser.GameObjects.Container) {
    this.belts = scene.make.graphics({}, false).setDepth(MACHINE_LINK_STYLE.beltDepth);
    this.dashes = scene.make.graphics({}, false).setDepth(MACHINE_LINK_STYLE.beltDepth);
    this.rods = scene.make.graphics({}, false).setDepth(MACHINE_LINK_STYLE.rodDepth);
    this.caps = scene.make.graphics({}, false).setDepth(MACHINE_LINK_STYLE.capDepth);
    this.cables = scene.make.graphics({}, false).setDepth(MACHINE_LINK_STYLE.cable.depth);
    this.guyCables = scene.make.graphics({}, false).setDepth(MACHINE_LINK_STYLE.guy.depth);
    parent.add(this.belts);
    parent.add(this.dashes);
    parent.add(this.rods);
    parent.add(this.caps);
    parent.add(this.cables);
    parent.add(this.guyCables);
    for (const depth of pipeDepths()) {
      const g = scene.make.graphics({}, false).setDepth(depth);
      this.pipeGraphics.set(depth, g);
      parent.add(g);
    }
    for (const depth of pinRodDepths()) {
      const g = scene.make.graphics({}, false).setDepth(depth);
      this.pinRodGraphics.set(depth, g);
      parent.add(g);
    }
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
      this.drawRods(this.rods, plan.rods);
    }
    this.drawPinRods(plan);
    if (plan.capKey !== this.capKey) {
      this.capKey = plan.capKey;
      this.caps.clear();
      this.drawCaps(plan.caps);
    }
    if (plan.cableKey !== this.cableKey) {
      this.cableKey = plan.cableKey;
      this.cables.clear();
      this.drawCables(plan.cables);
    }
    if (plan.guyKey !== this.guyKey) {
      this.guyKey = plan.guyKey;
      this.guyCables.clear();
      this.drawGuyCables(plan.guyCables);
    }
    this.drawPipes(plan);
  }

  /** Destroys the Graphics objects; safe to call twice. */
  destroy(): void {
    for (const g of [this.belts, this.dashes, this.rods, this.caps, this.cables, this.guyCables, ...this.pipeGraphics.values(), ...this.pinRodGraphics.values()]) {
      if (g.scene) g.destroy(); // Phaser clears scene on destroy
    }
    this.beltKey = null;
    this.dashKey = null;
    this.rodKey = null;
    this.capKey = null;
    this.cableKey = null;
    this.guyKey = null;
    this.pipeKey = null;
    this.pipeKeys = new Map();
    this.pinRodKeys = new Map();
    this.rasterCache = new Map();
    this.pipeRasterCache = new Map();
  }

  /**
   * Pipes are static: nothing happens while the pipe key is unchanged. Otherwise the live pipes are rastered (cached by key)
   * and each depth whose own key changed is cleared and refilled in link order.
   */
  private drawPipes(plan: LinkPlan): void {
    if (plan.pipeKey === this.pipeKey) return;
    this.pipeKey = plan.pipeKey;
    const rasters = this.rasterPipes(plan.pipes);
    for (const [depth, g] of this.pipeGraphics) {
      const key = plan.pipeKeys.get(depth) ?? '';
      if (this.pipeKeys.get(depth) === key) continue;
      this.pipeKeys.set(depth, key);
      g.clear();
      let color: number | null = null; // colour of the last fill, so runs of one colour share a fillStyle
      for (const pipe of plan.pipes) {
        if (pipe.depth !== depth) continue;
        for (const rect of rasters.get(pipe.key) ?? []) {
          if (rect.color !== color) {
            g.fillStyle(rect.color, 1);
            color = rect.color;
          }
          g.fillRect(rect.x, rect.y, rect.w, rect.h);
        }
      }
    }
  }

  /**
   * Pairs each live pipe with its cached raster, rastering only unseen keys. The new cache holds exactly the live pipes,
   * so keys of hidden pipes do not accumulate.
   */
  private rasterPipes(plans: readonly PipePlan[]): Map<string, PipeRect[]> {
    const next = new Map<string, PipeRect[]>();
    for (const plan of plans) {
      if (next.has(plan.key)) continue;
      const rects = this.pipeRasterCache.get(plan.key) ?? rasterPipe(plan.points, MACHINE_LINK_STYLE.pipe[plan.style]);
      next.set(plan.key, rects);
    }
    this.pipeRasterCache = next;
    return next;
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

  /**
   * Pin-to-pin rods: each depth whose own key changed is cleared and refilled. A depth with no live rod stays empty.
   */
  private drawPinRods(plan: LinkPlan): void {
    for (const [depth, g] of this.pinRodGraphics) {
      const key = plan.pinRodKeys.get(depth) ?? '';
      if (this.pinRodKeys.get(depth) === key) continue;
      this.pinRodKeys.set(depth, key);
      g.clear();
      this.drawRods(g, plan.pinRods.filter((rod) => rod.depth === depth));
    }
  }

  /** Conrod: edge rows, core line, then the two eyes (disc plus centre pixel). */
  private drawRods(g: Phaser.GameObjects.Graphics, plans: readonly RodPlan[]): void {
    const style = MACHINE_LINK_STYLE.rod;
    for (const { pin, eye } of plans) {
      const dx = eye.x - pin.x;
      const dy = eye.y - pin.y;
      const len = Math.hypot(dx, dy);
      if (len > 0) {
        // Unit normal of (eye - pin), rounded to whole px so the edge rows stay on the pixel grid.
        const n: Vec2 = { x: noNegativeZero(Math.round(-dy / len)), y: noNegativeZero(Math.round(dx / len)) };
        this.plot(g, style.edge, rasterLine(offsetBy(pin, n, 1), offsetBy(eye, n, 1)));
        this.plot(g, style.edge, rasterLine(offsetBy(pin, n, -1), offsetBy(eye, n, -1)));
      }
      this.plot(g, style.core, rasterLine(pin, eye));
      for (const p of [pin, eye]) {
        this.plot(g, style.eye, discPixels(p, style.eyeRadius));
        this.plot(g, style.eyeCentre, [p]);
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

  /**
   * Cables: sagging core line, a highlight pixel directly above each even-x core pixel (not itself core), and a 2x2
   * highlight dot on each end.
   */
  private drawCables(cables: readonly CablePlan[]): void {
    const style = MACHINE_LINK_STYLE.cable;
    for (const { a, b, sag } of cables) {
      const core = rasterCable(a, b, sag);
      const coreKeys = new Set(core.map((p) => `${p.x},${p.y}`));
      const hi: Vec2[] = [];
      const hiKeys = new Set<string>();
      for (const p of core) {
        if (p.x % 2 !== 0) continue; // even x only (-0 counts as even)
        const above: Vec2 = { x: p.x, y: p.y - 1 };
        const k = `${above.x},${above.y}`;
        if (coreKeys.has(k) || hiKeys.has(k)) continue;
        hiKeys.add(k);
        hi.push(above);
      }
      this.plot(this.cables, style.core, core);
      this.plot(this.cables, style.hi, hi);
      for (const e of [a, b]) {
        this.plot(this.cables, style.hi, [
          { x: e.x, y: e.y },
          { x: e.x + 1, y: e.y },
          { x: e.x, y: e.y + 1 },
          { x: e.x + 1, y: e.y + 1 },
        ]);
      }
    }
  }

  /**
   * Guy cables (era V): a 1 px dark core line, and one dark pixel directly below each core pixel unless that pixel is
   * core itself. No cyan highlight and no end caps.
   */
  private drawGuyCables(cables: readonly CablePlan[]): void {
    const style = MACHINE_LINK_STYLE.guy;
    for (const { a, b, sag } of cables) {
      const core = rasterCable(a, b, sag);
      const coreKeys = new Set(core.map((p) => `${p.x},${p.y}`));
      const under: Vec2[] = [];
      const underKeys = new Set<string>();
      for (const p of core) {
        const below: Vec2 = { x: p.x, y: p.y + 1 };
        const k = `${below.x},${below.y}`;
        if (coreKeys.has(k) || underKeys.has(k)) continue;
        underKeys.add(k);
        under.push(below);
      }
      this.plot(this.guyCables, style.core, core);
      this.plot(this.guyCables, style.under, under);
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

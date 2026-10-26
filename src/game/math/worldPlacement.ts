// World placement maths (WP23a, WP23b): where the living-world cast stands for a camera framing (DENIZEN_ART §3), the view rect,
// the screen position of a parallax point, and the far-plane strip literals. Why: the cast must follow the same camera pose
// and machine bounds the renderer frames, so the rules are pure and unit-tested against the smoke stage buy lists.
// Pure: no Phaser, no DOM. Numbers come from src/data (livingWorld WORLD_LAYOUT and WORLD_FAR_PLANES, world, parallax art).
import type { Vec2 } from '../../data/machineComponents';
import type { TechId } from '../../data/types';
import { CAMERA, CRANK_FEEDBACK, GROUND_Y, MACHINE_ANCHOR, PARALLAX_LAYERS, PIXEL_SCALE, VIEW, WORLD } from '../../data/world';
import { WORLD_FAR_PLANES, WORLD_GIRL_PLACEMENTS, WORLD_LAYOUT, WORLD_PLACEMENTS } from '../../data/livingWorld';
import type { FramingKey, GroundId, WorldPlacement } from '../../data/livingWorld';
import { WORLD_ERA_RULES, WORLD_GIRL } from '../../data/worldEras';
import { currentEra } from '../../simulation/progression/era';
import { ASSET_MANIFEST } from '../../assets/manifest';
import { effectiveMinZoom, fitView } from './camera';
import type { Bounds } from './camera';
import { boundsToWorld, visibleMachineBounds } from './machineBounds';
import { layerPhase, parallaxStrip } from './parallax';
import type { CameraPose } from './finale';
import { girlStepsOf } from './worldState';

export interface Rect { x: number; y: number; w: number; h: number }
export interface SpeakerAnchor { head: Vec2; feet: Vec2 }   // GAME px (1280x720 screen space)

// Crank hub: the crank hit circle (CRANK_FEEDBACK.hitRadius art px, PIXEL_SCALE world px each) plus WORLD_LAYOUT.crankClearPx.
const HUB_CLEAR_PX = CRANK_FEEDBACK.hitRadius * PIXEL_SCALE + WORLD_LAYOUT.crankClearPx;
// The default camera pose: every stage s0-s7 frames here.
const E1_POSE: CameraPose = { centerX: CAMERA.focus.x, centerY: CAMERA.focus.y, zoom: CAMERA.defaultZoom };

// Camera pose the renderer frames for these machine levels: the same fitView call as CameraController.target().
export function framingPose(levels: Readonly<Record<TechId, number>>): CameraPose {
  const fit = fitView(boundsToWorld(visibleMachineBounds(levels)), VIEW, {
    margin: CAMERA.fitMarginPx,
    pixelScale: PIXEL_SCALE,
    minZoom: effectiveMinZoom(VIEW, WORLD, CAMERA.minZoom),
    maxZoom: CAMERA.maxZoom,
    defaultZoom: CAMERA.defaultZoom,
    defaultCenter: { x: CAMERA.focus.x, y: CAMERA.focus.y },
    world: WORLD,
    hudTopInsetPx: CAMERA.hudTopInsetPx,
    fullView: { groundY: GROUND_Y, groundBandPx: CAMERA.fullViewGroundBandPx, topMinPx: CAMERA.fullViewTopMinPx },
  });
  return { centerX: fit.center.x, centerY: fit.center.y, zoom: fit.zoom };
}

// Nearest framing key of a pose: min of |dzoom| * 1000 + |dcentre x| over the reference poses (ties keep list order).
export function framingKeyOfPose(pose: CameraPose): FramingKey {
  let best: FramingKey = 'e1';
  let bestDist = Infinity;
  for (const ref of WORLD_LAYOUT.framingPoses) {
    const dist = Math.abs(pose.zoom - ref.zoom) * 1000 + Math.abs(pose.centerX - ref.centerX);
    if (dist < bestDist) { best = ref.key; bestDist = dist; }
  }
  return best;
}

export function framingKey(levels: Readonly<Record<TechId, number>>): FramingKey {
  return framingKeyOfPose(framingPose(levels));
}

// Visible world rect of a pose: centre +- view / (2 * zoom).
export function viewRectOf(pose: CameraPose): Rect {
  return {
    x: pose.centerX - VIEW.width / (2 * pose.zoom),
    y: pose.centerY - VIEW.height / (2 * pose.zoom),
    w: VIEW.width / pose.zoom,
    h: VIEW.height / pose.zoom,
  };
}

// True when p lies inside view, shrunk by insetWorldPx on every side (edges inclusive).
export function isOnScreen(p: Vec2, view: Rect, insetWorldPx: number): boolean {
  return p.x >= view.x + insetWorldPx && p.x <= view.x + view.w - insetWorldPx
    && p.y >= view.y + insetWorldPx && p.y <= view.y + view.h - insetWorldPx;
}

// Game px of a point on a layer with scroll factor sf: the layer moves (1 - sf) against the camera, then the zoom about the view centre.
export function screenOfWorld(pt: Vec2, sf: number, pose: CameraPose): Vec2 {
  return {
    x: (pt.x - sf * (pose.centerX - VIEW.width / 2) - VIEW.width / 2) * pose.zoom + VIEW.width / 2,
    y: (pt.y - sf * (pose.centerY - VIEW.height / 2) - VIEW.height / 2) * pose.zoom + VIEW.height / 2,
  };
}

// The usable test of one x for an entry whose inner flag is given (true = inner gap rule, see usableX).
type Usable = (x: number, inner?: true) => boolean;

// True when a world x is usable for a cast member: outside the hub clearance and the screen centre third. An inner entry sits
// inside the view by wingClearPx and between the machine edges by innerClearPx. Any other entry keeps its wing (DENIZEN_ART §3):
// left of the anchor from the view edge to the machine left, right of it from the machine right to the view edge.
export function usableX(x: number, view: Rect, machine: Bounds, inner: boolean): boolean {
  if (Math.abs(x - MACHINE_ANCHOR.x) < HUB_CLEAR_PX) return false;
  const third = view.w / 3;
  if (x >= view.x + third && x <= view.x + 2 * third) return false;
  // The wing starts WORLD_LAYOUT.wingClearPx outside the view edge and ends that far short of the machine edge (DENIZEN_ART §3).
  const clear = WORLD_LAYOUT.wingClearPx;
  if (inner) {
    const gap = WORLD_LAYOUT.innerClearPx;
    return x >= view.x + clear && x <= view.x + view.w - clear && x >= machine.left + gap && x <= machine.right - gap;
  }
  if (x < MACHINE_ANCHOR.x) return x >= view.x + clear && x <= machine.left - clear;
  return x >= machine.right + clear && x <= view.x + view.w - clear;
}

// One base entry under the usable test: off-stage (null) when its x fails; a route is kept only when both ends pass;
// an xs list keeps only the usable xs (x = first kept). inner and dy carry over to the placement.
function placeOne(base: WorldPlacement | undefined, usable: Usable): WorldPlacement | null {
  if (base === undefined) return null;
  const ok = (x: number): boolean => usable(x, base.inner);
  const keep = { ...(base.inner === undefined ? {} : { inner: base.inner }), ...(base.dy === undefined ? {} : { dy: base.dy }) };
  if (base.xs !== undefined) {
    const kept = base.xs.filter((x) => ok(x));
    const first = kept[0];
    if (first === undefined) return null;
    return { x: first, row: base.row, xs: kept, ...keep };
  }
  if (!ok(base.x)) return null;
  if (base.route !== undefined && ok(base.route[0]) && ok(base.route[1])) {
    return { x: base.x, row: base.row, route: base.route, ...keep };
  }
  return { x: base.x, row: base.row, ...keep };
}

// The girl (WORLD_GIRL_PLACEMENTS): on stage only at the ground stage, the later of the era stage and the cycle trace stage
// (the worldState rule). Era V uses the era5 row and steps down the front band by girlStepsOf * stepDyWorldPx when a step is met.
function placeGirl(levels: Readonly<Record<TechId, number>>, framing: FramingKey, cycle: number, usable: Usable): WorldPlacement | null {
  const era = currentEra(levels);
  const trace = cycle >= 3 ? WORLD_GIRL.traceStageByCycle[3] : cycle === 2 ? WORLD_GIRL.traceStageByCycle[2] : 0;
  if (Math.max(WORLD_GIRL.stageByEra[era], trace) < WORLD_GIRL.stageNames.length - 1) return null;
  const rows = WORLD_GIRL_PLACEMENTS[framing];
  const placed = placeOne(era === WORLD_ERA_RULES.girlStepEra ? rows?.era5 : rows?.ground, usable);
  const steps = era === WORLD_ERA_RULES.girlStepEra ? girlStepsOf(levels) : 0;
  return placed === null || steps === 0 ? placed : { ...placed, dy: steps * WORLD_GIRL.stepDyWorldPx };
}

// Where each cast member stands for these levels. pose defaults to the framing pose of the levels; null = off-stage.
// crow needs the lamp (same post); stakeChain and hole need the dog (the same hole and chain). cycle (default 1) sets the girl's
// trace stage: cycle 2 keeps her a mini, cycle 3+ puts her on the ground.
export function placeCast(
  levels: Readonly<Record<TechId, number>>,
  framing: FramingKey,
  pose?: CameraPose,
  cycle = 1,
): Record<GroundId, WorldPlacement | null> {
  const view = viewRectOf(pose ?? framingPose(levels));
  const machine = boundsToWorld(visibleMachineBounds(levels));
  const base = WORLD_PLACEMENTS[framing];
  const usable: Usable = (x, inner) => usableX(x, view, machine, inner === true);
  const lamp = placeOne(base.lamp, usable);
  const dog = placeOne(base.dog, usable);
  return {
    inspector: placeOne(base.inspector, usable),
    dog,
    crow: lamp === null ? null : placeOne(base.crow, usable),
    payphone: placeOne(base.payphone, usable),
    sensor7: placeOne(base.sensor7, usable),
    lamp,
    clock: placeOne(base.clock, usable),
    stakeChain: dog === null ? null : placeOne(base.stakeChain, usable),
    hole: dog === null ? null : placeOne(base.hole, usable),
    scraps: placeOne(base.scraps, usable),
    girl: placeGirl(levels, framing, cycle, usable),
    puddles: placeOne(base.puddles, usable),
    sprout: placeOne(base.sprout, usable),
    lantern: placeOne(base.lantern, usable),
  };
}

// The x band an actor may walk in at a framing (WP24 T1, the spots rule): scanned outward from the placement x one world px at a time while
// usableX holds (WORLD.width px each way at most). null when the actor has no placement there or its placement x is not usable.
export function actorBand(
  framing: FramingKey,
  pose: CameraPose | undefined,
  levels: Readonly<Record<TechId, number>>,
  actor: GroundId,
): { min: number; max: number } | null {
  const base = WORLD_PLACEMENTS[framing][actor];
  if (base === undefined) return null;
  const view = viewRectOf(pose ?? framingPose(levels));
  const machine = boundsToWorld(visibleMachineBounds(levels));
  const inner = base.inner === true;
  if (!usableX(base.x, view, machine, inner)) return null;
  let min = base.x;
  while (base.x - min < WORLD.width && usableX(min - 1, view, machine, inner)) min -= 1;
  let max = base.x;
  while (max - base.x < WORLD.width && usableX(max + 1, view, machine, inner)) max += 1;
  return { min, max };
}

// A change the player may not see is safe: the TECH INDEX is open, or the old and new places are both off-screen.
export function unseenChangeOk(i: { treeOpen: boolean; oldOnScreen: boolean; newOnScreen: boolean }): boolean {
  return i.treeOpen || (!i.oldOnScreen && !i.newOnScreen);
}

// The camera pose of a framing reference (WORLD_LAYOUT.framingPoses). The centre y is the focus: only the x of a probe is read here.
function framingPoseOf(key: FramingKey): CameraPose {
  const ref = WORLD_LAYOUT.framingPoses.find((r) => r.key === key);
  if (ref === undefined) throw new Error(`no framing pose '${key}'`);
  return { centerX: ref.centerX, centerY: CAMERA.focus.y, zoom: ref.zoom };
}

// Strip origin and top (strip px) of the far layer's tile instance whose probe lands nearest the target screen x at the pose
// (default e1). The instances sit on the period grid from strip.left; the probe is an art px offset inside the tile (0, 0 = the origin).
function nearestFarTile(layerId: string, probe: { artX: number; artY: number }, targetScreenX: number,
  pose: CameraPose = E1_POSE): { originX: number; topY: number } {
  const layer = PARALLAX_LAYERS.find((l) => l.id === layerId);
  if (layer === undefined) throw new Error(`no parallax layer '${layerId}'`);
  const art = ASSET_MANIFEST[layer.assetId];
  const { periodPx, phaseShiftPx } = layerPhase(layer.scrollFactor, art.width, PIXEL_SCALE);
  const strip = parallaxStrip({
    scrollFactor: layer.scrollFactor,
    bottomY: layer.bottomY,
    artHeight: art.height,
    scale: PIXEL_SCALE,
    world: WORLD,
    view: VIEW,
    focus: CAMERA.focus,
    minZoom: effectiveMinZoom(VIEW, WORLD, CAMERA.minZoom),
    phaseShiftPx,
    periodPx,
  });
  const topY = strip.bottom - strip.height;
  let best = { originX: strip.left, topY };
  let bestDist = Infinity;
  const count = Math.ceil(strip.width / periodPx);
  for (let k = 0; k <= count; k++) {
    const originX = strip.left + k * periodPx;
    const screen = screenOfWorld(
      { x: originX + PIXEL_SCALE * probe.artX, y: topY + PIXEL_SCALE * probe.artY },
      layer.scrollFactor,
      pose,
    );
    const dist = Math.abs(screen.x - targetScreenX);
    if (dist < bestDist) { best = { originX, topY }; bestDist = dist; }
  }
  return best;
}

// Far-plane literals (WORLD_FAR_PLANES), recomputed from PARALLAX_LAYERS and the asset dims: the skyline tile instance nearest
// screen x probe.window * view width, the pylon instance whose foot (girl mini foot art px) is nearest probe.pylon * view width,
// and the near pylon instance (girl mini near foot) nearest probe.pylonNear * view width at the s11 pose.
export function farPlaneLiterals(): {
  windowTileOriginX: number; windowTileTopY: number; pylonTileOriginX: number; pylonTileTopY: number; pylonNearTileOriginX: number;
} {
  const probe = WORLD_FAR_PLANES.probe;
  const sky = nearestFarTile('skyline', { artX: 0, artY: 0 }, VIEW.width * probe.window);
  const pyl = nearestFarTile(
    'pylons',
    { artX: WORLD_FAR_PLANES.girlMini.footArtX, artY: WORLD_FAR_PLANES.girlMini.footArtY },
    VIEW.width * probe.pylon,
  );
  const near = nearestFarTile(
    'pylons',
    { artX: WORLD_FAR_PLANES.girlMiniNear.footArtX, artY: WORLD_FAR_PLANES.girlMiniNear.footArtY },
    VIEW.width * probe.pylonNear,
    framingPoseOf('s11'),
  );
  return {
    windowTileOriginX: sky.originX, windowTileTopY: sky.topY, pylonTileOriginX: pyl.originX, pylonTileTopY: pyl.topY,
    pylonNearTileOriginX: near.originX,
  };
}

import { MACHINE_COMPONENT_IDS, MACHINE_COMPONENTS } from '../../data/machineComponents';
import { TECH_IDS } from '../../data/types';
import type { TechId } from '../../data/types';
import { TECHNOLOGIES } from '../../data/technologies';
import { APERTURE_BEAM, CAMERA, DUST_RISING, ECLIPSE, GROUND_Y, PARALLAX_LAYERS, PIXEL_SCALE, PYLON_FEEDS, VIEW, WORLD } from '../../data/world';
import { SHOWCASE_PORTRAIT } from '../../data/showcase';
import { clampCenter, effectiveMinZoom, fitView, wheelToSnappedZoom } from './camera';
import type { FitViewOptions } from './camera';
import { boundsToWorld, visibleMachineBounds } from './machineBounds';
import { viewPose } from './finale';
import type { CameraPose } from './finale';

// WP18 showcase maths: display levels for the final machine, the teaser's scene floors, and the portrait / fit / photo poses.
// Pure: no Phaser, no DOM. Every number comes from src/data/*.

/** Tech level floors: a tech absent from the record has no floor. Always frozen, keys in TECH_IDS order. */
export type LevelFloor = Readonly<Partial<Record<TechId, number>>>;

interface WorldGate { techId: TechId; minLevel: number }

const MIN_ZOOM = effectiveMinZoom(VIEW, WORLD, CAMERA.minZoom);

const FIT_OPTIONS: FitViewOptions = {
  margin: CAMERA.fitMarginPx,
  pixelScale: PIXEL_SCALE,
  minZoom: MIN_ZOOM,
  maxZoom: CAMERA.maxZoom,
  defaultZoom: CAMERA.defaultZoom,
  defaultCenter: { x: CAMERA.focus.x, y: CAMERA.focus.y },
  world: WORLD,
  hudTopInsetPx: CAMERA.hudTopInsetPx,
  fullView: { groundY: GROUND_Y, groundBandPx: CAMERA.fullViewGroundBandPx, topMinPx: CAMERA.fullViewTopMinPx },
};

/** Copy into a frozen record in TECH_IDS order (the key order is part of the snapshot), keeping techs of era <= eraMax. */
function ordered(levels: Partial<Record<TechId, number>>, eraMax: number = Number.POSITIVE_INFINITY): LevelFloor {
  const out: Partial<Record<TechId, number>> = {};
  for (const id of TECH_IDS) {
    const level = levels[id];
    if (level !== undefined && TECHNOLOGIES[id].era <= eraMax) out[id] = level;
  }
  return Object.freeze(out);
}

/** Raise levels[tech] to at least level (creates the key when missing). */
function raise(levels: Partial<Record<TechId, number>>, tech: TechId, level: number): void {
  const current = levels[tech];
  if (current === undefined || level > current) levels[tech] = level;
}

let visualMax: LevelFloor | null = null;

/**
 * The tech levels at which EVERY machine part is visible: for each component, the max of its own gate, its alternative
 * gates, the latch gate and the stage gates. Derived from MACHINE_COMPONENTS; cached and frozen.
 */
export function visualMaxLevels(): LevelFloor {
  if (visualMax === null) {
    const levels: Partial<Record<TechId, number>> = {};
    for (const id of MACHINE_COMPONENT_IDS) {
      const def = MACHINE_COMPONENTS[id];
      raise(levels, def.techId, def.minLevel);
      for (const alt of def.alsoVisibleWith ?? []) raise(levels, alt.techId, alt.minLevel);
      const anim = def.animation;
      if (anim.kind === 'latch') raise(levels, anim.techId, anim.minLevel);
      if (anim.kind === 'stage') {
        for (const [tech, level] of anim.gates) raise(levels, tech, level);
      }
    }
    visualMax = ordered(levels);
  }
  return visualMax;
}

const visualByEra = new Map<number, LevelFloor>();

/** visualMaxLevels restricted to techs of era <= era (era < 1 or NaN: empty). Cached per era. */
export function visualMaxForEra(era: number): LevelFloor {
  let out = visualByEra.get(era);
  if (out === undefined) {
    out = ordered(visualMaxLevels(), era);
    visualByEra.set(era, out);
  }
  return out;
}

/** Every tech gate the world reads: parallax layers (visibleWhen, alphaStages), eclipse stages and diamond, pylon feeds, rising dust. */
function worldGates(): WorldGate[] {
  const gates: WorldGate[] = [];
  for (const layer of PARALLAX_LAYERS) {
    if (layer.visibleWhen) gates.push(layer.visibleWhen);
    for (const stage of layer.alphaStages ?? []) gates.push(stage);
  }
  for (const stage of ECLIPSE.stages) gates.push(stage);
  gates.push({ techId: ECLIPSE.diamond.techId, minLevel: 1 });   // the one-off flash shows once its tech is reached
  for (const feed of PYLON_FEEDS) {
    if (feed.gate) gates.push(feed.gate);
  }
  gates.push({ techId: DUST_RISING.techId, minLevel: DUST_RISING.minLevel });
  return gates;
}

const sceneByEra = new Map<number, LevelFloor>();

/**
 * Scene floors for the teaser: visualMaxForEra plus the world gates of techs with era <= era (max per tech), so the
 * backgrounds of an era show the same stage the machine does. Cached per era.
 */
export function sceneMaxForEra(era: number): LevelFloor {
  let out = sceneByEra.get(era);
  if (out === undefined) {
    const levels: Partial<Record<TechId, number>> = { ...visualMaxForEra(era) };
    for (const gate of worldGates()) {
      if (TECHNOLOGIES[gate.techId].era <= era) raise(levels, gate.techId, gate.minLevel);
    }
    out = ordered(levels);
    sceneByEra.set(era, out);
  }
  return out;
}

/**
 * Display levels: real levels raised to the floor per tech, never lowered. floor null, or a floor that raises nothing,
 * returns `real` itself. A raise returns a new object and leaves `real` untouched.
 */
export function mergeDisplayLevels(real: Readonly<Record<TechId, number>>, floor: LevelFloor | null): Readonly<Record<TechId, number>> {
  if (floor === null) return real;
  let out: Record<TechId, number> | null = null;   // copied on the first raise
  for (const id of TECH_IDS) {
    const level = floor[id];
    if (level === undefined || level <= real[id]) continue;
    out ??= { ...real };
    out[id] = level;
  }
  return out ?? real;
}

/** Canonical portrait camera pose: the finale 'full' view (whole machine plus sky). */
export function portraitPose(): CameraPose {
  return viewPose(SHOWCASE_PORTRAIT.view);
}

/** Camera pose that frames the visible machine at these tech levels (CameraController.target options). */
export function machineFitPose(levels: Readonly<Record<TechId, number>>): CameraPose {
  const { center, zoom } = fitView(boundsToWorld(visibleMachineBounds(levels)), VIEW, FIT_OPTIONS);
  return { centerX: center.x, centerY: center.y, zoom };
}

/** The aperture latch gate: the tech and level that open the aperture frame (the latch of APERTURE_BEAM.component). */
export function apertureGate(): { techId: TechId; minLevel: number } {
  const anim = MACHINE_COMPONENTS[APERTURE_BEAM.component].animation;
  if (anim.kind !== 'latch') throw new Error('aperture animation must be a latch');
  return { techId: anim.techId, minLevel: anim.minLevel };
}

/** Photo mode pan: the centre moves d / zoom world px per axis, then stays inside the world. Zoom unchanged. */
export function photoPanPose(pose: CameraPose, dxScreenPx: number, dyScreenPx: number): CameraPose {
  const centre = clampCenter(
    { x: pose.centerX + dxScreenPx / pose.zoom, y: pose.centerY + dyScreenPx / pose.zoom },
    pose.zoom, VIEW, WORLD,
  );
  return { centerX: centre.x, centerY: centre.y, zoom: pose.zoom };
}

/** Photo mode zoom: one grid step in (dir 1) or out (dir -1). The centre re-clamps for the new zoom. */
export function photoZoomPose(pose: CameraPose, dir: 1 | -1): CameraPose {
  const deltaY = dir > 0 ? -1 : 1;   // wheel convention: deltaY < 0 zooms in
  const zoom = wheelToSnappedZoom(pose.zoom, deltaY, PIXEL_SCALE, MIN_ZOOM, CAMERA.maxZoom);
  const centre = clampCenter({ x: pose.centerX, y: pose.centerY }, zoom, VIEW, WORLD);
  return { centerX: centre.x, centerY: centre.y, zoom };
}

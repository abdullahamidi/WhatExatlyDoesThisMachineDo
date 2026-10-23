import { SHOWCASE_TEASER } from '../../data/showcase';
import { TECHNOLOGIES } from '../../data/technologies';
import type { ResourceMap, TechId } from '../../data/types';
import { createInitialState } from '../../simulation/state';
import { computeRates } from '../../simulation/production/rates';
import { easeInOutCubic } from './finale';
import type { CameraPose } from './finale';
import { apertureGate, machineFitPose, mergeDisplayLevels, portraitPose, sceneMaxForEra } from './showcase';

// WP18 teaser maths: the ShowcaseScene script as pure functions of its clock t (seconds since the scene started).
// Every timing and floor comes from src/data/showcase.ts (SHOWCASE_TEASER) and the showcase maths. No Phaser, no DOM.

export type TeaserEra = 2 | 3 | 4 | 5;

export interface TeaserFrame {
  t: number;                                    // sanitized clock (non-finite and negative t read as 0)
  era: TeaserEra;
  apertureOpen: boolean;
  levels: Readonly<Record<TechId, number>>;     // teaserLevels(era, apertureOpen): the same reference for the same pair
  camera: CameraPose;
  boost: number;                                // 0..1 driver boost
  done: boolean;
}

const TEASER = SHOWCASE_TEASER;

let startCamera: CameraPose | null = null;

/** Cache key of (era, apertureOpen): two entries per era. */
function cacheKey(era: TeaserEra, apertureOpen: boolean): number {
  return era * 2 + (apertureOpen ? 1 : 0);
}

const levelCache = new Map<number, Readonly<Record<TechId, number>>>();
const rateCache = new Map<number, Readonly<ResourceMap>>();

/**
 * Display levels of the teaser at an era: start-of-game levels raised to the era's scene floor, with the aperture latch
 * gate held at 0 while closed and at least its minLevel while open. Frozen; cached per (era, apertureOpen).
 */
export function teaserLevels(era: TeaserEra, apertureOpen: boolean): Readonly<Record<TechId, number>> {
  const key = cacheKey(era, apertureOpen);
  let out = levelCache.get(key);
  if (out === undefined) {
    const levels: Record<TechId, number> = { ...mergeDisplayLevels(createInitialState(0).techLevels, sceneMaxForEra(era)) };
    const gate = apertureGate();
    levels[gate.techId] = apertureOpen ? Math.max(levels[gate.techId], gate.minLevel) : 0;
    out = Object.freeze(levels);
    levelCache.set(key, out);
  }
  return out;
}

/** Production per second of the teaser machine at an era and aperture state (computeRates on teaserLevels). Frozen; cached. */
export function teaserRates(era: TeaserEra, apertureOpen: boolean): Readonly<ResourceMap> {
  const key = cacheKey(era, apertureOpen);
  let out = rateCache.get(key);
  if (out === undefined) {
    out = Object.freeze(computeRates({ techLevels: teaserLevels(era, apertureOpen) }, TECHNOLOGIES).perSecond);
    rateCache.set(key, out);
  }
  return out;
}

/** Era-II fit pose the teaser starts from. Computed once: machineFitPose walks the visible parts. */
function startPose(): CameraPose {
  if (startCamera === null) startCamera = machineFitPose(teaserLevels(TEASER.fromEra, false));
  return startCamera;
}

/** Teaser camera at time: start fit pose to the portrait over camera.durS (cubic in-out; e clamps to 0..1 before and after). */
function cameraAt(time: number): CameraPose {
  const e = easeInOutCubic((time - TEASER.camera.startS) / TEASER.camera.durS);
  const from = startPose();
  const to = portraitPose();
  return {
    centerX: from.centerX * (1 - e) + to.centerX * e,
    centerY: from.centerY * (1 - e) + to.centerY * e,
    zoom: from.zoom * (1 - e) + to.zoom * e,
  };
}

/**
 * Teaser frame at t seconds into the scene. reduced: the portrait pose at every t (no camera move). Non-finite and
 * negative t read as 0, the same rule finaleFrame uses.
 */
export function teaserFrame(t: number, reduced: boolean): TeaserFrame {
  const time = Number.isFinite(t) && t > 0 ? t : 0;
  let era: TeaserEra = TEASER.fromEra;
  for (const step of TEASER.steps) {
    if (time >= step.atS) era = step.era;
  }
  const apertureOpen = time >= TEASER.apertureAtS;
  return {
    t: time,
    era,
    apertureOpen,
    levels: teaserLevels(era, apertureOpen),
    camera: reduced ? portraitPose() : cameraAt(time),
    boost: easeInOutCubic((time - TEASER.boost.startS) / TEASER.boost.rampS),
    done: time >= TEASER.endS,
  };
}

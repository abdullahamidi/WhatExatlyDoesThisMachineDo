import { describe, it, expect } from 'vitest';
import { MACHINE_COMPONENT_IDS } from '../../data/machineComponents';
import type { MachineComponentId } from '../../data/machineComponents';
import { TECH_IDS } from '../../data/types';
import type { TechId } from '../../data/types';
import { TECHNOLOGIES } from '../../data/technologies';
import { PIXEL_SCALE, VIEW, WORLD } from '../../data/world';
import { createInitialState } from '../../simulation';
import { clampCenter, zoomStep } from './camera';
import { visibleComponentIds } from './machineVisibility';
import {
  apertureGate, machineFitPose, mergeDisplayLevels, photoPanPose, photoZoomPose, portraitPose,
  sceneMaxForEra, visualMaxForEra, visualMaxLevels,
} from './showcase';
import type { LevelFloor } from './showcase';

/** Snapshot of visualMaxLevels(): 45 techs. The five techs with no part gate (motorTuning, improvedPistons, horizonField, finalAlignment, primaryFunction) are absent. */
const VISUAL_MAX_SNAPSHOT: Partial<Record<TechId, number>> = {
  handCrank: 1, gearRatio: 1, wornMotor: 1, flywheel: 1, reinforcedCrank: 1, pistonArray: 1, generator: 1, copperWinding: 20,
  motorRetrofit: 1, dynamoCrank: 1, capacitorBank: 1, sparkGap: 1, transformer: 1, powerLines: 1, boiler: 1, firebox: 20,
  inductionHeater: 1, superheater: 1, reliefValves: 1, steamHammer: 1, condenser: 1, turbine: 1, resonatorSpire: 1, standingWave: 1,
  harmonicCoil: 25, pressureResonator: 1, crankServo: 1, echoCrank: 1, phaseLock: 1, crystalLattice: 1, containmentRing: 25,
  nullChamber: 1, resonantSiphon: 20, graviticAnchor: 10, inversionCrank: 1, lensArray: 1, skyAperture: 1,
  generatorBlueprint: 1, substationBlueprint: 1, pressureVesselBlueprint: 1, harmonicConvergence: 1,
  bellowsDrive: 1, gridExciter: 1, mainsBackfeed: 1, steamLance: 1,
};
const ABSENT_FROM_VISUAL_MAX: TechId[] = ['motorTuning', 'improvedPistons', 'horizonField', 'finalAlignment', 'primaryFunction'];
/** Parts the greedy-end fixture must show after the merge (WP17 legacy feeds, siphon / anchor top stages, steam lance). */
const GREEDY_END_VISIBLE: MachineComponentId[] = [
  'generatorGlow', 'bellows', 'exciterFeed', 'backfeedTerminal', 'steamLance', 'siphonTube3L', 'siphonTube3R', 'siphonArcs3',
  'anchorGlow2L', 'anchorGlow2R', 'anchorGlow3L', 'anchorGlow3R',
];

/** Tech ids with a level in the floor, in TECH_IDS order. */
function keysOf(levels: LevelFloor): TechId[] {
  return TECH_IDS.filter((id) => levels[id] !== undefined);
}

describe('visualMaxLevels', () => {
  const levels = visualMaxLevels();

  it('matches the snapshot: 45 techs, exact values, five absent', () => {
    expect(Object.keys(levels)).toHaveLength(45);
    expect(levels).toEqual(VISUAL_MAX_SNAPSHOT);
    for (const id of ABSENT_FROM_VISUAL_MAX) expect(levels[id]).toBeUndefined();
  });

  it('keys are in TECH_IDS order', () => {
    expect(Object.keys(levels)).toEqual(keysOf(levels));
  });

  it('is frozen and cached (same reference)', () => {
    expect(Object.isFrozen(levels)).toBe(true);
    expect(visualMaxLevels()).toBe(levels);
  });

  it('no value is above the tech maxLevel', () => {
    for (const id of TECH_IDS) {
      const v = levels[id];
      const max = TECHNOLOGIES[id].maxLevel;
      if (v === undefined || max === null) continue;
      expect(v).toBeLessThanOrEqual(max);
    }
  });
});

describe('visualMaxForEra', () => {
  it('era 0 and NaN are empty and frozen', () => {
    expect(visualMaxForEra(0)).toEqual({});
    expect(visualMaxForEra(Number.NaN)).toEqual({});
    expect(Object.isFrozen(visualMaxForEra(0))).toBe(true);
  });

  it('era 3: copper 20, firebox 20, bellows drive 1, no era IV or V tech', () => {
    const e3 = visualMaxForEra(3);
    expect(e3.copperWinding).toBe(20);
    expect(e3.firebox).toBe(20);
    expect(e3.bellowsDrive).toBe(1);
    expect(e3.harmonicCoil).toBeUndefined();
    expect(e3.gridExciter).toBeUndefined();
  });

  it('era 4 adds harmonic coil 25 and grid exciter 1, no era V tech', () => {
    const e4 = visualMaxForEra(4);
    expect(e4.harmonicCoil).toBe(25);
    expect(e4.gridExciter).toBe(1);
    expect(e4.nullChamber).toBeUndefined();
    expect(e4.skyAperture).toBeUndefined();
  });

  it('era 5 is the whole visual max', () => {
    expect(visualMaxForEra(5)).toEqual(visualMaxLevels());
  });

  it('every key is an era <= the era asked', () => {
    for (let era = 1; era <= 5; era++) {
      expect(keysOf(visualMaxForEra(era)).every((id) => TECHNOLOGIES[id].era <= era)).toBe(true);
    }
  });

  it('cached per era (same reference on repeat)', () => {
    expect(visualMaxForEra(4)).toBe(visualMaxForEra(4));
  });
});

describe('sceneMaxForEra', () => {
  it('era 5 raises horizon field to 20 from the horizon glow stages', () => {
    expect(sceneMaxForEra(5).horizonField).toBe(20);
  });

  it('era 5 is a superset of visualMaxLevels (every key at least as high)', () => {
    const scene = sceneMaxForEra(5);
    for (const id of keysOf(visualMaxLevels())) {
      expect(scene[id] ?? 0).toBeGreaterThanOrEqual(visualMaxLevels()[id] ?? 0);
    }
  });

  it('era 2 has no tech above era 2; world gates of later eras are not applied', () => {
    const scene2 = sceneMaxForEra(2);
    expect(keysOf(scene2).every((id) => TECHNOLOGIES[id].era <= 2)).toBe(true);
    expect(scene2.horizonField).toBeUndefined();
    expect(sceneMaxForEra(4).horizonField).toBeUndefined();
  });

  it('era 0 is empty', () => {
    expect(sceneMaxForEra(0)).toEqual({});
  });
});

/** Start-of-game levels with every tech at the same value. */
function levelsAll(v: number): Record<TechId, number> {
  const out: Record<TechId, number> = { ...createInitialState(0).techLevels };
  for (const id of TECH_IDS) out[id] = v;
  return out;
}

describe('mergeDisplayLevels', () => {
  const real: Record<TechId, number> = { ...createInitialState(0).techLevels, copperWinding: 3, firebox: 30 };

  it('never lowers a level', () => {
    const merged = mergeDisplayLevels(real, visualMaxForEra(5));
    for (const id of TECH_IDS) expect(merged[id]).toBeGreaterThanOrEqual(real[id]);
    expect(merged.firebox).toBe(30);
    expect(merged.copperWinding).toBe(20);
  });

  it('null floor returns the same reference', () => {
    expect(mergeDisplayLevels(real, null)).toBe(real);
  });

  it('a floor that raises nothing returns the same reference', () => {
    expect(mergeDisplayLevels(real, {})).toBe(real);
    const high = levelsAll(99);
    expect(mergeDisplayLevels(high, visualMaxLevels())).toBe(high);
  });

  it('a raise returns a new object and leaves real untouched', () => {
    const before = { ...real };
    const merged = mergeDisplayLevels(real, visualMaxForEra(5));
    expect(merged).not.toBe(real);
    expect(real).toEqual(before);
    expect(merged.skyAperture).toBe(1);
  });
});

describe('greedy-end fixture', () => {
  const L: Record<TechId, number> = { ...createInitialState(0).techLevels };
  for (const id of keysOf(visualMaxLevels())) L[id] = 1;
  L.copperWinding = 10;
  L.firebox = 10;
  L.harmonicCoil = 16;
  L.containmentRing = 16;
  L.resonantSiphon = 11;
  L.graviticAnchor = 4;
  L.mainsBackfeed = 0;
  L.steamLance = 0;

  it('some parts are hidden before the merge', () => {
    const visible = visibleComponentIds(L);
    expect(visible.has('siphonTube3L')).toBe(false);
    expect(visible.has('steamLance')).toBe(false);
  });

  it('after the merge every machine part is visible and the listed parts are among them', () => {
    const visible = visibleComponentIds(mergeDisplayLevels(L, visualMaxForEra(5)));
    expect(visible.size).toBe(MACHINE_COMPONENT_IDS.length);
    for (const id of GREEDY_END_VISIBLE) expect(visible.has(id)).toBe(true);
  });
});

describe('poses', () => {
  it('portrait pose is the finale full view', () => {
    expect(portraitPose()).toEqual({ centerX: 1920, centerY: 1080, zoom: 0.5 });
  });

  it('aperture gate is the latch on sky aperture at level 1', () => {
    expect(apertureGate()).toEqual({ techId: 'skyAperture', minLevel: 1 });
  });

  it('machine fit at the start state is on the zoom grid and centred inside the world', () => {
    const pose = machineFitPose(createInitialState(0).techLevels);
    expect(pose.zoom).toBeGreaterThanOrEqual(0.5);
    expect(pose.zoom).toBeLessThanOrEqual(2);
    expect(Number.isInteger(pose.zoom / zoomStep(PIXEL_SCALE))).toBe(true);
    const c = clampCenter({ x: pose.centerX, y: pose.centerY }, pose.zoom, VIEW, WORLD);
    expect(pose.centerX).toBe(c.x);
    expect(pose.centerY).toBe(c.y);
  });

  it('machine fit with every part visible is zoom 0.5', () => {
    const full = mergeDisplayLevels(createInitialState(0).techLevels, visualMaxForEra(5));
    expect(machineFitPose(full).zoom).toBe(0.5);
  });

  it('photo pan moves the centre by d / zoom and clamps it inside the world', () => {
    const portrait = portraitPose();
    expect(photoPanPose(portrait, -10000, 0).centerX).toBe(1280);
    expect(photoPanPose(portrait, 10000, 0).centerX).toBe(2560);
    expect(photoPanPose(portrait, 0, 10000).centerY).toBe(1440);
    expect(photoPanPose(portrait, 96, 0).centerX).toBe(1920 + 192);
  });

  it('photo pan never changes zoom', () => {
    const portrait = portraitPose();
    for (const d of [-10000, -96, 0, 37, 10000]) {
      expect(photoPanPose(portrait, d, d).zoom).toBe(portrait.zoom);
    }
  });

  it('photo zoom steps the grid and keeps the centre valid', () => {
    const portrait = portraitPose();
    expect(photoZoomPose(portrait, 1).zoom).toBe(0.75);
    expect(photoZoomPose({ ...portrait, zoom: 2 }, 1).zoom).toBe(2);
    expect(photoZoomPose(portrait, -1).zoom).toBe(0.5);
    const edge = { centerX: 3800, centerY: 1080, zoom: 1 };
    const out = photoZoomPose(edge, -1);
    expect(out.zoom).toBe(0.75);
    expect(out.centerX).toBeCloseTo(WORLD.width - VIEW.width / 0.75 / 2, 6);
    const c = clampCenter({ x: out.centerX, y: out.centerY }, out.zoom, VIEW, WORLD);
    expect(out.centerX).toBe(c.x);
    expect(out.centerY).toBe(c.y);
  });
});

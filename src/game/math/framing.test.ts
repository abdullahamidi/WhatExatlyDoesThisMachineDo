import { describe, it, expect } from 'vitest';
import { fitView, effectiveMinZoom, viewBounds, boundsInView } from './camera';
import type { Bounds, FitViewOptions } from './camera';
import { visibleMachineBounds, boundsToWorld } from './machineBounds';
import { VIEW, WORLD, CAMERA, MACHINE_ANCHOR, PIXEL_SCALE } from '../../data/world';
import { TECH_IDS } from '../../data/types';
import type { TechId } from '../../data/types';

// Auto-framing of the machine, before (2560 x 1440 world, anchor 1280 / 1120, focus 1280 / 960, minZoom 0.5)
// and after the WP11 world growth (3840 x 2160, MACHINE_ANCHOR, CAMERA.focus, effectiveMinZoom).
// Stage buys are copied from scripts/smoke/stages.mjs (era I-IV only); '@x' markers mean tech x = 1.
const OLD_WORLD = { width: 2560, height: 1440 } as const;
const OLD_ANCHOR = { x: 1280, y: 1120 } as const;
const OLD_FOCUS = { x: 1280, y: 960 } as const;
const OLD_MIN_ZOOM = 0.5;

const S7: readonly string[] = ['wornMotor', 'gearRatio', 'gearRatio', 'gearRatio', 'reinforcedCrank',
  ...Array<string>(5).fill('motorTuning'), 'flywheel', 'pistonArray', 'improvedPistons'];
const S9: readonly string[] = [...S7, '@blueprint', 'generator', ...Array<string>(5).fill('motorRetrofit'),
  ...Array<string>(20).fill('copperWinding'), 'dynamoCrank', 'capacitorBank', 'sparkGap',
  ...Array<string>(3).fill('transformer'), 'powerLines'];
const S10: readonly string[] = [...S9, '@substationBlueprint', 'boiler'];
const S11: readonly string[] = [...S10, ...Array<string>(3).fill('inductionHeater'),
  ...Array<string>(20).fill('firebox'), 'steamHammer', 'superheater', ...Array<string>(5).fill('condenser'),
  'turbine', 'reliefValves', '@pressureVesselBlueprint'];
const S12: readonly string[] = [...S11, 'resonatorSpire'];
const S13: readonly string[] = [...S12, ...Array<string>(3).fill('crankServo'), ...Array<string>(25).fill('harmonicCoil'),
  ...Array<string>(3).fill('pressureResonator'), 'echoCrank', 'phaseLock', ...Array<string>(3).fill('standingWave'),
  'crystalLattice', '@harmonicConvergence'];

const MARKER_TECH: Readonly<Record<string, string>> = {
  '@blueprint': 'generatorBlueprint',
  '@substationBlueprint': 'substationBlueprint',
  '@pressureVesselBlueprint': 'pressureVesselBlueprint',
  '@harmonicConvergence': 'harmonicConvergence',
};

function isTechId(id: string): id is TechId {
  return (TECH_IDS as readonly string[]).includes(id);
}

/** All techs 0, then the buys counted per id; '@x' markers set the tech to 1. */
function levelsFrom(buys: readonly string[]): Record<TechId, number> {
  const out = {} as Record<TechId, number>;
  for (const t of TECH_IDS) out[t] = 0;
  for (const raw of buys) {
    const isMarker = raw.startsWith('@');
    const id = isMarker ? (MARKER_TECH[raw] ?? raw.slice(1)) : raw;
    if (!isTechId(id)) throw new Error(`unknown tech ${id}`);
    out[id] = isMarker ? 1 : out[id] + 1;
  }
  return out;
}

const SETS: ReadonlyArray<{ name: string; buys: readonly string[] }> = [
  { name: 's0 crank only', buys: [] },
  { name: 's1 gearRatio', buys: ['gearRatio'] },
  { name: 's2 wornMotor', buys: ['wornMotor'] },
  { name: 's3 wornMotor + gearRatio', buys: ['wornMotor', 'gearRatio'] },
  { name: 's7 era I full', buys: S7 },
  { name: 's9 era II full', buys: S9 },
  { name: 's10 boiler', buys: S10 },
  { name: 's11 era III full', buys: S11 },
  { name: 's13 era IV full', buys: S13 },
];

const LEGACY: FitViewOptions = {
  margin: CAMERA.fitMarginPx,
  pixelScale: PIXEL_SCALE,
  minZoom: OLD_MIN_ZOOM,
  maxZoom: CAMERA.maxZoom,
  defaultZoom: CAMERA.defaultZoom,
  defaultCenter: { ...OLD_FOCUS },
  world: OLD_WORLD,
  hudTopInsetPx: CAMERA.hudTopInsetPx,
};

const NEXT: FitViewOptions = {
  margin: CAMERA.fitMarginPx,
  pixelScale: PIXEL_SCALE,
  minZoom: effectiveMinZoom(VIEW, WORLD, CAMERA.minZoom),
  maxZoom: CAMERA.maxZoom,
  defaultZoom: CAMERA.defaultZoom,
  defaultCenter: { x: CAMERA.focus.x, y: CAMERA.focus.y },
  world: WORLD,
  hudTopInsetPx: CAMERA.hudTopInsetPx,
};

/** Screen y of a world y for a view centred on centreY at the given zoom. */
function screenY(worldY: number, centreY: number, zoom: number): number {
  return (worldY - centreY) * zoom + VIEW.height / 2;
}

describe('framing: legacy vs WP11 world', () => {
  for (const set of SETS) {
    const levels = levelsFrom(set.buys);
    const legacyBounds = boundsToWorld(visibleMachineBounds(levels), OLD_ANCHOR);
    const nextBounds: Bounds = boundsToWorld(visibleMachineBounds(levels));
    const legacy = fitView(legacyBounds, VIEW, LEGACY);
    const next = fitView(nextBounds, VIEW, NEXT);

    it(`${set.name}: same zoom and same centre offset from the anchor while the legacy zoom is at least 0.75`, () => {
      if (legacy.zoom < 0.75) return;
      expect(next.zoom).toBe(legacy.zoom);
      expect(next.center.x - MACHINE_ANCHOR.x).toBeCloseTo(legacy.center.x - OLD_ANCHOR.x, 9);
      expect(next.center.y - MACHINE_ANCHOR.y).toBeCloseTo(legacy.center.y - OLD_ANCHOR.y, 9);
    });

    it(`${set.name}: fits the view with the margin; at zoom 0.5 the top clears the HUD inset or the base stays at the margin`, () => {
      const view = viewBounds(next.center, next.zoom, VIEW);
      expect(boundsInView(nextBounds, view, CAMERA.fitMarginPx)).toBe(true);
      if (next.zoom !== 0.5) return;
      const top = screenY(nextBounds.top, next.center.y, next.zoom);
      const baseCapped = VIEW.height - CAMERA.fitMarginPx - (nextBounds.bottom - nextBounds.top) * next.zoom;
      expect(top).toBeGreaterThanOrEqual(Math.min(CAMERA.hudTopInsetPx, baseCapped) - 1e-9);
    });
  }

  it('s11 (era III full) is framed at zoom 0.5 in the WP11 world, with its ground line at screen y 480', () => {
    const levels = levelsFrom(S11);
    const next = fitView(boundsToWorld(visibleMachineBounds(levels)), VIEW, NEXT);
    expect(next.zoom).toBe(0.5);
    expect(screenY(MACHINE_ANCHOR.y, next.center.y, next.zoom)).toBeCloseTo(480, 9);
  });

  it('s13 (era IV full) is framed at zoom 0.5 in the WP11 world, with its ground line at screen y 648 (HUD shift capped by the bottom margin)', () => {
    const levels = levelsFrom(S13);
    const next = fitView(boundsToWorld(visibleMachineBounds(levels)), VIEW, NEXT);
    expect(next.zoom).toBe(0.5);
    expect(screenY(MACHINE_ANCHOR.y, next.center.y, next.zoom)).toBeCloseTo(648, 9);
  });
});

import type { AnimationDriver, Vec2 } from './machineComponents';
import type { TechId } from './types';
import { DEPTH } from './world';

/**
 * How an emitter spawns puffs.
 * rate: puffs/s = clamp(base + perLog * log10(1 + v), min, max) on the driver value v.
 * burst: `count` puffs spaced `spacingMs` apart, once every everyMinS..everyMaxS seconds while the driver is at least minDriver.
 *        A burst also fires once on purchase of the gate tech (see STEAM_FX.purchaseBurstDelayMs).
 * strike: one puff per hammer strike.
 */
export type EmitterMode =
  | { kind: 'rate'; base: number; perLog: number; min: number; max: number }
  | { kind: 'burst'; count: number; spacingMs: number; everyMinS: number; everyMaxS: number; minDriver: number }
  | { kind: 'strike' };

export interface SteamEmitter {
  id: string;
  assetId: 'fx.steamPuff' | 'fx.smoke';
  at: Vec2[];                                                    // machine-local art px spawn points
  gate: { techId: TechId; minLevel: number };
  driver: AnimationDriver;
  threshold: number;                                             // driver value below which the emitter stays quiet
  mode: EmitterMode;
}

/** Era III emitters, in draw order. Gates and modes are the ART_ERA3 section 5 values. */
export const STEAM_EMITTERS: readonly SteamEmitter[] = [
  // Boiler chimney: dark smoke, rate follows PR/s.
  { id: 'chimney', assetId: 'fx.smoke', at: [{ x: -293, y: -240 }], gate: { techId: 'boiler', minLevel: 1 },
    driver: 'thermal', threshold: 0, mode: { kind: 'rate', base: 0.4, perLog: 0.3, min: 0.4, max: 2 } },
  // Relief valves: bursts of steam while PR/s is high enough to vent.
  { id: 'relief', assetId: 'fx.steamPuff', at: [{ x: -218, y: -94 }, { x: -211, y: -94 }], gate: { techId: 'reliefValves', minLevel: 1 },
    driver: 'thermal', threshold: 0, mode: { kind: 'burst', count: 4, spacingMs: 120, everyMinS: 6, everyMaxS: 9, minDriver: 50 } },
  // Steam hammer: one puff per strike of the ram.
  { id: 'hammer', assetId: 'fx.steamPuff', at: [{ x: -334, y: -98 }], gate: { techId: 'steamHammer', minLevel: 1 },
    driver: 'thermal', threshold: 0, mode: { kind: 'strike' } },
  // Steam manifold: leaks from the three branch stubs while the automation driver runs.
  { id: 'manifold', assetId: 'fx.steamPuff', at: [{ x: -72, y: -182 }, { x: -44, y: -182 }, { x: -16, y: -182 }], gate: { techId: 'boiler', minLevel: 1 },
    driver: 'automation', threshold: 5, mode: { kind: 'rate', base: 0.3, perLog: 0.2, min: 0.3, max: 1.5 } },
];

/** Shared steam puff tuning: pool size, life, frames and motion. purchaseBurstDelayMs = MACHINE_ASSEMBLY.durationMs (the valve lands first). */
export const STEAM_FX = {
  poolSize: 48, lifeMs: 1200, frames: 4, riseArtPx: 12, driftArtPxPerS: 4,
  scaleFrom: 1, scaleTo: 1.5, fadeFrom: 0.75, depth: DEPTH.machine + 1, purchaseBurstDelayMs: 700,
} as const;

/** Hammer strike feedback: ram swing speed cap, mid-layer offset and dust puffs at the hammer foot. */
export const HAMMER_FX = {
  maxDegPerSec: 1080, midOffsetArtPx: -7, dustPuffs: 3, dustSpreadArtPx: 3, dustAt: { x: -334, y: -22 },
} as const;

/** Milestone whistle burst (CR-B): the relief emitter fires `count` puffs when the vessel blueprint is bought. */
export const MILESTONE_BURST = { techId: 'pressureVesselBlueprint', emitter: 'relief', count: 4 } as const;

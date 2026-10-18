import type { AnimationDriver, Vec2 } from './machineComponents';
import type { TechId } from './types';
import { DEPTH } from './world';

/**
 * How an emitter spawns puffs.
 * rate: puffs/s = clamp(base + perLog * log10(1 + v), min, max) on the driver value v.
 * burst: `count` puffs spaced `spacingMs` apart, once every everyMinS..everyMaxS seconds while the driver is above minDriver.
 *        A burst also fires once on purchase of the gate tech (see STEAM_FX.purchaseBurstDelayMs).
 *        roundRobin: each periodic burst fires all its puffs from ONE point, the point advancing per burst; purchase / milestone bursts use every point.
 * strike: one puff per hammer strike.
 */
export type EmitterMode =
  | { kind: 'rate'; base: number; perLog: number; min: number; max: number }
  | { kind: 'burst'; count: number; spacingMs: number; everyMinS: number; everyMaxS: number; minDriver: number; roundRobin?: boolean }
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
    driver: 'thermal', threshold: 0, mode: { kind: 'rate', base: 0.8, perLog: 0.3, min: 0.8, max: 2.5 } },
  // Relief valves: bursts of steam while PR/s is high enough to vent.
  { id: 'relief', assetId: 'fx.steamPuff', at: [{ x: -218, y: -94 }, { x: -211, y: -94 }], gate: { techId: 'reliefValves', minLevel: 1 },
    driver: 'thermal', threshold: 0, mode: { kind: 'burst', count: 4, spacingMs: 120, everyMinS: 6, everyMaxS: 9, minDriver: 50 } },
  // Steam hammer: one puff per strike of the ram.
  { id: 'hammer', assetId: 'fx.steamPuff', at: [{ x: -334, y: -98 }], gate: { techId: 'steamHammer', minLevel: 1 },
    driver: 'thermal', threshold: 0, mode: { kind: 'strike' } },
  // Steam manifold: leaks from the three branch stubs while the automation driver runs.
  { id: 'manifold', assetId: 'fx.steamPuff', at: [{ x: -72, y: -182 }, { x: -44, y: -182 }, { x: -16, y: -182 }], gate: { techId: 'boiler', minLevel: 1 },
    driver: 'automation', threshold: 5, mode: { kind: 'rate', base: 0.3, perLog: 0.2, min: 0.3, max: 1.5 } },
  // Calliope: three whistles on the manifold; one whistle per burst, round robin, while RS/s > 1. Spawn 4 px above each bell cap (art review: puffs at the mouth slid up the bell face and merged with the manifold stud leaks).
  { id: 'calliope', assetId: 'fx.steamPuff', at: [{ x: -72, y: -211 }, { x: -44, y: -216 }, { x: -16, y: -221 }], gate: { techId: 'pressureResonator', minLevel: 1 },
    driver: 'resonance', threshold: 0, mode: { kind: 'burst', count: 2, spacingMs: 150, everyMinS: 5, everyMaxS: 8, minDriver: 1, roundRobin: true } },
];

/** Shared steam puff tuning: pool size, life, frames and motion. purchaseBurstDelayMs = MACHINE_ASSEMBLY.durationMs (the valve lands first). */
export const STEAM_FX = {
  poolSize: 48, lifeMs: 1600, frames: 4, riseArtPx: 20, driftArtPxPerS: 4,
  scaleFrom: 1, scaleTo: 1.75, fadeFrom: 0.75, depth: DEPTH.machine + 1, purchaseBurstDelayMs: 700,
} as const;

/** Hammer strike feedback: ram swing speed cap, mid-layer offset and dust puffs at the hammer foot. */
export const HAMMER_FX = {
  maxDegPerSec: 1080, midOffsetArtPx: -7, dustPuffs: 3, dustSpreadArtPx: 3, dustAt: { x: -334, y: -22 },
} as const;

/** Milestone bursts in order: the vessel whistles (relief, 4 puffs) and the convergence chord of all three calliope whistles (6 puffs, every point). */
export const MILESTONE_BURSTS = [
  { techId: 'pressureVesselBlueprint', emitter: 'relief', count: 4 },
  { techId: 'harmonicConvergence', emitter: 'calliope', count: 6 },
] as const;

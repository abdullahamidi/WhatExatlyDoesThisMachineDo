import { describe, it, expect } from 'vitest';
import { STEAM_EMITTERS, STEAM_FX, HAMMER_FX, MILESTONE_BURSTS } from './steamFx';
import type { SteamEmitter } from './steamFx';
import { TECH_IDS } from './types';
import { TECHNOLOGIES } from './technologies';
import { MACHINE_BOUNDS, MACHINE_ASSEMBLY } from './machineComponents';
import { DEPTH } from './world';
import { ASSET_MANIFEST } from '../assets/manifest';

function emitter(id: string): SteamEmitter {
  const found = STEAM_EMITTERS.find((e) => e.id === id);
  if (!found) throw new Error(`missing emitter ${id}`);
  return found;
}

describe('STEAM_EMITTERS', () => {
  it('has the four Era III emitters and the Era IV calliope last, in contract order, with unique ids', () => {
    expect(STEAM_EMITTERS.map((e) => e.id)).toEqual(['chimney', 'relief', 'hammer', 'manifold', 'calliope']);
    expect(new Set(STEAM_EMITTERS.map((e) => e.id)).size).toBe(STEAM_EMITTERS.length);
  });

  it('every gate references a known tech at level 1 or more', () => {
    for (const e of STEAM_EMITTERS) {
      expect(TECH_IDS).toContain(e.gate.techId);
      expect(e.gate.minLevel, e.id).toBeGreaterThanOrEqual(1);
    }
  });

  it('every spawn point lies inside MACHINE_BOUNDS and every emitter has at least one point', () => {
    for (const e of STEAM_EMITTERS) {
      expect(e.at.length, e.id).toBeGreaterThanOrEqual(1);
      for (const p of e.at) {
        expect(p.x, e.id).toBeGreaterThanOrEqual(MACHINE_BOUNDS.left);
        expect(p.x, e.id).toBeLessThanOrEqual(MACHINE_BOUNDS.right);
        expect(p.y, e.id).toBeGreaterThanOrEqual(MACHINE_BOUNDS.top);
        expect(p.y, e.id).toBeLessThanOrEqual(MACHINE_BOUNDS.bottom);
      }
    }
  });

  it('chimney is dark smoke on the thermal driver with a rate of 0.8 + 0.3 log10(1 + v) clamped to 0.8..2.5', () => {
    const c = emitter('chimney');
    expect(c.assetId).toBe('fx.smoke');
    expect(c.at).toEqual([{ x: -293, y: -240 }]);
    expect(c.gate).toEqual({ techId: 'boiler', minLevel: 1 });
    expect(c.driver).toBe('thermal');
    expect(c.threshold).toBe(0);
    expect(c.mode).toEqual({ kind: 'rate', base: 0.8, perLog: 0.3, min: 0.8, max: 2.5 });
  });

  it('relief is two steam puffs, a burst of 4 spaced 120 ms, every 6..9 s while PR/s is at least 50', () => {
    const r = emitter('relief');
    expect(r.assetId).toBe('fx.steamPuff');
    expect(r.at).toEqual([{ x: -218, y: -94 }, { x: -211, y: -94 }]);
    expect(r.gate).toEqual({ techId: 'reliefValves', minLevel: 1 });
    expect(r.driver).toBe('thermal');
    expect(r.threshold).toBe(0);
    expect(r.mode).toEqual({ kind: 'burst', count: 4, spacingMs: 120, everyMinS: 6, everyMaxS: 9, minDriver: 50 });
  });

  it('hammer is one steam puff per strike on the thermal driver', () => {
    const h = emitter('hammer');
    expect(h.assetId).toBe('fx.steamPuff');
    expect(h.at).toEqual([{ x: -334, y: -98 }]);
    expect(h.gate).toEqual({ techId: 'steamHammer', minLevel: 1 });
    expect(h.driver).toBe('thermal');
    expect(h.threshold).toBe(0);
    expect(h.mode).toEqual({ kind: 'strike' });
  });

  it('manifold is three steam puffs on the automation driver with threshold 5 and a rate of 0.3 + 0.2 log10(1 + v) clamped to 0.3..1.5', () => {
    const m = emitter('manifold');
    expect(m.assetId).toBe('fx.steamPuff');
    expect(m.at).toEqual([{ x: -72, y: -182 }, { x: -44, y: -182 }, { x: -16, y: -182 }]);
    expect(m.gate).toEqual({ techId: 'boiler', minLevel: 1 });
    expect(m.driver).toBe('automation');
    expect(m.threshold).toBe(5);
    expect(m.mode).toEqual({ kind: 'rate', base: 0.3, perLog: 0.2, min: 0.3, max: 1.5 });
  });

  it('rate modes have min <= max and base >= min; burst modes have count >= 1 and everyMinS <= everyMaxS', () => {
    for (const e of STEAM_EMITTERS) {
      if (e.mode.kind === 'rate') {
        expect(e.mode.min, e.id).toBeLessThanOrEqual(e.mode.max);
        expect(e.mode.base, e.id).toBeGreaterThanOrEqual(e.mode.min);
      }
      if (e.mode.kind === 'burst') {
        expect(e.mode.count, e.id).toBeGreaterThanOrEqual(1);
        expect(e.mode.everyMinS, e.id).toBeLessThanOrEqual(e.mode.everyMaxS);
      }
    }
  });

  it('calliope is three whistles on the resonance driver: gate pressureResonator 1, threshold 0, burst 2 x 150 ms every 5..8 s while RS/s > 1, round robin', () => {
    const c = emitter('calliope');
    expect(c.assetId).toBe('fx.steamPuff');
    expect(c.at).toEqual([{ x: -72, y: -193 }, { x: -44, y: -193 }, { x: -16, y: -194 }]);
    expect(c.gate).toEqual({ techId: 'pressureResonator', minLevel: 1 });
    expect(c.driver).toBe('resonance');
    expect(c.threshold).toBe(0);
    expect(c.mode).toEqual({ kind: 'burst', count: 2, spacingMs: 150, everyMinS: 5, everyMaxS: 8, minDriver: 1, roundRobin: true });
  });

  it('roundRobin is set only on burst modes, and only on the calliope among the emitters', () => {
    for (const e of STEAM_EMITTERS) {
      if (e.mode.kind !== 'burst') {
        expect('roundRobin' in e.mode, e.id).toBe(false);
      }
    }
    expect(STEAM_EMITTERS.filter((e) => e.mode.kind === 'burst' && e.mode.roundRobin === true).map((e) => e.id)).toEqual(['calliope']);
  });
});

describe('MILESTONE_BURSTS (WP10 milestone whistles)', () => {
  it('has two entries in order: the vessel relief burst (4 puffs), then the convergence calliope burst (6 puffs)', () => {
    expect(MILESTONE_BURSTS).toEqual([
      { techId: 'pressureVesselBlueprint', emitter: 'relief', count: 4 },
      { techId: 'harmonicConvergence', emitter: 'calliope', count: 6 },
    ]);
  });

  it('each emitter exists and is a burst, and each techId is a milestone tech', () => {
    for (const m of MILESTONE_BURSTS) {
      expect(emitter(m.emitter).mode.kind, m.emitter).toBe('burst');
      expect(TECHNOLOGIES[m.techId].kind, m.techId).toBe('milestone');
      expect(TECH_IDS).toContain(m.techId);
    }
  });

});

describe('STEAM_FX and HAMMER_FX', () => {
  it('the puff frame count equals the manifest frame count of both steam sheets', () => {
    expect(ASSET_MANIFEST['fx.steamPuff'].frame?.count).toBe(STEAM_FX.frames);
    expect(ASSET_MANIFEST['fx.smoke'].frame?.count).toBe(STEAM_FX.frames);
  });

  it('puffs draw one layer above the machine', () => {
    expect(STEAM_FX.depth).toBe(DEPTH.machine + 1);
  });

  it('fade starts inside (0, 1), the life is positive and the pool holds at least 16 puffs', () => {
    expect(STEAM_FX.fadeFrom).toBeGreaterThan(0);
    expect(STEAM_FX.fadeFrom).toBeLessThan(1);
    expect(STEAM_FX.lifeMs).toBeGreaterThan(0);
    expect(STEAM_FX.poolSize).toBeGreaterThanOrEqual(16);
  });

  it('the purchase burst waits for the valve assembly to land', () => {
    expect(STEAM_FX.purchaseBurstDelayMs).toBe(MACHINE_ASSEMBLY.durationMs);
  });

  it('the hammer dust sits inside the machine bounds and the swing cap is 1080 deg/s', () => {
    expect(HAMMER_FX.dustAt.x).toBeGreaterThanOrEqual(MACHINE_BOUNDS.left);
    expect(HAMMER_FX.dustAt.x).toBeLessThanOrEqual(MACHINE_BOUNDS.right);
    expect(HAMMER_FX.dustAt.y).toBeGreaterThanOrEqual(MACHINE_BOUNDS.top);
    expect(HAMMER_FX.dustAt.y).toBeLessThanOrEqual(MACHINE_BOUNDS.bottom);
    expect(HAMMER_FX.maxDegPerSec).toBe(1080);
  });
});

describe('MILESTONE_BURSTS[0]', () => {
  it('names a burst emitter and a milestone tech', () => {
    expect(emitter(MILESTONE_BURSTS[0].emitter).mode.kind).toBe('burst');
    expect(TECHNOLOGIES[MILESTONE_BURSTS[0].techId].kind).toBe('milestone');
    expect(MILESTONE_BURSTS[0].techId).toBe('pressureVesselBlueprint');
    expect(MILESTONE_BURSTS[0].count).toBeGreaterThanOrEqual(1);
  });
});

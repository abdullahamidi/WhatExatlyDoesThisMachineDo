import { describe, it, expect } from 'vitest';
import { MACHINE_BOUNDS } from '../../data/machineComponents';
import { MILESTONE_BURSTS, STEAM_EMITTERS, STEAM_FX } from '../../data/steamFx';
import type { SteamEmitter } from '../../data/steamFx';
import { DUST } from '../../data/world';
import { FINALE_BIRDS, FINALE_BOOST, FINALE_SEEDS } from '../../data/finale';

// Perf budgets that can be derived from data alone (no browser). Thresholds for the live smoke live in
// scripts/smoke/perf-budget.json; these are the structural bounds the render path must stay inside.

const MAX_RT_SIDE = 2048;                 // px per side the machine render target may reach (GPU texture limit we target)
const MAX_RT_BYTES = 16 * 1024 * 1024;    // RGBA bytes the machine render target may use
const MAX_LIVE_PARTICLES = 300;           // worst-case live particles across steam, dust, finale seeds and birds

const LIFE_S = STEAM_FX.lifeMs / 1000;

/** Steady-state live steam puffs of one periodic emitter: rate emitters at max rate x lifetime; burst emitters
 *  count x the number of bursts that can overlap (one burst spans (count-1) x spacing + lifetime). Strike emitters
 *  follow hammer strikes, which data does not bound; they are covered by the pool cap (STEAM_FX.poolSize). */
function emitterLivePuffs(e: SteamEmitter): number {
  const mode = e.mode;
  if (mode.kind === 'rate') return mode.max * LIFE_S;
  if (mode.kind === 'burst') {
    const spanS = ((mode.count - 1) * mode.spacingMs + STEAM_FX.lifeMs) / 1000;
    return mode.count * Math.ceil(spanS / mode.everyMinS);
  }
  return 0;
}

/** One-off steam bursts that can add to the periodic ones: the purchase burst of each burst emitter, the milestone
 *  whistles, and the finale calliope beat. */
function oneOffPuffs(): number {
  const purchase = STEAM_EMITTERS.reduce((sum, e) => {
    const mode = e.mode;
    if (mode.kind !== 'burst') return sum;
    return sum + (mode.roundRobin === true ? mode.count * e.at.length : mode.count);
  }, 0);
  const milestones = MILESTONE_BURSTS.reduce((sum, m) => sum + m.count, 0);
  return purchase + milestones + FINALE_BOOST.calliope.count;
}

describe('machine render target', () => {
  const w = MACHINE_BOUNDS.right - MACHINE_BOUNDS.left;
  const h = MACHINE_BOUNDS.bottom - MACHINE_BOUNDS.top;

  it('is at most 2048 px per side (art resolution, the RT is drawn at art px)', () => {
    expect(w).toBeGreaterThan(0);
    expect(h).toBeGreaterThan(0);
    expect(w).toBeLessThanOrEqual(MAX_RT_SIDE);
    expect(h).toBeLessThanOrEqual(MAX_RT_SIDE);
  });

  it('uses at most 16 MB of RGBA', () => {
    expect(w * h * 4).toBeLessThanOrEqual(MAX_RT_BYTES);
  });
});

describe('worst-case live particles', () => {
  it('steam emitters: every periodic emitter fits inside the puff pool, and the pool caps the total', () => {
    const periodic = STEAM_EMITTERS.reduce((sum, e) => sum + emitterLivePuffs(e), 0);
    const derived = periodic + oneOffPuffs();
    expect(Number.isFinite(derived)).toBe(true);
    // derived steady-state puffs (rate, burst and one-off bursts) are below the pool; spawn drops anything past poolSize
    expect(derived).toBeLessThanOrEqual(STEAM_FX.poolSize);
    expect(STEAM_FX.poolSize).toBeGreaterThan(0);
  });

  it('dust: one mote stream is live at a time, capped at DUST.maxParticles', () => {
    expect(DUST.maxParticles).toBeGreaterThan(0);
    expect(DUST.maxParticles).toBeLessThanOrEqual(MAX_LIVE_PARTICLES);
  });

  it('finale seeds: frequency x lifespan max bounds the live motes (no alive cap on the seed emitter)', () => {
    const seeds = Math.ceil(FINALE_SEEDS.lifespanMs[1] / FINALE_SEEDS.frequencyMs);
    expect(seeds).toBeGreaterThan(0);
    expect(seeds).toBeLessThanOrEqual(MAX_LIVE_PARTICLES);
  });

  it('finale birds: at most FINALE_BIRDS.size[1] sprites in the pool', () => {
    expect(FINALE_BIRDS.size[1]).toBeGreaterThanOrEqual(FINALE_BIRDS.size[0]);
    expect(FINALE_BIRDS.size[1]).toBeLessThanOrEqual(MAX_LIVE_PARTICLES);
  });

  it('all sources together stay within 300 live particles', () => {
    const steam = STEAM_FX.poolSize;
    const seeds = Math.ceil(FINALE_SEEDS.lifespanMs[1] / FINALE_SEEDS.frequencyMs);
    const total = steam + DUST.maxParticles + seeds + FINALE_BIRDS.size[1];
    expect(total).toBeLessThanOrEqual(MAX_LIVE_PARTICLES);
  });
});

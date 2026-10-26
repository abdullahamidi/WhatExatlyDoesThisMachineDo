import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ONBOARDING, NEXT_GOAL, AFFORDABLE_BADGE, ERA_CARD, ASSEMBLY_QUEUE, CAMERA_NUDGE, TOAST_BURST, CRANK_SPARKS, HUD_BUMP, OUTPUT_TICK } from './ux';
import { TECHNOLOGIES } from './technologies';
import { ERA_KEYSTONES } from './eras';
import { MACHINE_COMPONENT_IDS } from './machineComponents';

// The WP20 constants are a contract imported by eight files: a broken tech id, a rename or a retune of a
// player-facing string fails here instead of in the browser.
describe('NEXT_GOAL sequence', () => {
  it('every id is a real unlock or milestone tech, with no duplicates', () => {
    const seq = NEXT_GOAL.sequence;
    expect(new Set(seq).size).toBe(seq.length);
    for (const id of seq) {
      expect(TECHNOLOGIES[id]).toBeDefined();
      expect(['unlock', 'milestone']).toContain(TECHNOLOGIES[id].kind);
    }
  });

  it('the era never drops along the sequence', () => {
    const eras = NEXT_GOAL.sequence.map((id) => TECHNOLOGIES[id].era);
    expect(eras).toEqual([...eras].sort((a, b) => a - b));
  });

  it('ends at primaryFunction and holds every era keystone', () => {
    expect(NEXT_GOAL.sequence.at(-1)).toBe('primaryFunction');
    for (const k of ERA_KEYSTONES) expect(NEXT_GOAL.sequence).toContain(k.techId);
  });
});

describe('WP20 timing and camera bounds', () => {
  it('the era card shows for 2 to 3 seconds and the toast burst window is 1 to 2 seconds', () => {
    expect(ERA_CARD.showMs).toBeGreaterThanOrEqual(2000);
    expect(ERA_CARD.showMs).toBeLessThanOrEqual(3000);
    expect(TOAST_BURST.windowMs).toBeGreaterThanOrEqual(1000);
    expect(TOAST_BURST.windowMs).toBeLessThanOrEqual(2000);
  });

  it('the camera nudge fractions are strictly inside (0, 1)', () => {
    expect(CAMERA_NUDGE.fraction).toBeGreaterThan(0);
    expect(CAMERA_NUDGE.fraction).toBeLessThan(1);
    expect(CAMERA_NUDGE.innerFraction).toBeGreaterThan(0);
    expect(CAMERA_NUDGE.innerFraction).toBeLessThan(1);
  });

  it('the assembly queue fly-in lands within 1.5 seconds at its longest stagger', () => {
    expect(ASSEMBLY_QUEUE.maxStaggerSteps * ASSEMBLY_QUEUE.staggerMs).toBeLessThanOrEqual(1500);
  });
});

describe('WP20 click juice', () => {
  it('at most 8 sparks per click, and the pool holds at least four clicks of sparks', () => {
    expect(CRANK_SPARKS.count).toBeLessThanOrEqual(8);
    expect(CRANK_SPARKS.maxAlive).toBeGreaterThanOrEqual(4 * CRANK_SPARKS.count);
  });

  it('the HUD bump is a small scale-up that settles quickly', () => {
    expect(HUD_BUMP.scale).toBeGreaterThan(1);
    expect(HUD_BUMP.scale).toBeLessThanOrEqual(1.2);
    expect(HUD_BUMP.durationMs).toBeGreaterThan(0);
  });
});

describe('WP20 player-facing copy', () => {
  it('the crank prompt, tech hint and ready line are exact', () => {
    expect(ONBOARDING.crankPrompt).toBe('> TURN THE CRANK [CLICK / SPACE]');
    expect(ONBOARDING.techHint).toBe('> SCHEMATIC AVAILABLE — OPEN TECH INDEX [T]');
    expect(NEXT_GOAL.ready).toBe('READY — OPEN TECH INDEX [T]');
  });

  it('the affordable badge caps at 99 and overflows as 99+', () => {
    expect(AFFORDABLE_BADGE.max).toBe(99);
    expect(AFFORDABLE_BADGE.overflow).toBe('99+');
  });
});

// WP25 machine output popups: the anchors must be real machine parts, or the ticker has nothing to point at.
describe('WP25 machine output popups (OUTPUT_TICK)', () => {
  it('every anchor is a real machine component, keyed by era 1..5', () => {
    expect(Object.keys(OUTPUT_TICK.anchor).sort()).toEqual(['1', '2', '3', '4', '5']);
    for (const id of Object.values(OUTPUT_TICK.anchor)) expect(MACHINE_COMPONENT_IDS).toContain(id);
  });

  it('the period is at least a second and the fade fits inside one period', () => {
    expect(OUTPUT_TICK.periodMs).toBeGreaterThanOrEqual(1000);
    expect(OUTPUT_TICK.fadeMs).toBeGreaterThan(0);
    expect(OUTPUT_TICK.fadeMs).toBeLessThanOrEqual(OUTPUT_TICK.periodMs);
  });

  it('the rise, alpha, font scale and pool size are in range', () => {
    expect(OUTPUT_TICK.riseWorldPx).toBeGreaterThanOrEqual(0);
    expect(OUTPUT_TICK.alpha).toBeGreaterThan(0);
    expect(OUTPUT_TICK.alpha).toBeLessThanOrEqual(1);
    expect(OUTPUT_TICK.fontScale).toBeGreaterThan(0);
    expect(OUTPUT_TICK.fontScale).toBeLessThanOrEqual(1);
    expect(OUTPUT_TICK.poolSize).toBeGreaterThanOrEqual(2);
  });

  it('every era 1..5 has a finite offset that lifts the text or leaves it level (y <= 0)', () => {
    expect(Object.keys(OUTPUT_TICK.offset).sort()).toEqual(['1', '2', '3', '4', '5']);
    for (const o of Object.values(OUTPUT_TICK.offset)) {
      expect(Number.isFinite(o.x)).toBe(true);
      expect(Number.isFinite(o.y)).toBe(true);
      expect(o.y).toBeLessThanOrEqual(0);
    }
  });

  it('the hold fits inside the fade (0 <= holdMs < fadeMs)', () => {
    expect(OUTPUT_TICK.holdMs).toBeGreaterThanOrEqual(0);
    expect(OUTPUT_TICK.holdMs).toBeLessThan(OUTPUT_TICK.fadeMs);
  });
});

describe('ux.ts purity', () => {
  it('has no Phaser import (pure data)', () => {
    const src = readFileSync(new URL('./ux.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/from ['"]phaser['"]/);
  });
});

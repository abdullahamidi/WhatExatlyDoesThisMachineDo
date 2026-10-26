// Living world transition data tests (WP24): the order and the rows cover every TransitionId exactly once, every D-T minimum holds
// (docs/plan/WP24.md), the stagger and stare offsets are sane, and every toggle gap keeps a stutter at or under 3 toggles a second.
// Why: the queue runs these durations as written, so a short value here would show on screen as an instant change.
// Structure only: the tuned values are free to move inside these bounds. Pure data test (node environment, no Phaser).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { WORLD_TRANSITIONS } from './worldTransitions';
import type { TransitionId } from './worldTransitions';

const SRC = readFileSync(new URL('./worldTransitions.ts', import.meta.url), 'utf8');

// Every TransitionId as a key, so a missing or extra id fails the compile as well as the tests below.
const ALL: Record<TransitionId, true> = {
  eraRow: true, alpha: true, shadowScale: true, shadows: true, drawFps: true, led: true, lamp: true, booth: true, lampWarm: true,
  lampDead: true, windows: true, breathe: true, windowsDark: true, girlWindow: true, motes: true, motesFreeze: true, motesFall: true,
  hole: true, scrapBurn: true, puddle: true, puddleBlack: true, sprout: true, fogBuild: true, fogClear: true, chladni: true,
  chladniViolet: true, virga: true, receiver: true, stare: true, reverse: true, unison: true,
};
const ALL_IDS = Object.keys(ALL).sort();

const { rows } = WORLD_TRANSITIONS;

describe('worldTransitions: coverage', () => {
  it('orders every TransitionId exactly once', () => {
    const order: readonly string[] = WORLD_TRANSITIONS.order;
    expect(new Set(order).size).toBe(order.length);
    expect([...order].sort()).toEqual(ALL_IDS);
  });

  it('gives every TransitionId a row and no other row', () => {
    expect(Object.keys(rows).sort()).toEqual(ALL_IDS);
  });
});

describe('worldTransitions: D-T minimums', () => {
  it('holds the era, cast, shadow and fps ramps', () => {
    expect(rows.eraRow.ms).toBeGreaterThanOrEqual(8000);
    expect(rows.alpha.ms).toBeGreaterThanOrEqual(4000);
    expect(rows.shadowScale.ms).toBeGreaterThanOrEqual(4000);
    expect(rows.shadows.ms).toBeGreaterThanOrEqual(10000);
    expect(rows.drawFps.ms).toBeGreaterThanOrEqual(3000);
    expect(rows.led.ms).toBeGreaterThanOrEqual(3000);
  });

  it('holds the lamp, booth and lamp-state stutters', () => {
    expect(rows.lamp.buzzMs).toBeGreaterThanOrEqual(3000);
    expect(rows.lamp.glowMs).toBeGreaterThanOrEqual(4000);
    expect(rows.booth.totalMs).toBeGreaterThanOrEqual(2500);
    expect(rows.booth.delayAfterLampMs).toBe(1500);
    expect(rows.lampWarm.ms).toBeGreaterThanOrEqual(20000);
    expect(rows.lampDead.ms).toBeGreaterThanOrEqual(2000);
  });

  it('holds the windows at 15 s or more over five gaps', () => {
    const { gapMs, totalMinMs } = rows.windows;
    expect(totalMinMs).toBeGreaterThanOrEqual(15000);
    expect(gapMs[0] * 5).toBeGreaterThanOrEqual(totalMinMs);
  });

  it('holds the breathe, dark windows and girl window', () => {
    expect(rows.breathe.ms).toBeGreaterThanOrEqual(4000);
    expect(rows.windowsDark.fadeMs).toBeGreaterThanOrEqual(1500);
    expect(rows.windowsDark.gapMs).toBeGreaterThanOrEqual(3000);
    expect(rows.girlWindow.ms).toBeGreaterThanOrEqual(4000);
  });

  it('gives the girl window flicker a finite slow factor above zero', () => {
    expect(Number.isFinite(rows.girlWindow.slowFactor)).toBe(true);
    expect(rows.girlWindow.slowFactor).toBeGreaterThan(0);
  });

  it('holds the motes at 20 s or more over five gaps, and the freeze and fall', () => {
    const { gapMs, totalMinMs } = rows.motes;
    expect(totalMinMs).toBeGreaterThanOrEqual(20000);
    expect(gapMs[0] * 5).toBeGreaterThanOrEqual(totalMinMs);
    expect(rows.motesFreeze.ms).toBeGreaterThanOrEqual(3000);
    expect(rows.motesFall.ms[0]).toBeGreaterThanOrEqual(20000);
  });

  it('holds the hole bouts, scrap burn and settle', () => {
    expect(rows.hole.boutMinMs).toBeGreaterThanOrEqual(6000);
    expect(rows.hole.settleMs).toBeGreaterThanOrEqual(30000);
    expect(rows.scrapBurn.ms).toBeGreaterThanOrEqual(4000);
    expect(rows.scrapBurn.gapMs).toBeGreaterThanOrEqual(2000);
  });

  it('holds the puddle, sprout and fog ramps', () => {
    expect(rows.puddle.ms).toBeGreaterThanOrEqual(45000);
    expect(rows.puddleBlack.ms).toBeGreaterThanOrEqual(20000);
    expect(rows.sprout.ms).toBeGreaterThanOrEqual(40000);
    expect(rows.fogBuild.ms).toBeGreaterThanOrEqual(30000);
    expect(rows.fogClear.ms).toBeGreaterThanOrEqual(30000);
  });

  it('holds the Chladni rings and violet, the virga phases and the receiver', () => {
    expect(rows.chladni.ringMs).toBeGreaterThanOrEqual(1500);
    expect(rows.chladniViolet.ms).toBeGreaterThanOrEqual(10000);
    expect(rows.virga.inMs).toBeGreaterThanOrEqual(20000);
    expect(rows.virga.freezeMs).toBeGreaterThanOrEqual(10000);
    expect(rows.virga.outMs).toBeGreaterThanOrEqual(60000);
    expect(rows.receiver.ms).toBeGreaterThanOrEqual(3000);
  });
});

describe('worldTransitions: stagger, stare, unison and toggles', () => {
  it('starts queued rows after the gate closes, with a first stagger gap and then a wider one', () => {
    expect(WORLD_TRANSITIONS.startAfterCloseMs).toBeGreaterThanOrEqual(1000);
    expect(WORLD_TRANSITIONS.staggerMs[0]).toBeGreaterThanOrEqual(600);
    expect(WORLD_TRANSITIONS.staggerMs[0]).toBeLessThan(WORLD_TRANSITIONS.staggerMs[1]);
  });

  it('spreads the stare inside 3 s with offsets in (0, 1], ascending inspector, dog, crow, girl', () => {
    const { spreadMs, offsets } = rows.stare;
    expect(spreadMs).toBeLessThanOrEqual(3000);
    const turns = [offsets.inspector, offsets.dog, offsets.crow, offsets.girl];
    for (const t of turns) {
      expect(t).toBeGreaterThan(0);
      expect(t).toBeLessThanOrEqual(1);
    }
    expect(turns).toEqual([...turns].sort((a, b) => a - b));
    expect(new Set(turns).size).toBe(turns.length);
  });

  it('joins unison within 3 beats', () => {
    expect(rows.unison.maxBeats).toBeLessThanOrEqual(3);
  });

  it('keeps every stutter toggle gap at or above 334 ms (at most 3 toggles a second)', () => {
    const toggles = [rows.lamp.toggleMs, rows.booth.toggleMs, rows.lampDead.toggleMs];
    for (const ms of toggles) expect(ms).toBeGreaterThanOrEqual(334);
  });

  it('imports nothing from Phaser', () => {
    expect(SRC).not.toMatch(/from\s+['"]phaser/);
  });
});
